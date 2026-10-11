/**
 * REC-04 WU-D composed product journey: header detection → Configure
 * options → existing Review/Gate → CSV/XLSX Export on ONE synthetic
 * hospital-style workbook.
 *
 * This is a real end-to-end composition, not isolated unit tests: a
 * two-sheet workbook (`Portada` cover + `Urgencias` data with explanatory
 * rows before the real header) traverses explicit sheet selection,
 * explicit header-row selection, Study-ID prefix + visit-numbering options,
 * free-text review, the Privacy Gate and Safe/Confidential export.
 *
 * Covered composed oracles (handoff §5 WU-D):
 *  - metadata-before-header XLSX + explicit sheet/header handling reaches
 *    the correct Configure schema;
 *  - custom prefix and visit numbering reach Safe CSV and Safe XLSX
 *    consistently;
 *  - Safe XLSX contains no originals/correspondence and preserves useful
 *    typed values/blanks;
 *  - Confidential XLSX contains authorized correspondence only and cannot
 *    download without the additional confirmation;
 *  - existing REC-03 free-text review/date semantics still gate output;
 *  - no new workflow step/route/class/mode appears.
 *
 * The workbook is generated deterministically at test time with the
 * GOVERNED same-origin SheetJS bundle (`lib/xlsx.full.min.js`, the exact
 * bytes `/vendor/xlsx.full.min.js` serves) evaluated in a sandbox — the
 * same pattern `app-v4/src/structured/excel.test.ts` uses. No committed
 * binary fixture, no PHI, no network (the auto no-network fixture from
 * ./harness/fixtures applies to every test).
 */
import { expect, test } from "./harness/fixtures";
import { keepOriginalThroughUi } from "./harness/flows";

import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import vm from "node:vm";
import type { Page } from "@playwright/test";

const REPO_LIB = path.resolve(__dirname, "..", "lib", "xlsx.full.min.js");

type XlsxAuthoringLib = {
  read(bytes: Uint8Array, options: { type: "array"; cellDates?: boolean }): WorkbookLike;
  utils: {
    book_new(): Record<string, unknown>;
    book_append_sheet(workbook: Record<string, unknown>, sheet: unknown, name: string): void;
    aoa_to_sheet(rows: readonly (string | number | boolean | null)[][]): Record<string, unknown>;
  };
  write(workbook: unknown, options: { type: "array"; bookType: "xlsx" }): ArrayBuffer;
};

type WorkbookLike = {
  SheetNames: string[];
  Sheets: Record<string, Record<string, { t?: string; v?: unknown }>>;
};

function loadGovernedXlsx(): XlsxAuthoringLib {
  const code = fs.readFileSync(REPO_LIB, "utf8");
  const context: Record<string, unknown> = { window: {}, console };
  vm.createContext(context);
  vm.runInContext(`${code}\n;this.__loaded = window.XLSX;`, context);
  const lib = context.__loaded as XlsxAuthoringLib;
  if (!lib || typeof lib.read !== "function" || typeof lib.write !== "function") {
    throw new Error("Governed SheetJS bundle did not load in the Playwright sandbox.");
  }
  return lib;
}

const XLSX = loadGovernedXlsx();

/** Deterministic synthetic hospital-style workbook bytes (no PHI). */
function buildHospitalWorkbookBytes(): Buffer {
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(
    workbook,
    XLSX.utils.aoa_to_sheet([["Hospital General"], ["informe interno"]]),
    "Portada"
  );
  const sheet = XLSX.utils.aoa_to_sheet([
    ["Hospital General", "Registro de visitas", "Confidencial"],
    ["Semana 12"],
    [],
    [
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
    ],
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
  XLSX.utils.book_append_sheet(workbook, sheet, "Urgencias");
  return Buffer.from(XLSX.write(workbook, { type: "array", bookType: "xlsx" }));
}

function readWorkbook(bytes: Uint8Array): WorkbookLike {
  return XLSX.read(bytes, { type: "array", cellDates: false });
}

function cellValues(workbook: WorkbookLike, sheet: string): unknown[] {
  return Object.values(workbook.Sheets[sheet] ?? {}).map((cell) => cell.v);
}

/** Materialize the synthetic workbook as an uploadable `.xlsx` temp file. */
function materializeWorkbook(): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "rec04-wud-"));
  const file = path.join(dir, "hospital-urgencias.xlsx");
  fs.writeFileSync(file, buildHospitalWorkbookBytes());
  return file;
}

function columnRow(page: Page, header: string) {
  return page
    .getByRole("table", { name: "Column classification list" })
    .locator("tbody tr")
    .filter({ has: page.getByRole("button", { name: header }) });
}

/** Select one comparative row so its contextual inspector controls render. */
async function selectColumn(page: Page, header: string): Promise<void> {
  await columnRow(page, header).getByRole("button", { name: header }).click();
}

/** Upload the workbook, pick the sheet + header row explicitly, configure fully. */
async function createAndConfigureComposedJob(page: Page): Promise<void> {
  const xlsx = materializeWorkbook();
  await page.goto("/");
  await page
    .getByLabel("Seleccionar archivos (TXT, PDF, DOCX, CSV, XLS, XLSX)")
    .setInputFiles(xlsx);
  await page.getByRole("button", { name: "Crear trabajo" }).click();
  // Quiet shell (#84): the structured job lands in its real Configure
  // workspace. Issue #84 correction: the internal kind is not header chrome,
  // so the persistent header fact asserted here is the job NAME.
  await expect(page.locator("header")).toContainText("hospital-urgencias.xlsx");

  // No new step/mode appears: the quiet shell (#84) has no universal
  // navigation. Before any cell is routed to free text there is NO «Continuar
  // a la revisión» detour (issue #85 §3.4): the canonical onward action is
  // the factual privacy check.
  await expect(page.getByRole("button", { name: "Continuar a la revisión" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Privacy Gate", exact: true })).toHaveCount(1);

  // Explicit multi-sheet selection first: never the silent first sheet.
  await expect(page.getByRole("heading", { name: "Select a worksheet" })).toBeVisible();
  await page.getByLabel("Worksheet").selectOption("Urgencias");
  await page.getByRole("button", { name: "Load sheet" }).click();

  // Ambiguous cover line + real header: explicit header-row choice, never a
  // silent first row. Row 4 (0-based index 3) is the real header.
  await expect(page.getByRole("heading", { name: "Select the header row" })).toBeVisible();
  await page.getByLabel("Header row", { exact: true }).selectOption("3");
  await page.getByRole("button", { name: "Use row 4 as header" }).click();

  // The resolved schema reaches Configure: 10 hospital columns.
  const summary = page.getByRole("status", { name: "Structured configuration facts" });
  await expect(summary).toContainText("Columns: 10");

  await page.getByLabel("Columna de identificación del paciente").selectOption("NHC");
  await selectColumn(page, "Fecha_Visita");
  await page.getByLabel("Date role for Fecha_Visita").selectOption("visit");
  await selectColumn(page, "Fecha_Nacimiento");
  await page.getByLabel("Date role for Fecha_Nacimiento").selectOption("birth");
  await selectColumn(page, "Notas");
  await page.getByLabel("Reviewer action for Notas").selectOption("process-as-text");
  await selectColumn(page, "Edad_Num");
  await page.getByLabel("Reviewer classification for Edad_Num").selectOption("insensitive");
  await selectColumn(page, "Atiende");
  await page.getByLabel("Reviewer classification for Atiende").selectOption("insensitive");
  await selectColumn(page, "Observaciones");
  await page.getByLabel("Reviewer classification for Observaciones").selectOption("insensitive");
  await expect(summary).toContainText("Columns requiring review: 0");

  // Stronger authorities visibly lock their derived action.
  await expect(columnRow(page, "NHC")).toContainText("Study ID");
  await expect(columnRow(page, "NHC")).toContainText("derivado/bloqueado");
  await expect(columnRow(page, "Fecha_Visita")).toContainText("Date policy");
  await expect(columnRow(page, "Centro")).toContainText("Pseudonymize");
  await expect(columnRow(page, "Diagnostico")).toContainText("Keep");
  await expect(columnRow(page, "Notas")).toContainText("Process as text");

  // Output options: custom prefix; visit numbering is enabled by the
  // patient-ID heritage default. (Issue #85 composed-hierarchy correction:
  // the options area now sits below the comparison table, collapsed behind a
  // native disclosure — this selector-only expansion keeps every control
  // reachable; the assertions themselves are unchanged.)
  await page.locator("summary").filter({ hasText: "Output options" }).click();
  await page.getByLabel("Study-ID prefix").fill("hs1");
  await expect(page.getByLabel("Visit numbering (Visita_Num)")).toBeChecked();
  const facts = page.getByRole("status", { name: "Structured output facts" });
  await expect(facts).toContainText("Patients:");
  await expect(facts).not.toContainText("unavailable");
}

/** Decide every pending detection of the active free-text cell workspace. */
async function decideActiveCell(page: Page): Promise<void> {
  await page.getByRole("button", { name: "Pending", exact: true }).click();
  const workspaceProgress = page.getByRole("status", { name: "Review progress", exact: true });
  const pendingCount = workspaceProgress.locator('dt:text-is("Pending:") + dd');
  for (let guard = 0; guard < 30; guard += 1) {
    if ((await pendingCount.innerText()).trim() === "0") break;
    await page.getByRole("list", { name: "Detections" }).getByRole("button").first().click();
    const accept = page.getByRole("button", { name: "Aceptar detección" });
    if (await accept.isEnabled()) await accept.click();
    else await keepOriginalThroughUi(page);
  }
  await expect(pendingCount).toHaveText("0");
}

async function reviewComposedFreeText(page: Page): Promise<void> {
  await page.getByRole("button", { name: "Continuar a la revisión" }).click();
  await page.getByRole("button", { name: "Process free-text cells" }).click();
  const progress = page.getByRole("status", { name: "Free-text review progress" });
  await expect(progress).toContainText("Cells: 2");
  await page.getByRole("button", { name: /Notas, row 1/ }).click();
  await decideActiveCell(page);
  await page.getByRole("button", { name: /Notas, row 2/ }).click();
  await decideActiveCell(page);
  await expect(progress).toContainText("Pending decisions: 0");
  await expect(progress).toContainText("Free-text review ready: Yes");
}

async function openComposedGate(page: Page): Promise<void> {
  await page.getByRole("button", { name: "Privacy Gate", exact: true }).click();
  const gateFacts = page.getByRole("status", { name: "Structured export facts" });
  await expect(gateFacts).toContainText("Columns: 10");
  await expect(gateFacts).toContainText("Columns requiring review: 0");
  await expect(gateFacts).toContainText("Unsupported columns: 0");
  await expect(page.getByRole("region", { name: "Decision checkpoint" })).toContainText(
    "Review complete"
  );
}

test("composed hospital workbook traverses sheet/header → options → review → gate → Safe CSV + Safe XLSX", async ({
  page,
}) => {
  await createAndConfigureComposedJob(page);
  await reviewComposedFreeText(page);
  await openComposedGate(page);

  await page.getByRole("button", { name: "Ir al resultado" }).click();

  // Safe CSV: custom prefix + visit numbering compose consistently.
  const safeDownloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "Download Safe Structured Output (.csv)" }).click();
  const safeDownload = await safeDownloadPromise;
  const safeCsv = fs.readFileSync((await safeDownload.path())!, "utf8");
  const lines = safeCsv.split("\n");
  expect(lines[0]).toBe(
    "ID_ESTUDIO,Visita_Num,Fecha_Visita,Fecha_Nacimiento,Centro,Diagnostico,Notas,Edad_Num,Atiende,Observaciones"
  );
  expect(lines).toHaveLength(4);
  expect(lines[1].split(",")[0]).toBe("HS1_001");
  expect(lines[2].split(",")[0]).toBe("HS1_001");
  expect(lines[3].split(",")[0]).toBe("HS1_002");
  // 1-based occurrence per patient in input row order.
  expect(lines[1].split(",")[1]).toBe("1");
  expect(lines[2].split(",")[1]).toBe("2");
  expect(lines[3].split(",")[1]).toBe("1");
  expect(safeCsv).toContain("2023-01");
  expect(safeCsv).toContain("QID_001");
  expect(safeCsv).toContain("Gripe A");
  expect(safeCsv).toContain("=CMD(1)");
  for (const leaked of [
    "P-001",
    "P-002",
    "12345678A",
    "87654321B",
    "2023-01-10",
    "1954-03-12",
    "Carmen Ruiz",
    "Norte",
  ]) {
    expect(safeCsv).not.toContain(leaked);
  }

  // Safe XLSX downloads directly (no confirmation) and reads back with
  // typed values/blanks, no originals, literal formula-like strings.
  const safeXlsxPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "Download Safe Structured Output (.xlsx)" }).click();
  const safeXlsxDownload = await safeXlsxPromise;
  const safeXlsxBytes = new Uint8Array(fs.readFileSync((await safeXlsxDownload.path())!));
  const safeWorkbook = readWorkbook(safeXlsxBytes);
  expect(safeWorkbook.SheetNames[0]).toBe("Data");
  const data = safeWorkbook.Sheets["Data"] ?? {};
  expect(data["A1"]?.v).toBe("ID_ESTUDIO");
  expect(data["B1"]?.v).toBe("Visita_Num");
  expect(data["A2"]?.v).toBe("HS1_001");
  expect(data["A4"]?.v).toBe("HS1_002");
  expect(data["B2"]).toMatchObject({ t: "n", v: 1 });
  expect(data["B3"]).toMatchObject({ t: "n", v: 2 });
  expect(data["H2"]).toMatchObject({ t: "n", v: 34 });
  expect(data["I2"]).toMatchObject({ t: "b", v: true });
  expect(data["J2"]?.t).toBe("s");
  expect(data["J2"]?.v).toBe("=CMD(1)");
  const seen = cellValues(safeWorkbook, "Data").concat(cellValues(safeWorkbook, "Summary"));
  for (const leaked of ["P-001", "P-002", "12345678A", "Carmen Ruiz", "Norte", "Sur"]) {
    expect(seen).not.toContain(leaked);
  }
});

test("structured Confidential TXT/XLSX require the additional confirmation before any download", async ({
  page,
}) => {
  await createAndConfigureComposedJob(page);
  await reviewComposedFreeText(page);
  await openComposedGate(page);
  await page.getByRole("button", { name: "Ir al resultado" }).click();

  // First TXT click downloads nothing and reveals the confirmation.
  await page.getByRole("button", { name: "Download Structured Confidential Audit (.txt)" }).click();
  await expect(
    page.getByRole("heading", { name: "Confirm confidential download (.txt)" })
  ).toBeVisible();
  const missedTxt = await page.waitForEvent("download", { timeout: 1000 }).then(
    () => false,
    () => true
  );
  expect(missedTxt).toBe(true);

  // Cancel downloads nothing and resets the confirmation.
  await page.getByRole("button", { name: "Cancel confidential download" }).click();
  await expect(
    page.getByRole("heading", { name: "Confirm confidential download (.txt)" })
  ).toHaveCount(0);
  const missedCancel = await page.waitForEvent("download", { timeout: 1000 }).then(
    () => false,
    () => true
  );
  expect(missedCancel).toBe(true);

  // Explicit Confirm downloads exactly the selected TXT format once.
  await page.getByRole("button", { name: "Download Structured Confidential Audit (.txt)" }).click();
  const auditPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "Confirm confidential download (.txt)" }).click();
  const auditDownload = await auditPromise;
  const audit = fs.readFileSync((await auditDownload.path())!, "utf8");
  expect(audit).toContain("CONFIDENTIAL");
  expect(audit).toContain("P-001");
  expect(audit).toContain("HS1_001");
  expect(audit).toContain("12345678A");
  await expect(
    page.getByRole("heading", { name: "Confirm confidential download (.txt)" })
  ).toHaveCount(0);

  // Confidential XLSX: first click downloads nothing; Confirm downloads the
  // authorized correspondence workbook (warning first).
  await page
    .getByRole("button", { name: "Download Structured Confidential Audit (.xlsx)" })
    .click();
  await expect(
    page.getByRole("heading", { name: "Confirm confidential download (.xlsx)" })
  ).toBeVisible();
  const missedXlsx = await page.waitForEvent("download", { timeout: 1000 }).then(
    () => false,
    () => true
  );
  expect(missedXlsx).toBe(true);

  const xlsxPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "Confirm confidential download (.xlsx)" }).click();
  const xlsxDownload = await xlsxPromise;
  const xlsxBytes = new Uint8Array(fs.readFileSync((await xlsxDownload.path())!));
  const workbook = readWorkbook(xlsxBytes);
  expect(workbook.SheetNames[0]).toBe("READ_FIRST");
  const warning = cellValues(workbook, "READ_FIRST")
    .map((value) => String(value ?? ""))
    .join("\n");
  expect(warning).toContain("CONFIDENTIAL");
  const table = cellValues(workbook, "Correspondence")
    .map((value) => String(value ?? ""))
    .join("\n");
  expect(table).toContain("P-001");
  expect(table).toContain("HS1_001");
  expect(table).toContain("12345678A");
  // Kept Safe-only clinical content never enters the audit.
  expect(table).not.toContain("Gripe A");
  expect(table).not.toContain("nota simple");
  expect(table).not.toContain("=CMD(1)");
});
