import { afterEach, describe, expect, it } from "vitest";

import { AsignadorSustitutos } from "../../../js/core/managers/AsignadorSustitutos.js";
import { PrivacyProcessor } from "../../../js/modular-processor.js";
import { LEGACY_RECOGNIZER_KEY } from "./legacy-recognizers";
import {
  type CandidateRecognizer,
  type RecognitionResult,
  type Recognizer,
  type RecognizerCandidate,
  type RecognizerObservation,
  RecognizerRegistry,
} from "./recognizer-registry";
import { createRegistryEngine } from "./registry-engine";
import { type LegacyProcessorResult, type ProcessingContext } from "./types";

/**
 * T16 #20 WU-B — composed-engine, product-surface and state-isolation oracles
 * for deterministic, gender-free patient pseudonyms
 * (SPEC_V4_PRIVACY_ENGINE.md §12; GitHub #20 acceptance 1–4).
 *
 * WU-A proved the single generation authority (`AsignadorSustitutos`) and the
 * single legacy engine. This file proves the SAME behavior where the product
 * actually runs it:
 *
 *  1. the registry-composed engine (`createRegistryEngine`) in `fresh` and
 *     `shared` modes, including a multi-document batch;
 *  2. the direct legacy `Processor.process` path loaded by the legacy HTML
 *     pages (PRODUCT-002 must be fixed there too, not only in V4);
 *  3. the T14 acceptance-3 state-isolation property, now for the patient
 *     counter: a below-threshold patient candidate may grow the module map but
 *     must never reach the returned context.
 *
 * Every `processed` string that is the point of an assertion is pinned to its
 * EXACT final text (never `toContain`) and the structural properties are also
 * asserted separately, so an oracle never depends on the implementation's own
 * output being "correct". All fixtures are synthetic clinical-style strings
 * built from the legacy dictionary vocabulary; no real content is used.
 *
 * Ordering note: patient numbering follows the engine's back-to-front
 * transformation pass (rightmost source span first), exactly like
 * `Profesional Sanitario N` / `Familiar N`. The exact index per identity is
 * asserted below instead of assuming reading order.
 */

const FRESH: ProcessingContext = Object.freeze({ mode: "fresh" });

/**
 * Two distinct identities the legacy heuristic infers as the SAME gender
 * (`Carmen Sánchez` / `Lucía Ruiz` — both inferred F by the retained
 * `detectarGenero`). Before T16 both collapsed to the identical
 * `Paciente Mujer` replacement.
 */
const TWO_PATIENTS_DOC =
  "Nombre: Carmen Sánchez\nLa paciente Lucía Ruiz acude a consulta de seguimiento.";

/** Batch document A: one patient (Carmen Sánchez) and one professional. */
const SHARED_A = "Nombre: Carmen Sánchez\nLa paciente fue atendida por el Dr. García López.";
/** Batch document B: the same patient plus a NEW patient, professional and family. */
const SHARED_B =
  "Nombre: Carmen Sánchez\nLa paciente Lucía Ruiz acude a consulta. El Dr. García López firmó el informe. Familiar: Rosa Martínez.";

/**
 * Operator/policy parity fixture: one patient plus a professional and a
 * familiar, and no date, so the whole `processed` text is deterministic.
 */
const OPERATOR_PARITY_DOC =
  "Nombre: Antonio Martínez\nAtendido por la Dra. Fernández. Familiar: Rosa Martínez acudió con él.";

/** Identity used by the injected below-threshold patient candidate. */
const ISOLATION_TEXT =
  "Nombre: Carmen Sánchez acudió a la revisión. Mª Carmen Ruiz Gil firmó el consentimiento.";
const ISOLATION_CANDIDATE_TEXT = "Mª Carmen Ruiz Gil";
const ISOLATION_CANDIDATE_KEY = "mª carmen ruiz gil";

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
 * `observe` deliberately throws so the oracle also proves the engine uses
 * the single `recognize` call instead of falling back to `observe`.
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

afterEach(() => {
  // Leave the shared legacy singleton clean for other suites.
  AsignadorSustitutos.reset();
});

describe("createRegistryEngine — composed patient pseudonyms (T16 WU-B)", () => {
  it("gives two distinct same-inferred-gender patients distinct, gender-free values in one document (acceptance 1/3)", () => {
    const engine = createRegistryEngine();
    const outcome = engine.process({ text: TWO_PATIENTS_DOC, context: FRESH });

    // EXACT composed text: the confirmed defect collapsed both inferred-F
    // identities to the identical "Paciente Mujer".
    expect(outcome.result.processed).toBe(
      "Nombre: Paciente 2\nLa paciente Paciente 1 acude a consulta de seguimiento."
    );

    // EXACT entities (ascending source order) with their subtype and value.
    expect(
      outcome.result.entities.map((entity) => ({
        type: entity.type,
        subtype: entity.subtype,
        text: entity.text,
        transformed: entity.transformed,
      }))
    ).toEqual([
      { type: "NOMBRE", subtype: "paciente", text: "Carmen Sánchez", transformed: "Paciente 2" },
      { type: "NOMBRE", subtype: "paciente", text: "Lucía Ruiz", transformed: "Paciente 1" },
    ]);

    // EXACT returned context.
    expect(outcome.context.pseudonymState).toEqual({
      asignaciones: [
        ["lucía ruiz", "Paciente 1"],
        ["carmen sánchez", "Paciente 2"],
      ],
      profesionales: [],
      familiares: [],
      contadorProfesionales: 0,
      contadorFamiliares: 0,
      contadorPacientes: 2,
    });

    // Structural properties independent of the implementation's output.
    const values = outcome.result.entities.map((entity) => entity.transformed);
    expect(new Set(values).size).toBe(2);
    for (const value of values) {
      expect(value).toMatch(/^Paciente \d+$/);
    }
    expect(outcome.result.processed).not.toMatch(/Mujer|Hombre/);
    expect(outcome.result.processed).not.toMatch(/Carmen|Sánchez|Lucía|Ruiz/i);

    // Explicit back-to-front ordering: the RIGHTMOST source span
    // ("Lucía Ruiz") receives index 1 and the left one ("Carmen Sánchez")
    // receives index 2 — not reading order.
    expect(TWO_PATIENTS_DOC.indexOf("Carmen Sánchez")).toBeLessThan(
      TWO_PATIENTS_DOC.indexOf("Lucía Ruiz")
    );
    expect(outcome.result.entities[0].transformed).toBe("Paciente 2");
    expect(outcome.result.entities[1].transformed).toBe("Paciente 1");
  });

  it("keeps the same identity stable and gives a new identity the NEXT context index in a shared batch (acceptance 2/4)", () => {
    const engine = createRegistryEngine();
    const first = engine.process({ text: SHARED_A, context: { mode: "shared" } });

    expect(first.result.processed).toBe(
      "Nombre: Paciente 1\nLa paciente fue atendida por el Profesional Sanitario 1."
    );
    expect(first.context.pseudonymState).toEqual({
      asignaciones: [["carmen sánchez", "Paciente 1"]],
      profesionales: [["garcía lópez", "Profesional Sanitario 1"]],
      familiares: [],
      contadorProfesionales: 1,
      contadorFamiliares: 0,
      contadorPacientes: 1,
    });

    const second = engine.process({
      text: SHARED_B,
      context: { mode: "shared", pseudonymState: first.context.pseudonymState },
    });

    // EXACT composed text of B: the returning patient keeps Paciente 1 and
    // the new patient takes the next index.
    expect(second.result.processed).toBe(
      "Nombre: Paciente 1\nLa paciente Paciente 2 acude a consulta. El Profesional Sanitario 1 el informe. Familiar: Familiar 1."
    );

    // EXACT returned asignaciones/contadorPacientes (and no interference with
    // the professional/family categories).
    expect(second.context.pseudonymState?.asignaciones).toEqual([
      ["carmen sánchez", "Paciente 1"],
      ["lucía ruiz", "Paciente 2"],
    ]);
    expect(second.context.pseudonymState?.contadorPacientes).toBe(2);
    expect(second.context.pseudonymState?.contadorProfesionales).toBe(1);
    expect(second.context.pseudonymState?.contadorFamiliares).toBe(1);

    // The new identity must NOT reuse a value already assigned in the context.
    const values = (second.context.pseudonymState?.asignaciones ?? []).map(([, value]) => value);
    expect(new Set(values).size).toBe(values.length);
    expect(values).toContain("Paciente 1");
    expect(values).toContain("Paciente 2");
  });

  it("is byte-identical when the same document is processed twice in fresh mode (acceptance 4)", () => {
    const engine = createRegistryEngine();
    const first = engine.process({ text: TWO_PATIENTS_DOC, context: FRESH });
    const second = engine.process({ text: TWO_PATIENTS_DOC, context: FRESH });

    expect(second.result.processed).toBe(first.result.processed);
    expect(second.result.entities.map((entity) => entity.transformed)).toEqual(
      first.result.entities.map((entity) => entity.transformed)
    );
    expect(second.context.pseudonymState).toEqual(first.context.pseudonymState);
    // Sanity: the run is non-vacuous (it really numbered two patients).
    expect(first.context.pseudonymState?.contadorPacientes).toBe(2);
  });

  it("keeps the professional and familiar branches at their accepted legacy values while patients number", () => {
    const engine = createRegistryEngine();
    const outcome = engine.process({ text: OPERATOR_PARITY_DOC, context: FRESH });

    // EXACT composed text: only the patient value changed (Profesional
    // Sanitario 1 / Familiar 1 are the accepted legacy values).
    expect(outcome.result.processed).toBe(
      "Nombre: Paciente 1\nAtendido por la Profesional Sanitario 1. Familiar: Familiar 1."
    );
    expect(
      outcome.result.entities.map((entity) => [entity.subtype, entity.text, entity.transformed])
    ).toEqual([
      ["paciente", "Antonio Martínez", "Paciente 1"],
      ["profesional", "Dra. Fernández", "Profesional Sanitario 1"],
      ["familiar", "Rosa Martínez acudió con él", "Familiar 1"],
    ]);
    expect(outcome.context.pseudonymState).toEqual({
      asignaciones: [["antonio martínez", "Paciente 1"]],
      profesionales: [["fernández", "Profesional Sanitario 1"]],
      familiares: [["rosa martínez acudió con él", "Familiar 1"]],
      contadorProfesionales: 1,
      contadorFamiliares: 1,
      contadorPacientes: 1,
    });
  });
});

describe("legacy product surface — direct Processor path (PRODUCT-002)", () => {
  it("numbers distinct patients on the direct legacy processor path too", () => {
    // The legacy HTML pages load this module directly (js/modular-processor.js
    // → js/core/processor.js), exactly like the T05 parity oracle's baseline.
    AsignadorSustitutos.reset();
    const result = PrivacyProcessor.process(TWO_PATIENTS_DOC) as LegacyProcessorResult;

    expect(result.processed).toBe(
      "Nombre: Paciente 2\nLa paciente Paciente 1 acude a consulta de seguimiento."
    );
    expect(result.entities.map((entity) => [entity.text, entity.transformed])).toEqual([
      ["Carmen Sánchez", "Paciente 2"],
      ["Lucía Ruiz", "Paciente 1"],
    ]);

    // Structural: both distinct values are exact `Paciente N` tokens, with no
    // gender word and no name fragment left behind.
    const values = result.entities.map((entity) => entity.transformed);
    expect(new Set(values).size).toBe(2);
    for (const value of values) {
      expect(value).toMatch(/^Paciente \d+$/);
    }
    expect(result.processed).not.toMatch(/Mujer|Hombre/);
    expect(result.processed).not.toMatch(/Carmen|Sánchez|Lucía|Ruiz/i);
  });
});

describe("candidate-pass state isolation for patient numbering (T14 acceptance 3)", () => {
  const ISO_OBSERVATIONS = [
    observation("NOMBRE", ISOLATION_TEXT, "Carmen Sánchez", {
      subtype: "paciente",
      confidence: 0.9,
    }),
  ];
  const ISO_CANDIDATE = candidate("NOMBRE", ISOLATION_TEXT, ISOLATION_CANDIDATE_TEXT, {
    subtype: "paciente",
    confidence: 0.35,
    reason: "NO_ANONIMIZAR",
  });

  function engineWith(candidates: readonly RecognizerCandidate[]) {
    return createRegistryEngine({
      recognizerRegistry: candidateRegistry(() => ({
        observations: ISO_OBSERVATIONS,
        candidates,
      })),
    });
  }

  it("keeps the returned patient context unchanged while a below-threshold patient candidate grows the module counter", () => {
    const withCandidate = engineWith([ISO_CANDIDATE]).process({
      text: ISOLATION_TEXT,
      context: FRESH,
    });

    // The candidate pass really grew the MODULE counter: the kept patient took
    // index 1 and the candidate took index 2. Checked BEFORE the control run,
    // whose own resets clear the module maps.
    expect(AsignadorSustitutos.contadorPacientes).toBe(2);
    expect(AsignadorSustitutos.mapaAsignaciones.get(ISOLATION_CANDIDATE_KEY)).toBe("Paciente 2");

    // ... but the RETURNED context is fixed to the post-kept-pass state.
    expect(withCandidate.result.processed).toBe(
      "Nombre: Paciente 1 acudió a la revisión. Mª Carmen Ruiz Gil firmó el consentimiento."
    );
    expect(withCandidate.context.pseudonymState).toEqual({
      asignaciones: [["carmen sánchez", "Paciente 1"]],
      profesionales: [],
      familiares: [],
      contadorProfesionales: 0,
      contadorFamiliares: 0,
      contadorPacientes: 1,
    });
    expect(withCandidate.result.candidates).toHaveLength(1);
    expect(withCandidate.result.candidates?.[0].proposed).toBe("Paciente 2");

    const withoutCandidate = engineWith([]).process({ text: ISOLATION_TEXT, context: FRESH });

    expect(withCandidate.result.processed).toBe(withoutCandidate.result.processed);
    expect(withCandidate.result.entities).toEqual(withoutCandidate.result.entities);
    expect(withCandidate.result.stats).toEqual(withoutCandidate.result.stats);
    expect(withCandidate.context).toEqual(withoutCandidate.context);
    expect(withoutCandidate.result.candidates).toEqual([]);
  });
});
