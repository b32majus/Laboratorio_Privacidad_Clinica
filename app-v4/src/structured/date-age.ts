/**
 * Structured date/age semantics primitives (Work Order T19 #23, WU-A;
 * SPEC_V4_BATCH_AND_STRUCTURED.md §10, CURRENT_DECISIONS.md D-009/D-010,
 * DEBT STRUCT-006).
 *
 * SPEC §10: "A birth date converted to age uses the clinically relevant
 * reference date when a visit/event date exists." This module owns the pure,
 * policy-free half of that rule: it parses the structured date cells the
 * T18 parsers normalize, derives an age AT THE EVENT from a birth date plus
 * the visit/event date of the SAME row, and provides the per-cell
 * transformation primitives the policy layer (T19 WU-B,
 * `./date-age-policy`) composes. It never consults the current date: there
 * is no `Date.now`, no `new Date()` without explicit UTC arguments, and no
 * timezone-dependent arithmetic anywhere (all calendar math is UTC).
 *
 * Date-cell formats (deliberately narrow, parser-authority aligned):
 *
 * - ISO `YYYY-MM-DD` — the authority format of the T18 structured parsers
 *   (`excel-serial.ts` normalizes Excel serial dates to exactly this shape).
 *   A parser-normalized ISO date flows into these semantics exactly once:
 *   nothing here re-parses or re-normalizes it into another representation.
 * - Numeric day-first `dd/mm/yyyy` / `dd-mm-yyyy` with a 4-digit year — the
 *   Spanish clinical convention the legacy detector and the
 *   `../engine/date-shift` foundation already use (`12/03/1954` is
 *   12 March 1954). 2-digit years are NOT guessed here: a structured cell
 *   with a 2-digit year is `unparsed` content for the reviewer, never a
 *   silently assumed century.
 *
 * Absence is preserved exactly once (STRUCT-009 continuation): a blank cell
 * (`null` / `undefined` / `""`) is `absent` in every result and is never
 * fabricated into a date, an age, or a placeholder. Unparseable CONTENT is
 * never transformed and never silently kept: the policy layer surfaces it
 * as an explicit `review-required` disposition. Contract violations (wrong
 * argument types, non-integer offsets, missing identity/seed) raise the
 * typed {@link StructuredDateAgeError} (D-009 fail-closed).
 *
 * Per-patient shift state: {@link derivePatientDateShiftState} composes the
 * job seed with the patient identity into a deterministic
 * `../engine/date-shift` {@link DateShiftState} — the exact serializable
 * shape `ProcessingContext.options.dateShift` carries (SPEC §7). The
 * composed offset is a pure function of (jobSeed, patientId): consistent
 * for one patient across every row of a job and isolated between patients
 * (T19 acceptance: deterministic across rows/patients). State is frozen;
 * nothing in this module holds mutable cross-patient state.
 *
 * Privacy: this module never logs content, never mutates its input and is
 * Worker-safe (no window/document access anywhere in its module graph).
 */

import { createDateShiftState, shiftDateString, type DateShiftState } from "../engine/date-shift";
import { isBlankCell, type StructuredCell } from "./grid";

/** Cell input accepted by the public semantics functions: a structured cell, or
 * undefined for a structurally missing cell (mirrors `isBlankCell`). */
export type StructuredDateCellInput = StructuredCell | undefined;

/** Machine-readable codes carried by {@link StructuredDateAgeError} (D-009). */
export type StructuredDateAgeErrorCode =
  | "invalid-cell-argument"
  | "invalid-shift-offset"
  | "invalid-job-seed"
  | "invalid-patient-identity";

/** Typed structured date/age failure; carries a machine-readable code. */
export class StructuredDateAgeError extends Error {
  readonly code: StructuredDateAgeErrorCode;

  constructor(code: StructuredDateAgeErrorCode, message: string) {
    super(message);
    this.name = "StructuredDateAgeError";
    this.code = code;
  }
}

/** Source format of a parsed structured date cell. */
export type StructuredDateSourceFormat = "iso" | "numeric-day-first";

/** One validated calendar point parsed from a structured date cell. */
export type ParsedStructuredDate = {
  readonly year: number;
  readonly month: number;
  readonly day: number;
  readonly sourceFormat: StructuredDateSourceFormat;
  /** Original separator of a numeric day-first cell (`/` or `-`). */
  readonly numericSeparator?: "/" | "-";
};

/** Three-state parse result: absence, a parsed date, or unparseable content. */
export type StructuredDateParse =
  | { readonly kind: "absent" }
  | { readonly kind: "parsed"; readonly date: ParsedStructuredDate }
  | { readonly kind: "unparsed" };

/** Disposition of one structured date cell under a transformation. */
export type StructuredDateCellOutcome =
  | { readonly kind: "transformed"; readonly value: string }
  | { readonly kind: "absent" }
  | { readonly kind: "review-required"; readonly reason: string };

/** Disposition of one age-at-event derivation (STRUCT-006). */
export type AgeAtEvent =
  | { readonly kind: "derived"; readonly years: number }
  | { readonly kind: "absent" }
  | { readonly kind: "review-required"; readonly reason: string };

/** Strict ISO `YYYY-MM-DD` (the T18 parser authority format). */
const ISO_DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;

/** Numeric day-first with a 4-digit year (`dd/mm/yyyy` / `dd-mm-yyyy`).
 *  The `\2` backreference requires BOTH separators to be identical: a mixed
 *  separator cell (`12/03-1954`) is malformed and must go to review rather
 *  than be parsed silently (STRUCT-010). */
const NUMERIC_DAY_FIRST_PATTERN = /^(\d{1,2})([/-])(\d{1,2})\2(\d{4})$/;

/** Pads a value to `width` digits. */
function pad(value: number, width: number): string {
  return String(value).padStart(width, "0");
}

/**
 * Builds the UTC calendar day without the `Date.UTC` / constructor year
 * remapping of 0–99 to 1900–1999. `setUTCFullYear` keeps the literal year, so
 * supported 4-digit years `0001`–`0099` are validated and shifted correctly
 * (STRUCT-010) instead of being misclassified as unparsed or remapped.
 */
function utcCalendarDay(year: number, month: number, day: number): Date {
  const date = new Date(0);
  date.setUTCHours(0, 0, 0, 0);
  date.setUTCFullYear(year, month - 1, day);
  return date;
}

/**
 * Validates a real calendar date (rejecting roll-over dates such as
 * `2023-02-30`) with UTC arithmetic only — never the local clock, and never
 * the year remapping of `Date.UTC` for years below 100.
 */
function validateCalendarPoint(
  year: number,
  month: number,
  day: number
): { year: number; month: number; day: number } | null {
  if (!Number.isInteger(year) || !Number.isInteger(month) || !Number.isInteger(day)) return null;
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;
  const date = utcCalendarDay(year, month, day);
  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    return null;
  }
  return { year, month, day };
}

/**
 * Fails closed when a cell argument is not a {@link StructuredCell} at all
 * (objects, functions, symbols…). Absence itself is NOT a contract
 * violation: `null`/`undefined`/`""` are handled as absence by the callers.
 */
function assertCellArgument(cell: StructuredDateCellInput, operation: string): void {
  if (
    cell === null ||
    cell === undefined ||
    typeof cell === "string" ||
    typeof cell === "number" ||
    typeof cell === "boolean"
  ) {
    return;
  }
  throw new StructuredDateAgeError(
    "invalid-cell-argument",
    `${operation} requires a structured cell (string | number | boolean | null); failing closed instead of guessing.`
  );
}

/**
 * Parses one structured date cell into the three-state
 * {@link StructuredDateParse}. Absence (`null`/`undefined`/`""`) is
 * `absent`; an ISO `YYYY-MM-DD` or numeric day-first 4-digit-year cell that
 * names a real calendar date is `parsed`; anything else (other content
 * types, unparseable text, impossible calendar dates, 2-digit years, raw
 * serial numbers that escaped parser normalization) is `unparsed` and MUST
 * be surfaced for review by the caller — never guessed, never silently
 * kept, never silently transformed.
 */
export function parseStructuredDateCell(cell: StructuredDateCellInput): StructuredDateParse {
  assertCellArgument(cell, "parseStructuredDateCell");
  if (isBlankCell(cell)) return { kind: "absent" };
  if (typeof cell !== "string") return { kind: "unparsed" };

  const isoMatch = ISO_DATE_PATTERN.exec(cell.trim());
  if (isoMatch !== null) {
    const point = validateCalendarPoint(
      Number(isoMatch[1]),
      Number(isoMatch[2]),
      Number(isoMatch[3])
    );
    if (point === null) return { kind: "unparsed" };
    return {
      kind: "parsed",
      date: { ...point, sourceFormat: "iso" },
    };
  }

  const numericMatch = NUMERIC_DAY_FIRST_PATTERN.exec(cell.trim());
  if (numericMatch !== null) {
    const point = validateCalendarPoint(
      Number(numericMatch[4]),
      Number(numericMatch[3]),
      Number(numericMatch[1])
    );
    if (point === null) return { kind: "unparsed" };
    return {
      kind: "parsed",
      date: {
        ...point,
        sourceFormat: "numeric-day-first",
        numericSeparator: numericMatch[2] === "/" ? "/" : "-",
      },
    };
  }

  return { kind: "unparsed" };
}

/**
 * Derives the completed-year age AT THE EVENT from a birth date and the
 * clinically relevant visit/event date of the same row (SPEC §10; DEBT
 * STRUCT-006). The current date is NEVER consulted: a missing visit/event
 * date is absence, not a license to measure against today.
 *
 * - either cell absent → `absent` (absence preserved, nothing fabricated);
 * - either cell unparseable → `review-required` (fail-closed, visible);
 * - event date earlier than the birth date → `review-required` (a negative
 *   age is invalid clinical data, never a guessed value);
 * - otherwise → `derived` with the integer completed years at the event.
 */
export function deriveAgeAtEvent(
  birthCell: StructuredDateCellInput,
  eventCell: StructuredDateCellInput
): AgeAtEvent {
  assertCellArgument(birthCell, "deriveAgeAtEvent birth date");
  assertCellArgument(eventCell, "deriveAgeAtEvent event date");

  if (isBlankCell(birthCell) || isBlankCell(eventCell)) return { kind: "absent" };

  const birth = parseStructuredDateCell(birthCell);
  if (birth.kind === "absent") return { kind: "absent" };
  if (birth.kind === "unparsed") {
    return {
      kind: "review-required",
      reason:
        "the birth date is not a parseable structured date; failing closed instead of guessing an age",
    };
  }
  const event = parseStructuredDateCell(eventCell);
  if (event.kind === "absent") return { kind: "absent" };
  if (event.kind === "unparsed") {
    return {
      kind: "review-required",
      reason:
        "the visit/event date is not a parseable structured date; failing closed instead of guessing an age",
    };
  }

  const hadBirthday =
    event.date.month > birth.date.month ||
    (event.date.month === birth.date.month && event.date.day >= birth.date.day);
  const years = event.date.year - birth.date.year - (hadBirthday ? 0 : 1);
  if (years < 0) {
    return {
      kind: "review-required",
      reason:
        "the visit/event date precedes the birth date; failing closed instead of deriving a negative age",
    };
  }
  return { kind: "derived", years };
}

/**
 * Shifts one structured date cell by `offsetDays`, preserving the cell's
 * source format: ISO in → ISO out, numeric day-first in → same separator
 * out. ISO shifting uses UTC arithmetic; numeric day-first shifting reuses
 * the accepted `../engine/date-shift` foundation (`shiftDateString`) so the
 * two formats cannot drift apart.
 *
 * Fail-closed (D-009): a non-integer or out-of-bounds offset raises the
 * typed {@link StructuredDateAgeError}; absence stays absence; unparseable
 * content yields `review-required` — never the original value silently
 * passed through as if transformed.
 */
export function shiftStructuredDateCell(
  cell: StructuredDateCellInput,
  offsetDays: number
): StructuredDateCellOutcome {
  assertCellArgument(cell, "shiftStructuredDateCell");
  if (!Number.isInteger(offsetDays) || Math.abs(offsetDays) > 3650) {
    throw new StructuredDateAgeError(
      "invalid-shift-offset",
      "shiftStructuredDateCell requires an integer offset within ±3650 days; failing closed instead of applying an implausible shift."
    );
  }

  const parse = parseStructuredDateCell(cell);
  if (parse.kind === "absent") return { kind: "absent" };
  if (parse.kind === "unparsed") {
    return {
      kind: "review-required",
      reason:
        "the cell is not a parseable structured date (ISO YYYY-MM-DD or dd/mm/yyyy); failing closed instead of shifting unparseable content",
    };
  }

  if (parse.date.sourceFormat === "iso") {
    const shifted = new Date(
      utcCalendarDay(parse.date.year, parse.date.month, parse.date.day).getTime() +
        offsetDays * 86_400_000
    );
    if (shifted.getUTCFullYear() < 0) {
      return {
        kind: "review-required",
        reason:
          "the shifted ISO date would fall before year 0; failing closed instead of emitting a non-calendar year",
      };
    }
    return {
      kind: "transformed",
      value: `${pad(shifted.getUTCFullYear(), 4)}-${pad(shifted.getUTCMonth() + 1, 2)}-${pad(
        shifted.getUTCDate(),
        2
      )}`,
    };
  }

  // Numeric day-first: delegate to the accepted T13 foundation so the
  // legacy-format shift semantics have exactly one implementation.
  const shifted = shiftDateString((cell as string).trim(), offsetDays);
  if (shifted === null) {
    return {
      kind: "review-required",
      reason:
        "the numeric day-first cell could not be shifted by the accepted date-shift foundation; failing closed",
    };
  }
  return { kind: "transformed", value: shifted };
}

/**
 * Generalizes one structured date cell to month precision, mirroring the
 * accepted legacy `fecha_completa` date-transform output: a numeric
 * day-first cell keeps its separator and drops only the day
 * (`"12/03/1954"` → `"03/1954"`, exactly the legacy operator's output); an
 * ISO cell drops the day in ISO reduced precision (`"1954-03-12"` →
 * `"1954-03"`). Absence stays absence; unparseable content yields
 * `review-required` — never the original exact date passed through.
 */
export function generalizeMonthStructuredDate(
  cell: StructuredDateCellInput
): StructuredDateCellOutcome {
  assertCellArgument(cell, "generalizeMonthStructuredDate");
  const parse = parseStructuredDateCell(cell);
  if (parse.kind === "absent") return { kind: "absent" };
  if (parse.kind === "unparsed") {
    return {
      kind: "review-required",
      reason:
        "the cell is not a parseable structured date (ISO YYYY-MM-DD or dd/mm/yyyy); failing closed instead of generalizing unparseable content",
    };
  }
  if (parse.date.sourceFormat === "iso") {
    return {
      kind: "transformed",
      value: `${pad(parse.date.year, 4)}-${pad(parse.date.month, 2)}`,
    };
  }
  return {
    kind: "transformed",
    value: `${pad(parse.date.month, 2)}${parse.date.numericSeparator ?? "/"}${pad(
      parse.date.year,
      4
    )}`,
  };
}

/**
 * Derives the frozen per-patient {@link DateShiftState} for one structured
 * job: the composed seed is a pure function of the job seed and the patient
 * identity, so one patient keeps ONE consistent offset across every row and
 * every application within the job context, while different patients derive
 * independent states (no shared or mutable cross-patient state anywhere).
 *
 * The returned state is the exact serializable shape
 * `ProcessingContext.options.dateShift` carries (SPEC §7), so it can be
 * threaded into the existing engine seam unchanged.
 *
 * Fail-closed (D-009): a non-string/empty job seed or a blank/non-scalar
 * patient identity raises the typed {@link StructuredDateAgeError}; the
 * caller routes blank patient cells to an explicit review disposition
 * instead of inventing a shared identity.
 */
export function derivePatientDateShiftState(
  jobSeed: string,
  patientCell: StructuredDateCellInput
): DateShiftState {
  if (typeof jobSeed !== "string" || jobSeed.trim().length === 0) {
    throw new StructuredDateAgeError(
      "invalid-job-seed",
      "derivePatientDateShiftState requires a non-empty job seed; failing closed instead of deriving an unseeded shift offset."
    );
  }
  assertCellArgument(patientCell, "derivePatientDateShiftState patient identity");
  if (isBlankCell(patientCell) || typeof patientCell === "boolean") {
    throw new StructuredDateAgeError(
      "invalid-patient-identity",
      "derivePatientDateShiftState requires a non-blank patient identity (string or number); failing closed instead of inventing a shared identity."
    );
  }
  const patientKey = String(patientCell);
  return createDateShiftState(`${jobSeed}\u0000patient\u0000${patientKey}`);
}
