import { describe, expect, it } from "vitest";

import {
  STRUCTURED_COLUMN_CLASSES,
  StructuredConfigurationError,
  allowedActionsForColumn,
  createStructuredConfiguration,
  overrideColumnAction,
  overrideColumnClass,
  selectPatientIdColumn,
  setStructuredDateRole,
} from "./configuration";
import type { StructuredGrid } from "./grid";

/**
 * REC-03 WU-C (D-021 free-text columns) oracles: `process-as-text` is an
 * explicit Action — never a sixth class — available only for text-like,
 * non-patient-ID, non-date-role columns under the bounded rules. Synthetic
 * fixtures only.
 *
 * Columns: Notas (unknown, text), Diagnostico (sensitive, text),
 * CP (quasi, text), NHistorias (identifier, numeric), Centro (quasi, text).
 */
const GRID: StructuredGrid = {
  headers: ["Notas", "Diagnostico", "CP", "NHistorias", "Centro"],
  rows: [
    ["nota de evolucion clinica", "Gripe A", "texto libre cp", 1001, "nota de centro"],
    ["seguimiento del paciente", "Fractura", "otro texto cp", 1002, "otra nota"],
  ],
};

function byHeader(header: string) {
  const config = createStructuredConfiguration(GRID);
  const column = config.columns.find((candidate) => candidate.header === header);
  if (!column) throw new Error(`missing column ${header}`);
  return { config, column };
}

describe("WU-C — process-as-text is a bounded Action, not a class", () => {
  it("adds no sixth class: the accepted class vocabulary is unchanged", () => {
    expect([...STRUCTURED_COLUMN_CLASSES]).toEqual([
      "identifier",
      "quasi-identifier",
      "sensitive",
      "insensitive",
      "unknown",
    ]);
  });

  it("a text-like Unknown column may resolve explicitly to process-as-text (never Keep)", () => {
    const { config, column } = byHeader("Notas");
    expect(column.effectiveClass).toBe("unknown");
    expect(column.inferredType).toBe("text");
    expect(column.allowedActions).toContain("process-as-text");
    expect(column.allowedActions).toContain("review-required");
    expect(column.allowedActions).not.toContain("keep");
    const resolved = overrideColumnAction(config, column.columnIndex, "process-as-text");
    expect(resolved.columns[column.columnIndex].effectiveAction).toBe("process-as-text");
    expect(resolved.columns[column.columnIndex].actionSource).toBe("explicit");
    expect(() => overrideColumnAction(config, column.columnIndex, "keep")).toThrow(
      StructuredConfigurationError
    );
  });

  it("a text-like Sensitive column allows keep or process-as-text", () => {
    const { config, column } = byHeader("Diagnostico");
    expect(column.effectiveClass).toBe("sensitive");
    expect(column.allowedActions).toEqual(expect.arrayContaining(["keep", "process-as-text"]));
    const routed = overrideColumnAction(config, column.columnIndex, "process-as-text");
    expect(routed.columns[column.columnIndex].effectiveAction).toBe("process-as-text");
  });

  it("a text-like non-date quasi allows process-as-text alongside pseudonymize/keep", () => {
    const { config, column } = byHeader("CP");
    expect(column.effectiveClass).toBe("quasi-identifier");
    expect(column.allowedActions).toEqual(
      expect.arrayContaining(["review-required", "pseudonymize", "keep", "process-as-text"])
    );
    const routed = overrideColumnAction(config, column.columnIndex, "process-as-text");
    expect(routed.columns[column.columnIndex].effectiveAction).toBe("process-as-text");
  });

  it("Identifier, Insensitive, patient-ID and date-role columns reject process-as-text typed/closed", () => {
    const base = createStructuredConfiguration(GRID);
    const numeric = base.columns.find((candidate) => candidate.header === "NHistorias");
    expect(numeric?.effectiveClass).toBe("identifier");
    expect(() => overrideColumnAction(base, numeric?.columnIndex ?? -1, "process-as-text")).toThrow(
      StructuredConfigurationError
    );

    const insensitive = overrideColumnClass(base, 0, "insensitive");
    expect(() => overrideColumnAction(insensitive, 0, "process-as-text")).toThrow(
      StructuredConfigurationError
    );

    const withPatientId = selectPatientIdColumn(base, "NHistorias");
    try {
      overrideColumnAction(withPatientId, numeric?.columnIndex ?? -1, "process-as-text");
      throw new Error("expected a locked patient-ID column to reject process-as-text");
    } catch (error) {
      expect(error).toBeInstanceOf(StructuredConfigurationError);
      expect((error as StructuredConfigurationError).code).toBe("invalid-action");
    }

    const withDateRole = setStructuredDateRole(base, 1, "visit");
    expect(() => overrideColumnAction(withDateRole, 1, "process-as-text")).toThrow(
      StructuredConfigurationError
    );
  });

  it("a non-text column rejects process-as-text (text-like only)", () => {
    const numericGrid: StructuredGrid = {
      headers: ["EdadNumero", "Notas"],
      rows: [
        [42, "nota libre"],
        [43, "otra nota"],
      ],
    };
    const config = createStructuredConfiguration(numericGrid);
    const numeric = config.columns.find((candidate) => candidate.header === "EdadNumero");
    // Numeric content infers a non-text type; process-as-text is not offered.
    expect(numeric?.inferredType).not.toBe("text");
    expect(numeric?.allowedActions).not.toContain("process-as-text");
    expect(() =>
      overrideColumnAction(config, numeric?.columnIndex ?? -1, "process-as-text")
    ).toThrow(StructuredConfigurationError);
  });

  it("allowedActionsForColumn exposes process-as-text only for text-like eligible columns", () => {
    expect(
      allowedActionsForColumn({
        effectiveClass: "quasi-identifier",
        header: "CP",
        dateRole: "none",
        isPatientIdColumn: false,
        inferredType: "text",
      })
    ).toContain("process-as-text");
    expect(
      allowedActionsForColumn({
        effectiveClass: "quasi-identifier",
        header: "CP",
        dateRole: "none",
        isPatientIdColumn: false,
        inferredType: "number",
      })
    ).not.toContain("process-as-text");
  });
});
