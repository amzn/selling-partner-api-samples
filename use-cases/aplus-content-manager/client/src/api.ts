// Types mirroring the A+ Content API v2020-11-01 payloads the app handles, plus the /api client.
// Errors are surfaced exactly as the service returns them (errors[] with code/message/details) so the
// UI can map `details` paths like "...contentModuleList[1].premiumTechSpecs.headline: must not be null"
// back to the module that caused them.

export type TextComponent = { value: string; decoratorSet?: unknown[] };
export type ParagraphComponent = { textList: TextComponent[] };
export type IntegerWithUnits = { value: number; units: 'pixels' };
export type ImageComponent = {
  uploadDestinationId: string;
  altText?: string;
  imageCropSpecification: {
    size: { width: IntegerWithUnits; height: IntegerWithUnits };
    offset: { x: IntegerWithUnits; y: IntegerWithUnits };
  };
};
export type ContentModule = { contentModuleType: string } & Record<string, unknown>;
export type ContentDocument = {
  name: string;
  contentType: 'EBC' | 'EMC' | 'BrandStory';
  locale: string;
  contentModuleList: ContentModule[];
};
export type ContentMetadata = {
  name: string;
  marketplaceId: string;
  status: 'DRAFT' | 'SUBMITTED' | 'APPROVED' | 'REJECTED';
  badgeSet: string[];
  updateTime: string;
};
export type ContentRecord = {
  contentReferenceKey: string;
  contentMetadata: ContentMetadata | null;
  contentDocument: ContentDocument | null;
};
export type ApiError = { code: string; message: string; details?: string };
export type AsinMetadata = { asin: string; badgeSet: string[]; title?: string | null; imageUrl?: string | null };
export type PublishRecord = { asin: string; locale: string; contentType: string; contentReferenceKey: string };
/** One of the account's listings, as /api/listings/:asin returns it (Listings Items API summaries + attributes). */
export type ListingDetails = {
  asin: string;
  sku?: string;
  title?: string;
  brand?: string;
  imageUrl?: string;
  images?: string[];
  bullets?: string[];
  description?: string;
  price?: string | null;
};

export class SpApiError extends Error {
  constructor(
    public status: number,
    public errors: ApiError[],
  ) {
    super(
      errors.map((e) => `${e.code}: ${e.message}${e.details ? ` (${e.details})` : ''}`).join('\n') || `HTTP ${status}`,
    );
  }
}

export type ApiResult<T> = T & { warnings?: ApiError[]; errors?: ApiError[]; _rateLimit?: string | null };

async function call<T>(method: string, path: string, body?: unknown, form?: FormData): Promise<ApiResult<T>> {
  const res = await fetch(path, {
    method,
    headers: form ? undefined : body !== undefined ? { 'Content-Type': 'application/json' } : undefined,
    body: form ?? (body !== undefined ? JSON.stringify(body) : undefined),
  });
  // Read as text first: an error body that is not JSON (an empty body, a proxy's HTML error page) must still
  // surface as an SpApiError with the HTTP status instead of a raw SyntaxError from res.json().
  const text = res.status === 204 ? '' : await res.text();
  let json: Record<string, unknown> & { errors?: ApiError[] } = {};
  try {
    if (text) json = JSON.parse(text);
  } catch {
    json = {};
  }
  if (!res.ok)
    throw new SpApiError(res.status, json.errors ?? [{ code: `HTTP_${res.status}`, message: res.statusText }]);
  return { ...(json as T), _rateLimit: res.headers.get('x-amzn-RateLimit-Limit') };
}

export const api = {
  config: () =>
    call<{
      mode: 'live' | 'mock';
      marketplaceId: string;
      endpoint: string;
      listings: boolean;
      accountType: 'seller' | 'vendor';
    }>('GET', '/api/config'),
  /** Listings Items API searchListingsItems (summaries) through the proxy; keywords match name, SKU or ASIN. */
  listings: (keywords: string, pageToken?: string) =>
    call<ListingsPage>(
      'GET',
      `/api/listings?keywords=${encodeURIComponent(keywords)}${pageToken ? `&pageToken=${encodeURIComponent(pageToken)}` : ''}`,
    ),
  /** ASIN -> published document per tier + attached drafts, built server-side from the A+ document list. */
  aplusIndex: (refresh = false) => call<{ index: AplusIndex }>('GET', `/api/aplus-index${refresh ? '?refresh=1' : ''}`),
  searchDocuments: () =>
    call<{ contentMetadataRecords: { contentReferenceKey: string; contentMetadata: ContentMetadata }[] }>(
      'GET',
      '/api/documents',
    ),
  getDocument: (crk: string) =>
    call<{ contentRecord: ContentRecord }>('GET', `/api/documents/${crk}?includedDataSet=CONTENTS,METADATA`),
  validate: (contentDocument: ContentDocument, asinSet: string[]) =>
    call<{ warnings: ApiError[]; errors: ApiError[] }>('POST', '/api/documents/validate', { contentDocument, asinSet }),
  create: (contentDocument: ContentDocument) =>
    call<{ contentReferenceKey: string }>('POST', '/api/documents', { contentDocument }),
  update: (crk: string, contentDocument: ContentDocument) =>
    call<{ contentReferenceKey: string }>('POST', `/api/documents/${crk}`, { contentDocument }),
  listAsins: (crk: string) =>
    call<{ warnings: ApiError[]; asinMetadataSet: AsinMetadata[] }>('GET', `/api/documents/${crk}/asins`),
  applyAsins: (crk: string, asinSet: string[]) =>
    call<{ warnings: ApiError[] }>('POST', `/api/documents/${crk}/asins`, { asinSet }),
  submit: (crk: string) => call<{ warnings: ApiError[] }>('POST', `/api/documents/${crk}/submit`),
  suspend: (crk: string) => call<{ warnings: ApiError[] }>('POST', `/api/documents/${crk}/suspend`),
  publishRecords: (asin: string) =>
    call<{ publishRecordList: PublishRecord[] }>('GET', `/api/publish-records?asin=${encodeURIComponent(asin)}`),
  listing: (asin: string) => call<ListingDetails>('GET', `/api/listings/${encodeURIComponent(asin)}`),
  upload: (file: File) => {
    const form = new FormData();
    form.append('file', file);
    return call<{ payload: { uploadDestinationId: string } }>('POST', '/api/uploads', undefined, form);
  },
  /** Mock-mode Media API: the video and its poster frame become a VIDEO_PAIRING; returns the unified Media object. */
  createMedia: (video: File, thumbnail: Blob) => {
    const form = new FormData();
    form.append('video', video);
    form.append('thumbnail', thumbnail, 'thumbnail.jpg');
    return call<{ mediaId: string; relatedMedia: { media: { mediaId: string } }[] }>(
      'POST',
      '/api/media',
      undefined,
      form,
    );
  },
  resetMock: () => call<Record<string, never>>('POST', '/api/mock/reset'),
  gallery: () => call<Record<string, ContentDocument>>('GET', '/api/gallery'),
  templates: () => call<Record<'premium' | 'standard' | 'brandstory', ContentDocument>>('GET', '/api/templates'),
};

/** The three kinds of A+ document a seller works with. `contentType` (EBC/EMC/BrandStory) and the module
 *  tier both follow from the kind, so the UI asks for the kind once instead of exposing both. */
export type Kind = 'standard' | 'premium' | 'brandStory';
export const KIND_LABEL: Record<Kind, string> = {
  standard: 'Standard A+',
  premium: 'Premium A+',
  brandStory: 'Brand Story',
};

/** The two detail-page slots A+ content can fill. Standard and Premium share one slot (one of them is live at a
 *  time); Brand Story has its own. */
export type Slot = 'aplus' | 'brandStory';
export const slotOf = (contentType?: ContentDocument['contentType'] | string | null): Slot =>
  contentType === 'BrandStory' ? 'brandStory' : 'aplus';

/** The heading amazon.com prints over the slot. It depends on who published, not on the tier: a seller's
 *  Standard or Premium document (EBC) replaces the plain-text description and renders under "Product
 *  description"; a vendor's (EMC) renders under "From the manufacturer" with the plain description kept
 *  below it. Brand Story is "From the brand" for both. */
export function slotHeading(contentType?: ContentDocument['contentType'] | string | null): string {
  if (contentType === 'BrandStory') return 'From the brand';
  return contentType === 'EMC' ? 'From the manufacturer' : 'Product description';
}

/** searchListingsItems with includedData=summaries (Listings Items API 2021-08-01). */
export type ListingSummary = {
  marketplaceId: string;
  asin: string;
  productType?: string;
  status?: string[];
  itemName?: string;
  mainImage?: { link: string; width?: number; height?: number };
};
export type ListingItem = { sku: string; summaries: ListingSummary[] };
export type ListingsPage = { numberOfResults: number; pagination?: { nextToken?: string }; items: ListingItem[] };
export type AplusIndexEntry = { contentReferenceKey: string; name: string; status: string; tier: Kind };
export type AplusIndex = Record<
  string,
  { published: Partial<Record<Kind, AplusIndexEntry>>; attached: AplusIndexEntry[] }
>;

/** A ten-character ASIN, or null. */
export function asinFrom(input: string): string | null {
  const s = input.trim();
  return /^[A-Z0-9]{10}$/i.test(s) ? s.toUpperCase() : null;
}
export function kindOf(doc: ContentDocument | null | undefined, fallback: Kind = 'premium'): Kind {
  if (!doc) return fallback;
  if (doc.contentType === 'BrandStory') return 'brandStory';
  const first = doc.contentModuleList[0]?.contentModuleType;
  if (first?.startsWith('PREMIUM')) return 'premium';
  if (first?.startsWith('STANDARD')) return 'standard';
  return fallback;
}

/** "…contentModuleList[3].premiumFaq.faqs: size must be between 1 and 5" -> { index: 3, field: "premiumFaq.faqs", constraint: "size must be between 1 and 5" } */
export function parseDetails(details?: string): { index: number | null; field: string; constraint: string } {
  if (!details) return { index: null, field: '', constraint: '' };
  const m = details.match(/contentModuleList\[(\d+)\]\.(.*?): (.*)$/);
  if (m) return { index: Number(m[1]), field: m[2], constraint: m[3] };
  const top = details.match(/contentDocument\.(\w+): (.*)$/);
  if (top) return { index: null, field: top[1], constraint: top[2] };
  return { index: null, field: '', constraint: details };
}
