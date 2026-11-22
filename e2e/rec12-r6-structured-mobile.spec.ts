/**
 * REC12 #92 R6 RED user-approved visual contract on REAL production V4:
 * mobile decision-first 32-column synthetic CSV, one domain authority,
 * no false readiness, desktop invariant, keyboard selection.
 *
 * This file is authored/frozen by designer Cora BEFORE implementation.
 * Product implementer is prohibited from changing it.
 */
import { expect, test } from "./harness/fixtures";
import { selectFiles } from "./harness/flows";
import type { Page } from "@playwright/test";

const HEADERS = [
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

async function create32ColumnJob(page: Page): Promise<void> {
  const row = HEADERS.map((header, i) => {
    if (header === "NHC") return "SINT-F3-001";
    if (header === "DNI") return "12345678A";
    if (header === "Fecha_Visita") return "2023-01-10";
    if (header === "Fecha_Nacimiento") return "1970-03-12";
    if (header === "Notas") return "Seguimiento sintetico";
    return i % 3 === 0 ? "Prueba" : "Valor";
  });
  await page.goto("/");
  await selectFiles(page, {
    name: "f3-32-columnas.csv",
    mimeType: "text/csv",
    buffer: Buffer.from([HEADERS.join(","), row.join(","), ""].join("\n")),
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
}

async function measurements(page: Page) {
  return page.evaluate(() => {
    function rect(s: string) {
      const el = document.querySelector(s);
      if (!el) throw Error("Missing real R6 zone " + s);
      const r = el.getBoundingClientRect();
      return { x: r.x, y: r.y, width: r.width, height: r.height };
    }
    return {
      scrollWidth: document.documentElement.scrollWidth,
      width: window.innerWidth,
      inspector: rect(".sx-structured-inspector"),
      classSelect: rect(".sx-structured-inspector select[id^='structured-class-']"),
      table: rect(".sx-structured-table"),
      patient: rect('[aria-label="Autoridad de identificación del paciente"]'),
      summary: rect('[aria-label="Resumen de la configuración estructurada"]'),
    };
  });
}

for (const width of [375, 320]) {
  test(`R6 approved mobile ${width}px: real active decision above patient-ID and 32-row comparison`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: width === 375 ? 800 : 760 });
    await create32ColumnJob(page);
    const geo = await measurements(page);
    expect(geo.scrollWidth).toBeLessThanOrEqual(width);
    expect(geo.inspector.y).toBeLessThan(width === 375 ? 600 : 660);
    expect(geo.classSelect.y).toBeLessThan(width === 375 ? 800 : 760);
    expect(geo.summary.y).toBeLessThan(geo.inspector.y);
    expect(geo.inspector.y).toBeLessThan(geo.patient.y);
    expect(geo.patient.y).toBeLessThan(geo.table.y);
    await expect(
      page.getByRole("alert", { name: "Motivos de bloqueo de la exportación estructurada" })
    ).toBeVisible();
    await expect(page.getByLabel("Columna de identificación del paciente")).toHaveValue("");
    await expect(page.getByRole("complementary", { name: "Inspector de columna" })).toContainText(
      "Fecha_Visita"
    );
    await expect(page.getByLabel("Clasificación del revisor para Fecha_Visita")).toHaveValue(
      "quasi-identifier"
    );
    await expect(
      page.getByRole("table", { name: "Lista de clasificación de columnas" }).locator("thead th")
    ).toHaveCount(4);
    await expect(
      page.getByRole("region", {
        name: "Tabla comparativa de columnas (desplazable en pantallas estrechas)",
      })
    ).toBeVisible();
    await expect(
      page.getByRole("status", { name: "Datos de la configuración estructurada" })
    ).toContainText("Exportación estructurada preparada: No");
    expect(await page.locator("#patient-id-column").count()).toBe(1);
  });
}

test("R6 375px: selecting/finding next pending changes context, never auto-accepts a class", async ({
  page,
}) => {
  await page.setViewportSize({ width: 375, height: 800 });
  await create32ColumnJob(page);
  const table = page.getByRole("table", { name: "Lista de clasificación de columnas" });
  // An extra navigation filter is presentation only, NOT a second domain state.
  const pendingFilter = page.getByRole("button", { name: "Pendientes (19)", exact: true });
  await pendingFilter.click();
  await expect(table.locator("tbody tr")).toHaveCount(19);
  await page.getByRole("button", { name: "Todas (32)", exact: true }).click();
  await expect(table.locator("tbody tr")).toHaveCount(32);
  await table.getByRole("button", { name: "Notas", exact: true }).click();
  await expect(page.getByRole("complementary", { name: "Inspector de columna" })).toContainText(
    "Notas"
  );
  await expect(page.getByLabel("Clasificación del revisor para Notas")).toHaveValue("unknown");
  await expect(
    page.getByRole("status", { name: "Datos de la configuración estructurada" })
  ).toContainText("Columnas que requieren revisión: 19");
  await expect(
    page.getByRole("status", { name: "Datos de la configuración estructurada" })
  ).toContainText("Exportación estructurada preparada: No");
  // A pending column must reach another pending one without accepting anything.
  await page.getByRole("button", { name: "Ir a la siguiente columna pendiente" }).click();
  await expect(page.getByRole("complementary", { name: "Inspector de columna" })).not.toContainText(
    "Notas"
  );
  await expect(
    page.getByRole("status", { name: "Datos de la configuración estructurada" })
  ).toContainText("Columnas que requieren revisión: 19");
  // The column heading becomes the keyboard focus target after navigation.
  await expect(page.locator(".sx-structured-inspector h3")).toBeFocused();
});

test("R6 desktop 1440px retains comparative table at left and inspector at right", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await create32ColumnJob(page);
  const geo = await measurements(page);
  expect(geo.scrollWidth).toBeLessThanOrEqual(1440);
  expect(geo.table.x).toBeLessThan(geo.inspector.x);
  expect(Math.abs(geo.table.y - geo.inspector.y)).toBeLessThan(25);
  expect(geo.patient.y).toBeLessThan(geo.table.y);
  await expect(
    page.getByRole("table", { name: "Lista de clasificación de columnas" }).locator("tbody tr")
  ).toHaveCount(32);
  await expect(page.getByLabel("Columna de identificación del paciente")).toHaveValue("");
});
