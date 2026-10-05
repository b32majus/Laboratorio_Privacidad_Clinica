# REC-05 — SINGLE-OUTPUT-PARITY-01 — executed post-PDR standard/complex handoff

Status: **EXECUTION COMPLETE — HISTORICAL HANDOFF; Cora integrated audit GO; publication PR #76**
Date: 2026-10-05
Recovery Work Order: **REC-05 — SINGLE-OUTPUT-PARITY-01**
Human-product shape: **Single Result + output parity**
Cost policy: **standard**
Risk class: **complex**
Visible primary: **`atenea-complex`**
Matt entry: **`/implement-spec`**
Publication boundary: **LOCAL_ONLY during Matt execution; human publication authorized post-audit via PR #76**

## 0. Fixed execution identity

- Repository: `b32majus/Laboratorio_Privacidad_Clinica`
- Canonical product base: `3.0-main@3bbbf13f1a187af8087d7911f06d6057b6aa6d93`
- Product-design reconciliation merge: PR `#74`, merge `3bbbf13f1a187af8087d7911f06d6057b6aa6d93`
- Launch-time Atenea authority: `b32majus/Atenea@502f6d4e3e635f6a3ed5b94e8d577f7d653ecc77`
- Post-execution current Atenea authority: `b32majus/Atenea@9c6be73527c1b4ff8a661d29582bb6317b8e45f7` (C-085; harness-only reconciliation, no product-candidate reopen)
- Workspace authority-sync commit: `ed3f062a7be59b3de4266e7bb2e174e352d4e67c`
- Execution branch: `work/rec-05-single-result-output-parity-20261005`
- Execution worktree: `/srv/kairos-lab/qualification/laboratorio-rec05-single-result-output-20261005`
- Fresh shaping decision: `D-024 — REC-05 single Result / output contract`
- Pre-implementation fixed point / canonical review anchor: **resolve the clean HEAD containing this handoff + D-024 after the shaping commit; keep it fixed for the entire Matt lifecycle**.

If canonical base, Atenea authority, cost policy, risk class, branch/worktree or review anchor differ at launch: **HUMAN STOP**.

This is a fresh lineage. The pre-reconciliation REC-05 worktree/branch and its stopped Go launches are historical provenance only. Do not reuse its `6dcb6b5…` anchor, old handoff, old D-023 identifier or session lineage.

The run uses project/default `cost_policy: standard`. Do not switch to Go/Free because of quota or convenience. Because prior visible attempts accidentally entered `atenea-go`, the human must start a **fresh OpenCode session** and visibly select **`atenea-complex` before the first execution prompt**.

> **Closeout note (2026-10-05):** execution closed at product candidate `6748379ea5e73f9b30cebb5867264e4bb6342971`; correction #1 closed the canonical review findings; correction #2 was not opened. Later C-085 commits are execution-harness only. Cora integrated candidate audit returned **GO** and human publication is authorized through PR #76. Sections below preserve the launch-time contract and preflight as provenance; they are not a new launch instruction.

## 1. Authority to read — in order

Project authority:

1. `AGENTS.md`
2. `docs/START_HERE.md`
3. `docs/HUMAN_PRODUCT_DESIGN_AUTHORITY_V1.md`
4. this handoff in full
5. `docs/RECOVERY_MASTER_PLAN_2026-10.md` — REC-05 plus REC-07 dependency/order only
6. `docs/audits/2026-10-recovery-traceability-matrix.md` — `UX-006`, `H-11`, `H-12`, `H-13`, `H-42`, `PDR-06`, `PDR-08…PDR-12`
7. `docs/audits/2026-10-product-design-reconciliation-final.md`
8. `docs/shaping/CURRENT_DECISIONS.md` — D-004, D-005, D-006, D-007, D-009, D-013, D-018, D-023 and **D-024**
9. `docs/ATTENDED_PRODUCT_SHAPING_GUARDRAILS_V1.md`
10. `docs/PRODUCT_FIDELITY_GATES_V1.md`
11. relevant `docs/specs/SPEC_V4_APP_AND_REVIEW.md` output/readiness contracts **only where not superseded for presentation by D-023/D-024/HPD V1**
12. current code/tests named below.

Current Atenea authority at the pinned SHA additionally governs execution, especially:

- `docs/START_HERE.md`
- `docs/HUMAN_PRODUCT_DESIGN_AUTHORITY_V1.md`
- `docs/ATENEA_EXECUTION_ROUTING_V0.md`
- upstream Matt lifecycle and current project-local `.opencode/agents/*` bindings.

Historical v3/jsPDF output and the old REC-05 handoff are evidence/provenance only. They do not restore unsafe report semantics or the old visible five-step product topology.

## 2. Gate 0 — complete owned obligation set

REC-05 owns the following current obligations. None may fall out during decomposition:

| Obligation | REC-05 responsibility |
| --- | --- |
| `H-11` | restore Copy from canonical reviewed Safe text |
| `H-12` | restore a Safe generated PDF without legacy mappings/original audit content |
| `H-13` | preserve/improve existing Safe TXT |
| `H-42` | close the **single text/document slice** of deliberate Confidential download; global H-42 remains blocked by REC-07 batch |
| `UX-006` | preserve authoritative fail-closed readiness before any prepared/shareable action |
| `PDR-06` | establish the single-item human `Result`: readiness + remaining attention + contextual next action; Gate remains authority underneath |
| `PDR-08` | all newly touched user-facing REC-05 copy is Spanish professional language |
| `PDR-09` | task hierarchy is deliberate; prepared Result outranks evidence/help/chrome; Confidential is visibly secondary/sensitive |
| `PDR-10` | rendered evidence uses realistic synthetic/no-PHI content capable of exposing layout/action-hierarchy failure |
| `PDR-11` | copy/generation/download actions have perceptible pending/success/failure and correction/return path |
| `PDR-12` | prepared/shareable and Confidential outputs are unmistakably asymmetric |

Applicable project HPD gates: `G-HP1`, `G-HP3`, `G-HP4`, `G-HP5`, `G-HP6`, `G-HP7`, `G-HP8`, `G-HP9`, `G-HP10`. `G-HP2` applies if the implementation changes the ordinary text/document transition around Gate/Result; a new no-op destination is forbidden.

If implementation discovers an accepted requirement with no owner, contradictory owner, unmet prerequisite or presentation conflict not resolved by D-023/D-024: **HUMAN STOP**.

## 3. Interaction hypothesis — already shaped, do not redesign autonomously

### Human task

A healthcare professional has already provided and reviewed clinical information. They need to know whether the prepared result is usable and then take the useful output action without learning the internal privacy pipeline.

### Default text journey

`finish required review → Result shows readiness → Copy prepared result`.

When ready, Copy may be the primary action. TXT/DOCX/PDF are secondary formats; they remain discoverable but must not appear as four/five equal-weight primary choices.

### Default single-document journey

`finish required review → Result shows readiness → use one primary prepared-document download`.

A document-download action is primary. DOCX/PDF/TXT alternatives remain discoverable. Exact DOCX-vs-PDF visual ordering is an implementation-level presentation choice already left open by accepted authority; it may not create an equal-weight action wall or claim source-layout preservation.

### Blocked / needs-attention journey

Result states factually what remains and provides the useful path back to unresolved Review. Prepared/shareable actions remain unavailable. The person must not need the term `Privacy Gate` to understand why.

### Confidential journey

Confidential Audit is a separate sensitive action/zone, never another equivalent output format. First action warns and downloads nothing; explicit confirmation is required.

### Friction budget

From the last required review decision to the ordinary prepared action: at most one necessary context transition + the output action itself, absent a factual warning/representation failure. No policy re-selection, Job-kind decision, policy-document reading or ceremonial no-op screen.

### Simultaneous information at Result

The ordinary Result view must make the following understandable together:

- readiness (`ready` / `needs attention` / `blocked` in human Spanish);
- factual warning(s), including intentionally kept original when relevant;
- the primary prepared action appropriate to material;
- secondary Safe formats without equal visual weight;
- the fact that Confidential Audit is separate/sensitive;
- a return/correction path.

Do not expose ReviewSession, serializer, source-offset, internal gate or Class→Action vocabulary.

### Completion / failure feedback

Copy success/failure and async generation/download pending/failure must be perceptible. A stale/current-authority refusal is a visible non-PHI failure, never false success.

## 4. Technical contract — D-024 is binding

Implement D-024 exactly. Core points repeated here only for execution clarity:

### 4.1 One canonical Safe payload

For current `pasted-text` and single `document` Jobs only, derive `safeText = getFinalText(review)` only when current Job ↔ review correspondence is valid, `job.outputs.safeOutputReady === true`, `canFinalize(review) === true`, and finalization succeeds.

Representations:

- Clipboard = exact `safeText`.
- Safe TXT = UTF-8 exact `safeText`.
- Safe DOCX = generated OOXML text representation from `safeText` only.
- Safe PDF = generated paginated text representation from `safeText` only.

No output reruns transformations. No Safe representation adds Confidential mapping, reviewer notes, audit metadata or source originals beyond an original deliberately present in canonical `safeText`.

### 4.2 Clipboard + TXT

- Copy uses platform Clipboard API; rejected/unavailable clipboard is visible failure; no hidden textarea/`execCommand` fallback.
- TXT filename: `texto-preparado.txt`.
- UTF-8 decode emitted bytes === canonical Safe string; no required BOM; no audit header/footer.

### 4.3 DOCX

- filename `texto-preparado.docx`;
- use existing direct `jszip`; no new DOCX library;
- minimum valid local OOXML package;
- preserve Unicode/XML escaping/logical line semantics under documented round-trip normalization;
- no source styles/layout/images/tables/filename/mapping/notes claim;
- governed `mammoth.extractRawText()` semantic read-back;
- async current-authority revalidation immediately before download.

### 4.4 PDF

Add exact direct dependency:

```text
pdf-lib@1.17.1
```

- filename `texto-preparado.pdf`;
- do not reactivate `lib/jspdf.umd.min.js`;
- body authority is `safeText` only;
- reflow/pagination allowed; no source-layout redaction claim;
- unsupported standard-font/encoder character => visible deterministic PDF-only failure + zero PDF download; no replacement/drop/mojibake;
- long content paginates without truncation;
- `npm audit --omit=dev` must remain free of unresolved introduced production vulnerabilities.

### 4.5 Confidential TXT confirmation

- filename `auditoria-confidencial.txt`;
- keep existing canonical Confidential payload/readiness policy;
- first action reveals Spanish identifiable/reversible-data warning and downloads zero;
- Confirm exactly one; Cancel zero;
- pending confirmation resets after confirm/cancel and cannot cross Job, review mutation or newly unavailable audit state;
- Confirm revalidates current Job + review/audit authority immediately before download;
- no Confidential DOCX/PDF in REC-05.

### 4.6 Async current-authority safeguard

For DOCX/PDF capture requested Job id + ReviewSession identity + canonical safeText. After the last awaited load/generation step and immediately before bytes/download, revalidate Job identity, review identity/current Safe text, readiness and finalizability. Any stale mismatch => zero download / zero false success.

## 5. Human-product boundaries / concept delta

**User-facing concept delta:** no new domain/product concept. `Result` is already accepted authority from D-023/HPD V1/PDR-06.

Authorized visible delta:

- text/document ending becomes a human Result rather than a serializer/Gate explanation;
- Copy/DOCX/PDF capabilities return;
- Confidential download gains deliberate confirmation;
- touched output copy is Spanish;
- hierarchy distinguishes primary prepared action, secondary formats and Confidential zone.

Not authorized:

- new app, route, mode, policy, privacy class, review state or output semantics;
- full global shell/stepper redesign (REC-09);
- source-layout PDF redaction / source DOCX reconstruction;
- arbitrary output dashboard/metrics;
- equal-weight Copy/TXT/DOCX/PDF/Confidential button wall;
- detached prototype train. The real application + synthetic fixtures is the rendered witness.

If Matt/spec pressure would require a material interaction change outside the hypothesis above, return to Cora + human rather than redesigning autonomously.

## 6. Work Units — sequential A → B → C → D

These units converge on one Result/Export authority and must not race on shared state/components.

### WU-A — Safe representation primitives

Implement/test pure or tightly bounded representation helpers:

- exact UTF-8 TXT helper only if useful;
- DOCX builder using existing JSZip;
- exact `pdf-lib@1.17.1` + Safe PDF builder;
- explicit representation refusal rather than lossy fallback.

Red→green/adversarial witnesses:

- TXT decode === Safe string;
- DOCX accents/`ñ`, XML metacharacters, blank lines, supported non-Latin Unicode and line semantics round-trip;
- PDF Spanish representable text reads back without corruption;
- planted unsupported PDF character (e.g. `α`) refuses and yields no artifact;
- long PDF spans pages and is not truncated;
- builders cannot acquire planted Confidential-only mapping/note tokens from any source other than the Safe string they receive.

### WU-B — Single-item Result + Safe actions + stale guards

Wire pasted-text and single-document Result behavior and Safe actions:

- state = ready / needs attention / blocked from existing authority;
- appropriate primary action hierarchy by material;
- Copy/TXT/DOCX/PDF from one canonical Safe payload;
- visible non-PHI action feedback/errors;
- post-await/pre-download current-authority guard;
- return-to-review/correction path;
- Spanish REC-05-owned copy.

Required witnesses:

- pasted text and document both reach understandable Result;
- pending mandatory review blocks prepared/shareable actions;
- no Gate/serializer vocabulary required for ordinary comprehension;
- all four representations derive from the same canonical final text;
- deliberately kept original is represented exactly as ReviewSession says and warning remains factual;
- mutate Job during actual awaited DOCX generation => zero stale download;
- mutate review/readiness during actual awaited PDF generation => zero stale download;
- normal ready Copy/DOCX/PDF actions provide perceptible success/failure;
- rendered Result does not present all formats as equal-weight primaries.

### WU-C — Confidential confirmation + affected-surface parity

- add single-item Confidential TXT second confirmation;
- preserve structured REC-04 output semantics/confirmation/async guards;
- preserve batch as having no fabricated REC-05 artifact;
- trace any changed shared Result/Export helper to all materially supported consumers.

Witnesses:

- first Confidential action = zero download; Confirm = exactly one; Cancel = zero;
- confirmation invalidates on Job/review/readiness change;
- planted mapping/reviewer-note/original Confidential tokens are absent from every Safe representation;
- structured Safe CSV/XLSX and Confidential TXT/XLSX remain behaviorally green;
- valid batch journey gains no single-item output surface.

### WU-D — Composed human task + recovery evidence

Using synthetic/no-PHI fixtures, walk real rendered journeys for:

1. pasted text with multiple detections through review → ready Result → Copy plus one secondary format;
2. supported single document through review → ready Result → primary document download;
3. needs-attention Result → return to pending review;
4. deliberately kept original → factual warning remains at Result;
5. Confidential Audit deliberate confirmation;
6. long/realistic text density and one output failure/refusal path.

Record action/context-transition counts for the ordinary paths and show they meet §3 friction envelope.

Update only REC-05-owned matrix/master evidence as **LOCAL CANDIDATE**, never canonical/completed. `H-42` remains globally blocking until REC-07 closes batch Confidential output.

## 7. Shared-seam / affected-surface accounting

| Surface | Expected disposition |
| --- | --- |
| pasted-text Result/output | **CHANGE** |
| single-document Result/output | **CHANGE** |
| current Gate/readiness authority | **NO SEMANTIC CHANGE**; may be composed/translated into Result |
| ReviewSession / `getFinalText` | **NO SEMANTIC CHANGE** |
| structured REC-03/04 | **NO SEMANTIC CHANGE**; mandatory parity evidence if shared Result/Export code is touched |
| document batch | **NO REC-05 OUTPUT**; prove no indirect exposure |
| privacy engine/policy/ProcessingContext | **NO CHANGE** |
| Input / global IA / Structured configure | **NO CHANGE** |

Likely implementation surfaces include `app-v4/src/export/ExportStep.tsx`, current Gate/Result composition, focused output builders and tests. Source tracing wins over this guess. A materially affected supported consumer outside the table/envelope => HUMAN STOP.

## 8. Representation-narrowing checks

New outputs are translations of accepted canonical text semantics. They may not silently collapse distinctions required by D-024:

- TXT: UTF-8 code points/line content;
- DOCX: accepted Unicode + logical line semantics under declared normalization;
- PDF: representable characters/order/full content; unrepresentable input refuses rather than narrows;
- Result state: ready / needs attention / blocked stay distinguishable;
- prepared vs Confidential remain distinguishable;
- current vs stale async authority remains distinguishable.

Any new control that collapses a currently accepted state/value distinction is HUMAN STOP unless D-024 explicitly authorizes it.

## 9. Deterministic evidence floor

Final candidate must run at least:

```bash
npm audit --omit=dev
npm run check:privacy-eval:v4
npm run typecheck:v4
npm run lint:v4
npm run format:check:v4
npm run build:v4
npm test
npx playwright test e2e/review-export.spec.ts e2e/structured*.spec.ts e2e/policy-guidance.spec.ts
git diff --check
```

Also run focused Vitest over:

- Safe output / DOCX / PDF builders;
- Result/ExportStep text/document + structured sibling behavior;
- Privacy Gate keep-original warning/readiness;
- any changed shared helper.

Claims must be calibrated to actual adversarial evidence. Minimum planted cases:

1. upstream Confidential mapping/reviewer-note/original token actually exists and is absent from every Safe destination;
2. supported vs unsupported PDF-character frontier;
3. real awaited stale-state mutation for DOCX and PDF;
4. before/confirm/cancel/authority-change Confidential boundary;
5. valid structured sibling + valid batch sibling through any changed shared seam;
6. long synthetic clinical text/realistic detection volume for rendered Result/composed journey.

Use synthetic/no-PHI fixtures only.

### Pre-implementation dependency-audit baseline

At the clean prepared preflight on 2026-10-05, before REC-05 adds `pdf-lib`, `npm audit --omit=dev` reports **12 pre-existing production findings (1 low, 10 high, 1 critical)** from the canonical dependency graph. The REC-05 preparation commits do not change `package.json` or `package-lock.json`; this is baseline debt, not a REC-05 regression.

REC-05 must **not** run `npm audit fix`, upgrade unrelated dependencies or broaden scope to repair this baseline. After the authorized `pdf-lib@1.17.1` change, compare the production audit against this baseline and prove that REC-05 introduced **no new unresolved production vulnerability**. Any new/material finding attributable to the authorized dependency delta is HUMAN STOP. Report the inherited baseline factually rather than claiming the global production audit is green.

## 10. Exact launch lifecycle — C-084 at launch; C-085 reconciled after execution

Route: **standard + complex**.

- coordinator: `atenea-complex` → MiMo 2.6 Flash;
- explorer if needed: `atenea-explorer` → Qwen 3.8 Flash;
- implementer: `atenea-implementer-complex` → DeepSeek V4 Flash;
- merger only if genuinely required: `atenea-merger` → MiMo 2.6 Flash;
- Standards review: `atenea-review-standards` → GPT-6 Luna high;
- Spec review: `atenea-review-spec-complex` → GPT-6.1 Sol high;
- correction: fresh `atenea-corrector-complex` → GLM 5.3 Flash high;
- integrated candidate audit: Cora because this is material privacy/output + human-product composition work.

Coordinator is orchestration-only for tracked repository mutation. Implementation workers own implementation/TDD and fixed candidate commits only. After integrated candidate is fixed, coordinator runs exactly one canonical Standards + complex Spec review anchored to the §0 fixed point. Review start closes the originating implementer write phase. Findings go only to fresh corrector sessions. Maximum two attempts over the same authorized finding envelope; new material issue/scope expansion/persistent blocker after #2 => HUMAN STOP.

No silent model/provider fallback. Do not switch cost policy or primary profile mid-run.

## 11. Publication boundary

LOCAL_ONLY throughout Matt execution:

- no push;
- no PR;
- no merge;
- no deploy;
- no issue/settings mutation;
- no force-push/history rewrite.

A clean canonical review does not authorize publication. Return to Cora for integrated candidate audit. Human retains publication/merge authority.

## 12. Launch preflight / READY_TO_LAUNCH gate

Before human launch, Cora must verify and record:

- clean worktree and exact branch;
- canonical base is ancestor and still `origin/3.0-main@3bbbf13…` unless deliberately reconciled;
- Atenea local == origin/main == `502f6d4…`;
- workspace role bindings match pinned Atenea;
- `AGENTS.md` / shaping / product-fidelity guardrails include current human-product, representation-narrowing, affected-surface and adversarial-witness authority;
- project Gate 0 maps every REC-05 obligation in §2;
- D-024 and this handoff are committed;
- bound standard/complex agents/models are visible to OpenCode;
- deterministic pre-implementation baseline is green enough to distinguish new regressions; the known `npm audit --omit=dev` baseline red is recorded above and is judged by dependency delta, not by pretending it is green;
- fixed review anchor is resolved to this clean prepared HEAD.

Any mismatch => HUMAN STOP, do not ask OpenCode to repair launch state.

## 13. Required return contract

Return one factual closeout containing:

1. canonical base, Atenea authority, workspace-sync commit, fixed review anchor, final HEAD, branch/worktree cleanliness;
2. ordered commits + changed-file inventory/stat;
3. WU-A/B/C/D outcomes;
4. Result interaction actually rendered for pasted-text and single-document ordinary/blocked states, including action hierarchy and measured ordinary-path friction;
5. exact canonical Safe-text authority and action/file-name table;
6. TXT UTF-8 equality evidence;
7. DOCX OOXML generation + governed read-back evidence, including Unicode/line-break frontier;
8. PDF dependency/version/audit, representable Spanish read-back, unsupported-character refusal and long-document no-truncation evidence;
9. async stale-state guard evidence for DOCX/PDF;
10. Confidential confirmation + authority-reset evidence;
11. planted Safe-vs-Confidential leak evidence and keep-original behavior;
12. structured sibling parity + batch non-exposure evidence;
13. applicable HPD gate evidence (`G-HP1/3/4/5/6/7/8/9/10`, plus `G-HP2` if triggered) and representation-narrowing/affected-surface/adversarial-witness map;
14. exact deterministic gate results/counts and limits on any universal claim;
15. canonical Standards + complex Spec review verdict/findings;
16. correction attempts, if any, with exact finding envelope and red→green evidence;
17. HUMAN STOP/model/provider/dependency-security incidents, if any;
18. remaining known gaps explicitly outside REC-05, including global H-42 still waiting on REC-07;
19. explicit LOCAL_ONLY / no-publication confirmation.

Cora performs the mandatory integrated candidate audit before any publication recommendation.
