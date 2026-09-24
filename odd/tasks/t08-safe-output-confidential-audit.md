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
   - Forecast: ≤ ~400 authored lines.

Indivisibility check: no honest unit forecasts above 600; no size exception required. STOP trigger remains if a unit grows past forecast during implementation (Atenea policy §6).

## Execution log

- U1: (pending)
- U2: (pending)
- U3: (pending)
- U4: (pending)
- Closeout: (pending)

## Commit evidence

(record per unit: commit sha, ASSESS outcome, review lineage/burn if due)
