# UX-PILOT-02 — C-084 execution handoff

Status: EXECUTION_READY
Issue: #55 — [V4/UX-PILOT-02] Privacy Gate + Export decision workspace
Profile: volume
Matt entry: /implement
Publication boundary: LOCAL_ONLY

## Fixed point

Canonical branch:
`3.0-main`

Canonical base:
`818599285ca37a5bafb6b747f3ce8ffa99ef501d`

Execution branch:
`work/ux-pilot-02-20261003`

## Objective

Improve PRESENTATION ONLY for the existing V4 Privacy Gate and Export steps.

The product/domain/privacy/output semantics are already decided and MUST NOT
be redesigned by the execution agent.

The final UI must make it immediately clear:

1. whether action is still required before Safe Output;
2. what factual warnings/errors/review facts remain;
3. which artifact is Safe Output;
4. which artifact is Confidential Audit and therefore internal/sensitive.

## Production files allowed to change

Expected:

- `app-v4/src/privacy-gate/PrivacyGate.tsx`
- `app-v4/src/export/ExportStep.tsx`

Small presentation-only components may be extracted locally if useful.

Tests/oracles may be added or updated under the existing Gate/Export/App/E2E
test surfaces.

## READ-ONLY authorities

Do not modify:

- `app-v4/src/privacy-gate/privacyGateModel.ts`
- domain Job state/transition code
- ReviewSession/review authority
- engine/recognizers/operators
- privacy policy mappings
- ProcessingContext semantics
- Safe Output builders/serializers
- Confidential Audit builders/serializers
- structured transform/output semantics
- deployment/runtime configuration
- dependencies

If the UX goal appears to require changing any of those:
HUMAN STOP.

## Fixed product decisions

### Privacy Gate

Use ONLY existing facts/readiness.

Present the existing state as a compact decision checkpoint:

- Action required: current authority says output is blocked and/or existing
  pending/error facts require attention.
- Ready/review-complete: current authority says the applicable output is ready.
- Attention facts: existing restored-original, low-confidence, batch failure,
  structured or other current warnings remain visible and text-labelled.

Grouping and visual hierarchy may change.
Meaning, counts, messages and readiness rules may not.

No score.
No safety percentage.
No anonymity claim.
No compliance/certification claim.

### Export

Keep two unmistakably separate artifact zones:

1. Safe Output
   - primary downstream/deliverable artifact;
   - enabled only under CURRENT readiness authority.

2. Confidential Audit
   - internal-sensitive / traceability artifact;
   - visibly distinct;
   - retain the existing confidential warning;
   - preserve CURRENT independent availability semantics.

Do NOT make Confidential Audit look like a safe deliverable.

For single/text jobs, do NOT hide or block Confidential Audit merely because
Safe Output is still blocked when current semantics allow the audit.

For document-batch jobs preserve the current accepted limitation:
no batch-wide Safe Output or batch-wide Confidential Audit format.

For structured jobs preserve current Safe Structured CSV and separate
Structured Confidential Audit behavior exactly.

## Visual direction

Continue the clinical privacy workstation direction established by
UX-PILOT-01:

- one professional application, not a microsite;
- compact operational hierarchy;
- existing local visual tokens;
- rose accent as brand, not arbitrary status semantics;
- state always conveyed in text, never color alone;
- no decorative redesign that hides facts.

Do not redesign the global app shell or Input step.

## Deterministic UX/a11y oracle

Mechanical criteria MUST be verified deterministically.

Add durable focused Playwright/browser evidence for Gate + Export covering:

- 375px mobile;
- 768px tablet;
- 1280px desktop;
- no horizontal page overflow caused by changed surfaces;
- relevant primary controls keyboard reachable;
- visible focus;
- changed normal-text foreground/background pairs >= 4.5:1 against ACTUAL
  rendered/composited backgrounds;
- correct WCAG large-text threshold where applicable.

Do not introduce a runtime third-party dependency.

## Required verification

At minimum:

- focused Privacy Gate / Export tests;
- new deterministic responsive/contrast oracle;
- critical Playwright E2E;
- full `npm test`;
- `npm run typecheck:v4`;
- `npm run lint:v4`;
- `npm run format:check:v4`;
- `npm run build:v4`;
- existing privacy/network/storage gates through the canonical chain.

Any changed E2E locator must identify the intended accessible semantic target,
not merely be weakened until the test passes.

## C-084 execution rules

MiMo / `atenea-volume` is COORDINATION ONLY.

The coordinator MUST NOT modify the repository by any route, including:

- editor writes;
- shell redirection;
- heredocs;
- sed/perl;
- generated rewrite scripts;
- git apply;
- direct test-file edits;
- direct documentation edits.

ALL repository mutation is delegated to the appropriate implementer/corrector.

Use upstream Matt `/implement`.

Cora has already made the material product decisions in issue #55 and this
handoff. Do not reopen them.

If a new material product/privacy/architecture decision appears:
HUMAN STOP.

Maximum one autonomous correction after review.

If a blocker remains after that correction:
HUMAN STOP.

Engram/memory stays outside the normal critical path.

## Publication boundary

LOCAL_ONLY.

Do not:

- push;
- create/update PRs;
- mutate/close issues;
- deploy;
- merge;
- force-push/history rewrite.

Finish with:

- exact starting BASE;
- exact final HEAD;
- coherent local commit(s);
- clean worktree;
- changed-file inventory;
- deterministic evidence;
- actual coordinator/implementer/reviewer/corrector routing;
- remaining blocker or HUMAN STOP.
