/**
 * Domain model for human review.
 *
 * The source text and source offsets are immutable. UI code may render this
 * state, but the DOM is never authoritative.
 */

export class ReviewIncompleteError extends Error {
  constructor(pendingDetectionIds) {
    super(`Review incomplete: ${pendingDetectionIds.length} decision(s) pending`);
    this.name = 'ReviewIncompleteError';
    this.pendingDetectionIds = [...pendingDetectionIds];
  }
}

const VALID_STATUSES = new Set(['pending', 'accepted', 'modified', 'restored']);

function assertInteger(value, label) {
  if (!Number.isInteger(value)) {
    throw new TypeError(`${label} must be an integer`);
  }
}

function cloneDetection(detection) {
  return {
    ...detection,
    position: { ...detection.position },
    metadata: detection.metadata ? { ...detection.metadata } : {}
  };
}

function cloneDecision(decision) {
  return { ...decision };
}

export class ReviewSession {
  /**
   * @param {object} input
   * @param {string} input.originalText
   * @param {Array<object>} input.detections
   */
  constructor({ originalText, detections = [] }) {
    if (typeof originalText !== 'string') {
      throw new TypeError('originalText must be a string');
    }
    if (!Array.isArray(detections)) {
      throw new TypeError('detections must be an array');
    }

    this.originalText = originalText;
    this._manualSequence = 0;
    this._detections = [];
    this._decisions = new Map();

    detections.forEach((entity, index) => {
      const detection = this._normalizeDetection(entity, index);
      this._assertRange(detection.position.start, detection.position.end);
      this._assertNoDuplicateId(detection.id);
      this._assertNoOverlap(detection.position.start, detection.position.end);

      this._detections.push(detection);
      this._decisions.set(detection.id, {
        detectionId: detection.id,
        status: 'pending',
        replacement: detection.proposed,
        notes: ''
      });
    });

    this._sortDetections();
  }

  /**
   * Bridge from the current Processor result contract.
   */
  static fromProcessingResult(result) {
    if (!result || typeof result !== 'object') {
      throw new TypeError('processing result is required');
    }
    return new ReviewSession({
      originalText: result.original || '',
      detections: Array.isArray(result.entities) ? result.entities : []
    });
  }

  _normalizeDetection(entity, index) {
    if (!entity || typeof entity !== 'object' || !entity.position) {
      throw new TypeError(`Invalid detection at index ${index}`);
    }

    const start = entity.position.start;
    const end = entity.position.end;
    const sourceOriginal = entity.original ?? entity.text;
    const original = typeof sourceOriginal === 'string'
      ? sourceOriginal
      : this.originalText.slice(start, end);

    return {
      id: String(entity.id || `det-${String(index + 1).padStart(4, '0')}`),
      type: entity.type || 'OTROS',
      subtype: entity.subtype || null,
      position: { start, end },
      original,
      proposed: typeof entity.transformed === 'string' ? entity.transformed : original,
      confidence: typeof entity.confidence === 'number' ? entity.confidence : null,
      source: entity.source || 'engine',
      requiresReview: entity.requiresReview !== false,
      metadata: {
        scoring: entity.scoring,
        reason: entity.reason || entity.razon || null
      }
    };
  }

  _assertRange(start, end) {
    assertInteger(start, 'position.start');
    assertInteger(end, 'position.end');
    if (start < 0 || end <= start || end > this.originalText.length) {
      throw new RangeError(`Invalid detection range [${start}, ${end})`);
    }
  }

  _assertNoDuplicateId(id) {
    if (this._decisions.has(id) || this._detections.some((item) => item.id === id)) {
      throw new Error(`Duplicate detection id: ${id}`);
    }
  }

  _assertNoOverlap(start, end) {
    const conflict = this._detections.find((item) =>
      start < item.position.end && end > item.position.start
    );
    if (conflict) {
      throw new Error(
        `Detection range [${start}, ${end}) overlaps with ${conflict.id} ` +
        `[${conflict.position.start}, ${conflict.position.end})`
      );
    }
  }

  _sortDetections() {
    this._detections.sort((a, b) =>
      a.position.start - b.position.start || a.position.end - b.position.end
    );
  }

  _requireDetection(id) {
    const detection = this._detections.find((item) => item.id === id);
    if (!detection) {
      throw new Error(`Unknown detection: ${id}`);
    }
    return detection;
  }

  _setDecision(id, next) {
    const detection = this._requireDetection(id);
    if (!VALID_STATUSES.has(next.status)) {
      throw new Error(`Invalid review status: ${next.status}`);
    }

    const replacement = next.status === 'restored'
      ? detection.original
      : next.replacement;

    if (typeof replacement !== 'string') {
      throw new TypeError('replacement must be a string');
    }

    this._decisions.set(id, {
      detectionId: id,
      status: next.status,
      replacement,
      notes: typeof next.notes === 'string' ? next.notes : ''
    });
  }

  getDetections() {
    return this._detections.map(cloneDetection);
  }

  getDetection(id) {
    return cloneDetection(this._requireDetection(id));
  }

  getDecision(id) {
    this._requireDetection(id);
    return cloneDecision(this._decisions.get(id));
  }

  accept(id, notes = '') {
    const detection = this._requireDetection(id);
    this._setDecision(id, {
      status: 'accepted',
      replacement: detection.proposed,
      notes
    });
  }

  modify(id, replacement, notes = '') {
    this._setDecision(id, {
      status: 'modified',
      replacement,
      notes
    });
  }

  restore(id, notes = '') {
    this._setDecision(id, {
      status: 'restored',
      replacement: '',
      notes
    });
  }

  resetDecision(id) {
    const detection = this._requireDetection(id);
    this._decisions.set(id, {
      detectionId: id,
      status: 'pending',
      replacement: detection.proposed,
      notes: ''
    });
  }

  /**
   * Add a user-detected sensitive span using offsets from the immutable source.
   */
  addManualDetection({
    start,
    end,
    type = 'OTROS',
    subtype = null,
    replacement = '',
    confidence = 1,
    notes = '',
    requiresReview = true
  }) {
    this._assertRange(start, end);
    this._assertNoOverlap(start, end);

    this._manualSequence += 1;
    const id = `manual-${String(this._manualSequence).padStart(4, '0')}`;
    const original = this.originalText.slice(start, end);

    const detection = {
      id,
      type,
      subtype,
      position: { start, end },
      original,
      proposed: replacement,
      confidence,
      source: 'manual',
      requiresReview,
      metadata: { reason: 'USER_ADDED' }
    };

    this._detections.push(detection);
    this._sortDetections();
    this._decisions.set(id, {
      detectionId: id,
      status: requiresReview ? 'pending' : 'accepted',
      replacement,
      notes
    });

    return id;
  }

  removeManualDetection(id) {
    const detection = this._requireDetection(id);
    if (detection.source !== 'manual') {
      throw new Error('Only manual detections can be removed');
    }
    this._detections = this._detections.filter((item) => item.id !== id);
    this._decisions.delete(id);
  }

  getProgress() {
    const required = this._detections.filter((item) => item.requiresReview);
    const completed = required.filter((item) => {
      const decision = this._decisions.get(item.id);
      return decision && decision.status !== 'pending';
    });

    const statusCounts = {
      pending: 0,
      accepted: 0,
      modified: 0,
      restored: 0
    };

    for (const detection of this._detections) {
      const status = this._decisions.get(detection.id)?.status || 'pending';
      statusCounts[status] += 1;
    }

    return {
      total: required.length,
      completed: completed.length,
      pending: required.length - completed.length,
      percentage: required.length === 0
        ? 100
        : Math.round((completed.length / required.length) * 100),
      statusCounts
    };
  }

  getPendingDetectionIds() {
    return this._detections
      .filter((item) => item.requiresReview)
      .filter((item) => this._decisions.get(item.id)?.status === 'pending')
      .map((item) => item.id);
  }

  canExport() {
    return this.getPendingDetectionIds().length === 0;
  }

  _render({ allowPending }) {
    if (!allowPending) {
      const pending = this.getPendingDetectionIds();
      if (pending.length > 0) {
        throw new ReviewIncompleteError(pending);
      }
    }

    let output = this.originalText;
    const descending = [...this._detections].sort(
      (a, b) => b.position.start - a.position.start
    );

    for (const detection of descending) {
      const decision = this._decisions.get(detection.id);
      const replacement = decision?.replacement ?? detection.proposed;
      output =
        output.slice(0, detection.position.start) +
        replacement +
        output.slice(detection.position.end);
    }

    return output;
  }

  /**
   * Preview uses current proposals for decisions that are still pending.
   */
  getPreviewText() {
    return this._render({ allowPending: true });
  }

  /**
   * Final output is deliberately unavailable until required review is complete.
   */
  getFinalText() {
    return this._render({ allowPending: false });
  }

  toJSON() {
    return {
      originalText: this.originalText,
      detections: this.getDetections(),
      decisions: this._detections.map((item) => this.getDecision(item.id)),
      progress: this.getProgress()
    };
  }
}

export default ReviewSession;
