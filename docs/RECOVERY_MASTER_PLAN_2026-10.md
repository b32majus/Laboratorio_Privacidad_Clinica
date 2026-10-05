# Recovery Master Plan — Laboratorio de Privacidad Clínica

> Status: **MASTER RECOVERY PLAN — shaped from traceability audit, not yet execution-authorized**
> Date: 2026-10-04
> Original product reference: `3.0-main@331bcaf4a624659c77823a0c4b427d46347ea104`
> Frozen pre-refactor authority: `e164ca2`
> Current V4 reference at shaping: `3.0-main@6fb5eb1fb867e022acc68dd2be39b16bd531f27a`
> Companion matrix: `docs/audits/2026-10-recovery-traceability-matrix.md`
> Human product authority: `docs/HUMAN_PRODUCT_DESIGN_AUTHORITY_V1.md` (accepted 2026-10-05; governs REC-05→REC-11)
> Product-design reconciliation: `docs/audits/2026-10-product-design-reconciliation-final.md`

## 1. Recovery doctrine

Recovery does **not** mean reverting to v3. The V4 platform is retained: ReviewSession, RegistryEngine, ProcessingContext, fail-closed behavior, Safe Output / Confidential Audit separation, low-confidence review, Privacy Gate, structured hardening, Web Worker, local-only runtime, Vite/React/TypeScript and the deterministic test/CI foundation.

Recovery means restoring or deliberately replacing the product capabilities and product contract that were lost when “parity” was reduced to workflow existence. No legacy behavior is copied back when the audit identified it as unsafe. The useful capability is recovered on top of the V4 safety/domain model.

From 2026-10-05, recovery also distinguishes **domain/technical topology from human product topology**. The V4 state machine may remain internally intact while user-facing phases/navigation are simplified or recomposed under `HUMAN_PRODUCT_DESIGN_AUTHORITY_V1.md`.

A Work Order may not claim parity merely because a workflow or component exists. Its acceptance must cover the exact capability, language/output format and user action it owns. The matrix is a traceability index, not self-proving completeness: REC-12 must first reconcile the frozen source audits + v3 product heritage against the matrix and require every material source obligation to have a row or an explicit `DELIBERATELY_SUPERSEDED` decision.

## 2. What is explicitly NOT part of baseline recovery

The following were already classified in the frozen audit as later/optional capabilities and do not inflate the recovery count unless separately accepted later:

- ARX-lite risk/equivalence-class analysis;
- institutional/plugin recognizers as a configurable extension layer;
- local NER;
- local OCR (scan detection remains mandatory and already exists);
- FHIR JSON;
- DICOM;
- layout-preserving source-PDF redaction/reconstruction;
- cryptographic/HMAC study IDs and encrypted reversible correspondence beyond the deterministic in-job Study ID contract;
- Cloudflare experimentation / dedicated-IP hosting resilience.

A safe generated PDF report/export **is** recovery; layout-preserving redaction of an uploaded PDF is not.

## 3. Fixed recovery train: 12 Work Orders

### REC-01 — SPANISH-ENGINE-ASSURANCE-01

**Goal:** prove the productive engine against realistic Spanish clinical text instead of treating the small V4 regression corpus as a quality grade.

**Owns**
- expand synthetic/no-PHI ground truth across every productive entity type and relevant subtype;
- Spanish accents/no accents, abbreviations, telegraphic charting, labels, punctuation and common clinical prose;
- names/surnames/compound names/professionals/family members;
- DNI/NIE/NUSS/NHC/CIP/SIP/TIS, Spanish phones, email/address/postal code;
- hospitals/centres/cities/barrios;
- numeric/textual dates, age vs duration, pediatric age, false-positive clinical measurements;
- quasi-identifiers and known negative/eponym contexts;
- precision/recall/F1/FNR per entity type and meaningful subtype slices;
- test-first bounded corrections to the existing Spanish recognizers when the benchmark exposes defects, without changing privacy doctrine.

**Acceptance**
- corpus is materially broad per entity type; no category is represented by a token single example and called “complete”;
- metrics report by type and fail on planted false negative / false positive;
- productive `createRegistryEngine()` is the evaluated engine;
- no English-oriented replacement engine is introduced;
- known gaps are explicit and recovery-blocking when they can leak PHI.

**Status — REC-01 COMPLETED (2026-10-04, C-084; PR #66; merged to `3.0-main@2e641aa54797e97d8019aa0821518b17a078fc42`).** The assurance instrument and the expanded synthetic/no-PHI corpus are delivered. `npm run check:privacy-eval:v4` runs green (28/28) on the productive `createRegistryEngine()`: 35 core + 4 adversarial cases; every top-level type has materially broad support (core annotations EDAD 22, IDENTIFICADOR 15, SOSPECHOSO 12, FECHA 8, UBICACION 7, NOMBRE 5) and reports precision 1 / recall 1 / FNR 0 / F1 1, with nonzero machine-visible support for every declared slice in `coverage.json`. Per-declared-slice precision/recall/FNR/F1 is reported from the reused metric definitions (no forked formulas, no slice threshold). The core thresholds remain `1 / 1 / 0` in `config.json` (unchanged). Committed falsation tests plus live, reverted manipulations prove the oracle can disagree on all three axes: a planted false negative fails recall/FNR, a planted false positive fails precision, and removing a required coverage slice — or narrowing a declared type/slice/style — fails the coverage oracle closed. The `901–903` cases stay report-only with explicit dispositions: `901` retains the age-vs-duration known gap (extra generalization, privacy-safe direction), `902` fails closed (no detection for `300 años`), and `903` detects the `1 año` span and bands it `0–9 años` (still a safe generalization); none is a recovery-blocking PHI leak under current authority. A sentence-initial singularity cue (`Único paciente`) is now measured after a bounded correction; the professional over-capture past an honorific (`Dr. Ramírez indica tratamiento`) stays a report-only known gap because the over-captured trailing words are load-bearing for the accepted low-confidence candidate contract. This closes the REC-01-owned `FUNC-003` / `QA-001` / `H-40` evidence only. REC-01 is canonical on `3.0-main`; this closes only its owned assurance scope and does **not** declare overall recovery complete.

**STOP:** a finding requires a new privacy semantics/NER architecture rather than a bounded recognizer correction.

---

### REC-02 — TEXT-POLICY-COMPLETION-01

**Goal:** finish the four-policy contract for pasted text, single documents and document batch.

**Owns**
- accepted per-category mappings for `external-ai` and `longitudinal-research` in the text/document engine;
- use the already-built date-role, date-generalize/date-shift and AGE operators deliberately;
- define how locations/quasi-identifiers/names/identifiers behave under each policy;
- preserve batch ProcessingContext consistency;
- factual, job-aware policy descriptions derived from the same authority; Spanish localization remains owned by REC-10.

**Acceptance**
- all four policies have explicit deterministic semantics for text/document/batch, or a policy is deliberately removed from those job kinds by an accepted product decision;
- External AI / Longitudinal are no longer merely “known but unmapped” accidental holes;
- date intervals/order are preserved where the accepted policy requires shifting;
- no fallback to Standard and no silent KEEP for unmapped categories.

**Status — REC-02 COMPLETED (2026-10-04, C-084; PR #68; merged to `3.0-main@4984040722f55062778b97e7351d2b8b43fe7ce7`).** The four accepted policies now resolve complete text/document/document-batch mappings in the single engine authority: `external-ai` maps `FECHA` to date generalization, `longitudinal-research` maps `FECHA` to one consistent Job-scoped date shift (seeded only from non-PHI Job identity) threaded through the single-document and batch product paths, and both use the stricter location/quasi branch while EDAD stays banded and direct identifiers stay redacted. Policy availability and guidance remain derived from the engine/structured authorities, so all four are selectable for every job kind and no UI copy claims External AI/Longitudinal text policies are unavailable. Canonical C-084 volume review returned no Standards or Spec findings. Final evidence on candidate `dbb7e85e542b3792052cf7b06d959a54fe54f52c`: focused V4 suite 178/178, `npm test` 1019/1019, `check:privacy-eval:v4` 28/28, typecheck/lint/format/build and Playwright `e2e/policy-guidance.spec.ts` 8/8 all green; PR #68 remote CI/CodeQL/E2E also passed before merge. This closes only the REC-02-owned rows and does **not** declare overall recovery complete. The REC-03 free-text-routing prerequisite is now satisfied; REC-03 itself remains separately unimplemented and is the next Work Order.

---

### REC-03 — STRUCTURED-SEMANTICS-RECOVERY-01

**Goal:** restore the structured-data semantic contract before adding formats/polish.

**Owns**
- authoritative patient-ID column becomes a deterministic Study ID in Safe structured output rather than being silently dropped;
- preserve longitudinal row linkage per patient;
- separate original patient ID ↔ Study ID correspondence into Confidential Audit;
- reconcile structured class→action semantics against the frozen UX/spec: Identifier, Quasi-Identifier, Sensitive, Insensitive, Unknown/Review Required;
- define/implement productive handling for non-date quasi-identifiers rather than `generalize` becoming an unsupported dead end;
- route configured free-text columns through the same text privacy engine/review semantics as specified; this work unit depends on REC-02 final text-policy mappings and must not invent its own policy semantics;
- keep UNKNOWN fail-closed;
- do not introduce HMAC/global cross-study identity semantics.

**Acceptance**
- a multi-row patient dataset exports a stable non-identifying Study ID that preserves linkage;
- the original patient identifier appears only in the Confidential artifact;
- no required structured class produces an accidental unsupported path without an explicit review/product decision;
- after REC-02 mappings are authoritative, free-text columns can actually be processed by that same policy-aware text engine when configured as such;
- longitudinal date/age behavior still passes T19 semantics.

**STOP:** resolving class→action mapping requires a privacy/product choice not supported by the frozen audits/specs.

**Status — REC-03 COMPLETED (2026-10-04, C-084 Go qualification; PR #70; merged to `3.0-main@c67d1aede36c41bb9ff1a52ae785e9ab969e1202`).** WU-A restored deterministic in-Job Study IDs with Safe `ID_ESTUDIO` + Confidential-only correspondence; WU-B established D-021 Class→Action authority with deterministic `QID_###` pseudonymization and bounded reviewer actions; WU-C routes configured structured free-text cells through the productive REC-02 text engine with shared `ProcessingContext`, per-cell ReviewSessions and policy/config invalidation; WU-D proved the composed `Configure → Review → Privacy Gate → Export` path together with T19 date semantics. Cora's mandatory integrated audit reran the exact final candidate `598c1f09eac6d3a546d9e1ef45c2873c84669bf3` and returned GO FOR PUBLICATION. This closes only the REC-03-owned recovery gaps and does **not** declare overall recovery complete.

**Qualification-return evidence (Go, recorded 2026-10-04):** cost policy `go`, risk class `complex`; no bound-model/provider fallback occurred. One canonical two-axis review against anchor `a75d5af5cc1f44b6112508bc5acbeaa92ccfc5f8` returned Spec `FAIL` (SPEC-1 major, SPEC-2 minor) and Standards `PASS_WITH_FINDINGS`; correction #1 closed the four authorized findings. The final candidate passed `test:v4` **67 files / 1108 tests**, `check:privacy-eval:v4` **28/28**, full `npm test`, typecheck/lint/format/build, and Playwright **11/11**; Cora independently reran the same gates before publication, and PR #70 remote validate/E2E/CodeQL checks were green before merge. Qualification observations remain evidence, not promotion: the Standards axis produced one verified false positive, the Spec axis found the highest-value cross-WU defects, and a second fresh corrector was used only for docs-only qualification-evidence refresh after the technical finding envelope was already closed — a procedural deviation to reconcile in Atenea, not a product defect. No claim of Go quality equivalence to Standard Volume is made.

---

### REC-04 — STRUCTURED-IO-OUTPUT-PARITY-01

**Goal:** recover the useful structured ingestion/export ergonomics that were lost while keeping V4 semantics.

**Owns**
- recover the v3 Excel/workbook hospital-export header-row detection (or explicit user selection) when explanatory rows precede headers; do not claim this as lost CSV heritage because v3 CSV already used the first row;
- keep explicit multi-sheet selection;
- Safe XLSX export from the V4 transformed dataset;
- separate Confidential XLSX correspondence export with an additional deliberate-download confirmation because it is identifiable;
- preserve CSV as an additional Safe format;
- product decision and recovery for configurable Study-ID prefix and optional sequential `Visita_Num`;
- useful factual structured summary such as unique patients / visit counts where derivable without privacy claims.

**Acceptance**
- workbook with explanatory metadata rows reaches correct headers without silently treating metadata as schema;
- CSV/XLS/XLSX safe output preserves rows, blanks and typed values where practical;
- Safe XLSX contains no original confidential correspondence;
- Confidential XLSX is unmistakably separate, contains the authorized mapping only, and cannot download without the additional deliberate confirmation;
- round-trip/export fixtures are synthetic and adversarial.

**Status — REC-04 COMPLETED (2026-10-05, C-084 Go qualification; PR #72; merged to `3.0-main@7f7de6b5bf4c0692850b4e3c5de6987bcdef18f0`).** WU-A restored the bounded workbook header-row authority with typed `header-row-required` explicit selection; WU-B added the job-scoped Study-ID prefix plus optional row-order `Visita_Num`, typed Safe scalars and the factual summary; WU-C added browser-local Safe/Confidential XLSX serializers and the structured Confidential deliberate-confirmation interaction; WU-D proved the composed hospital-workbook journey (header detection → Configure options → existing Review/Gate → CSV/XLSX Export) with focused Vitest and Playwright oracles and no new workflow step/route/class/mode. Cora integrated audit found one additional Safe-XLSX async stale-state/TOCTOU defect after the canonical review; the bounded `CORA-AUDIT-REC04-01` correction `ef6b0ec05c53f142344b942fcd04196a0088b60d` added post-`await` Job/preparation/readiness revalidation and planted red→green oracles. The corrected candidate passed 1213/1213 V4 tests, privacy-eval 28/28, 13/13 structured/policy Playwright tests, typecheck/lint/format/build and Cora re-audit; PR #72 remote validate/E2E/CodeQL checks were green before merge. This closes `H-21`, `H-25`, `H-26`, `H-27`, `H-28`, `H-29` and the structured slice of `H-42`; after REC-05 canonicalization, the global `H-42` blocker remains open only for REC-07 batch Confidential output. This is Go qualification evidence only and does **not** claim quality equivalence to Standard Volume or overall recovery completion.

---

### Product-design reconciliation overlay — effective for REC-05→REC-11

Before REC-05 execution, the human product layer was independently re-audited and reconciled. `docs/HUMAN_PRODUCT_DESIGN_AUTHORITY_V1.md` is now binding for every user-facing recovery ticket.

The recovery IDs remain unchanged for traceability; this is **not** a new parallel train. However, REC-05→REC-11 may no longer be executed literally from their pre-reconciliation UI implications.

Cross-cutting rules effective immediately:

- the former universal `Input → Configure → Review → Privacy Gate → Export` presentation is not product authority;
- no visible no-op phase;
- Spanish human vocabulary applies to every newly built/reworked surface from now on, while REC-10 retains exhaustive localization closeout;
- task prominence, density and visual hierarchy apply to every newly built/reworked surface from now on, while REC-11 retains exhaustive visual-system closeout;
- realistic-density rendered/task evidence is required for interaction claims;
- unresolved layout mechanics are tested in the real product on bounded branches by default, not by creating a separate mini-application train;
- any apparent need to weaken accepted privacy/domain/security semantics is a HUMAN STOP.

The REC-05 handoff prepared before this reconciliation is retired as execution authority. It stopped before WU-A with zero product mutation; a fresh handoff/review anchor is required.

---

### REC-05 — SINGLE-OUTPUT-PARITY-01

**Reshaped goal:** restore useful text/single-document output capabilities inside the accepted human **Result** model, on top of canonical reviewed state.

**Owns**
- canonical `Copiar resultado preparado` capability derived exclusively from Safe Output;
- Safe TXT;
- Safe DOCX if retained from accepted target capability;
- Safe generated PDF output/report;
- separate Confidential Audit download/report with an additional deliberate-download confirmation;
- human Result states driven by existing authority: ready / needs attention / blocked, with factual warnings;
- contextual output hierarchy: copy may be primary for pasted text, while document-oriented work may prioritize the useful document download;
- Spanish file names and user-facing copy for this reworked surface;
- visual asymmetry between prepared/shareable Result and identifiable Confidential Audit.

**Must not**
- turn Copy/TXT/DOCX/PDF/Confidential into five equal-weight actions merely because five capabilities exist;
- require the user to understand `Safe Output`, serializer architecture or `Privacy Gate` as internal concepts;
- merge original↔replacement mapping/reviewer notes into Safe formats;
- claim layout-preserving redaction of uploaded PDFs.

**Acceptance**
- copy/TXT/DOCX/PDF derive byte-semantically from canonical final reviewed state;
- pending review blocks every Safe format;
- planted original↔replacement mapping/reviewer notes cannot cross into Safe files;
- Confidential Audit requires a distinct deliberate confirmation immediately before download;
- a deliberately kept original behaves exactly as ReviewSession says and remains a factual warning in Result;
- PDF recovery does not claim source-layout preservation;
- the Result surface makes readiness, remaining attention and the appropriate next action understandable without requiring `Privacy Gate` vocabulary;
- the primary output action is justified by the material/use rather than globally hard-coded to Copy;
- Safe and Confidential pass `G-HP8`/`G-HP9` from the Human Product Design Authority.

**Status — REC-05 COMPLETED (2026-10-06; PR #76; merged to `3.0-main@96e53ee9f390026eff2ff44cb405634517ffbe09`).** The reshaped REC-05 landed WU-A→WU-D (Safe DOCX/PDF/clipboard primitives; single-item Result; direct Review→Result transition without a new flow destination; deliberate single-item Confidential confirmation; composed rendered journeys + friction measurement). Audited product candidate `6748379ea5e73f9b30cebb5867264e4bb6342971` passed Cora integrated candidate audit **GO** with no correction #2: focused Vitest 224/224, focused Playwright 19/19, privacy-eval 28/28, typecheck/lint/format/build/full `npm test` and `git diff --check` all pass. Production `npm audit --omit=dev` remained identical to the fixed-anchor baseline at 12 findings (1 low, 10 high, 1 critical), so REC-05 introduced no new unresolved production vulnerability. PR #76 remote validate/E2E/CodeQL checks were green before merge. This closes `H-11`, `H-12` and the single text/document slice of `H-42`; global `H-42` remains OPEN only for the batch Confidential output owned by REC-07.

---

### REC-06 — BATCH-WORKFLOW-PARITY-01

**Reshaped goal:** finish batch as a professional multi-document work queue with local recovery, not only a correct state machine.

**Owns**
- explicit retry action for retryable failed items;
- remove/dispose-from-batch action with clear consequences;
- explicit failure/error acknowledgement where appropriate;
- process/review-required/completed/error actions/states that match domain authority;
- clear shared-consistency fact/control if product choice allows disabling it;
- preserve per-document ReviewSession and failure visibility;
- attention-oriented batch navigation: pending / error / ready facts remain easy to locate at realistic batch size;
- Spanish human-language status/action copy on reworked batch surfaces.

**Acceptance**
- a failed item can be acted upon without starting a new entire job;
- removing/retrying cannot fabricate completion or lose unrelated document decisions;
- selecting/navigating documents never fabricates review completion;
- every state/action is keyboard/touch accessible and factual;
- the same authoritative batch item state drives Result readiness;
- a synthetic batch with multiple documents including at least one local read/process failure remains orientable and recoverable without destroying unrelated successful work;
- the ordinary user need not understand `ProcessingContext` to benefit from cross-document consistency.

---

### REC-07 — BATCH-OUTPUT-PARITY-01

**Reshaped goal:** recover useful batch **Result** deliverables safely and coherently with the single-result model.

**Owns**
- batch prepared-result contract after every required item is completed and failures resolved/explicitly disposed;
- consolidated safe PDF where useful;
- individual safe outputs packaged as ZIP;
- batch summary CSV (or a deliberately accepted safer/more useful equivalent);
- separate batch Confidential Audit/correspondence artifact with the same deliberate-download confirmation contract;
- compose the single-document safe output primitives established by REC-05 instead of creating a second serializer authority;
- deterministic naming/indexing and explicit handling of removed/failed items;
- human output hierarchy appropriate to batch work rather than copying the single-text layout mechanically.

**Acceptance**
- no batch-wide artifact is fabricated while any mandatory review/failure blocker remains;
- individual/consolidated Safe outputs contain only canonical reviewed safe content;
- Confidential mapping never leaks into individual/consolidated Safe PDF/ZIP/summary;
- Confidential batch artifacts require a distinct deliberate confirmation;
- output manifest accounts for every original batch item;
- Result communicates ready / needs attention / blocked from authoritative batch state;
- the user can understand which batch deliverable is the normal next action without treating Confidential Audit as an equivalent format choice.

---

### REC-08 — INPUT-PRODUCTIVITY-PARITY-01

**Reshaped goal:** make starting work direct and human, recovering useful input conveniences while keeping routing deterministic/fail-closed underneath.

**Owns**
- Spanish synthetic preloaded examples (Urgencias, Quirúrgico, Historia Clínica or improved equivalents);
- explicit `Pegar` clipboard convenience with graceful fallback to Ctrl+V;
- clear drag/drop/select-file affordance and concise format help;
- preserve automatic input-family inference and fail-closed format handling;
- remove permanent ordinary-path explanation of internal job routing when the product has already inferred it safely;
- human-purpose/intended-use wording for policy selection only where it maps unambiguously to the canonical policy authority;
- close the frozen UX requirement that inference “allow override when necessary”: either define a bounded legitimate override without weakening fail-closed authority, or record an explicit `DELIBERATELY_SUPERSEDED` decision;
- never reintroduce false `.doc` support.

**Acceptance**
- one action loads each synthetic example without PHI;
- Paste never sends content anywhere and handles denied clipboard permission cleanly;
- example/paste/file pathways converge on the same Job creation authority;
- the ordinary start state prioritizes adding information rather than teaching `Text job / Document job / Structured job / Batch` routing;
- pipeline override is either a tested bounded capability or explicitly superseded with rationale;
- mixed/unsupported selections fail with actionable Spanish explanation rather than silent guessing.

---

### REC-09 — APP-IA-REVIEW-PRODUCTIVITY-01

**Reshaped goal:** finish dynamic human IA and Review productivity without making domain phases, metrics or technical anchors the product.

**Owns**
- remove the universal-stepper assumption and any visible no-op Configure/Review destination from ordinary journeys;
- a quiet application shell in which the current task outranks persistent metadata/help;
- Policies/Help remain discoverable without repeating full policy documentation below every operational surface;
- high-volume Review interaction: content/current decision/remaining work dominate; exact pane count is not frozen;
- efficient next/previous attention flow and correction/undo behavior;
- evaluate explicit grouped/bulk confirmation only if useful, with scope clarity, no silent acceptance and appropriate treatment of low-confidence/exceptional items;
- `Keep original` safety affordance: direct identifiers require contextual explanation/confirmation before the original remains in prepared output;
- manual missed-entity marking through text selection + human category/confirmation; source offsets remain internal and never become an ordinary form field;
- reshape Structured Configure into the accepted comparative column × interpretation/treatment/state workspace while preserving REC-03/04 semantics; effective treatment and blockers remain visible, with evidence/confidence/override detail contextual;
- remove the no-op Structured Review destination when no free-text cell review exists; free-text cell review remains a concrete subtask when it does exist;
- shortcut discovery/help and disablement while typing/editing where shortcuts are retained;
- no PHI-bearing job history.

**Acceptance**
- every visible destination/phase has a distinct human purpose;
- no ordinary text/document path must visit a screen that says no configuration is required;
- no structured path must visit an empty/no-op Review surface merely for pipeline symmetry;
- manual marking can be completed without entering offsets or other internal representation details;
- a direct identifier cannot be kept original through ordinary Review without the contextual confirmation/explanation;
- a realistic synthetic document with dozens of detections remains navigable/reviewable without turning the default UI into a metrics dashboard;
- a realistic synthetic structured dataset with dozens of columns remains scannable/comparable without a repeated-card wall, while current Study-ID/class→action/date/free-text semantics remain unchanged;
- any grouped/bulk review remains explicit, correctable and incapable of silently accepting low-confidence/exceptional work;
- representative decisions can be revisited/corrected without losing unrelated accepted decisions;
- rendered/task evidence satisfies `G-HP1` through `G-HP7` as applicable.

---

### REC-10 — SPANISH-LOCALIZATION-01

**Reshaped goal:** enforce Spanish human language as a foundation for every newly touched user surface and close the remaining product localization end-to-end once surfaces stabilize.

**Foundation effective immediately**
- all newly built/reworked ordinary UI uses Spanish professional/user language;
- user-facing terms describe intent (`Resultado preparado`, `Necesita revisión`, `Mantener original`, etc.) rather than internal enums/classes;
- policy/use wording remains factual and derived from canonical semantics;
- internal IDs/status enums need not be translated when not user-facing.

**Closeout owns**
- all remaining visible app copy, buttons, headings, status labels, empty states, policy guidance and actionable errors;
- `aria-label`/accessible names and screen-reader text;
- generated Safe/Confidential artifact labels where user-facing;
- filenames where appropriate;
- terminology consistent with seudonimización/preparación, never unsupported anonymity/compliance claims;
- `lang="es"` matching actual content.

**Acceptance**
- no ordinary production UI surface is English except unavoidable technical/file vocabulary deliberately retained;
- tests/E2E assert Spanish user-facing contract without translating invisible internal IDs/status enums;
- error/remedy text is actionable Spanish;
- a healthcare professional can complete representative ordinary journeys without translating internal product terminology mentally.

---

### REC-11 — VISUAL-SYSTEM-RECOVERY-01

**Reshaped goal:** enforce functional hierarchy/density from the next user-facing change onward and close with one coherent professional clinical privacy workstation.

**Foundation effective immediately**
- primary human task must visually dominate documentation/evidence/chrome;
- avoid equal-weight card walls when comparison/scanning is the work;
- professional desktop density is intentional; more whitespace is not automatically better;
- state, pending/success/failure and destructive/sensitive actions are visually distinguishable without color-only meaning;
- Safe/prepared Result and Confidential Audit are deliberately asymmetric;
- current rose/warm-surface identity may be reused, but branding never outranks operational clarity.

**Closeout owns**
- formal V4 design tokens/components using accepted product identity;
- warm stone/rose Sophilux identity with darker accessible operational rose where retained;
- Inter operational typography; mono only where technical values genuinely benefit; Cormorant only as restrained brand accent if retained;
- professional density and hierarchy across Input/Review/Structured/Batch/Result;
- consistent semantic states: success, needs review, blocking, info, neutral;
- responsive/mobile/tablet behavior remains functional while desktop remains the primary professional surface;
- visual regression/reference evidence for main states.

**Acceptance**
- text/document/batch/structured unmistakably look like one finished application;
- no reintroduction of giant marketing cards/heroes inside clinical workflow;
- WCAG contrast/focus and no-color-only status remain green;
- screenshots/reference states are acceptance evidence;
- realistic-density review/structured/batch surfaces remain legible and task-oriented rather than degenerating into repeated equivalent cards or long explanatory documents;
- user-facing actions provide perceptible pending/success/failure feedback where latency exists.

---

### REC-12 — RECOVERY-CLOSEOUT-01

**Goal:** prove that recovery is complete against the original product + frozen audit, then repair governance/documentation so the same drift cannot recur.

**Owns**
- run a **source-to-matrix completeness oracle first**: re-read both frozen September audits plus material v3 product heritage and prove every material source obligation is represented by a traceability row or explicit `DELIBERATELY_SUPERSEDED` decision;
- rerun the full 88-row frozen debt/audit matrix against the final candidate;
- rerun the 42-row heritage/target matrix (or the then-current explicitly reconciled count; fixed row count alone is never proof of completeness);
- feature-by-feature E2E parity for language, actions, formats, structured linkage and batch outputs, including direct-identifier `Keep original` confirmation and deliberate Confidential Audit download confirmation;
- visual reference pass for canonical states at desktop/tablet/mobile;
- full Spanish engine quality gate from REC-01;
- reconcile `DEBT_REGISTER.md` and `ROADMAP.md` from evidence rather than stale status labels;
- update specs/README/technical documentation to the actual product;
- make GitHub canonical/default branch authority unambiguous;
- enable/document branch protection/required checks where permissions permit;
- make CI run the authoritative complete deterministic gate (or make one authoritative CI command if the current `npm test` contract is deliberately replaced);
- remote Render smoke after publication.

**Acceptance**
Recovery may be declared complete only when every matrix row is one of:
1. **PRESERVED/RESOLVED/IMPROVED**, or
2. **DELIBERATELY SUPERSEDED** with an explicit product/privacy decision and evidence.

No material source obligation may be silently absent from the matrix, no matrix row may be silently absent from closeout, and “workflow exists” is not sufficient evidence for output-format, language, visual or feature parity.

## 4. Completeness and execution sequencing

### 4.1 Source → obligation → owner completeness

Before any remaining Work Order becomes `READY_TO_LAUNCH`, its shaping must be checked against all four current source layers:

| Source layer | Traceability location | Rule |
|---|---|---|
| Frozen privacy/functional/code audit | Matrix §A (88 frozen rows) | No blocker or owned follow-up may disappear because product design changed. |
| V3 heritage + frozen September UX/product audit | Matrix §B (`H-01…H-42` plus UX rows in §A) | Preserve useful capability or record an explicit later accepted supersession. |
| 2026-10-05 product-design reconciliation | Matrix §C (`PDR-01…PDR-12`) | Every accepted human-product obligation must have an owner and evidence rule. |
| Protected domain/privacy decisions | `CURRENT_DECISIONS.md` + HPD §2 | Human-product work may change representation, not silently weaken semantics. |

An accepted obligation with **no owner**, an owner outside the dependency graph, or a conflict between two owners is a **HUMAN STOP before implementation**.

### 4.2 Recommended serial order

For this project, prefer the following serial order unless there is a concrete reason to parallelize. This minimizes shared-surface churn and makes each composed-product checkpoint legible:

1. **Publish/audit/merge this product-design reconciliation.** No remaining user-facing REC launches from branch-local authority.
2. **REC-05 — Single Result/output parity.** Establish the single text/document Result model and reusable safe output primitives.
3. **REC-06 — Batch workflow/recovery parity.** Complete the batch work queue and local recovery.
4. **REC-07 — Batch Result/output parity.** Hard-blocked by both REC-05 and REC-06.
5. **REC-08 — Human input/productivity parity.** Technically independent of 05–07, but serial execution is preferred to avoid simultaneous shell/job-flow churn.
6. **REC-09 — Dynamic IA + Review + Structured interaction productivity.** Composition pass after the capabilities above exist; owns no-op removal, shell/policy simplification, high-volume Review, manual marking without offsets and the Structured comparative workspace.
7. **REC-10 — Spanish localization closeout.** Spanish foundation already applies to every earlier touched surface; this closes all remaining language gaps.
8. **REC-11 — Visual-system closeout.** Visual hierarchy foundation already applies earlier; this closes coherence, density, responsive and visual regression.
9. **REC-12 — Recovery closeout/governance.** Final source→matrix completeness, composed human journeys, technical gates and publication smoke.

Hard dependency edges are narrower than this recommended serial order: REC-07 requires REC-05 + REC-06; REC-09 should not close until REC-05→08 capabilities it composes are present; REC-10/11 closeouts follow the stable post-REC-09 surfaces; REC-12 requires every recovery blocker/accepted PDR obligation to be resolved or deliberately superseded with evidence. REC-06 and REC-08 could technically start earlier, but parallelism is not the default.

### 4.3 Launch gate for each remaining REC

A remaining REC is launchable only when:

1. its prerequisite REC edges above are satisfied;
2. every matrix row / PDR obligation it owns is quoted or linked in the handoff;
3. the handoff states which HPD gates are applicable and what realistic-density witness can falsify them;
4. touched older specs/decisions are classified as `PRESERVED`, `SUPERSEDED FOR PRESENTATION`, or `HUMAN STOP` rather than silently inherited;
5. Spanish and baseline visual hierarchy requirements are included for any touched user-facing surface;
6. the branch/review anchor is fresh from the current canonical base.

## 5. Dependency graph

```text
REC-01 Spanish engine assurance
   └──> REC-02 Text policy completion
            └──> REC-03 free-text routing work unit

REC-03 core Study-ID / structured class semantics
   └──> REC-04 Structured I/O + output parity

HUMAN_PRODUCT_DESIGN_AUTHORITY_V1 (effective across all remaining UI work)

REC-05 Single Result/output parity ─────────┐
                                            ├──> REC-07 Batch Result/output parity
REC-06 Batch workflow/recovery parity ──────┘

REC-08 Human input/productivity parity
REC-09 Dynamic IA + Review productivity

REC-10 Spanish foundation ───────── effective from first reworked surface
REC-11 Visual hierarchy foundation ─ effective from first reworked surface

REC-05 + REC-06 + REC-07 + REC-08 + REC-09
                 └──────────────────────────┐
                                            v
                          REC-10 localization closeout
                                            v
                          REC-11 visual-system closeout
                                            v
                          REC-12 recovery closeout + governance
```

REC-01 through REC-05 are complete. REC-07 now has its REC-05 safe single-output dependency satisfied and waits on REC-06 batch workflow authority. Before any remaining frontier is executable, the coarse post-reconciliation REC-06→REC-12 plan must be decomposed under C-085 through Matt `/to-tickets` into reviewable tracer-bullet units that fit one fresh writer context; the proposal is reviewed before any ticket becomes execution authority. REC-08 and REC-09 may be scheduled where their touched authorities do not collide with the active Work Order. REC-10/REC-11 no longer mean “ignore language/visual hierarchy until the end”: their **foundations apply immediately** to every surface touched from REC-05 onward, while their exhaustive closeouts remain late so transient surfaces are not polished twice.

## 6. Fixed authorities that survive recovery

Unless a recovery Work Order explicitly supersedes them with an accepted decision, preserve:

- local-first / zero unexpected network runtime;
- memory-only sensitive Job state by default;
- ReviewSession as the review authority;
- source offsets as canonical, never rendered DOM;
- Safe Output / Confidential Audit physical and semantic separation;
- fail-closed incomplete review, extraction failure, oversized input and unknown structured classification;
- low-confidence candidates visible and reviewable;
- no unsupported anonymity/GDPR/certification claims;
- registry/operator separation and current Spanish recognizer/dictionary corpus as the starting engine;
- ProcessingContext for cross-document/longitudinal state;
- Web Worker production boundary;
- explicit sheet selection and robust Excel date/null behavior;
- responsive/accessibility improvements already landed.

## 7. How ticket count is interpreted

The **known recovery plan is 12 Work Orders**. REC-01 owns benchmark-driven bounded recognizer corrections so routine Spanish-engine findings do not create an open-ended stream of microtickets. If REC-01 discovers a defect that requires a new privacy doctrine, external NER architecture or another change outside the frozen authority, that is a real HUMAN STOP and must be shaped separately rather than hidden inside the count.

Future capability rows remain outside these twelve by design.
