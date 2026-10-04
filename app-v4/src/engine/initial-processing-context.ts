/**
 * Policy-owned initial ProcessingContext seam (REC-02
 * TEXT-POLICY-COMPLETION-01, WU-B).
 *
 * The smallest pure seam that turns `(job identity, policy)` into the initial
 * {@link ProcessingContext} the productive engine consumes. It exists so the
 * product paths (`startReviewSessionAsync`, `runBatchReviewAsync`) can thread
 * the policy-owned context without either duplicating the category→operator
 * mapping table or inventing a second policy engine:
 *
 * - the decision "does this policy need a date-shift state?" is READ from the
 *   existing authority {@link lookupPolicyProfile}: only a policy whose `FECHA`
 *   operator is exactly `v4.date-shift` (`LEGACY_OPERATOR_KEYS.DATE_SHIFT`)
 *   receives `options.dateShift`. Every other policy gets a bare
 *   `{ mode: "fresh" }` context, so Standard/Strict/External AI are byte-for-
 *   byte unaffected.
 * - the shift state itself is created by the existing
 *   {@link createDateShiftState} foundation, seeded ONLY from the Job's
 *   non-PHI identity with explicit domain separation
 *   (`text-policy:<job.id>`). Clinical text, filenames, patient identifiers,
 *   names and dates never contribute: the caller passes nothing but the Job
 *   identity and the policy. The same Job deterministically recreates the same
 *   Job-scoped shift; a new Job receives a new identity and therefore a new
 *   seed.
 * - the returned context is a plain, frozen, JSON-able value (SPEC §7) and the
 *   engine remains the only reader of `options.dateShift` (no ambient globals,
 *   no monkey patches).
 *
 * Fail-closed (D-009): an unknown/malformed policy id raises the typed
 * {@link PolicyError} from {@link lookupPolicyProfile} instead of guessing a
 * context.
 *
 * Privacy/Worker-safety: this module never logs content, touches no DOM/browser
 * global and imports only pure local modules.
 */
import type { Job, PrivacyPolicyId } from "../domain/job";
import { createDateShiftState } from "./date-shift";
import { LEGACY_OPERATOR_KEYS } from "./operator-registry";
import { lookupPolicyProfile } from "./policy";
import type { ProcessingContext } from "./types";

/**
 * Domain-separation prefix for the text/document/batch date-shift seed. Keeps
 * the text-policy shift namespaced away from any other shift seed the app may
 * derive from the same Job identity.
 */
export const TEXT_POLICY_SHIFT_SEED_PREFIX = "text-policy:";

/**
 * The exact Job-scoped, non-PHI seed used for the text-policy date shift. It is
 * a pure function of the Job identity alone (no clinical content), so it is
 * deterministic across runs and distinct per Job.
 */
export function textPolicyDateShiftSeed(jobId: string): string {
  return `${TEXT_POLICY_SHIFT_SEED_PREFIX}${jobId}`;
}

/**
 * Build the initial {@link ProcessingContext} for a Job under `policyId`.
 *
 * Returns `{ mode: "fresh" }` for every policy except the one whose `FECHA`
 * operator is `v4.date-shift`; for that policy it returns a fresh context
 * carrying a Job-scoped `options.dateShift` state. The context is pure (a
 * deterministic function of `job.id` + `policyId`) and is never mutated.
 */
export function createInitialProcessingContext(
  job: Pick<Job, "id">,
  policyId: PrivacyPolicyId
): ProcessingContext {
  const profile = lookupPolicyProfile(policyId);
  if (profile.categoryOperatorKeys.FECHA !== LEGACY_OPERATOR_KEYS.DATE_SHIFT) {
    return Object.freeze({ mode: "fresh" as const });
  }
  return Object.freeze({
    mode: "fresh" as const,
    options: Object.freeze({
      dateShift: createDateShiftState(textPolicyDateShiftSeed(job.id)),
    }),
  });
}
