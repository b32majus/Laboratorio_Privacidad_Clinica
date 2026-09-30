/**
 * Deterministic oracle for the engine Worker boundary (Work Order T22 #26,
 * WU-E; SPEC_V4_QUALITY_SECURITY_DEPLOY §6).
 *
 * A FakeWorker drives the EXACT protocol both ways: it emulates the worker
 * side with the REAL composed engine, so the worker-backed engine must return
 * outcomes IDENTICAL to the in-process engine (the boundary cannot weaken
 * review/privacy semantics), and typed failures must reconstruct with the
 * SAME classification codes. Planted protocol violations prove the facade
 * fails closed instead of guessing.
 */

import { describe, expect, it } from "vitest";

import { classifyProcessingFailure } from "../../processing-outcome";
import { PolicyError } from "../policy";
import { createRegistryEngine } from "../registry-engine";
import type { RegistryEngineInput } from "../registry-engine";
import type { EngineWorkerRequest, EngineWorkerResponse } from "./protocol";
import { ENGINE_WORKER_PROTOCOL } from "./protocol";
import { createWorkerEngineFrom } from "./worker-engine";

/** Minimal Worker double: relays requests to the REAL in-process engine. */
class FakeWorker {
  engine = createRegistryEngine();
  onmessage: ((event: { data: EngineWorkerResponse }) => void) | null = null;
  onerror: ((event: unknown) => void) | null = null;
  /** Requests captured but not yet answered (for planted-violation tests). */
  readonly unanswered: EngineWorkerRequest[] = [];

  postMessage(request: EngineWorkerRequest): void {
    if (
      request === null ||
      typeof request !== "object" ||
      request.protocol !== ENGINE_WORKER_PROTOCOL
    ) {
      return; // Mirror of the worker entry's fail-closed guard.
    }
    let response: EngineWorkerResponse;
    try {
      const outcome = this.engine.process(request.input);
      response = { id: request.id, ok: true, outcome };
    } catch (error) {
      const code =
        error !== null &&
        typeof error === "object" &&
        typeof (error as { code?: unknown }).code === "string"
          ? (error as { code: string }).code
          : "processing-unknown";
      const message = error instanceof Error ? error.message : String(error);
      const kind = error instanceof Error && error.name === "PolicyError" ? "policy" : "unknown";
      response = { id: request.id, ok: false, error: { kind, code, message } };
    }
    // Deliver asynchronously like a real worker message event.
    void Promise.resolve().then(() => {
      this.onmessage?.({ data: response });
    });
  }

  terminate(): void {
    /* no-op for the double */
  }
}

const INPUT: RegistryEngineInput = {
  text: "Nombre: Carmen Sánchez\nLa paciente fue atendida por el Dr. García López el 12/03/2024.",
  context: { mode: "fresh" },
  policyId: "standard",
};

describe("engine Worker boundary (T22 #26 WU-E)", () => {
  it("returns outcomes IDENTICAL to the in-process engine (no semantic weakening)", async () => {
    const fake = new FakeWorker();
    const { engine, terminate } = createWorkerEngineFrom(fake as unknown as Worker);
    try {
      const viaWorker = await engine.process(INPUT);
      const inProcess = createRegistryEngine().process(INPUT);
      // Deep equality of the complete frozen outcome — the transport cannot
      // change behavior. Run-identity metadata (sessionId, processingTime)
      // differs per process run by design and is normalized on both sides.
      const normalize = (o: unknown) =>
        JSON.parse(
          JSON.stringify(o, (key, value) =>
            key === "sessionId" || key === "processingTime" ? `<${key}>` : value
          )
        );
      expect(normalize(viaWorker)).toEqual(normalize(inProcess));
    } finally {
      terminate();
    }
  });

  it("reconstructs a typed policy failure with the SAME classification", async () => {
    const fake = new FakeWorker();
    const { engine, terminate } = createWorkerEngineFrom(fake as unknown as Worker);
    try {
      const failureInput: RegistryEngineInput = { ...INPUT, policyId: "external-ai" };
      let failure: unknown = null;
      try {
        await engine.process(failureInput);
      } catch (error) {
        failure = error;
      }
      expect(failure).toBeInstanceOf(PolicyError);
      const code = (failure as { code: string }).code;
      expect(code).toBe("policy-operator-mapping-unavailable");
      // The classified failure matches the in-process classification exactly.
      const viaWorker = classifyProcessingFailure(failure);
      let inProcessFailure: unknown = null;
      try {
        createRegistryEngine().process(failureInput);
      } catch (error) {
        inProcessFailure = error;
      }
      expect(classifyProcessingFailure(inProcessFailure)).toEqual(viaWorker);
    } finally {
      terminate();
    }
  });

  it("PLANTED VIOLATION: a protocol-violating response never resolves the call", async () => {
    const fake = new FakeWorker();
    // Plant a broken worker side: respond with a malformed payload.
    fake.postMessage = () => {
      void Promise.resolve().then(() => {
        // Deliberately malformed payload (violates the protocol shape).
        fake.onmessage?.({
          data: { id: 999, ok: true, nonsense: true } as unknown as EngineWorkerResponse,
        });
      });
    };
    const { engine, terminate } = createWorkerEngineFrom(fake as unknown as Worker);
    try {
      let settled = false;
      const result = await Promise.race([
        engine.process(INPUT).then(
          (outcome) => {
            settled = true;
            return outcome;
          },
          () => {
            settled = true;
            return null;
          }
        ),
        // The call must NOT be settled by the garbage response; it stays
        // pending (no fabricated success, no fabricated failure).
        new Promise<string>((resolve) => {
          void Promise.resolve().then(() => resolve("still-pending"));
        }),
      ]);
      expect(result).toBe("still-pending");
      expect(settled).toBe(false);
    } finally {
      terminate();
    }
  });

  it("terminate rejects pending calls instead of leaving them hanging", async () => {
    const fake = new FakeWorker();
    fake.engine = {
      ...fake.engine,
      process: () => {
        throw new Error("unreachable: the double never answers in this test");
      },
    } as never;
    // Suppress the double's answer entirely: overload postMessage to no-op.
    fake.postMessage = () => undefined;
    const { engine, terminate } = createWorkerEngineFrom(fake as unknown as Worker);
    const pending = engine.process(INPUT);
    let failure: unknown = null;
    terminate();
    try {
      await pending;
    } catch (error) {
      failure = error;
    }
    expect(failure).toBeInstanceOf(Error);
    expect((failure as Error).message).toMatch(/terminated/i);
  });
});
