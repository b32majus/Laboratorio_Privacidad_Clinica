import { useCallback, useMemo, useRef, useState } from "react";

import {
  type BatchItemProcessing,
  type DecisionExtras,
  type ExplicitDecisionStatus,
  type ManualDetectionInput,
  type ReviewSession,
  addManualDetection,
  applyDecision,
  canFinalize,
  processBatchItem,
  startReviewSessionAsync,
} from "./review/review-domain";
import {
  type BatchItemReadOutcome,
  type FlowStep,
  type Job,
  type JobInput,
  type JobSourceFile,
  type PrivacyPolicyId,
  type ProcessingFailure,
  acknowledgeBatchItemError,
  advanceStep,
  batchItemStatus,
  batchReviewComplete,
  beginBatchItemRetry,
  beginItemProcessing,
  beginItemRead,
  beginProcessing,
  completeProcessing,
  createJob,
  failProcessing,
  goToStep,
  isBatchItemRetryable,
  batchSafeSummaryReady,
  recordItemFailed,
  recordItemProcessed,
  recordItemRead,
  recordItemReviewCompletion,
  removeBatchItem,
  setPolicy,
  withReviewState,
} from "./domain/job";
import type { EngineLoader } from "./engine/engine-seam";
import {
  createInitialProcessingContext,
  promoteToSharedContext,
} from "./engine/initial-processing-context";
import { createDefaultEngineLoader } from "./engine/production-engine";
import type { ProcessingContext } from "./engine/types";
import { classifyProcessingFailure } from "./processing-outcome";
import {
  createStructuredConfiguration,
  overrideColumnAction as overrideColumnActionConfig,
  overrideColumnClass,
  selectPatientIdColumn,
  setStructuredDateRole as setStructuredDateRoleConfig,
  type StructuredAction,
  type StructuredConfiguration,
  type StructuredDateRole,
} from "./structured/configuration";
import type { ColumnClass } from "./structured/classification";
import {
  createEmptyFreeTextState,
  enumerateFreeTextCells,
  isFreeTextCellSetCurrent,
  processStructuredFreeTextCells,
  replaceFreeTextCellSession,
  type StructuredFreeTextState,
} from "./structured/free-text";
import {
  createDefaultStructuredOutputOptions,
  resolveStudyIdPrefix,
  setAddVisitNumber,
  type StructuredOutputOptions,
  type StudyIdPrefixResolution,
} from "./structured/output-options";
import type { StructuredGrid } from "./structured/grid";
import {
  buildStructuredTransformPlan,
  type StructuredTransformPlan,
} from "./structured/transform-plan";
import {
  prepareStructuredOutput,
  type StructuredOutputPreparation,
} from "./structured/transformed-dataset";

/** Production engine loader: heavy processing runs in the engine Worker. */
const DEFAULT_ENGINE_LOADER = createDefaultEngineLoader();

/**
 * State bridge between the React shell and the pure domain models (SPEC §3).
 *
 * The frozen Job and the frozen ReviewSession are DOMAIN state held here —
 * the review session is never React-local UI state, so navigating between
 * steps or re-rendering the workspace can never mutate or certify review
 * progress. Transient UI state (focus, drafts, filters, selection) stays in
 * the components.
 *
 * `decide` and `addManual` throw synchronously (typed domain errors) so the
 * caller can surface fail-closed messages; state is only written when the
 * domain transition succeeded. Errors thrown inside a state updater would be
 * swallowed by React, so the current state is read through a ref and the
 * updater is replaced by a direct, atomic setState of the computed result.
 *
 * Review installation (T15 #19): {@link startReview} is the ONLY export that
 * installs a ReviewSession from a job, and it always records a processing
 * outcome in the same flow. There is deliberately no way for the shell to
 * install a session without marking the attempt as `succeeded` or `failed`,
 * so a failed attempt can never be mistaken for "not processed yet".
 *
 * Document batch (T17 #21 WU-B): a batch has no single session. Review is per
 * item, so the bridge holds one ReviewSession per successful item plus the
 * currently viewed index ({@link BatchReviewState}). All batch state changes
 * are atomic writes; navigating between documents only changes the viewed
 * index and NEVER touches a job status or a session (FUNC-002, SD-5).
 */
type BatchReviewState = {
  readonly sessions: Readonly<Record<number, ReviewSession>>;
  readonly activeIndex: number | null;
  /**
   * Batch failure recovery (#78, REC-06): the final carried shared
   * {@link ProcessingContext} of the batch attempt (the promoted context of
   * the last successful item, or the policy-owned initial context when no
   * item succeeded). It is the context a contextual in-place retry MUST run
   * with, so the retried document stays consistent with the already-processed
   * documents (same original → same pseudonym, next free counter, job-scoped
   * date shift). Job-scoped bridge state, dropped exactly where `batch` is
   * dropped (`create`, `clear`, `updatePolicy`); NEVER exposed to components.
   */
  readonly sharedContext: ProcessingContext | null;
};

type SessionState = {
  readonly job: Job | null;
  readonly review: ReviewSession | null;
  readonly batch: BatchReviewState | null;
};

const EMPTY_STATE: SessionState = { job: null, review: null, batch: null };

/**
 * Derive the job's review-gated state in ONE atomic write (D-004/D-005):
 * the export gate (`review.complete`) and both output-availability flags
 * come from the same ReviewSession fact, so they can never disagree.
 * Fail-closed: any pending mandatory decision keeps `safeOutputReady`
 * false; the confidential audit becomes available as soon as a review
 * session exists.
 */
function withDerivedReviewState(job: Job, review: ReviewSession): Job {
  const safeOutputReady = canFinalize(review);
  return Object.freeze({
    ...withReviewState(job, { complete: safeOutputReady }),
    outputs: Object.freeze({
      safeOutputReady,
      confidentialAuditReady: true,
    }),
  }) as Job;
}

/**
 * Derive a document-batch job's review-gated state in ONE atomic write
 * (T17 #21 SD-6, corrected by CORR-B and by CORA-87-02). `review.complete`
 * remains the domain's single source of truth ({@link batchReviewComplete}:
 * every non-error item is `completed`), so the existing export step gate keeps
 * working unchanged.
 *
 * Output authority (CORA-87-02): the batch Safe output flag is the SYNCHRONIZED
 * derived mirror of the ONE shared Safe-summary readiness authority
 * ({@link batchSafeSummaryReady}) — the same fact the Privacy Gate and the
 * serializer consume — so the mirror never competes with or weakens it.
 *
 * #89: the batch Confidential Audit flag becomes the SAME synchronized
 * availability mirror (the same one shared readiness prerequisite). It is
 * never sufficient by itself to authorize Confidential bytes: the actual
 * batch artifact additionally requires the exact current per-item session
 * set, every session still finalizable, and fails closed without it (the
 * batch Confidential builder is the only bytes authority). The ACTIVE
 * document's ReviewSession is never presented as a batch-wide Confidential
 * Audit. Single-document/text behavior is owned by
 * {@link withDerivedReviewState} and unchanged.
 */
function withDerivedBatchReviewState(job: Job): Job {
  const complete = batchReviewComplete(job);
  const withReview = withReviewState(job, { complete });
  return Object.freeze({
    ...withReview,
    outputs: Object.freeze({
      safeOutputReady: batchSafeSummaryReady(withReview),
      confidentialAuditReady: batchSafeSummaryReady(withReview),
    }),
  }) as Job;
}

/**
 * #78 (mid-attempt mutation preservation): a batch attempt's outcome job is
 * computed from its attempt-start snapshot, but the operator can record
 * explicit mutations while the attempt is in flight — recovery facts
 * (acknowledge/remove) on read-failed rows, which are visible with their
 * actions from the moment Review renders, and review completions on other
 * documents once sessions exist. Installing the snapshot wholesale would
 * silently revert those explicit mutations. The rebase keeps the CURRENT job
 * as the base and carries over ONLY the files the attempt itself owns:
 *
 * - the batch run owns every item that was `queued` at run start (the run
 *   skips any other item, so their current files — possibly carrying #78
 *   recovery facts recorded mid-run — are preserved);
 * - a retry owns exactly its retried item's outcome file.
 *
 * The caller has already established that `current` is the same job under the
 * same policy; otherwise the attempt's own stale-outcome drop applies.
 */
function rebaseRunOutcomeFiles(
  runJob: Job,
  begun: Job,
  current: Job,
  ownedOutcomeFiles?: Readonly<Record<number, JobSourceFile>>
): Job {
  if (begun.source.type !== "files" || runJob.source.type !== "files") return runJob;
  if (current.source.type !== "files") return runJob;
  const begunFiles = begun.source.files;
  const runFiles = runJob.source.files;
  const currentFiles = current.source.files;
  if (begunFiles.length !== runFiles.length || runFiles.length !== currentFiles.length) {
    return runJob;
  }
  const mergedFiles = runFiles.map((file, index) => {
    const owned = ownedOutcomeFiles?.[index];
    if (owned !== undefined) return owned;
    // The run owns items it actually processed: `queued` at run start. Items
    // it skipped (already `error` — read failures) keep the CURRENT file.
    return begunFiles[index].itemStatus === "queued" ? file : currentFiles[index];
  });
  return withDerivedBatchReviewState(
    Object.freeze({
      ...runJob,
      source: { type: "files", files: Object.freeze(mergedFiles) },
    }) as Job
  );
}

/** The batch item file at `index` of a files-source job (attempt-internal). */
function itemFileOf(job: Job, index: number): JobSourceFile {
  if (job.source.type !== "files") throw new Error("expected a files source");
  return job.source.files[index];
}

/**
 * HARDEN-01 WU-A: derive a structured job's export-gated state from the exact
 * structured preparation (the only authority that activates T19/date-age,
 * QID pseudonymization and Study-ID). Safe
 * and Confidential become available together, because both are produced from
 * the same reviewed configuration; any fail-closed block keeps both false.
 */
function withDerivedStructuredState(job: Job, preparation: StructuredOutputPreparation): Job {
  const ready = preparation.status === "ready";
  return Object.freeze({
    ...withReviewState(job, { complete: ready }),
    outputs: Object.freeze({
      safeOutputReady: ready,
      confidentialAuditReady: ready,
    }),
  }) as Job;
}

/**
 * Engine loader seam (T22 #26 WU-D/WU-E): production callers use the default
 * loader (dedicated engine Worker off the main thread; in-process lazy seam
 * in Worker-less test environments); deterministic oracles inject a stub.
 * The loader runs ONCE per batch loop, not once per item.
 */
export type BatchEngineLoader = EngineLoader;

/**
 * #78 (correction F2): the discriminated result of ONE `retryBatchItem` call.
 * The two kinds are never conflated:
 *
 * - `settled`: the attempt actually RAN and installed its outcome atomically.
 *   `failure` is `null` exactly when the retried item reached a real success
 *   install (review authority created for that item), and carries the typed
 *   failure when the item was returned to a truthful `error`.
 * - `refused`: the call was stale/overlapping/invalid (job or policy authority
 *   changed since capture, an attempt already in flight for the job, no
 *   retained shared context, invalid index, non-retryable item, or a start
 *   dropped by a concurrent replacement) and performed ZERO mutation. A
 *   `refused` result is never a success and must never be reported as one.
 */
export type BatchItemRetryResult =
  | { readonly kind: "settled"; readonly failure: ProcessingFailure | null }
  | { readonly kind: "refused" };

/**
 * Per-item outcome callbacks for {@link runBatchReview}. Production callers
 * pass nothing; deterministic oracles may observe each item transition.
 */
export type BatchReviewRunOptions = {
  readonly engineLoader?: BatchEngineLoader;
  readonly onItemStart?: (index: number) => void;
  readonly onItemSuccess?: (index: number, session: ReviewSession) => void;
  readonly onItemFailure?: (index: number, failure: ProcessingFailure) => void;
};

/**
 * Result of {@link runBatchReview}: either the fully derived final job plus
 * the per-item sessions and the first non-error index (the item the reviewer
 * should land on), or the classified {@link ProcessingFailure} that aborted
 * the attempt before the loop could complete.
 */
export type BatchReviewRun =
  | {
      readonly ok: true;
      readonly job: Job;
      readonly sessions: Readonly<Record<number, ReviewSession>>;
      readonly activeIndex: number | null;
      /**
       * Batch failure recovery (#78): the final carried shared context after
       * the loop — the promoted context of the last success, or the
       * policy-owned initial context when nothing succeeded. The bridge
       * retains it for contextual retries and never exposes it to components.
       */
      readonly sharedContext: ProcessingContext;
    }
  | { readonly ok: false; readonly job: Job; readonly failure: ProcessingFailure };

/**
 * Run the batch review loop over the `queued` items of a document-batch job
 * (T17 #21 SD-4/SD-6). The job MUST already carry a running processing
 * attempt: the caller owns the T15 `processing` state, this helper only loops
 * and derives.
 *
 * Order and isolation: items are visited in selection order; only `queued`
 * items are processed. Each item is marked `processing` before the engine is
 * invoked OUTSIDE any React state updater, then `review-required` on success
 * or `error` on a classified failure. Zero-pending completion (T17 #21
 * CORR-A): a successful item whose ReviewSession already has zero pending
 * mandatory detections transitions DIRECTLY to `completed` via
 * {@link recordItemReviewCompletion} (a documented no-op-safe path from
 * `review-required`), because a session that can already be finalized must
 * never demand a fictitious decide/addManual action. A failure is recorded
 * and the loop CONTINUES so later documents still process (SD-4). The first
 * item starts from the policy-owned initial context built by
 * {@link createInitialProcessingContext} (a Job-scoped date-shift state for
 * the `v4.date-shift` policy, nothing extra otherwise); every success PROMOTES
 * the engine's returned context to `mode: "shared"` for the next item carrying
 * BOTH the returned `pseudonymState` AND the policy-owned `options` (passing it
 * as `"fresh"` would reset the pseudonym counters, and dropping `options` would
 * break the consistent Job-scoped date shift). A failed item contributes
 * NOTHING to the carried context, so cross-document consistency survives a
 * mid-batch failure.
 *
 * The returned job has `completeProcessing` applied and the batch review state
 * derived in one place; `engineLoader` is an oracle-only seam and production
 * callers pass nothing. Any unexpected throw outside the per-item catch is
 * classified and recorded with `failProcessing`, mirroring the single path.
 */
export async function runBatchReviewAsync(
  job: Job,
  options: BatchReviewRunOptions = {}
): Promise<BatchReviewRun> {
  let working = job;
  const sessions: Record<number, ReviewSession> = {};
  // REC-02 WU-B: the FIRST item starts from the policy-owned initial context
  // (a Job-scoped date-shift state only for the `v4.date-shift` policy), not a
  // bare fresh context. Later successes promote it to shared mode.
  let carriedContext: ProcessingContext = createInitialProcessingContext(job, job.policyId);
  let activeIndex: number | null = null;

  try {
    // Inside the try (T22 #26 review correction): a rejected engine load is a
    // classified processing failure recorded on the job, never an unhandled
    // rejection or a permanently `running` attempt.
    const engine = await (options.engineLoader ?? DEFAULT_ENGINE_LOADER)();
    const totalItems = job.source.type === "files" ? job.source.files.length : 0;
    for (let index = 0; index < totalItems; index += 1) {
      if (batchItemStatus(working, index) !== "queued") continue;
      options.onItemStart?.(index);
      working = beginItemProcessing(working, index);
      const outcome = await processBatchItem(working, index, carriedContext, engine);
      if (outcome.ok) {
        working = recordItemProcessed(working, index);
        sessions[index] = outcome.session;
        if (activeIndex === null) activeIndex = index;
        // Zero-pending completion (T17 #21 CORR-A): a session with no pending
        // mandatory detections is already finalizable, so the item goes
        // straight to `completed` (no-op-safe from `review-required`)
        // instead of requiring a fictitious review decision.
        if (canFinalize(outcome.session)) {
          working = recordItemReviewCompletion(working, index, true);
        }
        carriedContext = promoteToSharedContext(outcome.context);
        options.onItemSuccess?.(index, outcome.session);
      } else {
        working = recordItemFailed(working, index, outcome.failure);
        // A failed item contributes nothing to the shared context (SD-4).
        options.onItemFailure?.(index, outcome.failure);
      }
    }
    return {
      ok: true,
      job: withDerivedBatchReviewState(completeProcessing(working)),
      sessions,
      activeIndex,
      // #78: the carried context survives the attempt so a failed item can be
      // retried against the SAME shared state as the successful documents.
      sharedContext: carriedContext,
    };
  } catch (error) {
    const failure = classifyProcessingFailure(error);
    return { ok: false, job: failProcessing(working, failure), failure };
  }
}

export function useJobSession() {
  const [state, setState] = useState<SessionState>(EMPTY_STATE);
  const stateRef = useRef(state);
  stateRef.current = state;
  /**
   * Canonical structured configuration (T20 #24), held as DOMAIN state
   * alongside the job — never React-local UI state. It is keyed by job id so
   * a stale configuration can never leak onto a different job.
   */
  const [structured, setStructured] = useState<{
    readonly jobId: string;
    readonly configuration: StructuredConfiguration;
    readonly plan: StructuredTransformPlan;
    readonly preparation: StructuredOutputPreparation;
  } | null>(null);
  const structuredRef = useRef(structured);
  structuredRef.current = structured;

  /**
   * Batch failure recovery (#78, REC-06): the job id of the retry attempt
   * currently in flight, or `null`. A second overlapping retry for the same
   * job is a no-op (double-fire guard); the ref resets when the attempt
   * settles, and a job replacement drops the stale outcome anyway.
   */
  const retryInFlightRef = useRef<string | null>(null);

  /**
   * Job-scoped structured output options (REC-04 WU-B, D-022): the canonical
   * Study-ID prefix + visit-numbering authority, held as DOMAIN state keyed
   * by job id alongside the configuration — never React-label-only state, so
   * normal V4 step navigation within the Job can never lose it and every
   * change re-derives output/gate state through the structured bridge below.
   * Memory-only (D-013): held in state, never persisted or logged. `null`
   * means no structured job holds options (never installed, or cleared).
   *
   * The stored prefix is the raw value as typed: an invalid non-blank value
   * is an explicit invalid state (see `structuredPrefixInvalid`) that blocks
   * preparation fail-closed — it is never sanitized into an accepted token.
   */
  const [structuredOptions, setStructuredOptions] = useState<{
    readonly jobId: string;
    readonly options: StructuredOutputOptions;
  } | null>(null);
  const structuredOptionsRef = useRef(structuredOptions);
  structuredOptionsRef.current = structuredOptions;

  /**
   * Job-scoped structured free-text review state (REC-03 WU-C, D-021): the
   * domain `StructuredFreeTextState` plus the position of the cell under
   * review in its row-major queue. Domain state held here — never React-local
   * UI state — so navigation can never mutate or certify review progress.
   * `null` means no processed free-text state exists for the current job
   * (never processed, or discarded as stale after a policy/config change).
   */
  const [freeText, setFreeText] = useState<{
    readonly jobId: string;
    readonly state: StructuredFreeTextState;
    readonly activeCell: number | null;
  } | null>(null);
  const freeTextRef = useRef(freeText);
  freeTextRef.current = freeText;

  const create = useCallback((input: JobInput) => {
    setStructured(null);
    setStructuredOptions(null);
    setFreeText(null);
    setState({ job: createJob(input), review: null, batch: null });
  }, []);

  const clear = useCallback(() => {
    setStructured(null);
    setStructuredOptions(null);
    setFreeText(null);
    setState(EMPTY_STATE);
  }, []);

  const navigate = useCallback((step: FlowStep) => {
    setState((current) =>
      current.job ? { ...current, job: goToStep(current.job, step) } : current
    );
  }, []);

  const advance = useCallback(() => {
    setState((current) => (current.job ? { ...current, job: advanceStep(current.job) } : current));
  }, []);

  /**
   * Install a canonical structured configuration with its exact plan +
   * preparation and derive the job's export-gated state in ONE write
   * (HARDEN-01 WU-A). The ONLY path that installs structured authority; it
   * is the exact bridge between Configure and the export gate. The optional
   * free-text review state is the WU-C cell authority: preparation reads
   * canonical reviewed final text only through it, and stays blocked without
   * a current, finalized, failure-free state. `outputOptions` is the REC-04
   * WU-B job-scoped options authority ( Study-ID prefix token text +
   * row-order visit numbering); absent options preserve legacy output
   * exactly, and an invalid prefix blocks fail-closed with an exact reason.
   */
  const installStructured = useCallback(
    (
      configuration: StructuredConfiguration,
      freeTextState: StructuredFreeTextState | null,
      outputOptions?: StructuredOutputOptions
    ): void => {
      const job = stateRef.current.job;
      if (!job || job.kind !== "structured") return;
      const plan = buildStructuredTransformPlan(configuration, {
        policyId: job.policyId,
        jobSeed: job.id,
      });
      const preparation = prepareStructuredOutput(configuration, plan, {
        freeText: freeTextState,
        ...(outputOptions === undefined ? {} : { outputOptions }),
      });
      setStructured({ jobId: job.id, configuration, plan, preparation });
      setState((current) =>
        current.job
          ? { ...current, job: withDerivedStructuredState(current.job, preparation) }
          : current
      );
    },
    []
  );

  /**
   * Read the options held for one job id (`undefined` when none belong to
   * it). Every configuration transition below passes the result into
   * {@link installStructured} so output/gate state always re-derives through
   * the same options authority.
   */
  const optionsForJob = useCallback((jobId: string): StructuredOutputOptions | undefined => {
    const held = structuredOptionsRef.current;
    return held !== null && held.jobId === jobId ? held.options : undefined;
  }, []);

  /**
   * Recompute the canonical structured plan + exact preparation from a
   * reviewed configuration and derive the job's export-gated state in ONE
   * write (HARDEN-01 WU-A). A configuration/action change that alters the
   * free-text cell set (or any policy drift) discards the held cell sessions
   * as stale in the same transition — stale review state can never certify
   * Safe output; the operator reprocesses explicitly under the new facts.
   * An explicit `outputOptions` replaces the held options for this
   * transition (patient-authority changes); otherwise the held job options
   * carry over unchanged.
   */
  const applyStructuredConfiguration = useCallback(
    (configuration: StructuredConfiguration, outputOptions?: StructuredOutputOptions): void => {
      const job = stateRef.current.job;
      const held = freeTextRef.current;
      const kept =
        job !== null &&
        job.kind === "structured" &&
        held !== null &&
        held.jobId === job.id &&
        isFreeTextCellSetCurrent(configuration, held.state, job.policyId)
          ? held.state
          : null;
      if (kept === null && held !== null) setFreeText(null);
      const effective = outputOptions ?? (job === null ? undefined : optionsForJob(job.id));
      if (outputOptions !== undefined && job !== null) {
        setStructuredOptions({ jobId: job.id, options: outputOptions });
      }
      installStructured(configuration, kept, effective);
    },
    [installStructured, optionsForJob]
  );

  const updatePolicy = useCallback(
    (policyId: PrivacyPolicyId) => {
      const current = stateRef.current;
      if (!current.job) return;
      if (current.job.policyId === policyId) return;
      // PR #40 corrective C2: a REAL policy change invalidates any existing
      // ReviewSession in the same atomic write — the domain transition resets
      // the derived review/output state and the bridge drops the stale session.
      // T17 #21 SD-8: for a batch the domain returns non-error items to
      // `queued`, so every per-item session is dropped in the same write.
      const next = setPolicy(current.job, policyId);
      let job: Job = next;
      const structuredState = structuredRef.current;
      if (
        next.kind === "structured" &&
        structuredState !== null &&
        structuredState.jobId === next.id
      ) {
        // The structured plan depends on the policy: recompute it and re-derive
        // the gate in the same transition. REC-03 WU-C: a REAL policy change
        // invalidates the held free-text sessions in the same atomic write —
        // they were processed under the previous policy and must be
        // reprocessed explicitly under the new one, never reused.
        setFreeText(null);
        const plan = buildStructuredTransformPlan(structuredState.configuration, {
          policyId: next.policyId,
          jobSeed: next.id,
        });
        const heldOptions = optionsForJob(next.id);
        const preparation = prepareStructuredOutput(structuredState.configuration, plan, {
          ...(heldOptions === undefined ? {} : { outputOptions: heldOptions }),
        });
        setStructured({
          jobId: next.id,
          configuration: structuredState.configuration,
          plan,
          preparation,
        });
        job = withDerivedStructuredState(next, preparation);
      }
      setState({ job, review: null, batch: null });
    },
    [optionsForJob]
  );

  /**
   * Batch read phase (T17 #21 SD-2/SD-3): mark one item `reading`, then record
   * its read outcome (`queued` with held text, or `error` with a typed item
   * error). State is read through the ref and written atomically so a wrong
   * state throws the typed domain error to the caller instead of being
   * swallowed by a React updater.
   */
  const beginBatchItemRead = useCallback((index: number) => {
    const current = stateRef.current;
    if (!current.job) return;
    const job = beginItemRead(current.job, index);
    setState((state) => (state.job ? { ...state, job } : state));
  }, []);

  const recordBatchItemRead = useCallback((index: number, outcome: BatchItemReadOutcome) => {
    const current = stateRef.current;
    if (!current.job) return;
    const job = recordItemRead(current.job, index, outcome);
    setState((state) => (state.job ? { ...state, job } : state));
  }, []);

  /**
   * Run and record ONE processing attempt, then install the resulting
   * ReviewSession. This is the single bridge entry point into review, and the
   * only production path that installs a review session from a job (T15 #19).
   *
   * A processing attempt has two explicit halves: `beginProcessing` marks the
   * attempt as `running` BEFORE any engine call, and a success may only be
   * recorded with `completeProcessing`. That is why success is never inferred:
   * the domain only reaches `succeeded` from `running`, so an outcome can
   * never be fabricated for an attempt that was not started. On a throw the
   * failure is classified and recorded with `failProcessing`, and the typed
   * {@link ProcessingFailure} is returned so the caller can surface its
   * message (this method never throws for a typed processing failure).
   *
   * Ordered calls inside one handler compose correctly: the attempt is
   * recorded through functional state updaters, while the engine is invoked
   * OUTSIDE any state updater (React swallows updater errors, and the source
   * text is unchanged by the transition).
   *
   * A document batch takes the {@link runBatchReview} path instead: per-item
   * sessions are installed at once and the batch guard below makes a second
   * call (or any re-fire from the shell's review-step effect) an exact no-op
   * while the sessions exist.
   */
  const startReview = useCallback(async (): Promise<ProcessingFailure | null> => {
    const current = stateRef.current;
    if (!current.job || current.review || current.batch) return null;
    const job = current.job;

    /**
     * Async gap guard (T22 #26 WU-D, review correction): while the engine
     * promise is pending the session may have been cleared, replaced, or the
     * JOB'S POLICY may have changed (a real policy change resets the derived
     * review state and returns batch items to `queued`, PR #40 corrective
     * C2/SD-8). A stale outcome is only installed when the current job is
     * still the SAME job with the SAME policy the attempt started under —
     * installing a review built under the previous policy onto a
     * policy-changed job would let decisions proceed under the wrong policy.
     */
    const jobStillCurrent = (): boolean => {
      const latest = stateRef.current.job;
      if (latest === null) return false;
      return latest.id === job.id && latest.policyId === job.policyId;
    };

    if (job.kind === "document-batch") {
      const begun = beginProcessing(job);
      setState((state) => (state.job ? { ...state, job: begun } : state));
      const run = await runBatchReviewAsync(begun);
      if (!jobStillCurrent()) return null;
      if (!run.ok) {
        setState((state) =>
          jobStillCurrent() && state.job !== null
            ? { ...state, job: rebaseRunOutcomeFiles(run.job, begun, state.job) }
            : state
        );
        return run.failure;
      }
      const sessions = Object.freeze({ ...run.sessions });
      setState((state) =>
        jobStillCurrent() && state.job !== null
          ? {
              job: rebaseRunOutcomeFiles(run.job, begun, state.job),
              review: null,
              batch: {
                sessions,
                activeIndex: run.activeIndex,
                sharedContext: run.sharedContext,
              },
            }
          : state
      );
      return null;
    }

    setState((state) => (state.job ? { ...state, job: beginProcessing(state.job) } : state));
    try {
      const review = await startReviewSessionAsync(job, DEFAULT_ENGINE_LOADER);
      // Async gap guard: a cleared, replaced or policy-changed session drops
      // the stale outcome instead of attaching a review to the wrong job or
      // to a job under a different policy.
      if (!jobStillCurrent()) return null;
      setState((state) => {
        if (state.job === null || !jobStillCurrent()) return state;
        return {
          job: completeProcessing(withDerivedReviewState(state.job, review)),
          review,
          batch: null,
        };
      });
      return null;
    } catch (error) {
      if (!jobStillCurrent()) return null;
      const failure = classifyProcessingFailure(error);
      setState((state) => {
        if (state.job === null || !jobStillCurrent()) return state;
        return { ...state, job: failProcessing(state.job, failure) };
      });
      return failure;
    }
  }, []);

  const decide = useCallback(
    (id: string, decision: ExplicitDecisionStatus, extras?: DecisionExtras) => {
      const current = stateRef.current;
      // REC-03 WU-C: a structured job with free-text state decides the ACTIVE
      // cell's session through the same domain transition. The decided session
      // is replaced (never mutated) and the preparation + gate re-derive in
      // the same transition, so Safe output always reads canonical final text.
      const held = freeTextRef.current;
      const structuredState = structuredRef.current;
      if (
        current.job?.kind === "structured" &&
        held !== null &&
        structuredState !== null &&
        held.jobId === current.job.id
      ) {
        const outcome = held.activeCell === null ? undefined : held.state.cells[held.activeCell];
        if (outcome === undefined || !outcome.ok) return;
        const session = applyDecision(outcome.session, id, decision, extras);
        const nextState = replaceFreeTextCellSession(
          held.state,
          outcome.cell.columnIndex,
          outcome.cell.rowIndex,
          session
        );
        setFreeText({ ...held, state: nextState });
        installStructured(structuredState.configuration, nextState, optionsForJob(current.job.id));
        return;
      }
      if (current.batch) {
        const activeIndex = current.batch.activeIndex;
        const activeSession =
          activeIndex === null ? undefined : current.batch.sessions[activeIndex];
        if (activeIndex === null || !current.job || !activeSession) return;
        const review = applyDecision(activeSession, id, decision, extras);
        // SD-5: completion is recomputed for the ACTIVE item only, and the
        // derived gate/outputs are re-derived in the SAME atomic write.
        const updatedJob = recordItemReviewCompletion(
          current.job,
          activeIndex,
          canFinalize(review)
        );
        setState({
          job: withDerivedBatchReviewState(updatedJob),
          review: null,
          batch: {
            sessions: Object.freeze({ ...current.batch.sessions, [activeIndex]: review }),
            activeIndex,
            sharedContext: current.batch.sharedContext,
          },
        });
        return;
      }
      if (!current.review) return;
      const review = applyDecision(current.review, id, decision, extras);
      setState({
        job: current.job ? withDerivedReviewState(current.job, review) : null,
        review,
        batch: null,
      });
    },
    [installStructured, optionsForJob]
  );

  const addManual = useCallback(
    (detection: ManualDetectionInput) => {
      const current = stateRef.current;
      // REC-03 WU-C: a structured job with free-text state adds the manual
      // detection to the ACTIVE cell's session, then re-derives.
      const held = freeTextRef.current;
      const structuredState = structuredRef.current;
      if (
        current.job?.kind === "structured" &&
        held !== null &&
        structuredState !== null &&
        held.jobId === current.job.id
      ) {
        const outcome = held.activeCell === null ? undefined : held.state.cells[held.activeCell];
        if (outcome === undefined || !outcome.ok) return;
        const session = addManualDetection(outcome.session, detection);
        const nextState = replaceFreeTextCellSession(
          held.state,
          outcome.cell.columnIndex,
          outcome.cell.rowIndex,
          session
        );
        setFreeText({ ...held, state: nextState });
        installStructured(structuredState.configuration, nextState, optionsForJob(current.job.id));
        return;
      }
      if (current.batch) {
        const activeIndex = current.batch.activeIndex;
        const activeSession =
          activeIndex === null ? undefined : current.batch.sessions[activeIndex];
        if (activeIndex === null || !current.job || !activeSession) return;
        const review = addManualDetection(activeSession, detection);
        const updatedJob = recordItemReviewCompletion(
          current.job,
          activeIndex,
          canFinalize(review)
        );
        setState({
          job: withDerivedBatchReviewState(updatedJob),
          review: null,
          batch: {
            sessions: Object.freeze({ ...current.batch.sessions, [activeIndex]: review }),
            activeIndex,
            sharedContext: current.batch.sharedContext,
          },
        });
        return;
      }
      if (!current.review) return;
      const review = addManualDetection(current.review, detection);
      setState({
        job: current.job ? withDerivedReviewState(current.job, review) : null,
        review,
        batch: null,
      });
    },
    [installStructured, optionsForJob]
  );

  /**
   * Change the viewed batch document (T17 #21 SD-5). This is the ONLY batch
   * navigation entry: it writes the active index and nothing else — the job
   * object and every per-item session are left untouched, so viewing a
   * document can never mark it reviewed (FUNC-002). A no-op without a batch.
   */
  const selectDocument = useCallback((index: number | null) => {
    setState((current) =>
      current.batch ? { ...current, batch: { ...current.batch, activeIndex: index } } : current
    );
  }, []);

  /**
   * Batch failure recovery (#78, REC-06): contextual in-place retry of ONE
   * retryable failed item against the RETAINED shared cross-document context.
   *
   * Fail-closed entry conditions (all checked before any mutation): the
   * rendered job id AND the captured policy authority must still match the
   * CURRENT job (a stale action can never target a replaced Job or a replaced
   * policy authority — #78 correction F3 pins BOTH at capture time), the
   * batch state must exist, the domain must classify the item as retryable
   * ({@link isBatchItemRetryable}: a processing failure with retained text,
   * not removed, not `policy-unsupported`), and a shared context must be
   * retained (no context ⇒ no retry — never a fresh/inconsistent context).
   * A second overlapping retry for the same job is refused (double-fire
   * guard; the in-flight ref resets when the attempt settles).
   *
   * Every refusal — including a start/outcome dropped by a concurrent job or
   * policy replacement — is reported as `{ kind: "refused" }` with ZERO
   * mutation (#78 correction F2): a refused call is never conflated with an
   * attempt that settled, so callers cannot announce a refusal as success.
   *
   * The started attempt is installed atomically (guarded by the SAME job id
   * AND the captured policy), the engine runs OUTSIDE any state updater, and
   * the outcome is installed in one atomic write guarded by the existing
   * `jobStillCurrent()` rule (same job id AND same policy — a policy change
   * mid-retry drops the stale outcome with zero mutation). Success records
   * `recordItemProcessed`, installs ONLY that item's session, applies the
   * normal zero-pending `recordItemReviewCompletion` rule, promotes the
   * returned context to the retained shared context and re-derives the batch
   * review state; failure (including a throwing engine load) classifies the
   * failure and records `recordItemFailed`, returning the item to a truthful
   * `error` with its typed failure — never a silent `queued`/`processing`
   * zombie. Every outcome write goes through
   * {@link withDerivedBatchReviewState}, so `review.complete` and both output
   * flags stay one authority.
   */
  const retryBatchItem = useCallback(
    async (
      jobId: string,
      policyId: PrivacyPolicyId,
      index: number,
      options?: { engineLoader?: BatchEngineLoader }
    ): Promise<BatchItemRetryResult> => {
      const current = stateRef.current;
      const job = current.job;
      if (job === null || job.id !== jobId || job.policyId !== policyId || current.batch === null) {
        return { kind: "refused" };
      }
      if (retryInFlightRef.current === jobId) return { kind: "refused" };
      if (current.batch.sharedContext === null) return { kind: "refused" };
      // Out-of-range (or malformed) indexes are a refusal at the bridge entry;
      // the domain guard below stays the authority for genuine state refusals.
      const files = job.source.type === "files" ? job.source.files : [];
      if (!Number.isInteger(index) || index < 0 || index >= files.length) {
        return { kind: "refused" };
      }
      if (!isBatchItemRetryable(job, index)) return { kind: "refused" };
      const started = beginBatchItemRetry(job, index);
      // #78 correction F3: the policy authority captured when the action was
      // offered (the rendered job's policy) is pinned here and is the ONLY
      // policy the whole attempt may start or install under.
      const startPolicyId = policyId;
      const sharedContextAtStart = current.batch.sharedContext;
      const jobStillCurrent = (): boolean => {
        const latest = stateRef.current.job;
        return latest !== null && latest.id === jobId && latest.policyId === startPolicyId;
      };
      retryInFlightRef.current = jobId;
      try {
        // Atomically install the explicitly started processing attempt; a
        // job/policy replacement between the snapshot and this commit drops
        // the start (and the whole attempt) with zero mutation.
        setState((state) =>
          state.job !== null && state.job.id === jobId && state.job.policyId === startPolicyId
            ? { ...state, job: started }
            : state
        );
        if (!jobStillCurrent()) return { kind: "refused" };

        let outcome: BatchItemProcessing;
        try {
          const engine = await (options?.engineLoader ?? DEFAULT_ENGINE_LOADER)();
          outcome = await processBatchItem(started, index, sharedContextAtStart, engine);
        } catch (error) {
          // A throwing engine load is a classified processing failure like
          // any other: the item returns to a truthful `error` state. The
          // outcome FILE is computed from the `started` snapshot, but the
          // install rebases onto the CURRENT job (#78): the attempt owns only
          // its own item, so mutations recorded on OTHER items while the
          // retry was in flight are never silently reverted.
          if (!jobStillCurrent()) return { kind: "refused" };
          const failure = classifyProcessingFailure(error);
          const failedJob = rebaseRunOutcomeFiles(started, started, stateRef.current.job!, {
            [index]: itemFileOf(recordItemFailed(started, index, failure), index),
          });
          setState((state) => (jobStillCurrent() ? { ...state, job: failedJob } : state));
          return { kind: "settled", failure };
        }
        if (!jobStillCurrent()) return { kind: "refused" };

        // #78 (React commit semantics): the outcome FILE for the retried item
        // is computed from the `started` snapshot — exactly like the batch
        // `startReview` path, which computes `run.job` from `begun`. The
        // `jobStillCurrent()` guard (same job id AND same policy) is the
        // staleness boundary for the atomic outcome install, and the install
        // REBASES onto the current job (#78): the attempt owns only its own
        // item, so mutations recorded on other items mid-retry survive.
        if (!outcome.ok) {
          const failedJob = rebaseRunOutcomeFiles(started, started, stateRef.current.job!, {
            [index]: itemFileOf(recordItemFailed(started, index, outcome.failure), index),
          });
          setState((state) => (jobStillCurrent() ? { ...state, job: failedJob } : state));
          return { kind: "settled", failure: outcome.failure };
        }
        // Success: exactly this item's outcome, in one atomic write. The
        // retained shared context is replaced by the promoted returned
        // context, so a later retry stays consistent with this document too.
        let outcomeJob = recordItemProcessed(started, index);
        if (canFinalize(outcome.session)) {
          outcomeJob = recordItemReviewCompletion(outcomeJob, index, true);
        }
        const derivedJob = rebaseRunOutcomeFiles(started, started, stateRef.current.job!, {
          [index]: itemFileOf(outcomeJob, index),
        });
        const nextSessions = Object.freeze({
          ...(stateRef.current.batch?.sessions ?? {}),
          [index]: outcome.session,
        });
        const nextSharedContext = promoteToSharedContext(outcome.context);
        setState((state) =>
          jobStillCurrent() && state.batch !== null
            ? {
                job: derivedJob,
                review: null,
                batch: {
                  sessions: nextSessions,
                  activeIndex: state.batch.activeIndex,
                  sharedContext: nextSharedContext,
                },
              }
            : state
        );
        return { kind: "settled", failure: null };
      } finally {
        if (retryInFlightRef.current === jobId) retryInFlightRef.current = null;
      }
    },
    []
  );

  /**
   * Batch failure recovery (#78, REC-06): apply the confirmed removal of one
   * failed item. The confirm/cancel interaction lives in the component; this
   * entry point runs only on Confirm. It verifies the rendered job id AND the
   * captured policy authority (a stale action can never mutate a replaced Job
   * or a policy-replaced job — #78 correction F3), applies the domain
   * transition and re-derives the batch review state in ONE atomic write.
   * Cancel never reaches this path, so it is zero mutation by construction.
   */
  const removeBatchItemAction = useCallback(
    (jobId: string, policyId: PrivacyPolicyId, index: number): void => {
      const current = stateRef.current;
      if (current.job === null || current.job.id !== jobId || current.job.policyId !== policyId) {
        return;
      }
      const job = withDerivedBatchReviewState(removeBatchItem(current.job, index));
      setState((state) =>
        state.job !== null && state.job.id === jobId && state.job.policyId === policyId
          ? { ...state, job }
          : state
      );
    },
    []
  );

  /**
   * Batch failure recovery (#78, REC-06): acknowledge the current typed
   * failure of one active failed item ("seen", never "resolved"). Same
   * job-id + captured-policy guard and atomic re-derivation as the removal
   * above; the item stays `error` and its blocker stays active.
   */
  const acknowledgeBatchItemErrorAction = useCallback(
    (jobId: string, policyId: PrivacyPolicyId, index: number): void => {
      const current = stateRef.current;
      if (current.job === null || current.job.id !== jobId || current.job.policyId !== policyId) {
        return;
      }
      const job = withDerivedBatchReviewState(acknowledgeBatchItemError(current.job, index));
      setState((state) =>
        state.job !== null && state.job.id === jobId && state.job.policyId === policyId
          ? { ...state, job }
          : state
      );
    },
    []
  );

  /**
   * Run the structured free-text review loop (REC-03 WU-C): every non-blank
   * `process-as-text` cell is processed in row-major order through the
   * productive engine under the Job's own policy with one shared context,
   * and the resulting cell sessions are installed as domain state. This is
   * the structured counterpart of {@link startReview}: an explicit,
   * reviewer-triggered run — never automatic, never an auto-accept shortcut.
   *
   * With no routed cells the held state is cleared and the gate re-derives.
   * A rejected engine load is a classified processing failure recorded on
   * the job (never an unhandled rejection). A policy change between run
   * start and install drops the stale outcome instead of certifying review
   * under the wrong policy (same async-gap guard as the single path).
   */
  const runStructuredFreeTextReview = useCallback(
    async (options: BatchReviewRunOptions = {}): Promise<ProcessingFailure | null> => {
      const current = stateRef.current;
      const structuredState = structuredRef.current;
      if (
        !current.job ||
        current.job.kind !== "structured" ||
        structuredState === null ||
        structuredState.jobId !== current.job.id
      ) {
        return null;
      }
      const job = current.job;
      const configuration = structuredState.configuration;
      if (enumerateFreeTextCells(configuration).length === 0) {
        // SPEC-2: a routed `process-as-text` column whose current cells are
        // all blank has no required session. Install a current EMPTY state
        // (same policy, same cell set) so preparation can reach `ready`
        // instead of blocking forever; when no column is routed, clearing to
        // `null` remains the exact behavior.
        const hasRoutedColumns = configuration.columns.some(
          (column) => column.effectiveAction === "process-as-text"
        );
        const emptyState = hasRoutedColumns ? createEmptyFreeTextState(job.id, job.policyId) : null;
        setFreeText(
          emptyState === null ? null : { jobId: job.id, state: emptyState, activeCell: null }
        );
        installStructured(configuration, emptyState, optionsForJob(job.id));
        return null;
      }
      const jobStillCurrent = (): boolean => {
        const latest = stateRef.current.job;
        if (latest === null) return false;
        return latest.id === job.id && latest.policyId === job.policyId;
      };
      setState((state) => (state.job ? { ...state, job: beginProcessing(state.job) } : state));
      try {
        const engine = await (options.engineLoader ?? DEFAULT_ENGINE_LOADER)();
        const produced = await processStructuredFreeTextCells({
          jobId: job.id,
          jobName: job.name,
          policyId: job.policyId,
          configuration,
          engine,
        });
        if (!jobStillCurrent()) return null;
        setFreeText({
          jobId: job.id,
          state: produced,
          activeCell: produced.cells.length > 0 ? 0 : null,
        });
        installStructured(configuration, produced, optionsForJob(job.id));
        setState((state) =>
          state.job && jobStillCurrent() ? { ...state, job: completeProcessing(state.job) } : state
        );
        return null;
      } catch (error) {
        if (!jobStillCurrent()) return null;
        const failure = classifyProcessingFailure(error);
        setState((state) => {
          if (state.job === null || !jobStillCurrent()) return state;
          return { ...state, job: failProcessing(state.job, failure) };
        });
        return failure;
      }
    },
    [installStructured, optionsForJob]
  );

  /**
   * Change the free-text cell under review (REC-03 WU-C navigation). This is
   * the ONLY cell-navigation entry: it writes the active position and
   * nothing else — the job object and every cell session are left untouched,
   * so viewing a cell can never mark it reviewed. A no-op without free-text
   * state; out-of-range positions are refused.
   */
  const selectFreeTextCell = useCallback((position: number | null) => {
    const held = freeTextRef.current;
    if (held === null) return;
    if (
      position !== null &&
      (!Number.isInteger(position) || position < 0 || position >= held.state.cells.length)
    ) {
      return;
    }
    setFreeText({ ...held, activeCell: position });
  }, []);

  /**
   * Install the canonical structured configuration built from a parsed grid
   * (T20 #24). Refuses to install onto a non-structured job, so the bridge can
   * never attach structured authority to another job family. A fresh grid
   * starts with the heritage output-options defaults (no patient authority
   * yet, so visit numbering is absent).
   */
  const installStructuredGrid = useCallback(
    (grid: StructuredGrid) => {
      const current = stateRef.current;
      if (!current.job || current.job.kind !== "structured") return;
      const configuration = createStructuredConfiguration(grid);
      const options = createDefaultStructuredOutputOptions(
        configuration.patientId.status === "resolved"
      );
      applyStructuredConfiguration(configuration, options);
    },
    [applyStructuredConfiguration]
  );

  /** Explicit reviewer override of one structured column's class (domain transition). */
  const overrideStructuredColumn = useCallback(
    (columnIndex: number, columnClass: ColumnClass) => {
      const current = structuredRef.current;
      if (current === null) return;
      applyStructuredConfiguration(
        overrideColumnClass(current.configuration, columnIndex, columnClass)
      );
    },
    [applyStructuredConfiguration]
  );

  /**
   * Explicit reviewer choice of one structured column's productive Action
   * (REC-03 WU-B). Goes through the same single bridge as the class
   * override: the canonical frozen configuration is rebuilt and the plan +
   * gate state re-derived together, never a label-only edit.
   */
  const overrideStructuredColumnAction = useCallback(
    (columnIndex: number, action: StructuredAction) => {
      const current = structuredRef.current;
      if (current === null) return;
      applyStructuredConfiguration(
        overrideColumnActionConfig(current.configuration, columnIndex, action)
      );
    },
    [applyStructuredConfiguration]
  );

  /**
   * Set (or clear with `null`) the single structured patient-ID column
   * authority. REC-04 WU-B heritage rule: acquiring the authority for the
   * first time enables visit numbering by default; releasing it makes the
   * visit column effectively absent; switching authorities keeps the held
   * choice. The typed prefix is never touched by this transition.
   */
  const selectStructuredPatientId = useCallback(
    (header: string | null) => {
      const current = structuredRef.current;
      const job = stateRef.current.job;
      if (current === null || job === null) return;
      const nextConfiguration = selectPatientIdColumn(current.configuration, header);
      const hadAuthority = current.configuration.patientId.status === "resolved";
      const hasAuthority = nextConfiguration.patientId.status === "resolved";
      const held = optionsForJob(job.id);
      const base =
        held ??
        createDefaultStructuredOutputOptions(current.configuration.patientId.status === "resolved");
      const nextOptions: StructuredOutputOptions =
        !hadAuthority && hasAuthority
          ? Object.freeze({ ...base, addVisitNumber: true })
          : !hasAuthority
            ? Object.freeze({ ...base, addVisitNumber: false })
            : base;
      applyStructuredConfiguration(nextConfiguration, nextOptions);
    },
    [applyStructuredConfiguration, optionsForJob]
  );

  /**
   * Store one raw Study-ID prefix choice (REC-04 WU-B). The value is stored
   * verbatim — never sanitized — and an invalid non-blank value blocks
   * preparation fail-closed through the same bridge (explicit invalid state
   * + gate behaviour). A no-op without held structured state.
   */
  const setStructuredStudyIdPrefix = useCallback(
    (raw: string) => {
      const current = structuredRef.current;
      const job = stateRef.current.job;
      if (current === null || job === null) return;
      const held = optionsForJob(job.id);
      if (held === undefined) return;
      if (raw === held.studyIdPrefix) return;
      applyStructuredConfiguration(
        current.configuration,
        Object.freeze({ ...held, studyIdPrefix: raw })
      );
    },
    [applyStructuredConfiguration, optionsForJob]
  );

  /**
   * Store the explicit visit-numbering choice (REC-04 WU-B). Without a
   * patient-ID authority the column is unavailable/effectively absent, so
   * enabling coerces to absent. Output/gate state re-derives in the same
   * transition. A no-op without held structured state.
   */
  const setStructuredAddVisitNumber = useCallback(
    (enabled: boolean) => {
      const current = structuredRef.current;
      const job = stateRef.current.job;
      if (current === null || job === null) return;
      const held = optionsForJob(job.id);
      if (held === undefined) return;
      const hasAuthority = current.configuration.patientId.status === "resolved";
      const next = setAddVisitNumber(held, enabled, hasAuthority);
      if (next === held) return;
      applyStructuredConfiguration(current.configuration, next);
    },
    [applyStructuredConfiguration, optionsForJob]
  );

  /**
   * Set (or clear) one column's explicit date role (HARDEN-01 WU-A). Orthogonal
   * to the classification; it is the only thing that can activate T19.
   */
  const setStructuredColumnDateRole = useCallback(
    (columnIndex: number, role: StructuredDateRole) => {
      const current = structuredRef.current;
      if (current === null) return;
      applyStructuredConfiguration(
        setStructuredDateRoleConfig(current.configuration, columnIndex, role)
      );
    },
    [applyStructuredConfiguration]
  );

  const currentJobId = state.job?.id ?? null;
  /**
   * Batch failure recovery (#78, REC-06): whether the CURRENT job's bridge
   * batch state retains a shared processing context. The component gate for
   * offering `Reintentar` (with the domain's `isBatchItemRetryable`); the
   * context itself is never exposed to components.
   */
  const batchRetryContextAvailable =
    state.batch !== null && state.batch.sharedContext !== null && state.job !== null;
  const heldStructuredOptions =
    structuredOptions !== null && structuredOptions.jobId === currentJobId
      ? structuredOptions.options
      : null;
  /**
   * The held raw prefix resolved ONCE per options change to the typed
   * resolution discriminated union (SM-2): the invalid state is represented
   * by the resolved typed value, not a bare re-derived string. No
   * per-render re-computation of `resolveStudyIdPrefix`.
   */
  const heldPrefixResolution: StudyIdPrefixResolution | null = useMemo(
    () =>
      heldStructuredOptions === null
        ? null
        : resolveStudyIdPrefix(heldStructuredOptions.studyIdPrefix),
    [heldStructuredOptions]
  );
  /**
   * Exact invalid-prefix reason, or `null` while it resolves, derived
   * directly from the typed resolution rather than re-running resolution.
   */
  const heldPrefixInvalid =
    heldPrefixResolution !== null && heldPrefixResolution.status === "invalid"
      ? heldPrefixResolution.reason
      : null;

  return {
    job: state.job,
    review: state.review,
    batchSessions: state.batch ? state.batch.sessions : null,
    batchActiveIndex: state.batch ? state.batch.activeIndex : null,
    structured,
    /**
     * Job-scoped structured output options (REC-04 WU-B, D-022), or `null`
     * while no structured job holds them. Domain state — never label-only —
     * so Configure controls and Export/gate reads share one authority.
     */
    structuredOptions: heldStructuredOptions,
    /**
     * The held raw prefix as its resolved typed discriminated union (SM-2):
     * `valid` carries the effective token, `invalid` carries the exact
     * refusal reason. `null` while no structured job holds options. The
     * invalid state is represented by this resolved value, never a bare
     * re-derived string.
     */
    structuredPrefixResolution: heldPrefixResolution,
    /**
     * Exact invalid-prefix reason for the held raw prefix, or `null` while
     * it resolves — derived from {@link structuredPrefixResolution} at this
     * clean boundary. The preparation blocks with the same reason; the
     * export gate stays closed until the prefix is fixed.
     */
    structuredPrefixInvalid: heldPrefixInvalid,
    /**
     * Job-scoped structured free-text review state (REC-03 WU-C), or `null`
     * while no current processed state exists for this job. The active cell
     * position is the row-major queue index under review (or `null`).
     */
    structuredFreeText:
      freeText !== null && state.job !== null && freeText.jobId === state.job.id
        ? freeText.state
        : null,
    structuredFreeTextActive:
      freeText !== null && state.job !== null && freeText.jobId === state.job.id
        ? freeText.activeCell
        : null,
    create,
    clear,
    navigate,
    advance,
    updatePolicy,
    beginBatchItemRead,
    recordBatchItemRead,
    startReview,
    decide,
    addManual,
    selectDocument,
    /**
     * Batch failure recovery (#78): contextual in-place retry of one
     * retryable failed item against the retained shared context. See the
     * implementation contract above for the fail-closed entry conditions.
     */
    retryBatchItem,
    /** Batch failure recovery (#78): confirmed removal of one failed item. */
    removeBatchItem: removeBatchItemAction,
    /** Batch failure recovery (#78): acknowledgement of one failed item. */
    acknowledgeBatchItemError: acknowledgeBatchItemErrorAction,
    /** Whether the current batch retains the shared retry context (#78). */
    batchRetryContextAvailable,
    runStructuredFreeTextReview,
    selectFreeTextCell,
    installStructuredGrid,
    overrideStructuredColumn,
    overrideStructuredColumnAction,
    selectStructuredPatientId,
    setStructuredStudyIdPrefix,
    setStructuredAddVisitNumber,
    setStructuredColumnDateRole,
  };
}
