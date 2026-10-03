import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import "@testing-library/jest-dom/vitest";

import {
  beginItemProcessing,
  beginItemRead,
  createJob,
  recordItemProcessed,
  recordItemRead,
  recordItemReviewCompletion,
  setPolicy,
  withReviewState,
  type Job,
} from "../domain/job";
import {
  applyDecision,
  canFinalize,
  createReviewSession,
  getProgress,
  type ReviewSession,
} from "../review/review-domain";
import { createStructuredConfiguration } from "../structured/configuration";
import type { StructuredGrid } from "../structured/grid";
import { buildStructuredTransformPlan } from "../structured/transform-plan";
import { prepareStructuredOutput } from "../structured/transformed-dataset";
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

/**
 * Deterministic two-detection session built through the real domain API.
 * FECHA is a non-direct detection type: aggregate decision counts over the
 * session must stay neutrally worded for it (corrective C2).
 */
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

/** Deterministic session whose only detections are non-direct FECHA spans. */
function buildFechaSession(): ReviewSession {
  const source = "Fecha de nacimiento: 12/03/1984. Fecha de visita: 02/06/2024.";
  const first = source.indexOf("12/03/1984");
  const second = source.indexOf("02/06/2024");
  return createReviewSession({
    originalText: source,
    sessionId: "privacy-gate-fecha-test",
    detections: [
      {
        type: "FECHA",
        start: first,
        end: first + "12/03/1984".length,
        confidence: 0.9,
        proposed: "[FECHA-1]",
      },
      {
        type: "FECHA",
        start: second,
        end: second + "02/06/2024".length,
        confidence: 0.9,
        proposed: "[FECHA-2]",
      },
    ],
  });
}

function renderGate(job: Job, review: ReviewSession | null) {
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
    expect(summary).toHaveTextContent("Accepted replacements: 1");
    expect(summary).toHaveTextContent("Modified replacements: 1");
    expect(summary).toHaveTextContent("Manual detections: 0");

    // Availability derived from the job's outputs (written by the bridge).
    expect(screen.getByText("Ready")).toBeInTheDocument();
  });

  it(
    "keeps treated-count wording neutral for a completed non-direct type (FECHA): " +
      "no direct-identifier classification claim anywhere (corrective C2)",
    () => {
      const job = buildJob();
      let review = buildFechaSession();
      review = applyDecision(review, review.detections[0].id, "accepted");
      review = applyDecision(review, review.detections[1].id, "modified", {
        replacement: "[FECHA-2-EDITADA]",
      });
      const { container } = renderGate(withBridgeOutputs(job, review), review);

      const summary = screen.getByRole("group", { name: /review summary/i });
      // Neutral, factual aggregate wording: counts over ALL detection types.
      expect(summary).toHaveTextContent("Detections treated:");
      expect(summary).toHaveTextContent("Accepted replacements: 1");
      expect(summary).toHaveTextContent("Modified replacements: 1");

      // The direct-identifier classification claim must be gone from the
      // whole rendered output, not only from the summary list.
      expect(container.textContent ?? "").not.toMatch(/direct identifier/i);

      expect(screen.getByText("Ready")).toBeInTheDocument();
    }
  );

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

/**
 * T14 #18 WU-C: the candidate queue is reported factually by the gate. Only
 * the review authority (`getProgress`) supplies the facts; the row is a
 * neutral count and never a score or a safety claim.
 */
describe("PrivacyGate — low-confidence candidate facts (T14 #18 WU-C)", () => {
  const CANDIDATE_SOURCE = "Fisioterapeuta Nélida Otxoa realizó la sesión.";
  const CANDIDATE_SPAN = "Fisioterapeuta Nélida Otxoa realizó";

  function candidateSession(): ReviewSession {
    const start = CANDIDATE_SOURCE.indexOf(CANDIDATE_SPAN);
    return createReviewSession({
      originalText: CANDIDATE_SOURCE,
      sessionId: "privacy-gate-candidate-test",
      detections: [
        {
          type: "NOMBRE",
          start,
          end: start + CANDIDATE_SPAN.length,
          confidence: 0.45,
          proposed: "Profesional Sanitario 1",
          reason: "REVISION_MANUAL",
          lowConfidence: true,
        },
      ],
    });
  }

  it("reports the factual candidate total and pending count once the review completes", () => {
    let review = candidateSession();
    review = applyDecision(review, review.detections[0].id, "restored");
    const { container } = renderGate(withBridgeOutputs(buildJob(), review), review);

    const summary = screen.getByRole("group", { name: /review summary/i });
    expect(summary).toHaveTextContent("Low-confidence candidates:");
    expect(summary).toHaveTextContent("1 total, 0 pending");
    // Factual counts only: no score, safe percentage, anonymity or certification.
    expect(container.textContent ?? "").not.toMatch(FORBIDDEN_CLAIMS);
  });

  it("renders no candidate row for a session without candidates (pre-T14 gate unchanged)", () => {
    let review = buildSession();
    review = applyDecision(review, review.detections[0].id, "accepted");
    review = applyDecision(review, review.detections[1].id, "accepted");
    const { container } = renderGate(withBridgeOutputs(buildJob(), review), review);
    expect(screen.getByRole("group", { name: /review summary/i })).toBeInTheDocument();
    expect(container.textContent ?? "").not.toMatch(/low-confidence/i);
  });
});

/**
 * T17 #21 WU-C1 (SD-9): document-batch facts. The Job is the single authority
 * for item state; the active review session is `null` in these oracles, so a
 * null session must never break the gate. Fixtures are synthetic; no real
 * content anywhere.
 */
function buildBatchJob(names: readonly string[] = ["informe-a.txt", "informe-b.txt"]): Job {
  return createJob({
    type: "files",
    files: names.map((name) => ({ name, extension: "txt" })),
  });
}

/** Read one item successfully (queued → queued with held text). */
function readOk(job: Job, index: number, text: string): Job {
  return recordItemRead(beginItemRead(job, index), index, { ok: true, extractedText: text });
}

/** Fail one item's read with a typed adapter message (queued → error). */
function readFail(job: Job, index: number, message: string): Job {
  return recordItemRead(beginItemRead(job, index), index, {
    ok: false,
    error: { code: "pdf-no-text-layer", message },
  });
}

/** Drive one healthy item to its completed review state. */
function completeItem(job: Job, index: number, text: string): Job {
  const processed = recordItemProcessed(
    beginItemProcessing(readOk(job, index, text), index),
    index
  );
  return recordItemReviewCompletion(processed, index, true);
}

/** Item 0 failed, item 1 completed: review complete with one failed item. */
function failedBatchJob(): Job {
  const withFailure = readFail(buildBatchJob(), 0, "El PDF no tiene capa de texto.");
  const completed = completeItem(withFailure, 1, "Contenido sintético B.");
  return withReviewState(completed, { complete: true });
}

/** Both items read and queued: review incomplete, two pending items. */
function pendingBatchJob(): Job {
  return readOk(readOk(buildBatchJob(), 0, "Contenido sintético A."), 1, "Contenido sintético B.");
}

/** Both items completed: review complete, no failed items. */
function completedBatchJob(): Job {
  const first = completeItem(buildBatchJob(), 0, "Contenido sintético A.");
  const both = completeItem(first, 1, "Contenido sintético B.");
  return withReviewState(both, { complete: true });
}

/**
 * Mirror of the bridge's batch output authority (T17 #21 SD-6, corrected by
 * CORR-B): while no accepted batch output format exists, BOTH batch output
 * flags are false regardless of review completion.
 */
function withBatchOutputs(job: Job): Job {
  return {
    ...job,
    outputs: { safeOutputReady: false, confidentialAuditReady: false },
  } as Job;
}

describe("PrivacyGate — document batch facts (T17 #21 WU-C1, SD-9)", () => {
  it("lists every batch item with a visible status and the failed item's message", () => {
    renderGate(failedBatchJob(), null);

    const list = screen.getByRole("list", { name: /batch item status/i });
    expect(list).toHaveTextContent("informe-a.txt");
    expect(list).toHaveTextContent("Error");
    expect(list).toHaveTextContent("El PDF no tiene capa de texto.");
    expect(list).toHaveTextContent("informe-b.txt");
    expect(list).toHaveTextContent("Completed");

    const counts = screen.getByRole("group", { name: /batch item counts/i });
    expect(counts).toHaveTextContent("Pending: 0");
    expect(counts).toHaveTextContent("Completed: 1");
    expect(counts).toHaveTextContent("Failed: 1");
  });

  it("names the failed file and the remedy in the blocked copy", () => {
    renderGate(failedBatchJob(), null);

    const alert = screen.getByRole("alert");
    expect(alert).toHaveTextContent('"informe-a.txt"');
    expect(alert).toHaveTextContent("El PDF no tiene capa de texto.");
    expect(alert).toHaveTextContent("Create a new job without it to continue.");
  });

  it("blocks with the pending count across non-error items while review is incomplete", () => {
    renderGate(pendingBatchJob(), null);

    const alert = screen.getByRole("alert");
    expect(alert).toHaveTextContent(
      "Safe export is blocked while 2 mandatory review decisions are pending."
    );
    const list = screen.getByRole("list", { name: /batch item status/i });
    expect(list).toHaveTextContent("Queued");
    // No failed-items copy when there are no error items.
    expect(screen.queryByText(/batch item failed/i)).not.toBeInTheDocument();
  });

  it("never claims a factual error item for a pending, failure-free batch checkpoint", () => {
    // The exact defect (audit #62 F3): pending review decisions with no failed
    // item make `actionRequired` true while batch `outputBlocked` stays false,
    // so the checkpoint must not select the error-specific sentence.
    renderGate(pendingBatchJob(), null);

    const checkpoint = screen.getByRole("region", { name: "Decision checkpoint" });
    expect(checkpoint).toHaveTextContent("Action required");
    expect(checkpoint).not.toHaveTextContent("Review complete");
    // No factual error is present, so none may be claimed.
    expect(checkpoint).not.toHaveTextContent(/error/i);
    expect(checkpoint).not.toHaveTextContent(/factual error item/i);
    // The real cause — pending review decisions — is what the body reports.
    expect(checkpoint).toHaveTextContent(/mandatory review decisions are still pending/i);

    // The separate factual pending-review alert is unchanged and still shown.
    const alert = screen.getByRole("alert");
    expect(alert).toHaveTextContent(
      "Safe export is blocked while 2 mandatory review decisions are pending."
    );
  });

  it("reports both batch output surfaces unavailable for a fully reviewed error-free batch", () => {
    renderGate(withBatchOutputs(completedBatchJob()), null);

    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(screen.queryByText(/batch item failed/i)).not.toBeInTheDocument();
    const counts = screen.getByRole("group", { name: /batch item counts/i });
    expect(counts).toHaveTextContent("Failed: 0");
    // T17 #21 CORR-B: review completion is true, but no accepted batch output
    // format exists, so both batch output surfaces stay unavailable.
    expect(screen.getByText("Not ready")).toBeInTheDocument();
    expect(screen.getByText("Not available")).toBeInTheDocument();
    expect(
      screen.getByText(/Safe Output is not available for a document batch yet/)
    ).toBeInTheDocument();
    expect(
      screen.getByText(/Confidential Audit is not available for a document batch yet/)
    ).toBeInTheDocument();
  });

  it("never renders score, percentage, anonymity or certification claims with batch facts (D-006)", () => {
    const { container } = renderGate(failedBatchJob(), null);
    expect(container.textContent ?? "").not.toMatch(FORBIDDEN_CLAIMS);
  });
});

/**
 * T17 #21 CORR-B: batch-wide restored-original warnings. A batch has one
 * ReviewSession per document, so the Privacy Gate aggregates warning facts
 * over the COMPLETE set of available sessions. The selected document is
 * navigation state only, so a restored decision in a non-active document
 * stays visible at the gate.
 */
describe("PrivacyGate — batch restored-original warnings (T17 #21 CORR-B)", () => {
  function restoredSession(text: string, sessionId: string): ReviewSession {
    const name = "Carmen Sánchez";
    const start = text.indexOf(name);
    const session = createReviewSession({
      originalText: text,
      sessionId,
      detections: [
        {
          type: "NOMBRE",
          start,
          end: start + name.length,
          confidence: 0.95,
          proposed: "PACIENTE-1",
        },
      ],
    });
    return applyDecision(session, session.detections[0].id, "restored");
  }

  function pendingSession(text: string, sessionId: string): ReviewSession {
    const name = "Roberto Díaz";
    const start = text.indexOf(name);
    return createReviewSession({
      originalText: text,
      sessionId,
      detections: [
        {
          type: "NOMBRE",
          start,
          end: start + name.length,
          confidence: 0.95,
          proposed: "PACIENTE-2",
        },
      ],
    });
  }

  it("shows document A's restored warning while document B is the active session", () => {
    const textA = "Contenido sintético A. Nombre: Carmen Sánchez.";
    const textB = "Contenido sintético B. Paciente: Roberto Díaz.";
    const sessionA = restoredSession(textA, "batch-a");
    const sessionB = pendingSession(textB, "batch-b");
    render(
      <PrivacyGate job={buildBatchJob()} review={sessionB} batchSessions={[sessionA, sessionB]} />
    );

    // The active document is B (its own detections are pending), yet A's
    // restored decision is reported by the gate.
    const warnings = screen.getByRole("list", { name: /kept-original warnings/i });
    expect(warnings).toHaveTextContent("kept-original");
    expect(warnings).toHaveTextContent(
      "the original text was deliberately kept by reviewer decision (restored)"
    );
    expect(getProgress(sessionB).restored).toBe(0);
  });

  it("does not synthesize the non-active document's warning from the active session alone", () => {
    const sessionA = restoredSession("Nombre: Carmen Sánchez.", "batch-a-only");
    const sessionB = pendingSession("Paciente: Roberto Díaz.", "batch-b-only");
    render(<PrivacyGate job={buildBatchJob()} review={sessionB} />);

    // Without the complete set, only B's (pending) facts are visible; A's
    // restored warning must not be inferred from B.
    expect(screen.queryByRole("list", { name: /kept-original warnings/i })).not.toBeInTheDocument();
    // Sanity: A genuinely carries a restored decision.
    expect(getProgress(sessionA).restored).toBe(1);
  });
});

/**
 * UX-PILOT-02 (#55) presentation checkpoint: the three visual states are
 * driven by the SAME facts as before. These oracles assert the presentation
 * contract without introducing a second authority.
 */
describe("PrivacyGate — decision checkpoint (UX-PILOT-02 #55)", () => {
  it("shows the action-required checkpoint while mandatory decisions are pending", () => {
    renderGate(buildJob(), buildSession());
    const checkpoint = screen.getByRole("region", { name: "Decision checkpoint" });
    expect(checkpoint).toHaveTextContent("Action required");
    expect(checkpoint).not.toHaveTextContent("Review complete");
  });

  it("shows the review-complete checkpoint once Safe Output is ready", () => {
    let review = buildSession();
    review = applyDecision(review, review.detections[0].id, "accepted");
    review = applyDecision(review, review.detections[1].id, "accepted");
    renderGate(withBridgeOutputs(buildJob(), review), review);

    const checkpoint = screen.getByRole("region", { name: "Decision checkpoint" });
    expect(checkpoint).toHaveTextContent("Review complete");
    expect(checkpoint).toHaveTextContent("Safe Output is ready to download");
    expect(checkpoint).not.toHaveTextContent("Action required");
  });

  it("keeps factual attention facts visible in a labelled group", () => {
    let review = buildSession();
    review = applyDecision(review, review.detections[0].id, "restored");
    review = applyDecision(review, review.detections[1].id, "accepted");
    renderGate(withBridgeOutputs(buildJob(), review), review);

    const attention = screen.getByRole("region", { name: "Attention facts" });
    expect(attention).toHaveTextContent(/warnings and errors/i);
    expect(
      within(attention).getByRole("list", { name: /kept-original warnings/i })
    ).toBeInTheDocument();
  });
});

/**
 * UX-PILOT-02 (#55) spec conformance: the checkpoint must never say
 * "Review complete" while the current authority blocks the applicable output.
 * A structured job can have zero columns requiring review yet still be blocked
 * (e.g. a quasi-identifier date column with no explicit date role).
 */
describe("PrivacyGate — structured checkpoint state (UX-PILOT-02 #55)", () => {
  const GRID: StructuredGrid = {
    headers: ["Paciente", "Fecha_Visita", "Diagnostico"],
    rows: [
      ["P-001", "2023-01-10", "Gripe A"],
      ["P-002", "2023-03-15", "Fractura"],
    ],
  };

  it("shows Action required when the structured output is blocked with no column requiring review", () => {
    const configuration = createStructuredConfiguration(GRID, {
      selectedPatientIdColumn: "Paciente",
    });
    // No date role: the quasi-identifier date column is unsupported, so the
    // preparation blocks while columnsRequiringReview stays 0.
    expect(configuration.columnsRequiringReview).toHaveLength(0);
    const plan = buildStructuredTransformPlan(configuration, {
      policyId: "standard",
      jobSeed: "privacy-gate-structured-checkpoint",
    });
    const preparation = prepareStructuredOutput(configuration, plan);
    expect(preparation.status).toBe("blocked");

    const job = {
      kind: "structured",
      id: "structured-checkpoint-job",
      policyId: "standard",
      outputs: { safeOutputReady: false, confidentialAuditReady: false },
      errors: [],
    } as unknown as Job;

    render(
      <PrivacyGate job={job} review={null} structured={{ configuration, plan, preparation }} />
    );

    const checkpoint = screen.getByRole("region", { name: "Decision checkpoint" });
    expect(checkpoint).toHaveTextContent("Action required");
    expect(checkpoint).not.toHaveTextContent("Review complete");
    // UX-CLOSEOUT-01 (#63) outcome C: nothing is pending and no error is
    // present, so the body names the applicable output readiness cause.
    const body = checkpoint.querySelector("p");
    expect(body?.textContent ?? "").toMatch(/output readiness/i);
    expect(body?.textContent ?? "").not.toMatch(/error/i);
  });
});

/**
 * UX-CLOSEOUT-01 (#63) outcome C: when output readiness is blocked the
 * checkpoint body must name the operative factual cause instead of collapsing
 * every blocked output into one generic sentence. The presentation copy must
 * discriminate all four causes — pending mandatory review decisions, failed
 * batch items, job errors and applicable output readiness — and must never
 * assert a factual error item the job does not carry (the audit #62 F3 defect
 * must not regress). The checkpoint region keeps exactly one badge and exactly
 * one body paragraph (e2e/gate-export-ux.spec.ts locates `span`/`p` first and
 * measures contrast against them).
 */
describe("PrivacyGate — checkpoint cause discrimination (UX-CLOSEOUT-01 #63)", () => {
  it("names pending review decisions for a non-batch job whose output is blocked by pending decisions", () => {
    // buildJob() defaults to safeOutputReady false, so a non-batch output is
    // blocked; the only real cause is the two pending mandatory decisions.
    const { container } = renderGate(buildJob(), buildSession());

    const checkpoint = screen.getByRole("region", { name: "Decision checkpoint" });
    expect(checkpoint).toHaveTextContent("Action required");
    // The real cause — pending review decisions — is what the body reports.
    expect(checkpoint).toHaveTextContent(/mandatory review decisions are still pending/i);
    // No factual error is present, so none may be claimed.
    expect(checkpoint).not.toHaveTextContent(/error/i);
    expect(container.textContent ?? "").not.toMatch(FORBIDDEN_CLAIMS);

    // Exactly one badge + one body paragraph in the Decision checkpoint region.
    expect(checkpoint.querySelectorAll("span")).toHaveLength(1);
    expect(checkpoint.querySelectorAll("p")).toHaveLength(1);
  });

  it("distinguishes the failed-item cause for a document batch and never claims a job errors item", () => {
    // failedBatchJob: item 0 failed, item 1 completed, review complete, so the
    // only real cause is the failed batch item (view.errors is empty).
    renderGate(failedBatchJob(), null);

    const checkpoint = screen.getByRole("region", { name: "Decision checkpoint" });
    expect(checkpoint).toHaveTextContent("Action required");
    // The body distinguishes the failed-item cause...
    expect(checkpoint).toHaveTextContent(/batch item failed/i);
    // ...and never asserts a job `errors` item, since view.errors is empty.
    expect(checkpoint).not.toHaveTextContent(/factual error item/i);
    expect(checkpoint).not.toHaveTextContent(/error/i);

    expect(checkpoint.querySelectorAll("span")).toHaveLength(1);
    expect(checkpoint.querySelectorAll("p")).toHaveLength(1);
  });

  it("keeps the pending, failure-free batch body free of any error claim (single paragraph)", () => {
    // The original audit #62 F3 case, restated as a shape assertion.
    renderGate(pendingBatchJob(), null);

    const checkpoint = screen.getByRole("region", { name: "Decision checkpoint" });
    expect(checkpoint).toHaveTextContent(/mandatory review decisions are still pending/i);
    expect(checkpoint).not.toHaveTextContent(/error/i);
    expect(checkpoint.querySelectorAll("span")).toHaveLength(1);
    expect(checkpoint.querySelectorAll("p")).toHaveLength(1);
  });
});
