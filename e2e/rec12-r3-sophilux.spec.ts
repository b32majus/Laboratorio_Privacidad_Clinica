/**
 * REC12 #92 R3: user-approved Sophilux B V1 hierarchy implemented in REAL V4.
 * RED design contract: 24 synthetic detections, real processed cells, canonical
 * Safe text (including deliberately kept originals); no generated demo states.
 */
import path from "node:path";
import { expect, test } from "./harness/fixtures";
import {
  REVIEW_DNI,
  REVIEW_EMAIL,
  buildHighVolumeText,
  completeReview,
  createStructuredJob,
  gotoReviewWithDetections,
} from "./harness/flows";

const structured = path.resolve("e2e/fixtures/structured-composed.csv");

async function geometry(page: import("@playwright/test").Page, selectors: string[]) {
  return page.evaluate((items) => {
    const position = (s: string) => {
      const el = document.querySelector(s);
      if (!el) throw Error("Missing compositional zone " + s);
      const b = el.getBoundingClientRect();
      return { x: b.x, y: b.y, width: b.width, height: b.height };
    };
    return {
      zones: items.map(position),
      noOverflow: document.documentElement.scrollWidth <= window.innerWidth,
    };
  }, selectors);
}

test("R3 Revisión at 1440: 24 real findings, document and decisions co-visible", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/");
  await page.getByRole("textbox", { name: "Pegar texto" }).fill(buildHighVolumeText());
  await page.getByRole("button", { name: "Crear trabajo" }).click();
  const workspace = page.getByRole("region", { name: "Espacio de revisión" });
  await expect(workspace.getByRole("list", { name: "Hallazgos" }).getByRole("button")).toHaveCount(
    24
  );
  await expect(workspace.locator(".sx-r3-review-tools")).toBeVisible();
  await expect(workspace.locator(".sx-r3-findings-first")).toBeVisible();
  const measured = await geometry(page, [
    ".sx-review-task .sx-review-document",
    ".sx-review-task .sx-r3-findings-first",
    ".sx-review-task .sx-review-inspector",
  ]);
  expect(measured.noOverflow).toBe(true);
  expect(measured.zones[0].x).toBeLessThan(measured.zones[1].x);
  expect(measured.zones[1].x).toBeLessThan(measured.zones[2].x);
  for (const zone of measured.zones) expect(zone.y).toBeLessThan(800);
  await workspace
    .getByRole("group", { name: "Filtrar por estado" })
    .getByRole("button", { name: "Pendientes" })
    .click();
  await expect(workspace.getByRole("list", { name: "Hallazgos" }).getByRole("button")).toHaveCount(
    24
  );
});

test("R3 Revisión at 375: inspector first, filters remain operable", async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 800 });
  await gotoReviewWithDetections(page);
  const workspace = page.getByRole("region", { name: "Espacio de revisión" });
  await expect(workspace.locator(".sx-r3-review-tools")).toBeVisible();
  const measured = await geometry(page, [
    ".sx-review-task .sx-review-inspector",
    ".sx-review-task .sx-review-document",
  ]);
  expect(measured.noOverflow).toBe(true);
  expect(measured.zones[0].y).toBeLessThan(measured.zones[1].y);
  expect(measured.zones[0].y).toBeLessThan(800);
  await expect(workspace.getByRole("group", { name: "Filtrar por estado" })).toBeVisible();
});

for (const width of [1440, 375]) {
  test(`R3 Celdas ${width}: active cell and decisions before long explanation`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: width === 375 ? 800 : 900 });
    await createStructuredJob(page, structured);
    await expect(
      page.getByRole("status", { name: "Datos de la configuración estructurada" })
    ).toContainText("Columnas: 7");
    await page.getByLabel("Columna de identificación del paciente").selectOption("NHC");
    const table = page.getByRole("table", { name: "Lista de clasificación de columnas" });
    async function selectColumn(name: string) {
      await table
        .locator("tbody tr")
        .filter({ has: page.getByRole("button", { name }) })
        .getByRole("button", { name })
        .click();
    }
    await selectColumn("Fecha_Visita");
    await page.getByLabel("Rol de fecha para Fecha_Visita").selectOption("visit");
    await selectColumn("Fecha_Nacimiento");
    await page.getByLabel("Rol de fecha para Fecha_Nacimiento").selectOption("birth");
    await selectColumn("Notas");
    await page.getByLabel("Acción del revisor para Notas").selectOption("process-as-text");
    await page.getByRole("button", { name: "Continuar a la revisión" }).click();
    await page.getByRole("button", { name: "Procesar celdas de texto libre" }).click();
    await expect(
      page.getByRole("status", { name: "Progreso de la revisión de texto libre" })
    ).toContainText("Celdas: 2");
    await page.getByRole("button", { name: /Notas, fila 1/ }).click();
    await expect(page.locator(".sx-r3-cells-compact")).toBeVisible();
    const measured = await geometry(page, [
      ".sx-cells-task .sx-cells-queue",
      ".sx-cells-task .sx-review-document",
      ".sx-cells-task .sx-review-inspector",
    ]);
    expect(measured.noOverflow).toBe(true);
    if (width === 1440) {
      expect(measured.zones[0].x).toBeLessThan(measured.zones[1].x);
      expect(measured.zones[1].x).toBeLessThan(measured.zones[2].x);
      for (const zone of measured.zones) expect(zone.y).toBeLessThan(800);
    } else {
      expect(measured.zones[2].y).toBeLessThan(measured.zones[1].y);
      expect(measured.zones[2].y).toBeLessThan(800);
    }
  });
}

for (const width of [1440, 375]) {
  test(`R3 Resultado ${width}: ONLY canonical Safe preview when ready, Keep warning and separated Confidential`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: width === 375 ? 800 : 900 });
    await gotoReviewWithDetections(page);
    await completeReview(page);
    await page.getByRole("button", { name: "Ver resultado" }).click();
    const result = page.locator(".sx-result-workspace");
    await expect(result).toHaveAttribute("data-result-state", "ready");
    const preview = result.getByRole("region", { name: "Vista previa de salida Safe" });
    await expect(preview).toBeVisible();
    await expect(preview).toContainText(REVIEW_EMAIL);
    await expect(preview).toContainText("[DNI-REVISADO]");
    await expect(preview).not.toContainText(REVIEW_DNI);
    await expect(
      result.getByRole("heading", { name: "Originales conservados deliberadamente" })
    ).toBeVisible();
    await expect(result.getByRole("heading", { name: "Auditoría confidencial" })).toBeVisible();
    await expect(result.locator(".sx-r3-result-hero")).toBeVisible();
    const measured = await geometry(page, [
      ".sx-r3-result-hero",
      "#result-kept-originals-heading",
      "[data-variant='primary']",
    ]);
    expect(measured.noOverflow).toBe(true);
    if (width === 375) {
      expect(measured.zones[1].y).toBeLessThan(800);
      expect(measured.zones[2].y).toBeLessThan(800);
    }
  });
}

test("R3 Resultado needing attention never places any Safe payload preview in DOM", async ({
  page,
}) => {
  await page.setViewportSize({ width: 375, height: 800 });
  await gotoReviewWithDetections(page);
  await completeReview(page);
  await page.getByRole("button", { name: "Ver resultado" }).click();
  await expect(page.locator("[data-result-state]")).toHaveAttribute("data-result-state", "ready");
  await page.getByRole("button", { name: "Volver a la revisión" }).click();
  const source = page.getByRole("group", { name: "Texto del documento con hallazgos" });
  const mark = page.getByRole("button", { name: "Marcar dato no detectado" });
  await mark.focus();
  await source.evaluate((group) => {
    const anchor = group.querySelector('[data-source-start="0"]');
    if (!anchor?.firstChild) throw Error("Missing source segment");
    const range = document.createRange();
    range.setStart(anchor.firstChild, 0);
    range.setEnd(anchor.firstChild, 5);
    const selection = window.getSelection()!;
    selection.removeAllRanges();
    selection.addRange(range);
  });
  await mark.press("Enter");
  await page.getByLabel("Tipo de dato").fill("PRUEBA");
  await page.getByRole("button", { name: "Añadir dato marcado" }).click();
  await expect(page.getByRole("status", { name: "Progreso de la revisión" })).toContainText(
    "Pendientes: 1"
  );
  await page.getByRole("button", { name: "Ver resultado" }).click();
  const result = page.locator(".sx-result-workspace");
  await expect(result).toHaveAttribute("data-result-state", "needs-attention");
  await expect(result.locator(".sx-r3-safe-preview")).toHaveCount(0);
  await expect(result.locator('[data-variant="primary"]')).toBeDisabled();
  await expect(
    result.getByRole("heading", { name: "Originales conservados deliberadamente" })
  ).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(375);
});
