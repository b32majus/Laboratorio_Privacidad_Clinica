# Issue #89 — correction #2 from Cora integrated audit

Status: **AUTHORIZED_BOUNDED_CORRECTION · FINAL ATTEMPT**
Date: 2026-10-07

## Identity

- Issue: **#89 — [REC-07] Batch Confidential Audit with deliberate download confirmation**
- Cost policy: **standard**
- Risk class: **complex**
- Visible coordinator: **atenea-complex**
- Defect candidate: `7504118b730a1c1328718579f4ae447ad7139e54`
- Publication: **LOCAL_ONLY**
- Correction budget: **attempt #2 of 2 maximum**
- Canonical review already happened. Do **not** rerun implementer, Standards review or Complex Spec review.

## Cora finding — CORA-89-01

**Privacy Gate and Result do not use the same complete factual availability authority for the batch Confidential artifact.**

The current candidate correctly makes the Result and builder fail closed on:
- accepted batch-ready prerequisite;
- exact current batch session set;
- one current session for each completed/non-removed item;
- every such session still finalizable;
- at least one auditable completed section.

However, the Privacy Gate currently exposes batch Confidential availability from `batchSafeSummaryReady(job)` alone. This can produce:

```text
Job ready + missing/non-finalizable current batch session authority

Privacy Gate  -> Available
Result        -> Unavailable
builder       -> refuses / zero bytes
```

That is a material trust/authorization contradiction.

The existing candidate itself demonstrates the mismatch:
- Privacy Gate tests can mark a completed batch Confidential artifact Available without supplying the complete current session authority;
- Result tests correctly mark the same missing/non-finalizable-session boundary unavailable.

## Required correction

Close **only CORA-89-01**.

There must be one reusable factual batch-Confidential availability derivation below the presentation surfaces, covering the same accepted facts needed before bytes can ever be authorized:

1. accepted batch-ready prerequisite remains true;
2. current batch session authority exists;
3. every completed/non-removed item has its current session;
4. every such session is finalizable;
5. at least one auditable completed section exists;
6. deliberately removed failures remain permitted only as bounded disposition history, never fabricated audit bodies.

Privacy Gate, Result and the Confidential bytes authority must agree on that factual availability.

The exact implementation seam is execution-owned. Do **not** solve this by:
- making Privacy Gate import/export UI code;
- duplicating the predicate separately in Gate and Result;
- weakening the builder;
- treating `job.outputs.confidentialAuditReady` as sufficient authorization;
- introducing a second batch state machine.

A pure reusable authority beneath Gate/Result/builder is the intended architectural direction, but the corrector retains freedom over the smallest coherent seam.

## Required proof

Add focused correspondence evidence for both negative session-authority boundaries and the ready case:

### Missing current session authority

```text
batch Job otherwise ready
+ completed item lacks current session

shared Confidential availability = false
Privacy Gate                     = unavailable
Result                           = unavailable
first Confidential action        = impossible
builder                           = refuses
download                          = zero
```

### Non-finalizable current session

```text
batch Job otherwise ready
+ completed item session no longer finalizable

shared Confidential availability = false
Privacy Gate                     = unavailable
Result                           = unavailable
builder                           = refuses
download                          = zero
```

### Fully authorized batch

```text
batch ready
+ complete current finalizable session set
+ >= 1 audited section

shared Confidential availability = true
Privacy Gate                     = available
Result                           = available
warning/Confirm lifecycle        = unchanged
builder                           = succeeds
```

Preserve the existing mutation / stale-await / unmount / exactly-one-confirmation evidence.

## Explicit non-goals

Do not modify:
- the batch Confidential TXT format or filename;
- canonical `buildConfidentialAudit(...)` or serializer semantics;
- Safe ZIP/PDF/CSV behavior;
- source-filename exclusion;
- removed-item semantics;
- confirmation UX/lifecycle except as needed to consume the shared authority;
- privacy policy / ReviewSession / pseudonym / ProcessingContext semantics;
- #80–#85 or #90/#91;
- dependencies;
- publication state.

## Pre-existing #88 diagnostic debt — DO NOT FIX HERE

Cora independently confirmed that:
- `batchSummaryDiagnostic(...)`
- `batchSafeDiagnostic(...)`

still retain arbitrary `error.name` for unexpected errors.

That pattern predates #89 and already exists at the fixed pre-#89 authority. It is real debt, but it is **not CORA-89-01** and must not be absorbed into this final correction attempt.

## Validation

Use focused evidence only:

- the new/shared availability authority unit tests;
- Privacy Gate correspondence tests;
- Result missing/non-finalizable/ready tests;
- builder fail-closed correspondence;
- existing batch Confidential stale/unmount/confirmation tests;
- smallest relevant typecheck/lint/format checks;
- composed REC-07 E2E only if the shared seam affects the real journey.

Do not run another canonical Standards/Spec review.
Do not run a broad full-suite ritual in the corrector phase.

## STOP

This is **correction attempt #2 of 2**.

HUMAN STOP if:
- closing CORA-89-01 requires a new product/privacy/state/architecture decision;
- the correction requires changing the accepted Confidential artifact semantics;
- a new material finding outside CORA-89-01 is discovered;
- a bound Standard Complex model is unavailable/quota-blocked/materially incapable;
- CORA-89-01 cannot be fully closed inside this envelope.

There is no attempt #3.

## Expected closeout

Return:
- correction fixed execution anchor;
- final candidate SHA;
- changed-file inventory;
- exact CORA-89-01 closure;
- focused proof matrix;
- clean-tree status;
- confirmation that no canonical re-review ran;
- confirmation that #88 diagnostic debt was not absorbed;
- `Publication: LOCAL_ONLY`.

Then STOP for Cora final integrated re-audit.
