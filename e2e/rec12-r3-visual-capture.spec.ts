/**
 * REC-12 R3 real-product visual evidence, independent capture.
 * Uses only synthetic fixtures and existing UI routes. Never patches runtime,
 * bypasses privacy gates, or changes product state outside its browser context.
 * Screenshots are evidence for human comparison, not automatic visual PASS.
 */
import fs from "node:fs";
import path from "node:path";
import type { Page } from "@playwright/test";
import { expect, test } from "./harness/fixtures";
import {
  buildHighVolumeText,
  createStructuredJob,
  completeReview,
  gotoReviewWithDetections,
  selectFiles,
} from "./harness/flows";

const OUT = path.resolve("docs/evidence/issue92-r3-react-20261122/actual");
const STRUCTURED = path.resolve("e2e/fixtures/structured-composed.csv");
fs.mkdirSync(OUT, { recursive: true });

type Metrics = {
  width: number;
  innerWidth: number;
  scrollWidth: number;
  scrollY: number;
  zones: Record<string, { x: number; y: number; width: number; height: number } | null>;
};

async function capture(page: Page, key: string, width: number): Promise<Metrics> {
  await page.evaluate(async () => {
    await document.fonts.ready;
    window.scrollTo({ top: 0, left: 0, behavior: "instant" });
  });
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBe(0);
  const metrics = await page.evaluate(() => {
    const zones: Metrics["zones"] = {};
    for (const name of [
      ".sx-review-document",
      ".sx-review-findings",
      ".sx-review-inspector",
      ".sx-batch-queue",
      ".sx-batch-current",
      ".sx-structured-table",
      ".sx-structured-inspector",
      ".sx-cells-queue",
      ".sx-cells-current",
    ]) {
      const el = document.querySelector(name);
      const rect = el?.getBoundingClientRect();
      zones[name] = rect ? { x: rect.x, y: rect.y, width: rect.width, height: rect.height } : null;
    }
    return {
      width: window.innerWidth,
      innerWidth: document.documentElement.clientWidth,
      scrollWidth: document.documentElement.scrollWidth,
      scrollY: window.scrollY,
      zones,
    };
  });
  expect(metrics.scrollWidth, `Global overflow at ${key} ${width}`).toBeLessThanOrEqual(width);
  await page.screenshot({
    path: path.join(OUT, `${key}-${width}-viewport.png`),
    animations: "disabled",
  });
  if (width === 375 || key === "revision" || key === "celdas") {
    await page.screenshot({
      path: path.join(OUT, `${key}-${width}-full.png`),
      fullPage: true,
      animations: "disabled",
    });
  }
  return metrics;
}

for (const width of [1440, 375]) {
  test(`R3 post-implementation visual verification: ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: width === 375 ? 800 : 900 });
    const metrics: Record<string, Metrics> = {};

    // Entrada: real empty state, not the seeded prototype.
    await page.goto("/");
    await expect(page.getByRole("heading", { name: "¿Qué vamos a revisar?" })).toBeVisible();
    await expect(page.getByRole("textbox", { name: "Pegar texto" })).toHaveValue("");
    metrics.entrada = await capture(page, "entrada", width);

    // Revisión: 24 real synthetic detections, inspector and source document.
    await page.getByRole("textbox", { name: "Pegar texto" }).fill(buildHighVolumeText());
    await page.getByRole("button", { name: "Crear trabajo" }).click();
    await expect(page.getByRole("list", { name: "Hallazgos" }).getByRole("button")).toHaveCount(24);
    await expect(page.getByRole("complementary", { name: "Inspector del hallazgo" })).toBeVisible();
    await expect(page.getByRole("status", { name: "Progreso de la revisión" })).toContainText(
      "Pendientes: 24"
    );
    metrics.revision = await capture(page, "revision", width);

    // Comprobación: factual pending state, not a demo readiness toggle.
    await page.getByRole("button", { name: "Comprobación de privacidad", exact: true }).click();
    await expect(
      page.getByRole("region", { name: "Punto de control de la decisión" })
    ).toBeVisible();
    await expect(
      page.getByRole("region", { name: "Punto de control de la decisión" })
    ).toContainText("24 decisiones");
    metrics.comprobacion = await capture(page, "comprobacion", width);

    // Resultado: true 4-detection job with explicit decisions and kept-original warning.
    await gotoReviewWithDetections(page);
    await completeReview(page);
    await page.getByRole("button", { name: "Comprobación de privacidad", exact: true }).click();
    await expect(
      page.getByRole("region", { name: "Punto de control de la decisión" })
    ).toContainText(/preparado/i);
    metrics.comprobacion_lista = await capture(page, "comprobacion-lista", width);
    await expect(page.getByRole("button", { name: "Ir al resultado" })).toBeEnabled();
    await page.getByRole("button", { name: "Ir al resultado" }).click();
    await expect(page.getByRole("heading", { name: "Resultado", exact: true })).toBeVisible();
    await expect(
      page.getByRole("heading", { name: "Originales conservados deliberadamente" })
    ).toBeVisible();
    await expect(page.getByText("Listo para usar")).toBeVisible();
    metrics.resultado = await capture(page, "resultado", width);

    // Lote: two successful synthetic files + genuine failed PDF parsing.
    await page.goto("/");
    await selectFiles(page, [
      {
        name: "f3-uno.txt",
        mimeType: "text/plain",
        buffer: Buffer.from("DNI 12345678A informe sintetico."),
      },
      {
        name: "f3-dos.txt",
        mimeType: "text/plain",
        buffer: Buffer.from("Telefono 600-123-456 y correo paciente1@example.com."),
      },
      {
        name: "corrupt.pdf",
        mimeType: "application/pdf",
        buffer: fs.readFileSync(path.resolve("app-v4/src/input/fixtures/corrupt.pdf")),
      },
    ]);
    await page.getByRole("button", { name: "Crear trabajo" }).click();
    await expect(
      page.getByRole("list", { name: "Estado de los documentos del lote" })
    ).toBeVisible();
    await expect(
      page.getByRole("list", { name: "Estado de los documentos del lote" }).getByRole("listitem")
    ).toHaveCount(3);
    await expect(
      page.getByRole("list", { name: "Estado de los documentos del lote" })
    ).toContainText("Error");
    await expect(page.getByRole("button", { name: "En curso (0)" })).toBeVisible();
    await expect(
      page.getByRole("list", { name: "Estado de los documentos del lote" })
    ).toContainText("f3-uno.txt — Requiere revisión");
    await expect(
      page.getByRole("list", { name: "Estado de los documentos del lote" })
    ).toContainText("f3-dos.txt — Requiere revisión");
    await expect(
      page.getByRole("list", { name: "Estado de los documentos del lote" })
    ).toContainText("corrupt.pdf — Error");
    metrics.lote = await capture(page, "lote", width);

    // Estructurado: genuine 32-column synthetic CSV (the reference density).
    const headers = [
      "NHC",
      "DNI",
      "Fecha_Visita",
      "Fecha_Nacimiento",
      "Centro",
      "Diagnostico",
      "Notas",
      "Telefono",
      "Email_Contacto",
      "Direccion",
      "Codigo_Postal",
      "Medico",
      "Tratamiento",
      "Medicacion",
      "Motivo_Consulta",
      "Edad",
      "Sexo",
      "Peso_Kg",
      "Talla_Cm",
      "Tension_Arterial",
      "Glucosa",
      "Alergias",
      "Dosis",
      "Servicio",
      "Planta",
      "Cama",
      "Fecha_Alta",
      "Motivo_Ingreso",
      "Observaciones_Libres",
      "ZZ_Campo_Libre_F3",
      "Codigo_Episodio",
      "Grupo_Sanguineo",
    ];
    const row = headers.map((h, i) => {
      if (h === "NHC") return "SINT-F3-001";
      if (h === "DNI") return "12345678A";
      if (h === "Fecha_Visita") return "2023-01-10";
      if (h === "Fecha_Nacimiento") return "1970-03-12";
      if (h === "Notas") return "Seguimiento sintetico";
      return i % 3 === 0 ? "Prueba" : "Valor";
    });
    await page.goto("/");
    await selectFiles(page, {
      name: "f3-32-columnas.csv",
      mimeType: "text/csv",
      buffer: Buffer.from([headers.join(","), row.join(","), ""].join(String.fromCharCode(10))),
    });
    await page.getByRole("button", { name: "Crear trabajo" }).click();
    await expect(
      page.getByRole("status", { name: "Datos de la configuración estructurada" })
    ).toContainText("Columnas: 32");
    await expect(
      page.getByRole("status", { name: "Datos de la configuración estructurada" })
    ).toContainText("Columnas que requieren revisión: 19");
    await expect(
      page.getByRole("table", { name: "Lista de clasificación de columnas" }).locator("tbody tr")
    ).toHaveCount(32);
    metrics.estructurado = await capture(page, "estructurado", width);

    // Celdas: real linked free-text review, not the unconditional demo state.
    await createStructuredJob(page, STRUCTURED);
    await expect(
      page.getByRole("status", { name: "Datos de la configuración estructurada" })
    ).toContainText("Columnas: 7");

    // Celdas: routed only via genuine process-as-text reviewer configuration.
    await page.getByLabel("Columna de identificación del paciente").selectOption("NHC");
    const table = page.getByRole("table", { name: "Lista de clasificación de columnas" });
    const choose = async (name: string) => {
      await table
        .locator("tbody tr")
        .filter({ has: page.getByRole("button", { name }) })
        .getByRole("button", { name })
        .click();
    };
    await choose("Fecha_Visita");
    await page.getByLabel("Rol de fecha para Fecha_Visita").selectOption("visit");
    await choose("Fecha_Nacimiento");
    await page.getByLabel("Rol de fecha para Fecha_Nacimiento").selectOption("birth");
    await choose("Notas");
    await page.getByLabel("Acción del revisor para Notas").selectOption("process-as-text");
    await page.getByRole("button", { name: "Continuar a la revisión" }).click();
    await page.getByRole("button", { name: "Procesar celdas de texto libre" }).click();
    await expect(
      page.getByRole("status", { name: "Progreso de la revisión de texto libre" })
    ).toContainText("Celdas: 2");
    await page.getByRole("button", { name: /Notas, fila 1/ }).click();
    await expect(
      page.getByRole("status", { name: "Progreso de la revisión de texto libre" })
    ).toContainText("Decisiones pendientes: 4");
    await expect(
      page.getByRole("status", { name: "Progreso de la revisión de texto libre" })
    ).toContainText("Celdas con error: 0");
    await expect(page.getByRole("heading", { name: /Revisando Notas, fila 1/ })).toBeVisible();
    metrics.celdas = await capture(page, "celdas", width);

    fs.writeFileSync(
      path.join(OUT, `metrics-${width}.json`),
      JSON.stringify(
        {
          baseSha: "R3_CANDIDATE_BEFORE_PUBLICATION",
          syntheticOnly: true,
          width,
          metrics,
        },
        null,
        2
      ) + "\n"
    );
  });
}
