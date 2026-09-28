/**
 * Single patient-ID column authority for V4 structured jobs (T18 #22,
 * SPEC_V4_BATCH_AND_STRUCTURED.md §6, DEBT STRUCT-002).
 *
 * SPEC §6: "There is exactly one selected patient-ID column authority for a
 * structured Job. Do not maintain an independent global selector and separate
 * conflicting per-column PATIENT_ID semantics."
 *
 * Authority model (exactly one, by construction):
 *  - The ONLY thing that can establish the patient-ID authority is the
 *    explicit job-level selection passed here.
 *  - Column classification NEVER confers patient-ID authority: matching
 *    headers are recorded as candidates for the human's explicit choice, but
 *    no candidate is auto-selected (no silent "first match wins").
 *  - A selection that does not name an existing column fails with a typed
 *    error instead of being ignored.
 *
 * Result: zero authority (nothing selected) or exactly one authority (the
 * explicit selection) — never two competing sources.
 */
import { matchesPatientIdHeader, type ColumnClassification } from "./classification";

export type PatientIdResolution =
  | {
      readonly status: "resolved";
      /** The one authoritative patient-ID column (header verbatim from the grid). */
      readonly column: string;
      readonly columnIndex: number;
    }
  | {
      /** No authority exists until the human makes an explicit selection. */
      readonly status: "not-selected";
      /** Header-pattern candidates surfaced for the explicit human choice. */
      readonly candidates: readonly string[];
    }
  | {
      /** The explicit selection does not name an existing column: fail-closed. */
      readonly status: "selection-error";
      readonly message: string;
    };

/**
 * Resolve the single patient-ID authority for a structured job.
 */
export function resolvePatientIdColumn(options: {
  /** Explicit job-level selection; the ONLY authority source. */
  selectedPatientIdColumn?: string | null;
  classifications: readonly ColumnClassification[];
}): PatientIdResolution {
  const { selectedPatientIdColumn, classifications } = options;

  if (selectedPatientIdColumn === undefined || selectedPatientIdColumn === null) {
    const candidates = classifications
      .filter((classification) => matchesPatientIdHeader(classification.column.header))
      .map((classification) => classification.column.header);
    return { status: "not-selected", candidates };
  }

  const index = classifications.findIndex(
    (classification) => classification.column.header === selectedPatientIdColumn
  );
  if (index === -1) {
    return {
      status: "selection-error",
      message: `The selected patient-ID column "${selectedPatientIdColumn}" does not exist in this structured job.`,
    };
  }

  return { status: "resolved", column: selectedPatientIdColumn, columnIndex: index };
}
