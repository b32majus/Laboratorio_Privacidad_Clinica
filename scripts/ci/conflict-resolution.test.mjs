// Deterministic oracle for interval-based conflict resolution
// (Work Order T22 #26 WU-C, PERF-004; SPEC_V4_QUALITY_SECURITY_DEPLOY §7
// "Replace per-character overlap tracking only when benchmark/evidence
// justifies the change").
//
// The oracle compares Processor.resolveConflicts against an independent
// REFERENCE implementation of the original per-character semantics and
// proves the interval resolver can disagree with planted broken variants
// (off-by-one adjacency, wrong priority tie-break).

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { pathToFileURL } from 'node:url';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '..', '..');

const { Processor } = await import(
  pathToFileURL(path.join(repoRoot, 'js', 'core', 'processor.js')).href
);

/** Entity factory: minimal valid shape for resolveConflicts. */
function entity(type, subtype, start, end, confidence) {
  return { type, subtype, text: `x`.repeat(end - start), position: { start, end }, confidence };
}

/** Independent REFERENCE resolver: the original per-character semantics. */
function resolveConflictsReference(entities) {
  if (!Array.isArray(entities) || entities.length === 0) return [];
  const validEntities = entities.filter(
    (e) =>
      e && e.position &&
      typeof e.position.start === 'number' &&
      typeof e.position.end === 'number' &&
      e.position.start >= 0 &&
      e.position.end > e.position.start
  );
  const getPriority = (entity) => {
    if (entity.type === 'UBICACION') return 3;
    if (entity.type === 'NOMBRE' && entity.subtype === 'familiar') return 2;
    if (entity.type === 'IDENTIFICADOR') return 2;
    if (entity.type === 'SOSPECHOSO') return 1;
    if (entity.type === 'NOMBRE' && entity.subtype === 'profesional') return 1;
    return 0;
  };
  validEntities.sort((a, b) => {
    const priorityDiff = getPriority(b) - getPriority(a);
    if (priorityDiff !== 0) return priorityDiff;
    if (b.confidence !== a.confidence) return b.confidence - a.confidence;
    return (b.position.end - b.position.start) - (a.position.end - a.position.start);
  });
  const resolved = [];
  const occupied = new Set();
  for (const entity of validEntities) {
    let collision = false;
    for (let i = entity.position.start; i < entity.position.end; i++) {
      if (occupied.has(i)) { collision = true; break; }
    }
    if (!collision) {
      resolved.push(entity);
      for (let i = entity.position.start; i < entity.position.end; i++) occupied.add(i);
    }
  }
  return resolved.sort((a, b) => a.position.start - b.position.start);
}

function key(entity) {
  return `${entity.type}/${entity.subtype}/${entity.position.start}-${entity.position.end}/${entity.confidence}`;
}

function assertSameAsReference(entities, label) {
  const actual = Processor.resolveConflicts([...entities]).map(key);
  const expected = resolveConflictsReference([...entities]).map(key);
  assert.deepEqual(actual, expected, label);
}

test('parity vs per-character reference: disjoint, nested, adjacent and duplicate spans', () => {
  assertSameAsReference([
    entity('NOMBRE', 'paciente', 0, 5, 0.9),
    entity('UBICACION', 'ciudad', 3, 9, 0.85), // overlaps first by priority
    entity('NOMBRE', 'familiar', 8, 12, 0.8), // adjacent to UBICACION end
    entity('IDENTIFICADOR', 'dni', 8, 12, 0.7), // duplicate span, lower priority family
    entity('FECHA', 'fecha_completa', 12, 22, 0.95),
    entity('SOSPECHOSO', 'telefono', 12, 15, 0.5), // nested inside FECHA
  ], 'mixed overlaps resolve identically');
});

test('parity vs per-character reference: adjacency is NOT a collision (half-open intervals)', () => {
  const resolved = Processor.resolveConflicts([
    entity('NOMBRE', 'paciente', 0, 5, 0.9),
    entity('NOMBRE', 'paciente', 5, 10, 0.9),
  ]);
  assert.equal(resolved.length, 2, 'entities touching at the boundary both survive');
});

test('parity vs per-character reference: priority beats confidence and size', () => {
  assertSameAsReference([
    entity('NOMBRE', 'paciente', 0, 30, 0.99), // big + high confidence, low priority
    entity('SOSPECHOSO', 'telefono', 10, 12, 0.5), // small, priority 1
    entity('UBICACION', 'ciudad', 20, 22, 0.5), // priority 3 wins over the big span
  ], 'priority order respected');
});

test('parity vs per-character reference: malformed entities filtered identically', () => {
  assertSameAsReference([
    null,
    { type: 'NOMBRE', position: null },
    { type: 'NOMBRE', position: { start: 5, end: 5 } }, // zero-length
    { type: 'NOMBRE', position: { start: -1, end: 3 } }, // negative start
    { type: 'NOMBRE', subtype: 'paciente', position: { start: 0, end: 4 }, confidence: 0.9 },
  ], 'malformed filtering identical');
});

test('parity vs per-character reference: empty and non-array inputs', () => {
  assert.deepEqual(Processor.resolveConflicts([]), []);
  assert.deepEqual(Processor.resolveConflicts(null), []);
  assert.deepEqual(Processor.resolveConflicts(undefined), []);
  assert.deepEqual(Processor.resolveConflicts('no'), []);
});

test('parity on a deterministic dense fixture (hundreds of overlapping spans)', () => {
  const dense = [];
  let seed = 123456789;
  const rand = () => {
    seed = (seed * 1103515245 + 12345) % 2147483648;
    return seed / 2147483648;
  };
  const types = ['NOMBRE', 'UBICACION', 'IDENTIFICADOR', 'SOSPECHOSO', 'FECHA'];
  const subtypes = ['paciente', 'ciudad', 'dni', 'telefono', 'fecha_completa'];
  for (let i = 0; i < 400; i += 1) {
    const start = Math.floor(rand() * 500);
    const end = start + 1 + Math.floor(rand() * 30);
    const typeIndex = Math.floor(rand() * types.length);
    dense.push(entity(types[typeIndex], subtypes[typeIndex], start, end, rand()));
  }
  assertSameAsReference(dense, 'dense randomized fixture resolves identically');
});

test('PLANTED VIOLATION: a resolver treating adjacency as collision is rejected', () => {
  // Broken variant: inclusive end comparison (end >= next start).
  const brokenAdjacency = (entities) => {
    const resolved = [];
    const accepted = [];
    const sorted = [...entities].sort((a, b) => b.position.start - a.position.start);
    for (const e of sorted) {
      const collides = accepted.some(
        (interval) => interval.start <= e.position.end && e.position.start <= interval.end
      );
      if (!collides) {
        resolved.push(e);
        accepted.push({ start: e.position.start, end: e.position.end });
      }
    }
    return resolved.length;
  };
  const pair = [entity('NOMBRE', 'paciente', 0, 5, 0.9), entity('NOMBRE', 'paciente', 5, 10, 0.9)];
  assert.equal(brokenAdjacency(pair), 1, 'broken resolver drops the adjacent entity');
  assert.equal(Processor.resolveConflicts(pair).length, 2, 'the shipped resolver keeps both');
});

test('PLANTED VIOLATION: a resolver ignoring type priority is rejected', () => {
  const brokenPriority = (entities) => {
    const sorted = [...entities].sort((a, b) => b.confidence - a.confidence);
    return sorted[0].type;
  };
  const pair = [entity('NOMBRE', 'paciente', 0, 30, 0.99), entity('UBICACION', 'ciudad', 20, 22, 0.5)];
  assert.equal(brokenPriority(pair), 'NOMBRE', 'broken resolver picks by confidence only');
  assert.equal(Processor.resolveConflicts(pair)[0].type, 'UBICACION', 'the shipped resolver respects priority');
});
