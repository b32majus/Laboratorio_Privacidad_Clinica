/**
 * Excel ingestion adapter for V4 structured jobs (T18 #22, SPEC_V4_BATCH_AND_
 * STRUCTURED.md §9, DEBT STRUCT-007/008/009).
 *
 * SPEC §9 requirements:
 *  - "sheet selection or explicit selected sheet": the sheet name is a
 *    REQUIRED argument — the adapter never falls back to the first sheet
 *    silently, and an unknown name fails with the list of available sheets;
 *  - "proper Excel serial-date normalization": date-formatted numeric cells
 *    are normalized through `excel-serial.ts`, with out-of-range serials
 *    failing closed;
 *  - "preserve null/blank values as absence": missing cells and empty-string
 *    cells become `null` (STRUCT-009);
 *  - "do not CODIFY an empty value into a category": absence is `null` end to
 *    end, and codification lives in `codify.ts` where blanks never enter the
 *    category map.
 *
 * Error cells (`t: "e"`) fail with a typed error naming the cell (D-009:
 * fail-closed; no silent partial table). Sensitive cell content is memory-
 * only (D-013): never persisted, logged, placed in URLs, or sent over the
 * network; no console.* calls.
 *
 * REC-04 WU-A (D-022 "Workbook header-row authority"): the FIRST row is no
 * longer assumed to be the header. The explicitly selected sheet is
 * normalized to a cell matrix and resolved through `header-row.ts`: exactly
 * one inspected candidate auto-selects; zero or multiple candidates return
 * the typed `header-row-required` state (never a silent row 1); an explicit
 * `headerRowIndex` is bounded to the inspected rows and validated.
 */
import { isBlankCell, type StructuredCell, type StructuredGrid } from "./grid";
import { excelSerialToIsoDate } from "./excel-serial";
import { resolveHeaderRow, validateHeaderRowSelection, type HeaderRowMatrix } from "./header-row";
import { loadXlsx, type XlsxCell, type XlsxLib, type XlsxWorksheet } from "./xlsx-loader";

export type StructuredWorkbookFailureCode =
  | "sheet-not-selected"
  | "sheet-not-found"
  | "empty-workbook"
  | "empty-sheet"
  | "excel-cell-error"
  | "excel-date-out-of-range"
  | "invalid-header-row";

export type ParsedWorkbookResult =
  | { readonly status: "success"; readonly grid: StructuredGrid }
  | {
      readonly status: "header-row-required";
      readonly code: "header-row-required";
      readonly sheetName: string;
      /** 0-based inspected row indices that qualify as header candidates. */
      readonly candidateRowIndices: readonly number[];
      /** How many used rows (from the top, at most 10) were inspected. */
      readonly inspectedRowCount: number;
      readonly message: string;
    }
  | {
      readonly status: "failed";
      readonly code: StructuredWorkbookFailureCode;
      readonly message: string;
    };

export type SheetListResult =
  | { readonly status: "success"; readonly sheetNames: readonly string[] }
  | { readonly status: "failed"; readonly code: "empty-workbook"; readonly message: string };

/** Options of the vendored SheetJS read call used by the adapter. */
const READ_OPTIONS = { type: "array" as const, cellDates: false, cellNF: true };

/**
 * List the sheet names of a workbook (deterministic order). Empty workbooks
 * fail explicitly — never an apparently successful empty list.
 */
export async function listSheetNames(bytes: ArrayBuffer | Uint8Array): Promise<SheetListResult> {
  const xlsx = await loadXlsx();
  const workbook = xlsx.read(bytes, READ_OPTIONS);
  if (workbook.SheetNames.length === 0) {
    return {
      status: "failed",
      code: "empty-workbook",
      message: "The Excel file contains no sheets.",
    };
  }
  return { status: "success", sheetNames: [...workbook.SheetNames] };
}

/**
 * Parse one explicitly selected sheet of a workbook into a normalized
 * {@link StructuredGrid}. Header resolution follows D-022: when
 * `headerRowIndex` is provided it is validated against the inspected rows
 * (invalid/out-of-range fails typed `invalid-header-row`); otherwise the
 * bounded detector auto-selects exactly one candidate row, and zero or
 * multiple candidates return typed `header-row-required` (never a silent
 * first row). Rows above the chosen header are skipped metadata; rows below
 * preserve order, blanks and scalar normalization exactly.
 *
 * Failures (all typed, all fail-closed): no sheet selected, selected sheet
 * not present (message lists available sheets), empty workbook, empty sheet,
 * error cells, date serials outside the supported range, and invalid
 * explicit header-row selection.
 */
export async function parseStructuredWorkbook(
  bytes: ArrayBuffer | Uint8Array,
  options: { sheetName: string; headerRowIndex?: number }
): Promise<ParsedWorkbookResult> {
  const xlsx = await loadXlsx();

  const sheetName = options.sheetName;
  if (typeof sheetName !== "string" || sheetName.length === 0) {
    return {
      status: "failed",
      code: "sheet-not-selected",
      message: "No Excel sheet was selected: an explicit sheet is required.",
    };
  }

  const workbook = xlsx.read(bytes, READ_OPTIONS);
  if (workbook.SheetNames.length === 0) {
    return {
      status: "failed",
      code: "empty-workbook",
      message: "The Excel file contains no sheets.",
    };
  }

  const sheet = workbook.Sheets[sheetName];
  if (!sheet) {
    return {
      status: "failed",
      code: "sheet-not-found",
      message: `Sheet "${sheetName}" does not exist in this Excel file. Available sheets: ${workbook.SheetNames.join(", ")}.`,
    };
  }

  return worksheetToGridResolved(sheet, xlsx, sheetName, options.headerRowIndex);
}

/**
 * Resolve the header row of one selected worksheet and build the grid.
 * Exported for deterministic workbook-level oracles; the UI reaches it
 * through {@link parseStructuredWorkbook} / the intake module.
 */
export function worksheetToGridResolved(
  sheet: XlsxWorksheet,
  xlsx: XlsxLib,
  sheetName: string,
  headerRowIndex?: number
): ParsedWorkbookResult {
  const matrixResult = worksheetToMatrix(sheet, xlsx);
  if (matrixResult.status === "failed") return matrixResult;
  const matrix = matrixResult.matrix;
  const inspectedRowCount = Math.min(matrix.length, 10);

  if (headerRowIndex !== undefined) {
    const validation = validateHeaderRowSelection(headerRowIndex, inspectedRowCount);
    if (!validation.valid) {
      return { status: "failed", code: "invalid-header-row", message: validation.message };
    }
    return { status: "success", grid: matrixToGrid(matrix, validation.headerRowIndex) };
  }

  const resolution = resolveHeaderRow(matrix);
  if (resolution.status === "header-row-required") {
    return {
      status: "header-row-required",
      code: "header-row-required",
      sheetName,
      candidateRowIndices: resolution.candidateRowIndices,
      inspectedRowCount: resolution.inspectedRowCount,
      message: headerRowRequiredMessage(
        sheetName,
        resolution.candidateRowIndices,
        resolution.inspectedRowCount
      ),
    };
  }
  return { status: "success", grid: matrixToGrid(matrix, resolution.headerRowIndex) };
}

/**
 * Human-actionable message for the typed `header-row-required` state. Carries
 * only 1-based row numbers — never cell content (D-013).
 */
function headerRowRequiredMessage(
  sheetName: string,
  candidateRowIndices: readonly number[],
  inspectedRowCount: number
): string {
  if (candidateRowIndices.length === 0) {
    return (
      `The worksheet "${sheetName}" has no clear header row in the first ` +
      `${inspectedRowCount} rows. Choose the header row explicitly.`
    );
  }
  const rows = candidateRowIndices.map((index) => `row ${index + 1}`).join(", ");
  return (
    `The worksheet "${sheetName}" has several rows that look like headers ` +
    `(${rows}). Choose the header row explicitly; the first row is never assumed.`
  );
}

/** Normalized cell matrix of a worksheet: rows above/below carry no header meaning yet. */
type WorksheetMatrixResult =
  | { readonly status: "ok"; readonly matrix: HeaderRowMatrix }
  | {
      readonly status: "failed";
      readonly code: StructuredWorkbookFailureCode;
      readonly message: string;
    };

function worksheetToMatrix(sheet: XlsxWorksheet, xlsx: XlsxLib): WorksheetMatrixResult {
  const ref = sheet["!ref"];
  if (typeof ref !== "string" || ref.length === 0) {
    return {
      status: "failed",
      code: "empty-sheet",
      message: "The selected Excel sheet is empty.",
    };
  }

  const range = xlsx.utils.decode_range(ref);
  const rowCount = range.e.r - range.s.r + 1;
  if (rowCount <= 0) {
    return {
      status: "failed",
      code: "empty-sheet",
      message: "The selected Excel sheet is empty.",
    };
  }

  const ssfIsDate =
    typeof xlsx.SSF?.is_date === "function" ? (fmt: unknown) => xlsx.SSF.is_date(fmt) : null;

  const matrix: StructuredCell[][] = [];
  for (let r = range.s.r; r <= range.e.r; r += 1) {
    const row: StructuredCell[] = [];
    for (let c = range.s.c; c <= range.e.c; c += 1) {
      const address = xlsx.utils.encode_cell({ r, c });
      const cell = sheet[address] as XlsxCell | undefined;
      const cellResult = normalizeCell(cell, address, ssfIsDate);
      if (cellResult.status === "failed") {
        return cellResult;
      }
      row.push(cellResult.value);
    }
    matrix.push(row);
  }
  return { status: "ok", matrix };
}

/**
 * Build a normalized grid from a matrix with the header at an explicit
 * 0-based row. Rows above are skipped metadata, never data rows; rows below
 * keep order and values verbatim.
 */
function matrixToGrid(matrix: HeaderRowMatrix, headerRowIndex: number): StructuredGrid {
  const headerRow = matrix[headerRowIndex];
  const headers: string[] = headerRow.map((header) => (header === null ? "" : String(header)));
  return {
    // Blank header cells keep a structural empty label (headers are grid
    // addresses, not values); data cells keep null absence (STRUCT-009).
    headers,
    rows: matrix.slice(headerRowIndex + 1),
  };
}

/**
 * Convert a SheetJS worksheet into a normalized grid with the first used row
 * as the header. Exported for the deterministic grid-level oracle
 * (hand-built worksheets), not as a public UI surface: production workbook
 * intake resolves the header through D-022 instead of assuming row 1.
 */
export function worksheetToGrid(sheet: XlsxWorksheet, xlsx: XlsxLib): ParsedWorkbookResult {
  const matrixResult = worksheetToMatrix(sheet, xlsx);
  if (matrixResult.status === "failed") {
    // `worksheetToMatrix` never succeeds with a header-row-required state, so
    // the union narrows to success/failed here; map explicitly regardless.
    return {
      status: "failed",
      code: matrixResult.code,
      message: matrixResult.message,
    };
  }
  if (matrixResult.matrix.length === 0) {
    return {
      status: "failed",
      code: "empty-sheet",
      message: "The selected Excel sheet is empty.",
    };
  }
  return { status: "success", grid: matrixToGrid(matrixResult.matrix, 0) };
}

type CellNormalization =
  | { readonly status: "ok"; readonly value: StructuredCell }
  | {
      readonly status: "failed";
      readonly code: StructuredWorkbookFailureCode;
      readonly message: string;
    };

function normalizeCell(
  cell: XlsxCell | undefined,
  address: string,
  ssfIsDate: ((fmt: unknown) => boolean) | null
): CellNormalization {
  if (!cell || cell.t === "z") {
    return { status: "ok", value: null }; // missing/styled-blank cell: absence
  }

  switch (cell.t) {
    case "s":
    case "str": {
      const value = typeof cell.v === "string" ? cell.v : String(cell.v ?? "");
      return { status: "ok", value: value === "" ? null : value };
    }
    case "b":
      return { status: "ok", value: cell.v === true };
    case "d": {
      // Only reachable if a workbook was read with cellDates; normalize defensively.
      const date = cell.v;
      if (date instanceof Date && !Number.isNaN(date.getTime())) {
        return { status: "ok", value: date.toISOString().slice(0, 10) };
      }
      return { status: "ok", value: null };
    }
    case "n": {
      const numeric = typeof cell.v === "number" ? cell.v : Number(cell.v);
      if (!Number.isFinite(numeric)) {
        return { status: "ok", value: null };
      }
      if (isDateFormatted(cell.z, ssfIsDate)) {
        const iso = excelSerialToIsoDate(numeric);
        if (iso === null) {
          return {
            status: "failed",
            code: "excel-date-out-of-range",
            message: `Cell ${address} holds a date serial outside the supported range (1900-03-01 .. 9999-12-31).`,
          };
        }
        return { status: "ok", value: iso };
      }
      return { status: "ok", value: numeric };
    }
    case "e":
      return {
        status: "failed",
        code: "excel-cell-error",
        message: `Cell ${address} contains a spreadsheet error value; the sheet cannot be parsed fail-closed.`,
      };
    default:
      return { status: "ok", value: null };
  }
}

/**
 * Date-format detection for numeric cells. Built-in format ids and custom
 * format strings are checked for year/day tokens (a format with a year or
 * day component is a date; time-only formats keep their numeric value).
 * SheetJS's own `SSF.is_date` is used as a last resort for exotic formats.
 */
export function isDateFormatted(
  format: unknown,
  ssfIsDate: ((fmt: unknown) => boolean) | null = null
): boolean {
  if (typeof format === "number") {
    // Built-in date format ids of the Excel 1900 system: 14..17 and 22 are
    // date (or date+time) formats; 27..36 and their locale duplicates 50..58
    // are date formats. Time-only ids (18..21, 45..47) stay numeric.
    return (
      (format >= 14 && format <= 17) ||
      format === 22 ||
      (format >= 27 && format <= 36) ||
      (format >= 50 && format <= 58)
    );
  }
  if (typeof format !== "string" || format.length === 0 || format === "General") {
    return false;
  }
  const stripped = format
    .replace(/"[^"]*"/g, "") // quoted literals
    .replace(/\[[^\]]*\]/g, "") // bracketed conditions/colors
    .replace(/\\./g, ""); // escaped characters
  if (/y{2,4}/i.test(stripped) || /d{1,4}/i.test(stripped)) {
    return true;
  }
  if (ssfIsDate) {
    try {
      return ssfIsDate(format) === true;
    } catch {
      return false;
    }
  }
  return false;
}

export { isBlankCell };
