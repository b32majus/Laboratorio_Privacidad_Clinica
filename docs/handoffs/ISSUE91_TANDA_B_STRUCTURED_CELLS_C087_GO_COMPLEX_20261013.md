# Issue #91 / REC-11 — Tanda B: U4 Estructurado, U5 Celdas (2026-10-13)

**Status: U4 READY_TO_LAUNCH / U5 PREPARED, NOT DISPATCHABLE UNTIL U4 CORA + HUMAN GO.**
**This is a preparation-only record.** No agent was dispatched and no product file was changed in preparation.

## 0. Fixed authority and route

- Exact worktree: /srv/kairos-lab/qualification/laboratorio-issue91-sophilux-c087-atenea148-20261012
- Branch: work/issue91-visual-system-c087-atenea148-20261012
- Accepted U3a Go record HEAD before this document: 7a69ffd6c8e678caec07ee525b67a0e6cc4bf5aa. This docs-only preparation commit MUST have it as parent. For U4, launch HEAD is the commit containing THIS document (must be pinned by the launch prompt), clean worktree; U4 local candidate parent MUST equal the preparation commit.
- Atenea canonical C-087: /srv/kairos-lab/Atenea @ 462d461f3048a0ddf15aace1257d793fd52f1c48. Cost policy go, risk class complex. Coordinator atenea-go (opencode-go/deepseek-v4.1-flash); each unit uses exactly ONE fresh atenea-implementer-go (opencode-go/muse-spark-1.3-contributor). No reuse from U3a or between U4/U5.
- This is an explicit Tanda B Go preference continuing the human-directed cost balancing choice and U3a successful bounded Go candidate. Go revised 2026-10-12 bindings are STILL a qualification candidate: not promoted, no equivalence claims. Require canonical (cd /srv/kairos-lab/Atenea && node tools/check-go-models.mjs) PASS at launch. Missing provider/role/quota => HUMAN STOP; no implicit fallback or provider/profile switch.
- Immutable visuals: docs/design/sophilux-b-v1/ACCEPTED_VISUAL_CONTRACT.md and previews/estructurado-{1440,375}.png and celdas-{1440,375}.png. Immutable functional reconciliation: docs/design/sophilux-b-v1/SOPHILUX_B_V1_FUNCTIONAL_RECONCILIATION.md, VF-04/VF-05, D4 and VF-08.
- Real V4 #85 comparative Structured is ALREADY functional. U4/U5 are composition ONLY. Do not invent a seven-step navigation, copy demo columns/actions, fake ready-state, mutable mock source, synthetic component state or mandatory privacy ceremony. All actions and policy are controlled by live canonical bridge.
- U1, U2a, U3a accepted for bounded visual compositions, frozen. U3a Polish debt recorded in docs/handoffs/ISSUE91_U3A_HUMAN_VISUAL_GO_20261013.md; do NOT fix it here.

## 1. Execution order and fixed STOP

Dispatch ONLY U4 first, one fresh Go implementer. Real 32-column witness, focused evidence and bounded commit; coordinator stops at READY_FOR_CORA_HUMAN_VISUAL_RECHECK_U4. Cora inspects the actual populated screen, then human approves or rejects. No U5 writer before BOTH approvals, regardless of test PASS.

AFTER express U4 GO and an accepted clean U4 SHA, the coordinator may apply the already-prescribed U5 recipe with ONE fresh Go implementer, using a new fixed U4 parent. The U5 candidate then stops at READY_FOR_CORA_HUMAN_VISUAL_RECHECK_U5, again awaiting Cora + human. No simultaneous writers, no worktree reuse across roles, no work on U6/U7. If a GO requires recipe changes, stop for Cora literal revision instead of guessing.

## 2. U4 — Estructurado: comparative 32-column clinical workstation

Result: actual structured Configure view with the existing four-field comparison table (Columna / Clasificación vigente / Tratamiento efectivo / Estado o acción pendiente) dominant, a factual compact status + single patient-ID band above it, and contextual inspector alongside at 1440x900. At 375x800: status and patient-ID authority first, then table with scrolling INSIDE its explicitly labeled focusable region, then inspector; page remains within 375px. Genuine pre-configuration sheet/header states appear BEFORE the real 32-col table only when workbook requires them. Preserved real treatment locks, date roles, Study ID options/disclosure, reasons blocking readiness and next pending column. No fake 29/32 count or demo values.

### U4.1 — App.tsx: exactly two width expressions + one wrapper

File: app-v4/src/App.tsx.

In BOTH header sitebar and main width className expressions, find exact U3a conditional:
    currentStep === "input" || (currentStep === "review" && (isBatch || review !== null))
Replace EACH with:
    currentStep === "input" || (currentStep === "review" && (isBatch || review !== null)) || (currentStep === "configure" && job?.kind === "structured")
Prettier may reflow. All other widths, route guards and first two branches unchanged.

In ONLY the branch:
    ) : currentStep === "configure" && job && job.kind === "structured" ? (
wrap the existing SINGLE StructuredConfigureWorkspace node in:
    <div className="sx-structured-task">
      <StructuredConfigureWorkspace ...EXACT CURRENT PROPS, JSX, HANDLERS AND KEY... />
    </div>
The ellipsis is explanatory: preserve every actual existing prop, all callbacks, job key, ternary exportReadiness and outputOptions. Only insert two wrapper tags. No reordering of routes and no additional Step.

### U4.2 — StructuredConfigureWorkspace.tsx: semantic class tokens only

File: app-v4/src/structured/StructuredConfigureWorkspace.tsx.

In StructuredConfigureWorkspace component root return replace:
    <section aria-labelledby="configure-step-heading">
with:
    <section className="sx-structured-workspace" aria-labelledby="configure-step-heading">

In ConfigurationView root return (approx line 454), replace only:
    <div className="mt-3 space-y-3">
with:
    <div className="sx-structured-configuration mt-3 space-y-3">

In ConfigurationView FIRST child status+authority grid (approx line 463), prepend ONLY class token sx-structured-status-band to the EXISTING className string. Keep existing grid, lg:grid-cols-[...] and all other class tokens. Do NOT remove or rewrite status/patient ID children.

In the SECOND child comparative+inspector grid (approx line 467), prepend ONLY class token sx-structured-grid to the existing className, preserving its current lg:grid-cols-[minmax(0,1.8fr)_minmax(280px,1fr)]. Existing test at StructuredConfigureWorkspace.test.tsx:529 asserts this class. DO NOT remove it; the scoped Sophilux CSS below overrides visual grid geometry without producing an obsolete-class oracle.

In ColumnComparisonTable root section (approx line 767), prepend sx-structured-table to the existing className; preserve the named table, tabindex=0, overflow-x-auto on labeled region, 36rem minimum width and every row button, index, class/Action/state marker.

In ColumnInspector root aside (approx line 939), prepend sx-structured-inspector to its existing className; preserve aria-label, focus, selected column behavior, allowed action select, date role, evidence disclosure, patient-ID authority and next-pending navigation.

For SheetSelection / HeaderRowSelection, DO NOT restructure or alter state/select/form/confirmation; CSS may style these existing aria-label sections via the scoped root selectors below. Do not move or auto-select header/worksheet.

### U4.3 — append ONLY this U4 CSS after the accepted U3a section

File: app-v4/src/visual/sophilux-v1.css.

~~~css
/* #91 U4 Structured: real controlled four-field comparison and contextual inspector. */
.sophilux-shell .sx-structured-task .sx-structured-workspace > h2 {
  color: var(--sx-ink);
  font-family: var(--sx-serif);
  font-size: clamp(32px, 3.2vw, 43px);
  line-height: 1.08;
}
.sophilux-shell .sx-structured-task .sx-structured-configuration,
.sophilux-shell .sx-structured-task .sx-structured-grid > *,
.sophilux-shell .sx-structured-task .sx-structured-status-band > * {
  min-width: 0;
}
.sophilux-shell .sx-structured-task .sx-structured-status-band,
.sophilux-shell .sx-structured-task .sx-structured-table,
.sophilux-shell .sx-structured-task .sx-structured-inspector,
.sophilux-shell .sx-structured-task .sx-structured-workspace > section[aria-label] {
  border: 1px solid var(--sx-line);
  border-radius: 13px;
  background: var(--sx-paper);
  box-shadow: var(--sx-shadow);
}
.sophilux-shell .sx-structured-task .sx-structured-grid {
  grid-template-columns: minmax(0, 1.85fr) minmax(310px, 0.9fr);
  align-items: start;
  gap: 14px;
}
.sophilux-shell .sx-structured-task .sx-structured-table [aria-pressed="true"] {
  outline: 2px solid var(--sx-rose-deep);
  outline-offset: 1px;
}
.sophilux-shell .sx-structured-task .sx-structured-table [role="region"] {
  max-width: 100%;
  min-width: 0;
}
@media (max-width: 1023px) {
  .sophilux-shell .sx-structured-task .sx-structured-grid,
  .sophilux-shell .sx-structured-task .sx-structured-status-band {
    grid-template-columns: minmax(0, 1fr);
  }
}
~~~

Do NOT change CSS for other U1/U2a/U3a components, global body overflow, shared Tailwind utilities or the canonical design prototype. Focus/contrast and text statuses remain authoritative.

### U4.4 — first real witness and checks

Build an ephemeral synthetic CSV outside the repo with exactly 32 distinct column headers, genuine data rows and at least one unresolved column. Load it into the actual V4 via file picker + Crear trabajo (no directly mounted mock component). Use the real structured classifier; DO NOT hard-code 29 pending or any ready fact. If CSV path/data cannot enter genuine Structured Configure, STOP rather than forge screenshot. Record true 32 rows, four visible table headings, selection, inspector and factual summary. At 1440x900 viewport first frame scrollY=0 plus fullPage; at 375x800 same two frames. Save 4 screenshots and README in docs/evidence/issue91-u4/ with source fixture generation/provenance, accepted preview comparison, scrollWidth<=innerWidth and the table region actual scrollWidth>clientWidth at 375; no global overflow clipping. Explicitly verify selected column/inspector and next pending selection are operable. Sheet/header chooser behaviors are already exercised by existing e2e; a small additional factual capture is allowed ONLY if needed to resolve a material visual mismatch.

Existing precise assertions: app-v4/src/structured/StructuredConfigureWorkspace.test.tsx covers four fields, real override, per-column lock, patient-ID, date role, sheet/header, labeled scrolling region and inspector. Do NOT change that test to match styling.

Implementer exactly once:
    npm run typecheck:v4
    npx vitest run app-v4/src/structured/StructuredConfigureWorkspace.test.tsx
    npm run format:check:v4
    git diff --check

Coordinator once on the fixed candidate (existing integrated workbook consumer; do not expand to other specs):
    npx playwright test e2e/structured-rec04-composed.spec.ts --grep "composed hospital workbook traverses sheet/header" --workers=2

Build once before browser if dist is stale. No full test matrix, no unrelated suites. Any old-class test mismatch despite preservation is HUMAN STOP for Cora-authored test-only decision. Owner Cora visual review + human GO required after U4.

U4 allowed changed paths ONLY: app-v4/src/App.tsx (two conditional widths plus Configure wrapper), app-v4/src/structured/StructuredConfigureWorkspace.tsx (five exact class additions), app-v4/src/visual/sophilux-v1.css (append only U4), docs/evidence/issue91-u4/. No test/config/engine/domain changes.

## 3. U5 — Texto libre en celdas (prepared, gated by U4)

Result: real Structured review subtask ONLY when an actual configured column has effectiveAction process-as-text; no U5 screen for none. When review has not run, show actual bounded processing trigger and truthful async/busy/error; when processed, queue of genuine cell sessions, context/content and live ReviewWorkspace for the active successful cell. A processing failure shows an error, NOT a false ReviewSession; real decision retains original range, keyboard/focus and per-cell draft clearing; safe output remains blocked until every required cell decision and error resolved. At desktop, queue left, actual selected cell Review right; mobile queue first, then active inspector/document/findings. User can return to Configurar without losing domain decisions.

### U5.1 — App.tsx

At BOTH width conditional expressions installed by U4, add this OR clause at the end:
    || (currentStep === "review" && job?.kind === "structured" && hasFreeTextColumns)
Do not disturb U4 conditions or Batch/Single Review widths.

Under the existing actual structured Review conditional:
    ) : currentStep === "review" && job && job.kind === "structured" ? (
      hasFreeTextColumns && structuredConfiguration !== null ? (
wrap ONLY the actual StructuredFreeTextReview JSX in:
    <div className="sx-cells-task">
      <StructuredFreeTextReview ...EXACT EXISTING PROPS/HANDLERS... />
    </div>
No wrapper around the no-free-text StepUnavailableState fallback. No change to hasFreeTextColumns or session route logic; do not introduce a no-op Review.

### U5.2 — StructuredFreeTextReview.tsx

In root return (approx line 101), replace:
    <section aria-labelledby="review-step-heading">
with:
    <section className="sx-cells-workspace" aria-labelledby="review-step-heading">

Within the EXISTING freeText !== null branch, immediately BEFORE:
    <nav aria-label="Celdas de texto libre" className="mt-4 max-w-3xl">
insert:
    <div className="sx-cells-grid mt-4">
And add token sx-cells-queue to the nav className, keeping its name and all children.

Immediately AFTER that nav closing tag and BEFORE the condition:
    {active !== undefined && active !== null && active.ok && (
insert:
    <div className="sx-cells-current min-w-0">
Do not move or replace the existing active ok ReviewWorkspace or failed-cell alert; both remain direct children of this new current wrapper.

After the complete existing block:
    {active !== undefined && active !== null && !active.ok && (
      <div role="alert" ...>
        ...
      </div>
    )}
and BEFORE the closing:
    </>
insert exactly:
    </div>
    </div>
These two closures close sx-cells-current and sx-cells-grid. Everything else remains identical, including progress, rerun control, errors, labels, statuses, callbacks and navigation. The freeText === null branch remains wholly unchanged.

### U5.3 — append only this CSS after U4

~~~css
/* #91 U5: real processed Structured free-text cells, no fabricated session. */
.sophilux-shell .sx-cells-task .sx-cells-workspace > h2 {
  color: var(--sx-ink);
  font-family: var(--sx-serif);
  font-size: clamp(32px, 3.2vw, 43px);
  line-height: 1.08;
}
.sophilux-shell .sx-cells-task .sx-cells-grid {
  display: grid;
  grid-template-columns: minmax(245px, 0.55fr) minmax(0, 1.45fr);
  align-items: start;
  gap: 14px;
}
.sophilux-shell .sx-cells-task .sx-cells-grid > *,
.sophilux-shell .sx-cells-task .sx-cells-current,
.sophilux-shell .sx-cells-task .sx-review-grid > * {
  min-width: 0;
}
.sophilux-shell .sx-cells-task .sx-cells-queue {
  margin-top: 0;
  border: 1px solid var(--sx-line);
  border-radius: 13px;
  background: var(--sx-paper);
  box-shadow: var(--sx-shadow);
  padding: 12px;
}
.sophilux-shell .sx-cells-task .sx-cells-queue [aria-current="true"] {
  outline: 2px solid var(--sx-rose-deep);
  outline-offset: 1px;
}
.sophilux-shell .sx-cells-task .sx-cells-current .sx-review-grid {
  display: grid;
  grid-template-columns: minmax(0, 1.1fr) minmax(285px, 0.9fr);
  grid-template-areas: "document inspector" "findings findings";
  gap: 12px;
  align-items: start;
}
.sophilux-shell .sx-cells-task .sx-review-document { grid-area: document; min-width: 0; }
.sophilux-shell .sx-cells-task .sx-review-inspector { grid-area: inspector; min-width: 0; }
.sophilux-shell .sx-cells-task .sx-review-findings { grid-area: findings; min-width: 0; }
@media (max-width: 1100px) {
  .sophilux-shell .sx-cells-task .sx-cells-grid,
  .sophilux-shell .sx-cells-task .sx-cells-current .sx-review-grid {
    grid-template-columns: minmax(0, 1fr);
  }
  .sophilux-shell .sx-cells-task .sx-cells-current .sx-review-grid {
    grid-template-areas: "inspector" "document" "findings";
  }
}
~~~

Only active real Review receives the grid; a failed cell remains an honest error and no fake inspector. No blanket shared Review CSS and no mobile page overflow.

### U5.4 — witness, tests and STOP

Generate or adapt a TEMP synthetic CSV with 3 actual nonempty text cells in a column genuinely configured process-as-text. Use the real App routing and Process cells CTA, verify 3 actual cell sessions (and their true statuses), select another cell and verify its own source/decision without leaking the prior cell draft. Real first-viewport/fullPage screenshots at 1440x900 and 375x800 (four frames), scrollY=0 for first viewport and page-width fit, under docs/evidence/issue91-u5/ with README. If actual cell count differs, correct the synthetic input outside the repo before evidence, never fabricate UI state. A no-cells state and an error-state are verified via existing focused tests; no ceremonial Review and no false ready.

Implementer once:
    npm run typecheck:v4
    npx vitest run app-v4/src/structured/StructuredFreeTextReview.test.tsx
    npm run format:check:v4
    git diff --check

Coordinator once, on fixed candidate:
    npx playwright test e2e/structured-composed.spec.ts --grep "composed structured Job traverses Configure" --workers=2

Build once for fresh production browser preview if needed. No broad suite, no unrelated output test or test rewriting. If new CSS causes old class oracle conflict, HUMAN STOP for Cora exact test-only decision. U5 allowed changed paths ONLY: App.tsx two width conditions and true StructuredFreeTextReview wrapper; StructuredFreeTextReview.tsx class/wrapper tags; sophilux-v1.css appended U5 section; docs/evidence/issue91-u5/ new proof. Do not modify ReviewWorkspace.tsx or any U4 previously approved product paths except the explicit U5 App/CSS append.

## 4. DO NOT TOUCH / evidence economy / stop authority

Absolute protected: U1/U2a/U3a approved code and evidence; frozen design prototype and manifest; all canonical ReviewSession, structured configuration/review/domain state, output data models, worksheet/header parsing, patient identity/date/Study ID semantics, step availability, session navigation, engine, privacy/security gate, exports, confidential, global shell CSS, AGENTS, OpenCode agent configs, workflow/CI and deployments. Existing tests are evidence, not free rewrite targets.

For each unit: single fresh implementer, single local bounded product/evidence commit, clean tree, frozen SHA; no amendment/rebase/push/PR/merge/deploy/issue close. One authoritative real first populated witness. Material issue -> HUMAN STOP with exact file/anchor, literal diagnosed correction when known, property preserved and focused falsifying test. No second agent/corrector and no speculative edits without new scoped Cora + human authority. U4 human GO is mandatory before executing U5. End of U5 likewise requires Cora and human. Final Standards/Spec and integration quality review happen once at fixed complete #91 candidate, NOT as routine per-screen ceremony; U6/V6 Comprobación and U7/V7 Resultado remain separate later work, not launched by this Tanda.
