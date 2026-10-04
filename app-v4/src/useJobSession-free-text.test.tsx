import { act, renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import type { RegistryEngineInput } from "./engine/registry-engine";
import type { EngineOutcome } from "./engine/types";
import { EngineError } from "./engine/types";
import { canFinalize, getFinalText } from "./review/review-domain";
import { useJobSession } from "./useJobSession";
import type { StructuredGrid } from "./structured/grid";

/**
 * REC-03 WU-C bridge oracles: the state bridge holds job-scoped free-text
 * cell sessions as domain state, gates Safe output on their review, routes
 * decisions to the active cell, and invalidates stale state on policy/config
 * changes. Deterministic stub engine; synthetic fixtures only.
 */
const GRID: StructuredGrid = {
  headers: ["NHC", "Notas"],
  rows: [
    ["P-001", "Nota de Carmen Sánchez del lunes"],
    ["P-002", ""],
    ["P-003", "Seguimiento de Carmen Sánchez"],
  ],
};

function stubEngine(failOn?: (text: string) => boolean) {
  let counter = 0;
  return {
    async process(input: RegistryEngineInput): Promise<EngineOutcome> {
      if (failOn?.(input.text)) {
        throw new EngineError("invalid-text", "stub engine refused this cell");
      }
      counter += 1;
      const name = "Carmen Sánchez";
      const start = input.text.indexOf(name);
      const entities =
        start >= 0
          ? [
              {
                type: "NOMBRE",
                text: name,
                original: name,
                position: { start, end: start + name.length },
                confidence: 0.9,
                transformed: `PACIENTE_${counter}`,
              },
            ]
          : [];
      return {
        result: {
          original: input.text,
          processed: input.text,
          entities,
          alerts: [],
          stats: { totalEntities: entities.length, byType: {} },
          sessionId: `stub-${counter}`,
          processingTime: 0,
        },
        context: { mode: "shared" as const },
      };
    },
  };
}

const stubLoader = (failOn?: (text: string) => boolean) => async () => stubEngine(failOn);

function setupRouted() {
  const { result } = renderHook(() => useJobSession());
  act(() => {
    result.current.create({
      type: "files",
      files: [{ name: "tabla.csv", extension: "csv" }],
    });
  });
  expect(result.current.job?.kind).toBe("structured");
  act(() => {
    result.current.installStructuredGrid(GRID);
  });
  act(() => {
    result.current.overrideStructuredColumnAction(1, "process-as-text");
  });
  return result;
}

function acceptActiveCell(result: { readonly current: ReturnType<typeof useJobSession> }) {
  const state = result.current.structuredFreeText;
  if (!state) throw new Error("no free-text state");
  const position = result.current.structuredFreeTextActive;
  if (position === null) throw new Error("no active cell");
  const cell = state.cells[position];
  if (!cell.ok) throw new Error("active cell failed");
  for (const detection of cell.session.detections) {
    act(() => result.current.decide(detection.id, "accepted"));
  }
}

describe("WU-C bridge — run installs job-scoped cell sessions and gates Safe output", () => {
  it("processes non-blank cells, blocks Safe while pending, opens after all decisions", async () => {
    const result = setupRouted();
    await act(async () => {
      await result.current.runStructuredFreeTextReview({ engineLoader: stubLoader() });
    });
    // Blank row created no session; two sessions installed as domain state.
    expect(result.current.structuredFreeText?.cells.length).toBe(2);
    expect(result.current.structuredFreeTextActive).toBe(0);
    expect(result.current.structuredFreeText?.policyId).toBe("standard");
    expect(result.current.job?.outputs.safeOutputReady).toBe(false);
    expect((result.current.structured?.preparation.reasons ?? []).join(" ")).toMatch(
      /free-text.*review|require.*review/i
    );

    acceptActiveCell(result);
    // One cell decided: Safe stays blocked on the other cell.
    expect(result.current.job?.outputs.safeOutputReady).toBe(false);
    act(() => result.current.selectFreeTextCell(1));
    expect(result.current.structuredFreeTextActive).toBe(1);
    acceptActiveCell(result);

    expect(result.current.job?.outputs.safeOutputReady).toBe(true);
    expect(result.current.structured?.preparation.status).toBe("ready");
    if (result.current.structured?.preparation.status !== "ready") return;
    const safeIndex = result.current.structured.preparation.output.safe.headers.indexOf("Notas");
    const finals = (result.current.structuredFreeText?.cells ?? []).map((cell) =>
      cell.ok ? getFinalText(cell.session) : "<failed>"
    );
    expect(
      result.current.structured.preparation.output.safe.rows.map((row) => row[safeIndex])
    ).toEqual([finals[0], "", finals[1]]);
    expect(JSON.stringify(result.current.structured.preparation.output.safe)).not.toContain(
      "Carmen Sánchez"
    );
    for (const cell of result.current.structuredFreeText?.cells ?? []) {
      if (cell.ok) expect(canFinalize(cell.session)).toBe(true);
    }
  });

  it("cell navigation never certifies: viewing a cell leaves review state untouched", async () => {
    const result = setupRouted();
    await act(async () => {
      await result.current.runStructuredFreeTextReview({ engineLoader: stubLoader() });
    });
    const before = JSON.stringify(
      (result.current.structuredFreeText?.cells ?? []).map((cell) =>
        cell.ok ? cell.session.decisions : null
      )
    );
    act(() => result.current.selectFreeTextCell(1));
    act(() => result.current.selectFreeTextCell(0));
    act(() => result.current.selectFreeTextCell(null));
    const after = JSON.stringify(
      (result.current.structuredFreeText?.cells ?? []).map((cell) =>
        cell.ok ? cell.session.decisions : null
      )
    );
    expect(after).toBe(before);
    expect(result.current.job?.outputs.safeOutputReady).toBe(false);
  });
});

describe("WU-C bridge — zero storage/network regressions (oracle 10)", () => {
  it("processing, deciding and navigating free-text cells perform no storage writes", async () => {
    const writes: string[] = [];
    const spies = [
      vi.spyOn(window.localStorage, "setItem").mockImplementation((key: string) => {
        writes.push(`local:${key}`);
      }),
      vi.spyOn(window.sessionStorage, "setItem").mockImplementation((key: string) => {
        writes.push(`session:${key}`);
      }),
    ];
    try {
      const result = setupRouted();
      await act(async () => {
        await result.current.runStructuredFreeTextReview({ engineLoader: stubLoader() });
      });
      acceptActiveCell(result);
      act(() => result.current.selectFreeTextCell(1));
      acceptActiveCell(result);
      // No storage write was issued through the Storage API. Note: spying on
      // a Storage method installs an own property that jsdom counts as a key,
      // so the length assertion below allows exactly that known spy artifact.
      expect(writes).toEqual([]);
      const keysAfter: string[] = [];
      for (let i = 0; i < window.localStorage.length; i += 1) {
        const k = window.localStorage.key(i);
        if (k) keysAfter.push(k);
      }
      expect(keysAfter.filter((key) => key !== "setItem")).toEqual([]);
      const sessionKeys: string[] = [];
      for (let i = 0; i < window.sessionStorage.length; i += 1) {
        const k = window.sessionStorage.key(i);
        if (k) sessionKeys.push(k);
      }
      expect(sessionKeys.filter((key) => key !== "setItem")).toEqual([]);
    } finally {
      for (const spy of spies) spy.mockRestore();
    }
  });
});

describe("WU-C bridge — policy change discards stale sessions and reprocesses", () => {
  it("updatePolicy drops the old-policy state; an explicit re-run rebuilds under the new policy", async () => {
    const result = setupRouted();
    await act(async () => {
      await result.current.runStructuredFreeTextReview({ engineLoader: stubLoader() });
    });
    expect(result.current.structuredFreeText?.cells.length).toBe(2);

    act(() => {
      result.current.updatePolicy("strict");
    });
    // Stale sessions are gone in the same transition; Safe stays blocked.
    expect(result.current.structuredFreeText).toBeNull();
    expect(result.current.job?.outputs.safeOutputReady).toBe(false);
    expect(result.current.structured?.preparation.status).toBe("blocked");

    await act(async () => {
      await result.current.runStructuredFreeTextReview({ engineLoader: stubLoader() });
    });
    expect(result.current.structuredFreeText?.policyId).toBe("strict");
    expect(result.current.structuredFreeText?.cells.length).toBe(2);
  });
});

describe("WU-C bridge — configuration change that alters the cell set invalidates sessions", () => {
  it("resolving the column class away drops the held sessions", async () => {
    const result = setupRouted();
    await act(async () => {
      await result.current.runStructuredFreeTextReview({ engineLoader: stubLoader() });
    });
    expect(result.current.structuredFreeText?.cells.length).toBe(2);
    act(() => {
      result.current.overrideStructuredColumn(1, "insensitive");
    });
    expect(result.current.structuredFreeText).toBeNull();
    expect(result.current.job?.outputs.safeOutputReady).toBe(true);
  });
});

describe("WU-C bridge — processing failure is visible and blocks", () => {
  it("a failed cell blocks Safe output without keeping the original", async () => {
    const result = setupRouted();
    await act(async () => {
      await result.current.runStructuredFreeTextReview({
        engineLoader: stubLoader((text) => text.includes("Seguimiento")),
      });
    });
    expect(result.current.structuredFreeText?.cells.length).toBe(2);
    expect(result.current.job?.outputs.safeOutputReady).toBe(false);
    const reasons = (result.current.structured?.preparation.reasons ?? []).join("\n");
    expect(reasons).toMatch(/failed processing/);
    expect(reasons).not.toContain("Carmen Sánchez");
  });
});
