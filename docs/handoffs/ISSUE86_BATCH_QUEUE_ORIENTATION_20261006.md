# Issue #86 — REC-06 batch work-queue orientation — C-086 thin handoff

Status: **READY_TO_LAUNCH after fixed-anchor preflight**
Date: 2026-10-06
Issue: **#86 — [REC-06] Batch work-queue orientation at realistic batch size**
Matt entry: **`/implement`**
Cost policy: **standard**
Risk class: **volume**
Visible primary: **`atenea-volume`**
Publication boundary: **LOCAL_ONLY during execution**

## 0. Fixed identity

- Repository: `b32majus/Laboratorio_Privacidad_Clinica`
- Canonical base: `3.0-main@30edfc3ca3c5deb585af82cc2d45a4bf03643e0a`
- C-086 project reconciliation commit: `1fb7520b6b355679ad072a05b17fd26d436f4f93`
- Worktree: `/srv/kairos-lab/qualification/laboratorio-issue86-batch-orientation-20261006`
- Branch: `work/issue-86-batch-orientation-20261006`
- Atenea: `b32majus/Atenea@c12f4f735fe664dcc1b403dabcbaf5d2d51eef31`
- OpenCode: `2.0.22`
- Fixed pre-implementation review anchor: supplied by the launch prompt and must equal the clean final prep HEAD.

This is **#86 only**. #78/#79 are closed historical prerequisites. Do not start #87 or #80–#85.

## 1. Read only what this unit needs

1. `AGENTS.md`
2. this handoff
3. GitHub issue #86
4. `docs/HUMAN_PRODUCT_DESIGN_AUTHORITY_V1.md` — HPD-04/05/11/12/13/14, §6.4 Batch, G-HP5/6/7/10
5. REC-06 in `docs/RECOVERY_MASTER_PLAN_2026-10.md`
6. matrix rows `PDR-05`, `PDR-10`, `PDR-11`
7. `docs/ATENEA_EXECUTION_ROUTING_V0.md`
8. `docs/PRODUCT_FIDELITY_GATES_V1.md` only for the representation-narrowing safeguard activated below.

Do not reload historical #78/#79 handoffs or qualification evidence unless a concrete implementation question requires a specific fact already absent from current code/authority.

## 2. Outcome

Make the **existing real batch work queue** usable at realistic professional volume without changing batch semantics.

A user must be able to locate documents that need attention, documents still in progress, completed documents and deliberately removed documents without scanning the full batch. Existing #78 retry/remove/acknowledge behavior and feedback remain intact.

This is an orientation/productivity slice, not a new batch state machine and not batch Result/output work.

## 3. Accepted interaction rails

Implement one compact filter/orientation control immediately above the existing document queue.

Required human views:

- **Todos** — every original batch item;
- **Necesitan atención** — active `error` items that are not removed + `review-required` items;
- **En curso** — `queued`, `reading` and `processing`;
- **Listos** — `completed`;
- **Retirados** — `error` items with `itemDisposition === "removed"`.

Each control exposes a current count in Spanish. These are **view categories only**; they never become domain status, persistence or output semantics.

Default view:
- if `Necesitan atención` has at least one item, open there;
- otherwise open `Todos`.

Binding behavior:

- filtering never mutates Job state, `activeIndex`, ReviewSession, decisions or recovery facts;
- exact per-row factual status/disposition remains visible; the filter label never replaces the canonical item state;
- acknowledged errors remain in `Necesitan atención` because acknowledgement is not resolution;
- removed items leave active attention but remain discoverable in `Retirados` and `Todos`;
- switching a filter never silently selects, completes or clears a document;
- if the currently open review document falls outside the selected queue filter, its Review workspace remains intact and the UI gives a concise factual indication that the open document is outside the current filter;
- an empty filtered view explains that no documents match and offers a simple **Mostrar todos** recovery action;
- feedback from an action must remain perceptible even if the action changes the item's filter category. In particular, removing an item while viewing `Necesitan atención` cannot make the success consequence disappear with the row;
- filters/counts update from current authoritative props after retry/remove/acknowledge/review completion;
- controls are native keyboard/touch operable, visibly focused, wrap without horizontal overflow and do not rely on color alone.

Exact chip/button styling and internal component factoring are implementation choices.

## 4. Protected boundaries

Preserve:

- all #78 recovery semantics, retryability and stale-authority guards;
- six-value `BatchItemStatus` vocabulary;
- removed vs completed distinction;
- ReviewSession as per-document review authority;
- navigation-only document selection;
- cross-document consistency underneath the UI;
- current fail-closed Gate/Export behavior.

No domain status/recovery transition changes are authorized. If the filter UX appears to require such a change, **HUMAN STOP**.

## 5. Conditional safeguards

Activated:

1. **Human-product authority** — material user-facing batch representation.
2. **Representation narrowing (Product Fidelity Gate 2)** — the filter mapping must not erase or redefine accepted status/disposition distinctions.

Not activated by default:

- open-ended affected-surface tracing;
- repository-wide adversarial audit;
- detached prototype train.

If ordinary implementation incidentally exposes a material supported surface outside this envelope, report and STOP rather than broadening.

## 6. Non-goals

Do not implement:

- #87 Batch Result / summary CSV / manifest;
- #88 ZIP/PDF;
- #89 batch Confidential Audit;
- #80 Input changes;
- #81–#85 REC-09 work;
- search, pagination, bulk review/acceptance, new sorting authority or new persistence;
- new batch statuses or new recovery semantics;
- global localization/visual closeout.

## 7. Focused evidence

Writer evidence follows C-086 thin execution.

Required before the fixed implementation candidate:

- focused TDD around `BatchReviewView` filter/orientation behavior;
- a realistic synthetic component fixture with **at least 16 items** spanning attention / in-progress / completed / removed states and proving counts + filtering + exact row-state visibility;
- proof that filter changes preserve active ReviewSession/decisions and unrelated work;
- proof that acknowledged error remains attention and removed error remains discoverable but not active attention;
- proof that remove/retry feedback stays perceptible across category change;
- a real-app Playwright batch journey with **at least 12 synthetic/no-PHI documents**, including a local failure, review-required work and completed/removed state, demonstrating orientation without scanning the full list;
- focused accessibility/state assertions for labels, keyboard controls and empty-filter recovery;
- `typecheck:v4`;
- focused ESLint for changed TS/TSX files;
- build only as required to run the focused Playwright witness;
- `git diff --check`.

Do **not** run full `npm test`, full repo audit or unrelated suites in the writer phase unless a concrete failure requires escalation. Publication closeout owns broader changed-artifact/composed validation under `docs/PREPUBLICATION_ARTIFACT_VALIDATION_V1.md`.

## 8. Preflight baseline

Fresh worktree baseline under C-086:

- `BatchReviewView.test.tsx`: **14/14 PASS**;
- `e2e/batch.spec.ts`: **4/4 PASS** after the required fresh build;
- `typecheck:v4`: **PASS**;
- `build:v4`: **PASS**;
- `git diff --check`: **PASS**.

The first Playwright invocation in the fresh worktree exited before test execution because no `dist` existed (`failedTests: []`); after the required build the same canonical E2E passed 4/4. Treat that as preflight environment provenance, not product debt.

## 9. Review and closeout

Use current C-086 routing:

- coordinator: `atenea-volume`;
- writer: `atenea-implementer-volume` → DeepSeek V4 Flash;
- exactly one canonical Standards + Spec review: `atenea-review-standards` + `atenea-review-spec-volume` (Luna high);
- review findings, if any, go only to fresh `atenea-corrector-volume`; maximum two finding-scoped attempts;
- no repeated review carousel;
- material new product/privacy/state question → HUMAN STOP.

Return to Cora with the fixed anchor, final candidate SHA, changed files, acceptance mapping, focused evidence, canonical review verdicts, corrections if any, and confirmation that publication remains LOCAL_ONLY.

Do not push, open a PR, merge, close #86 or start another ticket.
