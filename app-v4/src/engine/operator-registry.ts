/**
 * V4 operator registry contracts (Work Order T11 #15, WU2a).
 *
 * This module is the PURE contracts/registry boundary of the operator
 * surface: it declares what an operator is, how the explicit transformation
 * context is shaped, and how registries behave. Operators answer "what
 * transformation applies?" (SPEC_V4_PRIVACY_ENGINE.md §5); recognizers
 * already answered "what is this?" in WU1 and their observations carry no
 * transformation decision. Transformation logic is NOT hard-coded into
 * recognizers — it lives behind this contract, dispatchable by the composed
 * engine (WU3) once policy lookup (a separate follow-up unit) maps
 * context/entity to an operator key. This module deliberately implements NO
 * policy: there is no type→operator map, no review/workflow state, and no
 * default operator anywhere in this file.
 *
 * This module deliberately has NO dependency on the legacy brownfield core
 * (no js/core, no js/data). The legacy adaptation of these contracts — the
 * REDACT/PSEUDONYMIZE/DATE_TRANSFORM/GENERALIZE operators mirroring
 * `Processor.transformEntity` and the `createLegacyOperatorRegistry`
 * composer — lives in `./legacy-operators` (CURRENT_DECISIONS D-003: wrap,
 * do not rewrite). The only operator defined here is the pure KEEP identity
 * operator, which needs no legacy transformation-manager state.
 *
 * Fail-closed (D-009): unknown registry keys raise the typed
 * `unknown-operator` error — there is no silent fallback to another
 * transformation, no default operator, and a category/operator mismatch is an
 * explicit typed error instead of a guessed replacement.
 *
 * Privacy: this module never logs content and is Worker-safe (no
 * window/document access anywhere in its module graph).
 */

import { type RecognizerObservation } from "./recognizer-registry";

/**
 * Explicit transformation context threaded by the caller (the composed
 * engine in WU3; the parity tests). `strictMode` mirrors the legacy
 * `Processor.config.modoEstricto` profile branch of `transformEntity`; it is
 * an explicit input so operators never read mutable global configuration.
 */
export type OperatorContext = {
  readonly strictMode: boolean;
};

/** Machine-readable codes carried by {@link OperatorError} (D-009). */
export type OperatorErrorCode =
  | "unknown-operator"
  | "duplicate-operator"
  | "invalid-operator"
  | "invalid-operator-context"
  | "invalid-operator-input"
  | "operator-category-mismatch";

/** Typed operator/registry error; carries a machine-readable code. */
export class OperatorError extends Error {
  readonly code: OperatorErrorCode;

  constructor(code: OperatorErrorCode, message: string) {
    super(message);
    this.name = "OperatorError";
    this.code = code;
  }
}

/**
 * An operator answers "what transformation applies?" for one observation,
 * given explicit context. `key` is stable across runs and must be unique
 * within a registry. `apply` returns the replacement string for the
 * observation (possibly empty for deletion) and must never reset or mutate
 * the shared transformation-manager state as a side effect (see the STATE
 * CONTRACT documented in `./legacy-operators`).
 */
export interface Operator {
  readonly key: string;
  apply(observation: RecognizerObservation, context: OperatorContext): string;
}

/**
 * Validates the registry-shape of a candidate operator (fail-closed).
 * Exported so the legacy adaptation module applies the exact same
 * registration contract.
 */
export function assertOperatorShape(operator: unknown): asserts operator is Operator {
  if (
    operator === null ||
    typeof operator !== "object" ||
    typeof (operator as Operator).key !== "string" ||
    (operator as Operator).key.length === 0 ||
    typeof (operator as Operator).apply !== "function"
  ) {
    throw new OperatorError(
      "invalid-operator",
      "An operator must expose a non-empty string key and an apply(observation, context) function."
    );
  }
}

/** Validates the explicit operator context (fail-closed; no guessing). */
export function assertOperatorContext(context: unknown): asserts context is OperatorContext {
  if (
    context === null ||
    typeof context !== "object" ||
    typeof (context as OperatorContext).strictMode !== "boolean"
  ) {
    throw new OperatorError(
      "invalid-operator-context",
      "Operator context must expose a boolean strictMode flag mirroring the legacy modoEstricto profile."
    );
  }
}

/** Validates the observation input (fail-closed against malformed calls). */
export function assertObservation(
  observation: unknown
): asserts observation is RecognizerObservation {
  if (
    observation === null ||
    typeof observation !== "object" ||
    typeof (observation as RecognizerObservation).type !== "string" ||
    typeof (observation as RecognizerObservation).text !== "string"
  ) {
    throw new OperatorError(
      "invalid-operator-input",
      "Operator input must be a recognizer observation with string type and text."
    );
  }
}

/** Rejects observations outside the transformation category an operator covers. */
export function assertCoveredType(
  observation: RecognizerObservation,
  operatorKey: string,
  covered: readonly string[]
): void {
  if (!covered.includes(observation.type)) {
    throw new OperatorError(
      "operator-category-mismatch",
      `Operator "${operatorKey}" does not cover observation type "${observation.type}"; failing closed instead of guessing a transformation.`
    );
  }
}

/**
 * Registry of operators keyed by stable string keys. Registration is
 * explicit, lookup is typed, and key listing is deterministic (sorted).
 * Mirrors the WU1 `RecognizerRegistry` behavior (same fail-closed rules).
 */
export class OperatorRegistry {
  private readonly operators = new Map<string, Operator>();

  /** Registers an operator; duplicate keys fail closed (never overwritten). */
  register(operator: Operator): void {
    assertOperatorShape(operator);
    if (this.operators.has(operator.key)) {
      throw new OperatorError(
        "duplicate-operator",
        `An operator is already registered under key "${operator.key}"; registration is explicit and never silently overwritten.`
      );
    }
    this.operators.set(operator.key, operator);
  }

  /** Returns the operator registered under `key`; typed failure otherwise. */
  get(key: string): Operator {
    const operator = this.operators.get(key);
    if (operator === undefined) {
      throw new OperatorError(
        "unknown-operator",
        `No operator is registered under key "${key}"; there is no silent default operator.`
      );
    }
    return operator;
  }

  /** Whether an operator is registered under `key`. */
  has(key: string): boolean {
    return this.operators.has(key);
  }

  /** Deterministic (sorted) snapshot of the registered keys. */
  keys(): readonly string[] {
    return Object.freeze([...this.operators.keys()].sort());
  }
}

/** Stable registry keys of the legacy-mirroring operators (SPEC §5 names). */
export const LEGACY_OPERATOR_KEYS: Readonly<
  Record<"REDACT" | "PSEUDONYMIZE" | "DATE_TRANSFORM" | "GENERALIZE" | "KEEP", string>
> = Object.freeze({
  REDACT: "legacy.redact",
  PSEUDONYMIZE: "legacy.pseudonymize",
  DATE_TRANSFORM: "legacy.date-transform",
  GENERALIZE: "legacy.generalize",
  KEEP: "legacy.keep",
});

/**
 * KEEP — the pure identity operator: returns the observation's original
 * source text (`observation.text` is the immutable source slice). It is
 * defined for every observation type, mirroring the legacy `transformEntity`
 * fall-through `return entity.text`. Unlike the legacy-mirroring operators in
 * `./legacy-operators`, it reads no transformation-manager state and needs no
 * legacy import, so it lives on the pure contracts side of the boundary.
 */
export class KeepOperator implements Operator {
  readonly key = LEGACY_OPERATOR_KEYS.KEEP;

  apply(observation: RecognizerObservation, context: OperatorContext): string {
    assertObservation(observation);
    assertOperatorContext(context);
    return observation.text;
  }
}
