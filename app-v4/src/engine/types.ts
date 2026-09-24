/**
 * V4 engine interface (Work Order T05; SPEC_V4_PRIVACY_ENGINE.md §2, §3, §7).
 *
 * The V4 `PrivacyEngine` boundary wraps the legacy brownfield core behind a
 * typed seam. Two rules shape this contract:
 *
 * 1. ProcessingContext is a PLAIN SERIALIZABLE value (SPEC §7): JSON-able, no
 *    Maps, no functions, no class instances. Cross-document consistency
 *    (batch/longitudinal jobs) is threaded intentionally through this context,
 *    never through mutable globals or monkey patches (D-011).
 * 2. `EngineOutcome.result` keeps the legacy `js/core/processor.js` result
 *    shape (entities with type/subtype/text/original/position/confidence/
 *    transformed) so the existing `js/domain/from-processor.js` adapter keeps
 *    working unchanged (D-003 brownfield adapters).
 *
 * Terminology (D-006/SPEC §13): behavior is pseudonymization/preparation; no
 * name or copy in this module claims "anonymity".
 */

/** One stable [key, value] pseudonym mapping entry (JSON-able pair). */
export type PseudonymAssignmentEntry = readonly [key: string, value: string];

/**
 * Serializable snapshot of the legacy `AsignadorSustitutos` state: the three
 * pseudonym maps as [key, value] pair arrays plus the professional/family
 * counters. JSON.stringify round-trip must preserve semantics.
 */
export type PseudonymState = {
  readonly asignaciones: readonly PseudonymAssignmentEntry[];
  readonly profesionales: readonly PseudonymAssignmentEntry[];
  readonly familiares: readonly PseudonymAssignmentEntry[];
  readonly contadorProfesionales: number;
  readonly contadorFamiliares: number;
};

/**
 * `fresh`: every document starts from an empty pseudonym state (independent
 * runs). `shared`: the caller threads the previously returned context so the
 * same original value keeps the same pseudonym across documents and counters
 * continue instead of restarting (mirrors the legacy PersistentMapper intent
 * without monkey patching, D-011).
 */
export type ProcessingContextMode = "fresh" | "shared";

/**
 * Explicit shared processing context (SPEC §7). Plain, frozen, JSON-able.
 * `options` is an opaque serializable passthrough reserved for legacy
 * processor options compatibility; the adapter never applies it as global
 * configuration, so detection behavior stays fixed and deterministic.
 */
export type ProcessingContext = {
  readonly mode: ProcessingContextMode;
  readonly pseudonymState?: PseudonymState;
  readonly options?: Record<string, unknown>;
};

/** Legacy entity shape (verified in js/core/processor.js). Kept structural. */
export type LegacyEntity = {
  readonly type: string;
  readonly subtype?: string;
  readonly text: string;
  readonly original?: string;
  readonly position: { readonly start: number; readonly end: number };
  readonly confidence: number;
  readonly transformed?: string;
  readonly scoring?: unknown;
};

/**
 * Structural type of the legacy `js/core/processor.js` result. Only the
 * fields consumed by V4 (directly or via js/domain/from-processor.js) are
 * declared; extra legacy fields pass through untouched.
 */
export type LegacyProcessorResult = {
  readonly original: string;
  readonly processed: string;
  readonly entities: readonly LegacyEntity[];
  readonly alerts: readonly unknown[];
  readonly stats: { readonly totalEntities: number; readonly byType: Record<string, number> };
  readonly sessionId: string;
  readonly processingTime: number;
  readonly scoring?: Record<string, unknown>;
};

/** Engine outcome: legacy-shaped result plus the UPDATED serializable context. */
export type EngineOutcome = {
  readonly result: LegacyProcessorResult;
  readonly context: ProcessingContext;
};

/** Machine-readable codes carried by {@link EngineError} (D-009 fail-closed). */
export type EngineErrorCode =
  | "invalid-context"
  | "non-serializable-context"
  | "invalid-text"
  | "empty-text"
  | "input-too-large"
  | "invalid-engine-result";

/** Typed engine error; carries a machine-readable code (D-009 fail-closed). */
export class EngineError extends Error {
  readonly code: EngineErrorCode;

  constructor(code: EngineErrorCode, message: string) {
    super(message);
    this.name = "EngineError";
    this.code = code;
  }
}

/**
 * V4 engine boundary (SPEC §2). `process` receives the immutable source text
 * plus the explicit context and returns the legacy-shaped result together
 * with the updated serializable context.
 */
export interface V4PrivacyEngine {
  process(input: { text: string; context: ProcessingContext }): EngineOutcome;
}
