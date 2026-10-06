# Atenea — Product fidelity gates v1

Status: **CURRENT C-086 CONDITIONAL PRODUCT-FIDELITY AUTHORITY**
Date: 2026-10-06

## Purpose

These gates preserve accepted product/interaction/domain meaning when a material change genuinely creates fidelity risk. They are **specialized conditional authority**, not default reading or ceremony for every execution unit.

For material human-facing work, `HUMAN_PRODUCT_DESIGN_AUTHORITY_V1.md` establishes the interaction hypothesis upstream. This document protects that accepted outcome through decomposition, representation and composition; it does not ask execution agents to redesign the product.

## Invocation and phase ownership

| Safeguard | Normal owner/phase | Writer role |
| --- | --- | --- |
| ticketization fidelity | Cora + human before execution | consume accepted slice |
| representation narrowing | shaping/preflight; Spec review/Cora when triggered | implement accepted representation; STOP on a discovered authority conflict |
| affected-surface / shared seam | shaping/preflight identifies known material consumers; Spec review/Cora may challenge | no open-ended repo-wide tracing; report incidental out-of-envelope impact |
| adversarial evidence | concrete review/finding or explicitly accepted evidence requirement | add only when already required by handoff |
| composed-product checkpoint | Cora + human at material integration/product boundary | N/A |

The execution handoff states `Conditional safeguards: NONE` or names the relevant safeguard(s). Do not infer additional gates merely from profile, ticket size, or keywords in prose.

## Invariants

1. Internal model richness does not imply user-facing richness.
2. Aggregate/module boundaries are not default screen/form/browser-slice boundaries.
3. Lossless/exact internal representation is not product fidelity by itself.
4. Locally correct slices do not prove the composed product.
5. Product non-negotiables survive decomposition and integration.
6. Accepted semantic distinctions are not silently narrowed by a new representation.
7. Shared-seam impact is behavioral rather than file-based when that seam is actually in scope.

## Gate 1 — ticketization fidelity

Before material tickets become execution authority, compare the proposed decomposition with accepted product authority.

- Product-facing tickets deliver a human/product outcome, not merely an internal aggregate.
- New visible concepts/workflows require explicit product authority.
- Read the ticket set as one future product before `EXECUTION_READY` when composition risk is material.
- This check is upstream. Do not make every writer re-run it.

## Gate 2 — representation narrowing

Trigger only when accepted semantics are translated into a representation where meaning could be collapsed (for example UI controls, adapters, schemas, persistence/export forms).

Ask:

> Can every state, value or distinction that accepted authority requires still be represented after this change?

Check proportionately for loss of precision/granularity, cardinality, ranges/boundaries, states/open vocabulary, independent combinations, semantic ordering, optional/unknown distinctions or temporal precision/timezone semantics.

Examples include `instant → date-only`, `multiple → single select`, `open vocabulary → closed taxonomy`, `exact quantity → boolean`.

Internal-only richness is not a requirement. If a material narrowing is not explicitly authorized, it is HUMAN STOP/product-semantic work.

Normal routing: resolve during shaping/preflight when known; otherwise the Spec reviewer/Cora may report the concrete narrowing. The writer does not perform a general semantic-audit pass over unrelated representations.

## Gate 3 — affected surface / shared-seam impact

Trigger when the accepted change materially modifies a shared helper/generator/mapper/serializer/state/async authority or when review exposes a concrete invariant that plausibly affects another supported path.

Before execution, identify known material consumers/journeys when practical. Evidence should cover the consumers that the accepted change is actually expected to affect.

During implementation, ordinary source tracing remains local to the task. If the writer incidentally discovers a material supported consumer outside the authorized envelope, STOP/report it rather than silently ignoring or fixing it.

During review/Cora audit, challenge an obviously incomplete blast-radius claim when the diff changes a shared seam. Do not turn that challenge into an unbounded repository survey. A newly discovered sibling defect outside authority becomes a new bounded finding/unit.

## Evidence lens — adversarial witness, only when a concrete claim needs it

A nominal positive example does not prove a difficult universal/negative/preservation/boundary property. When a **specific material claim** is not falsifiable by current evidence, review should report that exact evidence gap.

Examples:

- distinguishability under collision → use a collision-capable case;
- `never exposes X` → exercise input where X exists upstream;
- lossless/cardinality/order preservation → use input that would reveal collapse/reordering;
- temporal boundary → test the relevant boundary rather than a comfortable interior point.

Do **not** require new fixtures merely because prose contains `all`, `every`, `never`, `preserve`, `lossless` or similar words. Existing evidence may already be sufficient. Correctors add adversarial evidence only when the supplied finding/handoff explicitly requires it.

Evidence claims still may not exceed their actual falsification power.

## Gate 4 — material composed-product checkpoint

Use a Cora + human read-only checkpoint when multiple material UI/product slices accumulate, especially when the same user journey changes across tickets or internal domain structure risks leaking into the interface.

Inspect the composed product when practical. Compare it with accepted product authority and interaction hypothesis. Ask whether the user mental model, default path, conceptual load and intended surface remain intact.

This is a composition boundary, not per-writer ceremony.

## Gate 5 — hardening cannot legitimize product drift

Do not spend review/correction effort perfecting an unauthorized or over-complex surface. First prove the surface belongs in the product; then harden it.

Reviewers/correctors may report product-fidelity evidence but do not choose the desired product. Material reconciliation returns to Cora + human.

## Scope

Backend-only and already-bounded work with no triggered safeguard follows the normal thin execution path. Specialized safeguards are invoked because the work requires them, not because Atenea knows they exist.
