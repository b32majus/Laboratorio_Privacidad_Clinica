import { describe, expect, it } from "vitest";

import {
  findUncoveredRecognizerCategories,
  LEGACY_CATEGORY_RECOGNIZER_KEYS,
  RECOGNIZER_CATEGORIES,
  RecognizerError,
  RecognizerRegistry,
  type Recognizer,
} from "./recognizer-registry";

/**
 * Contract tests for the V4 recognizer registry boundary (Work Order T11
 * #15, WU1; SPEC_V4_PRIVACY_ENGINE.md §2/§3/§4; CURRENT_DECISIONS.md D-009).
 *
 * These tests exercise the pure contracts/registry surface only, through
 * bare stub recognizers; the legacy adaptation of the contracts and its
 * parity/purity oracles live in `./legacy-recognizers.test`.
 */

/** Minimal stub recognizer built over the contract surface. */
function stubRecognizer(key: string): Recognizer {
  return { key, observe: () => [] };
}

describe("RecognizerRegistry — registry contract", () => {
  it("registers, finds and reports recognizers under stable keys", () => {
    const registry = new RecognizerRegistry();
    const stub = { key: "stub.recognizer", observe: () => [] };
    expect(registry.has("stub.recognizer")).toBe(false);
    registry.register(stub);
    expect(registry.has("stub.recognizer")).toBe(true);
    expect(registry.get("stub.recognizer")).toBe(stub);
  });

  it("lists keys in deterministic sorted order", () => {
    const registry = new RecognizerRegistry();
    for (const key of ["b.recognizer", "a.recognizer", "c.recognizer"]) {
      registry.register({ key, observe: () => [] });
    }
    expect(registry.keys()).toEqual(["a.recognizer", "b.recognizer", "c.recognizer"]);
    expect(registry.keys()).toEqual([...registry.keys()].sort());
  });

  it("fails with the typed unknown-recognizer error for an unregistered key", () => {
    const registry = new RecognizerRegistry();
    registry.register(stubRecognizer("stub.recognizer"));
    expect(registry.has("no-such-recognizer")).toBe(false);
    expect(() => registry.get("no-such-recognizer")).toThrowError(RecognizerError);
    try {
      registry.get("no-such-recognizer");
      throw new Error("expected registry.get to throw");
    } catch (error) {
      expect((error as RecognizerError).code).toBe("unknown-recognizer");
    }
  });

  it("fails closed instead of silently overwriting a duplicate key", () => {
    const registry = new RecognizerRegistry();
    registry.register({ key: "dup", observe: () => [] });
    expect(() => registry.register({ key: "dup", observe: () => [] })).toThrowError(
      RecognizerError
    );
    try {
      registry.register({ key: "dup", observe: () => [] });
      throw new Error("expected registry.register to throw");
    } catch (error) {
      expect((error as RecognizerError).code).toBe("duplicate-recognizer");
    }
  });

  it("rejects malformed recognizer registrations (D-009 fail-closed)", () => {
    const registry = new RecognizerRegistry();
    expect(() => registry.register(undefined as never)).toThrowError(RecognizerError);
    expect(() => registry.register({ observe: () => [] } as never)).toThrowError(RecognizerError);
    expect(() => registry.register({ key: "", observe: () => [] })).toThrowError(RecognizerError);
    expect(() => registry.register({ key: "no-observe" } as never)).toThrowError(RecognizerError);
  });
});

describe("taxonomy coverage oracle — contracts", () => {
  it("declares the full legacy category taxonomy (same set as privacy-eval ENTITY_TYPES)", () => {
    expect([...RECOGNIZER_CATEGORIES]).toEqual([
      "NOMBRE",
      "IDENTIFICADOR",
      "FECHA",
      "UBICACION",
      "SOSPECHOSO",
    ]);
    for (const category of RECOGNIZER_CATEGORIES) {
      expect(typeof LEGACY_CATEGORY_RECOGNIZER_KEYS[category]).toBe("string");
    }
  });

  it("can disagree: a registry missing one planted category fails the coverage check", () => {
    for (const omitted of RECOGNIZER_CATEGORIES) {
      const planted = new RecognizerRegistry();
      for (const [category, key] of Object.entries(LEGACY_CATEGORY_RECOGNIZER_KEYS)) {
        if (category !== omitted) planted.register(stubRecognizer(key));
      }
      expect(findUncoveredRecognizerCategories(planted)).toEqual([omitted]);
    }
  });

  it("reports zero missing categories for a fully covered bare registry", () => {
    const full = new RecognizerRegistry();
    for (const key of Object.values(LEGACY_CATEGORY_RECOGNIZER_KEYS)) {
      full.register(stubRecognizer(key));
    }
    expect(findUncoveredRecognizerCategories(full)).toEqual([]);
  });
});
