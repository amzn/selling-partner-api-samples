// Simulation of the amazon.com desktop product detail page around the A+ content being edited.
// Structure and section order follow the live page: nav, breadcrumb, image block / title column /
// buy box, "From the brand" (#aplusBrandStory_feature_div), the A+ slot (#aplus_feature_div, headed
// "Product description" for a seller's EBC document or "From the manufacturer" for a vendor's EMC
// document), the plain-text "Product Description" (vendors only; a seller's A+ replaces it), "Product
// information", footer. Catalog data (title, brand, images, bullets, description) comes from the Catalog
// Items API; ratings, delivery, price savings and the "bought in past month" line are fixtures marked
// with data-fixture so nobody reads them as real.
import { useAccount } from '../account';
import { slotHeading, slotOf, type ListingDetails, type ContentDocument } from '../api';
import { modulesByType } from '../catalog';
import { AplusContent } from './AplusModules';
import { BrandStory } from './BrandStory';
import './amazon-dp.css';
import './aplus.css';

// The logo and the cart icon are the real ones: amazon.com's global nav sprite (nav-sprite-global-*-reorg-privacy),
// vendored under ./assets, with the sprite offsets and sizes copied from the live nav stylesheet.
const Logo = () => <span className="nav-sprite nav-logo-base" role="img" aria-label="amazon" />;
const Star = ({ fill }: { fill: number }) => {
  const id = `dp-star-${Math.round(fill * 100)}`;
  return (
    <svg viewBox="0 0 20 20" aria-hidden="true">
      <defs>
        <linearGradient id={id}>
          <stop offset={`${fill * 100}%`} stopColor="#ffa41c" />
          <stop offset={`${fill * 100}%`} stopColor="#fff" />
        </linearGradient>
      </defs>
      <path
        d="M10 1.5l2.6 5.6 6.1.7-4.5 4.2 1.2 6-5.4-3-5.4 3 1.2-6L1.3 7.8l6.1-.7z"
        fill={`url(#${id})`}
        stroke="#de7921"
        strokeWidth="1"
        strokeLinejoin="round"
      />
    </svg>
  );
};
const Stars = ({ value }: { value: number }) => (
  <span className="dp-stars">
    {[0, 1, 2, 3, 4].map((i) => (
      <Star key={i} fill={Math.max(0, Math.min(1, value - i))} />
    ))}
  </span>
);

const Price = ({ value, small }: { value?: string | null; small?: boolean }) => {
  const m = /^([^\d]*)(\d[\d,]*)(?:[.,](\d{2}))?/.exec(value ?? '');
  if (!m)
    return (
      <span className={`dp-price ${small ? 'small' : ''}`}>
        <span className="dp-price-symbol">$</span>
        <span className="dp-price-whole">--</span>
        <span className="dp-price-fraction">--</span>
      </span>
    );
  return (
    <span className={`dp-price ${small ? 'small' : ''}`}>
      <span className="dp-price-symbol">{m[1] || '$'}</span>
      <span className="dp-price-whole">
        {m[2]}
        <span className="dp-price-decimal">.</span>
      </span>
      <span className="dp-price-fraction">{m[3] ?? '00'}</span>
    </span>
  );
};

const fmtDate = (d: Date) => d.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });
const plusDays = (n: number) => {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return d;
};

/** `companions`: the ASIN's other published documents (a Brand Story next to an A+ document, or the
 *  reverse), so the page shows both slots like amazon.com does: "From the brand" for the Brand Story and,
 *  for the A+ document, the heading its publisher gets ("Product description" for a seller's EBC document,
 *  "From the manufacturer" for a vendor's EMC document). The document being edited always wins within its
 *  own slot. */
export type DetailPageProps = {
  document: ContentDocument | null;
  item: ListingDetails | null;
  asin?: string;
  status?: string;
  companions?: ContentDocument[];
};

export function DetailPage({ document, item, asin, companions = [] }: DetailPageProps) {
  // a vendor's product is sold and shipped by Amazon.com; a seller's is sold by the brand (shipped by Amazon here)
  const vendor = useAccount() === 'vendor';
  // no document in the editor (start screen): the page shows what is published on the ASIN, both slots
  const edited = document ? slotOf(document.contentType) : null;
  const others = companions.filter((c) => slotOf(c.contentType) !== edited);
  const brandStoryDoc =
    edited === 'brandStory' ? document : (others.find((c) => slotOf(c.contentType) === 'brandStory') ?? null);
  const aplusDoc = edited === 'aplus' ? document : (others.find((c) => slotOf(c.contentType) === 'aplus') ?? null);
  const brandStory = (brandStoryDoc?.contentModuleList ?? []).filter(
    (m) => modulesByType[m.contentModuleType]?.tier === 'brandStory',
  );
  const manufacturer = (aplusDoc?.contentModuleList ?? []).filter(
    (m) => modulesByType[m.contentModuleType]?.tier !== 'brandStory',
  );
  const aplusHeading = slotHeading(aplusDoc?.contentType ?? 'EBC');
  // a seller's A+ replaces the plain-text description; a vendor's sits above it
  const sellerAplus = aplusDoc !== null && aplusDoc.contentType !== 'EMC';
  const aplusSummary = [
    aplusDoc &&
      `${aplusDoc.contentType} · ${aplusDoc.locale} · ${manufacturer.length} module${manufacturer.length === 1 ? '' : 's'}`,
    brandStoryDoc && `Brand Story · ${brandStory.length} module${brandStory.length === 1 ? '' : 's'}`,
  ]
    .filter(Boolean)
    .join(' + ');
  const images = item?.images?.length ? item.images : item?.imageUrl ? [item.imageUrl] : [];
  const bullets = item?.bullets?.length ? item.bullets : [];
  const title = item?.title ?? 'Product title (pick a product on the Products page)';
  const brand = item?.brand;
  const deliveryDate = fmtDate(plusDays(5));
  const fastDate = fmtDate(plusDays(1));

  return (
    <div className="dp-page" data-fixture-note="ratings, delivery, savings and bought-count rows are fixtures">
      {/* ---- nav */}
      <div className="dp-header">
        <div className="dp-nav-belt">
          <a className="dp-logo" aria-label="Amazon">
            <Logo />
          </a>
          <a className="dp-nav-item">
            <span className="dp-nav-line1">Deliver to</span>
            <span className="dp-nav-line2">Seattle 98101</span>
          </a>
          <div className="dp-nav-search" role="search">
            <div className="dp-nav-search-cat">All</div>
            <div className="dp-nav-search-input dp-secondary">Search Amazon</div>
            <div className="dp-nav-search-btn">
              <svg viewBox="0 0 24 24" fill="none" stroke="#0f1111" strokeWidth="2.2">
                <circle cx="10.5" cy="10.5" r="6.5" />
                <path d="M15.5 15.5L21 21" />
              </svg>
            </div>
          </div>
          <a className="dp-nav-flag">
            <span className="dp-flag" /> EN
          </a>
          <a className="dp-nav-item">
            <span className="dp-nav-line1">Hello, sign in</span>
            <span className="dp-nav-line2">Account &amp; Lists ▾</span>
          </a>
          <a className="dp-nav-item">
            <span className="dp-nav-line1">Returns</span>
            <span className="dp-nav-line2">&amp; Orders</span>
          </a>
          <a className="dp-nav-cart" aria-label="0 items in cart">
            <div className="dp-cart-count-container">
              <span className="dp-cart-count" aria-hidden="true">
                0
              </span>
              <span className="nav-sprite dp-cart-icon" />
            </div>
            <div className="dp-cart-text-container">
              <span className="dp-nav-line1">&nbsp;</span>
              <span className="dp-nav-line2">Cart</span>
            </div>
          </a>
        </div>
        <nav className="dp-nav-main">
          <a className="dp-nav-all">All</a>
          <a>Today's Deals</a>
          <a>Prime Video</a>
          <a>Registry</a>
          <a>Customer Service</a>
          <a>Gift Cards</a>
          <a>Sell</a>
          <a className="dp-nav-right">Shop deals in Electronics</a>
        </nav>
      </div>

      {/* ---- breadcrumb */}
      <div className="dp-breadcrumb">
        <a>Clothing, Shoes &amp; Jewelry</a>
        <span className="dp-sep">›</span>
        <a>Women</a>
        <span className="dp-sep">›</span>
        <a>Clothing</a>
        <span className="dp-sep">›</span>
        <a>Tops, Tees &amp; Blouses</a>
        <span className="dp-sep">›</span>
        <a>T-Shirts</a>
      </div>

      {/* ---- main columns */}
      <div className="dp-main">
        <div className="dp-imgblock">
          <div className="dp-thumbs">
            {images.map((src, i) => (
              <span className={`dp-thumb ${i === 0 ? 'on' : ''}`} key={i}>
                <img src={src} alt="" />
              </span>
            ))}
            {images.length === 0 && <span className="dp-thumb on" />}
          </div>
          <div className="dp-mainimg">
            <div className="dp-mainimg-box">
              {images[0] ? (
                <img src={images[0]} alt={title} />
              ) : (
                <div className="dp-img-missing">No image available</div>
              )}
            </div>
            <div className="dp-mainimg-caption">Roll over image to zoom in</div>
          </div>
        </div>

        <div className="dp-center">
          <h1 className="dp-title">{title}</h1>
          <div className="dp-byline">{brand ? <a>Visit the {brand} Store</a> : <a>Visit the Store</a>}</div>
          <div className="dp-ratings" data-fixture="ratings">
            <span>4.3</span>
            <Stars value={4.3} />
            <span className="dp-caret" />
            <a>1,234 ratings</a>
            <span className="dp-pipe">|</span>
            <a>Search this page</a>
          </div>
          <div className="dp-bought" data-fixture="bought">
            1K+ bought in past month
          </div>
          <hr className="dp-divider" />
          <div className="dp-price-row" data-fixture="savings">
            <span className="dp-savings">-10%</span>
            <Price value={item?.price} />
          </div>
          <div className="dp-listprice">
            List Price:{' '}
            <s>
              <Price
                value={item?.price ? `$${(parseFloat(item.price.replace(/[^\d.]/g, '')) / 0.9).toFixed(2)}` : null}
                small
              />
            </s>
          </div>
          <div style={{ marginTop: 4 }}>
            <a>FREE Returns</a>
          </div>
          <hr className="dp-divider" />
          {images[0] && (
            <div className="dp-variation">
              <span className="dp-bold">Color: </span>Pink
              <br />
              <span className="dp-swatch on">
                <img src={images[0]} alt="" />
              </span>
            </div>
          )}
          <div className="dp-about">
            <h1>About this item</h1>
            <ul>
              {(bullets.length
                ? bullets
                : ['Bullet points come from the listing (Listings Items API attributes.bullet_point)']
              ).map((b, i) => (
                <li key={i}>{b}</li>
              ))}
            </ul>
            <div style={{ marginTop: 8 }}>
              <a className="dp-more">See more product details</a>
            </div>
          </div>
        </div>

        <div className="dp-right">
          <div className="dp-buybox" data-fixture="delivery">
            <div>
              <Price value={item?.price} />
            </div>
            <div className="dp-delivery">
              <a>FREE delivery</a> <b>{deliveryDate}</b> on orders shipped by Amazon over $35
            </div>
            <div className="dp-delivery">
              Or fastest delivery <b>{fastDate}</b>. Order within{' '}
              <span style={{ color: '#007600' }}>5 hrs 12 mins</span>
            </div>
            <div className="dp-deliver-to">
              <svg viewBox="0 0 12 14" fill="none" stroke="#565959" strokeWidth="1.4">
                <path d="M6 13s4.5-4.6 4.5-7.5A4.5 4.5 0 0 0 1.5 5.5C1.5 8.4 6 13 6 13z" />
                <circle cx="6" cy="5.5" r="1.6" />
              </svg>
              <a>Deliver to Seattle 98101</a>
            </div>
            <div className="dp-avail">In Stock</div>
            <div>
              <span className="dp-qty">Quantity: 1</span>
            </div>
            <button type="button" className="dp-btn dp-btn-cart">
              Add to Cart
            </button>
            <button type="button" className="dp-btn dp-btn-buy">
              Buy Now
            </button>
            <table>
              <tbody>
                <tr>
                  <td>Ships from</td>
                  <td>{vendor ? 'Amazon.com' : 'Amazon'}</td>
                </tr>
                <tr>
                  <td>Sold by</td>
                  <td>
                    <a>{vendor ? 'Amazon.com' : brand || 'Seller name'}</a>
                  </td>
                </tr>
                <tr>
                  <td>Returns</td>
                  <td>
                    <a>30-day refund/replacement</a>
                  </td>
                </tr>
                <tr>
                  <td>Payment</td>
                  <td>
                    <span className="dp-secure">
                      <svg viewBox="0 0 10 12" fill="#565959">
                        <rect x="1" y="5" width="8" height="7" rx="1" />
                        <path d="M3 5V3.5a2 2 0 0 1 4 0V5" fill="none" stroke="#565959" strokeWidth="1.2" />
                      </svg>
                      <a>Secure transaction</a>
                    </span>
                  </td>
                </tr>
              </tbody>
            </table>
            <button type="button" className="dp-btn dp-btn-list">
              Add to List
            </button>
          </div>
        </div>
      </div>

      {/* ---- From the brand */}
      {brandStory.length > 0 && (
        <div className="dp-bucket" id="aplusBrandStory_feature_div">
          <div className="a-section a-spacing-large bucket">
            <hr className="bucketDivider" />
            <h2>From the brand</h2>
            <BrandStory modules={brandStory} brand={brand} />
          </div>
        </div>
      )}

      {/* ---- A+ slot: "Product description" (seller) or "From the manufacturer" (vendor); a Brand Story document only feeds "From the brand" */}
      {(manufacturer.length > 0 || edited === 'aplus') && (
        <div className="dp-bucket dp-bucket-manufacturer" id="aplus_feature_div">
          <div className="a-section a-spacing-large bucket" id="aplus">
            <hr className="bucketDivider" />
            <h2>{aplusHeading}</h2>
            {manufacturer.length > 0 ? (
              <AplusContent modules={manufacturer} />
            ) : (
              <div className="dp-empty-aplus">Add modules in the editor to see them here.</div>
            )}
          </div>
        </div>
      )}

      {/* ---- Product description (plain text): kept by vendors, replaced by a seller's A+ */}
      {item?.description && !sellerAplus && (
        <div className="dp-bucket" id="productDescription_feature_div">
          <hr className="bucketDivider" />
          <h2>Product Description</h2>
          <div id="productDescription">
            {item.description.split(/\n+/).map((p, i) => (
              <p key={i}>{p}</p>
            ))}
          </div>
        </div>
      )}

      {/* ---- Product information */}
      <div className="dp-bucket" id="productDetails_feature_div">
        <hr className="bucketDivider" />
        <h2>Product information</h2>
        <div className="dp-prodinfo">
          <div>
            <h3>Product details</h3>
            <table>
              <tbody>
                <tr>
                  <th>Brand</th>
                  <td>{brand ?? '—'}</td>
                </tr>
                <tr>
                  <th>Item model number</th>
                  <td>—</td>
                </tr>
                <tr>
                  <th>Department</th>
                  <td>Womens</td>
                </tr>
                <tr>
                  <th>Date First Available</th>
                  <td>—</td>
                </tr>
              </tbody>
            </table>
          </div>
          <div>
            <h3>Additional Information</h3>
            <table>
              <tbody>
                <tr>
                  <th>ASIN</th>
                  <td>{asin || item?.asin || '—'}</td>
                </tr>
                <tr>
                  <th>Customer Reviews</th>
                  <td data-fixture="ratings">
                    <Stars value={4.3} /> 4.3 out of 5 stars <a>1,234 ratings</a>
                  </td>
                </tr>
                <tr>
                  <th>Best Sellers Rank</th>
                  <td data-fixture="rank">#12,345 in Clothing, Shoes &amp; Jewelry</td>
                </tr>
                <tr>
                  <th>A+ content</th>
                  <td>{aplusSummary || '—'}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* ---- footer */}
      <a className="dp-backtotop">Back to top</a>
      <footer className="dp-footer">
        <div className="dp-footer-cols">
          <div>
            <h4>Get to Know Us</h4>
            <a>Careers</a>
            <a>Amazon Newsletter</a>
            <a>About Amazon</a>
            <a>Accessibility</a>
            <a>Sustainability</a>
          </div>
          <div>
            <h4>Make Money with Us</h4>
            <a>Sell on Amazon</a>
            <a>Sell apps on Amazon</a>
            <a>Supply to Amazon</a>
            <a>Become an Affiliate</a>
            <a>Advertise Your Products</a>
          </div>
          <div>
            <h4>Amazon Payment Products</h4>
            <a>Amazon Visa</a>
            <a>Amazon Store Card</a>
            <a>Amazon Secured Card</a>
            <a>Shop with Points</a>
            <a>Reload Your Balance</a>
          </div>
          <div>
            <h4>Let Us Help You</h4>
            <a>Your Account</a>
            <a>Your Orders</a>
            <a>Shipping Rates &amp; Policies</a>
            <a>Returns &amp; Replacements</a>
            <a>Help</a>
          </div>
        </div>
        <div className="dp-footer-logo">
          <Logo />
        </div>
      </footer>
    </div>
  );
}
