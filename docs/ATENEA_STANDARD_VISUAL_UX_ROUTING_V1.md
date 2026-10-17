# Atenea Standard — Conditional Visual/UX v1

Status: **Human-authorized Standard overlay, 2026-10-17**. Basis: C-087 and Free Visual/UX conditional precedent; **no** Standard implementer model reassignment, no Jev/d1-ultra router, no new Matt lifecycle, no Go/Free/OpenAI-experimental changes.

## Authority and classification

Before any NEW Standard unit, Cora and the human fix the route in the durable, child-readable handoff:

| Field | Accepted values | Meaning |
| --- | --- | --- |
| `Cost policy` | `standard` | Paid Standard, no fallback |
| `Risk class` | `volume\|complex` | Technical risk, not volume of CSS or visual importance |
| `Implementation focus` | `technical\|visual\|mixed` | What dominates the writer work |
| `UI impact` | `none\|quality\|fidelity` | Conditional visual evidence/reviewer |
| `Visual authority` | `NONE` or accepted repo-local ref | Design System or frozen PNG master |
| `Visual viewport/state` | `NONE` or `screen=...; viewport=WxH; state=...` | Comparable browser witness |
| `Visual witness` | `NONE` or `render=<bounded command>; output=<relative PNG>` | How to obtain the screenshot |

Cora makes all classifications UPSTREAM; the coordinator only verifies/applies them. `Implementation focus: visual|mixed` with `UI impact: none` is invalid. A `technical` ticket may nonetheless trigger `quality|fidelity` if it changes rendered UI. If an in-flight unit classified `none` exposes material UI impact, STOP for Cora classification at a NEW clean boundary rather than silently adding review.

- `none`: strictly non-visual work, e.g. SQL/server/internal computation with no rendered UI change. All three visual evidence fields must be `NONE`. No visual reviewer or screenshot required.
- `quality`: affected UI without a frozen approved mockup. Reference the **existing accepted project Design System / UX authority** and capture real changed screen/state at a named viewport. Review objectively legibility, clipping, alignment, spacing, density, chip/button/table/dropdown states, overlay/open/error/empty states where relevant; no free-form visual taste, AI slop invented criteria, speculative redesign.
- `fidelity`: a frozen human-approved mockup is authoritative. Identify its **real repo-local PNG with SHA256**, the exact screen/state/viewport and a comparable candidate screenshot. Frozen HTML is useful authority but its **approved PNG rendering is mandatory**. Never downgrade `fidelity` to `quality` merely because implementing the design is harder.
- If required authority, screenshot, actual media, comparable screen/state/viewport or privacy approval is missing: `INCOMPLETE_AUTHORITY` / `INCOMPLETE_VISUAL_EVIDENCE` / HUMAN STOP — **not** PASS.
- The candidate screenshot must be rendered by the browser from the implementation. Do not infer UX or compositional fidelity from reading JSX/CSS, filenames, or green unit tests. Capture only relevant states; no unbounded viewport matrix.

## Implementation: KEEP the risk-bound writers

| Risk | Implementer (all focuses) | Applicable visual obligation |
| --- | --- | --- |
| `volume` | `atenea-implementer-volume` → `nan/deepseek-v4-flash` (served V4.1 Flash-1017) | View the approved PNG pixels directly when present; produce browser screenshot; early structural edit, one bounded comparison |
| `complex` | `atenea-implementer-complex` → `nan/glm5.3-flash#high` | Same visual evidence, preserving Complex risk; no downgrade or model switch |

Volume is eligible for tickets **predominantly design-oriented** when they have no true Complex triggers. Implementer vision has been observed in a *synthetic OpenCode run*, not guaranteed for each future environment. The user accepts the NaN CEO confirmation that the current DeepSeek alias serves checkpoint 1017; no repeat checkpoint check. The dual model comparison on 2026-10-17 yielded 49/49 semantic checks for both, DeepSeek in 151s vs GLM in 436s; visual MAE DeepSeek 5.511 (timeout 300s), GLM 11.712 (exit 0, 184s) on ONE controlled synthetic fixture. This suggests an **early-first-edit/bounded-image-analysis rule**, not promotion of DeepSeek to Complex by itself. Experimental evidence lives at `/srv/kairos-lab/qualification/atenea-standard-dsvs-glmflash-20261017/RESULTADOS.md` on the VPS; the path is evidence provenance, not required input for product agents.

The writer must prioritize geometry and candidate code rather than endless RGB measurements, and return a screenshot for the accepted viewport/state before its review boundary. Failure to receive actual PNG pixels when required or to capture the candidate is **not** visual completion; STOP without fallback.

## Third evidence axis — Standard Luna High

| `UI impact` | Visual reviewer | Real required evidence | Outcome |
| --- | --- | --- | --- |
| `none` | none (`NOT_APPLICABLE`) | no image evidence | Matt Standards + Spec alone |
| `quality` | `atenea-review-visual-standard` (GPT-6 Luna High) | accepted Design System + real candidate screenshot(s) | `PASS\|NO_GO\|INCOMPLETE_VISUAL_EVIDENCE` |
| `fidelity` | same Luna High agent | exact approved master PNG + real comparable candidate screenshot(s) | same |

**Luna High also serves the Standard Standards axis and Volume Spec axis**; Visual/UX is a **fresh isolated session** on the fixed candidate, *not a third independent model/vendor*. Do not reuse Standards/Spec context to write Visual findings. Keep the canonical Matt Standards+Spec pair exactly once per accepted candidate; dispatch Visual once *beside* that pair, never as a repeated Matt `/code-review`. **Prefer concurrent dispatch of all three axes in ONE review window if Matt/OpenCode allows it**; otherwise serialize only what the runtime forces and never rerun a completed axis. Await ALL applicable findings before correction. When Visual is inapplicable, do not schedule any visual model call. Empty writer result and screenshot economy: `docs/C087_THIN_WRITER_REVIEW_AND_EVIDENCE_RECOVERY_20261017.md`.

Luna must receive actual PNG media through OpenCode child-native Read. **Native child-media smoke PASSED on 2026-10-17, OpenCode 2.0.32:** a fresh synthetic MiMo parent delegated exactly once to the actual `atenea-review-visual-standard` (Luna High) child; the child issued two native `read` calls and both returned completed `data:image/png;base64,...` media in the OpenCode session data, then correctly emitted `NO_GO` for left-to-top navigation drift, right-to-bottom context drift and a partly obscured table. Parent session `ses_eb4e31916ffefYGiFPyDK6s9bq`, child `ses_eb4e2c073ffeo3P3yGN6ccwzLq`; repo-local synthetic evidence `/srv/kairos-lab/qualification/atenea-standard-visual-child-smoke-20261017/experiment.log`, exit 0. This proves the native mechanism in this CLI/version and fixture, **not** inference reliability/endpoint suitability on all real projects. Missing actual pixels later still gives `INCOMPLETE_VISUAL_EVIDENCE`, never PASS.

Material findings across all applicable axes share **the existing maximum two fresh finding-scoped correction sessions per authorized work unit**, independent of the number of review axes. A visual correction closes with one focused screenshot of the repaired state, *not* a second general Visual/UX review. Any change to accepted product/design choices requires Cora+human authority at HUMAN STOP; the reviewer cannot redesign UI or invent features.

Composed human-facing changes still trigger the existing `docs/HUMAN_PRODUCT_DESIGN_AUTHORITY_V1.md` and `docs/PRODUCT_FIDELITY_GATES_V1.md` when material. A Visual PASS cannot waive human approval or publication controls.

## Privacy and transport

OpenAI Standard reviewer receives images; NaN writer may also receive approved images. Use only synthetic/redacted evidence or material whose project privacy authority permits disclosure to the selected provider. Clinical/personal data, credentials and private product material require explicit provider-appropriate authority. No default cross-provider sharing by implication. Child agents have **read-only** file access for approved images, no shell/edit/other agents/external paths. Paths in prompts alone do not prove images arrived.

## Deterministic preflight (no new model)

From the target project's current worktree, with the updated Atenea checkout:

```bash
node /srv/kairos-lab/Atenea/tools/check-standard-visual-handoff.mjs docs/handoffs/<ticket-approved>.md
```

This validates fields, repo-local authority, SHA256 for fidelity screenshots, and allowed Standard roles. It does **not** prove future screenshot bytes exist or visually inspect the candidate. Validate model visibility + child media transport separately at launch; do not silently fallback if a model disappears.

### Example with NO UI impact
```text
Cost policy: standard
Risk class: complex
Implementation focus: technical
UI impact: none
Visual authority: NONE
Visual viewport/state: NONE
Visual witness: NONE
```

### Example with approved mockup
```text
Cost policy: standard
Risk class: volume
Implementation focus: visual
UI impact: fidelity
Visual authority: docs/mockups/approved.png@sha256:<actual-SHA256>
Visual viewport/state: screen=dashboard; viewport=1280x760; state=populated
Visual witness: render=pnpm test:screen:capture; output=artifacts/dashboard.png
```

The example file/command/hash are placeholders, never references to unverified product assets. No automatic ticket/Train, broad QA loop, model fallback, hidden model router, Go or Free changes.
