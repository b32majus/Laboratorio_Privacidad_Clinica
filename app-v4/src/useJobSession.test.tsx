import { act, cleanup, fireEvent, render, renderHook, screen } from "@testing-library/react";
import { useState } from "react";
import { afterEach, describe, expect, it } from "vitest";
import "@testing-library/jest-dom/vitest";

import {
  type BatchItemReadOutcome,
  type Job,
  type ProcessingFailure,
  batchFailedItems,
  batchItemStatus,
  beginItemRead,
  beginProcessing,
  createJob,
  recordItemRead,
} from "./domain/job";
import { PolicyError } from "./engine/policy";
import { createRegistryEngine } from "./engine/registry-engine";
import { getPendingDetections, type ReviewSession } from "./review/review-domain";
import { runBatchReview, useJobSession } from "./useJobSession";

/**
 * Oracles for the state bridge's single processing-attempt entry point
 * (T15 #19, GitHub #19 acceptance bullet 3).
 *
 * The probe uses the REAL hook and drives the REAL `startReview()`; the engine
 * is never mocked, so the success route runs the composed registry engine and
 * the failure route raises the real typed `PolicyError` for the
 * known-but-unmapped `external-ai` policy. The observed state is rendered as
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
      <button type="button" onClick={() => setReturned(session.startReview())}>
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

afterEach(cleanup);

describe("useJobSession.startReview (T15 #19)", () => {
  it("success route: records succeeded, installs a session and returns null", () => {
    render(<ProcessingProbe />);
    fireEvent.click(screen.getByRole("button", { name: "create job" }));
    fireEvent.click(screen.getByRole("button", { name: "start review" }));

    const probe = screen.getByRole("status", { name: "processing probe" });
    expect(probe).toHaveTextContent("processing: succeeded");
    expect(probe).toHaveTextContent("errors: none");
    expect(probe).toHaveTextContent("session: installed");
    expect(probe).toHaveTextContent("returned: null");
  });

  it("typed-failure route: records failed, appends the typed error and installs no session", () => {
    render(<ProcessingProbe />);
    fireEvent.click(screen.getByRole("button", { name: "create job" }));
    fireEvent.click(screen.getByRole("button", { name: "policy external-ai" }));
    fireEvent.click(screen.getByRole("button", { name: "start review" }));

    const probe = screen.getByRole("status", { name: "processing probe" });
    expect(probe).toHaveTextContent("processing: failed");
    expect(probe).toHaveTextContent("errors: policy-unsupported");
    expect(probe).toHaveTextContent("session: none");
    expect(probe).toHaveTextContent("returned: policy-unsupported /");
    expect(probe).toHaveTextContent(/no accepted per-category operator mapping/i);
    // The failure is never mistaken for a successful review.
    expect(probe).not.toHaveTextContent("processing: succeeded");
  });

  it("retry route: a failed attempt can start again and reach a terminal success", () => {
    render(<ProcessingProbe />);
    fireEvent.click(screen.getByRole("button", { name: "create job" }));
    fireEvent.click(screen.getByRole("button", { name: "policy external-ai" }));
    fireEvent.click(screen.getByRole("button", { name: "start review" }));
    expect(screen.getByRole("status", { name: "processing probe" })).toHaveTextContent(
      "processing: failed"
    );

    // Fix the policy back to a mapped one, then retry the same job.
    fireEvent.click(screen.getByRole("button", { name: "policy standard" }));
    fireEvent.click(screen.getByRole("button", { name: "start review" }));

    const probe = screen.getByRole("status", { name: "processing probe" });
    expect(probe).toHaveTextContent("processing: succeeded");
    expect(probe).toHaveTextContent("session: installed");
    expect(probe).toHaveTextContent("returned: null");
  });

  it("never-success-never-thrown contract: a typed failure is returned, not thrown", () => {
    render(<ProcessingProbe />);
    fireEvent.click(screen.getByRole("button", { name: "create job" }));
    fireEvent.click(screen.getByRole("button", { name: "policy external-ai" }));

    // The click handler calls the real startReview(); a throw would escape it.
    expect(() =>
      fireEvent.click(screen.getByRole("button", { name: "start review" }))
    ).not.toThrow();

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

describe("useJobSession batch review state (T17 #21 WU-B)", () => {
  it("keeps per-document review state independent and navigation pure (FUNC-002)", () => {
    const { result } = renderHook(() => useJobSession());
    reviewedBatch(result);

    let failure: ProcessingFailure | null = null;
    act(() => {
      failure = result.current.startReview();
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
  it("keeps later documents consistent and records the attempt after a mid-batch engine failure", () => {
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

    const run = runBatchReview(beginProcessing(job), { engineFactory: () => stub });
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
  it("commits an in-flight batch read after a mid-read policy change", () => {
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

  it("commits a failed read outcome after a mid-read policy change", () => {
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

  it("completes an item whose session already has zero pending mandatory detections", () => {
    const stub: ReturnType<typeof createRegistryEngine> = {
      process(input) {
        return { result: zeroPendingResult(input.text), context: input.context };
      },
    };
    const job = domainBatchJob([
      { name: "doc-a.txt", read: { ok: true, extractedText: BATCH_DOC_A } },
      { name: "doc-b.txt", read: { ok: true, extractedText: BATCH_DOC_B } },
    ]);

    const run = runBatchReview(beginProcessing(job), { engineFactory: () => stub });
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

  it("keeps a session with pending detections review-required in the same mixed run", () => {
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

    const run = runBatchReview(beginProcessing(job), { engineFactory: () => stub });
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
  it("keeps review.complete true while both batch output surfaces stay unavailable", () => {
    const { result } = renderHook(() => useJobSession());
    reviewedBatch(result);
    act(() => {
      result.current.startReview();
    });
    completeItem(result, 0);
    completeItem(result, 1);

    expect(result.current.job!.review.complete).toBe(true);
    expect(result.current.job!.outputs.safeOutputReady).toBe(false);
    expect(result.current.job!.outputs.confidentialAuditReady).toBe(false);
  });
});

describe("useJobSession batch bridge contracts (T17 #21 WU-B)", () => {
  it("makes a second batch startReview an exact no-op while sessions exist", () => {
    const { result } = renderHook(() => useJobSession());
    reviewedBatch(result);
    act(() => {
      result.current.startReview();
    });

    const jobAfterFirst = result.current.job;
    const sessionsAfterFirst = result.current.batchSessions;
    expect(sessionsAfterFirst).not.toBeNull();

    let second: ProcessingFailure | null = null;
    act(() => {
      second = result.current.startReview();
    });
    expect(second).toBeNull();
    expect(result.current.job).toBe(jobAfterFirst);
    expect(result.current.batchSessions).toBe(sessionsAfterFirst);
  });

  it("drops every batch session and requeues items on a real policy change (SD-8)", () => {
    const { result } = renderHook(() => useJobSession());
    reviewedBatch(result);
    act(() => {
      result.current.startReview();
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

  it("no-ops decide/addManual/selectDocument without a batch or an active session", () => {
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
    act(() => {
      result.current.startReview();
    });
    expect(result.current.batchSessions).toEqual({});
    expect(result.current.batchActiveIndex).toBeNull();
    const jobBefore = result.current.job;
    act(() => result.current.decide("missing", "restored"));
    act(() => result.current.addManual({ start: 0, end: 1, type: "manual" }));
    expect(result.current.job).toBe(jobBefore);
  });

  it("blocks safeOutputReady while a failed item remains even if every evaluable item is completed", () => {
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
    act(() => {
      result.current.startReview();
    });

    expect(batchItemStatus(result.current.job!, 1)).toBe("error");
    expect(result.current.batchActiveIndex).toBe(0);

    completeItem(result, 0);
    completeItem(result, 2);
    // Every evaluable item is completed, but the failed item blocks output.
    expect(result.current.job!.review.complete).toBe(true);
    expect(result.current.job!.outputs.safeOutputReady).toBe(false);
  });

  it("keeps the single-document path free of batch state", () => {
    const { result } = renderHook(() => useJobSession());
    act(() => result.current.create({ type: "pasted-text", text: SYNTHETIC_NOTE }));
    expect(result.current.batchSessions).toBeNull();
    expect(result.current.batchActiveIndex).toBeNull();
    act(() => {
      result.current.startReview();
    });
    expect(result.current.review).not.toBeNull();
    expect(result.current.batchSessions).toBeNull();
  });
});
