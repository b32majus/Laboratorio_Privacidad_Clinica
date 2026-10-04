/**
 * Deterministic in-Job Study-ID mapping (REC-03 WU-A, D-021 Patient identity).
 *
 * Pure domain primitive: distinct non-blank original patient identifiers map
 * to `PAC_001`, `PAC_002`, … in first-appearance order; repeated originals
 * reuse the same Study ID. Blank cells are absence: they never enter the
 * mapping and never receive a Study ID (callers materialize them as blank).
 *
 * Fixed heritage format, deliberately NOT configurable: no prefix option, no
 * `Visita_Num`, no HMAC/global/cross-Job identity (explicit REC-03
 * non-goals). Same input always yields the identical mapping (no seed, no
 * clock, no module state). Memory-only (D-013): no logging, no persistence.
 */
import { isBlankCell, type StructuredCell } from "./grid";

/** The generated Safe header for the selected patient-ID column (D-021). */
export const STUDY_ID_HEADER = "ID_ESTUDIO" as const;

/** Format one Study ID by 1-based first-appearance sequence (`PAC_001`, …). */
export function formatStudyId(sequence: number): string {
  return `PAC_${String(sequence).padStart(3, "0")}`;
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
export function buildStudyIdMapping(values: readonly StructuredCell[]): StudyIdMapping {
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
      studyId = formatStudyId(mapping.size + 1);
      mapping.set(original, studyId);
    }
    studyIds.push(studyId);
  }

  return Object.freeze({ mapping, studyIds: Object.freeze(studyIds) });
}
