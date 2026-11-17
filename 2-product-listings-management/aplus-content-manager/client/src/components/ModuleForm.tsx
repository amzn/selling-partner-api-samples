import { useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';
import { api, type ApiError } from '../api';
import { emptyValue, imageSizeFor, label, type Field, type Schema } from '../catalog';
import { useImages } from '../images';

type Props = {
  schema: Schema;
  value: Record<string, unknown>;
  path: string;
  onChange: (v: Record<string, unknown>) => void;
  errors: ApiError[];
};

/**
 * An error belongs to a field when the service path (after "contentModuleList[n].") is that field's path plus at most a
 * component leaf (".value", ".textList", ".imageCropSpecification.size.height.value", ...), so it is shown once, on the
 * deepest form control, rather than on every ancestor group.
 */
const LEAF =
  /^(\.value|\.textList(\[\d+\]\.value)?|\.uploadDestinationId|\.imageCropSpecification(\.size\.(width|height)\.value)?)?$/;
export function matchesField(details: string | undefined, fieldPath: string): boolean {
  const m = (details ?? '').match(/contentModuleList\[\d+\]\.(.*?): /);
  if (!m) return false;
  const rel = m[1];
  return rel.startsWith(fieldPath) && LEAF.test(rel.slice(fieldPath.length));
}

/** Renders any module definition from the catalog. `path` is the details-path prefix ("premiumTechSpecs") used to match service errors to fields. */
/** True when some form control in this schema (recursively) will display the error, so callers can avoid repeating it. */
export function claimedBySchema(details: string | undefined, schema: Schema, path: string, value: unknown): boolean {
  const v = (value ?? {}) as Record<string, unknown>;
  return schema.fields.some((f) => {
    const p = `${path}.${f.name}`;
    if (matchesField(details, p)) return true;
    const child = v[f.name];
    if (f.schema && child) return claimedBySchema(details, f.schema, p, child);
    if (f.itemSchema && Array.isArray(child))
      return child.some((item, i) => claimedBySchema(details, f.itemSchema!, `${p}[${i}]`, item));
    return false;
  });
}

export function ModuleForm({ schema, value, path, onChange, errors }: Props) {
  const set = (name: string, v: unknown) => onChange({ ...value, [name]: v });
  const remove = (name: string) => {
    const next = { ...value };
    delete next[name];
    onChange(next);
  };
  return (
    <div className="form">
      {schema.fields.map((f) => {
        const p = `${path}.${f.name}`;
        const present = value[f.name] !== undefined;
        const fieldErrors = errors.filter((e) => matchesField(e.details, p));
        return (
          <div className={`field ${fieldErrors.length ? 'has-error' : ''}`} key={f.name}>
            <div className="field-head">
              <label>
                {label(f.name)}
                {f.required && <span className="req">*</span>}
              </label>
              {!f.required &&
                (present ? (
                  <button type="button" className="link" onClick={() => remove(f.name)}>
                    remove
                  </button>
                ) : (
                  <button type="button" className="link" onClick={() => set(f.name, emptyValue(f, p))}>
                    add
                  </button>
                ))}
            </div>
            {present && (
              <FieldInput field={f} value={value[f.name]} path={p} onChange={(v) => set(f.name, v)} errors={errors} />
            )}
            {fieldErrors.map((e, i) => (
              <div className="error" key={i}>
                {e.details?.split(': ').slice(-1)[0] ?? e.message}
              </div>
            ))}
          </div>
        );
      })}
    </div>
  );
}

function FieldInput({
  field,
  value,
  path,
  onChange,
  errors,
}: {
  field: Field;
  value: unknown;
  path: string;
  onChange: (v: unknown) => void;
  errors: ApiError[];
}) {
  switch (field.type) {
    case 'TextComponent': {
      const v = value as { value: string };
      return (
        <input
          value={v.value}
          onChange={(e) => onChange({ ...v, value: e.target.value })}
          placeholder={label(field.name)}
        />
      );
    }
    case 'ParagraphComponent': {
      const v = value as { textList: { value: string }[] };
      return (
        <textarea
          rows={3}
          value={v.textList.map((t) => t.value).join('\n')}
          placeholder="One paragraph per line (max 5 items, 500 characters total)"
          onChange={(e) => onChange({ textList: e.target.value.split('\n').map((line) => ({ value: line })) })}
        />
      );
    }
    case 'ImageComponent':
      return <ImageInput value={value as ImageValue} path={path} onChange={onChange} />;
    case 'VideoComponent':
      return <VideoInput value={value as VideoValue} onChange={onChange} />;
    case 'Asin': {
      const v = value as { value: string };
      return (
        <input
          value={v.value}
          maxLength={10}
          placeholder="B0XXXXXXXX"
          onChange={(e) => onChange({ value: e.target.value.toUpperCase() })}
        />
      );
    }
    case 'integer':
      return (
        <input
          type="number"
          value={value as number}
          min={field.minimum}
          max={field.maximum}
          onChange={(e) => onChange(Number(e.target.value))}
        />
      );
    case 'boolean':
      return <input type="checkbox" checked={Boolean(value)} onChange={(e) => onChange(e.target.checked)} />;
    case 'string':
      return <input value={value as string} onChange={(e) => onChange(e.target.value)} />;
    case 'array':
      return <ArrayInput field={field} value={value as unknown[]} path={path} onChange={onChange} errors={errors} />;
    default:
      if (field.enum)
        return (
          <select value={value as string} onChange={(e) => onChange(e.target.value)}>
            {field.enum.map((o) => (
              <option key={o}>{o}</option>
            ))}
          </select>
        );
      if (field.schema)
        return (
          <div className="nested">
            <ModuleForm
              schema={field.schema}
              value={value as Record<string, unknown>}
              path={path}
              onChange={onChange}
              errors={errors}
            />
          </div>
        );
      return <input value={String(value ?? '')} onChange={(e) => onChange(e.target.value)} />;
  }
}

function ArrayInput({
  field,
  value,
  path,
  onChange,
  errors,
}: {
  field: Field;
  value: unknown[];
  path: string;
  onChange: (v: unknown[]) => void;
  errors: ApiError[];
}) {
  const items = value ?? [];
  const canAdd = field.maxItems == null || items.length < field.maxItems;
  const canRemove = items.length > (field.minItems ?? 0);
  const add = () => onChange([...items, field.itemSchema ? emptyItem(field.itemSchema, path, items.length + 1) : '']);
  return (
    <div className="array">
      <div className="hint">
        {items.length} item{items.length === 1 ? '' : 's'}
        {field.minItems ? `, min ${field.minItems}` : ''}
        {field.maxItems ? `, max ${field.maxItems}` : ''}
      </div>
      {items.map((item, i) => (
        <div className="array-item" key={i}>
          <div className="array-item-head">
            <span>#{i + 1}</span>
            {canRemove && (
              <button type="button" className="link" onClick={() => onChange(items.filter((_, j) => j !== i))}>
                remove
              </button>
            )}
          </div>
          {field.itemSchema ? (
            <ModuleForm
              schema={field.itemSchema}
              value={item as Record<string, unknown>}
              path={`${path}[${i}]`}
              onChange={(v) => onChange(items.map((x, j) => (j === i ? v : x)))}
              errors={errors}
            />
          ) : (
            <input
              value={String(item)}
              onChange={(e) => onChange(items.map((x, j) => (j === i ? e.target.value : x)))}
            />
          )}
        </div>
      ))}
      {canAdd && (
        <button type="button" className="secondary" onClick={add}>
          Add {label(field.item ?? 'item')}
        </button>
      )}
    </div>
  );
}

function emptyItem(schema: Schema, path: string, position: number) {
  const out: Record<string, unknown> = {};
  for (const f of schema.fields) out[f.name] = f.name === 'position' ? position : emptyValue(f, `${path}.${f.name}`);
  // wrapper items ({ techSpec: {...} }) carry the position inside the wrapped object
  for (const f of schema.fields) {
    const inner = out[f.name];
    if (f.schema && inner && typeof inner === 'object' && f.schema.fields.some((x) => x.name === 'position'))
      (inner as Record<string, unknown>).position = position;
  }
  return out;
}

type ImageValue = {
  uploadDestinationId: string;
  altText?: string;
  imageCropSpecification: {
    size: { width: { value: number; units: string }; height: { value: number; units: string } };
    offset: { x: { value: number; units: string }; y: { value: number; units: string } };
  };
};
type Crop = { x: number; y: number; w: number; h: number };
const px = (value: number) => ({ value: Math.max(0, Math.round(value)), units: 'pixels' });
const cropOf = (v: ImageValue): Crop => ({
  x: v.imageCropSpecification.offset?.x?.value ?? 0,
  y: v.imageCropSpecification.offset?.y?.value ?? 0,
  w: v.imageCropSpecification.size.width.value,
  h: v.imageCropSpecification.size.height.value,
});
const withCrop = (v: ImageValue, c: Crop): ImageValue => ({
  ...v,
  imageCropSpecification: { size: { width: px(c.w), height: px(c.h) }, offset: { x: px(c.x), y: px(c.y) } },
});
/** Largest window at the module's aspect ratio that fits the source image, centred; never smaller than the
 *  module minimum (a source below the minimum keeps the minimum so the service reports the problem). */
function fitCrop(natural: { w: number; h: number }, minW: number, minH: number): Crop {
  const ratio = minW / minH;
  let w = natural.w,
    h = Math.round(w / ratio);
  if (h > natural.h) {
    h = natural.h;
    w = Math.round(h * ratio);
  }
  w = Math.max(w, minW);
  h = Math.max(h, minH);
  return { x: Math.max(0, Math.round((natural.w - w) / 2)), y: Math.max(0, Math.round((natural.h - h) / 2)), w, h };
}
const clampCrop = (c: Crop, natural: { w: number; h: number } | null): Crop => {
  if (!natural) return c;
  const w = Math.min(c.w, natural.w),
    h = Math.min(c.h, natural.h);
  return { w, h, x: Math.min(Math.max(0, c.x), natural.w - w), y: Math.min(Math.max(0, c.y), natural.h - h) };
};

/** One ImageComponent: the file (uploaded through the Uploads API), its alt text and the crop. The crop is the
 *  window of the source image the module shows, in source pixels (`imageCropSpecification` size + offset): a new
 *  upload gets the largest centred window at the module's aspect ratio, the thumbnail shows that window and can be
 *  dragged to reposition it, and the numbers can be edited directly. The detail-page preview renders the same window. */
function ImageInput({ value, path, onChange }: { value: ImageValue; path: string; onChange: (v: ImageValue) => void }) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [natural, setNatural] = useState<{ url: string; w: number; h: number } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const drag = useRef<{ x: number; y: number; crop: Crop; scale: number; moved: boolean } | null>(null);
  const images = useImages();
  const [minW, minH] = imageSizeFor(path);
  const crop = cropOf(value);
  const preview = images.urlFor(value.uploadDestinationId);
  const nat = natural && natural.url === preview ? natural : null;
  const setCrop = (c: Crop) => onChange(withCrop(value, clampCrop(c, nat)));

  const pick = async (file: File | undefined) => {
    if (!file) return;
    setBusy(true);
    setErr(null);
    try {
      const r = await api.upload(file);
      const id = r.payload.uploadDestinationId;
      images.remember(id, file);
      // frame the new file for this module right away; the user can still move or resize the window
      const dims = await new Promise<{ w: number; h: number } | null>((resolve) => {
        const img = new Image();
        const probe = URL.createObjectURL(file);
        img.onload = () => {
          URL.revokeObjectURL(probe);
          resolve({ w: img.naturalWidth, h: img.naturalHeight });
        };
        img.onerror = () => {
          URL.revokeObjectURL(probe);
          resolve(null);
        };
        img.src = probe;
      });
      onChange(withCrop({ ...value, uploadDestinationId: id }, dims ? fitCrop(dims, minW, minH) : crop));
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  // thumbnail geometry: the crop window cover-fitted into the 120x80 thumb, whole image positioned behind it
  const THUMB = { w: 120, h: 80 };
  const scale = Math.max(THUMB.w / crop.w, THUMB.h / crop.h);
  const cropInside = nat ? crop.x >= 0 && crop.y >= 0 && crop.x + crop.w <= nat.w && crop.y + crop.h <= nat.h : false;
  const movable = nat ? cropInside && (crop.w < nat.w || crop.h < nat.h) : false;
  // a press that moves less than this many pixels is a click (opens the picker); more is a crop drag
  const CLICK_SLOP = 4;
  const onPointerDown = (e: ReactPointerEvent) => {
    if (!movable) return;
    e.preventDefault();
    e.currentTarget.setPointerCapture(e.pointerId);
    drag.current = { x: e.clientX, y: e.clientY, crop, scale, moved: false };
  };
  const onPointerMove = (e: ReactPointerEvent) => {
    if (!drag.current) return;
    const d = drag.current;
    if (!d.moved && Math.hypot(e.clientX - d.x, e.clientY - d.y) < CLICK_SLOP) return;
    d.moved = true;
    setCrop({ ...d.crop, x: d.crop.x - (e.clientX - d.x) / d.scale, y: d.crop.y - (e.clientY - d.y) / d.scale });
  };
  const endDrag = () => {
    drag.current = null;
  };
  const onPointerUp = () => {
    const wasClick = drag.current && !drag.current.moved;
    endDrag();
    if (wasClick) fileRef.current?.click();
  };
  const num = (key: keyof Crop, aria: string) => (
    <input
      type="number"
      min={0}
      value={crop[key]}
      aria-label={aria}
      onChange={(e) => setCrop({ ...crop, [key]: Number(e.target.value) })}
    />
  );

  return (
    <div className="image-input">
      <div
        className={`image-thumb ${movable ? 'movable' : ''}`}
        onClick={() => {
          if (!movable) fileRef.current?.click();
        }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={endDrag}
        title={movable ? 'Click to replace the image · drag to reposition the crop' : 'Choose an image'}
      >
        {preview ? (
          nat && cropInside ? (
            <img
              src={preview}
              alt={value.altText ?? ''}
              draggable={false}
              style={{
                position: 'absolute',
                width: nat.w * scale,
                height: nat.h * scale,
                left: -crop.x * scale + (THUMB.w - crop.w * scale) / 2,
                top: -crop.y * scale + (THUMB.h - crop.h * scale) / 2,
                maxWidth: 'none',
              }}
            />
          ) : (
            <img
              src={preview}
              alt={value.altText ?? ''}
              draggable={false}
              onLoad={(e) => {
                const img = e.currentTarget;
                if (img.naturalWidth) setNatural({ url: preview, w: img.naturalWidth, h: img.naturalHeight });
              }}
            />
          )
        ) : (
          <span>{busy ? 'Uploading…' : `Upload (${minW} × ${minH})`}</span>
        )}
      </div>
      <div className="image-fields">
        <input
          ref={fileRef}
          type="file"
          accept="image/jpeg,image/png"
          hidden
          onChange={(e) => pick(e.target.files?.[0])}
        />
        <input
          value={value.uploadDestinationId}
          placeholder="uploadDestinationId (from the Uploads API)"
          onChange={(e) => onChange({ ...value, uploadDestinationId: e.target.value })}
        />
        <input
          value={value.altText ?? ''}
          placeholder="Alt text"
          onChange={(e) => onChange({ ...value, altText: e.target.value })}
        />
        <div className="crop">
          <span>crop</span>
          {num('w', 'Crop width')} × {num('h', 'Crop height')}
          <span>at</span>
          {num('x', 'Crop offset x')}, {num('y', 'Crop offset y')}
          {nat && (
            <button
              type="button"
              className="link small"
              onClick={() => setCrop(fitCrop(nat, minW, minH))}
              title={`Largest ${minW}:${minH} window, centred`}
            >
              Fit
            </button>
          )}
          {preview && (
            <button
              type="button"
              className="link small"
              onClick={() => fileRef.current?.click()}
              title="Choose another image file"
            >
              Replace
            </button>
          )}
        </div>
        <div className="hint crop-hint">
          px on the source{nat ? ` (${nat.w} × ${nat.h})` : ''} · module minimum {minW} × {minH}
          {nat && !cropInside
            ? ' · the crop runs outside the image'
            : movable
              ? ' · drag the thumbnail to reposition, click it to replace'
              : ''}
        </div>
        {err && <div className="error">{err}</div>}
      </div>
    </div>
  );
}

type VideoValue = { videoMediaId: string; imageMediaId: string };

/** Grab a poster frame from a local video file (first second, JPEG) so the video can be paired with a thumbnail
 *  the way the Media API requires (VIDEO_PAIRING). */
function posterFrame(file: File): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const video = document.createElement('video');
    video.muted = true;
    video.preload = 'auto';
    video.onloadeddata = () => {
      video.currentTime = Math.min(1, video.duration / 2);
    };
    video.onseeked = () => {
      const canvas = document.createElement('canvas');
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      canvas.getContext('2d')?.drawImage(video, 0, 0);
      URL.revokeObjectURL(url);
      canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('could not capture a poster frame'))), 'image/jpeg', 0.9);
    };
    video.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('the browser could not decode this video (use an MP4/H.264 file)'));
    };
    video.src = url;
  });
}

/** One VideoComponent: upload an MP4 (mock mode registers it and a captured poster frame through the Media API
 *  stand-in and fills both ids), or paste the ids of media created with the real Media API. */
function VideoInput({ value, onChange }: { value: VideoValue; onChange: (v: VideoValue) => void }) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const pick = async (file: File | undefined) => {
    if (!file) return;
    setBusy(true);
    setErr(null);
    try {
      const thumbnail = await posterFrame(file);
      const media = await api.createMedia(file, thumbnail);
      onChange({ ...value, videoMediaId: media.mediaId, imageMediaId: media.relatedMedia[0]?.media.mediaId ?? '' });
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  };
  return (
    <div className="video-input">
      <div className="hint">
        Upload an MP4 (the poster frame is captured for you, both become a VIDEO_PAIRING through createMedia), or paste
        the ids of media you created with the Media API.
      </div>
      <input ref={fileRef} type="file" accept="video/mp4" hidden onChange={(e) => pick(e.target.files?.[0])} />
      <button type="button" className="secondary small" disabled={busy} onClick={() => fileRef.current?.click()}>
        {busy ? 'Uploading…' : value.videoMediaId ? 'Replace video…' : 'Upload video…'}
      </button>
      <input
        value={value.videoMediaId}
        placeholder="videoMediaId"
        onChange={(e) => onChange({ ...value, videoMediaId: e.target.value })}
      />
      <input
        value={value.imageMediaId}
        placeholder="imageMediaId (paired thumbnail)"
        onChange={(e) => onChange({ ...value, imageMediaId: e.target.value })}
      />
      {err && <div className="error">{err}</div>}
    </div>
  );
}
