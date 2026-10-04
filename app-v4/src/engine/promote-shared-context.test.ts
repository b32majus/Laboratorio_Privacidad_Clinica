import { describe, expect, it } from "vitest";

import {
  createInitialProcessingContext,
  promoteToSharedContext,
} from "./initial-processing-context";

/**
 * Focused parity proof for the shared-context promotion helper (REC-03
 * WU-C): the batch loop refactor onto {@link promoteToSharedContext} changes
 * no REC-02 behavior. The full batch parity path stays covered by the
 * existing batch oracles; this file pins the helper contract itself.
 */
describe("promoteToSharedContext — parity with the batch promotion pattern", () => {
  it("promotes to shared mode carrying pseudonymState AND policy options", () => {
    const initial = createInitialProcessingContext({ id: "parity-job" }, "longitudinal-research");
    expect(initial.mode).toBe("fresh");
    expect(initial.options).toBeDefined();
    const promoted = promoteToSharedContext({
      mode: "fresh",
      pseudonymState: initial.pseudonymState,
      options: initial.options,
    });
    expect(promoted.mode).toBe("shared");
    expect(promoted.pseudonymState).toBe(initial.pseudonymState);
    expect(promoted.options).toEqual(initial.options);
    expect(Object.isFrozen(promoted)).toBe(true);
  });

  it("a bare fresh context promotes without inventing options", () => {
    const initial = createInitialProcessingContext({ id: "parity-job" }, "standard");
    expect(initial).toEqual({ mode: "fresh" });
    const promoted = promoteToSharedContext(initial);
    expect(promoted.mode).toBe("shared");
    expect(promoted.options).toBeUndefined();
    expect(promoted.pseudonymState).toBeUndefined();
  });
});
