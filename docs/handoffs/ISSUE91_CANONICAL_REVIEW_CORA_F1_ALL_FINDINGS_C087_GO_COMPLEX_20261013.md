# Issue #91 — CORA-F1: canonical Standards + Spec findings, ONE scoped Go Complex corrector

Status: READY_TO_LAUNCH_CORA_F1. Date 2026-10-13.
**The human explicitly authorized the proposed SINGLE prescriptive closeout for all canonical review findings.** Preparation is docs-only. Do not dispatch until exact new HEAD is pinned and clean.

## 0. Immutable authority, history and lifecycle

- Fixed already-reviewed integrated #91 candidate: 4960aa2d0d262561185f2f2501bbb027e251263e; parent U7 visual GO 78bed54d08a0a3ea879b8d73ee21a37f8976e4a3.
- Base of integrated #91 diff: 78db715e158d731fa0cfb12ea466551072be5fdf.
- Repository worktree: /srv/kairos-lab/qualification/laboratorio-issue91-sophilux-c087-atenea148-20261012
- Branch: work/issue91-visual-system-c087-atenea148-20261012.
- This docs-only F1 handoff commit must have exactly 4960aa2d0d262561185f2f2501bbb027e251263e as its parent. The correction writer starts ONLY from the resulting handoff HEAD pinned by the human launch. One correction commit on top of that, no amend/rebase/push.
- Atenea C-087 canonical: /srv/kairos-lab/Atenea@462d461f3048a0ddf15aace1257d793fd52f1c48. Cost policy go, risk class complex. Coordinator atenea-go (opencode-go/deepseek-v4.1-flash). Exactly ONE FRESH atenea-corrector-go-complex (opencode-go/deepseek-v4.1-flash), distinct fresh session from coordinator, no fallback or profile switch.
- The SINGLE mandatory Standards + Spec cycle ALREADY COMPLETED on full fixed candidate: Standards atenea-review-standards-go nan/mimo-v2.6-flash (4 minor); Spec atenea-review-spec-go openai/gpt-6-luna#high (7/7 compositions satisfied, SP1 about preparation/config scope). Both review sessions closed. NO re-review, no new reviewer and no reimplementation from scratch.
- This is F1 finding-scoped correction attempt 1 of maximum 2 under C-087. The writer phase of U7 is closed. All U1-U7 visual composition GO and protected domain/safety/output invariants stand. All accepted design-source HTML/CSS/JS and seven screenshots sets are immutable.
- If a test or original finding exposes a NEW material product/browser/support/acceptance conflict that the literal recipe cannot close, HUMAN STOP; do not reinterpret or expand scope and do not consume an extra correction without authorization.

## 1. Adjudication, no source mutation: SP1

SP1 alleged .opencode and Atenea documentation mutations outside the #91 writer scope. Cora confirms these mutations belong solely to the initial explicit preflight/preparation commit e831a69d0e5fced32f2fec2f8b34f04ffc01d03d, NOT to units U1-U7. Before execution repo authority required reconciled local agent bindings with Atenea C-087: 37/37 agent copies match byte-for-byte, revised Go binds match canonical, and current AGENTS.md/routing explicitly require this synchronization. Accepted as authorized preparation/provenance, not product defect and not an unauthorized writer change. NO edit, split, revert, agent sync, model promotion, config touch or added suite. The correction report closes SP1 by referencing this adjudication. The reviewer-labeled material classification is discharged as an authority/scope finding.

## 2. S1 — Introduced visual-versus-focus order, solve without changing DOM or mobile design

Exact cause: app-v4/src/review/ReviewWorkspace.tsx:484-594 contains one real grid, DOM order InspectorPane -> DocumentPane -> FilterProgressPane. app-v4/src/visual/sophilux-v1.css:597-600 visually puts single desktop Review into document/findings/inspector while <=1023px places inspector/document/findings. Batch CSS around 662-689 and Cells CSS around 764-789 do the same responsive composition, with different breakpoints. The real keyboard focus order currently follows source rather than responsive grid; focusability/decisions are otherwise intact.

PRESCRIBED single code edit: append to app-v4/src/visual/sophilux-v1.css after the existing U7 section a single scoped declaration block exactly:

/* CORA-91-F1 S1: keep native sequential focus in rendered grid row order. */
.sophilux-shell .sx-review-grid {
  reading-flow: grid-rows;
}

Do NOT reorder React children, change grid-template-areas, add tabIndex > 0, focus traps, duplicate responsive JSX, keyboard handlers, or alter the actual ReviewSession decisions/navigation. This CSS property is supported and was pre-probed READ-ONLY in the installed Playwright Chromium 1.62.1 browser with synthetic three-zone grid: real keyboard Tab from outside entered desktop [document, findings, inspector], mobile [inspector, document, findings] under the SAME CSS and source order. That probe is **not** proof of the V4 application or other browsers. Material closure REQUIRES one live production V4 focused E2E as below. Do not claim broad-browser or screen-reader conformance from Chromium evidence; if supported target browsers fail or unsupported CSS is materially relevant per authoritative support requirements, HUMAN STOP rather than claim S1 fully closed.

ONE focused E2E addition ONLY in e2e/review-productivity.spec.ts, named literally:
  test("CORA-91-F1 Review Tab order follows desktop and mobile visual panes", ...)

Use the existing synthetic buildHighVolumeText and actual Pegar texto -> Crear trabajo route. At 1440 and 375 viewports, assert CSS reading-flow computed as grid-rows and use real page.keyboard.press("Tab") to record the FIRST entrance of focus into each of the three live descendant zone classes sx-review-document, sx-review-findings, sx-review-inspector. Compare observed first-entrance sequence:
  1440: ["document", "findings", "inspector"]
  375: ["inspector", "document", "findings"]
Do not rely on direct programmatic focus of each pane or a DOM-only assertion; walk sequential Tab with a bounded loop after a deterministic starting focus outside the grid, and detect closest zone ancestor of document.activeElement. Assert existing real selected finding and session state remain unchanged by tab navigation. If the browser does not actually follow these sequences, STOP for Cora with observed order; no alternate hack. Actual CSS rule scopes also to nested Batch/Cells Review grids without modifying them; their approved mobile grid-template-areas remain as-is. Do not add full Batch/Cells test matrices by precaution.

Minimal designated F1 S1 check, exactly once on final candidate after production build:
  npx playwright test e2e/review-productivity.spec.ts --grep "CORA-91-F1 Review Tab order follows desktop and mobile visual panes" --workers=1

## 3. S2 — Sitebar help DOM focus order, literal move only

In app-v4/src/App.tsx at current 1007-1057, .sx-sitebar-context first renders exactly this native disclosure:

<details className="sx-session-help">
  <summary>Ayuda sobre las acciones de sesión</summary>
  <p id="session-actions-help">
    Nuevo trabajo inicia un trabajo nuevo y sustituye al actual. Borrar sesión descarta
    de forma deliberada todos los datos del trabajo en memoria, el estado de revisión y
    los borradores de esta sesión del navegador.
  </p>
</details>

CUT exactly this existing <details> block from its FIRST position in sx-sitebar-context and PASTE UNCHANGED as the LAST CHILD of that same .sx-sitebar-context, directly after the existing factual paragraph beginning "El procesamiento se ejecuta localmente..." and immediately before the closing context </div>. No other App.tsx change. Keep aria-describedby="session-actions-help" on Nuevo trabajo and Borrar sesión; do not alter their actions, identifiers, job/policy selection, title, or disclosure text. Preserve CSS .sx-session-help { order: 4; flex: 0 0 100%; ... } intact: visual last-row position remains, DOM and Tab finally agree.

ONE focused new E2E case ONLY in e2e/input-start.spec.ts, named literally:
  test("CORA-91-F1 session help follows policy in keyboard focus order", ...)

Use existing real synthetic example fixture, Pegar texto -> Crear trabajo, ensure live "Política de privacidad" combobox is ENABLED, focus it and press the actual keyboard Tab, assert focus on details.sx-session-help > summary (not hidden or skipped). If useful compare bounding boxes to ensure summary visually below policy at 375 and 1280, with same test scoped to these two widths. Preserve native summary open/close and no session state mutation. No new custom tabIndex.

Minimal S2 E2E once on final production candidate:
  npx playwright test e2e/input-start.spec.ts --grep "CORA-91-F1 session help follows policy in keyboard focus order" --workers=1

## 4. S3 — Evidence provenance, exactly one README edit

In docs/evidence/issue91-u1/README.md, add a short explicit "Files changed in U1" section, grounded in Git:
- app-v4/src/App.tsx (shell/input composition and later approved U1 visual correction).
- app-v4/src/main.tsx (same-origin Cormorant font imports and local Sophilux CSS import; present from initial U1 writer).
- app-v4/src/visual/sophilux-v1.css (scoped U1 style, then cumulative separate U2-U7 sections).
- app-v4/src/App.input-start.test.tsx (U1 V01 focused test).
- e2e/input-start.spec.ts (U1 V01/V02 focused E2E changes, later F1 S2 new witness).
- docs/evidence/issue91-u1/README.md and the existing viewport/fullPage captures (already enumerated below).
Relevant historical commits: 08a060c96d94502a960f6dc499fc3cea6b4a0b22, b2c945c6b611fda38e252a551614ad86c936b18d, fd71a5b215ff04e6a9d2312c045e84336aa88cca.
package.json and package-lock.json have NO diff in #91. Do not invent dependency changes or copy all screenshot paths twice. No new evidence file.

## 5. S4 — One obsolete CSS header comment, no style change

At app-v4/src/visual/sophilux-v1.css lines 1-11 only, replace the obsolete Unit-1-only wording with a short truthful statement: file was introduced for U1 and now includes bounded scoped styles for U2a Review, U3a Batch, U4 Structured, U5 Cells, U6 Privacy Gate, U7 Result. It remains a PRESENTATION-only stylesheet, scoped under .sophilux-shell and named task wrappers; approved design source is a REFERENCE not a license for mock states. Keep every CSS token and declaration beneath the header unchanged except S1's new three-line scoped rule. Do not change design tokens, fonts, imports or brand labels.

## 6. Single correction envelope, tests, return STOP

Writer/source allowlist EXACTLY:
  app-v4/src/visual/sophilux-v1.css
  app-v4/src/App.tsx
  e2e/review-productivity.spec.ts
  e2e/input-start.spec.ts
  docs/evidence/issue91-u1/README.md

No other code/test/docs path, no new screenshots/snapshots, no protected output/domain/state/PrivacyGate/review component/change of mockup, no AGENTS.md or .opencode mutations, no CI/release/deploy, no package modifications.

Implementer-corrector focused local typecheck and hygiene ONCE on final change:
  npm run typecheck:v4
  npm run format:check:v4
  git diff --check
Build current real production artifact ONCE before the two designated focused E2E:
  npm run build
Run ONLY the two individual --grep commands in sections 2 and 3 ONCE EACH, by coordinator after fixed candidate to preserve phase-scoped evidence. No full Vitest, generic Playwright, duplicated Standards/Spec, repeat U1-U7 screenshots or extra reviewer by default.
One single F1 correction commit, exact launch parent, clean tree, no amend/rebase.

Return READY_FOR_CORA_ISSUE91_F1_RECHECK with exact commit/parent/branch, diffstat, all five findings disposition (SP1 accepted, S1/S2 fixed only if actual focused browser evidence green, S3/S4 documented), full stdout/exit outcomes, browser version and any compatibility limitation, corrected focus sequences and real local actions/no changes. If a required test is red or unsupported browser support materially uncertain, STOP with observed narrow result, do not suppress/adjust the oracle to green. No push, PR, merge, deploy, global aesthetic work, qualification promotion or issue closure. Cora independently checks fixed candidate and then determines whether any second correction attempt is necessary before publication boundary.
