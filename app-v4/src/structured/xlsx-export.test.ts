import * as fs from "node:fs";
import * as path from "node:path";
import { fileURLToPath } from "node:url";
import * as vm from "node:vm";
import { describe, expect, it } from "vitest";

import type { XlsxCell, XlsxLib } from "./xlsx-loader";
import type {
  StructuredConfidentialCorrespondence,
  StructuredSafeDataset,
  StructuredSummary,
} from "./transformed-dataset";

/**
 * REC-04 WU-C red→green oracles: Safe and Confidential XLSX serializers.
 *
 * Seams under test (handoff §5 WU-C oracles):
 *   1. `buildSafeXlsxBytes(lib, safe, summary?)` — pure bytes, observed by
 *      reading them back with the GOVERNED SheetJS runtime (same vm pattern
 *      as `excel.test.ts`).
 *   2. `buildConfidentialXlsxBytes(lib, confidential)` — same read-back seam.
 *
 * The module under test does not exist yet: every test below must FAIL
 * (red) until the serializer is implemented. Synthetic fixtures only.
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

const XLSX = loadGovernedSheetJs();

/** Planted original patient identifiers that must never reach Safe XLSX. */
const ORIGINAL_A = "P-001";
const ORIGINAL_B = "P-002";

function safeDataset(): StructuredSafeDataset {
  return Object.freeze({
    kind: "structured-safe-dataset" as const,
    headers: Object.freeze(["ID_ESTUDIO", "Edad_Num", "Flag", "Diagnostico"]),
    rows: Object.freeze([
      Object.freeze(["PAC_001", 34, true, "Gripe A"]),
      Object.freeze(["PAC_001", null, false, null]),
      Object.freeze(["PAC_002", 41, true, "Gripe A"]),
    ]),
  });
}

function summary(): StructuredSummary {
  return Object.freeze({
    rowCount: 3,
    patient: Object.freeze({
      uniquePatients: 2,
      linkedRows: 3,
      averageLinkedRowsPerPatient: 1.5,
    }),
  });
}

function correspondence(): StructuredConfidentialCorrespondence {
  return Object.freeze({
    kind: "structured-confidential-correspondence" as const,
    policyId: "standard",
    columns: Object.freeze([
      Object.freeze({
        columnIndex: 0,
        header: "Paciente",
        disposition: "study-id" as const,
        entries: Object.freeze([
          Object.freeze({ original: ORIGINAL_A, transformed: "PAC_001" }),
          Object.freeze({ original: ORIGINAL_B, transformed: "PAC_002" }),
        ]),
      }),
    ]),
    totals: Object.freeze({
      dateAge: 0,
      pseudonymize: 0,
      remove: 0,
      studyId: 1,
      freeText: 0,
      transformedCells: 2,
    }),
  });
}

type WorkbookDump = {
  readonly sheetNames: readonly string[];
  readonly cells: Readonly<Record<string, XlsxCell | undefined>>;
};

function readWorkbook(bytes: Uint8Array): {
  readonly sheetNames: readonly string[];
  sheet(name: string): WorkbookDump;
} {
  const workbook = XLSX.read(bytes, { type: "array", cellDates: false });
  return {
    sheetNames: workbook.SheetNames,
    sheet(name: string): WorkbookDump {
      const raw = workbook.Sheets[name] ?? {};
      const cells: Record<string, XlsxCell | undefined> = {};
      for (const [address, cell] of Object.entries(raw)) {
        if (address.startsWith("!")) continue;
        cells[address] = cell as XlsxCell;
      }
      return { sheetNames: workbook.SheetNames, cells };
    },
  };
}

function columnValues(
  dump: WorkbookDump,
  column: string,
  rowCount: number,
  headerRow = 1
): readonly unknown[] {
  const values: unknown[] = [];
  for (let row = headerRow + 1; row <= headerRow + rowCount; row += 1) {
    values.push(dump.cells[`${column}${row}`]?.v ?? null);
  }
  return values;
}

describe("Safe XLSX serializer (H-28)", () => {
  it("reads back exact headers/rows/order/blanks/scalar types from the Data sheet", async () => {
    const { buildSafeXlsxBytes } = await import("./xlsx-export");
    const bytes = buildSafeXlsxBytes(XLSX, safeDataset(), summary());
    const workbook = readWorkbook(bytes);
    expect(workbook.sheetNames[0]).toBe("Data");
    const data = workbook.sheet("Data");
    expect(columnValues(data, "A", 1, 0)).toEqual(["ID_ESTUDIO"]);
    expect(data.cells["A2"]?.v).toBe("PAC_001");
    expect(data.cells["A3"]?.v).toBe("PAC_001");
    expect(data.cells["A4"]?.v).toBe("PAC_002");
    // Typed scalars where practical: numbers/booleans stay typed cells.
    expect(data.cells["B2"]).toMatchObject({ t: "n", v: 34 });
    expect(data.cells["C2"]).toMatchObject({ t: "b", v: true });
    // Blanks stay absent cells, never placeholders.
    expect(data.cells["B3"]?.v ?? null).toBeNull();
    expect(data.cells["D3"]?.v ?? null).toBeNull();
    expect(data.cells["D2"]?.v).toBe("Gripe A");
  });

  it("contains no planted original IDs or mappings anywhere in the workbook", async () => {
    const { buildSafeXlsxBytes } = await import("./xlsx-export");
    const bytes = buildSafeXlsxBytes(XLSX, safeDataset(), summary());
    const workbook = readWorkbook(bytes);
    const seen: unknown[] = [];
    for (const name of workbook.sheetNames) {
      for (const cell of Object.values(workbook.sheet(name).cells)) {
        seen.push(cell?.v);
      }
    }
    expect(seen).not.toContain(ORIGINAL_A);
    expect(seen).not.toContain(ORIGINAL_B);
    expect(seen).not.toContain("Paciente");
    expect(workbook.sheetNames).toEqual(["Data", "Summary"]);
  });

  it("carries only the factual summary and non-sensitive output facts", async () => {
    const { buildSafeXlsxBytes } = await import("./xlsx-export");
    const bytes = buildSafeXlsxBytes(XLSX, safeDataset(), summary());
    const workbook = readWorkbook(bytes);
    const text = Object.values(workbook.sheet("Summary").cells)
      .map((cell) => String(cell?.v ?? ""))
      .join("\n");
    expect(text).toContain("3");
    expect(text).toContain("2");
    expect(text).not.toContain(ORIGINAL_A);
    expect(text).not.toContain("->");
  });

  it("is byte-deterministic for identical canonical input", async () => {
    const { buildSafeXlsxBytes } = await import("./xlsx-export");
    const first = buildSafeXlsxBytes(XLSX, safeDataset(), summary());
    const second = buildSafeXlsxBytes(XLSX, safeDataset(), summary());
    expect(Buffer.from(first).equals(Buffer.from(second))).toBe(true);
  });

  it("fails closed on a value that is not a Safe dataset", async () => {
    const { buildSafeXlsxBytes, XlsxExportError } = await import("./xlsx-export");
    expect(() => buildSafeXlsxBytes(XLSX, { kind: "other" })).toThrowError(XlsxExportError);
  });
});

describe("Confidential XLSX serializer (H-29)", () => {
  it("warns first, then carries the authorized correspondence only", async () => {
    const { buildConfidentialXlsxBytes } = await import("./xlsx-export");
    const bytes = buildConfidentialXlsxBytes(XLSX, correspondence());
    const workbook = readWorkbook(bytes);
    expect(workbook.sheetNames[0]).toBe("READ_FIRST");
    const warning = Object.values(workbook.sheet("READ_FIRST").cells)
      .map((cell) => String(cell?.v ?? ""))
      .join("\n");
    const { CONFIDENTIAL_AUDIT_WARNING_LINE } =
      await import("../output/confidential-audit-serializer");
    expect(warning).toContain(CONFIDENTIAL_AUDIT_WARNING_LINE);
    expect(warning).toMatch(/authorized internal/i);

    const table = workbook.sheet("Correspondence");
    const flat = Object.values(table.cells)
      .map((cell) => String(cell?.v ?? ""))
      .join("\n");
    expect(flat).toContain(ORIGINAL_A);
    expect(flat).toContain("PAC_001");
    expect(flat).toContain("study-id");
    // Kept Safe-only clinical content is never pulled into the audit.
    expect(flat).not.toContain("Gripe A");
  });

  it("metadata sheet carries policy id and correspondence totals only", async () => {
    const { buildConfidentialXlsxBytes } = await import("./xlsx-export");
    const bytes = buildConfidentialXlsxBytes(XLSX, correspondence());
    const workbook = readWorkbook(bytes);
    const meta = Object.values(workbook.sheet("Metadata").cells)
      .map((cell) => String(cell?.v ?? ""))
      .join("\n");
    expect(meta).toContain("standard");
    expect(meta).not.toContain(ORIGINAL_A);
    expect(meta).not.toContain("Gripe A");
  });

  it("is byte-deterministic for identical canonical input", async () => {
    const { buildConfidentialXlsxBytes } = await import("./xlsx-export");
    const first = buildConfidentialXlsxBytes(XLSX, correspondence());
    const second = buildConfidentialXlsxBytes(XLSX, correspondence());
    expect(Buffer.from(first).equals(Buffer.from(second))).toBe(true);
  });

  it("fails closed on a value that is not a correspondence", async () => {
    const { buildConfidentialXlsxBytes, XlsxExportError } = await import("./xlsx-export");
    expect(() => buildConfidentialXlsxBytes(XLSX, { kind: "other" })).toThrowError(XlsxExportError);
  });
});

describe("formula-injection guard — both workbooks", () => {
  const TRIGGERS = ["=CMD(1)", "+SUM(A1:A2)", "-2+3", "@x"];

  it("Safe XLSX keeps formula-like strings as literal string cells, never formulas", async () => {
    const { buildSafeXlsxBytes } = await import("./xlsx-export");
    const dataset: StructuredSafeDataset = Object.freeze({
      kind: "structured-safe-dataset",
      headers: Object.freeze(["Nota"]),
      rows: Object.freeze(TRIGGERS.map((value) => Object.freeze([value]))),
    });
    const workbook = readWorkbook(buildSafeXlsxBytes(XLSX, dataset, null));
    const data = workbook.sheet("Data");
    TRIGGERS.forEach((value, index) => {
      const cell = data.cells[`A${index + 2}`];
      expect(cell?.t).toBe("s");
      expect(cell?.t).not.toBe("f");
      expect(cell?.v).toBe(value);
    });
  });

  it("Confidential XLSX keeps formula-like originals as literal string cells", async () => {
    const { buildConfidentialXlsxBytes } = await import("./xlsx-export");
    const planted: StructuredConfidentialCorrespondence = Object.freeze({
      kind: "structured-confidential-correspondence",
      policyId: "standard",
      columns: Object.freeze([
        Object.freeze({
          columnIndex: 3,
          header: "Nota",
          disposition: "pseudonymize" as const,
          entries: Object.freeze(
            TRIGGERS.map((original) => Object.freeze({ original, transformed: "QID_001" }))
          ),
        }),
      ]),
      totals: Object.freeze({
        dateAge: 0,
        pseudonymize: 1,
        remove: 0,
        studyId: 0,
        freeText: 0,
        transformedCells: 4,
      }),
    });
    const workbook = readWorkbook(buildConfidentialXlsxBytes(XLSX, planted));
    const cells = Object.values(workbook.sheet("Correspondence").cells).filter(
      (cell) => typeof cell?.v === "string" && TRIGGERS.includes(cell.v as string)
    );
    expect(cells).toHaveLength(TRIGGERS.length);
    for (const cell of cells) {
      expect(cell?.t).toBe("s");
      expect(cell?.t).not.toBe("f");
    }
  });
});

describe("xlsx-export privacy boundary — no content logging/storage/network", () => {
  it("touched XLSX modules contain no logging/storage/network sinks and no new dependency", async () => {
    const { buildSafeXlsxBytes, buildConfidentialXlsxBytes } = await import("./xlsx-export");
    // Non-vacuous: the serializers under test really exist and run.
    expect(typeof buildSafeXlsxBytes).toBe("function");
    expect(typeof buildConfidentialXlsxBytes).toBe("function");

    // File list extended by REC-05 WU-C to cover the single-item/new modules
    // whose artifacts must share the same memory-only (D-013) boundary: the
    // Safe TXT/DOCX/PDF builders, the clipboard helper, the Result readiness
    // model and the shared ExportStep surface.
    const TOUCHED = [
      "xlsx-export.ts",
      "xlsx-loader.ts",
      "../export/ExportStep.tsx",
      "../export/singleResultModel.ts",
      "../output/docx-builder.ts",
      "../output/pdf-builder.ts",
      "../output/clipboard.ts",
    ];
    const FORBIDDEN_CALLS = [
      /console\.(log|info|warn|error|debug|trace|table)\s*\(/,
      /localStorage/,
      /sessionStorage/,
      /indexedDB/,
      /fetch\s*\(/,
      /XMLHttpRequest/,
      /navigator\.sendBeacon/,
    ];
    for (const file of TOUCHED) {
      const text = fs.readFileSync(path.join(__dirname, file), "utf8");
      for (const sink of FORBIDDEN_CALLS) {
        expect(sink.test(text), `${file} must not contain ${sink}`).toBe(false);
      }
    }
    // No new spreadsheet dependency: only the governed same-origin bundle.
    const packageText = fs.readFileSync(
      path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "..", "..", "package.json"),
      "utf8"
    );
    expect(packageText).not.toMatch(/exceljs|sheetjs|xlsx/i);
    const loader = fs.readFileSync(path.join(__dirname, "xlsx-loader.ts"), "utf8");
    expect(loader).toContain("/vendor/xlsx.full.min.js");
  });
});
