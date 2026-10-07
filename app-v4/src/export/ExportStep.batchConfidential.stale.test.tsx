/**
 * Stale/awaited-window witnesses for the REC-07 #89 batch Confidential Audit
 * (same accepted pattern as ExportStep.unmount.test.tsx and the #88 batch
 * Safe witnesses):
 *
 * The builder module `./batchConfidentialAudit` is replaced by a controlled
 * gate ONLY so the real awaited generation window can be suspended. The
 * guards under proof live in the REAL component flow: capture → await →
 * revalidate (Job + exact session set + readiness + disposal) → download.
 *
 * 1. Authority invalidation during the awaited window (Job replacement)
 *    produces ZERO download, NO false success and a content-free failure.
 * 2. Result unmount during the awaited window produces ZERO download and
 *    no visible false feedback.
 * 3. (CORR #89 Sp2) An unexpected generation failure retains ONLY the
 *    closed typed code `unexpected-error`: neither an unconstrained
 *    `Error.name` nor the raw message (which can carry Confidential
 *    content) ever reaches the DOM.
 *
 * All fixtures are synthetic; no real content anywhere.
 */
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import "@testing-library/jest-dom/vitest";

import { ExportStep } from "./ExportStep";
import { createReviewSession, type ReviewSession } from "../review/review-domain";
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

// Controlled gate for the awaited batch Confidential generation window.
const confidentialGate = vi.hoisted(() => ({
  suspend: null as
    | null
    | ((job: Job, sessions: Readonly<Record<number, ReviewSession>> | null) => Promise<string>),
}));

vi.mock("./batchConfidentialAudit", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./batchConfidentialAudit")>();
  return {
    ...actual,
    buildBatchConfidentialAuditText: (
      job: Job,
      sessions: Readonly<Record<number, ReviewSession>> | null
    ) =>
      confidentialGate.suspend
        ? confidentialGate.suspend(job, sessions)
        : actual.buildBatchConfidentialAuditText(job, sessions),
  };
});

// ---------------------------------------------------------------------------
// Minimal ready-batch fixture (plain completed documents; the builder is
// gated, so no detections are needed here).
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

function readyBatch(): { job: Job; sessions: Record<number, ReviewSession> } {
  let job = buildBatchJob(["informe-a.txt", "informe-b.txt"]);
  job = completeItem(job, 0, "Contenido sintético A.");
  job = completeItem(job, 1, "Contenido sintético B.");
  const sessions: Record<number, ReviewSession> = {
    0: createReviewSession({
      originalText: "Contenido sintético A.",
      detections: [],
      sessionId: "stale-witness-0",
    }),
    1: createReviewSession({
      originalText: "Contenido sintético B.",
      detections: [],
      sessionId: "stale-witness-1",
    }),
  };
  return { job: withReviewState(job, { complete: batchReviewComplete(job) }), sessions };
}

// ---------------------------------------------------------------------------
// Download capture (same Blob/object-URL seam as the other Result witnesses)
// ---------------------------------------------------------------------------

function captureDownloads(): { readonly downloads: { fileName: string }[]; restore(): void } {
  const downloads: { fileName: string }[] = [];
  const originalCreate = URL.createObjectURL;
  const originalRevoke = URL.revokeObjectURL;
  const originalClick = HTMLAnchorElement.prototype.click;
  URL.createObjectURL = vi.fn(
    () => `blob:mock-${downloads.length + 1}`
  ) as typeof URL.createObjectURL;
  URL.revokeObjectURL = vi.fn() as typeof URL.revokeObjectURL;
  HTMLAnchorElement.prototype.click = vi.fn(function (this: HTMLAnchorElement) {
    downloads.push({ fileName: this.getAttribute("download") ?? "" });
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

const CONF_BUTTON = "Descargar auditoría confidencial (.txt)";
const CONF_CONFIRM = "Confirmar descarga confidencial";

async function flushAsyncWork(): Promise<void> {
  await act(async () => {
    for (let i = 0; i < 25; i += 1) await Promise.resolve();
    await new Promise((resolve) => setTimeout(resolve, 0));
    for (let i = 0; i < 25; i += 1) await Promise.resolve();
  });
}

afterEach(() => {
  confidentialGate.suspend = null;
  cleanup();
});

describe("batch Confidential awaited-window witnesses (PROOF 7)", () => {
  it("invalidating the batch authority during the awaited window downloads ZERO and reports no success", async () => {
    const { job, sessions } = readyBatch();
    const captured = captureDownloads();
    try {
      const view = render(<ExportStep job={job} review={null} batchSessions={sessions} />);

      // Suspend the real generation path at its awaited window.
      let resolve!: (text: string) => void;
      confidentialGate.suspend = () =>
        new Promise<string>((res) => {
          resolve = res;
        });

      fireEvent.click(screen.getByRole("button", { name: CONF_BUTTON }));
      fireEvent.click(screen.getByRole("button", { name: CONF_CONFIRM }));

      // The Job is replaced while the generation is still awaited: a NEW
      // Job reference invalidates the captured current-authority snapshot.
      const otherJob = withReviewState(job, { complete: true });
      view.rerender(<ExportStep job={otherJob} review={null} batchSessions={sessions} />);

      // The stale generation then completes; the guard must refuse it.
      resolve("STALE_CONFIDENTIAL_BODY_SENTINEL");
      await flushAsyncWork();

      expect(captured.downloads).toHaveLength(0);
      const feedback = document.getElementById("batch-result-action-feedback");
      expect(feedback).not.toBeNull();
      expect(feedback).toHaveTextContent("La revisión cambió; no se descargó ninguna auditoría.");
      expect(feedback).toHaveAttribute(
        "data-batch-safe-diagnostic",
        "BATCH_CONFIDENTIAL_NOT_CURRENT"
      );
    } finally {
      captured.restore();
    }
  });

  it("unmounting the Result during the awaited window downloads ZERO with no false feedback", async () => {
    const { job, sessions } = readyBatch();
    const captured = captureDownloads();
    try {
      const view = render(<ExportStep job={job} review={null} batchSessions={sessions} />);

      let resolve!: (text: string) => void;
      confidentialGate.suspend = () =>
        new Promise<string>((res) => {
          resolve = res;
        });

      fireEvent.click(screen.getByRole("button", { name: CONF_BUTTON }));
      fireEvent.click(screen.getByRole("button", { name: CONF_CONFIRM }));

      // New Job / Clear session removes <ExportStep> while the generation
      // is still awaited; the completion must stay disposed.
      view.unmount();

      resolve("STALE_CONFIDENTIAL_BODY_SENTINEL");
      await flushAsyncWork();

      expect(captured.downloads).toHaveLength(0);
      expect(document.getElementById("batch-result-action-feedback")).toBeNull();
    } finally {
      captured.restore();
    }
  });

  it("an unexpected generation failure retains only the closed typed code, never an exception-derived string (CORR #89 Sp2)", async () => {
    const { job, sessions } = readyBatch();
    const captured = captureDownloads();
    try {
      render(<ExportStep job={job} review={null} batchSessions={sessions} />);

      // A hostile unexpected error: both `name` (writable, unconstrained)
      // and `message` carry would-be Confidential content. The retained
      // diagnostic must collapse to the fixed code `unexpected-error` and
      // neither string may reach the DOM.
      confidentialGate.suspend = () =>
        Promise.reject(
          Object.assign(new Error("CONFIDENTIAL_BODY_SENTINEL: Carmen Sánchez"), {
            name: "CarmenSánchezLeak",
          })
        );

      fireEvent.click(screen.getByRole("button", { name: CONF_BUTTON }));
      fireEvent.click(screen.getByRole("button", { name: CONF_CONFIRM }));
      await flushAsyncWork();

      expect(captured.downloads).toHaveLength(0);
      const feedback = document.getElementById("batch-result-action-feedback");
      expect(feedback).not.toBeNull();
      expect(feedback).toHaveTextContent("No se pudo generar la auditoría confidencial del lote.");
      expect(feedback).toHaveAttribute("data-batch-safe-diagnostic", "unexpected-error");
      expect(document.body.textContent ?? "").not.toContain("CarmenSánchezLeak");
      expect(document.body.textContent ?? "").not.toContain("CONFIDENTIAL_BODY_SENTINEL");
    } finally {
      captured.restore();
    }
  });
});
