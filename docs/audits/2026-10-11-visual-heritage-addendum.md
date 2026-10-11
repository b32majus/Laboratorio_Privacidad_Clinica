# Addendum — original visual heritage vs current V4 (2026-10-11)

> **Status: EVIDENCE ADDENDUM, not a new product authority or a new train.** Follows `2026-10-11-product-fidelity-freeze.md` without rewriting its time-stamped conclusions. Human aesthetic preference and final prominence choices remain subject to explicit sign-off. LOCAL_ONLY (not merged/pushed).

## References genuinely compared

- Historical V3: commit `331bcaf4a624659c77823a0c4b427d46347ea104`, archived without modifying canonical source; Chromium screenshots of `index.html`, `app.html`, `input.html` at **1280×800** from a localhost-only server. Captures: `docs/audits/evidence/product-freeze-20261011/legacy-index-1280.png`, `legacy-app-1280.png`, `legacy-input-1280.png`.
- Current V4 candidate: `7e9f7409dac531ddbf101fe708a302e3fbe6990f`, populated browser captures in the immediately preceding freeze: `01-input-1280.png`, `02-review-24-detections-1280.png`, `03-structured-32-cols-1280.png`, `04-batch-12-docs-1280.png`, `05-result-kept-original-1280.png`.
- The *historical landing hero image is externally sourced and did not render under the intentionally local-only/no-external-network capture*. The historical screenshot demonstrates its composition, typography, content alignment and local styling, **not** fidelity of the missing illustration. No claim is made about the unseen illustration.
- Source authority already acknowledged V3 in `docs/audits/2026-10-product-design-reconciliation-final.md` and September UX audit, especially aesthetic warm stone/Sophilux/rose/Inter and a restrained clinical workstation. But the freeze itself previously **lacked direct side-by-side rendered old↔new evidence**. This addendum closes that *evidence omission only*, not a design-completeness gate.

## Observed aesthetic heritage: real, not inferred from a token palette

| Source | Visually distinctive existing heritage | Current V4 visual relationship |
|---|---|---|
| V3 landing `index.html` | Warm spacious editorial hero; **Cormorant Garamond** as prominent literary headline; dusty-rose italic emphasis; well-spaced nav/brand mark, pill-shaped discreet calls to action, stone neutrals and purposeful asymmetry. | V4 Input uses warm/rose palette but operational Inter headings, mostly equally weighted bordered rectangular regions. Distinct brand typography/illustration/editorial rhythm from the historical landing is not represented in today's app. |
| V3 app entrance `app.html` | Centered Cormorant paired headline, rose-accent secondary line, ceremonial brand/title treatment, rich whitespace, prominent action, gentle dividing line. | V4 intentionally eliminated its extra entrance step: **do not reinstate the page**. Its identity vocabulary can inform the *branding* and non-work surfaces of the single-app shell, not become another mandatory pre-work hero. |
| V3 working `input.html` | Recognizable Sophilux rose/stone, generous input area and example navigation, readable single main action. Also inherited excessive permanent legal/upgrade banners and multipage fragmentation. | V4 has corrected much of the functional fragmentation and removed perpetual legacy friction; **do not revert**. However, the overall impression may now be visually generic despite matching palette variables. |
| V4 Review & Structured | No direct historical counterpart must dictate pane or grid geometry. Preserve clinical task hierarchy and actual material-specific behavior; impose heritage **stylistically**, not as obsolete workflow/layout. | #83's review is functional, #85's structured comparative representation remains mandatory. A branding patch cannot substitute for #85's absent interaction model. |

## What must be carried into final visual-system closeout (#91) as candidate heritage criteria

1. **Brand recognizability:** retain a deliberately Sophilux/Laboratorio mark and art direction, not merely the old rose hex code and generic application font. Compare the V3 editorial feeling and V4 working surface side by side.
2. **Typographic contrast used sparingly:** historical Cormorant/Inter pairing made headings memorable. Accepted October design **does not** require Cormorant for operational headings; use it, if chosen, in restrained brand/empty-state/marketing surfaces, keeping Inter for work and clear clinical labels.
3. **Warm stone and powder-rose tonal layering**, accessible darker rose for working buttons/focus. Rounded and outlined control treatments should have a consistent quality, not a flat undifferentiated card wall.
4. **Editorial rhythm without friction:** proportional whitespace and section hierarchy where useful, but no second landing, no endless brand hero within Review, no repetitive explanatory cards and no tiny work area. Dense professional tasks remain comfortably scannable.
5. **Marketing vs clinical origin distinction:** the historical public landing may remain a distinct editorial/information surface if that remains the user's desired deployment topology; the application must be recognizably from the same family but should optimize the human task. The project's existing #93 owns publication/origin separation, #91 visual coherence. No deployment claims from historical screenshots.
6. **Evidence, not taste by proxy:** at #91 compare a representative *heritage visual* against a populated V4 Input/Review/Structured/Batch/Result composition. Record **preserved, intentionally adapted, lost but accepted, or missing**. Human chooses degree of editorial expression before declaring visual-system complete.

## Immediate consequence and boundary

- Reframe final #91 acceptance as **a genuinely elegant and recognizably related Sophilux clinical workstation**, not simply “colors/token matches” or “functional tests green.”
- #85 still owns the urgent 32-column comparative grid and no-op structured Review removal; apply the already-accepted identity without preemptively adding an independent reskin train. #90 owns Spanish and accessible copy. #92 owns composed completeness, not taste/brand.
- **Do not** resurrect old screens, landing-as-prerequisite, upgrade banners, constant legal disclaimers, legacy workflows, unsafe contrast or old processing/security semantics.
- This addendum does **not** retroactively mean the 2026-10-11 freeze compared V3 screenshots. It explicitly records that the omission was discovered and corrected in a supplemental comparison.
- There is no new GitHub issue, no revised task priority and no code change. Human approval is still required before treating any **new specific** aesthetic choice as a binding design instruction.
