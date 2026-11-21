/**
 * REC-12 F9: Spanish PROFESSIONAL error, blocked and confidential states.
 * New language witness, not a replacement for the existing domain/format suites.
 * Uses original V4 flows and synthetic files, no external network.
 */
import path from "node:path";
import { expect, test } from "./harness/fixtures";
import {
  createBatchJob,
  createStructuredJob,
  gotoExportComplete,
  selectFiles,
} from "./harness/flows";

const CORRUPT = path.resolve(__dirname, "../app-v4/src/input/fixtures/corrupt.pdf");
const DOC_1 = path.resolve(__dirname, "fixtures/batch-doc-1.txt");
const DOC_2 = path.resolve(__dirname, "fixtures/batch-doc-2.txt");
const STRUCTURED_UNKNOWN = path.resolve(__dirname, "fixtures/structured-unknown.csv");

test("Entrada: un formato inválido explica el rechazo en español y no crea trabajo", async ({
  page,
}) => {
  await page.goto("/");
  await expect(page.locator("html")).toHaveAttribute("lang", "es");
  await selectFiles(page, {
    name: "archivo-f9-sintetico.exe",
    mimeType: "application/octet-stream",
    buffer: Buffer.from("archivo sintético no compatible"),
  });
  await page.getByRole("button", { name: "Crear trabajo" }).click();
  const refusal = page.getByRole("alert").filter({ hasText: /No se admite/ });
  await expect(refusal).toContainText(/el formato ".exe"/);
  await expect(refusal).toContainText(
    "Convierte el archivo a un formato admitido e inténtalo de nuevo."
  );
  await expect(refusal).not.toContainText(/Convierta|inténtelo/);
  await expect(page.getByRole("banner")).toContainText("Aún no hay trabajo");
  await expect(page.getByRole("button", { name: "Comprobación de privacidad" })).toHaveCount(0);
});

test("Lote: PDF ilegible mantiene fallo y solución reales en español, sin descarga Safe", async ({
  page,
}) => {
  await createBatchJob(page, [DOC_1, CORRUPT, DOC_2]);
  const queue = page.getByRole("list", { name: "Estado de los documentos del lote" });
  await expect(queue).toContainText("corrupt.pdf");
  await expect(queue).toContainText("Error");
  await expect(page.getByRole("button", { name: "Reconocer error" })).toBeVisible();
  await page.getByRole("button", { name: "Comprobación de privacidad" }).click();
  const checkpoint = page.getByRole("region", { name: "Punto de control de la decisión" });
  await expect(checkpoint).toContainText("Necesita atención");
  const error = page
    .getByRole("alert")
    .filter({ hasText: /corrupt\.pdf/ })
    .first();
  await expect(error).toContainText("Crea un nuevo trabajo sin él para continuar.");
  await expect(error).not.toContainText("Cree un nuevo trabajo");
  await page.getByRole("button", { name: "Ir al resultado" }).click();
  await expect(page.getByRole("heading", { name: "Bloqueado" })).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Descargar resumen seguro (.csv)" })
  ).toBeDisabled();
});

test("Estructurado: desconocida conserva bloqueo y pide corregir la clasificación en español", async ({
  page,
}) => {
  await createStructuredJob(page, STRUCTURED_UNKNOWN);
  const block = page.getByRole("alert", {
    name: "Motivos de bloqueo de la exportación estructurada",
  });
  await expect(block).toContainText(
    "La salida estructurada está bloqueada mientras 1 columna requiere revisión."
  );
  await page
    .getByRole("table", { name: "Lista de clasificación de columnas" })
    .locator("tbody tr")
    .filter({ hasText: "CampoLibre1" })
    .getByRole("button", { name: "CampoLibre1" })
    .click();
  const inspector = page.getByRole("complementary", { name: "Inspector de columna" });
  await expect(inspector).toContainText("Cambia la clasificación de arriba");
  await expect(inspector).not.toContainText("Cambie la clasificación");
  await expect(
    page.getByRole("status", { name: "Datos de la configuración estructurada" })
  ).toContainText("Exportación estructurada preparada: No");
  await expect(
    page.getByRole("button", { name: "Descargar salida estructurada segura (.csv)" })
  ).toHaveCount(0);
});

test("Resultado: Safe y Confidencial son accesibles, y cancelar no descarga nada", async ({
  page,
}) => {
  await gotoExportComplete(page);
  await expect(page.locator("[data-result-state]")).toHaveAttribute("data-result-state", "ready");
  await expect(page.getByRole("button", { name: "Copiar texto preparado" })).toBeEnabled();
  await expect(page.getByRole("button", { name: "Descargar como TXT (.txt)" })).toBeEnabled();
  await expect(
    page.getByRole("button", { name: "Descargar documento preparado (.docx)" })
  ).toBeEnabled();
  await expect(page.getByRole("button", { name: "Descargar como PDF (.pdf)" })).toBeEnabled();
  const confidential = page.getByRole("region", { name: "Auditoría confidencial" });
  await expect(confidential).toContainText("Confidencial — artefacto interno de auditoría");
  const events: string[] = [];
  page.on("download", (download) => {
    events.push(download.suggestedFilename());
  });
  await page.getByRole("button", { name: "Descargar auditoría confidencial (.txt)" }).click();
  const confirmation = page.getByRole("group", { name: "Confirmación de descarga confidencial" });
  await expect(confirmation).toBeVisible();
  await expect(confirmation).toContainText("confidencial");
  await page.getByRole("button", { name: "Cancelar descarga confidencial" }).click();
  await expect(confirmation).toHaveCount(0);
  await expect.poll(() => events.length).toBe(0);
  await page.getByRole("button", { name: "Descargar auditoría confidencial (.txt)" }).click();
  const [audit] = await Promise.all([
    page.waitForEvent("download"),
    page.getByRole("button", { name: "Confirmar descarga confidencial" }).click(),
  ]);
  expect(audit.suggestedFilename()).toBe("auditoria-confidencial.txt");
  await expect(page.locator("[data-result-state]")).toHaveAttribute("data-result-state", "ready");
});
