# REC-01 — SPANISH-ENGINE-ASSURANCE-01 — C-084 execution handoff

Status: **EXECUTION_READY**
Date: 2026-10-04
Recovery Work Order: **REC-01 — SPANISH-ENGINE-ASSURANCE-01**
Profile: **complex**
Matt entry: **`/implement-spec`**
Publication boundary: **LOCAL_ONLY**

## Fixed execution identity

- Repository: `b32majus/Laboratorio_Privacidad_Clinica`
- Canonical product base: `3.0-main@922e6d42e5d6c47a26e114b0b6d704e4a6ff3d83`
- Execution branch: `work/rec-01-spanish-engine-assurance-20261004`
- Execution worktree: `/srv/kairos-lab/qualification/laboratorio-rec01-spanish-engine-assurance-20261004`
- Recovery authority: `docs/START_HERE.md` → `docs/RECOVERY_MASTER_PLAN_2026-10.md` → traceability matrix/audits
- External adversarial audit: `docs/audits/2026-10-recovery-plan-external-adversarial-audit-sol61.md` independently assessed REC-01 as PASS / first work order.
- C-084 lifecycle: the selected primary coordinator owns `/implement-spec`, task graph, exactly one canonical final Standards+Spec review and correction dispatch. Implementation workers own implementation/TDD only and never review/correct their own candidate.

If branch, base, worktree or authority has drifted before implementation begins: **HUMAN STOP**.

No GitHub issue has been created because issue creation is a remote mutation under the repository/human publication boundary. For this local execution, this file plus the canonical REC-01 section of the Recovery Master Plan is the human-accepted spec/Work Order envelope. Do not create or mutate a GitHub issue from OpenCode; publication/remote mutation remains human-owned.

## Read first — bounded authority set

Read only what REC-01 needs, in this order:

1. `AGENTS.md`
2. `docs/START_HERE.md`
3. `docs/RECOVERY_MASTER_PLAN_2026-10.md` — REC-01 section only, plus dependency/closeout doctrine as needed
4. `docs/audits/2026-10-recovery-traceability-matrix.md` — `FUNC-003`, `QA-001`, `H-40`
5. `docs/audits/2026-10-recovery-traceability-audit.md` — Spanish-engine assurance findings
6. `docs/audits/2026-10-recovery-plan-external-adversarial-audit-sol61.md` — independently verified engine/corpus claims and residual uncertainty
7. `CONTEXT.md`
8. `CODING_STANDARDS.md`
9. `docs/ATENEA_EXECUTION_ROUTING_V0.md`
10. `docs/specs/SPEC_V4_PRIVACY_ENGINE.md` only where recognition/operator separation, category taxonomy or fail-closed semantics govern the change
11. current productive path and assurance code listed below.

Historical T01–T25 execution docs are provenance only. Do not use them as current routing/workflow authority.

## Why REC-01 exists

The productive application still runs the Spain-oriented registry-composed privacy engine. Production reaches `createRegistryEngine()`, which wraps the existing Spanish detector/scoring/heuristics/dictionary pipeline and adds the V4 AGE recognizer. The engine was not replaced with an English recognizer.

The assurance gap is real: the current committed V4 corpus is intentionally a regression gate, not a quality grade. At this fixed point it contains:

- 11 `core` cases + 3 `adversarial` cases;
- core annotations: EDAD 13, IDENTIFICADOR 4, and only 1 each for NOMBRE, FECHA, UBICACION and SOSPECHOSO;
- all six top-level categories have configured `precision=1`, `recall=1`, `FNR=0` regression thresholds, but sparse support means those perfect values do **not** prove broad Spanish clinical quality.

The existing gate is valid and must be preserved. REC-01 makes it representative and falsifiable enough to support the recovery claim.

## Productive path that MUST be measured

The assurance target is the real V4 registry pipeline:

`createRegistryEngine()` → `createLegacyRecognizerRegistry()` / `AgeRecognizer` → legacy Spanish detectors → conflict resolution → scoring → contextual heuristics → threshold survivor/candidate split → policy/operator composition.

The committed V4 evaluator already calls `createRegistryEngine()` directly. Keep that productive authority. Do **not** replace it with a standalone regex test, a legacy-only evaluator or a second recognizer implementation.

Relevant current surfaces include:

- `app-v4/src/engine/ground-truth/**`
- `app-v4/src/engine/registry-engine.ts`
- `app-v4/src/engine/legacy-recognizers.ts`
- `app-v4/src/engine/recognizer-registry.ts`
- `app-v4/src/engine/age-recognizer.ts`
- `js/core/detectors/{identificadores,fechas,ubicaciones,nombres,cuasiidentificadores}.js`
- `js/core/scoring/**`
- `js/core/utils/TextNormalizer.js`
- `js/data/**` as the current Spanish dictionaries
- `scripts/privacy-eval/lib/{matching,metrics}.mjs` as the accepted metric semantics.

## Non-negotiable boundaries

### 1. Synthetic / no-PHI only

Every new corpus case must be synthetic. Do not copy real notes, emails, hospital exports, names linked to real cases or any external patient material into the repository.

### 2. Benchmark desired behavior, not current output

Corpus annotations are independent product/privacy expectations. Never derive or rewrite an annotation merely because the current engine disagrees.

A failing representative core case is evidence to investigate, not permission to weaken the corpus.

### 3. The adversarial tier is not a parking lot

Do not move a newly exposed direct-identifier/name/date/location/age leak to `adversarial` merely to keep CI green.

For the three existing `901–903` known-gap cases, produce an explicit disposition during REC-01:

- fix/promote to core when the behavior is already inside REC-01's accepted recognition semantics and the correction is bounded; or
- retain report-only with a concrete reason why it is not a recovery-blocking PHI leak under current authority; or
- **HUMAN STOP** if resolving it requires new privacy doctrine or architecture.

### 4. No arbitrary new quality threshold

Do not lower the existing core thresholds to make a broader corpus pass.

Do not invent a new release percentage for precision/recall/FNR. The current `1 / 1 / 0` values remain the regression-gate contract for committed core expectations unless a separate accepted decision changes them. REC-01 adds representative support and per-type/slice evidence. If a different statistical release threshold is needed, **HUMAN STOP** for product/privacy acceptance.

### 5. Recognition only unless evidence demands a bounded correction

REC-01 may make test-first bounded corrections to existing recognition seams when the new corpus demonstrates a defect. It may touch existing detector/scoring/heuristic/AGE-recognizer logic only as needed to satisfy already-accepted semantics.

It must **not** redesign:

- Privacy Policy mappings;
- operators/transformation doctrine or AGE bands;
- ReviewSession;
- Privacy Gate / Export;
- structured semantics;
- batch semantics;
- app UI/localization;
- Worker architecture;
- Safe/Confidential contracts.

Do not add remote NER, local NER architecture, a backend, an LLM/API, a third-party runtime dependency or a second recognition stack.

If adequate correction requires any of those: **HUMAN STOP**.

### 6. No fixture gaming

Do not add one-off dictionary entries that exist only to make synthetic test names pass. Dictionary changes are allowed only when they represent a defensible general correction to the existing Spanish recognizer contract and are covered by positive + negative tests.

## Required assurance coverage

The expanded corpus/coverage oracle must make support visible rather than letting overall metrics hide class imbalance.

### Top-level categories

All productive categories remain explicit:

- `NOMBRE`
- `IDENTIFICADOR`
- `FECHA`
- `UBICACION`
- `SOSPECHOSO`
- `EDAD`

No top-level category may be represented by a single token/example and then described as broadly assured.

### Meaningful slices to cover

Use the existing recognizer contract and Spanish clinical use, not invented taxonomy. At minimum ensure machine-visible support for these material slices where the current engine claims them:

**NOMBRE**
- patient;
- healthcare professional;
- family/contact;
- compound names/surnames and common Spanish particles/context.

**IDENTIFICADOR**
- DNI;
- NIE;
- NUSS, including a formatted variant;
- NHC, including a labelled/structured variant;
- health-card identifiers (`CIP` / `SIP` / `TIS` / `TSI` family);
- Spanish phone, including a separator or `+34` variant;
- email;
- postal-code/label context where the productive detector currently treats it as identifier.

**FECHA**
- numeric full date;
- textual full date;
- month/year partial date;
- year form under the existing labelled/contextual detector contract;
- invalid/measurement-like numeric controls that must not become dates.

**UBICACION**
- city/province/CCAA-oriented dictionary coverage as actually exposed by the recognizer;
- hospital/clinic/health-centre context;
- address;
- barrio/district context.

**SOSPECHOSO / quasi-identifiers**
- specific profession;
- singularity/unique-case cue;
- public-role cue;
- special kinship cue;
- rare-disease/eponym-related contexts with both privacy-positive and clinically ordinary negative controls where current semantics distinguish them.

**EDAD**
- ordinary adult years;
- abbreviated years;
- pediatric months/weeks;
- boundary/top-code cases;
- age vs duration (`evolución de … años` etc.);
- implausible/measurement false-positive controls already within accepted AGE recognition semantics.

### Language/style slices across the corpus

The corpus as a whole must include representative combinations of:

- accents and legitimate no-accent variants where the recognizer claims normalization support;
- abbreviations;
- telegraphic charting / labelled fields;
- punctuation, commas and parentheses;
- multiline clinical text;
- short prose and denser mixed-entity prose;
- negatives that resemble identifiers/ages/names but are ordinary clinical measurements, terms or eponyms.

The assurance harness must fail closed when required declared coverage disappears. A report that says `precision=1` for one surviving example while a required slice has zero support is not acceptable.

## Work-unit graph

### WU-A — Assurance oracle + coverage contract

Before changing recognition behavior:

1. extend the V4 ground-truth assurance contract so the report exposes support counts by top-level type and meaningful declared slice/subtype;
2. add a machine-readable coverage requirement/manifest (or equivalently explicit deterministic authority) for the required slices above;
3. fail closed if a required declared slice has zero support or a top-level category collapses back to a single-example pseudo-grade;
4. preserve the existing accepted matching/metric definitions; do not fork precision/recall/FNR formulas;
5. preserve exact-span / accepted AGE transformed-output goldens;
6. add a planted falsation proving the coverage oracle turns red when a required slice is removed.

This WU proves the **measurement instrument**, not recognition quality.

### WU-B — Broad synthetic Spanish corpus + bounded TDD corrections

1. expand the synthetic corpus against the WU-A coverage contract;
2. run the real `createRegistryEngine()` and record per-type/slice support + precision/recall/F1/FNR;
3. classify every newly exposed failure as one of:
   - inherited valid behavior;
   - inherited known gap;
   - regression;
   - V4 improvement;
   - new gap;
4. for failures that are clearly inside existing accepted recognition semantics, correct them test-first in the smallest existing recognizer/detector/scoring/heuristic seam;
5. preserve positive + negative/adversarial controls so a broadened regex/dictionary cannot buy recall by destroying precision;
6. revisit existing `901–903` dispositions under the rules above.

A direct PHI pattern already claimed by the product contract may not remain silently missed at closeout. If it cannot be corrected within bounded existing semantics, STOP rather than redefining the contract.

### WU-C — Composed assurance closeout + recovery trace update

1. run the full expanded assurance on the productive registry engine;
2. prove planted FN, planted FP and missing-coverage violations all fail the oracle;
3. run focused tests for every recognizer seam actually changed;
4. run the canonical deterministic regression chain;
5. update only REC-01-owned recovery evidence/disposition (`FUNC-003`, `QA-001`, `H-40`, and REC-01 plan/status text as appropriate) from demonstrated results;
6. do not mark broader recovery complete or modify unrelated REC status.

## Deterministic acceptance

At final candidate, all of the following are required:

1. productive engine under test is `createRegistryEngine()`;
2. corpus remains synthetic/no-PHI and versioned;
3. all six top-level types have materially broad support and the declared meaningful slices have nonzero machine-visible support;
4. per-type and meaningful-slice support plus precision/recall/F1/FNR are available deterministically;
5. existing core thresholds are not lowered to obtain green;
6. no newly exposed recovery-blocking PHI leak is hidden by moving it to `adversarial`;
7. existing `901–903` cases have explicit, evidence-backed dispositions;
8. a planted false negative fails recall/FNR;
9. a planted false positive fails precision;
10. removal of a required coverage slice fails the coverage oracle;
11. existing exact-span and AGE transformation goldens remain green;
12. any recognizer correction has focused positive and negative regression evidence;
13. no new runtime dependency/network path/NER architecture appears;
14. no product policy/operator/review/export/structured/batch semantics changed;
15. REC-01-owned traceability docs are updated without overclaim.

## Verification commands

Use final-diff-appropriate focused tests throughout. Final verification must include at least:

```bash
npm run check:privacy-eval:v4
npm run test:v4
npm run typecheck:v4
npm run lint:v4
npm run format:check:v4
npm run build:v4
npm test
git diff --check
```

If product recognition source changed, also run the focused recognizer/detector tests that own that source and demonstrate a representative planted regression/negative control. Do not weaken an E2E/test locator or fixture merely to make it pass.

Baseline at handoff creation, before any REC-01 mutation:

- `npm ci --no-audit --no-fund`: PASS;
- `npm run check:privacy-eval:v4`: PASS, 10/10 tests;
- direct focused `v4-ground-truth.test.ts`: PASS, 10/10 tests;
- tracked worktree: clean.

## C-084 execution rules

- Select **`atenea-complex`** in the visible OpenCode TUI before submitting this handoff. Material PHI-detection assurance/corrections are a C-084 complex trigger.
- Use **`/implement-spec`**: WU-A → WU-B → WU-C is one REC ticket with multiple bounded work units.
- Primary coordinator owns the Matt task graph and exactly one final integration-branch canonical `/code-review`.
- Implementation workers own implementation/TDD + committed/fixed candidate evidence only; they do not invoke `/implement`, `/implement-spec`, `/code-review`, reviewers or correctors.
- Review start closes the originating implementer write phase.
- Canonical review must use both bound axes: Standards + **complex Spec reviewer** against the exact pre-implementation fixed point and this authority envelope.
- Actionable review findings go only to a fresh `atenea-corrector-complex` session dispatched by the coordinator.
- At most two fresh finding-scoped correction attempts for the same authorized finding envelope.
- Persistence after correction #2, a new material finding, scope expansion, need for NER/new privacy doctrine, or need to change policy/operator semantics => **HUMAN STOP**.
- No silent model/quota fallback inside a work unit.
- Do not launch/restart/replace Herdr.

## Publication boundary

**LOCAL_ONLY.** During REC-01 execution do not:

- push;
- create/update/close GitHub issues;
- create/update PRs;
- merge;
- deploy;
- change repository settings;
- force-push or rewrite history.

Local commits are expected. Human/Cora audits the final candidate before any publication decision.

## Final return contract

Return to the human operator:

- exact starting fixed point `922e6d42e5d6c47a26e114b0b6d704e4a6ff3d83`;
- exact final HEAD and ordered local commits;
- changed-file inventory;
- WU-A / WU-B / WU-C completion summary;
- final corpus counts by tier/type and meaningful slice;
- precision/recall/F1/FNR by top-level type and available meaningful slice;
- explicit disposition of every `901–903` case;
- every bounded recognizer correction made, with the failing case that justified it;
- deterministic verification commands/results;
- actual C-084 coordinator/implementer/reviewer/corrector routing;
- canonical Standards + Spec review result and corrections, if any;
- unresolved known gaps and whether any is recovery-blocking;
- clean worktree status;
- explicit statement that nothing was pushed/merged/deployed.

If a STOP condition occurs, return the evidence and stop without inventing a workaround.
