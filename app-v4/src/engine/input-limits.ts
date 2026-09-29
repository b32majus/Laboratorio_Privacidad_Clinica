/**
 * Supported input size authority (SPEC_V4_PRIVACY_ENGINE §11, D-009,
 * FUNC-004).
 *
 * One exported source of truth for "how large may one document be". Before
 * this module the limit was a private `1_000_000` literal duplicated across
 * the V4 engine adapter and both recognizer guards. V4 refuses input above the
 * limit with an explicit, user-actionable failure instead of silently
 * truncating it the way the legacy brownfield core does (FUNC-004). The legacy
 * core is deliberately left untouched: V4 preserves legacy mirror semantics
 * (CURRENT_DECISIONS D-003) precisely by refusing what legacy would truncate.
 *
 * Unit of the limit: UTF-16 code units, measured with `String.length`. This
 * preserves exact parity with the legacy core's `text.length > 1000000`
 * comparison. The limit must never be described as bytes or as "1 MB".
 *
 * This module has no dependencies on other engine modules: it is a pure,
 * Worker-safe leaf that both the engine boundary and (WU-B) the input layer
 * can consume without pulling the legacy graph in.
 */

/** Largest number of UTF-16 code units supported per document. */
export const MAX_SUPPORTED_TEXT_LENGTH = 1_000_000;

/** Shared machine code for an input above the supported size. */
export const OVERSIZE_INPUT_CODE = "input-too-large";

/**
 * Typed, payload-free oversize failure facts. It carries only measurements
 * and a fixed message; no part of the rejected input text ever appears here.
 */
export type OversizeInput = {
  readonly code: "input-too-large";
  readonly measuredLength: number;
  readonly supportedLength: number;
  readonly excessLength: number;
  readonly message: string;
};

/**
 * Fixed, deterministic action template. Built ONLY from the two numbers, with
 * plain digits (no dates, no locale APIs such as `toLocaleString`) and never
 * including any part of the input text.
 */
function oversizeMessage(measuredLength: number, supportedLength: number): string {
  return `Input text is ${measuredLength} characters; this build supports up to ${supportedLength} characters per document. Split the text into parts of at most ${supportedLength} characters and process each part as its own job.`;
}

/**
 * Total over strings and fail-closed: any `text.length >
 * MAX_SUPPORTED_TEXT_LENGTH` yields the typed failure facts, and any
 * `text.length <= MAX_SUPPORTED_TEXT_LENGTH` (including the empty string)
 * yields `null`. `excessLength` is `measuredLength - supportedLength`.
 */
export function oversizeInputFor(text: string): OversizeInput | null {
  return oversizeInputForLength(text.length);
}

/**
 * Length-based form of the same authority (STRUCT-012): identical limit,
 * facts and message template as {@link oversizeInputFor}, for callers that
 * measured the text without holding it as one string (e.g. a structured grid
 * whose cells live in separate arrays). This keeps ONE source of truth for
 * the supported size: both forms share the boundary, the typed facts and the
 * actionability message by construction.
 */
export function oversizeInputForLength(measuredLength: number): OversizeInput | null {
  if (measuredLength <= MAX_SUPPORTED_TEXT_LENGTH) return null;
  return Object.freeze({
    code: OVERSIZE_INPUT_CODE,
    measuredLength,
    supportedLength: MAX_SUPPORTED_TEXT_LENGTH,
    excessLength: measuredLength - MAX_SUPPORTED_TEXT_LENGTH,
    message: oversizeMessage(measuredLength, MAX_SUPPORTED_TEXT_LENGTH),
  });
}

/**
 * Exact, single-source presence predicate:
 * `isTextWithinSupportedSize(text)` is exactly `oversizeInputFor(text) === null`.
 */
export function isTextWithinSupportedSize(text: string): boolean {
  return oversizeInputFor(text) === null;
}
