# U1 — Sophilux B V1 Entry + application shell (issue #91, Train REC-11)

Unit 1 writer evidence. All captures are REAL Chromium screenshots of the
actual running V4 production build (`vite preview` of `npm run build:v4`),
using the maintained synthetic examples only — no PHI.

Updated by **CORA-91-U1-V01** (human-approved visual correction): secondary
session help and examples/clipboard guidance are now native closed-by-default
disclosures (`<details>`), Entrada uses `max-w-[1350px]`, and the previous four
single captures were renamed/replaced by the eight clearly-annotated captures
below (viewport vs full page, empty vs populated).

## Files changed in U1

Grounded in Git. U1 historical commits:
`08a060c96d94502a960f6dc499fc3cea6b4a0b22`,
`b2c945c6b611fda38e252a551614ad86c936b18d`,
`fd71a5b215ff04e6a9d2312c045e84336aa88cca`.

- `app-v4/src/App.tsx` — shell/input composition plus the later approved U1
  visual correction.
- `app-v4/src/main.tsx` — same-origin Cormorant font imports and the local
  Sophilux CSS import; present from the initial U1 writer.
- `app-v4/src/visual/sophilux-v1.css` — scoped U1 style, then cumulative
  separate U2–U7 sections.
- `app-v4/src/App.input-start.test.tsx` — U1 V01 focused test.
- `e2e/input-start.spec.ts` — U1 V01/V02 focused E2E changes, later the F1 S2
  new witness.
- `docs/evidence/issue91-u1/README.md` and the existing viewport/fullPage
  captures already enumerated below.

`package.json` and `package-lock.json` have **no diff** in #91.

## Screenshots (variant / viewport / frame annotated)

Every capture shows BOTH disclosures closed (`Ayuda sobre las acciones de
sesión` and `Ejemplos sintéticos y ayuda para pegar`); the populated variant
was produced by opening the disclosure, choosing the real synthetic example
`Ejemplo: consulta de urgencias`, and closing the disclosure again before the
shot.

| File | Frame | Variant | Viewport | Content |
|---|---|---|---|---|
| `entrada-vacia-1440-viewport.png` | **Primer viewport** | **Entrada vacía** (sin trabajo, borrador vacío) | 1440×900 | Editorial story a la izquierda, intake real a la derecha, borrador vacío, "Aún no hay trabajo"; `Crear trabajo` dentro del primer viewport |
| `entrada-vacia-1440-completa.png` | **Página completa** | **Entrada vacía** | 1440×900 | Ídem + guía "Uso previsto" y "Política de privacidad" por debajo de la tarea |
| `entrada-poblada-1440-viewport.png` | **Primer viewport** | **Entrada poblada** (ejemplo sintético `01-consulta-urgencias.json` elegido, desplegable vuelto a cerrar) | 1440×900 | Texto sintético real en el borrador; ningún trabajo creado |
| `entrada-poblada-1440-completa.png` | **Página completa** | **Entrada poblada** | 1440×900 | Ídem a página completa |
| `entrada-vacia-375-viewport.png` | **Primer viewport** | **Entrada vacía** | 375×800 | Identidad, controles y ayuda secundaria refluidos en columna |
| `entrada-vacia-375-completa.png` | **Página completa** | **Entrada vacía** | 375×800 | Flujo completo de tarea en columna, sin overflow |
| `entrada-poblada-375-viewport.png` | **Primer viewport** | **Entrada poblada** (ejemplo sintético elegido, desplegable cerrado) | 375×800 | Sin overflow, todos los controles visibles. Captura con window.scrollY = 0 después de cerrar el desplegable; muestra la cabecera y el comienzo de Entrada. El borrador poblado se acredita en la captura completa correspondiente. |
| `entrada-poblada-375-completa.png` | **Página completa** | **Entrada poblada** | 375×800 | Ídem a página completa |

## CORA-91-U1-V01 visual verdict (measured on the real app, this exact build)

- **Desktop 1440×900, Entrada vacía:** `Crear trabajo` `boundingBox` =
  `{x: 710.78, y: 829.42, width: 123, height: 41.5}` →
  `y + height = 870.92 ≤ 900` — **completamente dentro del viewport inicial**
  (antes de la corrección quedaba fuera).
- **Móvil 375 px (vacía y poblada):**
  `document.documentElement.scrollWidth = 375 ≤ window.innerWidth = 375` —
  sin overflow horizontal y sin recorte global (`overflow-x: hidden`/`clip`
  no se han añadido).
- Desplegables `details.sx-session-help` y `details.sx-intake-extras`
  **cerrados por defecto** en las ocho capturas (verificado por atributo
  `open` ausente al capturar).
- En poblada el borrador contiene el texto sintético real (292 caracteres) y
  el desplegable se cerró antes de capturar: abrir/cerrar nunca cambia el
  borrador ni crea trabajo.
- La jerarquía Sophilux B V1 se conserva: historia editorial junto a la tarea
  en escritorio, reflow en una columna en móvil; texto, archivos, acciones de
  sesión y CTA siguen operables (los E2E focalizados lo verifican).

## 375 px overflow verdict (VF-08)

Measured on the rendered document, no global clipping present (none added):

- `document.documentElement.scrollWidth` = **375** ≤ `window.innerWidth` = **375** (empty and populated)
- `document.body.scrollWidth` = **375** ≤ 375 (empty and populated)
- All real controls measured VISIBLE in both variants: textarea `#paste-text`,
  file input `#select-files`, `Crear trabajo`, `Nuevo trabajo`, `Borrar sesión`,
  policy select, entry heading "Nuevo trabajo de privacidad".
- The existing focused E2E witnesses also pass on this exact build:
  `e2e/input-start.spec.ts` "fits the viewport without horizontal overflow at
  375px/1280px" (shared `assertNoHorizontalOverflow`) and "primary
  add-information task is visible, reachable and ahead of guidance", plus the
  new CORA-91-U1-V01 witness "secondary examples help is closed by default
  and never affects the draft or the job".

## Focused writer proofs (final candidate bytes)

1. `npm run typecheck:v4` — PASS.
2. `npx vitest run app-v4/src/App.input-start.test.tsx` — PASS (25/25).
3. `npx playwright test e2e/input-start.spec.ts --workers=2` — PASS (14/14,
   including the new focused disclosure witness).
4. `npm run format:check:v4` — PASS.
5. `git diff --check` — clean.

## Comparison against approved previews (`previews/entrada-{1440,375}.png`)

Compositional hierarchy and identity (NOT pixel identity, no mock buttons):

**Kept from the approved composition (1440):**
- Sitebar: shield brand mark, serif brand name with light-weight second half,
  rose smallcaps sub-brand, honest context row, quiet rose pill actions.
- Two-column entry: editorial story LEFT (eyebrow "TRABAJA CON TRANQUILIDAD",
  big Cormorant display title with rose italic emphasis, intro copy, sage-check
  assurance row "Revisión humana / Trabajo local / Control sobre la salida",
  decorative gradient art block with italic caption), real intake card RIGHT
  ("NUEVO TRABAJO" smallcaps over serif card title, immediate real intake).
- Warm stone/cream canvas `#f7f5f2`, paper cards `#fffdfa`, rose-deep `#835852`
  purposeful CTA (Crear trabajo), Inter operational copy, semantic states.
- 375: story stacks above the card; CTA full task flow preserved — same order
  as the approved mobile reference.

**Adaptations for REAL V4 controls (functional authority outranks the demo):**
1. No demo mode switch ("Texto clínico" / "Archivos y tablas" tabs): both real
   intake sections (pegar texto + archivos) are always visible; text/file
   exclusivity remains enforced by the real creation authority, not hidden by
   a mock toggle.
2. Card title keeps the REAL accessible heading "Nuevo trabajo de privacidad"
   (test-anchored) under the "NUEVO TRABAJO" smallcaps; the demo's
   "¿Qué vamos a revisar?" is presentational mock copy and is not product
   authority.
3. No fake "Sesión nueva" chip: session truth comes from the real "Trabajo:"
   fact (here "Aún no hay trabajo") in the sitebar context.
4. Real synthetic examples (3 pills with real labels/actions) instead of the
   single "Usar ejemplo sintético" demo link; Pegar button + Ctrl+V fallback
   note kept as real controls; the examples sit above the textarea as in the
   approved hierarchy (draft-fill-only semantics unchanged).
5. Native file input remains a REAL input (`Choose Files` chrome label is
   browser UI locale, not product copy) with drag & drop on the same section;
   no "Simular archivo cargado" mock.
6. The real header keeps "Borrar sesión" (no demo equivalent) beside
   "Nuevo trabajo" with distinct semantics, titles and shared help text.
7. Intended-use/policy guidance ("Uso previsto", "Política de privacidad")
   remains real, below the primary task, restyled to the same paper family.
8. Font sizes raised where the prototype used <11px (sub-brand, pills) for
   accessible legibility, per the accepted contract's allowance.
