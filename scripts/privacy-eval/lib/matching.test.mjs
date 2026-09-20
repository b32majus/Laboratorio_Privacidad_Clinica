// Unit tests for the privacy-eval matching logic (node --test).
import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  assignDetections,
  normalizeText,
  occursInText,
  textMatches
} from './matching.mjs';

test('normalizeText strips diacritics, casefolds and collapses whitespace', () => {
  assert.equal(normalizeText('  María   del  CARMEN\nLópez '), 'maria del carmen lopez');
  assert.equal(normalizeText('SÍNDROME de Wolfram'), 'sindrome de wolfram');
});

test('textMatches accepts exact, contained and superstring matches', () => {
  assert.equal(textMatches('Eduardo García', 'Eduardo García'), true);
  assert.equal(textMatches('Juan Martínez Sánchez', 'Dr. Juan Martínez Sánchez'), true);
  assert.equal(textMatches('+34 654 321 987', '654 321 987'), true);
  assert.equal(textMatches('María del Carmen López', 'Dra. Patricia Ruiz'), false);
  assert.equal(textMatches('', 'anything'), false);
  assert.equal(textMatches('anything', ''), false);
});

test('occursInText requires the annotation value to be locatable in the case text', () => {
  const text = 'DNI 30970148B emitido en 2019.';
  assert.equal(occursInText(text, '30970148B'), true);
  assert.equal(occursInText(text, 'dni 30970148b'), true);
  assert.equal(occursInText(text, 'X-9442329-Z'), false);
});

test('assignDetections: entity detection satisfies MUST_REMOVE', () => {
  const annotations = [{ label: 'MUST_REMOVE', entity_type: 'IDENTIFICADOR', value: '30970148B' }];
  const result = assignDetections(
    annotations,
    [{ text: '30970148B', type: 'IDENTIFICADOR' }],
    []
  );
  assert.equal(result.matched.length, 1);
  assert.equal(result.matched[0].via, 'detection');
  assert.equal(result.missed.length, 0);
  assert.equal(result.false_positives.length, 0);
});

test('assignDetections: containment match consumes the longest detection first-in-order', () => {
  const annotations = [{ label: 'MUST_REMOVE', entity_type: 'NOMBRE', value: 'Juan Martínez Sánchez' }];
  const result = assignDetections(
    annotations,
    [{ text: 'Dr. Juan Martínez Sánchez', type: 'NOMBRE' }],
    []
  );
  assert.equal(result.matched.length, 1);
  assert.equal(result.false_positives.length, 0);
});

test('assignDetections: MUST_FLAG_FOR_REVIEW satisfied by low-confidence flagged surface (D-008)', () => {
  const annotations = [{ label: 'MUST_FLAG_FOR_REVIEW', entity_type: 'SOSPECHOSO', value: 'Maestra de educación primaria' }];
  const result = assignDetections(
    annotations,
    [],
    [{ text: 'Maestra de educación primaria', type: 'SOSPECHOSO' }]
  );
  assert.equal(result.matched.length, 1);
  assert.equal(result.matched[0].via, 'flagged');
  assert.equal(result.missed.length, 0);
});

test('assignDetections: MUST_REMOVE only flagged is missed and reported in flagged_only', () => {
  const annotations = [{ label: 'MUST_REMOVE', entity_type: 'IDENTIFICADOR', value: 'X-7442329-Z' }];
  const result = assignDetections(
    annotations,
    [],
    [{ text: 'X-7442329-Z', type: 'IDENTIFICADOR' }]
  );
  assert.equal(result.matched.length, 0);
  assert.equal(result.missed.length, 1);
  assert.equal(result.flagged_only.length, 1);
});

test('assignDetections: undetected positive annotation is missed', () => {
  const annotations = [{ label: 'MUST_REMOVE', entity_type: 'IDENTIFICADOR', value: 'ES12 1234 5678 9012 3456 7890' }];
  const result = assignDetections(annotations, [], []);
  assert.equal(result.missed.length, 1);
  assert.equal(result.flagged_only.length, 0);
});

test('assignDetections: detection over MUST_KEEP value is a keep violation', () => {
  const annotations = [{ label: 'MUST_KEEP', entity_type: 'IDENTIFICADOR', value: 'Metformina 850mg/12h' }];
  const result = assignDetections(
    annotations,
    [{ text: 'Metformina 850mg/12h', type: 'IDENTIFICADOR' }],
    []
  );
  assert.equal(result.false_positives.length, 1);
  assert.equal(result.false_positives[0].reason, 'must_keep_violation');
});

test('assignDetections: unmatched detection is an unexpected_detection false positive', () => {
  const annotations = [];
  const result = assignDetections(
    annotations,
    [{ text: '130/85', type: 'IDENTIFICADOR' }],
    []
  );
  assert.equal(result.false_positives.length, 1);
  assert.equal(result.false_positives[0].reason, 'unexpected_detection');
});

test('assignDetections: unmatched flagged item is surfaced but not a false positive', () => {
  const result = assignDetections(
    [],
    [],
    [{ text: 'fontanero', type: 'SOSPECHOSO' }]
  );
  assert.equal(result.unmatched_flagged.length, 1);
  assert.equal(result.false_positives.length, 0);
});

test('assignDetections: type mismatch never matches across entity types', () => {
  const annotations = [{ label: 'MUST_REMOVE', entity_type: 'FECHA', value: '12/07/1965' }];
  const result = assignDetections(
    annotations,
    [{ text: '12/07/1965', type: 'IDENTIFICADOR' }],
    []
  );
  assert.equal(result.missed.length, 1);
  assert.equal(result.false_positives.length, 1);
});

test('assignDetections: each annotation and detection is consumed at most once', () => {
  const annotations = [
    { label: 'MUST_REMOVE', entity_type: 'UBICACION', value: 'Teruel' },
    { label: 'MUST_REMOVE', entity_type: 'UBICACION', value: 'Plaza del Ayuntamiento 1, Albarracín, Teruel' }
  ];
  const result = assignDetections(
    annotations,
    [
      { text: 'Teruel', type: 'UBICACION' },
      { text: 'Albarracín', type: 'UBICACION' },
      { text: 'Plaza del Ayuntamiento 1, Albarracín, Teruel', type: 'UBICACION' }
    ],
    []
  );
  assert.equal(result.matched.length, 2);
  assert.equal(result.missed.length, 0);
  // 'Albarracín' detection matches no annotation: false positive.
  assert.equal(result.false_positives.length, 1);
  assert.equal(result.false_positives[0].detection.text, 'Albarracín');
});
