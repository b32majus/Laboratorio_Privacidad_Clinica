import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useState } from "react";
import "@testing-library/jest-dom/vitest";

import {
  createStructuredConfiguration,
  overrideColumnAction,
  overrideColumnClass,
  selectPatientIdColumn,
  setStructuredDateRole,
  type StructuredAction,
  type StructuredConfiguration,
} from "./configuration";
import type { ColumnClass } from "./classification";
import type { StructuredGrid } from "./grid";
import { StructuredConfigureWorkspace } from "./StructuredConfigureWorkspace";

/**
 * T20 #24 user-level oracles for the structured comparative Configure
 * workspace (issue #85). The component is driven around the REAL canonical
 * configuration authority (`configuration.ts`); every assertion derives from
 * domain state, never from private component internals. Fixtures are
 * synthetic; no real PHI.
 */
const GRID: StructuredGrid = {
  headers: ["NHC", "Fecha_Nac", "Diagnostico", "CampoLibre"],
  rows: [
    ["00123", "1990-05-01", "Gripe A", "rotación de sala"],
    ["00456", "1985-11-23", "Fractura", "seguimiento"],
  ],
};

type HarnessCallbacks = {
  onSetDateRole?: boolean;
};

/** Test harness: holds the canonical configuration and exposes it for probing. */
function Harness(props: {
  initial: StructuredConfiguration;
  configRef: { current: StructuredConfiguration };
  callbacks?: HarnessCallbacks;
}): ReturnType<typeof StructuredConfigureWorkspace> {
  const { initial, configRef, callbacks } = props;
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
      onSetDateRole={
        callbacks?.onSetDateRole
          ? (columnIndex: number, role: Parameters<typeof setStructuredDateRole>[2]) =>
              setConfiguration((current) => setStructuredDateRole(current, columnIndex, role))
          : undefined
      }
    />
  );
}

function renderHarness(callbacks?: HarnessCallbacks) {
  const configRef = { current: createStructuredConfiguration(GRID) };
  const view = render(
    <Harness initial={configRef.current} configRef={configRef} callbacks={callbacks} />
  );
  return { configRef, ...view };
}

function comparisonTable(): HTMLElement {
  return screen.getByRole("table", { name: /lista de clasificación de columnas/i });
}

/** The comparison row for one column header, found through its select button. */
function columnRow(header: string): HTMLElement {
  const button = within(comparisonTable()).getByRole("button", { name: header });
  const row = button.closest("tr");
  if (!row) throw new Error(`Could not find the comparison row for column ${header}`);
  return row;
}

/** Select a row (transient UI selection) so its inspector controls render. */
function selectColumn(header: string): void {
  fireEvent.click(within(comparisonTable()).getByRole("button", { name: header }));
}

function inspector(): HTMLElement {
  return screen.getByRole("complementary", { name: /inspector de columna/i });
}

function overrideSelect(header: string): HTMLSelectElement {
  selectColumn(header);
  return screen.getByLabelText(`Clasificación del revisor para ${header}`) as HTMLSelectElement;
}

function actionSelect(header: string): HTMLSelectElement | null {
  const select = screen.queryByLabelText(`Acción del revisor para ${header}`);
  return select as HTMLSelectElement | null;
}

afterEach(cleanup);

describe("StructuredConfigureWorkspace — comparative four-field display from domain facts", () => {
  it("shows the four approved factual fields for every column without any disclosure", () => {
    renderHarness();
    const table = comparisonTable();
    // Every column appears in source order, one comparative table.
    expect(table).toHaveTextContent("NHC");
    expect(table).toHaveTextContent("Fecha_Nac");
    expect(table).toHaveTextContent("Diagnostico");
    expect(table).toHaveTextContent("CampoLibre");

    // Field 2 — Clasificación vigente; field 3 — Tratamiento efectivo;
    // field 4 — Estado / acción pendiente (fail-closed markers as text).
    expect(within(columnRow("NHC")).getByText("Identificador")).toBeInTheDocument();
    expect(within(columnRow("NHC")).getByText("Eliminar")).toBeInTheDocument();
    expect(within(columnRow("Fecha_Nac")).getByText("Cuasi-identificador")).toBeInTheDocument();
    // "Requiere revisión" appears as the effective Action AND the pending
    // state; both facts stay visible as text.
    expect(within(columnRow("Fecha_Nac")).getAllByText("Requiere revisión").length).toBeGreaterThan(
      0
    );
    expect(within(columnRow("Diagnostico")).getByText("Sensible")).toBeInTheDocument();
    expect(within(columnRow("Diagnostico")).getByText("Conservar")).toBeInTheDocument();
    expect(within(columnRow("CampoLibre")).getByText("Desconocido")).toBeInTheDocument();
    expect(
      within(columnRow("CampoLibre")).getAllByText("Requiere revisión").length
    ).toBeGreaterThan(0);

    // A resolved row states the factual per-row state and never an
    // output-ready claim (that stays with the global gate facts).
    expect(within(columnRow("NHC")).getByText("Sin pendientes")).toBeInTheDocument();
  });

  it("shows the approved text markers, never color-only state", () => {
    const { configRef } = renderHarness();
    fireEvent.change(overrideSelect("CampoLibre"), { target: { value: "insensitive" } });
    selectColumn("Fecha_Nac");
    fireEvent.change(actionSelect("Fecha_Nac")!, { target: { value: "pseudonymize" } });

    // Overridden classification marker + explicit action choice marker.
    expect(
      within(columnRow("CampoLibre")).getByText("clasificación modificada")
    ).toBeInTheDocument();
    expect(within(columnRow("Fecha_Nac")).getByText("tratamiento elegido")).toBeInTheDocument();
    // The configuration is a canonical rebuild, not a label change.
    expect(configRef.current.exportReady).toBe(true);
  });

  it("marks the resolved patient-ID column with the factual text marker", () => {
    const configRef = {
      current: selectPatientIdColumn(createStructuredConfiguration(GRID), "NHC"),
    };
    render(<Harness initial={configRef.current} configRef={configRef} />);
    expect(within(columnRow("NHC")).getByText("columna identificadora")).toBeInTheDocument();
    expect(
      within(columnRow("CampoLibre")).queryByText("columna identificadora")
    ).not.toBeInTheDocument();
  });

  it("keeps duplicate headers distinguishable and identified by the original columnIndex", () => {
    const duplicateGrid: StructuredGrid = {
      headers: ["Dato", "", "Dato"],
      rows: [
        ["1", "2", "3"],
        ["4", "5", "6"],
      ],
    };
    render(
      <Harness
        initial={createStructuredConfiguration(duplicateGrid)}
        configRef={{ current: createStructuredConfiguration(duplicateGrid) }}
      />
    );
    const table = comparisonTable();
    const rows = table.querySelectorAll("tbody tr");
    expect(rows).toHaveLength(3);
    // Source-order ordinals keep duplicate/blank headers distinguishable.
    expect(within(rows[0] as HTMLElement).getByText("1.")).toBeInTheDocument();
    expect(within(rows[1] as HTMLElement).getByText("2.")).toBeInTheDocument();
    expect(within(rows[2] as HTMLElement).getByText("3.")).toBeInTheDocument();
    expect(within(rows[1] as HTMLElement).getByText("(columna sin nombre)")).toBeInTheDocument();
  });
});

describe("StructuredConfigureWorkspace — contextual inspector", () => {
  it("opens on the first unresolved column and shows only that column's bounded controls", () => {
    renderHarness();
    // Default selection: the first unresolved column (Fecha_Nac; index 1).
    expect(screen.getByLabelText("Clasificación del revisor para Fecha_Nac")).toBeInTheDocument();
    expect(screen.queryByLabelText("Clasificación del revisor para NHC")).not.toBeInTheDocument();

    // The inspector's authority facts stay outside any disclosure.
    const panel = inspector();
    expect(within(panel).getAllByText("Cuasi-identificador").length).toBeGreaterThan(0);
    expect(within(panel).getAllByText("Requiere revisión").length).toBeGreaterThan(0);
    const classification = within(panel).getByText("Clasificación:").nextElementSibling;
    expect(classification).toHaveTextContent("Cuasi-identificador");
    expect(classification?.closest("details")).toBeNull();
  });

  it("selecting a row shows exactly its controls and evidence on demand", () => {
    renderHarness();
    selectColumn("CampoLibre");
    const panel = inspector();
    expect(within(panel).getByLabelText("Clasificación del revisor para CampoLibre")).toHaveValue(
      "unknown"
    );
    // Evidence stays on demand behind the keyboard-operable disclosure.
    const details = panel.querySelector("details");
    if (!details) throw new Error("expected the evidence disclosure");
    expect(details.hasAttribute("open")).toBe(false);
    const summary = within(panel).getByText(/Evidencia y detalles detectados de CampoLibre/i);
    expect(summary.tagName).toBe("SUMMARY");
    summary.focus();
    expect(summary).toHaveFocus();
    fireEvent.click(summary);
    expect(details.hasAttribute("open")).toBe(true);
    expect(within(panel).getByText("Clase detectada:").closest("details")).toBe(details);
    expect(within(panel).getByText("Confianza:").nextElementSibling).toHaveTextContent(/%$/);
    // The domain inference evidence is shown in Spanish at the rendering
    // boundary; the underlying domain sentences are never re-derived here.
    expect(within(panel).getByText("2 fila(s) de datos")).toBeInTheDocument();
    expect(
      within(panel).getByText("sin evidencia de patrón de encabezado ni de contenido")
    ).toBeInTheDocument();
  });

  it("keeps the selection visible and the next unresolved column reachable after an override", () => {
    renderHarness();
    // The first unresolved column is selected by default; resolving it…
    fireEvent.change(actionSelect("Fecha_Nac")!, { target: { value: "pseudonymize" } });
    // …keeps the selected column's inspector visible (no blank inspector).
    expect(screen.getByLabelText("Clasificación del revisor para Fecha_Nac")).toHaveValue(
      "quasi-identifier"
    );
    // …acknowledges resolution factually (no auto-acceptance, no ready claim)…
    expect(
      within(inspector()).getByText("Esta columna ya no tiene pendientes.")
    ).toBeInTheDocument();
    // …and keeps the next unresolved column reachable.
    fireEvent.click(screen.getByRole("button", { name: "Ir a la siguiente columna pendiente" }));
    expect(screen.getByLabelText("Clasificación del revisor para CampoLibre")).toHaveValue(
      "unknown"
    );
    // The resolved column's row keeps its markers visible in the comparison.
    expect(within(columnRow("Fecha_Nac")).getByText("tratamiento elegido")).toBeInTheDocument();
  });

  it("renders no Action editor for derived single-option columns, only the Action fact", () => {
    renderHarness();
    // Identifier -> Remove: the Action is a visible fact, not a choice.
    selectColumn("NHC");
    expect(actionSelect("NHC")).toBeNull();
    expect(within(inspector()).getByText("Acción:").nextElementSibling).toHaveTextContent(
      "Eliminar"
    );
    // REC-03 WU-C (D-021 free-text columns): a text-like Sensitive column
    // offers exactly the bounded Keep / Process-as-text choice.
    selectColumn("Diagnostico");
    const sensitiveSelect = actionSelect("Diagnostico");
    if (!sensitiveSelect) throw new Error("expected the bounded Action control for Diagnostico");
    expect(
      Array.from(sensitiveSelect.querySelectorAll("option")).map((option) => option.value)
    ).toEqual(["keep", "process-as-text"]);
    expect(within(inspector()).getByText("Acción:").nextElementSibling).toHaveTextContent(
      "Conservar"
    );
    // Unknown explains the resolution path instead of offering Keep directly;
    // a text-like Unknown additionally offers the explicit Process-as-text path.
    selectColumn("CampoLibre");
    const unknownSelect = actionSelect("CampoLibre");
    if (!unknownSelect) throw new Error("expected the bounded Action control for CampoLibre");
    expect(
      Array.from(unknownSelect.querySelectorAll("option")).map((option) => option.value)
    ).toEqual(["review-required", "process-as-text"]);
    expect(
      within(inspector()).getByText(/no se pueden conservar directamente/i)
    ).toBeInTheDocument();
  });

  it("locks the Action of the patient-ID column with derived text and no contradicting choice", () => {
    const configRef = {
      current: selectPatientIdColumn(createStructuredConfiguration(GRID), "NHC"),
    };
    render(<Harness initial={configRef.current} configRef={configRef} />);
    selectColumn("NHC");
    expect(actionSelect("NHC")).toBeNull();
    const panel = inspector();
    expect(within(panel).getByText("Acción:").nextElementSibling).toHaveTextContent(
      "ID de estudio (derivado/bloqueado)"
    );
    expect(
      within(panel).getByText(/la autoridad de identificación del paciente deriva ID de estudio/i)
    ).toBeInTheDocument();
  });

  it("locks the Action of an explicitly dated column and keeps the date role visible in the row", () => {
    const dated = setStructuredDateRole(createStructuredConfiguration(GRID), 1, "visit");
    render(
      <Harness initial={dated} configRef={{ current: dated }} callbacks={{ onSetDateRole: true }} />
    );
    // The explicit date role is a visible row marker (never color-only).
    expect(within(columnRow("Fecha_Nac")).getByText("Fecha de visita")).toBeInTheDocument();
    selectColumn("Fecha_Nac");
    expect(actionSelect("Fecha_Nac")).toBeNull();
    const panel = inspector();
    expect(within(panel).getByText("Acción:").nextElementSibling).toHaveTextContent(
      "Política de fechas (derivado/bloqueado)"
    );
    expect(
      within(panel).getByText(/el rol de fecha explícito deriva la política de fechas/i)
    ).toBeInTheDocument();
    // The orthogonal role control stays; it never changes the classification.
    fireEvent.change(screen.getByLabelText("Rol de fecha para Fecha_Nac"), {
      target: { value: "none" },
    });
    expect(within(columnRow("Fecha_Nac")).queryByText("Fecha de visita")).not.toBeInTheDocument();
    expect(within(columnRow("Fecha_Nac")).getAllByText("Requiere revisión").length).toBeGreaterThan(
      0
    );
  });
});

describe("StructuredConfigureWorkspace — Unknown review + export gate", () => {
  it("shows the fail-closed gate for review-required columns and NEVER defaults them to KEEP", () => {
    const { configRef } = renderHarness();
    const facts = screen.getByRole("status", { name: /datos de la configuración estructurada/i });
    // D-021: CampoLibre (unknown) AND Fecha_Nac (unresolved quasi) require review.
    expect(facts).toHaveTextContent("Columnas que requieren revisión: 2");
    expect(facts).toHaveTextContent("Exportación estructurada preparada: No");
    expect(screen.getByRole("alert")).toHaveTextContent(/exportación estructurada está bloqueada/i);

    // Neither review-required column is KEEP: the effective classes stay put
    // and the canonical export gate stays closed.
    selectColumn("CampoLibre");
    expect(screen.getByLabelText("Clasificación del revisor para CampoLibre")).toHaveValue(
      "unknown"
    );
    selectColumn("Fecha_Nac");
    expect(screen.getByLabelText("Clasificación del revisor para Fecha_Nac")).toHaveValue(
      "quasi-identifier"
    );
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
    selectColumn("Fecha_Nac");
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

    const facts = screen.getByRole("status", { name: /datos de la configuración estructurada/i });
    expect(facts).toHaveTextContent("Columnas que requieren revisión: 0");
    expect(facts).toHaveTextContent("Exportación estructurada preparada: Sí");
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();

    // The override updated the comparative row and the global facts together,
    // with the selection still visible.
    expect(within(columnRow("CampoLibre")).getByText("No sensible")).toBeInTheDocument();
    expect(
      within(columnRow("CampoLibre")).getByText("clasificación modificada")
    ).toBeInTheDocument();
    expect(within(columnRow("Fecha_Nac")).getByText("tratamiento elegido")).toBeInTheDocument();
    expect(
      within(inspector()).getByLabelText("Clasificación del revisor para Fecha_Nac")
    ).toHaveValue("quasi-identifier");
  });
});

describe("StructuredConfigureWorkspace — adversarial override invariants", () => {
  it("overriding one column never mutates another column's classification", () => {
    const { configRef } = renderHarness();
    fireEvent.change(overrideSelect("NHC"), { target: { value: "insensitive" } });

    selectColumn("CampoLibre");
    expect(screen.getByLabelText("Clasificación del revisor para CampoLibre")).toHaveValue(
      "unknown"
    );
    selectColumn("Diagnostico");
    expect(screen.getByLabelText("Clasificación del revisor para Diagnostico")).toHaveValue(
      "sensitive"
    );
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
    rerender(
      <Harness
        initial={configRef.current}
        configRef={configRef}
        callbacks={{ onSetDateRole: true }}
      />
    );
    expect(configRef.current).toBe(after);
    selectColumn("CampoLibre");
    expect(screen.getByLabelText("Clasificación del revisor para CampoLibre")).toHaveValue(
      "sensitive"
    );
  });
});

describe("StructuredConfigureWorkspace — single patient-ID authority (SPEC §6)", () => {
  it("shows the authority exactly once and routes the choice through the domain", () => {
    const { configRef } = renderHarness();
    expect(
      screen.getAllByRole("region", { name: /autoridad de identificación del paciente/i })
    ).toHaveLength(1);

    fireEvent.change(screen.getByLabelText("Columna de identificación del paciente"), {
      target: { value: "NHC" },
    });
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
    selectColumn("Fecha_Nac");
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

  it("exposes the Action control as a keyboard-operable select with visible focus", () => {
    renderHarness();
    selectColumn("Fecha_Nac");
    const select = actionSelect("Fecha_Nac");
    if (!select) throw new Error("expected the bounded Action control for Fecha_Nac");
    select.focus();
    expect(select).toHaveFocus();
    expect(select).toHaveClass("focus-visible:ring-2");
  });
});

describe("StructuredConfigureWorkspace — keyboard, responsive and sheet selection", () => {
  it("exposes the override and row-selection controls as keyboard-operable", () => {
    renderHarness();
    const override = overrideSelect("NHC");
    expect(override.tagName).toBe("SELECT");
    override.focus();
    expect(override).toHaveFocus();
    expect(override).toHaveClass("focus-visible:ring-2");
    // Row selection is a real pressed-state button (never color-only).
    const rowButton = within(comparisonTable()).getByRole("button", { name: "Fecha_Nac" });
    expect(rowButton).toHaveAttribute("aria-pressed", "false");
    fireEvent.click(rowButton);
    expect(rowButton).toHaveAttribute("aria-pressed", "true");
  });

  it("renders the table inside an explicitly labeled scrollable region with the inspector alongside", () => {
    renderHarness();
    // 375 px contract: the table may scroll inside its labeled region; the
    // page never overflows horizontally.
    const scrollRegion = screen.getByRole("region", {
      name: /tabla comparativa de columnas/i,
    });
    expect(scrollRegion).toHaveClass("overflow-x-auto");
    expect(scrollRegion).toHaveAttribute("tabindex", "0");
    // Desktop: the inspector sits alongside the table (grid columns).
    const container = scrollRegion.closest("div.grid") as HTMLElement;
    expect(container).toHaveClass("lg:grid-cols-[minmax(0,1.8fr)_minmax(280px,1fr)]");
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
    const select = screen.getByLabelText("Hoja") as HTMLSelectElement;
    expect(select).toHaveValue("Portada");
    fireEvent.change(select, { target: { value: "DatosClinicos" } });
    fireEvent.click(screen.getByRole("button", { name: /cargar hoja/i }));
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
    expect(screen.getByRole("alert")).toHaveTextContent("La entrada CSV está vacía.");
  });

  it("requires an explicit header-row choice when detection is ambiguous", () => {
    const onSelectHeaderRow = vi.fn();
    render(
      <StructuredConfigureWorkspace
        configuration={null}
        errorMessage={null}
        sheetNames={null}
        headerRow={{ sheetName: "Datos", candidateRowIndices: [0, 1], inspectedRowCount: 3 }}
        onSelectSheet={() => {}}
        onSelectHeaderRow={onSelectHeaderRow}
        onOverrideClass={() => {}}
        onSelectPatientId={() => {}}
      />
    );
    // Inspected rows are offered 1-based; detected candidates are marked.
    const select = screen.getByLabelText("Fila de encabezado") as HTMLSelectElement;
    const options = Array.from(select.querySelectorAll("option")).map(
      (option) => option.textContent
    );
    expect(options).toHaveLength(3);
    expect(options[0]).toMatch(/fila 1/i);
    expect(options[0]).toMatch(/candidata a encabezado/i);
    expect(options[2]).not.toMatch(/candidata a encabezado/i);
    // The choice round-trips as the 0-based inspected row index.
    fireEvent.change(select, { target: { value: "1" } });
    fireEvent.click(screen.getByRole("button", { name: /usar la fila 2 como encabezado/i }));
    expect(onSelectHeaderRow).toHaveBeenCalledWith(1);
  });

  it("keeps worksheet selection first when both sheet and header choices are pending", () => {
    render(
      <StructuredConfigureWorkspace
        configuration={null}
        errorMessage={null}
        sheetNames={["Portada", "Datos"]}
        headerRow={{ sheetName: "Datos", candidateRowIndices: [0], inspectedRowCount: 3 }}
        onSelectSheet={() => {}}
        onSelectHeaderRow={() => {}}
        onOverrideClass={() => {}}
        onSelectPatientId={() => {}}
      />
    );
    expect(screen.getByLabelText("Hoja")).toBeInTheDocument();
    expect(screen.queryByLabelText("Fila de encabezado")).not.toBeInTheDocument();
  });
});
