/**
 * Structured free-text cells routed `process-as-text` (REC-03 WU-C, D-021
 * free-text columns, SPEC_V4_BATCH_AND_STRUCTURED.md §11).
 *
 * `process-as-text` is an Action, not a class. This module is the DOMAIN
 * authority for what happens to every non-blank configured cell:
 *
 *  - {@link enumerateFreeTextCells} lists the configured cells in
 *    deterministic row-major order (row by row, columns in configuration
 *    order). Blank cells stay blank and are never listed: they create no
 *    session.
 *  - {@link processStructuredFreeTextCells} runs every listed cell through
 *    the productive text engine under the Job's own REC-02 policy, carrying
 *    ONE shared {@link ProcessingContext} across cells. The initial context
 *    comes from the REC-02 seam
 *    ({@link createInitialProcessingContext}), so Longitudinal Research inside
 *    free-text cells uses the REC-02 Job-scoped text date shift; explicit
 *    structured visit/birth columns keep T19 semantics. Each success is
 *    promoted via {@link promoteToSharedContext} (the exact batch pattern,
 *    D-011); a failed cell contributes nothing and is recorded as a visible
 *    typed failure — the raw original is never kept as fallback.
 *  - {@link isFreeTextCellSetCurrent} names staleness: after a policy change
 *    or any configuration/action change that alters the cell set, the stored
 *    state no longer matches the configuration and must be discarded and
 *    reprocessed — stale review state can never certify Safe output.
 *
 * Memory-only (D-013): cell originals live in the frozen state held by the
 * app's state bridge, never persisted, logged or placed in a URL. Review
 * authority stays ReviewSession (D-004): Safe output reads canonical
 * `getFinalText(session)` only, and stays blocked while any required cell
 * session cannot finalize or any failure is unresolved.
 */
import type { Job, PrivacyPolicyId, ProcessingFailure } from "../domain/job";
import {
  createInitialProcessingContext,
  promoteToSharedContext,
} from "../engine/initial-processing-context";
import type { ProcessingContext } from "../engine/types";
import {
  processStructuredFreeTextCell,
  type RegistryEngine,
  type ReviewSession,
} from "../review/review-domain";
import type { StructuredConfiguration } from "./configuration";
import { isBlankCell } from "./grid";

/** One configured non-blank free-text cell: which column/row, never internals. */
export type StructuredFreeTextCell = {
  readonly columnIndex: number;
  readonly rowIndex: number;
  readonly header: string;
  readonly original: string;
};

/** Outcome of one cell: its ReviewSession, or its visible typed failure. */
export type StructuredFreeTextCellOutcome =
  | { readonly ok: true; readonly cell: StructuredFreeTextCell; readonly session: ReviewSession }
  | {
      readonly ok: false;
      readonly cell: StructuredFreeTextCell;
      readonly failure: ProcessingFailure;
    };

/**
 * Job-scoped structured free-text review state (domain state, not
 * React-local). Frozen; held by the state bridge keyed by job id. `cells` is
 * in deterministic row-major order.
 */
export type StructuredFreeTextState = {
  readonly kind: "structured-free-text-state";
  readonly jobId: string;
  readonly policyId: PrivacyPolicyId;
  readonly cells: readonly StructuredFreeTextCellOutcome[];
};

function formatCell(cell: unknown): string {
  return typeof cell === "string" ? cell : String(cell);
}

/**
 * List every non-blank configured `process-as-text` cell in deterministic
 * row-major order: row by row, the routed columns in configuration order.
 * Blank cells are absent (they stay blank and create no session); columns
 * with any other Action never enumerate.
 */
export function enumerateFreeTextCells(
  configuration: StructuredConfiguration
): readonly StructuredFreeTextCell[] {
  const routed = configuration.columns.filter(
    (column) => column.effectiveAction === "process-as-text"
  );
  const cells: StructuredFreeTextCell[] = [];
  configuration.grid.rows.forEach((row, rowIndex) => {
    for (const column of routed) {
      const raw = row[column.columnIndex];
      if (isBlankCell(raw)) continue;
      cells.push(
        Object.freeze({
          columnIndex: column.columnIndex,
          rowIndex,
          header: column.header,
          original: formatCell(raw),
        })
      );
    }
  });
  return Object.freeze(cells);
}

/** Options for {@link processStructuredFreeTextCells} (all caller-owned facts). */
export type ProcessFreeTextOptions = {
  readonly jobId: string;
  readonly policyId: PrivacyPolicyId;
  readonly jobName: string;
  readonly configuration: StructuredConfiguration;
  readonly engine: RegistryEngine;
};

/**
 * Process every enumerated cell in row-major order with one shared
 * REC-02 `ProcessingContext` carried across cells. The first cell starts from
 * {@link createInitialProcessingContext} for the Job; each success promotes
 * the engine's returned context to shared mode; a failure is recorded with
 * its typed failure and contributes nothing to the carried context, so
 * consistency survives a mid-run failure. The loop never throws for a
 * classified cell failure.
 */
export async function processStructuredFreeTextCells(
  options: ProcessFreeTextOptions
): Promise<StructuredFreeTextState> {
  const { jobId, policyId, jobName, configuration, engine } = options;
  const job: Pick<Job, "id" | "kind" | "name" | "policyId"> = {
    id: jobId,
    kind: "structured",
    name: jobName,
    policyId,
  };
  let carried: ProcessingContext = createInitialProcessingContext(job, policyId);
  const cells: StructuredFreeTextCellOutcome[] = [];
  for (const cell of enumerateFreeTextCells(configuration)) {
    const outcome = await processStructuredFreeTextCell(job, cell, cell.original, carried, engine);
    if (outcome.ok) {
      cells.push(Object.freeze({ ok: true as const, cell, session: outcome.session }));
      carried = promoteToSharedContext(outcome.context);
    } else {
      cells.push(Object.freeze({ ok: false as const, cell, failure: outcome.failure }));
    }
  }
  return Object.freeze({
    kind: "structured-free-text-state" as const,
    jobId,
    policyId,
    cells: Object.freeze(cells),
  });
}

/**
 * Replace one cell's ReviewSession after an explicit reviewer decision
 * (domain transition for the state bridge: decisions rebuild state, never
 * mutate it). Fails closed when the cell is unknown or holds a failure
 * instead of a session — a failure is resolved by reprocessing, never by
 * editing it into a session.
 */
export function replaceFreeTextCellSession(
  state: StructuredFreeTextState,
  columnIndex: number,
  rowIndex: number,
  session: ReviewSession
): StructuredFreeTextState {
  const index = state.cells.findIndex(
    (cell) => cell.cell.columnIndex === columnIndex && cell.cell.rowIndex === rowIndex
  );
  if (index < 0) {
    throw new Error(
      `replaceFreeTextCellSession found no free-text cell [column ${columnIndex}, row ${rowIndex}]; failing closed instead of attaching a session to the wrong cell.`
    );
  }
  const current = state.cells[index];
  if (!current.ok) {
    throw new Error(
      `replaceFreeTextCellSession cannot replace the unresolved failure of free-text cell ["${current.cell.header}", row ${current.cell.rowIndex + 1}]; reprocess instead of editing a failure into a session.`
    );
  }
  const cells = state.cells.map((cell, candidate) =>
    candidate === index ? Object.freeze({ ok: true as const, cell: cell.cell, session }) : cell
  );
  return Object.freeze({ ...state, cells: Object.freeze(cells) });
}

/**
 * A current, empty free-text state for a Job whose routed `process-as-text`
 * columns currently have zero non-blank cells (SPEC-2). There is no required
 * cell session, so the explicit run installs this rather than clearing to
 * `null`; preparation then treats the routed columns as having nothing to
 * review and Safe output carries their blank cells. Deterministic and frozen
 * (same shape as a productive run over an empty cell set).
 */
export function createEmptyFreeTextState(
  jobId: string,
  policyId: PrivacyPolicyId
): StructuredFreeTextState {
  return Object.freeze({
    kind: "structured-free-text-state" as const,
    jobId,
    policyId,
    cells: Object.freeze([] as const),
  });
}

/**
 * Whether a stored free-text state still matches the configuration's current
 * cell set (same cells in the same row-major order, same originals, same
 * policy). False after a policy change or any configuration/action/grid
 * change that alters the cell set: the state is stale and must be discarded
 * and reprocessed under the new facts — never used to certify Safe output.
 */
export function isFreeTextCellSetCurrent(
  configuration: StructuredConfiguration,
  state: StructuredFreeTextState,
  policyId: PrivacyPolicyId
): boolean {
  if (state.policyId !== policyId) return false;
  const current = enumerateFreeTextCells(configuration);
  if (current.length !== state.cells.length) return false;
  return current.every((cell, index) => {
    const stored = state.cells[index].cell;
    return (
      stored.columnIndex === cell.columnIndex &&
      stored.rowIndex === cell.rowIndex &&
      stored.header === cell.header &&
      stored.original === cell.original
    );
  });
}
