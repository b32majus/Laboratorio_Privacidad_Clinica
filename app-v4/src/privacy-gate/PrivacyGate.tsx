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
 * No export actions live here: the Export step owns them (U4). No privacy
 * score, safe percentage, anonymity or certification claim anywhere (D-006).
 */
import { useMemo, type ReactElement } from "react";

import type { Job, PrivacyPolicyId } from "../domain/job";
import type { ReviewSession } from "../review/review-domain";
import {
  type PrivacyGateView,
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

export type PrivacyGateProps = {
  /** The frozen domain job (policy, errors, output availability). */
  readonly job: Job;
  /** The frozen ReviewSession; the single review authority (D-004). */
  readonly review: ReviewSession;
};

export function PrivacyGate(props: PrivacyGateProps): ReactElement {
  const view = useMemo(
    () => derivePrivacyGateView(props.job, props.review),
    [props.job, props.review]
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
        Factual state of the review before export: treated identifiers, pending decisions, manual
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

      <AvailabilityFacts view={view} />

      {view.complete && <ReviewSummary view={view} />}

      {view.errors.length > 0 && <JobErrors view={view} />}

      {view.warnings.length > 0 && <KeptOriginalWarnings view={view} />}
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
        <dt className="font-semibold">Direct identifiers treated:</dt>
        <dd>
          {view.treatedAccepted} accepted, {view.treatedModified} modified
        </dd>
        <dt className="font-semibold">Accepted:</dt>
        <dd> {view.treatedAccepted}</dd>
        <dt className="font-semibold">Modified:</dt>
        <dd> {view.treatedModified}</dd>
        <dt className="font-semibold">Manual detections:</dt>
        <dd> {view.manualDetections}</dd>
        <dt className="font-semibold">Kept originals (restored):</dt>
        <dd> {view.restoredCount}</dd>
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
