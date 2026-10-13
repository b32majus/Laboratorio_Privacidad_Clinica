/** Issue #83: bounded real-build task visibility and explicit per-item continuity. */
import { expect, test } from "./harness/fixtures";
import { buildHighVolumeText, keepOriginalThroughUi } from "./harness/flows";

import type { Locator, Page } from "@playwright/test";

/** Direct-child pane zone order of a live Review grid, read from the DOM. */
function gridZoneOrder(scope: Locator): Promise<string[]> {
  return scope.evaluate((grid) =>
    Array.from(grid.children).map((child): string => {
      if (child.classList.contains("sx-review-document")) return "document";
      if (child.classList.contains("sx-review-findings")) return "findings";
      if (child.classList.contains("sx-review-inspector")) return "inspector";
      return "unknown";
    })
  );
}

/**
 * First sequential-Tab entrance into each of the three live Review zones, from
 * a deterministic blurred origin. Detects the closest zone ancestor of the real
 * `document.activeElement`; never programmatically focuses a pane.
 */
async function tabZoneEntranceOrder(page: Page): Promise<string[]> {
  await page.evaluate(() => {
    const active = document.activeElement;
    if (active instanceof HTMLElement) active.blur();
  });
  const seen: string[] = [];
  for (let i = 0; i < 250 && seen.length < 3; i += 1) {
    await page.keyboard.press("Tab");
    const zone = await page.evaluate((): string | null => {
      const active = document.activeElement;
      if (!(active instanceof HTMLElement)) return null;
      const zone = active.closest(".sx-review-document, .sx-review-findings, .sx-review-inspector");
      if (!zone) return null;
      if (zone.classList.contains("sx-review-document")) return "document";
      if (zone.classList.contains("sx-review-findings")) return "findings";
      return "inspector";
    });
    if (zone && !seen.includes(zone)) seen.push(zone);
  }
  return seen;
}

function activeDescriptor(page: Page): Promise<string> {
  return page.evaluate(() => {
    const active = document.activeElement;
    if (!(active instanceof HTMLElement)) return "none";
    return active.id ? `#${active.id}` : active.tagName.toLowerCase();
  });
}

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

/**
 * CORA-91-F1 S1 (cross-browser): the real DOM/source order, spatial order and
 * sequential Tab order are ONE coherent authority across the accepted single
 * Review breakpoints, without browser-specific CSS reading-flow.
 *
 * Desktop (1440): document → findings → inspector. Stacked (375): inspector →
 * document → findings. The 24-finding synthetic fixture and the real
 * `Pegar texto` → `Crear trabajo` route are reused; this only adds the focused
 * ordering witness.
 */
test("CORA-91-F1 DOM and Tab order tracks visual Review panes", async ({ page }) => {
  const grid = () => page.getByRole("region", { name: "Espacio de revisión" });
  const inspector = page.getByRole("complementary", { name: "Inspector del hallazgo" });
  const currentOriginal = inspector.locator('dt:text-is("Original") + dd');
  const currentDecision = inspector.locator('dt:text-is("Decisión actual") + dd');

  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/");
  await page.getByRole("textbox", { name: "Pegar texto" }).fill(buildHighVolumeText());
  await page.getByRole("button", { name: "Crear trabajo" }).click();
  await expect(page.getByRole("list", { name: "Hallazgos" }).getByRole("button")).toHaveCount(24);

  // Exactly one instance of each pane; never a hidden duplicate.
  await expect(grid()).toHaveCount(1);
  await expect(page.locator(".sx-review-document")).toHaveCount(1);
  await expect(page.locator(".sx-review-findings")).toHaveCount(1);
  await expect(page.locator(".sx-review-inspector")).toHaveCount(1);

  const desktopDom = await gridZoneOrder(grid());
  const desktopTab = await tabZoneEntranceOrder(page);
  console.log(`CORA-91-F1 single 1440 DOM=${desktopDom.join(",")} TAB=${desktopTab.join(",")}`);
  expect(desktopDom).toEqual(["document", "findings", "inspector"]);
  expect(desktopTab).toEqual(["document", "findings", "inspector"]);

  // Selected finding, real decision and visible focus survive the Tab walk.
  await expect(currentOriginal).toHaveText("12345670A");
  await expect(currentDecision).toHaveText("Pendiente");
  expect(
    await page.evaluate(() => {
      const active = document.activeElement;
      return active instanceof HTMLElement && active.closest(".sx-review-grid") !== null;
    })
  ).toBe(true);

  // Populated UNSAVED replacement draft, replacement field focused, then a live
  // crossing of the single-Review breakpoint (1440 → 375).
  const replacement = page.getByLabel("Sustitución");
  await replacement.fill("BORRADOR SIN GUARDAR");
  await replacement.focus();
  const focusBefore = await activeDescriptor(page);
  await page.setViewportSize({ width: 375, height: 800 });
  // WebKit publishes the matchMedia change asynchronously after a real viewport
  // resize: wait for the same converged zone order asserted below instead of
  // reading the DOM before React finishes the pane reorder.
  await expect
    .poll(async () => (await gridZoneOrder(grid())).join(","), { timeout: 10_000 })
    .toBe("inspector,document,findings");
  const focusAfter = await activeDescriptor(page);
  const draftAfter = await replacement.inputValue();
  console.log(
    `CORA-91-F1 resize 1440->375 focusBefore=${focusBefore} focusAfter=${focusAfter} draft="${draftAfter}"`
  );

  const stackedDom = await gridZoneOrder(grid());
  const stackedTab = await tabZoneEntranceOrder(page);
  console.log(`CORA-91-F1 single 375 DOM=${stackedDom.join(",")} TAB=${stackedTab.join(",")}`);
  expect(stackedDom).toEqual(["inspector", "document", "findings"]);
  expect(stackedTab).toEqual(["inspector", "document", "findings"]);

  // Draft, selection and decision all stay authoritative after the reorder.
  expect(draftAfter).toBe("BORRADOR SIN GUARDAR");
  expect(focusAfter).toBe(focusBefore);
  await expect(currentOriginal).toHaveText("12345670A");
  await expect(currentDecision).toHaveText("Pendiente");
  await expect(page.locator(".sx-review-document")).toHaveCount(1);
  await expect(page.locator(".sx-review-findings")).toHaveCount(1);
  await expect(page.locator(".sx-review-inspector")).toHaveCount(1);

  // REVERSE live crossing 375 → 1440: React's DOM-node moves are not symmetric
  // between the two directions, so this direction gets its own real crossing
  // with the SAME populated UNSAVED draft and the replacement field focused.
  await replacement.focus();
  const reverseDraftBefore = await replacement.inputValue();
  const reverseFocusBefore = await activeDescriptor(page);
  await page.setViewportSize({ width: 1440, height: 900 });
  // WebKit publishes the matchMedia change asynchronously after a real viewport
  // resize: wait for the same converged zone order asserted below instead of
  // reading the DOM before React finishes the pane reorder.
  await expect
    .poll(async () => (await gridZoneOrder(grid())).join(","), { timeout: 10_000 })
    .toBe("document,findings,inspector");
  const reverseFocusAfter = await activeDescriptor(page);
  const reverseDraftAfter = await replacement.inputValue();
  console.log(
    `CORA-91-F1 resize 375->1440 focusBefore=${reverseFocusBefore} focusAfter=${reverseFocusAfter} draft="${reverseDraftAfter}"`
  );

  const reverseDom = await gridZoneOrder(grid());
  console.log(`CORA-91-F1 single 1440 (reverse) DOM=${reverseDom.join(",")}`);
  expect(reverseDom).toEqual(["document", "findings", "inspector"]);

  expect(reverseDraftBefore).toBe("BORRADOR SIN GUARDAR");
  expect(reverseDraftAfter).toBe("BORRADOR SIN GUARDAR");
  expect(reverseFocusAfter).toBe(reverseFocusBefore);
  await expect(currentOriginal).toHaveText("12345670A");
  await expect(currentDecision).toHaveText("Pendiente");
  await expect(page.locator(".sx-review-document")).toHaveCount(1);
  await expect(page.locator(".sx-review-findings")).toHaveCount(1);
  await expect(page.locator(".sx-review-inspector")).toHaveCount(1);
});
