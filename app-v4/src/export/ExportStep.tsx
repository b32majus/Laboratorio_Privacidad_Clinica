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
 *     always marked with CONFIDENTIAL_AUDIT_WARNING_LINE, and for a
 *     single/text job stays available while review is pending (U2 contract)
 *     because it is the internal record, never a deliverable.
 *
 * Both downloads are client-side only (Blob + object URL + anchor click;
 * the object URL is revoked afterwards): no network, no persistence
 * (D-013). Status is always conveyed as text, never by color alone; all
 * controls are keyboard-operable buttons with visible focus.
 *
 * Document-batch jobs (T17 #21 SD-7, output authority corrected by CORR-B):
 * the accepted specification defines no batch Safe Output format and no
 * batch-wide Confidential Audit, so BOTH actions stay DISABLED with explicit
 * typed reasons — review pending, failed items (naming each file and the
 * matching remedy) or the not-yet-defined batch format, in that order. The
 * active document's session is never presented as a batch-wide audit.
 * Single-job behavior is byte-unchanged.
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
import { serializeStructuredSafeCsv } from "../structured/csv-writer";
import { serializeStructuredConfidentialAudit } from "../structured/structured-confidential-audit";
import type { StructuredConfiguration } from "../structured/configuration";
import type { StructuredTransformPlan } from "../structured/transform-plan";
import type { StructuredOutputPreparation } from "../structured/transformed-dataset";
import {
  batchConfidentialAuditUnavailableMessage,
  batchFailedItemsMessage,
  batchSafeOutputUnavailableMessage,
  deriveBatchFacts,
  pendingDecisionMessage,
} from "../privacy-gate/privacyGateModel";

const focusRing =
  "focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2";

const SAFE_OUTPUT_FILE_NAME = "safe-output.txt";
const CONFIDENTIAL_AUDIT_FILE_NAME = "confidential-audit.txt";
const SAFE_STRUCTURED_FILE_NAME = "safe-structured-output.csv";
const CONFIDENTIAL_STRUCTURED_FILE_NAME = "structured-confidential-audit.txt";

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
  /**
   * The frozen ReviewSession; the single review authority (D-004). For a
   * document-batch job this is the active item's session or `null`; the batch
   * reason is derived from the Job (T17 #21 SD-7), never from bare presence.
   */
  readonly review: ReviewSession | null;
  /**
   * The reviewed structured configuration + exact preparation for a structured
   * job (HARDEN-01 WU-A). Required for `kind === "structured"`; ignored else.
   */
  readonly structured?: {
    readonly configuration: StructuredConfiguration;
    readonly plan: StructuredTransformPlan;
    readonly preparation: StructuredOutputPreparation;
  } | null;
};

/**
 * Structured export surface (HARDEN-01 WU-A3): the Safe Structured CSV and the
 * SEPARATE Confidential correspondence, produced from the SAME reviewed
 * preparation the bridge already computed. Never combined. Fail-closed with
 * the exact block reasons; every control is a keyboard-operable button.
 */
function StructuredExport({
  job,
  structured,
}: {
  job: Job;
  structured: NonNullable<ExportStepProps["structured"]> | null;
}): ReactElement {
  const preparation = structured === null ? null : structured.preparation;
  const blocked =
    preparation === null || preparation.status !== "ready" || !job.outputs.safeOutputReady;
  const reasons = preparation === null ? [] : preparation.reasons;
  // Fail-closed, per artifact: the Confidential Audit additionally honors its
  // OWN readiness flag (same authority as the document path below).
  const confidentialBlocked = blocked || !job.outputs.confidentialAuditReady;
  const sharedReasonVisible = blocked && reasons.length > 0;
  const confidentialReasonVisible =
    confidentialBlocked && !sharedReasonVisible && !job.outputs.confidentialAuditReady;
  const confidentialDescribedBy = !confidentialBlocked
    ? undefined
    : sharedReasonVisible
      ? "safe-structured-blocked-reason"
      : confidentialReasonVisible
        ? "structured-confidential-blocked-reason"
        : undefined;

  const handleDownloadSafe = () => {
    if (blocked || preparation === null || preparation.status !== "ready") return;
    downloadTextFile(
      SAFE_STRUCTURED_FILE_NAME,
      serializeStructuredSafeCsv(preparation.output.safe)
    );
  };
  const handleDownloadConfidential = () => {
    if (confidentialBlocked || preparation === null || preparation.status !== "ready") return;
    downloadTextFile(
      CONFIDENTIAL_STRUCTURED_FILE_NAME,
      serializeStructuredConfidentialAudit(preparation.output.confidential)
    );
  };

  return (
    <section aria-labelledby="export-step-heading">
      <h2 id="export-step-heading" className="font-display text-xl font-bold text-primary-dark">
        Export
      </h2>
      <p className="mt-2 max-w-2xl text-base leading-relaxed">
        Two independent artifacts are produced from this structured configuration, downloaded
        separately. Download only the one your destination is authorized to receive.
      </p>

      <section
        aria-labelledby="safe-structured-heading"
        className="mt-6 rounded border border-primary bg-surface-light p-4"
      >
        <h3
          id="safe-structured-heading"
          className="font-display text-lg font-bold text-primary-dark"
        >
          Safe Structured Output
        </h3>
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-neutral-800">
          The reviewed structured table with date/age and codified columns transformed and
          identifier columns removed. It contains no original↔transformed mapping and no original
          identifier or sensitive values.
        </p>
        {blocked && reasons.length > 0 && (
          <ul
            role="alert"
            id="safe-structured-blocked-reason"
            className="mt-3 list-disc space-y-0.5 pl-6 text-sm font-semibold text-primary-dark"
          >
            {reasons.map((reason, index) => (
              <li key={index}>{reason}</li>
            ))}
          </ul>
        )}
        <button
          type="button"
          onClick={handleDownloadSafe}
          disabled={blocked}
          aria-describedby={blocked ? "safe-structured-blocked-reason" : undefined}
          className={`mt-3 rounded bg-primary-dark px-4 py-2 text-sm font-semibold text-white hover:bg-primary disabled:cursor-not-allowed disabled:opacity-70 ${focusRing}`}
        >
          Download Safe Structured Output (.csv)
        </button>
      </section>

      <section
        aria-labelledby="structured-confidential-heading"
        className="mt-6 rounded border border-primary-dark border-2 bg-surface-light p-4"
      >
        <h3
          id="structured-confidential-heading"
          className="font-display text-lg font-bold text-primary-dark"
        >
          Structured Confidential Audit
        </h3>
        <p className="mt-2 text-sm font-semibold text-primary-dark">
          {CONFIDENTIAL_AUDIT_WARNING_LINE}
        </p>
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-neutral-800">
          The original↔transformed correspondence behind the Safe CSV (date/age, codify and removed
          columns). It is an internal traceability record and must never be shared or delivered
          outside the authorized audit trail.
        </p>
        {confidentialReasonVisible && (
          <p
            role="status"
            id="structured-confidential-blocked-reason"
            className="mt-3 rounded border border-primary-dark bg-surface-light px-3 py-2 text-sm font-semibold text-primary-dark"
          >
            Confidential Audit is not available for this job yet.
          </p>
        )}
        <button
          type="button"
          onClick={handleDownloadConfidential}
          disabled={confidentialBlocked}
          aria-describedby={confidentialDescribedBy}
          className={`mt-3 rounded border border-primary-dark px-4 py-2 text-sm font-semibold text-primary-dark hover:bg-surface-dark hover:text-white disabled:cursor-not-allowed disabled:opacity-70 ${focusRing}`}
        >
          Download Structured Confidential Audit (.txt)
        </button>
      </section>
    </section>
  );
}

export function ExportStep(props: ExportStepProps): ReactElement {
  const { job, review } = props;
  if (job.kind === "structured") {
    return <StructuredExport job={job} structured={props.structured ?? null} />;
  }
  const isBatch = job.kind === "document-batch";
  const safeOutputReady = job.outputs.safeOutputReady;
  const batchFacts = isBatch ? deriveBatchFacts(job) : null;
  // Single/text behavior is unchanged: pending count comes from the session.
  const pendingCount = batchFacts
    ? batchFacts.pendingCount
    : review === null
      ? 0
      : getProgress(review).pending;

  // A batch Safe Output is never available in the accepted spec (SD-7), so the
  // action is disabled for every batch regardless of derived readiness.
  const safeOutputBlocked = isBatch || !safeOutputReady;

  let safeOutputReason: string | null = null;
  if (batchFacts !== null) {
    if (!job.review.complete && batchFacts.pendingCount > 0) {
      // Review-incomplete keeps priority (same order as the domain guard).
      safeOutputReason = pendingDecisionMessage(batchFacts.pendingCount);
    } else if (batchFacts.failedCount > 0) {
      safeOutputReason = batchFailedItemsMessage(batchFacts.items);
    } else {
      safeOutputReason = batchSafeOutputUnavailableMessage();
    }
  } else if (!safeOutputReady) {
    safeOutputReason = pendingDecisionMessage(pendingCount);
  }

  // Batch Confidential Audit authority (CORR-B): no accepted batch-wide audit
  // exists, so the ACTIVE document's ReviewSession is never presented as one.
  // Single-document/text behavior is unchanged (the bridge always marks it
  // ready once a session exists).
  const confidentialAuditBlocked = isBatch || !job.outputs.confidentialAuditReady;
  const confidentialAuditReason = isBatch
    ? batchConfidentialAuditUnavailableMessage()
    : !job.outputs.confidentialAuditReady
      ? "Confidential Audit is not available for this job yet."
      : null;

  const handleDownloadSafeOutput = () => {
    // Fail-closed guard (D-009): the disabled button already prevents this,
    // but the artifact is never built from a blocked or batch state.
    if (safeOutputBlocked || review === null) return;
    downloadTextFile(SAFE_OUTPUT_FILE_NAME, serializeSafeOutput(buildSafeOutput(review)));
  };

  const handleDownloadConfidentialAudit = () => {
    // Available while review is pending for a single job (internal
    // traceability); never built from a blocked batch state (CORR-B).
    if (confidentialAuditBlocked || review === null) return;
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
        {safeOutputBlocked && safeOutputReason !== null && (
          <p
            role="alert"
            id="safe-output-blocked-reason"
            className="mt-3 rounded border border-primary-dark bg-surface-light px-3 py-2 text-sm font-semibold text-primary-dark"
          >
            {safeOutputReason}
          </p>
        )}
        <button
          type="button"
          onClick={handleDownloadSafeOutput}
          disabled={safeOutputBlocked}
          aria-describedby={safeOutputBlocked ? "safe-output-blocked-reason" : undefined}
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
        {confidentialAuditBlocked && confidentialAuditReason !== null && (
          <p
            role="status"
            id="confidential-audit-blocked-reason"
            className="mt-3 rounded border border-primary-dark bg-surface-light px-3 py-2 text-sm font-semibold text-primary-dark"
          >
            {confidentialAuditReason}
          </p>
        )}
        <button
          type="button"
          onClick={handleDownloadConfidentialAudit}
          disabled={confidentialAuditBlocked}
          aria-describedby={
            confidentialAuditBlocked ? "confidential-audit-blocked-reason" : undefined
          }
          className={`mt-3 rounded border border-primary-dark px-4 py-2 text-sm font-semibold text-primary-dark hover:bg-surface-dark hover:text-white disabled:cursor-not-allowed disabled:opacity-70 ${focusRing}`}
        >
          Download Confidential Audit (.txt)
        </button>
      </section>
    </section>
  );
}
