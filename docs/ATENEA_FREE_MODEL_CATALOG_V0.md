# Atenea Free model catalog v0

Status: **CURRENT REPLACEABLE SNAPSHOT**
Snapshot: 2026-10-03
Runtime observed: OpenCode V2 `2.0.22`

This file is deliberately replaceable. Free promotions rotate; changing the catalog at a clean boundary is expected and does not change the stable `free_only` policy.

## Bound routing

| Role | Current zero-cost binding | Notes |
| --- | --- | --- |
| coordinator | `opencode/mimo-v2.6-flash-free` | same coordinator family as standard C-084; orchestration-only |
| explorer | `nan/qwen3.6` | NaN no-counter route; known bounded scout/writer behavior |
| implementer | `opencode/space-bunny-free` | current primary Free coding writer; responsive in local tool-use smoke |
| merger | `opencode/mimo-v2.6-flash-free` | semantic integration under accepted intent |
| Standards review | `nan/qwen3.6` | fresh read-only reviewer, different from writer/provider |
| Spec review | `opencode/mimo-v2.6-flash-free` | fresh read-only context, different from writer |
| volume correction | `opencode/space-bunny-free` | fresh finding-scoped correction session; may be invoked twice maximum |
| complex correction | `opencode/mimo-v2.6-flash-free` | fresh finding-scoped correction session using a model different from writer; may be invoked twice maximum |
| integrated audit | Cora | required for material Free-complex composed work |

## Selection rationale

- MiMo 2.6 Free preserves the coordinator family already used by Atenea, provides the fresh Spec review, and is deliberately reused as the **role-bound** Complex corrector. The no-mutation rule applies to the coordinator role, not to the model family when invoked through a separate corrector agent.
- Space Bunny Free is the current writer because it completed the local bounded tool-use probe cleanly and is heavily exercised in current OpenCode usage; zero monetary cost removes the need to prefer a deliberately weaker writer.
- Qwen 3.6 remains useful as a stable no-counter scout and independent Standards reviewer, adding provider/model diversity without consuming metered NaN pools.
- Nemotron 3 Ultra Free remains a candidate rather than a binding: it is visible and starts under this runtime, but did not complete a trivial bounded reply within the local latency probe, so it is not placed on the V0 hot path.

Synthetic probes on this VPS are only smoke evidence, not quality-equivalence claims: MiMo Free, Space Bunny Free and Qwen 3.6 completed bounded read/diagnose instructions. LongCat 2.5 Preview Free did not complete the same tool-use probe inside 40 seconds, Gemma 4 was less disciplined around tool use, and Nemotron 3 Ultra Free showed poor latency in the local invocation probe. Real project tickets remain the quality evidence that matters.

## Runtime Free inventory observed on 2026-10-03

OpenCode V2 exposed these Zen routes:

```text
opencode/big-pickle
opencode/fledge-alpha-free
opencode/ling-3.0-flash-fin-free
opencode/ling-3.1-flash-free
opencode/longcat-2.5-preview-free
opencode/mimo-v2.6-flash-free
opencode/muse-spark-1.3-contributor-free
opencode/nemotron-3-ultra-free
opencode/nemotron-3.5-lightning-free
opencode/space-bunny-free
```

NaN additionally exposes the no-counter routes `nan/qwen3.6` and `nan/gemma4` for this account.

Unbound models are candidates, not automatic fallbacks. A model enters routing only after Cora updates this snapshot and the project-local agent binding at a clean boundary.

## Rotation rule

The exact bound IDs must remain visible and zero-cost before a Free train. If a provider removes a model, changes its price, or the account cannot call it:

```text
STOP
→ refresh catalog evidence
→ Cora selects replacement
→ update bindings + checker
→ validate at clean boundary
→ next train
```

Never convert `free_only` into paid usage merely to keep a train moving.
