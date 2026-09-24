# Handoff to Atenea — T06 pre-writer composition learning

Date: 2026-09-24
Source project: Laboratorio de Privacidad Clínica
Field event: V4/T06 #10 unified text/document input adapters

## What happened

T06 was accepted, implementation-complete and deterministically green. Native review START then failed in preflight with typed `lens_context_budget_exceeded` before any review lineage/authority was created.

The local T06 history contained three semantic commits:
- `02ea93a` — input adapters / extraction / integration: ~1,566 textual changed lines across 22 files;
- `923d3a4` — privacy/security guard extensions: ~394 changed lines;
- `977daa0` — xmldom in-range update + debt reconciliation: ~13 changed lines.

The provider suggested chained smaller candidates. The latter two commits are naturally bounded; the first remains materially oversized by itself. Recovery therefore requires recomposing unpublished local history while preserving the accepted final tree as an oracle.

## Project-level conclusion

The mistake was not necessarily that GitHub issue #10 represented too much product value. The mistake was allowing `Work Order == one implementation/review unit` by default.

Laboratorio has now adopted a stable pre-writer rule:

```text
accepted substantial Work Order
→ composition forecast before any writer edits code
→ if material over-budget risk: define semantic work-unit chain
→ implement / verify / commit / native review per unit
```

A capability-sized Work Order may remain one issue. Work units are delivery/review units, not necessarily issue-tracker units.

The forecast must use real surfaces (domain, parser, UI, tests, CI/security, fixtures, dependency/debt work), not line-count slicing alone. Behavior must stay with the tests/oracle that prove it. If one honest composition pass still leaves an indivisible oversized unit, STOP before writing and obtain the required exception/human decision.

## Why this matters globally

Atenea already has `WORK_UNIT_COMPOSITION_POLICY_V1` and a pre-implementation workload gate. The field failure suggests the policy can still be skipped operationally when a project hands native Gentle an already accepted ticket without making forecast/composition an explicit pre-writer gate in the project contract.

Please review whether current Atenea front-door/handoff policy should make this invariant harder to miss for all projects, while preserving upstream ownership:

1. Should `docs/START_HERE.md` / `PROJECT_EXECUTION_HANDOFF_NATIVE_GENTLE.md` explicitly require a composition forecast before writer authority for every substantial Work Order?
2. Should execution-readiness distinguish `product scope accepted` from `delivery composition resolved` when material over-budget risk is obvious?
3. Can this be enforced as stable policy / deterministic readiness evidence rather than a new skill or Atenea scheduler?
4. How should the runtime consume a forecast without Atenea prescribing internal workers or native `review_due` timing?
5. Should the current 400 / soft-600 / exception / >800 policy remain the sole numeric authority, with projects referencing it rather than copying thresholds?

## Non-conclusions

This event is not evidence of a `native-balanced` routing defect.
It does not justify a second review controller.
It does not imply every large capability needs multiple GitHub issues.
It does not justify arbitrary file/line slicing.
It does not change native Gentle ownership of decomposition/review transitions.

The requested global learning is narrower: **make delivery composition a mandatory pre-writer readiness question, not a post-review-start recovery problem.**
