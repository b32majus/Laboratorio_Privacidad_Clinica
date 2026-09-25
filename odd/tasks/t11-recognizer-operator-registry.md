# Feature: T11 #15 — Recognizer and Operator registry boundary

Status: IN PROGRESS
Work Order: GitHub #15 (EXECUTION_READY=YES; blockers #6, #9 CLOSED)
Branch: work/native/v4-t11-20260925
START_HEAD: 5fe45cbd460b6e2ee8125df8ed01af8526e455c4
BASE_BRANCH: 3.0-main
Session: fresh Pi session (v4-t11-20260925-fresh); no historical state reused.

## Authority reconciled (pre-writer)

- AGENTS.md (read-first order, V4 invariants, privacy invariants, composition gate).
- GitHub #15 full body incl. 2026-09-25 execution-readiness hardening; GitHub #5 frontier/map (T11 sole prepared Work Order, max_concurrency=1, native Gentle owns decomposition/review).
- docs/execution/QUALITY_EXECUTION_PROTOCOL_V1.md (§4 composition forecast, §5 per-work-unit, §6 closeout, §7 micro-corrections).
- docs/shaping/CURRENT_DECISIONS.md (D-003 incremental adapters, D-004 ReviewSession authority, D-007 policy vocabulary, D-009 fail-closed, D-010 dates/AGE out of T11 scope).
- docs/specs/SPEC_V4_PRIVACY_ENGINE.md (§2 target boundaries, §3 Detection contract, §4 recognizers answer "what is this?", §5 operators, §6 policy lookup headless).
- docs/execution/TRAIN_V4.md Train C (T11 result: detection separated from transformation; legacy behavior adapted).
- docs/DEBT_REGISTER.md ARCH-004 (Separar Recognizers de Operators/Policies) and ARCH-011 (requiresReview=false mapping vs trace contradiction, P2, reconciliation owned here; not reachable through current V4 adapter defaults).
- Atenea WORK_UNIT_COMPOSITION_POLICY_V1 (/srv/kairos-lab/Atenea/docs): 400 authored-lines planning baseline; 401–600 soft overage; 601–800 exception band; >800 STOP.
- Code seams read: app-v4/src/engine/types.ts, legacy-engine.ts (+501-line parity test), js/domain/from-processor.js, js/domain/review-session.js (T01 authority: getDecision/getPendingDetections/canFinalize/getProgress), app-v4/src/output/confidential-audit.ts (buildEntry derives status from implicit decision; trace from getProgress), confidential-audit-serializer.ts (prints entry.status factually), js/core/processor.js (detectEntities → resolveConflicts → scoring → heuristics → threshold → preprocessFechas → transformEntity switch), app-v4/src/review/review-domain.ts, app-v4/src/domain/job.ts (PrivacyPolicyId vocabulary), scripts/privacy-eval (ENTITY_TYPES ground-truth taxonomy).

## Runtime preflight

- Branch work/native/v4-t11-20260925 at exact START_HEAD 5fe45cb; clean tracked tree.
- Pi 0.87.1 / Gentle AI 3.7.0 / GENTLE_PI_NO_SKILL_REGISTRY=1 (per #15 prepared preflight; runtime consumed as-is, no routing/profile changes).

## Pre-writer composition forecast (RESOLVED — recorded before first writer mutation)

Project-side hypothesis seams A–D were reconciled against the real code. Confirmations and adjustments:

- The legacy engine mixes recognition and transformation inside `Processor.process`: detection+scoring pipeline (js/core/detectors + ScoringEngine + HeuristicasContextuales + resolveConflicts + threshold) answers "what is this?"; `preprocessFechas` + `transformEntity` (hard-coded per-type switch over AsignadorSustitutos/FechasManager/UbicacionesManager + modoEstricto) answers "what transformation applies?". ARCH-004 is materially closable only if the V4 engine path composes recognition and transformation through explicit registries — dead contracts are not material implementation.
- ARCH-011's actual contradiction is located: confidential-audit `buildEntry` derives entry status from the implicit decision (`getDecision` → "pending") for ALL detections, while `trace.pending`/`canFinalize` derive from `getPendingDetections` (requiresReview && undecided). A synthetic requiresReview=false undecided detection therefore renders mapping status "pending" with trace.pending=0/canFinalize=true. Coherence must be established at the domain/policy authority so downstream surfaces consume it.
- Policy lookup: only legacy `modoEstricto` (non-strict vs strict) has accepted transformation-mapping authority today. `external-ai` and `longitudinal-research` have NO accepted per-category operator mapping (D-007 defers exact mappings to implementation tickets; T12/T13 own AGE/date semantics). Honest resolution: policy lookup handles known policy IDs explicitly and fails typed for UNMAPPED policies instead of guessing — no invented semantics.

Resolved semantic work-unit chain (each unit carries implementation WITH its proving oracle; no test-only units; no mechanical slicing):

1. **WU1 — Recognizer registry boundary + legacy coverage oracle** (`app-v4/src/engine/recognizer-registry.ts` + `recognizer-registry.test.ts`)
   - Recognition contracts: normalized observation (type/subtype/offsets/original/confidence — NO operator choice, NO transformed value), `Recognizer` + `RecognizerRegistry` with typed `unknown-recognizer` failure (D-009).
   - `LegacyRecognizerAdapter` wrapping the legacy detection pipeline (detectors + resolveConflicts + scoring + heuristics + threshold) so every legacy category (NOMBRE, IDENTIFICADOR, FECHA, UBICACION, SOSPECHOSO) stays represented without rewrite (D-003).
   - Coverage oracle: registry keys must cover the legacy/ground-truth category taxonomy; planted-omission test proves the oracle can fail (protocol §3.5).
   - Forecast: ~300 authored lines.
2. **WU2 — Operator registry + headless policy lookup** (`app-v4/src/engine/operator-registry.ts`, `app-v4/src/engine/policy.ts` + tests)
   - Operator contract (observation + context → replacement) and operators mirroring accepted legacy semantics (pseudonymize/redact/generalize/date-transform per current transformEntity; modoEstricto profile); unknown operator key → typed failure; no silent transformation fallback.
   - Policy lookup headless/pure: known policy IDs → explicit profile; unmapped policy IDs (external-ai, longitudinal-research) → typed unmapped failure, never a guessed transformation.
   - Forecast: ~350 authored lines.
3. **WU3 — Registry-composed engine + legacy parity** (`app-v4/src/engine/` composition + wiring + tests)
   - The V4 engine composes recognizer registry → policy lookup → operator dispatch, producing the legacy-shaped result; transformation chosen by policy/operators, recognition unchanged.
   - Parity oracle: bit-identical entities/processed text vs legacy direct call on the existing fixture set (existing legacy-engine.test.ts oracle extended); ProcessingContext serialization semantics preserved; no monkey patch; acceptance 1 (operator/policy choice does not change recognizer observations); unknown keys fail explicitly through the engine path.
   - Forecast: ~350 authored lines (composition-heavy; most new code already landed in WU1/WU2).
4. **WU4 — ARCH-011 optional-review semantics coherence** (`js/domain/review-session.js`, `app-v4/src/output/confidential-audit.ts`, serializer + tests; ambient d.ts if needed)
   - Single-source decision-status authority: mapping entry status and aggregate pending/canFinalize derived from the same predicate — for any session, mapping pending count == trace.pending and canFinalize ⇔ no pending entries (deterministic invariant oracle).
   - requiresReview=false undecided detection gets an explicit factual non-pending status (NOT "accepted", NOT "pending"); requiresReview=true stays fail-closed until explicit decision; T05/T06 default requiresReview=true behaviorally stable; Confidential Audit reports the resulting state factually.
   - Forecast: ~300 authored lines.

Indivisibility check: no honest unit forecasts above 400; no size exception required. STOP trigger remains if a unit grows past forecast during implementation (policy §6).

Out of scope (guarded): T12 AGE behavior, T13 date semantics/DATE_SHIFT policy, T14–T17, structured files, UI redesign, legacy rewrite, T07/T08 surface redesign.

### Composition reslice evidence (WU1, before first commit)

The WU1 writer produced a single candidate of 871 authored changed lines (recognizer-registry.ts 420 + test 356 + legacy-modules.d.ts 95) — inside the Atenea >800 STOP band. Per policy §6/§7 the candidate was recomposed BEFORE any commit along the semantic seam already named in the original hypothesis (registry/contracts vs legacy brownfield adaptation), with zero behavior change (51 focused tests green after split):

- **WU1a — Recognizer registry contracts + coverage oracle** (`recognizer-registry.ts` 163 + `recognizer-registry.test.ts` 112 = 275 authored lines). Pure contracts/registry surface, no js/* imports; unknown-key/duplicate/malformed fail-closed; taxonomy + planted-omission coverage oracle primitive.
- **WU1b — Legacy recognizer adaptation + detection parity oracle** (`legacy-recognizers.ts` 286 + `legacy-recognizers.test.ts` 292 + `legacy-modules.d.ts` 96 ambient declarations = 674 authored lines).
  - **Durable size-exception rationale (Atenea 601–800 band, recorded before review):** this unit is one coherent brownfield adaptation seam — the wrapped legacy detection pipeline, its ambient declarations for js/core imports, and the oracles that prove it (bit-level parity vs Processor.process, transformation-manager purity, per-category coverage). The parity/purity oracles are inseparable from the adaptation they prove (implementation stays with its tests); the ambient declarations exist only because the adapter imports js/core; a further split would mechanically separate tests from behavior. No product redesign occurred during the reslice; total grew +78 lines from structural header/import duplication only.

Publication boundary: local-only; no push/PR/merge/issue mutation.

### Composition reslice evidence (WU2a, before first commit)

The WU2a writer produced a single candidate of ~854 authored changed lines (operator-registry.ts 354 + test 495 + d.ts 6) — Atenea >800 STOP band. Recomposed BEFORE any commit along the same semantic seam as WU1 (pure registry/contracts vs legacy brownfield operator adaptation), zero behavior change (70/70 engine tests green after split):

- **WU2a-i — Operator registry contracts + KEEP identity** (`operator-registry.ts` 213 + `operator-registry.test.ts` 170 = 383 authored lines). Pure contracts/registry, no js/* imports; unknown-operator/duplicate/malformed fail-closed; pure KEEP representative cases.
- **WU2a-ii — Legacy operator adaptation + parity oracles** (`legacy-operators.ts` 198 + `legacy-operators.test.ts` 432 + d.ts 8 comment lines = 638 authored lines).
  - **Durable size-exception rationale (Atenea 601–800 band, recorded before review):** one coherent brownfield adaptation seam — the four legacy-mirroring operators (REDACT/PSEUDONYMIZE/DATE_TRANSFORM/GENERALIZE), the composer, and the oracles that prove them (per-category parity vs Processor.transformEntity in both modoEstricto profiles, seeded-state purity, planted-violation self-test). The parity/purity oracles are inseparable from the adaptation they prove; a further split would mechanically separate tests from behavior. Reslice grew the total +167 lines (structural header/import duplication + 3 additive pure-contract tests) — same structural cost as the WU1 reslice.

WU2 review lineages (per-unit, base-diff committed ranges):
- WU1a review-340ad1f7f83a7b0e: APPROVED, acknowledged + burned (consumed revision sha256:bc27632e5b54dc5f5587804a42bac939313a372a4b4af042d3721751c2c0d1cb). Advisory R3-001 (WARNING, recognizer-registry.ts:124-130, informational).
- WU1b review-970e0ac663819613: APPROVED, acknowledged + burned (consumed revision sha256:abf53a6938d3afaccca2eb73732566007cbbd3451a01e98e2fa0bc36b74553bc). Advisory R3-001 (SUGGESTION, legacy-recognizers.ts:260, informational).
- Lifecycle incident recorded: the first plain START adopted a retained workspace projection and created lineage review-e74c9bfd5a3eee8a over a fragment candidate (d.ts delta only, 96 lines). Human-authorized ABANDON (operator_disposition, zero discarded work, audit record committed) via the audited native CLI; candidate then rebuilt correctly with explicit baseRef+committedOnly START. Lesson: with uncommitted future-unit files present, plain START must never be used; always pin the committed range explicitly.
