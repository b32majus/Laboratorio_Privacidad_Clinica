# Laboratorio de Privacidad Clínica — Contexto canónico

Status: **CURRENT**
Product generation: **V4 current / recovery in progress after 2026-10 parity reconciliation**

## 1. Purpose

Laboratorio de Privacidad Clínica is a local-first browser application for preparing and reviewing health information before it is used outside its original clinical context, especially before use with AI.

The product must help a human operator:
1. load or paste clinical content;
2. detect direct identifiers and privacy-relevant quasi-identifiers;
3. apply explicit privacy transformations;
4. review every required decision;
5. produce a safe output separated from any confidential trace/correspondence artifact.

It is **not** a compliance certification engine and must not claim GDPR/LOPDGDD compliance, anonymity, differential privacy, k-anonymity, or other guarantees unless the corresponding mechanism and evidence actually exist.

## 2. Product vocabulary

- **Detection**: a candidate sensitive span or structured field found by the engine.
- **Recognizer**: logic that detects one category of information.
- **Operator**: transformation applied to a recognized category.
- **Privacy Policy**: explicit mapping from categories/context to operators and review requirements.
- **ReviewSession**: canonical domain state for human review. The DOM is never authoritative.
- **ReviewDecision**: explicit human disposition of a detection: pending, accepted, modified, restored/kept original, or manual.
- **Safe Output**: shareable final artifact derived from completed review decisions and containing no trace table or original↔replacement mapping.
- **Confidential Audit**: separate artifact that may contain original values, mappings, review notes, or traceability. It is not a safe/shareable output.
- **Pseudonymization / seudonimización**: reversible or linkable replacement where re-identification remains possible with auxiliary information.
- **Anonymization / anonimización**: term reserved for outputs where the product can substantiate the stronger claim. Do not use it as a generic synonym for pseudonymization.
- **Low-confidence candidate**: candidate below automatic-transform confidence that remains visible for human review rather than disappearing silently.
- **Privacy Gate**: final factual readiness view showing what is treated, pending, restored, low confidence, or blocked. It is not a safety score or compliance certificate.
- **Job**: one user work unit containing source(s), privacy policy, processing state, detections, review decisions, warnings/errors, and outputs.

## 3. Supported job families

The V4 application has one shell and infers the pipeline from input:

- pasted text → text job;
- one TXT/PDF/DOCX → document job;
- multiple compatible documents → document batch;
- CSV/XLS/XLSX → structured job.

The user should not need to understand legacy page architecture to choose a flow.

## 4. Canonical V4 interaction model

```
Input → Configure → Review → Privacy Gate → Export
```

All steps remain inside one application shell. No navigation between separate HTML pages is part of the target architecture.

Desktop review is a professional three-pane workspace:
- filters / pending work;
- document/data surface;
- entity/field inspector.

Tablet/mobile use adaptive drawers/sheets rather than fixed-width sidebars.

## 5. Architecture boundary

Accepted target:

```
Vite + TypeScript + React
+ compiled Tailwind
+ Web Worker for heavy processing
+ Vitest/Testing Library
+ Playwright
```

No Next.js, SSR, application backend, remote PHI-processing API, analytics, tag manager, remote fonts, remote images, or third-party runtime JavaScript on the clinical origin.

The existing JavaScript privacy core is valuable brownfield code. It must be wrapped behind explicit interfaces and regression tests before being migrated/refactored. No big-bang rewrite.

## 6. Sensitive-data boundary

The static host distributes application bytes. Clinical content remains in the browser.

Sensitive data MUST NOT be placed in:
- URL/query/hash;
- remote logs;
- analytics;
- error-reporting SaaS;
- third-party scripts;
- network requests;
- console logging in production.

Default sensitive job persistence is memory only.

Non-sensitive preferences may use local persistence. Any future job recovery requires explicit opt-in, bounded retention/expiry, local-only storage, and a clear delete action.

## 7. Deployment boundary

Initial managed production target: **Render Static**.

Cloudflare Pages is **not** the default production target because availability in Spain must first pass a dedicated LaLiga-window test against collateral shared-IP blocking.

Vercel/Netlify are alternatives, not automatic solutions to shared multi-tenant blocking.

A dedicated origin/IP/VPS remains a future resilience option if clinical availability requirements justify the operations cost.

Marketing/docs and the clinical application must be separate origins.

## 8. Authority

`docs/START_HERE.md` is the entrypoint and current authority map. During the 2026-10 recovery train, distinguish **scope authority** from **implementation authority**:

### Recovery scope authority

1. `docs/RECOVERY_MASTER_PLAN_2026-10.md`;
2. `docs/audits/2026-10-recovery-traceability-matrix.md`;
3. the 2026-10 recovery audit narrative;
4. accepted product/architecture decisions in `docs/shaping/CURRENT_DECISIONS.md`.

These sources determine what capability must be preserved, improved, explicitly replaced or recovered. An older spec/Work Order cannot silently narrow that scope.

### Implementation authority for one accepted REC Work Order

1. the current accepted GitHub Work Order / issue, shaped from the owning recovery rows;
2. accepted `docs/specs/` contracts cited by that Work Order, plus any explicit recovery amendment;
3. `docs/shaping/CURRENT_DECISIONS.md`;
4. this `CONTEXT.md`;
5. source code + deterministic tests as implementation evidence;
6. historical audits/tasks/docs as evidence/provenance;
7. chat or agent memory.

If implementation authority intentionally substitutes or removes a recovered capability, that decision must be explicit and the recovery matrix must be updated in the same documentation lifecycle.

## 9. Execution ownership

- Human + Cora/planning surface: shaping, acceptance and material integrated audit.
- GitHub Issues/specs: bounded scope and acceptance authority.
- Atenea C-084: project-local native OpenCode V2 role/model policy and proportional assurance.
- Upstream Matt skills: implementation, task graph, TDD where applicable, worktree/merger flow and two-axis code review methodology.
- Repository tests/oracles/CI: deterministic correctness and delivery evidence.
- Herdr: user-owned already-running persistent operator/observation surface; never correctness authority.
- Normal visible execution: enter the project/worktree pane in Herdr and run `opencode .`; `atenea-volume` is the project default, while accepted complex work selects `atenea-complex` in the TUI before the prompt.
- Human: final publication/merge/deployment boundary.

C-077–C-083 Gentle/Pi/RDD/4R/lineage/burn/OpenCode V1 mechanics, including `--pure`, are historical provenance only. Current local bindings live in `opencode.json`, `.opencode/agents/` and `docs/ATENEA_EXECUTION_ROUTING_V0.md`.

No auto-merge and no force-push.

## 10. Safety defaults

- Unknown privacy classification is not success.
- Structured UNKNOWN fields require review; they do not default to KEEP.
- Oversized input must fail explicitly; never silently truncate.
- Failed batch items remain visible.
- Export is blocked while mandatory review is incomplete.
- The displayed reviewed state and exported content must derive from the same canonical domain state.
- A low-confidence candidate must remain inspectable.
- Any retained original identifier is an explicit human decision.

## 11. Durable references

Read alongside this file:
- `docs/START_HERE.md`
- `docs/RECOVERY_MASTER_PLAN_2026-10.md`
- `docs/audits/2026-10-recovery-traceability-matrix.md`
- `docs/shaping/CURRENT_DECISIONS.md`
- `docs/specs/SPEC_V4_APP_AND_REVIEW.md`
- `docs/specs/SPEC_V4_PRIVACY_ENGINE.md`
- `docs/specs/SPEC_V4_BATCH_AND_STRUCTURED.md`
- `docs/specs/SPEC_V4_QUALITY_SECURITY_DEPLOY.md`
- `docs/execution/TRAIN_V4.md`
- `docs/DEBT_REGISTER.md`
- `docs/ROADMAP.md`
- `docs/audits/`