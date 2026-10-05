/**
 * Unit oracle for the REC-05 WU-B single-item Result model (D-024).
 *
 * Proves the three states are derived from existing authorities and stay
 * distinguishable, that the canonical Safe payload exists ONLY when the Job ↔
 * ReviewSession correspondence is valid, and that the deliberately kept
 * original facts come straight from the ReviewSession. Synthetic/no-PHI data.
 */
import { describe, expect, it } from "vitest";

import {
  applyDecision,
  canFinalize,
  createReviewSession,
  getFinalText,
  getProgress,
  type ReviewSession,
} from "../review/review-domain";
import { createJob, withReviewState, type Job, type OutputAvailability } from "../domain/job";
import { deriveSingleResultView } from "./singleResultModel";

const SOURCE = "Nombre: Carmen Sánchez\nTeléfono 612345678. NHC 2024/089756.";
const NAME_START = SOURCE.indexOf("Carmen Sánchez");
const NAME_END = NAME_START + "Carmen Sánchez".length;
const PHONE_START = SOURCE.indexOf("612345678");
const PHONE_END = PHONE_START + "612345678".length;
const NHC_START = SOURCE.indexOf("2024/089756");
const NHC_END = NHC_START + "2024/089756".length;

function session(): ReviewSession {
  return createReviewSession({
    originalText: SOURCE,
    detections: [
      {
        type: "NOMBRE",
        start: NAME_START,
        end: NAME_END,
        confidence: 0.95,
        proposed: "PACIENTE-1",
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
    sessionId: "single-result-model-session",
  });
}

function completed(): ReviewSession {
  const base = session();
  let next = applyDecision(base, base.detections[0].id, "accepted");
  next = applyDecision(next, base.detections[1].id, "accepted");
  next = applyDecision(next, base.detections[2].id, "accepted");
  return next;
}

function jobFor(review: ReviewSession, overrides?: Partial<OutputAvailability>): Job {
  const safeOutputReady = canFinalize(review);
  return Object.freeze({
    ...withReviewState(createJob({ type: "pasted-text", text: SOURCE }), {
      complete: safeOutputReady,
    }),
    outputs: Object.freeze({
      safeOutputReady,
      confidentialAuditReady: true,
      ...overrides,
    }),
  }) as Job;
}

describe("deriveSingleResultView", () => {
  it("is ready only with valid correspondence and returns the canonical final text", () => {
    const review = completed();
    const view = deriveSingleResultView(jobFor(review), review);
    expect(view.state).toBe("ready");
    expect(view.safeText).toBe(getFinalText(review));
    expect(view.pendingCount).toBe(0);
    expect(view.attentionMessage).toBeNull();
    expect(view.blockedMessage).toBeNull();
  });

  it("is needs-attention (not ready) with mandatory review pending and exposes no payload", () => {
    const review = session();
    const view = deriveSingleResultView(jobFor(review), review);
    expect(view.state).toBe("needs-attention");
    expect(view.safeText).toBeNull();
    expect(view.pendingCount).toBe(3);
    expect(view.attentionMessage).toContain("3 decisiones");
  });

  it("is blocked when there is no ReviewSession at all", () => {
    const view = deriveSingleResultView(jobFor(completed()), null);
    expect(view.state).toBe("blocked");
    expect(view.safeText).toBeNull();
    expect(view.blockedMessage).not.toBeNull();
  });

  it("is blocked when the Job ↔ review correspondence is stale with no pending decisions", () => {
    const review = completed();
    // The Job claims Safe output is not ready while the session could finalize.
    const stale = jobFor(review, { safeOutputReady: false });
    const view = deriveSingleResultView(stale, review);
    expect(view.state).toBe("blocked");
    expect(view.safeText).toBeNull();
  });

  it("stays fail-closed when the Job claims ready but the review still has pending decisions", () => {
    const review = session();
    const inconsistent = jobFor(review, { safeOutputReady: true });
    const view = deriveSingleResultView(inconsistent, review);
    expect(view.state).toBe("needs-attention");
    expect(view.safeText).toBeNull();
  });

  it("reports deliberately kept originals exactly as the ReviewSession records them", () => {
    const base = session();
    let review = applyDecision(base, base.detections[0].id, "accepted");
    review = applyDecision(review, base.detections[1].id, "restored");
    review = applyDecision(review, base.detections[2].id, "accepted");
    const view = deriveSingleResultView(jobFor(review), review);
    expect(view.state).toBe("ready");
    expect(view.keptOriginals.map((k) => k.type)).toEqual(
      getProgress(review).restoredDetections.map((d) => d.type)
    );
    // The restored original is legitimately present in the canonical payload.
    expect(view.safeText).toContain("612345678");
  });

  it("labels a document job as document material", () => {
    const review = completed();
    const documentJob = Object.freeze({
      ...withReviewState(
        createJob({
          type: "files",
          files: [
            {
              name: "informe.txt",
              extension: "txt",
              extraction: { status: "extracted", extractedText: SOURCE },
            },
          ],
        }),
        { complete: true }
      ),
      outputs: Object.freeze({ safeOutputReady: true, confidentialAuditReady: true }),
    }) as Job;
    const view = deriveSingleResultView(documentJob, review);
    expect(view.material).toBe("document");
    expect(view.state).toBe("ready");
  });
});
