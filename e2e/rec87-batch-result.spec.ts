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
 *  - QA-002 (REC-12 F5): the SAME downloaded ZIP and consolidated PDF are read
 *    back through the product's legacy pdf.js seam, so the ten Safe bodies are
 *    proven by CONTENT, not by entry/page counts: ordinal PDF NN carries its
 *    own synthetic body and never the source DNI, a source filename or a
 *    retired error; the consolidated repeats each of those ten Safe texts and
 *    holds ten clinical bodies (the falsifying body 99 never appears).
 *
 * The auto no-network fixture from ./harness/fixtures applies to every test.
 */
import fs from "node:fs";
import path from "node:path";

import type { Page } from "@playwright/test";
import JSZip from "jszip";
import { PDFDocument } from "pdf-lib";

import { expect, test } from "./harness/fixtures";
import { selectFiles } from "./harness/flows";

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
    .getByRole("list", { name: "Hallazgos" })
    .getByRole("button", { name: /12345678A/ })
    .click();
  await page.getByRole("button", { name: "Aceptar detección" }).click();
}

// ---------------------------------------------------------------------------
// Real pdf.js read-back seam (the same seam as the product oracles
// app-v4/src/export/batchSafeDeliverables.test.ts and
// app-v4/src/output/pdf-builder.test.ts). The ONLY input is the bytes
// Playwright really downloaded: no second parser, no re-derivation from the
// builder, and no expectation computed without reading an artifact.
// ---------------------------------------------------------------------------

interface PdfTextItem {
  str: string;
}
interface PdfTextPage {
  getTextContent(): Promise<{ items: PdfTextItem[] }>;
}
interface PdfTextDocument {
  numPages: number;
  getPage(index: number): Promise<PdfTextPage>;
}
interface PdfJsApi {
  getDocument(params: { data: Uint8Array; isEvalSupported: boolean }): {
    promise: Promise<PdfTextDocument>;
  };
}
interface PdfJsModule extends PdfJsApi {
  default?: PdfJsApi;
}

let pdfjsSeam: Promise<PdfJsApi> | null = null;

/** Load the legacy build once and install its documented main-thread fake worker. */
function loadPdfjs(): Promise<PdfJsApi> {
  if (pdfjsSeam === null) {
    pdfjsSeam = (async () => {
      const [lib, worker] = await Promise.all([
        import("pdfjs-dist/legacy/build/pdf.js"),
        // @ts-expect-error: pdfjs-dist legacy worker ships no TypeScript declaration.
        import("pdfjs-dist/legacy/build/pdf.worker.js"),
      ]);
      const libModule = lib as unknown as PdfJsModule;
      const workerModule = worker as unknown as { default?: unknown };
      (globalThis as { pdfjsWorker?: unknown }).pdfjsWorker = workerModule.default ?? workerModule;
      return libModule.default ?? libModule;
    })();
  }
  return pdfjsSeam;
}

/** Extract the real drawn text of every page of the downloaded PDF bytes. */
async function extractPdfText(bytes: Uint8Array): Promise<string> {
  const pdfjs = await loadPdfjs();
  // A Node `Buffer` is refused by pdf.js on purpose: hand it a plain view.
  const pdf = await pdfjs.getDocument({
    data: new Uint8Array(bytes),
    isEvalSupported: false,
  }).promise;
  const pages: string[] = [];
  for (let index = 1; index <= pdf.numPages; index += 1) {
    const page = await pdf.getPage(index);
    const content = await page.getTextContent();
    pages.push(content.items.map((item) => item.str).join(" "));
  }
  return pages.join("\n");
}

/**
 * The ONLY normalization this oracle allows: pdf.js synthesizes item-boundary
 * spaces and line breaks, so content is compared with whitespace runs
 * collapsed. It cannot hide dropped, truncated, duplicated or foreign text.
 */
const readableText = (value: string): string => value.replace(/\s+/g, " ").trim();

const countOccurrences = (haystack: string, needle: string): number =>
  haystack.split(needle).length - 1;

/** Unique synthetic body marker of one prepared document (falsifiable by ordinal). */
const syntheticBody = (number: string): string => `Documento sintético batch ${number}`;
const SYNTHETIC_CLINICAL_BODY = "Contenido clínico simulado para E2E";
const SOURCE_DNI = "12345678A";

test("12-document batch: blocked Result downloads nothing, recovery + review reach one Safe manifest", async ({
  page,
}) => {
  await page.goto("/");
  await selectFiles(page, [...syntheticDocuments(), ...failureInputs()]);
  await page.getByRole("button", { name: "Crear trabajo" }).click();

  const docList = page.getByRole("list", { name: "Estado de los documentos del lote" });
  const filters = page.getByRole("group", { name: "Filtrar documentos del lote" });
  await expect(filters.getByRole("button", { name: /^Necesitan atención \(12\)/ })).toBeVisible();

  // --- Blocked Result: reachable while unauthorized, zero artifact -----------
  // The batch Result is reached through the Privacy Gate (the Gate stays an
  // intact, visitable checkpoint in the path — no direct review skip).
  await page.getByRole("button", { name: "Comprobación de privacidad" }).click();
  await expect(page.getByRole("group", { name: "Recuentos de documentos del lote" })).toContainText(
    "Con error: 2"
  );
  await page.getByRole("button", { name: "Ir al resultado" }).click();
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
  // The corrective action returns to Review and downloads nothing. #78 gives
  // BOTH the batch step and its embedded single-document ReviewWorkspace the
  // Spanish "Revisión" heading, so address the batch header by its own labelled
  // id — a bare name query now matches two headers.
  await page.getByRole("button", { name: "Volver a la revisión" }).click();
  await expect(page.locator("#batch-review-step-heading")).toBeVisible();
  await page.waitForTimeout(300);
  expect(downloads).toBe(0);

  // --- Privacy Gate stays visitable in the path ------------------------------
  await page.getByRole("button", { name: "Comprobación de privacidad" }).click();
  await expect(page.getByRole("group", { name: "Recuentos de documentos del lote" })).toContainText(
    "Con error: 2"
  );
  await expect(
    page.getByRole("alert").filter({ hasText: /documentos del lote no se pudieron procesar/ })
  ).toHaveCount(1);
  await page.getByRole("button", { name: "Volver a la revisión" }).click();

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
  // From Review the batch Result action is "Ver resultado" (quiet shell #84).
  await page.getByRole("button", { name: "Ver resultado" }).click();
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
  const zipBytes = fs.readFileSync(await zipDownload.path());
  const zip = await JSZip.loadAsync(zipBytes);
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
  const preparedSafeTexts: { entryName: string; text: string }[] = [];
  for (let position = 0; position < entryNames.length; position += 1) {
    const name = entryNames[position];
    const number = String(position + 1).padStart(2, "0");
    const bytes = await zip.files[name].async("uint8array");
    expect(bytes.length).toBeGreaterThan(0);
    // Content truth, not size or page count: the REAL downloaded PDF speaks.
    const text = readableText(await extractPdfText(bytes));
    expect(text).toContain(syntheticBody(number));
    expect(text).toContain("Identificador de prueba");
    expect(text).toContain(SYNTHETIC_CLINICAL_BODY);
    // No source identity and no retired failure ever reaches a Safe body.
    expect(text).not.toContain(SOURCE_DNI);
    expect(text).not.toContain("rec87-doc-");
    expect(text).not.toContain("corrupt");
    expect(text).not.toContain("sample-scanned");
    expect(text).not.toContain("texto extraíble");
    // Negative witness: an ordinal that never existed cannot be read back.
    expect(text).not.toContain(syntheticBody("99"));
    preparedSafeTexts.push({ entryName: name, text });
  }
  expect(preparedSafeTexts).toHaveLength(10);

  const [consolidatedDownload] = await Promise.all([
    page.waitForEvent("download"),
    page.getByRole("button", { name: "Descargar PDF consolidado del lote (.pdf)" }).click(),
  ]);
  expect(consolidatedDownload.suggestedFilename()).toBe("lote-seguro-consolidado.pdf");
  const consolidatedBytes = fs.readFileSync(await consolidatedDownload.path());
  const consolidated = await PDFDocument.load(consolidatedBytes);
  // Index + covers + one section per prepared document: strictly more pages
  // than bare documents.
  expect(consolidated.getPageCount()).toBeGreaterThan(10);

  // Same real reader over the SAME downloaded consolidated bytes.
  const consolidatedText = readableText(await extractPdfText(consolidatedBytes));
  // Cross-format parity: each Safe text read from the ZIP appears verbatim in
  // the consolidated (PDF whitespace extraction aside), so the consolidated
  // carries the ten real bodies and not ten empty section covers.
  for (const { entryName, text } of preparedSafeTexts) {
    expect(consolidatedText, `consolidated body parity for ${entryName}`).toContain(text);
  }
  for (let position = 0; position < preparedSafeTexts.length; position += 1) {
    const number = String(position + 1).padStart(2, "0");
    expect(countOccurrences(consolidatedText, syntheticBody(number))).toBe(1);
  }
  expect(countOccurrences(consolidatedText, SYNTHETIC_CLINICAL_BODY)).toBe(10);
  expect(countOccurrences(consolidatedText, syntheticBody("99"))).toBe(0);
  expect(consolidatedText).not.toContain(SOURCE_DNI);
  expect(consolidatedText).not.toContain("rec87-doc-");
  expect(consolidatedText).not.toContain("corrupt");
  expect(consolidatedText).not.toContain("sample-scanned");
  expect(consolidatedText).not.toContain("texto extraíble");
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
  await page.getByRole("button", { name: "Ver resultado" }).click();
  await expect(page.locator("[data-result-state]")).toHaveAttribute("data-result-state", "ready");
});
