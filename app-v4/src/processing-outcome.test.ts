import { describe, expect, it } from "vitest";

import { JobModelError } from "./domain/job";
import {
  MAX_SUPPORTED_TEXT_LENGTH,
  OVERSIZE_INPUT_CODE,
  oversizeInputFor,
} from "./engine/input-limits";
import { PolicyError } from "./engine/policy";
import { EngineError } from "./engine/types";
import { assertValidText } from "./engine/legacy-engine";
import { ReviewSessionError } from "./review/review-domain";
import { PROCESSING_UNKNOWN_MESSAGE, classifyProcessingFailure } from "./processing-outcome";

/**
 * Oracles for the typed processing-failure classification (T15 #19).
 *
 * The load-bearing test is the payload-safety one WITH TEETH: an unrecognized
 * error carrying planted synthetic content must collapse to the fixed
 * value-free message. That oracle fails if the implementation ever forwards
 * raw unrecognized error text into the Job diagnostic. All planted tokens are
 * synthetic; no real content anywhere.
 */
describe("classifyProcessingFailure (T15 #19)", () => {
  it("maps an oversize EngineError to input-too-large with the shared actionable message", () => {
    const text = "h".repeat(MAX_SUPPORTED_TEXT_LENGTH + 1);
    const oversize = oversizeInputFor(text);
    expect(oversize).not.toBeNull();

    // Use the REAL production guard instead of hand-constructing the error.
    let thrown: unknown;
    try {
      assertValidText(text);
    } catch (error) {
      thrown = error;
    }
    expect(thrown).toBeInstanceOf(EngineError);
    expect((thrown as EngineError).code).toBe(OVERSIZE_INPUT_CODE);

    const failure = classifyProcessingFailure(thrown);
    expect(failure.code).toBe("input-too-large");
    expect(failure.message).toBe(oversize!.message);
    expect(failure.message).toBe((thrown as EngineError).message);
  });

  it("maps any other EngineError to processing-failed with its own message", () => {
    const error = new EngineError("invalid-text", "Engine input text must be a string.");
    const failure = classifyProcessingFailure(error);
    expect(failure.code).toBe("processing-failed");
    expect(failure.message).toBe(error.message);
  });

  it("maps ReviewSessionError to invalid-source with its own message", () => {
    const error = new ReviewSessionError(
      "INVALID_SOURCE",
      'Job "Synthetic batch" has no single reviewable source text.'
    );
    const failure = classifyProcessingFailure(error);
    expect(failure.code).toBe("invalid-source");
    expect(failure.message).toBe(error.message);
  });

  it("maps PolicyError to policy-unsupported with its own message", () => {
    const error = new PolicyError(
      "policy-operator-mapping-unavailable",
      'Privacy policy "external-ai" has no accepted mapping.'
    );
    const failure = classifyProcessingFailure(error);
    expect(failure.code).toBe("policy-unsupported");
    expect(failure.message).toBe(error.message);
  });

  it("maps JobModelError to processing-failed with its own message", () => {
    const error = new JobModelError("invalid-step", "Cannot advance from step.");
    const failure = classifyProcessingFailure(error);
    expect(failure.code).toBe("processing-failed");
    expect(failure.message).toBe(error.message);
  });

  it("does NOT forward raw unrecognized error text into the diagnostic (payload safety)", () => {
    // This oracle FAILS if the implementation forwards raw unrecognized error
    // text: the planted tokens below must never reach the returned failure.
    const planted = ["Paciente sintetico", "600000000", "Carmen"];
    const error = new TypeError("failed while reading Paciente sintetico 600000000");
    const failure = classifyProcessingFailure(error);

    expect(failure.code).toBe("processing-unknown");
    expect(failure.message).toBe(PROCESSING_UNKNOWN_MESSAGE);
    for (const token of planted) {
      expect(failure.message).not.toContain(token);
    }
    // The fixed message names the situation and an action, with no value.
    expect(failure.message).toMatch(/retry/i);
    expect(failure.message).toMatch(/split the input/i);
  });

  it("collapses non-Error throws to the same fixed unknown-outcome message", () => {
    for (const thrown of ["raw string", null, undefined, 42, { code: "nope" }]) {
      const failure = classifyProcessingFailure(thrown);
      expect(failure.code).toBe("processing-unknown");
      expect(failure.message).toBe(PROCESSING_UNKNOWN_MESSAGE);
    }
  });
});
