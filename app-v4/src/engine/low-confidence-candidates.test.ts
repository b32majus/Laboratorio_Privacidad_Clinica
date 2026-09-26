import { afterEach, describe, expect, it } from "vitest";

import { AsignadorSustitutos } from "../../../js/core/managers/AsignadorSustitutos.js";
import { FechasManager } from "../../../js/core/managers/FechasManager.js";
import { UbicacionesManager } from "../../../js/core/managers/UbicacionesManager.js";
import {
  filterReportableCandidates,
  LegacyRecognizerAdapter,
  LEGACY_RECOGNIZER_KEY,
  readCandidateReason,
} from "./legacy-recognizers";
import { PolicyError } from "./policy";
import { createRegistryEngine } from "./registry-engine";
import {
  type CandidateRecognizer,
  isCandidateRecognizer,
  type RecognitionResult,
  type Recognizer,
  type RecognizerCandidate,
  type RecognizerObservation,
  RecognizerRegistry,
} from "./recognizer-registry";
import type { ProcessingContext } from "./types";

/**
 * T14 #18 WU-A — low-confidence candidate review queue.
 *
 * Oracles for the explicit below-threshold candidate contract (DEBT_REGISTER
 * ARCH-012). All fixtures are synthetic clinical-style strings built from the
 * legacy dictionary vocabulary; no real content is used anywhere.
 *
 * The fixtures below are chosen from the legacy detectors' real output. A
 * read-only probe of the real pipeline (with the V4 setup) observed exactly
 * TWO genuinely below-threshold detections, both `NOMBRE`:
 *
 *   - "Fisioterapeuta Nélida Otxoa realizó": the legacy professional detector
 *     captures trailing lowercase words too, so this span scores 0.45 — below
 *     the `standard` threshold 0.5 — with subtype `profesional` and reason
 *     `REVISION_MANUAL`. `Nélida`/`Otxoa` are absent from every dictionary
 *     (verified against js/data), so no dictionary bonus rescues it.
 *   - "Mª Carmen Ruiz Gil": subtype `paciente`, confidence 0.35 (also below
 *     0.5), reason `NO_ANONIMIZAR`.
 *
 * Only these verified facts are claimed: `NOMBRE` is the ONLY real
 * below-threshold type in this brownfield pipeline — every quasi-identifier
 * detector seeds confidence >= 0.75, scoring/heuristics never lower a
 * non-NOMBRE entity, and scoring preserves non-NOMBRE confidence — while
 * within `NOMBRE` more than one subtype and more than one reason string
 * occur, so the candidate contract is exercised against more than one shape.
 */

const FRESH: ProcessingContext = Object.freeze({ mode: "fresh" });

/** Single-category below-threshold fixture: exactly one NOMBRE candidate. */
const BELOW_THRESHOLD_TEXT = "Fisioterapeuta Nélida Otxoa realizó la sesión de rehabilitación.";

/**
 * Second real below-threshold NOMBRE shape: subtype `paciente`, confidence
 * 0.35, reason `NO_ANONIMIZAR` (the other observed reason string).
 */
const PACIENTE_BELOW_THRESHOLD_TEXT = "Mª Carmen Ruiz Gil firmó el consentimiento.";

/** Real fixtures producing at least one below-threshold candidate each. */
const CANDIDATE_FIXTURES: readonly string[] = [
  "Nombre: Carmen Sánchez\nFisioterapeuta Nélida Otxoa realizó la sesión de rehabilitación.",
  "La paciente Lucía Ruiz acudió el 12/03/2024. Fisioterapeuta Nélida Otxoa realizó la sesión.",
  "Contacto: 612345678. Auxiliar Nélida Otxoa realizó la valoración.",
  "Se derivó al Hospital Virgen del Rocío desde Sevilla. Técnico Nélida Otxoa realizó la valoración.",
  "Familiar: Rosa Martínez. Matrona Águeda Quirós atendió el parto.",
  "La paciente tiene 45 años. Auxiliar Nélida Otxoa realizó la valoración.",
];

/** Falsifiable offset check: the candidate must map back to the source slice. */
function hasValidOffsets(
  source: string,
  candidate: { readonly start: number; readonly end: number; readonly text: string }
): boolean {
  return (
    Number.isInteger(candidate.start) &&
    Number.isInteger(candidate.end) &&
    candidate.start >= 0 &&
    candidate.end >= candidate.start &&
    candidate.end <= source.length &&
    source.slice(candidate.start, candidate.end) === candidate.text
  );
}

function spansOverlap(
  a: { readonly start: number; readonly end: number },
  b: { readonly start: number; readonly end: number }
): boolean {
  return a.start < b.end && b.start < a.end;
}

function observation(
  type: string,
  source: string,
  needle: string,
  options: { readonly subtype?: string; readonly confidence?: number } = {}
): RecognizerObservation {
  const start = source.indexOf(needle);
  if (start < 0) throw new Error(`fixture is missing "${needle}" in ${JSON.stringify(source)}`);
  return Object.freeze({
    type,
    ...(options.subtype === undefined ? {} : { subtype: options.subtype }),
    start,
    end: start + needle.length,
    text: needle,
    original: needle,
    confidence: options.confidence ?? 0.9,
  });
}

function candidate(
  type: string,
  source: string,
  needle: string,
  options: {
    readonly subtype?: string;
    readonly confidence?: number;
    readonly reason?: string;
  } = {}
): RecognizerCandidate {
  const start = source.indexOf(needle);
  if (start < 0) throw new Error(`fixture is missing "${needle}" in ${JSON.stringify(source)}`);
  return Object.freeze({
    type,
    ...(options.subtype === undefined ? {} : { subtype: options.subtype }),
    start,
    end: start + needle.length,
    text: needle,
    original: needle,
    confidence: options.confidence ?? 0.4,
    reason: options.reason ?? "BAJO_SCORE",
  });
}

/**
 * Test double: a candidate-capable recognizer under the legacy key. Its
 * `observe` deliberately throws, so the oracle also proves the engine calls
 * `recognize` exactly once instead of falling back to `observe`.
 */
function candidateRegistry(build: (text: string) => RecognitionResult): RecognizerRegistry {
  const registry = new RecognizerRegistry();
  const double: Recognizer & CandidateRecognizer = {
    key: LEGACY_RECOGNIZER_KEY,
    observe(): readonly RecognizerObservation[] {
      throw new Error("the engine must call recognize() once on a candidate recognizer");
    },
    recognize(text: string): RecognitionResult {
      return build(text);
    },
  };
  registry.register(double);
  return registry;
}

/** Kept-pass observable projection (excludes per-call identity/timing fields). */
function behavioralProjection(result: {
  readonly original: string;
  readonly processed: string;
  readonly entities: readonly unknown[];
  readonly alerts: readonly unknown[];
  readonly stats: unknown;
  readonly scoring?: Record<string, unknown>;
}) {
  return {
    original: result.original,
    processed: result.processed,
    entities: result.entities,
    alerts: result.alerts,
    stats: result.stats,
    scoring: result.scoring,
  };
}

afterEach(() => {
  AsignadorSustitutos.reset();
  UbicacionesManager.reset();
  FechasManager.reset();
});

describe("T14 WU-A — below-threshold candidates are visible (ORACLE 1)", () => {
  it("reports as a candidate the below-threshold NOMBRE detection observe() drops", () => {
    const adapter = new LegacyRecognizerAdapter();
    const observations = adapter.observe(BELOW_THRESHOLD_TEXT);
    const result = adapter.recognize(BELOW_THRESHOLD_TEXT);

    // The legacy threshold filter really dropped it: no survivor at all.
    expect(observations).toEqual([]);
    expect(result.observations).toEqual(observations);
    expect(result.candidates).toHaveLength(1);

    const candidate = result.candidates[0];
    expect(candidate.type).toBe("NOMBRE");
    expect(candidate.subtype).toBe("profesional");
    expect(candidate.text).toBe("Fisioterapeuta Nélida Otxoa realizó");
    // Observed below-threshold confidence (scoring + heuristics): 0.45 < 0.5.
    expect(candidate.confidence).toBeCloseTo(0.45, 10);
    expect(candidate.confidence).toBeLessThan(0.5);
    // Legacy reason: the scoring recommendation is carried verbatim.
    expect(candidate.reason).toBe("REVISION_MANUAL");
  });

  it("reports the other real below-threshold NOMBRE shape (paciente, NO_ANONIMIZAR)", () => {
    const adapter = new LegacyRecognizerAdapter();
    const result = adapter.recognize(PACIENTE_BELOW_THRESHOLD_TEXT);

    const candidate = result.candidates.find((item) => item.text === "Mª Carmen Ruiz Gil");
    if (candidate === undefined) {
      throw new Error("the real pipeline did not report the paciente below-threshold candidate");
    }
    expect(candidate.type).toBe("NOMBRE");
    expect(candidate.subtype).toBe("paciente");
    expect(candidate.confidence).toBeCloseTo(0.35, 10);
    expect(candidate.confidence).toBeLessThan(0.5);
    expect(candidate.reason).toBe("NO_ANONIMIZAR");
    expect(hasValidOffsets(PACIENTE_BELOW_THRESHOLD_TEXT, candidate)).toBe(true);
    expect(PACIENTE_BELOW_THRESHOLD_TEXT.slice(candidate.start, candidate.end)).toBe(
      "Mª Carmen Ruiz Gil"
    );
  });

  it("exposes the capability through the candidate recognizer contract", () => {
    const adapter: Recognizer = new LegacyRecognizerAdapter();
    expect(isCandidateRecognizer(adapter)).toBe(true);
    expect(isCandidateRecognizer({ key: "plain", observe: () => [] })).toBe(false);
  });
});

describe("T14 WU-A — offset integrity (ORACLE 2)", () => {
  it("every reported candidate maps back to its exact immutable source slice", () => {
    let checked = 0;
    for (const text of CANDIDATE_FIXTURES) {
      const { candidates } = new LegacyRecognizerAdapter().recognize(text);
      expect(candidates.length).toBeGreaterThan(0);
      for (const candidate of candidates) {
        expect(hasValidOffsets(text, candidate)).toBe(true);
        expect(0).toBeLessThanOrEqual(candidate.start);
        expect(candidate.start).toBeLessThanOrEqual(candidate.end);
        expect(candidate.end).toBeLessThanOrEqual(text.length);
        checked += 1;
      }
    }
    expect(checked).toBeGreaterThanOrEqual(CANDIDATE_FIXTURES.length);
  });

  it("can disagree: the same check rejects a hand-built candidate with wrong offsets", () => {
    const text = "Fisioterapeuta Nélida Otxoa realizó la sesión.";
    const correct = candidate("NOMBRE", text, "Fisioterapeuta Nélida Otxoa realizó", {
      subtype: "profesional",
    });
    const wrongShifted = { ...correct, text: "Nélida Otxoa" };
    const wrongOutOfBounds = { ...correct, start: 0, end: text.length + 5 };
    const wrongReversed = { ...correct, start: correct.end, end: correct.start };

    expect(hasValidOffsets(text, correct)).toBe(true);
    expect(hasValidOffsets(text, wrongShifted)).toBe(false);
    expect(hasValidOffsets(text, wrongOutOfBounds)).toBe(false);
    expect(hasValidOffsets(text, wrongReversed)).toBe(false);
  });
});

describe("T14 WU-A — no loss / no duplication (ORACLE 3)", () => {
  it("recognize() keeps the exact observe() survivors for the same text", () => {
    for (const text of CANDIDATE_FIXTURES) {
      const adapter = new LegacyRecognizerAdapter();
      expect(adapter.recognize(text).observations).toEqual(adapter.observe(text));
    }
  });

  it("kept observations and candidates never share a span", () => {
    for (const text of CANDIDATE_FIXTURES) {
      const { observations, candidates } = new LegacyRecognizerAdapter().recognize(text);
      expect(candidates.length).toBeGreaterThan(0);
      for (const kept of observations) {
        for (const candidate of candidates) {
          expect(spansOverlap(kept, candidate)).toBe(false);
        }
      }
    }
  });
});

describe("T14 WU-A — deterministic non-overlap (ORACLE 4)", () => {
  it("no candidate overlaps any kept observation and no two candidates overlap", () => {
    for (const text of CANDIDATE_FIXTURES) {
      const { observations, candidates } = new LegacyRecognizerAdapter().recognize(text);
      for (const candidate of candidates) {
        for (const kept of observations) {
          expect(spansOverlap(kept, candidate)).toBe(false);
        }
      }
      for (let i = 0; i < candidates.length; i += 1) {
        for (let j = i + 1; j < candidates.length; j += 1) {
          expect(spansOverlap(candidates[i], candidates[j])).toBe(false);
        }
      }
    }
  });

  it("is deterministic and frozen across calls", () => {
    const adapter = new LegacyRecognizerAdapter();
    const first = adapter.recognize(CANDIDATE_FIXTURES[0]);
    const second = adapter.recognize(CANDIDATE_FIXTURES[0]);
    expect(second).toEqual(first);
    expect(Object.isFrozen(first.candidates)).toBe(true);
    expect(Object.isFrozen(first.observations)).toBe(true);
    for (const candidate of first.candidates) {
      expect(Object.isFrozen(candidate)).toBe(true);
      expect(() => JSON.stringify(candidate)).not.toThrow();
      expect(JSON.parse(JSON.stringify(candidate))).toEqual(candidate);
    }
  });

  it("rule (a): drops a candidate overlapping a kept observation (falsifiable)", () => {
    const kept = [observation("NOMBRE", "....", "....")];
    const overlapping = Object.freeze({
      type: "NOMBRE",
      start: 1,
      end: 3,
      text: "..",
      confidence: 0.4,
      reason: "BAJO_SCORE",
    });
    const disjoint = Object.freeze({
      type: "NOMBRE",
      start: 10,
      end: 12,
      text: "..",
      confidence: 0.4,
      reason: "BAJO_SCORE",
    });
    expect(
      filterReportableCandidates([overlapping, disjoint], kept).map((item) => item.start)
    ).toEqual([10]);
  });

  it("rule (b): residual candidate/candidate overlap resolves by conflict priority", () => {
    const longer = Object.freeze({
      type: "NOMBRE",
      start: 5,
      end: 20,
      text: "x".repeat(15),
      confidence: 0.4,
      reason: "BAJO_SCORE",
    });
    const shorter = Object.freeze({
      type: "NOMBRE",
      start: 0,
      end: 8,
      text: "x".repeat(8),
      confidence: 0.4,
      reason: "BAJO_SCORE",
    });
    // Longer span first, even though it starts later.
    expect(filterReportableCandidates([shorter, longer], []).map((item) => item.end)).toEqual([20]);
    // Length tie -> earlier start wins.
    const earlier = Object.freeze({
      type: "NOMBRE",
      start: 0,
      end: 5,
      text: "x".repeat(5),
      confidence: 0.4,
      reason: "BAJO_SCORE",
    });
    const later = Object.freeze({
      type: "NOMBRE",
      start: 3,
      end: 8,
      text: "x".repeat(5),
      confidence: 0.4,
      reason: "BAJO_SCORE",
    });
    expect(filterReportableCandidates([later, earlier], []).map((item) => item.start)).toEqual([0]);
  });

  it("mirrors the legacy razon rule, including the BAJO_SCORE fallback", () => {
    expect(readCandidateReason({ scoring: { recomendacion: "REVISION_MANUAL" } })).toBe(
      "REVISION_MANUAL"
    );
    expect(readCandidateReason({ scoring: { recomendacion: "" } })).toBe("BAJO_SCORE");
    expect(readCandidateReason({ scoring: {} })).toBe("BAJO_SCORE");
    expect(readCandidateReason({ scoring: { recomendacion: 42 } })).toBe("BAJO_SCORE");
    expect(readCandidateReason({})).toBe("BAJO_SCORE");
    expect(readCandidateReason(undefined)).toBe("BAJO_SCORE");
  });
});

describe("T14 WU-A — accepted policy outcome for a candidate (ORACLE 5)", () => {
  it("resolves `proposed` through the accepted standard policy operator", () => {
    const engine = createRegistryEngine();
    const outcome = engine.process({ text: BELOW_THRESHOLD_TEXT, context: FRESH });

    expect(outcome.result.candidates).toHaveLength(1);
    const proposed = outcome.result.candidates?.[0];
    expect(proposed?.type).toBe("NOMBRE");
    expect(proposed?.subtype).toBe("profesional");
    expect(proposed?.reason).toBe("REVISION_MANUAL");
    expect(proposed?.position).toEqual({
      start: BELOW_THRESHOLD_TEXT.indexOf("Fisioterapeuta"),
      end:
        BELOW_THRESHOLD_TEXT.indexOf("Fisioterapeuta") +
        "Fisioterapeuta Nélida Otxoa realizó".length,
    });
    // NOMBRE -> legacy.pseudonymize -> professional pseudonym (first one).
    expect(proposed?.proposed).toBe("Profesional Sanitario 1");
  });

  it("never applies the candidate outcome to processed text, entities, stats or scoring", () => {
    const engine = createRegistryEngine();
    const outcome = engine.process({ text: BELOW_THRESHOLD_TEXT, context: FRESH });

    expect(outcome.result.entities).toEqual([]);
    expect(outcome.result.processed).toBe(BELOW_THRESHOLD_TEXT);
    expect(outcome.result.processed).not.toContain("Profesional Sanitario");
    expect(outcome.result.stats.totalEntities).toBe(0);
    expect(outcome.result.stats.byType.nombres).toBe(0);
    // The explicit contract replaces the legacy `descartadas` detail: the
    // scoring shape is not reproduced.
    expect(outcome.result.scoring).not.toHaveProperty("descartadas");
    expect(outcome.result.scoring).not.toHaveProperty("entidadesDescartadas");
  });

  it("resolves the candidate outcome through the strict profile too", () => {
    const engine = createRegistryEngine();
    const outcome = engine.process({
      text: BELOW_THRESHOLD_TEXT,
      context: FRESH,
      policyId: "strict",
    });
    expect(outcome.result.candidates?.[0].proposed).toBe("Profesional Sanitario 1");
  });
});

describe("T14 WU-A — candidate-pass state isolation (ORACLE 6)", () => {
  const ISO_TEXT = "Contacto: 612345678. Ana Torres acudió a la revisión.";

  const ISO_OBSERVATIONS: readonly RecognizerObservation[] = [
    observation("IDENTIFICADOR", ISO_TEXT, "612345678", {
      subtype: "telefono",
      confidence: 0.95,
    }),
  ];
  const ISO_CANDIDATE = candidate("NOMBRE", ISO_TEXT, "Ana Torres", {
    subtype: "profesional",
    confidence: 0.4,
  });

  function engineWith(candidates: readonly RecognizerCandidate[]) {
    return createRegistryEngine({
      recognizerRegistry: candidateRegistry(() => ({
        observations: ISO_OBSERVATIONS,
        candidates,
      })),
    });
  }

  it("keeps entities/processed/stats/scoring/context identical and only candidates differs", () => {
    const withCandidate = engineWith([ISO_CANDIDATE]).process({
      text: ISO_TEXT,
      context: FRESH,
    });
    // The candidate pass really grew the module pseudonym manager: the name
    // the candidate covers is now mapped. The returned context must not see
    // it. Checked BEFORE the control run, whose own resets clear the maps.
    expect(AsignadorSustitutos.profesionalesMap.has("ana torres")).toBe(true);
    expect(withCandidate.context.pseudonymState?.contadorProfesionales).toBe(0);
    expect(withCandidate.context.pseudonymState?.profesionales).toEqual([]);

    const withoutCandidate = engineWith([]).process({ text: ISO_TEXT, context: FRESH });

    expect(withCandidate.result.entities).toEqual(withoutCandidate.result.entities);
    expect(withCandidate.result.processed).toBe(withoutCandidate.result.processed);
    expect(withCandidate.result.stats).toEqual(withoutCandidate.result.stats);
    expect(withCandidate.result.scoring).toEqual(withoutCandidate.result.scoring);
    expect(withCandidate.context).toEqual(withoutCandidate.context);
    expect(behavioralProjection(withCandidate.result)).toEqual(
      behavioralProjection(withoutCandidate.result)
    );

    expect(withCandidate.result.candidates).toHaveLength(1);
    expect(withCandidate.result.candidates?.[0].proposed).toBe("Profesional Sanitario 1");
    expect(withoutCandidate.result.candidates).toEqual([]);
  });

  it("keeps a shared two-document sequence's second kept output and final pseudonymState unchanged", () => {
    const DOC_A = "Contacto: 612345678. Ana Torres acudió a la revisión.";
    // The second document carries its OWN below-threshold candidate whose text
    // is neither kept by the kept pass nor already present in the shared
    // authoritative state. That makes the second document's context
    // discriminating too: if the candidate pass ran BEFORE the context
    // resolution, the reconciliation would pick up this fresh key/value and
    // leak a spurious entry into the returned `pseudonymState`.
    const DOC_B = "Informe de Ana Torres. Beatriz Santos firmó. Teléfono 612345678.";
    const DOC_B_CANDIDATE_TEXT = "Beatriz Santos";
    const DOC_B_CANDIDATE_KEY = "beatriz santos";

    function build(text: string): RecognitionResult {
      if (text === DOC_A) {
        return {
          observations: [observation("IDENTIFICADOR", text, "612345678")],
          candidates: [candidate("NOMBRE", text, "Ana Torres", { subtype: "profesional" })],
        };
      }
      return {
        observations: [
          observation("IDENTIFICADOR", text, "612345678"),
          observation("NOMBRE", text, "Ana Torres", { subtype: "profesional", confidence: 0.9 }),
        ],
        candidates: [
          candidate("NOMBRE", text, DOC_B_CANDIDATE_TEXT, {
            subtype: "profesional",
            confidence: 0.4,
          }),
        ],
      };
    }

    function run(includeCandidate: boolean) {
      const engine = createRegistryEngine({
        recognizerRegistry: candidateRegistry((text) => {
          const result = build(text);
          return includeCandidate ? result : { ...result, candidates: [] };
        }),
      });
      const first = engine.process({ text: DOC_A, context: { mode: "shared" } });
      const second = engine.process({
        text: DOC_B,
        context: { mode: "shared", pseudonymState: first.context.pseudonymState },
      });
      return { first, second };
    }

    const withCandidate = run(true);
    // The second document's candidate pass really grew the module professional
    // map (checked BEFORE the control run, whose own resets clear it): the
    // fresh candidate is now assigned the SECOND professional pseudonym, so a
    // leak is observable as a second authoritative entry. Checked here because
    // the control run below resets the module maps.
    expect(AsignadorSustitutos.profesionalesMap.get(DOC_B_CANDIDATE_KEY)).toBe(
      "Profesional Sanitario 2"
    );

    const withoutCandidate = run(false);

    expect(withCandidate.first.context).toEqual(withoutCandidate.first.context);
    // Second document: kept output and the final pseudonymState stay the same.
    expect(behavioralProjection(withCandidate.second.result)).toEqual(
      behavioralProjection(withoutCandidate.second.result)
    );
    expect(withCandidate.second.context.pseudonymState).toEqual(
      withoutCandidate.second.context.pseudonymState
    );
    expect(withCandidate.second.result.processed).toBe(withoutCandidate.second.result.processed);

    // Concrete leak oracle for the SECOND document (not just a deep-equal):
    // the returned authoritative maps/counters must NOT contain the candidate's
    // own fresh key. A mutation that runs the candidate pass before the context
    // resolution leaks `[DOC_B_CANDIDATE_KEY, "Profesional Sanitario 2"]` and
    // increments `contadorProfesionales` to 2; these assertions name exactly
    // that leaked entry instead of merely reporting a whole-object mismatch.
    const secondState = withCandidate.second.context.pseudonymState;
    expect(secondState?.profesionales).toEqual([["ana torres", "Profesional Sanitario 1"]]);
    expect(secondState?.profesionales?.some(([key]) => key === DOC_B_CANDIDATE_KEY)).toBe(false);
    expect(secondState?.contadorProfesionales).toBe(1);
    expect(secondState?.contadorFamiliares).toBe(0);

    // The injected candidate exists in document B (and in document A); the
    // control run strips both.
    expect(withCandidate.first.result.candidates).toHaveLength(1);
    expect(withCandidate.second.result.candidates).toHaveLength(1);
    expect(withCandidate.second.result.candidates?.[0].text).toBe(DOC_B_CANDIDATE_TEXT);
    expect(withoutCandidate.second.result.candidates).toEqual([]);
  });
});

describe("T14 WU-A — fail-closed candidate policy mapping (ORACLE 7)", () => {
  const TEXT = "Dato sin categoria reconocida.";

  it("raises the typed PolicyError for a candidate whose type the profile does not map", () => {
    const engine = createRegistryEngine({
      recognizerRegistry: candidateRegistry(() => ({
        observations: [],
        candidates: [candidate("DESCONOCIDO", TEXT, "Dato", { reason: "BAJO_SCORE" })],
      })),
    });
    try {
      engine.process({ text: TEXT, context: FRESH });
      throw new Error("expected engine.process to throw");
    } catch (error) {
      expect(error).toBeInstanceOf(PolicyError);
      expect((error as PolicyError).code).toBe("policy-operator-mapping-unavailable");
    }
  });

  it("treats a recognizer without recognize() as having an explicit empty candidate set", () => {
    const text = "Contacto: 612345678.";
    const registry = new RecognizerRegistry();
    registry.register({
      key: LEGACY_RECOGNIZER_KEY,
      observe: () => [observation("IDENTIFICADOR", text, "612345678", { subtype: "telefono" })],
    });
    const engine = createRegistryEngine({ recognizerRegistry: registry });
    const outcome = engine.process({ text, context: FRESH });
    expect(outcome.result.entities).toHaveLength(1);
    expect(outcome.result.candidates).toEqual([]);
  });

  it("threads the explicit FECHA date role into the candidate's policy outcome", () => {
    // No real detector produces a below-threshold FECHA candidate (every date
    // confidence is >= 0.78), so the date-role branch is exercised through a
    // labelled double. The explicit birth role must redact the span, exactly
    // as the kept pass does — proving the candidate pass threads the same
    // date sub-context.
    const text = "Fecha de nacimiento: 12/03/1954.";
    const engine = createRegistryEngine({
      recognizerRegistry: candidateRegistry(() => ({
        observations: [],
        candidates: [candidate("FECHA", text, "12/03/1954", { subtype: "fecha_completa" })],
      })),
    });
    const outcome = engine.process({ text, context: FRESH });
    expect(outcome.result.candidates?.[0].proposed).toBe("");
  });
});
