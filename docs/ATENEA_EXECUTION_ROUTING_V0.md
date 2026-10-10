# Atenea Execution Routing v0

Status: **CURRENT C-087 ROUTING AUTHORITY**
Date: 2026-10-06

This file maps roles to project-local native OpenCode V2 agents. It does not duplicate Matt procedures. C-087 retains the C-086 thin lifecycle and C-085 writer/context economics while hardening authority transport to child agents.

## Standard profiles

| Role | volume | complex |
| --- | --- | --- |
| coordinator | `atenea-volume` → MiMo 2.6 Flash | `atenea-complex` → MiMo 2.6 Flash |
| explorer | `atenea-explorer` → Qwen 3.8 Flash | same |
| implementer | `atenea-implementer-volume` → DeepSeek V4 Flash | `atenea-implementer-complex` → GLM 5.3 Flash high |
| merger | `atenea-merger` → MiMo 2.6 Flash | same |
| Standards review | `atenea-review-standards` → GPT-6 Luna high | same |
| Spec review | `atenea-review-spec-volume` → GPT-6 Luna high | `atenea-review-spec-complex` → GPT-6.1 Sol high |
| correction | `atenea-corrector-volume` → DeepSeek V4 Flash | `atenea-corrector-complex` → GLM 5.3 Flash high |
| integrated feature/train/PR audit | Cora when material | Cora when material |

The NaN provider ID `nan/deepseek-v4-flash` is intentionally retained even when the provider backend serves a newer compatible implementation under that stable ID.

## Routing dimensions

```text
cost_policy = standard | free_only | go | openai_experimental (explicit, unqualified opt-in)
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

Go bindings: `docs/ATENEA_GO_PROFILE_V0.md` + `docs/ATENEA_GO_MODEL_CATALOG_V0.md`. Go is **operationally qualified for bounded volume and complex**, with evidence in `docs/ATENEA_GO_OPERATIONAL_QUALIFICATION_C087_20261010.md`. Neither profile has silent fallback.

### Experimental OpenAI opt-in (post-C-087 field trial; not qualified)

The human may select `cost_policy: openai_experimental` at a **clean** work-unit boundary. This is additive; the C-087 accepted Standard / Free / Go assignments and default remain unchanged.

| Risk class | Experimental primary agent | Strategy |
| --- | --- | --- |
| `volume` | `atenea-openai-sprint` | GPT-6 Luna High implementation; GPT-6.1 Sol High Spec and fresh correction when needed |
| `complex` | `atenea-openai-frontier` | GPT-6.1 Sol High implementation / fresh correction; GPT-6 Luna High Spec |

Both reuse NaN MiMo coordinator, NaN Qwen 3.8 explorer and MiMo merger. Standards is NaN DeepSeek V4 Flash in Sprint and NaN GLM 5.3 Flash High in Frontier. See `docs/ATENEA_OPENAI_EXPERIMENTAL_PROFILE_V0.md` for the exact seven-role map, preflight, limitations and field-evidence requirements. No silent fallback or mid-run profile switch.

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

Coordinators delegate using a **child-readable authority envelope**: prefer a repo-local durable handoff reference; when required authority is external/inaccessible, inline the compact phase-specific capsule from `CHILD_AUTHORITY_CAPSULE_V1.md`. Never require a child verdict to read `/outbox`, `/tmp`, another worktree or another denied external directory. Full handoff/policy duplication remains forbidden.

## Conditional safeguards

Specialized product/evidence safeguards are activated by the accepted handoff or a concrete review finding. They are not inferred as always-on work from profile/risk class alone. See `docs/PRODUCT_FIDELITY_GATES_V1.md`.

A writer implements the supplied envelope. It does not perform open-ended sibling-consumer auditing. If it discovers a material out-of-envelope impact incidentally, it reports and STOPs.

## Evidence economy

Writer evidence is focused. Broad/full suites default to an integration/publication boundary unless current repository/ticket authority needs them earlier. Correctors run focused evidence for supplied findings. Profile choice by itself never mandates extra routine reviews or full suites.

## Standard writer/context economy

Standard writer routing is fixed at a clean work-unit boundary:

```text
volume  → nan/deepseek-v4-flash
complex → nan/glm5.3-flash#high
```

The OpenCode 2.0.22 runtime uses a 220k effective context budget for both long-running NaN writers with automatic compaction and ~15k recent verbatim retention, making compaction due around ~198k. This is an airbag, not a target context size and not permission to weaken required evidence.

## No quota router

Atenea does not implement percentage balancing, automatic quota failover or a model carousel. New routing is selected only at a clean work boundary.
