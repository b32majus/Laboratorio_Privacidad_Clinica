/**
 * Structured transformed dataset + export readiness (HARDEN-01 WU-A, #47 §A;
 * REC-03 WU-B D-021 Class→Action authority).
 *
 * This is the SINGLE production module that activates the accepted structured
 * transformations: it is the only caller of `applyStructuredDateAgePolicy`
 * (T19) and `codifyColumnValues` (T18, reused ONLY as the internal
 * first-appearance primitive behind structured `pseudonymize`), and it only
 * ever runs through a {@link StructuredTransformPlan} derived from the
 * reviewed configuration's effective Action.
 *
 * Separation (D-005 / PRIV-002, HARDEN-01 §6):
 *  - `safe`: the Safe Structured dataset — transformed/kept cells only. A
 *    `remove` column (ordinary Identifier) is dropped entirely and never
 *    appears; there is no correspondence field. The selected patient-ID
 *    column is `study-id` (REC-03 D-021): Safe carries `ID_ESTUDIO` in its
 *    place, never the original header or values. A `pseudonymize` column
 *    carries column-local `QID_###` tokens; the original↔token mapping below
 *    is the ONLY place the correspondence exists. A `keep` column (Sensitive
 *    default, Insensitive) is preserved verbatim with no correspondence.
 *  - `confidential`: the separate original↔transformed correspondence for the
 *    date/age, pseudonymize, study-id and remove decisions. Never merged with
 *    `safe`.
 *
 * Fail-closed (D-009): while any column is unsupported, the patient-ID needed
 * by a shift policy is missing, or any date/age cell requires review, the
 * preparation is `blocked` and no Safe artifact exists. A cell is never
 * silently kept, blanked or dropped.
 *
 * Memory-only (D-013): the dataset is plain frozen values; nothing here
 * persists, logs or transmits.
 */
import { codifyColumnValues } from "./codify";
import type { StructuredConfiguration } from "./configuration";
import { applyStructuredDateAgePolicy, type StructuredDateAgeApplication } from "./date-age-policy";
import type { StructuredDateCellOutcome } from "./date-age";
import { isBlankCell, type StructuredCell } from "./grid";
import { buildStudyIdMapping, STUDY_ID_HEADER } from "./study-id";
import type { StructuredTransformPlan, StructuredTransformPlanColumn } from "./transform-plan";

/** The Safe structured dataset: flattened cells, no correspondence field. */
export type StructuredSafeDataset = {
  readonly kind: "structured-safe-dataset";
  readonly headers: readonly string[];
  readonly rows: readonly (readonly string[])[];
};

/** One original↔transformed entry (Confidential only). */
export type StructuredCorrespondenceEntry = {
  readonly original: string;
  readonly transformed: string | null;
};

/** Per-column correspondence for a transformed/removed column. */
export type StructuredCorrespondenceColumn = {
  readonly columnIndex: number;
  readonly header: string;
  readonly disposition: "date-age" | "pseudonymize" | "remove" | "study-id";
  readonly entries: readonly StructuredCorrespondenceEntry[];
};

/** Coarse correspondence totals for the Confidential artifact header. */
export type StructuredCorrespondenceTotals = {
  readonly dateAge: number;
  readonly pseudonymize: number;
  readonly remove: number;
  readonly studyId: number;
  readonly transformedCells: number;
};

/** The separate Confidential correspondence artifact. */
export type StructuredConfidentialCorrespondence = {
  readonly kind: "structured-confidential-correspondence";
  readonly policyId: string;
  readonly columns: readonly StructuredCorrespondenceColumn[];
  readonly totals: StructuredCorrespondenceTotals;
};

/** A cell the accepted policy could not transform safely. */
export type StructuredReviewRequiredCell = {
  readonly columnIndex: number;
  readonly rowIndex: number;
  readonly reason: string;
};

/** The computed structured output of a ready plan. */
export type StructuredOutput = {
  readonly safe: StructuredSafeDataset;
  readonly confidential: StructuredConfidentialCorrespondence;
  readonly reviewRequiredCells: readonly StructuredReviewRequiredCell[];
};

/** Preparation outcome: a ready output, or the exact fail-closed block reasons. */
export type StructuredOutputPreparation =
  | {
      readonly status: "ready";
      readonly output: StructuredOutput;
      readonly reasons: readonly string[];
    }
  | { readonly status: "blocked"; readonly output: null; readonly reasons: readonly string[] };

function columnLabel(column: StructuredTransformPlanColumn): string {
  return column.header === "" ? "(unnamed column)" : column.header;
}

/**
 * Deterministic structured pseudonymization (REC-03 WU-B, D-021):
 * column-local categorical tokens `QID_001`, `QID_002`, … by first appearance
 * of each distinct non-blank value; repeated values reuse the token; blanks
 * stay blank (`""` here, `null` in the mapping sense) and never enter the
 * mapping. Built on `codifyColumnValues` as the internal first-appearance
 * primitive — `codify` itself is NOT a user-facing action contract.
 */
export function formatQuasiToken(sequence: number): string {
  return `QID_${String(sequence).padStart(3, "0")}`;
}

/** Pseudonymize one column's values: tokens aligned with the input. */
export function pseudonymizeColumnValues(values: readonly StructuredCell[]): readonly string[] {
  const { coded } = codifyColumnValues(values);
  return Object.freeze(
    coded.map((code) => (code === null || code === undefined ? "" : formatQuasiToken(code + 1)))
  );
}

function formatCell(cell: StructuredCell | undefined): string {
  return isBlankCell(cell) ? "" : String(cell);
}

function dateRoleHeader(
  plan: StructuredTransformPlan,
  role: "visit-date" | "birth-date"
): string | null {
  const column = plan.columns.find(
    (candidate) => candidate.disposition.kind === "date-age" && candidate.disposition.role === role
  );
  return column ? column.header : null;
}

/**
 * Exact fail-closed block reasons of a plan (plus any per-cell date/age
 * reviews). Text-first; never color-only. Empty means the plan is exportable.
 *
 * The optional `configuration` carries the grid values needed for the REC-03
 * Study-ID blank-patient-ID check; without it only the structural Study-ID
 * header-collision check applies.
 */
export function structuredBlockReasons(
  plan: StructuredTransformPlan,
  reviewRequiredCells: readonly StructuredReviewRequiredCell[] = [],
  configuration?: StructuredConfiguration
): readonly string[] {
  const reasons: string[] = [];
  const unsupported = plan.columns.filter((column) => column.disposition.kind === "unsupported");

  const unknown = unsupported.filter(
    (column) =>
      column.disposition.kind === "unsupported" &&
      column.disposition.reason === "unknown-review-required"
  );
  if (unknown.length === 1) {
    reasons.push("Structured export is blocked while 1 column requires review.");
  } else if (unknown.length > 1) {
    reasons.push(`Structured export is blocked while ${unknown.length} columns require review.`);
  }

  for (const column of unsupported) {
    if (column.disposition.kind !== "unsupported") continue;
    if (column.disposition.reason === "generalize-without-operator") {
      reasons.push(
        `Structured export is blocked: column "${columnLabel(column)}" has no accepted structured transformation.`
      );
    } else if (column.disposition.reason === "unsupported-action") {
      reasons.push(
        `Structured export is blocked: column "${columnLabel(column)}" uses an action with no structured operator.`
      );
    }
  }

  if (plan.missingPatientId) {
    reasons.push(
      `Structured export is blocked: policy "${plan.policyId}" shifts visit dates per patient and no patient-ID column is selected.`
    );
  }

  // REC-03 WU-A Study-ID fail-closed checks (D-021): a Safe header collision
  // with another input column, and a blank selected patient-ID cell on a row
  // that carries other data (an unlinkable Safe row is never produced).
  const studyIdColumns = plan.columns.filter((column) => column.disposition.kind === "study-id");
  for (const studyColumn of studyIdColumns) {
    const colliding = plan.columns.filter(
      (column) =>
        column.columnIndex !== studyColumn.columnIndex &&
        column.header === STUDY_ID_HEADER &&
        (column.disposition.kind === "keep" ||
          column.disposition.kind === "pseudonymize" ||
          column.disposition.kind === "date-age")
    );
    for (const other of colliding) {
      const otherLabel = other.header === "" ? "(unnamed column)" : other.header;
      reasons.push(
        `Structured export is blocked: Safe header "${STUDY_ID_HEADER}" is already used by another input column "${otherLabel}"; the Study-ID column is never written over it silently.`
      );
    }
  }
  if (configuration !== undefined) {
    for (const studyColumn of studyIdColumns) {
      const label = studyColumn.header === "" ? "(unnamed column)" : studyColumn.header;
      configuration.grid.rows.forEach((row, rowIndex) => {
        if (!isBlankCell(row[studyColumn.columnIndex])) return;
        const hasOtherData = row.some(
          (cell, cellIndex) => cellIndex !== studyColumn.columnIndex && !isBlankCell(cell)
        );
        if (!hasOtherData) return;
        reasons.push(
          `Structured export is blocked: data row ${rowIndex + 1} has other data but no value in the patient-ID column "${label}"; an unlinkable Safe row is never produced.`
        );
      });
    }
  }

  if (reviewRequiredCells.length === 1) {
    reasons.push(
      "Structured export is blocked: 1 date/age cell requires review (unparseable or without the required reference)."
    );
  } else if (reviewRequiredCells.length > 1) {
    reasons.push(
      `Structured export is blocked: ${reviewRequiredCells.length} date/age cells require review (unparseable or without the required reference).`
    );
  }

  return Object.freeze(reasons);
}

/**
 * Compute the Safe dataset and the separate Confidential correspondence of a
 * structurally-ready plan. Throws when the plan is not structurally ready:
 * callers must go through {@link prepareStructuredOutput}.
 */
export function computeStructuredOutput(
  configuration: StructuredConfiguration,
  plan: StructuredTransformPlan
): StructuredOutput {
  if (!plan.dispositionsReady) {
    throw new Error(
      "computeStructuredOutput requires a structurally-ready plan; failing closed instead of producing a partial Safe dataset."
    );
  }
  const grid = configuration.grid;

  const dateColumns = plan.columns.filter((column) => column.disposition.kind === "date-age");
  let dateApplication: StructuredDateAgeApplication | null = null;
  if (dateColumns.length > 0) {
    dateApplication = applyStructuredDateAgePolicy({
      grid,
      policyId: plan.policyId,
      jobSeed: plan.jobSeed,
      visitDateColumn: dateRoleHeader(plan, "visit-date"),
      birthDateColumn: dateRoleHeader(plan, "birth-date"),
      patientIdColumn: plan.patientIdColumn,
    });
  }

  const visitOutcomes: readonly StructuredDateCellOutcome[] =
    dateApplication?.visitDate?.cells ?? [];
  const birthOutcomes: readonly StructuredDateCellOutcome[] =
    dateApplication?.birthDate?.cells ?? [];

  const reviewRequiredCells: StructuredReviewRequiredCell[] = [];
  const correspondenceColumns: StructuredCorrespondenceColumn[] = [];
  const safeHeaders: string[] = [];
  const safeColumnIndices: number[] = [];

  const valuesFor = (columnIndex: number): readonly StructuredCell[] =>
    grid.rows.map((row) => row[columnIndex]);

  // Deterministic Study-ID mappings per study-id column, built once and
  // reused for correspondence and Safe materialization.
  const studyIdsByColumn = new Map<number, readonly (string | null)[]>();

  const dateOutcomesFor = (
    column: StructuredTransformPlanColumn
  ): readonly StructuredDateCellOutcome[] =>
    column.disposition.kind === "date-age" && column.disposition.role === "birth-date"
      ? birthOutcomes
      : visitOutcomes;

  for (const column of plan.columns) {
    const disposition = column.disposition;
    if (disposition.kind === "remove") {
      correspondenceColumns.push(
        Object.freeze({
          columnIndex: column.columnIndex,
          header: column.header,
          disposition: "remove" as const,
          entries: Object.freeze(
            valuesFor(column.columnIndex)
              .filter((cell) => !isBlankCell(cell))
              .map((cell) => Object.freeze({ original: String(cell), transformed: null }))
          ),
        })
      );
      continue;
    }

    if (disposition.kind === "study-id") {
      // D-021: the selected patient-ID column is replaced in place by
      // `ID_ESTUDIO`; the original header/values never enter Safe output and
      // the unique original↔Study-ID mapping is Confidential-only.
      const mapping = buildStudyIdMapping(valuesFor(column.columnIndex));
      // Defense in depth: preparation blocks these rows first (see
      // structuredBlockReasons), but a direct compute call must still never
      // emit an unlinkable row silently.
      mapping.studyIds.forEach((studyId, rowIndex) => {
        if (studyId !== null) return;
        const row = grid.rows[rowIndex] ?? [];
        const hasOtherData = row.some(
          (cell, cellIndex) => cellIndex !== column.columnIndex && !isBlankCell(cell)
        );
        if (hasOtherData) {
          throw new Error(
            `computeStructuredOutput found data row ${rowIndex + 1} with no value in the patient-ID column "${columnLabel(column)}"; failing closed instead of producing an unlinkable Safe row.`
          );
        }
      });
      correspondenceColumns.push(
        Object.freeze({
          columnIndex: column.columnIndex,
          header: column.header,
          disposition: "study-id" as const,
          entries: Object.freeze(
            [...mapping.mapping.entries()].map(([original, transformed]) =>
              Object.freeze({ original, transformed })
            )
          ),
        })
      );
      studyIdsByColumn.set(column.columnIndex, mapping.studyIds);
      safeHeaders.push(STUDY_ID_HEADER);
      safeColumnIndices.push(column.columnIndex);
      continue;
    }

    if (disposition.kind === "unsupported") {
      // Unreachable for a ready plan; keep the guard explicit and fail closed.
      throw new Error(
        `computeStructuredOutput received an unsupported disposition for column ${column.columnIndex}; failing closed.`
      );
    }

    safeHeaders.push(column.header);
    safeColumnIndices.push(column.columnIndex);

    if (disposition.kind === "date-age") {
      const outcomes = dateOutcomesFor(column);
      const entries: StructuredCorrespondenceEntry[] = [];
      grid.rows.forEach((row, rowIndex) => {
        const outcome = outcomes[rowIndex];
        const raw = formatCell(row[column.columnIndex]);
        if (outcome === undefined || outcome.kind === "absent") {
          entries.push(Object.freeze({ original: raw, transformed: null }));
          return;
        }
        if (outcome.kind === "transformed") {
          entries.push(Object.freeze({ original: raw, transformed: outcome.value }));
          return;
        }
        reviewRequiredCells.push(
          Object.freeze({ columnIndex: column.columnIndex, rowIndex, reason: outcome.reason })
        );
        entries.push(Object.freeze({ original: raw, transformed: null }));
      });
      correspondenceColumns.push(
        Object.freeze({
          columnIndex: column.columnIndex,
          header: column.header,
          disposition: "date-age" as const,
          entries: Object.freeze(entries),
        })
      );
      continue;
    }

    if (disposition.kind === "pseudonymize") {
      // D-021: deterministic column-local categorical tokenization. Blanks
      // remain blank and never enter the Confidential mapping; repeated
      // values reuse the token assigned at first appearance.
      const tokens = pseudonymizeColumnValues(valuesFor(column.columnIndex));
      const entries: StructuredCorrespondenceEntry[] = [];
      grid.rows.forEach((row, rowIndex) => {
        const token = tokens[rowIndex];
        if (token === "" || token === undefined) return;
        entries.push(
          Object.freeze({
            original: formatCell(row[column.columnIndex]),
            transformed: token,
          })
        );
      });
      correspondenceColumns.push(
        Object.freeze({
          columnIndex: column.columnIndex,
          header: column.header,
          disposition: "pseudonymize" as const,
          entries: Object.freeze(entries),
        })
      );
      continue;
    }

    // keep: preserved verbatim in the Safe dataset, no correspondence.
  }

  // Materialize the Safe cells per column index (pseudonymize needs the whole
  // column before per-row output).
  const safeCellsByColumnIndex = new Map<number, readonly string[]>();
  for (const column of plan.columns) {
    const disposition = column.disposition;
    if (disposition.kind === "remove" || disposition.kind === "unsupported") continue;
    if (disposition.kind === "date-age") {
      const outcomes = dateOutcomesFor(column);
      safeCellsByColumnIndex.set(
        column.columnIndex,
        Object.freeze(
          grid.rows.map((_row, rowIndex) => {
            const outcome = outcomes[rowIndex];
            return outcome !== undefined && outcome.kind === "transformed" ? outcome.value : "";
          })
        )
      );
    } else if (disposition.kind === "pseudonymize") {
      const tokens = pseudonymizeColumnValues(valuesFor(column.columnIndex));
      safeCellsByColumnIndex.set(column.columnIndex, Object.freeze([...tokens]));
    } else if (disposition.kind === "study-id") {
      const studyIds = studyIdsByColumn.get(column.columnIndex) ?? [];
      safeCellsByColumnIndex.set(
        column.columnIndex,
        Object.freeze(studyIds.map((studyId) => studyId ?? ""))
      );
    } else {
      safeCellsByColumnIndex.set(
        column.columnIndex,
        Object.freeze(valuesFor(column.columnIndex).map((cell) => formatCell(cell)))
      );
    }
  }

  const safeRows = Object.freeze(
    grid.rows.map((_row, rowIndex) =>
      Object.freeze(
        safeColumnIndices.map(
          (columnIndex) => safeCellsByColumnIndex.get(columnIndex)?.[rowIndex] ?? ""
        )
      )
    )
  );

  const totals: StructuredCorrespondenceTotals = Object.freeze({
    dateAge: correspondenceColumns.filter((column) => column.disposition === "date-age").length,
    pseudonymize: correspondenceColumns.filter((column) => column.disposition === "pseudonymize")
      .length,
    remove: correspondenceColumns.filter((column) => column.disposition === "remove").length,
    studyId: correspondenceColumns.filter((column) => column.disposition === "study-id").length,
    transformedCells: correspondenceColumns.reduce(
      (count, column) =>
        count +
        column.entries.reduce((sum, entry) => sum + (entry.transformed !== null ? 1 : 0), 0),
      0
    ),
  });

  return Object.freeze({
    safe: Object.freeze({
      kind: "structured-safe-dataset" as const,
      headers: Object.freeze(safeHeaders),
      rows: safeRows,
    }),
    confidential: Object.freeze({
      kind: "structured-confidential-correspondence" as const,
      policyId: plan.policyId,
      columns: Object.freeze(correspondenceColumns),
      totals,
    }),
    reviewRequiredCells: Object.freeze(reviewRequiredCells),
  });
}

/**
 * Prepare the structured output of a reviewed configuration: the exact Safe
 * dataset + separate Confidential correspondence, or the fail-closed block
 * reasons. This is the only gate the bridge and the export surface need.
 */
export function prepareStructuredOutput(
  configuration: StructuredConfiguration,
  plan: StructuredTransformPlan
): StructuredOutputPreparation {
  const structuralReasons = structuredBlockReasons(plan, [], configuration);
  if (structuralReasons.length > 0) {
    return Object.freeze({ status: "blocked" as const, output: null, reasons: structuralReasons });
  }
  const output = computeStructuredOutput(configuration, plan);
  if (output.reviewRequiredCells.length > 0) {
    return Object.freeze({
      status: "blocked" as const,
      output: null,
      reasons: structuredBlockReasons(plan, output.reviewRequiredCells, configuration),
    });
  }
  return Object.freeze({ status: "ready" as const, output, reasons: Object.freeze([]) });
}

/** Convenience predicate over {@link prepareStructuredOutput}. */
export function isStructuredOutputReady(
  configuration: StructuredConfiguration,
  plan: StructuredTransformPlan
): boolean {
  return prepareStructuredOutput(configuration, plan).status === "ready";
}
