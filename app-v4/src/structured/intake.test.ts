import * as fs from "node:fs";
import * as path from "node:path";
import { fileURLToPath } from "node:url";
import * as vm from "node:vm";
import { afterEach, describe, expect, it } from "vitest";

import type { SourceFileLike } from "../input/extracted-source";
import { MAX_SUPPORTED_TEXT_LENGTH, oversizeInputFor } from "../engine/input-limits";
import { readStructuredFile, readStructuredSheet } from "./intake";
import { resetXlsxLoaderForTests, type XlsxCell, type XlsxLib } from "./xlsx-loader";

/**
 * T20 #24 intake oracles (SPEC §8/§9). The workbook fixtures are authored with
 * the REAL governed SheetJS bundle (`lib/xlsx.full.min.js`), exactly like the
 * T18 adapter tests. All data is synthetic; no real PHI anywhere.
 */

const repoLibPath = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
  "..",
  "..",
  "lib",
  "xlsx.full.min.js"
);

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

const XLSX = loadGovernedSheetJs();

afterEach(() => {
  delete window.XLSX;
  resetXlsxLoaderForTests();
});

function textFile(name: string, text: string): SourceFileLike {
  return { name, text: async () => text };
}

function bytesFile(name: string, bytes: ArrayBuffer): SourceFileLike {
  return { name, arrayBuffer: async () => bytes };
}

function buildWorkbookBytes(): ArrayBuffer {
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(
    workbook,
    XLSX.utils.aoa_to_sheet([["Decoy"], ["primera-hoja"]]),
    "Portada"
  );
  XLSX.utils.book_append_sheet(
    workbook,
    XLSX.utils.aoa_to_sheet([
      ["NHC", "Nombre", "Diagnostico"],
      ["00123", "Ana", "Gripe A"],
      ["00456", "Luis", "Fractura"],
    ]),
    "DatosClinicos"
  );
  return XLSX.write(workbook, { type: "array", bookType: "xlsx" }) as ArrayBuffer;
}

/** XLSX cells are capped at 32767 characters; distribute large text across rows. */
const XLSX_CELL_MAX = 32767;

function stringRowsTotaling(targetLength: number): string[][] {
  if (targetLength < 0) throw new Error("Negative target length.");
  const rows: string[][] = [];
  let remaining = targetLength;
  while (remaining > XLSX_CELL_MAX) {
    rows.push(["a".repeat(XLSX_CELL_MAX)]);
    remaining -= XLSX_CELL_MAX;
  }
  rows.push(["a".repeat(remaining)]);
  return rows;
}

describe("readStructuredFile — CSV through the consolidated parser", () => {
  it("parses a CSV file into a normalized grid", async () => {
    const outcome = await readStructuredFile(
      textFile("labs.csv", "NHC,Nombre,Diagnostico\n00123,Ana,Gripe A\n00456,Luis,Fractura")
    );
    expect(outcome.status).toBe("parsed");
    if (outcome.status !== "parsed") return;
    expect(outcome.grid.headers).toEqual(["NHC", "Nombre", "Diagnostico"]);
    expect(outcome.grid.rows).toEqual([
      ["00123", "Ana", "Gripe A"],
      ["00456", "Luis", "Fractura"],
    ]);
  });

  it("preserves quoted multiline CSV fields (single parser authority)", async () => {
    const outcome = await readStructuredFile(
      textFile("labs.csv", 'id,nota\n1,"linea uno\nlinea dos"')
    );
    expect(outcome.status).toBe("parsed");
    if (outcome.status !== "parsed") return;
    expect(outcome.grid.rows[0][1]).toBe("linea uno\nlinea dos");
  });

  it("fails closed with the typed parser error for empty or malformed CSV", async () => {
    const empty = await readStructuredFile(textFile("empty.csv", ""));
    expect(empty).toEqual({ status: "failed", code: "csv-empty", message: expect.any(String) });
    const malformed = await readStructuredFile(textFile("bad.csv", 'a,b\n1,"unterminated'));
    expect(malformed.status).toBe("failed");
    if (malformed.status !== "failed") return;
    expect(malformed.code).toBe("csv-unterminated-quote");
  });

  it("fails closed for an unsupported structured extension", async () => {
    const outcome = await readStructuredFile(textFile("data.json", "{}"));
    expect(outcome.status).toBe("failed");
    if (outcome.status !== "failed") return;
    expect(outcome.code).toBe("unsupported-format");
  });
});

describe("readStructuredFile — workbook sheet selection (SPEC §9)", () => {
  it("requests an explicit sheet for a multi-sheet workbook", async () => {
    window.XLSX = XLSX;
    const outcome = await readStructuredFile(bytesFile("labs.xlsx", buildWorkbookBytes()));
    expect(outcome).toEqual({
      status: "sheet-required",
      sheetNames: ["Portada", "DatosClinicos"],
    });
  });

  it("parses the explicitly selected sheet, not the first", async () => {
    window.XLSX = XLSX;
    const bytes = buildWorkbookBytes();
    const outcome = await readStructuredSheet(bytesFile("labs.xlsx", bytes), "DatosClinicos");
    expect(outcome.status).toBe("parsed");
    if (outcome.status !== "parsed") return;
    expect(outcome.grid.headers).toEqual(["NHC", "Nombre", "Diagnostico"]);
    expect(outcome.grid.rows).toHaveLength(2);
  });

  it("fails closed with available sheet names when the selection is unknown", async () => {
    window.XLSX = XLSX;
    const outcome = await readStructuredSheet(
      bytesFile("labs.xlsx", buildWorkbookBytes()),
      "NoExiste"
    );
    expect(outcome.status).toBe("failed");
    if (outcome.status !== "failed") return;
    expect(outcome.code).toBe("sheet-not-found");
    expect(outcome.message).toContain("Portada");
  });
});

describe("readStructuredFile/readStructuredSheet — supported-size authority (STRUCT-012, issue #43 A1)", () => {
  const MAX = MAX_SUPPORTED_TEXT_LENGTH;

  it("refuses an oversize CSV before parsing, with the shared typed failure and the common message verbatim", async () => {
    // Planted over-limit fixture: a valid, parseable CSV whose decoded text is
    // above the common supported-size authority. The current implementation
    // parses it fully; the correction must refuse it with code
    // `input-too-large` and the exact shared actionability message — never a
    // truncated or apparently-successful grid.
    const text = `col\n${"a".repeat(MAX)}`;
    expect(text.length).toBe(MAX + 4);
    const outcome = await readStructuredFile(textFile("big.csv", text));
    expect(outcome.status).toBe("failed");
    if (outcome.status !== "failed") return;
    expect(outcome.code).toBe("input-too-large");
    expect(outcome.message).toBe(oversizeInputFor(text)!.message);
  });

  it("still parses a CSV exactly at the supported boundary", async () => {
    const text = `col\n${"a".repeat(MAX - 4)}`;
    expect(text.length).toBe(MAX);
    const outcome = await readStructuredFile(textFile("boundary.csv", text));
    expect(outcome.status).toBe("parsed");
  });

  it("refuses an oversize workbook sheet over the accepted grid representation", async () => {
    window.XLSX = XLSX;
    // Planted over-limit fixture: one sheet whose cell text totals one code
    // unit above the limit (headers + cells are the accepted structured
    // representation). Header "col" (3) + cells (MAX - 2) = MAX + 1. Cell
    // text is spread across rows because XLSX caps one cell at 32767 chars.
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(
      workbook,
      XLSX.utils.aoa_to_sheet([["col"], ...stringRowsTotaling(MAX - 2)]),
      "DatosClinicos"
    );
    const bytes = XLSX.write(workbook, { type: "array", bookType: "xlsx" }) as ArrayBuffer;
    const outcome = await readStructuredSheet(bytesFile("big.xlsx", bytes), "DatosClinicos");
    expect(outcome.status).toBe("failed");
    if (outcome.status !== "failed") return;
    expect(outcome.code).toBe("input-too-large");
    // The shared message template, built from the same authority for the
    // measured grid text length (headers + cells):
    expect(outcome.message).toBe(oversizeInputFor("x".repeat(MAX + 1))!.message);
  });

  it("refuses an oversize sheet selected through the sheet-required path", async () => {
    window.XLSX = XLSX;
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet([["x"], ["1"]]), "Portada");
    XLSX.utils.book_append_sheet(
      workbook,
      XLSX.utils.aoa_to_sheet([["col"], ...stringRowsTotaling(MAX)]),
      "DatosClinicos"
    );
    const bytes = XLSX.write(workbook, { type: "array", bookType: "xlsx" }) as ArrayBuffer;
    const file = bytesFile("big.xlsx", bytes);
    const first = await readStructuredFile(file);
    expect(first.status).toBe("sheet-required");
    const second = await readStructuredSheet(file, "DatosClinicos");
    expect(second.status).toBe("failed");
    if (second.status !== "failed") return;
    expect(second.code).toBe("input-too-large");
  });

  it("still parses a workbook whose grid text is exactly at the supported boundary", async () => {
    window.XLSX = XLSX;
    // Boundary: header "col" (3) + string cells (MAX - 4) + numeric cell
    // rendered as "1" (1) = MAX code units exactly.
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(
      workbook,
      XLSX.utils.aoa_to_sheet([["col"], ...stringRowsTotaling(MAX - 4), [1]]),
      "DatosClinicos"
    );
    const bytes = XLSX.write(workbook, { type: "array", bookType: "xlsx" }) as ArrayBuffer;
    const outcome = await readStructuredSheet(bytesFile("boundary.xlsx", bytes), "DatosClinicos");
    expect(outcome.status).toBe("parsed");
  });
});
