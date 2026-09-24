/**
 * Confidential Audit data contract and builder (Work Order T08 U2a,
 * GitHub #12).
 *
 * Defines the CONFIDENTIAL internal traceability artifact of the review
 * session: the authorized original↔replacement correspondence (one entry
 * per detection), reviewer notes, the decision trace and the kept-original
 * /restored entries as first-class data. It is a physically and
 * semantically SEPARATE product from Safe Output (CURRENT_DECISIONS.md
 * D-005): the artifact is unmistakably named and marked confidential at
 * the type level (`kind: "confidential-audit"`, `confidential: true`).
 * The deterministic serializer and its explicit warning line arrive in
 * Work Order T08 U2b (app-v4/src/output/confidential-audit-serializer.ts).
 *
 * Single review authority (D-004): no decision, progress or final-text
 * logic is re-implemented here. Everything is derived through the typed
 * facade over `js/domain/review-session.js` (Work Order T01, re-exported
 * by ../review/review-domain).
 *
 * Unlike Safe Output, the audit MAY be built for a pending session: it is
 * the internal traceability artifact and must exist during review.
 * Restored (kept-original) decisions are legitimate completed decisions
 * and are recorded as such — never as errors or "leakage".
 *
 * Fail-closed (D-009): any value crossing a product boundary must prove
 * it is a structurally valid Confidential Audit. isConfidentialAudit
 * validates the data contract; the U2b serializer must import it and
 * reject any non-conforming value with ConfidentialAuditError.
 *
 * Privacy: memory-only pure functions of the session; no module-level
 * mutable state, no persistence, no logging, no network. Session
 * isolation holds by construction (each call derives everything from the
 * given session alone). No anonymity, compliance or certification
 * wording anywhere (D-006).
 */
import {
  getDecision,
  getProgress,
  type ReviewDetection,
  type ReviewSession,
} from "../review/review-domain";

/** Decision status of one mapping entry (pending is the implicit initial state). */
export type ConfidentialAuditEntryStatus = "pending" | "accepted" | "modified" | "restored";

/** One authorized original↔replacement correspondence entry. */
export interface ConfidentialAuditEntry {
  readonly detectionId: string;
  readonly type: string;
  readonly start: number;
  readonly end: number;
  /** Exact original span text, taken from the immutable session source offsets. */
  readonly original: string;
  readonly status: ConfidentialAuditEntryStatus;
  /** Engine/manual proposal, when the detection carries one. */
  readonly proposed?: string;
  /**
   * Final replacement text applied to the source span: the proposal for
   * accepted, the reviewer text for modified, the exact original span for
   * restored (kept original). Absent while the decision is pending.
   */
  readonly replacement?: string;
  /**
   * Reviewer note: the explicit decision note when present, otherwise the
   * detection's own note metadata.
   */
  readonly note?: string;
  /** True only for explicit restored (kept-original) decisions. */
  readonly keptOriginal: boolean;
}

/** Decision trace counts derived from the session authority's progress data. */
export interface ConfidentialAuditTrace {
  readonly total: number;
  readonly accepted: number;
  readonly modified: number;
  readonly restored: number;
  readonly pending: number;
  readonly manual: number;
  readonly canFinalize: boolean;
}

/**
 * The Confidential Audit artifact. Its own enumerable key set carries
 * data (mapping/trace/restoredEntries) that the Safe Output shape
 * structurally cannot hold — the two products are separate by shape,
 * not by naming convention.
 */
export interface ConfidentialAudit {
  readonly kind: "confidential-audit";
  /** Constant, always-true confidentiality marking. */
  readonly confidential: true;
  readonly sessionId: string;
  /** Deterministic ordering by source offset (start, then end, then id). */
  readonly mapping: readonly ConfidentialAuditEntry[];
  readonly trace: ConfidentialAuditTrace;
  /** Restored (kept-original) decisions as first-class data. */
  readonly restoredEntries: readonly ConfidentialAuditEntry[];
}

/**
 * Typed error for invalid Confidential Audit inputs. Fail-closed (D-009):
 * consumers crossing a product boundary — including the U2b serializer —
 * must throw this on any non-conforming value.
 */
export class ConfidentialAuditError extends Error {
  readonly code: string;
  constructor(code: string, message: string) {
    super(message);
    this.name = "ConfidentialAuditError";
    this.code = code;
  }
}

/** The only enumerable keys a Confidential Audit may ever carry. */
const AUDIT_KEYS: readonly string[] = [
  "confidential",
  "kind",
  "mapping",
  "restoredEntries",
  "sessionId",
  "trace",
];

const ENTRY_KEYS: readonly string[] = [
  "detectionId",
  "end",
  "keptOriginal",
  "original",
  "start",
  "status",
  // Optional keys (checked individually): note, proposed, replacement.
];

const TRACE_KEYS: readonly string[] = [
  "accepted",
  "canFinalize",
  "manual",
  "modified",
  "pending",
  "restored",
  "total",
];

function buildEntry(
  session: ReviewSession,
  detection: ReviewDetection,
  isPending: boolean
): ConfidentialAuditEntry {
  const decision = getDecision(session, detection.id);
  const status: ConfidentialAuditEntryStatus = isPending ? "pending" : decision.status;
  let replacement: string | undefined;
  if (status === "accepted") {
    replacement = detection.proposed !== undefined ? detection.proposed : detection.original;
  } else if (status === "modified") {
    // The T01 authority requires a replacement string for 'modified'.
    replacement = decision.replacement;
  } else if (status === "restored") {
    replacement = detection.original;
  }
  const note = decision.note !== undefined ? decision.note : detection.note;
  return Object.freeze({
    detectionId: detection.id,
    type: detection.type,
    start: detection.start,
    end: detection.end,
    original: detection.original,
    status,
    keptOriginal: status === "restored",
    ...(detection.proposed !== undefined ? { proposed: detection.proposed } : {}),
    ...(replacement !== undefined ? { replacement } : {}),
    ...(note !== undefined ? { note } : {}),
  });
}

function bySourceOffset(a: ConfidentialAuditEntry, b: ConfidentialAuditEntry): number {
  return a.start - b.start || a.end - b.end || (a.detectionId < b.detectionId ? -1 : 1);
}

/**
 * Build the Confidential Audit of a review session — pending state
 * allowed (traceability during review). Pure function of the session:
 * every value is derived from the given session alone, deterministically
 * ordered by source offset, and deeply frozen.
 */
export function buildConfidentialAudit(session: ReviewSession): ConfidentialAudit {
  const progress = getProgress(session);
  const pendingIds = new Set(progress.pendingDetections.map((detection) => detection.id));
  const mapping = session.detections
    .map((detection) => buildEntry(session, detection, pendingIds.has(detection.id)))
    .sort(bySourceOffset);
  return Object.freeze({
    kind: "confidential-audit" as const,
    confidential: true as const,
    sessionId: session.sessionId,
    mapping: Object.freeze(mapping),
    trace: Object.freeze({
      total: progress.total,
      accepted: progress.accepted,
      modified: progress.modified,
      restored: progress.restored,
      pending: progress.pending,
      manual: progress.manual,
      canFinalize: progress.canFinalize,
    }),
    restoredEntries: Object.freeze(mapping.filter((entry) => entry.keptOriginal)),
  });
}

function isAuditEntry(value: unknown): boolean {
  if (typeof value !== "object" || value === null) {
    return false;
  }
  const candidate = value as Record<string, unknown>;
  const own = new Set(Object.keys(candidate));
  if (!ENTRY_KEYS.every((key) => own.has(key))) {
    return false;
  }
  if (
    typeof candidate.detectionId !== "string" ||
    typeof candidate.type !== "string" ||
    typeof candidate.start !== "number" ||
    typeof candidate.end !== "number" ||
    typeof candidate.original !== "string" ||
    typeof candidate.keptOriginal !== "boolean"
  ) {
    return false;
  }
  const status = candidate.status;
  if (
    status !== "pending" &&
    status !== "accepted" &&
    status !== "modified" &&
    status !== "restored"
  ) {
    return false;
  }
  for (const key of ["note", "proposed", "replacement"] as const) {
    if (candidate[key] !== undefined && typeof candidate[key] !== "string") {
      return false;
    }
  }
  return true;
}

/**
 * Structural guard for the Confidential Audit data contract. The U2b
 * serializer must import this and fail closed (D-009) on any value it
 * rejects.
 */
export function isConfidentialAudit(value: unknown): value is ConfidentialAudit {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return false;
  }
  const keys = Object.keys(value).sort();
  if (keys.length !== AUDIT_KEYS.length || keys.some((k, i) => k !== AUDIT_KEYS[i])) {
    return false;
  }
  const candidate = value as Record<string, unknown>;
  if (candidate.kind !== "confidential-audit" || candidate.confidential !== true) {
    return false;
  }
  if (typeof candidate.sessionId !== "string") {
    return false;
  }
  const trace = candidate.trace;
  if (typeof trace !== "object" || trace === null) {
    return false;
  }
  const traceKeys = Object.keys(trace).sort();
  if (traceKeys.length !== TRACE_KEYS.length || traceKeys.some((k, i) => k !== TRACE_KEYS[i])) {
    return false;
  }
  const t = trace as Record<string, unknown>;
  if (typeof t.canFinalize !== "boolean") {
    return false;
  }
  for (const key of ["accepted", "manual", "modified", "pending", "restored", "total"] as const) {
    if (typeof t[key] !== "number") {
      return false;
    }
  }
  const restoredEntries = candidate.restoredEntries;
  if (!Array.isArray(restoredEntries) || !restoredEntries.every(isAuditEntry)) {
    return false;
  }
  const mapping = candidate.mapping;
  if (!Array.isArray(mapping) || !mapping.every(isAuditEntry)) {
    return false;
  }
  // Consistency: restoredEntries mirrors the restored subset of the mapping.
  const restoredCount = (mapping as readonly ConfidentialAuditEntry[]).filter(
    (entry) => entry.keptOriginal
  ).length;
  return restoredEntries.length === restoredCount;
}
