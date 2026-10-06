/**
 * Document-batch review surface (T17 #21 WU-C2; SPEC_V4_BATCH_AND_STRUCTURED
 * §1, SPEC_V4_APP_AND_REVIEW §4/§5/§9; batch failure recovery #78/REC-06).
 *
 * A batch has no single review authority: the bridge holds one ReviewSession
 * per successfully processed item plus the currently viewed index
 * (`useJobSession`). This component renders a factual document selector (one
 * entry per item: name, visible status text, failure message when it failed)
 * and, for the ACTIVE item only, the existing {@link ReviewWorkspace} bound to
 * that item's session. `onSelectDocument` merely changes the viewed index —
 * selecting a document never marks it reviewed (FUNC-002, SD-5).
 *
 * Failed items are listed but NOT selectable for review: no session exists for
 * them and their typed message stays visible. Items still `reading`/`queued`
 * are shown factually; review processing itself is gated by the App (all reads
 * must settle first), so this view never starts or infers processing.
 *
 * Failure recovery (#78, REC-06): every ACTIVE failed item carries its
 * recovery actions co-located with its name/status/message —
 * `Reintentar` (only when the domain classifies the item as retryable AND the
 * bridge retains the shared cross-document context), `Retirar del lote`
 * (inline confirm/cancel with a clear Spanish consequence; Cancel is zero
 * mutation) and `Reconocer error` (immediate, non-destructive). A removed
 * item keeps showing its retained failure plus the factual `Retirado del
 * lote` disposition and offers no further recovery actions; an acknowledged
 * item keeps its `error` status and shows the `Error reconocido` fact while
 * retry/removal stay available. A read failure without retained text is never
 * offered a retry. Success/failure/pending feedback is perceptible
 * (`role="status"` / `role="alert"`), and one quiet factual line explains the
 * cross-document consistency of the batch (no toggle, no internal vocabulary).
 *
 * Accessibility (SPEC §9): native buttons, keyboard/touch operable with
 * visible focus rings, `aria-current` on the active document, and status
 * conveyed as text (never color alone). Status labels and recovery copy are
 * professional Spanish; the document-list aria-labels are kept stable for the
 * existing test/automation targets. No export surface here (T08 owns it).
 */
import { useState, type ReactElement } from "react";

import {
  batchActiveFailedItems,
  isBatchItemRetryable,
  type BatchItemStatus,
  type Job,
  type PrivacyPolicyId,
} from "../domain/job";
import type { EngineLoader } from "../engine/engine-seam";
import type { BatchItemRetryResult } from "../useJobSession";
import {
  type DecisionExtras,
  type ExplicitDecisionStatus,
  type ManualDetectionInput,
  type ReviewSession,
} from "./review-domain";
import { ReviewWorkspace } from "./ReviewWorkspace";

const focusRing =
  "focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2";

/** Visible text label per batch item status: status is never conveyed by color. */
const BATCH_STATUS_LABELS: Record<BatchItemStatus, string> = {
  queued: "En cola",
  reading: "Leyendo",
  processing: "Procesando",
  "review-required": "Requiere revisión",
  completed: "Completado",
  error: "Error",
};

/** The job + policy authority a transient recovery interaction was captured under. */
type RecoveryScope = {
  readonly jobId: string;
  readonly policyId: PrivacyPolicyId;
};

/**
 * In-flight retry attempt (#78 correction F2): identified by the authority it
 * was captured under AND its row. The pending state clears only when that
 * attempt settles — never because an unrelated domain update replaced the job
 * object mid-attempt.
 */
type RetryAttempt = RecoveryScope & { readonly index: number };

/** Per-item recovery feedback (#78): perceptible, co-located, text-conveyed. */
type RecoveryFeedback = RecoveryScope & {
  readonly index: number;
  readonly kind: "status" | "error";
  readonly text: string;
};

/** Open remove confirmation (#78): scoped to the job it was opened for. */
type RemoveConfirmation = RecoveryScope & { readonly index: number };

export type BatchReviewViewProps = {
  /** The frozen batch job: the single authority for per-item state. */
  readonly job: Job;
  /**
   * One ReviewSession per successfully processed item, keyed by item index;
   * `null` until the batch attempt has been recorded by the bridge.
   */
  readonly sessions: Readonly<Record<number, ReviewSession>> | null;
  /** The currently viewed item index; `null` when no session exists. */
  readonly activeIndex: number | null;
  /**
   * Whether the bridge retains the shared cross-document context for the
   * current batch (#78). Together with the domain's `isBatchItemRetryable`
   * this gates the `Reintentar` control; the context itself is never exposed.
   */
  readonly retryContextAvailable?: boolean;
  /** Change the viewed document only — never review state (SD-5). */
  readonly onSelectDocument: (index: number | null) => void;
  /** Apply an explicit decision for the ACTIVE document through the bridge. */
  readonly onDecide: (
    id: string,
    decision: ExplicitDecisionStatus,
    extras?: DecisionExtras
  ) => void;
  /** Add a manual detection to the ACTIVE document through the bridge. */
  readonly onAddManual: (detection: ManualDetectionInput) => void;
  /**
   * Retry one retryable failed item through the bridge (#78). Resolves with
   * the discriminated attempt result (#78 correction F2): `{ kind: "settled",
   * failure }` when the attempt actually ran and installed its outcome
   * (`failure === null` exactly for a real success), `{ kind: "refused" }`
   * when the call was stale/overlapping and performed zero mutation — never
   * conflated with success.
   */
  readonly onRetryBatchItem?: (
    index: number,
    options?: { engineLoader?: EngineLoader }
  ) => Promise<BatchItemRetryResult>;
  /** Apply the CONFIRMED removal of one failed item through the bridge (#78). */
  readonly onRemoveBatchItem?: (index: number) => void;
  /** Acknowledge one active failed item's failure through the bridge (#78). */
  readonly onAcknowledgeBatchItemError?: (index: number) => void;
  /** Typed attempt failure surfaced by the App, if any. */
  readonly errorMessage?: string | null;
};

export function BatchReviewView(props: BatchReviewViewProps): ReactElement {
  const { job, sessions, activeIndex, retryContextAvailable = false, errorMessage = null } = props;
  const files = job.source.type === "files" ? job.source.files : [];
  const stillReading = files.some((file) => file.itemStatus === "reading");
  const activeSession = activeIndex === null ? undefined : sessions?.[activeIndex];
  // Remedy must match the failure semantics (T17 #21 CORR-B): a
  // `policy-unsupported` item is healthy input blocked by the current policy.
  // Only ACTIVE failures are actionable (#78): a removed item is disposed and
  // is never named as a still-blocking failure.
  const failedCodes =
    job.kind === "document-batch" ? batchActiveFailedItems(job).map((item) => item.error.code) : [];

  // Recovery interaction state (#78): component-transient only — every
  // mutation goes through the bridge. Each piece is keyed by the job AND
  // policy authority it was captured under (#78 corrections F2/F3): a
  // replaced Job or policy authority can never render it, while unrelated
  // domain updates of the SAME job (the retry's own start transition, a
  // decision or recovery action on another row) never wipe it. The pending
  // attempt clears only when that attempt settles — never on a job change.
  const [retrying, setRetrying] = useState<RetryAttempt | null>(null);
  const [confirmingRemove, setConfirmingRemove] = useState<RemoveConfirmation | null>(null);
  const [feedback, setFeedback] = useState<RecoveryFeedback | null>(null);
  const attemptInFlight = retrying !== null && retrying.jobId === job.id;

  const handleRetry = async (index: number) => {
    if (props.onRetryBatchItem === undefined || attemptInFlight) return;
    const scope: RecoveryScope = { jobId: job.id, policyId: job.policyId };
    setFeedback(null);
    setRetrying({ ...scope, index });
    let result: BatchItemRetryResult = { kind: "refused" };
    try {
      result = await props.onRetryBatchItem(index);
    } catch {
      // An unexpected bridge rejection is never a success.
      result = { kind: "refused" };
    } finally {
      setRetrying((current) =>
        current !== null && current.jobId === scope.jobId && current.index === index
          ? null
          : current
      );
    }
    const name = files[index]?.name ?? "";
    setFeedback(
      result.kind === "settled" && result.failure === null
        ? {
            ...scope,
            index,
            kind: "status",
            text: `Reintento completado: "${name}" ya está disponible para revisión.`,
          }
        : result.kind === "settled" && result.failure !== null
          ? {
              ...scope,
              index,
              kind: "error",
              text: `El reintento no se completó: ${result.failure.message}`,
            }
          : {
              ...scope,
              index,
              kind: "error",
              text: "El reintento no se realizó: la acción ya no corresponde al estado actual del trabajo.",
            }
    );
  };

  const handleConfirmRemove = (index: number) => {
    props.onRemoveBatchItem?.(index);
    setConfirmingRemove(null);
  };

  const handleAcknowledge = (index: number) => {
    props.onAcknowledgeBatchItemError?.(index);
    setFeedback({
      jobId: job.id,
      policyId: job.policyId,
      index,
      kind: "status",
      text: "Error reconocido. El documento sigue en error: reconocerlo no lo resuelve.",
    });
  };

  /**
   * Whether a feedback entry is still rendered for the CURRENT job. Error
   * feedback (a settled typed failure or a refusal) stays visible across a
   * policy-authority replacement of the same job — it reports what the
   * attempt did (or did not do) and never claims a current item state.
   * Status feedback (success, acknowledgement) describes the item under the
   * captured authority, so a replaced policy authority no longer shows it.
   */
  const feedbackVisible =
    feedback !== null &&
    feedback.jobId === job.id &&
    (feedback.kind === "error" || feedback.policyId === job.policyId);

  return (
    <section aria-labelledby="batch-review-step-heading">
      <h2
        id="batch-review-step-heading"
        className="font-display text-xl font-bold text-primary-dark"
      >
        Revisión
      </h2>
      <p className="mt-2 max-w-3xl text-base leading-relaxed">
        Revise cada documento del lote por separado. Cada documento conserva sus propias decisiones,
        y moverse entre documentos nunca cambia el estado de revisión de otro documento.
      </p>

      {errorMessage && (
        <p
          role="alert"
          className={`mt-3 max-w-3xl rounded border border-primary-dark bg-surface-light px-3 py-2 text-sm font-semibold text-primary-dark ${focusRing}`}
        >
          {errorMessage}
        </p>
      )}

      <section
        aria-label="Batch documents"
        className="mt-4 rounded border border-primary bg-surface-light p-3"
      >
        <h3 className="font-display text-base font-bold text-primary-dark">Documentos</h3>
        <ul aria-label="Batch document status" className="mt-2 space-y-1">
          {files.map((file, index) => {
            const status = file.itemStatus ?? "queued";
            const selectable = sessions?.[index] !== undefined;
            const isActive = activeIndex === index;
            const isFailed = status === "error";
            const removed = file.itemDisposition === "removed";
            const acknowledged = file.itemAcknowledged === true;
            // Retry is contextual (#78): offered only when the domain
            // classifies the item as retryable (processing failure with
            // retained text, not removed, not policy-unsupported) AND the
            // bridge retains the shared cross-document context.
            const retryOffered =
              isFailed &&
              !removed &&
              retryContextAvailable &&
              props.onRetryBatchItem !== undefined &&
              isBatchItemRetryable(job, index);
            const recoveryOffered = isFailed && !removed;
            return (
              <li key={index}>
                {selectable ? (
                  <button
                    type="button"
                    onClick={() => props.onSelectDocument(index)}
                    aria-current={isActive ? "true" : undefined}
                    className={`w-full rounded border px-2 py-1 text-left text-sm ${
                      isActive
                        ? "border-primary-dark bg-surface-dark text-white"
                        : "border-primary bg-white text-neutral-800 hover:bg-surface-light"
                    } ${focusRing}`}
                  >
                    <span className="font-semibold">{file.name}</span>
                    {" — "}
                    <span>{BATCH_STATUS_LABELS[status]}</span>
                  </button>
                ) : (
                  <div>
                    <p className="rounded border border-neutral-300 bg-white px-2 py-1 text-sm text-neutral-800">
                      <span className="font-semibold">{file.name}</span>
                      {" — "}
                      <span>{BATCH_STATUS_LABELS[status]}</span>
                      {file.itemError !== undefined && <> — {file.itemError.message}</>}
                      {removed && <span className="font-semibold"> — Retirado del lote</span>}
                      {acknowledged && <span className="font-semibold"> — Error reconocido</span>}
                    </p>
                    {recoveryOffered && (
                      <div className="mt-1 flex flex-wrap items-center gap-2 px-2">
                        {retryOffered && (
                          <button
                            type="button"
                            disabled={attemptInFlight}
                            onClick={() => void handleRetry(index)}
                            className={`rounded border border-primary-dark px-2 py-1 text-xs font-semibold text-primary-dark hover:bg-surface-dark hover:text-white disabled:cursor-wait disabled:opacity-70 ${focusRing}`}
                          >
                            Reintentar
                          </button>
                        )}
                        {props.onRemoveBatchItem !== undefined &&
                          (confirmingRemove !== null &&
                          confirmingRemove.jobId === job.id &&
                          confirmingRemove.index === index ? (
                            <span
                              role="group"
                              aria-label={`Confirmar la retirada de ${file.name}`}
                              className="flex flex-wrap items-center gap-2"
                            >
                              <span className="text-xs text-neutral-800">
                                El documento dejará de participar en el trabajo pendiente del lote y
                                en el resultado preparado. Su nombre y su error seguirán
                                registrados, y los demás documentos no se verán afectados.
                              </span>
                              <button
                                type="button"
                                onClick={() => handleConfirmRemove(index)}
                                className={`rounded border border-primary-dark bg-primary-dark px-2 py-1 text-xs font-semibold text-white hover:bg-primary ${focusRing}`}
                              >
                                Confirmar retirada
                              </button>
                              <button
                                type="button"
                                onClick={() => setConfirmingRemove(null)}
                                className={`rounded border border-primary-dark px-2 py-1 text-xs font-semibold text-primary-dark hover:bg-surface-dark hover:text-white ${focusRing}`}
                              >
                                Cancelar
                              </button>
                            </span>
                          ) : (
                            <button
                              type="button"
                              onClick={() =>
                                setConfirmingRemove({
                                  jobId: job.id,
                                  policyId: job.policyId,
                                  index,
                                })
                              }
                              className={`rounded border border-primary-dark px-2 py-1 text-xs font-semibold text-primary-dark hover:bg-surface-dark hover:text-white ${focusRing}`}
                            >
                              Retirar del lote
                            </button>
                          ))}
                        {!acknowledged && props.onAcknowledgeBatchItemError !== undefined && (
                          <button
                            type="button"
                            onClick={() => handleAcknowledge(index)}
                            className={`rounded border border-primary-dark px-2 py-1 text-xs font-semibold text-primary-dark hover:bg-surface-dark hover:text-white ${focusRing}`}
                          >
                            Reconocer error
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                )}
                {retrying !== null &&
                  retrying.jobId === job.id &&
                  retrying.policyId === job.policyId &&
                  retrying.index === index && (
                    <p
                      role="status"
                      className={`mt-1 px-2 text-sm font-semibold text-neutral-800 ${focusRing}`}
                    >
                      Reintentando…
                    </p>
                  )}
                {feedbackVisible && feedback!.index === index && (
                  <p
                    role={feedback!.kind === "error" ? "alert" : "status"}
                    className={`mt-1 px-2 text-sm ${
                      feedback!.kind === "error"
                        ? "font-semibold text-primary-dark"
                        : "text-neutral-800"
                    } ${focusRing}`}
                  >
                    {feedback!.text}
                  </p>
                )}
              </li>
            );
          })}
        </ul>
        <p className="mt-3 text-xs leading-relaxed text-neutral-600">
          Los documentos de este lote mantienen sustituciones internas y fechas coherentes entre
          todos los documentos del mismo trabajo.
        </p>
      </section>

      {activeSession !== undefined ? (
        <ReviewWorkspace
          session={activeSession}
          onDecide={props.onDecide}
          onAddManual={props.onAddManual}
        />
      ) : (
        <p
          role="status"
          className="mt-4 max-w-3xl rounded border border-primary bg-surface-light px-3 py-2 text-sm text-neutral-800"
        >
          {stillReading
            ? "Los documentos se están leyendo todavía. La revisión comienza automáticamente cuando todos los documentos se han leído."
            : failedCodes.length > 0
              ? "No hay ningún documento disponible para revisión. Los documentos con error permanecen en la lista con su error registrado y con las acciones de recuperación que cada uno ofrece."
              : "Todavía no hay ningún documento disponible para revisión."}
        </p>
      )}
    </section>
  );
}
