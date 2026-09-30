/**
 * Main-thread facade over the engine Worker (Work Order T22 #26, WU-E;
 * SPEC_V4_QUALITY_SECURITY_DEPLOY §6). Implements the SAME `AsyncV4Engine`
 * seam as the in-process lazy loader, so callers cannot tell where the
 * engine ran and deterministic oracles can inject either one.
 *
 * Failure semantics are preserved: a typed worker error is reconstructed as
 * an `EngineError` carrying the SAME code, so `classifyProcessingFailure`
 * produces the identical failure classification (policy-unsupported,
 * input-too-large, invalid-context, …). Unexpected worker failures
 * (terminated worker, protocol violation) reject the pending call and are
 * classified by the caller like any other engine failure — never silently
 * swallowed, never mistaken for a successful outcome (D-009).
 *
 * Privacy: only the engine request/response crosses the boundary (D-013).
 */

import type { AsyncV4Engine } from "../engine-seam";
import { PolicyError, type PolicyErrorCode } from "../policy";
import { EngineError, type EngineErrorCode, type EngineOutcome } from "../types";
import {
  ENGINE_WORKER_PROTOCOL,
  isEngineWorkerResponse,
  type EngineWorkerRequest,
} from "./protocol";

/**
 * Reconstruct the SAME typed failure the engine threw inside the worker, so
 * `classifyProcessingFailure` produces the identical classification.
 * `unknown` failures reconstruct as plain Errors (classified
 * `processing-unknown`, fail-closed).
 */
function reconstructError(error: { kind: string; code: string; message: string }): unknown {
  if (error.kind === "engine") {
    return new EngineError(error.code as EngineErrorCode, error.message);
  }
  if (error.kind === "policy") {
    return new PolicyError(error.code as PolicyErrorCode, error.message);
  }
  return new Error(error.message);
}

/**
 * Build the worker-backed engine from an ALREADY-CONSTRUCTED Worker. The
 * injectable constructor form exists so deterministic oracles can drive the
 * protocol with a fake worker; production uses {@link createWorkerEngine}.
 */
export function createWorkerEngineFrom(worker: Worker): {
  engine: AsyncV4Engine;
  terminate: () => void;
} {
  let nextId = 1;
  /** Terminal failure state: once the worker errored, no new call may hang. */
  let workerFailed = false;
  const pending = new Map<
    number,
    { resolve: (outcome: EngineOutcome) => void; reject: (error: unknown) => void }
  >();

  const rejectAll = (message: string): void => {
    for (const entry of pending.values()) {
      entry.reject(new Error(message));
    }
    pending.clear();
  };

  worker.onmessage = (event: MessageEvent<unknown>) => {
    if (!isEngineWorkerResponse(event.data)) {
      // T22 #26 review hardening: a protocol-invalid response that claims a
      // pending id must FAIL that call closed (never hang, never fabricate);
      // unknown ids are ignored (fail-closed, no guessing).
      const claimedId = (event.data as { id?: unknown } | null)?.id;
      if (typeof claimedId === "number" && pending.has(claimedId)) {
        const entry = pending.get(claimedId);
        pending.delete(claimedId);
        entry?.reject(
          new EngineError(
            "invalid-engine-result",
            "The engine worker returned a protocol-invalid response."
          )
        );
      }
      return;
    }
    const entry = pending.get(event.data.id);
    if (!entry) return;
    pending.delete(event.data.id);
    if (event.data.ok) entry.resolve(event.data.outcome);
    else entry.reject(reconstructError(event.data.error));
  };
  worker.onerror = () => {
    // Terminal: reject every pending call AND fail every future call closed,
    // so a failed worker can never leave a later request hanging.
    workerFailed = true;
    rejectAll("The engine worker failed unexpectedly.");
  };

  return {
    engine: {
      process(input) {
        if (workerFailed) {
          return Promise.reject(new Error("The engine worker failed unexpectedly."));
        }
        const id = nextId;
        nextId += 1;
        const request: EngineWorkerRequest = {
          protocol: ENGINE_WORKER_PROTOCOL,
          id,
          input,
        };
        return new Promise<EngineOutcome>((resolve, reject) => {
          pending.set(id, { resolve, reject });
          worker.postMessage(request);
        });
      },
    },
    terminate: () => {
      workerFailed = true;
      rejectAll("The engine worker was terminated.");
      worker.terminate();
    },
  };
}

/**
 * Production worker engine: spawns the Vite module worker once and reuses it
 * for every engine call of the session.
 */
export function createWorkerEngine(): { engine: AsyncV4Engine; terminate: () => void } {
  const worker = new Worker(new URL("./engine.worker.ts", import.meta.url), {
    type: "module",
  });
  return createWorkerEngineFrom(worker);
}
