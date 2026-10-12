import { fireEvent, render, screen, within, cleanup } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useState } from "react";
import "@testing-library/jest-dom/vitest";

afterEach(() => {
  window.getSelection()?.removeAllRanges();
  cleanup();
});

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
    onSelectFreeTextCell: vi.fn(),
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
  it("revokes drafts and keyboard target on a cell change even when IDs and source text repeat", () => {
    const { state, configuration } = fixture();
    const first = state.cells[0];
    if (!first.ok) throw new Error("Expected synthetic session");
    const secondSession = sessionFor(first.cell.original, "PACIENTE_1");
    expect(secondSession.detections[0].id).toBe(first.session.detections[0].id);
    const current: StructuredFreeTextState = {
      ...state,
      cells: [first, { ok: true, cell: state.cells[1].cell, session: secondSession }],
    };
    const plan = buildStructuredTransformPlan(configuration, {
      policyId: "standard",
      jobSeed: state.jobId,
    });
    const preparation = prepareStructuredOutput(configuration, plan, { freeText: current });
    const props = {
      configuration,
      preparation,
      freeText: current,
      runError: null,
      onRun: vi.fn(async () => null),
      onSelectFreeTextCell: vi.fn(),
      onDecide: vi.fn(),
      onAddManual: vi.fn(),
      onGoToStep: vi.fn(),
    };
    const view = render(<StructuredFreeTextReview {...props} activeCell={0} />);
    fireEvent.change(screen.getByLabelText("Sustitución"), { target: { value: "CELDA A" } });
    fireEvent.change(screen.getByLabelText("Nota (opcional)"), { target: { value: "NOTA A" } });
    const inspector = screen.getByRole("complementary", { name: "Inspector del hallazgo" });
    inspector.focus();
    view.rerender(<StructuredFreeTextReview {...props} activeCell={1} />);
    expect(screen.getByLabelText("Sustitución")).toHaveValue("");
    expect(screen.getByLabelText("Nota (opcional)")).toHaveValue("");
    expect(inspector).not.toHaveFocus();
    fireEvent.keyDown(inspector, { key: "a" });
    expect(props.onDecide).not.toHaveBeenCalled();
    view.rerender(<StructuredFreeTextReview {...props} activeCell={0} />);
    expect(screen.getByLabelText("Nota (opcional)")).toHaveValue("");
    expect(first.session.decisions).toEqual({});
    expect(secondSession.decisions).toEqual({});
  });
  it.each(["keep-original", "manual"])(
    "invalidates %s intent when the active structured cell switches",
    (mode) => {
      const { state, configuration } = fixture();
      const first = state.cells[0];
      if (!first.ok) throw new Error("Expected synthetic session");
      const secondSession = sessionFor("Seguimiento de Carmen Sánchez", "PACIENTE_2");
      const current: StructuredFreeTextState = {
        ...state,
        cells: [
          first,
          {
            ok: true,
            cell: state.cells[1].cell,
            session: secondSession,
          },
        ],
      };
      const plan = buildStructuredTransformPlan(configuration, {
        policyId: "standard",
        jobSeed: state.jobId,
      });
      const preparation = prepareStructuredOutput(configuration, plan, { freeText: current });
      const onDecide = vi.fn();
      const onAddManual = vi.fn();
      function ContextHarness() {
        const [activeCell, setActiveCell] = useState<number | null>(0);
        return (
          <StructuredFreeTextReview
            configuration={configuration}
            preparation={preparation}
            freeText={current}
            activeCell={activeCell}
            runError={null}
            onRun={vi.fn(async () => null)}
            onSelectFreeTextCell={setActiveCell}
            onDecide={onDecide}
            onAddManual={onAddManual}
            onGoToStep={vi.fn()}
          />
        );
      }
      render(<ContextHarness />);
      fireEvent.click(
        within(screen.getByRole("list", { name: "Hallazgos" })).getAllByRole("button")[0]
      );
      if (mode === "manual") {
        const range = document.createRange();
        range.selectNodeContents(
          screen.getByRole("group", { name: "Texto del documento con hallazgos" }).firstChild!
        );
        window.getSelection()?.addRange(range);
        fireEvent.click(screen.getByRole("button", { name: "Marcar dato no detectado" }));
        fireEvent.change(screen.getByLabelText("Tipo de dato"), {
          target: { value: "Dato de celda anterior" },
        });
      } else fireEvent.click(screen.getByRole("button", { name: /^Conservar original$/ }));
      const confirmName = mode === "manual" ? "Añadir dato marcado" : "Sí, conservar original";
      const oldConfirm = screen.getByRole("button", { name: confirmName });
      fireEvent.click(screen.getByRole("button", { name: /Notas, fila 3/ }));
      expect(screen.queryByRole("button", { name: confirmName })).not.toBeInTheDocument();
      fireEvent.click(oldConfirm);
      fireEvent.click(screen.getByRole("button", { name: /Notas, fila 1/ }));
      expect(screen.queryByRole("button", { name: confirmName })).not.toBeInTheDocument();
      expect(onDecide).not.toHaveBeenCalled();
      expect(onAddManual).not.toHaveBeenCalled();
      expect(first.session.decisions).toEqual({});
      expect(secondSession.decisions).toEqual({});
    }
  );
  it("names every cell by column and row with a text status (no session internals)", () => {
    renderReview(0);
    const queue = screen.getByRole("navigation", { name: "Celdas de texto libre" });
    expect(within(queue).getByText("Notas, fila 1")).toBeInTheDocument();
    expect(within(queue).getByText("Notas, fila 3")).toBeInTheDocument();
    // The failed cell is visible with its typed message (queue + gate reason).
    expect(screen.getAllByText(/stub engine refused this cell/).length).toBeGreaterThanOrEqual(1);
    // The pending cell names its pending count as text.
    expect(screen.getAllByText(/1 decisión pendiente/i).length).toBeGreaterThanOrEqual(1);
  });

  it("selecting a queue cell navigates without touching review state", () => {
    const handlers = renderReview(0);
    const queue = screen.getByRole("navigation", { name: "Celdas de texto libre" });
    fireEvent.click(within(queue).getByRole("button", { name: /Notas, fila 3/i }));
    expect(handlers.onSelectFreeTextCell).toHaveBeenCalledWith(1);
    expect(handlers.onDecide).not.toHaveBeenCalled();
  });

  it("the active cell reuses the review workspace for its session", () => {
    renderReview(0);
    // The active cell's session content is reviewed in place.
    expect(screen.getByText("Revisando Notas, fila 1")).toBeInTheDocument();
    expect(screen.getByRole("region", { name: "Espacio de revisión" })).toBeInTheDocument();
    const detectionList = screen.getByRole("region", { name: "Lista de hallazgos" });
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
        onSelectFreeTextCell={vi.fn()}
        onDecide={vi.fn()}
        onAddManual={vi.fn()}
        onGoToStep={vi.fn()}
      />
    );
    const run = screen.getByRole("button", { name: /procesar celdas de texto libre/i });
    fireEvent.click(run);
    expect(onRun).toHaveBeenCalledTimes(1);
  });
});
