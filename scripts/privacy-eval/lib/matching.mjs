// Pure matching logic for the ground-truth privacy regression harness (T02).
// No I/O here: deterministic and unit-testable in isolation.

/**
 * Normalizes text for deterministic annotation/detection comparison.
 * Casefolds, strips diacritics, and collapses whitespace.
 * @param {string} value
 * @returns {string}
 */
export function normalizeText(value) {
  return String(value)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Tolerant span-text match: exact equality or containment after normalization.
 * Containment tolerates honorifics ("Dr. Juan Martinez Sanchez" contains
 * "Juan Martinez Sanchez") and partial spans ("654 321 987" inside
 * "+34 654 321 987").
 * @param {string} annotationValue
 * @param {string} detectionText
 * @returns {boolean}
 */
export function textMatches(annotationValue, detectionText) {
  const a = normalizeText(annotationValue);
  const d = normalizeText(detectionText);
  if (a.length === 0 || d.length === 0) {
    return false;
  }
  return d === a || d.includes(a) || a.includes(d);
}

/**
 * True when the annotation value occurs in the case text.
 * Used as a fail-closed corpus validation (annotations must be locatable).
 * @param {string} caseText
 * @param {string} annotationValue
 * @returns {boolean}
 */
export function occursInText(caseText, annotationValue) {
  const t = normalizeText(caseText);
  const v = normalizeText(annotationValue);
  return v.length > 0 && t.includes(v);
}

/**
 * Greedy deterministic assignment of detections/flagged items to annotations.
 *
 * Matching runs in two phases to reduce order sensitivity:
 * 1. exact phase: every positive annotation first tries to claim an entity
 *    detection whose normalized text is exactly equal;
 * 2. containment phase: still-unmatched annotations may claim a detection by
 *    normalized containment.
 * Detection order is otherwise preserved (first unconsumed match wins).
 *
 * Semantics:
 * - MUST_REMOVE and MUST_FLAG_FOR_REVIEW are "positive" expectations: the span
 *   must be surfaced by the engine.
 *   - MUST_REMOVE is satisfied only by an entity detection (the engine will
 *     transform it). If it only appears in the low-confidence flagged surface,
 *     it is recorded in `flagged_only` AND counted as missed.
 *   - MUST_FLAG_FOR_REVIEW is satisfied by an entity detection OR by the
 *     flagged (low-confidence, still visible) surface, per decision D-008.
 * - MUST_KEEP is a false-positive expectation: any entity detection covering
 *   that value is a `must_keep_violation`.
 * - Entity detections that match no annotation are `unexpected_detection`.
 * - Flagged items that match no positive annotation are surfaced as
 *   `unmatched_flagged` but are NOT false positives: low-confidence discards
 *   leave the value in the text and must not inflate precision penalties.
 *
 * @param {Array<{label: string, entity_type: string, value: string}>} annotations
 * @param {Array<{text: string, type: string}>} detections  engine entities
 * @param {Array<{text: string, type: string}>} flaggedItems low-confidence visible items
 * @returns {{
 *   matched: Array<{annotation: object, via: 'detection'|'flagged'}>,
 *   missed: Array<object>,
 *   flagged_only: Array<object>,
 *   false_positives: Array<{detection: object, reason: string, annotation: object|null}>,
 *   unmatched_flagged: Array<object>
 * }}
 */
export function assignDetections(annotations, detections, flaggedItems = []) {
  const positives = annotations.filter((a) => a.label !== 'MUST_KEEP');
  const keeps = annotations.filter((a) => a.label === 'MUST_KEEP');

  const matched = [];
  const missed = [];
  const flagged_only = [];
  const false_positives = [];
  const unmatched_flagged = [];

  const consumedDetections = new Set();
  const consumedFlagged = new Set();

  const findExact = (annotation) => {
    for (let i = 0; i < detections.length; i++) {
      if (consumedDetections.has(i)) continue;
      const det = detections[i];
      if (det.type !== annotation.entity_type) continue;
      if (normalizeText(det.text) !== normalizeText(annotation.value)) continue;
      return i;
    }
    return -1;
  };

  const findContaining = (annotation) => {
    for (let i = 0; i < detections.length; i++) {
      if (consumedDetections.has(i)) continue;
      const det = detections[i];
      if (det.type !== annotation.entity_type) continue;
      if (!textMatches(annotation.value, det.text)) continue;
      return i;
    }
    return -1;
  };

  for (const annotation of positives) {
    let detectionIndex = findExact(annotation);
    if (detectionIndex < 0) {
      detectionIndex = findContaining(annotation);
    }

    if (detectionIndex >= 0) {
      consumedDetections.add(detectionIndex);
      matched.push({ annotation, via: 'detection' });
      continue;
    }

    let flaggedIndex = -1;
    for (let i = 0; i < flaggedItems.length; i++) {
      if (consumedFlagged.has(i)) continue;
      const item = flaggedItems[i];
      if (item.type !== annotation.entity_type) continue;
      if (!textMatches(annotation.value, item.text)) continue;
      flaggedIndex = i;
      break;
    }

    if (flaggedIndex >= 0) {
      consumedFlagged.add(flaggedIndex);
      if (annotation.label === 'MUST_FLAG_FOR_REVIEW') {
        matched.push({ annotation, via: 'flagged' });
      } else {
        // MUST_REMOVE only surfaced at low confidence: visible but not transformed.
        flagged_only.push(annotation);
        missed.push(annotation);
      }
      continue;
    }

    missed.push(annotation);
  }

  for (let i = 0; i < detections.length; i++) {
    if (consumedDetections.has(i)) continue;
    const det = detections[i];
    const keepHit = keeps.find(
      (k) => k.entity_type === det.type && textMatches(k.value, det.text)
    );
    false_positives.push({
      detection: det,
      reason: keepHit ? 'must_keep_violation' : 'unexpected_detection',
      annotation: keepHit || null
    });
  }

  for (let i = 0; i < flaggedItems.length; i++) {
    if (consumedFlagged.has(i)) continue;
    unmatched_flagged.push(flaggedItems[i]);
  }

  return { matched, missed, flagged_only, false_positives, unmatched_flagged };
}
