import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import "@testing-library/jest-dom/vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { App } from "./App";
import type { PdfJsLib } from "./input/pdfjs-loader";
import {
  applyDecision,
  createSessionFromEngineText,
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
  it("renders the application heading", () => {
    render(<App />);
    const heading = screen.getByRole("heading", {
      level: 1,
      name: "Laboratorio de Privacidad Clínica",
    });
    expect(heading).toBeInTheDocument();
  });

  it("starts on the Input step with later steps locked", () => {
    render(<App />);
    expect(stepButton(1, "Input")).toHaveAttribute("aria-current", "step");
    expect(stepButton(2, "Configure")).toBeDisabled();
    expect(stepButton(3, "Review")).toBeDisabled();
    expect(stepButton(4, "Privacy Gate")).toBeDisabled();
    expect(stepButton(5, "Export")).toBeDisabled();
  });

  it("keeps the export step locked with an explicit fail-closed explanation", () => {
    render(<App />);
    const exportButton = stepButton(5, "Export");
    expect(exportButton).toBeDisabled();
    expect(exportButton).toHaveAttribute(
      "title",
      "Export is blocked while mandatory review is incomplete."
    );
  });

  it("shows the persistent top-bar facts: job, type, policy, local-only processing", () => {
    render(<App />);
    expect(screen.getByText("No job yet")).toBeInTheDocument();
    expect(screen.getByText(LOCAL_ONLY_FACT)).toBeInTheDocument();
    expect(screen.getByLabelText("Privacy Policy:")).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "Standard" }) as HTMLOptionElement).toHaveProperty(
      "selected",
      true
    );
  });

  it("creates a text job and shows its name and type in the top bar", () => {
    render(<App />);
    createTextJob();
    expect(screen.getByText("Pasted text")).toBeInTheDocument();
    expect(screen.getByText("Text job")).toBeInTheDocument();
    expect(stepButton(1, "Input")).toHaveAttribute("aria-current", "step");
    expect(stepButton(2, "Configure")).toBeEnabled();
    // Draft intake is cleared after the job is created.
    expect(screen.getByLabelText("Paste text")).toHaveValue("");
  });

  it("creates a structured job from CSV file metadata", () => {
    render(<App />);
    const csvFile = new File(["col1,col2"], "labs.csv", { type: "text/csv" });
    fireEvent.change(screen.getByLabelText(/select files/i), {
      target: { files: [csvFile] },
    });
    expect(screen.getByText("labs.csv")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Create job" }));
    expect(screen.getByText("labs.csv")).toBeInTheDocument();
    expect(screen.getByText("Structured job")).toBeInTheDocument();
  });

  it("surfaces the typed domain error instead of guessing a job kind", () => {
    render(<App />);
    fireEvent.click(screen.getByRole("button", { name: "Create job" }));
    expect(screen.getByRole("alert")).toHaveTextContent(
      /pasted text is empty; provide text before creating a job/i
    );
    expect(screen.getByText("No job yet")).toBeInTheDocument();
  });

  it("clear session discards all in-memory job state and returns to fresh Input", () => {
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

  it("New Job returns to a fresh Input state", () => {
    render(<App />);
    createTextJob();
    fireEvent.click(stepButton(2, "Configure"));
    expect(screen.getByRole("heading", { level: 2, name: "Configure" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "New Job" }));
    expect(screen.getByText("No job yet")).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 2, name: "Input" })).toBeInTheDocument();
    expect(stepButton(2, "Configure")).toBeDisabled();
  });

  it("navigates forward and backward through the canonical steps without URL changes", () => {
    render(<App />);
    const urlBefore = window.location.href;

    createTextJob();
    fireEvent.click(stepButton(2, "Configure"));
    expect(screen.getByRole("heading", { level: 2, name: "Configure" })).toBeInTheDocument();
    expect(stepButton(2, "Configure")).toHaveAttribute("aria-current", "step");
    expect(stepButton(1, "Input")).toBeEnabled();

    fireEvent.click(stepButton(3, "Review"));
    expect(screen.getByRole("heading", { level: 2, name: "Review" })).toBeInTheDocument();

    fireEvent.click(stepButton(1, "Input"));
    expect(screen.getByRole("heading", { level: 2, name: "Input" })).toBeInTheDocument();
    expect(stepButton(1, "Input")).toHaveAttribute("aria-current", "step");

    expect(window.location.href).toBe(urlBefore);
    expect(window.location.search).toBe("");
    expect(window.location.hash).toBe("");
  });

  it("never places job content in the URL across job creation and navigation", () => {
    render(<App />);
    const urlBefore = window.location.href;

    createTextJob();
    fireEvent.click(stepButton(2, "Configure"));
    fireEvent.click(stepButton(3, "Review"));
    fireEvent.click(stepButton(2, "Configure"));
    fireEvent.click(screen.getByRole("button", { name: "New Job" }));
    createTextJob();

    expect(window.location.href).toBe(urlBefore);
    expect(window.location.search).toBe("");
    expect(window.location.hash).toBe("");
  });

  it("renders honest placeholders for later-ticket steps", () => {
    render(<App />);
    createTextJob();
    fireEvent.click(stepButton(2, "Configure"));
    expect(screen.getByText(/this step is not implemented yet/i)).toBeInTheDocument();
  });

  it("keeps step navigation keyboard operable with visible focus targets", () => {
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

describe("App review workspace (T07)", () => {
  const REVIEW_NOTE =
    "Nombre: Carmen Sánchez\nLa paciente fue atendida por el Dr. García López el 12/03/2024. Contacto: 612345678.";

  function createReviewJob() {
    fireEvent.change(screen.getByLabelText("Paste text"), { target: { value: REVIEW_NOTE } });
    fireEvent.click(screen.getByRole("button", { name: "Create job" }));
    fireEvent.click(stepButton(2, "Configure"));
    fireEvent.click(stepButton(3, "Review"));
  }

  it("runs the engine once at the Configure→Review transition and renders the workspace", () => {
    render(<App />);
    createReviewJob();
    expect(screen.getByRole("region", { name: /review workspace/i })).toBeInTheDocument();
    const progress = screen.getByRole("status", { name: /review progress/i });
    expect(progress).toHaveTextContent(/Pending: [1-9]/);
    expect(screen.getByRole("group", { name: /document text with detections/i })).toHaveTextContent(
      "Carmen Sánchez"
    );
  });

  it("navigating away and back preserves review decisions and never re-runs the engine", () => {
    render(<App />);
    createReviewJob();
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
    fireEvent.click(stepButton(3, "Review"));
    const progress = screen.getByRole("status", { name: /review progress/i });
    expect(progress).toHaveTextContent("Accepted: 1");
    expect(progress).not.toHaveTextContent(`Pending: ${pendingBefore}`);
  });

  it("keeps an honest placeholder for job families without single-document review", () => {
    render(<App />);
    const csvFile = new File(["col1,col2"], "labs.csv", { type: "text/csv" });
    fireEvent.change(screen.getByLabelText(/select files/i), {
      target: { files: [csvFile] },
    });
    fireEvent.click(screen.getByRole("button", { name: "Create job" }));
    fireEvent.click(stepButton(2, "Configure"));
    fireEvent.click(stepButton(3, "Review"));
    expect(screen.getByText(/this step is not implemented yet/i)).toBeInTheDocument();
    expect(screen.queryByRole("region", { name: /review workspace/i })).not.toBeInTheDocument();
  });

  it("keeps export fail-closed while mandatory review decisions are pending", () => {
    render(<App />);
    createReviewJob();
    expect(stepButton(5, "Export")).toBeDisabled();
  });
});

describe("App privacy gate (T08 U3)", () => {
  const REVIEW_NOTE =
    "Nombre: Carmen Sánchez\nLa paciente fue atendida por el Dr. García López el 12/03/2024. Contacto: 612345678.";

  function createReviewJob() {
    fireEvent.change(screen.getByLabelText("Paste text"), { target: { value: REVIEW_NOTE } });
    fireEvent.click(screen.getByRole("button", { name: "Create job" }));
    fireEvent.click(stepButton(2, "Configure"));
    fireEvent.click(stepButton(3, "Review"));
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

  it("renders the gate with safeOutputReady true after every decision is resolved", () => {
    render(<App />);
    createReviewJob();
    acceptAllDetections();
    expect(pendingCount()).toBe(0);

    fireEvent.click(stepButton(4, "Privacy Gate"));
    expect(screen.getByRole("heading", { level: 2, name: "Privacy Gate" })).toBeInTheDocument();

    // Output availability is real derived state, written by the state bridge.
    expect(screen.getByText("Safe output:")).toBeInTheDocument();
    expect(screen.getByText("Ready")).toBeInTheDocument();
    expect(screen.getByText("Confidential audit:")).toBeInTheDocument();
    expect(screen.getByText("Available")).toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();

    // The export gate agrees with review completeness (D-004).
    expect(stepButton(5, "Export")).toBeEnabled();
  });

  it("stays fail-closed: the gate shows the pending state while a decision is pending", () => {
    render(<App />);
    createReviewJob();
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
});

describe("App policy change vs an existing review (PR #40 corrective C1+C2)", () => {
  const REVIEW_NOTE =
    "Nombre: Carmen Sánchez\nLa paciente fue atendida por el Dr. García López el 12/03/2024. Contacto: 612345678.";

  function createReviewJob() {
    fireEvent.change(screen.getByLabelText("Paste text"), { target: { value: REVIEW_NOTE } });
    fireEvent.click(screen.getByRole("button", { name: "Create job" }));
    fireEvent.click(stepButton(2, "Configure"));
    fireEvent.click(stepButton(3, "Review"));
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

  it("a completed review cannot be relabelled: a real policy change blocks the gates again and the review restarts under the new policy", () => {
    render(<App />);
    createReviewJob();
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
    fireEvent.click(stepButton(3, "Review"));
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

  it("an unchanged policy selection is an exact no-op: the completed review survives", () => {
    render(<App />);
    createReviewJob();
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

  it("starting review under a known-but-unmapped policy fails closed with the typed PolicyError (C1)", () => {
    render(<App />);
    createTextJob();
    fireEvent.change(screen.getByLabelText("Privacy Policy:"), {
      target: { value: "external-ai" },
    });
    fireEvent.click(stepButton(2, "Configure"));
    fireEvent.click(stepButton(3, "Review"));

    // The typed PolicyError message is surfaced, not swallowed into the
    // generic fallback message.
    const alert = screen.getByRole("alert");
    expect(alert).toHaveTextContent(/no accepted per-category operator mapping/i);
    expect(alert).toHaveTextContent("external-ai");
    expect(alert).not.toHaveTextContent(/not available right now/i);
    // No stale session was installed.
    expect(screen.queryByRole("region", { name: /review workspace/i })).not.toBeInTheDocument();
  });
});

describe("App document intake (T06)", () => {
  afterEach(() => {
    delete window.pdfjsLib;
    delete (globalThis as { pdfjsWorker?: unknown }).pdfjsWorker;
  });

  it("never advertises legacy .doc in the file input accept attribute", () => {
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
    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent(/no extractable text|no text layer/i);
    expect(screen.getByText("No job yet")).toBeInTheDocument();
  });

  it("creates a document job from the text-bearing PDF fixture", async () => {
    await seedRealPdfJs();
    render(<App />);
    selectFiles([fixtureFile("sample-clinical-note.pdf")]);
    fireEvent.click(screen.getByRole("button", { name: "Create job" }));
    await waitFor(() => {
      expect(screen.getByText("Document job")).toBeInTheDocument();
    });
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

  const SAFE_BUTTON = "Download Safe Output (.txt)";
  const AUDIT_BUTTON = "Download Confidential Audit (.txt)";

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
  function completeReviewToExport(note: string) {
    fireEvent.change(screen.getByLabelText("Paste text"), { target: { value: note } });
    fireEvent.click(screen.getByRole("button", { name: "Create job" }));
    fireEvent.click(stepButton(2, "Configure"));
    fireEvent.click(stepButton(3, "Review"));
    acceptAllDetections();
    fireEvent.click(stepButton(4, "Privacy Gate"));
    fireEvent.click(stepButton(5, "Export"));
    expect(screen.getByRole("heading", { level: 2, name: "Export" })).toBeInTheDocument();
  }

  /** Pure-domain replica: the same engine, text and decisions as the App flow. */
  function replicaSession(note: string): ReviewSession {
    const session = createSessionFromEngineText(note, "standard");
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

  it("renders two separate download actions with the confidential warning on Export", () => {
    render(<App />);
    completeReviewToExport(JOB1_NOTE);

    const safeButton = screen.getByRole("button", { name: SAFE_BUTTON });
    const auditButton = screen.getByRole("button", { name: AUDIT_BUTTON });
    expect(safeButton).toBeEnabled();
    expect(auditButton).toBeEnabled();
    expect(screen.getByText(CONFIDENTIAL_AUDIT_WARNING_LINE)).toBeInTheDocument();
    expect(screen.getByText(/must never be shared/i)).toBeInTheDocument();
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
      completeReviewToExport(JOB1_NOTE);
      fireEvent.click(screen.getByRole("button", { name: AUDIT_BUTTON }));
      const audit1 = await textOf(captured.downloads[0]);
      expect(captured.downloads[0].fileName).toBe("confidential-audit.txt");
      expect(audit1.startsWith(CONFIDENTIAL_AUDIT_WARNING_LINE)).toBe(true);
      expect(audit1).toContain("Carmen Sánchez");
      expect(audit1).toContain("612345678");

      // Clear session and run a second, different job end-to-end.
      fireEvent.click(screen.getByRole("button", { name: "Clear session" }));
      expect(screen.getByText("No job yet")).toBeInTheDocument();
      completeReviewToExport(JOB2_NOTE);
      fireEvent.click(screen.getByRole("button", { name: AUDIT_BUTTON }));
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
      const replica2 = replicaSession(JOB2_NOTE);
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
      completeReviewToExport(JOB1_NOTE);

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
      expect(captured.downloads[1].fileName).toBe("safe-output.txt");
    } finally {
      captured.restore();
    }
  });
});
