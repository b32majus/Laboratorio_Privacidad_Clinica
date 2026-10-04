import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useState } from "react";
import "@testing-library/jest-dom/vitest";

import {
  createStructuredConfiguration,
  overrideColumnAction,
  overrideColumnClass,
  selectPatientIdColumn,
  type StructuredAction,
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
      onOverrideAction={(columnIndex: number, action: StructuredAction) =>
        setConfiguration((current) => overrideColumnAction(current, columnIndex, action))
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

function actionSelect(header: string): HTMLSelectElement | null {
  return screen.queryByLabelText(`Reviewer action for ${header}`) as HTMLSelectElement | null;
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

    // Status/class/action are conveyed as text, never color alone.
    expect(within(columnCard("CampoLibre")).getAllByText("Review required").length).toBeGreaterThan(
      0
    );
    expect(within(columnCard("NHC")).getAllByText("Remove").length).toBeGreaterThan(0);
    // D-021: an unresolved quasi-identifier is Review required (no generic
    // Generalize dead end); Sensitive defaults to Keep (no Codify action).
    expect(within(columnCard("Fecha_Nac")).getAllByText("Review required").length).toBeGreaterThan(
      0
    );
    expect(within(columnCard("Diagnostico")).getAllByText("Keep").length).toBeGreaterThan(0);
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
  it("shows the fail-closed gate for review-required columns and NEVER defaults them to KEEP", () => {
    const { configRef } = renderHarness();
    const facts = screen.getByRole("status", { name: /structured configuration facts/i });
    // D-021: CampoLibre (unknown) AND Fecha_Nac (unresolved quasi) require review.
    expect(facts).toHaveTextContent("Columns requiring review: 2");
    expect(facts).toHaveTextContent("Structured export ready: No");
    expect(screen.getByRole("alert")).toHaveTextContent(/export is blocked/i);

    // Neither review-required column is KEEP: the effective classes stay put
    // and the canonical export gate stays closed.
    expect(overrideSelect("CampoLibre")).toHaveValue("unknown");
    expect(overrideSelect("Fecha_Nac")).toHaveValue("quasi-identifier");
    expect(configRef.current.exportReady).toBe(false);
  });

  it("only explicit human decisions resolve the gate and change the canonical authority", () => {
    const { configRef } = renderHarness();
    const before = configRef.current;
    fireEvent.change(overrideSelect("CampoLibre"), { target: { value: "insensitive" } });

    // One reviewer decision is not enough while the quasi column is unresolved.
    expect(configRef.current.exportReady).toBe(false);

    // A bounded explicit Action for the quasi column closes the gate together
    // with the class resolution: one canonical rebuild, never label-only.
    const fechaAction = actionSelect("Fecha_Nac");
    if (!fechaAction) throw new Error("expected the bounded Action control for Fecha_Nac");
    fireEvent.change(fechaAction, { target: { value: "keep" } });

    expect(configRef.current).not.toBe(before);
    const column = configRef.current.columns.find((candidate) => candidate.header === "CampoLibre");
    expect(column?.effectiveClass).toBe("insensitive");
    expect(column?.proposedAction).toBe("keep");
    expect(column?.effectiveAction).toBe("keep");
    expect(configRef.current.columns.find((c) => c.header === "Fecha_Nac")?.effectiveAction).toBe(
      "keep"
    );
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

describe("StructuredConfigureWorkspace — bounded Action control (REC-03 WU-B, D-021)", () => {
  it("offers exactly the bounded Action choices for a non-date quasi-identifier", () => {
    const { configRef } = renderHarness();
    const select = actionSelect("Fecha_Nac");
    if (!select) throw new Error("expected the bounded Action control for Fecha_Nac");
    expect(select.tagName).toBe("SELECT");
    const options = Array.from(select.querySelectorAll("option")).map((option) => option.value);
    expect(options).toEqual(["review-required", "pseudonymize", "keep"]);
    expect(select).toHaveValue("review-required");

    fireEvent.change(select, { target: { value: "pseudonymize" } });
    expect(configRef.current.columns.find((c) => c.header === "Fecha_Nac")?.effectiveAction).toBe(
      "pseudonymize"
    );
    expect(select).toHaveValue("pseudonymize");
  });

  it("renders no Action editor for derived single-option columns, only the Action fact", () => {
    renderHarness();
    // Identifier->Remove: the Action is a visible fact, not a choice.
    expect(actionSelect("NHC")).toBeNull();
    expect(within(columnCard("NHC")).getByText("Action:").nextElementSibling).toHaveTextContent(
      "Remove"
    );
    // REC-03 WU-C (D-021 free-text columns): a text-like Sensitive column
    // offers exactly the bounded Keep / Process-as-text choice.
    const sensitiveSelect = actionSelect("Diagnostico");
    if (!sensitiveSelect) throw new Error("expected the bounded Action control for Diagnostico");
    expect(
      Array.from(sensitiveSelect.querySelectorAll("option")).map((option) => option.value)
    ).toEqual(["keep", "process-as-text"]);
    expect(
      within(columnCard("Diagnostico")).getByText("Action:").nextElementSibling
    ).toHaveTextContent("Keep");
    // Unknown explains the resolution path instead of offering Keep directly;
    // a text-like Unknown additionally offers the explicit Process-as-text path.
    const unknownSelect = actionSelect("CampoLibre");
    if (!unknownSelect) throw new Error("expected the bounded Action control for CampoLibre");
    expect(
      Array.from(unknownSelect.querySelectorAll("option")).map((option) => option.value)
    ).toEqual(["review-required", "process-as-text"]);
    expect(
      within(columnCard("CampoLibre")).getByText(/cannot be kept directly/i)
    ).toBeInTheDocument();
  });

  it("locks the Action of the patient-ID column with derived text and no contradicting choice", () => {
    const configRef = {
      current: selectPatientIdColumn(createStructuredConfiguration(GRID), "NHC"),
    };
    render(<Harness initial={configRef.current} configRef={configRef} />);
    expect(actionSelect("NHC")).toBeNull();
    const card = columnCard("NHC");
    expect(within(card).getByText("Action:").nextElementSibling).toHaveTextContent(
      "Study ID (derived, locked)"
    );
    expect(
      within(card).getByText(/the patient-ID authority derives Study ID/i)
    ).toBeInTheDocument();
  });

  it("exposes the Action control as a keyboard-operable select with visible focus", () => {
    renderHarness();
    const select = actionSelect("Fecha_Nac");
    if (!select) throw new Error("expected the bounded Action control for Fecha_Nac");
    select.focus();
    expect(select).toHaveFocus();
    expect(select).toHaveClass("focus-visible:ring-2");
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

describe("StructuredConfigureWorkspace — progressive disclosure keeps authority visible (outcome F)", () => {
  /** The `<dd>` value paired with a `<dt>` label in the same definition list. */
  function dlValue(card: HTMLElement, label: string): HTMLElement {
    const dt = within(card).getByText(label, { selector: "dt" });
    const dd = dt.nextElementSibling;
    if (!dd || dd.tagName !== "DD") throw new Error(`No <dd> for ${label}`);
    return dd as HTMLElement;
  }

  it("keeps effective classification, current date role and UNKNOWN review-required facts outside the disclosure", () => {
    renderHarness();
    const card = columnCard("CampoLibre");

    const classification = dlValue(card, "Classification:");
    expect(classification).toHaveTextContent("Unknown");
    expect(classification.closest("details")).toBeNull();

    const dateRole = dlValue(card, "Date role:");
    expect(dateRole.closest("details")).toBeNull();

    // UNKNOWN / "Review required" stays immediately visible, not hidden behind disclosure.
    const reviewRequiredFacts = within(card).getAllByText("Review required");
    expect(reviewRequiredFacts.some((element) => element.closest("details") === null)).toBe(true);

    // The classification override control stays immediately reachable.
    expect(overrideSelect("CampoLibre").closest("details")).toBeNull();
  });

  it("keeps the reviewer-override marker on the effective classification outside the disclosure", () => {
    renderHarness();
    fireEvent.change(overrideSelect("CampoLibre"), { target: { value: "sensitive" } });
    const classification = dlValue(columnCard("CampoLibre"), "Classification:");
    expect(classification).toHaveTextContent("Sensitive (reviewer override)");
    expect(classification.closest("details")).toBeNull();
  });

  it("groups secondary per-column evidence inside a keyboard-operable native disclosure", () => {
    renderHarness();
    const card = columnCard("CampoLibre");
    const details = card.querySelector("details");
    expect(details).not.toBeNull();
    const disclosure = details as HTMLElement;
    expect(disclosure.tagName).toBe("DETAILS");

    // Detected class, proposed action, inferred type, confidence and counts are
    // secondary facts: reduced all-at-once density, still in the DOM.
    for (const label of [
      "Detected class:",
      "Proposed action:",
      "Inferred type:",
      "Confidence:",
      "Non-empty values:",
    ]) {
      const dt = within(disclosure).getByText(label, { selector: "dt" });
      expect(dt.closest("details")).toBe(disclosure);
    }

    const summary = within(disclosure).getByText(/evidence and detected details/i);
    expect(summary.tagName).toBe("SUMMARY");
    summary.focus();
    expect(summary).toHaveFocus();
    expect(summary).toHaveClass("focus-visible:ring-2");
  });
});
