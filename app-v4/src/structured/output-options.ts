/**
 * Canonical job-scoped structured output-options authority (REC-04 WU-B,
 * D-022 "Study-ID output options").
 *
 * This is the ONLY place that decides how a generated Safe Study ID is
 * formatted and whether the derived `Visita_Num` column exists. The selected
 * patient-ID column remains the single identity authority (SPEC §6): this
 * module configures only token text (`<PREFIX>_001`, … in first-appearance
 * grouping, as built by `study-id.ts`) and the row-order occurrence sequence
 * — it never introduces another patient identity source.
 *
 *  - `studyIdPrefix`: default `PAC`; blank resolves to the default; otherwise
 *    `trim().toUpperCase()` must match `[A-Z][A-Z0-9]{0,9}`. An invalid
 *    non-blank value is an explicit invalid state / typed refusal — never a
 *    silent fallback, never sanitization of arbitrary punctuation or
 *    formula-like input into an accepted token.
 *  - `addVisitNumber`: heritage default enabled when a patient-ID authority
 *    exists; unavailable/effectively absent without one. The sequence is
 *    1-based occurrence per patient in CURRENT INPUT ROW ORDER (never sorted,
 *    never described as chronology inferred from dates).
 *
 * Memory-only (D-013): plain frozen values; nothing here persists, logs or
 * transmits.
 */
import { isBlankCell, type StructuredCell } from "./grid";

/** Heritage default Study-ID prefix (REC-03 format, D-021). */
export const DEFAULT_STUDY_ID_PREFIX = "PAC" as const;

/** The derived Safe visit-sequence header, inserted immediately after `ID_ESTUDIO`. */
export const VISIT_NUMBER_HEADER = "Visita_Num" as const;

/** Accepted normalized prefix vocabulary: `[A-Z][A-Z0-9]{0,9}`. */
const STUDY_ID_PREFIX_PATTERN = /^[A-Z][A-Z0-9]{0,9}$/;

/** Machine-readable codes carried by {@link StructuredOutputOptionsError}. */
export type StructuredOutputOptionsErrorCode = "invalid-prefix";

/** Typed output-options failure (fail-closed option writes). */
export class StructuredOutputOptionsError extends Error {
  readonly code: StructuredOutputOptionsErrorCode;

  constructor(code: StructuredOutputOptionsErrorCode, message: string) {
    super(message);
    this.name = "StructuredOutputOptionsError";
    this.code = code;
  }
}

/**
 * Frozen job-scoped structured output options. `studyIdPrefix` is the raw
 * value as typed (resolved through {@link resolveStudyIdPrefix});
 * `addVisitNumber` is the explicit visit-numbering choice (effective only
 * alongside a patient-ID authority).
 */
export type StructuredOutputOptions = {
  readonly studyIdPrefix: string;
  readonly addVisitNumber: boolean;
};

/**
 * Heritage defaults: `PAC` prefix; visit numbering enabled exactly when a
 * patient-ID authority exists for the Job.
 */
export function createDefaultStructuredOutputOptions(
  hasPatientIdAuthority: boolean
): StructuredOutputOptions {
  return Object.freeze({
    studyIdPrefix: DEFAULT_STUDY_ID_PREFIX,
    addVisitNumber: hasPatientIdAuthority,
  });
}

/** Resolution of one raw prefix value: the effective token or a typed refusal. */
export type StudyIdPrefixResolution =
  | { readonly status: "valid"; readonly prefix: string }
  | { readonly status: "invalid"; readonly reason: string };

/**
 * Resolve one raw Study-ID prefix: blank (or absent) resolves to the heritage
 * default; otherwise the trimmed upper-cased value must match
 * `[A-Z][A-Z0-9]{0,9}`. Anything else is an explicit invalid state — the input
 * is never sanitized into an accepted token.
 */
export function resolveStudyIdPrefix(raw: string | null | undefined): StudyIdPrefixResolution {
  if (raw === null || raw === undefined || raw.trim() === "") {
    return Object.freeze({ status: "valid", prefix: DEFAULT_STUDY_ID_PREFIX });
  }
  const normalized = raw.trim().toUpperCase();
  if (STUDY_ID_PREFIX_PATTERN.test(normalized)) {
    return Object.freeze({ status: "valid", prefix: normalized });
  }
  return Object.freeze({
    status: "invalid",
    reason: `Structured output option "study-ID prefix" is invalid: "${raw.trim()}" must start with a letter and contain only letters and digits (up to 10 characters); fix it instead of exporting with a guessed token.`,
  });
}

/**
 * Store one raw Study-ID prefix choice. Fails closed with a typed
 * `invalid-prefix` error instead of storing an unusable value.
 */
export function setStudyIdPrefix(
  options: StructuredOutputOptions,
  raw: string
): StructuredOutputOptions {
  const resolved = resolveStudyIdPrefix(raw);
  if (resolved.status === "invalid") {
    throw new StructuredOutputOptionsError("invalid-prefix", resolved.reason);
  }
  if (raw === options.studyIdPrefix) return options;
  return Object.freeze({ ...options, studyIdPrefix: raw });
}

/**
 * Store the explicit visit-numbering choice. Without a patient-ID authority
 * the column is unavailable/effectively absent, so enabling coerces to absent
 * (the preparation additionally ignores the flag without an authority).
 */
export function setAddVisitNumber(
  options: StructuredOutputOptions,
  enabled: boolean,
  hasPatientIdAuthority: boolean
): StructuredOutputOptions {
  const effective = hasPatientIdAuthority && enabled;
  if (effective === options.addVisitNumber) return options;
  return Object.freeze({ ...options, addVisitNumber: effective });
}

/**
 * Build the 1-based per-patient occurrence sequence of one patient-ID
 * column's values in CURRENT INPUT ROW ORDER. Repeated originals count
 * 1,2,…; each distinct original restarts at 1; blanks stay `null` (absence)
 * and never consume a sequence number. Pure and frozen; never logs.
 */
export function buildVisitSequence(values: readonly StructuredCell[]): readonly (number | null)[] {
  const counts = new Map<string, number>();
  const sequence: (number | null)[] = [];
  for (const value of values) {
    if (isBlankCell(value)) {
      sequence.push(null);
      continue;
    }
    const original = String(value);
    const next = (counts.get(original) ?? 0) + 1;
    counts.set(original, next);
    sequence.push(next);
  }
  return Object.freeze(sequence);
}
