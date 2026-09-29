import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useState } from "react";
import "@testing-library/jest-dom/vitest";

import {
  createStructuredConfiguration,
  overrideColumnClass,
  selectPatientIdColumn,
  type StructuredConfiguration,
} from "./configuration";
import type { ColumnClass } from "./classification";
import type { StructuredGrid } from "./grid";
import { StructuredConfigureWorkspace } from "./StructuredConfigureWorkspace";

/**
 * T20 #24 user-level oracles for the structured Configure workspace. The
 * component is driven around the REAL canonical configuration authority
 * (`configuration.ts`); every assertion derives from domain state, never from
 * private component internals. Fixtures are synthetic; no real PHI.
 */
const GRID: StructuredGrid = {
  headers: ["NHC", "Fecha_Nac", "Diagnostico", "CampoLibre"],
  rows: [
    ["00123", "1990-05-01", "Gripe A", "rotación de sala"],
    ["00456", "1985-11-23", "Fractura", "seguimiento"],
  ],
};

/** Test harness: holds the canonical configuration and exposes it for probing. */
function Harness(props: {
  initial: StructuredConfiguration;
  configRef: { current: StructuredConfiguration };
}): ReturnType<typeof StructuredConfigureWorkspace> {
  const { initial, configRef } = props;
  const [configuration, setConfiguration] = useState(initial);
  configRef.current = configuration;
  return (
    <StructuredConfigureWorkspace
      configuration={configuration}
      errorMessage={null}
      sheetNames={null}
      onSelectSheet={() => {}}
      onOverrideClass={(columnIndex: number, columnClass: ColumnClass) =>
        setConfiguration((current) => overrideColumnClass(current, columnIndex, columnClass))
      }
      onSelectPatientId={(header: string | null) =>
        setConfiguration((current) => selectPatientIdColumn(current, header))
      }
    />
  );
}

function renderHarness() {
  const configRef = { current: createStructuredConfiguration(GRID) };
  const view = render(<Harness initial={configRef.current} configRef={configRef} />);
  return { configRef, ...view };
}

function columnCard(header: string): HTMLElement {
  const heading = screen.getByRole("heading", { level: 4, name: header });
  const card = heading.closest("li");
  if (!card) throw new Error(`Could not find the card for column ${header}`);
  return card;
}

function overrideSelect(header: string): HTMLSelectElement {
  return screen.getByLabelText(`Reviewer classification for ${header}`) as HTMLSelectElement;
}

afterEach(cleanup);

describe("StructuredConfigureWorkspace — classification display from domain facts", () => {
  it("visibly classifies every column with the accepted class and action labels", () => {
    renderHarness();
    const list = screen.getByRole("list", { name: /column classification list/i });
    expect(list).toHaveTextContent("NHC");
    expect(list).toHaveTextContent("Fecha_Nac");
    expect(list).toHaveTextContent("Diagnostico");
    expect(list).toHaveTextContent("CampoLibre");

    // The effective class is the domain value on the controlled select.
    expect(overrideSelect("NHC")).toHaveValue("identifier");
    expect(overrideSelect("Fecha_Nac")).toHaveValue("quasi-identifier");
    expect(overrideSelect("Diagnostico")).toHaveValue("sensitive");
    expect(overrideSelect("CampoLibre")).toHaveValue("unknown");

    // Status/class are conveyed as text, never color alone.
    expect(within(columnCard("CampoLibre")).getAllByText("Review required").length).toBeGreaterThan(
      0
    );
    expect(within(columnCard("NHC")).getAllByText("Remove").length).toBeGreaterThan(0);
    expect(within(columnCard("Fecha_Nac")).getAllByText("Generalize").length).toBeGreaterThan(0);
    expect(within(columnCard("Diagnostico")).getAllByText("Codify").length).toBeGreaterThan(0);
  });

  it("shows confidence and evidence that correspond exactly to domain facts", () => {
    const { configRef } = renderHarness();
    const column = configRef.current.columns.find((candidate) => candidate.header === "CampoLibre");
    if (!column) throw new Error("missing fixture column");
    const card = columnCard("CampoLibre");
    expect(within(card).getByText(`${Math.round(column.confidence * 100)}%`)).toBeInTheDocument();
    expect(within(card).getByText(column.evidence[0])).toBeInTheDocument();
  });

  it("marks the resolved patient-ID column with a factual, text label", () => {
    const configRef = {
      current: selectPatientIdColumn(createStructuredConfiguration(GRID), "NHC"),
    };
    render(<Harness initial={configRef.current} configRef={configRef} />);
    expect(within(columnCard("NHC")).getByText(/single patient-ID authority/i)).toBeInTheDocument();
    expect(
      within(columnCard("CampoLibre")).queryByText(/single patient-ID authority/i)
    ).not.toBeInTheDocument();
  });
});

describe("StructuredConfigureWorkspace — Unknown review + export gate", () => {
  it("shows the fail-closed gate for an unknown column and NEVER defaults it to KEEP", () => {
    const { configRef } = renderHarness();
    const facts = screen.getByRole("status", { name: /structured configuration facts/i });
    expect(facts).toHaveTextContent("Columns requiring review: 1");
    expect(facts).toHaveTextContent("Structured export ready: No");
    expect(screen.getByRole("alert")).toHaveTextContent(/export is blocked/i);

    // The unknown column is not KEEP: the effective class stays unknown and
    // the canonical export gate stays closed.
    expect(overrideSelect("CampoLibre")).toHaveValue("unknown");
    expect(configRef.current.exportReady).toBe(false);
  });

  it("only an explicit human override resolves the gate and changes the canonical authority", () => {
    const { configRef } = renderHarness();
    const before = configRef.current;
    fireEvent.change(overrideSelect("CampoLibre"), { target: { value: "insensitive" } });

    // Canonical authority changed (not a label-only change): new object,
    // effective class insensitive, action keep, gate open.
    expect(configRef.current).not.toBe(before);
    const column = configRef.current.columns.find((candidate) => candidate.header === "CampoLibre");
    expect(column?.effectiveClass).toBe("insensitive");
    expect(column?.proposedAction).toBe("keep");
    expect(configRef.current.exportReady).toBe(true);

    const facts = screen.getByRole("status", { name: /structured configuration facts/i });
    expect(facts).toHaveTextContent("Columns requiring review: 0");
    expect(facts).toHaveTextContent("Structured export ready: Yes");
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });
});

describe("StructuredConfigureWorkspace — adversarial override invariants", () => {
  it("overriding one column never mutates another column's classification", () => {
    const { configRef } = renderHarness();
    fireEvent.change(overrideSelect("NHC"), { target: { value: "insensitive" } });

    expect(overrideSelect("CampoLibre")).toHaveValue("unknown");
    expect(overrideSelect("Diagnostico")).toHaveValue("sensitive");
    expect(configRef.current.columns.find((c) => c.header === "CampoLibre")?.effectiveClass).toBe(
      "unknown"
    );
    expect(configRef.current.exportReady).toBe(false);
  });

  it("an override is a canonical domain transition, not a text relabel", () => {
    const { configRef } = renderHarness();
    const before = configRef.current.columns.map((column) => column.effectiveClass);
    fireEvent.change(overrideSelect("Diagnostico"), { target: { value: "insensitive" } });
    const after = configRef.current.columns.map((column) => column.effectiveClass);
    expect(after).toEqual(["identifier", "quasi-identifier", "insensitive", "unknown"]);
    expect(after[0]).toBe(before[0]);
    expect(configRef.current.columns[2].proposedAction).toBe("keep");
  });

  it("re-rendering with the same domain state does not mutate classification/override", () => {
    const { configRef, rerender } = renderHarness();
    fireEvent.change(overrideSelect("CampoLibre"), { target: { value: "sensitive" } });
    const after = configRef.current;
    rerender(<Harness initial={configRef.current} configRef={configRef} />);
    expect(configRef.current).toBe(after);
    expect(overrideSelect("CampoLibre")).toHaveValue("sensitive");
  });
});

describe("StructuredConfigureWorkspace — single patient-ID authority (SPEC §6)", () => {
  it("shows the authority exactly once and routes the choice through the domain", () => {
    const { configRef } = renderHarness();
    expect(screen.getAllByRole("region", { name: /patient id authority/i })).toHaveLength(1);

    fireEvent.change(screen.getByLabelText("Patient ID column"), { target: { value: "NHC" } });
    expect(configRef.current.patientId).toEqual({
      status: "resolved",
      column: "NHC",
      columnIndex: 0,
    });

    // A class override never re-derives or displaces the patient-ID authority.
    fireEvent.change(overrideSelect("Diagnostico"), { target: { value: "insensitive" } });
    expect(configRef.current.patientId).toEqual({
      status: "resolved",
      column: "NHC",
      columnIndex: 0,
    });
  });
});

describe("StructuredConfigureWorkspace — keyboard, responsive and sheet selection", () => {
  it("exposes the override and patient-ID controls as keyboard-operable selects", () => {
    renderHarness();
    const override = overrideSelect("NHC");
    expect(override.tagName).toBe("SELECT");
    override.focus();
    expect(override).toHaveFocus();
    expect(override).toHaveClass("focus-visible:ring-2");
  });

  it("renders a responsive layout (stacked list on narrow screens)", () => {
    renderHarness();
    const list = screen.getByRole("list", { name: /column classification list/i });
    expect(list).toHaveClass("md:grid-cols-2");
  });

  it("requires an explicit worksheet choice for a multi-sheet workbook", () => {
    const onSelectSheet = vi.fn();
    render(
      <StructuredConfigureWorkspace
        configuration={null}
        errorMessage={null}
        sheetNames={["Portada", "DatosClinicos"]}
        onSelectSheet={onSelectSheet}
        onOverrideClass={() => {}}
        onSelectPatientId={() => {}}
      />
    );
    const select = screen.getByLabelText("Worksheet") as HTMLSelectElement;
    expect(select).toHaveValue("Portada");
    fireEvent.change(select, { target: { value: "DatosClinicos" } });
    fireEvent.click(screen.getByRole("button", { name: /load sheet/i }));
    expect(onSelectSheet).toHaveBeenCalledWith("DatosClinicos");
  });

  it("surfaces a typed intake error factually", () => {
    render(
      <StructuredConfigureWorkspace
        configuration={null}
        errorMessage="The CSV input is empty."
        sheetNames={null}
        onSelectSheet={() => {}}
        onOverrideClass={() => {}}
        onSelectPatientId={() => {}}
      />
    );
    expect(screen.getByRole("alert")).toHaveTextContent("The CSV input is empty.");
  });
});
