# A4 parity evidence — legacy input/app shells and session helpers (T25 #29)

Status: **FACTUAL EVIDENCE for the review of this candidate** (Work Order
T25 #29; A1's escalated premise refuted by the recovered lifecycle, A2/A3
approved clean).

## Premise check: does deleting app.html/input.html and the shared helpers
## remove the clinical input workflow?

No. The single V4 app shell (T04/T06; D-001: one continuous flow
Input → Configure → Review → Privacy Gate → Export) already replaced them in
the base:

- `app-v4/src/App.tsx` + `useJobSession.ts` — the only production entry and
  state bridge; input adapters (`input/extract.ts`) with fail-closed typed
  errors replaced the legacy FileReader glue (`app-session.js` sessionStorage
  shuttle is prohibited in V4 by `check:storage` + BATCH-002);
- typed domain errors (`domain/job.ts` JobModelError, ReviewSessionError,
  EngineError, PolicyError) replaced `js/shared/errors.js` alert()-style
  handling (CODE-003 direction);
- `e2e/review-export.spec.ts`, `e2e/pdf.spec.ts`, `e2e/batch.spec.ts`,
  `e2e/structured.spec.ts` exercise input → export end-to-end on the
  production build (9/9, T21 #25 via PR #45);
- `dist/` never contained `app.html` or `input.html`; `check:links` +
  `check:positioning` pin the canonical entry (`index.html ->
  app-v4/index.html`).

`safe-render.js` and `session-controls.js` served only the retired pages'
DOM surfaces. Evidence-only file: no product code, no tests, no E2E change.
