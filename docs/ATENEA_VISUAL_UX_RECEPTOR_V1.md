# Atenea Visual/UX Receptor v1 — Laboratorio binding annex

Status: **CURRENT AUTHORITY for future Laboratorio Standard/Free units.** Created by the C-087 #152/#153 sync (2026-10-17) under `docs/handoffs/ATENEA_C087_153_FREE_STANDARD_VISUAL_SYNC_20261017.md` §3 as a **bounded integration annex**. It binds the upstream Visual/UX rules locally so future units don't depend on paths outside their worktree. It changes no product, privacy, clinical, domain or acceptance decision, and does not authorize any Train, ticket or UI implementation by itself.

## 1. Mandatory seven handoff fields

Every future Standard/Free handoff carries these fields. Cora + human fix them **before** launch.

| Field | Allowed values | Notes |
| --- | --- | --- |
| `Cost policy` | `standard` \| `free_only` \| `go` (or separately authorized experimental policy) | unmodified |
| `Risk class` | `volume` \| `complex` | binds writer/reviewer pair |
| `Implementation focus` | `technical` \| `visual` \| `mixed` | |
| `UI impact` | `none` \| `quality` \| `fidelity` | |
| `Visual authority` | `NONE`, accepted design rules for `quality`, or approved master PNG `path@sha256:<64hex>` for `fidelity` | Actual visual authority; not the render command |
| `Visual viewport/state` | `NONE` or `screen=<name>; viewport=<W>x<H>; state=<name>` | Comparable screen, exact viewport and interaction state |
| `Visual witness` | `NONE` or `render=<bounded-command>; output=<repo-relative-PNG>` | Produces the ACTUAL candidate screenshot; not the frozen master |

Validity rules:

- `Implementation focus: visual|mixed` ⇒ `UI impact: quality|fidelity`. `visual|mixed` with `none` is invalid.
- `technical` **may** still carry `quality|fidelity` when the accepted change alters rendered UI; `technical` + `none` is the ordinary backend case.
- `UI impact: none` ⇒ `Visual authority`, `Visual viewport/state` and `Visual witness` must all be `NONE`.
- Missing, absent or contradictory visual fields ⇒ `INCOMPLETE_AUTHORITY`; do not infer defaults.

## 2. Classification vs dispatch

- **Cora classifies before launch.** `Implementation focus`, `UI impact`, viewport/state and witness are accepted handoff content, not dispatcher choices.
- **The coordinator dispatches** only what the handoff already declares. No model-based or probabilistic reclassification, no auto-router.
- **Never reclassify an active Train mid-unit.** Bindings change only at a clean work-unit boundary.

## 3. Dispatch semantics

| `UI impact` | Visual reviewer | What must be compared |
| --- | --- | --- |
| `none` | none | no visual model; canonical Matt Standards + Spec only |
| `quality` | one, read-only | real candidate screenshot vs the **approved** project design/UX rules |
| `fidelity` | one, read-only | **frozen master PNG with real SHA256** + comparable real candidate screenshot |

When dispatched, the visual reviewer runs **once**, read-only, beside the canonical Matt Standards + Spec pair — not as an extra `/code-review`. Standards, Spec and Visual each run in their **own fresh session on the same fixed candidate/SHA**. Visual is an additional evidence axis, not a replacement or rerun, and visual PASS is never functional/Spec PASS.

Reviewer bindings:

- Standard: `atenea-review-visual-standard` — GPT-6 Luna High (`openai/gpt-6-luna#high`).
- Free: `atenea-review-visual-free` — Nemotron 3.5 Super VL Free (`opencode/nemotron-3.5-super-vl-free`).

## 4. Correction budget

Visual adds **no third corrective budget**. The existing maximum of **two fresh finding-scoped correction attempts shared across all axes per authorized work unit** still applies. Visual findings are aggregated with Standards/Spec findings into those same attempts. A corrected visual finding closes with **one focused screenshot of the repaired state**, not a second general visual review. Budget is per authorized work unit, not per Train and not per axis; never reset an exhausted repair by renaming or relaunching it.

## 5. Evidence, authority and privacy

- Implementer and reviewer must consume **real pixels**. Reading JSX/CSS/route/filenames, or a green unit-test count, alone ⇒ `INCOMPLETE_VISUAL_EVIDENCE`, never PASS.
- Missing authority, screenshot or viewport/state ⇒ `INCOMPLETE_AUTHORITY` / `INCOMPLETE_VISUAL_EVIDENCE` / HUMAN STOP as applicable. An image path in a prompt is not proof that pixels arrived.
- No agent invents product/design decisions. Any change to an accepted product/design choice ⇒ HUMAN STOP to Cora + human.
- Screenshots must be synthetic or sanitized; respect project privacy authority before sending images to a provider. If the provider cannot receive the image media, record `INCOMPLETE_VISUAL_EVIDENCE` for that profile — no fallback, no endpoint substitution.

## 6. Laboratorio visual authority (facts, not a redesign)

- Frozen master: `docs/design/sophilux-b-v1/laboratorio-sophilux-b-v1.html`, SHA256 `58cb8d414c0d842b6fd32bdbe5c9ccf4ad9d155b6317285dddf8b90ec7415774`.
- Contract: `docs/design/sophilux-b-v1/ACCEPTED_VISUAL_CONTRACT.md` (human-approved 2026-10-12).
- Reconciliation: `docs/design/sophilux-b-v1/SOPHILUX_B_V1_FUNCTIONAL_RECONCILIATION.md`, adaptations **D1–D4** and conditions **VF-01…VF-08**.
- Masters: `docs/design/sophilux-b-v1/previews/{entrada,revision,lote,estructurado,celdas,comprobacion,resultado}-{1440,375}.png`, checksums and viewports in `docs/design/sophilux-b-v1/visual-evidence-manifest.json`.
- **Caution:** the prototype's 375 px captures render at **413 px** width from a known header overflow. Fidelity means the approved composition plus an accessible adaptation **without** reproducing the HTML bug; do not demand the bug as visual truth.
- V0 evidence lives in a separate worktree under `.atl/issue92-v0-evidence-20261017/`; it must not be touched and is **not** human approval.
- Ticket state: #90/#91 CLOSED and not reopened, #92 open, #93 blocked. A sync never starts V1/V2/V3/C and never reinterprets the seven compositions as a stepper.

## 7. Upstream canonical documents

The canonical documents `docs/ATENEA_STANDARD_VISUAL_UX_ROUTING_V1.md` and `docs/ATENEA_FREE_VISUAL_UX_ROUTING_V1.md` are now **present in this Laboratorio worktree**, copied byte-identically from Atenea upstream SHA `13e07aaaedbeeb7d39d0c0a9d15ad03019423239`. Agents can read them repo-locally without permission to access a different worktree. This annex binds them to the established Laboratorio visual authority; it does not weaken them or silently adopt later, unrelated Atenea changes.

## 8. Future handoff templates (snippets)

`none` — **validated concrete example for a Standard technical-only unit** (Free requires its own explicit `Cost policy: free_only`):

```text
Cost policy: standard
Risk class: volume
Implementation focus: technical
UI impact: none
Visual authority: NONE
Visual viewport/state: NONE
Visual witness: NONE
```

`fidelity` — **validated concrete example for Entrada empty 1440×900 only**, not a universal placeholder to reuse for other screens:

```text
Cost policy: standard
Risk class: volume
Implementation focus: visual
UI impact: fidelity
Visual authority: docs/design/sophilux-b-v1/previews/entrada-1440.png@sha256:5d8f463b82690af2396d09264965b14045056a8675b0847c56ebd80cbc205f6a
Visual viewport/state: screen=entrada; viewport=1440x900; state=empty
Visual witness: render=npx playwright screenshot --viewport-size="1440,900" http://127.0.0.1:4180/ .atl/visual/entrada-empty-1440.png; output=.atl/visual/entrada-empty-1440.png
```

This syntactically validated capture recipe requires the **real product already built and served locally** at 127.0.0.1:4180 in the expected empty Entry state and an output directory prepared for the screenshot; it does not run a server, make a screenshot or authorize implementation. Before launch, the future handoff must identify an ACTUAL bounded browser journey for its own screen and state, rather than copying this example indiscriminately. The approved product contract `ACCEPTED_VISUAL_CONTRACT.md` and reconciliation D1–D4/VF-01…08 remain separate required authority. For `fidelity`, the `Visual authority` field must identify the actual approved PNG with SHA-256; the `Visual witness` field is the **browser screenshot recipe** and relative output, never the reference PNG. Validate each concrete new handoff with `node /srv/kairos-lab/Atenea/tools/check-standard-visual-handoff.mjs <handoff.md>` (or the Free equivalent) and verify real pixel transport when needed.
