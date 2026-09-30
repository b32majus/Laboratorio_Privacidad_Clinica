#!/usr/bin/env node
// Read-only live deployment release-QA harness (HARDEN-02 WU-F; issue #49).
//
// Purpose: verify the ACCEPTED release invariants against an explicitly
// parameterized origin WITHOUT mutating it and using synthetic probes only:
//
//   1. `/` returns the SPA entry;
//   2. the deep routes `/review` and `/workspace` resolve via the accepted
//      render.yaml rewrite (`/* -> /index.html`) with HTTP 200, not 404;
//   3. the governed security headers match render.yaml (the single authority,
//      parsed here by scripts/deploy/preview-server.mjs; HSTS is
//      platform-strengthened by Render and is checked "at least as strict");
//   4. the same-origin built asset and the vendored PDF worker load;
//   5. the served HTML references zero external (third-party) runtime
//      resources.
//
// It also fingerprints the served build against the LOCAL `dist/index.html`
// (Vite content-hashed asset names) so its output distinguishes
//   - "the remote origin still serves a DIFFERENT commit" (stale release;
//     reported separately, exit 3), from
//   - "the remote build matches the local commit but a governed behavior is
//     wrong" (exit 1).
//
// This is NOT a CI gate against the live network. The deterministic
// `--self-test` proves the harness can disagree: planted header drift, a
// deep-route 404 and an external runtime reference are each detected against
// an in-process fake origin. That self-test IS wired into `npm test`/CI.
//
// Privacy: synthetic probes only; no clinical content; GET/HEAD only; zero
// writes to the remote origin.
//
// Exit codes: 0 = pass; 1 = behavior failure; 3 = release-state mismatch
// (remote serves a different commit); 4 = harness usage/error.

import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { SECURITY_HEADER_VALUES } from './preview-server.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '..', '..');

export const DEFAULT_REMOTE_BASE_URL = 'https://laboratorio-privacidad-clinica.onrender.com';
export const REMOTE_QA_SCHEMA = 'harden-02.remote-release-qa/v1';

/** Deep routes that the accepted render.yaml SPA rewrite must resolve. */
export const DEEP_ROUTES = ['/review', '/workspace'];

/** Same-origin vendored PDF worker path used by the app. */
export const PDF_WORKER_PATH = '/vendor/pdf.worker.min.js';

function fail(message) {
  process.stderr.write(`remote-release-qa: ${message}\n`);
  process.exit(4);
}

function parseArgs(argv) {
  const options = {
    'base-url': process.env.REMOTE_BASE_URL ?? DEFAULT_REMOTE_BASE_URL,
    'local-index': null,
    'self-test': false,
    json: false,
  };
  for (const arg of argv) {
    if (arg === '--self-test') options['self-test'] = true;
    else if (arg === '--json') options.json = true;
    else {
      const match = arg.match(/^--([a-z-]+)=(.+)$/);
      if (!match || !(match[1] in options)) fail(`unknown or malformed argument: ${arg}`);
      options[match[1]] = match[2];
    }
  }
  return options;
}

async function fetchText(url) {
  const response = await fetch(url, {
    redirect: 'manual',
    headers: { 'user-agent': 'harden-02-remote-release-qa/1' },
  });
  const body = await response.text();
  return {
    status: response.status,
    headers: Object.fromEntries(response.headers.entries()),
    body,
  };
}

/** Collects the read-only probes for one origin (network I/O only). */
export async function collectProbes(origin) {
  const base = new URL(origin);
  const entry = await fetchText(new URL('/', base));
  const deep = {};
  for (const route of DEEP_ROUTES) {
    deep[route] = await fetchText(new URL(route, base));
  }
  const assetPath =
    (entry.body.match(/(?:src|href)\s*=\s*["'](\/assets\/[^"']+\.js)["']/i) ?? [])[1] ?? null;
  const asset = assetPath ? await fetchText(new URL(assetPath, base)) : null;
  const worker = await fetchText(new URL(PDF_WORKER_PATH, base));
  return { entry, deep, assetPath, asset, worker };
}

/** Extracts the Vite content-hashed asset paths referenced by an HTML document. */
export function assetNames(html) {
  const names = new Set();
  const re = /(?:src|href)\s*=\s*["'](\/assets\/[^"']+)["']/gi;
  let match;
  while ((match = re.exec(html)) !== null) names.add(match[1]);
  return [...names].sort();
}

/** Absolute or protocol-relative references whose host differs from `origin`. */
export function findExternalReferences(html, origin) {
  const originHost = new URL(origin).host;
  const references = new Set();
  const attrRe = /(?:src|href)\s*=\s*["']([^"']+)["']/gi;
  let match;
  while ((match = attrRe.exec(html)) !== null) {
    const value = match[1].trim();
    if (!/^(https?:)?\/\//i.test(value)) continue;
    let resolved;
    try {
      resolved = new URL(value, origin);
    } catch {
      continue;
    }
    if (resolved.host !== originHost) references.add(value);
  }
  return [...references];
}

/**
 * Header comparison. Render strengthens HSTS (longer `max-age`, adds
 * `preload`); the check is therefore "at least as strict" for HSTS (numeric
 * max-age >= configured, every configured directive present). Every other
 * governed header must match the accepted value exactly.
 */
export function compareHeader(name, actual, expected) {
  if (actual === expected) return { ok: true, detail: 'exact' };
  if (name === 'strict-transport-security') {
    const parseDirectives = (value) => {
      const directives = new Map();
      for (const part of String(value ?? '')
        .toLowerCase()
        .split(';')
        .map((item) => item.trim())
        .filter(Boolean)) {
        const [key, rawValue] = part.split('=');
        directives.set(key.trim(), rawValue === undefined ? true : rawValue.trim());
      }
      return directives;
    };
    const actualDirectives = parseDirectives(actual);
    const problems = [];
    for (const [key, value] of parseDirectives(expected)) {
      if (key === 'max-age') {
        const actualAge = Number(actualDirectives.get('max-age'));
        const expectedAge = Number(value);
        if (!Number.isFinite(actualAge) || actualAge < expectedAge) {
          problems.push(`max-age ${String(actualDirectives.get('max-age'))} < ${String(value)}`);
        }
      } else if (!actualDirectives.has(key)) {
        problems.push(`missing ${key}`);
      }
    }
    return {
      ok: problems.length === 0,
      detail: problems.length === 0 ? 'platform-strengthened' : problems.join(', '),
    };
  }
  return { ok: false, detail: `expected "${expected}", received "${actual}"` };
}

/**
 * Pure evaluation of the collected probes. Deterministic: same probes + same
 * expected headers + same local index produce the same report.
 */
export function evaluateReleaseReport(origin, probes, options = {}) {
  const expectedHeaders = options.expectedHeaders ?? SECURITY_HEADER_VALUES;
  const localIndexHtml = options.localIndexHtml ?? null;
  const checks = [];
  const add = (name, kind, ok, detail) => checks.push({ name, kind, ok, detail });

  // 1. SPA entry.
  add('/', 'behavior', probes.entry.status === 200, `HTTP ${probes.entry.status}`);
  const entrySpa = probes.entry.body.includes('<div id="root">');
  add('/ serves the V4 SPA entry', 'behavior', entrySpa, entrySpa ? 'ok' : 'missing #root');

  // 2. Security headers on the entry and the deep routes.
  const headerTargets = [['/', probes.entry], ...DEEP_ROUTES.map((route) => [route, probes.deep[route]])];
  for (const [label, probe] of headerTargets) {
    // A non-200 probe (e.g. a stale-build deep-route 404) is already reported
    // by its own status check; the header contract is asserted on served 200s.
    if (probe.status !== 200) continue;
    for (const [name, expected] of Object.entries(expectedHeaders)) {
      const actual = probe.headers[name];
      const { ok, detail } = compareHeader(name, actual, expected);
      add(`${label} header ${name}`, 'behavior', ok, detail);
    }
  }

  // 3. Deep-route SPA fallback (the accepted render.yaml rewrite).
  let deepRouteFailure = false;
  for (const route of DEEP_ROUTES) {
    const probe = probes.deep[route];
    const ok = probe.status === 200 && probe.body.includes('<div id="root">');
    deepRouteFailure ||= !ok;
    add(`${route} SPA fallback`, 'behavior', ok, `HTTP ${probe.status}`);
  }

  // 4. Same-origin built asset.
  if (probes.assetPath === null || probes.asset === null) {
    add('built JS asset present in the served HTML', 'behavior', false, 'no /assets/*.js reference');
  } else {
    const type = probes.asset.headers['content-type'] ?? '';
    add(
      `built asset ${probes.assetPath}`,
      'behavior',
      probes.asset.status === 200 && type.includes('javascript'),
      `HTTP ${probes.asset.status}, content-type "${type}"`
    );
  }

  // 5. Vendored PDF worker.
  const workerOk = probes.worker.status === 200;
  add('vendored PDF worker served', 'behavior', workerOk, `HTTP ${probes.worker.status}`);

  // 6. Zero external runtime references in the served HTML.
  const externalReferences = findExternalReferences(probes.entry.body, origin);
  add(
    'zero external runtime references in served HTML',
    'behavior',
    externalReferences.length === 0,
    externalReferences.length === 0 ? 'ok' : externalReferences.join(', ')
  );

  // 7. Release fingerprint vs the local build.
  const remoteAssets = assetNames(probes.entry.body);
  const localAssets = localIndexHtml === null ? null : assetNames(localIndexHtml);
  let releaseState = 'unknown';
  let fingerprintDetail = 'no local dist/index.html to compare';
  if (localAssets !== null) {
    const matches = localAssets.length > 0 && localAssets.join('\n') === remoteAssets.join('\n');
    releaseState = matches ? 'matches-local-build' : 'different-build';
    fingerprintDetail = matches
      ? `asset fingerprint matches (${remoteAssets.join(', ')})`
      : `local [${localAssets.join(', ')}] != remote [${remoteAssets.join(', ')}]`;
  }
  add('release fingerprint', 'release', true, fingerprintDetail);

  const behaviorFailures = checks.filter((check) => check.kind === 'behavior' && !check.ok);
  let verdict;
  if (behaviorFailures.length > 0) {
    verdict = releaseState === 'different-build' ? 'release-state-mismatch' : 'behavior-failure';
  } else if (releaseState === 'different-build') {
    verdict = 'release-state-mismatch';
  } else {
    verdict = 'pass';
  }

  return {
    schema: REMOTE_QA_SCHEMA,
    origin,
    release_state: releaseState,
    verdict,
    deep_route_failure: deepRouteFailure,
    external_references: externalReferences,
    checks,
    failures: behaviorFailures.map((check) => `${check.name}: ${check.detail}`),
  };
}

function exitCodeForVerdict(verdict) {
  if (verdict === 'pass') return 0;
  if (verdict === 'release-state-mismatch') return 3;
  return 1;
}

// ---------------------------------------------------------------------------
// Deterministic self-test (in-process fake origin; no network).
// ---------------------------------------------------------------------------

function startFakeOrigin(behaviors) {
  const server = http.createServer((req, res) => {
    const url = (req.url ?? '/').split('?')[0];
    const headers = { ...behaviors.headers };
    if (url === '/assets/app.js') {
      res.writeHead(200, { ...headers, 'content-type': 'text/javascript; charset=utf-8' });
      res.end('export const x = 1;\n');
      return;
    }
    if (url === PDF_WORKER_PATH) {
      res.writeHead(200, { ...headers, 'content-type': 'text/javascript; charset=utf-8' });
      res.end('/* worker */');
      return;
    }
    if (url === '/' || url === '/review' || url === '/workspace') {
      if (behaviors.deepRoute404 && url !== '/') {
        res.writeHead(404, headers);
        res.end('not found');
        return;
      }
      res.writeHead(200, { ...headers, 'content-type': 'text/html; charset=utf-8' });
      res.end(behaviors.indexHtml);
      return;
    }
    res.writeHead(404, headers);
    res.end();
  });
  return new Promise((resolve) => {
    server.listen(0, '127.0.0.1', () => {
      const address = server.address();
      resolve({ server, origin: `http://127.0.0.1:${address.port}` });
    });
  });
}

const GOOD_INDEX =
  '<!doctype html><html><body><div id="root"></div>' +
  '<script type="module" src="/assets/app.js"></script></body></html>';

async function runSelfTest() {
  const cases = [];
  const run = async (behaviors, assertFn) => {
    const { server, origin } = await startFakeOrigin(behaviors);
    try {
      const probes = await collectProbes(origin);
      const report = evaluateReleaseReport(origin, probes, {
        expectedHeaders: SECURITY_HEADER_VALUES,
        localIndexHtml: behaviors.localIndexHtml ?? GOOD_INDEX,
      });
      await assertFn(report);
    } finally {
      server.close();
    }
  };

  const goodHeaders = {
    ...SECURITY_HEADER_VALUES,
    // The platform strengthens HSTS; the known-good origin models that.
    'strict-transport-security': 'max-age=315360000; includeSubdomains; preload',
  };

  // Known-good: correct headers, deep routes, asset, worker, no external refs,
  // matching fingerprint -> pass.
  await run({ headers: goodHeaders, indexHtml: GOOD_INDEX }, async (report) => {
    cases.push({
      name: 'self-test: a correct origin passes',
      pass: report.verdict === 'pass',
      detail: `${report.verdict} / ${report.failures.join('; ') || 'no failures'}`,
    });
  });

  // Planted violation: header drift must fail.
  await run(
    {
      headers: { ...goodHeaders, 'content-security-policy': "default-src 'self'; script-src 'unsafe-inline'" },
      indexHtml: GOOD_INDEX,
    },
    async (report) => {
      cases.push({
        name: 'self-test: planted CSP drift is rejected',
        pass:
          report.failures.some((failure) => failure.includes('content-security-policy')) &&
          report.verdict === 'behavior-failure',
        detail: report.failures.join('; ') || 'no failure detected',
      });
    }
  );

  // Planted violation: missing HSTS directive must fail (platform may add, not remove).
  await run(
    {
      headers: { ...goodHeaders, 'strict-transport-security': 'max-age=3600; includeSubDomains' },
      indexHtml: GOOD_INDEX,
    },
    async (report) => {
      cases.push({
        name: 'self-test: weakened HSTS (shorter max-age) is rejected',
        pass: report.failures.some((failure) => failure.includes('strict-transport-security')),
        detail: report.failures.join('; ') || 'no failure detected',
      });
    }
  );

  // Planted violation: a deep route 404 despite a matching build is a behavior failure.
  await run({ headers: goodHeaders, indexHtml: GOOD_INDEX, deepRoute404: true }, async (report) => {
    cases.push({
      name: 'self-test: deep-route 404 is detected',
      pass: report.deep_route_failure && report.verdict === 'behavior-failure',
      detail: `${report.verdict} / deep_route_failure=${report.deep_route_failure}`,
    });
  });

  // Planted violation: an external runtime script reference is detected.
  await run(
    {
      headers: goodHeaders,
      indexHtml:
        '<!doctype html><html><body><div id="root"></div>' +
        '<script src="https://cdn.example.com/analytics.js"></script>' +
        '<script type="module" src="/assets/app.js"></script></body></html>',
    },
    async (report) => {
      cases.push({
        name: 'self-test: external runtime reference is detected',
        pass:
          report.external_references.includes('https://cdn.example.com/analytics.js') &&
          report.failures.some((failure) => failure.includes('external runtime')),
        detail: report.external_references.join(', ') || 'no external reference detected',
      });
    }
  );

  // Release-state discrimination: a different local fingerprint is reported as
  // a release-state mismatch, not a behavior failure.
  await run({ headers: goodHeaders, indexHtml: GOOD_INDEX }, async (report) => {
    const probes = await collectProbes(report.origin);
    const mismatch = evaluateReleaseReport(report.origin, probes, {
      expectedHeaders: SECURITY_HEADER_VALUES,
      localIndexHtml:
        '<!doctype html><html><body><div id="root"></div>' +
        '<script type="module" src="/assets/other-build.js"></script></body></html>',
    });
    cases.push({
      name: 'self-test: a different local build is reported as release-state-mismatch',
      pass: mismatch.release_state === 'different-build' && mismatch.verdict === 'release-state-mismatch',
      detail: `${mismatch.release_state} / ${mismatch.verdict}`,
    });
  });

  let allPass = true;
  for (const testCase of cases) {
    process.stdout.write(`${testCase.pass ? 'PASS' : 'FAIL'}: ${testCase.name}\n`);
    if (!testCase.pass) {
      process.stderr.write(`  detail: ${testCase.detail}\n`);
      allPass = false;
    }
  }
  process.stdout.write(`remote-release-qa self-test: ${cases.length} checks\n`);
  process.exit(allPass ? 0 : 1);
}

// ---------------------------------------------------------------------------
// CLI
// ---------------------------------------------------------------------------

async function main(options) {
  const origin = options['base-url'];
  let localIndexHtml = null;
  const localIndexPath = options['local-index'] ?? path.join(repoRoot, 'dist', 'index.html');
  if (fs.existsSync(localIndexPath)) localIndexHtml = fs.readFileSync(localIndexPath, 'utf8');

  let probes;
  try {
    probes = await collectProbes(origin);
  } catch (error) {
    fail(`cannot reach ${origin}: ${error instanceof Error ? error.message : String(error)}`);
  }
  const report = evaluateReleaseReport(origin, probes, {
    expectedHeaders: SECURITY_HEADER_VALUES,
    localIndexHtml,
  });

  if (options.json) {
    process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
  } else {
    process.stdout.write(`remote-release-qa ${report.verdict}: ${origin}\n`);
    process.stdout.write(`  release_state: ${report.release_state}\n`);
    const failed = report.checks.filter((check) => !check.ok);
    if (failed.length === 0) {
      process.stdout.write('  all checks passed\n');
    } else {
      for (const check of failed) process.stdout.write(`  FAIL ${check.name}: ${check.detail}\n`);
    }
  }
  process.exit(exitCodeForVerdict(report.verdict));
}

const options = parseArgs(process.argv.slice(2));
if (options['self-test']) {
  await runSelfTest();
}

const isDirectExecution =
  process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isDirectExecution) {
  await main(options);
}
