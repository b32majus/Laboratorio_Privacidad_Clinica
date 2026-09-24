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

### Mandatory pre-implementation composition gate

A GitHub Work Order is a product/delivery scope boundary, **not automatically one implementation/review unit**.

Before any writer starts a substantial Work Order, forecast the likely authored-change shape using current Atenea `WORK_UNIT_COMPOSITION_POLICY_V1` and the ticket's real surfaces (domain, parser, UI, tests, CI/security, fixtures, dependency/debt work).

If the forecast indicates material over-budget risk or several independently coherent surfaces, define the intended chain of semantic work units **before writing code**. Each work unit must keep behavior with the tests/oracle that prove it and must be independently verifiable/reviewable.

Do not wait for `lens_context_budget_exceeded` after implementation to discover that composition was too coarse. Do not split mechanically by files or line count, and do not create tiny GitHub issues merely to satisfy review size. The Work Order may remain capability-sized while its implementation is composed into smaller reviewable units.

If one honest composition pass still leaves an indivisible unit beyond current Atenea policy, STOP before writing that unit and obtain the required size-exception/human decision.

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

Use the current Atenea native production protocol, not historical GP2.7/GP3.x orchestration recipes.

For a new train/session:
- reconcile current Git/GitHub/product authority first;
- start from a clean isolated worktree and a fresh `pi` session; do not resume stale Pi state;
- consume the current qualified Atenea runtime/profile (currently `native-balanced`) after conformance preflight; do not pin reviewer routing in this repo;
- let native Gentle own ODD/exploration, decomposition, workers, verification, work-unit commits, RDD/risk/review timing, correction lifecycle and acknowledgement/burn;
- keep `max_concurrency=1` at the external ticket/frontier level for this project;
- after each accepted work unit/ticket, rediscover blockers/frontier from durable GitHub authority;
- per-work-unit APPROVED + burn does not replace deterministic composed-state integration closeout for a multi-ticket train;
- use `docs/execution/QUALITY_EXECUTION_PROTOCOL_V1.md` before publication;
- publication/PR/issue mutation requires explicit human authority; merge is always human-owned.

Do not auto-merge, force-push, rewrite history, invent review transitions, recreate Atenea controllers, or treat a whole branch as a synthetic Gentle candidate merely to close a train.

## Legacy retirement

Legacy HTML/JS remains compatibility evidence until replacement flow has deterministic/E2E parity. Remove legacy only under an explicit retirement Work Order.
