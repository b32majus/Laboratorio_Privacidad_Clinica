import { afterEach, describe, expect, it } from "vitest";

import { AsignadorSustitutos } from "../../../js/core/managers/AsignadorSustitutos.js";
import { FechasManager } from "../../../js/core/managers/FechasManager.js";
import { UbicacionesManager } from "../../../js/core/managers/UbicacionesManager.js";
import { Processor } from "../../../js/core/processor.js";
import { createLegacyRecognizerRegistry, LEGACY_RECOGNIZER_KEY } from "./legacy-recognizers";
import { createLegacyOperatorRegistry } from "./legacy-operators";
import {
  LEGACY_OPERATOR_KEYS,
  type Operator,
  type OperatorContext,
  OperatorError,
  OperatorRegistry,
} from "./operator-registry";
import type { RecognizerObservation } from "./recognizer-registry";

/**
 * Deterministic oracles for the legacy operator adaptation (Work Order T11
 * #15, WU2a; SPEC_V4_PRIVACY_ENGINE.md §5/§6; CURRENT_DECISIONS.md
 * D-003/D-009).
 *
 * All fixtures are synthetic clinical-style strings; no real content is used
 * anywhere. Every parity case compares operator output against the ACCEPTED
 * legacy `Processor.transformEntity` semantics given the SAME prepared
 * manager state: the legacy side runs `Processor.process` (its own resets +
 * preprocessFechas + transformEntity), the operator side re-creates exactly
 * that preparation — resets + `Processor.preprocessFechas` — in TEST SETUP
 * ONLY, never inside operators (state contract). The pure contracts/registry
 * oracles that need no legacy import live in operator-registry.test.ts.
 */

type LegacyEntityLike = {
  type: string;
  subtype?: string;
  text: string;
  position: { start: number; end: number };
  transformed?: string;
};

/** Parity fixtures: at least one synthetic text per legacy category. */
const PARITY_TEXTS: readonly string[] = [
  // Patients (label + inline) and a family member.
  "Nombre: Carmen Sánchez\nLa paciente Lucía Ruiz acude acompañada de su hija Rosa.",
  // Professionals + a full-date visit sequence.
  "El Dr. García López revisó la analítica realizada el 12/03/2024 y la Dra. Ruiz firmó el informe el 15/03/2024.",
  // Identifiers (phone, DNI, NHC).
  "Contacto: 612345678. Documento 12345678Z. NHC 2024/089756.",
  // Locations (hospital + city).
  "Se derivó al Hospital Virgen del Rocío desde Sevilla para pruebas complementarias.",
  // Quasi-identifiers (rare disease, special kinship, public office).
  "Se trata de un Síndrome de Ehlers Danlos. Su hermana gemela también acude. Ocupación: concejal del ayuntamiento.",
  // Year-only and slash-prefixed partial dates.
  "Historia clínica iniciada en 2019; revisión programada el 03/11 y control en 2021.",
  // Mixed realistic note combining categories.
  "Nombre: Antonio Martínez\nAtendido por la Dra. Fernández en el Hospital La Paz, Madrid, el 02/07/2023.\nTeléfono 912345678. Familiar: Rosa Martínez.",
];

/**
 * Test-side wiring of the accepted legacy category→operator dispatch (the
 * per-category branches of legacy transformEntity). The policy lookup module
 * is a separate follow-up unit; this map exists only to drive the oracles.
 */
const CATEGORY_OPERATOR_KEYS: Readonly<Record<string, string>> = Object.freeze({
  NOMBRE: LEGACY_OPERATOR_KEYS.PSEUDONYMIZE,
  IDENTIFICADOR: LEGACY_OPERATOR_KEYS.REDACT,
  FECHA: LEGACY_OPERATOR_KEYS.DATE_TRANSFORM,
  UBICACION: LEGACY_OPERATOR_KEYS.GENERALIZE,
  SOSPECHOSO: LEGACY_OPERATOR_KEYS.GENERALIZE,
});

const STRICT_CONTEXT: OperatorContext = Object.freeze({ strictMode: true });
const NORMAL_CONTEXT: OperatorContext = Object.freeze({ strictMode: false });

/** Legacy `entity.original || entity.text` selector, mirrored for seeding. */
function legacySource(observation: RecognizerObservation): string {
  return observation.original !== undefined && observation.original !== ""
    ? observation.original
    : observation.text;
}

function entityKey(type: string, start: number, end: number): string {
  return `${type}:${start}:${end}`;
}

function observeAll(text: string): readonly RecognizerObservation[] {
  return createLegacyRecognizerRegistry().get(LEGACY_RECOGNIZER_KEY).observe(text);
}

/** Re-creates the exact transformation-manager preparation legacy process() runs. */
function prepareLegacyTransformationState(observations: readonly RecognizerObservation[]): void {
  AsignadorSustitutos.reset();
  UbicacionesManager.reset();
  FechasManager.reset();
  Processor.preprocessFechas([...observations]);
}

/** One comparable parity case: legacy transformed value vs operator output. */
type ParityCase = { readonly label: string; readonly legacy: string; readonly operator: string };

/**
 * The parity comparator. Both the positive tests and the planted-violation
 * self-test run through this single function, proving the checker can
 * disagree with the implementation (protocol §3.5).
 */
function expectParity(cases: readonly ParityCase[]): void {
  expect(cases.length).toBeGreaterThan(0);
  for (const parityCase of cases) {
    expect([parityCase.label, parityCase.operator]).toEqual([parityCase.label, parityCase.legacy]);
  }
}

type OperatorSelector = (observation: RecognizerObservation) => string;

function defaultOperatorFor(observation: RecognizerObservation): string {
  const key = CATEGORY_OPERATOR_KEYS[observation.type];
  if (key === undefined) {
    throw new Error(`fixture produced an unexpected category: ${observation.type}`);
  }
  return key;
}

/**
 * Builds parity cases for one fixture text: the legacy baseline (a full
 * `Processor.process` run) against operator output given the same prepared
 * state. Operators are applied back-to-front (descending start), the same
 * order legacy `transformEntity` consumes entities, so pseudonym counter
 * assignment aligns deterministically on both sides.
 */
function buildParityCases(
  text: string,
  context: OperatorContext,
  registry: OperatorRegistry = createLegacyOperatorRegistry(),
  operatorFor: OperatorSelector = defaultOperatorFor
): readonly ParityCase[] {
  const baseline = Processor.process(text) as { entities: LegacyEntityLike[] };
  const observations = observeAll(text);
  prepareLegacyTransformationState(observations);

  const outputs = new Map<string, string>();
  for (const observation of [...observations].sort((a, b) => b.start - a.start)) {
    const operator = registry.get(operatorFor(observation));
    const output = operator.apply(observation, context);
    outputs.set(entityKey(observation.type, observation.start, observation.end), output);
  }

  return baseline.entities.map((entity) => {
    const key = entityKey(entity.type, entity.position.start, entity.position.end);
    const operator = outputs.get(key);
    if (operator === undefined) {
      throw new Error(`no operator output produced for ${key}`);
    }
    return { label: key, legacy: entity.transformed ?? "", operator };
  });
}

afterEach(() => {
  // Leave the shared legacy singletons clean and in the default profile.
  AsignadorSustitutos.reset();
  UbicacionesManager.reset();
  FechasManager.reset();
  Processor.configure({ modoEstricto: false });
});

describe("operator registry contracts (legacy composition)", () => {
  it("registers the five legacy operators under stable keys and lists them deterministically", () => {
    const registry = createLegacyOperatorRegistry();
    expect(registry.keys()).toEqual([...registry.keys()].sort());
    expect(registry.keys()).toEqual([
      "legacy.date-transform",
      "legacy.generalize",
      "legacy.keep",
      "legacy.pseudonymize",
      "legacy.redact",
    ]);
    expect([...registry.keys()]).toEqual([...registry.keys()]);
    for (const key of Object.values(LEGACY_OPERATOR_KEYS)) {
      expect(registry.has(key)).toBe(true);
      expect(typeof registry.get(key).apply).toBe("function");
    }
  });

  it("fails typed on category/operator mismatch instead of guessing a transformation", () => {
    const registry = createLegacyOperatorRegistry();
    const redact = registry.get(LEGACY_OPERATOR_KEYS.REDACT);
    const nombre = observeAll(PARITY_TEXTS[0]).find((o) => o.type === "NOMBRE");
    expect(nombre).toBeDefined();
    expect(() => redact.apply(nombre as RecognizerObservation, NORMAL_CONTEXT)).toThrowError(
      OperatorError
    );
    try {
      redact.apply(nombre as RecognizerObservation, NORMAL_CONTEXT);
    } catch (error) {
      expect((error as OperatorError).code).toBe("operator-category-mismatch");
    }
  });
});

describe("operator parity vs legacy transformEntity (normal profile)", () => {
  for (const [index, text] of PARITY_TEXTS.entries()) {
    it(`matches Processor.transformEntity exactly for synthetic text #${index + 1}`, () => {
      expectParity(buildParityCases(text, NORMAL_CONTEXT));
    });
  }

  it("covers every legacy category across the fixture set", () => {
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

  it("encodes IDENTIFICADOR redaction as the empty string (legacy silent deletion)", () => {
    const cases = buildParityCases(PARITY_TEXTS[2], NORMAL_CONTEXT);
    const redactions = cases.filter((c) => c.label.startsWith("IDENTIFICADOR:"));
    expect(redactions.length).toBeGreaterThan(0);
    for (const redaction of redactions) {
      expect(redaction.legacy).toBe("");
      expect(redaction.operator).toBe("");
    }
  });
});

describe("operator parity vs legacy transformEntity (strict / modoEstricto profile)", () => {
  it("matches the strict UBICACION and SOSPECHOSO branches exactly", () => {
    Processor.configure({ modoEstricto: true });
    expectParity(buildParityCases(PARITY_TEXTS[3], STRICT_CONTEXT));
    expectParity(buildParityCases(PARITY_TEXTS[4], STRICT_CONTEXT));
  });

  it("strict GENERALIZE collapses UBICACION to the two legacy generic labels", () => {
    Processor.configure({ modoEstricto: true });
    expectParity(buildParityCases(PARITY_TEXTS[6], STRICT_CONTEXT));
    const registry = createLegacyOperatorRegistry();
    const generalize = registry.get(LEGACY_OPERATOR_KEYS.GENERALIZE);
    const observations = observeAll(PARITY_TEXTS[6]).filter((o) => o.type === "UBICACION");
    expect(observations.length).toBeGreaterThan(0);
    for (const observation of observations) {
      const output = generalize.apply(observation, STRICT_CONTEXT);
      expect(output).toBe(
        observation.subtype === "hospital" ? "Centro Sanitario" : "Zona Geografica"
      );
      expect(output).not.toBe(observation.text);
    }
  });
});

describe("DATE_TRANSFORM — FechasManager semantics", () => {
  it("returns the prepared visit label from visitasMap (READ-only lookup)", () => {
    const observations = observeAll(PARITY_TEXTS[1]).filter((o) => o.type === "FECHA");
    prepareLegacyTransformationState(observations);
    const registry = createLegacyOperatorRegistry();
    const dateTransform = registry.get(LEGACY_OPERATOR_KEYS.DATE_TRANSFORM);
    expect(observations.length).toBeGreaterThan(0);
    for (const observation of observations) {
      const expected = FechasManager.visitasMap.get(observation.text.trim());
      expect(expected).toBeDefined();
      expect(dateTransform.apply(observation, NORMAL_CONTEXT)).toBe(expected as string);
    }
  });

  it("falls back to relativizarRespHoy for unmapped parseable dates (same manager output)", () => {
    FechasManager.reset();
    const registry = createLegacyOperatorRegistry();
    const dateTransform = registry.get(LEGACY_OPERATOR_KEYS.DATE_TRANSFORM);
    const observation: RecognizerObservation = Object.freeze({
      type: "FECHA",
      subtype: "fecha_completa",
      start: 0,
      end: 10,
      text: "01/01/1900",
      confidence: 1,
    });
    const output = dateTransform.apply(observation, NORMAL_CONTEXT);
    expect(output).toBe(FechasManager.relativizarRespHoy("01/01/1900"));
    expect(output).not.toBe(observation.text);
  });

  it("keeps non-transformable FECHA subtypes as original text (unknown subtype case)", () => {
    const registry = createLegacyOperatorRegistry();
    const dateTransform = registry.get(LEGACY_OPERATOR_KEYS.DATE_TRANSFORM);
    const observation: RecognizerObservation = Object.freeze({
      type: "FECHA",
      subtype: "edad",
      start: 0,
      end: 7,
      text: "45 años",
      confidence: 1,
    });
    expect(dateTransform.apply(observation, NORMAL_CONTEXT)).toBe("45 años");
  });
});

describe("KEEP — identity operator over legacy observations", () => {
  it("returns the observation's original source text for every covered category", () => {
    const registry = createLegacyOperatorRegistry();
    const keep = registry.get(LEGACY_OPERATOR_KEYS.KEEP);
    for (const text of PARITY_TEXTS) {
      for (const observation of observeAll(text)) {
        expect(keep.apply(observation, NORMAL_CONTEXT)).toBe(observation.text);
      }
    }
  });
});

describe("state purity — apply() never resets or mutates prepared manager state", () => {
  function seedPreparedState(): readonly RecognizerObservation[][] {
    const perText: RecognizerObservation[][] = [];
    for (const text of PARITY_TEXTS) {
      const observations = observeAll(text);
      perText.push([...observations]);
      // Seed the name/location managers with every fixture value so each
      // legacy lookup is a map hit, exactly like the composed engine would
      // provide prepared state (test setup only).
      for (const observation of observations) {
        if (observation.type === "NOMBRE") {
          const source = legacySource(observation);
          if (observation.subtype === "profesional") {
            AsignadorSustitutos.obtenerSustitutoProfesional(source);
          } else if (observation.subtype === "familiar") {
            AsignadorSustitutos.obtenerSustitutoFamiliar(source);
          } else {
            AsignadorSustitutos.obtenerSustituto(source);
          }
        }
        if (observation.type === "UBICACION" && observation.subtype === "hospital") {
          UbicacionesManager.obtenerCentro(legacySource(observation));
        }
        if (observation.type === "UBICACION" && observation.subtype !== "hospital") {
          UbicacionesManager.obtenerCiudad(legacySource(observation));
        }
      }
      Processor.preprocessFechas([...observations]);
    }
    return perText;
  }

  function snapshotTransformationManagers() {
    return {
      asignaciones: [...AsignadorSustitutos.mapaAsignaciones.entries()].sort(),
      profesionales: [...AsignadorSustitutos.profesionalesMap.entries()].sort(),
      familiares: [...AsignadorSustitutos.familiaresMap.entries()].sort(),
      contadorProfesionales: AsignadorSustitutos.contadorProfesionales,
      contadorFamiliares: AsignadorSustitutos.contadorFamiliares,
      visitas: [...FechasManager.visitasMap.entries()].sort(),
      visitasOrdenadas: FechasManager.visitasOrdenadas.length,
      centros: [...UbicacionesManager.centrosMap.entries()].sort(),
      ciudades: [...UbicacionesManager.ciudadesMap.entries()].sort(),
      contadorCentros: UbicacionesManager.contadorCentros,
      contadorCiudades: UbicacionesManager.contadorCiudades,
    };
  }

  it("snapshot is identical after every operator applies over prepared state", () => {
    const perText = seedPreparedState();
    const before = snapshotTransformationManagers();

    const registry = createLegacyOperatorRegistry();
    for (const observations of perText) {
      for (const observation of observations) {
        const key = CATEGORY_OPERATOR_KEYS[observation.type];
        if (key === undefined) {
          throw new Error(`fixture produced an unexpected category: ${observation.type}`);
        }
        registry.get(key).apply(observation, NORMAL_CONTEXT);
        registry.get(LEGACY_OPERATOR_KEYS.KEEP).apply(observation, NORMAL_CONTEXT);
      }
    }

    expect(snapshotTransformationManagers()).toEqual(before);
  });
});

describe("planted-violation self-test — the parity comparator can disagree", () => {
  /** Deliberately wrong: keeps the identifier text instead of deleting it. */
  class PlantedWrongRedact implements Operator {
    readonly key = "planted.wrong-redact";
    apply(observation: RecognizerObservation): string {
      return observation.text;
    }
  }

  /** Deliberately wrong: a guessed constant pseudonym. */
  class PlantedGuessedPseudonym implements Operator {
    readonly key = "planted.guessed-pseudonym";
    apply(): string {
      return "Paciente";
    }
  }

  function registryWithPlanted(operator: Operator): OperatorRegistry {
    const registry = createLegacyOperatorRegistry();
    registry.register(operator);
    return registry;
  }

  it("detects a redact operator that returns the original instead of ''", () => {
    const plantedFor: OperatorSelector = (observation) =>
      observation.type === "IDENTIFICADOR"
        ? "planted.wrong-redact"
        : defaultOperatorFor(observation);
    const cases = buildParityCases(
      PARITY_TEXTS[2],
      NORMAL_CONTEXT,
      registryWithPlanted(new PlantedWrongRedact()),
      plantedFor
    );
    expect(() => expectParity(cases)).toThrowError();
  });

  it("detects a pseudonym operator that guesses a constant replacement", () => {
    const plantedFor: OperatorSelector = (observation) =>
      observation.type === "NOMBRE" ? "planted.guessed-pseudonym" : defaultOperatorFor(observation);
    const cases = buildParityCases(
      PARITY_TEXTS[0],
      NORMAL_CONTEXT,
      registryWithPlanted(new PlantedGuessedPseudonym()),
      plantedFor
    );
    expect(() => expectParity(cases)).toThrowError();
  });
});
