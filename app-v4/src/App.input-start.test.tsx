import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import "@testing-library/jest-dom/vitest";

import { App } from "./App";
import { SYNTHETIC_EXAMPLES } from "./input/synthetic-examples";
import { POLICY_IDS } from "./policy-guidance";
import ejemploHistoria from "../../ejemplos/03-historia-clinica.json";
import ejemploConsulta from "../../ejemplos/01-consulta-urgencias.json";
import ejemploQuirurgico from "../../ejemplos/02-informe-quirurgico.json";

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

const EXPECTED_TEXTS = [
  ejemploConsulta.texto,
  ejemploQuirurgico.texto,
  ejemploHistoria.texto,
] as const;

function draftTextarea(): HTMLTextAreaElement {
  return screen.getByLabelText("Pegar texto") as HTMLTextAreaElement;
}

function createButton(): HTMLElement {
  return screen.getByRole("button", { name: "Crear trabajo" });
}

/** Stub the platform clipboard read seam for one test; restored in afterEach. */
function stubClipboardRead(implementation: () => Promise<string> | never): void {
  Object.defineProperty(navigator, "clipboard", {
    value: { readText: vi.fn(implementation) },
    configurable: true,
  });
}

function removeClipboardStub(): void {
  Object.defineProperty(navigator, "clipboard", { value: undefined, configurable: true });
}

function pegarButton(): HTMLElement {
  return screen.getByRole("button", { name: "Pegar desde el portapapeles" });
}

/** A promise whose settlement is controlled by the test (pending-async witness). */
function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

// ---------------------------------------------------------------------------
// REC-08 evidence 1: synthetic examples load the draft, never a Job.
// ---------------------------------------------------------------------------
describe("Input start examples (REC-08 #80)", () => {
  it("shows three Spanish keyboard-operable example actions", () => {
    render(<App />);
    expect(SYNTHETIC_EXAMPLES).toHaveLength(3);
    for (const example of SYNTHETIC_EXAMPLES) {
      const button = screen.getByRole("button", { name: example.label });
      expect(button.tagName).toBe("BUTTON");
      expect(button).toBeEnabled();
      button.focus();
      expect(button).toHaveFocus();
    }
  });

  it("each example loads the expected heritage texto and creates no job", () => {
    for (let index = 0; index < SYNTHETIC_EXAMPLES.length; index += 1) {
      render(<App />);
      fireEvent.click(screen.getByRole("button", { name: SYNTHETIC_EXAMPLES[index].label }));
      // The maintained JSON payload is the content source (not v3 strings).
      expect(draftTextarea()).toHaveValue(EXPECTED_TEXTS[index]);
      // Choosing an example is draft-only: no Job, and the quiet shell offers
      // no task navigation while no job exists (issue #84).
      expect(screen.getByText("Aún no hay trabajo")).toBeInTheDocument();
      expect(screen.queryByText("Text job")).not.toBeInTheDocument();
      expect(screen.queryByRole("button", { name: "Iniciar revisión" })).not.toBeInTheDocument();
      expect(screen.queryByRole("button", { name: "Privacy Gate" })).not.toBeInTheDocument();
      cleanup();
    }
  });

  it("creation after an example uses the ordinary pasted-text authority", async () => {
    render(<App />);
    fireEvent.click(screen.getByRole("button", { name: SYNTHETIC_EXAMPLES[0].label }));
    fireEvent.click(createButton());
    expect(screen.getByText("Pasted text")).toBeInTheDocument();
    // Quiet shell (#84): creation lands directly on Review, so the draft
    // surface is unmounted. The fresh-Input end state (no stale example text)
    // is witnessed by returning to Input via the reset authority.
    fireEvent.click(screen.getByRole("button", { name: "Nuevo trabajo" }));
    expect(screen.getByText("Aún no hay trabajo")).toBeInTheDocument();
    expect(draftTextarea()).toHaveValue("");
  });
});

// ---------------------------------------------------------------------------
// REC-08 evidence 2: Pegar clipboard convenience with Ctrl+V fallback.
// ---------------------------------------------------------------------------
describe("Input start Pegar (REC-08 #80)", () => {
  it("a successful clipboard read loads the draft with no job and no storage/network side effect", async () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);
    const setItemSpy =
      typeof Storage !== "undefined" ? vi.spyOn(Storage.prototype, "setItem") : null;
    stubClipboardRead(() => Promise.resolve("Texto leído del portapapeles."));

    render(<App />);
    fireEvent.click(screen.getByRole("button", { name: "Pegar desde el portapapeles" }));
    await waitFor(() => {
      expect(draftTextarea()).toHaveValue("Texto leído del portapapeles.");
    });
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(screen.getByText("Aún no hay trabajo")).toBeInTheDocument();
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(setItemSpy?.mock.calls.length ?? 0).toBe(0);
  });

  it("a denied clipboard read shows the Spanish failure with the Ctrl+V fallback and creates no job", async () => {
    stubClipboardRead(() => {
      throw new Error("denied");
    });

    render(<App />);
    fireEvent.click(screen.getByRole("button", { name: "Pegar desde el portapapeles" }));
    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent(/portapapeles/);
    expect(alert).toHaveTextContent(/Ctrl\+V/);
    // The raw platform exception never becomes user-visible.
    expect(alert).not.toHaveTextContent(/denied/);
    expect(draftTextarea()).toHaveValue("");
    expect(screen.getByText("Aún no hay trabajo")).toBeInTheDocument();
  });

  it("an unavailable clipboard shows the same Spanish failure with the Ctrl+V fallback", async () => {
    removeClipboardStub();

    render(<App />);
    fireEvent.click(screen.getByRole("button", { name: "Pegar desde el portapapeles" }));
    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent(/portapapeles/);
    expect(alert).toHaveTextContent(/Ctrl\+V/);
    expect(screen.getByText("Aún no hay trabajo")).toBeInTheDocument();
  });

  // CORA-80-01: a late clipboard response must not overwrite a newer draft.
  it("a late clipboard read never overwrites a newer typed draft", async () => {
    const read = deferred<string>();
    stubClipboardRead(() => read.promise);

    render(<App />);
    fireEvent.click(pegarButton());
    // The user keeps typing while the platform read is still pending.
    fireEvent.change(draftTextarea(), { target: { value: "TEXTO NUEVO ESCRITO POR EL USUARIO" } });
    // The old clipboard response resolves late, after the newer user edit.
    read.resolve("LECTURA ANTIGUA DEL PORTAPAPELES");
    await waitFor(() => expect(pegarButton()).toBeEnabled());
    expect(draftTextarea()).toHaveValue("TEXTO NUEVO ESCRITO POR EL USUARIO");
    expect(screen.getByText("Aún no hay trabajo")).toBeInTheDocument();
  });

  // CORA-80-01: text equality alone is not authority. A type-then-undo makes
  // the draft text re-match the stale snapshot while the revision counter has
  // advanced, so the pending read must still be rejected.
  it("a late clipboard read never overwrites a type-then-undo draft that re-matches the stale snapshot", async () => {
    const read = deferred<string>();
    stubClipboardRead(() => read.promise);

    render(<App />);
    // An ordinary Document draft is already staged BEFORE the paste starts, so
    // its array identity never changes: the revision counter is the only
    // authority the stale response needs to be rejected by.
    fireEvent.change(screen.getByLabelText(/seleccionar archivos/i), {
      target: { files: [new File(["nota sintética"], "sintetico.txt")] },
    });
    fireEvent.click(pegarButton());
    // The user types a newer draft, then undoes it: the text ends identical to
    // the value the pending read snapshotted, but the revision counter advanced.
    fireEvent.change(draftTextarea(), {
      target: { value: "TEXTO QUE EL USUARIO ESCRIBE Y DESHACE" },
    });
    fireEvent.change(draftTextarea(), { target: { value: "" } });
    // The old clipboard response resolves after the undo restored the draft.
    read.resolve("RESPUESTA ANTIGUA DEL PORTAPAPELES");
    await waitFor(() => expect(pegarButton()).toBeEnabled());
    // Reference equality on the text alone would re-match and let this stale
    // read overwrite the draft; the revision counter must reject it.
    expect(draftTextarea()).toHaveValue("");
    expect(screen.queryByRole("alert")).toBeNull();
    // The undo-restored ordinary draft still creates a normal Document job.
    fireEvent.click(createButton());
    await waitFor(
      () => {
        // Issue #84 correction: the internal kind is not header chrome, so the
        // created-job witness is the real Review landing itself (async engine
        // completion — same latency budget as the other async oracles).
        expect(screen.getByRole("region", { name: /review workspace/i })).toBeInTheDocument();
      },
      { timeout: 10_000 }
    );
  });

  it("a late clipboard read never overwrites a newly chosen example", async () => {
    const read = deferred<string>();
    stubClipboardRead(() => read.promise);

    render(<App />);
    fireEvent.click(pegarButton());
    const example = SYNTHETIC_EXAMPLES[0];
    fireEvent.click(screen.getByRole("button", { name: example.label }));
    read.resolve("LECTURA ANTIGUA DEL PORTAPAPELES");
    await waitFor(() => expect(pegarButton()).toBeEnabled());
    expect(draftTextarea()).toHaveValue(example.text);
    expect(screen.getByText("Aún no hay trabajo")).toBeInTheDocument();
  });

  // CORA-80-03: a newer picker selection invalidates an older pending paste.
  it("a stale clipboard read never overwrites a newer picker file selection", async () => {
    const read = deferred<string>();
    stubClipboardRead(() => read.promise);

    render(<App />);
    fireEvent.click(pegarButton());
    fireEvent.change(screen.getByLabelText(/seleccionar archivos/i), {
      target: { files: [new File(["nota sintética"], "sintetico.txt")] },
    });
    // The newer file selection is staged BEFORE the old read resolves.
    expect(screen.getByText("1 archivo seleccionado")).toBeInTheDocument();
    expect(draftTextarea()).toHaveValue("");
    read.resolve("RESPUESTA ANTIGUA DEL PORTAPAPELES");
    await waitFor(() => expect(pegarButton()).toBeEnabled());
    expect(draftTextarea()).toHaveValue("");
    const list = screen.getByRole("list", { name: "Archivos seleccionados" });
    const items = within(list).getAllByRole("listitem");
    expect(items).toHaveLength(1);
    expect(items[0]).toHaveTextContent("sintetico.txt");
    expect(screen.getByText("Aún no hay trabajo")).toBeInTheDocument();
    fireEvent.click(createButton());
    await waitFor(
      () => {
        // Issue #84 correction: the internal kind is not header chrome, so the
        // created-job witness is the real Review landing itself (async engine
        // completion — same latency budget as the other async oracles).
        expect(screen.getByRole("region", { name: /review workspace/i })).toBeInTheDocument();
      },
      { timeout: 10_000 }
    );
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  // CORA-80-03: a newer nonempty drop invalidates an older pending paste.
  it("a stale clipboard read never overwrites a newer nonempty file drop", async () => {
    const read = deferred<string>();
    stubClipboardRead(() => read.promise);

    render(<App />);
    fireEvent.click(pegarButton());
    const heading = screen.getByRole("heading", { level: 3, name: "Elegir archivos" });
    const section = heading.closest("section");
    if (!section) throw new Error("expected the files card section");
    fireEvent.drop(section, {
      dataTransfer: { files: [new File(["b"], "doc-b.txt"), new File(["a"], "doc-a.txt")] },
    });
    read.resolve("RESPUESTA ANTIGUA DEL PORTAPAPELES");
    await waitFor(() => expect(pegarButton()).toBeEnabled());
    expect(draftTextarea()).toHaveValue("");
    const list = screen.getByRole("list", { name: "Archivos seleccionados" });
    const items = within(list).getAllByRole("listitem");
    expect(items).toHaveLength(2);
    expect(items[0]).toHaveTextContent("doc-b.txt");
    expect(items[1]).toHaveTextContent("doc-a.txt");
    expect(screen.getByText("2 archivos seleccionados")).toBeInTheDocument();
    expect(screen.getByText("Aún no hay trabajo")).toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// REC-08 evidence 3: drag/drop converges with selection on the same path.
// ---------------------------------------------------------------------------
describe("Input start drag/drop convergence (REC-08 #80)", () => {
  function filesSection(): HTMLElement {
    const heading = screen.getByRole("heading", { level: 3, name: "Elegir archivos" });
    const section = heading.closest("section");
    if (!section) throw new Error("expected the files card section");
    return section;
  }

  function dropFiles(files: File[]) {
    fireEvent.drop(filesSection(), { dataTransfer: { files } });
  }

  it("dropped files stage the same draft list as selected files, in order, with nothing lost", () => {
    render(<App />);
    dropFiles([new File(["b"], "doc-b.txt"), new File(["a"], "doc-a.txt")]);
    const list = screen.getByRole("list", { name: "Archivos seleccionados" });
    const items = within(list).getAllByRole("listitem");
    expect(items).toHaveLength(2);
    expect(items[0]).toHaveTextContent("doc-b.txt");
    expect(items[1]).toHaveTextContent("doc-a.txt");
    expect(screen.getByText("2 archivos seleccionados")).toBeInTheDocument();
    expect(screen.getByText("Aún no hay trabajo")).toBeInTheDocument();
  });

  it("a dropped single document creates the same Document job as a selection", async () => {
    render(<App />);
    dropFiles([new File(["Nota clínica sintética."], "nota.txt")]);
    fireEvent.click(createButton());
    await waitFor(
      () => {
        // Issue #84 correction: the internal kind is not header chrome, so the
        // created-job witness is the real Review landing itself (async engine
        // completion — same latency budget as the other async oracles).
        expect(screen.getByRole("region", { name: /review workspace/i })).toBeInTheDocument();
      },
      { timeout: 10_000 }
    );
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("a dropped mixed document+structured selection is refused with the same typed error", async () => {
    render(<App />);
    dropFiles([new File(["nota"], "historia.txt"), new File(["a,b"], "labs.csv")]);
    fireEvent.click(createButton());
    const alert = await screen.findByRole("alert");
    // REC-08 F1: the typed ambiguous-input refusal is presented in Spanish.
    expect(alert).toHaveTextContent(/no se pueden combinar/i);
    expect(screen.getByText("Aún no hay trabajo")).toBeInTheDocument();
  });

  it("a dropped legacy .doc is refused and .doc is never advertised", async () => {
    render(<App />);
    expect(screen.getByLabelText(/seleccionar archivos/i)).toHaveAttribute(
      "accept",
      ".txt,.pdf,.docx,.csv,.xls,.xlsx"
    );
    dropFiles([new File(["legacy"], "informe.doc")]);
    fireEvent.click(createButton());
    const alert = await screen.findByRole("alert");
    // REC-08 F1: Spanish presentation still names the refused ".doc" and lists
    // only the accepted formats (legacy .doc is never advertised).
    expect(alert).toHaveTextContent(/no se admite/i);
    expect(alert).toHaveTextContent(/\.doc/);
    expect(screen.getByText("Aún no hay trabajo")).toBeInTheDocument();
  });

  // CORA-80-02: a drop that carries zero files must not touch the staged list.
  it("a zero-file drop preserves the existing staged selection and creates no job", () => {
    render(<App />);
    fireEvent.change(screen.getByLabelText(/seleccionar archivos/i), {
      target: { files: [new File(["sintético"], "sintetico.txt")] },
    });
    expect(screen.getByText("1 archivo seleccionado")).toBeInTheDocument();

    // A drop carrying text but zero files is not a file selection.
    fireEvent.drop(filesSection(), {
      dataTransfer: { files: [], getData: () => "texto arrastrado sin archivos" },
    });

    const list = screen.getByRole("list", { name: "Archivos seleccionados" });
    const items = within(list).getAllByRole("listitem");
    expect(items).toHaveLength(1);
    expect(items[0]).toHaveTextContent("sintetico.txt");
    expect(screen.getByText("1 archivo seleccionado")).toBeInTheDocument();
    expect(screen.getByText("Aún no hay trabajo")).toBeInTheDocument();
  });

  it("a real non-empty drop replaces the draft with the exact dropped files in order", () => {
    render(<App />);
    fireEvent.change(screen.getByLabelText(/seleccionar archivos/i), {
      target: { files: [new File(["previo"], "previo.txt")] },
    });
    expect(screen.getByText("1 archivo seleccionado")).toBeInTheDocument();

    dropFiles([new File(["b"], "doc-b.txt"), new File(["a"], "doc-a.txt")]);

    const list = screen.getByRole("list", { name: "Archivos seleccionados" });
    const items = within(list).getAllByRole("listitem");
    expect(items).toHaveLength(2);
    expect(items[0]).toHaveTextContent("doc-b.txt");
    expect(items[1]).toHaveTextContent("doc-a.txt");
    expect(screen.getByText("2 archivos seleccionados")).toBeInTheDocument();
    expect(screen.getByText("Aún no hay trabajo")).toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// REC-08 F1 (corrective): the composed start-surface refusal is presented in
// Spanish (failure + remedy). The domain/adapter still OWNS every refusal and
// no job is created — these witnesses only falsify English leakage on the
// touched start surface.
// ---------------------------------------------------------------------------
describe("Input start refusal presentation in Spanish (REC-08 #80 F1)", () => {
  function refuseWith(files: File[]): Promise<HTMLElement> {
    const heading = screen.getByRole("heading", { level: 3, name: "Elegir archivos" });
    const section = heading.closest("section");
    if (!section) throw new Error("expected the files card section");
    fireEvent.drop(section, { dataTransfer: { files } });
    fireEvent.click(createButton());
    // The typed refusal arrives after the ASYNC document extraction settles;
    // under load the default 1s query budget is tighter than the extraction
    // itself (same latency rationale as the other async oracles). This only
    // widens the wait, never the assertion.
    return waitFor(() => {
      const alertElement = screen.queryByRole("alert");
      if (alertElement === null) throw new Error("refusal alert not rendered yet");
      return alertElement;
    });
  }

  it("presents the mixed document+structured refusal in Spanish with a remedy", async () => {
    render(<App />);
    const alert = await refuseWith([
      new File(["nota"], "historia.txt"),
      new File(["a,b"], "labs.csv"),
    ]);
    expect(alert).toHaveTextContent(/no se pueden combinar/i);
    expect(alert).toHaveTextContent(/cree un trabajo aparte/i);
    expect(alert).not.toHaveTextContent(/cannot be mixed/i);
    expect(screen.getByText("Aún no hay trabajo")).toBeInTheDocument();
  });

  it("presents the unsupported-extension refusal in Spanish, names the extension and never advertises .doc", async () => {
    render(<App />);
    const alert = await refuseWith([new File(["legacy"], "informe.doc")]);
    expect(alert).toHaveTextContent(/no se admite/i);
    expect(alert).toHaveTextContent(/\.doc/);
    expect(alert).toHaveTextContent(/txt, pdf, docx, csv, xls y xlsx/i);
    expect(alert).not.toHaveTextContent(/unsupported type/i);
    expect(screen.getByText("Aún no hay trabajo")).toBeInTheDocument();
  });

  it("presents the single-document extraction failure in Spanish with a remedy", async () => {
    render(<App />);
    const alert = await refuseWith([new File(["no es un docx válido"], "corrupt.docx")]);
    expect(alert).toHaveTextContent(/no se pudo leer/i);
    expect(alert).toHaveTextContent(/inténtelo de nuevo/i);
    expect(alert).not.toHaveTextContent(/could not be parsed/i);
    expect(screen.getByText("Aún no hay trabajo")).toBeInTheDocument();
  });

  it("presents the empty-input refusal in Spanish with a remedy", async () => {
    render(<App />);
    fireEvent.click(createButton());
    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent(/no hay texto/i);
    expect(alert).not.toHaveTextContent(/pasted text is empty/i);
    expect(screen.getByText("Aún no hay trabajo")).toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// REC-08 evidence 4: quiet routing — no permanent JobKind mapping section.
// ---------------------------------------------------------------------------
describe("Input start quiet routing (REC-08 #80)", () => {
  it("the ordinary start exposes no permanent internal JobKind mapping", () => {
    render(<App />);
    expect(screen.queryByRole("region", { name: "How the job type is chosen" })).toBeNull();
    expect(screen.queryByText("How the job type is chosen")).toBeNull();
    expect(screen.queryByText("Text job")).toBeNull();
    expect(screen.queryByText("Document job")).toBeNull();
    expect(screen.queryByText("Document batch")).toBeNull();
    expect(screen.queryByText("Structured job")).toBeNull();
    // Adding information stays visually primary with concise format help.
    expect(
      screen.getByRole("heading", { level: 2, name: "Nuevo trabajo de privacidad" })
    ).toBeInTheDocument();
    expect(screen.getByText(/documentos \(txt, pdf, docx\)/i)).toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// REC-08 evidence 6: D-019 — no generic input-pipeline override.
// ---------------------------------------------------------------------------
describe("Input start D-019 regression (REC-08 #80)", () => {
  it("introduces no pipeline-override control or alternate routing state", () => {
    render(<App />);
    const main = document.getElementById("main-content") as HTMLElement;
    // No selector/radio/combobox that could choose a processing pipeline.
    expect(within(main).queryByRole("radiogroup")).toBeNull();
    expect(within(main).queryByRole("combobox")).toBeNull();
    expect(within(main).queryByRole("listbox")).toBeNull();
    const body = main.textContent ?? "";
    expect(body).not.toMatch(/process as|pipeline|tratar como|como texto|como documento/i);
    // The deterministic inferJobKind matrix itself is witnessed by the reuse
    // oracle app-v4/src/domain/job.test.ts; this surface only proves that no
    // second routing authority was added on top of it.
  });
});

// ---------------------------------------------------------------------------
// REC-08 evidence 5: Spanish human-purpose policy wording on the start only.
// ---------------------------------------------------------------------------
describe("Input start intended-use wording (REC-08 #80)", () => {
  const FORBIDDEN_CLAIM =
    /anonymous|anonymi[sz]ed|GDPR|LOPDGDD|certified|complian(t|ce)|k-anonymity|differential privacy|research approval/i;

  it("lists the four accepted policies in Spanish human-purpose language derived from the policy seam", () => {
    render(<App />);
    const section = screen.getByRole("region", { name: "Uso previsto" });
    expect(section).toBeInTheDocument();
    const items = within(section).getAllByRole("listitem");
    // Same identity/order authority as the Policy workspace (POLICY_IDS).
    expect(items).toHaveLength(POLICY_IDS.length);
    expect(items[0]).toHaveTextContent("Estándar");
    expect(items[1]).toHaveTextContent("IA externa");
    expect(items[2]).toHaveTextContent("Investigación longitudinal");
    expect(items[3]).toHaveTextContent("Estricta");
    // Human purpose per D-020 semantics, in Spanish.
    expect(section).toHaveTextContent(/nada sale de este dispositivo/i);
    expect(section).toHaveTextContent(/no concede aprobación de investigación/i);
    // No unsupported claims on the touched surface.
    expect(section.textContent ?? "").not.toMatch(FORBIDDEN_CLAIM);
    // Before a job exists no availability is claimed (honest unknown state).
    expect(within(section).queryByText("Disponible")).toBeNull();
    expect(section).toHaveTextContent(/se confirma al crear el trabajo/i);
  });

  it("derives availability from the same authority once a job exists", async () => {
    render(<App />);
    // Before a job exists the start surface claims no availability.
    const startSection = screen.getByRole("region", { name: "Uso previsto" });
    expect(within(startSection).queryByText("Disponible")).toBeNull();
    fireEvent.change(draftTextarea(), { target: { value: "Nota clínica sintética." } });
    fireEvent.click(createButton());
    // Quiet shell (#84): creating a text job lands directly on Review, so the
    // start-surface region is gone by design. The same derived fact (REC-02:
    // every accepted policy is available for a text job) is witnessed through
    // the persistent policy guidance, which reads the identical
    // `buildPolicyGuidance` seam — not a second availability table.
    const guidance = await screen.findByRole("region", { name: "Política de privacidad" });
    // CORA-84-01: the detailed four-policy guidance is on demand behind the
    // disclosure; expand it to read the per-policy availability facts.
    fireEvent.click(screen.getByRole("button", { name: "Guía detallada de políticas" }));
    const list = within(guidance).getByRole("list", { name: "Guía de políticas de privacidad" });
    expect(within(list).getAllByText("Available")).toHaveLength(4);
  });
});
