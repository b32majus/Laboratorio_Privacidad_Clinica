# T20 / #24 — Structured privacy-classification workspace

Status: COMPLETE (T20 #24)
Work Order: GitHub #24 (`EXECUTION_READY=YES`; `Blocked by: #11, #22` — both CLOSED; no comments;
`DEBT_IDS=UX-015, PRODUCT-006`; `SPEC_AUTHORITY=docs/specs/SPEC_V4_BATCH_AND_STRUCTURED.md`)
Branch: `work/opencode/v4-overnight-t17-t18-20260928`
START_HEAD: `2de7c7ef45007082014b668a0f7340850691db99`
Publication boundary: **LOCAL_ONLY** (no push, PR, issue mutation, merge, release, deploy).

## Authority read for this ticket (pre-writer)

- `AGENTS.md` (Work Order discipline, composition gate, privacy invariants, testing/oracle rules,
  Atenea boundary), `CONTEXT.md`.
- GitHub #24 body/acceptance/out-of-scope. Acceptance: (1) columns visibly classified as
  Identifier/Quasi-Identifier/Sensitive/Insensitive/Unknown; (2) Unknown requires review; (3) patient-ID
  authority shown once; (4) confidence/evidence and user override inspectable; (5) common V4 design
  system/responsive shell. Deterministic verification: component tests for classification/override and an
  unknown-column export gate test.
- `docs/specs/SPEC_V4_BATCH_AND_STRUCTURED.md` §5 (five classes; UNKNOWN is not KEEP; UI may propose a
  class/action with confidence but the human can review/change it), §6 (exactly one selected patient-ID
  column authority), §7 (distributed sampling; expose inferred type/class + confidence/evidence).
  §12/§13 (ARX-lite risk and structured export) are LATER scope and deliberately NOT implemented here.
- `docs/shaping/CURRENT_DECISIONS.md` D-004 (domain review authority, not DOM), D-009 (fail closed; unknown
  does not default to KEEP), D-012 (five structured classes), D-013 (sensitive data memory-only).
- `docs/execution/QUALITY_EXECUTION_PROTOCOL_V1.md` §2/§3.5/§3.6/§4 (falsifiable oracle, composed work
  units), §10 (compose before writing).
- `docs/DEBT_REGISTER.md` UX-015 (redesign column configuration as a classification workspace),
  PRODUCT-006 (Identifier/Quasi/Sensitive/Insensitive classification). STRUCT-001/002/004/005/006 are
  already DONE under T18/T19; T20 consumes their facts and does not reopen them.
- Existing code: `app-v4/src/structured/{classification,column-profile,patient-id,grid,csv,excel}.ts`,
  `app-v4/src/domain/job.ts`, `app-v4/src/useJobSession.ts`, `app-v4/src/App.tsx`,
  `app-v4/src/review/ReviewWorkspace.tsx` (design-system reference).

## Pre-writer composition forecast (QUALITY_EXECUTION_PROTOCOL §4.1)

The Work Order stays capability-sized in GitHub. Its real surfaces are: a domain configuration authority
(classes/actions/patient-ID/overrides/export gate), structured intake (CSV/XLSX → grid), a React Configure
workspace, app-shell/bridge wiring, and their deterministic tests. Forecast: an honest single unit would
mix pure domain contracts with a React surface and app wiring, so the implementation is composed into two
semantic work units, each carrying the oracle that proves it:

- **WU-A — Structured configuration authority + intake.** Pure: `proposedActionForClass` (classification),
  `configuration.ts` (five-class resolution, explicit override transitions, single patient-ID authority
  wiring, fail-closed unknown review, export gate), `intake.ts` (CSV/XLSX read into a normalized grid with
  explicit sheet handling). Oracles: `configuration.test.ts`, `intake.test.ts`.
- **WU-B — Configure workspace UI + app-shell wiring.** `StructuredConfigureWorkspace.tsx` (responsive,
  keyboard-operable, text-not-color status, evidence/confidence, override controls, patient-ID authority
  shown once), `useJobSession.ts` structured state transitions, `App.tsx` Configure rendering + structured
  intake. Oracles: `StructuredConfigureWorkspace.test.tsx`, App integration cases.

WU-B consumes WU-A's frozen configuration; WU-A is independently verifiable without React.

## Semantic decisions (traced to existing authority)

- **SD-1 — The configuration is DOMAIN state.** The canonical structured configuration is a frozen pure
  object (`configuration.ts`) held by the `useJobSession` bridge, never React-local UI state. Only
  selection/focus/transient view state lives in the component.
- **SD-2 — No second classification authority.** Classes come from the T18 `classifyGridColumns`; the
  patient-ID authority comes from the T18 `resolvePatientIdColumn`; the UI never re-derives either.
- **SD-3 — Override changes the canonical object.** An explicit override rebuilds the frozen configuration
  and its export gate; it is not a label-only change. The override vocabulary is exactly the five accepted
  classes; an invalid class/column fails typed.
- **SD-4 — Unknown never silently becomes KEEP.** An unresolved `unknown` column has
  `proposedAction: "review-required"`, `requiresReview: true`, and keeps the structured export gate
  `exportReady === false` until a human explicitly overrides the class.

## Evidence ledger

- **WU-A** (commit `bd8c5b6`): `configuration.ts` + `intake.ts` + `configuration.test.ts` (13 tests)
  + `intake.test.ts` (7 tests). Proves the five accepted classes, `unknown` never KEEP/exportable,
  override changing the canonical object, cross-column isolation, single patient-ID authority, frozen
  configuration, CSV/XLSX parsing through the T18 authorities and explicit multi-sheet selection.
- **WU-B** (this commit): `StructuredConfigureWorkspace.tsx` + `useJobSession.ts` structured domain state
  + `App.tsx` Configure wiring; `StructuredConfigureWorkspace.test.tsx` (13 tests) and four new App
  integration cases. Proves visible five-class display, confidence/evidence matching domain facts,
  unknown review + export gate, explicit override changing canonical authority, cross-column isolation,
  single patient-ID authority region, keyboard/responsive/no-color-only, and state persistence across
  navigation.
- Full quality gates at final HEAD: `npm test` (full chain PASS; vitest 46 files / 832 tests, Node domain
  suite, privacy-eval and CI checkers PASS), `npm run test:v4`, `typecheck:v4`, `lint:v4`,
  `format:check:v4`, `npm run build` PASS. Tree clean.
- Debt: UX-015 and PRODUCT-006 reconciled to DONE in `docs/DEBT_REGISTER.md`. Out-of-scope later surfaces
  (structured export pipeline, ARX-lite risk layer, structured date/age app threading) remain OPEN under
  their own IDs (PRODUCT-007, BATCH-003) and were not touched.
