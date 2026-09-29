/**
 * E2E fixtures (Work Order T21 #25).
 *
 * `test` extends Playwright's base test with an AUTO network fixture: every
 * test in the suite gets a NetworkRecorder bound to its page, external
 * requests are aborted (no bytes ever leave towards an unexpected
 * destination) and the test FAILS at teardown if any unexpected external
 * request was observed — including requests the application itself would
 * plant through a regression. Adversarial-oracle specs opt into
 * `record-only` and assert detection explicitly.
 */
import { expect as baseExpect, test as base } from "@playwright/test";

import { NetworkRecorder, type NetworkMode } from "./network-monitor";

export const expect = baseExpect;

export type TestOptions = {
  networkMode: NetworkMode;
  networkRecorder: NetworkRecorder;
};

export const test = base.extend<TestOptions>({
  networkMode: "forbid-external",

  networkRecorder: [
    async ({ page, baseURL, networkMode }, use) => {
      const baseOrigin = new URL(baseURL ?? "http://127.0.0.1/").origin;
      const recorder = NetworkRecorder.install(page, baseOrigin, networkMode === "forbid-external");
      await use(recorder);
      if (networkMode === "forbid-external") {
        expect(
          recorder.violations,
          `Unexpected outbound network request(s) from the clinical runtime: ${recorder.violations
            .map((violation) => `${violation.resourceType} ${violation.url}`)
            .join("; ")}`
        ).toEqual([]);
      }
    },
    { auto: true },
  ],
});
