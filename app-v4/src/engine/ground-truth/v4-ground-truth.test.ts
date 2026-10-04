import fs from "fs";

import { describe, expect, it } from "vitest";

import { RECOGNIZER_CATEGORIES } from "../recognizer-registry";
import { createRegistryEngine } from "../registry-engine";
import {
  assertValidV4CoverageManifest,
  evaluateV4GroundTruth,
  loadV4Corpus,
  loadV4CoverageManifest,
  loadV4GateConfig,
  V4_CORPUS_DIR,
  V4_COVERAGE_PATH,
  V4_GATE_CONFIG_PATH,
  V4GroundTruthError,
  type GroundTruthCase,
  type V4CoverageManifest,
  type V4GateConfig,
} from "./v4-ground-truth";

/**
 * HARDEN-02 WU-A — deterministic ground-truth gate for the productive V4
 * engine (DEBT FUNC-008 + QA-001).
 *
 * The gate runs the REAL registry-composed engine over a versioned synthetic
 * annotated corpus and asserts precision/recall/FNR thresholds plus exact
 * AGE span/band goldens. Every assertion below has a planted falsation that
 * proves the gate can disagree (QUALITY_EXECUTION_PROTOCOL §2/§3.5): a
 * dropped detection, a spurious detection and a wrong AGE band each make the
 * gate fail. The committed errors that keep legacy coverage (the legacy
 * corpus and its evaluator) are untouched.
 */

const corpus = loadV4Corpus(V4_CORPUS_DIR);
const config = loadV4GateConfig(V4_GATE_CONFIG_PATH);
const coverageContract = loadV4CoverageManifest(V4_COVERAGE_PATH);
const engine = createRegistryEngine();

function evaluate(
  cases: readonly GroundTruthCase[],
  gateConfig: V4GateConfig = config,
  coverage: V4CoverageManifest = coverageContract
) {
  return evaluateV4GroundTruth(
    { corpusVersion: corpus.manifest.corpus_version, cases },
    engine,
    gateConfig,
    coverage
  );
}

describe("V4 ground-truth gate (FUNC-008 + QA-001)", () => {
  it("passes the committed corpus with exact AGE bands and spans", () => {
    const report = evaluate(corpus.cases);
    if (!report.gate.pass || report.golden_failures.length > 0) {
      // Surface the exact failing evidence in CI instead of a bare boolean.
      process.stderr.write(
        `V4 ground-truth gate FAILED\n${JSON.stringify(
          {
            gate: report.gate.failures,
            golden: report.golden_failures,
            failing_cases: report.cases.filter(
              (result) =>
                result.missed.length > 0 ||
                result.false_positives.length > 0 ||
                result.golden_failures.length > 0
            ),
          },
          null,
          2
        )}\n`
      );
    }
    // The threshold/golden gate stays green. The report-level `pass` also
    // aggregates the coverage dimension, which is pinned separately by the
    // INTERIM coverage test below (REC-01 WU-B expands the corpus).
    expect(report.gate.pass).toBe(true);
    expect(report.gate.failures).toEqual([]);
    expect(report.golden_failures).toEqual([]);
    expect(report.gate.overall).toMatchObject({ precision: 1, recall: 1, false_negative_rate: 0 });
  });

  it("exercises the full recognizer taxonomy, including AGE", () => {
    const gatedTypes = [...Object.keys(config.gate.per_type)].sort();
    expect(gatedTypes).toEqual([...RECOGNIZER_CATEGORIES].sort());
    // Every declared per-type threshold is actually populated by core cases.
    const report = evaluate(corpus.cases);
    expect([...Object.keys(report.gate.per_type)].sort()).toEqual(gatedTypes);
    for (const type of RECOGNIZER_CATEGORIES) {
      expect(report.gate.per_type[type]?.tp ?? 0).toBeGreaterThan(0);
    }
  });

  it("reports adversarial known gaps without gating on them", () => {
    const report = evaluate(corpus.cases);
    expect(report.adversarial.length).toBeGreaterThan(0);
    // The adversarial tier must never contribute to the gated corpus: the
    // gap cases (duration misclassified, implausible magnitude rejected,
    // literal '<1 año') carry explicit expectations in the report.
    expect(report.gate.overall.fp).toBe(0);
  });

  it("FALSATION — a planted missing detection (recall) fails the gate", () => {
    const base = corpus.cases.find((c) => c.case_id === "v4-007-age-false-positive-guard")!;
    const planted: GroundTruthCase = {
      ...base,
      // "82 kg" occurs in the text but is not an EDAD detection: the gate must
      // count a false negative and refuse to pass.
      annotations: [
        ...base.annotations,
        { label: "MUST_REMOVE", entity_type: "EDAD", value: "82 kg" },
      ],
    };
    const report = evaluate([planted]);
    expect(report.pass).toBe(false);
    expect(report.gate.failures.map((failure) => failure.metric)).toContain("recall");
  });

  it("FALSATION — a planted spurious privacy detection (precision) fails the gate", () => {
    const planted: GroundTruthCase = {
      schema_version: 1,
      corpus_version: corpus.manifest.corpus_version,
      case_id: "v4-planted-must-keep-violation",
      tier: "core",
      text: "Paciente de 45 años.",
      annotations: [
        // The engine DOES detect this age; declaring it MUST_KEEP plants a
        // privacy-relevant false positive the gate must reject.
        { label: "MUST_KEEP", entity_type: "EDAD", value: "45 años" },
      ],
    };
    const report = evaluate([planted]);
    expect(report.pass).toBe(false);
    expect(report.gate.failures.map((failure) => failure.metric)).toContain("precision");
  });

  it("FALSATION — a wrong AGE band golden fails the gate", () => {
    const base = corpus.cases.find((c) => c.case_id === "v4-003-age-top-code")!;
    const planted: GroundTruthCase = {
      ...base,
      annotations: base.annotations.map((annotation, index) =>
        index === 0
          ? { ...annotation, expectedTransformed: "80–89 años" } // 96 años is 90+
          : annotation
      ),
    };
    const report = evaluate([planted]);
    expect(report.pass).toBe(false);
    expect(report.golden_failures.join(" ")).toMatch(/transformed mismatch/);
  });

  it("FALSATION — a partial/broader detection span is rejected by the golden gate", () => {
    // The tolerant legacy matcher accepts containment, but governed output
    // requires the EXACT detection identity/span. The engine detects the
    // broader professional span "Dr. García atiende"; declaring only
    // "Dr. García" must fail the golden gate even though the matcher would
    // satisfy it by containment.
    const planted: GroundTruthCase = {
      schema_version: 1,
      corpus_version: corpus.manifest.corpus_version,
      case_id: "v4-planted-partial-span",
      tier: "core",
      text: "El Dr. García atiende a Juan Pérez.",
      annotations: [
        { label: "MUST_REMOVE", entity_type: "NOMBRE", value: "Dr. García" },
        { label: "MUST_REMOVE", entity_type: "NOMBRE", value: "Juan Pérez" },
      ],
    };
    const report = evaluate([planted]);
    expect(report.pass).toBe(false);
    expect(report.golden_failures.join(" ")).toMatch(/no exact .* detection/);
  });

  it("fail-closed: an annotation absent from its case text is rejected, not ignored", () => {
    const planted: GroundTruthCase = {
      schema_version: 1,
      corpus_version: corpus.manifest.corpus_version,
      case_id: "v4-planted-absent-annotation",
      tier: "core",
      text: "Paciente de 45 años.",
      annotations: [{ label: "MUST_REMOVE", entity_type: "EDAD", value: "999 años" }],
    };
    expect(() => evaluate([planted])).toThrow(V4GroundTruthError);
    try {
      evaluate([planted]);
    } catch (error) {
      expect((error as V4GroundTruthError).code).toBe("invalid-corpus");
    }
  });

  it("REPORT-ONLY tier — an adversarial golden failure is reported but never gates", () => {
    const planted: GroundTruthCase = {
      schema_version: 1,
      corpus_version: corpus.manifest.corpus_version,
      case_id: "v4-planted-adversarial-golden",
      tier: "adversarial",
      text: "Paciente de 96 años.",
      annotations: [
        {
          label: "MUST_REMOVE",
          entity_type: "EDAD",
          value: "96 años",
          expectedTransformed: "80–89 años", // wrong: 96 is 90+
        },
      ],
    };
    const report = evaluate([...corpus.cases, planted]);
    // The wrong band IS surfaced on the case result...
    expect(
      report.cases
        .find((result) => result.case_id === "v4-planted-adversarial-golden")
        ?.golden_failures.join(" ")
    ).toMatch(/transformed mismatch/);
    // ...but it must not gate, matching the documented report-only tier.
    expect(report.golden_failures).toEqual([]);
    // The advisory report-level `pass` also carries the coverage dimension
    // (pinned separately by the INTERIM coverage test); the gate stays green.
    expect(report.gate.pass).toBe(true);
  });

  it("fail-closed: a gated entity type without thresholds is rejected, not silently skipped", () => {
    const incomplete: V4GateConfig = {
      ...config,
      gate: {
        ...config.gate,
        per_type: { EDAD: config.gate.per_type.EDAD },
      },
    };
    expect(() =>
      evaluateV4GroundTruth(
        { corpusVersion: corpus.manifest.corpus_version, cases: corpus.cases },
        engine,
        incomplete,
        coverageContract
      )
    ).toThrow(V4GroundTruthError);
  });
});

/**
 * REC-01 WU-A (SPANISH-ENGINE-ASSURANCE-01) — coverage contract.
 *
 * WU-A owns the measurement instrument, not recognition quality. The coverage
 * manifest (`coverage.json`) declares, per top-level type, the meaningful
 * slices that must have machine-visible support plus a minimum distinct-case
 * floor, and the language/style slices the corpus as a whole must exhibit.
 * The evaluator fails closed (report `pass === false`) when a declared unit
 * has zero support, a type falls below its case floor, or an annotation/case
 * declares an unknown slice. The committed corpus does not declare slices yet
 * (WU-B expands it), so the INTERIM test below pins the exact red state.
 */
describe("V4 coverage contract (REC-01 WU-A)", () => {
  it("loads and validates the committed coverage manifest for every taxonomy type", () => {
    const manifest = loadV4CoverageManifest(V4_COVERAGE_PATH);
    expect(manifest.schema_version).toBe(1);
    // Every productive top-level type is governed by the contract, so no
    // category can be described as broadly assured from a single example.
    expect(Object.keys(manifest.types).sort()).toEqual([...RECOGNIZER_CATEGORIES].sort());
    expect(Object.keys(manifest.styles).length).toBeGreaterThan(0);
    expect(() => assertValidV4CoverageManifest(manifest)).not.toThrow();
  });

  it("fail-closed: an unknown top-level type in the manifest is rejected", () => {
    const planted = {
      schema_version: 1,
      types: { PACIENTE: { min_distinct_cases: 2, slices: { patient: { min_support: 1 } } } },
      styles: {},
    };
    expect(() => assertValidV4CoverageManifest(planted)).toThrow(V4GroundTruthError);
  });

  it("fail-closed: a slice unreachable in the type taxonomy is rejected", () => {
    const planted = {
      schema_version: 1,
      types: { NOMBRE: { min_distinct_cases: 2, slices: { apellido: { min_support: 1 } } } },
      styles: {},
    };
    expect(() => assertValidV4CoverageManifest(planted)).toThrow(V4GroundTruthError);
  });

  it("fail-closed: a non-positive distinct-case floor is rejected", () => {
    const planted = {
      schema_version: 1,
      types: { NOMBRE: { min_distinct_cases: 0, slices: { patient: { min_support: 1 } } } },
      styles: {},
    };
    expect(() => assertValidV4CoverageManifest(planted)).toThrow(V4GroundTruthError);
  });

  it("fail-closed: a non-positive slice or style minimum is rejected", () => {
    const badSlice = {
      schema_version: 1,
      types: { NOMBRE: { min_distinct_cases: 2, slices: { patient: { min_support: 0 } } } },
      styles: {},
    };
    expect(() => assertValidV4CoverageManifest(badSlice)).toThrow(V4GroundTruthError);
    const badStyle = {
      schema_version: 1,
      types: { NOMBRE: { min_distinct_cases: 2, slices: { patient: { min_support: 1 } } } },
      styles: { accents: { min_support: -1 } },
    };
    expect(() => assertValidV4CoverageManifest(badStyle)).toThrow(V4GroundTruthError);
  });

  it("fail-closed: an unknown style in the manifest is rejected", () => {
    const planted = {
      schema_version: 1,
      types: { NOMBRE: { min_distinct_cases: 2, slices: { patient: { min_support: 1 } } } },
      styles: { emojis: { min_support: 1 } },
    };
    expect(() => assertValidV4CoverageManifest(planted)).toThrow(V4GroundTruthError);
  });

  it("fail-closed: a case with an unknown style slice is rejected, not ignored", () => {
    const planted: GroundTruthCase = {
      schema_version: 1,
      corpus_version: corpus.manifest.corpus_version,
      case_id: "v4-planted-unknown-style",
      tier: "core",
      style_slices: ["emojis"],
      text: "Paciente de 52 años.",
      annotations: [
        { label: "MUST_REMOVE", entity_type: "EDAD", value: "52 años", slice: "adult" },
      ],
    };
    expect(() => evaluate([planted])).toThrow(V4GroundTruthError);
    try {
      evaluate([planted]);
    } catch (error) {
      expect((error as V4GroundTruthError).code).toBe("invalid-corpus");
    }
  });

  it("fail-closed: an annotation with an undisclosed slice is rejected, not ignored", () => {
    const planted: GroundTruthCase = {
      schema_version: 1,
      corpus_version: corpus.manifest.corpus_version,
      case_id: "v4-planted-unknown-slice",
      tier: "core",
      text: "Paciente de 52 años.",
      annotations: [
        { label: "MUST_REMOVE", entity_type: "EDAD", value: "52 años", slice: "apellido" },
      ],
    };
    expect(() => evaluate([planted])).toThrow(V4GroundTruthError);
    try {
      evaluate([planted]);
    } catch (error) {
      expect((error as V4GroundTruthError).code).toBe("invalid-corpus");
    }
  });

  it("exposes machine-visible support by top-level type and declared slice", () => {
    const report = evaluate(corpus.cases);
    expect(report.coverage.types.EDAD.support).toBeGreaterThan(0);
    expect(report.coverage.types.EDAD.distinct_cases).toBeGreaterThan(0);
    // No committed annotation declares a slice yet (WU-B's job): support for
    // every declared slice is zero and is reported, not silently omitted.
    expect(report.coverage.types.EDAD.slices.adult.support).toBe(0);
    expect(report.coverage.types.NOMBRE.slices.patient.min_support).toBe(1);
    expect(report.coverage.styles.accents.case_count).toBe(0);
    // F1 is derived from the reused precision/recall without touching the
    // shared metric definitions.
    expect(report.f1.overall).toBe(1);
    expect(report.f1.per_type.EDAD).toBe(1);
  });

  /**
   * INTERIM (REC-01 WU-A → WU-B): the committed corpus cannot yet satisfy the
   * declared coverage contract. This pins the exact red state so WU-B can flip
   * it to `failures: [] / pass: true`; the gate/metrics/slice-support
   * assertions above are unaffected. Delete the failure-list equality only
   * when the expanded corpus genuinely supports every declared unit.
   */
  it("INTERIM — the committed corpus fails closed on the declared coverage contract", () => {
    const report = evaluate(corpus.cases);
    // Threshold + golden dimensions remain green...
    expect(report.gate.pass).toBe(true);
    expect(report.golden_failures).toEqual([]);
    // ...but the report-level pass is false because coverage is red.
    expect(report.coverage.pass).toBe(false);
    expect(report.pass).toBe(false);

    const manifest = JSON.parse(fs.readFileSync(V4_COVERAGE_PATH, "utf8")) as V4CoverageManifest;
    const expectedKeys = [
      // Every declared slice is unsupported today, so every declared unit is
      // an exact zero-support failure.
      ...Object.entries(manifest.types).flatMap(([type, requirement]) =>
        Object.keys(requirement.slices).map((slice) => `${type}:${slice}`)
      ),
      ...Object.keys(manifest.styles).map((style) => `style:${style}`),
      // These four top-level types are still represented by a single case and
      // fail the declared distinct-case floor (QA-001 sparsity); IDENTIFICADOR
      // (cases 007+008) and EDAD (many cases) clear the floor.
      "NOMBRE:min_distinct_cases",
      "FECHA:min_distinct_cases",
      "UBICACION:min_distinct_cases",
      "SOSPECHOSO:min_distinct_cases",
    ].sort();
    expect(report.coverage.failures.map((failure) => failure.key).sort()).toEqual(expectedKeys);
    // Guard against coverage silently disappearing: representative declared
    // units must still be reported as failures.
    expect(report.coverage.failures.map((failure) => failure.key)).toEqual(
      expect.arrayContaining([
        "NOMBRE:patient",
        "IDENTIFICADOR:dni",
        "FECHA:numeric",
        "UBICACION:dictionary_city",
        "SOSPECHOSO:profession",
        "EDAD:adult",
        "style:accents",
      ])
    );
  });

  it("FALSATION — removing a required slice's support turns the coverage oracle red", () => {
    // A minimal, deliberately-green fixture: two EDAD cases that satisfy the
    // gate thresholds, the distinct-case floor and both required slices.
    const edadCoverage: V4CoverageManifest = {
      schema_version: 1,
      types: {
        EDAD: {
          min_distinct_cases: 2,
          slices: { adult: { min_support: 1 }, pediatric: { min_support: 1 } },
        },
      },
      styles: {},
    };
    const edadConfig: V4GateConfig = {
      schema_version: 1,
      gate: {
        overall: { min_precision: 1, min_recall: 1, max_fnr: 0 },
        per_type: { EDAD: { min_precision: 1, min_recall: 1, max_fnr: 0 } },
      },
    };
    const green: readonly GroundTruthCase[] = [
      {
        schema_version: 1,
        corpus_version: corpus.manifest.corpus_version,
        case_id: "v4-coverage-adult",
        tier: "core",
        text: "Paciente de 52 años.",
        annotations: [
          {
            label: "MUST_REMOVE",
            entity_type: "EDAD",
            value: "52 años",
            slice: "adult",
            expectedTransformed: "50–59 años",
          },
        ],
      },
      {
        schema_version: 1,
        corpus_version: corpus.manifest.corpus_version,
        case_id: "v4-coverage-pediatric",
        tier: "core",
        text: "Lactante de 8 meses con fiebre.",
        annotations: [
          {
            label: "MUST_REMOVE",
            entity_type: "EDAD",
            value: "8 meses",
            slice: "pediatric",
            expectedTransformed: "<1 año",
          },
        ],
      },
    ];
    const passing = evaluate(green, edadConfig, edadCoverage);
    expect(passing.coverage.failures).toEqual([]);
    expect(passing.coverage.pass).toBe(true);
    expect(passing.pass).toBe(true);

    // Plant the removal: the pediatric annotation's slice moves away, so the
    // required `EDAD:pediatric` unit loses all support while the detection
    // itself (and therefore the gate) stays green.
    const planted = green.map((testCase) =>
      testCase.case_id === "v4-coverage-pediatric"
        ? {
            ...testCase,
            annotations: testCase.annotations.map((annotation) => ({
              ...annotation,
              slice: "adult",
            })),
          }
        : testCase
    );
    const failing = evaluate(planted, edadConfig, edadCoverage);
    expect(failing.gate.pass).toBe(true);
    expect(failing.coverage.failures.map((failure) => failure.key)).toEqual(["EDAD:pediatric"]);
    expect(failing.coverage.pass).toBe(false);
    expect(failing.pass).toBe(false);
  });
});
