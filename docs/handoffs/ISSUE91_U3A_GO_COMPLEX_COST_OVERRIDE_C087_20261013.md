# Laboratorio Privacidad #91 / REC-11 — U3a Go cost override, Complex risk (2026-10-13)

**STATUS: READY_TO_LAUNCH_U3A_GO_COMPLEX. Docs-only preflight; no agent dispatch.**

## Explicit human choice and exact supersession

After U2a human visual GO the human requested balancing token consumption through Atenea Volume or Go. Cora selected Go cost policy with Complex risk for the already-approved U3a Lote, to preserve the true selected-document state, genuine read failures, conditional retry/acknowledgement/removal, and responsive interactive composition.

This record overrides ONLY the cost-policy and model-role instructions (standard / atenea-complex / atenea-implementer-complex and the no-Go route restriction) for U3a in:
- docs/handoffs/ISSUE91_TANDA_A_REVIEW_BATCH_C087_20261012.md
- docs/handoffs/ISSUE91_U2A_HUMAN_GO_U3A_ACTIVATION_20261013.md

All literal U3a JSX/CSS edits, acceptance, evidence, focused tests, DO NOT TOUCH and HUMAN STOP instructions in original handoff sections 3 and 4 remain binding. U1 and U2a are frozen. U2a accepted candidate is 6c28de22efecbd4022f5abbeb5181e533edb87c9; the human GO record is the parent 892a9bd61ce01bb09c5fc2d3f9d9926192a1ae29.

## Route / qualification

- Cost policy: go. Risk class: complex. Neither risk nor acceptance is downgraded.
- Coordinator: atenea-go = opencode-go/deepseek-v4.1-flash.
- ONE fresh bounded implementer: atenea-implementer-go = opencode-go/muse-spark-1.3-contributor.
- Correction, if separately authorized after a real finding and HUMAN STOP: atenea-corrector-go-complex = opencode-go/deepseek-v4.1-flash. No automatic correction dispatch.
- Existing later final #91 review policy is untouched; do NOT execute Standards/Spec at U3a checkpoint.
- Atenea C-087 pin: 462d461f3048a0ddf15aace1257d793fd52f1c48.
- Go bindings revised on 2026-10-12 are a qualification CANDIDATE, not inherited 2026-10-10 operational qualification. This bounded human-selected use cannot itself prove end-to-end Go qualification or claim quality equivalence. No automatic profile/model change, fallback, quota router or promotion.
- Before launch use canonical Atenea check: cd /srv/kairos-lab/Atenea && node tools/check-go-models.mjs; model presence does not prove quota. A missing bound model or unavailable quota is HUMAN STOP at clean boundary.

## Approved product result and boundaries

Execute ONLY section 3, U3a, from the pre-approved Tanda A handoff, with section 4 guardrails. Actual 12-document work queue: ten existing synthetic TXT and corrupt.pdf plus sample-scanned.pdf as two genuine failed reads. The default Necesitan atención (12), filters, counts, successful selected Review context, error rows, acknowledge != resolved, gated retry and explicit remove confirmation must remain truthful. The error row must never synthesize a ReviewSession; selecting documents must not change another document review state. Mobile queue-first context, no page horizontal overflow, no global clipping.

Exact allowlist:
- app-v4/src/App.tsx: two U3a width conditionals plus BatchReviewView wrapper only; preserve all handlers and U2a single-Review branch.
- app-v4/src/review/BatchReviewView.tsx: scoped wrappers and classes only; preserve existing list, all selectors/handlers, error states and activeSession conditional.
- app-v4/src/visual/sophilux-v1.css: append only the exact U3a CSS section from accepted handoff.
- docs/evidence/issue91-u3/: truthful screenshot and README evidence only.

DO NOT TOUCH any other source, test, visual reference, earlier evidence, review state, data model, policy, export/verification, AGENTS/opencode config or U1/U2a design.

## Exact focused evidence and assigned responsibilities

Implementer (once per candidate):
    npm run typecheck:v4
    npx vitest run app-v4/src/review/BatchReviewView.test.tsx
    npm run format:check:v4
    git diff --check

Coordinator (once, after writer result):
    npx playwright test e2e/batch.spec.ts --grep "batch work-queue orientation|a failed batch item stays visible" --workers=2

Build once first if current preview dist is stale. The e2e/batch.spec.ts existing 12-file witness grounds four actual viewport/fullPage screenshots at 1440x900 and 375x800, and README with genuine state/selection/error, default queue/filter, no fake session, no horizontal document overflow or hidden global clip. Stop if first populated witness fails; no opportunistic full suites or unrelated test repair.

## Hard execution boundary

Prelaunch parent of this docs-only record must equal approved GO commit 892a9bd61ce01bb09c5fc2d3f9d9926192a1ae29. U3a eventual product commit must parent THIS fixed docs-only HEAD. Verify clean tree, exact branch, pinned Atenea and no simultaneous writer. Unexpected source/test seam or conflict, incorrect fixture, visual contradiction, provider/role failure, or required permission outside allowlist -> HUMAN STOP with exact finding; do not improvise.

Commit only the bounded U3a product/evidence changes locally; stop at READY_FOR_CORA_HUMAN_VISUAL_RECHECK_U3A with SHA, parent, diff, exact tests, screenshots and measured time/models/tokens if available. Human+Cora visual checkpoint remains mandatory. No U4-U7, Standards/Spec, push, PR, merge, deploy, issue close or Go promotion.
