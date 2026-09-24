# Laboratorio de Privacidad Clínica — Quality Execution Protocol v1

Status: **CURRENT**  
Adopted: 2026-09-24

## 1. Purpose and ownership

This protocol turns the field lessons from PR #35 into repository-owned execution quality rules.

It complements, and does not replace:
- GitHub Work Orders as executable scope authority;
- accepted V4 specs and `docs/shaping/CURRENT_DECISIONS.md` as product/architecture authority;
- Atenea current `docs/START_HERE.md`, `AGENTS.md` and `CODING_STANDARDS.md` as global execution/engineering policy;
- native Gentle as ODD/decomposition/verification/RDD/review authority;
- deterministic tests/checkers/CI as evidence;
- Promotion Review / independent Cora audit as optional read-only promotion-boundary evidence;
- the human as final publication/merge authority.

Do not copy Atenea routing/version tables into this repo. Consume the current qualified runtime/profile at execution preflight.

## 2. Executable authority must be falsifiable

For material behavior, privacy, state, parser, dependency, security or CI work, resolve the applicable chain before implementation:

```text
accepted requirement
→ invariant
→ concrete negative/adversarial example
→ independent deterministic oracle
→ evidence that the oracle can fail
```

The method used to author the ticket is optional. The quality of the executable contract is not.

## 3. Work Order readiness additions

Before executing a material Work Order, ensure the ticket/spec combination makes the following explicit when applicable.

### 3.1 Invariants
State what must remain true, including preserved legacy semantics, memory-only handling, fail-closed behavior and authority boundaries.

### 3.2 Adversarial examples
Use concrete fixtures/call shapes capable of falsifying the intended behavior. “Handle edge cases” is not an oracle.

### 3.3 Integration seams and deferred behavior
Name the existing contracts the work crosses and the behavior deliberately left to later tickets. A worker must not silently implement later roadmap scope to make the current ticket convenient.

### 3.4 Active-surface inventory
For copy, privacy, security and policy checks, enumerate the active surfaces the claim applies to. Passing an arbitrary subset is not repository-wide evidence.

### 3.5 Oracle self-test
A new or materially changed checker/scanner/gate over privacy, security, parsing, state or another trust boundary must include:
- at least one known-good case;
- at least one representative planted violation that must fail;
- built-artifact verification when the invariant concerns shipped/generated runtime behavior.

### 3.6 Exceptional branches must execute in tests
If implementation documents explicit exceptional branches such as malformed input, no-end-tag, EOF, retry, partial failure, unknown state or fallback, representative branches must be exercised by deterministic tests when mechanically testable.

Documentation claiming an error path exists is not evidence that the path works.

### 3.7 Untrusted-input dependency disposition
Work touching PDF/DOCX/XLSX/ZIP/parser/rendering dependencies must identify effective version/provenance and relevant security advisories. Distinguish:
- vulnerable dependency present;
- application path reachable;
- exploitability demonstrated.

When an upgrade is intentionally deferred, preserve a bounded mitigation and regression guard where possible.

### 3.8 Debt closure
List debt IDs expected to close, partially resolve or remain deliberately open. On completion, reconcile `docs/DEBT_REGISTER.md`; preserve historical evidence rather than deleting it.

## 4. Work-unit composition

Follow current Atenea `WORK_UNIT_COMPOSITION_POLICY_V1` rather than inventing project-local line-count review logic.

### 4.1 Composition forecast is a pre-writer gate

For every substantial Work Order, perform a composition forecast **before the first writer edits code**. The forecast is not a second design phase and does not change product scope. It answers one delivery question: can the accepted capability be implemented as one honest reviewable unit, or must it be delivered as a short chain of semantic work units?

Forecast from the actual expected surfaces, for example:
- new domain/contracts;
- parser/extractor logic and fixtures;
- UI integration;
- security/CI guards;
- dependency/provenance/debt disposition;
- deterministic tests required by acceptance.

A Work Order may remain capability-sized in GitHub. Do **not** fragment the issue tracker merely to reduce review size. Instead, record the intended internal work-unit chain when current Atenea policy predicts material over-budget risk.

Each planned unit must:
- represent coherent behavior or a coherent protection/compatibility seam;
- carry the tests/oracle that prove that behavior;
- be independently verifiable and reviewable;
- preserve the accepted Work Order semantics when composed with later units.

Do not split mechanically by file count or line count, and do not separate implementation from its tests merely to fit a budget. Conversely, do not allow a clearly oversized candidate to form and only then discover composition at `review.start`.

If one honest pre-writer composition pass still leaves an indivisible unit beyond current Atenea policy, STOP before implementing that unit and obtain the required size-exception/human decision.

### 4.2 Native ownership remains intact

Native Gentle still owns ODD/decomposition details, `review_due`, reviewers and review transitions. The project-level forecast constrains delivery shape before writing; it does not prescribe workers or recreate a scheduler/reviewer.

## 5. Per-work-unit execution

For each coherent substantial unit:

```text
read current authority
→ implement only authorized behavior + its oracle
→ deterministic verification
→ coherent commit
→ native Gentle ASSESS / provider transition
→ APPROVED + acknowledge/burn when review is due
```

Per-work-unit review does not prove cross-ticket integration.

Do not manufacture a whole-branch Gentle candidate merely to “review the train”.

## 6. Train Integration Closeout

After the final authorized Work Order and before publication, run deterministic closeout over the composed exact HEAD.

For a material multi-ticket train, closeout includes as applicable:
- full repository test chain and clean build;
- typecheck/lint/format gates;
- privacy/domain regression suites;
- cross-ticket scenarios traversing seams created by different Work Orders;
- planted negative/self-tests for new or changed trust-boundary oracles;
- source + built-artifact checks where relevant;
- dependency/provenance/security disposition for touched untrusted-input stacks;
- debt-register reconciliation;
- clean tracked tree after generation/build;
- exact base SHA, HEAD SHA and ordered commit inventory.

If closeout finds a defect, create the smallest coherent correction unit, verify/commit it, follow native Gentle review for that exact delta, and rerun affected closeout gates.

## 7. Micro-correction discipline

When a defect has an exact reproduction and a narrow cause, keep the corrective contract narrow.

Do not use a microfix as permission to:
- re-audit unrelated neighboring code;
- remediate informational debt not required by the defect;
- refactor a subsystem that can be repaired locally;
- broaden dependency or formatting scope.

A tiny defect should normally produce a tiny candidate. Native Gentle still owns its risk/review decision.

## 8. Publication and promotion

After clean local closeout:

```text
normal non-force push when explicitly authorized
→ canonical PR
→ repository CI + platform security/static analysis
→ independent Promotion Review / Cora audit when material risk warrants it
→ corrections as new reviewed units
→ exact-head revalidation
→ explicit human merge
```

Do not equate an aggregate workflow `SUCCESS` with zero security findings. Before promotion reconcile current platform findings/annotations/threads (for example CodeQL) and require no unresolved current blocker.

Any HEAD mutation invalidates a promotion audit bound to the previous HEAD.

## 9. PR #35 field lessons

PR #35 demonstrated that a persistent Pi session with native session-level review consent can execute multiple bounded Work Orders successfully, while composed-state defects can still survive per-unit review.

Preventive lessons:

| Failure class observed | Durable prevention |
|---|---|
| cross-document alias drift | multi-document adversarial fixtures + serialized-context round-trip |
| no-network checker false green | planted fetch/XHR/WebSocket/resource cases + built-artifact scan |
| HTML filtering edge cases | parser/lexer boundary tests, not regex optimism |
| documented EOF branch crashed | execute representative exceptional branches in self-tests |
| active copy surface omitted | explicit active-surface inventory |
| vendor version recorded unknown | exact provenance when lockfile/byte identity can prove it |
| vulnerable PDF parser default | advisory review + deterministic mitigation guard |
| workflow green while CodeQL thread remained | reconcile current platform findings, not only aggregate status |

These findings are not evidence of a `native-balanced` routing defect. Correct contract/oracle/composition failures first; investigate routing only from role/model-specific runtime evidence.

## 10. T06 field lesson — composition must be forecast before writing

On 2026-09-24, T06 #10 was implemented and deterministically green, but the first native review attempt failed in preflight with typed `lens_context_budget_exceeded` before any review lineage/authority was created.

The complete T06 work had three commits, but the first implementation commit alone contained approximately 1,566 textual changed lines across 22 files. It combined source contracts, TXT/DOCX/PDF extraction, PDF scan/no-text handling, Job/UI integration, fixtures/loaders/typings and their tests. The later protection/dependency commits were independently reviewable; the first unit was not.

Durable conclusion:

```text
capability-sized Work Order
→ pre-writer composition forecast
→ semantic reviewable work units
→ implementation / verify / commit / native review
```

Do not infer that every large Work Order must become multiple GitHub issues. The failure was delivery composition, not necessarily product-ticket scope. Future substantial tickets must not rely on post-hoc recovery to discover this boundary.

## 11. Non-goals

This protocol does not:
- create an Atenea-owned or project-owned reviewer controller;
- require another LLM review after every ticket;
- prescribe reviewer models;
- replace native Gentle RDD;
- make the whole feature branch a default Gentle candidate;
- authorize unrelated cleanup or opportunistic upgrades;
- remove the human publication/merge boundary.
