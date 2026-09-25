import { describe, expect, it } from "vitest";

import {
  AGE_PLAUSIBLE_MAX_YEARS,
  AGE_PLAUSIBLE_MIN_YEARS,
  AGE_RECOGNIZER_KEY,
  AgeRecognizer,
} from "./age-recognizer";
import type { RecognizerObservation } from "./recognizer-registry";
import { EngineError } from "./types";

/**
 * Contract oracles for the V4 age recognizer (Work Order T12 #16, WU-A;
 * SPEC_V4_PRIVACY_ENGINE.md §4/§8; CURRENT_DECISIONS.md D-010).
 *
 * The recognizer answers only "what is this?" — exact offsets against the
 * immutable source text, no transformation and no policy input. All fixtures
 * are synthetic clinical-style Spanish strings; no real content is used.
 */

function observe(text: string): readonly RecognizerObservation[] {
  return new AgeRecognizer().observe(text);
}

/** Years fixtures: value text, expected subtype. */
const YEAR_FIXTURES: readonly { readonly text: string; readonly value: string }[] = [
  { text: "45 años", value: "45 años" },
  { text: "45 a.", value: "45 a." },
  { text: "1 año", value: "1 año" },
  { text: "96 años", value: "96 años" },
  { text: "104 años", value: "104 años" },
];

const PEDIATRIC_FIXTURES: readonly {
  readonly text: string;
  readonly value: string;
  readonly subtype: string;
}[] = [
  { text: "paciente de 3 meses", value: "3 meses", subtype: "meses" },
  { text: "paciente con 18 meses", value: "18 meses", subtype: "meses" },
  { text: "lactante de 6 semanas", value: "6 semanas", subtype: "semanas" },
  { text: "niña de 8 meses", value: "8 meses", subtype: "meses" },
  { text: "bebé de 4 semanas", value: "4 semanas", subtype: "semanas" },
];

describe("AgeRecognizer — explicit completed years with exact offsets", () => {
  for (const fixture of YEAR_FIXTURES) {
    it(`recognizes "${fixture.text}" as one EDAD:anios observation`, () => {
      const observations = observe(fixture.text);
      expect(observations).toHaveLength(1);
      const [observation] = observations;
      const start = fixture.text.indexOf(fixture.value);
      expect(observation.type).toBe("EDAD");
      expect(observation.subtype).toBe("anios");
      expect(observation.start).toBe(start);
      expect(observation.end).toBe(start + fixture.value.length);
      expect(observation.text).toBe(fixture.value);
      expect(observation.original).toBe(fixture.value);
      expect(observation.confidence).toBe(1);
      expect(fixture.text.slice(observation.start, observation.end)).toBe(fixture.value);
    });
  }

  it("finds every age in one text, sorted by start with exact offsets", () => {
    const text = "El paciente tiene 45 años; su madre, 72 a. y su abuelo 96 años.";
    const values = ["45 años", "72 a.", "96 años"];
    const observations = observe(text);
    expect(observations.map((observation) => observation.text)).toEqual(values);
    for (const [index, value] of values.entries()) {
      const observation = observations[index];
      const start = text.indexOf(value);
      expect(observation.start).toBe(start);
      expect(observation.end).toBe(start + value.length);
      expect(observation.text).toBe(text.slice(observation.start, observation.end));
    }
  });
});

describe("AgeRecognizer — pediatric months/weeks under an explicit age cue", () => {
  for (const fixture of PEDIATRIC_FIXTURES) {
    it(`recognizes "${fixture.text}" as EDAD:${fixture.subtype}`, () => {
      const observations = observe(fixture.text);
      expect(observations).toHaveLength(1);
      const [observation] = observations;
      const start = fixture.text.indexOf(fixture.value);
      expect(observation.type).toBe("EDAD");
      expect(observation.subtype).toBe(fixture.subtype);
      expect(observation.start).toBe(start);
      expect(observation.end).toBe(start + fixture.value.length);
      expect(observation.text).toBe(fixture.value);
      expect(observation.original).toBe(fixture.value);
      expect(observation.confidence).toBe(1);
    });
  }

  it("emits the whole set deterministically when years and pediatric cues coexist", () => {
    const text = "Paciente de 45 años acompañado por lactante de 6 semanas.";
    const observations = observe(text);
    expect(observations.map((observation) => [observation.subtype, observation.text])).toEqual([
      ["anios", "45 años"],
      ["semanas", "6 semanas"],
    ]);
  });
});

describe("AgeRecognizer — false-positive controls (no EDAD observation)", () => {
  const FALSE_POSITIVES: readonly string[] = [
    // Treatment-duration months/weeks without an age cue.
    "seguimiento de 6 meses",
    "tratamiento durante 3 semanas",
    "revisión a los 6 meses",
    // Medication dose / room number / bare number without an age unit.
    "toma 45 mg",
    "habitación 45",
    "45",
    "dosis de 45 mg cada 8 horas",
    // Unit-like tokens that are not an age unit.
    "ingreso de 6 días",
  ];

  for (const text of FALSE_POSITIVES) {
    it(`does not emit EDAD for "${text}"`, () => {
      expect(observe(text)).toEqual([]);
    });
  }
});

describe("AgeRecognizer — plausibility bound (0–129 completed years)", () => {
  it("rejects implausible magnitudes above the documented bound", () => {
    expect(observe("300 años")).toEqual([]);
    expect(observe("130 años")).toEqual([]);
  });

  it("accepts the documented bound endpoints", () => {
    expect(observe("0 años").map((observation) => observation.text)).toEqual(["0 años"]);
    expect(observe("129 años").map((observation) => observation.text)).toEqual(["129 años"]);
  });

  it("exposes the bound as named constants (detection bound, not a policy band)", () => {
    expect(AGE_PLAUSIBLE_MIN_YEARS).toBe(0);
    expect(AGE_PLAUSIBLE_MAX_YEARS).toBe(129);
  });
});

describe("AgeRecognizer — policy invariance", () => {
  it("exposes no policy/operator/review input on the recognizer API", () => {
    const recognizer = new AgeRecognizer();
    expect(recognizer.key).toBe(AGE_RECOGNIZER_KEY);
    expect(Object.keys(recognizer)).toEqual(["key"]);
    // observe(text) takes exactly one parameter: the source text.
    expect(AgeRecognizer.prototype.observe.length).toBe(1);
    expect(recognizer).not.toHaveProperty("policy");
    expect(recognizer).not.toHaveProperty("operator");
    expect(recognizer).not.toHaveProperty("profile");
  });

  it("carries only the identity fields of the recognition contract", () => {
    const [observation] = observe("La paciente tiene 45 años.");
    expect(Object.keys(observation).sort()).toEqual([
      "confidence",
      "end",
      "original",
      "start",
      "subtype",
      "text",
      "type",
    ]);
    expect(observation).not.toHaveProperty("transformed");
    expect(observation).not.toHaveProperty("proposed");
    expect(observation).not.toHaveProperty("requiresReview");
    expect(observation).not.toHaveProperty("policyId");
  });

  it("is deterministic: identical observations on repeated calls", () => {
    const text = "45 años; seguimiento de 6 meses; 104 años";
    expect(observe(text)).toEqual(observe(text));
    // The pediatric cue suppresses the treatment-duration fragment.
    expect(observe(text).map((observation) => observation.text)).toEqual(["45 años", "104 años"]);
  });

  it("returns frozen, JSON-serializable observations", () => {
    const observations = observe("45 años");
    expect(Object.isFrozen(observations)).toBe(true);
    for (const observation of observations) {
      expect(Object.isFrozen(observation)).toBe(true);
      expect(() => JSON.stringify(observation)).not.toThrow();
      expect(JSON.parse(JSON.stringify(observation))).toEqual(observation);
    }
  });
});

describe("AgeRecognizer — fail-closed input handling", () => {
  it("rejects invalid, empty and oversized text with the existing engine error codes", () => {
    const recognizer = new AgeRecognizer();
    expect(() => recognizer.observe(42 as unknown as string)).toThrowError(EngineError);
    expect(() => recognizer.observe("   \n\t ")).toThrowError(EngineError);
    expect(() => recognizer.observe("x".repeat(1_000_001))).toThrowError(EngineError);
    try {
      recognizer.observe("");
      throw new Error("expected observe to throw");
    } catch (error) {
      expect((error as EngineError).code).toBe("empty-text");
    }
    try {
      recognizer.observe(42 as unknown as string);
      throw new Error("expected observe to throw");
    } catch (error) {
      expect((error as EngineError).code).toBe("invalid-text");
    }
  });
});
