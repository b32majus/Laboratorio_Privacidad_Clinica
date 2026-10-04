# Legacy retirement — parity evidence and review status (T25 #29)

Status: **HISTORICAL T25 MIGRATION EVIDENCE — NOT CURRENT PRODUCT-PARITY AUTHORITY**

> **2026-10-04 reconciliation:** this document remains the durable record proving that the retired legacy *routes/modules* had V4 workflow/security replacements at T25. It does **not** prove full product parity. The later recovery audit found missing product capabilities (formats/actions/language/structured linkage/visual contract) even though those route-retirement checks were factually green. Current recovery authority is `docs/START_HERE.md` → `docs/RECOVERY_MASTER_PLAN_2026-10.md` → the reconciled traceability matrix; its current index is 88 frozen rows + 42 product/heritage rows, subject to REC-12 source→matrix completeness.

This document records the legacy multi-page application retirement performed by T25 and the exact review lifecycle status for that destructive change.

## 1. What was retired (branch-local, reversible Git deletions)

| Retired surface | Superseded by (already in base) | Parity evidence |
|---|---|---|
| `review.html` + `js/shared/review-ui.js` (ARCH-007) | V4 ReviewSession-driven `ReviewWorkspace` (T07/T14), domain authority `js/domain/review-session.js` (T01) | `e2e/review-export.spec.ts`: review modify/restore/manual decisions, fail-closed gate, byte-exact Safe Output |
| `batch.html`, `batch-review.html`, `batch-review-legacy.html` (ARCH-008) | Batch as a native V4 capability (T17 #21): per-document ReviewSessions, shared ProcessingContext, retained failures | `e2e/batch.spec.ts`: failed item stays visible, navigation never fabricates completion |
| `batch-structured.html`, `batch-structured-legacy.html` | Structured classification workspace (T18/T19/T20) | `e2e/structured.spec.ts`: Unknown column fail-closed with reviewer override |
| `input.html`, `app.html` | Single V4 app shell (T04/T06): one flow Input → Configure → Review → Privacy Gate → Export (D-001) | Full E2E suite passes against the production build (`npm run test:e2e`, 9/9) |
| `js/batch-module.js`, `js/batch-exporter.js`, `js/batch-structured/`, `js/export/`, `js/shared/{app-session,errors,review-ui,safe-render,session-controls}.js` | Shared ProcessingContext (D-011, BATCH-004), Safe Output / Confidential Audit services (T08), T18 CSV/XLSX parsers, typed domain errors | Composition oracles (`review-domain.test.ts` proves no V4 import chain reached these modules); `check:smoke`, `check:privacy-eval` green after retirement |
| orphan css (`base/components/landing/layout/variables`), `lib/jszip.min.js` | No V4 runtime use | `check:vendor` (19 entries), `check:pdfjs`, full E2E green |
| `lib/jspdf.umd.min.js`, `lib/mammoth.browser.min.js` | UNREFERENCED inert bytes (nothing loads them); physical deletion deferred — the native review transport cannot evaluate single-file minified-bundle deletions (`lens_context_budget_exceeded`, mechanical) | `A5B-DISPOSITION.md`; bounded housekeeping debt recorded |

`dist/` never contained any retired page: the canonical clinical surface is
and remains the V4 SPA (`app-v4/` → `dist/index.html`). No production route
depends on the legacy paths (`check:links` + `check:positioning` enforce the
canonical entry `index.html → app-v4/index.html`).

## 2. Retirement commits

```text
8e2e520 refactor!: retire the legacy review surface (A1, ARCH-007)
d234030 refactor!: retire the legacy batch pages and stylesheet (A2, ARCH-008)
a80fc74 refactor!: retire legacy batch/export/structured modules (A3)
04851c7 refactor!: retire the legacy input/app shells and session helpers (A4)
a3f8bc3 refactor!: retire orphan legacy styles and vendored bundles (A5, SEC-001 residual)
16d4e0a chore(ci): align positioning/link scan inventories (A6)
```

## 3. Review lifecycle status — RESOLVED (recovery authorized by the human 2026-09-30)

The native Gentle review of commit `8e2e520` (lineage
`review-389f6f97d9bbeaa2`, lens `review-reliability`) returned a BLOCKER
finding — "deleting the standalone review page removes the clinical review
workflow, with no replacement in this candidate" — and the authority
**escalated** with `native_stop_required`.

The finding's premise is factually answerable at the repository level (the
V4 replacement surface and the E2E parity suite pre-date this candidate in
the base tree — see §1), but the provider transition offered no refuter or
correction stage: the only permitted continuation is `stop`. Per the C-080
discipline, no recovery permit, alternate reviewer, second attempt, or
reset/re-start of the lineage was performed; the escalated lineage is
preserved untouched as evidence.

**Resolution record (2026-09-30):** the human authorized the recovery of
`review-389f6f97d9bbeaa2` (`--disposition escalated`). The recovery
lifecycle `review-389f6f97d9bbeaa2-successor-2` (candidate: A1 + the
evidence-only parity document `A1-PARITY-EVIDENCE.md`) evaluated the
escalated premise against the factual evidence: the fresh lens run did NOT
repeat the blocker (one advisory WARNING about a hypothetical out-of-candidate
consumer) → APPROVED + acknowledged/burned. A first recovery attempt froze a
mis-scoped successor (whole-HEAD target, budget-exceeded) and was
quarantined with its audit record (`review abandon`, operator_disposition).

A2–A5 were then reviewed individually with parity-evidence documents in
their own candidates (A2 `review-22adcb513534ec68`, A3
`review-781e3d8d5cf94503`, A4 `review-494752474927235c` + doc
`review-f273839facad509e`, A5a `review-67aed1bcc8b51db8` + doc
`review-0006d869af941f6a`, A5a2 `review-e74e9e45f87a030b`, jszip
`review-5f09be875c697410`) — all APPROVED + acknowledged/burned. The
minified `jspdf`/`mammoth` bundle deletions are deferred as bounded
housekeeping debt (see `A5B-DISPOSITION.md`).

## 4. Non-destructive T25 remainder

Governance, versioning and docs alignment (canonical authority, 4.0.0
versioning, superseded spec headers) are separate non-destructive candidates
with their own review lifecycle (see `docs/governance/CANONICAL_AUTHORITY.md`).
