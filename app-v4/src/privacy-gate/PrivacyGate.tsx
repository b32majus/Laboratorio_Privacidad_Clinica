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
 * UX-PILOT-02 (#55) presentation reframe ONLY: the same facts/readiness are
 * grouped as a compact decision checkpoint (action required / review complete)
 * with the factual counts, availability and attention facts below. The model,
 * counts, messages, readiness rules and batch/structured semantics are
 * untouched.
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
  type PrivacyGateStructuredFacts,
  type PrivacyGateStructuredInput,
  type PrivacyGateView,
  batchConfidentialAuditUnavailableMessage,
  batchFailedItemsMessage,
  batchSafeOutputUnavailableMessage,
  derivePrivacyGateView,
  pendingDecisionMessage,
} from "./privacyGateModel";

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
  /**
   * The reviewed structured configuration + exact preparation for a structured
   * job (HARDEN-01 WU-A). Required for `kind === "structured"`; ignored else.
   */
  readonly structured?: PrivacyGateStructuredInput | null;
};

export function PrivacyGate(props: PrivacyGateProps): ReactElement {
  const view = useMemo(
    () =>
      derivePrivacyGateView(
        props.job,
        props.review,
        props.batchSessions ?? [],
        props.structured ?? null
      ),
    [props.job, props.review, props.batchSessions, props.structured]
  );

  // Presentation-only derivation of the checkpoint state from the SAME facts
  // the model already supplies: no new authority, no reinterpretation.
  const batchFailed = view.batch !== null && view.batch.failedCount > 0;
  const safeOutputReady = view.safeOutputReady;
  // The applicable output is blocked by the current authority. For a batch the
  // accepted spec defines no Safe Output, so the no-format limitation itself is
  // an availability fact, never an action the operator can take at this step.
  const outputBlocked = view.batch === null ? !safeOutputReady : batchFailed;
  const actionRequired =
    view.pendingCount > 0 || batchFailed || view.errors.length > 0 || outputBlocked;
  const hasAttentionFacts = view.errors.length > 0 || view.warnings.length > 0;

  return (
    <section aria-labelledby="privacy-gate-step-heading">
      <header className="max-w-3xl">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-neutral-600">
          Privacy Gate
        </p>
        <h2
          id="privacy-gate-step-heading"
          className="mt-1 font-display text-3xl font-bold tracking-tight text-primary-dark"
        >
          Privacy Gate
        </h2>
        <p className="mt-2 text-base leading-relaxed text-neutral-700">
          Final readiness checkpoint before export: what was treated, what still blocks Safe Output,
          and which factual warnings remain to consider.
        </p>
      </header>

      <GateCheckpoint
        actionRequired={actionRequired}
        outputBlocked={outputBlocked}
        safeOutputReady={safeOutputReady}
      />

      {view.pendingCount > 0 && (
        <p
          role="alert"
          className="mt-3 rounded border border-primary-dark bg-surface-light px-3 py-2 text-sm font-semibold text-neutral-800"
        >
          {pendingDecisionMessage(view.pendingCount)}
        </p>
      )}

      {view.batch !== null && view.batch.failedCount > 0 && (
        <p
          role="alert"
          className="mt-3 rounded border border-primary-dark bg-surface-light px-3 py-2 text-sm font-semibold text-neutral-800"
        >
          {batchFailedItemsMessage(view.batch.items)}
        </p>
      )}

      {view.batch !== null && <BatchItems view={view} />}

      <AvailabilityFacts view={view} />

      {view.structured !== null && <StructuredSummary facts={view.structured} />}

      {view.batch === null && view.structured === null && view.complete && (
        <ReviewSummary view={view} />
      )}

      {hasAttentionFacts && (
        <section
          aria-labelledby="attention-facts-heading"
          className="mt-5 rounded-xl border border-primary/30 bg-surface-light p-4"
        >
          <h3
            id="attention-facts-heading"
            className="font-display text-base font-bold text-neutral-800"
          >
            Attention facts
          </h3>
          <p className="mt-1 text-sm leading-relaxed text-neutral-700">
            Factual warnings and errors that stay visible with the review. They do not change the
            recorded review decisions.
          </p>
          {view.errors.length > 0 && <JobErrors view={view} />}
          {view.warnings.length > 0 && <KeptOriginalWarnings view={view} />}
        </section>
      )}
    </section>
  );
}

/**
 * Compact decision checkpoint (UX-PILOT-02). States driven ONLY by the existing
 * facts: "Action required" while the applicable output is blocked by pending
 * decisions / failed batch items / errors, and "Review complete" when it is
 * not. The detailed readiness remains in the Output availability facts below.
 */
function GateCheckpoint({
  actionRequired,
  outputBlocked,
  safeOutputReady,
}: {
  actionRequired: boolean;
  outputBlocked: boolean;
  safeOutputReady: boolean;
}): ReactElement {
  return (
    <section
      aria-labelledby="gate-checkpoint-heading"
      className={`mt-5 rounded-xl border-2 p-4 ${
        actionRequired ? "border-primary-dark bg-surface-light" : "border-primary/40 bg-white"
      }`}
    >
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <span
          className={`rounded-full px-2.5 py-0.5 text-xs font-semibold uppercase tracking-wide text-white ${
            actionRequired ? "bg-primary-dark" : "bg-surface-dark"
          }`}
        >
          {actionRequired ? "Action required" : "Review complete"}
        </span>
        <h3
          id="gate-checkpoint-heading"
          className="font-display text-lg font-bold text-neutral-800"
        >
          Decision checkpoint
        </h3>
      </div>
      <p className="mt-2 text-sm leading-relaxed text-neutral-800">
        {actionRequired
          ? outputBlocked
            ? "Safe Output is not available yet: the factual items below still require attention."
            : "A factual error item below requires attention before you rely on this review."
          : safeOutputReady
            ? "Every mandatory review decision is recorded. Safe Output is ready to download in the Export step."
            : "Every mandatory review decision is recorded. See Output availability below for which artifacts are available."}
      </p>
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
      className="mt-4 rounded-xl border border-primary/40 bg-white p-4"
    >
      <h3 className="font-display text-base font-bold text-neutral-800">Batch items</h3>
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

/**
 * Factual structured gate facts (HARDEN-01 WU-A): the exact per-column
 * disposition and the fail-closed block reasons (if any). Never a score.
 */
function StructuredSummary({ facts }: { facts: PrivacyGateStructuredFacts }): ReactElement {
  return (
    <section
      aria-label="Structured export facts"
      className="mt-4 rounded-xl border border-primary/40 bg-white p-4"
    >
      <h3 className="font-display text-base font-bold text-neutral-800">Structured export</h3>
      <dl
        role="status"
        aria-label="Structured export facts"
        className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1 text-sm text-neutral-800"
      >
        <dt className="font-semibold">Columns:</dt>
        <dd> {facts.columns.length}</dd>
        <dt className="font-semibold">Columns requiring review:</dt>
        <dd> {facts.columnsRequiringReview}</dd>
        <dt className="font-semibold">Unsupported columns:</dt>
        <dd> {facts.blockingCount}</dd>
      </dl>
      {facts.reasons.length > 0 && (
        <ul
          role="alert"
          aria-label="Structured export block reasons"
          className="mt-3 list-disc space-y-0.5 pl-6 text-sm font-semibold text-neutral-800"
        >
          {facts.reasons.map((reason, index) => (
            <li key={index}>{reason}</li>
          ))}
        </ul>
      )}
      <ul
        aria-label="Structured column dispositions"
        className="mt-3 space-y-1 text-sm text-neutral-800"
      >
        {facts.columns.map((column) => (
          <li key={column.columnIndex}>
            <span className="font-semibold">
              {column.header === "" ? "(unnamed column)" : column.header}
            </span>
            : {column.disposition}
            {column.disposition === "date-age" ? ` (${column.dateRole})` : ""}
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
      className="mt-4 rounded-xl border border-primary/40 bg-white p-4"
    >
      <h3 className="font-display text-base font-bold text-neutral-800">Output availability</h3>
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
      className="mt-4 rounded-xl border border-primary/40 bg-white p-4"
    >
      <h3 className="font-display text-base font-bold text-neutral-800">Review summary</h3>
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
    <section aria-label="Job errors" className="mt-3">
      <h4 className="font-display text-sm font-bold text-neutral-800">Errors</h4>
      <ul
        aria-label="Job errors"
        className="mt-1 list-disc space-y-1 pl-5 text-sm text-neutral-800"
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
    <section aria-label="Privacy gate warnings" className="mt-3">
      <h4 className="font-display text-sm font-bold text-neutral-800">Warnings</h4>
      <ul
        aria-label="Kept-original warnings"
        className="mt-1 list-disc space-y-1 pl-5 text-sm text-neutral-800"
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
