#!/usr/bin/env node
// Repeatable engine performance benchmark (Work Order T22 #26, SPEC_V4_
// QUALITY_SECURITY_DEPLOY §8) for the privacy detection engine that the V4
// adapter composes (js/modular-processor.js PrivacyProcessor — the same core
// registry-engine wraps).
//
// Scenarios (SPEC §8):
//   - text sizes: 10 KB, 100 KB, 500 KB, 1 MB (supported maximum);
//   - document jobs: 1 / 10 / 50 documents (batch shape).
//
// Measurements: wall time per scenario (median of repeated runs after one
// warm-up run), plus detection counts per entity type so a benchmark run also
// proves the optimization did not silently reduce detection coverage (SPEC §8
// "No optimization may silently reduce detection coverage").
//
// Determinism: the corpus is a pure function of fixed seeds (no timestamps in
// inputs); timings are machine-dependent by nature and are recorded, never
// gated. The `--check` gate compares a report against a baseline report and
// fails on ANY detection-coverage difference and on wall-time regressions
// beyond a wide multiple (default 5x) so CI stays deterministic.
//
// Exit codes: 0 = ok, 1 = failure (fail-closed).
//
// Usage:
//   node scripts/benchmarks/engine-bench.mjs                     # run, print JSON
//   node scripts/benchmarks/engine-bench.mjs --report=<path>     # also write JSON
//   node scripts/benchmarks/engine-bench.mjs --baseline=<path> --check
//   node scripts/benchmarks/engine-bench.mjs --self-test
//   node scripts/benchmarks/engine-bench.mjs --quick             # 10KB + 1-doc only

import fs from 'node:fs';
import { pathToFileURL } from 'node:url';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '..', '..');

import { DOC_JOB_TIERS, ENGINE_REVISION_HINT, REPORT_SCHEMA, SIZE_TIERS, generateSyntheticDocument } from './lib/corpus.mjs';

const DEFAULT_REPS = 3;
const DEFAULT_TIME_REGRESSION_FACTOR = 5;
const DOC_JOB_SEED_BASE = 910_000;
const SIZE_TIER_SEED_BASE = 470_000;

function fail(message) {
  process.stderr.write(`engine-bench: ${message}\n`);
  process.exit(1);
}

function parseArgs(argv) {
  const options = {
    report: null,
    baseline: null,
    check: false,
    'self-test': false,
    quick: false,
    reps: DEFAULT_REPS,
  };
  for (const arg of argv) {
    if (arg === '--check') options.check = true;
    else if (arg === '--self-test') options['self-test'] = true;
    else if (arg === '--quick') options.quick = true;
    else if (arg === '--report' || arg === '--baseline' || arg === '--reps') {
      fail(`argument ${arg} requires a value (--${arg.slice(2)}=<value>)`);
    } else {
      const match = arg.match(/^--([a-z-]+)=(.+)$/);
      if (!match || !(match[1] in options)) fail(`unknown or malformed argument: ${arg}`);
      options[match[1]] = match[1] === 'reps' ? Number(match[2]) : match[2];
    }
  }
  if (options.reps !== undefined && (!Number.isInteger(options.reps) || options.reps < 1)) {
    fail('--reps must be a positive integer');
  }
  return options;
}

async function loadEngine() {
  const engineUrl = pathToFileURL(path.join(repoRoot, 'js', 'modular-processor.js')).href;
  try {
    return await import(engineUrl);
  } catch (error) {
    fail(`cannot load privacy engine from js/modular-processor.js: ${error.message}`);
  }
}

/**
 * Resolve the benchmark target: the legacy simplified API object
 * (`PrivacyProcessor.process`, same core the V4 registry engine composes).
 */
function resolveProcessor(engineModule) {
  const api = engineModule.PrivacyProcessor;
  if (api && typeof api.process === 'function') return api;
  const Processor = engineModule.Processor;
  if (Processor && typeof Processor.process === 'function') return Processor;
  fail('no processable processor found in js/modular-processor.js (PrivacyProcessor.process / Processor.process)');
}

function countByType(entities) {
  const counts = {};
  for (const entity of entities) {
    if (!entity || typeof entity.type !== 'string') continue;
    counts[entity.type] = (counts[entity.type] ?? 0) + 1;
  }
  return counts;
}

/** Run the engine once over one document and return {ms, counts}. */
function runOnce(processor, text) {
  const started = process.hrtime.bigint();
  const result = processor.process(text);
  const ms = Number(process.hrtime.bigint() - started) / 1e6;
  if (!result || !Array.isArray(result.entities)) {
    fail('engine returned an unexpected result shape (missing entities array)');
  }
  return { ms, counts: countByType(result.entities) };
}

function median(values) {
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 1 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
}

function sumObjects(objects) {
  const total = {};
  for (const object of objects) {
    for (const [key, value] of Object.entries(object)) {
      total[key] = (total[key] ?? 0) + value;
    }
  }
  return total;
}

function measureSizeTier(processor, tier, reps) {
  const text = generateSyntheticDocument(SIZE_TIER_SEED_BASE, tier.targetSize);
  // One warm-up run (JIT + dictionary setup), then `reps` measured runs.
  runOnce(processor, text);
  const runs = [];
  for (let i = 0; i < reps; i += 1) runs.push(runOnce(processor, text));
  const coverageRuns = runs.map((run) => JSON.stringify(run.counts));
  if (new Set(coverageRuns).size !== 1) {
    fail(`size tier ${tier.name}: detection counts differ between repetitions — the scenario is not deterministic`);
  }
  return {
    scenario: 'text-size',
    name: tier.name,
    targetSizeUnits: tier.targetSize,
    reps,
    wallTimeMsMedian: median(runs.map((run) => run.ms)),
    wallTimeMsAll: runs.map((run) => run.ms),
    detectionCounts: runs[0].counts,
    detectionTotal: Object.values(runs[0].counts).reduce((a, b) => a + b, 0),
  };
}

function measureDocJobTier(processor, tier, reps) {
  const documents = Array.from({ length: tier.documents }, (_, index) =>
    generateSyntheticDocument(DOC_JOB_SEED_BASE + index, tier.docSize)
  );
  const runJob = () => {
    const started = process.hrtime.bigint();
    const counts = [];
    for (const text of documents) counts.push(runOnce(processor, text).counts);
    const ms = Number(process.hrtime.bigint() - started) / 1e6;
    return { ms, counts: sumObjects(counts) };
  };
  runJob();
  const runs = [];
  for (let i = 0; i < reps; i += 1) runs.push(runJob());
  const coverageRuns = runs.map((run) => JSON.stringify(run.counts));
  if (new Set(coverageRuns).size !== 1) {
    fail(`document tier ${tier.name}: detection counts differ between repetitions — the scenario is not deterministic`);
  }
  return {
    scenario: 'document-job',
    name: tier.name,
    documents: tier.documents,
    docSizeUnits: tier.docSize,
    reps,
    wallTimeMsMedian: median(runs.map((run) => run.ms)),
    wallTimeMsAll: runs.map((run) => run.ms),
    detectionCounts: runs[0].counts,
    detectionTotal: Object.values(runs[0].counts).reduce((a, b) => a + b, 0),
  };
}

async function runBenchmark(options) {
  const engineModule = await loadEngine();
  const processor = resolveProcessor(engineModule);

  const sizeTiers = options.quick ? SIZE_TIERS.slice(0, 1) : SIZE_TIERS;
  const docTiers = options.quick ? DOC_JOB_TIERS.slice(0, 1) : DOC_JOB_TIERS;
  const scenarios = [
    ...sizeTiers.map((tier) => measureSizeTier(processor, tier, options.reps)),
    ...docTiers.map((tier) => measureDocJobTier(processor, tier, options.reps)),
  ];
  return {
    schema: REPORT_SCHEMA,
    engine: ENGINE_REVISION_HINT,
    reps: options.reps,
    quick: options.quick === true,
    scenarios,
  };
}

function compareWithBaseline(report, baseline, timeFactor) {
  const failures = [];
  if (baseline.schema !== REPORT_SCHEMA) {
    failures.push(`baseline schema ${baseline.schema} != ${REPORT_SCHEMA}`);
  }
  const baselineByFullName = new Map(
    baseline.scenarios.map((scenario) => [`${scenario.scenario}:${scenario.name}`, scenario])
  );
  for (const scenario of report.scenarios) {
    const key = `${scenario.scenario}:${scenario.name}`;
    const base = baselineByFullName.get(key);
    if (!base) {
      failures.push(`baseline has no scenario for report entry: ${key}`);
      continue;
    }
    if (JSON.stringify(base.detectionCounts) !== JSON.stringify(scenario.detectionCounts)) {
      failures.push(
        `detection coverage changed for ${key}: baseline ${JSON.stringify(base.detectionCounts)} vs current ${JSON.stringify(scenario.detectionCounts)}`
      );
    }
    if (
      scenario.scenario === 'document-job' &&
      base.documents !== scenario.documents
    ) {
      failures.push(`document count changed for ${key}`);
    }
    const ratio = scenario.wallTimeMsMedian / base.wallTimeMsMedian;
    if (ratio > timeFactor) {
      failures.push(
        `wall time regression for ${key}: ${scenario.wallTimeMsMedian.toFixed(1)}ms vs baseline ${base.wallTimeMsMedian.toFixed(1)}ms (> ${timeFactor}x)`
      );
    }
  }
  for (const [key] of baselineByFullName) {
    if (!report.scenarios.some((scenario) => `${scenario.scenario}:${scenario.name}` === key)) {
      failures.push(`missing scenario required by baseline: ${key}`);
    }
  }
  return failures;
}

function selfTest() {
  const results = [];
  const assert = (condition, message) => {
    if (!condition) fail(`self-test failed: ${message}`);
    results.push(message);
  };

  // 1. Known-good: corpus generator determinism (same seed → same bytes).
  const a = generateSyntheticDocument(42, 2048);
  const b = generateSyntheticDocument(42, 2048);
  assert(a === b, 'same seed and size produce byte-identical synthetic text');
  assert(a.length === 2048, 'generated document has the exact requested size');
  const c = generateSyntheticDocument(43, 2048);
  assert(a !== c, 'different seed produces different synthetic text');

  // 2. Known-good: the generated CORPUS contains recognisable name patterns.
  // This check validates corpus content only — it never runs the engine. The
  // engine itself is exercised by the real benchmark scenarios (which fail
  // closed on an unloadable engine or an unexpected result shape) and by the
  // CI smoke/ground-truth gates in the npm test chain.
  const clinical = generateSyntheticDocument(470_000, 10 * 1024);
  const withEntities = [...NOMBRES_SAMPLE].some((name) => clinical.includes(name));
  assert(withEntities, 'synthetic corpus contains recognisable name patterns');

  // 3. Planted violation: a report whose detection coverage differs from the
  // baseline MUST fail the check (the gate can disagree).
  const goodReport = {
    schema: REPORT_SCHEMA,
    scenarios: [
      {
        scenario: 'text-size',
        name: '10KB',
        wallTimeMsMedian: 10,
        detectionCounts: { NOMBRE: 5 },
        documents: undefined,
      },
    ],
  };
  const plantedViolation = {
    schema: REPORT_SCHEMA,
    scenarios: [
      {
        scenario: 'text-size',
        name: '10KB',
        wallTimeMsMedian: 10,
        detectionCounts: { NOMBRE: 3 },
        documents: undefined,
      },
    ],
  };
  const plantedFailures = compareWithBaseline(plantedViolation, goodReport, DEFAULT_TIME_REGRESSION_FACTOR);
  assert(
    plantedFailures.length === 1 && plantedFailures[0].includes('detection coverage changed'),
    'planted coverage regression is rejected by the check gate'
  );
  const cleanFailures = compareWithBaseline(goodReport, goodReport, DEFAULT_TIME_REGRESSION_FACTOR);
  assert(cleanFailures.length === 0, 'identical reports pass the check gate');

  // 4. Planted violation: a report missing a baseline-required scenario fails.
  const missingScenario = { schema: REPORT_SCHEMA, scenarios: [] };
  const missingFailures = compareWithBaseline(missingScenario, goodReport, DEFAULT_TIME_REGRESSION_FACTOR);
  assert(
    missingFailures.some((entry) => entry.includes('missing scenario required by baseline')),
    'missing baseline-required scenario is rejected by the check gate'
  );

  process.stdout.write(`engine-bench self-test: ${results.length} checks passed\n`);
}

const NOMBRES_SAMPLE = ['María', 'Pedro', 'Lucía'];

async function main() {
  const options = parseArgs(process.argv.slice(2));
if (options['self-test']) {
  selfTest();
  process.exit(0);
}

const report = await runBenchmark(options);
const json = JSON.stringify(report, null, 2);

if (options.check) {
  if (!options.baseline) fail('--check requires --baseline=<path>');
  let baseline;
  try {
    baseline = JSON.parse(fs.readFileSync(options.baseline, 'utf8'));
  } catch (error) {
    fail(`cannot read baseline report: ${error.message}`);
  }
  const failures = compareWithBaseline(report, baseline, DEFAULT_TIME_REGRESSION_FACTOR);
  if (failures.length > 0) {
    process.stderr.write(`engine-bench: check failed against ${options.baseline}:\n`);
    for (const entry of failures) process.stderr.write(`  - ${entry}\n`);
    process.exit(1);
  }
  process.stdout.write(`engine-bench: check passed against ${options.baseline}\n`);
} else {
  process.stdout.write(json);
  process.stdout.write('\n');
}

if (options.report) {
    const resolved = path.resolve(repoRoot, options.report);
    fs.mkdirSync(path.dirname(resolved), { recursive: true });
    fs.writeFileSync(resolved, `${json}\n`);
    process.stdout.write(`engine-bench: report written to ${options.report}\n`);
  }
}

main();
