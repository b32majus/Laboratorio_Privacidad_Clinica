import { describe, expect, it } from "vitest";

import { shiftDateString } from "../engine/date-shift";
import { readDateShiftState, DateGeneralizeOperator } from "../engine/date-operator";
import {
  AGE_DECADE_BANDS,
  AgeGeneralizeOperator,
  AgeOperatorError,
  generalizeCompletedYears,
} from "../engine/age-operator";
import {
  deriveAgeAtEvent,
  derivePatientDateShiftState,
  generalizeMonthStructuredDate,
  parseStructuredDateCell,
  shiftStructuredDateCell,
  StructuredDateAgeError,
} from "./date-age";

/**
 * T19 #23 WU-A deterministic verification: structured date/age semantics
 * (SPEC_V4_BATCH_AND_STRUCTURED.md §10, DEBT STRUCT-006).
 *
 * Fixtures are fully synthetic. The historical-visit fixture pins the age
 * to the visit/event date of 2023; an implementation that measured against
 * the current date (2026 or later) would derive 72+ years and FAIL these
 * oracles — that is the falsification contract, not a tautology.
 */

const HISTORICAL_BIRTH_NUMERIC = "12/03/1954"; // 12 March 1954 (day-first)
const HISTORICAL_BIRTH_ISO = "1954-03-12";
const HISTORICAL_VISIT_ISO = "2023-05-10";
const HISTORICAL_AGE_AT_VISIT = 69; // birthday (March 12) before visit (May 10)

describe("parseStructuredDateCell", () => {
  it("parses the ISO format the T18 parser authority normalizes to", () => {
    const parse = parseStructuredDateCell("2023-05-10");
    expect(parse.kind).toBe("parsed");
    if (parse.kind !== "parsed") return;
    expect(parse.date).toEqual({
      year: 2023,
      month: 5,
      day: 10,
      sourceFormat: "iso",
    });
  });

  it("parses numeric day-first cells with the Spanish dd/mm convention", () => {
    const parse = parseStructuredDateCell("12/03/1954");
    expect(parse.kind).toBe("parsed");
    if (parse.kind !== "parsed") return;
    expect(parse.date.year).toBe(1954);
    expect(parse.date.month).toBe(3);
    expect(parse.date.day).toBe(12);
    expect(parse.date.numericSeparator).toBe("/");
  });

  it("keeps absence (null/undefined/empty string) as absence", () => {
    expect(parseStructuredDateCell(null)).toEqual({ kind: "absent" });
    expect(parseStructuredDateCell(undefined)).toEqual({ kind: "absent" });
    expect(parseStructuredDateCell("")).toEqual({ kind: "absent" });
  });

  it("marks unparseable content without guessing (2-digit years, garbage, raw serials, impossible dates)", () => {
    expect(parseStructuredDateCell("12/03/54").kind).toBe("unparsed");
    expect(parseStructuredDateCell("próxima semana").kind).toBe("unparsed");
    expect(parseStructuredDateCell(43845).kind).toBe("unparsed"); // raw serial never re-normalized here
    expect(parseStructuredDateCell("2023-02-30").kind).toBe("unparsed"); // roll-over date
    expect(parseStructuredDateCell("31/02/2024").kind).toBe("unparsed");
  });

  it("fails closed on a non-cell argument", () => {
    expect(() => parseStructuredDateCell({} as never)).toThrow(StructuredDateAgeError);
  });
});

describe("deriveAgeAtEvent (STRUCT-006: age at the visit/event date, never the current date)", () => {
  it("derives the age from the historical visit date, not from today", () => {
    // Mixed source formats must agree: the calendar day is the semantics.
    expect(deriveAgeAtEvent(HISTORICAL_BIRTH_NUMERIC, HISTORICAL_VISIT_ISO)).toEqual({
      kind: "derived",
      years: HISTORICAL_AGE_AT_VISIT,
    });
    expect(deriveAgeAtEvent(HISTORICAL_BIRTH_ISO, HISTORICAL_VISIT_ISO)).toEqual({
      kind: "derived",
      years: HISTORICAL_AGE_AT_VISIT,
    });
    expect(deriveAgeAtEvent(HISTORICAL_BIRTH_ISO, "10/05/2023")).toEqual({
      kind: "derived",
      years: HISTORICAL_AGE_AT_VISIT,
    });
  });

  it("counts the birthday boundary deterministically", () => {
    expect(deriveAgeAtEvent("1954-05-10", "2023-05-10")).toEqual({ kind: "derived", years: 69 });
    expect(deriveAgeAtEvent("1954-05-10", "2023-05-09")).toEqual({ kind: "derived", years: 68 });
    expect(deriveAgeAtEvent("1954-05-10", "2023-05-11")).toEqual({ kind: "derived", years: 69 });
  });

  it("bands the derived age with the accepted T12 labels, not the current year", () => {
    const age = deriveAgeAtEvent(HISTORICAL_BIRTH_ISO, HISTORICAL_VISIT_ISO);
    if (age.kind !== "derived") throw new Error("fixture must derive");
    expect(generalizeCompletedYears(age.years)).toBe("60–69 años");
    expect(generalizeCompletedYears(age.years)).not.toBe("70–79 años");
  });

  it("keeps absence as absence and never fabricates an age from a missing event date", () => {
    expect(deriveAgeAtEvent(HISTORICAL_BIRTH_ISO, null)).toEqual({ kind: "absent" });
    expect(deriveAgeAtEvent(null, HISTORICAL_VISIT_ISO)).toEqual({ kind: "absent" });
    expect(deriveAgeAtEvent(null, null)).toEqual({ kind: "absent" });
    expect(deriveAgeAtEvent(HISTORICAL_BIRTH_ISO, "")).toEqual({ kind: "absent" });
  });

  it("fails closed to review on unparseable content and on an event before the birth", () => {
    expect(deriveAgeAtEvent("sin fecha", HISTORICAL_VISIT_ISO).kind).toBe("review-required");
    expect(deriveAgeAtEvent(HISTORICAL_BIRTH_ISO, "por definir").kind).toBe("review-required");
    const negative = deriveAgeAtEvent("2023-01-10", "1954-03-12");
    expect(negative.kind).toBe("review-required");
    if (negative.kind === "review-required") {
      expect(negative.reason).toContain("precedes the birth date");
    }
  });
});

describe("generalizeCompletedYears (accepted T12 banding reused, not duplicated)", () => {
  it("agrees with the AgeGeneralizeOperator for the same source years", () => {
    const operator = new AgeGeneralizeOperator();
    const observation = {
      type: "EDAD",
      subtype: "anios",
      text: "69 años",
      start: 0,
      end: 7,
      confidence: 1,
    };
    expect(generalizeCompletedYears(69)).toBe(operator.apply(observation, { strictMode: false }));
    expect(generalizeCompletedYears(90)).toBe("90+ años");
    expect(AGE_DECADE_BANDS.map((band) => band.label)).toContain("60–69 años");
  });

  it("fails closed on invalid year counts", () => {
    expect(() => generalizeCompletedYears(-1)).toThrow(AgeOperatorError);
    expect(() => generalizeCompletedYears(1.5)).toThrow(AgeOperatorError);
  });
});

describe("shiftStructuredDateCell", () => {
  it("preserves the ISO source format exactly once", () => {
    const outcome = shiftStructuredDateCell("2023-05-10", 100);
    expect(outcome.kind).toBe("transformed");
    if (outcome.kind !== "transformed") return;
    expect(outcome.value).toBe("2023-08-18");
    expect(outcome.value).not.toBe("2023-05-10");
  });

  it("shifts numeric day-first cells through the accepted date-shift foundation (no drift)", () => {
    const outcome = shiftStructuredDateCell("12/03/1954", -500);
    expect(outcome).toEqual({ kind: "transformed", value: shiftDateString("12/03/1954", -500) });
    expect(outcome).toEqual({ kind: "transformed", value: "28/10/1952" });
  });

  it("keeps absence as absence and marks unparseable content for review", () => {
    expect(shiftStructuredDateCell(null, 10)).toEqual({ kind: "absent" });
    expect(shiftStructuredDateCell("", 10)).toEqual({ kind: "absent" });
    const unparsed = shiftStructuredDateCell("pendiente", 10);
    expect(unparsed.kind).toBe("review-required");
    if (unparsed.kind === "review-required") {
      expect(unparsed.reason).toContain("not a parseable structured date");
    }
  });

  it("fails closed on non-integer or out-of-bounds offsets", () => {
    expect(() => shiftStructuredDateCell("2023-05-10", 1.5)).toThrow(StructuredDateAgeError);
    expect(() => shiftStructuredDateCell("2023-05-10", 4000)).toThrow(StructuredDateAgeError);
    expect(() => shiftStructuredDateCell("2023-05-10", Number.NaN)).toThrow(StructuredDateAgeError);
  });
});

describe("generalizeMonthStructuredDate (legacy date-transform mirror)", () => {
  it("mirrors the accepted legacy fecha_completa output for numeric day-first cells", () => {
    // Direct parity with the accepted T13 generalization operator output.
    const legacy = new DateGeneralizeOperator().apply(
      {
        type: "FECHA",
        subtype: "fecha_completa",
        text: "12/03/1954",
        start: 0,
        end: 10,
        confidence: 1,
      },
      { strictMode: false }
    );
    const structured = generalizeMonthStructuredDate("12/03/1954");
    expect(structured).toEqual({ kind: "transformed", value: legacy });
    expect(generalizeMonthStructuredDate("12-03-1954")).toEqual({
      kind: "transformed",
      value: "03-1954",
    });
  });

  it("reduces ISO cells to ISO month precision without re-parsing them into another format", () => {
    expect(generalizeMonthStructuredDate("1954-03-12")).toEqual({
      kind: "transformed",
      value: "1954-03",
    });
  });

  it("keeps absence as absence and marks unparseable content for review", () => {
    expect(generalizeMonthStructuredDate(null)).toEqual({ kind: "absent" });
    expect(generalizeMonthStructuredDate("2023-02-30").kind).toBe("review-required");
  });
});

describe("derivePatientDateShiftState (per-patient consistency and isolation)", () => {
  const JOB_SEED = "job-2026-overnight-t19";

  it("is deterministic: the same job seed and patient derive the identical state", () => {
    const first = derivePatientDateShiftState(JOB_SEED, "P-001");
    const second = derivePatientDateShiftState(JOB_SEED, "P-001");
    expect(second).toEqual(first);
    expect(Object.isFrozen(first)).toBe(true);
  });

  it("isolates patients: different identities derive different offsets (fixture-pinned)", () => {
    const p1 = derivePatientDateShiftState(JOB_SEED, "P-001");
    const p2 = derivePatientDateShiftState(JOB_SEED, "P-002");
    expect(p1.seed).not.toBe(p2.seed);
    expect(p1.contextOffsetDays).not.toBe(p2.contextOffsetDays);
    // Re-deriving P-001 after P-002 changes nothing (no shared mutable state).
    expect(derivePatientDateShiftState(JOB_SEED, "P-001")).toEqual(p1);
  });

  it("produces the exact ProcessingContext.options.dateShift payload shape (SPEC §7 seam)", () => {
    const state = derivePatientDateShiftState(JOB_SEED, "P-001");
    expect(readDateShiftState({ dateShift: state })).toBe(state);
  });

  it("fails closed on a missing job seed or a blank patient identity", () => {
    expect(() => derivePatientDateShiftState("", "P-001")).toThrow(StructuredDateAgeError);
    expect(() => derivePatientDateShiftState("   ", "P-001")).toThrow(StructuredDateAgeError);
    expect(() => derivePatientDateShiftState(JOB_SEED, null)).toThrow(StructuredDateAgeError);
    expect(() => derivePatientDateShiftState(JOB_SEED, "")).toThrow(StructuredDateAgeError);
  });
});
