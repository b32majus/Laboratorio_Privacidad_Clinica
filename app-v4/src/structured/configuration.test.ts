import { describe, expect, it } from "vitest";

import {
  STRUCTURED_COLUMN_CLASSES,
  StructuredConfigurationError,
  createStructuredConfiguration,
  isStructuredExportReady,
  overrideColumnClass,
  selectPatientIdColumn,
} from "./configuration";
import { proposedActionForClass } from "./classification";
import type { StructuredGrid } from "./grid";

/**
 * T20 #24 deterministic oracles for the canonical structured configuration
 * authority (SPEC §5/§6/§7, D-009/D-012). Fixtures are synthetic; no real PHI.
 *
 * Columns: NHC (identifier by header), Fecha_Nac (quasi by header),
 * Diagnostico (sensitive by header) and CampoLibre (no evidence → unknown).
 */
const GRID: StructuredGrid = {
  headers: ["NHC", "Fecha_Nac", "Diagnostico", "CampoLibre"],
  rows: [
    ["00123", "1990-05-01", "Gripe A", "rotación de sala"],
    ["00456", "1985-11-23", "Fractura", "seguimiento"],
    [null, null, null, "pendiente"],
  ],
};

describe("proposedActionForClass — accepted class/action mapping", () => {
  it("maps the five accepted classes, with unknown NEVER keep", () => {
    expect(proposedActionForClass("identifier")).toBe("remove");
    expect(proposedActionForClass("quasi-identifier")).toBe("generalize");
    expect(proposedActionForClass("sensitive")).toBe("codify");
    expect(proposedActionForClass("insensitive")).toBe("keep");
    expect(proposedActionForClass("unknown")).toBe("review-required");
    expect(proposedActionForClass("unknown")).not.toBe("keep");
  });
});

describe("createStructuredConfiguration", () => {
  it("exposes exactly the five accepted classes and consumes the T18 detection", () => {
    expect(STRUCTURED_COLUMN_CLASSES).toEqual([
      "identifier",
      "quasi-identifier",
      "sensitive",
      "insensitive",
      "unknown",
    ]);
    const config = createStructuredConfiguration(GRID);
    expect(config.columns.map((column) => column.effectiveClass)).toEqual([
      "identifier",
      "quasi-identifier",
      "sensitive",
      "unknown",
    ]);
    expect(config.columns.map((column) => column.proposedAction)).toEqual([
      "remove",
      "generalize",
      "codify",
      "review-required",
    ]);
  });

  it("UNKNOWN requires review and is NEVER KEEP or exportable (STRUCT-001 oracle)", () => {
    const config = createStructuredConfiguration(GRID);
    const unknown = config.columns[3];
    expect(unknown.detectedClass).toBe("unknown");
    expect(unknown.effectiveClass).toBe("unknown");
    expect(unknown.requiresReview).toBe(true);
    expect(unknown.proposedAction).toBe("review-required");
    expect(unknown.overridden).toBe(false);
    // The fail-closed rule under falsification: a mapping that sent unknown to
    // KEEP or to insensitive would fail these assertions.
    expect(unknown.proposedAction).not.toBe("keep");
    expect(unknown.effectiveClass).not.toBe("insensitive");
    expect(config.columnsRequiringReview).toEqual([3]);
    expect(config.exportReady).toBe(false);
    expect(isStructuredExportReady(config)).toBe(false);
  });

  it("carries confidence and value-free evidence for every column", () => {
    const config = createStructuredConfiguration(GRID);
    for (const column of config.columns) {
      expect(column.confidence).toBeGreaterThanOrEqual(0);
      expect(column.confidence).toBeLessThanOrEqual(1);
      expect(column.evidence.length).toBeGreaterThan(0);
      expect(column.inferredType).toBeDefined();
    }
  });
});

describe("explicit human override changes the canonical configuration", () => {
  it("resolving the unknown column to Insensitive closes the export gate", () => {
    const config = createStructuredConfiguration(GRID);
    const resolved = overrideColumnClass(config, 3, "insensitive");
    const column = resolved.columns[3];
    expect(column.detectedClass).toBe("unknown");
    expect(column.effectiveClass).toBe("insensitive");
    expect(column.overridden).toBe(true);
    expect(column.requiresReview).toBe(false);
    expect(column.proposedAction).toBe("keep");
    expect(resolved.columnsRequiringReview).toEqual([]);
    expect(resolved.exportReady).toBe(true);
    // The frozen configuration is rebuilt, not mutated in place.
    expect(resolved).not.toBe(config);
    expect(config.exportReady).toBe(false);
    expect(config.columns[3].effectiveClass).toBe("unknown");
  });

  it("an override to an identifier column proposes removal (not a label-only change)", () => {
    const config = createStructuredConfiguration(GRID);
    const resolved = overrideColumnClass(config, 3, "identifier");
    expect(resolved.columns[3].effectiveClass).toBe("identifier");
    expect(resolved.columns[3].proposedAction).toBe("remove");
    expect(resolved.exportReady).toBe(true);
  });

  it("overriding one column never mutates another column's classification", () => {
    const config = createStructuredConfiguration(GRID);
    const before = config.columns.map((column) => column.effectiveClass);
    const resolved = overrideColumnClass(config, 0, "insensitive");
    expect(resolved.columns[0].effectiveClass).toBe("insensitive");
    expect(resolved.columns.slice(1).map((column) => column.effectiveClass)).toEqual(
      before.slice(1)
    );
    expect(resolved.columns[3].effectiveClass).toBe("unknown");
    expect(resolved.exportReady).toBe(false);
  });

  it("fails closed on an invalid class or a non-existent column", () => {
    const config = createStructuredConfiguration(GRID);
    expect(() => overrideColumnClass(config, 3, "invented" as never)).toThrow(
      StructuredConfigurationError
    );
    expect(() => overrideColumnClass(config, 99, "sensitive")).toThrow(
      StructuredConfigurationError
    );
    try {
      overrideColumnClass(config, 99, "sensitive");
    } catch (error) {
      expect((error as StructuredConfigurationError).code).toBe("unknown-column");
    }
  });
});

describe("single patient-ID authority (SPEC §6, STRUCT-002)", () => {
  it("starts unselected with the detected candidates surfaced but not auto-selected", () => {
    const config = createStructuredConfiguration(GRID);
    expect(config.patientId.status).toBe("not-selected");
    if (config.patientId.status === "not-selected") {
      expect(config.patientId.candidates).toEqual(["NHC"]);
    }
    expect(config.selectedPatientIdColumn).toBeNull();
  });

  it("resolves ONLY the explicit selection, even for a non-candidate column", () => {
    const config = createStructuredConfiguration(GRID);
    const withSelection = selectPatientIdColumn(config, "Diagnostico");
    expect(withSelection.patientId).toEqual({
      status: "resolved",
      column: "Diagnostico",
      columnIndex: 2,
    });
    expect(withSelection.selectedPatientIdColumn).toBe("Diagnostico");
  });

  it("fails closed when the selection names a non-existent column and can be cleared", () => {
    const config = createStructuredConfiguration(GRID);
    const invalid = selectPatientIdColumn(config, "NoExiste");
    expect(invalid.patientId.status).toBe("selection-error");
    const cleared = selectPatientIdColumn(invalid, null);
    expect(cleared.patientId.status).toBe("not-selected");
    expect(cleared.selectedPatientIdColumn).toBeNull();
  });

  it("an override preserves the explicit patient-ID selection", () => {
    const config = selectPatientIdColumn(createStructuredConfiguration(GRID), "NHC");
    const resolved = overrideColumnClass(config, 3, "insensitive");
    expect(resolved.patientId).toEqual({ status: "resolved", column: "NHC", columnIndex: 0 });
    expect(resolved.exportReady).toBe(true);
  });
});

describe("frozen canonical configuration", () => {
  it("is deeply frozen so React/DOM state cannot mutate authority in place", () => {
    const config = createStructuredConfiguration(GRID);
    expect(Object.isFrozen(config)).toBe(true);
    expect(Object.isFrozen(config.columns)).toBe(true);
    expect(Object.isFrozen(config.columns[0])).toBe(true);
    expect(Object.isFrozen(config.overrides)).toBe(true);
    expect(() => {
      (config as { exportReady: boolean }).exportReady = true;
    }).toThrow();
  });
});
