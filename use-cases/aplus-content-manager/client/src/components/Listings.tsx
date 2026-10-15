// Products page body: the seller's listings (Listings Items API) with the A+ state of every ASIN, so the user can
// find the products that still run without A+ content, the ones on Standard that could move to Premium, and the
// ones already live. Picking a listing selects its ASIN; the selected row expands with what is on its detail page
// today and the actions for it (rendered by the parent through `details`).
import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { api, KIND_LABEL, type AplusIndex, type Kind, type ListingItem } from '../api';

type Filter = 'all' | 'with' | 'without' | 'draft';
type Props = {
  onPick: (asin: string) => void;
  selected: string;
  index: AplusIndex | null;
  /** panel shown under the selected listing */
  details?: ReactNode;
};

const FILTERS: { id: Filter; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'with', label: 'A+ live' },
  { id: 'without', label: 'No A+ yet' },
  { id: 'draft', label: 'Draft attached' },
];

export function Listings({ onPick, selected, index, details }: Props) {
  const [keywords, setKeywords] = useState('');
  const [query, setQuery] = useState('');
  const [items, setItems] = useState<ListingItem[] | null>(null);
  const [nextToken, setNextToken] = useState<string | undefined>();
  const [filter, setFilter] = useState<Filter>('all');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setItems(null);
    setError(null);
    api
      .listings(query)
      .then((r) => {
        if (!cancelled) {
          setItems(r.items);
          setNextToken(r.pagination?.nextToken);
        }
      })
      .catch((e) => {
        if (!cancelled) {
          setItems([]);
          setError(e.message);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [query]);

  const more = async () => {
    if (!nextToken) return;
    const r = await api.listings(query, nextToken);
    setItems((cur) => [...(cur ?? []), ...r.items]);
    setNextToken(r.pagination?.nextToken);
  };

  const rows = useMemo(
    () =>
      (items ?? [])
        // a listing can come back without a summary for the marketplace; there is nothing to show for it
        .filter((i) => i.summaries.length > 0)
        .map((i) => {
          const s = i.summaries[0];
          const e = index?.[s.asin];
          const live = e ? (Object.keys(e.published) as Kind[]) : [];
          const drafts = e?.attached ?? [];
          return {
            sku: i.sku,
            asin: s.asin,
            name: s.itemName ?? s.asin,
            image: s.mainImage?.link,
            live,
            drafts,
            buyable: s.status?.includes('BUYABLE'),
          };
        })
        .filter(
          (r) =>
            filter === 'all' ||
            (filter === 'with' && r.live.length) ||
            (filter === 'without' && !r.live.length) ||
            (filter === 'draft' && r.drafts.length),
        ),
    [items, index, filter],
  );

  return (
    <section className="listings">
      <div className="listings-head">
        <h2>Your listings</h2>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            setQuery(keywords.trim());
          }}
        >
          <input
            value={keywords}
            onChange={(e) => setKeywords(e.target.value)}
            placeholder="Search by name, SKU or ASIN"
            aria-label="Search listings"
          />
          <button type="submit">Search</button>
        </form>
        <div className="chips" role="tablist" aria-label="Filter by A+ status">
          {FILTERS.map((f) => (
            <button
              type="button"
              role="tab"
              key={f.id}
              aria-selected={filter === f.id}
              className={`chip ${filter === f.id ? 'on' : ''}`}
              onClick={() => setFilter(f.id)}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>
      {items === null && <div className="hint">Loading listings…</div>}
      {error && <div className="error">{error}</div>}
      {items && rows.length === 0 && !error && <div className="hint">No listings match.</div>}
      <ul className="listing-rows">
        {rows.map((r) => {
          const on = r.asin === selected;
          return (
            <li key={r.sku} className={on ? 'selected' : ''}>
              <button
                type="button"
                className="listing"
                aria-expanded={on}
                onClick={() => onPick(on ? '' : r.asin)}
                title={on ? 'Collapse' : 'What is on this detail page today?'}
              >
                {r.image ? <img src={r.image} alt="" /> : <span className="ph" />}
                <span className="listing-text">
                  <span className="listing-name">{r.name}</span>
                  <span className="hint">
                    {r.asin} · {r.sku}
                    {r.buyable === false ? ' · not buyable' : ''}
                  </span>
                </span>
                <span className="listing-aplus">
                  {r.live.length === 0 && r.drafts.length === 0 && <span className="tag none">no A+</span>}
                  {r.live.map((k) => (
                    <span key={k} className={`tag ${k}`}>
                      {KIND_LABEL[k]}
                    </span>
                  ))}
                  {r.drafts.length > 0 && (
                    <span className="tag draft">{r.drafts.length === 1 ? 'draft' : `${r.drafts.length} drafts`}</span>
                  )}
                </span>
                <span className="caret" aria-hidden="true">
                  {on ? '▾' : '▸'}
                </span>
              </button>
              {on && details}
            </li>
          );
        })}
      </ul>
      {nextToken && (
        <button type="button" className="link small" onClick={more}>
          Load more
        </button>
      )}
    </section>
  );
}
