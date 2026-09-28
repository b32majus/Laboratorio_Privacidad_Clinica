/**
 * Pure model for the Privacy Gate step (Work Order T08 U3; SPEC §6).
 *
 * Everything derives factually from the frozen ReviewSession (the only
 * review authority, D-004) and the frozen Job; nothing is mutated. Only
 * what the session/job actually carries is derived: the low-confidence
 * candidate queue facts (T14 #18) come from the review authority's own
 * `getProgress` view (the marked detections and the pending list), so this
 * model re-derives nothing about session semantics.
 *
 * Batch facts (T17 #21 SD-9): for a `document-batch` job the per-item list,
 * its statuses and its failures are read from the JOB through the domain item
 * helpers (`batchItemStatus`/`batchFailedItems`) — the Job is the single
 * authority for batch state, never the active review session, which may be
 * absent. Structured surfaces (T18) still own their own later extensions and
 * are deliberately NOT improvised here.
 *
 * D-006: this model never produces a privacy score, a safe percentage, an
 * anonymity claim or certification wording — factual state only.
 */
import { batchFailedItems, batchItemStatus, type BatchItemStatus, type Job } from "../domain/job";
import {
  type ReviewSession,
  canFinalize,
  getPendingDetections,
  getProgress,
} from "../review/review-domain";

/** One factual gate warning (kept-original entries and similar). */
export type PrivacyGateWarning = {
  readonly code: string;
  readonly message: string;
};

/**
 * One factual document-batch item (T17 #21 SD-9). `errorMessage` is present
 * exactly when the item failed; the item stays visible either way.
 */
export type PrivacyGateBatchItem = {
  readonly index: number;
  readonly name: string;
  readonly status: BatchItemStatus;
  /** The item's typed failure message; present exactly when `status` is `error`. */
  readonly errorMessage?: string;
};

/**
 * Factual aggregate of a document batch's per-item state (T17 #21 SD-9).
 * `pendingCount` counts non-error items whose review is not yet `completed`;
 * failed items are counted separately and never hidden.
 */
export type PrivacyGateBatchFacts = {
  readonly items: readonly PrivacyGateBatchItem[];
  readonly pendingCount: number;
  readonly completedCount: number;
  readonly failedCount: number;
};

/** The complete factual Privacy Gate view, derived in one pure pass. */
export type PrivacyGateView = {
  /** Privacy policy in effect for the job (D-007 vocabulary). */
  readonly policyId: Job["policyId"];
  /** Whether all mandatory review decisions are complete (fail-closed). */
  readonly complete: boolean;
  /** Mandatory decisions still pending (fail-closed export gate). */
  readonly pendingCount: number;
  /**
   * Aggregate decision counts over ALL detection types (accepted = the
   * proposed replacement was applied; modified = an edited replacement was
   * applied). These are neutral review-progress facts: they carry NO
   * direct/quasi-identifier classification claim (corrective C2; taxonomy
   * ownership stays with T11/T12).
   */
  readonly reviewedAccepted: number;
  readonly reviewedModified: number;
  /** Manual detections recorded in the session. */
  readonly manualDetections: number;
  /** Restored originals — each one also yields a kept-original warning. */
  readonly restoredCount: number;
  /**
   * Low-confidence candidate facts (T14 #18): the total number of detections
   * marked `lowConfidence === true` in the session, and how many of those are
   * still pending (mandatory decisions not yet recorded). Derived only from
   * the review authority's `getProgress` view; factual counts, never a score.
   */
  readonly lowConfidenceCount: number;
  readonly lowConfidencePendingCount: number;
  readonly warnings: readonly PrivacyGateWarning[];
  /** Job errors surfaced factually, exactly as the job carries them. */
  readonly errors: readonly Job["errors"][number][];
  /** Output availability facts as written by the state bridge (D-005). */
  readonly safeOutputReady: boolean;
  readonly confidentialAuditReady: boolean;
  /**
   * Batch item facts; `null` for single-document and text jobs, whose
   * existing fields keep their byte-unchanged semantics (T17 #21 SD-9).
   */
  readonly batch: PrivacyGateBatchFacts | null;
};

/**
 * Explicit blocked message required while mandatory decisions are pending.
 * Status is always conveyed by this text, never by color alone.
 */
export function pendingDecisionMessage(count: number): string {
  return count === 1
    ? "Safe export is blocked while 1 mandatory review decision is pending."
    : `Safe export is blocked while ${count} mandatory review decisions are pending.`;
}

/**
 * Factual, fail-closed batch failure copy (T17 #21 SD-9): every failed file is
 * named with its own item error and the explicit remedy (create a new job
 * without it). No safety/anonymity claim, no hidden failure.
 */
export function batchFailedItemsMessage(items: readonly PrivacyGateBatchItem[]): string {
  const failed = items.filter((item) => item.status === "error");
  const detail = failed
    .map((item) => `"${item.name}"${item.errorMessage ? ` — ${item.errorMessage}` : ""}`)
    .join("; ");
  const subject =
    failed.length === 1 ? "a batch item failed" : `${failed.length} batch items failed`;
  const remedy =
    failed.length === 1
      ? "Create a new job without it to continue."
      : "Create a new job without them to continue.";
  return `Safe export is blocked because ${subject}: ${detail}. ${remedy}`;
}

/**
 * Explicit typed reason for the batch Safe Output unavailability (T17 #21
 * SD-7). The accepted specification defines no batch Safe Output format, so
 * the action stays disabled with this factual reason instead of inventing one.
 */
export function batchSafeOutputUnavailableMessage(): string {
  return (
    "Safe Output is not available for a document batch yet: the accepted " +
    "specification does not define a batch Safe Output format."
  );
}

/**
 * Derive the factual batch item facts from the JOB (T17 #21 SD-9). The domain
 * helpers are the single authority: `batchItemStatus` names each item's state
 * and `batchFailedItems` (fail-closed) supplies the failure details.
 */
export function deriveBatchFacts(job: Job): PrivacyGateBatchFacts {
  if (job.kind !== "document-batch" || job.source.type !== "files") {
    throw new Error(
      `deriveBatchFacts requires a document-batch job; job "${job.id}" is kind "${job.kind}".`
    );
  }
  const errorByIndex = new Map(
    batchFailedItems(job).map((item) => [item.index, item.error.message] as const)
  );
  const items = job.source.files.map((file, index) => {
    const status = batchItemStatus(job, index);
    const errorMessage = errorByIndex.get(index);
    return Object.freeze({
      index,
      name: file.name,
      status,
      ...(errorMessage === undefined ? {} : { errorMessage }),
    });
  });
  return Object.freeze({
    items: Object.freeze(items),
    pendingCount: items.filter((item) => item.status !== "error" && item.status !== "completed")
      .length,
    completedCount: items.filter((item) => item.status === "completed").length,
    failedCount: errorByIndex.size,
  });
}

/**
 * Derive the Privacy Gate view from the job + review session. Frozen result;
 * the session and job are never mutated.
 *
 * Signature/order unchanged (T17 #21 SD-9): for a `document-batch` job,
 * `review` is the active item's session or `null`; the batch facts come from
 * the Job, so the model never breaks when it is null. Single-document and text
 * jobs keep the exact previous derivation.
 */
export function derivePrivacyGateView(job: Job, review: ReviewSession | null): PrivacyGateView {
  if (job.kind === "document-batch") {
    return deriveBatchView(job, review);
  }
  if (review === null) {
    throw new Error(
      `derivePrivacyGateView requires a review session for job "${job.id}" of kind "${job.kind}".`
    );
  }
  return deriveSingleView(job, review);
}

/** Single-document and text derivation; byte-unchanged semantics (SD-9). */
function deriveSingleView(job: Job, review: ReviewSession): PrivacyGateView {
  const progress = getProgress(review);
  const pending = getPendingDetections(review);
  const complete = canFinalize(review);

  // Restored is a legitimate completed decision, never correspondence
  // leakage; each restored detection stays factually visible (SPEC §4).
  const warnings: readonly PrivacyGateWarning[] = Object.freeze(
    progress.restoredDetections.map((detection) =>
      Object.freeze({
        code: "kept-original",
        message: `Kept original — ${detection.type}: the original text was deliberately kept by reviewer decision (restored).`,
      })
    )
  );

  return Object.freeze({
    policyId: job.policyId,
    complete,
    pendingCount: pending.length,
    reviewedAccepted: progress.accepted,
    reviewedModified: progress.modified,
    manualDetections: progress.manual,
    restoredCount: progress.restored,
    lowConfidenceCount: progress.lowConfidence,
    lowConfidencePendingCount: pending.filter((detection) => detection.lowConfidence === true)
      .length,
    warnings,
    errors: job.errors,
    safeOutputReady: job.outputs.safeOutputReady,
    confidentialAuditReady: job.outputs.confidentialAuditReady,
    batch: null,
  });
}

/**
 * Document-batch derivation (T17 #21 SD-9): readiness comes from the Job's
 * derived `review.complete`; the batch item facts come from the Job's items.
 * The active item's session, when present, only supplies the neutral
 * per-detection counts and restored warnings — it never determines batch
 * readiness. Export unavailability itself is ExportStep's concern.
 */
function deriveBatchView(job: Job, review: ReviewSession | null): PrivacyGateView {
  const batch = deriveBatchFacts(job);
  const progress = review === null ? null : getProgress(review);
  const pendingDetections = review === null ? [] : getPendingDetections(review);

  const warnings: readonly PrivacyGateWarning[] =
    progress === null
      ? Object.freeze([])
      : Object.freeze(
          progress.restoredDetections.map((detection) =>
            Object.freeze({
              code: "kept-original",
              message: `Kept original — ${detection.type}: the original text was deliberately kept by reviewer decision (restored).`,
            })
          )
        );

  return Object.freeze({
    policyId: job.policyId,
    complete: job.review.complete,
    pendingCount: batch.pendingCount,
    reviewedAccepted: progress?.accepted ?? 0,
    reviewedModified: progress?.modified ?? 0,
    manualDetections: progress?.manual ?? 0,
    restoredCount: progress?.restored ?? 0,
    lowConfidenceCount: progress?.lowConfidence ?? 0,
    lowConfidencePendingCount: pendingDetections.filter(
      (detection) => detection.lowConfidence === true
    ).length,
    warnings,
    errors: job.errors,
    safeOutputReady: job.outputs.safeOutputReady,
    confidentialAuditReady: job.outputs.confidentialAuditReady,
    batch,
  });
}
