/**
 * Deterministic browser-local XLSX serializers for structured output
 * (REC-04 WU-C, D-022 "XLSX Safe / Confidential artifacts", H-28/H-29).
 *
 * Both builders are pure projections of the CANONICAL domain state — they
 * never rerun privacy transformations and never invent a second mapping:
 *  - Safe XLSX is built ONLY from `StructuredOutput.safe` plus the factual
 *    `StructuredSummary` (row/patient counts, never scores or chronology).
 *    It carries no original↔transformed mapping, no correspondence, no
 *    reviewer notes and no Confidential originals.
 *  - Confidential XLSX is built ONLY from
 *    `StructuredOutput.confidential` plus bounded non-sensitive metadata
 *    (policy id, correspondence totals). It never pulls Safe-only kept
 *    clinical content into the audit.
 *
 * Bytes come from the governed same-origin SheetJS runtime
 * (`/vendor/xlsx.full.min.js` via `xlsx-loader.ts`); no new dependency, no
 * network, no persistence, no logging (D-013/D-014). Every string cell is
 * constructed explicitly as `{ t: "s", v }` so source/user text beginning
 * `=`, `+`, `-`, `@` stays a literal string cell, never a formula.
 *
 * Deterministic (D-022): same canonical input yields byte-identical output
 * (no timestamps, no randomness in the generated artifact).
 */
import { CONFIDENTIAL_AUDIT_WARNING_LINE } from "../output/confidential-audit-serializer";
import { isSafeDataset } from "./csv-writer";
import type {
  StructuredConfidentialCorrespondence,
  StructuredSafeCell,
  StructuredSummary,
} from "./transformed-dataset";
import type { XlsxLib, XlsxWorksheet } from "./xlsx-loader";

/** Suggested Safe XLSX filename (REC-10 owns localization later). */
export const SAFE_STRUCTURED_XLSX_FILE_NAME = "safe-structured-output.xlsx" as const;

/** Suggested Confidential XLSX filename (REC-10 owns localization later). */
export const CONFIDENTIAL_STRUCTURED_XLSX_FILE_NAME = "structured-confidential-audit.xlsx" as const;

/** First (and primary) Safe worksheet: Safe headers + Safe rows. */
export const SAFE_DATA_SHEET_NAME = "Data" as const;

/** Optional Safe worksheet: only the factual summary + output facts. */
export const SAFE_SUMMARY_SHEET_NAME = "Summary" as const;

/** First Confidential worksheet: the canonical warning + handling note. */
export const CONFIDENTIAL_WARNING_SHEET_NAME = "READ_FIRST" as const;

/** Confidential worksheet: the flattened authorized correspondence. */
export const CONFIDENTIAL_CORRESPONDENCE_SHEET_NAME = "Correspondence" as const;

/** Optional Confidential worksheet: policy id + correspondence totals only. */
export const CONFIDENTIAL_METADATA_SHEET_NAME = "Metadata" as const;

/** Typed XLSX serializer failure (fail-closed). */
export class XlsxExportError extends Error {
  readonly code = "INVALID_XLSX_EXPORT_INPUT";

  constructor(message: string) {
    super(message);
    this.name = "XlsxExportError";
  }
}

const VALID_DISPOSITIONS = ["date-age", "pseudonymize", "remove", "study-id", "free-text"] as const;

function isCorrespondence(value: unknown): value is StructuredConfidentialCorrespondence {
  if (typeof value !== "object" || value === null) return false;
  const candidate = value as Partial<StructuredConfidentialCorrespondence>;
  if (
    candidate.kind !== "structured-confidential-correspondence" ||
    !Array.isArray(candidate.columns) ||
    typeof candidate.totals !== "object" ||
    candidate.totals === null ||
    typeof candidate.policyId !== "string"
  ) {
    return false;
  }
  return candidate.columns.every(
    (column) =>
      typeof column === "object" &&
      column !== null &&
      typeof (column as { columnIndex?: unknown }).columnIndex === "number" &&
      typeof (column as { header?: unknown }).header === "string" &&
      (VALID_DISPOSITIONS as readonly string[]).includes(
        (column as { disposition?: unknown }).disposition as string
      ) &&
      Array.isArray((column as { entries?: unknown }).entries) &&
      (column as { entries: readonly unknown[] }).entries.every(
        (entry) =>
          typeof entry === "object" &&
          entry !== null &&
          typeof (entry as { original?: unknown }).original === "string" &&
          ((entry as { transformed?: unknown }).transformed === null ||
            typeof (entry as { transformed?: unknown }).transformed === "string")
      )
  );
}

/**
 * One worksheet cell for a Safe scalar: strings stay literal `s` cells
 * (never formulas, even for `=`/`+`/`-`/`@` prefixes), numbers/booleans
 * stay typed, and `null` (absence) yields no cell at all.
 */
function safeCellToEntry(cell: StructuredSafeCell): { t: string; v: unknown } | null {
  if (cell === null) return null;
  if (typeof cell === "string") return { t: "s", v: cell };
  if (typeof cell === "number") return { t: "n", v: cell };
  return { t: "b", v: cell };
}

/** One worksheet cell for an always-string value (headers, facts, audit text). */
function stringCell(value: string): { t: string; v: string } {
  return { t: "s", v: value };
}

/**
 * Build one worksheet from a rectangular grid of cell entries. `null`
 * entries stay absent (blank) cells; the used range covers the full grid
 * so row order and blanks survive the write/read round trip.
 */
function buildSheet(
  lib: XlsxLib,
  grid: readonly (readonly ({ t: string; v: unknown } | null)[])[]
): XlsxWorksheet {
  const sheet: Record<string, { t: string; v: unknown } | string | undefined> = {};
  let maxColumn = 0;
  grid.forEach((row, rowIndex) => {
    maxColumn = Math.max(maxColumn, row.length);
    row.forEach((entry, columnIndex) => {
      if (entry === null) return;
      sheet[lib.utils.encode_cell({ r: rowIndex, c: columnIndex })] = {
        t: entry.t,
        v: entry.v,
      };
    });
  });
  const rows = grid.length;
  if (rows > 0 && maxColumn > 0) {
    sheet["!ref"] =
      `${lib.utils.encode_cell({ r: 0, c: 0 })}:${lib.utils.encode_cell({ r: rows - 1, c: maxColumn - 1 })}`;
  }
  return sheet;
}

function stringsToGrid(
  rows: readonly (readonly string[])[]
): ({ t: string; v: unknown } | null)[][] {
  return rows.map((row) => row.map((value) => stringCell(value)));
}

/** Normalize the SheetJS `write` result to bytes for the Blob download seam. */
function toBytes(result: ArrayBuffer | Uint8Array | number[]): Uint8Array {
  if (result instanceof Uint8Array) {
    return new Uint8Array(result);
  }
  if (result instanceof ArrayBuffer) {
    return new Uint8Array(result);
  }
  return new Uint8Array(result);
}

function writeWorkbook(
  lib: XlsxLib,
  sheets: readonly (readonly [string, XlsxWorksheet])[]
): Uint8Array {
  const workbook = lib.utils.book_new();
  for (const [name, sheet] of sheets) {
    lib.utils.book_append_sheet(workbook, sheet, name);
  }
  return toBytes(lib.write(workbook, { type: "array", bookType: "xlsx" }));
}

/**
 * Factual Safe summary rows (D-022 §"Structured Safe data and factual
 * summary"): the data row count always; unique patients, linked rows and
 * the average only when a patient-ID authority exists (`summary.patient`
 * non-null, never guessed). Descriptive counts only — not a risk/privacy
 * score, no chronology claim.
 */
function summaryGrid(
  summary: StructuredSummary | null | undefined
): ({ t: string; v: unknown } | null)[][] {
  const grid: ({ t: string; v: unknown } | null)[][] = [
    [stringCell("Metric"), stringCell("Value")],
  ];
  const rowCount = summary?.rowCount ?? 0;
  grid.push([stringCell("data_rows"), { t: "n", v: rowCount }]);
  if (summary?.patient) {
    grid.push([stringCell("unique_patients"), { t: "n", v: summary.patient.uniquePatients }]);
    grid.push([stringCell("linked_rows"), { t: "n", v: summary.patient.linkedRows }]);
    grid.push([
      stringCell("average_linked_rows_per_patient"),
      { t: "n", v: summary.patient.averageLinkedRowsPerPatient },
    ]);
  }
  grid.push([stringCell("note"), stringCell("Details are in the Data worksheet of this file.")]);
  return grid;
}

/**
 * Build deterministic Safe XLSX bytes from the exact canonical
 * `StructuredOutput.safe`: the `Data` worksheet carries Safe headers +
 * Safe rows (row order and blanks preserved, typed scalars as typed
 * cells), and the optional `Summary` worksheet carries only the factual
 * summary plus non-sensitive output facts. No mapping, no correspondence,
 * no reviewer notes, no Confidential originals. Fails closed on a value
 * that is not a structurally valid Safe dataset.
 */
export function buildSafeXlsxBytes(
  lib: XlsxLib,
  safe: unknown,
  summary?: StructuredSummary | null
): Uint8Array {
  if (!isSafeDataset(safe)) {
    throw new XlsxExportError(
      "buildSafeXlsxBytes requires a structurally valid structured Safe dataset."
    );
  }
  const dataGrid: ({ t: string; v: unknown } | null)[][] = [
    safe.headers.map((header) => stringCell(header)),
    ...safe.rows.map((row) => row.map((cell) => safeCellToEntry(cell))),
  ];
  return writeWorkbook(lib, [
    [SAFE_DATA_SHEET_NAME, buildSheet(lib, dataGrid)],
    [SAFE_SUMMARY_SHEET_NAME, buildSheet(lib, summaryGrid(summary))],
  ]);
}

/**
 * Build deterministic Confidential XLSX bytes solely from the canonical
 * `StructuredOutput.confidential` plus bounded non-sensitive metadata:
 * `READ_FIRST` carries the canonical Confidential warning and handling
 * note; `Correspondence` flattens the authorized per-column
 * correspondence (column/disposition/original/transformed facts); and
 * `Metadata` carries the policy id and correspondence totals only. No
 * Safe-only kept clinical content is pulled in. Fails closed on a value
 * that is not a structurally valid correspondence.
 */
export function buildConfidentialXlsxBytes(lib: XlsxLib, confidential: unknown): Uint8Array {
  if (!isCorrespondence(confidential)) {
    throw new XlsxExportError(
      "buildConfidentialXlsxBytes requires a structurally valid structured correspondence."
    );
  }
  const warningGrid = stringsToGrid([
    [CONFIDENTIAL_AUDIT_WARNING_LINE],
    ["This workbook contains identifiable original <-> transformed correspondence."],
    [
      "It is for authorized internal handling only and must never be delivered to a safe destination.",
    ],
  ]);
  const correspondenceGrid: ({ t: string; v: unknown } | null)[][] = [
    ["Column", "Header", "Disposition", "Original", "Transformed"].map((header) =>
      stringCell(header)
    ),
    ...confidential.columns.flatMap((column) =>
      column.entries.map((entry) => [
        { t: "n", v: column.columnIndex },
        stringCell(column.header),
        stringCell(column.disposition),
        stringCell(entry.original),
        stringCell(entry.transformed ?? "(removed)"),
      ])
    ),
  ];
  const totals = confidential.totals;
  const metadataGrid = stringsToGrid([
    ["Fact", "Value"],
    ["policy", confidential.policyId],
    ["correspondence_columns", String(confidential.columns.length)],
    ["date_age_columns", String(totals.dateAge)],
    ["pseudonymize_columns", String(totals.pseudonymize)],
    ["remove_columns", String(totals.remove)],
    ["study_id_columns", String(totals.studyId)],
    ["free_text_columns", String(totals.freeText)],
    ["transformed_cells", String(totals.transformedCells)],
  ]);
  return writeWorkbook(lib, [
    [CONFIDENTIAL_WARNING_SHEET_NAME, buildSheet(lib, warningGrid)],
    [CONFIDENTIAL_CORRESPONDENCE_SHEET_NAME, buildSheet(lib, correspondenceGrid)],
    [CONFIDENTIAL_METADATA_SHEET_NAME, buildSheet(lib, metadataGrid)],
  ]);
}
