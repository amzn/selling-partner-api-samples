// A+ Content Manager, API server. Same /api surface in both modes:
//   MODE=live  -> forwards to SP-API with server-side LWA (default)
//   MODE=mock  -> in-memory sample account, no credentials needed
// Binds to 127.0.0.1 only: this is a local developer tool, not a hosted service, and it has no
// authentication of its own. Put it behind your own auth before exposing it anywhere else.
import express from 'express';
import multer from 'multer';
import { createHash } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { mock } from './mock.js';
import { marketplaceId, postToUploadDestination, spapi } from './spapi.js';

const here = dirname(fileURLToPath(import.meta.url));
// Load sample-solution/.env (see .env.example) without a dependency; real environment variables win.
const envFile = join(here, '..', '..', '.env');
if (existsSync(envFile)) {
  for (const line of readFileSync(envFile, 'utf8').split('\n')) {
    const m = /^\s*(?:export\s+)?([A-Z0-9_]+)\s*=\s*(.*?)\s*$/.exec(line);
    if (m && !line.trimStart().startsWith('#') && process.env[m[1]] === undefined)
      process.env[m[1]] = m[2].replace(/^(['"])(.*)\1$/, '$2');
  }
}
const MODE = process.env.MODE === 'mock' ? 'mock' : 'live';
const PORT = Number(process.env.PORT || 8787);
const MKT = marketplaceId();
const app = express();
app.use(express.json({ limit: '2mb' }));
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });

/** Send an SP-API style result {status, headers, body} through, adding rate-limit info for the UI. */
const send = (res, r) => {
  if (r.headers?.rateLimit) res.set('x-amzn-RateLimit-Limit', r.headers.rateLimit);
  if (r.headers?.requestId) res.set('x-amzn-RequestId', r.headers.requestId);
  res.status(r.status).json(r.body);
};
const wrap = (fn) => async (req, res) => {
  try {
    send(res, await fn(req, res));
  } catch (e) {
    res.status(e.status || 500).json({ errors: [{ code: 'ProxyError', message: e.message, details: '' }] });
  }
};

/** A route parameter that travels in an SP-API request path, as one path segment. Express decodes %2F in a
 *  parameter, so a raw `a%2F..%2Fb` would arrive as `a/../b` and move the call to another operation, carrying
 *  the access token with it; encoding keeps the value inside its own segment. */
const seg = (value) => encodeURIComponent(value);

const SELLER_ID = process.env.SP_API_SELLER_ID || '';
// seller (default) or vendor: decides EBC vs EMC for new documents and how the preview renders the page
const ACCOUNT_TYPE = process.env.SP_API_ACCOUNT_TYPE === 'vendor' ? 'vendor' : 'seller';
// Live mode needs the LWA triple plus the selling partner id: the Listings Items API takes it in its path and no
// SP-API operation returns it, so a partial configuration would only fail later, on the first listings call.
if (MODE === 'live') {
  const REQUIRED = ['LWA_CLIENT_ID', 'LWA_CLIENT_SECRET', 'LWA_REFRESH_TOKEN', 'SP_API_SELLER_ID'];
  const missing = REQUIRED.filter((k) => !process.env[k]);
  if (missing.length) {
    console.error(
      `Live mode needs ${REQUIRED.join(', ')} in the environment (see .env.example). Missing: ${missing.join(', ')}. Run "npm run dev:mock" to use sample data instead.`,
    );
    process.exit(1);
  }
}
app.get('/api/config', (_req, res) =>
  res.json({
    mode: MODE,
    marketplaceId: MKT,
    endpoint: process.env.SPAPI_ENDPOINT || 'https://sellingpartnerapi-na.amazon.com',
    listings: true,
    accountType: ACCOUNT_TYPE,
  }),
);

// ---- Discovery: Listings Items API + an A+ status index ---------------------------------------------
// Workflow: search the seller's listings -> see which ASINs already carry A+ content (and which do not) -> pick one.
// searchListingsItems needs the selling partner's seller id (SP_API_SELLER_ID; Seller Central > Account Info), which
// no other operation returns. The A+ index is built from searchContentDocuments + listContentDocumentAsinRelations,
// one call per document, and cached for a minute: searchContentPublishRecords is per ASIN and would cost one call per listing.
app.get(
  '/api/listings',
  wrap((req) => {
    const { keywords = '', pageToken, pageSize = 20 } = req.query;
    if (MODE === 'mock') return mock.searchListingsItems({ keywords, pageSize });
    const query = { marketplaceIds: [MKT], includedData: ['summaries'], pageSize };
    if (keywords) query.keywords = keywords;
    if (pageToken) query.pageToken = pageToken;
    return spapi('GET', `/listings/2021-08-01/items/${SELLER_ID}`, { query });
  }),
);

let indexCache = { at: 0, body: null };
app.get(
  '/api/aplus-index',
  wrap(async (req) => {
    if (MODE === 'mock') return mock.aplusIndex();
    if (indexCache.body && Date.now() - indexCache.at < 60_000 && !req.query.refresh)
      return { status: 200, body: indexCache.body };
    const docs = await spapi('GET', '/aplus/2020-11-01/contentDocuments', { query: { marketplaceId: MKT } });
    if (docs.status >= 300) return docs;
    const index = {};
    for (const rec of docs.body.contentMetadataRecords || []) {
      const rel = await spapi('GET', `/aplus/2020-11-01/contentDocuments/${rec.contentReferenceKey}/asins`, {
        query: { marketplaceId: MKT, includedDataSet: ['METADATA'] },
      });
      if (rel.status >= 300) continue;
      const md = rec.contentMetadata;
      // badgeSet on the document tells the tier; contentType is EBC/EMC for both Standard and Premium
      const tier = md.badgeSet?.includes('PREMIUM')
        ? 'premium'
        : md.badgeSet?.includes('STANDARD')
          ? 'standard'
          : 'brandStory';
      for (const a of rel.body.asinMetadataSet || []) {
        const e = (index[a.asin] ||= { published: {}, attached: [] });
        const entry = { contentReferenceKey: rec.contentReferenceKey, name: md.name, status: md.status, tier };
        if (a.badgeSet?.includes('CONTENT_PUBLISHED')) e.published[tier] = entry;
        else e.attached.push(entry);
      }
    }
    indexCache = { at: Date.now(), body: { index } };
    return { status: 200, body: indexCache.body };
  }),
);

// ---- A+ Content Management API -------------------------------------------------------------
app.get(
  '/api/documents',
  wrap(() =>
    MODE === 'mock'
      ? mock.searchContentDocuments()
      : spapi('GET', '/aplus/2020-11-01/contentDocuments', { query: { marketplaceId: MKT } }),
  ),
);

app.get(
  '/api/documents/:crk',
  wrap((req) => {
    const included = String(req.query.includedDataSet || 'CONTENTS,METADATA').split(',');
    return MODE === 'mock'
      ? mock.getContentDocument(req.params.crk, included)
      : spapi('GET', `/aplus/2020-11-01/contentDocuments/${seg(req.params.crk)}`, {
          query: { marketplaceId: MKT, includedDataSet: included },
        });
  }),
);

// dry run: body = { contentDocument, asinSet } ; asinSet travels as a csv QUERY parameter to SP-API
app.post(
  '/api/documents/validate',
  wrap((req) => {
    const { contentDocument, asinSet = [] } = req.body;
    return MODE === 'mock'
      ? mock.validate(contentDocument, asinSet)
      : spapi('POST', '/aplus/2020-11-01/contentAsinValidations', {
          query: { marketplaceId: MKT, asinSet },
          body: { contentDocument },
        });
  }),
);

app.post(
  '/api/documents',
  wrap((req) =>
    MODE === 'mock'
      ? mock.createContentDocument(req.body.contentDocument)
      : spapi('POST', '/aplus/2020-11-01/contentDocuments', {
          query: { marketplaceId: MKT },
          body: { contentDocument: req.body.contentDocument },
        }),
  ),
);

app.post(
  '/api/documents/:crk',
  wrap((req) =>
    MODE === 'mock'
      ? mock.updateContentDocument(req.params.crk, req.body.contentDocument)
      : spapi('POST', `/aplus/2020-11-01/contentDocuments/${seg(req.params.crk)}`, {
          query: { marketplaceId: MKT },
          body: { contentDocument: req.body.contentDocument },
        }),
  ),
);

app.get(
  '/api/documents/:crk/asins',
  wrap((req) =>
    MODE === 'mock'
      ? mock.listAsinRelations(req.params.crk)
      : spapi('GET', `/aplus/2020-11-01/contentDocuments/${seg(req.params.crk)}/asins`, {
          query: { marketplaceId: MKT, includedDataSet: ['METADATA'] },
        }),
  ),
);

app.post(
  '/api/documents/:crk/asins',
  wrap((req) =>
    MODE === 'mock'
      ? mock.postAsinRelations(req.params.crk, req.body.asinSet || [])
      : spapi('POST', `/aplus/2020-11-01/contentDocuments/${seg(req.params.crk)}/asins`, {
          query: { marketplaceId: MKT },
          body: { asinSet: req.body.asinSet || [] },
        }),
  ),
);

app.post(
  '/api/documents/:crk/submit',
  wrap((req) =>
    MODE === 'mock'
      ? mock.submit(req.params.crk)
      : spapi('POST', `/aplus/2020-11-01/contentDocuments/${seg(req.params.crk)}/approvalSubmissions`, {
          query: { marketplaceId: MKT },
        }),
  ),
);

app.post(
  '/api/documents/:crk/suspend',
  wrap((req) =>
    MODE === 'mock'
      ? mock.suspend(req.params.crk)
      : spapi('POST', `/aplus/2020-11-01/contentDocuments/${seg(req.params.crk)}/suspendSubmissions`, {
          query: { marketplaceId: MKT },
        }),
  ),
);

app.get(
  '/api/publish-records',
  wrap((req) =>
    MODE === 'mock'
      ? mock.publishRecords(req.query.asin)
      : spapi('GET', '/aplus/2020-11-01/contentPublishRecords', {
          query: { marketplaceId: MKT, asin: req.query.asin },
        }),
  ),
);

// ---- Uploads API: create destination + push bytes, return the uploadDestinationId --------------
app.post(
  '/api/uploads',
  upload.single('file'),
  wrap(async (req) => {
    const file = req.file;
    if (!file)
      return { status: 400, body: { errors: [{ code: 'InvalidInput', message: 'file is required', details: '' }] } };
    const contentType = file.mimetype === 'image/png' ? 'image/png' : 'image/jpeg';
    if (MODE === 'mock') return mock.createUploadDestination(file.originalname, contentType, file.buffer);
    const md5 = createHash('md5').update(file.buffer).digest('base64');
    const dest = await spapi('POST', '/uploads/2020-11-01/uploadDestinations/aplus/2020-11-01/contentDocuments', {
      query: { marketplaceIds: [MKT], contentMD5: md5, contentType },
    });
    if (dest.status >= 300) return dest;
    await postToUploadDestination(dest.body.payload.url, file.buffer, file.originalname, contentType);
    return { status: 201, body: { payload: { uploadDestinationId: dest.body.payload.uploadDestinationId } } };
  }),
);

const escapeXml = (s) =>
  s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' })[c]);
// Serve uploaded images back for the preview (mock keeps bytes in memory or on disk for the fixture
// documents; live images are not readable by the browser until published)
app.get('/api/uploads/:id(*)', (req, res) => {
  if (MODE !== 'mock') return res.status(404).end();
  const img = mock.uploadedImage(req.params.id);
  if (img) return res.type(img.contentType).send(img.bytes);
  // unknown upload ids (for example pasted from another account) get a placeholder so the preview stays readable
  const hue = [...req.params.id].reduce((n, ch) => (n * 31 + ch.charCodeAt(0)) % 360, 0);
  const w = Number(req.query.w) || 1464,
    h = Number(req.query.h) || 600;
  // the id is caller-controlled and SVG can carry script: escape it before it lands in the document
  const label = escapeXml(req.params.id.slice(0, 48));
  res
    .type('image/svg+xml')
    .send(
      `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 1464 600" preserveAspectRatio="xMidYMid slice"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="hsl(${hue},35%,28%)"/><stop offset="1" stop-color="hsl(${(hue + 40) % 360},45%,48%)"/></linearGradient></defs><rect width="1464" height="600" fill="url(#g)"/><text x="1440" y="580" font-family="Arial" font-size="22" fill="rgba(255,255,255,.55)" text-anchor="end">${label}</text></svg>`,
    );
});

// ---- Media API: video + thumbnail in, unified Media object out ----------------------------------------
// Mock mode registers both files in memory (mock.createMedia). Live mode is deliberately not wired: the real
// flow is createUploadDestinationForResource + createMedia(mediaType VIDEO, VIDEO_PAIRING to the thumbnail) and
// the video is then only viewable on the published page, so this sample asks for the ids instead.
const mediaUpload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 100 * 1024 * 1024 } });
app.post(
  '/api/media',
  mediaUpload.fields([
    { name: 'video', maxCount: 1 },
    { name: 'thumbnail', maxCount: 1 },
  ]),
  wrap(async (req) => {
    const video = req.files?.video?.[0],
      thumbnail = req.files?.thumbnail?.[0];
    if (!video || !thumbnail)
      return {
        status: 400,
        body: { errors: [{ code: 'InvalidInput', message: 'video and thumbnail files are required', details: '' }] },
      };
    if (MODE !== 'mock')
      return {
        status: 501,
        body: {
          errors: [
            {
              code: 'NotImplemented',
              message:
                'Video upload is available in mock mode only. In live mode create the media with the Media API (createMedia) and paste the video and thumbnail media ids.',
              details: '',
            },
          ],
        },
      };
    const asFile = (f) => ({ bytes: f.buffer, contentType: f.mimetype, fileName: f.originalname });
    return mock.createMedia(asFile(video), asFile(thumbnail));
  }),
);

// Poster frame for a Media API asset (video thumbnail) so video modules preview with a real still, and the
// clip itself so the preview can play it. Live media is only viewable through the published detail page,
// so both exist in mock mode only.
app.get('/api/media/:id/poster', (req, res) => {
  const img = MODE === 'mock' ? mock.mediaPoster(req.params.id) : null;
  if (!img) return res.status(404).end();
  res.type(img.contentType).send(img.bytes);
});
app.get('/api/media/:id/video', (req, res) => {
  const v = MODE === 'mock' ? mock.mediaVideo(req.params.id) : null;
  if (!v) return res.status(404).end();
  res.type(v.contentType).set('Accept-Ranges', 'bytes').send(v.bytes);
});

// Module gallery: one ready-made document per module type (all 39), used by the "Load example"
// button in the editor and by tools/gallery.cjs for the per-module screenshots.
const galleryFile = join(here, '..', 'mock', 'fixtures', 'gallery.json');
app.get('/api/gallery', (_req, res) => res.sendFile(galleryFile));
// Whole-document templates (Premium, Standard, Brand Story) for "start with sample content" in the editor.
app.get('/api/templates', (_req, res) => res.sendFile(join(here, '..', 'mock', 'fixtures', 'documents.json')));

// ---- One listing by ASIN: title, images, bullets and description for the product card and the preview ------
// searchListingsItems with identifiers/identifiersType=ASIN finds the account's own listing for the ASIN; the
// summaries carry the name and main image, the attributes the bullets, description, price and image locators.
// An ASIN the account does not sell is simply not found: this app only works on the selling partner's listings.
app.get(
  '/api/listings/:asin',
  wrap(async (req) => {
    const asin = req.params.asin.toUpperCase();
    if (MODE === 'mock') return mock.listingItem(asin);
    const r = await spapi('GET', `/listings/2021-08-01/items/${SELLER_ID}`, {
      query: {
        marketplaceIds: [MKT],
        identifiers: [asin],
        identifiersType: 'ASIN',
        includedData: ['summaries', 'attributes'],
        pageSize: 1,
      },
    });
    if (r.status >= 300) return r;
    const item = r.body.items?.[0];
    if (!item)
      return {
        status: 404,
        body: {
          errors: [
            {
              code: 'NOT_FOUND',
              message: `No listing with ASIN ${asin} in this account for marketplace ${MKT}.`,
              details: '',
            },
          ],
        },
      };
    const s = item.summaries?.find((x) => x.marketplaceId === MKT) || item.summaries?.[0] || {};
    const a = item.attributes || {};
    const first = (name) => a[name]?.find((v) => !v.marketplace_id || v.marketplace_id === MKT) || a[name]?.[0];
    const locators = [
      'main_product_image_locator',
      ...Array.from({ length: 8 }, (_, i) => `other_product_image_locator_${i + 1}`),
    ];
    const images = locators.map((n) => first(n)?.media_location).filter(Boolean);
    const bullets = (a.bullet_point || [])
      .map((b) => b.value)
      .filter(Boolean)
      .slice(0, 5);
    const lp = first('list_price');
    const price =
      lp?.value != null
        ? lp.currency === 'USD'
          ? `$${Number(lp.value).toFixed(2)}`
          : `${lp.value} ${lp.currency ?? ''}`.trim()
        : null;
    return {
      status: 200,
      body: {
        asin,
        sku: item.sku,
        title: s.itemName,
        brand: first('brand')?.value,
        imageUrl: s.mainImage?.link ?? images[0],
        images: images.length ? images : s.mainImage?.link ? [s.mainImage.link] : [],
        bullets,
        description: first('product_description')?.value,
        price,
      },
    };
  }),
);

if (MODE === 'mock')
  app.post('/api/mock/reset', (_req, res) => {
    mock.reset();
    res.status(204).end();
  });

// ---- Optional fonts for the detail-page simulation ----------------------------------------------
// amazon.com renders in Amazon Ember, which is not part of this repository. If you have the TTFs, point
// FONTS_DIR at their folder and /fonts/fonts.css declares them; otherwise the stylesheet is empty and
// the page falls back to Arial, as amazon.com itself does without the web font.
const fontsDir = process.env.FONTS_DIR || join(here, '..', '..', 'fonts');
const FONT_FACES = [
  ['AmazonEmber_Rg.ttf', 400, 'normal'],
  ['AmazonEmber_Bd.ttf', 700, 'normal'],
  ['AmazonEmber_Lt.ttf', 300, 'normal'],
  ['AmazonEmber_Md.ttf', 500, 'normal'],
];
app.get('/fonts/fonts.css', (_req, res) => {
  const css = FONT_FACES.filter(([f]) => existsSync(join(fontsDir, f)))
    .map(
      ([f, w, s]) =>
        `@font-face{font-family:"Amazon Ember";src:url(/fonts/${f}) format("truetype");font-weight:${w};font-style:${s};font-display:swap;}`,
    )
    .join('\n');
  res.type('text/css').send(css);
});
if (existsSync(fontsDir)) app.use('/fonts', express.static(fontsDir));

// ---- Static client (after `npm run build`) ------------------------------------------------------
const dist = join(here, '..', '..', 'client', 'dist');
if (existsSync(dist)) {
  app.use(express.static(dist));
  // The shell is read once, at startup: restart the server after rebuilding the client.
  const shell = readFileSync(join(dist, 'index.html'), 'utf8');
  app.get('*', (req, res) => {
    // an unknown API path is an error in the errors[] envelope, not the SPA shell with a 200
    if (req.path.startsWith('/api/'))
      return res.status(404).json({ errors: [{ code: 'NotFound', message: `No route ${req.path}`, details: '' }] });
    res.type('html').send(shell);
  });
}

// Errors thrown by middleware before a route body runs (multer's 10 MB limit, a malformed JSON body) would
// otherwise come back as Express's HTML error page; the client expects the same { errors: [...] } envelope.
app.use((err, _req, res, _next) => {
  const status = err.code === 'LIMIT_FILE_SIZE' ? 413 : err.status || err.statusCode || 500;
  res
    .status(status)
    .json({ errors: [{ code: err.code || err.type || 'InternalError', message: err.message, details: '' }] });
});

app.listen(PORT, '127.0.0.1', () => console.log(`A+ Content Manager server (${MODE}) on http://127.0.0.1:${PORT}`));
