# T15 / #19 — Fail-closed input and processing invariants

Status: IN PROGRESS
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

(to be appended per work unit)
