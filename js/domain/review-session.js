/**
 * V4 ReviewSession domain model (Work Order T01).
 *
 * Pure, DOM-independent, dependency-free ESM module.
 * Owns: immutable source text, normalized detections with stable session IDs,
 * explicit review decisions, manual detections anchored to source offsets,
 * progress, preview and final text. Final output is derived from source
 * offsets + decisions only, never from rendered markup.
 *
 * Decision statuses:
 *   - 'pending'   initial implicit state (no stored decision yet)
 *   - 'accepted'  use the engine/manual proposal (`proposed`, may be '' for
 *                 deletions); rejected for detections without a proposal
 *   - 'modified'  explicit replacement text supplied by the reviewer
 *   - 'restored'  keep the original span; an explicit completed decision that
 *                 stays visible in progress data (Privacy Gate warnings)
 *
 * Fail-closed semantics (D-009): every detection defaults to
 * requiresReview = true unless the caller explicitly supplies a rule or
 * value. Unknown classification never defaults to auto-accept. Export
 * (getFinalText) throws while any requiresReview detection is pending.
 *
 * Immutability style: every mutating operation (applyDecision,
 * addManualDetection) returns a NEW frozen session object; inputs
 * (Processor results, caller detection arrays, prior sessions) are never
 * mutated. Detections and decisions are defensively copied and frozen.
 */

/** Typed error exported by this module; carries a machine-readable code. */
export class ReviewSessionError extends Error {
  /**
   * @param {string} code machine-readable error code
   * @param {string} message human-readable description
   */
  constructor(code, message) {
    super(message);
    this.name = 'ReviewSessionError';
    this.code = code;
  }
}

const DECISION_STATUSES = new Set(['pending', 'accepted', 'modified', 'restored']);
const DETECTION_SOURCES = new Set(['engine', 'manual']);

/**
 * Deterministic 32-bit FNV-1a hash (hex). Plain JS so the module stays
 * runnable in any engine without platform crypto.
 * @param {string} value
 * @returns {string}
 */
function fnv1aHex(value) {
  let hash = 0x811c9dc5;
  for (let i = 0; i < value.length; i++) {
    hash ^= value.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash.toString(16).padStart(8, '0');
}

/**
 * Stable detection ID: derived from the session namespace + detection
 * content (source, type, offsets, original text) + a content-duplicate
 * ordinal. Never the array index alone; identical inputs always produce
 * identical IDs, and IDs do not change as decisions accumulate.
 */
function computeStableId(sessionId, detection, duplicateOrdinal) {
  const content = [detection.source, detection.type, detection.start, detection.end, detection.original].join('\u0000');
  const hash = fnv1aHex(`${sessionId}\u0000${content}`);
  const duplicateSuffix = duplicateOrdinal > 0 ? `-${duplicateOrdinal + 1}` : '';
  return `det-${sessionId}-${hash}${duplicateSuffix}`;
}

function assertInteger(name, value) {
  if (!Number.isInteger(value)) {
    throw new ReviewSessionError('INVALID_OFFSET', `${name} must be an integer, got: ${String(value)}`);
  }
}

function normalizeDetection(raw, originalText, index) {
  if (!raw || typeof raw !== 'object') {
    throw new ReviewSessionError('INVALID_DETECTION', `detection at index ${index} is not an object`);
  }
  const start = raw.start;
  const end = raw.end;
  assertInteger(`detections[${index}].start`, start);
  assertInteger(`detections[${index}].end`, end);
  if (start < 0 || end < 0) {
    throw new ReviewSessionError('INVALID_OFFSET', `detections[${index}] has a negative offset`);
  }
  if (start > end) {
    throw new ReviewSessionError('INVALID_OFFSET', `detections[${index}] has start > end (${start} > ${end})`);
  }
  if (end > originalText.length) {
    throw new ReviewSessionError(
      'INVALID_OFFSET',
      `detections[${index}] is out of bounds (end ${end} > source length ${originalText.length})`,
    );
  }
  if (typeof raw.type !== 'string' || raw.type.length === 0) {
    throw new ReviewSessionError('INVALID_DETECTION', `detections[${index}] must have a non-empty type`);
  }
  const source = raw.source === undefined ? 'engine' : raw.source;
  if (!DETECTION_SOURCES.has(source)) {
    throw new ReviewSessionError('INVALID_DETECTION', `detections[${index}] has unknown source: ${String(source)}`);
  }
  // Fail-closed default (D-009): requireReview unless explicitly false.
  const requiresReview = raw.requiresReview === undefined ? true : Boolean(raw.requiresReview);
  // Canonical source span (authority: exact text comes from source offsets):
  // `original` is ALWAYS derived from the immutable source text, so stale or
  // inconsistent detector metadata can never alter pending preview, restored
  // final output or any other rendered span.
  const normalized = { type: raw.type, start, end, source, requiresReview, original: originalText.slice(start, end) };
  // Omit optional keys entirely when undefined so deep-equality snapshots
  // of the session stay stable.
  if (raw.subtype !== undefined) normalized.subtype = raw.subtype;
  if (raw.confidence !== undefined) normalized.confidence = raw.confidence;
  if (raw.proposed !== undefined) normalized.proposed = raw.proposed;
  if (raw.reason !== undefined) normalized.reason = raw.reason;
  if (raw.note !== undefined) normalized.note = raw.note;
  return normalized;
}

/**
 * Create a review session. Caller inputs are never mutated: the source
 * text is captured as-is (strings are immutable) and detections are
 * defensively copied and frozen.
 *
 * @param {object} input
 * @param {string} input.originalText immutable source text
 * @param {Array<object>} input.detections raw detections (engine or manual shape)
 * @param {string} [input.sessionId] namespace for stable detection IDs
 * @returns {object} frozen session
 */
export function createReviewSession({ originalText, detections, sessionId }) {
  if (typeof originalText !== 'string') {
    throw new ReviewSessionError('INVALID_SOURCE', 'originalText must be a string');
  }
  if (!Array.isArray(detections)) {
    throw new ReviewSessionError('INVALID_DETECTION', 'detections must be an array');
  }
  const namespace = sessionId === undefined || sessionId === null ? 'session' : String(sessionId);

  const normalized = detections.map((raw, index) => normalizeDetection(raw, originalText, index));

  // Deterministic ID assignment; duplicates (identical content) get an
  // ordinal that depends only on content, not array position. A finite
  // content hash can map two distinct detections onto the same id, so each
  // resolved id is checked against the ids already assigned in this session
  // and deterministically disambiguated when taken by different content.
  // Uniqueness within the session is therefore enforced, not assumed; the
  // algorithm depends only on detection content and array order, so the same
  // inputs always produce the same ids and existing ids never change when
  // detections are added later.
  const contentCounts = new Map();
  const usedIds = new Map();
  const withIds = normalized.map((detection) => {
    const contentKey = [detection.source, detection.type, detection.start, detection.end, detection.original].join('\u0000');
    const ordinal = contentCounts.get(contentKey) ?? 0;
    contentCounts.set(contentKey, ordinal + 1);
    let id = computeStableId(namespace, detection, ordinal);
    if (usedIds.has(id) && usedIds.get(id) !== contentKey) {
      let n = 1;
      while (usedIds.has(`${id}-x${n}`) && usedIds.get(`${id}-x${n}`) !== contentKey) n += 1;
      id = `${id}-x${n}`;
    }
    usedIds.set(id, contentKey);
    return Object.freeze({ id, ...detection });
  });

  return Object.freeze({
    originalText,
    sessionId: namespace,
    detections: Object.freeze(withIds),
    decisions: Object.freeze({}),
  });
}

function assertSession(session) {
  if (!session || typeof session !== 'object' || !Array.isArray(session.detections)) {
    throw new ReviewSessionError('INVALID_SESSION', 'expected a ReviewSession object');
  }
}

function findDetection(session, id) {
  const detection = session.detections.find((d) => d.id === id);
  if (!detection) {
    throw new ReviewSessionError('UNKNOWN_DETECTION', `no detection with id: ${String(id)}`);
  }
  return detection;
}

/**
 * Return the decision for a detection. Pending is the implicit initial
 * state and is therefore not stored in the decisions map.
 */
export function getDecision(session, id) {
  assertSession(session);
  findDetection(session, id); // validate the id belongs to this session
  const stored = session.decisions[id];
  if (stored) return stored;
  return Object.freeze({ status: 'pending' });
}

/**
 * Effective decision status of one detection — the single coherent
 * derivation every decision-state consumer must use (ARCH-011 coherence,
 * Work Order T11 #15 WU4).
 *
 * Returns:
 *   - the stored decision status ('accepted' | 'modified' | 'restored')
 *     when an explicit decision exists;
 *   - 'pending' when the detection requiresReview AND is undecided (the
 *     implicit initial state; blocks export — D-009 fail-closed);
 *   - 'not-required' when the detection has requiresReview = false AND is
 *     undecided: policy determined that review is not required and no
 *     human decision was recorded. This is factually NOT 'pending'
 *     (nothing awaits a decision) and NEVER 'accepted' (no human accepted
 *     anything — ARCH-011 invariant); the span renders its original per
 *     the resolveSpan rules.
 *
 * Single-sourcing note: getDecision keeps returning the implicit 'pending'
 * for every undecided detection (unchanged T01 semantics) and
 * getPendingDetections/canFinalize/getProgress/getFinalText keep their
 * exact current semantics; only this accessor adds the requiresReview
 * distinction so mapping-level status and aggregate pending/finalize data
 * (e.g. Confidential Audit trace) can never contradict.
 *
 * @param {object} session
 * @param {string} id detection id
 * @returns {'accepted'|'modified'|'restored'|'pending'|'not-required'}
 */
export function getEffectiveStatus(session, id) {
  assertSession(session);
  const detection = findDetection(session, id);
  const stored = session.decisions[id];
  if (stored) return stored.status;
  return detection.requiresReview ? 'pending' : 'not-required';
}

/**
 * Apply a review decision. Returns a NEW frozen session; the input session
 * is never mutated.
 *
 * @param {object} session
 * @param {string} id detection id
 * @param {'accepted'|'modified'|'restored'|'pending'} decision
 * @param {object} [extras]
 * @param {string} [extras.replacement] required for 'modified'
 * @param {string} [extras.note] optional reviewer note
 * @returns {object} new frozen session
 */
export function applyDecision(session, id, decision, extras = {}) {
  assertSession(session);
  const detection = findDetection(session, id); // validate the id belongs to this session
  if (!DECISION_STATUSES.has(decision)) {
    throw new ReviewSessionError(
      'INVALID_DECISION',
      `unknown decision status: ${String(decision)} (expected one of ${[...DECISION_STATUSES].join(', ')})`,
    );
  }
  // Accepted means accepting an EXISTING proposal. A detection without one
  // (e.g. a manual detection) must not be completable via 'accepted'; the
  // deletion encoding (proposed === '') is a valid proposal and stays so.
  if (decision === 'accepted' && detection.proposed === undefined) {
    throw new ReviewSessionError(
      'INVALID_DECISION',
      `decision 'accepted' requires an existing proposal; detection ${id} has no proposal (use 'modified' with a replacement, or 'restored')`,
    );
  }
  if (extras.note !== undefined && typeof extras.note !== 'string') {
    throw new ReviewSessionError('INVALID_NOTE', 'note must be a string');
  }
  if (extras.replacement !== undefined && typeof extras.replacement !== 'string') {
    throw new ReviewSessionError('INVALID_REPLACEMENT', 'replacement must be a string');
  }
  if (decision === 'modified' && typeof extras.replacement !== 'string') {
    throw new ReviewSessionError('INVALID_REPLACEMENT', "decision 'modified' requires a replacement string");
  }

  let stored;
  if (decision === 'pending') {
    stored = undefined; // reset to implicit initial state
  } else if (decision === 'modified') {
    stored = Object.freeze(
      extras.note === undefined
        ? { status: decision, replacement: extras.replacement }
        : { status: decision, replacement: extras.replacement, note: extras.note },
    );
  } else {
    // 'accepted' uses the proposal (proposed may be '' for deletions);
    // 'restored' keeps the original span as an explicit completed decision.
    stored = Object.freeze(
      extras.note === undefined
        ? { status: decision }
        : { status: decision, note: extras.note },
    );
  }

  const decisions = { ...session.decisions };
  if (stored === undefined) {
    delete decisions[id];
  } else {
    decisions[id] = stored;
  }
  // Keep the detection list identical (IDs survive decisions).
  return Object.freeze({
    ...session,
    detections: session.detections,
    decisions: Object.freeze(decisions),
  });
}

/**
 * Add a manual detection anchored to the immutable source offsets.
 * Validated: integer offsets, 0 <= start <= end <= source length,
 * non-empty type. Always source 'manual' and requiresReview true.
 * Returns a NEW frozen session.
 */
export function addManualDetection(session, { start, end, type, subtype, note }) {
  assertSession(session);
  const raw = { start, end, type, subtype, note, source: 'manual', requiresReview: true };
  const detection = normalizeDetection(raw, session.originalText, 'manual');

  const namespace = session.sessionId;
  // Rebuild the resolved-id registry from the existing session so the new
  // detection cannot alias an existing identity; existing ids are never
  // recomputed or renumbered.
  const usedIds = new Map();
  for (const d of session.detections) {
    if (!usedIds.has(d.id)) {
      usedIds.set(d.id, [d.source, d.type, d.start, d.end, d.original].join('\u0000'));
    }
  }
  const contentKey = [detection.source, detection.type, detection.start, detection.end, detection.original].join('\u0000');
  const ordinal = session.detections.filter(
    (d) => [d.source, d.type, d.start, d.end, d.original].join('\u0000') === contentKey,
  ).length;
  let id = computeStableId(namespace, detection, ordinal);
  if (usedIds.has(id) && usedIds.get(id) !== contentKey) {
    let n = 1;
    while (usedIds.has(`${id}-x${n}`) && usedIds.get(`${id}-x${n}`) !== contentKey) n += 1;
    id = `${id}-x${n}`;
  }
  const withId = Object.freeze({ id, ...detection });

  return Object.freeze({
    ...session,
    detections: Object.freeze([...session.detections, withId]),
    decisions: session.decisions,
  });
}

/**
 * Decide what a detection's span renders as, given its decision.
 * - pending + requiresReview  → original (preview) / blocked for final
 * - pending + !requiresReview → original (no review needed)
 * - accepted                  → proposal (proposed may be '' for deletion)
 * - modified                  → explicit replacement
 * - restored                  → exact original span
 */
function resolveSpan(session, detection) {
  const decision = session.decisions[detection.id];
  const status = decision ? decision.status : 'pending';
  if (status === 'modified') return decision.replacement;
  if (status === 'accepted') return detection.proposed !== undefined ? detection.proposed : detection.original;
  return detection.original;
}

/**
 * Deterministically compose source text + decisions. Spans are ordered by
 * source offsets (start, then end). The engine de-overlaps detections, but
 * if given adjacent or overlapping spans this still composes deterministically:
 * a span starting before the current cursor contributes no leading text.
 */
function composeText(session) {
  const sorted = [...session.detections].sort((a, b) => a.start - b.start || a.end - b.end);
  let cursor = 0;
  let out = '';
  for (const detection of sorted) {
    if (detection.end <= cursor) continue; // fully covered by a previous span
    out += session.originalText.slice(cursor, Math.max(cursor, detection.start));
    out += resolveSpan(session, detection);
    cursor = detection.end;
  }
  out += session.originalText.slice(cursor);
  return out;
}

/**
 * Derived purely from state (source text + detections + decisions).
 * Pending detections render their original span. No DOM involved.
 */
export function getPreview(session) {
  assertSession(session);
  return composeText(session);
}

/**
 * Detections that still require an explicit decision before export.
 */
export function getPendingDetections(session) {
  assertSession(session);
  return session.detections.filter(
    (detection) => detection.requiresReview && !(session.decisions[detection.id]),
  );
}

/**
 * Non-throwing export gate: true when no requiresReview detection is pending.
 */
export function canFinalize(session) {
  return getPendingDetections(session).length === 0;
}

/**
 * Factual progress data for the review surface and the Privacy Gate.
 * Restored originals remain visible here (never silently dropped).
 */
export function getProgress(session) {
  assertSession(session);
  const pending = getPendingDetections(session);
  const restoredDetections = session.detections.filter(
    (detection) => session.decisions[detection.id]?.status === 'restored',
  );
  const counts = { accepted: 0, modified: 0, restored: 0 };
  for (const detection of session.detections) {
    const status = session.decisions[detection.id]?.status;
    if (status && status in counts) counts[status] += 1;
  }
  return Object.freeze({
    total: session.detections.length,
    pending: pending.length,
    decided: session.detections.length - pending.length,
    accepted: counts.accepted,
    modified: counts.modified,
    restored: counts.restored,
    manual: session.detections.filter((detection) => detection.source === 'manual').length,
    pendingDetections: Object.freeze(pending),
    restoredDetections: Object.freeze(restoredDetections),
    canFinalize: pending.length === 0,
  });
}

/**
 * Exact final text computed from source offsets and decisions.
 * Throws a typed ReviewSessionError (code MANDATORY_REVIEW_PENDING) while
 * any requiresReview detection is pending — fail-closed export gate.
 */
export function getFinalText(session) {
  assertSession(session);
  const pending = getPendingDetections(session);
  if (pending.length > 0) {
    throw new ReviewSessionError(
      'MANDATORY_REVIEW_PENDING',
      `cannot finalize: ${pending.length} mandatory review decision(s) pending`,
    );
  }
  return composeText(session);
}
