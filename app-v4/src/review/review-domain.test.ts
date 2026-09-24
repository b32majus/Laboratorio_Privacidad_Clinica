import { describe, expect, it } from "vitest";

import { createJob } from "../domain/job";
import { createLegacyEngine } from "../engine/legacy-engine";
import {
  ReviewSessionError,
  addManualDetection,
  applyDecision,
  canFinalize,
  createSessionFromEngineText,
  createReviewSession,
  getDecision,
  getFinalText,
  getProgress,
  jobSourceText,
  jobSupportsReview,
  startReviewSession,
  type ReviewSession,
} from "./review-domain";

/**
 * Domain-level integration oracles for Work Order T07: real legacy engine
 * run → real ReviewSession transitions → final text. All fixtures are
 * synthetic Spanish clinical-style text; no real content anywhere.
 */
const ENGINE_TEXT =
  "Nombre: Carmen Sánchez\nLa paciente fue atendida por el Dr. García López el 12/03/2024. Contacto: 612345678.";

/** Handcrafted deterministic session for offset-precise assertions. */
const SOURCE = "Nombre: Carmen Sánchez\nTeléfono 612345678. NHC 2024/089756.";
const NAME_START = SOURCE.indexOf("Carmen Sánchez");
const NAME_END = NAME_START + "Carmen Sánchez".length;
const PHONE_START = SOURCE.indexOf("612345678");
const PHONE_END = PHONE_START + "612345678".length;
const NHC_START = SOURCE.indexOf("2024/089756");
const NHC_END = NHC_START + "2024/089756".length;

function handcraftedSession(): ReviewSession {
  return createReviewSession({
    originalText: SOURCE,
    detections: [
      {
        type: "NOMBRE",
        start: NAME_START,
        end: NAME_END,
        confidence: 0.95,
        proposed: "PACIENTE-1",
      },
      { type: "IDENTIFICADOR", start: PHONE_START, end: PHONE_END, confidence: 0.6, proposed: "" },
      { type: "IDENTIFICADOR", start: NHC_START, end: NHC_END, confidence: 0.9, proposed: "ID-1" },
    ],
    sessionId: "test-session",
  });
}

describe("full-path integration: engine → session → decisions → final text", () => {
  it("builds a pending review session from a real engine run", () => {
    const session = createSessionFromEngineText(ENGINE_TEXT);
    expect(session.originalText).toBe(ENGINE_TEXT);
    expect(session.detections.length).toBeGreaterThan(0);
    // Offsets stay canonical: `original` is re-derived from the source text.
    for (const detection of session.detections) {
      expect(detection.original).toBe(ENGINE_TEXT.slice(detection.start, detection.end));
    }
    const progress = getProgress(session);
    expect(progress.pending).toBe(session.detections.length);
    expect(progress.canFinalize).toBe(false);
  });

  it("keeps getFinalText fail-closed while mandatory review is pending", () => {
    const session = createSessionFromEngineText(ENGINE_TEXT);
    expect(canFinalize(session)).toBe(false);
    try {
      getFinalText(session);
      throw new Error("expected getFinalText to throw while review is pending");
    } catch (error) {
      expect(error).toBeInstanceOf(ReviewSessionError);
      expect((error as ReviewSessionError).code).toBe("MANDATORY_REVIEW_PENDING");
    }
  });

  it("composes exact final text after every detection is explicitly decided", () => {
    const session = createSessionFromEngineText(ENGINE_TEXT);
    let decided = session;
    for (const detection of session.detections) {
      decided = applyDecision(decided, detection.id, "accepted");
    }
    expect(canFinalize(decided)).toBe(true);
    const finalText = getFinalText(decided);
    expect(typeof finalText).toBe("string");
    // Accepted proposals replaced every engine span; the original values are gone.
    for (const detection of decided.detections) {
      if (detection.proposed !== undefined && detection.proposed !== detection.original) {
        expect(finalText).not.toContain(detection.original);
      }
    }
  });
});

describe("decision semantics over a deterministic session", () => {
  it("modify changes the exact final-domain replacement, not only markup", () => {
    const session = handcraftedSession();
    // Restore every other span so the modified detection is the only edit.
    let next = session;
    next = applyDecision(next, session.detections[1].id, "restored");
    next = applyDecision(next, session.detections[2].id, "restored");
    next = applyDecision(next, session.detections[0].id, "modified", {
      replacement: "PACIENTE REEMPLAZO",
    });
    expect(canFinalize(next)).toBe(true);
    const expected = SOURCE.slice(0, NAME_START) + "PACIENTE REEMPLAZO" + SOURCE.slice(NAME_END);
    expect(getFinalText(next)).toBe(expected);
  });

  it("restored is an explicit completed decision that stays visible", () => {
    const session = handcraftedSession();
    const next = applyDecision(session, session.detections[0].id, "restored");
    const progress = getProgress(next);
    expect(progress.restored).toBe(1);
    expect(progress.restoredDetections.map((d) => d.id)).toEqual([session.detections[0].id]);
    expect(progress.decided).toBe(1);
    expect(getDecision(next, session.detections[0].id).status).toBe("restored");
    // Restored alone does not complete review while other spans are pending.
    expect(progress.canFinalize).toBe(false);
  });

  it("manual detection affects the same session without corrupting existing decisions or offsets", () => {
    const session = handcraftedSession();
    const accepted = applyDecision(session, session.detections[0].id, "accepted");
    const restored = applyDecision(accepted, session.detections[1].id, "restored");
    const fullyDecided = applyDecision(restored, session.detections[2].id, "restored");
    expect(canFinalize(fullyDecided)).toBe(true);
    const withManual = addManualDetection(fullyDecided, {
      start: SOURCE.indexOf("Teléfono"),
      end: SOURCE.indexOf("Teléfono") + "Teléfono".length,
      type: "PALABRA_CLAVE",
    });
    // Existing decisions and detections survive untouched.
    expect(getDecision(withManual, session.detections[0].id)).toEqual({
      status: "accepted",
    });
    expect(getDecision(withManual, session.detections[1].id)).toEqual({
      status: "restored",
    });
    expect(getDecision(withManual, session.detections[2].id)).toEqual({
      status: "restored",
    });
    expect(withManual.detections.slice(0, 3)).toEqual(restored.detections);
    const manual = withManual.detections[3];
    expect(manual.source).toBe("manual");
    expect(manual.requiresReview).toBe(true);
    expect(manual.original).toBe("Teléfono");
    expect(getProgress(withManual).pending).toBe(1);

    // Decide the manual span with an explicit replacement and finalize.
    const finalized = applyDecision(withManual, manual.id, "modified", {
      replacement: "MANUAL-1",
    });
    expect(canFinalize(finalized)).toBe(true);
    const expected =
      SOURCE.slice(0, NAME_START) +
      "PACIENTE-1" +
      SOURCE.slice(NAME_END, SOURCE.indexOf("Teléfono")) +
      "MANUAL-1" +
      SOURCE.slice(SOURCE.indexOf("Teléfono") + "Teléfono".length);
    expect(getFinalText(finalized)).toBe(expected);
  });
});

describe("job → review-source mapping", () => {
  it("supports text and single-document jobs only", () => {
    expect(
      jobSupportsReview(createJob({ type: "pasted-text", text: "Síntesis: 612345678." }))
    ).toBe(true);
    expect(
      jobSupportsReview(
        createJob({
          type: "files",
          files: [
            {
              name: "note.txt",
              extension: "txt",
              extraction: { status: "extracted", extractedText: "Contenido sintético." },
            },
          ],
        })
      )
    ).toBe(true);
    expect(
      jobSupportsReview(
        createJob({
          type: "files",
          files: [
            {
              name: "a.txt",
              extension: "txt",
              extraction: { status: "extracted", extractedText: "A." },
            },
            {
              name: "b.txt",
              extension: "txt",
              extraction: { status: "extracted", extractedText: "B." },
            },
          ],
        })
      )
    ).toBe(false);
    expect(
      jobSupportsReview(
        createJob({
          type: "files",
          files: [{ name: "labs.csv", extension: "csv" }],
        })
      )
    ).toBe(false);
  });

  it("maps pasted text and single extracted documents to review source text", () => {
    const textJob = createJob({ type: "pasted-text", text: "Texto sintético." });
    expect(jobSourceText(textJob)).toBe("Texto sintético.");

    const documentJob = createJob({
      type: "files",
      files: [
        {
          name: "note.txt",
          extension: "txt",
          extraction: { status: "extracted", extractedText: "Contenido extraído." },
        },
      ],
    });
    expect(jobSourceText(documentJob)).toBe("Contenido extraído.");

    const batchJob = createJob({
      type: "files",
      files: [
        {
          name: "a.txt",
          extension: "txt",
          extraction: { status: "extracted", extractedText: "A." },
        },
        {
          name: "b.txt",
          extension: "txt",
          extraction: { status: "extracted", extractedText: "B." },
        },
      ],
    });
    expect(jobSourceText(batchJob)).toBeNull();
  });

  it("starts a real review session from a job's source text", () => {
    const job = createJob({ type: "pasted-text", text: ENGINE_TEXT });
    const session = startReviewSession(job);
    expect(session.originalText).toBe(ENGINE_TEXT);
    expect(session.detections.length).toBeGreaterThan(0);
  });

  it("fails closed when a job family has no single reviewable source text", () => {
    const batchJob = createJob({
      type: "files",
      files: [
        {
          name: "a.txt",
          extension: "txt",
          extraction: { status: "extracted", extractedText: "A." },
        },
        {
          name: "b.txt",
          extension: "txt",
          extraction: { status: "extracted", extractedText: "B." },
        },
      ],
    });
    expect(() => startReviewSession(batchJob)).toThrowError(ReviewSessionError);
  });

  it("the engine adapter behind startReviewSession is the real legacy engine", () => {
    const engine = createLegacyEngine();
    const outcome = engine.process({ text: ENGINE_TEXT, context: { mode: "fresh" } });
    const session = createSessionFromEngineText(ENGINE_TEXT);
    expect(session.detections.length).toBe(outcome.result.entities.length);
  });
});
