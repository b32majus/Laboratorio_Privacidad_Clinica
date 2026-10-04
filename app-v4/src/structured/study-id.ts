/**
 * Deterministic in-Job Study-ID mapping (REC-03 WU-A, D-021 Patient identity;
 * REC-04 WU-B, D-022 configurable prefix).
 *
 * Pure domain primitive: distinct non-blank original patient identifiers map
 * to `<PREFIX>_001`, `<PREFIX>_002`, … in first-appearance order; repeated
 * originals reuse the same Study ID. Blank cells are absence: they never
 * enter the mapping and never receive a Study ID (callers materialize them
 * as blank).
 *
 * The prefix configures ONLY token text, never patient grouping or row order:
 * the same input under two prefixes yields identical grouping with different
 * token text. Prefix VALIDATION lives in the output-options authority
 * (`output-options.ts`); this primitive takes an already-resolved prefix and
 * defaults to the heritage `PAC` (deliberately no HMAC/global/cross-Job
 * identity, no seed, no clock, no module state). Memory-only (D-013): no
 * logging, no persistence.
 */
import { isBlankCell, type StructuredCell } from "./grid";
import { DEFAULT_STUDY_ID_PREFIX } from "./output-options";

/** The generated Safe header for the selected patient-ID column (D-021). */
export const STUDY_ID_HEADER = "ID_ESTUDIO" as const;

/** Format one Study ID by 1-based first-appearance sequence (`PAC_001`, …). */
export function formatStudyId(sequence: number, prefix: string = DEFAULT_STUDY_ID_PREFIX): string {
  return `${prefix}_${String(sequence).padStart(3, "0")}`;
}

/** Deterministic in-Job original→Study-ID mapping plus per-row Study IDs. */
export type StudyIdMapping = {
  /** Distinct non-blank original (verbatim) → Study ID, first-appearance order. */
  readonly mapping: ReadonlyMap<string, string>;
  /** Study ID per input value; blank inputs stay `null` (absence). */
  readonly studyIds: readonly (string | null)[];
};

/**
 * Build the deterministic Study-ID mapping of one patient-ID column's values.
 * Pure and frozen; never logs or retains values beyond the returned mapping.
 */
export function buildStudyIdMapping(
  values: readonly StructuredCell[],
  prefix: string = DEFAULT_STUDY_ID_PREFIX
): StudyIdMapping {
  const mapping = new Map<string, string>();
  const studyIds: (string | null)[] = [];

  for (const value of values) {
    if (isBlankCell(value)) {
      studyIds.push(null);
      continue;
    }
    const original = String(value);
    let studyId = mapping.get(original);
    if (studyId === undefined) {
      studyId = formatStudyId(mapping.size + 1, prefix);
      mapping.set(original, studyId);
    }
    studyIds.push(studyId);
  }

  return Object.freeze({ mapping, studyIds: Object.freeze(studyIds) });
}
