import { describe, expect, it } from "vitest";

import { profileColumns, sampleColumnValues } from "./column-profile";
import type { StructuredGrid } from "./grid";

/**
 * T18 #22 deterministic verification: "Column inference samples multiple
 * non-empty values" (SPEC §7, STRUCT-004).
 *
 * Trap fixture: the FIRST data row of `Correo` looks like a number ("12345"),
 * every other non-empty value is an email-like text. A first-row-only
 * profiler infers number; distributed sampling must infer text. All values
 * are synthetic tokens.
 */
const TRAP_GRID: StructuredGrid = {
  headers: ["Correo", "NHC"],
  rows: [
    ["12345", "00123"],
    ["ana@ejemplo.test", null],
    ["luis@ejemplo.test", "00456"],
    [null, "00789"],
    ["marta@ejemplo.test", null],
    ["pedro@ejemplo.test", "00111"],
    [null, null],
    ["lucia@ejemplo.test", "00222"],
  ],
};

describe("profileColumns", () => {
  it("is not fooled by a misleading first data row (distributed sampling)", () => {
    const [correo] = profileColumns(TRAP_GRID);
    expect(correo.inferredType).toBe("text");
    expect(correo.confidence).toBeLessThan(1);
  });

  it("samples multiple non-empty values distributed through the column", () => {
    const [correo] = profileColumns(TRAP_GRID, { sampleSize: 4 });
    expect(correo.sampledCount).toBe(4);
    const sampled = sampleColumnValues(TRAP_GRID, 0, 4);
    // Samples come from the whole column (the tail is represented), not only
    // the head: a first-row-only profiler would sample exactly one value.
    expect(sampled).toContain("lucia@ejemplo.test");
    expect(sampled.length).toBeGreaterThan(1);
  });

  it("infers number consistently when all sampled values are numeric", () => {
    const [, nhc] = profileColumns(TRAP_GRID);
    expect(nhc.inferredType).toBe("number");
    expect(nhc.confidence).toBe(1);
  });

  it("infers date from ISO and slash date strings", () => {
    const grid: StructuredGrid = {
      headers: ["F"],
      rows: [["2020-01-15"], ["15/01/2021"], [null], ["2021-03-02"]],
    };
    const [profile] = profileColumns(grid);
    expect(profile.inferredType).toBe("date");
  });

  it("treats an all-blank column as empty with zero confidence", () => {
    const grid: StructuredGrid = { headers: ["V"], rows: [[null], [null], [""]] };
    const [profile] = profileColumns(grid);
    expect(profile.inferredType).toBe("empty");
    expect(profile.confidence).toBe(0);
    expect(profile.nonEmptyCount).toBe(0);
    expect(profile.emptyCount).toBe(3);
  });

  it("counts blank cells as absence and never samples them", () => {
    const grid: StructuredGrid = {
      headers: ["X"],
      rows: [["a"], [null], ["b"], [""], ["c"]],
    };
    const [profile] = profileColumns(grid);
    expect(profile.nonEmptyCount).toBe(3);
    expect(profile.emptyCount).toBe(2);
    expect(sampleColumnValues(grid, 0)).toEqual(["a", "b", "c"]);
  });

  it("carries human-reviewable evidence without embedding cell values", () => {
    const [correo] = profileColumns(TRAP_GRID);
    expect(correo.evidence.length).toBeGreaterThan(0);
    for (const line of correo.evidence) {
      expect(line).not.toMatch(/@/); // no sampled email in evidence
    }
  });
});
