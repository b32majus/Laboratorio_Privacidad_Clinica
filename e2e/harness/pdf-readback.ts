/**
 * Shared test-only PDF read-back seam.
 *
 * Reads the text really drawn into downloaded PDF bytes through the product's
 * legacy pdf.js build and its documented main-thread fake worker — the same
 * seam as the product oracles app-v4/src/export/batchSafeDeliverables.test.ts
 * and app-v4/src/output/pdf-builder.test.ts. The ONLY input is the bytes the
 * spec really downloaded: no second parser, no re-derivation from the builder,
 * no simulated content and no expectation computed without reading an artifact.
 */

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
        import("pdfjs-dist/legacy/build/pdf.mjs"),
        // @ts-expect-error: pdfjs-dist legacy worker ships no TypeScript declaration.
        import("pdfjs-dist/legacy/build/pdf.worker.mjs"),
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
export async function extractPdfText(bytes: Uint8Array): Promise<string> {
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

/** PDF.js synthesizes whitespace at text-item and wrap boundaries. */
export const readableText = (value: string): string => value.replace(/\s+/g, " ").trim();
