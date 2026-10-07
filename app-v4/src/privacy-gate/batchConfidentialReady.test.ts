/**
 * CORA-89-01 unit evidence for the ONE shared batch-Confidential availability
 * authority (`batchConfidentialAuditReady`).
 *
 * Proves, on pure derivations (no DOM):
 *  - the ready fact requires the accepted batch-ready prerequisite AND the
 *    exact current finalizable per-item session set AND at least one
 *    auditable completed section;
 *  - the two negative session-authority boundaries fail closed: a completed
 *    item whose current session is MISSING, and a current session that is no
 *    longer FINALIZABLE, both derive `false`;
 *  - a `null` session authority, a not-ready batch (even with a true
 *    job-side availability mirror — the mirror is never read) and an
 *    all-removed batch (zero auditable sections) all derive `false`;
 *  - deliberately removed failures stay permitted as bounded disposition
 *    history: they need no session and never count as audited sections;
 *  - builder correspondence: the batch Confidential bytes authority succeeds
 *    exactly when this authority derives `true`, and refuses (zero bytes)
 *    exactly when it derives `false`.
 *
 * Fixtures are synthetic; no real content anywhere.
 */
import { describe, expect, it } from "vitest";

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
  type OutputAvailability,
} from "../domain/job";
import {
  BatchConfidentialAuditError,
  buildBatchConfidentialAuditText,
} from "../export/batchConfidentialAudit";
import { createReviewSession, type ReviewSession } from "../review/review-domain";
import { batchConfidentialAuditReady } from "./privacyGateModel";

// ---------------------------------------------------------------------------
// Fixtures (synthetic Spanish clinical-style text; no real content)
// ---------------------------------------------------------------------------

const SOURCE_A = "Nombre: Carmen Sánchez. Teléfono 612345678.";
const NAME_START = SOURCE_A.indexOf("Carmen Sánchez");
const NAME_END = NAME_START + "Carmen Sánchez".length;

function buildBatchJob(names: readonly string[]): Job {
  return createJob({
    type: "files",
    files: names.map((name) => ({ name, extension: "txt" })),
  });
}

function readOk(job: Job, index: number, text: string): Job {
  return recordItemRead(beginItemRead(job, index), index, { ok: true, extractedText: text });
}

function failItemRead(job: Job, index: number): Job {
  return recordItemRead(beginItemRead(job, index), index, {
    ok: false,
    error: { code: "pdf-no-text-layer", message: "El PDF no tiene capa de texto." },
  });
}

function completeItem(job: Job, index: number, text: string): Job {
  const processed = recordItemProcessed(
    beginItemProcessing(readOk(job, index, text), index),
    index
  );
  return recordItemReviewCompletion(processed, index, true);
}

function derivedBatch(job: Job): Job {
  return withReviewState(job, { complete: batchReviewComplete(job) });
}

/** A finalizable per-item session (zero pending mandatory detections). */
function finalizableSession(sessionId: string): ReviewSession {
  return createReviewSession({
    originalText: "Contenido sintético del documento.",
    detections: [],
    sessionId,
  });
}

/** A non-finalizable per-item session (one pending mandatory decision). */
function nonFinalizableSession(sessionId: string): ReviewSession {
  return createReviewSession({
    originalText: SOURCE_A,
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
    sessionId,
  });
}

/**
 * The otherwise-ready batch: two items, item 2 (index 1) fails locally and is
 * deliberately removed, item 1 (index 0) is completed and audited.
 */
function readyBatchWithRemovedItem(): { job: Job; sessions: Record<number, ReviewSession> } {
  let job = failItemRead(buildBatchJob(["informe-a.txt", "informe-b.txt"]), 1);
  job = completeItem(job, 0, SOURCE_A);
  job = removeBatchItem(job, 1);
  return { job: derivedBatch(job), sessions: { 0: finalizableSession("lote-0") } };
}

/** Two completed items, both with finalizable sessions. */
function readyTwoItemBatch(): { job: Job; sessions: Record<number, ReviewSession> } {
  let job = completeItem(buildBatchJob(["informe-a.txt", "informe-b.txt"]), 0, SOURCE_A);
  job = completeItem(job, 1, "Contenido sintético B.");
  return {
    job: derivedBatch(job),
    sessions: {
      0: finalizableSession("lote-0"),
      1: finalizableSession("lote-1"),
    },
  };
}

// ---------------------------------------------------------------------------
// Shared availability authority (CORA-89-01)
// ---------------------------------------------------------------------------

describe("batchConfidentialAuditReady — the ONE shared batch-Confidential availability authority", () => {
  it("derives true for a fully authorized batch (ready + complete finalizable session set + one audited section)", () => {
    const { job, sessions } = readyTwoItemBatch();
    expect(batchConfidentialAuditReady(job, sessions)).toBe(true);
  });

  it("derives true while a deliberately removed failure contributes bounded disposition history only", () => {
    const { job, sessions } = readyBatchWithRemovedItem();
    // The removed failed item needs NO session and the single audited
    // completed item authorizes the artifact.
    expect(sessions[1]).toBeUndefined();
    expect(batchConfidentialAuditReady(job, sessions)).toBe(true);
  });

  it("derives false when a completed item's current session is missing", () => {
    const { job, sessions } = readyTwoItemBatch();
    const incomplete = { ...sessions };
    delete incomplete[1];
    expect(batchConfidentialAuditReady(job, incomplete)).toBe(false);
  });

  it("derives false when a completed item's current session is no longer finalizable", () => {
    const { job, sessions } = readyTwoItemBatch();
    const stale = { ...sessions, 1: nonFinalizableSession("lote-1-stale") };
    expect(batchConfidentialAuditReady(job, stale)).toBe(false);
  });

  it("derives false when no current session authority exists", () => {
    const { job } = readyTwoItemBatch();
    expect(batchConfidentialAuditReady(job, null)).toBe(false);
  });

  it("derives false for a not-ready batch and never reads the job-side availability mirror", () => {
    // Completed-looking Job whose authoritative review completeness is FALSE,
    // carrying a TRUE mirrored flag: the mirror alone can never authorize.
    let job = completeItem(buildBatchJob(["informe-a.txt", "informe-b.txt"]), 0, SOURCE_A);
    job = completeItem(job, 1, "Contenido sintético B.");
    const mirrored: Job = {
      ...job,
      review: { complete: false },
      outputs: {
        safeOutputReady: false,
        confidentialAuditReady: true,
      } as OutputAvailability,
    };
    const sessions = { 0: finalizableSession("lote-0"), 1: finalizableSession("lote-1") };
    expect(batchConfidentialAuditReady(mirrored, sessions)).toBe(false);
  });

  it("derives false when every failed item was removed (zero auditable sections)", () => {
    const failed = failItemRead(
      failItemRead(buildBatchJob(["informe-a.txt", "informe-b.txt"]), 0),
      1
    );
    const removed = removeBatchItem(removeBatchItem(failed, 0), 1);
    const job = withReviewState(removed, { complete: false });
    expect(batchConfidentialAuditReady(job, {})).toBe(false);
  });

  it("derives false for a non-batch job (never a batch Confidential artifact)", () => {
    const single = createJob({ type: "pasted-text", text: SOURCE_A });
    expect(batchConfidentialAuditReady(single, { 0: finalizableSession("solo") })).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Builder correspondence: the bytes authority agrees with the shared fact
// ---------------------------------------------------------------------------

describe("builder correspondence with the shared availability authority (CORA-89-01)", () => {
  it("succeeds exactly when the shared authority derives true (fully authorized batch)", async () => {
    const { job, sessions } = readyBatchWithRemovedItem();
    expect(batchConfidentialAuditReady(job, sessions)).toBe(true);
    const text = await buildBatchConfidentialAuditText(job, sessions);
    expect(text.startsWith("CONFIDENTIAL — INTERNAL AUDIT ARTIFACT")).toBe(true);
  });

  it("refuses with zero bytes exactly when the shared authority derives false (missing session)", async () => {
    const { job, sessions } = readyBatchWithRemovedItem();
    const incomplete = { ...sessions };
    delete incomplete[0];
    expect(batchConfidentialAuditReady(job, incomplete)).toBe(false);
    await expect(buildBatchConfidentialAuditText(job, incomplete)).rejects.toBeInstanceOf(
      BatchConfidentialAuditError
    );
  });

  it("refuses with zero bytes exactly when the shared authority derives false (non-finalizable session)", async () => {
    const { job, sessions } = readyBatchWithRemovedItem();
    const stale = { ...sessions, 0: nonFinalizableSession("lote-0-stale") };
    expect(batchConfidentialAuditReady(job, stale)).toBe(false);
    await expect(buildBatchConfidentialAuditText(job, stale)).rejects.toBeInstanceOf(
      BatchConfidentialAuditError
    );
  });
});
