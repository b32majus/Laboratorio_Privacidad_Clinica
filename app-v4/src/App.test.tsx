import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import "@testing-library/jest-dom/vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { App } from "./App";
import type { PdfJsLib } from "./input/pdfjs-loader";

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
