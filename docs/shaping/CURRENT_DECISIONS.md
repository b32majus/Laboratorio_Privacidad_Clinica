# V4 Current decisions

Status: **ACCEPTED FOR SHAPING / EXECUTION PACKAGING**
Accepted: 2026-09-20

This file records product/architecture decisions already resolved. Workers must not reopen them unless a later accepted decision supersedes them.

## D-001 — Product shape

The Laboratorio becomes a single professional application/workspace, not a set of navigated microsite pages.

**Decision**
SPA/app shell with one continuous job flow:
`Input → Configure → Review → Privacy Gate → Export`.

**2026-10-05 presentation amendment:** D-023 supersedes this sequence as mandatory visible product topology. The single-SPA / one-Job architectural decision survives; the five named phases may remain internal/domain pipeline states and appear visibly only where there is real human work.

## D-002 — Frontend stack

**Decision**
Vite + TypeScript + React + compiled Tailwind.

**Explicit exclusions**
No Next.js, SSR, backend application server, or remote PHI-processing API.

## D-003 — Migration strategy

**Decision**
Incremental brownfield migration.

Existing core behavior is wrapped behind adapters and regression tests first. No big-bang rewrite.

Historical migration condition: legacy remained available until T25 retirement criteria passed. T25 is complete; legacy is no longer a runtime fallback. D-018 clarifies that those retirement criteria established workflow/security replacement, not full product parity.

## D-004 — Review authority

**Decision**
Review state must live in a domain model (`ReviewSession` / `ReviewDecision`), not DOM datasets/spans.

Final output is derived from original source + detections + decisions.

Export is unavailable while mandatory review is incomplete.

## D-005 — Output model

**Decision**
Safe Output and Confidential Audit are physically and semantically separate.

A safe artifact never includes correspondence/originals for traceability.

## D-006 — Privacy terminology

**Decision**
Prefer "preparado" / "seudonimizado" where applicable.

Do not claim anonymity, k-anonymity, differential privacy, GDPR/LOPDGDD compliance, or certification unless implemented and evidenced.

## D-007 — Privacy policies

**Decision**
Replace opaque "strict mode" product semantics with explicit Privacy Policies. Initial policy vocabulary:
- Standard;
- External AI;
- Longitudinal Research;
- Strict.

Exact per-category operator mappings are defined by implementation specs/tickets, not invented by UI code.

## D-008 — Low-confidence behavior

**Decision**
Low-confidence candidates remain visible and reviewable. Confidence influences workflow, not invisibility.

## D-009 — Fail-closed behavior

**Decision**
Unknown/ambiguous privacy classifications, oversized inputs, extraction failures, and incomplete mandatory review fail explicitly.

Structured UNKNOWN does not default to KEEP.

## D-010 — Dates and ages

**Decision**
AGE becomes a first-class recognized type.

Date behavior is policy-driven. Preserve longitudinal meaning where required; consistent date shifting is a target capability rather than treating every date as "Visit N".

## D-011 — Batch

**Decision**
Batch is a normal capability of a Job, not a "Premium" separate app.

Failed files remain part of batch state.

Cross-document consistency must use an explicit shared processing context, not monkey-patching globals.

## D-012 — Structured data

**Decision**
Structured data uses one app shell and one privacy classification model.

Target classes:
- Identifier;
- Quasi-Identifier;
- Sensitive;
- Insensitive;
- Unknown/Review Required.

## D-013 — Sensitive persistence

**Decision**
Sensitive Job data defaults to memory only.

Any future local recovery/persistence is a separate opt-in design with expiry/clear semantics.

## D-014 — Clinical origin

**Decision**
Marketing/docs and clinical app use separate origins.

Clinical origin: zero third-party runtime, no analytics, no remote fonts/images, no unexpected outbound network.

## D-015 — Hosting

**Decision**
Render Static is the initial managed target.

Cloudflare is experimental only until a real availability test from Spain during LaLiga windows demonstrates acceptable behavior. Other multi-tenant providers are not presumed immune.

Dedicated IP/VPS remains future resilience fallback.

## D-016 — Execution model

**Decision**
Work is packaged as accepted specs + GitHub Issues/Work Orders and executed through current Atenea C-084: native OpenCode V2, project-local role/model bindings and upstream Matt skills for implementation/task-graph/code-review methodology.

The ordinary train is visible: Herdr is the already-running user-owned persistent surface, the operator enters the project/worktree pane and starts the OpenCode V2 TUI with `opencode .`. `atenea-volume` is the project default; accepted complex work selects `atenea-complex` in the TUI before the prompt. `--pure` and OpenCode V1 execution paths are historical provenance only.

Deterministic repo evidence remains first-line assurance. Herdr is not correctness authority. Human merge/publication boundary remains mandatory.

## D-017 — Authority separation

**Decision**
- `docs/START_HERE.md`: current repository entrypoint and authority map.
- `CONTEXT.md`: vocabulary/boundaries and scope-vs-implementation authority.
- `docs/RECOVERY_MASTER_PLAN_2026-10.md` + the 2026-10 traceability matrix: current recovery scope authority under D-018.
- `docs/shaping/`: accepted decisions.
- `docs/specs/`: behavioral/architectural contracts for implementation, subject to explicit later recovery amendments.
- `docs/knowledge/` and other audits: evidence/reference unless promoted by an accepted later decision.
- GitHub Issues: executable Work Orders.
- Atenea: execution.
- Cora: independent audit/planning.
- Human: final merge/publication.

## D-018 — Recovery authority and parity semantics

**Accepted reconciliation: 2026-10-04.**

The 2026-10 recovery traceability audit demonstrated that T25 legacy retirement proved workflow/security parity but did not prove full product parity. Therefore:

- `docs/RECOVERY_MASTER_PLAN_2026-10.md` and its reconciled 88+42 traceability matrix are the current scope authority for recovery; the row count is not itself proof of source completeness;
- “parity” means preservation or explicitly accepted replacement of product capability, safety semantics, workflow, output affordance and required visual/product contract — not merely route existence;
- a historical `DONE` debt row may remain technically true while a broader product-level recovery gap is still open;
- legacy implementation code is **not** to be restored wholesale. Recover valuable capabilities on top of V4 authorities (ReviewSession, RegistryEngine, Safe Output / Confidential Audit, fail-closed state, local-only runtime);
- specs/Work Orders must not silently narrow a recovery row. Any intentional removal/substitution must be explicit in the ticket and reflected back into the traceability matrix;
- recovery cannot be declared complete until `REC-12` first performs source→matrix completeness against both frozen audits + material v3 heritage and then re-verifies every reconciled traceability row against code and the shipped product.

## D-019 — Input pipeline override must be consciously resolved

**Accepted reconciliation: 2026-10-04 after external adversarial audit.**

The frozen UX direction for New Privacy Job required input-driven pipeline inference **and an override when necessary**. V4 delivered deterministic/fail-closed inference but the override clause disappeared during translation into implementation authority.

**Decision boundary**
- do not add a generic override merely to mimic legacy/UI freedom;
- REC-08 must identify whether legitimate recovery cases require a bounded override;
- if no safe/legitimate case survives, the requirement must close as `DELIBERATELY_SUPERSEDED` with explicit product/privacy rationale and deterministic evidence;
- the clause may not be silently treated as already resolved.

## D-020 — REC-02 text/document/batch policy mapping

**Accepted: 2026-10-04 (REC-02 TEXT-POLICY-COMPLETION-01, C-084).**

The accepted per-category behavior for pasted text, single documents and document batch is fixed by REC-02 (`FUNC-005`, `PRODUCT-001`, `PRODUCT-003`, `H-32`, `H-33`):

- Standard and Strict keep the legacy per-category behavior (names pseudonymized, direct identifiers redacted, dates via the legacy date transform, locations/quasi-identifiers generalized, ages banded); Strict uses the stricter location/quasi generalization branch.
- External AI is local-only preparation and maps `FECHA` to date generalization (reduced precision); it transmits nothing to any external service.
- Longitudinal Research is local-only preparation and maps `FECHA` to one consistent Job-scoped date shift that preserves order/intervals; it grants no research approval or governance authorization.
- All four map `EDAD` to age banding; no policy keeps an exact age.

Availability remains derived from the engine/structured authorities, never a second hard-coded table. This text mapping is job-family-specific and deliberately distinct from the structured date/age mapping (structured keeps explicit column roles and the patient-ID/shift authority). REC-10 owns Spanish localization and REC-12 owns recovery closeout. Implementation evidence: `app-v4/src/engine/policy.ts`, `app-v4/src/engine/initial-processing-context.ts`, `app-v4/src/policy-guidance.ts` and their oracles.
## D-021 — REC-03 structured semantics recovery

**Accepted: 2026-10-04 (REC-03 STRUCTURED-SEMANTICS-RECOVERY-01 shaping, before implementation).**

REC-03 restores the structured product contract without adding a sixth privacy class or a new top-level workflow. The accepted classes remain exactly `Identifier / Quasi-Identifier / Sensitive / Insensitive / Unknown`. **Class and productive Action are separate authorities** when class alone cannot determine a safe transformation.

### Patient identity / Study ID

- The explicitly selected patient-ID column is the single patient identity authority.
- When selected, its Safe disposition is `Replace with Study ID`, not remove. The original selected identifier never appears in Safe output.
- REC-03 uses the fixed in-Job heritage format `PAC_001`, `PAC_002`, … assigned deterministically by first appearance of each distinct non-blank original patient identifier. Repeated rows for the same original ID reuse the same Study ID.
- The generated Safe header is `ID_ESTUDIO` at the selected column's position. A conflicting different input column already named `ID_ESTUDIO` blocks preparation rather than being overwritten silently.
- A non-empty data row with a blank value in the selected patient-ID column blocks preparation: do not produce an unlinkable row silently.
- Confidential correspondence carries the unique original patient ID ↔ Study ID mapping. No HMAC/global/cross-Job identity is introduced.
- Configurable Study-ID prefix and optional `Visita_Num` remain REC-04 scope.

### Structured Class → Action authority

Derived/fixed outcomes:

- selected patient-ID column → `study-id`;
- explicit `visit`/`birth` date role → existing policy-driven `date-policy` semantics (T19 remains authority);
- other `Identifier` → `remove`;
- `Sensitive` → `keep` by default (clinical attribute retained, matching the frozen UX target);
- `Insensitive` → `keep`;
- `Unknown` → `review-required`, never KEEP;
- non-date `Quasi-Identifier` has **no universal automatic generalization**. It remains `review-required` unless a bounded accepted action is proposed/selected.

A recognized center/ward quasi-identifier may propose `pseudonymize`, matching the frozen UX target. Other non-date quasi-identifiers do not acquire an invented operator merely to unblock export.

Explicit reviewer action choices are bounded:

- non-date Quasi-Identifier: `pseudonymize`, `keep`, or `process-as-text` when the column is text-like;
- Sensitive: `keep` or `process-as-text` when text-like;
- Unknown: may be resolved by changing class, or by explicit `process-as-text` when text-like; it may not be changed directly to KEEP while remaining Unknown;
- ordinary Identifier remains `remove`; the selected patient-ID remains `study-id`;
- Insensitive remains `keep`;
- date-role columns and selected patient-ID have their derived action locked by those stronger authorities.

Structured `pseudonymize` is deterministic, column-local categorical tokenization (`QID_001`, `QID_002`, … by first appearance), blanks preserved, with original↔token correspondence Confidential-only. Existing codification primitives may be reused internally, but `codify` is not a separate user-facing privacy class/action in the recovered contract.

### Free-text columns

`process-as-text` is an **Action**, not a new privacy class. It is available only for text-like non-patient-ID, non-date-role columns under the bounded rules above.

- Every non-blank configured free-text cell is processed through the same productive text privacy engine and the same REC-02 policy mapping; no second structured text policy is invented.
- Processing order is deterministic row-major, carrying one shared `ProcessingContext` across the configured cells so pseudonyms/context remain stable within the Job.
- The initial context is the REC-02 text-policy context for the Job. Consequently Longitudinal Research inside a free-text cell uses the REC-02 **Job-scoped text date shift**; explicit structured visit/birth columns continue using their existing T19 structured semantics. REC-03 does not invent a third date policy.
- Blank free-text cells remain blank and create no ReviewSession.
- Each non-blank processed cell owns a ReviewSession. Low-confidence candidates remain visible/pending exactly as in ordinary text review. Safe structured output remains blocked until every required structured free-text session can finalize.
- The Safe cell value is `ReviewSession.getFinalText()` (canonical reviewed state), never the raw engine proposal bypassing review.
- Engine/read failure for any configured free-text cell is explicit and blocks Safe output; it never silently keeps the original cell.
- Policy change invalidates/rebuilds structured free-text review state under the new policy.
- Confidential structured correspondence may contain original↔final reviewed free-text values; originals never enter Safe output through the correspondence path.

### Product-fidelity boundary

- **Presentation clause superseded by D-023:** the internal/domain `Input → Configure → Review → Privacy Gate → Export` pipeline may remain, but the visible human product is no longer required to expose every phase.
- Do not add a new privacy class, route, app, mode or standalone structured-review product.
- Configure gains/restores the explicit effective **Action** control/fact inside the existing column cards; action choices are constrained by the rules above rather than exposing an unconstrained expert editor.
- When `process-as-text` is configured, the existing Review step shows a bounded queue of those cells and reuses the existing ReviewWorkspace semantics. When none are configured, the existing structured review summary remains.
- Do not expose internal mappings/context objects as user concepts.
- ARX/risk scoring, configurable prefix/`Visita_Num`, smart workbook headers, XLSX exports, Confidential-download confirmation, Spanish localization and visual redesign remain owned by later REC Work Orders.


## D-022 — REC-04 structured I/O and output parity

**Accepted: 2026-10-04 (REC-04 STRUCTURED-IO-OUTPUT-PARITY-01 shaping, before implementation).**

REC-04 restores useful workbook intake and structured export ergonomics on top of the canonical REC-03 structured semantics. It does not reintroduce the legacy structured app or let file/export code become a second privacy authority.

### Workbook header-row authority

- CSV keeps its accepted first-record-as-header semantics. Smart-header recovery applies only to XLS/XLSX.
- Multi-sheet workbooks keep explicit sheet selection before header-row resolution; never silently select the first sheet.
- For the selected worksheet, inspect at most the first 10 used rows using a deterministic v3-derived header heuristic: a candidate has at least three non-empty textual cells and either a known clinical/header token (`nhc`, `nombre`, `apellido`, `fecha`, `dni`, `paciente`, `id`, `codigo`, `edad`, `sexo`, `telefono`, `email`, `direccion`, `centro`, `medico`, `diagnostico`, `procedimiento`, `visita`) or more textual than numeric cells.
- Exactly one candidate may be auto-selected. Zero or multiple candidates require explicit user header-row selection from the inspected rows. Do not silently fall back to row 1 when detection is uncertain.
- Rows before the selected header are explanatory metadata and are not data rows. The chosen row becomes the normalized header; row order after it is preserved.
- Detection/selection stays inside the existing Input/Configure flow; no new route or standalone import wizard.

### Study-ID output options

- The selected patient-ID column remains the REC-03 identity authority. REC-04 may configure only how its generated Safe Study ID is formatted; it may not introduce another patient identity source.
- Default prefix is `PAC`. A blank prefix resolves to the default. A non-blank prefix is trimmed, upper-cased and must match `[A-Z][A-Z0-9]{0,9}`. Invalid values block/reject the option explicitly; never silently sanitize arbitrary punctuation/formula-like input into an accepted token.
- Generated IDs remain deterministic first-appearance mappings: `<PREFIX>_001`, `<PREFIX>_002`, …; changing the prefix changes only generated token text, not patient grouping/order.
- `Visita_Num` is an optional derived Safe column. To preserve the useful heritage default it starts enabled when a patient-ID authority exists, but is unavailable/effectively absent without one.
- `Visita_Num` means **1-based occurrence sequence per patient in current input row order**. It does not sort rows and must not claim chronological visit ordering.
- When enabled, `Visita_Num` is inserted immediately after `ID_ESTUDIO`. A conflicting Safe header `Visita_Num` blocks rather than being overwritten or duplicated silently.

### Structured Safe data and factual summary

- The canonical `StructuredOutput.safe` remains the only source for Safe CSV/XLSX. Exporters never rerun privacy transformations or inspect Confidential correspondence to reconstruct Safe values.
- Preserve scalar types where practical in the Safe domain: unchanged `keep` numbers/booleans stay typed, absence stays `null`, transformed/pseudonymized/reviewed values remain their canonical transformed strings. CSV stringifies/escapes deterministically; XLSX writes typed scalars/blank cells.
- A factual summary may expose total rows and, only when a patient-ID authority exists, unique patients, linked rows/visits and average linked rows per patient. These are descriptive counts, not a privacy/risk score and not proof of chronology.
- No ARX/equivalence-class/risk claim is added in REC-04.

### XLSX Safe / Confidential artifacts

- Reuse the governed same-origin SheetJS runtime already present; no new spreadsheet dependency or remote runtime.
- Safe XLSX is generated from canonical `StructuredOutput.safe`, preserves row order/blanks/typed scalars where practical, and contains no original↔transformed mapping or Confidential-only values. CSV remains an additional Safe format.
- Confidential XLSX is generated only from canonical `StructuredOutput.confidential` plus non-sensitive factual metadata needed to understand the artifact. It may contain the authorized correspondence but must not pull `keep` clinical content into the audit merely because it exists in the Safe table.
- Spreadsheet string cells that begin with formula-triggering characters remain literal strings; exporters must not create formula cells from user/source text.
- Structured Confidential TXT may remain as an additional current format, but **every identifiable structured Confidential download (TXT or XLSX) requires a second deliberate confirmation immediately before the actual download**.
- The confirmation is transient interaction state only: it grants no readiness, is cleared after confirm/cancel and cannot carry across another Job or newly blocked/stale preparation.
- Safe and Confidential remain visually/conceptually separate zones inside the existing Export step.

### Product-fidelity boundary

- **Presentation clause superseded by D-023:** retain the REC-03 Class→Action/ReviewSession authorities and the internal/domain pipeline, but do not require every `Input → Configure → Review → Privacy Gate → Export` phase to remain a visible destination.
- No new structured app, import route, export page, privacy class, policy meaning, patient identity authority, remote processing, persistence, HMAC/global identity or risk-analysis layer.
- REC-10 owns Spanish localization; REC-11 owns visual redesign. REC-04 may add only the bounded controls/status needed for header resolution, Study-ID options, factual summary and output-format/confirmation recovery.


## D-023 — Human product design reconciliation

**Accepted: 2026-10-05 (Product Design Reconciliation before REC-05 execution).**

The V4 SPA, one in-memory Job and accepted domain/privacy authorities remain. D-001 is superseded only in one respect: its `Input → Configure → Review → Privacy Gate → Export` sequence remains available as internal/domain pipeline structure but is **not** mandatory human-product topology.

Binding human-product authority is `docs/HUMAN_PRODUCT_DESIGN_AUTHORITY_V1.md`. The ordinary human mental model is:

`Add information → prepare/review what needs attention → Result`

These are mental states, not a fixed replacement stepper. A domain phase with no real human task must not become a ceremonial screen. Privacy Gate remains a factual readiness authority but need not be user vocabulary or a standalone destination.

User-facing REC-05→REC-11 work must therefore preserve the V4 safety/domain foundation while satisfying the human-product invariants and gates in the authority document, including:

- task before topology and no visible no-op phase;
- quiet automation and no requirement to learn routing/internal mechanics;
- document, batch and structured representations fitted to their material;
- Review as decision work with realistic-density productivity and no silent acceptance;
- source offsets/internal enums kept out of ordinary UI;
- `Result` communicating readiness, remaining attention and contextual next action;
- deliberate Safe/Confidential asymmetry;
- Spanish human vocabulary and baseline visual hierarchy as foundations, not late reskin/localization;
- rendered task-realistic evidence for material spatial decisions.

The exact pane count, shell geometry, next/previous mechanics, bulk-review interaction, structured table geometry and final result-format layout are implementation decisions. They are tested by default in the real application on bounded branches using synthetic/no-PHI realistic-density fixtures; a parallel throwaway prototype train is not required.

A UI improvement that would weaken privacy semantics, ReviewSession authority, structured linkage, fail-closed behavior, Safe/Confidential separation or current-state output safety requires a HUMAN PRODUCT DECISION / HUMAN STOP.

The unpublished pre-reconciliation REC-05 shaping decision that used the identifier `D-023` is not canonical authority and must not be replayed by number; its still-valid technical output semantics must be re-shaped under a fresh decision identifier when REC-05 is re-issued.

## D-024 — REC-05 single Result / output contract

**Accepted: 2026-10-05 (fresh post-PDR REC-05 shaping).**

REC-05 restores useful pasted-text / single-document outputs without reopening privacy transformation semantics. It also establishes the accepted **Result** interaction for the single-item path under D-023 and `docs/HUMAN_PRODUCT_DESIGN_AUTHORITY_V1.md`.

### Canonical Safe payload

For a current `pasted-text` or single `document` Job, one canonical `safeText` may exist only when the current Job and ReviewSession still correspond, `job.outputs.safeOutputReady === true`, `canFinalize(review) === true`, and `getFinalText(review)` succeeds.

Every Safe representation derives only from that canonical final reviewed string:

- clipboard: exact `safeText`;
- TXT: UTF-8 `safeText`;
- DOCX: generated local OOXML text document preserving the accepted Safe text/line semantics;
- PDF: generated local paginated text representation of that same Safe text.

No representation may rerun privacy transformations, infer a new decision, or add correspondence, reviewer notes, source originals or other Confidential-only content. An original deliberately kept by ReviewSession remains in Safe representations exactly because the canonical reviewed state contains it; the factual warning remains visible.

### Result interaction

For pasted text and single documents, the ordinary human ending is **Result**, not a requirement to understand separate `Privacy Gate` / serializer concepts.

- Result immediately communicates `ready`, `needs attention` or `blocked` from existing factual readiness authority.
- If not ready, prepared/shareable actions remain unavailable and the useful next action returns the person to unresolved review work.
- If ready, the prepared/shareable zone is visually primary and the Confidential Audit remains a separate sensitive zone.
- Pasted text may make **Copy** the primary result action.
- Single-document work must make one useful document-download action primary; exact DOCX/PDF visual ordering is an implementation-level presentation choice only while it preserves this hierarchy and does not make all formats equal-weight.
- Secondary Safe formats remain discoverable without becoming equal-weight chrome.
- A user can return to review/correct decisions without rebuilding the Job or losing unrelated accepted decisions.
- The existing Privacy Gate remains internal/factual authority and may be reused in implementation; D-024 does not require a second user-facing Gate-only destination for the single-item ordinary path.
- Global shell/stepper cleanup across every Job kind remains REC-09. REC-05 must not opportunistically redesign unrelated Input/Review/Structured/Batch navigation.

### Human-work / friction envelope

Accepted project authority frames the actor as a healthcare professional who has already supplied clinical information and needs a prepared result for an intended use outside its original context.

Default ready path:

`finish required review → understand Result readiness → take the useful prepared action`.

The ordinary ready path must not require reselecting Job kind/policy, reading policy documentation, visiting a no-op phase, or learning `Safe Output`, `Privacy Gate`, serializer or ReviewSession vocabulary. From the last required review decision to the ordinary prepared action, allow at most one necessary context transition and the output action itself unless a factual warning/representation failure requires intervention.

### TXT / clipboard

- Clipboard uses the platform Clipboard API; unavailable/rejected access is visible failure, not silent success; no hidden `execCommand` fallback.
- Safe TXT filename: `texto-preparado.txt`.
- UTF-8 decoding of emitted TXT bytes equals canonical `safeText`; no required BOM and no audit header/footer.

### DOCX

- Safe DOCX filename: `texto-preparado.docx`.
- Use the existing direct `jszip` dependency; no new DOCX library.
- Generate the minimum valid OOXML package for a text document; XML escaping, Unicode and logical line semantics are preserved within an explicitly documented round-trip normalization.
- No source layout/style/image/table preservation claim and no source filename/mapping/notes.
- Governed `mammoth.extractRawText()` read-back is the semantic oracle.

### PDF

- Use exact direct dependency `pdf-lib@1.17.1`; do not reactivate retired `lib/jspdf.umd.min.js`.
- Safe PDF filename: `texto-preparado.pdf`.
- Reflow/pagination is allowed; source-PDF layout redaction/reconstruction is not part of REC-05.
- Every character sent to the chosen bundled standard font/encoder must be representable. Unsupported content fails the PDF action visibly and produces zero PDF download; no substitution/drop/mojibake.
- Long content paginates rather than truncates.
- Final candidate must run `npm audit --omit=dev`; a material production dependency finding is HUMAN STOP rather than permission to switch libraries silently.

### Confidential Audit

Keep the existing canonical single-item Confidential TXT payload; REC-05 does not add Confidential DOCX/PDF.

Filename: `auditoria-confidencial.txt`.

The first download action reveals a clearly marked Spanish warning and downloads nothing. Explicit Confirm downloads exactly once; Cancel downloads zero. Pending confirmation cannot survive confirm/cancel, Job change, review mutation or newly unavailable audit state. Confirm revalidates the current Job + current review/audit authority immediately before download. Safe actions never require this confirmation.

### Async/current-state safety

DOCX/PDF generation or lazy load is asynchronous. Capture the requested Job id, ReviewSession identity and canonical `safeText`; after the last awaited generation/load step and immediately before download, revalidate current Job, review identity/Safe text, readiness and finalizability. Stale work produces zero download and no false success.

### Protected siblings / non-goals

- Structured REC-03/04 semantics and existing CSV/XLSX + Confidential confirmation remain unchanged; shared-surface parity evidence is mandatory if REC-05 touches shared Export/Result code.
- Batch gains no fabricated single-item output; REC-06/07 own batch workflow/result.
- REC-08 owns input conveniences; REC-09 owns global IA/no-op cleanup, Review productivity/manual marking and Structured comparative interaction; REC-10/11 own exhaustive language/visual closeout while their foundations apply immediately.
- No new policy/operator/recognizer/review authority, remote generation, persistence, source-layout redaction, new app/route/mode or product concept is authorized.

A material conflict with D-023/HPD authority, a representation narrowing, or a materially affected supported sibling outside this envelope is a **HUMAN STOP**.
