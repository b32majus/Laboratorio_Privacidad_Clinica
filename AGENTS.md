# Agent instructions — Laboratorio de Privacidad Clínica

This repository is a brownfield privacy application being migrated to V4.

## Read first

For any implementation ticket, read in this order:

1. `CONTEXT.md`
2. the GitHub Work Order being executed, including comments and blockers;
3. the spec(s) explicitly cited by that Work Order;
4. `docs/shaping/CURRENT_DECISIONS.md`
5. `docs/execution/TRAIN_V4.md` only for train/frontier context;
6. relevant existing code/tests;
7. audit/debt documents only when the ticket cites them or evidence is needed.

Do not reconstruct product decisions from historical files when current V4 authority exists.

## Work Order discipline

A GitHub issue is the executable Work Order. Implement only its bounded scope.

If the issue says `EXECUTION_READY=NO`, do not implement it.

If `Blocked by:` references any open blocker, do not implement it.

If required authority is contradictory or materially incomplete, STOP rather than infer a product/clinical/privacy decision.

Do not expand the ticket to unrelated cleanup. Record newly discovered debt separately.

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

High-risk privacy/state/parser changes require negative/adversarial cases.

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

Normal unattended execution:
- explicit human authorization;
- persistent visible parent;
- fresh implementation child per newly selected ticket;
- `max_concurrency=1`;
- exact diff + deterministic verification;
- native exact-candidate Gentle RDD;
- APPROVED + acknowledgement/burn;
- authorized non-force checkpoint/publication;
- fresh frontier rediscovery;
- STOP before human merge.

Do not auto-merge, force-push, rewrite history, or invent recovery semantics.

## Legacy retirement

Legacy HTML/JS remains compatibility evidence until replacement flow has deterministic/E2E parity. Remove legacy only under an explicit retirement Work Order.
