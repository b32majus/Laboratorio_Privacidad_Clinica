/**
 * Canonical structured configuration authority for the V4 Configure workspace
 * (Work Order T20 #24; SPEC_V4_BATCH_AND_STRUCTURED.md §5-§7,
 * CURRENT_DECISIONS.md D-009/D-012, DEBT UX-015/PRODUCT-006).
 *
 * T20's Configure step presents the T18/T19 structured facts and lets a human
 * review/change the class of every column. This module is the DOMAIN authority
 * for that configuration:
 *
 *  - it consumes the T18 classification (`classification.ts`) and the single
 *    patient-ID authority (`patient-id.ts`) — it never re-derives either, so
 *    there is exactly one classification authority and exactly one patient-ID
 *    authority (SPEC §5/§6);
 *  - it exposes the five accepted classes verbatim
 *    (Identifier / Quasi-Identifier / Sensitive / Insensitive / Unknown,
 *    D-012) with confidence and value-free evidence for review (SPEC §7);
 *  - an explicit human override REBUILDS the frozen configuration (class,
 *    action, review requirement and export gate all move together) — it is
 *    never a label-only change;
 *  - an unresolved `unknown` column is ALWAYS `review-required`, never `keep`
 *    (D-009), and keeps the structured export gate closed until a human
 *    explicitly resolves it (SPEC §5 "UNKNOWN is not KEEP").
 *
 * This is a T20 Configure-workspace authority only: it intentionally carries
 * NO structured export pipeline and NO ARX-lite risk layer (SPEC §12/§13 are
 * later scope). Sensitive cell content stays memory-only (D-013): the
 * configuration carries structural facts and profiles, and the grid it wraps
 * is never persisted, logged or placed in a URL.
 */
import {
  classifyGridColumns,
  proposedActionForClass,
  type ColumnClass,
  type ColumnClassification,
  type ProposedAction,
} from "./classification";
import type { ColumnSampleType } from "./column-profile";
import { isBlankCell, type StructuredGrid } from "./grid";
import { resolvePatientIdColumn, type PatientIdResolution } from "./patient-id";

/** Machine-readable codes carried by {@link StructuredConfigurationError}. */
export type StructuredConfigurationErrorCode = "unknown-column" | "invalid-class" | "invalid-grid";

/** Typed configuration failure (D-009 fail-closed). */
export class StructuredConfigurationError extends Error {
  readonly code: StructuredConfigurationErrorCode;

  constructor(code: StructuredConfigurationErrorCode, message: string) {
    super(message);
    this.name = "StructuredConfigurationError";
    this.code = code;
  }
}

/** The five accepted structured classes, in display order (D-012). */
export const STRUCTURED_COLUMN_CLASSES: readonly ColumnClass[] = Object.freeze([
  "identifier",
  "quasi-identifier",
  "sensitive",
  "insensitive",
  "unknown",
]);

/** One column's resolved, review-facing classification state. */
export type StructuredColumnState = {
  readonly columnIndex: number;
  readonly header: string;
  readonly inferredType: ColumnSampleType;
  readonly nonEmptyCount: number;
  readonly emptyCount: number;
  readonly sampledCount: number;
  /** The class proposed by automatic classification (T18, never overridden). */
  readonly detectedClass: ColumnClass;
  /** The class in effect for this configuration (override or detected). */
  readonly effectiveClass: ColumnClass;
  /** True exactly when a human explicitly overrode the detected class. */
  readonly overridden: boolean;
  /** Action proposed for the effective class; `review-required` for unknown. */
  readonly proposedAction: ProposedAction;
  /** True exactly when the effective class is `unknown` (fail-closed review). */
  readonly requiresReview: boolean;
  /** Confidence of the automatic classification (0..1), for human review. */
  readonly confidence: number;
  /** Value-free structural evidence for human review (SPEC §7). */
  readonly evidence: readonly string[];
  readonly matchedBy: ColumnClassification["matchedBy"];
};

/**
 * Frozen canonical structured configuration. `exportReady` is the structured
 * export gate: it is false while ANY column requires review (unknown with no
 * explicit resolution), so an unknown column can never silently become
 * exportable.
 */
export type StructuredConfiguration = {
  readonly grid: StructuredGrid;
  readonly columns: readonly StructuredColumnState[];
  /** The explicit patient-ID selection (or `null`); the ONLY authority source. */
  readonly selectedPatientIdColumn: string | null;
  readonly patientId: PatientIdResolution;
  /** Explicit human overrides, keyed by column index. */
  readonly overrides: Readonly<Record<number, ColumnClass>>;
  /** Column indices whose effective class is `unknown` (review required). */
  readonly columnsRequiringReview: readonly number[];
  /** Structured export gate (false while any column requires review). */
  readonly exportReady: boolean;
};

function assertGrid(grid: StructuredGrid): void {
  const candidate = grid as Partial<StructuredGrid> | null;
  if (
    candidate === null ||
    typeof candidate !== "object" ||
    !Array.isArray(candidate.headers) ||
    !Array.isArray(candidate.rows)
  ) {
    throw new StructuredConfigurationError(
      "invalid-grid",
      "A structured configuration requires a normalized grid (headers + rows); failing closed instead of guessing."
    );
  }
}

function assertClass(columnClass: ColumnClass): void {
  if (!STRUCTURED_COLUMN_CLASSES.includes(columnClass)) {
    throw new StructuredConfigurationError(
      "invalid-class",
      `"${String(columnClass)}" is not an accepted structured class; the accepted classes are ${STRUCTURED_COLUMN_CLASSES.join(
        ", "
      )}.`
    );
  }
}

/** Freeze the patient-ID resolution (including its candidate list). */
function freezePatientId(patientId: PatientIdResolution): PatientIdResolution {
  if (patientId.status === "not-selected") {
    return Object.freeze({
      status: "not-selected",
      candidates: Object.freeze([...patientId.candidates]),
    });
  }
  return Object.freeze({ ...patientId });
}

function resolveColumnState(
  classification: ColumnClassification,
  override: ColumnClass | undefined
): StructuredColumnState {
  const detectedClass = classification.columnClass;
  const effectiveClass = override ?? detectedClass;
  return Object.freeze({
    columnIndex: classification.column.columnIndex,
    header: classification.column.header,
    inferredType: classification.column.inferredType,
    nonEmptyCount: classification.column.nonEmptyCount,
    emptyCount: classification.column.emptyCount,
    sampledCount: classification.column.sampledCount,
    detectedClass,
    effectiveClass,
    overridden: override !== undefined,
    proposedAction: proposedActionForClass(effectiveClass),
    requiresReview: effectiveClass === "unknown",
    confidence: classification.confidence,
    evidence: Object.freeze([...classification.evidence]),
    matchedBy: classification.matchedBy,
  });
}

/** Build the frozen configuration from a grid, a selection and overrides. */
function buildConfiguration(
  grid: StructuredGrid,
  selectedPatientIdColumn: string | null,
  overrides: Readonly<Record<number, ColumnClass>>
): StructuredConfiguration {
  assertGrid(grid);
  const classifications = classifyGridColumns(grid);

  const normalizedOverrides: Record<number, ColumnClass> = {};
  for (const [rawKey, columnClass] of Object.entries(overrides)) {
    const columnIndex = Number(rawKey);
    if (
      !Number.isInteger(columnIndex) ||
      columnIndex < 0 ||
      columnIndex >= classifications.length
    ) {
      throw new StructuredConfigurationError(
        "unknown-column",
        `Override references column index ${String(rawKey)}, which does not exist in this structured job (${classifications.length} column(s)).`
      );
    }
    assertClass(columnClass);
    normalizedOverrides[columnIndex] = columnClass;
  }

  const columns = classifications.map((classification) =>
    resolveColumnState(classification, normalizedOverrides[classification.column.columnIndex])
  );
  const columnsRequiringReview = columns
    .filter((column) => column.requiresReview)
    .map((column) => column.columnIndex);

  return Object.freeze({
    grid,
    columns: Object.freeze(columns),
    selectedPatientIdColumn,
    patientId: freezePatientId(
      resolvePatientIdColumn({
        selectedPatientIdColumn,
        classifications,
      })
    ),
    overrides: Object.freeze({ ...normalizedOverrides }),
    columnsRequiringReview: Object.freeze(columnsRequiringReview),
    exportReady: columnsRequiringReview.length === 0,
  });
}

/**
 * Create the canonical configuration of a structured grid. `unknown` columns
 * start requiring review (never KEEP); the patient-ID authority starts
 * unselected unless an explicit selection is supplied (SPEC §6).
 */
export function createStructuredConfiguration(
  grid: StructuredGrid,
  options: {
    readonly selectedPatientIdColumn?: string | null;
    readonly overrides?: Readonly<Record<number, ColumnClass>>;
  } = {}
): StructuredConfiguration {
  return buildConfiguration(grid, options.selectedPatientIdColumn ?? null, options.overrides ?? {});
}

/**
 * Apply an explicit human override of one column's class. Rebuilds the frozen
 * configuration so the class, its derived action, its review requirement and
 * the export gate all move together. Fails closed on an out-of-range column or
 * a class outside the five accepted ones.
 */
export function overrideColumnClass(
  configuration: StructuredConfiguration,
  columnIndex: number,
  columnClass: ColumnClass
): StructuredConfiguration {
  assertClass(columnClass);
  if (
    !Number.isInteger(columnIndex) ||
    columnIndex < 0 ||
    columnIndex >= configuration.columns.length
  ) {
    throw new StructuredConfigurationError(
      "unknown-column",
      `Cannot override column index ${String(columnIndex)}: this structured job has ${configuration.columns.length} column(s).`
    );
  }
  return buildConfiguration(configuration.grid, configuration.selectedPatientIdColumn, {
    ...configuration.overrides,
    [columnIndex]: columnClass,
  });
}

/**
 * Set the single patient-ID column authority (or clear it with `null`).
 * Rebuilds the frozen configuration through the T18 `resolvePatientIdColumn`
 * authority; the UI never constructs the resolution itself.
 */
export function selectPatientIdColumn(
  configuration: StructuredConfiguration,
  header: string | null
): StructuredConfiguration {
  return buildConfiguration(configuration.grid, header, configuration.overrides);
}

/**
 * The structured export gate fact (D-009). False while any column still
 * requires review — an unknown column is never exportable without an explicit
 * human class decision.
 */
export function isStructuredExportReady(configuration: StructuredConfiguration): boolean {
  return configuration.exportReady;
}

export { isBlankCell };
export type { ColumnClass, ColumnClassification, ProposedAction };
