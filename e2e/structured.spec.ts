/**
 * Structured Unknown review gate E2E (Work Order T21 #25; SPEC_V4_QUALITY_
 * SECURITY_DEPLOY.md §1 E2E list, D-009/D-012).
 *
 * Synthetic committed CSV fixture whose "CampoLibre1" column has no header or
 * content evidence, so the canonical classifier proposes `unknown`. Covered
 * contracts:
 *  - Unknown is surfaced as "Review required" and the structured export gate
 *    stays CLOSED (fail-closed; Unknown is never KEEP);
 *  - the ONLY way out is an explicit reviewer classification through the
 *    domain-backed override control — the test creates no second
 *    classification authority and asserts the gate fact after the override.
 */
import { expect, test } from "./harness/fixtures";

import fs from "node:fs";
import path from "node:path";

const CSV = path.resolve(__dirname, "fixtures/structured-unknown.csv");

test("a structured Unknown column keeps the export gate closed until explicitly classified", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByLabel("Seleccionar archivos (TXT, PDF, DOCX, CSV, XLS, XLSX)").setInputFiles(CSV);
  await page.getByRole("button", { name: "Crear trabajo" }).click();

  // Issue #84 removed the permanent internal job-kind chrome: the persistent
  // header fact is the job's own file identity, never a "Structured job"
  // label. The Unknown classification facts below remain the structured
  // surface's authority (handoff §B.3; reconcile ONLY this selector).
  await expect(page.locator("header")).toContainText("Trabajo: structured-unknown.csv");
  await expect(page.locator("header")).not.toContainText("Structured job");
  // The structured comparative Configure workspace IS the structured review
  // surface (issue #85): the four-field comparison table carries the facts.
  const summary = page.getByRole("status", { name: "Datos de la configuración estructurada" });
  await expect(summary).toContainText("Columnas: 3");
  await expect(summary).toContainText("Columnas que requieren revisión: 1");
  await expect(summary).toContainText("Exportación estructurada preparada: No");

  const table = page.getByRole("table", { name: "Lista de clasificación de columnas" });
  const freeRow = table.locator("tbody tr").filter({ hasText: "CampoLibre1" });
  await expect(freeRow).toContainText("Requiere revisión");
  await expect(freeRow).toContainText("Desconocido");
  // Secondary facts are grouped behind the inspector's disclosure. Select the
  // row and expand it explicitly so this asserts a reviewer can reveal the
  // fact, not merely that it exists in collapsed DOM content.
  await freeRow.getByRole("button", { name: "CampoLibre1" }).click();
  const inspector = page.getByRole("complementary", { name: "Inspector de columna" });
  await inspector.locator("summary").click();
  await expect(inspector).toContainText("Acción propuesta:Requiere revisión");

  // Fail-closed gate message: unknown is never kept or exported as-is.
  await expect(
    page.getByRole("alert", { name: "Motivos de bloqueo de la exportación estructurada" })
  ).toContainText("La salida estructurada está bloqueada mientras 1 columna requiere revisión.");

  // Explicit reviewer classification through the domain override control.
  await page.getByLabel("Clasificación del revisor para CampoLibre1").selectOption("insensitive");
  await expect(summary).toContainText("Columnas que requieren revisión: 0");
  await expect(summary).toContainText("Exportación estructurada preparada: Sí");
  await expect(page.getByRole("alert")).toHaveCount(0);
  await expect(freeRow).toContainText("No sensible");
  await expect(freeRow).toContainText("clasificación modificada");

  // Issue #85 §3.4: no free-text cells — no «Continuar a la revisión» detour
  // and no rendered no-op Review; the factual privacy check is the onward
  // destination from Configure.
  await expect(page.getByRole("button", { name: "Continuar a la revisión" })).toHaveCount(0);
  await page.getByRole("button", { name: "Comprobación de privacidad", exact: true }).click();
  await expect(page.getByRole("status", { name: "Datos de la salida estructurada" })).toContainText(
    "Columnas no compatibles: 0"
  );
  await page.getByRole("button", { name: "Ir al resultado" }).click();

  const safeDownloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "Descargar salida estructurada segura (.csv)" }).click();
  const safeDownload = await safeDownloadPromise;
  const safeCsv = fs.readFileSync((await safeDownload.path())!, "utf8");
  // Nombre (identifier) is removed; Diagnostico (sensitive) is kept.
  expect(safeCsv.split("\n")[0]).toBe("CampoLibre1,Diagnostico");
  expect(safeCsv).not.toContain("Ana");
  expect(safeCsv).not.toContain("Luis");
  // D-021: Sensitive defaults to Keep, so the kept clinical attribute stays
  // in Safe output verbatim; identity never does.
  expect(safeCsv).toContain("Gripe A");
  expect(safeCsv).toContain("Fractura");

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
  // The removed identifier carries correspondence; the kept diagnosis does
  // not (kept columns have no correspondence).
  expect(audit).toContain("Ana");
  expect(audit).not.toContain("Gripe A");
});
