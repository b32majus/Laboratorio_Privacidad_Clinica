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
3. `docs/audits/2026-10-recovery-traceability-matrix.md` — exhaustive traceability: 88 frozen debt rows + 40 product/heritage capabilities;
4. `docs/audits/2026-10-recovery-traceability-audit.md` — root-cause analysis and evidence narrative;
5. `docs/shaping/CURRENT_DECISIONS.md` — accepted architecture/product decisions, as amended by the recovery authority below;
6. relevant `docs/specs/SPEC_V4_*.md` — implementation contracts where they do not narrow the recovery contract;
7. accepted GitHub Work Order for the current REC ticket;
8. code + deterministic tests/oracles;
9. historical roadmap, T01–T25 task docs and legacy-retirement evidence — provenance only unless explicitly cited.

If an older spec/ticket is narrower than the recovery matrix for a capability being recovered, **the recovery plan/matrix wins for scope discovery**; implementation still requires a shaped Work Order with explicit acceptance criteria.

## 3. Recovery fixed point

Recovery was reconstructed from:

- original audited product: `3.0-main@331bcaf4a624659c77823a0c4b427d46347ea104`;
- frozen pre-refactor authority: `e164ca2`;
- V4 checkpoint audited on 2026-10-04: `3.0-main@6fb5eb1fb867e022acc68dd2be39b16bd531f27a`.

The matrix contains exactly **88 original debt/audit rows + 40 product/heritage rows**. At shaping time, 28 rows were recovery-blocking and every blocker was assigned to one of the 12 recovery Work Orders below.

## 4. Current recovery train

Execution order and dependencies are authoritative in `docs/RECOVERY_MASTER_PLAN_2026-10.md`. The known recovery train is:

1. `REC-01 — SPANISH-ENGINE-ASSURANCE-01`
2. `REC-02 — TEXT-POLICY-COMPLETION-01`
3. `REC-03 — STRUCTURED-SEMANTICS-RECOVERY-01`
4. `REC-04 — STRUCTURED-IO-OUTPUT-PARITY-01`
5. `REC-05 — SINGLE-OUTPUT-PARITY-01`
6. `REC-06 — BATCH-WORKFLOW-PARITY-01`
7. `REC-07 — BATCH-OUTPUT-PARITY-01`
8. `REC-08 — INPUT-PRODUCTIVITY-PARITY-01`
9. `REC-09 — APP-IA-REVIEW-PRODUCTIVITY-01`
10. `REC-10 — SPANISH-LOCALIZATION-01`
11. `REC-11 — VISUAL-SYSTEM-RECOVERY-01`
12. `REC-12 — RECOVERY-CLOSEOUT-01`

No new recovery ticket should be invented from memory. First locate the capability in the traceability matrix and either map it to the owning REC Work Order or explicitly amend the master plan.

## 5. Important current truths

- The text privacy engine is Spanish/Spain-oriented; the V4 UI being English is **not evidence that the recognizer dictionaries were translated to English**.
- The current V4 ground-truth corpus is a useful regression gate but is intentionally small. It is **not yet a robust per-entity clinical-Spanish quality grade**; REC-01 owns that assurance gap.
- Structured V4 currently uses the patient-ID authority for policy/date processing but Safe Structured Output removes Identifier columns instead of producing the v3-style deterministic Study ID. Recovery of safe longitudinal linkage belongs to REC-03.
- Batch V4 currently has no accepted batch-wide Safe Output/Confidential Audit format. Recovery belongs to REC-07.
- V4 currently exposes single/structured output mainly as TXT/CSV + separate confidential TXT. Recovery of safe PDF/DOCX/XLSX and corresponding audit semantics belongs to REC-04/REC-05/REC-07.
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
6. REC-12 must re-audit all 88+40 rows against the final product before recovery can be called complete.
