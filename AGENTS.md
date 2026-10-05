# Agent instructions — Laboratorio de Privacidad Clínica

Status: **CURRENT — Atenea C-085/C-084 local policy**

This repository is the V4 brownfield privacy application. Product/domain authority is local to this repo; execution uses Atenea C-085 over the C-084 native OpenCode V2 lifecycle through project-local agents and upstream Matt Pocock skills.

## Read first

For engineering work, read only what the task needs, in this order:

1. `docs/START_HERE.md`;
2. for user-facing REC-05→REC-11 work, `docs/HUMAN_PRODUCT_DESIGN_AUTHORITY_V1.md`;
3. `CONTEXT.md`;
4. for recovery work, the owning section of `docs/RECOVERY_MASTER_PLAN_2026-10.md` and cited rows in `docs/audits/2026-10-recovery-traceability-matrix.md`;
5. the accepted GitHub issue/spec/ticket, including comments and blockers;
6. the cited `docs/specs/` contract(s) and relevant `docs/shaping/CURRENT_DECISIONS.md` decisions, applying later accepted presentation supersessions before older UI prescriptions;
7. `CODING_STANDARDS.md`;
8. `docs/ATENEA_EXECUTION_ROUTING_V0.md` when executing through Atenea;
9. for a non-standard cost route, the owning profile/catalog (`ATENEA_GO_*` or `ATENEA_FREE_*`);
10. `docs/ATTENDED_PRODUCT_SHAPING_GUARDRAILS_V1.md` / `docs/PRODUCT_FIDELITY_GATES_V1.md` when the current work triggers their shaping/composition/representation conditions;
11. relevant code/tests/oracles and deployment/governance docs.

`docs/execution/`, `odd/tasks/`, historical handoffs and Gentle/Pi/RDD/4R/lineage/burn material are provenance unless a current ticket cites them as evidence. C-077–C-083 runtime instructions, OpenCode V1 and `--pure` are historical, not current execution instructions.

## Repository / Git authority

- Canonical V4 integration and Render deployment branch: `3.0-main`.
- Do **not** infer the V4 base from GitHub's repository default branch; as of the C-084 reconciliation the remote default is still `main`.
- Start implementation from a clean branch/worktree rooted at the exact accepted V4 base.
- Do not force-push, rewrite history, auto-merge, delete remote branches, or mutate repository settings without explicit human authority.
- A PR/review approval never grants merge or deploy authority.

## C-085/C-084 execution boundary

Herdr is user-owned persistent operator infrastructure and is already running. Do not launch, restart, replace or stop Herdr per ticket/train.

Normal visible execution from the existing Herdr project/worktree pane is:

```text
cd <project-or-worktree>
opencode .
```

- cost policy and risk class are independent: `cost_policy = standard | free_only | go`; `risk_class = volume | complex`;
- `opencode.json` keeps `default_agent = atenea-volume` for the standard route;
- for `standard + complex`, select `atenea-complex` before submitting the execution handoff; for human-selected `go`, select `atenea-go` and state `Cost policy: go` plus `Risk class: volume|complex`; for `free_only`, select `atenea-free` and state the risk class;
- `go` is a qualification candidate, not a quality-equivalence claim, and neither Go nor Free permits silent model/provider fallback; missing/unavailable bound models are HUMAN STOP at a clean boundary;
- do not manually change the model to bypass Atenea routing;
- `--pure`, V1 `permission`/`bash`/`task` configuration and OpenCode V1 are historical provenance;
- `opencode run` is reserved for explicit bounded automation/smokes, not the ordinary visible train path;
- Matt skills own implementation/TDD/task-graph/worktree/review methodology;
- this repo supplies product authority, coding standards, deterministic evidence and publication boundaries;
- the selected primary coordinator owns `/implement`/`/implement-spec`, the single canonical Standards+Spec review, review aggregation and correction dispatch;
- coordinator roles are orchestration-only for tracked repository mutation: product/tests/docs/config changes are delegated to the bound implementer/corrector/merger role;
- implementation workers own only implementation/TDD + candidate/evidence and must not invoke `/implement`, `/implement-spec`, `/code-review`, Standards/Spec reviewers or correctors;
- review start closes the originating implementer write phase for that candidate; review findings go only to a fresh bound corrector session;
- allow at most two fresh finding-scoped correction attempts for the same authorized finding envelope; persistence after attempt #2, a new material finding or scope expansion => HUMAN STOP;
- correctors remain single-pass per session; the coordinator, not the corrector, owns whether a second fresh correction session is authorized;
- no quota-driven or silent model fallback inside a work unit;
- under standard cost, routing changes only at clean work-unit boundaries: Volume writer = DeepSeek V4 Flash; Complex writer = GLM 5.3 Flash high; an already-started pre-C-085 unit keeps its original route until it closes;
- never mutate global OpenCode configuration as per-project routing state.

Use `complex` for material privacy/security/trust-boundary risk, difficult state/concurrency/temporal semantics, cross-cutting architecture, delicate migration/back-compat invariants, or repeated semantic failure. Ordinary UI/file-count/business importance alone are not complex triggers.

Material product shaping remains attended Cora + human work. For material human-facing work, `docs/HUMAN_PRODUCT_DESIGN_AUTHORITY_V1.md` is applied **before** technical/spec grilling: task, mental model, interaction hypothesis, default path, representation and friction are human-owned authority; Matt is the second filter. Before `READY_TO_LAUNCH`, preserve the smallest non-negotiable product rails, perform the human-product recheck, and apply the current shaping/product-fidelity gates when their conditions are triggered. OpenCode implements the closed envelope; a new material product/architecture/privacy question is HUMAN STOP rather than model discretion.

Cora prepares real work only through `READY_TO_LAUNCH`; the human retains the final visible launch in the existing Herdr/OpenCode pane.

## Product architecture invariants

- One V4 SPA/app shell and one in-memory Job. `Input → Configure → Review → Privacy Gate → Export` may remain internal/domain pipeline structure, but D-023 + Human Product Design Authority govern visible topology; no phase becomes a user destination merely because it exists internally.
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

For any new UI/control/adapter/schema/export representation, apply the representation-narrowing check: accepted precision, cardinality, ranges, states, combinations, ordering and unset/unknown distinctions may not be silently collapsed.

When a changed shared helper/generator/serializer/state authority can affect sibling consumers, trace the behavioral blast radius even when those sibling files have zero diff. A materially affected supported surface outside the current envelope is HUMAN STOP, not silent scope expansion.

For material universal/negative/preservation/boundary claims (`all`, `never`, `preserve`, `lossless`, `only after`, etc.), evidence must include an adversarial fixture capable of falsifying the exact claim; prose may not exceed the falsification power actually exercised.

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
