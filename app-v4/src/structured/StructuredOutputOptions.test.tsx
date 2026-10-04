import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import "@testing-library/jest-dom/vitest";

import { createStructuredConfiguration, overrideColumnClass } from "./configuration";
import type { StructuredGrid } from "./grid";
import { StructuredConfigureWorkspace } from "./StructuredConfigureWorkspace";
import { deriveStructuredSummary } from "./transformed-dataset";

/**
 * REC-04 WU-B UI oracles: the bounded "Output options" area lives inside the
 * existing Configure surface (no new route), shows only relevant controls,
 * and carries the factual summary as descriptive counts — never scores,
 * chronology or certification. Synthetic fixtures only.
 */
const GRID: StructuredGrid = {
  headers: ["NHC", "Nota"],
  rows: [
    ["P-001", "nota a"],
    ["P-001", "nota b"],
    ["P-002", "nota c"],
  ],
};

function configured() {
  let config = createStructuredConfiguration(GRID, { selectedPatientIdColumn: "NHC" });
  config = overrideColumnClass(config, 1, "insensitive");
  return config;
}

function baseProps() {
  return {
    configuration: configured(),
    onSelectSheet: () => {},
    onOverrideClass: () => {},
    onSelectPatientId: () => {},
  };
}

describe("StructuredConfigureWorkspace — output options and factual summary", () => {
  afterEach(() => {
    cleanup();
  });
  it("renders no output-options section without the prop (backward compatible)", () => {
    render(<StructuredConfigureWorkspace {...baseProps()} />);
    expect(screen.queryByLabelText(/study-ID prefix/i)).toBeNull();
    expect(screen.queryByText(/output options/i)).toBeNull();
  });

  it("edits the Study-ID prefix through the domain callback, never locally", () => {
    const onPrefixChange = vi.fn();
    render(
      <StructuredConfigureWorkspace
        {...baseProps()}
        outputOptions={{
          prefix: "PAC",
          prefixResolution: null,
          prefixInvalid: null,
          addVisitNumber: true,
          visitAvailable: true,
          summary: deriveStructuredSummary(configured()),
          onPrefixChange,
          onToggleVisitNumber: () => {},
        }}
      />
    );
    const input = screen.getByLabelText(/study-ID prefix/i);
    expect(input).toHaveValue("PAC");
    fireEvent.change(input, { target: { value: "hs1" } });
    // The control is controlled: every keystroke goes out through the domain
    // bridge, which owns the canonical value.
    expect(onPrefixChange).toHaveBeenCalledWith("hs1");
  });

  it("surfaces an invalid prefix as an explicit typed refusal, not a silent fallback", () => {
    render(
      <StructuredConfigureWorkspace
        {...baseProps()}
        outputOptions={{
          prefix: "=CMD",
          prefixResolution: {
            status: "invalid",
            reason:
              'Structured output option "study-ID prefix" is invalid: "=CMD" must start with a letter.',
          },
          prefixInvalid:
            'Structured output option "study-ID prefix" is invalid: "=CMD" must start with a letter.',
          addVisitNumber: true,
          visitAvailable: true,
          summary: deriveStructuredSummary(configured()),
          onPrefixChange: () => {},
          onToggleVisitNumber: () => {},
        }}
      />
    );
    const alert = screen.getByRole("alert", { name: /study-ID prefix/i });
    expect(alert.textContent).toMatch(/invalid/);
  });

  it("toggles visit numbering explicitly and explains unavailability without a patient authority", () => {
    const onToggleVisitNumber = vi.fn();
    const { rerender } = render(
      <StructuredConfigureWorkspace
        {...baseProps()}
        outputOptions={{
          prefix: "PAC",
          prefixResolution: null,
          prefixInvalid: null,
          addVisitNumber: true,
          visitAvailable: true,
          summary: deriveStructuredSummary(configured()),
          onPrefixChange: () => {},
          onToggleVisitNumber,
        }}
      />
    );
    const checkbox = screen.getByLabelText(/visit numbering/i);
    expect(checkbox).toBeChecked();
    fireEvent.click(checkbox);
    expect(onToggleVisitNumber).toHaveBeenCalledWith(false);

    rerender(
      <StructuredConfigureWorkspace
        {...baseProps()}
        outputOptions={{
          prefix: "PAC",
          prefixResolution: null,
          prefixInvalid: null,
          addVisitNumber: false,
          visitAvailable: false,
          summary: { rowCount: 3, patient: null },
          onPrefixChange: () => {},
          onToggleVisitNumber,
        }}
      />
    );
    expect(screen.getByLabelText(/visit numbering/i)).toBeDisabled();
    expect(screen.getByText(/patient-ID column is selected/i)).toBeDefined();
  });

  it("shows factual counts — and unavailability, never guesses — for patient facts", () => {
    const { rerender } = render(
      <StructuredConfigureWorkspace
        {...baseProps()}
        outputOptions={{
          prefix: "PAC",
          prefixResolution: null,
          prefixInvalid: null,
          addVisitNumber: true,
          visitAvailable: true,
          summary: deriveStructuredSummary(configured()),
          onPrefixChange: () => {},
          onToggleVisitNumber: () => {},
        }}
      />
    );
    const facts = screen.getByRole("status", { name: /structured output facts/i });
    expect(facts.textContent).toMatch(/3/);
    expect(facts.textContent).toMatch(/2/);
    expect(facts.textContent).not.toMatch(/risk|score|chronolog|certif|anonym/i);

    rerender(
      <StructuredConfigureWorkspace
        {...baseProps()}
        outputOptions={{
          prefix: "PAC",
          prefixResolution: null,
          prefixInvalid: null,
          addVisitNumber: false,
          visitAvailable: false,
          summary: { rowCount: 3, patient: null },
          onPrefixChange: () => {},
          onToggleVisitNumber: () => {},
        }}
      />
    );
    const unavailable = screen.getByRole("status", { name: /structured output facts/i });
    expect(unavailable.textContent).toMatch(/unavailable/i);
  });
});
