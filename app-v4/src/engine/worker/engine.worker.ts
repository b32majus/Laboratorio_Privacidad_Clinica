/**
 * Web Worker entry for heavy privacy processing (Work Order T22 #26, WU-E;
 * SPEC_V4_QUALITY_SECURITY_DEPLOY §6). The registry-composed engine — the
 * same module graph the in-process seam lazy-loads — runs entirely inside
 * this worker, so detection/transformation never blocks the main UI thread.
 *
 * Semantics are IDENTICAL to the in-process engine: same module, same
 * fail-closed validation, same outcomes. Errors are serialized as
 * {code, message} and reconstructed typed on the main thread
 * (worker-engine.ts) so failure classification is unchanged.
 *
 * Privacy: the worker never logs content (no console.*), never persists
 * anything, and only posts responses back to the app that spawned it (D-013).
 */

import { PolicyError } from "../policy";
import { EngineError } from "../types";
import { createRegistryEngine } from "../registry-engine";
import {
  ENGINE_WORKER_PROTOCOL,
  type EngineWorkerRequest,
  type EngineWorkerResponse,
} from "./protocol";

const engine = createRegistryEngine();

self.onmessage = (event: MessageEvent<EngineWorkerRequest>) => {
  const request = event.data;
  if (
    request === null ||
    typeof request !== "object" ||
    request.protocol !== ENGINE_WORKER_PROTOCOL ||
    typeof request.id !== "number"
  ) {
    return; // Fail-closed: unknown payloads are ignored, never guessed.
  }
  let response: EngineWorkerResponse;
  try {
    const outcome = engine.process(request.input);
    response = { id: request.id, ok: true, outcome };
  } catch (error) {
    const rawCode =
      error !== null &&
      typeof error === "object" &&
      typeof (error as { code?: unknown }).code === "string"
        ? (error as { code: string }).code
        : null;
    const message = error instanceof Error ? error.message : String(error);
    if (error instanceof PolicyError) {
      response = {
        id: request.id,
        ok: false,
        error: { kind: "policy", code: error.code, message },
      };
    } else if (error instanceof EngineError) {
      response = {
        id: request.id,
        ok: false,
        error: { kind: "engine", code: error.code, message },
      };
    } else {
      // Fail-closed: an unexpected failure crosses as `unknown` and is
      // classified `processing-unknown` on the main thread — never silently
      // mistaken for a successful outcome (D-009).
      response = {
        id: request.id,
        ok: false,
        error: { kind: "unknown", code: rawCode ?? "processing-unknown", message },
      };
    }
  }
  void Promise.resolve().then(() => {
    (self as unknown as Worker).postMessage(response);
  });
};
