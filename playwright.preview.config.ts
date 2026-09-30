/**
 * Playwright E2E against the DEPLOYMENT PREVIEW (Work Order T24 #28; ticket
 * deterministic verification "Playwright/no-network smoke against preview").
 *
 * Difference from the default playwright.config.ts: the web server is the
 * deployment preview harness (scripts/deploy/preview-server.mjs), which
 * serves the production dist/ with the EXACT security headers parsed from
 * render.yaml — the same configuration a Render Static deployment runs. The
 * browser therefore executes the shipped bytes UNDER the clinical-origin CSP
 * and the other headers, so the critical-flow smoke also proves the header
 * configuration does not break the application at runtime.
 *
 * Scope: one canonical happy path (paste → review → export) plus the network
 * privacy invariant. The full critical contract suite runs in the default
 * configuration (npm run test:e2e).
 */
import { defineConfig } from "@playwright/test";

const PORT = Number(process.env.E2E_PREVIEW_PORT ?? "4181");

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [["github"], ["html", { open: "never" }]] : "list",
  use: {
    baseURL: `http://127.0.0.1:${PORT}/`,
    trace: "retain-on-failure",
  },
  webServer: {
    command: `node scripts/deploy/preview-server.mjs --port=${PORT}`,
    url: `http://127.0.0.1:${PORT}/`,
    reuseExistingServer: !process.env.CI,
    timeout: 60_000,
  },
});
