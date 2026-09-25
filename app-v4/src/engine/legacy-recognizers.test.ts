import { afterEach, describe, expect, it } from "vitest";

import { AsignadorSustitutos } from "../../../js/core/managers/AsignadorSustitutos.js";
import { FechasManager } from "../../../js/core/managers/FechasManager.js";
import { UbicacionesManager } from "../../../js/core/managers/UbicacionesManager.js";
import { Processor } from "../../../js/core/processor.js";
import {
  createLegacyRecognizerRegistry,
  LegacyRecognizerAdapter,
  LEGACY_RECOGNIZER_KEY,
} from "./legacy-recognizers";
import {
  findUncoveredRecognizerCategories,
  LEGACY_CATEGORY_RECOGNIZER_KEYS,
  RECOGNIZER_CATEGORIES,
  type RecognizerObservation,
} from "./recognizer-registry";
import { EngineError } from "./types";

/**
 * Legacy adaptation tests for the V4 recognizer boundary (Work Order T11
 * #15, WU1; SPEC_V4_PRIVACY_ENGINE.md §2/§3/§4; CURRENT_DECISIONS.md
 * D-003/D-009).
 *
 * All fixtures are synthetic clinical-style strings built from the legacy
 * dictionary vocabulary; no real content is used anywhere. Recognizers
 * answer "what is this?" only: no operator choice and no transformed value
 * may leak into observations, and recognition must never mutate the
 * transformation-side managers. The pure registry contracts themselves are
 * tested in `./recognizer-registry.test`.
 */

type LegacyEntityLike = {
  type: string;
  subtype?: string;
  text: string;
  original?: string;
  position: { start: number; end: number };
  confidence: number;
};

/** Comparable projection shared by the parity oracle's two sides. */
type ComparableDetection = {
  type: string;
  subtype?: string;
  start: number;
  end: number;
  text: string;
  original?: string;
  confidence: number;
};

/** Parity fixtures: at least one synthetic text per legacy category. */
const PARITY_TEXTS: readonly string[] = [
  // Person names (patient via label + inline).
  "Nombre: Carmen Sánchez\nLa paciente Lucía Ruiz acude a consulta de seguimiento.",
  // Professionals + dates.
  "El Dr. García López revisó la analítica realizada el 12/03/2024 y el Dra. Ruiz firmó el informe el 15/03/2024.",
  // Identifiers (phone, DNI, NHC).
  "Contacto: 612345678. Documento 12345678Z. NHC 2024/089756.",
  // Locations (hospital + city).
  "Se derivó al Hospital Virgen del Rocío desde Sevilla para pruebas complementarias.",
  // Quasi-identifiers (rare disease, special kinship, public office).
  "Se trata de un Síndrome de Ehlers Danlos. Su hermana gemela también acude. Ocupación: concejal del ayuntamiento.",
  // Mixed realistic note combining categories.
  "Nombre: Antonio Martínez\nAtendido por la Dra. Fernández en el Hospital La Paz, Madrid, el 02/07/2023.\nTeléfono 912345678. Familiar: Rosa Martínez.",
];

function byStart(
  a: Pick<ComparableDetection, "start" | "type" | "text">,
  b: Pick<ComparableDetection, "start" | "type" | "text">
): number {
  return a.start - b.start || a.type.localeCompare(b.type) || a.text.localeCompare(b.text);
}

/** Legacy direct call baseline: entities Processor.process would detect. */
function legacyDetectedEntities(text: string): readonly ComparableDetection[] {
  AsignadorSustitutos.reset();
  const result = Processor.process(text) as { entities: LegacyEntityLike[] };
  return result.entities
    .map((entity) => ({
      type: entity.type,
      subtype: entity.subtype,
      start: entity.position.start,
      end: entity.position.end,
      text: entity.text,
      original: typeof entity.original === "string" ? entity.original : undefined,
      confidence: entity.confidence,
    }))
    .sort(byStart);
}

/** Observation → comparable record (same field set as the legacy mapping). */
function comparableObservation(observation: RecognizerObservation): ComparableDetection {
  return {
    type: observation.type,
    subtype: observation.subtype,
    start: observation.start,
    end: observation.end,
    text: observation.text,
    original: observation.original,
    confidence: observation.confidence,
  };
}

function observeAll(text: string): readonly RecognizerObservation[] {
  return createLegacyRecognizerRegistry().get(LEGACY_RECOGNIZER_KEY).observe(text);
}

describe("legacy recognizer registry — taxonomy coverage oracle", () => {
  it("covers the full legacy category taxonomy (same set as privacy-eval ENTITY_TYPES)", () => {
    expect([...RECOGNIZER_CATEGORIES]).toEqual([
      "NOMBRE",
      "IDENTIFICADOR",
      "FECHA",
      "UBICACION",
      "SOSPECHOSO",
    ]);
    const registry = createLegacyRecognizerRegistry();
    expect(findUncoveredRecognizerCategories(registry)).toEqual([]);
    for (const key of Object.values(LEGACY_CATEGORY_RECOGNIZER_KEYS)) {
      expect(registry.has(key)).toBe(true);
    }
  });

  it("lists the legacy registry keys deterministically (sorted, stable)", () => {
    const first = createLegacyRecognizerRegistry().keys();
    const second = createLegacyRecognizerRegistry().keys();
    expect(first).toEqual(second);
    expect(first).toEqual([...first].sort());
    expect(first).toContain(LEGACY_RECOGNIZER_KEY);
  });
});

describe("LegacyRecognizerAdapter — parity oracle vs legacy detection", () => {
  for (const [index, text] of PARITY_TEXTS.entries()) {
    it(`detects exactly the same entities as Processor.process for synthetic text #${index + 1}`, () => {
      const observations = observeAll(text);
      expect(observations.map(comparableObservation).sort(byStart)).toEqual(
        legacyDetectedEntities(text)
      );
    });
  }

  it("represents every legacy category across the fixture set", () => {
    const types = new Set<string>();
    for (const text of PARITY_TEXTS) {
      for (const observation of observeAll(text)) {
        if (observation.type === "NOMBRE") types.add(`NOMBRE:${observation.subtype ?? ""}`);
        else types.add(observation.type);
      }
    }
    expect(types.has("NOMBRE:paciente")).toBe(true);
    expect(types.has("NOMBRE:profesional")).toBe(true);
    expect(types.has("NOMBRE:familiar")).toBe(true);
    expect(types.has("FECHA")).toBe(true);
    expect(types.has("IDENTIFICADOR")).toBe(true);
    expect(types.has("UBICACION")).toBe(true);
    expect(types.has("SOSPECHOSO")).toBe(true);
  });

  it("exposes per-category recognizers that filter exactly their own category", () => {
    const registry = createLegacyRecognizerRegistry();
    for (const [category, key] of Object.entries(LEGACY_CATEGORY_RECOGNIZER_KEYS)) {
      for (const text of PARITY_TEXTS) {
        const observations = registry.get(key).observe(text);
        for (const observation of observations) {
          expect(observation.type).toBe(category);
        }
      }
    }
  });

  it("per-category observations union to the full pipeline result (no drift)", () => {
    for (const text of PARITY_TEXTS) {
      const registry = createLegacyRecognizerRegistry();
      const union = Object.values(LEGACY_CATEGORY_RECOGNIZER_KEYS)
        .flatMap((key) => registry.get(key).observe(text))
        .map(comparableObservation)
        .sort(byStart);
      expect(union).toEqual(legacyDetectedEntities(text));
    }
  });
});

describe("recognition purity — no transformation-side mutation", () => {
  function seedTransformationManagers(): void {
    // Pre-seed each transformation manager so a stray reset would be visible.
    AsignadorSustitutos.obtenerSustituto("María Pérez");
    AsignadorSustitutos.obtenerSustitutoProfesional("López García");
    AsignadorSustitutos.obtenerSustitutoFamiliar("Rosa Pérez");
    FechasManager.procesarVisita("01/02/2024");
    UbicacionesManager.obtenerCentro("Hospital Prueba");
    UbicacionesManager.obtenerCiudad("Puebla Prueba");
  }

  function snapshotTransformationManagers() {
    return {
      asignaciones: [...AsignadorSustitutos.mapaAsignaciones.entries()].sort(),
      profesionales: [...AsignadorSustitutos.profesionalesMap.entries()].sort(),
      familiares: [...AsignadorSustitutos.familiaresMap.entries()].sort(),
      contadorProfesionales: AsignadorSustitutos.contadorProfesionales,
      contadorFamiliares: AsignadorSustitutos.contadorFamiliares,
      visitas: [...FechasManager.visitasMap.entries()].sort(),
      centros: [...UbicacionesManager.centrosMap.entries()].sort(),
      ciudades: [...UbicacionesManager.ciudadesMap.entries()].sort(),
      contadorCentros: UbicacionesManager.contadorCentros,
      contadorCiudades: UbicacionesManager.contadorCiudades,
    };
  }

  it("never resets or mutates AsignadorSustitutos/UbicacionesManager/FechasManager", () => {
    seedTransformationManagers();
    const before = snapshotTransformationManagers();

    const registry = createLegacyRecognizerRegistry();
    for (const text of PARITY_TEXTS) {
      for (const key of registry.keys()) {
        registry.get(key).observe(text);
      }
    }

    expect(snapshotTransformationManagers()).toEqual(before);
  });

  it("never calls preprocessFechas (dates are observed, not visit-mapped)", () => {
    const registry = createLegacyRecognizerRegistry();
    const dates = "Ingreso el 02/07/2023 y alta el 10/07/2023.";
    const observations = registry.get(LEGACY_CATEGORY_RECOGNIZER_KEYS.FECHA).observe(dates);
    expect(observations.length).toBeGreaterThan(0);
    for (const observation of observations) {
      expect(observation.text).toBe(dates.slice(observation.start, observation.end));
    }
    expect(FechasManager.visitasMap.size).toBe(0);
  });
});

describe("LegacyRecognizerAdapter — fail-closed input handling", () => {
  it("rejects invalid, empty and oversized text with the existing engine error codes", () => {
    const adapter = new LegacyRecognizerAdapter();
    expect(() => adapter.observe(42 as unknown as string)).toThrowError(EngineError);
    expect(() => adapter.observe("   \n\t ")).toThrowError(EngineError);
    expect(() => adapter.observe("x".repeat(1_000_001))).toThrowError(EngineError);
    try {
      adapter.observe("");
      throw new Error("expected adapter.observe to throw");
    } catch (error) {
      expect((error as EngineError).code).toBe("empty-text");
    }
  });
});

describe("observation independence — recognition carries no transformation data", () => {
  const OBSERVATION_KEYS = ["type", "subtype", "start", "end", "text", "original", "confidence"];

  it("observations expose only the 'what is this?' contract fields", () => {
    for (const text of PARITY_TEXTS) {
      const observations = observeAll(text);
      expect(observations.length).toBeGreaterThan(0);
      for (const observation of observations) {
        for (const key of Object.keys(observation)) {
          expect(OBSERVATION_KEYS).toContain(key);
        }
        expect(observation).not.toHaveProperty("transformed");
        expect(observation).not.toHaveProperty("proposed");
        expect(observation).not.toHaveProperty("requiresReview");
        expect(observation).not.toHaveProperty("scoring");
        expect(typeof observation.start).toBe("number");
        expect(typeof observation.end).toBe("number");
        expect(observation.end).toBeGreaterThan(observation.start);
        expect(observation.text).toBe(text.slice(observation.start, observation.end));
      }
    }
  });

  it("returns frozen, JSON-serializable observations", () => {
    const observations = observeAll(PARITY_TEXTS[5]);
    expect(Object.isFrozen(observations)).toBe(true);
    for (const observation of observations) {
      expect(Object.isFrozen(observation)).toBe(true);
      expect(() => JSON.stringify(observation)).not.toThrow();
      expect(JSON.parse(JSON.stringify(observation))).toEqual(observation);
    }
  });
});

afterEach(() => {
  // Leave the shared legacy singletons clean for other suites.
  AsignadorSustitutos.reset();
  UbicacionesManager.reset();
  FechasManager.reset();
});
