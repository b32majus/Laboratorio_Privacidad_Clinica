import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import "@testing-library/jest-dom/vitest";

import { App } from "./App";

/**
 * Job-aware Privacy Policy guidance UI oracles (issue #56, POLICY-01).
 *
 * All content is synthetic. The oracles observe the user-visible contract:
 * availability by job kind, non-selectability of unsupported policies on
 * text/document/batch jobs, full selectability on structured jobs, the exact
 * textual states, the patient-ID requirement and the copy guardrails.
 */
const SYNTHETIC_NOTE = "Synthetic clinical note for deterministic policy guidance tests.";
const POLICY_NAMES = ["Standard", "External AI", "Longitudinal Research", "Strict"] as const;
const LOCAL_ONLY_FACT = /processing runs locally in your browser/i;
const FORBIDDEN_CLAIM =
  /anonymous|anonymi[sz]ed|GDPR|LOPDGDD|certified|complian(t|ce)|k-anonymity|differential privacy/i;

afterEach(cleanup);

function createTextJob() {
  fireEvent.change(screen.getByLabelText("Paste text"), { target: { value: SYNTHETIC_NOTE } });
  fireEvent.click(screen.getByRole("button", { name: "Create job" }));
}

function selectFiles(files: File[]) {
  fireEvent.change(screen.getByLabelText(/select files/i), { target: { files } });
}

function policySelect(): HTMLSelectElement {
  return screen.getByLabelText("Privacy Policy:") as HTMLSelectElement;
}

function guidanceRegion(): HTMLElement {
  return screen.getByRole("region", { name: "Privacy Policy" });
}

function guidanceItems(): HTMLElement[] {
  return within(screen.getByRole("list", { name: "Privacy Policy guidance" })).getAllByRole(
    "listitem"
  );
}

describe("Policy guidance before a job exists (POLICY-01 #56)", () => {
  it("shows all four guidance entries with an honest note instead of a job-kind availability", () => {
    render(<App />);
    expect(guidanceItems()).toHaveLength(4);
    expect(guidanceRegion()).toHaveTextContent(
      /create a job to see which policies are available for its type/i
    );
    // No job kind exists yet, so neither availability state is claimed.
    expect(within(guidanceRegion()).queryByText("Available")).not.toBeInTheDocument();
    expect(
      within(guidanceRegion()).queryByText("Not available for this job type yet")
    ).not.toBeInTheDocument();
  });

  it("shows factual no-job copy with no invented positioning and a job-type qualifier", () => {
    render(<App />);
    const region = guidanceRegion();
    // No unsubstantiated qualitative characterization (the old "Balanced").
    expect(region.textContent ?? "").not.toMatch(/\bbalanced\b/i);
    for (const item of guidanceItems()) {
      expect(item).toHaveTextContent(/job type/i);
    }
  });
});

describe("Policy guidance on text/document/batch jobs (POLICY-01 #56, REC-02)", () => {
  it("makes all four policies selectable and Available on a text job (REC-02)", () => {
    render(<App />);
    createTextJob();

    for (const name of POLICY_NAMES) {
      expect(screen.getByRole("option", { name })).toBeEnabled();
    }

    const [standard, externalAi, longitudinal, strict] = guidanceItems();
    for (const item of [standard, externalAi, longitudinal, strict]) {
      expect(item).toHaveTextContent("Available");
    }
    expect(standard).toHaveTextContent("Standard");
    expect(strict).toHaveTextContent("Strict");
    expect(externalAi).toHaveTextContent("External AI");
    expect(longitudinal).toHaveTextContent("Longitudinal Research");

    expect(guidanceRegion()).toHaveTextContent("Current policy: Standard");
  });

  it("selects newly enabled policies through the text-job UI (REC-02)", () => {
    render(<App />);
    createTextJob();
    const select = policySelect();

    fireEvent.change(select, { target: { value: "external-ai" } });
    expect(select.value).toBe("external-ai");
    expect(guidanceRegion()).toHaveTextContent("Current policy: External AI");

    fireEvent.change(select, { target: { value: "longitudinal-research" } });
    expect(select.value).toBe("longitudinal-research");
    expect(guidanceRegion()).toHaveTextContent("Current policy: Longitudinal Research");
  });

  it("applies the same availability to a document job", async () => {
    render(<App />);
    selectFiles([new File([SYNTHETIC_NOTE], "nota.txt")]);
    fireEvent.click(screen.getByRole("button", { name: "Create job" }));
    await waitFor(() => expect(screen.getByText("Document job")).toBeInTheDocument());

    for (const name of POLICY_NAMES) {
      expect(screen.getByRole("option", { name })).toBeEnabled();
    }
    for (const item of guidanceItems()) {
      expect(item).toHaveTextContent("Available");
    }
  });

  it("applies the same availability to a document-batch job", async () => {
    render(<App />);
    selectFiles([new File([SYNTHETIC_NOTE], "doc-a.txt"), new File([SYNTHETIC_NOTE], "doc-b.txt")]);
    fireEvent.click(screen.getByRole("button", { name: "Create job" }));
    await waitFor(() => expect(screen.getByText("Document batch")).toBeInTheDocument());
    // Wait until the read phase settles so no async intake outlives the test.
    await waitFor(() => expect(screen.getByRole("button", { name: "Create job" })).toBeEnabled(), {
      timeout: 10_000,
    });

    for (const name of POLICY_NAMES) {
      expect(screen.getByRole("option", { name })).toBeEnabled();
    }
    for (const item of guidanceItems()) {
      expect(item).toHaveTextContent("Available");
    }
  });
});

describe("Policy guidance on structured jobs (POLICY-01 #56)", () => {
  const CSV = [
    "NHC,Fecha_Nac,Diagnostico,CampoLibre",
    "00123,1990-05-01,Gripe A,rotación de sala",
    "00456,1985-11-23,Fractura,seguimiento",
  ].join("\n");

  it("makes all four selectable and describes the accepted date/age mapping with the patient-ID requirement", async () => {
    render(<App />);
    selectFiles([new File([CSV], "labs.csv", { type: "text/csv" })]);
    fireEvent.click(screen.getByRole("button", { name: "Create job" }));
    await waitFor(() => expect(screen.getByText("Structured job")).toBeInTheDocument());

    for (const name of ["Standard", "External AI", "Longitudinal Research", "Strict"]) {
      expect(screen.getByRole("option", { name })).toBeEnabled();
    }

    const [standard, externalAi, longitudinal, strict] = guidanceItems();
    for (const item of [standard, externalAi, longitudinal, strict]) {
      expect(item).toHaveTextContent("Available");
    }

    // Standard/Strict: month-level generalization for visit/event and birth dates.
    expect(standard).toHaveTextContent(/month level/i);
    expect(strict).toHaveTextContent(/month level/i);
    expect(standard).not.toHaveTextContent("Requires an explicit patient-ID column.");
    expect(strict).not.toHaveTextContent("Requires an explicit patient-ID column.");

    // External AI / Longitudinal Research: per-patient shift + age bands, and
    // therefore an explicit patient-ID column requirement.
    expect(externalAi).toHaveTextContent(/per-patient offset/i);
    expect(externalAi).toHaveTextContent(/age bands at the event/i);
    expect(externalAi).toHaveTextContent("Requires an explicit patient-ID column.");
    expect(longitudinal).toHaveTextContent(/per-patient visit-date shift/i);
    expect(longitudinal).toHaveTextContent(/age-band birth dates/i);
    expect(longitudinal).toHaveTextContent("Requires an explicit patient-ID column.");

    expect(guidanceRegion()).toHaveTextContent("Current policy: Standard");
  });
});

describe("Policy guidance accessibility (POLICY-01 #56)", () => {
  it("keeps the policy select and the guidance region keyboard-focusable with visible focus", () => {
    render(<App />);
    createTextJob();

    const select = policySelect();
    select.focus();
    expect(select).toHaveFocus();
    expect(select.className).toMatch(/focus-visible:ring-2/);

    const guidance = guidanceRegion();
    guidance.focus();
    expect(guidance).toHaveFocus();
    expect(guidance.className).toMatch(/focus-visible:ring-2/);

    // Availability is conveyed as text, never by color alone.
    expect(guidance).toHaveTextContent("Available");
    for (const item of guidanceItems()) {
      expect(item).toHaveTextContent("Available");
    }
  });
});

describe("Policy guidance responsive layout (POLICY-01 #56)", () => {
  it("renders the guidance list with the responsive grid tokens (stacked on narrow screens)", () => {
    render(<App />);
    const list = screen.getByRole("list", { name: "Privacy Policy guidance" });
    expect(list).toHaveClass("sm:grid-cols-2");
  });
});

describe("Policy guidance copy guardrails (POLICY-01 #56)", () => {
  it("never states anonymity/certification/compliance claims on a text job and keeps the local-only fact", () => {
    render(<App />);
    createTextJob();
    expect(guidanceRegion().textContent ?? "").not.toMatch(FORBIDDEN_CLAIM);
    expect(screen.getByText(LOCAL_ONLY_FACT)).toBeInTheDocument();
  });

  it("never states anonymity/certification/compliance claims on a structured job and keeps the local-only fact", async () => {
    render(<App />);
    const csv = ["NHC,Fecha_Nac,Diagnostico", "00123,1990-05-01,Gripe A"].join("\n");
    selectFiles([new File([csv], "labs.csv", { type: "text/csv" })]);
    fireEvent.click(screen.getByRole("button", { name: "Create job" }));
    await waitFor(() => expect(screen.getByText("Structured job")).toBeInTheDocument());

    expect(guidanceRegion().textContent ?? "").not.toMatch(FORBIDDEN_CLAIM);
    expect(screen.getByText(LOCAL_ONLY_FACT)).toBeInTheDocument();
  });
});
