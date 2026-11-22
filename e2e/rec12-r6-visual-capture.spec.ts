/**
 * R6 real V4 production build screenshot witness. Only deterministic synthetic
 * 32-column input, no patient data or external network. Never touches R3 sources.
 */
import fs from "node:fs";
import path from "node:path";
import { expect, test } from "./harness/fixtures";
import { selectFiles } from "./harness/flows";

const OUT = path.resolve("docs/evidence/issue92-r6-react-20261122/actual");
fs.mkdirSync(OUT, { recursive: true });
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
for (const width of [375, 320, 1440]) {
  test(`R6 product capture ${width}px — 32 synthetic columns real domain`, async ({ page }) => {
    const height = width === 375 ? 800 : width === 320 ? 760 : 900;
    await page.setViewportSize({ width, height });
    await page.goto("/");
    const row = HEADERS.map((header, i) => {
      if (header === "NHC") return "SINT-F3-001";
      if (header === "DNI") return "12345678A";
      if (header === "Fecha_Visita") return "2023-01-10";
      if (header === "Fecha_Nacimiento") return "1970-03-12";
      if (header === "Notas") return "Seguimiento sintetico";
      return i % 3 === 0 ? "Prueba" : "Valor";
    });
    await selectFiles(page, {
      name: "f3-32-columnas.csv",
      mimeType: "text/csv",
      buffer: Buffer.from([HEADERS.join(","), row.join(","), ""].join("\n")),
    });
    await page.getByRole("button", { name: "Crear trabajo" }).click();
    const stats = page.getByRole("status", { name: "Datos de la configuración estructurada" });
    await expect(stats).toContainText("Columnas: 32");
    await expect(stats).toContainText("Columnas que requieren revisión: 19");
    await expect(
      page.getByRole("table", { name: "Lista de clasificación de columnas" }).locator("tbody tr")
    ).toHaveCount(32);
    await expect(page.getByLabel("Columna de identificación del paciente")).toHaveValue("");
    await page.evaluate(async () => {
      await document.fonts.ready;
      scrollTo({ top: 0, left: 0, behavior: "instant" });
    });
    await expect.poll(() => page.evaluate(() => scrollY)).toBe(0);
    const metrics = await page.evaluate(() => {
      const zone = (sel: string) => {
        const el = document.querySelector(sel);
        const r = el?.getBoundingClientRect();
        return r ? { x: r.x, y: r.y, width: r.width, height: r.height } : null;
      };
      return {
        innerWidth,
        scrollWidth: document.documentElement.scrollWidth,
        inspector: zone(".sx-structured-inspector"),
        classification: zone(".sx-structured-inspector select[id^='structured-class-']"),
        summary: zone(".sx-structured-summary"),
        patient: zone(".sx-structured-patient"),
        table: zone(".sx-structured-table"),
        intro: zone(".sx-structured-intro-compact"),
        workspace: zone(".sx-structured-workspace"),
        selected: document.querySelector(".sx-structured-inspector h3")?.textContent ?? null,
        pendingTableRows: document.querySelectorAll(".sx-structured-table tbody tr").length,
      };
    });
    expect(metrics.scrollWidth).toBeLessThanOrEqual(width);
    expect(metrics.pendingTableRows).toBe(32);
    if (width < 1024) {
      expect(metrics.inspector?.y ?? 9999).toBeLessThan(660);
      expect(metrics.classification?.y ?? 9999).toBeLessThan(height);
    } else {
      expect(metrics.table?.x ?? 10000).toBeLessThan(metrics.inspector?.x ?? 0);
      expect(Math.abs((metrics.table?.y ?? 10000) - (metrics.inspector?.y ?? 0))).toBeLessThan(25);
    }
    await page.screenshot({
      path: path.join(OUT, `structured-${width}-viewport.png`),
      animations: "disabled",
    });
    await page.screenshot({
      path: path.join(OUT, `structured-${width}-full.png`),
      fullPage: true,
      animations: "disabled",
    });
    fs.writeFileSync(path.join(OUT, `metrics-${width}.json`), JSON.stringify(metrics, null, 2));
  });
}

test("R6 mobile block reasons remain keyboard-scrollable and all canonical reasons readable", async ({
  page,
}) => {
  await page.setViewportSize({ width: 375, height: 800 });
  await page.goto("/");
  const row = HEADERS.map((header, i) => {
    if (header === "NHC") return "SINT-F3-001";
    if (header === "DNI") return "12345678A";
    if (header === "Fecha_Visita") return "2023-01-10";
    if (header === "Fecha_Nacimiento") return "1970-03-12";
    if (header === "Notas") return "Seguimiento sintetico";
    return i % 3 === 0 ? "Prueba" : "Valor";
  });
  await selectFiles(page, {
    name: "f3-32-columnas.csv",
    mimeType: "text/csv",
    buffer: Buffer.from([HEADERS.join(","), row.join(","), ""].join("\n")),
  });
  await page.getByRole("button", { name: "Crear trabajo" }).click();
  const reasons = page.getByRole("alert", {
    name: "Motivos de bloqueo de la exportación estructurada",
  });
  await expect(reasons).toBeVisible();
  await expect(reasons).toContainText("Fecha_Visita");
  await expect(reasons).toContainText("Fecha_Nacimiento");
  const sizes = await reasons.evaluate((el) => ({
    scrollHeight: el.scrollHeight,
    clientHeight: el.clientHeight,
  }));
  expect(sizes.scrollHeight).toBeGreaterThan(sizes.clientHeight);
  await reasons.focus();
  await expect(reasons).toBeFocused();
  await reasons.press("End");
  await expect.poll(() => reasons.evaluate((el) => el.scrollTop)).toBeGreaterThan(0);
});
