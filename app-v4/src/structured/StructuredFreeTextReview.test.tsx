import { fireEvent, render, screen, within, cleanup } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import "@testing-library/jest-dom/vitest";

afterEach(() => cleanup());

import { createReviewSession } from "../../../js/domain/review-session.js";
import type { ReviewSession } from "../review/review-domain";
import type { StructuredFreeTextState } from "./free-text";
import { StructuredFreeTextReview } from "./StructuredFreeTextReview";
import { createStructuredConfiguration, overrideColumnAction } from "./configuration";
import type { StructuredGrid } from "./grid";
import { buildStructuredTransformPlan } from "./transform-plan";
import { prepareStructuredOutput } from "./transformed-dataset";

/**
 * REC-03 WU-C composed Review oracles: the Review step shows a bounded cell
 * queue (which column/row is under review, without session internals) and
 * reuses ReviewWorkspace semantics for the active cell. Synthetic only.
 */
const GRID: StructuredGrid = {
  headers: ["NHC", "Notas"],
  rows: [
    ["P-001", "Nota de Carmen Sánchez"],
    ["P-002", ""],
    ["P-003", "Seguimiento de Carmen Sánchez"],
  ],
};

function sessionFor(text: string, proposed: string): ReviewSession {
  const name = "Carmen Sánchez";
  const start = text.indexOf(name);
  return createReviewSession({
    originalText: text,
    detections: [{ type: "NOMBRE", start, end: start + name.length, confidence: 0.9, proposed }],
    sessionId: `test-${proposed}`,
  }) as ReviewSession;
}

function fixture(): {
  state: StructuredFreeTextState;
  configuration: ReturnType<typeof createStructuredConfiguration>;
} {
  const configuration = overrideColumnAction(
    createStructuredConfiguration(GRID),
    1,
    "process-as-text"
  );
  const state: StructuredFreeTextState = Object.freeze({
    kind: "structured-free-text-state" as const,
    jobId: "job-ui",
    policyId: "standard" as const,
    cells: Object.freeze([
      Object.freeze({
        ok: true as const,
        cell: Object.freeze({
          columnIndex: 1,
          rowIndex: 0,
          header: "Notas",
          original: "Nota de Carmen Sánchez",
        }),
        session: sessionFor("Nota de Carmen Sánchez", "PACIENTE_1"),
      }),
      Object.freeze({
        ok: false as const,
        cell: Object.freeze({
          columnIndex: 1,
          rowIndex: 2,
          header: "Notas",
          original: "Seguimiento de Carmen Sánchez",
        }),
        failure: { code: "processing-failed" as const, message: "stub engine refused this cell" },
      }),
    ]),
  });
  return { state, configuration };
}

function renderReview(activeCell: number | null) {
  const { state, configuration } = fixture();
  const plan = buildStructuredTransformPlan(configuration, {
    policyId: "standard",
    jobSeed: "job-ui",
  });
  const preparation = prepareStructuredOutput(configuration, plan, { freeText: state });
  const handlers = {
    onRun: vi.fn(async () => null),
    onSelectCell: vi.fn(),
    onDecide: vi.fn(),
    onAddManual: vi.fn(),
    onGoToStep: vi.fn(),
  };
  render(
    <StructuredFreeTextReview
      configuration={configuration}
      preparation={preparation}
      freeText={state}
      activeCell={activeCell}
      runError={null}
      {...handlers}
    />
  );
  return handlers;
}

describe("StructuredFreeTextReview — bounded cell queue", () => {
  it("names every cell by column and row with a text status (no session internals)", () => {
    renderReview(0);
    const queue = screen.getByRole("navigation", { name: "Free-text cells" });
    expect(within(queue).getByText("Notas, row 1")).toBeInTheDocument();
    expect(within(queue).getByText("Notas, row 3")).toBeInTheDocument();
    // The failed cell is visible with its typed message (queue + gate reason).
    expect(screen.getAllByText(/stub engine refused this cell/).length).toBeGreaterThanOrEqual(1);
    // The pending cell names its pending count as text.
    expect(screen.getAllByText(/1 pending decision/i).length).toBeGreaterThanOrEqual(1);
  });

  it("selecting a queue cell navigates without touching review state", () => {
    const handlers = renderReview(0);
    const queue = screen.getByRole("navigation", { name: "Free-text cells" });
    fireEvent.click(within(queue).getByRole("button", { name: /Notas, row 3/i }));
    expect(handlers.onSelectCell).toHaveBeenCalledWith(1);
    expect(handlers.onDecide).not.toHaveBeenCalled();
  });

  it("the active cell reuses the review workspace for its session", () => {
    renderReview(0);
    // The active cell's session content is reviewed in place.
    expect(screen.getByText("Reviewing Notas, row 1")).toBeInTheDocument();
    expect(screen.getByRole("region", { name: "Review workspace" })).toBeInTheDocument();
    const detectionList = screen.getByRole("region", { name: "Detection list" });
    expect(within(detectionList).getByRole("button", { name: /NOMBRE/ })).toBeInTheDocument();
  });

  it("offers an explicit process run when no state exists yet", () => {
    const { configuration } = fixture();
    const plan = buildStructuredTransformPlan(configuration, {
      policyId: "standard",
      jobSeed: "job-ui",
    });
    const preparation = prepareStructuredOutput(configuration, plan);
    const onRun = vi.fn(async () => null);
    render(
      <StructuredFreeTextReview
        configuration={configuration}
        preparation={preparation}
        freeText={null}
        activeCell={null}
        runError={null}
        onRun={onRun}
        onSelectCell={vi.fn()}
        onDecide={vi.fn()}
        onAddManual={vi.fn()}
        onGoToStep={vi.fn()}
      />
    );
    const run = screen.getByRole("button", { name: /process free-text cells/i });
    fireEvent.click(run);
    expect(onRun).toHaveBeenCalledTimes(1);
  });
});
