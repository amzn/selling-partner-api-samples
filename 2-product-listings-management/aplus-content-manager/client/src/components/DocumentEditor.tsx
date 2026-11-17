// Content step: the document name, its modules (collapsible cards), an "Add module" picker scoped to the
// document's kind, and a sticky bar with Check (dry-run validation), Save (create or update) and Save and next,
// which saves and moves on to the ASINs step (plain Next when there is nothing to save).
// Errors from the API are mapped back to the module they belong to via the `details` path.
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  api,
  KIND_LABEL,
  parseDetails,
  SpApiError,
  type ApiError,
  type ContentDocument,
  type ContentModule,
  type Kind,
} from '../api';
import { catalog, modulesByType, moduleLabel, newModule } from '../catalog';
import { claimedBySchema, ModuleForm } from './ModuleForm';

type Props = {
  document: ContentDocument;
  kind: Kind;
  mode: 'live' | 'mock';
  onChange: (d: ContentDocument) => void;
  contentReferenceKey: string | null;
  asinSet: string[];
  /** the document differs from what is saved (or it was never saved) */
  dirty: boolean;
  /** `next` asks the parent to move to the following step once the save has landed */
  onCreated: (crk: string, next: boolean) => void | Promise<void>;
  onUpdated: (next: boolean) => void;
  onNext: () => void;
};

type Outcome = { kind: 'ok' | 'warn' | 'error'; title: string; errors?: ApiError[]; rateLimit?: string | null };
const MAX_MODULES = 7; // "Content module lists cannot have more than 7 modules."

/** First text the module carries, for the collapsed card header. */
function summary(m: ContentModule): string {
  const body = m[modulesByType[m.contentModuleType]?.key] as Record<string, unknown> | undefined;
  for (const k of ['headline', 'title', 'heading', 'subheadline']) {
    const v = (body?.[k] as { value?: string } | undefined)?.value;
    if (v) return v;
  }
  const para = (body?.description ?? body?.body ?? body?.mainDescription ?? body?.bodyText) as
    { textList?: { value?: string }[] } | undefined;
  return para?.textList?.[0]?.value ?? '';
}

export function DocumentEditor({
  document,
  kind,
  mode,
  onChange,
  contentReferenceKey,
  asinSet,
  dirty,
  onCreated,
  onUpdated,
  onNext,
}: Props) {
  const [outcome, setOutcome] = useState<Outcome | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [openIdx, setOpenIdx] = useState<number | null>(document.contentModuleList.length ? 0 : null);
  const [adding, setAdding] = useState(false);
  const [withExample, setWithExample] = useState(true);
  const [gallery, setGallery] = useState<Record<string, ContentDocument> | null>(null);
  const [details, setDetails] = useState(false);

  const errors = outcome?.errors ?? [];
  const modules = document.contentModuleList;
  // the editor can mount before the document has loaded (navigation by URL): open the first module once it arrives
  const hadModules = useRef(modules.length > 0);
  useEffect(() => {
    if (!hadModules.current && modules.length > 0) setOpenIdx(0);
    hadModules.current = modules.length > 0;
  }, [modules.length]);
  const setModules = (contentModuleList: ContentModule[]) => onChange({ ...document, contentModuleList });
  const move = (i: number, d: number) => {
    const l = [...modules];
    const [m] = l.splice(i, 1);
    l.splice(i + d, 0, m);
    setModules(l);
    setOpenIdx(i + d);
  };

  const addModule = async (type: string) => {
    let mod = newModule(type);
    if (withExample) {
      const g =
        gallery ??
        (await api
          .gallery()
          .then((r) => {
            setGallery(r);
            return r;
          })
          .catch(() => null));
      const example = g?.[type]?.contentModuleList?.find((m) => m.contentModuleType === type);
      if (example) mod = structuredClone(example);
    }
    setModules([...modules, mod]);
    setOpenIdx(modules.length);
    setAdding(false);
  };

  const run = async (name: string, fn: () => Promise<Outcome>) => {
    setBusy(name);
    setOutcome(null);
    try {
      setOutcome(await fn());
    } catch (e) {
      setOutcome(
        e instanceof SpApiError
          ? { kind: 'error', title: `${name} failed (HTTP ${e.status})`, errors: e.errors }
          : { kind: 'error', title: (e as Error).message },
      );
    } finally {
      setBusy(null);
    }
  };
  const check = () =>
    run('Check', async () => {
      const r = await api.validate(document, asinSet);
      if (r.errors?.length)
        return { kind: 'error', title: 'The service found problems', errors: r.errors, rateLimit: r._rateLimit };
      if (r.warnings?.length)
        return {
          kind: 'warn',
          title: 'Content is valid; the ASIN warnings block submission',
          errors: r.warnings,
          rateLimit: r._rateLimit,
        };
      return { kind: 'ok', title: 'Valid', rateLimit: r._rateLimit };
    });
  const save = (next = false) =>
    run(next ? 'Save and next' : 'Save', async () => {
      if (contentReferenceKey) {
        const r = await api.update(contentReferenceKey, document);
        onUpdated(next);
        return {
          kind: 'ok',
          title: 'Saved as a new draft revision. Submit again on the Publish step to make it live.',
          rateLimit: r._rateLimit,
        };
      }
      const r = await api.create(document);
      await onCreated(r.contentReferenceKey, next);
      return {
        kind: 'ok',
        title: asinSet.length ? `Created and attached to ${asinSet.join(', ')}` : 'Created. Attach ASINs next.',
        rateLimit: r._rateLimit,
      };
    });

  const moduleErrors = (i: number) => errors.filter((e) => parseDetails(e.details).index === i);
  const docErrors = errors.filter((e) => parseDetails(e.details).index === null);
  const available = useMemo(() => catalog.modules.filter((m) => m.tier === kind), [kind]);
  const full = modules.length >= MAX_MODULES;

  return (
    <div className="editor">
      <div className="doc-fields">
        <input
          className="doc-name-input"
          value={document.name}
          maxLength={100}
          placeholder={`Name this ${KIND_LABEL[kind]} document`}
          onChange={(e) => onChange({ ...document, name: e.target.value })}
          aria-label="Document name"
        />
        <button type="button" className="link small" onClick={() => setDetails(!details)}>
          {details ? 'Hide details' : 'Details'}
        </button>
      </div>
      {details && (
        <div className="doc-details">
          <label>
            Content type
            <select
              value={document.contentType}
              onChange={(e) => onChange({ ...document, contentType: e.target.value as ContentDocument['contentType'] })}
              disabled={kind === 'brandStory'}
            >
              {catalog.contentTypes
                .filter((t) => (t === 'BrandStory') === (kind === 'brandStory'))
                .map((t) => (
                  <option key={t}>{t}</option>
                ))}
            </select>
            <span className="hint">EBC for sellers, EMC for vendors, BrandStory for Brand Story documents</span>
          </label>
          <label>
            Locale
            <input
              value={document.locale}
              placeholder="en-US"
              onChange={(e) => onChange({ ...document, locale: e.target.value })}
            />
          </label>
        </div>
      )}
      {docErrors.map((e, i) => (
        <div className="error" key={i}>
          {parseDetails(e.details).field
            ? `${parseDetails(e.details).field}: ${parseDetails(e.details).constraint}`
            : e.details || e.message}
        </div>
      ))}

      <ol className="modules">
        {modules.map((m, i) => {
          const spec = modulesByType[m.contentModuleType];
          const errs = moduleErrors(i);
          const open = openIdx === i;
          return (
            <li className={`module ${open ? 'open' : ''} ${errs.length ? 'has-error' : ''}`} key={i}>
              <div
                className="module-head"
                onClick={() => setOpenIdx(open ? null : i)}
                role="button"
                aria-expanded={open}
              >
                <span className="n">{i + 1}</span>
                <b title={m.contentModuleType}>{moduleLabel(m.contentModuleType)}</b>
                {!open && <span className="hint ellipsis">{summary(m)}</span>}
                {errs.length > 0 && <span className="badge-error">{errs.length}</span>}
                <span className="spacer" />
                <span className="module-tools" onClick={(e) => e.stopPropagation()}>
                  <button type="button" className="icon" disabled={i === 0} onClick={() => move(i, -1)} title="Move up">
                    ↑
                  </button>
                  <button
                    type="button"
                    className="icon"
                    disabled={i === modules.length - 1}
                    onClick={() => move(i, 1)}
                    title="Move down"
                  >
                    ↓
                  </button>
                  <button
                    type="button"
                    className="icon danger"
                    onClick={() => {
                      setModules(modules.filter((_, j) => j !== i));
                      setOpenIdx(null);
                    }}
                    title="Remove"
                  >
                    ×
                  </button>
                </span>
              </div>
              {open && (
                <div className="module-body">
                  {errs
                    .filter((e) => !claimedBySchema(e.details, spec.schema, spec.key, m[spec.key]))
                    .map((e, k) => (
                      <div className="error" key={k}>
                        {parseDetails(e.details).field}: {parseDetails(e.details).constraint || e.message}
                      </div>
                    ))}
                  <ModuleForm
                    schema={spec.schema}
                    value={m[spec.key] as Record<string, unknown>}
                    path={spec.key}
                    errors={errs}
                    onChange={(v) => setModules(modules.map((x, j) => (j === i ? { ...x, [spec.key]: v } : x)))}
                  />
                </div>
              )}
            </li>
          );
        })}
      </ol>

      {!adding && (
        <button
          type="button"
          className="add-module"
          onClick={() => setAdding(true)}
          disabled={full}
          title={full ? `A document holds at most ${MAX_MODULES} modules` : ''}
        >
          + Add module
          {full
            ? ` (${MAX_MODULES} of ${MAX_MODULES})`
            : modules.length
              ? ` (${modules.length} of ${MAX_MODULES})`
              : ''}
        </button>
      )}
      {adding && (
        <div className="picker">
          <div className="picker-head">
            <b>{KIND_LABEL[kind]} modules</b>
            <label className="check">
              <input type="checkbox" checked={withExample} onChange={(e) => setWithExample(e.target.checked)} /> with
              sample content{mode === 'live' ? ' (replace the sample images)' : ''}
            </label>
            <span className="spacer" />
            <button type="button" className="link" onClick={() => setAdding(false)}>
              Cancel
            </button>
          </div>
          <div className="chips">
            {available.map((m) => (
              <button type="button" key={m.type} className="chip" onClick={() => addModule(m.type)}>
                {moduleLabel(m.type)}
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="actionbar">
        <button type="button" onClick={check} disabled={!!busy || modules.length === 0}>
          {busy === 'Check' ? 'Checking…' : 'Check'}
        </button>
        <button
          type="button"
          onClick={() => save(false)}
          disabled={!!busy || modules.length === 0 || !document.name || !dirty}
          title={dirty ? '' : 'Nothing to save'}
        >
          {busy === 'Save' ? 'Saving…' : 'Save'}
        </button>
        {outcome && (
          <span className={`outcome ${outcome.kind}`}>
            {outcome.title}
            {errors.length > docErrors.length && (
              <span className="hint"> · {errors.length - docErrors.length} shown on the modules</span>
            )}
          </span>
        )}
        {outcome?.rateLimit && (
          <span className="hint rate" title="x-amzn-RateLimit-Limit">
            {outcome.rateLimit}/s
          </span>
        )}
        <span className="spacer" />
        {dirty || !contentReferenceKey ? (
          <button
            type="button"
            className="primary"
            onClick={() => save(true)}
            disabled={!!busy || modules.length === 0 || !document.name}
            title={!document.name ? 'Name the document first' : ''}
          >
            {busy === 'Save and next' ? 'Saving…' : 'Save and next →'}
          </button>
        ) : (
          <button type="button" className="primary" onClick={onNext} disabled={!!busy}>
            Next: ASINs →
          </button>
        )}
      </div>
    </div>
  );
}
