/**
 * Structured date/age policy semantics (Work Order T19 #23, WU-B;
 * SPEC_V4_BATCH_AND_STRUCTURED.md §10, CURRENT_DECISIONS.md D-007/D-009/
 * D-010, DEBT STRUCT-005).
 *
 * SPEC §10 governs this mapping exactly:
 *
 * - "A birth date converted to age uses the clinically relevant reference
 *   date when a visit/event date exists." (the WU-A
 *   `deriveAgeAtEvent` primitive; the current date is never consulted)
 * - "For external sharing, age/date transformation remains policy-driven
 *   (e.g. band/generalize/shift)."
 * - "VISIT_DATE must not default to exact KEEP under an External AI
 *   policy." (DEBT STRUCT-005)
 *
 * Accepted mapping (implemented exactly; no KEEP action exists in the
 * action vocabulary at all, so an exact date can never be the policy
 * outcome of this layer):
 *
 * | policy                  | visit/event date      | birth date      |
 * |-------------------------|-----------------------|-----------------|
 * | standard / strict       | generalize (month)    | generalize (month) |
 * | external-ai             | shift (per patient)   | band (age at event) |
 * | longitudinal-research   | shift (per patient)   | band (age at event) |
 *
 * Grounds, per row of the table:
 *
 * - `standard`/`strict` mirror the single accepted text-engine FECHA
 *   mapping (`FECHA → legacy.date-transform`, `../policy`), whose
 *   `fecha_completa` output is month precision; the structured generalizer
 *   reproduces that output verbatim for day-first cells and uses ISO month
 *   reduced precision for parser-normalized ISO cells. `standard` and
 *   `strict` deliberately share one date mapping, exactly like the accepted
 *   T13 date operators.
 * - `external-ai`/`longitudinal-research` select the accepted T13
 *   consistent-shift capability (`../engine/date-shift`): one offset per
 *   PATIENT (composed from the job seed and the patient identity), so
 *   every row of one longitudinal patient keeps exact day intervals and
 *   order — the longitudinal meaning SPEC §10 requires — while the exact
 *   visit date is never kept (STRUCT-005). Birth dates under external
 *   sharing convert to the banded age AT THE EVENT using the accepted T12
 *   bands (`generalizeCompletedYears`), per SPEC §10.
 *
 * Fail-closed (D-009): unknown/malformed policy ids fail typed instead of
 * falling back to `standard`; a shift policy without the patient-ID column
 * authority fails typed instead of inventing a shared identity; rows whose
 * patient identity, date content or event reference cannot support the
 * mapped transformation are surfaced as explicit `review-required` cell
 * dispositions with counts — never silently kept, never silently dropped,
 * never fabricated from the current date.
 *
 * Privacy: this module never logs content, never mutates its input and is
 * Worker-safe (no window/document access, no `Date.now`, no timezone
 * dependence anywhere in its module graph).
 */

import { generalizeCompletedYears } from "../engine/age-operator";
import { resolveDateShiftOffset, type DateShiftState } from "../engine/date-shift";
import type { PrivacyPolicyId } from "../domain/job";
import {
  deriveAgeAtEvent,
  derivePatientDateShiftState,
  generalizeMonthStructuredDate,
  shiftStructuredDateCell,
  StructuredDateAgeError,
  type StructuredDateCellInput,
  type StructuredDateCellOutcome,
} from "./date-age";
import { isBlankCell, type StructuredGrid } from "./grid";

/** Structured column roles this policy layer governs. */
export type StructuredDateColumnRole = "visit-date" | "birth-date";

/**
 * The policy actions for structured date/age columns. The union has NO
 * keep/identity member by construction: an exact date or an exact birth
 * date can never be a policy outcome of this layer (STRUCT-005).
 */
export type StructuredDateAgeAction =
  | { readonly kind: "generalize-month" }
  | { readonly kind: "shift-per-patient" }
  | { readonly kind: "age-band" };

/** Frozen per-policy action profile. */
export type StructuredDateAgePolicyProfile = {
  readonly policyId: PrivacyPolicyId;
  readonly actions: Readonly<Record<StructuredDateColumnRole, StructuredDateAgeAction>>;
};

/** Machine-readable codes carried by {@link StructuredDateAgePolicyError}. */
export type StructuredDateAgePolicyErrorCode =
  | "invalid-policy-id"
  | "unknown-policy"
  | "invalid-grid"
  | "unknown-column"
  | "missing-patient-id-column";

/** Typed structured date/age policy failure; carries a machine-readable code. */
export class StructuredDateAgePolicyError extends Error {
  readonly code: StructuredDateAgePolicyErrorCode;

  constructor(code: StructuredDateAgePolicyErrorCode, message: string) {
    super(message);
    this.name = "StructuredDateAgePolicyError";
    this.code = code;
  }
}

/** The full D-007 policy vocabulary (mirrors app-v4/src/domain/job.ts). */
const POLICY_IDS: readonly PrivacyPolicyId[] = [
  "standard",
  "external-ai",
  "longitudinal-research",
  "strict",
];

const GENERALIZE_MONTH: StructuredDateAgeAction = Object.freeze({ kind: "generalize-month" });
const SHIFT_PER_PATIENT: StructuredDateAgeAction = Object.freeze({ kind: "shift-per-patient" });
const AGE_BAND: StructuredDateAgeAction = Object.freeze({ kind: "age-band" });

/**
 * The accepted structured date/age mapping (see module header). Frozen; the
 * mapping is data, so a later accepted policy decision can revise rows
 * without touching the application logic.
 */
const POLICY_ACTIONS: Readonly<Record<PrivacyPolicyId, StructuredDateAgePolicyProfile>> =
  Object.freeze({
    standard: Object.freeze({
      policyId: "standard",
      actions: Object.freeze({ "visit-date": GENERALIZE_MONTH, "birth-date": GENERALIZE_MONTH }),
    }),
    strict: Object.freeze({
      policyId: "strict",
      actions: Object.freeze({ "visit-date": GENERALIZE_MONTH, "birth-date": GENERALIZE_MONTH }),
    }),
    "external-ai": Object.freeze({
      policyId: "external-ai",
      actions: Object.freeze({ "visit-date": SHIFT_PER_PATIENT, "birth-date": AGE_BAND }),
    }),
    "longitudinal-research": Object.freeze({
      policyId: "longitudinal-research",
      actions: Object.freeze({ "visit-date": SHIFT_PER_PATIENT, "birth-date": AGE_BAND }),
    }),
  });

/**
 * Resolves the structured date/age policy profile for `policyId`. Pure and
 * frozen. Fail-closed (D-009): malformed input and ids outside the D-007
 * vocabulary raise the typed {@link StructuredDateAgePolicyError} — there is
 * no fallback to `standard` and no silent identity/KEEP action.
 */
export function resolveStructuredDateAgePolicy(policyId: unknown): StructuredDateAgePolicyProfile {
  if (typeof policyId !== "string" || policyId.length === 0) {
    throw new StructuredDateAgePolicyError(
      "invalid-policy-id",
      "Structured date/age policy id must be a non-empty string; failing closed instead of guessing."
    );
  }
  const profile = (POLICY_ACTIONS as Record<string, StructuredDateAgePolicyProfile | undefined>)[
    policyId
  ];
  if (profile === undefined) {
    throw new StructuredDateAgePolicyError(
      "unknown-policy",
      `Unknown structured date/age policy "${policyId}"; the accepted vocabulary is ${POLICY_IDS.join(
        ", "
      )}. Failing closed instead of falling back to "standard" or keeping the exact dates.`
    );
  }
  return profile;
}

/** Outcome of applying the policy to one selected column. */
export type ColumnApplication = {
  readonly columnIndex: number;
  readonly header: string;
  readonly cells: readonly StructuredDateCellOutcome[];
  /** Explicit per-disposition counts: review-required cells are never hidden. */
  readonly counts: {
    readonly transformed: number;
    readonly absent: number;
    readonly reviewRequired: number;
  };
};

/** Result of applying the structured date/age policy to one grid. */
export type StructuredDateAgeApplication = {
  readonly policyId: PrivacyPolicyId;
  readonly actions: Readonly<Record<StructuredDateColumnRole, StructuredDateAgeAction>>;
  /** Application for the visit/event-date column, or `null` when not selected. */
  readonly visitDate: ColumnApplication | null;
  /** Application for the birth-date column, or `null` when not selected. */
  readonly birthDate: ColumnApplication | null;
  /**
   * One frozen shift state per patient identity encountered (only for
   * shift-per-patient policies). Each state is the exact
   * `ProcessingContext.options.dateShift` payload shape (SPEC §7).
   */
  readonly patientShiftStates: ReadonlyMap<string, DateShiftState>;
};

/** Options of {@link applyStructuredDateAgePolicy}. */
export type StructuredDateAgePolicyOptions = {
  readonly grid: StructuredGrid;
  readonly policyId: PrivacyPolicyId;
  /** Job-context seed for per-patient shift derivation (deterministic). */
  readonly jobSeed: string;
  /** Explicit visit/event-date column selection (header verbatim). */
  readonly visitDateColumn?: string | null;
  /** Explicit birth-date column selection (header verbatim). */
  readonly birthDateColumn?: string | null;
  /**
   * Explicit patient-ID column authority (header verbatim). REQUIRED when
   * the resolved policy shifts visit dates per patient.
   */
  readonly patientIdColumn?: string | null;
};

/** Fails closed when the grid does not carry the normalized T18 shape. */
function assertGrid(grid: unknown): asserts grid is StructuredGrid {
  const candidate = grid as Partial<StructuredGrid> | null;
  if (
    candidate === null ||
    typeof candidate !== "object" ||
    !Array.isArray(candidate.headers) ||
    !Array.isArray(candidate.rows)
  ) {
    throw new StructuredDateAgePolicyError(
      "invalid-grid",
      "applyStructuredDateAgePolicy requires a normalized structured grid (headers + rows); failing closed instead of guessing."
    );
  }
}

/** Resolves one explicit column selection to its index (fail-closed). */
function resolveColumnIndex(
  grid: StructuredGrid,
  selection: string | null | undefined
): number | null {
  if (selection === undefined || selection === null) return null;
  const index = grid.headers.indexOf(selection);
  if (index === -1) {
    throw new StructuredDateAgePolicyError(
      "unknown-column",
      `The selected column "${selection}" does not exist in this structured job (headers: ${grid.headers.join(
        ", "
      )}); failing closed instead of guessing.`
    );
  }
  return index;
}

/** Counts the dispositions of one applied column. */
function countOutcomes(cells: readonly StructuredDateCellOutcome[]): ColumnApplication["counts"] {
  let transformed = 0;
  let absent = 0;
  let reviewRequired = 0;
  for (const cell of cells) {
    if (cell.kind === "transformed") transformed += 1;
    else if (cell.kind === "absent") absent += 1;
    else reviewRequired += 1;
  }
  return { transformed, absent, reviewRequired };
}

/**
 * Applies the accepted structured date/age policy to one normalized grid.
 * Pure and deterministic: the same grid, policy, seed and selections always
 * produce the identical application (per-patient states included), and no
 * module-level state survives the call.
 */
export function applyStructuredDateAgePolicy(
  options: StructuredDateAgePolicyOptions
): StructuredDateAgeApplication {
  const { grid, policyId, jobSeed } = options;
  assertGrid(grid);
  if (typeof jobSeed !== "string" || jobSeed.trim().length === 0) {
    throw new StructuredDateAgePolicyError(
      "invalid-policy-id",
      "applyStructuredDateAgePolicy requires a non-empty job seed for deterministic per-patient shift derivation; failing closed."
    );
  }
  const profile = resolveStructuredDateAgePolicy(policyId);
  const visitIndex = resolveColumnIndex(grid, options.visitDateColumn);
  const birthIndex = resolveColumnIndex(grid, options.birthDateColumn);
  const patientIndex = resolveColumnIndex(grid, options.patientIdColumn);

  const visitAction = profile.actions["visit-date"];
  if (visitAction.kind === "shift-per-patient" && patientIndex === null) {
    throw new StructuredDateAgePolicyError(
      "missing-patient-id-column",
      `Policy "${policyId}" shifts visit dates per patient, which requires the explicit patient-ID column authority; failing closed instead of inventing a shared identity.`
    );
  }

  const patientStates = new Map<string, DateShiftState>();
  const stateFor = (row: readonly StructuredDateCellInput[]): DateShiftState | null => {
    if (patientIndex === null) return null;
    const patientCell = row[patientIndex];
    if (isBlankCell(patientCell)) return null;
    const key = String(patientCell);
    const cached = patientStates.get(key);
    if (cached !== undefined) return cached;
    const derived = derivePatientDateShiftState(jobSeed, patientCell);
    patientStates.set(key, derived);
    return derived;
  };

  let visitApplication: ColumnApplication | null = null;
  if (visitIndex !== null) {
    const cells: StructuredDateCellOutcome[] = grid.rows.map((row) => {
      const cell = row[visitIndex];
      if (visitAction.kind === "generalize-month") {
        return generalizeMonthStructuredDate(cell);
      }
      // shift-per-patient: absence first, then identity, then the shift.
      if (isBlankCell(cell)) return { kind: "absent" };
      const state = stateFor(row);
      if (state === null) {
        return {
          kind: "review-required",
          reason:
            "this row has no patient identity, so no per-patient shift context can be derived; the exact visit date is never silently kept",
        } as const;
      }
      const outcome = shiftStructuredDateCell(cell, resolveDateShiftOffset(state, String(cell)));
      return outcome;
    });
    visitApplication = {
      columnIndex: visitIndex,
      header: grid.headers[visitIndex],
      cells,
      counts: countOutcomes(cells),
    };
  }

  let birthApplication: ColumnApplication | null = null;
  if (birthIndex !== null) {
    const birthAction = profile.actions["birth-date"];
    const cells: StructuredDateCellOutcome[] = grid.rows.map((row) => {
      const birthCell = row[birthIndex];
      if (isBlankCell(birthCell)) return { kind: "absent" };
      if (birthAction.kind === "generalize-month") {
        return generalizeMonthStructuredDate(birthCell);
      }
      // age-band: the visit/event date of the SAME row is the clinically
      // relevant reference (SPEC §10). Without that reference the exact
      // birth date is never silently kept: the cell goes to review.
      if (visitIndex === null) {
        return {
          kind: "review-required",
          reason:
            "no visit/event date column was selected, so the age at the event cannot be derived; the exact birth date is never silently kept",
        } as const;
      }
      const age = deriveAgeAtEvent(birthCell, row[visitIndex]);
      if (age.kind === "derived") {
        return { kind: "transformed", value: generalizeCompletedYears(age.years) } as const;
      }
      if (age.kind === "absent") {
        return {
          kind: "review-required",
          reason:
            "the visit/event date of this row is absent, so the age at the event cannot be derived; the exact birth date is never silently kept",
        } as const;
      }
      return { kind: "review-required", reason: age.reason } as const;
    });
    birthApplication = {
      columnIndex: birthIndex,
      header: grid.headers[birthIndex],
      cells,
      counts: countOutcomes(cells),
    };
  }

  return {
    policyId: profile.policyId,
    actions: profile.actions,
    visitDate: visitApplication,
    birthDate: birthApplication,
    patientShiftStates: patientStates,
  };
}

// Re-exported for callers composing the dispositions with the review layer.
export { StructuredDateAgeError };
