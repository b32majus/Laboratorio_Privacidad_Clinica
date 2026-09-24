import { describe, expect, it } from "vitest";

import {
  ReviewSessionError,
  applyDecision,
  createReviewSession,
  getFinalText,
  getProgress,
  type ReviewSession,
} from "../review/review-domain";
import {
  SafeOutputError,
  buildSafeOutput,
  isSafeOutput,
  serializeSafeOutput,
  type SafeOutput,
} from "./safe-output";

/**
 * Fail-closed adversarial oracle for Work Order T08 U1 (Safe Output
 * service). All fixtures are synthetic Spanish clinical-style text; no
 * real content anywhere.
 *
 * The structural invariant is proven structurally (own enumerable key set
 * + value-shape assertions), NOT by forbidden-word scans: a planted
 * audit-data violation must fail the same assertion the real output must
 * pass, so this oracle can genuinely disagree with the implementation.
 */

const SOURCE = "Nombre: Carmen Sánchez\nTeléfono 612345678. NHC 2024/089756.";
const NAME_START = SOURCE.indexOf("Carmen Sánchez");
const NAME_END = NAME_START + "Carmen Sánchez".length;
const PHONE_START = SOURCE.indexOf("612345678");
const PHONE_END = PHONE_START + "612345678".length;
const NHC_START = SOURCE.indexOf("2024/089756");
const NHC_END = NHC_START + "2024/089756".length;

/**
 * Session whose detections carry adversarial reviewer-note metadata and
 * whose requiresReview flags are explicitly set (mandatory decisions).
 */
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
        proposed: "",
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
    sessionId: "safe-output-test-session",
  });
}

/** Fully decided session mixing accepted and modified decisions (with notes). */
function completedSession(): ReviewSession {
  const session = adversarialSession();
  let next = applyDecision(session, session.detections[0].id, "accepted");
  next = applyDecision(next, session.detections[1].id, "modified", {
    replacement: "TEL-REEMPLAZO",
    note: "sin código de país en la fuente",
  });
  next = applyDecision(next, session.detections[2].id, "accepted");
  return next;
}

/** Structural assertion the real output must pass and planted leaks must fail. */
function assertStructuralSafeOutput(value: unknown): void {
  const failures: string[] = [];
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new Error("structural violation: Safe Output must be a plain object");
  }
  const keys = Object.keys(value).sort();
  const allowed = ["kind", "text"];
  if (keys.length !== allowed.length || keys.some((k, i) => k !== allowed[i])) {
    failures.push(
      `own enumerable keys must be exactly ${JSON.stringify(allowed)}, got ${JSON.stringify(keys)}`
    );
  }
  for (const [key, v] of Object.entries(value as Record<string, unknown>)) {
    if (Array.isArray(v)) {
      failures.push(`value at "${key}" is array-shaped (possible mapping table)`);
    } else if (typeof v === "object" && v !== null) {
      failures.push(`value at "${key}" is object-shaped (possible metadata container)`);
    } else if (typeof v !== "string") {
      failures.push(`value at "${key}" must be a string, got ${typeof v}`);
    }
  }
  if (failures.length > 0) {
    throw new Error(`structural violation: ${failures.join("; ")}`);
  }
}

describe("fail-closed gate while mandatory review is pending", () => {
  it("throws the authority's typed error with code MANDATORY_REVIEW_PENDING", () => {
    const session = adversarialSession(); // nothing decided yet
    expect(getProgress(session).canFinalize).toBe(false);
    try {
      buildSafeOutput(session);
      throw new Error("expected buildSafeOutput to throw while review is pending");
    } catch (error) {
      expect(error).toBeInstanceOf(ReviewSessionError);
      expect((error as ReviewSessionError).code).toBe("MANDATORY_REVIEW_PENDING");
    }
  });

  it("stays blocked with exactly one pending detection remaining", () => {
    const session = adversarialSession();
    const oneLeft = applyDecision(
      applyDecision(session, session.detections[0].id, "accepted"),
      session.detections[1].id,
      "accepted"
    );
    expect(getProgress(oneLeft).pending).toBe(1);
    expect(() => buildSafeOutput(oneLeft)).toThrowError(ReviewSessionError);
  });
});

describe("completed session: exact canonical final text", () => {
  it("output.text is byte-equal to the session's canonical final text", () => {
    const session = completedSession();
    const output = buildSafeOutput(session);
    expect(output.text).toBe(getFinalText(session));
    // Transformed spans no longer carry their original values.
    expect(output.text).not.toContain("Carmen Sánchez");
    expect(output.text).not.toContain("2024/089756");
  });

  it("returns a frozen plain object with the minimal shape", () => {
    const output = buildSafeOutput(completedSession());
    expect(Object.isFrozen(output)).toBe(true);
    assertStructuralSafeOutput(output);
    expect(output.kind).toBe("safe-output");
  });
});

describe("restored / keep-original decisions are honored", () => {
  it("keeps the exact restored span while other spans stay transformed", () => {
    const session = adversarialSession();
    // Restore the name span; transform the other two.
    let next = applyDecision(session, session.detections[0].id, "restored");
    next = applyDecision(next, session.detections[1].id, "modified", {
      replacement: "TEL-REEMPLAZO",
    });
    next = applyDecision(next, session.detections[2].id, "accepted");
    expect(getProgress(next).restored).toBe(1);

    const output = buildSafeOutput(next);
    expect(output.text).toBe(getFinalText(next));
    // The explicitly restored original span remains, byte-exact, in place.
    expect(output.text.slice(NAME_START, NAME_END)).toBe("Carmen Sánchez");
    expect(output.text.startsWith("Nombre: Carmen Sánchez\n")).toBe(true);
    // Everything else is still transformed.
    expect(output.text).not.toContain("612345678");
    expect(output.text).toContain("TEL-REEMPLAZO");
  });
});

describe("structural invariant: no audit data can reach the Safe Output", () => {
  it("adversarial notes/metadata never appear in the output's own shape", () => {
    // Completed session whose detections AND decisions carry reviewer notes.
    const session = completedSession();
    const output = buildSafeOutput(session);

    // Own enumerable shape is exactly the allowed key set.
    expect(new Set(Object.keys(output))).toEqual(new Set(["kind", "text"]));
    // No value is array- or object-shaped: no mapping tables, no metadata.
    for (const value of Object.values(output)) {
      expect(Array.isArray(value)).toBe(false);
      expect(typeof value === "object" && value !== null).toBe(false);
    }
    // And the shared structural assertion passes on the real output.
    assertStructuralSafeOutput(output);
  });

  it("the oracle can disagree: a planted audit-data fixture fails the same assertion", () => {
    const session = completedSession();
    const finalText = getFinalText(session);
    // Deliberately broken fixture: audit data mapped into the output object.
    const broken = {
      kind: "safe-output",
      text: finalText,
      originalText: SOURCE,
      mappings: [{ original: "Carmen Sánchez", replacement: "PACIENTE-1" }],
      reviewerNotes: ["nota interna de revisión: verificar apellidos"],
      detectionCount: 3,
    };
    expect(() => assertStructuralSafeOutput(broken)).toThrowError(/structural violation/);
    // The broken shape is also rejected by the structural guard.
    expect(isSafeOutput(broken)).toBe(false);
  });
});

describe("deterministic TXT serialization", () => {
  it("is deterministic and byte-exact with the final text", () => {
    const output = buildSafeOutput(completedSession());
    const first = serializeSafeOutput(output);
    const second = serializeSafeOutput(output);
    expect(first).toBe(second);
    expect(first).toBe(output.text);
    expect(first).toContain("PACIENTE-1");
    expect(first).not.toContain(SOURCE);
  });

  it("fails closed on values that are not structurally valid Safe Output", () => {
    const session = completedSession();
    const output = buildSafeOutput(session);
    const broken = { ...output, mappings: [{ original: "x", replacement: "y" }] };
    expect(() => serializeSafeOutput(broken as unknown as SafeOutput)).toThrowError(
      SafeOutputError
    );
    expect(() => serializeSafeOutput(undefined as unknown as SafeOutput)).toThrowError(
      SafeOutputError
    );
  });
});

describe("isSafeOutput structural guard", () => {
  it("accepts a real output and rejects non-output shapes", () => {
    const output = buildSafeOutput(completedSession());
    expect(isSafeOutput(output)).toBe(true);
    expect(isSafeOutput({ kind: "safe-output" })).toBe(false);
    expect(isSafeOutput({ kind: "safe-output", text: 42 })).toBe(false);
    expect(isSafeOutput({ kind: "confidential-audit", text: "t" })).toBe(false);
    expect(isSafeOutput(null)).toBe(false);
    expect(isSafeOutput(["safe-output"])).toBe(false);
    expect(isSafeOutput("safe-output")).toBe(false);
  });
});
