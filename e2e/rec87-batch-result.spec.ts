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
 *  - the Safe manifest carries no source filenames and no source content;
 *  - REC-07 #88: the same ready Result downloads exactly one primary
 *    `lote-documentos-seguros.zip` (ten ordinal Safe PDFs, one per prepared
 *    document) and one secondary `lote-seguro-consolidado.pdf` (index +
 *    sections), with ordinal entry names that carry no source filename.
 *  - REC-07 #89: the same ready Result carries the separate batch
 *    Confidential Audit zone — the first action reveals the Spanish
 *    warning and downloads ZERO, Cancel downloads ZERO, and a fresh
 *    request + explicit Confirm downloads exactly ONE
 *    `auditoria-confidencial-lote.txt` composed from the real bridge
 *    sessions (removed failures carry bounded disposition metadata only,
 *    never a fabricated audit body), while every Safe assertion above
 *    stays intact.
 *
 * The auto no-network fixture from ./harness/fixtures applies to every test.
 */
import fs from "node:fs";
import path from "node:path";

import type { Page } from "@playwright/test";
import JSZip from "jszip";
import { PDFDocument } from "pdf-lib";

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
  // The batch Confidential Audit stays unavailable while the batch is blocked.
  await expect(
    page.getByRole("button", { name: "Descargar auditoría confidencial (.txt)" })
  ).toBeDisabled();

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

  // --- REC-07 #88 Safe deliverables: primary ZIP + consolidated PDF --------
  // The ready bridge holds every per-item ReviewSession, so both async
  // actions are enabled; the primary action is still exactly one (the ZIP).
  await expect(page.locator('[data-variant="primary"]')).toHaveCount(1);

  const [zipDownload] = await Promise.all([
    page.waitForEvent("download"),
    page.getByRole("button", { name: "Descargar documentos seguros (.zip)" }).click(),
  ]);
  expect(zipDownload.suggestedFilename()).toBe("lote-documentos-seguros.zip");
  const zip = await JSZip.loadAsync(fs.readFileSync(await zipDownload.path()));
  const entryNames = Object.keys(zip.files).sort();
  // Ten prepared bodies addressed by stable original index (the two removed
  // failures contribute no body); ordinal names only, never source filenames.
  expect(entryNames).toHaveLength(10);
  entryNames.forEach((name, position) => {
    expect(name).toBe(`documento-seguro-${String(position + 1).padStart(2, "0")}.pdf`);
  });
  const joinedNames = entryNames.join("\n");
  expect(joinedNames).not.toContain("rec87-doc-");
  expect(joinedNames).not.toContain("corrupt.pdf");
  expect(joinedNames).not.toContain("sample-scanned.pdf");
  for (const name of entryNames) {
    expect((await zip.files[name].async("uint8array")).length).toBeGreaterThan(0);
  }

  const [consolidatedDownload] = await Promise.all([
    page.waitForEvent("download"),
    page.getByRole("button", { name: "Descargar PDF consolidado del lote (.pdf)" }).click(),
  ]);
  expect(consolidatedDownload.suggestedFilename()).toBe("lote-seguro-consolidado.pdf");
  const consolidated = await PDFDocument.load(fs.readFileSync(await consolidatedDownload.path()));
  // Index + covers + one section per prepared document: strictly more pages
  // than bare documents.
  expect(consolidated.getPageCount()).toBeGreaterThan(10);
  await page.waitForTimeout(300);
  expect(downloads).toBe(3);

  // --- REC-07 #89 batch Confidential Audit: deliberate confirmation ----------
  // The separate internal zone behind the accepted one-time confirmation:
  // first action → warning only, ZERO downloads; Cancel → ZERO; a fresh
  // request + explicit Confirm → exactly ONE `auditoria-confidencial-lote.txt`
  // composed from the real bridge sessions through the canonical per-item
  // Confidential facts.
  const confButton = page.getByRole("button", { name: "Descargar auditoría confidencial (.txt)" });
  await expect(confButton).toBeEnabled();

  await confButton.click();
  const confGroup = page.getByRole("group", { name: "Confirmación de descarga confidencial" });
  await expect(confGroup).toBeVisible();
  await page.waitForTimeout(300);
  expect(downloads).toBe(3);

  await page.getByRole("button", { name: "Cancelar descarga confidencial" }).click();
  await expect(confGroup).toHaveCount(0);
  await page.waitForTimeout(300);
  expect(downloads).toBe(3);

  await confButton.click();
  await expect(confGroup).toBeVisible();
  const [confDownload] = await Promise.all([
    page.waitForEvent("download"),
    page.getByRole("button", { name: "Confirmar descarga confidencial" }).click(),
  ]);
  expect(confDownload.suggestedFilename()).toBe("auditoria-confidencial-lote.txt");
  const confidentialTxt = fs.readFileSync(await confDownload.path(), "utf8");
  // One stable ordinal section per original batch index; the two deliberately
  // removed failures carry bounded ordinal/disposition metadata only — no
  // fabricated audit body, never relabelled completed.
  expect(
    confidentialTxt
      .split("\n")
      .filter((line) => line === "Estado: error (retirado del lote; sin cuerpo de auditoría).")
  ).toHaveLength(2);
  for (let index = 1; index <= 12; index += 1) {
    expect(confidentialTxt).toContain(`Documento ${index}`);
  }
  // Canonical Confidential correspondence from the really reviewed sessions:
  // the original detected value and its replacement mapping are present.
  expect(confidentialTxt).toContain("12345678A");
  // No source filenames and no ordinary Safe-only body text ever enter the
  // Confidential artifact.
  expect(confidentialTxt).not.toContain("rec87-doc-");
  expect(confidentialTxt).not.toContain("corrupt.pdf");
  expect(confidentialTxt).not.toContain("sample-scanned.pdf");
  expect(confidentialTxt).not.toContain("Contenido clínico simulado para E2E");
  expect(confidentialTxt).not.toContain("Documento sintético batch");
  // The confirmation never survives its own download.
  await expect(confGroup).toHaveCount(0);
  await page.waitForTimeout(300);
  expect(downloads).toBe(4);

  // --- Returning to Review preserves every accepted decision -------------------
  await page.getByRole("button", { name: "Volver a la revisión" }).click();
  await expect(filters.getByRole("button", { name: /^Listos \(10\)/ })).toBeVisible();
  await page.getByRole("button", { name: "5. Export" }).click();
  await expect(page.locator("[data-result-state]")).toHaveAttribute("data-result-state", "ready");
});
