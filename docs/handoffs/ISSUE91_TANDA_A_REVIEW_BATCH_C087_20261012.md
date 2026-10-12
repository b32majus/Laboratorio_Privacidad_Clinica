# #91 / REC-11 — TANDA A · Revisión U2a, después Lote U3a (2026-10-12)

**Status: READY_TO_LAUNCH_UNIT_U2A; U3a PREPARED BUT BLOCKED UNTIL CORA + HUMAN GO ON U2a.**
**NOT AN AUTHORIZATION to dispatch U3a now.** Single existing issue #91 and same existing local worktree. No new tickets, no release, no broad review loop.
The earlier narrower document docs/handoffs/ISSUE91_U2_REVIEW_FIRST_VISUAL_UNIT_C087_20261012.md remains provenance and safety context. This document is the EXECUTABLE, more specific Tanda A direction; on conflict, STOP instead of silently relaxing a protected constraint.

## 0. Exact inputs and immutable authorities

- Locked Tanda A prep parent: commit resulting from this document, to be given in the launch prompt. Parent of prep is 8b8e09a77b0209b5027ec9eb8cb78035e5008e7d; this is a docs-only update after the owner + Cora GO for U1 at fd71a5b215ff04e6a9d2312c045e84336aa88cca.
- Worktree: /srv/kairos-lab/qualification/laboratorio-issue91-sophilux-c087-atenea148-20261012; branch work/issue91-visual-system-c087-atenea148-20261012; product canonical ancestral base origin/3.0-main@78db715e158d731fa0cfb12ea466551072be5fdf.
- Atenea main /srv/kairos-lab/Atenea@462d461f3048a0ddf15aace1257d793fd52f1c48; C-087 PR #147 prescriptive correction / proportional unit and #148 Go/Free synchronization.
- Cost policy: standard, no paid-route escalation or Go/Free/Experimental selection. Risk class complex. Coordinator atenea-complex = nan/glm5.3-flash#high, fresh U2 writer atenea-implementer-complex = nan/glm5.3-flash#high. No silent substitution or mid-run profile/model change.
- Visual references, IMMUTABLE: docs/design/sophilux-b-v1/ACCEPTED_VISUAL_CONTRACT.md and previews/revision-1440.png / revision-375.png / lote-1440.png / lote-375.png, styles.css original source. Functional reconciliation: docs/design/sophilux-b-v1/SOPHILUX_B_V1_FUNCTIONAL_RECONCILIATION.md, D1/VF-02 Review; D2 batch row recovery.
- Original visual reference includes mock data/7-tab preview and simplified decision UI. NEVER implement its mock route, data, counts, policies, state or unguarded actions; use live React Job/ReviewSession state instead.
- U1 human + Cora GO is CLOSED for visual checkpoint. Do not edit settled Entry behavior or its evidentiary screenshots. U1 consumed 2/2 correction attempts. This batch authorization does NOT restore spent correction budget or authorize a new corrector; any new material defect → HUMAN STOP, Cora prescribes exact remediation, and human decides a new bounded work unit / correction authority.

## 1. Execution order (MUST NOT parallelize)

**U2a first, and ONLY U2a now.** Dispatch one new fresh implementer bound to atenea-complex, containing ONLY the numbered U2a instructions below. One checkpoint BEFORE any U3a writer. No second unit, no later unit, no general audit. The first successfully populated 24-detection browser witness is assessed before accumulating more Review code.
Return READY_FOR_CORA_HUMAN_VISUAL_RECHECK_U2A, with the fixed local SHA (one commit atop this preparation), actual screenshot paths and tests, then STOP. Obtain BOTH Cora GO and human GO. NO implicit approval from test green, old Sophilux freeze or the existence of this U3a recipe.

**After express U2a GO, and a clean fixed U2a commit**, the coordinator may dispatch U3a as the already-prepared NEXT unit without new aesthetic planning. Recheck U2a SHA/branch/clean tree and get fresh implementer (do not reuse U2 child), U3a scope and exact tests below. If U2a human GO requires changes of this recipe, HUMAN STOP for a revised handoff; never improvise. No simultaneous writers on this worktree. U3a ends with READY_FOR_CORA_HUMAN_VISUAL_RECHECK_U3A, STOP for Cora/human. U4, U5, U6, U7 remain NOT AUTHORIZED.

## 2. U2a — single-document Review composition (first dispatch)

**Result:** operational V4 Review (real job, exactly 24 actual detected findings from buildHighVolumeText), full selected detection/source/progress and immediate current decision. At 1440x900: editorial Sophilux heading, prominent ORIGINAL document pane on left, compact hallazgos/factual progress center, contextual decision inspector right. At 375x800: continue to present the *real* immediate decision without a long blocking 24-row scroll; do NOT copy the prototype mobile inspector-last hierarchy when it defeats current first-decision accessibility. No fake Review state or navigation.

### U2a.1 — app-v4/src/App.tsx (exact edit locations)
a. Locate the only two className conditions in sitebar and main:
    currentStep === "input" ? "max-w-[1350px]" : "max-w-5xl"
Replace EACH exact conditional expression with:
    currentStep === "input" || (currentStep === "review" && review !== null && !isBatch) ? "max-w-[1350px]" : "max-w-5xl"
Preserve all other branch widths. Apply Prettier as needed (formatting only).
b. Locate the single branch immediately following BatchReviewView:
    ) : currentStep === "review" && review ? (
      <ReviewWorkspace
        session={review}
        onDecide={session.decide}
        onAddManual={session.addManual}
      />
    )
Replace only its inner JSX element with a wrapper, preserving the three exact props:
    <div className="sx-review-task">
      <ReviewWorkspace
        session={review}
        onDecide={session.decide}
        onAddManual={session.addManual}
      />
    </div>
The conditional, BatchReviewView branch, StructuredFreeText branch, step accessibility and callbacks remain untouched.

### U2a.2 — app-v4/src/review/ReviewWorkspace.tsx (literal class additions ONLY)
a. In ReviewWorkspace root return, replace the existing section opening:
    <section ref={workspaceRef} onKeyDown={handleShortcut} aria-labelledby="review-step-heading">
with:
    <section className="sx-review-workspace" ref={workspaceRef} onKeyDown={handleShortcut} aria-labelledby="review-step-heading">
b. Inside the SAME ReviewWorkspace return, find role="region" aria-label="Espacio de revisión"; replace its exact existing className string:
    className="mt-4 grid gap-4 lg:grid-cols-3"
with:
    className="sx-review-grid mt-4"
c. In FilterProgressPane return (near line 697, under const progress = getProgress(session)), replace ONLY its first root div className:
    className="min-w-0 space-y-4"
with:
    className="sx-review-findings min-w-0 space-y-4"
d. In DocumentPane return (near line 852), make the SAME specific replacement there, but with:
    className="sx-review-document min-w-0 space-y-4"
e. In InspectorPane return (near line 995), prepend ONLY the static class sx-review-inspector to its existing className template literal, keeping ref, aria-label, tabIndex, focusRing, handlers and other utility tokens byte-equivalent. No reorder of component DOM children and no review logic edits.
f. DO NOT change keep-original confirmation, manual original Range offsets, focus/keyboard shortcuts, context-aware filtering, current selection, progress derivation, drafts or detection/readiness/status. No test deletion or softening.

### U2a.3 — app-v4/src/visual/sophilux-v1.css (append U2a block AFTER U1 rules)
Copy the following block verbatim. Root and every selector are scoped by .sophilux-shell .sx-review-task so they do NOT change the ReviewWorkspace reused in Batch or StructuredFreeText.

~~~css
/* #91 U2a: real single Review — approved three-area Sophilux composition. */
.sophilux-shell .sx-review-task .sx-review-grid {
  display: grid;
  grid-template-columns: minmax(0, 1.48fr) minmax(220px, .73fr) minmax(285px, .84fr);
  grid-template-areas: "document findings inspector";
  gap: 14px;
  align-items: start;
}
.sophilux-shell .sx-review-task .sx-review-document { grid-area: document; min-width: 0; }
.sophilux-shell .sx-review-task .sx-review-findings { grid-area: findings; min-width: 0; }
.sophilux-shell .sx-review-task .sx-review-inspector { grid-area: inspector; min-width: 0; }
.sophilux-shell .sx-review-task .sx-review-document > section,
.sophilux-shell .sx-review-task .sx-review-findings > section,
.sophilux-shell .sx-review-task .sx-review-inspector {
  border: 1px solid var(--sx-line);
  border-radius: 13px;
  background: var(--sx-paper);
  box-shadow: var(--sx-shadow);
}
.sophilux-shell .sx-review-task .sx-review-workspace > h2 {
  color: var(--sx-ink);
  font-family: var(--sx-serif);
  font-size: clamp(32px, 3.5vw, 46px);
  line-height: 1.05;
}
.sophilux-shell .sx-review-task .sx-review-grid [aria-current="true"] {
  outline: 2px solid var(--sx-rose-deep);
  outline-offset: 1px;
}
@media (max-width: 1023px) {
  .sophilux-shell .sx-review-task .sx-review-grid {
    grid-template-columns: minmax(0, 1fr);
    grid-template-areas: "inspector" "document" "findings";
  }
}
~~~

DO NOT introduce global overflow-x:hidden/clip, fixed-position CTA, blanket style for all ReviewWorkspace instances or a new React state machine. If specificity of an existing utility conflicts with a desired visual effect, report the EXACT selector/property first; only modify the U2a scoped CSS and class tokens above. No CSS applied to unrelated screens.

### U2a.4 — mandatory FIRST populated witness (before extending U2)
Use EXISTING fixture only: e2e/review-productivity.spec.ts builds 24 genuine findings via buildHighVolumeText in e2e/harness/flows.ts. Run actual V4 production build, create Job from textarea and Crear trabajo, wait for role=status aria-label=Progreso de la revisión showing Total:24 and Pendientes:24. Verify inspector role=complementary name=Inspector del hallazgo, selection source original 12345670A, decision Pendiente, and the document group name Texto del documento con hallazgos. No demo sample; no PHI.
Capture actual 1440x900 AND 375x800 first-viewport with window.scrollTo({top:0,left:0,behavior:"instant"}) + verified window.scrollY===0, fullPage:false. Also 2 fullPage:true screenshots. Put under docs/evidence/issue91-u2/ with README showing viewport/frame, populated fixture/selection, true state/24 progress, width no-overflow/clip, and comparison to previews/revision-{1440,375}.png. If full mobile reference clashes with immediate decision, document the precise difference; DO NOT alter semantics/previous E2E in order to hide it. Compare 1440 header+first task against source reference, including actual first decision reachability.
Focused tests, once per candidate when feasible:
    npm run typecheck:v4
    npx vitest run app-v4/src/review/ReviewWorkspace.test.tsx
    npx playwright test e2e/review-productivity.spec.ts --workers=2
    npm run format:check:v4
    git diff --check
Build ONCE before Playwright if the repo preview serves stale dist; do not run the whole 15-spec Playwright matrix, all Vitest, or unrelated Suites.
Allowed U2a implementation paths ONLY: app-v4/src/App.tsx, app-v4/src/review/ReviewWorkspace.tsx, app-v4/src/visual/sophilux-v1.css, new docs/evidence/issue91-u2/ screenshots+README. No changes to focused tests unless an explicit Cora-authored test-only correction is separately authorized. Commit one bounded U2a candidate, clean tree, no push. STOP for Cora+human GO.

## 3. U3a — Lote composition, PREAUTHORIZED RECIPE but NOT RUNNABLE until U2a human GO

**Expected real result (first populated, not demo):** 12-document work queue (10 existing synthetic TXT jobs requiring review + corrupt.pdf and sample-scanned.pdf as two genuine local failures), honest default Necesitan atención(12), each name/status/error visible, real actionable retry only with domain+bridge context, acknowledge != resolved, confirm removal separate. On 1440x900 queue panel LEFT and active successful document+contextual Review RIGHT. On 375x800 queue/filter/status remain reachable, selected session can be reached without imaginary Review for error rows. Follow previews/lote-{1440,375}.png for identity and high-level layout but DO NOT copy 7 fake demo item statuses/counters/primary action.

### U3a.1 — app-v4/src/App.tsx (specific React wrapper and width)
a. In the two sitebar/main conditional className strings, find the U2a expression installed in §2.1.a and replace only its conditional with:
    currentStep === "input" || (currentStep === "review" && (isBatch || review !== null)) ? "max-w-[1350px]" : "max-w-5xl"
This expands Batch width, does not change Input or the other routes.
b. Wrap ONLY the existing BatchReviewView branch (under currentStep === "review" && isBatch && job) in:
    <div className="sx-batch-task">
      <BatchReviewView ...EXACT ORIGINAL PROPS AND HANDLERS... />
    </div>
Here the ellipsis indicates the existing JSX of the component MUST be preserved verbatim, not replaced with a dummy or pseudo-component. Insert the literal opening tag before the existing <BatchReviewView and the closing tag immediately after its current />. Leave the true callback bridge guards intact.

### U3a.2 — app-v4/src/review/BatchReviewView.tsx (layout wrappers; preserve JSX internals)
a. Root return at approx. line 393:
    <section aria-labelledby="batch-review-step-heading">
becomes:
    <section className="sx-batch-review" aria-labelledby="batch-review-step-heading">
b. Immediately before the ONE existing <section aria-label="Documentos del lote" ...> (around line 414), insert:
    <div className="sx-batch-grid">
Do not move the errorMessage alert before this wrapper or move the factual filter, counts or feedback outside its queue.
c. Within that exact queue <section>, add class token sx-batch-queue to the existing className; do not remove the existing class tokens. Queue stays first direct grid child, with exact filter, list, retry/remove/acknowledge handlers and count derivation.
d. Immediately after the matching queue </section> (around line 613) insert:
    <div className="sx-batch-current">
The existing activeOutsideFilter status and activeSession ? <ReviewWorkspace ... /> : <p ...> region stay INSIDE this contextual div. After that conditional closes (around line 642), insert:
    </div>
    </div>
before the original root </section>. No condition rewrite, no new error selection, no new data state.
e. Existing nested ReviewWorkspace already has presentation class tokens from U2a, but only .sx-batch-task-scoped styles below apply. Keep per-document session authority, selection, pending and manual review unchanged. Error with no ReviewSession MUST remain a truthful queue error row/context message, not a faux ReviewWorkspace.

### U3a.3 — app-v4/src/visual/sophilux-v1.css (append U3a block AFTER U2a)
~~~css
/* #91 U3a: REAL multi-document batch, queue + authorized current Review. */
.sophilux-shell .sx-batch-task .sx-batch-grid {
  display: grid;
  grid-template-columns: minmax(270px, .68fr) minmax(0, 1.32fr);
  gap: 14px;
  align-items: start;
}
.sophilux-shell .sx-batch-task .sx-batch-grid > * { min-width: 0; }
.sophilux-shell .sx-batch-task .sx-batch-queue,
.sophilux-shell .sx-batch-task .sx-batch-current > .sx-review-workspace .sx-review-grid > *,
.sophilux-shell .sx-batch-task .sx-batch-current > .sx-review-workspace {
  min-width: 0;
}
.sophilux-shell .sx-batch-task .sx-batch-queue {
  border: 1px solid var(--sx-line);
  border-radius: 13px;
  background: var(--sx-paper);
  box-shadow: var(--sx-shadow);
}
.sophilux-shell .sx-batch-task .sx-review-grid {
  display: grid;
  grid-template-columns: minmax(0, 1.12fr) minmax(220px, .88fr);
  grid-template-areas: "document inspector" "findings findings";
  gap: 12px;
  align-items: start;
}
.sophilux-shell .sx-batch-task .sx-review-document { grid-area: document; min-width: 0; }
.sophilux-shell .sx-batch-task .sx-review-findings { grid-area: findings; min-width: 0; }
.sophilux-shell .sx-batch-task .sx-review-inspector { grid-area: inspector; min-width: 0; }
@media (max-width: 1120px) {
  .sophilux-shell .sx-batch-task .sx-batch-grid {
    grid-template-columns: minmax(0, 1fr);
  }
}
@media (max-width: 720px) {
  .sophilux-shell .sx-batch-task .sx-review-grid {
    grid-template-columns: minmax(0, 1fr);
    grid-template-areas: "inspector" "document" "findings";
  }
}
~~~
The accepted mobile queue-first context is the intended position at 375. No document-wide horizontal scrolling or overflow clipping. Do not remove any failure controls, hide filters under a non-operable drawer, reorder rows by fake priority, or claim errors reviewed/ready. Selected current session must remain honest.

### U3a.4 — U3a evidence after U2a human GO
Use existing e2e/batch.spec.ts test named:
    batch work-queue orientation (#86): realistic 12-document batch is orientable without scanning the list
It creates the 10 TXT + two PDF failures via exact committed fixtures, no PHI, with selected/failed/recovered states. Capture the REAL initial 12-item queue with counts, a selected valid Review context, and a known failed row (read error without session) at 1440x900 and 375x800. For each width: scrollY=0 first viewport + fullPage image. Store in docs/evidence/issue91-u3 with a README enumerating viewport vs full, true fixture/status/filter/selected/failed, screenshot comparison to previews/lote-{1440,375}.png, page scrollWidth <= viewport, no global clip, no fake Review for failed items. A second focus image for the actual error row is allowed if the initial default screen does not expose it.
Focused commands:
    npm run typecheck:v4
    npx vitest run app-v4/src/review/BatchReviewView.test.tsx
    npx playwright test e2e/batch.spec.ts --grep "batch work-queue orientation|a failed batch item stays visible" --workers=2
    npm run format:check:v4
    git diff --check
Use npm run build once before E2E if preview dist stale. DO NOT execute rec87-batch-result.spec.ts or full E2E matrix for this visual subunit: result/export stays out of scope and is integration/publication evidence. No weakening negative tests, queue category assertions, retained error after acknowledge, conditional retry or confirmation behavior.
Allowed U3a paths ONLY: app-v4/src/App.tsx (two specified width conditions and Batch JSX wrapper only), app-v4/src/review/BatchReviewView.tsx (layout wrappers/classes only), app-v4/src/visual/sophilux-v1.css (U3a block only), docs/evidence/issue91-u3/ (screenshot + README). Do not touch U2a classes/JSX; they may be reused but not remodeled. Commit one clean local U3a candidate atop human-accepted U2a SHA. STOP and hand evidence to Cora/human.

## 4. DO NOT TOUCH / HUMAN STOP / efficiency

Absolute protected: docs/design/sophilux-b-v1 approved sources and screenshot manifests; all settled U1 Entry; all ReviewSession logic in js/domain/review-session.js, review-domain.ts and reviewWorkspaceModel.ts; domain/job.ts, useJobSession.ts, engine, clinical/policy/identifier classifiers, persistence, export serialization/bytes, Safe/Confidential access, structured/cell/Gate/Result components, AGENTS, opencode.json, .opencode, Atenea profiles, CI/workflows and deployments. No new backend/API, route, fake clinical data, fake source or new global overflow hide. No commits/rebase/push/PR/merge/issue close/deploy by coordinator except local bounded code commits for U2a/U3a at their authorized stage.

Every diagnosed discrepancy must be reported with exact changed file, hunk anchor, literal before/after (if known), invariant and focused proof. If a safe edit is not known, ask for a bounded diagnosis only; no speculative correction. Keep no-op semantics separate from visual state. Human STOP when a snapshot is not a real populated app; U2a would displace immediate mobile Review decision; U3a would show a failed file as reviewable; required count mismatch; semantic logic needed; specified tests fail; another role/profile requested; active repo drift or additional correction required with spent budget.

Coordinator accounts for each unit: measured wall time, actual model-role pairing, reviewer findings only when final candidate reaches canonical review, corrections (none silently budgeted), human effort, tokens if runtime exposes them or explicit unavailable. Do not fabricate measurements.

U2a STOP = READY_FOR_CORA_HUMAN_VISUAL_RECHECK_U2A.
Only after explicit human GO: U3a STOP = READY_FOR_CORA_HUMAN_VISUAL_RECHECK_U3A.
Formal fixed-candidate Standards/Spec and composed tests remain at the end of complete #91 train, not repeated for each design unit.
