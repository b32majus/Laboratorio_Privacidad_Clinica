# V4 Unattended execution train

Status: **COMPLETED HISTORICAL ROADMAP — T01–T25 integrated**

## 1. Execution model

This file records the completed V4 migration roadmap and its historical execution evidence. It is **not** a current execution runbook. T01–T25 are integrated; new work must come from current accepted GitHub issue/spec authority.

Current execution uses Atenea C-084 (project-local OpenCode V2 agents + upstream Matt skills) under `AGENTS.md`, `CODING_STANDARDS.md` and `docs/ATENEA_EXECUTION_ROUTING_V0.md`. All Gentle/Pi/RDD/4R/review-lineage/burn instructions below are provenance only.

## 2. Frontier rule

A ticket is executable only when:
- `EXECUTION_READY=YES`;
- every `Blocked by:` issue is closed;
- cited specs exist at the start checkpoint;
- no open human-owned decision is listed;
- the repository/worktree/runtime preflight is healthy.

When more than one ticket is unblocked, map order below is the deterministic preference.

### Intra-train dependency exception (human-approved 2026-09-30)

The frontier rule above ("every `Blocked by:` issue is closed") applies to **external** dependencies. Within a single explicitly authorized prepared train, an open predecessor listed in `Blocked by:` may be treated as satisfied when all of the following hold:

1. the predecessor is itself an authorized Work Order in that same train;
2. its implementation is complete at an exact local checkpoint on the same train branch;
3. required deterministic verification/closeout for that predecessor is green;
4. native Gentle lifecycle for every required candidate is complete (`review_due=false`, or APPROVED + acknowledge/burn when review was due);
5. no unresolved HUMAN STOP, no product/scope/acceptance change, no publication-dependent acceptance requirement;
6. the successor consumes only the predecessor capability already present in that local checkpoint.

This exception does not mark the predecessor issue completed, does not bypass unrelated/external blockers, and does not authorize push/PR/merge. Issues remain open until accepted publication/integration. External ticket concurrency remains 1.

Authority: map issue #5 comment "Prepared-train dependency rule — 2026-09-30".


## Historical accepted checkpoint and exhausted frontier — 2026-09-30

```text
CURRENT_BASE_BRANCH=3.0-main
CURRENT_BASE_SHA=758acf6546b6c579e1882c743477a04d1cb96f90
LAST_MERGED_PR=#45
T21 #25 = integrated via PR #45
COMPLETED=T01–T20,T23,T21
HISTORICAL_COMPLETED_TAIL=T22 #26 → T24 #28 → T25 #29  # executed/completed historical sequence
```

PR #45 (merge de `work/t21-playwright-20260929`) integró y cerró T21 #25: suite Playwright crítica determinista contra build estático production-like, monitor de red E2E fail-closed con violación plantada, y cierre de deuda QA-002/QA-003. T23 #27 (supply-chain/CI) había cerrado antes.

**Historical completed tail (provenance only; not executable):** `T22 #26 → T24 #28 → T25 #29 → composed closeout → STOP`. At the time, T22 #26 had been marked `EXECUTION_READY=YES` (deudas PERF-001..004, spec `SPEC_V4_QUALITY_SECURITY_DEPLOY.md`) after its external blockers #9 and #25 were closed; that historical marker has no current execution authority. T24 #28 (bloqueos #13, #25, #27 cerrados) y T25 #29 (bloqueos #25, #26, #28) consumen los checkpoints locales aceptados del mismo train bajo la excepción intra-train de arriba. La rama/worktree histórica `work/opencode/v4-overnight-t17-t18-20260928` ya no es superficie de trabajo vigente.

**Deuda post-PR#42 (auditoría de promoción READ-ONLY):** registrada como duradero en issue #43 y en `docs/DEBT_REGISTER.md` (STRUCT-012/A1 alta, BATCH-003 actualización A2, CI-003/A4, DOC-002/A5 factual). No son bloqueantes retroactivos (la auditoría concluyó PASS) y NO se pliegan en T21 #25: A1 recibe una corrección propia y acotada (fail-closed de tamaño soportado en la entrada estructurada, misma autoridad `oversizeInputFor` aceptada por T15); A2 corrige propiedad de BATCH-003 (pipeline estructurado de app, no T20/T21); A4 es CI de proceso; A5 es factual only. El plan de lanzamiento histórico del tren T06–T08 (`TRAIN_T06_T08_20260924.md`) se conserva como evidencia cerrada, no como frontier vigente.

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
