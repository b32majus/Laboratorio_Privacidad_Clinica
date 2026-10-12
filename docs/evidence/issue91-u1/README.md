# U1 — Sophilux B V1 Entry + application shell (issue #91, Train REC-11)

Unit 1 writer evidence. All captures are REAL Chromium screenshots of the
actual running V4 production build (`vite preview` of `npm run build:v4`),
using the maintained synthetic examples only — no PHI.

## Screenshots (variant / viewport annotated)

| File | Variant | Viewport | Content |
|---|---|---|---|
| `entrada-vacia-1440.png` | **Entrada vacía** (sin trabajo, borrador vacío) | 1440×900 | Editorial story a la izquierda, intake real a la derecha, borrador vacío, "Aún no hay trabajo" |
| `entrada-poblada-1440.png` | **Entrada poblada** (borrador rellenado eligiendo el ejemplo sintético "Ejemplo: consulta de urgencias") | 1440×900 | Mismo texto sintético del JSON `ejemplos/01-consulta-urgencias.json` en el borrador; ningún trabajo creado |
| `entrada-vacia-375.png` | **Entrada vacía** | 375×800 | Identidad, controles y CTA refluidos en columna |
| `entrada-poblada-375.png` | **Entrada poblada** (ejemplo sintético elegido) | 375×800 | Sin overflow, todos los controles visibles |

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
  add-information task is visible, reachable and ahead of guidance".

## Focused writer proofs (final candidate bytes)

1. `npm run typecheck:v4` — PASS.
2. `npx vitest run app-v4/src/App.input-start.test.tsx` — PASS (25/25).
3. `npx playwright test e2e/input-start.spec.ts --workers=2` — PASS (13/13).

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
