/**
 * Job-aware Privacy Policy guidance (issue #56, POLICY-01; D-007/D-009/D-010).
 *
 * This module is the single presentation seam for the Policy workspace. It
 * DERIVES availability from the SAME pure engine authorities the pipeline
 * uses — it never hard-codes a second operator mapping or availability table
 * (the "no second policy engine" boundary):
 *
 * - text / document / document-batch → {@link lookupPolicyProfile}: the policy
 *   resolves ⇒ available; a typed {@link PolicyError} ⇒ not available. Since
 *   REC-02 every accepted policy resolves its own category→operator mapping,
 *   so all four are selectable. Availability stays DERIVED from this authority
 *   (never a second hard-coded table).
 * - structured → {@link resolveStructuredDateAgePolicy}: every accepted policy
 *   resolves, so all four are selectable.
 *
 * The patient-ID requirement is read from the resolved structured profile's
 * `visit-date` action (`shift-per-patient`) — the exact source
 * `transform-plan.ts` uses for `requiresPatientIdForShift`.
 *
 * Copy is factual and job-kind aware. It deliberately stays free of the
 * forbidden claims (anonymity, certification, GDPR/LOPDGDD wording, differential
 * privacy) and of any "External AI sends data out" implication; runtime remains
 * local-only and memory-only under existing authority.
 *
 * Pure/headless: no DOM, no React, no module state. Unit-testable without a
 * rendered tree.
 */
import type { JobKind, PrivacyPolicyId } from "./domain/job";
import { PolicyError, lookupPolicyProfile } from "./engine/policy";
import {
  StructuredDateAgePolicyError,
  resolveStructuredDateAgePolicy,
} from "./structured/date-age-policy";

/** Canonical policy order for the guidance workspace (D-007 vocabulary). */
export const POLICY_IDS: readonly PrivacyPolicyId[] = [
  "standard",
  "external-ai",
  "longitudinal-research",
  "strict",
];

/**
 * Availability of one policy for a resolved job kind. `unknown` is the honest
 * state before a job exists: no job-kind availability is claimed yet.
 */
export type PolicyAvailability = "available" | "unavailable" | "unknown";

/** The exact textual availability states required by the Work Order. */
export const POLICY_AVAILABILITY_LABELS: Readonly<Record<"available" | "unavailable", string>> = {
  available: "Available",
  unavailable: "Not available for this job type yet",
};

/** Honest note shown before any job exists (no job kind to evaluate). */
export const NO_JOB_AVAILABILITY_NOTE =
  "Create a job to see which policies are available for its type.";

function isTypedPolicyFailure(error: unknown): boolean {
  return error instanceof PolicyError || error instanceof StructuredDateAgePolicyError;
}

/**
 * Resolves whether `policyId` is selectable for `jobKind`, asking the owning
 * pure authority:
 *
 * - `null` job kind ⇒ `"unknown"` (no job-kind availability is claimed);
 * - `structured` ⇒ `resolveStructuredDateAgePolicy` succeeds ⇒ available;
 * - text/document/document-batch ⇒ `lookupPolicyProfile` succeeds ⇒ available.
 *
 * Only a TYPED policy failure maps to `"unavailable"`; any other thrown value
 * is re-thrown so a real bug can never masquerade as a product state.
 */
export function isPolicyAvailableForJobKind(
  policyId: PrivacyPolicyId,
  jobKind: JobKind | null
): PolicyAvailability {
  if (jobKind === null) return "unknown";
  try {
    if (jobKind === "structured") resolveStructuredDateAgePolicy(policyId);
    else lookupPolicyProfile(policyId);
    return "available";
  } catch (error) {
    if (isTypedPolicyFailure(error)) return "unavailable";
    throw error;
  }
}

/** Convenience predicate: the policy can be selected through the UI. */
export function isPolicySelectableForJobKind(
  policyId: PrivacyPolicyId,
  jobKind: JobKind | null
): boolean {
  return isPolicyAvailableForJobKind(policyId, jobKind) === "available";
}

/**
 * Whether the resolved structured profile shifts visit/event dates per patient
 * (and therefore requires an explicit patient-ID column). Same authority that
 * `transform-plan.ts` reads for `requiresPatientIdForShift`.
 */
export function requiresPatientIdColumn(policyId: PrivacyPolicyId): boolean {
  return (
    resolveStructuredDateAgePolicy(policyId).actions["visit-date"].kind === "shift-per-patient"
  );
}

/** One rendered guidance entry: identity, derived availability and copy. */
export type PolicyGuidanceEntry = {
  readonly policyId: PrivacyPolicyId;
  readonly availability: PolicyAvailability;
  readonly guidance: string;
  readonly requiresPatientIdColumn: boolean;
};

const GENERIC_GUIDANCE: Readonly<Record<PrivacyPolicyId, string>> = {
  standard:
    "Accepted standard processing profile. The transformations it applies and its availability depend on the job type.",
  "external-ai":
    "Accepted External AI policy. The transformations it applies and its availability depend on the job type; text, document and document-batch processing has no accepted operator mapping yet.",
  "longitudinal-research":
    "Accepted Longitudinal Research policy. The transformations it applies and its availability depend on the job type; text, document and document-batch processing has no accepted operator mapping yet.",
  strict:
    "Accepted legacy strict processing profile. The transformations it applies and its availability depend on the job type.",
};

const DOCUMENT_GUIDANCE: Readonly<Record<PrivacyPolicyId, string>> = {
  standard:
    "Names are pseudonymized, direct identifiers are redacted, and dates, locations and ages are generalized.",
  "external-ai":
    "Not available for text, documents or document batches yet: the text engine has no accepted per-category operator mapping for this policy.",
  "longitudinal-research":
    "Not available for text, documents or document batches yet: the text engine has no accepted per-category operator mapping for this policy.",
  strict:
    "Accepted legacy strict processing profile. On text and documents it applies the same per-category transformations as Standard; select it when a stricter processing profile is required.",
};

const STRUCTURED_GUIDANCE: Readonly<Record<PrivacyPolicyId, string>> = {
  standard: "Visit/event dates and birth dates are generalized to month level.",
  "external-ai":
    "Visit/event dates are shifted by a deterministic per-patient offset that preserves each patient's order and intervals; birth dates become age bands at the event.",
  "longitudinal-research":
    "Same per-patient visit-date shift and age-band birth dates as External AI, keeping each patient's timeline.",
  strict:
    "Same structured date/age rules as Standard: visit/event dates and birth dates are generalized to month level.",
};

function guidanceFor(policyId: PrivacyPolicyId, jobKind: JobKind | null): string {
  if (jobKind === null) return GENERIC_GUIDANCE[policyId];
  return jobKind === "structured" ? STRUCTURED_GUIDANCE[policyId] : DOCUMENT_GUIDANCE[policyId];
}

/**
 * Builds the guidance entries for the current job kind (or for no job yet).
 * Availability, guidance copy and the patient-ID requirement all derive from
 * the authorities above; nothing is hard-coded in the view.
 */
export function buildPolicyGuidance(jobKind: JobKind | null): readonly PolicyGuidanceEntry[] {
  return POLICY_IDS.map((policyId) => {
    const availability = isPolicyAvailableForJobKind(policyId, jobKind);
    return Object.freeze({
      policyId,
      availability,
      guidance: guidanceFor(policyId, jobKind),
      requiresPatientIdColumn:
        jobKind === "structured" &&
        availability === "available" &&
        requiresPatientIdColumn(policyId),
    });
  });
}
