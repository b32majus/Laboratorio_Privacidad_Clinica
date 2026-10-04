/**
 * V4 date operators: explicit date-role context windowing and the two
 * accepted date transformations (Work Order T13 #17, WU-B part A).
 *
 * This module completes the T13 date capability started by WU-A
 * (`./date-semantics` classification, `./date-shift` shift state). It owns
 * two separable responsibilities:
 *
 * 1. {@link dateRoleContextWindow} / {@link classifyObservationDateRole}
 *    bridge a raw source offset to WU-A's pure classifier. WU-A classifies
 *    from a context STRING; this module decides which characters of the
 *    document form that string for one date span, using clause boundaries
 *    plus a hard character cap. This keeps label-adjacent cues
 *    (`"Fecha de nacimiento: 12/03/1954"`) while preventing a cue elsewhere
 *    in the document/line from claiming an unrelated date. A cue beyond the
 *    cap deliberately falls back to WU-A's accepted `"unknown"`
 *    classification — never a guess. Structured/CSV column semantics are out
 *    of scope for #17 (T19 owns them).
 * 2. {@link DateGeneralizeOperator} and {@link DateShiftOperator} are accepted
 *    V4 operators selected by the REC-02 policy mapping: `external-ai` maps
 *    `FECHA → v4.date-generalize` (precision generalization: drop the day /
 *    collapse to the year) and `longitudinal-research` maps
 *    `FECHA → v4.date-shift` (consistent shifting so linked records keep
 *    intervals and order). Standard/strict keep `legacy.date-transform`; the
 *    shift operator fails closed when no shift state is threaded.
 *
 * Fail-closed (D-009): malformed arguments raise the typed
 * {@link DateOperatorError}; unparseable date CONTENT raises
 * `unparseable-date`; a missing shift state raises `missing-date-shift-state`
 * instead of silently passing the original date through. A malformed
 * date-shift STATE surfaces the foundation's typed
 * {@link DateShiftError} from `./date-shift` when the state is consumed. The
 * generalization operator NEVER returns the original full date and never KEEP.
 *
 * Privacy: this module never logs content, never mutates its input and is
 * Worker-safe (no window/document access, no `Date.now`, no timezone
 * dependence anywhere in its module graph).
 */

import { classifyDateRole, type DateRole } from "./date-semantics";
import { resolveDateShiftOffset, shiftDateString, type DateShiftState } from "./date-shift";
import {
  assertCoveredType,
  assertObservation,
  assertOperatorContext,
  LEGACY_OPERATOR_KEYS,
  type Operator,
  type OperatorContext,
} from "./operator-registry";
import { type RecognizerObservation } from "./recognizer-registry";

/** Machine-readable codes carried by {@link DateOperatorError} (D-009). */
export type DateOperatorErrorCode =
  | "invalid-date-operator-context"
  | "missing-date-shift-state"
  | "invalid-date-shift-state"
  | "unparseable-date"
  | "unsupported-date-generalization";

/** Typed date-operator failure; carries a machine-readable code. */
export class DateOperatorError extends Error {
  readonly code: DateOperatorErrorCode;

  constructor(code: DateOperatorErrorCode, message: string) {
    super(message);
    this.name = "DateOperatorError";
    this.code = code;
  }
}

/** Max characters of surrounding clause inspected on each side of a date span. */
export const DATE_ROLE_CONTEXT_WINDOW_CHARS = 64;

/**
 * Clause boundary characters. Windowing is deliberately clause-scoped: a cue
 * only counts when it is in the SAME clause as the date.
 */
const CLAUSE_BOUNDARY_CHARS: ReadonlySet<string> = new Set([".", ";", "!", "?", "\n", "\r"]);

/** The only five accepted date roles (mirrors the `DateRole` union). */
const DATE_ROLE_VALUES: readonly DateRole[] = Object.freeze([
  "birth",
  "admission",
  "discharge",
  "future-appointment",
  "unknown",
]);

/**
 * Returns the surrounding text window inspected to classify one date span.
 *
 * The window starts after the nearest preceding clause boundary (exclusive)
 * and ends before the nearest following clause boundary (exclusive), then is
 * further bounded to {@link DATE_ROLE_CONTEXT_WINDOW_CHARS} characters before
 * `start` and after `end`. Clause + cap windowing is deliberate: it keeps
 * label-adjacent cues (`"Fecha de nacimiento: 12/03/1954"`) while preventing
 * a cue elsewhere in the document/line from claiming an unrelated date. A cue
 * beyond the cap deliberately falls back to the accepted `"unknown"`
 * classification (never guessed). Structured/CSV column semantics are out of
 * scope for #17 (T19 owns them).
 *
 * Fail-closed (D-009): a non-string `text`, or `start`/`end` that are not
 * integers with `0 <= start <= end <= text.length`, raises the typed
 * {@link DateOperatorError} instead of silently widening the window.
 */
export function dateRoleContextWindow(text: string, start: number, end: number): string {
  if (
    typeof text !== "string" ||
    !Number.isInteger(start) ||
    !Number.isInteger(end) ||
    start < 0 ||
    end < start ||
    end > text.length
  ) {
    throw new DateOperatorError(
      "invalid-date-operator-context",
      "dateRoleContextWindow requires a string text and integer offsets with 0 <= start <= end <= text.length; failing closed instead of guessing a context window."
    );
  }

  let clauseStart = 0;
  for (let index = start - 1; index >= 0; index -= 1) {
    if (CLAUSE_BOUNDARY_CHARS.has(text.charAt(index))) {
      clauseStart = index + 1;
      break;
    }
  }

  let clauseEnd = text.length;
  for (let index = end; index < text.length; index += 1) {
    if (CLAUSE_BOUNDARY_CHARS.has(text.charAt(index))) {
      clauseEnd = index;
      break;
    }
  }

  const windowStart = Math.max(clauseStart, start - DATE_ROLE_CONTEXT_WINDOW_CHARS);
  const windowEnd = Math.min(clauseEnd, end + DATE_ROLE_CONTEXT_WINDOW_CHARS);
  return text.slice(windowStart, windowEnd);
}

/**
 * Classifies the explicit {@link DateRole} claimed by the clause surrounding
 * one date span. Pure composition of {@link dateRoleContextWindow} and WU-A's
 * {@link classifyDateRole}: it never guesses "visit" and returns `"unknown"`
 * when no explicit non-visit cue is inside the window.
 */
export function classifyObservationDateRole(text: string, start: number, end: number): DateRole {
  return classifyDateRole(dateRoleContextWindow(text, start, end));
}

/**
 * Whether a role is an explicit non-visit role. `"unknown"` means "no
 * explicit non-visit cue", which keeps the accepted existing visit semantics;
 * it is never a guess. Fail-closed (D-009): a value outside the five accepted
 * strings raises the typed {@link DateOperatorError}.
 */
export function hasExplicitNonVisitRole(role: DateRole): boolean {
  if (!DATE_ROLE_VALUES.includes(role)) {
    throw new DateOperatorError(
      "invalid-date-operator-context",
      `hasExplicitNonVisitRole received unrecognized date role "${String(
        role
      )}"; failing closed instead of guessing.`
    );
  }
  return role !== "unknown";
}

/** Shallow structural check for the serializable date-shift state. */
function isValidDateShiftStateShape(candidate: unknown): boolean {
  if (candidate === null || typeof candidate !== "object" || Array.isArray(candidate)) return false;
  const record = candidate as Record<string, unknown>;
  if (typeof record.seed !== "string" || record.seed.trim().length === 0) return false;
  if (!Number.isInteger(record.contextOffsetDays)) return false;
  if (!Array.isArray(record.overrides)) return false;
  for (const entry of record.overrides) {
    if (!Array.isArray(entry) || entry.length !== 2) return false;
    if (typeof entry[0] !== "string" || entry[0].trim().length === 0) return false;
    if (!Number.isInteger(entry[1])) return false;
  }
  return true;
}

/**
 * Resolves the serialized date-shift state carried by
 * `ProcessingContext.options.dateShift` (SPEC §7), or `undefined` when there
 * is no shift intent. This is only a SHALLOW shape validation: deep semantic
 * validation (calendar validity, offset bounds, override bounds) happens when
 * `./date-shift`'s {@link resolveDateShiftOffset} consumes the state.
 *
 * - `undefined` options → `undefined` (nothing to read);
 * - options present but not a non-null, non-array object → typed
 *   `invalid-date-shift-state`;
 * - no own `dateShift` key → `undefined` (no shift intent; nothing changes);
 * - `dateShift` present but not matching
 *   `{ seed: non-empty string; contextOffsetDays: integer; overrides: [string, integer][] }`
 *   → typed `invalid-date-shift-state`.
 */
export function readDateShiftState(
  options: Record<string, unknown> | undefined
): DateShiftState | undefined {
  if (options === undefined) return undefined;

  const candidateOptions: unknown = options;
  if (
    candidateOptions === null ||
    typeof candidateOptions !== "object" ||
    Array.isArray(candidateOptions)
  ) {
    throw new DateOperatorError(
      "invalid-date-shift-state",
      "Processing options must be a non-null, non-array object when present; failing closed instead of guessing date-shift state."
    );
  }

  const record = candidateOptions as Record<string, unknown>;
  if (!Object.prototype.hasOwnProperty.call(record, "dateShift")) return undefined;

  const candidate = record.dateShift;
  if (!isValidDateShiftStateShape(candidate)) {
    throw new DateOperatorError(
      "invalid-date-shift-state",
      "Processing options dateShift must match { seed: non-empty string; contextOffsetDays: integer; overrides: [string, integer][] }; failing closed instead of guessing date-shift state."
    );
  }
  return candidate as DateShiftState;
}

/** Spanish month name (accent-stripped, lower-case) to 1-based month number. */
const MONTH_INDEX: Readonly<Record<string, number>> = Object.freeze({
  enero: 1,
  febrero: 2,
  marzo: 3,
  abril: 4,
  mayo: 5,
  junio: 6,
  julio: 7,
  agosto: 8,
  septiembre: 9,
  octubre: 10,
  noviembre: 11,
  diciembre: 12,
});

/** `dd/mm/yyyy` or `dd-mm-yyyy` (the input's first separator is preserved). */
const FULL_NUMERIC_DATE_PATTERN = /^(\d{1,2})([/-])(\d{1,2})([/-])(\d{2,4})$/;

/** Textual `"18 de diciembre de 2023"` (month word + connector preserved). */
const FULL_TEXTUAL_DATE_PATTERN =
  /^(\d{1,2})(\s+de\s+)([A-Za-zÁÉÍÓÚÜÑáéíóúüñ]+)(\s+(?:de\s+|del\s+)?)(\d{4})$/i;

/** Textual partial `"diciembre de 2023"` (month word precedes the year). */
const PARTIAL_TEXTUAL_DATE_PATTERN = /^([A-Za-zÁÉÍÓÚÜÑáéíóúüñ]+)(\s+(?:de\s+)?)(\d{4})$/i;

/** Same legacy 4-digit year set accepted by js/core/detectors/fechas.js. */
const YEAR_ONLY_PATTERN = /^(19\d{2}|20\d{2}|2100)$/;

/** Strips diacritics and lower-cases for month-name lookup. */
function stripAccentsLower(text: string): string {
  return text
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

/** Left-pads a value to `width` digits. */
function pad(value: number, width: number): string {
  return String(value).padStart(width, "0");
}

/**
 * `fecha_completa` → MONTH precision. Numeric input keeps only month + year
 * (the input's FIRST separator is preserved; a 2-digit year uses the legacy
 * `> 50` → `+1900`, else `+2000` rule). Textual input drops only the day and
 * preserves the caller's month spelling, connector and capitalization.
 * Anything else fails closed.
 */
function generalizeFullDate(text: string): string {
  const numeric = FULL_NUMERIC_DATE_PATTERN.exec(text);
  if (numeric !== null) {
    const month = Number(numeric[3]);
    if (month < 1 || month > 12) {
      throw new DateOperatorError(
        "unparseable-date",
        "fecha_completa month is outside 1–12; failing closed instead of guessing a month precision."
      );
    }
    let year = Number(numeric[5]);
    if (year < 100) year += year > 50 ? 1900 : 2000;
    return `${pad(month, 2)}${numeric[2]}${pad(year, 4)}`;
  }

  const textual = FULL_TEXTUAL_DATE_PATTERN.exec(text);
  if (textual !== null && MONTH_INDEX[stripAccentsLower(textual[3])] !== undefined) {
    return `${textual[3]}${textual[4]}${textual[5]}`;
  }

  throw new DateOperatorError(
    "unparseable-date",
    "fecha_completa text is not a supported full date; failing closed instead of guessing a month precision."
  );
}

/**
 * `fecha_parcial` → YEAR precision. Only a recognized textual month + year
 * (`"diciembre de 2023"`) collapses to the year; a yearless numeric partial
 * such as `03/11` fails closed rather than guessing a year.
 */
function generalizePartialDate(text: string): string {
  const textual = PARTIAL_TEXTUAL_DATE_PATTERN.exec(text);
  if (textual !== null && MONTH_INDEX[stripAccentsLower(textual[1])] !== undefined) {
    return textual[3];
  }
  throw new DateOperatorError(
    "unparseable-date",
    "fecha_parcial text is not a recognized month + year; failing closed instead of guessing a year."
  );
}

/**
 * `ano` → already year precision. This is a documented identity: the value is
 * returned unchanged once it matches the legacy year set. Rewriting a valid
 * year would invent information, so identity is explicit here rather than
 * hidden inside a generic fall-through.
 */
function generalizeYear(text: string): string {
  if (YEAR_ONLY_PATTERN.test(text)) return text;
  throw new DateOperatorError(
    "unparseable-date",
    "ano text is not a legacy 4-digit year (19xx/20xx/2100); failing closed instead of guessing."
  );
}

/**
 * DATE-GENERALIZE — precision generalization for a `FECHA` observation:
 *
 * - subtype `fecha_completa` → month precision (`"12/03/1954"` → `"03/1954"`,
 *   `"18 de diciembre de 2023"` → `"diciembre de 2023"`);
 * - subtype `fecha_parcial` → year precision (`"diciembre de 2023"` →
 *   `"2023"`);
 * - subtype `ano` → documented identity (`"2019"` → `"2019"`).
 *
 * `strictMode` is validated but deliberately NOT consulted: standard and
 * strict share the same date precision mapping. The operator never returns
 * the original full date and never KEEP; unsupported subtypes and
 * unparseable content fail typed.
 */
export class DateGeneralizeOperator implements Operator {
  readonly key = LEGACY_OPERATOR_KEYS.DATE_GENERALIZE;

  apply(observation: RecognizerObservation, context: OperatorContext): string {
    assertObservation(observation);
    assertOperatorContext(context);
    assertCoveredType(observation, this.key, ["FECHA"]);
    // `context.strictMode` is intentionally not consulted: standard and
    // strict share the same date precision mapping (see class JSDoc).

    const text = observation.text.trim();
    if (observation.subtype === "fecha_completa") return generalizeFullDate(text);
    if (observation.subtype === "fecha_parcial") return generalizePartialDate(text);
    if (observation.subtype === "ano") return generalizeYear(text);
    throw new DateOperatorError(
      "unsupported-date-generalization",
      `DateGeneralizeOperator does not support FECHA subtype "${String(
        observation.subtype
      )}"; failing closed instead of guessing a precision.`
    );
  }
}

/**
 * DATE-SHIFT — consistent date shifting for a `FECHA` observation. The shift
 * state must be present in `context.date.shift` (resolved from
 * `ProcessingContext.options.dateShift` by {@link readDateShiftState}); its
 * absence fails closed with `missing-date-shift-state` because no shift state
 * means no consistent shift — never a silent original-date passthrough. A
 * malformed state surfaces the foundation's typed {@link DateShiftError} from
 * `./date-shift`.
 *
 * `shiftDateString` supports exactly WU-A's formats — `dd/mm/yyyy`,
 * `dd-mm-yyyy`, the bare legacy year set (`19xx`/`20xx`/`2100`) and textual
 * `"18 de diciembre de 2023"` — and returns `null` for anything else, which
 * this operator converts to a typed `unparseable-date`; it NEVER silently
 * returns the original date.
 *
 * Because WU-A's resolved default offset is source-date-independent, every
 * non-overridden date in one linked set shifts by the SAME offset, so
 * pairwise intervals and chronological order are preserved by construction.
 */
export class DateShiftOperator implements Operator {
  readonly key = LEGACY_OPERATOR_KEYS.DATE_SHIFT;

  apply(observation: RecognizerObservation, context: OperatorContext): string {
    assertObservation(observation);
    assertOperatorContext(context);
    assertCoveredType(observation, this.key, ["FECHA"]);

    const state = context.date?.shift;
    if (state === undefined) {
      throw new DateOperatorError(
        "missing-date-shift-state",
        "DateShiftOperator requires a date-shift state in context.date.shift; failing closed because no shift state means no consistent shift, never an original-date passthrough."
      );
    }

    const offset = resolveDateShiftOffset(state, observation.text);
    const shifted = shiftDateString(observation.text, offset);
    if (shifted === null) {
      throw new DateOperatorError(
        "unparseable-date",
        "DateShiftOperator supports only dd/mm/yyyy, dd-mm-yyyy, the legacy year set and textual Spanish dates; failing closed instead of returning the original date."
      );
    }
    return shifted;
  }
}
