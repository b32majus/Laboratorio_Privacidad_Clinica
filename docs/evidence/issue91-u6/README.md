# Issue #91 — U6 evidence: optional factual Privacy Check composition

Candidate unit U6 (handoff
`docs/handoffs/ISSUE91_TANDA_C_GATE_RESULT_C087_GO_COMPLEX_20261013.md` §2,
U6.1–U6.4 only, plus the §0/§1/§4 invariants and safeguards; U1–U5
frozen and untouched except the two prescribed App.tsx width OR-clauses).
All captures are the **real V4 production build** (fresh `npm run build` from
the final tree, Vite dist served by `vite preview` on `127.0.0.1:4190`)
driven by a throwaway Playwright harness **outside the repository**
(`/tmp/opencode/u6-witness/u6-capture.mjs`, `node_modules` symlinked).
Nothing in the repository references that harness. No demo sample, no runtime
patch, no mock switching, no PHI: one synthetic pasted-text job carrying the
four known synthetic identifiers (DNI 12345678A, 600-123-456,
paciente1@example.com, NHC 00442315) through the genuine «Pegar texto» +
«Crear trabajo» flow into the real local classifier, real Review decisions
through the genuine inspector (1 substitution edited, 1 original kept with
confirmation, 2 detections accepted) and real TaskActionBar navigation to the
optional «Comprobación de privacidad». No count, policy or readiness fact was
hard-coded — the harness throws unless the live UI reports exactly 4 finding
buttons, throws on any material falsifier (pending claiming ready, hidden
warnings, `scrollWidth > innerWidth`, non-`visible` page overflow), and both
states below were reached without leaving the genuine flow.

## Populated states (asserted by the harness at capture time, both viewports)

- Pending Gate (first genuinely reachable optional Gate): checkpoint badge
  **«NECESITA ATENCIÓN»**, body «Todavía quedan 4 decisiones de revisión
  obligatorias (abajo) antes de que confíe en esta revisión.»; `role="alert"`
  «La descarga segura está bloqueada mientras 4 decisiones de revisión
  obligatorias están pendientes.»; availability facts «Política de privacidad
  usada: Estándar · Salida segura: No preparada · Auditoría confidencial:
  Disponible».
- Policy in use: **«Estándar»** (live header select value at capture time).
- Available onward action while pending: **«Volver a la revisión»** (visible)
  and «Ir al resultado» present but **disabled** — the domain rejects the
  result step, so it is not offered as enabled; no fake ready toggle, no
  always-enabled next button.
- Completed Gate (same job after genuine decisions, no mock switching):
  checkpoint badge **«PREPARADO»**, body «Todas las decisiones de revisión
  obligatorias están registradas. La salida segura está preparada para
  descargar en el paso Resultado.»; review summary «2 aceptados,
  1 modificados»; attention-facts list «Avisos de originales conservados»
  visible with the factual kept-original item
  («kept-original — Original conservado — IDENTIFICADOR: el texto original se
  conservó deliberadamente por decisión del revisor (restaurado).»);
  «Ir al resultado» **enabled**.
- Composition tokens present exactly once each at both widths and both
  states: `.sx-gate-task`, `.sx-gate-workspace`, `.sx-gate-checkpoint`.
- Canonical frames: `window.scrollTo({top:0,left:0,behavior:"instant"})`
  executed and **`window.scrollY === 0` verified** immediately before every
  first-viewport capture (harness throws otherwise; recorded
  `scrollYBeforeViewport: 0` at both widths).

## Captures

| File | State | Viewport | fullPage | scrollY verified | scrollWidth / innerWidth | overflow-x html/body |
|---|---|---|---|---|---|---|
| `gate-pending-1440-viewport.png` | pending | 1440×900 | false (first viewport) | 0 | 1440 / 1440 | visible / visible |
| `gate-pending-1440-full.png` | pending | 1440×900 | true | — (full page) | 1440 / 1440 at capture base | visible / visible |
| `gate-pending-375-viewport.png` | pending | 375×800 | false (first viewport) | 0 | 375 / 375 | visible / visible |
| `gate-pending-375-full.png` | pending | 375×800 | true | — (full page) | 375 / 375 at capture base | visible / visible |
| `gate-ready-1440-full.png` | completed | 1440×900 | true | — (full page) | 1440 / 1440 at capture base | visible / visible |
| `gate-ready-375-full.png` | completed | 375×800 | true | — (full page) | 375 / 375 at capture base | visible / visible |

- `gate-pending-1440-viewport.png` proves: editorial «Comprobación de
  privacidad» header LEFT with the «Punto de control de la decisión»
  checkpoint RIGHT (two-column `sx-gate-workspace` grid), the factual
  blocked alert, availability facts («No preparada»), and the honest
  blocked onward state («Ir al resultado» muted/disabled, «Volver a la
  revisión» available).
- `gate-pending-1440-full.png` proves the full desktop composition with no
  further content below the policy guidance (single-screen gate).
- `gate-pending-375-viewport.png` + `-full.png` prove the stacked order
  (header, then checkpoint, alert, availability) with the page staying
  within 375 px.
- `gate-ready-1440-full.png` / `gate-ready-375-full.png` prove blocked-vs-ready
  visually: «PREPARADO» checkpoint, «Salida segura: Preparada», the
  «Resumen de la revisión» facts, the co-visible kept-original warning and
  the enabled «Ir al resultado». Ready is never claimed from a visual badge
  alone — the harness asserted the underlying «Pendientes: 0» review fact
  before capturing.
- Width invariant: `document.documentElement.scrollWidth <= innerWidth`
  asserted at both widths in both states (1440/1440, 375/375). No global
  `overflow-x: hidden`/`clip` introduced — computed `overflow-x` on `html`
  and `body` remains `visible` everywhere; the no-overflow result is genuine
  fit.

## Comparison vs approved source references

### 1440×900 vs `docs/design/sophilux-b-v1/previews/comprobacion-1440.png`

- Same identity and high-level hierarchy: editorial gate header left, factual
  state checkpoint right — matching the reference's header + «ESTADO ACTUAL»
  composition.
- Deliberate non-copy (per handoff/reconciliation D4 + VF-06): no
  «Ejemplo listo / Ejemplo bloqueado» toggle, no fixed «Estándar» demo
  policy claim (the live «Estándar» above is the job's real policy), no
  «Continuar al resultado» demo CTA (the real onward action stays
  domain-governed and disabled while blocked), no seven-tab navigation.

### 375×800 vs `docs/design/sophilux-b-v1/previews/comprobacion-375.png`

- Same stacked identity: header first, then checkpoint, then alert and
  availability — matching the reference's stacked order with no page-level
  overflow.
- Same deliberate non-copy as desktop: real pending/ready facts only.

## Focused verification (real results)

- `npm run typecheck:v4` — PASS (both `tsconfig.json` and
  `tsconfig.node.json`, no output).
- `npx vitest run app-v4/src/privacy-gate/PrivacyGate.test.tsx` —
  **30 passed (30)**.
- `npm run build` — PASS from the final tree (`✓ built in 16.93s`;
  chunk-size warning only, pre-existing); witnessed dist contains the
  `sx-gate-task` / `sx-gate-workspace` / `sx-gate-checkpoint` tokens in both
  the JS and CSS bundles.
- `npm run format:check:v4` — PASS
  (`All matched files use Prettier code style!`).
- `git diff --check` — clean.
- NOT run (per handoff, coordinator-owned): `npx playwright test
  e2e/gate-export-ux.spec.ts --grep "Gate and Export fit the viewport
  without horizontal overflow"`. No broad/full suites. No existing test was
  modified.

Source diff note: `app-v4/src/App.tsx` carries exactly the two prescribed
width-condition OR-clauses (`|| currentStep === "privacy-gate"`) plus the
`sx-gate-task` wrapper around the existing `PrivacyGate` node in the
unchanged privacy-gate render branch (props/guards/keys identical; no
TaskActionBar/route/state change); `app-v4/src/privacy-gate/PrivacyGate.tsx`
carries exactly the ROOT `sx-gate-workspace` class and the prepended
`sx-gate-checkpoint` token in helper `GateCheckpoint` only
(`derivePrivacyGateView`, readiness, policy/counts, warnings and error state
identical); `app-v4/src/visual/sophilux-v1.css` appends only the literal U6
block after the accepted U5 section (Prettier reports it unchanged).

Ordering note: the first build + capture ran on the pre-`prettier --write`
tree; the formatter pass touched only `App.tsx` JSX indentation
(whitespace-only — both width ternaries now share the identical prescribed
form). The tree was then rebuilt fresh and the full harness recaptured
against that final dist, so the committed PNGs witness the final candidate.
Typecheck, the focused vitest, `format:check` and `git diff --check` were
verified on the final tree.

## Administration

- Model-role pairing: `atenea-implementer-go` =
  `opencode-go/muse-spark-1.3-contributor`.
- Token consumption: the runtime does not expose it — **explicitly
  unavailable**; no numbers fabricated.
- The revised Go bindings are a qualification CANDIDATE (Atenea PR #148);
  this bounded use does not by itself prove Go qualification or quality
  equivalence.

Harness provenance: `/tmp/opencode/u6-witness/` (outside the repo;
`node_modules` symlinked to the repo). Nothing in the repository references
it.
