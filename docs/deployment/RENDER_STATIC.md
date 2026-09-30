# Render Static deployment — clinical origin (T24 #28)

Status: **CURRENT**
Authority: `SPEC_V4_QUALITY_SECURITY_DEPLOY.md` §9, `CURRENT_DECISIONS.md` D-014/D-015, Work Order T24 #28.

## 1. Deployment shape

- **Only static build output is served.** The single service in `render.yaml`
  is `runtime: static` with `staticPublishPath: ./dist`. No Render
  server/worker/function ever processes clinical content: the application
  runs entirely in the user's browser (local-first, D-013/D-014).
- **Build** is reproducible: `npm ci && npm run build` (lockfile-pinned
  dependencies; vendor manifest governed by `check:vendor`).
- **SPA fallback**: the `render.yaml` `routes:` rewrite
  (`type: rewrite`, `source: /*`, `destination: /index.html`). This is the
  accepted Render Static Site mechanism: Render rewrites an unknown path to
  the SPA entry with HTTP 200 while still serving a real resource when one
  exists at the path. A Netlify-style `dist/_redirects` file is **not**
  interpreted by Render (it is only served as a static asset), so it was
  removed after live verification showed deep routes returning 404 on the
  real origin while the local preview (which modelled `_redirects`) wrongly
  passed.

## 2. Security headers (single authority)

`render.yaml` is the SINGLE authority for the deployed headers:

| Header | Value |
|---|---|
| Content-Security-Policy | `default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; font-src 'self'; connect-src 'self'; worker-src 'self'; manifest-src 'self'; object-src 'none'; base-uri 'self'; frame-ancestors 'none'; form-action 'self'` |
| Referrer-Policy | `no-referrer` |
| X-Content-Type-Options | `nosniff` |
| X-Frame-Options | `DENY` |
| Cross-Origin-Opener-Policy | `same-origin` |
| Permissions-Policy | `camera=(), microphone=(), geolocation=(), payment=(), usb=(), magnetometer=(), accelerometer=(), gyroscope=()` |
| Strict-Transport-Security | `max-age=31536000; includeSubDomains` |

The local preview harness (`scripts/deploy/preview-server.mjs`) PARSES
`render.yaml` at runtime and validates it against the accepted policy set —
both the security headers and the single accepted SPA rewrite
(`/* -> /index.html`) — so the local preview can never drift from the
deployed configuration. Any header or route change requires updating
`render.yaml` and the preview validator together; the assertion suite fails
closed on drift. `scripts/deploy/header-assertions.mjs` then makes real HTTP
requests against that preview, including a deep-route fallback assertion.

## 3. Reproduce the deployment locally (no Render account needed)

```bash
npm run build                       # production dist/ (incl. worker + lazy chunks)
npm run preview:deploy              # serve dist/ with the EXACT render.yaml headers
npm run check:headers               # real HTTP header assertions against the preview
npm run test:e2e:preview            # Playwright happy path + no-network smoke UNDER the real CSP
npm run check:headers:selftest      # assertion-oracle self-test (planted violations)
npm run check:preview:selftest      # preview config parser self-test (planted violations)
```

## 4. Real evidence recorded for T24 #28

- `check:headers`: 5 real HTTP assertions against the served preview —
  SPA entry, built asset, vendored pdf.js worker, deep-route SPA fallback,
  non-GET refusal — every response carries the full header set with exact
  values and explicit content-types.
- `test:e2e:preview`: the canonical review→export flow and the network
  privacy invariant (including the adversarial planted-request tests)
  execute in a real browser UNDER the deployed CSP; the adversarial tests
  now assert that a planted external request is caught by AT LEAST ONE
  defense (monitor recorder or CSP block) — a request caught by neither
  fails the suite.

## 5. Live-origin reconciliation (HARDEN-01 WU-D)

Read-only verification of the real origin
`https://laboratorio-privacidad-clinica.onrender.com` on 2026-09-30 found:

- the deployed security headers matched this document (CSP, Referrer-Policy,
  X-Content-Type-Options, X-Frame-Options, COOP, Permissions-Policy) except
  HSTS, where the platform emits `max-age=315360000; includeSubDomains;
  preload` (stronger than the `max-age=31536000; includeSubDomains` declared
  here);
- `GET /` served the built SPA and `/assets/*` served the built bundles;
- **deep routes 404ed** (`GET /review` and `/workspace` returned
  `404 text/plain`): the `_redirects` file was only being served as a static
  asset, never applied as a fallback.

This made the SPA-fallback property required by SPEC §9 false on the real
origin while the local preview passed — a T24 configuration defect, not a new
deployment/security/product decision. The bounded correction is the
`render.yaml` `routes:` rewrite above plus the preview/server/oracle update in
this commit. No remote Render configuration was changed during the train; the
correction reaches production only on the next authorized deployment.

## 6. Remote deployment (publication handoff)

Creating the actual Render Static service requires an authorized Render
account/credentials. Under the LOCAL_ONLY execution boundary of the
current prepared train, no remote deployment was performed; this remains a
**publication/governance handoff** owned by the human:

1. create/choose the Render account and add the service from `render.yaml`;
2. verify the first deployment with `npm run check:headers` pointed at the
   preview URL (`HEADER_CHECK_PORT`/BASE is local-only today; point the
   assertions at the deployed origin);
3. production/custom-domain and OPS-01 (LaLiga availability experiment)
   remain separate, human-owned decisions.

No analytics exist to configure: there is no third-party runtime resource
on the clinical origin (`check:external` in CI enforces zero), and no
analytics/telemetry keys are used anywhere.
