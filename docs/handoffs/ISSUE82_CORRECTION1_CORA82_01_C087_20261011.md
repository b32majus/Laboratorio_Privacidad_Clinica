# C-087 — Issue #82 / CORA-82-01 — correction attempt 1 of 2

**Status: HUMAN-AUTHORIZED FINDING-SCOPED CORRECTION**, 2026-10-11.
**Cora integrated verdict:** NO-GO on original candidate `db199a7a9dbef27e8da5aa4fc71b0d7e205535c1`.
**Correction dispatch anchor:** the clean docs-only commit carrying this handoff, whose exact SHA Cora supplies when launching the correction.
**Routing:** `cost_policy=openai_experimental`; `risk_class=complex`; coordinator `atenea-openai-frontier`; **one fresh** `atenea-corrector-openai` (`openai/gpt-6.1-sol#high`); **Publication: LOCAL_ONLY**.
**Budget:** correction **#1 of max 2**, with zero earlier #82 correction sessions. This is a correction of the accepted #82 lifecycle, **NOT** another `/implement`, another implementer, or a new canonical Standards/Spec review.

## Finding — exactly one, objectively reproduced

**CORA-82-01 — historical E2E consumers still drive the obsolete review action and cannot reach their next task.**

The #82 candidate correctly replaced the legacy `Keep original` button with `Mantener original`, requiring a further explicit `Sí, mantener original` only for higher-risk/uncertain entity types. New production-browser `e2e/review-export.spec.ts` passes **2/2** at **375×800** and **1280×800**. Independent Cora focused Vitest **210/210**, typecheck, ESLint, Prettier and production build pass; immutable ReviewSession/engine and Safe/Confidential serializers are protected.

But existing Playwright drivers still call `getByRole("button", { name: "Keep original" })`. A real production-build recheck covering 7 relevant spec files (39 tests) was halted at five independent **30-second locator timeouts** on this exact selector; 10 passed, 1 was interrupted and 23 did not run. First five failures were `e2e/gate-export-ux.spec.ts` (viewport 375/768/1280, keyboard controls, WCAG color contrast), each traced to **`e2e/harness/flows.ts:104`** in `completeReview(page)`, not to a demonstrated domain/serializer failure. One new pass-only journey is NOT enough to close this shared test-consumer fracture.

**Accepted outcome:** all historically supported E2E review consumers use the **existing updated #82 UI interaction** without getting stuck or bypassing risk confirmation, then reach their original subsequent Gate, Result, Safe and Confidential assertions unchanged. They must not advance past an unconfirmed restored decision.

## WHERE — exhaustively known, five allowed files

1. `e2e/harness/flows.ts`: `completeReview`, line ~104; define **one small exported reusable UI driver** for the current Mantener original contract.
2. `e2e/rec05-result.spec.ts`: `decideAllPendingThroughUi` fallback, line ~164; reuse that driver.
3. `e2e/policy-guidance.spec.ts`: `completeAllPending` fallback, line ~96; reuse it.
4. `e2e/structured-composed.spec.ts`: `decideActiveCell` fallback, line ~68; reuse it.
5. `e2e/structured-rec04-composed.spec.ts`: `decideActiveCell` fallback, line ~211; reuse it.

**No further consumer discovery by default.** This set is the complete exact-name inventory observed by Cora under `e2e/` on the candidate. `e2e/gate-export-ux.spec.ts` and `e2e/ux-closeout-shell.spec.ts` **reuse** `completeReview`/`gotoExportComplete`; do not edit either unless the known five-file envelope proves impossible and Cora authorizes expanded scope. `e2e/review-export.spec.ts` is **already updated** and is an independent passing witness, so leave it untouched.

## Exact driver behavior — user action → retained state → next action

A. From a selected detection in the **current** `Entity inspector`, click the button by its **exact accessible current name** `Mantener original`. Never add a backwards-compatibility alias to the production UI and never search for `Keep original`.

B. The UI only requires second-step confirmation for direct/uncertain categories; accepted lower-risk `FECHA`, `EDAD`, `UBICACION` are immediate one-click actions. To avoid duplicating a second product classifier in E2E, reuse the **actual visible state after the click**:
- if the contextual confirmation is present, assert that it is **visible**, click `Sí, mantener original` **once**, and wait for it to close;
- if there is no contextual confirmation, do not attempt to click a nonexistent Confirm control.
Read the current inspector `Type` field only if useful to make a stable assertion; keep it scoped to test observation, and never add another runtime classification table. Use Playwright's action/wait/role semantics rather than sleeps, races, arbitrary timeouts or quiet `try/catch` swallowing a failed confirmation.

C. Do not change the selected detection, Job, session, review status, pending filter, policy or extracted text in the helper. The actual UI drives the canonical `ReviewSession`. **Before returning, assert the selected inspector reflects `Current decision: Restored` (using its existing rendered label/status) and no contextual confirmation remains**. The caller must be able to **actually proceed** to the next detection, Privacy Gate, Result or artifact check; an unconfirmed review is never silently skipped. Keep the current test's pending-count assertions and its terminal output checks; avoid infinite loops or false-positive early exits.

D. Prefer importing and calling that single helper in the four other known specs. Do **not** copy/paste new divergent inline click-and-confirm blocks into each suite. Use a small named helper with minimal comments; do not rewrite fixtures, E2E flows, or acceptance assertions.

## Focused RED→GREEN evidence and scope guard

**RED (independently verified before correction):** 5/5 initial failing cases wait for the nonexistent `Keep original` button, through `e2e/harness/flows.ts:104`; no production modification is needed to reproduce the failure. Record that evidence, and prove the post-fix **GREEN** instead of rerunning 30-second failures as a ritual.

**First GREEN:** build/preview the **unchanged product** and rerun `e2e/gate-export-ux.spec.ts` at **375/768/1280** plus keyboard and contrast witnesses; restore all five failing journeys. Check actual user continuity and unchanged Gate/Result behavior, not just absence of a timeout.

**Affected-consumer GREEN:** run the **seven already selected suites** (shared helper + four direct consumers + the existing canonical #82 rendered witness):
```bash
E2E_PORT=44886 npx playwright test \
  e2e/review-export.spec.ts \
  e2e/gate-export-ux.spec.ts \
  e2e/ux-closeout-shell.spec.ts \
  e2e/rec05-result.spec.ts \
  e2e/policy-guidance.spec.ts \
  e2e/structured-composed.spec.ts \
  e2e/structured-rec04-composed.spec.ts --workers=2
```
The previous independent count was **39 selected tests**. If the count has genuinely changed, explain why; do not claim 39/39 without observed output. Preserve every existing per-suite assertion for privacy gates, byte-exact Safe/Confidential outputs, structured cells, keyboard reachability and responsive layout. Run the smallest relevant checks on affected E2E source (existing typecheck and Prettier); a **full** E2E suite is publication-stage evidence, not an extra correction ritual.

If a new failed test exposes a **different material product fault**, report its exact reproducible trace and **HUMAN STOP**. Do not expand the correction to application code or compensate by weakening expectations.

## Protected boundaries

No modifications to `app-v4/**`, `js/**`, `.opencode/**`, `AGENTS.md`, `docs/START_HERE.md`, the original #82 handoff, `package.json`, `package-lock.json`, application runtime, Job model, ReviewSession, Gate, exporters, accepted policy/taxonomy, or any other `e2e/**` file outside the five enumerated. The sole allowed new content is the five E2E driver adjustments. No new dependency, Playwright config change, screenshot regen, test skip/only, disabled assertion, broad redesign or invented product decision.

**Conditional safeguards ACTIVATED:** compatibility of material shared E2E consumers; after-action continuation across Review → Gate → Result; exact current label + optional human confirmation; mobile and desktop existing browser witnesses; distinct production/typed-test boundaries. **Open material product questions: NONE.**

**HUMAN STOP:** need to change product, forbidden path, correctness of actual ReviewSession/output semantics, unable to prove the current confirmation settles, new genuine unrelated defect, missing bound corrector, quota/auth failure, or inconclusive corrected browser evidence.

**Closeout:** identify parent correction anchor and fixed candidate SHA, exact five-file inventory, test counts/commands, first five previously failed workflows now green, evidence retained/unchanged, state of #82 correction budget **1/2**, tree clean and `Publication: LOCAL_ONLY`. Return to Cora for **read-only integrated re-audit**; no push, PR, merge, issue mutation, deployment or second Standards/Spec review. STOP.
