// Offline stand-in for the A+ Content, Uploads, Media and Listings Items operations the app uses.
// The sample account is a small apparel brand with four listings and four A+ documents
// (server/mock/fixtures + server/mock/seed.json). The service reproduces the API's behaviour:
//   - validation: structure errors -> 400 InvalidInput (one per failing field), ASIN problems -> warnings in a 200
//   - postContentDocumentAsinRelations is permissive (200, no warning) and resets APPROVED -> DRAFT
//   - ASINs outside the brand show BRAND_NOT_ELIGIBLE on the relations list and fail submission with 403 Unauthorized
//   - one published document per ASIN *and content family*: an EBC (Standard or Premium) document and a
//     Brand Story document can both be live on the same ASIN; within a family the last approved document wins
//   - Brand Story is refused at create unless the seller is enrolled in Brand Registry (MOCK_BRAND_REGISTRY=not_enrolled)
//   - approval is immediate
import { existsSync, readFileSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { validateDocument } from './validate.js';

const here = dirname(fileURLToPath(import.meta.url));
const mockDir = join(here, '..', 'mock');
const seed = JSON.parse(readFileSync(join(mockDir, 'seed.json'), 'utf8'));
const catalog = JSON.parse(readFileSync(join(mockDir, 'catalog.json'), 'utf8'));
const fixtures = JSON.parse(readFileSync(join(mockDir, 'fixtures', 'documents.json'), 'utf8'));
const fixtureUploads = JSON.parse(readFileSync(join(mockDir, 'fixtures', 'uploads.json'), 'utf8'));
const listings = JSON.parse(readFileSync(join(mockDir, 'listings.json'), 'utf8'));
const imagesDir = join(mockDir, 'fixtures', 'images');

// The three fixture documents are seeded APPROVED and published, with stable keys so the UI and tests can refer
// to them: Premium and Brand Story on the pink tee, Standard and Brand Story on the white tee. The grey tee has
// no A+ content and the navy tee has a draft attached (seed.json).
const FIXTURE_KEYS = {
  premium: '5e1f2a3b-7c8d-4e9f-a0b1-c2d3e4f5a601',
  standard: '5e1f2a3b-7c8d-4e9f-a0b1-c2d3e4f5a602',
  brandstory: '5e1f2a3b-7c8d-4e9f-a0b1-c2d3e4f5a603',
};
const FIXTURE_ASINS = { premium: ['B0SAMPLE01'], standard: ['B0SAMPLE02'], brandstory: ['B0SAMPLE01', 'B0SAMPLE02'] };
const SEED_TIME = '2025-06-01T09:00:00.000Z';
// Media ids the fixture documents reference (hero video, its thumbnail, carousel clip): poster and clip come from fixtures/images
const FIXTURE_MEDIA = new Set([
  '5e1f2a3b-7c8d-4e9f-a0b1-c2d3e4f5b001',
  '5e1f2a3b-7c8d-4e9f-a0b1-c2d3e4f5b002',
  '5e1f2a3b-7c8d-4e9f-a0b1-c2d3e4f5b003',
]);
// SP_API_ACCOUNT_TYPE=vendor turns the sample account into a vendor: its A+ documents are EMC instead of EBC
const APLUS_TYPE = process.env.SP_API_ACCOUNT_TYPE === 'vendor' ? 'EMC' : 'EBC';
// Standard documents are limited to seven modules, checked when the document is submitted for approval.
const MAX_STANDARD_MODULES = 7;
const asAccount = (doc) => (doc.contentType === 'BrandStory' ? doc : { ...doc, contentType: APLUS_TYPE });
const family = (doc) => (doc.contentType === 'BrandStory' ? 'BrandStory' : 'EBC');
const tierBadge = (doc) =>
  doc.contentType === 'BrandStory'
    ? []
    : doc.contentModuleList?.[0]?.contentModuleType?.startsWith('PREMIUM')
      ? ['PREMIUM']
      : ['STANDARD'];

function initialState() {
  const documents = structuredClone(seed.documents);
  for (const d of Object.values(documents)) if (d.contentDocument) d.contentDocument = asAccount(d.contentDocument);
  const published = {};
  for (const [asin, v] of Object.entries(seed.published))
    published[asin] = typeof v === 'string' ? { EBC: v } : { ...v };
  for (const [name, doc] of Object.entries(fixtures)) {
    const crk = FIXTURE_KEYS[name];
    documents[crk] = {
      contentReferenceKey: crk,
      contentMetadata: {
        name: doc.name,
        marketplaceId: 'ATVPDKIKX0DER',
        status: 'APPROVED',
        badgeSet: tierBadge(doc),
        updateTime: SEED_TIME,
      },
      contentDocument: asAccount(structuredClone(doc)),
      asinSet: [...FIXTURE_ASINS[name]],
    };
    for (const asin of FIXTURE_ASINS[name]) (published[asin] ||= {})[family(doc)] = crk;
  }
  return {
    documents,
    published,
    uploads: new Map(),
    media: new Map(),
    brandRegistry: process.env.MOCK_BRAND_REGISTRY === 'not_enrolled' ? 'not_enrolled' : 'enrolled',
  };
}

let state = initialState();

const now = () => new Date().toISOString();
const notFound = () => ({
  status: 404,
  body: {
    errors: [
      {
        code: 'NOT_FOUND',
        message: "Could not find this project. It either doesn't exist (invalid project ID) or may have been deleted.",
        details: '',
      },
      { code: 'NOT_FOUND', message: 'ProjectId and Revision not found', details: '' },
    ],
  },
});
const ok = (body) => ({
  status: 200,
  headers: { rateLimit: '5.0', requestId: randomUUID() },
  body: { warnings: [], ...body },
});
const isPublished = (asin, crk) => Object.values(state.published[asin] || {}).includes(crk);
const asinBadges = (doc, asin) => {
  const item = catalog[asin];
  const out = [isPublished(asin, doc.contentReferenceKey) ? 'CONTENT_PUBLISHED' : 'CONTENT_NOT_PUBLISHED'];
  if (!item) out.push('CATALOG_NOT_FOUND');
  else if (item.brandNotEligible) out.push('BRAND_NOT_ELIGIBLE');
  return out;
};
const fileToUploadId = Object.fromEntries(Object.entries(fixtureUploads).map(([id, f]) => [f, id]));
const catalogImages = (item) =>
  (item?.fixtureImages || []).filter((f) => fileToUploadId[f]).map((f) => `/api/uploads/${fileToUploadId[f]}`);
const asinMetadata = (doc, asin) => ({
  asin,
  badgeSet: asinBadges(doc, asin),
  parent: asin,
  title: catalog[asin]?.title ?? null,
  imageUrl: catalogImages(catalog[asin])[0] ?? catalog[asin]?.imageUrl ?? null,
  contentReferenceKeySet: null,
});
const ineligibleWarnings = (asins) =>
  asins
    .filter((a) => !catalog[a] || catalog[a].brandNotEligible)
    .map((a) => ({
      code: 'ASIN_FAILED_VALIDATION',
      message:
        'You are unable to add content to this ASIN because our system does not recognize this ASIN as part of your brand.',
      details: a,
    }));

const fileCache = new Map();
const fixtureFile = (file, contentType) => {
  if (!fileCache.has(file)) {
    const p = join(imagesDir, file);
    fileCache.set(
      file,
      existsSync(p)
        ? {
            bytes: readFileSync(p),
            contentType: contentType || (file.endsWith('.png') ? 'image/png' : 'image/jpeg'),
            fileName: file,
          }
        : null,
    );
  }
  return fileCache.get(file);
};

export const mock = {
  mode: 'mock',
  fixtureKeys: FIXTURE_KEYS,

  /** Test hook: brandRegistry 'enrolled' | 'not_enrolled'. */
  configure(opts) {
    Object.assign(state, opts);
  },

  searchContentDocuments() {
    return ok({
      nextPageToken: null,
      contentMetadataRecords: Object.values(state.documents).map((d) => ({
        contentReferenceKey: d.contentReferenceKey,
        contentMetadata: d.contentMetadata,
      })),
    });
  },

  getContentDocument(crk, includedDataSet) {
    const doc = state.documents[crk];
    if (!doc) return notFound();
    const want = new Set(includedDataSet);
    return ok({
      contentRecord: {
        contentReferenceKey: crk,
        contentMetadata: want.has('METADATA') ? doc.contentMetadata : null,
        contentDocument: want.has('CONTENTS') ? doc.contentDocument : null,
      },
    });
  },

  validate(document, asinSet) {
    const errors = validateDocument(document);
    if (errors.length) return { status: 400, headers: { rateLimit: '5.0' }, body: { errors } };
    const missingUpload = (document.contentModuleList || []).some((m) =>
      JSON.stringify(m).includes('"uploadDestinationId":"missing'),
    );
    if (missingUpload) {
      return ok({
        errors: [
          {
            code: 'CONTENT_FAILED_VALIDATION',
            message:
              "We can't read one of the images that you uploaded. Please save the image in PNG format and upload again. See image: Asset access forbidden: Unable to validate project due to inaccessible media assets.",
            details: '',
          },
        ],
      });
    }
    return ok({ warnings: ineligibleWarnings(asinSet || []), errors: [] });
  },

  createContentDocument(document) {
    const errors = validateDocument(document);
    if (errors.length) return { status: 400, body: { errors } };
    if (document.contentType === 'BrandStory' && state.brandRegistry !== 'enrolled') {
      return {
        status: 400,
        body: {
          errors: [
            {
              code: 'InvalidInput',
              message: `User [${listings.sellerId}] shouldn't be using project type: [BrandStory]`,
              details: '',
            },
          ],
        },
      };
    }
    const crk = randomUUID();
    state.documents[crk] = {
      contentReferenceKey: crk,
      contentMetadata: {
        name: document.name,
        marketplaceId: 'ATVPDKIKX0DER',
        status: 'DRAFT',
        badgeSet: tierBadge(document),
        updateTime: now(),
      },
      contentDocument: document,
      asinSet: [],
    };
    return ok({ contentReferenceKey: crk });
  },

  updateContentDocument(crk, document) {
    const doc = state.documents[crk];
    if (!doc) return notFound();
    const errors = validateDocument(document);
    if (errors.length) return { status: 400, body: { errors } };
    doc.contentDocument = document;
    doc.contentMetadata = {
      ...doc.contentMetadata,
      name: document.name,
      status: 'DRAFT',
      badgeSet: tierBadge(document),
      updateTime: now(),
    };
    return ok({ contentReferenceKey: crk });
  },

  listAsinRelations(crk) {
    const doc = state.documents[crk];
    if (!doc) return notFound();
    return ok({
      warnings: ineligibleWarnings(doc.asinSet),
      nextPageToken: null,
      asinMetadataSet: doc.asinSet.map((a) => asinMetadata(doc, a)),
    });
  },

  postAsinRelations(crk, asinSet) {
    const doc = state.documents[crk];
    if (!doc) return notFound();
    doc.asinSet = [...new Set(asinSet)]; // full replacement, anything accepted
    if (doc.contentMetadata.status === 'APPROVED')
      doc.contentMetadata = { ...doc.contentMetadata, status: 'DRAFT', updateTime: now() };
    return ok({});
  },

  submit(crk) {
    const doc = state.documents[crk];
    if (!doc) return notFound();
    const bad = doc.asinSet.filter((a) => !catalog[a] || catalog[a].brandNotEligible);
    if (bad.length) {
      return {
        status: 403,
        body: {
          errors: [
            {
              code: 'Unauthorized',
              message:
                'You are unable to add content to this ASIN because our system does not recognize this ASIN as part of your brand.',
              details: '',
            },
            { code: 'Unauthorized', message: 'Failed asin permissions check.', details: '' },
          ],
        },
      };
    }
    // The module limit of a Standard document is applied here, at submission: validate, create and update accept a
    // Standard list of any length (they only cap a list that holds a Premium module), so an eight-module Standard
    // draft saves fine and is refused when submitted. Premium lists never get this far with more than seven.
    if (
      tierBadge(doc.contentDocument).includes('STANDARD') &&
      doc.contentDocument.contentModuleList.length > MAX_STANDARD_MODULES
    ) {
      return {
        status: 403,
        body: {
          errors: [
            {
              code: 'Unauthorized',
              message: `This A+ content type cannot have more than ${MAX_STANDARD_MODULES} modules.`,
              details: '',
            },
          ],
        },
      };
    }
    doc.contentMetadata = { ...doc.contentMetadata, status: 'APPROVED', updateTime: now() };
    const fam = family(doc.contentDocument);
    for (const a of doc.asinSet) (state.published[a] ||= {})[fam] = crk; // last approved document of the family wins
    return ok({});
  },

  suspend(crk) {
    const doc = state.documents[crk];
    if (!doc) return notFound();
    for (const [a, fams] of Object.entries(state.published))
      for (const [f, k] of Object.entries(fams)) if (k === crk) delete state.published[a][f];
    doc.contentMetadata = { ...doc.contentMetadata, status: 'DRAFT', updateTime: now() };
    return ok({});
  },

  publishRecords(asin) {
    const list = [];
    for (const [a, fams] of Object.entries(state.published)) {
      if (asin && a !== asin) continue;
      for (const [f, crk] of Object.entries(fams))
        list.push({
          marketplaceId: 'ATVPDKIKX0DER',
          locale: 'en_US',
          asin: a,
          contentType:
            f === 'BrandStory' ? 'BrandStory' : (state.documents[crk]?.contentDocument?.contentType ?? 'EBC'),
          contentSubType: '',
          contentReferenceKey: crk,
        });
    }
    return ok({ nextPageToken: null, publishRecordList: list });
  },

  /** Listings Items API searchListingsItems (summaries only), same envelope as the API. Keyword filter
   *  matches the item name, SKU or ASIN; the fixture's mainImage files are served from the mock's upload route. */
  searchListingsItems({ keywords = '', pageSize = 20 } = {}) {
    const words = keywords.toLowerCase().split(/\s+/).filter(Boolean);
    const hit = (i) =>
      words.every((w) => `${i.sku} ${i.summaries[0].asin} ${i.summaries[0].itemName}`.toLowerCase().includes(w));
    const items = listings.items
      .filter(hit)
      .slice(0, Number(pageSize))
      .map((i) => {
        const s = i.summaries[0];
        const link =
          s.mainImage && fileToUploadId[s.mainImage.link] ? `/api/uploads/${fileToUploadId[s.mainImage.link]}` : null;
        return { sku: i.sku, summaries: [{ ...s, mainImage: link ? { ...s.mainImage, link } : undefined }] };
      });
    return {
      status: 200,
      headers: { rateLimit: '5.0', requestId: randomUUID() },
      body: { numberOfResults: items.length, pagination: {}, items },
    };
  },

  /** What the live proxy computes from searchContentDocuments + listContentDocumentAsinRelations: for every ASIN
   *  that has a document attached, the published document per family and the attached drafts. */
  aplusIndex() {
    const index = {};
    for (const doc of Object.values(state.documents)) {
      const md = doc.contentMetadata;
      const tier = md.badgeSet?.includes('PREMIUM')
        ? 'premium'
        : md.badgeSet?.includes('STANDARD')
          ? 'standard'
          : 'brandStory';
      for (const asin of doc.asinSet || []) {
        const e = (index[asin] ||= { published: {}, attached: [] });
        const entry = {
          contentReferenceKey: doc.contentReferenceKey,
          name: doc.contentMetadata.name,
          status: doc.contentMetadata.status,
          tier,
        };
        if (isPublished(asin, doc.contentReferenceKey)) e.published[tier] = entry;
        else e.attached.push(entry);
      }
    }
    return ok({ index });
  },

  createUploadDestination(fileName, contentType, bytes) {
    const id = `aplus-media/sc/${randomUUID()}.${contentType === 'image/png' ? 'png' : 'jpg'}`;
    state.uploads.set(id, { bytes, contentType, fileName });
    return {
      status: 201,
      body: { errors: [], payload: { uploadDestinationId: id, url: `mock://${id}`, headers: null } },
    };
  },

  /** Bytes for an uploadDestinationId: uploaded in this session, or one of the fixture images. */
  uploadedImage(id) {
    return state.uploads.get(id) || (fixtureUploads[id] ? fixtureFile(fixtureUploads[id]) : null);
  },

  /** Media API stand-in: one call registers the video and its thumbnail as a VIDEO_PAIRING and returns the
   *  unified Media shape createMedia returns (top-level mediaId is the video, relatedMedia[0].media.mediaId the
   *  paired image). The real service processes video asynchronously (PENDING_PROCESSING, poll getMedia); the
   *  mock is AVAILABLE at once. */
  createMedia(video, thumbnail) {
    const videoId = randomUUID(),
      imageId = randomUUID();
    state.media.set(imageId, { ...thumbnail, mediaType: 'IMAGE' });
    state.media.set(videoId, { ...video, mediaType: 'VIDEO', imageId });
    const info = (mediaId, mediaType, title) => ({ mediaId, mediaType, title, status: ['AVAILABLE'] });
    return {
      status: 201,
      body: {
        warnings: [],
        ...info(videoId, 'VIDEO', video.fileName),
        relatedMedia: [
          {
            associationType: 'VIDEO_PAIRING',
            title: thumbnail.fileName,
            status: ['AVAILABLE'],
            media: info(imageId, 'IMAGE', thumbnail.fileName),
          },
        ],
      },
    };
  },

  /** Poster frame for a Media API asset (video thumbnail / image media) so video modules preview with a still:
   *  the fixture documents' media, or a thumbnail uploaded in this session. */
  mediaPoster(mediaId) {
    if (FIXTURE_MEDIA.has(mediaId)) return fixtureFile('hero-summer-1280x720.jpg');
    const m = state.media.get(mediaId);
    if (!m) return null;
    return m.mediaType === 'IMAGE' ? m : state.media.get(m.imageId) || null;
  },

  /** Video bytes for a Media API asset: the fixture clip, or a video uploaded in this session. */
  mediaVideo(mediaId) {
    if (FIXTURE_MEDIA.has(mediaId)) return fixtureFile('hero-summer-1280x720.mp4', 'video/mp4');
    const m = state.media.get(mediaId);
    return m?.mediaType === 'VIDEO' ? m : null;
  },

  /** One listing by ASIN, as /api/listings/:asin returns it. Only ASINs the sample account lists resolve;
   *  their title, bullets, description and images come from catalog.json (the listing's attributes). */
  listingItem(asin) {
    const listing = listings.items.find((i) => i.summaries[0].asin === asin);
    const item = catalog[asin];
    if (!listing || !item)
      return {
        status: 404,
        body: {
          errors: [
            {
              code: 'NOT_FOUND',
              message: `No listing with ASIN ${asin} in this account for marketplace ATVPDKIKX0DER.`,
              details: '',
            },
          ],
        },
      };
    // catalog.json names fixture image files; serve them through the uploads route
    const images = catalogImages(item);
    const { fixtureImages, brandNotEligible, ...rest } = item;
    return ok({ ...rest, sku: listing.sku, ...(images.length ? { imageUrl: images[0], images } : {}) });
  },

  reset() {
    state = initialState();
  },
};
