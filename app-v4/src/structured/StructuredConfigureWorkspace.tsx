/**
 * Structured Configure workspace (Work Order T20 #24; SPEC_V4_BATCH_AND_
 * STRUCTURED.md §5-§7, SPEC_V4_APP_AND_REVIEW.md §4/§9, DEBT UX-015/
 * PRODUCT-006).
 *
 * Renders the canonical structured configuration (`configuration.ts`) as the
 * "Configure" step of the common app shell:
 *   - every column is visibly classified as Identifier / Quasi-Identifier /
 *     Sensitive / Insensitive / Unknown (D-012), with its effective productive
 *     Action (D-021, REC-03 WU-B): Class and Action are separate facts;
 *   - an Unknown column, and a non-date quasi-identifier with no bounded
 *     explicit action, are visibly "Review required" and keep the structured
 *     export gate closed (D-009; UNKNOWN is not KEEP);
 *   - stronger authorities (patient-ID selection, explicit date role) visibly
 *     lock/derive the Action instead of offering a contradicting choice;
 *   - confidence and value-free evidence are inspectable for human review;
 *   - the reviewer can override any column's class, which goes back to the
 *     domain bridge and rebuilds the canonical configuration (never a
 *     label-only change);
 *   - the single patient-ID authority (SPEC §6) is shown ONCE; this component
 *     never re-derives it, it renders the domain resolution verbatim.
 *
 * The component is CONTROLLED: the frozen configuration comes in as a prop and
 * every change goes out through a callback to the domain state bridge. Local
 * state is limited to transient view concerns (the pending sheet selection).
 *
 * Accessibility (SPEC §9): native `label`/`select`/`button` semantics, visible
 * focus rings, status conveyed as text (never color alone), and a responsive
 * layout that stacks on narrow screens.
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
  /** Load an explicitly selected worksheet (never a silent first sheet). */
  readonly onSelectSheet: (sheetName: string) => void;
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
};

export function StructuredConfigureWorkspace(
  props: StructuredConfigureWorkspaceProps
): ReactElement {
  const {
    configuration,
    errorMessage = null,
    sheetNames = null,
    onSelectSheet,
    onOverrideClass,
    onOverrideAction,
    onSelectPatientId,
    onSetDateRole,
    exportReadiness = null,
  } = props;

  return (
    <section aria-labelledby="configure-step-heading">
      <h2 id="configure-step-heading" className="font-display text-xl font-bold text-primary-dark">
        Configure
      </h2>
      <p className="mt-2 max-w-3xl text-base leading-relaxed">
        Review how each column has been classified before review. Classes are proposals with
        confidence and evidence; you can change any of them. Unknown columns always require review
        and are never treated as safe to keep.
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
        />
      )}
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

function ConfigurationView(props: {
  configuration: StructuredConfiguration;
  onOverrideClass: (columnIndex: number, columnClass: ColumnClass) => void;
  onOverrideAction?: (columnIndex: number, action: StructuredAction) => void;
  onSelectPatientId: (header: string | null) => void;
  onSetDateRole?: (columnIndex: number, role: StructuredDateRole) => void;
  exportReadiness: { readonly ready: boolean; readonly reasons: readonly string[] } | null;
}): ReactElement {
  const {
    configuration,
    onOverrideClass,
    onOverrideAction,
    onSelectPatientId,
    onSetDateRole,
    exportReadiness,
  } = props;
  const patientIdIndex =
    configuration.patientId.status === "resolved" ? configuration.patientId.columnIndex : null;

  return (
    <div className="mt-4 space-y-4">
      <ConfigurationSummary configuration={configuration} exportReadiness={exportReadiness} />
      <PatientIdAuthority configuration={configuration} onSelectPatientId={onSelectPatientId} />
      <section
        aria-label="Column classifications"
        className="rounded border border-primary bg-surface-light p-3"
      >
        <h3 className="font-display text-base font-bold text-primary-dark">Columns</h3>
        <ul aria-label="Column classification list" className="mt-3 grid gap-3 md:grid-cols-2">
          {configuration.columns.map((column) => (
            <ColumnCard
              key={column.columnIndex}
              column={column}
              isPatientId={patientIdIndex === column.columnIndex}
              onOverrideClass={onOverrideClass}
              onOverrideAction={onOverrideAction}
              onSetDateRole={onSetDateRole}
            />
          ))}
        </ul>
      </section>
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
      aria-label="Patient ID authority"
      className="rounded border border-primary bg-surface-light p-3"
    >
      <h3 className="font-display text-base font-bold text-primary-dark">Patient ID authority</h3>
      <p className="mt-2 text-sm text-neutral-800">
        Exactly one patient-ID column is authoritative for this structured job. It is chosen here
        once; columns below never re-declare their own patient-ID meaning.
      </p>
      <label
        htmlFor="patient-id-column"
        className="mt-3 block text-sm font-semibold text-neutral-800"
      >
        Patient ID column
      </label>
      <select
        id="patient-id-column"
        value={configuration.selectedPatientIdColumn ?? ""}
        onChange={(event) =>
          onSelectPatientId(event.target.value === "" ? null : event.target.value)
        }
        className={`mt-1 w-full max-w-sm rounded border border-primary bg-white px-2 py-1 text-sm ${focusRing}`}
      >
        <option value="">Not set</option>
        {configuration.columns.map((column) => (
          <option key={column.columnIndex} value={column.header}>
            {column.header === "" ? "(unnamed column)" : column.header}
          </option>
        ))}
      </select>
      {patientId.status === "resolved" && (
        <p className="mt-2 text-sm text-neutral-800">
          <span className="font-semibold">Selected:</span> {patientId.column}
        </p>
      )}
      {patientId.status === "not-selected" && (
        <p className="mt-2 text-sm text-neutral-800">
          {patientId.candidates.length > 0
            ? `No column selected yet. Detected patient-ID-like columns: ${patientId.candidates.join(", ")}.`
            : "No column selected yet; no patient-ID-like column was detected. Choose one explicitly."}
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

/** One column card with class, effective Action, evidence and override controls. */
function ColumnCard(props: {
  column: StructuredColumnState;
  isPatientId: boolean;
  onOverrideClass: (columnIndex: number, columnClass: ColumnClass) => void;
  onOverrideAction?: (columnIndex: number, action: StructuredAction) => void;
  onSetDateRole?: (columnIndex: number, role: StructuredDateRole) => void;
}): ReactElement {
  const { column, isPatientId, onOverrideClass, onOverrideAction, onSetDateRole } = props;
  const selectId = `structured-class-${column.columnIndex}`;
  const actionSelectId = `structured-action-${column.columnIndex}`;
  const dateRoleSelectId = `structured-date-role-${column.columnIndex}`;
  const columnName = column.header === "" ? "(unnamed column)" : column.header;
  return (
    <li className="rounded border border-primary bg-white p-3">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <h4 className="font-display text-base font-bold text-primary-dark">{columnName}</h4>
        {column.requiresReview && (
          <span className="rounded border border-primary-dark bg-surface-light px-2 py-0.5 text-xs font-semibold text-primary-dark">
            Review required
          </span>
        )}
      </div>

      {/*
        Outcome F: authority facts stay immediately visible. Effective
        classification (with its reviewer-override marker), the effective
        productive Action (with its source), the current date role and the
        patient-ID note are never behind a disclosure, so a safety fact
        can never be hidden as a false-ready state.
      */}
      <dl className="mt-2 space-y-1 text-sm text-neutral-800">
        <div className="flex flex-wrap gap-2">
          <dt className="font-semibold">Classification:</dt>
          <dd>
            {CLASS_LABELS[column.effectiveClass]}
            {column.overridden ? " (reviewer override)" : ""}
          </dd>
        </div>
        <div className="flex flex-wrap gap-2">
          <dt className="font-semibold">Action:</dt>
          <dd>
            {ACTION_LABELS[column.effectiveAction]}
            {column.actionSource === "explicit" ? " (reviewer choice)" : ""}
            {column.actionSource === "proposed" &&
            column.effectiveAction === "pseudonymize" &&
            column.effectiveClass === "quasi-identifier"
              ? " (proposed)"
              : ""}
            {column.actionLocked ? " (derived, locked)" : ""}
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
      <details className="mt-2 rounded border border-neutral-300 bg-surface-light p-2">
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
          <h5 className="text-xs font-bold text-primary-dark">Evidence</h5>
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
        column.effectiveClass === "unknown" && (
          <p className="mt-3 text-sm text-neutral-800">
            Unknown columns cannot take a productive action directly. Change the classification
            above to resolve this column.
          </p>
        )}
    </li>
  );
}
