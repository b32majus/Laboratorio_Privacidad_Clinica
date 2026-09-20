#!/usr/bin/env node
// Ground-truth privacy regression evaluator (Work Order V4/T02, issue #6).
//
// Runs the existing privacy detection engine over a versioned synthetic
// annotated corpus and reports precision, recall and false-negative rate,
// overall and per entity type. Expectations live ONLY in corpus annotations;
// the evaluator never derives expectations from engine output.
//
// Determinism contract:
// - no timestamps, session ids or random values in the report;
// - no network access;
// - same corpus + same engine revision -> byte-identical report.
//
// Exit codes: 0 = gate pass, 1 = gate fail or invalid corpus/config (fail-closed).

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { assignDetections, occursInText } from './lib/matching.mjs';
import { aggregateMetrics, evaluateThresholds } from './lib/metrics.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '..', '..');

const SCHEMA_VERSION = 1;
const LABELS = ['MUST_REMOVE', 'MUST_KEEP', 'MUST_FLAG_FOR_REVIEW'];
// Entity taxonomy of the privacy engine spec (detection categories).
const ENTITY_TYPES = ['NOMBRE', 'IDENTIFICADOR', 'FECHA', 'UBICACION', 'SOSPECHOSO'];
const TIERS = ['core', 'adversarial'];

function fail(message) {
  process.stderr.write(`privacy-eval: ${message}\n`);
  process.exit(1);
}

function parseArgs(argv) {
  const options = {
    'corpus-dir': path.join(__dirname, 'corpus'),
    config: path.join(__dirname, 'config.json'),
    report: null
  };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    const match = arg.match(/^--([a-z-]+)=(.+)$/);
    if (!match || !(match[1] in options)) {
      fail(`unknown or malformed argument: ${arg}`);
    }
    options[match[1]] = match[2];
  }
  return options;
}

function readJson(absolutePath, what) {
  let parsed;
  try {
    parsed = JSON.parse(fs.readFileSync(absolutePath, 'utf8'));
  } catch (error) {
    fail(`cannot read ${what} at ${absolutePath}: ${error.message}`);
  }
  return parsed;
}

function validateManifest(manifest, manifestPath) {
  if (manifest.schema_version !== SCHEMA_VERSION) {
    fail(`manifest schema_version must be ${SCHEMA_VERSION}: ${manifestPath}`);
  }
  if (typeof manifest.corpus_version !== 'string' || manifest.corpus_version.length === 0) {
    fail(`manifest corpus_version must be a non-empty string: ${manifestPath}`);
  }
}

function validateGateConfig(config, configPath) {
  if (config.schema_version !== SCHEMA_VERSION) {
    fail(`config schema_version must be ${SCHEMA_VERSION}: ${configPath}`);
  }
  const gate = config.gate;
  if (!gate || typeof gate !== 'object') {
    fail(`config must define a "gate" object: ${configPath}`);
  }
  const checkThresholds = (scope, thresholds) => {
    if (!thresholds || typeof thresholds !== 'object') {
      fail(`config gate.${scope} must define thresholds: ${configPath}`);
    }
    for (const key of ['min_precision', 'min_recall', 'max_fnr']) {
      if (typeof thresholds[key] !== 'number') {
        fail(`config gate.${scope}.${key} must be a number: ${configPath}`);
      }
    }
  };
  checkThresholds('overall', gate.overall);
  if (!gate.per_type || typeof gate.per_type !== 'object') {
    fail(`config gate.per_type must be an object: ${configPath}`);
  }
  for (const type of Object.keys(gate.per_type)) {
    if (!ENTITY_TYPES.includes(type)) {
      fail(`config gate.per_type references unknown entity type "${type}" (taxonomy: ${ENTITY_TYPES.join(', ')}): ${configPath}`);
    }
    checkThresholds(`per_type.${type}`, gate.per_type[type]);
  }
}

function validateCase(caseData, casePath, corpusVersion, caseIds) {
  const at = (message) => `${message}: ${casePath}`;
  if (caseData.schema_version !== SCHEMA_VERSION) fail(at(`schema_version must be ${SCHEMA_VERSION}`));
  if (caseData.corpus_version !== corpusVersion) {
    fail(at(`corpus_version must match manifest ("${corpusVersion}")`));
  }
  if (typeof caseData.case_id !== 'string' || caseData.case_id.length === 0) fail(at('case_id must be a non-empty string'));
  if (caseIds.has(caseData.case_id)) fail(at(`duplicate case_id "${caseData.case_id}"`));
  if (!TIERS.includes(caseData.tier)) fail(at(`tier must be one of ${TIERS.join(', ')}`));
  if (typeof caseData.text !== 'string' || caseData.text.trim().length === 0) fail(at('text must be a non-empty string'));
  if (!Array.isArray(caseData.annotations)) fail(at('annotations must be an array'));

  caseData.annotations.forEach((annotation, index) => {
    const atAnn = (message) => at(`annotations[${index}] ${message}`);
    if (!LABELS.includes(annotation.label)) fail(atAnn(`label must be one of ${LABELS.join(', ')}`));
    if (!ENTITY_TYPES.includes(annotation.entity_type)) {
      fail(atAnn(`entity_type must be one of ${ENTITY_TYPES.join(', ')}`));
    }
    if (typeof annotation.value !== 'string' || annotation.value.trim().length === 0) {
      fail(atAnn('value must be a non-empty string'));
    }
    // Fail-closed: every annotation must be locatable in the case text, so the
    // corpus can never silently assert expectations about content it does not contain.
    if (!occursInText(caseData.text, annotation.value)) {
      fail(atAnn(`value "${annotation.value}" does not occur in case text`));
    }
  });
}

function evaluateCase(caseData, engine) {
  const result = engine.process(caseData.text);
  const detections = result.entities.map((e) => ({
    text: e.text,
    type: e.type,
    subtype: e.subtype ?? null
  }));
  // Low-confidence items that remain visible for review (decision D-008).
  const flaggedItems = (result.scoring && Array.isArray(result.scoring.descartadas))
    ? result.scoring.descartadas.map((d) => ({ text: d.text, type: d.type }))
    : [];

  const assignment = assignDetections(caseData.annotations, detections, flaggedItems);

  const perTypeCounts = new Map();
  const bump = (type, key) => {
    const current = perTypeCounts.get(type) || { tp: 0, fn: 0, fp: 0 };
    current[key] += 1;
    perTypeCounts.set(type, current);
  };

  for (const { annotation } of assignment.matched) {
    bump(annotation.entity_type, 'tp');
  }
  for (const annotation of assignment.missed) {
    bump(annotation.entity_type, 'fn');
  }
  for (const { detection } of assignment.false_positives) {
    bump(detection.type, 'fp');
  }

  return {
    case_id: caseData.case_id,
    tier: caseData.tier,
    per_type_counts: Object.fromEntries([...perTypeCounts.entries()].sort()),
    matched: assignment.matched.map(({ annotation, via }) => ({
      label: annotation.label,
      entity_type: annotation.entity_type,
      value: annotation.value,
      via
    })),
    missed: assignment.missed.map((a) => ({
      label: a.label,
      entity_type: a.entity_type,
      value: a.value
    })),
    flagged_only: assignment.flagged_only.map((a) => ({
      label: a.label,
      entity_type: a.entity_type,
      value: a.value
    })),
    false_positives: assignment.false_positives.map(({ detection, reason }) => ({
      reason,
      text: detection.text,
      type: detection.type,
      subtype: detection.subtype
    })),
    unmatched_flagged: assignment.unmatched_flagged.map((item) => ({
      text: item.text,
      type: item.type
    }))
  };
}

async function main() {
  const options = parseArgs(process.argv.slice(2));

  const manifestPath = path.join(options['corpus-dir'], 'manifest.json');
  const manifest = readJson(manifestPath, 'corpus manifest');
  validateManifest(manifest, manifestPath);

  const config = readJson(options.config, 'thresholds config');
  validateGateConfig(config, options.config);

  const caseFiles = fs.readdirSync(options['corpus-dir'])
    .filter((name) => name.endsWith('.json') && name !== 'manifest.json')
    .sort();
  if (caseFiles.length === 0) {
    fail(`no corpus cases found in ${options['corpus-dir']}`);
  }

  const caseIds = new Set();
  const cases = caseFiles.map((name) => {
    const casePath = path.join(options['corpus-dir'], name);
    const caseData = readJson(casePath, `corpus case ${name}`);
    validateCase(caseData, casePath, manifest.corpus_version, caseIds);
    caseIds.add(caseData.case_id);
    return caseData;
  });

  // Import the existing privacy engine entry point (loads dictionaries; no network).
  const engineUrl = pathToFileURL(path.join(repoRoot, 'js', 'modular-processor.js')).href;
  let engine;
  try {
    engine = await import(engineUrl).then((mod) => mod.PrivacyProcessor);
  } catch (error) {
    fail(`cannot load privacy engine from js/modular-processor.js: ${error.message}`);
  }

  const evaluated = cases.map((caseData) => evaluateCase(caseData, engine));

  const coreEntries = [];
  const metricsByCase = new Map();
  for (const item of evaluated) {
    const entries = Object.entries(item.per_type_counts).map(([type, counts]) => ({ type, ...counts }));
    metricsByCase.set(item.case_id, entries);
    if (item.tier === 'core') {
      coreEntries.push(...entries);
    }
  }

  const gatedMetrics = aggregateMetrics(coreEntries);
  const gate = evaluateThresholds(config.gate, gatedMetrics);

  // Fail-closed: every entity type present in the gated corpus must be covered
  // by the threshold config, otherwise taxonomy drift could hide regressions.
  const gatedTypes = new Set(coreEntries.map((e) => e.type));
  const configuredTypes = new Set(Object.keys(config.gate.per_type));
  const uncovered = [...gatedTypes].filter((t) => !configuredTypes.has(t)).sort();
  if (uncovered.length > 0) {
    fail(`entity types present in the gated corpus but missing from config.gate.per_type: ${uncovered.join(', ')}`);
  }

  const report = {
    tool: 'privacy-eval',
    schema_version: SCHEMA_VERSION,
    corpus_version: manifest.corpus_version,
    cases_evaluated: evaluated.length,
    gate: {
      thresholds: config.gate,
      overall: gatedMetrics.overall,
      per_type: gatedMetrics.per_type,
      pass: gate.pass,
      failures: gate.failures
    },
    cases: evaluated,
    adversarial: evaluated
      .filter((item) => item.tier === 'adversarial')
      .map((item) => ({
        case_id: item.case_id,
        matched: item.matched.length,
        missed: item.missed,
        flagged_only: item.flagged_only
      }))
  };

  const reportJson = JSON.stringify(report, null, 2) + '\n';
  if (options.report) {
    fs.writeFileSync(options.report, reportJson, 'utf8');
  }
  process.stdout.write(reportJson);

  const { overall } = gatedMetrics;
  const status = gate.pass ? 'PASS' : 'FAIL';
  process.stdout.write(
    `privacy-eval ${status}: corpus ${manifest.corpus_version} — ` +
    `precision ${(overall.precision * 100).toFixed(2)}%, ` +
    `recall ${(overall.recall * 100).toFixed(2)}%, ` +
    `FNR ${(overall.false_negative_rate * 100).toFixed(2)}% ` +
    `(TP ${overall.tp}, FN ${overall.fn}, FP ${overall.fp} over ${evaluated.length} cases)\n`
  );

  if (!gate.pass) {
    process.stderr.write(
      `privacy-eval: threshold gate failed:\n${gate.failures
        .map((f) => `  - ${f.scope}: ${f.metric}=${f.value} (threshold ${f.threshold})`)
        .join('\n')}\n`
    );
    process.exit(1);
  }
}

await main();
