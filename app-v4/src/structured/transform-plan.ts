/**
 * Structured transformation plan (HARDEN-01 WU-A, issue #47 §A / BATCH-003).
 *
 * The plan is the SINGLE bridge between the reviewed structured configuration
 * and any productive transformation. It is pure and frozen, and it is the only
 * thing a consumer needs to know exactly what will happen to each column.
 *
 * Hard rules (HARDEN-01 decision, 2026-09-30):
 *  - `dateRole = visit | birth` is the ONLY thing that activates T19; `none`
 *    never does (no inference).
 *  - `codify` is activated ONLY by the accepted action of the reviewed
 *    effective class (`sensitive -> codify`); nothing else.
 *  - `keep` preserves; `remove` drops the column from the Safe artifact.
 *  - Anything without an accepted structured operator (`generalize` without a
 *    date role, `review-required`, any other action) BLOCKS export fail-closed.
 *
 * The plan carries NO sensitive cell values: it is structural only.
 */
import { proposedActionForClass, type ColumnClass } from "./classification";
import type { StructuredConfiguration, StructuredDateRole } from "./configuration";
import { resolveStructuredDateAgePolicy, type StructuredDateColumnRole } from "./date-age-policy";
import type { PrivacyPolicyId } from "../domain/job";

/** Why a column cannot be exported safely. */
export type StructuredUnsupportedReason =
  "unknown-review-required" | "generalize-without-operator" | "unsupported-action";

/** The exact disposition of one column in the productive pipeline. */
export type StructuredColumnDisposition =
  | { readonly kind: "date-age"; readonly role: StructuredDateColumnRole }
  | { readonly kind: "codify" }
  | { readonly kind: "keep" }
  | { readonly kind: "remove" }
  | { readonly kind: "unsupported"; readonly reason: StructuredUnsupportedReason };

/** One resolved column in the plan. */
export type StructuredTransformPlanColumn = {
  readonly columnIndex: number;
  readonly header: string;
  readonly effectiveClass: ColumnClass;
  readonly dateRole: StructuredDateRole;
  readonly disposition: StructuredColumnDisposition;
};

/** Options required to resolve the plan (both come from the frozen Job). */
export type StructuredTransformPlanOptions = {
  readonly policyId: PrivacyPolicyId;
  readonly jobSeed: string;
};

/** Frozen, structural transformation plan for one structured job. */
export type StructuredTransformPlan = {
  readonly policyId: PrivacyPolicyId;
  readonly jobSeed: string;
  readonly patientIdColumn: string | null;
  readonly columns: readonly StructuredTransformPlanColumn[];
  /** Column indices with an `unsupported` disposition (export blockers). */
  readonly blockingColumns: readonly number[];
  /** True when the resolved policy shifts visit dates per patient. */
  readonly requiresPatientIdForShift: boolean;
  /** True when that policy requires a patient-ID column that is not selected. */
  readonly missingPatientId: boolean;
  /**
   * Structural readiness: every column has an exportable disposition and the
   * patient-ID authority is present when the policy needs it. Per-cell
   * date/age review outcomes are checked separately by the dataset builder.
   */
  readonly dispositionsReady: boolean;
};

function dispositionFor(
  effectiveClass: ColumnClass,
  role: StructuredDateRole
): StructuredColumnDisposition {
  if (role === "visit") return { kind: "date-age", role: "visit-date" };
  if (role === "birth") return { kind: "date-age", role: "birth-date" };
  switch (proposedActionForClass(effectiveClass)) {
    case "codify":
      return { kind: "codify" };
    case "keep":
      return { kind: "keep" };
    case "remove":
      return { kind: "remove" };
    case "generalize":
      return { kind: "unsupported", reason: "generalize-without-operator" };
    case "review-required":
      return { kind: "unsupported", reason: "unknown-review-required" };
    default:
      return { kind: "unsupported", reason: "unsupported-action" };
  }
}

/**
 * Build the frozen transformation plan of a reviewed configuration.
 *
 * Fails closed with the typed T19 `StructuredDateAgePolicyError` for an unknown
 * policy id; the plan itself never guesses a policy.
 */
export function buildStructuredTransformPlan(
  configuration: StructuredConfiguration,
  options: StructuredTransformPlanOptions
): StructuredTransformPlan {
  if (typeof options.jobSeed !== "string" || options.jobSeed.trim().length === 0) {
    throw new Error(
      "buildStructuredTransformPlan requires a non-empty deterministic job seed; failing closed."
    );
  }
  const profile = resolveStructuredDateAgePolicy(options.policyId);

  const columns: StructuredTransformPlanColumn[] = configuration.columns.map((column) => ({
    columnIndex: column.columnIndex,
    header: column.header,
    effectiveClass: column.effectiveClass,
    dateRole: column.dateRole,
    disposition: dispositionFor(column.effectiveClass, column.dateRole),
  }));

  const blockingColumns = columns
    .filter((column) => column.disposition.kind === "unsupported")
    .map((column) => column.columnIndex);

  const requiresPatientIdForShift = profile.actions["visit-date"].kind === "shift-per-patient";
  const patientIdColumn =
    configuration.patientId.status === "resolved" ? configuration.patientId.column : null;
  const missingPatientId = requiresPatientIdForShift && patientIdColumn === null;

  return Object.freeze({
    policyId: profile.policyId,
    jobSeed: options.jobSeed,
    patientIdColumn,
    columns: Object.freeze(columns),
    blockingColumns: Object.freeze(blockingColumns),
    requiresPatientIdForShift,
    missingPatientId,
    dispositionsReady: blockingColumns.length === 0 && !missingPatientId,
  });
}
