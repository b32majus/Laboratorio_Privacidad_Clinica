# UX-PILOT-01 — C-084 execution handoff

Status: **EXECUTION_READY**
Date: 2026-10-03
Issue: #52 — `[V4/UX-PILOT-01] Unified “New Privacy Job” input workspace`
Profile: `volume`
Canonical base before handoff: `17d96d56bc1d7ba2d080f199ac5340102d555354`
Delivery branch: `work/ux-pilot-01-20261003`
Publication boundary during execution: **LOCAL_ONLY**

## Objective

Execute GitHub issue #52 as the first real Laboratorio de Privacidad Clínica train under Atenea C-084.

The requested product change is bounded to the canonical V4 **Input** surface: make starting a new privacy job feel like a clear, cohesive professional workspace while preserving all accepted privacy/domain/input semantics.

## Current authority

Read before engineering work:

1. `AGENTS.md`
2. `CODING_STANDARDS.md`
3. `CONTEXT.md`
4. GitHub issue #52 in full
5. `docs/shaping/CURRENT_DECISIONS.md`, especially D-001, D-002, D-009, D-013, D-014, D-017
6. `docs/ATENEA_EXECUTION_ROUTING_V0.md`
7. `app-v4/src/App.tsx` and the focused tests/oracles governing current Input behaviour

Historical reference only:

- `main:app.html` may be inspected for useful visual hierarchy and interaction cues.
- It is not product/runtime authority.
- Do not restore its multipage architecture, old compliance/anonymity claims, remote assets or historical execution paths.

## C-084 execution contract

Use the visible native OpenCode V2 TUI launched from this delivery worktree with:

```text
opencode .
```

The project-local config must load `atenea-volume` as the default primary coordinator.

Use the upstream Matt `implement` skill for issue #52. Matt owns implementation methodology, task decomposition, TDD where applicable, implementer worktrees and Standards + Spec review flow. Do not create a second orchestration workflow in parallel.

Use the exact project-local C-084 role/model bindings from `docs/ATENEA_EXECUTION_ROUTING_V0.md`.

This ticket remains `volume` because it is ordinary bounded UI/product work and issue #52 explicitly freezes the privacy/domain semantics. If actual implementation reveals a material privacy, security, state, trust-boundary or cross-cutting semantic change is required, STOP before making that semantic change.

## Scope / acceptance authority

Issue #52 is the complete Work Order authority. In particular, preserve unchanged:

- pasted-text vs file mutual exclusion;
- supported extensions;
- job-kind inference;
- structured single-file restriction and sheet selection;
- document batch rules and per-item failures;
- extraction/input-size fail-closed behaviour;
- Privacy Policy semantics;
- navigation/accessibility gates;
- memory-only sensitive state;
- zero unexpected outbound runtime network;
- Safe Output / Confidential Audit semantics.

No router, URL state, backend, analytics, external fonts/assets or runtime third-party dependency.

## Assurance

First line is deterministic evidence appropriate to the final diff:

- focused Input/App tests affected by the change;
- repository-required typecheck/lint/format/build gates as applicable;
- relevant privacy/network/storage oracles when the changed surface can affect them;
- focused responsive/accessibility behaviour where mechanically testable.

Screenshots are useful UX evidence but are supplementary, not correctness authority.

Do **not** add Semgrep or deep OCR ritualistically. Trigger them only if the actual diff crosses a material security/privacy/state boundary.

Review:

- Standards review through the bound C-084 Standards reviewer;
- Spec review through the bound C-084 volume Spec reviewer;
- at most one fresh autonomous correction pass for actionable findings;
- after that, any remaining blocker or new material issue => `HUMAN STOP`.

## Publication boundary

During this execution:

- no push;
- no PR creation/update;
- no issue mutation/closure;
- no deploy;
- no merge;
- no force-push/history rewrite.

Local commits are expected.

## Required final report

Finish with a concise final report containing:

- base SHA used for product implementation;
- final HEAD SHA;
- ordered local commits;
- changed surfaces;
- deterministic evidence run and results;
- actual C-084 roles/models used;
- Standards review result;
- Spec review result;
- whether the one correction pass was used and why;
- any real C-084/OpenCode V2 nesting or routing seam observed;
- worktree cleanliness;
- explicit `HUMAN STOP` if applicable.

Do not publish. Cora will audit the integrated result before any human merge decision.