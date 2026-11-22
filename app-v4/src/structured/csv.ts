/**
 * Consolidated CSV parser for V4 structured ingestion (T18 #22, SPEC_V4_BATCH_
 * AND_STRUCTURED.md §8, DEBT STRUCT-003; REC-12 #92).
 *
 * SPEC §8: "Use a consolidated parser that supports valid quoted multiline
 * fields and delimiter escaping. Do not maintain a line-splitting parser as
 * production authority."
 *
 * `csv-parse` (browser ESM sync build, no injected network capability) is the
 * single parsing authority of this module: it splits records and fields,
 * unescapes doubled quotes and preserves quoted multiline content verbatim.
 * This module only adds the V4 policy on top of it:
 *
 *  - delimiter detection from the header width plus record consistency,
 *    never from a whole-file punctuation count (note text such as
 *    "observación; control" must not reclassify a comma-delimited file);
 *  - typed fail-closed failures (D-009): ambiguous separators, rows with more
 *    columns than the header, malformed quotes and EOF inside a quoted field
 *    never produce an apparently valid partial table;
 *  - absence normalization (STRUCT-009): empty and quoted-empty fields become
 *    `null`; whitespace-only content is preserved verbatim (no trimming);
 *  - record ends: CRLF and LF are equivalent; a physically empty line is
 *    skipped (`skip_empty_lines`) while an explicit quoted-empty record
 *    (`""`) is real absence.
 *
 * Sensitive content is memory-only (D-013): never persisted, logged, or sent
 * anywhere; this module contains no console.* calls and no network I/O.
 */
import { parse } from "csv-parse/browser/esm/sync";

import { isBlankCell, type StructuredCell, type StructuredGrid } from "./grid";

export type CsvDelimiter = "," | ";" | "\t";

export type CsvParseErrorCode =
  | "csv-empty"
  | "csv-unterminated-quote"
  | "csv-malformed"
  | "csv-ambiguous-delimiter"
  | "csv-column-mismatch";

export class CsvParseError extends Error {
  readonly code: CsvParseErrorCode;

  constructor(code: CsvParseErrorCode, message: string) {
    super(message);
    this.name = "CsvParseError";
    this.code = code;
  }
}

const DELIMITER_CANDIDATES: readonly CsvDelimiter[] = [",", ";", "\t"];

const BYTE_ORDER_MARK = "\uFEFF";

/** csv-parse codes reported when a quoted field is not closed at all. */
const QUOTE_NOT_CLOSED = "CSV_QUOTE_NOT_CLOSED";

const ERROR_MESSAGES = {
  empty: "The CSV input is empty.",
  "no-records": "The CSV input contains no data records.",
  "unterminated-quote": "The CSV input ends inside an unterminated quoted field.",
  malformed: "The CSV contains malformed quoted fields.",
  "ambiguous-delimiter":
    "The CSV separator is ambiguous; check the header and choose an unambiguous file.",
  "column-mismatch": "A CSV row has more columns than the header.",
} as const;

/** Options every scan of this module uses: local, strict about quotes. */
function parseOptions(delimiter: CsvDelimiter) {
  return { delimiter, skip_empty_lines: true, relax_column_count: true };
}

/** Records the parser reported for one delimiter, or the failure code. */
type CsvScan = {
  readonly records: readonly (readonly string[])[];
  /** csv-parse error code; `undefined` when the full parse succeeded. */
  readonly errorCode: string | undefined;
  /** Header width, anchored separately when the full parse fails. */
  readonly headerWidth: number;
};

/** One candidate delimiter evaluated against the records it actually yields. */
type DelimiterEvaluation = {
  readonly delimiter: CsvDelimiter;
  /** Field count of the header record (0 when the input has no records). */
  readonly width: number;
  /** No quote failure and no record wider than the header. */
  readonly plausible: boolean;
  readonly scan: CsvScan;
};

/** Strip a single leading UTF-8 BOM only; inner content is never altered. */
function withoutByteOrderMark(text: string): string {
  return text.startsWith(BYTE_ORDER_MARK) ? text.slice(BYTE_ORDER_MARK.length) : text;
}

/** The `code` property of a csv-parse failure, when it carries one. */
function csvErrorCode(error: unknown): string | undefined {
  if (typeof error === "object" && error !== null && "code" in error) {
    const code = (error as { code?: unknown }).code;
    if (typeof code === "string") return code;
  }
  return undefined;
}

/**
 * Parse `text` under one delimiter with the sync csv-parse engine. When the
 * full parse fails, the header width is re-anchored with a header-only parse
 * (`to: 1`) so a malformed DATA row cannot erase the width the delimiter
 * evaluation needs; a header that fails on its own anchors at width 0.
 */
function scanRecords(text: string, delimiter: CsvDelimiter): CsvScan {
  let records: string[][];
  let errorCode: string | undefined;
  try {
    records = parse(text, parseOptions(delimiter));
  } catch (error) {
    errorCode = csvErrorCode(error);
    records = [];
  }

  let headerWidth = records[0]?.length ?? 0;
  if (errorCode !== undefined) {
    try {
      const headerOnly = parse(text, { ...parseOptions(delimiter), to: 1 });
      headerWidth = headerOnly[0]?.length ?? 0;
    } catch {
      headerWidth = 0;
    }
  }

  return { records, errorCode, headerWidth };
}

/** Evaluate one candidate delimiter: header width plus record consistency. */
function evaluateDelimiter(text: string, delimiter: CsvDelimiter): DelimiterEvaluation {
  const scan = scanRecords(text, delimiter);
  const width = scan.headerWidth;
  const plausible =
    scan.errorCode === undefined && scan.records.every((record) => record.length <= width);
  return { delimiter, width, plausible, scan };
}

function evaluateAllDelimiters(text: string): readonly DelimiterEvaluation[] {
  return DELIMITER_CANDIDATES.map((delimiter) => evaluateDelimiter(text, delimiter));
}

/**
 * Pick the best evaluated candidate: the widest header wins (the header, never
 * note punctuation, decides the separator), then structural plausibility breaks
 * ties, then declaration order (`,` before `;` before tab), which is the
 * deterministic legacy tie-break.
 */
function bestEvaluation(evaluations: readonly DelimiterEvaluation[]): DelimiterEvaluation {
  let best = evaluations[0];
  for (const candidate of evaluations) {
    if (candidate.width > best.width) {
      best = candidate;
      continue;
    }
    if (candidate.width === best.width && candidate.plausible && !best.plausible) {
      best = candidate;
    }
  }
  return best;
}

/**
 * Detect the most likely delimiter from the header: the candidate that yields
 * the widest header record wins, structural consistency (no quote failure, no
 * record wider than the header) breaks ties, and the remaining ties resolve in
 * the order of {@link DELIMITER_CANDIDATES} (`a,b;c\nd,e;f` stays `,`). An
 * input without any candidate returns `,`. Punctuation inside note cells never
 * competes with the header, and this helper never throws.
 */
export function detectCsvDelimiter(text: string): CsvDelimiter {
  return bestEvaluation(evaluateAllDelimiters(withoutByteOrderMark(text))).delimiter;
}

/**
 * Resolve the delimiter for parsing: unlike {@link detectCsvDelimiter}, two
 * equally plausible structural readings (same header width, both consistent)
 * are refused as `csv-ambiguous-delimiter` instead of guessed. Fail-closed:
 * when every multi-field candidate is invalid, one of them is kept so its
 * quote or column failure surfaces instead of a single-column reading that
 * would hide the anomaly.
 */
function resolveDelimiter(text: string): DelimiterEvaluation {
  const evaluations = evaluateAllDelimiters(text);
  const multiField = evaluations.filter((evaluation) => evaluation.width > 1);
  const plausible = multiField.filter((evaluation) => evaluation.plausible);
  if (plausible.length > 0) {
    const widest = plausible.reduce((max, evaluation) => Math.max(max, evaluation.width), 0);
    const contenders = plausible.filter((evaluation) => evaluation.width === widest);
    if (contenders.length > 1) {
      throw new CsvParseError("csv-ambiguous-delimiter", ERROR_MESSAGES["ambiguous-delimiter"]);
    }
    return contenders[0];
  }
  if (multiField.length > 0) {
    return multiField[0];
  }
  return bestEvaluation(evaluations);
}

/**
 * Parse CSV text into a normalized {@link StructuredGrid}.
 *
 * The first record is the header row; remaining records are data rows. Empty
 * fields (including quoted `""`) are `null` (absence, STRUCT-009); a data row
 * shorter than the header is padded with `null` (historic contract). Fully
 * blank unquoted lines are skipped; quoted whitespace-only content is preserved
 * verbatim.
 *
 * Failures: `csv-empty` (no records at all), `csv-unterminated-quote` (EOF
 * inside a quoted field), `csv-malformed` (malformed quoted fields),
 * `csv-ambiguous-delimiter` (two equally plausible separators) and
 * `csv-column-mismatch` (a row with more columns than the header).
 */
export function parseCsv(text: string, options: { delimiter?: CsvDelimiter } = {}): StructuredGrid {
  if (text.length === 0) {
    throw new CsvParseError("csv-empty", ERROR_MESSAGES.empty);
  }

  const source = withoutByteOrderMark(text);
  if (source.length === 0) {
    throw new CsvParseError("csv-empty", ERROR_MESSAGES.empty);
  }

  const scan = options.delimiter
    ? scanRecords(source, options.delimiter)
    : resolveDelimiter(source).scan;

  // A quote failure is never ignored: the table would be incomplete.
  if (scan.errorCode === QUOTE_NOT_CLOSED) {
    throw new CsvParseError("csv-unterminated-quote", ERROR_MESSAGES["unterminated-quote"]);
  }
  if (scan.errorCode !== undefined) {
    throw new CsvParseError("csv-malformed", ERROR_MESSAGES.malformed);
  }

  const [header, ...dataRecords] = scan.records;
  if (!header) {
    throw new CsvParseError("csv-empty", ERROR_MESSAGES["no-records"]);
  }

  const width = header.length;

  const rows = dataRecords.map((record) => {
    if (record.length > width) {
      // Data would be silently dropped: refuse instead.
      throw new CsvParseError("csv-column-mismatch", ERROR_MESSAGES["column-mismatch"]);
    }
    const cells: StructuredCell[] = record.map((value) => (value === "" ? null : value));
    while (cells.length < width) {
      cells.push(null); // ragged short record: missing trailing cells are absence
    }
    return cells;
  });

  return { headers: header, rows };
}

export { isBlankCell };
