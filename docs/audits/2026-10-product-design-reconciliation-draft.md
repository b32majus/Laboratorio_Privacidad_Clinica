# Laboratorio de Privacidad — Product Design Reconciliation (DRAFT)

Status: **DRAFT — NOT PRODUCT AUTHORITY**
Date: 2026-10-05
Repository: `b32majus/Laboratorio_Privacidad_Clinica`
Canonical V4 inspected: `3.0-main@f6e1a0cdd638bb25a7341ec15cd3735ed586ae9b`
V3 product reference inspected: `331bcaf4a624659c77823a0c4b427d46347ea104`
Purpose: reconcile the product as a human clinical tool before resuming user-facing recovery work REC-05→REC-11.

> This document is deliberately provisional. It records Cora's first product-design reconciliation so it can be challenged by an independent adversarial product/UX review before any Human Product Design Authority, REC-05 reshape, Recovery Plan change or product freeze is accepted.

## 0. Executive verdict

The current V4 is a substantially stronger **system** than V3: the SPA, Job authority, ReviewSession, policy model, Safe/Confidential separation, fail-closed behavior, structured semantics and recovery guarantees are coherent and should be preserved.

It is not yet a substantially stronger **human product**.

The principal residual problem is not a broken architecture. It is **translation from product/domain structure into interaction**. V4 still exposes too much of how the system is organized, asks the user to traverse states that contain no human work, gives explanatory/technical information excessive permanent visual weight, and in structured workflows makes the completeness of the domain model become the completeness of the screen.

The intended synthesis is not “go back to V3” and not “polish V4 later”. It is:

```text
V3 human immediacy + warmth + purpose
        +
V4 correctness + safety + coherent domain + SPA
        +
explicit human-product authority
        =
final Laboratorio product
```

**Provisional recommendation:** keep REC-05 implementation stopped before WU-A until this draft has received an independent adversarial product-design review and the two views have been reconciled. Do not invalidate D-023 or any recovered domain authority merely because the interaction hierarchy may change.

## 1. Audit question

This reconciliation does **not** ask whether the implementation is technically correct. That has separate assurance.

It asks:

> If a competent healthcare professional who does not know our internal model opens Laboratorio, is the normal work obvious, fast, reassuring and practical without having to learn our Job/Policy/Configure/Gate/export architecture?

Secondary questions:

- Does the UI follow the user's task before the domain topology?
- Is the ordinary path much simpler than exceptional paths?
- Is information shown at the moment it helps rather than because it exists?
- Do text, document, batch and structured feel like one product without forcing the user to understand their implementation differences?
- Does the representation fit the work (document review, batch triage, data classification, result delivery)?
- Does the visual hierarchy communicate what to do next?
- Does the product retain enough warmth and intentional design to invite use while remaining a professional clinical workstation?

## 2. Evidence inspected

### 2.1 Current V4

Runtime inspection was performed from `f6e1a0c…`, including:

- Input / new job;
- text job creation;
- unstructured Configure;
- text Review with a synthetic Spanish clinical note;
- Privacy Gate blocked state;
- Structured Configure using the committed psoriasis CSV fixture;
- Export implementation and structured Safe/Confidential zones;
- Batch review implementation and current readiness behavior.

Primary implementation surfaces inspected:

- `app-v4/src/App.tsx`
- `app-v4/src/review/ReviewWorkspace.tsx`
- `app-v4/src/review/BatchReviewView.tsx`
- `app-v4/src/structured/StructuredConfigureWorkspace.tsx`
- `app-v4/src/privacy-gate/PrivacyGate.tsx`
- `app-v4/src/export/ExportStep.tsx`
- `app-v4/src/useJobSession.ts`
- `app-v4/src/index.css`
- `app-v4/tailwind.config.cjs`

Frozen/current authorities used for comparison:

- `docs/audits/2026-09-ux-ui-product-flow-audit.md`
- `docs/specs/SPEC_V4_APP_AND_REVIEW.md`
- `docs/specs/SPEC_V4_BATCH_AND_STRUCTURED.md`
- `docs/RECOVERY_MASTER_PLAN_2026-10.md`
- `docs/PRODUCT_FIDELITY_GATES_V1.md`
- `docs/ATTENDED_PRODUCT_SHAPING_GUARDRAILS_V1.md`

### 2.2 V3 reference

The original product reference `331bcaf…` was inspected to distinguish useful human-product qualities from legacy architecture that must not be restored blindly.

### 2.3 Frozen screenshots

Synthetic/no-PHI runtime screenshots captured during this draft are stored in:

`docs/audits/evidence/product-design-reconciliation-20261005/`

- `v4-input.png`
- `v4-review.png`
- `v4-structured-configure.png`
- `v3-input.png`
- `v3-landing.png`

These screenshots are evidence of the inspected state, not reference designs to reproduce.

## 3. What should survive unchanged at product-design level

The reconciliation does **not** propose reopening these because the current evidence supports them as strong product/domain foundations:

- one SPA and one in-memory sensitive Job session;
- automatic inference of text/document/batch/structured from input;
- local-only processing as a factual property;
- ReviewSession as the review/final-text authority;
- explicit human review before Safe output;
- low-confidence/manual detections as reviewable facts;
- four accepted privacy policies and one engine authority;
- Safe Output / Confidential Audit physical and semantic separation;
- fail-closed pending review, unknown structured classification, extraction failure and unsupported input;
- ProcessingContext for batch/longitudinal consistency;
- deterministic Study-ID / patient linkage semantics;
- current async/current-authority safeguards;
- no unsupported anonymity/compliance/privacy score claims;
- desktop as the principal professional surface while retaining functional responsive behavior.

A product-design change should wrap or present these differently, not silently create alternate authorities.

## 4. Core findings

### PDR-01 — The application still explains its internal routing before the user needs it

**Severity:** HIGH
**Surface:** Input / shell

The current initial screen already infers job type correctly, but also dedicates a full visible block to explaining:

```text
Pasted clinical text → Text job
One document → Document job
Two or more documents → Document batch
CSV/XLS/XLSX → Structured job
```

This is truthful system documentation, but it asks the user to understand a distinction that the product has already automated.

The same screen also exposes `Job`, `Type`, four policy choices, five workflow steps, local-processing copy and a full four-card policy guidance area before ordinary work has begun.

**Product consequence:** the UI still transfers part of the architecture-learning burden to the user even after V4 technically removed the routing decision.

**Provisional direction:** lead with the work: paste information or add files, select/confirm intended use when useful, start. Move routing explanation to contextual Help/error states.

### PDR-02 — `Configure` is domain topology materialized as a screen for jobs with no configuration work

**Severity:** HIGH
**Surface:** canonical workflow

For text/document jobs, the current Configure page exists primarily to say that no additional configuration is required and to instruct the user to continue to Review.

This is a direct example of domain topology becoming product topology.

**Provisional direction:** do not require the user to traverse a visible phase when there is no human work. Configure may remain a domain state and may remain a visible contextual phase for structured jobs, but it should not automatically be a user-facing destination for every job kind.

### PDR-03 — The five-step workflow is coherent internally but likely too technical as the primary mental model

**Severity:** HIGH
**Surface:** overall IA

Current visible model:

```text
Input → Configure → Review → Privacy Gate → Export
```

This is excellent as an implementation/process contract. It is not yet proven to be the best human mental model.

**Provisional interaction hypothesis:** the ordinary mental model may be closer to:

```text
Añadir información → Revisar → Resultado
```

with contextual sub-work only when needed:

```text
structured: Añadir datos → Preparar columnas → Revisar → Resultado
batch:      Añadir documentos → Revisar lote → Resultado
text/doc:   Añadir → Revisar → Resultado
```

This is a hypothesis to challenge externally, not accepted authority.

### PDR-04 — Privacy Gate is valuable authority but may not deserve a separate concept/page

**Severity:** MEDIUM-HIGH
**Surface:** post-review / output

The current Gate is one of V4's strongest safety ideas. It answers factual readiness and avoids unsafe scores/certification.

The product question is whether users should learn “Privacy Gate” as a distinct navigation destination between Review and Export.

**Provisional direction:** preserve the gate model/authority but consider presenting it as the readiness state of `Resultado`:

- `Todavía no está listo` → why + return to pending;
- `Listo para usar` → Safe actions;
- `Atención` → kept originals/warnings;
- Confidential Audit remains distinctly separated.

This would preserve every safety invariant while reducing one visible product concept.

### PDR-05 — Review has the correct architecture but the default path is not yet ruthlessly fast

**Severity:** HIGH
**Surface:** text/document Review

The three-pane concept from the frozen UX audit is fundamentally strong. The current implementation nevertheless gives substantial permanent weight to:

- nine progress facts;
- seven status-filter controls plus type filter;
- full detection list;
- document;
- preview;
- entity inspector;
- instructional copy;
- full policy guidance below the workspace.

In the inspected synthetic six-detection example, the screen exposed roughly 27 buttons while the central document occupied only part of the available working surface.

**Provisional direction:** make the review loop the dominant interaction:

1. select first pending automatically;
2. Accept / Modify / Keep original act in one stable inspector;
3. after a decision, advance to the next pending by default;
4. keyboard workflow becomes first-class;
5. ordinary progress compresses to a few meaningful facts (`pending`, `needs attention`, `reviewed`);
6. detailed counts/filters remain discoverable but secondary;
7. policy detail leaves the permanent review canvas.

The final design must still support manual detection, low-confidence review and deliberate keep-original safety.

### PDR-06 — Structured Configure currently exposes technical completeness instead of prioritizing uncertain human decisions

**Severity:** CRITICAL for product usability
**Surface:** structured workflow

This is the clearest current example of the Symphonia-style failure mode.

For the committed psoriasis CSV, the current workspace rendered 11 column cards with repeated visible facts and controls: classification, action, date role, evidence, reviewer classification and, where applicable, reviewer action. Columns already understood by the system receive almost the same visual weight as columns that genuinely require a decision.

The implementation is rigorous and honest. The interaction is cognitively expensive.

**Provisional direction:** return toward the frozen audit's data-classification workspace:

```text
COLUMN              WHAT IT IS          WHAT WE WILL DO       STATE
NHC                 Identifier          Study ID              ✓
Nombre              Identifier          Remove                ✓
Fecha_Nacimiento    Personal date       Generalize            ⚠ Review
PASI                Unknown             —                     ⚠ Review
...
```

Key principles:

- summarize how many columns are already resolved vs require attention;
- ask for the patient-ID authority prominently when required;
- keep the full table visible for situational awareness;
- use progressive disclosure for evidence, confidence, detected proposal and technical override detail;
- focus visual priority on unresolved/ambiguous columns;
- preserve Class→Action and all fail-closed domain rules underneath.

### PDR-07 — Privacy Policy is well modelled but overrepresented in ordinary screens

**Severity:** MEDIUM-HIGH
**Surface:** shell/Input/Review/Gate

The four policies now have meaningful deterministic semantics. The current UI repeats a four-card explanatory policy region at the bottom of ordinary workspaces.

This is documentation with persistent product-level visual weight.

**Provisional direction:** show the current policy/use compactly in the shell and offer contextual `Qué cambia` / Policies detail on demand. Full policy guidance should remain accessible, but not compete continuously with the clinical task.

A possible vocabulary question for external challenge: whether the ordinary user should primarily choose a named internal `Privacy Policy`, or answer the more human question `¿Para qué vas a utilizar el resultado?` with named policy details available underneath. This must not create a second policy authority.

### PDR-08 — The shell reads partly like a diagnostic/control header rather than a quiet professional workspace

**Severity:** MEDIUM
**Surface:** global shell

Persistent content currently includes:

- New Job;
- Clear session;
- explanatory paragraph distinguishing those actions;
- Job name;
- Type;
- Privacy Policy selector;
- local-only statement;
- five-step navigation.

All are defensible individually. Together they consume significant attention before the active task.

**Provisional direction:** quiet shell with only high-value current context and actions; place destructive/infrequent controls in a secondary menu while preserving accessibility and explicitness.

### PDR-09 — Export capabilities must not be translated mechanically into equal-weight controls

**Severity:** HIGH
**Surface:** REC-05 / REC-07

REC-05 correctly defines Copy/TXT/DOCX/PDF/Confidential semantics. That technical contract does not prove that five equally prominent actions are good interaction design.

**Provisional text/document hierarchy:**

```text
RESULTADO PREPARADO

[ Copiar resultado ]          primary

Descargar
DOCX   PDF   TXT              secondary formats

──────────────────────────
Auditoría confidencial        separate / sensitive
Contiene información identificable
[ Ver opciones ]
```

For structured, the primary safe format may reasonably be XLSX with CSV secondary, subject to user/workflow evidence.

Confidential Audit must remain physically and visually distinct with its additional deliberate confirmation.

### PDR-10 — REC-11 cannot be treated as “make whatever we built pretty at the end”

**Severity:** HIGH
**Surface:** recovery sequencing

The current scaffold is functional but visually uniform. The frozen UX audit already states that aesthetic usability is part of hierarchy and cognition, not decoration.

If REC-05→10 create final interactions using the current flat hierarchy and REC-11 later attempts to turn them into a clinical workstation, major surfaces may need to be designed twice.

**Provisional direction:** separate visual-system **foundations** from final visual recovery. Establish spacing, hierarchy, typography, surface roles, control hierarchy and semantic colors before or alongside the next user-facing interaction work; leave final polish/reference-state completion to REC-11.

## 5. V3 reconciliation — recover qualities, not architecture

V3 should not be restored as a product model. It did, however, express several useful human-product qualities more strongly than current V4:

### Qualities worth recovering

- Spanish-first visible product;
- obvious single primary action;
- synthetic examples that make the tool understandable immediately;
- warmer and more deliberate visual identity;
- language closer to user purpose than to implementation;
- sense that the tool is meant to be used, not inspected.

### Legacy decisions that should stay retired/superseded

- multiple operational HTML pages / broken continuity;
- second landing before the task;
- `Modo Batch Premium` as a product distinction;
- red permanent legal/disclaimer band;
- unsupported or misleading safety language such as `Datos seguros`;
- opaque `Modo estricto` checkbox;
- unsafe mixed PDF/report behavior;
- source/derived state transport through page/sessionStorage patterns;
- separate visual/application worlds for text, batch and structured.

The target is therefore **not V3 with a safer engine**. It is V4's correct core presented with V3's immediacy and a stronger interaction model than either version.

## 6. Provisional Human Product Model

This model is proposed for external challenge.

### 6.1 Product definition

> **Laboratorio de Privacidad is a local tool that helps healthcare professionals prepare clinical information before using or sharing it outside its original context, with explicit human review and a separate confidential trace when needed.**

### 6.2 User-visible concepts that should be sufficient for ordinary use

- **Información original** — what the user provides;
- **Uso/destino del resultado** — why the preparation is being performed;
- **Elementos que necesitan revisión** — decisions the system cannot safely make alone;
- **Resultado preparado** — the deliverable the user may copy/download after readiness rules pass;
- **Auditoría confidencial** — an advanced/sensitive internal trace, deliberately separate;
- **Documentos** — when working with a batch.

Internal concepts that should not gain automatic UI prominence merely because they exist:

- JobKind;
- ProcessingContext;
- ReviewSession;
- transform plan;
- Class→Action authority;
- output preparation identity;
- internal status enums;
- engine/operator terminology.

Some may surface contextually for expert workflows, but not as prerequisites to ordinary use.

## 7. Provisional Core Journeys

These are the journeys against which future IA/screens should be evaluated before implementation:

1. **Paste clinical text and prepare it for use with an external AI.**
2. **Upload one DOCX/PDF/TXT and obtain a reviewed copy without direct identifiers.**
3. **Understand quickly what the tool detected and review only the decisions that require human confirmation.**
4. **Mark a sensitive item the tool missed.**
5. **Deliberately keep an original value and understand before committing that it remains in Safe Output.**
6. **Know in a few seconds whether the result is ready to use and, if not, what blocks it.**
7. **Copy the prepared result with one obvious action.**
8. **Download the prepared result in a useful format without learning serializer details.**
9. **Process a set of documents and immediately see which are complete, pending, failed or need action.**
10. **Recover from one failed batch document without restarting unrelated work.**
11. **Prepare a longitudinal CSV/XLSX while preserving patient/visit linkage without retaining patient identity.**
12. **Resolve only ambiguous structured columns while still being able to inspect/override the automatic classification.**
13. **Select the authoritative patient-ID column when the structured use requires one.**
14. **Access an identifiable correspondence/audit artifact for an authorized internal purpose without confusing it with the prepared result.**
15. **Clear sensitive in-memory work deliberately when finished.**

The external review should identify missing common hospital/healthcare situations rather than treating this list as complete.

## 8. Provisional Information Architecture / Interaction Model

### 8.1 Ordinary top-level product

A candidate model to challenge:

```text
Laboratorio
│
├── Nuevo trabajo / active workspace
│     ├── Añadir información
│     ├── [Preparar datos — only when real human configuration exists]
│     ├── Revisar
│     └── Resultado
│
├── Políticas / usos
└── Ayuda
```

No PHI-bearing history by default.

### 8.2 Text / single document

```text
Añadir → Revisar → Resultado
```

### 8.3 Structured

```text
Añadir datos → Preparar columnas → Revisar texto libre if applicable → Resultado
```

The domain Gate remains mandatory even if its human presentation is integrated into Resultado.

### 8.4 Batch

```text
Añadir documentos → Revisar lote → Resultado
```

Master-detail is the current leading hypothesis: document list/status remains visible while the selected document uses the same review workspace.

## 9. Friction budget — draft targets

These are provisional targets for later validation, not acceptance criteria yet.

### New ordinary text/document job

- one primary decision/action from opening the app to supplying input;
- no need to choose a pipeline/job kind;
- no empty Configure destination;
- policy/use defaults must be understandable without reading four policy cards.

### Review

- first pending item is immediately actionable;
- ordinary Accept can be completed with one activation and advance to next;
- Modify/Keep original add only the extra interaction genuinely required;
- no repeated navigation between list/document/inspector for each ordinary acceptance;
- detailed filters and technical evidence do not obscure the document.

### Result

- in one glance: ready / blocked / attention;
- primary Safe action obvious;
- format choice secondary;
- Confidential Audit clearly separated and not accidentally equivalent to Safe Output.

### Structured

- unresolved columns receive visual priority;
- already-resolved columns stay inspectable without demanding repeated interaction;
- user can understand “what will happen to this column” without translating Class→Action internals;
- expert override remains available through progressive disclosure.

## 10. Consequences for REC-05→REC-11 — provisional only

No existing Work Order is cancelled by this draft. Each must be reconciled after external review.

| Work Order | Draft consequence |
| --- | --- |
| REC-05 Single output parity | Keep technical output/safety contract; redesign human hierarchy of Safe actions vs formats vs Confidential. Do not launch current handoff before reconciliation. |
| REC-06 Batch workflow parity | Treat as professional master-detail workflow, not merely state/action completion. Retry/remove/error recovery must be obvious in context. |
| REC-07 Batch output parity | Reuse the same `Resultado` mental model and REC-05 serializers; avoid a separate batch-output mini-product. |
| REC-08 Input productivity parity | Becomes central to simplifying the entry experience: examples, paste/drop, useful defaults, less routing explanation. |
| REC-09 App IA/review productivity | Must be reshaped from “finish IA + shortcuts” into the main human-workflow reconciliation for shell/review/Policies/Help. |
| REC-10 Spanish localization | Translate an accepted human vocabulary, not literal technical scaffold copy. |
| REC-11 Visual system recovery | Split foundational hierarchy/tokens from final polish so earlier user-facing surfaces are not built twice. |
| REC-12 Closeout | Must include composed human-product acceptance, not only recovered capability completeness. |

## 11. Product-design principles proposed for later authority

These are candidates, not yet constitutional rules:

1. **Task before structure.** Start from what the person needs to accomplish.
2. **Human mental model beats domain topology.** Domain states/aggregates do not automatically deserve destinations.
3. **Representation must fit the phenomenon.** Document review, batch status and column classification require different interaction representations.
4. **User-friendly is functional.** If routine work requires learning internal concepts, the product is not finished.
5. **Aesthetic usability is operational.** Hierarchy, density, visual quality and trust are part of usability.
6. **Default path ruthlessly simple.** Rare exceptions use progressive disclosure.
7. **Real scenarios before abstract completeness.** Product acceptance starts with believable healthcare work, not only domain state enumerations.
8. **Friction budget for frequent tasks.** Count actions, decisions, concepts, screens and waiting/feedback.
9. **No product freeze without a humanity check.** A competent healthcare professional should not need project-specific domain training.
10. **Would a real user want to use this?** Subjective product judgment complements deterministic correctness; it does not replace it.
11. **Technical rigor and human quality are co-equal constraints.** Neither is a later polish stage for the other.

## 12. Open questions for independent adversarial review

The external reviewer should **not** be asked to validate this draft. They should attempt to falsify it.

At minimum challenge:

1. Is `Añadir → Revisar → Resultado` actually a better primary model, or does removing visible Configure/Gate hide necessary safety cognition?
2. Should Privacy Gate be integrated into Resultado, remain separate, or use a different interaction entirely?
3. Which policy/use decision belongs before processing, and how much policy detail must be visible at ordinary times?
4. Is automatic next-pending review genuinely faster/safer in this domain, or could it encourage rubber-stamping?
5. What is the correct minimum progress/status information for expert clinical review?
6. Is a table + progressive disclosure really the best structured configuration representation for the concrete Laboratorio tasks?
7. Which structured decisions are common enough to deserve direct controls vs expert detail?
8. Which batch situations in real hospitals are missing from the proposed journeys?
9. Does the proposed Safe-output hierarchy match actual destinations (AI chat, Word, research dataset, internal sharing)?
10. Which V3 qualities are genuinely useful rather than merely more attractive/familiar?
11. What in this draft is overfitted to generic SaaS/product-design patterns instead of Laboratorio's actual work?
12. What alternative product model would the reviewer build if the current V4 IA did not exist?

## 13. Required second-opinion output

Recommended compact external-review contract:

```text
VERDICT
GO / GO WITH CHANGES / RECONSIDER

1. Findings the draft gets right
2. Findings that are wrong / weakly supported
3. Missing real-user / hospital journeys
4. Better interaction alternatives
5. Minimum correction set before product-design freeze
6. Explicit verdict on the proposed Human Product Model
7. Explicit verdict on proposed IA for text/document/batch/structured
8. Risks of simplifying Configure / Privacy Gate / policy visibility
```

The reviewer should inspect V3, current V4 and the frozen 2026-09 UX audit directly. This draft may be provided, but the mandate must explicitly invite disagreement and independent alternatives.

## 14. Freeze boundary

This DRAFT does **not** authorize:

- changing `docs/RECOVERY_MASTER_PLAN_2026-10.md`;
- changing D-023 or accepted domain/privacy decisions;
- marking REC-05 completed, superseded or ready;
- implementing a new shell/IA;
- altering ReviewSession, engine or policy semantics;
- changing the current canonical branch;
- publishing a product-design authority.

The intended next sequence is:

```text
this DRAFT
   ↓
independent adversarial product-design review
   ↓
Cora + human reconciliation
   ↓
accepted Human Product Model / Product Design Authority
   ↓
reconcile REC-05…REC-11
   ↓
new REC-05 launch packet / new review anchor
```

Until then, REC-05 remains intentionally unexecuted before WU-A in the working process, with its technical handoff retained as useful pre-reconciliation material rather than treated as final product-design authority.
