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
import {
  enumerateFreeTextCells,
  isFreeTextCellSetCurrent,
  type StructuredFreeTextState,
} from "./free-text";
import { isBlankCell, type StructuredCell } from "./grid";
import {
  buildVisitSequence,
  resolveStudyIdPrefix,
  VISIT_NUMBER_HEADER,
  type StructuredOutputOptions,
} from "./output-options";
import { buildStudyIdMapping, STUDY_ID_HEADER } from "./study-id";
import type { StructuredTransformPlan, StructuredTransformPlanColumn } from "./transform-plan";
import { canFinalize, getFinalText } from "../review/review-domain";

/**
 * One canonical Safe cell (REC-04 WU-B, D-022 "Structured Safe data"):
 * unchanged `keep` numeric/boolean cells stay `number`/`boolean`, absence
 * stays `null`, and canonical transformed values (Study IDs, QIDs, reviewed
 * free text, date/age transforms) are their produced `string` values. The
 * derived `Visita_Num` is numeric.
 */
export type StructuredSafeCell = string | number | boolean | null;

/** The Safe structured dataset: flattened cells, no correspondence field. */
export type StructuredSafeDataset = {
  readonly kind: "structured-safe-dataset";
  readonly headers: readonly string[];
  readonly rows: readonly (readonly StructuredSafeCell[])[];
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
  readonly disposition: "date-age" | "pseudonymize" | "remove" | "study-id" | "free-text";
  readonly entries: readonly StructuredCorrespondenceEntry[];
};

/** Coarse correspondence totals for the Confidential artifact header. */
export type StructuredCorrespondenceTotals = {
  readonly dateAge: number;
  readonly pseudonymize: number;
  readonly remove: number;
  readonly studyId: number;
  readonly freeText: number;
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

function formatCell(cell: StructuredCell): string {
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
 * reviews and free-text review state). Text-first; never color-only. Empty
 * means the plan is exportable.
 *
 * The optional `configuration` carries the grid values needed for the REC-03
 * Study-ID blank-patient-ID check; without it only the structural Study-ID
 * header-collision check applies.
 *
 * The optional `freeText` carries the job-scoped structured free-text review
 * state (REC-03 WU-C): when the plan routes `free-text` columns, Safe output
 * additionally requires a current state (same policy, same cell set) with no
 * failures and every cell session finalizable. A missing state, a stale
 * policy, an altered cell set, a failure or a pending session each blocks
 * with an exact reason — the raw original is never kept as fallback.
 *
 * The optional `outputOptions` carries the REC-04 WU-B job-scoped output
 * options: an invalid non-blank Study-ID prefix blocks explicitly (never a
 * silent fallback), and a conflicting Safe header `Visita_Num` blocks while
 * visit numbering would emit the derived column.
 */
export function structuredBlockReasons(
  plan: StructuredTransformPlan,
  reviewRequiredCells: readonly StructuredReviewRequiredCell[] = [],
  configuration?: StructuredConfiguration,
  freeText?: StructuredFreeTextState | null,
  outputOptions?: StructuredOutputOptions
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
  // SPEC-1: EVERY disposition that emits a Safe column participates —
  // `keep`, `pseudonymize`, `date-age` and `free-text` (a routed
  // `process-as-text` column emits its header into Safe output too). `remove`
  // emits nothing and is never treated as a collision.
  const studyIdColumns = plan.columns.filter((column) => column.disposition.kind === "study-id");
  for (const studyColumn of studyIdColumns) {
    const colliding = plan.columns.filter(
      (column) =>
        column.columnIndex !== studyColumn.columnIndex &&
        column.header === STUDY_ID_HEADER &&
        (column.disposition.kind === "keep" ||
          column.disposition.kind === "pseudonymize" ||
          column.disposition.kind === "date-age" ||
          column.disposition.kind === "free-text")
    );
    for (const other of colliding) {
      const otherLabel = other.header === "" ? "(unnamed column)" : other.header;
      reasons.push(
        `Structured export is blocked: Safe header "${STUDY_ID_HEADER}" is already used by another input column "${otherLabel}"; the Study-ID column is never written over it silently.`
      );
    }
  }
  // REC-04 WU-B output options (D-022): an invalid non-blank Study-ID
  // prefix blocks explicitly while a Study ID would be generated (a patient-ID
  // authority exists) — never a silent fallback or sanitized token. Without
  // a patient authority the prefix configures nothing and never blocks.
  const hasStudyId = studyIdColumns.length > 0;
  if (hasStudyId) {
    const resolvedPrefix = resolveStudyIdPrefix(outputOptions?.studyIdPrefix);
    if (resolvedPrefix.status === "invalid") {
      reasons.push(`Structured export is blocked: ${resolvedPrefix.reason}`);
    }
  }
  // REC-04 WU-B `Visita_Num` collision (D-022): while visit numbering is
  // effectively enabled (flag on AND a patient-ID authority exists), the
  // derived column is emitted immediately after `ID_ESTUDIO` — a conflicting
  // different input column already named `Visita_Num` blocks rather than
  // being overwritten or duplicated silently. SPEC-1 parity with the
  // `ID_ESTUDIO` check: EVERY disposition that emits a Safe column
  // participates; `remove` emits nothing and never collides.
  const visitEffective = outputOptions?.addVisitNumber === true && hasStudyId;
  if (visitEffective && studyIdColumns.length > 0) {
    for (const studyColumn of studyIdColumns) {
      const colliding = plan.columns.filter(
        (column) =>
          column.columnIndex !== studyColumn.columnIndex &&
          column.header === VISIT_NUMBER_HEADER &&
          (column.disposition.kind === "keep" ||
            column.disposition.kind === "pseudonymize" ||
            column.disposition.kind === "date-age" ||
            column.disposition.kind === "free-text")
      );
      for (const other of colliding) {
        const otherLabel = other.header === "" ? "(unnamed column)" : other.header;
        reasons.push(
          `Structured export is blocked: Safe header "${VISIT_NUMBER_HEADER}" is already used by another input column "${otherLabel}"; the visit-number column is never written over it silently.`
        );
      }
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

  reasons.push(...freeTextBlockReasons(plan, configuration, freeText));

  return Object.freeze(reasons);
}

/**
 * Fail-closed block reasons for the structured free-text review state
 * (REC-03 WU-C). Empty when the plan routes no `free-text` column. Reasons
 * name the column header and 1-based row only — never raw cell text.
 */
function freeTextBlockReasons(
  plan: StructuredTransformPlan,
  configuration: StructuredConfiguration | undefined,
  freeText: StructuredFreeTextState | null | undefined
): readonly string[] {
  const routed = plan.columns.filter((column) => column.disposition.kind === "free-text");
  if (routed.length === 0) return Object.freeze([]);
  // SPEC-2: a routed `process-as-text` column whose CURRENT configured cells
  // are all blank has zero required sessions. There is nothing to review, so
  // the absence of a processed state must not block; Safe carries the blanks.
  if (configuration !== undefined && enumerateFreeTextCells(configuration).length === 0) {
    return Object.freeze([]);
  }
  if (freeText === null || freeText === undefined) {
    const labels = routed.map((column) => `"${columnLabel(column)}"`).join(", ");
    return Object.freeze([
      `Structured export is blocked: free-text column(s) ${labels} have not been processed through the text engine yet; Safe output cannot be produced from unreviewed cells.`,
    ]);
  }
  if (freeText.policyId !== plan.policyId) {
    return Object.freeze([
      `Structured export is blocked: the free-text review was processed under policy "${freeText.policyId}" but the current policy is "${plan.policyId}"; reprocess the free-text cells under the current policy.`,
    ]);
  }
  if (
    configuration !== undefined &&
    !isFreeTextCellSetCurrent(configuration, freeText, plan.policyId)
  ) {
    return Object.freeze([
      "Structured export is blocked: the free-text review no longer matches the current column configuration; reprocess the free-text cells before export.",
    ]);
  }
  const reasons: string[] = [];
  for (const cell of freeText.cells) {
    if (cell.ok) continue;
    reasons.push(
      `Structured export is blocked: free-text cell ["${cell.cell.header}", row ${cell.cell.rowIndex + 1}] failed processing (${cell.failure.message}); resolve it instead of keeping the original.`
    );
  }
  const pending = freeText.cells.filter((cell) => cell.ok && !canFinalize(cell.session));
  if (pending.length === 1) {
    const cell = pending[0];
    if (cell.ok) {
      reasons.push(
        `Structured export is blocked: free-text cell ["${cell.cell.header}", row ${cell.cell.rowIndex + 1}] still requires review; complete every mandatory decision first.`
      );
    }
  } else if (pending.length > 1) {
    reasons.push(
      `Structured export is blocked: ${pending.length} free-text cells still require review; complete every mandatory decision first.`
    );
  }
  return Object.freeze(reasons);
}

/**
 * Compute the Safe dataset and the separate Confidential correspondence of a
 * structurally-ready plan. Throws when the plan is not structurally ready:
 * callers must go through {@link prepareStructuredOutput}.
 *
 * REC-03 WU-C: a `free-text` column's Safe cells come from the canonical
 * `getFinalText(session)` of the cell's ReviewSession — never a raw engine
 * proposal. The caller must supply the current `freeText` state (same policy,
 * same cell set, every session finalizable); otherwise this throws
 * fail-closed instead of producing Safe bytes from unreviewed content.
 *
 * REC-04 WU-B: `outputOptions` configures the generated Study-ID token text
 * (same first-appearance grouping, never another identity) and the optional
 * row-order `Visita_Num` column immediately after `ID_ESTUDIO`. Absent
 * options preserve legacy output exactly (`PAC`, no visit column). An
 * invalid prefix throws here (preparation blocks first); without a
 * patient-ID authority the prefix and the visit flag configure nothing.
 */
export function computeStructuredOutput(
  configuration: StructuredConfiguration,
  plan: StructuredTransformPlan,
  freeText?: StructuredFreeTextState | null,
  outputOptions?: StructuredOutputOptions
): StructuredOutput {
  if (!plan.dispositionsReady) {
    throw new Error(
      "computeStructuredOutput requires a structurally-ready plan; failing closed instead of producing a partial Safe dataset."
    );
  }
  const grid = configuration.grid;

  // REC-04 WU-B: resolve the effective Study-ID prefix once (blank/absent is
  // the heritage default; invalid refuses here — preparation blocks first so
  // this is defense in depth, never a silent fallback).
  const resolvedPrefix = resolveStudyIdPrefix(outputOptions?.studyIdPrefix);
  if (resolvedPrefix.status === "invalid") {
    throw new Error(
      `computeStructuredOutput ${resolvedPrefix.reason} Failing closed instead of exporting with a guessed token.`
    );
  }
  const studyIdPrefix = resolvedPrefix.prefix;

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

  // REC-03 WU-C: index the free-text sessions by cell so Safe reads the
  // canonical reviewed final text. Blank cells have no session by
  // construction (they stay blank).
  const freeTextFinals = new Map<string, { readonly original: string; readonly final: string }>();
  const freeTextColumns = plan.columns.filter((column) => column.disposition.kind === "free-text");
  if (freeTextColumns.length > 0) {
    // SPEC-2: a routed `process-as-text` column whose CURRENT configured cells
    // are all blank has no required session, so no review state is required
    // and Safe carries blank cells. Any non-empty current cell set keeps the
    // full fail-closed review requirement below.
    if (enumerateFreeTextCells(configuration).length > 0) {
      if (freeText === null || freeText === undefined) {
        throw new Error(
          "computeStructuredOutput requires the current free-text review state for free-text columns; failing closed instead of producing Safe bytes from unreviewed cells."
        );
      }
      if (
        freeText.policyId !== plan.policyId ||
        !isFreeTextCellSetCurrent(configuration, freeText, plan.policyId)
      ) {
        throw new Error(
          "computeStructuredOutput received a stale free-text review state (policy or cell set changed); failing closed instead of certifying stale review."
        );
      }
      for (const cell of freeText.cells) {
        if (!cell.ok) {
          throw new Error(
            `computeStructuredOutput found free-text cell ["${cell.cell.header}", row ${cell.cell.rowIndex + 1}] with an unresolved processing failure; failing closed instead of keeping the original.`
          );
        }
        if (!canFinalize(cell.session)) {
          throw new Error(
            `computeStructuredOutput found free-text cell ["${cell.cell.header}", row ${cell.cell.rowIndex + 1}] with pending mandatory review; failing closed instead of bypassing review.`
          );
        }
        freeTextFinals.set(`${cell.cell.columnIndex}:${cell.cell.rowIndex}`, {
          original: cell.cell.original,
          final: getFinalText(cell.session),
        });
      }
    }
  }

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
      // the unique original↔Study-ID mapping is Confidential-only. REC-04
      // WU-B: token text follows the resolved prefix; grouping/order are the
      // same first-appearance mapping as REC-03.
      const mapping = buildStudyIdMapping(valuesFor(column.columnIndex), studyIdPrefix);
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

    if (disposition.kind === "free-text") {
      // REC-03 WU-C: Confidential-only original<->final-reviewed correspondence.
      // Blanks stay blank and never enter the mapping; originals never enter
      // Safe output through this path.
      const entries: StructuredCorrespondenceEntry[] = [];
      grid.rows.forEach((row, rowIndex) => {
        if (isBlankCell(row[column.columnIndex])) return;
        const held = freeTextFinals.get(`${column.columnIndex}:${rowIndex}`);
        if (held === undefined) {
          throw new Error(
            `computeStructuredOutput found no reviewed session for free-text cell ["${columnLabel(column)}", row ${rowIndex + 1}]; failing closed instead of keeping the original.`
          );
        }
        entries.push(Object.freeze({ original: held.original, transformed: held.final }));
      });
      correspondenceColumns.push(
        Object.freeze({
          columnIndex: column.columnIndex,
          header: column.header,
          disposition: "free-text" as const,
          entries: Object.freeze(entries),
        })
      );
      continue;
    }

    // keep: preserved verbatim in the Safe dataset, no correspondence.
  }

  // Materialize the Safe cells per column index (pseudonymize needs the whole
  // column before per-row output). REC-04 WU-B typed scalars (D-022): an
  // unchanged `keep` cell keeps its domain type (`number`/`boolean` stay
  // typed) and absence stays `null`; canonical transformed values (Study IDs,
  // QIDs, reviewed free text, date/age transforms) are their produced
  // strings; the derived `Visita_Num` is numeric. The CSV serializer renders
  // `null` as an empty field, so string-only datasets stay byte-compatible.
  const safeCellsByColumnIndex = new Map<number, readonly StructuredSafeCell[]>();
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
            return outcome !== undefined && outcome.kind === "transformed" ? outcome.value : null;
          })
        )
      );
    } else if (disposition.kind === "pseudonymize") {
      const tokens = pseudonymizeColumnValues(valuesFor(column.columnIndex));
      safeCellsByColumnIndex.set(
        column.columnIndex,
        Object.freeze(tokens.map((token) => (token === "" ? null : token)))
      );
    } else if (disposition.kind === "free-text") {
      // REC-03 WU-C: Safe cells are the canonical reviewed final texts.
      safeCellsByColumnIndex.set(
        column.columnIndex,
        Object.freeze(
          grid.rows.map((_row, rowIndex) => {
            const held = freeTextFinals.get(`${column.columnIndex}:${rowIndex}`);
            return held === undefined ? null : held.final;
          })
        )
      );
    } else if (disposition.kind === "study-id") {
      const studyIds = studyIdsByColumn.get(column.columnIndex) ?? [];
      safeCellsByColumnIndex.set(
        column.columnIndex,
        Object.freeze(studyIds.map((studyId) => studyId ?? null))
      );
    } else {
      safeCellsByColumnIndex.set(
        column.columnIndex,
        Object.freeze(
          valuesFor(column.columnIndex).map((cell) => (isBlankCell(cell) ? null : cell))
        )
      );
    }
  }

  const baseSafeHeaders = Object.freeze(safeHeaders);
  const baseSafeRows = Object.freeze(
    grid.rows.map((_row, rowIndex) =>
      Object.freeze(
        safeColumnIndices.map(
          (columnIndex) => safeCellsByColumnIndex.get(columnIndex)?.[rowIndex] ?? null
        )
      )
    )
  );

  // REC-04 WU-B derived `Visita_Num` (D-022): effective only with the flag on
  // AND a patient-ID authority. Inserted numerically immediately after
  // `ID_ESTUDIO`; the sequence is 1-based occurrence per patient in current
  // input row order (never sorted, never chronology). No correspondence is
  // emitted: the count is computable from Safe grouping + row order and
  // carries no original value.
  const studyIdPlanColumn = plan.columns.find((column) => column.disposition.kind === "study-id");
  const visitEffective = outputOptions?.addVisitNumber === true && studyIdPlanColumn !== undefined;
  let safeHeadersOut: readonly string[] = baseSafeHeaders;
  let safeRowsOut: readonly (readonly StructuredSafeCell[])[] = baseSafeRows;
  if (visitEffective && studyIdPlanColumn !== undefined) {
    const studyIdSafePosition = baseSafeHeaders.indexOf(STUDY_ID_HEADER);
    const visitSequence = buildVisitSequence(valuesFor(studyIdPlanColumn.columnIndex));
    safeHeadersOut = Object.freeze([
      ...baseSafeHeaders.slice(0, studyIdSafePosition + 1),
      VISIT_NUMBER_HEADER,
      ...baseSafeHeaders.slice(studyIdSafePosition + 1),
    ]);
    safeRowsOut = Object.freeze(
      baseSafeRows.map((row, rowIndex) =>
        Object.freeze([
          ...row.slice(0, studyIdSafePosition + 1),
          (visitSequence[rowIndex] ?? null) as StructuredSafeCell,
          ...row.slice(studyIdSafePosition + 1),
        ])
      )
    );
  }

  const totals: StructuredCorrespondenceTotals = Object.freeze({
    dateAge: correspondenceColumns.filter((column) => column.disposition === "date-age").length,
    pseudonymize: correspondenceColumns.filter((column) => column.disposition === "pseudonymize")
      .length,
    remove: correspondenceColumns.filter((column) => column.disposition === "remove").length,
    studyId: correspondenceColumns.filter((column) => column.disposition === "study-id").length,
    freeText: correspondenceColumns.filter((column) => column.disposition === "free-text").length,
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
      headers: safeHeadersOut,
      rows: safeRowsOut,
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
 *
 * REC-03 WU-C: when the plan routes `free-text` columns, pass the current
 * job-scoped `freeText` review state. Without it — or with a stale, failed
 * or unreviewed state — preparation is `blocked` and no Safe artifact
 * exists. Callers without free-text columns omit it (no behavior change).
 *
 * REC-04 WU-B: `outputOptions` configures Study-ID token text and the
 * optional row-order `Visita_Num`. Absent options preserve legacy output
 * exactly (`PAC`, no visit column); an invalid prefix blocks explicitly.
 */
export function prepareStructuredOutput(
  configuration: StructuredConfiguration,
  plan: StructuredTransformPlan,
  options: {
    readonly freeText?: StructuredFreeTextState | null;
    readonly outputOptions?: StructuredOutputOptions;
  } = {}
): StructuredOutputPreparation {
  const structuralReasons = structuredBlockReasons(
    plan,
    [],
    configuration,
    options.freeText ?? null,
    options.outputOptions
  );
  if (structuralReasons.length > 0) {
    return Object.freeze({ status: "blocked" as const, output: null, reasons: structuralReasons });
  }
  const output = computeStructuredOutput(
    configuration,
    plan,
    options.freeText ?? null,
    options.outputOptions
  );
  if (output.reviewRequiredCells.length > 0) {
    return Object.freeze({
      status: "blocked" as const,
      output: null,
      reasons: structuredBlockReasons(
        plan,
        output.reviewRequiredCells,
        configuration,
        options.freeText ?? null,
        options.outputOptions
      ),
    });
  }
  return Object.freeze({ status: "ready" as const, output, reasons: Object.freeze([]) });
}

/** Convenience predicate over {@link prepareStructuredOutput}. */
export function isStructuredOutputReady(
  configuration: StructuredConfiguration,
  plan: StructuredTransformPlan,
  options: {
    readonly freeText?: StructuredFreeTextState | null;
    readonly outputOptions?: StructuredOutputOptions;
  } = {}
): boolean {
  return prepareStructuredOutput(configuration, plan, options).status === "ready";
}

/** Patient-linked facts of a structured job (descriptive counts only). */
export type StructuredPatientSummary = {
  /** Distinct non-blank original patient identifiers (first-appearance grouping). */
  readonly uniquePatients: number;
  /** Data rows carrying a patient identifier (linked rows/visits in row order). */
  readonly linkedRows: number;
  /** Mean linked rows per patient (linkedRows / uniquePatients). */
  readonly averageLinkedRowsPerPatient: number;
};

/**
 * Factual structured summary (REC-04 WU-B, D-022 H-27): always the data row
 * count; with a selected patient-ID authority, the unique patient count, the
 * linked-row/visit count and the average linked rows per patient. Without a
 * patient-ID authority those facts are unavailable (`null`), never guessed.
 * Descriptive facts only: not a risk/privacy score, no chronology claim, no
 * certification language. Memory-only (D-013).
 */
export type StructuredSummary = {
  readonly rowCount: number;
  readonly patient: StructuredPatientSummary | null;
};

export function deriveStructuredSummary(configuration: StructuredConfiguration): StructuredSummary {
  const rowCount = configuration.grid.rows.length;
  if (configuration.patientId.status !== "resolved") {
    return Object.freeze({ rowCount, patient: null });
  }
  const columnIndex = configuration.patientId.columnIndex;
  const distinct = new Set<string>();
  let linkedRows = 0;
  for (const row of configuration.grid.rows) {
    const cell = row[columnIndex];
    if (isBlankCell(cell)) continue;
    linkedRows += 1;
    distinct.add(String(cell));
  }
  const uniquePatients = distinct.size;
  return Object.freeze({
    rowCount,
    patient: Object.freeze({
      uniquePatients,
      linkedRows,
      averageLinkedRowsPerPatient: uniquePatients === 0 ? 0 : linkedRows / uniquePatients,
    }),
  });
}
