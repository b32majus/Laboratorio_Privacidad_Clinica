# Atenea Go model catalog v0

Status: **C-087 GO ROUTING CANDIDATE — FIELD CANARY PENDING**
Snapshot: 2026-10-12
Runtime observed for candidate: OpenCode V2 `2.0.26`

This file is deliberately replaceable. Go availability and promotion rotate; changing the catalog at a clean boundary is expected and does not change the stable `go` policy.

## Bound routing

| Role | Current Go binding | Notes |
| --- | --- | --- |
| coordinator | `opencode-go/deepseek-v4.1-flash` | orchestration-only; two-phase coordination probe PASS; real Train pending |
| explorer | `nan/mimo-v2.6-flash` | NaN quota route; inference compared against Qwen 3.6 |
| implementer | `opencode-go/muse-spark-1.3-contributor` | primary Go coding writer |
| merger | `opencode-go/mimo-v2.6-flash` | semantic integration under accepted intent |
| Standards review | `nan/mimo-v2.6-flash` | independent reviewer role; inference compared against Qwen 3.6 |
| Spec review | `openai/gpt-6-luna#high` | fresh read-only Spec assurance |
| volume correction | `opencode-go/deepseek-v4.1-flash` | fresh finding-scoped session, max two attempts |
| complex correction | `opencode-go/deepseek-v4.1-flash` | same corrector model for both risk classes; fresh session |
| integrated audit | Cora | required for material Go-complex composed work |

## Runtime Go inventory observed on 2026-10-04

OpenCode V2 exposed these bound routes for this account:

```text
opencode-go/mimo-v2.6-flash
opencode-go/muse-spark-1.3-contributor
opencode-go/deepseek-v4.1-flash
nan/mimo-v2.6-flash
openai/gpt-6-luna
```

Unbound models are candidates, not automatic fallbacks. A model enters Go routing only after Cora updates this snapshot and the project-local agent binding at a clean boundary. `go` is a human-selected cost policy, not a quota router; presence of an unbound model never authorizes silent fallback.

## Rotation rule

The exact bound IDs must remain visible and callable before a Go train. If a provider removes a model, changes its capability, or the account cannot call it:

```text
STOP
→ refresh catalog evidence
→ Cora selects replacement
→ update bindings + checker
→ validate at clean boundary
→ next train
```

Never convert `go` into another provider/model automatically merely to keep a train moving.
