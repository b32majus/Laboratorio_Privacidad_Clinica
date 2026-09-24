import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import "@testing-library/jest-dom/vitest";

import { App } from "./App";

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
