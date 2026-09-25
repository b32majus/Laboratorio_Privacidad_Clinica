import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

import { createLegacyOperatorRegistry } from "./legacy-operators";
import { LEGACY_OPERATOR_KEYS } from "./operator-registry";
import {
  assertPolicyProfileConsistent,
  lookupPolicyProfile,
  type PolicyErrorCode,
  type PolicyProfile,
  PolicyError,
} from "./policy";
import { RECOGNIZER_CATEGORIES } from "./recognizer-registry";

/**
 * Deterministic oracles for the headless V4 policy lookup (Work Order T11 #15,
 * WU2b; SPEC_V4_PRIVACY_ENGINE.md §5/§6; CURRENT_DECISIONS.md D-007/D-009).
 *
 * The oracles prove exactly the accepted authority and nothing more: the
 * standard/strict profiles mirror the legacy `Processor.transformEntity`
 * semantics (category→operator mapping plus the `modoEstricto` flag), and
 * every other input fails typed instead of guessing. A planted-violation
 * self-test (protocol §3.5) proves the shipped consistency checker can
 * disagree with a deliberately wrong profile. A structural scan proves the
 * module stays headless/Worker-safe. All fixtures are synthetic; no real
 * content is used anywhere.
 */

/** The accepted legacy category→operator mapping (js/core/processor.js). */
const EXPECTED_LEGACY_MAPPING = Object.freeze({
  NOMBRE: LEGACY_OPERATOR_KEYS.PSEUDONYMIZE,
  IDENTIFICADOR: LEGACY_OPERATOR_KEYS.REDACT,
  FECHA: LEGACY_OPERATOR_KEYS.DATE_TRANSFORM,
  UBICACION: LEGACY_OPERATOR_KEYS.GENERALIZE,
  SOSPECHOSO: LEGACY_OPERATOR_KEYS.GENERALIZE,
});

/** Captures a typed {@link PolicyError} or fails the test with a clear reason. */
function expectPolicyError(fn: () => unknown, code: PolicyErrorCode): PolicyError {
  try {
    fn();
  } catch (error) {
    expect(error).toBeInstanceOf(PolicyError);
    const policyError = error as PolicyError;
    expect(policyError.code).toBe(code);
    return policyError;
  }
  throw new Error(`Expected a PolicyError with code "${code}" but no error was thrown.`);
}

/** Unfrozen plain-object clone of a frozen profile, ready to be corrupted. */
function mutableClone(profile: PolicyProfile): Record<string, unknown> {
  return JSON.parse(JSON.stringify(profile)) as Record<string, unknown>;
}

function readModuleSource(relativePath: string): string {
  return readFileSync(fileURLToPath(new URL(relativePath, import.meta.url)), "utf8");
}

/** Strips block and line comments so prose cannot trip the structural scan. */
function stripComments(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/[^\n]*/g, "");
}

const DOM_GLOBAL_PATTERN =
  /\b(window|document|navigator|localStorage|sessionStorage|HTMLElement|requestAnimationFrame)\b/;

describe("lookupPolicyProfile — accepted legacy-mirroring profiles", () => {
  it("resolves standard and strict to frozen profiles mirroring legacy transformEntity", () => {
    const expectedStrictMode: Record<string, boolean> = { standard: false, strict: true };
    for (const policyId of ["standard", "strict"] as const) {
      const profile = lookupPolicyProfile(policyId);
      expect(profile.policyId).toBe(policyId);
      expect(profile.strictMode).toBe(expectedStrictMode[policyId]);
      expect(profile.categoryOperatorKeys).toEqual(EXPECTED_LEGACY_MAPPING);
      expect(Object.isFrozen(profile)).toBe(true);
      expect(Object.isFrozen(profile.categoryOperatorKeys)).toBe(true);
    }
  });

  it("is deterministic across repeated lookups", () => {
    const first = lookupPolicyProfile("standard");
    const second = lookupPolicyProfile("standard");
    expect(first).not.toBe(second);
    expect(first).toEqual(second);
  });

  it("keeps standard and strict distinct in strictMode while sharing the legacy mapping", () => {
    const standard = lookupPolicyProfile("standard");
    const strict = lookupPolicyProfile("strict");
    expect(standard.strictMode).toBe(false);
    expect(strict.strictMode).toBe(true);
    expect(strict.categoryOperatorKeys).toEqual(standard.categoryOperatorKeys);
  });

  it("maps every taxonomy category through operator keys registered in the legacy operator registry", () => {
    const registry = createLegacyOperatorRegistry();
    const profile = lookupPolicyProfile("strict");
    for (const category of RECOGNIZER_CATEGORIES) {
      const operatorKey = profile.categoryOperatorKeys[category];
      expect(registry.has(operatorKey), `operator "${operatorKey}" for ${category}`).toBe(true);
    }
  });

  it("carries no review/requiresReview semantics (ARCH-011 coherence is a separate unit)", () => {
    const profile = lookupPolicyProfile("standard");
    expect(Object.keys(profile).sort()).toEqual(["categoryOperatorKeys", "policyId", "strictMode"]);
    expect(JSON.stringify(profile)).not.toContain("review");
    expect(JSON.stringify(profile)).not.toContain("Review");
  });
});

describe("lookupPolicyProfile — fail-closed (D-009)", () => {
  it("rejects unknown policy ids with a typed unknown-policy failure", () => {
    const error = expectPolicyError(
      () => lookupPolicyProfile("gobierno-militar"),
      "unknown-policy"
    );
    expect(error.message).toContain("gobierno-militar");
  });

  it("is case-sensitive: a differently cased known id is still unknown (fail-closed)", () => {
    expectPolicyError(() => lookupPolicyProfile("Standard"), "unknown-policy");
  });

  it("rejects external-ai as known-but-unmapped instead of guessing or falling back to standard", () => {
    const error = expectPolicyError(
      () => lookupPolicyProfile("external-ai"),
      "policy-operator-mapping-unavailable"
    );
    expect(error.message).toContain("no accepted per-category operator mapping");
    expect(error.message).toContain("external-ai");
  });

  it("rejects longitudinal-research as known-but-unmapped for the same reason", () => {
    expectPolicyError(
      () => lookupPolicyProfile("longitudinal-research"),
      "policy-operator-mapping-unavailable"
    );
  });

  it("rejects malformed input with a typed invalid-policy-id failure", () => {
    const malformed: unknown[] = [undefined, null, 42, true, {}, [], ""];
    for (const input of malformed) {
      expectPolicyError(() => lookupPolicyProfile(input), "invalid-policy-id");
    }
  });
});

describe("policy profile consistency checker — planted violations (protocol §3.5)", () => {
  it("accepts the real standard and strict profiles", () => {
    expect(() => assertPolicyProfileConsistent(lookupPolicyProfile("standard"))).not.toThrow();
    expect(() => assertPolicyProfileConsistent(lookupPolicyProfile("strict"))).not.toThrow();
  });

  it("detects a planted strict profile whose strictMode was flipped to false", () => {
    const planted = mutableClone(lookupPolicyProfile("strict"));
    planted.strictMode = false;
    expectPolicyError(() => assertPolicyProfileConsistent(planted), "inconsistent-policy-profile");
  });

  it("detects a planted profile whose strictMode was flipped to true", () => {
    const planted = mutableClone(lookupPolicyProfile("standard"));
    planted.strictMode = true;
    expectPolicyError(() => assertPolicyProfileConsistent(planted), "inconsistent-policy-profile");
  });

  it("detects a planted mapping that redirects a category to the wrong operator", () => {
    const planted = mutableClone(lookupPolicyProfile("standard"));
    const mapping = planted.categoryOperatorKeys as Record<string, string>;
    mapping.NOMBRE = LEGACY_OPERATOR_KEYS.REDACT;
    expectPolicyError(() => assertPolicyProfileConsistent(planted), "inconsistent-policy-profile");
  });

  it("detects a planted mapping that drops a taxonomy category", () => {
    const planted = mutableClone(lookupPolicyProfile("standard"));
    const mapping = planted.categoryOperatorKeys as Record<string, string>;
    delete mapping.FECHA;
    expectPolicyError(() => assertPolicyProfileConsistent(planted), "inconsistent-policy-profile");
  });

  it("detects a planted external-ai profile silently falling back to the standard mapping", () => {
    const planted = mutableClone(lookupPolicyProfile("standard"));
    planted.policyId = "external-ai";
    expectPolicyError(
      () => assertPolicyProfileConsistent(planted),
      "policy-operator-mapping-unavailable"
    );
  });

  it("detects a planted unfrozen profile", () => {
    const planted = mutableClone(lookupPolicyProfile("standard"));
    expectPolicyError(() => assertPolicyProfileConsistent(planted), "inconsistent-policy-profile");
  });
});

describe("headless / Worker-safe structure", () => {
  it("references no DOM/browser global anywhere in the policy module code", () => {
    const code = stripComments(readModuleSource("./policy.ts"));
    expect(DOM_GLOBAL_PATTERN.test(code), "policy.ts must stay DOM-free").toBe(false);
  });

  it("imports only the pure local contract/vocabulary modules (no bare package, no brownfield import)", () => {
    const source = readModuleSource("./policy.ts");
    const specifiers = [...source.matchAll(/from\s+"([^"]+)"/g)].map((match) => match[1]);
    expect([...specifiers].sort()).toEqual([
      "../domain/job",
      "./operator-registry",
      "./recognizer-registry",
    ]);
  });

  it("keeps its direct engine imports DOM-free as well, so the module graph stays Worker-safe", () => {
    for (const file of ["./operator-registry.ts", "./recognizer-registry.ts"]) {
      const code = stripComments(readModuleSource(file));
      expect(DOM_GLOBAL_PATTERN.test(code), `${file} must stay DOM-free`).toBe(false);
    }
  });
});
