# Issue #84 — REC-09: no-op removal and quiet application shell

Status: READY_TO_LAUNCH — PREPARATION ONLY / LOCAL_ONLY
Prepared: 2026-10-11; no implementation session, push, PR, issue mutation or merge authorized.
Repository: b32majus/Laboratorio_Privacidad_Clinica
Canonical branch: 3.0-main (NOT the GitHub default main)
Fixed base / launch HEAD: 3a2ad2c58c602620cc32dcedaae4ef69c47f0a7b (merged PR #113)
Branch: work/issue84-noop-shell-c087-20261011
Worktree: /srv/kairos-lab/qualification/laboratorio-issue84-noop-shell-c087-20261011

## 1. Accepted authority and selection

Read only what is needed: project docs/START_HERE.md; docs/HUMAN_PRODUCT_DESIGN_AUTHORITY_V1.md (HPD-01/02/03/06/11/12 and G-HP1/2/3/4/6/7/8/9/10); docs/RECOVERY_MASTER_PLAN_2026-10.md REC-09; docs/audits/2026-10-product-design-reconciliation-final.md A-01/02/03/09 and R-01/02/03; docs/shaping/CURRENT_DECISIONS.md D-001 amendment D-023, D-004/005/013/024; GitHub issue #84; AGENTS.md, CODING_STANDARDS.md and local docs/ATENEA_EXECUTION_ROUTING_V0.md. The historical QUALITY_EXECUTION_PROTOCOL_V1 and five-step UI wording are not current human-product authority.

#83 is PRODUCT-MERGED through PR #113 at the fixed base, although its GitHub issue is still OPEN and REC-09 documentation needs administrative reconciliation. Do not claim #83 closed, redo it, or include its closeout here. #84 is independently unblocked and specifically owns ordinary no-op phases and common shell. #85 independently owns structured comparative columns and no-op Structured Review. #90/#91 are downstream final closeouts.

## 2. Atenea route and lifecycle

Cost policy: standard (repository default; no new human opt-in); risk_class: complex, because this shared shell changes real task transitions, active Review authority, policy-driven invalidation and output-gate continuity across job families.
Visible coordinator: atenea-complex / nan/mimo-v2.6-flash (non-mutating).
Writer: atenea-implementer-complex / nan/glm5.3-flash#high.
Standards: atenea-review-standards / openai/gpt-6-luna#high; Spec: atenea-review-spec-complex / openai/gpt-6.1-sol#high; fresh corrector: atenea-corrector-complex / nan/glm5.3-flash#high, only for concrete findings, max 2 attempts.
One bounded GitHub issue → /implement. One coordinator-owned Standards + Spec canonical review on a fixed candidate, not per slice. No fallback or mid-unit profile switch. A model/quota/binding failure is HUMAN STOP, not permission to change route. No need to reproduce methodology/policies in child prompts.

## 3. WHAT — user-observable acceptance

A. Replace the universal visible five-step pipeline navigation with a quiet, human-task-first app shell. No destination exists merely to expose Input/Configure/Review/Privacy Gate/Export internals. Preserve these internal FlowStep states and their authority. Do not introduce a router or URL carrying job content.
B. After creating ordinary pasted-text or single-document work, reaching actual review/attention must NOT require visiting UnstructuredConfigureState ("No additional configuration ... continue"). Pending work, local processing error and appropriate next action are factual and visible. No fake progress, success or empty Review screen that requires ceremonial continuation.
C. When review has no mandatory detections, the user can reach Result without a compulsory no-op screen, while deliberate inspection/manual missed-entity marking remains discoverable. No implicit acceptance of any pending/low-confidence/manual detection. After each actual decision, next meaningful action and ability to revisit/correct are apparent.
D. Result remains a human outcome (blocked / needs attention / ready), preserves Safe versus Confidential separation and deliberate Confidential confirmation. Mandatory review blocks Safe output; current direct Review→Result for text/document remains usable without a compulsory Privacy Gate screen. Required processing/gate facts stay true and discoverable.
E. Keep current intended use/policy and browser-local processing facts discoverable at the point of need. Policy selection/availability derives from current engine/policy-guidance authority, not a second mapping. Four-policy guidance may be contextual/on-demand instead of four persistent cards; never vanish the safety information or patient-ID qualification. No marketing/compliance/anonymity claims.
F. Keep New/nuevo trabajo normal and visible; demote but distinctly retain destructive Clear session. No misleading claim that New preserves the former job, no accidental retention or clearing of drafts. Do not make internal job kind or full technical help permanent chrome.
G. Shared shell must not strand document-batch users: pending read/queue, failure/retry/remove/acknowledge, item selection, Result and blocked outputs remain reachable and truthful. Do not change the batch state machine, its Privacy Gate traversal requirement, or artifact-readiness separation merely to simplify navigation.
H. Structured Configure remains real column work; Study-ID, class→action, date roles, explicit readiness and free-text review remain accessible. Do NOT implement the comparative structured table or remove/recompose the empty StructuredReviewNotice here: #85 owns that specialized presentation. Shared shell changes may accommodate those destinations without changing their semantics. The #85 open obligation must not be misreported as #84 closure.
I. Touched user-facing affordances are professional Spanish and task-prominent at 375px and 1280px. Exhaustive localization (issue #90) and whole-system visual polish (#91) are out of scope.

These are outcome/acceptance facts, not a preapproved design of exact component layout or buttons.

## 4. WHERE / REUSE — bounded seam map

Primary: app-v4/src/App.tsx: StepNavigation, handleGoToStep, currentStep presentation, no-op UnstructuredConfigureState, header/New/Clear/current policy/local-processing region, PolicyGuidance, dispatch to Review/Batch/Structured/Result. Existing InputStep, ReviewWorkspace and ExportStep already implement meaningful human work. Use existing ExportStep.onReturnToReview for correction where possible.

Read-only authority: app-v4/src/domain/job.ts (FlowStep, goToStep/isStepAccessible, batch Result rules, policy invalidation), app-v4/src/useJobSession.ts (single session, once-only startReview, async-current-Job checks), privacy-gate/privacyGateModel.ts, review/review-domain.ts, policy-guidance.ts. Preserve rather than replace their rules.

Optional minimum display wiring ONLY where unavoidable: existing ExportStep and BatchReviewView presentation/callbacks. No changes to their readiness, download/serialization or domain computations. Any materially necessary out-of-envelope state/domain change → HUMAN STOP.

Known test consumers of changed labels/navigation: app-v4/src/App.test.tsx; app-v4/src/testing/network-invariant.test.tsx; e2e/harness/flows.ts; e2e/input-start.spec.ts, e2e/ux-closeout-shell.spec.ts, e2e/rec05-result.spec.ts, e2e/review-export.spec.ts, e2e/batch.spec.ts, e2e/structured-composed.spec.ts, e2e/policy-guidance.spec.ts and direct phase consumers in other existing e2e/*.spec.ts. Inventory affected selectors once via a bounded search before calling the candidate complete. Migrate only materially affected existing tests without weakening their assertions or manufacturing a second UI test framework.

## 5. Conditional continuity — material, bounded

Action → visible response / retained state → next action:

- Create text/document → local processing and genuine current Review / correctable attention (or valid zero-pending Result) → decide/inspect/manual mark or Result. Processing refusal stays visible and fail-closed; the engine runs once for the current Job; an obsolete async result cannot take over a newer Job.
- Review decision (including #81 manual marking and #82 risky Keep original confirmation) → accurate current pending count and state, original source and existing decisions retained → next pending / correction / Result. No silent drop, auto-accept or stale confirmation.
- Change active policy after a review or from Result → existing policy-dependent review/result authorization invalidated → the operator sees the real reason and can redo review without stale Safe download. Unchanged policy remains an exact no-op.
- Return from Result → the prior actual review/task and its canonical decisions remain intact → correct one decision and return to updated Result without re-running the engine.
- Batch item error or partial success → visible actionable queue and factual Result readiness → retry/remove/acknowledge or inspect completed items; no unknown artifact made downloadable.
- New work / Clear session → visible fresh Input, no former Job data; Clear distinct and secondary. Any outstanding clipboard/file-read/export completion respects current-job authority.

Only the supported pathways materially touched by the diff require new evidence. Do not commission an exhaustive transition matrix.

## 6. CLOSED DECISIONS / DO NOT TOUCH

D-023 supersedes the universal stepper AS HUMAN PRODUCT STRUCTURE, not the internal Job/state machine. D-024 already allows direct Review→Result for text/document. G-HP2 prohibits no-op destinations. HPD-07/#83 makes review explicit and revisitable. #81 manual detection and #82 Keep-original confirmation remain mandatory safeguards. REC-03/04 structured contracts and REC-07 batch outputs remain valid.

DO NOT TOUCH: Atenea C-087 files/profiles/routing, shared OpenCode configuration, project AGENTS.md, domain/job.ts state/guards, useJobSession.ts review/async authorities, ReviewSession/engine, processing context, Privacy Gate readiness model, Safe/Confidential serialization, structured patient identity/classification/treatment logic, file extraction, network/storage security, deployment/dependencies. Do not alter GitHub issues, PRs, branches outside this prepared worktree or main. Do not absorb #85, #90, #91, #92/#93 or unrelated historical debt.

If an accepted user task cannot be represented without changing one of these protected material authorities, HUMAN STOP with exact counterexample; do not silently weaken it.

## 7. PROOF — smallest material evidence by phase

Before mutation: reuse current App/Result/Review/network tests and Playwright harness/fixtures; take one bounded baseline of no-op Configure, current chrome and next-action reachability. Existing synthetic fixtures suffice unless a concrete missing boundary is found.

Writer: focused RED→GREEN around common shell and affected navigation/consumer selectors. Preserve test assertions for job isolation, review once, policy change/invalidated output, manual/Keep-original correction, batch partial failure/blocked outputs and structured free-text routing. Existing test consumers must be reconciled with new accessible names (the #83 CI failure pattern) rather than left to repeated publication corrections. Run the smallest affected Vitest set, typecheck, targeted format/lint, and one production-like Chromium journey at 375×800 and 1280×800 proving no compulsory Configure, controls visible/clickable and no horizontal obstruction. One small route per material family (text/document plus batch or structured as impacted); measure user action/context switches, not a ceremonial count target. No PHI.

Review: exactly one Standards + Spec review of fixed SHA; check shared-seam representations and protected invariants. Fresh correction only for proven finding and focused evidence.

Publication, AFTER human authorization: integrated repository CI/Playwright/CodeQL on exact published SHA, broader tests then only. Do not run broad suites on every implementation slice, repeat same-SHA screenshots without a concrete gap, or weaken obsolete tests.

Conditional safeguards triggered: PRODUCT_FIDELITY_GATES_V1 Gate 2 (visible navigation must not narrow supported states) and Gate 3 (shared shell consumer consequences). G-HP1/2/3/4/6/7/8/10 apply to touched journeys; visual evidence only for real spatial risk. Gate 4 composed REC-09 checkpoint belongs after #84/#85 as appropriate, not an additional worker review.

## 8. STOP / DELIVERY BOUNDARY

HUMAN STOP for unresolved product semantics, hidden meaningful supported journey, destructive or stale state, inability to preserve #81/#82/privacy/output invariants, required protected-domain mutation, missing model/quota or divergent fixed base. Do not infer new features.

Deliver exactly: candidate SHA/parent, allowed changed-path inventory, relevant focused RED→GREEN evidence, rendered journey witness and viewports, canonical Standards/Spec verdicts, correction count (max 2), known limitations, clean tree. No publication, merge, issue closure, deployment or unattended launch. STOP for Cora independent integrated audit.
