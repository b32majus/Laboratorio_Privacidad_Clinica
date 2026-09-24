/**
 * Network invariant test (SPEC_V4_QUALITY_SECURITY_DEPLOY.md §2, D-014,
 * CONTEXT.md §6/§7): the V4 clinical runtime performs ZERO outbound network
 * requests across the whole canonical flow.
 *
 * The real App is mounted with the recording network monitor installed, a
 * text job is created, and every step (Input → Configure → Review → Privacy
 * Gate → Export) plus session reset (New Job / Clear session) is exercised;
 * the recorded attempt list must stay empty at every point. Nested tests
 * prove the monitor itself can detect unexpected outbound requests (fetch,
 * WebSocket, sendBeacon). Real browser network interception arrives with
 * the E2E ticket.
 */
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import "@testing-library/jest-dom/vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { App } from "../App";
import { NetworkInvariantError, install, type NetworkMonitor } from "./network-monitor";

const SYNTHETIC_NOTE = "Synthetic clinical note for deterministic tests.";

function stepButton(stepNumber: number, label: string) {
  return screen.getByRole("button", { name: `${stepNumber}. ${label}` });
}

function createTextJob() {
  fireEvent.change(screen.getByLabelText("Paste text"), {
    target: { value: SYNTHETIC_NOTE },
  });
  fireEvent.click(screen.getByRole("button", { name: "Create job" }));
}

afterEach(cleanup);

describe("network invariant monitor", () => {
  it("records and blocks a planted fetch attempt (hook self-test)", () => {
    const monitor = install(window);
    try {
      expect(() => window.fetch("https://evil.example/telemetry")).toThrow(NetworkInvariantError);
      expect(monitor.attempts()).toEqual([
        { kind: "fetch", url: "https://evil.example/telemetry" },
      ]);
    } finally {
      monitor.uninstall();
    }
  });

  it("records WebSocket and sendBeacon attempts without any network I/O", () => {
    const monitor = install(window);
    try {
      expect(() => new window.WebSocket("wss://evil.example/socket")).toThrow(
        NetworkInvariantError
      );
      expect(window.navigator.sendBeacon("https://evil.example/beacon")).toBe(false);
      expect(monitor.attempts().map((attempt) => attempt.kind)).toEqual([
        "websocket",
        "sendBeacon",
      ]);
    } finally {
      monitor.uninstall();
    }
  });

  it("uninstall restores the original window bindings", () => {
    const originalFetch = window.fetch;
    const monitor = install(window);
    expect(window.fetch).not.toBe(originalFetch);
    monitor.uninstall();
    expect(window.fetch).toBe(originalFetch);
  });

  it("keeps the whole canonical flow free of outbound network attempts", () => {
    const monitor: NetworkMonitor = install(window);
    try {
      render(<App />);
      expect(monitor.attempts()).toHaveLength(0);

      // Step 1: Input — job creation.
      createTextJob();
      expect(screen.getByText("Pasted text")).toBeInTheDocument();
      expect(monitor.attempts()).toHaveLength(0);

      // Steps 2-4: Configure → Review → Privacy Gate.
      const forwardSteps = [
        [2, "Configure"],
        [3, "Review"],
        [4, "Privacy Gate"],
      ] as const;
      for (const [stepNumber, label] of forwardSteps) {
        fireEvent.click(stepButton(stepNumber, label));
        expect(screen.getByRole("heading", { level: 2, name: label })).toBeInTheDocument();
        expect(monitor.attempts()).toHaveLength(0);
      }

      // Step 5: Export stays fail-closed (mandatory review incomplete): the
      // step cannot be entered, and attempting it records no network attempt.
      expect(stepButton(5, "Export")).toBeDisabled();
      expect(monitor.attempts()).toHaveLength(0);

      // Session reset via New Job returns to a fresh Input.
      fireEvent.click(screen.getByRole("button", { name: "New Job" }));
      expect(screen.getByText("No job yet")).toBeInTheDocument();
      expect(monitor.attempts()).toHaveLength(0);

      createTextJob();
      fireEvent.click(stepButton(2, "Configure"));
      expect(monitor.attempts()).toHaveLength(0);

      // Session reset via Clear session discards all in-memory state.
      fireEvent.click(screen.getByRole("button", { name: "Clear session" }));
      expect(screen.getByText("No job yet")).toBeInTheDocument();
      expect(stepButton(2, "Configure")).toBeDisabled();
      expect(monitor.attempts()).toHaveLength(0);
    } finally {
      monitor.uninstall();
    }
  });

  it("keeps the document-intake flow (TXT fixture) free of network attempts and storage writes", async () => {
    const fixture = new File(
      [
        new Uint8Array(
          readFileSync(
            path.join(
              path.dirname(fileURLToPath(import.meta.url)),
              "../input/fixtures/sample-clinical-note.txt"
            )
          )
        ),
      ],
      "sample-clinical-note.txt"
    );

    const monitor: NetworkMonitor = install(window);
    // Measure storage BEFORE spying (jsdom Storage.length counts spies).
    expect(window.localStorage.length).toBe(0);
    expect(window.sessionStorage.length).toBe(0);
    const storageSpies = [
      vi.spyOn(window.localStorage, "setItem"),
      vi.spyOn(window.sessionStorage, "setItem"),
      vi.spyOn(window.localStorage, "removeItem"),
      vi.spyOn(window.sessionStorage, "removeItem"),
      vi.spyOn(window.localStorage, "clear"),
      vi.spyOn(window.sessionStorage, "clear"),
    ];

    try {
      render(<App />);
      expect(monitor.attempts()).toHaveLength(0);

      fireEvent.change(screen.getByLabelText(/select files/i), {
        target: { files: [fixture] },
      });
      fireEvent.click(screen.getByRole("button", { name: "Create job" }));

      // The document job is created from extracted text held in memory only.
      await waitFor(() => {
        expect(screen.getByText("Document job")).toBeInTheDocument();
      });
      expect(screen.getByText("sample-clinical-note.txt")).toBeInTheDocument();

      // Walk the reachable steps and reset; nothing may leave the process.
      fireEvent.click(stepButton(2, "Configure"));
      fireEvent.click(stepButton(1, "Input"));
      fireEvent.click(screen.getByRole("button", { name: "Clear session" }));
      expect(screen.getByText("No job yet")).toBeInTheDocument();

      expect(monitor.attempts()).toEqual([]);
      for (const spy of storageSpies) {
        expect(spy).not.toHaveBeenCalled();
      }
    } finally {
      monitor.uninstall();
    }
  });
});
