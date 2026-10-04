import { describe, expect, it } from "vitest";

import { createInitialProcessingContext } from "../engine/initial-processing-context";
import type { RegistryEngineInput } from "../engine/registry-engine";
import type { EngineOutcome, ProcessingContext } from "../engine/types";
import { EngineError } from "../engine/types";
import { createStructuredConfiguration, overrideColumnAction } from "./configuration";
import {
  enumerateFreeTextCells,
  isFreeTextCellSetCurrent,
  processStructuredFreeTextCells,
  type StructuredFreeTextState,
} from "./free-text";
import type { StructuredGrid } from "./grid";

/**
 * REC-03 WU-C (D-021 free-text columns) domain oracles: deterministic
 * row-major processing of every non-blank configured cell with one shared
 * REC-02 ProcessingContext, job-scoped sessions plus visible typed failures.
 * Synthetic fixtures only; the engine is a deterministic stub (the real
 * engine path is proven by the companion real-engine oracle file).
 */
const GRID: StructuredGrid = {
  headers: ["NHC", "Notas", "CP", "Diagnostico"],
  rows: [
    ["P-001", "nota clinica uno", "texto cp uno", "Gripe A"],
    ["P-002", "", "texto cp dos", "Fractura"],
    ["P-003", "nota clinica tres", null, "Gripe A"],
  ],
};

function configured() {
  let config = createStructuredConfiguration(GRID);
  config = overrideColumnAction(config, 1, "process-as-text");
  config = overrideColumnAction(config, 2, "process-as-text");
  return config;
}

type RecordedCall = { readonly text: string; readonly context: ProcessingContext };

function stubEngine(options: { failOn?: (text: string) => boolean } = {}) {
  const calls: RecordedCall[] = [];
  let counter = 0;
  return {
    calls,
    async process(input: RegistryEngineInput): Promise<EngineOutcome> {
      calls.push({ text: input.text, context: input.context });
      if (options.failOn?.(input.text)) {
        throw new EngineError("invalid-text", "stub engine refused this cell");
      }
      counter += 1;
      const word = input.text.slice(0, 4);
      return {
        result: {
          original: input.text,
          processed: input.text,
          entities: [
            {
              type: "NOMBRE",
              text: word,
              original: word,
              position: { start: 0, end: word.length },
              confidence: 0.9,
              transformed: `SUST_${counter}`,
            },
          ],
          alerts: [],
          stats: { totalEntities: 1, byType: {} },
          sessionId: `stub-session-${counter}`,
          processingTime: 0,
        },
        context: {
          mode: "shared" as const,
          pseudonymState: {
            asignaciones: [[`k${counter}`, `v${counter}`]] as readonly (readonly [
              string,
              string,
            ])[],
            profesionales: [],
            familiares: [],
            contadorProfesionales: counter,
            contadorFamiliares: 0,
            contadorPacientes: counter,
          },
        },
      };
    },
  };
}

describe("WU-C — free-text cell enumeration is deterministic row-major, blanks excluded", () => {
  it("enumerates non-blank process-as-text cells row by row, skipping blanks", () => {
    const cells = enumerateFreeTextCells(configured());
    // Row 0: Notas + CP; row 1: CP only (Notas blank); row 2: Notas only (CP blank).
    expect(cells.map((cell) => [cell.columnIndex, cell.rowIndex])).toEqual([
      [1, 0],
      [2, 0],
      [2, 1],
      [1, 2],
    ]);
    expect(cells[0].header).toBe("Notas");
    expect(cells[0].original).toBe("nota clinica uno");
    // Identifier/keep columns never enumerate.
    expect(cells.every((cell) => cell.header === "Notas" || cell.header === "CP")).toBe(true);
  });

  it("enumerates nothing when no column routes process-as-text", () => {
    expect(enumerateFreeTextCells(createStructuredConfiguration(GRID))).toEqual([]);
  });
});

describe("WU-C — shared REC-02 ProcessingContext is carried across cells in order", () => {
  it("starts from the REC-02 initial context and promotes successes to shared", async () => {
    const engine = stubEngine();
    const state = await processStructuredFreeTextCells({
      jobId: "job-wuc",
      jobName: "wuc-job",
      policyId: "standard",
      configuration: configured(),
      engine,
    });
    expect(state.policyId).toBe("standard");
    expect(state.jobId).toBe("job-wuc");
    // Row-major order of engine calls.
    expect(engine.calls.map((call) => call.text)).toEqual([
      "nota clinica uno",
      "texto cp uno",
      "texto cp dos",
      "nota clinica tres",
    ]);
    // The first cell starts from the REC-02 policy-owned initial context.
    expect(engine.calls[0].context).toEqual(
      createInitialProcessingContext({ id: "job-wuc" }, "standard")
    );
    // Every later cell runs shared, carrying the previous outcome's context.
    for (const call of engine.calls.slice(1)) {
      expect(call.context.mode).toBe("shared");
      expect(call.context.pseudonymState).toBeDefined();
    }
    // Pseudonym counters continue instead of restarting (shared, not fresh).
    const counters = engine.calls
      .slice(1)
      .map((call) => call.context.pseudonymState?.contadorPacientes);
    expect(counters).toEqual([1, 2, 3]);
    // One session per non-blank cell; every session carries engine detections.
    expect(state.cells.length).toBe(4);
    expect(state.cells.every((cell) => cell.ok)).toBe(true);
  });

  it("a failed cell is a visible typed failure and contributes nothing to the carried context", async () => {
    const engine = stubEngine({ failOn: (text) => text === "texto cp uno" });
    const state = await processStructuredFreeTextCells({
      jobId: "job-wuc",
      jobName: "wuc-job",
      policyId: "standard",
      configuration: configured(),
      engine,
    });
    expect(state.cells.length).toBe(4);
    const failed = state.cells[1];
    expect(failed.ok).toBe(false);
    if (failed.ok) throw new Error("expected cell 1 to fail");
    expect(failed.failure.code).toBe("processing-failed");
    expect(failed.cell.original).toBe("texto cp uno");
    // The failure message is typed/engine-authored: never the raw cell text.
    expect(failed.failure.message).not.toContain("texto cp uno");
    // The next cell still runs, from the last SUCCESS context (counter 1), not the failure.
    expect(engine.calls[2].context.pseudonymState?.contadorPacientes).toBe(1);
    expect(state.cells.filter((cell) => cell.ok).length).toBe(3);
  });

  it("threads the job policyId to every engine call", async () => {
    const seen: (string | undefined)[] = [];
    const engine = stubEngine();
    const tracking = {
      calls: engine.calls,
      async process(input: RegistryEngineInput): Promise<EngineOutcome> {
        seen.push(input.policyId);
        return engine.process(input);
      },
    };
    await processStructuredFreeTextCells({
      jobId: "job-wuc",
      jobName: "wuc-job",
      policyId: "external-ai",
      configuration: configured(),
      engine: tracking,
    });
    expect(seen).toEqual(["external-ai", "external-ai", "external-ai", "external-ai"]);
  });
});

describe("WU-C — free-text cell set currency (stale config never certifies)", () => {
  it("detects a stale cell set after the configuration changes", async () => {
    const engine = stubEngine();
    const before = configured();
    const state: StructuredFreeTextState = await processStructuredFreeTextCells({
      jobId: "job-wuc",
      jobName: "wuc-job",
      policyId: "standard",
      configuration: before,
      engine,
    });
    expect(isFreeTextCellSetCurrent(before, state, "standard")).toBe(true);
    // Any action change alters the cell set: the stored state is stale.
    const after = overrideColumnAction(before, 2, "keep");
    expect(isFreeTextCellSetCurrent(after, state, "standard")).toBe(false);
  });
});
