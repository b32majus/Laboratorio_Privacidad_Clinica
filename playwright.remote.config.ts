/**
 * Remote Playwright config (HARDEN-02 WU-F): runs the EXISTING critical V4
 * E2E suite against an explicitly provided live origin instead of the local
 * static preview, reusing the same network-privacy auto-fixture (zero
 * unexpected outbound requests).
 *
 * Usage (opt-in, read-only):
 *   REMOTE_BASE_URL=https://<origin> npm run test:e2e:remote
 *
 * There is intentionally NO `webServer`: the remote origin is served by the
 * platform, and the harness never mutates it. The config refuses to run
 * without `REMOTE_BASE_URL` so it can never silently fall back to localhost.
 */
import { defineConfig } from "@playwright/test";

const REMOTE_BASE_URL = process.env.REMOTE_BASE_URL;
if (!REMOTE_BASE_URL) {
  throw new Error(
    "REMOTE_BASE_URL is required for the remote Playwright QA run (read-only; no deploy is triggered)."
  );
}

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: "list",
  use: {
    baseURL: REMOTE_BASE_URL,
    trace: "retain-on-failure",
  },
});
