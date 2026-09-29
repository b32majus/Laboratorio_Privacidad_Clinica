# T17 / #21 — Batch state, failure, storage and consistency refactor

Status: COMPLETE (T17 #21)
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

- [x] **T17.0** Open ticket: this doc + Engram mirror `odd/t17-batch-state-storage-consistency/tasks`; commit
      `docs(odd): open T17 #21 …` — commit `0a8e1c4`.
- [x] **T17.1 (WU-A)** Domain contract + oracles; verification (`test:v4`, `typecheck:v4`, `lint:v4`,
      `format:check:v4`); falsification probes; commit `feat(domain): … (T17 #21 WU-A)` — commits `979846d`,
      `afa3ec3`, `9224a9e`; RDD assess recorded (REVIEW_TRANSPORT_UNAVAILABLE disposition, see evidence).
- [x] **T17.2 (WU-B)** Review/bridge seam + oracles (review-state, consistency, isolation); verification;
      falsification probes; commits `c57d593` (B1), `c3ff656` (B2), flake defusal `a76fe7f`; RDD assess
      recorded (REVIEW_TRANSPORT_UNAVAILABLE disposition, see evidence).
- [x] **T17.3 (WU-C)** Gate + UI + storage guard + e2e oracle; verification; falsification probes; commits
      `ad506c0` (C1), `8f50c10` (C2), `8caef1d` (C3 correction); consent granted by the human; transport
      refusal recorded (see closeout).
- [x] **T17.4** Ticket closeout: full `npm test` chain + build PASS at `8caef1d`; debt reconciliation
      (FUNC-002, BATCH-001, BATCH-002, BATCH-004, UX-004 → DONE; BATCH-003 annotated OPEN); acceptance
      mapping complete; evidence in this doc + Engram; closeout commit.

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

- Commits: `979846d` (base `0a8e1c4`; authored size **3 files, +974/−53** — `job.ts` +439/−19,
  `job.test.ts` +528/−? with 33 new oracles, `review-domain.test.ts` 41 lines adapted) plus two micro
  corrections: `afa3ec3` (+3, missing wrong-state assertion) and `9224a9e` (+15, fail-closed pin).
- Delivered: `BatchItemStatus` six-state vocabulary (SD-1); two-phase batch `createJob` (metadata-only → all
  `queued`; extraction-carrying batch input → typed `invalid-batch-intake`; single-document all-or-nothing and
  oversize-at-creation PRESERVED; text job unchanged) (SD-2); item transitions `beginItemRead`/
  `recordItemRead` (size authority asked, message verbatim, oversize text never stored, empty →
  `empty-input`, adapter codes via `jobErrorCodeFor`)/`beginItemProcessing`/`recordItemProcessed`/
  `recordItemFailed`/`recordItemReviewCompletion` (only path to `completed`) with typed preconditions
  (SD-2/3/4); accessors `batchItemStatus`/`batchFailedItems`/`batchReviewComplete`/`batchHasErrorItems`
  (SD-6; error items excluded from review completeness per SD-6 — the safeOutputReady error conjunction is
  WU-B's derivation); `batch-item-failed` export guard AFTER `review-incomplete` priority in all three step
  transitions (SD-7); `setPolicy` batch reset incl. `policy-unsupported` item retry (SD-8).
- Deliberate test adaptation (reported by the writer, verified): 3 `review-domain.test.ts` batch fixtures
  built 2-file batches WITH extraction outcomes — invalid under the new two-phase intake — minimally adapted
  to metadata-only; the asserted semantics (`jobSupportsReview` false, `jobSourceText` null,
  `startReviewSession` throw) are unchanged. The obsolete `job.test.ts` "names every failing file" batch
  abort test (~:217) and the multi-file oversize batch test (~:609) were rewritten to pin the NEW contract
  (`invalid-batch-intake` naming the files, order preserved). No other existing test edited.
- Deterministic verification: writer first pass `npm run test:v4` 34 files / 646 tests (baseline 613 + 33);
  `typecheck:v4`, `lint:v4`, `format:check:v4` clean. Parent runs: one unidentified non-reproducible failure
  (suite output truncated by the parent's log tail before identity was captured) followed by **8 consecutive
  clean 646/646 runs** incl. a 6-run flake hunt with full logs; recorded as an OPEN WATCH ITEM — any
  recurrence with identity becomes a correction unit.
- Independent verification (fresh read-only context): **PASS 10/10** — scope, contract completeness,
  transition table, export guard, setPolicy reset, helper authority, immutability, oracle strength (fixtures
  strengthened, not weakened), single-doc/text regression safety (non-batch guards provably gated under
  `document-batch`), full suite 646/646 + typecheck/lint/format clean. Two non-blocking notes, both adopted:
  WU-B must derive `safeOutputReady = batchReviewComplete && !batchHasErrorItems` (SD-6); the
  `batchFailedItems` error-without-itemError branch was unpinned → pinned in `9224a9e`.
- Falsification probes (parent-side, each restored byte-exactly, verified clean afterwards):
  - **P1** completion allowed from `processing` → **ORACLE GAP FOUND**: all 81 domain tests passed (the suite
    pinned `processing/false` but not `processing/true`). Corrected by adding the missing wrong-state
    assertion (`afa3ec3`); re-planted probe → **1 failed | 80 passed**; restored → 81 passed.
  - **P2** `assertBatchExportable` neutralized (guard removed) → **1 failed | 80 passed** (export-guard
    oracle disagrees).
  - **P3** oversize read retains the refused text on the error item → **1 failed | 80 passed** (payload-never-
    stored oracle disagrees).
- Native review gate: committed-range ASSESS (`--base-ref a3c8067 --committed-only`) returned
  `review_due=true` (`high_risk`) with typed `unassessable` (active runtime not eligible for immutable
  receipt review). The due-path preflight STATUS (`--contract gentle-ai.review-integration/v2 --agent
  opencode --next-transition`) returned typed **`immutable_review_transport_unsupported`**
  (`next_action: stop`, `mutation_outcome: not_started`, `retry_safe: false`). Disposition
  **REVIEW_TRANSPORT_UNAVAILABLE**: no START synthesized, no consent manufactured, RDD NOT disabled
  (user-owned switch; the tool's `review mode disable` suggestion is refused), no blind retry. Compensation
  for the high tier: writer self-verification (above) + independent verifier (PASS 10/10) + parent
  falsification probes (P1–P3, one oracle gap found and closed). The WU-A commits remain **explicitly
  unreviewed by native review**; the reviewed boundary does NOT advance (stays `a3c8067`).

## WU-B evidence — 2026-09-28

- Delivered as two sequential writers (composition adapted for transport reliability after two consecutive
  empty sub-agent results on the combined brief — delivery shape only, not review size): **B1** `c57d593`
  (primitive; 2 files, +225/−15) and **B2** `c3ff656` (bridge; 2 files, +565/−7). Combined WU-B: 4 files,
  +790/−22.
- Delivered: `jobSupportsReview` batch; `startReviewSession` still refuses batch with an honest message;
  `processBatchItem(job, index, context, engine?)` — held-text-only (fail-closed `invalid-source`), engine
  called with the job's policy, T01 adapter mapping, classified failures returned never thrown, engine
  parameter is an oracle-only injection seam; bridge `SessionState.batch` (sessions record + activeIndex),
  batch `startReview` with the `current.batch` idempotence guard, ordered per-item loop
  (`beginItemProcessing` → `processBatchItem` → `recordItemProcessed`+session / `recordItemFailed`, loop
  CONTINUES past item failures), context threading first-item `fresh` → per-success shared promotion
  (idiom established by the B1 consistency oracle), `completeProcessing` + SD-6 derivation
  (`review.complete = batchReviewComplete`, `safeOutputReady = complete && !batchHasErrorItems`,
  `confidentialAuditReady: true`) in one atomic write; `selectDocument` navigation purity (FUNC-002);
  decide/addManual batch path with per-item completion recording; policy change drops sessions (SD-8);
  plus two hook intake methods `beginBatchItemRead`/`recordBatchItemRead` (SD-2 read seam; deliberate
  deviation, needed by the hook-level oracles and WU-C intake wiring).
- Oracles: B1 ×4 (mapping+context, invalid-source fail-closed, cross-document consistency
  Carmen→`Paciente 1` in both docs / Lucía→`Paciente 2` + contador 1→2, injected typed failure classified
  while a healthy item still exercises the real adapter); B2 ×7 (review-state/navigation purity FUNC-002,
  isolation with mid-batch failure, idempotence, policy reset, no-active-session no-ops, safeOutputReady
  error-conjunction, single-path free of batch state).
- Deterministic verification: B1 651/651 (baseline corrected: 647 at HEAD `cf0cffe`, not 646 — the
  `9224a9e` pin added one test); B2 658/658; typecheck/lint/format clean at both commits; parent full-suite
  run 658/658 (full log kept).
- Falsification probes (all restored byte-exact, suite green after restore):
  - B1 parent probes: **PB1** carried context ignored (always `fresh`) → 1 failed (consistency oracle);
    **PB2** classified failure rethrown → 2 failed (never-throws oracle); **PB3** missing extraction guessed
    as empty text → 1 failed (fail-closed oracle). First PB1 attempt planted nothing (string mismatch); the
    "20 passed" run before re-plant was the unmutated suite — recorded to keep probe attribution honest.
  - B2 writer probes: P1 promotion as `fresh` → isolation oracle fails; P2 `selectDocument` mutating the job
    → purity oracle fails; P3 `current.batch` guard removed → idempotence oracle fails; P4 error-conjunction
    dropped → conjunction oracle fails; P5 `break` on item failure → isolation oracle fails.
  - B2 parent probe: **PB6** decide never records item completion → 1 failed (review-state oracle);
    **PB7** control no-op mutation → 11 passed (probe harness sanity).
- Independent verification (fresh read-only context): **PASS 11/11** — scope, primitive contract, threading,
  guard (+ the App effect-loop defect it prevents), navigation purity, atomic SD-6 derivation, SD-8 wiring,
  single-path preservation, oracle strength, privacy/quality invariants, suite runs.
- **Flake identified and defused** (`a76fe7f`): the WU-A-era unidentified failure has an identity —
  `App.test.tsx > App document intake (T06) > surfaces the pdf-no-text-layer alert for a scan-like PDF and
  creates no job`, 1-in-3 under parallel vitest load, passes isolated; pre-existing (App.test.tsx is outside
  every T17 diff). Root cause: real pdf.js extraction latency can exceed the default 1s polling budget on a
  loaded machine. Fix is test-only: explicit 10s latency budget on the two real-pdf.js intake waits; the
  oracles still disagree on alert CONTENT. Post-fix: 8 consecutive clean full-suite runs (658/658).
- Declared limits (honest, for closeout): the bridge's shared promotion threads `pseudonymState` but not
  `options` — nothing in the app produces engine `options` today (dateShift has no app-level input; T19 owns
  the policy surface), so nothing observable is lost; when an accepted ticket wires app-level options, the
  batch promotion must carry them. `runBatchReview` is exported solely as the oracle seam (same pattern as
  the primitive's engine parameter).
- WU-C wiring requirements (from the independent verification): (1) SD-11 job-identity guard at the intake
  call site — snapshot `job.id` before each awaited read and discard outcomes for a superseded job; (2) all
  item reads must settle before review entry (the one-shot batch startReview skips still-`reading` items and
  they would later be unprocessable); (3) never surface never-read items as `invalid-source` errors (same
  coordination).
- Native review gate: same **REVIEW_TRANSPORT_UNAVAILABLE** disposition as WU-A (assess `review_due=true`
  /`high_risk` + typed runtime-ineligibility; STATUS preflight `immutable_review_transport_unsupported`, stop,
  not_started, retry_safe=false; no START synthesized, no consent manufactured, RDD not disabled);
  compensation = writer self-verification + writer probes + parent probes PB1–PB7 + independent verifier
  (PASS 11/11). WU-B commits remain **explicitly unreviewed by native review**; the reviewed boundary stays
  `a3c8067`.

## WU-C evidence — 2026-09-28

- Delivered as three sequential writers (C1/C2 split for transport reliability after the WU-B empty-result
  pattern; C3 is a deliberate micro-correction): **C1** `ad506c0` (gate/export/checker; 7 files, +794/−44),
  **C2** `8f50c10` (app wiring; 3 files, +582/−10 incl. new `BatchReviewView.tsx`), **C3** `8caef1d`
  (policy-remedy correction; 4 files, +117/−34).
- Delivered C1 (SD-9/SD-7/SD-10a): `PrivacyGateView` batch facts (per-item name/status/errorMessage from the
  JOB via the domain helpers; pending count across non-error items; blocked copy names failed files + remedy;
  no score/anonymity/certification claims — pinned against a FORBIDDEN_CLAIMS list; accessible text statuses,
  no color-only); `ExportStep` batch Safe Output always disabled with explicit reason priority
  (review-incomplete → failed-items → not-yet-defined batch Safe Output format); storage checker extended to
  refuse ANY sessionStorage/localStorage reference in `app-v4/src` production sources (tests excluded, legacy
  rules preserved) with a 9-case `--self-test` (known-good + planted violation + exclusions) and a
  `check:storage:selftest` script.
- Delivered C2 (SD-2/SD-3/SD-5/SD-11): two-phase batch intake in `App.tsx` (metadata-only `createJob` →
  per-file `beginBatchItemRead`/`await extractFile`/`recordBatchItemRead` with the job-identity guard —
  snapshot before await, stale outcomes discarded; failed reads surfaced immediately with name+message;
  single-doc/text/structured flows unchanged); `BatchReviewView` (keyboard-operable document selector with
  `aria-current` and visible status text, error/queued items listed but not selectable, active item's existing
  `ReviewWorkspace` reused; `selectDocument` on selection only); reads-settle gating (no processing start
  while any item is `reading`); the hook's read transitions are sequenced with scoped `flushSync` in the
  intake loop (committed-state ref timing; zero act warnings — verifier-checked).
- Delivered C3 (SD-8 CORRECTED): the original SD-8 spec was wrong — source text is policy-INDEPENDENT, so
  dropping held extraction on a policy change created a remedy dead-end (items queued without text fail
  `invalid-source` with no re-read path). Corrected semantics: a REAL policy change resets non-error items to
  `queued` KEEPING their held text (read artifacts survive; processing artifacts do not), `policy-unsupported`
  items become retryable WITH text, read-error items stay error; `recordItemFailed` likewise keeps the held
  text (the read succeeded; the PROCESS failed). The read-XOR invariant now applies to read failures only
  (process failures carry text + `itemError`). One bridge assertion (same extraction-dropped class) flipped as
  the minimal necessary edit. New App-level remedy-loop oracle: external-ai → per-item `policy-unsupported`
  fail-closed → standard → recovery to `review-required` (D-009 fail → remedy → recovery closed).
- Oracles: C1 gate ×5 + export ×3 + checker self-test ×9; C2 App ×6 (REQUIRED forced read-error batch;
  REQUIRED navigation-never-marks-reviewed; premium-free pin; reads-settle gating; SD-11 clear-mid-read
  discard; C3 remedy loop); writer probes (failedCount neutralization → 3 gate/export oracles fail; planted
  real-tree storage violation → checker exit 1). Honest coverage boundaries: process-error e2e is covered at
  bridge level (injected-stub isolation oracle) because the App-level path needs the C3-fixed semantics;
  consistency is pinned at bridge level (not duplicated in App e2e); the export failed-items copy is
  defense-in-depth (the App gate is the reachable blocker surface).
- Deterministic verification: C1 666/666, C2 671/671, C3 672/672; typecheck/lint/format/check:storage clean at
  each commit; parent full-suite runs 658/658, 666/666, 672/672 with full logs; checker exclusion probe (test
  file passes) + production-file violation probe (exit 1) both verified.
- Independent verification (fresh read-only context): **WU-C PASS 10/10** — scope (13 files exactly; legacy
  untouched), gate facts from the job, export reason priority, checker/self-test, intake identity guard,
  review surface accessibility, C3 corrected semantics, e2e oracle presence at stated levels, privacy
  invariants (no storage/network/logging; no `any`; frozen state), suite + checker runs. Zero closeout
  blockers.

## T17 ticket closeout — 2026-09-28

- Work-unit chain terminal: open `0a8e1c4`; WU-A `979846d` + `afa3ec3` + `9224a9e`; WU-B `c57d593` +
  `c3ff656`; flake defusal `a76fe7f`; WU-C `ad506c0` + `8f50c10` + `8caef1d`; evidence `cf0cffe`, `dda72ef`,
  this closeout commit. Ticket range `0a8e1c4..HEAD`: 12 commits, 17 files, +3,366/−142 (approx.; docs
  included).
- Closeout chain at final HEAD `8caef1d`: `npm test` full chain **PASS** (exit 0 — links, storage,
  external, vendor, pdfjs, smoke, positioning, domain suite, privacy-eval units + gate, vitest **34 files /
  672 tests**); `build` **PASS**; `format:check:v4`, `typecheck:v4`, `lint:v4` **PASS**; tracked tree clean.
- **Acceptance mapping (#21):**
  - *Failed documents remain visible and block/affect Privacy Gate appropriately* → per-item `error` state
    with retained typed failures (WU-A), immediate input surfacing + gate item facts + blocked copy naming
    files/remedy (WU-C1/C2), export `batch-item-failed` domain guard (WU-A/C1); oracles: job.test retention,
    App forced-read-error e2e, PrivacyGate/ExportStep batch suites.
  - *Navigating a document does not mark it reviewed* → completion derives ONLY from `canFinalize` of the
    item's own session; `selectDocument` writes the index only; step navigation via `goToStep` only; oracles:
    bridge review-state/navigation-purity + App UI-level pin (WU-B/C2).
  - *No large batch payload shuttle through sessionStorage* → memory-only Job state (D-013), zero V4 storage
    use, structural guard `check-storage-policy.mjs` + self-test (WU-C1); network-invariant test still green.
  - *No global monkey patch* → shared ProcessingContext + engine per-call reset; no import chain to
    `js/batch-module.js`; isolation oracle proves no mutated global behavior after a mid-batch failure (WU-B).
  - *Shared context produces intended cross-document consistency* → bridge threads first-`fresh` →
    per-success-`shared` pseudonymState; consistency oracle (same identity → same `Paciente N` across docs)
    + isolation oracle at bridge level; declared limit: `options` (dateShift) not threaded until an accepted
    ticket wires app-level options (T19 #23 owns the policy surface) — BATCH-003 stays OPEN with the advance
    recorded.
  - *Batch is not presented as a separate Premium app* → batch is a natural Job capability in the one shell;
    premium-free UI pin (WU-C2); legacy framing untouched until T25 #29.
  - Required deterministic verification: multi-file synthetic batch with one forced read error (App e2e;
    process-error at bridge level with injected stub), review-state test (bridge + UI), consistency test
    (bridge) — all present and falsifiable (probes listed per unit).
- **Native review ledger (complete):** WU-A: ASSESS `review_due=true`/`high_risk` + typed runtime
  ineligibility; preflight STATUS refused (`immutable_review_transport_unsupported`, stop) → compensated.
  WU-B: same disposition. WU-C: ASSESS returned a full plan (medium, `slice_budget_reached`, 13 paths/1,581
  lines) → preflight STATUS offered a fresh start → **the human GRANTED consent** for the candidate (typed
  `gentle-ai.review-integration.consent/v3`, relayed losslessly, `granted` selected) → the consented START
  refused at the transport layer (typed `immutable_review_transport_unsupported`, `not_started`, `stop`,
  `retry_safe: false`) → exact-lineage STATUS re-queried: no lineage exists. Disposition: consent honored and
  recorded; no START synthesized beyond the provider's own offer, no retry, RDD NOT disabled (the off-path
  suggestion was refused); the WU-C commits remain **explicitly unreviewed by native review**, with
  compensation = writer self-verification + writer/parent falsification probes + independent verifiers
  (WU-A 10/10, WU-B 11/11, WU-C 10/10). The reviewed boundary does NOT advance (stays `a3c8067`).
- Debt reconciliation (`docs/DEBT_REGISTER.md`, this commit): **FUNC-002, BATCH-001, BATCH-002, BATCH-004,
  UX-004 → DONE** with V4 evidence and declared legacy limits (legacy surfaces remain compatibility evidence
  until T25 #29); **BATCH-003 → stays OPEN** with the T17 advance (app-level shared context) and the options
  threading limit recorded. No other row touched.
- Flaky-oracle disposition: the pre-existing pdf-intake flake was identified (identity captured), defused
  test-only (`a76fe7f`), and post-fix stability recorded (8 consecutive clean full-suite runs at the time of
  the fix; the closeout chain runs green end-to-end).
- No T18 work started. Publication boundary respected: no push, no PR, no issue mutation, no merge, no
  release, no deploy. Next step for the human: review/publish under ordinary repository policy.
