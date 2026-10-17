# Atenea Free — conditional visual implementation and Visual/UX review v1

Status: **HUMAN-APPROVED FREE-ONLY CAPABILITY CONTRACT — 2026-10-17**
Scope: Free C-087; **NO** Jev/d1-ultra/automated confidence router, **NO** Standard/Go/OpenAI model changes, **NO** new Matt lifecycle. This is a conditional evidence axis and Cora-handoff classification, **not a new review engine**. Independent reviewers may be dispatched concurrently using native capabilities.

## Decision authority / orthogonal dimensions

Cora + human decide the route **once before launch**, using accepted ticket/product facts, not a free-model preference. Human/project owns `cost_policy`; Cora recommends `risk_class` according to existing risk triggers.

| Field in Free handoff | Allowed value | Consequence |
| --- | --- | --- |
| `Cost policy` | `free_only` | No paid fallback |
| `Risk class` | `volume\|complex` | Keeps established writer/Standards/Spec/corrector bindings |
| `Implementation focus` | `technical\|visual\|mixed` | Determines how much pixel evidence the writer must consume; **not** a new risk class |
| `UI impact` | `none\|quality\|fidelity` | Selects conditional visual evidence axis only |
| `Visual authority` | `NONE` or repo-local accepted authority | Identifies design system or frozen mockup |
| `Visual viewport/state` | `NONE` or exact representative viewport, screen and state | Comparable screenshot requirement |
| `Visual witness` | `NONE` or exact browser/render recipe and expected output | Child-readable evidence, not guessed from CSS |

Rules:
- `Implementation focus: visual|mixed` requires `UI impact: quality|fidelity`; `technical` may still have `UI impact: quality|fidelity` when code affects rendered behavior. Actual UI effects discovered beyond a `none` handoff require STOP and Cora reclassification at a clean boundary, not a hidden reviewer dispatch.
- `none` requires the three visual fields `NONE`. No visual model called for SQL-only/performance/backend tickets with no rendered UI effect.
- `quality` requires an accepted **project-local visual-system/UX authority** (e.g. `DESIGN.md`) and screenshots for the actual changed UI state. Check legibility, alignment, overlays/menus/chips, colors, typography, density, consistency, overflow and actual usability. Do not judge aesthetic taste with unapproved preferences.
- `fidelity` requires the **exact approved frozen mockup version/hash**, representative screen/state/viewport and a comparable actual screenshot. HTML masters need their approved PNG rendering. Evaluate composition, placement, dominant work area, simultaneous context and interaction-state fidelity, not only DOM nodes or tokens. A discrepancy cannot authorize a new product design.
- For a ticket modifying UI with a frozen approved master, choose `fidelity`; do not downgrade it to `quality` to avoid finding drift. When an independent visual master is absent but the accepted design-system rules exist, choose `quality`.
- A changed dropdown/overlay/state must be captured in the relevant state when material; no global viewport matrix. Use the smallest existing browser journey/fixture; screenshots contain synthetic/anonymized data.
- **Privacy gate:** image attachments are transmitted to the Free provider. Never transmit personal/clinical data, credentials or restricted project information unless the project's privacy authority explicitly permits that provider and medium. If representative screenshots cannot be sanitized or approved for the endpoint, HUMAN STOP rather than weakening privacy or claiming visual PASS.
- If no accepted authority, no usable pixels, incompatible viewports/states, or missing Cora classification: `INCOMPLETE_AUTHORITY` / `INCOMPLETE_VISUAL_EVIDENCE` / HUMAN STOP, never visual PASS.

## Free implementer capability selection — NO model carousel

| Risk | Default writer for technical focus | Visual/mixed focus |
| --- | --- | --- |
| `volume` | `atenea-implementer-free` → Space Bunny Free | **Same** Space Bunny Free, with actual approved PNG delivered as image media and browser evidence |
| `complex` | `atenea-implementer-free-complex` → GLM 5.3 Flash Free | **Same** GLM Free, with actual approved PNG and browser evidence; its prior visual lab timeout is known, so STOP if incapable within budget |

Visual focus is **not** a license to change `risk_class`, use the Volume writer for Complex semantics, or switch to Go/NaN. Both bound models accepted PNG in isolated field probes, but neither is universally certified visually. If a selected writer does not receive image media or fails to deliver a bounded candidate, return it to Cora + human for a **new unit boundary** decision. No fallback or in-session rotation.

For visual/mixed work with an accepted visual master, a text description alone does not demonstrate the writer saw pixels. The writer must receive the approved image via a tool/attachment that actually returns image pixels. It builds the functional composition first, produces a focused 1280×760-equivalent capture for the accepted viewport/state, optionally performs **one bounded comparison**, and returns the evidence. Neither the CSS source nor a pixel-score heuristic alone proves fidelity.

## Conditional third reviewer: atenea-review-visual-free

**Matt retains exactly one canonical Standards + Spec review per accepted fixed candidate.** Atenea Free adds a **read-only conditional Visual/UX axis** against **that exact same candidate**, not an extra Matt `/code-review`, not a second review iteration and not a new correction budget. **Prefer all three independent axes in the SAME review window, concurrent where Matt/OpenCode supports it**; otherwise complete the serialized axis once without repeating existing reviews. All applicable findings must arrive BEFORE correction. Follow `docs/C087_THIN_WRITER_REVIEW_AND_EVIDENCE_RECOVERY_20261017.md` for empty child results and screenshot reuse.

| UI impact | Visual reviewer | Input authority | Output |
| --- | --- | --- | --- |
| `none` | NOT dispatched | None | `NOT_APPLICABLE` (not a PASS from a model) |
| `quality` | Nemotron 3.5 Super VL Free | Approved project visual rules + actual rendered candidate screenshot(s) | `PASS\|NO_GO\|INCOMPLETE_VISUAL_EVIDENCE` |
| `fidelity` | Nemotron 3.5 Super VL Free | Exact approved master PNG + comparable rendered candidate screenshot(s) | `PASS\|NO_GO\|INCOMPLETE_VISUAL_EVIDENCE` |

The coordinator attaches or otherwise **transports actual image media** to the child session. An image path in a prompt is not evidence of image ingestion. The child can use a native image-capable Read on repo-local PNGs **only if the OpenCode child actually receives pixels**; if this is not supported, do not claim `PASS` and do not silently spawn a second reviewer. Keep Cora/human visual acceptance or request a separately authorized transport fix. The child has no shell/edit/subagent/external-directory permissions; screenshots must already be available in its readable project worktree or in a phase-specific accessible attachment.

The visual verdict must name the screenshot and matched screen/state/viewport, describe materially observable differences, distinguish facts from preferences, and prescribe bounded changes (file/selector/anchor when supported). Reuse the existing C-087 **max two fresh finding-scoped correction attempts per authorized work unit across all triggered axes**. Correctors do NOT interpret product options or create extra visual cycles. A corrected visual finding needs its **focused closure witness** (updated screenshot in the same state/viewport, checked against the exact reported finding) under the existing correction attempt; it does **not** start a second broad Visual/UX review of the new candidate. If the selected fix cannot be prescribed without a product choice, Cora + human HUMAN STOP.

Cora + human retain the existing **material composed-product checkpoint** `docs/PRODUCT_FIDELITY_GATES_V1.md`, including early first runnable composition for multi-ticket UI. A clean Visual Reviewer report does NOT waive that checkpoint, justify merge or replace functional evidence. Do not duplicate screenshot runs for tickets sharing an already verified immutable candidate at the same state.

## Lightweight Cora preflight — no probabilistic decision engine

The handoff includes all seven exact fields. From the **target project worktree**, Cora may invoke the updated Atenea checker with that project's repo-local handoff:
```bash
cd <project-worktree>
node <updated-Atenea-checkout>/tools/check-free-visual-handoff.mjs docs/handoffs/<accepted-ticket>.md
```
The checker only validates the accepted classification and referenced evidence plan; it cannot inspect the resulting future screenshot or judge the interface. No Jev/d1-ultra scoring, threshold/router process or automatic model switch.

For a UI-impact Free unit, first check `node tools/check-free-models.mjs --visual`. For `none`, use the ordinary Free model preflight only. Free endpoints can disappear; availability and actual image transport must be verified before a real UI Train. **The retired Muse Spark Free coordinator/corrector bindings were replaced by explicit human-approved MiMo/GLM/DeepSeek Free assignments on 2026-10-17; preflight still fails closed if any bound endpoint disappears.**

## Representative handoff snippets

**Mechanical/backend-only**:

```text
Cost policy: free_only
Risk class: volume
Implementation focus: technical
UI impact: none
Visual authority: NONE
Visual viewport/state: NONE
Visual witness: NONE
```

**Material UI with accepted frozen master**:

```text
Cost policy: free_only
Risk class: volume
Implementation focus: visual
UI impact: fidelity
Visual authority: docs/mockups/screen-approved.png@sha256:<actual-hash-from-accepted-artifact>
Visual viewport/state: screen=lead-dashboard; viewport=1280x760; state=populated
Visual witness: render=current-screen-playwright; output=artifacts/lead-dashboard-populated.png
```

Use actual repo-local paths, authoritative hashes, accepted component rules, named browser commands and states; example strings above are illustrative, not preapproved file paths. An exact `fidelity` claim cannot be based on a screenshot from the wrong viewport or state.

## Evidence / boundaries

Blind A/B on 2026-10-17: Space Bunny with direct target PNG improved from MAE 41.785 to 3.049 at 1280×760, but timed out at 420s. A Nemotron-written text handoff yielded MAE 15.621 in 131s including the 78s visual review, and **hallucinated a footer** that the implementer inserted into DOM. `/srv/kairos-lab/qualification/atenea-vision-blind-ab-20261017/RESULTS.md` is the VPS evidence only; no product data.

**Native media-transport smoke (2026-10-17, OpenCode V2 2.0.32): PASS in an isolated synthetic worktree.** A `smoke-visual-parent` primary (MiMo Free) delegated once to the real `atenea-review-visual-free` subagent (Nemotron Free), without `--file` CLI attachments. The child called native `Read` on two repo-local 1280×760 PNGs, and the session DB records **completed media parts `data:image/png;base64,...` for BOTH images**. The child correctly identified left-vertical → top-horizontal navigation and right-side → bottom context layout changes; the parent propagated its report and exited 0. Evidence: `/srv/kairos-lab/qualification/atenea-visual-subagent-media-smoke-20261017/run-pty.log`, parent `ses_eb5f5a93cffeFi3V7RMmDjR75n`, child `ses_eb5f54396ffeheKypPy8ehIA4w`. This confirms the *transport mechanism in this CLI/version*, not guaranteed future provider availability or qualification on a real project.

This supports **visual evidence and reviewer separation**, not a claim that every visual change needs an additional model. Never permit Visual/UX review to create a new product feature. Standard, Go and OpenAI experimental remain unchanged until their separate human decisions.
