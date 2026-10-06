// A+ Content Manager shell. Two pages behind the top nav, one work area, one preview:
//   Products       which of my listings carry A+ content, what is on one detail page today, and the actions for it
//   A+ documents   every A+ document in the account, whether it was authored in Seller Central, Vendor Central or
//                  through the API, with the ASINs each one is applied to
//   Work area      Content -> ASINs -> Publish for the open document (opened from either page)
//   Preview        the document on its own until it is attached to an ASIN, then the simulated amazon.com detail
//                  page of one of its ASINs (switchable), updated live
// Navigation goes through the URL hash (#/products/B0..., #/documents, #/documents/<crk>/asins, #/new/premium), so the
// browser's back and forward buttons move between pages, products and steps.
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  api,
  KIND_LABEL,
  kindOf,
  type AplusIndex,
  type ListingDetails,
  type ContentDocument,
  type ContentMetadata,
  type Kind,
} from './api';
import { AsinStep } from './components/AsinPanel';
import { DocumentEditor } from './components/DocumentEditor';
import { Documents } from './components/Documents';
import { ModeBadge, type Config } from './components/ModeBadge';
import { PublishStep } from './components/PublishPanel';
import { Start } from './components/Start';
import { AccountProvider, aplusContentTypeFor, type AccountType } from './account';
import { ImagesProvider } from './images';
import { DetailPagePreview, type PreviewView } from './preview/DetailPagePreview';

export type ListItem = { contentReferenceKey: string; contentMetadata: ContentMetadata };
export type Step = 'content' | 'asins' | 'publish';
export type NewOpts = { asin?: string; title?: string; template?: boolean };

const blank = (kind: Kind, account: AccountType = 'seller', name = ''): ContentDocument => ({
  name,
  contentType: kind === 'brandStory' ? 'BrandStory' : aplusContentTypeFor(account),
  locale: 'en-US',
  contentModuleList: [],
});
const STEPS: { id: Step; label: string }[] = [
  { id: 'content', label: 'Content' },
  { id: 'asins', label: 'ASINs' },
  { id: 'publish', label: 'Publish' },
];
export const tierOf = (m: ContentMetadata): Kind =>
  m.badgeSet.includes('PREMIUM') ? 'premium' : m.badgeSet.includes('STANDARD') ? 'standard' : 'brandStory';

/** contentReferenceKey -> ASINs it is applied to (published or attached), from the ASIN-keyed index. */
function asinsByDocument(index: AplusIndex | null): Record<string, string[]> {
  const out: Record<string, string[]> = {};
  if (!index) return out;
  for (const [asin, e] of Object.entries(index)) {
    for (const entry of [...Object.values(e.published), ...e.attached])
      (out[entry.contentReferenceKey] ||= []).push(asin);
  }
  return out;
}

// ---- routes (the URL hash is the source of truth for where the user is) ------------------------------------
export type Route =
  | { page: 'products'; asin?: string }
  | { page: 'documents' }
  | { page: 'edit'; crk: string; step: Step }
  | { page: 'new'; kind: Kind; asin?: string };
const KINDS: Kind[] = ['premium', 'standard', 'brandStory'];
export function routeHash(r: Route): string {
  switch (r.page) {
    case 'products':
      return r.asin ? `#/products/${r.asin}` : '#/products';
    case 'documents':
      return '#/documents';
    case 'edit':
      return `#/documents/${encodeURIComponent(r.crk)}/${r.step}`;
    case 'new':
      return `#/new/${r.kind}${r.asin ? `?asin=${r.asin}` : ''}`;
  }
}
/** Navigate by hash: a history entry the browser's back/forward buttons replay through `hashchange`. */
const setHash = (h: string) => window.location.assign(h);
export function parseRoute(hash: string): Route {
  const [path, query = ''] = hash.replace(/^#\/?/, '').split('?');
  const parts = path.split('/').filter(Boolean);
  const asin = new URLSearchParams(query).get('asin') ?? undefined;
  if (parts[0] === 'documents' && parts[1]) {
    const step = (STEPS.find((s) => s.id === parts[2])?.id ?? 'content') as Step;
    return { page: 'edit', crk: decodeURIComponent(parts[1]), step };
  }
  if (parts[0] === 'documents') return { page: 'documents' };
  if (parts[0] === 'new' && KINDS.includes(parts[1] as Kind)) return { page: 'new', kind: parts[1] as Kind, asin };
  if (parts[0] === 'products')
    return { page: 'products', asin: /^[A-Z0-9]{10}$/i.test(parts[1] ?? '') ? parts[1].toUpperCase() : undefined };
  return { page: 'products' };
}

export function App() {
  const [config, setConfig] = useState<Config | null>(null);
  const [list, setList] = useState<ListItem[]>([]);
  const [listError, setListError] = useState<string | null>(null);
  const [index, setIndex] = useState<AplusIndex | null>(null);

  // where the user is: the parsed hash
  const [route, setRoute] = useState<Route>(() => parseRoute(window.location.hash));
  const editing = route.page === 'edit' || route.page === 'new';

  // the document in the work area
  const [crk, setCrk] = useState<string | null>(null);
  // the same value, readable synchronously from the hashchange handler (state lags a render behind)
  const crkRef = useRef<string | null>(null);
  const setCurrentCrk = (key: string | null) => {
    crkRef.current = key;
    setCrk(key);
  };
  const [doc, setDoc] = useState<ContentDocument>(blank('premium'));
  const [saved, setSaved] = useState<string>(JSON.stringify(blank('premium'))); // the document as last loaded or saved
  const [kind, setKind] = useState<Kind>('premium');
  const [metadata, setMetadata] = useState<ContentMetadata | null>(null);
  const [asinSet, setAsinSet] = useState<string[]>([]);
  const step: Step = route.page === 'edit' ? route.step : 'content';

  // the ASIN in focus: drives the page preview (title, images, bullets) and the companions on the page
  const [focusAsin, setFocusAsin] = useState('');
  const [item, setItem] = useState<ListingDetails | null>(null);
  const [companions, setCompanions] = useState<ContentDocument[]>([]);
  const [view, setView] = useState<PreviewView>('page');

  const loadList = useCallback(() => {
    api
      .searchDocuments()
      .then((r) => {
        setList(r.contentMetadataRecords);
        setListError(null);
      })
      .catch((e) => setListError(e.message));
    api
      .aplusIndex(true)
      .then((r) => setIndex(r.index))
      .catch(() => undefined);
  }, []);
  useEffect(() => {
    api
      .config()
      .then(setConfig)
      .catch(() => setConfig({ mode: 'live', marketplaceId: '?', endpoint: '?', listings: false }));
    loadList();
  }, [loadList]);
  const docAsins = useMemo(() => asinsByDocument(index), [index]);

  // the ASIN asked for last wins: a slower response for an earlier ASIN must not overwrite the current product
  const latestFocus = useRef('');
  const focus = useCallback((asin: string) => {
    setFocusAsin(asin);
    latestFocus.current = asin;
    if (asin.length !== 10) {
      setItem(null);
      return;
    }
    api
      .listing(asin)
      .then((r) => {
        if (latestFocus.current === asin) setItem(r);
      })
      .catch(() => {
        if (latestFocus.current === asin) setItem(null);
      });
  }, []);

  // The ASIN's other published documents (publish records -> getContentDocument), so the page shows the
  // live Brand Story under "From the brand" while a Premium document is being edited, and vice versa.
  useEffect(() => {
    if (focusAsin.length !== 10) {
      setCompanions([]);
      return;
    }
    let cancelled = false;
    const own = editing ? crk : null;
    api
      .publishRecords(focusAsin)
      .then((r) =>
        Promise.all(
          r.publishRecordList
            .filter((p) => p.contentReferenceKey !== own)
            .map((p) =>
              api
                .getDocument(p.contentReferenceKey)
                .then((d) => d.contentRecord.contentDocument)
                .catch(() => null),
            ),
        ),
      )
      .then((docs) => {
        if (!cancelled) setCompanions(docs.filter((d): d is ContentDocument => !!d));
      })
      .catch(() => {
        if (!cancelled) setCompanions([]);
      });
    return () => {
      cancelled = true;
    };
  }, [focusAsin, crk, editing, metadata?.status]);

  const refreshMetadata = useCallback(async (key: string) => {
    const r = await api.getDocument(key);
    setMetadata(r.contentRecord.contentMetadata);
    return r;
  }, []);

  /** Load an existing document into the work area. `addAsin` pre-fills the ASIN step with one more ASIN (not
   *  applied until the user confirms) and shows the document on that product's page: "apply what I already have
   *  to this ASIN". */
  const load = async (key: string, addAsin?: string) => {
    const r = await api.getDocument(key);
    const d = r.contentRecord.contentDocument ?? blank('premium');
    setCurrentCrk(key);
    setMetadata(r.contentRecord.contentMetadata);
    setDoc(d);
    setSaved(JSON.stringify(d));
    setKind(kindOf(d));
    const a = await api.listAsins(key).catch(() => null);
    const applied = a?.asinMetadataSet.map((x) => x.asin) ?? [];
    const set = addAsin && !applied.includes(addAsin) ? [...applied, addAsin] : applied;
    setAsinSet(set);
    const show = addAsin ?? set[0];
    if (show) {
      focus(show);
      setView('page');
    } else setView('document');
  };

  /** Put a new document in the work area, optionally for an ASIN and optionally pre-filled with the sample modules. */
  const startNew = async (k: Kind, opts: NewOpts = {}) => {
    let d = blank(k, config?.accountType, opts.title ? `${opts.title.slice(0, 70)} · ${KIND_LABEL[k]}` : '');
    if (opts.template) {
      const t = await api.templates().catch(() => null);
      const tpl = t?.[k === 'brandStory' ? 'brandstory' : k];
      if (tpl) d = { ...structuredClone(tpl), name: d.name || tpl.name };
    }
    setCurrentCrk(null);
    setMetadata(null);
    setDoc(d);
    setSaved(''); // a new document is unsaved by definition
    setKind(k);
    setAsinSet(opts.asin ? [opts.asin] : []);
    if (opts.asin) {
      focus(opts.asin);
      setView('page');
    } else setView('document');
  };

  // ---- navigation -------------------------------------------------------------------------------------------
  // `go` changes the hash (a history entry; back/forward replay it), `replace` swaps the current entry (after a
  // document is created, so "back" does not return to the unsaved #/new route). Options that are not in the URL
  // (sample template, product title, extra ASIN) ride along in `pending` for the hashchange that `go` triggers.
  const pending = useRef<{ hash: string; opts?: NewOpts; addAsin?: string } | null>(null);
  const [origin, setOrigin] = useState<Route>({ page: 'products' }); // the page the editor was opened from
  const applyRef = useRef<(r: Route, extra?: { opts?: NewOpts; addAsin?: string }) => void>(() => {});
  // (re)bound after every render so the hashchange listener always sees the current state and callbacks
  useEffect(() => {
    applyRef.current = (r, extra) => {
      setRoute(r);
      if (r.page === 'products') {
        setOrigin(r);
        if ((r.asin ?? '') !== focusAsin) focus(r.asin ?? '');
        setView('page');
      } else if (r.page === 'documents') {
        setOrigin(r);
      } else if (r.page === 'edit') {
        // same document still in memory (back/forward between steps, or returning from a page): keep unsaved edits
        if (r.crk !== crkRef.current || extra?.addAsin)
          load(r.crk, extra?.addAsin).catch(() => applyRef.current({ page: 'documents' }));
      } else if (r.page === 'new') {
        if (extra?.opts || crkRef.current !== null || kind !== r.kind || (r.asin ?? '') !== (asinSet[0] ?? ''))
          startNew(r.kind, extra?.opts ?? { asin: r.asin, template: false });
      }
    };
  });
  useEffect(() => {
    const onHash = () => {
      const h = window.location.hash;
      const extra = pending.current?.hash === h ? pending.current : undefined;
      pending.current = null;
      applyRef.current(parseRoute(h), extra);
    };
    window.addEventListener('hashchange', onHash);
    if (!window.location.hash) window.history.replaceState(null, '', routeHash({ page: 'products' }));
    onHash();
    return () => window.removeEventListener('hashchange', onHash);
  }, []);
  const go = (r: Route, extra?: { opts?: NewOpts; addAsin?: string }) => {
    const h = routeHash(r);
    if (window.location.hash === h) applyRef.current(r, extra);
    else {
      pending.current = { hash: h, ...extra };
      setHash(h);
    }
  };
  const replace = (r: Route) => {
    window.history.replaceState(null, '', routeHash(r));
    setRoute(r);
  };
  const goStep = (s: Step) => {
    if (crk) go({ page: 'edit', crk, step: s });
  };
  const close = () => go(origin);

  // the ASINs the page view can show: the open document's set while editing, the ASIN in focus otherwise
  const pageAsins = editing ? asinSet : focusAsin ? [focusAsin] : [];
  const effectiveView: PreviewView = editing && pageAsins.length === 0 ? 'document' : !editing ? 'page' : view;
  const dirty = JSON.stringify(doc) !== saved;

  if (!config) return <div className="loading">Loading…</div>;

  return (
    <AccountProvider type={config.accountType ?? 'seller'}>
      <ImagesProvider mode={config.mode}>
        <div className="app">
          <header>
            <button type="button" className="brand" onClick={() => go({ page: 'products' })}>
              A+ Content Manager
            </button>
            <nav className="topnav" aria-label="Sections">
              <button
                type="button"
                className={route.page === 'products' ? 'on' : ''}
                onClick={() => go({ page: 'products', asin: focusAsin || undefined })}
              >
                Products
              </button>
              <button
                type="button"
                className={route.page === 'documents' ? 'on' : ''}
                onClick={() => go({ page: 'documents' })}
              >
                A+ documents <span className="count">{list.length}</span>
              </button>
            </nav>
            <span className="spacer" />
            <ModeBadge
              config={config}
              onReset={() =>
                api.resetMock().then(() => {
                  loadList();
                  focus('');
                  go({ page: 'products' });
                })
              }
            />
          </header>

          <main>
            {route.page === 'products' && (
              <Start
                asin={focusAsin}
                item={item}
                documents={list}
                index={index}
                mode={config.mode}
                accountType={config.accountType ?? 'seller'}
                onFocus={(asin) => go({ page: 'products', asin: asin || undefined })}
                onOpen={(key) => go({ page: 'edit', crk: key, step: 'content' })}
                onApplyExisting={(key, asin) => go({ page: 'edit', crk: key, step: 'asins' }, { addAsin: asin })}
                onNew={(k, opts) => go({ page: 'new', kind: k, asin: opts.asin }, { opts })}
              />
            )}
            {route.page === 'documents' && (
              <Documents
                documents={list}
                error={listError}
                docAsins={docAsins}
                onOpen={(key) => go({ page: 'edit', crk: key, step: 'content' })}
                onNew={(k) => go({ page: 'new', kind: k }, { opts: { template: false } })}
              />
            )}
            {editing && (
              <>
                <div className="workhead">
                  <span className="hint context">
                    <button type="button" className="link back" onClick={close} title="Back to where you came from">
                      ← {origin.page === 'documents' ? 'A+ documents' : 'Products'}
                    </button>
                    · {KIND_LABEL[kind]}
                    {metadata ? (
                      <>
                        {' '}
                        · <span className={`dot ${metadata.status.toLowerCase()}`} /> {metadata.status.toLowerCase()}
                      </>
                    ) : (
                      ' · not saved yet'
                    )}
                    {crk && (
                      <>
                        {' '}
                        ·{' '}
                        <code
                          title="contentReferenceKey (click to copy)"
                          onClick={() => navigator.clipboard?.writeText(crk)}
                        >
                          {crk.slice(0, 8)}…
                        </code>
                      </>
                    )}
                  </span>
                  <nav className="steps" aria-label="Steps">
                    {STEPS.map((s, i) => (
                      <button
                        type="button"
                        key={s.id}
                        className={step === s.id ? 'on' : ''}
                        disabled={s.id !== 'content' && !crk}
                        title={s.id !== 'content' && !crk ? 'Save the content first' : ''}
                        onClick={() => goStep(s.id)}
                      >
                        <span className="n">{i + 1}</span>
                        {s.label}
                        {s.id === 'content' && crk && dirty && (
                          <span className="unsaved" title="Unsaved changes" aria-label="unsaved changes" />
                        )}
                      </button>
                    ))}
                  </nav>
                </div>
                {step === 'content' && (
                  <DocumentEditor
                    document={doc}
                    kind={kind}
                    onChange={setDoc}
                    contentReferenceKey={crk}
                    asinSet={asinSet}
                    dirty={dirty}
                    mode={config.mode}
                    onCreated={async (key, next) => {
                      setCurrentCrk(key);
                      setSaved(JSON.stringify(doc));
                      loadList();
                      // started from an ASIN: attach it right away so the next step is already done
                      if (asinSet.length) {
                        await api.applyAsins(key, asinSet).catch(() => undefined);
                      }
                      await refreshMetadata(key).catch(() => undefined);
                      replace({ page: 'edit', crk: key, step: 'content' });
                      if (next) go({ page: 'edit', crk: key, step: asinSet.length ? 'publish' : 'asins' });
                    }}
                    onUpdated={(next) => {
                      setSaved(JSON.stringify(doc));
                      loadList();
                      if (crk) refreshMetadata(crk).catch(() => undefined);
                      if (next) goStep('asins');
                    }}
                    onNext={() => goStep('asins')}
                  />
                )}
                {step === 'asins' && crk && (
                  <AsinStep
                    contentReferenceKey={crk}
                    asinSet={asinSet}
                    onAsinSetChange={(a) => {
                      setAsinSet(a);
                      if (a[0] && !a.includes(focusAsin)) focus(a[0]);
                      if (a.length) setView('page');
                      loadList();
                    }}
                    onStatus={(m) => {
                      setMetadata(m);
                      loadList();
                    }}
                    onPrev={() => goStep('content')}
                    onNext={() => goStep('publish')}
                  />
                )}
                {step === 'publish' && crk && (
                  <PublishStep
                    contentReferenceKey={crk}
                    asinSet={asinSet}
                    kind={kind}
                    metadata={metadata}
                    onStatus={(m) => {
                      setMetadata(m);
                      loadList();
                    }}
                    onPrev={() => goStep('asins')}
                    onDone={close}
                    doneLabel={origin.page === 'documents' ? 'Done: back to A+ documents' : 'Done: back to Products'}
                  />
                )}
              </>
            )}
          </main>

          <section className="preview">
            <div className="preview-head">
              <b>Preview</b>
              {effectiveView === 'document' ? (
                <>
                  <span className="chip">document</span>
                  <span className="hint ellipsis" title={doc.name}>
                    {doc.name || 'Untitled'} · {KIND_LABEL[kind]} · {doc.contentModuleList.length} module
                    {doc.contentModuleList.length === 1 ? '' : 's'}
                  </span>
                  {pageAsins.length === 0 && (
                    <>
                      <span className="spacer" />
                      <span className="hint">attach an ASIN (step 2) to see it on a product page</span>
                    </>
                  )}
                </>
              ) : (
                <>
                  {focusAsin ? (
                    <span className="chip">{focusAsin}</span>
                  ) : (
                    <span className="hint">pick a product to see its detail page</span>
                  )}
                  {item?.title && (
                    <span className="hint ellipsis" title={item.title}>
                      {item.title}
                    </span>
                  )}
                  <span className="spacer" />
                  {companions.length > 0 && (
                    <span className="hint" title="Other documents already published on this ASIN are shown on the page">
                      + published{' '}
                      {companions.map((c) => (c.contentType === 'BrandStory' ? 'Brand Story' : 'A+')).join(', ')}
                    </span>
                  )}
                </>
              )}
            </div>
            <DetailPagePreview
              view={effectiveView}
              onViewChange={setView}
              asinOptions={pageAsins}
              onAsinChange={focus}
              document={editing ? doc : null}
              item={item}
              asin={focusAsin}
              status={metadata?.status}
              companions={companions}
            />
          </section>
        </div>
      </ImagesProvider>
    </AccountProvider>
  );
}
