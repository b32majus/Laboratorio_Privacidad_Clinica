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
- WU2a-i review-d4dda0995362d322: APPROVED, acknowledged + burned (consumed revision sha256:21677c4cbf851954397d286a05d46da0436d5abad285ba8b195afc775df8dfbc). No findings.
- WU2a-ii review-c9e6f359738cc727: APPROVED, acknowledged + burned (consumed revision sha256:349be48c4eaeb2e6ad3f91275020b91c0f665845528d24a7f2ae4fe75079ecd2). Advisory R3-stateful-pseudonymization (WARNING, legacy-operators.ts:94, informational — mirrors accepted legacy stateful pseudonymization).
- WU2b review-a2f1b5e978558b14: APPROVED, acknowledged + burned (consumed revision sha256:4cd34eeb4d36b38c81a7c9aa827d069443ef21c550535ae4522b6cc321117b8b). Advisory R3-001 (WARNING, policy.ts:231-241, informational).
- Lifecycle incident recorded: the first plain START adopted a retained workspace projection and created lineage review-e74c9bfd5a3eee8a over a fragment candidate (d.ts delta only, 96 lines). Human-authorized ABANDON (operator_disposition, zero discarded work, audit record committed) via the audited native CLI; candidate then rebuilt correctly with explicit baseRef+committedOnly START. Lesson: with uncommitted future-unit files present, plain START must never be used; always pin the committed range explicitly.

### Composition reslice evidence (WU3, before commits)

The WU3 writer produced a single candidate of 828 authored changed lines (registry-engine.ts 285 + test 509 + legacy-engine exports 17 + review-domain wiring ~26) — Atenea >800 STOP band. Recomposed BEFORE commit into three semantic seams:

- **WU3a — legacy-engine helper exports** (17 lines, export-only, zero behavior change; native ASSESS: medium, under_budget, review_due=false — no START required).
- **WU3b — registry-composed engine + parity/acceptance oracles** (`registry-engine.ts` 285 + `registry-engine.test.ts` 509 = 794 authored lines).
  - **Durable size-exception rationale (Atenea 601–800 band, recorded before review):** one coherent composition seam — the recognition→policy→operator pipeline, its preparation/reset responsibility, and the oracles that prove it (multi-category parity vs createLegacyEngine on the V4 path, acceptance-1 observation invariance under operator/policy choice, engine-level typed unknown-key failures, ProcessingContext round-trip, no-monkey-patch). The parity/acceptance oracles are inseparable from the composition they prove; a further split would mechanically separate tests from behavior.
  - Documented deviation: legacy `scoring.descartadas` sub-threshold detail is not reproduced (not derivable through the WU1 observation contract; no V4 consumer — from-processor.js reads only entities+sessionId). NEW DEBT: expose discarded/sub-threshold observations through the recognizer contract in a future unit.
- **WU3c — V4 path wiring** (review-domain.ts composition call + equivalent test call-shape, ~26 lines): switches the actual V4 review path to the composed engine; oracle = review-domain tests + full V4 suite.

### WU3 execution evidence (append-only)

- WU3a (export-only helpers, commit ec6e13c): native ASSESS medium/under_budget, review_due=false — no START.
- WU3b (registry-composed engine + oracles, commit a651902): lineage review-ca481631d9c01f72 (794 lines, medium, review-reliability). Lens finding R3-001 CRITICAL (inferential, "introduced": preprocessFechas receives raw observations without the legacy position shape); provider refuter INCONCLUSIVE (proof registry-engine.ts:234/:149); state correction_required, fix_finding_ids=[R3-001]. The bound correction transition then rendered a TERMINAL stop corrupted_or_unverifiable_authority in both facade and native CLI although `gentle-ai review inspect-authority` reports the store structurally valid with zero diagnostics — native controller runtime defect (same family as the T08 facade-decode defect). Human decision (2026-09-25): bounded correction authorized, frozen lineage PRESERVED untouched as historical evidence, no authority/store mutation, no review-mode disable. The lineage remains non-terminal correction_required and is NOT approved; its candidate was superseded by the corrective commit.
- Revalidation of R3-001 against real code: legacy Processor.preprocessFechas only READS type/subtype/text (never position, never mutates); WU3b deterministic parity was green — the finding is a contract/seam ambiguity, not demonstrated functional corruption.
- Corrective unit (commit c564e6d, 96 lines): explicit toLegacyPreparationEntity adapter feeding preprocessFechas the documented legacy shape; focused oracles: (1) boundary receives type/text/position with unchanged offsets — planted regression fails if raw observations are passed again; (2) date-containing parity vs createLegacyEngine stays byte-identical. Full V4 suite 297/297. Native review: lineage review-4ff4e586db53459b (medium, review-reliability) APPROVED, acknowledged + burned (consumed revision sha256:cb69952ac25ff69cc2f45ce9adaa3df3e092a1baab968904e6e18a7f8f944626). No findings.
- WU3c (V4 path wiring, commit 97e98c9, 17 lines): lineage review-cefa6aa795f293c0 (medium, review-reliability) APPROVED, acknowledged + burned (consumed revision sha256:ed312f11f68fabc3f38b633c5f3fafd9c123665480f8686bd32ea227c12eb59b). No findings. Full V4 suite 297/297.

NEW TRUTHFUL DEBT (recorded, not fixed here): legacy `scoring.descartadas` sub-threshold detail is not reproduced by the composed engine (not derivable through the WU1 observation contract; no V4 consumer — from-processor.js reads only entities+sessionId). Restoring it requires exposing discarded/sub-threshold observations through the recognizer contract in a future unit.

## T11 integration closeout (deterministic composed-state evidence, final HEAD)

Status: DONE (all four work units complete; local-only, nothing pushed).

- Final HEAD: ce1c2f7a2c8644f57e9b307950bebc8ce0ba02b3 (14 commits from START_HEAD 5fe45cbd460b6e2ee8125df8ed01af8526e455c4; origin/3.0-main is a clean ancestor).
- Composed-state verification (all green at final HEAD):
  - full `npm test` chain exit 0 (check:links, check:storage, check:external, check:vendor, check:pdfjs, check:smoke, check:positioning, test:domain 49/49, test:privacy-eval, check:privacy-eval gate passed:true with zero failures, test:v4 306/306);
  - `npm run build` exit 0 with clean tracked tree;
  - format:check:v4 / typecheck:v4 / lint:v4 green;
  - check:external:selftest and check:pdfjs:selftest green;
  - ground-truth privacy evaluator gate passed (accepted thresholds).
- Acceptance coverage: registry dispatch + planted-omission coverage oracle (WU1); operator dispatch + parity + planted-violation (WU2a); headless policy lookup with typed unmapped failures (WU2b); composed-engine parity + acceptance-1 invariance + engine-level unknown-key failures (WU3b/c); ARCH-011 coherence + planted contradictory-derivation rejection + requiresReview=true fail-closed regression (WU4); ProcessingContext round-trips (engine suites); legacy-engine parity suites.
- Debt disposition: ARCH-004 DONE, ARCH-011 DONE (docs/DEBT_REGISTER.md, commit ce1c2f7, evidence preserved). New truthful debt recorded: legacy `scoring.descartadas` detail not reproduced by the composed engine (future unit: expose discarded observations through the recognizer contract).
- Runtime defects recorded as evidence (not repaired here): (1) gentle-pi facade ASSESS decode rejects native 3.7.0 envelopes (T08 precedent, honored via read-only native CLI assess); (2) native controller renders terminal stop corrupted_or_unverifiable_authority instead of the correction transition for lineage review-ca481631d9c01f72 despite a structurally valid store (inspect-authority clean) — human-authorized corrective path taken with the frozen lineage preserved untouched.
- Publication boundary honored: no push, no PR, no issue mutation, no merge, no history rewrite of shared history. Merge remains human.

### Post-closeout review reminders — disposition record (append-only)

After T11 closeout, three stale writer notifications claimed an unreviewed candidate target (sha256:c9585c73… then sha256:2bfb2ebb…) for the already-committed WU4 content. Parent disposition, verified each time against the repository:

- The worktree is clean at HEAD 853c6d4; the WU4 content was committed as 1021520 and its committed-range candidate (target sha256:5d297b08…, base 87485d0) was natively APPROVED with acknowledge/burn consumed (revision sha256:b7273146…, lineage review-35a0367af1a60d01). No human decision left that content unreviewed; the receipts stand. Starting a new transaction for the same content would reuse burned authority — refused.
- A plain `gentle_review {"operation":"inspect"}` executed once for the reminder returned a DIFFERENT transition: a synthetic whole-repo base-diff candidate (132 files, +25,488/-447) against stale historical base b1c25e9c ("ui: widen hero photo framing on desktop", pre-V4-train main/backup history). Following it would create exactly the forbidden whole-branch candidate and violate the Work Order's "no synthetic whole-branch review candidate / no stale historical base refs" boundary. START was NOT executed; no authority was created or mutated. Recorded as runtime evidence of a stale/misprojected inspect route, not as a review defect of any accepted unit.

## PR #40 promotion audit — corrective phase (append-only, published HEAD 97eb778)

Authority: PR #40 independent promotion audit. Four bounded blockers; append-only corrections; no reset/amend/rebase/force-push/merge; no T12–T14 implementation; local-only.

Pre-writer composition forecast (resolved before writer mutation):

- **C1 (Job.policyId not consumed by the real review path) + C2 (policy can relabel an existing ReviewSession)** are naturally coupled: both are the same seam — "the policy that produced a ReviewSession must be the job's policy, exactly". One coherent corrective unit (policy binding + review-state validity), with its oracles. Surfaces: review-domain.ts (policy propagation), job.ts (setPolicy resets derived review/output state on a real change), useJobSession.ts (drops the now-invalid ReviewSession), App.tsx (typed PolicyError surfaced), plus review-domain/job/App tests. Forecast ≈ 180–260 authored lines — inside the normal band.
- **C3 (insecure randomness in the new T11 sessionId)** is a security micro-correction: single generation site + explicit unavailability failure + focused test. Separate executable candidate.
- **C4 (residual scoring.descartadas debt)** is documentation-only: new ARCH-012 OPEN entry owned by T14 #18; ARCH-004 stays DONE and points to ARCH-012 instead of embedding hidden residual debt.
- No unit forecasts above the 400 baseline; no size exception required.
