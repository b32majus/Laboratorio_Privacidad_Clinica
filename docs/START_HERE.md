# START HERE — Laboratorio de Privacidad Clínica

Status: **CURRENT PRODUCT / RECOVERY AUTHORITY**

Last reconciled: 2026-10-06

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
7. `REC-07 — BATCH-OUTPUT-PARITY-01`
8. `REC-08 — INPUT-PRODUCTIVITY-PARITY-01`
9. `REC-09 — APP-IA-REVIEW-PRODUCTIVITY-01`
10. `REC-10 — SPANISH-LOCALIZATION-01`
11. `REC-11 — VISUAL-SYSTEM-RECOVERY-01`
12. `REC-12 — RECOVERY-CLOSEOUT-01`

REC-05 is canonical after PR #76. The remaining REC-07→REC-12 recovery frontier is published inside **GitHub issues #79–#93**. Issues **#78, #79, #86 and #87 are CLOSED**; #79 merged by PR #96 at `3.0-main@30edfc3ca3c5deb585af82cc2d45a4bf03643e0a`, #86 merged by PR #97 at `3.0-main@2941b666007062ad1c4aa8e967046705864e143d` and completes REC-06 together with #78, and #87 merged by PR #100 at `3.0-main@ed61e319fe3d54529abe33d4d145454502e11257` restoring the batch Result readiness model plus deterministic Safe summary CSV. REC-07 remains incomplete because #88 (Safe ZIP/PDF packaging) and #89 (batch Confidential Audit) remain open. The accepted hard-dependency graph makes #80–#85, #88 and #89 executable. Under the accepted serial recovery preference, the selected frontier is now **#88 — REC-07 Batch Safe document deliverables: per-document ZIP + consolidated PDF**: it completes the prepared/shareable Safe side of REC-07 before the deliberately asymmetric Confidential remainder in #89. #89 and #80–#85 remain valid unblocked tickets, not the selected frontier. GitHub dependencies remain the semantic blocking graph; scheduling preference must not be rewritten as fake edges.

No new recovery ticket should be invented from memory. For the current frontier, use published issues #78–#93 plus the traceability matrix/master plan. Any newly discovered blocking obligation must first be reconciled into authority and ownership rather than silently appended to an implementation ticket.

## 5. Important current truths

- The text privacy engine is Spanish/Spain-oriented; the V4 UI being English is **not evidence that the recognizer dictionaries were translated to English**.
- REC-01 materially broadened the synthetic/no-PHI Spanish engine assurance corpus to **35 core + 4 adversarial cases** on the productive `createRegistryEngine()` path, with machine-visible type/slice coverage and deterministic precision/recall/F1/FNR evidence. It remains an assurance/regression gate, **not a universal statistical clinical-Spanish quality grade**.
- REC-02 completed all four accepted Privacy Policies for pasted text, single documents and document batches: External AI reduces date precision; Longitudinal Research applies one deterministic Job-scoped date shift while preserving ordering/intervals; Standard/Strict retain their accepted semantics. REC-03 then reused that same authority for structured `process-as-text` cells rather than inventing a second text-policy system.
- REC-03 restored structured semantics: the selected patient-ID becomes deterministic in-Job `ID_ESTUDIO` / `PAC_001…` in Safe output with Confidential-only correspondence; structured Class and productive Action are separate authorities; unresolved Unknown/quasi states remain fail-closed; and configured text-like cells route through the same REC-02 text engine + ReviewSession path. REC-04 then restored configurable Study-ID prefix/row-order `Visita_Num`, bounded smart workbook-header resolution, typed Safe structured values, factual structured summary, Safe XLSX and separate Confidential XLSX with deliberate confirmation.
- Batch V4 now has a canonical batch Result plus deterministic Safe summary CSV from #87 / PR #100. Consolidated Safe PDF and individual Safe ZIP remain #88, while batch Confidential Audit remains #89; REC-07 is therefore still incomplete.
- Structured output provides Safe CSV + Safe XLSX and separate Confidential TXT/XLSX with deliberate confirmation. REC-05 has now canonically restored single text/document Copy/TXT/DOCX/PDF plus deliberate Confidential confirmation. Batch-wide output parity remains REC-07, and the global Confidential-download safeguard (`H-42`) is open only for that batch surface.
- `Keep original` exists, but direct identifiers currently lack the frozen UX contextual confirmation/explanation before the original is kept in Safe Output; REC-09 owns that safeguard.
- New Privacy Job inference exists, but the frozen “allow override when necessary” clause is unresolved. REC-08 must either implement a bounded legitimate override or explicitly supersede it with deterministic/fail-closed routing rationale.
- V4 retains Sophilux ingredients (rose/warm surface tokens, Inter and Cormorant), but the original visual composition/design contract was not preserved as acceptance criteria. **Baseline hierarchy/density is now foundational for every touched surface**; REC-11 owns exhaustive visual-system closeout rather than postponing all visual correctness until the end.
- The current product UI is predominantly English despite `lang=es`. **Spanish human vocabulary is now foundational for every touched surface**; REC-10 owns exhaustive localization closeout rather than postponing all user-facing Spanish until the end.

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
6. use the current Atenea C-087 execution model in `AGENTS.md`;
7. after each REC ticket, update the matrix/plan disposition so context cannot silently narrow again;
8. REC-12 must first prove **source → matrix completeness** against both frozen audits + material v3 heritage, then re-audit all 88+42 (or explicitly reconciled later count) rows against the final product before recovery can be called complete.
