/**
 * V4 consistent date-shift foundation (Work Order T13 #17, WU-A).
 *
 * SPEC_V4_PRIVACY_ENGINE.md §7 lists "date-shift seed/offset state" as
 * explicit {@link ProcessingContext} state, and §9/CURRENT_DECISIONS.md
 * D-010 require *consistent* date shifting when longitudinal intervals
 * matter, instead of destroying chronology under a generic "Visit N". This
 * module owns the pure, policy-free foundation for that capability: the
 * serializable shift state, its deterministic derivation, the override
 * mechanism and a same-format `dateText` shifter. It performs no detection,
 * no policy choice and no I/O.
 *
 * Resolved shift semantics (T13 #17 WU-A, implemented exactly):
 *
 * - DEFAULT (context-stable): one offset per seed. Every date in a linked
 *   set shifts by the same `contextOffsetDays`, which is derived
 *   deterministically from the seed alone. Pairwise order and exact day
 *   intervals are therefore preserved by construction. This is the
 *   interpreter of SPEC §7 "date-shift seed/offset state" and SPEC §9
 *   "consistent date shifting" for #17 "stable shift for linked records" /
 *   "longitudinal interval preservation test for shift mode".
 * - OVERRIDES (explicit caller intent): `overrides` records per-source-date
 *   offsets chosen explicitly by the caller, keyed by the normalized source
 *   date. {@link withDateShiftOverride} is the ONLY way to add one; there is
 *   never any silent per-date randomization. An override is a documented
 *   caller decision that intentionally breaks interval preservation for that
 *   date (whose source-date key is normalized, so `12/03/1954` and
 *   `12-03-1954` resolve to the same override).
 * - {@link resolveDateShiftOffset} returns the recorded override for a
 *   source date when present, else the single `contextOffsetDays`.
 *
 * {@link deriveStableOffset} exists as an opt-in per-date helper for future
 * use ONLY. It is NOT the resolved default: because it derives a different
 * offset per source date, it is explicitly NOT interval-preserving and must
 * not be used to shift a linked longitudinal set. Its JSDoc repeats that
 * warning at the call site.
 *
 * `shiftDateString` parses ONLY the formats the legacy pipeline
 * detects/transforms — `dd/mm/yyyy`, `dd-mm-yyyy`, the bare 4-digit year set
 * the legacy detector accepts (`19xx`/`20xx`/`2100`) and textual
 * `"18 de diciembre de 2023"` — and returns the shifted date in the SAME
 * format, or `null` when the input is not one of those formats / is not a
 * real calendar date. Malformed argument TYPES fail closed with the typed
 * {@link DateShiftError} (D-009); malformed date CONTENT returns `null`.
 *
 * Privacy: this module never logs content, never mutates its input and is
 * Worker-safe (no window/document access, no timezone/DST dependence — all
 * arithmetic is UTC-based).
 */

/** One explicit per-source-date override, keyed by normalized source date. */
export type DateShiftOverride = readonly [sourceDateKey: string, offsetDays: number];

/**
 * Serializable date-shift state threaded through the explicit
 * {@link ProcessingContext} (SPEC §7). Plain, frozen, JSON-able.
 */
export type DateShiftState = {
  /** Seed used verbatim to derive {@link DateShiftState.contextOffsetDays}. */
  readonly seed: string;
  /** Single context-stable offset (days) shared by every non-overridden date. */
  readonly contextOffsetDays: number;
  /** Explicit caller per-source-date offsets (normalized source-date keyed). */
  readonly overrides: readonly DateShiftOverride[];
};

/** Largest absolute offset (days, ~10 years) accepted for derived/override offsets. */
export const DATE_SHIFT_MAX_OFFSET_DAYS = 3650;

/** Machine-readable codes carried by {@link DateShiftError} (D-009). */
export type DateShiftErrorCode =
  "invalid-seed" | "invalid-source-date" | "invalid-offset" | "invalid-date-shift-state";

/** Typed date-shift failure; carries a machine-readable code. */
export class DateShiftError extends Error {
  readonly code: DateShiftErrorCode;

  constructor(code: DateShiftErrorCode, message: string) {
    super(message);
    this.name = "DateShiftError";
    this.code = code;
  }
}

/** Deep freeze used for the returned state, mirroring the legacy freezeDeep precedent. */
function deepFreeze<T>(value: T): T {
  if (value !== null && typeof value === "object") {
    for (const entry of Object.values(value as Record<string, unknown>)) deepFreeze(entry);
    Object.freeze(value);
  }
  return value;
}

/** 32-bit FNV-1a over UTF-16 code units; pure integer hash, no crypto. */
function fnv1a32(input: string): number {
  let hash = 0x811c9dc5;
  for (let index = 0; index < input.length; index += 1) {
    hash ^= input.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash >>> 0;
}

/** Maps a 32-bit hash deterministically into [-MAX, +MAX] days. */
function offsetFromHash(hash: number): number {
  const span = DATE_SHIFT_MAX_OFFSET_DAYS * 2 + 1;
  return (hash % span) - DATE_SHIFT_MAX_OFFSET_DAYS;
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

/** Canonical Spanish month names, indexed by 1-based month. */
const MONTH_NAMES: readonly string[] = Object.freeze([
  "enero",
  "febrero",
  "marzo",
  "abril",
  "mayo",
  "junio",
  "julio",
  "agosto",
  "septiembre",
  "octubre",
  "noviembre",
  "diciembre",
]);

/** Same legacy 4-digit year set accepted by js/core/detectors/fechas.js. */
const YEAR_ONLY_PATTERN = /^(19\d{2}|20\d{2}|2100)$/;

/** `dd/mm/yyyy` or `dd-mm-yyyy` (each separator preserved independently). */
const NUMERIC_DATE_PATTERN = /^(\d{1,2})([/-])(\d{1,2})([/-])(\d{2,4})$/;

/** Textual `"18 de diciembre de 2023"` (month word and connector preserved). */
const TEXTUAL_DATE_PATTERN =
  /^(\d{1,2})(\s+de\s+)([A-Za-zÁÉÍÓÚÜÑáéíóúüñ]+)(\s+(?:de\s+|del\s+)?)(\d{4})$/i;

/** One validated calendar point (month/day are 1-based). */
type DatePoint = {
  readonly year: number;
  readonly month: number;
  readonly day: number;
  readonly yearOnly: boolean;
};

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

/** Reproduces the caller's digit width when re-emitting day/month fields. */
function padLike(original: string, value: number): string {
  return original.length >= 2 ? pad(value, original.length) : String(value);
}

/** Re-emits the shifted month name preserving the caller's capitalization. */
function monthNameLike(original: string, month: number): string {
  const canonical = MONTH_NAMES[month - 1];
  if (original === original.toUpperCase() && original !== original.toLowerCase()) {
    return canonical.toUpperCase();
  }
  if (original.charAt(0) === original.charAt(0).toUpperCase()) {
    return canonical.charAt(0).toUpperCase() + canonical.slice(1);
  }
  return canonical;
}

/**
 * Validates a real calendar date (rejecting roll-over dates such as
 * `31/02/2024`) and applies the legacy 2-digit-year rule
 * (`< 100` → `+1900` when `> 50`, else `+2000`).
 */
function validatePoint(
  year: number,
  month: number,
  day: number,
  yearOnly: boolean
): DatePoint | null {
  if (!Number.isInteger(year) || !Number.isInteger(month) || !Number.isInteger(day)) return null;
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;
  const date = new Date(Date.UTC(year, month - 1, day));
  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    return null;
  }
  return { year, month, day, yearOnly };
}

/** Parses one of the supported date formats into a validated calendar point. */
function parseDatePoint(dateText: string): DatePoint | null {
  const trimmed = dateText.trim();

  const yearMatch = YEAR_ONLY_PATTERN.exec(trimmed);
  if (yearMatch !== null) {
    return validatePoint(Number(yearMatch[1]), 1, 1, true);
  }

  const numericMatch = NUMERIC_DATE_PATTERN.exec(trimmed);
  if (numericMatch !== null) {
    let year = Number(numericMatch[5]);
    if (year < 100) year += year > 50 ? 1900 : 2000;
    return validatePoint(year, Number(numericMatch[3]), Number(numericMatch[1]), false);
  }

  const textualMatch = TEXTUAL_DATE_PATTERN.exec(trimmed);
  if (textualMatch !== null) {
    const month = MONTH_INDEX[stripAccentsLower(textualMatch[3])];
    if (month === undefined) return null;
    return validatePoint(Number(textualMatch[5]), month, Number(textualMatch[1]), false);
  }

  return null;
}

/**
 * Normalizes a source date to the override/derivation key: canonical
 * `YYYY-MM-DD` for a full date, `YYYY` for a bare year, or a trimmed,
 * whitespace-collapsed, lower-cased raw string for anything else. Different
 * accepted formats of the same calendar day therefore share one key.
 */
function normalizeSourceDateKey(dateText: string): string {
  const point = parseDatePoint(dateText);
  if (point !== null) {
    if (point.yearOnly) return String(point.year);
    return `${pad(point.year, 4)}-${pad(point.month, 2)}-${pad(point.day, 2)}`;
  }
  return dateText.trim().replace(/\s+/g, " ").toLowerCase();
}

/** Fails closed when a source date is not a non-blank string. */
function assertSourceDate(sourceDate: string): void {
  if (typeof sourceDate !== "string" || sourceDate.trim().length === 0) {
    throw new DateShiftError(
      "invalid-source-date",
      "Date shift requires a non-empty source date string; failing closed instead of guessing a key."
    );
  }
}

/** Validates + normalizes a source date to its override key. */
function sourceDateKey(sourceDate: string): string {
  assertSourceDate(sourceDate);
  return normalizeSourceDateKey(sourceDate);
}

/** Fails closed on non-integer day offsets. */
function assertIntegerDays(value: number, label: string): void {
  if (!Number.isInteger(value)) {
    throw new DateShiftError(
      "invalid-offset",
      `${label} must be a finite integer number of days; failing closed instead of guessing a fractional offset.`
    );
  }
}

/** Fails closed on non-integer or out-of-range day offsets. */
function assertBoundedDays(value: number, label: string): void {
  assertIntegerDays(value, label);
  if (Math.abs(value) > DATE_SHIFT_MAX_OFFSET_DAYS) {
    throw new DateShiftError(
      "invalid-offset",
      `${label} must stay within ±${DATE_SHIFT_MAX_OFFSET_DAYS} days; failing closed instead of applying an implausible shift.`
    );
  }
}

/** Fails closed when a state does not match the serializable {@link DateShiftState} shape. */
function assertDateShiftState(state: DateShiftState): void {
  const candidate: unknown = state;
  if (candidate === null || typeof candidate !== "object") {
    throw new DateShiftError(
      "invalid-date-shift-state",
      "Date shift state must be a plain object; failing closed instead of guessing."
    );
  }
  const record = candidate as Record<string, unknown>;
  if (typeof record.seed !== "string" || record.seed.trim().length === 0) {
    throw new DateShiftError(
      "invalid-date-shift-state",
      "Date shift state requires a non-empty string seed; failing closed instead of guessing."
    );
  }
  if (
    !Number.isInteger(record.contextOffsetDays) ||
    Math.abs(record.contextOffsetDays as number) > DATE_SHIFT_MAX_OFFSET_DAYS
  ) {
    throw new DateShiftError(
      "invalid-date-shift-state",
      `Date shift state requires an integer context offset within ±${DATE_SHIFT_MAX_OFFSET_DAYS} days; failing closed.`
    );
  }
  if (!Array.isArray(record.overrides)) {
    throw new DateShiftError(
      "invalid-date-shift-state",
      "Date shift state requires an overrides array; failing closed instead of guessing."
    );
  }
  for (const entry of record.overrides) {
    if (
      !Array.isArray(entry) ||
      entry.length !== 2 ||
      typeof entry[0] !== "string" ||
      entry[0].trim().length === 0 ||
      !Number.isInteger(entry[1]) ||
      Math.abs(entry[1] as number) > DATE_SHIFT_MAX_OFFSET_DAYS
    ) {
      throw new DateShiftError(
        "invalid-date-shift-state",
        "Date shift override entries must be [sourceDateKey, integerOffsetDays] within the accepted bounds; failing closed."
      );
    }
  }
}

/** Derives the single context-stable offset for a seed (bounded, deterministic). */
function contextOffsetForSeed(seed: string): number {
  return offsetFromHash(fnv1a32(`context\u0000${seed}`));
}

/**
 * Creates the frozen default shift state for `seed`. The single
 * `contextOffsetDays` is a pure function of the seed alone and lies within
 * ±{@link DATE_SHIFT_MAX_OFFSET_DAYS}; `overrides` starts empty. Two calls
 * with the same seed always return equal state.
 */
export function createDateShiftState(seed: string): DateShiftState {
  if (typeof seed !== "string" || seed.trim().length === 0) {
    throw new DateShiftError(
      "invalid-seed",
      "Date shift requires a non-empty string seed; failing closed instead of guessing a context offset."
    );
  }
  return deepFreeze({
    seed,
    contextOffsetDays: contextOffsetForSeed(seed),
    overrides: [] as readonly DateShiftOverride[],
  });
}

/**
 * OPT-IN per-date helper for future use ONLY. Deterministically derives a
 * bounded offset from `seed` + normalized `sourceDate`.
 *
 * WARNING — NOT INTERVAL-PRESERVING: a different source date normally yields
 * a different offset, so applying it across a linked set changes pairwise day
 * intervals. It is NOT the resolved default for SPEC §9 consistent shifting;
 * use {@link resolveDateShiftOffset} (one context-stable offset) for that.
 */
export function deriveStableOffset(seed: string, sourceDate: string): number {
  if (typeof seed !== "string" || seed.trim().length === 0) {
    throw new DateShiftError(
      "invalid-seed",
      "deriveStableOffset requires a non-empty string seed; failing closed instead of guessing."
    );
  }
  const key = sourceDateKey(sourceDate);
  return offsetFromHash(fnv1a32(`per-date\u0000${seed}\u0000${key}`));
}

/**
 * Returns a NEW frozen state with an explicit per-source-date override set
 * (replacing any existing override for the same normalized key, else
 * appending). Pure: the input state is never mutated. The override is an
 * explicit caller choice and intentionally takes precedence over the
 * context-stable offset for that date; it is never silent randomization.
 */
export function withDateShiftOverride(
  state: DateShiftState,
  sourceDate: string,
  offsetDays: number
): DateShiftState {
  assertDateShiftState(state);
  const key = sourceDateKey(sourceDate);
  assertBoundedDays(offsetDays, "Override offset");

  const overrides: DateShiftOverride[] = state.overrides.map(
    (entry) => [entry[0], entry[1]] as const
  );
  const index = overrides.findIndex(([existingKey]) => existingKey === key);
  if (index >= 0) overrides[index] = [key, offsetDays] as const;
  else overrides.push([key, offsetDays] as const);

  return deepFreeze({
    seed: state.seed,
    contextOffsetDays: state.contextOffsetDays,
    overrides,
  });
}

/**
 * Resolves the offset to apply to `sourceDate`: the recorded override when
 * present, otherwise the single context-stable `contextOffsetDays`. Because
 * the default is source-date-independent, all non-overridden dates in a
 * linked set share one offset and keep their exact day intervals and order.
 */
export function resolveDateShiftOffset(state: DateShiftState, sourceDate: string): number {
  assertDateShiftState(state);
  const key = sourceDateKey(sourceDate);
  for (const [existingKey, offset] of state.overrides) {
    if (existingKey === key) return offset;
  }
  return state.contextOffsetDays;
}

/** UTC-based calendar shift; never timezone/DST dependent. */
function shiftPoint(point: DatePoint, offsetDays: number): DatePoint {
  const shifted = new Date(
    Date.UTC(point.year, point.month - 1, point.day) + offsetDays * 86_400_000
  );
  return {
    year: shifted.getUTCFullYear(),
    month: shifted.getUTCMonth() + 1,
    day: shifted.getUTCDate(),
    yearOnly: point.yearOnly,
  };
}

/**
 * Shifts one supported date string by `offsetDays` and returns it in the
 * SAME format, or `null` when the content is not a supported format or not a
 * real calendar date.
 *
 * Supported inputs (mirroring the legacy detect/transform formats):
 * `dd/mm/yyyy`, `dd-mm-yyyy`, the bare legacy year set (`19xx`/`20xx`/`2100`)
 * and textual `"18 de diciembre de 2023"`. Day/month digit width, separator
 * style, the textual `de`/`del` connector and the month name's capitalization
 * style are preserved; a 2-digit year stays 2-digit and a 4-digit year stays
 * 4-digit.
 *
 * Fail-closed (D-009): a non-string `dateText` or a non-integer `offsetDays`
 * raises the typed {@link DateShiftError}; unparseable CONTENT returns
 * `null` and is never guessed or partially rewritten.
 */
export function shiftDateString(dateText: string, offsetDays: number): string | null {
  if (typeof dateText !== "string") {
    throw new DateShiftError(
      "invalid-source-date",
      "shiftDateString requires a string date; failing closed instead of guessing."
    );
  }
  assertIntegerDays(offsetDays, "Shift offset");

  const trimmed = dateText.trim();

  const yearMatch = YEAR_ONLY_PATTERN.exec(trimmed);
  if (yearMatch !== null) {
    const point = validatePoint(Number(yearMatch[1]), 1, 1, true);
    if (point === null) return null;
    const shifted = shiftPoint(point, offsetDays);
    return pad(shifted.year, 4);
  }

  const numericMatch = NUMERIC_DATE_PATTERN.exec(trimmed);
  if (numericMatch !== null) {
    let year = Number(numericMatch[5]);
    if (year < 100) year += year > 50 ? 1900 : 2000;
    const point = validatePoint(year, Number(numericMatch[3]), Number(numericMatch[1]), false);
    if (point === null) return null;
    const shifted = shiftPoint(point, offsetDays);
    const day = padLike(numericMatch[1], shifted.day);
    const month = padLike(numericMatch[3], shifted.month);
    const shiftedYear =
      numericMatch[5].length <= 2 ? pad(shifted.year % 100, 2) : pad(shifted.year, 4);
    return `${day}${numericMatch[2]}${month}${numericMatch[4]}${shiftedYear}`;
  }

  const textualMatch = TEXTUAL_DATE_PATTERN.exec(trimmed);
  if (textualMatch !== null) {
    const month = MONTH_INDEX[stripAccentsLower(textualMatch[3])];
    if (month === undefined) return null;
    const point = validatePoint(Number(textualMatch[5]), month, Number(textualMatch[1]), false);
    if (point === null) return null;
    const shifted = shiftPoint(point, offsetDays);
    const day = padLike(textualMatch[1], shifted.day);
    const monthName = monthNameLike(textualMatch[3], shifted.month);
    return `${day}${textualMatch[2]}${monthName}${textualMatch[4]}${pad(shifted.year, 4)}`;
  }

  return null;
}
