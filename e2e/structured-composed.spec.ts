/**
 * REC-03 WU-D composed structured E2E: one synthetic multi-row Job with
 * repeated patients, visit/birth dates, a center quasi-identifier, a kept
 * diagnosis, a free-text column and a second direct identifier traverses the
 * full V4 flow `Input → Configure → Review → Privacy Gate → Export`.
 *
 * Covered contracts (D-021, no new route/page/mode/class):
 *  - Study ID + action authority + free-text review + T19 date semantics
 *    compose with no seam gaps (missing readiness facts, ungated export,
 *    stale review state);
 *  - Safe CSV carries ID_ESTUDIO linkage, transformed dates, QID tokens,
 *    reviewed free text and kept diagnosis with no originals/correspondence;
 *  - the Confidential artifact carries the allowed mappings separately;
 *  - unresolved state keeps Gate/Export closed; switching policy drops the
 *    free-text review (no stale certification) and closes the gate again;
 *  - the step navigation keeps exactly the five canonical steps.
 *
 * The auto no-network fixture from ./harness/fixtures applies to every test.
 * All content is synthetic; no real PHI anywhere.
 */
import { expect, test } from "./harness/fixtures";
import { keepOriginalThroughUi } from "./harness/flows";

import fs from "node:fs";
import path from "node:path";
import type { Page } from "@playwright/test";

const CSV = path.resolve(__dirname, "fixtures/structured-composed.csv");

async function createComposedJob(page: Page): Promise<void> {
  await page.goto("/");
  await page.getByLabel("Seleccionar archivos (TXT, PDF, DOCX, CSV, XLS, XLSX)").setInputFiles(CSV);
  await page.getByRole("button", { name: "Crear trabajo" }).click();
  // Quiet shell (#84): the structured job lands in its real Configure
  // workspace. Issue #84 correction: the internal kind is not header chrome,
  // so the persistent header fact asserted here is the job NAME.
  await expect(page.locator("header")).toContainText(path.basename(CSV));
}

function columnRow(page: Page, header: string) {
  // Scope by the row's select button: a bare hasText filter would also match
  // nested content, and the comparative row is identified by its column.
  return page
    .getByRole("table", { name: "Lista de clasificación de columnas" })
    .locator("tbody tr")
    .filter({ has: page.getByRole("button", { name: header }) });
}

/** Select one comparative row so its contextual inspector controls render. */
async function selectColumn(page: Page, header: string): Promise<void> {
  await columnRow(page, header).getByRole("button", { name: header }).click();
}

/** Fully configure the composed job: patient ID, date roles, free-text action. */
async function configureComposedJob(page: Page): Promise<void> {
  await page.getByLabel("Columna de identificación del paciente").selectOption("NHC");
  await selectColumn(page, "Fecha_Visita");
  await page.getByLabel("Rol de fecha para Fecha_Visita").selectOption("visit");
  await selectColumn(page, "Fecha_Nacimiento");
  await page.getByLabel("Rol de fecha para Fecha_Nacimiento").selectOption("birth");
  await selectColumn(page, "Notas");
  await page.getByLabel("Acción del revisor para Notas").selectOption("process-as-text");
  const summary = page.getByRole("status", { name: "Datos de la configuración estructurada" });
  await expect(summary).toContainText("Columnas que requieren revisión: 0");
}

/** Decide every pending detection of the active free-text cell workspace. */
async function decideActiveCell(page: Page): Promise<void> {
  // Filter to pending detections so the first list item is always an
  // undecided one (re-clicking a decided detection would never advance).
  await page.getByRole("button", { name: "Pendientes", exact: true }).click();
  const workspaceProgress = page.getByRole("status", {
    name: "Progreso de la revisión",
    exact: true,
  });
  const pendingCount = workspaceProgress.locator('dt:text-is("Pendientes:") + dd');
  for (let guard = 0; guard < 30; guard += 1) {
    if ((await pendingCount.innerText()).trim() === "0") break;
    await page.getByRole("list", { name: "Hallazgos" }).getByRole("button").first().click();
    const accept = page.getByRole("button", { name: "Aceptar detección" });
    if (await accept.isEnabled()) await accept.click();
    else await keepOriginalThroughUi(page);
  }
  await expect(pendingCount).toHaveText("0");
}

test("composed structured Job traverses Configure → Review → Privacy Gate → Export", async ({
  page,
}) => {
  await createComposedJob(page);
  const summary = page.getByRole("status", { name: "Datos de la configuración estructurada" });
  await expect(summary).toContainText("Columnas: 7");
  // Unresolved quasi/date-role columns and the Unknown free-text column keep
  // the export gate closed before configuration.
  await expect(summary).toContainText("Columnas que requieren revisión: 3");
  await expect(summary).toContainText("Exportación estructurada preparada: No");
  await expect(
    page.getByRole("alert", { name: "Motivos de bloqueo de la exportación estructurada" })
  ).toContainText(/requiere[n]? revisión/);

  await configureComposedJob(page);

  // Stronger authorities visibly lock their derived action.
  await expect(columnRow(page, "NHC")).toContainText("ID de estudio");
  await expect(columnRow(page, "NHC")).toContainText("derivado/bloqueado");
  await expect(columnRow(page, "Fecha_Visita")).toContainText("Política de fechas");
  await expect(columnRow(page, "Centro")).toContainText("Seudonimizar");
  await expect(columnRow(page, "Diagnostico")).toContainText("Conservar");
  await expect(columnRow(page, "Notas")).toContainText("Procesar como texto");

  // No new step/mode appears: the quiet shell (#84) has no universal
  // navigation and offers exactly the canonical onward task action.
  await expect(page.getByRole("button", { name: "Continuar a la revisión" })).toHaveCount(1);

  // Review: the free-text cells are unprocessed until the explicit run.
  await page.getByRole("button", { name: "Continuar a la revisión" }).click();
  await expect(page.getByRole("status")).toContainText(/no se han procesado/);
  await page.getByRole("button", { name: "Procesar celdas de texto libre" }).click();
  const progress = page.getByRole("status", { name: "Progreso de la revisión de texto libre" });
  await expect(progress).toContainText("Celdas: 2");

  // Decide every pending detection in both cells (row-major queue names
  // which column/row cell is under review).
  await page.getByRole("button", { name: /Notas, fila 1/ }).click();
  await decideActiveCell(page);
  await page.getByRole("button", { name: /Notas, fila 2/ }).click();
  await decideActiveCell(page);
  await expect(progress).toContainText("Decisiones pendientes: 0");
  await expect(progress).toContainText("Revisión de texto libre preparada: Sí");

  // Privacy Gate: the composed readiness is factual and complete.
  await page.getByRole("button", { name: "Comprobación de privacidad", exact: true }).click();
  const gateFacts = page.getByRole("status", { name: "Datos de la salida estructurada" });
  await expect(gateFacts).toContainText("Columnas: 7");
  await expect(gateFacts).toContainText("Columnas que requieren revisión: 0");
  await expect(gateFacts).toContainText("Columnas no compatibles: 0");
  await expect(page.getByRole("alert")).toHaveCount(0);
  await expect(page.getByRole("region", { name: "Punto de control de la decisión" })).toContainText(
    "Preparado"
  );

  // Export: separate Safe CSV and Confidential Audit downloads.
  await page.getByRole("button", { name: "Ir al resultado" }).click();
  const safeDownloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "Descargar salida estructurada segura (.csv)" }).click();
  const safeDownload = await safeDownloadPromise;
  const safeCsv = fs.readFileSync((await safeDownload.path())!, "utf8");
  const lines = safeCsv.split("\n");
  // REC-04 D-022: the patient-ID heritage default enables row-order
  // Visita_Num immediately after ID_ESTUDIO.
  expect(lines[0]).toBe(
    "ID_ESTUDIO,Visita_Num,Fecha_Visita,Fecha_Nacimiento,Centro,Diagnostico,Notas"
  );
  expect(lines).toHaveLength(4);
  // Repeated patients reuse the same Study ID (row linkage preserved).
  expect(lines[1].split(",")[0]).toBe("PAC_001");
  expect(lines[2].split(",")[0]).toBe("PAC_001");
  expect(lines[3].split(",")[0]).toBe("PAC_002");
  // 1-based occurrence per patient in input row order (not chronology).
  expect(lines[1].split(",")[1]).toBe("1");
  expect(lines[2].split(",")[1]).toBe("2");
  expect(lines[3].split(",")[1]).toBe("1");
  // Transformed dates/ages (T19 month precision under Standard), QID tokens,
  // kept diagnosis as configured.
  expect(safeCsv).toContain("2023-01");
  expect(safeCsv).toContain("1954-03");
  expect(safeCsv).toContain("QID_001");
  expect(safeCsv).toContain("QID_002");
  expect(safeCsv).toContain("Gripe A");
  expect(safeCsv).toContain("Fractura");
  // No originals, no removed identifier, no correspondence in Safe output.
  for (const leaked of [
    "P-001",
    "P-002",
    "12345678A",
    "87654321B",
    "2023-01-10",
    "1954-03-12",
    "Carmen Sánchez",
    "Centro Norte",
  ]) {
    expect(safeCsv).not.toContain(leaked);
  }

  const auditDownloadPromise = page.waitForEvent("download");
  await page
    .getByRole("button", { name: "Descargar auditoría confidencial estructurada (.txt)" })
    .click();
  // REC-04 D-022 (H-42 structured slice): the identifiable Confidential
  // artifact requires the additional deliberate in-zone confirmation.
  await page.getByRole("button", { name: "Confirmar descarga confidencial (.txt)" }).click();
  const auditDownload = await auditDownloadPromise;
  const audit = fs.readFileSync((await auditDownload.path())!, "utf8");
  expect(audit).toContain("CONFIDENTIAL");
  expect(audit).toContain("P-001");
  expect(audit).toContain("PAC_001");
  expect(audit).toContain("12345678A");
  expect(audit).toContain("Centro Norte");
  // Kept columns carry no correspondence.
  expect(audit).not.toContain("Gripe A");
});

test("switching policy drops the free-text review and closes the gate (no stale certification)", async ({
  page,
}) => {
  await createComposedJob(page);
  await configureComposedJob(page);

  await page.getByRole("button", { name: "Continuar a la revisión" }).click();
  await page.getByRole("button", { name: "Procesar celdas de texto libre" }).click();
  await expect(
    page.getByRole("status", { name: "Progreso de la revisión de texto libre" })
  ).toContainText("Celdas: 2");

  // A real policy change invalidates the sessions processed under the
  // previous policy: Review returns to the unprocessed state.
  await page.getByLabel("Política de privacidad:").selectOption("external-ai");
  await expect(page.getByRole("status")).toContainText(/no se han procesado/);
  await expect(page.getByRole("button", { name: "Procesar celdas de texto libre" })).toBeVisible();

  // Configure reports the export not ready, and the quiet shell stays
  // fail-closed (issue #84): no Privacy Gate or Result destination is offered
  // anywhere while the export gate is closed — only the canonical Configure
  // work and its onward review action.
  await page.getByRole("button", { name: "Volver a preparar datos" }).click();
  await expect(
    page.getByRole("status", { name: "Datos de la configuración estructurada" })
  ).toContainText("Exportación estructurada preparada: No");
  await expect(
    page.getByRole("button", { name: "Comprobación de privacidad", exact: true })
  ).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Ir al resultado" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Ver resultado" })).toHaveCount(0);
});
