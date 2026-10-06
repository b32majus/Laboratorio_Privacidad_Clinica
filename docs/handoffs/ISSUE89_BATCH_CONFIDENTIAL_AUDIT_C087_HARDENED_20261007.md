# Issue #89 — hardened C-087 execution handoff

Status: **READY_TO_LAUNCH · LOCAL_ONLY**
Issue: **#89 — `[REC-07] Batch Confidential Audit with deliberate download confirmation`**
Canonical base before preparation: `3.0-main@96a2864a2e2913bd280ce200142941a3dbad1995`
Publication boundary: **LOCAL_ONLY — no push / PR / merge / issue mutation / deploy**

## Route

- Cost policy: **standard**
- Risk class: **complex**
- Visible coordinator: **`atenea-complex`**
- Why complex: the ticket creates an identifiable/reversible clinical artifact across the Safe/Confidential trust boundary, adds one-time deliberate authorization, and has stale/current-authority + unmount temporal semantics.
- Why standard for this unit: #88 consumed the Go complex route; this clean work-unit boundary deliberately moves the next complex slice to the standard NaN pool to balance usage, while also using the stronger standard Complex Spec review (`gpt-6.1-sol#high`).
- No model/provider fallback. Bound-model unavailability or material incapability is HUMAN STOP.
- Cora integrated audit is required before any later publication recommendation.

## WHAT — accepted outcome

Finish the remaining REC-07 batch Confidential side without changing Safe semantics:

1. a ready batch has **one distinct batch Confidential Audit TXT artifact**;
2. the first Confidential download action shows a clearly marked Spanish identifiable/reversible-data warning and downloads **zero**;
3. explicit Confirm authorizes exactly one current download; Cancel authorizes zero;
4. the confirmation cannot survive Job/session/readiness mutation, confirm/cancel, or a stale/disposed Result;
5. generation/download revalidates current authority after its awaited window and immediately before download;
6. the Confidential zone remains unmistakably separate and lower-priority than the prepared/shareable Safe Result;
7. global `H-42`'s batch remainder closes; the REC-07 portion of `PDR-12` closes without claiming REC-11 visual-system closeout.

## Authority to read

Read only what is needed:

- `AGENTS.md`
- `CODING_STANDARDS.md`
- GitHub issue `#89`
- `docs/HUMAN_PRODUCT_DESIGN_AUTHORITY_V1.md` — Result + Safe/Confidential asymmetry
- `docs/RECOVERY_MASTER_PLAN_2026-10.md` — REC-07
- `docs/audits/2026-10-recovery-traceability-matrix.md` — `H-42`, `PDR-12`, plus `H-17`–`H-19` only as protected canonical Safe siblings

Do not reopen old ticketization, legacy export architecture or #87/#88 product decisions.

## WHERE — known seams; do not rediscover repository topology

- `app-v4/src/export/ExportStep.tsx`
  - batch Result already has the separate dark-banded Confidential zone;
  - single-item and Structured paths already contain accepted deliberate-confirmation lifecycle semantics;
  - #88 already provides the batch Job/session/current-authority + unmount disposal pattern for async Result actions.
- `app-v4/src/App.tsx`
  - already bridges the complete `batchSessions` record into `ExportStep` from #88.
- `app-v4/src/useJobSession.ts`
  - owns current batch `ReviewSession`s keyed by original index;
  - current batch `confidentialAuditReady` is still deliberately false pending #89.
- `app-v4/src/domain/job.ts`
  - `batchSafeSummaryReady(...)` is the existing fail-closed job-side batch readiness prerequisite;
  - item status/disposition vocabulary is fixed (`error + removed` remains distinct from completed).
- `app-v4/src/output/confidential-audit.ts`
  - `buildConfidentialAudit(session)` is the canonical Confidential data authority for one ReviewSession: original↔replacement mapping, decision trace, notes and restored entries.
- `app-v4/src/output/confidential-audit-serializer.ts`
  - canonical deterministic TXT semantics and explicit confidentiality marking for one audit.
- `app-v4/src/privacy-gate/privacyGateModel.ts`
  - currently carries stale “batch Confidential not defined” copy and already receives aggregate batch-session facts; Gate and Result must not contradict the new accepted artifact.
- `app-v4/src/export/ExportStep.test.tsx`, `ExportStep.batchSafe.test.tsx`, `ExportStep.unmount.test.tsx`
  - accepted confirmation/current-authority/disposal evidence patterns.
- `e2e/rec87-batch-result.spec.ts`
  - canonical realistic 12-document batch Result journey, now including #87/#88 outputs and deliberate removals.

## REUSE — authorities that must stay single-sourced

- Batch Confidential content is composed only from the **current finalizable per-item `ReviewSession`s** through canonical `buildConfidentialAudit(...)` semantics. Do not derive correspondence from Safe text, source files, rendered DOM or a new mapping model.
- Existing batch readiness remains the job-side prerequisite. Actual Confidential artifact authorization additionally requires the exact current batch-session set for every completed/non-removed item and those sessions must still be finalizable. Do not create a second batch state machine.
- `job.outputs.confidentialAuditReady`, if updated, is at most a synchronized job-side availability mirror; it is never sufficient by itself to authorize bytes without the current session authority.
- Reuse the accepted one-time confirmation semantics from single/Structured Result and the accepted stale/unmount invariant from #88. Do not invent a competing lifecycle.
- Safe ZIP/PDF/CSV behavior and hierarchy from #87/#88 are protected siblings.

## CLOSED DECISIONS — do not rediscover

1. **Artifact format/name:** exactly one batch Confidential text artifact, `auditoria-confidencial-lote.txt`. No batch Confidential XLSX/PDF/ZIP in this ticket.
2. **Batch composition:** one deterministic section per original batch index. Completed reviewed items carry their canonical Confidential correspondence/audit. A deliberately removed failed item may carry only bounded non-sensitive ordinal/disposition metadata and **no fabricated audit body/session**.
3. **No source filename metadata:** source filenames are not canonical Confidential correspondence authority and may themselves identify a patient. The batch artifact uses stable original-index labels (`Documento N`), never source filenames.
4. **No Safe-body harvesting:** ordinary kept/non-detected clinical text that exists only in Safe output is not copied into the Confidential artifact. Original detected values, replacements, reviewer notes and restored entries are allowed because they are canonical Confidential authority.
5. **Eligibility:** the batch must already satisfy the accepted batch ready prerequisite and every completed/non-removed item must have the exact current finalizable ReviewSession. Missing/stale/non-finalizable session authority fails closed with zero download.
6. **Confirmation is not readiness:** first action only opens the warning. Confirm authorizes one download attempt against the captured current authority and resets before generation; Cancel resets with zero download. A fresh download always requires a fresh first action.
7. **Invalidation:** pending confirmation dies on Job replacement, batch-session identity/review mutation, readiness loss, confirm/cancel, or Result disposal. It cannot be carried across a changed batch.
8. **Async boundary:** the real Confidential generation path must have an awaited generation boundary sufficient for the required stale/unmount proof. Exact builder strategy is implementation-owned; do not fake async only in tests.
9. **Current-authority guard:** after the awaited generation window and immediately before download, the exact Job + session-set + readiness authority must still match and the Result must still be mounted. Otherwise zero download and no false success.
10. **Error privacy:** raw generation/serialization exceptions may contain Confidential values and must not be logged or rendered. User-visible failure is Spanish and content-free; diagnostics, if retained, are typed/content-free only.
11. **Asymmetry:** the Confidential zone remains visually/interactionally separate from the Safe format group. It is an internal audit action behind warning+Confirm, never another peer “format” of the prepared result.
12. **Local-only:** no network, persistence, analytics, remote generation or external logging.

## DO NOT TOUCH / OUT OF SCOPE

- #80–#85 REC-08/09 work.
- #90/#91 exhaustive localization/visual closeout beyond this touched batch Result zone.
- Safe ZIP/PDF/CSV representation semantics or filenames from #87/#88.
- Privacy policies, recognizers, transformations, pseudonym identity or ProcessingContext semantics.
- New batch status/disposition vocabulary or another ReviewSession/readiness authority.
- Source-file recreation, OCR, source-layout preservation, original binary packaging.
- New dependencies or dependency upgrades without a concrete blocker and HUMAN STOP.
- Publication or GitHub mutation.

## Conditional fidelity safeguards

- **Safe/Confidential representation separation — ACTIVE:** the new artifact may contain canonical Confidential mapping/notes/original values, but must not pull in unrelated Safe-only body text or leak its data into Safe siblings.
- **Affected shared seam — CONDITIONAL:** if an existing single/Structured Confidential helper is materially changed rather than composed, cover its known sibling consumer and report any material out-of-envelope impact instead of broadening silently.
- **Adversarial evidence — ACTIVE:** one-time confirmation, stale/unmount zero-download, session-set completeness and Safe-only-body exclusion are material negative claims and need falsifiable witnesses.

## PROOF — minimum writer-phase evidence

Use focused deterministic evidence; broad/full suites belong to integration/publication unless a concrete failure justifies them.

1. **Canonical Confidential oracle:** for a ready synthetic batch, each completed document section agrees with `buildConfidentialAudit(currentSession)` on mapping/status/replacement/note/restored-entry semantics; no privacy transform or Safe-text reconstruction is rerun.
2. **Allowed-vs-forbidden sentinel adversary:** plant (a) an original detected value and reviewer note that MUST appear in the Confidential artifact, and separately (b) a source-filename sentinel plus ordinary non-detected Safe-body sentinel that MUST NOT appear. Prove both directions on real emitted TXT bytes.
3. **Removed-item boundary:** a batch with a deliberately removed failure remains eligible when otherwise ready; the removed index gets no fabricated audit body, while the existing Safe CSV still preserves `error,retirado` unchanged.
4. **Missing/stale session refusal:** completed-looking Job state with a missing or non-finalizable current session produces zero Confidential download/bytes and factual unavailable state; no `job.outputs` flag alone can override this.
5. **Deliberate confirmation:** first action → zero download + Spanish identifiable/reversible warning; Cancel → zero; fresh request + Confirm → exactly one `auditoria-confidencial-lote.txt`; confirmation resets after either action.
6. **Mutation invalidation:** pending confirmation dies independently on Job change, batch-session/review mutation and readiness loss. Confirm after any such change produces zero.
7. **Async/current-authority witness:** suspend real generation, then separately invalidate authority and unmount the Result; stale completion produces zero download and no false success.
8. **Asymmetric Result hierarchy:** Safe ZIP remains the normal primary action; Confidential stays in its separate internal zone and is never rendered inside “Otros formatos”. User-visible warning/confirm/cancel/error copy is professional Spanish.
9. **Realistic-density journey:** extend/compose the existing ~12-document batch journey through ready Result; prove the first Confidential action downloads zero, Confirm downloads exactly one artifact, removed items are not fabricated, and the existing Safe ZIP/PDF/CSV assertions remain intact.
10. Run the smallest relevant typecheck/lint/format checks for touched source. Do not run the full repository suite by ritual in the writer phase.

## HUMAN STOP

STOP and return to Cora/human if any of these becomes necessary:

- defining a new correspondence authority instead of composing canonical `ConfidentialAudit` facts;
- weakening the existing batch-ready prerequisite or treating confirmation as readiness;
- exposing source filenames or unrelated Safe-only body text to make the artifact useful;
- changing Safe output semantics, ReviewSession, privacy policy/transformation or pseudonym rules;
- adding another Confidential format or dependency;
- changing single/Structured Confidential semantics materially instead of composing/reusing them;
- a material product/privacy/state/architecture choice outside the closed decisions above;
- a material supported sibling outside this envelope is found to depend on a changed shared seam;
- a bound standard-Complex model is unavailable, quota-blocked, removed or materially incapable;
- any push / PR / merge / issue mutation / deploy would be required.

## Expected C-087 Complex closeout

Return one complete closeout containing:

- fixed pre-implementation review anchor supplied in the launch prompt;
- final candidate SHA and clean-tree status;
- changed-file inventory and scope statement;
- focused writer evidence;
- exactly one canonical Standards + Complex Spec review result;
- any fresh correction attempts and their exact findings/closure;
- confirmation that #80–#85 and #90/#91 were not absorbed and Safe siblings were preserved;
- `Publication: LOCAL_ONLY`.

Then STOP for Cora integrated audit.
