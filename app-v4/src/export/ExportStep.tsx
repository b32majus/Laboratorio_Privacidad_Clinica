/**
 * Export step (Work Order T08 U4; SPEC_V4_APP_AND_REVIEW.md §7, D-005).
 *
 * Two SEPARATE, independently triggered download surfaces — never a
 * combined artifact:
 *   - Safe Output: the reviewed final text of the session, derived ONLY
 *     from the completed domain ReviewSession. It carries no original↔
 *     replacement mapping, no reviewer notes and no original values kept
 *     for traceability. Fail-closed (D-009): while any mandatory review
 *     decision is pending the action is disabled and the explicit typed
 *     blocked reason is rendered as text.
 *   - Confidential Audit: the internal traceability artifact (original
 *     values, mapping, notes). It is visually and semantically separate,
 *     always marked with CONFIDENTIAL_AUDIT_WARNING_LINE, and stays
 *     available while review is pending (U2 contract) because it is the
 *     internal record, never a deliverable.
 *
 * Both downloads are client-side only (Blob + object URL + anchor click;
 * the object URL is revoked afterwards): no network, no persistence
 * (D-013). Status is always conveyed as text, never by color alone; all
 * controls are keyboard-operable buttons with visible focus.
 *
 * Single review authority (D-004): no pending/final-text logic is
 * re-implemented here; the blocked reason reuses the reviewed gate
 * wording and the artifacts are built exclusively through the reviewed
 * output services. No anonymity, compliance or certification wording
 * anywhere (D-006).
 */
import type { ReactElement } from "react";

import { getProgress, type ReviewSession } from "../review/review-domain";
import type { Job } from "../domain/job";
import { buildSafeOutput, serializeSafeOutput } from "../output/safe-output";
import { buildConfidentialAudit } from "../output/confidential-audit";
import {
  CONFIDENTIAL_AUDIT_WARNING_LINE,
  serializeConfidentialAudit,
} from "../output/confidential-audit-serializer";
import { pendingDecisionMessage } from "../privacy-gate/privacyGateModel";

const focusRing =
  "focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2";

const SAFE_OUTPUT_FILE_NAME = "safe-output.txt";
const CONFIDENTIAL_AUDIT_FILE_NAME = "confidential-audit.txt";

/**
 * Client-side, network-free download of a UTF-8 text artifact. Extracted
 * so tests can stub URL.createObjectURL / URL.revokeObjectURL and the
 * anchor click without any network involvement (D-013: memory-only).
 */
export function downloadTextFile(fileName: string, content: string): void {
  const blob = new Blob([content], { type: "text/plain;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = fileName;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

export type ExportStepProps = {
  /** The frozen domain job (carries the derived output availability). */
  readonly job: Job;
  /** The frozen ReviewSession; the single review authority (D-004). */
  readonly review: ReviewSession;
};

export function ExportStep({ job, review }: ExportStepProps): ReactElement {
  const safeOutputReady = job.outputs.safeOutputReady;
  const pendingCount = getProgress(review).pending;

  const handleDownloadSafeOutput = () => {
    // Fail-closed guard (D-009): the disabled button already prevents this,
    // but the artifact is never built from a pending session.
    if (!safeOutputReady) return;
    downloadTextFile(SAFE_OUTPUT_FILE_NAME, serializeSafeOutput(buildSafeOutput(review)));
  };

  const handleDownloadConfidentialAudit = () => {
    // Always available, even while review is pending: internal traceability.
    downloadTextFile(
      CONFIDENTIAL_AUDIT_FILE_NAME,
      serializeConfidentialAudit(buildConfidentialAudit(review))
    );
  };

  return (
    <section aria-labelledby="export-step-heading">
      <h2 id="export-step-heading" className="font-display text-xl font-bold text-primary-dark">
        Export
      </h2>
      <p className="mt-2 max-w-2xl text-base leading-relaxed">
        Two independent artifacts are produced from this review session, downloaded separately.
        Download only the one your destination is authorized to receive.
      </p>

      <section
        aria-labelledby="safe-output-heading"
        className="mt-6 rounded border border-primary bg-surface-light p-4"
      >
        <h3 id="safe-output-heading" className="font-display text-lg font-bold text-primary-dark">
          Safe Output
        </h3>
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-neutral-800">
          The final reviewed text of this session. It contains no original↔replacement mapping, no
          reviewer notes and no original values kept for traceability.
        </p>
        {!safeOutputReady && (
          <p
            role="alert"
            id="safe-output-blocked-reason"
            className="mt-3 rounded border border-primary-dark bg-surface-light px-3 py-2 text-sm font-semibold text-primary-dark"
          >
            {pendingDecisionMessage(pendingCount)}
          </p>
        )}
        <button
          type="button"
          onClick={handleDownloadSafeOutput}
          disabled={!safeOutputReady}
          aria-describedby={safeOutputReady ? undefined : "safe-output-blocked-reason"}
          className={`mt-3 rounded bg-primary-dark px-4 py-2 text-sm font-semibold text-white hover:bg-primary disabled:cursor-not-allowed disabled:opacity-70 ${focusRing}`}
        >
          Download Safe Output (.txt)
        </button>
      </section>

      <section
        aria-labelledby="confidential-audit-heading"
        className="mt-6 rounded border border-primary-dark border-2 bg-surface-light p-4"
      >
        <h3
          id="confidential-audit-heading"
          className="font-display text-lg font-bold text-primary-dark"
        >
          Confidential Audit
        </h3>
        <p className="mt-2 text-sm font-semibold text-primary-dark">
          {CONFIDENTIAL_AUDIT_WARNING_LINE}
        </p>
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-neutral-800">
          This artifact contains original sensitive values, their replacements and reviewer notes.
          It is an internal traceability record and must never be shared or delivered outside the
          authorized audit trail.
        </p>
        <button
          type="button"
          onClick={handleDownloadConfidentialAudit}
          className={`mt-3 rounded border border-primary-dark px-4 py-2 text-sm font-semibold text-primary-dark hover:bg-surface-dark hover:text-white ${focusRing}`}
        >
          Download Confidential Audit (.txt)
        </button>
      </section>
    </section>
  );
}
