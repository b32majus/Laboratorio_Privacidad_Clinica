import { describe, expect, it } from "vitest";

import { codifyColumnValues } from "./codify";

/**
 * T18 #22: "Blank/null values remain blank/null and are not codified"
 * (SPEC §9, STRUCT-009).
 */
describe("codifyColumnValues", () => {
  it("keeps blank values as null absence in the codified output", () => {
    const result = codifyColumnValues(["Centro A", null, "Centro B", ""]);
    expect(result.coded).toEqual([0, null, 1, null]);
  });

  it("NEVER adds a blank value to the category map (adversarial oracle)", () => {
    const result = codifyColumnValues([null, "", "Centro A"]);
    // A naive implementation that codifies empties into a placeholder
    // category ("SIN_DATOS", "missing", an extra code...) would produce a
    // blank key or an extra code here; both fail.
    for (const key of result.mapping.keys()) {
      expect(key).not.toBe("");
      expect(key).not.toBe("SIN_DATOS");
      expect(key.trim()).not.toBe("");
    }
    expect(result.mapping.size).toBe(1);
    expect(result.mapping.get("Centro A")).toBe(0);
  });

  it("assigns stable codes to distinct values in first-appearance order", () => {
    const result = codifyColumnValues(["B", "A", "B", "C", "A"]);
    expect(result.mapping).toEqual(
      new Map([
        ["B", 0],
        ["A", 1],
        ["C", 2],
      ])
    );
    expect(result.coded).toEqual([0, 1, 0, 2, 1]);
  });

  it("preserves blank position: blank cells stay blank, not zero-coded", () => {
    const result = codifyColumnValues([null, "A", null]);
    expect(result.coded[0]).toBeNull();
    expect(result.coded[2]).toBeNull();
    expect(result.coded[1]).toBe(0);
  });

  it("an all-blank column codifies to all-absence with an empty map", () => {
    const result = codifyColumnValues([null, "", null]);
    expect(result.coded).toEqual([null, null, null]);
    expect(result.mapping.size).toBe(0);
  });

  it("does not treat whitespace-only strings as blank (content is preserved)", () => {
    const result = codifyColumnValues([" ", "A"]);
    expect(result.mapping.has(" ")).toBe(true);
    expect(result.coded).toEqual([0, 1]);
  });
});
