# START HERE — Laboratorio de Privacidad Clínica

Status: **CURRENT PRODUCT / RECOVERY AUTHORITY**

Last reconciled: 2026-10-04

## 1. Where we are

The canonical clinical application is the V4 SPA on branch `3.0-main`. The accepted product architecture remains:

`Input → Configure → Review → Privacy Gate → Export`

V4 materially improves the original v3 in review authority, privacy-state integrity, fail-closed behavior, local-only runtime, structured hardening, testing and deployment security. However, the 2026-10-04 recovery traceability audit proved that **T25 legacy retirement established workflow/security parity, not full product parity**. Several v3 product capabilities and original UX-audit requirements were narrowed or lost while translating audit → specs → Work Orders.

Do not interpret “V4”, “T25 complete”, a green E2E suite, or a historical `DONE` debt row as proof of full product recovery.

## 2. Current authority order

For any new product/recovery work, use this precedence:

1. `docs/START_HERE.md` — current position and authority map;
2. `docs/RECOVERY_MASTER_PLAN_2026-10.md` — **single current recovery plan and execution order**;
3. `docs/audits/2026-10-recovery-traceability-matrix.md` — current traceability index: 88 frozen debt rows + 42 product/heritage capabilities after external falsification;
4. `docs/audits/2026-10-recovery-traceability-audit.md` — root-cause analysis and internal evidence narrative;
5. `docs/audits/2026-10-recovery-plan-external-adversarial-audit-sol61.md` — independent Sol 6.1 adversarial falsification and required-change evidence;
6. `docs/shaping/CURRENT_DECISIONS.md` — accepted architecture/product decisions, as amended by the recovery authority below;
7. relevant `docs/specs/SPEC_V4_*.md` — implementation contracts where they do not narrow the recovery contract;
8. accepted GitHub Work Order for the current REC ticket;
9. code + deterministic tests/oracles;
10. historical roadmap, T01–T25 task docs and legacy-retirement evidence — provenance only unless explicitly cited.

If an older spec/ticket is narrower than the recovery matrix for a capability being recovered, **the recovery plan/matrix wins for scope discovery**; implementation still requires a shaped Work Order with explicit acceptance criteria.

## 3. Recovery fixed point

Recovery was reconstructed from:

- original audited product: `3.0-main@331bcaf4a624659c77823a0c4b427d46347ea104`;
- frozen pre-refactor authority: `e164ca2`;
- V4 checkpoint audited on 2026-10-04: `3.0-main@6fb5eb1fb867e022acc68dd2be39b16bd531f27a`.

After independent adversarial reconciliation, the matrix contains **88 original debt/audit rows + 42 product/heritage rows**. After REC-03, **20 rows remain recovery-blocking**, all owned by the same 12 Recovery Work Orders. These counts are an index, not a completeness proof: REC-12 must re-check the frozen source audits + v3 heritage against the matrix before row-level closeout.

## 4. Current recovery train

Execution order and dependencies are authoritative in `docs/RECOVERY_MASTER_PLAN_2026-10.md`. The known recovery train is:

1. `REC-01 — SPANISH-ENGINE-ASSURANCE-01` — **COMPLETED**, merged by PR #66 at `3.0-main@2e641aa54797e97d8019aa0821518b17a078fc42`
2. `REC-02 — TEXT-POLICY-COMPLETION-01` — **COMPLETED**, merged by PR #68 at `3.0-main@4984040722f55062778b97e7351d2b8b43fe7ce7`
3. `REC-03 — STRUCTURED-SEMANTICS-RECOVERY-01` — **COMPLETED**, merged by PR #70 at `3.0-main@c67d1aede36c41bb9ff1a52ae785e9ab969e1202`
4. `REC-04 — STRUCTURED-IO-OUTPUT-PARITY-01` — **NEXT**
5. `REC-05 — SINGLE-OUTPUT-PARITY-01`
6. `REC-06 — BATCH-WORKFLOW-PARITY-01`
7. `REC-07 — BATCH-OUTPUT-PARITY-01`
8. `REC-08 — INPUT-PRODUCTIVITY-PARITY-01`
9. `REC-09 — APP-IA-REVIEW-PRODUCTIVITY-01`
10. `REC-10 — SPANISH-LOCALIZATION-01`
11. `REC-11 — VISUAL-SYSTEM-RECOVERY-01`
12. `REC-12 — RECOVERY-CLOSEOUT-01`

Current next Work Order: **REC-04 — STRUCTURED-IO-OUTPUT-PARITY-01**.

No new recovery ticket should be invented from memory. First locate the capability in the traceability matrix and either map it to the owning REC Work Order or explicitly amend the master plan.

## 5. Important current truths

- The text privacy engine is Spanish/Spain-oriented; the V4 UI being English is **not evidence that the recognizer dictionaries were translated to English**.
- REC-01 materially broadened the synthetic/no-PHI Spanish engine assurance corpus to **35 core + 4 adversarial cases** on the productive `createRegistryEngine()` path, with machine-visible type/slice coverage and deterministic precision/recall/F1/FNR evidence. It remains an assurance/regression gate, **not a universal statistical clinical-Spanish quality grade**.
- REC-02 completed all four accepted Privacy Policies for pasted text, single documents and document batches: External AI reduces date precision; Longitudinal Research applies one deterministic Job-scoped date shift while preserving ordering/intervals; Standard/Strict retain their accepted semantics. REC-03 then reused that same authority for structured `process-as-text` cells rather than inventing a second text-policy system.
- REC-03 restored structured semantics: the selected patient-ID now becomes deterministic in-Job `ID_ESTUDIO` / `PAC_001…` in Safe output with Confidential-only correspondence; structured Class and productive Action are separate authorities; unresolved Unknown/quasi states remain fail-closed; and configured text-like cells can route through the same REC-02 text engine + ReviewSession path. Configurable Study-ID prefix/`Visita_Num`, smart workbook headers and XLSX outputs remain REC-04 scope.
- Batch V4 currently has no accepted batch-wide Safe Output/Confidential Audit format. Recovery belongs to REC-07.
- V4 currently exposes single/structured output mainly as TXT/CSV + separate confidential TXT. Recovery of safe PDF/DOCX/XLSX and corresponding audit semantics belongs to REC-04/REC-05/REC-07; all identifiable Confidential downloads must regain the frozen UX additional-confirmation safeguard.
- `Keep original` exists, but direct identifiers currently lack the frozen UX contextual confirmation/explanation before the original is kept in Safe Output; REC-09 owns that safeguard.
- New Privacy Job inference exists, but the frozen “allow override when necessary” clause is unresolved. REC-08 must either implement a bounded legitimate override or explicitly supersede it with deterministic/fail-closed routing rationale.
- V4 retains Sophilux ingredients (rose/warm surface tokens, Inter and Cormorant), but the original visual composition/design contract was not preserved as acceptance criteria. REC-11 owns recovery of the clinical-workstation visual system.
- The current product UI is predominantly English despite `lang=es`; REC-10 owns complete Spanish localization after semantic/product surfaces stabilize.

## 6. What is NOT recovery scope

Do not inflate the recovery train with capabilities the original audits explicitly treated as later/advanced work, including OCR, optional local NER, FHIR JSON, ARX-lite risk analysis, layout-preserving PDF redaction, DICOM, institutional recognizer plugins, or cryptographic/HMAC research identifiers beyond what a recovery ticket explicitly needs. These remain future product debt/opportunities.

## 7. Historical documents

- `docs/ROADMAP.md` is the **2026-09 migration roadmap**. It explains why V4 exists but is superseded for current prioritization by the Recovery Master Plan.
- `odd/tasks/t01-*` through `t25-*`, `docs/execution/*` and legacy-retirement documents remain evidence/provenance. They are not the current product backlog.
- `docs/DEBT_REGISTER.md` remains a historical/live trace register, but **planning must not be derived from its status column alone**. Its 2026-10 reconciliation notes point back to the matrix when an old `DONE` was narrower than the product-level recovery requirement.

## 8. Execution rule

Before implementing a REC Work Order:

1. shape the Work Order from the exact matrix rows it owns;
2. preserve the current V4 safety/domain architecture unless the Work Order explicitly changes an authority;
3. define acceptance criteria for **product capability + safety semantics + deterministic evidence**, not only route existence;
4. use the current Atenea execution model in `AGENTS.md`;
5. after each REC ticket, update the matrix/plan disposition so context cannot silently narrow again;
6. REC-12 must first prove **source → matrix completeness** against both frozen audits + material v3 heritage, then re-audit all 88+42 (or explicitly reconciled later count) rows against the final product before recovery can be called complete.
