# Issue #91 — U3a evidence: real 12-document batch queue (Lote composition)

Candidate unit U3a (handoff `docs/handoffs/ISSUE91_TANDA_A_REVIEW_BATCH_C087_20261012.md` §3,
cost override `docs/handoffs/ISSUE91_U3A_GO_COMPLEX_COST_OVERRIDE_C087_20261013.md`).
All captures are the **real V4 production build** (fresh `npm run build`, Vite dist served by
`vite preview` on `127.0.0.1:4187`) driven by throwaway Playwright harnesses **outside the
repository** (`/tmp/opencode/u3a-witness/u3a-capture.mjs` + `u3a-focus.mjs`, `node_modules`
symlinked). Nothing in the repository references those harnesses. No demo sample, no runtime
patch, no PHI: 10 synthetic TXT buffers (same payload shape as the `e2e/batch.spec.ts` #86
orientation test: `DNI 12345678A` synthetic content) plus the two committed local fixtures
`app-v4/src/input/fixtures/corrupt.pdf` and `app-v4/src/input/fixtures/sample-scanned.pdf`
as genuine read failures.

## Populated state (asserted by the harness at capture time, both viewports)

- Fixture set: `synth-doc-01.txt` … `synth-doc-10.txt` (synthetic buffers) + `corrupt.pdf`
  (unparseable PDF) + `sample-scanned.pdf` (PDF without extractable text layer).
- Default filter on landing: **Necesitan atención (12)** with `aria-pressed="true"`;
  all filters live from current item state: `Todos (12)`, `Necesitan atención (12)`,
  `En curso (0)`, `Listos (0)`, `Retirados (0)`.
- Queue list `role="list" name="Estado de los documentos del lote"`: exactly **12 listitems**.
  Per-item status: all 10 synthetic rows `— Requiere revisión` (selectable session buttons);
  `corrupt.pdf — Error — No se pudo interpretar el archivo PDF "corrupt.pdf"; puede estar
  dañado o no ser un documento PDF válido.` and `sample-scanned.pdf — Error — El PDF no
  contiene texto extraíble: probablemente sea un escaneo o no tenga capa de texto.`,
  each offering only the truthful recovery actions **Retirar del lote** and
  **Reconocer error** (no retry: neither failure is domain-retryable, so retry stays gated).
- Selected document: `synth-doc-01.txt` carries `aria-current="true"`; its real
  `ReviewWorkspace` renders beside the queue (`Inspector del hallazgo` count across the
  whole page is exactly **1** — the active successful session's).
- Acknowledge/remove semantics untouched: removal still requires the explicit separate
  `Confirmar retirada` step; acknowledge only marks `Error reconocido` (covered by the
  passing `e2e/batch.spec.ts` #78/#86 journeys and the 28 Vitest cases, not re-proven here).
- Canonical frame: `window.scrollTo({top:0,left:0,behavior:"instant"})` executed and
  **`window.scrollY === 0` verified** immediately before every first-viewport capture
  (harness throws otherwise; recorded `scrollYBeforeViewport: 0` at both widths).

## Captures

| File | Viewport | fullPage | scrollY verified | scrollWidth / innerWidth | overflow-x html/body |
|---|---|---|---|---|---|
| `lote-1440-viewport.png` | 1440×900 | false (first viewport) | 0 | 1440 / 1440 | visible / visible |
| `lote-1440-full.png` | 1440×900 | true | — (full page) | 1440 / 1440 at capture base | visible / visible |
| `lote-375-viewport.png` | 375×800 | false (first viewport) | 0 | 375 / 375 | visible / visible |
| `lote-375-full.png` | 375×800 | true | — (full page) | 375 / 375 at capture base | visible / visible |
| `lote-375-failed-row.png` | 375×800 | false (focus frame) | — (scrolled focus) | 375 / 375 at capture base | visible / visible |

- `lote-1440-viewport.png` proves: queue panel LEFT (`Documentos`, live filters, 10 session
  rows + both error rows with name/status/error and recovery buttons — `corrupt.pdf` row
  fully in the first viewport, geometry `queueLeft 61 < currentLeft 518`) and the active
  successful document + contextual Review RIGHT (`Documento`, `Vista previa`,
  `Decisión actual` with `Aceptar detección` reachable).
- `lote-375-viewport.png` proves queue-first mobile: filters/counts/status reachable with
  no page horizontal overflow; the failed rows live below the fold at this width.
- `lote-375-failed-row.png` is the single allowed extra focus image (the 375 default
  viewport does not expose the error rows): both failed rows crisp with name, status,
  genuine error text and their `Retirar del lote` / `Reconocer error` actions.
- Width invariant: `document.documentElement.scrollWidth <= viewport width` asserted at both
  widths (1440/1440, 375/375). No global `overflow-x: hidden`/`clip` introduced — computed
  `overflow-x` on `html` and `body` remains `visible`; the no-overflow result is genuine fit.

## No fake Review for failed items (explicit proof)

Harness subtree queries inside each failed `listitem` (`corrupt.pdf`, `sample-scanned.pdf`):

- `role="list" name="Hallazgos"` count: **0** in both rows.
- `role="complementary" name="Inspector del hallazgo"` count: **0** in both rows.
- Buttons inside failed rows are exactly `Retirar del lote` + `Reconocer error`
  (recovery actions, not session selectors); the only `Inspector del hallazgo` on the page
  is the active successful document's (`synth-doc-01.txt`). Failed reads never synthesize
  a `ReviewSession`.

## Comparison vs approved source references

### 1440×900 vs `docs/design/sophilux-b-v1/previews/lote-1440.png`

- Same identity and high-level layout: left work-queue column (filters + per-document rows
  with status) and right selected-document + contextual decision area — matching the
  reference's "Cola de documentos | Documento seleccionado + Próxima acción".
- Deliberate non-copy (per handoff): the prototype's fake 7-demo-item world is NOT
  reproduced — no `07/03/02/02` stat cards, no `lote_consultas_octubre` fixture chip, no
  `Continuar revisión` / `Revisar documento` primary action, no `Ver resumen del lote` CTA,
  no demo filenames/statuses. The real queue shows the true 12-item state with live
  `Necesitan atención (12)` counts and the authorized current Review of the selected
  successful document.

### 375×800 vs `docs/design/sophilux-b-v1/previews/lote-375.png`

- Same queue-first identity: `Documentos` queue with reachable filters/counts first, the
  selected session's contextual Review below — matching the reference's stacked
  queue-then-selected-document order.
- Same deliberate non-copy as desktop: no fake 7-item demo queue, no stat cards, no
  `Ver resumen del lote` CTA. Within the current Review the ≤720px order renders
  `Decisión actual` before `Documento` (the U2a-accepted mobile inspector-first stacking),
  keeping the immediate decision reachable without an imaginary Review for error rows.

## Focused verification (real results)

- `npm run typecheck:v4` — PASS (both `tsconfig.json` and `tsconfig.node.json`, no output).
- `npx vitest run app-v4/src/review/BatchReviewView.test.tsx` — **28 passed (28)**.
- `npm run build` — PASS (`✓ built in 15.87s`; chunk-size warning only, pre-existing).
- `npx playwright test e2e/batch.spec.ts --grep "batch work-queue orientation|a failed batch item stays visible" --workers=2` — **2 passed (10.1s)** on the fresh production build.
- `npm run format:check:v4` — PASS (`All matched files use Prettier code style!`).
- `git diff --check` — clean.

Source diff note: `git diff -w` on the two TSX files is exactly the handoff-prescribed
wrappers (two width conditionals, `sx-batch-task` div, `sx-batch-review` root class,
`sx-batch-grid` / `sx-batch-queue` / `sx-batch-current` inserts); the larger raw diff is
Prettier re-indentation from the added nesting level plus two long-text reflows
(whitespace-only in rendered output). CSS block appended after the accepted U2a block with
Prettier normalization only (`.68fr`→`0.68fr`, one-line rules expanded; no
selector/property/value change).

## Administration

- Wall time: total implementer wall-clock was not instrumented — **explicitly unavailable**
  as a single number. Measured components: `npm run build` 15.87s, Vitest file 10.57s,
  Playwright pair 10.1s.
- Model-role pairing: `atenea-implementer-go` = `opencode-go/muse-spark-1.3-contributor`.
- Token consumption: the runtime does not expose it — **explicitly unavailable**; no numbers
  fabricated.
- The revised Go bindings are a qualification CANDIDATE (Atenea PR #148); this bounded use
  does not by itself prove Go qualification or quality equivalence.

Harness provenance: `/tmp/opencode/u3a-witness/` (outside the repo; `node_modules`
symlinked to the repo). Nothing in the repository references it.
