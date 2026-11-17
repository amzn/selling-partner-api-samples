// HTTP-level checks against the server in sample-data mode: what a browser gets back for requests
// that never reach a route body (middleware errors) and for caller-controlled values echoed in responses.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const PORT = 20000 + Math.floor(Math.random() * 10000);
const BASE = `http://127.0.0.1:${PORT}`;
let server;

before(async () => {
  server = spawn(process.execPath, [join(here, '..', 'src', 'index.js')], {
    env: { ...process.env, MODE: 'mock', PORT: String(PORT) },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  await new Promise((resolve, reject) => {
    server.stdout.on('data', (d) => d.toString().includes(`http://127.0.0.1:${PORT}`) && resolve());
    server.on('exit', (code) => reject(new Error(`server exited with ${code}`)));
  });
});

after(() => server?.kill());

test('http: unknown upload id is escaped in the SVG placeholder', async () => {
  const id = encodeURIComponent('x</text><script>alert(1)</script>');
  const res = await fetch(`${BASE}/api/uploads/${id}`);
  assert.equal(res.status, 200);
  assert.match(res.headers.get('content-type'), /image\/svg\+xml/);
  const body = await res.text();
  assert.ok(!body.includes('<script'), 'raw markup must not appear in the SVG');
  assert.ok(body.includes('&lt;script&gt;'), 'the id is rendered as escaped text');
});

test('http: a file over the upload limit comes back as a JSON error, not an HTML page', async () => {
  const form = new FormData();
  form.set('file', new Blob([new Uint8Array(10 * 1024 * 1024 + 1)], { type: 'image/png' }), 'big.png');
  const res = await fetch(`${BASE}/api/uploads`, { method: 'POST', body: form });
  assert.equal(res.status, 413);
  const json = await res.json();
  assert.equal(json.errors[0].code, 'LIMIT_FILE_SIZE');
});

test('http: a malformed JSON body comes back as a JSON error with a 400', async () => {
  const res = await fetch(`${BASE}/api/documents`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: '{ not json',
  });
  assert.equal(res.status, 400);
  const json = await res.json();
  assert.equal(json.errors.length, 1);
  assert.ok(json.errors[0].message);
});

test('http: an unknown /api path is a JSON 404, never the SPA shell', async () => {
  const res = await fetch(`${BASE}/api/no-such-route`);
  // without a client build the server has no catch-all and Express answers 404 itself; with one, the
  // catch-all must still answer API paths with the errors[] envelope
  assert.equal(res.status, 404);
  if (res.headers.get('content-type')?.includes('application/json')) {
    const json = await res.json();
    assert.equal(json.errors[0].code, 'NotFound');
  }
});
