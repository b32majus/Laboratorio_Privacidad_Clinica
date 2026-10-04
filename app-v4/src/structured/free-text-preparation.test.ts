import { describe, expect, it } from "vitest";

import type { RegistryEngineInput } from "../engine/registry-engine";
import type { EngineOutcome } from "../engine/types";
import { EngineError } from "../engine/types";
import {
  applyDecision,
  canFinalize,
  getFinalText,
  type ReviewSession,
} from "../review/review-domain";
import {
  createStructuredConfiguration,
  overrideColumnAction,
  type StructuredConfiguration,
} from "./configuration";
import { processStructuredFreeTextCells } from "./free-text";
import type { StructuredGrid } from "./grid";
import { buildStructuredTransformPlan } from "./transform-plan";
import { prepareStructuredOutput, type StructuredOutputPreparation } from "./transformed-dataset";

/**
 * REC-03 WU-C preparation oracles (stub engine): the plan carries a
 * `free-text` disposition; Safe output reads canonical `getFinalText` only;
 * anything unreviewed/failed/stale blocks with exact reasons. Synthetic
 * fixtures only.
 */
const GRID: StructuredGrid = {
  headers: ["NHC", "Notas"],
  rows: [
    ["P-001", "Paciente Carmen Sánchez atendida el 12/03/2024"],
    ["P-002", ""],
    ["P-003", "Control de Carmen Sánchez el 20/03/2024"],
  ],
};

function configured(): StructuredConfiguration {
  return overrideColumnAction(createStructuredConfiguration(GRID), 1, "process-as-text");
}

function planFor(config: StructuredConfiguration, policyId: "standard" = "standard") {
  return buildStructuredTransformPlan(config, { policyId, jobSeed: "wuc-prep" });
}

function stubEngine() {
  let counter = 0;
  return {
    async process(input: RegistryEngineInput): Promise<EngineOutcome> {
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

async function processed(policyId: "standard" = "standard") {
  const config = configured();
  const state = await processStructuredFreeTextCells({
    jobId: "wuc-prep",
    jobName: "wuc-prep",
    policyId,
    configuration: config,
    engine: stubEngine(),
  });
  return { config, state };
}

function acceptAll(session: ReviewSession): ReviewSession {
  let next = session;
  for (const detection of session.detections) {
    next = applyDecision(next, detection.id, "accepted");
  }
  return next;
}

describe("WU-C — plan carries a free-text disposition (never keep/remove)", () => {
  it("maps process-as-text to a free-text disposition, not keep/remove/unsupported", () => {
    const plan = planFor(configured());
    expect(plan.columns.find((c) => c.header === "Notas")?.disposition).toEqual({
      kind: "free-text",
    });
    expect(plan.dispositionsReady).toBe(true);
  });
});

describe("WU-C — Safe output is gated on reviewed free-text sessions", () => {
  it("blocks when free-text cells were never processed (no bypass around review)", async () => {
    const config = configured();
    const preparation = prepareStructuredOutput(config, planFor(config));
    expect(preparation.status).toBe("blocked");
    if (preparation.status !== "blocked") return;
    expect(preparation.output).toBeNull();
    expect(preparation.reasons.join(" ")).toMatch(/free-text/i);
  });

  it("blocks while mandatory cell detections are unresolved", async () => {
    const { config, state } = await processed();
    const preparation = prepareStructuredOutput(config, planFor(config), { freeText: state });
    expect(preparation.status).toBe("blocked");
    if (preparation.status !== "blocked") return;
    expect(preparation.reasons.join(" ")).toMatch(/review/i);
  });

  it("after decisions, the Safe cell equals canonical getFinalText with no original identifiers", async () => {
    const { config, state } = await processed();
    const decided = {
      ...state,
      cells: state.cells.map((cell) =>
        cell.ok ? { ...cell, session: acceptAll(cell.session) } : cell
      ),
    };
    for (const cell of decided.cells) {
      if (cell.ok) expect(canFinalize(cell.session)).toBe(true);
    }
    const preparation: StructuredOutputPreparation = prepareStructuredOutput(
      config,
      planFor(config),
      { freeText: decided }
    );
    expect(preparation.status).toBe("ready");
    if (preparation.status !== "ready") return;
    const safeIndex = preparation.output.safe.headers.indexOf("Notas");
    const finals = decided.cells.map((cell) => (cell.ok ? getFinalText(cell.session) : "<failed>"));
    // Row 1's blank cell stays blank and created no session.
    expect(preparation.output.safe.rows.map((row) => row[safeIndex])).toEqual([
      finals[0],
      "",
      finals[1],
    ]);
    const safeJson = JSON.stringify(preparation.output.safe);
    expect(safeJson).not.toContain("Carmen Sánchez");
    // The blank cell stays blank and created no session.
    expect(decided.cells.length).toBe(2);
    expect(preparation.output.safe.rows[1][safeIndex]).toBe("");
  });

  it("carries original<->final free-text correspondence Confidential-only", async () => {
    const { config, state } = await processed();
    const decided = {
      ...state,
      cells: state.cells.map((cell) =>
        cell.ok ? { ...cell, session: acceptAll(cell.session) } : cell
      ),
    };
    const preparation = prepareStructuredOutput(config, planFor(config), { freeText: decided });
    expect(preparation.status).toBe("ready");
    if (preparation.status !== "ready") return;
    const column = preparation.output.confidential.columns.find((c) => c.header === "Notas");
    expect(column?.disposition).toBe("free-text");
    expect(column?.entries.length).toBe(2);
    for (const entry of column?.entries ?? []) {
      expect(entry.original).toContain("Carmen Sánchez");
      expect(entry.transformed).not.toContain("Carmen Sánchez");
    }
    expect(JSON.stringify(preparation.output.safe)).not.toContain("Paciente Carmen");
  });
});

describe("WU-C — processing failure is visible and blocks without keeping the original", () => {
  it("one engine failure blocks Safe output and never keeps the raw cell", async () => {
    const config = configured();
    const failing = {
      async process(input: RegistryEngineInput): Promise<EngineOutcome> {
        if (input.text.includes("20/03/2024")) {
          throw new EngineError("invalid-text", "stub engine refused this cell");
        }
        return stubEngine().process(input);
      },
    };
    const state = await processStructuredFreeTextCells({
      jobId: "wuc-prep",
      jobName: "wuc-prep",
      policyId: "standard",
      configuration: config,
      engine: failing,
    });
    const preparation = prepareStructuredOutput(config, planFor(config), { freeText: state });
    expect(preparation.status).toBe("blocked");
    if (preparation.status !== "blocked") return;
    expect(preparation.output).toBeNull();
    expect(preparation.reasons.join(" ")).toMatch(/20\/03\/2024|row 3|failed/i);
    // Reasons never carry the raw cell text as a kept value.
    expect(preparation.reasons.join("\n")).not.toContain("Paciente Carmen");
  });
});

describe("WU-C — falsification oracle (c): review bypass / stale-policy state", () => {
  it("a planted bypass (Safe read from an unreviewed session) cannot produce output", async () => {
    const { config, state } = await processed();
    // The planted violation: a caller that tries to finalize Safe from the
    // raw unreviewed sessions hits the ReviewSession authority first.
    for (const cell of state.cells) {
      if (!cell.ok) continue;
      expect(canFinalize(cell.session)).toBe(false);
      expect(() => getFinalText(cell.session)).toThrow();
    }
    // And the preparation itself refuses the unreviewed state.
    expect(prepareStructuredOutput(config, planFor(config), { freeText: state }).status).toBe(
      "blocked"
    );
  });

  it("sessions processed under a stale policy cannot certify the new plan", async () => {
    const { config, state } = await processed("standard");
    const decided = {
      ...state,
      cells: state.cells.map((cell) =>
        cell.ok ? { ...cell, session: acceptAll(cell.session) } : cell
      ),
    };
    // Same finalized sessions, but the plan moved to another policy.
    const stale = prepareStructuredOutput(
      config,
      buildStructuredTransformPlan(config, { policyId: "strict", jobSeed: "wuc-prep" }),
      { freeText: decided }
    );
    expect(stale.status).toBe("blocked");
    if (stale.status !== "blocked") return;
    expect(stale.reasons.join(" ")).toMatch(/polic/i);
  });
});
