# Atenea Free Profile v0

Status: **CURRENT COST-POLICY PROFILE — C-087; Free V2 Volume/Complex bindings human-approved**
Date: 2026-10-16

## Purpose

`atenea-free` is not a lower complexity class. It is Atenea under an explicit **zero-marginal-cost policy**.

Atenea keeps two independent routing dimensions:

```text
cost_policy = standard | free_only | go
risk_class  = volume   | complex
```

Cora advises the risk class from the work. The human/project owns cost policy. If the human says a project or bounded unit is `free_only`, that decision is authority even when the work is `complex`.

## User cost override

`free_only` means:

- use only models listed as zero-cost in the current Free model catalog;
- never silently escalate to a paid Volume/Complex binding;
- never switch to another model because quota/provider behavior is inconvenient inside an active bounded unit;
- if the free route is unavailable or materially incapable, STOP and return the decision to Cora/human;
- spending requires new explicit human authority.

A project may persist `cost_policy: free_only` in its accepted project authority (`CONTEXT.md`, `AGENTS.md` or an equivalent durable decision) so the user does not need to repeat it per ticket. A ticket/handoff may explicitly override that project policy only with human authority.

## Risk inside Free

Both risk classes enter through the visible `atenea-free` coordinator. The Cora-shaped handoff must state `Risk class: volume|complex`.

`free_only + volume` uses the ordinary bounded C-084 loop with the human-approved Volume binding: Space Bunny Free implementation, DeepSeek V4.1 Free Standards, GLM 5.3 Flash Free Spec and a fresh GLM 5.3 Flash Free corrector when required.

`free_only + complex` remains Free, with GLM 5.3 Flash Free implementation, DeepSeek V4.1 Free Standards, Space Bunny Free Spec and a fresh DeepSeek V4.1 Flash Free corrector. Both classes use the same MiMo 2.6 Flash Free coordinator, explorer and merger; the explicit risk class decides the role-specific agents. It does **not** unlock paid models. Instead:

- Cora shapes smaller/coherent work units when useful;
- evidence follows the ordinary C-086 phase layering: focused writer proof, one canonical review, finding-scoped correction and final composed closeout when justified;
- review closes the risk-selected Free implementer's write phase; review findings go to fresh Free corrector sessions;
- up to two fresh finding-scoped correction attempts are allowed; Volume uses GLM 5.3 Flash Free and Complex uses DeepSeek V4.1 Flash Free; correction contexts are fresh and separate from the originating writer and all reviewer sessions;
- a material composed result may still require Cora integrated audit before merge recommendation; `complex` alone does not mandate extra full suites or review passes;
- unresolved model insufficiency, ambiguity, a new material issue or a blocker remaining after correction #2 is HUMAN STOP.

Complexity may make Cora recommend the paid Complex route, but the recommendation never overrides `free_only` human authority.

## Conditional Free Visual/UX lane (2026-10-17)

Cora + human fix `Implementation focus: technical|visual|mixed` and `UI impact: none|quality|fidelity` before launch. These are **orthogonal** to `risk_class`; they do not change the existing Free writer model or cost-policy. A material rendered UI impact dispatches the read-only `atenea-review-visual-free` on the same fixed candidate **in addition to** the canonical Matt Standards + Spec pair; a non-UI ticket skips it. Visual evidence is captured and compared against exact frozen approved master (`fidelity`) or accepted project visual-system rules (`quality`), never the model's aesthetic taste.

Reviewers share the existing max two fresh finding-scoped corrections per work unit; this does not change Matt or automatically waive the Cora + human product checkpoint. Full bounded contract: `docs/ATENEA_FREE_VISUAL_UX_ROUTING_V1.md`. Availability of the conditional Nemotron Free endpoint is checked with `node tools/check-free-models.mjs --visual`; ordinary Free-only `none` units do not need that model.


## Execution boundary

Launch remains native OpenCode V2 in the already-running Herdr workspace:

```bash
cd <project-or-worktree>
opencode .
```

Select `atenea-free` before submitting the handoff. Free routing does not relax the shaping boundary: material product choices are closed in the attended Cora + human loop before launch, and any new material product question is HUMAN STOP rather than a Free-model decision. Matt remains methodology owner. Cora remains the shaping/product/architecture authority and final integrated auditor when required.

The coordinator is orchestration-only for repository mutation and owns the Free Matt lifecycle, including the single canonical two-axis review and correction dispatch. Repository mutation is delegated to Free implementer/corrector/merger roles; the Free implementer returns the candidate before review and does not invoke review/correction roles itself.

## Model rotation

Free availability is ephemeral. Stable policy and volatile model bindings are deliberately separated:

```text
ATENEA_FREE_PROFILE_V0.md        stable policy
        ↓
ATENEA_FREE_MODEL_CATALOG_V0.md  replaceable snapshot
        ↓
.opencode/agents/*free*.md       current bindings
```

Before a Free train, `node tools/check-free-models.mjs` verifies exact bound model IDs visible to the installed OpenCode runtime. The 2026-10-16 Free V2 Volume/Complex matrix is **human-approved for use without further bake-offs**, not certified to match paid-provider quality. Model visibility alone does not prove successful inference or lasting free availability. The selected project's agent copies must be synchronized at a clean unit boundary; missing/unusable bindings require STOP, not fallback.

When free offers change, Cora may propose a new catalog/binding at a clean work boundary. Update and validate the snapshot before the next train; do not mutate routing mid-unit.

## Data policy

Atenea Free itself does not require zero-retention/no-training providers. Cost is the defining global constraint. A target project may impose stricter privacy, residency or confidentiality requirements; those project constraints override the Free catalog and may make a particular free binding ineligible.
