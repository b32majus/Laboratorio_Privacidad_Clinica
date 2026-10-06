# Atenea — Repository Policy

Status: **CURRENT AUTHORITY — C-086**

Atenea is a thin upstream-first policy, routing and conformance layer over native OpenCode V2 and adopted upstream engineering skills. It does not duplicate those skills or implement a second execution/review lifecycle.

## 1. Ownership

```text
WHAT / WHY / acceptance / domain authority
→ human + durable repository authority

human product design / interaction authority
→ attended Cora + human, when material

stable engineering quality
→ target repository AGENTS.md + CODING_STANDARDS.md

technical shaping / implementation / code review method
→ adopted Matt Pocock skills when invoked

role → model binding and assurance profile
→ Atenea project-local OpenCode agents + routing policy

machine-decidable facts
→ tests / typecheck / lint / validators / oracles / CI

process persistence / observation
→ Herdr when useful; never correctness authority

publish / merge
→ target repository policy + explicit human authority
```

## 2. Authority precedence

1. accepted current product/domain authority;
2. accepted spec/ticket/work order for the current change;
3. target-repository policy and coding standards;
4. current Atenea execution/routing authority;
5. adopted upstream skill instructions;
6. upstream runtime defaults;
7. historical docs, stale config and remembered session state.

Material conflict between current authorities => STOP and reconcile. Runtime convenience never invents product semantics.

## 3. Read only what the work needs

Normal engineering entry is deliberately small:

1. this file;
2. the accepted issue/spec/ticket or durable execution handoff;
3. `CODING_STANDARDS.md` and only the relevant project/domain authority it references;
4. `docs/ATENEA_EXECUTION_ROUTING_V0.md` when executing through Atenea.

Do not load product-design, shaping, fidelity, qualification or historical documents by ritual. Specialized policies are referenced when their condition is explicitly triggered; they are not default execution payload.

Historical C-077–C-085 and Gentle/Pi/OpenCode V1 runbooks remain provenance unless current authority explicitly cites them.

## 4. Do not duplicate Matt

Matt skills own their methodology. Do not copy their TDD loop, task-graph procedure, code-review rubric or worktree choreography into Atenea policy, project handoffs or child prompts.

Atenea adds stable repository constraints, explicit role/model bindings, deterministic evidence boundaries and human publication control.

Atenea separates **risk class** (`volume|complex`) from **cost policy** (`standard|free_only|go`). Cora may recommend risk class; human/project authority owns cost policy. `free_only` and `go` have no silent provider/model fallback. See the profile documents for their replaceable bindings.

C-086 retains C-085 routing/runtime economics over the C-084 native-V2 lifecycle: OpenCode 2.0.22 known-good runtime, standard Volume writer DeepSeek V4 Flash, standard Complex writer GLM 5.3 Flash high, and the 220k effective writer context guard with automatic compaction around ~198k and ~15k recent verbatim retention. Routing changes only at a clean work-unit boundary.

Do not rewrite shared `~/.config/opencode/opencode.json` as per-ticket/train routing state. Do not add `--pure`: it is a V1 flag and is not part of native OpenCode V2.

## 5. Deterministic-first, phase-scoped evidence

If a material property can be expressed deterministically, prove it mechanically. Do not create an oracle for every edit.

Evidence belongs to the phase that needs it:

```text
writer      → focused TDD + smallest relevant deterministic checks
integration → merge-sensitive / cross-slice checks when justified
review      → inspect candidate + existing evidence; request new proof only for a concrete gap
corrector   → finding-scoped fix + focused regression evidence
publication → changed-artifact / composed-candidate closeout
```

Broad/full suites are integration/publication evidence by default, not a ritual for every writer slice. A ticket/repository may require an earlier broad suite when that is genuinely necessary; otherwise do not repeat it at every phase.

## 6. Cora-shaped execution envelope

OpenCode/Matt execute already-accepted bounded work. Precision is not verbosity: reference durable authority and state only the semantic delta.

A handoff names the outcome, authority refs, in-scope surface, principal invariants, non-goals, evidence needed to close the writer phase, publication boundary and any **explicitly triggered conditional safeguard**. It does not restate `AGENTS.md`, coding standards, Matt methodology or entire product histories.

Material product choices are attended Cora + human work. If execution exposes an unresolved material product/architecture/scope/privacy/data-semantics/acceptance choice, HUMAN STOP rather than infer an answer.

Specialized safeguards remain available but are phase-owned and conditional:

- material human-facing design → `docs/HUMAN_PRODUCT_DESIGN_AUTHORITY_V1.md` upstream of execution;
- expansive shaping → `docs/ATTENDED_PRODUCT_SHAPING_GUARDRAILS_V1.md` upstream;
- product fidelity / representation / shared-seam questions → `docs/PRODUCT_FIDELITY_GATES_V1.md` when explicitly triggered;
- publication closeout → `docs/PREPUBLICATION_ARTIFACT_VALIDATION_V1.md` at the final candidate boundary.

A writer is not a repository-wide auditor. It implements the accepted envelope. If it incidentally discovers a material affected surface or authority conflict outside that envelope, it reports the fact and STOPs; it does not start open-ended sibling tracing or broaden scope.

## 7. Lifecycle ownership and bounded correction

The selected primary coordinator owns `/implement` or `/implement-spec`, one canonical Standards + Spec review, review aggregation and correction dispatch. Implementation workers own implementation/TDD, focused implementation evidence and the candidate commit only. They do not invoke `/implement`, `/implement-spec`, `/code-review`, reviewers or correctors.

When delegating, coordinators reference the durable handoff rather than copying it into a second giant child prompt. Pass only the work identity/fixed point, the handoff pointer, phase boundary and any small delta needed for that child.

Review start closes the originating implementer's write phase. Every review-driven mutation goes through a fresh bound corrector.

Allow at most two fresh finding-scoped correction attempts:

```text
IMPLEMENT
→ REVIEW
→ clean → DONE
→ findings → fresh corrector #1 → focused evidence
    → resolved → DONE
    → same findings remain → fresh corrector #2 → focused evidence
        → resolved → DONE
        → blocker / new material issue → HUMAN STOP
```

Correctors close supplied findings; they do not search for new sibling defects by default. If a review finding explicitly requires an adversarial witness or named conditional safeguard, the corrector supplies only that bounded closure.

## 8. Herdr and operator-controlled launch

Herdr is the already-running persistent operator surface. Do not launch/restart/replace it per ticket/train.

For real work, Cora prepares through `READY_TO_LAUNCH`; the human performs the final visible launch unless that specific launch is explicitly delegated. The preferred first prompt is short:

`Read @docs/handoffs/TRAIN_X.md and execute it under current repository/Atenea authority.`

Do not use `opencode run` as the normal production surface.

## 9. Repository entry, worktrees and publication

Use `docs/REPOSITORY_ENTRY_RECONCILIATION_V1.md` read-only when prior harness/tooling state is ambiguous. Matt owns ephemeral implementer worktrees while its workflow is active; delivery/integration worktrees remain through accepted publication closeout.

Before publication, validate the artifact types that actually changed and the composed candidate as required by `docs/PREPUBLICATION_ARTIFACT_VALIDATION_V1.md`. Review approval is not push/PR/merge/deploy authority. No automatic merge, force-push or destructive history recovery.
