# Atenea Execution Routing v0

Status: **CURRENT C-083 ROUTING AUTHORITY**
Date: 2026-10-03

This file maps engineering roles to project-local OpenCode agents. It does not duplicate Matt skill procedures. C-083 runs OpenCode with `--pure`; legacy global agents/plugins may remain installed but are outside the active route.

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

For a single `/implement`, the primary coordinator delegates the implementation to the selected V4 implementer rather than writing product code itself. For `/implement-spec`, the primary coordinator runs Matt's task graph and uses the bound role agents.

If Matt review returns actionable findings, use exactly one fresh correction agent from the selected profile. Run focused regression evidence afterward. Do not start a second autonomous correction/review cycle.

## Assurance triggers

Deterministic evidence remains first line. Semgrep is added when relevant static/security rules provide useful signal.

Deep OCR is not routine. Trigger it for material auth/privacy/tenancy, concurrency/state, difficult cross-file/module contracts, unusually high criticality or a material feature/train where an additional semantic pass is justified.

## Exceptional first-writer escalation

If shaping shows the implementation itself is unusually open, architecture-heavy or reasoning-coupled, Cora/human may explicitly choose GLM 5.3 Flash high as first writer. Record that exception in the ticket/run; do not reinterpret every `complex` ticket as GLM-first.

## No quota router

Atenea does not implement percentage balancing, automatic quota failover or a model carousel. Usage evidence is observational. New routing is selected only at the next clean work boundary.
