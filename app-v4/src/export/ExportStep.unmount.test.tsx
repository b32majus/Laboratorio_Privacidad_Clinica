/**
 * Unmount-disposal witness for the REC-05 single-item Result async guard
 * (handoff §4.6, D-024). The captured authority snapshot stays
 * self-consistent after the Result unmounts (New Job / Clear session removes
 * <ExportStep>), so the just-in-time guard alone passes and a completed
 * generation would download a stale artifact. The disposal flag in the
 * effect cleanup must make completion after unmount produce ZERO download
 * and zero false success.
 *
 * This file isolates a controlled `buildSafeDocxBytes` gate so the awaited
 * generation window can be suspended, the component unmounted, and the
 * promise resolved afterwards. All fixtures are synthetic; no real content.
 */
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import "@testing-library/jest-dom/vitest";

import { ExportStep } from "./ExportStep";
import {
  applyDecision,
  canFinalize,
  createReviewSession,
  type ReviewSession,
} from "../review/review-domain";
import { createJob, withReviewState, type Job, type OutputAvailability } from "../domain/job";

/** Controlled gate for the awaited DOCX generation window. */
const docxGate = vi.hoisted(() => ({
  suspend: null as null | ((safeText: string) => Promise<Uint8Array>),
}));

vi.mock("../output/docx-builder", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../output/docx-builder")>();
  return {
    ...actual,
    buildSafeDocxBytes: (safeText: string) =>
      docxGate.suspend ? docxGate.suspend(safeText) : actual.buildSafeDocxBytes(safeText),
  };
});

const SOURCE = "Nombre: Carmen Sánchez\nTeléfono 612345678. NHC 2024/089756.";
const NAME_START = SOURCE.indexOf("Carmen Sánchez");
const NAME_END = NAME_START + "Carmen Sánchez".length;
const PHONE_START = SOURCE.indexOf("612345678");
const PHONE_END = PHONE_START + "612345678".length;
const NHC_START = SOURCE.indexOf("2024/089756");
const NHC_END = NHC_START + "2024/089756".length;

function completedSession(): ReviewSession {
  const session = createReviewSession({
    originalText: SOURCE,
    detections: [
      {
        type: "NOMBRE",
        start: NAME_START,
        end: NAME_END,
        confidence: 0.95,
        proposed: "PACIENTE-1",
        note: "nota interna de revisión: verificar apellidos",
        requiresReview: true,
      },
      {
        type: "IDENTIFICADOR",
        start: PHONE_START,
        end: PHONE_END,
        confidence: 0.6,
        proposed: "TEL-REEMPLAZO",
        requiresReview: true,
      },
      {
        type: "IDENTIFICADOR",
        start: NHC_START,
        end: NHC_END,
        confidence: 0.9,
        proposed: "ID-1",
        requiresReview: true,
      },
    ],
    sessionId: "unmount-witness-session",
  });
  let next = applyDecision(session, session.detections[0].id, "accepted");
  next = applyDecision(next, session.detections[1].id, "modified", {
    replacement: "TEL-FINAL",
  });
  next = applyDecision(next, session.detections[2].id, "accepted");
  return next;
}

function bridgeJob(review: ReviewSession): Job {
  const safeOutputReady = canFinalize(review);
  const availability: OutputAvailability = {
    safeOutputReady,
    confidentialAuditReady: true,
  };
  return Object.freeze({
    ...withReviewState(createJob({ type: "pasted-text", text: SOURCE }), {
      complete: safeOutputReady,
    }),
    outputs: Object.freeze(availability),
  }) as Job;
}

// Download capture (same seam as ExportStep.test.tsx).
type CapturedDownload = { readonly fileName: string; readonly blob: Blob };

function captureDownloads(): {
  readonly downloads: readonly CapturedDownload[];
  restore(): void;
} {
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

async function flushAsyncWork(): Promise<void> {
  await act(async () => {
    for (let i = 0; i < 25; i += 1) await Promise.resolve();
    await new Promise((resolve) => setTimeout(resolve, 0));
    for (let i = 0; i < 25; i += 1) await Promise.resolve();
  });
}

afterEach(() => {
  docxGate.suspend = null;
  cleanup();
  vi.restoreAllMocks();
});

describe("REC-05 single-item Result — unmount disposal (handoff §4.6)", () => {
  it("produces ZERO download when the Result unmounts during the awaited DOCX generation", async () => {
    const captured = captureDownloads();
    const session = completedSession();
    const view = render(<ExportStep job={bridgeJob(session)} review={session} />);

    // Suspend the awaited DOCX generation at its first await.
    let resolveBuilder!: (bytes: Uint8Array) => void;
    docxGate.suspend = () =>
      new Promise<Uint8Array>((resolve) => {
        resolveBuilder = resolve;
      });

    try {
      fireEvent.click(
        screen.getByRole("button", { name: "Descargar documento preparado (.docx)" })
      );
      expect(screen.getByRole("status")).toHaveTextContent("Preparando el documento (.docx)…");

      // New Job / Clear session removes <ExportStep>: the Result unmounts
      // while the generation is still awaited.
      view.unmount();

      // The generation then completes against the self-consistent captured
      // snapshot — the guard must still refuse because the component is
      // disposed.
      resolveBuilder(new Uint8Array([1, 2, 3]));
      await flushAsyncWork();

      expect(captured.downloads).toHaveLength(0);
    } finally {
      captured.restore();
    }
  });
});
