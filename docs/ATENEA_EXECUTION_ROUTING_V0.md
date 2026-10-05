# Atenea Execution Routing v0

Status: **CURRENT C-085 ROUTING AUTHORITY**
Date: 2026-10-03

This file maps engineering roles to project-local native OpenCode V2 agents. It does not duplicate Matt skill procedures. C-085 keeps role/model policy project-local and inherits C-084 native V2 lifecycle authority; the active global OpenCode config contains provider/MCP capability plus the Herdr observability integration, and no Gentle execution agents/plugins.

## Profiles

| Role | volume | complex |
| --- | --- | --- |
| coordinator | `atenea-volume` → MiMo 2.6 Flash | `atenea-complex` → MiMo 2.6 Flash |
| explorer | `atenea-explorer` → Qwen 3.8 Flash | same |
| implementer | `atenea-implementer-volume` → DeepSeek V4 Flash | `atenea-implementer-complex` → GLM 5.3 Flash high |
| merger | `atenea-merger` → MiMo 2.6 Flash | same |
| Standards review | `atenea-review-standards` → GPT-6 Luna high | same |
| Spec review | `atenea-review-spec-volume` → GPT-6 Luna high | `atenea-review-spec-complex` → GPT-6.1 Sol high |
| correction | `atenea-corrector-volume` → DeepSeek V4 Flash | `atenea-corrector-complex` → GLM 5.3 Flash high |
| deep OCR | normally off | GLM 5.3 Flash high when triggered |
| integrated feature/train/PR audit | Cora when material | Cora when material |

The NaN provider ID `nan/deepseek-v4-flash` is intentionally retained even when the provider backend serves the newer V4.1 Flash implementation under that stable ID.

## Routing dimensions

Complexity and cost are independent:

```text
cost_policy = standard | free_only | go
risk_class  = volume   | complex
```

Cora recommends `risk_class` from the work. Human/project authority owns `cost_policy`. An explicit `free_only` decision remains authoritative even for complex work; complexity changes assurance, never permission to spend.

| Cost policy | Risk class | Primary agent |
| --- | --- | --- |
| standard | volume | `atenea-volume` |
| standard | complex | `atenea-complex` |
| free_only | volume | `atenea-free` + `Risk class: volume` handoff |
| free_only | complex | `atenea-free` + `Risk class: complex` handoff |
| go | volume | `atenea-go` + `Risk class: volume` handoff |
| go | complex | `atenea-go` + `Risk class: complex` handoff |

The Free policy is defined in `docs/ATENEA_FREE_PROFILE_V0.md`; its replaceable model snapshot is `docs/ATENEA_FREE_MODEL_CATALOG_V0.md`. `free_only` has no silent paid fallback.

The Go policy (`Cost policy: go`) is a **qualification candidate** defined in `docs/ATENEA_GO_PROFILE_V0.md`; its replaceable model snapshot is `docs/ATENEA_GO_MODEL_CATALOG_V0.md`. `go` is a human-selected cost policy, not a quota router, and has no automatic model fallback.

## Risk-class selection

Start with risk class `volume` unless current accepted authority already exposes a material complex trigger. This classification is advisory to assurance and remains useful even when the human/project has fixed `cost_policy: free_only`.

Complex triggers:

- novel/cross-cutting architecture across materially coupled modules;
- difficult concurrency, temporal, scheduling, state-machine, solver or optimization semantics;
- material security, privacy, authorization, tenancy, clinical meaning or trust-boundary risk;
- delicate migration, backward-compatibility or distributed invariants;
- repeated semantic failure that demonstrates ordinary assurance is insufficient.

Not triggers by themselves:

- file count;
- a long but mechanically clear ticket;
- ordinary UI work;
- many tests;
- business importance without corresponding semantic risk.

Choose cost policy and risk class at a clean issue/work-unit boundary. Routing begins only after attended Cora + human shaping has closed every material product question for the unit; model/profile choice is never a substitute for unresolved product authority. Do not silently switch models inside an active implementation merely because quota is inconvenient. Human `free_only` authority cannot be overridden by the router.

## Matt role binding

Matt remains upstream-owned. Atenea does not rewrite its skills.

When a selected Matt skill asks for an exploration, implementer, merger, Standards reviewer or Spec reviewer, dispatch the exact named Atenea agent from the selected standard profile above or the exact Free binding from `docs/ATENEA_FREE_MODEL_CATALOG_V0.md`.

For a single `/implement`, the primary coordinator owns the Matt lifecycle. It delegates only the implementation/TDD phase to the implementer bound by the selected route; the implementer returns a committed/fixed candidate and does not invoke `/implement`, `/implement-spec` or `/code-review`. The coordinator then runs exactly one canonical Matt `/code-review` for that candidate, pinned to the intended pre-implementation fixed point and supplied with the complete Cora-shaped authority envelope. For `/implement-spec`, the primary coordinator owns the task graph and the single final integration-branch review; implementation workers implement/TDD their assigned units but do not own review.

Do not review the same candidate/fixed-point pair twice merely because both a worker and coordinator reach a review stage. A review may be repeated only if the previous one failed technically, was incomplete, or used the wrong fixed point/authority envelope. Once the canonical Matt review starts, the originating implementer's write phase is closed. Actionable findings must be handled by a fresh correction agent from the selected route, dispatched by the coordinator; the implementer does not apply review-driven edits itself. Run focused deterministic/regression evidence after each correction. If the same authorized finding(s) remain after correction #1, one second **fresh** correction session using the same bound correction role is allowed. After correction #2, or on a new material finding/scope change, HUMAN STOP. Do not start repeated broad review/fix cycles.

## Assurance triggers

Deterministic evidence remains first line. Semgrep is added when relevant static/security rules provide useful signal.

Deep OCR is not routine. Trigger it for material auth/privacy/tenancy, concurrency/state, difficult cross-file/module contracts, unusually high criticality or a material feature/train where an additional semantic pass is justified.

## Standard writer and context economy

Standard writer routing is fixed at a clean work-unit boundary: `volume` uses DeepSeek V4 Flash; `complex` uses GLM 5.3 Flash high. Do not switch either route mid-unit merely because quota is inconvenient.

The active OpenCode 2.0.22 user/runtime config declares a 220k effective context budget for both long-running NaN writer models with automatic compaction and ~15k recent verbatim retention. This makes compaction due around ~198k instead of waiting near the physical provider window. It is an execution-economy guard only: required tests/evidence remain authoritative and may not be weakened to save tokens.

## No quota router

Atenea does not implement percentage balancing, automatic quota failover or a model carousel. Usage evidence is observational. New routing is selected only at the next clean work boundary.
