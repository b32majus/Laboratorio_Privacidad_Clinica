# T17 / #21 — Batch state, failure, storage and consistency refactor

Status: IN_PROGRESS (T17 #21)
Work Order: GitHub #21 (`EXECUTION_READY=YES`; `Blocked by: #4, #8, #9` — all CLOSED; no comments;
DEBT_IDS=FUNC-002, BATCH-001, BATCH-002, BATCH-004, UX-004; SPEC_AUTHORITY=docs/specs/SPEC_V4_BATCH_AND_STRUCTURED.md)
Branch: `work/opencode/v4-overnight-t17-t18-20260928`
START_HEAD: `a3c8067`
Publication boundary: **LOCAL_ONLY** (no push, PR, issue mutation, merge, release, deploy). No T18 work.

## Authority read for this ticket

- `AGENTS.md` (read-first order, Work Order discipline, composition gate, privacy invariants, testing/oracle
  rules, Atenea execution boundary, legacy-retirement rule), `CONTEXT.md`.
- GitHub #21 body. Scope: "Move document batch into V4 Job state with explicit item status, real review
  completion and shared ProcessingContext." Acceptance: (1) failed documents remain visible and block/affect
  Privacy Gate appropriately; (2) navigating a document does not mark it reviewed; (3) no large batch payload
  shuttle through sessionStorage; (4) no global monkey patch; (5) shared context produces intended
  cross-document consistency; (6) batch is not presented as a separate Premium app. Required deterministic
  verification: multi-file synthetic batch with one forced read/process error; review-state test; consistency
  test. Out of scope: unrelated cleanup/refactors; product/privacy decisions not stated in the cited spec;
  auto-merge/force-push/history rewriting; real PHI in tests.
- `docs/specs/SPEC_V4_BATCH_AND_STRUCTURED.md` §1 (batch as a Job; item state vocabulary
  `queued | reading | processing | review-required | completed | error`; failed item stays visible and
  contributes to Privacy Gate readiness), §2 (no sessionStorage payload shuttle; active Job state in memory;
  IndexedDB/job recovery NOT in baseline), §3 (shared consistency via ProcessingContext; no monkey-patching
  singleton methods; failure must not leave mutated global behavior for subsequent documents), §4 (document
  formats — unchanged by this ticket). §5–13 (structured) are T18/T19 scope.
- `docs/shaping/CURRENT_DECISIONS.md` D-004 (review authority in domain, export gated on review), D-009
  (fail closed; never silently truncate), D-011 (batch is a normal capability, NOT Premium; failed files stay
  in batch state; cross-document consistency via explicit shared context, never monkey-patched globals),
  D-013 (sensitive job data memory-only).
- `docs/execution/QUALITY_EXECUTION_PROTOCOL_V1.md` §2 (falsifiable authority), §3.5 (oracle self-test),
  §3.6 (exceptional branches execute in tests), §3.8 (debt closure), §4 (pre-writer composition forecast),
  §5 (per-work-unit chain), §10 (T06 lesson: compose before writing).
- `docs/execution/TRAIN_V4.md` Train D T17 row: "batch in app state, errors retained, real review status, no
  sessionStorage payload shuttle/monkey patch."
- Debt: `docs/DEBT_REGISTER.md` FUNC-002 (P0: do not mark a document reviewed by navigating/exporting),
  BATCH-001 (P1: keep failed documents inside batch state), BATCH-002 (P1: remove sessionStorage dependency
  for large batch), BATCH-004 (P1: remove AsignadorSustitutos monkey patch), UX-004 (P1: integrate batch as a
  natural capability, remove Premium framing). Related but NOT in DEBT_IDS: BATCH-003 (shared ProcessingContext
  consistency — largely delivered at engine level in T13 #17; T17 threads it through the app-level batch path).

## Measured baseline (this worktree, HEAD a3c8067, 2026-09-28)

- `npm test` full chain PASS (check:links, check:storage, check:external, check:vendor, check:pdfjs,
  check:smoke, check:positioning, test:domain 55/55, test:privacy-eval, check:privacy-eval, vitest
  **34 files / 613 tests**).
- Worktree clean; branch `work/opencode/v4-overnight-t17-t18-20260928`.

## What already holds (do not re-implement)

- `JobKind` already includes `document-batch` (≥2 document files) and the App already accepts multi-file
  selection and extracts every file (`App.tsx` `extractAndCreate`).
- The review authority (T01 `js/domain/review-session.js`) and its V4 facade (`review-domain.ts`) are frozen:
  decisions, previews, final text, `canFinalize`. T17 reuses them per document; it never re-implements them.
- The engine shared-context seam (T05/T13/T16): `ProcessingContext` (`mode: "fresh" | "shared"`,
  `pseudonymState`, `options.dateShift`) is a plain frozen serializable carrier; both V4 engines reset the
  legacy module singletons at every `process()` call and re-seed from the passed context
  (`registry-engine.ts`), so per-item isolation and cross-document consistency are engine-proven
  (`patient-pseudonym-composition.test.ts`, `date-longitudinal.test.ts`). T17 only THREADS the context at the
  app level (today `review-domain.ts:102` always passes `mode: "fresh"`).
- T15 invariants: single supported-size authority (`engine/input-limits.ts`, never re-implemented here),
  explicit per-attempt job-level `processing` state (`idle/running/succeeded/failed/unknown`), typed failure
  classification (`processing-outcome.ts`).
- V4 runtime already has ZERO sessionStorage/localStorage use (only tests spy on storage;
  `network-invariant.test.tsx` pins storage empty). The legacy sessionStorage batch shuttle
  (`js/shared/app-session.js`) and the AsignadorSustitutos monkey patch (`js/batch-module.js:146-175`) are
  LEGACY-ONLY and unreachable from the V4 SPA; they remain compatibility evidence until T25 #29 retirement.
- V4 surfaces carry no Premium framing (`App.tsx:49` neutral "Document batch" label); Premium copy is
  legacy-only (`input.html`, `batch.html`, `js/batch-exporter.js`).

## Gaps this ticket must close (honest reading of the acceptance bullets)

1. No per-item state exists: `JobSourceFile` has no status; spec §1's six-state vocabulary is absent from V4
   code. A failed extraction aborts the whole batch at `createJob` (`assertExtractionsUsable` throws), so a
   failed document can never live inside batch state (BATCH-001 violated; acceptance 1 fails).
2. Batch review is unsupported: `jobSupportsReview` excludes `document-batch`; `startReviewSession` throws;
   the App renders a placeholder. There is no per-document review completion at all (acceptance 2 is
   meaningless until batch review exists; FUNC-002 must then hold by construction).
3. The app-level batch path does not exist, so there is no shared ProcessingContext threading in the app
   (`mode: "fresh"` always); acceptance 5 is unproven at the product level (BATCH-003 engine half exists).
4. The Privacy Gate has no batch item awareness (`privacyGateModel.ts` header explicitly defers batch to
   T17); a failed item cannot affect it (acceptance 1 fails).
5. The invariants "no sessionStorage shuttle", "no monkey patch", "no Premium framing" hold by absence in V4
   but are not pinned by any deterministic guard/oracle of their own (BATCH-002/BATCH-004/UX-004 need
   evidence to reconcile the debt rows).

## Semantic decisions (resolved before writing)

- **SD-1 — Item state vocabulary and placement.** `BatchItemStatus = "queued" | "reading" | "processing" |
  "review-required" | "completed" | "error"` (spec §1 verbatim). It lives ON the batch source file
  (`JobSourceFile.itemStatus`), plus an item-level typed failure record (`itemError?: JobError`). The item
  identity is the file's index in `job.source.files` (selection order, stable).
- **SD-2 — Two-phase batch intake (the Job owns the input from selection).** For `document-batch`,
  `createJob` receives metadata-only files (name/extension, NO extraction outcomes) and every item starts
  `queued`. The App then reads each file through domain transitions: `beginItemRead` (queued→reading),
  `recordItemRead` (reading→queued with `extraction.extractedText` held, or →error). This makes all six spec
  states reachable and exercisable deterministically (QUALITY §3.6). Single-document (`kind="document"`) and
  text jobs keep today's extract-then-create flow unchanged (all-or-nothing refusal preserved, out of scope).
  Fail-closed: batch `createJob` refuses files that already carry extraction outcomes (the read phase owns
  outcomes after creation), refuses an empty/whitespace-only read outcome, and asks the size authority
  (`oversizeInputFor`) about every read outcome — an oversize read becomes an item error carrying the shared
  actionable message; the refused payload text is NOT held in the job.
- **SD-3 — Item failure representation (BATCH-001).** Any read/process failure records
  `itemStatus: "error"` + `itemError {code, message}` (codes mapped through the existing vocabularies:
  extraction failure codes via `jobErrorCodeFor`, processing failures via `classifyProcessingFailure`). For
  read failures the job item does not duplicate the adapter's `extraction.failed` shape: batch items carry
  text via `extraction.extracted` or failure via `itemError`, never both. The failed item stays in the batch,
  visible everywhere the batch is surfaced (review item list, Privacy Gate).
- **SD-4 — Per-item processing with a shared context; a mid-batch failure does not abort the batch.** At
  review start the bridge loops over `queued` items in order: `beginItemProcessing` (queued→processing) →
  engine `process()` with the carried context (first item `mode:"fresh"`, then `mode:"shared"` with the
  previous outcome's context) → success: `review-required` + per-item ReviewSession; failure: `error` +
  classified failure. Remaining items still process (engine per-call singleton reset guarantees isolation;
  spec §3). Job-level T15 `processing` stays the ATTEMPT tracker (`succeeded` = the pass completed with
  per-item outcomes explicitly recorded; it never implies every item succeeded — the gate never infers
  readiness from it alone). No monkey patching; no singleton mutation outside the engine's own per-call
  reset/reconcile seam.
- **SD-5 — Real review completion per document (FUNC-002).** Each processed item owns a ReviewSession. An
  item's completion is EXACTLY `canFinalize(its session)` → `completed`, else `review-required`, recomputed
  atomically on `decide`/`addManual` for the ACTIVE item only. Document navigation (selecting another item)
  changes only the viewed index; it NEVER writes statuses or review state. App-step navigation continues to
  go through `goToStep` only. Pinned by the review-state oracle.
- **SD-6 — Batch readiness derivation (one authority).** Domain helpers read item statuses as the single
  source: `batchReviewComplete(job)` = every non-error item is `completed`; `batchHasErrorItems(job)`;
  `batchFailedItems(job)`. Job-level `review.complete` (for batch) = `batchReviewComplete` — it drives the
  existing export step gate unchanged. `outputs.safeOutputReady` (batch) = complete AND zero error items (a
  failed document blocks the batch output; silently excluding it would hide a failed batch item, which the
  privacy invariants forbid). `confidentialAuditReady` (batch) = the processing attempt completed (sessions
  exist for all non-error items). All derived in ONE atomic bridge write per fact change.
- **SD-7 — Export blockers are explicit and distinct.** For batch, the domain export transition gains a
  second guard: an error item present blocks export with a NEW typed code `batch-item-failed` naming the
  failed files and the remedy (create a new job without them), distinct from `review-incomplete`. Both gates
  fail closed. Batch Safe Output FORMAT is not defined by the accepted spec (spec §13 is structured-only), so
  the export step for a fully-completed batch shows an explicit typed unavailable reason instead of inventing
  a format. No correspondence/output semantics are invented here.
- **SD-8 — Policy change invalidates derived review state per item.** `setPolicy` on a batch resets
  job-level state (existing semantics) AND returns non-error items to `queued` (their sessions/detections are
  stale under the new policy; the bridge drops all item sessions). Read-error items stay error (a read error
  is policy-independent). Process-error items whose code is `policy-unsupported` return to `queued` (the new
  policy may support them; natural remedy path). Every other error item stays error (remedy: recreate the
  job).
- **SD-9 — Privacy Gate batch facts.** `PrivacyGateView` gains batch item facts (per-item name + status +
  failure message, counts) and its readiness/blocked copy reflects failed items factually. The gate never
  claims safety; it stays a factual readiness view (CONTEXT.md §2). Single-document/text gate behavior is
  unchanged.
- **SD-10 — Invariant pins (BATCH-002/BATCH-004/UX-004).** (a) The CI storage checker
  (`scripts/ci/check-storage-policy.mjs`) is extended to refuse ANY sessionStorage/localStorage reference in
  V4 production sources (`app-v4/src` excluding tests), with the checker's own self-test extended
  (known-good + planted violation must fail — QUALITY §3.5). (b) No-monkey-patch and failure-isolation are
  pinned by the batch consistency/isolation oracles (a forced mid-batch failure must leave subsequent
  documents' shared-context consistency intact). (c) A UI-level oracle pins that the V4 shell never renders
  Premium framing. Legacy surfaces are NOT touched (T25 retirement owns them).
- **SD-11 — Race discipline.** Async per-item reads write through functional state updaters guarded by job
  identity (an outcome for a superseded job id is discarded), so clearing/replacing a job mid-read cannot
  apply stale item outcomes.
- **SD-12 — Out of scope, explicitly.** Structured/CSV/XLSX surfaces (T18/T19); batch Safe Output format and
  export redesign; batch item retry/removal UX (remedy is job recreation); IndexedDB/job recovery (spec §2);
  legacy HTML/JS changes (T25); Web Worker boundary (T22); unrelated cleanup.

## Composition forecast (Atenea WORK_UNIT_COMPOSITION_POLICY_V1)

Surfaces touched: domain contracts (job.ts), review/bridge seam (review-domain.ts, useJobSession.ts), engine
context threading (reuse only), UI integration (App.tsx, ReviewWorkspace reuse, PrivacyGate), CI checker,
and ~8 test files. The capability decomposes along three independently verifiable seams; none can be split
into "implementation without its oracle".

- **WU-A — Batch item-state domain contract + export guard.** `BatchItemStatus` vocabulary, two-phase batch
  creation (metadata-only, `queued`), read/process/review item transitions with fail-closed preconditions,
  item error retention (read/oversize/empty), batch readiness helpers, `setPolicy` item reset, domain export
  blocker `batch-item-failed`; domain oracles (creation, retention, transition table incl. exceptional
  branches, policy reset, export guard, immutability). Est ≈ 400–500 authored lines (domain contract is
  indivisible: creation without transitions would leave unreachable states).
- **WU-B — Batch review seam: shared-context processing, per-document sessions, bridge.** `jobSupportsReview`
  batch support, per-item engine primitive with context threading, bridge batch state (item sessions, active
  index), batch `startReview` loop with explicit outcomes, atomic per-item completion derivation, navigation
  purity; review-state oracle (navigation never marks reviewed; per-item completion isolation), consistency
  oracle (shared pseudonyms/date context across documents through the bridge path), isolation oracle (forced
  mid-batch failure leaves subsequent consistency intact), single-session entry still refuses batch. Est ≈
  400–450 authored lines.
- **WU-C — Gate + UI integration + storage guard.** `PrivacyGateView` batch facts + copy, App batch flow
  (two-phase intake wiring, batch review view with document navigation reusing ReviewWorkspace, export
  unavailable reason), forced read-error e2e oracle, premium-free pin, storage checker extension + self-test.
  Est ≈ 350–450 authored lines.

Forecast total ≈ 1,200–1,400 authored lines over 3 units; each unit keeps behavior + oracle together, is
independently verifiable, and sits at/near the ≈400-line planning heuristic (advisory; no artificial splitting).
No size exception required. **Delivery: LOCAL_ONLY** — work-unit commits on this feature branch; no PR/chain
(publication is a later human decision, so no chain strategy applies; recorded per user instruction).

## Route declaration (delegation triggers)

- T17.1–T17.3 (WU-A/B/C): each touches 2+ non-trivial files → **delegated direct**, one bounded writer per
  unit (writer trigger). Parent owns design/verification/falsification; writer owns the unit's edits + first
  verification pass.
- Falsification probes + independent verification: parent-side, fresh read-only context per unit.
- TDD resolution: no strict-TDD configuration exists in this repo/session; the repo's own discipline applies —
  deterministic oracles that can disagree (including planted violations and exceptional branches), tests
  authored alongside behavior. Runner: `npm run test:v4` (vitest); full `npm test` chain at ticket closeout.

## Tasks

- [ ] **T17.0** Open ticket: this doc + Engram mirror `odd/t17-batch-state-storage-consistency/tasks`; commit
      `docs(odd): open T17 #21 …` (evidence: commit recorded here).
- [ ] **T17.1 (WU-A)** Domain contract + oracles; verification (`test:v4`, `typecheck:v4`, `lint:v4`,
      `format:check:v4`); falsification probes; commit `feat(domain): … (T17 #21 WU-A)`; RDD assess on the
      committed range.
- [ ] **T17.2 (WU-B)** Review/bridge seam + oracles (review-state, consistency, isolation); verification;
      falsification probes; commit `feat(review): … (T17 #21 WU-B)`; RDD assess.
- [ ] **T17.3 (WU-C)** Gate + UI + storage guard + e2e oracle; verification; falsification probes; commit
      `feat(app): … (T17 #21 WU-C)`; RDD assess.
- [ ] **T17.4** Ticket closeout: full `npm test` chain + build at final HEAD; debt reconciliation
      (FUNC-002, BATCH-001, BATCH-002, BATCH-004, UX-004 → dispositions with limits; BATCH-003 annotated);
      acceptance mapping; evidence in this doc + Engram; closeout commit; RDD assess on the closeout delta.

## Invariants for this ticket

- No real PHI: synthetic fixtures only (tokens, synthetic names).
- No new dependency, no network, no storage, no content logging; sensitive content memory-only (D-013).
- No sessionStorage/localStorage in V4 production code; no monkey patching; no Premium framing on V4 surfaces.
- Single-document and text flows byte-unchanged in behavior; T15 size authority and processing-outcome
  vocabulary reused, never re-implemented; T16 pseudonym semantics unchanged.
- Failed items remain visible; export/gate fail closed; every behavioral change pinned by an oracle that can
  disagree (including negative/adversarial cases); exceptional branches execute in deterministic tests.
- Legacy HTML/JS untouched (T25 retirement owns them).

## Evidence log

(filled per work unit below)

## WU-A evidence — 2026-09-28

- Commit: (pending)
- (pending)

## WU-B evidence — 2026-09-28

- Commit: (pending)
- (pending)

## WU-C evidence — 2026-09-28

- Commit: (pending)
- (pending)

## T17 ticket closeout — 2026-09-28

- (pending)
