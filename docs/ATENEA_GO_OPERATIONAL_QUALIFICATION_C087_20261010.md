# Atenea Go C-087 — Operational Qualification

Status: **QUALIFIED FOR ROUTINE BOUNDED EXECUTION — VOLUME + COMPLEX**
Decision date: **2026-10-10**
Authority: **Human acceptance; a qualification-status update under C-087, NOT a new execution decision**

## Accepted decision

Promote the existing human-selected `cost_policy: go` route from **qualification candidate**
to **operationally qualified** for accepted, bounded real-project work in both
`risk_class: volume` and `risk_class: complex`.

This is a **status-only** change. The canonical default remains `standard`.
The human/project decides cost policy; risk class follows the accepted work.
Go is a **hybrid** route: the coordinator, implementer and corrector use Go;
Standards/explorer depend on NaN Qwen and Spec depends on OpenAI Luna High.
Operational qualification **does not imply equivalent quality, price, latency,
context behavior or unlimited quota versus Standard Volume/Complex**.

All role/model bindings in `docs/ATENEA_GO_PROFILE_V0.md` and
`.opencode/agents/*go*.md` remain unchanged and qualified as observed.
The C-087 native OpenCode V2 + upstream Matt lifecycle, one independent
Standards + Spec review, at most two fresh finding-scoped correctors,
HUMAN STOP and human publication ownership remain unchanged.

## Repeated real-project evidence

The real-project evidence below is primary for qualifying routine work,
rather than relying on synthetic probes alone.

| Work | Merged PR | Qualified observation and limitation |
| --- | --- | --- |
| Nexus Reuma train #586 | [#588](https://github.com/b32majus/Hub-Clinico-Badajoz/pull/588) | Ordered bounded multi-ticket execution and canonical review. A baseline pending-row ambiguity correctly triggered HUMAN STOP before a separately authorized closeout; this is evidence of controlled stopping, not zero incidents. |
| Nexus Farmacia train A #598 | [#600](https://github.com/b32majus/Hub-Clinico-Badajoz/pull/600) | Complex Go train covering synthetic evidence and clinical reporting boundaries, with a human environment/test adjudication. |
| Nexus Farmacia train B #602 | [#603](https://github.com/b32majus/Hub-Clinico-Badajoz/pull/603) | Complex Go reporting/UI train with composed verification and bounded correction; a documented minor UX debt remained. |
| Nexus Pages train #606 | [#607](https://github.com/b32majus/Hub-Clinico-Badajoz/pull/607) | Multi-ticket Home/subroute boundary, composed candidate and human-controlled PR/merge. |
| Nexus Reuma train #614 | [#615](https://github.com/b32majus/Hub-Clinico-Badajoz/pull/615) | Further merged Go field work, independent of the earlier Farmacia trains. |

The PRs named above were verified merged before this declaration.
The qualification covers observed Go Volume and Complex use through
`atenea-go` with repo-local handoffs, role isolation, bounded fresh
correction, deterministic project tests and operator publication control.
It is not a universal quality parity trial against Standard.

Earlier field evidence in `docs/QUALIFICATION.md` includes examples where
Go implementation plus canonical review **did not by themselves** prove
product/representation correctness; the later Cora audit found a material
semantics or shared-consumer issue. This qualification therefore **retains
integrated Cora audit when work is material** and the full HUMAN STOP boundary,
especially for clinical, privacy, authorization and representation claims.

## Native runtime qualification — separate from Go profile

- OpenCode **2.0.22** was the known-good native V2 **field baseline**
  at C-087 acceptance on 2026-10-06.
- A bounded synthetic `C-087 Go Volume` canary on CLI **2.0.26** proved
  Go MiMo coordination, fresh Go Muse implementation, NaN Qwen Standards
  **PASS** and exact `openai/gpt-6-luna#high` Spec **PASS**.
  Final synthetic SHA: `46fb1dc9461cc7703f7d2b4d681a37eaea713bbf`,
  **9/9 Node 20 tests**, one local writer commit, no corrections.
- Its initial Spec attempt STOPped for absent **OpenAI OAuth in the
  isolated canary**. After human authentication, the original frozen
  candidate resumed **only the missing Spec axis**: no model substitution,
  writer rerun, new implementation or review carousel.
- CLI **2.0.26** was subsequently promoted globally with validated
  v2.0.22 package/SQLite/config rollback backups. The resident service
  restarted; Go model preflight passed; 11 relevant Atenea agent bindings
  resolved in a real Nexus worktree; SQLite quick_check passed; Atenea
  and the examined project checkout remained clean.
- **Limit:** functional 2.0.26 canary and live binding compatibility
  passed, but extended *real-project* execution **on 2.0.26** has not
  yet been established by these checks. Observe ordinary future runs.
  The C-085 NaN writer 220k context/compaction guard was inherited,
  not stress-tested again by the Go canary.

### First real field executions after CLI 2.0.26 promotion — 2026-10-10

The promotion was complete before **2026-10-09 21:35 UTC**. A read-only
check of *production* OpenCode `session_v2` metadata, merged GitHub PRs,
Git issue states and the executing worktrees establishes the following
initial post-upgrade field evidence:

| Stream | First observed post-promotion session (UTC) | Actual profile(s) | Observed status on 2026-10-10 |
| --- | --- | --- | --- |
| Nexus Reuma export-safety Train 18 | 2026-10-09 21:35 | **Standard Complex** (`atenea-complex`): MiMo coordinator, GLM high implementers, Luna Standards, Sol high Spec, GLM corrector | **COMPLETE**; merged [#619](https://github.com/b32majus/Hub-Clinico-Badajoz/pull/619) and closeout [#623](https://github.com/b32majus/Hub-Clinico-Badajoz/pull/623); issues #618 and #622 closed |
| PROMueve Sure issue #25 post-closeout repair and publication | 2026-10-09 21:42 | **Go** repair: MiMo Go, Muse Go, Qwen Standards, Luna high Spec; subsequently **Standard Complex** for the R1–R3 correction/review envelope | **COMPLETE**; merged [#46](https://github.com/b32majus/PROMueve_Sure/pull/46) and documentation [#47](https://github.com/b32majus/PROMueve_Sure/pull/47); issue #25 closed. The original issue began before CLI promotion; the proven post-upgrade Go evidence is its **repair/review**, not the entire initial ticket |
| Nexus Reuma copy/storage Train 19 (issues #620/#621) | 2026-10-10 00:05 | **Standard Complex** coordinator and GLM implementers | **IN PROGRESS**; both issues open, worktree has local commits and uncommitted changes, no publication verdict |
| PROMueve Sure issue #29 operator validation | 2026-10-10 00:04 | **Standard Complex** coordinator and GLM implementer | **IN PROGRESS**; issue open, worktree has local uncommitted deliverables, no publication verdict |

This corrects the earlier **canary-only** description: **real
post-promotion project execution is now evidenced** on both Go
(particularly issue #25 repair/review) and Standard Complex (Nexus
Train 18, issue #25 correction). The two in-progress streams are
evidence of invocation/routing and current work, **not completed
quality outcomes**; they were not necessarily actively computing
when this read-only inventory was taken.

A few hours of early field use do **not** establish long-term 2.0.26
stability, equivalence with Standard, unlimited provider capacity or
unchanged compaction economics. No extra qualification train is
required solely to accumulate a ceremonial run count; observe and
reconcile ordinary real work.

Local provenance only (NOT required execution authority):
`/srv/kairos-lab/qualification/atenea-opencode-cli-v2026-10-09-canary/evidence/POSTPROMOTION_20261009.md`.
Do **not** commit credential material, raw SQLite, binaries or backups;
keep rollback copies until explicitly authorized for cleanup.

## Operational acceptance and guardrails

**Accepted:** use `atenea-go` for routine bounded `go + volume` and
`go + complex` tasks when explicitly selected by human/project authority.

**Not authorized by this declaration:** model replacement, automatic
provider fallbacks, switching the default cost policy, bypassing Cora
for material product/domain audits, weakening clinical/security/
representation requirements, more reviews/corrections, automatic merge,
unlimited quota assumptions, or changes to Standard/Free routing.

If the exact model is unavailable or quota-blocked, or accepted authority,
clinical/product semantics, privacy, evidence or correction are materially
unresolved, **HUMAN STOP**. Go's qualified state never implies automatic
publication or unattended resolution of new product decisions.

**Scope of the claim:** operational fitness on the evidenced workload.
Not proven: quality equivalence to Standard for all tasks, universal
correctness without domain oracles, interruption-free provider quotas,
or post-upgrade 2.0.26 field endurance.

Maintain the C-087 routing/protocol **frozen**. Observe ordinary runs on
2.0.26 with existing project tests and read-only telemetry. Reopen only
for repeated material evidence or a real compatibility regression; do
not create mandatory new qualification campaigns.

## Authority placement

`docs/CURRENT_EXECUTION_DECISION_C087.md` remains the current execution
decision. `docs/ATENEA_GO_PROFILE_V0.md` remains exact Go routing policy.
This document records *qualification status and evidence*, indexed by
`docs/QUALIFICATION.md`, `docs/CURRENT_DECISIONS.md` and `docs/START_HERE.md`.
