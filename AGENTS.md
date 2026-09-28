# Agent instructions — Laboratorio de Privacidad Clínica

This repository is a brownfield privacy application being migrated to V4.

## Read first

For any implementation ticket, read in this order:

1. `CONTEXT.md`
2. the GitHub Work Order being executed, including comments and blockers;
3. the spec(s) explicitly cited by that Work Order;
4. `docs/shaping/CURRENT_DECISIONS.md`
5. `docs/execution/QUALITY_EXECUTION_PROTOCOL_V1.md`;
6. `docs/execution/TRAIN_V4.md` only for train/frontier context;
7. relevant existing code/tests;
8. audit/debt documents only when the ticket cites them or evidence is needed.

Do not reconstruct product decisions from historical files when current V4 authority exists.

## Work Order discipline

A GitHub issue is the executable Work Order. Implement only its bounded scope.

If the issue says `EXECUTION_READY=NO`, do not implement it.

If `Blocked by:` references any open blocker, do not implement it.

If required authority is contradictory or materially incomplete, STOP rather than infer a product/clinical/privacy decision.

Do not expand the ticket to unrelated cleanup. Record newly discovered debt separately.

### Conditional work-unit composition

A GitHub Work Order is a product/delivery scope boundary, **not automatically one implementation/review unit**.

Use Atenea `WORK_UNIT_COMPOSITION_POLICY_V1` only when there is concrete evidence before or during implementation that the accepted Work Order contains several independently coherent delivery units or is likely to exceed a reliable review/context boundary. Do not run a forecast ritual for every substantial ticket merely because the control exists.

When the trigger is real, define the smallest semantic work-unit chain that keeps behavior with the tests/oracle that prove it. Do not split mechanically by files or line count, and do not create tiny GitHub issues merely to satisfy review size.

If an indivisible coherent unit still exceeds current Atenea policy, STOP before writing that unit and obtain the required size-exception/human decision.

## V4 architecture invariants

- One SPA/app shell.
- Domain state is independent of the DOM.
- `ReviewSession` is the authority for review output.
- Detect/transform concerns become recognizer/operator/policy boundaries progressively.
- Heavy processing moves behind a Web Worker boundary.
- Existing privacy core is preserved behind adapters until regression evidence supports migration.
- No big-bang rewrite.
- No backend/SSR/remote PHI API.

## Privacy invariants

Never:
- log PHI/PII to console or remote services;
- add analytics/tag managers/error SaaS to the clinical origin;
- put sensitive data in URLs;
- add a runtime third-party network dependency without explicit spec authority;
- call an output "anonymous" merely because direct identifiers were replaced;
- silently truncate content;
- hide failed batch items;
- default unknown structured privacy classification to KEEP.

Use only synthetic test fixtures committed to the repository.

## Safe vs confidential outputs

Safe Output and Confidential Audit are separate products.

Safe Output must never include:
- original↔transformed correspondence;
- original sensitive values solely for traceability;
- internal notes;
- confidential mapping tables.

Confidential Audit must be visibly and technically separate.

## Testing

Each behavioral ticket must add or update a deterministic oracle capable of disagreeing with the implementation.

High-risk privacy/state/parser changes require negative/adversarial cases. A new or materially changed checker/scanner/gate must prove it rejects a representative planted violation, not merely that the current repository passes.

If an implementation documents exceptional parser/state/failure branches, representative branches must execute in deterministic tests when mechanically testable.

Existing smoke tests are not sufficient evidence for new behavior when the spec calls for stronger regression coverage.

## Frontend

Target stack is Vite + TypeScript + React + compiled Tailwind.

Do not introduce Next.js, SSR, a backend, or a large global state framework unless a later accepted spec changes this decision.

Preserve accessible semantics:
- keyboard operability;
- visible focus;
- WCAG AA contrast for normal operational text;
- no color-only state;
- responsive desktop/tablet/mobile behavior.

## Deployment

Production target for the current phase is Render Static.

Do not add Cloudflare as the canonical production target. Cloudflare remains an explicit availability experiment gated by Spain/LaLiga testing.

The clinical origin must be able to enforce a strict CSP and zero unexpected outbound network requests.

## Atenea execution boundary

Use the current Atenea prepared-ticket protocol, starting at `b32majus/Atenea/docs/START_HERE.md` and current execution decision C-077. Do not copy Atenea runtime internals into this repository beyond the stable boundary below.

For a new train/session:

- reconcile current Git/GitHub/product authority first;
- preserve or create a clean isolated worktree; do not discard valid existing train progress merely because the runtime protocol changed;
- use a Pi supervisor + Herdr and exactly one plain Pi ticket worker (`pi --no-extensions`) per active ticket;
- the worker reads this file, `docs/execution/QUALITY_EXECUTION_PROTOCOL_V1.md`, current Work Order/spec authority and applicable project skills before writing;
- the Work Order is already shaped: do not run ODD or `gentle-orchestrator`, and do not reopen accepted product semantics unless current authority is actually incomplete or contradictory;
- implement only the accepted bounded scope, run its deterministic/privacy/security/oracle checks and create the authorized local candidate commit;
- enter native Gentle review with Codex transport from the real candidate boundary and follow only exact provider-issued transitions when review is due;
- keep `max_concurrency=1` at the external ticket/frontier level for this project;
- after each accepted ticket/work unit, rediscover blockers/frontier from durable GitHub authority;
- per-work-unit review does not replace deterministic composed-state integration closeout for a material multi-ticket train;
- use `docs/execution/QUALITY_EXECUTION_PROTOCOL_V1.md` before publication;
- publication/PR/issue mutation requires explicit human authority; merge is always human-owned.

Do not manually export `GENTLE_PI_REVIEW_RELAY_CONTRACT`, auto-merge, force-push, rewrite history, invent review transitions, recreate Atenea controllers, or treat a whole branch as a synthetic Gentle candidate merely to close a train.

OpenCode Build is the qualified Atenea fallback only after a concrete Pi runtime/tooling failure; fallback does not authorize ODD or product rediscovery.

## Legacy retirement

Legacy HTML/JS remains compatibility evidence until replacement flow has deterministic/E2E parity. Remove legacy only under an explicit retirement Work Order.
