# Atenea — Child authority capsule v1

Status: **CURRENT RUNTIME DISPATCH CONTRACT — C-087**
Date: 2026-10-06

## Problem

OpenCode child agents may be sandboxed from `/outbox`, `/tmp`, another worktree or any other external directory. A child must never need an inaccessible path to understand the authority required for implementation, review or correction.

## Dispatch rule

For every child dispatch, the coordinator uses exactly the smallest viable authority transport:

1. **Repo-local reference** — preferred when the durable handoff/authority is inside the child's current worktree and readable there; or
2. **Compact inline authority capsule** — required when relevant authority is external, permission-blocked, generated outside the worktree, or otherwise not guaranteed readable by that child.

Do **not** solve this by copying the full handoff/policy corpus into every child prompt. The capsule contains only facts required for that child's phase.

## Minimum capsule

Include only applicable fields:

```text
WORK
  ticket/work-unit identity and phase

FIXED POINT
  base / candidate / review range required by this child

OUTCOME / ACCEPTANCE
  the concrete requirements this phase must implement or verify

SCOPE
  allowed surface and explicit non-goals

PROTECTED / CLOSED
  invariants and material decisions already closed; do not rediscover

EVIDENCE
  existing evidence and the focused proof required from this phase

STOP
  conditions that require INCOMPLETE_AUTHORITY or HUMAN STOP

REPO-LOCAL REFS
  only paths guaranteed readable from this worktree
```

A reviewer capsule normally carries the candidate/fixed point, acceptance, protected boundaries, relevant adjudications and existing evidence. A corrector capsule normally carries only the authorized findings, allowed surface, protected behavior and focused closure evidence.

## Forbidden dependency

A child verdict must not depend on reading:

- `/srv/.../outbox/...`;
- `/tmp/...`;
- another project/worktree;
- a parent-only sandbox path;
- any external directory denied by the child's permissions.

Those locations may remain useful to Cora/humans, but the parent must translate the required facts into the child capsule first.

## Fail closed

If authority required for the phase is missing, contradictory or inaccessible, the child returns:

`INCOMPLETE_AUTHORITY`

with the exact missing item. It does not infer, reconstruct or guess a verdict. A technically incomplete review axis may be completed/retried with corrected authority transport without creating a second semantic review of the candidate.
