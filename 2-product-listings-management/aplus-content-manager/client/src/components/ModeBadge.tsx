// Compact mode indicator. The mode is decided when the server starts (MODE=mock / live); the badge says
// which one is running and the popover explains what that means and how to switch.
import { useState } from 'react';
import type { AccountType } from '../account';

export type Config = {
  mode: 'live' | 'mock';
  marketplaceId: string;
  endpoint: string;
  listings?: boolean;
  accountType?: AccountType;
};

export function ModeBadge({ config, onReset }: { config: Config; onReset: () => void }) {
  const [open, setOpen] = useState(false);
  const live = config.mode === 'live';
  const vendor = config.accountType === 'vendor';
  return (
    <div className="mode-wrap">
      <button
        type="button"
        className={`mode ${config.mode}`}
        onClick={() => setOpen(!open)}
        aria-expanded={open}
        title="What does this mean?"
      >
        <span className="dot" />
        {live ? `Live · ${config.marketplaceId}` : 'Sample data'}
        {vendor ? ' · Vendor' : ''}
      </button>
      {open && (
        <div className="popover" role="dialog">
          {live ? (
            <>
              <b>Live mode</b>
              <p>
                Every action calls the Selling Partner API at <code>{config.endpoint}</code> for marketplace{' '}
                <code>{config.marketplaceId}</code> with the server's LWA credentials. Saving, applying ASINs and
                submitting change real content.
              </p>
              <p className="hint">
                Switch to sample data with <code>npm run dev:mock</code>.
              </p>
            </>
          ) : (
            <>
              <b>Sample data mode</b>
              <p>
                Nothing leaves this machine. An in-memory sample account (four listings, four A+ documents) reproduces
                the API's responses and validation messages, so you can try the whole flow without credentials. Uploads
                and edits are kept until you reset.
              </p>
              <p className="hint">
                Switch to the live API with <code>npm run dev</code> and LWA credentials in <code>.env</code>.
              </p>
              <button
                type="button"
                className="link"
                onClick={() => {
                  onReset();
                  setOpen(false);
                }}
              >
                Reset sample data
              </button>
            </>
          )}
          <p className="hint">
            <b>{vendor ? 'Vendor' : 'Seller'} account.</b>{' '}
            {vendor
              ? 'A+ documents are EMC and render under "From the manufacturer"; the page shows Amazon.com as the seller.'
              : 'A+ documents are EBC and render under "Product description"; the page shows the brand as the seller.'}{' '}
            Brand Story renders under "From the brand" for both. Set{' '}
            <code>SP_API_ACCOUNT_TYPE={vendor ? 'seller' : 'vendor'}</code> to switch.
          </p>
        </div>
      )}
    </div>
  );
}
