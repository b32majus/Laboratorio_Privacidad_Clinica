import * as fs from "node:fs";
import * as path from "node:path";
import { fileURLToPath } from "node:url";
import * as vm from "node:vm";
import { afterEach, describe, expect, it } from "vitest";

import { excelSerialToIsoDate } from "./excel-serial";
import { isDateFormatted, listSheetNames, parseStructuredWorkbook, worksheetToGrid } from "./excel";
import {
  resetXlsxLoaderForTests,
  type XlsxCell,
  type XlsxLib,
  type XlsxWorksheet,
} from "./xlsx-loader";

/**
 * T18 #22 deterministic verification: "Multi-sheet XLSX fixture" (SPEC §9,
 * STRUCT-007) and "Serial-date fixture" (STRUCT-008).
 *
 * The REAL governed SheetJS bundle (`lib/xlsx.full.min.js`, 0.20.2 — the
 * exact bytes the `/vendor/xlsx.full.min.js` same-origin symlink serves) is
 * evaluated in a sandbox and seeded on `window.XLSX`, mirroring how the
 * pdf.js adapter tests seed the real pdf.js. All workbook data is synthetic;
 * no real PHI is used anywhere.
 */

const repoLibPath = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
  "..",
  "..",
  "lib",
  "xlsx.full.min.js"
);

function loadGovernedSheetJs(): XlsxLib {
  const code = fs.readFileSync(repoLibPath, "utf8");
  const context: Record<string, unknown> = { window: {}, console };
  vm.createContext(context);
  vm.runInContext(`${code}\n;this.__loaded = window.XLSX;`, context);
  const lib = context.__loaded as XlsxLib;
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

/**
 * Authoring surface of the SAME governed bundle used only by the tests to
 * build synthetic in-memory workbooks (write side). The runtime `XlsxLib`
 * type stays minimal to the read path the adapter actually uses.
 */
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

function buildWorkbookBytes(): ArrayBuffer {
  const workbook = XLSX.utils.book_new();

  // Sheet 1 (NOT the target of selection in most tests): decoy data.
  XLSX.utils.book_append_sheet(
    workbook,
    XLSX.utils.aoa_to_sheet([["Decoy"], ["primera-hoja"]]),
    "Portada"
  );

  // Target sheet: headers + data with blanks and a date-formatted serial cell.
  const sheet = XLSX.utils.aoa_to_sheet([
    ["NHC", "Nombre", "Fecha_Visita", "Centro"],
    ["00123", "Ana", null, "Centro Norte"],
    ["00456", null, null, null],
    ["00789", "Luis", null, "Centro Sur"],
  ]);
  // Date-formatted numeric cell C2: serial 43845 (2020-01-15) with a custom
  // date format. The raw serial survives write/read and must come back
  // normalized (STRUCT-008).
  sheet["C2"] = { t: "n", v: 43845, z: "dd/mm/yyyy" };
  XLSX.utils.book_append_sheet(workbook, sheet, "DatosClinicos");

  // Third sheet for sheet-listing evidence.
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet([["x"]]), "Auxiliar");

  const bytes = XLSX.write(workbook, { type: "array", bookType: "xlsx" }) as ArrayBuffer;
  return bytes;
}

function seedWindow(): void {
  window.XLSX = XLSX;
}

describe("listSheetNames", () => {
  it("lists every sheet deterministically (multi-sheet fixture)", async () => {
    seedWindow();
    const result = await listSheetNames(buildWorkbookBytes());
    expect(result).toEqual({
      status: "success",
      sheetNames: ["Portada", "DatosClinicos", "Auxiliar"],
    });
  });
});

describe("parseStructuredWorkbook", () => {
  it("parses the EXPLICITLY selected sheet, not the first sheet", async () => {
    seedWindow();
    // REC-04 WU-A (D-022): this fixture's data rows are all-text with 3+
    // cells ("Centro Norte"/"Centro Sur"), so the bounded detector is
    // genuinely ambiguous; the T18 sheet-selection oracle now resolves it
    // through the explicit header-row path with row 1 as the header.
    const result = await parseStructuredWorkbook(buildWorkbookBytes(), {
      sheetName: "DatosClinicos",
      headerRowIndex: 0,
    });
    expect(result.status).toBe("success");
    if (result.status !== "success") return;
    expect(result.grid.headers).toEqual(["NHC", "Nombre", "Fecha_Visita", "Centro"]);
    expect(result.grid.rows).toHaveLength(3);
    expect(result.grid.rows[0][0]).toBe("00123");
    expect(result.grid.rows[2][3]).toBe("Centro Sur");
  });

  it("normalizes the Excel serial date through the full pipeline", async () => {
    seedWindow();
    const result = await parseStructuredWorkbook(buildWorkbookBytes(), {
      sheetName: "DatosClinicos",
      headerRowIndex: 0,
    });
    expect(result.status).toBe("success");
    if (result.status !== "success") return;
    // Serial 43845 was written with a dd/mm/yyyy date format; the grid must
    // carry the normalized ISO date, not the raw serial 43845.
    expect(result.grid.rows[0][2]).toBe("2020-01-15");
    expect(result.grid.rows[0][2]).not.toBe(43845);
  });

  it("preserves blank cells as null absence through parsing", async () => {
    seedWindow();
    const result = await parseStructuredWorkbook(buildWorkbookBytes(), {
      sheetName: "DatosClinicos",
      headerRowIndex: 0,
    });
    expect(result.status).toBe("success");
    if (result.status !== "success") return;
    expect(result.grid.rows[0][1]).toBe("Ana");
    expect(result.grid.rows[1][1]).toBeNull(); // empty Nombre cell
    expect(result.grid.rows[2][1]).not.toBeNull();
    // The blank Fecha_Visita cells stay absence, never a placeholder string.
    expect(result.grid.rows[1][2]).toBeNull();
  });

  it("fails closed when no sheet is selected (never silently the first sheet)", async () => {
    seedWindow();
    const result = await parseStructuredWorkbook(buildWorkbookBytes(), { sheetName: "" });
    expect(result).toEqual({
      status: "failed",
      code: "sheet-not-selected",
      message: "No Excel sheet was selected: an explicit sheet is required.",
    });
  });

  it("fails closed with available sheet names when the selection is unknown", async () => {
    seedWindow();
    const result = await parseStructuredWorkbook(buildWorkbookBytes(), {
      sheetName: "NoExiste",
    });
    expect(result.status).toBe("failed");
    if (result.status !== "failed") return;
    expect(result.code).toBe("sheet-not-found");
    expect(result.message).toContain("Portada, DatosClinicos, Auxiliar");
  });

  it("keeps values absent when cells are missing from the sparse sheet model", () => {
    // Hand-built worksheet: missing addresses and an explicit empty string.
    const sheet: XlsxWorksheet = {
      "!ref": "A1:B2",
      A1: { t: "s", v: "H1" },
      B1: { t: "s", v: "" },
      A2: { t: "s", v: "valor" },
      // B2 intentionally absent.
    };
    const result = worksheetToGrid(sheet, XLSX);
    expect(result.status).toBe("success");
    if (result.status !== "success") return;
    expect(result.grid.headers).toEqual(["H1", ""]); // blank header: empty structural label
    expect(result.grid.rows[0]).toEqual(["valor", null]);
  });

  it("fails closed on a spreadsheet error cell, naming the cell", () => {
    const sheet: XlsxWorksheet = {
      "!ref": "A1:B2",
      A1: { t: "s", v: "H1" },
      B1: { t: "s", v: "H2" },
      A2: { t: "s", v: "x" },
      B2: { t: "e", v: 42, w: "#N/A" },
    };
    const result = worksheetToGrid(sheet, XLSX);
    expect(result.status).toBe("failed");
    if (result.status !== "failed") return;
    expect(result.code).toBe("excel-cell-error");
    expect(result.message).toContain("B2");
  });

  it("fails closed on a date-formatted serial outside the supported range", () => {
    const sheet: XlsxWorksheet = {
      "!ref": "A1:A2",
      A1: { t: "s", v: "Fecha" },
      A2: { t: "n", v: 4, z: "dd/mm/yyyy" }, // serial 4 < 61: pre-1900-03-01
    };
    const result = worksheetToGrid(sheet, XLSX);
    expect(result.status).toBe("failed");
    if (result.status !== "failed") return;
    expect(result.code).toBe("excel-date-out-of-range");
    expect(result.message).toContain("A2");
  });

  it("fails closed on an empty sheet (no range)", () => {
    const result = worksheetToGrid({}, XLSX);
    expect(result).toEqual({
      status: "failed",
      code: "empty-sheet",
      message: "The selected Excel sheet is empty.",
    });
  });
});

describe("isDateFormatted", () => {
  it("detects year/day tokens in custom format strings", () => {
    expect(isDateFormatted("dd/mm/yyyy")).toBe(true);
    expect(isDateFormatted("yyyy-mm-dd")).toBe(true);
    expect(isDateFormatted("d-mmm-yy")).toBe(true);
  });

  it("maps built-in date format ids and rejects non-date formats", () => {
    expect(isDateFormatted(14)).toBe(true); // m/d/yy
    expect(isDateFormatted(22)).toBe(true); // m/d/yy h:mm
    expect(isDateFormatted(0)).toBe(false); // General
    expect(isDateFormatted(49)).toBe(false); // @
    expect(isDateFormatted("General")).toBe(false);
    expect(isDateFormatted("0.00")).toBe(false);
    expect(isDateFormatted(undefined)).toBe(false);
  });

  it("keeps time-only numeric formats out of date normalization", () => {
    expect(isDateFormatted(20)).toBe(false); // h:mm (time-only built-in id)
    expect(isDateFormatted(45)).toBe(false);
    expect(isDateFormatted(46)).toBe(false);
    expect(isDateFormatted(47)).toBe(false);
  });

  it("uses SheetJS SSF.is_date as last resort for exotic formats", () => {
    expect(isDateFormatted("[$-409]mmmm d, yyyy", (fmt) => XLSX.SSF.is_date(fmt))).toBe(true);
  });
});

describe("excel-serial round trip against the governed bundle", () => {
  it("agrees with SheetJS date formatting for a modern date", () => {
    const workbook = XLSX.utils.book_new();
    const sheet = XLSX.utils.aoa_to_sheet([[null]]);
    sheet["A1"] = { t: "n", v: 45658, z: "yyyy-mm-dd" };
    XLSX.utils.book_append_sheet(workbook, sheet, "Fechas");
    const bytes = XLSX.write(workbook, { type: "array", bookType: "xlsx" }) as ArrayBuffer;
    const readBack = XLSX.read(bytes, { type: "array", cellNF: true });
    const cell = readBack.Sheets["Fechas"]["A1"] as XlsxCell | undefined;
    expect(cell?.t).toBe("n");
    expect(excelSerialToIsoDate(cell?.v as number)).toBe("2025-01-01");
  });
});
