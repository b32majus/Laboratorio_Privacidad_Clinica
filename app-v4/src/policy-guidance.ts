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
  available: "Disponible",
  unavailable: "No disponible para este tipo de trabajo",
};

/** Honest note shown before any job exists (no job kind to evaluate). */
export const NO_JOB_AVAILABILITY_NOTE =
  "Cree un trabajo para ver qué políticas están disponibles para su tipo.";

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
    "Perfil de tratamiento estándar aceptado. Las transformaciones que aplica y su disponibilidad dependen del tipo de trabajo.",
  "external-ai":
    "Política de IA externa aceptada. Las transformaciones que aplica y su disponibilidad dependen del tipo de trabajo.",
  "longitudinal-research":
    "Política de investigación longitudinal aceptada. Las transformaciones que aplica y su disponibilidad dependen del tipo de trabajo.",
  strict:
    "Perfil de tratamiento estricto heredado aceptado. Las transformaciones que aplica y su disponibilidad dependen del tipo de trabajo.",
};

const DOCUMENT_GUIDANCE: Readonly<Record<PrivacyPolicyId, string>> = {
  standard:
    "Los nombres se seudonimizan, los identificadores directos se eliminan y las fechas, los lugares y las edades se generalizan.",
  "external-ai":
    "Preparación solo local: las fechas se generalizan a una precisión menor (mes o año) en lugar de conservar intervalos exactos, y los lugares y cuasi-identificadores usan la rama de generalización más estricta. Nada se transmite a un servicio ni a un proveedor de IA externo.",
  "longitudinal-research":
    "Preparación solo local: las fechas se desplazan con un único desfase coherente por trabajo, de modo que se conservan el orden y los intervalos entre fechas vinculadas, y los lugares y cuasi-identificadores usan la rama de generalización más estricta. No concede aprobación de investigación ni autorización de gobernanza.",
  strict:
    "Aplica las mismas transformaciones por categoría que la política Estándar, pero usa la rama de generalización más estricta para lugares y cuasi-identificadores.",
};

const STRUCTURED_GUIDANCE: Readonly<Record<PrivacyPolicyId, string>> = {
  standard: "Las fechas de visita/evento y las fechas de nacimiento se generalizan a nivel de mes.",
  "external-ai":
    "Las fechas de visita/evento se desplazan con un desfase determinista por paciente que conserva el orden y los intervalos de cada paciente; las fechas de nacimiento se convierten en bandas de edad en el evento.",
  "longitudinal-research":
    "El mismo desfase de fecha de visita por paciente y las mismas bandas de edad para las fechas de nacimiento que la política IA externa, conservando la cronología de cada paciente.",
  strict:
    "Las mismas reglas estructuradas de fecha/edad que la política Estándar: las fechas de visita/evento y las de nacimiento se generalizan a nivel de mes.",
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
