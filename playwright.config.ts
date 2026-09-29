/**
 * Playwright E2E configuration (Work Order T21 #25; SPEC_V4_QUALITY_SECURITY_
 * DEPLOY.md §1 "E2E", §2 "Network privacy invariant").
 *
 * The deterministic verification target is a PRODUCTION-LIKE STATIC BUILD:
 * the suite is served the artifacts of `npm run build` (Vite production
 * output in dist/, including the vendored same-origin pdf.js assets) through
 * `vite preview`, a static file server. No dev server, no HMR, no test-only
 * runtime patches: the tests exercise exactly the bytes a clinical origin
 * would ship.
 *
 * The network privacy invariant itself lives in e2e/harness/network-monitor.ts
 * and is enforced by the auto-fixture in e2e/harness/fixtures.ts for every
 * test in this suite.
 */
import { defineConfig } from "@playwright/test";

const PORT = Number(process.env.E2E_PORT ?? "4180");

export default defineConfig({
  testDir: "./e2e",
  // The no-network invariant is only meaningful when every test runs against
  // a fresh browser state; parallel workers each get their own context.
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [["github"], ["html", { open: "never" }]] : "list",
  use: {
    baseURL: `http://127.0.0.1:${PORT}/`,
    trace: "retain-on-failure",
  },
  webServer: {
    command: `npm run preview:v4 -- --host 127.0.0.1 --port ${PORT} --strictPort`,
    url: `http://127.0.0.1:${PORT}/`,
    // The server must serve the CURRENT production build; CI builds fresh
    // before the suite. Locally, reuse avoids re-serving a stale build only
    // when a server is already running.
    reuseExistingServer: !process.env.CI,
    timeout: 60_000,
  },
});
