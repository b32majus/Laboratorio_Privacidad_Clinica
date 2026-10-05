# Human Product Design Authority V1 — Laboratorio de Privacidad Clínica

> Status: **ACCEPTED PRODUCT AUTHORITY**
> Date: 2026-10-05
> Scope: human product model, interaction invariants, representation and composed usability
> Does not replace: privacy/domain/engine/security authorities
> Supersedes as product authority: any UI implication that follows automatically from domain topology or the former universal five-step presentation

## 1. Purpose

Laboratorio must preserve the correctness recovered in V4 without requiring a healthcare professional to understand the internal architecture that provides that correctness.

The governing product question is:

> I have healthcare information that I need to use outside its original context. Help me prepare it, tell me what I need to check, and give me the correct result for my intended use.

The UI is therefore shaped by human work, not by the number of domain states, aggregates, processing phases or technical authorities underneath it.

## 2. Authorities that remain protected

This authority does **not** reopen the following accepted foundations:

- local-first / no unexpected PHI network runtime;
- memory-only sensitive Job state by default;
- ReviewSession as review authority;
- source offsets as canonical internal anchors, never reconstructed DOM state;
- ProcessingContext for cross-document/longitudinal consistency;
- deterministic policy semantics;
- current Spanish privacy engine/registry/operator architecture;
- fail-closed incomplete review, extraction failure, unsupported input and unresolved structured classification;
- Safe Output / Confidential Audit semantic and physical separation;
- structured Study-ID and correspondence semantics;
- low-confidence candidates remain reviewable;
- no unsupported anonymity, compliance or certification claims;
- current-state / stale-async output guards.

A product change that appears to require weakening one of these foundations is a **HUMAN PRODUCT DECISION / HUMAN STOP**, not an ordinary UI implementation choice.

## 3. Human product model

The ordinary human model is:

```text
ADD INFORMATION
      ↓
PREPARE / REVIEW WHAT NEEDS HUMAN ATTENTION
      ↓
RESULT
```

These are **mental states, not a mandatory universal stepper or three fixed pages**.

The visible workflow adapts to the material:

```text
Text / document
Add → review changes/attention → result

Document batch
Add documents → resolve documents needing attention → batch result

Structured data
Add table → prepare/review columns
                 └─ review free-text cells only when present
          → result
```

A phase with no human task must not become a ceremonial screen merely because it exists in the domain pipeline.

## 4. User concepts

Concepts that may be first-class when useful:

- original information;
- intended use / destination;
- proposed changes;
- items needing attention;
- prepared result;
- documents, when there are several;
- internal confidential correspondence/audit, when deliberately requested.

The following are **not prerequisite user vocabulary**:

- Job / JobKind;
- ReviewSession;
- ProcessingContext;
- transform plan;
- Class → Action;
- Privacy Gate;
- Safe Output as an internal class name;
- restored as an internal status name;
- source offsets;
- authority/revision implementation vocabulary.

They may remain in code, tests, diagnostics and specialist help. Their existence does not grant them a screen, route, card, button or navigation destination.

## 5. Binding human-product invariants

### HPD-01 — Task before topology

Human work determines the visible interaction. Domain topology does not determine screens or navigation.

### HPD-02 — No visible no-op step

A visible phase must contain a real human decision, task or necessary orientation. A screen whose message is effectively “nothing to do here; continue” is a product defect.

### HPD-03 — Quiet automation

If the product can infer or perform something safely, the ordinary path does not permanently explain the internal routing. Explanation remains available contextually when the user needs it, when ambiguity exists or when an error must be resolved.

### HPD-04 — Representation follows the material

Text/document, document batch and structured dataset share authorities but do not have to share the same visual grammar.

- document work privileges the document and its changes;
- batch work privileges documents, attention states and local recovery;
- structured work privileges column-level comparison and treatment;
- result work privileges readiness and the next useful action.

### HPD-05 — Review is decision work, not a metrics dashboard

The ordinary review loop prioritizes the content, the current decision and what remains. Counts/filters exist to support work, not to dominate it.

High-volume review must remain usable with realistic density. Exact pane count, auto-next behavior and any explicit bulk-confirmation interaction are implementation decisions, not authority. Whatever implementation is chosen must preserve explicit human review, low-confidence visibility, undo/correction and no silent acceptance.

### HPD-06 — Routine fast; risk deliberate

The 80–90% ordinary path must minimize unnecessary navigation and decisions. Risk-bearing actions may deliberately add friction where that friction communicates a real consequence, especially keeping an original direct identifier and downloading Confidential Audit.

### HPD-07 — No silent acceptance

Convenience or confidence never silently converts an unreviewed proposal into an accepted human decision. Any grouped/bulk review behavior must be explicit about scope, exclude or separately surface exceptional/low-confidence items as required, and remain correctable.

### HPD-08 — Internal mechanics stay internal

A healthcare professional must never have to enter, reason about or understand source offsets, internal enums, aggregate structure or serializer/domain vocabulary to perform an ordinary task.

Manual missed-entity handling is expressed as selecting content and marking/categorizing it; offsets remain an internal authority.

### HPD-09 — Result answers the human ending

The result surface answers three questions immediately:

1. Is this ready to use?
2. What, if anything, still needs attention?
3. What useful action can I take now?

Privacy Gate remains an internal/factual authority but does not require a separate user concept or ceremonial destination.

The primary result action is **contextual**, not universal:

- pasted text may prioritize copy;
- a document may prioritize the useful document download;
- structured data normally prioritizes XLSX over lower-fidelity interchange formats;
- batch prioritizes the useful batch deliverable;
- Confidential Audit is never promoted to the same hierarchy as the shareable/prepared result.

### HPD-10 — Safe and Confidential are intentionally asymmetric

Prepared/shareable result and identifiable internal correspondence remain physically, semantically and visually separate. Confidential access requires deliberate warning/confirmation and must not look like just another equivalent export format.

### HPD-11 — Spanish human language is foundational

Ordinary UI is Spanish-first and describes professional intent rather than internal implementation. Localization is not postponed until after the interaction model is built.

Internal IDs/enums may remain English where invisible to ordinary users. User-visible copy must not overclaim anonymity, safety or legal compliance.

### HPD-12 — Visual hierarchy is functional correctness

Task prominence, density, legibility, state visibility and perceived feedback are functional product requirements.

A technically correct surface fails product qualification when help, evidence, metadata, cards or chrome visually outrank the main job.

### HPD-13 — Realistic density is an acceptance condition

UI acceptance must use data volumes capable of falsifying the interaction claim, not only tiny fixtures.

At minimum, affected surfaces must be exercised with realistic synthetic/no-PHI stress cases such as:

- document review with dozens of detections;
- structured datasets with dozens of columns;
- batch with multiple documents including a local failure;
- long clinical text where next-pending navigation/orientation matters.

Exact fixture sizes are test design choices; the evidence must be strong enough to expose non-scaling representations.

### HPD-14 — Correctable and orientable

At every ordinary stage it must be clear what remains, what just happened, how to continue and how to return/correct a decision without losing unrelated work.

### HPD-15 — Spatial decisions require visual witness, not speculative parallel products

A material interaction/representation decision must be inspected in a rendered, task-realistic form before it is treated as proven.

For Laboratorio, the default witness is the **real application on a bounded implementation branch with synthetic/no-PHI fixtures**, not a separate throwaway mini-application. A detached prototype is required only when the decision cannot be tested safely/cheaply inside the real product or when the human explicitly requests one.

This rule prevents both failures:

- freezing a spatial decision from prose alone;
- creating unnecessary prototype projects when the existing application already provides the correct test bed.

## 6. Surface-specific authority

### 6.1 Input

The first meaningful task is adding information, not learning routing.

Binding direction:

- paste/drop/select/examples are direct entry mechanisms;
- accepted input family is inferred where safely possible;
- format/routing detail is contextual rather than permanent instruction;
- mixed/unsupported inputs fail with actionable explanation;
- intended-use/policy language may be translated into human purpose only when it maps unambiguously to the underlying policy authority.

The exact shell composition and control placement remain implementation decisions.

### 6.2 Text/document Review

Binding direction:

- content is the main work surface;
- ordinary entry should lead quickly to an actionable pending item when one exists;
- advanced filters/metrics do not dominate the default path;
- manual marking never exposes offsets;
- keep-original risk is explained contextually;
- high-volume review has an explicit productivity solution without silent acceptance;
- the user can move back/correct decisions.

Open implementation decisions to settle in the real app:

- two-pane vs three-pane vs adaptive inspector;
- exact next/previous behavior;
- exact explicit bulk-review interaction, if any;
- original/prepared/compare presentation.

These are **not** reasons to create parallel prototype applications.

### 6.3 Structured

Structured is a data-preparation workspace, not a wall of repeated cards.

Binding direction:

- column × interpretation/treatment/state is visible in a comparative table/grid/workspace;
- blockers and effective treatment remain visible without opening hidden detail;
- evidence, confidence, detected proposal and specialist overrides may use contextual disclosure/inspector;
- patient-ID authority is expressed in human language but preserves existing Study-ID semantics;
- free-text review appears as a concrete subtask only when such cells exist;
- an empty/no-op Structured Review destination is not preserved merely for pipeline symmetry.

The final table columns, inspector geometry and exact density remain implementation decisions validated on realistic datasets.

### 6.4 Batch

Batch is the same product operating over multiple documents, not another application.

Binding direction:

- document status/attention is visible in one coherent work queue;
- a local error does not force restart of unrelated successful work;
- retry/remove/dispose actions are contextual and factual;
- cross-document consistency remains underneath without requiring ProcessingContext vocabulary;
- the batch result accounts for every original item;
- large batches support orientation/filtering by attention/error/ready state as needed.

### 6.5 Result

`Result` is the human product ending; serializer formats are capabilities within it.

Binding direction:

- state is immediately understandable: ready / needs attention / blocked, with factual warnings;
- output actions remain unavailable when the authoritative gate blocks them;
- primary action depends on the material/use, not a global format ranking;
- secondary formats remain discoverable without becoming equal-weight chrome;
- Confidential Audit occupies a separate, deliberately sensitive zone;
- returning to review/correction remains possible without losing unrelated accepted decisions.

## 7. Shell and policy guidance

The workspace is the product. The shell must stay quiet enough that the active task dominates.

Binding rules:

- do not require a permanent `Workspace` destination merely to link to the place the user is already in;
- `New`/new work remains a normal visible action;
- destructive session clearing is distinct and may be secondary;
- internal job type is not persistent user context unless it materially helps a task;
- current use/policy remains discoverable;
- full policy documentation does not repeat below every operational surface;
- help/policy detail is available on demand and derives from the same semantic authority.

Exact global navigation is deliberately not frozen by V1.

## 8. Human-product acceptance gates

Any user-facing REC-05→REC-11 candidate must provide evidence proportional to the claims it makes.

### G-HP1 — Primary-task prominence

The first meaningful viewport/state after context is established prioritizes the current human task over documentation/evidence/chrome.

### G-HP2 — No-op absence

No ordinary path requires visiting a screen with no human work solely because the domain has that phase.

### G-HP3 — Domain-language firewall

Ordinary task completion requires no internal IDs, offsets, aggregate vocabulary or pipeline terminology.

### G-HP4 — Routine-friction witness

A representative ordinary journey has an explicit action/context-switch count and no avoidable ceremonial navigation.

### G-HP5 — Realistic-density witness

The chosen representation remains usable on synthetic/no-PHI data large enough to falsify the design claim.

### G-HP6 — Action feedback

Pending/success/failure are perceptible and do not leave the user reasonably wondering whether an action was received.

### G-HP7 — Correction path

Representative decisions can be revisited/corrected without reconstructing the whole job or silently discarding unrelated work.

### G-HP8 — Result comprehension

A user can determine readiness, remaining attention and the appropriate next output action without understanding Privacy Gate or serializer architecture.

### G-HP9 — Safe/Confidential discrimination

Prepared/shareable and confidential/identifiable artifacts cannot reasonably be mistaken for equivalent destinations.

### G-HP10 — Composed journey

Acceptance includes task-level composed journeys, not merely evidence that each component/state exists somewhere.

## 9. Relationship to implementation and Matt/Atenea

Technical/spec grilling remains valuable and is not weakened.

For meaningful UI work the intended sequence is:

```text
human work / intended use
→ human-product invariants + real cases
→ technical/spec grilling
→ implementation in the real product
→ rendered realistic-density inspection
→ composed task evidence
→ review / correction
```

If a spatial choice remains genuinely unresolved, it stays an implementation question until a rendered witness supports it. Do not turn an untested layout hypothesis into domain authority.

## 10. Change control

This V1 may be superseded only by an explicit product decision with evidence.

A HUMAN STOP is required when a requested human-product improvement would materially alter accepted privacy semantics, domain truth, structured linkage, review authority, output separation, concurrency/current-state safety or another protected invariant.

Normal layout/component choices that satisfy this authority do **not** require a new product decision merely because they differ from previous screenshots/spec wording.
