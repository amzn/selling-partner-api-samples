// A+ documents page: every document in the account (searchContentDocuments), whether it was authored in Seller
// Central, Vendor Central or through the API, with its tier (badgeSet), status and the ASINs it is applied to.
// Opening one puts it in the work area; a new document can be started here without a product.
import { useState } from 'react';
import { KIND_LABEL, type Kind } from '../api';
import type { ListItem } from '../App';
import { tierOf } from '../App';

type Props = {
  documents: ListItem[];
  error: string | null;
  docAsins: Record<string, string[]>;
  onOpen: (crk: string) => void;
  onNew: (kind: Kind) => void;
};

const ago = (iso: string) => {
  const days = Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000);
  return days <= 0
    ? 'today'
    : days === 1
      ? 'yesterday'
      : days < 30
        ? `${days} days ago`
        : new Date(iso).toLocaleDateString();
};

export function Documents({ documents, error, docAsins, onOpen, onNew }: Props) {
  const [filter, setFilter] = useState('');
  const q = filter.trim().toLowerCase();
  const visible = documents
    .filter(
      (d) =>
        !q ||
        d.contentMetadata.name.toLowerCase().includes(q) ||
        KIND_LABEL[tierOf(d.contentMetadata)].toLowerCase().includes(q) ||
        d.contentMetadata.status.toLowerCase().includes(q) ||
        docAsins[d.contentReferenceKey]?.some((a) => a.toLowerCase().includes(q)),
    )
    .sort((a, b) => b.contentMetadata.updateTime.localeCompare(a.contentMetadata.updateTime));

  return (
    <div className="documents">
      <div className="page-head">
        <div>
          <h1>A+ documents</h1>
          <p className="lead">
            Everything in this account, including content created in Seller Central or Vendor Central. A document is one
            tier (Standard, Premium or Brand Story) and one locale; it goes live on the ASINs it is applied to.
          </p>
        </div>
        <div className="new-doc">
          <span className="hint">New:</span>
          {(['premium', 'standard', 'brandStory'] as Kind[]).map((k) => (
            <button type="button" key={k} onClick={() => onNew(k)}>
              {KIND_LABEL[k]}
            </button>
          ))}
        </div>
      </div>
      {documents.length > 6 && (
        <input
          className="filter"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          placeholder="Filter by name, kind, status or ASIN"
          aria-label="Filter documents"
        />
      )}
      {error && <div className="error">{error}</div>}
      <ul className="doc-rows">
        {visible.map((d) => {
          const asins = docAsins[d.contentReferenceKey] ?? [];
          const m = d.contentMetadata;
          return (
            <li key={d.contentReferenceKey} data-crk={d.contentReferenceKey}>
              <button type="button" className="doc-row" onClick={() => onOpen(d.contentReferenceKey)}>
                <span className={`dot ${m.status.toLowerCase()}`} />
                <span className="doc-row-text">
                  <span className="doc-name">{m.name}</span>
                  <span className="hint">
                    {m.status.toLowerCase()} · updated {ago(m.updateTime)} ·{' '}
                    <code title="contentReferenceKey">{d.contentReferenceKey.slice(0, 8)}…</code>
                  </span>
                </span>
                <span className={`tag ${tierOf(m)}`}>{KIND_LABEL[tierOf(m)]}</span>
                <span className="doc-asins hint" title={asins.join(', ')}>
                  {asins.length === 0 ? 'no ASINs yet' : asins.length === 1 ? asins[0] : `${asins.length} ASINs`}
                </span>
              </button>
            </li>
          );
        })}
        {visible.length === 0 && documents.length > 0 && <li className="empty hint">No document matches "{filter}"</li>}
        {documents.length === 0 && !error && <li className="empty hint">No A+ documents in this account yet</li>}
      </ul>
    </div>
  );
}
