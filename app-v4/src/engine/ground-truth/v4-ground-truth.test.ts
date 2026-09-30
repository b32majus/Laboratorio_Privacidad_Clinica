import { describe, expect, it } from "vitest";

import { RECOGNIZER_CATEGORIES } from "../recognizer-registry";
import { createRegistryEngine } from "../registry-engine";
import {
  evaluateV4GroundTruth,
  loadV4Corpus,
  loadV4GateConfig,
  V4_CORPUS_DIR,
  V4_GATE_CONFIG_PATH,
  V4GroundTruthError,
  type GroundTruthCase,
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
const engine = createRegistryEngine();

function evaluate(cases: readonly GroundTruthCase[]) {
  return evaluateV4GroundTruth(
    { corpusVersion: corpus.manifest.corpus_version, cases },
    engine,
    config
  );
}

describe("V4 ground-truth gate (FUNC-008 + QA-001)", () => {
  it("passes the committed corpus with exact AGE bands and spans", () => {
    const report = evaluate(corpus.cases);
    if (!report.pass) {
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
    expect(report.pass).toBe(true);
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
    expect(report.pass).toBe(true);
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
        incomplete
      )
    ).toThrow(V4GroundTruthError);
  });
});
