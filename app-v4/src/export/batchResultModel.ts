/**
 * Batch Result readiness model + Safe summary CSV (REC-07 #87).
 *
 * Pure, DOM-free derivation of the human batch ending: `ready` /
 * `needs-attention` / `blocked`, plus the first accepted batch Safe
 * deliverable. It consumes ONLY existing batch authorities — the Job's item
 * state through `deriveBatchFacts` and the accepted review-completeness fact
 * (`job.review.complete`, derived by the bridge from `batchReviewComplete`)
 * — and never invents a second batch state machine:
 *
 * - any ACTIVE failed item (`error` not deliberately removed) => `blocked`;
 * - otherwise any queued/reading/processing/review-required work or
 *   incomplete mandatory review => `needs-attention`;
 * - only when no active failed item remains and all non-removed work is
 *   complete => `ready`.
 *
 * A deliberately removed failed item stays factually `error + removed`: it
 * is never relabelled `completed` and no longer blocks readiness after the
 * accepted #78 disposition. The representation preserves that distinction
 * (representation-narrowing safeguard): removal is never collapsed into
 * completion.
 *
 * The Safe summary CSV is the minimal Safe manifest: one row per ORIGINAL
 * batch selection index in original selection order (1-based stable index),
 * with exactly the accepted columns `indice_lote,estado,disposicion`. A
 * completed reviewed item serializes as `estado=completado` with an empty
 * `disposicion`; a deliberately removed failed item serializes as
 * `estado=error, disposicion=retirado`. Serialization is fail-closed: any
 * other item state (active failure, pending work) throws a typed error and
 * produces ZERO bytes, so an unauthorized batch can never produce a partial
 * manifest. The CSV carries no filenames, no source/extracted text, no
 * original↔replacement correspondence, no reviewer notes, no typed error
 * detail and no Confidential Audit data.
 *
 * Ordinary copy is Spanish professional language (PDR-08) and carries no
 * Privacy Gate, serializer, ReviewSession, source-offset or Class→Action
 * vocabulary. Memory-only, no logging, no network, no persistence (D-013).
 */
import { batchSafeSummaryReady, type Job } from "../domain/job";
import { deriveBatchFacts } from "../privacy-gate/privacyGateModel";

/** The three human batch Result states, kept deliberately distinguishable. */
export type BatchResultState = "ready" | "needs-attention" | "blocked";

/** Deterministic Spanish filename of the Safe summary CSV. */
export const BATCH_SUMMARY_CSV_FILENAME = "resumen-lote-seguro.csv";

/** The only accepted Safe manifest columns. */
export const BATCH_SUMMARY_CSV_HEADER = "indice_lote,estado,disposicion";

/** Typed fail-closed serialization failure: the batch artifact is not authorized. */
export class BatchSummaryError extends Error {
  readonly code = "BATCH_SUMMARY_NOT_AUTHORIZED";

  constructor(message: string) {
    super(message);
    this.name = "BatchSummaryError";
  }
}

export type BatchResultView = {
  readonly state: BatchResultState;
  /** Every original selection item (including deliberately removed ones). */
  readonly totalCount: number;
  readonly completedCount: number;
  /** Non-error items whose review is not yet `completed`. */
  readonly pendingCount: number;
  /** Every `error` item, including deliberately removed ones (factual history). */
  readonly failedCount: number;
  /** Failed items that are still active blockers (not deliberately removed). */
  readonly activeFailedCount: number;
  readonly removedCount: number;
  /** Names of the ACTIVE failed items, in input order (corrective orientation). */
  readonly failedNames: readonly string[];
  /** Factual Spanish reason shown when the state is `needs-attention`. */
  readonly attentionMessage: string | null;
  /** Factual Spanish reason shown when the state is `blocked`. */
  readonly blockedMessage: string | null;
};

function attentionMessageFor(pendingCount: number, removedCount: number): string {
  if (pendingCount === 1) {
    return "Queda 1 documento por revisar antes de poder preparar el resumen del lote.";
  }
  if (pendingCount > 1) {
    return `Quedan ${pendingCount} documentos por revisar antes de poder preparar el resumen del lote.`;
  }
  if (removedCount > 0) {
    return (
      "Este lote no tiene ningún documento completado para el resumen: " +
      "todos los documentos con error se retiraron del lote."
    );
  }
  return "Este lote todavía no está listo para preparar el resumen seguro.";
}

function blockedMessageFor(activeFailedCount: number): string {
  const subject =
    activeFailedCount === 1
      ? "Hay 1 documento con error en el lote"
      : `Hay ${activeFailedCount} documentos con error en el lote`;
  return `${subject}. Vuelve a la revisión para reintentarlo o retirarlo del lote.`;
}

/**
 * Derive the batch Result view from the current batch Job. The same
 * authoritative batch state that drives gate/recovery facts drives this
 * Result state; no second state machine is introduced.
 */
export function deriveBatchResultView(job: Job): BatchResultView {
  const facts = deriveBatchFacts(job);
  const removedCount = facts.items.filter((item) => item.removed === true).length;
  const failedNames = Object.freeze(
    facts.items
      .filter((item) => item.status === "error" && item.removed !== true)
      .map((item) => item.name)
  );
  const base = {
    totalCount: facts.items.length,
    completedCount: facts.completedCount,
    pendingCount: facts.pendingCount,
    failedCount: facts.failedCount,
    activeFailedCount: facts.activeFailedCount,
    removedCount,
    failedNames,
  } as const;

  if (facts.activeFailedCount > 0) {
    return {
      ...base,
      state: "blocked",
      attentionMessage: null,
      blockedMessage: blockedMessageFor(facts.activeFailedCount),
    };
  }
  // Readiness for the batch Safe summary is the SAME shared authority the
  // Privacy Gate and the serializer consume (CORA-87-02): a batch with
  // completed-looking rows but a false/absent `review.complete`, a false
  // item-derived completeness, or any active failure is never `ready`.
  if (!batchSafeSummaryReady(job)) {
    return {
      ...base,
      state: "needs-attention",
      attentionMessage: attentionMessageFor(facts.pendingCount, removedCount),
      blockedMessage: null,
    };
  }
  return {
    ...base,
    state: "ready",
    attentionMessage: null,
    blockedMessage: null,
  };
}

/** RFC-4180 field escaping, aligned with the accepted structured CSV writer. */
function escapeCsvField(value: string): string {
  if (/[",\r\n]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

/**
 * Serialize the Safe batch summary CSV for a READY batch: header plus one
 * row per original selection index in original selection order. Fails
 * closed with a typed error (zero bytes) unless the batch Safe summary is
 * authorized by the ONE shared readiness authority
 * ({@link batchSafeSummaryReady}: a document batch whose authoritative review
 * completeness and item-derived completeness are both true with no active
 * failed item). The per-item guard below stays as defense-in-depth: any item
 * that is neither a completed reviewed item nor a deliberately removed failed
 * item also throws — so an active failed, pending or completeness-mismatched
 * batch is never serializable, and the UI precondition is never the only
 * guard (CORA-87-01).
 */
export function serializeBatchSummaryCsv(job: Job): string {
  const facts = deriveBatchFacts(job);
  if (!batchSafeSummaryReady(job)) {
    throw new BatchSummaryError(
      "serializeBatchSummaryCsv refuses to serialize: the batch Safe summary is not authorized " +
        "while the review is incomplete, the derived completeness disagrees, or an active batch error remains."
    );
  }
  const lines = [BATCH_SUMMARY_CSV_HEADER];
  facts.items.forEach((item, position) => {
    const index = position + 1;
    if (item.status === "completed") {
      lines.push([String(index), "completado", ""].map(escapeCsvField).join(","));
      return;
    }
    if (item.status === "error" && item.removed === true) {
      lines.push([String(index), "error", "retirado"].map(escapeCsvField).join(","));
      return;
    }
    throw new BatchSummaryError(
      `serializeBatchSummaryCsv refuses batch item ${index} ("${item.name}"): ` +
        `the Safe summary is authorized only when every item is completed or deliberately removed.`
    );
  });
  return lines.join("\n");
}
