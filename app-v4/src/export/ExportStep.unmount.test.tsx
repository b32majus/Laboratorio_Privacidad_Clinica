/**
 * Unmount-disposal witnesses for the async guards of <ExportStep>:
 *
 * 1. REC-05 single-item Result (handoff §4.6, D-024): the captured authority
 *    snapshot stays self-consistent after the Result unmounts (New Job /
 *    Clear session removes <ExportStep>), so the just-in-time guard alone
 *    passes and a completed generation would download a stale artifact. The
 *    disposal flag in the effect cleanup must make completion after unmount
 *    produce ZERO download and zero false success.
 *
 * 2. REC-07 prefactor #79 (Structured export): the Structured XLSX paths
 *    share the same gap — an already-started `loadXlsx`/generation window
 *    that completes after the owning Structured surface is removed must
 *    produce ZERO download. The shared disposal flag joins the existing
 *    post-await current-authority guards (`isSafeCurrent` /
 *    `isConfirmationCurrent`).
 *
 * These tests isolate controlled gates so the awaited generation windows can
 * be suspended, the component unmounted, and the promises resolved
 * afterwards. All fixtures are synthetic; no real content.
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
import { createStructuredConfiguration, setStructuredDateRole } from "../structured/configuration";
import { buildStructuredTransformPlan } from "../structured/transform-plan";
import { prepareStructuredOutput } from "../structured/transformed-dataset";
import type { XlsxLib } from "../structured/xlsx-loader";
import {
  CONFIDENTIAL_STRUCTURED_XLSX_FILE_NAME,
  SAFE_STRUCTURED_XLSX_FILE_NAME,
} from "../structured/xlsx-export";

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

/**
 * Controlled gate for the awaited structured XLSX lazy-load window
 * (`await loadXlsx()`), plus fixed bytes for both XLSX builders so a
 * resumed generation always reaches the download seam instead of failing
 * inside byte construction.
 */
const xlsxGate = vi.hoisted(() => ({
  suspend: null as null | (() => Promise<XlsxLib>),
}));

vi.mock("../structured/xlsx-loader", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../structured/xlsx-loader")>();
  return {
    ...actual,
    loadXlsx: () => (xlsxGate.suspend ? xlsxGate.suspend() : actual.loadXlsx()),
  };
});

vi.mock("../structured/xlsx-export", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../structured/xlsx-export")>();
  return {
    ...actual,
    buildSafeXlsxBytes: () => new Uint8Array([1, 2, 3]),
    buildConfidentialXlsxBytes: () => new Uint8Array([4, 5, 6]),
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
  xlsxGate.suspend = null;
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

/**
 * Synthetic structured fixtures (same shape as structured-export.test.tsx,
 * smaller): a ready configuration/plan/preparation triple over synthetic
 * grid data, and a structured Job with the given readiness.
 */
const STRUCTURED_GRID = {
  headers: ["Paciente", "Fecha_Visita", "Fecha_Nacimiento", "Diagnostico"],
  rows: [
    ["P-001", "2023-01-10", "1954-03-12", "Gripe A"],
    ["P-002", "2023-03-15", "1980-07-04", "Fractura"],
  ],
};

function structuredReadyInput() {
  let configuration = createStructuredConfiguration(STRUCTURED_GRID, {
    selectedPatientIdColumn: "Paciente",
  });
  configuration = setStructuredDateRole(configuration, 1, "visit");
  configuration = setStructuredDateRole(configuration, 2, "birth");
  const plan = buildStructuredTransformPlan(configuration, {
    policyId: "standard",
    jobSeed: "unmount-witness-structured",
  });
  return { configuration, plan, preparation: prepareStructuredOutput(configuration, plan) };
}

function structuredJobFor(id: string, ready: boolean): Job {
  return {
    kind: "structured",
    id,
    policyId: "standard",
    outputs: { safeOutputReady: ready, confidentialAuditReady: ready },
    errors: [],
  } as unknown as Job;
}

describe("REC-07 prefactor #79 — Structured export unmount disposal", () => {
  const SAFE_XLSX_BUTTON = "Download Safe Structured Output (.xlsx)";
  const CONF_XLSX_BUTTON = "Download Structured Confidential Audit (.xlsx)";

  it("produces ZERO download when the surface unmounts during the awaited Safe XLSX generation", async () => {
    const captured = captureDownloads();
    const view = render(
      <ExportStep
        job={structuredJobFor("job-1", true)}
        review={null}
        structured={structuredReadyInput()}
      />
    );
    try {
      // Suspend the awaited XLSX lazy-load at its first await.
      let resolveLoader!: (lib: XlsxLib) => void;
      xlsxGate.suspend = () =>
        new Promise<XlsxLib>((resolve) => {
          resolveLoader = resolve;
        });

      fireEvent.click(screen.getByRole("button", { name: SAFE_XLSX_BUTTON }));
      // The operation is genuinely pending: no bytes, no download yet.
      expect(captured.downloads).toHaveLength(0);

      // Removing the surface revokes download authority while the
      // generation is still awaited.
      view.unmount();

      // The operation then completes — it must produce ZERO download.
      resolveLoader({} as XlsxLib);
      await flushAsyncWork();

      expect(captured.downloads).toHaveLength(0);
    } finally {
      captured.restore();
    }
  });

  it("produces ZERO download when the surface unmounts during the awaited Confidential XLSX generation", async () => {
    const captured = captureDownloads();
    const view = render(
      <ExportStep
        job={structuredJobFor("job-1", true)}
        review={null}
        structured={structuredReadyInput()}
      />
    );
    try {
      let resolveLoader!: (lib: XlsxLib) => void;
      xlsxGate.suspend = () =>
        new Promise<XlsxLib>((resolve) => {
          resolveLoader = resolve;
        });

      fireEvent.click(screen.getByRole("button", { name: CONF_XLSX_BUTTON }));
      fireEvent.click(screen.getByRole("button", { name: /confirm confidential download/i }));
      expect(captured.downloads).toHaveLength(0);

      view.unmount();

      resolveLoader({} as XlsxLib);
      await flushAsyncWork();

      expect(captured.downloads).toHaveLength(0);
    } finally {
      captured.restore();
    }
  });

  it("still downloads normally when the surface stays mounted through the awaited Safe XLSX generation", async () => {
    const captured = captureDownloads();
    // Pre-seed the loader so the real lazy load resolves synchronously
    // (no script injection); the builders are stubbed, the lib is unused.
    window.XLSX = { version: "unmount-witness" } as unknown as XlsxLib;
    render(
      <ExportStep
        job={structuredJobFor("job-1", true)}
        review={null}
        structured={structuredReadyInput()}
      />
    );
    try {
      fireEvent.click(screen.getByRole("button", { name: SAFE_XLSX_BUTTON }));
      await flushAsyncWork();

      expect(captured.downloads).toHaveLength(1);
      expect(captured.downloads[0]?.fileName).toBe(SAFE_STRUCTURED_XLSX_FILE_NAME);
    } finally {
      captured.restore();
      delete window.XLSX;
    }
  });

  it("still downloads normally when the surface stays mounted through the awaited Confidential XLSX generation", async () => {
    const captured = captureDownloads();
    window.XLSX = { version: "unmount-witness" } as unknown as XlsxLib;
    render(
      <ExportStep
        job={structuredJobFor("job-1", true)}
        review={null}
        structured={structuredReadyInput()}
      />
    );
    try {
      fireEvent.click(screen.getByRole("button", { name: CONF_XLSX_BUTTON }));
      fireEvent.click(screen.getByRole("button", { name: /confirm confidential download/i }));
      await flushAsyncWork();

      expect(captured.downloads).toHaveLength(1);
      expect(captured.downloads[0]?.fileName).toBe(CONFIDENTIAL_STRUCTURED_XLSX_FILE_NAME);
    } finally {
      captured.restore();
      delete window.XLSX;
    }
  });
});
