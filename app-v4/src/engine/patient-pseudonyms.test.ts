import { afterEach, describe, expect, it, vi } from "vitest";

import { AsignadorSustitutos } from "../../../js/core/managers/AsignadorSustitutos.js";
import { createLegacyEngine } from "./legacy-engine";
import { EngineError, type ProcessingContext } from "./types";

/**
 * Oracles for deterministic, gender-free patient pseudonyms (T16 #20, WU-A;
 * SPEC_V4_PRIVACY_ENGINE.md §12). The patient branch of the legacy
 * `AsignadorSustitutos.obtenerSustituto` must produce a distinct, stable
 * `Paciente <n>` index per source identity within the intended processing
 * context and must never consult `detectarGenero`. All fixtures are synthetic
 * clinical-style strings built from the legacy dictionary vocabulary; no real
 * content is used anywhere.
 *
 * Note: model the `detectarGenero` accessor locally because the ambient module
 * declaration intentionally exposes only the API the V4 adapter consumes.
 */

interface InstrumentedAssigner {
  detectarGenero: (nombre: string) => string;
}

const INSTRUMENTED = AsignadorSustitutos as unknown as InstrumentedAssigner;

/** "Carmen Sánchez" and "Lucía Ruiz" are both inferred F by the legacy heuristic. */
const DOC_TWO_PATIENTS =
  "Nombre: Carmen Sánchez\nLa paciente Lucía Ruiz acude a consulta de seguimiento.";
const DOC_FIRST_PATIENT =
  "Nombre: Carmen Sánchez\nLa paciente fue atendida por el Dr. García López.";
const DOC_SAME_PATIENT_AGAIN =
  "Nombre: Carmen Sánchez\nSegunda consulta: intervención principal del Dr. García López.";
const DOC_NEW_PATIENT = "La paciente Lucía Ruiz acude a consulta de seguimiento.";

function createEngine() {
  return createLegacyEngine();
}

afterEach(() => {
  AsignadorSustitutos.reset();
  vi.restoreAllMocks();
});

describe("AsignadorSustitutos — patient pseudonym authority", () => {
  it("assigns distinct Paciente N to distinct same-inferred-gender identities (acceptance 1)", () => {
    AsignadorSustitutos.reset();
    const first = AsignadorSustitutos.obtenerSustituto("Carmen Sánchez");
    const second = AsignadorSustitutos.obtenerSustituto("Lucía Ruiz");

    expect(first).toBe("Paciente 1");
    expect(second).toBe("Paciente 2");
    expect(first).not.toBe(second);
  });

  it("keeps the same pseudonym for a differently-cased/padded identity and does not advance the counter on a hit (acceptance 2)", () => {
    AsignadorSustitutos.reset();
    const first = AsignadorSustitutos.obtenerSustituto("Carmen Sánchez");
    const repeated = AsignadorSustitutos.obtenerSustituto("  CARMEN SÁNCHEZ  ");

    expect(first).toBe("Paciente 1");
    expect(repeated).toBe("Paciente 1");
    expect(AsignadorSustitutos.contadorPacientes).toBe(1);
  });

  it("never consults detectarGenero while producing a replacement (acceptance 3, SD-7)", () => {
    AsignadorSustitutos.reset();
    const original = INSTRUMENTED.detectarGenero;
    const spy = vi.fn(() => {
      throw new Error("detectarGenero must not be consulted for privacy replacements");
    });
    try {
      INSTRUMENTED.detectarGenero = spy as unknown as (nombre: string) => string;

      const female = AsignadorSustitutos.obtenerSustituto("Carmen Sánchez");
      const male = AsignadorSustitutos.obtenerSustituto("Luis Pérez");

      expect(spy).not.toHaveBeenCalled();
      expect(female).toBe("Paciente 1");
      expect(male).toBe("Paciente 2");
      // The token carries no name fragment and no gender word.
      expect(female).toMatch(/^Paciente \d+$/);
      expect(male).toMatch(/^Paciente \d+$/);
      expect(female).not.toMatch(/Carmen|Sánchez|Mujer|Hombre/i);
      expect(male).not.toMatch(/Luis|Pérez|Mujer|Hombre/i);
    } finally {
      INSTRUMENTED.detectarGenero = original;
    }

    // The exact original function is restored (not a wrapper or a stale spy).
    expect(INSTRUMENTED.detectarGenero).toBe(original);
  });

  it("ignores an explicit genero argument: the value is gender-independent (SD-6)", () => {
    AsignadorSustitutos.reset();
    const withF = AsignadorSustitutos.obtenerSustituto("Carmen Sánchez", "F");
    const withM = AsignadorSustitutos.obtenerSustituto("Carmen Sánchez", "M");
    const withNull = AsignadorSustitutos.obtenerSustituto("Carmen Sánchez", null);

    expect(withF).toBe("Paciente 1");
    expect(withM).toBe("Paciente 1");
    expect(withNull).toBe("Paciente 1");

    // Even a fresh context per supplied gender yields the same first index.
    for (const genero of ["F", "M", null] as const) {
      AsignadorSustitutos.reset();
      expect(AsignadorSustitutos.obtenerSustituto("Carmen Sánchez", genero)).toBe("Paciente 1");
    }
  });
});

describe("createLegacyEngine — patient numbering within the intended context", () => {
  it("gives distinct same-gender patients distinct values in one document (acceptance 1)", () => {
    const engine = createEngine();
    const outcome = engine.process({ text: DOC_TWO_PATIENTS, context: { mode: "shared" } });

    // Old behavior collapsed both inferred-F identities to "Paciente Mujer".
    // The legacy recognizer emits "Lucía Ruiz" before "Carmen Sánchez" for
    // this fixture, so the exact index per identity is pinned here.
    expect(outcome.context.pseudonymState?.asignaciones).toEqual([
      ["lucía ruiz", "Paciente 1"],
      ["carmen sánchez", "Paciente 2"],
    ]);
    expect(outcome.context.pseudonymState?.contadorPacientes).toBe(2);
  });

  it("numbers a new patient in the second document with the NEXT context index (acceptance 2/4)", () => {
    const engine = createEngine();
    const first = engine.process({ text: DOC_FIRST_PATIENT, context: { mode: "shared" } });
    expect(first.context.pseudonymState?.asignaciones).toEqual([["carmen sánchez", "Paciente 1"]]);
    expect(first.context.pseudonymState?.contadorPacientes).toBe(1);

    const second = engine.process({
      text: DOC_NEW_PATIENT,
      context: { mode: "shared", pseudonymState: first.context.pseudonymState },
    });

    // The new identity must not reuse a value already used in the context.
    expect(second.context.pseudonymState?.asignaciones).toEqual([
      ["carmen sánchez", "Paciente 1"],
      ["lucía ruiz", "Paciente 2"],
    ]);
    expect(second.context.pseudonymState?.contadorPacientes).toBe(2);
  });

  it("keeps the same context index for the same identity across documents (acceptance 2)", () => {
    const engine = createEngine();
    const first = engine.process({ text: DOC_FIRST_PATIENT, context: { mode: "shared" } });
    const second = engine.process({
      text: DOC_SAME_PATIENT_AGAIN,
      context: { mode: "shared", pseudonymState: first.context.pseudonymState },
    });

    expect(second.context.pseudonymState?.asignaciones).toEqual([["carmen sánchez", "Paciente 1"]]);
    expect(second.context.pseudonymState?.contadorPacientes).toBe(1);
  });

  it("restarts numbering at 1 for every independent fresh run (SD-4)", () => {
    const engine = createEngine();
    const first = engine.process({ text: DOC_FIRST_PATIENT, context: { mode: "fresh" } });
    const second = engine.process({ text: DOC_FIRST_PATIENT, context: { mode: "fresh" } });

    for (const outcome of [first, second]) {
      expect(outcome.context.pseudonymState?.asignaciones).toEqual([
        ["carmen sánchez", "Paciente 1"],
      ]);
      expect(outcome.context.pseudonymState?.contadorPacientes).toBe(1);
    }
  });

  it("returns a frozen pseudonymState whose JSON round-trip keeps numbering intact (SD-8)", () => {
    const engine = createEngine();
    const first = engine.process({ text: DOC_FIRST_PATIENT, context: { mode: "shared" } });
    const state = first.context.pseudonymState;
    expect(state).toBeDefined();
    expect(Object.isFrozen(state)).toBe(true);
    expect(Object.isFrozen(state?.asignaciones)).toBe(true);

    const roundTripped = JSON.parse(JSON.stringify(state)) as ProcessingContext["pseudonymState"];
    expect(roundTripped).toEqual(state);
    expect(roundTripped?.contadorPacientes).toBe(1);

    const second = engine.process({
      text: DOC_NEW_PATIENT,
      context: { mode: "shared", pseudonymState: roundTripped },
    });
    expect(second.context.pseudonymState?.contadorPacientes).toBe(2);
    expect(second.context.pseudonymState?.asignaciones).toEqual([
      ["carmen sánchez", "Paciente 1"],
      ["lucía ruiz", "Paciente 2"],
    ]);
  });

  it("fails closed on a pseudonymState that omits or corrupts contadorPacientes (D-009)", () => {
    const engine = createEngine();
    const validShape = {
      asignaciones: [],
      profesionales: [],
      familiares: [],
      contadorProfesionales: 0,
      contadorFamiliares: 0,
    };

    const invalidStates = [
      validShape,
      { ...validShape, contadorPacientes: -1 },
      { ...validShape, contadorPacientes: "1" },
    ];

    for (const pseudonymState of invalidStates) {
      const context = { mode: "shared", pseudonymState } as unknown as ProcessingContext;
      try {
        engine.process({ text: DOC_FIRST_PATIENT, context });
        throw new Error("expected engine.process to throw");
      } catch (error) {
        expect(error).toBeInstanceOf(EngineError);
        expect((error as EngineError).code).toBe("invalid-context");
      }
    }
  });
});
