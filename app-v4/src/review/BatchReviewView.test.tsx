import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import "@testing-library/jest-dom/vitest";

import {
  acknowledgeBatchItemError,
  beginItemProcessing,
  beginItemRead,
  createJob,
  recordItemFailed,
  recordItemProcessed,
  recordItemRead,
  recordItemReviewCompletion,
  removeBatchItem,
  type Job,
  type ProcessingFailure,
} from "../domain/job";
import { createRegistryEngine } from "../engine/registry-engine";
import {
  applyDecision,
  getPendingDetections,
  processBatchItem,
  type ReviewSession,
} from "./review-domain";
import { BatchReviewView } from "./BatchReviewView";

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
    onRetryBatchItem: vi.fn(async () => null),
    onRemoveBatchItem: vi.fn(),
    onAcknowledgeBatchItemError: vi.fn(),
    errorMessage: null,
    ...rest,
  };
  render(<BatchReviewView {...props} />);
  return { props };
}

afterEach(cleanup);

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

  it("retry gives perceptible pending and success feedback", async () => {
    let resolveRetry: (failure: ProcessingFailure | null) => void = () => {};
    const onRetryBatchItem = vi.fn(
      () =>
        new Promise<ProcessingFailure | null>((resolve) => {
          resolveRetry = resolve;
        })
    );
    const { props } = await renderView({ job: processingFailureJob(), onRetryBatchItem });

    fireEvent.click(screen.getByRole("button", { name: "Reintentar" }));
    expect(props.onRetryBatchItem).toHaveBeenCalledWith(2);
    // Pending: the control is disabled and a status is perceptible.
    expect(screen.getByRole("button", { name: "Reintentar" })).toBeDisabled();
    expect(statusWith(/Reintentando…/)).toBeDefined();

    // Success feedback, co-located and factual.
    resolveRetry(null);
    await waitFor(() => expect(statusWith(/Reintento completado/i)).toBeDefined());
    expect(statusWith(/disponible para revisión/i)).toBeDefined();
  });

  it("retry failure feedback is an alert carrying the typed failure", async () => {
    const onRetryBatchItem = vi.fn(async () => ({
      code: "processing-failed" as const,
      message: "Typed failure surfaced to the row.",
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
});
