#!/usr/bin/env node
// Production-like static preview server with the EXACT deployed security
// headers and SPA fallback (Work Order T24 #28; SPEC_V4_QUALITY_SECURITY_
// DEPLOY §9).
//
// Single source of truth: the security headers AND the SPA fallback rewrite
// are PARSED from render.yaml at startup — the local preview can never drift
// from the deployed configuration. The parser accepts the bounded
// `headers:`/`routes:` subset this repository actually uses and FAILS CLOSED
// on anything it does not understand (unknown keys, missing values, malformed
// paths, unsupported route types) instead of serving unheadered bytes or a
// wrong fallback.
//
// SPA fallback: Render Static Sites apply redirect/rewrite rules from
// render.yaml `routes:` (the accepted provider mechanism). The repository
// uses a single `rewrite` rule `/* -> /index.html`, which is what makes an
// unknown deep path serve the SPA entry with HTTP 200. The earlier
// Netlify-style `dist/_redirects` file was never interpreted by Render (it
// was only served as a static asset, so deep routes 404ed on the real
// origin); it has been removed and the render.yaml route is now the one
// authority, exercised by this server and by `check:headers`.
//
// Privacy: serves local build output only; no network egress; clinical
// content never reaches a server (the user's browser IS the runtime, D-013).
//
// Exit codes: 0 = ok; 1 = fail-closed config/serve error.
//
// Usage:
//   node scripts/deploy/preview-server.mjs --port=4181
//   node scripts/deploy/preview-server.mjs --self-test

import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

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

/** Leading-space indentation of a YAML line. */
function indentOf(line) {
  return line.length - line.trimStart().length;
}

/** Strip matching surrounding double quotes from a scalar value. */
function unquote(value) {
  if (value.startsWith('"') && value.endsWith('"') && value.length >= 2) {
    return value.slice(1, -1);
  }
  return value;
}

/**
 * Parse the bounded render.yaml `headers:` subset used by this repository:
 * the header entries of the (single) static service. Returns
 * [{path, name, value}] with value quotes stripped.
 *
 * Fail-closed rules:
 *   - exactly one `headers:` block must exist;
 *   - each entry is exactly `- path: <p>` followed by `name:` and `value:`;
 *   - every value must be non-empty; quoted values are unquoted verbatim;
 *   - unknown top-level/sibling service keys are tolerated (buildCommand,
 *     routes, etc.), but unknown keys INSIDE a header entry fail the parse.
 *
 * The block ends at the first line whose indentation is not deeper than the
 * `headers:` key itself, so a sibling `routes:` block is never mistaken for
 * header content.
 */
export function parseRenderHeaders(renderYaml) {
  const lines = renderYaml.split(/\r?\n/);
  const headers = [];
  let inHeaders = false;
  let blockIndent = 0;
  let current = null;

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    const trimmed = line.trim();
    if (trimmed === '' || trimmed.startsWith('#')) continue;
    const indent = indentOf(line);

    if (inHeaders && indent <= blockIndent) {
      if (current) configFail(`render.yaml: header entry missing name/value before line ${index + 1}`);
      inHeaders = false;
      current = null;
    }

    if (trimmed === 'headers:') {
      if (headers.length > 0 || inHeaders) {
        configFail(`render.yaml: duplicate headers block at line ${index + 1}`);
      }
      inHeaders = true;
      blockIndent = indent;
      continue;
    }

    if (!inHeaders) continue;

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
      const value = unquote(valueMatch[1].trim());
      if (!value) configFail(`render.yaml: empty header value at line ${index + 1}`);
      current.value = value;
      headers.push(current);
      current = null;
      continue;
    }
    configFail(`render.yaml: unrecognized line inside headers block at line ${index + 1}: ${trimmed}`);
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
 * Parse the bounded render.yaml `routes:` subset: the accepted Render Static
 * Site redirect/rewrite rules. Returns [{type, source, destination}].
 *
 * Fail-closed: exactly one entry shape `- type: <redirect|rewrite>` followed
 * by `source:` and `destination:`; unknown types, missing values and
 * unrecognized block lines all fail the parse. The block ends at the first
 * line whose indentation is not deeper than the `routes:` key itself.
 */
export function parseRenderRoutes(renderYaml) {
  const lines = renderYaml.split(/\r?\n/);
  const routes = [];
  let inRoutes = false;
  let blockIndent = 0;
  let current = null;

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    const trimmed = line.trim();
    if (trimmed === '' || trimmed.startsWith('#')) continue;
    const indent = indentOf(line);

    if (inRoutes && indent <= blockIndent) {
      if (current) configFail(`render.yaml: route entry missing fields before line ${index + 1}`);
      inRoutes = false;
      current = null;
    }

    if (trimmed === 'routes:') {
      if (routes.length > 0 || inRoutes) {
        configFail(`render.yaml: duplicate routes block at line ${index + 1}`);
      }
      inRoutes = true;
      blockIndent = indent;
      continue;
    }

    if (!inRoutes) continue;

    const typeMatch = trimmed.match(/^-\s*type:\s*(.*)$/);
    if (typeMatch) {
      if (current) configFail(`render.yaml: route entry missing fields before line ${index + 1}`);
      current = { type: unquote(typeMatch[1].trim()) };
      if (!current.type) configFail(`render.yaml: empty route type at line ${index + 1}`);
      continue;
    }
    const sourceMatch = trimmed.match(/^source:\s*(.*)$/);
    if (sourceMatch && current) {
      if (current.source !== undefined) configFail(`render.yaml: duplicate route source at line ${index + 1}`);
      current.source = unquote(sourceMatch[1].trim());
      if (!current.source) configFail(`render.yaml: empty route source at line ${index + 1}`);
      continue;
    }
    const destinationMatch = trimmed.match(/^destination:\s*(.*)$/);
    if (destinationMatch && current) {
      if (current.destination !== undefined) {
        configFail(`render.yaml: duplicate route destination at line ${index + 1}`);
      }
      current.destination = unquote(destinationMatch[1].trim());
      if (!current.destination) configFail(`render.yaml: empty route destination at line ${index + 1}`);
      routes.push(current);
      current = null;
      continue;
    }
    configFail(`render.yaml: unrecognized line inside routes block at line ${index + 1}: ${trimmed}`);
  }

  if (current) configFail('render.yaml: route entry missing fields at end of file');
  if (routes.length === 0) configFail('render.yaml: no routes block found');
  for (const route of routes) {
    if (route.type !== 'rewrite' && route.type !== 'redirect') {
      configFail(`render.yaml: unsupported route type "${String(route.type)}"`);
    }
    if (route.source === undefined || route.destination === undefined) {
      configFail('render.yaml: incomplete route entry (source and destination are required)');
    }
  }
  return routes;
}

export const SECURITY_HEADER_VALUES = {
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

/** The single accepted SPA fallback: serve index.html for any unknown path. */
const ACCEPTED_SPA_FALLBACK = { type: 'rewrite', source: '/*', destination: '/index.html' };

/** Runtime validation: exactly the accepted SPA rewrite, nothing else. */
export function assertAcceptedSpaFallback(routes) {
  if (routes.length !== 1) {
    configFail(
      `render.yaml: expected exactly one route (the accepted SPA fallback ${ACCEPTED_SPA_FALLBACK.source} -> ${ACCEPTED_SPA_FALLBACK.destination}), found ${routes.length}`
    );
  }
  const route = routes[0];
  if (
    route.type !== ACCEPTED_SPA_FALLBACK.type ||
    route.source !== ACCEPTED_SPA_FALLBACK.source ||
    route.destination !== ACCEPTED_SPA_FALLBACK.destination
  ) {
    configFail(
      `render.yaml: route ${route.type} ${route.source} -> ${route.destination} is not the accepted SPA fallback ${ACCEPTED_SPA_FALLBACK.source} -> ${ACCEPTED_SPA_FALLBACK.destination}`
    );
  }
  return route;
}

function selfTest() {
  const checks = [];
  const assert = (condition, message) => {
    if (!condition) fail(`self-test failed: ${message}`);
    checks.push(message);
  };
  const expectFail = (fn, message) => {
    let failed = false;
    try {
      fn();
    } catch {
      failed = true;
    }
    assert(failed, message);
  };

  const real = fs.readFileSync(path.join(repoRoot, 'render.yaml'), 'utf8');

  // 1. Known-good: the REAL render.yaml headers parse and match the accepted set.
  const realHeaders = parseRenderHeaders(real);
  assertKnownHeaders(realHeaders);
  assert(realHeaders.length >= 6, `real render.yaml parses with ${realHeaders.length} headers`);
  assert(
    realHeaders.every((header) => header.path === '/*'),
    'all headers apply to every path'
  );

  // 2. Known-good: the REAL render.yaml routes parse and are the accepted SPA rewrite.
  const realRoutes = parseRenderRoutes(real);
  assertAcceptedSpaFallback(realRoutes);
  assert(realRoutes.length === 1, 'real render.yaml declares exactly one SPA fallback route');

  // 3. Planted violation: a header with an unexpected value must fail the parse.
  const plantedValue =
    'services:\n' +
    '  - type: web\n' +
    '    headers:\n' +
    '      - path: /*\n' +
    '        name: Referrer-Policy\n' +
    '        value: unsafe-url\n';
  expectFail(() => assertKnownHeaders(parseRenderHeaders(plantedValue)), 'planted Referrer-Policy drift is rejected');

  // 4. Planted violation: an unexpected extra header must fail the parse.
  const plantedExtra =
    'headers:\n' + '  - path: /*\n' + '    name: X-Debug-All\n' + '    value: "true"\n';
  expectFail(() => assertKnownHeaders(parseRenderHeaders(plantedExtra)), 'planted unknown header is rejected');

  // 5. Planted violation: unrecognized line inside the headers block fails.
  const plantedGarbage = 'headers:\n  - path: /*\n    bogus: yes\n';
  expectFail(() => parseRenderHeaders(plantedGarbage), 'planted malformed headers block is rejected');

  // 6. Planted violation: a `redirect` (URL changes) is NOT the accepted fallback.
  const plantedRedirect =
    'routes:\n' +
    '  - type: redirect\n' +
    '    source: /*\n' +
    '    destination: /index.html\n';
  expectFail(
    () => assertAcceptedSpaFallback(parseRenderRoutes(plantedRedirect)),
    'planted redirect instead of rewrite is rejected'
  );

  // 7. Planted violation: a rewrite to the wrong destination fails.
  const plantedDestination =
    'routes:\n' +
    '  - type: rewrite\n' +
    '    source: /*\n' +
    '    destination: /home.html\n';
  expectFail(
    () => assertAcceptedSpaFallback(parseRenderRoutes(plantedDestination)),
    'planted wrong fallback destination is rejected'
  );

  // 8. Planted violation: a malformed route entry (missing destination) fails.
  const plantedMissing = 'routes:\n  - type: rewrite\n    source: /*\n';
  expectFail(() => parseRenderRoutes(plantedMissing), 'planted route missing destination is rejected');

  // 9. Sibling blocks do not bleed into each other.
  const sibling = 'headers:\n  - path: /*\n    name: X-Frame-Options\n    value: DENY\nroutes:\n  - type: rewrite\n    source: /*\n    destination: /index.html\n';
  const siblingHeaders = parseRenderHeaders(sibling);
  assert(siblingHeaders.length === 1, 'headers parser stops at the sibling routes block');
  const siblingRoutes = parseRenderRoutes(sibling);
  assertAcceptedSpaFallback(siblingRoutes);
  assert(siblingRoutes.length === 1, 'routes parser ignores the preceding headers block');

  process.stdout.write(`preview-server self-test: ${checks.length} checks passed\n`);
}

function serve(options) {
  const distDir = path.resolve(repoRoot, options.dist);
  if (!fs.existsSync(path.join(distDir, 'index.html'))) {
    fail(`dist/index.html not found under ${distDir}; run \`npm run build\` first`);
  }
  const renderYaml = fs.readFileSync(path.join(repoRoot, 'render.yaml'), 'utf8');
  const parsedHeaders = parseRenderHeaders(renderYaml);
  assertKnownHeaders(parsedHeaders);
  const headers = parsedHeaders;
  // SPA fallback from the accepted render.yaml rewrite (Render's mechanism).
  const fallback = assertAcceptedSpaFallback(parseRenderRoutes(renderYaml));

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
      // SPA fallback per the render.yaml rewrite (`/* -> /index.html`).
      filePath = path.join(distDir, fallback.destination.replace(/^\//, ''));
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
    process.stdout.write(`preview-server: serving ${distDir} on http://127.0.0.1:${options.port}/ with ${headers.length} security headers and the render.yaml SPA fallback ${fallback.source} -> ${fallback.destination}\n`);
  });
  server.on('error', (error) => fail(`cannot start preview server: ${error.message}`));

  const shutdown = () => {
    server.close();
    process.exit(0);
  };
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

// Run the CLI only when this file is executed directly. The render.yaml
// parsers and the accepted header policy are imported by the read-only remote
// release-QA harness (HARDEN-02 WU-F); importing must never start a server as
// a side effect.
const isDirectExecution =
  process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isDirectExecution) {
  const options = parseArgs(process.argv.slice(2));
  if (options['self-test']) {
    selfTest();
    process.exit(0);
  }
  serve(options);
}
