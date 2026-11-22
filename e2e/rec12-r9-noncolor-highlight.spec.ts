/**
 * REC-12 R9: GAP-04 material witness — visible type without relying exclusively
 * on highlight color. Only synthetic content; real V4 bundle and browser.
 * Demonstrates underlined marked text, accessible type label and same type in
 * the findings list/inspector after selection; NOT every future entity type.
 */
import fs from "node:fs";
import path from "node:path";
import { expect, test } from "./harness/fixtures";

const out = path.resolve("docs/evidence/issue92-r9-semantic-rows-20261122/capturas");
fs.mkdirSync(out, { recursive: true });

for (const width of [375, 1280]) {
  test(`R9 ${width}px: highlighted finding has non-color indicator and type in list+inspector`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 800 });
    await page.goto("/");
    await page
      .getByRole("textbox", { name: "Pegar texto" })
      .fill(
        "Seguimiento clínico sintético. DNI 12345678A. Teléfono 600-123-456. " +
          "Correo paciente1@example.com. NHC 00442315."
      );
    await page.getByRole("button", { name: "Crear trabajo" }).click();
    const marks = page
      .getByRole("group", { name: "Texto del documento con hallazgos" })
      .locator("button[data-source-start]");
    await expect(marks).toHaveCount(4);
    const first = marks.filter({ hasText: "12345678A" }).first();
    await expect(first).toBeVisible();
    const annotation = await first.evaluate((el) => {
      const css = getComputedStyle(el);
      return {
        ariaLabel: el.getAttribute("aria-label"),
        decorationLine: css.textDecorationLine,
        decorationStyle: css.textDecorationStyle,
        accessibleName: el.getAttribute("aria-label"),
        text: el.textContent,
      };
    });
    expect(annotation.ariaLabel).toContain("IDENTIFICADOR");
    expect(annotation.ariaLabel).toContain("estado de la decisión");
    expect(annotation.decorationLine).toContain("underline");
    const list = page.getByRole("list", { name: "Hallazgos" });
    await expect(list).toContainText("IDENTIFICADOR");
    // A sighted keyboard/mouse user can select the underlined item and read
    // its type in the same inspector without distinguishing the mark's color.
    await first.click();
    const inspector = page.getByRole("complementary", { name: "Inspector del hallazgo" });
    await expect(inspector).toContainText("IDENTIFICADOR");
    await expect(inspector).toContainText("12345678A");
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(
      width
    );
    await page.screenshot({
      path: path.join(out, `noncolor-${width}-full.png`),
      fullPage: true,
      animations: "disabled",
    });
  });
}
