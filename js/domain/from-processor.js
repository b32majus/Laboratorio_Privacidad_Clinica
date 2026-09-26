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
 * Below-threshold candidates (Work Order T14 #18, WU-B): a composition result
 * may additionally carry `result.candidates` (the explicit candidate
 * contract produced by the engine). `candidateDetectionsFromProcessorResult`
 * maps them to the same Detection contract as entities, marked with
 * `lowConfidence: true`, `source: 'engine'` and `requiresReview: true`
 * (fail-closed; see the asymmetry note below). `createReviewSessionFromProcessor`
 * includes them BY DEFAULT: silently omitting candidates is exactly the
 * "silent disappearance" this ticket forbids.
 *
 * Fail-closed default (D-009): every mapped engine detection gets
 * requiresReview = true unless the caller supplies an explicit rule via
 * options.requiresReview(entity). Unknown classification never defaults
 * to auto-accept. Candidate detections are ALWAYS `requiresReview: true`:
 * they are deliberately NOT subject to `options.requiresReview` (which takes
 * an ENTITY), because an unknown privacy state must never silently become
 * KEEP; the asymmetry is intentional and documented here.
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
 * Map a Processor result's below-threshold candidates to the V4 Detection
 * contract. The input result object is never mutated.
 *
 * An ABSENT `result.candidates` is the explicit empty set: the pre-V4 legacy
 * engine result carries its discarded detail as `scoring.descartadas`
 * WITHOUT source offsets, so it cannot be mapped and must never be
 * fabricated. A `candidates` field that is PRESENT but not an array is a
 * malformed contract and fails closed.
 *
 * Every candidate is mapped with `lowConfidence: true`, `source: 'engine'`
 * and `requiresReview: true` (always — candidates are never subject to the
 * `options.requiresReview` entity rule). Validation is fail-closed on the
 * engine-produced facts: offsets must be integers, `type` and `reason`
 * non-empty strings, `confidence` a FINITE number, `proposed` a string (the
 * empty string stays valid: it is the accepted deletion encoding) and
 * `subtype`, when present, a string. This mapper is the boundary that keeps a
 * malformed candidate from becoming detached detection metadata.
 *
 * The returned `original` is only a structural input: the ReviewSession
 * authority re-derives the canonical span text from the immutable source
 * text by offsets (`normalizeDetection`). This mapper deliberately does NOT
 * duplicate the session's offset-bounds check (`0 <= start <= end <=
 * source.length`); the authority enforces it fail-closed.
 *
 * @param {unknown} result structural Processor result that may carry candidates
 * @returns {Array<object>} candidate detections in ReviewSession input shape
 */
export function candidateDetectionsFromProcessorResult(result) {
  if (!result || typeof result !== 'object') {
    throw new TypeError('candidateDetectionsFromProcessorResult: expected a Processor result object');
  }
  if (result.candidates === undefined) return [];
  if (!Array.isArray(result.candidates)) {
    throw new TypeError(
      'candidateDetectionsFromProcessorResult: result.candidates must be an array when present',
    );
  }
  return result.candidates.map((candidate, index) => {
    if (!candidate || typeof candidate !== 'object') {
      throw new TypeError(`candidateDetectionsFromProcessorResult: candidate at index ${index} is not an object`);
    }
    const position = candidate.position;
    if (!position || typeof position !== 'object') {
      throw new TypeError(`candidateDetectionsFromProcessorResult: candidate at index ${index} is missing position`);
    }
    if (!Number.isInteger(position.start) || !Number.isInteger(position.end)) {
      throw new TypeError(
        `candidateDetectionsFromProcessorResult: candidate at index ${index} position start/end must be integers`,
      );
    }
    if (typeof candidate.type !== 'string' || candidate.type.length === 0) {
      throw new TypeError(`candidateDetectionsFromProcessorResult: candidate at index ${index} must have a non-empty type`);
    }
    if (typeof candidate.proposed !== 'string') {
      throw new TypeError(`candidateDetectionsFromProcessorResult: candidate at index ${index} must have a string proposed`);
    }
    if (typeof candidate.confidence !== 'number' || !Number.isFinite(candidate.confidence)) {
      throw new TypeError(`candidateDetectionsFromProcessorResult: candidate at index ${index} must have a finite numeric confidence`);
    }
    if (candidate.subtype !== undefined && typeof candidate.subtype !== 'string') {
      throw new TypeError(`candidateDetectionsFromProcessorResult: candidate at index ${index} subtype must be a string when present`);
    }
    if (typeof candidate.reason !== 'string' || candidate.reason.length === 0) {
      throw new TypeError(`candidateDetectionsFromProcessorResult: candidate at index ${index} must have a non-empty reason`);
    }
    return {
      type: candidate.type,
      subtype: candidate.subtype === undefined ? undefined : candidate.subtype,
      start: position.start,
      end: position.end,
      original: candidate.original !== undefined ? candidate.original : candidate.text,
      confidence: candidate.confidence,
      proposed: candidate.proposed,
      reason: candidate.reason,
      lowConfidence: true,
      source: 'engine',
      requiresReview: true,
    };
  });
}

/**
 * Create a ReviewSession directly from a Processor result, preserving
 * result.sessionId as the stable-ID namespace.
 *
 * Candidate detections are included BY DEFAULT, appended AFTER the entity
 * detections (entities first in their existing order, then candidates in
 * their order). Appending candidates does NOT renumber entity detection IDs:
 * stable IDs depend only on content and the existing ordinals, and the
 * entities are mapped in the same order with the same content as before.
 * Pass `options.includeCandidates === false` to reproduce the pre-T14
 * entity-only session exactly.
 *
 * @param {object} result structural Processor result
 * @param {object} [options] forwarded to detectionsFromProcessorResult
 * @param {boolean} [options.includeCandidates] set false to omit candidates
 * @returns {object} frozen ReviewSession
 */
export function createReviewSessionFromProcessor(result, options = {}) {
  const entityDetections = detectionsFromProcessorResult(result, options);
  const candidateDetections =
    options.includeCandidates === false ? [] : candidateDetectionsFromProcessorResult(result);
  return createReviewSession({
    originalText: result.original,
    detections: [...entityDetections, ...candidateDetections],
    sessionId: result.sessionId,
  });
}
