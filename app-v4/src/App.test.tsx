import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import "@testing-library/jest-dom/vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { App } from "./App";
import type { PdfJsLib } from "./input/pdfjs-loader";

afterEach(cleanup);
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
const LOCAL_ONLY_FACT = /el procesamiento se ejecuta localmente en su navegador/i;

/**
 * Quiet shell (issue #84): the five-step pipeline navigation is gone. Task
 * actions live in the contextual shell action bar and in the workspaces; these
 * helpers read the new accessible names without weakening any assertion.
 */
function taskButton(name: string) {
  return screen.getByRole("button", { name });
}

/** Wait until the single/batch review workspace is actually installed. */
async function waitForReviewWorkspace(timeout = 10_000) {
  await screen.findByRole("region", { name: /review workspace/i }, { timeout });
}

function createTextJob() {
  fireEvent.change(screen.getByLabelText("Pegar texto"), {
    target: { value: SYNTHETIC_NOTE },
  });
  fireEvent.click(screen.getByRole("button", { name: "Crear trabajo" }));
}

/**
 * The Result action is fail-closed: neither direct (D-024) nor via the gate
 * affordance may exist while the export gate is not satisfied.
 */
function expectNoResultAction() {
  expect(screen.queryByRole("button", { name: "Ver resultado" })).not.toBeInTheDocument();
  expect(screen.queryByRole("button", { name: "Ir al resultado" })).not.toBeInTheDocument();
}

// ---------------------------------------------------------------------------
// T06 document-intake paths: committed synthetic fixtures only.
// ---------------------------------------------------------------------------
const FIXTURES_DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), "input", "fixtures");

function fixtureFile(name: string): File {
  return new File([new Uint8Array(readFileSync(path.join(FIXTURES_DIR, name)))], name);
}

function selectFiles(files: File[]) {
  fireEvent.change(screen.getByLabelText(/seleccionar archivos/i), { target: { files } });
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

  it("renders the quiet start surface with no job and no task navigation", () => {
    render(<App />);
    expect(screen.getByText("Aún no hay trabajo")).toBeInTheDocument();
    // No destination exists merely to expose pipeline internals: with no job
    // there is no review/gate/result action anywhere in the shell.
    expectNoResultAction();
    expect(screen.queryByRole("button", { name: "Privacy Gate" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Iniciar revisión" })).not.toBeInTheDocument();
    // The universal five-step pipeline navigation is gone (issue #84).
    expect(screen.queryByRole("navigation", { name: "Job steps" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "1. Input" })).not.toBeInTheDocument();
  });

  it("keeps the Result affordance fail-closed while mandatory review decisions are pending", async () => {
    render(<App />);
    fireEvent.change(screen.getByLabelText("Pegar texto"), {
      target: { value: "Nombre: Carmen Sánchez. Contacto: 612345678." },
    });
    fireEvent.click(screen.getByRole("button", { name: "Crear trabajo" }));
    await waitForReviewWorkspace();
    // Fail-closed: no Result action while review is incomplete...
    expectNoResultAction();
    // ...but the optional Privacy Gate destination stays reachable from
    // Review (G-HP2: the gate is never hidden, deleted or disabled).
    expect(taskButton("Privacy Gate")).toBeEnabled();
  });

  it("shows the persistent top-bar facts: job, policy, local-only processing — never the internal job kind", async () => {
    render(<App />);
    expect(screen.getByText("Aún no hay trabajo")).toBeInTheDocument();
    expect(screen.getByText(LOCAL_ONLY_FACT)).toBeInTheDocument();
    expect(screen.getByLabelText("Política de privacidad:")).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "Standard" }) as HTMLOptionElement).toHaveProperty(
      "selected",
      true
    );
    // Issue #84 correction (spec F): the internal job kind is not permanent
    // chrome — not even as a placeholder while no job exists.
    expect(screen.queryByText("Type:")).not.toBeInTheDocument();
  });

  it("creates a text job, shows its name (not its internal kind) in the top bar, and lands directly on Review", async () => {
    render(<App />);
    createTextJob();
    expect(screen.getByText("Pasted text")).toBeInTheDocument();
    // Issue #84 correction (spec F): the internal job kind is not permanent
    // chrome on any task surface; kind stays contextual (intake confirmation,
    // policy guidance).
    expect(screen.queryByText("Text job")).not.toBeInTheDocument();
    // Quiet shell: a text job reaches its real review work without visiting
    // the no-op Configure stop (issue #84 acceptance B). The draft intake is
    // unmounted on landing; the cleared-draft end state is witnessed by the
    // reset paths (Nuevo trabajo / Borrar sesión) in their dedicated tests.
    await waitForReviewWorkspace();
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
    fireEvent.change(screen.getByLabelText(/seleccionar archivos/i), {
      target: { files: [csvFile] },
    });
    fireEvent.click(screen.getByRole("button", { name: "Crear trabajo" }));
    expect(screen.getByText("labs.csv")).toBeInTheDocument();

    // The structured job lands directly in its real Configure workspace (the
    // parsed canonical configuration arrives asynchronously).
    const list = await screen.findByRole("list", { name: /column classification list/i });
    expect(list).toHaveTextContent("NHC");
    expect(list).toHaveTextContent("CampoLibre");
    const facts = screen.getByRole("status", { name: /structured configuration facts/i });
    expect(facts).toHaveTextContent("Structured export ready: No");
  });

  it("surfaces the typed domain error instead of guessing a job kind", async () => {
    render(<App />);
    fireEvent.click(screen.getByRole("button", { name: "Crear trabajo" }));
    // REC-08 F1: the typed empty-input refusal is PRESENTED in Spanish; the
    // domain still refuses and no job is created.
    expect(screen.getByRole("alert")).toHaveTextContent(/no hay texto/i);
    expect(screen.getByText("Aún no hay trabajo")).toBeInTheDocument();
  });

  it("clear session discards all in-memory job state and returns to fresh Input", async () => {
    render(<App />);
    createTextJob();
    await waitForReviewWorkspace();
    fireEvent.click(screen.getByRole("button", { name: "Borrar sesión" }));
    expect(screen.getByText("Aún no hay trabajo")).toBeInTheDocument();
    expect(screen.getByLabelText("Pegar texto")).toHaveValue("");
    expectNoResultAction();
    expect(screen.queryByRole("button", { name: "Privacy Gate" })).not.toBeInTheDocument();
  });

  it("Nuevo trabajo returns to a fresh Input state", async () => {
    render(<App />);
    createTextJob();
    await waitForReviewWorkspace();
    fireEvent.click(screen.getByRole("button", { name: "Nuevo trabajo" }));
    expect(screen.getByText("Aún no hay trabajo")).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { level: 2, name: "Nuevo trabajo de privacidad" })
    ).toBeInTheDocument();
    expectNoResultAction();
  });

  it("keeps Nuevo trabajo and Borrar sesión with distinct, legible purposes (UX-CLOSEOUT-01 E, CORA-84-03)", async () => {
    render(<App />);
    createTextJob();
    const newJob = screen.getByRole("button", { name: "Nuevo trabajo" });
    const clearSession = screen.getByRole("button", { name: "Borrar sesión" });
    // Both accepted capabilities stay present and operable.
    expect(newJob).toBeEnabled();
    expect(clearSession).toBeEnabled();
    // Distinct explicit copy: the privacy-clearing action is not presented as a
    // duplicate of Nuevo trabajo.
    expect(newJob).toHaveAttribute("title");
    expect(clearSession).toHaveAttribute("title");
    expect(newJob.getAttribute("title")).not.toBe(clearSession.getAttribute("title"));
    expect(clearSession.getAttribute("title")).toMatch(/descarta|en memoria/i);
    const helper = document.getElementById("session-actions-help");
    expect(helper).not.toBeNull();
    expect(helper).toHaveTextContent(/nuevo trabajo inicia un trabajo nuevo/i);
    expect(helper).toHaveTextContent(/borrar sesión descarta de forma deliberada/i);
  });

  it("renders the active workspace before the persistent policy guidance (UX-CLOSEOUT-01 A)", async () => {
    render(<App />);
    createTextJob();
    await waitForReviewWorkspace();
    const main = document.getElementById("main-content");
    const guidance = screen.getByRole("region", { name: "Política de privacidad" });
    expect(main).not.toBeNull();
    // `main` precedes the policy guidance in document order, so the persistent
    // policy guidance (CORA-84-01: current-policy line plus the on-demand
    // detailed cards) never renders ahead of the user's active task.
    expect(
      (main as HTMLElement).compareDocumentPosition(guidance) & Node.DOCUMENT_POSITION_FOLLOWING
    ).toBeGreaterThan(0);
  });

  it("moves between review and the optional gate without URL changes", async () => {
    render(<App />);
    const urlBefore = window.location.href;

    createTextJob();
    await waitForReviewWorkspace();
    expect(screen.getByRole("heading", { level: 2, name: "Revisión" })).toBeInTheDocument();

    fireEvent.click(taskButton("Privacy Gate"));
    expect(screen.getByRole("heading", { level: 2, name: "Privacy Gate" })).toBeInTheDocument();
    fireEvent.click(taskButton("Volver a la revisión"));
    await waitForReviewWorkspace();

    expect(window.location.href).toBe(urlBefore);
    expect(window.location.search).toBe("");
    expect(window.location.hash).toBe("");
  });

  it("never places job content in the URL across job creation and navigation", async () => {
    render(<App />);
    const urlBefore = window.location.href;

    createTextJob();
    await waitForReviewWorkspace();
    fireEvent.click(taskButton("Privacy Gate"));
    fireEvent.click(screen.getByRole("button", { name: "Nuevo trabajo" }));
    createTextJob();
    await waitForReviewWorkspace();

    expect(window.location.href).toBe(urlBefore);
    expect(window.location.search).toBe("");
    expect(window.location.hash).toBe("");
  });

  it("takes a text job straight to Review with no Configure stop (issue #84)", async () => {
    render(<App />);
    createTextJob();
    await waitForReviewWorkspace();
    // The no-op unstructured Configure surface no longer exists as a stop: no
    // Configure heading is rendered on the ordinary text journey.
    expect(screen.queryByRole("heading", { level: 2, name: "Configure" })).not.toBeInTheDocument();
    expect(screen.getByRole("region", { name: /review workspace/i })).toBeInTheDocument();
  });

  it("keeps the shell task actions keyboard operable with real buttons", async () => {
    render(<App />);
    createTextJob();
    await waitForReviewWorkspace();

    // The gate action is a real, enabled, focusable button.
    const gate = taskButton("Privacy Gate");
    expect(gate.tagName).toBe("BUTTON");
    expect(gate).toBeEnabled();
    gate.focus();
    expect(gate).toHaveFocus();

    fireEvent.click(gate);
    expect(screen.getByRole("heading", { level: 2, name: "Privacy Gate" })).toBeInTheDocument();
    // From the gate, the return action is reachable and focusable too.
    const back = taskButton("Volver a la revisión");
    back.focus();
    expect(back).toHaveFocus();
  });
});

// ---------------------------------------------------------------------------
// UX-PILOT-01 (#52): the Input surface is framed as one "Nuevo trabajo de privacidad"
// workspace. These oracles only observe presentation/accessibility; every
// intake semantic stays frozen (the domain tests remain the authority).
// ---------------------------------------------------------------------------
describe("App input workspace (UX-PILOT-01 #52)", () => {
  it("frames the empty Input as a single Nuevo trabajo de privacidad task", () => {
    render(<App />);
    expect(
      screen.getByRole("heading", { level: 2, name: "Nuevo trabajo de privacidad" })
    ).toBeInTheDocument();
    expect(screen.getByText(/el resto del proceso se organiza/i)).toBeInTheDocument();
  });

  it("keeps the ordinary start quiet about internal job routing (REC-08 #80)", () => {
    render(<App />);
    // The permanent JobKind mapping section is removed from the start surface.
    expect(screen.queryByRole("region", { name: "How the job type is chosen" })).toBeNull();
    expect(screen.queryByText("How the job type is chosen")).toBeNull();
    expect(screen.queryByText("Text job")).toBeNull();
    expect(screen.queryByText("Document job")).toBeNull();
    expect(screen.queryByText("Document batch")).toBeNull();
    expect(screen.queryByText("Structured job")).toBeNull();
    // Concise format help remains.
    expect(screen.getByText(/documentos \(txt, pdf, docx\)/i)).toBeInTheDocument();
    expect(screen.getByText(/tablas estructuradas \(csv, xls, xlsx\)/i)).toBeInTheDocument();
  });

  it("summarizes selected files with their intake family", () => {
    render(<App />);
    selectFiles([new File(["nota"], "historia.txt"), new File(["a,b"], "labs.csv")]);
    const files = screen.getByRole("list", { name: "Archivos seleccionados" });
    expect(within(files).getByText("historia.txt")).toBeInTheDocument();
    expect(within(files).getByText("labs.csv")).toBeInTheDocument();
    expect(within(files).getByText("Documento")).toBeInTheDocument();
    expect(within(files).getByText("Estructurado")).toBeInTheDocument();
    expect(screen.getByText("2 archivos seleccionados")).toBeInTheDocument();
  });

  it("exposes labelled, keyboard-focusable paste and file entry surfaces", () => {
    render(<App />);
    expect(
      screen.getByRole("heading", { level: 3, name: "Pegar texto clínico" })
    ).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 3, name: "Elegir archivos" })).toBeInTheDocument();

    const textarea = screen.getByLabelText("Pegar texto");
    textarea.focus();
    expect(textarea).toHaveFocus();

    const fileInput = screen.getByLabelText(/seleccionar archivos/i) as HTMLInputElement;
    fileInput.focus();
    expect(fileInput).toHaveFocus();
    expect(fileInput).toHaveAttribute("accept", ".txt,.pdf,.docx,.csv,.xls,.xlsx");
  });

  it("keeps pasted text and files mutually exclusive with the typed message", () => {
    render(<App />);
    fireEvent.change(screen.getByLabelText("Pegar texto"), { target: { value: "nota" } });
    selectFiles([new File(["nota"], "historia.txt")]);
    fireEvent.click(screen.getByRole("button", { name: "Crear trabajo" }));
    expect(screen.getByRole("alert")).toHaveTextContent(
      "Use una sola entrada por trabajo: texto pegado o archivos, no ambos."
    );
    expect(screen.getByText("Aún no hay trabajo")).toBeInTheDocument();
  });

  it("states the one-input-per-job constraint on the surface before submission", () => {
    render(<App />);
    const helper = screen.getByText(
      /use una sola entrada por trabajo: texto pegado o archivos, no ambos\./i
    );
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
    fireEvent.change(screen.getByLabelText("Pegar texto"), { target: { value: REVIEW_NOTE } });
    fireEvent.click(screen.getByRole("button", { name: "Crear trabajo" }));
    await waitForReviewWorkspace();
  }

  it("runs the engine once at the review landing and renders the workspace", async () => {
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
    fireEvent.click(screen.getByRole("button", { name: "Aceptar detección" }));
    expect(screen.getByRole("status", { name: /review progress/i })).toHaveTextContent(
      "Accepted: 1"
    );

    fireEvent.click(taskButton("Privacy Gate"));
    expect(screen.getByRole("heading", { level: 2, name: "Privacy Gate" })).toBeInTheDocument();
    fireEvent.click(taskButton("Volver a la revisión"));
    await waitForReviewWorkspace();
    const progress = screen.getByRole("status", { name: /review progress/i });
    expect(progress).toHaveTextContent("Accepted: 1");
    expect(progress).not.toHaveTextContent(`Pending: ${pendingBefore}`);
  });

  it("explains that structured review happens in Configure without faking a review workspace", async () => {
    render(<App />);
    const csvFile = new File(["col1,col2"], "labs.csv", { type: "text/csv" });
    fireEvent.change(screen.getByLabelText(/seleccionar archivos/i), {
      target: { files: [csvFile] },
    });
    fireEvent.click(screen.getByRole("button", { name: "Crear trabajo" }));
    await screen.findByRole("list", { name: /column classification list/i });
    fireEvent.click(taskButton("Continuar a la revisión"));
    const region = screen.getByRole("region", { name: "Review" });
    expect(within(region).getByRole("heading", { level: 2, name: "Review" })).toBeInTheDocument();
    expect(region).toHaveTextContent(/structured review happens in configure/i);
    expect(region).not.toHaveTextContent(/not implemented|later V4 migration/i);
    expect(screen.queryByRole("region", { name: /review workspace/i })).not.toBeInTheDocument();
  });

  it("keeps export fail-closed while mandatory review decisions are pending", async () => {
    render(<App />);
    await createReviewJob();
    expectNoResultAction();
  });
});

describe("App privacy gate (T08 U3)", () => {
  const REVIEW_NOTE =
    "Nombre: Carmen Sánchez\nLa paciente fue atendida por el Dr. García López el 12/03/2024. Contacto: 612345678.";

  async function createReviewJob() {
    fireEvent.change(screen.getByLabelText("Pegar texto"), { target: { value: REVIEW_NOTE } });
    fireEvent.click(screen.getByRole("button", { name: "Crear trabajo" }));
    await waitForReviewWorkspace();
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
      fireEvent.click(screen.getByRole("button", { name: "Aceptar detección" }));
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

    fireEvent.click(taskButton("Privacy Gate"));
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
    expect(taskButton("Ir al resultado")).toBeEnabled();
  });

  it("stays fail-closed: the gate shows the pending state while a decision is pending", async () => {
    render(<App />);
    await createReviewJob();
    const list = screen.getAllByRole("list", { name: /detections/i })[0];
    fireEvent.click(within(list).queryAllByRole("button")[0] as HTMLElement);
    fireEvent.click(screen.getByRole("button", { name: "Aceptar detección" }));
    const pending = pendingCount();
    expect(pending).toBeGreaterThan(0);

    fireEvent.click(taskButton("Privacy Gate"));
    const alert = screen.getByRole("alert");
    expect(alert).toHaveTextContent(expectedBlockedMessage(pending));

    // Fail-closed availability: nothing became ready while decisions remain.
    expect(screen.getByText("Not ready")).toBeInTheDocument();
    expect(screen.queryByText("Ready")).not.toBeInTheDocument();
    expect(taskButton("Ir al resultado")).toBeDisabled();
  });

  it("reaches the single-item Result directly from Review without a mandatory Gate stop (REC-05 WU-B2)", async () => {
    render(<App />);
    await createReviewJob();
    acceptAllDetections();
    expect(pendingCount()).toBe(0);

    // Ordinary single-item journey: the last review decision -> Result in ONE
    // transition. The Privacy Gate stop is no longer mandatory.
    fireEvent.click(taskButton("Ver resultado"));
    expect(screen.getByRole("heading", { level: 2, name: "Resultado" })).toBeInTheDocument();

    // The Privacy Gate is not hidden, deleted or disabled: it stays an enabled,
    // optional destination reachable from Review (G-HP2: no new destination).
    fireEvent.click(screen.getByRole("button", { name: "Volver a la revisión" }));
    await waitForReviewWorkspace();
    fireEvent.click(taskButton("Privacy Gate"));
    expect(screen.getByRole("heading", { level: 2, name: "Privacy Gate" })).toBeInTheDocument();
  });
});

describe("App policy change vs an existing review (PR #40 corrective C1+C2)", () => {
  const REVIEW_NOTE =
    "Nombre: Carmen Sánchez\nLa paciente fue atendida por el Dr. García López el 12/03/2024. Contacto: 612345678.";

  async function createReviewJob() {
    fireEvent.change(screen.getByLabelText("Pegar texto"), { target: { value: REVIEW_NOTE } });
    fireEvent.click(screen.getByRole("button", { name: "Crear trabajo" }));
    await waitForReviewWorkspace();
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
      fireEvent.click(screen.getByRole("button", { name: "Aceptar detección" }));
    }
  }

  it("a completed review cannot be relabelled: a real policy change blocks the gates again and the review restarts under the new policy", async () => {
    render(<App />);
    await createReviewJob();
    acceptAllDetections();
    expect(pendingCount()).toBe(0);
    // From the Privacy Gate step, the Result action is the real derived-gate
    // assertion (not step-ordering).
    fireEvent.click(taskButton("Privacy Gate"));
    expect(taskButton("Ir al resultado")).toBeEnabled();

    // The select stays enabled: the invalidation must be state-enforced,
    // not achieved by disabling the control (requirement 6).
    const policySelect = screen.getByLabelText("Política de privacidad:");
    expect(policySelect).toBeEnabled();
    fireEvent.change(policySelect, { target: { value: "strict" } });

    // State behavior, not the control: export is blocked again because the
    // derived review-dependent state was reset in the same transition.
    expect(taskButton("Ir al resultado")).toBeDisabled();

    // The stale session is gone: re-entering Review creates a fresh session
    // under the new policy, with every decision pending again. Re-entry into
    // Review through the shell's return action keeps the preserved
    // once-only startReview authority (the engine attempt re-runs exactly
    // because the REAL policy change invalidated the previous outcome).
    fireEvent.click(taskButton("Volver a la revisión"));
    await waitForReviewWorkspace();
    expect(screen.getByRole("region", { name: /review workspace/i })).toBeInTheDocument();
    expect(pendingCount()).toBeGreaterThan(0);

    // Completing the review again re-opens the gate, which reports the NEW
    // policy factually — the old review was never relabelled to it.
    acceptAllDetections();
    fireEvent.click(taskButton("Privacy Gate"));
    expect(taskButton("Ir al resultado")).toBeEnabled();
    const facts = screen.getByRole("status", { name: /output availability facts/i });
    expect(facts).toHaveTextContent("Privacy policy used: Strict");
    expect(facts).toHaveTextContent("Safe output: Ready");
  });

  it("a policy change from the direct Result keeps a truthful way back to Review (issue #84 correction)", async () => {
    render(<App />);
    await createReviewJob();
    acceptAllDetections();
    expect(pendingCount()).toBe(0);
    // D-024 direct path: Review → Result without a mandatory Gate stop.
    fireEvent.click(taskButton("Ver resultado"));
    expect(screen.getByRole("heading", { level: 2, name: "Resultado" })).toBeInTheDocument();

    // REAL policy change from the Result: the session-dependent authorization
    // is invalidated (setPolicy keeps the flow position, the hook drops the
    // session), so ExportStep unmounts into the unavailable state.
    fireEvent.change(screen.getByLabelText("Política de privacidad:"), {
      target: { value: "strict" },
    });

    // No stale Safe download surface remains.
    expect(screen.queryByRole("heading", { level: 2, name: "Resultado" })).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /Descargar documento preparado/ })
    ).not.toBeInTheDocument();
    // The unavailable state states its fact in professional Spanish (the copy
    // this ticket authored; acceptance I).
    expect(screen.getByText(/Este paso no está disponible/i)).toBeInTheDocument();

    // The shell still offers the truthful way back to Review — gated by the
    // domain's own backward-navigation authority (Review was visited), never a
    // new ad-hoc enable rule (Gate 2). The former five-step nav was the only
    // recovery path before this correction.
    fireEvent.click(taskButton("Volver a la revisión"));

    // The review can be redone under the new policy: a fresh session, every
    // decision pending again, no stale result.
    await waitForReviewWorkspace();
    expect(pendingCount()).toBeGreaterThan(0);
    // CORA-84-02: the visited `export` step is backward-navigation history,
    // not a currently valid Result action. While the fresh review still has
    // mandatory pending decisions, the Review surface must not offer a
    // premature «Ver resultado» CTA.
    expect(screen.queryByRole("button", { name: "Ver resultado" })).not.toBeInTheDocument();
    // The action is gated, not removed: completing the redone review re-opens
    // the direct D-024 Result from Review.
    acceptAllDetections();
    expect(taskButton("Ver resultado")).toBeEnabled();
  });

  it("an unchanged policy selection is an exact no-op: the completed review survives", async () => {
    render(<App />);
    await createReviewJob();
    acceptAllDetections();
    fireEvent.click(taskButton("Privacy Gate"));
    expect(taskButton("Ir al resultado")).toBeEnabled();

    fireEvent.change(screen.getByLabelText("Política de privacidad:"), {
      target: { value: "standard" },
    });

    expect(taskButton("Ir al resultado")).toBeEnabled();
    const facts = screen.getByRole("status", { name: /output availability facts/i });
    expect(facts).toHaveTextContent("Privacy policy used: Standard");
    expect(facts).toHaveTextContent("Safe output: Ready");
  });

  it("all four policies are selectable through the UI on a text job (REC-02)", async () => {
    render(<App />);
    createTextJob();
    await waitForReviewWorkspace();

    // Since REC-02 every accepted policy has a text mapping, so all four
    // options are enabled and selectable.
    for (const name of ["Standard", "External AI", "Longitudinal Research", "Strict"]) {
      expect(screen.getByRole("option", { name })).toBeEnabled();
    }

    const policySelect = screen.getByLabelText("Política de privacidad:") as HTMLSelectElement;
    fireEvent.change(policySelect, { target: { value: "external-ai" } });
    expect(policySelect.value).toBe("external-ai");
    expect(
      (screen.getByRole("option", { name: "External AI" }) as HTMLOptionElement).selected
    ).toBe(true);

    // The newly enabled text policy reaches Review and never surfaces a
    // spurious typed failure. A real policy change invalidated the previous
    // session, so the shell offers the explicit review restart.
    fireEvent.click(await screen.findByRole("button", { name: "Iniciar revisión" }));
    await waitForReviewWorkspace();
    expect(screen.getByRole("region", { name: /review workspace/i })).toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("a policy selection is a state change, not a review start: the gate stays fail-closed (REC-02)", async () => {
    render(<App />);
    createTextJob();
    await waitForReviewWorkspace();
    fireEvent.change(screen.getByLabelText("Política de privacidad:"), {
      target: { value: "longitudinal-research" },
    });

    // Selecting the policy does not start review or open the export gate: the
    // previous session was invalidated, the review restart stays explicit and
    // no Result action appears.
    await screen.findByRole("button", { name: "Iniciar revisión" });
    expect(screen.queryByRole("region", { name: /review workspace/i })).not.toBeInTheDocument();
    expectNoResultAction();
    // The gate destination stays fail-closed: without an active review session
    // it renders no output facts at all (unchanged baseline behavior), and the
    // forward Result affordance stays visible but disabled.
    fireEvent.click(taskButton("Privacy Gate"));
    expect(screen.queryByText("Ready")).not.toBeInTheDocument();
    expect(taskButton("Ir al resultado")).toBeDisabled();
  });
});

/**
 * Issue #84 correction, journey C: the single-item Result revisit provenance
 * is bound to the exact Job/policy/ReviewSession identity, so a NEW Job never
 * inherits the previous Job's Result visit. (The replaced-ReviewSession half
 * of journey C is already falsified by "a policy change from the direct
 * Result keeps a truthful way back to Review" above: the fresh session's
 * pending review offers no «Ver resultado» CTA.)
 */
describe("App single-item Result revisit provenance (issue #84 correction)", () => {
  const PROVENANCE_NOTE =
    "Nombre: Carmen Sánchez\nLa paciente fue atendida por el Dr. García López el 12/03/2024. Contacto: 612345678.";

  async function createReviewJob() {
    fireEvent.change(screen.getByLabelText("Pegar texto"), {
      target: { value: PROVENANCE_NOTE },
    });
    fireEvent.click(screen.getByRole("button", { name: "Crear trabajo" }));
    await waitForReviewWorkspace();
  }

  function acceptAllDetections() {
    fireEvent.click(screen.getByRole("button", { name: "Pending" }));
    for (;;) {
      const lists = screen.queryAllByRole("list", { name: "Detections" });
      const first = lists[0] ? within(lists[0]).queryAllByRole("button")[0] : undefined;
      if (!first) break;
      fireEvent.click(first);
      fireEvent.click(screen.getByRole("button", { name: "Aceptar detección" }));
    }
  }

  it("a new Job never inherits the previous Job's Result provenance: its pending review offers no Result action", async () => {
    render(<App />);

    // Job 1: complete review and enter the single-item Result legitimately
    // (this is the only visit whose provenance may ever be retained).
    await createReviewJob();
    acceptAllDetections();
    fireEvent.click(taskButton("Ver resultado"));
    expect(screen.getByRole("heading", { level: 2, name: "Resultado" })).toBeInTheDocument();

    // A brand-new Job replaces the current one entirely (fresh domain id).
    fireEvent.click(taskButton("Nuevo trabajo"));
    await createReviewJob();

    // The retained provenance is bound to Job 1: Job 2's still-pending review
    // keeps the Result affordance fail-closed — the previous visit cannot be
    // resurrected through the new Job.
    expectNoResultAction();
  });
});

describe("App document intake (T06)", () => {
  it("confirms a single-document identifier in place and cannot carry pending intent into a new Job", async () => {
    render(<App />);
    selectFiles([new File(["DNI 12345678A"], "sintetico.txt", { type: "text/plain" })]);
    fireEvent.click(screen.getByRole("button", { name: "Crear trabajo" }));
    await waitForReviewWorkspace();
    fireEvent.click(
      within(screen.getByRole("list", { name: "Detections" })).getByRole("button", {
        name: /12345678A/,
      })
    );
    fireEvent.click(screen.getByRole("button", { name: /^Mantener original$/ }));
    expect(screen.getByRole("status", { name: "Review progress" })).toHaveTextContent("Pending: 1");
    fireEvent.click(screen.getByRole("button", { name: "Cancelar" }));
    expect(screen.getByRole("status", { name: "Review progress" })).toHaveTextContent(
      "Restored: 0"
    );
    fireEvent.click(screen.getByRole("button", { name: /^Mantener original$/ }));
    fireEvent.click(screen.getByRole("button", { name: "Sí, mantener original" }));
    fireEvent.click(taskButton("Ver resultado"));
    expect(
      screen.getByRole("region", { name: "Originales conservados deliberadamente" })
    ).toHaveTextContent("IDENTIFICADOR");
    fireEvent.click(screen.getByRole("button", { name: "Volver a la revisión" }));
    await waitForReviewWorkspace();
    fireEvent.click(
      within(screen.getByRole("list", { name: "Detections" })).getByRole("button", {
        name: /12345678A/,
      })
    );
    fireEvent.click(screen.getByRole("button", { name: "Aceptar detección" }));
    fireEvent.click(screen.getByRole("button", { name: /^Mantener original$/ }));
    const oldConfirm = screen.getByRole("button", { name: "Sí, mantener original" });
    fireEvent.click(screen.getByRole("button", { name: "Nuevo trabajo" }));
    fireEvent.click(oldConfirm);
    fireEvent.change(screen.getByLabelText("Pegar texto"), { target: { value: "DNI 12345678A" } });
    fireEvent.click(screen.getByRole("button", { name: "Crear trabajo" }));
    await waitForReviewWorkspace();
    expect(screen.queryByRole("button", { name: "Sí, mantener original" })).not.toBeInTheDocument();
    expect(screen.getByRole("status", { name: "Review progress" })).toHaveTextContent("Pending: 1");
    expect(screen.getByRole("status", { name: "Review progress" })).toHaveTextContent(
      "Restored: 0"
    );
    expectNoResultAction();
  });
  afterEach(() => {
    delete window.pdfjsLib;
    delete (globalThis as { pdfjsWorker?: unknown }).pdfjsWorker;
  });

  it("never advertises legacy .doc in the file input accept attribute", async () => {
    render(<App />);
    const input = screen.getByLabelText(/seleccionar archivos/i) as HTMLInputElement;
    expect(input).toHaveAttribute("accept", ".txt,.pdf,.docx,.csv,.xls,.xlsx");
  });

  it("creates a document job from a TXT fixture after extraction", async () => {
    render(<App />);
    selectFiles([fixtureFile("sample-clinical-note.txt")]);
    fireEvent.click(screen.getByRole("button", { name: "Crear trabajo" }));
    // The header's persistent job fact is the job NAME (issue #84 correction:
    // the internal kind is not permanent chrome).
    await waitFor(() => {
      expect(screen.getByText("sample-clinical-note.txt")).toBeInTheDocument();
    });
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    // Quiet shell (#84): the document job lands directly on Review, so the
    // draft intake surface is unmounted. The cleared-draft end state is
    // witnessed by the reset paths in their dedicated tests.
    await waitForReviewWorkspace();
  });

  it("surfaces a typed unsupported alert for legacy .doc and creates no job", async () => {
    render(<App />);
    selectFiles([fixtureFile("sample-legacy.doc")]);
    fireEvent.click(screen.getByRole("button", { name: "Crear trabajo" }));
    const alert = await screen.findByRole("alert");
    // REC-08 F1: Spanish presentation; the offending ".doc" is still named and
    // the legacy format is never advertised as supported.
    expect(alert).toHaveTextContent(/\.doc/);
    expect(alert).toHaveTextContent(/no se admite/i);
    expect(screen.getByText("Aún no hay trabajo")).toBeInTheDocument();
  });

  it("surfaces a typed extraction-failed alert for a corrupt DOCX and creates no job", async () => {
    render(<App />);
    selectFiles([fixtureFile("corrupt.docx")]);
    fireEvent.click(screen.getByRole("button", { name: "Crear trabajo" }));
    const alert = await screen.findByRole("alert");
    // REC-08 F1: Spanish presentation (failure + remedy).
    expect(alert).toHaveTextContent(/no se pudo leer/i);
    expect(alert).toHaveTextContent(/inténtelo de nuevo/i);
    expect(screen.getByText("Aún no hay trabajo")).toBeInTheDocument();
  });

  it("surfaces the empty-input alert for an empty TXT and creates no job", async () => {
    render(<App />);
    selectFiles([new File(["   \n\t "], "empty.txt")]);
    fireEvent.click(screen.getByRole("button", { name: "Crear trabajo" }));
    const alert = await screen.findByRole("alert");
    // REC-08 F1: Spanish presentation (failure + remedy).
    expect(alert).toHaveTextContent(/no contiene texto utilizable/i);
    expect(screen.getByText("Aún no hay trabajo")).toBeInTheDocument();
  });

  it("surfaces the pdf-no-text-layer alert for a scan-like PDF and creates no job", async () => {
    await seedRealPdfJs();
    render(<App />);
    selectFiles([fixtureFile("sample-scanned.pdf")]);
    fireEvent.click(screen.getByRole("button", { name: "Crear trabajo" }));
    // Real pdf.js extraction under parallel vitest workers can exceed the
    // default 1s poll budget on a loaded machine; the oracle disagrees on
    // alert CONTENT, not on millisecond latency.
    const alert = await screen.findByRole("alert", {}, { timeout: 10_000 });
    // REC-08 F1: Spanish presentation (failure + remedy).
    expect(alert).toHaveTextContent(/texto extraíble/i);
    expect(alert).toHaveTextContent(/escaneo/i);
    expect(screen.getByText("Aún no hay trabajo")).toBeInTheDocument();
  });

  it("creates a document job from the text-bearing PDF fixture", async () => {
    await seedRealPdfJs();
    render(<App />);
    selectFiles([fixtureFile("sample-clinical-note.pdf")]);
    fireEvent.click(screen.getByRole("button", { name: "Crear trabajo" }));
    // Same pdf.js latency budget as the scan-like-PDF oracle above. The
    // header's persistent job fact is the job NAME (issue #84 correction).
    await waitFor(
      () => {
        expect(screen.getByText("sample-clinical-note.pdf")).toBeInTheDocument();
      },
      { timeout: 10_000 }
    );
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("still rejects a mixed structured/document selection with the typed ambiguous error", async () => {
    render(<App />);
    selectFiles([fixtureFile("sample-clinical-note.txt"), new File(["a,b"], "labs.csv")]);
    fireEvent.click(screen.getByRole("button", { name: "Crear trabajo" }));
    const alert = await screen.findByRole("alert");
    // REC-08 F1: Spanish presentation of the typed ambiguous-input refusal.
    expect(alert).toHaveTextContent(/no se pueden combinar/i);
    expect(screen.getByText("Aún no hay trabajo")).toBeInTheDocument();
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
      fireEvent.click(screen.getByRole("button", { name: "Aceptar detección" }));
    }
  }

  /** Full flow: create a text job, complete its review, reach Export. */
  async function completeReviewToExport(note: string) {
    fireEvent.change(screen.getByLabelText("Pegar texto"), { target: { value: note } });
    fireEvent.click(screen.getByRole("button", { name: "Crear trabajo" }));
    await waitForReviewWorkspace();
    acceptAllDetections();
    fireEvent.click(taskButton("Privacy Gate"));
    fireEvent.click(taskButton("Ir al resultado"));
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

  it("session isolation: after Borrar sesión, the new job's artifacts carry no prior-job data (acceptance 6)", async () => {
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

      // Borrar sesión and run a second, different job end-to-end.
      fireEvent.click(screen.getByRole("button", { name: "Borrar sesión" }));
      expect(screen.getByText("Aún no hay trabajo")).toBeInTheDocument();
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

      // Force unrelated re-renders and a full Result remount (gate round-trip;
      // a REAL policy change invalidates the review by contract — see the C2
      // flow oracle — so it must not be used here).
      fireEvent.click(taskButton("Privacy Gate"));
      fireEvent.click(taskButton("Ir al resultado"));
      fireEvent.change(screen.getByLabelText("Política de privacidad:"), {
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

  /** Select files, create the job and wait until every read has settled.
   * Quiet shell (#84): the batch queue lands directly on Review while the
   * reads run in flight; the review workspace is installed exactly when the
   * reads settled and the one-shot attempt produced the sessions. */
  async function createBatchAndSettle(files: File[]) {
    selectFiles(files);
    fireEvent.click(screen.getByRole("button", { name: "Crear trabajo" }));
    await waitForReviewWorkspace();
  }

  /** Complete the ACTIVE document's mandatory decisions via restored. */
  function completeActiveDocument() {
    fireEvent.click(screen.getByRole("button", { name: "Pending" }));
    for (;;) {
      const lists = screen.queryAllByRole("list", { name: "Detections" });
      const first = lists[0] ? within(lists[0]).queryAllByRole("button")[0] : undefined;
      if (!first) break;
      fireEvent.click(first);
      fireEvent.click(screen.getByRole("button", { name: /^Mantener original$/ }));
      const confirm = screen.queryByRole("button", { name: "Sí, mantener original" });
      if (confirm) fireEvent.click(confirm);
    }
  }

  function documentSelector(): HTMLElement {
    return screen.getByRole("region", { name: "Batch documents" });
  }

  it("creates a batch with one failed document: the failure stays visible and the artifact stays blocked while the Result communicates it", async () => {
    render(<App />);
    // One good synthetic TXT + one forced-failure DOCX fixture → a batch, NOT
    // an all-or-nothing refusal (BATCH-001).
    await createBatchAndSettle([
      new File([BATCH_NOTE_A], "historia-buena.txt"),
      fixtureFile("corrupt.docx"),
    ]);

    // The quiet shell lands the batch directly on its queue: the failed item
    // is surfaced there with its name and message (never hidden).
    await waitForReviewWorkspace();
    const selector = documentSelector();
    expect(selector).toHaveTextContent("historia-buena.txt");
    expect(selector).toHaveTextContent(/historia-buena\.txt — Requiere revisión/);
    expect(selector).toHaveTextContent(/corrupt\.docx — Error/);
    expect(selector).toHaveTextContent(/could not be parsed/i);
    // The failed item exposes no review button (no session exists).
    expect(within(selector).queryByRole("button", { name: /corrupt\.docx/ })).toBeNull();

    // Privacy Gate lists both items with their statuses and blocks, naming the
    // failed file with its message.
    fireEvent.click(taskButton("Privacy Gate"));
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

    // REC-07 #87: the batch Result stays reachable while the artifact is
    // unauthorized — it communicates blocked without enabling production.
    expect(taskButton("Ir al resultado")).toBeEnabled();
    fireEvent.click(taskButton("Ir al resultado"));
    expect(screen.getByRole("heading", { level: 2, name: "Resultado" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Bloqueado" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Descargar resumen seguro (.csv)" })).toBeDisabled();
    // Returning to Review preserves the accepted review state (no loss).
    fireEvent.click(screen.getByRole("button", { name: "Volver a la revisión" }));
    await waitFor(
      () => {
        expect(screen.getByRole("region", { name: /review workspace/i })).toBeInTheDocument();
      },
      { timeout: 10_000 }
    );
    expect(documentSelector()).toHaveTextContent(/historia-buena\.txt — Requiere revisión/);
    expect(documentSelector()).toHaveTextContent(/corrupt\.docx — Error/);
  });

  it("offers no no-op review-start action once the batch review exists (issue #84 correction)", async () => {
    render(<App />);
    // Once the batch sessions exist, the reads-settle effect owns the one
    // processing attempt and handleGoToStep skips the start branch for a
    // batch: a visible "Iniciar revisión" here would only re-navigate to the
    // step already shown — an affordance that does nothing (acceptance G:
    // batch affordances remain reachable and TRUTHFUL).
    await createBatchAndSettle([
      new File([BATCH_NOTE_A], "lote-a.txt"),
      new File([BATCH_NOTE_B], "lote-b.txt"),
    ]);
    expect(screen.queryByRole("button", { name: "Iniciar revisión" })).not.toBeInTheDocument();
  });

  it("selecting and navigating between documents never marks one reviewed (FUNC-002, SD-5)", async () => {
    render(<App />);
    await createBatchAndSettle([
      new File([BATCH_NOTE_A], "doc-a.txt"),
      new File([BATCH_NOTE_B], "doc-b.txt"),
    ]);
    await waitForReviewWorkspace();

    // The active document is A: complete its mandatory decisions.
    completeActiveDocument();
    // #86 defaults to Necesitan atención after A completes, so explicitly use
    // Todos when this legacy oracle needs to inspect both completed and pending rows.
    await waitFor(() =>
      expect(screen.getByRole("button", { name: "Todos (2)" })).toBeInTheDocument()
    );
    fireEvent.click(screen.getByRole("button", { name: "Todos (2)" }));
    expect(documentSelector()).toHaveTextContent(/doc-a\.txt — Completado/);
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
    fireEvent.click(taskButton("Privacy Gate"));
    fireEvent.click(taskButton("Volver a la revisión"));
    await waitFor(() =>
      expect(screen.getByRole("region", { name: /review workspace/i })).toBeInTheDocument()
    );
    // Returning to Review remounts the queue and restores #86's default
    // attention filter; choose Todos before asserting cross-document state.
    fireEvent.click(screen.getByRole("button", { name: "Todos (2)" }));
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
    fireEvent.click(screen.getByRole("button", { name: "Crear trabajo" }));
    // The batch lands on Review with the queue visible while reads run
    // (issue #84 correction: the internal kind is not header chrome, so the
    // creation witness here is the batch queue itself).
    await waitFor(() => expect(documentSelector()).toHaveTextContent(/doc-b\.txt/));
    // The factual read progress from the former start surface follows the
    // queue onto Review (issue #84).
    await waitFor(() =>
      expect(screen.getByRole("status")).toHaveTextContent(/leyendo documentos… 0 de 2 leídos/i)
    );

    // The quiet shell is already on the batch queue while reads are in flight:
    // no processing and a factual reading state.
    await waitFor(() => expect(documentSelector()).toHaveTextContent(/doc-a\.txt — Leyendo/));
    expect(screen.queryByRole("region", { name: /review workspace/i })).not.toBeInTheDocument();

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
    fireEvent.click(screen.getByRole("button", { name: "Crear trabajo" }));
    await waitFor(() => expect(documentSelector()).toHaveTextContent(/doc-b\.txt/));

    // Clear the session mid-read: the job is gone before the read resolves.
    fireEvent.click(screen.getByRole("button", { name: "Borrar sesión" }));
    expect(screen.getByText("Aún no hay trabajo")).toBeInTheDocument();

    await act(async () => {
      resolveText(BATCH_NOTE_A);
    });
    await waitFor(() => expect(screen.queryByText(/leyendo documentos/i)).not.toBeInTheDocument());
    expect(screen.getByText("Aún no hay trabajo")).toBeInTheDocument();
    expect(screen.queryByRole("region", { name: "Batch documents" })).not.toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("never renders Premium framing anywhere in the V4 batch flow (UX-004)", async () => {
    render(<App />);
    await createBatchAndSettle([
      new File([BATCH_NOTE_A], "doc-a.txt"),
      new File([BATCH_NOTE_B], "doc-b.txt"),
    ]);
    await waitForReviewWorkspace();
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
    await waitFor(() => {
      expect(documentSelector()).toHaveTextContent(/doc-a\.txt — Requiere revisión/);
    });
    expect(documentSelector()).toHaveTextContent(/doc-b\.txt — Requiere revisión/);

    // Remedy loop: a REAL supported policy change (standard → strict) resets the
    // processing-derived item state. The read text is policy-INDEPENDENT, so the
    // items return to queued WITH their held text.
    fireEvent.change(screen.getByLabelText("Política de privacidad:"), {
      target: { value: "strict" },
    });

    // Re-processing runs from the SAME held read text instead of dead-ending
    // on a missing source.
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
    await waitForReviewWorkspace();

    // Complete doc A with restored ("Keep original") decisions.
    completeActiveDocument();
    await waitFor(() =>
      expect(screen.getByRole("button", { name: "Todos (2)" })).toBeInTheDocument()
    );
    fireEvent.click(screen.getByRole("button", { name: "Todos (2)" }));
    expect(documentSelector()).toHaveTextContent(/doc-a\.txt — Completado/);
    expect(documentSelector()).toHaveTextContent(/doc-b\.txt — Requiere revisión/);

    // Switch the ACTIVE document to B; doc A's restored decisions still exist.
    fireEvent.click(within(documentSelector()).getByRole("button", { name: /doc-b\.txt/ }));

    fireEvent.click(taskButton("Privacy Gate"));
    const warnings = screen.getByRole("list", { name: /kept-original warnings/i });
    expect(warnings).toHaveTextContent("kept-original");
    expect(warnings).toHaveTextContent(
      "the original text was deliberately kept by reviewer decision (restored)"
    );
    // B (the active document) is still pending; the warning came from A.
    expect(screen.getByRole("alert")).toHaveTextContent(/mandatory review decision/i);
    fireEvent.click(taskButton("Ir al resultado"));
    const resultWarning = screen.getByRole("region", {
      name: "Originales conservados deliberadamente",
    });
    expect(resultWarning).toHaveTextContent("Originales conservados:");
    expect(resultWarning).not.toHaveTextContent("Carmen Sánchez");
    expect(screen.getByRole("button", { name: "Descargar resumen seguro (.csv)" })).toBeDisabled();
    fireEvent.change(screen.getByLabelText("Política de privacidad:"), {
      target: { value: "strict" },
    });
    expect(
      screen.queryByRole("region", { name: "Originales conservados deliberadamente" })
    ).not.toBeInTheDocument();
  });

  it("reaches the ready batch Result for a completed error-free batch (REC-07 #87)", async () => {
    render(<App />);
    await createBatchAndSettle([
      new File([BATCH_NOTE_A], "doc-a.txt"),
      new File([BATCH_NOTE_B], "doc-b.txt"),
    ]);
    await waitForReviewWorkspace();

    // Complete BOTH documents → batch review complete, zero error items.
    completeActiveDocument();
    await waitFor(() =>
      expect(screen.getByRole("button", { name: "Todos (2)" })).toBeInTheDocument()
    );
    fireEvent.click(screen.getByRole("button", { name: "Todos (2)" }));
    expect(documentSelector()).toHaveTextContent(/doc-a\.txt — Completado/);
    fireEvent.click(within(documentSelector()).getByRole("button", { name: /doc-b\.txt/ }));
    completeActiveDocument();
    await waitFor(() => expect(documentSelector()).toHaveTextContent(/doc-b\.txt — Completado/));

    // Privacy Gate: review is complete and the exact current batch-session
    // authority is present, so both the Safe summary and the #89 batch
    // Confidential Audit are factually available at the gate.
    fireEvent.click(taskButton("Privacy Gate"));
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    const availability = screen.getByRole("region", { name: "Output availability" });
    expect(within(availability).getByText("Ready")).toBeInTheDocument();
    expect(within(availability).getByText("Available")).toBeInTheDocument();
    expect(within(availability).getByText(/Safe summary CSV/)).toBeInTheDocument();

    // Export is the ready batch Result: exactly one primary Safe action, and
    // returning to Review preserves both completions (no loss, no fabrication).
    fireEvent.click(taskButton("Ir al resultado"));
    expect(screen.getByRole("heading", { level: 2, name: "Resultado" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Listo para usar" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Descargar resumen seguro (.csv)" })).toBeEnabled();
    fireEvent.click(screen.getByRole("button", { name: "Volver a la revisión" }));
    await waitFor(() =>
      expect(screen.getByRole("button", { name: "Todos (2)" })).toBeInTheDocument()
    );
    fireEvent.click(screen.getByRole("button", { name: "Todos (2)" }));
    expect(documentSelector()).toHaveTextContent(/doc-a\.txt — Completado/);
    expect(documentSelector()).toHaveTextContent(/doc-b\.txt — Completado/);
  });
});

describe("App structured Configure workspace (T20 #24)", () => {
  it("forwards current structured kept-original facts to Result and re-derives after correction/policy replacement", async () => {
    createStructuredJob("NHC,CampoLibre\nP-001,DNI 12345678A");
    await screen.findByRole("list", { name: /column classification list/i });
    fireEvent.change(screen.getByLabelText("Reviewer action for CampoLibre"), {
      target: { value: "process-as-text" },
    });
    fireEvent.click(taskButton("Continuar a la revisión"));
    fireEvent.click(screen.getByRole("button", { name: "Process free-text cells" }));
    await screen.findByRole("list", { name: "Detections" }, { timeout: 10_000 });
    fireEvent.click(
      within(screen.getByRole("list", { name: "Detections" })).getByRole("button", {
        name: /12345678A/,
      })
    );
    fireEvent.click(screen.getByRole("button", { name: /^Mantener original$/ }));
    expect(screen.getByRole("status", { name: "Free-text review progress" })).toHaveTextContent(
      "Pending decisions: 1"
    );
    fireEvent.click(screen.getByRole("button", { name: "Sí, mantener original" }));
    expect(screen.getByRole("status", { name: "Free-text review progress" })).toHaveTextContent(
      "Free-text review ready: Yes"
    );
    fireEvent.click(screen.getByRole("button", { name: "Continue to Privacy Gate" }));
    await waitFor(() => expect(taskButton("Ir al resultado")).toBeEnabled());
    fireEvent.click(taskButton("Ir al resultado"));
    const warning = screen.getByRole("region", { name: "Originales conservados deliberadamente" });
    expect(warning).toHaveTextContent("IDENTIFICADOR: 1");
    expect(warning).not.toHaveTextContent("12345678A");
    expect(
      screen.getByRole("button", { name: "Download Safe Structured Output (.csv)" })
    ).toBeEnabled();
    fireEvent.click(screen.getByRole("button", { name: "Volver a la revisión" }));
    await screen.findByRole("list", { name: "Detections" }, { timeout: 10_000 });
    fireEvent.click(
      within(screen.getByRole("list", { name: "Detections" })).getByRole("button", {
        name: /12345678A/,
      })
    );
    fireEvent.click(screen.getByRole("button", { name: "Aceptar detección" }));
    fireEvent.click(screen.getByRole("button", { name: "Continue to Privacy Gate" }));
    await waitFor(() => expect(taskButton("Ir al resultado")).toBeEnabled());
    fireEvent.click(taskButton("Ir al resultado"));
    expect(
      screen.queryByRole("region", { name: "Originales conservados deliberadamente" })
    ).not.toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("Política de privacidad:"), {
      target: { value: "strict" },
    });
    expect(
      screen.queryByRole("region", { name: "Originales conservados deliberadamente" })
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Download Safe Structured Output (.csv)" })
    ).toBeDisabled();
  });
  const CSV = [
    "NHC,Fecha_Nac,Diagnostico,CampoLibre",
    "00123,1990-05-01,Gripe A,rotación de sala",
    "00456,1985-11-23,Fractura,seguimiento",
  ].join("\n");

  function createStructuredJob(csv: string) {
    render(<App />);
    const csvFile = new File([csv], "labs.csv", { type: "text/csv" });
    fireEvent.change(screen.getByLabelText(/seleccionar archivos/i), {
      target: { files: [csvFile] },
    });
    fireEvent.click(screen.getByRole("button", { name: "Crear trabajo" }));
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
    fireEvent.click(taskButton("Continuar a la revisión"));
    fireEvent.click(screen.getByRole("button", { name: "Continue to Privacy Gate" }));
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
    fireEvent.change(screen.getByLabelText(/seleccionar archivos/i), {
      target: { files: [first, second] },
    });
    fireEvent.click(screen.getByRole("button", { name: "Crear trabajo" }));
    expect(await screen.findByRole("alert")).toHaveTextContent(/una tabla cada vez/i);
    expect(screen.getByText("Aún no hay trabajo")).toBeInTheDocument();
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
    fireEvent.click(taskButton("Continuar a la revisión"));
    fireEvent.click(screen.getByRole("button", { name: "Back to Configure" }));
    await screen.findByRole("list", { name: /column classification list/i });
    expect(screen.getByLabelText("Reviewer classification for CampoLibre")).toHaveValue(
      "sensitive"
    );
    expect(screen.getByLabelText("Date role for Fecha_Nac")).toHaveValue("visit");
    expect(
      screen.getByRole("status", { name: /structured configuration facts/i })
    ).toHaveTextContent("Structured export ready: Yes");
  });
});
