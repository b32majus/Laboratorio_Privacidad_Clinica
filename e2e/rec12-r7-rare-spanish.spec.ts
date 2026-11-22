/**
 * REC-12 R7: two additional falsifiers of H-01/PDR-08.
 * Production V4, synthetic only. Confirm that rare, actionable failures and
 * structured result guidance consistently use Spanish informal second person.
 * This supplements F7/F9; it does not certify universal localization.
 */
import { expect, test } from "./harness/fixtures";
import { selectFiles } from "./harness/flows";

test("R7 clipboard permission refusal gives Pega Ctrl+V, never formal Pegue; no Job", async ({
  page,
}) => {
  await page.goto("/");
  await expect(page.locator("html")).toHaveAttribute("lang", "es");
  await page.getByRole("button", { name: "Pegar desde el portapapeles" }).click();
  const error = page.getByRole("alert").filter({ hasText: /portapapeles/ });
  await expect(error).toContainText("Pega con Ctrl+V directamente en el campo de texto.");
  await expect(error).not.toContainText("Pegue con Ctrl+V");
  await expect(page.getByRole("banner")).toContainText("Aún no hay trabajo");
  await expect(page.getByRole("textbox", { name: "Pegar texto" })).toHaveValue("");
});

test("R7 structured Safe/Confidential destination guidance uses Descarga and keeps two outputs separate", async ({
  page,
}) => {
  await page.goto("/");
  await selectFiles(page, {
    name: "r7-sintetico.csv",
    mimeType: "text/csv",
    buffer: Buffer.from("NHC,Diagnostico\nSINT-R7-001,Valor sintético\n"),
  });
  await page.getByRole("button", { name: "Crear trabajo" }).click();
  await expect(
    page.getByRole("status", { name: "Datos de la configuración estructurada" })
  ).toContainText("Columnas: 2");
  await page.getByLabel("Columna de identificación del paciente").selectOption("NHC");
  await expect(
    page.getByRole("status", { name: "Datos de la configuración estructurada" })
  ).toContainText("Exportación estructurada preparada: Sí");
  await page.getByRole("button", { name: "Comprobación de privacidad", exact: true }).click();
  await expect(page.getByRole("region", { name: "Punto de control de la decisión" })).toContainText(
    "Preparado"
  );
  await page.getByRole("button", { name: "Ir al resultado" }).click();
  const result = page.locator(".sx-result-workspace");
  await expect(result).toBeVisible();
  await expect(result).toContainText("Descarga solo el que su destino esté autorizado a recibir.");
  await expect(result).not.toContainText("Descargue solo el que");
  await expect(result.getByRole("heading", { name: "Salida estructurada segura" })).toBeVisible();
  await expect(result.getByRole("heading", { name: "Auditoría confidencial" })).toBeVisible();
});
