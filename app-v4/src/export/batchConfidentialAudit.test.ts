/**
 * Writer-phase evidence for the REC-07 #89 batch Confidential Audit builder.
 *
 * All claims run on the REAL emitted TXT bytes of
 * `buildBatchConfidentialAuditText` (never on internal calls or mocks):
 *  - canonical-oracle agreement: every completed section embeds the exact
 *    canonical `serializeConfidentialAudit(buildConfidentialAudit(...))`
 *    bytes of its current finalizable session (no privacy transform rerun,
 *    no Safe-text reconstruction);
 *  - allowed-vs-forbidden sentinel adversary: original detected values,
 *    reviewer notes and restored entries MUST appear; source filenames and
 *    ordinary kept/non-detected clinical text (Safe-only body) MUST NOT;
 *  - removed-item boundary: a deliberately removed failure stays eligible
 *    with bounded ordinal/disposition metadata only, while the #87 Safe
 *    summary CSV keeps its `error,retirado` row unchanged;
 *  - fail-closed refusals: missing session, stale/non-finalizable session,
 *    absent session set, and a not-ready batch even with a true
 *    job-side availability mirror (the mirror alone never authorizes bytes).
 *
 * All fixtures are synthetic; no real content anywhere.
 */
import { describe, expect, it } from "vitest";

import {
  BATCH_CONFIDENTIAL_AUDIT_FILENAME,
  BatchConfidentialAuditError,
  buildBatchConfidentialAuditText,
} from "./batchConfidentialAudit";
import { serializeBatchSummaryCsv } from "./batchResultModel";
import { buildConfidentialAudit } from "../output/confidential-audit";
import {
  CONFIDENTIAL_AUDIT_WARNING_LINE,
  serializeConfidentialAudit,
} from "../output/confidential-audit-serializer";
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
  type OutputAvailability,
} from "../domain/job";

// ---------------------------------------------------------------------------
// Fixtures (synthetic Spanish clinical-style text; no real content)
// ---------------------------------------------------------------------------

/** Source of batch item 1: two decided detections plus one kept (Safe-only) sentence. */
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
  // Restored (kept-original) decision: a canonical first-class audit entry.
  next = applyDecision(next, session.detections[2].id, "restored");
  return next;
}

/** Source of batch item 12: one modified NHC with a reviewer note. */
const SOURCE_11 = "NHC 2024/089756 de la paciente. Continuidad asistencial garantizada.";
const NHC_START = SOURCE_11.indexOf("2024/089756");
const NHC_END = NHC_START + "2024/089756".length;

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

/** Non-finalizable (pending) session — a stale review authority. */
function stalePendingSession(): ReviewSession {
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
    sessionId: "ui-lote-2-stale",
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

/**
 * The canonical realistic batch: 12 original items, item 6 (index 5) fails
 * locally and is deliberately removed, all others completed. Items 1 and 12
 * carry decided detections; the rest are plain completed documents.
 */
function realisticBatch(): {
  job: Job;
  sessions: Record<number, ReviewSession>;
} {
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
// Canonical-oracle + sentinel evidence on REAL emitted TXT bytes
// ---------------------------------------------------------------------------

describe("batch Confidential Audit builder (REC-07 #89)", () => {
  it("composes every completed section from the canonical per-item audit bytes", async () => {
    const { job, sessions } = realisticBatch();
    const text = await buildBatchConfidentialAuditText(job, sessions);

    // Canonical oracle: the emitted artifact embeds the exact canonical
    // serialization of each completed item's current audit — nothing is
    // re-derived through a second authority.
    for (let index = 0; index < DOC_COUNT; index += 1) {
      if (index === 5) continue;
      const canonical = serializeConfidentialAudit(buildConfidentialAudit(sessions[index]));
      expect(text).toContain(canonical);
      expect(text).toContain(`Session: ui-lote-${index}`);
    }

    // Canonical confidentiality marking comes from the serializer authority.
    expect(text.startsWith(CONFIDENTIAL_AUDIT_WARNING_LINE)).toBe(true);
  });

  it("passes the allowed-vs-forbidden sentinel adversary on the emitted bytes", async () => {
    const { job, sessions } = realisticBatch();
    const text = await buildBatchConfidentialAuditText(job, sessions);

    // Allowed: canonical Confidential authority facts.
    expect(text).toContain("Carmen Sánchez"); // original detected value
    expect(text).toContain("nota interna de revisión: verificar apellidos"); // reviewer note
    expect(text).toContain("TEL-FINAL"); // reviewer replacement
    expect(text).toContain("sin código de país en la fuente"); // modified-decision note
    expect(text).toContain("12345678Z"); // restored (kept-original) original value
    expect(text).toContain("kept original: yes (explicit restored decision)");
    expect(text).toContain("NHC-REEMPLAZO"); // second completed item's replacement
    expect(text).toContain("NHC normalizada por revisión");

    // Forbidden: source filenames and Safe-only ordinary clinical body text.
    expect(text).not.toContain(FILENAME_SENTINEL);
    expect(text).not.toContain("informe-paciente");
    expect(text).not.toContain(".txt");
    expect(text).not.toContain(SAFE_ONLY_SENTINEL);

    // Stable ordinal labels — never source filenames.
    expect(text).toContain("Documento 1");
    expect(text).toContain("Documento 12");

    // The deterministic Spanish filename contract.
    expect(BATCH_CONFIDENTIAL_AUDIT_FILENAME).toBe("auditoria-confidencial-lote.txt");
  });

  it("keeps a deliberately removed failure bounded and the Safe CSV manifest intact", async () => {
    const { job, sessions } = realisticBatch();
    const text = await buildBatchConfidentialAuditText(job, sessions);

    // The removed item keeps its ordinal label and bounded disposition
    // metadata only — no fabricated audit body, no session reference.
    expect(text).toContain("Documento 6");
    expect(text).toContain("Estado: error (retirado del lote; sin cuerpo de auditoría).");
    expect(text).not.toContain("Session: ui-lote-5");

    // The #87 Safe summary CSV is untouched: the removed failed item stays
    // `error,retirado` and completed rows stay `completado`.
    const csv = serializeBatchSummaryCsv(job);
    expect(csv).toContain("indice_lote,estado,disposicion");
    expect(csv).toContain("1,completado,");
    expect(csv).toContain("6,error,retirado");
    expect(csv).toContain("12,completado,");
    expect(sessions[5]).toBeUndefined();
  });

  it("refuses a completed item whose current session is missing (fail closed)", async () => {
    const { job, sessions } = realisticBatch();
    const incomplete = { ...sessions };
    delete incomplete[3];
    await expect(buildBatchConfidentialAuditText(job, incomplete)).rejects.toMatchObject({
      name: "BatchConfidentialAuditError",
      code: "BATCH_CONFIDENTIAL_NOT_AUTHORIZED",
    });
  });

  it("refuses a completed item whose current session is no longer finalizable", async () => {
    const { job, sessions } = realisticBatch();
    const stale = { ...sessions, 2: stalePendingSession() };
    await expect(buildBatchConfidentialAuditText(job, stale)).rejects.toBeInstanceOf(
      BatchConfidentialAuditError
    );
  });

  it("refuses when the per-item session set is absent", async () => {
    const { job } = realisticBatch();
    await expect(buildBatchConfidentialAuditText(job, null)).rejects.toBeInstanceOf(
      BatchConfidentialAuditError
    );
  });

  it("refuses a not-ready batch even when the job-side availability mirror is true", async () => {
    // Completed-looking Job whose derived review completeness is FALSE: the
    // synchronized mirror flag alone can never authorize bytes (the artifact
    // reuses the shared readiness prerequisite).
    let job = buildBatchJob(["informe-01.txt", "informe-02.txt"]);
    job = completeItem(job, 0, SOURCE_0);
    job = completeItem(job, 1, SOURCE_11);
    const mirrored: Job = {
      ...job,
      review: { complete: false },
      outputs: {
        safeOutputReady: false,
        confidentialAuditReady: true,
      } as OutputAvailability,
    };
    const sessions = { 0: adversarialSession0(), 1: adversarialSession11() };
    await expect(buildBatchConfidentialAuditText(mirrored, sessions)).rejects.toBeInstanceOf(
      BatchConfidentialAuditError
    );
  });
});
