/**
 * Writer-phase UI evidence for the REC-07 #89 batch Confidential Audit.
 *
 * Proves, through the REAL rendered batch Result with bridge-shaped session
 * sets and the REAL builder (no seams stubbed):
 *  - PROOF 9 realistic-density journey: a 12-document batch (one local
 *    failure deliberately removed) through the ready Result; the first
 *    Confidential action downloads ZERO, Cancel downloads ZERO, a fresh
 *    request + explicit Confirm downloads exactly ONE
 *    `auditoria-confidencial-lote.txt` with the canonical Confidential
 *    content; a further download requires a fresh first action; the #87/#88
 *    Safe deliverables (ZIP primary, CSV manifest with `error,retirado`)
 *    stay intact;
 *  - PROOF 2/1 sentinel adversary on the REAL downloaded bytes: original
 *    detected values, reviewer notes and restored entries present; source
 *    filenames and ordinary kept Safe-only clinical text absent;
 *  - PROOF 6 mutation invalidation: a pending confirmation dies on Job
 *    replacement, batch-session identity change and readiness loss;
 *  - PROOF 8 asymmetric hierarchy: the Safe ZIP remains the one primary
 *    action; the Confidential zone stays separate and never renders inside
 *    "Otros formatos"; copy is professional Spanish.
 *
 * The stale/awaited-window and unmount-disposal witnesses live in
 * ExportStep.batchConfidential.stale.test.tsx (they need the controlled
 * generation gate).
 */
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import "@testing-library/jest-dom/vitest";

import { ExportStep } from "./ExportStep";
import { CONFIDENTIAL_AUDIT_WARNING_LINE } from "../output/confidential-audit-serializer";
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
// Fixtures (synthetic Spanish clinical-style text; no real content)
// ---------------------------------------------------------------------------

const SOURCE_0 =
  "Nombre: Carmen Sánchez\nTeléfono 612345678. DNI 12345678Z. Seguimiento ambulatorio programado.";
const NAME_START = SOURCE_0.indexOf("Carmen Sánchez");
const NAME_END = NAME_START + "Carmen Sánchez".length;
const PHONE_START = SOURCE_0.indexOf("612345678");
const PHONE_END = PHONE_START + "612345678".length;
const DNI_START = SOURCE_0.indexOf("12345678Z");
const DNI_END = DNI_START + "12345678Z".length;
/** Ordinary kept clinical text that exists ONLY in Safe output (never detected). */
const SAFE_ONLY_SENTINEL = "Seguimiento ambulatorio programado";
/** Source filename sentinel: never Confidential correspondence authority. */
const FILENAME_SENTINEL = "informe-paciente-sanchez.txt";

const SOURCE_11 = "NHC 2024/089756 de la paciente. Continuidad asistencial garantizada.";
const NHC_START = SOURCE_11.indexOf("2024/089756");
const NHC_END = NHC_START + "2024/089756".length;

function adversarialSession0(): ReviewSession {
  const session = createReviewSession({
    originalText: SOURCE_0,
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
        start: DNI_START,
        end: DNI_END,
        confidence: 0.9,
        proposed: "ID-DNI",
        requiresReview: true,
      },
    ],
    sessionId: "ui-lote-0",
  });
  let next = applyDecision(session, session.detections[0].id, "accepted");
  next = applyDecision(next, session.detections[1].id, "modified", {
    replacement: "TEL-FINAL",
    note: "sin código de país en la fuente",
  });
  next = applyDecision(next, session.detections[2].id, "restored");
  return next;
}

function adversarialSession11(): ReviewSession {
  const session = createReviewSession({
    originalText: SOURCE_11,
    detections: [
      {
        type: "IDENTIFICADOR",
        start: NHC_START,
        end: NHC_END,
        confidence: 0.9,
        proposed: "ID-NHC",
        requiresReview: true,
      },
    ],
    sessionId: "ui-lote-11",
  });
  return applyDecision(session, session.detections[0].id, "modified", {
    replacement: "NHC-REEMPLAZO",
    note: "NHC normalizada por revisión",
  });
}

function plainSession(index: number): ReviewSession {
  return createReviewSession({
    originalText: `Contenido sintético del documento ${index}.`,
    detections: [],
    sessionId: `ui-lote-${index}`,
  });
}

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

function failItemRead(job: Job, index: number): Job {
  return recordItemRead(beginItemRead(job, index), index, {
    ok: false,
    error: { code: "pdf-no-text-layer", message: "El PDF no tiene capa de texto." },
  });
}

function derivedBatch(job: Job): Job {
  return withReviewState(job, { complete: batchReviewComplete(job) });
}

const DOC_COUNT = 12;

/** The realistic batch: 12 items, item 6 (index 5) failed and was removed. */
function realisticBatch(): { job: Job; sessions: Record<number, ReviewSession> } {
  const names = Array.from({ length: DOC_COUNT }, (_, index) =>
    index === 0 ? FILENAME_SENTINEL : `informe-${String(index + 1).padStart(2, "0")}.txt`
  );
  let job = buildBatchJob(names);
  const sessions: Record<number, ReviewSession> = {};
  for (let index = 0; index < DOC_COUNT; index += 1) {
    if (index === 5) {
      job = failItemRead(job, index);
      continue;
    }
    const text =
      index === 0
        ? SOURCE_0
        : index === 11
          ? SOURCE_11
          : `Contenido sintético del documento ${index}.`;
    job = completeItem(job, index, text);
    sessions[index] =
      index === 0
        ? adversarialSession0()
        : index === 11
          ? adversarialSession11()
          : plainSession(index);
  }
  job = removeBatchItem(job, 5);
  return { job: derivedBatch(job), sessions };
}

// ---------------------------------------------------------------------------
// Download capture (same Blob/object-URL seam as the existing Result tests)
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

async function blobText(download: CapturedDownload): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsText(download.blob);
  });
}

const RESULT_STATE = (state: string): HTMLElement | null =>
  document.querySelector(`[data-result-state="${state}"]`);
const CONF_BUTTON = "Descargar auditoría confidencial (.txt)";
const CONF_CONFIRM = "Confirmar descarga confidencial";
const CONF_CANCEL = "Cancelar descarga confidencial";
const CONF_GROUP = "Confirmación de descarga confidencial";

async function flushAsyncWork(): Promise<void> {
  await act(async () => {
    for (let i = 0; i < 25; i += 1) await Promise.resolve();
    await new Promise((resolve) => setTimeout(resolve, 0));
    for (let i = 0; i < 25; i += 1) await Promise.resolve();
  });
}

afterEach(() => {
  cleanup();
});

describe("batch Confidential journey at realistic density (PROOF 9)", () => {
  it("first action downloads zero; Confirm downloads exactly one audit; Safe deliverables stay intact", async () => {
    const { job, sessions } = realisticBatch();
    const captured = captureDownloads();
    try {
      render(<ExportStep job={job} review={null} batchSessions={sessions} />);
      expect(RESULT_STATE("ready")).not.toBeNull();

      // PROOF 8: the Safe ZIP is still the ONE primary action and the
      // Confidential zone stays outside "Otros formatos".
      const primary = document.querySelectorAll('[data-variant="primary"]');
      expect(primary).toHaveLength(1);
      expect(primary[0]).toHaveTextContent("Descargar documentos seguros (.zip)");
      const confidential = screen.getByRole("button", { name: CONF_BUTTON });
      expect(confidential).toBeEnabled();
      expect(screen.getByRole("group", { name: "Otros formatos del lote" })).not.toContainElement(
        confidential
      );

      // First action: warning only, ZERO downloads.
      fireEvent.click(confidential);
      expect(screen.getByRole("group", { name: CONF_GROUP })).toBeInTheDocument();
      expect(captured.downloads).toHaveLength(0);

      // Cancel: reset with ZERO downloads; a fresh request is required.
      fireEvent.click(screen.getByRole("button", { name: CONF_CANCEL }));
      expect(screen.queryByRole("group", { name: CONF_GROUP })).not.toBeInTheDocument();
      expect(captured.downloads).toHaveLength(0);

      // Fresh request + explicit Confirm: exactly ONE current artifact.
      fireEvent.click(confidential);
      fireEvent.click(screen.getByRole("button", { name: CONF_CONFIRM }));
      await flushAsyncWork();

      expect(captured.downloads).toHaveLength(1);
      expect(captured.downloads[0].fileName).toBe("auditoria-confidencial-lote.txt");
      const text = await blobText(captured.downloads[0]);
      expect(text.startsWith(CONFIDENTIAL_AUDIT_WARNING_LINE)).toBe(true);
      expect(text).toContain("Carmen Sánchez");
      expect(text).toContain("nota interna de revisión: verificar apellidos");
      expect(text).toContain("12345678Z");
      expect(text).toContain("kept original: yes (explicit restored decision)");
      expect(text).toContain("NHC-REEMPLAZO");
      expect(text).toContain("Documento 1");
      expect(text).toContain("Documento 12");
      expect(text).toContain("Estado: error (retirado del lote; sin cuerpo de auditoría).");

      // The confirmation never survives its own download: a further download
      // requires a fresh first action.
      expect(screen.queryByRole("group", { name: CONF_GROUP })).not.toBeInTheDocument();

      // Sentinel adversary on the REAL downloaded bytes.
      expect(text).not.toContain(FILENAME_SENTINEL);
      expect(text).not.toContain("informe-paciente");
      expect(text).not.toContain(".txt");
      expect(text).not.toContain(SAFE_ONLY_SENTINEL);

      // The #87 Safe manifest is untouched: the removed failure stays
      // `error,retirado` and completed rows stay `completado`.
      fireEvent.click(screen.getByRole("button", { name: "Descargar resumen seguro (.csv)" }));
      expect(captured.downloads).toHaveLength(2);
      expect(captured.downloads[1].fileName).toBe("resumen-lote-seguro.csv");
      const csv = await blobText(captured.downloads[1]);
      expect(csv).toContain("1,completado,");
      expect(csv).toContain("6,error,retirado");
      expect(csv).toContain("12,completado,");
    } finally {
      captured.restore();
    }
  });
});

// ---------------------------------------------------------------------------
// PROOF 4 (CORR #89 Sp1): a ready Job whose per-item session authority is
// missing or non-finalizable renders the factual UNAVAILABLE state — the
// same canonical facts the builder refuses bytes on (session-set
// completeness, finalizability, the shared batch-ready prerequisite) — and
// downloads zero. No `job.outputs` mirror or ready state alone can enable
// the Confidential action.
// ---------------------------------------------------------------------------

/** A completed item's session whose mandatory decision is still pending. */
function nonFinalizableSession(): ReviewSession {
  return createReviewSession({
    originalText: SOURCE_0,
    detections: [
      {
        type: "NOMBRE",
        start: NAME_START,
        end: NAME_END,
        confidence: 0.95,
        proposed: "PACIENTE-1",
        requiresReview: true,
      },
    ],
    sessionId: "ui-lote-non-finalizable",
  });
}

describe("missing/non-finalizable session authority keeps the Confidential zone unavailable (PROOF 4)", () => {
  it("a ready Job with an incomplete session set renders the factual unavailable state and downloads zero", () => {
    const { job, sessions } = realisticBatch();
    const captured = captureDownloads();
    try {
      const incomplete = { ...sessions };
      delete incomplete[3]; // a completed item loses its exact current session

      render(<ExportStep job={job} review={null} batchSessions={incomplete} />);
      expect(RESULT_STATE("ready")).not.toBeNull(); // the batch itself is still ready

      const confidential = screen.getByRole("button", { name: CONF_BUTTON });
      expect(confidential).toBeDisabled();
      expect(
        screen.getByText("La auditoría confidencial todavía no está disponible para el lote.")
      ).toBeInTheDocument();
      fireEvent.click(confidential);
      expect(screen.queryByRole("group", { name: CONF_GROUP })).not.toBeInTheDocument();
      expect(captured.downloads).toHaveLength(0);
    } finally {
      captured.restore();
    }
  });

  it("a ready Job with a non-finalizable current session renders the factual unavailable state and downloads zero", () => {
    const { job, sessions } = realisticBatch();
    const captured = captureDownloads();
    try {
      const stale = { ...sessions, 2: nonFinalizableSession() };

      render(<ExportStep job={job} review={null} batchSessions={stale} />);
      expect(RESULT_STATE("ready")).not.toBeNull();

      const confidential = screen.getByRole("button", { name: CONF_BUTTON });
      expect(confidential).toBeDisabled();
      expect(
        screen.getByText("La auditoría confidencial todavía no está disponible para el lote.")
      ).toBeInTheDocument();
      fireEvent.click(confidential);
      expect(screen.queryByRole("group", { name: CONF_GROUP })).not.toBeInTheDocument();
      expect(captured.downloads).toHaveLength(0);
    } finally {
      captured.restore();
    }
  });

  it("a pending confirmation dies when the current session stops being finalizable", () => {
    const { job, sessions } = realisticBatch();
    const view = render(<ExportStep job={job} review={null} batchSessions={sessions} />);
    fireEvent.click(screen.getByRole("button", { name: CONF_BUTTON }));
    expect(screen.getByRole("group", { name: CONF_GROUP })).toBeInTheDocument();

    view.rerender(
      <ExportStep
        job={job}
        review={null}
        batchSessions={{ ...sessions, 2: nonFinalizableSession() }}
      />
    );
    expect(screen.queryByRole("group", { name: CONF_GROUP })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: CONF_BUTTON })).toBeDisabled();
  });
});

describe("pending confirmation dies on batch mutation (PROOF 6)", () => {
  it("dies when the Job is replaced (zero downloads; fresh request required)", () => {
    const { job, sessions } = realisticBatch();
    const captured = captureDownloads();
    try {
      const view = render(<ExportStep job={job} review={null} batchSessions={sessions} />);
      fireEvent.click(screen.getByRole("button", { name: CONF_BUTTON }));
      expect(screen.getByRole("group", { name: CONF_GROUP })).toBeInTheDocument();

      const otherJob = withReviewState(job, { complete: true });
      view.rerender(<ExportStep job={otherJob} review={null} batchSessions={sessions} />);
      expect(screen.queryByRole("group", { name: CONF_GROUP })).not.toBeInTheDocument();
      fireEvent.click(screen.getByRole("button", { name: CONF_BUTTON }));
      expect(screen.getByRole("group", { name: CONF_GROUP })).toBeInTheDocument();
      expect(captured.downloads).toHaveLength(0);
    } finally {
      captured.restore();
    }
  });

  it("dies when the batch-session identity changes", () => {
    const { job, sessions } = realisticBatch();
    const view = render(<ExportStep job={job} review={null} batchSessions={sessions} />);
    fireEvent.click(screen.getByRole("button", { name: CONF_BUTTON }));
    expect(screen.getByRole("group", { name: CONF_GROUP })).toBeInTheDocument();

    // A NEW record object is a batch-session identity change (#88: the
    // bridge always hands one exact current set).
    view.rerender(<ExportStep job={job} review={null} batchSessions={{ ...sessions }} />);
    expect(screen.queryByRole("group", { name: CONF_GROUP })).not.toBeInTheDocument();
  });

  it("dies when batch readiness is lost (button disabled again)", () => {
    const { job, sessions } = realisticBatch();
    const view = render(<ExportStep job={job} review={null} batchSessions={sessions} />);
    fireEvent.click(screen.getByRole("button", { name: CONF_BUTTON }));
    expect(screen.getByRole("group", { name: CONF_GROUP })).toBeInTheDocument();

    const staleJob = withReviewState(job, { complete: false });
    view.rerender(<ExportStep job={staleJob} review={null} batchSessions={sessions} />);
    expect(RESULT_STATE("needs-attention")).not.toBeNull();
    expect(screen.queryByRole("group", { name: CONF_GROUP })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: CONF_BUTTON })).toBeDisabled();
  });
});
