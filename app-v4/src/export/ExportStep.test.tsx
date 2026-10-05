import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ReactElement } from "react";
import { useState } from "react";
import "@testing-library/jest-dom/vitest";

import { ExportStep, downloadTextFile } from "./ExportStep";
import {
  applyDecision,
  canFinalize,
  createReviewSession,
  getFinalText,
  getProgress,
  type ReviewSession,
} from "../review/review-domain";
import {
  beginItemProcessing,
  beginItemRead,
  createJob,
  recordItemFailed,
  recordItemProcessed,
  recordItemRead,
  recordItemReviewCompletion,
  withReviewState,
  type Job,
  type OutputAvailability,
} from "../domain/job";
import { buildSafeOutput, serializeSafeOutput, type SafeOutput } from "../output/safe-output";
import { CONFIDENTIAL_AUDIT_WARNING_LINE } from "../output/confidential-audit-serializer";

/**
 * Oracles for Work Order T08 U4 (Export step, GitHub #12) and the REC-05 WU-B
 * single-item Result (D-024). All fixtures are synthetic Spanish clinical-style
 * text; no real content anywhere.
 *
 * The no-audit-data invariant is proven STRUCTURALLY (own enumerable key set +
 * value shapes on the reviewed service output), NOT by forbidden substring
 * scans on the safe artifact — the same style as output/safe-output.test.ts, so
 * the oracle can genuinely disagree.
 */

const SOURCE = "Nombre: Carmen Sánchez\nTeléfono 612345678. NHC 2024/089756.";
const NAME_START = SOURCE.indexOf("Carmen Sánchez");
const NAME_END = NAME_START + "Carmen Sánchez".length;
const PHONE_START = SOURCE.indexOf("612345678");
const PHONE_END = PHONE_START + "612345678".length;
const NHC_START = SOURCE.indexOf("2024/089756");
const NHC_END = NHC_START + "2024/089756".length;

function adversarialSession(): ReviewSession {
  return createReviewSession({
    originalText: SOURCE,
    detections: [
      {
        type: "NOMBRE",
        start: NAME_START,
        end: NAME_END,
        confidence: 0.95,
        proposed: "PACIENTE-1",
        reason: "regex NombrePropio",
        note: "nota interna de revisión: verificar apellidos",
        requiresReview: true,
      },
      {
        type: "IDENTIFICADOR",
        start: PHONE_START,
        end: PHONE_END,
        confidence: 0.6,
        proposed: "TEL-REEMPLAZO",
        note: "teléfono sintético sin código de país",
        requiresReview: true,
      },
      {
        type: "IDENTIFICADOR",
        start: NHC_START,
        end: NHC_END,
        confidence: 0.9,
        proposed: "ID-1",
        note: "NHC sintética del fixture",
        requiresReview: true,
      },
    ],
    sessionId: "export-step-test-session",
  });
}

function completedSession(): ReviewSession {
  const session = adversarialSession();
  let next = applyDecision(session, session.detections[0].id, "accepted");
  next = applyDecision(next, session.detections[1].id, "modified", {
    replacement: "TEL-FINAL",
    note: "sin código de país en la fuente",
  });
  next = applyDecision(next, session.detections[2].id, "accepted");
  return next;
}

/** One decision explicitly keeps the original phone (restored). */
function restoredSession(): ReviewSession {
  const session = adversarialSession();
  let next = applyDecision(session, session.detections[0].id, "accepted");
  next = applyDecision(next, session.detections[1].id, "restored");
  next = applyDecision(next, session.detections[2].id, "accepted");
  return next;
}

/** Ready session whose final text carries a non-representable PDF character. */
function unsupportedPdfSession(): ReviewSession {
  return createReviewSession({
    originalText: "Dosis de prueba α 10 mg cada 24 horas.",
    detections: [],
    sessionId: "pdf-refusal-session",
  });
}

/**
 * Build the Job exactly as the state bridge does (one atomic derivation
 * of the output availability from the review fact, D-005).
 */
function bridgeJobOn(base: Job, review: ReviewSession): Job {
  const safeOutputReady = canFinalize(review);
  const availability: OutputAvailability = {
    safeOutputReady,
    confidentialAuditReady: true,
  };
  return Object.freeze({
    ...withReviewState(base, { complete: safeOutputReady }),
    outputs: Object.freeze(availability),
  }) as Job;
}

function bridgeJob(review: ReviewSession): Job {
  return bridgeJobOn(createJob({ type: "pasted-text", text: SOURCE }), review);
}

function documentBridgeJob(review: ReviewSession): Job {
  return bridgeJobOn(
    createJob({
      type: "files",
      files: [
        {
          name: "informe-clinico.txt",
          extension: "txt",
          extraction: { status: "extracted", extractedText: SOURCE },
        },
      ],
    }),
    review
  );
}

/** Structural assertion the real output must pass and planted leaks must fail. */
function assertStructuralSafeOutput(value: unknown): void {
  const keys = Object.keys(value as object).sort();
  const allowed = ["kind", "text"];
  if (keys.length !== allowed.length || keys.some((k, i) => k !== allowed[i])) {
    throw new Error(`structural violation: keys must be ${JSON.stringify(allowed)}`);
  }
  for (const v of Object.values(value as Record<string, unknown>)) {
    if (Array.isArray(v) || (typeof v === "object" && v !== null)) {
      throw new Error("structural violation: no array- or object-shaped values allowed");
    }
  }
}

// ---------------------------------------------------------------------------
// Download capture: stubs the client-side download seam (no network).
// ---------------------------------------------------------------------------
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

/** jsdom's Blob lacks .text(); read the captured artifact via FileReader. */
async function textOf(download: CapturedDownload | undefined): Promise<string> {
  if (!download) throw new Error("expected a captured download");
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsText(download.blob);
  });
}

function clickButton(name: string) {
  fireEvent.click(screen.getByRole("button", { name }));
}

/**
 * Flush the real async generation windows (DOCX JSZip assembly, PDF build,
 * clipboard write). Bounded, deterministic: microtasks plus one macrotask tick.
 */
async function flushAsyncWork(): Promise<void> {
  await act(async () => {
    for (let i = 0; i < 25; i += 1) await Promise.resolve();
    await new Promise((resolve) => setTimeout(resolve, 0));
    for (let i = 0; i < 25; i += 1) await Promise.resolve();
  });
}

function stubClipboard(writeText: (text: string) => Promise<void>): void {
  Object.defineProperty(navigator, "clipboard", {
    configurable: true,
    value: { writeText: vi.fn(writeText) },
  });
}

const CLIPBOARD_OK = () => stubClipboard(() => Promise.resolve());

const RESULT_STATE = (state: string) => document.querySelector(`[data-result-state="${state}"]`);

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  delete (navigator as { clipboard?: unknown }).clipboard;
});

// ---------------------------------------------------------------------------
// Single-item Result: ready (pasted text and single document)
// ---------------------------------------------------------------------------
describe("REC-05 WU-B single-item Result — ready state", () => {
  beforeEach(CLIPBOARD_OK);

  it("presents an understandable ready Result for pasted text with a Copy primary", () => {
    const session = completedSession();
    render(<ExportStep job={bridgeJob(session)} review={session} />);

    expect(RESULT_STATE("ready")).not.toBeNull();
    expect(screen.getByRole("region", { name: "Listo para usar" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 2, name: "Resultado" })).toBeInTheDocument();

    // Copy is the single primary action.
    const copy = screen.getByRole("button", { name: "Copiar texto preparado" });
    expect(copy).toHaveAttribute("data-variant", "primary");

    // Secondary formats stay discoverable without equal weight.
    const secondary = screen.getByRole("group", { name: "Otros formatos disponibles" });
    expect(
      within(secondary).getByRole("button", { name: "Descargar como TXT (.txt)" })
    ).toBeInTheDocument();
    expect(
      within(secondary).getByRole("button", { name: "Descargar documento preparado (.docx)" })
    ).toBeInTheDocument();
    expect(
      within(secondary).getByRole("button", { name: "Descargar como PDF (.pdf)" })
    ).toBeInTheDocument();

    // Return/correction path is always present.
    expect(screen.getByRole("button", { name: "Volver a la revisión" })).toBeInTheDocument();
    // Confidential stays a separate sensitive zone.
    expect(screen.getByRole("region", { name: "Confidential Audit" })).toHaveTextContent(
      CONFIDENTIAL_AUDIT_WARNING_LINE
    );
  });

  it("presents a ready Result for a single document with ONE primary prepared download", () => {
    const session = completedSession();
    render(<ExportStep job={documentBridgeJob(session)} review={session} />);

    expect(RESULT_STATE("ready")).not.toBeNull();
    const primary = screen.getByRole("button", { name: "Descargar documento preparado (.docx)" });
    expect(primary).toHaveAttribute("data-variant", "primary");
    // Copy is discoverable but secondary for a document.
    const secondary = screen.getByRole("group", { name: "Otros formatos disponibles" });
    expect(
      within(secondary).getByRole("button", { name: "Copiar texto preparado" })
    ).toBeInTheDocument();
    expect(
      within(secondary).getByRole("button", { name: "Descargar como TXT (.txt)" })
    ).toBeInTheDocument();
    expect(
      within(secondary).getByRole("button", { name: "Descargar como PDF (.pdf)" })
    ).toBeInTheDocument();
  });

  it("does not present all formats as equal-weight primaries", () => {
    const session = completedSession();
    const { container } = render(<ExportStep job={documentBridgeJob(session)} review={session} />);
    expect(container.querySelectorAll('[data-variant="primary"]')).toHaveLength(1);
    expect(container.querySelectorAll('[data-variant="secondary"]').length).toBeGreaterThanOrEqual(
      3
    );
  });

  it("requires no Privacy Gate / serializer / ReviewSession vocabulary for comprehension", () => {
    const session = completedSession();
    render(<ExportStep job={bridgeJob(session)} review={session} />);
    const body = RESULT_STATE("ready")?.textContent ?? "";
    expect(body).not.toMatch(/Privacy Gate|Safe Output|ReviewSession|serializer|serializador/i);
    expect(body).not.toMatch(/source offset|Class\s*→\s*Action|Class→Action/i);
  });
});

// ---------------------------------------------------------------------------
// Single-item Result: needs attention / blocked are distinguishable from ready
// ---------------------------------------------------------------------------
describe("REC-05 WU-B single-item Result — needs attention and blocked", () => {
  beforeEach(CLIPBOARD_OK);

  it("marks pending mandatory review as 'needs attention' and disables prepared actions", () => {
    const session = adversarialSession(); // all three pending
    render(<ExportStep job={bridgeJob(session)} review={session} />);

    expect(RESULT_STATE("needs-attention")).not.toBeNull();
    expect(screen.getByRole("region", { name: "Requiere tu atención" })).toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent(
      "Quedan 3 decisiones de revisión obligatorias antes de poder preparar el resultado."
    );
    const primary = screen.getByRole("button", { name: "Copiar texto preparado" });
    expect(primary).toBeDisabled();
    expect(primary).toHaveAttribute("aria-describedby", "result-attention-reason");
    // No prepared/shareable secondary formats while not ready.
    expect(
      screen.queryByRole("group", { name: "Otros formatos disponibles" })
    ).not.toBeInTheDocument();
    // The return path remains available.
    expect(screen.getByRole("button", { name: "Volver a la revisión" })).toBeEnabled();
  });

  it("marks a blocked state distinctly with a factual reason", () => {
    const session = completedSession();
    const blockedJob = bridgeJobOn(createJob({ type: "pasted-text", text: SOURCE }), session);
    // A blocked Job: processing failed, no current review readiness.
    const failed = Object.freeze({
      ...withReviewState(blockedJob, { complete: false }),
      processing: "failed" as const,
      outputs: Object.freeze({ safeOutputReady: false, confidentialAuditReady: true }),
    }) as Job;
    render(<ExportStep job={failed} review={null} />);

    expect(RESULT_STATE("blocked")).not.toBeNull();
    expect(screen.getByRole("region", { name: "Bloqueado" })).toBeInTheDocument();
    expect(screen.getByRole("alert")).toHaveTextContent(/no se completó/i);
  });

  it("keeps the three states distinguishable and never renders ready + attention together", () => {
    const readySession = completedSession();
    const pendingSession = adversarialSession();
    const ready = render(<ExportStep job={bridgeJob(readySession)} review={readySession} />);
    expect(ready.container.querySelectorAll("[data-result-state]")).toHaveLength(1);
    expect(ready.container.querySelector('[data-result-state="ready"]')).not.toBeNull();
    ready.unmount();

    const pending = render(<ExportStep job={bridgeJob(pendingSession)} review={pendingSession} />);
    expect(pending.container.querySelectorAll("[data-result-state]")).toHaveLength(1);
    expect(pending.container.querySelector('[data-result-state="needs-attention"]')).not.toBeNull();
  });

  it("renders the factual kept-original warning and the kept original in the Safe text", () => {
    const session = restoredSession();
    const kept = getProgress(session).restoredDetections[0];
    expect(kept).toBeDefined();
    render(<ExportStep job={bridgeJob(session)} review={session} />);

    const warning = screen.getByRole("region", { name: "Originales conservados deliberadamente" });
    expect(warning).toHaveTextContent(`«${kept.type}»`);
    expect(warning).toHaveTextContent(/por una decisión de revisión/i);
    // The canonical Safe text keeps the deliberately restored original exactly.
    expect(getFinalText(session)).toContain("612345678");
  });
});

// ---------------------------------------------------------------------------
// Action feedback + failures (G-HP6 / PDR-11)
// ---------------------------------------------------------------------------
describe("REC-05 WU-B single-item Result — action feedback", () => {
  it("provides perceptible pending/success feedback for Copy, DOCX and PDF", async () => {
    CLIPBOARD_OK();
    const captured = captureDownloads();
    const session = completedSession();
    render(<ExportStep job={bridgeJob(session)} review={session} />);
    try {
      // Copy: pending then success.
      clickButton("Copiar texto preparado");
      expect(screen.getByRole("status")).toHaveTextContent("Copiando el texto preparado…");
      await flushAsyncWork();
      expect(screen.getByRole("status")).toHaveTextContent(
        "Texto preparado copiado al portapapeles."
      );

      // DOCX: pending then success + real download.
      clickButton("Descargar documento preparado (.docx)");
      expect(screen.getByRole("status")).toHaveTextContent("Preparando el documento (.docx)…");
      await waitFor(() =>
        expect(screen.getByRole("status")).toHaveTextContent(
          "Descarga del documento preparado (.docx) iniciada."
        )
      );
      expect(captured.downloads.at(-1)?.fileName).toBe("texto-preparado.docx");

      // PDF: pending then success + real download.
      clickButton("Descargar como PDF (.pdf)");
      expect(screen.getByRole("status")).toHaveTextContent("Preparando el archivo PDF…");
      await waitFor(() =>
        expect(screen.getByRole("status")).toHaveTextContent("Descarga del archivo PDF iniciada.")
      );
      expect(captured.downloads.at(-1)?.fileName).toBe("texto-preparado.pdf");
    } finally {
      captured.restore();
    }
  });

  it("shows a visible failure when the clipboard is rejected (no silent success)", async () => {
    stubClipboard(() => Promise.reject(new Error("NotAllowedError")));
    const session = completedSession();
    render(<ExportStep job={bridgeJob(session)} review={session} />);

    clickButton("Copiar texto preparado");
    await flushAsyncWork();

    const alert = screen.getByRole("alert");
    expect(alert).toHaveTextContent(/rechazó la escritura en el portapapeles/i);
  });

  it("shows a visible failure when the clipboard is unavailable", async () => {
    // No clipboard stub installed.
    const session = completedSession();
    render(<ExportStep job={bridgeJob(session)} review={session} />);

    clickButton("Copiar texto preparado");
    await flushAsyncWork();

    expect(screen.getByRole("alert")).toHaveTextContent(/portapapeles no está disponible/i);
  });

  it("shows a deterministic PDF-only failure, zero download, while TXT/DOCX still work", async () => {
    const captured = captureDownloads();
    const session = unsupportedPdfSession();
    render(<ExportStep job={bridgeJob(session)} review={session} />);
    try {
      clickButton("Descargar como PDF (.pdf)");
      await flushAsyncWork();

      // Deterministic refusal message, zero PDF download.
      expect(screen.getByRole("alert")).toHaveTextContent(/U\+03B1/i);
      expect(captured.downloads).toHaveLength(0);

      // TXT still works...
      clickButton("Descargar como TXT (.txt)");
      await waitFor(() => expect(captured.downloads).toHaveLength(1));
      expect(captured.downloads.at(-1)?.fileName).toBe("texto-preparado.txt");

      // ...and so does DOCX.
      clickButton("Descargar documento preparado (.docx)");
      await waitFor(() => expect(captured.downloads).toHaveLength(2));
      expect(captured.downloads.at(-1)?.fileName).toBe("texto-preparado.docx");
    } finally {
      captured.restore();
    }
  });
});

// ---------------------------------------------------------------------------
// Async current-authority safeguards (D-024 §4.6)
// ---------------------------------------------------------------------------
describe("REC-05 WU-B single-item Result — async stale guard", () => {
  beforeEach(CLIPBOARD_OK);

  it("produces no stale DOCX download when the Job changes during generation", async () => {
    const captured = captureDownloads();
    const session = completedSession();
    const view = render(<ExportStep job={bridgeJob(session)} review={session} />);
    try {
      clickButton("Descargar documento preparado (.docx)");
      // The real JSZip generation is suspended at its first await: mutate the
      // Job before it can resolve.
      expect(screen.getByRole("status")).toHaveTextContent("Preparando el documento (.docx)…");
      view.rerender(<ExportStep job={bridgeJob(session)} review={session} />);

      await waitFor(() =>
        expect(screen.getByText(/no se descargó ningún documento/i)).toBeInTheDocument()
      );
      expect(captured.downloads).toHaveLength(0);
    } finally {
      captured.restore();
    }
  });

  it("produces no stale PDF download when readiness changes during generation", async () => {
    const captured = captureDownloads();
    const session = completedSession();
    const ready = bridgeJob(session);
    const view = render(<ExportStep job={ready} review={session} />);
    try {
      clickButton("Descargar como PDF (.pdf)");
      // Suspend at the awaited PDF build, then the same review becomes no
      // longer ready (readiness change without a new review object).
      const notReady = Object.freeze({
        ...ready,
        outputs: Object.freeze({ safeOutputReady: false, confidentialAuditReady: true }),
      }) as Job;
      view.rerender(<ExportStep job={notReady} review={session} />);

      await waitFor(() =>
        expect(screen.getByText(/no se descargó ningún archivo/i)).toBeInTheDocument()
      );
      expect(captured.downloads).toHaveLength(0);
      expect(RESULT_STATE("blocked")).not.toBeNull();
    } finally {
      captured.restore();
    }
  });

  it("produces no stale PDF download when the review identity changes during generation", async () => {
    const captured = captureDownloads();
    const session = completedSession();
    const view = render(<ExportStep job={bridgeJob(session)} review={session} />);
    try {
      clickButton("Descargar como PDF (.pdf)");
      const otherSession = completedSession();
      view.rerender(<ExportStep job={bridgeJob(otherSession)} review={otherSession} />);

      await waitFor(() =>
        expect(screen.getByText(/no se descargó ningún archivo/i)).toBeInTheDocument()
      );
      expect(captured.downloads).toHaveLength(0);
    } finally {
      captured.restore();
    }
  });
});

// ---------------------------------------------------------------------------
// Session isolation / download helper contract (unchanged helpers)
// ---------------------------------------------------------------------------
describe("session isolation and rerender invariance", () => {
  beforeEach(CLIPBOARD_OK);

  it("re-renders never mutate the domain session nor the exported Safe TXT bytes", async () => {
    const session = completedSession();
    const sessionRef: { current: ReviewSession | null } = { current: null };
    const harness = render(
      <RerenderHarness job={bridgeJob(session)} review={session} sessionRef={sessionRef} />
    );
    const captured = captureDownloads();
    try {
      clickButton("Descargar como TXT (.txt)");
      const before = await textOf(captured.downloads[0]);

      fireEvent.click(harness.getByRole("button", { name: "Toggle unrelated panel" }));
      fireEvent.click(harness.getByRole("button", { name: "Toggle unrelated panel" }));
      expect(harness.queryByText("Unrelated transient panel")).not.toBeInTheDocument();

      clickButton("Descargar como TXT (.txt)");
      const after = await textOf(captured.downloads[1]);
      expect(after).toBe(before);
      expect(captured.downloads[1].fileName).toBe("texto-preparado.txt");

      // Rendering cannot swap or mutate the frozen domain session.
      expect(sessionRef.current).toBe(session);
      expect(Object.isFrozen(session)).toBe(true);
      expect(getFinalText(session)).toBe(before);
    } finally {
      captured.restore();
    }
  });

  it("the TXT artifact is byte-equal to the canonical final text and structurally free of audit data", async () => {
    const session = completedSession();
    const captured = captureDownloads();
    try {
      render(<ExportStep job={bridgeJob(session)} review={session} />);
      clickButton("Descargar como TXT (.txt)");

      const safeText = await textOf(captured.downloads[0]);
      const output: SafeOutput = buildSafeOutput(session);
      expect(safeText).toBe(serializeSafeOutput(output));
      expect(safeText).toBe(getFinalText(session));
      expect(() => assertStructuralSafeOutput(output)).not.toThrow();
      expect(new Set(Object.keys(output))).toEqual(new Set(["kind", "text"]));
    } finally {
      captured.restore();
    }
  });

  it("the download helper never touches the network and revokes its object URL", async () => {
    const captured = captureDownloads();
    const originalFetch = globalThis.fetch;
    const fetchSpy = vi.fn();
    globalThis.fetch = fetchSpy as unknown as typeof globalThis.fetch;
    try {
      downloadTextFile("texto-preparado.txt", "contenido sintético");
      expect(captured.downloads).toHaveLength(1);
      expect(await textOf(captured.downloads[0])).toBe("contenido sintético");
      expect(URL.revokeObjectURL).toHaveBeenCalledWith("blob:mock-1");
      expect(fetchSpy).not.toHaveBeenCalled();
    } finally {
      globalThis.fetch = originalFetch;
      captured.restore();
    }
  });
});

/** Wrapper that forces unrelated re-renders without touching the domain. */
function RerenderHarness(props: {
  job: Job;
  review: ReviewSession;
  sessionRef: { current: ReviewSession | null };
}): ReactElement {
  const [showPanel, setShowPanel] = useState(false);
  props.sessionRef.current = props.review;
  return (
    <div>
      <button type="button" onClick={() => setShowPanel((visible) => !visible)}>
        Toggle unrelated panel
      </button>
      {showPanel && <p>Unrelated transient panel</p>}
      <ExportStep job={props.job} review={props.review} />
    </div>
  );
}

describe("claims gate (D-006): no anonymity/compliance wording on the Result surface", () => {
  beforeEach(CLIPBOARD_OK);

  it("renders no privacy score, anonymity, GDPR or certification claims", () => {
    const session = completedSession();
    render(<ExportStep job={bridgeJob(session)} review={session} />);
    const body = document.body.textContent ?? "";
    expect(body).not.toMatch(/anonym|gdpr|privacy score|certif|complian|complien/i);
    expect(body).not.toMatch(/puntuación|anónimo|anónima|certifica/i);
  });
});

// ---------------------------------------------------------------------------
// Document batch (T17 #21): unchanged behavior, gains NO single-item surface
// ---------------------------------------------------------------------------
const SAFE_BUTTON = "Download Safe Output (.txt)";
const AUDIT_BUTTON = "Download Confidential Audit (.txt)";

function buildBatchJob(names: readonly string[] = ["informe-a.txt", "informe-b.txt"]): Job {
  return createJob({
    type: "files",
    files: names.map((name) => ({ name, extension: "txt" })),
  });
}

function readBatchOk(job: Job, index: number, text: string): Job {
  return recordItemRead(beginItemRead(job, index), index, { ok: true, extractedText: text });
}

function readBatchFail(job: Job, index: number, message: string): Job {
  return recordItemRead(beginItemRead(job, index), index, {
    ok: false,
    error: { code: "pdf-no-text-layer", message },
  });
}

function completeBatchItem(job: Job, index: number, text: string): Job {
  const processed = recordItemProcessed(
    beginItemProcessing(readBatchOk(job, index, text), index),
    index
  );
  return recordItemReviewCompletion(processed, index, true);
}

function pendingBatchJob(): Job {
  return readBatchOk(
    readBatchOk(buildBatchJob(), 0, "Contenido sintético A."),
    1,
    "Contenido sintético B."
  );
}

function failedBatchJob(): Job {
  const withFailure = readBatchFail(buildBatchJob(), 0, "El PDF no tiene capa de texto.");
  const completed = completeBatchItem(withFailure, 1, "Contenido sintético B.");
  return withReviewState(completed, { complete: true });
}

function completedBatchJob(): Job {
  const first = completeBatchItem(buildBatchJob(), 0, "Contenido sintético A.");
  const both = completeBatchItem(first, 1, "Contenido sintético B.");
  return withReviewState(both, { complete: true });
}

function policyUnsupportedBatchJob(): Job {
  let job = readBatchOk(buildBatchJob(), 0, "Contenido sintético A.");
  job = recordItemFailed(beginItemProcessing(job, 0), 0, {
    code: "policy-unsupported",
    message: "Policy is known but has no accepted per-category operator mapping.",
  });
  job = completeBatchItem(job, 1, "Contenido sintético B.");
  return withReviewState(job, { complete: true });
}

describe("document batch export (T17 #21): batch Safe Output stays unavailable", () => {
  it("keeps Safe Output disabled with the review-incomplete reason while review is pending", () => {
    render(<ExportStep job={pendingBatchJob()} review={null} />);

    const safeButton = screen.getByRole("button", { name: SAFE_BUTTON });
    expect(safeButton).toBeDisabled();
    const reason = screen.getByRole("alert");
    expect(reason).toHaveTextContent(
      "Safe export is blocked while 2 mandatory review decisions are pending."
    );
    expect(safeButton).toHaveAttribute("aria-describedby", reason.id);
  });

  it("names the failed file and the remedy when the reviewed batch has an error item", () => {
    render(<ExportStep job={failedBatchJob()} review={null} />);

    const safeButton = screen.getByRole("button", { name: SAFE_BUTTON });
    expect(safeButton).toBeDisabled();
    const reason = screen.getByRole("alert");
    expect(reason).toHaveTextContent('"informe-a.txt"');
    expect(reason).toHaveTextContent("El PDF no tiene capa de texto.");
    expect(reason).toHaveTextContent("Create a new job without it to continue.");
  });

  it("explains the not-yet-defined batch Safe Output format when review is complete without errors", () => {
    render(<ExportStep job={completedBatchJob()} review={null} />);

    const safeButton = screen.getByRole("button", { name: SAFE_BUTTON });
    expect(safeButton).toBeDisabled();
    const reason = screen.getByRole("alert");
    expect(reason).toHaveTextContent("Safe Output is not available for a document batch yet");
    expect(reason).not.toHaveTextContent(/batch item failed/i);
  });

  it("never renders the single-item Result surface or its prepared actions for a batch", () => {
    const { container } = render(<ExportStep job={completedBatchJob()} review={null} />);
    expect(container.querySelectorAll("[data-result-state]")).toHaveLength(0);
    expect(screen.queryByRole("button", { name: "Volver a la revisión" })).not.toBeInTheDocument();
    expect(
      screen.queryByRole("group", { name: "Otros formatos disponibles" })
    ).not.toBeInTheDocument();
  });

  it("reports Safe Output not ready and the batch audit unavailable for a fully reviewed error-free batch", () => {
    render(<ExportStep job={completedBatchJob()} review={null} />);

    const safeButton = screen.getByRole("button", { name: SAFE_BUTTON });
    expect(safeButton).toBeDisabled();
    expect(screen.getByRole("alert")).toHaveTextContent(
      "Safe Output is not available for a document batch yet"
    );

    const auditButton = screen.getByRole("button", { name: AUDIT_BUTTON });
    expect(auditButton).toBeDisabled();
    expect(auditButton).toHaveAttribute("aria-describedby", "confidential-audit-blocked-reason");
    expect(
      screen.getByText(/Confidential Audit is not available for a document batch yet/)
    ).toBeInTheDocument();
  });

  it("never presents the active document's review as a batch-wide Confidential Audit", () => {
    const session = completedSession();
    render(<ExportStep job={completedBatchJob()} review={session} />);

    expect(screen.getByRole("button", { name: AUDIT_BUTTON })).toBeDisabled();
    expect(screen.getByRole("button", { name: SAFE_BUTTON })).toBeDisabled();
    expect(screen.getByText(/not a batch-wide audit/i)).toBeInTheDocument();
  });

  it("offers the policy remedy for a policy-unsupported failure instead of removing the document", () => {
    render(<ExportStep job={policyUnsupportedBatchJob()} review={null} />);

    const reason = screen.getByRole("alert");
    expect(reason).toHaveTextContent("Policy is known but has no accepted per-category operator");
    expect(reason).toHaveTextContent("Choose a supported Privacy Policy");
    expect(reason).not.toHaveTextContent(/new job without/i);
  });

  it("keeps the recreate remedy for a representative read failure", () => {
    render(<ExportStep job={failedBatchJob()} review={null} />);

    const reason = screen.getByRole("alert");
    expect(reason).toHaveTextContent('"informe-a.txt"');
    expect(reason).toHaveTextContent("Create a new job without it to continue.");
    expect(reason).not.toHaveTextContent(/supported Privacy Policy/i);
  });
});
