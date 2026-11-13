// Side-panel preview with two views:
//   document    the A+ slot alone, at desktop width (what the document is, before it is applied to anything)
//   page        the full 1500px amazon.com detail-page simulation for one of the document's ASINs
// Both are scaled to the panel width (or 50% / 100% with horizontal scrolling). "Open full page" shows
// the same view in a new tab at natural size; the tab follows edits live through localStorage
// (see PreviewPage.tsx).
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import type { ListingDetails, ContentDocument } from '../api';
import { DetailPage } from './DetailPage';
import { DocumentPreview } from './DocumentPreview';

export const PREVIEW_STORAGE_KEY = 'aplus-preview-state';
export type PreviewView = 'document' | 'page';
export type PreviewState = {
  view: PreviewView;
  document: ContentDocument | null;
  item: ListingDetails | null;
  asin?: string;
  status?: string;
  companions?: ContentDocument[];
  savedAt: string;
};

const PAGE_WIDTH = 1500;
type Zoom = 'fit' | 0.5 | 1;

type Props = {
  view: PreviewView;
  onViewChange: (v: PreviewView) => void;
  /** ASINs the page view can show (the document's attached set); empty disables the page view */
  asinOptions: string[];
  onAsinChange: (asin: string) => void;
  document: ContentDocument | null;
  item: ListingDetails | null;
  asin?: string;
  status?: string;
  companions?: ContentDocument[];
};

export function DetailPagePreview({
  view,
  onViewChange,
  asinOptions,
  onAsinChange,
  document,
  item,
  asin,
  status,
  companions = [],
}: Props) {
  const outer = useRef<HTMLDivElement>(null);
  const inner = useRef<HTMLDivElement>(null);
  const [zoom, setZoom] = useState<Zoom>('fit');
  const [panelWidth, setPanelWidth] = useState(600);
  const [pageHeight, setPageHeight] = useState(2000);

  // Track the panel width (for "fit") and the unscaled page height (transforms do not affect layout).
  useLayoutEffect(() => {
    const ro = new ResizeObserver(() => {
      if (outer.current) setPanelWidth(outer.current.clientWidth);
      if (inner.current) setPageHeight(inner.current.offsetHeight);
    });
    if (outer.current) ro.observe(outer.current);
    if (inner.current) ro.observe(inner.current);
    return () => ro.disconnect();
  }, []);

  // Keep the full-page tab in sync with the editor.
  useEffect(() => {
    const state: PreviewState = { view, document, item, asin, status, companions, savedAt: new Date().toISOString() };
    try {
      localStorage.setItem(PREVIEW_STORAGE_KEY, JSON.stringify(state));
    } catch {
      /* quota or privacy mode: the full-page tab just shows its last state */
    }
  }, [view, document, item, asin, status, companions]);

  const scale = zoom === 'fit' ? Math.min(1, panelWidth / PAGE_WIDTH) : zoom;
  const pageDisabled = asinOptions.length === 0;
  return (
    <div className="dp-preview">
      <div className="dp-preview-bar">
        <div className="dp-views" role="tablist" aria-label="Preview view">
          <button
            type="button"
            role="tab"
            aria-selected={view === 'document'}
            className={view === 'document' ? 'on' : ''}
            onClick={() => onViewChange('document')}
            disabled={!document}
            title={
              document
                ? 'The document on its own, as its modules render on desktop'
                : 'Open or create a document to preview it on its own'
            }
          >
            Document
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={view === 'page'}
            className={view === 'page' ? 'on' : ''}
            onClick={() => onViewChange('page')}
            disabled={pageDisabled}
            title={
              pageDisabled
                ? 'Attach an ASIN (step 2) to see the document on its product page'
                : 'The document on the product detail page'
            }
          >
            Detail page
          </button>
          {view === 'page' && asinOptions.length > 1 && (
            <select
              value={asin}
              onChange={(e) => onAsinChange(e.target.value)}
              aria-label="ASIN shown on the page"
              className="dp-asin-pick"
            >
              {asinOptions.map((a) => (
                <option key={a} value={a}>
                  {a}
                </option>
              ))}
            </select>
          )}
        </div>
        <div className="dp-zoom">
          <span className="hint">{Math.round(scale * 100)}%</span>
          {(['fit', 0.5, 1] as Zoom[]).map((z) => (
            <button type="button" key={String(z)} className={zoom === z ? 'on' : ''} onClick={() => setZoom(z)}>
              {z === 'fit' ? 'Fit' : `${z * 100}%`}
            </button>
          ))}
          <a href="/preview" target="_blank" rel="noopener" className="dp-open">
            Open full page ↗
          </a>
        </div>
      </div>
      <p className="dp-disclaimer">
        Best-effort simulation of the amazon.com desktop detail page; the real page can differ. Check the published
        content on Amazon.
      </p>
      <div className="dp-preview-scroll" ref={outer}>
        <div className="dp-preview-stage" style={{ width: PAGE_WIDTH * scale, height: pageHeight * scale }}>
          <div ref={inner} style={{ width: PAGE_WIDTH, transform: `scale(${scale})`, transformOrigin: '0 0' }}>
            {view === 'document' ? (
              <DocumentPreview document={document} />
            ) : (
              <DetailPage document={document} item={item} asin={asin} status={status} companions={companions} />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
