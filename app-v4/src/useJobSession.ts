import { useCallback, useRef, useState } from "react";

import {
  type DecisionExtras,
  type ExplicitDecisionStatus,
  type ManualDetectionInput,
  type ReviewSession,
  addManualDetection,
  applyDecision,
  canFinalize,
} from "./review/review-domain";
import {
  type FlowStep,
  type Job,
  type JobInput,
  type PrivacyPolicyId,
  advanceStep,
  createJob,
  goToStep,
  setPolicy,
  withReviewState,
} from "./domain/job";

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
    setState((current) =>
      current.job ? { ...current, job: setPolicy(current.job, policyId) } : current
    );
  }, []);

  /** Install a freshly created ReviewSession as the job's review authority. */
  const beginReview = useCallback((review: ReviewSession) => {
    setState((current) =>
      current.job ? { job: withDerivedReviewState(current.job, review), review } : current
    );
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
    beginReview,
    decide,
    addManual,
  };
}
