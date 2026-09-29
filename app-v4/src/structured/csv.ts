/**
 * Consolidated CSV parser for V4 structured ingestion (T18 #22, SPEC_V4_BATCH_
 * AND_STRUCTURED.md §8, DEBT STRUCT-003).
 *
 * SPEC §8: "Use a consolidated parser that supports valid quoted multiline
 * fields and delimiter escaping. Do not maintain a line-splitting parser as
 * production authority."
 *
 * This module is the single production CSV authority of the V4 structured
 * surface: a pure-TypeScript RFC-4180-style state machine that handles
 *  - quoted fields spanning multiple lines (embedded \r\n / \n inside quotes);
 *  - escaped double quotes (`""`) inside quoted fields;
 *  - delimiter detection among `,`, `;` and tab (outside quotes, whole input);
 *  - CRLF, LF and lone-CR record ends outside quotes.
 *
 * Fail-closed semantics (D-009): empty input and an unterminated quoted field
 * at EOF are explicit typed failures — never an apparently successful partial
 * table. Empty fields (including quoted `""`) are absence: they become `null`
 * (STRUCT-009), never a placeholder string. Field content is preserved
 * verbatim (no trimming): only structural separators are consumed.
 *
 * Sensitive content is memory-only (D-013): never persisted, logged, or sent
 * anywhere; this module contains no console.* calls and no network I/O.
 */
import { isBlankCell, type StructuredCell, type StructuredGrid } from "./grid";

export type CsvDelimiter = "," | ";" | "\t";

export type CsvParseErrorCode = "csv-empty" | "csv-unterminated-quote";

export class CsvParseError extends Error {
  readonly code: CsvParseErrorCode;

  constructor(code: CsvParseErrorCode, message: string) {
    super(message);
    this.name = "CsvParseError";
    this.code = code;
  }
}

const DELIMITER_CANDIDATES: readonly CsvDelimiter[] = [",", ";", "\t"];

/**
 * Detect the most likely delimiter by counting candidate occurrences OUTSIDE
 * quoted fields across the whole input (not just the first line, which a
 * multiline quoted first field would corrupt). Ties resolve in the order of
 * {@link DELIMITER_CANDIDATES}; an input without any candidate returns `,`.
 */
export function detectCsvDelimiter(text: string): CsvDelimiter {
  let best: CsvDelimiter = ",";
  let bestCount = -1;
  for (const candidate of DELIMITER_CANDIDATES) {
    const count = countOutsideQuotes(text, candidate);
    if (count > bestCount) {
      best = candidate;
      bestCount = count;
    }
  }
  return best;
}

function countOutsideQuotes(text: string, delimiter: CsvDelimiter): number {
  let count = 0;
  let inQuotes = false;
  for (let i = 0; i < text.length; i += 1) {
    const char = text[i];
    if (char === '"') {
      if (inQuotes && text[i + 1] === '"') {
        i += 1; // escaped quote inside quotes
      } else {
        inQuotes = !inQuotes;
      }
    } else if (!inQuotes && char === delimiter) {
      count += 1;
    }
  }
  return count;
}

/**
 * Parse CSV text into a normalized {@link StructuredGrid}.
 *
 * The first record is the header row; remaining records are data rows. Empty
 * fields are `null` (absence, STRUCT-009). Fully-empty unquoted records
 * (blank lines) are skipped; quoted whitespace-only content is preserved
 * verbatim.
 *
 * Failures: `csv-empty` (no records at all), `csv-unterminated-quote` (EOF
 * inside a quoted field).
 */
export function parseCsv(text: string, options: { delimiter?: CsvDelimiter } = {}): StructuredGrid {
  if (text.length === 0) {
    throw new CsvParseError("csv-empty", "The CSV input is empty.");
  }

  const delimiter = options.delimiter ?? detectCsvDelimiter(text);

  const records: string[][] = [];
  let fields: string[] = [];
  let field = "";
  let inQuotes = false;
  let fieldWasQuoted = false;
  let recordHadQuotes = false;
  let sawAnyChar = false;

  const endField = (): void => {
    fields.push(field);
    if (fieldWasQuoted) {
      recordHadQuotes = true;
    }
    field = "";
    fieldWasQuoted = false;
  };

  const endRecord = (): void => {
    endField();
    const isBlankRecord = !recordHadQuotes && fields.every((value) => value === "");
    if (!isBlankRecord) {
      records.push(fields);
    }
    fields = [];
    recordHadQuotes = false;
    sawAnyChar = true;
  };

  for (let i = 0; i < text.length; i += 1) {
    const char = text[i];
    const next = text[i + 1];

    if (inQuotes) {
      if (char === '"') {
        if (next === '"') {
          field += '"';
          i += 1;
        } else {
          inQuotes = false;
          fieldWasQuoted = true;
        }
      } else {
        field += char;
      }
      continue;
    }

    if (char === '"') {
      if (field === "" && !fieldWasQuoted) {
        inQuotes = true;
        fieldWasQuoted = true;
      } else {
        // A quote inside an unquoted field or after content: RFC 4180 makes
        // this malformed; preserve it verbatim instead of guessing (content
        // fidelity; no silent alteration).
        field += '"';
      }
      continue;
    }

    if (char === delimiter) {
      endField();
      continue;
    }

    if (char === "\n" || char === "\r") {
      if (char === "\r" && next === "\n") {
        i += 1;
      }
      endRecord();
      continue;
    }

    field += char;
  }

  if (inQuotes) {
    throw new CsvParseError(
      "csv-unterminated-quote",
      "The CSV input ends inside an unterminated quoted field."
    );
  }

  if (field !== "" || fields.length > 0 || fieldWasQuoted || recordHadQuotes) {
    endRecord();
  }

  if (records.length === 0) {
    throw sawAnyChar
      ? new CsvParseError("csv-empty", "The CSV input contains no data records.")
      : new CsvParseError("csv-empty", "The CSV input is empty.");
  }

  const [headers, ...dataRecords] = records;
  const width = headers.length;

  const rows = dataRecords.map((record) => {
    const cells: StructuredCell[] = record.map((value) => (value === "" ? null : value));
    while (cells.length < width) {
      cells.push(null); // ragged short record: missing trailing cells are absence
    }
    return cells;
  });

  return { headers, rows };
}

export { isBlankCell };
