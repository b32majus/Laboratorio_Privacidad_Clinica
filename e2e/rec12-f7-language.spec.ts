/**
 * REC-12 F7 — direct language-and-accessibility contract on the rendered V4 build.
 * The same real business journeys are reused from the established E2E harness:
 * no mock state, no browser text substitution, no outbound network and no real PHI.
 * This is one *representative* seven-surface witness, not a universal translation claim.
 */
import path from "node:path";

import { expect, test } from "./harness/fixtures";
import {
  completeReview,
  createBatchJob,
  createStructuredJob,
  gotoReviewWithDetections,
} from "./harness/flows";

test("professional Spanish: entrada, revisión pendiente, comprobación y resultado preparado", async ({
  page,
}) => {
  await page.goto("/");
  await expect(page.locator("html")).toHaveAttribute("lang", "es");
  await expect(page.getByRole("heading", { name: "¿Qué vamos a revisar?" })).toBeVisible();

  await gotoReviewWithDetections(page);
  await expect(page.getByRole("region", { name: "Espacio de revisión" })).toBeVisible();
  await expect(page.getByRole("list", { name: "Hallazgos" }).getByRole("button")).toHaveCount(4);
  await expect(page.getByRole("complementary", { name: "Inspector del hallazgo" })).toBeVisible();

  await page.getByRole("button", { name: "Comprobación de privacidad" }).click();
  const checkpoint = page.getByRole("region", { name: "Punto de control de la decisión" });
  await expect(checkpoint).toContainText("Necesita atención");
  await expect(checkpoint).toContainText(
    "Quedan 4 decisiones de revisión obligatorias pendientes."
  );
  await expect(checkpoint).not.toContainText("antes de que confíe");
  await expect(page.getByRole("alert")).toContainText(
    "La descarga segura está bloqueada mientras 4 decisiones de revisión obligatorias están pendientes."
  );
  await page.getByRole("button", { name: "Volver a la revisión" }).click();
  await completeReview(page);
  await page.getByRole("button", { name: "Comprobación de privacidad" }).click();
  await expect(checkpoint).toContainText("Preparado");
  await page.getByRole("button", { name: "Ir al resultado" }).click();
  await expect(page.getByRole("heading", { level: 2, name: "Resultado" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Listo para usar" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Descargar como TXT (.txt)" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Auditoría confidencial" })).toBeVisible();
});

test("professional Spanish: lote conserva avisos, orientación y el imperativo Revisa", async ({
  page,
}) => {
  const files = ["batch-doc-1.txt", "batch-doc-2.txt"].map((name) =>
    path.resolve(__dirname, "fixtures", name)
  );
  await createBatchJob(page, files);
  await expect(page.locator("html")).toHaveAttribute("lang", "es");
  await expect(page.getByRole("list", { name: "Estado de los documentos del lote" })).toBeVisible();
  await expect(page.getByText(/^Revisa cada documento del lote por separado\./)).toBeVisible();
  await expect(page.getByText(/^Revise cada documento del lote por separado\./)).toHaveCount(0);
  await expect(page.getByRole("group", { name: "Filtrar documentos del lote" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Comprobación de privacidad" })).toBeVisible();
});

test("professional Spanish: estructurado y celdas presentan decisiones y bloqueos", async ({
  page,
}) => {
  const csv = path.resolve(__dirname, "fixtures", "structured-composed.csv");
  await createStructuredJob(page, csv);
  await expect(page.locator("html")).toHaveAttribute("lang", "es");
  await expect(page.getByRole("heading", { name: "Preparar datos estructurados" })).toBeVisible();
  await expect(
    page.getByRole("table", { name: "Lista de clasificación de columnas" })
  ).toBeVisible();
  await expect(
    page.getByRole("alert", { name: "Motivos de bloqueo de la exportación estructurada" })
  ).toBeVisible();

  const row = (header: string) =>
    page
      .getByRole("table", { name: "Lista de clasificación de columnas" })
      .locator("tbody tr")
      .filter({ has: page.getByRole("button", { name: header }) });
  await page.getByLabel("Columna de identificación del paciente").selectOption("NHC");
  await row("Fecha_Visita").getByRole("button", { name: "Fecha_Visita" }).click();
  await page.getByLabel("Rol de fecha para Fecha_Visita").selectOption("visit");
  await row("Fecha_Nacimiento").getByRole("button", { name: "Fecha_Nacimiento" }).click();
  await page.getByLabel("Rol de fecha para Fecha_Nacimiento").selectOption("birth");
  await row("Notas").getByRole("button", { name: "Notas" }).click();
  await page.getByLabel("Acción del revisor para Notas").selectOption("process-as-text");
  await page.getByRole("button", { name: "Continuar a la revisión" }).click();
  await expect(page.getByRole("button", { name: "Procesar celdas de texto libre" })).toBeVisible();
  await expect(
    page.getByRole("alert", { name: "Bloqueos de la revisión estructurada" })
  ).toContainText("salida estructurada está bloqueada");
});
