import { describe, expect, it } from "vitest";

import { AgeRecognizer } from "./age-recognizer";
import {
  AGE_DECADE_BANDS,
  AGE_GENERALIZE_OPERATOR_KEY,
  AGE_PEDIATRIC_LABEL,
  AGE_PEDIATRIC_SUBTYPES,
  AGE_TOP_CODE,
  AGE_TOP_MIN_YEARS,
  AGE_YEAR_SUBTYPE,
  AgeGeneralizeOperator,
  AgeOperatorError,
  type AgeOperatorErrorCode,
} from "./age-operator";
import type { OperatorContext } from "./operator-registry";
import { OperatorError } from "./operator-registry";
import type { RecognizerObservation } from "./recognizer-registry";

/**
 * Contract oracles for the V4 age generalization operator (Work Order T12
 * #16, WU-B; SPEC_V4_PRIVACY_ENGINE.md §5/§6/§8; CURRENT_DECISIONS.md
 * D-007/D-009/D-010). The accepted T12 AGE policy is binding:
 * completed years < 90 → containing decade, >= 90 → "90+ años", pediatric
 * months/weeks → "<1 año", and standard/strict share the SAME mapping.
 *
 * All fixtures are synthetic Spanish strings; no real content is used.
 */

const NORMAL_CONTEXT: OperatorContext = Object.freeze({ strictMode: false });
const STRICT_CONTEXT: OperatorContext = Object.freeze({ strictMode: true });

const operator = new AgeGeneralizeOperator();

/** Realistic path: recognize the fixture, then apply the operator. */
function transform(text: string, context: OperatorContext = NORMAL_CONTEXT): string {
  const observations = new AgeRecognizer().observe(text);
  if (observations.length !== 1) {
    throw new Error(`fixture "${text}" expected exactly one EDAD observation`);
  }
  return operator.apply(observations[0], context);
}

function syntheticObservation(
  overrides: Partial<RecognizerObservation> = {}
): RecognizerObservation {
  return Object.freeze({
    type: "EDAD",
    subtype: AGE_YEAR_SUBTYPE,
    start: 0,
    end: 7,
    text: "45 años",
    original: "45 años",
    confidence: 1,
    ...overrides,
  });
}

function expectAgeError(fn: () => unknown, code: AgeOperatorErrorCode): AgeOperatorError {
  try {
    fn();
  } catch (error) {
    expect(error).toBeInstanceOf(AgeOperatorError);
    const ageError = error as AgeOperatorError;
    expect(ageError.code).toBe(code);
    return ageError;
  }
  throw new Error(`Expected an AgeOperatorError with code "${code}" but no error was thrown.`);
}

describe("AgeGeneralizeOperator — completed-year decade banding", () => {
  const CASES: readonly { readonly text: string; readonly expected: string }[] = [
    { text: "45 años", expected: "40–49 años" },
    { text: "7 años", expected: "0–9 años" },
    { text: "89 años", expected: "80–89 años" },
    { text: "90 años", expected: "90+ años" },
    { text: "104 años", expected: "90+ años" },
  ];

  for (const fixture of CASES) {
    it(`bands "${fixture.text}" to "${fixture.expected}"`, () => {
      expect(transform(fixture.text)).toBe(fixture.expected);
    });
  }

  it("returns only the banded label, never the exact source value", () => {
    for (const fixture of CASES) {
      const output = transform(fixture.text);
      const source = new AgeRecognizer().observe(fixture.text)[0].text;
      expect(output).not.toBe(source);
      expect(output).not.toBe("KEEP");
    }
  });

  it("parses the completed-year value from abbreviated year text too", () => {
    expect(transform("45 a.")).toBe("40–49 años");
  });
});

describe("AgeGeneralizeOperator — pediatric months/weeks", () => {
  it('bands "paciente de 3 meses" to "<1 año"', () => {
    expect(transform("paciente de 3 meses")).toBe(AGE_PEDIATRIC_LABEL);
    expect(AGE_PEDIATRIC_LABEL).toBe("<1 año");
  });

  it('bands "lactante de 6 semanas" to "<1 año"', () => {
    expect(transform("lactante de 6 semanas")).toBe(AGE_PEDIATRIC_LABEL);
  });

  it("declares the pediatric subtypes as frozen data", () => {
    expect(AGE_PEDIATRIC_SUBTYPES).toEqual(["meses", "semanas"]);
    expect(Object.isFrozen(AGE_PEDIATRIC_SUBTYPES)).toBe(true);
  });
});

describe("AgeGeneralizeOperator — strictMode does NOT change AGE banding", () => {
  it("produces identical output for standard and strict over every fixture", () => {
    const fixtures = [
      "45 años",
      "7 años",
      "89 años",
      "90 años",
      "104 años",
      "paciente de 3 meses",
      "lactante de 6 semanas",
    ];
    for (const text of fixtures) {
      expect(transform(text, STRICT_CONTEXT)).toBe(transform(text, NORMAL_CONTEXT));
    }
  });

  it("keeps the accepted banding under strict for the decade and top boundaries", () => {
    expect(transform("45 años", STRICT_CONTEXT)).toBe("40–49 años");
    expect(transform("90 años", STRICT_CONTEXT)).toBe("90+ años");
    expect(transform("paciente de 3 meses", STRICT_CONTEXT)).toBe(AGE_PEDIATRIC_LABEL);
  });
});

describe("AgeGeneralizeOperator — recognition invariant under policy change", () => {
  it("recognizes the SAME EDAD observations and transforms them identically", () => {
    const text = "Paciente de 45 años acompañado por lactante de 6 semanas.";
    const observations = new AgeRecognizer().observe(text);
    expect(observations).toHaveLength(2);
    const standard = observations.map((observation) => operator.apply(observation, NORMAL_CONTEXT));
    const strict = observations.map((observation) => operator.apply(observation, STRICT_CONTEXT));
    expect(standard).toEqual(strict);
    expect(standard).toEqual(["40–49 años", "<1 año"]);
  });
});

describe("AgeGeneralizeOperator — fail-closed (D-009)", () => {
  it("rejects a non-EDAD observation with a typed code", () => {
    const error = expectAgeError(
      () =>
        operator.apply(
          syntheticObservation({ type: "NOMBRE", subtype: "paciente" }),
          NORMAL_CONTEXT
        ),
      "not-age-observation"
    );
    expect(error.message).toContain("NOMBRE");
  });

  it('rejects unparseable year text such as "varios años" instead of guessing', () => {
    expectAgeError(
      () => operator.apply(syntheticObservation({ text: "varios años" }), NORMAL_CONTEXT),
      "invalid-age-observation"
    );
  });

  it("rejects empty year text instead of guessing", () => {
    expectAgeError(
      () =>
        operator.apply(
          syntheticObservation({ text: "", original: undefined, start: 0, end: 0 }),
          NORMAL_CONTEXT
        ),
      "invalid-age-observation"
    );
  });

  it("rejects a bare number without a year unit", () => {
    expectAgeError(
      () => operator.apply(syntheticObservation({ text: "45" }), NORMAL_CONTEXT),
      "invalid-age-observation"
    );
  });

  it("rejects an unsupported EDAD subtype", () => {
    expectAgeError(
      () => operator.apply(syntheticObservation({ subtype: "dias" }), NORMAL_CONTEXT),
      "unsupported-age-subtype"
    );
    expectAgeError(
      () => operator.apply(syntheticObservation({ subtype: undefined }), NORMAL_CONTEXT),
      "unsupported-age-subtype"
    );
  });

  it("validates the operator contract fail-closed for malformed calls", () => {
    expect(() =>
      operator.apply({ type: 42, text: "x" } as unknown as RecognizerObservation, NORMAL_CONTEXT)
    ).toThrowError(OperatorError);
    expect(() =>
      operator.apply(syntheticObservation(), { strictMode: "yes" } as unknown as OperatorContext)
    ).toThrowError(OperatorError);
  });
});

describe("AgeGeneralizeOperator — band configuration integrity (self-test on the config)", () => {
  it("exposes the stable operator key", () => {
    expect(operator.key).toBe(AGE_GENERALIZE_OPERATOR_KEY);
    expect(AGE_GENERALIZE_OPERATOR_KEY).toBe("v4.age-generalize");
  });

  it("freezes the band config and every band entry", () => {
    expect(Object.isFrozen(AGE_DECADE_BANDS)).toBe(true);
    for (const band of AGE_DECADE_BANDS) {
      expect(Object.isFrozen(band)).toBe(true);
    }
  });

  it("covers completed years 0–89 exhaustively with no gaps or overlaps", () => {
    for (let years = 0; years <= 89; years += 1) {
      const matches = AGE_DECADE_BANDS.filter((band) => years >= band.min && years <= band.max);
      expect(matches, `year ${years} must match exactly one band`).toHaveLength(1);
    }
  });

  it("starts the top code exactly at the configured threshold", () => {
    expect(AGE_TOP_MIN_YEARS).toBe(90);
    expect(AGE_DECADE_BANDS[AGE_DECADE_BANDS.length - 1].max).toBe(AGE_TOP_MIN_YEARS - 1);
    expect(AGE_TOP_CODE).toBe("90+ años");
  });

  it("uses en-dash decade labels in the accepted format", () => {
    expect(AGE_DECADE_BANDS[4].label).toBe("40–49 años");
    expect(AGE_DECADE_BANDS[4].label).toContain("–");
  });
});
