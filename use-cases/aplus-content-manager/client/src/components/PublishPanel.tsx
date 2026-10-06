// Publish step: submit the document for approval, follow its status, and see which document owns each
// attached ASIN's detail page (publish records). Suspend takes an approved document off the page.
import { useCallback, useEffect, useRef, useState } from 'react';
import { api, SpApiError, type ContentMetadata, type Kind, type PublishRecord } from '../api';
import { StepFooter } from './StepFooter';

type Props = {
  contentReferenceKey: string;
  asinSet: string[];
  kind: Kind;
  metadata: ContentMetadata | null;
  onStatus: (m: ContentMetadata) => void;
  onPrev: () => void;
  /** leave the work area (back to the page the document was opened from) */
  onDone: () => void;
  doneLabel?: string;
};

const STATUS_TEXT: Record<string, string> = {
  DRAFT: 'Saved, not submitted. Nothing is visible to shoppers yet.',
  SUBMITTED: 'In review. Refresh to see the decision; production integrations poll at most once per hour.',
  APPROVED: 'Approved. The content shows on the attached ASINs once it has propagated to the detail page.',
  REJECTED: 'Rejected. Update the content and submit again.',
};

export function PublishStep({
  contentReferenceKey,
  asinSet,
  kind,
  metadata,
  onStatus,
  onPrev,
  onDone,
  doneLabel,
}: Props) {
  const [records, setRecords] = useState<Record<string, PublishRecord[]>>({});
  const [msg, setMsg] = useState<{ kind: 'ok' | 'error'; text: string } | null>(null);
  const [busy, setBusy] = useState(false);

  // onStatus is an inline callback from the parent; keep the latest one without making it an effect dependency
  const onStatusRef = useRef(onStatus);
  useEffect(() => {
    onStatusRef.current = onStatus;
  }, [onStatus]);
  const asinKey = asinSet.join(',');
  const refresh = useCallback(async () => {
    const d = await api.getDocument(contentReferenceKey);
    if (d.contentRecord.contentMetadata) onStatusRef.current(d.contentRecord.contentMetadata);
    const asins = asinKey.split(',').filter(Boolean);
    const all = await Promise.all(
      asins.map((a) =>
        api
          .publishRecords(a)
          .then((r) => [a, r.publishRecordList] as const)
          .catch(() => [a, []] as const),
      ),
    );
    setRecords(Object.fromEntries(all));
  }, [contentReferenceKey, asinKey]);
  useEffect(() => {
    refresh().catch(() => {});
  }, [refresh]);

  const run = async (fn: () => Promise<string>) => {
    setBusy(true);
    setMsg(null);
    try {
      setMsg({ kind: 'ok', text: await fn() });
    } catch (e) {
      setMsg({ kind: 'error', text: e instanceof SpApiError ? e.message : (e as Error).message });
    } finally {
      setBusy(false);
      await refresh().catch(() => {});
    }
  };
  const submit = () =>
    run(async () => {
      await api.submit(contentReferenceKey);
      return 'Submitted for approval';
    });
  const suspend = () =>
    run(async () => {
      await api.suspend(contentReferenceKey);
      return 'Suspended: removed from the detail page';
    });

  const status = metadata?.status ?? 'DRAFT';
  return (
    <div className="step-panel">
      <div className="status-card">
        <span className={`dot big ${status.toLowerCase()}`} />
        <div>
          <b>{status[0] + status.slice(1).toLowerCase()}</b>
          <div className="hint">
            {STATUS_TEXT[status]}
            {metadata?.updateTime ? ` · ${new Date(metadata.updateTime).toLocaleString()}` : ''}
          </div>
        </div>
        <span className="spacer" />
        <button type="button" className="link" onClick={() => refresh()}>
          Refresh
        </button>
      </div>

      <div className="actions">
        <button
          type="button"
          className="primary"
          onClick={submit}
          disabled={busy || asinSet.length === 0 || status === 'SUBMITTED'}
        >
          {status === 'APPROVED' ? 'Resubmit' : 'Submit for approval'}
        </button>
        {status === 'APPROVED' && (
          <button type="button" className="danger" onClick={suspend} disabled={busy}>
            Suspend
          </button>
        )}
        {msg && <span className={`outcome ${msg.kind}`}>{msg.text}</span>}
      </div>
      {asinSet.length === 0 && <div className="warn">Attach at least one ASIN before submitting.</div>}

      {asinSet.length > 0 && (
        <div className="ownership">
          <div className="hint">On the detail page</div>
          <ul className="asin-list">
            {asinSet.map((a) => {
              const list = records[a] ?? [];
              const mine = list.find((r) => r.contentReferenceKey === contentReferenceKey);
              const others = list.filter((r) => r.contentReferenceKey !== contentReferenceKey);
              return (
                <li key={a}>
                  <div className="asin-text">
                    <b>{a}</b>
                    <span className="hint">
                      {mine ? 'this document is live' : list.length === 0 ? 'no A+ content published' : ''}
                      {others.length > 0 &&
                        `${mine ? ' · ' : ''}also live: ${others.map((o) => (o.contentType === 'BrandStory' ? 'Brand Story' : 'A+') + ' ' + o.contentReferenceKey.slice(0, 8)).join(', ')}`}
                      {!mine &&
                        others.some((o) => o.contentType !== 'BrandStory') &&
                        kind !== 'brandStory' &&
                        ' · approving this document replaces the A+ document that is live'}
                    </span>
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      )}

      <StepFooter onPrev={onPrev} prevLabel="ASINs" onNext={onDone} nextLabel={doneLabel ?? 'Done'} />
    </div>
  );
}
