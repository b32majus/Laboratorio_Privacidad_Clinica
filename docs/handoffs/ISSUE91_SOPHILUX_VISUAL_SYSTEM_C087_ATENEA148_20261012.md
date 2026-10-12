# Cora handoff — #91 REC-11 · Sophilux B V1 operational visual-system closeout

Status: READY_TO_LAUNCH_LAB_REC11_91_ATENEA_148 — **UNIT 1 ONLY, mandatory Cora + human visual STOP before any later material unit**.
Date: 2026-10-12. Preparation and authority sync only; no implementation, push, PR, merge, release, issue closure or deployment by preparation.

## Exact authority, environment and cost

- Product canonical base: origin/3.0-main at 78db715e158d731fa0cfb12ea466551072be5fdf (includes merged #90 PR #120; #83/#85 issue closures reconciled 2026-10-12).
- Human-approved visual-source freeze: docs/sophilux-b-v1-visual-freeze-20261012 at c4acb4e5f6aed8ab61df15dca62ade08eace7892, already an ancestor of product canonical base. This is provenance, not the new working base.
- Immutable visual authority: docs/design/sophilux-b-v1/ACCEPTED_VISUAL_CONTRACT.md; index.html, styles.css, app.js and previews/ including entrada-1440.png and entrada-375.png. Exact approved visuals; browser prototype tabs and mock actions are NOT product behavior.
- Human-ratified functional bridge: docs/design/sophilux-b-v1/SOPHILUX_B_V1_FUNCTIONAL_RECONCILIATION.md D1–D4 and VF-01..VF-08. Superior clinical/privacy/product authority: docs/HUMAN_PRODUCT_DESIGN_AUTHORITY_V1.md and AGENTS.md.
- Atenea canonical: /srv/kairos-lab/Atenea at main 462d461f3048a0ddf15aace1257d793fd52f1c48 (PR #147 proportional units and prescriptive repair; PR #148 revised Go/Free candidates). Local copies of affected Go/Free profiles/agents reconciled; Standard models unchanged. CLI 2.0.26.
- **Human/project existing cost policy: standard (inherited default, no newly requested Go/free/experimental opt-in). Risk class: complex, justified by coherent composition across connected real interaction states, user-facing clinical/privacy readiness and multi-consumer visual hierarchy. This is not authority to change cost policy or pay for a fallback.**
- Visible native OpenCode coordinator: atenea-complex, model nan/glm5.3-flash#high. Writer atenea-implementer-complex: nan/glm5.3-flash#high. Explorer atenea-explorer: nan/qwen3.8-flash. Standards atenea-review-standards: openai/gpt-6-luna#high. Spec atenea-review-spec-complex: openai/gpt-6.1-sol#high. Corrector atenea-corrector-complex: fresh nan/glm5.3-flash#high. Mechanical merger atenea-merger: nan/mimo-v2.6-flash. No silent fallback, no mid-unit profile switch.
- This handoff is implementation authority only for the bounded Unit 1 below. A longer ticket does not justify delegating all seven views at once. Review/corrections follow C-087 phase ownership, not seven independent review loops.

## Human result / bounds for all of #91

Implement the ALREADY APPROVED seven visual compositions on the operational React/V4 application: Entrada, Revisión, Lote, Estructurado, texto libre en celdas, Comprobación contextual and Resultado. One coherent Sophilux B V1 system using warm stone/cream, rose-deep for purposeful actions, operational Inter, restrained editorial Cormorant in entry/Result, accessible semantic states, desktop task density and responsive 375px continuity. Preserve material/state-specific actions and explicit confidential download; no seven-step demo navigation, no invented ready/busy state, no whole-app reskin.

The existing mock source is visual reference only. The real V4 state machines, classifier, ReviewSession, privacy policies, consent, Job, download readiness, output formats and bytes outrank fake prototype controls. Visual source may not be edited.

## FIRST EXECUTABLE UNIT — U1 (the only authorized dispatch now)

Deliver the **real V4 Entry + application shell** composition corresponding to approved Entrada (VF-01 + VF-08), with populated and empty variants. Keep professional initial text/file intake, honest session/policy context, accessible primary creation CTA and real user affordances. Desktop around 1440 x 900: editorial identity/story to the left of the immediate genuine input area, not an extra landing step; functional intake compact enough for task completion. At 375 x 800: identity, Nuevo trabajo / Borrar sesión, real file/text entry and primary CTA must reflow without page-wide horizontal overflow. Do not hide the bug with document/body overflow-x clipping. Only the explicitly labeled Structured table may later scroll inside its own region.

**Pre-identified implementation anchors (no broad file archaeology):**
- app-v4/src/App.tsx: App header/shell around lines 936–1010; InputStep around lines 1760–2080; retain current IDs, accessible names, actions and order of actual controls.
- Optional new narrowly scoped presentational stylesheet app-v4/src/visual/sophilux-v1.css, imported by App.tsx. Reuse exact visual token values from the approved styles.css and scope new selectors under entry/shell classes. If that stylesheet is unnecessary, do not create it. Do not globally recode every component or change theme architecture in U1.
- Only if a literal UI change requires it: the corresponding existing input/shell tests in app-v4/src/App.input-start.test.tsx, app-v4/src/App.test.tsx, and e2e/input-start.spec.ts. Do not preemptively rewrite tests or weaken role/visibility/negative assertions.

**Exact behavior to keep:** empty initial draft (never prefill synthetic patient data); examples merely fill the text draft; Pegar stays browser-local with Ctrl+V fallback and stale-read protection; drag and file-picker converge on same draft; zero-file drop does not discard staged files; text/files are mutually exclusive; creating a job requires valid input; Nuevo trabajo and Borrar sesión retain distinct semantics; real policy remains selectable only when permitted; errors remain visible; all data in-memory only; focus/keyboard and correct labels remain. No new arbitrary navigation, no simulated file upload/analysis, no claims of guaranteed anonymity or security.

**U1 deliverable to Cora + human (STOP before U2):**
1. One independently inspectable U1 commit/working result with exact changed paths and evidence; do not publish it.
2. Capture **real Chromium V4 screenshots** from the actual running application using synthetic/non-PHI material: no-job empty Entry and populated text draft by choosing an existing synthetic example, at both 1440 x 900 and 375 x 800. Store screenshot artifacts in a repository-local issue91 evidence directory (not outside the child worktree). Annotate which screenshot shows empty vs populated and the viewport.
3. Compare against approved docs/design/sophilux-b-v1/previews/entrada-{1440,375}.png for compositional hierarchy and identity, not mock buttons or pixel identity. Report any adaptation made for real controls. At 375 assert document.documentElement.scrollWidth <= window.innerWidth (no global clipping); check the actual primary task and controls remain visible/reachable.
4. **Focused writer proofs, owned by implementer:** npm run typecheck:v4 ; npx vitest run app-v4/src/App.input-start.test.tsx ; npx playwright test e2e/input-start.spec.ts --workers=2. Adapt only real changed accessible-name assertions, preserve negative guards. Do not run full Vitest, full Playwright matrix or seven-component test bundles. If existing focused E2E already proves the no-overflow/functional path, reuse it; do not create duplicate test suites.
5. **Coordinator checks** U1 scope, result, and focused evidence; delivers screenshot/real-browser comparison, specific differences, duration and measured token/model consumption; then stops. Cora + human make explicit **GO/NO-GO** on populated actual composition. No other visual unit may begin before that approval. This checkpoint does not automatically consume the final Standards/Spec review; formal canonical review is on fixed candidate when appropriate under C-087.

## Ordered follow-on units, NOT YET AUTHORIZED FOR DISPATCH

After Cora + human U1 GO, prepare exact next local unit and proofs, do not reinterpret broad #91 as one writer request. Intended order and material witness (each protects approved D/VF):
- U2 Review: existing ReviewWorkspace real 24+ detections, document > findings > contextual inspector, decisions/notes/manual capture/keep-original; screenshot of populated real Review and existing focused Review E2E.
- U3 Batch: 12-document real mixed queue; error row without ReviewSession shows incident details, not fake Review; per-item recover/acknowledge/retire actions truthful.
- U4 Structured: multi-sheet/header chooser where relevant; comparative 32-column table and inspector, true allowed-actions/Study-ID/date roles, table-only local horizontal scroll.
- U5 Structured free-text cells: actual routed subtask with three cells, meaningful return and failure states; absent when no cells.
- U6 Privacy check: optional contextual factual readiness (never compulsory gate or mock toggle).
- U7 Result: actual text/document/batch/structured variants and ready/needs-attention/blocked; safe output primary by material, original-retained notice co-visible, Confidential audit isolated with real confirmation. Final cross-surface visual/tokens coherence.

For each material new composition, obtain its first actual populated witness before stacking subsequent material changes; Cora escalates material mismatches to the human instead of letting the worker redesign the approved V1. Do not multiply tickets or reviews by routine. Existing scoped tests first; broader composed/CI evidence at integration/publication.

## Authority and human STOP

DO NOT TOUCH: docs/design/sophilux-b-v1 original approved HTML/CSS/JS, screenshots/manifest or frozen accepted contracts; app-v4/src/domain/job.ts, useJobSession.ts, engine, ReviewSession/domain decisions, clinical policy mappings, identifier classifiers, structured semantics/date/Study-ID, persistence, serializers/writers/export bytes and headers, safe/confidential authorization, opencode.json, .opencode/agents, shared OpenCode/Matt/Atenea routing, deployments, CI and repository governance.

HUMAN STOP with exact file/location/observed state when a real clinical/privacy permission or visual-fidelity conflict demands different behavior, any new page or action not approved, a proposed global overflow crop, changes to task semantics, missing visual fixture, failure of a required model, unresolved 375px operation/contrast/focus or missing real screenshot. Do not infer product decisions. If Cora knows a defect, any correction prescription must include exact edit anchors and before/after text/code, behavior protected, DO NOT TOUCH and one focused proof; if not known, request only bounded diagnostic. At most two fresh finding-scoped correctors when formally applicable; never restart a broad review/fix carousel.

## Launch control and evaluation

Human operator launches from this worktree after exact HEAD clean-tree preflight and manually selects atenea-complex. Paste the short prompt referencing THIS repo-local handoff. This is a handoff, not a request to publish. Coordinator must delegate ONLY U1 to the bound implementer, require the real early witness, and STOP for Cora + human before U2. No implementer push/PR/merge/issue close/deploy.

Return fixed U1 SHA, parent/base, paths changed, focused checks and actual screenshots/viewport notes; duration, real model/session usage, token accounting if available, and any findings. When the final candidate eventually reaches canonical Standards/Spec, report their distinct findings and correction rounds separately; do not invent those outcomes at U1. The new Go/Free route introduced in Atenea #148 remains unqualified and unused in this Standard Complex Train.
