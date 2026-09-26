# T16 / #20 — Deterministic pseudonyms without gender inference

Status: COMPLETE (T16 #20)
Final commits: WU-A `8266992`, WU-B `81811e2`, plus the ticket-open commit `bb3130d` and this evidence/closeout commit. Ticket range `0471f9c..81811e2` = 3 commits, 13 files, +805/−21. Ticket integration: `npm test` full chain PASS at the ticket HEAD (vitest 34 files / 613 tests, Node domain suite 55/55, privacy-eval 24/24 + gate PASS, CI checks PASS); `format:check:v4` / `typecheck:v4` / `lint:v4` / `build` PASS. Native review ledger: both per-unit committed-range ASSESS calls returned the known typed Gentle AI #4791 `unassessable`/`schema-incompatible` plan, so the Case C fail-closed path applied twice with writer self-verification plus an independent verifier per unit; no `review_due` was ever offered, no START was synthesized, no consent manufactured and zero lineages opened. Debt: PRODUCT-002 reconciled to DONE with its limits declared; ARCH-013 updated (still OPEN, T16 deliberately did not close it); DOC-001 annotated with the newly stale historical sample. No T17 work started.
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

**Forecast correction (after WU-A):** the forecast said five existing test files would need updating; in the event only four
did (`legacy-engine.test.ts`, `registry-engine.test.ts`, `legacy-operators.test.ts`, `legacy-recognizers.test.ts`) —
`low-confidence-candidates.test.ts` needed no edit because it contains no `PseudonymState` literal. Recorded rather than
silently dropped.

## WU-A evidence — 2026-09-26

- Commit: `8266992` (base: `bb3130d`). Authored size: **10 files** — 9 modified (43 insertions / 15 deletions) plus the new
  oracle file (220 lines) = **+263/−15**.
- Delivered: the patient branch of `AsignadorSustitutos.obtenerSustituto` returns `Paciente <n>` from a new module
  `contadorPacientes` instead of `genero || detectarGenero(...)` + the two gender literals; the key normalization and the
  mapped-identity lookup are untouched; the `genero` parameter is retained for legacy call compatibility and deliberately
  ignored; `detectarGenero` is retained (legacy API) with its JSDoc updated and is no longer consulted. `PseudonymState`
  gains a REQUIRED `contadorPacientes`, validated fail-closed like the other two counters, threaded through
  `EMPTY_PSEUDONYM_STATE` / `snapshotModulePseudonymState` / `freezePseudonymState`, and consumed by
  `reconcileSharedContext`'s patient `nextForNew` so the patient category generates from the context counter exactly like
  the professional/family categories. `reconcileCategory` itself is untouched; `legacy-operators.ts` changed only in its doc
  comment; no other production behavior changed.
- Deterministic verification (worker first pass): `npm run test:v4` PASS — **33 files / 607 tests** (baseline 32/597);
  `npm run test:domain` 55/55; `npm run check:privacy-eval` PASS (precision 100 %, recall 100 %, FNR 0.00 %);
  `typecheck:v4`, `lint:v4`, `format:check:v4` PASS.
- Independent verification (`gentle-ai-verify`, read-only): **11/11 items PASS, zero blockers.** It confirmed the production
  diff matches SD-3/SD-4/SD-6/SD-7/SD-8, verified that non-patient paths are byte-unchanged, verified that
  `detectarGenero` now has NO production caller anywhere, verified there is no duplicate patient-mapping implementation
  (legacy page path, batch patch and both V4 engines all resolve through the same module), verified the edited existing
  oracles were STRENGTHENED (from `toBeTruthy()`/relational to exact `Paciente 1` pins) and none weakened, and reproduced the
  byte-integrity check on the mixed-EOL legacy file (203 CRLF + 10 LF before, 211 CRLF + 10 LF after; the 10 LF-only lines
  unchanged; every non-intended line byte-identical including its line ending). It also flagged, honestly, one minor oracle
  weakness (the first three assertions of the explicit-`genero` test are confounded by the map cache; the per-context loop in
  the same test is the discriminator) and three documentation-level findings (below).
- Parent falsification probes (each restored byte-exactly, sha256-verified):
  - **P1** the gender inference restored in the authority → **`1 file failed | 6 tests failed | 81 passed`**, including the
    distinctness, instrumented no-gender, explicit-`genero` and single-document distinctness oracles;
  - **P4** the map-hit path advances the counter → **`1 failed | 86 passed`**, failing exactly the stability oracle;
  - **P2** the shared-context patient generator stops incrementing → **`3 files failed | 6 failed | 81 passed`**, including the
    cross-document next-index oracles (the predicted collision regression);
  - **P3** the new counter is no longer validated → **`1 failed | 86 passed`**, failing exactly the fail-closed shape oracle.
- Process incident recorded: a parent probe restored the mixed-EOL legacy file with Python text-mode I/O, which silently
  normalized CRLF to LF (universal-newline translation on read). Detected by `sha256sum -c`, repaired from the binary backup,
  and the intended-only diff was re-proved by a line-set comparison. Lesson: use byte-safe copies for backup/restore on
  mixed-EOL files (the same class of trap a worker hit while editing `README.md`).
- WU-A native review gate: exact committed-range ASSESS (`{"baseRef":"bb3130d0…","committedOnly":true}`) returned the typed
  Gentle AI **#4791** envelope (`risk=unassessable`, `reasons=[schema-incompatible]`, `changedPaths=0`, `changedLines=0`,
  `candidate=null`, `nativeReviewOutcome=unknown`, `writerProfile=small`, plan `{writerSelfVerification, independentVerifier}`).
  Disposition: **Case C** — both gates satisfied, `ASSESS_SEAM_4791` recorded, **native START synthesized=no**, zero lineages,
  zero consents, no valid `review_due`, no #4791 retry, no `inspect`-as-ASSESS.
- WU-A documentation findings accepted for closeout: (i) `README.md` still documented the removed gender-derived replacement
  (fixed in WU-B); (ii) `ESPECIFICACION_TECNICA.md` is a historical artifact whose sample already diverged from the shipped
  core and now also contradicts SPEC §12 (not edited; annotated on the DOC-001 row instead, because it is not a live
  authority); (iii) the debt rows this ticket owns were pending closeout (done here).

## WU-B evidence — 2026-09-26

- Commit: `81811e2` (base: `8266992`). Authored size: **2 files** — `README.md` (1 insertion / 1 deletion) plus the new
  composition oracle (369 lines) = **+370/−1**. No production behavior changed.
- Delivered: `patient-pseudonym-composition.test.ts` (6 oracles) proves at the composed registry engine that two distinct
  same-inferred-gender patients in one document produce two distinct `Paciente N` values (exact composed text, exact entities
  and exact context, with distinctness, token shape and the absence of any gender word or source-name fragment asserted
  independently of the pins); that a shared batch keeps the returning patient at `Paciente 1` while the new identity takes the
  NEXT context index (a genuine fresh→final swap case: the fresh pass numbers the new identity 1 and the returning identity 2,
  and the reconciliation rewrites both correctly); that the same document processed twice in `fresh` mode is byte-identical;
  that the professional/familiar branches keep their accepted legacy values in the same run; that the direct legacy product
  path (`PrivacyProcessor.process`, the module the legacy HTML pages load) produces the same distinct values, so PRODUCT-002 is
  fixed on the legacy surface too; and that a below-threshold `NOMBRE`/`paciente` candidate grows the module counter (1 → 2)
  while the returned kept result, stats and context stay deep-equal to the candidate-free control run (T14 acceptance 3, now
  pinned for the patient counter). The accepted back-to-front numbering property is pinned explicitly instead of assuming
  reading order. `README.md`'s v3.0 table cell no longer claims the removed gender-derived replacement.
- Deterministic verification (worker first pass): `npm run test:v4` PASS — **34 files / 613 tests** (WU-A baseline 33/607);
  `npm test` full chain PASS; `typecheck:v4`, `lint:v4`, `format:check:v4` PASS.
- Independent verification (`gentle-ai-verify`, read-only): **11/11 items PASS, zero blockers.** It confirmed WU-B changed no
  production file, verified the README byte integrity independently (224 lines both sides, 60 CRLF lines both sides, exactly
  one changed line, no EOL normalization), confirmed every `processed` assertion is a full-string pin with independent
  property assertions alongside (including the ordering property), confirmed the direct-legacy oracle really exercises the
  module the legacy pages load and that its jsdom `window` side effect is deterministic and idempotent, confirmed the
  isolation oracle proves BOTH halves, and confirmed no existing test was edited. Honest falsifiability judgement: the
  "no gender word / no name fragment" assertions are redundant-but-harmless given the exact pins (kept as diagnostics), and
  the file intentionally does not cover within-document identity re-hits or case-normalization on the composed path because
  WU-A's `patient-pseudonyms.test.ts` does.
- Parent falsification probes (each restored byte-exactly, sha256-verified):
  - **P5** the patient reconciliation reverted to keeping the document-local value → **`2 files failed | 5 failed | 108 passed`**,
    including the WU-B shared-batch next-index oracle and four WU-A engine oracles;
  - **P6** the returned context re-resolved AFTER the candidate pass (the exact ordering T14 acceptance 3 forbids) →
    **`3 files failed | 5 failed | 108 passed`**, including the new patient isolation oracle **and** T14's two
    professional isolation oracles plus the shared-mode parity oracle — proving the new oracle is as discriminating as the
    accepted T14 ones.
- WU-B native review gate: exact committed-range ASSESS (`{"baseRef":"82669928…","committedOnly":true}`) returned the same
  typed **#4791** envelope → **Case C**, both gates satisfied, `ASSESS_SEAM_4791`, **native START synthesized=no**, zero
  lineages, zero consents, no valid `review_due`, no #4791 retry.

## T16 ticket closeout — 2026-09-26

- Work-unit chain terminal: ticket open `bb3130d`, WU-A `8266992`, WU-B `81811e2`, then this evidence/closeout commit.
- Ticket-level deterministic checks: `npm test` full chain (links, storage, external, vendor, pdfjs, smoke, positioning,
  Node domain suite, privacy-eval units + gate, vitest), plus `format:check:v4`, `typecheck:v4`, `lint:v4` and `build`; the
  final closeout run at the closeout HEAD is recorded in the boundary record.
- Every review decision resolved: two valid committed-range ASSESS calls (one per work unit), both returning the known typed
  #4791 plan → Case C; zero valid `review_due`; zero native lineages; zero consents; the whole-workspace inspect candidate was
  never started, and `inspect` was never used as a substitute for ASSESS.
- Every #4791 case independently verified: WU-A (11 audited items + four parent probes), WU-B (11 audited items + two parent
  probes).
- Acceptance mapping: #20 bullet 1 (two distinct identities do not collapse within one context) → WU-A module/engine oracles
  + WU-B composed and legacy-surface oracles; bullet 2 (same identity consistent within the context) → stability oracle,
  shared-batch oracle, both updated cross-document oracles; bullet 3 (no gender inference required) → the instrumented
  `detectarGenero` oracle, the explicit-`genero` irrelevance oracle and the exact `Paciente N` pins; bullet 4 (deterministic
  and testable for a context) → fresh-mode restart oracle, cross-document counter oracle and the byte-identical re-run oracle.
  Required deterministic tests: identity consistency/distinctness (four module oracles + three engine oracles) and the
  no-gender-inference fixture (instrumented oracle).
- Debt reconciliation limited to this ticket's rows plus the evidence it created: **PRODUCT-002 → DONE** with its limits
  declared (per-context numbering that depends on document order; no cross-context token; `detectarGenero` retained but never
  consulted; gender-partitioned dictionaries remain detection input only); **ARCH-013 stays OPEN** with the T16 consequence
  recorded (a patient candidate now proposes a document-local `Paciente N` index) and the explicit statement that T16 did not
  close it; **DOC-001 annotated** (not closed) with the newly stale historical sample. No other row was touched.
- No active worker, verifier, reviewer, refuter, validator or correction lineage at closeout; tracked tree clean; no T17 work
  started; no auto-merge, push or history rewrite performed.

## Invariants for this ticket

- No real PHI: synthetic fixtures only.
- No new dependency, no network, no storage, no logging of content.
- Non-overlapping behavior: professional, familiar, date, location, identifier and age transformations must be byte-unchanged.
- `PseudonymState` remains plain, frozen and JSON-serializable; the context is never mutated in place.
- Fail closed on invalid context shape (typed `invalid-context`), never a silent default.
- Every behavioural change is pinned by an oracle that can disagree with it (including a negative/adversarial case), and the
  no-gender property is pinned by an instrumented oracle rather than by prose.
