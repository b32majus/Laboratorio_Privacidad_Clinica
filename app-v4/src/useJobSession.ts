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
  startReviewSession,
} from "./review/review-domain";
import {
  type BatchItemReadOutcome,
  type FlowStep,
  type Job,
  type JobInput,
  type PrivacyPolicyId,
  type ProcessingFailure,
  advanceStep,
  batchHasErrorItems,
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
import { createRegistryEngine } from "./engine/registry-engine";
import type { ProcessingContext } from "./engine/types";
import { classifyProcessingFailure } from "./processing-outcome";

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
 * (T17 #21 SD-6). `review.complete` is the domain's single source of truth
 * ({@link batchReviewComplete}: every non-error item is `completed`), so the
 * existing export step gate keeps working unchanged. `safeOutputReady`
 * ADDS the error-items conjunction here — a failed document blocks the batch
 * output, because silently excluding it would hide a failed item (D-011).
 * The confidential audit becomes available once the processing attempt ran.
 */
function withDerivedBatchReviewState(job: Job): Job {
  const complete = batchReviewComplete(job);
  return Object.freeze({
    ...withReviewState(job, { complete }),
    outputs: Object.freeze({
      safeOutputReady: complete && !batchHasErrorItems(job),
      confidentialAuditReady: true,
    }),
  }) as Job;
}

/** Engine factory seam: the registry engine is the only production engine. */
type BatchEngineFactory = () => ReturnType<typeof createRegistryEngine>;

/**
 * Per-item outcome callbacks for {@link runBatchReview}. Production callers
 * pass nothing; deterministic oracles may observe each item transition.
 */
export type BatchReviewRunOptions = {
  readonly engineFactory?: BatchEngineFactory;
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
 * or `error` on a classified failure. A failure is recorded and the loop
 * CONTINUES so later documents still process (SD-4). The first item runs
 * `mode: "fresh"`; every success PROMOTES the engine's returned context to
 * `mode: "shared"` for the next item (passing it as `"fresh"` would reset the
 * pseudonym counters). A failed item contributes NOTHING to the carried
 * context, so cross-document consistency survives a mid-batch failure.
 *
 * The returned job has `completeProcessing` applied and the batch review state
 * derived in one place; `engineFactory` is an oracle-only seam and production
 * callers pass nothing. Any unexpected throw outside the per-item catch is
 * classified and recorded with `failProcessing`, mirroring the single path.
 */
export function runBatchReview(job: Job, options: BatchReviewRunOptions = {}): BatchReviewRun {
  const engine = (options.engineFactory ?? createRegistryEngine)();
  let working = job;
  const sessions: Record<number, ReviewSession> = {};
  let carriedContext: ProcessingContext = { mode: "fresh" };
  let activeIndex: number | null = null;

  try {
    const totalItems = job.source.type === "files" ? job.source.files.length : 0;
    for (let index = 0; index < totalItems; index += 1) {
      if (batchItemStatus(working, index) !== "queued") continue;
      options.onItemStart?.(index);
      working = beginItemProcessing(working, index);
      const outcome = processBatchItem(working, index, carriedContext, engine);
      if (outcome.ok) {
        working = recordItemProcessed(working, index);
        sessions[index] = outcome.session;
        if (activeIndex === null) activeIndex = index;
        carriedContext = {
          mode: "shared",
          pseudonymState: outcome.context.pseudonymState,
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

  const create = useCallback((input: JobInput) => {
    setState({ job: createJob(input), review: null, batch: null });
  }, []);

  const clear = useCallback(() => {
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

  const updatePolicy = useCallback((policyId: PrivacyPolicyId) => {
    setState((current) => {
      if (!current.job) return current;
      if (current.job.policyId === policyId) return current;
      // PR #40 corrective C2: a REAL policy change invalidates any existing
      // ReviewSession in the same atomic write — the domain transition
      // resets the derived review/output state and the bridge drops the
      // stale session, which is recreated under the new policy the next
      // time the Review step is entered.
      // T17 #21 SD-8: for a batch the domain also returns non-error items to
      // `queued`, so every per-item session is dropped in the same write.
      return { job: setPolicy(current.job, policyId), review: null, batch: null };
    });
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
  const startReview = useCallback((): ProcessingFailure | null => {
    const current = stateRef.current;
    if (!current.job || current.review || current.batch) return null;
    const job = current.job;

    if (job.kind === "document-batch") {
      const begun = beginProcessing(job);
      setState((state) => (state.job ? { ...state, job: begun } : state));
      const run = runBatchReview(begun);
      if (!run.ok) {
        setState((state) => (state.job ? { ...state, job: run.job } : state));
        return run.failure;
      }
      const sessions = Object.freeze({ ...run.sessions });
      setState((state) =>
        state.job
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
      const review = startReviewSession(job);
      setState((state) =>
        state.job
          ? {
              job: completeProcessing(withDerivedReviewState(state.job, review)),
              review,
              batch: null,
            }
          : state
      );
      return null;
    } catch (error) {
      const failure = classifyProcessingFailure(error);
      setState((state) =>
        state.job ? { ...state, job: failProcessing(state.job, failure) } : state
      );
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

  return {
    job: state.job,
    review: state.review,
    batchSessions: state.batch ? state.batch.sessions : null,
    batchActiveIndex: state.batch ? state.batch.activeIndex : null,
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
  };
}
