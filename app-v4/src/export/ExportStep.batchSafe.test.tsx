/**
 * Writer-phase UI witness for the REC-07 #88 batch Safe deliverables.
 *
 * Proves, through the REAL rendered batch Result with bridge-shaped session
 * sets (no uncommitted seams stubbed except the controlled async gates):
 *  - the human Result hierarchy (one primary ZIP, secondary consolidated PDF
 *    + CSV, perceptible pending/success/failure feedback, still-disabled
 *    separate Confidential zone);
 *  - blocked / needs-attention states expose NO Safe artifact;
 *  - all-or-nothing refusal per affected action with zero download;
 *  - the no-leak adversary end to end (sentinels absent from downloaded
 *    entry names and PDF content);
 *  - the async/current-authority witness (suspended generation + invalidated
 *    authority, and separately unmount → zero download, no false success).
 *
 * Content is read back from the REAL downloaded blobs (ZIP entries via
 * `jszip`, PDF text via the legacy pdf.js seam). All fixtures are synthetic.
 */
import JSZip from "jszip";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import "@testing-library/jest-dom/vitest";

import { ExportStep } from "./ExportStep";
import {
  BATCH_SAFE_CONSOLIDATED_PDF_FILENAME,
  BATCH_SAFE_ZIP_FILENAME,
  type BatchSafeDocument,
} from "./batchSafeDeliverables";
import { applyDecision, createReviewSession, type ReviewSession } from "../review/review-domain";
import {
  batchReviewComplete,
  beginItemProcessing,
  beginItemRead,
  createJob,
  recordItemProcessed,
  recordItemRead,
  recordItemReviewCompletion,
  removeBatchItem,
  withReviewState,
  type Job,
} from "../domain/job";

// ---------------------------------------------------------------------------
// Controlled gates for the awaited batch Safe generation windows. When unset
// the REAL builders run; when set, the generation suspends until the test
// releases it (stale-authority and unmount witnesses).
// ---------------------------------------------------------------------------

const zipGate = vi.hoisted(() => ({
  suspend: null as null | (() => Promise<Uint8Array>),
}));
const consolidatedGate = vi.hoisted(() => ({
  suspend: null as null | (() => Promise<Uint8Array>),
}));

vi.mock("./batchSafeDeliverables", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./batchSafeDeliverables")>();
  return {
    ...actual,
    buildBatchSafeZipBytes: (documents: readonly BatchSafeDocument[]) =>
      zipGate.suspend ? zipGate.suspend() : actual.buildBatchSafeZipBytes(documents),
    buildBatchConsolidatedPdfBytes: (documents: readonly BatchSafeDocument[]) =>
      consolidatedGate.suspend
        ? consolidatedGate.suspend()
        : actual.buildBatchConsolidatedPdfBytes(documents),
  };
});

// ---------------------------------------------------------------------------
// pdf.js read-back (same seam as pdf-builder.test.ts)
// ---------------------------------------------------------------------------

interface PdfTextItem {
  str: string;
}
interface PdfPage {
  getTextContent(): Promise<{ items: PdfTextItem[] }>;
}
interface PdfDocument {
  numPages: number;
  getPage(index: number): Promise<PdfPage>;
}
interface PdfJsApi {
  getDocument(params: { data: Uint8Array; isEvalSupported: boolean }): {
    promise: Promise<PdfDocument>;
  };
}

let pdfjs: PdfJsApi;

beforeAll(async () => {
  const [lib, worker] = await Promise.all([
    import("pdfjs-dist/legacy/build/pdf.js"),
    import("pdfjs-dist/legacy/build/pdf.worker.js"),
  ]);
  (globalThis as { pdfjsWorker?: unknown }).pdfjsWorker = worker;
  pdfjs = lib as unknown as PdfJsApi;
});

afterAll(() => {
  delete (globalThis as { pdfjsWorker?: unknown }).pdfjsWorker;
});

async function extractPdfText(bytes: Uint8Array): Promise<string> {
  const doc = await pdfjs.getDocument({ data: bytes, isEvalSupported: false }).promise;
  const pages: string[] = [];
  for (let index = 1; index <= doc.numPages; index++) {
    const page = await doc.getPage(index);
    const content = await page.getTextContent();
    pages.push(content.items.map((item) => item.str).join(" "));
  }
  return pages.join("\n");
}

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

function buildBatchJob(names: readonly string[]): Job {
  return createJob({
    type: "files",
    files: names.map((name) => ({ name, extension: "txt" })),
  });
}

function completeItem(job: Job, index: number, text: string): Job {
  const read = recordItemRead(beginItemRead(job, index), index, {
    ok: true,
    extractedText: text,
  });
  const processed = recordItemProcessed(beginItemProcessing(read, index), index);
  return recordItemReviewCompletion(processed, index, true);
}

function derivedBatch(job: Job): Job {
  return withReviewState(job, { complete: batchReviewComplete(job) });
}

function plainSession(text: string, id: string): ReviewSession {
  return createReviewSession({ originalText: text, detections: [], sessionId: id });
}

function readyTwo(): { job: Job; sessions: Record<number, ReviewSession> } {
  let job = buildBatchJob(["informe-a.txt", "informe-b.txt"]);
  job = completeItem(job, 0, "Contenido sintético A.");
  job = completeItem(job, 1, "Contenido sintético B.");
  return {
    job: derivedBatch(job),
    sessions: {
      0: plainSession("Contenido sintético A.", "ui-0"),
      1: plainSession("Contenido sintético B.", "ui-1"),
    },
  };
}

function pendingBatchJob(): Job {
  let job = buildBatchJob(["informe-a.txt", "informe-b.txt"]);
  job = recordItemRead(beginItemRead(job, 0), 0, {
    ok: true,
    extractedText: "Contenido sintético A.",
  });
  job = recordItemRead(beginItemRead(job, 1), 1, {
    ok: true,
    extractedText: "Contenido sintético B.",
  });
  return derivedBatch(job);
}

function failedBatchJob(): Job {
  let job = buildBatchJob(["informe-a.txt", "informe-b.txt"]);
  job = recordItemRead(beginItemRead(job, 0), 0, {
    ok: false,
    error: { code: "pdf-no-text-layer", message: "El PDF no tiene capa de texto." },
  });
  job = completeItem(job, 1, "Contenido sintético B.");
  return derivedBatch(job);
}

// ---------------------------------------------------------------------------
// Download capture (same Blob/object-URL seam as the existing ExportStep tests)
// ---------------------------------------------------------------------------

type CapturedDownload = { readonly fileName: string; readonly blob: Blob };

function captureDownloads(): { readonly downloads: CapturedDownload[]; restore(): void } {
  const downloads: CapturedDownload[] = [];
  const blobs: Blob[] = [];
  const urls: string[] = [];
  const originalCreate = URL.createObjectURL;
  const originalRevoke = URL.revokeObjectURL;
  const originalClick = HTMLAnchorElement.prototype.click;
  URL.createObjectURL = vi.fn((blob: Blob) => {
    blobs.push(blob);
    urls.push(`blob:mock-${blobs.length}`);
    return urls[urls.length - 1];
  }) as typeof URL.createObjectURL;
  URL.revokeObjectURL = vi.fn() as typeof URL.revokeObjectURL;
  HTMLAnchorElement.prototype.click = vi.fn(function (this: HTMLAnchorElement) {
    const match = /blob:mock-(\d+)/.exec(this.getAttribute("href") ?? "");
    const index = match ? Number(match[1]) - 1 : -1;
    downloads.push({ fileName: this.getAttribute("download") ?? "", blob: blobs[index] });
  }) as typeof HTMLAnchorElement.prototype.click;
  return {
    downloads,
    restore: () => {
      URL.createObjectURL = originalCreate;
      URL.revokeObjectURL = originalRevoke;
      HTMLAnchorElement.prototype.click = originalClick;
    },
  };
}

/** jsdom's Blob lacks .arrayBuffer()/.text(); read the captured artifact via FileReader. */
async function blobBytes(download: CapturedDownload): Promise<Uint8Array> {
  const buffer = await new Promise<ArrayBuffer>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as ArrayBuffer);
    reader.onerror = () => reject(reader.error);
    reader.readAsArrayBuffer(download.blob);
  });
  return new Uint8Array(buffer);
}

async function blobText(download: CapturedDownload): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsText(download.blob);
  });
}

/** The batch Result action feedback node (the Confidential zone owns its own status notes). */
function actionFeedback(): HTMLElement | null {
  return document.getElementById("batch-result-action-feedback");
}

async function flushAsyncWork(): Promise<void> {
  await act(async () => {
    for (let i = 0; i < 25; i += 1) await Promise.resolve();
    await new Promise((resolve) => setTimeout(resolve, 0));
    for (let i = 0; i < 25; i += 1) await Promise.resolve();
  });
}

/**
 * Bounded deterministic drain for the REAL generation windows (JSZip chunked
 * assembly + pdf-lib builds schedule multiple macrotask ticks in jsdom, far
 * more than one `flushAsyncWork` covers). Polls until the condition holds or
 * the bound is hit — a timeout is an explicit failure, never a silent pass.
 */
async function flushUntilSettled(condition: () => boolean, limit = 300): Promise<void> {
  for (let i = 0; i < limit; i += 1) {
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
    if (condition()) return;
  }
  throw new Error("flushUntilSettled: condition not met within the bounded drain");
}

afterEach(() => {
  zipGate.suspend = null;
  consolidatedGate.suspend = null;
  cleanup();
  vi.restoreAllMocks();
});

const RESULT_STATE = (state: string): HTMLElement | null =>
  document.querySelector(`[data-result-state="${state}"]`);

describe("ready Result hierarchy: one primary ZIP, secondary consolidated + CSV", () => {
  it("downloads the ZIP of ordinal Safe PDFs with perceptible pending/success feedback", async () => {
    const { job, sessions } = readyTwo();
    const captured = captureDownloads();
    try {
      render(<ExportStep job={job} review={null} batchSessions={sessions} />);
      expect(RESULT_STATE("ready")).not.toBeNull();

      // Exactly one primary action: the ZIP.
      const primary = document.querySelectorAll('[data-variant="primary"]');
      expect(primary).toHaveLength(1);
      expect(primary[0]).toHaveTextContent("Descargar documentos seguros (.zip)");

      // Secondary formats stay discoverable without equal-weight chrome.
      const group = screen.getByRole("group", { name: "Otros formatos del lote" });
      expect(group).toBeInTheDocument();
      expect(
        screen.getByRole("button", { name: "Descargar PDF consolidado del lote (.pdf)" })
      ).toBeInTheDocument();
      expect(
        screen.getByRole("button", { name: "Descargar resumen seguro (.csv)" })
      ).toBeInTheDocument();

      fireEvent.click(screen.getByRole("button", { name: "Descargar documentos seguros (.zip)" }));
      expect(actionFeedback()).toHaveTextContent("Preparando el archivo ZIP");
      await flushUntilSettled(() => captured.downloads.length === 1);

      expect(captured.downloads).toHaveLength(1);
      expect(captured.downloads[0].fileName).toBe(BATCH_SAFE_ZIP_FILENAME);
      const zip = await JSZip.loadAsync(await blobBytes(captured.downloads[0]));
      expect(Object.keys(zip.files).sort()).toEqual([
        "documento-seguro-01.pdf",
        "documento-seguro-02.pdf",
      ]);
      expect(
        await extractPdfText(await zip.files["documento-seguro-01.pdf"].async("uint8array"))
      ).toContain("Contenido sintético A.");

      const feedback = actionFeedback();
      expect(feedback).not.toBeNull();
      expect(feedback).toHaveAttribute("data-batch-safe-action", "zip");
      expect(feedback).toHaveTextContent("Descarga del ZIP con los documentos seguros iniciada.");
    } finally {
      captured.restore();
    }
  });

  it("downloads the consolidated PDF and keeps the CSV manifest intact", async () => {
    const { job, sessions } = readyTwo();
    const captured = captureDownloads();
    try {
      render(<ExportStep job={job} review={null} batchSessions={sessions} />);

      fireEvent.click(
        screen.getByRole("button", { name: "Descargar PDF consolidado del lote (.pdf)" })
      );
      await flushUntilSettled(() => captured.downloads.length === 1);
      expect(captured.downloads).toHaveLength(1);
      expect(captured.downloads[0].fileName).toBe(BATCH_SAFE_CONSOLIDATED_PDF_FILENAME);
      const text = await extractPdfText(await blobBytes(captured.downloads[0]));
      expect(text).toContain("Documento 1");
      expect(text).toContain("Documento 2");
      expect(text).toContain("Contenido sintético A.");
      expect(actionFeedback()).toHaveTextContent("Descarga del PDF consolidado del lote iniciada.");

      fireEvent.click(screen.getByRole("button", { name: "Descargar resumen seguro (.csv)" }));
      expect(captured.downloads).toHaveLength(2);
      expect(captured.downloads[1].fileName).toBe("resumen-lote-seguro.csv");
      await expect(blobText(captured.downloads[1])).resolves.toBe(
        ["indice_lote,estado,disposicion", "1,completado,", "2,completado,"].join("\n")
      );
    } finally {
      captured.restore();
    }
  });

  it("keeps the Confidential zone separate and disabled", () => {
    const { job, sessions } = readyTwo();
    render(<ExportStep job={job} review={null} batchSessions={sessions} />);
    expect(screen.getByRole("heading", { name: "Auditoría confidencial" })).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Descargar auditoría confidencial (.txt)" })
    ).toBeDisabled();
  });

  it("disables the per-document actions when the session set is unavailable (CSV unaffected)", async () => {
    const { job } = readyTwo();
    const captured = captureDownloads();
    try {
      render(<ExportStep job={job} review={null} />);
      expect(RESULT_STATE("ready")).not.toBeNull();
      expect(
        screen.getByRole("button", { name: "Descargar documentos seguros (.zip)" })
      ).toBeDisabled();
      expect(
        screen.getByRole("button", { name: "Descargar PDF consolidado del lote (.pdf)" })
      ).toBeDisabled();
      fireEvent.click(screen.getByRole("button", { name: "Descargar resumen seguro (.csv)" }));
      expect(captured.downloads).toHaveLength(1);
    } finally {
      captured.restore();
    }
  });
});

describe("non-ready Result: blocked/needs-attention expose no Safe artifact", () => {
  it("blocked renders no per-document Safe action and downloads nothing", () => {
    const captured = captureDownloads();
    try {
      render(<ExportStep job={failedBatchJob()} review={null} />);
      expect(RESULT_STATE("blocked")).not.toBeNull();
      expect(
        screen.queryByRole("button", { name: "Descargar documentos seguros (.zip)" })
      ).not.toBeInTheDocument();
      expect(
        screen.queryByRole("button", { name: "Descargar PDF consolidado del lote (.pdf)" })
      ).not.toBeInTheDocument();
      expect(
        screen.getByRole("button", { name: "Descargar resumen seguro (.csv)" })
      ).toBeDisabled();
      expect(captured.downloads).toHaveLength(0);
    } finally {
      captured.restore();
    }
  });

  it("needs-attention renders no per-document Safe action and downloads nothing", () => {
    const captured = captureDownloads();
    try {
      render(<ExportStep job={pendingBatchJob()} review={null} />);
      expect(RESULT_STATE("needs-attention")).not.toBeNull();
      expect(
        screen.queryByRole("button", { name: "Descargar documentos seguros (.zip)" })
      ).not.toBeInTheDocument();
      expect(
        screen.queryByRole("button", { name: "Descargar PDF consolidado del lote (.pdf)" })
      ).not.toBeInTheDocument();
      expect(
        screen.getByRole("button", { name: "Descargar resumen seguro (.csv)" })
      ).toBeDisabled();
      expect(captured.downloads).toHaveLength(0);
    } finally {
      captured.restore();
    }
  });
});

describe("all-or-nothing refusal per action (planted PDF-unrepresentable character)", () => {
  function unrepresentable(): { job: Job; sessions: Record<number, ReviewSession> } {
    let job = buildBatchJob(["ok.txt", "griego.txt"]);
    job = completeItem(job, 0, "Contenido sintético A.");
    job = completeItem(job, 1, "Dosis de prueba con alfa.");
    return {
      job: derivedBatch(job),
      sessions: {
        0: plainSession("Contenido sintético A.", "refusal-0"),
        1: plainSession("Dosis de prueba α 10 mg.", "refusal-1"),
      },
    };
  }

  it("the ZIP refuses with zero download and a non-PHI failure", async () => {
    const { job, sessions } = unrepresentable();
    const captured = captureDownloads();
    try {
      render(<ExportStep job={job} review={null} batchSessions={sessions} />);
      fireEvent.click(screen.getByRole("button", { name: "Descargar documentos seguros (.zip)" }));
      await flushAsyncWork();

      expect(captured.downloads).toHaveLength(0);
      const feedback = actionFeedback();
      expect(feedback).not.toBeNull();
      expect(feedback).toHaveAttribute("role", "alert");
      expect(feedback).toHaveTextContent("No se pudieron generar los documentos seguros del lote.");
      expect(document.body.textContent).not.toContain("α");
    } finally {
      captured.restore();
    }
  });

  it("the consolidated PDF refuses with zero download and a non-PHI failure", async () => {
    const { job, sessions } = unrepresentable();
    const captured = captureDownloads();
    try {
      render(<ExportStep job={job} review={null} batchSessions={sessions} />);
      fireEvent.click(
        screen.getByRole("button", { name: "Descargar PDF consolidado del lote (.pdf)" })
      );
      await flushAsyncWork();

      expect(captured.downloads).toHaveLength(0);
      expect(actionFeedback()).toHaveTextContent("No se pudo generar el PDF consolidado del lote.");
      expect(document.body.textContent).not.toContain("α");
    } finally {
      captured.restore();
    }
  });
});

describe("no-leak adversary through the downloaded artifacts", () => {
  const FILENAME_SENTINEL = "DNI-99999111-SENTINEL-informe.txt";
  const ELIMINATED_SENTINEL = "DATO-ORIGEN-SENTINEL-ELIMINADO";
  const NOTE_SENTINEL = "NOTA-REVISION-SENTINEL-XYZ";
  const CONFIDENTIAL_SENTINEL = "600999888";

  function adversarial(): { job: Job; sessions: Record<number, ReviewSession> } {
    const source = `Informe sintético. ${ELIMINATED_SENTINEL} debe desaparecer. Teléfono ${CONFIDENTIAL_SENTINEL}.`;
    const eliminatedStart = source.indexOf(ELIMINATED_SENTINEL);
    const phoneStart = source.indexOf(CONFIDENTIAL_SENTINEL);
    const raw = createReviewSession({
      originalText: source,
      detections: [
        {
          type: "IDENTIFICADOR",
          start: eliminatedStart,
          end: eliminatedStart + ELIMINATED_SENTINEL.length,
          confidence: 0.9,
          proposed: "DATO-SUSTITUTO",
          note: NOTE_SENTINEL,
          requiresReview: true,
        },
        {
          type: "IDENTIFICADOR",
          start: phoneStart,
          end: phoneStart + CONFIDENTIAL_SENTINEL.length,
          confidence: 0.9,
          proposed: "TEL-1",
          requiresReview: true,
        },
      ],
      sessionId: "ui-adversarial-0",
    });
    let session0 = applyDecision(raw, raw.detections[0].id, "accepted");
    session0 = applyDecision(session0, raw.detections[1].id, "accepted");
    let job = buildBatchJob([FILENAME_SENTINEL, "informe-b.txt"]);
    job = completeItem(job, 0, source);
    job = completeItem(job, 1, "Segundo documento sintético sin marcas.");
    return {
      job: derivedBatch(job),
      sessions: {
        0: session0,
        1: plainSession("Segundo documento sintético sin marcas.", "ui-adversarial-1"),
      },
    };
  }

  it("the ZIP exposes neither source names nor non-surviving content", async () => {
    const { job, sessions } = adversarial();
    const captured = captureDownloads();
    try {
      render(<ExportStep job={job} review={null} batchSessions={sessions} />);
      fireEvent.click(screen.getByRole("button", { name: "Descargar documentos seguros (.zip)" }));
      await flushUntilSettled(() => captured.downloads.length === 1);

      expect(captured.downloads).toHaveLength(1);
      const zip = await JSZip.loadAsync(await blobBytes(captured.downloads[0]));
      const names = Object.keys(zip.files);
      expect(names.sort()).toEqual(["documento-seguro-01.pdf", "documento-seguro-02.pdf"]);
      for (const name of names) {
        const text = await extractPdfText(await zip.files[name].async("uint8array"));
        for (const sentinel of [
          FILENAME_SENTINEL,
          "DNI-99999111-SENTINEL",
          ELIMINATED_SENTINEL,
          NOTE_SENTINEL,
          CONFIDENTIAL_SENTINEL,
        ]) {
          expect(text).not.toContain(sentinel);
        }
      }
    } finally {
      captured.restore();
    }
  });

  it("the consolidated PDF index exposes neither source names nor non-surviving content", async () => {
    const { job, sessions } = adversarial();
    const captured = captureDownloads();
    try {
      render(<ExportStep job={job} review={null} batchSessions={sessions} />);
      fireEvent.click(
        screen.getByRole("button", { name: "Descargar PDF consolidado del lote (.pdf)" })
      );
      await flushUntilSettled(() => captured.downloads.length === 1);

      expect(captured.downloads).toHaveLength(1);
      const text = await extractPdfText(await blobBytes(captured.downloads[0]));
      expect(text).toContain("Documento 1");
      for (const sentinel of [
        FILENAME_SENTINEL,
        "DNI-99999111-SENTINEL",
        ELIMINATED_SENTINEL,
        NOTE_SENTINEL,
        CONFIDENTIAL_SENTINEL,
      ]) {
        expect(text).not.toContain(sentinel);
      }
    } finally {
      captured.restore();
    }
  });
});

describe("async/current-authority witness: stale completion and unmount download nothing", () => {
  it("a Job replacement during the awaited ZIP generation produces zero download and no false success", async () => {
    const { job, sessions } = readyTwo();
    // A DIFFERENT ready job: the surface stays ready, so the stale failure
    // must surface truthfully instead of being masked by a state change.
    let other = buildBatchJob(["otro-a.txt", "otro-b.txt"]);
    other = completeItem(other, 0, "Contenido sintético A.");
    other = completeItem(other, 1, "Contenido sintético B.");
    const otherReady = derivedBatch(other);
    expect(otherReady.id).not.toBe(job.id);
    const captured = captureDownloads();
    let resolveGeneration!: (bytes: Uint8Array) => void;
    zipGate.suspend = () =>
      new Promise<Uint8Array>((resolve) => {
        resolveGeneration = resolve;
      });
    const view = render(<ExportStep job={job} review={null} batchSessions={sessions} />);
    try {
      fireEvent.click(screen.getByRole("button", { name: "Descargar documentos seguros (.zip)" }));
      expect(actionFeedback()).toHaveTextContent("Preparando el archivo ZIP");

      // The Job is replaced while generation is awaited: the captured
      // authority (old job reference) is stale when generation completes.
      view.rerender(<ExportStep job={otherReady} review={null} batchSessions={sessions} />);
      resolveGeneration(new Uint8Array([1, 2, 3]));
      await flushUntilSettled(
        () => actionFeedback()?.textContent === "La revisión cambió; no se descargó ningún archivo."
      );

      expect(captured.downloads).toHaveLength(0);
      expect(actionFeedback()).toHaveTextContent(
        "La revisión cambió; no se descargó ningún archivo."
      );
    } finally {
      captured.restore();
    }
  });

  it("unmount during the awaited ZIP generation produces zero download", async () => {
    const { job, sessions } = readyTwo();
    const captured = captureDownloads();
    let resolveGeneration!: (bytes: Uint8Array) => void;
    zipGate.suspend = () =>
      new Promise<Uint8Array>((resolve) => {
        resolveGeneration = resolve;
      });
    const view = render(<ExportStep job={job} review={null} batchSessions={sessions} />);
    try {
      fireEvent.click(screen.getByRole("button", { name: "Descargar documentos seguros (.zip)" }));
      view.unmount();
      resolveGeneration(new Uint8Array([1, 2, 3]));
      await flushAsyncWork();

      expect(captured.downloads).toHaveLength(0);
    } finally {
      captured.restore();
    }
  });

  it("unmount during the awaited consolidated generation produces zero download", async () => {
    const { job, sessions } = readyTwo();
    const captured = captureDownloads();
    let resolveGeneration!: (bytes: Uint8Array) => void;
    consolidatedGate.suspend = () =>
      new Promise<Uint8Array>((resolve) => {
        resolveGeneration = resolve;
      });
    const view = render(<ExportStep job={job} review={null} batchSessions={sessions} />);
    try {
      fireEvent.click(
        screen.getByRole("button", { name: "Descargar PDF consolidado del lote (.pdf)" })
      );
      view.unmount();
      resolveGeneration(new Uint8Array([1, 2, 3]));
      await flushAsyncWork();

      expect(captured.downloads).toHaveLength(0);
    } finally {
      captured.restore();
    }
  });
});

describe("removed-item Result: ZIP holds only completed bodies, CSV keeps the history", () => {
  it("a ready batch with a removal downloads one ordinal entry and the unchanged manifest", async () => {
    let job = buildBatchJob(["falla.txt", "ok.txt"]);
    job = recordItemRead(beginItemRead(job, 0), 0, {
      ok: false,
      error: { code: "pdf-no-text-layer", message: "El PDF no tiene capa de texto." },
    });
    job = completeItem(job, 1, "Contenido sintético B.");
    job = derivedBatch(removeBatchItem(job, 0));
    const sessions = { 1: plainSession("Contenido sintético B.", "removed-ui-1") };

    const captured = captureDownloads();
    try {
      render(<ExportStep job={job} review={null} batchSessions={sessions} />);
      expect(RESULT_STATE("ready")).not.toBeNull();

      fireEvent.click(screen.getByRole("button", { name: "Descargar documentos seguros (.zip)" }));
      await flushUntilSettled(() => captured.downloads.length === 1);
      expect(captured.downloads).toHaveLength(1);
      const zip = await JSZip.loadAsync(await blobBytes(captured.downloads[0]));
      expect(Object.keys(zip.files)).toEqual(["documento-seguro-02.pdf"]);

      fireEvent.click(screen.getByRole("button", { name: "Descargar resumen seguro (.csv)" }));
      expect(captured.downloads).toHaveLength(2);
      await expect(blobText(captured.downloads[1])).resolves.toBe(
        ["indice_lote,estado,disposicion", "1,error,retirado", "2,completado,"].join("\n")
      );
    } finally {
      captured.restore();
    }
  });
});
