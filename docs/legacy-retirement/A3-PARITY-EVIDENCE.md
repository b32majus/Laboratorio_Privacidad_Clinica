# A3 parity evidence — legacy batch/export/structured modules (T25 #29)

Status: **FACTUAL EVIDENCE for the review of this candidate** (Work Order
T25 #29; same retirement lifecycle as A1/A2 — A1's escalated premise was
refuted by `review-389f6f97d9bbeaa2-successor-2`, APPROVED/burned; A2
approved clean).

## Premise check: do these deletions break any workflow?

No. Every deleted module served exclusively the retired legacy pages
(A1/A2, already deleted in this branch's base) and has a V4 replacement
already in the base:

- `js/batch-module.js` — sessionStorage payload shuttle + AsignadorSustitutos
  monkey patch; superseded by the explicit shared ProcessingContext
  (D-011/BATCH-004; isolation oracle in `review-domain.test.ts` proves the
  V4 path never monkey-patches);
- `js/batch-exporter.js` — Premium-framed ZIP export; superseded by the
  separate Safe Output / Confidential Audit services (T08 #12) with
  structural adversarial oracles;
- `js/batch-structured/*` — hand-rolled CSV/XLSX pipeline; superseded by
  the T18 fail-closed parsers (`structured/csv.ts`, `structured/excel.ts`,
  …) with planted-violation oracles;
- `js/export/*` — jsPDF report generation; no PDF generation exists in the
  V4 clinical origin.

Composition proof: the T11-era oracle asserts no `app-v4` import chain
reaches these modules (grep-verified per commit). The composed state is
deterministically green (850 vitest, `check:smoke`, `check:privacy-eval`
100/100, full E2E suite).
