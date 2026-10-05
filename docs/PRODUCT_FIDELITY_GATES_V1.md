# Atenea — Product fidelity gates v1

Status: **CURRENT C-084 PRODUCT-FIDELITY BOUNDARY**
Date: 2026-10-05

## Purpose

A product can drift even when shaping documents still contain the right principles and every implementation ticket passes locally. Atenea therefore protects product intent across **decomposition and composition**, not only during the initial shaping conversation.

For Laboratorio, `docs/HUMAN_PRODUCT_DESIGN_AUTHORITY_V1.md` is the binding project-specific human-product rail for REC-05→REC-11. The canonical Atenea human-product method is additionally pinned by the execution handoff's Atenea SHA.

These gates primarily protect accepted product/interaction authority from drift; they do not create the human experience from internal structure. For material human-facing work, the upstream origin authority is `HUMAN_PRODUCT_DESIGN_AUTHORITY_V1.md`: task before structure, human mental model, representation fit, default-path simplicity, friction budget and the accepted interaction hypothesis are established before Matt/spec grilling and rechecked before freeze.

The recurring failure mode is:

```text
rich internal domain
→ tickets split along internal/aggregate seams
→ each seam becomes a user-facing/browser slice
→ local hardening rewards completeness/losslessness/exact shape
→ slices accumulate
→ composed UI exposes more complexity than the product intended
```

No single step is necessarily incorrect in isolation. The defect is loss of **composed product fidelity** across boundaries.

## Invariants

1. **Internal model richness does not imply user-facing richness.** Domain entities, aggregates, identifiers, versions, solver concepts, schemas and configuration shapes stay internal unless accepted product authority requires the user to reason about them.
2. **Aggregate/module boundaries are not default screen/form/browser-slice boundaries.** Engineering decomposition may follow internal seams; product decomposition follows user outcomes and mental models.
3. **Lossless/exact model representation is not product fidelity by itself.** Accessibility, validation, type safety, exact shape and complete CRUD can make the wrong surface technically excellent.
4. **A locally correct ticket does not prove the composed product.** Several faithful slices can accumulate into a product that violates its original simplicity, workflow or conceptual-load constraints.
5. **Product non-negotiables survive every transformation.** They remain authority through spec synthesis, ticketization, implementation, hardening and promotion.
6. **Representation translation must not silently narrow accepted semantics.** A UI control, form, mapper, adapter, schema, persistence/export shape or other human-facing translation may simplify presentation, but it may not erase distinctions that accepted product/domain authority still requires users or downstream behavior to represent.
7. **Functional blast radius is defined by behavior and dependency, not by diff paths.** A change to a shared helper, generator, mapper, serializer, state/async authority or other common seam can alter supported consumers whose own files remain byte-identical. `NO TOCA` applies to supported behavior, not merely to filenames.

## Gate 0 — source-to-ticket completeness

Before a material user-facing ticket becomes execution authority, prove that accepted product obligations have not fallen between documents:

- trace frozen audit/debt rows, product/heritage rows and any later accepted reconciliation rows to an explicit owner;
- for Laboratorio, include the matrix `PDR-01…PDR-12` overlay and the applicable HPD gates;
- an accepted requirement with no owner, contradictory owners or a dependency that has not landed is a HUMAN STOP;
- later product authority may deliberately supersede an older UI prescription, but the supersession must be explicit and must preserve/map the underlying human need where it still applies.

This gate prevents a polished ticket set from being incomplete before implementation even starts.

## Gate 1 — ticketization fidelity

Before material tickets become execution authority, check the proposed decomposition against the original brief, non-negotiables and reconciled spec.

- Each product-facing ticket should deliver a user outcome, not merely expose an internal aggregate/module.
- An internal seam may justify an engineering task but does not authorize a new visible page, form, mode, workflow or configuration concept.
- New user-facing concepts/decisions require explicit product authority and a reason the simpler existing model cannot satisfy the accepted need.
- For material UI tickets, state the **user-facing concept delta** (often `NONE`) and the product boundary the slice must preserve.
- Read the full ticket set as one future product before execution. If literal implementation would create an unintended product, reconcile the tickets first.

## Gate 2 — representation narrowing check

When a change translates already-accepted semantics into a new representation, compare the **meaning representable before and after** the change. Ask:

> Can every state, value or distinction that accepted authority requires still be represented after this change?

Check proportionately for unauthorized loss of:

- precision or granularity, including temporal precision/timezone semantics;
- cardinality or multiplicity;
- valid ranges or boundary values;
- states, enum members or open-vocabulary values;
- combinations of independently meaningful choices;
- ordering when order is semantic;
- distinctions such as `unset` / `unknown` / `not applicable` / explicit value;
- any other representable distinction preserved by accepted product/domain authority.

Typical narrowing examples include `instant → date-only`, `multiple values → single select`, `open vocabulary → closed taxonomy`, `arbitrary interval → fixed bucket`, `exact quantity → boolean`, or an optional distinction becoming a silent default.

This guardrail does **not** require exposing internal-only richness. A richer internal model, by itself, is not product authority. The check triggers when the accepted user/product/domain semantics themselves allow a distinction that the proposed representation would collapse.

If a material narrowing is not already authorized explicitly, it is a **HUMAN STOP / product-semantic decision**, not an implementation detail for an agent to choose.

## Gate 3 — affected-surface / invariant-propagation check

When a change touches a shared authority/seam or when a review/correction exposes an invariant that may recur in sibling branches, trace the **materially affected supported consumers and parallel paths**, not only the files in the diff. Ask:

> Which supported journeys/consumers can observe this changed authority, and which sibling branches are expected to preserve the same invariant?

Check proportionately that:

- supported consumers of a changed shared helper/generator/mapper/serializer/state authority are enumerated or mechanically traced when material;
- a consumer is not classified as unaffected merely because its own file has no diff;
- a declared `NO TOCA` surface has no unauthorized indirect behavior change; if the shared change intentionally reaches it, that behavior/evidence must already be authorized;
- when a defect or guard is found in one branch of a parallel flow, sibling branches implementing the same invariant are checked for the same failure class before the envelope is considered closed;
- async/current-state guards, authorization checks, serialization rules and other cross-cutting invariants are propagated wherever the same authority boundary exists;
- evidence covers every materially affected supported journey needed to justify publication, rather than only the directly edited entry points.

This does **not** authorize agents to broaden product scope or repair every transitive consumer opportunistically. If source tracing reveals a materially affected supported surface outside the current authority/evidence envelope, or an explicit `NO TOCA` behavior would change indirectly, that is **HUMAN STOP / scope reconciliation**. A new material sibling defect found after review is a new finding/bounded unit, not a hidden extension of an old correction envelope.

## Cross-profile evidence lens — adversarial property witness

When accepted authority or an authorized finding makes a **universal, negative, preservation or boundary claim**, evidence must include at least one fixture capable of falsifying that exact property if the implementation is wrong. A nominal positive example is not proof of a universal claim.

Typical trigger language includes `all`, `every`, `never`, `preserve`, `lossless`, `distinguishable`, `only after`, `irreducible`, `unique` and equivalent statements whose truth depends on a boundary rather than one representative example. Apply the lens proportionately:

- `multiple entities remain distinguishable` → include a collision case where their obvious human summaries coincide;
- `preserve all accepted semantics` → exercise a last-frontier/rare accepted semantic, not only the primary case;
- `never exposes X` → exercise a case where X is actually present upstream;
- `only after boundary B` → test immediately before/at/after the relevant boundary as needed;
- `lossless` / `preserve cardinality` / `preserve ordering` → use input that would reveal collapse, truncation or reordering rather than an input where both representations happen to agree.

**Evidence claims must not exceed falsification power.** Statements such as `all A1..An verified` are justified only when the evidence actually exercises the adversarial property behind each material claim; nominal examples may be reported as nominal coverage, not universal proof. Likewise, full-suite baseline attribution reports the actual failing test identities observed in that run. If baseline failures vary between runs, report **unstable baseline debt** rather than claiming one deterministic red.

This is a lightweight reviewer/corrector evidence lens, not a new product gate or a mandate for extra tests on every sentence. It does not authorize new semantics, wider scope, or speculative edge-case invention: strengthen evidence only where the accepted requirement/finding itself makes a material universal, negative, preservation or boundary claim.

## Gate 4 — material UI composed-product checkpoint

Use a Cora + human read-only product-fidelity checkpoint when material UI is accumulating across tickets/slices, especially when:

- two or more tickets modify the same user journey or configuration surface;
- ticket boundaries resemble internal aggregates/domain objects;
- a slice adds user-visible entities, states, workflows, modes or decision burden;
- the product has explicit simplicity/complexity-firewall principles;
- local hardening is making a surface more complete without proving that the surface itself should exist.

Inspect the **actual composed product** when practical (running UI, screenshots or equivalent high-fidelity evidence), not only code/diff/ticket text. For material human-facing work, include the `HUMAN_PRODUCT_DESIGN_AUTHORITY_V1.md` **composed human-task walkthrough** over the important real journey(s), rather than checking only that internal concepts/IDs stayed hidden. Compare it with original product authority **and the accepted interaction hypothesis when one exists**, then ask:

- Does the interface still express the intended user mental model and primary task?
- Has internal domain structure leaked into what the user must understand?
- Has the number of concepts, choices, forms or workflows materially increased?
- Are we preserving a product principle only in prose while the rendered product contradicts it?
- If all currently accepted slices remain, is this still the product Cora + human intended?

A material mismatch is **HUMAN STOP / product reconciliation**, not a request for OpenCode to redesign autonomously.

## Gate 5 — hardening cannot legitimize product drift

Technical hardening is subordinate to accepted product surface. Do not spend review/correction effort making an unauthorized or over-complex UI perfectly lossless, exact, accessible or exhaustive. First prove the surface belongs in the product; then harden it.

Reviewers/correctors may report evidence that suggests product drift, but they do not choose the desired product. Material reconciliation returns to Cora + human.

## Scope

These gates are **conditional**, not ceremony for every ticket. The composition gates apply when product/UI composition risk is material. The representation-narrowing check also applies to non-UI translations (for example adapters, schemas, persistence or export) when accepted semantics could be collapsed. The affected-surface/invariant-propagation check applies when a shared seam can materially change supported consumers or when a discovered defect/guard plausibly repeats across sibling branches. The adversarial-property-witness lens applies only when the accepted requirement/finding makes a material universal, negative, preservation or boundary claim whose evidence could otherwise pass through a comfortable nominal fixture. Backend-only or already-bounded work with none of these risks continues through the normal C-084 path without a product-composition ritual.
