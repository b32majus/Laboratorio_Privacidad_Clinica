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
 * - Coverage (REC-01 WU-A): the report exposes machine-visible support by
 *   top-level type and by declared slice/subtype, and `coverage.json` declares
 *   the required slices, a minimum distinct-case floor per type and the
 *   language/style slices the corpus must exhibit. A declared unit with zero
 *   support (or a collapsed type) makes `report.pass === false`, and so does
 *   narrowing the manifest: a type/slice/style that the corpus still exercises
 *   but the manifest no longer declares is a coverage failure (REC-01 F1), so
 *   a required declaration cannot disappear silently. Coverage is not a
 *   precision/recall threshold and never touches `config.json`.
 * - Per-slice metrics (REC-01 F2): `slice_metrics` exposes deterministic
 *   precision/recall/FNR (and F1) per declared slice over the gated core
 *   corpus, reusing the shared `metrics.mjs` definitions. Slice-tagged gold
 *   annotations carry tp/fn and a detection violating a slice-tagged
 *   MUST_KEEP is that slice's fp; detections matching no gold annotation stay
 *   type-level fp and remain gated at type level. Slice metrics are evidence,
 *   not a threshold: no slice is gated and `gate`/`config.json` are unchanged.
 * - Fail-closed (D-009): malformed corpus/config/coverage-manifest, an
 *   annotation whose value does not occur in its case text, an unknown slice
 *   or style, or a gated entity type missing from the threshold config all
 *   raise the typed {@link V4GroundTruthError} instead of producing a
 *   green-but-empty report.
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
import { RECOGNIZER_CATEGORIES, type RecognizerCategory } from "../recognizer-registry";
import type { LegacyEntity, V4PrivacyEngine } from "../types";

export const V4_CORPUS_SCHEMA_VERSION = 1;
export const V4_GATE_CONFIG_SCHEMA_VERSION = 1;
export const V4_COVERAGE_SCHEMA_VERSION = 1;

/**
 * REC-01 WU-A meaningful slice vocabulary per top-level type (handoff
 * "Required assurance coverage"). This is the single source of truth an
 * annotation's `slice` is validated against; a slice not listed for its type
 * is rejected fail-closed. It deliberately mirrors the existing recognizer
 * contract (legacy subtypes + the accepted AGE shapes) and Spanish clinical
 * use rather than an invented taxonomy.
 */
export const V4_SLICE_TAXONOMY: Readonly<Record<RecognizerCategory, readonly string[]>> =
  Object.freeze({
    NOMBRE: Object.freeze(["patient", "professional", "family", "compound"]),
    IDENTIFICADOR: Object.freeze([
      "dni",
      "nie",
      "nuss",
      "nhc",
      "health_card",
      "phone",
      "email",
      "postal",
    ]),
    FECHA: Object.freeze(["numeric", "textual", "month_year", "year", "measurement_negative"]),
    UBICACION: Object.freeze(["dictionary_city", "hospital", "address", "barrio"]),
    SOSPECHOSO: Object.freeze([
      "profession",
      "singularity",
      "public_role",
      "kinship",
      "rare_disease",
      "rare_disease_negative",
    ]),
    EDAD: Object.freeze([
      "adult",
      "abbreviated",
      "pediatric",
      "boundary",
      "age_vs_duration",
      "implausible_control",
    ]),
  });

/**
 * Language/style slices the corpus as a whole must exhibit (handoff
 * "Language/style slices across the corpus"). A case declares the styles it
 * represents; an unknown style is rejected fail-closed.
 */
export const V4_STYLE_SLICES = Object.freeze([
  "accents",
  "no_accents",
  "abbreviations",
  "telegraphic",
  "punctuation",
  "multiline",
  "short_prose",
  "dense_prose",
  "negatives",
] as const);

export type V4StyleSlice = (typeof V4_STYLE_SLICES)[number];

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
  /**
   * Optional meaningful slice of `entity_type` (REC-01 WU-A coverage
   * contract). When present it must be a declared slice for the annotation's
   * type; unknown/misspelled slices fail closed. Annotations without a slice
   * still contribute to type-level support and the gate, but never to slice
   * support.
   */
  readonly slice?: string;
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
  /**
   * Optional language/style slices this case represents (REC-01 WU-A). Each
   * entry must be a declared style; unknown styles fail closed.
   */
  readonly style_slices?: readonly string[];
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

/** One declared slice minimum-support requirement (REC-01 WU-A). */
export type V4CoverageSliceRequirement = {
  readonly min_support: number;
};

/** Per-top-level-type coverage requirement (REC-01 WU-A). */
export type V4CoverageTypeRequirement = {
  /** Minimum distinct cases carrying an annotation of this type. */
  readonly min_distinct_cases: number;
  /** Required slices of this type, each with a positive minimum support. */
  readonly slices: Readonly<Record<string, V4CoverageSliceRequirement>>;
};

/**
 * Machine-readable coverage requirement manifest (`coverage.json`, REC-01
 * WU-A). Support is counted over the whole committed corpus (core +
 * adversarial) because coverage measures corpus breadth; the gated
 * precision/recall/FNR thresholds in `config.json` remain the separate
 * regression-gate authority and are untouched.
 */
export type V4CoverageManifest = {
  readonly schema_version: number;
  readonly rationale?: string;
  readonly types: Readonly<Record<string, V4CoverageTypeRequirement>>;
  readonly styles: Readonly<Record<string, V4CoverageSliceRequirement>>;
};

/** One deterministic coverage failure, with a stable machine-readable key. */
export type V4CoverageFailure = {
  /**
   * Stable id, e.g. `"NOMBRE:patient"`, `"style:accents"`,
   * `"EDAD:min_distinct_cases"`, or `"UBICACION:declaration"` /
   * `"NOMBRE:professional:declaration"` for a narrowed manifest.
   */
  readonly key: string;
  readonly kind: "slice" | "style" | "distinct_cases" | "declaration";
  /** Top-level type, or `"styles"` for a style requirement. */
  readonly scope: string;
  /** Slice/style name, `"min_distinct_cases"` for a case floor, or `"type"` for a type declaration. */
  readonly slice: string;
  readonly required: number;
  readonly actual: number;
};

export type V4CoverageSliceSupport = {
  readonly support: number;
  readonly core_support: number;
  /** Declared minimum, or `null` when the manifest does not require it. */
  readonly min_support: number | null;
};

export type V4CoverageStyleSupport = {
  /** Number of cases declaring this style. */
  readonly case_count: number;
  readonly core_case_count: number;
  readonly min_support: number | null;
};

export type V4CoverageTypeSupport = {
  readonly support: number;
  readonly core_support: number;
  readonly distinct_cases: number;
  readonly core_distinct_cases: number;
  readonly min_distinct_cases: number | null;
  readonly slices: Readonly<Record<string, V4CoverageSliceSupport>>;
};

export type V4CoverageReport = {
  readonly failures: readonly V4CoverageFailure[];
  readonly types: Readonly<Record<string, V4CoverageTypeSupport>>;
  readonly styles: Readonly<Record<string, V4CoverageStyleSupport>>;
  readonly pass: boolean;
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
  /**
   * Per-top-level-type and per-slice evidence derived from the reused
   * precision/recall definitions (WU-A; WU-C evidence needs F1). The shared
   * `metrics.mjs` contract is not modified.
   */
  readonly f1: {
    readonly overall: number;
    readonly per_type: Readonly<Record<string, number>>;
    /** REC-01 F2: F1 per declared slice, keyed `"TYPE:slice"`. */
    readonly per_slice: Readonly<Record<string, number>>;
  };
  /**
   * REC-01 F2: deterministic precision/recall/FNR per declared slice
   * (keyed `"TYPE:slice"`), computed with the reused `computeMetrics`
   * semantics. Core-tier only, exactly like `gate.per_type`. Attribution:
   * slice-tagged gold annotations carry tp/fn; a detection violating a
   * slice-tagged MUST_KEEP additionally becomes that slice's fp; detections
   * matching no gold annotation stay type-level fp and remain gated at type
   * level (this map never replaces the type-level gate). These are evidence,
   * not a new threshold: no slice is gated and `config.json` is unchanged.
   */
  readonly slice_metrics: Readonly<Record<string, PrivacyEvalMetrics>>;
  /** REC-01 WU-A coverage dimension: declared-vs-supported breadth. */
  readonly coverage: V4CoverageReport;
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

/**
 * Validates the coverage requirement manifest fail-closed (REC-01 WU-A):
 * unknown type, unknown/unreachable slice, missing/empty declarations and
 * non-positive minimums are rejected instead of being silently ignored.
 */
export function assertValidV4CoverageManifest(
  manifest: unknown
): asserts manifest is V4CoverageManifest {
  if (!isPlainObject(manifest)) {
    throw new V4GroundTruthError("invalid-config", "Coverage manifest must be an object.");
  }
  if (manifest.schema_version !== V4_COVERAGE_SCHEMA_VERSION) {
    throw new V4GroundTruthError(
      "invalid-config",
      `Coverage manifest schema_version must be ${V4_COVERAGE_SCHEMA_VERSION}.`
    );
  }
  if (!isPlainObject(manifest.types) || Object.keys(manifest.types).length === 0) {
    throw new V4GroundTruthError(
      "invalid-config",
      "Coverage manifest must declare at least one top-level type."
    );
  }
  for (const [type, requirement] of Object.entries(manifest.types)) {
    if (!TAXONOMY.includes(type)) {
      throw new V4GroundTruthError(
        "invalid-config",
        `Coverage manifest references unknown entity type "${type}" (taxonomy: ${TAXONOMY.join(", ")}).`
      );
    }
    if (!isPlainObject(requirement)) {
      throw new V4GroundTruthError(
        "invalid-config",
        `Coverage manifest requirement for "${type}" must be an object.`
      );
    }
    assertPositiveInteger(`${type}.min_distinct_cases`, requirement.min_distinct_cases);
    if (!isPlainObject(requirement.slices) || Object.keys(requirement.slices).length === 0) {
      throw new V4GroundTruthError(
        "invalid-config",
        `Coverage manifest type "${type}" must declare at least one slice.`
      );
    }
    const knownSlices = V4_SLICE_TAXONOMY[type as RecognizerCategory];
    for (const [slice, sliceRequirement] of Object.entries(requirement.slices)) {
      if (!knownSlices.includes(slice)) {
        throw new V4GroundTruthError(
          "invalid-config",
          `Coverage manifest slice "${type}:${slice}" is not reachable in the ${type} slice taxonomy (${knownSlices.join(", ")}).`
        );
      }
      if (!isPlainObject(sliceRequirement)) {
        throw new V4GroundTruthError(
          "invalid-config",
          `Coverage manifest requirement for "${type}:${slice}" must be an object.`
        );
      }
      assertPositiveInteger(`${type}:${slice}.min_support`, sliceRequirement.min_support);
    }
  }
  if (!isPlainObject(manifest.styles)) {
    throw new V4GroundTruthError(
      "invalid-config",
      'Coverage manifest must define a "styles" object (may be empty).'
    );
  }
  for (const [style, styleRequirement] of Object.entries(manifest.styles)) {
    if (!(V4_STYLE_SLICES as readonly string[]).includes(style)) {
      throw new V4GroundTruthError(
        "invalid-config",
        `Coverage manifest references unknown style "${style}" (styles: ${V4_STYLE_SLICES.join(", ")}).`
      );
    }
    if (!isPlainObject(styleRequirement)) {
      throw new V4GroundTruthError(
        "invalid-config",
        `Coverage manifest requirement for style "${style}" must be an object.`
      );
    }
    assertPositiveInteger(`style:${style}.min_support`, styleRequirement.min_support);
  }
}

function assertPositiveInteger(scope: string, value: unknown): asserts value is number {
  if (typeof value !== "number" || !Number.isInteger(value) || value < 1) {
    throw new V4GroundTruthError(
      "invalid-config",
      `Coverage manifest ${scope} must be a positive integer.`
    );
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
    if (annotation.slice !== undefined) {
      if (typeof annotation.slice !== "string") {
        throw new V4GroundTruthError(
          "invalid-corpus",
          `${at} slice must be a string when present.`
        );
      }
      const knownSlices = V4_SLICE_TAXONOMY[annotation.entity_type as RecognizerCategory];
      if (!knownSlices.includes(annotation.slice)) {
        throw new V4GroundTruthError(
          "invalid-corpus",
          `${at} slice "${annotation.slice}" is not a declared ${annotation.entity_type} slice (${knownSlices.join(", ")}).`
        );
      }
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
  if (caseData.style_slices !== undefined) {
    if (!Array.isArray(caseData.style_slices)) {
      throw new V4GroundTruthError(
        "invalid-corpus",
        `Case ${String(caseData.case_id)} style_slices must be an array when present.`
      );
    }
    (caseData.style_slices as unknown[]).forEach((style, index) => {
      if (typeof style !== "string" || !(V4_STYLE_SLICES as readonly string[]).includes(style)) {
        throw new V4GroundTruthError(
          "invalid-corpus",
          `Case ${String(caseData.case_id)} style_slices[${index}] must be one of ${V4_STYLE_SLICES.join(", ")}.`
        );
      }
    });
  }
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

/** Loads and validates the coverage requirement manifest from `coveragePath`. */
export function loadV4CoverageManifest(coveragePath: string): V4CoverageManifest {
  let manifest: unknown;
  try {
    manifest = JSON.parse(fs.readFileSync(coveragePath, "utf8"));
  } catch (error) {
    throw new V4GroundTruthError(
      "invalid-config",
      `Cannot read coverage manifest at ${coveragePath}: ${(error as Error).message}`
    );
  }
  assertValidV4CoverageManifest(manifest);
  return manifest;
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
 * F1 derived from the reused precision/recall values (WU-A). The shared
 * `metrics.mjs` contract is deliberately not modified; this is additive
 * evidence for WU-C. Convention: precision + recall === 0 -> 0.
 */
function f1FromPrecisionRecall(precision: number, recall: number): number {
  const denominator = precision + recall;
  return denominator > 0 ? (2 * precision * recall) / denominator : 0;
}

/**
 * Computes the coverage dimension over the whole committed corpus (REC-01
 * WU-A). Pure: no I/O, deterministic ordering. Support counts every
 * annotation (core + adversarial); the core gate remains the separate
 * authority for precision/recall/FNR.
 */
function computeCoverage(
  cases: readonly GroundTruthCase[],
  manifest: V4CoverageManifest
): V4CoverageReport {
  const sliceSupport = new Map<string, { support: number; core_support: number }>();
  const typeSupport = new Map<string, { support: number; core_support: number }>();
  const typeCases = new Map<string, Set<string>>();
  const typeCoreCases = new Map<string, Set<string>>();
  const styleCases = new Map<string, Set<string>>();
  const styleCoreCases = new Map<string, Set<string>>();

  const bump = (
    store: Map<string, { support: number; core_support: number }>,
    key: string,
    isCore: boolean
  ) => {
    const current = store.get(key) ?? { support: 0, core_support: 0 };
    current.support += 1;
    if (isCore) current.core_support += 1;
    store.set(key, current);
  };
  const addCase = (store: Map<string, Set<string>>, key: string, caseId: string) => {
    const current = store.get(key) ?? new Set<string>();
    current.add(caseId);
    store.set(key, current);
  };

  for (const caseData of cases) {
    const isCore = caseData.tier === "core";
    for (const annotation of caseData.annotations) {
      const type = annotation.entity_type;
      bump(typeSupport, type, isCore);
      addCase(typeCases, type, caseData.case_id);
      if (isCore) addCase(typeCoreCases, type, caseData.case_id);
      if (annotation.slice !== undefined) {
        bump(sliceSupport, `${type}:${annotation.slice}`, isCore);
      }
    }
    for (const style of caseData.style_slices ?? []) {
      addCase(styleCases, style, caseData.case_id);
      if (isCore) addCase(styleCoreCases, style, caseData.case_id);
    }
  }

  // Report support over the FULL taxonomy so zero support is machine-visible
  // even for units the manifest does not (yet) require.
  const types: Record<string, V4CoverageTypeSupport> = {};
  for (const type of TAXONOMY) {
    const declared = manifest.types[type] as V4CoverageTypeRequirement | undefined;
    const slices: Record<string, V4CoverageSliceSupport> = {};
    for (const slice of V4_SLICE_TAXONOMY[type as RecognizerCategory]) {
      const support = sliceSupport.get(`${type}:${slice}`) ?? { support: 0, core_support: 0 };
      slices[slice] = {
        support: support.support,
        core_support: support.core_support,
        min_support: declared?.slices[slice]?.min_support ?? null,
      };
    }
    const support = typeSupport.get(type) ?? { support: 0, core_support: 0 };
    types[type] = {
      support: support.support,
      core_support: support.core_support,
      distinct_cases: (typeCases.get(type) ?? new Set<string>()).size,
      core_distinct_cases: (typeCoreCases.get(type) ?? new Set<string>()).size,
      min_distinct_cases: declared?.min_distinct_cases ?? null,
      slices,
    };
  }

  const styles: Record<string, V4CoverageStyleSupport> = {};
  for (const style of V4_STYLE_SLICES) {
    const declared = manifest.styles[style] as V4CoverageSliceRequirement | undefined;
    styles[style] = {
      case_count: (styleCases.get(style) ?? new Set<string>()).size,
      core_case_count: (styleCoreCases.get(style) ?? new Set<string>()).size,
      min_support: declared?.min_support ?? null,
    };
  }

  const failures: V4CoverageFailure[] = [];
  for (const type of TAXONOMY) {
    const declared = manifest.types[type] as V4CoverageTypeRequirement | undefined;
    if (declared === undefined) {
      // REC-01 F1: a type the corpus exercises but the manifest no longer
      // declares must fail closed, instead of silently dropping its
      // requirement.
      if (types[type].support > 0) {
        failures.push({
          key: `${type}:declaration`,
          kind: "declaration",
          scope: type,
          slice: "type",
          required: 1,
          actual: 0,
        });
      }
      continue;
    }
    if (types[type].distinct_cases < declared.min_distinct_cases) {
      failures.push({
        key: `${type}:min_distinct_cases`,
        kind: "distinct_cases",
        scope: type,
        slice: "min_distinct_cases",
        required: declared.min_distinct_cases,
        actual: types[type].distinct_cases,
      });
    }
    for (const slice of V4_SLICE_TAXONOMY[type as RecognizerCategory]) {
      const requirement = declared.slices[slice] as V4CoverageSliceRequirement | undefined;
      const actual = types[type].slices[slice].support;
      if (requirement === undefined) {
        // REC-01 F1: a corpus-used slice without a declaration is a silently
        // removed requirement; fail closed.
        if (actual > 0) {
          failures.push({
            key: `${type}:${slice}:declaration`,
            kind: "declaration",
            scope: type,
            slice,
            required: 1,
            actual: 0,
          });
        }
        continue;
      }
      if (actual < requirement.min_support) {
        failures.push({
          key: `${type}:${slice}`,
          kind: "slice",
          scope: type,
          slice,
          required: requirement.min_support,
          actual,
        });
      }
    }
  }
  for (const style of V4_STYLE_SLICES) {
    const requirement = manifest.styles[style] as V4CoverageSliceRequirement | undefined;
    const actual = styles[style].case_count;
    if (requirement === undefined) {
      // REC-01 F1: a corpus-declared style without a manifest declaration is
      // a silently removed requirement; fail closed.
      if (actual > 0) {
        failures.push({
          key: `style:${style}:declaration`,
          kind: "declaration",
          scope: "styles",
          slice: style,
          required: 1,
          actual: 0,
        });
      }
      continue;
    }
    if (actual < requirement.min_support) {
      failures.push({
        key: `style:${style}`,
        kind: "style",
        scope: "styles",
        slice: style,
        required: requirement.min_support,
        actual,
      });
    }
  }

  return { failures, types, styles, pass: failures.length === 0 };
}

/**
 * Evaluates the corpus against the real productive engine and returns a
 * deterministic report. Pure with respect to engine output: it performs no
 * I/O and does not mutate its inputs.
 */
export function evaluateV4GroundTruth(
  corpus: CorpusInput,
  engine: V4PrivacyEngine,
  config: V4GateConfig,
  coverageManifest: V4CoverageManifest
): V4GroundTruthReport {
  assertValidV4GateConfig(config);
  assertValidV4CoverageManifest(coverageManifest);
  const seenCaseIds = new Set<string>();
  for (const caseData of corpus.cases) {
    assertValidCase(caseData, corpus.corpusVersion, seenCaseIds);
    seenCaseIds.add(caseData.case_id);
  }

  const coreEntries: Array<{ type: string; tp: number; fn: number; fp: number }> = [];
  const coreSliceEntries: Array<{ type: string; tp: number; fn: number; fp: number }> = [];
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
    const perSliceCounts = new Map<string, { tp: number; fn: number; fp: number }>();
    const bump = (
      store: Map<string, { tp: number; fn: number; fp: number }>,
      key: string,
      field: "tp" | "fn" | "fp"
    ) => {
      const current = store.get(key) ?? { tp: 0, fn: 0, fp: 0 };
      current[field] += 1;
      store.set(key, current);
    };
    // REC-01 F2 slice attribution: slice-tagged gold annotations carry tp/fn;
    // a detection violating a slice-tagged MUST_KEEP is additionally that
    // slice's fp. Every unmatched detection still bumps its type-level fp
    // (unchanged gate semantics); detections matching no gold annotation are
    // therefore never hidden from the type-level gate.
    for (const { annotation } of assignment.matched) {
      bump(perTypeCounts, annotation.entity_type, "tp");
      if (annotation.slice !== undefined) {
        bump(perSliceCounts, `${annotation.entity_type}:${annotation.slice}`, "tp");
      }
    }
    for (const annotation of assignment.missed) {
      bump(perTypeCounts, annotation.entity_type, "fn");
      if (annotation.slice !== undefined) {
        bump(perSliceCounts, `${annotation.entity_type}:${annotation.slice}`, "fn");
      }
    }
    for (const { detection, annotation } of assignment.false_positives) {
      bump(perTypeCounts, detection.type, "fp");
      if (annotation?.slice !== undefined) {
        bump(perSliceCounts, `${annotation.entity_type}:${annotation.slice}`, "fp");
      }
    }

    const goldenFailures = collectGoldenFailures(caseData, entities, assignment.matched);
    // Adversarial cases are REPORT-ONLY (documented tier contract, identical
    // to the accepted legacy harness): their golden failures are surfaced in
    // the case result but never gate. Only core-case goldens feed `pass`.
    if (caseData.tier === "core") allGoldenFailures.push(...goldenFailures);

    const entries = [...perTypeCounts.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([type, counts]) => ({ type, ...counts }));
    if (caseData.tier === "core") coreEntries.push(...entries);

    const sliceEntries = [...perSliceCounts.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, counts]) => ({ type: key, ...counts }));
    if (caseData.tier === "core") coreSliceEntries.push(...sliceEntries);

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
  const coverage = computeCoverage(corpus.cases, coverageManifest);

  // REC-01 F2: per-declared-slice metrics over the SAME gated (core) entries,
  // reusing the shared computeMetrics semantics through aggregateMetrics (no
  // forked formula). Slices declared by the manifest but with no core entry
  // are reported with the shared empty-count conventions (precision/recall 1,
  // FNR 0) instead of being silently omitted.
  const declaredSliceKeys = new Set<string>();
  for (const type of TAXONOMY) {
    const requirement = coverageManifest.types[type] as V4CoverageTypeRequirement | undefined;
    for (const slice of Object.keys(requirement?.slices ?? {})) {
      declaredSliceKeys.add(`${type}:${slice}`);
    }
  }
  const sliceCountTotals = new Map<string, { tp: number; fn: number; fp: number }>();
  for (const entry of coreSliceEntries) {
    const current = sliceCountTotals.get(entry.type) ?? { tp: 0, fn: 0, fp: 0 };
    current.tp += entry.tp;
    current.fn += entry.fn;
    current.fp += entry.fp;
    sliceCountTotals.set(entry.type, current);
  }
  for (const key of declaredSliceKeys) {
    if (!sliceCountTotals.has(key)) sliceCountTotals.set(key, { tp: 0, fn: 0, fp: 0 });
  }
  const sliceMetrics = aggregateMetrics(
    [...sliceCountTotals.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([type, counts]) => ({ type, ...counts }))
  ).per_type;

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
    f1: {
      overall: f1FromPrecisionRecall(gatedMetrics.overall.precision, gatedMetrics.overall.recall),
      per_type: Object.fromEntries(
        Object.entries(gatedMetrics.per_type).map(([type, metrics]) => [
          type,
          f1FromPrecisionRecall(metrics.precision, metrics.recall),
        ])
      ),
      per_slice: Object.fromEntries(
        Object.entries(sliceMetrics).map(([slice, metrics]) => [
          slice,
          f1FromPrecisionRecall(metrics.precision, metrics.recall),
        ])
      ),
    },
    slice_metrics: sliceMetrics,
    coverage,
    adversarial: caseResults
      .filter((result) => result.tier === "adversarial")
      .map((result) => ({
        case_id: result.case_id,
        matched: result.matched,
        missed: result.missed,
        flagged_only: result.flagged_only,
      })),
    // Recog1 WU-A: coverage is not a precision/recall threshold, but a required
    // declared unit with zero support or a collapsed top-level type makes the
    // whole assurance report false (fail closed). The gate thresholds in
    // config.json are untouched.
    pass: thresholdGate.pass && allGoldenFailures.length === 0 && coverage.pass,
  };
}

export const V4_GROUND_TRUTH_DIR = path.dirname(fileURLToPath(import.meta.url));
export const V4_CORPUS_DIR = path.join(V4_GROUND_TRUTH_DIR, "corpus");
export const V4_GATE_CONFIG_PATH = path.join(V4_GROUND_TRUTH_DIR, "config.json");
export const V4_COVERAGE_PATH = path.join(V4_GROUND_TRUTH_DIR, "coverage.json");
