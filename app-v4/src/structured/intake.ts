/**
 * Structured source intake for the V4 Configure workspace (Work Order T20
 * #24; SPEC_V4_BATCH_AND_STRUCTURED.md §8/§9).
 *
 * Turns ONE selected CSV/XLS/XLSX file into a normalized {@link StructuredGrid}
 * by delegating to the single T18 production authorities: `csv.ts` for CSV and
 * `excel.ts` (governed same-origin SheetJS) for workbooks. This module never
 * re-implements a parser and never guesses a sheet:
 *
 *  - a CSV file is parsed through the consolidated `parseCsv` authority;
 *  - the common supported-size authority (`engine/input-limits.ts`, T15 #19;
 *    STRUCT-012 / issue #43 A1) is applied before any grid is returned: an
 *    oversize CSV is refused with the shared typed `input-too-large` failure
 *    BEFORE full parsing, and a workbook sheet is measured over the accepted
 *    structured representation (header row + cells) and refused the same way;
 *    nothing is ever truncated;
 *  - a workbook with several sheets returns `sheet-required` with the sheet
 *    names, so the human chooses explicitly (SPEC §9). A single-sheet workbook
 *    is parsed directly;
 *  - every parser failure is a typed non-success result (D-009 fail-closed),
 *    never an apparently successful empty table.
 *
 * Sensitive content is memory-only (D-013): the returned grid is used to build
 * the in-memory configuration and is never persisted, logged or placed in a
 * URL. This module contains no console.* calls.
 */
import { extensionOf, type SourceFileLike } from "../input/extracted-source";
import { oversizeInputFor, oversizeInputForLength } from "../engine/input-limits";
import { CsvParseError, parseCsv } from "./csv";
import { listSheetNames, parseStructuredWorkbook, type ParsedWorkbookResult } from "./excel";
import type { StructuredCell, StructuredGrid } from "./grid";

/** Outcome of reading one structured source. */
export type StructuredReadOutcome =
  | { readonly status: "parsed"; readonly grid: StructuredGrid }
  | { readonly status: "sheet-required"; readonly sheetNames: readonly string[] }
  | { readonly status: "failed"; readonly code: string; readonly message: string };

const WORKBOOK_EXTENSIONS: ReadonlySet<string> = new Set(["xls", "xlsx"]);

/** Read the file's bytes (native promise API with a bounded FileReader fallback). */
async function readBytes(file: SourceFileLike): Promise<ArrayBuffer> {
  if (typeof file.arrayBuffer === "function") {
    return file.arrayBuffer();
  }
  return new Promise<ArrayBuffer>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as ArrayBuffer);
    reader.onerror = () => reject(reader.error ?? new Error("Blob read failed."));
    reader.readAsArrayBuffer(file as unknown as Blob);
  });
}

/** Read the file's bytes as UTF-8 text. */
async function readText(file: SourceFileLike): Promise<string> {
  if (typeof file.text === "function") {
    return file.text();
  }
  return new TextDecoder("utf-8").decode(await readBytes(file));
}

function readFailure(fileName: string): StructuredReadOutcome {
  return {
    status: "failed",
    code: "read-failed",
    message: `The structured file "${fileName}" could not be read.`,
  };
}

/**
 * Measure the accepted structured representation of one sheet: the header row
 * plus every cell (absence contributes nothing). The measurement is a pure
 * count of UTF-16 code units — no cell content is copied, logged or retained.
 */
function gridTextLength(grid: StructuredGrid): number {
  let total = 0;
  for (const header of grid.headers) total += header.length;
  for (const row of grid.rows) {
    for (const cell of row as readonly StructuredCell[]) {
      if (typeof cell === "string") total += cell.length;
      else if (cell !== null) total += String(cell).length;
    }
  }
  return total;
}

/** Map the T18 Excel adapter result onto this module's outcome union. */
function workbookOutcome(result: ParsedWorkbookResult): StructuredReadOutcome {
  return result.status === "success"
    ? { status: "parsed", grid: result.grid }
    : { status: "failed", code: result.code, message: result.message };
}

async function parseWorkbookBytes(
  bytes: ArrayBuffer,
  sheetName: string
): Promise<StructuredReadOutcome> {
  // `parseStructuredWorkbook` returns typed failures; only the governed
  // SheetJS loader can throw, and that too must fail closed.
  let outcome: StructuredReadOutcome;
  try {
    outcome = workbookOutcome(await parseStructuredWorkbook(bytes, { sheetName }));
  } catch (error) {
    return {
      status: "failed",
      code: "excel-reader-failed",
      message:
        error instanceof Error
          ? `The Excel reader could not be loaded: ${error.message}`
          : "The Excel reader could not be loaded.",
    };
  }
  if (outcome.status !== "parsed") return outcome;
  // Supported-size authority (STRUCT-012) over the accepted representation of
  // the selected sheet. The grid is measured, never truncated and never
  // returned when it is above the limit: the caller gets the shared typed
  // `input-too-large` failure instead.
  const oversize = oversizeInputForLength(gridTextLength(outcome.grid));
  if (oversize) {
    return { status: "failed", code: oversize.code, message: oversize.message };
  }
  return outcome;
}

/**
 * Read one structured file into a grid. A multi-sheet workbook returns
 * `sheet-required` (the caller must then call {@link readStructuredSheet} with
 * an explicit sheet); an unsupported extension fails typed.
 */
export async function readStructuredFile(file: SourceFileLike): Promise<StructuredReadOutcome> {
  const extension = extensionOf(file.name);

  if (extension === "csv") {
    let text: string;
    try {
      text = await readText(file);
    } catch {
      return readFailure(file.name);
    }
    // Supported-size authority (STRUCT-012): an oversize CSV is refused with
    // the shared typed failure BEFORE the full parse, exactly like every
    // other input path (T15 #19). Nothing is truncated.
    const oversize = oversizeInputFor(text);
    if (oversize) {
      return { status: "failed", code: oversize.code, message: oversize.message };
    }
    try {
      return { status: "parsed", grid: parseCsv(text) };
    } catch (error) {
      return error instanceof CsvParseError
        ? { status: "failed", code: error.code, message: error.message }
        : readFailure(file.name);
    }
  }

  if (WORKBOOK_EXTENSIONS.has(extension)) {
    let bytes: ArrayBuffer;
    try {
      bytes = await readBytes(file);
    } catch {
      return readFailure(file.name);
    }
    let sheets;
    try {
      sheets = await listSheetNames(bytes);
    } catch (error) {
      return {
        status: "failed",
        code: "excel-reader-failed",
        message:
          error instanceof Error
            ? `The Excel reader could not be loaded: ${error.message}`
            : "The Excel reader could not be loaded.",
      };
    }
    if (sheets.status === "failed") {
      return { status: "failed", code: sheets.code, message: sheets.message };
    }
    if (sheets.sheetNames.length > 1) {
      return { status: "sheet-required", sheetNames: sheets.sheetNames };
    }
    return parseWorkbookBytes(bytes, sheets.sheetNames[0]);
  }

  return {
    status: "failed",
    code: "unsupported-format",
    message: `The file "${file.name}" is not a supported structured type (CSV, XLS, XLSX).`,
  };
}

/**
 * Read one explicitly selected sheet of a structured workbook. Used after
 * {@link readStructuredFile} returned `sheet-required`; the sheet name is
 * always explicit (SPEC §9), never a silent first sheet.
 */
export async function readStructuredSheet(
  file: SourceFileLike,
  sheetName: string
): Promise<StructuredReadOutcome> {
  let bytes: ArrayBuffer;
  try {
    bytes = await readBytes(file);
  } catch {
    return readFailure(file.name);
  }
  return parseWorkbookBytes(bytes, sheetName);
}
