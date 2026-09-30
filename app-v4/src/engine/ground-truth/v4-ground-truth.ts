/**
 * V4 ground-truth gate (HARDEN-02 WU-A; DEBT FUNC-008 + QA-001).
 *
 * The accepted legacy harness (`scripts/privacy-eval/evaluate.mjs`) evaluates
 * the legacy engine and its taxonomy has no AGE category, so there is no
 * deterministic annotated gate for the productive V4 recognizer/operator
 * pipeline (including the accepted T12 AGE generalization). This module adds
 * that missing evidence by running the SAME corpus-driven, annotation-only
 * methodology over the REAL productive engine
 * (`createRegistryEngine`, the registry-composed recognizer → policy →
 * operator pipeline, i.e. the path the app uses).
 *
 * Design rules:
 *
 * - Expectations live ONLY in the corpus annotations. The evaluator never
 *   derives expectations from engine output.
 * - Matching and metrics are REUSED verbatim from the accepted legacy harness
 *   (`scripts/privacy-eval/lib/matching.mjs`, `metrics.mjs`); the metric
 *   definitions are not forked (QUALITY_EXECUTION_PROTOCOL §3.3).
 * - Core cases gate; adversarial cases are reported as known gaps and never
 *   gate (identical to the accepted legacy harness).
 * - AGE results are additionally validated as golden evidence: for every
 *   governed `expectedTransformed` annotation the kept detection's banded
 *   output and immutable source span must match the annotation exactly, so an
 *   implementation that silently keeps the exact age or shifts the span fails.
 * - Fail-closed (D-009): malformed corpus/config, an annotation whose value
 *   does not occur in its case text, or a gated entity type missing from the
 *   threshold config all raise the typed {@link V4GroundTruthError} instead
 *   of producing a green-but-empty report.
 *
 * This module is test/CI-only: it reads committed synthetic fixtures from
 * disk and is deliberately NOT imported by the application bundle (nothing in
 * `app-v4/src/main.tsx` reaches it), so it never ships to the clinical origin.
 *
 * Privacy: all fixtures are synthetic; this module never logs or transmits
 * content.
 */

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

import { assignDetections } from "../../../../scripts/privacy-eval/lib/matching.mjs";
import {
  aggregateMetrics,
  evaluateThresholds,
  type PrivacyEvalGateFailure,
  type PrivacyEvalMetrics,
} from "../../../../scripts/privacy-eval/lib/metrics.mjs";
import { RECOGNIZER_CATEGORIES } from "../recognizer-registry";
import type { LegacyEntity, V4PrivacyEngine } from "../types";

export const V4_CORPUS_SCHEMA_VERSION = 1;
export const V4_GATE_CONFIG_SCHEMA_VERSION = 1;

const LABELS = ["MUST_REMOVE", "MUST_KEEP", "MUST_FLAG_FOR_REVIEW"] as const;
const TIERS = ["core", "adversarial"] as const;
const TAXONOMY: readonly string[] = RECOGNIZER_CATEGORIES;

export type GroundTruthLabel = (typeof LABELS)[number];
export type GroundTruthTier = (typeof TIERS)[number];

/** Minimal annotation shape the reused matcher consumes. */
type MatchedAnnotation = {
  readonly label: string;
  readonly entity_type: string;
  readonly value: string;
  readonly expectedTransformed?: string;
};

/** One ground-truth expectation, independent of recognizer code. */
export type GroundTruthAnnotation = {
  readonly label: GroundTruthLabel;
  readonly entity_type: string;
  readonly value: string;
  readonly note?: string;
  /**
   * The exact accepted transformed output for a governed span (used by AGE,
   * whose banding is accepted policy). When present, the kept detection's
   * `transformed` value must equal it verbatim.
   */
  readonly expectedTransformed?: string;
};

/** One annotated synthetic case. */
export type GroundTruthCase = {
  readonly schema_version: number;
  readonly corpus_version: string;
  readonly case_id: string;
  readonly tier: GroundTruthTier;
  readonly source?: string;
  readonly description?: string;
  readonly text: string;
  readonly annotations: readonly GroundTruthAnnotation[];
};

export type V4CorpusManifest = {
  readonly schema_version: number;
  readonly corpus_version: string;
  readonly description?: string;
  readonly taxonomy?: readonly string[];
  readonly labels?: readonly string[];
};

export type V4GateThresholds = {
  readonly min_precision: number;
  readonly min_recall: number;
  readonly max_fnr: number;
};

export type V4GateConfig = {
  readonly schema_version: number;
  readonly rationale?: string;
  readonly gate: {
    readonly overall: V4GateThresholds;
    readonly per_type: Readonly<Record<string, V4GateThresholds>>;
  };
};

/** Machine-readable codes carried by {@link V4GroundTruthError} (D-009). */
export type V4GroundTruthErrorCode = "invalid-corpus" | "invalid-config";

/** Typed fail-closed ground-truth failure. */
export class V4GroundTruthError extends Error {
  readonly code: V4GroundTruthErrorCode;

  constructor(code: V4GroundTruthErrorCode, message: string) {
    super(message);
    this.name = "V4GroundTruthError";
    this.code = code;
  }
}

export type V4CaseResult = {
  readonly case_id: string;
  readonly tier: GroundTruthTier;
  readonly matched: number;
  readonly missed: ReadonlyArray<{ entity_type: string; value: string }>;
  readonly flagged_only: ReadonlyArray<{ entity_type: string; value: string }>;
  readonly false_positives: ReadonlyArray<{ type: string; text: string; reason: string }>;
  readonly golden_failures: readonly string[];
};

export type V4GroundTruthReport = {
  readonly tool: "privacy-eval-v4";
  readonly schema_version: 1;
  readonly corpus_version: string;
  readonly cases_evaluated: number;
  readonly gate: {
    readonly thresholds: V4GateConfig["gate"];
    readonly overall: PrivacyEvalMetrics;
    readonly per_type: Readonly<Record<string, PrivacyEvalMetrics>>;
    readonly failures: readonly PrivacyEvalGateFailure[];
    readonly pass: boolean;
  };
  readonly golden_failures: readonly string[];
  readonly cases: readonly V4CaseResult[];
  readonly adversarial: ReadonlyArray<{
    readonly case_id: string;
    readonly matched: number;
    readonly missed: ReadonlyArray<{ entity_type: string; value: string }>;
    readonly flagged_only: ReadonlyArray<{ entity_type: string; value: string }>;
  }>;
  readonly pass: boolean;
};

const NORMALIZE = (value: string): string =>
  value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function assertThresholds(
  scope: string,
  thresholds: unknown
): asserts thresholds is V4GateThresholds {
  if (!isPlainObject(thresholds)) {
    throw new V4GroundTruthError("invalid-config", `gate.${scope} must define thresholds.`);
  }
  for (const key of ["min_precision", "min_recall", "max_fnr"] as const) {
    if (typeof thresholds[key] !== "number") {
      throw new V4GroundTruthError("invalid-config", `gate.${scope}.${key} must be a number.`);
    }
  }
}

/** Validates the threshold config fail-closed before evaluating anything. */
export function assertValidV4GateConfig(config: unknown): asserts config is V4GateConfig {
  if (!isPlainObject(config)) {
    throw new V4GroundTruthError("invalid-config", "Gate config must be an object.");
  }
  if (config.schema_version !== V4_GATE_CONFIG_SCHEMA_VERSION) {
    throw new V4GroundTruthError(
      "invalid-config",
      `Gate config schema_version must be ${V4_GATE_CONFIG_SCHEMA_VERSION}.`
    );
  }
  const gate = config.gate;
  if (!isPlainObject(gate) || !isPlainObject(gate.per_type)) {
    throw new V4GroundTruthError(
      "invalid-config",
      'Gate config must define a "gate" object with "overall" and "per_type" thresholds.'
    );
  }
  assertThresholds("overall", gate.overall);
  for (const [type, thresholds] of Object.entries(gate.per_type)) {
    if (!TAXONOMY.includes(type)) {
      throw new V4GroundTruthError(
        "invalid-config",
        `gate.per_type references unknown entity type "${type}" (taxonomy: ${TAXONOMY.join(", ")}).`
      );
    }
    assertThresholds(`per_type.${type}`, thresholds);
  }
}

function assertValidManifest(manifest: unknown): asserts manifest is V4CorpusManifest {
  if (!isPlainObject(manifest)) {
    throw new V4GroundTruthError("invalid-corpus", "Corpus manifest must be an object.");
  }
  if (manifest.schema_version !== V4_CORPUS_SCHEMA_VERSION) {
    throw new V4GroundTruthError(
      "invalid-corpus",
      `Corpus manifest schema_version must be ${V4_CORPUS_SCHEMA_VERSION}.`
    );
  }
  if (typeof manifest.corpus_version !== "string" || manifest.corpus_version.length === 0) {
    throw new V4GroundTruthError(
      "invalid-corpus",
      "Corpus manifest corpus_version must be a non-empty string."
    );
  }
}

/** Validates one corpus case fail-closed. */
function assertValidCase(
  caseData: unknown,
  corpusVersion: string,
  seenCaseIds: Set<string>
): asserts caseData is GroundTruthCase {
  if (!isPlainObject(caseData)) {
    throw new V4GroundTruthError("invalid-corpus", "A corpus case must be an object.");
  }
  if (caseData.schema_version !== V4_CORPUS_SCHEMA_VERSION) {
    throw new V4GroundTruthError(
      "invalid-corpus",
      `Case schema_version must be ${V4_CORPUS_SCHEMA_VERSION}.`
    );
  }
  if (caseData.corpus_version !== corpusVersion) {
    throw new V4GroundTruthError(
      "invalid-corpus",
      `Case corpus_version must match the manifest ("${corpusVersion}").`
    );
  }
  if (typeof caseData.case_id !== "string" || caseData.case_id.length === 0) {
    throw new V4GroundTruthError("invalid-corpus", "Case case_id must be a non-empty string.");
  }
  if (seenCaseIds.has(caseData.case_id)) {
    throw new V4GroundTruthError("invalid-corpus", `Duplicate case_id "${caseData.case_id}".`);
  }
  if (!TIERS.includes(caseData.tier as GroundTruthTier)) {
    throw new V4GroundTruthError("invalid-corpus", `Case tier must be one of ${TIERS.join(", ")}.`);
  }
  if (typeof caseData.text !== "string" || caseData.text.trim().length === 0) {
    throw new V4GroundTruthError("invalid-corpus", "Case text must be a non-empty string.");
  }
  if (!Array.isArray(caseData.annotations)) {
    throw new V4GroundTruthError("invalid-corpus", "Case annotations must be an array.");
  }
  (caseData.annotations as unknown[]).forEach((annotation, index) => {
    const at = `Case ${String(caseData.case_id)} annotations[${index}]`;
    if (!isPlainObject(annotation)) {
      throw new V4GroundTruthError("invalid-corpus", `${at} must be an object.`);
    }
    if (!LABELS.includes(annotation.label as GroundTruthLabel)) {
      throw new V4GroundTruthError(
        "invalid-corpus",
        `${at} label must be one of ${LABELS.join(", ")}.`
      );
    }
    if (typeof annotation.entity_type !== "string" || !TAXONOMY.includes(annotation.entity_type)) {
      throw new V4GroundTruthError(
        "invalid-corpus",
        `${at} entity_type must be one of ${TAXONOMY.join(", ")}.`
      );
    }
    if (typeof annotation.value !== "string" || annotation.value.trim().length === 0) {
      throw new V4GroundTruthError("invalid-corpus", `${at} value must be a non-empty string.`);
    }
    if (!String(caseData.text).includes(annotation.value)) {
      throw new V4GroundTruthError(
        "invalid-corpus",
        `${at} value "${String(annotation.value)}" does not occur in the case text.`
      );
    }
    if (
      annotation.expectedTransformed !== undefined &&
      typeof annotation.expectedTransformed !== "string"
    ) {
      throw new V4GroundTruthError(
        "invalid-corpus",
        `${at} expectedTransformed must be a string when present.`
      );
    }
  });
}

/** Loads and validates the committed V4 corpus from `corpusDir`. */
export function loadV4Corpus(corpusDir: string): {
  readonly manifest: V4CorpusManifest;
  readonly cases: readonly GroundTruthCase[];
} {
  let manifest: unknown;
  try {
    manifest = JSON.parse(fs.readFileSync(path.join(corpusDir, "manifest.json"), "utf8"));
  } catch (error) {
    throw new V4GroundTruthError(
      "invalid-corpus",
      `Cannot read corpus manifest at ${corpusDir}: ${(error as Error).message}`
    );
  }
  assertValidManifest(manifest);
  const caseFiles = fs
    .readdirSync(corpusDir)
    .filter((name) => name.endsWith(".json") && name !== "manifest.json")
    .sort();
  if (caseFiles.length === 0) {
    throw new V4GroundTruthError("invalid-corpus", `No corpus cases found in ${corpusDir}.`);
  }
  const seenCaseIds = new Set<string>();
  const cases = caseFiles.map((name) => {
    const caseData: unknown = JSON.parse(fs.readFileSync(path.join(corpusDir, name), "utf8"));
    assertValidCase(caseData, manifest.corpus_version, seenCaseIds);
    seenCaseIds.add(caseData.case_id);
    return caseData;
  });
  return { manifest, cases };
}

/** Loads and validates the gate threshold config from `configPath`. */
export function loadV4GateConfig(configPath: string): V4GateConfig {
  let config: unknown;
  try {
    config = JSON.parse(fs.readFileSync(configPath, "utf8"));
  } catch (error) {
    throw new V4GroundTruthError(
      "invalid-config",
      `Cannot read gate config at ${configPath}: ${(error as Error).message}`
    );
  }
  assertValidV4GateConfig(config);
  return config;
}

/**
 * Golden/span validation for governed annotations. Every positive annotation
 * satisfied by a kept detection must additionally name a detection with the
 * EXACT source span, and (when `expectedTransformed` is declared) the exact
 * accepted transformed output. This is where a silently-kept exact age or a
 * drifted span fails even though the text/type match succeeded.
 */
function collectGoldenFailures(
  caseData: GroundTruthCase,
  entities: readonly LegacyEntity[],
  matched: ReadonlyArray<{ annotation: MatchedAnnotation; via: "detection" | "flagged" }>
): string[] {
  const failures: string[] = [];
  for (const { annotation, via } of matched) {
    if (annotation.label === "MUST_KEEP") continue;
    if (via !== "detection") {
      failures.push(
        `${caseData.case_id}: "${annotation.value}" (${annotation.entity_type}) was only flagged for review, never detected; governed output requires a kept detection.`
      );
      continue;
    }
    const expectedStart = caseData.text.indexOf(annotation.value);
    const exact = entities.find(
      (entity) =>
        entity.type === annotation.entity_type &&
        NORMALIZE(entity.text) === NORMALIZE(annotation.value)
    );
    if (exact === undefined) {
      failures.push(
        `${caseData.case_id}: no exact ${annotation.entity_type} detection for "${annotation.value}".`
      );
      continue;
    }
    const expectedEnd = expectedStart + annotation.value.length;
    if (exact.position.start !== expectedStart || exact.position.end !== expectedEnd) {
      failures.push(
        `${caseData.case_id}: span mismatch for "${annotation.value}" (expected ${expectedStart}..${expectedEnd}, got ${exact.position.start}..${exact.position.end}).`
      );
    }
    if (
      annotation.expectedTransformed !== undefined &&
      exact.transformed !== annotation.expectedTransformed
    ) {
      failures.push(
        `${caseData.case_id}: transformed mismatch for "${annotation.value}" (expected ${JSON.stringify(
          annotation.expectedTransformed
        )}, got ${JSON.stringify(exact.transformed)}).`
      );
    }
  }
  return failures;
}

type CorpusInput = {
  readonly corpusVersion: string;
  readonly cases: readonly GroundTruthCase[];
};

/**
 * Evaluates the corpus against the real productive engine and returns a
 * deterministic report. Pure with respect to engine output: it performs no
 * I/O and does not mutate its inputs.
 */
export function evaluateV4GroundTruth(
  corpus: CorpusInput,
  engine: V4PrivacyEngine,
  config: V4GateConfig
): V4GroundTruthReport {
  assertValidV4GateConfig(config);
  const seenCaseIds = new Set<string>();
  for (const caseData of corpus.cases) {
    assertValidCase(caseData, corpus.corpusVersion, seenCaseIds);
    seenCaseIds.add(caseData.case_id);
  }

  const coreEntries: Array<{ type: string; tp: number; fn: number; fp: number }> = [];
  const caseResults: V4CaseResult[] = [];
  const allGoldenFailures: string[] = [];

  for (const caseData of corpus.cases) {
    const outcome = engine.process({ text: caseData.text, context: { mode: "fresh" } });
    const entities = outcome.result.entities;
    const detections = entities.map((entity) => ({
      text: entity.text,
      type: entity.type,
      subtype: entity.subtype ?? null,
    }));
    const flaggedItems = (outcome.result.candidates ?? []).map((candidate) => ({
      text: candidate.text,
      type: candidate.type,
    }));
    const assignment = assignDetections(caseData.annotations, detections, flaggedItems);

    const perTypeCounts = new Map<string, { tp: number; fn: number; fp: number }>();
    const bump = (type: string, key: "tp" | "fn" | "fp") => {
      const current = perTypeCounts.get(type) ?? { tp: 0, fn: 0, fp: 0 };
      current[key] += 1;
      perTypeCounts.set(type, current);
    };
    for (const { annotation } of assignment.matched) bump(annotation.entity_type, "tp");
    for (const annotation of assignment.missed) bump(annotation.entity_type, "fn");
    for (const { detection } of assignment.false_positives) bump(detection.type, "fp");

    const goldenFailures = collectGoldenFailures(caseData, entities, assignment.matched);
    // Adversarial cases are REPORT-ONLY (documented tier contract, identical
    // to the accepted legacy harness): their golden failures are surfaced in
    // the case result but never gate. Only core-case goldens feed `pass`.
    if (caseData.tier === "core") allGoldenFailures.push(...goldenFailures);

    const entries = [...perTypeCounts.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([type, counts]) => ({ type, ...counts }));
    if (caseData.tier === "core") coreEntries.push(...entries);

    caseResults.push({
      case_id: caseData.case_id,
      tier: caseData.tier,
      matched: assignment.matched.length,
      missed: assignment.missed.map((annotation) => ({
        entity_type: annotation.entity_type,
        value: annotation.value,
      })),
      flagged_only: assignment.flagged_only.map((annotation) => ({
        entity_type: annotation.entity_type,
        value: annotation.value,
      })),
      false_positives: assignment.false_positives.map(({ detection, reason }) => ({
        type: detection.type,
        text: detection.text,
        reason,
      })),
      golden_failures: goldenFailures,
    });
  }

  const gatedMetrics = aggregateMetrics(coreEntries);
  const thresholdGate = evaluateThresholds(config.gate, gatedMetrics);

  // Fail-closed taxonomy coverage: a gated type present in the corpus but
  // missing from the thresholds could hide a regression; never pass silently.
  const gatedTypes = new Set(coreEntries.map((entry) => entry.type));
  const configuredTypes = new Set(Object.keys(config.gate.per_type));
  const uncovered = [...gatedTypes].filter((type) => !configuredTypes.has(type)).sort();
  if (uncovered.length > 0) {
    throw new V4GroundTruthError(
      "invalid-config",
      `Entity types present in the gated corpus but missing from config.gate.per_type: ${uncovered.join(", ")}.`
    );
  }

  return {
    tool: "privacy-eval-v4",
    schema_version: 1,
    corpus_version: corpus.corpusVersion,
    cases_evaluated: corpus.cases.length,
    gate: {
      thresholds: config.gate,
      overall: gatedMetrics.overall,
      per_type: gatedMetrics.per_type,
      failures: thresholdGate.failures,
      pass: thresholdGate.pass,
    },
    golden_failures: allGoldenFailures,
    cases: caseResults,
    adversarial: caseResults
      .filter((result) => result.tier === "adversarial")
      .map((result) => ({
        case_id: result.case_id,
        matched: result.matched,
        missed: result.missed,
        flagged_only: result.flagged_only,
      })),
    pass: thresholdGate.pass && allGoldenFailures.length === 0,
  };
}

export const V4_GROUND_TRUTH_DIR = path.dirname(fileURLToPath(import.meta.url));
export const V4_CORPUS_DIR = path.join(V4_GROUND_TRUTH_DIR, "corpus");
export const V4_GATE_CONFIG_PATH = path.join(V4_GROUND_TRUTH_DIR, "config.json");
