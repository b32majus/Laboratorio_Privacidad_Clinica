# T16 / #20 — Deterministic pseudonyms without gender inference

Status: IN PROGRESS
Work Order: GitHub #20 (`EXECUTION_READY=YES`; `Blocked by: #15` CLOSED; no comments; DEBT_IDS=PRODUCT-002)
Branch: `work/native/v4-travel-t12-t16-20260925`
START_HEAD: `0471f9caf5d34ec2893ee46dd48a95362ee9a089`

## Authority read for this ticket

- `AGENTS.md` (scope discipline, privacy invariants, testing/oracle rules, legacy-retirement rule), `CONTEXT.md`.
- GitHub #20 body. Scope: "Replace gender-inferred generic patient substitutions with distinct stable pseudonyms within the
  intended processing context." Acceptance: (1) two distinct source identities must not collapse to an identical generic
  replacement within one context; (2) the same source identity maps consistently within the intended context; (3) no gender
  inference is required for pseudonym generation; (4) mapping behavior is deterministic/testable for a context. Required
  deterministic tests: identity consistency/distinctness tests, no-gender-inference fixture. Out of scope: unrelated
  cleanup/refactors, product/privacy decisions not stated in the cited spec, auto-merge/force-push/history rewriting, real PHI
  in tests.
- `docs/specs/SPEC_V4_PRIVACY_ENGINE.md` §12 (Pseudonyms) — the authority for this ticket: *"Do not infer gender merely to
  generate privacy replacements."*; *"Target patient/entity pseudonyms are stable and distinct within intended context (e.g.
  Patient 1 / stable study token)."*; *"Cryptographic/HMAC study IDs are a later bounded capability, not required for the first
  engine refactor unless a ticket explicitly includes them."* Also §7 (ProcessingContext owns "deterministic/study pseudonym
  mapping"; cross-document consistency lives in an explicit context, never in mutable globals), §5 (PSEUDONYMIZE operator), §3,
  §13 (terminology: pseudonymization/preparation, never "anonymized").
- `docs/shaping/CURRENT_DECISIONS.md` D-003 (V4 mirrors legacy semantics), D-006 (copy discipline), D-007 (explicit policy
  profiles), D-009 (fail explicitly, never guess), D-011 (no mutable global monkey patches for cross-document state), D-013
  (sensitive content is memory-only).
- `docs/execution/QUALITY_EXECUTION_PROTOCOL_V1.md` §6 (closeout chain), `docs/execution/TRAIN_V4.md` T16 row: *"T16 / #20 —
  Deterministic pseudonym identifiers. Debt: PRODUCT-002. Result: distinct/stable pseudonyms without gender inference within
  intended context."*
- Debt: `docs/DEBT_REGISTER.md` PRODUCT-002 (P3, Identity): "Pseudónimos deterministas sin inferir género"; ARCH-013 (P2,
  Core/Engine) records that below-threshold candidates resolve `proposed` from document-local manager state and names T16 #20 as
  a candidate owner.
- Live code: `js/core/managers/AsignadorSustitutos.js` (the single generation authority: `obtenerSustituto` + `detectarGenero`),
  `js/core/processor.js:315-323` (legacy `transformEntity` NOMBRE branch), `app-v4/src/engine/legacy-operators.ts:100-125`
  (`LegacyPseudonymizeOperator`), `app-v4/src/engine/{types,legacy-engine,registry-engine}.ts` (the context contract and the
  composed pipeline), `app-v4/src/engine/legacy-modules.d.ts` (the module interface declaration).

## Measured baseline (real, reproducible — parent probe, 2026-09-26)

Bundled the composed engine with esbuild and ran three documents through one `shared` context:

| Input | Current output |
| --- | --- |
| `La paciente Carmen Sánchez acudió ayer a consulta.` | `La paciente Paciente Mujer acudió ayer a consulta.` |
| `El paciente Luis Pérez acudió hoy a consulta.` | `El paciente Paciente Hombre acudió hoy a consulta.` |
| `Carmen Sánchez volvió a consulta.` | `Paciente Mujer volvió a consulta.` |

Returned context after doc 2: `{"asignaciones":[["carmen sánchez","Paciente Mujer"],["luis pérez","Paciente Hombre"]],
"profesionales":[],"familiares":[],"contadorProfesionales":0,"contadorFamiliares":0}` — so the patient mapping is already
**context-owned and serializable** (`PseudonymState.asignaciones`), while the assigned **value** is the defect.

- Acceptance 1 FAILS: the replacement value has only two possible outcomes (`Paciente Mujer` / `Paciente Hombre`), so two
  distinct patients of the same inferred gender collapse to the *identical* replacement. The replacement also leaks an inferred
  gender, which is a privacy-relevant quasi-identifier.
- Acceptance 2 HOLDS today and must keep holding.
- Acceptance 3 FAILS: every patient replacement is produced by `AsignadorSustitutos.detectarGenero` (first-name suffix/list
  heuristic, default `M`).
- Acceptance 4 is only partially testable today: the map key is already the normalized source identity, so determinism exists
  but the value carries an inference.
- `detectarGenero` and the `Paciente Mujer/Hombre` literals are the ONLY gender-inference sites in the repository (grep-verified,
  excluding `dist/`). The gender-partitioned name dictionaries (`NOMBRES_MUJER`/`NOMBRES_HOMBRE`) are DETECTION input only: the
  detector consumes their union (`js/core/detectors/nombres.js:184-187`), so detection performs no gender inference.

## What already holds (do not re-implement)

- `PseudonymState` is a plain, frozen, JSON-serializable context contract (SPEC §7, D-011) and already carries the patient map
  plus the professional/family counters; `snapshotModulePseudonymState`, `freezePseudonymState`, `assertPseudonymStateShape` and
  `reconcileSharedContext` already implement the shared-context seam.
- `reconcileCategory` already implements the exact-key reuse + counter-for-new-key semantics for `profesionales` and
  `familiares` (including the legacy alias oracle for professionals). The patient category is the one category that currently
  passes `nextForNew: () => null` — it keeps the document-local value because that value used to be a constant.
- The composed engine resolves the returned context BEFORE the candidate pass (T14 #18 WU-A state isolation) and both V4 engines
  share the same module-level generation authority, so any correction at that authority reaches every surface at once.

## Gaps this ticket must close (honest reading of the acceptance bullets)

1. The patient replacement is produced by a gender heuristic and has only two values → acceptance 1 and 3 fail.
2. Because the patient value was a constant, the shared-context seam never needed to number patients; once values become
   identity-specific, the patient category MUST generate from the context counter (as the other two categories do) or two
   different patients in two different documents would both receive `Paciente 1`.
3. The `PseudonymState` contract has no patient counter, so the context cannot express "how many patient identities this context
   has already seen" — required for stable distinct numbering across documents.
4. Existing oracles encode the defective values (`legacy-engine.test.ts:146-147,365`, `registry-engine.test.ts:239-240,448`, and
   the module-state snapshot helpers) and the module's public shape declaration omits any patient counter.

## Semantic decisions (resolved before writing)

- **SD-1 — Authority.** SPEC §12 + #20 acceptance govern. This ticket delivers distinct, stable, gender-free patient pseudonyms
  within the intended processing context. Cryptography/HMAC study tokens are explicitly NOT delivered (SPEC §12: later bounded
  capability, not required unless a ticket includes them; #20 does not).
- **SD-2 — Fix at the single generation authority, not in a V4-only parallel mapping.** The defect lives in
  `js/core/managers/AsignadorSustitutos.js`, the module both V4 engines and the legacy page already share through the accepted
  adapter boundary. Correcting it there (a) fixes the product defect on every surface that can produce it — which is what
  PRODUCT-002 actually names — and (b) keeps V4↔legacy structural parity (both engines consume the same authority, so the two
  existing parity oracles keep their exact meaning). A V4-only patch would leave the legacy surface leaking gender AND would have
  to duplicate the map/counter machinery that already exists in the module. This is therefore the first deliberate correction of
  a legacy transformation VALUE: D-003 parity is preserved as "V4 mirrors the brownfield core", not as "V4 mirrors the historical
  gender behavior", and the divergence is recorded explicitly here rather than left implicit. The legacy module is corrected, not
  retired or rewritten (legacy retirement remains T25 #29).
- **SD-3 — Value shape.** `Paciente <n>`, where `n` is the 1-based index of the first appearance of that source identity within
  the intended processing context. No gender, no name fragment, no hash, no cryptographic token. The token follows the accepted
  local convention already used by the sibling categories (`Profesional Sanitario N`, `Familiar N`), and no copy anywhere claims
  anonymity (D-006/§13).
- **SD-4 — Distinctness and stability.** Key = the module's existing normalization (`nombreOriginal.toLowerCase().trim()`),
  unchanged, so no new key semantics are invented and cross-document identity stability is preserved. Distinct identities get
  distinct values even when their inferred genders coincide; the same identity keeps its value across documents of a shared
  context. Numbering is per intended context: `fresh` = the single document; `shared` = the batch context, continuing instead of
  restarting (the same rule the other two categories already follow).
- **SD-5 — Scope of determinism (do NOT overclaim).** Determinism means: for a given document order and a given context, the
  mapping is a pure function of the source identities. It does NOT mean a global identity token that is stable across unrelated
  contexts or runs — that is the HMAC/study-identifier capability explicitly out of scope (SD-1). The oracles and the debt
  disposition must state exactly this and no more.
- **SD-6 — The explicit `genero` argument is accepted and ignored.** `obtenerSustituto(nombreOriginal, genero = null)` keeps its
  two-argument signature for legacy call compatibility (`js/batch-module.js` forwards it; the ambient declaration in
  `legacy-modules.d.ts` declares it), but replacement generation must not depend on gender, whether inferred or supplied. Pinned
  by an oracle.
- **SD-7 — `detectarGenero` is retained but never consulted for generation.** Deleting it is unrelated cleanup (explicitly out of
  scope) and removing a public legacy API method is a legacy-retirement concern. The generation path must provably not call it
  (instrumented oracle). The gender-partitioned dictionaries stay detection input only.
- **SD-8 — Serializable contract extension.** `PseudonymState` gains a REQUIRED `contadorPacientes` (mirroring
  `contadorProfesionales`/`contadorFamiliares`), validated fail-closed in `assertPseudonymStateShape`, preserved by
  `freezePseudonymState`, JSON round-trip intact. There are no consumers of `PseudonymState` outside the engine module graph
  (grep-verified), so this is an internal contract extension; a context missing the counter is an invalid shape and must fail
  typed (D-009) rather than silently default.
- **SD-9 — Order and isolation are unchanged; ARCH-013 is NOT closed here.** The composed engine still resolves the returned
  context before the candidate pass, so a below-threshold `NOMBRE` candidate's advisory `proposed` remains document-local. T16
  does not re-seed the module maps from the reconciled context: that would expand the ticket into the reconciliation seam beyond
  #20's acceptance. The ARCH-013 row is updated only to record the new (local-index) consequence and stays OPEN.
- **SD-10 — No UI/domain change is required or added.** The review and domain surfaces consume `entity.transformed`; distinctness
  and stability are engine/context-level properties. No new UI doctrine, no copy change, no new user-facing surface.
- **SD-11 — Out of scope, explicitly.** HMAC/study tokens; batch correspondence-table redesign (T17); structured CSV/XLSX patient
  identity authority (T18); legacy retirement (T25); detection changes; unrelated cleanup.

## Composition forecast (Atenea WORK_UNIT_COMPOSITION_POLICY_V1)

Surfaces touched: the legacy generation authority (JS), the context contract (TS types + validation + reconciliation), the V4
engine declarations, and five existing test files whose fixtures encode the defective value, plus new oracles. The correction
cannot be split into "module only" and "context only": changing the value to an identity index without the context counter would
make two different patients in two documents of a shared batch both receive `Paciente 1`, i.e. a REGRESSION of acceptance 2 — so
the authority change and the context plumbing are one indivisible unit.

- **WU-A — Patient pseudonym authority and context numbering (indivisible unit).** The module produces identity-keyed
  `Paciente N` without gender inference; `PseudonymState` carries `contadorPacientes`; the shared-context seam generates patient
  values from the context counter instead of keeping the document-local value; the module/context oracles (distinctness,
  stability, no-gender pin, explicit-`genero` irrelevance, fail-closed shape, JSON round-trip). Existing fixtures that encode
  `Paciente Mujer/Hombre` are updated.
- **WU-B — Composed-engine and product-surface integration.** End-to-end oracles through the composed registry engine (fresh and
  shared, multi-document batch, same-gender distinctness, cross-document stability), the operator/policy path regression for the
  other two NOMBRE subtypes, candidate/state-isolation regression (the T14 acceptance-3 property must still hold with patients
  numbering), and the direct legacy `Processor.process` surface (the product claim must hold on both engines).

Each unit keeps its behavior with the oracles that prove it, is independently verifiable, and stays inside the normal ≤400
authored-line budget. Forecast: no over-budget risk, no size exception required.

## Invariants for this ticket

- No real PHI: synthetic fixtures only.
- No new dependency, no network, no storage, no logging of content.
- Non-overlapping behavior: professional, familiar, date, location, identifier and age transformations must be byte-unchanged.
- `PseudonymState` remains plain, frozen and JSON-serializable; the context is never mutated in place.
- Fail closed on invalid context shape (typed `invalid-context`), never a silent default.
- Every behavioural change is pinned by an oracle that can disagree with it (including a negative/adversarial case), and the
  no-gender property is pinned by an instrumented oracle rather than by prose.
