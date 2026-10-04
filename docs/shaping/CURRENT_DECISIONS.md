# V4 Current decisions

Status: **ACCEPTED FOR SHAPING / EXECUTION PACKAGING**
Accepted: 2026-09-20

This file records product/architecture decisions already resolved. Workers must not reopen them unless a later accepted decision supersedes them.

## D-001 — Product shape

The Laboratorio becomes a single professional application/workspace, not a set of navigated microsite pages.

**Decision**
SPA/app shell with one continuous job flow:
`Input → Configure → Review → Privacy Gate → Export`.

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

- Keep the existing `Input → Configure → Review → Privacy Gate → Export` shell.
- Do not add a new privacy class, route, app, mode or standalone structured-review product.
- Configure gains/restores the explicit effective **Action** control/fact inside the existing column cards; action choices are constrained by the rules above rather than exposing an unconstrained expert editor.
- When `process-as-text` is configured, the existing Review step shows a bounded queue of those cells and reuses the existing ReviewWorkspace semantics. When none are configured, the existing structured review summary remains.
- Do not expose internal mappings/context objects as user concepts.
- ARX/risk scoring, configurable prefix/`Visita_Num`, smart workbook headers, XLSX exports, Confidential-download confirmation, Spanish localization and visual redesign remain owned by later REC Work Orders.
