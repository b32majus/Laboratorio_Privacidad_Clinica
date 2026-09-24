# V4 Unattended execution train

Status: **CURRENT ROADMAP / EXECUTION-READY WORK ORDERS**

## 1. Execution model

This roadmap is executed through the **current Atenea native Pi/Gentle protocol**. Historical GP2.7/GP3.x recipes do not override current Atenea `docs/START_HERE.md`.

- clean isolated worktree + fresh Pi session for a new train;
- GitHub Work Orders/specs own scope and acceptance;
- native Gentle owns ODD/decomposition/workers/verification/RDD/review/corrections/burn;
- external ticket/frontier concurrency remains `1`;
- coherent work-unit composition follows current Atenea policy;
- deterministic composed-state closeout is required before publishing a material multi-ticket train;
- publication requires explicit human authority; final merge remains human-owned.

Project-specific quality authority: `docs/execution/QUALITY_EXECUTION_PROTOCOL_V1.md`.

## 2. Frontier rule

A ticket is executable only when:
- `EXECUTION_READY=YES`;
- every `Blocked by:` issue is closed;
- cited specs exist at the start checkpoint;
- no open human-owned decision is listed;
- the repository/worktree/runtime preflight is healthy.

When more than one ticket is unblocked, map order below is the deterministic preference.


## Current accepted checkpoint and next prepared train — 2026-09-24

```text
CURRENT_BASE_BRANCH=3.0-main
CURRENT_BASE_SHA=f58b7823e7050a6387f59e5bd27007398a7bd41c
LAST_MERGED_PR=#35
COMPLETED=T01,T02,T03,T04,T05,T09,T10,T23
NEXT_PREPARED_TRAIN=T06 #10 → T07 #11 → T08 #12
```

The next prepared train is intentionally bounded to the core V4 path **input adapters → review workspace → Safe Output / Confidential Audit**. T11+ engine-policy migration and T17/T18 batch/structured branches are deliberately excluded from this train.

Exact launch/closeout plan: `docs/execution/TRAIN_T06_T08_20260924.md`.

## 3. Work packages

### Train A — canonical state and quality foundation

**T01 / #4 — ReviewSession / canonical final text**
Debt: FUNC-001, ARCH-001, ARCH-002, ARCH-005, ARCH-006, UX-006.
Result: DOM-independent review domain + contract tests.

**T02 / #6 — Ground-truth regression harness**
Debt: QA-001.
Result: synthetic annotated privacy corpus + metrics harness before changing recognizer semantics.

**T03 / #7 — Vite/TypeScript/React migration scaffold**
Debt: ARCH-009, ARCH-010, CODE-001, CODE-002.
Result: buildable SPA scaffold in parallel with legacy, no behavior rewrite.

**T04 / #8 — Job model + app shell navigation**
Debt: UX-002, UX-003, UX-005, UX-016.
Result: Input → Configure → Review → Export shell and domain Job state.

### Train B — bridge existing behavior into V4

**T05 / #9 — PrivacyEngine legacy adapter + ProcessingContext seam**
Debt: ARCH-003, BATCH-003.
Result: explicit engine interface/context without changing recognizer behavior.

**T06 / #10 — Unified input/file adapters**
Debt: FILE-001, FILE-002.
Result: text/TXT/DOCX/PDF ingestion contract and explicit scan/no-text errors.

**T07 / #11 — Review workspace wired to ReviewSession**
Debt: UX-009, UX-010, UX-011, UX-012, UX-013.
Result: three-pane responsive/accessible review surface driven by domain state.

**T08 / #12 — Safe Output vs Confidential Audit**
Debt: PRIV-002, UX-006.
Result: separate services/UI/artifacts; mandatory review gate.

**T09 / #13 — Runtime privacy boundary**
Debt: PRIV-001, PRIV-003, CI-002, HOST-001.
Result: remove third-party runtime/logs; no-network check; clinical-origin security baseline.

**T10 / #14 — Claims and terminology cleanup**
Debt: COPY-001, COPY-002, CI-001.
Result: no unsupported k-anonymity/differential-privacy/compliance/certification language.

### Train C — engine correctness and policy architecture

**T11 / #15 — Recognizer/Operator registry**
Debt: ARCH-004.
Result: detection separated from transformation; legacy behavior adapted.

**T12 / #16 — AGE recognizer + generalization operator**
Debt: FUNC-003.
Result: explicit age coverage with regression corpus.

**T13 / #17 — Date policy semantics / consistent shifting foundation**
Debt: FUNC-005, PRODUCT-001.
Result: policy-driven date handling without generic Visit-N destruction.

**T14 / #18 — Low-confidence review queue**
Debt: PRODUCT-004, UX-014.
Result: discarded/low-confidence candidates become visible domain/review state.

**T15 / #19 — Fail-closed input/processing invariants**
Debt: FUNC-004.
Result: no silent truncation; explicit supported-size/error contracts.

**T16 / #20 — Deterministic pseudonym identifiers**
Debt: PRODUCT-002.
Result: distinct/stable pseudonyms without gender inference within intended context.

### Train D — batch and structured

**T17 / #21 — Batch state/error/storage refactor**
Debt: FUNC-002, BATCH-001, BATCH-002, BATCH-004, UX-004.
Result: batch in app state, errors retained, real review status, no sessionStorage payload shuttle/monkey patch.

**T18 / #22 — Structured parser + profiling hardening**
Debt: STRUCT-001, STRUCT-002, STRUCT-003, STRUCT-004, STRUCT-007, STRUCT-008, STRUCT-009.
Result: robust CSV/XLSX ingestion, multi-sample classification, single patient ID authority.

**T19 / #23 — Structured date/age/policy semantics**
Debt: STRUCT-005, STRUCT-006.
Result: correct longitudinal date/age handling and policy-driven transformations.

**T20 / #24 — Structured classification workspace**
Debt: UX-015, PRODUCT-006.
Result: Identifier/Quasi/Sensitive/Insensitive/Unknown UI integrated into shell.

### Train E — assurance, scale and delivery

**T21 / #25 — Full critical Playwright E2E + network invariant**
Debt: QA-002, QA-003.
Result: accepted critical user/security contracts executable in CI.

**T22 / #26 — Worker/performance/lazy-load/indexes**
Debt: PERF-001, PERF-002, PERF-003, PERF-004.
Result: off-main-thread processing, targeted loading and benchmark evidence.

**T23 / #27 — Supply-chain/build/security CI**
Debt: SUPPLY-001, QA/code governance debt.
Result: reproducible runtime dependencies, lint/type/build/security gates.

**T24 / #28 — Render Static deployment + security headers**
Debt: HOST-002.
Result: preview/production static configuration, CSP/headers, no server-side PHI plane.

**T25 / #29 — Legacy retirement + canonical repository governance**
Debt: ARCH-007, ARCH-008, GOV-001, GOV-002, GOV-003, DOC-001.
Result: legacy paths removed only after parity, canonical branch/version/docs and required checks aligned.

## 4. Outside unattended train

**OPS-01 / #30 — Spain/LaLiga hosting availability experiment**
Debt: HOST-003, HOST-004, HOST-005.

This is deliberately not normal unattended product implementation because it requires time-window/network-vantage evidence. It may be separately automated once the measurement vantage and schedule are explicitly defined.

## 5. Completion condition

The train is exhausted when every execution-ready compatible ticket is closed at an accepted remote checkpoint or the parent reaches a STOP condition.

Merge remains human.


## 6. Exact Work Order map

| Order | Issue | Purpose |
|---|---:|---|
| T01 | #4 | ReviewSession / canonical final text |
| T02 | #6 | Ground-truth privacy regression harness |
| T03 | #7 | Vite/TypeScript/React scaffold |
| T04 | #8 | Job model + app shell |
| T05 | #9 | PrivacyEngine adapter + ProcessingContext |
| T06 | #10 | Input/file adapters |
| T07 | #11 | Review workspace |
| T08 | #12 | Safe vs Confidential export |
| T09 | #13 | Runtime privacy boundary |
| T10 | #14 | Claims/terminology |
| T11 | #15 | Recognizer/Operator registry |
| T12 | #16 | AGE |
| T13 | #17 | Date semantics/date shift |
| T14 | #18 | Low-confidence queue |
| T15 | #19 | Fail-closed processing |
| T16 | #20 | Stable pseudonyms |
| T17 | #21 | Batch |
| T18 | #22 | Structured parser/profiling |
| T19 | #23 | Structured date/age policy |
| T20 | #24 | Structured classification UX |
| T21 | #25 | Critical Playwright E2E |
| T22 | #26 | Worker/performance |
| T23 | #27 | Reproducible dependencies/CI |
| T24 | #28 | Render Static/security headers |
| T25 | #29 | Legacy retirement/governance |
| OPS-01 | #30 | Spain/LaLiga hosting experiment |
