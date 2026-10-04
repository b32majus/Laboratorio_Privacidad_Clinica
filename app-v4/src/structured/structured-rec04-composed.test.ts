import * as fs from "node:fs";
import * as path from "node:path";
import { fileURLToPath } from "node:url";
import * as vm from "node:vm";
import { afterEach, describe, expect, it } from "vitest";

import { FLOW_STEPS, type Job } from "../domain/job";
import type { RegistryEngineInput } from "../engine/registry-engine";
import type { EngineOutcome } from "../engine/types";
import { CONFIDENTIAL_AUDIT_WARNING_LINE } from "../output/confidential-audit-serializer";
import {
  applyDecision,
  canFinalize,
  getFinalText,
  type ReviewSession,
} from "../review/review-domain";
import {
  STRUCTURED_ACTIONS,
  STRUCTURED_COLUMN_CLASSES,
  createStructuredConfiguration,
  overrideColumnAction,
  overrideColumnClass,
  setStructuredDateRole,
  type StructuredConfiguration,
} from "./configuration";
import { parseStructuredWorkbook } from "./excel";
import { processStructuredFreeTextCells } from "./free-text";
import type { StructuredGrid } from "./grid";
import {
  createDefaultStructuredOutputOptions,
  setStudyIdPrefix,
  type StructuredOutputOptions,
} from "./output-options";
import { buildStructuredTransformPlan } from "./transform-plan";
import { prepareStructuredOutput } from "./transformed-dataset";
import { serializeStructuredSafeCsv } from "./csv-writer";
import {
  resetXlsxLoaderForTests,
  type XlsxCell,
  type XlsxLib,
} from "./xlsx-loader";

/**
 * REC-04 WU-D composed oracles: header detection → Configure options →
 * existing Review/Gate → CSV/XLSX Export on ONE synthetic hospital-style
 * workbook. This is a real end-to-end composition at the
 * browser-independent seam, not four isolated unit tests. Synthetic
 * fixtures only; no real PHI.
 *
 * Workbook shape (single sheet `Urgencias`):
 *  - row 1: explanatory cover line that itself looks header-like
 *    (3 textual cells + a clinical token), so detection stays ambiguous;
 *  - row 2: single-cell metadata line (never a candidate);
 *  - row 3: blank metadata row (never a candidate);
 *  - row 4: the real hospital header;
 *  - rows 5-7: three data rows with repeated patients, visit/birth dates,
 *    a center quasi-identifier, a kept diagnosis, a free-text column with
 *    one blank cell, typed numeric/boolean cells, and one formula-like kept
 *    string (`=CMD(1)`) proving literal-string XLSX semantics.
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

type XlsxAuthoringLib = XlsxLib & {
  write(workbook: unknown, options: { type: "array"; bookType: "xlsx" }): ArrayBuffer;
  utils: XlsxLib["utils"] & {
    book_new(): Record<string, unknown>;
    book_append_sheet(workbook: Record<string, unknown>, sheet: unknown, name: string): void;
    aoa_to_sheet(
      rows: readonly (string | number | boolean | null)[][]
    ): Record<string, XlsxCell | string | undefined>;
  };
};

function seedWindow(): void {
  window.XLSX = XLSX;
}

const SHEET_NAME = "Urgencias";

const HEADER = [
  "NHC",
  "DNI",
  "Fecha_Visita",
  "Fecha_Nacimiento",
  "Centro",
  "Diagnostico",
  "Notas",
  "Edad_Num",
  "Atiende",
  "Observaciones",
];

function buildHospitalWorkbookBytes(): ArrayBuffer {
  const workbook = XLSX.utils.book_new();
  const sheet = XLSX.utils.aoa_to_sheet([
    ["Hospital General", "Registro de visitas", "Confidencial"],
    ["Semana 12"],
    [],
    HEADER,
    [
      "P-001",
      "12345678A",
      "2023-01-10",
      "1954-03-12",
      "Norte",
      "Gripe A",
      "Paciente Carmen Ruiz atendida el 12/03/2024",
      34,
      true,
      "=CMD(1)",
    ],
    [
      "P-001",
      "12345678A",
      "2023-02-14",
      "1954-03-12",
      "Norte",
      "Gripe A",
      "Control de Carmen Ruiz el 20/03/2024",
      34,
      false,
      "nota simple",
    ],
    ["P-002", "87654321B", "2023-03-15", "1980-07-04", "Sur", "Fractura", "", 41, true, null],
  ]);
  XLSX.utils.book_append_sheet(workbook, sheet, SHEET_NAME);
  return XLSX.write(workbook, { type: "array", bookType: "xlsx" }) as ArrayBuffer;
}

const JOB_SEED = "rec04-wud-composed";

/** Explicit header-row resolution of the ambiguous hospital workbook. */
async function hospitalGrid(): Promise<StructuredGrid> {
  seedWindow();
  const bytes = buildHospitalWorkbookBytes();
  const ambiguous = await parseStructuredWorkbook(bytes, { sheetName: SHEET_NAME });
  expect(ambiguous.status).toBe("header-row-required");
  if (ambiguous.status !== "header-row-required") throw new Error("expected ambiguity");
  // The cover line (row 1) and the real header (row 4) both qualify, so the
  // detector must block instead of silently choosing — never a silent row 1.
  expect(ambiguous.candidateRowIndices).toContain(0);
  expect(ambiguous.candidateRowIndices).toContain(3);
  const resolved = await parseStructuredWorkbook(bytes, {
    sheetName: SHEET_NAME,
    headerRowIndex: 3,
  });
  expect(resolved.status).toBe("success");
  if (resolved.status !== "success") throw new Error("expected explicit resolution");
  return resolved.grid;
}

function configured(grid: StructuredGrid): StructuredConfiguration {
  let configuration = createStructuredConfiguration(grid, { selectedPatientIdColumn: "NHC" });
  configuration = setStructuredDateRole(configuration, 2, "visit");
  configuration = setStructuredDateRole(configuration, 3, "birth");
  configuration = overrideColumnAction(configuration, 6, "process-as-text");
  configuration = overrideColumnClass(configuration, 7, "insensitive");
  configuration = overrideColumnClass(configuration, 8, "insensitive");
  configuration = overrideColumnClass(configuration, 9, "insensitive");
  return configuration;
}

function outputOptions(): StructuredOutputOptions {
  return setStudyIdPrefix(createDefaultStructuredOutputOptions(true), "hs1");
}

/** Deterministic stub engine: one NOMBRE detection per cell mentioning the name. */
function stubEngine() {
  let counter = 0;
  return {
    async process(input: RegistryEngineInput): Promise<EngineOutcome> {
      counter += 1;
      const name = "Carmen Ruiz";
      const start = input.text.indexOf(name);
      const entities =
        start >= 0
          ? [
              {
                type: "NOMBRE",
                text: name,
                original: name,
                position: { start, end: start + name.length },
                confidence: 0.9,
                transformed: `PACIENTE_${counter}`,
              },
            ]
          : [];
      return {
        result: {
          original: input.text,
          processed: input.text,
          entities,
          alerts: [],
          stats: { totalEntities: entities.length, byType: {} },
          sessionId: `wud-rec04-stub-${counter}`,
          processingTime: 0,
        },
        context: { mode: "shared" as const },
      };
    },
  };
}

function acceptAll(session: ReviewSession): ReviewSession {
  let next = session;
  for (const detection of session.detections) {
    next = applyDecision(next, detection.id, "accepted");
  }
  return next;
}

async function reviewedState() {
  const grid = await hospitalGrid();
  const config = configured(grid);
  const state = await processStructuredFreeTextCells({
    jobId: JOB_SEED,
    jobName: JOB_SEED,
    policyId: "standard",
    configuration: config,
    engine: stubEngine(),
  });
  return {
    config,
    state: {
      ...state,
      cells: state.cells.map((cell) =>
        cell.ok ? { ...cell, session: acceptAll(cell.session) } : cell
      ),
    },
  };
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

function structuredJob(ready: boolean): Job {
  return {
    kind: "structured",
    id: JOB_SEED,
    policyId: "standard",
    outputs: { safeOutputReady: ready, confidentialAuditReady: ready },
    errors: [],
  } as unknown as Job;
}

describe("WU-D — metadata-before-header workbook reaches the correct Configure schema", () => {
  it("blocks on the ambiguous cover line, then resolves row 4 to the hospital schema with no metadata rows", async () => {
    const grid = await hospitalGrid();
    expect(grid.headers).toEqual(HEADER);
    expect(grid.rows).toHaveLength(3);
    // Rows above the chosen header are skipped metadata, never data rows.
    expect(grid.rows[0][0]).toBe("P-001");
    expect(grid.rows[2][0]).toBe("P-002");
    for (const leaked of ["Hospital General", "Registro de visitas", "Confidencial", "Semana 12"]) {
      expect(grid.headers).not.toContain(leaked);
      for (const row of grid.rows) expect(row).not.toContain(leaked);
    }
    // Blank values and scalar normalization survive the offset path.
    expect(grid.rows[2][6]).toBeNull();
    expect(grid.rows[0][7]).toBe(34);
    expect(grid.rows[0][8]).toBe(true);
    expect(grid.rows[0][9]).toBe("=CMD(1)");

    // The resolved schema configures cleanly: no review-required columns.
    const config = configured(grid);
    expect(config.columnsRequiringReview).toEqual([]);
    expect(config.exportReady).toBe(true);
    void structuredJob(true);
  });

  it("an out-of-range explicit header selection on the hospital sheet fails typed", async () => {
    seedWindow();
    const outcome = await parseStructuredWorkbook(buildHospitalWorkbookBytes(), {
      sheetName: SHEET_NAME,
      headerRowIndex: 99,
    });
    expect(outcome.status).toBe("failed");
    if (outcome.status !== "failed") return;
    expect(outcome.code).toBe("invalid-header-row");
  });
});

describe("WU-D — custom prefix and visit numbering reach Safe CSV consistently", () => {
  it("HS1 prefix + Visita_Num compose with identical grouping, transformed dates and reviewed free text", async () => {
    const { config, state } = await reviewedState();
    for (const cell of state.cells) {
      if (cell.ok) expect(canFinalize(cell.session)).toBe(true);
    }
    const plan = buildStructuredTransformPlan(config, { policyId: "standard", jobSeed: JOB_SEED });
    const preparation = prepareStructuredOutput(config, plan, {
      freeText: state,
      outputOptions: outputOptions(),
    });
    expect(preparation.status).toBe("ready");
    if (preparation.status !== "ready") return;

    const safeCsv = serializeStructuredSafeCsv(preparation.output.safe);
    const lines = safeCsv.split("\n");
    expect(lines[0]).toBe(
      "ID_ESTUDIO,Visita_Num,Fecha_Visita,Fecha_Nacimiento,Centro,Diagnostico,Notas,Edad_Num,Atiende,Observaciones"
    );
    expect(lines).toHaveLength(4);

    const [studyIndex, visitIndex] = [0, 1];
    expect(preparation.output.safe.rows.map((row) => row[studyIndex])).toEqual([
      "HS1_001",
      "HS1_001",
      "HS1_002",
    ]);
    // 1-based occurrence sequence per patient in input row order.
    expect(preparation.output.safe.rows.map((row) => row[visitIndex])).toEqual([1, 2, 1]);

    // T19 standard semantics: visit/birth generalize to month.
    expect(preparation.output.safe.rows.map((row) => row[2])).toEqual(["2023-01", "2023-02", "2023-03"]);
    expect(preparation.output.safe.rows.map((row) => row[3])).toEqual(["1954-03", "1954-03", "1980-07"]);

    // Deterministic column-local QID tokens; kept diagnosis verbatim.
    expect(preparation.output.safe.rows.map((row) => row[4])).toEqual(["QID_001", "QID_001", "QID_002"]);
    expect(preparation.output.safe.rows[0][5]).toBe("Gripe A");

    // Reviewed free text equals canonical getFinalText; the blank stays blank.
    const finals = state.cells.map((cell) => (cell.ok ? getFinalText(cell.session) : "<failed>"));
    expect(finals).toHaveLength(2);
    expect(preparation.output.safe.rows.map((row) => row[6])).toEqual([finals[0], finals[1], null]);

    // Typed Safe scalars stay typed in the domain; the formula-like kept
    // string stays a plain string (never executed, never dropped).
    expect(preparation.output.safe.rows[0][7]).toBe(34);
    expect(preparation.output.safe.rows[0][8]).toBe(true);
    expect(preparation.output.safe.rows[0][9]).toBe("=CMD(1)");

    // No originals, no removed identifier, no exact dates, no unreviewed
    // name, no correspondence markers in Safe CSV.
    for (const leaked of [
      "P-001",
      "P-002",
      "12345678A",
      "87654321B",
      "2023-01-10",
      "1954-03-12",
      "Carmen Ruiz",
      "Norte",
      "->",
    ]) {
      expect(safeCsv).not.toContain(leaked);
    }
  });
});

describe("WU-D — Safe XLSX read-back from the composed hospital output", () => {
  it("preserves headers/order/blanks/typed values, carries no originals, keeps formula-like cells literal", async () => {
    const { buildSafeXlsxBytes } = await import("./xlsx-export");
    const { deriveStructuredSummary } = await import("./transformed-dataset");
    const { config, state } = await reviewedState();
    const plan = buildStructuredTransformPlan(config, { policyId: "standard", jobSeed: JOB_SEED });
    const preparation = prepareStructuredOutput(config, plan, {
      freeText: state,
      outputOptions: outputOptions(),
    });
    expect(preparation.status).toBe("ready");
    if (preparation.status !== "ready") return;

    const summary = deriveStructuredSummary(config);
    expect(summary.rowCount).toBe(3);
    expect(summary.patient?.uniquePatients).toBe(2);

    const workbook = readWorkbook(buildSafeXlsxBytes(XLSX, preparation.output.safe, summary));
    expect(workbook.sheetNames).toEqual(["Data", "Summary"]);
    const data = workbook.sheet("Data");
    expect(data.cells["A1"]?.v).toBe("ID_ESTUDIO");
    expect(data.cells["B1"]?.v).toBe("Visita_Num");
    expect(data.cells["A2"]?.v).toBe("HS1_001");
    expect(data.cells["A3"]?.v).toBe("HS1_001");
    expect(data.cells["A4"]?.v).toBe("HS1_002");
    // Visit numbers stay typed numeric cells in row order.
    expect(data.cells["B2"]).toMatchObject({ t: "n", v: 1 });
    expect(data.cells["B3"]).toMatchObject({ t: "n", v: 2 });
    expect(data.cells["B4"]).toMatchObject({ t: "n", v: 1 });
    // Useful typed values and blanks survive the XLSX round trip.
    expect(data.cells["H2"]).toMatchObject({ t: "n", v: 34 });
    expect(data.cells["I2"]).toMatchObject({ t: "b", v: true });
    expect(data.cells["G4"]?.v ?? null).toBeNull();
    expect(data.cells["J4"]?.v ?? null).toBeNull();
    // The formula-like kept string is a literal string cell, never a formula.
    expect(data.cells["J2"]?.t).toBe("s");
    expect(data.cells["J2"]?.t).not.toBe("f");
    expect(data.cells["J2"]?.v).toBe("=CMD(1)");

    // Planted original/mapping leak forbidden anywhere in Safe XLSX.
    const seen: unknown[] = [];
    for (const name of workbook.sheetNames) {
      for (const cell of Object.values(workbook.sheet(name).cells)) seen.push(cell?.v);
    }
    for (const leaked of [
      "P-001",
      "P-002",
      "12345678A",
      "87654321B",
      "Carmen Ruiz",
      "Norte",
      "Sur",
      "->",
    ]) {
      expect(seen).not.toContain(leaked);
    }

    // The Summary sheet carries only factual counts, never correspondence.
    const summaryText = Object.values(workbook.sheet("Summary").cells)
      .map((cell) => String(cell?.v ?? ""))
      .join("\n");
    expect(summaryText).toContain("3");
    expect(summaryText).toContain("2");
    expect(summaryText).not.toContain("P-001");
    expect(summaryText).not.toContain("->");
  });
});

describe("WU-D — Confidential XLSX from the composed hospital output", () => {
  it("warns first and carries the authorized correspondence only", async () => {
    const { buildConfidentialXlsxBytes } = await import("./xlsx-export");
    const { config, state } = await reviewedState();
    const plan = buildStructuredTransformPlan(config, { policyId: "standard", jobSeed: JOB_SEED });
    const preparation = prepareStructuredOutput(config, plan, {
      freeText: state,
      outputOptions: outputOptions(),
    });
    expect(preparation.status).toBe("ready");
    if (preparation.status !== "ready") return;

    const workbook = readWorkbook(buildConfidentialXlsxBytes(XLSX, preparation.output.confidential));
    expect(workbook.sheetNames[0]).toBe("READ_FIRST");
    const warning = Object.values(workbook.sheet("READ_FIRST").cells)
      .map((cell) => String(cell?.v ?? ""))
      .join("\n");
    expect(warning).toContain(CONFIDENTIAL_AUDIT_WARNING_LINE);

    const table = Object.values(workbook.sheet("Correspondence").cells)
      .map((cell) => String(cell?.v ?? ""))
      .join("\n");
    // Authorized correspondence: Study-ID mapping with the CUSTOM prefix,
    // removed DNI originals, center pseudonyms, free-text pairs.
    expect(table).toContain("P-001");
    expect(table).toContain("HS1_001");
    expect(table).toContain("12345678A");
    expect(table).toContain("(removed)");
    expect(table).toContain("Norte");
    expect(table).toContain("QID_001");
    expect(table).toContain("Carmen Ruiz");
    // Kept Safe-only clinical content is never pulled into the audit.
    expect(table).not.toContain("Gripe A");
    expect(table).not.toContain("Fractura");
    expect(table).not.toContain("nota simple");
    expect(table).not.toContain("=CMD(1)");

    const metadata = Object.values(workbook.sheet("Metadata").cells)
      .map((cell) => String(cell?.v ?? ""))
      .join("\n");
    expect(metadata).toContain("standard");
    expect(metadata).not.toContain("P-001");
  });
});

describe("WU-D — REC-03 review/date semantics still gate the composed output", () => {
  it("unprocessed free-text configuration never yields composed Safe bytes", async () => {
    const grid = await hospitalGrid();
    const config = configured(grid);
    const plan = buildStructuredTransformPlan(config, { policyId: "standard", jobSeed: JOB_SEED });
    const preparation = prepareStructuredOutput(config, plan, { outputOptions: outputOptions() });
    expect(preparation.status).toBe("blocked");
    if (preparation.status !== "blocked") return;
    expect(preparation.output).toBeNull();
    expect(preparation.reasons.join(" ")).toMatch(/free-text/);
  });

  it("an invalid formula-like prefix blocks the composed preparation with an exact reason", async () => {
    const { config, state } = await reviewedState();
    const plan = buildStructuredTransformPlan(config, { policyId: "standard", jobSeed: JOB_SEED });
    const preparation = prepareStructuredOutput(config, plan, {
      freeText: state,
      outputOptions: { studyIdPrefix: "=CMD", addVisitNumber: true },
    });
    expect(preparation.status).toBe("blocked");
    if (preparation.status !== "blocked") return;
    expect(preparation.output).toBeNull();
    expect(preparation.reasons.join(" ")).toMatch(/prefix/i);
  });
});

describe("WU-D — no new workflow step/route/class/mode appears", () => {
  it("keeps the single five-step shell and the exact five-class vocabulary", () => {
    expect(FLOW_STEPS).toEqual(["input", "configure", "review", "privacy-gate", "export"]);
    expect(STRUCTURED_COLUMN_CLASSES).toEqual([
      "identifier",
      "quasi-identifier",
      "sensitive",
      "insensitive",
      "unknown",
    ]);
    expect(STRUCTURED_COLUMN_CLASSES).not.toContain("process-as-text");
    expect(STRUCTURED_ACTIONS).toContain("process-as-text");
  });
});
