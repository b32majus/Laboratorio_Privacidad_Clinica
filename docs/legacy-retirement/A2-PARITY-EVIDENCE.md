# A2 parity evidence — legacy batch pages retirement (T25 #29)

Status: **FACTUAL EVIDENCE for the review of this candidate** (Work Order
T25 #29; same destructive-retirement lifecycle as A1, whose escalated
premise was already refuted by the recovered lifecycle
`review-389f6f97d9bbeaa2-successor-2`, APPROVED/burned).

## Premise check: does deleting the batch pages remove the batch workflow?

No. The batch workflow's replacement exists in the BASE tree and predates
this candidate:

- Batch is a native V4 capability (T17 #21): per-document ReviewSessions,
  shared ProcessingContext, retained failed items — `app-v4/src/`
  (`useJobSession.ts`, `domain/job.ts`, `review/BatchReviewView.tsx`);
- `e2e/batch.spec.ts` (T21 #25, integrated via PR #45): "a failed batch item
  stays visible and never blocks the rest of the batch silently" and
  "navigation never fabricates review completion" — passing against the
  production build;
- the structured flow is the T18/T19/T20 shell (`e2e/structured.spec.ts`);
- `dist/` (the only production surface) never contained `batch.html`,
  `batch-review.html`, `batch-review-legacy.html`, `batch-structured.html`
  or `batch-structured-legacy.html`; `check:links` + `check:positioning`
  enforce the canonical V4 entry with zero references to them;
- `css/batch.css` is referenced by no remaining page.

This candidate removes only the superseded duplicate surfaces and their
stylesheet. Evidence-only file: no product code, no tests, no E2E change.
