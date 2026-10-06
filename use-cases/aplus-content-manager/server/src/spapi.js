// Server-side SP-API access. The browser never sees LWA credentials or access tokens: the client
// calls this server's /api routes, the server exchanges the refresh token for an access token
// (cached until 60 s before expiry) and forwards the call to the SP-API endpoint.
//
// Environment:
//   LWA_CLIENT_ID, LWA_CLIENT_SECRET, LWA_REFRESH_TOKEN   (required in live mode)
//   SPAPI_ENDPOINT   default https://sellingpartnerapi-na.amazon.com
//   MARKETPLACE_ID   default ATVPDKIKX0DER
//   LWA_ENDPOINT     default https://api.amazon.com/auth/o2/token

const LWA_ENDPOINT = process.env.LWA_ENDPOINT || 'https://api.amazon.com/auth/o2/token';
const ENDPOINT = process.env.SPAPI_ENDPOINT || 'https://sellingpartnerapi-na.amazon.com';

// Every SP-API request identifies the application (name, version, language), as the call structure
// requires: https://developer-docs.amazon.com/sp-api/docs/connecting-to-the-selling-partner-api#step-3-add-headers-to-the-uri
// Same shape as the other SP-API sample apps. Set USER_AGENT_OPT_OUT = true to disable User-Agent tracking.
const USER_AGENT_OPT_OUT = false;
export const USER_AGENT = 'A+ Content Manager Sample App/1.0/JavaScript';

let cached = { token: null, expiresAt: 0 };

async function accessToken() {
  if (cached.token && Date.now() < cached.expiresAt - 60_000) return cached.token;
  const { LWA_CLIENT_ID, LWA_CLIENT_SECRET, LWA_REFRESH_TOKEN } = process.env;
  if (!LWA_CLIENT_ID || !LWA_CLIENT_SECRET || !LWA_REFRESH_TOKEN) {
    throw Object.assign(
      new Error('LWA_CLIENT_ID, LWA_CLIENT_SECRET and LWA_REFRESH_TOKEN must be set (or run with MODE=mock)'),
      { status: 500 },
    );
  }
  const body = new URLSearchParams({
    grant_type: 'refresh_token',
    refresh_token: LWA_REFRESH_TOKEN,
    client_id: LWA_CLIENT_ID,
    client_secret: LWA_CLIENT_SECRET,
  });
  const res = await fetch(LWA_ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  });
  const json = await res.json();
  if (!res.ok || !json.access_token) {
    // LWA error bodies carry no secrets: {"error":"invalid_grant","error_description":"..."}
    throw Object.assign(
      new Error(`LWA token refresh failed: ${json.error || res.status} ${json.error_description || ''}`),
      { status: 502 },
    );
  }
  cached = { token: json.access_token, expiresAt: Date.now() + (json.expires_in || 3600) * 1000 };
  return cached.token;
}

/**
 * Call an SP-API operation. Returns { status, headers: { rateLimit, requestId }, body }.
 * Non-2xx responses are returned, not thrown, so the UI can show the service's own errors[] verbatim.
 */
export async function spapi(method, path, { query, body } = {}) {
  const url = new URL(path, ENDPOINT);
  for (const [k, v] of Object.entries(query || {})) {
    if (v === undefined || v === null || v === '') continue;
    url.searchParams.set(k, Array.isArray(v) ? v.join(',') : String(v)); // list params are csv (asinSet, includedDataSet, marketplaceIds)
  }
  const res = await fetch(url, {
    method,
    headers: {
      'x-amz-access-token': await accessToken(),
      Accept: 'application/json',
      ...(USER_AGENT_OPT_OUT ? {} : { 'User-Agent': USER_AGENT }),
      ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let parsed = null;
  try {
    parsed = text ? JSON.parse(text) : null;
  } catch {
    parsed = { raw: text };
  }
  return {
    status: res.status,
    headers: { rateLimit: res.headers.get('x-amzn-RateLimit-Limit'), requestId: res.headers.get('x-amzn-RequestId') },
    body: parsed,
  };
}

/** Upload bytes to the pre-signed URL returned by createUploadDestinationForResource (query params become form fields). */
export async function postToUploadDestination(uploadUrl, bytes, fileName, contentType) {
  const [base, query = ''] = uploadUrl.split('?');
  const form = new FormData();
  for (const [k, v] of new URLSearchParams(query)) form.append(k, v);
  form.append('File', new Blob([bytes], { type: contentType }), fileName);
  const res = await fetch(base, { method: 'POST', body: form });
  if (!res.ok) throw Object.assign(new Error(`Upload to destination failed with HTTP ${res.status}`), { status: 502 });
}

export const marketplaceId = () => process.env.MARKETPLACE_ID || 'ATVPDKIKX0DER';
