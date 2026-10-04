# RECOVERY PLAN — External adversarial audit handoff

Status: **EXECUTED READ-ONLY EXTERNAL AUDIT REQUEST — historical input; result: `docs/audits/2026-10-recovery-plan-external-adversarial-audit-sol61.md`**
Date: 2026-10-04

## Mission

Independently audit whether the reconciled recovery plan for Laboratorio de Privacidad Clínica is complete, correctly scoped and correctly ordered. Do **not** defend the current plan. Try to falsify it.

This is NOT an implementation task and NOT a request to redesign the architecture from scratch. Do not modify files, code, Git state, issues, branches or remote resources.

## Fixed points to inspect

Repository/worktree current candidate includes a documentation-only reconciliation on top of:

- original audited product: `3.0-main@331bcaf4a624659c77823a0c4b427d46347ea104`;
- frozen pre-refactor audit/roadmap authority: `e164ca2`;
- current V4 product checkpoint: `3.0-main@6fb5eb1fb867e022acc68dd2be39b16bd531f27a`.

Read first:

1. `docs/START_HERE.md`
2. `docs/RECOVERY_MASTER_PLAN_2026-10.md`
3. `docs/audits/2026-10-recovery-traceability-matrix.md`
4. `docs/audits/2026-10-recovery-traceability-audit.md`
5. `docs/DEBT_REGISTER.md`
6. `docs/ROADMAP.md` (historical intent)
7. `docs/shaping/CURRENT_DECISIONS.md`
8. the two original September audit documents under `docs/audits/`
9. `docs/specs/SPEC_V4_*.md` and T01–T25 evidence only where needed to test a disputed claim.

Inspect original v3 code at `331bcaf...` and current V4 code at the worktree/`6fb5eb1...` where needed. Do not infer capability from filenames or debt status alone.

## Questions you must answer

### A. Completeness / false negatives

- Does the 88 + 40 matrix omit any material v3 capability, original audit requirement, UX target, safety property, workflow affordance, output format or operational requirement that should count as recovery?
- Are there capabilities incorrectly classified as future/not-recovery that were actually present in v3 or explicitly required by the original audits?
- Are there current V4 regressions not represented by a matrix row or REC Work Order?

### B. False positives / over-recovery

- Are any rows/tickets trying to recover behavior that was unsafe, accidental, obsolete or explicitly meant to be replaced?
- Does the plan risk recreating legacy implementation rather than recovering capability on V4 authorities?

### C. Technical truthfulness

Verify the most material claims, especially:

- Spanish engine/dictionary/parser heritage is preserved but assurance is too weak;
- Study-ID/longitudinal structured linkage was present in v3, is required by accepted product intent/spec, and is missing from current Safe Structured Output;
- structured header-row detection was lost;
- single/batch/structured output parity is incomplete;
- free-text structured-column routing is missing if claimed;
- External AI / Longitudinal Research text mappings remain unavailable;
- V4 visual tokens survive while composition/product identity regressed;
- current UI is predominantly English;
- UX-CLOSEOUT correctly resolves the rows marked stale-resolved.

If any claim is wrong or overstated, say exactly why and cite file/code evidence.

### D. Plan architecture

Audit all 12 REC Work Orders:

- Is each recovery blocker owned exactly once?
- Are any tickets too broad, too narrow or wrongly sequenced?
- Are dependencies correct?
- Should any two tickets merge or one split to reduce semantic risk?
- Is localization correctly late enough to avoid double translation, but early enough to protect Spanish-domain behavior?
- Is visual recovery correctly after product semantics?
- Does REC-12 have enough authority to prevent another false parity closeout?

### E. Documentation authority

Audit the reconciled `START_HERE`, `CONTEXT`, `CURRENT_DECISIONS`, `ROADMAP`, `DEBT_REGISTER`, `README`, `AGENTS`, and governance docs for contradictions that could cause a future agent to follow stale authority.

## Required output

Return a concise but complete Markdown report with exactly these sections:

1. **Verdict** — `PASS`, `PASS WITH REQUIRED CHANGES`, or `FAIL / REPLAN`.
2. **Material findings** — only findings that change recovery scope/order/authority. Each finding: severity, evidence, consequence, required change.
3. **Missing recovery rows/tickets** — `NONE` if none.
4. **Rows/tickets that should be removed or reclassified** — `NONE` if none.
5. **12-ticket plan assessment** — keep/change/split/merge for each REC-01…REC-12.
6. **Authority contradictions** — stale docs/instructions still capable of causing drift.
7. **Confidence / residual uncertainty** — what you could not prove.
8. **Recommended go/no-go** — whether REC-01 may start after documentation reconciliation.

Do not create issues. Do not edit the repository. Do not propose implementation details unless needed to explain a scope error.

## Execution note

2026-10-04: non-interactive read-only attempts through `opencode run` were **not substantive audits**. The runner ignored the intended project-local agent/model binding, fell back to an unavailable free model, and failed at provider authentication before reading repository evidence. Those attempts provide no verdict and must not be cited as external assurance.

This handoff remains available for a later bounded run from the normal visible Atenea/OpenCode V2 TUI, where the selected agent/model binding can be observed before execution. Recovery work is not blocked on that optional second opinion; any later finding must be independently evidenced and reconciled into the matrix/master plan before changing scope.
