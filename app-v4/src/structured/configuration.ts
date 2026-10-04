/**
 * Canonical structured configuration authority for the V4 Configure workspace
 * (Work Order T20 #24; SPEC_V4_BATCH_AND_STRUCTURED.md §5-§7,
 * CURRENT_DECISIONS.md D-009/D-012, DEBT UX-015/PRODUCT-006).
 *
 * T20's Configure step presents the T18/T19 structured facts and lets a human
 * review/change the class of every column. This module is the DOMAIN authority
 * for that configuration:
 *
 *  - it consumes the T18 classification (`classification.ts`) and the single
 *    patient-ID authority (`patient-id.ts`) — it never re-derives either, so
 *    there is exactly one classification authority and exactly one patient-ID
 *    authority (SPEC §5/§6);
 *  - it exposes the five accepted classes verbatim
 *    (Identifier / Quasi-Identifier / Sensitive / Insensitive / Unknown,
 *    D-012) with confidence and value-free evidence for review (SPEC §7);
 *  - an explicit human override REBUILDS the frozen configuration (class,
 *    action, review requirement and export gate all move together) — it is
 *    never a label-only change;
 *  - an unresolved `unknown` column is ALWAYS `review-required`, never `keep`
 *    (D-009), and keeps the structured export gate closed until a human
 *    explicitly resolves it (SPEC §5 "UNKNOWN is not KEEP").
 *
 * This is a T20 Configure-workspace authority only: it intentionally carries
 * NO structured export pipeline and NO ARX-lite risk layer (SPEC §12/§13 are
 * later scope). Sensitive cell content stays memory-only (D-013): the
 * configuration carries structural facts and profiles, and the grid it wraps
 * is never persisted, logged or placed in a URL.
 */
import {
  classifyGridColumns,
  proposedActionForColumn,
  type ColumnClass,
  type ColumnClassification,
  type ProposedAction,
} from "./classification";
import type { ColumnSampleType } from "./column-profile";
import { isBlankCell, type StructuredGrid } from "./grid";
import { resolvePatientIdColumn, type PatientIdResolution } from "./patient-id";

/** Machine-readable codes carried by {@link StructuredConfigurationError}. */
export type StructuredConfigurationErrorCode =
  | "unknown-column"
  | "invalid-class"
  | "invalid-action"
  | "invalid-grid"
  | "invalid-date-role"
  | "duplicate-date-role";

/** Typed configuration failure (D-009 fail-closed). */
export class StructuredConfigurationError extends Error {
  readonly code: StructuredConfigurationErrorCode;

  constructor(code: StructuredConfigurationErrorCode, message: string) {
    super(message);
    this.name = "StructuredConfigurationError";
    this.code = code;
  }
}

/** The five accepted structured classes, in display order (D-012). */
export const STRUCTURED_COLUMN_CLASSES: readonly ColumnClass[] = Object.freeze([
  "identifier",
  "quasi-identifier",
  "sensitive",
  "insensitive",
  "unknown",
]);

/**
 * Effective productive Action authority (REC-03 WU-B, D-021). Class and Action
 * are separate domain facts: the class answers what privacy nature a column
 * has; the Action answers what productively happens to it. The vocabulary is
 * closed — anything outside it fails closed (`invalid-action`):
 *  - `study-id`: the explicitly selected patient-ID column (locked);
 *  - `date-policy`: an explicit `visit`/`birth` date role under T19 (locked);
 *  - `remove`: an ordinary Identifier is dropped from Safe output;
 *  - `keep`: a Sensitive default or an Insensitive column is preserved;
 *  - `pseudonymize`: deterministic column-local `QID_###` tokenization of a
 *    non-date, non-patient-ID quasi-identifier;
 *  - `review-required`: no productive action — export stays blocked until a
 *    bounded explicit action exists or the class is resolved.
 * `process-as-text` (REC-03 WU-C, D-021 free-text columns): an explicit Action
 *   — never a sixth class — routing a text-like cell through the productive
 *   text engine under the Job's REC-02 policy with ReviewSession review. It is
 *   available ONLY for text-like, non-patient-ID, non-date-role quasi,
 *   sensitive and unknown columns (unknown may not become keep; this is its
 *   explicit resolution path). Identifier/Insensitive/patient-ID/date-role
 *   columns reject it typed/closed.
 *
 * `process-as-text` is WU-C scope and is deliberately NOT a member: no
 * reserved slot may silently behave as `keep` before the WU-C engine path
 * exists.
 */
export type StructuredAction =
  | "study-id"
  | "date-policy"
  | "remove"
  | "keep"
  | "pseudonymize"
  | "process-as-text"
  | "review-required";

/** The accepted Action vocabulary, in display order. */
export const STRUCTURED_ACTIONS: readonly StructuredAction[] = Object.freeze([
  "study-id",
  "date-policy",
  "remove",
  "keep",
  "pseudonymize",
  "process-as-text",
  "review-required",
]);

/**
 * Where the effective Action came from:
 *  - `derived`: a stronger authority (patient-ID selection, explicit date
 *    role) fixed it; reviewer overrides can never contradict it;
 *  - `proposed`: the class/header default (including the center/ward
 *    `pseudonymize` proposal) with no explicit reviewer choice yet;
 *  - `explicit`: a bounded reviewer Action choice.
 */
export type StructuredActionSource = "derived" | "proposed" | "explicit";

/**
 * Explicit temporal meaning of a structured column (HARDEN-01 WU-A).
 *
 * ORTHOGONAL to {@link ColumnClass}: the class answers what privacy nature the
 * column has; the date role answers what temporal meaning it carries. It is a
 * human selection only — `none` is the default and nothing is ever inferred
 * (no header/content heuristic activates it; the T19 text-clause classifier is
 * deliberately not reused here).
 */
export type StructuredDateRole = "visit" | "birth" | "none";

/** The accepted date-role vocabulary, in display order. */
export const STRUCTURED_DATE_ROLES: readonly StructuredDateRole[] = Object.freeze([
  "none",
  "visit",
  "birth",
]);

/** One column's resolved, review-facing classification state. */
export type StructuredColumnState = {
  readonly columnIndex: number;
  readonly header: string;
  readonly inferredType: ColumnSampleType;
  readonly nonEmptyCount: number;
  readonly emptyCount: number;
  readonly sampledCount: number;
  /** The class proposed by automatic classification (T18, never overridden). */
  readonly detectedClass: ColumnClass;
  /** The class in effect for this configuration (override or detected). */
  readonly effectiveClass: ColumnClass;
  /** True exactly when a human explicitly overrode the detected class. */
  readonly overridden: boolean;
  /** Action proposed for the effective class; `review-required` for unknown. */
  readonly proposedAction: ProposedAction;
  /**
   * The effective productive Action in force for this column (D-021). This is
   * a separate domain fact from {@link StructuredColumnState.effectiveClass}:
   * stronger authorities (patient-ID, date role) derive and lock it, the
   * class/header proposes a default, and a bounded reviewer choice may refine
   * a non-date quasi-identifier.
   */
  readonly effectiveAction: StructuredAction;
  /** Where {@link StructuredColumnState.effectiveAction} came from. */
  readonly actionSource: StructuredActionSource;
  /**
   * True exactly when a stronger authority (patient-ID selection, explicit
   * date role) fixed the Action: the Configure surface must render it as
   * derived/locked and never offer a contradicting choice.
   */
  readonly actionLocked: boolean;
  /**
   * The bounded Action choices the reviewer may select for this column
   * (always includes the action in effect; locked columns expose exactly
   * their derived action). Never an unconstrained editor.
   */
  readonly allowedActions: readonly StructuredAction[];
  /** True exactly when the effective Action is `review-required` (fail-closed review). */
  readonly requiresReview: boolean;
  /** Confidence of the automatic classification (0..1), for human review. */
  readonly confidence: number;
  /** Value-free structural evidence for human review (SPEC §7). */
  readonly evidence: readonly string[];
  readonly matchedBy: ColumnClassification["matchedBy"];
  /** Explicit temporal role; `"none"` unless a human selected `visit`/`birth`. */
  readonly dateRole: StructuredDateRole;
};

/**
 * Frozen canonical structured configuration. `exportReady` is the structured
 * export gate: it is false while ANY column's effective Action is
 * `review-required` (unknown with no explicit resolution, or a non-date
 * quasi-identifier with no bounded explicit action), so neither can silently
 * become exportable.
 */
export type StructuredConfiguration = {
  readonly grid: StructuredGrid;
  readonly columns: readonly StructuredColumnState[];
  /** The explicit patient-ID selection (or `null`); the ONLY authority source. */
  readonly selectedPatientIdColumn: string | null;
  readonly patientId: PatientIdResolution;
  /** Explicit human class overrides, keyed by column index. */
  readonly overrides: Readonly<Record<number, ColumnClass>>;
  /**
   * Explicit human Action choices, keyed by column index (only entries that
   * differ from the unresolved default). Only a non-date, non-patient-ID
   * quasi-identifier admits productive explicit choices (`pseudonymize`,
   * `keep`, text-like `process-as-text`); text-like Sensitive and Unknown
   * columns admit explicit `process-as-text`; every other combination fails
   * closed at write time and is never stored.
   */
  readonly actionOverrides: Readonly<Record<number, StructuredAction>>;
  /** Explicit date roles, keyed by column index (only non-`none` entries). */
  readonly dateRoles: Readonly<Record<number, StructuredDateRole>>;
  /** Column indices whose effective Action is `review-required` (export blocked). */
  readonly columnsRequiringReview: readonly number[];
  /** Structured export gate (false while any column requires review). */
  readonly exportReady: boolean;
};

function assertGrid(grid: StructuredGrid): void {
  const candidate = grid as Partial<StructuredGrid> | null;
  if (
    candidate === null ||
    typeof candidate !== "object" ||
    !Array.isArray(candidate.headers) ||
    !Array.isArray(candidate.rows)
  ) {
    throw new StructuredConfigurationError(
      "invalid-grid",
      "A structured configuration requires a normalized grid (headers + rows); failing closed instead of guessing."
    );
  }
}

function assertClass(columnClass: ColumnClass): void {
  if (!STRUCTURED_COLUMN_CLASSES.includes(columnClass)) {
    throw new StructuredConfigurationError(
      "invalid-class",
      `"${String(columnClass)}" is not an accepted structured class; the accepted classes are ${STRUCTURED_COLUMN_CLASSES.join(
        ", "
      )}.`
    );
  }
}

/** Freeze the patient-ID resolution (including its candidate list). */
function freezePatientId(patientId: PatientIdResolution): PatientIdResolution {
  if (patientId.status === "not-selected") {
    return Object.freeze({
      status: "not-selected",
      candidates: Object.freeze([...patientId.candidates]),
    });
  }
  return Object.freeze({ ...patientId });
}

function assertAction(action: unknown): asserts action is StructuredAction {
  if (typeof action !== "string" || !STRUCTURED_ACTIONS.includes(action as StructuredAction)) {
    throw new StructuredConfigurationError(
      "invalid-action",
      `"${String(action)}" is not an accepted structured action; the accepted actions are ${STRUCTURED_ACTIONS.join(", ")}.`
    );
  }
}

/**
 * D-021 fixed precedence for the effective Action (derived/fixed outcomes 1–7):
 *  1. selected patient-ID → `study-id` (locked);
 *  2. explicit `visit`/`birth` date role → `date-policy` (locked, T19 unchanged);
 *  3. ordinary Identifier → `remove`;
 *  4. Sensitive → `keep` default;
 *  5. Insensitive → `keep`;
 *  6. Unknown → `review-required`;
 *  7. non-date Quasi-Identifier → `review-required` unless a bounded explicit
 *     action (`pseudonymize` or `keep`) exists.
 *
 * A center/ward quasi-identifier header proposes `pseudonymize` (frozen UX
 * target) as its productive default; every other non-date quasi column stays
 * explicitly `review-required`. There is no universal automatic
 * generalization: the `generalize-without-operator` dead end is gone, and an
 * unresolved quasi is a visible blocked state rather than an operator.
 */
export function allowedActionsForColumn(facts: {
  readonly effectiveClass: ColumnClass;
  readonly header: string;
  readonly dateRole: StructuredDateRole;
  readonly isPatientIdColumn: boolean;
  readonly inferredType: ColumnSampleType;
}): readonly StructuredAction[] {
  if (facts.isPatientIdColumn) return Object.freeze(["study-id"] as const);
  if (facts.dateRole === "visit" || facts.dateRole === "birth") {
    return Object.freeze(["date-policy"] as const);
  }
  // D-021 free-text columns (REC-03 WU-C): `process-as-text` is offered only
  // for text-like columns — never for patient-ID/date-role columns (locked
  // above), ordinary Identifiers or Insensitive columns.
  const textLike = facts.inferredType === "text";
  switch (facts.effectiveClass) {
    case "identifier":
      return Object.freeze(["remove"] as const);
    case "sensitive":
      return textLike
        ? Object.freeze(["keep", "process-as-text"] as const)
        : Object.freeze(["keep"] as const);
    case "insensitive":
      return Object.freeze(["keep"] as const);
    case "unknown":
      return textLike
        ? Object.freeze(["review-required", "process-as-text"] as const)
        : Object.freeze(["review-required"] as const);
    case "quasi-identifier":
      return textLike
        ? Object.freeze(["review-required", "pseudonymize", "keep", "process-as-text"] as const)
        : Object.freeze(["review-required", "pseudonymize", "keep"] as const);
  }
}

function resolveEffectiveAction(facts: {
  readonly effectiveClass: ColumnClass;
  readonly header: string;
  readonly dateRole: StructuredDateRole;
  readonly isPatientIdColumn: boolean;
  readonly explicitAction: StructuredAction | undefined;
}): { readonly action: StructuredAction; readonly source: StructuredActionSource } {
  if (facts.isPatientIdColumn) return { action: "study-id", source: "derived" };
  if (facts.dateRole === "visit" || facts.dateRole === "birth") {
    return { action: "date-policy", source: "derived" };
  }
  if (facts.explicitAction !== undefined)
    return { action: facts.explicitAction, source: "explicit" };
  if (
    facts.effectiveClass === "quasi-identifier" &&
    proposedActionForColumn(facts.effectiveClass, facts.header) === "pseudonymize"
  ) {
    return { action: "pseudonymize", source: "proposed" };
  }
  return {
    action: proposedActionForColumn(facts.effectiveClass, facts.header),
    source: "proposed",
  };
}

function isActionLocked(facts: {
  readonly dateRole: StructuredDateRole;
  readonly isPatientIdColumn: boolean;
}): boolean {
  return facts.isPatientIdColumn || facts.dateRole === "visit" || facts.dateRole === "birth";
}

function resolveColumnState(
  classification: ColumnClassification,
  override: ColumnClass | undefined,
  dateRole: StructuredDateRole | undefined,
  explicitAction: StructuredAction | undefined,
  isPatientIdColumn: boolean
): StructuredColumnState {
  const detectedClass = classification.columnClass;
  const effectiveClass = override ?? detectedClass;
  const resolvedDateRole = dateRole ?? "none";
  const resolved = resolveEffectiveAction({
    effectiveClass,
    header: classification.column.header,
    dateRole: resolvedDateRole,
    isPatientIdColumn,
    explicitAction,
  });
  const locked = isActionLocked({ dateRole: resolvedDateRole, isPatientIdColumn });
  const allowedActions = allowedActionsForColumn({
    effectiveClass,
    header: classification.column.header,
    dateRole: resolvedDateRole,
    isPatientIdColumn,
    inferredType: classification.column.inferredType,
  });
  return Object.freeze({
    columnIndex: classification.column.columnIndex,
    header: classification.column.header,
    inferredType: classification.column.inferredType,
    nonEmptyCount: classification.column.nonEmptyCount,
    emptyCount: classification.column.emptyCount,
    sampledCount: classification.column.sampledCount,
    detectedClass,
    effectiveClass,
    overridden: override !== undefined,
    proposedAction: proposedActionForColumn(effectiveClass, classification.column.header),
    effectiveAction: resolved.action,
    actionSource: resolved.source,
    actionLocked: locked,
    allowedActions,
    requiresReview: resolved.action === "review-required",
    confidence: classification.confidence,
    evidence: Object.freeze([...classification.evidence]),
    matchedBy: classification.matchedBy,
    dateRole: resolvedDateRole,
  });
}

function assertDateRole(role: unknown): asserts role is StructuredDateRole {
  if (role !== "visit" && role !== "birth" && role !== "none") {
    throw new StructuredConfigurationError(
      "invalid-date-role",
      `"${String(role)}" is not an accepted date role; the accepted roles are visit, birth, none.`
    );
  }
}

/**
 * Normalize explicit date roles: drop `none` entries, validate vocabulary,
 * reject out-of-range columns, and reject two columns claiming the same
 * `visit`/`birth` role (ambiguous role selection is never resolved silently).
 */
function normalizeDateRoles(
  raw: Readonly<Record<number, StructuredDateRole>>,
  columnCount: number
): Record<number, StructuredDateRole> {
  const normalized: Record<number, StructuredDateRole> = {};
  const seenRoles = new Set<StructuredDateRole>();
  for (const [rawKey, role] of Object.entries(raw)) {
    const columnIndex = Number(rawKey);
    if (!Number.isInteger(columnIndex) || columnIndex < 0 || columnIndex >= columnCount) {
      throw new StructuredConfigurationError(
        "unknown-column",
        `Date role references column index ${String(rawKey)}, which does not exist in this structured job (${columnCount} column(s)).`
      );
    }
    assertDateRole(role);
    if (role === "none") continue;
    if (seenRoles.has(role)) {
      throw new StructuredConfigurationError(
        "duplicate-date-role",
        `Two columns were assigned the date role "${role}"; exactly one ${role} column may be selected.`
      );
    }
    seenRoles.add(role);
    normalized[columnIndex] = role;
  }
  return normalized;
}

/**
 * Validate an explicit Action choice against the bounded D-021 matrix and
 * return the normalized action-override entry for storage. `review-required`
 * on a non-date quasi-identifier clears back to the unresolved default (no
 * entry is stored). Anything outside the bounded choices fails closed with
 * `invalid-action`:
 *  - locked columns (patient-ID, explicit date role) can never be
 *    contradicted — only their derived action is accepted (as a no-op);
 *  - Unknown can never take a productive action directly while remaining
 *    Unknown, EXCEPT explicit text-like `process-as-text` (its D-021
 *    resolution path; never KEEP);
 *  - ordinary Identifier admits `remove` only; Sensitive/Insensitive admit
 *    `keep` only (Sensitive additionally admits text-like `process-as-text`);
 *    a quasi-identifier admits `pseudonymize`, `keep` or `review-required`
 *    (clear), plus text-like `process-as-text`.
 */
function normalizeActionOverride(facts: {
  readonly effectiveClass: ColumnClass;
  readonly header: string;
  readonly dateRole: StructuredDateRole;
  readonly isPatientIdColumn: boolean;
  readonly inferredType: ColumnSampleType;
  readonly action: StructuredAction;
}): StructuredAction | undefined {
  const allowed = allowedActionsForColumn(facts);
  if (isActionLocked(facts)) {
    if (facts.action !== allowed[0]) {
      const authority = facts.isPatientIdColumn
        ? "the patient-ID authority derives study-id"
        : "the explicit date role derives date-policy";
      throw new StructuredConfigurationError(
        "invalid-action",
        `Action "${facts.action}" contradicts the locked derived action "${allowed[0]}" (${authority}); failing closed instead of contradicting a stronger authority.`
      );
    }
    return undefined;
  }
  if (facts.effectiveClass === "unknown" && facts.action !== "review-required") {
    // D-021 free-text resolution path (REC-03 WU-C): an Unknown column may
    // take explicit `process-as-text` when it is text-like — its explicit
    // resolution path, since Unknown may never become KEEP. Any other
    // productive action while remaining Unknown fails closed.
    if (facts.action === "process-as-text" && facts.inferredType === "text") {
      return facts.action;
    }
    throw new StructuredConfigurationError(
      "invalid-action",
      `Unknown column "${facts.header === "" ? "(unnamed column)" : facts.header}" cannot take the productive action "${facts.action}" directly while remaining Unknown; change its class or leave it unresolved.`
    );
  }
  if (!allowed.includes(facts.action)) {
    throw new StructuredConfigurationError(
      "invalid-action",
      `Action "${facts.action}" is not allowed for a ${facts.effectiveClass} column "${facts.header === "" ? "(unnamed column)" : facts.header}"; the bounded choices are ${allowed.join(", ")}.`
    );
  }
  // `review-required` on a quasi-identifier restores the unresolved default.
  if (facts.effectiveClass === "quasi-identifier" && facts.action === "review-required") {
    return undefined;
  }
  // Choices identical to the class/header default carry no explicit delta.
  if (facts.action === proposedActionForColumn(facts.effectiveClass, facts.header)) {
    return undefined;
  }
  return facts.action;
}

/** Build the frozen configuration from a grid, a selection and overrides. */
function buildConfiguration(
  grid: StructuredGrid,
  selectedPatientIdColumn: string | null,
  overrides: Readonly<Record<number, ColumnClass>>,
  dateRoles: Readonly<Record<number, StructuredDateRole>> = {},
  actionOverrides: Readonly<Record<number, StructuredAction>> = {}
): StructuredConfiguration {
  assertGrid(grid);
  const classifications = classifyGridColumns(grid);

  const normalizedOverrides: Record<number, ColumnClass> = {};
  for (const [rawKey, columnClass] of Object.entries(overrides)) {
    const columnIndex = Number(rawKey);
    if (
      !Number.isInteger(columnIndex) ||
      columnIndex < 0 ||
      columnIndex >= classifications.length
    ) {
      throw new StructuredConfigurationError(
        "unknown-column",
        `Override references column index ${String(rawKey)}, which does not exist in this structured job (${classifications.length} column(s)).`
      );
    }
    assertClass(columnClass);
    normalizedOverrides[columnIndex] = columnClass;
  }

  const normalizedDateRoles = normalizeDateRoles(dateRoles, classifications.length);

  const patientId = freezePatientId(
    resolvePatientIdColumn({
      selectedPatientIdColumn,
      classifications,
    })
  );
  const patientColumnIndex = patientId.status === "resolved" ? patientId.columnIndex : null;

  const normalizedActionOverrides: Record<number, StructuredAction> = {};
  for (const [rawKey, action] of Object.entries(actionOverrides)) {
    const columnIndex = Number(rawKey);
    if (
      !Number.isInteger(columnIndex) ||
      columnIndex < 0 ||
      columnIndex >= classifications.length
    ) {
      throw new StructuredConfigurationError(
        "unknown-column",
        `Action override references column index ${String(rawKey)}, which does not exist in this structured job (${classifications.length} column(s)).`
      );
    }
    assertAction(action);
    const classification = classifications[columnIndex];
    const isLockedColumn =
      columnIndex === patientColumnIndex || (normalizedDateRoles[columnIndex] ?? "none") !== "none";
    if (isLockedColumn) {
      // A stronger authority is in force: the stored choice goes dormant
      // (verified again when the lock releases) and the derived action wins.
      // Vocabulary-checked only, so no invalid combination can be stored.
      normalizedActionOverrides[columnIndex] = action;
      continue;
    }
    const entry = normalizeActionOverride({
      effectiveClass: normalizedOverrides[columnIndex] ?? classification.columnClass,
      header: classification.column.header,
      dateRole: normalizedDateRoles[columnIndex] ?? "none",
      isPatientIdColumn: false,
      inferredType: classification.column.inferredType,
      action,
    });
    if (entry !== undefined) normalizedActionOverrides[columnIndex] = entry;
  }

  const columns = classifications.map((classification) =>
    resolveColumnState(
      classification,
      normalizedOverrides[classification.column.columnIndex],
      normalizedDateRoles[classification.column.columnIndex],
      normalizedActionOverrides[classification.column.columnIndex],
      classification.column.columnIndex === patientColumnIndex
    )
  );
  const columnsRequiringReview = columns
    .filter((column) => column.requiresReview)
    .map((column) => column.columnIndex);

  return Object.freeze({
    grid,
    columns: Object.freeze(columns),
    selectedPatientIdColumn,
    patientId,
    overrides: Object.freeze({ ...normalizedOverrides }),
    actionOverrides: Object.freeze({ ...normalizedActionOverrides }),
    dateRoles: Object.freeze({ ...normalizedDateRoles }),
    columnsRequiringReview: Object.freeze(columnsRequiringReview),
    exportReady: columnsRequiringReview.length === 0,
  });
}

/**
 * Create the canonical configuration of a structured grid. `unknown` columns
 * start requiring review (never KEEP); the patient-ID authority starts
 * unselected unless an explicit selection is supplied (SPEC §6).
 */
export function createStructuredConfiguration(
  grid: StructuredGrid,
  options: {
    readonly selectedPatientIdColumn?: string | null;
    readonly overrides?: Readonly<Record<number, ColumnClass>>;
    readonly dateRoles?: Readonly<Record<number, StructuredDateRole>>;
    readonly actionOverrides?: Readonly<Record<number, StructuredAction>>;
  } = {}
): StructuredConfiguration {
  return buildConfiguration(
    grid,
    options.selectedPatientIdColumn ?? null,
    options.overrides ?? {},
    options.dateRoles ?? {},
    options.actionOverrides ?? {}
  );
}

/**
 * Apply an explicit human override of one column's class. Rebuilds the frozen
 * configuration so the class, its derived action, its review requirement and
 * the export gate all move together. Fails closed on an out-of-range column or
 * a class outside the five accepted ones.
 */
export function overrideColumnClass(
  configuration: StructuredConfiguration,
  columnIndex: number,
  columnClass: ColumnClass
): StructuredConfiguration {
  assertClass(columnClass);
  if (
    !Number.isInteger(columnIndex) ||
    columnIndex < 0 ||
    columnIndex >= configuration.columns.length
  ) {
    throw new StructuredConfigurationError(
      "unknown-column",
      `Cannot override column index ${String(columnIndex)}: this structured job has ${configuration.columns.length} column(s).`
    );
  }
  // A class change may invalidate a stored Action choice (e.g. an explicit
  // quasi `pseudonymize` followed by an override to Sensitive): the stale
  // choice is dropped fail-closed back to the new class default rather than
  // kept as an invalid combination. Locking authorities keep their stored
  // entries dormant (they revive if the lock is released).
  const nextActionOverrides: Record<number, StructuredAction> = {};
  for (const [rawKey, action] of Object.entries(configuration.actionOverrides)) {
    const index = Number(rawKey);
    if (index === columnIndex) continue;
    nextActionOverrides[index] = action;
  }
  const pendingExplicit = configuration.actionOverrides[columnIndex];
  if (pendingExplicit !== undefined) {
    const column = configuration.columns[columnIndex];
    const isLockedColumn =
      (configuration.patientId.status === "resolved" &&
        configuration.patientId.columnIndex === columnIndex) ||
      column.dateRole !== "none";
    if (isLockedColumn) {
      // Dormant under a stronger authority: preserved verbatim (vocabulary is
      // already closed); re-validated when the lock releases.
      nextActionOverrides[columnIndex] = pendingExplicit;
    } else {
      const candidateAllowed = allowedActionsForColumn({
        effectiveClass: columnClass,
        header: column.header,
        dateRole: column.dateRole,
        isPatientIdColumn: false,
        inferredType: column.inferredType,
      });
      if (candidateAllowed.includes(pendingExplicit)) {
        nextActionOverrides[columnIndex] = pendingExplicit;
      }
    }
  }
  return buildConfiguration(
    configuration.grid,
    configuration.selectedPatientIdColumn,
    {
      ...configuration.overrides,
      [columnIndex]: columnClass,
    },
    configuration.dateRoles,
    nextActionOverrides
  );
}

/**
 * Set (or clear with `"none"`) one column's explicit date role. Rebuilds the
 * frozen configuration through the same single authority; a duplicate
 * `visit`/`birth` selection or an out-of-range column fails closed. This is an
 * ORTHOGONAL field: it never changes a column's classification.
 */
export function setStructuredDateRole(
  configuration: StructuredConfiguration,
  columnIndex: number,
  role: StructuredDateRole
): StructuredConfiguration {
  assertDateRole(role);
  if (
    !Number.isInteger(columnIndex) ||
    columnIndex < 0 ||
    columnIndex >= configuration.columns.length
  ) {
    throw new StructuredConfigurationError(
      "unknown-column",
      `Cannot set the date role of column index ${String(columnIndex)}: this structured job has ${configuration.columns.length} column(s).`
    );
  }
  const nextDateRoles: Record<number, StructuredDateRole> = { ...configuration.dateRoles };
  if (role === "none") {
    delete nextDateRoles[columnIndex];
  } else {
    nextDateRoles[columnIndex] = role;
  }
  return buildConfiguration(
    configuration.grid,
    configuration.selectedPatientIdColumn,
    configuration.overrides,
    nextDateRoles,
    role === "none"
      ? pruneActionOverrideForUnlock(configuration, columnIndex, {
          dateRole: "none",
          isPatientIdColumn:
            configuration.patientId.status === "resolved" &&
            configuration.patientId.columnIndex === columnIndex,
        })
      : configuration.actionOverrides
  );
}

/**
 * After a transition that may release a locking authority, drop the affected
 * column's dormant Action choice when it is no longer allowed under the new
 * facts. Never throws: the column falls back to its class/header default
 * (fail-closed `review-required` for an unresolved quasi).
 */
function pruneActionOverrideForUnlock(
  configuration: StructuredConfiguration,
  columnIndex: number,
  nextFacts: { readonly dateRole: StructuredDateRole; readonly isPatientIdColumn: boolean }
): Readonly<Record<number, StructuredAction>> {
  const pending = configuration.actionOverrides[columnIndex];
  if (pending === undefined) return configuration.actionOverrides;
  if (nextFacts.dateRole !== "none" || nextFacts.isPatientIdColumn) {
    return configuration.actionOverrides;
  }
  const column = configuration.columns[columnIndex];
  const allowed = allowedActionsForColumn({
    effectiveClass: column.effectiveClass,
    header: column.header,
    dateRole: "none",
    isPatientIdColumn: false,
    inferredType: column.inferredType,
  });
  if (allowed.includes(pending)) return configuration.actionOverrides;
  const pruned: Record<number, StructuredAction> = { ...configuration.actionOverrides };
  delete pruned[columnIndex];
  return pruned;
}

/**
 * Set the single patient-ID column authority (or clear it with `null`).
 * Rebuilds the frozen configuration through the T18 `resolvePatientIdColumn`
 * authority; the UI never constructs the resolution itself.
 */
export function selectPatientIdColumn(
  configuration: StructuredConfiguration,
  header: string | null
): StructuredConfiguration {
  // Releasing the previous selection may unlock its column: prune a dormant
  // choice that is no longer allowed there. The newly selected column locks
  // (its stored choice, if any, goes dormant and is carried verbatim).
  const previousIndex =
    configuration.patientId.status === "resolved" ? configuration.patientId.columnIndex : null;
  let nextActionOverrides: Readonly<Record<number, StructuredAction>> =
    configuration.actionOverrides;
  if (previousIndex !== null && header !== configuration.selectedPatientIdColumn) {
    const previous = configuration.columns[previousIndex];
    const dateRole =
      previous === undefined ? "none" : (configuration.dateRoles[previousIndex] ?? "none");
    nextActionOverrides = pruneActionOverrideForUnlock(configuration, previousIndex, {
      dateRole,
      isPatientIdColumn: false,
    });
  }
  return buildConfiguration(
    configuration.grid,
    header,
    configuration.overrides,
    configuration.dateRoles,
    nextActionOverrides
  );
}

/**
 * Apply an explicit human choice of one column's productive Action. Rebuilds
 * the single canonical frozen configuration so the Action, its review
 * requirement and the export gate all move together — never a label-only
 * edit. The bounded D-021 matrix is enforced closed (see
 * {@link allowedActionsForColumn}): locked derived actions cannot be
 * contradicted, Unknown cannot become productive directly, and anything
 * outside the vocabulary fails with typed `invalid-action`.
 */
export function overrideColumnAction(
  configuration: StructuredConfiguration,
  columnIndex: number,
  action: StructuredAction
): StructuredConfiguration {
  assertAction(action);
  if (
    !Number.isInteger(columnIndex) ||
    columnIndex < 0 ||
    columnIndex >= configuration.columns.length
  ) {
    throw new StructuredConfigurationError(
      "unknown-column",
      `Cannot set the action of column index ${String(columnIndex)}: this structured job has ${configuration.columns.length} column(s).`
    );
  }
  const column = configuration.columns[columnIndex];
  const isPatientIdColumn =
    configuration.patientId.status === "resolved" &&
    configuration.patientId.columnIndex === columnIndex;
  // Validate closed BEFORE rebuilding: contradicts locked authorities,
  // productive Unknown, and out-of-matrix combinations all throw here.
  const entry = normalizeActionOverride({
    effectiveClass: column.effectiveClass,
    header: column.header,
    dateRole: column.dateRole,
    isPatientIdColumn,
    inferredType: column.inferredType,
    action,
  });
  const nextActionOverrides: Record<number, StructuredAction> = {
    ...configuration.actionOverrides,
  };
  if (entry === undefined) {
    delete nextActionOverrides[columnIndex];
  } else {
    nextActionOverrides[columnIndex] = entry;
  }
  // No-op when nothing changes: return the identical frozen configuration.
  if (
    (entry === undefined && configuration.actionOverrides[columnIndex] === undefined) ||
    configuration.actionOverrides[columnIndex] === entry
  ) {
    return configuration;
  }
  return buildConfiguration(
    configuration.grid,
    configuration.selectedPatientIdColumn,
    configuration.overrides,
    configuration.dateRoles,
    nextActionOverrides
  );
}

/**
 * The structured export gate fact (D-009/D-021). False while any column's
 * effective Action is `review-required` — an unknown column AND an unresolved
 * non-date quasi-identifier are never exportable without an explicit human
 * decision (a bounded Action choice or a class resolution).
 */
export function isStructuredExportReady(configuration: StructuredConfiguration): boolean {
  return configuration.exportReady;
}

export { isBlankCell };
export type { ColumnClass, ColumnClassification, ProposedAction };
