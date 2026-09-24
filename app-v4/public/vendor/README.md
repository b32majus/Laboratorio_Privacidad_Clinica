# Vendored runtime assets (V4)

These files are git symlinks to the governed legacy vendor bundles
(`lib/pdf.min.js`, `lib/pdf.worker.min.js`, both covered by
`scripts/ci/vendor-manifest.json` with sha256, version and upstream
provenance). At serve/build time the symlinks resolve to the governed
bytes, so the assets served same-origin to the V4 PDF input adapter are
byte-identical to the single governed source of truth in `lib/`.
Symlink storage keeps the repository free of a second 316 KB byte-duplicate
and keeps review candidates for this surface textually small.

Rules enforced by the repository:

- The symlinks resolve to bytes governed by `scripts/ci/vendor-manifest.json`
  (`copyOf` entries; hash verification follows the symlink on every run via
  `npm run check:vendor`).
- pdf.js is NEVER bundled into the V4 application chunks. The adapter loads
  `/vendor/pdf.min.js` lazily on first PDF use and points the worker at
  `/vendor/pdf.worker.min.js` (both same-origin).
- Every active `getDocument()` call site in V4 sources must pass
  `isEvalSupported: false` (CVE-2024-4367 mitigation, enforced by
  `npm run check:pdfjs`).
- No other runtime file may be added to this directory without a governed
  vendor-manifest entry (`check:vendor` enforces coverage).
