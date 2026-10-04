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
 * WU2b; REC-02 TEXT-POLICY-COMPLETION-01 WU-A; SPEC_V4_PRIVACY_ENGINE.md
 * §5/§6; CURRENT_DECISIONS.md D-007/D-009).
 *
 * The oracles pin the human-accepted REC-02 four-policy text/document/batch
 * table mechanically and nothing more. Standard/Strict keep the legacy
 * `Processor.transformEntity` semantics (category→operator mapping plus the
 * `modoEstricto` flag); External AI and Longitudinal Research resolve the
 * same table with only their FECHA operator replaced. A planted-violation
 * self-test (protocol §3.5) proves the shipped consistency checker can
 * disagree with a deliberately wrong profile FOR EACH POLICY. A structural
 * scan proves the module stays headless/Worker-safe. All fixtures are
 * synthetic; no real content is used anywhere.
 */

/** The accepted category→operator mapping shared by every policy (T12 AGE). */
const COMMON_MAPPING = Object.freeze({
  NOMBRE: LEGACY_OPERATOR_KEYS.PSEUDONYMIZE,
  IDENTIFICADOR: LEGACY_OPERATOR_KEYS.REDACT,
  FECHA: LEGACY_OPERATOR_KEYS.DATE_TRANSFORM,
  UBICACION: LEGACY_OPERATOR_KEYS.GENERALIZE,
  SOSPECHOSO: LEGACY_OPERATOR_KEYS.GENERALIZE,
  EDAD: LEGACY_OPERATOR_KEYS.AGE_GENERALIZE,
});

/**
 * The exact REC-02 mapping table (handoff "Human-accepted
 * text/document/batch policy mapping"), hard-coded here as an INDEPENDENT
 * oracle: the test must be able to disagree with `policy.ts`, never derive
 * the expectation from it.
 */
const EXPECTED_TABLE: Readonly<
  Record<
    PolicyProfile["policyId"],
    {
      readonly strictMode: boolean;
      readonly categoryOperatorKeys: Readonly<Record<string, string>>;
    }
  >
> = Object.freeze({
  standard: Object.freeze({ strictMode: false, categoryOperatorKeys: COMMON_MAPPING }),
  strict: Object.freeze({ strictMode: true, categoryOperatorKeys: COMMON_MAPPING }),
  "external-ai": Object.freeze({
    strictMode: true,
    categoryOperatorKeys: Object.freeze({
      ...COMMON_MAPPING,
      FECHA: LEGACY_OPERATOR_KEYS.DATE_GENERALIZE,
    }),
  }),
  "longitudinal-research": Object.freeze({
    strictMode: true,
    categoryOperatorKeys: Object.freeze({
      ...COMMON_MAPPING,
      FECHA: LEGACY_OPERATOR_KEYS.DATE_SHIFT,
    }),
  }),
});

const POLICY_IDS = ["standard", "external-ai", "longitudinal-research", "strict"] as const;

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

describe("lookupPolicyProfile — REC-02 four-policy mapping table", () => {
  it("resolves EVERY accepted policy id to the exact accepted strictMode flag and category mapping", () => {
    for (const policyId of POLICY_IDS) {
      const profile = lookupPolicyProfile(policyId);
      expect(profile.policyId).toBe(policyId);
      expect(profile.strictMode, `${policyId} strictMode`).toBe(
        EXPECTED_TABLE[policyId].strictMode
      );
      expect(profile.categoryOperatorKeys, `${policyId} mapping`).toEqual(
        EXPECTED_TABLE[policyId].categoryOperatorKeys
      );
    }
  });

  it("returns a deeply frozen, complete profile for every policy", () => {
    for (const policyId of POLICY_IDS) {
      const profile = lookupPolicyProfile(policyId);
      expect(Object.isFrozen(profile), `${policyId} profile frozen`).toBe(true);
      expect(Object.isFrozen(profile.categoryOperatorKeys), `${policyId} mapping frozen`).toBe(
        true
      );
      expect(Object.keys(profile.categoryOperatorKeys).sort()).toEqual(
        [...RECOGNIZER_CATEGORIES].sort()
      );
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

  it("maps FECHA to the date-generalization operator only under external-ai (REC-02)", () => {
    expect(lookupPolicyProfile("external-ai").categoryOperatorKeys.FECHA).toBe(
      LEGACY_OPERATOR_KEYS.DATE_GENERALIZE
    );
    expect(lookupPolicyProfile("external-ai").categoryOperatorKeys.FECHA).toBe(
      "v4.date-generalize"
    );
    // Every other policy keeps the legacy visit-labelling transform.
    for (const policyId of ["standard", "strict", "longitudinal-research"] as const) {
      expect(lookupPolicyProfile(policyId).categoryOperatorKeys.FECHA).not.toBe(
        LEGACY_OPERATOR_KEYS.DATE_GENERALIZE
      );
    }
  });

  it("maps FECHA to the date-shift operator only under longitudinal-research (REC-02)", () => {
    expect(lookupPolicyProfile("longitudinal-research").categoryOperatorKeys.FECHA).toBe(
      LEGACY_OPERATOR_KEYS.DATE_SHIFT
    );
    expect(lookupPolicyProfile("longitudinal-research").categoryOperatorKeys.FECHA).toBe(
      "v4.date-shift"
    );
    for (const policyId of ["standard", "strict", "external-ai"] as const) {
      expect(lookupPolicyProfile(policyId).categoryOperatorKeys.FECHA).not.toBe(
        LEGACY_OPERATOR_KEYS.DATE_SHIFT
      );
    }
  });

  it("maps EDAD to the age-generalization operator identically under all four policies (T12 #16)", () => {
    for (const policyId of POLICY_IDS) {
      const keys = lookupPolicyProfile(policyId).categoryOperatorKeys as Readonly<
        Record<string, string | undefined>
      >;
      expect(keys.EDAD).toBe(LEGACY_OPERATOR_KEYS.AGE_GENERALIZE);
      expect(keys.EDAD).toBe("v4.age-generalize");
    }
  });

  it("maps every taxonomy category of every policy through operator keys registered in the production registry", () => {
    const registry = createLegacyOperatorRegistry();
    for (const policyId of POLICY_IDS) {
      const profile = lookupPolicyProfile(policyId);
      for (const category of RECOGNIZER_CATEGORIES) {
        const operatorKey = profile.categoryOperatorKeys[category];
        expect(
          registry.has(operatorKey),
          `${policyId}: operator "${operatorKey}" for ${category}`
        ).toBe(true);
      }
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

  it("never falls back to standard for any accepted policy id", () => {
    for (const policyId of POLICY_IDS) {
      expect(lookupPolicyProfile(policyId).policyId).toBe(policyId);
    }
    expectPolicyError(() => lookupPolicyProfile("External-AI"), "unknown-policy");
  });

  it("rejects malformed input with a typed invalid-policy-id failure", () => {
    const malformed: unknown[] = [undefined, null, 42, true, {}, [], ""];
    for (const input of malformed) {
      expectPolicyError(() => lookupPolicyProfile(input), "invalid-policy-id");
    }
  });
});

describe("policy profile consistency checker — planted violations for EACH policy (protocol §3.5)", () => {
  it("accepts every real policy profile", () => {
    for (const policyId of POLICY_IDS) {
      expect(() => assertPolicyProfileConsistent(lookupPolicyProfile(policyId))).not.toThrow();
    }
  });

  it("detects a planted profile whose policyId is not a mapped policy id", () => {
    const planted = mutableClone(lookupPolicyProfile("standard"));
    planted.policyId = "no-such-policy";
    expectPolicyError(
      () => assertPolicyProfileConsistent(planted),
      "policy-operator-mapping-unavailable"
    );
  });

  it("detects a planted strict profile whose strictMode was flipped to false", () => {
    const planted = mutableClone(lookupPolicyProfile("strict"));
    planted.strictMode = false;
    expectPolicyError(() => assertPolicyProfileConsistent(planted), "inconsistent-policy-profile");
  });

  it("detects a planted standard profile whose strictMode was flipped to true", () => {
    const planted = mutableClone(lookupPolicyProfile("standard"));
    planted.strictMode = true;
    expectPolicyError(() => assertPolicyProfileConsistent(planted), "inconsistent-policy-profile");
  });

  it.each(["external-ai", "longitudinal-research"] as const)(
    "detects a planted %s profile whose strictMode was flipped to false",
    (policyId) => {
      const planted = mutableClone(lookupPolicyProfile(policyId));
      planted.strictMode = false;
      expectPolicyError(
        () => assertPolicyProfileConsistent(planted),
        "inconsistent-policy-profile"
      );
    }
  );

  it.each(POLICY_IDS)(
    "detects a planted %s mapping with a redirected NOMBRE operator",
    (policyId) => {
      const planted = mutableClone(lookupPolicyProfile(policyId));
      const mapping = planted.categoryOperatorKeys as Record<string, string>;
      mapping.NOMBRE = LEGACY_OPERATOR_KEYS.REDACT;
      expectPolicyError(
        () => assertPolicyProfileConsistent(planted),
        "inconsistent-policy-profile"
      );
    }
  );

  it("detects a planted standard mapping that redirects FECHA to date-generalize", () => {
    const planted = mutableClone(lookupPolicyProfile("standard"));
    const mapping = planted.categoryOperatorKeys as Record<string, string>;
    mapping.FECHA = LEGACY_OPERATOR_KEYS.DATE_GENERALIZE;
    expectPolicyError(() => assertPolicyProfileConsistent(planted), "inconsistent-policy-profile");
  });

  it("detects a planted external-ai mapping that redirects FECHA back to the legacy date-transform", () => {
    const planted = mutableClone(lookupPolicyProfile("external-ai"));
    const mapping = planted.categoryOperatorKeys as Record<string, string>;
    mapping.FECHA = LEGACY_OPERATOR_KEYS.DATE_TRANSFORM;
    expectPolicyError(() => assertPolicyProfileConsistent(planted), "inconsistent-policy-profile");
  });

  it("detects a planted longitudinal-research mapping that redirects FECHA to date-generalize", () => {
    const planted = mutableClone(lookupPolicyProfile("longitudinal-research"));
    const mapping = planted.categoryOperatorKeys as Record<string, string>;
    mapping.FECHA = LEGACY_OPERATOR_KEYS.DATE_GENERALIZE;
    expectPolicyError(() => assertPolicyProfileConsistent(planted), "inconsistent-policy-profile");
  });

  it.each(POLICY_IDS)(
    "detects a planted %s mapping that drops the FECHA taxonomy category",
    (policyId) => {
      const planted = mutableClone(lookupPolicyProfile(policyId));
      const mapping = planted.categoryOperatorKeys as Record<string, string>;
      delete mapping.FECHA;
      expectPolicyError(
        () => assertPolicyProfileConsistent(planted),
        "inconsistent-policy-profile"
      );
    }
  );

  it("detects a planted mapping that drops the EDAD category", () => {
    const planted = mutableClone(lookupPolicyProfile("standard"));
    const mapping = planted.categoryOperatorKeys as Record<string, string>;
    delete mapping.EDAD;
    expectPolicyError(() => assertPolicyProfileConsistent(planted), "inconsistent-policy-profile");
  });

  it("detects a planted mapping that redirects EDAD to the wrong operator", () => {
    const planted = mutableClone(lookupPolicyProfile("standard"));
    const mapping = planted.categoryOperatorKeys as Record<string, string>;
    mapping.EDAD = LEGACY_OPERATOR_KEYS.KEEP;
    expectPolicyError(() => assertPolicyProfileConsistent(planted), "inconsistent-policy-profile");
  });

  it("detects a planted external-ai profile silently carrying the whole standard mapping", () => {
    const planted = mutableClone(lookupPolicyProfile("standard"));
    planted.policyId = "external-ai";
    expectPolicyError(() => assertPolicyProfileConsistent(planted), "inconsistent-policy-profile");
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
