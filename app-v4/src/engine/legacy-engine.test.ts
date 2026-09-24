import { afterEach, describe, expect, it, vi } from "vitest";

import { AsignadorSustitutos } from "../../../js/core/managers/AsignadorSustitutos.js";
import { Processor } from "../../../js/core/processor.js";
import { createReviewSessionFromProcessor } from "../../../js/domain/from-processor.js";
import { PrivacyProcessor } from "../../../js/modular-processor.js";
import { createLegacyEngine } from "./legacy-engine";
import {
  EngineError,
  type LegacyProcessorResult,
  type ProcessingContext,
  type PseudonymState,
} from "./types";

/**
 * Contract tests for the V4 legacy engine adapter (Work Order T05).
 * All fixtures are synthetic clinical-style strings built from the legacy
 * dictionary vocabulary; no real content is used anywhere.
 */

const FRESH: ProcessingContext = Object.freeze({ mode: "fresh" });

/**
 * Parity fixtures: at least one text per target category — person names,
 * professionals, dates, identifiers, locations, quasi-identifiers.
 */
const PARITY_TEXTS: readonly string[] = [
  // Person names (patient via label + inline).
  "Nombre: Carmen Sánchez\nLa paciente Lucía Ruiz acude a consulta de seguimiento.",
  // Professionals + dates.
  "El Dr. García López revisó la analítica realizada el 12/03/2024 y el Dr. Ruiz firmó el informe el 15/03/2024.",
  // Identifiers (DNI, phone, NHC).
  "Contacto: 612345678. Documento 12345678Z. NHC 2024/089756.",
  // Locations (hospital + city).
  "Se derivó al Hospital Virgen del Rocío desde Sevilla para pruebas complementarias.",
  // Quasi-identifiers (rare disease, public office, special kinship).
  "Se trata de un Síndrome de Ehlers Danlos. Su hermana gemela también acude. Ocupación: concejal del ayuntamiento.",
  // Mixed realistic note combining categories.
  "Nombre: Antonio Martínez\nAtendido por la Dra. Fernández en el Hospital La Paz, Madrid, el 02/07/2023.\nTeléfono 912345678. Familiar: Rosa Martínez.",
];

const DOC_A = "Nombre: Carmen Sánchez\nLa paciente fue atendida por el Dr. García López.";
const DOC_B =
  "Nombre: Carmen Sánchez\nSegunda consulta: intervención principal del Dr. García López.\nEl alta la firmó el Dr. Ruiz Pons.";

function createEngine() {
  return createLegacyEngine();
}

/** Legacy direct call with a clean singleton, the T05 parity oracle baseline. */
function legacyProcess(text: string): LegacyProcessorResult {
  AsignadorSustitutos.reset();
  return PrivacyProcessor.process(text) as LegacyProcessorResult;
}

/** Drop the volatile legacy fields (random session id, wall-clock time). */
function comparablePart(result: LegacyProcessorResult) {
  return {
    original: result.original,
    processed: result.processed,
    entities: result.entities,
    alerts: result.alerts,
    stats: result.stats,
    scoring: result.scoring,
  };
}

describe("createLegacyEngine — parity oracle (fresh mode vs legacy direct call)", () => {
  for (const [index, text] of PARITY_TEXTS.entries()) {
    it(`produces bit-identical output to the legacy core for synthetic text #${index + 1}`, () => {
      const engine = createEngine();
      const adapted = engine.process({ text, context: FRESH });
      const legacy = legacyProcess(text);

      expect(comparablePart(adapted.result)).toEqual(comparablePart(legacy));
      expect(adapted.result.processed).toBe(legacy.processed);
      expect(adapted.result.entities).toEqual(legacy.entities);
    });
  }

  it("detects every target category across the fixture set", () => {
    const engine = createEngine();
    const types = new Set<string>();
    for (const text of PARITY_TEXTS) {
      for (const entity of engine.process({ text, context: FRESH }).result.entities) {
        if (entity.type === "NOMBRE") types.add(`NOMBRE:${entity.subtype ?? ""}`);
        else types.add(entity.type);
      }
    }
    expect(types.has("NOMBRE:paciente")).toBe(true);
    expect(types.has("NOMBRE:profesional")).toBe(true);
    expect(types.has("FECHA")).toBe(true);
    expect(types.has("IDENTIFICADOR")).toBe(true);
    expect(types.has("UBICACION")).toBe(true);
    expect(types.has("SOSPECHOSO")).toBe(true);
  });

  it("invokes Processor.process exactly once per engine call with the given text", () => {
    const engine = createEngine();
    const spy = vi.spyOn(Processor, "process");
    try {
      engine.process({ text: PARITY_TEXTS[0], context: FRESH });
      expect(spy).toHaveBeenCalledTimes(1);
      expect(spy).toHaveBeenCalledWith(PARITY_TEXTS[0]);
    } finally {
      spy.mockRestore();
    }
  });

  it("keeps the js/domain/from-processor.js contract working unchanged", () => {
    const engine = createEngine();
    const outcome = engine.process({ text: PARITY_TEXTS[0], context: FRESH });
    const session = createReviewSessionFromProcessor(outcome.result) as {
      originalText: string;
      detections: unknown[];
    };
    expect(session.originalText).toBe(PARITY_TEXTS[0]);
    expect(session.detections).toHaveLength(outcome.result.entities.length);
  });
});

describe("createLegacyEngine — context semantics", () => {
  it("fresh mode yields independent runs with no cross-run leakage", () => {
    const engine = createEngine();
    const first = engine.process({ text: DOC_B, context: FRESH });
    const second = engine.process({ text: DOC_B, context: FRESH });

    expect(comparablePart(first.result)).toEqual(comparablePart(second.result));
    // Independent run: professional numbering restarts from scratch.
    expect(second.result.processed).toContain("Profesional Sanitario 1");
    expect(second.result.processed).toContain("Profesional Sanitario 2");
    expect(second.context.pseudonymState?.contadorProfesionales).toBe(2);
  });

  it("shared mode keeps the same pseudonym for the same person across documents", () => {
    const engine = createEngine();
    const outcomeA = engine.process({ text: DOC_A, context: { mode: "shared" } });

    const outcomeB = engine.process({
      text: DOC_B,
      context: { mode: "shared", pseudonymState: outcomeA.context.pseudonymState },
    });

    // Patient "Carmen Sánchez" keeps the same pseudonym in both documents.
    const patientA = outcomeA.result.processed.match(/Paciente (Hombre|Mujer)/)?.[0];
    const patientB = outcomeB.result.processed.match(/Paciente (Hombre|Mujer)/)?.[0];
    expect(patientA).toBeTruthy();
    expect(patientB).toBe(patientA);

    // The returning professional keeps pseudonym 1; the new one gets 2.
    expect(outcomeA.result.processed).toContain("Profesional Sanitario 1");
    expect(outcomeB.result.processed).toContain("Profesional Sanitario 1");
    expect(outcomeB.result.processed).toContain("Profesional Sanitario 2");
    expect(outcomeB.context.pseudonymState?.contadorProfesionales).toBe(2);
  });

  it("shared mode continues counters instead of restarting them", () => {
    const engine = createEngine();
    const outcomeA = engine.process({ text: DOC_A, context: { mode: "shared" } });
    expect(outcomeA.context.pseudonymState?.contadorProfesionales).toBe(1);

    const docC = "Tercera consulta con el Dr. González Molina.";
    const outcomeC = engine.process({
      text: docC,
      context: { mode: "shared", pseudonymState: outcomeA.context.pseudonymState },
    });
    expect(outcomeC.result.processed).toContain("Profesional Sanitario 2");
    expect(outcomeC.context.pseudonymState?.contadorProfesionales).toBe(2);
  });

  it("round-trips the shared context through JSON with identical results", () => {
    const engine = createEngine();
    const outcomeA = engine.process({ text: DOC_A, context: { mode: "shared" } });

    const roundTripped = JSON.parse(JSON.stringify(outcomeA.context)) as ProcessingContext;
    const viaObject = engine.process({
      text: DOC_B,
      context: { mode: "shared", pseudonymState: outcomeA.context.pseudonymState },
    });
    const viaRoundTrip = engine.process({
      text: DOC_B,
      context: roundTripped,
    });

    expect(comparablePart(viaRoundTrip.result)).toEqual(comparablePart(viaObject.result));
    expect(viaRoundTrip.context).toEqual(viaObject.context);
  });

  it("returns a frozen, JSON-serializable context in both modes", () => {
    const engine = createEngine();
    const fresh = engine.process({ text: DOC_A, context: FRESH });
    const shared = engine.process({ text: DOC_A, context: { mode: "shared" } });

    for (const outcome of [fresh, shared]) {
      expect(Object.isFrozen(outcome.context)).toBe(true);
      expect(Object.isFrozen(outcome.context.pseudonymState)).toBe(true);
      expect(() => JSON.stringify(outcome.context)).not.toThrow();
      expect(JSON.parse(JSON.stringify(outcome.context))).toEqual(outcome.context);
    }
  });
});

describe("createLegacyEngine — shared-context professional alias consistency", () => {
  // Fixture keys verified against the real legacy detector: sentence-final
  // names keep the captured span clean (no trailing lowercase words), so the
  // keys below are exactly what AsignadorSustitutos.profesionalesMap holds.
  // Legacy alias oracle (js/core/managers/AsignadorSustitutos.js):
  //   sonMismoProfesional("garcía lópez", "juan garcía lópez") === true
  //   sonMismoProfesional("garcía lópez", "ruiz pons") === false
  //   sonMismoProfesional("maría fernández curto", "juan garcía lópez") === false
  const ALIAS_LONG = "La consulta fue atendida por el Dr. Juan García López.";
  const ALIAS_SHORT = "La consulta fue atendida por el Dr. García López.";
  const ALIAS_UNRELATED = "El alta la firmó el Dr. Ruiz Pons.";
  const ALIAS_NEW_PERSON = "El informe fue revisado por la Dra. María Fernández Curto.";

  function professionalEntities(outcome: { result: LegacyProcessorResult }) {
    return outcome.result.entities.filter(
      (entity) => entity.type === "NOMBRE" && entity.subtype === "profesional"
    );
  }

  it("keeps the same pseudonym for a long→short alias across shared documents", () => {
    const engine = createEngine();
    const outcomeA = engine.process({ text: ALIAS_LONG, context: { mode: "shared" } });
    expect(outcomeA.result.processed).toContain("Profesional Sanitario 1");
    expect(outcomeA.context.pseudonymState?.contadorProfesionales).toBe(1);

    const outcomeB = engine.process({
      text: ALIAS_SHORT,
      context: { mode: "shared", pseudonymState: outcomeA.context.pseudonymState },
    });

    const professionalsB = professionalEntities(outcomeB);
    expect(professionalsB.length).toBeGreaterThan(0);
    for (const entity of professionalsB) {
      expect(entity.transformed).toBe("Profesional Sanitario 1");
    }
    expect(outcomeB.result.processed).toContain("Profesional Sanitario 1");
    expect(outcomeB.result.processed).not.toContain("Profesional Sanitario 2");
    // Alias match: no counter increment, fresh key recorded under the
    // existing pseudonym.
    expect(outcomeB.context.pseudonymState?.contadorProfesionales).toBe(1);
    expect(outcomeB.context.pseudonymState?.profesionales).toContainEqual([
      "garcía lópez",
      "Profesional Sanitario 1",
    ]);
  });

  it("keeps the same pseudonym for a short→long alias across shared documents", () => {
    const engine = createEngine();
    const outcomeA = engine.process({ text: ALIAS_SHORT, context: { mode: "shared" } });
    expect(outcomeA.context.pseudonymState?.contadorProfesionales).toBe(1);

    const outcomeB = engine.process({
      text: ALIAS_LONG,
      context: { mode: "shared", pseudonymState: outcomeA.context.pseudonymState },
    });

    const professionalsB = professionalEntities(outcomeB);
    expect(professionalsB.length).toBeGreaterThan(0);
    for (const entity of professionalsB) {
      expect(entity.transformed).toBe("Profesional Sanitario 1");
    }
    expect(outcomeB.result.processed).toContain("Profesional Sanitario 1");
    expect(outcomeB.context.pseudonymState?.contadorProfesionales).toBe(1);
    expect(outcomeB.context.pseudonymState?.profesionales).toContainEqual([
      "juan garcía lópez",
      "Profesional Sanitario 1",
    ]);
  });

  it("does not leave counter gaps: a genuinely new professional gets the next number", () => {
    const engine = createEngine();
    const outcomeA = engine.process({ text: ALIAS_LONG, context: { mode: "shared" } });
    const outcomeB = engine.process({
      text: ALIAS_SHORT,
      context: { mode: "shared", pseudonymState: outcomeA.context.pseudonymState },
    });
    expect(outcomeB.context.pseudonymState?.contadorProfesionales).toBe(1);

    const outcomeC = engine.process({
      text: ALIAS_NEW_PERSON,
      context: { mode: "shared", pseudonymState: outcomeB.context.pseudonymState },
    });

    expect(outcomeC.result.processed).toContain("Profesional Sanitario 2");
    expect(outcomeC.result.processed).not.toContain("Profesional Sanitario 3");
    expect(outcomeC.context.pseudonymState?.contadorProfesionales).toBe(2);
  });

  it("keeps alias-consistent results through a JSON round-trip of the shared context", () => {
    const engine = createEngine();
    const outcomeA = engine.process({ text: ALIAS_LONG, context: { mode: "shared" } });
    const direct = engine.process({
      text: ALIAS_SHORT,
      context: { mode: "shared", pseudonymState: outcomeA.context.pseudonymState },
    });
    const roundTripped = JSON.parse(JSON.stringify(outcomeA.context)) as ProcessingContext;
    const viaRoundTrip = engine.process({ text: ALIAS_SHORT, context: roundTripped });

    expect(comparablePart(viaRoundTrip.result)).toEqual(comparablePart(direct.result));
    expect(viaRoundTrip.context).toEqual(direct.context);
    expect(viaRoundTrip.context.pseudonymState?.contadorProfesionales).toBe(1);
  });

  it("does not over-merge: non-aliasing professionals get distinct pseudonyms", () => {
    const engine = createEngine();
    const outcomeA = engine.process({ text: ALIAS_SHORT, context: { mode: "shared" } });
    const outcomeB = engine.process({
      text: ALIAS_UNRELATED,
      context: { mode: "shared", pseudonymState: outcomeA.context.pseudonymState },
    });
    expect(outcomeB.result.processed).toContain("Profesional Sanitario 2");
    expect(outcomeB.context.pseudonymState?.contadorProfesionales).toBe(2);

    // Symmetric direction: unrelated-first must not alias either.
    const engine2 = createEngine();
    const first = engine2.process({ text: ALIAS_UNRELATED, context: { mode: "shared" } });
    const second = engine2.process({
      text: ALIAS_SHORT,
      context: { mode: "shared", pseudonymState: first.context.pseudonymState },
    });
    expect(second.result.processed).toContain("Profesional Sanitario 2");
    expect(second.context.pseudonymState?.contadorProfesionales).toBe(2);
  });

  afterEach(() => {
    AsignadorSustitutos.reset();
  });
});

describe("createLegacyEngine — no monkey patching", () => {
  it("leaves AsignadorSustitutos methods and module shape untouched", () => {
    const originalObtenerSustituto = AsignadorSustitutos.obtenerSustituto;
    const originalObtenerSustitutoProfesional = AsignadorSustitutos.obtenerSustitutoProfesional;
    const originalObtenerSustitutoFamiliar = AsignadorSustitutos.obtenerSustitutoFamiliar;
    const originalReset = AsignadorSustitutos.reset;
    const keysBefore = Reflect.ownKeys(AsignadorSustitutos).sort();

    const engine = createEngine();
    const outcomeA = engine.process({ text: DOC_A, context: { mode: "shared" } });
    engine.process({
      text: DOC_B,
      context: { mode: "shared", pseudonymState: outcomeA.context.pseudonymState },
    });
    engine.process({ text: DOC_A, context: FRESH });

    expect(AsignadorSustitutos.obtenerSustituto).toBe(originalObtenerSustituto);
    expect(AsignadorSustitutos.obtenerSustitutoProfesional).toBe(
      originalObtenerSustitutoProfesional
    );
    expect(AsignadorSustitutos.obtenerSustitutoFamiliar).toBe(originalObtenerSustitutoFamiliar);
    expect(AsignadorSustitutos.reset).toBe(originalReset);
    expect(Reflect.ownKeys(AsignadorSustitutos).sort()).toEqual(keysBefore);
  });
});

describe("createLegacyEngine — input immutability", () => {
  it("never mutates the input text or context", () => {
    const engine = createEngine();
    const context: ProcessingContext = Object.freeze({
      mode: "shared",
      pseudonymState: {
        asignaciones: [["carmen sánchez", "Paciente Mujer"]] as const,
        profesionales: [] as const,
        familiares: [] as const,
        contadorProfesionales: 5,
        contadorFamiliares: 0,
      } satisfies PseudonymState,
    });
    const snapshot = JSON.parse(JSON.stringify(context)) as ProcessingContext;
    const text = DOC_B;

    engine.process({ text, context });

    expect(context).toEqual(snapshot);
    expect(text).toBe(DOC_B);
  });

  it("never aliases the input state into the returned context", () => {
    const engine = createEngine();
    const context: ProcessingContext = {
      mode: "shared",
      pseudonymState: {
        asignaciones: [],
        profesionales: [["garcía", "Profesional Sanitario 1"]],
        familiares: [],
        contadorProfesionales: 1,
        contadorFamiliares: 0,
      },
    };
    const outcome = engine.process({ text: DOC_B, context });
    expect(outcome.context).not.toBe(context);
    expect(outcome.context.pseudonymState).not.toBe(context.pseudonymState);
    expect(context.pseudonymState?.profesionales).toEqual([["garcía", "Profesional Sanitario 1"]]);
  });
});

describe("createLegacyEngine — fail-closed typed errors", () => {
  it("rejects empty and invalid text with typed codes", () => {
    const engine = createEngine();
    expect(() => engine.process({ text: "", context: FRESH })).toThrowError(EngineError);
    expect(() => engine.process({ text: "   \n\t ", context: FRESH })).toThrowError(EngineError);
    expect(() => engine.process({ text: 42 as unknown as string, context: FRESH })).toThrowError(
      EngineError
    );
    try {
      engine.process({ text: "   ", context: FRESH });
      throw new Error("expected engine.process to throw");
    } catch (error) {
      expect((error as EngineError).code).toBe("empty-text");
    }
    try {
      engine.process({ text: 42 as unknown as string, context: FRESH });
      throw new Error("expected engine.process to throw");
    } catch (error) {
      expect((error as EngineError).code).toBe("invalid-text");
    }
  });

  it("rejects oversized input instead of silently truncating (D-009)", () => {
    const engine = createEngine();
    const oversized = "x".repeat(1_000_001);
    try {
      engine.process({ text: oversized, context: FRESH });
      throw new Error("expected engine.process to throw");
    } catch (error) {
      expect((error as EngineError).code).toBe("input-too-large");
    }
  });

  it("rejects unknown modes with a typed code", () => {
    const engine = createEngine();
    try {
      engine.process({ text: DOC_A, context: { mode: "global" as never } });
      throw new Error("expected engine.process to throw");
    } catch (error) {
      expect((error as EngineError).code).toBe("invalid-context");
    }
  });

  it("rejects non-serializable contexts with a typed code", () => {
    const engine = createEngine();
    const mapContext = {
      mode: "shared",
      pseudonymState: new Map(),
    } as unknown as ProcessingContext;
    expect(() => engine.process({ text: DOC_A, context: mapContext })).toThrowError(EngineError);

    const functionContext = {
      mode: "fresh",
      options: { onDone: () => undefined },
    } as unknown as ProcessingContext;
    expect(() => engine.process({ text: DOC_A, context: functionContext })).toThrowError(
      EngineError
    );

    const undefinedContext = {
      mode: "fresh",
      options: { missing: undefined },
    } as unknown as ProcessingContext;
    try {
      engine.process({ text: DOC_A, context: undefinedContext });
      throw new Error("expected engine.process to throw");
    } catch (error) {
      expect((error as EngineError).code).toBe("non-serializable-context");
    }
  });

  it("rejects malformed shared pseudonym state with a typed code", () => {
    const engine = createEngine();
    const badState = {
      mode: "shared",
      pseudonymState: { asignaciones: "not-an-array" },
    } as unknown as ProcessingContext;
    try {
      engine.process({ text: DOC_A, context: badState });
      throw new Error("expected engine.process to throw");
    } catch (error) {
      expect((error as EngineError).code).toBe("invalid-context");
    }

    const badCounter = {
      mode: "shared",
      pseudonymState: {
        asignaciones: [],
        profesionales: [],
        familiares: [],
        contadorProfesionales: -1,
        contadorFamiliares: 0,
      },
    } as ProcessingContext;
    expect(() => engine.process({ text: DOC_A, context: badCounter })).toThrowError(EngineError);
  });

  afterEach(() => {
    // Leave the shared legacy singleton clean for other suites.
    AsignadorSustitutos.reset();
    vi.restoreAllMocks();
  });
});
