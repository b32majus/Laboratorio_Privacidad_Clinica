/**
 * Shared cell/grid vocabulary for V4 structured ingestion (T18 #22,
 * SPEC_V4_BATCH_AND_STRUCTURED.md §5-§9).
 *
 * A structured job sees a normalized grid: one header row plus data rows of
 * `StructuredCell` values. Absence (blank/empty cell) is represented exactly
 * once, as `null` (STRUCT-009, §9 "preserve null/blank values as absence"):
 * parsing and profiling never invent a placeholder category for a blank value,
 * and consumers can rely on `null` meaning "no value".
 *
 * Sensitive cell content is memory-only (D-013): this module never persists,
 * logs, or transmits grid values, and contains no console.* calls.
 */

/** A single normalized structured cell. `null` is the only representation of absence. */
export type StructuredCell = string | number | boolean | null;

/** Normalized structured table: header row plus data rows of equal intent (ragged rows are padded). */
export type StructuredGrid = {
  readonly headers: readonly string[];
  readonly rows: readonly (readonly StructuredCell[])[];
};

/**
 * Absence predicate for structured cells (STRUCT-009). `null` is absence by
 * construction; the empty string is a blank cell value and therefore absence
 * too. Whitespace-only strings are NOT absence: they are cell content and are
 * preserved verbatim (no silent trimming of user content).
 */
export function isBlankCell(cell: StructuredCell | undefined): boolean {
  return cell === null || cell === undefined || cell === "";
}
