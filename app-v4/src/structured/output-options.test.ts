import { describe, expect, it } from "vitest";

import {
  createDefaultStructuredOutputOptions,
  resolveStudyIdPrefix,
  setAddVisitNumber,
  setStudyIdPrefix,
  buildVisitSequence,
  DEFAULT_STUDY_ID_PREFIX,
  VISIT_NUMBER_HEADER,
  StructuredOutputOptionsError,
} from "./output-options";

/**
 * REC-04 WU-B red→green oracles: one canonical job-scoped structured
 * output-options authority (D-022 "Study-ID output options"). Synthetic
 * fixtures only; no real PHI.
 */
describe("study-ID prefix — normalization and validation", () => {
  it("defaults to PAC and resolves blank input to the default", () => {
    expect(DEFAULT_STUDY_ID_PREFIX).toBe("PAC");
    expect(resolveStudyIdPrefix("")).toEqual({ status: "valid", prefix: "PAC" });
    expect(resolveStudyIdPrefix("   ")).toEqual({ status: "valid", prefix: "PAC" });
    expect(resolveStudyIdPrefix(null)).toEqual({ status: "valid", prefix: "PAC" });
    expect(resolveStudyIdPrefix(undefined)).toEqual({ status: "valid", prefix: "PAC" });
  });

  it("upper-cases a valid lowercase prefix: hs1 becomes HS1", () => {
    expect(resolveStudyIdPrefix("hs1")).toEqual({ status: "valid", prefix: "HS1" });
    expect(resolveStudyIdPrefix("  hs1  ")).toEqual({ status: "valid", prefix: "HS1" });
  });

  it("accepts letters followed by letters/digits up to length 10", () => {
    expect(resolveStudyIdPrefix("PAC")).toEqual({ status: "valid", prefix: "PAC" });
    expect(resolveStudyIdPrefix("A")).toEqual({ status: "valid", prefix: "A" });
    expect(resolveStudyIdPrefix("ABCDEFGHIJ")).toEqual({ status: "valid", prefix: "ABCDEFGHIJ" });
    expect(resolveStudyIdPrefix("HOSP1")).toEqual({ status: "valid", prefix: "HOSP1" });
  });

  it("refuses formula-like and punctuated input instead of sanitizing it", () => {
    for (const raw of [
      "=CMD",
      "=1+1",
      "+PAC",
      "-PAC",
      "@PAC",
      "PA;C",
      "PA,C",
      "PA C",
      "1PAC",
      "",
    ]) {
      if (raw === "") continue;
      const resolved = resolveStudyIdPrefix(raw);
      expect(resolved.status, `"${raw}" must refuse`).toBe("invalid");
    }
    // Never silently sanitize arbitrary input into an accepted token.
    expect(resolveStudyIdPrefix("=CMD")).not.toEqual({ status: "valid", prefix: "CMD" });
    const refused = resolveStudyIdPrefix("=CMD");
    expect(refused.status).toBe("invalid");
    if (refused.status !== "invalid") return;
    expect(refused.reason.length).toBeGreaterThan(0);
  });

  it("refuses overlong and digit-leading prefixes", () => {
    expect(resolveStudyIdPrefix("ABCDEFGHIJK").status).toBe("invalid");
    expect(resolveStudyIdPrefix("1PAC").status).toBe("invalid");
  });

  it("storing an invalid prefix fails typed at write time", () => {
    const defaults = createDefaultStructuredOutputOptions(true);
    expect(() => setStudyIdPrefix(defaults, "=CMD")).toThrowError(StructuredOutputOptionsError);
    expect(() => setStudyIdPrefix(defaults, "=CMD")).toThrowError(/prefix/i);
    // The failed write stores nothing: the previous options are untouched.
    expect(defaults.studyIdPrefix).toBe("PAC");
  });
});

describe("output options — heritage defaults", () => {
  it("enables visit numbering by default when a patient-ID authority exists", () => {
    const options = createDefaultStructuredOutputOptions(true);
    expect(options.studyIdPrefix).toBe("PAC");
    expect(options.addVisitNumber).toBe(true);
  });

  it("leaves visit numbering absent without a patient-ID authority", () => {
    const options = createDefaultStructuredOutputOptions(false);
    expect(options.addVisitNumber).toBe(false);
  });

  it("visit numbering is effectively absent without a patient-ID authority", () => {
    const options = createDefaultStructuredOutputOptions(false);
    expect(setAddVisitNumber(options, true, false).addVisitNumber).toBe(false);
    expect(setAddVisitNumber(options, false, false).addVisitNumber).toBe(false);
  });

  it("toggles visit numbering explicitly when the authority exists", () => {
    const options = createDefaultStructuredOutputOptions(true);
    expect(setAddVisitNumber(options, false, true).addVisitNumber).toBe(false);
    expect(
      setAddVisitNumber(setAddVisitNumber(options, false, true), true, true).addVisitNumber
    ).toBe(true);
  });

  it("exposes the Safe visit header name", () => {
    expect(VISIT_NUMBER_HEADER).toBe("Visita_Num");
  });
});

describe("visit sequence — 1-based occurrence per patient in input row order", () => {
  it("numbers repeated patient rows 1,2,… and restarts for the next patient without sorting", () => {
    expect(buildVisitSequence(["P-002", "P-001", "P-002", "P-001", "P-002"])).toEqual([
      1, 1, 2, 2, 3,
    ]);
  });

  it("keeps blanks blank: they never consume a sequence number", () => {
    expect(buildVisitSequence(["P-001", "", "P-001", null])).toEqual([1, null, 2, null]);
  });

  it("treats numeric and boolean patient identifiers verbatim, not by string coercion gaps", () => {
    expect(buildVisitSequence([7, 7, 8])).toEqual([1, 2, 1]);
  });

  it("is deterministic across repeated builds", () => {
    const values = ["P-001", "P-001", "P-002"] as const;
    expect(buildVisitSequence(values)).toEqual(buildVisitSequence(values));
  });
});
