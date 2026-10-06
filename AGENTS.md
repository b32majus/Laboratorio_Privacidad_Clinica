# Agent instructions — Laboratorio de Privacidad Clínica

Status: **CURRENT — Atenea C-086 thin local execution policy**

This repository is the V4 brownfield privacy application. Product/domain authority is local to this repo; execution uses Atenea C-086 thin native OpenCode V2 through project-local agents and upstream Matt Pocock skills. C-086 retains the C-084 lifecycle and C-085 runtime/model economics while removing duplicated execution ceremony.

## Read first

Read only what the current work needs:

1. `docs/START_HERE.md`;
2. the accepted GitHub issue and durable execution handoff for the current unit;
3. `CODING_STANDARDS.md` and only the relevant `CONTEXT.md` / domain authority they require;
4. for recovery work, the owning `RECOVERY_MASTER_PLAN_2026-10.md` section and matrix/PDR rows cited by the handoff;
5. for material human-facing work, `docs/HUMAN_PRODUCT_DESIGN_AUTHORITY_V1.md` only when the handoff activates that authority;
6. `docs/ATENEA_EXECUTION_ROUTING_V0.md` for current role/model bindings;
7. specialized shaping/fidelity/prepublication documents only when the handoff, a concrete review finding, or the publication boundary explicitly activates them;
8. the relevant code/tests/oracles.

Historical handoffs, `docs/execution/`, `odd/tasks/`, C-077–C-085 execution prose, Gentle/Pi/RDD/4R/lineage/burn material, OpenCode V1 and `--pure` are provenance unless current authority explicitly cites them.

## Repository / Git authority

- Canonical V4 integration and Render deployment branch: `3.0-main`.
- Do **not** infer the V4 base from GitHub's repository default branch; as of the C-084 reconciliation the remote default is still `main`.
- Start implementation from a clean branch/worktree rooted at the exact accepted V4 base.
- Do not force-push, rewrite history, auto-merge, delete remote branches, or mutate repository settings without explicit human authority.
- A PR/review approval never grants merge or deploy authority.

## C-086 thin execution boundary

Herdr is persistent operator infrastructure; do not launch, restart, replace or stop it per ticket. Normal visible execution is:

```text
cd <project-or-worktree>
opencode .
```

- Cost policy and risk class remain independent: `cost_policy = standard | free_only | go`; `risk_class = volume | complex`.
- OpenCode runtime authority is V2 `2.0.22`.
- Standard Volume writer = DeepSeek V4 Flash; Standard Complex writer = GLM 5.3 Flash high.
- `opencode.json` keeps `default_agent = atenea-volume`; select `atenea-complex` explicitly for a Complex unit.
- The selected primary coordinator owns `/implement` or `/implement-spec`, one canonical Standards + Spec review, review aggregation and correction dispatch.
- Implementation workers own focused implementation/TDD, the smallest relevant deterministic checks and the fixed candidate only. Broad/full suites are integration/publication evidence by default, not writer ritual, unless the accepted handoff explicitly requires them earlier.
- Review start closes the originating implementer write phase. Review-driven mutation goes only to a fresh bound corrector.
- Allow at most two fresh finding-scoped correction attempts for the same authorized finding envelope. A blocker after attempt #2, a new material issue or scope expansion is HUMAN STOP.
- Delegate by durable reference: child prompts carry the work identity/fixed point, `@handoff`, phase boundary and only a small task-specific delta. Do not restate the handoff, this file or specialized policy prose.
- Specialized safeguards are conditional. Apply shaping/fidelity/adversarial/shared-seam safeguards only when the accepted handoff names them or a concrete review finding opens them.
- Material product/architecture/privacy/data-semantics/acceptance choices remain attended Cora + human authority. Execution reports a concrete question and stops rather than deciding it.
- No silent provider/model fallback, no per-ticket mutation of global OpenCode config, and no `--pure`.
- Publication/merge remain human-owned.

Use `complex` only for material privacy/security/trust-boundary risk, difficult state/concurrency/temporal semantics, cross-cutting architecture, delicate migration/back-compat invariants, or repeated semantic failure. Ordinary UI/file-count/business importance alone are not complex triggers.

Cora prepares real work through `READY_TO_LAUNCH`; the human retains final visible launch.

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

Existing repo-native checks are first-line authority. During implementation use focused TDD + the smallest checks relevant to the changed property; broader composed/full-suite checks belong to integration/publication unless current authority explicitly requires them earlier.

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
