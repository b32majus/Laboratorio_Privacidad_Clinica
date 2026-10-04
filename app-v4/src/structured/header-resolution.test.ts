import * as fs from "node:fs";
import * as path from "node:path";
import { fileURLToPath } from "node:url";
import * as vm from "node:vm";
import { afterEach, describe, expect, it } from "vitest";

import { parseStructuredWorkbook } from "./excel";
import { resetXlsxLoaderForTests, type XlsxCell, type XlsxLib } from "./xlsx-loader";

/**
 * REC-04 WU-A (D-022) red→green oracles for workbook header-row resolution
 * through the Excel adapter (SPEC §9 + D-022).
 *
 * Workbooks are authored with the REAL governed SheetJS bundle
 * (`lib/xlsx.full.min.js`), exactly like the T18 adapter tests. All data is
 * synthetic; no real PHI anywhere.
 */

const repoLibPath = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
  "..",
  "..",
  "lib",
  "xlsx.full.min.js"
);

function loadGovernedSheetJs(): XlsxAuthoringLib {
  const code = fs.readFileSync(repoLibPath, "utf8");
  const context: Record<string, unknown> = { window: {}, console };
  vm.createContext(context);
  vm.runInContext(`${code}\n;this.__loaded = window.XLSX;`, context);
  const lib = context.__loaded as XlsxAuthoringLib;
  if (!lib || typeof lib.read !== "function") {
    throw new Error("Governed SheetJS bundle did not load in the test sandbox.");
  }
  return lib;
}

const XLSX = loadGovernedSheetJs() as XlsxAuthoringLib;

afterEach(() => {
  delete window.XLSX;
  resetXlsxLoaderForTests();
});

type XlsxAuthoringLib = XlsxLib & {
  write(workbook: unknown, options: { type: "array"; bookType: "xlsx" }): ArrayBuffer;
  utils: XlsxLib["utils"] & {
    book_new(): Record<string, unknown>;
    book_append_sheet(workbook: Record<string, unknown>, sheet: unknown, name: string): void;
    aoa_to_sheet(
      rows: readonly (string | number | null)[][]
    ): Record<string, XlsxCell | string | undefined>;
  };
};

function seedWindow(): void {
  window.XLSX = XLSX;
}

/** Workbook whose real headers sit on row 4 below 3 explanatory metadata rows. */
function buildMetadataWorkbookBytes(): ArrayBuffer {
  const workbook = XLSX.utils.book_new();
  const sheet = XLSX.utils.aoa_to_sheet([
    ["Hospital General — registro de visitas", null, null, null, null],
    ["Unidad: urgencias", null, null, null, null],
    [null, null, null, null, null],
    ["NHC", "Nombre", "Edad", "Fecha", "Centro"],
    [101, "Ana", 33, null, null],
    [102, null, 41, null, null],
  ]);
  // Date-formatted serial in D5 (second data row... D5 = first data Fecha cell):
  // raw serial 43845 (2020-01-15) must come back normalized.
  sheet["D5"] = { t: "n", v: 43845, z: "dd/mm/yyyy" };
  XLSX.utils.book_append_sheet(workbook, sheet, "Visitas");
  return XLSX.write(workbook, { type: "array", bookType: "xlsx" }) as ArrayBuffer;
}

/** Workbook with two qualifying candidate rows: ambiguous by construction. */
function buildAmbiguousWorkbookBytes(): ArrayBuffer {
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(
    workbook,
    XLSX.utils.aoa_to_sheet([
      ["NHC", "Nombre", "Centro"],
      ["00123", "Ana", "Centro Norte"],
      ["00456", null, null],
    ]),
    "Datos"
  );
  return XLSX.write(workbook, { type: "array", bookType: "xlsx" }) as ArrayBuffer;
}

describe("parseStructuredWorkbook — smart header authority (D-022)", () => {
  it("parses metadata-before-header workbooks with row 4 as schema, never metadata", async () => {
    seedWindow();
    const result = await parseStructuredWorkbook(buildMetadataWorkbookBytes(), {
      sheetName: "Visitas",
    });
    expect(result.status).toBe("success");
    if (result.status !== "success") return;
    expect(result.grid.headers).toEqual(["NHC", "Nombre", "Edad", "Fecha", "Centro"]);
    expect(result.grid.rows).toHaveLength(2);
    // Rows above the header are skipped metadata, never data rows; rows below
    // preserve order, blanks and scalar normalization exactly.
    expect(result.grid.rows[0]).toEqual([101, "Ana", 33, "2020-01-15", null]);
    expect(result.grid.rows[1][1]).toBeNull();
  });

  it("blocks an ambiguous two-candidate workbook with header-row-required, never a silent choice", async () => {
    seedWindow();
    const result = await parseStructuredWorkbook(buildAmbiguousWorkbookBytes(), {
      sheetName: "Datos",
    });
    expect(result.status).toBe("header-row-required");
    if (result.status !== "header-row-required") return;
    expect(result.code).toBe("header-row-required");
    expect(result.sheetName).toBe("Datos");
    expect(result.candidateRowIndices).toEqual([0, 1]);
    expect(result.inspectedRowCount).toBe(3);
    expect(result.message.length).toBeGreaterThan(0);
  });

  it("an explicit valid selection resolves the ambiguous workbook", async () => {
    seedWindow();
    const bytes = buildAmbiguousWorkbookBytes();
    const first = await parseStructuredWorkbook(bytes, { sheetName: "Datos", headerRowIndex: 1 });
    expect(first.status).toBe("success");
    if (first.status !== "success") return;
    expect(first.grid.headers).toEqual(["00123", "Ana", "Centro Norte"]);
    expect(first.grid.rows).toEqual([["00456", null, null]]);

    const zeroth = await parseStructuredWorkbook(bytes, { sheetName: "Datos", headerRowIndex: 0 });
    expect(zeroth.status).toBe("success");
    if (zeroth.status !== "success") return;
    expect(zeroth.grid.headers).toEqual(["NHC", "Nombre", "Centro"]);
    expect(zeroth.grid.rows).toHaveLength(2);
  });

  it("an out-of-range or invalid explicit selection fails typed", async () => {
    seedWindow();
    const bytes = buildAmbiguousWorkbookBytes();
    for (const headerRowIndex of [3, 9, 10, -1]) {
      const result = await parseStructuredWorkbook(bytes, { sheetName: "Datos", headerRowIndex });
      expect(result.status).toBe("failed");
      if (result.status !== "failed") continue;
      expect(result.code).toBe("invalid-header-row");
    }
  });

  it("a single obvious candidate auto-resolves without explicit selection", async () => {
    seedWindow();
    const result = await parseStructuredWorkbook(buildMetadataWorkbookBytes(), {
      sheetName: "Visitas",
    });
    expect(result.status).toBe("success");
    if (result.status !== "success") return;
    expect(result.grid.headers).toEqual(["NHC", "Nombre", "Edad", "Fecha", "Centro"]);
  });

  it("keeps error-cell fail-closed behavior on the header-offset path", async () => {
    seedWindow();
    const workbook = XLSX.utils.book_new();
    const sheet = XLSX.utils.aoa_to_sheet([
      ["nota informativa", null],
      ["NHC", "Nombre", "Edad"],
      ["00123", "Ana", 33],
    ]);
    sheet["C3"] = { t: "e", v: 42, w: "#N/A" };
    XLSX.utils.book_append_sheet(workbook, sheet, "Datos");
    const bytes = XLSX.write(workbook, { type: "array", bookType: "xlsx" }) as ArrayBuffer;
    const result = await parseStructuredWorkbook(bytes, { sheetName: "Datos", headerRowIndex: 1 });
    expect(result.status).toBe("failed");
    if (result.status !== "failed") return;
    expect(result.code).toBe("excel-cell-error");
    expect(result.message).toContain("C3");
  });
});
