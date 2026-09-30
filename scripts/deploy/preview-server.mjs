#!/usr/bin/env node
// Production-like static preview server with the EXACT deployed security
// headers (Work Order T24 #28; SPEC_V4_QUALITY_SECURITY_DEPLOY §9).
//
// Single source of truth: the headers are PARSED from render.yaml at startup
// — the local preview can never drift from the deployed configuration. The
// parser accepts the bounded `headers:` subset this repository actually uses
// and FAILS CLOSED on anything it does not understand (unknown keys, missing
// values, malformed paths) instead of serving unheadered bytes.
//
// SPA fallback: serves dist/_redirects (`/* /index.html 200`), the canonical
// Render static-site SPA mechanism, copied verbatim from app-v4/public/ by
// the Vite build.
//
// Privacy: serves local build output only; no network egress; clinical
// content never reaches a server (the user's browser IS the runtime, D-013).
//
// Exit codes: 0 = ok; 1 = fail-closed config/serve error.
//
// Usage:
//   node scripts/deploy/preview-server.mjs --port=4181
//   node scripts/deploy/preview-server.mjs --self-test

import { deepStrictEqual } from 'node:assert';
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '..', '..');

function fail(message) {
  process.stderr.write(`preview-server: ${message}\n`);
  process.exit(1);
}

/** Fail-closed configuration error: thrown by parsers, caught by self-test. */
class PreviewConfigError extends Error {}

function configFail(message) {
  throw new PreviewConfigError(message);
}

function parseArgs(argv) {
  const options = { port: 4181, 'self-test': false, dist: 'dist' };
  for (const arg of argv) {
    if (arg === '--self-test') options['self-test'] = true;
    else {
      const match = arg.match(/^--([a-z-]+)=(.+)$/);
      if (!match || !(match[1] in options)) fail(`unknown or malformed argument: ${arg}`);
      options[match[1]] = match[1] === 'port' ? Number(match[2]) : match[2];
    }
  }
  if (!Number.isInteger(options.port) || options.port < 1 || options.port > 65535) {
    fail('--port must be an integer between 1 and 65535');
  }
  return options;
}

/**
 * Parse the bounded render.yaml subset used by this repository: the
 * `headers:` entries of the (single) static service. Returns
 * [{path, name, value}] with value quotes stripped.
 *
 * Fail-closed rules:
 *   - exactly one `headers:` block must exist;
 *   - each entry is exactly `- path: <p>` followed by `name:` and `value:`;
 *   - every value must be non-empty; quoted values are unquoted verbatim;
 *   - unknown top-level service keys are tolerated (buildCommand, etc.), but
 *     unknown keys INSIDE a header entry fail the parse.
 */
export function parseRenderHeaders(renderYaml) {
  const lines = renderYaml.split(/\r?\n/);
  const headers = [];
  let inHeaders = false;
  let current = null;

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    const trimmed = line.trim();
    if (trimmed === '' || trimmed.startsWith('#')) continue;

    if (trimmed === 'headers:') {
      if (headers.length > 0 || current) configFail(`render.yaml: duplicate headers block at line ${index + 1}`);
      inHeaders = true;
      continue;
    }

    if (inHeaders) {
      // A non-indented, non-list line ends the headers block.
      if (!line.startsWith(' ') && !trimmed.startsWith('-')) {
        inHeaders = false;
        current = null;
        continue;
      }
      if (trimmed.startsWith('- path:')) {
        if (current) configFail(`render.yaml: header entry missing name/value before line ${index + 1}`);
        current = { path: trimmed.slice('- path:'.length).trim() };
        if (!current.path) configFail(`render.yaml: empty header path at line ${index + 1}`);
        continue;
      }
      const nameMatch = trimmed.match(/^name:\s*(.*)$/);
      if (nameMatch && current) {
        if (current.name !== undefined) configFail(`render.yaml: duplicate header name at line ${index + 1}`);
        current.name = nameMatch[1].trim();
        continue;
      }
      const valueMatch = trimmed.match(/^value:\s*(.*)$/);
      if (valueMatch && current) {
        if (current.value !== undefined) configFail(`render.yaml: duplicate header value at line ${index + 1}`);
        let value = valueMatch[1].trim();
        if (value.startsWith('"') && value.endsWith('"') && value.length >= 2) {
          value = value.slice(1, -1);
        }
        if (!value) configFail(`render.yaml: empty header value at line ${index + 1}`);
        current.value = value;
        headers.push(current);
        current = null;
        continue;
      }
      configFail(`render.yaml: unrecognized line inside headers block at line ${index + 1}: ${trimmed}`);
    }
  }

  if (current) configFail('render.yaml: header entry missing name/value at end of file');
  if (headers.length === 0) configFail('render.yaml: no headers block found');
  for (const header of headers) {
    if (header.name === undefined || header.value === undefined) {
      configFail(`render.yaml: incomplete header entry for path ${header.path}`);
    }
  }
  return headers;
}

/**
 * Parse dist/_redirects (canonical Render SPA fallback): returns
 * {source, destination, status} or null when the file is absent.
 * Fail-closed on malformed redirect lines.
 */
export function parseRedirects(redirectsText) {
  if (redirectsText === null) return null;
  for (const rawLine of redirectsText.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (line === '' || line.startsWith('#')) continue;
    const parts = line.split(/\s+/);
    if (parts.length !== 3 || parts[2] !== '200') {
      configFail(`_redirects: unsupported redirect line: ${rawLine}`);
    }
    return { source: parts[0], destination: parts[1], status: Number(parts[2]) };
  }
  configFail('_redirects: no redirect rules found');
}

const SECURITY_HEADER_VALUES = {
  'content-security-policy': "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; font-src 'self'; connect-src 'self'; worker-src 'self'; manifest-src 'self'; object-src 'none'; base-uri 'self'; frame-ancestors 'none'; form-action 'self'",
  'referrer-policy': 'no-referrer',
  'x-content-type-options': 'nosniff',
  'x-frame-options': 'DENY',
  'cross-origin-opener-policy': 'same-origin',
  'strict-transport-security': 'max-age=31536000; includeSubDomains',
  'permissions-policy': 'camera=(), microphone=(), geolocation=(), payment=(), usb=(), magnetometer=(), accelerometer=(), gyroscope=()',
};

/** Runtime validation: the parsed headers must be exactly the accepted set. */
export function assertKnownHeaders(headers) {
  const known = new Set(Object.keys(SECURITY_HEADER_VALUES));
  const seen = new Set();
  for (const header of headers) {
    const key = header.name.toLowerCase();
    if (!known.has(key)) configFail(`render.yaml: unexpected security header: ${header.name}`);
    const expected = SECURITY_HEADER_VALUES[key];
    if (header.value !== expected) {
      configFail(`render.yaml: header ${header.name} does not match the accepted value; update scripts/deploy/preview-server.mjs and the assertions together with render.yaml (single authority)`);
    }
    seen.add(key);
  }
  for (const key of known) {
    if (!seen.has(key)) configFail(`render.yaml: missing required security header: ${key}`);
  }
}

function selfTest() {
  const checks = [];
  const assert = (condition, message) => {
    if (!condition) fail(`self-test failed: ${message}`);
    checks.push(message);
  };

  // 1. Known-good: the REAL render.yaml parses and matches the accepted set.
  const real = parseRenderHeaders(fs.readFileSync(path.join(repoRoot, 'render.yaml'), 'utf8'));
  assertKnownHeaders(real);
  assert(real.length >= 6, `real render.yaml parses with ${real.length} headers`);
  assert(
    real.every((header) => header.path === '/*'),
    'all headers apply to every path'
  );

  // 2. Planted violation: a header with an unexpected value must fail the parse.
  const plantedValue =
    'services:\n' +
    '  - type: web\n' +
    '    headers:\n' +
    '      - path: /*\n' +
    '        name: Referrer-Policy\n' +
    '        value: unsafe-url\n';
  let failed = false;
  try {
    assertKnownHeaders(parseRenderHeaders(plantedValue));
  } catch {
    failed = true;
  }
  assert(failed, 'planted Referrer-Policy drift is rejected');

  // 3. Planted violation: an unexpected extra header must fail the parse.
  const plantedExtra =
    'headers:\n' +
    '  - path: /*\n' +
    '    name: X-Debug-All\n' +
    '    value: "true"\n';
  failed = false;
  try {
    assertKnownHeaders(parseRenderHeaders(plantedExtra));
  } catch {
    failed = true;
  }
  assert(failed, 'planted unknown header is rejected');

  // 4. Planted violation: unrecognized line inside the headers block fails.
  const plantedGarbage = 'headers:\n  - path: /*\n    bogus: yes\n';
  failed = false;
  try {
    parseRenderHeaders(plantedGarbage);
  } catch {
    failed = true;
  }
  assert(failed, 'planted malformed headers block is rejected');

  // 5. Known-good: SPA redirects parse.
  deepStrictEqual(
    parseRedirects('/*    /index.html   200\n'),
    { source: '/*', destination: '/index.html', status: 200 }
  );

  // 6. Planted violation: a non-200 redirect status fails closed.
  failed = false;
  try {
    parseRedirects('/*  /index.html  302\n');
  } catch {
    failed = true;
  }
  assert(failed, 'planted non-200 SPA fallback is rejected');

  process.stdout.write(`preview-server self-test: ${checks.length} checks passed\n`);
}

function serve(options) {
  const distDir = path.resolve(repoRoot, options.dist);
  if (!fs.existsSync(path.join(distDir, 'index.html'))) {
    fail(`dist/index.html not found under ${distDir}; run \`npm run build\` first`);
  }
  const parsedHeaders = parseRenderHeaders(
    fs.readFileSync(path.join(repoRoot, 'render.yaml'), 'utf8')
  );
  assertKnownHeaders(parsedHeaders);
  const headers = parsedHeaders;
  const redirectsPath = path.join(distDir, '_redirects');
  const redirects = parseRedirects(
    fs.existsSync(redirectsPath) ? fs.readFileSync(redirectsPath, 'utf8') : null
  );

  const server = http.createServer((req, res) => {
    if (req.method !== 'GET' && req.method !== 'HEAD') {
      res.writeHead(405, { ...Object.fromEntries(headers.map((h) => [h.name, h.value])) });
      res.end();
      return;
    }
    let urlPath;
    try {
      // Fail-closed: a malformed percent-encoded path is a CLIENT error
      // (400), never a server crash (review hardening).
      urlPath = decodeURIComponent((req.url ?? '/').split('?')[0]);
    } catch {
      res.writeHead(400);
      res.end();
      return;
    }
    const safePath = path.normalize(urlPath).replace(/^(\.\.[/\\])+/, '');
    let filePath = path.join(distDir, safePath);
    if (!filePath.startsWith(distDir)) {
      res.writeHead(403);
      res.end();
      return;
    }
    if (!fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
      // SPA fallback per dist/_redirects.
      if (redirects && redirects.source === '/*' && redirects.status === 200) {
        filePath = path.join(distDir, redirects.destination.replace(/^\//, ''));
      } else {
        res.writeHead(404);
        res.end();
        return;
      }
    }
    const extension = path.extname(filePath).toLowerCase();
    const types = {
      '.html': 'text/html; charset=utf-8',
      '.js': 'text/javascript; charset=utf-8',
      '.css': 'text/css; charset=utf-8',
      '.json': 'application/json; charset=utf-8',
      '.woff': 'font/woff',
      '.woff2': 'font/woff2',
      '.ttf': 'font/ttf',
      '.svg': 'image/svg+xml',
      '.png': 'image/png',
      '.ico': 'image/x-icon',
      '.txt': 'text/plain; charset=utf-8',
      '.map': 'application/json; charset=utf-8',
    };
    const responseHeaders = Object.fromEntries(headers.map((h) => [h.name, h.value]));
    responseHeaders['Content-Type'] = types[extension] ?? 'application/octet-stream';
    res.writeHead(200, responseHeaders);
    if (req.method === 'HEAD') {
      res.end();
      return;
    }
    fs.createReadStream(filePath).pipe(res);
  });

  server.listen(options.port, '127.0.0.1', () => {
    process.stdout.write(`preview-server: serving ${distDir} on http://127.0.0.1:${options.port}/ with ${headers.length} security headers from render.yaml\n`);
  });
  server.on('error', (error) => fail(`cannot start preview server: ${error.message}`));

  const shutdown = () => {
    server.close();
    process.exit(0);
  };
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

const options = parseArgs(process.argv.slice(2));
if (options['self-test']) {
  selfTest();
  process.exit(0);
}
serve(options);
