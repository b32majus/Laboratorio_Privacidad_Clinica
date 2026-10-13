/**
 * Focused witness for the fail-closed batch Safe-summary download path
 * (REC-07 #87). When the serializer refuses a nominally-ready batch the
 * handler must download ZERO bytes, keep the truthful Spanish message and
 * preserve a content-free diagnostic (the typed code only) — never the raw
 * error message, which may name a source file.
 *
 * `serializeBatchSummaryCsv` is the ONLY mocked member: the real
 * `deriveBatchResultView` still decides readiness, so the refusal is a
 * genuine serializer failure rather than a fabricated state. All fixtures
 * are synthetic; no real content.
 */
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import "@testing-library/jest-dom/vitest";

import { ExportStep } from "./ExportStep";
import {
  batchReviewComplete,
  beginItemProcessing,
  beginItemRead,
  createJob,
  recordItemProcessed,
  recordItemRead,
  recordItemReviewCompletion,
  withReviewState,
  type Job,
} from "../domain/job";

// Minimal control: when set, the mocked serializer throws a plain unexpected
// Error (adversarial name/message) instead of the typed BatchSummaryError.
// Only the new unexpected-refusal witness sets it; afterEach resets it.
const summaryRefusal = vi.hoisted(() => ({
  unexpected: null as null | (() => Error),
}));

vi.mock("./batchResultModel", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./batchResultModel")>();
  return {
    ...actual,
    serializeBatchSummaryCsv: (): string => {
      if (summaryRefusal.unexpected !== null) throw summaryRefusal.unexpected();
      throw new actual.BatchSummaryError(
        'refuses batch item 1 ("DNI-99999111-SENTINEL-informe.txt"): not authorized'
      );
    },
  };
});

afterEach(() => {
  summaryRefusal.unexpected = null;
  cleanup();
  vi.restoreAllMocks();
});

function completeItem(job: Job, index: number, text: string): Job {
  const read = recordItemRead(beginItemRead(job, index), index, {
    ok: true,
    extractedText: text,
  });
  const processed = recordItemProcessed(beginItemProcessing(read, index), index);
  return recordItemReviewCompletion(processed, index, true);
}

function readyBatchJob(): Job {
  const base = createJob({
    type: "files",
    files: [
      { name: "informe-a.txt", extension: "txt" },
      { name: "informe-b.txt", extension: "txt" },
    ],
  });
  let job = completeItem(base, 0, "Contenido sintético A.");
  job = completeItem(job, 1, "Contenido sintético B.");
  return withReviewState(job, { complete: batchReviewComplete(job) });
}

describe("batch Safe summary fail-closed download (REC-07 #87)", () => {
  it("keeps a content-free diagnostic and downloads nothing when serialization refuses", () => {
    // jsdom does not implement the object-URL seam, so stub it directly (the
    // same seam `captureDownloads` uses) to observe whether bytes are created.
    const originalCreate = URL.createObjectURL;
    const createObjectUrl = vi.fn();
    URL.createObjectURL = createObjectUrl as typeof URL.createObjectURL;
    try {
      render(<ExportStep job={readyBatchJob()} review={null} />);

      fireEvent.click(screen.getByRole("button", { name: "Descargar resumen seguro (.csv)" }));

      // Fail-closed: no Blob/object URL is ever created, so zero bytes download.
      expect(createObjectUrl).not.toHaveBeenCalled();

      const feedback = document.getElementById("batch-result-action-feedback");
      expect(feedback).not.toBeNull();
      expect(feedback).toHaveTextContent(
        "El resumen seguro todavía no está disponible para este lote."
      );
      // Diagnostic visibility without leak: the stable typed code is exposed,
      // never the raw message naming a source file.
      expect(feedback).toHaveAttribute(
        "data-batch-summary-diagnostic",
        "BATCH_SUMMARY_NOT_AUTHORIZED"
      );
      expect(document.body.textContent).not.toContain("DNI-99999111-SENTINEL");
    } finally {
      URL.createObjectURL = originalCreate;
    }
  });

  it("collapses an unexpected serialization error to the fixed code, never Error.name or message", () => {
    // Adversarial witness (DISC-02): `Error.name` is writable and
    // unconstrained, so a synthetic name/message must never reach the DOM —
    // including ATTRIBUTES, not just textContent.
    const originalCreate = URL.createObjectURL;
    const createObjectUrl = vi.fn();
    URL.createObjectURL = createObjectUrl as typeof URL.createObjectURL;
    summaryRefusal.unexpected = () =>
      Object.assign(new Error("DNI_SENTINEL_CSV"), { name: "NOMBRE_SINTETICO_CSV_SENTINEL" });
    try {
      render(<ExportStep job={readyBatchJob()} review={null} />);

      fireEvent.click(screen.getByRole("button", { name: "Descargar resumen seguro (.csv)" }));

      // Fail-closed: no Blob/object URL is ever created, so zero bytes download.
      expect(createObjectUrl).not.toHaveBeenCalled();

      const feedback = document.getElementById("batch-result-action-feedback");
      expect(feedback).not.toBeNull();
      // Truthful Spanish failure message is preserved.
      expect(feedback).toHaveTextContent(
        "El resumen seguro todavía no está disponible para este lote."
      );
      // The unexpected error collapses to the fixed content-free code.
      expect(feedback).toHaveAttribute("data-batch-summary-diagnostic", "unexpected-error");
      // Neither sentinel may appear anywhere in the document (attributes included).
      const html = document.documentElement.outerHTML;
      expect(html).not.toContain("NOMBRE_SINTETICO_CSV_SENTINEL");
      expect(html).not.toContain("DNI_SENTINEL_CSV");
    } finally {
      URL.createObjectURL = originalCreate;
    }
  });
});
