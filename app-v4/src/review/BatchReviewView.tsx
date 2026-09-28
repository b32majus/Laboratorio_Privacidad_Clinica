/**
 * Document-batch review surface (T17 #21 WU-C2; SPEC_V4_BATCH_AND_STRUCTURED
 * §1, SPEC_V4_APP_AND_REVIEW §4/§5/§9).
 *
 * A batch has no single review authority: the bridge holds one ReviewSession
 * per successfully processed item plus the currently viewed index
 * (`useJobSession`). This component renders a factual document selector (one
 * entry per item: name, visible status text, failure message when it failed)
 * and, for the ACTIVE item only, the existing {@link ReviewWorkspace} bound to
 * that item's session. `onSelectDocument` merely changes the viewed index —
 * selecting a document never marks it reviewed (FUNC-002, SD-5).
 *
 * Failed items are listed but NOT selectable for review: no session exists for
 * them and their typed message stays visible. Items still `reading`/`queued`
 * are shown factually; review processing itself is gated by the App (all reads
 * must settle first), so this view never starts or infers processing.
 *
 * Accessibility (SPEC §9): native buttons, keyboard-operable with visible
 * focus rings, `aria-current` on the active document, and status conveyed as
 * text (never color alone). No export surface here (T08 owns it).
 */
import type { ReactElement } from "react";

import { batchFailureRemedy, type BatchItemStatus, type Job } from "../domain/job";
import {
  type DecisionExtras,
  type ExplicitDecisionStatus,
  type ManualDetectionInput,
  type ReviewSession,
} from "./review-domain";
import { ReviewWorkspace } from "./ReviewWorkspace";

const focusRing =
  "focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2";

/** Visible text label per batch item status: status is never conveyed by color. */
const BATCH_STATUS_LABELS: Record<BatchItemStatus, string> = {
  queued: "Queued",
  reading: "Reading",
  processing: "Processing",
  "review-required": "Review required",
  completed: "Completed",
  error: "Error",
};

export type BatchReviewViewProps = {
  /** The frozen batch job: the single authority for per-item state. */
  readonly job: Job;
  /**
   * One ReviewSession per successfully processed item, keyed by item index;
   * `null` until the batch attempt has been recorded by the bridge.
   */
  readonly sessions: Readonly<Record<number, ReviewSession>> | null;
  /** The currently viewed item index; `null` when no session exists. */
  readonly activeIndex: number | null;
  /** Change the viewed document only — never review state (SD-5). */
  readonly onSelectDocument: (index: number | null) => void;
  /** Apply an explicit decision for the ACTIVE document through the bridge. */
  readonly onDecide: (
    id: string,
    decision: ExplicitDecisionStatus,
    extras?: DecisionExtras
  ) => void;
  /** Add a manual detection to the ACTIVE document through the bridge. */
  readonly onAddManual: (detection: ManualDetectionInput) => void;
  /** Typed attempt failure surfaced by the App, if any. */
  readonly errorMessage?: string | null;
};

export function BatchReviewView(props: BatchReviewViewProps): ReactElement {
  const { job, sessions, activeIndex, errorMessage = null } = props;
  const files = job.source.type === "files" ? job.source.files : [];
  const stillReading = files.some((file) => file.itemStatus === "reading");
  const activeSession = activeIndex === null ? undefined : sessions?.[activeIndex];
  // Remedy must match the failure semantics (T17 #21 CORR-B): a
  // `policy-unsupported` item is healthy input blocked by the current policy.
  const failedCodes = files
    .filter((file) => file.itemStatus === "error")
    .map((file) => file.itemError?.code)
    .filter((code): code is string => code !== undefined);

  return (
    <section aria-labelledby="batch-review-step-heading">
      <h2
        id="batch-review-step-heading"
        className="font-display text-xl font-bold text-primary-dark"
      >
        Review
      </h2>
      <p className="mt-2 max-w-3xl text-base leading-relaxed">
        Review each document in the batch separately. Every document keeps its own decisions, and
        moving between documents never changes another document's review state.
      </p>

      {errorMessage && (
        <p
          role="alert"
          className={`mt-3 max-w-3xl rounded border border-primary-dark bg-surface-light px-3 py-2 text-sm font-semibold text-primary-dark ${focusRing}`}
        >
          {errorMessage}
        </p>
      )}

      <section
        aria-label="Batch documents"
        className="mt-4 rounded border border-primary bg-surface-light p-3"
      >
        <h3 className="font-display text-base font-bold text-primary-dark">Documents</h3>
        <ul aria-label="Batch document status" className="mt-2 space-y-1">
          {files.map((file, index) => {
            const status = file.itemStatus ?? "queued";
            const selectable = sessions?.[index] !== undefined;
            const isActive = activeIndex === index;
            return (
              <li key={index}>
                {selectable ? (
                  <button
                    type="button"
                    onClick={() => props.onSelectDocument(index)}
                    aria-current={isActive ? "true" : undefined}
                    className={`w-full rounded border px-2 py-1 text-left text-sm ${
                      isActive
                        ? "border-primary-dark bg-surface-dark text-white"
                        : "border-primary bg-white text-neutral-800 hover:bg-surface-light"
                    } ${focusRing}`}
                  >
                    <span className="font-semibold">{file.name}</span>
                    {" — "}
                    <span>{BATCH_STATUS_LABELS[status]}</span>
                  </button>
                ) : (
                  <p className="rounded border border-neutral-300 bg-white px-2 py-1 text-sm text-neutral-800">
                    <span className="font-semibold">{file.name}</span>
                    {" — "}
                    <span>{BATCH_STATUS_LABELS[status]}</span>
                    {file.itemError !== undefined && <> — {file.itemError.message}</>}
                  </p>
                )}
              </li>
            );
          })}
        </ul>
      </section>

      {activeSession !== undefined ? (
        <ReviewWorkspace
          session={activeSession}
          onDecide={props.onDecide}
          onAddManual={props.onAddManual}
        />
      ) : (
        <p
          role="status"
          className="mt-4 max-w-3xl rounded border border-primary bg-surface-light px-3 py-2 text-sm text-neutral-800"
        >
          {stillReading
            ? "Documents are still being read. Review starts automatically once every document has been read."
            : failedCodes.length > 0
              ? `No document is available for review. Failed documents stay listed above. ${batchFailureRemedy(failedCodes)}`
              : "No document is available for review yet."}
        </p>
      )}
    </section>
  );
}
