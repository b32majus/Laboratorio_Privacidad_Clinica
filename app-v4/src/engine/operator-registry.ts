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
 * The context also carries an OPTIONAL date sub-context (T13 #17 WU-B):
 * {@link DateOperatorContext} names the explicit {@link DateRole} recognized
 * for one observation and, when the caller has shift intent, the serialized
 * {@link DateShiftState}. It is optional precisely so every existing caller
 * of the operator surface keeps working unchanged; when present it is
 * validated fail-closed alongside `strictMode`.
 *
 * Privacy: this module never logs content and is Worker-safe (no
 * window/document access anywhere in its module graph).
 */

import { type DateRole } from "./date-semantics";
import { type DateShiftState } from "./date-shift";
import { type RecognizerObservation } from "./recognizer-registry";

/**
 * Explicit date semantics for one observation (T13 #17 WU-B). The caller
 * resolves the role from the observation's surrounding clause (see
 * `./date-operator`'s `classifyObservationDateRole`) and, when it has shift
 * intent, carries the serialized date-shift state here. Recognition and
 * policy stay outside this contract: the registry only validates shape.
 */
export type DateOperatorContext = {
  readonly role: DateRole;
  /** Serialized date-shift state from ProcessingContext.options.dateShift. */
  readonly shift?: DateShiftState;
};

/**
 * Explicit transformation context threaded by the caller (the composed
 * engine in WU3; the parity tests). `strictMode` mirrors the legacy
 * `Processor.config.modoEstricto` profile branch of `transformEntity`; it is
 * an explicit input so operators never read mutable global configuration.
 * `date` is the OPTIONAL T13 #17 date sub-context; its absence preserves the
 * exact pre-T13 behavior for every existing caller.
 */
export type OperatorContext = {
  readonly strictMode: boolean;
  readonly date?: DateOperatorContext;
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

/** The only five accepted date roles (mirrors the `DateRole` union). */
const DATE_ROLE_VALUES: readonly string[] = Object.freeze([
  "birth",
  "admission",
  "discharge",
  "future-appointment",
  "unknown",
]);

/**
 * Validates the explicit operator context (fail-closed; no guessing).
 * `strictMode` must be boolean. When the optional `date` sub-context is
 * present it must be a non-null, non-array object whose `role` is one of the
 * five accepted {@link DateRole} strings; a present `shift` must be a
 * non-null, non-array object. Deep date-shift validity is owned by
 * `./date-shift` when the state is consumed, so this contract stays at the
 * shape boundary.
 */
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

  const dateCandidate: unknown = (context as OperatorContext).date;
  if (dateCandidate === undefined) return;
  if (dateCandidate === null || typeof dateCandidate !== "object" || Array.isArray(dateCandidate)) {
    throw new OperatorError(
      "invalid-operator-context",
      "Operator context date sub-context must be a non-null, non-array object when present; failing closed instead of guessing."
    );
  }

  const role: unknown = (dateCandidate as DateOperatorContext).role;
  if (typeof role !== "string" || !DATE_ROLE_VALUES.includes(role)) {
    throw new OperatorError(
      "invalid-operator-context",
      "Operator context date sub-context role must be one of the five accepted date roles; failing closed instead of guessing."
    );
  }

  const shift: unknown = (dateCandidate as DateOperatorContext).shift;
  if (shift === undefined) return;
  if (shift === null || typeof shift !== "object" || Array.isArray(shift)) {
    throw new OperatorError(
      "invalid-operator-context",
      "Operator context date shift state must be a non-null, non-array object when present; failing closed instead of guessing."
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

/**
 * Stable registry keys of the accepted transformation operators (SPEC §5
 * names). The first five mirror the legacy `Processor.transformEntity`
 * branches (WU2a); `AGE_GENERALIZE` is the V4 policy-owned AGE
 * generalization operator added by T12 WU-B (`./age-operator`);
 * `DATE_GENERALIZE` and `DATE_SHIFT` are the two V4 date operators added by
 * T13 #17 WU-B (`./date-operator`). None of the last three is a legacy
 * branch.
 *
 * Policy reachability (REC-02): `AGE_GENERALIZE` is selected by every accepted
 * policy mapping, `DATE_GENERALIZE` is selected by the accepted `external-ai`
 * FECHA mapping and `DATE_SHIFT` by the accepted `longitudinal-research` FECHA
 * mapping (`./policy` owns the table). `DATE_SHIFT` requires a caller-supplied
 * shift state and fails closed without one.
 */
export const LEGACY_OPERATOR_KEYS: Readonly<
  Record<
    | "REDACT"
    | "PSEUDONYMIZE"
    | "DATE_TRANSFORM"
    | "GENERALIZE"
    | "KEEP"
    | "AGE_GENERALIZE"
    | "DATE_GENERALIZE"
    | "DATE_SHIFT",
    string
  >
> = Object.freeze({
  REDACT: "legacy.redact",
  PSEUDONYMIZE: "legacy.pseudonymize",
  DATE_TRANSFORM: "legacy.date-transform",
  GENERALIZE: "legacy.generalize",
  KEEP: "legacy.keep",
  AGE_GENERALIZE: "v4.age-generalize",
  DATE_GENERALIZE: "v4.date-generalize",
  DATE_SHIFT: "v4.date-shift",
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
