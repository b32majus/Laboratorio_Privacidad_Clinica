import { describe, expect, it } from "vitest";

import {
  MAX_SUPPORTED_EXCEL_SERIAL,
  MIN_SUPPORTED_EXCEL_SERIAL,
  excelSerialToIsoDate,
} from "./excel-serial";

/**
 * T18 #22 deterministic verification: "Serial-date fixture" (SPEC §9,
 * STRUCT-008). Excel 1900-system serials normalized to ISO dates (UTC).
 */
describe("excelSerialToIsoDate", () => {
  it("normalizes a modern clinical serial (2020-01-15 = 43845)", () => {
    expect(excelSerialToIsoDate(43845)).toBe("2020-01-15");
  });

  it("normalizes the first serial mapped exactly by the 1899-12-30 anchor (1900-03-01 = 61)", () => {
    expect(excelSerialToIsoDate(61)).toBe("1900-03-01");
  });

  it("normalizes the last supported serial (9999-12-31 = 2958465)", () => {
    expect(excelSerialToIsoDate(2958465)).toBe("9999-12-31");
  });

  it("normalizes a leap-day serial inside the supported range (2020-02-29)", () => {
    expect(excelSerialToIsoDate(43890)).toBe("2020-02-29");
  });

  it("drops a fractional time-of-day part, keeping the calendar date", () => {
    expect(excelSerialToIsoDate(43845.5)).toBe("2020-01-15");
  });

  it("rejects serials below the supported range (Lotus leap-year gap, fail-closed)", () => {
    expect(excelSerialToIsoDate(60)).toBeNull(); // phantom 1900-02-29
    expect(excelSerialToIsoDate(MIN_SUPPORTED_EXCEL_SERIAL - 1)).toBeNull();
    expect(excelSerialToIsoDate(0)).toBeNull();
    expect(excelSerialToIsoDate(-5)).toBeNull();
  });

  it("rejects serials above the supported range and non-finite input", () => {
    expect(excelSerialToIsoDate(MAX_SUPPORTED_EXCEL_SERIAL + 1)).toBeNull();
    expect(excelSerialToIsoDate(Number.NaN)).toBeNull();
    expect(excelSerialToIsoDate(Number.POSITIVE_INFINITY)).toBeNull();
  });
});
