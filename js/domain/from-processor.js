/**
 * V4 adapter: Processor result → ReviewSession input (Work Order T01).
 *
 * Thin, structural adapter: it accepts a result object shaped like the
 * legacy js/core/processor.js output WITHOUT importing js/core, so it
 * stays testable headless and keeps the privacy core behind adapters.
 *
 * Legacy entity shape (verified in js/core/processor.js):
 *   { type, subtype, text, original, position: { start, end },
 *     confidence, transformed? }
 * Offsets are half-open [start, end) against result.original.
 * Deletion is encoded as transformed === '' (IDENTIFICADOR) and must be
 * preserved as proposed === '' (never collapsed to undefined).
 *
 * Review-time legacy UI fields (deleted/notes/manual) are NOT engine
 * contract and are intentionally ignored here.
 *
 * Fail-closed default (D-009): every mapped engine detection gets
 * requiresReview = true unless the caller supplies an explicit rule via
 * options.requiresReview(entity). Unknown classification never defaults
 * to auto-accept.
 */

import { createReviewSession } from './review-session.js';

/**
 * Map a Processor result's entities to the V4 Detection contract.
 * The input result object is never mutated.
 *
 * @param {object} result structural Processor result
 * @param {object} [options]
 * @param {(entity: object) => boolean} [options.requiresReview]
 *   explicit mandatory-review rule; defaults to always true
 * @returns {Array<object>} detections in ReviewSession input shape
 */
export function detectionsFromProcessorResult(result, options = {}) {
  if (!result || typeof result !== 'object' || !Array.isArray(result.entities)) {
    throw new TypeError('detectionsFromProcessorResult: expected a Processor result object with an entities array');
  }
  const requiresReviewRule = options.requiresReview;
  return result.entities.map((entity) => ({
    // id is intentionally omitted: the session assigns stable,
    // sessionId-namespaced IDs deterministically.
    type: entity.type,
    subtype: entity.subtype === undefined ? undefined : entity.subtype,
    start: entity.position.start,
    end: entity.position.end,
    original: entity.original !== undefined ? entity.original : entity.text,
    confidence: entity.confidence,
    // Preserve the deletion encoding: transformed === '' stays ''.
    proposed: entity.transformed,
    source: 'engine',
    requiresReview: requiresReviewRule ? Boolean(requiresReviewRule(entity)) : true,
  }));
}

/**
 * Create a ReviewSession directly from a Processor result, preserving
 * result.sessionId as the stable-ID namespace.
 *
 * @param {object} result structural Processor result
 * @param {object} [options] forwarded to detectionsFromProcessorResult
 * @returns {object} frozen ReviewSession
 */
export function createReviewSessionFromProcessor(result, options = {}) {
  return createReviewSession({
    originalText: result.original,
    detections: detectionsFromProcessorResult(result, options),
    sessionId: result.sessionId,
  });
}
