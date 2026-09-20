# Laboratorio de Privacidad Clínica — Contexto canónico

Status: **CURRENT**
Product generation: **V4 shaping / brownfield migration**

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

When sources conflict, use this order:

1. accepted specs under `docs/specs/`;
2. accepted architectural/product decisions under `docs/shaping/CURRENT_DECISIONS.md`;
3. this `CONTEXT.md`;
4. current executable GitHub Work Order / issue;
5. source code + deterministic tests as implementation evidence;
6. audits/knowledge as evidence;
7. historical specs/docs;
8. chat or agent memory.

Audits identify debt and evidence; they do not override an accepted spec.

## 9. Execution ownership

- Human + Cora/planning surface: shaping and acceptance before EXECUTION_READY.
- GitHub Issues: bounded Work Orders.
- Atenea: unattended execution from EXECUTION_READY.
- Fresh implementation child: ticket implementation.
- Persistent Atenea parent: frontier/train orchestration, exact diff reconciliation, deterministic verification, Gentle RDD, checkpoints.
- Gentle RDD: final exact-candidate review lifecycle.
- Human: final merge boundary.

Normal train concurrency is **1**.

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
- `docs/shaping/CURRENT_DECISIONS.md`
- `docs/specs/SPEC_V4_APP_AND_REVIEW.md`
- `docs/specs/SPEC_V4_PRIVACY_ENGINE.md`
- `docs/specs/SPEC_V4_BATCH_AND_STRUCTURED.md`
- `docs/specs/SPEC_V4_QUALITY_SECURITY_DEPLOY.md`
- `docs/execution/TRAIN_V4.md`
- `docs/DEBT_REGISTER.md`
- `docs/ROADMAP.md`
- `docs/audits/`
