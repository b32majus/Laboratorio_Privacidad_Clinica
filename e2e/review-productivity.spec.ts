/** Issue #83: bounded real-build task visibility and explicit per-item continuity. */
import { expect, test } from "./harness/fixtures";
import { buildHighVolumeText, keepOriginalThroughUi } from "./harness/flows";

for (const width of [375, 1280]) {
  test(`current Review task and explicit navigation remain usable (${width}×800)`, async ({
    page,
  }, testInfo) => {
    await page.setViewportSize({ width, height: 800 });
    await page.goto("/");
    await page.getByRole("textbox", { name: "Pegar texto" }).fill(buildHighVolumeText());
    await page.getByRole("button", { name: "Crear trabajo" }).click();

    const inspector = page.getByRole("complementary", { name: "Inspector del hallazgo" });
    const decision = inspector.locator('dt:text-is("Decisión actual") + dd');
    const context = inspector.locator('dt:text-is("Contexto") + dd');
    const currentOriginal = inspector.locator('dt:text-is("Original") + dd');
    const next = inspector.getByRole("button", { name: "Siguiente pendiente" });
    const previous = inspector.getByRole("button", { name: "Anterior pendiente" });
    const accept = inspector.getByRole("button", { name: "Aceptar detección" });
    const progress = page.getByRole("status", { name: "Progreso de la revisión" });
    const noOverflow = async () => {
      expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(width);
    };
    const capture = async (name: string) => {
      const path = testInfo.outputPath(`${name}.png`);
      await page.screenshot({ path });
      await testInfo.attach(name, { path, contentType: "image/png" });
    };

    await expect(progress).toContainText("Total: 24");
    await expect(progress).toContainText("Pendientes: 24");
    await expect(currentOriginal).toHaveText("12345670A");
    await expect(decision).toHaveText("Pendiente");
    await expect(previous).toBeDisabled();
    // No scrolling to a dashboard or 24-row list before the first decision.
    await expect(currentOriginal).toBeInViewport({ ratio: 1 });
    await expect(context).toBeInViewport({ ratio: 1 });
    await expect(accept).toBeInViewport({ ratio: 1 });
    await expect(next).toBeInViewport({ ratio: 1 });
    await noOverflow();
    await capture("entry-current-task");

    await next.focus();
    await next.press("Alt+ArrowDown");
    await expect(currentOriginal).toHaveText("600-123-450");
    await expect(next).toBeFocused();
    await expect(progress).toContainText("Pendientes: 24");
    await next.press("a");
    await expect(currentOriginal).toHaveText("600-123-450");
    await expect(decision).toHaveText("Aceptada");
    await expect(progress).toContainText("Pendientes: 23");
    await next.press("m");
    const replacement = page.getByLabel("Sustitución");
    await expect(replacement).toBeFocused();
    await replacement.fill("CONTACTO REVISADO");
    await replacement.press("Alt+ArrowDown");
    await expect(replacement).toHaveValue("CONTACTO REVISADO");
    await expect(currentOriginal).toHaveText("600-123-450");
    await next.click();
    await expect(inspector.getByRole("alert")).toContainText("Hay un borrador sin guardar");
    await expect(inspector).toBeFocused();
    await expect(inspector.getByRole("alert")).toBeInViewport();
    await page.getByRole("button", { name: "Aplicar modificación" }).click();
    await expect(decision).toHaveText("Modificada");
    await expect(currentOriginal).toHaveText("600-123-450");
    await next.click();
    await expect(currentOriginal).toHaveText("paciente0@example.com");
    await next.press("k");
    const confirmation = inspector.getByRole("group", { name: "Confirmar conservar original" });
    await expect(confirmation).toBeVisible();
    const cancel = confirmation.getByRole("button", { name: "Cancelar", exact: true });
    await expect(cancel).toBeFocused();
    await cancel.press("a");
    await cancel.press("Alt+ArrowDown");
    await expect(currentOriginal).toHaveText("paciente0@example.com");
    await expect(decision).toHaveText("Pendiente");
    await cancel.press("Enter");
    await keepOriginalThroughUi(page);
    await expect(decision).toHaveText("Original conservado");
    await next.click();
    await expect(currentOriginal).toHaveText("NHC 00442310");
    await previous.click();
    await expect(currentOriginal).toHaveText("12345670A");
    await noOverflow();
    await capture("decide-correct-navigate");

    // #81 keyboard route still authorizes only a real original-text Range.
    const mark = page.getByRole("button", { name: "Marcar dato no detectado" });
    await mark.focus();
    await page
      .getByRole("group", { name: "Texto del documento con hallazgos" })
      .evaluate((group) => {
        const anchor = group.querySelector('[data-source-start="0"]');
        if (!anchor?.firstChild) throw new Error("Missing synthetic source anchor");
        const range = document.createRange();
        range.setStart(anchor.firstChild, 0);
        range.setEnd(anchor.firstChild, 7);
        const selection = window.getSelection()!;
        selection.removeAllRanges();
        selection.addRange(range);
      });
    await mark.press("f");
    await expect(page.getByLabel("Tipo de dato")).toBeFocused();
    await page.getByLabel("Tipo de dato").fill("CONTEXTO SINTÉTICO");
    await page.getByRole("button", { name: "Añadir dato marcado" }).click();
    await expect(page.getByText("Dato añadido. Pendiente de revisar")).toBeVisible();
    await page.getByRole("button", { name: "Revisar dato marcado" }).click();
    await expect(inspector).toBeFocused();
    await expect(currentOriginal).toHaveText("Informe");
    await expect(decision).toHaveText("Pendiente");
    await expect(accept).toBeDisabled();
    await noOverflow();

    // Real below-threshold candidate, not a runtime patch or numeric inference.
    await page.goto("/");
    await page
      .getByRole("textbox", { name: "Pegar texto" })
      .fill("La paciente acudió ayer. Fisioterapeuta Nélida Otxoa realizó la sesión.");
    await page.getByRole("button", { name: "Crear trabajo" }).click();
    await expect(progress).toContainText("Baja confianza: 1");
    await expect(decision).toHaveText("Pendiente");
    await expect(accept).toBeInViewport();
    await noOverflow();
    await capture("low-confidence-explicit-decision");
  });
}
