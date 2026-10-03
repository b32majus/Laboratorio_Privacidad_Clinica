# Coding standards — Laboratorio de Privacidad Clínica

Status: **CURRENT — C-084 repository engineering standards**

These are stable repository guardrails, not a second implementation/review workflow. Matt skills own their methodology when invoked. Machine-decidable rules belong in tests, linters, schemas, validators and CI rather than duplicated prose.

## 1. Small coherent changes

Implement the smallest coherent change that satisfies accepted authority. Do not mix unrelated refactors, renames, dependency upgrades or cleanup into a bounded ticket. Record unrelated debt separately.

Prefer explicit local designs over speculative abstractions. Deduplicate when code represents the same durable rule/reason to change, not merely because two snippets look similar.

## 2. Preserve local architecture and vocabulary

Follow `CONTEXT.md`, accepted `docs/shaping/` decisions, cited specs and established module boundaries. Do not introduce a competing source of truth for review state, privacy policy, pseudonym identity, structured classification or deployment configuration.

When a durable contract changes, retire obsolete paths only when a real consumer/back-compat requirement no longer needs them. Temporary compatibility needs an explicit retirement condition.

## 3. Fail closed where correctness requires knowledge

`UNKNOWN` is not `SUCCESS`. Ambiguous structured columns, malformed/oversize input, extraction errors, incomplete mandatory review and invariant violations must remain explicit/actionable failures rather than guessed defaults, silent truncation or best-effort success.

Canonicalize/validate untrusted input once at a clear boundary. Duplicate headers/identities or ambiguous aliases must fail explicitly rather than selecting the first plausible match.

## 4. Privacy and data boundaries

Clinical content stays browser-local. No production PHI/PII logging, analytics, third-party runtime resources, remote fonts/images, sensitive URLs or remote processing without accepted product authority.

Safe Output and Confidential Audit remain technically separate. Review/export output derives from canonical domain state, never reconstructed from rendered HTML/DOM state.

Preserve enough diagnostic/provenance information to explain failures without exposing sensitive content.

## 5. Meaningful deterministic verification

Tests/oracles must be capable of disagreeing with the implementation. Avoid tautological snapshots or checks that merely mirror code.

For material privacy, parser, state, trust-boundary, migration or checker work, include negative/adversarial evidence proportional to the risk. New/materially changed checkers over privacy/security/parsing/state require a known-good case and a representative planted violation; validate generated/built runtime artifacts when the invariant ships there.

For stateful/temporal/repeated behavior, test plausible stale-state, ordering, repeated-operation or cross-document/context failures when material.

Use the existing repo gates instead of restating them: `npm test`, V4 typecheck/lint/format/build, Playwright, privacy-eval, storage/external/vendor/PDF/positioning/header/release-QA checks and their self-tests as applicable.

## 6. Dependencies and untrusted document stacks

Dependencies must justify runtime/maintenance/security cost. For PDF/DOCX/XLSX/ZIP/parser/rendering changes, record effective version/provenance and relevant reachable security implications. Distinguish vulnerable package presence from reachable application path/exploitability.

Do not remove defense-in-depth guards merely because an upstream version changed without evidence that the accepted threat boundary still holds.

## 7. Configuration and reproducibility

Behavior-affecting configuration must be versioned, inspectable and reproducible. Project routing lives in `opencode.json` + `.opencode/agents/`; secrets/provider credentials stay outside Git.

Run Atenea C-084 through native OpenCode V2. The ordinary path is the visible TUI started with `opencode .` from the existing Herdr project/worktree pane. `--pure` and V1 `permission`/`bash`/`task` configuration are historical. Required config/provider/model mismatches fail visibly; do not silently fall back to another execution mode or model.

## 8. Frontend quality

Accessibility is correctness: semantic/native controls, keyboard operation, visible focus, meaningful labels, readable errors/statuses, no color-only essential state and responsive layouts.

Keep user-facing privacy language factual. Do not introduce anonymity, GDPR/LOPDGDD compliance, certification, k-anonymity, differential-privacy or safety-score claims unless the corresponding mechanism/evidence is accepted.

## 9. Performance requires evidence

Do not add caches, queues, workers, indexes or architectural complexity without a real requirement/measurement. Preserve existing benchmark/oracle evidence when changing engine hot paths or Worker boundaries.

## 10. Publication artifacts

Immediately before publication, enumerate changed files and run the validators that actually parse/execute those artifact types. Source/test PASS is not a substitute for workflow/deployment/config validation.

No review, model or skill grants push/merge/deploy authority. Final publication and merge remain explicit human/repository decisions.