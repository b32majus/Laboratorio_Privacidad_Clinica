/**
 * Lazy loader for the vendored pdf.js runtime (T06 #10, SPEC_V4_QUALITY_
 * SECURITY_DEPLOY.md §7 "Load heavy parsers only for the relevant job type").
 *
 * pdf.js is NOT bundled into the V4 application: `lib/pdf.min.js` and
 * `lib/pdf.worker.min.js` are governed by scripts/ci/vendor-manifest.json
 * (sha256) and are served as byte-identical same-origin static assets from
 * `/vendor/`. On first PDF use this helper injects a single <script> tag for
 * the main library; the worker script is only ever fetched by pdf.js itself
 * from the same origin (`GlobalWorkerOptions.workerSrc`).
 *
 * Same-origin only: the injected script src and the worker src are fixed
 * constants below and never depend on input. No other network I/O happens in
 * the input adapters; sensitive bytes stay memory-only (D-013).
 */

/** Minimal typed surface of the pdf.js API used by the V4 PDF adapter. */
export type PdfJsTextItem = { readonly str?: unknown };

export type PdfJsTextContent = { readonly items: readonly PdfJsTextItem[] };

export type PdfJsPage = {
  getTextContent(): Promise<PdfJsTextContent>;
};

export type PdfJsDocument = {
  readonly numPages: number;
  getPage(pageNumber: number): Promise<PdfJsPage>;
};

export type PdfJsLib = {
  GlobalWorkerOptions: { workerSrc: string };
  getDocument(options: { data: ArrayBuffer | Uint8Array; isEvalSupported: false }): {
    promise: Promise<PdfJsDocument>;
  };
};

/** Same-origin vendored pdf.js main library (byte-identical to lib/pdf.min.js). */
export const PDFJS_LIB_SRC = "/vendor/pdf.min.js";

/** Same-origin vendored pdf.js worker (byte-identical to lib/pdf.worker.min.js). */
export const PDFJS_WORKER_SRC = "/vendor/pdf.worker.min.js";

declare global {
  interface Window {
    pdfjsLib?: PdfJsLib;
  }
}

let pendingLoad: Promise<PdfJsLib> | null = null;

/**
 * Resolve the pdf.js API, loading the vendored same-origin script once on
 * first use. If the API is already present on `window` (e.g. pre-seeded by
 * deterministic tests), it is reused and no script is injected.
 */
export function loadPdfJs(): Promise<PdfJsLib> {
  const existing = typeof window !== "undefined" ? window.pdfjsLib : undefined;
  if (existing) return Promise.resolve(existing);

  if (!pendingLoad) {
    pendingLoad = new Promise<PdfJsLib>((resolve, reject) => {
      const script = document.createElement("script");
      script.src = PDFJS_LIB_SRC;
      script.async = true;
      script.onload = () => {
        const lib = window.pdfjsLib;
        if (lib) {
          resolve(lib);
        } else {
          pendingLoad = null;
          reject(new Error(`pdf.js was loaded but window.pdfjsLib is unavailable.`));
        }
      };
      script.onerror = () => {
        pendingLoad = null;
        reject(new Error(`pdf.js could not be loaded from ${PDFJS_LIB_SRC}.`));
      };
      document.head.appendChild(script);
    });
  }
  return pendingLoad;
}

/**
 * Test-only: forget the in-flight/pending loader promise so a later test can
 * exercise the script-injection branch again. Never used by runtime code.
 */
export function resetPdfJsLoaderForTests(): void {
  pendingLoad = null;
}
