import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { useState, type ReactElement } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import "@testing-library/jest-dom/vitest";

import {
  acknowledgeBatchItemError,
  batchItemStatus,
  beginBatchItemRetry,
  beginItemProcessing,
  beginItemRead,
  createJob,
  recordItemFailed,
  recordItemProcessed,
  recordItemRead,
  recordItemReviewCompletion,
  removeBatchItem,
  type Job,
} from "../domain/job";
import { createRegistryEngine } from "../engine/registry-engine";
import {
  applyDecision,
  getPendingDetections,
  processBatchItem,
  type ReviewSession,
} from "./review-domain";
import { useJobSession, type BatchItemRetryResult } from "../useJobSession";
import { BatchReviewView } from "./BatchReviewView";

/**
 * Controllable engine-loader seam (same oracle pattern as useJobSession.test):
 * the REAL composed engine, with a deterministic per-text processing failure
 * and a hold-open loader so in-flight attempts are observable. Only the hook
 * harness below uses it; the component-level fixtures build sessions through
 * `processBatchItem` with explicitly injected engines.
 */
const seamControl = vi.hoisted(() => ({
  hold: false,
  pending: [] as Array<{ resolve: () => void }>,
  /** Exact extracted texts whose processing fails deterministically. */
  markerTexts: null as readonly string[] | null,
}));

vi.mock("../engine/engine-seam", () => ({
  loadRegistryEngine: async () => {
    const { createRegistryEngine: createReal } = await import("../engine/registry-engine");
    const engine = createReal();
    const adapted = {
      process: async (input: Parameters<typeof engine.process>[0]) => {
        if (seamControl.markerTexts !== null && seamControl.markerTexts.includes(input.text)) {
          throw new Error("Injected deterministic processing failure (#78 oracle).");
        }
        return engine.process(input);
      },
    };
    if (seamControl.hold) {
      await new Promise<void>((resolve) => {
        seamControl.pending.push({ resolve });
      });
    }
    return adapted;
  },
}));

function releaseSeamEngine(): void {
  for (const entry of seamControl.pending) entry.resolve();
  seamControl.pending = [];
}

/**
 * Batch failure recovery (#78, REC-06) work-queue oracles (handoff §7
 * witnesses 3/4/5/8). The sessions are REAL ReviewSessions produced by the
 * REAL engine through `processBatchItem`; every recovery mutation is a spy,
 * because the component owns NO domain authority — it only calls the bridge.
 * All fixtures are synthetic; no real content anywhere.
 */
const TEXT_A = "Nombre: Carmen Sánchez. La paciente fue atendida por el Dr. García López.";
const TEXT_B = "Paciente: Roberto Díaz. Contacto: 654321987.";
const TEXT_C = "Nombre: Carmen Sánchez. Contacto: 612345678.";

const realEngine = createRegistryEngine();
const asyncEngine = {
  process: async (input: Parameters<typeof realEngine.process>[0]) => realEngine.process(input),
};

/** Build a batch job through the domain read phase. */
function batchJobWith(
  reads: readonly { name: string; read: Parameters<typeof recordItemRead>[2] }[]
): Job {
  let job = createJob({
    type: "files",
    files: reads.map((entry) => ({ name: entry.name, extension: "txt" })),
  });
  reads.forEach((entry, index) => {
    job = recordItemRead(beginItemRead(job, index), index, entry.read);
  });
  return job;
}

/** Mark items 0/1 processed (`review-required`) as a real batch run would. */
function withProcessedItems(job: Job): Job {
  for (const index of [0, 1]) {
    job = recordItemProcessed(beginItemProcessing(job, index), index);
  }
  return job;
}

/** A batch whose item C failed PROCESSING (retained text ⇒ retryable). */
function processingFailureJob(): Job {
  let job = batchJobWith([
    { name: "doc-a.txt", read: { ok: true, extractedText: TEXT_A } },
    { name: "doc-b.txt", read: { ok: true, extractedText: TEXT_B } },
    { name: "doc-c.txt", read: { ok: true, extractedText: TEXT_C } },
  ]);
  job = withProcessedItems(job);
  job = recordItemFailed(beginItemProcessing(job, 2), 2, {
    code: "processing-failed",
    message: "Synthetic processing failure.",
  });
  return job;
}

/** A batch whose item C failed READ (no retained text ⇒ NOT retryable). */
function readFailureJob(): Job {
  return withProcessedItems(
    batchJobWith([
      { name: "doc-a.txt", read: { ok: true, extractedText: TEXT_A } },
      { name: "doc-b.txt", read: { ok: true, extractedText: TEXT_B } },
      {
        name: "doc-c.txt",
        read: { ok: false, error: { code: "pdf-no-text-layer", message: "No text layer." } },
      },
    ])
  );
}

async function sessionFor(job: Job, index: number): Promise<ReviewSession> {
  const outcome = await processBatchItem(job, index, { mode: "fresh" }, asyncEngine);
  if (!outcome.ok) throw new Error("expected a successful engine outcome for the fixture");
  return outcome.session;
}

function completedSession(session: ReviewSession): ReviewSession {
  let updated = session;
  for (const detection of getPendingDetections(updated)) {
    updated = applyDecision(updated, detection.id, "restored");
  }
  return updated;
}

type RenderProps = Partial<Parameters<typeof BatchReviewView>[0]> & { job: Job };

async function renderView(overrides: RenderProps) {
  const { job, sessions: sessionOverrides, ...rest } = overrides;
  const sessions = sessionOverrides ?? {
    0: completedSession(await sessionFor(job, 0)),
    1: await sessionFor(job, 1),
  };
  const props = {
    job,
    sessions,
    activeIndex: 0,
    retryContextAvailable: true,
    onSelectDocument: vi.fn(),
    onDecide: vi.fn(),
    onAddManual: vi.fn(),
    onRetryBatchItem: vi.fn(async (): Promise<BatchItemRetryResult> => ({
      kind: "settled",
      failure: null,
    })),
    onRemoveBatchItem: vi.fn(),
    onAcknowledgeBatchItemError: vi.fn(),
    errorMessage: null,
    ...rest,
  };
  render(<BatchReviewView {...props} />);
  return { props };
}

afterEach(() => {
  seamControl.hold = false;
  seamControl.pending = [];
  seamControl.markerTexts = null;
  cleanup();
});

/** The one status region whose text matches `pattern` (several may exist). */
function statusWith(pattern: RegExp): HTMLElement | undefined {
  return screen.getAllByRole("status").find((element) => pattern.test(element.textContent ?? ""));
}

describe("BatchReviewView failure recovery (#78, REC-06)", () => {
  it("renders the composed Spanish work queue: recovery controls co-located, unrelated documents usable (witness 8)", async () => {
    // One document already finished its review (the only path to
    // `completed`), one still requires review, one failed processing.
    const job = recordItemReviewCompletion(processingFailureJob(), 0, true);
    const { props } = await renderView({ job });
    // #86: the queue opens on Necesitan atención; choose Todos to see the
    // completed row alongside the attention rows.
    fireEvent.click(screen.getByRole("button", { name: "Todos (3)" }));
    const list = screen.getByRole("list", { name: "Batch document status" });

    // Spanish status labels, conveyed by text (never color alone).
    expect(within(list).getByText("Completado")).toBeInTheDocument();
    expect(within(list).getByText("Requiere revisión")).toBeInTheDocument();
    expect(within(list).getByText("Error")).toBeInTheDocument();
    // The English status vocabulary is gone from the reworked surface.
    expect(list).not.toHaveTextContent("Review required");
    expect(list).not.toHaveTextContent("Completed");

    // The failed item keeps its typed message and carries ALL recovery
    // actions co-located with it (a processing failure with retained text
    // under a retained shared context).
    const failedRow = screen.getByText(/Synthetic processing failure\./).closest("div")!;
    expect(within(failedRow).getByRole("button", { name: "Reintentar" })).toBeInTheDocument();
    expect(within(failedRow).getByRole("button", { name: "Retirar del lote" })).toBeInTheDocument();
    expect(within(failedRow).getByRole("button", { name: "Reconocer error" })).toBeInTheDocument();

    // Unrelated successful/pending rows keep their selector buttons.
    const selectorA = screen.getByRole("button", { name: /doc-a\.txt/ });
    const selectorB = screen.getByRole("button", { name: /doc-b\.txt/ });
    fireEvent.click(selectorB);
    expect(props.onSelectDocument).toHaveBeenCalledWith(1);
    expect(selectorA).toHaveAttribute("aria-current", "true");

    // One quiet factual Spanish consistency line, no toggle, no internal
    // vocabulary, no anonymity claim.
    expect(screen.getByText(/sustituciones internas y fechas coherentes/i)).toBeInTheDocument();
    expect(screen.queryByText(/ProcessingContext/i)).not.toBeInTheDocument();
  });

  it("offers NO retry for a read failure without retained text (witness 3)", async () => {
    await renderView({ job: readFailureJob() });
    expect(screen.queryByRole("button", { name: "Reintentar" })).not.toBeInTheDocument();
    // The retained typed message stays visible and the other recovery
    // actions remain available.
    expect(screen.getByText(/No text layer\./)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Retirar del lote" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Reconocer error" })).toBeInTheDocument();
  });

  it("offers no retry when the bridge holds no retained shared context (fail-closed)", async () => {
    await renderView({ job: processingFailureJob(), retryContextAvailable: false });
    expect(screen.queryByRole("button", { name: "Reintentar" })).not.toBeInTheDocument();
  });

  it("remove confirmation: first action and Cancel are zero mutation; Confirm applies exactly once (witness 4)", async () => {
    const { props } = await renderView({ job: processingFailureJob() });

    // First action only REVEALS the consequence; nothing is applied yet.
    fireEvent.click(screen.getByRole("button", { name: "Retirar del lote" }));
    expect(props.onRemoveBatchItem).not.toHaveBeenCalled();
    const group = screen.getByRole("group", { name: /Confirmar la retirada de doc-c\.txt/ });
    expect(group).toHaveTextContent(/dejará de participar en el trabajo pendiente del lote/i);
    expect(group).toHaveTextContent(/su nombre y su error seguirán registrados/i);
    expect(group).toHaveTextContent(/los demás documentos no se verán afectados/i);

    // Cancel: zero mutation, the confirm disappears.
    fireEvent.click(within(group).getByRole("button", { name: "Cancelar" }));
    expect(
      screen.queryByRole("group", { name: /Confirmar la retirada de doc-c\.txt/ })
    ).not.toBeInTheDocument();
    expect(props.onRemoveBatchItem).not.toHaveBeenCalled();

    // Confirm applies exactly once, with the item's index.
    fireEvent.click(screen.getByRole("button", { name: "Retirar del lote" }));
    fireEvent.click(screen.getByRole("button", { name: "Confirmar retirada" }));
    expect(props.onRemoveBatchItem).toHaveBeenCalledTimes(1);
    expect(props.onRemoveBatchItem).toHaveBeenCalledWith(2);
  });

  it("a removed item shows the retained failure plus the disposition and no recovery actions", async () => {
    const removed = removeBatchItem(processingFailureJob(), 2);
    await renderView({ job: removed });
    // #86: a removed error leaves active attention; it stays discoverable in
    // Retirados (and Todos).
    fireEvent.click(screen.getByRole("button", { name: "Retirados (1)" }));
    const list = screen.getByRole("list", { name: "Batch document status" });
    expect(within(list).getByText(/Retirado del lote/)).toBeInTheDocument();
    expect(within(list).getByText(/Synthetic processing failure\./)).toBeInTheDocument();
    expect(list).toHaveTextContent("Error");
    // No further recovery actions on a disposed item.
    expect(screen.queryByRole("button", { name: "Reintentar" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Retirar del lote" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Reconocer error" })).not.toBeInTheDocument();
  });

  it("acknowledge is immediate, gives perceptible feedback and keeps the error visible (witness 5)", async () => {
    const { props } = await renderView({ job: processingFailureJob() });
    expect(props.onAcknowledgeBatchItemError).toBeDefined();

    fireEvent.click(screen.getByRole("button", { name: "Reconocer error" }));
    expect(props.onAcknowledgeBatchItemError).toHaveBeenCalledTimes(1);
    expect(props.onAcknowledgeBatchItemError).toHaveBeenCalledWith(2);
    // Perceptible feedback, factual: acknowledging never claims resolution.
    const feedback = statusWith(/Error reconocido/i);
    expect(feedback).toBeDefined();
    expect(feedback).toHaveTextContent(/no lo resuelve/i);
  });

  it("an acknowledged item keeps its error status, shows the fact and keeps retry/remove (after parent re-render)", async () => {
    const acknowledged = acknowledgeBatchItemError(processingFailureJob(), 2);
    await renderView({ job: acknowledged });
    const list = screen.getByRole("list", { name: "Batch document status" });
    expect(within(list).getByText(/Error reconocido/)).toBeInTheDocument();
    expect(within(list).getByText("Error")).toBeInTheDocument();
    // Retry and removal stay available; the acknowledge action is gone.
    expect(screen.getByRole("button", { name: "Reintentar" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Retirar del lote" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Reconocer error" })).not.toBeInTheDocument();
  });

  it("retry gives perceptible pending and success feedback only for a SETTLED success", async () => {
    let resolveRetry: (result: BatchItemRetryResult) => void = () => {};
    const onRetryBatchItem = vi.fn(
      () =>
        new Promise<BatchItemRetryResult>((resolve) => {
          resolveRetry = resolve;
        })
    );
    const { props } = await renderView({ job: processingFailureJob(), onRetryBatchItem });

    fireEvent.click(screen.getByRole("button", { name: "Reintentar" }));
    expect(props.onRetryBatchItem).toHaveBeenCalledWith(2);
    // Pending: the control is disabled and a status is perceptible.
    expect(screen.getByRole("button", { name: "Reintentar" })).toBeDisabled();
    expect(statusWith(/Reintentando…/)).toBeDefined();

    // Success feedback, co-located and factual — for a settled success only.
    resolveRetry({ kind: "settled", failure: null });
    await waitFor(() => expect(statusWith(/Reintento completado/i)).toBeDefined());
    expect(statusWith(/disponible para revisión/i)).toBeDefined();
  });

  it("a REFUSED retry is never announced as success (correction F2)", async () => {
    let resolveRetry: (result: BatchItemRetryResult) => void = () => {};
    const onRetryBatchItem = vi.fn(
      () =>
        new Promise<BatchItemRetryResult>((resolve) => {
          resolveRetry = resolve;
        })
    );
    const { props } = await renderView({ job: processingFailureJob(), onRetryBatchItem });

    fireEvent.click(screen.getByRole("button", { name: "Reintentar" }));
    await waitFor(() => expect(props.onRetryBatchItem).toHaveBeenCalledTimes(1));

    // The bridge refused the attempt (stale/overlapping): zero mutation.
    resolveRetry({ kind: "refused" });
    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent(/El reintento no se realizó/i);
    // No success copy anywhere, and no pending state left behind.
    expect(screen.queryByText(/Reintento completado/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Reintentando…/)).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Reintentar" })).toBeEnabled();
  });

  it("retry failure feedback is an alert carrying the typed failure", async () => {
    const onRetryBatchItem = vi.fn(async (): Promise<BatchItemRetryResult> => ({
      kind: "settled",
      failure: {
        code: "processing-failed" as const,
        message: "Typed failure surfaced to the row.",
      },
    }));
    await renderView({ job: processingFailureJob(), onRetryBatchItem });
    fireEvent.click(screen.getByRole("button", { name: "Reintentar" }));
    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent(/El reintento no se completó/i);
    expect(alert).toHaveTextContent("Typed failure surfaced to the row.");
  });

  it("queued items show the Spanish queued label and native keyboard-operable controls", async () => {
    const queuedOnly = batchJobWith([
      { name: "doc-a.txt", read: { ok: true, extractedText: TEXT_A } },
      { name: "doc-b.txt", read: { ok: true, extractedText: TEXT_B } },
    ]);
    // Only the item with a session is a selector button; job status stays
    // `queued` for both rows (review completion is a separate domain fact).
    const sessions = { 0: completedSession(await sessionFor(queuedOnly, 0)) };
    await renderView({ job: queuedOnly, sessions });
    const list = screen.getByRole("list", { name: "Batch document status" });
    expect(within(list).getAllByText("En cola")).toHaveLength(2);
    for (const button of screen.getAllByRole("button")) {
      expect(button.tagName).toBe("BUTTON");
    }
  });

  it("the no-session empty state is Spanish, factual and never instructs job recreation (correction F5)", async () => {
    // No session at all: the empty state composes the failure-aware copy.
    await renderView({ job: processingFailureJob(), sessions: {}, activeIndex: null });
    const emptyState = screen
      .getAllByRole("status")
      .find((element) => /documento disponible para revisión/.test(element.textContent ?? ""));
    expect(emptyState).toBeDefined();
    expect(emptyState).toHaveTextContent(/acciones de recuperación que cada uno ofrece/);
    // No English remedy text and no whole-Job reconstruction instruction:
    // local recovery exists, so the copy never points at job recreation.
    expect(emptyState).not.toHaveTextContent(/Create a new job/i);
    expect(emptyState).not.toHaveTextContent(/crear un nuevo trabajo/i);
  });
});

/**
 * Correction F2: the retry attempt lifecycle driven through the REAL bridge
 * (`useJobSession`) and REAL domain transitions — never spies on the
 * callbacks. The engine seam is the same controllable oracle pattern as
 * `useJobSession.test.tsx`. Fixtures are synthetic; no real content anywhere.
 */
describe("BatchReviewView retry lifecycle through the real bridge (correction F2)", () => {
  const DOC_A = "Nombre: Carmen Sánchez. La paciente fue atendida por el Dr. García López.";
  const DOC_B = "Nombre: Carmen Sánchez. La paciente Marta Gómez acude a consulta.";
  const DOC_C = "Paciente: Roberto Díaz. Contacto: 654321987.";
  const DOC_D = "Nombre: Lucía Ruiz. Revisión de control hospitalaria.";

  type SessionHook = ReturnType<typeof useJobSession>;

  function BridgeHarness({ handle }: { handle: { current: SessionHook | null } }) {
    const session = useJobSession();
    handle.current = session;
    const job = session.job;
    if (job === null || job.kind !== "document-batch") {
      return <p role="status">sin lote activo</p>;
    }
    return (
      <BatchReviewView
        job={job}
        sessions={session.batchSessions}
        activeIndex={session.batchActiveIndex}
        retryContextAvailable={session.batchRetryContextAvailable}
        onSelectDocument={session.selectDocument}
        onDecide={session.decide}
        onAddManual={session.addManual}
        onRetryBatchItem={(index, options) =>
          session.retryBatchItem(job.id, job.policyId, index, options)
        }
        onRemoveBatchItem={(index) => session.removeBatchItem(job.id, job.policyId, index)}
        onAcknowledgeBatchItemError={(index) =>
          session.acknowledgeBatchItemError(job.id, job.policyId, index)
        }
      />
    );
  }

  /** The `li` of one document's row in the work queue. */
  function rowOf(name: string): HTMLElement {
    const row = screen
      .getAllByRole("listitem")
      .find((element) => element.textContent?.includes(name));
    if (row === undefined) throw new Error(`no work-queue row for ${name}`);
    return row;
  }

  /**
   * Render the harness with a real 4-document batch whose items B and D
   * failed PROCESSING (retained text ⇒ both retryable).
   */
  async function renderFailingBatch(handle: { current: SessionHook | null }) {
    render(<BridgeHarness handle={handle} />);
    // Each mutation is its own act block so the bridge's stateRef observes
    // every committed update (same discipline as useJobSession.test).
    act(() => {
      handle.current!.create({
        type: "files",
        files: [
          { name: "doc-a.txt", extension: "txt" },
          { name: "doc-b.txt", extension: "txt" },
          { name: "doc-c.txt", extension: "txt" },
          { name: "doc-d.txt", extension: "txt" },
        ],
      });
    });
    act(() => handle.current!.beginBatchItemRead(0));
    act(() => handle.current!.recordBatchItemRead(0, { ok: true, extractedText: DOC_A }));
    act(() => handle.current!.beginBatchItemRead(1));
    act(() => handle.current!.recordBatchItemRead(1, { ok: true, extractedText: DOC_B }));
    act(() => handle.current!.beginBatchItemRead(2));
    act(() => handle.current!.recordBatchItemRead(2, { ok: true, extractedText: DOC_C }));
    act(() => handle.current!.beginBatchItemRead(3));
    act(() => handle.current!.recordBatchItemRead(3, { ok: true, extractedText: DOC_D }));
    // Arm the deterministic processing failures for items B and D.
    seamControl.markerTexts = [DOC_B, DOC_D];
    await act(async () => {
      await handle.current!.startReview();
    });
    seamControl.markerTexts = null;
    expect(batchItemStatus(handle.current!.job!, 1)).toBe("error");
    expect(batchItemStatus(handle.current!.job!, 3)).toBe("error");
    expect(handle.current!.batchRetryContextAvailable).toBe(true);
  }

  it("an in-flight retry keeps its own row pending, keeps OTHER rows double-fire safe and settles with real feedback", async () => {
    const handle: { current: SessionHook | null } = { current: null };
    await renderFailingBatch(handle);
    seamControl.hold = true;

    // Fire the retry of item B through the REAL bridge.
    fireEvent.click(within(rowOf("doc-b.txt")).getByRole("button", { name: "Reintentar" }));

    // The retry's own queued→processing transition is a real job update —
    // it must NOT wipe the pending state.
    await waitFor(() => expect(batchItemStatus(handle.current!.job!, 1)).toBe("processing"));
    expect(statusWith(/Reintentando…/)).toBeDefined();

    // THE F2 defect: another failed row's retry control must stay
    // double-fire safe (disabled) while the attempt is in flight — the
    // pre-correction code re-enabled it on the job transition.
    const retryD = within(rowOf("doc-d.txt")).getByRole("button", { name: "Reintentar" });
    expect(retryD).toBeDisabled();

    // A REAL unrelated domain update mid-attempt (an explicit decision on
    // document A) does not wipe the pending state or re-enable the control.
    act(() => handle.current!.selectDocument(0));
    const detection = getPendingDetections(handle.current!.batchSessions![0])[0];
    act(() => handle.current!.decide(detection.id, "restored"));
    expect(statusWith(/Reintentando…/)).toBeDefined();
    expect(within(rowOf("doc-d.txt")).getByRole("button", { name: "Reintentar" })).toBeDisabled();

    // The attempt settles: pending clears, B gains real review authority and
    // the controls are available again.
    seamControl.hold = false;
    act(() => releaseSeamEngine());
    await waitFor(() => expect(statusWith(/Reintento completado/i)).toBeDefined());
    expect(screen.queryByText(/Reintentando…/)).not.toBeInTheDocument();
    expect(batchItemStatus(handle.current!.job!, 1)).toBe("review-required");
    expect(within(rowOf("doc-d.txt")).getByRole("button", { name: "Reintentar" })).toBeEnabled();
  });

  it("a retry refused by a policy authority replacement is NEVER announced as success", async () => {
    const handle: { current: SessionHook | null } = { current: null };
    await renderFailingBatch(handle);
    seamControl.hold = true;

    fireEvent.click(within(rowOf("doc-b.txt")).getByRole("button", { name: "Reintentar" }));
    await waitFor(() => expect(batchItemStatus(handle.current!.job!, 1)).toBe("processing"));

    // A REAL policy authority replacement (same job id) while in flight: the
    // bridge refuses the attempt instead of installing its outcome.
    act(() => handle.current!.updatePolicy("strict"));
    seamControl.hold = false;
    act(() => releaseSeamEngine());

    // The item is reset by the policy change itself and the outcome is dropped.
    await waitFor(() => expect(batchItemStatus(handle.current!.job!, 1)).toBe("queued"));
    // The refusal is reported as NOT a success: factual alert, no success copy.
    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent(/El reintento no se realizó/i);
    expect(screen.queryByText(/Reintento completado/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Reintentando…/)).not.toBeInTheDocument();
  });
});

/**
 * Work-queue orientation (#86, REC-06). All fixtures are synthetic; no real
 * content anywhere. The view categories are presentation-only: these oracles
 * prove counts/filtering/orientation while the canonical per-row state and
 * every #78 recovery semantic stay untouched.
 */
describe("BatchReviewView work-queue orientation (#86, REC-06)", () => {
  /**
   * A realistic 16-item queue spanning every presentation category:
   * - `completed` (Listos): 0, 1;
   * - `review-required` + active errors (Necesitan atención): 2, 3, 4, 5, 15,
   *   plus processing errors 9, 10 (10 acknowledged) and read error 11;
   * - `queued`/`reading`/`processing` (En curso): 6, 7, 8;
   * - removed errors (Retirados): 12, 13 (read), 14 (acknowledged then removed).
   */
  function orientationJob(): Job {
    const names = Array.from(
      { length: 16 },
      (_entry, index) => `queue-doc-${String(index + 1).padStart(2, "0")}.txt`
    );
    let job = createJob({
      type: "files",
      files: names.map((name) => ({ name, extension: "txt" })),
    });
    names.forEach((_name, index) => {
      job = beginItemRead(job, index);
      // Item 7 stays `reading`; the read outcome is never recorded for it.
      if (index === 7) return;
      if (index === 11 || index === 13) {
        job = recordItemRead(job, index, {
          ok: false,
          error: { code: "pdf-no-text-layer", message: "No text layer." },
        });
      } else {
        job = recordItemRead(job, index, {
          ok: true,
          extractedText: `${TEXT_A} Documento sintético ${index}.`,
        });
      }
    });
    const processed = (index: number) => {
      job = recordItemProcessed(beginItemProcessing(job, index), index);
    };
    const failed = (index: number) => {
      job = recordItemFailed(beginItemProcessing(job, index), index, {
        code: "processing-failed",
        message: "Synthetic processing failure.",
      });
    };
    [0, 1, 2, 3, 4, 5, 15].forEach(processed);
    [9, 10, 12, 14].forEach(failed);
    job = beginItemProcessing(job, 8);
    job = recordItemReviewCompletion(job, 0, true);
    job = recordItemReviewCompletion(job, 1, true);
    job = acknowledgeBatchItemError(job, 10);
    job = removeBatchItem(job, 12);
    job = removeBatchItem(job, 13);
    job = removeBatchItem(job, 14);
    return job;
  }

  it("orients a 16-item queue with live Spanish counts and exact canonical row state (G-HP5)", async () => {
    await renderView({ job: orientationJob() });

    // Default: Necesitan atención because it has items; every count is live.
    expect(screen.getByRole("button", { name: "Necesitan atención (8)" })).toHaveAttribute(
      "aria-pressed",
      "true"
    );
    expect(screen.getByRole("button", { name: "Todos (16)" })).toHaveAttribute(
      "aria-pressed",
      "false"
    );
    expect(screen.getByRole("button", { name: "En curso (3)" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Listos (2)" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Retirados (3)" })).toBeInTheDocument();

    const list = screen.getByRole("list", { name: "Batch document status" });
    // The attention view is exactly its 8 rows, each with its factual status.
    expect(within(list).getAllByRole("listitem")).toHaveLength(8);
    expect(within(list).getAllByText("Requiere revisión")).toHaveLength(5);
    expect(within(list).getAllByText("Error")).toHaveLength(3);
    expect(list).not.toHaveTextContent("Completado");
    expect(list).not.toHaveTextContent("Retirado del lote");

    // Todos keeps every original item with its exact canonical state.
    fireEvent.click(screen.getByRole("button", { name: "Todos (16)" }));
    expect(within(list).getAllByRole("listitem")).toHaveLength(16);
    expect(within(list).getAllByText("Completado")).toHaveLength(2);
    expect(within(list).getAllByText("En cola")).toHaveLength(1);
    expect(within(list).getAllByText("Leyendo")).toHaveLength(1);
    expect(within(list).getAllByText("Procesando")).toHaveLength(1);
    expect(within(list).getAllByText(/Retirado del lote/)).toHaveLength(3);
  });

  it("locates completed and removed documents without the attention rows", async () => {
    await renderView({ job: orientationJob() });
    const list = screen.getByRole("list", { name: "Batch document status" });

    fireEvent.click(screen.getByRole("button", { name: "Listos (2)" }));
    expect(within(list).getAllByRole("listitem")).toHaveLength(2);
    expect(within(list).getAllByText("Completado")).toHaveLength(2);
    expect(list).not.toHaveTextContent("Requiere revisión");

    fireEvent.click(screen.getByRole("button", { name: "Retirados (3)" }));
    expect(within(list).getAllByRole("listitem")).toHaveLength(3);
    expect(within(list).getAllByText(/Retirado del lote/)).toHaveLength(3);
    // A removed item stays distinguishable from a completed one: still `error`.
    expect(within(list).getAllByText("Error")).toHaveLength(3);
  });

  it("keeps an acknowledged error in attention and a removed error out of it", async () => {
    await renderView({ job: orientationJob() });
    const list = screen.getByRole("list", { name: "Batch document status" });
    const item = (name: string) => within(list).getByText(name);

    // item 10 (acknowledged) is still attention; item 12 (removed) is not.
    expect(item("queue-doc-11.txt")).toBeInTheDocument();
    expect(within(list).getByText(/Error reconocido/)).toBeInTheDocument();
    expect(within(list).queryByText("queue-doc-13.txt")).not.toBeInTheDocument();

    // Removed errors stay discoverable in Retirados and Todos.
    fireEvent.click(screen.getByRole("button", { name: "Retirados (3)" }));
    expect(item("queue-doc-13.txt")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Todos (16)" }));
    expect(item("queue-doc-13.txt")).toBeInTheDocument();
    expect(item("queue-doc-11.txt")).toBeInTheDocument();
  });

  it("switching filters never changes the active document, its session or its decisions", async () => {
    const job = orientationJob();
    const sessions = { 0: await sessionFor(job, 0), 1: await sessionFor(job, 1) };
    const { props } = await renderView({ job, sessions, activeIndex: 0 });

    fireEvent.click(screen.getByRole("button", { name: "Listos (2)" }));
    fireEvent.click(screen.getByRole("button", { name: "Retirados (3)" }));
    fireEvent.click(screen.getByRole("button", { name: "Necesitan atención (8)" }));
    expect(props.onSelectDocument).not.toHaveBeenCalled();

    // The active document and its Review workspace survive; aria-current is
    // unchanged once the row is visible.
    fireEvent.click(screen.getByRole("button", { name: "Todos (16)" }));
    expect(screen.getByRole("button", { name: /queue-doc-01\.txt/ })).toHaveAttribute(
      "aria-current",
      "true"
    );
    expect(screen.getByRole("status", { name: "Review progress" })).toBeInTheDocument();
  });

  it("re-derives counts and membership from authoritative job props after review completion", async () => {
    const job = processingFailureJob();
    const sessions = { 0: completedSession(await sessionFor(job, 0)), 1: await sessionFor(job, 1) };
    const baseProps = {
      sessions,
      activeIndex: 1 as number | null,
      retryContextAvailable: true,
      onSelectDocument: vi.fn(),
      onDecide: vi.fn(),
      onAddManual: vi.fn(),
    };
    const { rerender } = render(<BatchReviewView job={job} {...baseProps} />);
    expect(screen.getByRole("button", { name: "Necesitan atención (3)" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Listos (0)" })).toBeInTheDocument();

    rerender(<BatchReviewView job={recordItemReviewCompletion(job, 1, true)} {...baseProps} />);
    expect(screen.getByRole("button", { name: "Necesitan atención (2)" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Listos (1)" })).toBeInTheDocument();
  });

  it("defaults to Todos when no item needs attention and recovers from an empty filter", async () => {
    const completed = recordItemReviewCompletion(
      recordItemReviewCompletion(
        withProcessedItems(
          batchJobWith([
            { name: "doc-a.txt", read: { ok: true, extractedText: TEXT_A } },
            { name: "doc-b.txt", read: { ok: true, extractedText: TEXT_B } },
          ])
        ),
        0,
        true
      ),
      1,
      true
    );
    await renderView({ job: completed, sessions: {}, activeIndex: null });
    expect(screen.getByRole("button", { name: "Todos (2)" })).toHaveAttribute(
      "aria-pressed",
      "true"
    );

    fireEvent.click(screen.getByRole("button", { name: "Necesitan atención (0)" }));
    expect(
      screen.getByText(/No hay ningún documento que coincida con este filtro\./)
    ).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Mostrar todos" }));
    expect(screen.getByRole("button", { name: "Todos (2)" })).toHaveAttribute(
      "aria-pressed",
      "true"
    );
    expect(
      screen.getByRole("list", { name: "Batch document status" }).querySelectorAll("li")
    ).toHaveLength(2);
  });

  it("keeps the open document's workspace intact and notes it is outside the selected filter", async () => {
    const job = orientationJob();
    const sessions = { 0: await sessionFor(job, 0), 1: await sessionFor(job, 1) };
    await renderView({ job, sessions, activeIndex: 0 });

    // Default attention: the open completed document is outside it, but its
    // Review workspace survives and the UI states the fact.
    expect(screen.getByText(/no pertenece al filtro actual/i)).toBeInTheDocument();
    expect(screen.getByRole("status", { name: "Review progress" })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Todos (16)" }));
    expect(screen.queryByText(/no pertenece al filtro actual/i)).not.toBeInTheDocument();
  });

  it("filter controls are native, labelled in Spanish and expose a pressed state", async () => {
    await renderView({ job: processingFailureJob(), sessions: {}, activeIndex: null });
    const group = screen.getByRole("group", { name: "Filtrar documentos del lote" });
    const controls = within(group).getAllByRole("button");
    expect(controls.map((control) => control.textContent)).toEqual([
      "Todos (3)",
      "Necesitan atención (3)",
      "En curso (0)",
      "Listos (0)",
      "Retirados (0)",
    ]);
    for (const control of controls) {
      expect(control.tagName).toBe("BUTTON");
      expect(control).toHaveAttribute("aria-pressed");
      expect(control.className).toContain("focus-visible:ring");
    }
  });

  /** Stateful harness for a removal that really changes the job's category. */
  function RemovalHarness({ initialJob }: { initialJob: Job }): ReactElement {
    const [job, setJob] = useState(initialJob);
    return (
      <BatchReviewView
        job={job}
        sessions={null}
        activeIndex={null}
        retryContextAvailable
        onSelectDocument={() => {}}
        onDecide={() => {}}
        onAddManual={() => {}}
        onRemoveBatchItem={(index) => setJob((current) => removeBatchItem(current, index))}
        onAcknowledgeBatchItemError={(index) =>
          setJob((current) => acknowledgeBatchItemError(current, index))
        }
      />
    );
  }

  it("a removal performed from Necesitan atención keeps its consequence perceptible", async () => {
    render(<RemovalHarness initialJob={processingFailureJob()} />);
    const list = screen.getByRole("list", { name: "Batch document status" });
    const failedRow = screen.getByText(/Synthetic processing failure\./).closest("li")!;
    fireEvent.click(within(failedRow).getByRole("button", { name: "Retirar del lote" }));
    fireEvent.click(screen.getByRole("button", { name: "Confirmar retirada" }));

    // The row leaves active attention, but the consequence stays perceptible.
    await waitFor(() => expect(list).not.toHaveTextContent("doc-c.txt"));
    expect(statusWith(/se ha retirado del lote/i)).toBeDefined();
    // The removed item is still discoverable in Retirados.
    fireEvent.click(screen.getByRole("button", { name: "Retirados (1)" }));
    expect(within(list).getByText("doc-c.txt")).toBeInTheDocument();
    expect(within(list).getByText(/Retirado del lote/)).toBeInTheDocument();
  });

  /** Stateful harness where a retry really moves its row out of attention. */
  function RetryHarness({
    initialJob,
    retry,
  }: {
    initialJob: Job;
    retry: (index: number) => Promise<BatchItemRetryResult>;
  }): ReactElement {
    const [job, setJob] = useState(initialJob);
    return (
      <BatchReviewView
        job={job}
        sessions={null}
        activeIndex={null}
        retryContextAvailable
        onSelectDocument={() => {}}
        onDecide={() => {}}
        onAddManual={() => {}}
        onRetryBatchItem={(index) => {
          setJob((current) => beginBatchItemRetry(current, index));
          return retry(index);
        }}
      />
    );
  }

  it("retry feedback stays perceptible when its row moves from Necesitan atención to En curso", async () => {
    let resolveRetry: (result: BatchItemRetryResult) => void = () => {};
    const retry = vi.fn(
      () =>
        new Promise<BatchItemRetryResult>((resolve) => {
          resolveRetry = resolve;
        })
    );
    render(<RetryHarness initialJob={processingFailureJob()} retry={retry} />);
    const list = screen.getByRole("list", { name: "Batch document status" });
    const failedRow = screen.getByText(/Synthetic processing failure\./).closest("li")!;
    fireEvent.click(within(failedRow).getByRole("button", { name: "Reintentar" }));

    // The retry's own transition moved doc-c into En curso; the pending
    // feedback does not disappear with the row.
    await waitFor(() => expect(list).not.toHaveTextContent("doc-c.txt"));
    expect(screen.getByRole("button", { name: "En curso (1)" })).toBeInTheDocument();
    expect(statusWith(/Reintentando…/)).toBeDefined();

    resolveRetry({ kind: "settled", failure: null });
    await waitFor(() => expect(statusWith(/Reintento completado/i)).toBeDefined());
  });
});
