# Issue #87 — correction #2 hardened under Atenea C-087

Status: **READY_TO_LAUNCH — FINAL AUTHORIZED CORRECTION**
Date: 2026-10-06

## Identity

- Work: final correction for `#87 — [REC-07] Batch Result readiness + summary CSV deliverable`.
- Cost policy: **go**.
- Risk class: **complex**.
- Canonical project base: `3.0-main@02492d849e185af1e2c78edb5e63cead49bb20d2`.
- Canonical Atenea: `b32majus/Atenea@ddaf9612da67da42eb9bd2c9c03d652b254cc332` — C-087.
- Original audited candidate: `3a599b76e83a08f545e2a1bc621c396cb21ae105`.
- C-087 reconstructed candidate before this handoff: `020e0d37395c0c9a37be24770ec5a00ff6a64605`.
- The reconstructed candidate was made by `cherry-pick -x` of the two product commits only; every #87 product blob is identical to the audited `3a599b7…` candidate.
- Correction budget: **attempt #2 of 2 maximum**.
- Publication: **LOCAL_ONLY**.
- Open material product questions: **NONE**.

The previous C-086 worktree is historical evidence and MUST NOT be used as runtime authority. This repo-local handoff is the complete child-readable correction authority for C-087.

## WHAT

Close exactly two Cora integrated-audit findings without reopening #87:

1. **CORA-87-01** — the Safe-summary serializer is not independently fail-closed when the authoritative batch review is incomplete.
2. **CORA-87-02** — Privacy Gate, Result and serializer can disagree about readiness of the same Safe batch summary artifact.

The observable end state is one coherent Safe-summary readiness authority used by all three surfaces.

## WHERE — seam map

Known relevant seams:

- `app-v4/src/domain/job.ts`
  - existing `batchReviewComplete(job)`;
  - existing active-failure helpers;
  - batch review/output domain facts.
- `app-v4/src/useJobSession.ts`
  - `withDerivedBatchReviewState` atomically mirrors derived batch review/output state.
- `app-v4/src/privacy-gate/privacyGateModel.ts`
  - `deriveBatchFacts` / batch Gate facts.
- `app-v4/src/privacy-gate/PrivacyGate.tsx`
  - batch Safe availability copy currently contains the stale “no batch format exists” statement.
- `app-v4/src/export/batchResultModel.ts`
  - `deriveBatchResultView`;
  - `serializeBatchSummaryCsv`.
- `app-v4/src/export/ExportStep.tsx`
  - presentation/download handler only; must not become the authorization authority.

Relevant focused tests already exist beside those seams plus `e2e/rec87-batch-result.spec.ts`.

## REUSE

Do not create another state machine.

Reuse the accepted batch facts and recovery semantics:

- `batchReviewComplete(job)`;
- current authoritative `job.review.complete`;
- active failed-item authority (`error` not deliberately removed);
- `error + removed` remains history, never `completed`;
- original selection order/index remains the Safe manifest identity;
- the existing synchronous `resumen-lote-seguro.csv` serializer and non-leakage contract.

### Shared readiness invariant

The shared Safe-summary authority must fail closed unless **all** are true:

1. job is a document batch;
2. authoritative `job.review.complete === true`;
3. item-derived `batchReviewComplete(job) === true`;
4. there are zero active failed items.

This defensive agreement is intentional: a crafted/stale mismatch such as completed-looking rows with `review.complete=false` is **not authorized**.

The lowest shared pure seam is preferred (domain-level, below both Privacy Gate and Result) so presentation modules do not import each other or form a cycle. `job.outputs.safeOutputReady` may remain as a synchronized derived mirror where existing architecture expects it, but it must not compete with or weaken the shared pure authority.

## CLOSED DECISIONS — do not rediscover

- Batch Result remains navigable while the artifact is blocked. **Result visibility is not authorization.**
- Privacy Gate remains the underlying readiness/checkpoint surface; it is not removed or bypassed.
- The only #87 batch Safe artifact is `resumen-lote-seguro.csv`.
- CSV columns stay exactly:
  `indice_lote,estado,disposicion`.
- CSV never contains source filenames, source text, mappings, reviewer notes, raw error detail or Confidential Audit data.
- A removed failure serializes only when the batch is otherwise authorized and remains `estado=error,disposicion=retirado`.
- Batch Confidential remains unavailable until #89.
- ZIP/PDF remain #88.
- No async path is needed for this CSV.
- Existing Result hierarchy and 12-document journey are accepted; do not redesign them.
- The two earlier Standards findings about swallowed diagnostics and loose oracle are already closed; preserve that correction.

## Required correction — CORA-87-01

The current candidate reproduces:

```text
two rows completed
job.review.complete = false
deriveBatchResultView(job).state = needs-attention
serializeBatchSummaryCsv(job) = PRODUCES CSV
```

After correction:

- the shared readiness authority returns false;
- `serializeBatchSummaryCsv(job)` throws `BatchSummaryError` before producing bytes;
- UI preconditions are not the only guard.

Also prove the all-removed/no-completed boundary remains unauthorized.

## Required correction — CORA-87-02

The current candidate can say, for the same ready batch:

```text
Privacy Gate: Safe output = Not ready / no batch format exists
Result:       Listo para usar / Descargar resumen seguro (.csv)
```

After correction:

- Privacy Gate consumes the same Safe-summary readiness authority;
- Result consumes that same authority for `ready` vs non-ready;
- serializer consumes that same authority before emitting bytes;
- a production-synchronized ready batch reflects Safe-summary readiness at the Gate and Result;
- blocked/pending batches remain not ready everywhere;
- the stale batch-specific claim that no Safe batch format exists is removed/replaced with factual #87 summary availability;
- batch Confidential remains unavailable and separate.

Do not solve this by making Privacy Gate import the export Result model, or by making each surface reimplement the predicate.

## DO NOT TOUCH / OUT OF SCOPE

- #88 ZIP / consolidated PDF / per-document Safe packaging;
- #89 batch Confidential artifact or confirmation;
- REC-08/09/10/11/12;
- batch recovery actions or `error+removed` semantics;
- ProcessingContext / ReviewSession architecture;
- navigation topology beyond preserving the already accepted Result visibility;
- network, persistence, analytics, remote processing;
- unrelated localization or visual-system cleanup;
- publication, push, PR, merge, issue mutation or deploy.

## Conditional safeguards

Explicitly active only for this correction:

- **representation narrowing** — never collapse removed failure into completion;
- **affected shared seam** — the readiness helper is shared by Gate/Result/serializer, so cover those known consumers only;
- **adversarial evidence** — the stale/mismatched review witness is required because the claim is fail-closed.

Do not perform open-ended sibling auditing.

## PROOF — minimum focused closure evidence

### CORA-87-01

1. completed item rows + `review.complete=false`:
   - shared readiness false;
   - Result not ready;
   - serializer throws `BatchSummaryError`;
   - zero download.
2. every failed item deliberately removed, no evaluable completed item:
   - shared readiness false;
   - serializer throws.
3. genuine ready state:
   - shared readiness true;
   - deterministic CSV bytes unchanged.

### CORA-87-02

4. pending batch:
   - Gate Safe summary not ready;
   - Result needs attention;
   - serializer refuses.
5. active-failure batch:
   - Gate not ready with factual blocker;
   - Result blocked;
   - serializer refuses.
6. genuine ready batch:
   - Gate reflects Safe summary ready/available;
   - Result ready;
   - serializer succeeds exactly once.
7. Gate no longer says that no batch Safe format exists.
8. batch Confidential remains unavailable.

Keep green:
- existing non-leakage sentinel oracle;
- existing diagnostic correction;
- `e2e/rec87-batch-result.spec.ts` 12-document composed journey;
- relevant single-item Result / structured shared-seam preservation only if actually affected;
- typecheck, focused lint/format, `git diff --check`.

Do not run the full repository suite by ritual.

## STOP

HUMAN STOP immediately if:

- closing the findings requires a new product/privacy/output semantic decision;
- a shared authority cannot be introduced without materially changing unrelated job kinds;
- a new material affected surface outside Gate/Result/serializer/domain mirror is discovered;
- #88 or #89 becomes necessary;
- the bound Go-complex corrector is unavailable/quota-blocked/materially incapable;
- either finding remains after this attempt.

There is **no correction attempt #3**.

## C-087 execution phase

This is not a new implementation lifecycle and must not trigger another canonical review.

The visible `atenea-go` coordinator should:

1. read this repo-local handoff;
2. recognize that implementation + canonical review + correction #1 already happened;
3. dispatch **exactly one fresh `atenea-corrector-go-complex`** against the fixed point;
4. give that child this repo-local handoff pointer as its authority;
5. do not invoke implementer, Standards review or Spec review again;
6. return the corrected candidate SHA + focused evidence to Cora;
7. keep publication LOCAL_ONLY.

If required authority is somehow unreadable to the child, return `INCOMPLETE_AUTHORITY`; do not guess.
