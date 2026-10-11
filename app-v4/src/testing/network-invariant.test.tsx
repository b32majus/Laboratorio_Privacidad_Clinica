/**
 * Network invariant test (SPEC_V4_QUALITY_SECURITY_DEPLOY.md §2, D-014,
 * CONTEXT.md §6/§7): the V4 clinical runtime performs ZERO outbound network
 * requests across the whole canonical flow.
 *
 * The real App is mounted with the recording network monitor installed, a
 * text job is created, the review → optional Privacy Gate → Result journey is
 * exercised plus session reset (New Job / Clear session); the recorded attempt
 * list must stay empty at every point. Nested tests prove the monitor itself
 * can detect unexpected outbound requests (fetch, WebSocket, sendBeacon).
 * Real browser network interception arrives with the E2E ticket.
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

function taskButton(name: string) {
  return screen.getByRole("button", { name });
}

/** Wait until the review workspace is actually installed (async engine seam). */
async function waitForReviewWorkspace(timeout = 10_000) {
  await screen.findByRole("region", { name: /review workspace/i }, { timeout });
}

function createTextJob() {
  fireEvent.change(screen.getByLabelText("Pegar texto"), {
    target: { value: SYNTHETIC_NOTE },
  });
  fireEvent.click(screen.getByRole("button", { name: "Crear trabajo" }));
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

  it("keeps the whole canonical flow free of outbound network attempts", async () => {
    const monitor: NetworkMonitor = install(window);
    try {
      render(<App />);
      expect(monitor.attempts()).toHaveLength(0);

      // Step 1: Input — job creation. The quiet shell lands directly on the
      // genuine Review work (issue #84): no Configure stop, engine start via
      // the local lazy engine seam.
      createTextJob();
      expect(screen.getByText("Pasted text")).toBeInTheDocument();
      await waitForReviewWorkspace();
      expect(monitor.attempts()).toHaveLength(0);

      // This synthetic note produces no detections, so the review session is
      // finalizable with zero mandatory decisions (domain authority, D-004)
      // and the direct single-item Result action unlocks (D-024). Entering it
      // records no network attempt.
      fireEvent.click(taskButton("Ver resultado"));
      expect(screen.getByRole("heading", { level: 2, name: "Resultado" })).toBeInTheDocument();
      expect(monitor.attempts()).toHaveLength(0);

      // The optional Privacy Gate destination stays reachable and local-only.
      fireEvent.click(screen.getByRole("button", { name: "Volver a la revisión" }));
      await waitForReviewWorkspace();
      fireEvent.click(taskButton("Privacy Gate"));
      expect(screen.getByRole("heading", { level: 2, name: "Privacy Gate" })).toBeInTheDocument();
      expect(monitor.attempts()).toHaveLength(0);

      // Session reset via Nuevo trabajo returns to a fresh Input.
      fireEvent.click(screen.getByRole("button", { name: "Nuevo trabajo" }));
      expect(screen.getByText("Aún no hay trabajo")).toBeInTheDocument();
      expect(monitor.attempts()).toHaveLength(0);

      createTextJob();
      await waitForReviewWorkspace();
      expect(monitor.attempts()).toHaveLength(0);

      // Session reset via Borrar sesión discards all in-memory state.
      fireEvent.click(screen.getByRole("button", { name: "Borrar sesión" }));
      expect(screen.getByText("Aún no hay trabajo")).toBeInTheDocument();
      expect(screen.queryByRole("button", { name: "Privacy Gate" })).not.toBeInTheDocument();
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

      fireEvent.change(screen.getByLabelText(/seleccionar archivos/i), {
        target: { files: [fixture] },
      });
      fireEvent.click(screen.getByRole("button", { name: "Crear trabajo" }));

      // The document job is created from extracted text held in memory only.
      // Issue #84 correction: the internal kind is not header chrome, so the
      // created-job witness is the job NAME header fact.
      await waitFor(() => {
        expect(screen.getByText("sample-clinical-note.txt")).toBeInTheDocument();
      });

      // Walk the reached surfaces (review → optional gate → back) and reset;
      // nothing may leave the process.
      await waitForReviewWorkspace();
      fireEvent.click(taskButton("Privacy Gate"));
      fireEvent.click(taskButton("Volver a la revisión"));
      fireEvent.click(screen.getByRole("button", { name: "Borrar sesión" }));
      expect(screen.getByText("Aún no hay trabajo")).toBeInTheDocument();

      expect(monitor.attempts()).toEqual([]);
      for (const spy of storageSpies) {
        expect(spy).not.toHaveBeenCalled();
      }
    } finally {
      monitor.uninstall();
    }
  });

  it("keeps the review flow (engine run, decisions, manual navigation) free of network attempts and storage writes", async () => {
    const REVIEW_NOTE =
      "Nombre: Carmen Sánchez\nLa paciente fue atendida por el Dr. García López el 12/03/2024. Contacto: 612345678.";

    const monitor: NetworkMonitor = install(window);
    // Storage writes are proven by spy-not-called below (Storage.length is
    // polluted by spies from earlier tests in this file, so it is not used).
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
      fireEvent.change(screen.getByLabelText("Pegar texto"), {
        target: { value: REVIEW_NOTE },
      });
      fireEvent.click(screen.getByRole("button", { name: "Crear trabajo" }));
      expect(monitor.attempts()).toHaveLength(0);

      // Landing on Review runs the local legacy engine and builds the session
      // (T22 #26 WU-D: asynchronously through the lazy engine seam).
      const progress = await screen.findByRole(
        "status",
        { name: /review progress/i },
        { timeout: 10_000 }
      );
      expect(progress).toHaveTextContent(/Pending: [1-9]/);
      expect(monitor.attempts()).toHaveLength(0);

      // An explicit decision mutates only in-memory domain state.
      const firstDetectionButton = screen
        .getAllByRole("list", { name: /detections/i })[0]
        .querySelector("button");
      expect(firstDetectionButton).not.toBeNull();
      fireEvent.click(firstDetectionButton as HTMLElement);
      fireEvent.click(screen.getByRole("button", { name: "Aceptar detección" }));
      expect(progress).toHaveTextContent("Accepted: 1");
      expect(monitor.attempts()).toHaveLength(0);

      // Navigating away and back never resets or re-runs review.
      fireEvent.click(taskButton("Privacy Gate"));
      fireEvent.click(taskButton("Volver a la revisión"));
      await waitFor(() =>
        expect(screen.getByRole("status", { name: /review progress/i })).toHaveTextContent(
          "Accepted: 1"
        )
      );
      expect(monitor.attempts()).toHaveLength(0);

      // While mandatory review is pending, the Result stays fail-closed.
      expect(screen.queryByRole("button", { name: "Ver resultado" })).not.toBeInTheDocument();
      expect(screen.queryByRole("button", { name: "Ir al resultado" })).not.toBeInTheDocument();
      expect(monitor.attempts()).toHaveLength(0);

      fireEvent.click(screen.getByRole("button", { name: "Borrar sesión" }));
      expect(screen.getByText("Aún no hay trabajo")).toBeInTheDocument();

      expect(monitor.attempts()).toEqual([]);
      for (const spy of storageSpies) {
        expect(spy).not.toHaveBeenCalled();
      }
    } finally {
      monitor.uninstall();
    }
  });
});
