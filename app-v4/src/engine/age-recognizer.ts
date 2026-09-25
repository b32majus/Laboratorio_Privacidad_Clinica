/**
 * V4 age recognizer (Work Order T12 #16, WU-A).
 *
 * AGE is a first-class recognized type (SPEC_V4_PRIVACY_ENGINE.md §4/§8;
 * CURRENT_DECISIONS.md D-010). This module is the PURE recognition half of
 * that capability: {@link AgeRecognizer} answers only "what is this?" and
 * never "how should it be transformed?" (SPEC §4/§5). It therefore has no
 * policy input, no banding, no operator key and no transformed value — its
 * observations stay invariant under any policy choice by construction
 * (ACCEPTANCE 1). Banding/generalization is WU-B policy, deliberately not
 * owned here.
 *
 * Recognized shapes (deterministic, exact offsets against the immutable
 * source text):
 *
 * - explicit completed years: `\d{1,3}` followed by `años`/`anos` (singular
 *   or plural) or by the abbreviated `a.`, subtype `"anios"`;
 * - pediatric months/weeks: `\d{1,2}` + `mes(es)`/`semana(s)` — ONLY under an
 *   explicit age cue (`edad de`, `paciente de/con`, `niño/niña(s) de`,
 *   `lactante de`, `bebé(es) de`), subtype `"meses"`/`"semanas"`. Requiring
 *   the cue prevents treatment-duration false positives such as
 *   "seguimiento de 6 meses" or "tratamiento durante 3 semanas".
 *
 * Plausibility bound: only completed-year values in
 * [{@link AGE_PLAUSIBLE_MIN_YEARS}, {@link AGE_PLAUSIBLE_MAX_YEARS}] (0–129)
 * produce observations; implausible magnitudes such as "300 años" are
 * rejected. Extreme-but-real ages (for example 96, 104) are simply completed
 * years at the high end of the bound. This band is a DETECTION plausibility
 * bound only; it is not a privacy generalization band (that is WU-B policy).
 *
 * Deliberately out of scope: explicit ranges (deferred), contextual or
 * implicit ages, and any transformation semantics.
 *
 * Fail-closed (D-009): malformed/empty/oversized input raises the typed
 * {@link EngineError} instead of guessing.
 *
 * Privacy: this module never logs content, never mutates its input, and is
 * Worker-safe (no window/document access; no side effects beyond module
 * loading).
 */

import { type Recognizer, type RecognizerObservation } from "./recognizer-registry";
import { EngineError } from "./types";

/** Stable recognizer key of the V4 age recognizer. */
export const AGE_RECOGNIZER_KEY = "v4.edad";

/** Lowest completed-year value that produces an observation. */
export const AGE_PLAUSIBLE_MIN_YEARS = 0;

/**
 * Highest completed-year value that produces an observation. Values above
 * this magnitude are treated as non-age numbers (fail-closed: no observation
 * rather than a guessed age).
 */
export const AGE_PLAUSIBLE_MAX_YEARS = 129;

/** Same safety limit as the legacy core and the V4 engine adapter. */
const MAX_TEXT_LENGTH = 1_000_000;

/**
 * Explicit completed years: 1–3 digits, optional spaces/tabs, then
 * `años`/`anos` (singular or plural) or the abbreviation `a.`. The
 * `(?<!\d)` guard keeps the match from starting inside a longer digit run and
 * the `(?!\w)` guard requires a real unit/abbreviation boundary (so `a.m.`
 * or `añoso` never match).
 */
const EXPLICIT_YEARS_PATTERN = /(?<!\d)(\d{1,3})[ \t]*(años?|anos?|a\.)(?!\w)/gi;

/**
 * Pediatric months/weeks gated by an explicit age cue. The observation span
 * covers only the value plus unit; the cue itself is context, not content.
 */
const PEDIATRIC_AGE_PATTERN =
  /\b(?:edad de|paciente (?:de|con)|niñ[oa]s? de|lactante de|beb[ée]s? de)[ \t]+(\d{1,2})[ \t]+(mes(?:es)?|semanas?)\b/gi;

/** Same fail-closed text validation as the V4 engine adapter (D-009). */
function assertRecognizableText(text: unknown): asserts text is string {
  if (typeof text !== "string") {
    throw new EngineError("invalid-text", "Recognizer input text must be a string.");
  }
  if (text.trim().length === 0) {
    throw new EngineError(
      "empty-text",
      "Recognizer input text is empty; provide text before recognition."
    );
  }
  if (text.length > MAX_TEXT_LENGTH) {
    throw new EngineError(
      "input-too-large",
      "Recognizer input text exceeds the supported size; use an explicit segmentation path instead of silent truncation."
    );
  }
}

/**
 * Freezes one EDAD observation. `text`/`original` are the exact source
 * substring and confidence is 1 (deterministic explicit-unit match).
 */
function toAgeObservation(
  subtype: string,
  start: number,
  end: number,
  source: string
): RecognizerObservation {
  const value = source.slice(start, end);
  return Object.freeze({
    type: "EDAD",
    subtype,
    start,
    end,
    text: value,
    original: value,
    confidence: 1,
  });
}

/**
 * Pure, deterministic age recognizer with stable key
 * {@link AGE_RECOGNIZER_KEY}. Exposes no policy, operator or review input:
 * recognition is invariant under any transformation choice.
 */
export class AgeRecognizer implements Recognizer {
  readonly key = AGE_RECOGNIZER_KEY;

  observe(text: string): readonly RecognizerObservation[] {
    assertRecognizableText(text);
    const observations: RecognizerObservation[] = [];

    // Explicit completed years (0–129 only).
    EXPLICIT_YEARS_PATTERN.lastIndex = 0;
    let match: RegExpExecArray | null;
    while ((match = EXPLICIT_YEARS_PATTERN.exec(text)) !== null) {
      const value = Number(match[1]);
      if (value < AGE_PLAUSIBLE_MIN_YEARS || value > AGE_PLAUSIBLE_MAX_YEARS) continue;
      observations.push(
        toAgeObservation("anios", match.index, match.index + match[0].length, text)
      );
    }

    // Pediatric months/weeks, only after an explicit age cue.
    PEDIATRIC_AGE_PATTERN.lastIndex = 0;
    while ((match = PEDIATRIC_AGE_PATTERN.exec(text)) !== null) {
      const numberText = match[1];
      const unitText = match[2];
      const start = match.index + match[0].indexOf(numberText);
      const end = match.index + match[0].lastIndexOf(unitText) + unitText.length;
      const subtype = unitText.toLowerCase().startsWith("mes") ? "meses" : "semanas";
      observations.push(toAgeObservation(subtype, start, end, text));
    }

    observations.sort(
      (a, b) =>
        a.start - b.start || a.end - b.end || (a.subtype ?? "").localeCompare(b.subtype ?? "")
    );
    return Object.freeze(observations);
  }
}
