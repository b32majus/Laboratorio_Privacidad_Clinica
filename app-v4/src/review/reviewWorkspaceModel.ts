/**
 * Pure model helpers for the review workspace (Work Order T07).
 *
 * Everything here derives from the ReviewSession (the only review authority,
 * D-004); nothing mutates it. The document surface is composed from source
 * offsets — rendered markup is never parsed back into state.
 */
import type { ReviewDetection, ReviewSession } from "../../../js/domain/review-session.js";

/**
 * Confidence below which a candidate is labeled and filterable as
 * "low confidence" (D-008: visible and reviewable, never hidden). The
 * engine's hard floor is 0.5 (umbralConfianza); anything detected above the
 * floor but below this conservative band is surfaced for explicit reviewer
 * attention. This is a display/filter band only: it never changes decisions.
 */
export const LOW_CONFIDENCE_THRESHOLD = 0.75;

export type DecisionStatus = "pending" | "accepted" | "modified" | "restored";

/** Status of one detection in a session (pending is implicit, not stored). */
export function decisionStatusOf(session: ReviewSession, id: string): DecisionStatus {
  return session.decisions[id]?.status ?? "pending";
}

export function isLowConfidence(detection: ReviewDetection): boolean {
  return (
    typeof detection.confidence === "number" && detection.confidence < LOW_CONFIDENCE_THRESHOLD
  );
}

/** One contiguous slice of the document surface, in source-offset order. */
export type DocumentSegment =
  | { kind: "text"; start: number; end: number; text: string }
  | {
      kind: "detection";
      start: number;
      end: number;
      text: string;
      detectionIds: readonly string[];
    };

/**
 * Split the immutable source text into non-overlapping segments whose
 * boundaries are detection offsets. Each detection segment lists every
 * detection covering it (engine detections never overlap; a manual detection
 * may), so rendering and selection mapping stay offset-exact.
 */
export function buildDocumentSegments(session: ReviewSession): readonly DocumentSegment[] {
  const boundaries = new Set<number>([0, session.originalText.length]);
  for (const detection of session.detections) {
    boundaries.add(detection.start);
    boundaries.add(detection.end);
  }
  const ordered = [...boundaries].sort((a, b) => a - b);
  const segments: DocumentSegment[] = [];
  for (let i = 0; i < ordered.length - 1; i += 1) {
    const start = ordered[i];
    const end = ordered[i + 1];
    if (start === end) continue;
    const covering = session.detections
      .filter((d) => d.start <= start && d.end >= end)
      .sort((a, b) => a.start - b.start || a.end - b.end);
    const text = session.originalText.slice(start, end);
    if (covering.length === 0) {
      segments.push({ kind: "text", start, end, text });
    } else {
      segments.push({
        kind: "detection",
        start,
        end,
        text,
        detectionIds: covering.map((d) => d.id),
      });
    }
  }
  return segments;
}

export type StatusFilter =
  "all" | "pending" | "decided" | "accepted" | "restored" | "manual" | "low-confidence";

export type WorkspaceFilters = {
  readonly status: StatusFilter;
  readonly type: string | null;
};

/** Apply the transient filter state to the session's detections. */
export function visibleDetections(
  session: ReviewSession,
  filters: WorkspaceFilters
): readonly ReviewDetection[] {
  return session.detections.filter((detection) => {
    const status = decisionStatusOf(session, detection.id);
    switch (filters.status) {
      case "pending":
        if (status !== "pending") return false;
        break;
      case "decided":
        if (status === "pending") return false;
        break;
      case "accepted":
        if (status !== "accepted") return false;
        break;
      case "restored":
        if (status !== "restored") return false;
        break;
      case "manual":
        if (detection.source !== "manual") return false;
        break;
      case "low-confidence":
        if (!isLowConfidence(detection)) return false;
        break;
      default:
        break;
    }
    if (filters.type !== null && detection.type !== filters.type) return false;
    return true;
  });
}

/** Distinct detection types present in the session, in stable first-seen order. */
export function detectionTypes(session: ReviewSession): readonly string[] {
  const types: string[] = [];
  for (const detection of session.detections) {
    if (!types.includes(detection.type)) types.push(detection.type);
  }
  return types;
}

/** Human-readable status label; status is always also rendered as text. */
export function statusLabel(status: DecisionStatus): string {
  switch (status) {
    case "accepted":
      return "Accepted";
    case "modified":
      return "Modified";
    case "restored":
      return "Restored";
    default:
      return "Pending";
  }
}
