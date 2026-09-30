// Deterministic oracle for the precomputed normalized dictionary indexes
// (Work Order T22 #26 WU-B, PERF-003).
//
// The index must be a pure memoization:
//   - same dictionaries + same normalizer → identical membership answers;
//   - dictionary RELOAD (Processor.loadDictionaries replaces array
//     references) must NOT serve a stale index — the exceptional branch
//     (cache invalidation) executes here, not just in production hope;
//   - a semantically equivalent but different-identity normalizer reuses
//     the index (probe equivalence), a semantically different one rebuilds.

import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  buildDictionaryIndex,
  getCachedDictionaryIndex,
  getCachedNormalizedEntries,
} from '../../js/core/utils/DictionaryIndex.js';
import { detectPacientes } from '../../js/core/detectors/nombres.js';
import { detectUbicaciones } from '../../js/core/detectors/ubicaciones.js';

const normalize = (text) =>
  String(text ?? '')
    .split('')
    .map((char) =>
      ({ 'á': 'a', 'é': 'e', 'í': 'i', 'ó': 'o', 'ú': 'u', 'Á': 'A', 'É': 'E', 'Í': 'I', 'Ó': 'O', 'Ú': 'U', 'ñ': 'n', 'Ñ': 'N', 'ü': 'u', 'Ü': 'U' }[char] ?? char)
    )
    .join('')
    .toLowerCase();

test('buildDictionaryIndex normalizes every entry of the requested keys', () => {
  const dictionaries = {
    nombresMujer: ['María', 'Lucía'],
    nombresHombre: ['Álvaro'],
    apellidos: ['García'],
    ciudades: ['Madrid'], // not part of the index
  };
  const index = buildDictionaryIndex(dictionaries, normalize, ['nombresMujer', 'nombresHombre', 'apellidos']);
  assert.equal(index.size, 4);
  for (const word of ['maria', 'lucia', 'alvaro', 'garcia']) {
    assert.ok(index.has(word), `index contains ${word}`);
  }
  assert.ok(!index.has('madrid'));
  // Original dictionaries are never mutated by index construction.
  assert.deepEqual(dictionaries.nombresMujer, ['María', 'Lucía']);
});

test('cached index reuses the same Set across calls (precomputation, not rebuild)', () => {
  const dictionaries = { nombresMujer: ['María'], nombresHombre: [], apellidos: ['López'] };
  const first = getCachedDictionaryIndex(dictionaries, normalize, ['nombresMujer', 'nombresHombre', 'apellidos']);
  const second = getCachedDictionaryIndex(dictionaries, normalize, ['nombresMuthers'.replace('Muthers', 'Mujer'), 'nombresHombre', 'apellidos']);
  assert.equal(first, second, 'same sources return the SAME cached Set instance');
});

test('PLANTED VIOLATION: a stale index after dictionary reload is rejected (invalidation branch)', () => {
  const dictionaries = { nombresMujer: ['María'], nombresHombre: [], apellidos: [] };
  const before = getCachedDictionaryIndex(dictionaries, normalize, ['nombresMujer', 'nombresHombre', 'apellidos']);
  assert.ok(before.has('maria'));
  assert.ok(!before.has('nergis'));

  // Reload replaces the array reference (Processor.loadDictionaries shape).
  const reloaded = { ...dictionaries, nombresMujer: ['Nergis'] };
  for (const key of Object.keys(dictionaries)) reloaded[key] = reloaded[key];
  dictionaries.nombresMujer = ['Nergis'];

  const after = getCachedDictionaryIndex(dictionaries, normalize, ['nombresMujer', 'nombresHombre', 'apellidos']);
  assert.ok(!after.has('maria'), 'old entry must disappear after reload');
  assert.ok(after.has('nergis'), 'new entry must appear after reload');
  assert.notEqual(before, after, 'reloaded dictionaries must not reuse the previous Set');
});

test('normalizer equivalence probe: bound-equal normalizer reuses, different semantics rebuilds', () => {
  const dictionaries = { nombresMujer: ['María'], nombresHombre: [], apellidos: [] };
  const keys = ['nombresMujer', 'nombresHombre', 'apellidos'];
  const boundOnce = normalize;
  const first = getCachedDictionaryIndex(dictionaries, boundOnce, keys);
  const rebound = (text) => normalize(text); // new identity, same semantics
  const reused = getCachedDictionaryIndex(dictionaries, rebound, keys);
  assert.equal(reused, first, 'semantically equivalent normalizer reuses the SAME cached Set');

  const noCase = (text) => normalize(text).toUpperCase(); // different semantics
  const rebuilt = getCachedDictionaryIndex(dictionaries, noCase, keys);
  assert.notEqual(rebuilt, first);
  assert.ok(rebuilt.has('MARIA'), 'rebuilt index follows the new normalizer (no accents, uppercase)');
});

test('detector parity: paciente detection answers are identical through the cached index', () => {
  const dictionaries = {
    nombresMujer: ['María', 'Lucía'],
    nombresHombre: ['Pedro'],
    apellidos: ['García', 'López'],
  };
  const text = 'La paciente María García fue atendida por Pedro López y su hermana Lucía García.';
  const first = detectPacientes(text, { ...dictionaries }, normalize);
  const second = detectPacientes(text, { ...dictionaries }, normalize);
  assert.deepEqual(
    first.map((entity) => [entity.type, entity.subtype, entity.position.start, entity.position.end]),
    second.map((entity) => [entity.type, entity.subtype, entity.position.start, entity.position.end])
  );
  assert.ok(first.length > 0, 'fixture produces patient candidates');
});

test('location detection: normalized-form branch executes through the precomputed map', () => {
  const ciudades = ['Málaga', 'Córdoba'];
  const text = 'El paciente reside en Malaga y trabajo antes en Cordoba.';
  const first = detectUbicaciones(text, { ciudades }, normalize);
  const second = detectUbicaciones(text, { ciudades }, normalize);
  const normalizedHits = first.filter((entity) => entity.confidence === 0.85);
  assert.ok(normalizedHits.length >= 1, 'accent-less city forms are detected via the precomputed normalized map');
  assert.deepEqual(
    first.map((entity) => [entity.subtype, entity.position.start, entity.position.end]),
    second.map((entity) => [entity.subtype, entity.position.start, entity.position.end])
  );
});

test('location detection: reloaded city dictionary invalidates the normalized-entry map', () => {
  let ciudades = ['Madrid'];
  const text = 'Reside en Toledo.';
  const before = detectUbicaciones(text, { ciudades }, normalize);
  assert.ok(
    before.every((entity) => !(entity.subtype === 'ciudad' && entity.text === 'Toledo')),
    'Toledo not detected as ciudad before reload'
  );
  ciudades = ['Toledo'];
  const after = detectUbicaciones(text, { ciudades }, normalize);
  assert.ok(
    after.some((entity) => entity.subtype === 'ciudad' && entity.text === 'Toledo'),
    'Toledo detected as ciudad after reload (no stale map)'
  );
});

test('fail-closed: invalid arguments return null instead of guessing', () => {
  assert.equal(getCachedDictionaryIndex(null, normalize, ['nombresMujer']), null);
  assert.equal(getCachedDictionaryIndex({}, null, ['nombresMujer']), null);
  assert.equal(getCachedNormalizedEntries(null, normalize), null);
  assert.equal(getCachedNormalizedEntries(['Madrid'], null), null);
});
