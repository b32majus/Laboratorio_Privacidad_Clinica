# Laboratorio V4 — PRODUCT FIDELITY FREEZE (2026-10-11)

> **STATUS: FROZEN — LOCAL EVIDENCE / LOCAL COMMIT ONLY.** This is a product/design checkpoint, **not** REC-12 source-completeness qualification, deployment clearance, a new product decision, or authorization to merge/launch another train.
>
> **Product inspected:** `7e9f7409dac531ddbf101fe708a302e3fbe6990f` (exact PR #114 head at capture).
> **Canonical integration at freeze:** `origin/3.0-main@3a2ad2c58c602620cc32dcedaae4ef69c47f0a7b`; PR #114 OPEN, NOT MERGED; #84 OPEN.
> **Atenea:** `main@8efc8f47f08749bc94a9e289af65b19cfdccbc6a`, PR #142 conditional rendered whole-screen fidelity. No Atenea repo mutation.
> **Authority:** `docs/audits/2026-10-product-design-reconciliation-final.md` (accepted 2026-10-05), `docs/HUMAN_PRODUCT_DESIGN_AUTHORITY_V1.md`, `docs/RECOVERY_MASTER_PLAN_2026-10.md`, `docs/shaping/CURRENT_DECISIONS.md`, September frozen UX/product audit and the recovery traceability matrix.
> **BOUNDARY:** no V4 product/architecture/policy/security code changed; no PR/issue/remote mutation in the freeze. All screenshot data synthetic/no-PHI. No new train selected.

## 1. Frozen product direction — do NOT regress

Accepted A-01…A-10/HPD-01…HPD-15: **Add information → prepare/review what requires human attention → Result**, adapted to text/document, batch, and structured. It is a human mental model, NOT a universal fixed stepper. V4's local-first privacy, ReviewSession, fail-closed decisions, structured Study-ID, current-state guards, policy semantics and Safe/Confidential separation remain immutable without explicit human decision.

Explicitly superseded **as mandatory product UI**: universal Input/Configure/Review/Privacy Gate/Export stepper; no-op text Configure and no-op structured Review; permanent four-policy cards; direct source-offset marking; per-column card wall as final scalable structured representation; Copy as universal primary action; mandatory new mockup/prototype app or fixed three-pane UI. Some superseded patterns **still exist in code** (Structured) and are IMPLEMENTATION DEBT, not accepted design.

Do not elevate the **September audit's proposed exact nav rail, stepper, three-pane geometry, layout sketches or color mockups** over the October final reconciliation: the October authority deliberately left precise geometry open. Evaluate behavior and composed visual hierarchy, not pixel parity against obsolete proposals.

## 2. Browser inspection and what it proves

One production build from the exact product SHA: `npm run build` PASS. Chromium desktop **1280×800**, local `vite preview` and network requests limited to localhost; no real patient data. Captures/metrics reside in `docs/audits/evidence/product-freeze-20261011/`.

| Surface | Real populated browser observation | Qualification |
|---|---|---|
| Input | First viewport has direct Pegar texto clínico / Elegir archivos, examples and intended-use explanation, under quiet shell. Document height **1,457 px**; the primary Create job control is not visible in the initial 800px screenshot. | **Implemented; visual priority needs REC-11 checkpoint**, not an intake-domain rewrite. |
| Text Review | **24/24 detections pending**, usable decision+document+metrics three-pane layout, total page **2,483 px**; the middle source/preview column is comparatively narrow and the right progress/filter column substantial. English operational labels visibly remain (`Document`, `Progress`, `Filters`, `Pending`). | **Functional/productivity delivered (#83/PR #113), visual density/hierarchy partial (#91), language partial (#90)**. Exact pane count remains an implementation choice. |
| Structured | Synthetic **32-column CSV**, **32 per-column detail/disclosure surfaces**, **0 comparative HTML tables**, full document **8,615 px** tall. Classification/Study-ID/error blockers exist, but columns cannot be compared as the accepted column × interpretation/treatment/state grid. `Configure`, `Configuration summary`, `Patient ID authority` and explanatory text still English. | **Material accepted-design mismatch confirmed**: #85 owns comparative workspace + no-op structured Review removal; #90 owns residual language; #91 visual coherence. |
| Batch | **12 synthetic documents** (10 text + 2 invalid/scanned PDF inputs), batch status list count 12; visible category controls `Todos (12)`, `Necesitan atención (12)`, `En curso (0)`, `Listos (0)`, `Retirados (0)` in the inspected moment. Rendered capture lands on the active document Review (not a standalone screenshot of the whole batch queue). | **Functional queue and local recovery already delivered (#78/#86, existing 12-item browser evidence)**; full composed visual queue parity is **not proven by this screenshot**, owned #91/#92. Do not reopen REC-06 as a fresh implementation train. |
| Single-item Result | Real ready Result, intentionally kept-original **type-only** warning, primary `Copiar texto preparado`, secondary formats subordinate, separate Confidential area below. In this inspected 1280px state: warning+state+primary are co-visible, with no visual Safe/Confidential equivalence. | **Representative Result state PASSES**; not a claim of all material/output states or all mobile/tablet views. Final #91/#92 owns breadth. |

Supporting screenshot names: `01-input-1280.png`, `02-review-24-detections-1280.png`, `03-structured-32-cols-1280.png`, `03b-structured-32-cols-full.png`, `04-batch-12-docs-1280.png`, `05-result-kept-original-1280.png` and `screen-metrics.json`. #84 correction's 375/1280 visual witnesses and CI remain their own separate evidence, not globally extrapolated.

## 3. Accepted PDR obligations — snapshot by evidence (not a new 88+42 row audit)

| Accepted obligation | Frozen status | Proof or gap | Owner |
|---|---|---|---|
| PDR-01 human task / no ceremonial steps | **PARTIAL** | Ordinary text/document no-op Configure removed by #84; code still exposes `StructuredReviewNotice` if no free-text review (`App.tsx`), an accepted non-destination. | #85 |
| PDR-02 productive dense Review | **DELIVERED FUNCTIONALLY / VISUAL PARTIAL** | #83 / merged PR #113; 24-detection viewport; content/current decision/metrics hierarchy still needs whole-task visual validation. | #91, #92 final |
| PDR-03 manual mark with no offsets | **DELIVERED** | #81 plus real Review surface; no offset-entry form as ordinary UX. | Preserve; #92 verify |
| PDR-04 structured comparative classification workspace | **NOT IMPLEMENTED** | 32 independent disclosure blocks, no comparative grid; 8,615px source. | **#85 PRIORITY 1** |
| PDR-05 coherent batch work queue and local recovery | **DELIVERED FUNCTIONALLY / VISUAL PARTIAL** | #78/#86, category filters and 12-doc run; batch-specific visual checkpoint remains. | #91/#92 |
| PDR-06 human Result / readiness / contextual primary | **DELIVERED IN REPRESENTATIVE SINGLE/BATCH STATES** | REC-05/07 outputs, #84 gate/Result continuity; complete state combinations remain final E2E. | #92 |
| PDR-07 quiet shell/contextual policy guidance | **DELIVERED ON #84 CANDIDATE** | Contextual task actions, collapsed details, current policy always discoverable; pending merge. | #84 integration; #91 composed |
| PDR-08 Spanish professional language | **PARTIAL** | English spans in Review, Structured, Privacy Gate, some status/ARIA text despite `<html lang="es">`. | **#90** |
| PDR-09 functional hierarchy & density | **PARTIAL** | Input initial fold / Review's narrow document surface / unscalable Structured; some Result hierarchy verified. | **#91**, #85 as foundation |
| PDR-10 realistic-density evidence | **PARTIAL** | 24 detections + 12 docs surfaced; 32 columns expose a genuine unscalable composition rather than a pass. | #85 then #92 |
| PDR-11 perceptible feedback/correctability | **PARTIAL COMPOSED** | Existing per-feature tests and #84 recovery pass; not a full cross-surface continuity proof. | #92 |
| PDR-12 Safe vs Confidential discrimination | **DELIVERED FUNCTIONALLY / VISUAL CLOSEOUT PENDING** | Distinct result zones and confirmation contracts; only one ready/kept-original screenshot inspected here. | #91 + #92 |

Status vocabulary: DELIVERED = grounded functional capability; PARTIAL = present but composition, language or breadth unqualified; NOT IMPLEMENTED = accepted human representation absent; DELIBERATELY SUPERSEDED = accepted Oct 5 override. **No global COMPLETED status is conferred by this checkpoint**.

## 4. Frozen work-gap register — no new issues and no expanding older issues

| Gap | Material action required, no generic investigation | Primary existing owner | Launch constraint |
|---|---|---|---|
| **FZ-01 / CRITICAL UI** | Replace repeated Structured column cards with a **scannable comparative column × class/treatment/state grid**; make effective action/blocker visible, technical evidence/overrides contextual; use 32-column synthetic case in the real browser. Preserve REC-03/04 and Study-ID. | **#85** | Pre-implementation accepts actual whole-screen task/hierarchy; witness first runnable populated composition under Atenea #142. |
| **FZ-02 / NO-OP** | Eliminate Structured Review **only when no free-text review task exists**; preserve actual free-text-cell review when present. | **#85** | No domain step elimination; only task-oriented navigation, verify continuation to Result. |
| **FZ-03 / LANGUAGE** | Translate visible professional UI and accessible labels/errors/help/policy/filenames as applicable (including Structured `Configure` and Review `Progress/Pending`), without changing technical policy authorities or invisible IDs. | **#90** | After #85 surface stabilizes. |
| **FZ-04 / WHOLE-SCREEN VISUAL** | Formalize accepted Inter + warm stone/rose design-system, density, semantic statuses, responsive continuity, no color-only state; check Input initial-fold priority, Review middle-document legibility and Batch queue composition. | **#91** | First runnable whole-screen witness during #85; final composed closeout after #85. Do not prescribe an unapproved fixed pane layout. |
| **FZ-05 / RESULT PARITY** | Finish complete states, material-specific output hierarchy, Confidential warning/confirmation and Safe separation across 375/desktop (and tablet if meaningful), keeping previously accepted #84 representative witness. | **#91 / #92** | Do not repeat single Result construction; close composed parity only. |
| **FZ-06 / TRACEABILITY** | FIRST source→matrix completeness: both September audits + material V3 heritage, then verify original **88 + 42 + PDR-12** obligations with recorded supersessions and full synthetic composed E2E. | **#92** | This freeze **does not substitute** for REC-12. |
| **FZ-07 / GUARDED SECURITY FOLLOW-UP** | `ExportStep.tsx` helpers `batchSummaryDiagnostic` and `batchSafeDiagnostic` use unexpected `Error.name` in a DOM diagnostic. **Potential** source-derived string exposure, NOT an observed real leak. Run one bounded adversarial sentinel and, if reproduced, fail-closed content-free diagnostic before #92 closeout. | **#92 or explicit bounded pre-#92 follow-up** | Do NOT retrofit into #85 or change serializers without the concrete witness. |
| **FZ-08 / GOVERNANCE** | Canonical branch/default ambiguity, docs/debt/roadmap/CI required checks and Render smoke. | **#93** | Only after #92 acceptance; #30 hosting experiment separate. |

## 5. Administrative reconciliation (not new feature debt)

- #83 is still an **OPEN GitHub issue** but its PR #113 is **MERGED** (merge `3a2ad2c58c602620cc32dcedaae4ef69c47f0a7b`). Confirm evidence and close administratively when authorized; do **not** rerun its implementation.
- #84 is **OPEN / PR #114 OPEN** at inspected SHA `7e9f740`. Seven CI checks were reported passing on that SHA; **not merged** at freeze. The freeze documentation cannot pretend it is part of canonical `3.0-main`.
- #85, #90, #91, #92 and #93 remain real open implementation/closeout issues; their ownership already covers the gaps above. #60 historical authority reconciliation and #30 hosting are separate operational/governance tracks, not reasons to inflate #85.
- Existing traceability matrix is an earlier historical snapshot; do not silently mark rows resolved from a ticket title, nor rewrite the old audit in place. #92 owns its authoritative final reconciliation.

## 6. Order, unlock criteria and anti-churn rule

**CURRENT FREEZE:** NO selection, handoff or launch of a new product train; NO opportunistic visual fixes inside the #84 publication; NO reticketization of implemented REC work.

**Step 0:** merge/close #84 only via its existing approved GitHub/human publication gate (separate authorization). Confirm `3.0-main` includes exact product candidate; carry this docs-only freeze forward from the isolated audit commit without rewriting the product branch. #83 is an administrative status correction, not product work.

**Step 1 — after freeze sign-off and #84 integration:** #85 is the next design-critical implementation. Its handoff must explicitly freeze **what must change AND what remains usable immediately after each action**: column inspection → classification/override → visible treatment/blocker → patient-ID authority → next column/free-text subtask → Result. Include the already-approved 32-column populated browser witness and trigger Atenea #142 conditional whole-screen checkpoint at the **first runnable composition**, not after further UI trains. HUMAN STOP only for truly unresolved clinical/product decisions; do not expand domain/privacy worker scope.

**Step 2:** #90 and #91 own exhaustive Spanish and one-app design coherence on stabilized surfaces. Their order may be coordinated, but **both must close before #92**. The #91 visual witness must compare the whole task composition in Input, Review, Structured, Batch, Result (not only controls or colors).

**Step 3:** #92 source completeness oracle, row-by-row proof, full composed E2E/privacy quality, bounded FZ-07 verification. **Step 4:** #93 governance/documentation/CI/publication.

**Anti-churn:** no new stand-alone UX audit/track, no generic repository-wide census or test expansion, no invented gates. For a risk, identify the precise accepted behavior, observed source consumer, minimal change, required continuation, existing proof and one material missing witness. Review the same bounded diff, not the whole product anew.

## 7. Freeze closeout

**Decision:** REC functional restoration substantially delivered; material visual/product alignment remains **PARTIAL**, with one confirmed high-priority representation gap (#85). This is a **freeze of knowledge and next-execution priorities**, not a declaration that the app is done or that all accepted rows passed. Hold the next train until the human accepts this snapshot and #84's PR publication is integrated into canonical V4.
