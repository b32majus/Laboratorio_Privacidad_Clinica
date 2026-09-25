# Feature: T08 #12 — Safe Output and Confidential Audit split

Status: IN PROGRESS
Work Order: GitHub #12 (EXECUTION_READY=YES; blockers #4, #11 CLOSED)
Branch: work/native/v4-t08-20260924
START_HEAD: 1a20885e8d11738c7a095142cfa319dcea9f3638
BASE_BRANCH: 3.0-main (current base SHA bbe2a6a302d1d5f669ba6f2b350925a6fa667aab per issue #5; this run's local branch starts at 1a20885e)

## Authority reconciled (pre-writer)

- CONTEXT.md §2/§10: Safe Output vs Confidential Audit vocabulary; fail-closed export.
- CURRENT_DECISIONS.md D-004 (ReviewSession authority), D-005 (physically/semantically separate outputs), D-006 (no anonymity claims), D-009 (fail-closed).
- SPEC_V4_APP_AND_REVIEW.md §4 (Review contract/export gate), §6 (Privacy Gate factual), §7 (Export contract: two independent surfaces).
- GitHub #12 body incl. execution-readiness hardening (2026-09-24).
- QUALITY_EXECUTION_PROTOCOL_V1 §4 (pre-writer composition forecast), §5 (per-work-unit), §6 (closeout).
- TRAIN_V4.md + TRAIN_T06_T08_20260924.md §5–§7 (T08 runs alone; local-only publication boundary).
- DEBT_REGISTER.md: PRIV-002 (P0 Export) and UX-006 (P0 Export UX) are the debt IDs owned by T08.
- Atenea WORK_UNIT_COMPOSITION_POLICY_V1 (default 400 authored changed lines planning baseline; 401–600 soft overage; 601–800 exception; >800 STOP).
- Code seams read: js/domain/review-session.js (T01 authority: getFinalText throws MANDATORY_REVIEW_PENDING; canFinalize; getProgress with restoredDetections), js/domain/from-processor.js, app-v4/src/domain/job.ts (OutputAvailability placeholder; review.complete gate; FLOW_STEPS with privacy-gate/export), app-v4/src/useJobSession.ts (domain-state bridge with clear()), app-v4/src/App.tsx (privacy-gate/export steps are honest placeholders), app-v4/src/review/reviewWorkspaceModel.ts.

## Pre-writer composition forecast (RESOLVED — recorded before first writer mutation)

Project-side hypothesis was A (pure services), B (integration), C (export UI). Confirmed with adjustments after reading the real code:

- The pure-services surface, if composed as ONE unit, forecasts ~550–650 authored changed lines (two contracts, two builders, two serializers, two adversarial oracle suites). That lands in the Atenea soft-overage/exception band for a unit whose two halves are explicitly separate products (D-005 "physically and semantically separate"). The smallest honest chain therefore separates them by product artifact, not by file/line mechanics.
- The UI surface splits honestly along the canonical flow: the Privacy Gate factual view (SPEC §6) is a different step and a different reviewable behavior from the Export step's dual actions + session-isolation behavior (SPEC §7, #12 invariants 5–7).

Resolved semantic work-unit chain (each unit carries implementation WITH its proving oracle; no test-only units; no mechanical slicing):

1. **U1 — Safe Output service + fail-closed oracle** (`app-v4/src/output/safe-output.ts` + `safe-output.test.ts`)
   - Pure domain consumers of the T01 ReviewSession (no second review authority; reuse getFinalText/canFinalize/getProgress).
   - buildSafeOutput fails closed on pending mandatory decisions (acceptance 1); equals exact canonical final text when complete (acceptance 2); honors restored/keep-original as explicit completed decision (acceptance 3).
   - Structural shape: SafeOutput type has NO fields for mappings/notes/original-for-audit/correspondence (acceptance 4 by construction + structural assertions, not forbidden-word scans).
   - TXT serializer; no *_anonimizado semantics; no anonymity/compliance claims.
   - Forecast: ≤ ~300 authored lines.
2. **U2 — Confidential Audit service + separation oracle** (`app-v4/src/output/confidential-audit.ts` + `confidential-audit.test.ts`)
   - Authorized trace: original↔replacement mapping, reviewer notes, decision trace, restored originals; unmistakably named/marked CONFIDENTIAL (acceptance 5).
   - Pure function of (ReviewSession, job metadata); NO module-level mutable state (session isolation by construction, proven in U4).
   - Forecast: ≤ ~350 authored lines.
3. **U3 — Privacy Gate factual view + output availability wiring** (`app-v4/src/review/PrivacyGate.tsx` or `app-v4/src/privacy-gate/*`, `app-v4/src/domain/job.ts`, `app-v4/src/useJobSession.ts` + tests)
   - Job.outputs becomes real derived availability (fail-closed while pending); Privacy Gate shows factual state: treated/pending/manual/restored counts + kept-original warning; no score/certification claims (acceptance 3 warning surface).
   - Forecast: ≤ ~400 authored lines.
4. **U4 — Export step dual-surface UI + session isolation** (`app-v4/src/export/ExportStep.tsx`, App wiring, useJobSession clear + tests)
   - Two separate actions/artifacts; Safe Output gated with explicit blocked reason; Confidential Audit separately named/marked with strong warning (acceptance 5 UI).
   - Session isolation: clear/new job leaves prior confidential mapping unreachable (acceptance 6); DOM rerender cannot change canonical export state (acceptance 7).
   - Forecast: ≤ ~400 authored lines. ACTUAL: ~717 authored lines (ExportStep.tsx 159 + ExportStep.test.tsx 363 + App wiring/oracles ~195). Atenea 601–800 exception band — durable composition decision recorded post-forecast: the acceptance-6/7 oracles are App-flow tests that must accompany the export behavior (separating them would violate the no-tests-without-behavior rule); the dual-surface component, its downloads and its isolation/rerender proofs form one reviewable behavior, so a further split would be mechanical. Proceeded under the Atenea soft/exception band with this recorded rationale.

Indivisibility check: no honest unit forecasts above 600; no size exception required. STOP trigger remains if a unit grows past forecast during implementation (Atenea policy §6).

## Execution log

- U1: DONE. Writer: gentle-ai-worker (native-balanced, nan/glm5.3-flash high). Commit 05d350d (feat(output): Safe Output service + fail-closed oracle, 348 lines). Focused vitest 10/10 green; typecheck/lint/format green. Native review: lineage review-2c831dfbb9f22669, tier medium (slice_budget_reached, 408 lines incl. the 60-line docs(odd) forecast commit f80eea7), lens review-reliability, state APPROVED, acknowledged + burned (gentle-ai.review-acknowledged/v1, consumed revision sha256:b855687c98aff17964b563bdab8d1deaf24ff12adc740b2397da6179e3ad1f03, delivery=ordinary-repository-policy).
  - Runtime observation (not a candidate defect): the gentle-pi facade ASSESS decode rejects native 3.7.0 envelopes whose reason omits the optional `detail` field (typed schema-incompatible with no sanitized diagnostic). Native CLI assess itself worked (read-only) and its typed review_due=true was honored via the facade START route. Recorded as runtime evidence, not repaired here.
  - RDD switch: provider continuation rdd_disabled (inspect forecast) directed the exact source-scoped enable; `gentle-ai review mode enable --scope clone` cleared the clone-local off and effective mode is now on (decided by global). No routing/reviewer/profile changes.
- U2: recomposed per explicit human decision (oversized 871-line unit) into U2a/U2b.
- U2a: DONE. Writer: gentle-ai-worker. Commit 001133c (feat(output): Confidential Audit data contract + builder, 759 lines incl. oracle). Focused vitest 15/15 audit + 10/10 safe-output regression; typecheck/lint/format green. Native review: lineage review-9ca44ad1413cd3ad, tier medium (slice_budget_reached), lens review-reliability, state APPROVED, acknowledged + burned (gentle-ai.review-acknowledged/v1, consumed revision sha256:31aa4c6553db170abcdf3b01a6999758e8c55030d8bdfca837f857b698504d3b). Advisory non-blocking finding R3-001 (reliability, app-v4/src/output/confidential-audit.ts:200-296, WARNING/informational) recorded for later separate work — no correction opened, receipt stands.
- U2b: DONE. Writer: gentle-ai-worker. Commit fbf7a76 (feat(output): Confidential Audit serializer + explicit marking, 376 lines incl. oracle). 35/35 focused tests green; typecheck/lint/format green. Native review: lineage review-8cce4fe16c0b684a, tier medium, lens review-reliability, state APPROVED, acknowledged + burned (consumed revision sha256:f484b441369be50c95edcf1c3a5e2977e72e7899ef82e8ebacb4c0ce2a317ca1). Advisory non-blocking finding R3-session-id-line-breaks (reliability, confidential-audit-serializer.ts:66, informational) recorded for later separate work.
- U3: (pending)
- U3: DONE. Parent finished the writer's stalled run (incident: writer stalled 30 min in bash; all surfaces already written) with two bounded micro-corrections: App.tsx nullable-job prop fix and App.test.tsx accept-all loop made terminating (Pending filter + queryAllByRole guard). Commit d8cda92 (feat(app): factual Privacy Gate step + real output availability, 549 lines). Full V4 suite 176/176 green; typecheck/lint/format green. Soft-overage rationale (549 lines, Atenea 401-600 band): one coherent gate model+component+wiring unit with its flow oracles; further split would separate the model from its proving UI flow. Native review: lineage review-fbb83ce3c8465393, tier medium, lens review-reliability, state APPROVED, acknowledged + burned (consumed revision sha256:8722f34c16ce57fcae949b4221aef16fa325fb5dd03d49ddd1ce5093980d38b6).
- U4: DONE. Writer: gentle-ai-worker. Commit e2e18a4 (feat(app): Export step with separate Safe Output and Confidential Audit surfaces, 717 lines). Focused 78/78 and full suite 186/186 green; typecheck/lint/format green. Native review: lineage review-0fb235c2a152725c, tier medium, lens review-reliability, state APPROVED, acknowledged + burned (consumed revision sha256:f2566f455be2a81dac83f03f13d97f948d3156645ede0a48b0525c5bd50adfc4). Advisory non-blocking finding R3-001 (reliability, ExportStep.tsx:73-79, informational) recorded for later separate work.
- Closeout: DONE. Full npm test chain (links, storage, external, vendor, pdfjs, smoke, positioning, domain contract, privacy-eval, V4 suite 186/186) green; build green with clean tracked tree; format/typecheck/lint green; check:external:selftest and check:pdfjs:selftest green. Debt PRIV-002 and UX-006 reconciled to DONE with evidence in docs/DEBT_REGISTER.md; SEC-001/SEC-002 and unrelated debt left truthfully unchanged. Advisory review findings (R3-001 audit builder, R3-session-id-line-breaks serializer, R3-001 export step) are informational, non-blocking, and recorded here for future separate work.

## Corrective phase — PR #39 promotion audit findings (append-only, published branch)

Human audit authority: two bounded blocking findings + one non-blocking observation. No reset/rewrite; no T08/T11 architecture reopening.

- **C1 (blocking)** — accepted-without-proposal invariant: a detection with `proposed === undefined` must NOT be completable via `accepted` (legitimate deletion `proposed === ""` stays valid). Enforce in the domain authority (js/domain/review-session.js applyDecision) so no caller can synthesize the invalid state, and stop ReviewWorkspace from offering the invalid Accept action. Regression: manual detection without proposal cannot be accepted (typed error); UI cannot accept it; modified succeeds; restored succeeds and stays visible; Safe Output cannot reach a completed state containing the planted manual value via accepted.
- **C2 (blocking)** — Privacy Gate overclaims: "Direct identifiers treated" uses global accepted/modified counts; a completed FECHA detection would be presented as a direct identifier. Use neutral factual aggregate wording (reviewed/treated detections); no new taxonomy (T11/T12 stay out). Regression with a non-direct FECHA type.
- **C3 (non-blocking observation)** — requiresReview=false detections can yield audit mapping entry status pending with trace.pending=0/canFinalize=true. Not reachable through the current V4 adapter (defaults requiresReview=true). Record one concise truthful debt item for reconciliation before/with T11; do not redesign semantics.

Corrective composition: C1 and C2 are separate executable candidates (independent seams: domain/review UI vs privacy-gate copy), each with its own oracle, commit, native ASSESS and APPROVED+burn when due. C3 is a docs-only commit.

### Corrective execution evidence

- C1: DONE. Writer: gentle-ai-worker. Commit 9e87e6b (fix(review): reject accepted-without-proposal decisions, 257 lines: js/domain/review-session.js invariant + ReviewWorkspace guard + contract/workspace/Safe-Output oracles). test:domain 41/41; full V4 suite green; typecheck/lint/format green. Native review: lineage review-36899e19ebf1dc56, tier medium, lens review-reliability, APPROVED + burned (consumed revision sha256:990cd4b3a40c859399c0a6f432eae86fe80972cdcee2754dfe4de7d87c7eca57).
- C2: DONE. Writer: gentle-ai-worker. Commit 17ce639 (fix(privacy-gate): neutral factual wording for treated detection counts, 93 lines incl. FECHA regression). Full suite 193/193 green; gates green. Native review: lineage review-d2b3f567c48a73e7, tier medium, lens review-reliability, APPROVED + burned (consumed revision sha256:342415ec3800837f6a0a850b8638a20a0db143b403f9487368554df67eee3235).
- C3: DEBT_REGISTER.md ARCH-011 recorded (requiresReview=false audit-trace semantics, reconciliation with T11 policy work); docs-only.
- Closeout: rerun exact-head gates after C3 (see final report).

## Commit evidence

(record per unit: commit sha, ASSESS outcome, review lineage/burn if due)
