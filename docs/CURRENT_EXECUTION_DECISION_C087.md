# C-087 — Harden before launch; capsule authority; observe after run

Status: **CURRENT EXECUTION DECISION**
Date: 2026-10-06

## Decision

C-087 keeps the C-086 execution lifecycle, model routing and evidence economy unchanged and makes three narrow operational improvements from real C-086 field evidence:

1. **Cora-side pre-execution hardening** — before `READY_TO_LAUNCH`, Cora removes avoidable ambiguity/discovery and produces a precise execution envelope using `PRE_EXECUTION_HARDENING_V1.md`.
2. **Child-readable authority transport** — coordinators use a readable repo-local reference or a compact inline authority capsule; child verdicts never depend on `/outbox`, `/tmp`, another worktree or other inaccessible external paths.
3. **Read-only run telemetry** — `tools/opencode-run-telemetry.mjs` reads native OpenCode V2 SQLite state after a run and reports role/session timing, usage, turns, tools, context proxy, compaction and observable waits without any LLM call or repository/runtime mutation.

## Why

C-086 field use across PROMueve Sure, Nexus, Laboratorio and Symphonia showed that the thin lifecycle itself is healthy: coordinators can remain small, one canonical review is sufficient, fresh finding-scoped corrections close quickly, and Free/Go/Standard routes all produced valid candidates.

The remaining cost clustered elsewhere:

- child reviewers sometimes could not read an external handoff/outbox path, forcing an otherwise unnecessary completion/retry;
- broad tickets were slow when writers had to rediscover known repository seams/closed decisions rather than because of coordinator ceremony;
- wall-clock mixed model work with human waits, environment stalls and parallel child sessions, making ad-hoc performance judgments unreliable.

C-087 addresses only those observed seams. It does not re-expand C-086 policy into every agent.

## Cora preparation boundary

The default sequence is:

```text
reconcile authority
→ select frontier
→ pre-execution hardening
→ prepare worktree/fixed point
→ produce hardened handoff
→ verify preflight
→ give Silvia bash + agent + prompt
→ STOP
```

The human remains the default launch owner. Cora launches only when that specific action is explicitly delegated.

Hardening is not a new runtime stage/state. It is a Cora quality check before `READY_TO_LAUNCH`.

## Runtime authority transport

A coordinator may continue to reference a durable handoff when it is repo-local and child-readable. When required authority is external or inaccessible, the coordinator supplies only the compact phase-specific facts the child needs. Full-policy duplication remains forbidden.

A child missing required authority returns `INCOMPLETE_AUTHORITY`; it does not guess. Correcting transport and completing that technically incomplete axis does not constitute a second semantic review.

## Telemetry semantics

Telemetry is observational only. It never gates a writer, review, correction or publication decision.

The SQLite helper reports provider/runtime fields as exposed and labels `input + cache_read` as a **prompt-context proxy**, not the OpenCode compaction counter. Cache-read is not treated as fresh/billable input. Large message gaps and waits after a `question` tool are reported as observable timing evidence, not automatically attributed to model latency.

## Held constant from C-086

```text
OpenCode                    2.0.22 known-good
standard volume writer      DeepSeek V4 Flash
standard complex writer     GLM 5.3 Flash high
context guard               220k effective / ~198k compaction guidance / ~15k recent retention
review ownership            one coordinator-owned Standards + Spec review
correction budget           max two fresh finding-scoped attempts
cost policies               standard | free_only | go, no silent fallback
publication                 human / target-repository authority
```

No new model, role, routing engine, review pass, automatic ticket split or context threshold is introduced.

## Field-validation boundary

Do not open another synthetic qualification campaign. Reconcile C-087 into active projects at clean boundaries and observe the next ordinary tickets. Improvement is expected as less authority transport fails and writers receive better-known seams/closed decisions. Any future shaping/routing change requires repeated field evidence, not one slow ticket.
