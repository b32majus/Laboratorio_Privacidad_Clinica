# Laboratorio Privacidad #91 — Tanda C: U5 GO → U6 Comprobación → U7 Resultado

**READY_TO_LAUNCH_U6 ONLY. U7 PREPARED, HUMAN STOP pending Cora + human U6 GO.**
Preparation record, not product modification or publication authority. 2026-10-13.

## 0. Explicit U5 visual GO and fixed route

- Cora inspected and accepted U5 candidate 7f7a492f9042f30a0274013eff9408dffa14978a (parent 8e97060f41f4af73025e47c515ba26d4f02f3592), its four real 1440/375 witnesses, three independent actual cell sessions, real fail-closed decisions and optional return to configuration.
- Human owner responded SI to approving U5 composition and deferring global aesthetic polish. U1–U5 are accepted as bounded visual-composition units; no approval of U6, U7 or complete #91 is implied.
- Worktree: /srv/kairos-lab/qualification/laboratorio-issue91-sophilux-c087-atenea148-20261012
- Branch: work/issue91-visual-system-c087-atenea148-20261012
- Parent of THIS docs-only handoff commit must be accepted U5 SHA 7f7a492f9042f30a0274013eff9408dffa14978a. U6 product commit parent must be clean preparation HEAD containing this handoff, fixed before dispatch.
- Atenea C-087 SHA: 462d461f3048a0ddf15aace1257d793fd52f1c48. cost_policy=go; risk_class=complex. Coordinator: atenea-go (opencode-go/deepseek-v4.1-flash). Exactly one FRESH atenea-implementer-go (opencode-go/muse-spark-1.3-contributor) for U6; different fresh writer for U7 only after explicit U6 GO. Local binding must match canonical. Run node tools/check-go-models.mjs from /srv/kairos-lab/Atenea before launch. Go bindings are qualification CANDIDATE, not promoted; no silent fallback/provider/model changes.
- Approved immutable authority: docs/design/sophilux-b-v1/ACCEPTED_VISUAL_CONTRACT.md and SOPHILUX_B_V1_FUNCTIONAL_RECONCILIATION.md D1–D4, VF-06/VF-07/VF-08; frozen previews/comprobacion-1440.png, comprobacion-375.png, resultado-1440.png, resultado-375.png; repo AGENTS.md and CODING_STANDARDS.md. All prototype HTML/CSS/JS frozen.

## 1. Sequence and canonical reviews

Dispatch ONLY U6. One author/one bounded local commit, genuine witness and focused evidence. STOP at READY_FOR_CORA_HUMAN_VISUAL_RECHECK_U6. Cora and human decide GO before U7. After their GO and fixed clean U6 SHA, run U7 with ONE different fresh implementer. STOP again at READY_FOR_CORA_HUMAN_VISUAL_RECHECK_U7 for Cora + human.

Preserve mandatory Standards and Spec exactly at approved FULL #91 fixed candidate review boundary, as established in #91 handoffs and current C-087 repository authority; neither intermediate visual GO substitutes for them. Once the full candidate is accepted visually, coordinator owns exactly ONE canonical Standards + Spec phase and only required finding-scoped correctors. No omission, moving reviews to Tanda C to economize, extra reviewers, duplicated candidate reviews or generic suites. If current authority actually conflicts, HUMAN STOP and reconcile before touching reviewer lifecycle.

## 2. U6 — optional real Privacy Check

Outcome: Optional CONTEXTUAL checkpoint when real shell makes it available, never an obligatory step or seven-tab prototype navigation. Show the exact current policy, pending decisions, batch active failure vs removed facts, kept-original warnings, actual Structured blockers and actual Safe/Confidential availability. Navigation remains governed by existing App TaskActionBar; do not invent an always-enabled next button or a fake ready/blocked toggle.

Material falsifiers and minimum proof: pending text or Structured claims ready; pending failure-free batch claims job errors; batch with all failures removed claims complete; result step offered while domain rejects it; viewport exceeds 375px; warnings hidden. Existing app-v4/src/privacy-gate/PrivacyGate.test.tsx protects real states and batch/Structured; e2e/gate-export-ux.spec.ts already exercises real gate navigation and width. Do not rewrite these tests.

### U6.1 — App.tsx

In BOTH existing sitebar/main width ternary conditions ADD ONLY this OR disjunct:
    || currentStep === "privacy-gate"
Retain all existing U1–U5 disjuncts and max-width branch strings untouched.

Only in the existing privacy-gate render branch with unchanged guard:
    currentStep === "privacy-gate" && job &&
    (activeReview !== null || isBatch || structuredGateInput !== null)
wrap the SINGLE existing PrivacyGate JSX in:
    <div className="sx-gate-task"> [current PrivacyGate node] </div>
Keep exact existing job, review, batchSessions, structured props, JSX keys/guards and all other branches. No TaskActionBar/route/state changes.

### U6.2 — PrivacyGate.tsx

In exported PrivacyGate ROOT replace exactly:
    <section aria-labelledby="privacy-gate-step-heading">
with:
    <section className="sx-gate-workspace" aria-labelledby="privacy-gate-step-heading">

In helper GateCheckpoint ONLY, prepend sx-gate-checkpoint to the existing dynamic section className (whose start is mt-5 rounded-xl border-2 p-4). Preserve every existing conditional expression, role, text, id and alert. NO change to derivePrivacyGateView, all-removed boundary, safe readiness, policy/count derivation, output facts, warnings or error state. No new controls.

### U6.3 — append literal U6 CSS in app-v4/src/visual/sophilux-v1.css

    /* #91 U6: optional factual checkpoint. */
    .sophilux-shell .sx-gate-task .sx-gate-workspace {
      display: grid;
      grid-template-columns: minmax(0, 1.25fr) minmax(330px, 0.85fr);
      gap: 16px;
      align-items: start;
    }
    .sophilux-shell .sx-gate-task .sx-gate-workspace > * {
      grid-column: 1 / -1;
      min-width: 0;
    }
    .sophilux-shell .sx-gate-task .sx-gate-workspace > header {
      grid-column: 1;
      padding: 22px;
      border: 1px solid var(--sx-line);
      border-radius: 14px;
      background: var(--sx-paper-muted);
    }
    .sophilux-shell .sx-gate-task .sx-gate-workspace > header h2 {
      font-family: var(--sx-serif);
      font-size: clamp(34px, 3.2vw, 45px);
      line-height: 1.06;
      color: var(--sx-ink);
    }
    .sophilux-shell .sx-gate-task .sx-gate-checkpoint {
      grid-column: 2;
      margin-top: 0;
      border-radius: 14px;
      background: var(--sx-paper);
      box-shadow: var(--sx-shadow);
    }
    @media (max-width: 1023px) {
      .sophilux-shell .sx-gate-task .sx-gate-workspace {
        grid-template-columns: minmax(0, 1fr);
      }
      .sophilux-shell .sx-gate-task .sx-gate-workspace > header,
      .sophilux-shell .sx-gate-task .sx-gate-checkpoint {
        grid-column: 1;
      }
    }

No global clipping or shared selectors.

### U6.4 — evidence and owners

Implementer once after bounded edit:
    npm run typecheck:v4
    npx vitest run app-v4/src/privacy-gate/PrivacyGate.test.tsx
    npm run format:check:v4
    git diff --check

Coordinator once on fixed U6 candidate for the known navigation/viewport consumer:
    npx playwright test e2e/gate-export-ux.spec.ts --grep "Gate and Export fit the viewport without horizontal overflow" --workers=2

Genuine browser witness: first real available optional Gate from existing committed synthetic user flow; factual pending and completed states without mock switching. Capture desktop 1440x900 and mobile 375x800 first viewport + fullPage for material changed Gate, 4 files and concise README under docs/evidence/issue91-u6. True counts, policy, available onward, first frame scrollY=0, page scrollWidth<=innerWidth, no global crop; one extra factual frame only if needed to prove blocked vs ready visually. Build once if dist stale. Compare frozen comprobacion previews for hierarchy, NOT simulated status/switch. Never claim completed based on visual badge alone.

U6 allowlist ONLY app-v4/src/App.tsx, app-v4/src/privacy-gate/PrivacyGate.tsx, app-v4/src/visual/sophilux-v1.css, docs/evidence/issue91-u6/. Protected: PrivacyGateModel, App TaskActionBar, Job/ReviewSession/domain, availability, configuration, outputs, tests, U1–U5 and visual source. Material red => HUMAN STOP (no automatic correction), U7 stays blocked.

## 3. U7 — Real Result, PREPARED but NOT executable before U6 GO

Outcome: one editorial presentation system for four existing materials: text (Copy primary), document (DOCX primary), batch (individual Safe PDF ZIP primary + consolidated PDF/CSV secondary when actually available), Structured (existing Safe CSV/XLSX only when ready). Must preserve exact current ready/needs-attention/blocked states, pending/failed details, material-specific primary, kept-original warning co-visible in the relevant Result context, distinct Confidential Audit with genuine request/Confirm/Cancel. Do not invent universal Copy, a new Safe preview, a new policy badge, certificate, downloadable bytes or implicit Confidential authorization.

Material falsifiers: document shows Copy as primary; needs-attention appears ready; preserved original warning suppressed; batch active error becomes available; Structured stale output offered; Confidential downloads before confirmation; async stale Job/policy/review download survives. Existing ExportStep.test.tsx and rec05-result.spec.ts are designated current oracle; other completed composed evidence for Batch/Structured may be reused, not rerun without material gap.

### U7.1 — App.tsx

After accepted U6, add only another condition in BOTH width expressions:
    || currentStep === "export"
In existing protected export render branch (currentStep === "export", job and actual activeReview/isBatch/structuredGateInput guard) wrap the existing single ExportStep node in:
    <div className="sx-result-task"> [existing ExportStep with EXACT six props unchanged] </div>
Keep handlers/onReturnToReview, output authority and navigation guards unchanged.

### U7.2 — ExportStep.tsx (exact three return root edits)

In StructuredExport one root:
    <section aria-labelledby="export-step-heading">
replace with:
    <section className="sx-result-workspace" aria-labelledby="export-step-heading">

In BatchResult AND SingleItemResult, both root occurrences:
    <section aria-labelledby="export-step-heading" data-result-state={view.state}>
replace EACH with:
    <section className="sx-result-workspace" aria-labelledby="export-step-heading" data-result-state={view.state}>

No other source edits to ExportStep. Preserve result status, all copy/download/async handlers, retained warnings, output formats and Confidential confirmation.

### U7.3 — append only literal scoped U7 CSS after approved U6

    /* #91 U7: editorial layout over real material-specific Result. */
    .sophilux-shell .sx-result-task .sx-result-workspace {
      display: grid;
      grid-template-columns: minmax(0, 1.2fr) minmax(330px, 0.8fr);
      gap: 16px;
      align-items: start;
    }
    .sophilux-shell .sx-result-task .sx-result-workspace > * {
      grid-column: 1 / -1;
      min-width: 0;
    }
    .sophilux-shell .sx-result-task .sx-result-workspace > header {
      grid-column: 1;
      padding: 22px;
      border: 1px solid var(--sx-rose-line);
      border-radius: 14px;
      background: linear-gradient(125deg, var(--sx-paper), var(--sx-rose-soft));
    }
    .sophilux-shell .sx-result-task .sx-result-workspace > header h2 {
      font-family: var(--sx-serif);
      font-size: clamp(38px, 3.5vw, 50px);
      line-height: 1.03;
      color: var(--sx-ink);
    }
    .sophilux-shell .sx-result-task .sx-result-workspace > section:first-of-type {
      grid-column: 2;
      margin-top: 0;
      border: 1px solid var(--sx-line);
      box-shadow: var(--sx-shadow);
    }
    .sophilux-shell .sx-result-task .sx-result-workspace > section[aria-labelledby="confidential-audit-heading"],
    .sophilux-shell .sx-result-task .sx-result-workspace > section[aria-labelledby="structured-confidential-heading"] {
      grid-column: 1 / -1;
      border-color: var(--sx-rose-deep);
    }
    .sophilux-shell .sx-result-task .sx-result-workspace[data-result-state="blocked"] > section:first-of-type,
    .sophilux-shell .sx-result-task .sx-result-workspace[data-result-state="needs-attention"] > section:first-of-type {
      border-color: var(--sx-rose-deep);
    }
    @media (max-width: 1023px) {
      .sophilux-shell .sx-result-task .sx-result-workspace {
        grid-template-columns: minmax(0, 1fr);
      }
      .sophilux-shell .sx-result-task .sx-result-workspace > header,
      .sophilux-shell .sx-result-task .sx-result-workspace > section:first-of-type {
        grid-column: 1;
      }
    }

No selector style can override disabled, aria, focus, warning contrast or Confidential separation. If actual first-viewport co-visibility of status+kept-original warning+CTA conflicts with this bounded recipe, HUMAN STOP rather than invent restructuring.

### U7.4 — focused proof and first visual witness

Implementer once:
    npm run typecheck:v4
    npx vitest run app-v4/src/export/ExportStep.test.tsx
    npm run format:check:v4
    git diff --check

Coordinator once after fixed candidate:
    npx playwright test e2e/rec05-result.spec.ts --grep "high-volume pasted text reaches one ready Result|a supported single document reaches a ready Result|a needs-attention Result states what remains|a deliberately kept original stays a factual Result warning|Confidential Audit first action" --workers=2

Re-use earlier focused Batch/Structured oracles, no repeat unless real gap; the existing result Vitest already proves batch and async guards. A remaining material gap requires Cora to name ONLY the minimal additional test, not generic suites. Build once if required for browser. First real Result with accepted original + real ready state using actual V4 App and existing test fixtures; four frames desktop/mobile viewport+fullPage and concise README in docs/evidence/issue91-u7/. Include actual material-specific primary, warning visibility and Confidential separation; ONE additional focused capture for a distinct material/state only if existing tests/evidence do not prove a material visual claim. Page no horizontal overflow or global clip. Visual comparison to resultado-{1440,375}.png, no fake seven-tab, fake totals or marketing certification.

U7 allowlist ONLY app-v4/src/App.tsx, app-v4/src/export/ExportStep.tsx, app-v4/src/visual/sophilux-v1.css, docs/evidence/issue91-u7/. Protected: all export serializers/builders/bytes, Job/policy, domain, output mappings, download/clipboard/async provenance guards, Confidential state, U1–U6, tests, approved HTML/CSS/JS and CI. Material red => HUMAN STOP.

## 4. Shared HUMAN STOP and closeout boundary

Wrong launch SHA/parent/branch or dirty tree; parallel writer; role/quota unavailable; U6 human GO absent for U7; unexpected affected code/test surface; semantic readiness change; new privacy/safety claims; fake session, output or CTA; actual negative browser evidence despite passing tests; material viewport violation => STOP with exact finding. One fresh writer per unit, one fixed local bounded commit per unit, no amend/rebase. No automatic corrector; diagnosed corrections require Cora literal prescription and required human authorization. No silent switch to Volume/Standard.

Formal canonical Standards+Spec MUST execute on the authorized complete #91 candidate after all seven units and their visual gates as this issue currently prescribes. Follow current Atenea lifecycle, tests and review/correction ownership with no efficiency exception. U7 visual GO does not equal formal technical approval.

No push, PR, merge, deployment, issue close, global polish or Go profile promotion without separate authority.
