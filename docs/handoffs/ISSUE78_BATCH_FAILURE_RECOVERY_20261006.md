# Issue #78 — REC-06 batch failure-recovery actions — C-085 standard/complex execution handoff

Status: **READY_TO_LAUNCH after §11 preflight passes**
Date: 2026-10-06
Issue: **#78 — [REC-06] Batch failure-recovery actions: retry, remove and error acknowledgement**
Matt entry: **`/implement`**
Cost policy: **standard**
Risk class: **complex**
Visible primary: **`atenea-complex`**
Publication boundary: **LOCAL_ONLY — no push, PR, merge, issue mutation, release or deploy during Matt execution**

## 0. Fixed execution identity

- Repository: `b32majus/Laboratorio_Privacidad_Clinica`
- Canonical base: `3.0-main@25d84ca38c8766c53130c150aac800abf4fe16e1`
- Worktree: `/srv/kairos-lab/qualification/laboratorio-issue78-batch-failure-recovery-20261006`
- Branch: `work/issue-78-batch-failure-recovery-20261006`
- Atenea authority: `b32majus/Atenea@9c6be73527c1b4ff8a661d29582bb6317b8e45f7` (C-085)
- OpenCode runtime: `2.0.22`
- Fixed pre-implementation review anchor: **supplied by the attended launch prompt and must equal the clean worktree HEAD created after this handoff/preflight commit**

This is one ticket only. Do not start #79 or any other published recovery issue.

## 1. Authority to read — in order

1. `AGENTS.md`
2. `docs/START_HERE.md`
3. `docs/HUMAN_PRODUCT_DESIGN_AUTHORITY_V1.md`, especially HPD-04/06/11/12/13/14 and §6.4 Batch
4. this handoff
5. GitHub issue #78 in full
6. `docs/RECOVERY_MASTER_PLAN_2026-10.md`, REC-06 + §4 launch gate
7. `docs/audits/2026-10-recovery-traceability-matrix.md`: `BATCH-001`, `H-16`, `PDR-05`, `PDR-08`
8. `docs/shaping/CURRENT_DECISIONS.md`
9. `docs/PRODUCT_FIDELITY_GATES_V1.md`
10. current batch/domain seams in `app-v4/src/domain/job.ts`, `app-v4/src/useJobSession.ts`, `app-v4/src/review/BatchReviewView.tsx` and affected gate/export consumers

Historical T17 evidence may be read only to understand already-accepted batch invariants; it is provenance, not a license to restore old code.

## 2. Why this ticket is `complex`

The ticket is narrow but crosses an accepted per-item state machine, destructive recovery/disposition, per-document ReviewSession authority and shared cross-document consistency. C-085 names difficult state-machine/invariant semantics as a complex trigger. File count/UI size is not the reason.

The implementation writer is therefore GLM 5.3 Flash high through `atenea-implementer-complex`; Standards review remains Luna high; Spec review is Sol 6.1 high.

## 3. Product/domain behavior fixed before implementation

### 3.1 Preserve the accepted processing/review status vocabulary

The current six `BatchItemStatus` values — `queued / reading / processing / review-required / completed / error` — remain the processing/review lifecycle authority.

Do **not** silently redefine `completed` to mean “removed”, “acknowledged” or “ignored”. Recovery/disposition facts may be represented orthogonally when needed. A removed item must remain distinguishable from a completed reviewed item.

### 3.2 Retry

`Reintentar` is contextual, not universal.

- It may be offered only when the current in-memory Job contains enough authoritative source material to retry the failed item safely in the same Job.
- The canonical known case is a processing failure that retained extracted text; `policy-unsupported` remains recoverable only under a policy that actually supports the item.
- A read/source failure with no retained extraction is **not** made retryable by inventing persistence, retaining new long-lived file/blob state, or asking the user to reconstruct the whole Job inside this ticket.
- A successful retry creates/replaces review authority only for that item and follows the normal `review-required → completed` rule; zero-pending sessions may complete through the existing authority.
- Retry must preserve every unrelated item's ReviewSession, decisions, status and source identity.
- Retry must preserve canonical cross-document consistency. If this cannot be achieved without invalidating/reprocessing unrelated successful items or silently changing identity/date semantics, **HUMAN STOP** rather than broadening scope.

Retry has perceptible pending/success/failure feedback and cannot be double-fired into overlapping attempts.

### 3.3 Remove / dispose from batch

Removal means **deliberately exclude this failed item from further active batch work**, not erase history and not mark it completed.

Binding behavior:

- the original item identity/name/index and its prior typed failure remain representable so REC-07 can account for every original item in the batch manifest;
- removal must not delete or reset unrelated item sessions/decisions;
- removal may resolve that item's active failure blocker for later batch readiness, but it never fabricates review completion for that item;
- because removal changes what will participate in the prepared batch result, it requires a clear Spanish consequence and an explicit confirm/cancel interaction before mutation;
- Cancel is zero mutation;
- removed/disposed remains visible as a factual disposition, not hidden from the work queue.

Do not implement any batch output/manifest format here; #87–#89 own that. #78 only leaves a truthful canonical disposition that those tickets can consume.

### 3.4 Acknowledge error

Acknowledgement means **“I have seen this failure”**, not “this failure is resolved”.

- acknowledging does not change `error` into `completed`;
- it does not make Result/output ready;
- it does not hide the failed item;
- it may be represented as a job-scoped memory-only recovery fact;
- retry/remove remain available later when applicable.

No extra confirmation is required because acknowledgement is non-destructive, but the action must provide perceptible feedback.

### 3.5 Shared consistency

Do not expose `ProcessingContext` or invent a new consistency toggle. The current cross-document consistency authority remains underneath.

If no accepted user-disable control exists, show only a concise factual Spanish explanation where useful; do not create a control merely because the REC-06 thematic bucket mentions “fact/control”.

## 4. Human-product surface

The recovery controls belong on the real batch work-queue/review surface, next to the affected failed document. Existing Input failure surfacing may remain factual; #78 does not need to duplicate the full recovery UI on Input.

Required qualities:

- Spanish professional copy for every new/reworked status/action/message;
- native keyboard/touch operability, visible focus, no color-only status;
- failed item, action, consequence and feedback are co-located;
- unrelated successful/review-required items remain visible and usable;
- task/recovery dominates explanatory chrome;
- no internal enums, offsets or ProcessingContext vocabulary.

Exact component geometry is implementation-open and is validated in the real app, not a detached prototype.

## 5. Explicitly out of scope

Do not absorb:

- #86 realistic-size batch orientation/filtering beyond the minimum witness needed to falsify #78;
- #79 DISC-01 async-output lifecycle;
- #87–#89 batch Result/CSV/ZIP/PDF/Confidential outputs;
- #80 Input redesign;
- #81–#85 REC-09 review/IA/structured redesign;
- global Spanish closeout (#90) or visual-system closeout (#91);
- new storage/persistence/network/file-handle architecture;
- new privacy-policy semantics;
- reprocessing unrelated completed/review-required documents merely to make retry easier.

If the implementation requires one of these, HUMAN STOP.

## 6. Affected-surface propagation

The behavioral blast radius is wider than files that receive a diff.

At minimum verify:

- `domain/job`: lifecycle/disposition invariants and batch completeness/error derivations;
- `useJobSession`: atomic job + per-item ReviewSession updates;
- `BatchReviewView`: actions/copy/accessibility/feedback;
- App wiring: recovery callbacks cannot target a stale/replaced Job;
- Privacy Gate and Export/Result consumers: removed/acknowledged/retried items are represented factually and no path fabricates readiness;
- policy change/retry path: existing policy-supported recovery semantics remain valid;
- document selection remains navigation-only and never certifies review.

A material supported sibling surface outside this envelope is HUMAN STOP, not “NO TOCA”.

## 7. Required adversarial witnesses

Evidence claims must not exceed falsification power. Plant tests capable of failing for at least these properties:

1. **Unrelated-work preservation:** batch A/B/C where B fails and A/C carry independent review decisions; retry/remove/ack B cannot change A/C session ids, decisions or completion.
2. **No fabricated completion:** remove and acknowledge never route the failed item through `completed`; selecting another document still never marks review complete.
3. **Retryability boundary:** processing-error item with retained text can follow the accepted retry route; read-error item without retained text is not falsely presented as retryable.
4. **Destructive confirmation:** remove first action/Cancel = zero mutation; Confirm applies exactly once.
5. **Acknowledgement non-resolution:** acknowledged error remains an error/blocker until a real retry or disposal resolves the active blocker.
6. **Stale action guard:** a recovery action captured for Job A cannot mutate Job B after New Job/Clear/policy authority replacement.
7. **Shared consistency preservation:** retry never silently changes unrelated pseudonym/date decisions or accepted shared-context behavior.
8. **Rendered composed witness:** synthetic/no-PHI batch containing at least one successful reviewed item, one pending/review item and one local failure proves Spanish recovery controls, feedback and no loss of unrelated work.

## 8. TDD / implementation shape

Use `/tdd` at the seams above. One issue may contain several small red→green increments, but it remains one Matt `/implement` lifecycle and one fixed candidate before canonical review.

Prefer domain contract first, bridge second, rendered work-queue wiring third, then composed witness. Do not grow into #86 orientation work.

## 9. Review lifecycle

Follow current C-085/C-084 Atenea lifecycle exactly:

- coordinator: `atenea-complex`;
- implementation/TDD: `atenea-implementer-complex`;
- fixed implementation candidate returned before review;
- exactly one canonical code review anchored to the fixed pre-implementation anchor;
- Standards: `atenea-review-standards`;
- Spec: `atenea-review-spec-complex`;
- corrections, if findings are authorized: fresh `atenea-corrector-complex`, max two attempts on the same finding envelope;
- new material issue, scope expansion or unresolved product/domain question → HUMAN STOP;
- publication remains human-owned.

## 10. Gate floor for the final candidate

At minimum:

- focused domain/bridge/UI tests covering #78;
- existing batch App/PrivacyGate/ExportStep regressions;
- `e2e/batch.spec.ts` plus a new/extended realistic failure-recovery journey capable of falsifying the accepted claims;
- V4 privacy eval;
- typecheck;
- lint;
- format check;
- build;
- full `npm test`;
- `git diff --check`;
- `npm audit --omit=dev` compared to the fixed-anchor baseline; no dependency changes are expected.

Any red baseline discovered before implementation must be recorded honestly and not “fixed” outside #78.

Preflight baseline at canonical `25d84ca38c8766c53130c150aac800abf4fe16e1`: focused batch/domain/bridge/UI Vitest **236/236 PASS**; `e2e/batch.spec.ts` **2/2 PASS**; privacy eval **28/28 PASS**; typecheck/lint/format/build/full `npm test` **PASS** with V4 Vitest **81 files / 1300 tests**; `git diff --check` PASS. `npm audit --omit=dev` is a known canonical baseline red at **16 findings (4 moderate / 11 high / 1 critical)** across the recorded package set; #78 expects zero dependency changes and must not broaden into dependency remediation.

## 11. Preflight required before launch

Cora owns this before the human launches OpenCode:

- canonical base exact and ancestor;
- branch/worktree exact and clean;
- issue #78 open, `ready-for-agent`, with zero blockers;
- Atenea C-085 exact and required complex bindings byte-identical;
- OpenCode 2.0.22;
- required models visible;
- relevant baseline tests/gates recorded;
- this handoff committed;
- fixed pre-implementation review anchor equals that final prep commit.

## 12. Return contract to Cora

Return:

1. fixed pre-implementation anchor used;
2. final implementation candidate SHA;
3. commits and changed files;
4. concise implementation summary;
5. explicit mapping to every #78 acceptance criterion and §§3/7 witnesses;
6. focused/full test evidence;
7. privacy/typecheck/lint/format/build/audit/diff-check evidence;
8. canonical Standards + Spec review identities/verdicts;
9. correction attempts/findings, if any;
10. proof no unrelated ReviewSession/decisions were lost;
11. proof no read-error path was falsely made retryable;
12. affected-surface propagation result;
13. any HUMAN STOP/question;
14. exact publication boundary: `LOCAL_ONLY`.

Do not push, open a PR, merge, close #78 or start #86.


## 13. Cora preflight record — 2026-10-06

Pre-implementation baseline was run on canonical product code before any #78 mutation.

- canonical/base identity: `origin/3.0-main@25d84ca38c8766c53130c150aac800abf4fe16e1`;
- issue #78: OPEN, `ready-for-agent`, zero blockers;
- Atenea local/origin: `9c6be73527c1b4ff8a661d29582bb6317b8e45f7`;
- OpenCode: `2.0.22`;
- required complex bindings + `/implement` skill: byte-identical to current Atenea;
- focused Vitest (`job`, `useJobSession`, App, PrivacyGate, ExportStep): **5 files / 236 tests PASS**;
- `e2e/batch.spec.ts`: **2/2 PASS**;
- V4 privacy gate: **28/28 PASS**;
- typecheck: PASS;
- lint: PASS;
- format check: PASS;
- build: PASS;
- full `npm test`: PASS; final V4 Vitest stage **81 files / 1300 tests PASS**;
- `git diff --check`: PASS;
- current `npm audit --omit=dev` advisory baseline: **16 findings = 4 moderate / 11 high / 1 critical**. This is current advisory-database baseline on the unchanged canonical package lock, not #78 implementation debt. No dependency changes are expected in #78; any package/lock change or new unresolved vulnerability is a finding/STOP unless separately authorized.
- existing PDF/canvas/font stdout warnings observed in baseline remain non-failing pre-existing evidence, not #78 scope.

The temporary shared `node_modules` symlink used only to execute baseline checks is not part of the repository and must be removed before the preparation commit.
