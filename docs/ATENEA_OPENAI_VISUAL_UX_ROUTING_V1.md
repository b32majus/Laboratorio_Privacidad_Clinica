# Atenea OpenAI human-activated — conditional Visual/UX for Sprint + Frontier v1

**Status:** Human-approved **operative by explicit human activation** (2026-10-17). The literal `cost_policy: openai_experimental` is a **legacy technical identifier**, not an experimental status. No automatic routing, provider fallbacks or unconditional usage. Scope: this legacy cost-policy ID only. No changes to Standard, Free, Go, Matt, risk boundaries, implementer/reviewer/corrector models or publication authority.

## Scope: one extra conditional evidence axis, NOT an extra Matt review

The human explicitly chooses an accepted OpenAI Sprint/Frontier unit at a **clean boundary**, usually when approaching a capacity reset; never by automatic cost switch. `risk_class: volume` maps to Sprint; `risk_class: complex` maps to Frontier. Cora classifies the work once during handoff shaping; the coordinator applies deterministic approved bindings, not Jev or any probabilistic classifier.

| Binding | Sprint Volume | Frontier Complex |
| --- | --- | --- |
| Visible coordinator | `atenea-openai-sprint` (MiMo NaN) | `atenea-openai-frontier` (MiMo NaN) |
| Implementer, UNCHANGED | `atenea-implementer-openai-sprint`: GPT-6 Luna High | `atenea-implementer-openai-frontier`: GPT-6.1 Sol High |
| Standards, UNCHANGED | DeepSeek V4 Flash (NaN) | GLM 5.3 Flash High (NaN) |
| Spec, UNCHANGED | GPT-6.1 Sol High | GPT-6 Luna High |
| Conditional Visual/UX, NEW | `atenea-review-visual-openai-sprint` → **GPT-6.1 Sol High** | `atenea-review-visual-openai-frontier` → **GPT-6 Luna High** |
| Correction, UNCHANGED | fresh Sol High | fresh Sol High |

Visual witness intentionally uses the **other implementer model**. Model identity is NOT a proof of independent vendor, nor universal superiority. Sprint Visual may share a model with Sprint Spec/corrector, Frontier Visual with Frontier Spec; all are *fresh independent child sessions*, NEVER reused reviewer/corrector contexts.

## Handoff fields (NEW units in this cost policy only)

Every fresh human-activated OpenAI handoff has concrete values:

```text
Cost policy: openai_experimental
Risk class: volume|complex
Implementation focus: technical|visual|mixed
UI impact: none|quality|fidelity
Visual authority: NONE|accepted project reference
Visual viewport/state: NONE|screen=name; viewport=WxH; state=name
Visual witness: NONE|render=existing bounded command; output=relative/candidate.png
```

Values separated by `|` are **choices in this documentation**, NOT valid unselected handoff values. Use only one exact value in the accepted handoff.

- `none`: no rendered UI impact. The three Visual fields are `NONE`. Visual/UX does **not** run; canonical Matt Standards+Spec remain.
- `quality`: change affects rendered UI but has no frozen approved screen master. Supply existing accepted repo-local Design System / UX rules, affected screen/state/viewport and a real candidate browser screenshot recipe. Review only objective UI defects: clipping, typography, alignment, density, component/chip consistency, menu/overlay/open/empty/error states when affected. No aesthetic opinions as product authority.
- `fidelity`: a specific **frozen approved master** exists. Supply real repo-local **PNG pinned to SHA256**, and any approved HTML as complementary source (HTML alone is insufficient), plus comparable actual browser screenshot, same screen/state/viewport. Reviewer cannot redesign the frozen master.
- `Implementation focus: visual|mixed` with `UI impact: none` is contradictory: HUMAN STOP.
- A technical ticket may also have `UI impact: quality|fidelity` if it changes screens. Do not misclassify as none to avoid review.
- If an accepted `none` ticket reveals UI impact mid-flight, STOP and ask Cora/human for a new clean-boundary classification. Don't add a reviewer silently to an active unit.

Use the **shared deterministic checker**, with the legacy cost-policy identifier preserved for compatibility:
```bash
cd <target-project-worktree>
node /srv/kairos-lab/Atenea/tools/check-experimental-openai-visual-handoff.mjs docs/handoffs/<approved>.md
```
It validates fields and local accepted-authority references/hashes. It does not run a ticket, prove future images exist or confer the **human approval to activate OpenAI Sprint/Frontier**, which remains a separate **human activation** authority.

## Visual media / privacy / exact review boundary

- If a frozen visual master is authoritative, the implementer must **actually receive the source PNG pixels**, make an early correct structural edit, and provide real browser screenshots of its candidate in the accepted screen/state/viewport. Use at most one **bounded** candidate visual comparison; avoid interminable pixel hunting. No changed writer bindings; visual tickets do not downgrade true Complex risk.
- Visual/UX child must receive **actual PNG image media** through OpenCode's native Read in its own child context. Paths, JSX/CSS or Green E2E tests alone are insufficient.
- The reviewer is READ-ONLY; no shell, edits, child agents or access to external worktrees. If pixel transport, approved authority, comparison evidence, matched viewport/state, or provider/privacy authorization is missing: `INCOMPLETE_VISUAL_EVIDENCE` / HUMAN STOP, **never PASS**.
- Evidence should be synthetic/sanitized; real customer/patient data, credentials and unauthorized provider disclosure are prohibited.
- The **same fixed candidate** receives exactly one canonical Matt Standards+Spec pair and, **only when quality/fidelity**, one independent conditional Visual/UX report. **Prefer the three independent axes in ONE review window, concurrent if supported**; if serialized, complete each axis once and collect ALL findings before correction. This third evidence axis does NOT call Matt /code-review again, replace Specs/Standards, open a new correction budget or waive Cora/human product/fidelity checkpoint. See `docs/C087_THIN_WRITER_REVIEW_AND_EVIDENCE_RECOVERY_20261017.md`.
- All findings share the EXISTING maximum **two fresh finding-scoped correction attempts per authorized work unit**. Corrected visual defects require a focused closure screenshot but no second general Visual/UX pass. A new product/UI choice is HUMAN STOP; models cannot invent new copy/components.

## Evidence / limitations

Synthetic model checks on 2026-10-17:
- GPT-6.1 Sol High directly received two PNGs, identified material navigation/context/table drift and returned `FIDEL` on identical PNGs. Evidence at `/srv/kairos-lab/qualification/atenea-openai-experimental-visual-review-20261017/RESULTADOS.md`.
- GPT-6 Luna High passed similar checks and a synthetic native child-image smoke in the Standard lane (`/srv/kairos-lab/qualification/atenea-standard-visual-child-smoke-20261017/experiment.log`).
- **Native Sol High child-media smoke PASSED (2026-10-17, OpenCode v2.0.32):** isolated synthetic MiMo parent delegated once to the real read-only `atenea-review-visual-openai-sprint` child; child called native `read` twice and both returned `data:image/png;base64,...` file media in `state.content` with status completed, 111126 and 98958 URI characters. It correctly returned `NO_GO` for relocated navigation, contextual panel and obscured table. Parent `ses_eb4c7da80ffeiVD5hy0XwAuOmw`, child `ses_eb4c7abe8ffe1nLS3PuLTPKlx9`, exit 0. Evidence: `/srv/kairos-lab/qualification/atenea-openai-sprint-visual-child-smoke-20261017/experiment.log` and local OpenCode session records. Structural resolution/permissions for both human-activated OpenAI coordinators and both new Visual reviewers also PASSED in isolated worktree PTY. These tests prove synthetic transport and routing, **not measured model superiority or full real-Train qualification of the new visual reviewer**; real screenshot reception remains fail-closed.

Atenea Free, Standard, Go and OpenAI profiles' existing implementers/reviewers/correctors remain unchanged. No changes to running project agents/Trains. Human decides whether/when to sync target project worktrees at a clean boundary.
