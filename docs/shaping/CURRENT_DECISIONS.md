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
