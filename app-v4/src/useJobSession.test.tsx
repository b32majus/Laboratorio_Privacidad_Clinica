import { act, cleanup, fireEvent, render, renderHook, screen } from "@testing-library/react";
import { useState } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import "@testing-library/jest-dom/vitest";

import {
  type BatchItemReadOutcome,
  type Job,
  type JobSourceFile,
  type ProcessingFailure,
  batchFailedItems,
  batchItemStatus,
  beginItemRead,
  beginProcessing,
  createJob,
  recordItemRead,
  setPolicy,
} from "./domain/job";
import { readDateShiftState } from "./engine/date-operator";
import { createInitialProcessingContext } from "./engine/initial-processing-context";
import { PolicyError } from "./engine/policy";
import { createRegistryEngine } from "./engine/registry-engine";
import { getPendingDetections, type ReviewSession } from "./review/review-domain";
import { runBatchReviewAsync, useJobSession } from "./useJobSession";

/**
 * T22 #26 WU-D review corrections: the seam is mocked with a controllable
 * loader — default resolve with the REAL composed engine; hold open to make
 * the async gap observable, or reject to prove fail-closed recording.
 */
const engineControl = vi.hoisted(() => ({
  hold: false,
  pending: [] as Array<{ resolve: () => void; reject: (error: unknown) => void }>,
  /**
   * Durable typed-failure producer (REC-02 WU-A): the loader seam rejects with
   * this error so the typed-failure route depends on no policy-specific
   * failure condition.
   */
  loadError: null as unknown,
  /**
   * Batch failure recovery (#78): deterministic per-text processing failure.
   * When set, the adapted engine THROWS (inside `process`, after a successful
   * load) for exactly this text, so one batch item fails with a RETAINED
   * read artifact — a retryable processing failure, independent of any
   * policy mapping. Cleared to let the retry succeed.
   */
  markerText: null as string | null,
}));

vi.mock("./engine/engine-seam", () => ({
  loadRegistryEngine: async () => {
    if (engineControl.loadError !== null) throw engineControl.loadError;
    const { createRegistryEngine } = await import("./engine/registry-engine");
    const engine = createRegistryEngine();
    const adapted = {
      process: async (input: Parameters<typeof engine.process>[0]) => {
        if (engineControl.markerText !== null && input.text === engineControl.markerText) {
          throw new Error("Injected deterministic processing failure (#78 oracle).");
        }
        return engine.process(input);
      },
    };
    if (engineControl.hold) {
      await new Promise<void>((resolve, reject) => {
        engineControl.pending.push({ resolve, reject });
      });
    }
    return adapted;
  },
}));

function releasePendingEngine(): void {
  for (const entry of engineControl.pending) entry.resolve();
  engineControl.pending = [];
}

function rejectPendingEngine(error: unknown): void {
  for (const entry of engineControl.pending) entry.reject(error);
  engineControl.pending = [];
}

/**
 * Oracles for the state bridge's single processing-attempt entry point
 * (T15 #19, GitHub #19 acceptance bullet 3).
 *
 * The probe uses the REAL hook and drives the REAL `startReview()`; the engine
 * is never mocked for the success route, so it runs the composed registry
 * engine. The typed-failure route injects a typed error through the file's
 * controllable engine-loader seam, which keeps the failure producer durable
 * and independent of any single policy mapping (REC-02 collapsed the
 * known-but-unmapped policies). The observed state is rendered as
 * text in a `role="status"` region so the assertions derive from what the hook
 * actually exposes.
 *
 * All content is synthetic; no real clinical data anywhere.
 */
const SYNTHETIC_NOTE = "Nombre: Carmen Sanchez. Contacto: 612345678.";

/** Returned-failure display value: distinguishes "not called" from `null`. */
type ReturnedOutcome = ProcessingFailure | null | "not-called";

function ProcessingProbe() {
  const session = useJobSession();
  const [returned, setReturned] = useState<ReturnedOutcome>("not-called");

  const errorCodes =
    session.job && session.job.errors.length > 0
      ? session.job.errors.map((error) => error.code).join("|")
      : "none";
  const returnedText =
    returned === "not-called"
      ? "not-called"
      : returned === null
        ? "null"
        : `${returned.code} / ${returned.message}`;

  return (
    <div>
      <button
        type="button"
        onClick={() => session.create({ type: "pasted-text", text: SYNTHETIC_NOTE })}
      >
        create job
      </button>
      <button type="button" onClick={() => session.updatePolicy("standard")}>
        policy standard
      </button>
      <button type="button" onClick={() => session.updatePolicy("external-ai")}>
        policy external-ai
      </button>
      <button
        type="button"
        onClick={() => {
          void session.startReview().then((failure) => setReturned(failure));
        }}
      >
        start review
      </button>
      <p role="status" aria-label="processing probe">
        <span>{`processing: ${session.job ? session.job.processing : "none"}`}</span>
        <span>{`errors: ${errorCodes}`}</span>
        <span>{`session: ${session.review ? "installed" : "none"}`}</span>
        <span>{`returned: ${returnedText}`}</span>
      </p>
    </div>
  );
}

afterEach(() => {
  engineControl.hold = false;
  engineControl.pending = [];
  engineControl.loadError = null;
  engineControl.markerText = null;
  cleanup();
});

/** Type-safe read-only batch files view of a job's source (observation only). */
function sourceFiles(job: Job): readonly JobSourceFile[] {
  return job.source.type === "files" ? job.source.files : [];
}

describe("useJobSession.startReview (T15 #19)", () => {
  it("success route: records succeeded, installs a session and returns null", async () => {
    render(<ProcessingProbe />);
    fireEvent.click(screen.getByRole("button", { name: "create job" }));
    // T22 #26 WU-D: processing is async; flush the promise before asserting.
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "start review" }));
    });

    const probe = screen.getByRole("status", { name: "processing probe" });
    expect(probe).toHaveTextContent("processing: succeeded");
    expect(probe).toHaveTextContent("errors: none");
    expect(probe).toHaveTextContent("session: installed");
    expect(probe).toHaveTextContent("returned: null");
  });

  it("newly enabled policy route: an external-ai text job processes successfully (REC-02 WU-A)", async () => {
    render(<ProcessingProbe />);
    fireEvent.click(screen.getByRole("button", { name: "create job" }));
    fireEvent.click(screen.getByRole("button", { name: "policy external-ai" }));
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "start review" }));
    });

    const probe = screen.getByRole("status", { name: "processing probe" });
    expect(probe).toHaveTextContent("processing: succeeded");
    expect(probe).toHaveTextContent("errors: none");
    expect(probe).toHaveTextContent("session: installed");
    expect(probe).toHaveTextContent("returned: null");
  });

  it("typed-failure route: records failed, appends the typed error and installs no session", async () => {
    render(<ProcessingProbe />);
    fireEvent.click(screen.getByRole("button", { name: "create job" }));
    // Durable producer: a typed error through the controllable loader seam.
    engineControl.loadError = new PolicyError(
      "unknown-policy",
      "Injected loader failure: no such privacy policy in this deterministic test."
    );
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "start review" }));
    });

    const probe = screen.getByRole("status", { name: "processing probe" });
    expect(probe).toHaveTextContent("processing: failed");
    expect(probe).toHaveTextContent("errors: policy-unsupported");
    expect(probe).toHaveTextContent("session: none");
    expect(probe).toHaveTextContent("returned: policy-unsupported /");
    // The typed failure is never mistaken for a successful review.
    expect(probe).not.toHaveTextContent("processing: succeeded");
  });

  it("retry route: a failed attempt can start again and reach a terminal success", async () => {
    render(<ProcessingProbe />);
    fireEvent.click(screen.getByRole("button", { name: "create job" }));
    engineControl.loadError = new PolicyError(
      "unknown-policy",
      "Injected loader failure: no such privacy policy in this deterministic test."
    );
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "start review" }));
    });
    expect(screen.getByRole("status", { name: "processing probe" })).toHaveTextContent(
      "processing: failed"
    );

    // The transient loader failure clears, then retry the same job.
    engineControl.loadError = null;
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "start review" }));
    });

    const probe = screen.getByRole("status", { name: "processing probe" });
    expect(probe).toHaveTextContent("processing: succeeded");
    expect(probe).toHaveTextContent("session: installed");
    expect(probe).toHaveTextContent("returned: null");
  });

  it("never-success-never-thrown contract: a typed failure is returned, not thrown", async () => {
    render(<ProcessingProbe />);
    fireEvent.click(screen.getByRole("button", { name: "create job" }));
    engineControl.loadError = new PolicyError(
      "unknown-policy",
      "Injected loader failure: no such privacy policy in this deterministic test."
    );

    // The click handler calls the real startReview(); a throw would escape it.
    await act(async () => {
      expect(() =>
        fireEvent.click(screen.getByRole("button", { name: "start review" }))
      ).not.toThrow();
    });

    const probe = screen.getByRole("status", { name: "processing probe" });
    expect(probe).toHaveTextContent("processing: failed");
    expect(probe).not.toHaveTextContent("returned: null");
  });
});

/**
 * T17 #21 WU-B bridge oracles. The batch review path is driven through the
 * REAL hook and the REAL engine (never mocked) so item statuses, sessions and
 * the derived gate come from what the bridge actually exposes. All fixtures
 * are synthetic clinical-style strings; no real content anywhere.
 */
const BATCH_DOC_A = "Nombre: Carmen Sánchez\nLa paciente fue atendida por el Dr. García López.";
const BATCH_DOC_B =
  "Nombre: Carmen Sánchez\nLa paciente Lucía Ruiz acude a consulta. El Dr. García López firmó el informe. Familiar: Rosa Martínez.";
const BATCH_MARKER = "Texto sintético que el motor inyectado rechaza.";
/** Link-date fixtures for the longitudinal batch oracles (synthetic). */
const LONG_DOC_A = "Ingreso el 05/01/2024.";
const LONG_DOC_B = "Analítica el 12/01/2024 y revisión el 02/02/2024.";
const LONG_DOC_C = "Alta médica el 20/03/2024.";
const LONG_NAME_DOC_A = "Nombre: Carmen Sánchez. Analítica el 05/01/2024.";
const LONG_NAME_DOC_C = "Nombre: Carmen Sánchez. Revisión el 12/01/2024.";

/** Parses a `dd/mm/yyyy` fixture into a UTC epoch day. */
function toUtcDay(dateText: string): number {
  const match = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(dateText);
  if (match === null) throw new Error(`unexpected date format "${dateText}"`);
  return Date.UTC(Number(match[3]), Number(match[2]) - 1, Number(match[1])) / 86_400_000;
}

/** Kept (non-candidate) FECHA source→proposal pairs of one session. */
function fechaPairs(
  session: ReviewSession
): { readonly source: string; readonly proposed: string }[] {
  return session.detections
    .filter((detection) => detection.type === "FECHA" && detection.lowConfidence !== true)
    .map((detection) => ({
      source: detection.original ?? "",
      proposed: detection.proposed ?? "",
    }));
}

/** Build a document batch and drive the read phase through the domain. */
function domainBatchJob(
  entries: readonly { readonly name: string; readonly read: BatchItemReadOutcome }[]
): Job {
  let job = createJob({
    type: "files",
    files: entries.map((entry) => ({ name: entry.name, extension: "txt" })),
  });
  entries.forEach((entry, index) => {
    job = recordItemRead(beginItemRead(job, index), index, entry.read);
  });
  return job;
}

/** Proposed value of the non-candidate engine detection for one source span. */
function engineProposal(session: ReviewSession, original: string): string | undefined {
  return session.detections.find(
    (detection) => detection.original === original && detection.lowConfidence !== true
  )?.proposed;
}

type SessionHook = ReturnType<typeof useJobSession>;

/** Resolve every mandatory decision of one batch item via a `restored` choice. */
function completeItem(result: { readonly current: SessionHook }, index: number) {
  act(() => result.current.selectDocument(index));
  const session = result.current.batchSessions?.[index];
  if (!session) throw new Error(`no batch session installed for item ${index}`);
  for (const detection of getPendingDetections(session)) {
    act(() => result.current.decide(detection.id, "restored"));
  }
}

/** Create, read and prepare a 2-document batch through the hook. */
function reviewedBatch(result: { readonly current: SessionHook }) {
  act(() =>
    result.current.create({
      type: "files",
      files: [
        { name: "historia-a.txt", extension: "txt" },
        { name: "historia-b.txt", extension: "txt" },
      ],
    })
  );
  act(() => result.current.beginBatchItemRead(0));
  act(() => result.current.recordBatchItemRead(0, { ok: true, extractedText: BATCH_DOC_A }));
  act(() => result.current.beginBatchItemRead(1));
  act(() => result.current.recordBatchItemRead(1, { ok: true, extractedText: BATCH_DOC_B }));
}

describe("useJobSession async gap guards (T22 #26 WU-D review corrections)", () => {
  it("POLICY CHANGE during a pending attempt: the stale review is dropped, never installed under the previous policy", async () => {
    const { result } = renderHook(() => useJobSession());
    act(() => {
      result.current.create({ type: "pasted-text", text: BATCH_DOC_A });
    });
    engineControl.hold = true;

    let settled: ProcessingFailure | null | "pending" = "pending";
    const attempt = result.current.startReview().then((failure) => {
      settled = failure;
      return failure;
    });
    await act(async () => {
      await Promise.resolve();
    });
    expect(result.current.job?.processing).toBe("running");

    // A REAL policy change while the engine is still pending (same job id).
    act(() => {
      result.current.updatePolicy("external-ai");
    });
    engineControl.hold = false;
    releasePendingEngine();
    await act(async () => {
      await attempt;
    });

    // The stale outcome is dropped (null, not a failure) and the review is
    // NEVER installed under the previous policy: the policy-changed job keeps
    // its honest idle processing state and no session exists.
    expect(settled).toBeNull();
    expect(result.current.job?.policyId).toBe("external-ai");
    expect(result.current.job?.processing).toBe("idle");
    expect(result.current.review).toBeNull();
  });

  it("REJECTED engine load in the single path: classified failure recorded, never an unhandled rejection", async () => {
    const { result } = renderHook(() => useJobSession());
    act(() => {
      result.current.create({ type: "pasted-text", text: BATCH_DOC_A });
    });
    engineControl.hold = true;

    const attempt = result.current.startReview();
    await act(async () => {
      await Promise.resolve();
    });
    engineControl.hold = false;
    rejectPendingEngine(new Error("module load failed"));
    const holder: { failure: ProcessingFailure | null } = { failure: null };
    await act(async () => {
      holder.failure = await attempt;
    });

    // An unrecognized module-load error classifies fail-closed as
    // `processing-unknown`, and the T15 domain contract maps that failure to
    // the `unknown` processing state (an attempt happened; its outcome could
    // not be established) — never "succeeded" and never silent.
    expect(holder.failure?.code).toBe("processing-unknown");
    expect(result.current.job?.processing).toBe("unknown");
    expect(result.current.review).toBeNull();
  });

  it("REJECTED engine load in the batch path: classified failure recorded and the loop aborts safely", async () => {
    const { result } = renderHook(() => useJobSession());
    reviewedBatch(result);
    engineControl.hold = true;

    const attempt = result.current.startReview();
    await act(async () => {
      await Promise.resolve();
    });
    engineControl.hold = false;
    rejectPendingEngine(new Error("module load failed"));
    const holder: { failure: ProcessingFailure | null } = { failure: null };
    await act(async () => {
      holder.failure = await attempt;
    });

    expect(holder.failure?.code).toBe("processing-unknown");
    expect(result.current.job?.processing).toBe("unknown");
    expect(result.current.batchSessions).toBeNull();
  });
});

describe("useJobSession async processing responsiveness (T22 #26 WU-D)", () => {
  it("yields to the UI between marking the attempt running and installing the session", async () => {
    // T22 #26 WU-D: the heavy engine path is asynchronous (lazy engine module
    // load; later the Worker boundary). The main thread must get a chance to
    // paint the `running` state BEFORE the engine call completes — the old
    // synchronous path marked and completed in one blocking task.
    const { result } = renderHook(() => useJobSession());
    act(() => {
      result.current.create({ type: "pasted-text", text: BATCH_DOC_A });
    });

    let sawRunningBeforeSettled = false;
    const processing = result.current.startReview().then(() => {
      // Evaluated when the attempt settles; the flag below was observed in
      // the intermediate microtask/window between the two halves.
      return sawRunningBeforeSettled;
    });
    // Give the React updater for beginProcessing a chance to run while the
    // engine promise is still pending.
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
      sawRunningBeforeSettled = result.current.job?.processing === "running";
    });
    const yielded = await processing;
    expect(yielded).toBe(true);
    expect(result.current.job?.processing).toBe("succeeded");
    expect(result.current.review).not.toBeNull();
  });
});

describe("useJobSession batch review state (T17 #21 WU-B)", () => {
  it("keeps per-document review state independent and navigation pure (FUNC-002)", async () => {
    const { result } = renderHook(() => useJobSession());
    reviewedBatch(result);

    let failure: ProcessingFailure | null = null;
    await act(async () => {
      failure = await result.current.startReview();
    });
    expect(failure).toBeNull();

    const job = result.current.job;
    if (!job) throw new Error("expected a batch job");
    expect(batchItemStatus(job, 0)).toBe("review-required");
    expect(batchItemStatus(job, 1)).toBe("review-required");
    expect(job.review.complete).toBe(false);
    expect(job.outputs.safeOutputReady).toBe(false);
    expect(result.current.batchActiveIndex).toBe(0);
    expect(Object.keys(result.current.batchSessions ?? {})).toEqual(["0", "1"]);

    // Complete doc A's mandatory decisions → only A is completed.
    completeItem(result, 0);
    expect(batchItemStatus(result.current.job!, 0)).toBe("completed");
    expect(batchItemStatus(result.current.job!, 1)).toBe("review-required");
    expect(result.current.job!.review.complete).toBe(false);
    expect(result.current.job!.outputs.safeOutputReady).toBe(false);

    // Viewing doc B changes ONLY the viewed index: job and sessions untouched.
    const jobBefore = result.current.job;
    const sessionsBefore = result.current.batchSessions;
    act(() => result.current.selectDocument(1));
    expect(result.current.batchActiveIndex).toBe(1);
    expect(result.current.job).toBe(jobBefore);
    expect(result.current.batchSessions).toBe(sessionsBefore);

    // Step navigation round-trip changes the step, never a status or session.
    act(() => result.current.navigate("configure"));
    act(() => result.current.navigate("review"));
    act(() => result.current.navigate("input"));
    expect(batchItemStatus(result.current.job!, 0)).toBe("completed");
    expect(batchItemStatus(result.current.job!, 1)).toBe("review-required");
    expect(result.current.job!.review.complete).toBe(false);
    expect(result.current.batchSessions).toBe(sessionsBefore);

    // Complete doc B → both completed, so the BATCH REVIEW is complete. The
    // batch output surfaces stay unavailable (T17 #21 CORR-B): review
    // completion and output availability are separate facts while no accepted
    // batch output format exists.
    completeItem(result, 1);
    expect(batchItemStatus(result.current.job!, 0)).toBe("completed");
    expect(batchItemStatus(result.current.job!, 1)).toBe("completed");
    expect(result.current.job!.review.complete).toBe(true);
    expect(result.current.job!.outputs.safeOutputReady).toBe(false);
    expect(result.current.job!.outputs.confidentialAuditReady).toBe(false);

    // A later mandatory manual detection re-opens A only and re-derives the gate.
    act(() => result.current.selectDocument(0));
    act(() => result.current.addManual({ start: 0, end: 6, type: "manual-flag" }));
    expect(batchItemStatus(result.current.job!, 0)).toBe("review-required");
    expect(batchItemStatus(result.current.job!, 1)).toBe("completed");
    expect(result.current.job!.review.complete).toBe(false);
    expect(result.current.job!.outputs.safeOutputReady).toBe(false);
  });
});

describe("useJobSession batch processing isolation (T17 #21 WU-B)", () => {
  it("keeps later documents consistent and records the attempt after a mid-batch engine failure", async () => {
    const real = createRegistryEngine();
    const stub: ReturnType<typeof createRegistryEngine> = {
      process(input) {
        if (input.text === BATCH_MARKER) {
          throw new PolicyError(
            "policy-operator-mapping-unavailable",
            "Injected stub: refusing the marker text."
          );
        }
        return real.process(input);
      },
    };
    const job = domainBatchJob([
      { name: "doc-a.txt", read: { ok: true, extractedText: BATCH_DOC_A } },
      { name: "doc-b.txt", read: { ok: true, extractedText: BATCH_MARKER } },
      { name: "doc-c.txt", read: { ok: true, extractedText: BATCH_DOC_B } },
    ]);

    const run = await runBatchReviewAsync(beginProcessing(job), {
      engineLoader: async () => ({ process: async (input) => stub.process(input) }),
    });
    if (!run.ok) throw new Error(`expected ok: true, received failure ${run.failure.code}`);

    // The attempt is recorded through the completeProcessing path and the
    // failure does NOT abort the remaining items.
    expect(run.job.processing).toBe("succeeded");
    expect(batchItemStatus(run.job, 0)).toBe("review-required");
    expect(batchItemStatus(run.job, 1)).toBe("error");
    expect(batchItemStatus(run.job, 2)).toBe("review-required");
    expect(run.activeIndex).toBe(0);
    expect(Object.keys(run.sessions)).toEqual(["0", "2"]);

    // The failed item stays visible with its classified code and itemError.
    expect(batchFailedItems(run.job)).toEqual([
      {
        index: 1,
        name: "doc-b.txt",
        error: { code: "policy-unsupported", message: "Injected stub: refusing the marker text." },
      },
    ]);
    if (run.job.source.type !== "files") throw new Error("expected a files source");
    expect(run.job.source.files[1].itemStatus).toBe("error");
    expect(run.job.source.files[1].itemError).toEqual({
      code: "policy-unsupported",
      message: "Injected stub: refusing the marker text.",
    });
    // The read text is policy-INDEPENDENT, so the processing failure keeps it
    // and the item stays retryable after a policy change (T17 #21 WU-C3).
    expect(run.job.source.files[1].extraction).toEqual({
      status: "extracted",
      extractedText: BATCH_MARKER,
    });

    // Context carried from the last SUCCESS (doc A): a known identity keeps
    // its pseudonym and a new identity takes the next index instead of the
    // counter restarting.
    const first = run.sessions[0];
    const third = run.sessions[2];
    if (!first || !third) throw new Error("expected sessions for items 0 and 2");
    expect(engineProposal(first, "Carmen Sánchez")).toBe("Paciente 1");
    expect(engineProposal(third, "Carmen Sánchez")).toBe("Paciente 1");
    expect(engineProposal(third, "Lucía Ruiz")).toBe("Paciente 2");
  });
});

/**
 * REC-02 WU-B oracles for the longitudinal date-shift context threading. The
 * bridge must seed the FIRST item from the policy-owned seam, carry the
 * returned `options` (not only `pseudonymState`) into shared mode, and keep one
 * Job-scoped offset across successful items even when an item fails. All
 * fixtures are synthetic; no real content anywhere.
 */
describe("useJobSession batch longitudinal date shift (REC-02 WU-B)", () => {
  it.each(["standard", "strict", "external-ai", "longitudinal-research"] as const)(
    "processes a document batch successfully under the %s policy (ACCEPTANCE 10)",
    async (policyId) => {
      const job = setPolicy(
        domainBatchJob([
          { name: "a.txt", read: { ok: true, extractedText: LONG_DOC_A } },
          { name: "b.txt", read: { ok: true, extractedText: LONG_DOC_B } },
        ]),
        policyId
      );
      const real = createRegistryEngine();
      const run = await runBatchReviewAsync(beginProcessing(job), {
        engineLoader: async () => ({ process: async (input) => real.process(input) }),
      });
      if (!run.ok) throw new Error(`expected ok: true, received failure ${run.failure.code}`);
      for (const index of [0, 1]) {
        expect(batchItemStatus(run.job, index)).toBe("review-required");
      }
    }
  );

  it("threads ONE Job-scoped shift across successful items and preserves intervals/order (ACCEPTANCE 11)", async () => {
    const job = setPolicy(
      domainBatchJob([
        { name: "doc-a.txt", read: { ok: true, extractedText: LONG_DOC_A } },
        { name: "doc-b.txt", read: { ok: true, extractedText: LONG_DOC_B } },
        { name: "doc-c.txt", read: { ok: true, extractedText: LONG_DOC_C } },
      ]),
      "longitudinal-research"
    );
    const real = createRegistryEngine();
    const run = await runBatchReviewAsync(beginProcessing(job), {
      engineLoader: async () => ({ process: async (input) => real.process(input) }),
    });
    if (!run.ok) throw new Error(`expected ok: true, received failure ${run.failure.code}`);
    for (const index of [0, 1, 2]) {
      expect(batchItemStatus(run.job, index)).toBe("review-required");
    }

    const pairs = [0, 1, 2].flatMap((index) => fechaPairs(run.sessions[index]!));
    expect(pairs).toHaveLength(4);
    const deltas = pairs.map((pair) => toUtcDay(pair.proposed) - toUtcDay(pair.source));
    // One offset across every successful document.
    expect(new Set(deltas).size).toBe(1);
    for (const pair of pairs) {
      expect(pair.proposed).toMatch(/^\d{2}\/\d{2}\/\d{4}$/);
      expect(pair.proposed).not.toBe(pair.source);
      expect(pair.proposed).not.toMatch(/^Visita/);
    }

    // Every pairwise day interval and the chronological order are preserved.
    const sources = pairs.map((pair) => pair.source);
    const shifted = pairs.map((pair) => pair.proposed);
    for (let i = 0; i < sources.length; i += 1) {
      for (let j = i + 1; j < sources.length; j += 1) {
        expect(toUtcDay(shifted[j]) - toUtcDay(shifted[i])).toBe(
          toUtcDay(sources[j]) - toUtcDay(sources[i])
        );
      }
    }
    const order = (dates: readonly string[]) =>
      dates.map((_, index) => index).sort((a, b) => toUtcDay(dates[a]) - toUtcDay(dates[b]));
    expect(order(shifted)).toEqual(order(sources));
  });

  it("keeps the carried shift and pseudonym context across an intervening failed item (ACCEPTANCE 12)", async () => {
    const real = createRegistryEngine();
    const stub: ReturnType<typeof createRegistryEngine> = {
      process(input) {
        if (input.text === BATCH_MARKER) {
          throw new PolicyError(
            "policy-operator-mapping-unavailable",
            "Injected stub: refusing the marker text."
          );
        }
        return real.process(input);
      },
    };
    const job = setPolicy(
      domainBatchJob([
        { name: "doc-a.txt", read: { ok: true, extractedText: LONG_NAME_DOC_A } },
        { name: "doc-b.txt", read: { ok: true, extractedText: BATCH_MARKER } },
        { name: "doc-c.txt", read: { ok: true, extractedText: LONG_NAME_DOC_C } },
      ]),
      "longitudinal-research"
    );
    const run = await runBatchReviewAsync(beginProcessing(job), {
      engineLoader: async () => ({ process: async (input) => stub.process(input) }),
    });
    if (!run.ok) throw new Error(`expected ok: true, received failure ${run.failure.code}`);
    expect(batchItemStatus(run.job, 1)).toBe("error");
    expect(batchItemStatus(run.job, 0)).toBe("review-required");
    expect(batchItemStatus(run.job, 2)).toBe("review-required");

    // The successful items still shift by exactly the Job-scoped offset the
    // seam derives: the failed item contributed no replacement state.
    const state = readDateShiftState(
      createInitialProcessingContext(job, "longitudinal-research").options
    );
    if (state === undefined) throw new Error("expected a Job-scoped date-shift state");
    const pairs = [run.sessions[0]!, run.sessions[2]!].flatMap((session) => fechaPairs(session));
    expect(pairs).toHaveLength(2);
    for (const pair of pairs) {
      expect(toUtcDay(pair.proposed) - toUtcDay(pair.source)).toBe(state.contextOffsetDays);
    }

    // Pseudonym context carried across the failure: the returning identity
    // keeps `Paciente 1`; the failed item neither consumed nor reset a
    // pseudonym.
    expect(engineProposal(run.sessions[0]!, "Carmen Sánchez")).toBe("Paciente 1");
    expect(engineProposal(run.sessions[2]!, "Carmen Sánchez")).toBe("Paciente 1");
  });

  it("processes a longitudinal-research text job through the hook with a Job-scoped shift (ACCEPTANCE 9)", async () => {
    const { result } = renderHook(() => useJobSession());
    act(() => result.current.create({ type: "pasted-text", text: LONG_NAME_DOC_A }));
    act(() => result.current.updatePolicy("longitudinal-research"));
    await act(async () => {
      await result.current.startReview();
    });
    expect(result.current.job?.processing).toBe("succeeded");
    const session = result.current.review;
    if (!session) throw new Error("expected an installed review session");
    const fecha = session.detections.find((detection) => detection.type === "FECHA");
    expect(fecha?.proposed).toMatch(/^\d{2}\/\d{2}\/\d{4}$/);
    expect(fecha?.proposed).not.toMatch(/^Visita/);
  });
});

/**
 * T17 #21 CORR-A oracles.
 *
 * 1. Policy change during the asynchronous batch read: the read phase is
 *    policy-INDEPENDENT, so a policy change between `beginBatchItemRead`
 *    and `recordBatchItemRead` must leave the item `reading` and the read
 *    outcome must still commit under the new policy.
 * 2. Zero-pending ReviewSession completion: a session produced by the engine
 *    with zero pending mandatory detections completes its item immediately.
 *
 * All content is synthetic; no real clinical data anywhere.
 */
describe("useJobSession batch read vs policy change race (T17 #21 CORR-A)", () => {
  it("commits an in-flight batch read after a mid-read policy change", async () => {
    const { result } = renderHook(() => useJobSession());
    act(() =>
      result.current.create({
        type: "files",
        files: [
          { name: "doc-a.txt", extension: "txt" },
          { name: "doc-b.txt", extension: "txt" },
        ],
      })
    );
    // The item enters reading; extractFile is conceptually pending.
    act(() => result.current.beginBatchItemRead(0));
    // The policy changes BEFORE the read resolves. The bridge must keep the
    // item `reading` (the domain reset contract), and the commit below must
    // not throw the typed invalid-processing-transition error.
    act(() => result.current.updatePolicy("strict"));
    expect(result.current.job!.policyId).toBe("strict");
    expect(batchItemStatus(result.current.job!, 0)).toBe("reading");

    // The read resolves under the NEW policy: the real outcome is committed.
    act(() => result.current.recordBatchItemRead(0, { ok: true, extractedText: BATCH_DOC_A }));
    expect(batchItemStatus(result.current.job!, 0)).toBe("queued");
    const job = result.current.job!;
    if (job.source.type !== "files") throw new Error("expected a files source");
    expect(job.source.files[0].extraction).toEqual({
      status: "extracted",
      extractedText: BATCH_DOC_A,
    });
    // The policy change did not disturb the untouched sibling.
    expect(batchItemStatus(job, 1)).toBe("queued");
  });

  it("commits a failed read outcome after a mid-read policy change", async () => {
    const { result } = renderHook(() => useJobSession());
    act(() =>
      result.current.create({
        type: "files",
        files: [
          { name: "scan.pdf", extension: "pdf" },
          { name: "doc-b.txt", extension: "txt" },
        ],
      })
    );
    act(() => result.current.beginBatchItemRead(0));
    act(() => result.current.updatePolicy("strict"));
    act(() =>
      result.current.recordBatchItemRead(0, {
        ok: false,
        error: { code: "pdf-no-text-layer", message: "The PDF has no text layer." },
      })
    );
    expect(batchItemStatus(result.current.job!, 0)).toBe("error");
    const job = result.current.job!;
    if (job.source.type !== "files") throw new Error("expected a files source");
    expect(job.source.files[0].itemError).toEqual({
      code: "pdf-no-text-layer",
      message: "The PDF has no text layer.",
    });
  });
});

describe("useJobSession zero-pending batch completion (T17 #21 CORR-A)", () => {
  type EngineProcess = ReturnType<typeof createRegistryEngine>["process"];
  type EngineReturn = ReturnType<EngineProcess>;

  /** A stub engine outcome whose result maps to a session with ZERO detections. */
  function zeroPendingResult(text: string): EngineReturn["result"] {
    return {
      original: text,
      processed: text,
      entities: [],
      alerts: [],
      stats: { totalEntities: 0, byType: {} },
      sessionId: "stub-zero-pending-session",
      processingTime: 0,
    };
  }

  it("completes an item whose session already has zero pending mandatory detections", async () => {
    const stub: ReturnType<typeof createRegistryEngine> = {
      process(input) {
        return { result: zeroPendingResult(input.text), context: input.context };
      },
    };
    const job = domainBatchJob([
      { name: "doc-a.txt", read: { ok: true, extractedText: BATCH_DOC_A } },
      { name: "doc-b.txt", read: { ok: true, extractedText: BATCH_DOC_B } },
    ]);

    const run = await runBatchReviewAsync(beginProcessing(job), {
      engineLoader: async () => ({ process: async (input) => stub.process(input) }),
    });
    if (!run.ok) throw new Error(`expected ok: true, received failure ${run.failure.code}`);

    // Both sessions have zero pending detections: both items complete
    // immediately without any fictitious decide/addManual action, and the
    // derived batch state reflects the completed review.
    for (const index of [0, 1]) {
      expect(batchItemStatus(run.job, index)).toBe("completed");
      expect(getPendingDetections(run.sessions[index]!)).toHaveLength(0);
    }
    expect(run.job.review.complete).toBe(true);
    // T17 #21 CORR-B: a completed batch review does NOT make batch output
    // available; no accepted batch Safe Output / Confidential Audit format
    // exists, so both output flags stay fail-closed.
    expect(run.job.outputs.safeOutputReady).toBe(false);
    expect(run.job.outputs.confidentialAuditReady).toBe(false);
    expect(run.activeIndex).toBe(0);
  });

  it("keeps a session with pending detections review-required in the same mixed run", async () => {
    // The stub returns a zero-pending session for doc A only; doc B goes
    // through the REAL engine (its detections stay pending). The real engine
    // still RUNS for doc A so its fresh-mode reset keeps the shared legacy
    // module state consistent for the shared-mode doc B pass; only the
    // RESULT is swapped for the zero-pending one.
    const real = createRegistryEngine();
    const stub: ReturnType<typeof createRegistryEngine> = {
      process(input) {
        const realOutcome = real.process(input);
        if (input.text === BATCH_DOC_A) {
          return { result: zeroPendingResult(input.text), context: realOutcome.context };
        }
        return realOutcome;
      },
    };
    const job = domainBatchJob([
      { name: "doc-a.txt", read: { ok: true, extractedText: BATCH_DOC_A } },
      { name: "doc-b.txt", read: { ok: true, extractedText: BATCH_DOC_B } },
    ]);

    const run = await runBatchReviewAsync(beginProcessing(job), {
      engineLoader: async () => ({ process: async (input) => stub.process(input) }),
    });
    if (!run.ok) throw new Error(`expected ok: true, received failure ${run.failure.code}`);

    expect(batchItemStatus(run.job, 0)).toBe("completed");
    expect(batchItemStatus(run.job, 1)).toBe("review-required");
    expect(getPendingDetections(run.sessions[1]!).length).toBeGreaterThan(0);
    expect(run.job.review.complete).toBe(false);
    expect(run.job.outputs.safeOutputReady).toBe(false);
  });
});

/**
 * T17 #21 CORR-B oracles for the batch output authority. A document batch can
 * complete its review legitimately, but the accepted specification defines no
 * batch Safe Output and no batch-wide Confidential Audit, so both output
 * surfaces stay unavailable. The active document's session is never promoted
 * to a batch-wide audit.
 */
describe("useJobSession batch output authority (T17 #21 CORR-B)", () => {
  it("keeps review.complete true while both batch output surfaces stay unavailable", async () => {
    const { result } = renderHook(() => useJobSession());
    reviewedBatch(result);
    await act(async () => {
      await result.current.startReview();
    });
    completeItem(result, 0);
    completeItem(result, 1);

    expect(result.current.job!.review.complete).toBe(true);
    expect(result.current.job!.outputs.safeOutputReady).toBe(false);
    expect(result.current.job!.outputs.confidentialAuditReady).toBe(false);
  });
});

describe("useJobSession batch bridge contracts (T17 #21 WU-B)", () => {
  it("makes a second batch startReview an exact no-op while sessions exist", async () => {
    const { result } = renderHook(() => useJobSession());
    reviewedBatch(result);
    await act(async () => {
      await result.current.startReview();
    });

    const jobAfterFirst = result.current.job;
    const sessionsAfterFirst = result.current.batchSessions;
    expect(sessionsAfterFirst).not.toBeNull();

    let second: ProcessingFailure | null = null;
    await act(async () => {
      second = await result.current.startReview();
    });
    expect(second).toBeNull();
    expect(result.current.job).toBe(jobAfterFirst);
    expect(result.current.batchSessions).toBe(sessionsAfterFirst);
  });

  it("drops every batch session and requeues items on a real policy change (SD-8)", async () => {
    const { result } = renderHook(() => useJobSession());
    reviewedBatch(result);
    await act(async () => {
      await result.current.startReview();
    });
    expect(result.current.batchSessions).not.toBeNull();
    expect(batchItemStatus(result.current.job!, 0)).toBe("review-required");

    act(() => result.current.updatePolicy("strict"));
    expect(result.current.batchSessions).toBeNull();
    expect(result.current.batchActiveIndex).toBeNull();
    expect(result.current.job!.policyId).toBe("strict");
    expect(batchItemStatus(result.current.job!, 0)).toBe("queued");
    expect(batchItemStatus(result.current.job!, 1)).toBe("queued");
  });

  it("no-ops decide/addManual/selectDocument without a batch or an active session", async () => {
    const { result } = renderHook(() => useJobSession());
    act(() => result.current.decide("missing", "restored"));
    act(() => result.current.addManual({ start: 0, end: 1, type: "manual" }));
    act(() => result.current.selectDocument(3));
    expect(result.current.job).toBeNull();
    expect(result.current.batchActiveIndex).toBeNull();

    // A batch whose queued items carry no text fails per item; with no
    // successful session there is no active item, so review calls stay no-ops.
    act(() =>
      result.current.create({
        type: "files",
        files: [
          { name: "sin-lectura-a.txt", extension: "txt" },
          { name: "sin-lectura-b.txt", extension: "txt" },
        ],
      })
    );
    await act(async () => {
      await result.current.startReview();
    });
    expect(result.current.batchSessions).toEqual({});
    expect(result.current.batchActiveIndex).toBeNull();
    const jobBefore = result.current.job;
    act(() => result.current.decide("missing", "restored"));
    act(() => result.current.addManual({ start: 0, end: 1, type: "manual" }));
    expect(result.current.job).toBe(jobBefore);
  });

  it("blocks safeOutputReady while a failed item remains even if every evaluable item is completed", async () => {
    const { result } = renderHook(() => useJobSession());
    act(() =>
      result.current.create({
        type: "files",
        files: [
          { name: "doc-a.txt", extension: "txt" },
          { name: "doc-b.txt", extension: "txt" },
          { name: "doc-c.txt", extension: "txt" },
        ],
      })
    );
    act(() => result.current.beginBatchItemRead(0));
    act(() => result.current.recordBatchItemRead(0, { ok: true, extractedText: BATCH_DOC_A }));
    act(() => result.current.beginBatchItemRead(1));
    act(() =>
      result.current.recordBatchItemRead(1, {
        ok: false,
        error: { code: "pdf-no-text-layer", message: "The PDF has no text layer." },
      })
    );
    act(() => result.current.beginBatchItemRead(2));
    act(() => result.current.recordBatchItemRead(2, { ok: true, extractedText: BATCH_DOC_B }));
    await act(async () => {
      await result.current.startReview();
    });

    expect(batchItemStatus(result.current.job!, 1)).toBe("error");
    expect(result.current.batchActiveIndex).toBe(0);

    completeItem(result, 0);
    completeItem(result, 2);
    // Every evaluable item is completed, but the failed item blocks output.
    expect(result.current.job!.review.complete).toBe(true);
    expect(result.current.job!.outputs.safeOutputReady).toBe(false);
  });

  it("keeps the single-document path free of batch state", async () => {
    const { result } = renderHook(() => useJobSession());
    act(() => result.current.create({ type: "pasted-text", text: SYNTHETIC_NOTE }));
    expect(result.current.batchSessions).toBeNull();
    expect(result.current.batchActiveIndex).toBeNull();
    await act(async () => {
      await result.current.startReview();
    });
    expect(result.current.review).not.toBeNull();
    expect(result.current.batchSessions).toBeNull();
  });
});

/**
 * Batch failure recovery (#78, REC-06) bridge oracles. The recovery actions
 * are driven through the REAL hook and the REAL engine; the deterministic
 * per-text marker in the engine-seam mock produces a RETAINED-text processing
 * failure (retryable) and clears to let the retry succeed. All fixtures are
 * synthetic; no real content anywhere.
 */
describe("useJobSession batch failure recovery (#78)", () => {
  const RETRY_DOC = "Nombre: Carmen Sánchez. La paciente Marta Gómez acude a consulta.";
  const DOC_C = BATCH_DOC_B;

  /** Create/read a 3-document batch whose item 1 (B) will fail processing. */
  function failingBatch(result: { readonly current: SessionHook }) {
    act(() =>
      result.current.create({
        type: "files",
        files: [
          { name: "doc-a.txt", extension: "txt" },
          { name: "doc-b.txt", extension: "txt" },
          { name: "doc-c.txt", extension: "txt" },
        ],
      })
    );
    act(() => result.current.beginBatchItemRead(0));
    act(() => result.current.recordBatchItemRead(0, { ok: true, extractedText: BATCH_DOC_A }));
    act(() => result.current.beginBatchItemRead(1));
    act(() => result.current.recordBatchItemRead(1, { ok: true, extractedText: RETRY_DOC }));
    act(() => result.current.beginBatchItemRead(2));
    act(() => result.current.recordBatchItemRead(2, { ok: true, extractedText: DOC_C }));
  }

  /** Run the initial batch attempt with item B deterministically failing. */
  async function runWithFailedMiddleItem(result: { readonly current: SessionHook }) {
    failingBatch(result);
    engineControl.markerText = RETRY_DOC;
    await act(async () => {
      await result.current.startReview();
    });
    expect(batchItemStatus(result.current.job!, 0)).toBe("review-required");
    expect(batchItemStatus(result.current.job!, 1)).toBe("error");
    expect(batchItemStatus(result.current.job!, 2)).toBe("review-required");
    expect(result.current.batchRetryContextAvailable).toBe(true);
    const job = result.current.job!;
    if (job.source.type !== "files") throw new Error("expected a files source");
    expect(job.source.files[1].itemError?.code).toBe("processing-unknown");
    // A processing failure KEEPS the read artifact: the item is retryable.
    expect(job.source.files[1].extraction).toEqual({
      status: "extracted",
      extractedText: RETRY_DOC,
    });
    return job;
  }

  it("runBatchReviewAsync returns the retained shared context on the ok branch", async () => {
    const real = createRegistryEngine();
    const job = domainBatchJob([
      { name: "a.txt", read: { ok: true, extractedText: BATCH_DOC_A } },
      { name: "b.txt", read: { ok: true, extractedText: BATCH_DOC_B } },
    ]);
    const run = await runBatchReviewAsync(beginProcessing(job), {
      engineLoader: async () => ({ process: async (input) => real.process(input) }),
    });
    if (!run.ok) throw new Error("expected ok: true");
    expect(run.sharedContext.mode).toBe("shared");
    expect(run.sharedContext.pseudonymState).toBeDefined();

    // With a rejected engine load the attempt fails closed and the failure
    // branch carries no shared context at all.
    const allFail = domainBatchJob([
      { name: "a.txt", read: { ok: true, extractedText: "No readable identifier here." } },
      { name: "b.txt", read: { ok: true, extractedText: "Tampoco aquí." } },
    ]);
    const failing = await runBatchReviewAsync(beginProcessing(allFail), {
      engineLoader: async () => {
        throw new Error("module load failed");
      },
    });
    if (failing.ok) throw new Error("expected ok: false");
    expect(failing.job.processing).toBe("unknown");
  });

  it("retry end-to-end: contextual success preserves unrelated work and cross-document consistency (witnesses 1+7)", async () => {
    const { result } = renderHook(() => useJobSession());
    const job = await runWithFailedMiddleItem(result);
    const sessionsBefore = result.current.batchSessions!;
    expect(sessionsBefore[1]).toBeUndefined();

    // Give A and C real, independent review decisions before the retry.
    completeItem(result, 0);
    completeItem(result, 2);
    const decisionsBefore = {
      0: result.current.batchSessions![0],
      2: result.current.batchSessions![2],
    };

    engineControl.markerText = null;
    let failure: ProcessingFailure | null | "unset" = "unset";
    await act(async () => {
      failure = await result.current.retryBatchItem(job.id, 1);
    });
    expect(failure).toBeNull();

    // The retried item gains review authority for THAT item only.
    expect(batchItemStatus(result.current.job!, 1)).toBe("review-required");
    const sessions = result.current.batchSessions!;
    expect(sessions[1]).toBeDefined();
    // Unrelated work preservation: session OBJECT IDENTITY is untouched.
    expect(sessions[0]).toBe(decisionsBefore[0]);
    expect(sessions[2]).toBe(decisionsBefore[2]);
    expect(batchItemStatus(result.current.job!, 0)).toBe("completed");
    expect(batchItemStatus(result.current.job!, 2)).toBe("completed");
    // Source identity is preserved verbatim for every item.
    const filesAfter = (result.current.job!.source as { files: readonly unknown[] }).files;
    expect(filesAfter).toHaveLength(3);
    expect(filesAfter[1]).toEqual({
      name: "doc-b.txt",
      extension: "txt",
      extraction: { status: "extracted", extractedText: RETRY_DOC },
      itemStatus: "review-required",
    });

    // Shared consistency (witness 7): the same original keeps its pseudonym
    // from the already-processed documents, and a NEW original takes the next
    // free counter instead of colliding or restarting.
    expect(engineProposal(sessions[0]!, "Carmen Sánchez")).toBe("Paciente 1");
    expect(engineProposal(sessions[2]!, "Carmen Sánchez")).toBe("Paciente 1");
    expect(engineProposal(sessions[2]!, "Lucía Ruiz")).toBe("Paciente 2");
    expect(engineProposal(sessions[1]!, "Carmen Sánchez")).toBe("Paciente 1");
    expect(engineProposal(sessions[1]!, "Marta Gómez")).toBe("Paciente 3");
  });

  it("double-fire guard: a second overlapping retry for the same job is a no-op", async () => {
    const { result } = renderHook(() => useJobSession());
    const job = await runWithFailedMiddleItem(result);
    const sessionsBefore = result.current.batchSessions;

    engineControl.markerText = null;
    engineControl.hold = true;
    const first = result.current.retryBatchItem(job.id, 1);
    await act(async () => {
      await Promise.resolve();
    });
    // The started attempt is installed and the engine load is held open.
    expect(batchItemStatus(result.current.job!, 1)).toBe("processing");

    let second: ProcessingFailure | null | "unset" = "unset";
    await act(async () => {
      second = await result.current.retryBatchItem(job.id, 1);
    });
    expect(second).toBeNull();
    expect(batchItemStatus(result.current.job!, 1)).toBe("processing");
    expect(result.current.batchSessions).toBe(sessionsBefore);

    engineControl.hold = false;
    releasePendingEngine();
    await act(async () => {
      await first;
    });
    expect(batchItemStatus(result.current.job!, 1)).toBe("review-required");
  });

  it("a failed retry returns the item to a truthful error, never a zombie state", async () => {
    const { result } = renderHook(() => useJobSession());
    const job = await runWithFailedMiddleItem(result);
    const sessionsBefore = result.current.batchSessions;
    const errorsBefore = result.current.job!.errors.length;

    // The marker stays: the retry fails again deterministically.
    let failure: ProcessingFailure | null | "unset" = "unset";
    await act(async () => {
      failure = await result.current.retryBatchItem(job.id, 1);
    });
    if (failure === "unset") throw new Error("expected a settled retry outcome");
    // (The explicit cast documents the runtime type: TypeScript cannot see
    // through the closure assignment inside `act` and narrows `failure` to
    // `never` at this point.)
    expect((failure as ProcessingFailure | null)?.code).toBe("processing-unknown");
    expect(batchItemStatus(result.current.job!, 1)).toBe("error");
    const files = sourceFiles(result.current.job!);
    expect(files[1].itemError?.code).toBe("processing-unknown");
    expect(files[1].extraction).toEqual({ status: "extracted", extractedText: RETRY_DOC });
    // No session was fabricated and the unrelated sessions are untouched.
    expect(result.current.batchSessions).toBe(sessionsBefore);
    expect(result.current.batchSessions![1]).toBeUndefined();
    expect(result.current.job!.errors.length).toBe(errorsBefore);
    // The derived gate stays fail-closed while the active failure exists.
    expect(result.current.job!.review.complete).toBe(false);
    expect(result.current.job!.outputs.safeOutputReady).toBe(false);
  });

  it("policy change mid-retry drops the stale outcome with zero mutation", async () => {
    const { result } = renderHook(() => useJobSession());
    const job = await runWithFailedMiddleItem(result);

    engineControl.markerText = null;
    engineControl.hold = true;
    const attempt = result.current.retryBatchItem(job.id, 1);
    await act(async () => {
      await Promise.resolve();
    });
    expect(batchItemStatus(result.current.job!, 1)).toBe("processing");

    // A REAL policy change while the retry engine is pending: the domain
    // resets the processing-derived state (item → queued) and the bridge
    // drops the batch state.
    act(() => {
      result.current.updatePolicy("strict");
    });
    engineControl.hold = false;
    releasePendingEngine();
    let failure: ProcessingFailure | null | "unset" = "unset";
    await act(async () => {
      failure = await attempt;
    });
    expect(failure).toBeNull();
    expect(result.current.job!.policyId).toBe("strict");
    expect(batchItemStatus(result.current.job!, 1)).toBe("queued");
    expect(result.current.batchSessions).toBeNull();
    expect(result.current.batchRetryContextAvailable).toBe(false);
  });

  it("stale action guard: actions captured for job A cannot mutate a replaced or cleared job (witness 6)", async () => {
    const { result } = renderHook(() => useJobSession());
    const jobA = await runWithFailedMiddleItem(result);
    const retryA = (index: number) => result.current.retryBatchItem(jobA.id, index);
    const removeA = (index: number) => result.current.removeBatchItem(jobA.id, index);
    const ackA = (index: number) => result.current.acknowledgeBatchItemError(jobA.id, index);

    // New Job replaces A with B: every captured A action must be a no-op.
    act(() =>
      result.current.create({
        type: "files",
        files: [
          { name: "otro-a.txt", extension: "txt" },
          { name: "otro-b.txt", extension: "txt" },
        ],
      })
    );
    const jobB = result.current.job!;
    engineControl.markerText = null;
    await act(async () => {
      expect(await retryA(1)).toBeNull();
    });
    removeA(1);
    ackA(1);
    expect(result.current.job).toBe(jobB);
    expect(batchItemStatus(jobB, 1)).toBe("queued");
    const filesB = sourceFiles(jobB);
    expect(filesB[1].itemDisposition).toBeUndefined();

    // Clear session: same no-op guarantee with no job at all.
    act(() => result.current.clear());
    await act(async () => {
      expect(await retryA(1)).toBeNull();
    });
    removeA(1);
    ackA(1);
    expect(result.current.job).toBeNull();
  });

  it("acknowledge through the bridge: non-resolution with the blocker still active (witness 5)", async () => {
    const { result } = renderHook(() => useJobSession());
    const job = await runWithFailedMiddleItem(result);

    act(() => result.current.acknowledgeBatchItemError(job.id, 1));
    const files = sourceFiles(result.current.job!);
    expect(files[1].itemAcknowledged).toBe(true);
    expect(batchItemStatus(result.current.job!, 1)).toBe("error");
    expect(result.current.job!.outputs.safeOutputReady).toBe(false);
    // The acknowledged error is STILL an active blocker: completing every
    // evaluable item is not enough while it is neither retried nor removed.
    completeItem(result, 0);
    completeItem(result, 2);
    expect(result.current.job!.review.complete).toBe(true);
    expect(result.current.job!.outputs.safeOutputReady).toBe(false);

    // Removal — not the acknowledgement — resolves the active blocker, and
    // even then nothing fabricates review completion for the removed item.
    const reviewComplete = result.current.job!.review.complete;
    act(() => result.current.removeBatchItem(job.id, 1));
    const afterRemoval = sourceFiles(result.current.job!)[1];
    expect(afterRemoval.itemDisposition).toBe("removed");
    expect(afterRemoval.itemStatus).toBe("error");
    expect(result.current.job!.review.complete).toBe(reviewComplete);
    expect(result.current.job!.outputs.safeOutputReady).toBe(false);
    expect(result.current.batchSessions![0]).toBeDefined();
  });

  it("a mid-run acknowledge on a read-failed item survives the run's outcome install (#78)", async () => {
    const { result } = renderHook(() => useJobSession());
    act(() =>
      result.current.create({
        type: "files",
        files: [
          { name: "doc-a.txt", extension: "txt" },
          { name: "doc-b.txt", extension: "txt" },
          { name: "doc-c.txt", extension: "txt" },
        ],
      })
    );
    act(() => result.current.beginBatchItemRead(0));
    act(() => result.current.recordBatchItemRead(0, { ok: true, extractedText: BATCH_DOC_A }));
    act(() => result.current.beginBatchItemRead(1));
    act(() =>
      result.current.recordBatchItemRead(1, {
        ok: false,
        error: { code: "pdf-no-text-layer", message: "No text layer." },
      })
    );
    act(() => result.current.beginBatchItemRead(2));
    act(() => result.current.recordBatchItemRead(2, { ok: true, extractedText: BATCH_DOC_B }));

    // Hold the engine loader so the run is observably in flight while the
    // read-failed item is already visible with its recovery actions.
    engineControl.hold = true;
    let runPromise: Promise<ProcessingFailure | null> | undefined;
    act(() => {
      runPromise = result.current.startReview();
    });
    expect(batchItemStatus(result.current.job!, 1)).toBe("error");
    // The operator acknowledges the read failure WHILE the run is in flight.
    act(() => result.current.acknowledgeBatchItemError(result.current.job!.id, 1));
    expect(sourceFiles(result.current.job!)[1].itemAcknowledged).toBe(true);

    // Release the engine: the run settles and installs its outcome.
    engineControl.hold = false;
    act(() => releasePendingEngine());
    await act(async () => {
      await runPromise;
    });

    // The explicit mid-run mutation is NOT reverted by the outcome install.
    const files = sourceFiles(result.current.job!);
    expect(files[1].itemAcknowledged).toBe(true);
    expect(batchItemStatus(result.current.job!, 1)).toBe("error");
    // The run still owns the items it processed.
    expect(batchItemStatus(result.current.job!, 0)).toBe("review-required");
    expect(batchItemStatus(result.current.job!, 2)).toBe("review-required");
  });

  it("recovery entry points are no-ops without a current batch or for invalid items", async () => {
    const { result } = renderHook(() => useJobSession());
    const job = await runWithFailedMiddleItem(result);
    const before = result.current.job;

    // Wrong job id.
    await act(async () => {
      expect(await result.current.retryBatchItem("job-inexistente", 1)).toBeNull();
    });
    act(() => result.current.removeBatchItem("job-inexistente", 1));
    act(() => result.current.acknowledgeBatchItemError("job-inexistente", 1));
    expect(result.current.job).toBe(before);

    // Non-retryable items (review-required/queued) and an out-of-range index.
    await act(async () => {
      expect(await result.current.retryBatchItem(job.id, 0)).toBeNull();
      expect(await result.current.retryBatchItem(job.id, 9)).toBeNull();
    });
    expect(result.current.job).toBe(before);

    // Remove/acknowledge of a non-error item and an out-of-range index are
    // refused by the domain (typed) and never corrupt the state.
    expect(() => result.current.removeBatchItem(job.id, 0)).toThrowError();
    expect(() => result.current.acknowledgeBatchItemError(job.id, 9)).toThrowError();
    expect(batchItemStatus(result.current.job!, 0)).toBe("review-required");
    expect(result.current.job!.id).toBe(job.id);
  });
});
