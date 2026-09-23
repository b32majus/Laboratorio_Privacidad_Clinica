import { useCallback, useState } from "react";

import {
  type FlowStep,
  type Job,
  type JobInput,
  type PrivacyPolicyId,
  advanceStep,
  createJob,
  goToStep,
  setPolicy
} from "./domain/job";

/**
 * Small state bridge between the React shell and the pure Job domain model.
 *
 * Separation of concerns (SPEC §3): the domain model owns all job state and
 * is the single authority for transitions; this hook only caches the current
 * frozen Job object in React state. Purely transient UI state (focus, draft
 * input fields, inline error messages) stays in the components.
 */
export function useJobSession() {
  const [job, setJob] = useState<Job | null>(null);

  const create = useCallback((input: JobInput) => {
    setJob(createJob(input));
  }, []);

  const clear = useCallback(() => {
    setJob(null);
  }, []);

  const navigate = useCallback((step: FlowStep) => {
    setJob((current) => (current ? goToStep(current, step) : current));
  }, []);

  const advance = useCallback(() => {
    setJob((current) => (current ? advanceStep(current) : current));
  }, []);

  const updatePolicy = useCallback((policyId: PrivacyPolicyId) => {
    setJob((current) => (current ? setPolicy(current, policyId) : current));
  }, []);

  return { job, create, clear, navigate, advance, updatePolicy };
}
