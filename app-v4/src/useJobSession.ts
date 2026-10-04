import { useCallback, useRef, useState } from "react";

import {
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
  type PrivacyPolicyId,
  type ProcessingFailure,
  advanceStep,
  batchItemStatus,
  batchReviewComplete,
  beginItemProcessing,
  beginItemRead,
  beginProcessing,
  completeProcessing,
  createJob,
  failProcessing,
  goToStep,
  recordItemFailed,
  recordItemProcessed,
  recordItemRead,
  recordItemReviewCompletion,
  setPolicy,
  withReviewState,
} from "./domain/job";
import type { EngineLoader } from "./engine/engine-seam";
import { createInitialProcessingContext } from "./engine/initial-processing-context";
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
 * (T17 #21 SD-6, corrected by CORR-B). `review.complete` remains the domain's
 * single source of truth ({@link batchReviewComplete}: every non-error item is
 * `completed`), so the existing export step gate keeps working unchanged.
 *
 * Output authority (CORR-B): the accepted specification defines NO batch Safe
 * Output format and NO batch-wide Confidential Audit format, so BOTH output
 * flags stay `false` for a document batch regardless of review completion — a
 * completed batch review is a real, separate fact from output availability.
 * In particular, the ACTIVE document's ReviewSession is never presented as a
 * batch-wide Confidential Audit. Single-document/text behavior is owned by
 * {@link withDerivedReviewState} and unchanged.
 */
function withDerivedBatchReviewState(job: Job): Job {
  const complete = batchReviewComplete(job);
  return Object.freeze({
    ...withReviewState(job, { complete }),
    outputs: Object.freeze({
      safeOutputReady: false,
      confidentialAuditReady: false,
    }),
  }) as Job;
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
        carriedContext = {
          mode: "shared",
          pseudonymState: outcome.context.pseudonymState,
          // REC-02 WU-B defect fix: the policy-owned options (for example the
          // Job-scoped `dateShift` state) must survive the promotion to shared
          // mode, not only the pseudonym state.
          ...(outcome.context.options === undefined ? {} : { options: outcome.context.options }),
        };
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

  const create = useCallback((input: JobInput) => {
    setStructured(null);
    setState({ job: createJob(input), review: null, batch: null });
  }, []);

  const clear = useCallback(() => {
    setStructured(null);
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
   * Recompute the canonical structured plan + exact preparation from a
   * reviewed configuration and derive the job's export-gated state in ONE
   * write (HARDEN-01 WU-A). This is the only path that installs structured
   * authority; it is the exact bridge between Configure and the export gate.
   */
  const applyStructuredConfiguration = useCallback(
    (configuration: StructuredConfiguration): void => {
      const job = stateRef.current.job;
      if (!job || job.kind !== "structured") return;
      const plan = buildStructuredTransformPlan(configuration, {
        policyId: job.policyId,
        jobSeed: job.id,
      });
      const preparation = prepareStructuredOutput(configuration, plan);
      setStructured({ jobId: job.id, configuration, plan, preparation });
      setState((current) =>
        current.job
          ? { ...current, job: withDerivedStructuredState(current.job, preparation) }
          : current
      );
    },
    []
  );

  const updatePolicy = useCallback((policyId: PrivacyPolicyId) => {
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
      // the gate in the same transition.
      const plan = buildStructuredTransformPlan(structuredState.configuration, {
        policyId: next.policyId,
        jobSeed: next.id,
      });
      const preparation = prepareStructuredOutput(structuredState.configuration, plan);
      setStructured({
        jobId: next.id,
        configuration: structuredState.configuration,
        plan,
        preparation,
      });
      job = withDerivedStructuredState(next, preparation);
    }
    setState({ job, review: null, batch: null });
  }, []);

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
        setState((state) => (jobStillCurrent() ? { ...state, job: run.job } : state));
        return run.failure;
      }
      const sessions = Object.freeze({ ...run.sessions });
      setState((state) =>
        jobStillCurrent()
          ? {
              job: run.job,
              review: null,
              batch: { sessions, activeIndex: run.activeIndex },
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
    []
  );

  const addManual = useCallback((detection: ManualDetectionInput) => {
    const current = stateRef.current;
    if (current.batch) {
      const activeIndex = current.batch.activeIndex;
      const activeSession = activeIndex === null ? undefined : current.batch.sessions[activeIndex];
      if (activeIndex === null || !current.job || !activeSession) return;
      const review = addManualDetection(activeSession, detection);
      const updatedJob = recordItemReviewCompletion(current.job, activeIndex, canFinalize(review));
      setState({
        job: withDerivedBatchReviewState(updatedJob),
        review: null,
        batch: {
          sessions: Object.freeze({ ...current.batch.sessions, [activeIndex]: review }),
          activeIndex,
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
  }, []);

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
   * Install the canonical structured configuration built from a parsed grid
   * (T20 #24). Refuses to install onto a non-structured job, so the bridge can
   * never attach structured authority to another job family.
   */
  const installStructuredGrid = useCallback(
    (grid: StructuredGrid) => {
      const current = stateRef.current;
      if (!current.job || current.job.kind !== "structured") return;
      applyStructuredConfiguration(createStructuredConfiguration(grid));
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

  /** Set (or clear) the single structured patient-ID column authority. */
  const selectStructuredPatientId = useCallback(
    (header: string | null) => {
      const current = structuredRef.current;
      if (current === null) return;
      applyStructuredConfiguration(selectPatientIdColumn(current.configuration, header));
    },
    [applyStructuredConfiguration]
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

  return {
    job: state.job,
    review: state.review,
    batchSessions: state.batch ? state.batch.sessions : null,
    batchActiveIndex: state.batch ? state.batch.activeIndex : null,
    structured,
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
    installStructuredGrid,
    overrideStructuredColumn,
    overrideStructuredColumnAction,
    selectStructuredPatientId,
    setStructuredColumnDateRole,
  };
}
