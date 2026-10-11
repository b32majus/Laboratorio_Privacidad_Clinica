/**
 * Review / Safe Output / Confidential Audit contracts E2E (Work Order T21 #25;
 * SPEC_V4_QUALITY_SECURITY_DEPLOY.md §1 E2E list, D-004/D-005/D-009).
 *
 * Observable behavior only, driven through the real UI and asserted against
 * the real authorities (ReviewSession-derived gate, downloads): the test does
 * NOT re-implement pending logic, final text computation or detection
 * internals. The synthetic fixture is fully known, so the expected Safe
 * Output is derived here by plain string surgery on the fixture itself and
 * must equal the artifact byte-for-byte.
 *
 * Contracts covered:
 *  - a modified decision appears in the final output;
 *  - a restored/kept original appears ONLY because it was explicitly kept
 *    (kept-original semantics, never framed or treated as a leak);
 *  - a manual detection affects the final output;
 *  - mandatory pending review blocks the export gate (fail-closed);
 *  - Safe Output contains no prohibited raw fixture PII and no
 *    correspondence/audit artifact content;
 *  - Confidential Audit is distinctly labelled and carries the mapping.
 */
import { readFileSync } from "node:fs";

import { expect, test } from "./harness/fixtures";

const FIXTURE_TEXT =
  "Informe de consulta externa. Documento del paciente: DNI 12345678A. " +
  "Telefono de contacto 600-123-456. Correo paciente1@example.com. Historia numero NHC 00442315. " +
  "Diagnostico: hipertension arterial controlada. Se pauta enalapril 10 mg cada 24 horas.";

const DNI = "12345678A";
const TELEFONO = "600-123-456";
const EMAIL = "paciente1@example.com";
const NHC = "NHC 00442315";
const MANUAL_SPAN = "enalapril";
const DNI_REPLACEMENT = "[DNI-REVISADO]";
const MANUAL_REPLACEMENT = "[FARMACO-REVISADO]";

/** Apply the exact decisions of this spec to the fixture text. */
function expectedSafeOutput(): string {
  return FIXTURE_TEXT.replace(DNI, DNI_REPLACEMENT)
    .replace(TELEFONO, "")
    .replace(NHC, "")
    .replace(MANUAL_SPAN, MANUAL_REPLACEMENT);
}

for (const width of [375, 1280]) {
  test(`review decisions drive the export gate and the canonical Safe Output (${width}px)`, async ({
    page,
  }, testInfo) => {
    await page.setViewportSize({ width, height: 800 });
    const capture = async (name: string) => {
      const path = testInfo.outputPath(`${name}.png`);
      await page.screenshot({ path });
      await testInfo.attach(name, { path, contentType: "image/png" });
    };
    const noOverflow = async () => {
      expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(width);
    };
    await page.goto("/");
    await page.getByRole("textbox", { name: "Pegar texto" }).fill(FIXTURE_TEXT);
    await page.getByRole("button", { name: "Crear trabajo" }).click();

    const progress = page.getByRole("status", { name: "Review progress" });
    const detections = page.getByRole("list", { name: "Detections" }).getByRole("button");

    // The engine found exactly the four known identifiers of the fixture.
    await expect(detections).toHaveCount(4);
    await expect(progress).toContainText("Total: 4");
    await expect(progress).toContainText("Pending: 4");
    await expect(progress).toContainText("All mandatory decisions complete: no");

    // --- Export gate is fail-closed while decisions are pending -------------
    await page.getByRole("button", { name: "Privacy Gate" }).click();
    await expect(page.getByRole("alert")).toContainText(
      "Safe export is blocked while 4 mandatory review decisions are pending."
    );
    await page.getByRole("button", { name: "Volver a la revisión" }).click();

    const selectDetection = (label: RegExp) =>
      page.getByRole("list", { name: "Detections" }).getByRole("button", { name: label }).click();

    // Modified: the reviewer rewrites the DNI replacement.
    await selectDetection(new RegExp(DNI));
    await page.getByLabel("Sustitución").fill(DNI_REPLACEMENT);
    const inspector = page.getByRole("complementary", { name: "Entity inspector" });
    const keep = page.getByRole("button", { name: "Mantener original", exact: true });
    const back = page.getByRole("button", { name: "Volver a detecciones" });
    const returnToList = async () => {
      await back.focus();
      await back.press("Enter");
      const list = page.getByRole("region", { name: "Detection list" });
      await expect(list).toBeFocused();
      await expect(list).toBeInViewport();
      expect(await list.evaluate((element) => getComputedStyle(element).boxShadow)).not.toBe(
        "none"
      );
      await noOverflow();
    };
    if (width === 375) {
      await page.getByRole("button", { name: /Go to decision controls/ }).press("Enter");
      await expect(inspector).toBeFocused();
    } else {
      await expect(back).toBeHidden();
    }
    await keep.focus();
    await keep.press("Enter");
    const confirmation = page.getByRole("group", { name: "Confirmar mantener original" });
    await expect(confirmation).toContainText(
      "El texto original, identificable, permanecerá sin cambios en el resultado preparado para compartir."
    );
    await expect(confirmation).not.toContainText(DNI);
    await expect(page.getByRole("button", { name: "Cancelar", exact: true })).toBeFocused();
    await expect(progress).toContainText("Restored: 0");
    await expect(progress).toContainText("Pending: 4");
    await noOverflow();
    await capture("contextual-consequence");
    await page.getByRole("button", { name: "Cancelar", exact: true }).press("Escape");
    await expect(confirmation).toHaveCount(0);
    await expect(keep).toBeFocused();
    await expect(page.getByLabel("Sustitución")).toHaveValue(DNI_REPLACEMENT);
    await expect(progress).toContainText("Restored: 0");
    if (width === 375) await returnToList();
    await keep.focus();
    await keep.press("Enter");
    await page.getByRole("button", { name: "Sí, mantener original" }).press("Enter");
    await expect(keep).toBeFocused();
    await expect(inspector).toContainText(/Decisión actual\s*Original conservado/);
    await expect(progress).toContainText("Restored: 1");
    await expect(progress).toContainText("Pending: 3");
    await capture("confirmed-current-decision");
    if (width === 375) {
      await returnToList();
      await capture("keyboard-return-to-detections");
    }
    // Confirmed decisions remain correctable using the ordinary controls.
    await page.getByLabel("Sustitución").fill(DNI_REPLACEMENT);
    await page.getByRole("button", { name: "Aplicar modificación" }).click();
    await expect(progress).toContainText("Modified: 1");

    // Restored: the email original is EXPLICITLY kept by reviewer decision.
    await selectDetection(new RegExp(EMAIL.replace(".", "\\.")));
    await page.getByRole("button", { name: "Mantener original", exact: true }).click();
    await expect(progress).toContainText("Restored: 0");
    await page.getByRole("button", { name: "Sí, mantener original" }).click();
    await expect(progress).toContainText("Restored: 1");

    // Accepted: phone and NHC disappear from the final text (deletion proposals).
    await selectDetection(new RegExp(TELEFONO.replace("-", "-")));
    await page.getByRole("button", { name: "Aceptar detección" }).click();
    await selectDetection(new RegExp(NHC));
    await page.getByRole("button", { name: "Aceptar detección" }).click();
    await expect(progress).toContainText("Pending: 0");

    // --- Manual detection affects the final output --------------------------
    const mark = page.getByRole("button", { name: "Marcar dato no detectado" });
    const source = page.getByRole("group", { name: "Document text with detections" });
    const form = page.getByRole("form", { name: "Marcar dato" });
    const captureSource = async () => {
      await mark.scrollIntoViewIfNeeded();
      await mark.focus();
      // Native browser selection of the known synthetic source span 218–227.
      // This witnesses Range/Selection mapping, not a claimed pointer drag.
      await source.evaluate((group) => {
        const anchor = Array.from(group.querySelectorAll<HTMLElement>("[data-source-start]")).find(
          (element) =>
            Number(element.dataset.sourceStart) <= 218 &&
            Number(element.dataset.sourceStart) + (element.textContent?.length ?? 0) >= 227
        );
        if (!anchor?.firstChild) throw new Error("Missing original enalapril source segment");
        const range = document.createRange();
        range.setStart(anchor.firstChild, 218 - Number(anchor.dataset.sourceStart));
        range.setEnd(anchor.firstChild, 227 - Number(anchor.dataset.sourceStart));
        const selection = window.getSelection()!;
        selection.removeAllRanges();
        selection.addRange(range);
      });
      const beforeScroll = await page.evaluate(() => window.scrollY);
      await mark.press("Enter");
      await expect(page.getByLabel("Tipo de dato")).toBeFocused();
      await expect(form).toBeInViewport({ ratio: 1 });
      await expect(form.getByRole("region", { name: "Texto seleccionado" })).toHaveText(
        MANUAL_SPAN
      );
      await expect(form.locator('input[type="number"]')).toHaveCount(0);
      await expect(form.getByRole("button", { name: "Cancelar", exact: true })).toBeInViewport();
      await expect(form.getByRole("button", { name: "Añadir dato marcado" })).toBeInViewport();
      if (width === 375)
        expect(await page.evaluate(() => window.scrollY)).toBeGreaterThan(beforeScroll);
      await noOverflow();
    };
    await captureSource();
    await page.getByLabel("Tipo de dato").fill("Tipo cancelado");
    await capture("manual-captured-panel");
    await form.getByRole("button", { name: "Cancelar", exact: true }).press("Enter");
    await expect(form).toHaveCount(0);
    await expect(mark).toBeFocused();
    await expect(mark).toBeInViewport();
    await expect(progress).toContainText("Total: 4");
    await expect(progress).toContainText("Pending: 0");
    await noOverflow();
    await captureSource();
    await page.getByLabel("Tipo de dato").fill("FARMACO");
    await form.getByRole("button", { name: "Añadir dato marcado" }).press("Enter");
    await expect(page.getByText("Dato añadido. Pendiente de revisar")).toBeVisible();
    const reviewMarked = page.getByRole("button", { name: "Revisar dato marcado" });
    await expect(reviewMarked).toBeFocused();
    await expect(reviewMarked).toBeInViewport();
    await noOverflow();
    await capture("manual-pending-next-action");
    await expect(progress).toContainText("Total: 5");
    await expect(progress).toContainText("Manual: 1");
    await expect(progress).toContainText("Pending: 1");

    await reviewMarked.press("Enter");
    await expect(inspector).toBeFocused();
    await expect(inspector).toContainText(MANUAL_SPAN);
    await page.getByLabel("Sustitución").fill(MANUAL_REPLACEMENT);
    await page.getByRole("button", { name: "Aplicar modificación" }).click();

    await expect(progress).toContainText("All mandatory decisions complete: yes");

    // --- Privacy Gate: factual summary with kept-original warnings ----------
    await page.getByRole("button", { name: "Privacy Gate" }).click();
    await expect(page.getByRole("alert")).toHaveCount(0);
    const warnings = page.getByRole("list", { name: "Kept-original warnings" });
    await expect(warnings).toContainText("Kept original");
    const summary = page.getByRole("group", { name: "Review summary facts" });
    await expect(summary).toContainText("2 accepted, 2 modified");
    await expect(summary).toContainText("Kept originals (restored): 1");

    // --- Export: two separate artifacts -------------------------------------
    await page.getByRole("button", { name: "Ir al resultado" }).click();
    const resultWarning = page.getByRole("region", {
      name: "Originales conservados deliberadamente",
    });
    const primary = page.getByRole("button", { name: "Copiar texto preparado" });
    await primary.scrollIntoViewIfNeeded();
    await expect(resultWarning).toBeInViewport();
    await expect(primary).toBeInViewport();
    await expect(resultWarning).toContainText(
      "Se conservó el texto original de tipo «IDENTIFICADOR»"
    );
    await expect(resultWarning).not.toContainText(EMAIL);
    const warningBox = await resultWarning.boundingBox();
    const primaryBox = await primary.boundingBox();
    expect(warningBox!.y + warningBox!.height).toBeLessThan(primaryBox!.y);
    expect(primaryBox!.y - warningBox!.y).toBeLessThan(400);
    await noOverflow();
    await capture("result-warning-primary-action");
    const safeButton = page.getByRole("button", { name: "Descargar como TXT (.txt)" });
    await expect(safeButton).toBeEnabled();
    await expect(
      page.getByRole("button", { name: "Descargar auditoría confidencial (.txt)" })
    ).toBeEnabled();
    // PDR-08: Spanish zone copy; the English marker is the payload authority
    // (asserted below against the downloaded audit artifact).
    await expect(page.getByText("Confidencial — artefacto interno de auditoría")).toBeVisible();

    const [safeDownload] = await Promise.all([page.waitForEvent("download"), safeButton.click()]);
    expect(safeDownload.suggestedFilename()).toBe("texto-preparado.txt");
    const safeOutput = readFileSync(await safeDownload.path(), "utf8");

    // Byte-exact derivation from the final review state: modified and manual
    // replacements present, accepted deletions gone.
    expect(safeOutput).toBe(expectedSafeOutput());
    // No prohibited raw fixture PII remains.
    expect(safeOutput).not.toContain(DNI);
    expect(safeOutput).not.toContain(TELEFONO);
    expect(safeOutput).not.toContain(NHC);
    // The email appears ONLY because the reviewer explicitly restored it
    // (kept-original semantics); it must not be treated as a leak.
    expect(safeOutput).toContain(EMAIL);
    // No audit artifact content may ride along on the safe artifact.
    expect(safeOutput).not.toContain("CONFIDENTIAL");

    // H-42 single slice (REC-05 WU-C): the first Confidential click reveals the
    // deliberate Spanish warning and downloads NOTHING; explicit Confirm then
    // produces exactly one artifact.
    await page.getByRole("button", { name: "Descargar auditoría confidencial (.txt)" }).click();
    await expect(
      page.getByRole("group", { name: "Confirmación de descarga confidencial" })
    ).toBeVisible();
    const [auditDownload] = await Promise.all([
      page.waitForEvent("download"),
      page.getByRole("button", { name: "Confirmar descarga confidencial" }).click(),
    ]);
    expect(auditDownload.suggestedFilename()).toBe("auditoria-confidencial.txt");
    const audit = readFileSync(await auditDownload.path(), "utf8");

    // Distinctly labelled, carries the original↔replacement mapping.
    expect(audit.startsWith("CONFIDENTIAL — INTERNAL AUDIT ARTIFACT")).toBe(true);
    expect(audit).toContain(DNI);
    expect(audit).toContain(DNI_REPLACEMENT);
    expect(audit).not.toBe(safeOutput);
  });
}
