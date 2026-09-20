// Unit tests for the privacy-eval metrics/gating logic (node --test).
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { aggregateMetrics, computeMetrics, evaluateThresholds } from './metrics.mjs';

test('computeMetrics: standard counts', () => {
  const m = computeMetrics({ tp: 8, fn: 2, fp: 1 });
  assert.equal(m.precision, 8 / 9);
  assert.equal(m.recall, 8 / 10);
  assert.equal(m.false_negative_rate, 2 / 10);
});

test('computeMetrics: zero-positive convention (recall 1, FNR 0)', () => {
  const m = computeMetrics({ tp: 0, fn: 0, fp: 3 });
  assert.equal(m.precision, 0);
  assert.equal(m.recall, 1);
  assert.equal(m.false_negative_rate, 0);
});

test('computeMetrics: no predictions at all is vacuously precise', () => {
  const m = computeMetrics({ tp: 0, fn: 0, fp: 0 });
  assert.equal(m.precision, 1);
  assert.equal(m.recall, 1);
  assert.equal(m.false_negative_rate, 0);
});

test('aggregateMetrics: splits per type and sums overall', () => {
  const { overall, per_type } = aggregateMetrics([
    { type: 'NOMBRE', tp: 2, fn: 0, fp: 0 },
    { type: 'NOMBRE', tp: 1, fn: 1, fp: 0 },
    { type: 'FECHA', tp: 3, fn: 0, fp: 1 }
  ]);
  assert.equal(overall.tp, 6);
  assert.equal(overall.fn, 1);
  assert.equal(overall.fp, 1);
  assert.deepEqual(Object.keys(per_type).sort(), ['FECHA', 'NOMBRE']);
  assert.equal(per_type.FECHA.fp, 1);
  assert.equal(per_type.NOMBRE.fn, 1);
});

test('evaluateThresholds: passing baseline', () => {
  const gate = {
    overall: { min_precision: 1, min_recall: 1, max_fnr: 0 },
    per_type: { NOMBRE: { min_precision: 1, min_recall: 1, max_fnr: 0 } }
  };
  const metrics = {
    overall: { precision: 1, recall: 1, false_negative_rate: 0 },
    per_type: { NOMBRE: { precision: 1, recall: 1, false_negative_rate: 0 } }
  };
  const result = evaluateThresholds(gate, metrics);
  assert.equal(result.pass, true);
  assert.equal(result.failures.length, 0);
});

test('evaluateThresholds: detects regression below threshold', () => {
  const gate = {
    overall: { min_precision: 1, min_recall: 1, max_fnr: 0 },
    per_type: {
      NOMBRE: { min_precision: 1, min_recall: 1, max_fnr: 0 },
      FECHA: { min_precision: 1, min_recall: 1, max_fnr: 0 }
    }
  };
  const metrics = {
    overall: { precision: 0.95, recall: 1, false_negative_rate: 0 },
    per_type: {
      NOMBRE: { precision: 1, recall: 0.5, false_negative_rate: 0.5 },
      FECHA: { precision: 1, recall: 1, false_negative_rate: 0 }
    }
  };
  const result = evaluateThresholds(gate, metrics);
  assert.equal(result.pass, false);
  const scopes = result.failures.map((f) => `${f.scope}:${f.metric}`).sort();
  assert.deepEqual(scopes, ['NOMBRE:false_negative_rate', 'NOMBRE:recall', 'overall:precision']);
});

test('evaluateThresholds: gated type absent from metrics is a failure', () => {
  const gate = {
    overall: { min_precision: 1, min_recall: 1, max_fnr: 0 },
    per_type: { SOSPECHOSO: { min_precision: 1, min_recall: 1, max_fnr: 0 } }
  };
  const metrics = {
    overall: { precision: 1, recall: 1, false_negative_rate: 0 },
    per_type: {}
  };
  const result = evaluateThresholds(gate, metrics);
  assert.equal(result.pass, false);
  assert.equal(result.failures[0].scope, 'SOSPECHOSO');
});

test('evaluateThresholds: tiny floating point drift does not fail the gate', () => {
  const gate = {
    overall: { min_precision: 1, min_recall: 1, max_fnr: 0 },
    per_type: {}
  };
  const metrics = {
    overall: { precision: 1 - 1e-12, recall: 1, false_negative_rate: 1e-12 },
    per_type: {}
  };
  const result = evaluateThresholds(gate, metrics);
  assert.equal(result.pass, true);
});
