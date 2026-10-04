/**
 * Structured transformation plan (HARDEN-01 WU-A, issue #47 §A / BATCH-003;
 * REC-03 WU-B D-021 Class→Action authority).
 *
 * The plan is the SINGLE bridge between the reviewed structured configuration
 * and any productive transformation. It is pure and frozen, and it is the only
 * thing a consumer needs to know exactly what will happen to each column.
 * It consumes the configuration's effective productive Action directly —
 * never a re-derived class mapping — so Class and Action stay separate facts
 * end to end.
 *
 * Hard rules (HARDEN-01 decision, 2026-09-30; REC-03 WU-A/WU-B D-021):
 *  - `study-id` is the ONLY disposition of the explicitly selected patient-ID
 *    column: it takes precedence over any other rule, including a date role,
 *    and it is the ONLY column that ever receives that disposition (never
 *    auto-selected).
 *  - `date-policy` is the ONLY thing that activates T19, and only together
 *    with an explicit `visit`/`birth` role; anything else never does.
 *  - `pseudonymize` activates deterministic column-local `QID_###`
 *    tokenization (blanks preserved, mapping Confidential-only); it is
 *    available ONLY as the center/ward proposal or as a bounded explicit
 *    choice on a non-date, non-patient-ID quasi-identifier.
 *  - `process-as-text` activates the productive text-engine path (REC-03
 *    WU-C): each non-blank cell owns a ReviewSession and Safe reads canonical
 *    `getFinalText`. The disposition itself is structurally ready; per-cell
 *    review/failure readiness is checked separately by the dataset builder
 *    (like date/age review outcomes).
 *  - `keep` preserves; `remove` drops the column from the Safe artifact.
 *  - `review-required` (unknown, or a quasi-identifier with no bounded
 *    explicit action) BLOCKS export fail-closed. There is no productive
 *    `generalize` operator for non-date columns and no `codify` user-facing
 *    action: the `generalize-without-operator` reason names exactly that
 *    blocked quasi state, and `unknown-review-required` names the blocked
 *    unknown state.
 *
 * The plan carries NO sensitive cell values: it is structural only.
 */
import type { ColumnClass } from "./classification";
import type {
  StructuredAction,
  StructuredConfiguration,
  StructuredDateRole,
} from "./configuration";
import { resolveStructuredDateAgePolicy, type StructuredDateColumnRole } from "./date-age-policy";
import type { PrivacyPolicyId } from "../domain/job";

/** Why a column cannot be exported safely. */
export type StructuredUnsupportedReason =
  "unknown-review-required" | "generalize-without-operator" | "unsupported-action";

/** The exact disposition of one column in the productive pipeline. */
export type StructuredColumnDisposition =
  | { readonly kind: "date-age"; readonly role: StructuredDateColumnRole }
  | { readonly kind: "study-id" }
  | { readonly kind: "pseudonymize" }
  | { readonly kind: "free-text" }
  | { readonly kind: "keep" }
  | { readonly kind: "remove" }
  | { readonly kind: "unsupported"; readonly reason: StructuredUnsupportedReason };

/** One resolved column in the plan. */
export type StructuredTransformPlanColumn = {
  readonly columnIndex: number;
  readonly header: string;
  readonly effectiveClass: ColumnClass;
  readonly effectiveAction: StructuredAction;
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
  effectiveAction: StructuredAction,
  effectiveClass: ColumnClass,
  role: StructuredDateRole
): StructuredColumnDisposition {
  // D-021 precedence, consumed verbatim from the configuration authority:
  // locked derived actions win, productive bounded choices execute, and
  // `review-required` blocks with the exact reason for its class.
  switch (effectiveAction) {
    case "study-id":
      return { kind: "study-id" };
    case "date-policy":
      if (role === "visit") return { kind: "date-age", role: "visit-date" };
      if (role === "birth") return { kind: "date-age", role: "birth-date" };
      return { kind: "unsupported", reason: "unsupported-action" };
    case "remove":
      return { kind: "remove" };
    case "keep":
      return { kind: "keep" };
    case "pseudonymize":
      return { kind: "pseudonymize" };
    case "process-as-text":
      return { kind: "free-text" };
    case "review-required":
      return {
        kind: "unsupported",
        reason:
          effectiveClass === "unknown" ? "unknown-review-required" : "generalize-without-operator",
      };
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
    effectiveAction: column.effectiveAction,
    dateRole: column.dateRole,
    disposition: dispositionFor(column.effectiveAction, column.effectiveClass, column.dateRole),
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
