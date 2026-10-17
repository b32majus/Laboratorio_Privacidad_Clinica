# Atenea OpenAI Sprint / Frontier — human-activated operational profiles (legacy filename v0)

Status: **OPERATIVE BY EXPLICIT HUMAN ACTIVATION — HUMAN-APPROVED FIELD USE; NO AUTOMATIC ROUTING**
Date: 2026-10-11 (origin) · 2026-10-17 (operational-status update)
Parent authority: C-087 native OpenCode V2 + upstream Matt; additive model routing only.

## Intent and scope

Use time-limited OpenAI CLI/Codex/Work OAuth capacity on **already accepted real work**. Sprint targets bounded Volume tickets: Luna High writes and Sol High corrects findings. Frontier targets Complex risk: Sol High writes/corrects. **Human confirms repeated real project use of both profiles and explicitly promotes them from experimental to operative under human activation on 2026-10-17.** This is an operational-policy decision, not an invented benchmark, measured quality equivalence, automatic default or claim that the newer Visual/UX overlay has passed a full real Train.

**Activation policy:** the human may select either profile, typically when OpenAI capacity is available shortly before its reset. This timing is a *human opportunity*, not a cron schedule, token threshold, unattended selector, provider failover or routing signal. Cora may recommend it; only human approval fixes the cost policy for each new work unit at a clean boundary. If access/quota is unavailable, HUMAN STOP, never silent Standard/Go/Free fallback.

**Compatibility:** the already-shipped machine identifier `cost_policy: openai_experimental`, profile-local agent IDs, filenames and existing test/checker names remain unchanged intentionally. Here `experimental` is a **legacy identifier only**, not the current operational status. Do not rename it in active or already prepared handoffs; no dual cost-policy alias or background migration.

**2026-10-17 conditional Visual/UX amendment (human approved):** only NEW human-activated OpenAI UI-impact work receives a third, independent, read-only evidence axis. Sprint uses Sol High Visual/UX and Frontier uses Luna High Visual/UX, deliberately distinct from their writers. `UI impact: none` skips it; `quality` uses accepted Design System + real candidate browser pixels; `fidelity` uses SHA-pinned approved PNG plus comparable candidate PNG. Matt Standards+Spec stays canonical exactly once, all material findings share the existing maximum two fresh correctors per authorized unit; no extra Matt review or independent claim of quality equivalence. Full contract: `docs/ATENEA_OPENAI_VISUAL_UX_ROUTING_V1.md`.

The **legacy-named** `cost_policy: openai_experimental` is a separate, operative **human-activation-only** choice fixed by the human **at a clean work-unit boundary**. It does not replace or modify `standard`, `free_only`, `go`, their agents, the default profile, model pins or already-running trains.

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

No *unconditional* extra specialists, always-on assurance, broad tests per phase, synthetic qualification campaign, automatic PR/merge or production access. The sole approved exception is the **conditional Visual/UX witness** on `quality|fidelity` NEW human-activated OpenAI units, governed by `docs/ATENEA_OPENAI_VISUAL_UX_ROUTING_V1.md`.

## Routine human-activated use (retain field evidence without extra campaigns)

1. Pick an already prepared, clean-boundary ticket/train. Cora selects risk class from real scope; human explicitly approves the **human-activated OpenAI route** recorded as legacy `openai_experimental`. No profile change to active sessions.
2. Ensure the target worktree sees **exactly** the eleven profile-local `.opencode/agents/atenea-*openai*.md` files from this accepted Atenea revision, plus its unchanged existing `atenea-explorer` and `atenea-merger` agents. Compare files before copying; never overwrite an active target or a divergent agent. A Git PR in Atenea **does not deploy agents into project worktrees**.
3. In the target worktree confirm OpenCode V2 configuration, expected agent/model resolution and available OpenAI OAuth / NaN access. The provider model catalog alone proves availability of IDs, **not** usable quotas or success of a generation. Fail closed on any missing binding.
4. Use the selected visible primary `atenea-openai-sprint` or `atenea-openai-frontier` and the prepared repository-local handoff. Record the human opt-in in its accepted authority; the human launches as usual. No unattended train started merely by preparing a profile.
5. After ordinary real work capture candidate SHA, Standards/Spec (and conditional Visual/UX) verdicts, correction attempts, relevant deterministic proofs, HUMAN STOPs, wall time and read-only OpenCode telemetry. Do not invent token cost or claim measured superiority. Observe first-pass outcomes vs existing routes where comparable.
6. The explicit human decision on 2026-10-17 **already promoted operational status** based on repeated project use. No additional qualification campaign is required for routine human-activated use; a new model route, unattended activation or change in C-087 would require separate approval. Reset timing does not start or stop work automatically.

## Limitations

- The current inherited 220k/auto-compaction guard was evidenced for long-running NaN writers. **Do not assume those context/compaction values are qualified for Luna/Sol writers.** Observe the runtime/provider context behavior on real work.
- Historical V4 and GLM review-lens evidence is relevant but does **not** itself qualify them as native OpenCode V2 Matt Standards reviewers. Watch for reviewer noise, truncation, missing authority and overly broad findings.
- OAuth scopes and consumption are provider-specific. Never convert an advertised reset into an unlimited-quota claim; stop rather than fallback if denied.
- Keep application secrets, patient data and real commercial customer data out of provider traces and qualification artifacts.
