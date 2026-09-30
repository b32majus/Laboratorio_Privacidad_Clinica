/**
 * Async engine seam (Work Order T22 #26, WU-D; SPEC_V4_QUALITY_SECURITY_
 * DEPLOY §6/§7).
 *
 * Production code must reach the heavy engine module graph (js/core + js/data
 * dictionaries, the largest JavaScript in the app) ONLY through the dynamic
 * import in {@link loadRegistryEngine}: Vite splits it into an async chunk
 * that is fetched on first processing, so the initial app load never parses
 * or executes it. The static import stays in the deterministic oracle tests,
 * which explicitly prove the composed engine's parity.
 *
 * The seam is async because the heavy path is about to move behind the Web
 * Worker boundary (WU-E, PERF-001): callers await one `process` call and get
 * the SAME fail-closed {@link EngineOutcome} contract, whether the engine ran
 * in-process (tests, fallback) or off the main thread (production).
 *
 * Privacy: no content is logged, persisted or placed in URLs here (D-013);
 * the module only moves calls across a load/transport boundary.
 */
import type { EngineOutcome } from "./types";
import type { RegistryEngineInput } from "./registry-engine";

/**
 * The engine seam consumed by review orchestration. Structural on purpose:
 * deterministic oracles can inject stubs without importing the real module.
 */
export type AsyncV4Engine = {
  process(input: RegistryEngineInput): Promise<EngineOutcome>;
};

/**
 * Load the registry-composed engine on first use and adapt its synchronous
 * `process` to the async seam. The dynamic import is the ONLY production
 * path to the heavy module graph.
 */
export async function loadRegistryEngine(): Promise<AsyncV4Engine> {
  const { createRegistryEngine } = await import("./registry-engine");
  const engine = createRegistryEngine();
  return {
    process: (input) => Promise.resolve(engine.process(input)),
  };
}
