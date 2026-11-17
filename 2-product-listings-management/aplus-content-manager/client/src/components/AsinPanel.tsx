// ASINs step: which products this content is for. Applying is a full replacement of the set; ownership and
// brand eligibility come back as badges and warnings, and an ineligible ASIN blocks submission later.
import { useCallback, useEffect, useRef, useState } from 'react';
import { api, SpApiError, type ApiError, type AsinMetadata, type ContentMetadata } from '../api';
import { StepFooter } from './StepFooter';

type Props = {
  contentReferenceKey: string;
  asinSet: string[];
  onAsinSetChange: (a: string[]) => void;
  onStatus: (m: ContentMetadata) => void;
  onPrev: () => void;
  onNext: () => void;
};

export function AsinStep({ contentReferenceKey, asinSet, onAsinSetChange, onStatus, onPrev, onNext }: Props) {
  const [applied, setApplied] = useState<AsinMetadata[]>([]);
  const [warnings, setWarnings] = useState<ApiError[]>([]);
  const [msg, setMsg] = useState<{ kind: 'ok' | 'error'; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [draft, setDraft] = useState(asinSet.join(', '));
  // the parent can pre-fill the set (opening a document for a new ASIN from the start screen); follow it
  const asinKey = asinSet.join(',');
  useEffect(() => {
    setDraft(asinKey.split(',').filter(Boolean).join(', '));
  }, [asinKey]);

  // onStatus is an inline callback from the parent; keep the latest one without making it an effect dependency
  const onStatusRef = useRef(onStatus);
  useEffect(() => {
    onStatusRef.current = onStatus;
  }, [onStatus]);
  const refresh = useCallback(async () => {
    const r = await api.listAsins(contentReferenceKey);
    setApplied(r.asinMetadataSet);
    setWarnings(r.warnings ?? []);
    const d = await api.getDocument(contentReferenceKey);
    if (d.contentRecord.contentMetadata) onStatusRef.current(d.contentRecord.contentMetadata);
  }, [contentReferenceKey]);
  useEffect(() => {
    refresh().catch(() => {});
  }, [refresh]);

  const parsed = draft
    .split(/[\s,]+/)
    .map((s) => s.trim().toUpperCase())
    .filter(Boolean);
  const dirty = parsed.join(',') !== applied.map((a) => a.asin).join(',');

  const apply = async () => {
    setBusy(true);
    setMsg(null);
    try {
      onAsinSetChange(parsed);
      await api.applyAsins(contentReferenceKey, parsed);
      setMsg({ kind: 'ok', text: `${parsed.length} ASIN${parsed.length === 1 ? '' : 's'} attached` });
      await refresh();
    } catch (e) {
      setMsg({ kind: 'error', text: e instanceof SpApiError ? e.message : (e as Error).message });
      await refresh().catch(() => {});
    } finally {
      setBusy(false);
    }
  };

  const bad = (a: AsinMetadata) =>
    a.badgeSet.includes('BRAND_NOT_ELIGIBLE') || a.badgeSet.includes('CATALOG_NOT_FOUND');
  const ineligible = applied.filter(bad);

  return (
    <div className="step-panel">
      <p className="lead">Which products should show this content?</p>
      <textarea
        rows={2}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        placeholder="One or more ASINs, separated by spaces or commas"
        aria-label="ASINs"
      />
      <div className="actions">
        <button type="button" className={dirty ? 'primary' : ''} onClick={apply} disabled={busy || parsed.length === 0}>
          {busy ? 'Applying…' : applied.length ? 'Replace ASINs' : 'Attach ASINs'}
        </button>
        {msg && <span className={`outcome ${msg.kind}`}>{msg.text}</span>}
      </div>

      {applied.length > 0 && (
        <ul className="asin-list">
          {applied.map((a) => (
            <li key={a.asin} className={bad(a) ? 'bad' : ''}>
              {a.imageUrl ? <img src={a.imageUrl} alt="" /> : <div className="ph" />}
              <div className="asin-text">
                <b>{a.asin}</b>
                <span className="hint ellipsis">{a.title}</span>
              </div>
              <span className="hint">
                {a.badgeSet.includes('CONTENT_PUBLISHED')
                  ? 'this document is live'
                  : a.badgeSet.includes('BRAND_NOT_ELIGIBLE')
                    ? 'not in your brand'
                    : a.badgeSet.includes('CATALOG_NOT_FOUND')
                      ? 'not in the catalog'
                      : 'not published yet'}
              </span>
            </li>
          ))}
        </ul>
      )}
      {warnings.map((w, i) => (
        <div className="warn" key={i}>
          {w.message} <b>{w.details}</b>
        </div>
      ))}
      {ineligible.length > 0 && (
        <div className="warn">
          Submission fails with <code>403 Unauthorized</code> while {ineligible.map((a) => a.asin).join(', ')}{' '}
          {ineligible.length === 1 ? 'is' : 'are'} in the set. Remove and apply again.
        </div>
      )}

      <StepFooter
        onPrev={onPrev}
        prevLabel="Content"
        onNext={onNext}
        nextLabel="Next: Publish"
        nextDisabled={applied.length === 0 || dirty}
        nextTitle={
          applied.length === 0 ? 'Attach at least one ASIN first' : dirty ? 'Apply the ASIN changes first' : ''
        }
      />
    </div>
  );
}
