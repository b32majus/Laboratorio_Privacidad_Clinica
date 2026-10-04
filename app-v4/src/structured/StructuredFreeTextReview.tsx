/**
 * Structured free-text Review (REC-03 WU-C, D-021 free-text columns).
 *
 * When `process-as-text` columns exist, the Review step shows a bounded queue
 * of those cells and reuses the existing `ReviewWorkspace` semantics for the
 * active cell. The queue names WHICH column/row cell is under review —
 * ProcessingContext/session internals are never user concepts. There is no
 * new route/page/mode and no auto-accept shortcut: low-confidence candidates
 * stay pending/visible exactly as in ordinary text review, and Safe output
 * stays blocked until every required cell session can finalize.
 *
 * The component is CONTROLLED: cell sessions live in the domain state bridge
 * (`useJobSession` free-text state); decisions and navigation go out through
 * callbacks. Transient run-pending state is the only local state.
 */
import { useState, type ReactElement } from "react";

import type { FlowStep } from "../domain/job";
import type { ProcessingFailure } from "../domain/job";
import {
  canFinalize,
  getPendingDetections,
  type DecisionExtras,
  type ExplicitDecisionStatus,
  type ManualDetectionInput,
} from "../review/review-domain";
import { ReviewWorkspace } from "../review/ReviewWorkspace";
import type { StructuredConfiguration } from "./configuration";
import type { StructuredFreeTextState } from "./free-text";
import type { StructuredOutputPreparation } from "./transformed-dataset";

const focusRing =
  "focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2";

export type StructuredFreeTextReviewProps = {
  /** The canonical structured configuration for the current job. */
  readonly configuration: StructuredConfiguration;
  /** Exact preparation (or `null` while the source is unread). */
  readonly preparation: StructuredOutputPreparation | null;
  /** Job-scoped free-text cell sessions, or `null` while unprocessed/stale. */
  readonly freeText: StructuredFreeTextState | null;
  /** Row-major queue position under review, or `null`. */
  readonly activeCell: number | null;
  /** Last run failure message, when the explicit run itself failed. */
  readonly runError: string | null;
  /** Explicit reviewer-triggered processing run (never automatic). */
  readonly onRun: () => Promise<ProcessingFailure | null>;
  /** Bounded cell navigation (position in the row-major queue). */
  readonly onSelectCell: (position: number) => void;
  /** Explicit decision on the active cell's session. */
  readonly onDecide: (
    id: string,
    decision: ExplicitDecisionStatus,
    extras?: DecisionExtras
  ) => void;
  /** Manual detection on the active cell's session. */
  readonly onAddManual: (detection: ManualDetectionInput) => void;
  readonly onGoToStep: (step: FlowStep) => void;
};

function cellLabel(header: string, rowIndex: number): string {
  return `${header === "" ? "(unnamed column)" : header}, row ${rowIndex + 1}`;
}

export function StructuredFreeTextReview(props: StructuredFreeTextReviewProps): ReactElement {
  const { configuration, preparation, freeText, activeCell, runError } = props;
  const [running, setRunning] = useState(false);
  const routedCount = configuration.columns.filter(
    (column) => column.effectiveAction === "process-as-text"
  ).length;
  const pendingTotal =
    freeText === null
      ? 0
      : freeText.cells.reduce(
          (sum, cell) => sum + (cell.ok ? getPendingDetections(cell.session).length : 0),
          0
        );
  const failedTotal = freeText === null ? 0 : freeText.cells.filter((cell) => !cell.ok).length;
  const ready =
    preparation !== null &&
    preparation.status === "ready" &&
    freeText !== null &&
    failedTotal === 0 &&
    pendingTotal === 0;
  const blockedReasons =
    preparation !== null && preparation.status === "blocked" ? preparation.reasons : [];
  const active = activeCell === null || freeText === null ? null : freeText.cells[activeCell];

  const run = async () => {
    setRunning(true);
    try {
      await props.onRun();
    } finally {
      setRunning(false);
    }
  };

  return (
    <section aria-labelledby="review-step-heading">
      <h2 id="review-step-heading" className="font-display text-xl font-bold text-primary-dark">
        Review
      </h2>
      <p className="mt-2 max-w-3xl text-base leading-relaxed">
        {routedCount === 1
          ? "1 column is routed through the text privacy engine. Each non-blank cell is its own review session with the same decision semantics as text review."
          : `${routedCount} columns are routed through the text privacy engine. Each non-blank cell is its own review session with the same decision semantics as text review.`}{" "}
        Safe output stays blocked until every cell session is decided and every processing failure
        is resolved.
      </p>

      {freeText === null ? (
        <div className="mt-3 max-w-3xl rounded border border-primary bg-surface-light px-3 py-2 text-sm text-neutral-800">
          <p role="status">
            The free-text cells have not been processed yet. Processing runs the text engine under
            this job&apos;s privacy policy and creates one review session per non-blank cell.
          </p>
          <button
            type="button"
            onClick={run}
            disabled={running}
            className={`mt-2 rounded bg-primary-dark px-4 py-2 text-sm font-semibold text-white hover:bg-primary disabled:cursor-wait disabled:opacity-60 ${focusRing}`}
          >
            {running ? "Processing free-text cells…" : "Process free-text cells"}
          </button>
          {runError !== null && (
            <p role="alert" className="mt-2 font-semibold text-primary-dark">
              {runError}
            </p>
          )}
        </div>
      ) : (
        <>
          <dl
            role="status"
            aria-label="Free-text review progress"
            className="mt-3 grid max-w-3xl grid-cols-2 gap-x-4 gap-y-1 text-sm text-neutral-800"
          >
            <dt className="font-semibold">Cells:</dt>
            <dd> {freeText.cells.length}</dd>
            <dt className="font-semibold">Pending decisions:</dt>
            <dd> {pendingTotal}</dd>
            <dt className="font-semibold">Failed cells:</dt>
            <dd> {failedTotal}</dd>
            <dt className="font-semibold">Free-text review ready:</dt>
            <dd> {ready ? "Yes" : "No"}</dd>
          </dl>

          <div className="mt-3 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={run}
              disabled={running}
              className={`rounded border border-primary-dark px-4 py-2 text-sm font-semibold text-primary-dark hover:bg-surface-dark hover:text-white disabled:cursor-wait disabled:opacity-60 ${focusRing}`}
            >
              {running ? "Reprocessing…" : "Reprocess free-text cells"}
            </button>
          </div>
          {runError !== null && (
            <p role="alert" className="mt-2 max-w-3xl font-semibold text-primary-dark">
              {runError}
            </p>
          )}

          <nav aria-label="Free-text cells" className="mt-4 max-w-3xl">
            <h3 className="font-display text-base font-bold text-primary-dark">Cells</h3>
            <ul className="mt-2 space-y-1">
              {freeText.cells.map((cell, position) => {
                const label = cellLabel(cell.cell.header, cell.cell.rowIndex);
                const status = !cell.ok
                  ? `Failed: ${cell.failure.message}`
                  : (() => {
                      const pending = getPendingDetections(cell.session).length;
                      if (pending === 1) return "1 pending decision";
                      if (pending > 1) return `${pending} pending decisions`;
                      return canFinalize(cell.session) ? "Ready" : "Pending review";
                    })();
                return (
                  <li key={`${cell.cell.columnIndex}:${cell.cell.rowIndex}`}>
                    <button
                      type="button"
                      onClick={() => props.onSelectCell(position)}
                      aria-current={activeCell === position ? "true" : undefined}
                      className={`w-full rounded border px-2 py-1 text-left text-sm ${
                        activeCell === position
                          ? "border-primary-dark bg-surface-dark text-white"
                          : "border-primary bg-white text-neutral-800 hover:bg-surface-light"
                      } ${focusRing}`}
                    >
                      <span className="font-semibold">{label}</span>
                      <span className="block text-xs">{status}</span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </nav>

          {active !== undefined && active !== null && active.ok && (
            <div className="mt-4">
              <h3 className="font-display text-base font-bold text-primary-dark">
                Reviewing {cellLabel(active.cell.header, active.cell.rowIndex)}
              </h3>
              <div className="mt-2">
                <ReviewWorkspace
                  session={active.session}
                  onDecide={props.onDecide}
                  onAddManual={props.onAddManual}
                />
              </div>
            </div>
          )}
          {active !== undefined && active !== null && !active.ok && (
            <div
              role="alert"
              className="mt-4 max-w-3xl rounded border border-primary-dark bg-white px-3 py-2 text-sm text-primary-dark"
            >
              <h3 className="font-display text-base font-bold">
                {cellLabel(active.cell.header, active.cell.rowIndex)} failed processing
              </h3>
              <p className="mt-1 font-semibold">{active.failure.message}</p>
              <p className="mt-1">
                Resolve it by reprocessing the free-text cells. The original cell is never kept as a
                fallback.
              </p>
            </div>
          )}
        </>
      )}

      {blockedReasons.length > 0 && (
        <ul
          role="alert"
          aria-label="Structured review blockers"
          className="mt-3 max-w-3xl list-disc space-y-0.5 rounded border border-primary-dark bg-white px-3 py-2 pl-6 text-sm font-semibold text-primary-dark"
        >
          {blockedReasons.map((reason, index) => (
            <li key={index}>{reason}</li>
          ))}
        </ul>
      )}

      <div className="mt-4 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => props.onGoToStep("configure")}
          className={`rounded border border-primary-dark px-4 py-2 text-sm font-semibold text-primary-dark hover:bg-surface-dark hover:text-white ${focusRing}`}
        >
          Back to Configure
        </button>
        {ready && (
          <button
            type="button"
            onClick={() => props.onGoToStep("privacy-gate")}
            className={`rounded bg-primary-dark px-4 py-2 text-sm font-semibold text-white hover:bg-primary ${focusRing}`}
          >
            Continue to Privacy Gate
          </button>
        )}
      </div>
    </section>
  );
}
