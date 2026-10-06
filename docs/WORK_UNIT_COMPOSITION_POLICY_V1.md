# Atenea — Work-unit composition policy v1

Status: **CURRENT CONDITIONAL POLICY — C-086**

This is an escalation path, not mandatory ceremony.

```text
ordinary bounded ticket
→ execute it

material composition trigger
→ revalidate decomposition before execution
→ small coherent semantic slices
```

Matt owns decomposition/task-graph mechanics. Atenea does not duplicate them.

## Open this policy when

- accepted work contains several independently closable outcomes;
- one candidate crosses several material seams and would be hard to reason about as a whole;
- prior execution/review evidence shows the unit is too coarse;
- material Cora + human reshaping changed the remaining execution plan;
- the human/project explicitly requests staged delivery.

If none applies, do not create a composition worksheet or line-count ceremony.

## Before execution

When decomposition must be revalidated, prefer Matt `/to-tickets` against the reconciled accepted authority in a **fresh normal OpenCode session**, not through an `atenea-*` implementation profile. Present the proposed vertical slices/blocking graph for Cora + human approval before making them execution authority.

Completed work is not reticketized. Only the remaining frontier is decomposed.

Each execution slice should reasonably fit one fresh model context while remaining a complete semantic outcome. This is not a hard token cap: compaction is a runtime airbag, not the intended decomposition strategy.

## Composition rule

Prefer semantic slices with independent acceptance/evidence. Never split mechanically by files, layers, tests-vs-code or arbitrary line chunks.

Do not code-golf useful tests/docs/comments to make a unit look smaller.

If product/architecture uncertainty prevents an honest boundary, repair the accepted authority before execution rather than disguising uncertainty as decomposition.

## During execution

Matt `/implement-spec` may own the accepted task graph/frontier. If a unit grows unexpectedly, keep correctness/coherence first and finish the smallest safe coherent state. Recompose only at the next clean boundary when evidence shows the current unit is genuinely too coarse.

Planning size is not review depth. Review/assurance comes from the selected Atenea profile and actual risk, not authored-line arithmetic.
