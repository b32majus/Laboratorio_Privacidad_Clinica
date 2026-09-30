# Legacy retirement — parity evidence and review status (T25 #29)

Status: **CURRENT — PUBLICATION/HUMAN HANDOFF ON THE DESTRUCTIVE REVIEW**

This document is the durable parity map for the legacy multi-page application
retirement performed in this branch, and the exact record of the review
lifecycle status for that destructive change.

## 1. What was retired (branch-local, reversible Git deletions)

| Retired surface | Superseded by (already in base) | Parity evidence |
|---|---|---|
| `review.html` + `js/shared/review-ui.js` (ARCH-007) | V4 ReviewSession-driven `ReviewWorkspace` (T07/T14), domain authority `js/domain/review-session.js` (T01) | `e2e/review-export.spec.ts`: review modify/restore/manual decisions, fail-closed gate, byte-exact Safe Output |
| `batch.html`, `batch-review.html`, `batch-review-legacy.html` (ARCH-008) | Batch as a native V4 capability (T17 #21): per-document ReviewSessions, shared ProcessingContext, retained failures | `e2e/batch.spec.ts`: failed item stays visible, navigation never fabricates completion |
| `batch-structured.html`, `batch-structured-legacy.html` | Structured classification workspace (T18/T19/T20) | `e2e/structured.spec.ts`: Unknown column fail-closed with reviewer override |
| `input.html`, `app.html` | Single V4 app shell (T04/T06): one flow Input → Configure → Review → Privacy Gate → Export (D-001) | Full E2E suite passes against the production build (`npm run test:e2e`, 9/9) |
| `js/batch-module.js`, `js/batch-exporter.js`, `js/batch-structured/`, `js/export/`, `js/shared/{app-session,errors,review-ui,safe-render,session-controls}.js` | Shared ProcessingContext (D-011, BATCH-004), Safe Output / Confidential Audit services (T08), T18 CSV/XLSX parsers, typed domain errors | Composition oracles (`review-domain.test.ts` proves no V4 import chain reached these modules); `check:smoke`, `check:privacy-eval` green after retirement |
| `lib/jspdf.umd.min.js`, `lib/jszip.min.js`, `lib/mammoth.browser.min.js`, orphan css | No V4 runtime use (SEC-001 legacy residual eliminated; V4 DOCX uses npm mammoth via dynamic import) | `check:vendor` (17 entries), `check:pdfjs`, full E2E green |

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

## 3. Review lifecycle status — HUMAN STOP (native escalation)

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

**Exact pending human action (publication/governance handoff):**

1. Authorize a native review recovery for `review-389f6f97d9bbeaa2`
   (`gentle-ai review recover --disposition escalated` with the maintainer
   authorization binding) so the retirement chain A1–A6 can receive its
   reviewed lifecycle, **or** decide to revert the retirement commits
   (`git revert 16d4e0a a3f8bc3 04851c7 a80fc74 d234030 8e2e520`).
2. Until that decision, the retirement remains branch-local work:
   deterministically verified (full CI chain green) but without a closed
   native review lifecycle — it must not be published as reviewed work.

## 4. Non-destructive T25 remainder

Governance, versioning and docs alignment (canonical authority, 4.0.0
versioning, superseded spec headers) are separate non-destructive candidates
with their own review lifecycle (see `docs/governance/CANONICAL_AUTHORITY.md`).
