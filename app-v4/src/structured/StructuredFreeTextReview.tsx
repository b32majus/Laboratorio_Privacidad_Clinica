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
import { localizeStructuredBlockReason } from "./reason-labels";
import { localizeDomainErrorMessage } from "../presentation/domain-message-labels";
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
  readonly onSelectFreeTextCell: (position: number) => void;
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
  return `${header === "" ? "(columna sin nombre)" : header}, fila ${rowIndex + 1}`;
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
    <section className="sx-cells-workspace" aria-labelledby="review-step-heading">
      <h2 id="review-step-heading" className="font-display text-xl font-bold text-primary-dark">
        Revisión
      </h2>
      <p className="mt-2 max-w-3xl text-base leading-relaxed">
        {routedCount === 1
          ? "1 columna se dirige a través del motor de privacidad de texto. Cada celda no vacía es su propia sesión de revisión, con la misma semántica de decisión que la revisión de texto."
          : `${routedCount} columnas se dirigen a través del motor de privacidad de texto. Cada celda no vacía es su propia sesión de revisión, con la misma semántica de decisión que la revisión de texto.`}{" "}
        La salida preparada permanece bloqueada hasta que se decide cada sesión de celda y se
        resuelve cada error de procesamiento.
      </p>

      {freeText === null ? (
        <div className="mt-3 max-w-3xl rounded border border-primary bg-surface-light px-3 py-2 text-sm text-neutral-800">
          <p role="status">
            Las celdas de texto libre todavía no se han procesado. El procesamiento ejecuta el motor
            de texto bajo la política de privacidad de este trabajo y crea una sesión de revisión
            por cada celda no vacía.
          </p>
          <button
            type="button"
            onClick={run}
            disabled={running}
            className={`mt-2 rounded bg-primary-dark px-4 py-2 text-sm font-semibold text-white hover:bg-primary disabled:cursor-wait disabled:opacity-60 ${focusRing}`}
          >
            {running ? "Procesando celdas de texto libre…" : "Procesar celdas de texto libre"}
          </button>
          {runError !== null && (
            <p role="alert" className="mt-2 font-semibold text-primary-dark">
              {localizeDomainErrorMessage(runError)}
            </p>
          )}
        </div>
      ) : (
        <>
          <dl
            role="status"
            aria-label="Progreso de la revisión de texto libre"
            className="mt-3 grid max-w-3xl grid-cols-2 gap-x-4 gap-y-1 text-sm text-neutral-800"
          >
            <dt className="font-semibold">Celdas:</dt>
            <dd> {freeText.cells.length}</dd>
            <dt className="font-semibold">Decisiones pendientes:</dt>
            <dd> {pendingTotal}</dd>
            <dt className="font-semibold">Celdas con error:</dt>
            <dd> {failedTotal}</dd>
            <dt className="font-semibold">Revisión de texto libre preparada:</dt>
            <dd> {ready ? "Sí" : "No"}</dd>
          </dl>

          <div className="mt-3 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={run}
              disabled={running}
              className={`rounded border border-primary-dark px-4 py-2 text-sm font-semibold text-primary-dark hover:bg-surface-dark hover:text-white disabled:cursor-wait disabled:opacity-60 ${focusRing}`}
            >
              {running ? "Reprocesando…" : "Reprocesar celdas de texto libre"}
            </button>
          </div>
          {runError !== null && (
            <p role="alert" className="mt-2 max-w-3xl font-semibold text-primary-dark">
              {localizeDomainErrorMessage(runError)}
            </p>
          )}

          <div className="sx-cells-grid mt-4">
            <nav aria-label="Celdas de texto libre" className="sx-cells-queue mt-4 max-w-3xl">
              <h3 className="font-display text-base font-bold text-primary-dark">Celdas</h3>
              <ul className="mt-2 space-y-1">
                {freeText.cells.map((cell, position) => {
                  const label = cellLabel(cell.cell.header, cell.cell.rowIndex);
                  const status = !cell.ok
                    ? `Error: ${cell.failure.message}`
                    : (() => {
                        const pending = getPendingDetections(cell.session).length;
                        if (pending === 1) return "1 decisión pendiente";
                        if (pending > 1) return `${pending} decisiones pendientes`;
                        return canFinalize(cell.session) ? "Preparada" : "Pendiente de revisión";
                      })();
                  return (
                    <li key={`${cell.cell.columnIndex}:${cell.cell.rowIndex}`}>
                      <button
                        type="button"
                        onClick={() => props.onSelectFreeTextCell(position)}
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

            <div className="sx-cells-current min-w-0">
              {active !== undefined && active !== null && active.ok && (
                <div className="mt-4">
                  <h3 className="font-display text-base font-bold text-primary-dark">
                    Revisando {cellLabel(active.cell.header, active.cell.rowIndex)}
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
                    {cellLabel(active.cell.header, active.cell.rowIndex)} no se pudo procesar
                  </h3>
                  <p className="mt-1 font-semibold">{active.failure.message}</p>
                  <p className="mt-1">
                    Resuélvalo reprocesando las celdas de texto libre. La celda original nunca se
                    conserva como respaldo.
                  </p>
                </div>
              )}
            </div>
          </div>
        </>
      )}

      {blockedReasons.length > 0 && (
        <ul
          role="alert"
          aria-label="Bloqueos de la revisión estructurada"
          className="mt-3 max-w-3xl list-disc space-y-0.5 rounded border border-primary-dark bg-white px-3 py-2 pl-6 text-sm font-semibold text-primary-dark"
        >
          {blockedReasons.map((reason, index) => (
            <li key={index}>{localizeStructuredBlockReason(reason)}</li>
          ))}
        </ul>
      )}

      <div className="mt-4 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => props.onGoToStep("configure")}
          className={`rounded border border-primary-dark px-4 py-2 text-sm font-semibold text-primary-dark hover:bg-surface-dark hover:text-white ${focusRing}`}
        >
          Volver a preparar datos
        </button>
        {ready && (
          <button
            type="button"
            onClick={() => props.onGoToStep("privacy-gate")}
            className={`rounded bg-primary-dark px-4 py-2 text-sm font-semibold text-white hover:bg-primary ${focusRing}`}
          >
            Continuar a la comprobación de privacidad
          </button>
        )}
      </div>
    </section>
  );
}
