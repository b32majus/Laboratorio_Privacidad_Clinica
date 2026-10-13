# Laboratorio V4 — Sophilux B · Visual identity V1 ACCEPTED

> **HUMAN APPROVED — 2026-10-12.** The product owner expressly accepted the seven-screen HTML/CSS proposal: “mis 10 amiga, lo tenemos”, then authorized continuing with its versioning and implementation handoff. This approval **supersedes the historical “NO CONGELADO” labels inside the original V1 README/contract**, which remain unchanged and byte-identical for provenance. This is a VISUAL/COMPOSITION authority, not a change to privacy, domain, clinical rules, state machines, export permissions or job type flow.

## Authoritative frozen artifacts

This directory is the **source of truth for visual intent**:

- `index.html`, `styles.css`, `app.js`: exact approved standalone-source set (presentational demonstration, offline; no real patient processing).
- `laboratorio-sophilux-b-v1.html`: identical self-contained approved single-file demonstration.
- `previews/{entrada,revision,lote,estructurado,celdas,comprobacion,resultado}-{1440,375}.png`: repeatable desktop/mobile rendered references. `visual-evidence-manifest.json` records exact screenshot checksums, viewport and discrepancies. The preview bar with seven tabs is **review instrumentation only** and is never product navigation.
- `README.md` and `CONTRATO_VISUAL_BORRADOR.md` are ORIGINAL source-package documents and retain their pre-acceptance historical wording; **this document records the subsequent human acceptance**.

Source SHA256 manifest:

| Source | SHA256 |
|---|---|
| `laboratorio-sophilux-b-v1.html` | `58cb8d414c0d842b6fd32bdbe5c9ccf4ad9d155b6317285dddf8b90ec7415774` |
| `index.html` | `7bce930caa7f7fe17061f5d191c03c032c30bbd089d55a569a40e4e868d5dd09` |
| `styles.css` | `34494b376bc5ba89c58c6e4d0f32c23bdc22873a62b5b252103d6cae037a3bd3` |
| `app.js` | `bee7588c076a94514acccede7ed0788201cc79e5140683c85e7dbe5460c77be6` |

## Approved system, not optional “moodboard”

**Sophilux editorial B:** Cormorant Garamond for expressive identity/titles (especially Entrada and Resultado), Inter for operational copy, data tables, controls, warnings and labels; warm cream/stone surfaces, powder rose identity, accessible dark-rose actions, clear light separators, careful rhythm, confident spaciousness where it helps and **task density where it matters**.

Reference tokens in `styles.css`:

| Role | Token | Reference |
|---|---|---|
| Canvas | `--canvas` | `#f7f5f2` |
| Paper | `--paper` | `#fffdfa` |
| Rose | `--rose` | `#ba8d83` |
| Action rose | `--rose-deep` | `#835852` |
| Text | `--ink` | `#252b30` |
| Border | `--line` | `#e9e3de` |
| Ready/success | `--sage` | `#467367` |
| Danger | `--red` | `#943f49` |

The exact CSS values are reference targets but may require accessible adjustments in production; no state is indicated by color alone. Local font files already held in Laboratorio can be reused in implementation; this artifact **must not be treated as a font distribution**.

## Approved composition, by the seven screens

| View | Frozen composition | Real product invariant / consumer |
|---|---|---|
| **Entrada** | Editorial Sophilux identity and direct input side by side on desktop; real text/files CTA immediately available, contextual policy disclosure | No mandatory introduction page, no repeated guides, clear primary create action, real file/text exclusivity |
| **Revisión** | Document prominent, findings list compact, contextual decision inspector; progress subordinate | No automatic acceptance; selected finding/evidence and decision remain coherent after every action |
| **Lote** | One queue with attention/status filters, selected document and contextual actions; failure differentiated | Per-item errors and recoverability, no loss of other successful items |
| **Estructurado** | Comparative four-field table, contextual inspector, single patient-ID authority, blockers/next action evident | Retain #85 domain semantics, date roles, Study-ID, readiness and user review |
| **Texto libre estructurado** | Cell list, working context and cell decision inspector only when routed to free text | Do not create a no-op Review for jobs without `process-as-text` |
| **Comprobación** | Factual gate/readiness composition, meaningful next action and honest blocked state | Never present a route to an unavailable step or unauthorized output |
| **Resultado** | Editorial closing, clearly differentiated result state + contextual primary, output preview and visually isolated Confidential Audit | Ready/needs-attention/blocked distinctions, kept-original warning, material-specific primary, separate explicit Confidential authorization |

**Explicitly not frozen as product behavior:** seven-tab black prototype selector, sample document data, mock numeric progress, form/button simulation, hardcoded navigation order, simulated toggles, synthetic readiness, fake downloads, faux policy mapping. Those belong only to the demonstrator. Do not adopt any mock action as clinical or privacy authority, and do not turn this into a new static product page.

## Responsive reference and one real known defect

**Desktop composition is witnessed at 1440×900.** Mobile references use a 375px browser. During independent rerender of the byte-identical source, **document-wide scroll width reached 413px on 375px** due to the demo's header/brand/actions sizing. The originally generated mobile screenshots did not constitute a full no-overflow proof.

This is a **known responsive fit debt assigned to #91**, not grounds to undo human aesthetic acceptance, add a new product Train, or silently edit approved V1 source. #91 shall preserve the same identity while ensuring `document.documentElement.scrollWidth <= viewportWidth` in the real application, where only the Structured table's own explicitly labeled region may scroll horizontally. The prototype source has intentionally remained byte-identical and its evidence records the defect rather than pretending PASS.

## Ratified visual–functional companion authority (2026-10-12)

The product owner approved **D1–D4 and VF-01…VF-08** in the [functional reconciliation](SOPHILUX_B_V1_FUNCTIONAL_RECONCILIATION.md). Read it alongside this accepted visual contract: it maps these seven compositions to real V4 capabilities, errors, status and onward actions without copying any simulated behavior. The original approved HTML/CSS/JS is **unchanged**. No domain or privacy permissions change, and #90/#91 **have not been launched**.

## Implementation and C-087 handoff boundaries

- **#90** remains the exhaustive professional Spanish pass. Use the accepted screen context and visual microcopy tone, but preserve canonical domain/status semantics, technical IDs and any existing fail-closed alerts. Translation must not introduce false equivalence.
- **#91** is the actual implementation of the approved visual system across Input/Review/Batch/Structured/free-text/Gate/Result, with early *populated* whole-screen witness whenever a materially changed screen first runs. Comparison should reference these seven views and existing historical V3 screenshots; do not restart aesthetic exploration or independently redesign.
- **#92** remains final source-to-authority traceability, privacy and composed E2E across materials; HTML demo cannot substitute.
- **Atenea current C-087**, including light preparation and prescriptive corrections, remains the execution protocol. Review only material gaps and actual affected consumers; do not run a new exhaustive pre-design audit merely because identity is now frozen.

**Authority hierarchy:** approved functional/clinical/security contracts in `docs/HUMAN_PRODUCT_DESIGN_AUTHORITY_V1.md` and domain remain superior to mock behavior. This new *visual* contract supersedes tentative visual wording only. A material incompatibility between visual layout and legitimate task completion merits HUMAN STOP with exact evidence; not autonomous re-interpretation of the design.

## Freeze/publication record

- Product fixed base for this visual-only document integration: `origin/3.0-main@2f6e2b944fe6d1b518e2f7f5726fe2fae7b522e1` (post-#85 PR #116).
- The screenshot host and reviewer toolbar are local visualization mechanisms only; not deployed.
- All committed paths are under `docs/`; the operational V4 code, tests, agents, runtime, CI and domain are unaffected.
- **Human approval: complete.** This freeze does not itself authorize new #90/#91 Train execution or production deployment.

## Adenda de fidelidad de implementación (2026-10-14)

El maestro de 2026-10-12 **sigue congelado y no se modifica**. Tras comparar la herramienta mostrada con el HTML aprobado, la responsable detectó divergencias materiales de composición en Entrada y Revisión. El estado, procedencia, distinción entre desviación observada y nueva preferencia posterior, y prioridad de #92 antes de una recomposición UX están registrados en [IMPLEMENTATION_FIDELITY_REGISTER_20261014.md](IMPLEMENTATION_FIDELITY_REGISTER_20261014.md). Esta nota **no** reabre #91, no aprueba una nueva maqueta y no acredita ningún cambio funcional.
