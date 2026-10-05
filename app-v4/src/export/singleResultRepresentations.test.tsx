/**
 * REC-05 WU-B representation oracle: the four single-item destinations (Copy,
 * TXT, DOCX, PDF) all derive from the SAME canonical reviewed Safe text, and a
 * planted Confidential-only mapping/reviewer-note token never reaches any Safe
 * destination.
 *
 * The DOCX/PDF builders are wrapped (real implementations preserved) so the
 * exact content handed to each representation is observable. WU-A already owns
 * the governed builder read-back oracles (mammoth / pdf.js), so this file keeps
 * the component-level claim focused and light: the component passes the
 * canonical `getFinalText` payload to each builder and nothing else. All
 * fixtures are synthetic Spanish clinical-style text; no real content.
 */
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../output/docx-builder", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../output/docx-builder")>();
  return { ...actual, buildSafeDocxBytes: vi.fn(actual.buildSafeDocxBytes) };
});
vi.mock("../output/pdf-builder", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../output/pdf-builder")>();
  return { ...actual, buildSafePdfBytes: vi.fn(actual.buildSafePdfBytes) };
});

import { ExportStep } from "./ExportStep";
import {
  applyDecision,
  canFinalize,
  createReviewSession,
  getFinalText,
  type ReviewSession,
} from "../review/review-domain";
import { createJob, withReviewState, type Job } from "../domain/job";
import { buildConfidentialAudit } from "../output/confidential-audit";
import {
  serializeConfidentialAudit,
  CONFIDENTIAL_AUDIT_WARNING_LINE,
} from "../output/confidential-audit-serializer";
import { buildSafeDocxBytes } from "../output/docx-builder";
import { buildSafePdfBytes } from "../output/pdf-builder";

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  delete (navigator as { clipboard?: unknown }).clipboard;
});

const SOURCE = "Nombre: Carmen Sánchez\nTeléfono 612345678. NHC 2024/089756.";
const NAME_START = SOURCE.indexOf("Carmen Sánchez");
const NAME_END = NAME_START + "Carmen Sánchez".length;
const PHONE_START = SOURCE.indexOf("612345678");
const PHONE_END = PHONE_START + "612345678".length;
const NHC_START = SOURCE.indexOf("2024/089756");
const NHC_END = NHC_START + "2024/089756".length;

const REVIEWER_NOTE = "nota interna de revisión: verificar apellidos";
/** The Confidential artifact's own header line (payload marker, never Safe). */
const AUDIT_HEADER = CONFIDENTIAL_AUDIT_WARNING_LINE;
/** A Confidential mapping-section row heading (never Safe). */
const AUDIT_MAPPING_ROW = "Original ↔ replacement mapping";

function readySession(): ReviewSession {
  const base = createReviewSession({
    originalText: SOURCE,
    detections: [
      {
        type: "NOMBRE",
        start: NAME_START,
        end: NAME_END,
        confidence: 0.95,
        proposed: "PACIENTE-1",
        note: REVIEWER_NOTE,
        requiresReview: true,
      },
      {
        type: "IDENTIFICADOR",
        start: PHONE_START,
        end: PHONE_END,
        confidence: 0.6,
        proposed: "TEL-REEMPLAZO",
        note: "teléfono sintético",
        requiresReview: true,
      },
      {
        type: "IDENTIFICADOR",
        start: NHC_START,
        end: NHC_END,
        confidence: 0.9,
        proposed: "ID-1",
        note: "NHC sintética",
        requiresReview: true,
      },
    ],
    sessionId: "representations-session",
  });
  let next = applyDecision(base, base.detections[0].id, "accepted");
  next = applyDecision(next, base.detections[1].id, "accepted");
  next = applyDecision(next, base.detections[2].id, "accepted");
  return next;
}

function readyJob(review: ReviewSession): Job {
  const safeOutputReady = canFinalize(review);
  return Object.freeze({
    ...withReviewState(createJob({ type: "pasted-text", text: SOURCE }), {
      complete: safeOutputReady,
    }),
    outputs: Object.freeze({ safeOutputReady, confidentialAuditReady: true }),
  }) as Job;
}

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

async function textOf(download: CapturedDownload): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsText(download.blob);
  });
}

function stubClipboard(onWrite: (text: string) => void): void {
  Object.defineProperty(navigator, "clipboard", {
    configurable: true,
    value: {
      writeText: vi.fn((text: string) => {
        onWrite(text);
        return Promise.resolve();
      }),
    },
  });
}

describe("REC-05 WU-B — four Safe representations share one canonical payload", () => {
  beforeEach(() => {
    vi.mocked(buildSafeDocxBytes).mockClear();
    vi.mocked(buildSafePdfBytes).mockClear();
  });

  it("derives Copy, TXT, DOCX and PDF from the same canonical reviewed text", async () => {
    const session = readySession();
    const canonical = getFinalText(session);

    let clipboardText = "";
    stubClipboard((text) => {
      clipboardText = text;
    });

    const captured = captureDownloads();
    try {
      render(<ExportStep job={readyJob(session)} review={session} />);

      // Copy.
      fireEvent.click(screen.getByRole("button", { name: "Copiar texto preparado" }));
      await waitFor(() => expect(clipboardText).toBe(canonical));

      // TXT: exact canonical string.
      fireEvent.click(screen.getByRole("button", { name: "Descargar como TXT (.txt)" }));
      await waitFor(() => expect(captured.downloads).toHaveLength(1));
      expect(await textOf(captured.downloads[0])).toBe(canonical);
      expect(captured.downloads[0].fileName).toBe("texto-preparado.txt");

      // DOCX: the real builder receives exactly the canonical string.
      fireEvent.click(
        screen.getByRole("button", { name: "Descargar documento preparado (.docx)" })
      );
      await waitFor(() => expect(captured.downloads).toHaveLength(2));
      expect(vi.mocked(buildSafeDocxBytes).mock.calls.at(-1)?.[0]).toBe(canonical);
      expect(captured.downloads[1].fileName).toBe("texto-preparado.docx");

      // PDF: the real builder receives exactly the canonical string.
      fireEvent.click(screen.getByRole("button", { name: "Descargar como PDF (.pdf)" }));
      await waitFor(() => expect(captured.downloads).toHaveLength(3));
      expect(vi.mocked(buildSafePdfBytes).mock.calls.at(-1)?.[0]).toBe(canonical);
      expect(captured.downloads[2].fileName).toBe("texto-preparado.pdf");
    } finally {
      captured.restore();
    }
  });

  it("never leaks a planted Confidential mapping/reviewer-note token into any Safe destination", async () => {
    const session = readySession();
    // Non-vacuous: the tokens genuinely exist in the Confidential artifact.
    const confidentialText = serializeConfidentialAudit(buildConfidentialAudit(session));
    expect(confidentialText).toContain("Carmen Sánchez");
    expect(confidentialText).toContain(REVIEWER_NOTE);
    expect(confidentialText).toContain(AUDIT_HEADER);
    expect(confidentialText).toContain(AUDIT_MAPPING_ROW);

    let clipboardText = "";
    stubClipboard((text) => {
      clipboardText = text;
    });

    const captured = captureDownloads();
    try {
      render(<ExportStep job={readyJob(session)} review={session} />);

      fireEvent.click(screen.getByRole("button", { name: "Copiar texto preparado" }));
      await waitFor(() => expect(clipboardText).not.toBe(""));

      fireEvent.click(screen.getByRole("button", { name: "Descargar como TXT (.txt)" }));
      await waitFor(() => expect(captured.downloads).toHaveLength(1));

      fireEvent.click(
        screen.getByRole("button", { name: "Descargar documento preparado (.docx)" })
      );
      await waitFor(() => expect(captured.downloads).toHaveLength(2));

      fireEvent.click(screen.getByRole("button", { name: "Descargar como PDF (.pdf)" }));
      await waitFor(() => expect(captured.downloads).toHaveLength(3));

      const txt = await textOf(captured.downloads[0]);
      const docxInput = vi.mocked(buildSafeDocxBytes).mock.calls.at(-1)?.[0] ?? "";
      const pdfInput = vi.mocked(buildSafePdfBytes).mock.calls.at(-1)?.[0] ?? "";

      for (const [label, value] of [
        ["copy", clipboardText],
        ["txt", txt],
        ["docx", docxInput],
        ["pdf", pdfInput],
      ] as const) {
        expect(value, `${label} must not carry the original mapping`).not.toContain(
          "Carmen Sánchez"
        );
        expect(value, `${label} must not carry the reviewer note`).not.toContain(REVIEWER_NOTE);
        expect(value, `${label} must not carry the audit header`).not.toContain(AUDIT_HEADER);
        expect(value, `${label} must not carry the audit mapping row`).not.toContain(
          AUDIT_MAPPING_ROW
        );
      }
    } finally {
      captured.restore();
    }
  });
});
