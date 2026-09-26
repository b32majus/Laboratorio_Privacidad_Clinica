import { afterEach, describe, expect, it, vi } from "vitest";

import { AsignadorSustitutos } from "../../../js/core/managers/AsignadorSustitutos.js";
import { FechasManager } from "../../../js/core/managers/FechasManager.js";
import { Processor } from "../../../js/core/processor.js";
import { createReviewSessionFromProcessor } from "../../../js/domain/from-processor.js";
import { classifyObservationDateRole, DateOperatorError } from "./date-operator";
import { createDateShiftState } from "./date-shift";
import { createLegacyEngine } from "./legacy-engine";
import { createLegacyOperatorRegistry } from "./legacy-operators";
import { createLegacyRecognizerRegistry, LEGACY_RECOGNIZER_KEY } from "./legacy-recognizers";
import { createRegistryEngine, SessionIdError } from "./registry-engine";
import {
  type Operator,
  type OperatorContext,
  OperatorRegistry,
  OperatorError,
} from "./operator-registry";
import { PolicyError } from "./policy";
import {
  type RecognizerObservation,
  RecognizerError,
  RecognizerRegistry,
} from "./recognizer-registry";
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
  // The composed engine adds the V4-only `edades` counter (T12 WU-B); the
  // legacy `Processor.calculateStats` contract has no EDAD category. Strip it
  // from the legacy parity projection (a dedicated EDAD oracle proves the
  // V4 addition below) so the legacy key set stays bit-comparable.
  const legacyByType: Record<string, number> = { ...result.stats.byType };
  delete legacyByType.edades;
  return {
    original: result.original,
    processed: result.processed,
    entities: result.entities.map(comparableEntity),
    alerts: result.alerts,
    stats: { totalEntities: result.stats.totalEntities, byType: legacyByType },
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
      detections: readonly {
        readonly type: string;
        readonly start: number;
        readonly end: number;
        readonly original: string;
        readonly lowConfidence?: boolean;
      }[];
    };
    expect(session.originalText).toBe(PARITY_TEXTS[0]);
    // T14 #18 WU-B: the adapter includes the engine's below-threshold
    // candidates as one detection each, marked `lowConfidence: true`.
    const candidates = outcome.result.candidates ?? [];
    expect(session.detections).toHaveLength(outcome.result.entities.length + candidates.length);
    const lowConfidence = session.detections.filter(
      (detection) => detection.lowConfidence === true
    );
    expect(lowConfidence).toHaveLength(candidates.length);
    for (const candidate of candidates) {
      expect(lowConfidence).toContainEqual(
        expect.objectContaining({
          type: candidate.type,
          start: candidate.position.start,
          end: candidate.position.end,
          original: candidate.original ?? candidate.text,
        })
      );
    }

    // Non-vacuous companion: a fixture that genuinely produces a candidate
    // proves the adapter really appends it with `lowConfidence: true`.
    const candidateText = "La paciente acudió ayer. Fisioterapeuta Nélida Otxoa realizó la sesión.";
    const candidateOutcome = engine.process({ text: candidateText, context: FRESH });
    const producedCandidates = candidateOutcome.result.candidates ?? [];
    expect(producedCandidates.length).toBeGreaterThan(0);
    const candidateSession = createReviewSessionFromProcessor(candidateOutcome.result) as {
      detections: readonly { readonly lowConfidence?: boolean; readonly original: string }[];
    };
    const marked = candidateSession.detections.filter(
      (detection) => detection.lowConfidence === true
    );
    expect(marked).toHaveLength(producedCandidates.length);
    for (const candidate of producedCandidates) {
      expect(marked).toContainEqual(
        expect.objectContaining({
          type: candidate.type,
          start: candidate.position.start,
          end: candidate.position.end,
          original: candidate.original ?? candidate.text,
        })
      );
    }
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

describe("createRegistryEngine — session identity (PR #40 corrective C3)", () => {
  it("generates the opaque session id with a cryptographically strong primitive", () => {
    const engine = createEngine();
    const outcome = engine.process({ text: DOC_A, context: FRESH });
    // Canonical UUID shape from Web Crypto randomUUID: strong, non-guessable
    // identity; the value stays non-sensitive and is used only as the stable
    // detection-ID namespace.
    expect(outcome.result.sessionId).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/
    );
    const second = engine.process({ text: DOC_A, context: FRESH });
    expect(second.result.sessionId).not.toBe(outcome.result.sessionId);
  });

  it("keeps the legacy-shaped result contract: ReviewSession stable IDs still build from it", () => {
    const engine = createEngine();
    const outcome = engine.process({ text: DOC_A, context: FRESH });
    const session = createReviewSessionFromProcessor(outcome.result) as {
      sessionId: string;
      detections: readonly { id: string }[];
    };
    expect(session.sessionId).toBe(outcome.result.sessionId);
    expect(session.detections.length).toBeGreaterThan(0);
    for (const detection of session.detections) {
      expect(detection.id.startsWith(`det-${outcome.result.sessionId}-`)).toBe(true);
    }
  });

  it("fails closed with the typed error when the strong primitive is unavailable (no Math.random fallback)", () => {
    const original = Object.getOwnPropertyDescriptor(globalThis, "crypto");
    try {
      Object.defineProperty(globalThis, "crypto", {
        value: undefined,
        configurable: true,
        writable: true,
      });
      const engine = createEngine();
      expect(() => engine.process({ text: DOC_A, context: FRESH })).toThrowError(SessionIdError);
      try {
        engine.process({ text: DOC_A, context: FRESH });
        throw new Error("expected engine.process to fail closed without Web Crypto");
      } catch (error) {
        expect((error as SessionIdError).code).toBe("secure-session-id-unavailable");
      }
    } finally {
      if (original) Object.defineProperty(globalThis, "crypto", original);
    }
  });

  it("fails closed when randomUUID is missing from an otherwise present crypto object", () => {
    const original = Object.getOwnPropertyDescriptor(globalThis, "crypto");
    try {
      Object.defineProperty(globalThis, "crypto", {
        value: {},
        configurable: true,
        writable: true,
      });
      const engine = createEngine();
      expect(() => engine.process({ text: DOC_A, context: FRESH })).toThrowError(SessionIdError);
    } finally {
      if (original) Object.defineProperty(globalThis, "crypto", original);
    }
  });
});

describe("createRegistryEngine — EDAD generalization end-to-end (T12 WU-B)", () => {
  const AGE_TEXT = "La paciente refiere dolor abdominal; se registra una edad de 45 años.";

  it("transforms EDAD through the policy mapping in processed text (standard and strict)", () => {
    const engine = createEngine();
    for (const policyId of ["standard", "strict"] as const) {
      const outcome = engine.process({ text: AGE_TEXT, context: FRESH, policyId });
      const edad = outcome.result.entities.find((entity) => entity.type === "EDAD");
      expect(edad).toBeDefined();
      expect(edad?.subtype).toBe("anios");
      expect(edad?.text).toBe("45 años");
      expect(edad?.transformed).toBe("40–49 años");
      // The exact source value leaks into neither the transformed field nor
      // the generated processed text (WU-C owns the Safe Output no-leak proof).
      expect(edad?.transformed).not.toContain("45");
      expect(outcome.result.processed).toContain("40–49 años");
      expect(outcome.result.processed).not.toContain("45 años");
      // Offsets unchanged: the band replaces exactly the recognized span.
      const start = edad?.position.start ?? -1;
      const end = edad?.position.end ?? -1;
      expect(AGE_TEXT.slice(start, end)).toBe("45 años");
      expect(outcome.result.processed.slice(start, start + "40–49 años".length)).toBe("40–49 años");
    }
  });

  it("counts EDAD entities in stats.byType.edades (V4 contract addition)", () => {
    const engine = createEngine();
    const outcome = engine.process({ text: AGE_TEXT, context: FRESH });
    expect(outcome.result.stats.byType.edades).toBe(1);
  });

  it('bands a pediatric EDAD to "<1 año" end-to-end and counts it', () => {
    const engine = createEngine();
    const outcome = engine.process({ text: "Lactante de 6 semanas en control.", context: FRESH });
    const edad = outcome.result.entities.find((entity) => entity.type === "EDAD");
    expect(edad?.transformed).toBe("<1 año");
    expect(outcome.result.processed).toContain("<1 año");
    expect(outcome.result.stats.byType.edades).toBe(1);
  });

  it("keeps preprocessFechas a no-op for EDAD (no visit is registered)", () => {
    FechasManager.reset();
    const engine = createEngine();
    engine.process({ text: AGE_TEXT, context: FRESH });
    expect(FechasManager.visitasMap.size).toBe(0);
  });

  it("keeps external-ai/longitudinal-research fail-closed (no AGE mapping cloned)", () => {
    const engine = createEngine();
    for (const policyId of ["external-ai", "longitudinal-research"] as const) {
      try {
        engine.process({ text: AGE_TEXT, context: FRESH, policyId });
        throw new Error("expected engine.process to throw");
      } catch (error) {
        expect(error).toBeInstanceOf(PolicyError);
        expect((error as PolicyError).code).toBe("policy-operator-mapping-unavailable");
      }
    }
  });
});

describe("createRegistryEngine — role-aware date preparation end-to-end (T13 #17 WU-B)", () => {
  /**
   * Acceptance fixture: a labelled birth date followed (same line, separate
   * clause) by an unlabelled visit date. The birth role is explicit, the
   * second date has no non-visit cue and therefore keeps the accepted visit
   * semantics.
   */
  const ACCEPTANCE_TEXT = "Fecha de nacimiento: 12/03/1954. Segunda visita: 02/06/2024.";

  it("redacts the explicit birth date and keeps exactly one chronological visit (standard and strict)", () => {
    for (const policyId of ["standard", "strict"] as const) {
      FechasManager.reset();
      const engine = createEngine();
      const outcome = engine.process({ text: ACCEPTANCE_TEXT, context: FRESH, policyId });

      const fechas = outcome.result.entities.filter((entity) => entity.type === "FECHA");
      expect(fechas).toHaveLength(2);

      const birth = fechas.find((entity) => entity.text === "12/03/1954");
      const visit = fechas.find((entity) => entity.text === "02/06/2024");
      expect(birth?.transformed).toBe("");
      expect(visit?.transformed).toMatch(/^Visita \d/);

      // The source birth date leaks into neither the transformed field nor
      // the generated processed text; the visit label does.
      expect(outcome.result.processed).not.toContain("12/03/1954");
      expect(outcome.result.processed).toContain(visit?.transformed as string);

      // The birth date never entered the chronological Visit-N chronology.
      expect(FechasManager.visitasMap.size).toBe(1);
      expect(FechasManager.visitasMap.has("12/03/1954")).toBe(false);
    }
  });

  it("windowing guard: no parity fixture date claims an explicit non-visit role", () => {
    // Planted-regression guard: if clause+cap windowing ever widens enough to
    // pull a cue from an unrelated clause, a legacy parity date would be
    // classified non-visit and break the accepted parity below.
    const recognizer = createLegacyRecognizerRegistry().get(LEGACY_RECOGNIZER_KEY);
    for (const text of PARITY_TEXTS) {
      for (const observation of recognizer.observe(text)) {
        if (observation.type !== "FECHA") continue;
        expect(classifyObservationDateRole(text, observation.start, observation.end)).toBe(
          "unknown"
        );
      }
    }
  });

  it("parity re-proof: no FECHA entity in the parity fixtures is redacted", () => {
    const engine = createEngine();
    let fechaCount = 0;
    for (const text of PARITY_TEXTS) {
      const outcome = engine.process({ text, context: FRESH });
      for (const entity of outcome.result.entities) {
        if (entity.type !== "FECHA") continue;
        fechaCount += 1;
        expect(entity.transformed).not.toBe("");
      }
    }
    expect(fechaCount).toBeGreaterThan(0);
  });

  /** One operator invocation captured by the recording registry. */
  type RecordedContext = {
    readonly type: string;
    readonly text: string;
    readonly context: OperatorContext;
  };

  /**
   * Registry that mirrors every default operator key, records the exact
   * {@link OperatorContext} for each invocation and delegates to the real
   * operator. It proves what the composed engine actually threads without
   * touching the operator implementations.
   */
  function createRecordingRegistry(records: RecordedContext[]): OperatorRegistry {
    const real = createLegacyOperatorRegistry();
    const registry = new OperatorRegistry();
    for (const key of real.keys()) {
      const delegate: Operator = real.get(key);
      registry.register({
        key,
        apply(observation: RecognizerObservation, context: OperatorContext): string {
          records.push({ type: observation.type, text: observation.text, context });
          return delegate.apply(observation, context);
        },
      });
    }
    return registry;
  }

  it("threads a 'unknown' role (no cue) and the explicit acceptance roles to the operators", () => {
    const records: RecordedContext[] = [];
    const engine = createRegistryEngine({ operatorRegistry: createRecordingRegistry(records) });

    engine.process({ text: "Revisión el 12/03/2024.", context: FRESH });
    const cueFree = records.find((record) => record.type === "FECHA");
    expect(cueFree?.context.date?.role).toBe("unknown");

    records.length = 0;
    engine.process({ text: ACCEPTANCE_TEXT, context: FRESH });
    const roleByText = new Map(
      records
        .filter((record) => record.type === "FECHA")
        .map((record) => [record.text, record.context.date?.role])
    );
    expect(roleByText.get("12/03/1954")).toBe("birth");
    expect(roleByText.get("02/06/2024")).toBe("unknown");
  });

  it("threads options.dateShift into the date sub-context and leaves non-FECHA context date-free", () => {
    const records: RecordedContext[] = [];
    const engine = createRegistryEngine({ operatorRegistry: createRecordingRegistry(records) });
    const shiftState = createDateShiftState("seed-x");

    engine.process({
      text: "Nombre: Carmen Sánchez\nFecha de nacimiento: 12/03/1954.",
      context: { mode: "fresh", options: { dateShift: shiftState } },
    });

    const fechas = records.filter((record) => record.type === "FECHA");
    expect(fechas.length).toBeGreaterThan(0);
    for (const record of fechas) {
      expect(record.context.date?.shift).toEqual(shiftState);
    }

    const nombres = records.filter((record) => record.type === "NOMBRE");
    expect(nombres.length).toBeGreaterThan(0);
    for (const record of nombres) {
      expect(record.context.date).toBeUndefined();
    }
  });

  it("threads no shift when options are absent", () => {
    const records: RecordedContext[] = [];
    const engine = createRegistryEngine({ operatorRegistry: createRecordingRegistry(records) });

    engine.process({ text: ACCEPTANCE_TEXT, context: FRESH });

    const fechas = records.filter((record) => record.type === "FECHA");
    expect(fechas.length).toBeGreaterThan(0);
    for (const record of fechas) {
      expect(record.context.date?.shift).toBeUndefined();
    }
  });

  it("fails closed on a malformed options.dateShift before mutating any manager", () => {
    FechasManager.reset();
    const engine = createEngine();
    const malformedContext: ProcessingContext = {
      mode: "fresh",
      options: { dateShift: { seed: "", contextOffsetDays: 1, overrides: [] } },
    };
    try {
      engine.process({ text: ACCEPTANCE_TEXT, context: malformedContext });
      throw new Error("expected engine.process to throw");
    } catch (error) {
      expect(error).toBeInstanceOf(DateOperatorError);
      expect((error as DateOperatorError).code).toBe("invalid-date-shift-state");
    }
    // The fail-closed validation runs BEFORE the legacy manager resets, so
    // the singletons are left exactly as the caller prepared them.
    expect(FechasManager.visitasMap.size).toBe(0);
  });
});
