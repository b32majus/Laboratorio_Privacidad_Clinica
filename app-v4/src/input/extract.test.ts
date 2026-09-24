/**
 * Deterministic oracles for the V4 input adapters (T06 #10). Fixtures are
 * committed synthetic bytes under ./fixtures (see fixtures/README.md); tests
 * read them from disk (test-only fs use). Every behavioral claim here has a
 * case capable of disagreeing with the implementation: exact-text successes,
 * typed failures for empty/corrupt/no-text-layer inputs, unsupported-format
 * rejections and the memory-only invariant during extraction.
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { afterEach, describe, expect, it, vi } from "vitest";

import { install, type NetworkMonitor } from "../testing/network-monitor";
import { extractDocx, extractFile, extractFromPastedText, extractPdf, extractTxt } from "./extract";
import { loadPdfJs, PDFJS_LIB_SRC, resetPdfJsLoaderForTests, type PdfJsLib } from "./pdfjs-loader";

const EXPECTED_TXT = [
  "Nota clinica sintetica de prueba para el laboratorio.",
  "Paciente: sintetico, sin datos reales.",
  "Motivo de consulta: validacion del adaptador de entrada TXT.",
].join("\n");

const EXPECTED_DOCX =
  "Nota clinica sintetica de prueba para el laboratorio.\n\n" +
  "Paciente: sintetico, sin datos reales.";
// mammoth.extractRawText emits a trailing paragraph break after the last
// paragraph; the adapter returns the raw extraction unmodified (no silent
// trimming of user content).
const EXPECTED_DOCX_RAW = EXPECTED_DOCX + "\n\n";

const EXPECTED_PDF = "Nota clinica sintetica de prueba para el laboratorio.";

const fixturesDir = path.join(path.dirname(fileURLToPath(import.meta.url)), "fixtures");

function fixtureBytes(name: string): Uint8Array<ArrayBuffer> {
  return new Uint8Array(fs.readFileSync(path.join(fixturesDir, name)));
}

function fixtureFile(name: string): File {
  return new File([fixtureBytes(name)], name);
}

/** Seed the REAL pdf.js (same version as the governed vendored asset). */
async function seedRealPdfJs(): Promise<PdfJsLib> {
  // In a browser the adapter's workerSrc (same-origin /vendor/pdf.worker.min.js)
  // is fetched by pdf.js itself. In the jsdom/Node test environment pdf.js runs
  // a fake worker on the main thread instead, so the worker message handler is
  // provided through the documented `globalThis.pdfjsWorker` seam.
  const [pdfjs, worker] = await Promise.all([
    import("pdfjs-dist/legacy/build/pdf.js"),
    import("pdfjs-dist/legacy/build/pdf.worker.js"),
  ]);
  (globalThis as { pdfjsWorker?: unknown }).pdfjsWorker = worker;
  const lib = pdfjs as unknown as PdfJsLib;
  window.pdfjsLib = lib;
  return lib;
}

function fakePdfJsLib(): PdfJsLib {
  return {
    GlobalWorkerOptions: { workerSrc: "" },
    getDocument: () => ({
      promise: Promise.resolve({ numPages: 0, getPage: () => undefined as never }),
    }),
  };
}

afterEach(() => {
  delete window.pdfjsLib;
  delete (globalThis as { pdfjsWorker?: unknown }).pdfjsWorker;
  resetPdfJsLoaderForTests();
  vi.restoreAllMocks();
});

describe("extractFromPastedText", () => {
  it("succeeds with the text unmodified", () => {
    const result = extractFromPastedText("Nota clinica sintetica.");
    expect(result.status).toBe("success");
    expect(result.format).toBe("pasted-text");
    expect(result.sourceName).toBe("pasted text");
    if (result.status === "success") expect(result.text).toBe("Nota clinica sintetica.");
  });

  it("fails explicitly with empty-input for whitespace-only text", () => {
    const result = extractFromPastedText("  \n\t ");
    expect(result.status).toBe("failed");
    if (result.status === "failed") {
      expect(result.error.code).toBe("empty-input");
      expect(result.error.message).toMatch(/pasted text is empty/i);
    }
  });
});

describe("extractTxt", () => {
  it("extracts the TXT fixture with exact intended text", async () => {
    const result = await extractTxt(fixtureFile("sample-clinical-note.txt"));
    expect(result.status).toBe("success");
    expect(result.format).toBe("txt");
    expect(result.sourceName).toBe("sample-clinical-note.txt");
    if (result.status === "success") expect(result.text).toBe(EXPECTED_TXT + "\n");
    expect(result).toEqual(await extractTxt(fixtureFile("sample-clinical-note.txt")));
  });

  it("fails explicitly with empty-input for a whitespace-only TXT", async () => {
    const result = await extractTxt(new File(["  \n\t "], "empty.txt"));
    expect(result.status).toBe("failed");
    if (result.status === "failed") expect(result.error.code).toBe("empty-input");
  });
});

describe("extractDocx", () => {
  it("extracts the DOCX fixture through the real mammoth adapter", async () => {
    const result = await extractDocx(fixtureFile("sample-clinical-note.docx"));
    expect(result.status).toBe("success");
    expect(result.format).toBe("docx");
    if (result.status === "success") expect(result.text).toBe(EXPECTED_DOCX_RAW);
  });

  it("fails with typed extraction-failed for a corrupt DOCX", async () => {
    const result = await extractDocx(fixtureFile("corrupt.docx"));
    expect(result.status).toBe("failed");
    if (result.status === "failed") {
      expect(result.error.code).toBe("extraction-failed");
      expect(result.error.message).toMatch(/corrupt|not a valid/i);
    }
  });

  it("fails explicitly with empty-input for a DOCX without text content", async () => {
    // Minimal DOCX whose only paragraph has no text run content.
    const { default: JSZip } = await import("jszip");
    const zip = JSZip();
    zip.file(
      "[Content_Types].xml",
      '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
        '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">' +
        '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>' +
        '<Default Extension="xml" ContentType="application/xml"/>' +
        '<Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>' +
        "</Types>"
    );
    zip.file(
      "_rels/.rels",
      '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
        '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
        '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>' +
        "</Relationships>"
    );
    zip.file(
      "word/document.xml",
      '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
        '<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">' +
        "<w:body><w:p/></w:body></w:document>"
    );
    const generated = await zip.generateAsync({ type: "uint8array" });
    const bytes = new Uint8Array(generated);
    const result = await extractDocx(new File([bytes], "empty.docx"));
    expect(result.status).toBe("failed");
    if (result.status === "failed") expect(result.error.code).toBe("empty-input");
  });
});

describe("extractPdf", () => {
  it("extracts the text-bearing PDF fixture with exact intended text", async () => {
    await seedRealPdfJs();
    const result = await extractPdf(fixtureFile("sample-clinical-note.pdf"));
    expect(result.status).toBe("success");
    expect(result.format).toBe("pdf");
    if (result.status === "success") expect(result.text).toBe(EXPECTED_PDF);
  });

  it("reports pdf-no-text-layer for a valid PDF without text operators", async () => {
    await seedRealPdfJs();
    const result = await extractPdf(fixtureFile("sample-scanned.pdf"));
    expect(result.status).toBe("failed");
    if (result.status === "failed") {
      expect(result.error.code).toBe("pdf-no-text-layer");
      expect(result.error.message).toMatch(/no text layer|likely a scan/i);
    }
  });

  it("fails with typed extraction-failed for a corrupt PDF", async () => {
    await seedRealPdfJs();
    const result = await extractPdf(fixtureFile("corrupt.pdf"));
    expect(result.status).toBe("failed");
    if (result.status === "failed") expect(result.error.code).toBe("extraction-failed");
  });
});

describe("extractFile dispatcher", () => {
  it("routes by lowercase extension, case-insensitively", async () => {
    const result = await extractFile(
      new File([fixtureBytes("sample-clinical-note.txt")], "NOTE.TXT")
    );
    expect(result.status).toBe("success");
    expect(result.format).toBe("txt");
  });

  it("rejects legacy .doc with an explicit unsupported-format failure", async () => {
    const result = await extractFile(fixtureFile("sample-legacy.doc"));
    expect(result.status).toBe("failed");
    if (result.status === "failed") {
      expect(result.error.code).toBe("unsupported-format");
      expect(result.error.message).toMatch(/\.doc/);
    }
  });

  it("rejects unknown extensions and extension-less files", async () => {
    const unknown = await extractFile(
      new File([fixtureBytes("sample-clinical-note.txt")], "report.rtf")
    );
    const noExtension = await extractFile(
      new File([fixtureBytes("sample-clinical-note.txt")], "noext")
    );
    expect(unknown.status).toBe("failed");
    expect(noExtension.status).toBe("failed");
    if (unknown.status === "failed" && noExtension.status === "failed") {
      expect(unknown.error.code).toBe("unsupported-format");
      expect(noExtension.error.message).toMatch(/no extension/);
    }
  });
});

describe("pdf.js lazy loader", () => {
  function captureInjectedScript() {
    let injected: HTMLScriptElement | null = null;
    const appendSpy = vi.spyOn(document.head, "appendChild").mockImplementation((node: Node) => {
      injected = node as HTMLScriptElement;
      return node;
    });
    return {
      appendSpy,
      // Throws on access when nothing was injected: every test that reads
      // `script` asserts an injection happened, and the non-throwing type
      // keeps the assertions free of null-narrowing noise.
      get script(): HTMLScriptElement {
        if (injected === null) throw new Error("no script was injected");
        return injected;
      },
    };
  }

  it("injects one same-origin script tag on first use and resolves with the API", async () => {
    const capture = captureInjectedScript();
    const pending = loadPdfJs();
    expect(capture.script).not.toBeNull();
    expect(capture.script.src.endsWith(PDFJS_LIB_SRC)).toBe(true);
    window.pdfjsLib = fakePdfJsLib();
    capture.script.onload?.(new Event("load"));
    await expect(pending).resolves.toBe(window.pdfjsLib);
    expect(capture.appendSpy).toHaveBeenCalledTimes(1);
  });

  it("reuses a single pending load for concurrent callers", async () => {
    const capture = captureInjectedScript();
    const first = loadPdfJs();
    const second = loadPdfJs();
    expect(second).toBe(first);
    window.pdfjsLib = fakePdfJsLib();
    capture.script.onload?.(new Event("load"));
    await expect(first).resolves.toBe(window.pdfjsLib);
  });

  it("rejects when the vendored script fails to load and allows a retry", async () => {
    const capture = captureInjectedScript();
    const pending = loadPdfJs();
    capture.script.onerror?.(new Event("error"));
    await expect(pending).rejects.toThrow(/could not be loaded/);
    // The failed load must not poison the next attempt: a new script is injected.
    const retryCapture = captureInjectedScript();
    const retry = loadPdfJs();
    expect(retryCapture.script).not.toBeNull();
    window.pdfjsLib = fakePdfJsLib();
    retryCapture.script.onload?.(new Event("load"));
    await expect(retry).resolves.toBe(window.pdfjsLib);
  });

  it("rejects when the script loads but the API is not exposed", async () => {
    const capture = captureInjectedScript();
    const pending = loadPdfJs();
    capture.script.onload?.(new Event("load"));
    await expect(pending).rejects.toThrow(/pdfjsLib is unavailable/);
  });

  it("does not inject any script when the API is already present", async () => {
    window.pdfjsLib = fakePdfJsLib();
    const { appendSpy } = captureInjectedScript();
    await expect(loadPdfJs()).resolves.toBe(window.pdfjsLib);
    expect(appendSpy).not.toHaveBeenCalled();
  });
});

describe("memory-only invariant during adapter extraction", () => {
  it("performs zero network attempts and zero storage writes across all fixture formats", async () => {
    await seedRealPdfJs();
    const monitor: NetworkMonitor = install(window);

    // Measure storage BEFORE spying: jsdom's Storage.length counts the spies'
    // own enumerable property definitions, which would distort the reading.
    expect(window.localStorage.length).toBe(0);
    expect(window.sessionStorage.length).toBe(0);
    const setItemSpies = [
      vi.spyOn(window.localStorage, "setItem"),
      vi.spyOn(window.sessionStorage, "setItem"),
    ];
    const removeItemSpies = [
      vi.spyOn(window.localStorage, "removeItem"),
      vi.spyOn(window.sessionStorage, "removeItem"),
    ];
    const clearSpies = [
      vi.spyOn(window.localStorage, "clear"),
      vi.spyOn(window.sessionStorage, "clear"),
    ];

    try {
      const results = await Promise.all([
        extractFromPastedText(EXPECTED_TXT),
        extractTxt(fixtureFile("sample-clinical-note.txt")),
        extractDocx(fixtureFile("sample-clinical-note.docx")),
        extractPdf(fixtureFile("sample-clinical-note.pdf")),
        extractPdf(fixtureFile("sample-scanned.pdf")),
        extractFile(fixtureFile("sample-legacy.doc")),
      ]);

      expect(
        results.every((result) => result.status === "success" || result.status === "failed")
      ).toBe(true);
      expect(monitor.attempts()).toEqual([]);
      for (const spy of [...setItemSpies, ...removeItemSpies, ...clearSpies]) {
        expect(spy).not.toHaveBeenCalled();
      }
      // jsdom exposes no IndexedDB at all; if a runtime ever provides one,
      // this assertion fails loudly so the invariant must be re-proven.
      expect(window.indexedDB).toBeUndefined();
    } finally {
      monitor.uninstall();
    }
  });
});
