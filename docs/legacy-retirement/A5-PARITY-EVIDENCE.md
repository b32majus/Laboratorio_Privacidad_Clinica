# A5 parity evidence — orphan styles and vendored bundles (T25 #29)

Status: **FACTUAL EVIDENCE for the review of this candidate** (Work Order
T25 #29; A1 premise refuted by recovered lifecycle, A2/A3/A4 approved).

## Premise check: does deleting these styles/bundles break any page?

No. Verified against the remaining surface set (index, funcionamiento, guia,
terminos + app-v4):

- `css/base|components|landing|layout|variables.css`: referenced by ZERO
  remaining pages (`grep css/<name>.css *.html` — only the retired pages
  used them; `check:links` fails on any broken reference and passes);
- `css/tailwind.generated.css` regenerates via `build:tailwind` without the
  retired surfaces (build green);
- `lib/jspdf.umd.min.js`, `lib/jszip.min.js`, `lib/mammoth.browser.min.js`:
  loaded only by the already-retired pages (review/batch/input/
  batch-review-legacy). The V4 runtime uses npm `mammoth` via dynamic
  import (only DOCX) and vendored pdf.js/xlsx from `app-v4/public/vendor/`
  (unchanged, still manifest-governed);
- `scripts/ci/vendor-manifest.json` drops exactly the three retired
  entries; `check:vendor` passes (17 entries, sha256 coverage of lib/,
  fonts/, vendor/).

SEC-001 (legacy xmldom residual) is thereby fully eliminated from the
repository. Evidence-only file: no product code, no tests, no E2E change.
