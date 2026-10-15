// Wire-level check of the SP-API client: a local stub stands in for both the LWA token endpoint and
// the SP-API endpoint and records the headers the client sends. No network access, no real credentials.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';

const seen = [];
let stub;
let spapi;
let USER_AGENT;

before(async () => {
  stub = createServer((req, res) => {
    seen.push({ path: req.url, headers: req.headers });
    res.setHeader('Content-Type', 'application/json');
    if (req.url === '/auth/o2/token') {
      res.end(JSON.stringify({ access_token: 'stub-access-token', expires_in: 3600 }));
      return;
    }
    res.setHeader('x-amzn-RequestId', 'stub-request-id');
    res.end(JSON.stringify({ contentMetadataRecords: [] }));
  });
  await new Promise((resolve) => stub.listen(0, '127.0.0.1', resolve));
  const base = `http://127.0.0.1:${stub.address().port}`;

  // The client reads its endpoints at import time and the credentials at call time.
  process.env.LWA_ENDPOINT = `${base}/auth/o2/token`;
  process.env.SPAPI_ENDPOINT = base;
  process.env.LWA_CLIENT_ID = 'stub-client-id';
  process.env.LWA_CLIENT_SECRET = 'stub-client-secret';
  process.env.LWA_REFRESH_TOKEN = 'stub-refresh-token';
  ({ spapi, USER_AGENT } = await import('../src/spapi.js'));
});

after(() => stub?.close());

test('spapi: every SP-API request carries the sample app User-Agent and the access token', async () => {
  const res = await spapi('GET', '/aplus/2020-11-01/contentDocuments', { query: { marketplaceId: 'ATVPDKIKX0DER' } });
  assert.equal(res.status, 200);
  assert.equal(res.headers.requestId, 'stub-request-id');

  const api = seen.find((r) => r.path.startsWith('/aplus/'));
  assert.ok(api, 'the API call reached the stub');
  assert.equal(api.headers['user-agent'], USER_AGENT);
  assert.equal(api.headers['x-amz-access-token'], 'stub-access-token');
  assert.equal(api.headers.accept, 'application/json');
});

test('spapi: the User-Agent follows the SP-API shape, app name/version/language', () => {
  // https://developer-docs.amazon.com/sp-api/docs/connecting-to-the-selling-partner-api#step-3-add-headers-to-the-uri
  assert.match(USER_AGENT, /^[^/]+\/\d+(\.\d+)*\/[A-Za-z#+.]+$/);
  assert.ok(USER_AGENT.length <= 500);
});
