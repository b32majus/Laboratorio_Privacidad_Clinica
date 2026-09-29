/**
 * V4 date-role classification (Work Order T13 #17, WU-A).
 *
 * SPEC_V4_PRIVACY_ENGINE.md §9 and CURRENT_DECISIONS.md D-010 state that
 * every detected date must not be silently collapsed into an ordered
 * "Visit N". Birth date, visit, admission/discharge and future appointment
 * may carry different semantics. This module is the pure *semantic* half of
 * that capability: {@link classifyDateRole} answers only "which explicit
 * role does the surrounding context claim for this date?" and never "how
 * should it be transformed?" (SPEC §4/§5). It has no policy input, no
 * operator key, no transformed value and no chronological ordering, so its
 * result is invariant under any policy choice by construction.
 *
 * Classification is driven ONLY by explicit Spanish cues found in
 * `contextText`:
 *
 * - `birth`: `nacimiento`, `nacido`;
 * - `admission`: `ingreso`, `ingresado`, `ingresada`, `hospitalizado`,
 *   `hospitalizada`;
 * - `discharge`: date-adjacent multi-word forms only — `alta médica`,
 *   `alta hospitalaria`, `el alta`, `alta el`. Bare `alta` is deliberately
 *   NOT a discharge cue, so `talla alta` / `alta tensión 130/85` stay
 *   `unknown`;
 * - `future-appointment`: `próxima cita`, `proxima cita`, `cita previa`,
 *   `próxima consulta`.
 *
 * A text with none of those explicit non-visit cues returns
 * `"unknown"` — the classifier NEVER guesses "visit" (D-009 fail-closed:
 * ambiguity is surfaced, not resolved by default). Downstream policy (a
 * later work unit) decides what `unknown`/visit semantics mean; this module
 * only records the absence of an explicit non-visit claim.
 *
 * Determinism: matching is case-insensitive and accent-tolerant via a fixed
 * NFD normalization; the cue table is frozen. When one context contains
 * several distinct role cues, a fixed, position-independent precedence
 * resolves them (see {@link DATE_ROLE_CUES}): a more specific multi-word or
 * date-adjacent cue wins over a generic single-word mention. This makes the
 * outcome a pure function of the normalized text.
 *
 * Privacy: this module never logs content, never mutates its input and is
 * Worker-safe (no window/document access anywhere in its module graph).
 */

import { EngineError } from "./types";

/** Explicit non-visit role a date's context claims for it. */
export type DateRole = "birth" | "admission" | "discharge" | "future-appointment" | "unknown";

/**
 * Fixed cue precedence (position-independent, deterministic). A text that
 * matches several cues resolves to the FIRST role in this array:
 *
 * 1. `future-appointment` — multi-word, highly specific;
 * 2. `discharge` — multi-word, date-adjacent (`alta el`) or explicitly
 *    qualified (`alta médica`/`alta hospitalaria`);
 * 3. `birth` — explicit birth-event token;
 * 4. `admission` — generic admission mention.
 *
 * The patterns are matched against accent-stripped, lower-cased text and are
 * deliberately non-global so `.test` stays stateless.
 */
export const DATE_ROLE_CUES: readonly { readonly role: DateRole; readonly pattern: RegExp }[] =
  Object.freeze([
    {
      role: "future-appointment",
      pattern: /\b(?:proxima cita|proxima consulta|cita previa)\b/,
    },
    {
      role: "discharge",
      pattern: /\b(?:alta medica|alta hospitalaria|el alta|alta el)\b/,
    },
    {
      role: "birth",
      pattern: /\b(?:nacimiento|nacido)\b/,
    },
    {
      role: "admission",
      pattern: /\b(?:ingreso|ingresado|ingresada|hospitalizado|hospitalizada)\b/,
    },
  ]);

/** Lower-cases and strips diacritics so cue matching is deterministic. */
function normalizeContextText(contextText: string): string {
  return contextText
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

/**
 * Classifies the explicit date role claimed by `contextText`, or
 * `"unknown"` when no explicit non-visit cue is present.
 *
 * Fail-closed (D-009): a non-string argument raises the typed
 * {@link EngineError} instead of silently classifying.
 */
export function classifyDateRole(contextText: string): DateRole {
  if (typeof contextText !== "string") {
    throw new EngineError(
      "invalid-text",
      "classifyDateRole requires a string context; failing closed instead of guessing a date role."
    );
  }

  const normalized = normalizeContextText(contextText);
  for (const cue of DATE_ROLE_CUES) {
    if (cue.pattern.test(normalized)) return cue.role;
  }
  return "unknown";
}
