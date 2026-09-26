/**
 * Typed classification of a processing attempt's failure (T15 #19).
 *
 * The job lifecycle must never confuse "processing failed" with "not
 * processed yet" (GitHub #19 acceptance bullet 3, D-009 fail-closed). This
 * module is the single bridge between the typed failures the engine boundary
 * throws and the {@link ProcessingFailure} record the Job domain appends to
 * {@link Job.errors}. It is pure, React-free and DOM-free.
 *
 * Explicit PRIVACY decision: the raw message of an UNRECOGNIZED error is
 * deliberately NOT copied into the diagnostic. Such a message is not authored
 * by a typed contract, so it could contain source content (or any other
 * runtime detail), and copying it would leak content into a Job error. Only
 * errors whose messages are authored by a typed contract (engine, policy,
 * review-session and job-model failures) keep their message verbatim, because
 * those messages carry the actionable contract text (for example the shared
 * oversize message that tells the user how to split the input). Everything
 * else collapses to the fixed {@link PROCESSING_UNKNOWN_MESSAGE}, which
 * interpolates no value at all.
 */
import { JobModelError, type ProcessingFailure } from "./domain/job";
import { OVERSIZE_INPUT_CODE } from "./engine/input-limits";
import { PolicyError } from "./engine/policy";
import { EngineError } from "./engine/types";
import { ReviewSessionError } from "./review/review-domain";

/**
 * Fixed, value-free message for an attempt whose outcome could not be
 * established. It names the situation and an action (retry, or split the
 * input and try again) and contains no interpolated value, no locale API and
 * no part of the source text.
 */
export const PROCESSING_UNKNOWN_MESSAGE =
  "Processing did not complete and its outcome could not be established. Retry, or split the input into smaller parts and try again.";

/**
 * Classify a thrown value from a processing attempt into the Job's typed
 * failure vocabulary. Recognized typed failures keep their own message; an
 * oversize engine failure is distinguished from every other engine failure so
 * the shared actionable size message reaches the diagnostics verbatim. Every
 * unrecognized value (including non-Error throws) maps to
 * `processing-unknown` with the fixed message.
 */
export function classifyProcessingFailure(error: unknown): ProcessingFailure {
  if (error instanceof EngineError) {
    if (error.code === OVERSIZE_INPUT_CODE) {
      return { code: "input-too-large", message: error.message };
    }
    return { code: "processing-failed", message: error.message };
  }
  if (error instanceof ReviewSessionError) {
    return { code: "invalid-source", message: error.message };
  }
  if (error instanceof PolicyError) {
    return { code: "policy-unsupported", message: error.message };
  }
  if (error instanceof JobModelError) {
    return { code: "processing-failed", message: error.message };
  }
  return { code: "processing-unknown", message: PROCESSING_UNKNOWN_MESSAGE };
}
