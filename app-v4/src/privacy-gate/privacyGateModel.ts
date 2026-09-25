/**
 * Pure model for the Privacy Gate step (Work Order T08 U3; SPEC §6).
 *
 * Everything derives factually from the frozen ReviewSession (the only
 * review authority, D-004) and the frozen Job; nothing is mutated. Only
 * what the session/job actually carries is derived: low-confidence queues
 * (T14) and batch/structured surfaces (T17/T18) own their own later
 * extensions and are deliberately NOT improvised here.
 *
 * D-006: this model never produces a privacy score, a safe percentage, an
 * anonymity claim or certification wording — factual state only.
 */
import type { Job } from "../domain/job";
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

/** The complete factual Privacy Gate view, derived in one pure pass. */
export type PrivacyGateView = {
  /** Privacy policy in effect for the job (D-007 vocabulary). */
  readonly policyId: Job["policyId"];
  /** Whether all mandatory review decisions are complete (fail-closed). */
  readonly complete: boolean;
  /** Mandatory decisions still pending (fail-closed export gate). */
  readonly pendingCount: number;
  /** Direct identifiers treated: accepted + modified decision counts. */
  readonly treatedAccepted: number;
  readonly treatedModified: number;
  /** Manual detections recorded in the session. */
  readonly manualDetections: number;
  /** Restored originals — each one also yields a kept-original warning. */
  readonly restoredCount: number;
  readonly warnings: readonly PrivacyGateWarning[];
  /** Job errors surfaced factually, exactly as the job carries them. */
  readonly errors: readonly Job["errors"][number][];
  /** Output availability facts as written by the state bridge (D-005). */
  readonly safeOutputReady: boolean;
  readonly confidentialAuditReady: boolean;
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
 * Derive the Privacy Gate view from the job + review session. Frozen result;
 * the session and job are never mutated.
 */
export function derivePrivacyGateView(job: Job, review: ReviewSession): PrivacyGateView {
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
    treatedAccepted: progress.accepted,
    treatedModified: progress.modified,
    manualDetections: progress.manual,
    restoredCount: progress.restored,
    warnings,
    errors: job.errors,
    safeOutputReady: job.outputs.safeOutputReady,
    confidentialAuditReady: job.outputs.confidentialAuditReady,
  });
}
