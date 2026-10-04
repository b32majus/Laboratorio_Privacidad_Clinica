/**
 * Deterministic CSV writer for the Safe Structured dataset (HARDEN-01 WU-A3;
 * REC-04 WU-B typed scalars).
 *
 * Mirrors the accepted parser's vocabulary (`csv.ts`, SPEC §8): fields that
 * contain a delimiter, a double quote or a line break are quoted, and an
 * embedded double quote is escaped as `""`. Row order is preserved. `null`
 * (absence) stays an empty field, never a placeholder; other scalars
 * (`string`/`number`/`boolean`) are stringified and escaped safely
 * (RFC-4180 as today), so CSV bytes for string-only datasets stay
 * byte-compatible with today where the data has not changed. No
 * correspondence, no original values, no reviewer notes: the Safe artifact
 * carries only the Safe dataset. Memory-only (D-013).
 */
import type { StructuredSafeCell, StructuredSafeDataset } from "./transformed-dataset";

/** Typed writer failure (fail-closed serialization). */
export class StructuredCsvError extends Error {
  readonly code = "INVALID_STRUCTURED_DATASET";

  constructor(message: string) {
    super(message);
    this.name = "StructuredCsvError";
  }
}

function isSafeCell(value: unknown): value is StructuredSafeCell {
  return (
    value === null ||
    typeof value === "string" ||
    typeof value === "number" ||
    typeof value === "boolean"
  );
}

/**
 * Structural guard for the canonical Safe dataset shape. Exported as the
 * single shared fail-closed validator (REC-04 SM-1): the CSV writer and the
 * XLSX Safe serializer must agree on the same accepted shape rather than
 * keep two copies that can drift.
 */
export function isSafeDataset(value: unknown): value is StructuredSafeDataset {
  if (typeof value !== "object" || value === null) return false;
  const candidate = value as Partial<StructuredSafeDataset>;
  if (
    candidate.kind !== "structured-safe-dataset" ||
    !Array.isArray(candidate.headers) ||
    !Array.isArray(candidate.rows)
  ) {
    return false;
  }
  if (!candidate.headers.every((header) => typeof header === "string")) return false;
  return candidate.rows.every((row) => Array.isArray(row) && row.every((cell) => isSafeCell(cell)));
}

/** RFC-4180 field escaping aligned with the accepted parser. */
export function escapeCsvField(value: string): string {
  if (/[",\r\n]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

/** Render one Safe cell: `null` (absence) is an empty field, never a placeholder. */
export function stringifyCsvCell(cell: StructuredSafeCell): string {
  if (cell === null) return "";
  return String(cell);
}

/**
 * Serialize the Safe Structured dataset to a deterministic CSV string:
 * header row plus one line per data row, terminated by `\n` (no trailing
 * newline). Fails closed on a value that is not a structurally valid Safe
 * dataset.
 */
export function serializeStructuredSafeCsv(dataset: unknown): string {
  if (!isSafeDataset(dataset)) {
    throw new StructuredCsvError(
      "serializeStructuredSafeCsv requires a structurally valid structured Safe dataset."
    );
  }
  const lines = [dataset.headers, ...dataset.rows].map((row) =>
    row.map((cell) => escapeCsvField(stringifyCsvCell(cell))).join(",")
  );
  return lines.join("\n");
}
