# Atenea Go Profile v0

Status: **QUALIFICATION CANDIDATE — CURRENT C-087 GO PROFILE (introduced under C-084)**
Date: 2026-10-06

## Purpose

`atenea-go` is not a lower complexity class and is not yet a quality-equivalence claim. It is Atenea under an explicit **human-selected `go` cost policy**: a bounded hybrid route that can be field-qualified on real project tickets.

Go is a **qualification candidate pending real-ticket field evidence**. It is not quality-equivalent to Standard Volume, and this document does not promote it as such.

Atenea keeps two independent routing dimensions:

```text
cost_policy = standard | free_only | go
risk_class  = volume   | complex
```

Cora advises the risk class from the work. The human/project owns cost policy. `go` is selected by the human, not inferred from quota, availability or convenience.

## Cost semantics

`go` means:

- use only the exact bindings in the routing table below;
- no other Go, NaN, OpenAI or Free model is an automatic fallback;
- never switch providers/models because quota, availability or capability is inconvenient inside an active bounded unit;
- if a bound Go model is unavailable, quota-blocked, removed or materially incapable, STOP at a clean boundary and return the decision to Cora/human;
- no percentage balancing, automatic 5-hour-window failover, quota polling as routing authority, or model carousel;
- publication/merge remains human-owned.

## Routing table

`Cost policy: go` uses this exact hybrid envelope:

| Role | Binding |
| --- | --- |
| coordinator | `opencode-go/mimo-v2.6-flash` |
| explorer | `nan/qwen3.6` |
| implementer | `opencode-go/muse-spark-1.3-contributor` |
| merger | `opencode-go/mimo-v2.6-flash` |
| Standards review | `nan/qwen3.6` |
| Spec review | `openai/gpt-6-luna#high` |
| volume correction | fresh `opencode-go/muse-spark-1.3-contributor` |
| complex correction | fresh `opencode-go/deepseek-v4.1-flash` |
| integrated audit | Cora when material |

The profile deliberately combines OpenCode Go for coordinator/writer/merger/correction capacity, NaN `qwen3.6` only as the already no-counter explorer/Standards route, and OpenAI Luna High for Spec assurance.

## Risk inside Go

Both risk classes enter through the visible `atenea-go` coordinator. The Cora-shaped handoff must state both:

```text
Cost policy: go
Risk class: volume | complex
```

For both risk classes, MiMo coordinates, Muse implements, Qwen performs Standards review and Luna High performs Spec review.

`go + volume` uses the ordinary bounded C-084 loop with the Go bindings.

`go + complex` remains Go. It does **not** unlock another provider or model. Instead:

- review closes the Go implementer's write phase; review findings go to fresh Go corrector sessions;
- `Risk class: volume` findings go first to a fresh `atenea-corrector-go-volume` (Muse Go);
- `Risk class: complex` findings go directly to a fresh `atenea-corrector-go-complex` (DeepSeek V4.1 Flash Go), with focused finding-scoped closure and a Cora integrated audit before merge recommendation when the work is material;
- the existing maximum of **two** fresh, finding-scoped correction attempts for the same already-authorized finding envelope is unchanged; a new material finding/scope change or a blocker after attempt #2 is HUMAN STOP;
- do not add extra routine reviews or full suites merely because risk is `complex`; evidence follows the ordinary C-086 phase layering.

## Execution boundary

Launch remains native OpenCode V2 in the already-running Herdr workspace:

```bash
cd <project-or-worktree>
opencode .
```

Select `atenea-go` before submitting the handoff. Go routing does not relax the shaping boundary: material product choices are closed in the attended Cora + human loop before launch, and any new material product question is HUMAN STOP rather than a Go-model decision. Matt remains methodology owner. Cora remains the shaping/product/architecture authority and final integrated auditor when required.

The coordinator is orchestration-only for repository mutation and owns the Go Matt lifecycle, including the single canonical two-axis review and correction dispatch. Repository mutation is delegated to Go implementer/corrector/merger roles; the Go implementer returns the candidate before review and does not invoke review/correction roles itself.

## Model rotation

Go availability and promotion state are volatile. Stable policy and replaceable model bindings are deliberately separated:

```text
ATENEA_GO_PROFILE_V0.md        stable policy
        ↓
ATENEA_GO_MODEL_CATALOG_V0.md  replaceable snapshot
        ↓
.opencode/agents/*go*.md       current bindings
```

Before a Go train, run the model-presence checker **from the canonical Atenea authority checkout**, not by assuming the target project/worktree contains Atenea tooling:

```bash
cd <canonical-Atenea-checkout>
node tools/check-go-models.mjs
```

The target project does not need to carry its own copy of `tools/check-go-models.mjs`. The checker verifies that the exact bound model IDs are still visible to the installed OpenCode runtime. A missing binding is STOP, not permission to improvise a fallback. The checker must not inspect credentials and does not infer quota availability from model presence.

When the Go inventory changes, Cora may propose a new catalog/binding at a clean work boundary. Update and validate the snapshot before the next train; do not mutate routing mid-unit.

## Qualification evidence

Real project tickets remain the quality evidence that matters. Go stays a qualification candidate until field evidence is recorded in the repository's normal qualification surface; synthetic probes and model presence are not quality-equivalence claims.
