/**
 * REC-12 R11 UX-012: real Chromium touch emulation, not mouse click inferred
 * from a narrow viewport. Synthetic content; same V4 and privacy net fixture.
 */
import { expect, test } from "./harness/fixtures";

test.use({ hasTouch: true, viewport: { width: 375, height: 800 } });

test("touch-only task starts, selects, decides and returns feedback in review", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("textbox", { name: "Pegar texto" }).fill(
    "Prueba sintética: DNI 12345678A. Teléfono 600-123-456."
  );
  await page.getByRole("button", { name: "Crear trabajo" }).tap();
  const findings = page.getByRole("list", { name: "Hallazgos" });
  await expect(findings).toBeVisible();
  const progress = page.getByRole("status", { name: "Progreso de la revisión" });
  await expect(progress).toContainText("Pendientes:");
  const inspector = page.getByRole("complementary", { name: "Inspector del hallazgo" });
  await expect(inspector).toBeVisible();
  const accept = inspector.getByRole("button", { name: "Aceptar detección" });
  await expect(accept).toBeEnabled();
  await accept.tap();
  await expect(progress).toContainText("Decididos: 1");
  await expect(inspector).toContainText("Aceptada");
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(375);
});
