# Atenea Execution Routing v0

Status: **CURRENT C-084 ROUTING AUTHORITY**
Date: 2026-10-03

This file maps engineering roles to project-local native OpenCode V2 agents. It does not duplicate Matt skill procedures. C-084 keeps role/model policy project-local; the active global OpenCode config contains provider/MCP capability plus the Herdr observability integration, and no Gentle execution agents/plugins.

## Profiles

| Role | volume | complex |
| --- | --- | --- |
| coordinator | `atenea-volume` → MiMo 2.6 Flash | `atenea-complex` → MiMo 2.6 Flash |
| explorer | `atenea-explorer` → Qwen 3.8 Flash | same |
| implementer | `atenea-implementer-volume` → DeepSeek V4 Flash | `atenea-implementer-complex` → DeepSeek V4 Flash |
| merger | `atenea-merger` → MiMo 2.6 Flash | same |
| Standards review | `atenea-review-standards` → GPT-6 Luna high | same |
| Spec review | `atenea-review-spec-volume` → GPT-6 Luna high | `atenea-review-spec-complex` → GPT-6.1 Sol high |
| correction | `atenea-corrector-volume` → DeepSeek V4 Flash | `atenea-corrector-complex` → GLM 5.3 Flash high |
| deep OCR | normally off | GLM 5.3 Flash high when triggered |
| integrated feature/train/PR audit | Cora when material | Cora when material |

The NaN provider ID `nan/deepseek-v4-flash` is intentionally retained even when the provider backend serves the newer V4.1 Flash implementation under that stable ID.

## Profile selection

Start with `volume` unless current accepted authority already exposes a material complex trigger.

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

Choose the profile at a clean issue/work-unit boundary. Do not silently switch models inside an active implementation merely because quota is inconvenient.

## Matt role binding

Matt remains upstream-owned. Atenea does not rewrite its skills.

When a selected Matt skill asks for an exploration, implementer, merger, Standards reviewer or Spec reviewer, dispatch the exact named Atenea agent from the selected profile above.

For a single `/implement`, the primary coordinator owns the Matt lifecycle. It delegates only the implementation/TDD phase to the implementer bound by the selected profile; the implementer returns a committed/fixed candidate and does not invoke `/implement`, `/implement-spec` or `/code-review`. The coordinator then runs exactly one canonical Matt `/code-review` for that candidate, pinned to the intended pre-implementation fixed point and supplied with the complete Cora-shaped authority envelope. For `/implement-spec`, the primary coordinator owns the task graph and the single final integration-branch review; implementation workers implement/TDD their assigned units but do not own review.

Do not review the same candidate/fixed-point pair twice merely because both a worker and coordinator reach a review stage. A review may be repeated only if the previous one failed technically, was incomplete, or used the wrong fixed point/authority envelope. Once the canonical Matt review starts, the originating implementer's write phase is closed. Actionable findings must be handled by a fresh correction agent from the selected profile, dispatched by the coordinator; the implementer does not apply review-driven edits itself. Run focused deterministic/regression evidence after each correction. If the same authorized finding(s) remain after correction #1, one second **fresh** correction session using the same bound correction role is allowed. After correction #2, or on a new material finding/scope change, HUMAN STOP. Do not start repeated broad review/fix cycles.

## Assurance triggers

Deterministic evidence remains first line. Semgrep is added when relevant static/security rules provide useful signal.

Deep OCR is not routine. Trigger it for material auth/privacy/tenancy, concurrency/state, difficult cross-file/module contracts, unusually high criticality or a material feature/train where an additional semantic pass is justified.

## Exceptional first-writer escalation

If shaping shows the implementation itself is unusually open, architecture-heavy or reasoning-coupled, Cora/human may explicitly choose GLM 5.3 Flash high as first writer. Record that exception in the ticket/run; do not reinterpret every `complex` ticket as GLM-first.

## No quota router

Atenea does not implement percentage balancing, automatic quota failover or a model carousel. Usage evidence is observational. New routing is selected only at the next clean work boundary.
