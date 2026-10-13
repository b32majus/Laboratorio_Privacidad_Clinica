# #91 REC-11 — F1 combined execution: A cross-browser focus, B remaining canonical findings

Status: READY_TO_LAUNCH_COMBINED_F1 (docs-only preparation). Date: 2026-10-13.
Human authorization: combine browser-compatibility correction and remaining canonical review closeout into ONE attended Train with TWO sequential, bounded work units. These are NOT two new GitHub issues. Issue #91 remains the only product issue.

## 0. Authority and supersession

- Product: b32majus/Laboratorio_Privacidad_Clinica, worktree `/srv/kairos-lab/qualification/laboratorio-issue91-sophilux-c087-atenea148-20261012`, branch `work/issue91-visual-system-c087-atenea148-20261012`.
- Already reviewed candidate: `4960aa2d0d262561185f2f2501bbb027e251263e`; product base `78db715e158d731fa0cfb12ea466551072be5fdf`.
- Preparation provenance: first F1 docs-only commit `d31aadfc8f84f31c84dfba7a358f5b3786344662`; combined F1 contract at `d690119c832a00ed939de4f92971687e3b731fa9`; subsequent docs-only precision amendment(s). Human launch MUST pin the exact clean HEAD printed by the final preflight; it must have d31aadfc and d690119 as ancestors. The eventual single correction commit must have THAT exact launch HEAD as parent, not d31aadfc or d690119. No amend/rebase/reset.
- Atenea C-087 pinned at `462d461f3048a0ddf15aace1257d793fd52f1c48`; cost_policy `go`, risk_class `complex`; coordinator `atenea-go`, exactly one fresh linked `atenea-corrector-go-complex` and no fallback/profile change.
- Read the original prescriptive findings: `docs/handoffs/ISSUE91_CANONICAL_REVIEW_CORA_F1_ALL_FINDINGS_C087_GO_COMPLEX_20261013.md`. This document OVERRIDES its S1 recipe, its source/test allowlist and its test commands, **not** its SP1 adjudication, S2/S3/S4 recipes, safety protections or publication STOP.
- Standards and Spec already ran once canonically against the integrated #91 candidate. Do NOT run them again for this finding-scoped correction.
- Combined A+B is ONE previously-authorized integrated #91 **finding-scoped correction envelope**, not two independently authorized GitHub tickets/candidates. It consumes ONE bounded attempt (1/2) if its single corrector is dispatched; the A/B internal checkpoints do not reset or separately consume attempts. Canonical Standards+Spec was already performed at the approved integrated boundary, and its findings are what this envelope closes. Do not skip a different, separately mandatory review boundary by treating an independent change as a correction: if any material new feature/behavior beyond identified S1-S4 is required, HUMAN STOP for Cora + human to establish its own authorized work/review boundary. One local candidate commit at the end; no amend/rebase.

## A. Cross-browser S1 — replace the incompatible reading-flow proposal

### Material risk and required result

The real DOM currently renders `InspectorPane → DocumentPane → FilterProgressPane`, while desktop Sophilux grids present different orders. CSS `reading-flow: grid-rows` is not generally supported by Firefox and Safari. It MUST NOT be introduced as the authority for keyboard or accessibility order.

Required **same semantic and interactive layout already visually accepted**:
- Single Review desktop (>=1024): document → findings → inspector; <=1023: inspector → document → findings.
- Batch Review desktop (>720): document → inspector → findings; <=720: inspector → document → findings.
- Free-text Cells Review desktop (>1100): document → inspector → findings; <=1100: inspector → document → findings.
- The outer Batch queue and Cells queue retain their accepted positions. This only changes the three inner Review panes.
- In every case, DOM/source sequence, spatial order, sequential Tab focus, and screen-reader reading order must be coherent WITHOUT browser-specific CSS reading-flow.

### Exact affected source and implementation approach

1. `app-v4/src/review/ReviewWorkspace.tsx`, `ReviewWorkspaceProps` around line 96: add optional `readonly layout?: "single" | "batch" | "cells"` (default `single` inside component). No change to existing session, onDecide, onAddManual contracts.
2. In the same file add a **single** responsive breakpoint subscription using React `useSyncExternalStore` (with `useCallback` for stable subscribe/getSnapshot) and `window.matchMedia` with the exact CSS thresholds: single `(max-width: 1023px)`, batch `(max-width: 720px)`, cells `(max-width: 1100px)`. Register/remove the `change` listener, return a stable boolean from getSnapshot, use an SSR/jsdom-safe false snapshot when matchMedia is unavailable. No polling, global resize handlers, external dependency or test runtime patch.
3. In `ReviewWorkspace.tsx` at the current `div.sx-review-grid` around line 483: retain EXACTLY ONE instance each of existing `InspectorPane`, `DocumentPane`, `FilterProgressPane`, with their full prop values, callbacks, refs, accessible names and focus semantics unchanged. Extract existing three JSX expressions into separately keyed React elements (`inspector`, `document`, `findings`) and render them ONCE in the correct DOM order calculated above. Keep the surrounding `section`, progress, aria role/labels, and grid wrapper untouched. Never duplicate a pane and hide the duplicate with CSS. Do not reimplement pane internals, mutate ReviewSession, or move transient UI state out of ReviewWorkspace.
4. `app-v4/src/review/BatchReviewView.tsx`: at its one live `ReviewWorkspace` call (~628), add ONLY `layout="batch"`. `app-v4/src/structured/StructuredFreeTextReview.tsx`: at its one live call (~209), add ONLY `layout="cells"`. The direct single Review caller in `App.tsx` may use the default `single`; do not change it for A.
5. `app-v4/src/visual/sophilux-v1.css`: preserve the already-accepted U1–U7 grid area geometry and tokens. Do NOT add `reading-flow: grid-rows`, `order`, positive tabIndex or accessibility polyfills to force keyboard order. No new visual layout, CSS clipping or hidden duplicate.
6. If moving keyed DOM children on a live breakpoint change loses a focused control, draft text, selection/decision or session state, HUMAN STOP and report the precise reproduction. Do NOT improvise a focus trap, blur/refocus handler or architectural workaround without Cora prescription.

### Literal implementation anchors for the common browser-safe renderer

In `ReviewWorkspace.tsx` extend the React imports with `useCallback` and `useSyncExternalStore`. Near `ReviewWorkspaceProps`, use exactly the following one shared helper (and no separate per-pane breakpoint hooks):

```tsx
type ReviewLayout = "single" | "batch" | "cells";
type ReviewPane = "document" | "findings" | "inspector";
const REVIEW_STACK_QUERY: Record<ReviewLayout, string> = {
  single: "(max-width: 1023px)",
  batch: "(max-width: 720px)",
  cells: "(max-width: 1100px)",
};

function useReviewStacked(layout: ReviewLayout): boolean {
  const subscribe = useCallback(
    (notify: () => void) => {
      if (typeof window === "undefined" || typeof window.matchMedia !== "function") {
        return () => {};
      }
      const media = window.matchMedia(REVIEW_STACK_QUERY[layout]);
      media.addEventListener("change", notify);
      return () => media.removeEventListener("change", notify);
    },
    [layout]
  );
  const getSnapshot = useCallback(
    () =>
      typeof window !== "undefined" &&
      typeof window.matchMedia === "function" &&
      window.matchMedia(REVIEW_STACK_QUERY[layout]).matches,
    [layout]
  );
  return useSyncExternalStore(subscribe, getSnapshot, () => false);
}
```

Inside `ReviewWorkspace` use `const layout = props.layout ?? "single"; const stacked = useReviewStacked(layout);`. The THREE existing JSX elements must be extracted byte-equivalently from the old `sx-review-grid` children, given explicit React keys `document`/`findings`/`inspector`, and mapped once by:

```tsx
const paneOrder: readonly ReviewPane[] = stacked
  ? ["inspector", "document", "findings"]
  : layout === "single"
    ? ["document", "findings", "inspector"]
    : ["document", "inspector", "findings"];
```

Use one object `Record<ReviewPane, ReactElement>` containing the three previously existing keyed JSX elements and render `{paneOrder.map((pane) => paneElements[pane])}` inside the SAME `sx-review-grid`. Do not change any JSX prop value or callback in the extracted elements. If actual focused-node preservation on breakpoint change cannot be demonstrated, STOP rather than layering a speculative workaround. This is a single authority for visual/source order across the three accepted layouts.

### A: focused proof (real production V4 build)

- Add one narrowly scoped browser witness named `CORA-91-F1 DOM and Tab order tracks visual Review panes` to `e2e/review-productivity.spec.ts`, reusing its existing 24-findings synthetic fixture and real input/create flow. No independent suite or screenshots.
- Verify the first focus entrance to each pane by sequential real Tab, not programmatic focus or CSS computed value alone. Verify DOM child order equals accepted visual order at 1440 and 375, and selected finding, actual decision, draft and focus visible remain intact; no duplicate pane instances.
- Include a focused resize across single Review breakpoint with a populated *unsaved* replacement draft and focused field, reporting any focus or draft loss (HUMAN STOP). Do not alter the original accepted 24-item navigation tests.
- For Batch and Cells, first reuse the existing E2E synthetic flows and assertions. They do not currently prove responsive Tab ordering: add ONLY the missing focused assertions in their nearest existing relevant test cases, or one named focused test per file if reuse would substantially alter the original test: `CORA-91-F1 Batch Tab order matches visual panes` in `e2e/batch.spec.ts` and `CORA-91-F1 Cells Tab order matches visual panes` in `e2e/structured-composed.spec.ts`. Verify DOM/pane order, real Tab transitions, current selected session/draft preserved at the two relevant layout thresholds (Batch 1280/375; Cells 1280/375); no new general journeys. If the existing harness cannot reach a real cell-review state without unrelated changes, HUMAN STOP with the exact limitation, not fake fixtures or an extra suite.
- This is a KNOWN material cross-browser acceptance risk, so use Chromium, Firefox and Playwright WebKit (Safari-engine proxy; not a native Safari or iPhone claim). The VPS currently has Chromium only; the implementer may run `npx playwright install firefox webkit` once as necessary, with NO package manifest/lockfile modifications. If browser binary or OS runtime dependencies prevent a named test, record that engine as UNVERIFIED and HUMAN STOP (do not claim universal compatibility or modify unrelated infrastructure).
- **A exact command plan:** run `npm run typecheck:v4`, `npx vitest run app-v4/src/review/ReviewWorkspace.test.tsx`, then `npm run build` ONCE for the A candidate. After that run the three explicitly named focused witnesses in their existing files with `npx playwright test e2e/review-productivity.spec.ts e2e/batch.spec.ts e2e/structured-composed.spec.ts --grep "CORA-91-F1" --browser chromium --workers=1`, repeat this exact command replacing `chromium` with `firefox` and then `webkit`. Coordinator checks actual stdout and browser observations, not just green counts. Do not run all other tests in these files. If the Batch/Cells checks are incorporated within existing named tests rather than as fresh names, list their exact names and use a matching narrow --grep; never silently drop either consumer.
- Also run once: `npm run typecheck:v4` and existing `npx vitest run app-v4/src/review/ReviewWorkspace.test.tsx`. These protect the shared component and existing contract. No full suite.

Gate A→B: coordinator checks the observed focus order, real layout, preserved draft/selection and browser-engine outcomes. Continue immediately to B ONLY if A has no material negative evidence. Otherwise HUMAN STOP for Cora + human: no speculative fixes and no proceeding merely because one engine is green.

## B. Remaining canonical findings SP1/S2/S3/S4 — unchanged prescriptions

- SP1: accept canonical Atenea sync in original initial prepared commit as authorized prep provenance only; no configuration mutation and no revert.
- S2: execute the EXACT JSX cut/paste of native `details.sx-session-help` to LAST CHILD of `sx-sitebar-context` in `app-v4/src/App.tsx`, preserving its text/id/aria-describedby/handlers. Follow original F1 §3 precisely.
- S3: add original F1 §4 explicit U1 changed paths and historical evidence to `docs/evidence/issue91-u1/README.md`, without claiming package manifest changes.
- S4: replace ONLY the obsolete top comment of `app-v4/src/visual/sophilux-v1.css` per original F1 §5; do NOT add the original proposed reading-flow rule.
- Add and execute ONLY the named focused S2 real-keyboard browser witness in `e2e/input-start.spec.ts` at 375 and 1280, with policy enabled after a real created Job. Browser engines as in A where practical; retain current U1 negative assertions.
- **B exact command plan:** after B changes the product, run `npm run typecheck:v4`, `npm run format:check:v4`, `git diff --check` once and `npm run build` ONCE for the combined final candidate (avoid stale dist). Coordinator runs `npx playwright test e2e/input-start.spec.ts --grep "CORA-91-F1 session help follows policy in keyboard focus order" --browser chromium --workers=1`, and a single real composed Review focused witness against the final build: `npx playwright test e2e/review-productivity.spec.ts --grep "CORA-91-F1 DOM and Tab order tracks visual Review panes" --browser chromium --workers=1`. The already-observed A tests on Firefox/WebKit need not be repeated because B edits only the sitebar/README/CSS comment, not Review layout or its tests. If any source outside that B allowance changes, or any contradictory browser observation appears, HUMAN STOP; do not generalize prior PASS.
- Mandatory review-boundary preservation: there is no new independently selected candidate requiring another Standards/Spec cycle; this is a finding-scoped repair on the already reviewed #91 integration, and the final Cora recheck is not a substitute for any separate future review. No repeated canonical review of the same original candidate and no waiver for a genuinely new independent candidate.
- If B causes build/test failure or an earlier engine/browser observation contradicts the acceptance, no assertion softening, no extra diagnostic campaign and no scope increase; HUMAN STOP. The coordinator cannot label a composed candidate PASS over any material negative observation.

## Combined allowlist and STOP

Writable paths (ONLY):
`app-v4/src/review/ReviewWorkspace.tsx`;
`app-v4/src/review/BatchReviewView.tsx`;
`app-v4/src/structured/StructuredFreeTextReview.tsx`;
`app-v4/src/App.tsx`;
`app-v4/src/visual/sophilux-v1.css`;
`e2e/review-productivity.spec.ts`;
`e2e/batch.spec.ts`;
`e2e/structured-composed.spec.ts`;
`e2e/input-start.spec.ts`;
`docs/evidence/issue91-u1/README.md`.

DO NOT TOUCH: `docs/design/**` frozen Sophilux references; all engine/domain/privacy/ReviewSession/ExportStep/PrivacyGate models and outputs; tests not named; `.opencode/**`, `AGENTS.md`, `opencode.json`, CI, lockfiles, package.json; original accepted U1-U7 evidence, and any other JSX/CSS. No push, PR, merge, deployment or issue close. No other writers/reviewers or new tickets.

Return exactly `READY_FOR_CORA_ISSUE91_F1_CROSS_BROWSER_AND_FINDINGS_RECHECK` with final single SHA and exact parent, clean tree, diffstat, SP1/S1/S2/S3/S4 dispositions, each named test result grouped by browser/viewport, browser versions, focus order and resize-state observations, successful/non-successful evidence, duration/model usage. No claim of Safari-native testing based only on WebKit. Final independent Cora recheck and publication-quality checks occur AFTER this STOP, not during correction.
