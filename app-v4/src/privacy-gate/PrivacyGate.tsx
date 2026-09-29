/**
 * Privacy Gate step (Work Order T08 U3; SPEC_V4_APP_AND_REVIEW.md §6).
 *
 * Renders the factual gate view derived by privacyGateModel from the frozen
 * ReviewSession + Job. Everything is accessible and factual:
 *   - status is always conveyed by text (never color alone);
 *   - the blocked state is an explicit role="alert" message;
 *   - counts, warnings, errors and the policy used are shown as-is;
 *   - kept-original (restored) entries appear as factual warnings, phrased
 *     as completed reviewer decisions, never as leakage.
 *
 * For a document batch (T17 #21 SD-9) the gate additionally renders the
 * factual per-item list (name + visible status text + failure message) read
 * from the Job, and the explicit fail-closed batch copy. The active review
 * session may be absent for a batch.
 *
 * No export actions live here: the Export step owns them (U4). No privacy
 * score, safe percentage, anonymity or certification claim anywhere (D-006).
 */
import { useMemo, type ReactElement } from "react";

import type { BatchItemStatus, Job, PrivacyPolicyId } from "../domain/job";
import type { ReviewSession } from "../review/review-domain";
import {
  type PrivacyGateView,
  batchConfidentialAuditUnavailableMessage,
  batchFailedItemsMessage,
  batchSafeOutputUnavailableMessage,
  derivePrivacyGateView,
  pendingDecisionMessage,
} from "./privacyGateModel";

const focusRing =
  "focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2";

const POLICY_LABELS: Record<PrivacyPolicyId, string> = {
  standard: "Standard",
  "external-ai": "External AI",
  "longitudinal-research": "Longitudinal Research",
  strict: "Strict",
};

/** Visible text label per batch item status: status is never conveyed by color. */
const BATCH_STATUS_LABELS: Record<BatchItemStatus, string> = {
  queued: "Queued",
  reading: "Reading",
  processing: "Processing",
  "review-required": "Review required",
  completed: "Completed",
  error: "Error",
};

export type PrivacyGateProps = {
  /** The frozen domain job (policy, errors, output availability). */
  readonly job: Job;
  /**
   * The frozen ReviewSession; the single review authority (D-004). For a
   * document-batch job this is the active item's session or `null`; batch
   * readiness comes from the Job, not from this session (T17 #21 SD-9).
   */
  readonly review: ReviewSession | null;
  /**
   * EVERY available per-document ReviewSession of a document batch (T17 #21
   * CORR-B). Batch-wide restored-original warnings are derived from this
   * complete set, so a non-active document's restored decision stays visible.
   * Absent/empty for single-document and text jobs.
   */
  readonly batchSessions?: readonly ReviewSession[];
};

export function PrivacyGate(props: PrivacyGateProps): ReactElement {
  const view = useMemo(
    () => derivePrivacyGateView(props.job, props.review, props.batchSessions ?? []),
    [props.job, props.review, props.batchSessions]
  );

  return (
    <section aria-labelledby="privacy-gate-step-heading">
      <h2
        id="privacy-gate-step-heading"
        className="font-display text-xl font-bold text-primary-dark"
      >
        Privacy Gate
      </h2>
      <p className="mt-2 max-w-2xl text-base leading-relaxed">
        Factual state of the review before export: reviewed detections, pending decisions, manual
        detections, kept originals, job errors and the policy in effect.
      </p>

      {view.pendingCount > 0 && (
        <p
          role="alert"
          className={`mt-3 rounded border border-primary-dark bg-surface-light px-3 py-2 text-sm font-semibold text-primary-dark ${focusRing}`}
        >
          {pendingDecisionMessage(view.pendingCount)}
        </p>
      )}

      {view.batch !== null && view.batch.failedCount > 0 && (
        <p
          role="alert"
          className={`mt-3 rounded border border-primary-dark bg-surface-light px-3 py-2 text-sm font-semibold text-primary-dark ${focusRing}`}
        >
          {batchFailedItemsMessage(view.batch.items)}
        </p>
      )}

      {view.batch !== null && <BatchItems view={view} />}

      <AvailabilityFacts view={view} />

      {view.batch === null && view.complete && <ReviewSummary view={view} />}

      {view.errors.length > 0 && <JobErrors view={view} />}

      {view.warnings.length > 0 && <KeptOriginalWarnings view={view} />}
    </section>
  );
}

/**
 * Factual document-batch item facts (T17 #21 SD-9): every item stays visible
 * with a text status label and, when it failed, its typed message. No
 * hover-only information and no color-only state.
 */
function BatchItems({ view }: { view: PrivacyGateView }): ReactElement | null {
  const batch = view.batch;
  if (batch === null) return null;
  return (
    <section
      aria-label="Batch items"
      className="mt-4 rounded border border-primary bg-surface-light p-3"
    >
      <h3 className="font-display text-base font-bold text-primary-dark">Batch items</h3>
      <dl
        role="group"
        aria-label="Batch item counts"
        className="mt-2 grid grid-cols-3 gap-x-4 gap-y-1 text-sm text-neutral-800"
      >
        <dt className="font-semibold">Pending:</dt>
        <dd> {batch.pendingCount}</dd>
        <dt className="font-semibold">Completed:</dt>
        <dd> {batch.completedCount}</dd>
        <dt className="font-semibold">Failed:</dt>
        <dd> {batch.failedCount}</dd>
      </dl>
      <ul aria-label="Batch item status" className="mt-3 space-y-1 text-sm text-neutral-800">
        {batch.items.map((item) => (
          <li key={item.index}>
            <span className="font-semibold">{item.name}</span>: {BATCH_STATUS_LABELS[item.status]}
            {item.errorMessage !== undefined && <> — {item.errorMessage}</>}
          </li>
        ))}
      </ul>
    </section>
  );
}

/** Factual policy + output-availability facts (D-005), text-conveyed. */
function AvailabilityFacts({ view }: { view: PrivacyGateView }): ReactElement {
  return (
    <section
      aria-label="Output availability"
      className="mt-4 rounded border border-primary bg-surface-light p-3"
    >
      <h3 className="font-display text-base font-bold text-primary-dark">Output availability</h3>
      <dl
        role="status"
        aria-label="Output availability facts"
        className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1 text-sm text-neutral-800"
      >
        <dt className="font-semibold">Privacy policy used:</dt>
        <dd> {POLICY_LABELS[view.policyId]}</dd>
        <dt className="font-semibold">Safe output:</dt>
        <dd> {view.safeOutputReady ? "Ready" : "Not ready"}</dd>
        <dt className="font-semibold">Confidential audit:</dt>
        <dd> {view.confidentialAuditReady ? "Available" : "Not available"}</dd>
      </dl>
      {view.batch !== null && (
        <div className="mt-3 space-y-1 text-sm text-neutral-800">
          <p>{batchSafeOutputUnavailableMessage()}</p>
          <p>{batchConfidentialAuditUnavailableMessage()}</p>
        </div>
      )}
    </section>
  );
}

/** Factual review summary from domain progress: counts, never a score. */
function ReviewSummary({ view }: { view: PrivacyGateView }): ReactElement {
  return (
    <section
      aria-label="Review summary"
      className="mt-4 rounded border border-primary bg-surface-light p-3"
    >
      <h3 className="font-display text-base font-bold text-primary-dark">Review summary</h3>
      <dl
        role="group"
        aria-label="Review summary facts"
        className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1 text-sm text-neutral-800"
      >
        <dt className="font-semibold">Detections treated:</dt>
        <dd>
          {view.reviewedAccepted} accepted, {view.reviewedModified} modified
        </dd>
        <dt className="font-semibold">Accepted replacements:</dt>
        <dd> {view.reviewedAccepted}</dd>
        <dt className="font-semibold">Modified replacements:</dt>
        <dd> {view.reviewedModified}</dd>
        <dt className="font-semibold">Manual detections:</dt>
        <dd> {view.manualDetections}</dd>
        <dt className="font-semibold">Kept originals (restored):</dt>
        <dd> {view.restoredCount}</dd>
        {view.lowConfidenceCount > 0 && (
          <>
            <dt className="font-semibold">Low-confidence candidates:</dt>
            <dd>
              {" "}
              {view.lowConfidenceCount} total, {view.lowConfidencePendingCount} pending
            </dd>
          </>
        )}
      </dl>
    </section>
  );
}

/** Job errors surfaced factually, exactly as the job carries them. */
function JobErrors({ view }: { view: PrivacyGateView }): ReactElement {
  return (
    <section
      aria-label="Job errors"
      className="mt-4 rounded border border-primary bg-surface-light p-3"
    >
      <h3 className="font-display text-base font-bold text-primary-dark">Errors</h3>
      <ul
        aria-label="Job errors"
        className="mt-2 list-disc space-y-1 pl-5 text-sm text-neutral-800"
      >
        {view.errors.map((error, index) => (
          <li key={index}>
            <span className="font-mono">{error.code}</span> — {error.message}
          </li>
        ))}
      </ul>
    </section>
  );
}

/**
 * Kept-original warnings: one factual entry per restored detection. Restored
 * is an explicit completed reviewer decision (SPEC §4) and stays visible
 * here; it is never framed as correspondence leakage.
 */
function KeptOriginalWarnings({ view }: { view: PrivacyGateView }): ReactElement {
  return (
    <section
      aria-label="Privacy gate warnings"
      className="mt-4 rounded border border-primary bg-surface-light p-3"
    >
      <h3 className="font-display text-base font-bold text-primary-dark">Warnings</h3>
      <ul
        aria-label="Kept-original warnings"
        className="mt-2 list-disc space-y-1 pl-5 text-sm text-neutral-800"
      >
        {view.warnings.map((warning, index) => (
          <li key={index}>
            <span className="font-mono">{warning.code}</span> — {warning.message}
          </li>
        ))}
      </ul>
    </section>
  );
}
