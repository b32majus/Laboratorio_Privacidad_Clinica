/**
 * Serializable engine Worker protocol (Work Order T22 #26, WU-E; SPEC_V4_
 * QUALITY_SECURITY_DEPLOY §6 "Heavy privacy processing must be callable off
 * the main UI thread. The worker boundary must use serializable domain
 * contracts and must not weaken review/privacy semantics").
 *
 * The request/response payloads are plain JSON objects:
 *  - request: the exact `RegistryEngineInput` the engine already validates
 *    fail-closed (text + serializable ProcessingContext + optional policy);
 *  - response: either the plain frozen `EngineOutcome` (already JSON-safe by
 *    the engine's own context contract) or a typed error carrying the
 *    EngineError code + message so the main thread reconstructs the SAME
 *    failure classification (policy-unsupported, input-too-large, …).
 *
 * Privacy: clinical content stays inside the Worker's memory; nothing is
 * logged, persisted, or sent anywhere except back to the calling app (D-013).
 */

import type { RegistryEngineInput } from "../registry-engine";
import type { EngineOutcome } from "../types";

/** Worker protocol version — bump on any breaking payload change. */
export const ENGINE_WORKER_PROTOCOL = "laboratorio.engine-worker/v1";

export type EngineWorkerRequest = {
  readonly protocol: typeof ENGINE_WORKER_PROTOCOL;
  readonly id: number;
  readonly input: RegistryEngineInput;
};

export type EngineWorkerErrorKind = "engine" | "policy" | "unknown";

export type EngineWorkerError = {
  /** Which typed class to reconstruct on the main thread. */
  readonly kind: EngineWorkerErrorKind;
  /** Machine-readable failure code (EngineError.code, PolicyError.code, …). */
  readonly code: string;
  readonly message: string;
};

export type EngineWorkerResponse =
  | { readonly id: number; readonly ok: true; readonly outcome: EngineOutcome }
  | { readonly id: number; readonly ok: false; readonly error: EngineWorkerError };

/** True when the payload looks like an engine worker response (fail-closed). */
export function isEngineWorkerResponse(value: unknown): value is EngineWorkerResponse {
  if (value === null || typeof value !== "object") return false;
  const candidate = value as Record<string, unknown>;
  if (typeof candidate.id !== "number") return false;
  if (candidate.ok === true) {
    // Fail-closed: an "ok" response must carry a plain-object outcome, so a
    // malformed null/scalar can never be resolved as a successful result.
    const outcome = candidate.outcome;
    return (
      outcome !== null &&
      typeof outcome === "object" &&
      !Array.isArray(outcome) &&
      typeof (outcome as Record<string, unknown>).result === "object" &&
      (outcome as Record<string, unknown>).result !== null
    );
  }
  if (candidate.ok === false) {
    const error = candidate.error;
    return (
      error !== null &&
      typeof error === "object" &&
      typeof (error as Record<string, unknown>).code === "string" &&
      typeof (error as Record<string, unknown>).message === "string"
    );
  }
  return false;
}
