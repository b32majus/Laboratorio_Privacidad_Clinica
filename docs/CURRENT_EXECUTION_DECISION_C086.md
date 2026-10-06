# C-086 — Thin execution restoration

Status: **CURRENT EXECUTION DECISION**
Date: 2026-10-06

## Decision

C-086 restores Atenea's thin execution architecture after a regression audit against known-good `Atenea@50122a13f1d1e191e659a21ad6445267e4e354e6`.

It does **not** discard the product/safety lessons learned during later Go/Complex qualification. It changes where those protections execute.

C-086 retains:

- C-084 native OpenCode V2 + upstream Matt lifecycle;
- one canonical Standards + Spec review;
- fresh finding-scoped correctors and two-attempt maximum;
- human-visible launch and human publication authority;
- Free and Go cost policies with no silent fallback;
- C-085 OpenCode 2.0.22 known-good runtime, standard writer split, 220k context guard and tool-economy advice;
- Human Product Design, product-fidelity, representation-narrowing, affected-surface and adversarial-evidence knowledge as conditional specialized authority.

C-086 changes the **execution hot path**:

1. `AGENTS.md`, `START_HERE` and agent prompts return to thin ownership/routing/boundary contracts.
2. Specialized product/fidelity policies are referenced when triggered instead of copied into every execution context.
3. Coordinators delegate by durable handoff reference rather than re-expanding the full handoff into child prompts.
4. Writers perform focused implementation/TDD and are not repository-wide blast-radius auditors.
5. Representation/shared-seam/adversarial safeguards are phase-owned: shaping/preflight and review/Cora activate them when material; a corrector closes only the supplied finding.
6. Broad/full suites default to integration/publication boundaries rather than every writer slice.
7. Machine authority checks validate structure/bindings/current-decision coherence instead of pinning large amounts of duplicated prose.

## Why

The regression audit found that later field hardenings solved real defects but were promoted too broadly. In particular:

- affected-surface/invariant propagation was copied into coordinators, writers, correctors and reviewers, encouraging open-ended source archaeology;
- adversarial-witness guidance was copied into every Spec reviewer and corrector, encouraging preventive fixture growth even before a concrete evidence finding existed;
- downstream project `AGENTS.md`, handoffs and child dispatches duplicated the same authority, inflating context and cognitive load;
- some current material tickets collapsed focused implementation, adversarial qualification, broad regression and publication-style closeout into one writer unit.

The known-good control already contained the modern C-084 lifecycle, so C-086 restores that architecture rather than rolling back OpenCode V2, Matt, single-review ownership or bounded correction.

## Evidence layering

```text
writer      focused TDD / smallest relevant checks
integration merge-sensitive / cross-slice checks when justified
review      one semantic review; new proof only for a concrete gap
corrector   finding-scoped mutation + focused regression
publication artifact-specific / composed final closeout
```

A broad/full suite may run earlier when current repository/ticket authority genuinely requires it. `complex`, `go` or “material” alone is not such a requirement.

## Conditional safeguards

Execution handoffs carry:

`Conditional safeguards: NONE | <explicitly triggered safeguards>`

This is routing metadata, not a new state machine. A specialized policy remains authoritative when invoked; it is simply not default payload for unrelated work.

## Runtime held constant

C-086 deliberately does not change runtime/model variables during restoration:

```text
OpenCode                    2.0.22
standard volume writer      DeepSeek V4 Flash
standard complex writer     GLM 5.3 Flash high
effective writer context    220k
auto-compaction             ~198k
recent verbatim retention   ~15k
```

Holding these constant allows later field validation to isolate the effect of protocol decompression.

## Validation boundary

No synthetic macro-benchmark is required before promotion of the documentation/config restoration itself.

After C-086 is reconciled into real project repos and only at a clean future boundary, field validation is deliberately limited to **two small real tickets**:

1. one Standard Volume ticket;
2. one Standard Complex ticket.

Choose tickets small enough that an hour-scale run would itself be a regression signal. Observe child-prompt size, authority reads, model turns, tool churn, maximum context, compaction, repeated broad-suite execution, elapsed time and review/correction quality. Do not add a third ticket merely to make a benchmark look complete.

Do not change routing/model/context settings during those two tickets. If the thin protocol recovers good execution behavior, only then consider a separate controlled writer-model comparison.

## Publication boundary

This decision does not itself authorize push, PR, merge or deployment. Publication remains explicit human/repository authority.
