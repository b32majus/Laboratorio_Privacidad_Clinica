import { describe, expect, it } from "vitest";

import { createReviewSessionFromProcessor } from "../../../js/domain/from-processor.js";
import { createRegistryEngine } from "../engine/registry-engine";
import {
  applyDecision,
  canFinalize,
  createReviewSession,
  createSessionFromEngineTextAsync,
  getDecision,
  getFinalText,
  getProgress,
  type ReviewSession,
} from "./review-domain";

/**
 * T14 #18 WU-B — the composed domain boundary for low-confidence candidates.
 *
 * The registry-composed engine reports below-threshold recognition as an
 * explicit candidate (`result.candidates`, WU-A). Through
 * `createSessionFromEngineText` those candidates must reach the ReviewSession
 * as NORMAL, fail-closed detections marked `lowConfidence: true`, adjudicable
 * with the EXISTING decision vocabulary (`accepted` = treat, `restored` =
 * decline), and they must never corrupt a source span.
 *
 * All fixtures are synthetic clinical-style text; no real content is used.
 */

/**
 * Real below-threshold fixture verified against the composed engine: exactly
 * one `NOMBRE`/`profesional` candidate, confidence 0.45, reason
 * `REVISION_MANUAL`, and zero kept entities. WU-A established these facts.
 */
const BELOW_THRESHOLD_TEXT =
  "La paciente acudió ayer. Fisioterapeuta Nélida Otxoa realizó la sesión.";

/**
 * Same candidate PLUS two kept entity detections (patient name + full date),
 * used to prove that deciding the candidate never touches another span.
 */
const ENTITY_AND_CANDIDATE_TEXT =
  "La paciente Lucía Ruiz acudió el 12/03/2024. Fisioterapeuta Nélida Otxoa realizó la sesión.";

/** Exact output when the candidate is treated and every entity is restored. */
const BELOW_THRESHOLD_CANDIDATE_TREATED =
  "La paciente acudió ayer. Profesional Sanitario 1 la sesión.";

/** Exact output when the candidate is declined (kept exactly as in source). */
const BELOW_THRESHOLD_CANDIDATE_RESTORED =
  "La paciente acudió ayer. Fisioterapeuta Nélida Otxoa realizó la sesión.";

/** Mixed fixture: entities restored, candidate treated. */
const ENTITY_CANDIDATE_TREATED =
  "La paciente Lucía Ruiz acudió el 12/03/2024. Profesional Sanitario 1 la sesión.";

function findCandidate(session: ReviewSession) {
  const candidate = session.detections.find((detection) => detection.lowConfidence === true);
  if (candidate === undefined) {
    throw new Error("the composed path did not surface a lowConfidence candidate");
  }
  return candidate;
}

describe("T14 WU-B — composed domain path carries the candidate queue", () => {
  it("surfaces the genuine below-threshold professional candidate as a pending lowConfidence detection", async () => {
    const session = await createSessionFromEngineTextAsync(BELOW_THRESHOLD_TEXT, "standard");
    const candidate = findCandidate(session);

    expect(candidate.type).toBe("NOMBRE");
    expect(candidate.subtype).toBe("profesional");
    expect(candidate.source).toBe("engine");
    expect(candidate.requiresReview).toBe(true);
    expect(candidate.reason).toBe("REVISION_MANUAL");
    expect(candidate.proposed).toBe("Profesional Sanitario 1");
    expect(candidate.confidence).toBeCloseTo(0.45, 10);
    // The candidate's [start,end) slices the source to exactly its original.
    expect(candidate.original).toBe(BELOW_THRESHOLD_TEXT.slice(candidate.start, candidate.end));
    expect(candidate.original).toBe("Fisioterapeuta Nélida Otxoa realizó");

    // Fail-closed: pending until explicitly decided, blocking finalization.
    expect(getDecision(session, candidate.id).status).toBe("pending");
    expect(canFinalize(session)).toBe(false);
    expect(() => getFinalText(session)).toThrowError();

    // Exactly one detection is marked, and it is this candidate.
    const marked = session.detections.filter((detection) => detection.lowConfidence === true);
    expect(marked).toHaveLength(1);
    expect(marked[0]?.id).toBe(candidate.id);
    expect(getProgress(session).lowConfidence).toBe(1);
  });

  it("offset-integrity oracle: every span is the source slice, restore-all is the source, treat is exact", async () => {
    const session = await createSessionFromEngineTextAsync(BELOW_THRESHOLD_TEXT, "standard");
    const candidate = findCandidate(session);

    // No detection can carry a span that disagrees with the source.
    for (const detection of session.detections) {
      expect(detection.original).toBe(BELOW_THRESHOLD_TEXT.slice(detection.start, detection.end));
    }

    // Decline: every detection restored reproduces the source EXACTLY.
    let restored = session;
    for (const detection of session.detections) {
      restored = applyDecision(restored, detection.id, "restored");
    }
    expect(canFinalize(restored)).toBe(true);
    expect(getFinalText(restored)).toBe(BELOW_THRESHOLD_CANDIDATE_RESTORED);

    // Treat: accepting the candidate inserts its proposed outcome exactly.
    const treated = applyDecision(session, candidate.id, "accepted");
    expect(getFinalText(treated)).toBe(BELOW_THRESHOLD_CANDIDATE_TREATED);
    expect(getFinalText(treated)).toBe(
      BELOW_THRESHOLD_TEXT.slice(0, candidate.start) +
        (candidate.proposed ?? "") +
        BELOW_THRESHOLD_TEXT.slice(candidate.end)
    );
  });

  it("entity detections keep their exact offsets and IDs when candidates are appended", async () => {
    const engine = createRegistryEngine();
    const outcome = engine.process({
      text: ENTITY_AND_CANDIDATE_TEXT,
      context: { mode: "fresh" },
      policyId: "standard",
    });
    const candidates = outcome.result.candidates ?? [];
    const entities = outcome.result.entities;
    expect(entities.length).toBeGreaterThan(0);
    expect(candidates.length).toBeGreaterThan(0);

    const withCandidates = createReviewSessionFromProcessor(outcome.result) as ReviewSession;
    const entityOnly = createReviewSessionFromProcessor(outcome.result, {
      includeCandidates: false,
    }) as ReviewSession;

    expect(withCandidates.sessionId).toBe(entityOnly.sessionId);
    expect(withCandidates.detections.length).toBe(entities.length + candidates.length);
    // Appending candidates neither renumbers nor shifts the entity detections.
    expect(withCandidates.detections.slice(0, entities.length).map((d) => d.id)).toEqual(
      entityOnly.detections.map((d) => d.id)
    );
    for (const [index, entity] of entities.entries()) {
      const detection = withCandidates.detections[index];
      expect(detection.start).toBe(entity.position.start);
      expect(detection.end).toBe(entity.position.end);
      expect(detection.lowConfidence).toBeUndefined();
    }
    expect(getProgress(withCandidates).lowConfidence).toBe(candidates.length);

    // Independently composed, the same text surfaces the candidate too.
    const composed = await createSessionFromEngineTextAsync(ENTITY_AND_CANDIDATE_TEXT, "standard");
    const candidate = findCandidate(composed);
    const marked = composed.detections.filter((d) => d.lowConfidence === true);
    expect(marked).toHaveLength(1);
    expect(marked[0]?.id).toBe(candidate.id);
    expect(composed.detections.length).toBe(entities.length + candidates.length);
  });

  it("adversarial oracle: stale metadata (including a candidate) cannot define a span", async () => {
    const source = "ABC DEF GHI";
    const staleDetections = [
      {
        type: "NOMBRE",
        start: 0,
        end: 3,
        original: "WRONG",
        text: "WRONG",
        proposed: "[A]",
      },
      {
        type: "NOMBRE",
        start: 4,
        end: 7,
        original: "WRONG2",
        text: "WRONG2",
        lowConfidence: true,
        proposed: "[B]",
        reason: "BAJO_SCORE",
        confidence: 0.3,
      },
    ] as unknown as Parameters<typeof createReviewSession>[0]["detections"];

    let session = createReviewSession({
      originalText: source,
      sessionId: "adversarial-candidate",
      detections: staleDetections,
    });

    // The authority uses the SOURCE slice, never the supplied metadata.
    expect(session.detections[0].original).toBe("ABC");
    expect(session.detections[1].original).toBe("DEF");
    expect(session.detections[1].lowConfidence).toBe(true);
    expect(getProgress(session).lowConfidence).toBe(1);

    session = applyDecision(session, session.detections[0].id, "restored");
    expect(getFinalText(applyDecision(session, session.detections[1].id, "restored"))).toBe(source);
    expect(getFinalText(applyDecision(session, session.detections[1].id, "accepted"))).toBe(
      "ABC [B] GHI"
    );
  });

  it("deciding the candidate leaves every other detection's span untouched", async () => {
    const session = await createSessionFromEngineTextAsync(ENTITY_AND_CANDIDATE_TEXT, "standard");
    const candidate = findCandidate(session);
    const entities = session.detections.filter((detection) => detection.lowConfidence !== true);
    expect(entities.length).toBeGreaterThan(0);
    expect(getProgress(session).lowConfidence).toBe(1);

    // Entities restored so the candidate is the only edited span.
    let restoredEntities = session;
    for (const entity of entities) {
      restoredEntities = applyDecision(restoredEntities, entity.id, "restored");
    }
    const treated = applyDecision(restoredEntities, candidate.id, "accepted");
    const declined = applyDecision(restoredEntities, candidate.id, "restored");

    expect(getFinalText(treated)).toBe(ENTITY_CANDIDATE_TREATED);
    expect(getFinalText(declined)).toBe(ENTITY_AND_CANDIDATE_TEXT);

    // Both preserve the exact source prefix and suffix around the candidate.
    const prefix = ENTITY_AND_CANDIDATE_TEXT.slice(0, candidate.start);
    const suffix = ENTITY_AND_CANDIDATE_TEXT.slice(candidate.end);
    expect(getFinalText(treated)).toBe(prefix + (candidate.proposed ?? "") + suffix);
    expect(getFinalText(declined)).toBe(prefix + candidate.original + suffix);
    expect(getFinalText(treated)).not.toBe(getFinalText(declined));
  });
});
