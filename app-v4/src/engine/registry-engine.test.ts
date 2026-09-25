import { afterEach, describe, expect, it, vi } from "vitest";

import { AsignadorSustitutos } from "../../../js/core/managers/AsignadorSustitutos.js";
import { Processor } from "../../../js/core/processor.js";
import { createReviewSessionFromProcessor } from "../../../js/domain/from-processor.js";
import { createLegacyEngine } from "./legacy-engine";
import { createLegacyRecognizerRegistry, LEGACY_RECOGNIZER_KEY } from "./legacy-recognizers";
import { createRegistryEngine } from "./registry-engine";
import { OperatorRegistry, OperatorError } from "./operator-registry";
import { PolicyError } from "./policy";
import { RecognizerError, RecognizerRegistry } from "./recognizer-registry";
import type { LegacyEntity, LegacyProcessorResult, ProcessingContext } from "./types";

/**
 * Contract and parity oracles for the registry-composed V4 engine (Work
 * Order T11 #15, WU3; SPEC_V4_PRIVACY_ENGINE.md §2/§3/§5/§6/§7;
 * CURRENT_DECISIONS.md D-003/D-007/D-009/D-011).
 *
 * The composed engine must reproduce the accepted legacy behavior
 * (createLegacyEngine) on the V4 path while routing recognition through the
 * RecognizerRegistry and transformation through the policy profile + the
 * OperatorRegistry — never through `Processor.process`. All fixtures are
 * synthetic clinical-style strings built from the legacy dictionary
 * vocabulary; no real content is used anywhere.
 */

const FRESH: ProcessingContext = Object.freeze({ mode: "fresh" });

/**
 * Parity fixtures: the same multi-category synthetic fixture set style as
 * legacy-engine.test.ts — person names, professionals, dates, identifiers,
 * locations, quasi-identifiers, partial dates, and a mixed realistic note.
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
  // Year-only and slash-prefixed partial dates.
  "Historia clínica iniciada en 2019; revisión programada el 03/11 y control en 2021.",
  // Mixed realistic note combining categories.
  "Nombre: Antonio Martínez\nAtendido por la Dra. Fernández en el Hospital La Paz, Madrid, el 02/07/2023.\nTeléfono 912345678. Familiar: Rosa Martínez.",
];

const DOC_A = "Nombre: Carmen Sánchez\nLa paciente fue atendida por el Dr. García López.";
const DOC_B =
  "Nombre: Carmen Sánchez\nSegunda consulta: intervención principal del Dr. García López.\nEl alta la firmó el Dr. Ruiz Pons.";

function createEngine() {
  return createRegistryEngine();
}

/**
 * The parity surface agreed for WU3: the recognition-contract entity fields
 * (type/subtype/offsets/original/confidence/text) plus the transformation
 * result (`transformed`), which is everything downstream V4 surfaces (the
 * from-processor adapter, review, outputs) consume. Legacy-internal detector
 * bookkeeping fields (scoring/heuristics extras) are deliberately outside
 * the recognizer observation contract (WU1) and outside this oracle.
 */
function comparableEntity(entity: LegacyEntity) {
  return {
    type: entity.type,
    subtype: entity.subtype,
    text: entity.text,
    original: entity.original,
    position: { start: entity.position.start, end: entity.position.end },
    confidence: entity.confidence,
    transformed: entity.transformed,
  };
}

function comparableResult(result: LegacyProcessorResult) {
  return {
    original: result.original,
    processed: result.processed,
    entities: result.entities.map(comparableEntity),
    alerts: result.alerts,
    stats: result.stats,
  };
}

afterEach(() => {
  // Leave the shared legacy singleton clean for other suites.
  AsignadorSustitutos.reset();
  vi.restoreAllMocks();
});

describe("createRegistryEngine — legacy parity oracle (fresh mode vs createLegacyEngine)", () => {
  for (const [index, text] of PARITY_TEXTS.entries()) {
    it(`produces equivalent output to the legacy engine for synthetic text #${index + 1}`, () => {
      const registryOutcome = createEngine().process({ text, context: FRESH });
      const legacyOutcome = createLegacyEngine().process({ text, context: FRESH });

      expect(comparableResult(registryOutcome.result)).toEqual(
        comparableResult(legacyOutcome.result)
      );
      expect(registryOutcome.result.processed).toBe(legacyOutcome.result.processed);
      expect(registryOutcome.result.entities).toEqual(
        legacyOutcome.result.entities.map(comparableEntity)
      );
      // Fresh-mode pseudonym state must match the legacy adapter's exactly.
      expect(registryOutcome.context).toEqual(legacyOutcome.context);
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

  it("never calls legacy Processor.process — recognition goes through the registry", () => {
    const spy = vi.spyOn(Processor, "process");
    const engine = createEngine();
    engine.process({ text: PARITY_TEXTS[0], context: FRESH });
    engine.process({ text: DOC_A, context: { mode: "shared" } });
    expect(spy).not.toHaveBeenCalled();
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

describe("createRegistryEngine — context semantics (ported legacy oracles)", () => {
  it("fresh mode yields independent runs with no cross-run leakage", () => {
    const engine = createEngine();
    const first = engine.process({ text: DOC_B, context: FRESH });
    const second = engine.process({ text: DOC_B, context: FRESH });

    expect(comparableResult(first.result)).toEqual(comparableResult(second.result));
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

    expect(comparableResult(viaRoundTrip.result)).toEqual(comparableResult(viaObject.result));
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

  it("matches the legacy engine's shared-mode reconciliation bit for bit", () => {
    const registryEngine = createEngine();
    const legacyEngine = createLegacyEngine();

    const registryA = registryEngine.process({ text: DOC_A, context: { mode: "shared" } });
    const legacyA = legacyEngine.process({ text: DOC_A, context: { mode: "shared" } });
    const registryB = registryEngine.process({
      text: DOC_B,
      context: { mode: "shared", pseudonymState: registryA.context.pseudonymState },
    });
    const legacyB = legacyEngine.process({
      text: DOC_B,
      context: { mode: "shared", pseudonymState: legacyA.context.pseudonymState },
    });

    expect(comparableResult(registryB.result)).toEqual(comparableResult(legacyB.result));
    expect(registryB.context).toEqual(legacyB.context);
  });
});

describe("createRegistryEngine — ACCEPTANCE 1: recognition is invariant under operator/policy choice", () => {
  // Fixture where the strict profile changes the transformation (locations
  // and quasi-identifiers collapse to their strict replacements).
  const TEXT =
    "Se derivó al Hospital Virgen del Rocío desde Sevilla. Ocupación: concejal del ayuntamiento.";

  it("yields identical recognition observations regardless of the policy profile", () => {
    const engine = createEngine();
    const standard = engine.process({ text: TEXT, context: FRESH });
    const strict = engine.process({ text: TEXT, context: FRESH, policyId: "strict" });

    // Identity fields (type/subtype/offsets/original/confidence/text) are
    // policy-invariant; only `transformed` may differ.
    expect(
      strict.result.entities.map((entity) => ({
        type: entity.type,
        subtype: entity.subtype,
        text: entity.text,
        original: entity.original,
        position: entity.position,
        confidence: entity.confidence,
      }))
    ).toEqual(
      standard.result.entities.map((entity) => ({
        type: entity.type,
        subtype: entity.subtype,
        text: entity.text,
        original: entity.original,
        position: entity.position,
        confidence: entity.confidence,
      }))
    );
    // Sanity: the fixture really produces observations to compare.
    expect(standard.result.entities.length).toBeGreaterThan(0);
  });

  it("produces different transforms under standard vs strict while the detection set does not change", () => {
    const engine = createEngine();
    const standard = engine.process({ text: TEXT, context: FRESH });
    const strict = engine.process({ text: TEXT, context: FRESH, policyId: "strict" });

    expect(standard.result.entities.length).toBe(strict.result.entities.length);
    expect(strict.result.processed).not.toBe(standard.result.processed);
    // Strict UBICACION collapses to the fixed strict replacement.
    const strictHospital = strict.result.entities.find(
      (entity) => entity.type === "UBICACION" && entity.subtype === "hospital"
    );
    expect(strictHospital?.transformed).toBe("Centro Sanitario");
  });

  it("leaves the recognizer observations untouched by a strict-policy dispatch (registry-level invariance)", () => {
    const registry = createLegacyRecognizerRegistry();
    const recognizer = registry.get(LEGACY_RECOGNIZER_KEY);
    const before = recognizer.observe(TEXT);
    createRegistryEngine({ recognizerRegistry: registry }).process({
      text: TEXT,
      context: FRESH,
      policyId: "strict",
    });
    const after = recognizer.observe(TEXT);
    expect(after).toEqual(before);
  });

  it("fails typed for a known-but-unmapped policy through the composed path (D-007/D-009)", () => {
    const engine = createEngine();
    try {
      engine.process({ text: TEXT, context: FRESH, policyId: "external-ai" });
      throw new Error("expected engine.process to throw");
    } catch (error) {
      expect(error).toBeInstanceOf(PolicyError);
      expect((error as PolicyError).code).toBe("policy-operator-mapping-unavailable");
    }
  });

  it("fails typed for an unknown policy id through the composed path", () => {
    const engine = createEngine();
    try {
      engine.process({
        text: TEXT,
        context: FRESH,
        policyId: "no-such-policy" as never,
      });
      throw new Error("expected engine.process to throw");
    } catch (error) {
      expect(error).toBeInstanceOf(PolicyError);
      expect((error as PolicyError).code).toBe("unknown-policy");
    }
  });
});

describe("createRegistryEngine — adversarial registry keys through the composed path", () => {
  it("fails typed when the recognizer registry has no entry under the legacy key", () => {
    const engine = createRegistryEngine({ recognizerRegistry: new RecognizerRegistry() });
    try {
      engine.process({ text: DOC_A, context: FRESH });
      throw new Error("expected engine.process to throw");
    } catch (error) {
      expect(error).toBeInstanceOf(RecognizerError);
      expect((error as RecognizerError).code).toBe("unknown-recognizer");
    }
  });

  it("fails typed when the operator registry lacks the policy's operator keys", () => {
    const engine = createRegistryEngine({ operatorRegistry: new OperatorRegistry() });
    try {
      engine.process({ text: DOC_A, context: FRESH });
      throw new Error("expected engine.process to throw");
    } catch (error) {
      expect(error).toBeInstanceOf(OperatorError);
      expect((error as OperatorError).code).toBe("unknown-operator");
    }
  });
});

describe("createRegistryEngine — no monkey patching", () => {
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

describe("createRegistryEngine — input immutability and frozen outputs", () => {
  it("never mutates the input text or context", () => {
    const engine = createEngine();
    const context: ProcessingContext = {
      mode: "shared",
      pseudonymState: {
        asignaciones: [["carmen sánchez", "Paciente Mujer"]],
        profesionales: [],
        familiares: [],
        contadorProfesionales: 5,
        contadorFamiliares: 0,
      },
    };
    const snapshot = JSON.parse(JSON.stringify(context)) as ProcessingContext;
    const text = DOC_B;

    engine.process({ text, context });

    expect(context).toEqual(snapshot);
    expect(text).toBe(DOC_B);
  });

  it("freezes the returned outcome deeply in both modes", () => {
    const engine = createEngine();
    const fresh = engine.process({ text: DOC_A, context: FRESH });
    const shared = engine.process({ text: DOC_A, context: { mode: "shared" } });

    for (const outcome of [fresh, shared]) {
      expect(Object.isFrozen(outcome)).toBe(true);
      expect(Object.isFrozen(outcome.result)).toBe(true);
      for (const entity of outcome.result.entities) {
        expect(Object.isFrozen(entity)).toBe(true);
        expect(Object.isFrozen(entity.position)).toBe(true);
      }
      expect(Object.isFrozen(outcome.result.stats)).toBe(true);
    }
  });
});

describe("createRegistryEngine — fail-closed typed errors (same rules as the legacy engine)", () => {
  it("rejects empty and invalid text with typed codes", () => {
    const engine = createEngine();
    expect(() => engine.process({ text: "", context: FRESH })).toThrowError(Error);
    expect(() => engine.process({ text: "   \n\t ", context: FRESH })).toThrowError(Error);
    expect(() => engine.process({ text: 42 as unknown as string, context: FRESH })).toThrowError(
      Error
    );
    try {
      engine.process({ text: "   ", context: FRESH });
      throw new Error("expected engine.process to throw");
    } catch (error) {
      expect((error as { code?: string }).code).toBe("empty-text");
    }
    try {
      engine.process({ text: 42 as unknown as string, context: FRESH });
      throw new Error("expected engine.process to throw");
    } catch (error) {
      expect((error as { code?: string }).code).toBe("invalid-text");
    }
  });

  it("rejects oversized input instead of silently truncating (D-009)", () => {
    const engine = createEngine();
    const oversized = "x".repeat(1_000_001);
    try {
      engine.process({ text: oversized, context: FRESH });
      throw new Error("expected engine.process to throw");
    } catch (error) {
      expect((error as { code?: string }).code).toBe("input-too-large");
    }
  });

  it("rejects unknown modes with a typed code", () => {
    const engine = createEngine();
    try {
      engine.process({ text: DOC_A, context: { mode: "global" as never } });
      throw new Error("expected engine.process to throw");
    } catch (error) {
      expect((error as { code?: string }).code).toBe("invalid-context");
    }
  });

  it("rejects non-serializable contexts with a typed code", () => {
    const engine = createEngine();
    const mapContext = {
      mode: "shared",
      pseudonymState: new Map(),
    } as unknown as ProcessingContext;
    expect(() => engine.process({ text: DOC_A, context: mapContext })).toThrowError(Error);

    const functionContext = {
      mode: "fresh",
      options: { onDone: () => undefined },
    } as unknown as ProcessingContext;
    expect(() => engine.process({ text: DOC_A, context: functionContext })).toThrowError(Error);
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
      expect((error as { code?: string }).code).toBe("invalid-context");
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
    expect(() => engine.process({ text: DOC_A, context: badCounter })).toThrowError(Error);
  });

  it("resolves the default policy through the same headless lookup (standard profile)", () => {
    const engine = createEngine();
    try {
      engine.process({ text: DOC_A, context: FRESH, policyId: "" as never });
      throw new Error("expected engine.process to throw");
    } catch (error) {
      expect(error).toBeInstanceOf(PolicyError);
      expect((error as PolicyError).code).toBe("invalid-policy-id");
    }
  });
});

describe("createRegistryEngine — preprocessFechas legacy-shape adapter (R3-001 correction)", () => {
  it("hands preprocessFechas entities in the documented legacy shape (type/text/position), offsets unchanged", () => {
    // Planted-regression oracle: if the engine ever reverts to passing raw
    // frozen observations (no `position`) into the legacy boundary, the
    // shape assertion below fails — the seam is contract-checked, not
    // structurally coincidental.
    const spy = vi.spyOn(Processor, "preprocessFechas");
    try {
      const engine = createEngine();
      for (const text of PARITY_TEXTS) {
        spy.mockClear();
        engine.process({ text, context: FRESH });
        expect(spy).toHaveBeenCalledTimes(1);
        const entities = spy.mock.calls[0]?.[0] as unknown[];
        expect(entities.length).toBeGreaterThan(0);
        for (const raw of entities) {
          const entity = raw as {
            type?: unknown;
            text?: unknown;
            position?: { start?: unknown; end?: unknown };
          };
          expect(typeof entity.type).toBe("string");
          expect(typeof entity.text).toBe("string");
          expect(entity.position).toBeDefined();
          expect(Number.isInteger(entity.position?.start)).toBe(true);
          expect(Number.isInteger(entity.position?.end)).toBe(true);
          const start = entity.position?.start as number;
          const end = entity.position?.end as number;
          expect(start).toBeGreaterThanOrEqual(0);
          expect(end).toBeGreaterThanOrEqual(start + 1);
        }
      }
    } finally {
      spy.mockRestore();
    }
  });

  it("keeps date-visit preparation parity: adapter output matches the legacy engine byte-for-byte", () => {
    // The adapter must not change offsets or visit semantics: the composed
    // engine and the legacy engine must still agree on the date-containing
    // fixtures (entity spans and processed text identical).
    const composed = createEngine();
    const legacy = createLegacyEngine();
    for (const text of PARITY_TEXTS) {
      const composedOutcome = composed.process({ text, context: FRESH });
      const legacyOutcome = legacy.process({ text, context: FRESH });
      const projection = (outcome: { result: { entities: readonly unknown[] } }) =>
        (outcome.result.entities as readonly Record<string, unknown>[]).map((entity) => ({
          type: entity.type,
          subtype: entity.subtype,
          position: entity.position,
          original: entity.original,
          transformed: entity.transformed,
        }));
      expect(projection(composedOutcome)).toEqual(projection(legacyOutcome));
      expect(composedOutcome.result.processed).toBe(legacyOutcome.result.processed);
    }
  });
});
