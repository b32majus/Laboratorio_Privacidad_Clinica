# Issue #91 — U5 evidence: real Structured free-text cells composition

Candidate unit U5 (handoff
`docs/handoffs/ISSUE91_TANDA_B_STRUCTURED_CELLS_C087_GO_COMPLEX_20261013.md` §3,
U5.1–U5.4 only, plus the §0/§1/§4 invariants and safeguards; U1/U2a/U3a/U4
frozen and untouched except the two prescribed App.tsx width OR-clauses).
All captures are the **real V4 production build** (fresh `npm run build`, Vite
dist served by `vite preview` on `127.0.0.1:4188`) driven by a throwaway
Playwright harness **outside the repository**
(`/tmp/opencode/u5-witness/u5-capture.mjs`, `node_modules` symlinked).
Nothing in the repository references that harness. No demo sample, no runtime
patch, no PHI: one synthetic 3-nonempty-text-cell CSV loaded through the
genuine file picker + «Crear trabajo» flow into the real structured
classifier, genuine reviewer configuration (`process-as-text` via the real
inspector select), real App routing to Review and the real «Procesar celdas
de texto libre» CTA. No cell count or readiness fact was hard-coded — the
harness throws unless the live UI reports exactly 3 cell sessions, and throws
unless the second selected cell shows its own source without leaking the
first cell's text.

## Fixture provenance and generation

- File (outside the repo, NOT committed): `/tmp/opencode/u5-witness/u5-cells.csv`.
- Hand-written 7-column CSV (same shape as the accepted composed contract):
  `NHC,DNI,Fecha_Visita,Fecha_Nacimiento,Centro,Diagnostico,Notas`, 3 data
  rows; the `Notas` column carries **3 genuine nonempty synthetic cells**
  with unique markers `alfa` (fila 1), `beta` (fila 2), `gamma` (fila 3);
  Spanish synthetic clinical content, no real identifiers.
- The plain-CSV single sheet goes straight to the real Configure comparison
  table (no sheet/header chooser: the workbook does not require it).

## Populated state (asserted by the harness at capture time, both viewports)

- Configure summary `role="status"` name «Datos de la configuración
  estructurada»: **«Columnas: 7 · Columnas que requieren revisión: 0 ·
  Exportación estructurada preparada: No»** — real classifier output after
  the genuine configuration (patient ID `NHC`, `Fecha_Visita → visit`,
  `Fecha_Nacimiento → birth`, `Notas → process-as-text`).
- `Notas` row reads **«Desconocido / Procesar como texto / tratamiento
  elegido / Sin pendientes»** — the reviewer-chosen effective action, not
  staged.
- Review progress `role="status"` name «Progreso de la revisión de texto
  libre»: **«Celdas: 3 · Decisiones pendientes: 3 · Celdas con error: 0 ·
  Revisión de texto libre preparada: No»** — 3 real cell sessions from the
  explicit run; no false ready, no fabricated session.
- Queue `navigation` «Celdas de texto libre»: exactly **3 buttons** —
  «Notas, fila 1/2/3», each «1 decisión pendiente» (real statuses).
- Fail-closed output preserved: the full-page captures show the factual
  block «La salida estructurada está bloqueada: 3 celdas de texto libre
  todavía requieren revisión; complete antes cada decisión obligatoria.»
- Canonical frame: `window.scrollTo({top:0,left:0,behavior:"instant"})`
  executed and **`window.scrollY === 0` verified** immediately before every
  first-viewport capture (harness throws otherwise; recorded
  `scrollYBeforeViewport: 0` at both widths).

## Operability (explicitly verified, both viewports)

- Cell selection: clicking «Notas, fila 1» renders «Revisando Notas, fila 1»
  with its live `ReviewWorkspace` whose «Documento» region contains the
  cell's own `alfa` text.
- Per-cell independence: selecting ANOTHER cell («Notas, fila 2») renders
  «Revisando Notas, fila 2» whose «Documento» region contains its own
  `beta` text and does NOT contain `alfa` (no prior-cell draft leak;
  harness throws otherwise).
- Return to Configurar: «Volver a preparar datos» lands back on the genuine
  Configure comparison table with domain decisions preserved (summary still
  «Columnas que requieren revisión: 0» after the return).
- Error states and the no-cells state are covered by the existing focused
  tests (`StructuredFreeTextReview.test.tsx`, 7 passed); no ceremonial
  captures for them here.
- Composition tokens present exactly once each at both widths:
  `.sx-cells-task`, `.sx-cells-workspace`, `.sx-cells-grid`,
  `.sx-cells-queue`, `.sx-cells-current`.

## Captures

| File | Viewport | fullPage | scrollY verified | scrollWidth / innerWidth | overflow-x html/body |
|---|---|---|---|---|---|
| `celdas-1440-viewport.png` | 1440×900 | false (first viewport) | 0 | 1440 / 1440 | visible / visible |
| `celdas-1440-full.png` | 1440×900 | true | — (full page) | 1440 / 1440 at capture base | visible / visible |
| `celdas-375-viewport.png` | 375×800 | false (first viewport) | 0 | 375 / 375 | visible / visible |
| `celdas-375-full.png` | 375×800 | true | — (full page) | 375 / 375 at capture base | visible / visible |

- `celdas-1440-viewport.png` proves: editorial «Revisión» title + truthful
  progress («Celdas: 3»), then the queue LEFT («Celdas», fila 2 selected
  with `aria-current` outline) with the actual selected cell Review RIGHT
  («Revisando Notas, fila 2», real FECHA 14/02/2023 detection pending,
  «Decisión actual: Pendiente»).
- `celdas-1440-full.png` proves the full desktop composition: queue +
  document/inspector/findings grid, real «Progreso»/«Filtros»/«Hallazgos»,
  the fail-closed block, «Volver a preparar datos», and no false onward
  ready.
- `celdas-375-viewport.png` + `-full.png` prove the stacked order: progress
  first, then the queue, then the active inspector/document/findings —
  page stays within 375 px.
- Width invariant: `document.documentElement.scrollWidth <= innerWidth`
  asserted at both widths (1440/1440, 375/375). No global `overflow-x:
  hidden`/`clip` introduced — computed `overflow-x` on `html` and `body`
  remains `visible` at both widths; the no-overflow result is genuine fit.

## Comparison vs approved source references

### 1440×900 vs `docs/design/sophilux-b-v1/previews/celdas-1440.png`

- Same identity and high-level layout: «Revisión» task title, truthful
  cell-queue panel left, active cell Review workspace right with
  document/inspector/findings — matching the reference's queue + active
  cell workstation.
- Deliberate non-copy (per handoff): no demo values, no fabricated
  sessions, no copied prototype copy; the screen shows the true 3-cell
  state with live «Decisiones pendientes: 3» facts and the fail-closed
  block.

### 375×800 vs `docs/design/sophilux-b-v1/previews/celdas-375.png`

- Same stacked identity: progress first, then the queue, then the active
  cell inspector/document/findings — matching the reference's stacked
  order with no page-level overflow.
- Same deliberate non-copy as desktop: real pending facts only.

## Focused verification (real results)

- `npm run typecheck:v4` — PASS (both `tsconfig.json` and
  `tsconfig.node.json`, no output).
- `npx vitest run app-v4/src/structured/StructuredFreeTextReview.test.tsx` —
  **7 passed (7)**.
- `npm run build` — PASS once before browser (`✓ built in 11.62s`;
  chunk-size warning only, pre-existing).
- `npm run format:check:v4` — PASS
  (`All matched files use Prettier code style!`).
- `git diff --check` — clean.
- NOT run (per handoff): `npx playwright test
  e2e/structured-composed.spec.ts` (coordinator witness), broad/full
  suites, `npm test`. No existing test was modified.

Source diff note: `app-v4/src/App.tsx` carries exactly the two prescribed
width-condition OR-clauses plus the `sx-cells-task` wrapper around the
existing `StructuredFreeTextReview` node (props/handlers untouched; no
wrapper on the `StepUnavailableState` fallback);
`app-v4/src/structured/StructuredFreeTextReview.tsx` carries exactly the
prescribed tokens/wrappers (`sx-cells-workspace`, `sx-cells-grid`,
`sx-cells-queue` on the existing nav, `sx-cells-current` with its two
closures; progress/rerun/errors/labels/states/callbacks/navigation
identical; `freeText === null` branch intact);
`app-v4/src/visual/sophilux-v1.css` appends only the literal U5 block after
the accepted U4 section (repo Prettier expands the three single-line grid
rules to multi-line; declarations identical).

Ordering note: typecheck, the focused vitest and the build ran on the
pre-`prettier --write` tree; the subsequent repo-formatter pass is proven
whitespace-only (`git diff -w` shows only the 8+8 prescribed TSX lines and
the 59-line CSS append), so those PASS results describe the candidate
semantics unchanged. `format:check` PASS and `git diff --check` clean were
verified on the final tree.

## Administration

- Model-role pairing: `atenea-implementer-go` =
  `opencode-go/muse-spark-1.3-contributor`.
- Token consumption: the runtime does not expose it — **explicitly
  unavailable**; no numbers fabricated.
- The revised Go bindings are a qualification CANDIDATE (Atenea PR #148);
  this bounded use does not by itself prove Go qualification or quality
  equivalence.

Harness provenance: `/tmp/opencode/u5-witness/` (outside the repo;
`node_modules` symlinked to the repo). Nothing in the repository references
it.
