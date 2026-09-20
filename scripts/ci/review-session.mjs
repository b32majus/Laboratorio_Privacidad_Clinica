import { ReviewIncompleteError, ReviewSession } from '../../js/domain/review-session.js';

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function assertEqual(actual, expected, message) {
  if (actual !== expected) {
    throw new Error(`${message}\nExpected: ${JSON.stringify(expected)}\nActual:   ${JSON.stringify(actual)}`);
  }
}

// Fixture uses offsets from the immutable source string.
const original = 'Paciente Juan vive en Madrid. DNI 12345678Z.';
const sourceEntities = [
  {
    type: 'NOMBRE',
    subtype: 'paciente',
    text: 'Juan',
    transformed: 'Paciente 1',
    confidence: 0.95,
    position: { start: 9, end: 13 }
  },
  {
    type: 'UBICACION',
    subtype: 'ciudad',
    text: 'Madrid',
    transformed: 'Ciudad A',
    confidence: 0.9,
    position: { start: 22, end: 28 }
  },
  {
    type: 'IDENTIFICADOR',
    subtype: 'dni',
    text: '12345678Z',
    transformed: '',
    confidence: 1,
    position: { start: 34, end: 43 }
  }
];

const resultFixture = {
  original,
  processed: 'Paciente Paciente 1 vive en Ciudad A. DNI .',
  entities: sourceEntities
};

const session = ReviewSession.fromProcessingResult(resultFixture);

// Contract: construction does not mutate Processor output.
assertEqual(sourceEntities[0].id, undefined, 'ReviewSession must not add IDs to Processor entities');
assertEqual(sourceEntities[0].transformed, 'Paciente 1', 'ReviewSession must not mutate transformations');

const detections = session.getDetections();
assertEqual(detections.length, 3, 'Should preserve all engine detections');
assertEqual(detections[0].id, 'det-0001', 'Should assign stable session IDs');
assertEqual(session.getProgress().pending, 3, 'All required detections start pending');
assertEqual(session.canExport(), false, 'Pending review must block final export');

assertEqual(
  session.getPreviewText(),
  'Paciente Paciente 1 vive en Ciudad A. DNI .',
  'Preview should render current proposals even while pending'
);

let incompleteError = null;
try {
  session.getFinalText();
} catch (error) {
  incompleteError = error;
}
assert(incompleteError instanceof ReviewIncompleteError, 'Final text must throw ReviewIncompleteError');
assertEqual(incompleteError.pendingDetectionIds.length, 3, 'Error should identify pending detections');

// Accept uses engine proposal.
session.accept('det-0001');
assertEqual(session.getDecision('det-0001').status, 'accepted', 'Accept status should be explicit');

// Modify becomes authoritative final replacement.
session.modify('det-0002', 'Zona Centro', 'Generalización manual');
assertEqual(session.getDecision('det-0002').replacement, 'Zona Centro', 'Modify should store replacement');

// Restore reintroduces exact original.
session.restore('det-0003', 'Necesario para circuito interno');
assertEqual(session.getDecision('det-0003').replacement, '12345678Z', 'Restore must use exact source text');

assertEqual(session.getProgress().completed, 3, 'All decisions should be completed');
assertEqual(session.canExport(), true, 'Completed review should permit final output');
assertEqual(
  session.getFinalText(),
  'Paciente Paciente 1 vive en Zona Centro. DNI 12345678Z.',
  'Final output must derive exclusively from review decisions'
);

// Reset returns a decision to pending and blocks export again.
session.resetDecision('det-0002');
assertEqual(session.canExport(), false, 'Resetting a required decision must block export');
session.modify('det-0002', 'Zona Centro');

// Manual detections use original-text offsets, not DOM reconstruction.
const manualOriginal = 'Paciente Ana, 45 años.';
const manualSession = new ReviewSession({
  originalText: manualOriginal,
  detections: [
    {
      type: 'NOMBRE',
      text: 'Ana',
      transformed: 'Paciente 1',
      position: { start: 9, end: 12 }
    }
  ]
});

manualSession.accept('det-0001');
const manualId = manualSession.addManualDetection({
  start: 14,
  end: 21,
  type: 'EDAD',
  replacement: '40-49 años'
});
assertEqual(manualSession.getDetection(manualId).original, '45 años', 'Manual detection must capture source text by offsets');
assertEqual(manualSession.canExport(), false, 'New required manual detection must reopen review');
manualSession.accept(manualId);
assertEqual(
  manualSession.getFinalText(),
  'Paciente Paciente 1, 40-49 años.',
  'Manual detection must participate in final rendering'
);

// Overlaps are rejected rather than producing ambiguous output.
let overlapError = null;
try {
  manualSession.addManualDetection({
    start: 10,
    end: 16,
    type: 'OTROS',
    replacement: '[redacted]'
  });
} catch (error) {
  overlapError = error;
}
assert(overlapError instanceof Error, 'Overlapping manual detections must be rejected');

console.log('OK: review-session contract');
