# START HERE — Laboratorio de Privacidad Clínica

Status: **CURRENT PRODUCT / RECOVERY AUTHORITY**

Last reconciled: 2026-10-12

## 1. Where we are

The canonical clinical application is the V4 SPA on branch `3.0-main`. Its technical/domain pipeline may continue to use `Input → Configure → Review → Privacy Gate → Export`, but **that sequence is no longer accepted as mandatory human-product topology**.

From 2026-10-05 the binding human-product authority is `docs/HUMAN_PRODUCT_DESIGN_AUTHORITY_V1.md`. The ordinary mental model is **Add information → prepare/review what needs attention → Result**, interpreted as mental states rather than a fixed three-screen stepper. Visible phases exist only when they contain real human work.

V4 materially improves the original v3 in review authority, privacy-state integrity, fail-closed behavior, local-only runtime, structured hardening, testing and deployment security. However, the 2026-10-04 recovery traceability audit proved that **T25 legacy retirement established workflow/security parity, not full product parity**. Several v3 product capabilities and original UX-audit requirements were narrowed or lost while translating audit → specs → Work Orders. The 2026-10-05 product-design reconciliation additionally proved that some technically correct V4 composition exposes too much pipeline/domain structure to the user.

Do not interpret “V4”, “T25 complete”, a green E2E suite, or a historical `DONE` debt row as proof of full product recovery.

## 2. Current authority order

For any new product/recovery work, use this precedence:

1. `docs/START_HERE.md` — current position and authority map;
2. `docs/HUMAN_PRODUCT_DESIGN_AUTHORITY_V1.md` — **binding human-product model, interaction invariants and product acceptance gates for REC-05→REC-11**;
3. `docs/RECOVERY_MASTER_PLAN_2026-10.md` — **single current recovery plan and execution order**, reshaped by the human-product authority;
4. `docs/audits/2026-10-product-design-reconciliation-final.md` — accepted decision record reconciling Cora + independent adversarial product review;
5. `docs/audits/2026-10-recovery-traceability-matrix.md` — current traceability index: 88 frozen debt rows + 42 product/heritage capabilities after external falsification;
6. `docs/audits/2026-10-recovery-traceability-audit.md` — root-cause analysis and internal evidence narrative;
7. `docs/audits/2026-10-recovery-plan-external-adversarial-audit-sol61.md` — independent Sol 6.1 adversarial falsification and required-change evidence;
8. `docs/shaping/CURRENT_DECISIONS.md` — accepted architecture/product decisions, including the 2026-10-05 human-product supersession of D-001's visible five-step implication;
9. relevant `docs/specs/SPEC_V4_*.md` — implementation contracts where they do not narrow recovery or human-product authority;
10. accepted GitHub Work Order for the current REC ticket;
11. code + deterministic tests/oracles;
12. historical roadmap, T01–T25 task docs, pre-reconciliation REC-05 handoff and legacy-retirement evidence — provenance only unless explicitly cited.

If an older spec/ticket is narrower than the recovery matrix for a capability being recovered, **the recovery plan/matrix wins for scope discovery**; implementation still requires a shaped Work Order with explicit acceptance criteria.

## 3. Recovery fixed point

Recovery was reconstructed from:

- original audited product: `3.0-main@331bcaf4a624659c77823a0c4b427d46347ea104`;
- frozen pre-refactor authority: `e164ca2`;
- V4 checkpoint audited on 2026-10-04: `3.0-main@6fb5eb1fb867e022acc68dd2be39b16bd531f27a`.

After independent adversarial reconciliation, the matrix contains **88 original debt/audit rows + 42 product/heritage rows**, plus a 2026-10-05 **post-reconciliation human-product overlay** (`PDR-01…PDR-12`). At the REC-04 checkpoint the pre-reconciliation matrix had 17 blocker-marked rows; the PDR overlay adds cross-cutting accepted obligations without creating new REC ticket IDs. Counts are an index, not proof: every remaining handoff must map its owned matrix/PDR obligations, and REC-12 must re-check all source layers before closeout.

## 4. Current recovery train

Execution order and dependencies are authoritative in `docs/RECOVERY_MASTER_PLAN_2026-10.md`. The known recovery train is:

1. `REC-01 — SPANISH-ENGINE-ASSURANCE-01` — **COMPLETED**, merged by PR #66 at `3.0-main@2e641aa54797e97d8019aa0821518b17a078fc42`
2. `REC-02 — TEXT-POLICY-COMPLETION-01` — **COMPLETED**, merged by PR #68 at `3.0-main@4984040722f55062778b97e7351d2b8b43fe7ce7`
3. `REC-03 — STRUCTURED-SEMANTICS-RECOVERY-01` — **COMPLETED**, merged by PR #70 at `3.0-main@c67d1aede36c41bb9ff1a52ae785e9ab969e1202`
4. `REC-04 — STRUCTURED-IO-OUTPUT-PARITY-01` — **COMPLETED**, merged by PR #72 at `3.0-main@7f7de6b5bf4c0692850b4e3c5de6987bcdef18f0`
5. `REC-05 — SINGLE-OUTPUT-PARITY-01` — **COMPLETED**, merged by PR #76 at `3.0-main@96e53ee9f390026eff2ff44cb405634517ffbe09`
6. `REC-06 — BATCH-WORKFLOW-PARITY-01` — **COMPLETED**, closed by #78 + #86; #86 merged by PR #97 at `3.0-main@2941b666007062ad1c4aa8e967046705864e143d`
7. `REC-07 — BATCH-OUTPUT-PARITY-01` — **COMPLETED**, closed by #79 + #87 + #88 + #89; #89 merged by PR #104 at `3.0-main@86dbd34d303e2c967063400bacd452e4780bae66`
8. `REC-08 — INPUT-PRODUCTIVITY-PARITY-01` — **COMPLETED** by #80 + independently authorized #106, merged via PR #107 at `3.0-main@a5453930b87f472eb12170c2a5ff40ea3cc9f6dc`
9. REC-09 — APP-IA-REVIEW-PRODUCTIVITY-01 — **COMPLETED**: #81 PR #111; #82 PR #109; #83 PR #113; #84 PR #114; #85 PR #116. All five issues CLOSED after 2026-10-12 issue-state reconciliation.
10. REC-10 — SPANISH-LOCALIZATION-01 — **COMPLETED**, #90 CLOSED, PR #120 merged at 3.0-main@78db715e158d731fa0cfb12ea466551072be5fdf.
11. REC-11 — VISUAL-SYSTEM-RECOVERY-01 — #91 OPEN, all declared dependencies CLOSED; seven-view Sophilux B V1 visual and D1–D4/VF-01..08 functional contracts approved and integrated. Preparation only; not launched or published.
12. `REC-12 — RECOVERY-CLOSEOUT-01`

**HISTORICAL SNAPSHOT following PR #111 (superseded by current recovery status above):** REC-07 is now canonical and **COMPLETED**. #79 merged by PR #96 at `3.0-main@30edfc3ca3c5deb585af82cc2d45a4bf03643e0a` and closed the async-disposal prefactor; #87 merged by PR #100 at `3.0-main@ed61e319fe3d54529abe33d4d145454502e11257` restoring batch Result readiness + deterministic Safe summary CSV; #88 merged by PR #102 at `3.0-main@6f47192bd6be9892708cb01ab6c85abb479bed44` restoring the ordinal per-document Safe PDF ZIP + consolidated Safe PDF; and #89 merged by PR #104 at `3.0-main@86dbd34d303e2c967063400bacd452e4780bae66` restoring the separate batch Confidential Audit with deliberate confirmation and shared fail-closed session authority. Issues **#78, #79, #86, #87, #88 and #89 are CLOSED**. The REC-08 work is now **COMPLETED**: #80 restored the Spanish synthetic clinical examples, browser-local Pegar with Ctrl+V fallback, drag/drop plus file selection, quiet deterministic routing and intended-use wording; separately authorized #106 closes the later discovered stale Clipboard-vs-files interleaving. Both issues are CLOSED and the combined product landed by PR #107 at `3.0-main@a5453930b87f472eb12170c2a5ff40ea3cc9f6dc`. REC-09 #83–#85 remain technically executable and independently unblocked, while REC-10 #90, REC-11 #91 and REC-12 #92–#93 retain their published prerequisites. **No next executable frontier is selected by this closeout**; scheduling returns to attended Cora + human choice, not a fake dependency edge.

**HISTORICAL 2026-10-11 REC-09 #82 / H-41 closeout (not current frontier):** The attended, separately human-opted-in C-087 `openai_experimental + complex` Frontier Train #82 has been integrated through PR #109 at `3.0-main@0c5741cba1cc123fbf8cb29016366ac2a37f1730` after Cora independent audit GO, final CI/E2E and CodeQL PASS. The accepted Review guard requires contextual confirmation before retaining a direct/uncertain identifier, prevents stale entity/session authorizations, preserves correction and mobile detection-list return, and shows current factual kept-original warnings across single, batch and structured Result consumers. CORA-82-01 corrected only existing shared E2E consumers; 39/39 relevant composed journeys re-passed. **#82 is CLOSED; REC-09 remains IN PROGRESS through #81/#83–#85.** OpenAI Frontier is still experimental/unqualified and `standard` remains the default; its use here is historical, not a policy change. **No next frontier selected by this closeout.**

**HISTORICAL 2026-10-11 attended selection AFTER #82 (superseded by PR #111; not current frontier): #81 — REC-09 Manual missed-entity marking without offsets.** This is a new selection, not a rewrite of the historical #82 closeout. Human-delegated experimental model-profile choice: `cost_policy=openai_experimental`, **Frontier / `risk_class=complex`** for exact source-span privacy integrity, stale ReviewSession context and post-action continuity; OpenAI Frontier remains unqualified and `standard` remains default. The full bounded action→visible state→next action contract, affected single/batch/structured Review consumers, existing E2E-driver updates, 375/1280 real-browser spatial baseline and conditional safeguards live in `docs/handoffs/ISSUE81_MANUAL_SELECTION_FRONTIER_C087_20261011.md`. #83/#84/#85 remain open/unselected with no new hard dependency. **Preparation only, not implementation, merge or completion.**

**HISTORICAL 2026-10-11 #81 / H-10 / PDR-03 COMPLETED:** PR #111 merged at `3.0-main@e576fbb6cb920dbdb5dfb7e8b149f389420a6a20` after independent Cora C-087 GO and exact-head CI validate/E2E + CodeQL PASS. Original source selection and open Spanish category replace visible numeric offsets; Add generates one canonical *pending* manual ReviewSession detection, while Cancel/invalid/stale contexts mutate nothing. Follow-on review remains actionable with unchanged unrelated decisions; 375/1280 px real-pointer witness PASS. No worker corrections. REC-09 remains PARTIAL through #83–#85; no deployment or new frontier is authorized by this closeout.

**HISTORICAL 2026-10-11 SELECTED TRAIN #83 / REC-09 (PREPARED, LOCAL_ONLY):** After #81 PR #111 + documentary PR #112, attended Cora selects high-volume Review productivity from the still-open #83/#84/#85 set. C-087 `risk_class=complex`; explicitly delegated `cost_policy=openai_experimental` / OpenAI Frontier (unqualified; standard remains default). The finite Review-only Cora handoff `docs/handoffs/ISSUE83_REVIEW_PRODUCTIVITY_FRONTIER_C087_20261011.md` closes first pending/current selection, next/previous attention, draft-preserving navigation, scoped shortcuts, per-item-only decision, low-confidence/keep-original and mobile continuation. It references the real synthetic 24-detection browser baseline at 375/1280px. This is preparation only, **not** an implemented feature/PR/merge; #84 and #85 remain unselected and no hard dependency is added. Launch/implementation requires exact local fixed-point preflight.

No new recovery ticket should be invented from memory. Use published issues #78–#93, the independently human-authorized #106 REC-08 repair, and the traceability matrix/master plan. Any newly discovered blocking obligation must first be reconciled into authority and ownership rather than silently appended to an implementation ticket.

## 5. Important current truths

- The text privacy engine is Spanish/Spain-oriented; the V4 UI being English is **not evidence that the recognizer dictionaries were translated to English**.
- REC-01 materially broadened the synthetic/no-PHI Spanish engine assurance corpus to **35 core + 4 adversarial cases** on the productive `createRegistryEngine()` path, with machine-visible type/slice coverage and deterministic precision/recall/F1/FNR evidence. It remains an assurance/regression gate, **not a universal statistical clinical-Spanish quality grade**.
- REC-02 completed all four accepted Privacy Policies for pasted text, single documents and document batches: External AI reduces date precision; Longitudinal Research applies one deterministic Job-scoped date shift while preserving ordering/intervals; Standard/Strict retain their accepted semantics. REC-03 then reused that same authority for structured `process-as-text` cells rather than inventing a second text-policy system.
- REC-03 restored structured semantics: the selected patient-ID becomes deterministic in-Job `ID_ESTUDIO` / `PAC_001…` in Safe output with Confidential-only correspondence; structured Class and productive Action are separate authorities; unresolved Unknown/quasi states remain fail-closed; and configured text-like cells route through the same REC-02 text engine + ReviewSession path. REC-04 then restored configurable Study-ID prefix/row-order `Visita_Num`, bounded smart workbook-header resolution, typed Safe structured values, factual structured summary, Safe XLSX and separate Confidential XLSX with deliberate confirmation.
- Batch V4 now has the canonical REC-07 Result/output set: deterministic Safe summary CSV from #87 / PR #100; ordinal per-document Safe PDF ZIP + consolidated Safe PDF from #88 / PR #102; and the separate `auditoria-confidencial-lote.txt` from #89 / PR #104 behind deliberate warning/Confirm and one shared fail-closed session-aware availability authority. REC-07 is complete.
- Structured output provides Safe CSV + Safe XLSX and separate Confidential TXT/XLSX with deliberate confirmation. REC-05 canonically restores single text/document Copy/TXT/DOCX/PDF plus deliberate Confidential confirmation, and REC-07 now completes the same prepared/shareable-vs-Confidential separation for document batches. The global deliberate Confidential-download safeguard (`H-42`) is therefore closed across structured, single-item and batch surfaces.
- #82 / PR #109 closed H-41; #81/#83/#84/#85 are also integrated and CLOSED through PRs #111/#113/#114/#116. Per-item Review and keep-original safeguards remain operative; REC-11 #91 owns the subsequent visual closeout.
- REC-08 is complete: Input now provides three Spanish no-PHI examples, browser-local Pegar with Ctrl+V fallback, exact file select/drop staging, contextual Spanish refusals, human-purpose guidance and quiet routing. The CORA-80-01/-02/-03 async/selection preservation guards are accepted through #80 + #106 / PR #107. Inference remains deterministic/fail-closed; D-019 stays human-ratified (2026-10-10) as `DELIBERATELY_SUPERSEDED` for a generic pipeline override. Mixed/unsupported input remains an error rather than a guessed route.
- Sophilux B V1 seven-view visual composition and the real-product D1–D4/VF-01..08 reconciliation are **human approved and frozen** (2026-10-12), available in docs/design/sophilux-b-v1. REC-11/#91 implements the accepted system in operational V4; no aesthetic re-selection or mock behavior transfer is authorized.
- REC-10 professional Spanish localization is completed by #90 / PR #120. Keep accepted Spanish accessible naming and file labels; #91 must not regress terminology or modify privacy semantics.

## 6. What is NOT recovery scope

Do not inflate the recovery train with capabilities the original audits explicitly treated as later/advanced work, including OCR, optional local NER, FHIR JSON, ARX-lite risk analysis, layout-preserving PDF redaction, DICOM, institutional recognizer plugins, or cryptographic/HMAC research identifiers beyond what a recovery ticket explicitly needs. These remain future product debt/opportunities.

## 7. Historical documents

- `docs/ROADMAP.md` is the **2026-09 migration roadmap**. It explains why V4 exists but is superseded for current prioritization by the Recovery Master Plan.
- `odd/tasks/t01-*` through `t25-*`, `docs/execution/*` and legacy-retirement documents remain evidence/provenance. They are not the current product backlog.
- `docs/DEBT_REGISTER.md` remains a historical/live trace register, but **planning must not be derived from its status column alone**. Its 2026-10 reconciliation notes point back to the matrix when an old `DONE` was narrower than the product-level recovery requirement.

## 8. Execution rule

Before implementing a REC Work Order:

1. shape the Work Order from the exact matrix rows it owns;
2. for any user-facing REC-05→REC-11 work, read and enforce `docs/HUMAN_PRODUCT_DESIGN_AUTHORITY_V1.md` and the matrix `PDR-01…PDR-12` overlay before deriving UI from domain/spec topology;
3. preserve the current V4 safety/domain architecture unless the Work Order explicitly changes an authority;
4. define acceptance criteria for **product capability + safety semantics + deterministic evidence + proportional human-product evidence**, not only route/component existence;
5. resolve material spatial/interaction choices in the **real application on bounded branches** with synthetic/no-PHI realistic-density fixtures by default; do not invent detached prototype products unless genuinely necessary;
   - For a user-facing action/state/flow change, Cora pre-execution shaping also checks the bounded **action → visible response/retained state → next action → continuation/closure** chain for foreseeable disruption, hidden material information, lost state or affected supported consumers. Resolve material behavior into that ticket's handoff; reuse oracles, add only missing risk-specific evidence, verify spatial risk in a real browser/viewport, and HUMAN STOP on an unresolved material product choice. This is **Cora preparation under unchanged C-087**, not a new worker task, global UI audit or unconditional test gate;
6. use the current Atenea C-087 execution model in `AGENTS.md`;
7. after each REC ticket, update the matrix/plan disposition so context cannot silently narrow again;
8. REC-12 must first prove **source → matrix completeness** against both frozen audits + material v3 heritage, then re-audit all 88+42 (or explicitly reconciled later count) rows against the final product before recovery can be called complete.
