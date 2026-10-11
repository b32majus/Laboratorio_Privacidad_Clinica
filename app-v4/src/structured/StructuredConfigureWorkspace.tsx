/**
 * Structured comparative Configure workspace (issue #85; Work Order T20 #24;
 * SPEC_V4_BATCH_AND_STRUCTURED.md §5-§7, SPEC_V4_APP_AND_REVIEW.md §4/§9,
 * DEBT UX-015/PRODUCT-006).
 *
 * Renders the canonical structured configuration (`configuration.ts`) as the
 * "Configure" step of the common app shell as a COMPARATIVE, scannable column
 * workspace (issue #85 approved design), not repeated cards:
 *   - one dominant comparison table shows every column in source order, row
 *     identity is the original `columnIndex` (duplicate/blank headers remain
 *     distinguishable), with four always-visible factual fields:
 *     `Columna | Clasificación vigente | Tratamiento efectivo |
 *     Estado / acción pendiente`;
 *   - text markers (never color alone): `clasificación modificada`,
 *     `tratamiento elegido`, `derivado/bloqueado`, `columna identificadora`,
 *     and the explicit date role where relevant;
 *   - selecting a row opens a contextual inspector alongside the table at
 *     desktop width with ONLY that column's current allowed class, permitted
 *     action choices, explicit date role, confidence/proposal/evidence on
 *     demand and current derived locks. Inspectable facts never include
 *     patient values;
 *   - an Unknown column, and a non-date quasi-identifier with no bounded
 *     explicit action, are visibly "Review required" and keep the structured
 *     export gate closed (D-009; UNKNOWN is not KEEP). Neither the row state
 *     nor the global readiness summary may claim output ready from
 *     `requiresReview=false` alone;
 *   - stronger authorities (patient-ID selection, explicit date role) visibly
 *     lock/derive the Action instead of offering a contradicting choice;
 *   - the reviewer can override any column's class, which goes back to the
 *     domain bridge and rebuilds the canonical configuration (never a
 *     label-only change); the selection stays visible and the next unresolved
 *     column stays reachable without auto-acceptance;
 *   - the single patient-ID authority (SPEC §6) is shown ONCE; this component
 *     never re-derives it, it renders the domain resolution verbatim.
 *
 * The component is CONTROLLED: the frozen configuration comes in as a prop and
 * every change goes out through a callback to the domain state bridge. Local
 * state is limited to transient view concerns (the selected column, the
 * pending sheet selection) — selection is NEVER a second classification or
 * export authority.
 *
 * Accessibility (SPEC §9): native `label`/`select`/`button` semantics, visible
 * focus rings, status conveyed as text (never color alone), and a responsive
 * layout where the table is an explicitly labeled scrollable region and the
 * inspector stacks below it on narrow screens.
 */
import { useState, type ReactElement } from "react";

import {
  STRUCTURED_COLUMN_CLASSES,
  STRUCTURED_DATE_ROLES,
  type ColumnClass,
  type StructuredAction,
  type StructuredColumnState,
  type StructuredConfiguration,
  type StructuredDateRole,
} from "./configuration";
import type { StructuredSummary } from "./transformed-dataset";
import type { StudyIdPrefixResolution } from "./output-options";
import type { ColumnSampleType } from "./column-profile";
import type { ProposedAction } from "./classification";

const focusRing =
  "focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2";

/** Visible class labels: classification is never conveyed by color alone. */
const CLASS_LABELS: Record<ColumnClass, string> = {
  identifier: "Identifier",
  "quasi-identifier": "Quasi-Identifier",
  sensitive: "Sensitive",
  insensitive: "Insensitive",
  unknown: "Unknown",
};

/** Visible action labels for the effective productive Action (D-021, REC-03 WU-B). */
const ACTION_LABELS: Record<StructuredAction, string> = {
  "study-id": "Study ID",
  "date-policy": "Date policy",
  remove: "Remove",
  keep: "Keep",
  pseudonymize: "Pseudonymize",
  "process-as-text": "Process as text",
  "review-required": "Review required",
};

/** Visible proposal labels (class/header proposal, a subset of the Action vocabulary). */
const PROPOSAL_LABELS: Record<ProposedAction, string> = {
  remove: "Remove",
  pseudonymize: "Pseudonymize",
  keep: "Keep",
  "review-required": "Review required",
};

const TYPE_LABELS: Record<ColumnSampleType, string> = {
  number: "Number",
  date: "Date",
  boolean: "Boolean",
  text: "Text",
  empty: "Empty",
};

/** Visible date-role labels: ordinal meaning is never conveyed by color alone. */
const DATE_ROLE_LABELS: Record<StructuredDateRole, string> = {
  none: "None",
  visit: "Visit date",
  birth: "Birth date",
};

/** Row text marker for a reviewer-overridden classification (issue #85, Spanish-first). */
const OVERRIDDEN_MARKER = "clasificación modificada";
/** Row text marker for an explicit reviewer Action choice (issue #85, Spanish-first). */
const EXPLICIT_ACTION_MARKER = "tratamiento elegido";
/** Row text marker for a proposed (not yet chosen) Action (issue #85, Spanish-first). */
const PROPOSED_ACTION_MARKER = "propuesta";
/** Row text marker for a derived, locked Action (issue #85, Spanish-first). */
const LOCKED_ACTION_MARKER = "derivado/bloqueado";
/** Row text marker for the single patient-ID authority column (issue #85, Spanish-first). */
const PATIENT_ID_MARKER = "columna identificadora";
/** Factual per-row state when nothing is pending (never an output-ready claim). */
const ROW_SETTLED_LABEL = "Sin pendientes";

export type StructuredConfigureWorkspaceProps = {
  /**
   * The frozen canonical configuration, or `null` while the structured source
   * is being read / awaiting an explicit sheet.
   */
  readonly configuration: StructuredConfiguration | null;
  /** Typed intake failure to surface factually, if any. */
  readonly errorMessage?: string | null;
  /** Sheet names of a multi-sheet workbook awaiting an explicit selection. */
  readonly sheetNames?: readonly string[] | null;
  /**
   * Explicit header-row choice pending for the selected worksheet (REC-04
   * WU-A, D-022): candidate/inspected rows are 0-based; the UI renders them
   * 1-based and never shows cell content.
   */
  readonly headerRow?: {
    readonly sheetName: string;
    readonly candidateRowIndices: readonly number[];
    readonly inspectedRowCount: number;
  } | null;
  /** Load an explicitly selected worksheet (never a silent first sheet). */
  readonly onSelectSheet: (sheetName: string) => void;
  /** Use an explicitly selected inspected row as the header row (0-based). */
  readonly onSelectHeaderRow?: (rowIndex: number) => void;
  /** Explicit reviewer override of one column's class (domain transition). */
  readonly onOverrideClass: (columnIndex: number, columnClass: ColumnClass) => void;
  /**
   * Explicit reviewer choice of one column's productive Action (REC-03 WU-B
   * domain transition). When absent the Action control is not rendered
   * (backward-compatible controlled surface); the effective Action fact stays
   * visible regardless.
   */
  readonly onOverrideAction?: (columnIndex: number, action: StructuredAction) => void;
  /** Set the single patient-ID authority to a header (or clear with `null`). */
  readonly onSelectPatientId: (header: string | null) => void;
  /**
   * Set (or clear) one column's explicit date role (HARDEN-01 WU-A). When
   * absent the role control is not rendered (backward-compatible controlled
   * surface).
   */
  readonly onSetDateRole?: (columnIndex: number, role: StructuredDateRole) => void;
  /**
   * Exact plan-based export readiness (block reasons included). When absent,
   * the summary falls back to the structural unknown-column gate.
   */
  readonly exportReadiness?: {
    readonly ready: boolean;
    readonly reasons: readonly string[];
  } | null;
  /**
   * Job-scoped structured output options (REC-04 WU-B, D-022): the bounded
   * "Output options" area inside Configure. When absent the area is not
   * rendered (backward-compatible controlled surface). The values come from
   * the bridge options authority; every change goes out through its
   * callbacks — this component never owns option state.
   */
  readonly outputOptions?: {
    /** The raw Study-ID prefix as typed (blank resolves to the default). */
    readonly prefix: string;
    /**
     * The typed resolution of the held raw prefix, or `null` without held
     * options (SM-2). The invalid state is represented by this typed value.
     */
    readonly prefixResolution: StudyIdPrefixResolution | null;
    /** Exact invalid-prefix reason, or `null` while the prefix resolves. */
    readonly prefixInvalid: string | null;
    /** Whether row-order visit numbering is enabled. */
    readonly addVisitNumber: boolean;
    /** False without a patient-ID authority (the control is then unavailable). */
    readonly visitAvailable: boolean;
    /** Factual descriptive counts (row/patient facts, never scores). */
    readonly summary: StructuredSummary;
    /** Store one raw prefix choice in the bridge authority. */
    readonly onPrefixChange: (raw: string) => void;
    /** Store the explicit visit-numbering choice in the bridge authority. */
    readonly onToggleVisitNumber: (enabled: boolean) => void;
  } | null;
};

export function StructuredConfigureWorkspace(
  props: StructuredConfigureWorkspaceProps
): ReactElement {
  const {
    configuration,
    errorMessage = null,
    sheetNames = null,
    headerRow = null,
    onSelectSheet,
    onSelectHeaderRow,
    onOverrideClass,
    onOverrideAction,
    onSelectPatientId,
    onSetDateRole,
    exportReadiness = null,
    outputOptions = null,
  } = props;

  return (
    <section aria-labelledby="configure-step-heading">
      <h2 id="configure-step-heading" className="font-display text-xl font-bold text-primary-dark">
        Preparar datos estructurados
      </h2>
      <p className="mt-2 max-w-3xl text-base leading-relaxed">
        Compare todas las columnas de la tabla: su clasificación vigente, su tratamiento efectivo y
        lo que queda pendiente. Las clases son propuestas con confianza y evidencia; puede cambiar
        cualquiera. Las columnas desconocidas (Unknown) siempre requieren revisión y nunca se tratan
        como seguras para conservar.
      </p>

      {errorMessage !== null && (
        <p
          role="alert"
          className={`mt-3 max-w-3xl rounded border border-primary-dark bg-surface-light px-3 py-2 text-sm font-semibold text-primary-dark ${focusRing}`}
        >
          {errorMessage}
        </p>
      )}

      {configuration === null ? (
        sheetNames !== null && sheetNames.length > 0 ? (
          <SheetSelection
            key={sheetNames.join("|")}
            sheetNames={sheetNames}
            onSelectSheet={onSelectSheet}
          />
        ) : headerRow !== null && onSelectHeaderRow !== undefined ? (
          <HeaderRowSelection
            key={`${headerRow.sheetName}|${headerRow.candidateRowIndices.join(",")}|${headerRow.inspectedRowCount}`}
            headerRow={headerRow}
            onSelectHeaderRow={onSelectHeaderRow}
          />
        ) : errorMessage === null ? (
          <p
            role="status"
            className="mt-4 max-w-3xl rounded border border-primary bg-surface-light px-3 py-2 text-sm font-semibold text-neutral-800"
          >
            Reading the structured source…
          </p>
        ) : null
      ) : (
        <ConfigurationView
          configuration={configuration}
          onOverrideClass={onOverrideClass}
          onOverrideAction={onOverrideAction}
          onSelectPatientId={onSelectPatientId}
          onSetDateRole={onSetDateRole}
          exportReadiness={exportReadiness}
          outputOptions={outputOptions}
        />
      )}
    </section>
  );
}

/** Explicit header-row choice for the selected worksheet (REC-04 WU-A, D-022). */
function HeaderRowSelection(props: {
  headerRow: {
    readonly sheetName: string;
    readonly candidateRowIndices: readonly number[];
    readonly inspectedRowCount: number;
  };
  onSelectHeaderRow: (rowIndex: number) => void;
}): ReactElement {
  const { headerRow, onSelectHeaderRow } = props;
  const candidates = new Set(headerRow.candidateRowIndices);
  // Default to the first detected candidate (or row 1 when none qualified);
  // the human still confirms explicitly — nothing is assumed silently.
  const [selected, setSelected] = useState(headerRow.candidateRowIndices[0] ?? 0);
  return (
    <section
      aria-label="Workbook header row selection"
      className="mt-4 max-w-3xl rounded border border-primary bg-surface-light p-3"
    >
      <h3 className="font-display text-base font-bold text-primary-dark">Select the header row</h3>
      <p className="mt-2 text-sm text-neutral-800">
        The worksheet “{headerRow.sheetName}” has no single clear header row. Choose which of the
        inspected rows is the header; rows above it are skipped as explanatory notes, never data.
        The first row is never assumed.
      </p>
      <form
        className="mt-3 flex flex-wrap items-end gap-2"
        onSubmit={(event) => {
          event.preventDefault();
          onSelectHeaderRow(selected);
        }}
      >
        <div>
          <label
            htmlFor="structured-header-row"
            className="block text-sm font-semibold text-neutral-800"
          >
            Header row
          </label>
          <select
            id="structured-header-row"
            value={selected}
            onChange={(event) => setSelected(Number(event.target.value))}
            className={`mt-1 rounded border border-primary bg-white px-2 py-1 text-sm ${focusRing}`}
          >
            {Array.from({ length: headerRow.inspectedRowCount }, (_, index) => (
              <option key={index} value={index}>
                {candidates.has(index) ? `Row ${index + 1} (header candidate)` : `Row ${index + 1}`}
              </option>
            ))}
          </select>
        </div>
        <button
          type="submit"
          className={`rounded bg-primary-dark px-4 py-2 text-sm font-semibold text-white hover:bg-primary ${focusRing}`}
        >
          Use row {selected + 1} as header
        </button>
      </form>
    </section>
  );
}
/** Explicit worksheet choice for a multi-sheet workbook (SPEC §9). */
function SheetSelection(props: {
  sheetNames: readonly string[];
  onSelectSheet: (sheetName: string) => void;
}): ReactElement {
  const { sheetNames, onSelectSheet } = props;
  const [selected, setSelected] = useState(sheetNames[0] ?? "");
  return (
    <section
      aria-label="Workbook sheet selection"
      className="mt-4 max-w-3xl rounded border border-primary bg-surface-light p-3"
    >
      <h3 className="font-display text-base font-bold text-primary-dark">Select a worksheet</h3>
      <p className="mt-2 text-sm text-neutral-800">
        This workbook has several sheets. Choose the sheet to classify; the first sheet is never
        selected silently.
      </p>
      <form
        className="mt-3 flex flex-wrap items-end gap-2"
        onSubmit={(event) => {
          event.preventDefault();
          if (selected !== "") onSelectSheet(selected);
        }}
      >
        <div>
          <label
            htmlFor="structured-sheet"
            className="block text-sm font-semibold text-neutral-800"
          >
            Worksheet
          </label>
          <select
            id="structured-sheet"
            value={selected}
            onChange={(event) => setSelected(event.target.value)}
            className={`mt-1 rounded border border-primary bg-white px-2 py-1 text-sm ${focusRing}`}
          >
            {sheetNames.map((name) => (
              <option key={name} value={name}>
                {name}
              </option>
            ))}
          </select>
        </div>
        <button
          type="submit"
          className={`rounded bg-primary-dark px-4 py-2 text-sm font-semibold text-white hover:bg-primary ${focusRing}`}
        >
          Load sheet
        </button>
      </form>
    </section>
  );
}

/**
 * The comparative configuration view (issue #85): compact readiness facts,
 * the single patient-ID authority, the bounded output options, and the
 * dominant four-field comparison table with a contextual inspector.
 */
function ConfigurationView(props: {
  configuration: StructuredConfiguration;
  onOverrideClass: (columnIndex: number, columnClass: ColumnClass) => void;
  onOverrideAction?: (columnIndex: number, action: StructuredAction) => void;
  onSelectPatientId: (header: string | null) => void;
  onSetDateRole?: (columnIndex: number, role: StructuredDateRole) => void;
  exportReadiness: { readonly ready: boolean; readonly reasons: readonly string[] } | null;
  outputOptions: StructuredConfigureWorkspaceProps["outputOptions"];
}): ReactElement {
  const {
    configuration,
    onOverrideClass,
    onOverrideAction,
    onSelectPatientId,
    onSetDateRole,
    exportReadiness,
    outputOptions,
  } = props;

  /**
   * Transient UI selection ONLY (issue #85): which column the inspector
   * shows. It never feeds classification, action, patient-ID or export
   * authority. `null` means "no explicit choice yet" and falls back to the
   * first unresolved column (or the first column when nothing is unresolved),
   * so the workspace opens on a useful first unresolved column. Any
   * inspector edit pins the selection, so the edited column stays visible
   * after the canonical rebuild.
   */
  const [selectedColumnIndex, setSelectedColumnIndex] = useState<number | null>(null);
  const pendingIndices = new Set(configuration.columnsRequiringReview);
  const fallbackColumn =
    configuration.columns.find((column) => pendingIndices.has(column.columnIndex)) ??
    configuration.columns[0] ??
    null;
  const effectiveSelectedIndex = selectedColumnIndex ?? fallbackColumn?.columnIndex ?? null;
  const selectedColumn =
    configuration.columns.find((column) => column.columnIndex === effectiveSelectedIndex) ?? null;

  /** Pin the selection to the edited column, then run the canonical callback. */
  const withSelection =
    <A extends unknown[]>(callback: ((columnIndex: number, ...args: A) => void) | undefined) =>
    (columnIndex: number, ...args: A): void => {
      setSelectedColumnIndex(columnIndex);
      callback?.(columnIndex, ...args);
    };
  const handleInspectorClass = withSelection(onOverrideClass);
  const handleInspectorAction = withSelection(onOverrideAction);
  const handleInspectorDateRole = withSelection(onSetDateRole);

  return (
    <div className="mt-4 space-y-4">
      <ConfigurationSummary configuration={configuration} exportReadiness={exportReadiness} />
      <PatientIdAuthority configuration={configuration} onSelectPatientId={onSelectPatientId} />
      {outputOptions !== null && outputOptions !== undefined && (
        <OutputOptionsSection outputOptions={outputOptions} />
      )}
      <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,1.8fr)_minmax(280px,1fr)]">
        <ColumnComparisonTable
          configuration={configuration}
          patientIdIndex={
            configuration.patientId.status === "resolved"
              ? configuration.patientId.columnIndex
              : null
          }
          selectedColumnIndex={selectedColumn?.columnIndex ?? null}
          onSelectColumn={setSelectedColumnIndex}
        />
        {selectedColumn !== null && (
          <ColumnInspector
            column={selectedColumn}
            isPatientId={
              configuration.patientId.status === "resolved" &&
              configuration.patientId.columnIndex === selectedColumn.columnIndex
            }
            isPending={pendingIndices.has(selectedColumn.columnIndex)}
            otherPendingIndices={configuration.columnsRequiringReview.filter(
              (index) => index !== selectedColumn.columnIndex
            )}
            onSelectColumn={setSelectedColumnIndex}
            onOverrideClass={handleInspectorClass}
            onOverrideAction={handleInspectorAction}
            onSetDateRole={handleInspectorDateRole}
          />
        )}
      </div>
    </div>
  );
}

/** Factual summary: counts and the structured export gate (never a score). */
function ConfigurationSummary(props: {
  configuration: StructuredConfiguration;
  exportReadiness: { readonly ready: boolean; readonly reasons: readonly string[] } | null;
}): ReactElement {
  const { configuration, exportReadiness } = props;
  const pending = configuration.columnsRequiringReview.length;
  const ready = exportReadiness === null ? configuration.exportReady : exportReadiness.ready;
  const reasons = exportReadiness === null ? [] : exportReadiness.reasons;
  return (
    <section
      aria-label="Structured configuration summary"
      className="rounded border border-primary bg-surface-light p-3"
    >
      <h3 className="font-display text-base font-bold text-primary-dark">Configuration summary</h3>
      <dl
        role="status"
        aria-label="Structured configuration facts"
        className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1 text-sm text-neutral-800"
      >
        <dt className="font-semibold">Columns:</dt>
        <dd> {configuration.columns.length}</dd>
        <dt className="font-semibold">Columns requiring review:</dt>
        <dd> {pending}</dd>
        <dt className="font-semibold">Structured export ready:</dt>
        <dd> {ready ? "Yes" : "No"}</dd>
      </dl>
      {reasons.length > 0 ? (
        <ul
          role="alert"
          aria-label="Structured export block reasons"
          className="mt-3 list-disc space-y-0.5 rounded border border-primary-dark bg-white px-3 py-2 pl-6 text-sm font-semibold text-primary-dark"
        >
          {reasons.map((reason, index) => (
            <li key={index}>{reason}</li>
          ))}
        </ul>
      ) : (
        pending > 0 && (
          <p
            role="alert"
            className="mt-3 rounded border border-primary-dark bg-white px-3 py-2 text-sm font-semibold text-primary-dark"
          >
            {pending === 1
              ? "Structured export is blocked while 1 column requires review."
              : `Structured export is blocked while ${pending} columns require review.`}{" "}
            Unknown columns are never kept or exported as-is; choose an explicit class for each.
          </p>
        )
      )}
    </section>
  );
}

/** The single patient-ID authority (SPEC §6), shown exactly once. */
function PatientIdAuthority(props: {
  configuration: StructuredConfiguration;
  onSelectPatientId: (header: string | null) => void;
}): ReactElement {
  const { configuration, onSelectPatientId } = props;
  const { patientId } = configuration;
  return (
    <section
      aria-label="Autoridad de identificación del paciente"
      className="rounded border border-primary bg-surface-light p-3"
    >
      <h3 className="font-display text-base font-bold text-primary-dark">
        Autoridad de identificación del paciente
      </h3>
      <p className="mt-2 text-sm text-neutral-800">
        Exactamente una columna es la autoridad de identificación del paciente para este trabajo
        estructurado. Se elige aquí una sola vez; la tabla comparativa nunca re-declara ese
        significado.
      </p>
      <label
        htmlFor="patient-id-column"
        className="mt-3 block text-sm font-semibold text-neutral-800"
      >
        Columna de identificación del paciente
      </label>
      <select
        id="patient-id-column"
        value={configuration.selectedPatientIdColumn ?? ""}
        onChange={(event) =>
          onSelectPatientId(event.target.value === "" ? null : event.target.value)
        }
        className={`mt-1 w-full max-w-sm rounded border border-primary bg-white px-2 py-1 text-sm ${focusRing}`}
      >
        <option value="">Sin seleccionar</option>
        {configuration.columns.map((column) => (
          <option key={column.columnIndex} value={column.header}>
            {column.header === "" ? "(unnamed column)" : column.header}
          </option>
        ))}
      </select>
      {patientId.status === "resolved" && (
        <p className="mt-2 text-sm text-neutral-800">
          <span className="font-semibold">Seleccionada:</span> {patientId.column}
        </p>
      )}
      {patientId.status === "not-selected" && (
        <p className="mt-2 text-sm text-neutral-800">
          {patientId.candidates.length > 0
            ? `Aún no hay columna seleccionada. Columnas detectadas como posibles identificadores de paciente: ${patientId.candidates.join(", ")}.`
            : "Aún no hay columna seleccionada y no se detectó ninguna columna parecida a un identificador de paciente. Elija una explícitamente."}
        </p>
      )}
      {patientId.status === "selection-error" && (
        <p role="alert" className="mt-2 text-sm font-semibold text-primary-dark">
          {patientId.message}
        </p>
      )}
    </section>
  );
}

/** Bounded structured output options (REC-04 WU-B, D-022): prefix + visit numbering + facts. */
function OutputOptionsSection(props: {
  outputOptions: NonNullable<StructuredConfigureWorkspaceProps["outputOptions"]>;
}): ReactElement {
  const { outputOptions } = props;
  const { summary } = outputOptions;
  return (
    <section
      aria-label="Structured output options"
      className="rounded border border-primary bg-surface-light p-3"
    >
      <h3 className="font-display text-base font-bold text-primary-dark">Output options</h3>
      <p className="mt-2 text-sm text-neutral-800">
        How generated Study IDs are formatted. Changing these options never changes patient grouping
        or row order — only the generated token text.
      </p>
      <div className="mt-3">
        <label
          htmlFor="structured-study-id-prefix"
          className="block text-sm font-semibold text-neutral-800"
        >
          Study-ID prefix
        </label>
        <input
          id="structured-study-id-prefix"
          type="text"
          value={outputOptions.prefix}
          onChange={(event) => outputOptions.onPrefixChange(event.target.value)}
          aria-describedby={
            outputOptions.prefixInvalid !== null ? "structured-study-id-prefix-invalid" : undefined
          }
          aria-invalid={outputOptions.prefixInvalid !== null}
          className={`mt-1 w-full max-w-sm rounded border border-primary bg-white px-2 py-1 text-sm ${focusRing}`}
        />
        <p className="mt-1 text-xs text-neutral-700">
          Blank uses the default PAC. Otherwise letters and digits, starting with a letter, up to 10
          characters (for example HS1 gives HS1_001, HS1_002, …).
        </p>
        {outputOptions.prefixInvalid !== null && (
          <p
            role="alert"
            aria-label="Study-ID prefix invalid"
            id="structured-study-id-prefix-invalid"
            className="mt-2 rounded border border-primary-dark bg-white px-3 py-2 text-sm font-semibold text-primary-dark"
          >
            {outputOptions.prefixInvalid}
          </p>
        )}
      </div>
      <div className="mt-3">
        <label
          htmlFor="structured-visit-number"
          className="flex cursor-pointer items-start gap-2 text-sm font-semibold text-neutral-800"
        >
          <input
            id="structured-visit-number"
            type="checkbox"
            checked={outputOptions.addVisitNumber}
            disabled={!outputOptions.visitAvailable}
            onChange={(event) => outputOptions.onToggleVisitNumber(event.target.checked)}
            className={`mt-0.5 ${focusRing}`}
          />
          Visit numbering (Visita_Num)
        </label>
        <p className="mt-1 text-xs text-neutral-700">
          {outputOptions.visitAvailable
            ? "Adds a numeric Visita_Num column after ID_ESTUDIO: 1-based occurrence per patient in input row order. It is not visit chronology."
            : "Available when a patient-ID column is selected."}
        </p>
      </div>
      <div className="mt-3 rounded border border-neutral-300 bg-white p-2">
        <h4 className="text-xs font-bold text-primary-dark">Structured output facts</h4>
        <dl
          role="status"
          aria-label="Structured output facts"
          className="mt-1 grid grid-cols-2 gap-x-4 gap-y-1 text-sm text-neutral-800"
        >
          <dt className="font-semibold">Data rows:</dt>
          <dd>{summary.rowCount}</dd>
          {summary.patient !== null ? (
            <>
              <dt className="font-semibold">Patients:</dt>
              <dd>{summary.patient.uniquePatients}</dd>
              <dt className="font-semibold">Linked rows:</dt>
              <dd>{summary.patient.linkedRows}</dd>
              <dt className="font-semibold">Average linked rows per patient:</dt>
              <dd>{summary.patient.averageLinkedRowsPerPatient}</dd>
            </>
          ) : (
            <>
              <dt className="font-semibold">Patients:</dt>
              <dd>unavailable without a selected patient-ID column</dd>
            </>
          )}
        </dl>
      </div>
    </section>
  );
}

/**
 * The dominant four-field comparison table (issue #85): every column in
 * source order, row identity = original `columnIndex`, all four factual
 * fields always visible, text markers instead of color-only semantics.
 */
function ColumnComparisonTable(props: {
  configuration: StructuredConfiguration;
  patientIdIndex: number | null;
  selectedColumnIndex: number | null;
  onSelectColumn: (columnIndex: number) => void;
}): ReactElement {
  const { configuration, patientIdIndex, selectedColumnIndex, onSelectColumn } = props;
  return (
    <section className="min-w-0 rounded border border-primary bg-surface-light p-3">
      <h3 className="font-display text-base font-bold text-primary-dark">
        Comparativa de columnas
      </h3>
      {/*
        Explicitly labeled, keyboard-focusable scrollable region (issue #85
        375 px contract): the table may scroll horizontally INSIDE this region
        on narrow screens; the page itself never overflows horizontally.
      */}
      <div
        role="region"
        aria-label="Tabla comparativa de columnas (desplazable en pantallas estrechas)"
        tabIndex={0}
        className={`mt-3 overflow-x-auto ${focusRing}`}
      >
        <table
          aria-label="Column classification list"
          className="w-full min-w-[36rem] border-collapse text-sm"
        >
          <thead>
            <tr>
              <th
                scope="col"
                className="border-b border-primary-dark px-2 py-2 text-left text-xs font-bold uppercase tracking-wide text-primary-dark"
              >
                Columna
              </th>
              <th
                scope="col"
                className="border-b border-primary-dark px-2 py-2 text-left text-xs font-bold uppercase tracking-wide text-primary-dark"
              >
                Clasificación vigente
              </th>
              <th
                scope="col"
                className="border-b border-primary-dark px-2 py-2 text-left text-xs font-bold uppercase tracking-wide text-primary-dark"
              >
                Tratamiento efectivo
              </th>
              <th
                scope="col"
                className="border-b border-primary-dark px-2 py-2 text-left text-xs font-bold uppercase tracking-wide text-primary-dark"
              >
                Estado / acción pendiente
              </th>
            </tr>
          </thead>
          <tbody>
            {configuration.columns.map((column) => (
              <ComparisonRow
                key={column.columnIndex}
                column={column}
                isPatientId={patientIdIndex === column.columnIndex}
                isSelected={selectedColumnIndex === column.columnIndex}
                onSelect={onSelectColumn}
              />
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

/** One comparative row: the four approved factual fields, no editing controls. */
function ComparisonRow(props: {
  column: StructuredColumnState;
  isPatientId: boolean;
  isSelected: boolean;
  onSelect: (columnIndex: number) => void;
}): ReactElement {
  const { column, isPatientId, isSelected, onSelect } = props;
  const columnName = column.header === "" ? "(unnamed column)" : column.header;
  const cellClass = "border-t border-primary/40 px-2 py-2 align-top";
  return (
    <tr className={isSelected ? "bg-white" : undefined}>
      <td className={cellClass}>
        {/*
          Row selection is a real button with `aria-pressed` (keyboard
          operable, state conveyed to assistive technology). The source-order
          ordinal keeps duplicate/blank headers distinguishable; the button's
          accessible name stays exactly the column header.
        */}
        <span className="mr-1 text-xs font-normal text-neutral-500">{column.columnIndex + 1}.</span>
        <button
          type="button"
          aria-pressed={isSelected}
          onClick={() => onSelect(column.columnIndex)}
          className={`rounded text-left font-semibold text-primary-dark hover:underline ${focusRing}`}
        >
          {columnName}
        </button>
        {isPatientId && (
          <p className="mt-1 text-xs font-semibold text-primary-dark">{PATIENT_ID_MARKER}</p>
        )}
      </td>
      <td className={cellClass}>
        {CLASS_LABELS[column.effectiveClass]}
        {column.overridden && (
          <p className="mt-1 text-xs font-semibold text-primary-dark">{OVERRIDDEN_MARKER}</p>
        )}
      </td>
      <td className={cellClass}>
        {ACTION_LABELS[column.effectiveAction]}
        {column.actionSource === "explicit" && (
          <p className="mt-1 text-xs font-semibold text-primary-dark">{EXPLICIT_ACTION_MARKER}</p>
        )}
        {column.actionSource === "proposed" &&
          column.effectiveAction === "pseudonymize" &&
          column.effectiveClass === "quasi-identifier" && (
            <p className="mt-1 text-xs font-semibold text-primary-dark">{PROPOSED_ACTION_MARKER}</p>
          )}
        {column.actionLocked && (
          <p className="mt-1 text-xs font-semibold text-primary-dark">{LOCKED_ACTION_MARKER}</p>
        )}
        {/*
          The explicit date role stays visible in the comparison where it is
          relevant (never inferred, never color-only).
        */}
        {column.dateRole !== "none" && (
          <p className="mt-1 text-xs font-semibold text-primary-dark">
            {DATE_ROLE_LABELS[column.dateRole]}
          </p>
        )}
      </td>
      {/*
        Pending state as text. "Review required" is the canonical fail-closed
        marker; "Sin pendientes" is a factual per-row statement and never an
        output-ready claim (readiness stays with the global gate facts).
      */}
      <td className={`${cellClass} font-semibold`}>
        {column.requiresReview ? (
          <span className="text-primary-dark">Review required</span>
        ) : (
          <span className="text-neutral-800">{ROW_SETTLED_LABEL}</span>
        )}
      </td>
    </tr>
  );
}

/**
 * The contextual inspector (issue #85): ONLY the selected column's editing
 * surface, alongside the table at desktop width and stacked below it on
 * narrow screens. It renders the same bounded controls the former per-column
 * cards offered — the canonical callbacks stay the only write path.
 */
function ColumnInspector(props: {
  column: StructuredColumnState;
  isPatientId: boolean;
  isPending: boolean;
  otherPendingIndices: readonly number[];
  onSelectColumn: (columnIndex: number) => void;
  onOverrideClass: (columnIndex: number, columnClass: ColumnClass) => void;
  onOverrideAction?: (columnIndex: number, action: StructuredAction) => void;
  onSetDateRole?: (columnIndex: number, role: StructuredDateRole) => void;
}): ReactElement {
  const {
    column,
    isPatientId,
    isPending,
    otherPendingIndices,
    onSelectColumn,
    onOverrideClass,
    onOverrideAction,
    onSetDateRole,
  } = props;
  const selectId = `structured-class-${column.columnIndex}`;
  const actionSelectId = `structured-action-${column.columnIndex}`;
  const dateRoleSelectId = `structured-date-role-${column.columnIndex}`;
  const columnName = column.header === "" ? "(unnamed column)" : column.header;
  return (
    <aside
      aria-label="Inspector de columna"
      className="rounded border border-primary bg-surface-light p-3 lg:sticky lg:top-4"
    >
      <h3 className="font-display text-base font-bold text-primary-dark">{columnName}</h3>
      {isPatientId && (
        <p className="mt-1 text-xs font-semibold text-primary-dark">{PATIENT_ID_MARKER}</p>
      )}

      {/*
        Outcome F (issue #85 keeps it): authority facts stay immediately
        visible in the inspector — effective classification (with its
        reviewer-override marker), the effective productive Action (with its
        source), the current date role and the patient-ID note are never
        behind a disclosure, so a safety fact can never be hidden as a
        false-ready state.
      */}
      <dl className="mt-2 space-y-1 text-sm text-neutral-800">
        <div className="flex flex-wrap gap-2">
          <dt className="font-semibold">Classification:</dt>
          <dd>
            {CLASS_LABELS[column.effectiveClass]}
            {column.overridden ? ` (${OVERRIDDEN_MARKER})` : ""}
          </dd>
        </div>
        <div className="flex flex-wrap gap-2">
          <dt className="font-semibold">Action:</dt>
          <dd>
            {ACTION_LABELS[column.effectiveAction]}
            {column.actionSource === "explicit" ? ` (${EXPLICIT_ACTION_MARKER})` : ""}
            {column.actionSource === "proposed" &&
            column.effectiveAction === "pseudonymize" &&
            column.effectiveClass === "quasi-identifier"
              ? ` (${PROPOSED_ACTION_MARKER})`
              : ""}
            {column.actionLocked ? ` (${LOCKED_ACTION_MARKER})` : ""}
          </dd>
        </div>
        <div className="flex flex-wrap gap-2">
          <dt className="font-semibold">Date role:</dt>
          <dd>{DATE_ROLE_LABELS[column.dateRole]}</dd>
        </div>
        {isPatientId && (
          <div className="flex flex-wrap gap-2">
            <dt className="font-semibold">Patient ID:</dt>
            <dd>This column is the single patient-ID authority.</dd>
          </div>
        )}
      </dl>

      {/*
        Secondary evidence is grouped behind a native <details> disclosure to
        cut all-at-once density. `<summary>` is a real keyboard control with a
        visible focus ring; nothing safety-relevant is only here.
      */}
      <details className="mt-2 rounded border border-neutral-300 bg-white p-2">
        <summary
          className={`cursor-pointer rounded text-sm font-semibold text-primary-dark ${focusRing}`}
        >
          Evidence and detected details for {columnName}
        </summary>
        <dl className="mt-2 space-y-1 text-sm text-neutral-800">
          <div className="flex flex-wrap gap-2">
            <dt className="font-semibold">Detected class:</dt>
            <dd>{CLASS_LABELS[column.detectedClass]}</dd>
          </div>
          <div className="flex flex-wrap gap-2">
            <dt className="font-semibold">Proposed action:</dt>
            <dd>{PROPOSAL_LABELS[column.proposedAction]}</dd>
          </div>
          <div className="flex flex-wrap gap-2">
            <dt className="font-semibold">Inferred type:</dt>
            <dd>{TYPE_LABELS[column.inferredType]}</dd>
          </div>
          <div className="flex flex-wrap gap-2">
            <dt className="font-semibold">Confidence:</dt>
            <dd>{Math.round(column.confidence * 100)}%</dd>
          </div>
          <div className="flex flex-wrap gap-2">
            <dt className="font-semibold">Non-empty values:</dt>
            <dd>{column.nonEmptyCount}</dd>
          </div>
        </dl>

        <div className="mt-2">
          <h4 className="text-xs font-bold text-primary-dark">Evidence</h4>
          <ul
            aria-label={`Evidence for column ${columnName}`}
            className="mt-1 list-disc space-y-0.5 pl-5 text-xs text-neutral-700"
          >
            {column.evidence.map((item, index) => (
              <li key={index}>{item}</li>
            ))}
          </ul>
        </div>

        {onSetDateRole !== undefined && (
          <p className="mt-2 text-xs text-neutral-700">
            Temporal meaning only; it never changes the classification and is never inferred.
          </p>
        )}
      </details>

      <label htmlFor={selectId} className="mt-3 block text-sm font-semibold text-neutral-800">
        Reviewer classification for {columnName}
      </label>
      <select
        id={selectId}
        value={column.effectiveClass}
        onChange={(event) => onOverrideClass(column.columnIndex, event.target.value as ColumnClass)}
        className={`mt-1 w-full rounded border border-primary bg-white px-2 py-1 text-sm ${focusRing}`}
      >
        {STRUCTURED_COLUMN_CLASSES.map((columnClass) => (
          <option key={columnClass} value={columnClass}>
            {CLASS_LABELS[columnClass]}
          </option>
        ))}
      </select>

      {onSetDateRole !== undefined && (
        <>
          <label
            htmlFor={dateRoleSelectId}
            className="mt-3 block text-sm font-semibold text-neutral-800"
          >
            Date role for {columnName}
          </label>
          <select
            id={dateRoleSelectId}
            value={column.dateRole}
            onChange={(event) =>
              onSetDateRole(column.columnIndex, event.target.value as StructuredDateRole)
            }
            className={`mt-1 w-full rounded border border-primary bg-white px-2 py-1 text-sm ${focusRing}`}
          >
            {STRUCTURED_DATE_ROLES.map((role) => (
              <option key={role} value={role}>
                {DATE_ROLE_LABELS[role]}
              </option>
            ))}
          </select>
        </>
      )}

      {/*
        REC-03 WU-B (D-021): the bounded Action control. Locked stronger
        authorities render as derived text (no contradicting choice is
        offered); a non-date, non-patient-ID quasi-identifier offers exactly
        its bounded choices; every other column renders its derived Action as
        text, with Unknown guidance pointing at class resolution (Unknown can
        never become Keep directly).
      */}
      {onOverrideAction !== undefined &&
        !column.actionLocked &&
        column.allowedActions.length > 1 && (
          <>
            <label
              htmlFor={actionSelectId}
              className="mt-3 block text-sm font-semibold text-neutral-800"
            >
              Reviewer action for {columnName}
            </label>
            <select
              id={actionSelectId}
              value={column.effectiveAction}
              onChange={(event) =>
                onOverrideAction(column.columnIndex, event.target.value as StructuredAction)
              }
              className={`mt-1 w-full rounded border border-primary bg-white px-2 py-1 text-sm ${focusRing}`}
            >
              {column.allowedActions.map((action) => (
                <option key={action} value={action}>
                  {ACTION_LABELS[action]}
                </option>
              ))}
            </select>
          </>
        )}
      {column.actionLocked && (
        <p className="mt-3 text-sm text-neutral-800">
          <span className="font-semibold">Action locked:</span>{" "}
          {isPatientId
            ? "the patient-ID authority derives Study ID; no other action can be selected."
            : "the explicit date role derives Date policy; no other action can be selected."}
        </p>
      )}
      {onOverrideAction !== undefined &&
        !column.actionLocked &&
        column.effectiveClass === "unknown" &&
        (column.allowedActions.includes("process-as-text") ? (
          <p className="mt-3 text-sm text-neutral-800">
            Unknown columns cannot be kept directly. Change the classification above, or route this
            text column through the text engine with “Process as text”.
          </p>
        ) : (
          <p className="mt-3 text-sm text-neutral-800">
            Unknown columns cannot take a productive action directly. Change the classification
            above to resolve this column.
          </p>
        ))}

      {/*
        Resolution acknowledgment + reachable next action (issue #85): when
        the inspected column drops out of the pending set, the inspector says
        so factually and offers the next unresolved column WITHOUT auto-
        acceptance and without ever claiming output readiness from that fact.
      */}
      {!isPending && otherPendingIndices.length > 0 && (
        <div className="mt-3 rounded border border-primary/40 bg-white p-2">
          <p role="status" className="text-sm font-semibold text-neutral-800">
            Esta columna ya no tiene pendientes.
          </p>
          <button
            type="button"
            onClick={() => onSelectColumn(otherPendingIndices[0])}
            className={`mt-2 rounded border border-primary-dark px-3 py-1.5 text-sm font-semibold text-primary-dark hover:bg-surface-dark hover:text-white ${focusRing}`}
          >
            Ir a la siguiente columna pendiente
          </button>
        </div>
      )}
    </aside>
  );
}
