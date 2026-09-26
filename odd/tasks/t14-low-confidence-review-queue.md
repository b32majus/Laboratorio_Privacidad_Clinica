# Feature: T14 #18 — Low-confidence candidate review queue

Status: IN PROGRESS
Work Order: GitHub #18 (`EXECUTION_READY=YES`; blockers #11 CLOSED, #15 CLOSED; no comments)
Branch: work/native/v4-travel-t12-t16-20260925
START_HEAD: 1c1612ddd17f6d08b3992bb7c895cdbd8d8227a4
Execution profile: native-v4-heavy (unchanged; no lifecycle boundary switch)
Debt: PRODUCT-004, UX-014 — plus ARCH-012, whose own row names "T14 #18" as its owner/destination

## Authority read for this ticket (pre-writer)

- `AGENTS.md` (Work Order discipline, composition gate, privacy invariants), `CONTEXT.md`.
- GitHub #18 body/acceptance/out-of-scope/delivery boundary; blockers #11 and #15 both CLOSED; no comments to honour.
- `docs/specs/SPEC_V4_PRIVACY_ENGINE.md` §3 (Detection contract, `reason?`, offsets against immutable source), §5 (operators), §6 (policy maps context/entity → operator + review requirements; a worker must not invent mapping semantics), §7 (ProcessingContext), §10 (Confidence / low confidence), §11 (Fail-closed).
- `docs/shaping/CURRENT_DECISIONS.md` D-003 (mirror legacy, do not redesign), D-004 (ReviewSession is the review authority), D-005 (Safe Output ≠ Confidential Audit), D-007 (policy vocabulary), D-008 (low-confidence stays visible; confidence influences workflow, not invisibility), D-009 (unknown classification fails explicitly; never silent KEEP).
- `docs/execution/QUALITY_EXECUTION_PROTOCOL_V1.md`; `docs/execution/TRAIN_V4.md` T14 row ("discarded/low-confidence candidates become visible domain/review state").
- `docs/DEBT_REGISTER.md` rows UX-014, PRODUCT-004, ARCH-012.
- Evidence documents cited by those rows: `docs/audits/2026-09-ux-ui-product-flow-audit.md` UX-12 (accepted filter direction), `docs/audits/2026-09-privacy-functional-code-audit.md` §8.4/§8.5.
- Current code/tests: `js/core/processor.js` stage-by-stage pipeline, `js/domain/review-session.js`, `js/domain/from-processor.js`, `app-v4/src/engine/{recognizer-registry,legacy-recognizers,registry-engine,legacy-engine,legacy-operators,policy,types}.ts`, `app-v4/src/review/{review-domain,reviewWorkspaceModel,ReviewWorkspace}.tsx`, `app-v4/src/privacy-gate/privacyGateModel.ts`, `app-v4/src/domain/job.ts`.
- Atenea: `START_HERE.md`, `EXECUTION_PROFILE_SELECTION_POLICY_V1.md`, `WORK_UNIT_COMPOSITION_POLICY_V1.md`, `docs/vnext/CURRENT_COMPATIBILITY.md` (open upstream defects), `PROJECT_EXECUTION_HANDOFF_NATIVE_GENTLE.md`; `check-native-gentle-profile.mjs` PASS (`native-v4-heavy`, worker `nan/deepseek-v4-flash`), `check-vnext-authority.mjs` PASS.

## Current facts (verified, not inferred)

- Below-threshold candidates are discarded at exactly one place: `app-v4/src/engine/legacy-recognizers.ts:238-243` (`observations.filter(...)`) returns only survivors (`:245`); the rejected objects (with valid `start`/`end`/`text`/`type`/`confidence`) become unreachable locals. No count, no log, no side channel.
- `app-v4/src/engine/registry-engine.ts:386-398` therefore has no field for them; `stats` counts only kept entities (`:173-200`); `scoring` carries only the recognition configuration (`:267-275`) and deliberately omits the legacy `descartadas` detail (module header `:50-60`).
- Legacy authority for the discarded shape: `js/core/processor.js:145-173` — `descartadas` = `scoredEntities` whose confidence is below the same effective threshold, mapped to `{ text, type, confidence, razon }` with `razon = e.scoring?.recomendacion || 'BAJO_SCORE'`. **No offsets.** `descartadas` is the exact complement of the kept set *inside* the conflict-resolved set, so candidates are provably non-overlapping with kept legacy observations.
- `ReviewSession` (`js/domain/review-session.js`) already owns everything else: immutable source text, `original` always re-derived from source offsets (`normalizeDetection`), fail-closed `requiresReview` default `true`, decisions `pending|accepted|modified|restored`, `canFinalize` = no pending `requiresReview` detection (`:411-413`), `getFinalText` throws `MANDATORY_REVIEW_PENDING` (`:449-457`), `getProgress` (`:415-440`). `source` is validated against `engine|manual`.
- `ReviewWorkspace` already has a status/type filter vocabulary (`reviewWorkspaceModel.ts:65-70`) and renders `Confidence N%` in the inspector (`ReviewWorkspace.tsx:562-571`). `privacyGateModel.ts:3-9` explicitly defers "low-confidence queues (T14)".
- `job.ts` `Detection` is a documented placeholder that is never populated (`job.ts:47-53`, `:298`) and says "do not extend this ad hoc".

## Semantic decisions (resolved before writing; each traced to existing authority)

- **SD-1 — No new threshold is invented.** A "candidate" is exactly a recognition rejected by the *existing* configured threshold expression (`Processor.config.umbralConfianza`, with the existing `modoEstricto` SOSPECHOSO 0.25 case). The candidate fact travels as an explicit marker, never as a re-derived band: the UI must not re-compute a threshold (SPEC §6: no invented mapping semantics).
- **SD-2 — Candidates become explicit recognizer/domain contract state, not engine fabrications.** ARCH-012(b) requires exactly this: "exponer candidatos descartados/bajo umbral mediante un contrato explícito de reconocedor/dominio (no fabricarlos en el motor)". The recognizer that owns the threshold filter is the component that reports the rejected set.
- **SD-3 — Candidates carry immutable source offsets.** Acceptance 3 + SPEC §3. Offsets are the pre-filter offsets against the same immutable source text; `ReviewSession` keeps re-deriving `original` from those offsets.
- **SD-4 — A candidate's treatment is the accepted policy outcome for its category.** SPEC §5/§6: the policy maps entity → operator. "Treat" applies that operator's output; it is not a new transformation doctrine. If a category has no accepted mapping the engine fails typed exactly as it does for kept observations (D-009), never guessing.
- **SD-5 — Adjudication reuses the existing decision vocabulary.** `accepted` = treat (apply the policy outcome), `restored` = decline (keep the original span as an explicit completed decision). **No new decision kind is introduced**, so `ReviewSession` decision semantics are unchanged. UX-11's "Acción" direction and the accepted "Keep original" label already cover decline.
- **SD-6 — An undecided candidate is NOT a silent KEEP.** SPEC §11 ("unknown structured privacy classification: review required"), D-008 ("confidence influences workflow, not invisibility") and the repository privacy invariant ("default unknown structured privacy classification to KEEP" is forbidden) together require candidates to stay pending until explicitly decided; the session's existing fail-closed default is `requiresReview: true` for every detection, so candidates follow the same rule rather than introducing a new class of non-blocking item. Declining stays available as one explicit, recorded decision.
- **SD-7 — Candidate visibility is a filter/queue, not new UX doctrine.** UX-014 / audit UX-12 direction: the review surface exposes an explicit "Baja confianza" filter alongside the existing ones; the job-level derived Privacy Gate view reports the queue counts. No new screen, no color-only state, no re-labelling of existing filters.
- **SD-8 — Candidates must never reach Safe Output correspondence.** D-005: the candidate list is review-domain state; Safe Output keeps its closed two-key shape (`kind`, `text`) and the Confidential Audit keeps its closed key sets.

## Composition forecast (Atenea `WORK_UNIT_COMPOSITION_POLICY_V1` §4, resolved before writing)

Forecast authored change if delivered as one unit: the recognizer dual contract + engine threading + domain mapping + session/domain contract + workspace filter/queue + gate visibility + oracles ≈ 1400–1700 authored lines across ~14 files. That is above the 601–800 exception band, so a single unit is rejected at the gate. Three independently coherent, independently verifiable work units are defined instead — each keeps the behavior with the oracle that proves it:

- **WU-A — Candidates become explicit recognizer/engine domain state with immutable offsets.** Contract + recognizer reporting + engine threading + policy-outcome proposal + invariant oracles.
- **WU-B — `ReviewSession` adjudicates candidates (treat/decline) without corrupting offsets.** Domain mapping + session contract marker + progress + offset/composition oracles.
- **WU-C — Review workspace low-confidence queue and job-level visibility.** Filter vocabulary + inspector facts + Privacy Gate queue counts + composed decision regression.

Not mechanically sliced: A is the recognition/engine contract, B is the domain adjudication authority, C is the delivery surface plus the composed end-to-end regression. Sanity invariant for the whole ticket: **confidence changes workflow, never silent disappearance; unknown privacy state never silently becomes KEEP.**

## Invariants that must hold at every WU boundary

1. `legacy-engine.ts` parity: the composed engine's kept `entities`/`stats`/`processed` stay bit-comparable to `Processor.process` for the same prepared state (T11 oracle must keep passing).
2. A candidate pass may never change kept entities, kept proposals, `processed`, `stats`, or the returned `ProcessingContext` — including the shared-context pseudonym state that carries into the next document.
3. Candidate offsets always satisfy `0 <= start <= end <= original.length` and `original.slice(start, end) === text`.
4. Candidates never overlap a kept observation or another candidate (they are the complement of the conflict-resolved kept set; V4 EDAD overlaps are resolved deterministically).
5. No PHI in logs, no new network dependency, Worker-safe module graph, no DOM coupling in the engine/domain layers.

## Evidence (appended per work unit)

_(to be filled as each work unit closes)_
