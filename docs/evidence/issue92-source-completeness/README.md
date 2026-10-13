# Issue #92 — Stage A: source → matrix completeness evidence (C-087)

> Status: **STAGE-A SOURCE MAPPING REVIEWED — F1–F6 corrected; seven gap adjudications human-approved; functional claims pending REC-12 verification**
> Unit: first ordered Stage-A work unit of GitHub issue #92 (REC-12 source→matrix completeness)
> Launch HEAD: `0eb840ce202546f8ed4f92a72cbd5967166c38e8` (branch `prep/issue92-source-completeness-c087-20261013`)
> Writable paths of this gap-adjudication unit: this file + `docs/audits/2026-10-recovery-traceability-matrix.md` (§F addendum + two approved rationale replacements). Everything else read-only.
> Gap-adjudication unit base (launch-preparation HEAD): `e4b06d543ea78cd9e928b503a0e614988f41f30e` (branch `prep/issue92-gap-adjudication-c087-20261013`).
> Date: 2026-10-13

## 0. Purpose, method and limits

This artifact proves or falsifies one property: **every material obligation in the two frozen September audits, the selectively inspected v3 heritage, and the binding human-product authority documents is explicitly traceable to a row of `docs/audits/2026-10-recovery-traceability-matrix.md` §A/§B/§C (88 + 42 + 12 rows) or to a traceable, explicitly human-ratified supersession.**

Method:

- Row-name approximation is not accepted. Each mapping compares the **material behavior** of the source obligation (user/product/privacy behavior, format, output, human action/state, language, safety, expected failure/recovery) against the row's frozen objective and rationale.
- Genuinely identical obligations may share a matrix row; the source locator is never obscured.
- No matrix verdict was rewritten. Where the matrix's own status contradicts later accepted authority, the contradiction is **recorded, not resolved** (§8).
- **This is documentary evidence only.** A `VERIFIED_RESOLVED` verdict in the matrix is a *claim* this mapping traces, not a functional proof. No runtime behavior, journey or output was executed or verified here. Functional re-verification belongs to the later authorized layers of #92 (REC-12 §"Owns": 88-row re-run, 42-row re-run, composed E2E).

### Disposition vocabulary (each enumerated obligation carries exactly one)

| Disposition | Meaning |
|---|---|
| `ROW` | Traced to a specific existing matrix row (§A/§B/§C ID); row may be supersession-carrying, PARTIAL, OPEN or FUTURE — the row honestly represents the obligation. |
| `ROW (addendum)` | Traced to a human-approved matrix §F addendum row (`REC12-GAP-01..07`); inventory coverage only — the underlying obligation remains **unverified or future-out-of-scope** per its approved disposition. |
| `SUPERSEDED` | No single row carries the obligation; it is closed by a traceable, explicitly human-ratified decision (cited). |
| `GAP` | Obligation absent or materially narrower in the matrix; logged in §6 GAP table with proposed owner. Never auto-marked superseded. |
| `UNVERIFIED` | Coverage could not be established or source claim could not be inspected; logged in §7. |

### Headline result

- Material obligations enumerated: **206** (S1: 98, S2: 54, S3: 42, S4: 12) — unchanged by adjudication.
- **At the original review checkpoint (historical, preserved):** traceably covered by an existing matrix row (disposition `ROW`): **197**; verified human supersessions (all carried by rows or explicit decisions): **6 groups** (§5.3); **GAPs: 7** (§6) → source-completeness was **not** proven clean; per handoff §2, missing/doubtful obligations implied `SOURCE_MATRIX_GAPS / HUMAN_STOP`, not `RECOVERY_COMPLETE`. Historical arithmetic: **197 ROW + 2 SUPERSEDED + 7 GAP = 206**.
- **After the human-approved gap adjudication (2026-10-13):** each of the seven formerly unmapped obligations now cites an exact new matrix addendum ID `REC12-GAP-01..07` (matrix §F): **204 ROW + 2 SUPERSEDED + 0 unmapped = 206**. The seven originally missing obligations remain **unverified or future-out-of-scope** per their approved dispositions (§6.1); inventory coverage is now explicit, but no functional claim is made — each row's falsifying proof is still owed in REC-12.
- UNVERIFIED limitations: **6** (§7).
- Uncertain/contradictory claims: **6** (§8); the two stale rationales (`UX-015`, `QA-002`) were replaced verbatim in the matrix by the human-approved adjudication unit.
- Matrix row-count inventory re-verified from this HEAD: §A = 88, §B = 42, §C = 12, plus §E = 2 post-review debt rows (`DISC-01`, `DISC-02`) and §F = 7 REC-12 source-completeness addendum rows (`REC12-GAP-01..07`), all outside the 88/42/12 count and owned by REC-12.

---

## 1. SOURCE inventory

| # | Source | Stable locator | SHA / pin | Role |
|---|---|---|---|---|
| S1 | `docs/audits/2026-09-privacy-functional-code-audit.md` (508 lines, frozen) | Section headings `§2`–`§11` as cited per row | blob `ee59c5b51001886ecbbf276cbe2d5637ecea91e5` at HEAD `0eb840c`; byte-identical at freeze commit `e164ca2` (verified: `git diff e164ca2 -- <file>` empty) | Primary frozen audit — privacy/functional/code debt + candidate improvements |
| S2 | `docs/audits/2026-09-ux-ui-product-flow-audit.md` (674 lines, frozen) | `§1`–`§18` (UX-01..14, A11Y-01..06, §4–§18) | blob `045a12bd625428b26a9da82373e7aec3c39fd127` at HEAD; byte-identical at `e164ca2` | Primary frozen audit — UX/UI/product-flow requirements |
| S3 | v3 heritage product + code | `3.0-main@331bcaf4a624659c77823a0c4b427d46347ea104` (original audited product) and freeze `e164ca23397b474188babd8a10d175f13b4ebf50` | Both SHAs verified reachable; audits identical at both | Material capabilities evidenced in S1/S2 and October recovery evidence; selectively inspected (§4), not a full old-code audit |
| S4 | Binding human-product additions | `docs/audits/2026-10-product-design-reconciliation-final.md` (blob `2ca01cea…`), `docs/HUMAN_PRODUCT_DESIGN_AUTHORITY_V1.md` (blob `3e1ef1c4…`), `docs/shaping/CURRENT_DECISIONS.md` (blob `2a434660…`) at HEAD `0eb840c` | HEAD-pinned | Accepted / superseded authority mapping (§5) |
| T | Target matrix | `docs/audits/2026-10-recovery-traceability-matrix.md` §A/§B/§C (+§D/§E) | blob `42482d50a987ac2dfa1e21eca7ebce4b461c5341` at HEAD | The 88+42+12 rows being proven complete or incomplete |

Task authority read and honored: GitHub issue #92 subject matter via handoff; `docs/START_HERE.md` (blob `5f462418…`), `docs/RECOVERY_MASTER_PLAN_2026-10.md` §REC-12/§4.1 (blob `d37e79f9…`).

---

## 2. Source 1 — `2026-09-privacy-functional-code-audit.md` (98 obligations)

### 2.1 §2 "Fortalezas existentes que deben preservarse" (10)

| ID | Material obligation (falsifiable behavior) | Matrix ID | Disposition | Evidence / notes |
|---|---|---|---|---|
| S1-2-01 | Modular engine core (detectors/managers/scoring/processor) remains separable, not monolithic | `ARCH-004`, `ARCH-003` | ROW | `ARCH-003` honestly PARTIAL (legacy singletons behind seams). |
| S1-2-02 | Local-first processing in browser as product principle | `H-39` | ROW | Documentary only: `H-39` (NEW_IMPROVEMENT) carries the runtime topology claim ("V4 clinical dist is static, same-origin-only, CSP/no-network guarded") as a frozen matrix register verdict — a claim traced, not verified here (see §7 item 4); no runtime/deployment probe was run in this documentary unit. |
| S1-2-03 | Clinical content is escaped/safely rendered (v3 `SafeRender` property) | `ARCH-009` | ROW | Subsumed by V4 React declarative rendering; deterministic check this HEAD: zero `dangerouslySetInnerHTML` and zero `innerHTML` in `app-v4/src/`. |
| S1-2-04 | Sensitive data in ephemeral session storage via AppSession, not localStorage | `BATCH-002`, `D-013` (CURRENT_DECISIONS) | ROW | V4 goes further: memory-only sensitive Job state (HPD §2 protected authority). |
| S1-2-05 | Global session-deletion control exists | `UX-016`, `PDR-07` | ROW | Row verdict DELIBERATELY_SUPERSEDED for permanent visibility; destructive-clear distinctness explicitly preserved (HPD §7). |
| S1-2-06 | Structured module keeps pseudonymized output and confidential correspondence separate | `PRIV-002`, `H-28`, `H-29` | ROW | |
| S1-2-07 | CI keeps link/storage/smoke checks | `CI-001`, `CI-002`, `QA-003` | ROW | |
| S1-2-08 | Local dictionaries + deterministic auditable heuristics preserved | `H-40`, `QA-001` | ROW | |
| S1-2-09 | Human review flow preserved | `H-09`, `ARCH-001` | ROW | |
| S1-2-10 | Structured module keeps column analysis, longitudinal validation, independent exporter | `H-20`, `H-24`, `H-27`, `H-28` | ROW | Heritage probes: `longitudinal-validator.js`, `xlsx-exporter.js`, `column-analyzer.js` exist at `331bcaf`. |

### 2.2 §3 P0 findings (7)

| ID | Material obligation | Matrix ID | Disposition | Evidence / notes |
|---|---|---|---|---|
| S1-P0-01 | Clinical origin has zero third-party JS/resources; marketing separated; CSP; CI fails on unauthorized network deps | `PRIV-001`, `HOST-001`, `CI-002`, `QA-003` | ROW | `HOST-001` honestly PARTIAL (external-origin topology recording owed); audit's four corrections each trace. Heritage confirmed: MailerLite universal.js loaded in v3 `index.html:97`. |
| S1-P0-02 | Safe Output contains no originals/mappings; Confidential Audit separate and marked | `PRIV-002`, `H-42`, `D-005` | ROW | Heritage confirmed: v3 `js/export/pdf-report.js:102` prints `entity.original → entity.transformed`; batch exporter prints Original/Transformado tables (`js/batch-exporter.js:73-74,145-146,305-306,328-329`). |
| S1-P0-03 | Exports/copy derive only from the actually reviewed text (`ReviewSession` truth) | `FUNC-001`, `ARCH-001` | ROW | Heritage confirmed: v3 copy used pre-review `processingResult.processed` (`js/shared/review-ui.js:156`, `review.html:629`). |
| S1-P0-04 | Batch never claims unperformed human review; explicit states; safe export blocked with pending decisions | `FUNC-002`, `H-17` | ROW | Heritage confirmed: `batch-review-legacy.html:458-460` `saveCurrentDocState()` sets `reviewed = true` on navigation. |
| S1-P0-05 | AGE recognizer + configurable generalization operators in free text | `FUNC-003` | ROW | Heritage confirmed: v3 core detectors are `cuasiidentificadores/fechas/identificadores/nombres/ubicaciones` — no age detector. |
| S1-P0-06 | No unimplemented k-anonymity / differential-privacy claims; describe only real techniques | `COPY-001`, `D-006` | ROW | Heritage confirmed: claims present in v3 `review.html` and `funcionamiento.html`. |
| S1-P0-07 | No silent >1 MB truncation; fail closed | `FUNC-004`, `D-009` | ROW | Heritage confirmed: `js/core/processor.js:89` `MAX_TEXT_LENGTH = 1000000`. |

### 2.3 §4 P1 findings (21)

| ID | Material obligation | Matrix ID | Disposition | Evidence / notes |
|---|---|---|---|---|
| S1-P1-01 | Date roles distinguished; policies GENERALIZE/SHIFT_CONSISTENT/REDACT; consistent shifting for longitudinal intervals | `FUNC-005`, `PRODUCT-001`, `H-33` | ROW | Heritage confirmed: `FechasManager` visit-grouping exists (`js/core/managers/FechasManager.js`). |
| S1-P1-02 | ReviewSession/ReviewDecision as sole review state; DOM renders only | `ARCH-001`, `ARCH-002`, `D-004` | ROW | |
| S1-P1-03 | Adding a manual entity never loses prior review progress | `FUNC-006` | ROW | |
| S1-P1-04 | Offsets refer to canonical source text, never reconstructed from DOM | `FUNC-007` | ROW | |
| S1-P1-05 | `.doc` removed from supported formats or properly parsed | `FILE-001`, `H-08` | ROW | Removal is the frozen audit's own sanctioned correction alternative (P1-05: remove **or** properly parse), carried by `FILE-001` (VERIFIED_RESOLVED); heritage non-parity recorded by `H-08` (CORRECTLY_REMOVED). No separate human-ratified supersession is claimed (see §5.3 correction note). |
| S1-P1-06 | Scanned/no-text-layer PDFs detected and blocked with explicit message | `FILE-002` | ROW | |
| S1-P1-07 | No PHI/result logging in production | `PRIV-003` | ROW | |
| S1-P1-08 | Failed batch documents remain visible in batch state; export blocked until acknowledged/resolved | `BATCH-001`, `H-14`, `H-16` | ROW | |
| S1-P1-09 | Large batch not bound by sessionStorage capacity; memory-resident (or explicit quota-managed persistence) | `BATCH-002`, `PERF-004` | ROW | Heritage confirmed: batch review iframe state via `sessionStorage` in `batch-review-legacy.html` (8 occurrences). |
| S1-P1-10 | Cross-document consistency via explicit shared ProcessingContext, not monkey-patching | `BATCH-003`, `H-15`, `D-011` | ROW | |
| S1-P1-11 | Monkey-patch restoration guaranteed (try/finally) — minimal form; target form = remove patch | `BATCH-004` | ROW | P1-11's minimal correction is subsumed by the target correction (removal) which `BATCH-004` carries. |
| S1-P1-12 | Structured UNKNOWN → review-required, never KEEP | `STRUCT-001`, `D-009` | ROW | Heritage confirmed: `column-analyzer.js:39` `UNKNOWN: 'KEEP'`. |
| S1-P1-13 | Single patient-ID authority; selection and column action cannot diverge | `STRUCT-002` | ROW | Heritage confirmed: v3 had parallel `patient-id-column` concept and `PATIENT_ID` column action (`column-analyzer.js:9,26`). |
| S1-P1-14 | Valid multiline CSV parsing (consolidated parser) | `STRUCT-003` | ROW | Row honestly PARTIAL (custom parser retained); follow-up post-recovery debt recorded in row. |
| S1-P1-15 | Column inference profiles distributed non-empty samples, not row 1 only | `STRUCT-004` | ROW | |
| S1-P1-16 | VISIT_DATE not exact KEEP by default for external profiles; policy-driven | `STRUCT-005` | ROW | |
| S1-P1-17 | Age computed at visit/event date when a visit date exists, not current date (audit P1-17 clause 1) | `STRUCT-006` | ROW | Heritage confirmed: `file-processor.js:36` `dateReferenceForAge = new Date()`. The audit obligation has a second clause (generalize age on export outside the controlled environment) — enumerated separately as S1-P1-17b. |
| S1-P1-17b | When structured data is exported outside the controlled environment, age is additionally generalized (audit P1-17 clause 2, `2026-09-privacy-functional-code-audit.md` lines 225–226) | `REC12-GAP-06` | **ROW (addendum)** | Originally GAP (no row or decision stated export-age generalization: `STRUCT-006` carries only the visit-date calculation; `STRUCT-005` covers the external-profile VISIT_DATE policy — the date, not the age; D-020's "ages banded" mapping is explicitly job-family-specific to text/document/batch, and D-021 gives structured non-date quasi-identifiers no universal automatic generalization). Human-approved 2026-10-13: carried by matrix §F addendum row `REC12-GAP-06` as **material privacy, UNVERIFIED — REQUIRES REC-12 TARGETED PROOF** (real structured export bytes with a safe synthetic fixture; a violation triggers HUMAN STOP for an independently approved bounded privacy repair; do not conflate text-policy D-020 with structured D-021). Original GAP-6 provenance preserved in §6. |
| S1-P1-18 | Excel sheet selection (not first sheet only) | `STRUCT-007`, `H-22` | ROW | Heritage confirmed: `file-reader.js:58` uses `SheetNames[0]` only. |
| S1-P1-19 | Excel date serials normalized explicitly (SheetJS), not `new Date(value)` | `STRUCT-008` | ROW | |
| S1-P1-20 | Blank/null values preserved as absence, never codified as category | `STRUCT-009` | ROW | |
| S1-P1-21 | "anonimizado" wording only where risk evaluation supports it; use seudonimizado/preparado | `COPY-002`, `D-006` | ROW | |

### 2.4 §5 architecture/maintainability findings (11)

| ID | Material obligation | Matrix ID | Disposition | Evidence / notes |
|---|---|---|---|---|
| S1-A-01 (P1A-01) | Review logic not duplicated between page and shared module | `ARCH-007`, `ARCH-009` | ROW | |
| S1-A-02 (P1A-02) | Legacy batch pages not part of main flow | `ARCH-008` | ROW | |
| S1-A-03 (P1A-03) | Mutable singletons replaced by instantiable engine/context | `ARCH-003` | ROW | Row honestly PARTIAL; follow-up recorded. |
| S1-A-04 (P1A-04) | Recognizers separated from operators/policies | `ARCH-004` | ROW | |
| S1-A-05 (P1A-05) | Standard Detection contract (id/type/subtype/start/end/original/confidence/source/reasons) | `ARCH-005` | ROW | Row honestly PARTIAL (Job Detection placeholder); follow-up recorded. |
| S1-A-06 (P1A-06) | Standard ReviewDecision contract (status enum, replacement, notes) | `ARCH-006` | ROW | |
| S1-A-07 (P1A-07) | DictionaryIndex precomputed/normalized (no repeated rebuild) | `PERF-003` | ROW | |
| S1-P2-01 | Conflict resolution by interval algorithm, not per-character Set | `PERF-004` | ROW | |
| S1-P2-02 | Reduce raw HTML-string UI construction; centralize escaping exceptions | `ARCH-009` | ROW | Subsumed by React migration; deterministic check: zero `innerHTML`/`dangerouslySetInnerHTML` in `app-v4/src/`. |
| S1-P2-03 | `alert()` replaced by structured errors/UI states | `CODE-003` | ROW | |
| S1-P2-04 | Vendor supply-chain governance (reproducible build or vendor manifest w/ hashes) | `SUPPLY-001` | ROW | |

### 2.5 §6 CI/quality findings (5)

| ID | Material obligation | Matrix ID | Disposition | Evidence / notes |
|---|---|---|---|---|
| S1-Q-01 (P1Q-01) | `check:positioning` / authoritative test chain executed in GitHub Actions | `CI-001` | ROW | Row honestly PARTIAL (literal full `npm test` chain not run); REC-12 follow-up recorded. |
| S1-Q-02 (P1Q-02) | Link/external-resource check protects local-first (no HTTP(S) exemptions defeating it) | `CI-002` | ROW | |
| S1-Q-03 (P1Q-03) | Versioned ground-truth corpus with MUST_REMOVE/KEEP/FLAG_FOR_REVIEW + per-type precision/recall/F1/FNR | `QA-001`, `H-40` | ROW | REC-01 delivered 35 core + 4 adversarial cases with machine-visible slices; row keeps the honest "not a universal quality grade" boundary. |
| S1-Q-04 (P1Q-04) | Playwright E2E for the 13 critical contracts (paste→review→copy, modifications in output, blocked safe export, scanned PDF warning, batch failure retention, UNKNOWN review, no external requests, marked confidential export, etc.) | `QA-002` | ROW | Row honestly PARTIAL with blocker Yes / REC-12; see §8 claim 5 on its stale rationale. |
| S1-Q-05 (P1Q-05) | Static-quality toolchain: ESLint; Prettier; TS/JSDoc+@ts-check; CodeQL; Dependabot/Renovate; **coverage** | `CODE-001`, `CODE-002` + `REC12-GAP-03` | **ROW (addendum)** | `CODE-001` carries ESLint + Prettier and `CODE-002` TypeScript/JSDoc; the CodeQL, Dependabot/Renovate and coverage sub-items are human-approved 2026-10-13 as matrix §F addendum row `REC12-GAP-03` (separately preserved, not silently dropped). Deterministic probe this HEAD: CodeQL config present (`.github/workflows/codeql.yml`) and Dependabot config present (`.github/dependabot.yml`) — configuration *presence*, not run/state/coverage proof; **no coverage tooling found** in `app-v4/package.json`, vitest/vite config, or `ci.yml`. Owner: REC-12 verification; #93 governance/CI closeout only after #92 authorizes it. No new suites. Original GAP-3 provenance preserved in §6. |

### 2.6 §7 performance findings (5)

| ID | Material obligation | Matrix ID | Disposition | Evidence / notes |
|---|---|---|---|---|
| S1-PERF-01 | Engine/batch processing off main thread (Web Worker) | `PERF-001` | ROW | |
| S1-PERF-02 | Lazy-load heavy parsers/exporters | `PERF-002` | ROW | |
| S1-PERF-03 | Precomputed normalized dictionary index | `PERF-003` | ROW | |
| S1-PERF-04 | No massive batch serialization round-trips | `PERF-004`, `BATCH-002` | ROW | |
| S1-PERF-05 | **Versioned performance benchmark**: 10 KB/100 KB/500 KB/1 MB; 1/10/50 documents; time, memory, responsiveness | `REC12-GAP-01` | **ROW (addendum)** | Originally GAP: `PERF-001..004` cover mechanisms, none requires measurement/versioning evidence. Human-approved 2026-10-13: carried by matrix §F addendum row `REC12-GAP-01` — **not verified**; no new strategic Train; owner REC-12 re-evaluates materiality/evidence, otherwise explicitly recorded post-recovery measurement debt. Original GAP-1 provenance preserved in §6. |

### 2.7 §8 "Mejoras de producto candidatas" (20)

| ID | Material obligation | Matrix ID | Disposition | Evidence / notes |
|---|---|---|---|---|
| S1-C-01 | Consistent date shifting | `PRODUCT-001`, `H-33` | ROW | |
| S1-C-02 | Deterministic, gender-free pseudonyms | `PRODUCT-002` | ROW | |
| S1-C-03 | Privacy policy modes (Standard / Strict / Longitudinal Research / External AI) | `PRODUCT-003`, `H-32`, `D-007` | ROW | |
| S1-C-04 | Low-confidence/discarded candidates panel | `PRODUCT-004`, `UX-014`, `H-34` | ROW | |
| S1-C-05 | Final Privacy Gate with objective pendings, never "certificado RGPD" | `PRODUCT-005`, `H-35`, `PDR-06` | ROW | Standalone-screen implication superseded by D-023/PDR-06 (authority preserved, presentation re-owned). |
| S1-C-06 | Structured classification Identifier/Quasi/Sensitive/Insensitive | `PRODUCT-006`, `D-012` | ROW | Five-class taxonomy + D-021 action authority. |
| S1-C-07 | ARX-lite uniqueness/equivalence-class metrics | `PRODUCT-007` | ROW | FUTURE_NOT_RECOVERY — explicit, ratified later-scope. |
| S1-C-08 | Configurable institutional dictionaries | `PRODUCT-008` | ROW | FUTURE_NOT_RECOVERY. |
| S1-C-09 | Plug-in recognizers | `PRODUCT-008` | ROW | FUTURE_NOT_RECOVERY. |
| S1-C-10 | Optional local NER as additional layer | `PRODUCT-009` | ROW | FUTURE_NOT_RECOVERY. |
| S1-C-11 | Local OCR for scanned PDFs | `PRODUCT-010` | ROW | FUTURE_NOT_RECOVERY; scan detection fails closed meanwhile. |
| S1-C-12 | FHIR JSON adapter | `PRODUCT-011` | ROW | FUTURE_NOT_RECOVERY. |
| S1-C-13 | Layout-preserving PDF redaction/reconstruction | `PRODUCT-012` | ROW | FUTURE_NOT_RECOVERY; REC-05 PDF makes no layout claim. |
| S1-C-14 | **DICOM as far-horizon capability** | `REC12-GAP-02` | **ROW (addendum)** | Originally GAP (matrix §D named DICOM in prose — "Advanced OCR/NER/FHIR/ARX/DICOM/layout-preserving PDF work remains future capability" — but unlike its siblings it had no explicit FUTURE row). Human-approved 2026-10-13: explicit `FUTURE_NOT_RECOVERY` carried by matrix §F addendum row `REC12-GAP-02` with pointer to the already accepted matrix §D far-horizon ruling. Traceability disposition only — no DICOM implementation/benchmark is implied or claimed. Original GAP-2 provenance preserved in §6. |
| S1-C-15 | Safe DOCX/TXT export | `H-11`, `H-13`, `D-024` | ROW | REC-05 canonical (Copy/TXT/DOCX/PDF). |
| S1-C-16 | Optional encrypted correspondence for reversible research | `PRODUCT-013` | ROW | FUTURE_NOT_RECOVERY. |
| S1-C-17 | HMAC/consistent per-study tokenization | `PRODUCT-013` | ROW | FUTURE_NOT_RECOVERY; in-Job deterministic Study IDs (REC-03) do not require HMAC. |
| S1-C-18 | Multi-sample column profiling | `STRUCT-004` | ROW | |
| S1-C-19 | Multi-sheet Excel selection | `STRUCT-007`, `H-22` | ROW | |
| S1-C-20 | Structured risk summary | `H-27`, `PRODUCT-007` | ROW | Deliberately narrowed to descriptive factual counts (D-021/D-022: "not a privacy/risk score"); risk-scoring aspect remains FUTURE via `PRODUCT-007`. |

### 2.8 §10 architecture principles (10)

| ID | Principle (material property) | Matrix ID | Disposition |
|---|---|---|---|
| S1-PR-01 | Local-first real and verifiable | `H-39`, `QA-003` | ROW |
| S1-PR-02 | Clinical origin free of third parties | `PRIV-001`, `CI-002` | ROW |
| S1-PR-03 | Fail-closed under uncertainty | `D-009`, `FUNC-004`, `STRUCT-001` | ROW |
| S1-PR-04 | Domain state independent of DOM | `ARCH-002` | ROW |
| S1-PR-05 | Review and export share single source of truth | `FUNC-001`, `ARCH-001` | ROW |
| S1-PR-06 | Safe output and confidential audit are distinct artifacts | `PRIV-002`, `D-005` | ROW |
| S1-PR-07 | Detectors and transformations are independent plug-ins | `ARCH-004`, `PRODUCT-008` | ROW |
| S1-PR-08 | Heavy processing off the main thread | `PERF-001` | ROW |
| S1-PR-09 | Product claims are testable | `COPY-001`, `CI-002` | ROW |
| S1-PR-10 | No feature finished without adequate regression tests | `QA-001`, `QA-002`, `D-016` evidence culture | ROW |

### 2.9 §11 open questions (8) — resolved through accepted decisions

| ID | Question | Resolution / Matrix ID | Disposition |
|---|---|---|---|
| S1-OPEN-01 | SPA/app shell vs multipage | `ARCH-009`, `D-001`/`D-023` | ROW |
| S1-OPEN-02 | Future frontend stack | `ARCH-009`, `D-002` | ROW |
| S1-OPEN-03 | Navigation model | `H-36` (DELIBERATELY_SUPERSEDED via D-023), `PDR-07` | ROW |
| S1-OPEN-04 | Text/file/structured workflow design | §A/§B rows group (`FUNC-*`, `BATCH-*`, `STRUCT-*`, `H-06..H-33`) | ROW |
| S1-OPEN-05 | Session persistence level | `BATCH-002`, `D-013` | ROW |
| S1-OPEN-06 | Application/marketing domain separation | `HOST-001`, `PRIV-001`, `D-014` | ROW |
| S1-OPEN-07 | Hosting platform | `HOST-002`..`HOST-005`, `D-015` | ROW |
| S1-OPEN-08 | MVP scoping vs later modules | Matrix §D scope ruling + `PRODUCT-007..013` FUTURE rows + RECOVERY_MASTER_PLAN | ROW |

### 2.10 §9 external patterns (advisory — non-material register)

`§9` (Presidio / Philter / ARX / Google Healthcare / AWS Comprehend / Private AI-Limina) is **adoption guidance**, not user/product/privacy behavior. Its concrete material behaviors are individually enumerated and mapped above: registry/operator separation (`ARCH-004`), Detection/ReviewDecision contracts (`ARCH-005`/`ARCH-006`), ground-truth metrics (`QA-001`), consistent date shifting (`PRODUCT-001`), entity+confidence as review workflow not suppression (`UX-014`, `H-34`), ARX classes (`PRODUCT-006`/`PRODUCT-007`), `FileAdapter → extract → detect → transform → reconstruct` (`H-07`, `H-20`). **Not counted as separate obligations**; no independent user-visible behavior exists to falsify.

---

## 3. Source 2 — `2026-09-ux-ui-product-flow-audit.md` (54 obligations)

### 3.1 Journey problems UX-01..UX-14 (14)

| ID | Material obligation | Matrix ID | Disposition | Evidence / notes |
|---|---|---|---|---|
| S2-UX-01 | No double landing before work; enter directly to workspace | `UX-002` | ROW | |
| S2-UX-02 | New privacy job infers pipeline from input; override only when necessary | `UX-003` + **D-019** (human-ratified 2026-10-10) | ROW | Override clause explicitly `DELIBERATELY_SUPERSEDED` with recorded rationale; deterministic fail-closed routing preserved. |
| S2-UX-03 | Batch presented as natural capability, no Premium/Activar framing | `UX-004`, `D-011` | ROW | |
| S2-UX-04 | Structured uses same visual system/shell as text/documents/batch | `UX-005` | ROW | REC-11 closed via Sophilux B V1 U1–U7 (PR #121); row carries it. |
| S2-UX-05 | Job stays alive in memory in one app shell; no page navigation/state shuttle | `ARCH-009`, `BATCH-002` | ROW | |
| S2-UX-06 | Export actions appear only when result can be produced; contextual CTA; safe export only after gate | `UX-006`, `PRODUCT-005`, `PDR-06` | ROW | P0 severity carried by `UX-006`. |
| S2-UX-07 | Permanent red disclaimer replaced by contextual notice; red reserved for real problems | `UX-007` | ROW | |
| S2-UX-08 | Opaque Strict mode replaced by four explicable Privacy Policies | `UX-008`, `H-32`, `D-007` | ROW | |
| S2-UX-09 | Review de-overloaded: content-first, contextual onboarding, no instruction walls | `PDR-02`, HPD-05, `UX-009` | ROW | |
| S2-UX-10 | "Restaurar" expressed as risky keep-original with contextual confirmation for direct identifiers | `H-41` | ROW | Closed by #82 / PR #109 (row records evidence). |
| S2-UX-11 | Single Entity Inspector (Original/Proposed/Type/Confidence/Reason/Action/Notes) | `UX-009`, `H-09` | ROW | Field-level completeness of the inspector is a Stage-B check against the row. |
| S2-UX-12 | Low-confidence candidates as real workflow tray/filters | `UX-014`, `H-34` | ROW | |
| S2-UX-13 | Manual missed-entity marking discoverable: visible command + keyboard shortcut + affordance | `H-10`, `PDR-03`, `H-37` | ROW | Selection/category closed by #81 (PR #111); shortcut aspect rides `H-37` (see §8 claim 1). |
| S2-UX-14 | Final pending screen answering "what remains?" with objective facts, no safety scores | `PRODUCT-005`, `H-35`, `PDR-06` | ROW | Standalone-destination implication superseded by D-023/PDR-06; readiness/warnings authority preserved. |

### 3.2 Responsividad y accesibilidad A11Y-01..06 (6)

| ID | Material obligation | Matrix ID | Disposition | Evidence / notes |
|---|---|---|---|---|
| S2-A11Y-01 | Real responsive design: desktop multi-panel / tablet drawer / mobile single column + entity bottom sheet | `UX-010`, `H-38` | ROW | |
| S2-A11Y-02 | Accessible darker operational primary; brand rose stays accent | `UX-011` | ROW | |
| S2-A11Y-03 | Tooltips not hover-only; keyboard/touch robust | `UX-012` | ROW | |
| S2-A11Y-04 | Icon buttons with `aria-label` and visible focus | `UX-012` | ROW | Subsumed under keyboard/touch accessibility row. |
| S2-A11Y-05 | **Entity highlights must not rely on color alone** (iconography/label/underline/pattern preserved) | `REC12-GAP-04` | **ROW (addendum)** | Originally GAP (no §A/§B/§C row names non-color entity coding). Human-approved 2026-10-13: binding requirement carried by matrix §F addendum row `REC12-GAP-04` — **UNVERIFIED, REQUIRES REC-12 TARGETED PROOF** (real rendered highlighter witness at 375/1280, ideally color-independent meaning; a failed witness => separate bounded accessible-product repair, never supersession/dilution). Original GAP-4 provenance preserved in §6. |
| S2-A11Y-06 | `h-screen + overflow-hidden` degradation fixed (zoom/small screens/mobile browser bars) | `UX-010` | ROW | Subsumed by responsive-layouts row. |

### 3.3 §4 App shell design (3)

| ID | Material obligation | Matrix ID | Disposition | Evidence / notes |
|---|---|---|---|---|
| S2-4-TOPBAR | Verifiable facts available (local-only processing, current policy, job context) + distinct destructive session clear; **no unprovable "safe data" claims** | `UX-016`, `PDR-07`, `COPY-001` | ROW | `UX-016` verdict DELIBERATELY_SUPERSEDED for permanent visibility; discoverability + destructive-clear separation preserved (HPD §7). |
| S2-4-RAIL | Minimal nav (New job / Workspace / Policies / Help); no PHI history by default; explicit local-only recovery | `H-36`, `D-013` | ROW | `H-36` verdict DELIBERATELY_SUPERSEDED (D-023): functions preserved, exact nav intentionally open. |
| S2-4-STEPPER | Visible horizontal stepper `Input → Configure → Review → Export` as product topology | — (carried by supersession) | **SUPERSEDED** | The visible-stepper prescription is explicitly superseded by D-023 / PDR-final A-01/R-01/HPD-01-02: internal pipeline may remain; a phase without human work earns no screen. Underlying no-op protection carried by `PDR-01`. |
| S2-4-NOHIST | No PHI-bearing history by default | `D-013`, `H-39` | ROW | Recorded with S2-4-RAIL in source but enumerated separately here; memory-only sensitive state. |

*(§4 contributes 4 obligations: TOPBAR, RAIL, STEPPER, NOHIST — each with its own disposition below.)*

### 3.4 §5 Home de aplicación (1)

| ID | Material obligation | Matrix ID | Disposition | Evidence / notes |
|---|---|---|---|---|
| S2-5-HOME | Single-entry job home: paste → text; 1 PDF → document; many → batch; XLSX → structured; formats TXT·PDF·DOCX·CSV·XLSX; incompatible mix explained and separated | `UX-003`, `H-04`, `H-05`, `H-06`, `H-07`, `H-20` + **D-019** | ROW | Mixed-input handling deliberately narrowed to fail-closed explanation (no auto-separation into jobs) — recorded and human-ratified in D-019. |

### 3.5 §6 Review workspace objetivo (2)

| ID | Material obligation | Matrix ID | Disposition | Evidence / notes |
|---|---|---|---|---|
| S2-6-WS | Three-pane review composition (filters / document / inspector) with decision and explanation co-located | — (composition hypothesis) | **SUPERSEDED** | Exact pane composition explicitly *not frozen* by PDR-final §4 and HPD-05/HPD-15 (real-app witness required; do not freeze spatial decisions from prose). Underlying invariants carried by `PDR-02`, `PDR-03`, `PDR-11`, `UX-009`. |
| S2-6-SHORTCUTS | Review shortcuts: accept / modify / keep-original / next-previous / manual-mark, inactive while editing | `UX-013`, `H-37` | ROW | See §8 claim 1: rows stale vs REC-09 #83 (PR #113). |

### 3.6 §7 Batch objetivo (1)

| ID | Material obligation | Matrix ID | Disposition | Evidence / notes |
|---|---|---|---|---|
| S2-7-BATCH | Batch as same-app work queue: per-document status, same inspector/review model, retry / remove / process / review-required / explicit error acknowledgment | `H-14`, `H-16`, `BATCH-001`, `PDR-05` | ROW | |

### 3.7 §8 Structured objetivo (2)

| ID | Material obligation | Matrix ID | Disposition | Evidence / notes |
|---|---|---|---|---|
| S2-8-WS | Data-classification workspace: column / class / action / confidence comparative view; Never UNKNOWN→KEEP | `UX-015`, `STRUCT-001`, `H-31`, `D-012` | ROW | Card-wall representation superseded by PDR-04; comparative-workspace obligation carried there. |
| S2-8-PANEL | Side panel facts: selected patient ID, unique patients, visits, warnings, risk summary | `H-27`, `PRODUCT-006`, `D-022` | ROW | Factual-counts narrowing deliberate (D-021/D-022); risk-score aspect FUTURE (`PRODUCT-007`). |

### 3.8 §9 Export objetivo (2)

| ID | Material obligation | Matrix ID | Disposition | Evidence / notes |
|---|---|---|---|---|
| S2-9-SAFE | Safe output zone: copy + TXT/DOCX/PDF (text) / XLSX (structured) / batch deliverables; no originals, no mappings | `H-11`, `H-12`, `H-13`, `H-28`, `D-024`, `PRIV-002` | ROW | |
| S2-9-CONF | Confidential audit zone: visibly distinct (locked/amber), contains identifiable data, separate download, additional confirmation | `H-42`, `PRIV-002`, `PDR-12`, `D-005` | ROW | Closed across structured/single/batch (H-42 evidence). |

### 3.9 §10 Sistema visual (3)

| ID | Material obligation | Matrix ID | Disposition | Evidence / notes |
|---|---|---|---|---|
| S2-10-TYPO | Inter operational typography; JetBrains Mono for IDs/technical values; Cormorant excluded from operative headings | `H-02`, `H-03` | ROW | `H-03` honestly TARGET_GAP (JetBrains Mono not installed) — traceable with open verdict; see §8 claim 3. |
| S2-10-COLOR | Color semantics: accessible rose primary, emerald/amber/red/blue/stone mapping; red never for permanent disclaimers | `UX-011`, `UX-007`, `H-02` | ROW | |
| S2-10-DENSITY | Review may be denser than landing; professional-tool density accepted | `PDR-09` | ROW | |

### 3.10 §11 Frontend architecture (1)

| ID | Material obligation | Matrix ID | Disposition | Evidence / notes |
|---|---|---|---|---|
| S2-11-FE | Vite + TypeScript + React + Tailwind + Worker + Vitest/Playwright; no Next.js/SSR; core preserved behind adapter; domain/UI state separation; no DOM-as-state | `ARCH-009`, `ARCH-010`, `ARCH-001`, `ARCH-002`, `D-002`, `D-003` | ROW | |

### 3.11 §12 Persistencia (2)

| ID | Material obligation | Matrix ID | Disposition | Evidence / notes |
|---|---|---|---|---|
| S2-12-PERSIST | Sensitive job data memory-only by default; no PHI history by default; non-sensitive preferences may persist | `D-013`, `BATCH-002`, `H-39` | ROW | The "preferences *may* persist" clause is permissive, not a falsifiable obligation; carried as D-013 boundary. |
| S2-12-RECOVERY | Local job recovery only as explicit opt-in design (IndexedDB, expiry/clear, never silent persistence) | `REC12-GAP-07` | **ROW (addendum)** | Originally GAP (`PDR-05` carries batch local-recovery capability but states no opt-in/expiry/clear/never-silent design constraint; `D-013` records the constraint as decision authority, not row coverage). Human-approved 2026-10-13: conditional opt-in constraint carried by matrix §F addendum row `REC12-GAP-07` — **pending inspection**: REC-12 first inspects actual persistence/current behavior; if persistence is implemented it requires explicit opt-in, expiry and clearing per D-013, never silent persistence; **no instruction to add IndexedDB**; any future persistence work inherits the constraint. Original GAP-7 provenance preserved in §6. |

### 3.12 §13 Arquitectura de origen (2)

| ID | Material obligation | Matrix ID | Disposition | Evidence / notes |
|---|---|---|---|---|
| S2-13-ORIGIN | Clinical origin: no MailerLite/Analytics/tag manager/chat widgets/remote fonts/images/external APIs; CSP `default-src 'self'` target | `PRIV-001`, `CI-002`, `HOST-001`, `HOST-002`, `QA-003` | ROW | |
| S2-13-URL | **No PHI in URL/query/hash; `Referrer-Policy: no-referrer`; `frame-ancestors 'none'`** | `REC12-GAP-05` | **ROW (addendum)** | Originally GAP (near-matches `HOST-002` "security headers is live" and `PRIV-001` do not name these invariants; live header values not inspectable documentarily). Human-approved 2026-10-13: binding invariants carried by matrix §F addendum row `REC12-GAP-05` — **not verified from source configs**; owner REC-12 runtime proof on the deployed clinical origin + #93 release/headers final smoke. Original GAP-5 provenance preserved in §6. |

### 3.13 §14 Hosting (1)

| ID | Material obligation | Matrix ID | Disposition | Evidence / notes |
|---|---|---|---|---|
| S2-14-HOSTING | Render Static as managed initial target; Cloudflare only behind Spain/LaLiga availability test; VPS/dedicated-IP as fallback planning; (Netlify/Vercel/GH-Pages = advisory comparisons) | `HOST-002`, `HOST-003`, `HOST-004`, `HOST-005`, `D-015` | ROW | Provider comparisons beyond these are advisory (non-material register). |

### 3.14 §15 Build/deploy + §16 Progressive migration (2)

| ID | Material obligation | Matrix ID | Disposition | Evidence / notes |
|---|---|---|---|---|
| S2-15-CI | CI chain lint/types/unit/privacy-regression/E2E/no-external-network/build; `npm ci && npm test && npm run build`; only `dist/` published | `CI-001`, `CI-002`, `QA-003`, `CODE-001`, `SUPPLY-001` | ROW | `CI-001` honestly PARTIAL on the literal `npm test` chain; REC-12 owns. |
| S2-16-MIG | Incremental migration steps A–G ending with legacy HTML removal only after E2E-proven parity | `ARCH-009`, `ARCH-010`, `ARCH-007`, `ARCH-008` | ROW | |

### 3.15 §17 UX success criteria (10)

| ID | Criterion | Matrix ID | Disposition |
|---|---|---|---|
| S2-17-1 | One main decision from app-open to job start | `UX-003`, `H-04` | ROW |
| S2-17-2 | No page navigation between input/review/export | `ARCH-009`, `UX-002` | ROW |
| S2-17-3 | User always knows job + policy in use | `UX-016`, `PDR-07` | ROW |
| S2-17-4 | Review progress visible and reliable | `PDR-05`, `PDR-11` | ROW |
| S2-17-5 | Safe output appears only when producible | `UX-006`, `UX-004` | ROW |
| S2-17-6 | A batch error never disappears | `BATCH-001`, `H-16` | ROW |
| S2-17-7 | Low-confidence is part of the workflow | `UX-014`, `H-34` | ROW |
| S2-17-8 | Text/doc/batch/structured feel like one application | `UX-005`, `PDR-04` | ROW |
| S2-17-9 | Mobile/tablet functional flow | `UX-010`, `H-38` | ROW |
| S2-17-10 | No element claims undemonstrable compliance/safety | `COPY-001`, `D-006` | ROW |

### 3.16 §18 Recommended decisions (1)

| ID | Material obligation | Matrix ID | Disposition |
|---|---|---|---|
| S2-18-DEC | Adopt SPA shell; Vite+TS+React; Render Static; Cloudflare experimental; origin separation; incremental migration; design-first screens | `ARCH-009`/`ARCH-010`, `HOST-002`/`HOST-004`, `PRIV-001`/`HOST-001`, `D-001..D-003`, `D-014`, `D-015` | ROW |

**S2 count reconciliation:** UX 14 + A11Y 6 + §4 4 (TOPBAR, RAIL, STEPPER, NOHIST) + §5 1 + §6 2 + §7 1 + §8 2 + §9 2 + §10 3 + §11 1 + §12 2 + §13 2 + §14 1 + §15/§16 2 + §17 10 + §18 1 = **54**.

---

## 4. Source 3 — v3 heritage evidence for matrix §B rows (42)

Every §B row must trace to a real v3/heritage capability or an audit/target requirement. Evidence below distinguishes **independently confirmed at pinned SHAs** from **evidenced by the frozen audits / accepted October evidence** (both are legitimate sources; only the former involved code probes in this unit).

| Row | Heritage capability | Evidence | Status |
|---|---|---|---|
| `H-01` | Entire v3 clinical UI in Spanish | v3 pages (`input.html`, `review.html`, `batch.html`…) carry Spanish copy (probes); START_HERE records REC-10 completion (PR #120) | Confirmed heritage; row verdict stale — §8 claim 2 |
| `H-02` | Sophilux visual identity (warm stone/rose, editorial heritage) | v3 `js/export/pdf-report.js:25` "SOPHILUX" branding; accepted design contract `docs/design/sophilux-b-v1/ACCEPTED_VISUAL_CONTRACT.md` (HPD §7.1, 2026-10-11/12 approvals) | Confirmed |
| `H-03` | JetBrains Mono proposal for IDs/technical values | S2 §10 typography direction | Evidenced (S2) |
| `H-04` | Preloaded clinical example cards | v3 `input.html:102-138` three cards (`urgencias`, `quirurgico`, `historia`) with inline no-PHI-style synthetic text | **Confirmed.** Note: repo files `ejemplos/04-caso-complejo-cuasiidentificadores.json` and `ejemplos/seguimiento_psoriasis.csv` existed at `331bcaf` but were **not wired into the v3 input surface** — the user-facing v3 capability is exactly three cards, matching the row. |
| `H-05` | Explicit `Pegar` clipboard button | v3 `input.html` contains "Pegar" (2 occurrences) | Confirmed |
| `H-06` | Paste/type free text input | S2 §5 home; v3 input surface | Evidenced (S2) |
| `H-07` | TXT/PDF/DOCX single-document input | S2 §5 formats; v3 `lib/pdf.min.js`, `mammoth.browser.min.js` in `batch.html:11-12` | Confirmed |
| `H-08` | Legacy `.doc` claim (UI claimed .doc, parser DOCX-only) | S1 P1-05 | Evidenced (S1) |
| `H-09` | Review highlights + accept/modify/restore actions | S1 P0-03 context; v3 `js/shared/review-ui.js` | Confirmed (probe: review-ui.js copy path + entity handling) |
| `H-10` | Manual missed-entity marking by selection | v3 `review.html:303` `manual-selection-tooltip`, selection handlers at `:1246-1263` | Confirmed |
| `H-11` | `Copiar Texto` in review | v3 `review.html:154` + `js/shared/review-ui.js:156` | Confirmed |
| `H-12` | Single-document PDF report via jsPDF | v3 `js/export/pdf-report.js` (jsPDF, "INFORME DE SESIÓN") | Confirmed |
| `H-13` | Safe TXT export | S2 §9 + S1 C-15 | Evidenced (S1/S2) |
| `H-14` | Batch multi-document processing w/ progress/status | v3 `js/batch-module.js` (`currentDoc` state machine) | Confirmed |
| `H-15` | Optional cross-document consistency | S1 P1-10 (monkey-patch mechanism) | Evidenced (S1) |
| `H-16` | Batch retry/remove/process/review-required/error acknowledgment | S2 §7 action list | Evidenced (S2) |
| `H-17` | Batch consolidated PDF with index | v3 `js/batch-exporter.js` consolidated PDF builder (jsPDF at `:241`, tables `:305-306`) | Confirmed |
| `H-18` | Batch per-document PDFs ZIP | v3 `js/batch-exporter.js:211-216` (JSZip) | Confirmed |
| `H-19` | Batch summary CSV | v3 `js/batch-exporter.js:407-410` (CSV + BOM) | Confirmed |
| `H-20` | Structured CSV/XLS/XLSX input | v3 `js/batch-structured/file-reader.js` (XLSX utils) | Confirmed |
| `H-21` | Workbook header auto-detection (up to first 10 rows, metadata skip) | v3 `column-analyzer.js`/`file-processor.js` header-analysis logic confirmed; the **10-row scan detail** is asserted by the row + REC-04 contract; v3-side 10-row scan not independently re-counted (see §7) | Confirmed w/ limitation |
| `H-22` | Multi-sheet behavior (v3 effectively first sheet) | v3 `file-reader.js:58` `SheetNames[0]` | Confirmed |
| `H-23` | Patient → Study ID (`ID_ESTUDIO`, `PAC_001…`) | v3 `file-processor.js:90,172,232` | Confirmed |
| `H-24` | Longitudinal row linkage | v3 `file-processor.js` patient study-ID + `longitudinal-validator.js` | Confirmed |
| `H-25` | Configurable Study-ID prefix (`PAC`) | v3 `file-processor.js:34` `idPrefix = 'PAC'` | Confirmed |
| `H-26` | Optional `Visita_Num` sequential per patient | v3 `file-processor.js:71-94` (`visitCounters`, `Visita_Num`) | Confirmed |
| `H-27` | Structured validation/stats (unique patients, visits, averages, warnings) | v3 `longitudinal-validator.js:3,78,93` | Confirmed |
| `H-28` | Structured Safe XLSX | v3 `js/batch-structured/xlsx-exporter.js` | Confirmed |
| `H-29` | Structured correspondence XLSX | v3 `xlsx-exporter.js` + correspondence separation (S1 §2-06) | Confirmed |
| `H-30` | Structured free-text processing target | S2 §8 table row `Notas_libres → Process as text` | Evidenced (S2) |
| `H-31` | Structured class→action semantics | S2 §8 classification table; `D-021` | Evidenced (S2 + decision) |
| `H-32` | Four Privacy Policies | S2-UX-08 | Evidenced (S2) |
| `H-33` | Text date shifting for longitudinal use | S1 C-01 / P1-01 | Evidenced (S1) |
| `H-34` | Low-confidence workflow target | S2-UX-12 | Evidenced (S2) |
| `H-35` | Privacy Gate target | S2-UX-14 | Evidenced (S2) |
| `H-36` | App IA: Workspace/Policies/Help nav proposal | S2 §4 rail | Evidenced (S2); superseded via D-023 |
| `H-37` | Review productivity shortcuts A/M/K/F + next/previous | S2 §6 shortcuts | Evidenced (S2); row stale — §8 claim 1 |
| `H-38` | Responsive app target | S2-A11Y-01 | Evidenced (S2) |
| `H-39` | Local-first clinical runtime principle | S1 §2-02/§10 PR-01; v3 `js/shared/session-controls.js` (local clear) | Confirmed |
| `H-40` | Spanish engine quality proof demand | S1 P0-05 + §2-08; v3 Spanish detectors confirmed | Confirmed |
| `H-41` | Keep-original contextual confirmation for direct identifiers | S2-UX-10 | Evidenced (S2) |
| `H-42` | Deliberate Confidential Audit download confirmation | S2 §9 confidential card ("confirmación adicional") + `D-022`/`D-024` | Evidenced (S2 + decisions) |

**Result:** all 42 §B rows trace to real heritage/audit material — the disposition of each heritage obligation is `ROW` (its own §B ID is the mapping target). No §B row is orphaned; no heritage capability with user/product/privacy materiality is absent from §B except as recorded in §6/§7/§8.

---

## 5. Source 4 — human-product authority mapping (12 PDR obligations + supersession register)

### 5.1 PDR-final accepted decisions → §C rows

| PDR row | Source locator (reconciliation final / HPD) | Semantic check |
|---|---|---|
| `PDR-01` | A-01 "task not topology"; A-02; HPD-01/HPD-02; R-02 | Matches: no no-op phase; no universal stepper. |
| `PDR-02` | A-04 "review is work"; HPD-05; correction list ("add explicit high-volume review requirement and correction/undo path") | Matches incl. realistic volume + no silent acceptance. |
| `PDR-03` | A-05 "manual missed entity never exposes offsets"; R-04; HPD-08 | Matches. |
| `PDR-04` | A-06 "comparative data-workspace"; R-05; HPD §6.3 | Matches. |
| `PDR-05` | A-07 "batch work queue with local recovery"; HPD §6.4 | Matches. |
| `PDR-06` | A-03 "Result replaces Gate as human ending"; HPD-09; R-01 consequence | Matches: readiness rules survive, presentation re-owned. |
| `PDR-07` | R-03 "persistent full policy cards superseded"; HPD §7; A-09 | Matches incl. discoverability + destructive-clear separation. |
| `PDR-08` | A-09 "Spanish and hierarchy begin now"; HPD-11 | Matches. |
| `PDR-09` | HPD-12; A-09; G-HP1 | Matches. |
| `PDR-10` | A-10 "realistic density is product evidence"; HPD-13; G-HP5 | Matches. |
| `PDR-11` | HPD-14; G-HP6/G-HP7; corrections (correction/undo path) | Matches. |
| `PDR-12` | A-08 "Result action contextual"; R-06; HPD-10; G-HP9 | Matches. |

All 12 §C rows are faithful, non-narrowing translations of the accepted reconciliation; each has an owner and evidence rule in the matrix. **Disposition of each PDR obligation: `ROW`** (its own §C ID is the mapping target). No PDR obligation lacks a row.

### 5.2 HPD V1 invariants and gates (grouped, not separately counted)

- **Protected authorities (HPD §2)** — each maps to existing rows/decisions: local-first/no-network (`H-39`, `QA-003`), memory-only state (`D-013`, `BATCH-002`), ReviewSession authority (`ARCH-001`), canonical offsets (`FUNC-007`), ProcessingContext (`BATCH-003`), deterministic policy semantics (`FUNC-005`, `D-020`), Spanish engine architecture (`H-40`), fail-closed set (`D-009`, `FUNC-004`, `STRUCT-001`), Safe/Confidential separation (`PRIV-002`, `D-005`), Study-ID/correspondence semantics (`STRUCT-002`, `H-23`), low-confidence reviewable (`UX-014`), no overclaims (`COPY-001`, `D-006`), current-state/stale-async guards (`DISC-01`). Any weakening = HUMAN STOP (HPD §10) — consistent with handoff STOP conditions.
- **HPD-01..HPD-15 invariants** — carried by §C rows as mapped in 5.1 (HPD-01/02→PDR-01, HPD-03→PDR-07/quiet-shell, HPD-04→PDR-04/05/06, HPD-05→PDR-02, HPD-06/07→H-41/H-42/PDR-02, HPD-08→PDR-03, HPD-09→PDR-06, HPD-10→PDR-12/H-42, HPD-11→PDR-08/H-01, HPD-12→PDR-09, HPD-13→PDR-10, HPD-14→PDR-11, HPD-15→PDR-10/policy §7.1 evidence rule). HPD §7.1 (visual direction B, 2026-10-11/12 approvals) maps to `H-02`, `UX-005`, `PDR-09`; the D1–D4/VF-01..08 functional reconciliation explicitly belongs to #90/#91 with **composed validation in #92** (recorded as a Stage-B/C obligation, not a new row requirement).
- **G-HP1..G-HP10 acceptance gates** — evidence rules per user-facing REC; they bind candidates, not matrix rows; no orphaned gate.

### 5.3 Verified human supersessions (6 groups)

| # | Superseded prescription | Ratifying authority | Carrying row(s) | Verification |
|---|---|---|---|---|
| SS-1 | Generic input-pipeline override ("override when necessary", S2-UX-02) | **D-019**, proposed 2026-10-07, explicitly **human-ratified 2026-10-10**, with recorded falsation rationale | `UX-003` | Verified: decision text complete, rationale explicit, deterministic-evidence obligation stated. |
| SS-2 | Universal five-step visible topology (S2 §4 stepper; D-001 presentation clause) | **D-023** (accepted 2026-10-05 reconciliation, human-approved decision record) | `PDR-01`, `H-36` | Verified. |
| SS-3 | `Privacy Gate` as standalone user destination (S2-UX-14, S1-C-05) | **D-023** + HPD-09 | `PRODUCT-005`, `H-35`, `PDR-06` | Verified: readiness authority explicitly preserved; only presentation superseded. |
| SS-4 | Permanent Job/policy/fact shell visibility (S2 §4 topbar/nav) | **D-023** + HPD §7 | `UX-016`, `PDR-07` | Verified: discoverability + destructive-clear separation explicitly retained — not a silent narrowing. |
| SS-6 | Advanced capabilities as recovery scope (ARX-lite, plugins, NER, OCR, FHIR, layout PDF, HMAC) | Matrix §D ruling + START_HERE §6 (accepted authority) | `PRODUCT-007..013` FUTURE_NOT_RECOVERY | Verified as explicit, ratified later-scope — not silent omissions. |
| SS-7 | Three-pane review / frozen spatial hypotheses (S2 §6) | PDR-final §4 + HPD-15 (human-approved reconciliation) | `PDR-02`, `PDR-03`, `PDR-11` | Verified: hypotheses superseded as *authority*, invariants retained. |

> **Correction note (review attempt #1, finding F3):** SS-5 (legacy `.doc` non-parity) was downgraded out of this register. No human-ratified supersession decision for `.doc` non-parity exists in `docs/shaping/CURRENT_DECISIONS.md` or `docs/audits/2026-10-product-design-reconciliation-final.md` (D-019 mentions `.doc` only incidentally, as an unsupported format inside the pipeline-override rationale). The `.doc` removal is the frozen audit's own sanctioned correction alternative (P1-05: remove **or** properly parse), carried by `FILE-001` (VERIFIED_RESOLVED) and heritage row `H-08` (CORRECTLY_REMOVED); S1-P1-05 therefore remains `ROW` and no supersession is claimed for it.

**Key check (material risk 2):** no source obligation was found marked superseded *without* a traceable human-ratified decision, and no supersession erases the underlying user need (each keeps a carrying row).

---

## 6. GAP table (7)

| # | Source locator | Expected behavior (falsifiable) | Near-match row(s) | Missing delta | Proposed accountable owner | Minimum falsifying evidence |
|---|---|---|---|---|---|---|
| GAP-1 | S1 §7 PERF-05 (`2026-09-privacy-functional-code-audit.md`, PERF-05) | Versioned performance benchmark exists (10 KB–1 MB text; 1/10/50 documents; time/memory/responsiveness) | `PERF-001..004` (mechanisms only) | No matrix row requires performance measurement/versioning; nothing in §A/§B/§C carries it | REC-12 decision: accept as post-recovery debt with explicit row, or record human decision that it is not recovery-material | Either an explicit matrix row + benchmark artifact/thresholds, or a recorded human decision with rationale |
| GAP-2 | S1 §8 item 14 (`DICOM como horizonte lejano`) | DICOM explicitly recorded as far-future, not silently absent | Matrix §D prose; pattern rows `PRODUCT-010..012` | Sibling far-horizon capabilities each have an explicit FUTURE row; DICOM exists only as §D prose | REC-12 / human: add explicit FUTURE_NOT_RECOVERY row or record §D prose as accepted coverage | Explicit matrix row, or recorded decision accepting prose coverage |
| GAP-3 | S1 §6 P1Q-05 sub-items: CodeQL; Dependabot/Renovate; coverage | The static-quality toolchain includes CodeQL analysis, Dependabot/Renovate dependency governance, and coverage measurement | `CODE-001` (ESLint/Prettier only), `CODE-002` (TS/JSDoc only) | No matrix row names CodeQL, Dependabot/Renovate or coverage. CodeQL config (`.github/workflows/codeql.yml`) and Dependabot config (`.github/dependabot.yml`) exist at this HEAD, but their mere presence is implementation presence, not matrix coverage; **coverage tooling not found** in `app-v4/package.json`, vitest/vite config or `ci.yml` | REC-12 decision: add rows (or extend `CODE-001`/`CODE-002`) carrying the CodeQL, Dependabot/Renovate and coverage sub-items, or record them as not recovery-material | Either gate/row config + evidence for each sub-item, or recorded decision |
| GAP-4 | S2 §3 A11Y-05 | Entity highlights carry a non-color code (icon/label/underline/pattern) so entity type is identifiable without color perception | `UX-011` (contrast), `UX-012` (keyboard/touch), `PDR-09` | No row names non-color entity coding; whether current V4 highlights satisfy it is unproven here | Human product decision + REC-12 verification (does the accepted Sophilux B V1 system include non-color entity coding?) | Rendered 375/1280 witness showing entity type identifiable without color, or a recorded explicit supersession |
| GAP-5 | S2 §13 (origin hardening list tail) | No PHI in URL/query/hash; `Referrer-Policy: no-referrer`; `frame-ancestors 'none'` | `PRIV-001`, `HOST-002` ("security headers is live"), `QA-003` (no-network E2E) | No row names these specific invariants; live header values cannot be inspected documentarily | REC-12 verification: composed SPA URL/no-PHI check + live response-header capture, or explicit supersession | Header capture + URL-invariant E2E evidence, or recorded decision |
| GAP-6 | S1 §4 P1-17 clause 2 (`2026-09-privacy-functional-code-audit.md` lines 225–226): structured export outside the controlled environment | Age is additionally generalized (not left exact) when structured data is exported outside the controlled environment (e.g., External-AI preparation) | `STRUCT-006` (visit-date age clause only), `STRUCT-005` (external-profile VISIT_DATE policy — the date, not the age); D-020's "ages banded" is explicitly job-family-specific to text/document/batch; D-021 gives structured non-date quasi-identifiers no universal automatic generalization | No matrix row or accepted decision states export-age generalization for the structured module | REC-12 decision: add a structured row (or extend `STRUCT-006`) carrying export-age generalization, or record an explicit human decision that the clause is covered elsewhere or superseded | Structured External-AI export witness showing banded/generalized age, or a recorded decision with locator |
| GAP-7 | S2 §12 "Recuperación de job" (`2026-09-ux-ui-product-flow-audit.md`, §12) | If local job recovery exists, it is an explicit opt-in design (IndexedDB, clear/expiry, never silent persistence) | `PDR-05` (batch local-recovery capability; no opt-in/expiry/clear constraint stated), `BATCH-002` (memory-resident batch state); supporting decision `D-013` (accepted decision, not a matrix row) | No matrix row carries the opt-in/expiry/clear/never-silent design constraint; the mapping previously cited `D-013` alone as `ROW`, which the disposition vocabulary does not permit | REC-12 decision: add a row carrying the constraint (or extend `PDR-05`/`BATCH-002`), or record where the constraint authoritatively lives | Recovery-design evidence showing opt-in + clear/expiry + no silent persistence, or a recorded decision assigning the constraint to a specific row |

None of the seven is auto-classified as superseded: each requires an owner decision (add row / schedule verification / explicit human supersession). Per handoff §2, their existence meant Stage A's verdict was **`SOURCE_MATRIX_GAPS` pending human adjudication**, not clean coverage.

### 6.1 Human-approved adjudication (2026-10-13)

The human + Cora checkpoint approved the seven dispositions in chat after independent review. Each formerly unmapped obligation now cites an exact matrix §F addendum row. These dispositions are **documentary only** — no implementation/functional repair is performed or claimed, and the original GAP provenance in the table above is preserved verbatim.

| GAP | New matrix ID | Approved disposition | Remaining functional obligation (falsifying proof) |
|---|---|---|---|
| GAP-1 (S1 PERF-05) | `REC12-GAP-01` | ROW (addendum) — versioned performance measurements preserved; no new strategic Train; owner REC-12 re-evaluates materiality/evidence, else explicitly recorded post-recovery measurement debt | Versioned performance measurements (10/100/500 KB/1 MB; 1/10/50 docs; latency, memory, responsiveness) or a recorded human debt decision. **Not verified.** |
| GAP-2 (S1 C-14, DICOM) | `REC12-GAP-02` | ROW (addendum) — explicit `FUTURE_NOT_RECOVERY` pointing to the already accepted matrix §D far-horizon ruling; traceability disposition only, no DICOM implementation/benchmark implied | None for recovery closure; falsified only by a DICOM implementation/benchmark claim without separately accepted scope. |
| GAP-3 (S1 P1Q-05) | `REC12-GAP-03` | ROW (addendum) — CodeQL, Dependabot/Renovate and test coverage separately preserved; presence of `.github/workflows/codeql.yml` and `.github/dependabot.yml` is configuration evidence only; owner REC-12 verification; #93 governance/CI closeout only after #92 authorizes it; coverage never silently dropped; no new suites | CodeQL run evidence, dependency-governance run/state and a real coverage measurement. **Unverified.** |
| GAP-4 (S2 A11Y-05) | `REC12-GAP-04` | ROW (addendum) — binding non-color entity-type identification; owner REC-12 real rendered highlighter witness (375/1280, ideally color-independent meaning); failed witness => separate bounded accessible-product repair, not supersession/dilution | Rendered 375/1280 witness proving entity type identifiable without color. **Unverified.** |
| GAP-5 (S2 §13 URL/headers) | `REC12-GAP-05` | ROW (addendum) — binding no PHI in SPA URL/query/hash and `Referrer-Policy: no-referrer` + `frame-ancestors 'none'` on the deployed clinical origin; owner REC-12 runtime proof + #93 release/headers final smoke; not verified from source configs | Live-origin response-header capture + composed SPA URL/query/hash no-PHI check. **Unverified.** |
| GAP-6 (S1 P1-17 clause 2) | `REC12-GAP-06` | ROW (addendum) — material privacy: age is generalized when structured data is exported outside the controlled environment; owner REC-12 confirms applicability/policy + real structured export bytes with safe synthetic fixture; if violated => HUMAN STOP for independently approved bounded privacy repair; do not conflate text-policy D-020 with structured D-021 | Real structured export bytes (safe synthetic fixture) showing export-age generalization. **Unverified.** |
| GAP-7 (S2 §12 recovery) | `REC12-GAP-07` | ROW (addendum) — conditional opt-in local job recovery constraint: never silent persistence; if persistence is implemented it requires explicit opt-in, expiry and clearing per D-013; no instruction to add IndexedDB; REC-12 first inspects actual persistence/current behavior; any future persistence work inherits the constraint | Inspection of actual persistence/current behavior; if persistence exists or is later implemented, explicit opt-in + expiry + clearing evidence per D-013. **Unverified.** |

With the matrix §F addendum rows, the mapping arithmetic becomes **204 ROW + 2 SUPERSEDED + 0 unmapped = 206**, but the seven obligations themselves remain **unverified or future-out-of-scope** exactly as dispositioned above: inventory coverage is now explicit; functional verification is not claimed and still belongs to REC-12.

---

## 7. UNVERIFIED limitations (6)

1. **Live deployment headers/values** (`HOST-002` claim "security headers is live"; GAP-5 specifics): live-origin inspection is outside documentary Stage A; the row's claim remains to be proven in REC-12 publication evidence.
2. **Remote GitHub governance state** (`GOV-001`/`GOV-002`): the rows cite GitHub API findings (default branch HEAD, branch-protection absence). Remote state cannot be re-verified from this worktree under Stage-A permissions; rows remain claims for REC-12.
3. **Operational availability risks** (`HOST-003`, `HOST-004`, `HOST-005`): OPEN_OPERATIONS/FUTURE rows whose closure is inherently non-documentary.
4. **Matrix `VERIFIED_*`/`PARTIAL` verdicts as a class**: this unit traces obligations to rows; it does **not** confirm the rows' implementation claims. Every verdict remains a claim to be re-verified against code and the shipped product in the later authorized layers of #92 (documentary mapping ≠ functional proof).
5. **Bounded heritage inspection scope**: audit code-claims were selectively probed and **all probes reproduced the audits' claims** (P0-01, P0-02, P0-03, P0-04, P0-05, P0-06, P0-07, P1-01, P1-09, P1-12, P1-13, P1-17, H-04/05/10/11/12/17/18/19/20/22/23/25/26/27/40). Claims not probed (e.g., P1-02/03/04/06/07 mechanics, H-21's v3-side 10-row detail, P1-20 codify-blank path) are accepted as frozen-audit authority, not independently confirmed here; they require no new row but remain Stage-B-verifiable.
6. **Current product language/shortcut/visual state** (`H-01`, `H-03`, `UX-013`, `H-37`): REC-09/10/11 closed after these rows were written; the *actual current* state of the product requires Stage-B functional verification (see §8).

---

## 8. Uncertain / contradictory claims (6)

These are **recorded, not resolved**. Stage A does not rewrite matrix verdicts.

1. **`UX-013` + `H-37` vs REC-09 completion.** Both rows assert dedicated review shortcuts were "never implemented" with blocker Yes / TARGET_GAP, but accepted authority (`START_HERE` §4, RECOVERY_MASTER_PLAN status) records REC-09 COMPLETE including #83 (PR #113, "scoped shortcuts", next/previous attention). The rows are stale relative to merged work; whether the frozen A/M/K/F + next/previous contract is materially satisfied needs Stage-B functional verification and a matrix refresh decision.
2. **`H-01` vs REC-10 completion.** Row verdict **LOST** / blocker Yes / REC-10, but REC-10 is COMPLETE (#90, PR #120). Stale row; current product-language state needs Stage-B verification and matrix refresh.
3. **`H-03` vs REC-11 completion.** Row verdict TARGET_GAP owned by REC-11, but REC-11 is COMPLETE (#91, PR #121). Whether #91 closed or deliberately retained the JetBrains Mono target gap is not stated in the row; needs adjudication, not silent acceptance.
4. **`UX-015` internal rationale contradiction.** The row's rationale says structured productive semantics "remain incomplete under REC-03", while `STRUCT-002`/`H-23`/`H-30`/`H-31` record REC-03 complete (PR #70) with D-021 productive authority. The row verdict (classification workspace VERIFIED_IMPROVED) is unaffected; the rationale is stale.
5. **`QA-002` stale rationale.** Rationale says output-parity E2E cases "cannot be covered until those capabilities are restored", but REC-05/06/07 restored them (Copy/TXT/DOCX/PDF, batch CSV/ZIP/PDF, batch Confidential — per `H-11..H-19`, `H-42`). The row's blocker (REC-12 owns full parity suite) remains valid; the rationale is stale.
6. **`D-016` policy reference.** `CURRENT_DECISIONS.md` D-016 cites "current Atenea C-084" as the execution model; standing authority is now C-087 (`AGENTS.md`). Non-product, non-blocking documentary staleness; noted for the REC-12 documentation-refresh obligation (`DOC-001`), not adjudicated here.

---

## 9. Summaries

| Measure | Count |
|---|---|
| Material obligations enumerated (S1 98 + S2 54 + S3 42 + S4 12) | **206** |
| Traceably covered by an existing matrix row (disposition `ROW`) | **197** at the original review checkpoint → **204** after the human-approved gap adjudication (matrix §F addendum `REC12-GAP-01..07`) |
| GAPs (disposition `GAP`, §6) | **7** at the original review checkpoint → **0 unmapped** after the human-approved adjudication (§6.1); the seven obligations remain unverified or future-out-of-scope per their approved dispositions |
| UNVERIFIED dispositions | **0** (6 limitation entries in §7 are tied to existing rows/claims, not unmapped obligations) |
| Standalone `SUPERSEDED` dispositions | **2** (S2-4-STEPPER, S2-6-WS — carried by D-023/PDR-01 and PDR-final §4/HPD-15 respectively) |
| Verified human supersession groups | **6** (§5.3; former SS-5 downgraded — see §5.3 correction note) |
| Uncertain/contradictory claims | **6** (§8) |
| Advisory/non-material items registered (not counted as obligations) | 3 groups (S1 §9 patterns; S2 §12 preference-persistence clause; S2 §14 provider comparisons) |
| Matrix row inventory re-verified at HEAD | §A 88 + §B 42 + §C 12 (+ §D scope ruling + §E 2 debt rows `DISC-01`/`DISC-02` and §F 7 addendum rows `REC12-GAP-01..07`, all REC-12-owned and outside the 88/42/12 count) |

**Verdict of this Stage-A unit (updated by the human-approved gap adjudication, 2026-10-13):** at the original review checkpoint, source→matrix completeness was **high but not proven complete**: 197/206 obligations traced to specific rows, 2 more were closed by standalone ratified supersessions (6 supersession groups verified in total), and **7 material source obligations (GAP-1..7) had no row and no ratified supersession**. With the human-approved adjudication (§6.1) applied, every formerly unmapped obligation now cites an exact matrix §F addendum row: **204 ROW + 2 SUPERSEDED + 0 unmapped = 206**. This closes the **inventory** question only — the seven obligations remain unverified or future-out-of-scope per their approved dispositions, and no functional/implementation completeness is claimed. The two stale rationales diagnosed in §8 (`UX-015`, `QA-002`) were replaced verbatim in the matrix by this unit while preserving each row's verdict, blocker flag, owner and matrix ID; the remaining stale claims (`UX-013`/`H-37`, `H-01`, `H-03`, `D-016`) stay verification-pending per §8. Stage A still does **not** prove the application complete; functional verification — including the seven §6.1 obligations — belongs to REC-12 and the later authorized layers of #92, under the standing Cora + human checkpoint.

---

## 10. Human-observed missing functionality

**RESERVED / not yet provided.**

The owner's discoveries from trying the live application are first-class input to the later verification layers of #92. The frozen audits do not exhaust current product expectations; this section is intentionally left empty rather than pretending the documentary sources are exhaustive. *(To be populated by the human owner before/alongside Stage B.)*

---

## 11. Decisions needed from human + Cora to proceed

1. **Adjudicate GAP-1..GAP-7** (§6): **DECIDED — human-approved 2026-10-13 (§6.1)**: each obligation is now carried by an exact matrix §F addendum row `REC12-GAP-01..07` with owner REC-12; none silently superseded; original GAP provenance preserved in §6.
2. **Matrix refresh decision** for the 6 stale/contradictory claims (§8): **PARTIALLY DECIDED — human-approved 2026-10-13**: `UX-015` and `QA-002` rationales were replaced verbatim in the matrix by this unit using the exact approved texts, preserving each row's verdict, blocker flag, owner and matrix ID. `UX-013`/`H-37`, `H-01` and `H-03` remain verification-pending (§8 items 1–3); `D-016` remains stale with owner #93/DOC-001 and no `CURRENT_DECISIONS` change.
3. **Confirm whether PERF-05 (benchmark) and the P1Q-05 CodeQL / Dependabot-Renovate / coverage sub-items are recovery-material** or accepted post-recovery debt (GAP-1, GAP-3), and where the structured export-age-generalization clause (GAP-6) and the recovery opt-in/expiry/clear constraint (GAP-7) are authoritatively carried: **DECIDED — human-approved 2026-10-13**: carried as matrix §F addendum rows `REC12-GAP-01`, `REC12-GAP-03`, `REC12-GAP-06` and `REC12-GAP-07` with owners and dispositions per §6.1; none is verified and none is silently dropped.
4. **Confirm the A11Y-05 product decision** (GAP-4): **DECIDED — human-approved 2026-10-13**: non-color entity-type identification is **binding**, carried by matrix §F addendum row `REC12-GAP-04`; owner REC-12 rendered witness (375/1280, ideally color-independent meaning); a failed witness triggers a separate bounded accessible-product repair — never supersession or dilution.
5. **Confirm the process for `Human-observed missing functionality`** (§10): owner commitment to provide live-app observations before Stage B/C closeout. *(STILL OPEN — §10 remains RESERVED for human input; lack of human notes is not a reason to defer documented source gaps, and human observations are not assumed absent.)*
6. **Confirm Stage-A exit**: with gaps adjudicated, authorize the later #92 layers (88+42 row re-verification, composed E2E, visual/governance closeout) under their own C-087 reviews; a Stage-A pass never substitutes for them. *(Authorization of the later #92 layers remains with the standing Cora + human checkpoint — it is **not** granted by this documentary adjudication.)*

---

## 12. Writer-phase closing evidence (recorded)

- `git diff --check`: clean (no whitespace/conflict-marker errors). Result recorded in the unit report.
- Changed-path check vs launch HEAD `0eb840c`: exactly one path — `docs/evidence/issue92-source-completeness/README.md` (this file). No other modification, addition or deletion.
- Self-verification pass: every enumerated obligation in §2–§5 carries exactly one disposition (`ROW` / `SUPERSEDED` / `GAP` / `UNVERIFIED`); counts in §9 reconcile with the per-section tables; every matrix reference cites an exact §A/§B/§C ID verified to exist in the matrix at blob `42482d50…`; every source claim cites a section/line locator; no positive claim is invented beyond the probes recorded in §4 and §12 evidence notes (deterministic greps: MailerLite `index.html:97`; `processor.js:89`; `review-ui.js:156`; `batch-review-legacy.html:458-460`; `column-analyzer.js:39`; `file-processor.js:34,36,71-94,172`; `file-reader.js:58`; `longitudinal-validator.js`; `batch-exporter.js` ZIP/CSV/PDF lines; `input.html:102-138` + "Pegar"; `review.html:154,303,1246-1263`; `pdf-report.js:25,102`; zero `dangerouslySetInnerHTML`/`innerHTML` in `app-v4/src/`; `.github/workflows/codeql.yml` + `.github/dependabot.yml` present; no coverage config found).
- No unit/E2E/build runs; no runtime claims made.
- **Gap-adjudication unit (2026-10-13, on base `e4b06d5`):** human-approved dispositions applied. Changed paths vs base: exactly two — this file and `docs/audits/2026-10-recovery-traceability-matrix.md` (§F addendum `REC12-GAP-01..07` plus the two verbatim `UX-015`/`QA-002` rationale replacements). Historical arithmetic preserved: original checkpoint **197 ROW + 2 SUPERSEDED + 7 GAP = 206** → after adjudication **204 ROW + 2 SUPERSEDED + 0 unmapped = 206**. No launch HEAD restated as a new run; §A/§B/§C re-verified 88/42/12; no broad suites; no runtime claims.
- **Correction review (fresh finding-scoped corrector, attempt #1, 2026-10-13):** closed F1..F6 on candidate `d9ea493` — F1: S1-2-02 evidence restated as documentary (`H-39` register claim, unverified here); F2: §3 heading corrected to 54; F3: SS-5 downgraded out of the verified-supersession register (no human-ratified `.doc` decision found in `CURRENT_DECISIONS.md` / reconciliation final); supersession groups 7→6; F4: P1-17 split into S1-P1-17 (ROW, `STRUCT-006`) and S1-P1-17b (GAP-6, export-age generalization); S1 97→98, total 205→206; F5: GAP-3 extended to enumerate the CodeQL, Dependabot/Renovate and coverage sub-items; F6: S2-12-RECOVERY corrected from `ROW` (decision-only citation) to GAP-7. Updated counts: ROW 197, GAP 7, standalone SUPERSEDED 2, supersession groups 6, UNVERIFIED 0 — 197+2+7+0 = 206. All newly cited IDs (`STRUCT-005`, `STRUCT-006`, `CODE-001`, `CODE-002`, `PDR-05`, `BATCH-002`, `FILE-001`, `H-08`, `D-013`, `D-019`, `D-020`, `D-021`) re-verified to exist in the matrix/decisions at this HEAD.
