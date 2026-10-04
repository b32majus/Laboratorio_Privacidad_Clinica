# REC-02 — TEXT-POLICY-COMPLETION-01 — C-084 execution handoff

Status: **EXECUTION_READY**
Date: 2026-10-04
Recovery Work Order: **REC-02 — TEXT-POLICY-COMPLETION-01**
Profile: **volume — explicit human decision for this run**
Matt entry: **`/implement-spec`**
Publication boundary: **LOCAL_ONLY**

## Fixed execution identity

- Repository: `b32majus/Laboratorio_Privacidad_Clinica`
- Canonical product base: `3.0-main@c470d0877216017690f37e25d5ac08048823e542`
- Execution branch: `work/rec-02-text-policy-completion-20261004`
- Execution worktree: `/srv/kairos-lab/qualification/laboratorio-rec02-text-policy-completion-20261004`
- Recovery authority: `docs/START_HERE.md` → `docs/RECOVERY_MASTER_PLAN_2026-10.md` → traceability matrix/audits
- REC-01 is already completed/canonical and is a read-only prerequisite, not part of this scope.
- C-084 profile selection: the human operator explicitly selected **`atenea-volume`** for REC-02. Do not auto-escalate to complex merely because policies are privacy-relevant; if implementation reveals a genuinely new privacy doctrine/architecture decision outside this already-shaped mapping, use **HUMAN STOP** instead of silently changing profile or semantics.

If branch, base, worktree or authority has drifted before implementation begins: **HUMAN STOP**.

No GitHub issue is required for local execution. This handoff plus the canonical REC-02 section of the Recovery Master Plan is the accepted Work Order envelope. Do not create or mutate GitHub issues from OpenCode.

## Read first — bounded authority set

Read in this order:

1. `AGENTS.md`
2. `docs/START_HERE.md`
3. this handoff in full
4. `docs/RECOVERY_MASTER_PLAN_2026-10.md` — REC-02 section + dependency doctrine only
5. `docs/audits/2026-10-recovery-traceability-matrix.md` — `FUNC-005`, `UX-008`, `PRODUCT-001`, `PRODUCT-003`, `H-32`, `H-33`
6. `docs/shaping/CURRENT_DECISIONS.md` — D-006, D-007, D-009, D-010, D-011, D-013
7. `docs/specs/SPEC_V4_PRIVACY_ENGINE.md` — especially §§5–9, 11–13
8. `docs/audits/2026-09-privacy-functional-code-audit.md` — P1-01 + product candidate policy/date-shift rationale
9. `docs/audits/2026-09-ux-ui-product-flow-audit.md` — UX-08 only
10. current code/tests listed below.

Historical T01–T25 execution material is provenance only. POLICY-01 is useful evidence of the current UI seam, but its “unavailable yet” state is what REC-02 intentionally supersedes.

## Why REC-02 exists

The product has four accepted Privacy Policy identities:

- Standard;
- External AI;
- Longitudinal Research;
- Strict.

Structured date/age processing already resolves all four. Text, single-document and document-batch processing currently resolve only Standard/Strict; External AI and Longitudinal Research fail typed as known-but-unmapped and the UI therefore disables them.

The required operators already exist:

- `legacy.pseudonymize`;
- `legacy.redact`;
- `legacy.generalize`;
- `legacy.date-transform`;
- `v4.date-generalize`;
- `v4.date-shift`;
- `v4.age-generalize`.

REC-02 is therefore a **policy completion + context-threading ticket**, not a recognizer rewrite and not a new privacy architecture.

## Human-accepted text/document/batch policy mapping

This table is the product decision for REC-02. OpenCode must implement it exactly and must not substitute a different mapping because another policy “sounds safer” or “sounds more useful”.

| Policy | `strictMode` | NOMBRE | IDENTIFICADOR | FECHA | UBICACION | SOSPECHOSO | EDAD |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `standard` | `false` | `legacy.pseudonymize` | `legacy.redact` | `legacy.date-transform` | `legacy.generalize` | `legacy.generalize` | `v4.age-generalize` |
| `strict` | `true` | `legacy.pseudonymize` | `legacy.redact` | `legacy.date-transform` | `legacy.generalize` | `legacy.generalize` | `v4.age-generalize` |
| `external-ai` | `true` | `legacy.pseudonymize` | `legacy.redact` | **`v4.date-generalize`** | `legacy.generalize` | `legacy.generalize` | `v4.age-generalize` |
| `longitudinal-research` | `true` | `legacy.pseudonymize` | `legacy.redact` | **`v4.date-shift`** | `legacy.generalize` | `legacy.generalize` | `v4.age-generalize` |

### Rationale fixed by the human/Cora shaping boundary

- Standard and Strict remain byte/contract compatible with their current accepted behavior. REC-02 must not “improve” them opportunistically.
- External AI is a local preparation policy; it **does not send anything to an AI/service**. For unstructured text it reduces temporal precision via the already-accepted date-generalization operator instead of preserving exact intervals.
- Longitudinal Research is the unstructured policy that intentionally preserves chronology/intervals through one consistent Job-scoped date shift. This directly closes H-33 / PRODUCT-001.
- Both External AI and Longitudinal Research use the stricter existing generalization branch for location/quasi-identifiers (`strictMode=true`) while preserving stable name pseudonyms and redacting direct identifiers.
- Explicit ages remain banded under all four policies. No policy keeps exact EDAD.
- This text mapping does **not** have to be identical to structured date/age mapping: structured has explicit column roles and patient-ID authority; unstructured text does not. Job-aware guidance must state the actual behavior rather than pretending the two input families are identical.

If implementation would require a different table or a new operator semantics beyond the existing accepted operators: **HUMAN STOP**.

## Longitudinal date-shift context contract

`longitudinal-research` requires a deterministic Job-scoped shift state.

Accepted contract:

1. Create the shift state with the existing `createDateShiftState(...)` foundation.
2. Seed it from a **non-PHI, Job-scoped value derived from `job.id`**, with domain separation such as `text-policy:${job.id}`. Do not derive the seed from clinical text, filenames, patient identifiers, names, dates or other content.
3. A text/single-document Job uses that state in a fresh `ProcessingContext` for its one engine run.
4. A document-batch Job starts with the same Job-scoped state and threads the **same `options.dateShift`** through every successful item while pseudonym state transitions from fresh → shared.
5. A failed batch item contributes neither pseudonym state nor a replacement date-shift state; later items continue with the last valid carried context.
6. The existing engine remains the authority that reads `ProcessingContext.options.dateShift`; do not add ambient globals or monkey patches.
7. Switching policy invalidates stale review/processing exactly as today. Re-entering Longitudinal Research for the same Job may deterministically recreate the same Job-scoped shift; a new Job receives a new Job identity/shift.

Important existing defect to close: `runBatchReviewAsync` currently promotes only `pseudonymState` and drops `outcome.context.options`. REC-02 must preserve the policy-owned options when carrying context.

## Required product behavior

### Text / single document

- all four policies are selectable through the existing policy UI because availability continues to derive from the engine authority (`lookupPolicyProfile`), not from a second hard-coded table;
- `startReviewSessionAsync(job)` supplies the correct policy/context to the productive engine;
- Standard/Strict remain unchanged;
- External AI produces date-generalized proposals/results;
- Longitudinal Research produces consistently shifted date proposals/results and never silently falls back when shift state is missing/malformed;
- direct identifiers remain redacted, names pseudonymized, ages banded, and location/quasi behavior follows the table above.

### Document batch

- all four policies are selectable;
- every item uses the Job's selected policy;
- Longitudinal Research preserves a single shift state across the ordered successful items, including across an intervening failed item;
- existing shared name pseudonym consistency remains intact;
- policy changes continue to invalidate processing-derived batch state according to the existing domain rules;
- no batch output formats are added here (REC-07 owns outputs).

### Policy guidance

Update the existing single policy-guidance seam so it no longer claims External AI / Longitudinal are unavailable for text/document/batch.

Guidance must explain, factually and concisely, at least:

- Standard = current standard pseudonymization/redaction/generalization behavior;
- Strict = current stricter location/quasi generalization branch;
- External AI = local-only preparation, date precision reduced/generalized; **does not transmit data externally**;
- Longitudinal Research = local-only preparation with consistent Job-scoped date shifting to preserve order/intervals; **does not grant research approval/governance/compliance**.

Do not add anonymity, certification, GDPR/LOPDGDD, differential-privacy or k-anonymity claims.

REC-10 still owns full Spanish localization of the application. Do not broaden REC-02 into translating unrelated shell/review/export UI. The policy copy changed by this ticket must be factual and localization-ready; keep the surrounding current product language unless the existing policy seam itself requires a small coherent copy update.

## Work-unit graph

### WU-A — Four-policy engine authority

1. replace the two-policy mapping assumption in `engine/policy.ts` with the exact four-policy table above;
2. keep the mapping data-owned/frozen and the consistency checker able to reject a planted wrong operator/strictMode for **each** policy;
3. preserve typed failures for malformed/unknown ids and missing operator registrations;
4. update stale code comments/tests that still state External AI/Longitudinal are intentionally unmapped;
5. add deterministic composed engine tests for all four policies, including exact per-category operator outcomes on synthetic mixed text;
6. Standard/Strict regression must remain exact.

### WU-B — Policy-owned ProcessingContext + product paths

1. add the smallest pure seam needed to create the initial ProcessingContext from `(job, policy)` without duplicating the mapping table;
2. only a policy whose FECHA operator is `v4.date-shift` receives `options.dateShift`;
3. `startReviewSessionAsync(job)` must use that context for text/document;
4. `runBatchReviewAsync(job)` must use it for the first item and preserve returned `options` when promoting context to shared mode;
5. prove Longitudinal Research keeps one offset across multiple documents and preserves pairwise date intervals/order;
6. prove an intervening failed item does not change the carried shift/pseudonym context;
7. preserve Worker path, low-confidence candidate policy outcomes and existing async stale-outcome guards.

Do not derive a date-shift seed from clinical content.

### WU-C — Product availability/guidance + composed closeout

1. make the existing derived policy availability show all four policies as available for text/document/document-batch after the engine authority exists;
2. update factual policy guidance for the new behavior without creating a second policy engine;
3. browser/unit evidence must prove External AI and Longitudinal can actually be selected and processed, not merely enabled in the `<select>`;
4. update durable authority with the accepted mapping (recommended: add a concise current decision entry in `docs/shaping/CURRENT_DECISIONS.md`, referencing REC-02 rather than duplicating implementation prose);
5. update only REC-02-owned recovery rows/evidence: `FUNC-005`, `UX-008` if clarification is needed, `PRODUCT-001`, `PRODUCT-003`, `H-32`, `H-33`, plus REC-02 status in the Master Plan;
6. do not mark overall recovery complete and do not advance REC-03/other rows beyond evidence produced here.

## Non-negotiable boundaries

REC-02 must **not** change:

- recognizers/dictionaries/scoring/REC-01 corpus semantics except tests strictly needed to prove no regression;
- AGE bands;
- structured date/age mappings or structured class→action semantics;
- Study ID / structured linkage (REC-03);
- ReviewSession decision vocabulary/authority;
- Privacy Gate readiness semantics;
- Safe/Confidential serializer/output formats;
- batch workflow controls/output formats;
- file adapters;
- Worker architecture;
- local-only/network/storage guarantees;
- global Spanish localization (REC-10);
- visual system (REC-11).

No remote AI/API, backend, analytics or new runtime dependency.

Any required change to those authorities or to the fixed mapping table => **HUMAN STOP**.

## Deterministic acceptance

At final candidate prove all of the following:

1. `lookupPolicyProfile` resolves all four accepted policy ids to deeply frozen complete mappings;
2. malformed/unknown ids still fail typed; no fallback to Standard;
3. the exact mapping table in this handoff is mechanically pinned by tests;
4. every mapped operator key exists in the production operator registry;
5. Standard and Strict outputs/regressions remain unchanged;
6. External AI text dates use `v4.date-generalize`, not legacy Visit-N and not `DATE_SHIFT`;
7. Longitudinal Research text dates use `v4.date-shift` and a missing/malformed shift state still fails closed;
8. Longitudinal Job seed derives only from non-PHI Job identity and yields a stable state for the Job;
9. text + single-document product paths process successfully under all four policies;
10. document-batch processes successfully under all four policies;
11. Longitudinal batch uses one consistent shift across successful documents and preserves intervals/order;
12. a failed batch item does not perturb carried pseudonym/date-shift context;
13. direct identifiers never survive through any newly enabled policy; explicit EDAD remains generalized;
14. location/quasi output under External AI and Longitudinal follows the existing strict branch;
15. low-confidence candidates get proposals from the selected policy, not Standard;
16. policy availability is derived from engine/structured authorities and all four are selectable for all four Job kinds after REC-02;
17. no UI copy says External AI/Longitudinal text policies are unavailable;
18. guidance explicitly avoids implying External AI performs network transmission or Longitudinal Research confers research approval/compliance;
19. structured policy behavior/tests are unchanged;
20. no runtime dependency/network/storage/Worker regression;
21. REC-02-owned recovery docs are reconciled without overclaim.

## Verification commands

Use focused TDD throughout. Final verification must include at least:

```bash
npx vitest run app-v4/src/engine/policy.test.ts \
  app-v4/src/engine/registry-engine.test.ts \
  app-v4/src/engine/date-longitudinal.test.ts \
  app-v4/src/review/review-domain.test.ts \
  app-v4/src/policy-guidance.test.ts \
  app-v4/src/useJobSession.test.tsx \
  app-v4/src/App.policy.test.tsx
npm run check:privacy-eval:v4
npm run typecheck:v4
npm run lint:v4
npm run format:check:v4
npm run build:v4
npm test
git diff --check
```

Add focused Worker/browser evidence when the final diff crosses those paths. Existing network/storage/privacy guards in the canonical `npm test` chain must remain green.

Baseline at handoff creation before any REC-02 mutation:

- `npm ci --no-audit --no-fund`: PASS;
- focused policy/guidance/date-longitudinal/review/useJobSession suite: **79/79 PASS**;
- `npm run typecheck:v4`: PASS;
- `git diff --check`: PASS;
- tracked worktree: clean.

## C-084 execution rules — volume profile

- Use **`atenea-volume`** as the primary coordinator. This is the explicit human-selected profile for REC-02.
- Use **`/implement-spec`** because WU-A → WU-B → WU-C is one Work Order with multiple bounded units.
- Coordinator owns the Matt task graph and exactly one final integration-branch canonical `/code-review`.
- Implementation workers own implementation/TDD + committed candidate evidence only; they do not invoke `/implement`, `/implement-spec`, `/code-review`, reviewers or correctors.
- Review start closes the originating implementer write phase.
- Canonical review must use the **volume** axes: `atenea-review-standards` + `atenea-review-spec-volume`, pinned to the exact pre-implementation fixed point and this full authority envelope.
- Actionable review findings go only to a fresh `atenea-corrector-volume` session.
- At most two fresh finding-scoped correction attempts for the same authorized finding envelope.
- Persistence after correction #2, new material privacy semantics, mapping-table change, architecture/scope expansion, or need for a different profile mid-unit => **HUMAN STOP**.
- No silent model/quota fallback inside an active work unit.
- Do not launch/restart/replace Herdr.

## Publication boundary

**LOCAL_ONLY.** During REC-02 execution do not:

- push;
- create/update/close GitHub issues;
- create/update PRs;
- merge;
- deploy;
- change repository settings;
- force-push or rewrite history.

Local commits are expected. Cora audits the final integrated candidate before publication.

## Final return contract

Return:

- exact starting product fixed point `c470d0877216017690f37e25d5ac08048823e542`;
- exact pre-implementation handoff fixed point and final HEAD;
- ordered local commits;
- changed-file inventory;
- WU-A/WU-B/WU-C completion summary;
- final four-policy mapping table actually implemented;
- evidence that Standard/Strict did not regress;
- External AI date-generalization evidence;
- Longitudinal Research single + batch date-shift evidence, including interval/order preservation and failed-item isolation;
- policy availability/guidance evidence for text/document/batch;
- deterministic command results;
- actual C-084 volume coordinator/implementer/reviewer/corrector routing;
- canonical Standards + volume Spec review results and any correction lineage;
- unresolved gaps / HUMAN STOP if any;
- clean worktree status;
- explicit statement that nothing was pushed/merged/deployed.

If a STOP condition occurs, return evidence and stop without inventing a workaround.
