# #92 REC-12 — Etapa A: source→matrix completeness (C-087, prepared)

Status: **READY_TO_LAUNCH / HUMAN STOP before execution**. This is a bounded *first checkpoint of already-published issue #92*, not a new ticket and not the entire REC-12 closeout.

## 0. Immutable launch and authority

- Repository: `b32majus/Laboratorio_Privacidad_Clinica`; branch `prep/issue92-source-completeness-c087-20261013`, worktree `/srv/kairos-lab/qualification/laboratorio-issue92-source-completeness-c087-20261013`.
- Parent after this preparation commit must be the current canonical `origin/3.0-main@e45d020108efa0214e8e8fe9c1276f806488c1d9` (PR #121 visual recovery + PR #122 reconciliation), with a clean tree before dispatch. Pin the *actual preparation commit* as launch HEAD; do not run against local `main` (historical).
- Atenea C-087 at `/srv/kairos-lab/Atenea@462d461f3048a0ddf15aace1257d793fd52f1c48`. Reuse #91's expressly selected Laboratorio cost route `go`, `risk_class=complex` (semantic completeness and false-closure risk), coordinator `atenea-go`; obey the *active* repo `AGENTS.md`/Atenea role bindings. No model/profile fallback, no extra reviewers by default. One fresh evidence-owning implementer under coordinator, no automatic corrector; if contract exceeds one stage, HUMAN STOP rather than improvise.
- Actual task authority: GitHub issue #92; `docs/START_HERE.md`, `docs/RECOVERY_MASTER_PLAN_2026-10.md` §REC-12/§4.1, `docs/HUMAN_PRODUCT_DESIGN_AUTHORITY_V1.md`, `docs/audits/2026-10-recovery-traceability-matrix.md`, and approved reconciliation/decisions. GitHub issue #93 is **blocked by #92**. #91 is CLOSED.

## 1. Scope and outcome of this *first* stage

**Goal:** prove or falsify that *every material obligation* in the original audits and historical product is explicitly traceable to the current recovery matrix or to a documented human-approved `DELIBERATELY_SUPERSEDED` decision. Count alone is not proof.

Required SOURCE layers, in this order:

1. `docs/audits/2026-09-privacy-functional-code-audit.md` (508 lines, frozen).
2. `docs/audits/2026-09-ux-ui-product-flow-audit.md` (674 lines, frozen).
3. Historical v3 product heritage and actual code at `3.0-main@331bcaf4a624659c77823a0c4b427d46347ea104` plus pre-refactor `e164ca2`, selectively inspected for material capabilities evidenced in the two source audits and October recovery evidence, not an aimless full old-code audit.
4. Binding human-product additions `docs/audits/2026-10-product-design-reconciliation-final.md`, `docs/HUMAN_PRODUCT_DESIGN_AUTHORITY_V1.md` and `docs/shaping/CURRENT_DECISIONS.md` only where needed to map accepted/superseded authority.

TARGET: current `docs/audits/2026-10-recovery-traceability-matrix.md` sections A/B/C (currently **88 frozen rows + 42 heritage rows + 12 PDR rows**, verified from canonical HEAD). Existing rows are *claims to check*, not self-certifying evidence.

One concrete deliverable: `docs/evidence/issue92-source-completeness/README.md`. It must include:
- SOURCE inventory: source name, stable section/heading or historical path and SHA; material obligation stated as a falsifiable user/product/privacy behavior.
- A per-obligation `source → matrix ID → accepted decision/owner → disposition → evidence` mapping. Group only genuinely identical obligations without obscuring sources. Exact IDs, no invented positive claims.
- An explicit **GAP** table for obligations absent or materially narrower in the matrix, with source locator, expected behavior, target row if near-match, missing delta, proposed accountable owner (#92, #93, independently authorized repair or human product decision), and minimum falsifying evidence. **Do not automatically mark a gap as superseded**.
- An explicit **UNVERIFIED** list for source claims whose code/evidence could not be inspected; note the limitation, not PASS.
- Summaries: material obligations enumerated, traceably covered, gaps, verified human supersessions, uncertain/contradictory claims. Distinguish documentary mapping from functional proof.
- A small section `Human-observed missing functionality` RESERVED / **not yet provided**. The owner's discoveries from trying the live app are first-class input to the future verification; do not pretend the audits exhaust current product expectations.
- Decisions needed from human + Cora to proceed.

## 2. Acceptance and bounded verification

- Pass A **only** when each material SOURCE item maps to a specific actual matrix row or a traceable explicitly human-ratified supersession, with no contradictory owner. Missing/doubtful obligations => `SOURCE_MATRIX_GAPS / HUMAN_STOP`, not `RECOVERY_COMPLETE`.
- The existing 88/42/12 count is a target inventory, not a coverage oracle. A row match by approximate naming alone is not adequate; compare behavior, formats, output, human action/state, language, safety, expected failure/recovery.
- Do **not** re-run completed user journeys, model performance or 88+42 individual implementation re-verifications in A. Those are the later authorized layers of #92 **only after A is judged**. No generic repo archaeology; stop at traceable material source obligations.
- Material risk 1: SOURCE omission. Surface: two frozen audits + real v3 heritage; property: exhaustive meaningful obligations represented; falsifier: a source requirement with no semantically equivalent trace ID or approved supersession; minimum evidence: source locator, exact row/decision and explicit gap enumeration.
- Material risk 2: false closure by existing matrix status. Surface: row dispositions; property: mapping accuracy, not implementation success; falsifier: row summary narrower than original audit or a supposed feature unproven in real product; minimum evidence: original requirement text + current matrix text + exact omitted semantics; classify as **mismatch/unverified** for later #92 test, do not rewrite verdicts in A.
- Material risk 3: accidental scope expansion. Surface: repository and protected decisions; property: evidence-only Stage A; falsifier: changes outside its single evidence path, reclassified privacy behavior or silent new ticket; minimum evidence: exact changed-path diff and STOP.

## 3. Permissions, checkpoint and C-087 lifecycle

- READ-ONLY for app/domain/engine/UI/CI/config, `docs/audits/**` frozen audits/matrix, `docs/design/**`, plan, `AGENTS.md`, and GitHub issue bodies. **Only writable candidate path**: `docs/evidence/issue92-source-completeness/README.md`. Never touch originals just to resolve disagreement.
- Use bounded reading/diff/grep of the cited sources and Git historical snapshots. No mass code edits, suites, real patient information, browser destructive tests, PR, deployment or issue closure. Offline/local synthetic evidence only.
- Focused artifact verification: `git diff --check`; verify the report has source locators and every material source claim a mapping/gap/unverified disposition; verify only one changed path. No full unit/E2E/build for a documentary mapping. No report claiming runtime behavior verified by reading docs.
- Coordinator returns `READY_FOR_CORA_ISSUE92_SOURCE_MATRIX_A_REVIEW`, exact candidate SHA/parent/branch, clean tree, changed-path inventory, coverage/gap counts and a terse decision summary. **HUMAN STOP:** no Stage B full 88+42 row re-verification, no composed E2E, no #93, no push/PR/merge/issue close.
- C-087 boundary: this A is an interim attended evidence checkpoint *inside* approved #92, not a completed separate ticket. Canonical Standards + Spec at the final approved #92 issue/candidate boundary remain **mandatory**, with existing C-087 correction budget; do not claim A substitutes for them. If Cora/human splits A into an independent ticket, preserve its own required review boundary instead of skipping it.
- If gaps exist, first adjudicate whether original source was correctly superseded, needs evidence on current V4 or a separately owned product repair. No feature implementations under this stage.

Final explicit state: **A does NOT prove the application complete**. It establishes whether the recovery inventory itself is complete enough for Stage B/C to verify every capability.