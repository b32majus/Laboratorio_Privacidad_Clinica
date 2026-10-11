# Atenea OpenAI experimental profiles v0 — Sprint / Frontier

Status: **EXPERIMENTAL HUMAN OPT-IN — NOT OPERATIONALLY QUALIFIED**
Date: 2026-10-11
Parent authority: C-087 native OpenCode V2 + upstream Matt; additive model routing only.

## Intent and scope

Use time-limited OpenAI CLI/Codex/Work OAuth capacity on **already accepted real work**. Sprint aims for efficient completion of bounded volume tickets: Luna High writes and Sol High is the on-demand correction escalation. Frontier invests Sol High at implementation time for accepted complex risk. **Neither promises faster execution or higher first-pass correctness until field evidence exists.**

This is a distinct opt-in `cost_policy: openai_experimental` and must be selected explicitly by the human **at a clean work-unit boundary**. It does not replace or modify `standard`, `free_only`, `go`, their agents, the default profile, model pins or already-running trains.

## Exact role bindings

| Phase / role | Sprint (risk_class: volume) | Frontier (risk_class: complex) |
| --- | --- | --- |
| Primary coordinator | `atenea-openai-sprint` → `nan/mimo-v2.6-flash` | `atenea-openai-frontier` → `nan/mimo-v2.6-flash` |
| Explorer | `atenea-explorer` → `nan/qwen3.8-flash` | same |
| Implementer | `atenea-implementer-openai-sprint` → `openai/gpt-6-luna#high` | `atenea-implementer-openai-frontier` → `openai/gpt-6.1-sol#high` |
| Standards (read-only) | `atenea-review-standards-openai-sprint` → `nan/deepseek-v4-flash` | `atenea-review-standards-openai-frontier` → `nan/glm5.3-flash#high` |
| Spec (read-only) | `atenea-review-spec-openai-sprint` → `openai/gpt-6.1-sol#high` | `atenea-review-spec-openai-frontier` → `openai/gpt-6-luna#high` |
| Fresh corrector | `atenea-corrector-openai` → `openai/gpt-6.1-sol#high` | same |
| Merger (implement-spec only) | `atenea-merger` → `nan/mimo-v2.6-flash` | same |

Shared agents above are deliberate reuse; all new bindings are in `.opencode/agents/`. On Sprint, Spec and corrector share a model **but never a session**; correction receives only adjudicated, concrete findings, not general review authority. Models are independently bound: no auto-fallback, no mid-unit switching, no quota balancing.

## Unchanged C-087 lifecycle

Cora prepares the accepted work (WHAT / WHERE / REUSE / CLOSED DECISIONS / DO NOT TOUCH / PROOF / HUMAN STOP) before READY_TO_LAUNCH. Coordinator delegates to a distinct writer; writer commits a fixed candidate with focused checks; one canonical Standards + Spec review runs; a fresh correction session is opened *only for concrete findings*, maximum two attempts, with smallest relevant proofs. Reviewer and writer authority remain isolated. New clinical/product decisions, missing authority, quota/model failure or out-of-scope dependencies are HUMAN STOP. Publication is human-owned.

No extra specialists, always-on assurance, broad tests per phase, synthetic qualification campaign, automatic PR/merge or production access.

## First real use (field qualification, no artificial campaign)

1. Pick an already prepared, clean-boundary ticket/train. Cora selects risk class from real scope; human explicitly opts into `openai_experimental`. No profile change to active sessions.
2. Ensure the target worktree sees **exactly** the nine new project-local `.opencode/agents/atenea-*openai*.md` files from this accepted Atenea revision, plus its unchanged existing `atenea-explorer` and `atenea-merger` agents. Compare files before copying; never overwrite an active target or a divergent agent. A Git PR in Atenea **does not deploy agents into project worktrees**.
3. In the target worktree confirm OpenCode V2 configuration, expected agent/model resolution and available OpenAI OAuth / NaN access. The provider model catalog alone proves availability of IDs, **not** usable quotas or success of a generation. Fail closed on any missing binding.
4. Use the selected visible primary `atenea-openai-sprint` or `atenea-openai-frontier` and the prepared repository-local handoff. The human launches as usual; no unattended train started merely by preparing a profile.
5. After ordinary real work capture candidate SHA, Standards/Spec verdicts, correction attempts, relevant deterministic proofs, HUMAN STOPs, wall time and read-only OpenCode telemetry. Do not invent token cost or claim proven efficiency. Observe first-pass outcomes vs the existing routes where comparable.
6. Promote from experimental only with repeated relevant field evidence and an explicit human decision. If the reset happens before any train completes, the setup remains reusable at the next reset.

## Limitations

- The current inherited 220k/auto-compaction guard was evidenced for long-running NaN writers. **Do not assume those context/compaction values are qualified for Luna/Sol writers.** Observe the runtime/provider context behavior on real work.
- Historical V4 and GLM review-lens evidence is relevant but does **not** itself qualify them as native OpenCode V2 Matt Standards reviewers. Watch for reviewer noise, truncation, missing authority and overly broad findings.
- OAuth scopes and consumption are provider-specific. Never convert an advertised reset into an unlimited-quota claim; stop rather than fallback if denied.
- Keep application secrets, patient data and real commercial customer data out of experimental model traces and qualification artifacts.
