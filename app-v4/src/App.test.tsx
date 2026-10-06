import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import "@testing-library/jest-dom/vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { App } from "./App";
import type { PdfJsLib } from "./input/pdfjs-loader";
import {
  applyDecision,
  createSessionFromEngineTextAsync,
  getFinalText,
  type ReviewSession,
} from "./review/review-domain";
import { buildConfidentialAudit } from "./output/confidential-audit";
import {
  CONFIDENTIAL_AUDIT_WARNING_LINE,
  serializeConfidentialAudit,
} from "./output/confidential-audit-serializer";
import { buildSafeOutput, serializeSafeOutput } from "./output/safe-output";

const SYNTHETIC_NOTE = "Synthetic clinical note for deterministic tests.";
const LOCAL_ONLY_FACT = /processing runs locally in your browser/i;

function stepButton(stepNumber: number, label: string) {
  return screen.getByRole("button", { name: `${stepNumber}. ${label}` });
}

function createTextJob() {
  fireEvent.change(screen.getByLabelText("Paste text"), {
    target: { value: SYNTHETIC_NOTE },
  });
  fireEvent.click(screen.getByRole("button", { name: "Create job" }));
}

/**
 * T22 #26 WU-D: the Configure→Review transition runs the engine asynchronously
 * (lazy engine module load; later the Worker boundary). This helper clicks the
 * Review step and waits until the review workspace is actually installed, so
 * assertions observe the settled state instead of racing the async seam.
 */
async function goToReviewStep() {
  fireEvent.click(stepButton(3, "Review"));
  // #78: the reworked batch review surface carries the Spanish "Revisión"
  // heading; the single-document/structured surfaces keep "Review".
  await screen.findByRole("heading", { level: 2, name: /Revisión|Review/ }, { timeout: 5_000 });
}

afterEach(cleanup);

// ---------------------------------------------------------------------------
// T06 document-intake paths: committed synthetic fixtures only.
// ---------------------------------------------------------------------------
const FIXTURES_DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), "input", "fixtures");

function fixtureFile(name: string): File {
  return new File([new Uint8Array(readFileSync(path.join(FIXTURES_DIR, name)))], name);
}

function selectFiles(files: File[]) {
  fireEvent.change(screen.getByLabelText(/select files/i), { target: { files } });
}

async function seedRealPdfJs(): Promise<void> {
  // Same seam as the adapter tests: in the jsdom/Node environment pdf.js runs
  // a fake worker on the main thread via the documented pdfjsWorker global.
  const [pdfjs, worker] = await Promise.all([
    import("pdfjs-dist/legacy/build/pdf.js"),
    import("pdfjs-dist/legacy/build/pdf.worker.js"),
  ]);
  (globalThis as { pdfjsWorker?: unknown }).pdfjsWorker = worker;
  window.pdfjsLib = pdfjs as unknown as PdfJsLib;
}

describe("App shell", () => {
  it("renders the application heading", async () => {
    render(<App />);
    const heading = screen.getByRole("heading", {
      level: 1,
      name: "Laboratorio de Privacidad Clínica",
    });
    expect(heading).toBeInTheDocument();
  });

  it("starts on the Input step with later steps locked", async () => {
    render(<App />);
    expect(stepButton(1, "Input")).toHaveAttribute("aria-current", "step");
    expect(stepButton(2, "Configure")).toBeDisabled();
    expect(stepButton(3, "Review")).toBeDisabled();
    expect(stepButton(4, "Privacy Gate")).toBeDisabled();
    expect(stepButton(5, "Export")).toBeDisabled();
  });

  it("keeps the export step locked with an explicit fail-closed explanation", async () => {
    render(<App />);
    const exportButton = stepButton(5, "Export");
    expect(exportButton).toBeDisabled();
    expect(exportButton).toHaveAttribute(
      "title",
      "Export is blocked while mandatory review is incomplete."
    );
  });

  it("shows the persistent top-bar facts: job, type, policy, local-only processing", async () => {
    render(<App />);
    expect(screen.getByText("No job yet")).toBeInTheDocument();
    expect(screen.getByText(LOCAL_ONLY_FACT)).toBeInTheDocument();
    expect(screen.getByLabelText("Privacy Policy:")).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "Standard" }) as HTMLOptionElement).toHaveProperty(
      "selected",
      true
    );
  });

  it("creates a text job and shows its name and type in the top bar", async () => {
    render(<App />);
    createTextJob();
    expect(screen.getByText("Pasted text")).toBeInTheDocument();
    expect(screen.getByText("Text job")).toBeInTheDocument();
    expect(stepButton(1, "Input")).toHaveAttribute("aria-current", "step");
    expect(stepButton(2, "Configure")).toBeEnabled();
    // Draft intake is cleared after the job is created.
    expect(screen.getByLabelText("Paste text")).toHaveValue("");
  });

  it("creates a structured job and classifies its columns in the Configure workspace (T20 #24)", async () => {
    render(<App />);
    const csvFile = new File(
      [
        "NHC,Nombre,Diagnostico,CampoLibre",
        "00123,Ana,Gripe A,rotación de sala",
        "00456,Luis,Fractura,seguimiento",
      ],
      "labs.csv",
      { type: "text/csv" }
    );
    fireEvent.change(screen.getByLabelText(/select files/i), {
      target: { files: [csvFile] },
    });
    fireEvent.click(screen.getByRole("button", { name: "Create job" }));
    expect(screen.getByText("labs.csv")).toBeInTheDocument();
    expect(screen.getByText("Structured job")).toBeInTheDocument();

    // The parsed canonical configuration arrives asynchronously.
    fireEvent.click(stepButton(2, "Configure"));
    const list = await screen.findByRole("list", { name: /column classification list/i });
    expect(list).toHaveTextContent("NHC");
    expect(list).toHaveTextContent("CampoLibre");
    const facts = screen.getByRole("status", { name: /structured configuration facts/i });
    expect(facts).toHaveTextContent("Structured export ready: No");
  });

  it("surfaces the typed domain error instead of guessing a job kind", async () => {
    render(<App />);
    fireEvent.click(screen.getByRole("button", { name: "Create job" }));
    expect(screen.getByRole("alert")).toHaveTextContent(
      /pasted text is empty; provide text before creating a job/i
    );
    expect(screen.getByText("No job yet")).toBeInTheDocument();
  });

  it("clear session discards all in-memory job state and returns to fresh Input", async () => {
    render(<App />);
    createTextJob();
    expect(screen.getByText("Text job")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Clear session" }));
    expect(screen.getByText("No job yet")).toBeInTheDocument();
    expect(screen.queryByText("Text job")).not.toBeInTheDocument();
    expect(screen.getByLabelText("Paste text")).toHaveValue("");
    expect(stepButton(1, "Input")).toHaveAttribute("aria-current", "step");
    expect(stepButton(2, "Configure")).toBeDisabled();
  });

  it("New Job returns to a fresh Input state", async () => {
    render(<App />);
    createTextJob();
    fireEvent.click(stepButton(2, "Configure"));
    expect(screen.getByRole("heading", { level: 2, name: "Configure" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "New Job" }));
    expect(screen.getByText("No job yet")).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 2, name: "New Privacy Job" })).toBeInTheDocument();
    expect(stepButton(2, "Configure")).toBeDisabled();
  });

  it("keeps New Job and Clear session with distinct, legible purposes (UX-CLOSEOUT-01 E)", async () => {
    render(<App />);
    createTextJob();
    const newJob = screen.getByRole("button", { name: "New Job" });
    const clearSession = screen.getByRole("button", { name: "Clear session" });
    // Both accepted capabilities stay present and operable.
    expect(newJob).toBeEnabled();
    expect(clearSession).toBeEnabled();
    // Distinct explicit copy: the privacy-clearing action is not presented as a
    // duplicate of New Job.
    expect(newJob).toHaveAttribute("title");
    expect(clearSession).toHaveAttribute("title");
    expect(newJob.getAttribute("title")).not.toBe(clearSession.getAttribute("title"));
    expect(clearSession.getAttribute("title")).toMatch(/discard|in-memory/i);
    const helper = document.getElementById("session-actions-help");
    expect(helper).not.toBeNull();
    expect(helper).toHaveTextContent(/new job starts a new job/i);
    expect(helper).toHaveTextContent(/clear session deliberately discards/i);
  });

  it("renders the active workspace before the persistent policy guidance (UX-CLOSEOUT-01 A)", async () => {
    render(<App />);
    createTextJob();
    const main = document.getElementById("main-content");
    const guidance = screen.getByRole("region", { name: "Privacy Policy" });
    expect(main).not.toBeNull();
    // `main` precedes the policy guidance in document order, so four full policy
    // cards never render ahead of the user's active task.
    expect(
      (main as HTMLElement).compareDocumentPosition(guidance) & Node.DOCUMENT_POSITION_FOLLOWING
    ).toBeGreaterThan(0);
  });

  it("navigates forward and backward through the canonical steps without URL changes", async () => {
    render(<App />);
    const urlBefore = window.location.href;

    createTextJob();
    fireEvent.click(stepButton(2, "Configure"));
    expect(screen.getByRole("heading", { level: 2, name: "Configure" })).toBeInTheDocument();
    expect(stepButton(2, "Configure")).toHaveAttribute("aria-current", "step");
    expect(stepButton(1, "Input")).toBeEnabled();

    await goToReviewStep();
    expect(screen.getByRole("heading", { level: 2, name: "Review" })).toBeInTheDocument();

    fireEvent.click(stepButton(1, "Input"));
    expect(screen.getByRole("heading", { level: 2, name: "New Privacy Job" })).toBeInTheDocument();
    expect(stepButton(1, "Input")).toHaveAttribute("aria-current", "step");

    expect(window.location.href).toBe(urlBefore);
    expect(window.location.search).toBe("");
    expect(window.location.hash).toBe("");
  });

  it("never places job content in the URL across job creation and navigation", async () => {
    render(<App />);
    const urlBefore = window.location.href;

    createTextJob();
    fireEvent.click(stepButton(2, "Configure"));
    await goToReviewStep();
    fireEvent.click(stepButton(2, "Configure"));
    fireEvent.click(screen.getByRole("button", { name: "New Job" }));
    createTextJob();

    expect(window.location.href).toBe(urlBefore);
    expect(window.location.search).toBe("");
    expect(window.location.hash).toBe("");
  });

  it("renders an honest no-additional-configuration state for text Configure", async () => {
    render(<App />);
    createTextJob();
    fireEvent.click(stepButton(2, "Configure"));
    const region = screen.getByRole("region", { name: "Configure" });
    expect(
      within(region).getByRole("heading", { level: 2, name: "Configure" })
    ).toBeInTheDocument();
    expect(region).toHaveTextContent(/no additional configuration is required/i);
    expect(region).toHaveTextContent(/text job/i);
    expect(region).toHaveTextContent(/standard/i);
    expect(region).toHaveTextContent(/continue to review/i);
    expect(region).not.toHaveTextContent(/not implemented|later V4 migration/i);
  });

  it("keeps step navigation keyboard operable with visible focus targets", async () => {
    render(<App />);
    createTextJob();

    // Enabled step buttons are real focusable buttons.
    const configure = stepButton(2, "Configure");
    expect(configure.tagName).toBe("BUTTON");
    expect(configure).toBeEnabled();

    // Locked steps stay disabled and un-focusable until their guard passes.
    expect(stepButton(3, "Review")).toBeDisabled();

    configure.focus();
    expect(configure).toHaveFocus();

    fireEvent.click(configure);
    expect(stepButton(2, "Configure")).toHaveAttribute("aria-current", "step");

    // After advancing, the next forward step becomes reachable and focusable.
    const review = stepButton(3, "Review");
    expect(review).toBeEnabled();
    review.focus();
    expect(review).toHaveFocus();
  });
});

// ---------------------------------------------------------------------------
// UX-PILOT-01 (#52): the Input surface is framed as one "New Privacy Job"
// workspace. These oracles only observe presentation/accessibility; every
// intake semantic stays frozen (the domain tests remain the authority).
// ---------------------------------------------------------------------------
describe("App input workspace (UX-PILOT-01 #52)", () => {
  it("frames the empty Input as a single New Privacy Job task", () => {
    render(<App />);
    expect(screen.getByRole("heading", { level: 2, name: "New Privacy Job" })).toBeInTheDocument();
    expect(stepButton(1, "Input")).toHaveAttribute("aria-current", "step");
    expect(screen.getByText(/start a privacy job by pasting clinical text/i)).toBeInTheDocument();
  });

  it("explains which input produces each job type", () => {
    render(<App />);
    const guide = screen.getByRole("region", { name: "How the job type is chosen" });
    expect(guide).toHaveTextContent("Text job");
    expect(guide).toHaveTextContent("Document job");
    expect(guide).toHaveTextContent("Document batch");
    expect(guide).toHaveTextContent("Structured job");
    expect(guide).toHaveTextContent("TXT, PDF or DOCX");
    expect(guide).toHaveTextContent("CSV, XLS or XLSX");
  });

  it("summarizes selected files with their intake family", () => {
    render(<App />);
    selectFiles([new File(["nota"], "historia.txt"), new File(["a,b"], "labs.csv")]);
    const files = screen.getByRole("list", { name: "Selected files" });
    expect(within(files).getByText("historia.txt")).toBeInTheDocument();
    expect(within(files).getByText("labs.csv")).toBeInTheDocument();
    expect(within(files).getByText("Document")).toBeInTheDocument();
    expect(within(files).getByText("Structured")).toBeInTheDocument();
    expect(screen.getByText("2 files selected")).toBeInTheDocument();
  });

  it("exposes labelled, keyboard-focusable paste and file entry surfaces", () => {
    render(<App />);
    expect(
      screen.getByRole("heading", { level: 3, name: "Paste clinical text" })
    ).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 3, name: "Choose files" })).toBeInTheDocument();

    const textarea = screen.getByLabelText("Paste text");
    textarea.focus();
    expect(textarea).toHaveFocus();

    const fileInput = screen.getByLabelText(/select files/i) as HTMLInputElement;
    fileInput.focus();
    expect(fileInput).toHaveFocus();
    expect(fileInput).toHaveAttribute("accept", ".txt,.pdf,.docx,.csv,.xls,.xlsx");
  });

  it("keeps pasted text and files mutually exclusive with the typed message", () => {
    render(<App />);
    fireEvent.change(screen.getByLabelText("Paste text"), { target: { value: "nota" } });
    selectFiles([new File(["nota"], "historia.txt")]);
    fireEvent.click(screen.getByRole("button", { name: "Create job" }));
    expect(screen.getByRole("alert")).toHaveTextContent(
      "Use either pasted text or files for one job, not both."
    );
    expect(screen.getByText("No job yet")).toBeInTheDocument();
  });

  it("states the one-input-per-job constraint on the surface before submission", () => {
    render(<App />);
    const helper = screen.getByText(/use one input per job: pasted text or files, not both\./i);
    expect(helper).toBeInTheDocument();
    // The helper is always-on guidance, never the typed input error alert.
    expect(helper).not.toHaveAttribute("role", "alert");
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });
});

describe("App review workspace (T07)", () => {
  const REVIEW_NOTE =
    "Nombre: Carmen Sánchez\nLa paciente fue atendida por el Dr. García López el 12/03/2024. Contacto: 612345678.";

  async function createReviewJob() {
    fireEvent.change(screen.getByLabelText("Paste text"), { target: { value: REVIEW_NOTE } });
    fireEvent.click(screen.getByRole("button", { name: "Create job" }));
    fireEvent.click(stepButton(2, "Configure"));
    await goToReviewStep();
  }

  it("runs the engine once at the Configure→Review transition and renders the workspace", async () => {
    render(<App />);
    await createReviewJob();
    expect(screen.getByRole("region", { name: /review workspace/i })).toBeInTheDocument();
    const progress = screen.getByRole("status", { name: /review progress/i });
    expect(progress).toHaveTextContent(/Pending: [1-9]/);
    expect(screen.getByRole("group", { name: /document text with detections/i })).toHaveTextContent(
      "Carmen Sánchez"
    );
  });

  it("navigating away and back preserves review decisions and never re-runs the engine", async () => {
    render(<App />);
    await createReviewJob();
    const pendingBefore = screen
      .getByRole("status", { name: /review progress/i })
      .textContent?.match(/Pending: (\d+)/)?.[1];

    const firstDetection = screen
      .getAllByRole("list", { name: /detections/i })[0]
      .querySelector("button") as HTMLElement;
    fireEvent.click(firstDetection);
    fireEvent.click(screen.getByRole("button", { name: /accept detection/i }));
    expect(screen.getByRole("status", { name: /review progress/i })).toHaveTextContent(
      "Accepted: 1"
    );

    fireEvent.click(stepButton(1, "Input"));
    await goToReviewStep();
    const progress = screen.getByRole("status", { name: /review progress/i });
    expect(progress).toHaveTextContent("Accepted: 1");
    expect(progress).not.toHaveTextContent(`Pending: ${pendingBefore}`);
  });

  it("explains that structured review happens in Configure without faking a review workspace", async () => {
    render(<App />);
    const csvFile = new File(["col1,col2"], "labs.csv", { type: "text/csv" });
    fireEvent.change(screen.getByLabelText(/select files/i), {
      target: { files: [csvFile] },
    });
    fireEvent.click(screen.getByRole("button", { name: "Create job" }));
    fireEvent.click(stepButton(2, "Configure"));
    await goToReviewStep();
    const region = screen.getByRole("region", { name: "Review" });
    expect(within(region).getByRole("heading", { level: 2, name: "Review" })).toBeInTheDocument();
    expect(region).toHaveTextContent(/structured review happens in configure/i);
    expect(region).not.toHaveTextContent(/not implemented|later V4 migration/i);
    expect(screen.queryByRole("region", { name: /review workspace/i })).not.toBeInTheDocument();
  });

  it("keeps export fail-closed while mandatory review decisions are pending", async () => {
    render(<App />);
    await createReviewJob();
    expect(stepButton(5, "Export")).toBeDisabled();
  });
});

describe("App privacy gate (T08 U3)", () => {
  const REVIEW_NOTE =
    "Nombre: Carmen Sánchez\nLa paciente fue atendida por el Dr. García López el 12/03/2024. Contacto: 612345678.";

  async function createReviewJob() {
    fireEvent.change(screen.getByLabelText("Paste text"), { target: { value: REVIEW_NOTE } });
    fireEvent.click(screen.getByRole("button", { name: "Create job" }));
    fireEvent.click(stepButton(2, "Configure"));
    await goToReviewStep();
  }

  function pendingCount(): number {
    const progress = screen.getByRole("status", { name: /review progress/i });
    return Number(progress.textContent?.match(/Pending: (\d+)/)?.[1] ?? "0");
  }

  /** Accept detections one by one until no pending mandatory decision remains.
   * Uses the Pending filter so accepted detections leave the list and the
   * loop provably terminates. */
  function acceptAllDetections() {
    fireEvent.click(screen.getByRole("button", { name: "Pending" }));
    for (;;) {
      const lists = screen.queryAllByRole("list", { name: "Detections" });
      const first = lists[0] ? within(lists[0]).queryAllByRole("button")[0] : undefined;
      if (!first) break;
      fireEvent.click(first);
      fireEvent.click(screen.getByRole("button", { name: /accept detection/i }));
    }
  }

  function expectedBlockedMessage(count: number): string {
    return count === 1
      ? "Safe export is blocked while 1 mandatory review decision is pending."
      : `Safe export is blocked while ${count} mandatory review decisions are pending.`;
  }

  it("renders the gate with safeOutputReady true after every decision is resolved", async () => {
    render(<App />);
    await createReviewJob();
    acceptAllDetections();
    expect(pendingCount()).toBe(0);

    fireEvent.click(stepButton(4, "Privacy Gate"));
    expect(screen.getByRole("heading", { level: 2, name: "Privacy Gate" })).toBeInTheDocument();

    // Output availability is real derived state, written by the state bridge.
    expect(screen.getByText("Safe output:")).toBeInTheDocument();
    expect(screen.getByText("Ready")).toBeInTheDocument();
    expect(screen.getByText("Confidential audit:")).toBeInTheDocument();
    // Scoped to the gate's availability facts: the Policy workspace above also
    // renders the exact textual state "Available" per policy (POLICY-01 #56).
    const availabilityFacts = screen.getByRole("status", { name: /output availability facts/i });
    expect(within(availabilityFacts).getByText("Available")).toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();

    // The export gate agrees with review completeness (D-004).
    expect(stepButton(5, "Export")).toBeEnabled();
  });

  it("stays fail-closed: the gate shows the pending state while a decision is pending", async () => {
    render(<App />);
    await createReviewJob();
    const list = screen.getAllByRole("list", { name: /detections/i })[0];
    fireEvent.click(within(list).queryAllByRole("button")[0] as HTMLElement);
    fireEvent.click(screen.getByRole("button", { name: /accept detection/i }));
    const pending = pendingCount();
    expect(pending).toBeGreaterThan(0);

    fireEvent.click(stepButton(4, "Privacy Gate"));
    const alert = screen.getByRole("alert");
    expect(alert).toHaveTextContent(expectedBlockedMessage(pending));

    // Fail-closed availability: nothing became ready while decisions remain.
    expect(screen.getByText("Not ready")).toBeInTheDocument();
    expect(screen.queryByText("Ready")).not.toBeInTheDocument();
    expect(stepButton(5, "Export")).toBeDisabled();
  });

  it("reaches the single-item Result directly from Review without a mandatory Gate stop (REC-05 WU-B2)", async () => {
    render(<App />);
    await createReviewJob();
    acceptAllDetections();
    expect(pendingCount()).toBe(0);

    // Ordinary single-item journey: the last review decision -> Result in ONE
    // transition. The Privacy Gate stop is no longer mandatory.
    expect(stepButton(5, "Export")).toBeEnabled();
    fireEvent.click(stepButton(5, "Export"));
    expect(screen.getByRole("heading", { level: 2, name: "Resultado" })).toBeInTheDocument();

    // The Privacy Gate is not hidden, deleted or disabled: it stays an enabled,
    // optional destination reachable from Review (G-HP2: no new destination).
    fireEvent.click(stepButton(3, "Review"));
    expect(stepButton(4, "Privacy Gate")).toBeEnabled();
    fireEvent.click(stepButton(4, "Privacy Gate"));
    expect(screen.getByRole("heading", { level: 2, name: "Privacy Gate" })).toBeInTheDocument();
  });
});

describe("App policy change vs an existing review (PR #40 corrective C1+C2)", () => {
  const REVIEW_NOTE =
    "Nombre: Carmen Sánchez\nLa paciente fue atendida por el Dr. García López el 12/03/2024. Contacto: 612345678.";

  async function createReviewJob() {
    fireEvent.change(screen.getByLabelText("Paste text"), { target: { value: REVIEW_NOTE } });
    fireEvent.click(screen.getByRole("button", { name: "Create job" }));
    fireEvent.click(stepButton(2, "Configure"));
    await goToReviewStep();
  }

  function pendingCount(): number {
    const progress = screen.getByRole("status", { name: /review progress/i });
    return Number(progress.textContent?.match(/Pending: (\d+)/)?.[1] ?? "0");
  }

  /** Accept detections one by one until no pending mandatory decision remains. */
  function acceptAllDetections() {
    fireEvent.click(screen.getByRole("button", { name: "Pending" }));
    for (;;) {
      const lists = screen.queryAllByRole("list", { name: "Detections" });
      const first = lists[0] ? within(lists[0]).queryAllByRole("button")[0] : undefined;
      if (!first) break;
      fireEvent.click(first);
      fireEvent.click(screen.getByRole("button", { name: /accept detection/i }));
    }
  }

  it("a completed review cannot be relabelled: a real policy change blocks the gates again and the review restarts under the new policy", async () => {
    render(<App />);
    await createReviewJob();
    acceptAllDetections();
    expect(pendingCount()).toBe(0);
    // From the Privacy Gate step, Export is the immediate next step, so its
    // enabled state is a real derived-gate assertion (not step-ordering).
    fireEvent.click(stepButton(4, "Privacy Gate"));
    expect(stepButton(5, "Export")).toBeEnabled();

    // The select stays enabled: the invalidation must be state-enforced,
    // not achieved by disabling the control (requirement 6).
    const policySelect = screen.getByLabelText("Privacy Policy:");
    expect(policySelect).toBeEnabled();
    fireEvent.change(policySelect, { target: { value: "strict" } });

    // State behavior, not the control: export is blocked again because the
    // derived review-dependent state was reset in the same transition.
    expect(stepButton(5, "Export")).toBeDisabled();

    // The stale session is gone: re-entering Review creates a fresh session
    // under the new policy, with every decision pending again.
    await goToReviewStep();
    expect(screen.getByRole("region", { name: /review workspace/i })).toBeInTheDocument();
    expect(pendingCount()).toBeGreaterThan(0);

    // Completing the review again re-opens the gate, which reports the NEW
    // policy factually — the old review was never relabelled to it.
    acceptAllDetections();
    fireEvent.click(stepButton(4, "Privacy Gate"));
    expect(stepButton(5, "Export")).toBeEnabled();
    const facts = screen.getByRole("status", { name: /output availability facts/i });
    expect(facts).toHaveTextContent("Privacy policy used: Strict");
    expect(facts).toHaveTextContent("Safe output: Ready");
  });

  it("an unchanged policy selection is an exact no-op: the completed review survives", async () => {
    render(<App />);
    await createReviewJob();
    acceptAllDetections();
    fireEvent.click(stepButton(4, "Privacy Gate"));
    expect(stepButton(5, "Export")).toBeEnabled();

    fireEvent.change(screen.getByLabelText("Privacy Policy:"), {
      target: { value: "standard" },
    });

    expect(stepButton(5, "Export")).toBeEnabled();
    fireEvent.click(stepButton(4, "Privacy Gate"));
    const facts = screen.getByRole("status", { name: /output availability facts/i });
    expect(facts).toHaveTextContent("Privacy policy used: Standard");
    expect(facts).toHaveTextContent("Safe output: Ready");
  });

  it("all four policies are selectable through the UI on a text job (REC-02)", async () => {
    render(<App />);
    createTextJob();

    // Since REC-02 every accepted policy has a text mapping, so all four
    // options are enabled and selectable.
    for (const name of ["Standard", "External AI", "Longitudinal Research", "Strict"]) {
      expect(screen.getByRole("option", { name })).toBeEnabled();
    }

    const policySelect = screen.getByLabelText("Privacy Policy:") as HTMLSelectElement;
    fireEvent.change(policySelect, { target: { value: "external-ai" } });
    expect(policySelect.value).toBe("external-ai");
    expect(
      (screen.getByRole("option", { name: "External AI" }) as HTMLOptionElement).selected
    ).toBe(true);

    // The newly enabled text policy reaches Review and never surfaces a
    // spurious typed failure.
    fireEvent.click(stepButton(2, "Configure"));
    await goToReviewStep();
    expect(screen.getByRole("region", { name: /review workspace/i })).toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("a policy selection is a state change, not a review start: the gate stays fail-closed until Review (REC-02)", async () => {
    render(<App />);
    createTextJob();
    fireEvent.change(screen.getByLabelText("Privacy Policy:"), {
      target: { value: "longitudinal-research" },
    });

    // Selecting the policy does not start review or open the export gate.
    expect(stepButton(5, "Export")).toBeDisabled();
    fireEvent.click(stepButton(2, "Configure"));
    expect(stepButton(2, "Configure")).toHaveAttribute("aria-current", "step");
    expect(screen.queryByRole("region", { name: /review workspace/i })).not.toBeInTheDocument();
    expect(stepButton(5, "Export")).toBeDisabled();
  });
});

describe("App document intake (T06)", () => {
  afterEach(() => {
    delete window.pdfjsLib;
    delete (globalThis as { pdfjsWorker?: unknown }).pdfjsWorker;
  });

  it("never advertises legacy .doc in the file input accept attribute", async () => {
    render(<App />);
    const input = screen.getByLabelText(/select files/i) as HTMLInputElement;
    expect(input).toHaveAttribute("accept", ".txt,.pdf,.docx,.csv,.xls,.xlsx");
  });

  it("creates a document job from a TXT fixture after extraction", async () => {
    render(<App />);
    selectFiles([fixtureFile("sample-clinical-note.txt")]);
    fireEvent.click(screen.getByRole("button", { name: "Create job" }));
    await waitFor(() => {
      expect(screen.getByText("Document job")).toBeInTheDocument();
    });
    expect(screen.getByText("sample-clinical-note.txt")).toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    // Draft intake is cleared after the job is created.
    expect(screen.getByLabelText("Paste text")).toHaveValue("");
  });

  it("surfaces a typed unsupported alert for legacy .doc and creates no job", async () => {
    render(<App />);
    selectFiles([fixtureFile("sample-legacy.doc")]);
    fireEvent.click(screen.getByRole("button", { name: "Create job" }));
    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent(/\.doc.*unsupported type/i);
    expect(screen.getByText("No job yet")).toBeInTheDocument();
    expect(screen.queryByText("Document job")).not.toBeInTheDocument();
  });

  it("surfaces a typed extraction-failed alert for a corrupt DOCX and creates no job", async () => {
    render(<App />);
    selectFiles([fixtureFile("corrupt.docx")]);
    fireEvent.click(screen.getByRole("button", { name: "Create job" }));
    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent(/could not be parsed/i);
    expect(screen.getByText("No job yet")).toBeInTheDocument();
  });

  it("surfaces the empty-input alert for an empty TXT and creates no job", async () => {
    render(<App />);
    selectFiles([new File(["   \n\t "], "empty.txt")]);
    fireEvent.click(screen.getByRole("button", { name: "Create job" }));
    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent(/is empty/i);
    expect(screen.getByText("No job yet")).toBeInTheDocument();
  });

  it("surfaces the pdf-no-text-layer alert for a scan-like PDF and creates no job", async () => {
    await seedRealPdfJs();
    render(<App />);
    selectFiles([fixtureFile("sample-scanned.pdf")]);
    fireEvent.click(screen.getByRole("button", { name: "Create job" }));
    // Real pdf.js extraction under parallel vitest workers can exceed the
    // default 1s poll budget on a loaded machine; the oracle disagrees on
    // alert CONTENT, not on millisecond latency.
    const alert = await screen.findByRole("alert", {}, { timeout: 10_000 });
    expect(alert).toHaveTextContent(/no extractable text|no text layer/i);
    expect(screen.getByText("No job yet")).toBeInTheDocument();
  });

  it("creates a document job from the text-bearing PDF fixture", async () => {
    await seedRealPdfJs();
    render(<App />);
    selectFiles([fixtureFile("sample-clinical-note.pdf")]);
    fireEvent.click(screen.getByRole("button", { name: "Create job" }));
    // Same pdf.js latency budget as the scan-like-PDF oracle above.
    await waitFor(
      () => {
        expect(screen.getByText("Document job")).toBeInTheDocument();
      },
      { timeout: 10_000 }
    );
    expect(screen.getByText("sample-clinical-note.pdf")).toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("still rejects a mixed structured/document selection with the typed ambiguous error", async () => {
    render(<App />);
    selectFiles([fixtureFile("sample-clinical-note.txt"), new File(["a,b"], "labs.csv")]);
    fireEvent.click(screen.getByRole("button", { name: "Create job" }));
    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent(/cannot be mixed/i);
    expect(screen.getByText("No job yet")).toBeInTheDocument();
  });
});

describe("App export step (T08 U4)", () => {
  const JOB1_NOTE =
    "Nombre: Carmen Sánchez\nLa paciente fue atendida por el Dr. García López el 12/03/2024. Contacto: 612345678.";
  const JOB2_NOTE =
    "Paciente: Roberto Díaz\nRevisado por la Dra. Elena Vidal el 03/07/2025. Contacto: 654321987.";

  const SAFE_BUTTON = "Descargar como TXT (.txt)";
  const AUDIT_BUTTON = "Descargar auditoría confidencial (.txt)";
  const AUDIT_CONFIRM = "Confirmar descarga confidencial";

  type CapturedDownload = { readonly fileName: string; readonly blob: Blob };

  /** Stub the client-side download seam (Blob + object URL + anchor click). */
  function captureDownloads(): {
    readonly downloads: CapturedDownload[];
    restore(): void;
  } {
    const downloads: CapturedDownload[] = [];
    const blobs: Blob[] = [];
    const originalCreate = URL.createObjectURL;
    const originalRevoke = URL.revokeObjectURL;
    const originalClick = HTMLAnchorElement.prototype.click;
    URL.createObjectURL = vi.fn((blob: Blob) => {
      blobs.push(blob);
      return `blob:mock-${blobs.length}`;
    }) as typeof URL.createObjectURL;
    URL.revokeObjectURL = vi.fn() as typeof URL.revokeObjectURL;
    HTMLAnchorElement.prototype.click = vi.fn(function (this: HTMLAnchorElement) {
      const match = /blob:mock-(\d+)/.exec(this.getAttribute("href") ?? "");
      const index = match ? Number(match[1]) - 1 : -1;
      downloads.push({ fileName: this.getAttribute("download") ?? "", blob: blobs[index] });
    }) as typeof HTMLAnchorElement.prototype.click;
    return {
      downloads,
      restore: () => {
        URL.createObjectURL = originalCreate;
        URL.revokeObjectURL = originalRevoke;
        HTMLAnchorElement.prototype.click = originalClick;
      },
    };
  }

  /** jsdom's Blob lacks .text(); read the captured artifact via FileReader. */
  async function textOf(download: CapturedDownload | undefined): Promise<string> {
    if (!download) throw new Error("expected a captured download");
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result));
      reader.onerror = () => reject(reader.error);
      reader.readAsText(download.blob);
    });
  }

  function acceptAllDetections() {
    fireEvent.click(screen.getByRole("button", { name: "Pending" }));
    for (;;) {
      const lists = screen.queryAllByRole("list", { name: "Detections" });
      const first = lists[0] ? within(lists[0]).queryAllByRole("button")[0] : undefined;
      if (!first) break;
      fireEvent.click(first);
      fireEvent.click(screen.getByRole("button", { name: /accept detection/i }));
    }
  }

  /** Full flow: create a text job, complete its review, reach Export. */
  async function completeReviewToExport(note: string) {
    fireEvent.change(screen.getByLabelText("Paste text"), { target: { value: note } });
    fireEvent.click(screen.getByRole("button", { name: "Create job" }));
    fireEvent.click(stepButton(2, "Configure"));
    await goToReviewStep();
    acceptAllDetections();
    fireEvent.click(stepButton(4, "Privacy Gate"));
    fireEvent.click(stepButton(5, "Export"));
    expect(screen.getByRole("heading", { level: 2, name: "Resultado" })).toBeInTheDocument();
  }

  /** Pure-domain replica: the same engine, text and decisions as the App flow. */
  async function replicaSession(note: string): Promise<ReviewSession> {
    const session = await createSessionFromEngineTextAsync(note, "standard");
    let next = session;
    for (const detection of next.detections) {
      next = applyDecision(next, detection.id, "accepted");
    }
    return next;
  }

  /** The audit's Session line is per-session; normalize it for comparison. */
  function normalizeAudit(text: string): string {
    return text.replace(/^Session: .*$/m, "Session: <session>");
  }

  it("renders two separate download actions with the confidential warning on Export", async () => {
    render(<App />);
    await completeReviewToExport(JOB1_NOTE);

    const safeButton = screen.getByRole("button", { name: SAFE_BUTTON });
    const auditButton = screen.getByRole("button", { name: AUDIT_BUTTON });
    expect(safeButton).toBeEnabled();
    expect(auditButton).toBeEnabled();
    // PDR-08: the single-item zone copy is Spanish; the English marker is the
    // serialized-payload authority, not UI copy.
    expect(screen.getByText("Confidencial — artefacto interno de auditoría")).toBeInTheDocument();
    expect(screen.queryByText("INTERNAL AUDIT ARTIFACT")).not.toBeInTheDocument();
    expect(screen.getByText(/nunca debe compartirse/i)).toBeInTheDocument();
    // Fail-closed gate passed: no blocked reason remains on the surface.
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    // Claims gate (D-006): no anonymity/compliance wording anywhere.
    const body = document.body.textContent ?? "";
    expect(body).not.toMatch(/anonym|gdpr|privacy score|certif|complian/i);
  });

  it("session isolation: after Clear session, the new job's artifacts carry no prior-job data (acceptance 6)", async () => {
    const captured = captureDownloads();
    try {
      render(<App />);

      // Job 1: complete review and download its confidential audit.
      await completeReviewToExport(JOB1_NOTE);
      fireEvent.click(screen.getByRole("button", { name: AUDIT_BUTTON }));
      fireEvent.click(screen.getByRole("button", { name: AUDIT_CONFIRM }));
      const audit1 = await textOf(captured.downloads[0]);
      expect(captured.downloads[0].fileName).toBe("auditoria-confidencial.txt");
      expect(audit1.startsWith(CONFIDENTIAL_AUDIT_WARNING_LINE)).toBe(true);
      expect(audit1).toContain("Carmen Sánchez");
      expect(audit1).toContain("612345678");

      // Clear session and run a second, different job end-to-end.
      fireEvent.click(screen.getByRole("button", { name: "Clear session" }));
      expect(screen.getByText("No job yet")).toBeInTheDocument();
      await completeReviewToExport(JOB2_NOTE);
      fireEvent.click(screen.getByRole("button", { name: AUDIT_BUTTON }));
      fireEvent.click(screen.getByRole("button", { name: AUDIT_CONFIRM }));
      fireEvent.click(screen.getByRole("button", { name: SAFE_BUTTON }));

      const audit2 = await textOf(captured.downloads[1]);
      const safe2 = await textOf(captured.downloads[2]);

      // No trace of job 1 originals or mapping anywhere in job 2's audit.
      expect(audit2).not.toContain("Carmen Sánchez");
      expect(audit2).not.toContain("García López");
      expect(audit2).not.toContain("612345678");
      expect(audit2).not.toContain("12/03/2024");
      expect(audit2).toContain("Roberto Díaz");
      expect(audit2).toContain("654321987");

      // Structural proof: job 2's audit matches an audit built from a
      // session 2 replica ONLY (same engine, same text, same decisions).
      const replica2 = await replicaSession(JOB2_NOTE);
      expect(normalizeAudit(audit2)).toBe(
        normalizeAudit(serializeConfidentialAudit(buildConfidentialAudit(replica2)))
      );
      // And job 2's Safe Output equals its own canonical final text.
      expect(safe2).toBe(serializeSafeOutput(buildSafeOutput(replica2)));
      expect(safe2).toBe(getFinalText(replica2));
    } finally {
      captured.restore();
    }
  });

  it("rerender invariance: navigating away and back never changes the Safe Output bytes (acceptance 7)", async () => {
    const captured = captureDownloads();
    try {
      render(<App />);
      await completeReviewToExport(JOB1_NOTE);

      fireEvent.click(screen.getByRole("button", { name: SAFE_BUTTON }));
      const before = await textOf(captured.downloads[0]);

      // Force unrelated re-renders of the shell (navigation + a same-value
      // policy change; a REAL policy change invalidates the review by
      // contract — see the C2 flow oracle — so it must not be used here).
      fireEvent.click(stepButton(1, "Input"));
      fireEvent.click(stepButton(5, "Export"));
      fireEvent.change(screen.getByLabelText("Privacy Policy:"), {
        target: { value: "standard" },
      });

      fireEvent.click(screen.getByRole("button", { name: SAFE_BUTTON }));
      const after = await textOf(captured.downloads[1]);
      expect(after).toBe(before);
      expect(captured.downloads[1].fileName).toBe("texto-preparado.txt");
    } finally {
      captured.restore();
    }
  });
});

// ---------------------------------------------------------------------------
// T17 #21 WU-C2: two-phase batch intake, batch review navigation, gate/export
// wiring. Synthetic fixtures only; the pdf oracles' 10s budgets are untouched.
// ---------------------------------------------------------------------------
describe("App document batch (T17 #21 WU-C2)", () => {
  const BATCH_NOTE_A =
    "Nombre: Carmen Sánchez\nLa paciente fue atendida por el Dr. García López. Contacto: 612345678.";
  const BATCH_NOTE_B =
    "Paciente: Roberto Díaz\nRevisado por la Dra. Elena Vidal. Contacto: 654321987.";

  /** Select files, create the job and wait until every read has settled. */
  async function createBatchAndSettle(files: File[]) {
    selectFiles(files);
    fireEvent.click(screen.getByRole("button", { name: "Create job" }));
    // The Create control is disabled while reads are in flight; it becomes
    // enabled again exactly when the read phase settled (isExtracting false).
    await waitFor(
      () => {
        expect(screen.getByRole("button", { name: "Create job" })).toBeEnabled();
      },
      { timeout: 10_000 }
    );
    expect(screen.getByText("Document batch")).toBeInTheDocument();
  }

  /** Complete the ACTIVE document's mandatory decisions via restored. */
  function completeActiveDocument() {
    fireEvent.click(screen.getByRole("button", { name: "Pending" }));
    for (;;) {
      const lists = screen.queryAllByRole("list", { name: "Detections" });
      const first = lists[0] ? within(lists[0]).queryAllByRole("button")[0] : undefined;
      if (!first) break;
      fireEvent.click(first);
      fireEvent.click(screen.getByRole("button", { name: "Keep original" }));
    }
  }

  function documentSelector(): HTMLElement {
    return screen.getByRole("region", { name: "Batch documents" });
  }

  it("creates a batch with one failed document: the failure stays visible on input and blocks gate/export", async () => {
    render(<App />);
    // One good synthetic TXT + one forced-failure DOCX fixture → a batch, NOT
    // an all-or-nothing refusal (BATCH-001).
    await createBatchAndSettle([
      new File([BATCH_NOTE_A], "historia-buena.txt"),
      fixtureFile("corrupt.docx"),
    ]);

    // The failed item is surfaced IMMEDIATELY on the input step (name + message).
    const failedList = screen.getByRole("list", { name: "Failed documents" });
    expect(within(failedList).getByText("corrupt.docx")).toBeInTheDocument();
    expect(failedList).toHaveTextContent(/could not be parsed/i);

    // Enter review: the good item is reviewable; the failed item is listed but
    // not selectable and keeps its message.
    fireEvent.click(stepButton(2, "Configure"));
    await goToReviewStep();
    await waitFor(
      () => {
        expect(screen.getByRole("region", { name: /review workspace/i })).toBeInTheDocument();
      },
      { timeout: 10_000 }
    );
    const selector = documentSelector();
    expect(selector).toHaveTextContent("historia-buena.txt");
    expect(selector).toHaveTextContent(/historia-buena\.txt — Requiere revisión/);
    expect(selector).toHaveTextContent(/corrupt\.docx — Error/);
    expect(selector).toHaveTextContent(/could not be parsed/i);
    // The failed item exposes no review button (no session exists).
    expect(within(selector).queryByRole("button", { name: /corrupt\.docx/ })).toBeNull();

    // Privacy Gate lists both items with their statuses and blocks, naming the
    // failed file with its message.
    fireEvent.click(stepButton(4, "Privacy Gate"));
    expect(screen.getByRole("heading", { level: 2, name: "Privacy Gate" })).toBeInTheDocument();
    const batchList = screen.getByRole("list", { name: "Batch item status" });
    expect(within(batchList).getByText("historia-buena.txt")).toBeInTheDocument();
    expect(within(batchList).getByText("corrupt.docx")).toBeInTheDocument();
    expect(batchList).toHaveTextContent(/historia-buena\.txt: Review required/);
    expect(batchList).toHaveTextContent(/corrupt\.docx: Error/);
    expect(batchList).toHaveTextContent(/could not be parsed/i);

    const failedAlert = screen
      .getAllByRole("alert")
      .find((alert) => /corrupt\.docx/.test(alert.textContent ?? ""));
    expect(failedAlert).toBeDefined();
    expect(failedAlert).toHaveTextContent(/could not be parsed/i);

    // Safe Export stays disabled (review incomplete and a failed item).
    expect(stepButton(5, "Export")).toBeDisabled();
  });

  it("selecting and navigating between documents never marks one reviewed (FUNC-002, SD-5)", async () => {
    render(<App />);
    await createBatchAndSettle([
      new File([BATCH_NOTE_A], "doc-a.txt"),
      new File([BATCH_NOTE_B], "doc-b.txt"),
    ]);
    fireEvent.click(stepButton(2, "Configure"));
    // Batch review navigation is synchronous: processing is driven by the
    // reads-settle effect, so there is nothing async to await here.
    fireEvent.click(stepButton(3, "Review"));
    await waitFor(() =>
      expect(screen.getByRole("region", { name: /review workspace/i })).toBeInTheDocument()
    );

    // The active document is A: complete its mandatory decisions.
    completeActiveDocument();
    await waitFor(() => expect(documentSelector()).toHaveTextContent(/doc-a\.txt — Completado/));
    expect(documentSelector()).toHaveTextContent(/doc-b\.txt — Requiere revisión/);

    // Select B: only the viewed document changes; A keeps its completion.
    const docB = within(documentSelector()).getByRole("button", { name: /doc-b\.txt/ });
    fireEvent.click(docB);
    expect(docB).toHaveAttribute("aria-current", "true");
    const progress = screen.getByRole("status", { name: /review progress/i });
    const pendingB = Number(progress.textContent?.match(/Pending: (\d+)/)?.[1] ?? "0");
    expect(pendingB).toBeGreaterThan(0);
    expect(documentSelector()).toHaveTextContent(/doc-a\.txt — Completado/);
    expect(documentSelector()).toHaveTextContent(/doc-b\.txt — Requiere revisión/);

    // Navigate away and back: nothing was auto-accepted or flipped.
    // Batch review navigation is synchronous (reads-settle effect).
    fireEvent.click(stepButton(1, "Input"));
    fireEvent.click(stepButton(3, "Review"));
    await waitFor(() =>
      expect(screen.getByRole("region", { name: /review workspace/i })).toBeInTheDocument()
    );
    expect(documentSelector()).toHaveTextContent(/doc-a\.txt — Completado/);
    expect(documentSelector()).toHaveTextContent(/doc-b\.txt — Requiere revisión/);
    const progressAfter = screen.getByRole("status", { name: /review progress/i });
    expect(progressAfter.textContent?.match(/Pending: (\d+)/)?.[1]).toBe(String(pendingB));
    // B's review controls are present and untouched: nothing was auto-accepted.
    const detectionButtons = within(
      screen.getByRole("list", { name: "Detections" })
    ).queryAllByRole("button");
    expect(detectionButtons.length).toBeGreaterThan(0);
  });

  it("does not start processing while a read is in flight and starts once reads settle", async () => {
    render(<App />);
    let resolveText!: (value: string) => void;
    const deferred = new Promise<string>((resolve) => {
      resolveText = resolve;
    });
    // A File-like whose read only resolves when the oracle says so.
    const slowFile = { name: "doc-a.txt", text: () => deferred } as unknown as File;

    selectFiles([slowFile, new File([BATCH_NOTE_B], "doc-b.txt")]);
    fireEvent.click(screen.getByRole("button", { name: "Create job" }));
    await waitFor(() => expect(screen.getByText("Document batch")).toBeInTheDocument());
    expect(screen.getByRole("status")).toHaveTextContent(/reading documents… 0 of 2 read/i);

    fireEvent.click(stepButton(2, "Configure"));
    await goToReviewStep();
    // Reads have NOT settled: no processing and a factual reading state.
    expect(documentSelector()).toHaveTextContent(/doc-a\.txt — Leyendo/);
    expect(screen.queryByRole("region", { name: /review workspace/i })).not.toBeInTheDocument();
    expect(screen.getByText(/se están leyendo todavía/i)).toBeInTheDocument();

    // Settle the read: the one-shot batch attempt starts automatically.
    await act(async () => {
      resolveText(BATCH_NOTE_A);
    });
    await waitFor(
      () => {
        expect(screen.getByRole("region", { name: /review workspace/i })).toBeInTheDocument();
      },
      { timeout: 10_000 }
    );
    expect(documentSelector()).toHaveTextContent(/doc-a\.txt — Requiere revisión/);
  });

  it("discards a read outcome whose job was cleared while the read was in flight (SD-11)", async () => {
    render(<App />);
    let resolveText!: (value: string) => void;
    const deferred = new Promise<string>((resolve) => {
      resolveText = resolve;
    });
    const slowFile = { name: "doc-a.txt", text: () => deferred } as unknown as File;
    selectFiles([slowFile, new File([BATCH_NOTE_B], "doc-b.txt")]);
    fireEvent.click(screen.getByRole("button", { name: "Create job" }));
    await waitFor(() => expect(screen.getByText("Document batch")).toBeInTheDocument());

    // Clear the session mid-read: the job is gone before the read resolves.
    fireEvent.click(screen.getByRole("button", { name: "Clear session" }));
    expect(screen.getByText("No job yet")).toBeInTheDocument();

    await act(async () => {
      resolveText(BATCH_NOTE_A);
    });
    await waitFor(() => expect(screen.queryByText(/reading documents/i)).not.toBeInTheDocument());
    expect(screen.getByText("No job yet")).toBeInTheDocument();
    expect(screen.queryByText("Document batch")).not.toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("never renders Premium framing anywhere in the V4 batch flow (UX-004)", async () => {
    render(<App />);
    await createBatchAndSettle([
      new File([BATCH_NOTE_A], "doc-a.txt"),
      new File([BATCH_NOTE_B], "doc-b.txt"),
    ]);
    fireEvent.click(stepButton(2, "Configure"));
    // Batch review navigation is synchronous: processing is driven by the
    // reads-settle effect, so there is nothing async to await here.
    fireEvent.click(stepButton(3, "Review"));
    await waitFor(() =>
      expect(screen.getByRole("region", { name: /review workspace/i })).toBeInTheDocument()
    );
    expect(document.body.textContent ?? "").not.toMatch(/premium|activar/i);
  });

  it("keeps the batch read text across a real supported policy change so the items reprocess (T17 #21 WU-C3)", async () => {
    render(<App />);
    await createBatchAndSettle([
      new File([BATCH_NOTE_A], "doc-a.txt"),
      new File([BATCH_NOTE_B], "doc-b.txt"),
    ]);

    // First pass under the default Standard policy: both items process from
    // their held read text and become review-required.
    fireEvent.click(stepButton(2, "Configure"));
    await goToReviewStep();
    await waitFor(() => {
      expect(documentSelector()).toHaveTextContent(/doc-a\.txt — Requiere revisión/);
    });
    expect(documentSelector()).toHaveTextContent(/doc-b\.txt — Requiere revisión/);

    // Remedy loop: a REAL supported policy change (standard → strict) resets the
    // processing-derived item state. The read text is policy-INDEPENDENT, so the
    // items return to queued WITH their held text.
    fireEvent.click(stepButton(2, "Configure"));
    fireEvent.change(screen.getByLabelText("Privacy Policy:"), {
      target: { value: "strict" },
    });

    // Re-entering review reprocesses both items successfully from the SAME held
    // read text instead of dead-ending on a missing source.
    await goToReviewStep();
    await waitFor(() => {
      expect(documentSelector()).toHaveTextContent(/doc-a\.txt — Requiere revisión/);
    });
    expect(documentSelector()).toHaveTextContent(/doc-b\.txt — Requiere revisión/);
    expect(documentSelector()).not.toHaveTextContent(/doc-a\.txt — Error/);
    expect(screen.getByRole("region", { name: /review workspace/i })).toBeInTheDocument();
  });

  it("keeps a non-active document's restored-original warning visible at the Privacy Gate (T17 #21 CORR-B)", async () => {
    render(<App />);
    await createBatchAndSettle([
      new File([BATCH_NOTE_A], "doc-a.txt"),
      new File([BATCH_NOTE_B], "doc-b.txt"),
    ]);
    fireEvent.click(stepButton(2, "Configure"));
    // Batch review navigation is synchronous: processing is driven by the
    // reads-settle effect, so there is nothing async to await here.
    fireEvent.click(stepButton(3, "Review"));
    await waitFor(() =>
      expect(screen.getByRole("region", { name: /review workspace/i })).toBeInTheDocument()
    );

    // Complete doc A with restored ("Keep original") decisions.
    completeActiveDocument();
    await waitFor(() => expect(documentSelector()).toHaveTextContent(/doc-a\.txt — Completado/));
    expect(documentSelector()).toHaveTextContent(/doc-b\.txt — Requiere revisión/);

    // Switch the ACTIVE document to B; doc A's restored decisions still exist.
    fireEvent.click(within(documentSelector()).getByRole("button", { name: /doc-b\.txt/ }));

    fireEvent.click(stepButton(4, "Privacy Gate"));
    const warnings = screen.getByRole("list", { name: /kept-original warnings/i });
    expect(warnings).toHaveTextContent("kept-original");
    expect(warnings).toHaveTextContent(
      "the original text was deliberately kept by reviewer decision (restored)"
    );
    // B (the active document) is still pending; the warning came from A.
    expect(screen.getByRole("alert")).toHaveTextContent(/mandatory review decision/i);
  });

  it("keeps a completed error-free batch's output surfaces unavailable at gate and export (T17 #21 CORR-B)", async () => {
    render(<App />);
    await createBatchAndSettle([
      new File([BATCH_NOTE_A], "doc-a.txt"),
      new File([BATCH_NOTE_B], "doc-b.txt"),
    ]);
    fireEvent.click(stepButton(2, "Configure"));
    // Batch review navigation is synchronous: processing is driven by the
    // reads-settle effect, so there is nothing async to await here.
    fireEvent.click(stepButton(3, "Review"));
    await waitFor(() =>
      expect(screen.getByRole("region", { name: /review workspace/i })).toBeInTheDocument()
    );

    // Complete BOTH documents → batch review complete, zero error items.
    completeActiveDocument();
    await waitFor(() => expect(documentSelector()).toHaveTextContent(/doc-a\.txt — Completado/));
    fireEvent.click(within(documentSelector()).getByRole("button", { name: /doc-b\.txt/ }));
    completeActiveDocument();
    await waitFor(() => expect(documentSelector()).toHaveTextContent(/doc-b\.txt — Completado/));

    // Privacy Gate: review is complete, yet both batch outputs are unavailable.
    fireEvent.click(stepButton(4, "Privacy Gate"));
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(screen.getByText("Not ready")).toBeInTheDocument();
    expect(screen.getByText("Not available")).toBeInTheDocument();
    expect(
      screen.getByText(/Safe Output is not available for a document batch yet/)
    ).toBeInTheDocument();

    // Export reports the SAME fact: both actions disabled with explicit reasons.
    fireEvent.click(stepButton(5, "Export"));
    expect(screen.getByRole("button", { name: "Download Safe Output (.txt)" })).toBeDisabled();
    expect(
      screen.getByRole("button", { name: "Download Confidential Audit (.txt)" })
    ).toBeDisabled();
  });
});

describe("App structured Configure workspace (T20 #24)", () => {
  const CSV = [
    "NHC,Fecha_Nac,Diagnostico,CampoLibre",
    "00123,1990-05-01,Gripe A,rotación de sala",
    "00456,1985-11-23,Fractura,seguimiento",
  ].join("\n");

  function createStructuredJob(csv: string) {
    render(<App />);
    const csvFile = new File([csv], "labs.csv", { type: "text/csv" });
    fireEvent.change(screen.getByLabelText(/select files/i), { target: { files: [csvFile] } });
    fireEvent.click(screen.getByRole("button", { name: "Create job" }));
    fireEvent.click(stepButton(2, "Configure"));
  }

  it("shows the five-class classification, unknown review and the single patient-ID authority", async () => {
    createStructuredJob(CSV);
    await screen.findByRole("list", { name: /column classification list/i });
    expect(screen.getByLabelText("Reviewer classification for NHC")).toHaveValue("identifier");
    expect(screen.getByLabelText("Reviewer classification for Fecha_Nac")).toHaveValue(
      "quasi-identifier"
    );
    expect(screen.getByLabelText("Reviewer classification for Diagnostico")).toHaveValue(
      "sensitive"
    );
    expect(screen.getByLabelText("Reviewer classification for CampoLibre")).toHaveValue("unknown");
    expect(screen.getAllByRole("region", { name: /patient id authority/i })).toHaveLength(1);
    expect(
      screen.getByRole("status", { name: /structured configuration facts/i })
    ).toHaveTextContent("Structured export ready: No");
  });

  it("resolves the unknown review gate only through an explicit override and an explicit date role", async () => {
    createStructuredJob(CSV);
    await screen.findByRole("list", { name: /column classification list/i });
    // Unknown is not KEEP and keeps the gate closed until the human decides.
    expect(
      screen.getByRole("status", { name: /structured configuration facts/i })
    ).toHaveTextContent("Structured export ready: No");
    fireEvent.change(screen.getByLabelText("Reviewer classification for CampoLibre"), {
      target: { value: "insensitive" },
    });
    // Resolving unknown alone is NOT enough: the date column still has no
    // accepted disposition until a human assigns it an explicit date role.
    expect(
      screen.getByRole("status", { name: /structured configuration facts/i })
    ).toHaveTextContent("Structured export ready: No");
    fireEvent.change(screen.getByLabelText("Date role for Fecha_Nac"), {
      target: { value: "birth" },
    });
    expect(
      screen.getByRole("status", { name: /structured configuration facts/i })
    ).toHaveTextContent("Structured export ready: Yes");
  });

  it("exposes the exact structured gate facts at the Privacy Gate", async () => {
    createStructuredJob(CSV);
    await screen.findByRole("list", { name: /column classification list/i });
    fireEvent.change(screen.getByLabelText("Reviewer classification for CampoLibre"), {
      target: { value: "insensitive" },
    });
    fireEvent.change(screen.getByLabelText("Date role for Fecha_Nac"), {
      target: { value: "birth" },
    });
    // The structured job reaches the gate with no review session (it is not a
    // ReviewSession job); the gate derives its facts from the configuration.
    fireEvent.click(stepButton(3, "Review"));
    fireEvent.click(stepButton(4, "Privacy Gate"));
    const facts = screen.getByRole("status", { name: /structured export facts/i });
    expect(facts).toHaveTextContent("Columns: 4");
    expect(facts).toHaveTextContent("Columns requiring review: 0");
    expect(facts).toHaveTextContent("Unsupported columns: 0");
    expect(screen.getByRole("list", { name: /structured column dispositions/i })).toHaveTextContent(
      "NHC: remove"
    );
    expect(screen.getByRole("list", { name: /structured column dispositions/i })).toHaveTextContent(
      "Fecha_Nac: date-age (birth)"
    );
  });

  it("refuses a multi-file structured selection fail-closed", async () => {
    render(<App />);
    const first = new File(["a,b\n1,2"], "one.csv", { type: "text/csv" });
    const second = new File(["c,d\n3,4"], "two.csv", { type: "text/csv" });
    fireEvent.change(screen.getByLabelText(/select files/i), {
      target: { files: [first, second] },
    });
    fireEvent.click(screen.getByRole("button", { name: "Create job" }));
    expect(await screen.findByRole("alert")).toHaveTextContent(/one table at a time/i);
    expect(screen.getByText("No job yet")).toBeInTheDocument();
  });

  it("keeps structured classification and date-role state when navigating away and back", async () => {
    createStructuredJob(CSV);
    await screen.findByRole("list", { name: /column classification list/i });
    fireEvent.change(screen.getByLabelText("Reviewer classification for CampoLibre"), {
      target: { value: "sensitive" },
    });
    fireEvent.change(screen.getByLabelText("Date role for Fecha_Nac"), {
      target: { value: "visit" },
    });
    fireEvent.click(stepButton(1, "Input"));
    fireEvent.click(stepButton(2, "Configure"));
    expect(screen.getByLabelText("Reviewer classification for CampoLibre")).toHaveValue(
      "sensitive"
    );
    expect(screen.getByLabelText("Date role for Fecha_Nac")).toHaveValue("visit");
    expect(
      screen.getByRole("status", { name: /structured configuration facts/i })
    ).toHaveTextContent("Structured export ready: Yes");
  });
});
