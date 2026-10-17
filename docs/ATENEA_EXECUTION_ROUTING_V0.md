# Atenea Execution Routing v0

Status: **CURRENT C-087 ROUTING AUTHORITY**
Date: 2026-10-06

This file maps roles to project-local native OpenCode V2 agents. It does not duplicate Matt procedures. C-087 retains the C-086 thin lifecycle and C-085 writer/context economics while hardening authority transport to child agents.

## Standard profiles

| Role | volume | complex |
| --- | --- | --- |
| coordinator | `atenea-volume` → MiMo 2.6 Flash | `atenea-complex` → GLM 5.3 Flash high |
| explorer | `atenea-explorer` → Qwen 3.8 Flash | same |
| implementer | `atenea-implementer-volume` → DeepSeek V4 Flash | `atenea-implementer-complex` → GLM 5.3 Flash high |
| merger | `atenea-merger` → MiMo 2.6 Flash | same |
| Standards review | `atenea-review-standards` → GPT-6 Luna high | same |
| Spec review | `atenea-review-spec-volume` → GPT-6 Luna high | `atenea-review-spec-complex` → GPT-6.1 Sol high |
| correction | `atenea-corrector-volume` → DeepSeek V4 Flash | `atenea-corrector-complex` → GLM 5.3 Flash high |
| integrated feature/train/PR audit | Cora when material | Cora when material |

The NaN provider ID `nan/deepseek-v4-flash` is intentionally retained even when the provider backend serves a newer compatible implementation under that stable ID.

**Standard conditional Visual/UX (2026-10-17):** human-authorized Standard units classified `UI impact: quality|fidelity` call `atenea-review-visual-standard` (GPT-6 Luna High), once on the same fixed candidate alongside the canonical Matt Standards+Spec pair. `none` skips the visual agent. Risk-bound writer, reviewer bindings, correction budget, product authority, and Go/Free remain unchanged. Details: `docs/ATENEA_STANDARD_VISUAL_UX_ROUTING_V1.md`.

## Routing dimensions

```text
cost_policy = standard | free_only | go | openai_experimental (legacy technical ID; operative by human-only activation)
risk_class  = volume | complex
```

Human/project authority owns cost policy. Cora recommends risk class from accepted work.

| Cost policy | Risk class | Primary agent |
| --- | --- | --- |
| standard | volume | `atenea-volume` |
| standard | complex | `atenea-complex` |
| free_only | volume | `atenea-free` |
| free_only | complex | `atenea-free` |
| go | volume | `atenea-go` |
| go | complex | `atenea-go` |

Free bindings: `docs/ATENEA_FREE_PROFILE_V0.md` + `docs/ATENEA_FREE_MODEL_CATALOG_V0.md`.

**Free V2 risk-specific bindings (human-approved 2026-10-16; one primary `atenea-free`):**

| Free risk | Implementer | Standards | Spec | Corrector |
| --- | --- | --- | --- | --- |
| `volume` | `atenea-implementer-free` (Space Bunny Free) | `atenea-review-standards-free` (DeepSeek V4.1 Free) | `atenea-review-spec-free` (GLM 5.3 Flash Free) | `atenea-corrector-free-volume` (GLM 5.3 Flash Free) |
| `complex` | `atenea-implementer-free-complex` (GLM 5.3 Flash Free) | `atenea-review-standards-free` (DeepSeek V4.1 Free) | `atenea-review-spec-free-complex` (Space Bunny Free) | `atenea-corrector-free-complex` (DeepSeek V4.1 Free) |

Both use MiMo 2.6 Flash Free coordination, exploration and merger (separate sessions). Cora/human own `risk_class`; missing/ambiguous risk is HUMAN STOP. No change to Matt review/correction budgets, no fallback and no in-flight reassignment. This was the 2026-10-16 two-axis Free V2 baseline, preceding the Free-only conditional Visual/UX amendment below.

**Free-only conditional Visual/UX axis (accepted 2026-10-17):** the statement above remains the historical V2 two-axis scope; for a NEW Free unit explicitly classified with `UI impact: quality|fidelity`, additionally dispatch `atenea-review-visual-free` → Nemotron 3.5 Super VL Free **once, read-only, on the same fixed candidate**. A backend-only `none` unit skips it. The two-axis Matt canonical review, risk-bound writer, correction allowance and other profiles are unchanged. Cora classifies `Implementation focus` and `UI impact` in the handoff, not a model router. See `docs/ATENEA_FREE_VISUAL_UX_ROUTING_V1.md`. The former Free Muse coordinator/correctors were replaced by an explicit human-approved Free-only selection on 2026-10-17 at this new configuration boundary. No automatic fallback or session reuse.


Go bindings: `docs/ATENEA_GO_PROFILE_V0.md` + `docs/ATENEA_GO_MODEL_CATALOG_V0.md`. Go was **operationally qualified only with its prior bindings**. The revised Go matrix still needs separate field evidence; Free V2 is human-approved for use without additional bake-offs but must not inherit paid/NaN endpoint qualification. See `docs/ATENEA_GO_OPERATIONAL_QUALIFICATION_C087_20261010.md`. Neither profile has silent fallback.

### OpenAI Sprint / Frontier — operative human activation (legacy cost-policy ID)

The human may select `cost_policy: openai_experimental` at a **clean** work-unit boundary, typically near OpenAI quota resets. **Human-confirmed repeated project use prompted operational adoption 2026-10-17**; the machine identifier is retained for backward compatibility and does NOT permit automatic selection. Cora may recommend; the human explicitly approves each activation. This is additive; Standard / Free / Go and the default remain unchanged.

| Risk class | Experimental primary agent | Strategy |
| --- | --- | --- |
| `volume` | `atenea-openai-sprint` | GPT-6 Luna High implementation; GPT-6.1 Sol High Spec and fresh correction when needed |
| `complex` | `atenea-openai-frontier` | GPT-6.1 Sol High implementation / fresh correction; GPT-6 Luna High Spec |

Both reuse NaN MiMo coordinator, NaN Qwen 3.8 explorer and MiMo merger. Standards is NaN DeepSeek V4 Flash in Sprint and NaN GLM 5.3 Flash High in Frontier. See `docs/ATENEA_OPENAI_EXPERIMENTAL_PROFILE_V0.md` (historical filename) for exact role bindings, activation/preflight and limitations. No silent fallback or mid-run profile switch.

**OpenAI human-activated Visual/UX conditional amendment (2026-10-17):** in NEW explicitly human-approved `openai_experimental` units with `UI impact: quality|fidelity`, dispatch once on the same fixed candidate:
- Sprint/Volume → `atenea-review-visual-openai-sprint`, Sol High.
- Frontier/Complex → `atenea-review-visual-openai-frontier`, Luna High.
`none` skips. Matt Standards+Spec and shared max-two fresh correction budget remain intact; human activation remains mandatory. See `docs/ATENEA_OPENAI_VISUAL_UX_ROUTING_V1.md`.


## Go candidate / Free V2 human-approved boundary (2026-10-16)

Standard Volume/Complex and human-activated OpenAI model bindings are unchanged. Go remains a pending candidate; Free V2 Volume and Complex are explicitly human-approved. Exact routing is in each replaceable catalog and native agents. No active Train may change models mid-unit. The project-local `.opencode/agents` must be reconciled with the approved Atenea version before launch: updating Atenea alone does not update another project's copied agents.

A merger handles mechanical/fast-forward integration only; a material semantic conflict requires HUMAN STOP and Cora/human adjudication even if Git reports a clean merge. An exceptional GLM intervention requires explicit human authorization, never automatic fallback, and Free must not use paid routes absent separately approved cost-policy change. Up to two fresh finding-scoped correction attempts; coordinator and corrector sharing one model family is allowed only as distinct role sessions.

## Risk selection

Start with `volume` unless accepted authority already exposes a material complex trigger:

- novel/cross-cutting architecture across materially coupled modules;
- difficult concurrency, temporal, scheduling, state-machine, solver or optimization semantics;
- material security/privacy/authorization/tenancy/clinical/trust-boundary risk;
- delicate migration/backward-compatibility/distributed invariants;
- repeated semantic failure demonstrating ordinary assurance is insufficient.

File count, ticket length, ordinary UI, many tests or business importance alone are not complex triggers.

## Matt lifecycle binding

Matt remains upstream-owned. The selected primary coordinator delegates implementation/TDD to the bound implementer, receives a fixed candidate, then owns exactly one canonical Standards + Spec review for that candidate. `/implement-spec` uses the same ownership at integration level.

Review start closes the originating implementer. Findings go to fresh bound correctors; at most two finding-scoped attempts are allowed for the same envelope. No repeated broad review/fix carousel.

**Candidate/work-unit boundary, not a Train-wide review budget:** The coordinator owns the canonical Standards + Spec review at the authorized implementation-candidate boundary (or explicitly accepted integrated candidate boundary). A clean review for one ticket/work unit does not consume, replace or waive the canonical review required for a different authorized candidate. Do not duplicate review of the same candidate/fixed point, or invent one for every screen or read-only QA checkpoint; read-only verification alone never grants write authority.

**Correction budget belongs to each authorized ticket/work-unit envelope:** At most two fresh finding-scoped correction attempts apply to that envelope's findings, **not** to the entire Train. A PASS with no findings consumes zero attempts; attempts used in one envelope do not deplete another's allowance. Never reset the same repair's exhausted budget by renaming, splitting or relaunching it. A defect discovered during read-only QA remains evidence for a separately authorized correction unit when the existing envelope does not permit a write.

Coordinators delegate using a **child-readable authority envelope**: prefer a repo-local durable handoff reference; when required authority is external/inaccessible, inline the compact phase-specific capsule from `CHILD_AUTHORITY_CAPSULE_V1.md`. Never require a child verdict to read `/outbox`, `/tmp`, another worktree or another denied external directory. Full handoff/policy duplication remains forbidden.

## Conditional safeguards

Specialized product/evidence safeguards are activated by the accepted handoff or a concrete review finding. They are not inferred as always-on work from profile/risk class alone. See `docs/PRODUCT_FIDELITY_GATES_V1.md`.

A writer implements the supplied envelope. It does not perform open-ended sibling-consumer auditing. If it discovers a material out-of-envelope impact incidentally, it reports and STOPs.

## Evidence economy

Writer evidence is focused. Broad/full suites default to integration/publication unless the accepted handoff explicitly names one existing integrated candidate witness and its command for a material cross-surface risk; the coordinator runs that witness once after the fixed candidate and before canonical reviewers. Correctors run only the required focused closure checks, not optional full regressions; out-of-scope reds are reported instead of pursued. Profile choice alone never mandates extra reviews or suites.

**Reconcile negative evidence before claiming success:** A green test/check count does not override a **material negative observation** in the same required evidence, including browser observations. The coordinator must read the relevant reported observations, classify any material discrepancy against the approved acceptance (candidate defect, proven pre-existing/out of scope, invalid evidence, or unresolved), and either substantiate why it does not invalidate acceptance, obtain closure through the already-authorized bounded workflow, or STOP/escalate unresolved material findings to Cora + human. Do not claim an overall clean/PASS candidate while a material negative observation remains unresolved; report passing checks separately. No extra reviewer cycle, broad suite, speculative investigation or silent scope expansion is authorized by this rule.

## Standard writer/context economy

Standard writer routing is fixed at a clean work-unit boundary:

```text
volume  → nan/deepseek-v4-flash
complex → nan/glm5.3-flash#high
```

The OpenCode 2.0.22 runtime uses a 220k effective context budget for both long-running NaN writers with automatic compaction and ~15k recent verbatim retention, making compaction due around ~198k. This is an airbag, not a target context size and not permission to weaken required evidence.

## No quota router

Atenea does not implement percentage balancing, automatic quota failover or a model carousel. New routing is selected only at a clean work boundary.
