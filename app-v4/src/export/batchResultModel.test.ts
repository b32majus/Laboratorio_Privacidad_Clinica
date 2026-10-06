/**
 * Unit oracle for the REC-07 (#87) batch Result model + Safe summary CSV.
 *
 * Proves the three Result states reuse the existing batch authorities
 * (`deriveBatchFacts` / `batchReviewComplete` / `batchActiveFailedItems` —
 * never a second state machine), that the manifest accounts for every
 * original selection index in order with stable bytes, that the serializer
 * is fail-closed (an active failed/pending batch yields zero bytes via a
 * typed throw, never partial content), and that no source filename, source
 * text, mapping, reviewer note or error detail leaks into the Safe CSV.
 * Synthetic/no-PHI data only.
 */
import { describe, expect, it } from "vitest";

import {
  batchReviewComplete,
  beginItemProcessing,
  beginItemRead,
  createJob,
  recordItemFailed,
  recordItemProcessed,
  recordItemRead,
  recordItemReviewCompletion,
  removeBatchItem,
  withReviewState,
  type Job,
} from "../domain/job";
import {
  BATCH_SUMMARY_CSV_FILENAME,
  BATCH_SUMMARY_CSV_HEADER,
  BatchSummaryError,
  deriveBatchResultView,
  serializeBatchSummaryCsv,
} from "./batchResultModel";

function batchJob(names: readonly string[]): Job {
  return createJob({
    type: "files",
    files: names.map((name) => ({ name, extension: "txt" })),
  });
}

function readOk(job: Job, index: number, text: string): Job {
  return recordItemRead(beginItemRead(job, index), index, { ok: true, extractedText: text });
}

function readFail(job: Job, index: number, code: string, message: string): Job {
  return recordItemRead(beginItemRead(job, index), index, {
    ok: false,
    error: { code, message },
  });
}

function completeItem(job: Job, index: number, text: string): Job {
  const processed = recordItemProcessed(
    beginItemProcessing(readOk(job, index, text), index),
    index
  );
  return recordItemReviewCompletion(processed, index, true);
}

/** Mirror the bridge: review completeness derives from the batch authority. */
function derived(job: Job): Job {
  return withReviewState(job, { complete: batchReviewComplete(job) });
}

describe("deriveBatchResultView", () => {
  it("is blocked while an active failed item exists and names it factually", () => {
    const failed = readFail(
      batchJob(["bueno.txt", "roto.pdf"]),
      1,
      "pdf-no-text-layer",
      "No layer."
    );
    const view = deriveBatchResultView(derived(failed));
    expect(view.state).toBe("blocked");
    expect(view.activeFailedCount).toBe(1);
    expect(view.failedNames).toEqual(["roto.pdf"]);
    expect(view.blockedMessage).toContain("1 documento");
    expect(view.blockedMessage).not.toMatch(/privacy gate/i);
  });

  it("is needs-attention while review-required work remains and no failure is active", () => {
    const pending = readOk(batchJob(["a.txt", "b.txt"]), 0, "Contenido sintetico A.");
    const view = deriveBatchResultView(derived(pending));
    expect(view.state).toBe("needs-attention");
    expect(view.pendingCount).toBe(2);
    expect(view.attentionMessage).toContain("2 documentos");
    expect(view.attentionMessage).not.toMatch(/privacy gate/i);
  });

  it("is ready only when every non-removed item is complete and no failure is active", () => {
    let job = completeItem(batchJob(["a.txt", "b.txt"]), 0, "Contenido sintetico A.");
    job = completeItem(job, 1, "Contenido sintetico B.");
    const view = deriveBatchResultView(derived(job));
    expect(view.state).toBe("ready");
    expect(view.pendingCount).toBe(0);
    expect(view.activeFailedCount).toBe(0);
    expect(view.attentionMessage).toBeNull();
    expect(view.blockedMessage).toBeNull();
  });

  it("becomes ready after an accepted removal while keeping the removed item as error history", () => {
    let job = readFail(batchJob(["a.txt", "roto.pdf"]), 1, "pdf-no-text-layer", "No layer.");
    job = completeItem(job, 0, "Contenido sintetico A.");
    job = removeBatchItem(job, 1);
    const view = deriveBatchResultView(derived(job));
    expect(view.state).toBe("ready");
    expect(view.failedCount).toBe(1);
    expect(view.removedCount).toBe(1);
    expect(view.activeFailedCount).toBe(0);
    // A removed item is disposed history, never a still-blocking failure name.
    expect(view.failedNames).toEqual([]);
  });

  it("is needs-attention (never ready, never blocked) when every failure was removed but nothing completed", () => {
    let job = readFail(batchJob(["a.pdf", "b.pdf"]), 0, "pdf-no-text-layer", "No layer.");
    job = readFail(job, 1, "pdf-no-text-layer", "No layer.");
    job = removeBatchItem(job, 0);
    job = removeBatchItem(job, 1);
    const view = deriveBatchResultView(derived(job));
    expect(view.state).toBe("needs-attention");
    expect(view.activeFailedCount).toBe(0);
    expect(view.attentionMessage).not.toBeNull();
  });

  it("refuses a non-batch job fail-closed", () => {
    const text = createJob({ type: "pasted-text", text: "Texto sintetico." });
    // The batch boundary is owned by `deriveBatchFacts`, which throws a plain
    // Error (not the serializer-only BatchSummaryError) naming the
    // incompatible job kind. Pin the class and message so this oracle can
    // disagree with an implementation that stops refusing non-batch jobs.
    let thrown: unknown;
    try {
      deriveBatchResultView(text);
    } catch (error) {
      thrown = error;
    }
    expect(thrown).toBeInstanceOf(Error);
    expect(thrown).not.toBeInstanceOf(BatchSummaryError);
    expect((thrown as Error).message).toMatch(
      /^deriveBatchFacts requires a document-batch job; .* is kind "text"\.$/
    );
  });
});

describe("serializeBatchSummaryCsv", () => {
  it("emits the deterministic Spanish manifest for a ready batch", () => {
    let job = completeItem(batchJob(["a.txt", "b.txt", "c.txt"]), 0, "Texto A.");
    job = completeItem(job, 1, "Texto B.");
    job = completeItem(job, 2, "Texto C.");
    const csv = serializeBatchSummaryCsv(derived(job));
    expect(csv).toBe(
      ["indice_lote,estado,disposicion", "1,completado,", "2,completado,", "3,completado,"].join(
        "\n"
      )
    );
  });

  it("keeps the deliberately removed original index as estado=error, disposicion=retirado in order", () => {
    let job = readFail(
      batchJob(["a.txt", "roto.pdf", "c.txt"]),
      1,
      "pdf-no-text-layer",
      "No layer."
    );
    job = completeItem(job, 0, "Texto A.");
    job = completeItem(job, 2, "Texto C.");
    job = removeBatchItem(job, 1);
    expect(deriveBatchResultView(derived(job)).state).toBe("ready");
    const csv = serializeBatchSummaryCsv(derived(job));
    expect(csv).toBe(
      ["indice_lote,estado,disposicion", "1,completado,", "2,error,retirado", "3,completado,"].join(
        "\n"
      )
    );
  });

  it("produces stable bytes for the same authoritative batch state", () => {
    const build = (): Job => {
      let job = readFail(batchJob(["a.txt", "roto.pdf"]), 1, "pdf-no-text-layer", "No layer.");
      job = completeItem(job, 0, "Texto A.");
      return derived(removeBatchItem(job, 1));
    };
    expect(serializeBatchSummaryCsv(build())).toBe(serializeBatchSummaryCsv(build()));
    expect(BATCH_SUMMARY_CSV_HEADER).toBe("indice_lote,estado,disposicion");
    expect(BATCH_SUMMARY_CSV_FILENAME).toBe("resumen-lote-seguro.csv");
  });

  it("refuses an active failed batch with zero bytes (typed throw, no partial content)", () => {
    const failed = readFail(batchJob(["a.txt", "roto.pdf"]), 1, "pdf-no-text-layer", "No layer.");
    expect(() => serializeBatchSummaryCsv(derived(failed))).toThrowError(BatchSummaryError);
  });

  it("refuses a pending batch with zero bytes", () => {
    const pending = readOk(batchJob(["a.txt", "b.txt"]), 0, "Texto A.");
    expect(() => serializeBatchSummaryCsv(derived(pending))).toThrowError(BatchSummaryError);
  });

  it("refuses a processing failure recorded after a successful read", () => {
    let job = readOk(batchJob(["a.txt", "b.txt"]), 0, "Texto A.");
    job = recordItemFailed(beginItemProcessing(job, 0), 0, {
      code: "processing-failed",
      message: "Engine failure.",
    });
    expect(() => serializeBatchSummaryCsv(derived(job))).toThrowError(BatchSummaryError);
  });

  it("never leaks filenames, source text, mapping, notes or error detail (adversarial witness)", () => {
    const sentinelFilename = "DNI-99999111-SENTINEL-informe.txt";
    const sentinelText = "TEXTO-FUENTE-SENTINEL-ABC paciente 99999111";
    const sentinelError = "ERROR-SENTINEL-XYZ sin capa de texto para 99999111";
    let job = readFail(
      batchJob(["otra.txt", sentinelFilename]),
      1,
      "pdf-no-text-layer",
      sentinelError
    );
    job = completeItem(job, 0, sentinelText);
    job = removeBatchItem(job, 1);
    const ready = derived(job);
    expect(deriveBatchResultView(ready).state).toBe("ready");
    const csv = serializeBatchSummaryCsv(ready);
    expect(csv).not.toContain(sentinelFilename);
    expect(csv).not.toContain("DNI-99999111-SENTINEL");
    expect(csv).not.toContain(sentinelText);
    expect(csv).not.toContain(sentinelError);
    expect(csv).not.toContain("99999111");
    // The manifest still accounts for every original index exactly once.
    expect(csv).toBe(
      ["indice_lote,estado,disposicion", "1,completado,", "2,error,retirado"].join("\n")
    );
  });
});
