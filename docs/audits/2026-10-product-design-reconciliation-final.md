# Product Design Reconciliation — Final Decision Record

> Status: **RECONCILED / ACCEPTED DECISION INPUT**
> Date: 2026-10-05
> Repository: `b32majus/Laboratorio_Privacidad_Clinica`
> Canonical V4 inspected: `3.0-main@f6e1a0cdd638bb25a7341ec15cd3735ed586ae9b`
> V3 reference inspected: `331bcaf4a624659c77823a0c4b427d46347ea104`
> Binding output: `docs/HUMAN_PRODUCT_DESIGN_AUTHORITY_V1.md`

## 1. Sources reconciled

This decision reconciles:

1. the frozen September UX/product-flow audit;
2. the implemented V4 product at the canonical base above;
3. V3 product heritage;
4. Cora's first-pass draft `docs/audits/2026-10-product-design-reconciliation-draft.md`;
5. an independent adversarial product-design review supplied on 2026-10-05 with verdict **GO WITH MATERIAL CHANGES**;
6. the process lesson from the parallel Symphonia product-design reconciliation: a semantically correct spec can still under-specify spatial prominence, density and human interaction, while detached prototypes are not automatically the right answer for an already-built product.

The independent review agreed with the central diagnosis but rejected freezing several concrete layout hypotheses prematurely.

## 2. Final verdict

**GO WITH MATERIAL CHANGES — preserve V4 core; reshape the human product layer before continuing REC-05→REC-11.**

V4 remains the correct technical/domain foundation. It is not the user-facing composition that should simply be completed as currently specified.

This is not a product reset and not a return to V3.

Target synthesis:

> V3 immediacy and human orientation + V4 authority/safety + a reconciled interaction layer.

## 3. What is now accepted

### A-01 — Human task, not domain topology, governs visible structure

The former universal `Input → Configure → Review → Privacy Gate → Export` sequence is no longer product authority.

Internal phases may remain exactly as needed. A phase without human work does not earn a screen.

### A-02 — Human mental model

The governing mental model is:

```text
Add information → prepare/review what needs attention → result
```

This is not a fixed three-screen stepper.

### A-03 — Privacy Gate becomes invisible authority, not mandatory vocabulary

Its readiness rules survive. The ordinary human ending is `Result`, which communicates blocked / needs attention / ready plus factual warnings and available actions.

### A-04 — Review is work, not dashboard inspection

The default experience prioritizes content/current decision/remaining work. High-volume productivity is required. The exact two/three-pane composition and bulk mechanics are not frozen.

### A-05 — Manual missed entity never exposes offsets

Selection/mark/categorize is human interaction; offsets remain internal authority.

### A-06 — Structured needs a comparative data-workspace representation

Repeated per-column cards do not scale. Column treatment/state must be scannable comparatively, with technical evidence/overrides contextual.

### A-07 — Batch is a work queue with local recovery

One failure must not destroy successful unrelated work. Retry/remove/disposition and batch result belong to the same application/workspace.

### A-08 — Result action is contextual

Copy is not universally primary. The useful primary action depends on material and intended use. Safe/Confidential separation remains stronger than format convenience.

### A-09 — Spanish and visual hierarchy begin now

Spanish human vocabulary and baseline hierarchy/density are product foundations, not a late translation/reskin pass. REC-10/11 retain final closeout ownership but no earlier user-facing REC may ignore those foundations.

### A-10 — Realistic density is product evidence

Small fixtures are insufficient to prove a review/table/batch representation. Claims must be falsifiable on realistic synthetic/no-PHI density.

## 4. What remains deliberately open

These are **implementation decisions**, not missing product authority:

- Review: two panes, three panes, adaptive inspector or another composition satisfying the invariants;
- exact auto-next / next-previous mechanics;
- whether and how explicit bulk confirmation is useful without enabling rubber-stamping;
- original/prepared/compare presentation;
- exact shell navigation/chrome;
- exact structured table columns and inspector geometry;
- exact responsive transitions and final visual polish;
- exact result-format presentation per material.

They are resolved by bounded implementation in the real application plus realistic synthetic task evidence. They do not justify parallel mini-apps by default.

## 5. Explicitly rejected / superseded

### R-01 — Universal five-step UI as product topology

Superseded. Internal state machine may remain.

### R-02 — No-op Configure/Review destinations for symmetry

Superseded. Human work only.

### R-03 — Persistent full policy cards below ordinary work

Superseded as default composition. Detailed policy guidance remains available contextually/from dedicated help and must derive from the same authority.

### R-04 — Offset-entry manual detection

Rejected for ordinary UI.

### R-05 — Repeated structured column cards as scalable final representation

Rejected.

### R-06 — Copy as universal primary output CTA

Rejected. Output hierarchy is contextual.

### R-07 — Separate throwaway prototype train as mandatory precondition

Rejected for Laboratorio.

Rendered interaction evidence is still required, but the real application on bounded branches is the default test bed. Detached prototypes remain optional for genuinely isolated spatial uncertainty.

## 6. Correction to Cora's draft

The draft's central diagnosis stands: V4 is a stronger system than current human product and the recovery train was at risk of completing the wrong visible composition.

Material corrections accepted from the independent review:

- do not freeze three-pane Review;
- do not treat auto-next alone as the high-volume solution;
- add explicit high-volume review requirement and correction/undo path;
- hide offsets completely;
- Copy is primary only where human work makes it primary;
- Structured severity is HIGH on present evidence, without claiming CRITICAL solely from an 11-column fixture;
- shell simplification may go further than the first draft;
- realistic density and user comprehension are acceptance evidence, not polish.

The external recommendation to build three separate prototypes before REC-05 is **not adopted as the operational plan**. Its underlying principle — do not freeze spatial interaction from prose alone — is preserved as HPD-15 using the real product as the default witness.

## 7. Consequence for REC-05→REC-11

No remaining user-facing REC is executed literally from its pre-reconciliation wording.

The IDs remain for traceability and to avoid inventing a parallel recovery program, but their product responsibilities are reshaped under `HUMAN_PRODUCT_DESIGN_AUTHORITY_V1.md`.

Key changes:

- REC-05 becomes **Result + single-output parity**, preserving its technical serializer/security contract while changing the human interaction model;
- REC-06 becomes **batch work-queue/recovery parity**;
- REC-07 becomes **batch Result parity**;
- REC-08 becomes **human input/productivity parity**, with routing explanation demoted;
- REC-09 becomes **dynamic IA + Review productivity**, including no-op-step removal, high-volume review and no-offset manual marking;
- REC-10 becomes **Spanish human-language foundation + final localization closeout**;
- REC-11 becomes **visual hierarchy/density foundation + final visual closeout**.

REC-10/11 foundations are effective immediately; their final exhaustive closeouts remain late to avoid polishing transient surfaces twice.

## 8. REC-05 stop/resume decision

The previous REC-05 handoff prepared before this reconciliation is no longer execution-authoritative.

The earlier HUMAN STOP occurred before WU-A with zero product mutation; therefore there is no implementation to undo.

REC-05 may resume only from a **new handoff/review anchor** that imports:

- the canonical product base current at relaunch;
- current Atenea authority;
- this reconciliation;
- `HUMAN_PRODUCT_DESIGN_AUTHORITY_V1.md`;
- the reshaped REC-05 contract in the Recovery Master Plan.

No separate prototype project is required before that relaunch.

## 9. Product evidence policy going forward

For user-facing work, technical correctness remains necessary but is not sufficient.

A candidate may fail product qualification when, despite correct domain behavior:

- the main task is visually secondary;
- a no-op phase is exposed;
- realistic density breaks the representation;
- internal vocabulary leaks into ordinary work;
- the user cannot tell what remains or what just happened;
- the result hierarchy encourages the wrong artifact/action;
- Safe and Confidential are too easy to confuse.

This is the authority imbalance the reconciliation is intended to correct.

## 10. Final operating decision

Continue recovery on the real application.

Do **not** create a parallel mini-product/prototype train.

Use bounded branches, synthetic/no-PHI realistic fixtures, rendered inspection, task-level E2E and human review to resolve the remaining interaction choices while preserving the recovered V4 authorities.
