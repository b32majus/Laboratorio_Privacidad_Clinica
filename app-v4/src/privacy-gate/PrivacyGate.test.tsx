import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import "@testing-library/jest-dom/vitest";

import { createJob, setPolicy, type Job } from "../domain/job";
import {
  applyDecision,
  canFinalize,
  createReviewSession,
  type ReviewSession,
} from "../review/review-domain";
import { PrivacyGate } from "./PrivacyGate";

/**
 * Oracles for the Privacy Gate factual view (Work Order T08 U3; SPEC §6).
 *
 * The gate is driven around a REAL ReviewSession + Job and every assertion
 * derives from domain state (progress, pending detections, job outputs),
 * never from private component internals. Fixtures are synthetic clinical
 * text; no real content anywhere.
 *
 * D-006 claims gate: the rendered output must never contain a privacy
 * score, a safe percentage, an anonymity claim, GDPR certification or any
 * other certification wording — the gate reports factual state only.
 */
const FORBIDDEN_CLAIMS = /privacy score|safe percentage|anonym\w*|gdpr|certif\w*/i;

const SOURCE = "Nombre: Carmen Sánchez. Teléfono 612345678.";
const NAME_START = SOURCE.indexOf("Carmen Sánchez");
const NAME_END = NAME_START + "Carmen Sánchez".length;
const PHONE_START = SOURCE.indexOf("612345678");
const PHONE_END = PHONE_START + "612345678".length;

function buildJob(): Job {
  return createJob({ type: "pasted-text", text: SOURCE });
}

/** Deterministic two-detection session built through the real domain API. */
function buildSession(): ReviewSession {
  return createReviewSession({
    originalText: SOURCE,
    sessionId: "privacy-gate-test",
    detections: [
      {
        type: "NOMBRE",
        start: NAME_START,
        end: NAME_END,
        confidence: 0.95,
        proposed: "PACIENTE-1",
      },
      {
        type: "IDENTIFICADOR",
        start: PHONE_START,
        end: PHONE_END,
        confidence: 0.9,
        proposed: "ID-1",
      },
    ],
  });
}

function renderGate(job: Job, review: ReviewSession) {
  return render(<PrivacyGate job={job} review={review} />);
}

/**
 * Mirror of the state-bridge write (useJobSession.withDerivedReviewState):
 * output availability is derived from the review in the same atomic step.
 * The real bridge write is exercised end-to-end by the App flow tests.
 */
function withBridgeOutputs(job: Job, review: ReviewSession): Job {
  return {
    ...job,
    outputs: { safeOutputReady: canFinalize(review), confidentialAuditReady: true },
  } as Job;
}

afterEach(cleanup);

describe("PrivacyGate (T08 U3)", () => {
  it("renders the explicit blocked message with the pending count while mandatory decisions are pending", () => {
    const job = buildJob();
    const review = buildSession(); // both detections pending
    renderGate(job, review);

    const alert = screen.getByRole("alert");
    expect(alert).toHaveTextContent(
      "Safe export is blocked while 2 mandatory review decisions are pending."
    );
    // Fail-closed availability: nothing is ready while a decision is pending.
    expect(screen.getByText("Safe output:")).toBeInTheDocument();
    expect(screen.getByText("Not ready")).toBeInTheDocument();
  });

  it("renders factual treated counts for a completed review with accepted and modified decisions", () => {
    const job = buildJob();
    let review = buildSession();
    review = applyDecision(review, review.detections[0].id, "accepted");
    review = applyDecision(review, review.detections[1].id, "modified", {
      replacement: "[TELEFONO]",
    });
    renderGate(withBridgeOutputs(job, review), review);

    // No blocked state once every mandatory decision is complete.
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();

    const summary = screen.getByRole("group", { name: /review summary/i });
    expect(summary).toHaveTextContent("Accepted: 1");
    expect(summary).toHaveTextContent("Modified: 1");
    expect(summary).toHaveTextContent("Manual detections: 0");

    // Availability derived from the job's outputs (written by the bridge).
    expect(screen.getByText("Ready")).toBeInTheDocument();
  });

  it("shows a kept-original warning per restored detection, phrased as a completed decision, not leakage", () => {
    const job = buildJob();
    let review = buildSession();
    review = applyDecision(review, review.detections[0].id, "accepted");
    review = applyDecision(review, review.detections[1].id, "restored");
    renderGate(withBridgeOutputs(job, review), review);

    const warnings = screen.getByRole("list", { name: /kept-original warnings/i });
    expect(warnings).toHaveTextContent("kept-original");
    // Exact factual wording: the original was deliberately kept by reviewer
    // decision — restored is a legitimate completed decision, never framed
    // as correspondence leakage.
    expect(warnings).toHaveTextContent(
      "the original text was deliberately kept by reviewer decision (restored)"
    );
    expect(warnings.textContent).not.toMatch(/leak/i);

    // The review is complete (restored counts as decided): no blocked state.
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(screen.getByText("Ready")).toBeInTheDocument();
  });

  it("shows the privacy policy used", () => {
    const job = setPolicy(buildJob(), "strict");
    renderGate(job, buildSession());
    expect(screen.getByText("Privacy policy used:")).toBeInTheDocument();
    expect(screen.getByText("Strict")).toBeInTheDocument();
  });

  it("surfaces job errors factually when the job carries them", () => {
    const base = buildJob();
    const job = {
      ...base,
      errors: [
        { code: "extraction-failed", message: "Extraction failed for a synthetic document." },
      ],
    } as Job;
    renderGate(job, buildSession());
    const errors = screen.getByRole("list", { name: /job errors/i });
    expect(errors).toHaveTextContent("extraction-failed");
    expect(errors).toHaveTextContent("Extraction failed for a synthetic document.");
  });

  it("never renders score, percentage, anonymity, GDPR or certification claims (D-006 claims gate)", () => {
    const job = buildJob();
    let review = buildSession();
    review = applyDecision(review, review.detections[0].id, "restored");
    review = applyDecision(review, review.detections[1].id, "accepted");
    const { container } = renderGate(job, review);
    expect(container.textContent ?? "").not.toMatch(FORBIDDEN_CLAIMS);
  });
});
