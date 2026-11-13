// /preview: the detail-page simulation at natural desktop size in its own tab. State comes from the
// editor tab through localStorage and updates live while you edit (storage events). Mock-mode images
// resolve through the same /api/uploads route, so the tab needs the app server running.
import { useEffect, useState } from 'react';
import { AccountProvider, type AccountType } from './account';
import { ImagesProvider } from './images';
import { DetailPage } from './preview/DetailPage';
import { DocumentPreview } from './preview/DocumentPreview';
import { PREVIEW_STORAGE_KEY, type PreviewState } from './preview/DetailPagePreview';

const read = (): PreviewState | null => {
  try {
    const s = localStorage.getItem(PREVIEW_STORAGE_KEY);
    return s ? (JSON.parse(s) as PreviewState) : null;
  } catch {
    return null;
  }
};

export function PreviewPage({ mode, accountType = 'seller' }: { mode: 'live' | 'mock'; accountType?: AccountType }) {
  const [state, setState] = useState<PreviewState | null>(read);
  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key === PREVIEW_STORAGE_KEY) setState(read());
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);
  useEffect(() => {
    document.title =
      state?.view === 'document'
        ? `A+ preview: ${state.document?.name || 'document'}`
        : state?.item?.title
          ? `Amazon.com: ${state.item.title}`
          : 'Amazon.com: detail page preview';
  }, [state]);
  if (!state)
    return (
      <div className="loading">
        Open the A+ Content Manager in another tab first; this page mirrors what you edit there.
      </div>
    );
  return (
    <AccountProvider type={accountType}>
      <ImagesProvider mode={mode}>
        <div className="dp-fullpage">
          <p className="dp-disclaimer dp-disclaimer-full">
            Best-effort simulation of the amazon.com desktop detail page; the real page can differ. Check the published
            content on Amazon.
          </p>
          {state.view === 'document' ? (
            <DocumentPreview document={state.document} />
          ) : (
            <DetailPage
              document={state.document}
              item={state.item}
              asin={state.asin}
              status={state.status}
              companions={state.companions}
            />
          )}
        </div>
      </ImagesProvider>
    </AccountProvider>
  );
}
