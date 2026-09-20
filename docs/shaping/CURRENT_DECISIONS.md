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

Legacy remains temporarily available until explicit parity/retirement criteria pass.

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
Work is packaged as accepted specs + GitHub Work Orders and executed through current Atenea unattended train mechanics.

Normal concurrency: 1.
Human merge boundary remains mandatory.

## D-017 — Authority separation

**Decision**
- `CONTEXT.md`: vocabulary/boundaries.
- `docs/shaping/`: accepted decisions.
- `docs/specs/`: behavioral/architectural contracts.
- `docs/knowledge/` and audits: evidence/reference.
- GitHub Issues: Work Orders.
- Atenea: execution.
- Cora: independent audit/planning.
- Human: final merge.
