/**
 * REC-07 #87 — batch Result readiness + Safe summary CSV journey.
 *
 * Walks the REAL rendered production build through the ordinary
 * multi-document batch human ending: a realistic 12-document batch (ten
 * synthetic TXT + two local read failures) reaches a blocked Result with
 * zero artifact production, recovers through the accepted remove flow,
 * completes every review, and reaches the ready Result whose single primary
 * action downloads the deterministic Safe manifest. Every fixture is
 * synthetic and identifier-only: no real PHI/PII anywhere.
 *
 * What this spec is allowed to claim (and what its fixtures falsify):
 *  - a blocked batch Result names the failed documents, keeps the Safe
 *    summary unavailable, and downloads zero artifacts;
 *  - the Privacy Gate stays visitable in the path and returning to Review
 *    preserves accepted decisions;
 *  - a batch that becomes ready after accepted removals downloads exactly
 *    one `resumen-lote-seguro.csv` whose rows account for every original
 *    selection index in order (removed failures as `error,retirado`);
 *  - the Safe manifest carries no source filenames and no source content.
 *
 * The auto no-network fixture from ./harness/fixtures applies to every test.
 */
import fs from "node:fs";
import path from "node:path";

import type { Page } from "@playwright/test";

import { expect, test } from "./harness/fixtures";

const CORRUPT_PDF = path.resolve(__dirname, "../app-v4/src/input/fixtures/corrupt.pdf");
const SCANNED_PDF = path.resolve(__dirname, "../app-v4/src/input/fixtures/sample-scanned.pdf");

/** Ten synthetic review-required TXT documents with one detection each. */
function syntheticDocuments(): { name: string; mimeType: string; buffer: Buffer }[] {
  return Array.from({ length: 10 }, (_entry, index) => {
    const number = String(index + 1).padStart(2, "0");
    return {
      name: `rec87-doc-${number}.txt`,
      mimeType: "text/plain",
      buffer: Buffer.from(
        `Documento sintético batch ${number}.\nIdentificador de prueba: DNI 12345678A.\nContenido clínico simulado para E2E.\n`
      ),
    };
  });
}

function failureInputs(): { name: string; mimeType: string; buffer: Buffer }[] {
  return [CORRUPT_PDF, SCANNED_PDF].map((source) => ({
    name: path.basename(source),
    mimeType: "application/pdf",
    buffer: fs.readFileSync(source),
  }));
}

/** Complete the currently open document's single pending detection. */
async function acceptOpenDetection(page: Page): Promise<void> {
  await page
    .getByRole("list", { name: "Detections" })
    .getByRole("button", { name: /12345678A/ })
    .click();
  await page.getByRole("button", { name: "Accept detection" }).click();
}

test("12-document batch: blocked Result downloads nothing, recovery + review reach one Safe manifest", async ({
  page,
}) => {
  await page.goto("/");
  await page
    .getByLabel("Select files (TXT, PDF, DOCX, CSV, XLS, XLSX)")
    .setInputFiles([...syntheticDocuments(), ...failureInputs()]);
  await page.getByRole("button", { name: "Create job" }).click();
  await page.getByRole("button", { name: "2. Configure" }).click();
  await page.getByRole("button", { name: "3. Review" }).click();

  const docList = page.getByRole("list", { name: "Batch document status" });
  const filters = page.getByRole("group", { name: "Filtrar documentos del lote" });
  await expect(filters.getByRole("button", { name: /^Necesitan atención \(12\)/ })).toBeVisible();

  // --- Blocked Result: reachable while unauthorized, zero artifact -----------
  // The batch Result is reached through the Privacy Gate (the Gate stays an
  // intact, visitable checkpoint in the path — no direct review skip).
  await page.getByRole("button", { name: "4. Privacy Gate" }).click();
  await expect(page.getByRole("group", { name: "Batch item counts" })).toContainText("Failed: 2");
  await page.getByRole("button", { name: "5. Export" }).click();
  await expect(page.getByRole("heading", { level: 2, name: "Resultado" })).toBeVisible();
  await expect(page.locator("[data-result-state]")).toHaveAttribute("data-result-state", "blocked");
  await expect(page.getByRole("heading", { name: "Bloqueado" })).toBeVisible();
  await expect(page.getByText(/Hay 2 documentos con error/)).toBeVisible();
  await expect(page.getByRole("list", { name: "Documentos con error" })).toContainText(
    "corrupt.pdf"
  );
  const summaryButton = page.getByRole("button", { name: "Descargar resumen seguro (.csv)" });
  await expect(summaryButton).toBeDisabled();

  let downloads = 0;
  page.on("download", () => {
    downloads += 1;
  });
  // The corrective action returns to Review and downloads nothing.
  await page.getByRole("button", { name: "Volver a la revisión" }).click();
  await expect(page.getByRole("heading", { name: "Revisión" })).toBeVisible();
  await page.waitForTimeout(300);
  expect(downloads).toBe(0);

  // --- Privacy Gate stays visitable in the path ------------------------------
  await page.getByRole("button", { name: "4. Privacy Gate" }).click();
  await expect(page.getByRole("group", { name: "Batch item counts" })).toContainText("Failed: 2");
  await expect(page.getByRole("alert").filter({ hasText: /batch items? failed/ })).toHaveCount(1);
  await page.getByRole("button", { name: "3. Review" }).click();

  // --- Recovery: deliberately remove both local failures ----------------------
  // Work from Todos: a removed row leaves the attention filter immediately.
  await filters.getByRole("button", { name: /^Todos \(12\)/ }).click();
  for (const name of ["corrupt.pdf", "sample-scanned.pdf"]) {
    const row = docList.getByRole("listitem").filter({ hasText: name });
    await row.getByRole("button", { name: "Retirar del lote" }).click();
    await row.getByRole("button", { name: "Confirmar retirada" }).click();
    await expect(row).toContainText("Retirado del lote");
  }

  // --- Complete every remaining review through the real controls --------------
  for (let doc = 1; doc <= 10; doc += 1) {
    const number = String(doc).padStart(2, "0");
    await docList.getByRole("button", { name: new RegExp(`rec87-doc-${number}\\.txt`) }).click();
    await acceptOpenDetection(page);
  }
  await expect(filters.getByRole("button", { name: /^Listos \(10\)/ })).toBeVisible();
  await expect(filters.getByRole("button", { name: /^Retirados \(2\)/ })).toBeVisible();

  // --- Ready Result: exactly one primary Safe action, one manifest ------------
  await page.getByRole("button", { name: "5. Export" }).click();
  await expect(page.getByRole("heading", { level: 2, name: "Resultado" })).toBeVisible();
  await expect(page.locator("[data-result-state]")).toHaveAttribute("data-result-state", "ready");
  await expect(page.getByRole("heading", { name: "Listo para usar" })).toBeVisible();
  await expect(page.locator('[data-variant="primary"]')).toHaveCount(1);

  const [csvDownload] = await Promise.all([
    page.waitForEvent("download"),
    page.getByRole("button", { name: "Descargar resumen seguro (.csv)" }).click(),
  ]);
  expect(csvDownload.suggestedFilename()).toBe("resumen-lote-seguro.csv");
  const csv = fs.readFileSync(await csvDownload.path(), "utf8");
  const lines = csv.split("\n");
  expect(lines).toHaveLength(13);
  expect(lines[0]).toBe("indice_lote,estado,disposicion");
  for (let index = 1; index <= 12; index += 1) {
    expect(lines[index]).toBe(index >= 11 ? `${index},error,retirado` : `${index},completado,`);
  }
  // The Safe manifest carries no source filenames and no source content.
  expect(csv).not.toContain("rec87-doc-");
  expect(csv).not.toContain("corrupt.pdf");
  expect(csv).not.toContain("sample-scanned.pdf");
  expect(csv).not.toContain("12345678A");
  await page.waitForTimeout(300);
  expect(downloads).toBe(1);

  // --- Returning to Review preserves every accepted decision -------------------
  await page.getByRole("button", { name: "Volver a la revisión" }).click();
  await expect(filters.getByRole("button", { name: /^Listos \(10\)/ })).toBeVisible();
  await page.getByRole("button", { name: "5. Export" }).click();
  await expect(page.locator("[data-result-state]")).toHaveAttribute("data-result-state", "ready");
});
