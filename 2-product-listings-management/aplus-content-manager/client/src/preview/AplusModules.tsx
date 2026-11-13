// The A+ slot ("Product description" on a seller's page, "From the manufacturer" on a vendor's): renders
// each A+ module with the DOM structure and class names amazon.com
// uses for that module on the desktop detail page (see aplus.css for the source
// list), so the preview matches the real rendering. Standard modules are the 970px `aplus-standard`
// set, Premium modules the 1464px `aplus-premium` set. Where a Premium module type has no public
// counterpart yet (it is new with this release) the layout follows the module's specification
// and is marked with a `dp-approx` class.
import { useEffect, useState, type ReactNode } from 'react';
import type { ContentModule, ImageComponent, ParagraphComponent, TextComponent } from '../api';
import { modulesByType, moduleLabel } from '../catalog';
import { useImages } from '../images';

// Module payloads are heterogeneous: one shape per module type (39 of them), each field a TextComponent,
// ParagraphComponent, ImageComponent, a nested block or a list of blocks. The renderers read them loosely and
// the editor validates them against the OpenAPI model upstream, so a loose record is the honest type here.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Rec = Record<string, any>;
const text = (c?: TextComponent) => c?.value?.trim() || '';
const paras = (c?: ParagraphComponent) => (c?.textList ?? []).map((t) => t.value?.trim()).filter(Boolean) as string[];
const sorted = <T extends Rec>(list: T[] | undefined, key?: string) =>
  [...(list ?? [])].sort(
    (a, b) => ((key ? a[key]?.position : a.position) ?? 0) - ((key ? b[key]?.position : b.position) ?? 0),
  );

/** Image from the Uploads API (object URL / mock route) or a striped placeholder with the expected size.
 *  The `imageCropSpecification` is what the shopper sees, so the preview shows exactly that window of the source
 *  image: the crop (size + offset in source pixels) is cut out on a canvas and the `img` gets the cropped bitmap as
 *  its source, which keeps the element itself where amazon.com's stylesheet expects it. Until the crop is ready (or
 *  when it cannot be applied: image not loadable, crop outside the image) the whole image shows cover-fitted. */
export function AImg({
  c,
  className,
  w,
  h,
  alt,
  cover,
}: {
  c?: ImageComponent;
  className?: string;
  w?: number;
  h?: number;
  alt?: string;
  cover?: boolean;
}) {
  const images = useImages();
  const [broken, setBroken] = useState<string | null>(null);
  const size = c?.imageCropSpecification?.size;
  const url = c?.uploadDestinationId
    ? images.urlFor(c.uploadDestinationId, size ? { w: size.width.value, h: size.height.value } : undefined)
    : null;
  const src = useCroppedSrc(url, c?.imageCropSpecification);
  const style = {
    width: w ? `${w}px` : undefined,
    height: h ? `${h}px` : undefined,
    objectFit: cover ? ('cover' as const) : undefined,
  };
  if (url && broken !== url)
    return (
      <img className={className} src={src} alt={alt ?? c?.altText ?? ''} style={style} onError={() => setBroken(url)} />
    );
  const label = c?.uploadDestinationId ? 'image uploaded' : 'image';
  const dims = w && h ? `${w} × ${h}` : size ? `${size.width.value} × ${size.height.value}` : '';
  return (
    <span className={`dp-img-ph ${className ?? ''}`} style={{ ...style, display: 'flex' }}>
      {label}
      {dims ? (
        <>
          <br />
          {dims}
        </>
      ) : null}
    </span>
  );
}

// ---- crop rendering --------------------------------------------------------------------------------------------
type CropSpec = ImageComponent['imageCropSpecification'] | undefined;
const cropKey = (url: string, s: CropSpec) =>
  `${url}|${s?.offset?.x?.value ?? 0},${s?.offset?.y?.value ?? 0},${s?.size?.width?.value},${s?.size?.height?.value}`;
/** cropped bitmaps by source url + crop, so a re-render or a second module with the same crop costs nothing */
const cropCache = new Map<string, Promise<string | null>>();
const CROP_CACHE_MAX = 60;

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`cannot load ${url}`));
    img.src = url;
  });
}

/** The crop window of the image at `url` as an object URL, or null when the whole image is the right answer
 *  (no crop, crop equal to the image, crop outside the image, or the image cannot be read). */
function croppedSrc(url: string, spec: CropSpec): Promise<string | null> {
  const key = cropKey(url, spec);
  const hit = cropCache.get(key);
  if (hit) return hit;
  const p = (async () => {
    if (!spec) return null;
    const cw = Number(spec.size?.width?.value),
      ch = Number(spec.size?.height?.value),
      ox = Number(spec.offset?.x?.value ?? 0),
      oy = Number(spec.offset?.y?.value ?? 0);
    if (!(cw > 0 && ch > 0) || ox < 0 || oy < 0) return null;
    let img: HTMLImageElement;
    try {
      img = await loadImage(url);
    } catch {
      return null;
    }
    if (ox + cw > img.naturalWidth || oy + ch > img.naturalHeight) return null;
    if (ox === 0 && oy === 0 && cw === img.naturalWidth && ch === img.naturalHeight) return null;
    const canvas = document.createElement('canvas');
    canvas.width = cw;
    canvas.height = ch;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;
    try {
      ctx.drawImage(img, ox, oy, cw, ch, 0, 0, cw, ch);
    } catch {
      return null; // cross-origin image: the canvas is tainted, show it uncropped
    }
    // small crops (logos, icons) keep transparency; photo-sized crops go to JPEG to stay light
    const type = cw * ch < 400_000 ? 'image/png' : 'image/jpeg';
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, type, 0.92));
    return blob ? URL.createObjectURL(blob) : null;
  })();
  cropCache.set(key, p);
  if (cropCache.size > CROP_CACHE_MAX) {
    const oldest = cropCache.keys().next().value as string;
    cropCache.get(oldest)?.then((u) => u && URL.revokeObjectURL(u));
    cropCache.delete(oldest);
  }
  return p;
}

/** `url` until the cropped bitmap is ready, then the cropped bitmap; `url` again when there is nothing to crop. */
function useCroppedSrc(url: string | null, spec: CropSpec): string | undefined {
  const key = url ? cropKey(url, spec) : '';
  const [state, setState] = useState<{ key: string; src: string | null }>({ key: '', src: null });
  useEffect(() => {
    if (!url) return;
    let cancelled = false;
    croppedSrc(url, spec).then((src) => {
      if (!cancelled) setState({ key, src });
    });
    return () => {
      cancelled = true;
    };
    // the key already encodes everything of `spec` that matters
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [url, key]);
  if (!url) return undefined;
  return state.key === key && state.src ? state.src : url;
}

const P = ({ c, className, small }: { c?: ParagraphComponent; className?: string; small?: boolean }) => (
  <>
    {paras(c).map((t, i) => (
      <p key={i} className={className ?? (small ? 'a-spacing-small a-size-small a-color-secondary' : 'a-spacing-base')}>
        {t}
      </p>
    ))}
  </>
);

const Bullets = ({ items }: { items?: { text?: TextComponent; position?: number }[] }) => {
  const list = sorted(items)
    .map((t) => text(t.text))
    .filter(Boolean);
  return list.length ? (
    <ul className="a-unordered-list a-vertical">
      {list.map((t, i) => (
        <li key={i}>
          <span className="a-list-item">
            <span className="a-size-base">{t}</span>
          </span>
        </li>
      ))}
    </ul>
  ) : null;
};

/* ------------------------------------------------------------------ Standard (970px) */
function Standard({
  id,
  cls,
  children,
  wrapper = 'apm-fixed-width',
}: {
  id: string;
  cls: string;
  children: ReactNode;
  wrapper?: string;
}) {
  return (
    <div className={`celwidget aplus-module ${id} aplus-standard ${cls}`}>
      <div className={`aplus-module-wrapper ${wrapper}`}>{children}</div>
      <div style={{ clear: 'both' }} />
    </div>
  );
}

const ImageTextBlock = ({ b, w, h, center }: { b?: Rec; w: number; h: number; center?: boolean }) => (
  <>
    <p className={center ? 'apm-text-center' : ''}>
      <AImg c={b?.image} className="a-spacing-mini" w={w} h={h} cover />
    </p>
    {text(b?.headline) && <h4 className="a-spacing-mini">{text(b?.headline)}</h4>}
    <P c={b?.body} className="" />
  </>
);

function StandardModule({ type, m }: { type: string; m: Rec }) {
  switch (type) {
    case 'STANDARD_TEXT':
      return (
        <Standard id="module-7" cls="dp-standard-text">
          <div className="apm-spacing aplus-module-content">
            {text(m.headline) && <h3 className="a-spacing-small">{text(m.headline)}</h3>}
            <P c={m.body} />
          </div>
        </Standard>
      );
    case 'STANDARD_PRODUCT_DESCRIPTION':
      return (
        <Standard id="module-7" cls="dp-standard-description">
          <div className="apm-spacing aplus-module-content">
            <P c={m.body} />
          </div>
        </Standard>
      );
    case 'STANDARD_COMPANY_LOGO':
      return (
        <Standard id="module-8" cls="">
          <div className="apm-spacing aplus-module-content apm-text-center">
            <AImg c={m.companyLogo} w={600} h={180} />
          </div>
        </Standard>
      );
    case 'STANDARD_HEADER_IMAGE_TEXT':
      return (
        <Standard id="3p-module-b" cls="" wrapper="aplus-3p-fixed-width">
          {text(m.headline) && <h3 className="a-spacing-small">{text(m.headline)}</h3>}
          <AImg c={m.block?.image} className="a-spacing-base" w={970} h={600} cover />
          {text(m.block?.headline) && <h4 className="a-spacing-mini">{text(m.block?.headline)}</h4>}
          <P c={m.block?.body} />
        </Standard>
      );
    case 'STANDARD_SINGLE_SIDE_IMAGE': {
      const right = m.imagePositionType === 'RIGHT';
      return (
        <Standard id={right ? 'module-3' : 'module-2'} cls="" wrapper="apm-spacing apm-floatnone apm-fixed-width">
          <div className="apm-sidemodule aplus-module-content">
            <div className={right ? 'apm-sidemodule-imageright' : 'apm-sidemodule-imageleft'}>
              <AImg c={m.block?.image} w={300} h={300} cover />
            </div>
            <div className={right ? 'apm-sidemodule-textleft' : 'apm-sidemodule-textright'}>
              {text(m.block?.headline) && <h3 className="a-spacing-mini">{text(m.block?.headline)}</h3>}
              <P c={m.block?.body} />
            </div>
          </div>
        </Standard>
      );
    }
    case 'STANDARD_IMAGE_TEXT_OVERLAY': {
      const dark = m.overlayColorType !== 'LIGHT';
      return (
        <Standard id={dark ? 'module-11' : 'module-12'} cls="" wrapper="apm-spacing apm-floatnone apm-fixed-width">
          <div className="apm-sidemodule aplus-module-content">
            <div className="apm-hero-image">
              <AImg c={m.block?.image} w={970} h={300} cover />
            </div>
            {(text(m.block?.headline) || paras(m.block?.body).length > 0) && (
              <div className={`apm-hero-text ${dark ? 'apm-heromodule-textright' : 'textright'}`}>
                {text(m.block?.headline) && <h3 className="a-spacing-mini">{text(m.block?.headline)}</h3>}
                <P c={m.block?.body} className="" />
              </div>
            )}
          </div>
        </Standard>
      );
    }
    case 'STANDARD_THREE_IMAGE_TEXT':
      return (
        <Standard id="module-9" cls="" wrapper="apm-fixed-width apm-spacing">
          {text(m.headline) && <h3 className="a-spacing-small">{text(m.headline)}</h3>}
          <div className="apm-flex">
            {[m.block1, m.block2, m.block3].map((b, i) => (
              <div className="apm-flex-item-third-width" key={i}>
                <ImageTextBlock b={b} w={300} h={300} center />
              </div>
            ))}
          </div>
        </Standard>
      );
    case 'STANDARD_FOUR_IMAGE_TEXT':
      return (
        <Standard id="module-4" cls="" wrapper="apm-fixed-width apm-spacing">
          {text(m.headline) && <h3 className="a-spacing-small">{text(m.headline)}</h3>}
          <div className="apm-flex">
            {[m.block1, m.block2, m.block3, m.block4].map((b, i) => (
              <div className="apm-flex-item-fourth-width" key={i}>
                <ImageTextBlock b={b} w={220} h={220} center />
              </div>
            ))}
          </div>
        </Standard>
      );
    case 'STANDARD_FOUR_IMAGE_TEXT_QUADRANT':
      return (
        <Standard id="module-10" cls="" wrapper="apm-fixed-width apm-spacing">
          {[
            [m.block1, m.block2],
            [m.block3, m.block4],
          ].map((row, r) => (
            <div className="apm-row" key={r}>
              {row.map((b, i) => (
                <div className={i === 0 ? 'apm-lefthalfcol' : 'apm-righthalfcol'} key={i}>
                  <div className="apm-flex" style={{ gap: 20 }}>
                    <div>
                      <AImg c={b?.image} className="a-spacing-mini" w={135} h={135} cover />
                    </div>
                    <div>
                      {text(b?.headline) && <h4 className="a-spacing-mini">{text(b?.headline)}</h4>}
                      <P c={b?.body} className="" />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ))}
        </Standard>
      );
    case 'STANDARD_MULTIPLE_IMAGE_TEXT':
      return <MultipleImageText blocks={(m.blocks ?? []) as Rec[]} />;
    case 'STANDARD_IMAGE_SIDEBAR':
      return (
        <Standard id="module-1" cls="">
          {text(m.headline) && <h3 className="a-spacing-small">{text(m.headline)}</h3>}
          <div className="apm-spacing apm-wrap">
            <div className="apm-floatleft apm-wrap">
              <div className="apm-leftimage">
                <AImg c={m.imageCaptionBlock?.image} className="a-spacing-mini" w={300} h={400} cover />
                <br />
                {text(m.imageCaptionBlock?.caption) && (
                  <p className="a-size-small a-color-secondary">{text(m.imageCaptionBlock?.caption)}</p>
                )}
              </div>
              <div className="apm-rightthirdcol">
                <div className="apm-rightthirdcol-inner">
                  <AImg c={m.sidebarImageTextBlock?.image} className="a-spacing-mini" w={350} h={175} cover />
                  {text(m.sidebarImageTextBlock?.headline) && (
                    <h5 className="a-spacing-mini">{text(m.sidebarImageTextBlock?.headline)}</h5>
                  )}
                  <P c={m.sidebarImageTextBlock?.body} small />
                  <Bullets items={m.sidebarListBlock?.textList} />
                </div>
              </div>
              <div className="apm-centerthirdcol apm-wrap">
                {text(m.descriptionTextBlock?.headline) && (
                  <h3 className="a-spacing-mini">{text(m.descriptionTextBlock?.headline)}</h3>
                )}
                <P c={m.descriptionTextBlock?.body} />
                {(m.descriptionListBlock?.textList?.length ?? 0) > 0 && (
                  <div className="amp-centerthirdcol-listbox">
                    <div className="a-box a-spacing-small a-color-alternate-background apm-listbox amp-centerthirdcol-listbox">
                      <div className="a-box-inner">
                        <Bullets items={m.descriptionListBlock?.textList} />
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </Standard>
      );
    case 'STANDARD_SINGLE_IMAGE_HIGHLIGHTS':
      return (
        <Standard id="module-6" cls="">
          <div className="apm-spacing apm-wrap">
            <div className="apm-floatleft apm-wrap">
              <div className="apm-leftimage">
                <AImg c={m.image} className="a-spacing-mini" w={300} h={300} cover />
              </div>
              {!!(text(m.bulletedListBlock?.headline) || m.bulletedListBlock?.block?.textList?.length) && (
                <div className="apm-rightthirdcol">
                  <div className="apm-rightthirdcol-inner">
                    {text(m.bulletedListBlock?.headline) && (
                      <h5 className="a-spacing-mini">{text(m.bulletedListBlock?.headline)}</h5>
                    )}
                    <Bullets items={m.bulletedListBlock?.block?.textList} />
                  </div>
                </div>
              )}
              <div className="apm-centerthirdcol apm-wrap">
                {text(m.headline) && <h3 className="a-spacing-mini">{text(m.headline)}</h3>}
                {[m.textBlock1, m.textBlock2, m.textBlock3].map((b, i) =>
                  b && (text(b.headline) || paras(b.body).length) ? (
                    <div key={i}>
                      {text(b.headline) && <h5 className="a-spacing-mini">{text(b.headline)}</h5>}
                      <P c={b.body} />
                    </div>
                  ) : null,
                )}
              </div>
            </div>
          </div>
        </Standard>
      );
    case 'STANDARD_SINGLE_IMAGE_SPECS_DETAIL':
      return (
        <Standard id="module-1" cls="">
          {text(m.headline) && <h3 className="a-spacing-small">{text(m.headline)}</h3>}
          <div className="apm-spacing apm-wrap">
            <div className="apm-floatleft apm-wrap">
              <div className="apm-leftimage">
                <AImg c={m.image} className="a-spacing-mini" w={300} h={300} cover />
              </div>
              <div className="apm-rightthirdcol">
                <div className="apm-rightthirdcol-inner">
                  {text(m.specificationHeadline) && <h5 className="a-spacing-mini">{text(m.specificationHeadline)}</h5>}
                  {text(m.specificationListBlock?.headline) && (
                    <p className="a-spacing-mini a-size-small">{text(m.specificationListBlock?.headline)}</p>
                  )}
                  <Bullets items={m.specificationListBlock?.block?.textList} />
                  {text(m.specificationTextBlock?.headline) && (
                    <h5 className="a-spacing-mini">{text(m.specificationTextBlock?.headline)}</h5>
                  )}
                  <P c={m.specificationTextBlock?.body} small />
                </div>
              </div>
              <div className="apm-centerthirdcol apm-wrap">
                {text(m.descriptionHeadline) && <h3 className="a-spacing-mini">{text(m.descriptionHeadline)}</h3>}
                {[m.descriptionBlock1, m.descriptionBlock2].map((b, i) =>
                  b ? (
                    <div key={i}>
                      {text(b.headline) && <h5 className="a-spacing-mini">{text(b.headline)}</h5>}
                      <P c={b.body} />
                    </div>
                  ) : null,
                )}
              </div>
            </div>
          </div>
        </Standard>
      );
    case 'STANDARD_TECH_SPECS': {
      const specs = (m.specificationList ?? []) as Rec[];
      const tables = Math.min(Math.max(Number(m.tableCount) || 1, 1), 2);
      const per = Math.ceil(specs.length / tables);
      return (
        <Standard id="module-13" cls="" wrapper="apm-fixed-width">
          <div className="aplus-module-13">
            {text(m.headline) && <h3 className="aplus-13-heading-text a-spacing-small">{text(m.headline)}</h3>}
            <div className="apm-flex" style={{ gap: 20 }}>
              {Array.from({ length: tables }, (_, t) => (
                <table className="a-bordered a-horizontal-stripes aplus-tech-spec-table" key={t}>
                  <tbody>
                    {specs.slice(t * per, (t + 1) * per).map((s, i) => (
                      <tr key={i}>
                        <td className="a-text-bold">
                          <span>{text(s.label)}</span>
                        </td>
                        <td>
                          <span>{text(s.description)}</span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ))}
            </div>
          </div>
        </Standard>
      );
    }
    case 'STANDARD_COMPARISON_TABLE': {
      const cols = sorted(m.productColumns as Rec[]);
      const labels = sorted(m.metricRowLabels as Rec[]);
      return (
        <Standard id="module-5" cls="">
          <div className="apm-spacing aplus-module-content">
            <div className="apm-tablemodule">
              <table className="apm-tablemodule-table">
                <tbody>
                  <tr className="apm-tablemodule-imagerows">
                    <td className="apm-tablemodule-blankkeyhead" />
                    {cols.map((c, i) => (
                      <th key={i} className={c.highlight ? 'selected' : ''}>
                        <div className="apm-tablemodule-image">
                          <AImg c={c.image} w={122} h={122} cover />
                        </div>
                        <div>{c.title}</div>
                      </th>
                    ))}
                  </tr>
                  {labels.map((l, r) => (
                    <tr className="apm-tablemodule-keyvalue" key={r}>
                      <th className="apm-tablemodule-keyhead">{l.value}</th>
                      {cols.map((c, i) => {
                        const v = sorted(c.metrics as Rec[]).find((x) => x.position === l.position)?.value;
                        return (
                          <td key={i} className={`apm-tablemodule-valuecell ${c.highlight ? 'selected' : ''}`}>
                            <span>{v === '✓' || v === 'true' ? <span className="apm-checked">✓</span> : v}</span>
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </Standard>
      );
    }
    default:
      return null;
  }
}

/* ------------------------------------------------------------------ Premium (1464px) */
function MultipleImageText({ blocks }: { blocks: Rec[] }) {
  const [i, setI] = useState(0);
  const cur = blocks[i]?.block ?? {};
  return (
    <Standard id="module-6" cls="apm-hovermodule" wrapper="apm-fixed-width apm-spacing">
      <div className="apm-flex" style={{ gap: 30 }}>
        <div className="apm-eventhirdcol">
          <div className="apm-hovermodule-slides" style={{ marginBottom: 6 }}>
            <AImg c={cur.image} w={300} h={300} cover />
          </div>
          <div className="apm-flex" style={{ gap: 6 }}>
            {blocks.map((b, j) => (
              <button
                type="button"
                key={j}
                className="dp-thumb"
                style={{
                  width: 66,
                  height: 66,
                  padding: 0,
                  border: j === i ? '2px solid #e77600' : '1px solid #ddd',
                  background: '#fff',
                }}
                onClick={() => setI(j)}
              >
                <AImg c={b.block?.image} w={62} h={62} cover />
              </button>
            ))}
          </div>
          {text(blocks[i]?.caption) && (
            <p className="a-spacing-mini a-size-small a-color-secondary apm-text-center">{text(blocks[i]?.caption)}</p>
          )}
        </div>
        <div style={{ flex: 1 }}>
          {text(cur.headline) && <h3 className="a-spacing-mini">{text(cur.headline)}</h3>}
          <P c={cur.body} />
        </div>
      </div>
    </Standard>
  );
}

function Premium({
  id,
  mod,
  cls = '',
  children,
  approx,
}: {
  id: string;
  mod: string;
  cls?: string;
  children: ReactNode;
  approx?: boolean;
}) {
  return (
    <div className={`celwidget aplus-module ${id} aplus-premium ${approx ? 'dp-approx' : ''}`}>
      <div className={`a-section a-spacing-none premium-aplus ${mod} ${cls}`}>{children}</div>
    </div>
  );
}
const S = ({ cls, children }: { cls: string; children?: ReactNode }) => (
  <div className={`a-section a-spacing-none ${cls}`}>{children}</div>
);
const PremiumP = ({ c, cls }: { c?: ParagraphComponent; cls: string }) => (
  <>
    {paras(c).map((t, i) => (
      <p key={i} className={cls}>
        {t}
      </p>
    ))}
  </>
);

/** Video player: in mock mode the clip plays (fixture or uploaded media) with the Media API thumbnail as poster;
 *  where no clip is served (live media is only viewable on the published page, unknown ids) the poster frame
 *  with the VSE-style play button stands in, or a dark box when even the poster is unavailable. */
function VideoBox({ id, posterId, title }: { id?: string; posterId?: string; title?: string }) {
  const images = useImages();
  const poster = images.posterFor(posterId || id || '');
  const url = images.videoFor(id || '');
  const [failed, setFailed] = useState<string | null>(null);
  const src = url && url !== failed ? url : null;
  return (
    <div className={`dp-video ${poster ? 'has-poster' : ''} ${src ? 'playable' : ''}`}>
      {src ? (
        <video
          key={src}
          className="dp-video-poster"
          src={src}
          poster={poster ?? undefined}
          controls
          preload="metadata"
          onError={() => setFailed(src)}
        />
      ) : (
        <>
          {poster && <img className="dp-video-poster" src={poster} alt="" />}
          <div className="dp-video-play" />
        </>
      )}
      {title && <span className="aplus-p2">{title}</span>}
      {!poster && !src && <small>{id ? `mediaId ${id}` : 'video media ID pending'}</small>}
    </div>
  );
}

function PremiumModule({ type, m }: { type: string; m: Rec }) {
  switch (type) {
    case 'PREMIUM_TEXT':
      return (
        <Premium id="premium-module-1-text" mod="premium-aplus-module-1" cls="aplus-container-1">
          {text(m.headline) && <h1 className="a-text-center aplus-heading aplus-h1 a-text-bold">{text(m.headline)}</h1>}
          <S cls="a-text-center">
            <PremiumP c={m.description} cls="aplus-description aplus-p1" />
          </S>
        </Premium>
      );
    case 'PREMIUM_FULL_BACKGROUND_IMAGE':
      return (
        <Premium id="premium-module-2-fullbackground-image" mod="premium-aplus-module-2">
          {text(m.headline) && (
            <h1 className="a-text-center aplus-container-3 aplus-h1 a-text-bold">{text(m.headline)}</h1>
          )}
          <S cls="premium-background-wrapper">
            <S cls="background-image">
              <AImg c={m.desktopImage} cover />
            </S>
          </S>
          {paras(m.footer).length > 0 && (
            <S cls="a-text-center">
              <PremiumP c={m.footer} cls="aplus-description aplus-container-3 aplus-p1" />
            </S>
          )}
        </Premium>
      );
    case 'PREMIUM_FULL_BACKGROUND_TEXT':
    case 'PREMIUM_IMAGE_TEXT': {
      // Both are the 1464x600 background with a half-width text panel; FULL_BACKGROUND_TEXT adds the DARK/LIGHT choice.
      const right = m.positionType === 'RIGHT';
      const dark = type === 'PREMIUM_IMAGE_TEXT' ? true : m.colorType !== 'LIGHT';
      const body: ParagraphComponent | undefined = m.description ?? m.bodyText;
      return (
        <Premium
          id="premium-module-2-fullbackground-text"
          mod="premium-aplus-module-2"
          approx={type === 'PREMIUM_IMAGE_TEXT'}
        >
          <S cls="premium-background-wrapper">
            <S cls="background-image">
              <AImg c={m.desktopImage ?? m.image} cover />
            </S>
            <S cls={`premium-intro-wrapper ${right ? 'right' : 'left'} ${dark ? 'secondary-color' : ''}`}>
              <S cls="premium-intro-content-container">
                <S cls="premium-intro-content-column">
                  <S cls={`premium-intro-background ${dark ? 'black-background' : 'white-background'}`}>
                    {text(m.subheadline) && (
                      <h5 className="aplus-accent1 aplus-module-2-topic">{text(m.subheadline)}</h5>
                    )}
                    {text(m.headline) && (
                      <h1 className="aplus-h1 aplus-module-2-heading a-text-bold">{text(m.headline)}</h1>
                    )}
                    <S cls="premium-intro-paragraph">
                      <PremiumP c={body} cls="aplus-p2 aplus-module-2-description" />
                    </S>
                  </S>
                </S>
              </S>
            </S>
          </S>
        </Premium>
      );
    }
    case 'PREMIUM_FOUR_COLUMN_IMAGES':
    case 'PREMIUM_DUAL_IMAGE_TEXT': {
      const four = type === 'PREMIUM_FOUR_COLUMN_IMAGES';
      const cols = sorted(m.columns as Rec[], 'imageColumn').map((c) => c.imageColumn ?? {});
      return (
        <Premium
          id={four ? 'premium-module-3-four-column-images' : 'premium-module-4-two-column-images'}
          mod={four ? 'premium-aplus-module-3' : 'premium-aplus-module-4'}
          cls="aplus-container-1"
        >
          {text(m.headline) && (
            <h1
              className={`a-text-center aplus-h1 a-text-bold ${four ? 'premium-module-3-heading' : 'premium-module-4-heading'}`}
            >
              {text(m.headline)}
            </h1>
          )}
          <S cls={four ? 'premium-aplus-four-column' : 'premium-aplus-two-column'}>
            {cols.map((c, i) => (
              <div className="a-section a-spacing-none premium-aplus-column" key={i}>
                <S cls="column-image">
                  <AImg c={c.image} cover />
                </S>
                {text(c.headline) && (
                  <S cls="column-heading">
                    <h1 className="aplus-h3 a-text-bold">{text(c.headline)}</h1>
                  </S>
                )}
                <S cls="column-description">
                  <PremiumP c={c.description} cls="aplus-p3" />
                </S>
              </div>
            ))}
          </S>
        </Premium>
      );
    }
    case 'PREMIUM_THREE_COLUMN_COMPARISON': {
      const products = sorted(m.comparisonProducts as Rec[]);
      const rows = sorted(m.comparisonRows as Rec[]);
      return (
        <Premium id="premium-module-6-three-column-comparison" mod="premium-aplus-module-6" cls="aplus-container-1">
          <h3 className="a-text-center aplus-heading aplus-h1 a-text-bold">{text(m.headline)}</h3>
          <S cls="comparison-container">
            <table className="a-normal">
              <tbody>
                <tr className="comparison-heading-row">
                  {products.map((p, i) => (
                    <th className="a-align-bottom" key={i}>
                      <a className="a-link-normal aplus-link">
                        <S cls="a-text-center">
                          <AImg c={p.image} w={300} h={225} cover />
                        </S>
                        <S cls="a-text-center aplus-title">
                          <p className="a-text-center aplus-title aplus-p2 a-text-bold">{text(p.productTitle)}</p>
                        </S>
                      </a>
                    </th>
                  ))}
                </tr>
                {rows.map((r, ri) => (
                  <tr key={ri}>
                    {products.map((_, i) => {
                      const mv = (r.metricValues ?? [])[i] ?? {};
                      return (
                        <td className="comparison-column" key={i}>
                          <p className="aplus-p3 a-text-bold">{text(mv.metricName)}</p>
                          {paras(mv.metricValue).map((t, k) => (
                            <p className="aplus-p3" key={k}>
                              {t}
                            </p>
                          ))}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </S>
        </Premium>
      );
    }
    case 'PREMIUM_COMPARISON_SCROLLER':
    case 'PREMIUM_COMPARISON_CAROUSEL': {
      const products = sorted(m.comparisonProducts as Rec[], 'comparisonProduct').map((p) => p.comparisonProduct ?? {});
      const rows = sorted((m.comparisonRows ?? m.comparisonMetrics) as Rec[], 'comparisonRow').map(
        (r) => r.comparisonRow ?? {},
      );
      return (
        <Premium
          id="premium-module-5-comparison-table-scroller"
          mod="premium-aplus-module-5"
          cls="aplus-container-1"
          approx={type === 'PREMIUM_COMPARISON_CAROUSEL'}
        >
          <h1 className="a-text-center aplus-h1 a-text-bold">{text(m.headline)}</h1>
          <S cls="table-container">
            <div className="table-slider">
              <table className="a-bordered">
                <tbody>
                  <tr>
                    <td className="attribute" />
                    {products.map((p, i) => (
                      <th key={i}>
                        <div className="header-img">
                          <AImg c={p.desktopImage} w={150} h={150} cover />
                        </div>
                        <div className="product-title a-text-bold">{text(p.productTitle)}</div>
                        {m.showPrices && <div className="aplus-p3">$—.——</div>}
                        {m.showReviews && <div className="aplus-p3">★★★★☆</div>}
                        {m.showATC && (
                          <span className="dp-btn dp-btn-cart" style={{ display: 'inline-block', marginTop: 8 }}>
                            Add to Cart
                          </span>
                        )}
                      </th>
                    ))}
                  </tr>
                  {rows.map((r, ri) => (
                    <tr key={ri}>
                      <td className="attribute">
                        {text(r.metricName)}
                        {text(r.additionalInfo) && (
                          <span className="aplus-popover-trigger" title={text(r.additionalInfo)} />
                        )}
                      </td>
                      {products.map((_, i) => {
                        const f = (r.comparisonFields ?? [])[i]?.comparisonField;
                        return <td key={i}>{f?.value === 'true' ? '✓' : f?.value === 'false' ? '—' : f?.value}</td>;
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </S>
        </Premium>
      );
    }
    case 'PREMIUM_IMAGE_CAROUSEL':
    case 'PREMIUM_REGIMEN_CAROUSEL':
    case 'PREMIUM_VIDEO_IMAGE_CAROUSEL': {
      const wrapKey =
        type === 'PREMIUM_IMAGE_CAROUSEL'
          ? 'imagePanel'
          : type === 'PREMIUM_REGIMEN_CAROUSEL'
            ? 'regimenPanel'
            : 'videoCarouselPanel';
      const cards = sorted(m.carouselCards as Rec[], wrapKey).map((c) => c[wrapKey] ?? {});
      return (
        <Carousel13
          headline={text(m.headline)}
          footer={m.footer}
          cards={cards}
          approx={type !== 'PREMIUM_IMAGE_CAROUSEL'}
        />
      );
    }
    case 'PREMIUM_NAVIGATION_CAROUSEL': {
      const cards = sorted(m.carouselCards as Rec[], 'navigationPanel').map((c) => c.navigationPanel ?? {});
      return <NavCarousel12 cards={cards} />;
    }
    case 'PREMIUM_FAQ': {
      const faqs = (m.faqs ?? []).map((f: Rec) => f.faq ?? {});
      return <Faq11 dark={m.colorType === 'DARK'} faqs={faqs} />;
    }
    case 'PREMIUM_TECH_SPECS': {
      const specs = (m.techSpecs ?? []).map((s: Rec) => s.techSpec ?? {});
      const cols = Math.min(Math.max(Number(m.columnCount) || 2, 1), 2);
      const per = Math.ceil(specs.length / cols);
      return (
        <Premium id="premium-module-16-tech-specs" mod="premium-aplus-module-16" cls="aplus-container-3">
          <h3 className="a-size-extra-large a-spacing-base a-text-center">{text(m.headline)}</h3>
          <div className="a-row">
            {Array.from({ length: cols }, (_, t) => (
              <div className={`a-column a-span${12 / cols} ${t === cols - 1 ? 'a-span-last' : ''}`} key={t}>
                <table className="a-bordered a-horizontal-stripes aplus-tech-spec-table">
                  <tbody>
                    {specs.slice(t * per, (t + 1) * per).map((s: Rec, i: number) => (
                      <tr key={i}>
                        <td className="a-text-bold">
                          <span>{text(s.specKey)}</span>
                        </td>
                        <td>
                          <span>{text(s.specValue)}</span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ))}
          </div>
        </Premium>
      );
    }
    case 'PREMIUM_HERO_VIDEO':
      return (
        <Premium id="premium-module-8-hero-video" mod="premium-aplus-module-8">
          {text(m.headline) && (
            <h1 className="a-text-center aplus-container-3 aplus-h1 a-text-bold">{text(m.headline)}</h1>
          )}
          <S cls="premium-aplus-module-8-video">
            <S cls="video-placeholder" />
            <S cls="video-container">
              <VideoBox id={m.heroVideo?.videoMediaId} posterId={m.heroVideo?.imageMediaId} />
            </S>
          </S>
          {paras(m.footer).length > 0 && (
            <S cls="a-text-center">
              <PremiumP c={m.footer} cls="aplus-description aplus-container-3 aplus-p1" />
            </S>
          )}
        </Premium>
      );
    case 'PREMIUM_VIDEO_TEXT':
      return (
        <Premium id="premium-module-video-text" mod="premium-aplus-module-video-text" cls="aplus-container-1" approx>
          <div className={`aplus-video-text-row ${m.positionType === 'RIGHT' ? 'right' : ''}`}>
            <div className="aplus-video-col">
              <div style={{ aspectRatio: '16 / 9' }}>
                <VideoBox id={m.video?.videoMediaId} posterId={m.video?.imageMediaId} title={text(m.title)} />
              </div>
            </div>
            <div className="aplus-text-col">
              {text(m.headline) && (
                <h1 className="aplus-h2 a-text-bold" style={{ paddingBottom: 20 }}>
                  {text(m.headline)}
                </h1>
              )}
              <PremiumP c={m.description} cls="aplus-p2" />
            </div>
          </div>
        </Premium>
      );
    case 'PREMIUM_HOTSPOT_IMAGE':
    case 'PREMIUM_HOTSPOT_IMAGE_TEXT':
      return <Hotspot m={m} withText={type === 'PREMIUM_HOTSPOT_IMAGE_TEXT'} />;
    default:
      return null;
  }
}

function Carousel13({
  headline,
  footer,
  cards,
  approx,
}: {
  headline: string;
  footer?: ParagraphComponent;
  cards: Rec[];
  approx?: boolean;
}) {
  const [i, setI] = useState(0);
  const card = cards[i] ?? {};
  const hasText = text(card.title) || text(card.subheadline) || paras(card.description).length > 0;
  return (
    <Premium id="premium-module-13-carousel" mod="premium-aplus-module-13" approx={approx}>
      {headline && <h1 className="a-text-center aplus-container-3 aplus-h1 a-text-bold">{headline}</h1>}
      <S cls="aplus-carousel-container">
        <div
          className="a-carousel-container a-carousel-display-single"
          role="region"
          aria-label="Featured content carousel"
        >
          <div className="a-carousel-row-inner" style={{ position: 'relative' }}>
            {cards.length > 1 && (
              <a
                className="a-carousel-goto-prevpage dp-carousel-btn left"
                role="button"
                onClick={() => setI((i - 1 + cards.length) % cards.length)}
              >
                <i className="a-icon a-icon-previous-rounded" />
              </a>
            )}
            <div className="a-carousel-viewport">
              <ol className="a-carousel" role="list" style={{ listStyle: 'none', margin: 0, padding: 0 }}>
                <li className="a-carousel-card aplus-carousel-element">
                  <S cls="aplus-card-image">
                    {card.video?.videoMediaId ? (
                      <VideoBox id={card.video.videoMediaId} posterId={card.video.imageMediaId} />
                    ) : (
                      <AImg c={card.desktopImage} cover />
                    )}
                  </S>
                  {hasText && (
                    <div
                      className="aplus-card-description-wrapper"
                      style={card.positionType === 'RIGHT' ? { left: '50%' } : undefined}
                    >
                      <div className="aplus-card-description">
                        <div className="aplus-card-table-cell">
                          <div className="aplus-text-background">
                            {text(card.subheadline) && <h5 className="aplus-accent1">{text(card.subheadline)}</h5>}
                            {text(card.title) && <h1 className="aplus-h1 a-text-bold">{text(card.title)}</h1>}
                            <div className="aplus-card-body">
                              <PremiumP c={card.description} cls="aplus-p2" />
                            </div>
                            {text(card.buttonText) && (
                              <div className="aplus-card-link-button" style={{ textAlign: 'left' }}>
                                <span className="dp-btn dp-btn-outline">{text(card.buttonText)}</span>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </li>
              </ol>
            </div>
            {cards.length > 1 && (
              <a
                className="a-carousel-goto-nextpage dp-carousel-btn right"
                role="button"
                onClick={() => setI((i + 1) % cards.length)}
              >
                <i className="a-icon a-icon-next-rounded" />
              </a>
            )}
          </div>
        </div>
        {cards.length > 1 && (
          <S cls="aplus-pagination-wrapper">
            <ul className="aplus-pagination-dots" role="tablist">
              {cards.map((_, j) => (
                <li className="aplus-pagination-dot" key={j}>
                  <span
                    role="tab"
                    aria-label={`slide-${j + 1}`}
                    className={`carousel-slider-circle aplus-display-inline-block ${j === i ? 'aplus-carousel-active' : ''}`}
                    onClick={() => setI(j)}
                  />
                </li>
              ))}
            </ul>
          </S>
        )}
      </S>
      {paras(footer).length > 0 && (
        <S cls="a-text-center">
          <PremiumP c={footer} cls="aplus-description aplus-container-3 aplus-p1" />
        </S>
      )}
    </Premium>
  );
}

function NavCarousel12({ cards }: { cards: Rec[] }) {
  const [i, setI] = useState(0);
  const card = cards[i] ?? {};
  return (
    <Premium id="premium-module-12-nav-carousel" mod="premium-aplus-module-12">
      <S cls="aplus-carousel-container">
        <div className="aplus-carousel-card">
          <S cls="aplus-card-image">
            <AImg c={card.desktopImage} cover />
          </S>
          <div className="aplus-card-details-wrapper">
            <div className="aplus-card-detail">
              <div className="aplus-table-cell">
                <div className="aplus-text-background aplus-text-background-color" style={{ margin: 40 }}>
                  {text(card.subtitle) && <h5 className="aplus-accent1">{text(card.subtitle)}</h5>}
                  {text(card.title) && <h1 className="aplus-h1 a-text-bold">{text(card.title)}</h1>}
                  <div className="description card-description">
                    <PremiumP c={card.description} cls="aplus-p2" />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
        <div className="aplus-carousel-nav" role="tablist">
          {cards.map((c, j) => (
            <button
              type="button"
              role="tab"
              key={j}
              className={j === i ? 'aplus-carousel-active' : ''}
              onClick={() => setI(j)}
            >
              {text(c.navText) || `Slide ${j + 1}`}
            </button>
          ))}
        </div>
      </S>
    </Premium>
  );
}

function Faq11({ dark, faqs }: { dark: boolean; faqs: Rec[] }) {
  const [open, setOpen] = useState<number | null>(0);
  return (
    <Premium id="premium-module-11-faq" mod={`premium-aplus-module-11 ${dark ? 'aplus-secondary-color' : ''}`}>
      <S cls={`aplus-container-2 faqs-container ${faqs.length}`}>
        <ul className="faq-list">
          {faqs.map((f, i) => (
            <li
              className={`faq-block ${open === i ? 'aplus-active' : ''}`}
              id={`faq-qa-pair-${i}`}
              key={i}
              onClick={() => setOpen(open === i ? null : i)}
            >
              <h3>
                <span role="button">
                  <p className="aplus-question aplus-p1">{paras(f.question).join(' ') || 'Question'}</p>
                  <span className="faq-arrow" />
                </span>
              </h3>
              <p className="aplus-answer aplus-p2">{paras(f.answer).join(' ')}</p>
            </li>
          ))}
        </ul>
      </S>
    </Premium>
  );
}

function Hotspot({ m, withText }: { m: Rec; withText: boolean }) {
  const [open, setOpen] = useState<number | null>(null);
  const spots = ((m.hotSpots ?? []) as Rec[]).map((h) => h.imageTextHotSpot ?? h.imageHotSpot ?? h);
  return (
    <Premium id="premium-module-hotspot" mod="premium-aplus-module-hotspot" approx>
      {withText && text(m.headline) && (
        <h1 className="a-text-center aplus-container-3 aplus-h1 a-text-bold">{text(m.headline)}</h1>
      )}
      <div className="aplus-hotspot-image">
        <AImg c={m.desktopImage} cover />
        {spots.map((h, i) => {
          // xCoordinate / yCoordinate are pixel offsets on the desktop image (validated live: (10,10) and (2000,900) are
          // "out of bounds" on a 1464x600 crop); convert to percentages of the crop so the marker scales with the image.
          const crop = (m.desktopImage as Rec | undefined)?.imageCropSpecification as Rec | undefined;
          const cw = Number((crop?.size as Rec)?.width && ((crop!.size as Rec).width as Rec).value) || 1464;
          const ch = Number((crop?.size as Rec)?.height && ((crop!.size as Rec).height as Rec).value) || 600;
          const px = parseFloat(text(h.xCoordinate)),
            py = parseFloat(text(h.yCoordinate));
          const x = Number.isFinite(px) ? Math.min(100, Math.max(0, (px / cw) * 100)) : 50;
          const y = Number.isFinite(py) ? Math.min(100, Math.max(0, (py / ch) * 100)) : 50;
          return (
            <span key={i}>
              <span
                className="aplus-hotspot"
                style={{ left: `${x}%`, top: `${y}%` }}
                onClick={() => setOpen(open === i ? null : i)}
                role="button"
                aria-label={text(h.title)}
              />
              {open === i && (
                <div className="aplus-hotspot-tip" style={{ left: `${x}%`, top: `${y}%` }}>
                  <p className="aplus-accent1">{text(h.title)}</p>
                  <PremiumP c={h.description} cls="aplus-p3" />
                </div>
              )}
            </span>
          );
        })}
      </div>
      {withText && paras(m.mainDescription).length > 0 && (
        <S cls="a-text-center">
          <PremiumP c={m.mainDescription} cls="aplus-description aplus-container-3 aplus-p1" />
        </S>
      )}
    </Premium>
  );
}

/** Fallback for any module type without a dedicated renderer: shows every text and image it can find. */
function GenericModule({ module }: { module: ContentModule }) {
  const spec = modulesByType[module.contentModuleType];
  const texts: string[] = [];
  const images: ImageComponent[] = [];
  const walk = (v: unknown) => {
    if (!v || typeof v !== 'object') return;
    if (Array.isArray(v)) return v.forEach(walk);
    const o = v as Rec;
    if (typeof o.value === 'string' && o.value) texts.push(o.value);
    if (o.uploadDestinationId !== undefined && o.imageCropSpecification) images.push(o as ImageComponent);
    Object.values(o).forEach(walk);
  };
  walk(module[spec?.key]);
  return (
    <Premium id="premium-module-generic" mod="premium-aplus-module-generic" cls="aplus-container-1" approx>
      <p className="aplus-p3" style={{ color: '#565959' }}>
        {moduleLabel(module.contentModuleType)} (generic preview)
      </p>
      <div className="apm-flex" style={{ gap: 20 }}>
        {images.map((c, i) => (
          <div key={i} style={{ flex: 1 }}>
            <AImg c={c} cover />
          </div>
        ))}
      </div>
      {texts.map((t, i) => (
        <p key={i} className="aplus-p2">
          {t}
        </p>
      ))}
    </Premium>
  );
}

export function AplusModule({ module }: { module: ContentModule }) {
  const spec = modulesByType[module.contentModuleType];
  const m = (module[spec?.key] ?? {}) as Rec;
  const type = module.contentModuleType;
  // StandardModule and PremiumModule use no hooks, so they are called as plain functions here: that keeps their
  // `null` for an unhandled module type observable, and the generic preview takes over for it.
  const node = type.startsWith('STANDARD') ? StandardModule({ type, m }) : PremiumModule({ type, m });
  return <div className="aplus-module-csa-wrapper">{node ?? <GenericModule module={module} />}</div>;
}

/** Whole A+ slot body (under "Product description" or "From the manufacturer"): the `aplus-v2 desktop` wrapper amazon.com uses. */
export function AplusContent({ modules }: { modules: ContentModule[] }) {
  return (
    <div lang="en_US">
      <div className="aplus-v2 desktop celwidget" {...({ cel_widget_id: 'aplus' } as Record<string, string>)}>
        <div className="aplus-content-wrapper">
          {modules.map((m, i) => (
            <AplusModule module={m} key={i} />
          ))}
        </div>
      </div>
    </div>
  );
}
