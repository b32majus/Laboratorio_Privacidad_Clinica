# Feature: T13 #17 — Policy-driven date semantics and consistent date-shift foundation

Status: IN PROGRESS
Work Order: GitHub #17 (EXECUTION_READY=YES; blockers #6, #15 CLOSED; no hardening comment — launch-prompt hypothesis + SPEC §9 + D-010 govern)
Branch: work/native/v4-travel-t12-t16-20260925
Execution profile: native-v4-heavy (unchanged; no lifecycle boundary switch)

## Authority reconciled (pre-writer)

- GitHub #17 body: scope "Replace generic all-dates-as-visits behavior with policy-driven date transformation and a consistent-shift foundation"; acceptance: roles not blindly re-labelled by chronological sorting; operator supports existing/generalize/redact + consistent shift foundation; shared ProcessingContext preserves stable shift for linked records; intervals/ordering tested; no overclaim.
- SPEC_V4_PRIVACY_ENGINE.md §5 (DATE_SHIFT target operator), §7 (date-shift seed/offset state as ProcessingContext state), §9 (redaction/generalization/consistent shifting; role semantics; no generic Visit-N destruction).
- CURRENT_DECISIONS.md D-009/D-010.
- Launch-prompt T13 composition hypothesis (A/B/C) — binding chain shape.
- Code map (read-only explore 2026-09-26): Visit-N labeling lives in FechasManager.recalcularEtiquetas (anchored to wall-clock `hoy`); preprocessFechas + LegacyDateTransformOperator dispatch; ProcessingContext = {mode, pseudonymState, options} with snapshot/freeze/reconcile precedent; detectors emit fecha_completa/fecha_parcial/ano only (no roles); from-processor/review-session are category-agnostic with requiresReview=true default; standard/strict share FECHA→legacy.date-transform; external-ai/longitudinal-research typed fail-closed.

## T13 semantic boundary (resolved pre-writer; recorded for human review)

- Date roles: explicit-cue classification only (nacimiento/birth, ingreso/admission, alta/discharge, cita futura/future appointment); unlabeled/ambiguous dates default to visit semantics. Unknown role ≠ guessed behavior (D-009).
- Existing Visit-N relative-label semantics is preserved for visit-role dates (accepted current behavior, parity-protected).
- Non-visit explicit roles are EXCLUDED from chronological visit renumbering (acceptance 1); under standard/strict they propose redaction — a spec §9-listed behavior, review-visible. No invented birth→age or month-name mappings.
- Generalize (month-precision for fecha_completa; year for fecha_parcial/ano) and DATE_SHIFT (consistent per-source-date offset from context state; intervals and order preserved) land as operator capabilities with typed fail-closed behavior. Product policies standard/strict keep their accepted FECHA mapping; external-ai/longitudinal-research remain fail-closed until their complete mappings gain accepted authority.
- Shift foundation: ProcessingContext.options.dateShift state threaded by the engine into the date operator context (explicit caller intent); FechasManager wall-clock `hoy` NOT made injectable in this ticket unless the composed oracle proves it strictly necessary (would expand legacy surface).

## Work-unit chain (each with its proving oracle)

1. WU-A — Date semantic/context foundation: pure date-role classifier (explicit cues; typed unknown), ProcessingContext dateShift state shape + snapshot/freeze/reconcile precedent, interval/order oracle at unit level. No operator/policy behavior change.
2. WU-B — Operator semantics: role-aware existing date transform (non-visit roles excluded from Visit-N, redact proposals), new generalize + redact date semantics + DATE_SHIFT operator with consistent per-source-date shifting from context state; typed fail-closed unknowns; policy mappings unchanged.
3. WU-C — Composed longitudinal regression: composed engine + ReviewSession path proving birth/visit/admission/discharge/future fixtures are not blindly "Visita N"; linked-record shared-context shift preserves intervals/order; false-positive and parity controls; DEBT_REGISTER FUNC-005/PRODUCT-001 disposition.

## Tasks

- [x] WU-A: role classifier + shift context state + interval/order oracle — commit f519659 (feat(engine), 5 files). Resolved shift semantics: seed-derived context-stable offset (interval/order preserving) + explicit per-date overrides; per-date hash helper exists but is JSDoc-marked non-default (parent task-spec defect corrected against SPEC §7/§9 + #17 acceptance — no human product decision required). Focused verification: vitest 457/457 (one pre-existing App.test.tsx timeout flake passed in isolation and did not reproduce), typecheck/lint/prettier/privacy-eval PASS. Independent verify PASS 6/6 items.
- [ ] WU-B: role-aware transform + generalize/redact/DATE_SHIFT operators, typed fail-closed
- [ ] WU-C: composed longitudinal regression + debt disposition
- [ ] Per-unit deterministic verification; ticket-level npm test chain

## Native review disposition — 2026-09-26 (STOP recorded)

- Operator instruction: if review_due -> review -> correction -> acknowledge -> burn.
- Per-unit committed-range ASSESS (gentle_review facade): typed `risk=unassessable` / `schema-incompatible`, no diagnostic (documented seam #4791), 4th consecutive occurrence; plan (writer self-verification + independent verifier) satisfied; no review_due offered by ASSESS.
- gentle_review {"operation":"inspect"}: offers review.start ONLY for a whole-workspace candidate (base b1c25e9c, pre-V4 3.0-main commit; ~105 changed paths = entire V4 branch T01..T13-WU-A). Starting it is prohibited by operator authority (launch contract + AGENTS.md: no whole-branch synthetic candidates; T01-T11 already carry APPROVED+burn receipts from PR #40 checkpoint).
- Disposition: NO START executed; no consent manufactured; WU-A evidence stands on the fail-closed verifier path. Human decision required: authorize either (a) a working per-unit committed-range review route, or (b) explicitly the workspace candidate. Train halted at this point per operator instruction.
