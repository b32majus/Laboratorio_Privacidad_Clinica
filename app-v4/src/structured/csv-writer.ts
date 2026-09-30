/**
 * Deterministic CSV writer for the Safe Structured dataset (HARDEN-01 WU-A3).
 *
 * Mirrors the accepted parser's vocabulary (`csv.ts`, SPEC §8): fields that
 * contain a delimiter, a double quote or a line break are quoted, and an
 * embedded double quote is escaped as `""`. Row order is preserved and a blank
 * cell stays an empty field (absence), never a placeholder. No correspondence,
 * no original values, no reviewer notes: the Safe artifact carries only the
 * Safe dataset. Memory-only (D-013).
 */
import type { StructuredSafeDataset } from "./transformed-dataset";

/** Typed writer failure (fail-closed serialization). */
export class StructuredCsvError extends Error {
  readonly code = "INVALID_STRUCTURED_DATASET";

  constructor(message: string) {
    super(message);
    this.name = "StructuredCsvError";
  }
}

function isSafeDataset(value: unknown): value is StructuredSafeDataset {
  if (typeof value !== "object" || value === null) return false;
  const candidate = value as Partial<StructuredSafeDataset>;
  return (
    candidate.kind === "structured-safe-dataset" &&
    Array.isArray(candidate.headers) &&
    Array.isArray(candidate.rows)
  );
}

/** RFC-4180 field escaping aligned with the accepted parser. */
export function escapeCsvField(value: string): string {
  if (/[",\r\n]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
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
  const lines = [dataset.headers, ...dataset.rows].map((row) => row.map(escapeCsvField).join(","));
  return lines.join("\n");
}
