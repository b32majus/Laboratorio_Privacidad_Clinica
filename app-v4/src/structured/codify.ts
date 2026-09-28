/**
 * Codification with blank preservation for V4 structured ingestion (T18 #22,
 * SPEC_V4_BATCH_AND_STRUCTURED.md §9, DEBT STRUCT-009).
 *
 * SPEC §9: "do not CODIFY an empty value into a category" and "preserve
 * null/blank values as absence". Codification here is the deterministic
 * category-map step (stable integer codes per distinct value, first-appearance
 * order) that a later policy layer would use for CODIFY-proposed columns.
 *
 * Hard invariant: a blank value (null / "" / missing) is absence. It is never
 * assigned a category code, never added to the category map, and stays `null`
 * in the codified output. Codified output is structural (codes + map), never a
 * shareable artifact (Safe Output / Confidential Audit separation, D-005).
 */
import { isBlankCell, type StructuredCell } from "./grid";

export type CodifyResult = {
  /** Category map: distinct non-blank value → stable code (first-appearance order). */
  readonly mapping: ReadonlyMap<string, number>;
  /** Codes aligned with the input; blank inputs stay `null` (absence). */
  readonly coded: readonly (number | null)[];
};

/**
 * Codify a column's values. Blank values remain absence and never enter the
 * category map; distinct non-blank values share a stable code.
 */
export function codifyColumnValues(values: readonly StructuredCell[]): CodifyResult {
  const mapping = new Map<string, number>();
  const coded: (number | null)[] = [];

  for (const value of values) {
    if (isBlankCell(value)) {
      coded.push(null);
      continue;
    }
    const text = String(value);
    let code = mapping.get(text);
    if (code === undefined) {
      code = mapping.size;
      mapping.set(text, code);
    }
    coded.push(code);
  }

  return { mapping, coded };
}
