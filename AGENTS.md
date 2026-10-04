# Agent instructions — Laboratorio de Privacidad Clínica

Status: **CURRENT — Atenea C-084 local policy**

This repository is the V4 brownfield privacy application. Product/domain authority is local to this repo; execution uses Atenea C-084 through project-local native OpenCode V2 agents and upstream Matt Pocock skills.

## Read first

For engineering work, read only what the task needs, in this order:

1. `docs/START_HERE.md`;
2. `CONTEXT.md`;
3. for recovery work, the owning section of `docs/RECOVERY_MASTER_PLAN_2026-10.md` and cited rows in `docs/audits/2026-10-recovery-traceability-matrix.md`;
4. the accepted GitHub issue/spec/ticket, including comments and blockers;
5. the cited `docs/specs/` contract(s) and relevant `docs/shaping/CURRENT_DECISIONS.md` decisions;
6. `CODING_STANDARDS.md`;
7. `docs/ATENEA_EXECUTION_ROUTING_V0.md` when executing through Atenea;
8. relevant code/tests/oracles and deployment/governance docs.

`docs/execution/`, `odd/tasks/`, historical handoffs and Gentle/Pi/RDD/4R/lineage/burn material are provenance unless a current ticket cites them as evidence. C-077–C-083 runtime instructions, OpenCode V1 and `--pure` are historical, not current execution instructions.

## Repository / Git authority

- Canonical V4 integration and Render deployment branch: `3.0-main`.
- Do **not** infer the V4 base from GitHub's repository default branch; as of the C-084 reconciliation the remote default is still `main`.
- Start implementation from a clean branch/worktree rooted at the exact accepted V4 base.
- Do not force-push, rewrite history, auto-merge, delete remote branches, or mutate repository settings without explicit human authority.
- A PR/review approval never grants merge or deploy authority.

## C-084 execution boundary

Herdr is user-owned persistent operator infrastructure and is already running. Do not launch, restart, replace or stop Herdr per ticket/train.

Normal visible execution from the existing Herdr project/worktree pane is:

```text
cd <project-or-worktree>
opencode .
```

- `opencode.json` sets `default_agent = atenea-volume`, so a fresh normal session starts in the volume coordinator;
- for accepted `complex` work, select `atenea-complex` in the visible TUI **before** submitting the execution prompt/handoff;
- do not manually change the model to bypass Atenea routing;
- `--pure`, V1 `permission`/`bash`/`task` configuration and OpenCode V1 are historical provenance;
- `opencode run` is reserved for explicit bounded automation/smokes, not the ordinary visible train path;
- Matt skills own implementation/TDD/task-graph/worktree/review methodology;
- this repo supplies product authority, coding standards, deterministic evidence and publication boundaries;
- the selected primary coordinator owns `/implement`/`/implement-spec`, the single canonical Standards+Spec review, review aggregation and correction dispatch;
- implementation workers own only implementation/TDD + candidate/evidence and must not invoke `/implement`, `/implement-spec`, `/code-review`, Standards/Spec reviewers or correctors;
- review start closes the originating implementer write phase for that candidate; review findings go only to a fresh bound corrector session;
- allow at most two fresh finding-scoped correction attempts for the same authorized finding envelope; persistence after attempt #2, a new material finding or scope expansion => HUMAN STOP;
- correctors remain single-pass per session; the coordinator, not the corrector, owns whether a second fresh correction session is authorized;
- no quota-driven or silent model fallback inside a work unit;
- never mutate global OpenCode configuration as per-project routing state.

Use `complex` for material privacy/security/trust-boundary risk, difficult state/concurrency/temporal semantics, cross-cutting architecture, delicate migration/back-compat invariants, or repeated semantic failure. Ordinary UI/file-count/business importance alone are not complex triggers.

## Product architecture invariants

- One V4 SPA/app shell: `Input → Configure → Review → Privacy Gate → Export`.
- Vite + TypeScript + React + compiled Tailwind; no backend/SSR/remote PHI-processing API.
- Domain state is independent of the DOM; `ReviewSession` is review/final-text authority.
- Existing privacy behavior is migrated behind explicit adapters/contracts; no big-bang rewrite.
- Heavy processing stays behind the accepted Web Worker boundary where applicable.
- Keep one durable source of truth for policy/state/identity; ambiguous classification fails explicitly.
- During the 2026-10 recovery train, do not treat route/workflow existence as product parity. Preserve the capability contract owned by the Recovery Master Plan/matrix; any deliberate substitution/removal must be explicit and traced back to the matrix.

## Privacy and data invariants

Never:

- log PHI/PII to console or remote services;
- add analytics/tag managers/error SaaS/remote runtime resources to the clinical origin;
- place sensitive content in URL/query/hash;
- add remote PHI processing or unexpected runtime network calls without accepted authority;
- call output anonymous/compliant/certified without implemented evidence;
- silently truncate input or hide failed batch items;
- treat `UNKNOWN` structured classification as success/KEEP.

Sensitive Job data defaults to memory only. Use only synthetic committed fixtures/tests.

## Safe vs confidential outputs

Safe Output and Confidential Audit are separate artifacts and authorities.

Safe Output must not contain correspondence mappings, originals retained solely for traceability, reviewer notes or confidential audit tables. Confidential Audit remains a separate explicit action/file.

## Deterministic evidence

Existing repo-native checks are first-line authority: tests, typecheck, lint, build, Playwright, privacy-eval, storage/external/PDF/vendor/positioning/header/release-QA oracles and CI/CodeQL as applicable.

For material privacy/state/parser/security/checker changes, prefer a falsifiable oracle: known-good + representative planted violation/negative case, including built-artifact validation when the invariant applies to shipped output.

Do not add prose for a rule that an existing checker already enforces. Newly discovered debt stays separate from the requested change unless current authority explicitly includes it.

## Frontend and accessibility

Preserve semantic controls, keyboard operability, visible focus, readable status/error communication, AA contrast for normal operational text, responsive behavior and non-color-only state. Do not introduce a large global state framework or new application architecture without accepted authority.

## Deployment

Current clinical target is Render Static. The clinical origin serves static application bytes; clinical content remains in the browser. `render.yaml` is deployment/header authority. Cloudflare remains an availability experiment, not the canonical target.

Before publication, validate changed artifact types using repo-native validators and the current Atenea pre-publication policy. Workflow changes require workflow parsing plus credential capability; deployment/config changes require the owning parser/oracle where available.

## Agent skills

### Issue tracker

Work is tracked in GitHub Issues. See `docs/agents/issue-tracker.md`.

### Triage labels

Matt triage roles are configured in `docs/agents/triage-labels.md`; missing remote labels are not authority to create them silently.

### Domain docs

This repo keeps canonical vocabulary/boundaries in `CONTEXT.md` plus accepted decisions/specs. See `docs/agents/domain.md`.
