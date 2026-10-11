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
const LOCAL_ONLY_FACT = /el procesamiento se ejecuta localmente en su navegador/i;
const FORBIDDEN_CLAIM =
  /anonymous|anonymi[sz]ed|GDPR|LOPDGDD|certified|complian(t|ce)|k-anonymity|differential privacy/i;

afterEach(cleanup);

function createTextJob() {
  fireEvent.change(screen.getByLabelText("Pegar texto"), { target: { value: SYNTHETIC_NOTE } });
  fireEvent.click(screen.getByRole("button", { name: "Crear trabajo" }));
}

function selectFiles(files: File[]) {
  fireEvent.change(screen.getByLabelText(/seleccionar archivos/i), { target: { files } });
}

/** Wait until the single/batch review workspace is actually installed. */
async function waitForReviewWorkspace(timeout = 10_000) {
  await screen.findByRole("region", { name: /review workspace/i }, { timeout });
}

function policySelect(): HTMLSelectElement {
  return screen.getByLabelText("Política de privacidad:") as HTMLSelectElement;
}

function guidanceRegion(): HTMLElement {
  return screen.getByRole("region", { name: "Política de privacidad" });
}

/**
 * CORA-84-01: the detailed four-policy guidance is on demand behind the
 * disclosure. Idempotently expand it (the toggle's accessible name is stable
 * across states) before reading the per-policy cards.
 */
function expandGuidanceDetails() {
  const toggle = screen.getByRole("button", { name: "Guía detallada de políticas" });
  if (toggle.getAttribute("aria-expanded") === "false") fireEvent.click(toggle);
}

function guidanceItems(): HTMLElement[] {
  expandGuidanceDetails();
  return within(screen.getByRole("list", { name: "Guía de políticas de privacidad" })).getAllByRole(
    "listitem"
  );
}

describe("Policy guidance before a job exists (POLICY-01 #56)", () => {
  it("shows all four guidance entries with an honest note instead of a job-kind availability", () => {
    render(<App />);
    // CORA-84-01: the detailed four-policy cards are on demand, collapsed by
    // default below the operational workspace; the honest no-availability
    // note stays permanently visible while collapsed.
    expect(
      screen.queryByRole("list", { name: "Guía de políticas de privacidad" })
    ).not.toBeInTheDocument();
    expect(guidanceRegion()).toHaveTextContent(
      /create a job to see which policies are available for its type/i
    );
    expect(guidanceItems()).toHaveLength(4);
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

    expect(guidanceRegion()).toHaveTextContent("Política actual: Standard");
  });

  it("selects newly enabled policies through the text-job UI (REC-02)", () => {
    render(<App />);
    createTextJob();
    const select = policySelect();

    fireEvent.change(select, { target: { value: "external-ai" } });
    expect(select.value).toBe("external-ai");
    expect(guidanceRegion()).toHaveTextContent("Política actual: External AI");

    fireEvent.change(select, { target: { value: "longitudinal-research" } });
    expect(select.value).toBe("longitudinal-research");
    expect(guidanceRegion()).toHaveTextContent("Política actual: Longitudinal Research");
  });

  it("applies the same availability to a document job", async () => {
    render(<App />);
    selectFiles([new File([SYNTHETIC_NOTE], "nota.txt")]);
    fireEvent.click(screen.getByRole("button", { name: "Crear trabajo" }));
    // Issue #84 correction: the internal kind is not header chrome, so the
    // created-job witness is the real Review landing itself.
    await waitForReviewWorkspace();

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
    fireEvent.click(screen.getByRole("button", { name: "Crear trabajo" }));
    // Quiet shell (#84): the batch queue lands directly on Review; the review
    // workspace is installed exactly when the read phase settles, so no async
    // intake outlives the test.
    await waitForReviewWorkspace();

    for (const name of POLICY_NAMES) {
      expect(screen.getByRole("option", { name })).toBeEnabled();
    }
    for (const item of guidanceItems()) {
      expect(item).toHaveTextContent("Available");
    }
  });
});

/**
 * REC-02 product evidence: selecting the newly enabled policies is not enough —
 * the job must actually process under the selected policy and produce the
 * policy-correct result. These drive the real App → useJobSession →
 * RegistryEngine path (jsdom uses the in-process engine seam) and read the
 * proposal the review workspace shows. All fixtures are synthetic.
 */
const POLICY_DATE_NOTE = "Paciente: Carmen Sánchez. Analítica del 05/01/2024.";
const POLICY_DATE_SOURCE = "05/01/2024";

/** The proposed replacement of the selected Entity Inspector detection. */
function proposedReplacement(): string {
  const inspector = screen.getByRole("complementary", { name: "Entity inspector" });
  const term = within(inspector).getByText("Proposed replacement");
  return term.parentElement?.querySelector("dd")?.textContent?.trim() ?? "";
}

async function runTextJobWithPolicy(policyId: "external-ai" | "longitudinal-research") {
  render(<App />);
  fireEvent.change(screen.getByLabelText("Pegar texto"), { target: { value: POLICY_DATE_NOTE } });
  fireEvent.click(screen.getByRole("button", { name: "Crear trabajo" }));
  fireEvent.change(policySelect(), { target: { value: policyId } });
  expect(policySelect().value).toBe(policyId);
  // Quiet shell (issue #84): the real policy change invalidated the landing
  // attempt, so the shell offers the explicit review restart.
  fireEvent.click(await screen.findByRole("button", { name: "Iniciar revisión" }));
  await waitFor(
    () => expect(screen.getByRole("list", { name: "Detections" })).toBeInTheDocument(),
    { timeout: 10_000 }
  );
  const fecha = within(screen.getByRole("list", { name: "Detections" })).getByRole("button", {
    name: /FECHA/,
  });
  fireEvent.click(fecha);
}

describe("Policy guidance selected-and-processed evidence (REC-02)", () => {
  it("selects External AI and processes a text job with reduced date precision", async () => {
    await runTextJobWithPolicy("external-ai");
    expect(proposedReplacement()).toBe("01/2024");
    expect(proposedReplacement()).not.toMatch(/^Visita/);
  });

  it("selects Longitudinal Research and processes a text job with a shifted, interval-preserving date", async () => {
    await runTextJobWithPolicy("longitudinal-research");
    const proposed = proposedReplacement();
    expect(proposed).toMatch(/^\d{2}\/\d{2}\/\d{4}$/);
    expect(proposed).not.toBe(POLICY_DATE_SOURCE);
    expect(proposed).not.toMatch(/^Visita/);
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
    fireEvent.click(screen.getByRole("button", { name: "Crear trabajo" }));
    // Issue #84 correction: the internal kind is not header chrome; the job
    // NAME is the persistent header fact.
    await waitFor(() => expect(screen.getByText("labs.csv")).toBeInTheDocument());

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
    expect(standard).not.toHaveTextContent(
      "Requiere una columna explícita de identificador de paciente."
    );
    expect(strict).not.toHaveTextContent(
      "Requiere una columna explícita de identificador de paciente."
    );

    // External AI / Longitudinal Research: per-patient shift + age bands, and
    // therefore an explicit patient-ID column requirement.
    expect(externalAi).toHaveTextContent(/per-patient offset/i);
    expect(externalAi).toHaveTextContent(/age bands at the event/i);
    expect(externalAi).toHaveTextContent(
      "Requiere una columna explícita de identificador de paciente."
    );
    expect(longitudinal).toHaveTextContent(/per-patient visit-date shift/i);
    expect(longitudinal).toHaveTextContent(/age-band birth dates/i);
    expect(longitudinal).toHaveTextContent(
      "Requiere una columna explícita de identificador de paciente."
    );

    expect(guidanceRegion()).toHaveTextContent("Política actual: Standard");
  });
});

describe("Policy guidance accessibility (POLICY-01 #56)", () => {
  it("offers the detailed four-policy guidance on demand behind a keyboard-operable disclosure (CORA-84-01)", () => {
    render(<App />);
    createTextJob();

    // Collapsed by default: no full policy cards permanently below the
    // operational workspace (HPD-03; issue #84 acceptance E).
    const list = () => screen.queryByRole("list", { name: "Guía de políticas de privacidad" });
    expect(list()).not.toBeInTheDocument();
    // The current-policy information stays permanently visible while collapsed.
    expect(guidanceRegion()).toHaveTextContent("Política actual: Standard");

    const toggle = screen.getByRole("button", { name: "Guía detallada de políticas" });
    expect(toggle).toHaveAttribute("aria-expanded", "false");
    // A real button: keyboard operable by construction. Expanding exposes
    // every POLICY-01 entry derived from the same `buildPolicyGuidance` seam.
    fireEvent.click(toggle);
    expect(toggle).toHaveAttribute("aria-expanded", "true");
    expect(guidanceItems()).toHaveLength(4);

    // Collapsing again removes the detailed cards from the persistent shell
    // while the current-policy line survives.
    fireEvent.click(screen.getByRole("button", { name: "Guía detallada de políticas" }));
    expect(list()).not.toBeInTheDocument();
    expect(guidanceRegion()).toHaveTextContent("Política actual: Standard");
  });

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
    expandGuidanceDetails();
    const list = screen.getByRole("list", { name: "Guía de políticas de privacidad" });
    expect(list).toHaveClass("sm:grid-cols-2");
  });
});

describe("Policy guidance copy guardrails (POLICY-01 #56)", () => {
  it("never states anonymity/certification/compliance claims on a text job and keeps the local-only fact", () => {
    render(<App />);
    createTextJob();
    // The guardrail covers the whole guidance workspace: the on-demand cards
    // are expanded so the claim ban keeps its full strength (CORA-84-01).
    expandGuidanceDetails();
    expect(guidanceRegion().textContent ?? "").not.toMatch(FORBIDDEN_CLAIM);
    expect(screen.getByText(LOCAL_ONLY_FACT)).toBeInTheDocument();
  });

  it("never states anonymity/certification/compliance claims on a structured job and keeps the local-only fact", async () => {
    render(<App />);
    const csv = ["NHC,Fecha_Nac,Diagnostico", "00123,1990-05-01,Gripe A"].join("\n");
    selectFiles([new File([csv], "labs.csv", { type: "text/csv" })]);
    fireEvent.click(screen.getByRole("button", { name: "Crear trabajo" }));
    // Issue #84 correction: the internal kind is not header chrome; the job
    // NAME is the persistent header fact.
    await waitFor(() => expect(screen.getByText("labs.csv")).toBeInTheDocument());

    // Expanded so the claim ban covers the on-demand cards too (CORA-84-01).
    expandGuidanceDetails();
    expect(guidanceRegion().textContent ?? "").not.toMatch(FORBIDDEN_CLAIM);
    expect(screen.getByText(LOCAL_ONLY_FACT)).toBeInTheDocument();
  });
});
