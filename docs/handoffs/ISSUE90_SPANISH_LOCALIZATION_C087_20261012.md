# Issue #90 — REC-10 Spanish localization closeout · C-087

> **READY_TO_LAUNCH — SYNCED 2026-10-12.** This is the already selected and human-approved #90 under current C-087. No OpenCode or implementation has started. Operator preflight must pass again before launch.

## Fixed inputs and publication boundary

- Repo: `b32majus/Laboratorio_Privacidad_Clinica`, branch `work/issue90-spanish-closeout-c087-synced-20261012` in worktree `/srv/kairos-lab/qualification/laboratorio-issue90-es-localization-c087-synced-20261012`. Historical docs-only prep `15e68516c7d7d0cb960ccc0a5fefcd539689c6a0` remains untouched: **no rebase**.
- **Canonical product baseline:** `origin/3.0-main@1a022547125e8550016278ecc4d06ef2614f94e3`, contains #85/PR116, visual Sophilux B V1/PR117, approved functional D1-D4/VF01-08/PR118 and approved sync PR119. This handoff is **documentation-only**, not product implementation.
- **Atenea authority:** `b32majus/Atenea origin/main@2f8ace50510d77c73af8e3918e8286ffbc6e531f` (PR #145 proportionate corrections + conditional integrated witness, PR #146 GLM coordinator Complex). Its `docs/START_HERE.md` and `docs/PRE_EXECUTION_HARDENING_V1.md` are current execution authority, not an invitation to rewrite project policy.
- **Atenea sync SATISFIED:** human-approved PR #119 **MERGED**, canonical commit `1a022547125e8550016278ecc4d06ef2614f94e3`. Its three sync files match upstream C-087. Effective Complex coordinator `nan/glm5.3-flash#high`, Volume coordinator `nan/mimo-v2.6-flash`, Volume writer/corrector DeepSeek V4 Flash, independent Luna reviewers. Do not route #90 as Complex merely to evaluate GLM.
- **Accepted result and authority:** GitHub issue #90 (REC-10 H-01/PDR-08); `docs/HUMAN_PRODUCT_DESIGN_AUTHORITY_V1.md`; `docs/design/sophilux-b-v1/ACCEPTED_VISUAL_CONTRACT.md` + `docs/design/sophilux-b-v1/SOPHILUX_B_V1_FUNCTIONAL_RECONCILIATION.md`. The seven compositions and their state/next-action conditions are **already approved**; do not select a new UX direction.
- **LOCAL_ONLY execution:** no worker push, PR, merge, issue close, hosting/deploy, policy or Atenea mutation. Publish only after fixed candidate, canonical review, independent Cora gate and human authorization.

## Outcome — translate all USER-FACING surfaces, not internal domain code

Finish V4 as professional Spanish without altering the meaning of seudonimización or the truth of readiness. `<html lang="es">` already exists and must match *visible text, buttons, help, labels, status, error guidance, tooltips, dialog confirmation, accessible names and generated visible artifact labels/file names*.

Acceptance by 7 approved views, including directly affected material variants:

| View | Specific user-visible copy/accessible surfaces to close |
|---|---|
| Entrada + global shell (`app-v4/src/App.tsx`) | Step labels including the English **Privacy Gate**, current policy/task guidance, text/file/exemplar affordances, error/empty states, `Nuevo trabajo` vs destructive `Borrar sesión`, optional help. The task-driven navigation and existing step availability remain unchanged. |
| Review (`app-v4/src/review/ReviewWorkspace.tsx`) | Existing `Document`/`Progress`/`Pending`/`Filters`, Review progress/list/selection accessible names, manual mark, decision actions and draft/keep-original confirmation. Preserve actual per-detection decision semantics and filters; no accidental autoacceptance. |
| Batch (`app-v4/src/review/BatchReviewView.tsx`) | Queue state names, per-document error/retry/acknowledgement/removal, selection/filters/accessible names and help. Do not manufacture review for a failed document or report a removed item as ready. |
| Structured Configure (`app-v4/src/structured/StructuredConfigureWorkspace.tsx`, relevant visible options) | English `Select a worksheet`, `Select the header row`, `Configuration summary`, column class/action/date role/Study-ID/patient-ID controls, reasons, inspector/table accessible names. The 32-column grid is **visually frozen**; only text/ARIA/required locale naming, no new table redesign. |
| Structured free-text (`app-v4/src/structured/StructuredFreeTextReview.tsx`) | Cell states, selection, action buttons, errors and English `Continue to Privacy Gate`. Page exists ONLY with actual free-text cell work; preserve no-op removal. |
| Privacy check (`app-v4/src/privacy-gate/PrivacyGate.tsx`) | English `Privacy Gate`/`Structured export`/`Pending`/`Safe Output`, genuine blockers/warnings/availability, per-material facts, accessible labels. No fabricated permissions or mandatory new screen. |
| Result (`app-v4/src/export/ExportStep.tsx` and **direct** presentation consumers) | Text/document copy/file feedback, Batch ZIP/PDF/CSV, Structured XLSX/CSV, warnings when originals are retained, ready/blocked/needs-attention language, separate explicit Confidential consent, filenames and download labels **when user-facing and safely localized**. Never rename contractual headers (e.g. `ID_ESTUDIO`, `Visita_Num`), MIME/extensions, bytes, raw audit values or machine-readable internal codes. |

### Binding terminology (not a new product decision)

Use `Preparar datos` / `Revisión` / `Hallazgos` / `Pendiente` / `Conservar original` (explicit warning when appropriate) / `Tratamiento efectivo` / `Comprobación de privacidad` / `Resultado` / `Preparado` / `Necesita atención` / `Bloqueado` / `Auditoría confidencial` consistently by context. Use **seudonimización / preparación**, never blanket `anonimizado`, safety certification, regulatory conformity, or promise of no residual identifiers. Internal status enums, technical policy IDs, machine-readable serialization fields, and necessary audit provenance may remain unchanged English when they are NOT end-user wording.

Accessible names are user-facing text: align `aria-label`, button names and associated descriptions with Spanish semantics, keeping selection and status programmatically recognizable. Pure test selectors tied to literal English must be updated to the new Spanish user-facing contract, never weakened by removing fail-closed assertions.

## Affected sources, conditional scope and DO NOT TOUCH

**Writable if actual display string occurs there:** existing TSX visible surfaces above (`App.tsx`, Review/Batch, Structured Configure/FreeText, PrivacyGate, ExportStep) plus presentation-only helpers used by those surfaces. Prefer string replacement at rendering boundary when downstream domain reason/code messages are English; do not alter domain-derived branching for convenience.

**Directly affected test consumers** (only where text/ARIA labels change): corresponding `App.test.tsx`, `ReviewWorkspace.test.tsx`, `BatchReviewView.test.tsx`, `StructuredConfigureWorkspace.test.tsx`, `StructuredFreeTextReview.test.tsx`, `PrivacyGate.test.tsx`, `ExportStep*.test.tsx` and the actual E2E selectors in `e2e/ux-closeout-shell.spec.ts`, `e2e/review-export.spec.ts`, `e2e/structured.spec.ts`, `e2e/batch.spec.ts`, `e2e/structured-rec04-composed.spec.ts` **if impacted**. Do not edit every named test preemptively.

**DO NOT TOUCH:** `app-v4/src/domain/job.ts`, `useJobSession.ts`, engine/ReviewSession, classifier, privacy semantic/policy mappings, Structured config/date/Study-ID authority, batch/readiness determination, writers/serializers, consent or download readiness, bytes and canonical headers, release/deploy tooling, `opencode.json`, `.opencode/agents/`, V1 approved HTML/CSS/JS, design authority. A *presentation-only localized filename* may change only where the UI generates the saved file name, without altering artifact data, correct extensions, or externally contracted naming. If a real boundary conflict appears, **HUMAN STOP** with path/string/contract — do not silently expand this localization ticket into a semantic change.

**Material risks known:** translations affect testing-library role names and Playwright selectors; labels and longer text may affect one primary action or 375px overflow; careless replacement of English in code may change an enum, blocked reason authority, artifact byte/header, error diagnostics or confidential confirmation. Change strings/accessible naming only and retain adjacent guards. No new i18n framework, component architecture, design tokens, global layout/refactor, icon/routing redesign or audit reopening.

## Evidence — C-087 proportionate, named by phase

**Writer/TDD:** for each *actually changed* component, adapt its existing component test assertion to the approved Spanish label/status/error/accessible name. Prove disabled/warning/confirm semantics on the same fixture; don't turn `getByRole`/accessible-name assertions into generic `.locator()` matches. Run `npm run typecheck:v4` and only touched unit files, e.g.:

`npx vitest run app-v4/src/App.test.tsx app-v4/src/review/ReviewWorkspace.test.tsx app-v4/src/structured/StructuredConfigureWorkspace.test.tsx app-v4/src/privacy-gate/PrivacyGate.test.tsx app-v4/src/export/ExportStep.test.tsx`

This is an **example set**, not mandatory for untouched components; narrow to actual modifications. Use local ESLint/Prettier on affected source as needed, no full Vitest.

**Integration/candidate:** one real representative ordinary cross-screen Spanish journey using **existing** `e2e/review-export.spec.ts`: text Review → gate/Result action and kept-original warnings; plus one Structured existing E2E where sheet/header or Unknown changed. Execute **only impacted named E2E files/tests**, not a full E2E matrix. No independent extra candidate integrated-witness pre-review is automatically triggered: the change is wording, not a planned navigation/selection/async semantic rewrite. If an actual such risk appears, stop for Cora to scope one existing witness as permitted by PR #145.

**Visual evidence conditional:** don't regenerate all seven screen shots because text was localized. Only a concrete materially longer heading/action, overflow or changed hierarchy triggers one real 1280/375 whole-screen proof for that consumer under existing Atenea fidelity gate, maintaining accepted Sophilux B layout. Functional pass alone is not visual parity where affected.

**Canonical coordinator review:** one Standards + Spec Review on fixed candidate; at most 2 fresh finding-scoped correctors with PR #145 **prescriptive known defect** file/target/change and one focused proof. No generic rediscovery and no broad suites on corrector. Full suite/CI belongs to final independently approved publication, not implementation default.

## Routing, stop and launch

- **cost_policy: standard**, **risk_class: volume**: this is bounded *semantic-preserving localization*, not a new privacy decision, migration, concurrency or architectural integration. Number of translated strings/files does not make it Complex.
- **Selected coordinator**: `atenea-volume` / `nan/mimo-v2.6-flash`; implementer `atenea-implementer-volume` / `nan/deepseek-v4-flash`; Standards `atenea-review-standards` / GPT-6 Luna high; Spec `atenea-review-spec-volume` / GPT-6 Luna high; corrections `atenea-corrector-volume` / DeepSeek V4 Flash. No profile switch/fallback. **No GLM Complex observation** occurs in #90.
- **Launch authority fixed:** this **fresh worktree** was created from `origin/3.0-main@1a022547125e8550016278ecc4d06ef2614f94e3` rather than rebasing the historical preparation. At human-visible launch verify **the final docs-only prep HEAD**, parent = fixed base, clean tree, unchanged remote main and Atenea main, open #90 without competing PR, default `atenea-volume` and synced `atenea-complex`. Any drift => HUMAN STOP, never automatic rebase/fallback.
- **HUMAN STOP:** fixed SHA/branch/tree drift, current Atenea authority change, competing #90 execution, protected domain/privacy semantics need modification, localized filename changes exported bytes/contract, new navigation/readiness/consent behavior, or missing material product decision. Otherwise execute the accepted Spanish presentation work only.
- Status: **READY_TO_LAUNCH** with post-merge fixed worktree. Human operator runs the guarded Bash inside their existing Herdr terminal, opening `opencode .` with default coordinator `atenea-volume` and pasting the short prompt referencing this handoff. LOCAL_ONLY: no worker push, PR, merge, issue closure or deploy. STOP for Cora independent audit on fixed candidate.
