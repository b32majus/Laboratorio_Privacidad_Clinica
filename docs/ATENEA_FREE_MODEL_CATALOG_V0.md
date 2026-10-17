# Atenea Free model catalog v0 — Free V2 Volume/Complex bindings

Status: **CURRENT HUMAN-APPROVED FREE BINDINGS — promotion without additional model-quality bake-off**
Snapshot: 2026-10-17 (human-approved Free-only Muse replacement + conditional Visual/UX addendum)
Runtime observed: OpenCode V2 `2.0.32`; exact current binding IDs visible via `opencode models`.

This is the **replaceable binding snapshot**, not a new lifecycle or a quality-equivalence certification. Free availability is promotional and may change. The human explicitly approved both Free risk-class routes on 2026-10-16 and the exact three-model Muse replacement on 2026-10-17, without further comparative model-quality tests. No automatic fallback or mid-unit model rotation.

## Approved role matrix

| Role | Free Volume (`risk_class: volume`) | Free Complex (`risk_class: complex`) |
| --- | --- | --- |
| coordinator (visible `atenea-free`) | `opencode/mimo-v2.6-flash-free` | same |
| explorer `atenea-explorer-free` | `opencode/mimo-v2.6-flash-free` | same |
| implementer | `atenea-implementer-free` → `opencode/space-bunny-free` | `atenea-implementer-free-complex` → `opencode/glm-5.3-flash-free` |
| Standards `atenea-review-standards-free` | `opencode/deepseek-v4.1-flash-free` | same |
| Spec | `atenea-review-spec-free` → `opencode/glm-5.3-flash-free` | `atenea-review-spec-free-complex` → `opencode/space-bunny-free` |
| finding-scoped corrector | `atenea-corrector-free-volume` → `opencode/glm-5.3-flash-free` | `atenea-corrector-free-complex` → `opencode/deepseek-v4.1-flash-free` |
| merger `atenea-merger-free` | `opencode/mimo-v2.6-flash-free` | same |
| integrated audit | Cora when material | Cora when material |

**Free-only conditional Visual/UX overlay (approved 2026-10-17):** `atenea-review-visual-free` → `opencode/nemotron-3.5-super-vl-free`. Dispatch only when the Cora-accepted handoff has `UI impact: quality|fidelity` and pixel evidence is available. No dispatch for `UI impact: none`. The existing risk-class implementers are both image-capable in the isolated 2026-10-17 laboratory, but Space Bunny had stronger fidelity evidence; GLM saw images yet timed out on the visual fixture. No new general-purpose writer model or automatic risk override is introduced. Details: `docs/ATENEA_FREE_VISUAL_UX_ROUTING_V1.md`.


Both logical routes use **one visible primary agent**, `atenea-free`, which dispatches the risk-specific agents from the accepted handoff. In Volume, the Space Bunny writer is independent from GLM Spec and DeepSeek Standards. In Complex, the GLM writer is independent from Space Bunny Spec and DeepSeek Standards. MiMo coordinator/explorer/merger and GLM Volume Spec/corrector and DeepSeek Complex Standards/corrector share provider IDs only; their **sessions are fresh and independent**, never a reviewer or writer context reused for correction.

## Evidence versus approved selection

- Space Bunny and the now-retired Muse Free have prior bounded implementation/coordinator evidence (historical only). The replacement MiMo Free coordinator and GLM/DeepSeek Free correctors are human-approved for use, not newly benchmark-qualified. DeepSeek V4.1 Flash Free versus MiMo Free on a synthetic Standards fixture (2026-10-15) found 2/2 known defects for both; DeepSeek finished 32.6 s versus MiMo 71.7 s. These were **exploratory**, not production-equivalence evidence.
- The real-world T6 shadow review of DeepSeek on 2026-10-15 was **NOT_EVALUABLE** because OpenCode standalone failed before session creation, including a MiMo control. It cannot be scored as model failure or success.
- GLM 5.3 Flash Free was directly visible in OpenCode on 2026-10-16; the user elected to approve its Complex implementation and Volume Spec assignments from experience **without a new benchmark**. Do not claim their Free endpoint is field-qualified by the paid NaN variant.
- The originally accepted C-087 evidence budgets, one canonical Standards+Spec pair per accepted candidate, at most two fresh finding-scoped correctors and Cora/human product/merge authority are unchanged.
- The separate blind visual A/B experiment on 2026-10-17 (`/srv/kairos-lab/qualification/atenea-vision-blind-ab-20261017/RESULTS.md`) showed Space Bunny using pixels obtained better fidelity on one fixture (MAE 3.049, timeout 420 s) than a text-only Nemotron handoff (MAE 15.621; Nemotron 78 s + Space Bunny 53 s). Evidence is **N=1**, no claim of general model ranking. Nemotron 3.5 Super VL Free also detected material layout drift and passed an identical-image control in a separate isolated fixture.
- **Resolved Free binding availability issue (2026-10-17):** following explicit human authorization, the removed Muse Spark 1.3 Free coordinator/correctors were replaced at this NEW clean configuration boundary by MiMo coordinator, GLM Volume corrector and DeepSeek V4.1 Complex corrector. This is an approved routing selection, not a quality benchmark or permission for fallback. Model IDs were visible and core + visual preflights passed on OpenCode V2 `2.0.32`.


## Preflight and rotation

Before a fresh Free Train, run `node tools/check-free-models.mjs`: this validates **model identifiers visible to OpenCode**, not inference/quality, endpoint stability or zero-retention. For a unit with `UI impact: quality|fidelity`, use `node tools/check-free-models.mjs --visual` so Nemotron's conditional Free binding is also checked; backend-only units do not require the optional visual endpoint. All agents in the target project's `.opencode/agents` must be synchronized from this accepted Atenea revision at a clean work boundary. The accepted cost policy and risk class must be explicit and respected.

Exact bound model IDs:

```text
opencode/mimo-v2.6-flash-free
opencode/space-bunny-free
opencode/deepseek-v4.1-flash-free
opencode/glm-5.3-flash-free
```

A provider removing a Free offering, changing its price, failing inference or violating a project's privacy/data constraints is **HUMAN STOP**. Cora/human may select a replacement at a *new clean work unit* and update this snapshot + native agent bindings then, never silently escalate Free to paid or switch the active unit.

The Free route itself **does not guarantee zero-retention/no-training**; each target project must independently satisfy its stricter privacy/residency/confidentiality requirements.
