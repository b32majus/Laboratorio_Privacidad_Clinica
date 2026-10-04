import { describe, expect, it } from "vitest";

import { classifyColumn, classifyGridColumns } from "./classification";
import { profileColumns } from "./column-profile";
import type { StructuredGrid } from "./grid";

const UNKNOWNS_GRID: StructuredGrid = {
  headers: ["Nombre", "CampoLibre1", "Diagnostico"],
  rows: [
    ["Ana", "rotación de sala", "Gripe A"],
    ["Luis", "43", "Fractura"],
    [null, "x-9", "Consulta"],
  ],
};

const EMPTY_HEADER_GRID: StructuredGrid = {
  headers: ["NHC"],
  rows: [[null], [null]],
};

describe("classifyGridColumns", () => {
  it("classifies identifier / sensitive by header pattern", () => {
    const classifications = classifyGridColumns(UNKNOWNS_GRID);
    expect(classifications[0].columnClass).toBe("identifier");
    expect(classifications[0].proposedAction).toBe("remove");
    expect(classifications[0].matchedBy).toBe("header-pattern");

    expect(classifications[2].columnClass).toBe("sensitive");
    expect(classifications[2].proposedAction).toBe("keep");
  });

  it("UNKNOWN becomes Review Required and is NEVER KEEP (STRUCT-001 oracle)", () => {
    const classifications = classifyGridColumns(UNKNOWNS_GRID);
    const unknown = classifications[1];

    expect(unknown.columnClass).toBe("unknown");
    expect(unknown.requiresReview).toBe(true);
    expect(unknown.proposedAction).toBe("review-required");
    // The fail-closed rule under falsification: if a mapping ever sent
    // unknown columns to KEEP, this assertion fails.
    expect(unknown.proposedAction).not.toBe("keep");
    expect(unknown.columnClass).not.toBe("insensitive");
  });

  it("an empty column with a clinical header is still unknown / review-required", () => {
    const [classification] = classifyGridColumns(EMPTY_HEADER_GRID);
    expect(classification.columnClass).toBe("unknown");
    expect(classification.requiresReview).toBe(true);
    expect(classification.proposedAction).toBe("review-required");
  });

  it("content evidence classifies a header-less identifier column", () => {
    const grid: StructuredGrid = {
      headers: ["Extra1"],
      rows: [["12345678Z"], ["87654321A"], [null]],
    };
    const [classification] = classifyGridColumns(grid);
    expect(classification.columnClass).toBe("identifier");
    expect(classification.matchedBy).toBe("content");
    expect(classification.proposedAction).toBe("remove");
  });

  it("never auto-assigns insensitive (fail-closed model)", () => {
    const classifications = classifyGridColumns(UNKNOWNS_GRID);
    for (const classification of classifications) {
      expect(classification.columnClass).not.toBe("insensitive");
    }
  });

  it("carries confidence and evidence sufficient for review", () => {
    const classifications = classifyGridColumns(UNKNOWNS_GRID);
    for (const classification of classifications) {
      expect(classification.confidence).toBeGreaterThanOrEqual(0);
      expect(classification.confidence).toBeLessThanOrEqual(1);
      expect(classification.evidence.length).toBeGreaterThan(0);
    }
  });
});

describe("classifyColumn", () => {
  it("reports the matched header label in evidence for review", () => {
    const grid: StructuredGrid = {
      headers: ["Fecha_Nac"],
      rows: [["1990-05-01"]],
    };
    const [profile] = profileColumns(grid);
    const classification = classifyColumn(profile, ["1990-05-01"]);
    expect(classification.columnClass).toBe("quasi-identifier");
    expect(classification.proposedAction).toBe("review-required");
    expect(classification.evidence[0]).toContain("birth-date header");
  });

  it("a center/ward quasi-identifier header proposes pseudonymize (frozen UX target)", () => {
    const grid: StructuredGrid = {
      headers: ["Centro"],
      rows: [["Centro A"], ["Centro B"], [null]],
    };
    const [profile] = profileColumns(grid);
    const classification = classifyColumn(profile, ["Centro A", "Centro B"]);
    expect(classification.columnClass).toBe("quasi-identifier");
    expect(classification.proposedAction).toBe("pseudonymize");
    expect(classification.evidence[0]).toContain("center/ward header");
  });

  it("a postal-code quasi-identifier header proposes review-required (no invented operator)", () => {
    const grid: StructuredGrid = {
      headers: ["CP"],
      rows: [["28001"], ["28002"], [null]],
    };
    const [profile] = profileColumns(grid);
    const classification = classifyColumn(profile, ["28001", "28002"]);
    expect(classification.columnClass).toBe("quasi-identifier");
    expect(classification.proposedAction).toBe("review-required");
  });
});
