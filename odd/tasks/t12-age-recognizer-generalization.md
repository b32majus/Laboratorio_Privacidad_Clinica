# Feature: T12 #16 — AGE recognizer and generalization operator

Status: T12 UNITS COMPLETE — pending ticket-level closeout + live frontier rediscovery
Work Order: GitHub #16 (EXECUTION_READY=YES; blockers #6, #15 CLOSED)
Branch: work/native/v4-travel-t12-t16-20260925
START_HEAD: 051305cff9a0a901f0e1e822e053afc88b75695d
BASE_BRANCH: 3.0-main
Execution profile: native-v4-heavy (operator decision 2026-09-26), clone-local pin, static preflight PASS + read-only child probe PASS (nan/deepseek-v4-flash).

## Authority reconciled (pre-writer)

- AGENTS.md read-first order; Atenea START_HERE.md (current main bd902f4).
- GitHub #16 body + 2026-09-25 execution-hardening comment (accepted T12 AGE policy).
- SPEC_V4_PRIVACY_ENGINE.md §3/§4/§5/§6/§8 (AGE first-class; generalization policy-driven; example bands are implementation policy).
- CURRENT_DECISIONS.md D-003/D-007/D-009/D-010.
- QUALITY_EXECUTION_PROTOCOL_V1 §3 (oracles/self-tests/exceptional branches), §4 (composition forecast), §5 (per-work-unit), §6 (closeout).
- TRAIN_V4.md Train C: T12 result = explicit age coverage with regression corpus (debt FUNC-003).
- Code seams mapped by read-only explore (2026-09-26): recognizer-registry.ts (taxonomy/coverage oracle), legacy-recognizers.ts (pipeline adapter, no age detection today), operator-registry.ts + legacy-operators.ts (GENERALIZE covers only UBICACION/SOSPECHOSO), policy.ts (standard/strict mapping; external-ai/longitudinal fail typed), registry-engine.ts (compose + resolveOperatorKey fail-closed), privacy-eval harness (taxonomy/threshold fail-closed), Safe Output vs Confidential Audit split.

## Accepted T12 AGE implementation policy (live #16 comment)

- Recognition never chooses transformation; observations carry identity only.
- standard and strict share the AGE-generalization mapping initially.
- Completed-year ages < 90 → containing decade ("45 años" → "40–49 años"); >= 90 → "90+ años"; pediatric weeks/months → "<1 año".
- Exact source age may remain in confidential review/audit evidence; accepted Safe Output must not leak it.
- external-ai and longitudinal-research remain fail-closed (no invented mapping).
- Bands are T12 implementation policy only — data/config-owned, not recognizer-embedded, not a universal privacy/k-anonymity claim.

## Pre-writer composition forecast (RESOLVED — recorded before first writer mutation)

Chain of three semantic work units; each carries its proving oracle; no test-only units:

1. WU-A — AGE recognition boundary: pure age recognizer (explicit years, `45 a.`, pediatric weeks/months, extreme ages), exact offsets, deterministic merge with the legacy pipeline (overlap resolution), false-positive oracle (units/medication/room numbers). Engine keeps typed fail-closed resolution for the new EDAD type until WU-B.
2. WU-B — AGE generalization operator + policy mapping: data-owned band config, EDAD→AGE-generalize operator, mapping for standard+strict in policy, formal taxonomy extension (RECOGNIZER_CATEGORIES/coverage keys/consistency checker/stats), typed fail-closed unknowns; external-ai/longitudinal-research stay unmapped.
3. WU-C — composed regression: registry-engine→ReviewSession→Safe Output no-leak oracle, ground-truth + false-positive corpus for EDAD in scripts/privacy-eval (manifest taxonomy + thresholds), debt FUNC-003 evidence.

## Native review ledger

- WU-A (commit 9b87b27): native ASSESS returned typed `risk=unassessable` (schema-incompatible, changedPaths=0) → followed its fail-closed plan verbatim: writer self-verification (vitest engine 174/174, typecheck, lint) + separate independent verifier (gentle-ai-verify PASS). No review START manufactured; no review_due offered.

## Tasks

- [x] WU-A: age recognizer + exact offsets + fixtures + false-positive oracle — commit 9b87b2792 (feat(engine), 5 files, +584/-3); vitest engine 174/174 PASS, typecheck/lint PASS, independent read-only verify PASS (only deviation: this ODD doc itself).
- [x] WU-B: AGE generalization operator + policy mapping + taxonomy formalization + typed fail-closed oracles — commit 214a8a93 (feat(engine), 13 files); vitest FULL suite 391/391 PASS, typecheck/lint/format PASS, independent verify PASS on all 6 items. Deviation recorded: legacy-operators.ts registration edit was outside the declared parent surface list (functionally required; diff verified registration-only).
- [x] WU-C: composed no-leak regression (privacy-eval harness gap recorded as new debt FUNC-008 instead of out-of-scope harness change) — commit 6746bd3d; vitest FULL 398/398, typecheck/lint/privacy-eval/smoke PASS, independent verify 6/6 PASS.
- [x] Per-unit deterministic verification per unit; full npm chain deferred to train closeout.
- [x] docs/DEBT_REGISTER.md: FUNC-003 DONE with evidence; FUNC-008 opened for privacy-eval EDAD gap.
