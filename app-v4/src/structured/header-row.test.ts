import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

import {
  HEADER_ROW_TOKENS,
  MAX_HEADER_INSPECTION_ROWS,
  MIN_HEADER_TEXT_CELLS,
  detectHeaderCandidates,
  resolveHeaderRow,
  validateHeaderRowSelection,
  type HeaderRowMatrix,
} from "./header-row";

/**
 * REC-04 WU-A (D-022) red→green oracles for the workbook header-row detector.
 *
 * The detector is pure and workbook-agnostic: it runs over the already
 * normalized cell matrix (StructuredCell values exactly as the Excel
 * authority produces them — date serials already ISO strings, blanks already
 * null). Workbook wiring (explicit sheet first, metadata skipping, size
 * gates) is owned by `excel.ts` / `intake.ts` and their oracles.
 *
 * All fixtures are synthetic; no real PHI anywhere.
 */

function matrix(rows: (string | number | boolean | null)[][]): HeaderRowMatrix {
  return rows;
}

describe("header-row detector — contract constants", () => {
  it("inspects at most the first 10 used rows and needs 3 textual cells", () => {
    expect(MAX_HEADER_INSPECTION_ROWS).toBe(10);
    expect(MIN_HEADER_TEXT_CELLS).toBe(3);
  });

  it("carries the accepted v3 clinical/header token vocabulary", () => {
    expect([...HEADER_ROW_TOKENS]).toEqual([
      "nhc",
      "nombre",
      "apellido",
      "fecha",
      "dni",
      "paciente",
      "id",
      "codigo",
      "edad",
      "sexo",
      "telefono",
      "email",
      "direccion",
      "centro",
      "medico",
      "diagnostico",
      "procedimiento",
      "visita",
    ]);
  });
});

describe("detectHeaderCandidates — single obvious candidate", () => {
  it("resolves 3 explanatory metadata rows + real headers on row 4", () => {
    const rows = matrix([
      ["Hospital General — informe de altas", null, null],
      ["Generado el 2026-10-04", null, null],
      [null, null, null],
      ["NHC", "Nombre", "Edad"],
      ["00123", "Ana", 33],
      ["00456", "Luis", 41],
    ]);
    const detection = detectHeaderCandidates(rows);
    expect(detection.inspectedRowCount).toBe(6);
    expect(detection.candidateRowIndices).toEqual([3]);
  });

  it("a token match qualifies a row with 3 textual cells and no numerics", () => {
    const detection = detectHeaderCandidates(
      matrix([
        ["NHC", "Nombre", "Edad"],
        [123, "Ana", 33],
        [456, "Luis", 41],
      ])
    );
    expect(detection.candidateRowIndices).toEqual([0]);
  });

  it("textual majority qualifies without any token match", () => {
    const detection = detectHeaderCandidates(
      matrix([
        ["Alpha", "Beta", "Gamma"],
        ["a", "b", 1],
        ["c", "d", 2],
      ])
    );
    expect(detection.candidateRowIndices).toEqual([0]);
  });

  it("token matching is case-insensitive", () => {
    const detection = detectHeaderCandidates(
      matrix([
        ["PACIENTE", "FECHA", "MEDICO"],
        [1, 2, 3],
      ])
    );
    expect(detection.candidateRowIndices).toEqual([0]);
  });

  it("rows with fewer than 3 textual cells never qualify, even with a token", () => {
    const detection = detectHeaderCandidates(
      matrix([
        ["Paciente", "Fecha", null],
        ["P-001", "2023-01-10"],
      ])
    );
    expect(detection.candidateRowIndices).toEqual([]);
  });

  it("a numeric-heavy row without tokens does not qualify", () => {
    const detection = detectHeaderCandidates(
      matrix([
        ["NHC", "Nombre", "Edad"],
        [123, 45, 67],
      ])
    );
    expect(detection.candidateRowIndices).toEqual([0]);
  });
});

describe("detectHeaderCandidates — ambiguity blocks instead of guessing", () => {
  it("two qualifying candidate rows block with both inspected row indices", () => {
    const rows = matrix([
      ["NHC", "Nombre", "Centro"],
      ["00123", "Ana", "Centro Norte"],
      ["00456", null, null],
    ]);
    const detection = detectHeaderCandidates(rows);
    expect(detection.candidateRowIndices).toEqual([0, 1]);
    const resolved = resolveHeaderRow(rows);
    expect(resolved.status).toBe("header-row-required");
    if (resolved.status !== "header-row-required") return;
    expect(resolved.candidateRowIndices).toEqual([0, 1]);
    expect(resolved.inspectedRowCount).toBe(3);
    expect(resolved.headerRowIndex).toBeUndefined();
  });

  it("zero candidates blocks with an empty candidate list, never a silent row 1", () => {
    const rows = matrix([
      ["a", "b"],
      [1, 2],
      [3, 4],
    ]);
    const resolved = resolveHeaderRow(rows);
    expect(resolved.status).toBe("header-row-required");
    if (resolved.status !== "header-row-required") return;
    expect(resolved.candidateRowIndices).toEqual([]);
    expect(resolved.inspectedRowCount).toBe(3);
  });

  it("exactly one candidate auto-resolves to that row", () => {
    const resolved = resolveHeaderRow(
      matrix([
        ["Informe trimestral", null, null, null],
        ["NHC", "Nombre", "Edad", "Centro"],
        ["00123", "Ana", 33, null],
        [456, null, null, null],
      ])
    );
    expect(resolved.status).toBe("resolved");
    if (resolved.status !== "resolved") return;
    expect(resolved.headerRowIndex).toBe(1);
    expect(resolved.candidateRowIndices).toEqual([1]);
  });
});

describe("detectHeaderCandidates — inspection bound", () => {
  it("never inspects beyond the first 10 used rows", () => {
    const filler: (string | number | boolean | null)[][] = Array.from({ length: 10 }, () => [
      "nota",
      null,
    ]);
    const rows = matrix([...filler, ["NHC", "Nombre", "Diagnostico"]]);
    const detection = detectHeaderCandidates(rows);
    expect(detection.inspectedRowCount).toBe(10);
    expect(detection.candidateRowIndices).toEqual([]);
  });

  it("a header-looking row at position 11 cannot auto-resolve", () => {
    const filler: (string | number | boolean | null)[][] = Array.from({ length: 10 }, () => [
      "x",
      null,
    ]);
    const resolved = resolveHeaderRow(matrix([...filler, ["NHC", "Nombre", "Diagnostico"]]));
    expect(resolved.status).toBe("header-row-required");
  });
});

describe("validateHeaderRowSelection — explicit selection is bounded and validated", () => {
  it("accepts a valid inspected row index", () => {
    expect(validateHeaderRowSelection(3, 6)).toEqual({ valid: true, headerRowIndex: 3 });
  });

  it("rejects out-of-range, negative, non-integer and non-numeric selections", () => {
    for (const selection of [6, 10, -1, 2.5, Number.NaN, "3", null, undefined]) {
      const result = validateHeaderRowSelection(selection, 6);
      expect(result.valid).toBe(false);
      if (result.valid !== false) continue;
      expect(result.message.length).toBeGreaterThan(0);
    }
  });

  it("rejects every selection when nothing was inspected", () => {
    expect(validateHeaderRowSelection(0, 0).valid).toBe(false);
  });
});

describe("header-row privacy boundary — no content logging/storage/network", () => {
  /**
   * REC-04 WU-A oracle 7, following the transform-isolation structural pattern:
   * every module touched by header authority must carry no console.* value
   * logging, no storage writes and no network calls. Falsifiable by planting
   * any of the forbidden expressions in a touched module.
   */
  const TOUCHED = ["header-row.ts", "excel.ts", "intake.ts", "StructuredConfigureWorkspace.tsx"];
  // Actual invocation/storage/network sinks. The repo documents the convention
  // as prose ("no console.* calls") in module docstrings, so bare `console.`
  // is matched only as a real call below, not as documentation text.
  const FORBIDDEN_CALLS = [
    /console\.(log|info|warn|error|debug|trace|table)\s*\(/,
    /localStorage/,
    /sessionStorage/,
    /indexedDB/,
    /fetch\s*\(/,
    /XMLHttpRequest/,
    /navigator\.sendBeacon/,
  ];

  it("touched header-authority modules contain no logging/storage/network sinks", () => {
    for (const file of TOUCHED) {
      const text = fs.readFileSync(path.join(__dirname, file), "utf8");
      for (const sink of FORBIDDEN_CALLS) {
        expect(sink.test(text), `${file} must not contain ${sink}`).toBe(false);
      }
    }
    // Non-vacuous: the typed outcome the oracle guards is really present.
    const excel = fs.readFileSync(path.join(__dirname, "excel.ts"), "utf8");
    expect(excel).toContain("header-row-required");
    const intake = fs.readFileSync(path.join(__dirname, "intake.ts"), "utf8");
    expect(intake).toContain("header-row-required");
  });
});
