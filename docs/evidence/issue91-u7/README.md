# Issue #91 — U7 evidence: real Result composition

Candidate unit U7 (handoff
`docs/handoffs/ISSUE91_TANDA_C_GATE_RESULT_C087_GO_COMPLEX_20261013.md` §3,
U7.1–U7.3 only, plus the §0/§1/§4 invariants and safeguards; U1–U6 frozen
and untouched except the two prescribed App.tsx width OR-clauses).
Exact parent (docs-only U6-GO record, tree clean at dispatch):
`0cf818ba0c747f006e9d90b246c5e7e637a57dab`. Candidate SHA is reported in
the writer return (`git log --oneline -1` verifies it).
All captures are the **real V4 production build** (fresh `npm run build`
from the final tree, Vite dist served by `vite preview` on
`127.0.0.1:4191`) driven by a throwaway Playwright harness **outside the
repository** (`/tmp/opencode/u7-witness/u7-capture.mjs`, `node_modules`
symlinked). Nothing in the repository references that harness. No demo
sample, no runtime patch, no mock switching, no PHI: one synthetic
pasted-text job carrying the four known synthetic identifiers (DNI
12345678A, 600-123-456, paciente1@example.com, NHC 00442315) through the
genuine «Pegar texto» + «Crear trabajo» flow into the real local
classifier, real Review decisions through the genuine inspector (1
substitution `[DNI-REVISADO]`, 1 original kept with confirmation, 2
detections accepted; «Pendientes: 0» asserted) and one explicit
TaskActionBar «Ver resultado» transition into the real ready Result. No
count, policy, readiness or primary-action fact was hard-coded — the
harness throws on any material falsifier (non-ready state after full
review, non-Copy primary for the text material, hidden kept-original
warning, any Confidential download before Confirm, `scrollWidth >
innerWidth`, non-`visible` page overflow, non-zero `scrollY` before a
first-viewport capture).

## Populated state (asserted by the harness at capture time, both viewports)

- Ready Result: `data-result-state="ready"` (read from the live DOM after
  the review reported «Pendientes: 0» — never claimed from a badge alone),
  heading «Listo para usar» with the «RESULTADO» badge.
- Material-specific primary for the text material: exactly one
  `[data-variant="primary"]`, text **«Copiar texto preparado»** (no
  document-as-Copy confusion; document/batch/Structured primaries stay
  covered by the designated oracles, see below).
- Secondary Safe formats co-visible: «Descargar como TXT (.txt)»,
  «Descargar documento preparado (.docx)», «Descargar como PDF (.pdf)»,
  plus «Volver a la revisión».
- Kept-original warning co-visible in the Result context:
  «Originales conservados deliberadamente — Se conservó el texto original
  de tipo «IDENTIFICADOR» por una decisión de revisión.»
- Confidential Audit separation (exercised live, zero bytes downloaded):
  request «Descargar auditoría confidencial (.txt)» → confirmation group
  «Confirmación de descarga confidencial» («…correspondencia identificable
  y reversible…») with distinct «Confirmar descarga confidencial» /
  «Cancelar descarga confidencial»; request downloaded 0 artifacts, Cancel
  closed the confirmation and downloaded 0. Confirm was not executed here
  (the zero/one/zero download proof is the designated e2e's claim).
- Policy in use: **«Estándar»** (live header select value at capture time).
- Composition tokens present exactly once each at both widths:
  `.sx-result-task` ×1, `.sx-result-workspace` ×1.
- First-viewport frames: `window.scrollTo({top:0,left:0,behavior:"instant"})`
  executed and **`window.scrollY === 0` verified** immediately before every
  viewport capture (harness throws otherwise; recorded
  `scrollYBeforeViewport: 0` at both widths).

## Captures

| File | State | Viewport | fullPage | scrollY verified | scrollWidth / innerWidth | overflow-x html/body |
|---|---|---|---|---|---|---|
| `result-ready-1440-viewport.png` | ready | 1440×900 | false (first viewport) | 0 | 1440 / 1440 | visible / visible |
| `result-ready-1440-full.png` | ready | 1440×900 | true | — (full page) | 1440 / 1440 at capture base | visible / visible |
| `result-ready-375-viewport.png` | ready | 375×800 | false (first viewport) | 0 | 375 / 375 | visible / visible |
| `result-ready-375-full.png` | ready | 375×800 | true | — (full page) | 375 / 375 at capture base | visible / visible |

- `result-ready-1440-viewport.png` proves the first-viewport co-visibility
  required by §3.3: editorial «Resultado» header LEFT, «Listo para usar»
  state card RIGHT with the kept-original warning ABOVE the «Copiar texto
  preparado» primary — status + warning + CTA together with no conflict,
  so no restructuring was invented and no HUMAN STOP triggered.
- `result-ready-1440-full.png` proves the full desktop composition:
  two-column `sx-result-workspace` grid, secondary formats + return action,
  the visually isolated full-width Confidential Audit («INTERNO —
  Auditoría confidencial») below, then the policy guidance. No further
  content, no clipping.
- `result-ready-375-viewport.png` + `-full.png` prove the stacked order
  (header, state card with warning + primary, Confidential Audit, policy
  guidance) with the page staying within 375 px.
- Width invariant: `document.documentElement.scrollWidth <= innerWidth`
  asserted at both widths (1440/1440, 375/375). No global `overflow-x:
  hidden`/`clip` introduced — computed `overflow-x` on `html` and `body`
  remains `visible` everywhere; the no-overflow result is genuine fit.
- No fifth frame: document-DOCX-primary, needs-attention, blocked, batch,
  Structured and Confidential zero/one/zero carry no new visual claim from
  this unit — they are proved by the designated current oracles
  (`app-v4/src/export/ExportStep.test.tsx`, 38 tests incl. batch and async
  guards; `e2e/rec05-result.spec.ts` for document primary,
  needs-attention, kept-original-in-Safe-text, Confidential confirmation
  and PDF refusal). The only new visual claim (the §3.3 editorial grid and
  its first-viewport co-visibility) is fully witnessed above.

## Comparison vs approved source references

### 1440×900 vs `docs/design/sophilux-b-v1/previews/resultado-1440.png`

- Same identity and high-level hierarchy: editorial result header left,
  factual ready-state card right with the material-specific primary, output
  formats below, kept-original «last look» panel and a visually separated
  Confidential Audit — matching the reference's «Ahora sí. Con confianza.»
  + «Salida preparada» + «Tu última mirada» + «Auditoría confidencial»
  composition.
- Deliberate non-copy (per handoff/reconciliation D1–D4 + VF-06/VF-07/VF-08
  only): no universal «Copiar texto preparado» demo claim (the live Copy
  primary above is the real text-material primary asserted against the
  domain state), no fake seven-tab nav, no fake totals/certification, no
  invented Safe preview or policy badge.

### 375×800 vs `docs/design/sophilux-b-v1/previews/resultado-375.png`

- Same stacked identity: header first, then state card, then Confidential
  Audit — matching the reference's stacked order with no page-level
  overflow.
- Same deliberate non-copy as desktop: real ready facts only.

## Focused verification (real results, final tree)

- `npm run typecheck:v4` — PASS (both `tsconfig.json` and
  `tsconfig.node.json`, no output).
- `npx vitest run app-v4/src/export/ExportStep.test.tsx` —
  **38 passed (38)**.
- `npm run format:check:v4` — PASS
  (`All matched files use Prettier code style!`; the single
  `prettier --write` pass touched only the two allowlisted files whose
  long lines this unit added, verified clean before/after).
- `git diff --check` — clean.
- `npm run build` — PASS from the final tree (`✓ built in 13.02s`;
  chunk-size warning only, pre-existing); witnessed dist contains the
  `sx-result-task` / `sx-result-workspace` tokens in both the JS and CSS
  bundles.
- NOT run (per handoff, coordinator-owned): `npx playwright test
  e2e/rec05-result.spec.ts --grep "high-volume pasted text reaches one
  ready Result|a supported single document reaches a ready Result|a
  needs-attention Result states what remains|a deliberately kept original
  stays a factual Result warning|Confidential Audit first action"`. No
  broad/full suites. No existing test was modified.

Source diff note: `app-v4/src/App.tsx` carries exactly the two prescribed
width-condition OR-clauses (`|| currentStep === "export"`) plus the
`sx-result-task` wrapper around the existing `ExportStep` node in the
unchanged export render branch (all six props, guard and handler
identical; no TaskActionBar/route/state change);
`app-v4/src/export/ExportStep.tsx` carries exactly the three prescribed
return-root `sx-result-workspace` classes (StructuredExport root first
attribute; BatchResult and SingleItemResult roots first attribute,
`aria-labelledby` and `data-result-state` identical);
`app-v4/src/visual/sophilux-v1.css` appends only the literal U7 block
after the accepted U6 section (Prettier line-wraps two long selector
lists only; selectors and declarations identical to §3.3).

## Administration

- Model-role pairing: `atenea-implementer-go` =
  `opencode-go/muse-spark-1.3-contributor`.
- Token consumption: the runtime does not expose it — **explicitly
  unavailable**; no numbers fabricated.
- The revised Go bindings are a qualification CANDIDATE (Atenea PR #148);
  this bounded use does not by itself prove Go qualification or quality
  equivalence.

Harness provenance: `/tmp/opencode/u7-witness/` (outside the repo;
`node_modules` symlinked to the repo). Nothing in the repository references
it.
