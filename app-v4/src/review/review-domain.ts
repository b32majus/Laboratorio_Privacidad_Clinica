/**
 * Typed V4 facade over the review authority (Work Order T07).
 *
 * `js/domain/review-session.js` (Work Order T01) is the ONLY review
 * authority (CURRENT_DECISIONS.md D-004): this module never re-implements
 * decisions, previews or final text; it re-exports the domain API with
 * TypeScript types (ambient declarations in
 * app-v4/src/engine/legacy-modules.d.ts) and maps a Job's source text
 * through the existing legacy engine adapter + `from-processor.js` adapter.
 *
 * ReviewSession objects are frozen domain state held by the app's state
 * bridge (useJobSession), never React-local UI state. Transient selection,
 * filters and drawers stay in the components.
 *
 * Privacy: content stays memory-only (D-013); nothing here logs, persists
 * or places sensitive text in URLs.
 */
import { createReviewSessionFromProcessor } from "../../../js/domain/from-processor.js";
import {
  addManualDetection,
  applyDecision,
  canFinalize,
  createReviewSession,
  getDecision,
  getFinalText,
  getPendingDetections,
  getPreview,
  getProgress,
  ReviewSessionError,
  type ReviewSession,
} from "../../../js/domain/review-session.js";
import { createLegacyEngine } from "../engine/legacy-engine";
import type { Job } from "../domain/job";

export {
  addManualDetection,
  applyDecision,
  canFinalize,
  createReviewSession,
  getDecision,
  getFinalText,
  getPendingDetections,
  getPreview,
  getProgress,
  ReviewSessionError,
};

export type {
  ReviewDecision,
  ReviewDetection,
  ReviewDetectionInput,
  ReviewProgress,
} from "../../../js/domain/review-session.js";
export type { ReviewSession } from "../../../js/domain/review-session.js";

/** Decision statuses the reviewer can set explicitly (pending is implicit). */
export type ExplicitDecisionStatus = "accepted" | "modified" | "restored";

/** Manual detection creation input (ReviewSession contract: source 'manual'). */
export type ManualDetectionInput = {
  readonly start: number;
  readonly end: number;
  readonly type: string;
  readonly subtype?: string;
  readonly note?: string;
};

/** Decision extras forwarded verbatim to the domain `applyDecision`. */
export type DecisionExtras = {
  readonly replacement?: string;
  readonly note?: string;
};

/**
 * Run the existing legacy engine over `text` and map the result through
 * the T01 adapter into a ReviewSession. Main-thread processing is fine at
 * this stage; the Web Worker boundary is a later ticket (T22).
 */
export function createSessionFromEngineText(text: string): ReviewSession {
  const engine = createLegacyEngine();
  const outcome = engine.process({ text, context: { mode: "fresh" } });
  // The T01 adapter validates the result shape fail-closed and returns a
  // frozen session; the ambient declaration keeps the structural type.
  return createReviewSessionFromProcessor(outcome.result) as ReviewSession;
}

/**
 * Whether the job family has a single reviewable source text. Batch jobs
 * need per-document sessions and the shared processing context (D-011) and
 * structured jobs need the classification workspace; both own later tickets
 * and are deliberately NOT improvised here.
 */
export function jobSupportsReview(job: Job): boolean {
  return job.kind === "text" || job.kind === "document";
}

/**
 * The single source text a review session is built from: pasted text for
 * text jobs, the extracted text of the one document for document jobs.
 * Returns null for job families whose review arrives with later tickets.
 */
export function jobSourceText(job: Job): string | null {
  if (job.source.type === "pasted-text") return job.source.text;
  if (job.kind !== "document") return null;
  const file = job.source.files[0];
  if (!file || file.extraction?.status !== "extracted") return null;
  return file.extraction.extractedText;
}

/**
 * Start review for a job: run the engine on its source text and build the
 * ReviewSession. Fails closed (typed ReviewSessionError) when the job has
 * no single reviewable source text instead of guessing.
 */
export function startReviewSession(job: Job): ReviewSession {
  const text = jobSourceText(job);
  if (text === null || text.trim().length === 0) {
    throw new ReviewSessionError(
      "INVALID_SOURCE",
      `Job "${job.name}" (${job.kind}) has no single reviewable source text; its review workflow arrives with a later V4 ticket.`
    );
  }
  return createSessionFromEngineText(text);
}
