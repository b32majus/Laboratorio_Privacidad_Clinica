// Pure metric aggregation and threshold gating for the privacy harness (T02).

/**
 * Computes precision/recall/FNR from raw counts.
 * Conventions when a denominator is zero:
 * - precision: no predictions at all -> 1 (vacuously precise);
 * - recall: no positives expected -> 1;
 * - FNR: no positives expected -> 0.
 * @param {{tp: number, fn: number, fp: number}} counts
 * @returns {{tp: number, fn: number, fp: number, precision: number, recall: number, false_negative_rate: number}}
 */
export function computeMetrics(counts) {
  const { tp, fn, fp } = counts;
  const precision = tp + fp > 0 ? tp / (tp + fp) : 1;
  const recall = tp + fn > 0 ? tp / (tp + fn) : 1;
  const falseNegativeRate = tp + fn > 0 ? fn / (tp + fn) : 0;
  return {
    tp,
    fn,
    fp,
    precision,
    recall,
    false_negative_rate: falseNegativeRate
  };
}

/**
 * Aggregates per-type confusion counts into overall and per-entity-type metrics.
 * TP/FN are attributed by annotation entity_type; FP by detection type.
 * @param {Array<{type: string, tp: number, fn: number, fp: number}>} entries
 * @returns {{overall: object, per_type: Record<string, object>}}
 */
export function aggregateMetrics(entries) {
  const perTypeCounts = new Map();
  let tp = 0;
  let fn = 0;
  let fp = 0;

  for (const entry of entries) {
    tp += entry.tp;
    fn += entry.fn;
    fp += entry.fp;
    const current = perTypeCounts.get(entry.type) || { tp: 0, fn: 0, fp: 0 };
    current.tp += entry.tp;
    current.fn += entry.fn;
    current.fp += entry.fp;
    perTypeCounts.set(entry.type, current);
  }

  const per_type = {};
  for (const type of [...perTypeCounts.keys()].sort()) {
    per_type[type] = computeMetrics(perTypeCounts.get(type));
  }

  return { overall: computeMetrics({ tp, fn, fp }), per_type };
}

const EPSILON = 1e-9;

/**
 * Evaluates configured regression thresholds against computed metrics.
 * @param {{
 *   overall: {min_precision: number, min_recall: number, max_fnr: number},
 *   per_type: Record<string, {min_precision: number, min_recall: number, max_fnr: number}>
 * }} gateConfig
 * @param {{overall: object, per_type: Record<string, object>}} metrics
 * @returns {{pass: boolean, failures: Array<{scope: string, metric: string, value: number, threshold: number}>}}
 */
export function evaluateThresholds(gateConfig, metrics) {
  const failures = [];

  const check = (scope, thresholds, actual) => {
    if (actual.precision < thresholds.min_precision - EPSILON) {
      failures.push({ scope, metric: 'precision', value: actual.precision, threshold: thresholds.min_precision });
    }
    if (actual.recall < thresholds.min_recall - EPSILON) {
      failures.push({ scope, metric: 'recall', value: actual.recall, threshold: thresholds.min_recall });
    }
    if (actual.false_negative_rate > thresholds.max_fnr + EPSILON) {
      failures.push({ scope, metric: 'false_negative_rate', value: actual.false_negative_rate, threshold: thresholds.max_fnr });
    }
  };

  check('overall', gateConfig.overall, metrics.overall);
  for (const type of Object.keys(gateConfig.per_type).sort()) {
    const actual = metrics.per_type[type];
    if (!actual) {
      failures.push({ scope: type, metric: 'coverage', value: null, threshold: 'type absent from gated corpus metrics' });
      continue;
    }
    check(type, gateConfig.per_type[type], actual);
  }

  return { pass: failures.length === 0, failures };
}
