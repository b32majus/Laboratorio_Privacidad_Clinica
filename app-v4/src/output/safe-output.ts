/**
 * Safe Output service (Work Order T08 U1, GitHub #12).
 *
 * Builds the SAFE export artifact of the review session: the final text
 * after every explicitly decided span. Safe Output is a separate product
 * from Confidential Audit (CURRENT_DECISIONS.md D-005): it carries the
 * reviewer's canonical final text and nothing else — no original↔
 * replacement correspondence, no reviewer notes, no detection metadata,
 * no original values kept for audit traceability.
 *
 * Fail-closed (D-009): while any mandatory (requiresReview) detection is
 * pending, Safe Output does not exist. Pending-state logic is NEVER
 * re-implemented here: `js/domain/review-session.js` (Work Order T01,
 * re-exported through ../review/review-domain) is the ONLY review
 * authority (D-004); this module only consumes its typed export gate.
 *
 * Privacy: memory-only, no logging of content, no network, no persistence.
 * No anonymity, compliance or certification wording: the output is an
 * explicitly reviewed text, not an "anonymous" one (D-006).
 */
import {
  ReviewSessionError,
  canFinalize,
  getFinalText,
  type ReviewSession,
} from "../review/review-domain";

/** The minimal Safe Output shape: no field can carry audit/mapping data. */
export interface SafeOutput {
  readonly kind: "safe-output";
  readonly text: string;
}

/** Typed error for invalid Safe Output inputs (fail-closed serialization). */
export class SafeOutputError extends Error {
  readonly code: string;
  constructor(code: string, message: string) {
    super(message);
    this.name = "SafeOutputError";
    this.code = code;
  }
}

/** The only enumerable keys a Safe Output may ever carry. */
const SAFE_OUTPUT_KEYS: readonly string[] = ["kind", "text"];

/**
 * Build the Safe Output of a completed review session.
 *
 * Throws the session authority's typed `ReviewSessionError` (code
 * MANDATORY_REVIEW_PENDING) while any mandatory decision is pending.
 * On success the text is EXACTLY the canonical final text: spans the
 * reviewer explicitly restored / kept as original legitimately remain,
 * because that was an explicit human decision.
 */
export function buildSafeOutput(session: ReviewSession): SafeOutput {
  if (!canFinalize(session)) {
    throw new ReviewSessionError(
      "MANDATORY_REVIEW_PENDING",
      "Safe Output is blocked while mandatory review decisions are pending."
    );
  }
  return Object.freeze({
    kind: "safe-output" as const,
    text: getFinalText(session),
  });
}

/**
 * Deterministic TXT serialization for a `safe-output.txt` artifact.
 * Byte-exact: the artifact content is the final text and nothing else.
 * Fails closed on any value that is not a structurally valid Safe Output.
 */
export function serializeSafeOutput(output: SafeOutput): string {
  if (!isSafeOutput(output)) {
    throw new SafeOutputError(
      "INVALID_SAFE_OUTPUT",
      "serializeSafeOutput requires a structurally valid Safe Output."
    );
  }
  return output.text;
}

/** Minimal structural guard for values crossing into the export UI unit. */
export function isSafeOutput(value: unknown): value is SafeOutput {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return false;
  }
  const keys = Object.keys(value).sort();
  if (keys.length !== SAFE_OUTPUT_KEYS.length || keys.some((k, i) => k !== SAFE_OUTPUT_KEYS[i])) {
    return false;
  }
  const candidate = value as Record<string, unknown>;
  return candidate.kind === "safe-output" && typeof candidate.text === "string";
}
