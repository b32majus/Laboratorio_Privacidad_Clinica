# Issue #80 — REC-08 Direct human input start — C-087 hardened handoff

Status: **READY_TO_LAUNCH**
Prepared: 2026-10-07; human-ratified D-019 and C-087 preflight refresh: 2026-10-10

## Identity

- Repository: `b32majus/Laboratorio_Privacidad_Clinica`
- Selected issue: **#80 — [REC-08] Direct human input start: examples, Pegar and quiet routing**
- Canonical preparation base: `3.0-main@04f1a351ad2a81a223e3019b2510f349ca74d974`
- Worktree: `/srv/kairos-lab/qualification/laboratorio-issue80-direct-input-start-go-20261007`
- Branch: `work/issue-80-direct-input-start-go-20261007`
- Cost policy: **go**
- Risk class: **complex**
- Visible coordinator: **atenea-go**
- Publication: **LOCAL_ONLY**

## Outcome

Recover the remaining REC-08 input-productivity contract without changing the privacy/domain architecture:

1. three one-action Spanish synthetic clinical examples;
2. explicit `Pegar` clipboard convenience with graceful Ctrl+V fallback;
3. clear drag/drop + select-file entry with concise supported-format help;
4. ordinary start state centered on adding information, not learning internal Job routing;
5. Spanish human-purpose policy/use wording on the start experience where the mapping is unambiguous;
6. preserve one deterministic/fail-closed Job creation authority.

REC-08 should be closable by this ticket. Do not absorb REC-09, REC-10 closeout or REC-11 visual-system closeout.

## Binding authority

Read only what is needed:

- GitHub issue #80;
- `docs/START_HERE.md`;
- `docs/RECOVERY_MASTER_PLAN_2026-10.md` → REC-08;
- `docs/HUMAN_PRODUCT_DESIGN_AUTHORITY_V1.md` → HPD-01/03/06/08/11/12/14/15 and §6.1 Input;
- `docs/shaping/CURRENT_DECISIONS.md` → D-009, D-013, D-019, D-023;
- `AGENTS.md` + `CODING_STANDARDS.md`;
- current input/domain seams named below.

Do not reopen historical UX/product decisions already reconciled here.

## Closed pre-execution decisions

### D-019 — generic pipeline override is deliberately superseded

D-019 was proposed as `DELIBERATELY_SUPERSEDED` during shaping and was **explicitly ratified by the human on 2026-10-10**. There is no pending product choice on this override. Do not ask the implementer to adjudicate it again.

Do **not** add a global “process as text/document/batch/structured” selector or another routing authority.

Reason:
- the original UX audit supplied no legitimate override case;
- audited v3 had no generic pipeline selector;
- current input families already route deterministically;
- mixed document + structured input is genuinely ambiguous and must fail closed;
- unsupported formats, including `.doc`, cannot become supported by relabelling;
- bounded specialist overrides with their own domain authority remain separate and unchanged.

If implementation uncovers genuinely new evidence that makes this accepted resolution materially wrong, HUMAN STOP. Do not silently revive the override.

### Examples

Use the existing synthetic/no-PHI heritage payloads as the content source:

- `ejemplos/01-consulta-urgencias.json`
- `ejemplos/02-informe-quirurgico.json`
- `ejemplos/03-historia-clinica.json`

The user action loads the example text into the ordinary pasted-text draft path. It must not create a Job through a separate authority or bypass the normal Create/continue action.

Do not copy the old shortened/typo-ridden inline v3 strings when the maintained JSON examples already exist.

### Pegar

The explicit paste convenience is browser-local only and may use the platform Clipboard API already accepted elsewhere in the product.

Required behavior:
- success loads clipboard text into the same pasted-text draft path;
- permission denial / unavailable clipboard produces a visible, professional Spanish failure with a clear Ctrl+V fallback;
- no remote request, storage write, raw exception/message leak or hidden fallback mechanism;
- it does not silently create/submit a Job.

### Files

Accepted support remains exactly:

`.txt,.pdf,.docx,.csv,.xls,.xlsx`

Legacy `.doc` stays unsupported.

Drag/drop and file selection are two human entry mechanisms into the same existing draft-files / Job creation authority. Neither may invent a second extension classifier or silently select one file from an invalid combination.

Mixed document + structured input and unsupported formats remain explicit Spanish fail-closed errors.

### Quiet routing

The ordinary start surface must not permanently teach:

- Text job;
- Document job;
- Document batch;
- Structured job;
- the mapping table from file family to internal JobKind.

Keep concise format/help text and contextual explanation when ambiguity/error requires it. Internal `JobKind`, `inferJobKind`, extraction adapters and route/domain states remain implementation authority, not user vocabulary.

Exact layout is implementation-owned. Do not prescribe a detached prototype or a specific component tree.

### Policy/use wording

REC-08 also owns the Master Plan obligation that visible policy selection/guidance on the start experience use human-purpose/intended-use language where it maps unambiguously to the accepted policy authority.

Preserve:
- policy IDs and semantics;
- `lookupPolicyProfile` / structured policy authorities;
- local-only truth;
- no unsupported anonymity/compliance/research-approval claims.

Do not invent a second policy table. Exhaustive app-wide Spanish localization remains REC-10; only the touched start/input policy surface is in this ticket.

## Existing seams to compose, not replace

- `app-v4/src/App.tsx`
  - `InputStep`
  - `handleCreateFromDraft`
  - current document/structured/batch intake paths
- `app-v4/src/domain/job.ts`
  - `inferJobKind`
  - `createJob`
  - extension authorities
- `app-v4/src/input/*`
  - current extraction adapters and typed failures
- `app-v4/src/useJobSession.ts`
  - current session/Job bridge
- `app-v4/src/policy-guidance.ts`
  - presentation seam derived from policy authorities

**Reuse-first oracle map (existing before #80):** `app-v4/src/domain/job.test.ts` already exercises `inferJobKind` supported families, mixed-input and unsupported-format refusal; `app-v4/src/App.test.tsx` exercises current creation/intake and `.doc`/extraction failures; `app-v4/src/App.policy.test.tsx` and `app-v4/src/policy-guidance.test.ts` cover policy availability/copy; `app-v4/src/input/extract.test.ts` covers extraction; `e2e/harness/flows.ts`, `e2e/batch.spec.ts` and `e2e/policy-guidance.spec.ts` provide composed user journeys. Reuse the relevant existing witness where it proves the accepted behavior, then add only falsifiable missing interaction evidence for examples, Pegar, drop convergence and responsive reachability.

The implementation may refactor locally if needed, but no second Job-creation, routing, extension or policy authority may emerge.

## Required evidence

Writer phase: focused evidence only.

1. **Examples**
   - all three examples are visible and keyboard-operable;
   - one action loads the expected synthetic text;
   - no Job is created merely by choosing an example;
   - subsequent creation uses the ordinary pasted-text authority.

2. **Pegar**
   - successful clipboard read loads the draft;
   - denied/unavailable clipboard shows Spanish failure + Ctrl+V fallback;
   - zero network/storage side effect;
   - no raw clipboard exception becomes user-visible or diagnostic PHI.

3. **File entry**
   - selection and drag/drop converge on the same accepted files path;
   - supported document and structured cases still infer the same Job family as before;
   - mixed document+structured remains refused;
   - legacy `.doc` remains refused and is never advertised;
   - no silent file loss/reordering in multi-document input.

4. **Quiet routing**
   - ordinary start no longer exposes the permanent internal JobKind mapping;
   - adding information is visually primary;
   - contextual failure/remedy remains understandable in Spanish.

5. **Policy/use wording**
   - touched start-surface policy guidance is Spanish and human-purpose-oriented;
   - semantics/availability remain derived from existing authorities;
   - no unsupported claims.

6. **D-019 regression**
   - the existing deterministic `inferJobKind` matrix remains intact;
   - no generic input-pipeline override control or alternate routing state is introduced.

7. **Rendered product witness**
   - inspect the real application with realistic synthetic content;
   - include at least one narrow/mobile and one desktop witness for the changed input surface;
   - no detached prototype is required.

Use the smallest relevant Vitest / component / composed browser tests plus typecheck/lint/format needed by the changed surface. Broad repository suites belong to publication unless a concrete integration risk requires them earlier.

## Conditional safeguards and readiness

**Conditional safeguards (explicit C-087):**

- **Representation narrowing — ACTIVE at the input boundary.** The visible file controls must not collapse multiple documents to one, silently reorder/drop selected files, treat mixed document+structured input as a valid pipeline or advertise `.doc`. This preserves accepted input family/cardinality/unsupported distinctions rather than designing new routing.
- **Affected shared seam — CONDITIONAL.** If the implementation materially changes the existing Job creation, extraction, extension or policy authority shared by Input/other flows, use the above known consumers and smallest meaningful sibling regression; report an out-of-envelope material consumer and HUMAN STOP rather than starting a broad repo audit.
- **Rendered interaction — ACTIVE.** Since controls and drag/drop are new user-visible behavior, verify in the real app at desktop and narrow/mobile widths including visibility, keyboard operation and click/drop reachability, using the existing browser harness when possible.
- **Adversarial evidence — BOUNDED to the supplied refusal/privacy claims.** Reuse existing fail-closed tests; add targeted negative witnesses only for a real unproven claim.

**Open material product questions: NONE.** D-019 has explicit human approval and all material output/scope decisions are fixed above. The implementer chooses local implementation mechanics, not product policy.

**Writer-environment preflight (2026-10-10):** Node `v24.15.0`, npm `11.12.1`, installed dependencies via `npm ci` from the committed lockfile, local Vitest binary and cached Chromium present. OpenCode `2.0.26` is the promoted C-087 runtime; exact Go bound-model presence check passed from the canonical Atenea checkout. These are environment facts, not product authority.

## Non-goals

Do not implement or redesign:

- #81 manual marking;
- #82 Keep-original safeguard;
- #83 high-volume Review;
- #84 no-op phase/shell overhaul beyond the Input surface;
- #85 structured comparative workspace;
- REC-10 exhaustive localization;
- REC-11 full visual-system recovery;
- OCR/local NER/FHIR/DICOM/layout-preserving PDF;
- persistence/history;
- output semantics;
- ReviewSession/privacy/pseudonym semantics;
- supported-format expansion;
- new dependencies without HUMAN STOP.

## Canonical review and correction

Run exactly one canonical Standards + Spec review after the writer candidate.

For Go:
- Standards: `nan/qwen3.6`
- Spec: `openai/gpt-6-luna#high`

Risk class is **complex**. Any supplied review findings go to a fresh `atenea-corrector-go-complex` (`opencode-go/deepseek-v4.1-flash`), max two finding-scoped attempts under current C-087 authority.

No silent model fallback.

## STOP

HUMAN STOP if:
- a change to `inferJobKind`, Job family semantics, accepted formats or fail-closed rules is actually required;
- new evidence materially reopens D-019;
- policy semantics would need changing rather than presentation;
- input work requires absorbing a REC-09 surface;
- a privacy/network/storage authority must weaken;
- a new dependency is materially required;
- a bound Go model is unavailable/quota-blocked/materially incapable;
- a material product/architecture choice remains unresolved.

## Expected closeout

Return:
- final candidate SHA;
- commits over the fixed preparation point;
- changed-file inventory;
- exact outcome/evidence matrix;
- D-019 preserved as superseded;
- Standards + Spec result and any bounded correction history;
- focused test evidence;
- clean-tree status;
- explicit confirmation that #81–#85 / REC-10/11 were not absorbed;
- `Publication: LOCAL_ONLY`.

Then STOP for Cora integrated audit.
