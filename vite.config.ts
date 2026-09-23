/// <reference types="vitest/config" />
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

// The V4 app lives under app-v4/ with its own index.html as the Vite root.
// Build output goes to the repo-root dist/ (gitignored). Legacy pages under
// the repo root are never touched by this build.
export default defineConfig({
  root: "app-v4",
  plugins: [react()],
  build: {
    outDir: "../dist",
    emptyOutDir: true
  },
  test: {
    environment: "jsdom",
    // Vitest resolves include patterns against the Vite root (app-v4/).
    include: ["src/**/*.test.{ts,tsx}"]
  }
});
