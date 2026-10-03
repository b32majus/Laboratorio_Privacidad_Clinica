# POLICY-01 — C-084 execution handoff

Status: EXECUTION_READY
Issue: #56 — [V4/POLICY-01] Job-aware Privacy Policy guidance and availability
Profile: volume
Matt entry: /implement
Publication boundary: LOCAL_ONLY

## Fixed point

Canonical branch: `3.0-main`
Canonical base: `23d961a9e403104072e193bf9f40adb9b0cbfbb8`
Execution branch: `work/policy-01-20261003`

## Objective

Make Privacy Policy understandable and job-aware without inventing policy semantics.
The four accepted policy identities remain exactly:

- Standard
- External AI
- Longitudinal Research
- Strict

The execution agent does not redesign policy semantics. It exposes current capability honestly.
## Authority

Read and obey current repository authority first:

- `AGENTS.md`
- `CODING_STANDARDS.md`
- `CONTEXT.md`
- `docs/shaping/CURRENT_DECISIONS.md`
- `docs/specs/SPEC_V4_PRIVACY_ENGINE.md`
- `app-v4/src/domain/job.ts`
- `app-v4/src/engine/policy.ts`
- `app-v4/src/engine/registry-engine.ts`
- `app-v4/src/structured/date-age-policy.ts`
- `app-v4/src/structured/transform-plan.ts`
- `app-v4/src/useJobSession.ts`
- current policy UI/tests in `app-v4/src/App.tsx`

Issue #56 and this handoff fix the product decisions. Do not reopen them.

## Job-kind availability

### Text / single document / document batch

Selectable now: **Standard**, **Strict**.
Visible but non-selectable: **External AI**, **Longitudinal Research**.
Reason: the registry text engine has accepted category→operator mappings only for Standard/Strict. External AI and Longitudinal Research are accepted ids but intentionally fail typed rather than guessing/falling back.

UI requirements:

- keep all four policies visible in guidance;
- label unsupported choices exactly as unavailable for this job type yet;
- prevent selection of unsupported choices before Review;
- preserve the engine's typed fail-closed behavior as backstop.

For text/document paths:

- Standard uses the accepted normal profile;
- Strict uses the accepted legacy strict processing profile;
- do not claim different per-category transformations between them unless authority changes.

## Structured jobs

All four policies remain selectable.

Accepted current date/age behavior:

- Standard: visit/event dates and birth dates → month-level generalization;
- Strict: same current structured date/age mapping as Standard;
- External AI: visit/event dates → deterministic per-patient shift preserving within-patient chronology/intervals; birth dates → age bands;
- Longitudinal Research: same accepted per-patient visit-date shift + birth-date age-band behavior.
When per-patient visit-date shifting applies, keep the existing explicit patient-ID column requirement and fail-closed behavior.

Do not imply:

- that External AI sends data to any external service;
- that Longitudinal Research grants research governance, approval or compliance;
- anonymity, certification, GDPR/LOPDGDD compliance or any unsupported safety guarantee.

Runtime remains local-only and memory-only under existing authority.

## Required product shape

Create a compact job-aware Privacy Policy workspace in the existing shell.
It must show:

- a clear `Privacy Policy` label;
- the current policy;
- whether it is available for the current Job kind;
- concise plain-language guidance for all four policies;
- textual `Available` / `Not available for this job type yet` state;
- disabled/non-selectable unsupported choices on unstructured jobs;
- all four selectable on structured jobs;
- structured patient-ID requirement where relevant;
- keyboard-accessible selection and visible focus.

No modal, wizard or redesign of the global flow.
## State transition invariants

Supported policy changes MUST preserve current `useJobSession` semantics:

- invalidate stale ReviewSession state;
- reset/recompute derived review/output state exactly as current authority does;
- structured jobs recompute structured plan/preparation through existing authorities;
- selecting the already-selected policy remains a no-op.

The UI must not become a second policy engine.
Prefer capability/availability derivation directly from existing pure authorities such as `lookupPolicyProfile` and `resolveStructuredDateAgePolicy`, or an equally direct authority-preserving seam.

Do not hard-code a second independent operator mapping in presentation code.

## Allowed production surface

Expected:

- `app-v4/src/App.tsx`
- focused App/policy UI tests
- optionally one small colocated presentation/helper module if it avoids duplicated capability logic
- focused E2E only where needed to prove the user-visible availability contract.

Tests/oracles may change only as necessary to prove this Work Order.
## READ-ONLY authorities

Do not modify unless HUMAN STOP/re-shaping is explicitly authorized:

- `app-v4/src/domain/job.ts`
- `app-v4/src/engine/policy.ts`
- `app-v4/src/engine/registry-engine.ts`
- `app-v4/src/structured/date-age-policy.ts`
- `app-v4/src/structured/transform-plan.ts`
- ReviewSession/review authority
- output builders/serializers
- Privacy Gate / Export readiness semantics
- dependencies
- runtime/deployment configuration.

If satisfying the UX goal appears to require changing any mapping, domain semantic, output semantic or policy meaning: **HUMAN STOP**.

## Deterministic evidence

At minimum prove:

- availability by Job kind;
- External AI / Longitudinal Research cannot be selected through text/document/batch UI;
- all four remain selectable for structured jobs;
- supported policy change still invalidates stale review state;
- reselecting current policy remains a no-op;
- keyboard selection + visible focus;
- responsive layout and changed normal-text contrast using existing deterministic browser/oracle patterns where applicable.
Required final verification includes:

- focused App/policy tests;
- `npm test` canonical chain;
- `npm run typecheck:v4`;
- `npm run lint:v4`;
- `npm run format:check:v4`;
- `npm run build:v4`;
- critical Playwright E2E / network invariant as required by the final diff.

Mechanical acceptance should be established by deterministic evidence, not reviewer prose alone.

## C-084 execution rules

Use `atenea-volume` as coordinator. MiMo is coordination-only and MUST NOT mutate tracked repository state by any route.

All repository mutation is delegated to the appropriate implementer/corrector.
Use upstream Matt `/implement`.

**Review closes the implementer's write phase.** Once review begins, the original implementer must not apply any review-driven change.

Any actionable review finding is corrected by a **fresh `atenea-corrector-volume` session** scoped to that finding envelope.

If the same authorized finding remains after correction attempt #1, one second fresh and bounded corrector attempt is allowed.

After two fresh attempts on the same finding, or if a new material issue/scope expansion appears: **HUMAN STOP**.
Engram/external memory stays outside the normal implementation→review→correction critical path.

Cora has already made all material product decisions in issue #56 and this handoff. Do not ask OpenCode to choose policy semantics, product claims or availability rules.

## Publication boundary

LOCAL_ONLY during execution.

Do not:

- push;
- create/update PRs;
- mutate/close issues;
- deploy;
- merge;
- force-push/history rewrite.

Finish with:

- exact starting BASE;
- exact final HEAD;
- coherent local commit(s);
- clean worktree;
- changed-file inventory;
- deterministic evidence;
- actual coordinator/implementer/reviewer/corrector routing;
- any remaining blocker or HUMAN STOP.