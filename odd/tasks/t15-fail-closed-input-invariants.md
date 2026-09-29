# T15 / #19 — Fail-closed input and processing invariants

Status: COMPLETE (T15 #19)
Final commits: WU-A `bd5ac80`, WU-B `19eb8bd`, WU-C `bb5ac46`, plus the ticket-open, per-unit evidence and this closeout docs commits. Ticket integration: `npm test` full chain PASS at the closeout HEAD (vitest 32 files / 597 tests, Node domain suite 55/55, privacy-eval 24/24 + gate PASS, CI checks PASS); `format:check:v4` / `typecheck:v4` / `lint:v4` / `build` PASS. Native review ledger: all three per-unit committed-range ASSESS calls returned the known typed Gentle AI #4791 `unassessable`/`schema-incompatible` plan, so the Case C fail-closed path applied three times with writer self-verification plus an independent verifier per unit; no `review_due` was ever offered, no START was synthesized, no consent manufactured and zero lineages opened. Debt: FUNC-004 reconciled to DONE with its legacy-core limit declared; QA-004 registered as the bounded residual. No T16 work started.
Work Order: GitHub #19 (`EXECUTION_READY=YES`; `Blocked by: #9` CLOSED; no comments; DEBT_IDS=FUNC-004)
Branch: `work/native/v4-travel-t12-t16-20260925`
START_HEAD: `7e35c5191607afafebb1f0ce90e0196fa89da189`

## Authority read for this ticket

- `AGENTS.md` (scope discipline, privacy invariants, testing/oracle rules), `CONTEXT.md`.
- GitHub #19 body: acceptance bullets and the three required deterministic tests (oversize, boundary-size, failure contract). Out of scope: unrelated cleanup/refactors, product/privacy decisions not stated in the cited spec, real PHI in tests.
- `docs/specs/SPEC_V4_PRIVACY_ENGINE.md` §11: "input over supported size: explicit blocking/segmentation path, never silent truncation"; §14 (engine callable from a worker; deterministic regression preserved).
- `docs/specs/SPEC_V4_QUALITY_SECURITY_DEPLOY.md` §8: the benchmark bands top out at "1 MB or supported maximum".
- `docs/shaping/CURRENT_DECISIONS.md` D-009 ("Unknown/ambiguous privacy classifications, oversized inputs, extraction failures, and incomplete mandatory review fail explicitly"), D-003 (mirror legacy), D-004 (ReviewSession is the review authority), D-013 (sensitive content is memory-only).
- `docs/execution/QUALITY_EXECUTION_PROTOCOL_V1.md` §6 (closeout chain), `docs/execution/TRAIN_V4.md` (T15 result line: "no silent truncation; explicit supported-size/error contracts").
- Debt: `docs/DEBT_REGISTER.md` FUNC-004 (P0, Core): "Sustituir truncado silencioso >1 MB por bloqueo explícito".
- Live code: `js/core/processor.js:89-92` (legacy truncates at 1,000,000 with a `console.warn`), `app-v4/src/engine/legacy-engine.ts`,
  `legacy-recognizers.ts`, `age-recognizer.ts` (each already fails closed with its own private `MAX_TEXT_LENGTH = 1_000_000`
  literal), `app-v4/src/input/{extract,extracted-source}.ts` (T06 adapters, no size gate), `app-v4/src/domain/job.ts`,
  `app-v4/src/useJobSession.ts`, `app-v4/src/App.tsx` (the live path).

## What already holds (do not re-implement)

- The V4 engine adapter and both V4 recognizer paths already REFUSE text over 1,000,000 characters with the typed code
  `input-too-large` instead of truncating (T05/T11/T12); `legacy-engine.test.ts` and `registry-engine.test.ts` each pin it.
- The T06 input adapters already return typed non-success results and never truncate; extraction failures already prevent job
  creation (`assertExtractionsUsable`).
- Product source contains no `console.*` logging at all, so no payload is logged today.

## Gaps this ticket must close (honest reading of the acceptance bullets)

1. The supported size is four independent literals (three V4 guards plus the truncating legacy core); no exported authority, so the
   input layer cannot pre-check and any future edit can drift. No exact-boundary (accepted) oracle exists — only a rejection oracle.
2. The oversize failure arrives LATE and at the wrong layer: a 5 MB TXT or a 5 MB paste becomes a job successfully and only explodes
   when the Review step runs the engine. The engine message is developer-facing ("use an explicit segmentation path") with no
   measured size, no supported size and no user action — so acceptance bullet 2 is not satisfied.
3. The live path records NOTHING about a processing attempt: `job.processing` stays `"idle"`, so a failed attempt is not
   distinguishable in domain state from "never processed", there is no typed failure record, and no `unknown` outcome exists.
4. No oracle asserts that failure diagnostics never carry source payload (true today only by construction).

## Semantic decisions (resolved before writing)

- **SD-1 — One size authority.** `MAX_SUPPORTED_TEXT_LENGTH` moves to a single exported engine-boundary module consumed by all V4
  guards and (WU-B) by the input layer. The legacy core is deliberately NOT edited: its truncation is legacy-retirement debt (T25)
  and V4 preserves legacy mirror semantics (D-003) precisely by refusing what legacy would truncate.
- **SD-2 — Unit of the limit is UTF-16 code units** (`String.length`), preserving exact engine/legacy parity. The name and the copy
  must not claim bytes or "1 MB".
- **SD-3 — The oversize contract is typed and payload-free.** It exposes measured length, supported length, excess, the shared
  machine code and a fixed actionable message built only from those numbers. It never echoes input content.
- **SD-4 — Oversize is refused at intake**, not only at the engine (D-009 + bullet 2). An oversize input never becomes a job, exactly
  like the existing failed-extraction rule (D-011 keeps failed items visible; a refusal is not a silent drop).
- **SD-5 — The domain is the authority, the adapter is a convenience.** `createJob`/`inferJobKind` refuse oversize pasted text even if
  a caller bypasses the adapter.
- **SD-6 — Processing outcome is explicit job-domain state.** `succeeded` is never inferred: it is reachable only from `running`
  through an explicit success transition. `unknown` is a distinct honest state for "attempted, outcome could not be established"
  (an unrecognized error), distinguishable from `failed` (a recognized typed failure carrying a code) and from `succeeded`.
- **SD-7 — Diagnostics are payload-free by construction.** A failure record carries a typed code plus the message authored by the
  failing typed error — never source text. A file/job NAME is metadata already displayed in the shell and is not payload; this
  boundary is explicit and asserted by oracle.
- **SD-8 — Retry is the existing flow, and no silent segmentation is ever introduced.** The user fixes or splits the input and
  retries; a retry returns the record to `running`. Automatic splitting is a privacy/product decision nobody authorized.
- **SD-9 — Export stays review-derived (D-004).** T15 records and surfaces the processing outcome; it does not add a second export
  gate. Boundary decision recorded explicitly so a reviewer reads it as a decision, not an omission.
- **SD-10 — Out of scope.** Legacy core truncation (T25); the Web Worker boundary and async processing observability (T22); batch and
  structured processing paths (T17/T18 — T15 covers the live text/single-document path); display truncation in the review detection
  list (a UI affordance whose inspector shows the full value).

## Composition (Atenea WORK_UNIT_COMPOSITION_POLICY_V1 §4)

One unit would be an oversize forecast (≈1000+ authored lines) and is rejected before implementation. Three coherent units, each
keeping behavior with its own oracle and independently verifiable:

- **WU-A — Supported-size authority and the explicit oversize contract (pure).** `engine/input-limits.ts` + oracles; the three V4
  guards consume the authority and the shared actionable message. Forecast ≈250 authored lines.
- **WU-B — Intake refuses oversize with an actionable split/retry path.** Input adapters + `extracted-source` vocabulary + job-domain
  refusal and error mapping. Forecast ≈300 authored lines.
- **WU-C — Processing outcome distinguishable from success on the live path.** Job-domain outcome contract and classification +
  `useJobSession`/`App` wiring + failure-visibility and payload-safety oracles. Forecast ≈450–550 authored lines: soft overage
  (policy band 401–600) accepted because the contract and the live-path wiring are one story — the contract alone would be consumed
  by nobody and the wiring alone would have no vocabulary.

## Evidence

### WU-A evidence — 2026-09-26

- Commit: `bd5ac80` feat(engine); base (ticket open): `96611f2`. Authored size: **8 files, +212/−27** (`input-limits.ts` 73 new, `input-limits.test.ts` 83 new, plus six small edits).
- Delivered: one exported size authority (`MAX_SUPPORTED_TEXT_LENGTH`, UTF-16 code units, exact parity with the legacy `1000000` comparison) and the typed, payload-free oversize contract (`OVERSIZE_INPUT_CODE`, measured/supported/excess facts, fixed deterministic actionable message built only from the two numbers). The V4 engine adapter and both recognizer guards consume it instead of three private `1_000_000` literals; thrown codes stay `"input-too-large"` and the type/empty-text branches are byte-identical to the pre-change code.
- Deterministic verification (full chain, run at the uncommitted and committed state): `npm test` PASS — vitest **30 files / 561 tests**, Node domain suite **55/55**, privacy-eval 24/24 + gate PASS (precision 100 %, recall 100 %, FNR 0.00 %), all CI checks PASS; `format:check:v4`, `typecheck:v4`, `lint:v4`, `build` PASS. `git status --porcelain` byte-identical before/after the chain.
- Independent verification (`gentle-ai-verify`, read-only, 10 items): **PASS 10/10, zero blockers**. It re-derived the contract claims from the real code (boundary is exactly `<= MAX`, no locale API, no input text in the returned object, no private literal left anywhere in `app-v4/src`, nothing under `js/**` or `docs/**` changed), confirmed the V4 engine's single entry into `Processor.process` is gated by `assertValidText` so the legacy truncation branch is unreachable from the V4 boundary, and independently reproduced the exact-boundary falsification with sha256-before/after evidence (`14bf9f02…` identical after restore).
- Parent falsification probes (rollback-safe; each file restored and sha256-verified identical):
  - **P1** message extended with `text.slice(0, 20)` → **`1 failed | 5 passed`**, failing exactly the payload-safety oracle;
  - **P2** boundary comparison changed to `measuredLength < MAX` → **`1 failed | 5 passed`**, failing exactly the exact-boundary oracle;
  - **P3** `legacy-engine.ts` guard reverted to its own private message → **`1 failed | 27 passed`** in `legacy-engine.test.ts`, failing exactly the guard shared-message oracle.
- **Operational correction worth keeping**: the first probe attempt was invalid. `vite.config.ts` sets `root: "app-v4"`, so vitest must be invoked from the REPOSITORY ROOT (`npx vitest run src/engine/<file>.test.ts`); running it from inside `app-v4/` nests the root to `app-v4/app-v4`, finds no test files and exits 1 with "No test files found". That exit 1 is NOT a test failure and would have produced three false "the oracle caught the mutation" conclusions. The probes were re-run with the correct invocation, and the trap is recorded here so later units and verifiers do not repeat it.
- WU-A native review gate: exact committed-range ASSESS (`{"baseRef":"96611f24…","committedOnly":true}`) returned the known typed Gentle AI **#4791** envelope — `risk=unassessable`, `reasons=[schema-incompatible]`, `changedPaths=0`, `changedLines=0`, `candidate=null`, `nativeReviewOutcome=unknown`, `outcome_source=unknown`, `writerProfile=small`, plan `{writerSelfVerification: true, structuralReadbackOnly: false, independentVerifier: true}`. `writerModelId`/`writerEffort` were deliberately omitted so the assessment fails closed to the small-writer profile (Pi tiers are requested metadata only for a provider-managed model). Disposition: **Case C** — both gates satisfied (writer self-verification + independent verifier), `ASSESS_SEAM_4791` recorded, **native START synthesized=no**, zero lineages, zero consents, no valid `review_due` ever offered. No retry of #4791, no `inspect` used as ASSESS, and the authority-prohibited whole-workspace candidate was not started.
- Boundary decisions recorded for review: the legacy core truncation is deliberately untouched (D-003 mirror semantics; legacy retirement is T25) and V4 refuses what legacy would truncate; the limit unit is UTF-16 code units, never bytes; `MAX_SUPPORTED_TEXT_LENGTH` remains the authority's exported value and `isTextWithinSupportedSize` is the predicate the intake guard consumes. The verifier initially flagged the two as a forward contract with no production consumer; WU-B resolved it by applying the rule everywhere through the authority (see below) rather than by re-implementing a comparison, and both remain pinned by the deterministic oracles.

### WU-B evidence — 2026-09-26

- Commit: `19eb8bd` feat(input); base (previous unit's last commit): `0a55d86`. Authored size: **5 files, +366/−20**.
- Delivered: `ExtractionErrorCode` gains the shared `"input-too-large"` member derived from the authority's code constant; `extract.ts` gains one shared `oversizeFailureFor` guard called by all four adapters (after each adapter's own empty check, before success) returning the typed failure with the shared message verbatim; the job domain refuses oversize pasted text and any extracted-but-oversize file before any job object exists, naming every failing file in input order. An oversize paste or file therefore never becomes a job and never reaches the engine.
- Boundary decisions recorded: no byte pre-check on `File.size` (the authority is UTF-16 code units; a byte comparison would mix units and could falsely refuse valid multilingual input); for an oversize input that is also whitespace-only, `empty-input` wins because the existing empty check stays first; the boundary rule is asked of the authority and never re-implemented (the parent integrator corrected the first draft, which re-applied `text.length > MAX_SUPPORTED_TEXT_LENGTH` in the domain — confirmed removed by the verifier).
- Deterministic verification: `npm test` PASS — vitest **30 files / 574 tests**, domain suite 37 tests in `job.test.ts`, privacy-eval 24/24 + gate PASS (precision 100 %, recall 100 %, FNR 0.00 %), all CI checks PASS; `format:check:v4`, `typecheck:v4`, `lint:v4`, `build` PASS; tree byte-identical before/after.
- Independent verification (`gentle-ai-verify`): **10/10 items PASS, zero blockers**, plus a final read-only chain confirmation after the parent's last two corrections (all gates exit 0, change set unchanged). The verifier independently reproduced the P7 falsification below.
- Parent falsification probes (rollback-safe, each sha256-verified restored):
  - **P7 — planted SILENT TRUNCATION** in the TXT adapter (`if (!isTextWithinSupportedSize(text)) text = text.slice(0, 1000000);`) → **`3 failed | 59 passed`**, failing the TXT refusal, the dispatcher refusal and the composed intake path. This is the representative planted violation for FUNC-004: the oracles reject a silently truncating intake;
  - **P4** TXT adapter guard removed entirely → same 3 failures (the adapter oracles have teeth independently of the domain guard);
  - **P5** domain authority removed (`inferJobKind` refusal deleted and the `assertExtractionsUsable` oversize branch short-circuited) → **`4 failed | 58 passed`**, failing exactly the four domain oracles (defense in depth is independently pinned);
  - **P8** PDF adapter call site removed → **`1 failed | 25 passed`**, failing exactly the new PDF adapter oracle.
- Two process incidents, recorded because they matter for later units:
  1. The WU-B writer session was interrupted mid-task by an RDD review reminder and returned `interaction_required` with `files_changed: none` while its edits were already present in the tree. The parent did not accept the report: it inspected the real diff, verified and integrated the work, and applied the two corrections above. Lesson: a worker's own final report can be wrong about whether it wrote; the parent must always read the real diff.
  2. During its optional falsification probe the independent verifier restored the file with `git checkout -- app-v4/src/input/extract.ts`, which reverted an UNCOMMITTED work unit and destroyed that file's WU-B state. It recovered from the parent's `/tmp` backup and reported the incident; the parent then independently confirmed sha256 identity (`b7af932d…`) for both touched files, the unchanged `git diff --stat` (5 files, 366/20) and a green focused suite. Lesson: never restore an uncommitted work unit with `git checkout --`; always keep a hash-annotated backup.
- Non-blocking residual recorded (not new debt): the DOCX adapter's call site has no oracle that traverses the adapter itself, because a >1M-character committed DOCX fixture is impractical; the shared guard is pinned directly for `docx` and the PDF adapter case now closes the wiring gap through a real adapter for the format most likely to reach the limit. The verifier independently judged this non-blocking.
- WU-B native review gate: exact committed-range ASSESS (`{"baseRef":"0a55d863…","committedOnly":true}`) again returned the typed Gentle AI **#4791** envelope (`risk=unassessable`, `reasons=[schema-incompatible]`, `changedPaths=0`, `changedLines=0`, `candidate=null`, `nativeReviewOutcome=unknown`, `writerProfile=small`, plan `{writerSelfVerification, independentVerifier}`). Disposition: **Case C** — both gates satisfied, `ASSESS_SEAM_4791` recorded, **native START synthesized=no**, zero lineages, zero consents, no valid `review_due` offered, no #4791 retry, no `inspect`-as-ASSESS, and the authority-prohibited whole-workspace candidate never started.

### WU-C evidence — 2026-09-26

- Commit: `bb5ac46` feat(review); base (previous unit's last commit): `2768c8d`. Authored size: **8 files** — 5 modified (+319/−13) plus 3 new files (61 + 104 + 133 = 298 lines) ≈ **+617/−13**.
- Delivered: `ProcessingState` gains `"unknown"` and `JobModelErrorCode` gains `"invalid-processing-transition"`; new `ProcessingFailureCode`/`ProcessingFailure` vocabulary; frozen `beginProcessing`/`completeProcessing`/`failProcessing` transitions where `succeeded` is reachable ONLY from `running`, a failure is only recorded for a started attempt and is APPENDED to `errors`, and a failure never overwrites a success; `setPolicy` also resets `processing` on a real change. New `processing-outcome.ts` classifies typed failures (keeping contract-authored messages verbatim, including the shared actionable oversize message) and collapses an unrecognized throw to a fixed value-free message. `beginReview` was REMOVED and replaced by `startReview()`, the single bridge entry that runs and records exactly one attempt (begin, engine outside any state updater, complete or fail) and returns the typed failure instead of throwing; `App.tsx` enters Review through it and stays on the current step when it fails. No new UI chrome was added.
- Deterministic verification: `npm test` PASS — vitest **32 files / 597 tests**, domain suite 55/55, privacy-eval 24/24 + gate PASS (precision 100 %, recall 100 %, FNR 0.00 %), all CI checks PASS; `format:check:v4`, `typecheck:v4`, `lint:v4`, `build` PASS; tree byte-identical before/after.
- Independent verification (`gentle-ai-verify`): **12/12 items PASS, zero blockers**, including a reachability audit proving that the literal `"succeeded"` is produced only inside `completeProcessing` and that no other module reads or writes `processing`; it independently reproduced the payload-safety falsification with sha256 evidence and confirmed the compile-level wiring guarantee (reverting `App.tsx` to `beginReview` no longer type-checks).
- Parent falsification probes (rollback-safe, sha256-verified restored):
  - **P9** `completeProcessing` running-guard removed (success inferred from any state) → **`1 failed | 47 passed`** in `job.test.ts`, failing exactly "completeProcessing never infers success from idle, failed or unknown";
  - **P10** unrecognized branch forwards the raw error text → **`1 failed | 6 passed`** in `processing-outcome.test.ts`, failing exactly the planted-token payload-safety oracle;
  - **P11** `setPolicy`'s processing reset removed → **`3 failed | 79 passed`** across `job.test.ts` + `App.test.tsx`, including the pre-existing end-to-end App test "a completed review cannot be relabelled", which proves the reset is load-bearing for behavior that predates this ticket.
- Boundary decisions recorded for review: nothing in the UI renders `job.processing`, so bullet 3 is satisfied by the explicit domain state plus the durable typed `errors` record plus the user-visible `role="alert"` on the live path (the two outcomes are visibly distinct: failure keeps the user on the step with the message, success navigates to the review workspace); no new UI doctrine was invented, and the state is the contract later worker/batch tickets will consume. `"unknown"` is reachable only from an unrecognized throw and is proven at both ends (classification oracle + domain transition oracle) rather than by mocking the engine. The raw unrecognized error message is deliberately dropped instead of forwarded (an unvetted runtime message could carry source content); the typed `code` is preserved.
- WU-C native review gate: exact committed-range ASSESS (`{"baseRef":"2768c8d0…","committedOnly":true}`) returned the same typed **#4791** envelope → **Case C**, both gates satisfied, `ASSESS_SEAM_4791`, **native START synthesized=no**, zero lineages, zero consents, no valid `review_due`, no #4791 retry.

## T15 ticket closeout — 2026-09-26

- Work-unit chain terminal: WU-A `bd5ac80`, WU-B `19eb8bd`, WU-C `bb5ac46`, then the ticket-open commit `96611f2`, the per-unit evidence commits `0a55d86` and `2768c8d`, and this closeout commit.
- Ticket-level deterministic checks: `npm test` full chain (links, storage, external, vendor, pdfjs, smoke, positioning, Node domain suite, privacy-eval units + gate, vitest), plus `format:check:v4`, `typecheck:v4`, `lint:v4` and `build`; the final closeout run at the closeout HEAD is recorded in the boundary record.
- Every review decision resolved: three valid committed-range ASSESS calls (one per work unit), all three returning the known typed #4791 plan → Case C; zero valid `review_due`; zero native lineages; zero consents; the whole-workspace inspect candidate was never started, and `inspect` was never used as a substitute for ASSESS.
- Every #4791 case independently verified: WU-A (10 audited items + three parent probes), WU-B (10 audited items + a final chain confirmation + four parent probes), WU-C (12 audited items + three parent probes).
- Debt reconciliation limited to this ticket's rows plus the residual this ticket created: **FUNC-004 → DONE** with its declared limit (the legacy core's own truncation is untouched and unreachable from V4; its retirement belongs to T25 #29), and **QA-004** registered OPEN as the bounded residual (the DOCX guard call site has no through-adapter oracle). No other row was touched.
- No active worker, verifier, reviewer, refuter, validator or correction lineage at closeout; tracked tree clean; no T16 work started.
- Evidence preserved: start/end SHA, ticket timestamps, parent model, effective worker model, first-pass verification per unit, independent verifier reports (four runs), the three ASSESS outcomes, #4791 occurrences (3 in T15; 7 across this session), valid `review_due` count (0), review findings (none from a native review — no lineage was opened; the defects found were verifier findings and parent corrections, all fixed and recorded), the two process incidents recorded under WU-B, and the exact session JSONL.
