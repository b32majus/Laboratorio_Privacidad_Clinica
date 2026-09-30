# A1 parity evidence — legacy review surface retirement (T25 #29)

Status: **FACTUAL EVIDENCE for the recovered review of commit 8e2e520**
(Work Order T25 #29; human-authorized recovery of escalated lineage
`review-389f6f97d9bbeaa2`, disposition `escalated`).

## The escalated premise, verified against the repository

Premise (original BLOCKER): "deleting the standalone review page removes the
clinical review workflow, with no replacement in this candidate."

Verification against current authority/code/tests: **the replacement exists
in the BASE tree and predates this candidate.** This candidate deletes
`review.html` + `js/shared/review-ui.js` (the legacy DOM-dataset review
page, ARCH-007). The canonical clinical review workflow in this repository
is the V4 ReviewSession-driven surface, already integrated before T25:

- `app-v4/src/review/ReviewWorkspace.tsx` — three-pane review workspace over
  the domain authority (T07 #11);
- `js/domain/review-session.js` + `app-v4/src/review/review-domain.ts` —
  ReviewSession is the ONLY review authority (T01 #4, D-004);
- decision vocabulary: modified / restored / manual detection / low-confidence
  queue (T07/T14) — `e2e/review-export.spec.ts` exercises modify, restore,
  manual detection, and the fail-closed export gate against the production
  build;
- Safe Output / Confidential Audit separation (T08 #12) with byte-exact
  assertions in the same spec;
- `e2e/` critical suite (T21 #25, integrated via PR #45): 9/9 passing,
  including the network privacy invariant;
- composed closeout of the train branch: full deterministic chain green
  (850 vitest, ground-truth 100/100, lint/typecheck/format, production
  build, header/no-network preview evidence);
- `dist/` (the only production surface) has never contained `review.html`;
  `check:links` + `check:positioning` enforce the canonical entry
  (`index.html -> app-v4/index.html`) with zero references to retired pages.

## Disposition

The deletion does not remove the clinical review workflow: the workflow's
replacement was already the base's production surface, and this candidate
removes only the superseded duplicate. Any residual claim that the workflow
is removed is therefore base-only/pre-existing content confusion, not a
defect introduced by this candidate.

This file is evidence for the review lifecycle only; it changes no product
code, no test, and no E2E oracle.
