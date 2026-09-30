/**
 * Production engine loader (Work Order T22 #26, WU-E): heavy processing runs
 * OFF the main UI thread in a dedicated Web Worker whenever the environment
 * provides Workers; environments without Workers (deterministic jsdom test
 * runs) fall back to the lazy in-process seam. Both paths implement the SAME
 * `AsyncV4Engine` contract with identical fail-closed semantics.
 *
 * The worker is created once per app session and reused for every engine
 * call; the browser reclaims it at page unload.
 */

import { loadRegistryEngine, type AsyncV4Engine } from "./engine-seam";
import { createWorkerEngine } from "./worker/worker-engine";

export type EngineLoader = () => Promise<AsyncV4Engine>;

let sharedWorkerEngine: { engine: AsyncV4Engine; terminate: () => void } | null = null;

/** The production default used by the app's review orchestration. */
export function createDefaultEngineLoader(): EngineLoader {
  if (typeof Worker === "undefined") {
    // Deterministic test environments (jsdom) have no Worker: the in-process
    // lazy seam keeps the exact same engine semantics.
    return loadRegistryEngine;
  }
  return async () => {
    sharedWorkerEngine ??= createWorkerEngine();
    return sharedWorkerEngine.engine;
  };
}
