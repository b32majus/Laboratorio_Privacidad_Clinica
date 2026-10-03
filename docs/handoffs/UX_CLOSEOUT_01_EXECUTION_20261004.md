# UX-CLOSEOUT-01 — C-084 execution handoff

Status: **EXECUTION_READY**
Date: 2026-10-04
Issue: **#63 — [V4/UX-CLOSEOUT-01] Application shell and flow coherence closeout**
Audit authority: **#62 — UX/FLOW AUDIT-02**
Profile: **volume**
Matt entry: **`/implement-spec`**
Publication boundary: **LOCAL_ONLY**

## Fixed execution identity

- Repository: `b32majus/Laboratorio_Privacidad_Clinica`
- Canonical product base: `3.0-main@f9549dd50ad1b6dc80b1e326a24215df4b92bb69`
- Execution branch: `work/ux-closeout-01-20261004`
- Atenea authority: `b32majus/Atenea@50122a13f1d1e191e659a21ad6445267e4e354e6`
- C-084 lifecycle: coordinator owns `/implement-spec`, task graph, one canonical final Standards+Spec review and correction dispatch; implementation workers do not review/correct their own candidate.

If any of these identities have drifted before implementation begins: **STOP** and report the drift.

## Read first

Read only the current authorities needed for this ticket, in this order:

1. `AGENTS.md`
2. GitHub issue `#63` in full
3. GitHub issue `#62` as audit evidence/why the ticket exists
4. `CONTEXT.md`
5. `CODING_STANDARDS.md`
6. `docs/ATENEA_EXECUTION_ROUTING_V0.md`
7. `docs/specs/SPEC_V4_APP_AND_REVIEW.md`
8. `docs/specs/SPEC_V4_BATCH_AND_STRUCTURED.md` only where structured/batch facts are needed
9. relevant implementation/tests in `app-v4/`

Do not use historical Gentle/Pi/RDD/4R/lineage material as execution authority unless the current issue explicitly cites it.

## Goal

Close the remaining **presentation and interaction** incoherence across the canonical V4 flow:

`Input → Configure → Review → Privacy Gate → Export`

This ticket must make the product feel like one coherent professional application without changing privacy/domain semantics.

## Non-negotiable semantic boundaries

Treat the following as **read-only authorities** for this Work Order:

- Job/domain contracts and step-access semantics;
- policy availability/operator mappings and POLICY-01 authorities;
- privacy engine, recognizers, transformations and pseudonymization;
- `ReviewSession` decision/final-text authority;
- structured classification/date-role/transform-plan semantics;
- `privacyGateModel` counts/readiness/factual model;
- Export/output-readiness contracts and artifact formats;
- storage/network/local-only privacy guarantees.

If a requested UX outcome requires changing one of those contracts: **HUMAN STOP** and propose a separate ticket. Do not silently broaden scope.

## Required outcomes

### WU-A — Shell hierarchy + honest flow states

Implement issue #63 outcomes A, B and E:

- make the active task/step visually primary instead of rendering four full Privacy Policy cards ahead of every workspace;
- preserve all four policy descriptions/states as factual and discoverable, with current policy and structured patient-ID requirements intact;
- remove all production migration-residue copy such as `not implemented yet` / `later V4 migration`;
- for text/document/batch Configure, render an honest no-additional-configuration state based only on existing Job/policy facts;
- for structured Review, explain/summarize that structured review occurs in Configure and derive any readiness/blocker messaging only from existing structured configuration/preparation facts;
- clarify the distinct purposes/state of `New Job` and `Clear session` without removing either capability.

Do not add the historical `Workspace / Policies / Help` navigation in this ticket.

### WU-B — Review mobile action path + structured density

Implement issue #63 outcomes D and F:

- preserve desktop Review as the accepted three-column professional workspace;
- at small viewports, when a detection is selected, provide a deliberate keyboard-accessible route to the existing Entity inspector/decision controls;
- selection alone must never record a decision or mutate ReviewSession authority;
- avoid unexpected desktop scroll/focus jumps;
- reduce all-at-once structured Configure density where useful through presentational grouping/progressive disclosure only;
- keep blockers, patient-ID authority, current classification, current date role and UNKNOWN/review-required facts immediately available and fail-closed.

### WU-C — Gate copy + transversal deterministic evidence

Implement issue #63 outcome C and close the browser evidence:

- when a batch has pending review decisions and `failedCount === 0`, the checkpoint must not claim that a factual error item exists;
- discriminate presentational checkpoint copy using the existing factual causes only;
- do not modify `privacyGateModel` readiness/count semantics;
- add/adjust focused unit and browser evidence for the full closeout.

## Deterministic acceptance

At minimum prove all of the following:

1. canonical tests + typecheck + lint + format + build pass;
2. existing privacy/storage/network/PDF/vendor/release oracles remain green where applicable;
3. all four Job kinds traverse the relevant canonical steps in browser evidence;
4. no horizontal page overflow at 375 / 768 / 1280 for the changed states;
5. mobile detection selection makes decision controls directly reachable while desktop stays three-column;
6. a pending/no-failure batch Gate contains no false `error` assertion while pending review remains factual;
7. rendered production UI contains no migration-placeholder phrases;
8. all four POLICY-01 policy facts remain discoverable and job-aware after hierarchy changes;
9. structured blockers/UNKNOWN/current classification/date role/patient-ID authority remain available after density changes;
10. no forbidden semantic-authority files/behavior were changed.

Use existing shared E2E/accessibility helpers instead of duplicating contrast/overflow/network logic.

## C-084 execution rules for this ticket

- Use `atenea-volume` as coordinator.
- Use `/implement-spec` because this ticket has multiple bounded work units.
- Coordinator owns the task graph and one final integration-branch canonical `/code-review`.
- Implementation workers own implementation/TDD only and return committed/fixed candidates + evidence.
- Once canonical review starts, implementer write phase is closed.
- Review findings go only to a fresh bound corrector.
- At most two fresh finding-scoped correction attempts for the same authorized finding envelope.
- New material finding, scope expansion, or persistence after correction #2 => **HUMAN STOP**.
- No model/quota fallback inside an active work unit.
- Do not push, open PR, merge or deploy. Publication remains human-owned.

## Final return contract

Return to the human operator:

- exact HEAD;
- exact changed paths;
- WU completion summary;
- deterministic evidence run + result;
- review lineage/result and any corrections;
- unresolved findings/STOPs, if any;
- explicit statement that nothing was pushed/merged/deployed.
