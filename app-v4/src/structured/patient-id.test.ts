import { describe, expect, it } from "vitest";

import { classifyGridColumns } from "./classification";
import { resolvePatientIdColumn } from "./patient-id";
import type { StructuredGrid } from "./grid";

/**
 * T18 #22: "Exactly one patient-ID authority exists" (SPEC §6, STRUCT-002).
 * Two columns match patient-ID-like headers; the authority must come ONLY
 * from the explicit selection.
 */
const TWO_CANDIDATES_GRID: StructuredGrid = {
  headers: ["NHC", "Nombre", "ID_Paciente"],
  rows: [
    ["00123", "Ana", "P-0001"],
    ["00456", "Luis", "P-0002"],
  ],
};

function classificationsFor(grid: StructuredGrid) {
  return classifyGridColumns(grid);
}

describe("resolvePatientIdColumn", () => {
  it("resolves EXACTLY the explicitly selected column when several candidates exist", () => {
    const resolution = resolvePatientIdColumn({
      selectedPatientIdColumn: "ID_Paciente",
      classifications: classificationsFor(TWO_CANDIDATES_GRID),
    });
    expect(resolution).toEqual({
      status: "resolved",
      column: "ID_Paciente",
      columnIndex: 2,
    });
  });

  it("never auto-selects a candidate: no selection means zero authority", () => {
    const resolution = resolvePatientIdColumn({
      classifications: classificationsFor(TWO_CANDIDATES_GRID),
    });
    expect(resolution.status).toBe("not-selected");
    if (resolution.status === "not-selected") {
      expect(resolution.candidates).toEqual(["NHC", "ID_Paciente"]);
    }
  });

  it("an explicit selection overrides candidate order (first match is NOT privileged)", () => {
    const resolution = resolvePatientIdColumn({
      selectedPatientIdColumn: "NHC",
      classifications: classificationsFor(TWO_CANDIDATES_GRID),
    });
    expect(resolution).toEqual({ status: "resolved", column: "NHC", columnIndex: 0 });
  });

  it("fails closed when the selection names a non-existent column", () => {
    const resolution = resolvePatientIdColumn({
      selectedPatientIdColumn: "No_Existe",
      classifications: classificationsFor(TWO_CANDIDATES_GRID),
    });
    expect(resolution.status).toBe("selection-error");
    if (resolution.status === "selection-error") {
      expect(resolution.message).toContain("No_Existe");
    }
  });

  it("a grid without any candidate and without selection has zero authority", () => {
    const resolution = resolvePatientIdColumn({
      classifications: classificationsFor({ headers: ["Diagnostico"], rows: [["Gripe A"]] }),
    });
    expect(resolution).toEqual({ status: "not-selected", candidates: [] });
  });

  it("classification alone never confers patient-ID authority (no per-column semantics)", () => {
    const classifications = classificationsFor(TWO_CANDIDATES_GRID);
    for (const classification of classifications) {
      // The classification model carries classes/actions only; nothing in it
      // can act as a second, conflicting patient-ID authority.
      expect(classification.proposedAction).not.toBe("pseudonymize-patient-id");
      expect(Object.hasOwn(classification, "isPatientId")).toBe(false);
    }
  });
});
