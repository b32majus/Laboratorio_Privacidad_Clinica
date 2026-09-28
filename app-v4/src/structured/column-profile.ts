/**
 * Column profiling for V4 structured ingestion (T18 #22, SPEC_V4_BATCH_AND_
 * STRUCTURED.md §7, DEBT STRUCT-004).
 *
 * SPEC §7: "Inference must sample multiple non-empty values distributed
 * through the column, not only the first data row" and requires "inferred
 * type/class; confidence/evidence sufficient for review".
 *
 * Sampling therefore walks the whole column and takes an evenly spaced subset
 * of its non-empty values (blank cells are absence, STRUCT-009, and never
 * contribute to type inference). A misleading first data row cannot decide
 * the inferred type on its own.
 *
 * Sensitive content is memory-only (D-013): profiles carry structural facts
 * (type, counts, confidence) and never embed sampled cell values.
 */
import { isBlankCell, type StructuredCell, type StructuredGrid } from "./grid";

export type ColumnSampleType = "number" | "date" | "boolean" | "text" | "empty";

export type ColumnProfile = {
  readonly header: string;
  readonly columnIndex: number;
  readonly inferredType: ColumnSampleType;
  readonly nonEmptyCount: number;
  readonly emptyCount: number;
  /** How many non-empty values were actually sampled (≤ sampleSize, distributed). */
  readonly sampledCount: number;
  /** Fraction of sampled non-empty values consistent with the inferred type (0..1). */
  readonly confidence: number;
  /** Human-reviewable structural evidence; contains no cell values. */
  readonly evidence: readonly string[];
};

const DEFAULT_SAMPLE_SIZE = 12;

const ISO_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const SLASH_DATE_PATTERN = /^\d{1,2}\/\d{1,2}\/\d{4}$/;

function valueKind(value: StructuredCell): Exclude<ColumnSampleType, "empty"> {
  if (typeof value === "number") {
    return Number.isFinite(value) ? "number" : "text";
  }
  if (typeof value === "boolean") {
    return "boolean";
  }
  const text = value as string;
  if (ISO_DATE_PATTERN.test(text) || SLASH_DATE_PATTERN.test(text)) {
    return "date";
  }
  if (text === "true" || text === "false" || text === "TRUE" || text === "FALSE") {
    return "boolean";
  }
  if (text.trim() !== "" && Number.isFinite(Number(text))) {
    return "number";
  }
  return "text";
}

/**
 * Evenly sample up to `sampleSize` non-empty values of a column, distributed
 * across the whole row range. Deterministic: for n non-empty values it keeps
 * indices round(i * (n - 1) / (sampleSize - 1)). Exported for value-consuming
 * consumers (content-evidence classification) that share the exact same
 * distributed-sampling rule.
 */
function sampleNonEmpty(values: readonly StructuredCell[], sampleSize: number): StructuredCell[] {
  const nonEmpty = values.filter((value) => !isBlankCell(value));
  if (nonEmpty.length <= sampleSize) {
    return [...nonEmpty];
  }
  const sampled: StructuredCell[] = [];
  for (let i = 0; i < sampleSize; i += 1) {
    const index = Math.round((i * (nonEmpty.length - 1)) / (sampleSize - 1));
    sampled.push(nonEmpty[index]);
  }
  return sampled;
}

/**
 * Evenly distributed non-empty sample of one column (see {@link sampleNonEmpty}).
 * Samples stay memory-only (D-013): consumers must never persist or log them.
 */
export function sampleColumnValues(
  grid: StructuredGrid,
  columnIndex: number,
  sampleSize?: number
): StructuredCell[] {
  const columnValues = grid.rows.map((row) => (columnIndex < row.length ? row[columnIndex] : null));
  return sampleNonEmpty(columnValues, Math.max(2, sampleSize ?? DEFAULT_SAMPLE_SIZE));
}

/**
 * Profile every column of the grid. The inferred type is the kind shared by
 * every sampled non-empty value when consistent; otherwise `text` (the least
 * assuming kind). An all-blank column infers `empty` with zero confidence.
 */
export function profileColumns(
  grid: StructuredGrid,
  options: { sampleSize?: number } = {}
): ColumnProfile[] {
  const sampleSize = Math.max(2, options.sampleSize ?? DEFAULT_SAMPLE_SIZE);
  const rowCount = grid.rows.length;

  return grid.headers.map((header, columnIndex) => {
    const columnValues = grid.rows.map((row) =>
      columnIndex < row.length ? row[columnIndex] : null
    );
    const nonEmptyCount = columnValues.filter((value) => !isBlankCell(value)).length;
    const emptyCount = rowCount - nonEmptyCount;

    const sampled = sampleNonEmpty(columnValues, sampleSize);
    const kinds = sampled.map(valueKind);

    let inferredType: ColumnSampleType;
    let confidence: number;
    if (kinds.length === 0) {
      inferredType = "empty";
      confidence = 0;
    } else {
      const tally = new Map<Exclude<ColumnSampleType, "empty">, number>();
      for (const kind of kinds) {
        tally.set(kind, (tally.get(kind) ?? 0) + 1);
      }
      let majorityKind: Exclude<ColumnSampleType, "empty"> = kinds[0];
      let majorityCount = 0;
      for (const [kind, count] of tally) {
        if (count > majorityCount || (count === majorityCount && kind === "text")) {
          majorityKind = kind;
          majorityCount = count;
        }
      }
      if (majorityCount === kinds.length) {
        inferredType = majorityKind;
        confidence = 1;
      } else {
        // Mixed evidence: fall back to text with the majority fraction as
        // confidence — never a confident guess from partial consistency.
        inferredType = "text";
        confidence = majorityCount / kinds.length;
      }
    }

    const evidence: string[] = [
      `${rowCount} data row(s)`,
      `${nonEmptyCount} non-empty / ${emptyCount} blank value(s)`,
      `${sampled.length} non-empty value(s) sampled across the column`,
    ];
    if (inferredType !== "empty" && kinds.length > 0) {
      const consistent = kinds.filter((kind) => kind === inferredType).length;
      evidence.push(
        `inferred ${inferredType}: ${consistent}/${kinds.length} sampled value(s) consistent`
      );
    } else {
      evidence.push("no non-empty values to infer from");
    }

    return {
      header,
      columnIndex,
      inferredType,
      nonEmptyCount,
      emptyCount,
      sampledCount: sampled.length,
      confidence,
      evidence,
    };
  });
}
