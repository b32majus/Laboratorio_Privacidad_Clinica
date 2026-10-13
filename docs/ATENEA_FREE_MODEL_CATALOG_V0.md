# Atenea Free model catalog v0

Status: **CURRENT REPLACEABLE SNAPSHOT**
Snapshot: 2026-10-12
Runtime observed for candidate: OpenCode V2 `2.0.26`

This file is deliberately replaceable. Free promotions rotate; changing the catalog at a clean boundary is expected and does not change the stable `free_only` policy.

## Bound routing

| Role | Current zero-cost binding | Notes |
| --- | --- | --- |
| coordinator | `opencode/muse-spark-1.3-contributor-free` | orchestration-only; two-phase coordinator probe PASS, field canary pending |
| explorer | `opencode/mimo-v2.6-flash-free` | Free endpoint; NaN/Go inference evidence is not endpoint qualification |
| implementer | `opencode/space-bunny-free` | current primary Free coding writer; responsive in local tool-use smoke |
| merger | `opencode/mimo-v2.6-flash-free` | semantic integration under accepted intent |
| Standards review | `opencode/mimo-v2.6-flash-free` | fresh read-only context; endpoint canary pending |
| Spec review | `opencode/mimo-v2.6-flash-free` | fresh read-only context, different from writer |
| volume correction | `opencode/muse-spark-1.3-contributor-free` | same model for Volume/Complex, fresh role session |
| complex correction | `opencode/muse-spark-1.3-contributor-free` | same model for Volume/Complex, fresh role session |
| integrated audit | Cora | required for material Free-complex composed work |

## Selection rationale

- Muse Free coordinates and corrects in distinct role sessions; it passed a two-phase synthetic coordinator probe, but the revised binding is not yet field-qualified.
- Space Bunny Free remains implementer; correction for either risk class uses fresh Muse Free.
- MiMo Free handles Explorer, Standards, Spec and mechanical merger as separately bound roles. Its Free endpoint has not been qualified by the NaN/Go reasoning tests. Same-family reviews are fresh but not independent model families.
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
