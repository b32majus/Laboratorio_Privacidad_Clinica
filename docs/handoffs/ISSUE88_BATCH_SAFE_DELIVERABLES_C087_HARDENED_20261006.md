# Issue #88 — hardened C-087 execution handoff

Status: **READY_TO_LAUNCH · LOCAL_ONLY**
Issue: **#88 — `[REC-07] Batch Safe document deliverables: per-document ZIP + consolidated PDF`**
Canonical base before preparation: `3.0-main@059d8ef807130f68ec83e39debc8c727750d161d`
Publication boundary: **LOCAL_ONLY — no push / PR / merge / issue mutation / deploy**

## Route

- Cost policy: **go**
- Risk class: **complex**
- Visible coordinator: **`atenea-go`**
- Why complex: this ticket adds shareable clinical artifacts across a material privacy/trust boundary and has async current-authority / stale-completion semantics. Those are explicit C-087 complex triggers; file count/UI size are not the reason.
- Why Go: conserve Standard/NaN complex capacity while keeping the complex assurance envelope. Go is a cost policy, not a lower risk class. Bound-model unavailability/quota/capability failure is HUMAN STOP; there is no silent fallback.
- Cora integrated audit is required before any later publication recommendation.

## WHAT — accepted outcome

Complete the **Safe document-deliverable** side of the existing batch Result without changing batch privacy/review semantics:

1. a ready document batch can download its individual **prepared Safe PDFs as one ZIP**;
2. the same ready batch can download **one consolidated Safe PDF with an index**;
3. the existing deterministic Safe summary CSV remains available as the authoritative full-batch manifest;
4. blocked / needs-attention / stale / disposed state produces **zero unauthorized download**;
5. all new visible copy and action feedback are professional Spanish;
6. batch Confidential remains unavailable and separate — **#89 owns it**.

This ticket recovers `H-17` + `H-18`. It does not close REC-07 as a whole.

## Authority to read

Read only what is needed:

- `AGENTS.md`
- `CODING_STANDARDS.md`
- GitHub issue `#88`
- `docs/HUMAN_PRODUCT_DESIGN_AUTHORITY_V1.md` — batch + Result + Safe/Confidential hierarchy
- `docs/RECOVERY_MASTER_PLAN_2026-10.md` — REC-07
- `docs/audits/2026-10-recovery-traceability-matrix.md` — `H-17`, `H-18`, `H-19`, `PDR-06`, `PDR-08`, `PDR-09`, `PDR-10`, `PDR-11`; `H-42/PDR-12` only as protected #89 boundary

Do not reopen historical ticketization or old T01–T25 plans.

## WHERE — known seams; do not rediscover repository topology

- `app-v4/src/useJobSession.ts`
  - already owns **all per-item batch `ReviewSession`s** as `batchSessions`;
  - each successful reviewed item already has canonical review authority;
  - shared retry `ProcessingContext` stays internal and is unrelated to output generation.
- `app-v4/src/App.tsx`
  - already holds `batchSessions` and passes them to the Privacy Gate;
  - the current Export/Result wiring does not yet give the batch Result the full per-item session set. This is the known bridge seam, not an architecture discovery task.
- `app-v4/src/domain/job.ts`
  - `batchSafeSummaryReady(...)` and the existing item status/disposition vocabulary are the readiness authority to preserve;
  - `error + removed` stays distinct from `completed`.
- `app-v4/src/export/batchResultModel.ts`
  - canonical batch Result state + Safe summary manifest from #87;
  - do not create a second batch readiness/state machine.
- `app-v4/src/export/ExportStep.tsx`
  - current human batch Result and existing download/current-authority patterns.
- `app-v4/src/review/review-domain.ts`
  - `ReviewSession` + `getFinalText(...)` are the canonical per-document reviewed Safe content authority;
  - never rerun privacy transforms to build output.
- `app-v4/src/output/pdf-builder.ts`
  - existing REC-05 Safe PDF representation contract, including explicit unrepresentable-character refusal and zero bytes on refusal.
- `app-v4/src/export/ExportStep.unmount.test.tsx`
  - existing stale-completion-after-unmount safety witness for async output.
- `e2e/rec87-batch-result.spec.ts`
  - realistic 12-document batch journey and canonical removed-item / manifest behavior.
- `package.json`
  - `jszip` is already a direct dependency; adding/replacing a ZIP/PDF dependency is not routine scope.

## REUSE — accepted authorities, not new substitutes

- Per-document Safe material comes only from the current finalizable batch `ReviewSession`s / canonical `getFinalText(...)`.
- Batch output authorization reuses the #87 readiness authority. A new serializer/builder may defend itself independently, but it may not invent another readiness truth.
- Per-document PDF semantics remain the REC-05 Safe PDF semantics. The batch feature composes that accepted representation; it does not reinterpret or rerun privacy processing.
- The #87 Safe summary CSV remains the complete manifest for every original selection index.
- Existing client-side download and async disposal/current-authority invariants remain binding.
- Existing `jszip` / `pdf-lib` dependency boundary is sufficient unless execution proves a concrete blocker; do not add a dependency merely for convenience.

## CLOSED DECISIONS — do not rediscover

1. **Primary batch Safe action:** the ready Result prioritizes the ZIP of individual prepared Safe PDFs. The consolidated Safe PDF and the existing summary CSV are secondary Safe representations, discoverable without equal-weight chrome.
2. **ZIP meaning:** `H-18` means per-document **Safe PDFs**, not DOCX/TXT or original files.
3. **Consolidated PDF meaning:** generated Safe document with an index; no source-layout/redaction fidelity claim.
4. **No source filename in shareable Safe artifacts:** original filenames can themselves contain identifiers. New Safe filenames, ZIP entry names and consolidated-PDF labels use deterministic ordinal identity from the stable original batch index, never the source filename.
5. **Removed/failed semantics:** a deliberately removed error produces no prepared document body and is never relabelled completed. The #87 CSV remains the authoritative complete manifest and preserves its `error,retirado` row.
6. **All-or-nothing per requested artifact:** if any included document cannot be represented as the accepted Safe PDF, the requested ZIP/consolidated-PDF action refuses truthfully with **zero download**. Never download a partial batch artifact and call it success.
7. **Readiness is representation-independent:** an action-specific PDF representation failure does not mutate Job/review readiness; it is a visible output-action failure only.
8. **Async authority:** after every awaited generation window and immediately before download, the request must still correspond to the current Job/readiness/per-item review authority. Job/policy/review/disposition replacement or unmount revokes download authority.
9. **Confidential stays unavailable:** do not set batch `confidentialAuditReady`, build correspondence, add confirmation, or otherwise absorb #89.
10. **Local-only:** no network, persistence, analytics, remote generation, logging of clinical content, source filename or Confidential data.

## DO NOT TOUCH / OUT OF SCOPE

- #89 batch Confidential Audit / deliberate confirmation.
- #80–#85 REC-08/09 work, shell/no-op restructuring, manual marking, Structured workspace redesign.
- #90/#91 exhaustive localization/visual closeout beyond the touched Result surface.
- New batch item statuses/dispositions or a second ReviewSession/readiness authority.
- Privacy policy semantics, recognition, transformation, pseudonym identity or cross-document ProcessingContext semantics.
- Source-file recreation, source-PDF layout preservation, OCR or original binary packaging.
- New dependencies, dependency upgrades or shared serializer semantic changes without a concrete blocker and HUMAN STOP.
- Publication or GitHub mutation.

## Conditional fidelity safeguards

- **Representation narrowing — ACTIVE:** the batch PDF/ZIP representations must preserve the accepted Safe content meaning and the `completed` vs `error + removed` distinction; shareable naming must not reintroduce sensitive source filenames.
- **Affected/shared seam — CONDITIONAL:** if implementation materially changes an existing shared PDF/download/review helper, cover the known single-item consumer and report any material out-of-envelope sibling impact instead of silently broadening scope.
- **Adversarial evidence — ACTIVE only for the named claims below:** no-leak, all-or-nothing refusal and stale/disposed zero-download are material negative claims and need falsifiable witnesses.

## PROOF — writer-phase evidence

Use focused deterministic evidence; broad/full suites belong to integration/publication unless a concrete failure justifies them.

Minimum writer proof:

1. **Canonical-material oracle:** for a ready synthetic batch, every included Safe document is derived from that item's final `ReviewSession` content; no privacy transformation is rerun.
2. **No-leak adversary:** plant distinct sentinel values in source filename, original/source content that should not survive, reviewer note and Confidential-only material; prove they do not appear in Safe ZIP entry names/content or the consolidated Safe PDF/index.
3. **Manifest/disposition preservation:** a realistic batch containing deliberate removals still has the unchanged #87 CSV accounting for every original index; removed errors produce no Safe document body and are never represented as completed.
4. **All-or-nothing representation refusal:** plant a Safe PDF-unrepresentable character in one otherwise ready document; each affected batch artifact action downloads zero and reports a non-PHI failure rather than a partial success.
5. **Async/current-authority witness:** suspend generation, then invalidate current authority and separately unmount the Result; stale completion produces zero download and no false success for the new async batch actions.
6. **Human Result hierarchy:** ready Result has one primary Safe action (ZIP), secondary consolidated PDF + CSV, perceptible pending/success/failure feedback, and the still-disabled separate Confidential zone. Blocked/needs-attention states expose no Safe artifact.
7. **Composed realistic-density journey:** extend/compose the existing synthetic ~12-document batch journey through recovery/review to ready Result and prove the new Safe deliverables without leaking source names/content. Do not replace the existing #87 manifest assertions.
8. Run the smallest relevant typecheck/lint/format checks for touched source. Do not run the full repository suite by ritual in the writer phase.

If a shared existing output helper is changed, add the smallest sibling regression that proves REC-05 single-item semantics were not narrowed.

## HUMAN STOP

STOP and return to Cora/human if any of these becomes necessary:

- a new batch state/status/disposition or a second readiness authority;
- changing ReviewSession, privacy policy, transformation or pseudonym semantics;
- exposing source filenames in a shareable Safe artifact to make the feature usable;
- changing accepted single-item PDF semantics rather than composing them;
- introducing a new dependency or materially changing a shared PDF/ZIP/download authority beyond this envelope;
- absorbing batch Confidential correspondence/confirmation (#89);
- a product choice outside the closed hierarchy/naming/disposition decisions above;
- a material supported sibling outside this envelope is found to depend on a changed shared seam;
- any bound Go model is unavailable, quota-blocked, removed or materially incapable;
- any push / PR / merge / issue mutation / deploy would be required.

## Expected C-087 Go closeout

Return one complete closeout containing:

- fixed pre-implementation review anchor supplied in the launch prompt;
- final candidate SHA and clean-tree status;
- changed-file inventory and scope statement;
- focused writer evidence;
- canonical Standards + Spec review result;
- any fresh correction attempts and their exact findings/closure;
- confirmation that #89 and other neighboring tickets were not absorbed;
- `Publication: LOCAL_ONLY`.

Then STOP for Cora integrated audit.
