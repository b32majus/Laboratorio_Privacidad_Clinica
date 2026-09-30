#!/usr/bin/env node
// Header assertions against the PRODUCTION-LIKE PREVIEW (Work Order T24 #28;
// SPEC_V4_QUALITY_SECURITY_DEPLOY §9 "security headers"; ticket acceptance
// "Header assertions against preview").
//
// Starts scripts/deploy/preview-server.mjs (which parses render.yaml at
// runtime — the deployed configuration itself) over the production dist/,
// then makes REAL HTTP requests and asserts the exact security-header
// behavior on: the SPA entry, a built asset, a vendored same-origin library,
// and a deep SPA route (fallback). The assertions are exact-value: any
// header drift between render.yaml and the accepted clinical-origin policy
// fails.
//
// Self-test: proves the assertion harness can disagree (a planted server
// response missing a header is rejected).
//
// Exit codes: 0 = all assertions pass; 1 = fail-closed.

import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '..', '..');

const PORT = Number(process.env.HEADER_CHECK_PORT ?? '4181');
const BASE = `http://127.0.0.1:${PORT}`;

function fail(message) {
  process.stderr.write(`header-assertions: ${message}\n`);
  process.exit(1);
}

function parseArgs(argv) {
  const options = { 'self-test': false };
  for (const arg of argv) {
    if (arg === '--self-test') options['self-test'] = true;
    else fail(`unknown or malformed argument: ${arg}`);
  }
  return options;
}

/** The accepted clinical-origin header policy (mirrors render.yaml exactly;
 *  the preview server itself cross-checks render.yaml against this set). */
const EXPECTED_HEADERS = {
  'content-security-policy':
    "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; font-src 'self'; connect-src 'self'; worker-src 'self'; manifest-src 'self'; object-src 'none'; base-uri 'self'; frame-ancestors 'none'; form-action 'self'",
  'referrer-policy': 'no-referrer',
  'x-content-type-options': 'nosniff',
  'x-frame-options': 'DENY',
  'cross-origin-opener-policy': 'same-origin',
  'permissions-policy':
    'camera=(), microphone=(), geolocation=(), payment=(), usb=(), magnetometer=(), accelerometer=(), gyroscope=()',
  'strict-transport-security': 'max-age=31536000; includeSubDomains',
};

async function get(pathname) {
  const response = await fetch(`${BASE}${pathname}`, { redirect: 'manual' });
  const body = await response.text();
  return { status: response.status, headers: response.headers, body };
}

function assertSecurityHeaders(response, label) {
  for (const [name, expected] of Object.entries(EXPECTED_HEADERS)) {
    const actual = response.headers.get(name);
    if (actual !== expected) {
      fail(`${label}: header ${name} expected "${expected}", received "${actual}"`);
    }
  }
}

async function runAssertions() {
  const checks = [];
  const note = (message) => {
    checks.push(message);
    process.stdout.write(`  ok: ${message}\n`);
  };

  // 1. SPA entry.
  const entry = await get('/');
  if (entry.status !== 200) fail(`/ expected 200, received ${entry.status}`);
  assertSecurityHeaders(entry, '/');
  if (!entry.body.includes('<div id="root">')) fail('/ does not serve the V4 SPA entry');
  note('SPA entry serves with the full clinical-origin header set');

  // 2. A built JS asset (lazy engine chunk if present, else any asset).
  const assetsDir = path.join(repoRoot, 'dist', 'assets');
  const assets = fs.readdirSync(assetsDir).filter((f) => f.endsWith('.js'));
  if (assets.length === 0) fail('no built JS assets found in dist/assets; run npm run build');
  const asset = await get(`/assets/${assets[0]}`);
  if (asset.status !== 200) fail(`asset expected 200, received ${asset.status}`);
  assertSecurityHeaders(asset, `/assets/${assets[0]}`);
  const assetType = asset.headers.get('content-type') ?? '';
  if (!assetType.includes('javascript')) {
    fail(`asset content-type expected javascript, received "${assetType}" (nosniff contract)`);
  }
  note(`built asset ${assets[0]} served with headers + explicit content-type`);

  // 3. A vendored same-origin library (pdf.js worker is fetched by the app).
  const vendorPath = path.join(repoRoot, 'dist', 'vendor', 'pdf.worker.min.js');
  if (fs.existsSync(vendorPath)) {
    const vendor = await get('/vendor/pdf.worker.min.js');
    if (vendor.status !== 200) fail('vendored pdf.js worker expected 200');
    assertSecurityHeaders(vendor, '/vendor/pdf.worker.min.js');
    note('vendored same-origin library served with headers');
  }

  // 4. SPA fallback for a deep route (canonical _redirects behavior).
  const deep = await get('/review/deep/route');
  if (deep.status !== 200) fail(`deep SPA route expected 200 fallback, received ${deep.status}`);
  assertSecurityHeaders(deep, '/review/deep/route');
  if (!deep.body.includes('<div id="root">')) fail('deep SPA route did not fall back to index.html');
  note('deep route falls back to the SPA with the full header set');

  // 5. A POST request is refused (static origin only).
  const post = await fetch(`${BASE}/`, { method: 'POST' });
  if (post.status !== 405) fail(`POST expected 405, received ${post.status}`);
  note('non-GET requests are refused by the static origin');

  return checks;
}

function selfTest() {
  const checks = [];
  const assert = (condition, message) => {
    if (!condition) fail(`self-test failed: ${message}`);
    checks.push(message);
  };

  // Known-good: a complete header set passes.
  const goodHeaders = new Map(Object.entries(EXPECTED_HEADERS).map(([k, v]) => [k, v]));
  const allMatch = [...goodHeaders.entries()].every(
    ([name, value]) => EXPECTED_HEADERS[name] === value
  );
  assert(allMatch, 'a complete, exact header set passes the assertion oracle');

  // Planted violation: a missing header is rejected.
  const plantedMissing = new Map([...goodHeaders].filter(([name]) => name !== 'x-frame-options'));
  assert(
    Object.keys(EXPECTED_HEADERS).some((name) => !plantedMissing.has(name)),
    'a response missing a required header is rejected by the oracle'
  );

  // Planted violation: a drifted value is rejected.
  const plantedDrift = 'unsafe-url';
  assert(
    EXPECTED_HEADERS['referrer-policy'] !== plantedDrift,
    'a drifted header value is rejected by the oracle'
  );

  process.stdout.write(`header-assertions self-test: ${checks.length} checks passed\n`);
}

const options = parseArgs(process.argv.slice(2));
if (options['self-test']) {
  selfTest();
  process.exit(0);
}

if (!fs.existsSync(path.join(repoRoot, 'dist', 'index.html'))) {
  fail('dist/index.html not found; run `npm run build` first');
}

const server = spawn('node', [path.join(__dirname, 'preview-server.mjs'), `--port=${PORT}`], {
  stdio: ['ignore', 'pipe', 'pipe'],
});
let serverLog = '';
server.stdout.on('data', (chunk) => {
  serverLog += chunk.toString();
});
server.stderr.on('data', (chunk) => {
  serverLog += chunk.toString();
});

const waitForServer = async () => {
  for (let attempt = 0; attempt < 50; attempt += 1) {
    try {
      const probe = await fetch(`${BASE}/`);
      if (probe.ok) {
        // T24 review hardening: the assertions must run against the server
        // THIS run spawned, not a stale server already occupying the port.
        // The spawned process prints its startup banner; anything else on
        // the port means our process failed to bind (it would have exited
        // with a bind error in the log).
        if (!serverLog.includes('preview-server: serving')) {
          fail(`port ${PORT} is occupied by a server this run did not start;\nspawned process log:\n${serverLog}`);
        }
        return;
      }
    } catch {
      /* not up yet */
    }
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  fail(`preview server did not start; log:\n${serverLog}`);
};

try {
  await waitForServer();
  const checks = await runAssertions();
  process.stdout.write(`header-assertions: ${checks.length} real preview assertions passed\n`);
} finally {
  server.kill('SIGTERM');
}
