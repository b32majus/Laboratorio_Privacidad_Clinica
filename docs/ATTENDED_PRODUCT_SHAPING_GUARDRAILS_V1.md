# Atenea — Attended product shaping guardrails v1

Status: **CURRENT C-084 SHAPING BOUNDARY**
Date: 2026-10-04

## Purpose

Product-shaping methods may be intentionally exhaustive. Exhaustiveness is useful for finding hidden assumptions, but it can also create a **complexity-expansion bias**: a question can become a design decision merely because it was possible to ask and answer it.

Atenea therefore separates clarification from expansion. Material shaping remains attended Cora + human work, and expansive methods such as `grilling → to-spec → to-tickets` operate inside explicit product boundaries rather than defining those boundaries themselves.

For material human-facing work, this document is downstream of `HUMAN_PRODUCT_DESIGN_AUTHORITY_V1.md`. First establish the human task and accepted interaction hypothesis; distinguish material human-work claims as `OBSERVED` / `REPORTED` / `ASSUMED` when provenance matters; use `/research`, `/to-questionnaire` or equivalent discovery only when they materially reduce uncertainty; then use Matt/spec grilling to harden ambiguity, contracts and edge cases. Matt is the **second filter**, not the primary author of navigation, representation or interaction hierarchy. Material unresolved spatial/interaction questions use the conditional prototype gate from the human-product authority rather than being closed by prose alone.

Canonical sequence:

```text
PRODUCT INTENT
→ HUMAN WORK FRAME / interaction hypothesis
→ conditional research/questionnaire/prototype evidence
→ MATT / SPEC GRILLING
→ composed human-product grill
→ HUMAN PRODUCT RECHECK
→ FREEZE / BUILD
```

## Before expansive shaping: freeze the product rails

Before a material grill or equivalent shaping session, Cora + human record the smallest useful set of **NON-NEGOTIABLE PRODUCT BOUNDARIES**. These are constraints, not preference questions.

Typical rails include:

- the product promise / problem being solved;
- simplicity or conceptual-load constraints;
- user-facing concepts that must not be exposed merely because they exist internally;
- scope/non-goals and explicit complexity budget;
- safety/privacy/trust constraints;
- "prefer the simpler product unless an observed requirement proves the extra concept necessary."

When a possible shaping branch conflicts with a non-negotiable boundary, **prune the branch rather than asking the user to design it**. "We can model it" or "we can ask about it" is not evidence that the product needs it.

A proposed new user-facing entity, state, workflow, role, configuration concept or decision burden requires an explicit reason the current product model cannot satisfy the accepted need. Otherwise prefer no new concept.

## Conditional fidelity checkpoints

These checkpoints are lightweight, read-only and **conditional**. Use them when shaping is materially expansive (for example a broad grill, new product surface, major redesign or a chain that will synthesize many answers into spec/tickets). Do not impose them on an already-executable bounded ticket by ritual.

### 1. Post-grill product-boundary audit

Compare **original brief + non-negotiables** against the complete grill result before `to-spec`.

Report only:

- clarifications that preserved product scope;
- decisions that added product/user complexity;
- which additions are explicitly justified by an observed requirement;
- which conflict with the original boundaries or should never have been opened;
- what must be discarded/reconciled before synthesis.

No grill answer becomes spec authority merely because the user answered the question.

### 2. Post-spec fidelity + human-product recheck

Before `to-tickets`, compare **original brief + non-negotiables + reconciled shaping authority** against the generated spec. For material human-facing work, also compare it with the accepted interaction hypothesis from `HUMAN_PRODUCT_DESIGN_AUTHORITY_V1.md`.

Ask: does the spec preserve the intended product and ordinary human workflow, or did synthesis turn optional/internal richness into required product surface? Did technical completeness add navigation, equal-weight choices, concepts or friction that the interaction hypothesis did not authorize? Remove/reconcile unsupported expansion before ticketization.

### 3. Post-ticket product-composition audit

Before `EXECUTION_READY` / `READY_TO_LAUNCH`, read the ticket set as a composed product:

> If every ticket is implemented literally, what product will exist? Is it still the product Cora + human intended?

STOP if the composition introduces material concepts, workflows, states, roles, configuration burden or complexity not already justified by accepted product authority.

## Ownership

Cora conducts the comparison and challenges drift; the human remains present for material product choices. OpenCode/agents may gather bounded evidence, but they do not adjudicate whether product expansion is desirable.

These checkpoints do not replace engineering review. They protect **product fidelity before implementation authority exists**. They are necessary but not sufficient for material UI: `PRODUCT_FIDELITY_GATES_V1.md` carries the same product boundaries through ticket decomposition, UI implementation/hardening and composed-product checkpoints.
