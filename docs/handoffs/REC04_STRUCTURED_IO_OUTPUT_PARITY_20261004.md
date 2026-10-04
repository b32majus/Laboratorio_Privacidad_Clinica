# REC-04 — STRUCTURED-IO-OUTPUT-PARITY-01 — C-084 Go execution handoff

Status: **READY_TO_LAUNCH**
Date: 2026-10-04
Recovery Work Order: **REC-04 — STRUCTURED-IO-OUTPUT-PARITY-01**
Cost policy: **go**
Risk class: **complex**
Visible primary: **`atenea-go`**
Matt entry: **`/implement-spec`**
Publication boundary: **LOCAL_ONLY**

## 0. Fixed execution identity

- Repository: `b32majus/Laboratorio_Privacidad_Clinica`
- Canonical product base: `3.0-main@a7c8444f75cd611f55efa4569d233db2f1a4d927`
- Atenea authority: `b32majus/Atenea@9d94c4e685a3c828af05ace040f8b097ffdddae0`
- Project-local Go profile/bindings were verified byte-identical to that Atenea authority before shaping; no new workspace-sync commit is required for REC-04.
- Execution branch: `work/rec-04-structured-io-output-parity-20261004`
- Execution worktree: `/srv/kairos-lab/qualification/laboratorio-rec04-structured-io-output-parity-20261004`
- Pre-implementation fixed point / canonical review anchor: **the clean HEAD containing this handoff + D-022 after the preparatory commit**. Resolve it once at launch and keep it fixed for the entire Matt lifecycle.

If canonical base, Atenea authority, cost policy, risk class, Go bindings, branch/worktree or review anchor differ at launch: **HUMAN STOP**.

This is another real-ticket Atenea Go qualification run. Record actual route/model/tool behavior; do **not** claim Go quality equivalence to Standard Volume.

## 1. Current authority to read

Read only what the work needs, in this order:

1. `AGENTS.md`
2. `docs/START_HERE.md`
3. this handoff in full
4. `docs/ATENEA_EXECUTION_ROUTING_V0.md`
5. `docs/ATENEA_GO_PROFILE_V0.md`
6. `docs/ATENEA_GO_MODEL_CATALOG_V0.md`
7. `docs/ATTENDED_PRODUCT_SHAPING_GUARDRAILS_V1.md`
8. `docs/PRODUCT_FIDELITY_GATES_V1.md`
9. `CONTEXT.md`
10. `docs/RECOVERY_MASTER_PLAN_2026-10.md` — REC-04 and dependencies only
11. `docs/audits/2026-10-recovery-traceability-matrix.md` — `H-21`, `H-25`, `H-26`, `H-27`, `H-28`, `H-29`, and the REC-04 slice of `H-42`; `H-24` is provenance only because REC-03 already closed its blocker
12. `docs/shaping/CURRENT_DECISIONS.md` — D-005, D-007, D-009, D-012, D-013, D-018, D-020, D-021 and **D-022**
13. `docs/specs/SPEC_V4_BATCH_AND_STRUCTURED.md` §§8–13
14. frozen UX target structured/export sections and v3 structured heritage only where cited by the matrix
15. current code/tests named below.

Historical implementation is evidence, not authority to restore unsafe behavior wholesale.

## 2. Why REC-04 exists

REC-03 is canonical and restored structured identity, Class→Action, free-text review and Safe/Confidential domain semantics. Remaining structured recovery gaps are now I/O/productivity/output gaps:

- hospital workbooks may have explanatory rows before the real header (`H-21`);
- Study-ID prefix configurability and optional per-patient row/visit numbering are missing (`H-25`, `H-26`);
- useful factual structured summary is incomplete (`H-27`);
- Safe structured output has CSV but no analysis-ready XLSX (`H-28`);
- Confidential structured correspondence has TXT but no XLSX (`H-29`);
- structured Confidential downloads still lack the required additional deliberate confirmation (REC-04 portion of `H-42`).

REC-04 must restore these capabilities **on top of REC-03 authorities**, not rebuild structured privacy logic inside parsers/exporters.

## 3. Non-negotiable product rails

- Preserve one SPA and `Input → Configure → Review → Privacy Gate → Export`.
- REC-03 patient-ID, Study-ID linkage, Class→Action, free-text ReviewSession and Safe/Confidential separation stay authoritative.
- CSV first-row semantics stay unchanged; smart header recovery is XLS/XLSX only.
- Explicit multi-sheet selection stays unchanged and precedes header-row resolution.
- Never silently guess a workbook header when the bounded detector is ambiguous.
- Safe exporters consume only canonical Safe state; Confidential exporters consume only canonical Confidential correspondence + bounded factual metadata.
- No mapping/original introduced into Safe XLSX; no kept clinical table copied into Confidential just for convenience.
- No spreadsheet formula execution from source/user strings.
- No network/storage/logging of PHI; synthetic committed fixtures only.
- No new route/mode/app/privacy class/policy meaning/risk score/global identity.
- REC-10 localization and REC-11 visual system remain later work.

Any implementation that needs a new privacy/product meaning beyond D-022, changes REC-02/T19 semantics, adds a second identity authority or cannot preserve Safe/Confidential separation: **HUMAN STOP**.

## 4. Accepted contract — implement exactly

### 4.1 XLS/XLSX header-row resolution

CSV remains unchanged: first parsed record is headers.

For an explicitly selected workbook sheet (or the only sheet):

- inspect at most the first 10 used rows;
- header candidate = at least 3 non-empty textual cells AND either at least one v3 clinical/header token match (`nhc|nombre|apellido|fecha|dni|paciente|id|codigo|edad|sexo|telefono|email|direccion|centro|medico|diagnostico|procedimiento|visita`, case-insensitive) OR textual cells outnumber numeric cells;
- exactly one candidate → auto-select that row;
- zero or multiple candidates → return a typed `header-row-required`/equivalent non-success state with the inspected candidate/row indices so the existing Configure intake surface can ask the human explicitly;
- explicit selection is bounded to the inspected rows and is validated; invalid/out-of-range selection fails typed;
- rows above the chosen header are skipped metadata, never data rows;
- rows below preserve order, blank values and scalar normalization exactly as current Excel authority;
- do not log row content.

Multi-sheet selection remains explicit first. Header resolution is not a new top-level step/page.

Required falsification: workbook metadata row(s) + real row 4 must not be parsed with metadata as schema; ambiguous two-candidate workbook must block until explicit selection; CSV fixture with similar metadata-looking values must still use first record.

### 4.2 Structured output options

Add one canonical job-scoped structured output-options authority, not React-label-only state:

- `studyIdPrefix`: default `PAC`; blank → default; otherwise `trim().toUpperCase()` must match `[A-Z][A-Z0-9]{0,9}`;
- invalid non-blank prefix is explicit invalid state / typed refusal, never a silent fallback;
- Study IDs become `<PREFIX>_001...` using the same first-appearance grouping as REC-03;
- changing prefix must not change patient grouping, row ordering or Confidential original identity;
- `addVisitNumber`: heritage default enabled **when a patient-ID authority exists**; unavailable/effectively absent without one;
- when enabled, Safe adds numeric `Visita_Num` immediately after `ID_ESTUDIO`;
- sequence is 1-based per patient in CURRENT INPUT ROW ORDER. Do not sort and do not call it chronology inferred from dates;
- duplicate/conflicting Safe header `Visita_Num` blocks instead of overwriting/duplicating;
- existing `ID_ESTUDIO` collision behavior remains.

The options must survive normal V4 step navigation within the Job and re-derive output/gate state through the existing structured bridge. They are memory-only.

### 4.3 Safe scalar fidelity + factual summary

Recover typed structured output without weakening canonical transformations:

- evolve the Safe dataset representation so unchanged `keep` numeric/boolean cells remain number/boolean and absence remains `null`; canonical transformed values (Study IDs, QIDs, reviewed free text, date/age transforms) remain their produced string values; derived `Visita_Num` is numeric;
- CSV serializer remains deterministic and represents `null` as an empty field while stringifying/escaping other scalar values safely;
- XLSX writes these canonical Safe scalar values, preserving row order and blanks;
- do not resurrect source Excel formatting/formulas/layout as privacy authority.

Factual summary authority:

- always: data row count;
- with selected patient-ID: unique patient count, linked-row/visit count, average linked rows/visits per patient;
- no patient-ID selected: patient/visit facts are unavailable, not guessed;
- these facts may be shown in existing Configure/Export surfaces and Safe workbook summary, but are not risk/privacy scores and do not certify chronology.

### 4.4 Safe XLSX

Reuse governed same-origin SheetJS (`/vendor/xlsx.full.min.js`); no new dependency/provider.

Create deterministic browser-local XLSX bytes from the exact canonical Safe output:

- `Data` worksheet: Safe headers + Safe rows;
- optional `Summary` worksheet containing only the factual summary above and non-sensitive job/output facts needed to understand it;
- no original↔transformed mapping, reviewer notes or Confidential originals;
- Safe CSV remains available as a separate format;
- suggested filename: `safe-structured-output.xlsx` (REC-10 owns localization later).

Strings beginning `=`, `+`, `-`, `@` must remain literal string cells, not formulas. Add a read-back oracle using the governed SheetJS runtime that proves no planted formula cell exists.

### 4.5 Confidential XLSX + deliberate confirmation

Create Confidential XLSX solely from `StructuredOutput.confidential` and bounded non-sensitive metadata:

- first worksheet: `READ_FIRST`/equivalent warning with the canonical Confidential warning and handling note;
- correspondence worksheet: flatten the authorized per-column correspondence with column/disposition/original/transformed facts; retain no extra Safe-only kept clinical content;
- optional summary/metadata may contain policy id and correspondence totals only;
- suggested filename: `structured-confidential-audit.xlsx`;
- current Confidential TXT may remain available, but it is also identifiable and therefore gets the same second-confirmation safeguard.

Every structured Confidential download format (TXT or XLSX):

1. first action requests the format and opens/reveals a clearly marked confirmation inside the existing Confidential zone;
2. confirmation states that the artifact contains identifiable/reversible correspondence and is for authorized internal handling;
3. explicit Confirm performs that one download; Cancel performs none;
4. confirmation resets after confirm/cancel and cannot survive another Job, a newly blocked/stale preparation or disabled Confidential readiness;
5. Safe downloads never require this Confidential confirmation.

Do not use confirmation state as output readiness authority. It is transient interaction safety only.

### 4.6 UI/product fidelity

- Header-row selection lives in the existing structured intake/configure surface next to current sheet selection; no wizard route.
- Study-ID prefix + `Visita_Num` controls are a small bounded “Output options” area within existing Configure, shown only when relevant.
- Factual summary is compact and subordinate to configuration; do not create a dashboard/risk page.
- Export keeps unmistakably separate Safe and Confidential zones. Safe offers CSV + XLSX. Confidential offers TXT + XLSX behind the additional confirmation.
- Do not perform REC-10 Spanish localization or REC-11 visual redesign here.

## 5. Work Units

Run sequentially **WU-A → WU-B → WU-C → WU-D**. REC-03 qualification showed that cross-WU invariant propagation is the important Go risk here; do not parallelize units that mutate the shared structured authority chain. Commit at clean WU boundaries so an environment restart cannot erase accepted work.

### WU-A — Smart workbook header authority

Scope:

- implement the D-022 detector/typed `header-row-required` outcome and explicit selected-row path;
- preserve sheet selection, date serial normalization, blanks, size gates and CSV semantics;
- compose the bounded UI into current Configure intake.

Required red→green oracles:

- workbook with 3 explanatory rows + headers on row 4 parses correct schema/data;
- workbook with two qualifying candidate rows blocks and lists/selects rows instead of silently choosing;
- explicit valid selection resolves it; invalid selection fails typed;
- single obvious candidate auto-resolves;
- CSV with text-heavy first/second rows is unchanged and still uses first record;
- no content logging/storage/network regression.

### WU-B — Output options, typed Safe state and summary

Scope:

- extend Study-ID primitive/output options without creating a second mapping authority;
- implement safe prefix normalization/validation;
- implement optional row-order `Visita_Num` + collision guard;
- preserve typed Safe scalars/nulls through domain state and CSV compatibility;
- derive factual summary.

Required red→green oracles:

- `PAC` heritage default unchanged when option untouched;
- prefix `hs1` → `HS1_001...`; invalid `=CMD`/punctuation refuses rather than exporting;
- grouping remains identical under prefix change;
- repeated patient rows produce `Visita_Num` 1,2,... in row order; second patient starts at 1; disabling removes the column;
- no selected patient ID → no Study ID/visit column and patient stats unavailable;
- `Visita_Num` header collision blocks;
- numeric/boolean Keep cells stay typed in Safe domain; null stays null; transformed fields remain canonical strings;
- CSV bytes/escaping remain deterministic and no mapping leaks.

### WU-C — XLSX serializers + export confirmation

Scope:

- extend governed SheetJS typed surface only as needed for in-browser authoring;
- add pure/bounded Safe and Confidential XLSX serializers/builders;
- wire Safe CSV + XLSX and Confidential TXT + XLSX into existing Export;
- implement one reusable structured Confidential confirmation interaction for both confidential formats.

Required red→green oracles:

- read back Safe XLSX: exact headers/rows/order/blanks/scalar types where practical, no planted original IDs/mappings;
- read back Confidential XLSX: warning first, authorized correspondence present, kept clinical value absent unless it is itself part of authorized correspondence;
- planted formula-like strings are literal cells, not formulas, in both workbooks;
- first Confidential click downloads nothing; Cancel downloads nothing; explicit Confirm downloads exactly selected format once;
- confirmation resets after download/cancel/job change/blocked preparation;
- Safe CSV/XLSX download directly when ready and never crosses into Confidential content;
- no new dependency/network/storage.

### WU-D — Composed product + recovery evidence

Scope:

- compose header detection → Configure options → existing Review/Gate → CSV/XLSX Export on one synthetic hospital-style workbook;
- add/extend focused Playwright for the actual composed journey;
- update only REC-04-owned traceability evidence and REC-04 Master Plan status as **LOCAL CANDIDATE**, not merged/completed;
- do not close the global `H-42` blocker if REC-05/REC-07 Confidential surfaces still lack confirmation; record only the structured slice as implemented;
- avoid embedding brittle final test counts/HEAD claims in durable candidate docs. The return contract carries exact dynamic evidence.

Composed oracles must prove:

- metadata-before-header XLSX + explicit sheet/header handling reaches correct Configure schema;
- custom prefix and visit numbering reach Safe CSV and Safe XLSX consistently;
- Safe XLSX contains no originals/correspondence and preserves useful typed values/blanks;
- Confidential XLSX contains authorized correspondence only and cannot download without additional confirmation;
- existing REC-03 free-text review/date semantics still gate output correctly;
- no new workflow step/route/class/mode appears.

## 6. Explicit non-goals

REC-04 must NOT implement:

- single-text/document DOCX/PDF recovery (REC-05);
- batch workflow/output recovery (REC-06/07);
- generic input pipeline override (REC-08);
- direct-identifier Keep confirmation (REC-09);
- Spanish localization (REC-10);
- visual-system redesign (REC-11);
- ARX/equivalence-class/risk scoring;
- HMAC/global/cross-Job patient identity;
- OCR/NER/FHIR/DICOM;
- source workbook formatting/formulas/macros preservation;
- automatic chronology sorting/inference for `Visita_Num`;
- new privacy policies or changes to REC-02/T19 semantics;
- a new structured route/app/export page.

## 7. Reuse / likely authority surfaces

Prefer extending the existing authorities rather than forking them:

- workbook intake: `structured/excel.ts`, `structured/intake.ts`, `structured/xlsx-loader.ts`;
- intake/configure UI: `StructuredConfigureWorkspace.tsx`, `App.tsx`;
- Study ID: `structured/study-id.ts`;
- canonical Safe/Confidential dataset: `structured/transformed-dataset.ts`;
- CSV: `structured/csv-writer.ts`;
- Confidential serialization: `structured/structured-confidential-audit.ts`;
- bridge/state: `useJobSession.ts`;
- Export: `export/ExportStep.tsx`;
- gate/readiness: existing structured preparation + `privacyGateModel.ts` unchanged unless a factual reason must be surfaced.

A new focused `structured/xlsx-export.ts` or equivalent pure serializer module is acceptable. Do not create a second transform plan, patient mapping, policy table or review domain.

## 8. Deterministic evidence floor

Final candidate must run at least:

```bash
npm run check:privacy-eval:v4
npm run typecheck:v4
npm run lint:v4
npm run format:check:v4
npm run build:v4
npm test
npx playwright test e2e/structured*.spec.ts e2e/policy-guidance.spec.ts
git diff --check
```

Also run focused Vitest covering Excel intake/header resolution, Study-ID/output options, typed Safe/CSV, XLSX read-back, Confidential confirmation, structured bridge/export and composed structured flow.

Falsification floor:

- header mis-detection/ambiguity planted negative;
- `ID_ESTUDIO`/`Visita_Num` collision + invalid/formula-like prefix negatives;
- formula-like workbook cell read-back proves literal string, not formula;
- planted original/mapping leak forbidden in Safe XLSX;
- Confidential click without confirmation proves zero download.

Use synthetic/no-PHI fixtures only.

## 9. C-084 Go lifecycle — exact route

This run is **Cost policy: go / Risk class: complex**.

Primary: `atenea-go` (`opencode-go/mimo-v2.6-flash`), orchestration-only for tracked repository mutation.

Bound roles:

- explorer when needed: `atenea-explorer-go` (`nan/qwen3.6`);
- implementer: fresh `atenea-implementer-go` sessions (`opencode-go/muse-spark-1.3-contributor`);
- merger only if genuinely needed: `atenea-merger-go` (`opencode-go/mimo-v2.6-flash`).

Single canonical review after integrated candidate is fixed, anchored to the pre-implementation HEAD from §0:

- Standards: `atenea-review-standards-go` (`nan/qwen3.6`);
- Spec: `atenea-review-spec-go` (`openai/gpt-6-luna`, high).

Because risk is complex, actionable findings go only to fresh `atenea-corrector-go-complex` (`opencode-go/deepseek-v4.1-flash`). Maximum two fresh attempts **only over the same authorized finding envelope**. If correction #1 closes that envelope, do not consume correction #2 for housekeeping/evidence refresh; return exact dynamic evidence in the return contract instead. A new material finding, expanded product decision or persistent blocker after correction #2 => **HUMAN STOP**.

No silent model/provider fallback. Missing/quota-blocked/materially incapable bound model => HUMAN STOP at clean boundary; do not switch to Standard/Free/another provider inside this run.

## 10. Publication and audit boundary

LOCAL_ONLY throughout Matt execution:

- no push;
- no PR;
- no merge;
- no deploy;
- no issue/settings mutation;
- no force-push/history rewrite.

Canonical review clean/corrected does not authorize publication. Return to Cora for integrated candidate audit. Human retains publication/merge authority.

## 11. Required return contract

Return one factual closeout containing:

1. canonical base, Atenea authority, fixed review anchor, final HEAD, branch/worktree cleanliness;
2. ordered commits + changed-file inventory/stat;
3. WU-A/B/C/D outcomes;
4. exact workbook header detector/selection behavior and example evidence;
5. final Study-ID prefix/`Visita_Num` semantics + collisions/invalid input evidence;
6. typed Safe dataset + factual summary examples;
7. Safe XLSX read-back facts and leak/formula-injection negatives;
8. Confidential XLSX contents + explicit confirmation interaction evidence;
9. Safe vs Confidential composed synthetic example;
10. exact deterministic gate counts/results;
11. actual Go role/session/model routing, including any restart/provider/quota/tool incidents;
12. canonical Standards + Spec verdicts/findings;
13. each correction attempt with exact authorized envelope and red→green evidence;
14. HUMAN STOP status and any bound-model incidents;
15. Go qualification observations: what writer/review/corrector did well or missed, without quality-equivalence claim;
16. remaining REC-04-adjacent gaps explicitly owned by later REC tickets;
17. explicit LOCAL_ONLY confirmation and publication status.

Cora performs the integrated audit before any publication recommendation.
