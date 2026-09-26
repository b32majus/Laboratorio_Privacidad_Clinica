import { useCallback, useRef, useState } from "react";

import {
  type DecisionExtras,
  type ExplicitDecisionStatus,
  type ManualDetectionInput,
  type ReviewSession,
  addManualDetection,
  applyDecision,
  canFinalize,
  startReviewSession,
} from "./review/review-domain";
import {
  type FlowStep,
  type Job,
  type JobInput,
  type PrivacyPolicyId,
  type ProcessingFailure,
  advanceStep,
  beginProcessing,
  completeProcessing,
  createJob,
  failProcessing,
  goToStep,
  setPolicy,
  withReviewState,
} from "./domain/job";
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
 */
type SessionState = {
  readonly job: Job | null;
  readonly review: ReviewSession | null;
};

const EMPTY_STATE: SessionState = { job: null, review: null };

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

export function useJobSession() {
  const [state, setState] = useState<SessionState>(EMPTY_STATE);
  const stateRef = useRef(state);
  stateRef.current = state;

  const create = useCallback((input: JobInput) => {
    setState({ job: createJob(input), review: null });
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
      return { job: setPolicy(current.job, policyId), review: null };
    });
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
   */
  const startReview = useCallback((): ProcessingFailure | null => {
    const current = stateRef.current;
    if (!current.job || current.review) return null;
    const job = current.job;
    setState((state) => (state.job ? { ...state, job: beginProcessing(state.job) } : state));
    try {
      const review = startReviewSession(job);
      setState((state) =>
        state.job
          ? {
              job: completeProcessing(withDerivedReviewState(state.job, review)),
              review,
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
      if (!current.review) return;
      const review = applyDecision(current.review, id, decision, extras);
      setState({
        job: current.job ? withDerivedReviewState(current.job, review) : null,
        review,
      });
    },
    []
  );

  const addManual = useCallback((detection: ManualDetectionInput) => {
    const current = stateRef.current;
    if (!current.review) return;
    const review = addManualDetection(current.review, detection);
    setState({
      job: current.job ? withDerivedReviewState(current.job, review) : null,
      review,
    });
  }, []);

  return {
    job: state.job,
    review: state.review,
    create,
    clear,
    navigate,
    advance,
    updatePolicy,
    startReview,
    decide,
    addManual,
  };
}
