# Laboratorio de Privacidad Clínica — Quality Execution Protocol v1

Status: **CURRENT**  
Adopted: 2026-09-24  
Reconciled with Atenea C-077: 2026-09-28

## 1. Purpose and ownership

This protocol turns field lessons from the V4 trains into repository-owned execution-quality rules.

It complements, and does not replace:

- GitHub Work Orders as executable scope authority;
- accepted V4 specs and `docs/shaping/CURRENT_DECISIONS.md` as product/architecture authority;
- Atenea current `docs/START_HERE.md`, C-077, `AGENTS.md` and `CODING_STANDARDS.md` as global execution/engineering policy;
- native Gentle as candidate review/correction/validation/burn authority;
- deterministic tests/checkers/CI as evidence;
- Promotion Review / independent Cora audit as optional read-only promotion-boundary evidence;
- the human as final publication/merge authority.

Do not copy Atenea routing/version tables into this repo.

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

Before executing a material Work Order, ensure the ticket/spec combination makes applicable invariants, adversarial examples, integration seams, deferred behavior and verification explicit enough that implementation does not need to invent product/privacy meaning.

A new or materially changed checker/scanner/gate over privacy, security, parsing, state or another trust boundary must include both known-good evidence and a representative planted violation that it rejects. Built-artifact checks are required when the invariant concerns shipped/generated behavior.

Representative exceptional branches such as malformed input, EOF, partial failure, unknown state or fallback must execute in deterministic tests when mechanically testable.

Work touching PDF/DOCX/XLSX/ZIP/parser/rendering dependencies must identify effective version/provenance and relevant security disposition. Distinguish vulnerable dependency present, application path reachable and exploitability demonstrated.

Debt IDs expected to close, partially resolve or remain deliberately open must be reconciled in `docs/DEBT_REGISTER.md` without deleting historical evidence.

## 4. Work-unit composition is conditional

Follow current Atenea `WORK_UNIT_COMPOSITION_POLICY_V1`; do not invent project-local numeric review bands.

Composition is **not** a mandatory pre-writer ritual for every substantial Work Order. Activate it when current evidence shows one of the following:

- several independently coherent delivery units are already visible;
- the expected/observed candidate shape is materially likely to exceed reliable native review/context limits;
- prior/current evidence shows the candidate is too coarse to review or recover safely.

When triggered, define the smallest semantic work-unit chain that:

- keeps behavior with the tests/oracle that prove it;
- is independently verifiable/reviewable;
- preserves the accepted Work Order semantics when composed;
- does not split mechanically by file count or line count.

A Work Order may remain capability-sized in GitHub. Do not fragment the issue tracker merely to reduce review size.

If one honest composition pass still leaves an indivisible unit beyond current Atenea policy, STOP before writing that unit and obtain the required exception/human decision.

## 5. Per-ticket / per-work-unit execution

For already-shaped executable authority:

```text
read current repository + Work Order/spec authority
→ plain Pi ticket worker implements only authorized behavior + oracle
→ deterministic verification
→ coherent local candidate commit
→ `gentle-ai review assess --agent codex` from the real candidate boundary
→ exact provider-issued native review continuation when due
→ terminal / durable checkpoint
```

Do not run ODD or `gentle-orchestrator` merely because the ticket is substantial. If product meaning is actually unresolved, STOP and return to shaping/human authority.

Do not manufacture a whole-branch Gentle candidate merely to “review the train”.

Plain Pi is not a Gentle Shell review host; do not manually export `GENTLE_PI_REVIEW_RELAY_CONTRACT`.

## 6. Train integration closeout

After the final authorized Work Order and before publication, run deterministic closeout over the composed exact HEAD.

For a material multi-ticket train, include as applicable:

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

If closeout finds a defect, create the smallest coherent correction unit, verify/commit it, follow native Gentle review for that exact delta when due, and rerun affected closeout gates.

Per-unit review does not prove cross-ticket integration.

## 7. Micro-correction discipline

When a defect has an exact reproduction and narrow cause, keep the corrective contract narrow.

Do not use a microfix as permission to re-audit unrelated neighboring code, remediate informational debt not required by the defect, refactor a subsystem that can be repaired locally, or broaden dependency/formatting scope.

## 8. Publication and promotion

After clean local closeout:

```text
normal non-force push when explicitly authorized
→ canonical PR
→ repository CI + platform security/static analysis
→ independent Promotion Review / Cora audit when material risk warrants it
→ corrections as new bounded reviewed units
→ exact-head revalidation
→ explicit human merge
```

Do not equate an aggregate workflow `SUCCESS` with zero security findings. Reconcile current platform findings/annotations/threads before promotion. Any HEAD mutation invalidates a promotion audit bound to the previous HEAD.

## 9. Durable field lessons

Prior V4 trains established several reusable lessons:

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

T06 additionally proved that a capability-sized Work Order can produce an over-coarse first candidate. The durable lesson is **triggered composition before an obviously coarse unit materializes**, not universal forecasting ceremony.

These findings are not by themselves evidence of a model-routing defect. Correct authority/oracle/composition failures first; investigate routing only from role/runtime-specific evidence.

## 10. Non-goals

This protocol does not:

- create an Atenea-owned or project-owned reviewer controller;
- require another LLM review after every ticket;
- prescribe reviewer models beyond consuming current Atenea review transport;
- replace native Gentle RDD;
- make the whole feature branch a default Gentle candidate;
- authorize unrelated cleanup or opportunistic upgrades;
- remove the human publication/merge boundary.
