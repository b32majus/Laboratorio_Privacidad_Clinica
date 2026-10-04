/**
 * Workbook header-row detector for V4 structured jobs (REC-04 WU-A, D-022
 * "Workbook header-row authority").
 *
 * Pure, unit-testable authority for XLS/XLSX header-row resolution. CSV keeps
 * its accepted first-record-as-header semantics and never reaches this
 * module. The detector runs over the already normalized cell matrix
 * (StructuredCell values exactly as the Excel authority produces them: date
 * serials already ISO strings, blanks already `null`), so detection and
 * scalar normalization can never disagree.
 *
 * Accepted contract (D-022, implemented exactly):
 *  - inspect at most the first 10 used rows;
 *  - a header candidate has at least 3 non-empty textual cells AND either a
 *    known clinical/header token match (case-insensitive) or more textual
 *    than numeric cells;
 *  - exactly one candidate auto-resolves; zero or multiple candidates return
 *    the typed `header-row-required` state carrying the inspected
 *    candidate/row indices so the existing Configure intake surface can ask
 *    the human explicitly — never a silent fall back to row 1;
 *  - explicit selection is bounded to the inspected rows and validated;
 *    invalid/out-of-range selection fails typed.
 *
 * Row indices are 0-based throughout; the UI renders them 1-based. Only
 * indices are carried — never cell content.
 *
 * Sensitive content is memory-only (D-013): this module never persists,
 * logs, or transmits values, and contains no console.* calls.
 */
import type { StructuredCell } from "./grid";

/** At most this many used rows (from the top) are inspected. */
export const MAX_HEADER_INSPECTION_ROWS = 10;

/** A header candidate needs at least this many non-empty textual cells. */
export const MIN_HEADER_TEXT_CELLS = 3;

/**
 * Accepted v3-derived clinical/header token vocabulary (D-022). Matching is
 * case-insensitive substring matching against the trimmed cell text.
 */
export const HEADER_ROW_TOKENS: readonly string[] = [
  "nhc",
  "nombre",
  "apellido",
  "fecha",
  "dni",
  "paciente",
  "id",
  "codigo",
  "edad",
  "sexo",
  "telefono",
  "email",
  "direccion",
  "centro",
  "medico",
  "diagnostico",
  "procedimiento",
  "visita",
];

/** Normalized cell matrix the detector runs over (row-major, 0-based). */
export type HeaderRowMatrix = readonly (readonly StructuredCell[])[];

/** Inspected candidate/row indices (0-based) plus how many rows were inspected. */
export type HeaderCandidates = {
  readonly candidateRowIndices: readonly number[];
  readonly inspectedRowCount: number;
};

/** Detector outcome: resolved to one row, or explicit human choice required. */
export type HeaderRowResolution =
  | {
      readonly status: "resolved";
      readonly headerRowIndex: number;
      readonly candidateRowIndices: readonly number[];
      readonly inspectedRowCount: number;
    }
  | {
      readonly status: "header-row-required";
      readonly headerRowIndex: undefined;
      readonly candidateRowIndices: readonly number[];
      readonly inspectedRowCount: number;
    };

/** Explicit-selection validation outcome (bounded to the inspected rows). */
export type HeaderRowSelectionValidation =
  | { readonly valid: true; readonly headerRowIndex: number }
  | { readonly valid: false; readonly message: string };

function isTextualCell(cell: StructuredCell): cell is string {
  return typeof cell === "string" && cell.trim().length > 0;
}

function hasHeaderToken(text: string): boolean {
  const lowered = text.trim().toLowerCase();
  return HEADER_ROW_TOKENS.some((token) => lowered.includes(token));
}

/**
 * D-022 candidacy predicate for ONE normalized row: at least
 * {@link MIN_HEADER_TEXT_CELLS} non-empty textual cells AND (at least one
 * clinical/header token match OR textual cells outnumber numeric cells).
 * Booleans, `null` absence and empty strings count toward neither side.
 */
export function isHeaderCandidateRow(row: readonly StructuredCell[]): boolean {
  let textual = 0;
  let numeric = 0;
  let token = false;
  for (const cell of row) {
    if (typeof cell === "number") {
      numeric += 1;
    } else if (isTextualCell(cell)) {
      textual += 1;
      if (!token && hasHeaderToken(cell)) token = true;
    }
  }
  return textual >= MIN_HEADER_TEXT_CELLS && (token || textual > numeric);
}

/**
 * Inspect at most the first {@link MAX_HEADER_INSPECTION_ROWS} used rows and
 * return the 0-based indices of every candidate row. Never inspects content
 * beyond the bound and never copies cell values — indices only.
 */
export function detectHeaderCandidates(rows: HeaderRowMatrix): HeaderCandidates {
  const inspectedRowCount = Math.min(rows.length, MAX_HEADER_INSPECTION_ROWS);
  const candidateRowIndices: number[] = [];
  for (let index = 0; index < inspectedRowCount; index += 1) {
    if (isHeaderCandidateRow(rows[index])) candidateRowIndices.push(index);
  }
  return { candidateRowIndices, inspectedRowCount };
}

/**
 * Resolve the header row: exactly one inspected candidate auto-resolves;
 * zero or multiple candidates require explicit human selection (typed
 * `header-row-required` carrying the inspected indices). Never falls back to
 * row 1 silently.
 */
export function resolveHeaderRow(rows: HeaderRowMatrix): HeaderRowResolution {
  const { candidateRowIndices, inspectedRowCount } = detectHeaderCandidates(rows);
  if (candidateRowIndices.length === 1) {
    return {
      status: "resolved",
      headerRowIndex: candidateRowIndices[0],
      candidateRowIndices,
      inspectedRowCount,
    };
  }
  return {
    status: "header-row-required",
    headerRowIndex: undefined,
    candidateRowIndices,
    inspectedRowCount,
  };
}

/**
 * Validate an explicit human header-row selection against the inspected
 * bound. Valid only for an integer 0-based index inside the inspected rows;
 * every other value fails typed with an actionable message (never content).
 */
export function validateHeaderRowSelection(
  selection: unknown,
  inspectedRowCount: number
): HeaderRowSelectionValidation {
  if (
    typeof selection === "number" &&
    Number.isInteger(selection) &&
    selection >= 0 &&
    selection < inspectedRowCount
  ) {
    return { valid: true, headerRowIndex: selection };
  }
  return {
    valid: false,
    message:
      inspectedRowCount <= 0
        ? "No header rows are available for explicit selection in this worksheet."
        : `The selected header row is invalid: choose one of the inspected rows 1 to ${inspectedRowCount}.`,
  };
}
