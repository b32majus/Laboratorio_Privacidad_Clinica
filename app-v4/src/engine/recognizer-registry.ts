/**
 * V4 recognizer registry contracts (Work Order T11 #15, WU1).
 *
 * This module is the PURE contracts/registry boundary of the recognizer
 * surface: it declares what a recognizer is, how observations are shaped,
 * and how registries behave. It answers only "what is this?" and never "how
 * should it be transformed?" (SPEC_V4_PRIVACY_ENGINE.md §2/§3/§4). A
 * {@link RecognizerObservation} therefore carries only identity fields
 * (type/subtype/offsets/original/confidence); no operator choice, no
 * transformed value, no review/workflow state. Transformation stays with the
 * operator/policy boundary (WU2/WU3).
 *
 * This module deliberately has NO dependency on the legacy brownfield core
 * (no js/core, no js/data). The legacy adaptation of these contracts lives
 * in `./legacy-recognizers` (CURRENT_DECISIONS D-003: wrap, do not rewrite).
 *
 * Fail-closed (D-009): unknown registry keys raise the typed
 * `unknown-recognizer` error — there is no silent default recognizer;
 * duplicate keys are never silently overwritten; malformed recognizer
 * registrations are rejected instead of guessed.
 *
 * Privacy: this module never logs content and is Worker-safe (no
 * window/document access; no side effects beyond module loading).
 */

/**
 * Normalized recognition result (SPEC §3/§4). Offsets are against the
 * immutable source text. Frozen on creation.
 */
export type RecognizerObservation = {
  readonly type: string;
  readonly subtype?: string;
  readonly start: number;
  readonly end: number;
  readonly text: string;
  readonly original?: string;
  readonly confidence: number;
};

/**
 * A recognizer answers "what is this?" for its own scope. `key` is stable
 * across runs and must be unique within a registry.
 */
export interface Recognizer {
  readonly key: string;
  observe(text: string): readonly RecognizerObservation[];
}

/** Machine-readable codes carried by {@link RecognizerError} (D-009). */
export type RecognizerErrorCode =
  | "unknown-recognizer"
  | "duplicate-recognizer"
  | "invalid-recognizer"
  | "invalid-recognizer-result";

/** Typed registry/recognition error; carries a machine-readable code. */
export class RecognizerError extends Error {
  readonly code: RecognizerErrorCode;

  constructor(code: RecognizerErrorCode, message: string) {
    super(message);
    this.name = "RecognizerError";
    this.code = code;
  }
}

/**
 * Registry of recognizers keyed by stable string keys. Registration is
 * explicit, lookup is typed, and key listing is deterministic (sorted).
 */
export class RecognizerRegistry {
  private readonly recognizers = new Map<string, Recognizer>();

  /** Registers a recognizer; duplicate keys fail closed (never overwritten). */
  register(recognizer: Recognizer): void {
    if (
      recognizer === null ||
      typeof recognizer !== "object" ||
      typeof recognizer.key !== "string" ||
      recognizer.key.length === 0 ||
      typeof recognizer.observe !== "function"
    ) {
      throw new RecognizerError(
        "invalid-recognizer",
        "A recognizer must expose a non-empty string key and an observe(text) function."
      );
    }
    if (this.recognizers.has(recognizer.key)) {
      throw new RecognizerError(
        "duplicate-recognizer",
        `A recognizer is already registered under key "${recognizer.key}"; registration is explicit and never silently overwritten.`
      );
    }
    this.recognizers.set(recognizer.key, recognizer);
  }

  /** Returns the recognizer registered under `key`; typed failure otherwise. */
  get(key: string): Recognizer {
    const recognizer = this.recognizers.get(key);
    if (recognizer === undefined) {
      throw new RecognizerError(
        "unknown-recognizer",
        `No recognizer is registered under key "${key}"; there is no silent default recognizer.`
      );
    }
    return recognizer;
  }

  /** Whether a recognizer is registered under `key`. */
  has(key: string): boolean {
    return this.recognizers.has(key);
  }

  /** Deterministic (sorted) snapshot of the registered keys. */
  keys(): readonly string[] {
    return Object.freeze([...this.recognizers.keys()].sort());
  }
}

/**
 * Legacy/ground-truth category taxonomy (scripts/privacy-eval ENTITY_TYPES;
 * SPEC §4 initial categories). NOMBRE covers the legacy subtypes
 * paciente/profesional/familiar.
 */
export const RECOGNIZER_CATEGORIES = [
  "NOMBRE",
  "IDENTIFICADOR",
  "FECHA",
  "UBICACION",
  "SOSPECHOSO",
] as const;

export type RecognizerCategory = (typeof RECOGNIZER_CATEGORIES)[number];

/** Registry key that must represent each taxonomy category. */
export const LEGACY_CATEGORY_RECOGNIZER_KEYS: Readonly<Record<RecognizerCategory, string>> =
  Object.freeze({
    NOMBRE: "legacy.nombre",
    IDENTIFICADOR: "legacy.identificador",
    FECHA: "legacy.fecha",
    UBICACION: "legacy.ubicacion",
    SOSPECHOSO: "legacy.sospechoso",
  });

/**
 * Coverage oracle primitive: returns the taxonomy categories NOT represented
 * in the registry (no recognizer registered under the category's expected
 * key). Deterministic; used by the positive coverage test and by the
 * planted-omission self-test that proves the check can disagree.
 */
export function findUncoveredRecognizerCategories(
  registry: RecognizerRegistry,
  required: Readonly<Record<RecognizerCategory, string>> = LEGACY_CATEGORY_RECOGNIZER_KEYS
): RecognizerCategory[] {
  const missing: RecognizerCategory[] = [];
  for (const category of RECOGNIZER_CATEGORIES) {
    const key = required[category];
    if (typeof key !== "string" || !registry.has(key)) {
      missing.push(category);
    }
  }
  return missing;
}
