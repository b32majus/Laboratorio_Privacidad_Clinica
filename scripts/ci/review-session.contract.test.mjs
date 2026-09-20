// Contract tests for the V4 ReviewSession domain model (Work Order T01).
// Deterministic oracle: pure Node, no DOM, no import of the real engine.
// All fixtures are synthetic; no real PHI patterns are used.

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import {
  ReviewSessionError,
  createReviewSession,
  applyDecision,
  addManualDetection,
  getPreview,
  getProgress,
  getPendingDetections,
  getDecision,
  canFinalize,
  getFinalText,
} from '../../js/domain/review-session.js';
import {
  createReviewSessionFromProcessor,
  detectionsFromProcessorResult,
} from '../../js/domain/from-processor.js';

// ---------------------------------------------------------------------------
// Synthetic fixtures (invented values only, no real PHI)
// ---------------------------------------------------------------------------

const SOURCE_TEXT =
  'Paciente Juan Pérez, DNI 12345678A, ingresado el 12/03/2024 en el Hospital Central.';

const offsetOf = (needle) => {
  const start = SOURCE_TEXT.indexOf(needle);
  assert.notEqual(start, -1, `fixture offset missing for: ${needle}`);
  return { start, end: start + needle.length };
};

// Literal fixture object shaped like the js/core/processor.js result
// ({ original, processed, entities[], alerts, stats, sessionId, processingTime, scoring }).
const fixtureResult = {
  original: SOURCE_TEXT,
  processed: SOURCE_TEXT.replace('Juan Pérez', 'PACIENTE_001'),
  entities: [
    {
      type: 'PACIENTE', subtype: null, text: 'Juan Pérez', original: 'Juan Pérez',
      position: offsetOf('Juan Pérez'), confidence: 0.95, transformed: 'PACIENTE_001',
    },
    {
      type: 'IDENTIFICADOR', subtype: 'DNI', text: '12345678A', original: '12345678A',
      position: offsetOf('12345678A'), confidence: 0.99, transformed: '', // deletion encoding
    },
    {
      type: 'FECHA', subtype: null, text: '12/03/2024', original: '12/03/2024',
      position: offsetOf('12/03/2024'), confidence: 0.9, transformed: '01/01/2024',
    },
    {
      type: 'UBICACION', subtype: 'HOSPITAL', text: 'Hospital Central', original: 'Hospital Central',
      position: offsetOf('Hospital Central'), confidence: 0.85, transformed: 'CENTRO_001',
    },
  ],
  alerts: [],
  stats: { total: 4 },
  sessionId: 'sess-fixture-0001',
  processingTime: 12,
  scoring: { usarScoring: true },
};

// Exact final text when every detection is accepted (DNI proposal is '' → deleted).
const FINAL_EXPECTED_ALL_ACCEPTED =
  'Paciente PACIENTE_001, DNI , ingresado el 01/01/2024 en el CENTRO_001.';

const snapshot = (value) => JSON.parse(JSON.stringify(value));

const acceptAll = (session) => {
  let current = session;
  for (const detection of [...current.detections]) {
    current = applyDecision(current, detection.id, 'accepted');
  }
  return current;
};

// ---------------------------------------------------------------------------
// 1. Headless: the domain layer must never reference the DOM
// ---------------------------------------------------------------------------

describe('headless contract', () => {
  test('js/domain sources contain no document/window references', () => {
    for (const file of ['js/domain/review-session.js', 'js/domain/from-processor.js']) {
      const source = readFileSync(new URL(`../../${file}`, import.meta.url), 'utf8');
      assert.doesNotMatch(source, /\b(document|window)\b/, `${file} must be DOM-free`);
    }
  });
});

// ---------------------------------------------------------------------------
// 2. Adapter: Processor result → session input (structural, no js/core import)
// ---------------------------------------------------------------------------

describe('adapter: from-processor', () => {
  test('maps engine entities to the Detection contract fields', () => {
    const detections = detectionsFromProcessorResult(fixtureResult);
    assert.equal(detections.length, 4);
    const dni = detections[1];
    assert.equal(dni.type, 'IDENTIFICADOR');
    assert.equal(dni.subtype, 'DNI');
    assert.equal(dni.start, fixtureResult.entities[1].position.start);
    assert.equal(dni.end, fixtureResult.entities[1].position.end);
    assert.equal(dni.original, '12345678A');
    assert.equal(dni.confidence, 0.99);
    assert.strictEqual(dni.proposed, ''); // deletion encoding preserved (not undefined)
    assert.equal(dni.source, 'engine');
    assert.equal(dni.requiresReview, true); // fail-closed default (D-009)
  });

  test('defaults requiresReview to true for every engine detection', () => {
    const detections = detectionsFromProcessorResult(fixtureResult);
    for (const detection of detections) assert.equal(detection.requiresReview, true);
  });

  test('honors an explicit requiresReview rule supplied by the caller', () => {
    const detections = detectionsFromProcessorResult(fixtureResult, {
      requiresReview: (entity) => entity.type !== 'FECHA',
    });
    const fecha = detections.find((d) => d.type === 'FECHA');
    const others = detections.filter((d) => d.type !== 'FECHA');
    assert.equal(fecha.requiresReview, false);
    for (const detection of others) assert.equal(detection.requiresReview, true);
  });

  test('namespaces stable IDs with the engine sessionId', () => {
    const session = createReviewSessionFromProcessor(fixtureResult);
    for (const detection of session.detections) {
      assert.ok(detection.id.includes('sess-fixture-0001'), `id not namespaced: ${detection.id}`);
    }
    // Same detections under a different namespace yield different IDs.
    const other = createReviewSession({
      originalText: SOURCE_TEXT,
      detections: detectionsFromProcessorResult(fixtureResult),
      sessionId: 'sess-other-9999',
    });
    assert.notDeepEqual(
      other.detections.map((d) => d.id),
      session.detections.map((d) => d.id),
    );
  });
});

// ---------------------------------------------------------------------------
// 3. Export gate: mandatory pending review blocks finalize (fail-closed)
// ---------------------------------------------------------------------------

describe('export gate', () => {
  test('fresh session cannot finalize: getFinalText throws, canFinalize false', () => {
    const session = createReviewSessionFromProcessor(fixtureResult);
    assert.equal(canFinalize(session), false);
    assert.throws(() => getFinalText(session), ReviewSessionError);
    try {
      getFinalText(session);
      assert.fail('expected getFinalText to throw');
    } catch (error) {
      assert.ok(error instanceof ReviewSessionError);
      assert.equal(error.code, 'MANDATORY_REVIEW_PENDING');
    }
    assert.equal(getPendingDetections(session).length, 4);
  });

  test('accepted decisions unblock finalize and produce the exact canonical text', () => {
    const session = acceptAll(createReviewSessionFromProcessor(fixtureResult));
    assert.equal(canFinalize(session), true);
    assert.equal(getPendingDetections(session).length, 0);
    assert.equal(getFinalText(session), FINAL_EXPECTED_ALL_ACCEPTED);
  });

  test('accept uses the engine proposal including the deletion encoding (proposed === "")', () => {
    const session = acceptAll(createReviewSessionFromProcessor(fixtureResult));
    const finalText = getFinalText(session);
    assert.ok(finalText.includes('PACIENTE_001'), 'accepted proposal applied');
    assert.ok(finalText.includes('01/01/2024'), 'accepted proposal applied');
    assert.ok(finalText.includes('CENTRO_001'), 'accepted proposal applied');
    assert.ok(!finalText.includes('12345678A'), 'DNI deleted via transformed === ""');
    assert.ok(!finalText.includes('Juan Pérez'), 'original replaced');
  });
});

// ---------------------------------------------------------------------------
// 4. Decisions: modify / restore / notes / validation
// ---------------------------------------------------------------------------

describe('decisions', () => {
  test('modified changes the canonical final output', () => {
    let session = acceptAll(createReviewSessionFromProcessor(fixtureResult));
    session = applyDecision(session, session.detections[0].id, 'modified', {
      replacement: 'FAMILIAR_009',
    });
    assert.equal(canFinalize(session), true);
    const finalText = getFinalText(session);
    assert.equal(
      getFinalText(session),
      'Paciente FAMILIAR_009, DNI , ingresado el 01/01/2024 en el CENTRO_001.',
    );
  });

  test('restored keeps the exact source span as a completed decision and stays visible in progress', () => {
    let session = acceptAll(createReviewSessionFromProcessor(fixtureResult));
    const pacienteId = session.detections[0].id;
    session = applyDecision(session, pacienteId, 'restored', { note: 'clinically relevant' });
    // Restored is a completed decision: it does not block export...
    assert.equal(canFinalize(session), true);
    assert.ok(getFinalText(session).includes('Juan Pérez'));
    // ...and it remains visible in progress data, not silently dropped.
    const progress = getProgress(session);
    assert.equal(progress.restored, 1);
    assert.deepEqual(progress.restoredDetections.map((d) => d.id), [pacienteId]);
  });

  test('notes are stored with the decision', () => {
    let session = createReviewSessionFromProcessor(fixtureResult);
    const id = session.detections[2].id;
    session = applyDecision(session, id, 'modified', { replacement: 'FECHA_0001', note: 'shifted date' });
    assert.deepEqual(getDecision(session, id), {
      status: 'modified',
      replacement: 'FECHA_0001',
      note: 'shifted date',
    });
  });

  test('rejects unknown detection ids and invalid decision statuses', () => {
    const session = createReviewSessionFromProcessor(fixtureResult);
    assert.throws(() => applyDecision(session, 'no-such-id', 'accepted'), ReviewSessionError);
    assert.throws(() => applyDecision(session, session.detections[0].id, 'unknown-status'), ReviewSessionError);
    assert.throws(() => applyDecision(session, session.detections[0].id, 'modified'), ReviewSessionError); // no replacement
  });
});

// ---------------------------------------------------------------------------
// 5. Manual detections
// ---------------------------------------------------------------------------

describe('manual detections', () => {
  test('participates in the same session, progress, gate and final render', () => {
    let session = acceptAll(createReviewSessionFromProcessor(fixtureResult));
    const span = offsetOf('ingresado el');
    session = addManualDetection(session, {
      start: span.start, end: span.end, type: 'SOSPECHOSO', note: 'manual flag',
    });
    const manual = session.detections.find((d) => d.source === 'manual');
    assert.ok(manual, 'manual detection present in session');
    assert.equal(manual.original, 'ingresado el');
    assert.equal(manual.requiresReview, true);
    assert.equal(getProgress(session).manual, 1);
    // It blocks export like any mandatory pending detection...
    assert.equal(canFinalize(session), false);
    // ...and its decision renders in the final text.
    session = applyDecision(session, manual.id, 'modified', { replacement: '[contexto]' });
    assert.equal(canFinalize(session), true);
    const finalText = getFinalText(session);
    assert.ok(finalText.includes('[contexto]'));
    assert.ok(!finalText.includes('ingresado el'));
  });

  test('rejects out-of-bounds, inverted and non-integer offsets', () => {
    const session = createReviewSessionFromProcessor(fixtureResult);
    const length = SOURCE_TEXT.length;
    assert.throws(() => addManualDetection(session, { start: 0, end: length + 1, type: 'SOSPECHOSO' }), ReviewSessionError);
    assert.throws(() => addManualDetection(session, { start: -1, end: 3, type: 'SOSPECHOSO' }), ReviewSessionError);
    assert.throws(() => addManualDetection(session, { start: 5, end: 3, type: 'SOSPECHOSO' }), ReviewSessionError);
    assert.throws(() => addManualDetection(session, { start: 1.5, end: 3, type: 'SOSPECHOSO' }), ReviewSessionError);
    assert.throws(() => addManualDetection(session, { start: 0, end: 3, type: '' }), ReviewSessionError);
  });
});

// ---------------------------------------------------------------------------
// 6. Preview and progress
// ---------------------------------------------------------------------------

describe('preview and progress', () => {
  test('getPreview on a fresh session equals the source text (pending spans render original)', () => {
    const session = createReviewSessionFromProcessor(fixtureResult);
    assert.equal(getPreview(session), SOURCE_TEXT);
  });

  test('getPreview reflects explicit decisions and stays DOM-free', () => {
    let session = createReviewSessionFromProcessor(fixtureResult);
    const dni = session.detections[1];
    session = applyDecision(session, dni.id, 'modified', { replacement: 'ID_REDACTED' });
    session = applyDecision(session, session.detections[3].id, 'restored');
    assert.equal(
      getPreview(session),
      'Paciente Juan Pérez, DNI ID_REDACTED, ingresado el 12/03/2024 en el Hospital Central.',
    );
  });

  test('getProgress reports counts, pending list and manual/restored visibility', () => {
    let session = createReviewSessionFromProcessor(fixtureResult);
    let progress = getProgress(session);
    assert.equal(progress.total, 4);
    assert.equal(progress.pending, 4);
    assert.equal(progress.decided, 0);
    assert.equal(progress.manual, 0);
    assert.equal(progress.restored, 0);
    assert.equal(progress.pendingDetections.length, 4);

    const fechaId = session.detections[2].id;
    session = applyDecision(session, fechaId, 'accepted');
    progress = getProgress(session);
    assert.equal(progress.accepted, 1);
    assert.equal(progress.decided, 1);
    assert.equal(progress.pending, 3);
    assert.equal(progress.pendingDetections.length, 3);
    assert.ok(progress.pendingDetections.every((d) => d.id !== fechaId));
  });
});

// ---------------------------------------------------------------------------
// 7. Immutability: no input mutation, new session on decision
// ---------------------------------------------------------------------------

describe('immutability', () => {
  test('applyDecision returns a new session and leaves the original untouched', () => {
    const session = createReviewSessionFromProcessor(fixtureResult);
    const before = snapshot(session);
    const next = applyDecision(session, session.detections[0].id, 'accepted');
    assert.deepEqual(session, before, 'original session object unchanged');
    assert.notEqual(next, session, 'a new session object is returned');
    assert.equal(getDecision(session, session.detections[0].id).status, 'pending');
    assert.equal(getDecision(next, session.detections[0].id).status, 'accepted');
  });

  test('createReviewSession does not mutate caller-supplied detections', () => {
    const raw = [{ type: 'X', start: 0, end: 2, original: 'AB', source: 'manual', requiresReview: true }];
    const rawBefore = snapshot(raw);
    createReviewSession({ originalText: 'ABCDEF', detections: raw, sessionId: 's1' });
    assert.deepEqual(raw, rawBefore);
  });

  test('ReviewSession never mutates the Processor result object (snapshot before/after)', () => {
    const before = snapshot(fixtureResult);
    let session = createReviewSessionFromProcessor(fixtureResult);
    session = acceptAll(session);
    session = addManualDetection(session, { start: 0, end: 8, type: 'SOSPECHOSO' });
    session = applyDecision(session, session.detections[4].id, 'accepted');
    getFinalText(session);
    assert.deepEqual(fixtureResult, before, 'processor result deep-equal before/after');
  });
});

// ---------------------------------------------------------------------------
// 8. Stable IDs
// ---------------------------------------------------------------------------

describe('stable detection ids', () => {
  test('same input yields the same IDs across sessions; IDs are not positional entity-N', () => {
    const s1 = createReviewSessionFromProcessor(fixtureResult);
    const s2 = createReviewSessionFromProcessor(fixtureResult);
    assert.deepEqual(s1.detections.map((d) => d.id), s2.detections.map((d) => d.id));
    for (const detection of s1.detections) {
      assert.doesNotMatch(detection.id, /^entity-\d+$/, 'legacy positional id pattern');
    }
  });

  test('IDs survive decisions', () => {
    let session = createReviewSessionFromProcessor(fixtureResult);
    const ids = session.detections.map((d) => d.id);
    session = acceptAll(session);
    assert.deepEqual(session.detections.map((d) => d.id), ids);
  });

  test('identical content duplicated in one session gets distinct deterministic IDs', () => {
    const base = { type: 'X', original: 'AB', source: 'manual', requiresReview: true };
    const session = createReviewSession({
      originalText: 'AB CD AB',
      detections: [{ ...base, start: 0, end: 2 }, { ...base, start: 6, end: 8 }],
      sessionId: 'dup',
    });
    assert.equal(new Set(session.detections.map((d) => d.id)).size, 2);
    const again = createReviewSession({
      originalText: 'AB CD AB',
      detections: [{ ...base, start: 0, end: 2 }, { ...base, start: 6, end: 8 }],
      sessionId: 'dup',
    });
    assert.deepEqual(session.detections.map((d) => d.id), again.detections.map((d) => d.id));
  });
});

// ---------------------------------------------------------------------------
// 9. Deterministic composition of adjacent spans
// ---------------------------------------------------------------------------

describe('deterministic composition', () => {
  test('adjacent spans compose in source-offset order, deterministically', () => {
    const build = () => createReviewSession({
      originalText: 'ABCDE',
      detections: [
        { type: 'A', start: 0, end: 2, original: 'AB', source: 'manual', requiresReview: true },
        { type: 'B', start: 2, end: 4, original: 'CD', source: 'manual', requiresReview: true },
      ],
      sessionId: 'adjacent',
    });
    let session = build();
    session = applyDecision(session, session.detections[0].id, 'modified', { replacement: 'X' });
    session = applyDecision(session, session.detections[1].id, 'modified', { replacement: 'Y' });
    assert.equal(getFinalText(session), 'XYE');
    assert.equal(getPreview(session), 'XYE');
    // Same input and decisions through a different decision order → same output.
    let reversed = build();
    reversed = applyDecision(reversed, reversed.detections[1].id, 'modified', { replacement: 'Y' });
    reversed = applyDecision(reversed, reversed.detections[0].id, 'modified', { replacement: 'X' });
    assert.equal(getFinalText(reversed), 'XYE');
  });
});

// ---------------------------------------------------------------------------
// 10. Error contract
// ---------------------------------------------------------------------------

describe('error contract', () => {
  test('ReviewSessionError is a typed Error with a code', () => {
    const error = new ReviewSessionError('TEST_CODE', 'message');
    assert.ok(error instanceof Error);
    assert.equal(error.name, 'ReviewSessionError');
    assert.equal(error.code, 'TEST_CODE');
    assert.equal(error.message, 'message');
  });
});
