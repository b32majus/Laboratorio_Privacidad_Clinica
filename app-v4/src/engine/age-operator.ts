/**
 * V4 age generalization operator (Work Order T12 #16, WU-B).
 *
 * This module owns the accepted T12 AGE transformation policy
 * (SPEC_V4_PRIVACY_ENGINE.md §5/§6/§8; CURRENT_DECISIONS.md D-007/D-009/
 * D-010): {@link AgeGeneralizeOperator} answers "what transformation
 * applies?" for a first-class `EDAD` observation recognized by WU-A, and
 * nothing else. Recognition stays in `./age-recognizer`; this module never
 * inspects or parses source text beyond the observation it is handed.
 *
 * Accepted mapping (live GitHub #16 accepted T12 AGE policy — implemented
 * exactly):
 *
 * - completed years `< 90` collapse to their containing decade
 *   (`"45 años"` → `"40–49 años"`, en dash); decades `0–9 … 80–89`;
 * - completed years `>= 90` collapse to the top code `"90+ años"`;
 * - pediatric `meses`/`semanas` collapse to `"<1 año"`;
 * - `standard` and `strict` share this identical mapping: `strictMode` is
 *   validated but does NOT change AGE banding;
 * - `external-ai` and `longitudinal-research` intentionally have NO AGE
 *   mapping (they fail typed in `./policy`); this operator is never cloned
 *   onto them.
 *
 * The bands are DATA/CONFIG, not branch spaghetti: {@link AGE_DECADE_BANDS},
 * {@link AGE_TOP_CODE}, {@link AGE_TOP_MIN_YEARS} and
 * {@link AGE_PEDIATRIC_LABEL} are exported, frozen and replaceable by a
 * later policy without touching recognition (module contract: AGE banding is
 * implementation policy, not a universal privacy or regulatory claim — no
 * statistical-privacy guarantee is expressed or implied by these bands).
 *
 * Fail-closed (D-009): a non-`EDAD` observation, an unsupported subtype and
 * unparseable/invalid year text all raise the typed {@link AgeOperatorError}
 * with a machine-readable code. The operator NEVER returns the original age,
 * KEEP, or a guessed value — its output is always one of the accepted
 * general labels.
 *
 * Privacy: the operator returns ONLY the banded label; the exact detected
 * source value stays in the observation/review state. This module never logs
 * content, never mutates its input and is Worker-safe (no window/document
 * access anywhere in its module graph).
 */

import {
  assertObservation,
  assertOperatorContext,
  type Operator,
  type OperatorContext,
} from "./operator-registry";
import { type RecognizerObservation } from "./recognizer-registry";

/** Stable operator registry key of the V4 age generalization operator. */
export const AGE_GENERALIZE_OPERATOR_KEY = "v4.age-generalize";

/** Subtype of an explicit completed-year observation (WU-A). */
export const AGE_YEAR_SUBTYPE = "anios";

/** Subtypes of pediatric month/week observations (WU-A). */
export const AGE_PEDIATRIC_SUBTYPES: readonly string[] = Object.freeze(["meses", "semanas"]);

/** One frozen generalization band (inclusive `min`/`max` completed years). */
export type AgeBand = {
  readonly min: number;
  readonly max: number;
  readonly label: string;
};

/**
 * Frozen containing-decade bands for completed years `0–89`. Data-owned, so
 * a later accepted policy can replace the banding without editing the
 * operator or the recognizer (banding is policy, recognition is not).
 */
export const AGE_DECADE_BANDS: readonly AgeBand[] = Object.freeze(
  [
    { min: 0, max: 9, label: "0–9 años" },
    { min: 10, max: 19, label: "10–19 años" },
    { min: 20, max: 29, label: "20–29 años" },
    { min: 30, max: 39, label: "30–39 años" },
    { min: 40, max: 49, label: "40–49 años" },
    { min: 50, max: 59, label: "50–59 años" },
    { min: 60, max: 69, label: "60–69 años" },
    { min: 70, max: 79, label: "70–79 años" },
    { min: 80, max: 89, label: "80–89 años" },
  ].map((band) => Object.freeze(band))
);

/** Label for completed years at or above {@link AGE_TOP_MIN_YEARS}. */
export const AGE_TOP_CODE = "90+ años";

/** Lowest completed-year value that maps to {@link AGE_TOP_CODE}. */
export const AGE_TOP_MIN_YEARS = 90;

/** Label for pediatric month/week observations (always under one year). */
export const AGE_PEDIATRIC_LABEL = "<1 año";

/** Machine-readable codes carried by {@link AgeOperatorError} (D-009). */
export type AgeOperatorErrorCode =
  "not-age-observation" | "unsupported-age-subtype" | "invalid-age-observation";

/** Typed age-operator failure; carries a machine-readable code. */
export class AgeOperatorError extends Error {
  readonly code: AgeOperatorErrorCode;

  constructor(code: AgeOperatorErrorCode, message: string) {
    super(message);
    this.name = "AgeOperatorError";
    this.code = code;
  }
}

/**
 * Explicit completed-year shape, mirroring the WU-A recognition pattern so
 * only a real `<n> años` / `<n> a.` value is parsed. Anything else (bare
 * numbers, prose such as "varios años", empty text) fails closed.
 */
const COMPLETED_YEARS_PATTERN = /^(\d{1,3})[ \t]*(?:años?|anos?|a\.)$/i;

/** Parses the completed-year integer, failing typed on any other content. */
function parseCompletedYears(text: string): number {
  const match = COMPLETED_YEARS_PATTERN.exec(text.trim());
  if (match === null) {
    throw new AgeOperatorError(
      "invalid-age-observation",
      "EDAD observation text is not an explicit completed-year value; failing closed instead of guessing an age or leaking the original."
    );
  }
  const years = Number(match[1]);
  if (!Number.isInteger(years) || years < 0) {
    throw new AgeOperatorError(
      "invalid-age-observation",
      "EDAD observation text did not resolve to a valid non-negative integer age; failing closed instead of guessing."
    );
  }
  return years;
}

/** Resolves a completed-year count to its configured general label. */
function labelForCompletedYears(years: number): string {
  if (years >= AGE_TOP_MIN_YEARS) return AGE_TOP_CODE;
  for (const band of AGE_DECADE_BANDS) {
    if (years >= band.min && years <= band.max) return band.label;
  }
  throw new AgeOperatorError(
    "invalid-age-observation",
    "Completed-year value falls outside the configured age bands; failing closed instead of leaking or guessing a label."
  );
}

/**
 * AGE-GENERALIZE — the accepted T12 AGE transformation. `apply` returns ONLY
 * the banded general label for an `EDAD` observation:
 *
 * - subtype {@link AGE_YEAR_SUBTYPE}: parsed completed years → containing
 *   decade, or {@link AGE_TOP_CODE} at/above {@link AGE_TOP_MIN_YEARS};
 * - subtype in {@link AGE_PEDIATRIC_SUBTYPES}: {@link AGE_PEDIATRIC_LABEL}.
 *
 * `strictMode` is validated but deliberately NOT consulted: `standard` and
 * `strict` share the identical AGE-generalization mapping (accepted T12
 * policy), so a stricter profile does not invent a second banding scheme.
 */
export class AgeGeneralizeOperator implements Operator {
  readonly key = AGE_GENERALIZE_OPERATOR_KEY;

  apply(observation: RecognizerObservation, context: OperatorContext): string {
    assertObservation(observation);
    assertOperatorContext(context);
    // `context.strictMode` is intentionally not consulted: standard and
    // strict share the same AGE banding (see class JSDoc and the tests).

    if (observation.type !== "EDAD") {
      throw new AgeOperatorError(
        "not-age-observation",
        `AgeGeneralizeOperator does not cover observation type "${observation.type}"; failing closed instead of transforming a non-age observation.`
      );
    }

    if (observation.subtype === AGE_YEAR_SUBTYPE) {
      return labelForCompletedYears(parseCompletedYears(observation.text));
    }
    if (observation.subtype !== undefined && AGE_PEDIATRIC_SUBTYPES.includes(observation.subtype)) {
      return AGE_PEDIATRIC_LABEL;
    }
    throw new AgeOperatorError(
      "unsupported-age-subtype",
      `EDAD observation carries unsupported subtype "${String(
        observation.subtype
      )}"; failing closed instead of guessing a general label.`
    );
  }
}
