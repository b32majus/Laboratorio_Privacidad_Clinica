# Recovery Master Plan — Laboratorio de Privacidad Clínica

> Status: **MASTER RECOVERY PLAN — shaped from traceability audit, not yet execution-authorized**
> Date: 2026-10-04
> Original product reference: `3.0-main@331bcaf4a624659c77823a0c4b427d46347ea104`
> Frozen pre-refactor authority: `e164ca2`
> Current V4 reference at shaping: `3.0-main@6fb5eb1fb867e022acc68dd2be39b16bd531f27a`
> Companion matrix: `docs/audits/2026-10-recovery-traceability-matrix.md`

## 1. Recovery doctrine

Recovery does **not** mean reverting to v3. The V4 platform is retained: ReviewSession, RegistryEngine, ProcessingContext, fail-closed behavior, Safe Output / Confidential Audit separation, low-confidence review, Privacy Gate, structured hardening, Web Worker, local-only runtime, Vite/React/TypeScript and the deterministic test/CI foundation.

Recovery means restoring or deliberately replacing the product capabilities and product contract that were lost when “parity” was reduced to workflow existence. No legacy behavior is copied back when the audit identified it as unsafe. The useful capability is recovered on top of the V4 safety/domain model.

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

---

### REC-05 — SINGLE-OUTPUT-PARITY-01

**Goal:** restore useful text/single-document output actions on top of canonical reviewed state.

**Owns**
- `Copiar texto preparado` / clipboard action derived exclusively from Safe Output;
- retain Safe TXT;
- Safe DOCX if retained from the accepted target capability;
- Safe generated PDF report/export;
- separate Confidential Audit download/report with an additional deliberate-download confirmation; originals/mappings must never appear in Safe formats merely because the old jsPDF report did;
- Spanish file names/copy and content-zone distinction.

**Acceptance**
- copy/TXT/DOCX/PDF all derive byte-semantically from canonical final reviewed state;
- pending review blocks every Safe format;
- planted original↔replacement mapping/reviewer notes cannot cross into Safe files;
- Confidential Audit requires a distinct deliberate confirmation immediately before download;
- a deliberately kept original behaves exactly as ReviewSession says and remains warned at Gate;
- PDF recovery does not claim layout-preserving redaction of source PDFs.

---

### REC-06 — BATCH-WORKFLOW-PARITY-01

**Goal:** finish batch as a usable professional workflow, not only a correct state machine.

**Owns**
- explicit retry action for retryable failed items;
- remove-from-batch action with clear consequences;
- explicit failure/error acknowledgement where appropriate;
- process/review-required/completed/error actions/states that match the domain authority;
- clear shared-consistency fact/control if product choice allows disabling it;
- preserve per-document ReviewSession and failure visibility.

**Acceptance**
- failed item can be acted upon without starting a new entire job;
- removing/retrying cannot fabricate completion or lose unrelated document decisions;
- every state/action is keyboard/touch accessible and factual;
- batch Gate uses the same authoritative item state.

---

### REC-07 — BATCH-OUTPUT-PARITY-01

**Goal:** recover batch deliverables safely.

**Owns**
- batch Safe Output contract after every required item is completed and failures resolved/explicitly disposed;
- consolidated safe PDF where useful;
- individual safe outputs packaged as ZIP;
- batch summary CSV (or a deliberately accepted safer equivalent);
- separate batch Confidential Audit/correspondence artifact with the same deliberate-download confirmation contract as other Confidential outputs;
- compose the safe single-document output primitives established by REC-05 instead of creating a second PDF/document serialization authority;
- deterministic naming/indexing and explicit handling of removed/failed items.

**Acceptance**
- no batch-wide artifact is fabricated while any mandatory review/failure blocker remains;
- individual/consolidated Safe outputs contain only canonical reviewed safe content;
- Confidential mapping never leaks into individual/consolidated Safe PDF/ZIP/summary;
- Confidential batch artifacts require a distinct deliberate confirmation;
- output manifest accounts for every original batch item.

---

### REC-08 — INPUT-PRODUCTIVITY-PARITY-01

**Goal:** recover low-risk input conveniences that made the original practical.

**Owns**
- Spanish synthetic preloaded examples (Urgencias, Quirúrgico, Historia Clínica or improved equivalents);
- explicit `Pegar` clipboard convenience with graceful fallback to Ctrl+V;
- clearer drag/drop/select-file affordance and format explanation;
- preserve automatic Job inference and fail-closed format handling;
- close the frozen UX requirement that inference “allow override when necessary”: either define a bounded legitimate override without weakening fail-closed format authority, or record an explicit `DELIBERATELY_SUPERSEDED` decision explaining why deterministic/fail-closed routing replaces it;
- never reintroduce false `.doc` support.

**Acceptance**
- one action loads each synthetic example without PHI;
- Paste never sends content anywhere and handles denied clipboard permission cleanly;
- example/paste/file pathways converge on the same Job creation authority;
- pipeline override is not allowed to disappear silently: the accepted outcome is either tested bounded override or explicit `DELIBERATELY_SUPERSEDED` evidence.

---

### REC-09 — APP-IA-REVIEW-PRODUCTIVITY-01

**Goal:** finish the application information architecture and expert review productivity promised by the UX audit.

**Owns**
- minimal app IA: New Job / Workspace / Policies / Help, or a documented equivalent that preserves those functions;
- dedicated Policies/Help content without duplicating policy-engine authority;
- review shortcuts: Accept, Modify, Keep original, manual mark, next/previous pending (candidate vocabulary from frozen audit: A/M/K/F + J/K or arrows, subject to collision-safe implementation);
- `Keep original` safety affordance from frozen UX-10: when the entity is a direct identifier, require contextual confirmation and explain before the decision that the original will remain in Safe Output;
- shortcut discovery/help and disablement while typing/editing;
- no PHI-bearing job history.

**Acceptance**
- every IA destination has a distinct useful purpose;
- shortcuts mutate only ReviewSession and are impossible while focus is in an editable field where they would conflict;
- keyboard workflow can move through pending review without hidden state changes;
- a direct identifier cannot be kept original through the ordinary Review UI without the contextual confirmation/explanation; REC-12 has an explicit E2E for this path.

---

### REC-10 — SPANISH-LOCALIZATION-01

**Goal:** make the clinical product Spanish end-to-end without altering engine/domain semantics.

**Owns**
- all visible app copy, buttons, headings, status labels, empty states, policy guidance and actionable errors;
- `aria-label`/accessible names and screen-reader text;
- generated Safe/Confidential artifact labels where user-facing;
- filenames where appropriate;
- terminology consistent with seudonimización/preparación, never unsupported anonymity/compliance claims;
- `lang="es"` must match actual content.

**Acceptance**
- no ordinary production UI surface is English except unavoidable technical/file vocabulary deliberately retained;
- tests/E2E assert Spanish user-facing contract without translating internal IDs/status enums;
- error/remedy text is actionable Spanish.

---

### REC-11 — VISUAL-SYSTEM-RECOVERY-01

**Goal:** deliver the visual product defined by the UX audit: a professional clinical privacy workstation with Sophilux identity, not a legacy microsite and not a generic neutral scaffold.

**Owns**
- formal V4 design tokens/components using the already-preserved rose/primary/surface primitives;
- warm stone/rose Sophilux identity with darker accessible operational rose;
- Inter operational typography; JetBrains Mono (or explicitly accepted equivalent) for technical IDs/values; Cormorant only as restrained brand accent if retained;
- professional density and hierarchy for Review/Structured/Batch/Gate/Export;
- consistent states: success emerald, needs-review amber, blocking red, info blue, neutral stone/slate;
- responsive/mobile/tablet behavior must remain functional;
- visual regression/reference evidence for the main states.

**Acceptance**
- text/document/batch/structured unmistakably look like one finished application;
- no reintroduction of giant marketing cards/heroes inside clinical workflow;
- WCAG contrast/focus and no-color-only status remain green;
- screenshots/reference states are part of acceptance, so visual identity cannot disappear from future “parity” definitions.

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

## 4. Dependency graph

```text
REC-01 Spanish engine assurance
   └──> REC-02 Text policy completion
            └──> REC-03 free-text routing work unit

REC-03 core Study-ID / structured class semantics
   └──> REC-04 Structured I/O + output parity

REC-05 Single text/document output parity ─┐
                                           ├──> REC-07 Batch output parity
REC-06 Batch workflow parity ──────────────┘

REC-08 Input productivity parity

REC-02 + REC-03 + REC-04 + REC-05 + REC-06 + REC-07 + REC-08
                         └───────────────┐
                                         v
                         REC-09 App IA/review productivity
                                         v
                         REC-10 Spanish localization
                                         v
                         REC-11 Visual system recovery
                                         v
                         REC-12 Recovery closeout + governance
```

REC-01 should begin first. After it, REC-02, REC-03 core Study-ID/class work, REC-05 and REC-06 may progress in parallel when Work Unit boundaries do not touch the same authority. The REC-03 free-text routing work unit waits for REC-02 final mappings. REC-07 waits for both REC-05 safe single-output primitives and REC-06 batch workflow authority. REC-10 and REC-11 intentionally come late so we do not translate/style transient surfaces twice.

## 5. Fixed authorities that survive recovery

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

## 6. How ticket count is interpreted

The **known recovery plan is 12 Work Orders**. REC-01 owns benchmark-driven bounded recognizer corrections so routine Spanish-engine findings do not create an open-ended stream of microtickets. If REC-01 discovers a defect that requires a new privacy doctrine, external NER architecture or another change outside the frozen authority, that is a real HUMAN STOP and must be shaped separately rather than hidden inside the count.

Future capability rows remain outside these twelve by design.
