# REC-03 — STRUCTURED-SEMANTICS-RECOVERY-01 — C-084 Go execution handoff

Status: **READY_TO_LAUNCH**
Date: 2026-10-04
Recovery Work Order: **REC-03 — STRUCTURED-SEMANTICS-RECOVERY-01**
Cost policy: **go**
Risk class: **complex**
Visible primary: **`atenea-go`**
Matt entry: **`/implement-spec`**
Publication boundary: **LOCAL_ONLY**

## 0. Fixed execution identity

- Repository: `b32majus/Laboratorio_Privacidad_Clinica`
- Canonical product base: `3.0-main@e0f2b57fe41b40acd1df72f784dbc2010f22d891`
- Atenea authority synchronized from: `b32majus/Atenea@9d94c4e685a3c828af05ace040f8b097ffdddae0`
- Atenea workspace-sync commit on this branch: `2205ba4b77e9ba275b4182d32fd73f101af11e79`
- Execution branch: `work/rec-03-structured-semantics-recovery-20261004`
- Execution worktree: `/srv/kairos-lab/qualification/laboratorio-rec03-structured-semantics-20261004`
- Pre-implementation fixed point / canonical review anchor: **the HEAD containing this handoff after its preparatory commit**. Resolve it once at launch and keep it fixed for the entire Matt lifecycle.

If branch, worktree, canonical base, Atenea authority, cost policy, risk class, project-local Go bindings or review anchor differ at launch: **HUMAN STOP**.

This run is part of real-ticket Atenea Go qualification. **Do not claim Go quality equivalence to Standard Volume.** Record what actually happened.

## 1. Current Atenea / Go authority

Read before implementation:

1. `AGENTS.md`
2. `docs/START_HERE.md`
3. this handoff in full
4. `docs/ATENEA_EXECUTION_ROUTING_V0.md`
5. `docs/ATENEA_GO_PROFILE_V0.md`
6. `docs/ATENEA_GO_MODEL_CATALOG_V0.md`
7. `docs/ATTENDED_PRODUCT_SHAPING_GUARDRAILS_V1.md`
8. `docs/PRODUCT_FIDELITY_GATES_V1.md`
9. `CONTEXT.md`
10. `docs/RECOVERY_MASTER_PLAN_2026-10.md` — REC-03 plus dependency doctrine only
11. `docs/audits/2026-10-recovery-traceability-matrix.md` — `PRODUCT-006`, `STRUCT-002`, `H-23`, `H-24`, `H-30`, `H-31`
12. `docs/shaping/CURRENT_DECISIONS.md` — especially D-005, D-007, D-009, D-012, D-013, D-018, D-020, **D-021**
13. `docs/specs/SPEC_V4_BATCH_AND_STRUCTURED.md` §§5–13
14. frozen UX target `docs/audits/2026-09-ux-ui-product-flow-audit.md` — Structured target / Export separation only
15. frozen code/functional audit structured P1 findings and product candidates only
16. current structured/text engine code/tests cited below.

Historical T01–T25 execution docs are provenance. Do not resurrect legacy code merely because it had a useful capability; recover the capability on V4 authorities.

## 2. Why REC-03 exists

REC-02 is canonical and closes text/document/batch policy semantics. Structured V4 still has four material recovery gaps:

1. the selected patient-ID column is currently dropped from Safe output instead of becoming a deterministic Study ID (`H-23`);
2. row linkage across repeated patient rows is therefore lost in Safe structured data (`H-24`);
3. current class→action mapping has semantic drift: Identifier→remove, Quasi→generalize, Sensitive→codify, and non-date `generalize` has no productive operator (`H-31`);
4. a configured structured free-text column cannot enter the text engine/ReviewSession path (`H-30`).

REC-03 restores those semantics. It does **not** add formats/polish (REC-04), new policy semantics (REC-02), ARX-lite, HMAC/global IDs, localization or visual redesign.

## 3. Non-negotiable product rails

These are product boundaries, not questions for OpenCode:

- one app shell and the existing `Input → Configure → Review → Privacy Gate → Export` journey;
- exactly the five accepted structured classes: Identifier / Quasi-Identifier / Sensitive / Insensitive / Unknown;
- Class and Action may be separate authorities; do not create a sixth `Free text` class;
- selected patient-ID remains the single patient identity authority;
- UNKNOWN never silently becomes KEEP;
- patient originals/mappings remain Confidential-only;
- text-engine review remains ReviewSession-authoritative; no auto-accept shortcut for structured free text;
- no new top-level route, app, mode, expert configuration surface or global state framework;
- no network/storage/logging of PHI; committed evidence is synthetic only;
- existing T19 structured date/age policy remains authoritative;
- existing REC-02 text policy remains authoritative for cells explicitly routed `process-as-text`;
- simpler composed product wins: expose only the bounded Action choices needed by D-021.

If implementation would require another class, a new privacy policy meaning, per-patient text-policy date semantics, global/cross-Job tokenization, an unconstrained action editor, or a new user workflow: **HUMAN STOP**.

## 4. Accepted semantic contract — implement exactly

### 4.1 Study ID

When a patient-ID column is explicitly selected:

- its productive disposition is `study-id`, not `remove`;
- Safe output replaces that column in place with header `ID_ESTUDIO`;
- unique non-blank original IDs receive `PAC_001`, `PAC_002`, … in deterministic first-appearance order;
- repeated original IDs reuse exactly the same Study ID;
- the original selected patient-ID header/value is absent from Safe output;
- Confidential correspondence exposes one unique original patient-ID ↔ Study-ID mapping plus any existing authorized correspondence;
- no HMAC/global/persistent/cross-Job mapping;
- configurable prefix and `Visita_Num` are **not** REC-03.

Fail closed:

- if another, different input column already occupies Safe header `ID_ESTUDIO`, do not overwrite it silently;
- if a row contains other data but the selected patient-ID cell is blank, block preparation with row-visible/factual reason instead of producing an unlinkable Safe row;
- do not auto-select a patient-ID column.

A structured Job with no selected patient-ID may retain the current policy-specific readiness behavior; REC-03 must not invent a universal mandatory selection solely to generate Study IDs. Policies that already require a patient ID for shifting remain fail-closed as today.

### 4.2 Class → Action

The effective action is an explicit domain fact, not a label-only UI property.

Derived/fixed precedence:

1. selected patient-ID → `study-id`;
2. explicit `visit`/`birth` role → `date-policy` (T19);
3. ordinary Identifier → `remove`;
4. Sensitive → `keep` default;
5. Insensitive → `keep`;
6. Unknown → `review-required`;
7. non-date Quasi-Identifier → `review-required` unless a bounded proposal/explicit action exists.

A center/ward header may propose `pseudonymize` (frozen UX target). Other non-date Quasi columns do not gain an invented generic `generalize` operator.

Bounded explicit action choices:

- Quasi, non-date, non-patient-ID: `pseudonymize`, `keep`, plus `process-as-text` only when inferred type is text;
- Sensitive: `keep`, plus `process-as-text` only when inferred type is text;
- Unknown: explicit `process-as-text` is allowed only when inferred type is text; otherwise the reviewer must resolve/change its class. Unknown may not directly become KEEP while remaining Unknown;
- Identifier: `remove` only, except selected patient-ID=`study-id`;
- Insensitive: `keep` only;
- date-role and patient-ID actions are derived/locked and cannot be contradicted by an action override.

`pseudonymize` for a structured quasi column is deterministic, column-local categorical tokenization:

- non-blank distinct values → `QID_001`, `QID_002`, … by first appearance;
- repeated values reuse token;
- blanks remain blank;
- original↔token mapping is Confidential-only.

Existing `codifyColumnValues` may be reused as an internal primitive, but `codify` is not the recovered user-facing action contract.

### 4.3 Free-text cells

`process-as-text` is an Action, not a class.

For every non-blank configured cell:

- run the productive text engine under the Job's selected REC-02 policy;
- process cells in deterministic row-major order with one shared `ProcessingContext` carried across cells;
- initialize that context through the REC-02 text-policy context seam for the Job;
- therefore Longitudinal Research in free-text cells uses the REC-02 Job-scoped text date shift; explicit structured visit/birth columns continue using T19 structured date/age semantics;
- create a ReviewSession from the engine result including low-confidence candidates;
- Safe output remains blocked until every required cell ReviewSession can finalize;
- Safe cell bytes come from canonical `getFinalText(session)` only;
- blank cells remain blank and create no session;
- engine failure is explicit and blocks output; never keep the raw original as fallback;
- policy change invalidates/rebuilds these sessions under the new policy;
- same names/locations/etc. across processed cells use the carried context consistently.

Confidential structured correspondence may carry original↔final-reviewed free-text values; it never enters Safe output.

### 4.4 UI/composed product

- Configure stays the single structured configuration surface.
- Existing column cards expose the effective Action and only the valid bounded choices above.
- Stronger authorities (patient-ID/date role) visibly lock/derive the action rather than allowing contradictory selections.
- No generic expert action matrix or sixth class.
- If no `process-as-text` cells exist, the current structured Review summary remains.
- If they exist, Review shows a bounded cell queue/navigation and reuses existing `ReviewWorkspace` semantics for the active cell. The user should understand **which column/row cell** is being reviewed without learning ProcessingContext/session internals.
- Privacy Gate / export readiness must include free-text review completion and explicit processing failures.
- Existing Safe CSV + Confidential TXT formats remain the formats for REC-03. Do not implement REC-04 formats/confirmation here.

## 5. Work Units

Execute in order unless Matt proves a clean independent split. Do not run two WUs concurrently if they mutate the same authority.

### WU-A — Study-ID foundation and Safe/Confidential linkage

Scope:

- introduce the deterministic in-Job Study-ID mapping as a pure domain primitive;
- make selected patient-ID disposition productive `study-id`;
- materialize `ID_ESTUDIO` in Safe output and unique mapping in Confidential correspondence;
- preserve row order and all existing T19 date/age behavior;
- fail closed on blank selected patient IDs for non-empty rows and header collision.

Required red→green oracles include:

- `P-001, P-001, P-002` → `PAC_001, PAC_001, PAC_002`;
- same input/config twice → byte/equality-identical mapping/output;
- no original selected patient ID anywhere in Safe output;
- Confidential contains original↔Study-ID mapping;
- blank patient ID row blocks rather than disappears/exports unlinkably;
- `ID_ESTUDIO` collision blocks;
- other Identifier columns remain removed;
- no prefix/visit-number option is introduced.

### WU-B — Structured Class→Action authority

Scope:

- separate effective class from effective productive Action in the structured configuration domain;
- implement D-021 precedence/allowed action matrix;
- remove the productive `generalize-without-operator` dead end by turning unresolved non-date quasi semantics into explicit review-required state, not by inventing an operator;
- restore center/ward `pseudonymize` proposal and Sensitive→Keep default;
- implement deterministic `QID_###` structured pseudonymization and Confidential correspondence;
- expose a constrained Action control/fact in existing Configure column cards;
- class override/action override must rebuild one canonical frozen configuration and gate state.

Required oracles include:

- patient-ID/date-role actions cannot be contradicted by UI/domain override;
- ordinary Identifier→remove;
- center/ward quasi proposes and productively executes pseudonymize;
- another non-date quasi (e.g. postal code) remains review-required until explicit allowed action;
- Sensitive clinical column defaults Keep;
- Unknown never becomes Keep directly;
- invalid action/class combinations fail typed/closed;
- blank pseudonymized values stay blank and do not enter mapping;
- repeated quasi values reuse the same QID token.

### WU-C — Structured free-text engine + ReviewSession composition

Scope:

- add explicit `process-as-text` action for allowed text-like columns;
- build deterministic row-major processing with shared REC-02 `ProcessingContext`;
- create/store job-scoped structured free-text ReviewSessions plus visible typed failures;
- integrate the active session into the existing Review step with bounded cell navigation and existing `ReviewWorkspace` semantics;
- make structured preparation read reviewed final cell text, never raw proposals;
- invalidate/recompute correctly on policy/config/action changes;
- preserve low-confidence queue semantics.

Required oracles include:

- a synthetic Spanish clinical free-text cell with direct identifier/name/date/age reaches the real engine and review session under each relevant policy path;
- unresolved mandatory detections block Safe output;
- after decisions, Safe cell equals ReviewSession canonical final text and contains no removed original identifiers;
- low-confidence candidate remains pending/visible;
- same entity across two cells receives consistent pseudonym proposal under shared context;
- Longitudinal text dates across cells use one REC-02 Job-scoped offset/order semantics;
- one processing failure is visible and blocks Safe output without silently keeping the cell;
- blank cell creates no session and remains blank;
- policy change discards stale sessions and reprocesses under the new policy;
- zero storage/network regressions.

### WU-D — Composed gate/export/docs closeout

Scope:

- compose Study ID + action authority + free-text review + existing T19 semantics through Configure → Review → Privacy Gate → Export;
- update factual gate/readiness copy only as needed (REC-10 Spanish localization is later);
- update `CURRENT_DECISIONS` evidence if implementation names change but do not change D-021 semantics;
- update only REC-03-owned matrix rows/status and REC-03 status paragraph in Master Plan as **LOCAL CANDIDATE**, never global recovery complete;
- add qualification-return evidence, not a claim of Go quality equivalence.

Composed oracles must prove:

- one synthetic multi-row structured Job with repeated patients, visit/birth dates, center, diagnosis, free text and another direct identifier can traverse the full V4 flow;
- Safe CSV contains `ID_ESTUDIO` linkage, transformed dates/ages, QID pseudonym, reviewed free text, kept diagnosis as configured, and no original patient ID/removed identifier/correspondence;
- Confidential artifact contains the allowed mappings/originals separately;
- UNKNOWN/unresolved action/free-text review failure keeps Gate/Export closed;
- switching policy re-derives both structured date/age and free-text policy state without stale review certification;
- no new app route/page/mode/class appears.

## 6. Explicit non-goals

REC-03 must NOT implement:

- configurable Study-ID prefix;
- `Visita_Num`;
- smart Excel header row detection;
- XLSX Safe/Confidential outputs;
- additional Confidential-download confirmation;
- batch-wide outputs;
- DOCX/PDF output;
- ARX/equivalence-class risk layer;
- HMAC/global/study-external tokenization;
- OCR/NER/FHIR/DICOM;
- Spanish localization;
- Sophilux visual redesign;
- generic pipeline override;
- new privacy policies or changed REC-02 mappings;
- new T19 structured date/age policy semantics.

## 7. Implementation boundaries / reuse

Prefer/refactor existing authorities rather than fork them:

- patient ID: `app-v4/src/structured/patient-id.ts`;
- class/profile/config: `classification.ts`, `configuration.ts`;
- productive plan: `transform-plan.ts`;
- dataset + correspondence: `transformed-dataset.ts`, `structured-confidential-audit.ts`;
- date/age: `date-age-policy.ts` / T19 unchanged semantically;
- text policy/context: `engine/policy.ts`, `engine/initial-processing-context.ts` (REC-02);
- engine + ReviewSession adapter: `review/review-domain.ts`, `js/domain/review-session.js`;
- state bridge: `useJobSession.ts`;
- current surfaces: `StructuredConfigureWorkspace.tsx`, `ReviewWorkspace.tsx`, `PrivacyGate.tsx`, `ExportStep.tsx`.

Do not create a second policy table, second patient-ID authority, second review domain, or a parallel structured app.

A small shared helper for promoting/carrying `ProcessingContext` is allowed if it removes duplicated batch/free-text context logic without changing REC-02 behavior; prove parity if refactored.

## 8. Deterministic evidence floor

Run focused tests during TDD. Final candidate must run at least:

```bash
npm run check:privacy-eval:v4
npm run typecheck:v4
npm run lint:v4
npm run format:check:v4
npm run build:v4
npm test
npx playwright test e2e/structured*.spec.ts e2e/policy-guidance.spec.ts
# If no structured-named E2E file exists yet, add the focused composed structured E2E required by WU-D.
git diff --check
```

Also run focused Vitest for every changed structured/review/session file and any network/storage invariant tests affected.

Falsification requirement: at least one planted/negative oracle each for (a) Study-ID leak/linkage, (b) invalid class-action combination or unresolved quasi, and (c) free-text review bypass/stale-policy state.

Use only synthetic/no-PHI fixtures.

## 9. C-084 Go lifecycle — exact route

This run is **Cost policy: go / Risk class: complex**.

Primary coordinator: `atenea-go` (`opencode-go/mimo-v2.6-flash`). It is orchestration-only for repository mutation.

Matt implementation roles:

- explorer when needed: `atenea-explorer-go` (`nan/qwen3.6`);
- implementer: fresh `atenea-implementer-go` sessions (`opencode-go/muse-spark-1.3-contributor`);
- merger only if Matt needs integration arbitration: `atenea-merger-go` (`opencode-go/mimo-v2.6-flash`).

Canonical review — exactly one after the integrated candidate is fixed:

- Standards: `atenea-review-standards-go` (`nan/qwen3.6`);
- Spec: `atenea-review-spec-go` (`openai/gpt-6-luna`, high).

Because `Risk class: complex`, every actionable review finding goes to a **fresh `atenea-corrector-go-complex`** (`opencode-go/deepseek-v4.1-flash`), not the volume Go corrector. Maximum two fresh finding-scoped attempts over the same authorized finding envelope. No second broad review unless the first review failed technically, was incomplete or used the wrong anchor/authority.

No silent fallback. If any bound Go model is unavailable/quota-blocked/removed/materially incapable, STOP at the clean boundary and report it. Do not switch to Standard, Free, another Go model or another provider inside this run.

Cora integrated audit is mandatory before any merge recommendation because this is material Go-complex qualification work.

## 10. HUMAN STOP triggers

STOP and return to Cora + human if any of these occur:

- D-021 cannot be implemented without changing its class/action/product semantics;
- a sixth class or unconstrained action editor appears necessary;
- correct free-text handling appears to require per-patient text-policy date shifting or another new policy meaning;
- patient identity requires HMAC/global/cross-Job semantics;
- a new page/mode/workflow is needed;
- a bound Go model is unavailable or a fallback is proposed;
- a review finding asks for material scope/architecture/product expansion;
- the same authorized finding remains after correction #2;
- product composition after WUs no longer matches the rails above.

## 11. Return contract

Return one final Markdown report with:

1. fixed product base, Atenea authority SHA, sync commit, pre-implementation review anchor, final HEAD, branch/worktree clean status;
2. ordered commits and changed-file inventory;
3. WU-A/B/C/D outcomes;
4. exact final class→action table and allowed overrides;
5. Study-ID examples and leak/linkage evidence;
6. free-text cell processing/review evidence, context-sharing behavior and policy-change evidence;
7. Safe vs Confidential composed example facts;
8. all deterministic gate results with exact test counts;
9. exact C-084 Go role/session/model routing actually used;
10. canonical Standards + Spec findings/verdicts;
11. correction attempts, if any, with finding envelope and focused red→green evidence;
12. any HUMAN STOP or bound-model/quota/provider incident (must state `NONE` if none);
13. **Go qualification observations**: where the Go writer/coordinator/review/correction was sufficient or struggled, without claiming equivalence to Standard Volume;
14. remaining known gaps explicitly outside REC-03;
15. explicit LOCAL_ONLY confirmation: no push/PR/merge/deploy/issue/settings/history rewrite.

The candidate is not publication-authorized by a clean review. Cora audits it first; human publication/merge authority remains mandatory.
