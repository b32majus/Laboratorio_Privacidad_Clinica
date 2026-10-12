# Issue #91 — U2a evidence: real single-document Review (Sophilux composition)

Candidate unit U2a (handoff `docs/handoffs/ISSUE91_TANDA_A_REVIEW_BATCH_C087_20261012.md` §2).
All captures are the **real V4 production build** (`npm run build:v4`, Vite dist served by
`vite preview`) driven by a throwaway Playwright harness **outside the repository** that
imports the existing fixture `buildHighVolumeText` from `e2e/harness/flows.ts`.
No demo sample, no runtime patch, no PHI (fixture is synthetic: DNIs `12345670A`…,
phones `600-123-45x`, `pacienteN@example.com`, NHC `0044231x`).

## Populated state (verified by assertions in the harness, both viewports)

- Job created from the textarea "Pegar texto" + button **"Crear trabajo"** (no demo sample).
- Progress `role="status" aria-label="Progreso de la revisión"`: **Total: 24**, **Pendientes: 24**
  (24 genuine detections from `buildHighVolumeText`; nothing pre-decided).
- Inspector `role="complementary" name="Inspector del hallazgo"` visible;
  selection source **Original 12345670A**; decision **Pendiente**;
  document group **"Texto del documento con hallazgos"** present.
- First-decision reachability: **"Aceptar detección"** and the current-original readout are
  fully in the first viewport (`toBeInViewport({ ratio: 1 })`) at 1440×900 **and** 375×800.
- Canonical frame: `window.scrollTo({top:0,left:0,behavior:"instant"})` executed and
  **`window.scrollY === 0` verified** immediately before every first-viewport capture.

## Captures

| File | Viewport | fullPage | scrollY verified | scrollWidth / innerWidth | overflow-x |
|---|---|---|---|---|---|
| `review-1440-viewport.png` | 1440×900 | false (first viewport) | 0 | 1440 / 1440 | visible (no hidden/clip) |
| `review-1440-full.png` | 1440×900 | true | — (full page) | 1440 / 1440 at capture base | visible |
| `review-375-viewport.png` | 375×800 | false (first viewport) | 0 | 375 / 375 | visible (no hidden/clip) |
| `review-375-full.png` | 375×800 | true | — (full page) | 375 / 375 at capture base | visible |

Width invariant: `document.documentElement.scrollWidth <= viewport width` asserted for both
viewports (1440 and 375). No global `overflow-x: hidden`/`clip` was introduced — the computed
`overflow-x` on `html`/`body` remains `visible`; the no-overflow result is genuine layout fit.

## Comparison vs approved source references

### 1440×900 vs `docs/design/sophilux-b-v1/previews/revision-1440.png`

- Same approved three-area composition: **Documento** prominent on the left (widest track,
  1.48fr), **Progreso/Filtros/Hallazgos** compact in the center, **Decisión actual** contextual
  on the right — mirroring the reference's "Documento original | Hallazgos | Decisión actual".
- Editorial serif heading at top ("Revisión", clamp(32px, 3.5vw, 46px), Sophilux ink/serif),
  matching the reference's large editorial heading treatment.
- Sitebar brand identity matches the reference ("Laboratorio de Privacidad Clínica /
  CLÍNICA · SOPHILUX" with the shield mark). The reference's top strip
  ("PROTOTIPO VISUAL V1" + section nav 01–07) is prototype-only chrome and is intentionally
  absent from the real application.
- First task + decision: in the real app the first finding (12345670A) is selected,
  "Propuesta: eliminar este dato" and **"Aceptar detección"** are immediately visible and
  clickable in the first viewport — actual first-decision reachability confirmed, equivalent
  to the reference's right-hand decision column.
- Content differences are the expected prototype-vs-real ones: the reference shows demo data
  ("María [EJEMPLO]", 0 de 5 decisiones); the real app shows the true 24-finding synthetic job
  with factual counts (Total 24 / Pendientes 24 / Decididos 0).

### 375×800 vs `docs/design/sophilux-b-v1/previews/revision-375.png`

**Documented precise difference (expected, per handoff §2 Result):** the approved mobile
reference stacks **Documento original → Hallazgos → Decisión actual last**. With the real
24-finding fixture that hierarchy would displace the immediate decision behind a long
24-row scroll, which the handoff explicitly forbids ("do NOT copy the prototype mobile
inspector-last hierarchy when it defeats current first-decision accessibility"). The U2a
composition therefore stacks, at ≤1023px: **Decisión actual (inspector) → Documento →
Progreso/Filtros → Hallazgos**. The result: "Aceptar detección" and the current decision are
fully visible and operable in the first mobile viewport (`toBeInViewport ratio 1` asserted),
while the full 24-row findings list remains reachable below (`review-375-full.png`).

No semantics, callbacks, keyboard routes or prior E2E expectations were altered to achieve
this; it is purely the scoped CSS `grid-template-areas` order in the ≤1023px media query.

## Focused verification (real results)

- `npm run typecheck:v4` — PASS
- `npx vitest run app-v4/src/review/ReviewWorkspace.test.tsx` — 72 passed (72), including the
  Cora-authorized test-only correction (line 1274: `lg:grid-cols-3` → `sx-review-grid`)
- `npx playwright test e2e/review-productivity.spec.ts --workers=2` — 2 passed (375×800, 1280×800)
- `npm run format:check:v4` — PASS (after Prettier normalization of the appended CSS block:
  `.73fr`→`0.73fr`, one-line rules expanded; no selector/property/value changed)
- `git diff --check` — clean

Harness provenance: throwaway config + spec at `/tmp/opencode/u2a-witness/` (outside the repo;
`node_modules` symlinked to the repo). Nothing in the repository references it.
