// Products page: the product is the starting point. The account's listings (Listings Items API, with the A+ state
// of every ASIN) are the way in; selecting one expands it with what is on its detail page today, slot by slot
// (searchContentPublishRecords -> getContentDocument), the drafts attached to it, and the actions for each slot:
// edit what is live, apply a document the account already has (authored in Seller Central or elsewhere), create the
// missing kind, or replace/upgrade what is there.
import { useEffect, useState } from 'react';
import {
  api,
  KIND_LABEL,
  kindOf,
  slotHeading,
  type AplusIndex,
  type AplusIndexEntry,
  type ListingDetails,
  type ContentDocument,
  type ContentMetadata,
  type Kind,
} from '../api';
import type { ListItem, NewOpts } from '../App';
import { tierOf } from '../App';
import { aplusContentTypeFor, type AccountType } from '../account';
import { Listings } from './Listings';

type Published = {
  crk: string;
  kind: Kind;
  contentType: string;
  document: ContentDocument | null;
  metadata: ContentMetadata | null;
};
type Props = {
  asin: string;
  item: ListingDetails | null;
  documents: ListItem[];
  index: AplusIndex | null;
  mode: 'live' | 'mock';
  accountType: AccountType;
  onFocus: (asin: string) => void;
  onOpen: (crk: string) => void;
  onApplyExisting: (crk: string, asin: string) => void;
  onNew: (kind: Kind, opts: NewOpts) => void;
};

export function Start({
  asin,
  item,
  documents,
  index,
  mode,
  accountType,
  onFocus,
  onOpen,
  onApplyExisting,
  onNew,
}: Props) {
  return (
    <div className="start">
      <div className="page-head">
        <div>
          <h1>Products</h1>
          <p className="lead">
            {mode === 'mock'
              ? 'Pick one of the sample listings to see what is on its detail page today. Content already published from Seller Central or Vendor Central shows up too: edit it, apply it to more products, or add what is missing.'
              : 'Pick a listing to see what is on its detail page today. Content already published from Seller Central or Vendor Central shows up too: edit it, apply it to more products, or add what is missing.'}
          </p>
        </div>
      </div>
      <Listings
        selected={asin}
        onPick={onFocus}
        index={index}
        details={
          asin ? (
            <ProductCard
              asin={asin}
              item={item}
              documents={documents}
              attached={index?.[asin]?.attached ?? []}
              mode={mode}
              accountType={accountType}
              onOpen={onOpen}
              onApplyExisting={onApplyExisting}
              onNew={onNew}
            />
          ) : null
        }
      />
    </div>
  );
}

type CardProps = Omit<Props, 'index' | 'onFocus'> & { attached: AplusIndexEntry[] };

/** What is on this ASIN's detail page, slot by slot, and what can be done about each slot. */
function ProductCard({
  asin,
  item,
  documents,
  attached,
  mode,
  accountType,
  onOpen,
  onApplyExisting,
  onNew,
}: CardProps) {
  const [published, setPublished] = useState<Published[] | null>(null);
  const [lookupError, setLookupError] = useState<string | null>(null);
  const [template, setTemplate] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setPublished(null);
    setLookupError(null);
    api
      .publishRecords(asin)
      .then((r) =>
        Promise.all(
          r.publishRecordList.map(async (p) => {
            const d = await api.getDocument(p.contentReferenceKey).catch(() => null);
            const document = d?.contentRecord.contentDocument ?? null;
            return {
              crk: p.contentReferenceKey,
              kind: p.contentType === 'BrandStory' ? ('brandStory' as Kind) : kindOf(document, 'standard'),
              contentType: p.contentType,
              document,
              metadata: d?.contentRecord.contentMetadata ?? null,
            };
          }),
        ),
      )
      .then((list) => {
        if (!cancelled) {
          setPublished(list);
          setLookupError(null);
        }
      })
      .catch((e) => {
        if (!cancelled) {
          setPublished([]);
          setLookupError(e.message);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [asin]);

  const has = (k: Kind) => published?.find((p) => p.kind === k);
  // documents the account already has that could fill a slot: any EBC/EMC document for the A+ slot, any Brand
  // Story for "From the brand"; the ones already on this ASIN (live or attached) are excluded
  const onAsin = new Set([...(published ?? []).map((p) => p.crk), ...attached.map((a) => a.contentReferenceKey)]);
  const candidates = (brand: boolean) =>
    documents.filter(
      (d) => brand === (tierOf(d.contentMetadata) === 'brandStory') && !onAsin.has(d.contentReferenceKey),
    );
  // the A+ slot is headed "Product description" for a seller (EBC) and "From the manufacturer" for a vendor (EMC);
  // with nothing live yet the label follows the account type
  const aplusContentType = (has('premium') ?? has('standard'))?.contentType ?? aplusContentTypeFor(accountType);
  const opts = (): NewOpts => ({ asin, title: item?.title, template });

  return (
    <div className="asin-card">
      <div className="asin-product">
        {item?.imageUrl ? <img src={item.imageUrl} alt="" /> : <div className="ph" />}
        <div>
          <div className="asin-title">{item?.title ?? (item === null ? 'Not one of your listings' : 'Loading…')}</div>
          <div className="hint">
            {asin}
            {item?.brand ? ` · ${item.brand}` : ''}
          </div>
        </div>
      </div>

      <div className="published">
        {published === null && !lookupError && <div className="hint">Looking up published content…</div>}
        {lookupError && <div className="error">{lookupError}</div>}
        {(['aplus', 'brand'] as const).map((slot) => {
          const brand = slot === 'brand';
          // Premium and Standard share the A+ slot: one of them is live at a time
          const live = brand ? has('brandStory') : (has('premium') ?? has('standard'));
          const drafts = attached.filter(
            (a) => brand === (a.tier === 'brandStory') && a.contentReferenceKey !== live?.crk,
          );
          const existing = candidates(brand);
          // what can be created for the slot: for the A+ slot the kind that is not live reads as a replacement
          // (Premium live -> a Standard instead) or an upgrade (Standard live -> Premium)
          const creatable: Kind[] = brand ? ['brandStory'] : ['premium', 'standard'];
          const create = live ? creatable.filter((k) => k !== live.kind) : creatable;
          const actionLabel = !live ? null : live.kind === 'standard' ? 'Upgrade' : 'Replace';
          return (
            <div className={`pub-row ${live ? 'live' : ''}`} key={slot}>
              <div className="pub-main">
                <span className={`dot ${live ? 'approved' : 'none'}`} />
                <div className="pub-text">
                  <b>{brand ? slotHeading('BrandStory') : slotHeading(aplusContentType)}</b>
                  <span className="hint">
                    {live
                      ? `${KIND_LABEL[live.kind]} · ${live.document?.name ?? live.crk} · ${live.document?.contentModuleList.length ?? 0} modules · live`
                      : published === null
                        ? '…'
                        : 'nothing published'}
                  </span>
                </div>
                {live && (
                  <button type="button" className="primary" onClick={() => onOpen(live.crk)}>
                    Edit
                  </button>
                )}
              </div>
              {drafts.map((d) => (
                <div className="pub-draft" key={d.contentReferenceKey}>
                  <span className={`dot ${d.status.toLowerCase()}`} />
                  <span className="hint ellipsis">
                    {KIND_LABEL[d.tier]} · {d.name} · {d.status.toLowerCase()}, attached but not live
                  </span>
                  <button type="button" onClick={() => onOpen(d.contentReferenceKey)}>
                    Edit
                  </button>
                </div>
              ))}
              {published !== null && (create.length > 0 || existing.length > 0) && (
                <div className="pub-actions">
                  {actionLabel && <span className="hint">{actionLabel}:</span>}
                  {create.map((k) => (
                    <button type="button" key={k} onClick={() => onNew(k, opts())}>
                      {live ? `New ${KIND_LABEL[k]}` : `Create ${KIND_LABEL[k]}`}
                    </button>
                  ))}
                  {existing.length > 0 && (
                    <select
                      defaultValue=""
                      aria-label={`Apply an existing document to ${asin}`}
                      onChange={(e) => {
                        if (e.target.value) onApplyExisting(e.target.value, asin);
                      }}
                    >
                      <option value="" disabled>
                        Apply existing…
                      </option>
                      {existing.map((d) => (
                        <option key={d.contentReferenceKey} value={d.contentReferenceKey}>
                          {d.contentMetadata.name} ({KIND_LABEL[tierOf(d.contentMetadata)]})
                        </option>
                      ))}
                    </select>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
      <label className="check">
        <input type="checkbox" checked={template} onChange={(e) => setTemplate(e.target.checked)} /> Start new documents
        with sample modules{mode === 'live' ? ' (replace the sample images before saving)' : ''}
      </label>
    </div>
  );
}
