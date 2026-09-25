import { describe, expect, it } from "vitest";

import {
  assertCoveredType,
  assertObservation,
  assertOperatorContext,
  KeepOperator,
  LEGACY_OPERATOR_KEYS,
  type Operator,
  type OperatorContext,
  OperatorError,
  OperatorRegistry,
} from "./operator-registry";
import type { RecognizerObservation } from "./recognizer-registry";

/**
 * Deterministic oracles for the PURE V4 operator contracts/registry boundary
 * (Work Order T11 #15, WU2a; SPEC_V4_PRIVACY_ENGINE.md §5;
 * CURRENT_DECISIONS.md D-009).
 *
 * This file exercises ONLY the pure contracts/registry surface and the KEEP
 * identity operator: no legacy brownfield import appears here (the legacy
 * adaptation and its per-category parity, seeded-state purity and
 * planted-violation oracles live in legacy-operators.test.ts). All
 * observations are synthetic; no real content is used anywhere.
 */

const NORMAL_CONTEXT: OperatorContext = Object.freeze({ strictMode: false });

/** Minimal synthetic observation factory for pure contract-level cases. */
function syntheticObservation(
  overrides: Partial<RecognizerObservation> = {}
): RecognizerObservation {
  return Object.freeze({
    type: "NOMBRE",
    subtype: "paciente",
    start: 0,
    end: 14,
    text: "Carmen Sánchez",
    confidence: 1,
    ...overrides,
  });
}

/**
 * Minimal pure operator with a covered-type restriction, exercising the
 * shared contract validators exactly the way real operators do.
 */
class CoveredStubOperator implements Operator {
  readonly key = "stub.identificador-only";

  apply(observation: RecognizerObservation, context: OperatorContext): string {
    assertObservation(observation);
    assertOperatorContext(context);
    assertCoveredType(observation, this.key, ["IDENTIFICADOR"]);
    return "";
  }
}

function registryWithKeepAndStubs(): OperatorRegistry {
  const registry = new OperatorRegistry();
  registry.register(new KeepOperator());
  registry.register(new CoveredStubOperator());
  return registry;
}

describe("operator registry contracts (pure)", () => {
  it("registers operators under stable keys and lists them deterministically", () => {
    const registry = registryWithKeepAndStubs();
    expect(registry.keys()).toEqual([...registry.keys()].sort());
    expect(registry.keys()).toEqual(["legacy.keep", "stub.identificador-only"]);
    expect([...registry.keys()]).toEqual([...registry.keys()]);
    for (const key of registry.keys()) {
      expect(registry.has(key)).toBe(true);
      expect(typeof registry.get(key).apply).toBe("function");
    }
  });

  it("fails typed with 'unknown-operator' for unknown keys — no default operator", () => {
    const registry = registryWithKeepAndStubs();
    expect(registry.has("legacy.inexistente")).toBe(false);
    const lookup = () => registry.get("legacy.inexistente");
    expect(lookup).toThrowError(OperatorError);
    try {
      lookup();
    } catch (error) {
      expect((error as OperatorError).code).toBe("unknown-operator");
    }
  });

  it("rejects duplicate and malformed registrations fail-closed", () => {
    const registry = registryWithKeepAndStubs();
    const duplicate = () => registry.register(registry.get(LEGACY_OPERATOR_KEYS.KEEP));
    expect(duplicate).toThrowError(OperatorError);
    try {
      duplicate();
    } catch (error) {
      expect((error as OperatorError).code).toBe("duplicate-operator");
    }
    const malformed = () => registry.register({ key: "", apply: () => "" } as unknown as Operator);
    expect(malformed).toThrowError(OperatorError);
    try {
      malformed();
    } catch (error) {
      expect((error as OperatorError).code).toBe("invalid-operator");
    }
  });

  it("rejects a missing/non-boolean strictMode context and malformed observations fail-closed", () => {
    const keep = new KeepOperator();
    const observation = syntheticObservation();
    const badContexts: unknown[] = [undefined, null, {}, { strictMode: "yes" }];
    for (const badContext of badContexts) {
      try {
        keep.apply(observation, badContext as OperatorContext);
        throw new Error("expected apply to throw");
      } catch (error) {
        expect(error).toBeInstanceOf(OperatorError);
        expect((error as OperatorError).code).toBe("invalid-operator-context");
      }
    }
    try {
      keep.apply({ type: 42, text: "x" } as unknown as RecognizerObservation, NORMAL_CONTEXT);
      throw new Error("expected apply to throw");
    } catch (error) {
      expect((error as OperatorError).code).toBe("invalid-operator-input");
    }
  });

  it("fails typed on category/operator mismatch instead of guessing a transformation", () => {
    const registry = registryWithKeepAndStubs();
    const covered = registry.get("stub.identificador-only");
    const nombre = syntheticObservation({ type: "NOMBRE", text: "Lucía Ruiz" });
    expect(() => covered.apply(nombre, NORMAL_CONTEXT)).toThrowError(OperatorError);
    try {
      covered.apply(nombre, NORMAL_CONTEXT);
    } catch (error) {
      expect((error as OperatorError).code).toBe("operator-category-mismatch");
    }
  });
});

describe("KEEP — pure identity operator", () => {
  it("returns the observation's original source text for representative synthetic observations", () => {
    const keep = new KeepOperator();
    const representative: readonly RecognizerObservation[] = [
      syntheticObservation({ type: "NOMBRE", text: "Carmen Sánchez" }),
      syntheticObservation({ type: "IDENTIFICADOR", text: "12345678Z" }),
      syntheticObservation({ type: "FECHA", text: "12/03/2024" }),
      syntheticObservation({ type: "UBICACION", text: "Sevilla" }),
      syntheticObservation({ type: "SOSPECHOSO", text: "concejal" }),
    ];
    for (const observation of representative) {
      expect(keep.apply(observation, NORMAL_CONTEXT)).toBe(observation.text);
      expect(keep.apply(observation, Object.freeze({ strictMode: true }))).toBe(observation.text);
    }
  });

  it("is defined for observation types beyond the current taxonomy", () => {
    const keep = new KeepOperator();
    const observation: RecognizerObservation = Object.freeze({
      type: "TIPO_FUTURO",
      start: 3,
      end: 11,
      text: "dato nuevo",
      confidence: 0.9,
    });
    expect(keep.apply(observation, NORMAL_CONTEXT)).toBe("dato nuevo");
  });
});
