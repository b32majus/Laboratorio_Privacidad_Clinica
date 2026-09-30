import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { useState } from "react";
import "@testing-library/jest-dom/vitest";

import { createJob } from "../domain/job";
import { derivePrivacyGateView } from "../privacy-gate/privacyGateModel";
import {
  addManualDetection,
  applyDecision,
  createReviewSession,
  createSessionFromEngineTextAsync,
  getFinalText,
  getProgress,
  type ManualDetectionInput,
  type ReviewDetection,
  type ReviewSession,
} from "./review-domain";
import { visibleDetections } from "./reviewWorkspaceModel";
import { ReviewWorkspace } from "./ReviewWorkspace";

/**
 * T14 #18 WU-C — the composed low-confidence workflow at the delivery
 * boundary: domain queue selection, the Privacy Gate facts and the visible
 * workspace controls all derive from the SAME review authority.
 *
 * The candidate is real: the composed engine (WU-A) reports below-threshold
 * recognition, the domain adapter (WU-B) carries it as a normal detection
 * marked `lowConfidence: true`, and this suite proves it is visible,
 * filterable, adjudicable and factually reported. Every fixture is synthetic
 * clinical-style text; no real content is used.
 */

/**
 * Real below-threshold fixture (verified by WU-A/WU-B): exactly one
 * `NOMBRE`/`profesional` candidate, confidence 0.45, reason `REVISION_MANUAL`,
 * and zero kept entities — the source's only detection is the candidate.
 */
const BELOW_THRESHOLD_TEXT =
  "La paciente acudió ayer. Fisioterapeuta Nélida Otxoa realizó la sesión.";

/**
 * Same candidate PLUS two kept entity detections, used at component level so
 * activating the low-confidence filter demonstrably NARROWS the list instead
 * of leaving a single-entry list unchanged.
 */
const ENTITY_AND_CANDIDATE_TEXT =
  "La paciente Lucía Ruiz acudió el 12/03/2024. Fisioterapeuta Nélida Otxoa realizó la sesión.";

const CANDIDATE_ORIGINAL = "Fisioterapeuta Nélida Otxoa realizó";
/** The detection list truncates long originals; this prefix survives truncation. */
const CANDIDATE_PREFIX = "Fisioterapeuta Nélida Otxoa";

function findCandidate(session: ReviewSession): ReviewDetection {
  const candidate = session.detections.find((detection) => detection.lowConfidence === true);
  if (candidate === undefined) {
    throw new Error("the composed path did not surface a lowConfidence candidate");
  }
  return candidate;
}

/** Test harness mirroring the app bridge: decisions flow through the domain. */
function Harness(props: { initial: ReviewSession }) {
  const [session, setSession] = useState(props.initial);
  return (
    <ReviewWorkspace
      session={session}
      onDecide={(id, decision, extras) =>
        setSession((current) => applyDecision(current, id, decision, extras))
      }
      onAddManual={(spec: ManualDetectionInput) =>
        setSession((current) => addManualDetection(current, spec))
      }
    />
  );
}

afterEach(cleanup);

describe("T14 WU-C — the low-confidence candidate queue is visible and composed", () => {
  it("the queue selects exactly the marked candidate, which also stays visible under All", async () => {
    const session = await createSessionFromEngineTextAsync(BELOW_THRESHOLD_TEXT, "standard");
    const candidate = findCandidate(session);

    // The engine/domain contract facts the workflow depends on.
    expect(candidate.reason).toBe("REVISION_MANUAL");
    expect(candidate.requiresReview).toBe(true);
    expect(getProgress(session).lowConfidence).toBe(1);

    const queue = visibleDetections(session, { status: "low-confidence", type: null });
    expect(queue.map((detection) => detection.id)).toEqual([candidate.id]);

    // The candidate is NEVER silently hidden by the queue being a subset.
    const all = visibleDetections(session, { status: "all", type: null });
    expect(all.map((detection) => detection.id)).toContain(candidate.id);
  });

  it("workflow gate facts: pending blocks the gate, decline restores source, treat applies the proposal", async () => {
    const session = await createSessionFromEngineTextAsync(BELOW_THRESHOLD_TEXT, "standard");
    const candidate = findCandidate(session);
    const job = createJob({ type: "pasted-text", text: BELOW_THRESHOLD_TEXT });

    // Pending: the candidate is a mandatory decision, so the gate is incomplete.
    const pendingView = derivePrivacyGateView(job, session);
    expect(pendingView.complete).toBe(false);
    expect(pendingView.pendingCount).toBe(1);
    expect(pendingView.lowConfidenceCount).toBe(1);
    expect(pendingView.lowConfidencePendingCount).toBe(1);

    // Decline (`restored`): keeps the original, completes the gate, keeps the fact.
    const declined = applyDecision(session, candidate.id, "restored");
    const declinedView = derivePrivacyGateView(job, declined);
    expect(declinedView.complete).toBe(true);
    expect(declinedView.pendingCount).toBe(0);
    expect(declinedView.lowConfidenceCount).toBe(1);
    expect(declinedView.lowConfidencePendingCount).toBe(0);
    expect(getFinalText(declined)).toBe(BELOW_THRESHOLD_TEXT);

    // Treat (`accepted`): applies the candidate's own proposal, completes the gate.
    const proposed = candidate.proposed ?? "";
    expect(proposed.length).toBeGreaterThan(0);
    const treated = applyDecision(session, candidate.id, "accepted");
    const treatedView = derivePrivacyGateView(job, treated);
    expect(treatedView.complete).toBe(true);
    expect(treatedView.lowConfidencePendingCount).toBe(0);
    const treatedText = getFinalText(treated);
    // Exact compositional oracle: treating the candidate replaces exactly its
    // own span with its own proposal, leaving every other byte untouched.
    expect(treatedText).toBe(
      BELOW_THRESHOLD_TEXT.slice(0, candidate.start) +
        proposed +
        BELOW_THRESHOLD_TEXT.slice(candidate.end)
    );
    expect(treatedText).not.toBe(BELOW_THRESHOLD_TEXT);
  });

  it("component: the filter narrows the list, progress reports the count, inspector shows the reason", async () => {
    render(
      <Harness
        initial={await createSessionFromEngineTextAsync(ENTITY_AND_CANDIDATE_TEXT, "standard")}
      />
    );

    // (b) Progress readout reports the factual low-confidence count.
    const progress = screen.getByRole("status", { name: /review progress/i });
    expect(progress).toHaveTextContent("Low confidence: 1");

    // The unfiltered list holds the candidate plus the kept entities.
    const list = screen.getByRole("list", { name: /detections/i });
    expect(within(list).getAllByRole("listitem").length).toBeGreaterThan(1);

    // (a) The filter control exists as a native, keyboard-reachable button.
    const filter = screen.getByRole("button", { name: /^Low confidence$/ });
    expect(filter.tagName).toBe("BUTTON");
    filter.focus();
    expect(filter).toHaveFocus();

    fireEvent.click(filter);
    expect(filter).toHaveAttribute("aria-pressed", "true");

    // Narrows to exactly the candidate; status and the low-confidence marker
    // are still conveyed as text. The list truncates the detection text, so
    // the visible row is asserted on the candidate prefix plus its explicit
    // marker rather than on the full span.
    const narrowed = screen.getByRole("list", { name: /detections/i });
    const items = within(narrowed).getAllByRole("listitem");
    expect(items).toHaveLength(1);
    expect(items[0]).toHaveTextContent(CANDIDATE_PREFIX);
    expect(items[0]).toHaveTextContent("Pending");
    expect(items[0]).toHaveTextContent(" · Low confidence");

    // (c) Selecting the candidate shows its reason and marker as text.
    fireEvent.click(within(narrowed).getByRole("button", { name: new RegExp(CANDIDATE_PREFIX) }));
    const inspector = screen.getByRole("complementary", { name: /entity inspector/i });
    expect(inspector).toHaveTextContent(CANDIDATE_ORIGINAL);
    expect(inspector).toHaveTextContent("Detection reason");
    expect(inspector).toHaveTextContent("REVISION_MANUAL");
    expect(inspector).toHaveTextContent(/below-threshold candidate/i);
  });

  it("oracle can disagree: the queue keys off the explicit marker, never the confidence number", async () => {
    const source = "Nombre: Ana. Teléfono 600000000.";
    const session = createReviewSession({
      originalText: source,
      sessionId: "marker-oracle",
      detections: [
        // Numerically low confidence but NO marker: must NOT enter the queue.
        { type: "NOMBRE", start: 8, end: 11, confidence: 0.05, proposed: "P-1" },
        // Explicit marker with HIGH confidence: must enter the queue.
        {
          type: "TELEFONO",
          start: 22,
          end: 31,
          confidence: 0.99,
          lowConfidence: true,
          proposed: "T-1",
        },
      ],
    });

    const queue = visibleDetections(session, { status: "low-confidence", type: null });
    expect(queue).toHaveLength(1);
    expect(queue[0].type).toBe("TELEFONO");

    // A filter that returned everything (or keyed off confidence numerically)
    // would fail this: the unmarked detection is visible under All only.
    const all = visibleDetections(session, { status: "all", type: null });
    expect(all.map((detection) => detection.type)).toEqual(["NOMBRE", "TELEFONO"]);
  });
});
