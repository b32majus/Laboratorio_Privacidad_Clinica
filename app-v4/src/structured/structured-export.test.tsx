import * as fs from "node:fs";
import * as path from "node:path";
import { fileURLToPath } from "node:url";
import * as vm from "node:vm";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import "@testing-library/jest-dom/vitest";

import { ExportStep } from "../export/ExportStep";
import type { Job } from "../domain/job";
import { CONFIDENTIAL_AUDIT_WARNING_LINE } from "../output/confidential-audit-serializer";
import {
  createStructuredConfiguration,
  overrideColumnClass,
  overrideColumnAction,
  setStructuredDateRole,
} from "./configuration";
import type { StructuredGrid } from "./grid";
import { buildStructuredTransformPlan } from "./transform-plan";
import { prepareStructuredOutput } from "./transformed-dataset";
import { resetXlsxLoaderForTests, type XlsxCell, type XlsxLib } from "./xlsx-loader";
import { applyDecision, createReviewSession } from "../review/review-domain";
import type { StructuredFreeTextState } from "./free-text";

/**
 * REC-04 WU-C oracles for the structured export surface: Safe CSV + XLSX
 * download directly, while every structured Confidential download (TXT and
 * XLSX) requires the deliberate in-zone confirmation first.
 *
 * Seams under test: the ExportStep structured buttons/confirmation (DOM
 * roles + captured downloads) and the XLSX bytes read back with the
 * GOVERNED SheetJS runtime (same vm pattern as `excel.test.ts`).
 */

const repoLibPath = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
  "..",
  "..",
  "lib",
  "xlsx.full.min.js"
);

function loadGovernedSheetJs(): XlsxLib {
  const code = fs.readFileSync(repoLibPath, "utf8");
  const context: Record<string, unknown> = { window: {}, console };
  vm.createContext(context);
  vm.runInContext(`${code}\n;this.__loaded = window.XLSX;`, context);
  const lib = context.__loaded as XlsxLib;
  if (!lib || typeof lib.read !== "function") {
    throw new Error("Governed SheetJS bundle did not load in the test sandbox.");
  }
  return lib;
}

const XLSX = loadGovernedSheetJs();

function seedWindow(): void {
  window.XLSX = XLSX;
}

const GRID: StructuredGrid = {
  headers: ["Paciente", "Fecha_Visita", "Fecha_Nacimiento", "Diagnostico", "CampoLibre"],
  rows: [
    ["P-001", "2023-01-10", "1954-03-12", "Gripe A", "nota libre"],
    ["P-002", "2023-03-15", "1980-07-04", "Fractura", "seguimiento"],
  ],
};

const JOB_SEED = "hardening-wua3";

function readyInput() {
  let configuration = createStructuredConfiguration(GRID, { selectedPatientIdColumn: "Paciente" });
  configuration = setStructuredDateRole(configuration, 1, "visit");
  configuration = setStructuredDateRole(configuration, 2, "birth");
  configuration = overrideColumnClass(configuration, 4, "insensitive");
  const plan = buildStructuredTransformPlan(configuration, {
    policyId: "standard",
    jobSeed: JOB_SEED,
  });
  return { configuration, plan, preparation: prepareStructuredOutput(configuration, plan) };
}

function blockedInput() {
  const configuration = createStructuredConfiguration(GRID, {
    selectedPatientIdColumn: "Paciente",
  });
  const plan = buildStructuredTransformPlan(configuration, {
    policyId: "standard",
    jobSeed: JOB_SEED,
  });
  return {
    configuration,
    plan,
    preparation: prepareStructuredOutput(configuration, plan),
  };
}

function jobFor(
  id: string,
  ready: boolean,
  confidentialReady = ready,
  policyId: Job["policyId"] = "standard"
): Job {
  return {
    kind: "structured",
    id,
    policyId,
    outputs: { safeOutputReady: ready, confidentialAuditReady: confidentialReady },
    errors: [],
  } as unknown as Job;
}

type CapturedDownload = { readonly fileName: string; readonly blob: Blob };

function captureDownloads(): { downloads: CapturedDownload[]; restore(): void } {
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

async function textOf(download: CapturedDownload | undefined): Promise<string> {
  if (!download) throw new Error("expected a captured download");
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsText(download.blob);
  });
}

async function bytesOf(download: CapturedDownload | undefined): Promise<Uint8Array> {
  if (!download) throw new Error("expected a captured download");
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(new Uint8Array(reader.result as ArrayBuffer));
    reader.onerror = () => reject(reader.error);
    reader.readAsArrayBuffer(download.blob);
  });
}

function readWorkbook(bytes: Uint8Array): {
  readonly sheetNames: readonly string[];
  flat(name: string): string;
  cell(name: string, address: string): XlsxCell | undefined;
} {
  const workbook = XLSX.read(bytes, { type: "array", cellDates: false });
  return {
    sheetNames: workbook.SheetNames,
    flat(name: string): string {
      return Object.values(workbook.Sheets[name] ?? {})
        .map((cell) => String((cell as XlsxCell)?.v ?? ""))
        .join("\n");
    },
    cell(name: string, address: string): XlsxCell | undefined {
      return workbook.Sheets[name]?.[address] as XlsxCell | undefined;
    },
  };
}

const SAFE_CSV_BUTTON = "Descargar salida estructurada segura (.csv)";
const SAFE_XLSX_BUTTON = "Descargar salida estructurada segura (.xlsx)";
const CONF_TXT_BUTTON = "Descargar auditoría confidencial estructurada (.txt)";
const CONF_XLSX_BUTTON = "Descargar auditoría confidencial estructurada (.xlsx)";

afterEach(() => {
  cleanup();
  delete window.XLSX;
  resetXlsxLoaderForTests();
  // The lazy loader appends its governed <script> and never removes it;
  // drop it so a later test cannot dispatch `load` on a stale element.
  for (const script of Array.from(document.head.querySelectorAll("script"))) {
    if (script.getAttribute("src") === "/vendor/xlsx.full.min.js") script.remove();
  }
  vi.restoreAllMocks();
});

describe("ExportStep — structured", () => {
  it("warns for current process-as-text kept originals, never for another Job/policy/preparation", async () => {
    const grid: StructuredGrid = { headers: ["NHC", "Notas"], rows: [["P-001", "DNI 12345678A"]] };
    const configuration = overrideColumnAction(
      createStructuredConfiguration(grid),
      1,
      "process-as-text"
    );
    const plan = buildStructuredTransformPlan(configuration, {
      policyId: "standard",
      jobSeed: "job-free-text",
    });
    const pending = createReviewSession({
      originalText: "DNI 12345678A",
      detections: [{ type: "IDENTIFICADOR", start: 4, end: 13, proposed: "" }],
    });
    const session = applyDecision(pending, pending.detections[0].id, "restored");
    const state: StructuredFreeTextState = {
      kind: "structured-free-text-state",
      jobId: "job-free-text",
      policyId: "standard",
      cells: [
        {
          ok: true,
          cell: { columnIndex: 1, rowIndex: 0, header: "Notas", original: "DNI 12345678A" },
          session,
        },
      ],
    };
    const structured = {
      configuration,
      plan,
      preparation: prepareStructuredOutput(configuration, plan, { freeText: state }),
    };
    expect(structured.preparation.status).toBe("ready");
    const job = jobFor("job-free-text", true);
    const capture = captureDownloads();
    try {
      const view = render(
        <ExportStep job={job} review={null} structured={structured} structuredFreeText={state} />
      );
      const warning = screen.getByRole("region", {
        name: "Originales conservados deliberadamente",
      });
      expect(warning).toHaveTextContent("Originales conservados: 1");
      expect(warning).toHaveTextContent("IDENTIFICADOR: 1");
      expect(warning).not.toHaveTextContent("12345678A");
      expect(
        warning.compareDocumentPosition(screen.getByRole("button", { name: SAFE_CSV_BUTTON })) &
          Node.DOCUMENT_POSITION_FOLLOWING
      ).toBeTruthy();
      expect(capture.downloads).toHaveLength(0);
      fireEvent.click(screen.getByRole("button", { name: SAFE_CSV_BUTTON }));
      expect(await textOf(capture.downloads[0])).toContain("DNI 12345678A");
      expect(screen.getByRole("button", { name: CONF_TXT_BUTTON })).toBeEnabled();
      for (const next of [
        { job: jobFor("other-job", true), structured, structuredFreeText: state },
        { job: { ...job, policyId: "strict" as const }, structured, structuredFreeText: state },
        {
          job,
          structured: { ...structured, preparation: prepareStructuredOutput(configuration, plan) },
          structuredFreeText: state,
        },
        { job, structured: readyInput(), structuredFreeText: state },
        { job, structured, structuredFreeText: null },
      ]) {
        view.rerender(<ExportStep {...next} review={null} />);
        expect(
          screen.queryByRole("region", { name: "Originales conservados deliberadamente" })
        ).not.toBeInTheDocument();
      }
    } finally {
      capture.restore();
    }
  });
  it("produces a Safe CSV without originals and a separate marked Confidential Audit", async () => {
    seedWindow();
    const capture = captureDownloads();
    const structured = readyInput();
    render(<ExportStep job={jobFor("job-1", true)} review={null} structured={structured} />);
    try {
      const safeButton = screen.getByRole("button", { name: SAFE_CSV_BUTTON });
      const auditButton = screen.getByRole("button", { name: CONF_TXT_BUTTON });
      expect(safeButton).toBeEnabled();
      expect(auditButton).toBeEnabled();

      fireEvent.click(safeButton);
      const safeCsv = await textOf(capture.downloads[0]);
      expect(capture.downloads[0].fileName).toBe("salida-estructurada-segura.csv");
      expect(safeCsv.split("\n")[0]).toBe(
        "ID_ESTUDIO,Fecha_Visita,Fecha_Nacimiento,Diagnostico,CampoLibre"
      );
      expect(safeCsv).not.toContain("P-001");
      // D-021: Sensitive defaults to Keep, so the kept clinical attribute
      // stays in Safe output verbatim; identity and exact dates never do.
      expect(safeCsv).toContain("Gripe A");
      expect(safeCsv).not.toContain("1954-03-12");

      // WU-C: the first Confidential click downloads nothing — it opens the
      // deliberate in-zone confirmation instead.
      fireEvent.click(auditButton);
      expect(capture.downloads).toHaveLength(1);
      const confirm = screen.getByRole("button", { name: /confirmar descarga confidencial/i });
      expect(confirm).toBeInTheDocument();
      fireEvent.click(confirm);
      await waitFor(() => expect(capture.downloads).toHaveLength(2));
      const audit = await textOf(capture.downloads[1]);
      expect(capture.downloads[1].fileName).toBe("auditoria-confidencial-estructurada.txt");
      expect(audit.startsWith(CONFIDENTIAL_AUDIT_WARNING_LINE)).toBe(true);
      expect(audit).toContain("P-001");
      // Kept columns carry no correspondence: the audit holds Study-ID and
      // date/age originals, never the kept diagnosis.
      expect(audit).not.toContain("Gripe A");
    } finally {
      capture.restore();
    }
  });

  it("fails closed: both actions are disabled with the exact block reasons", () => {
    const structured = blockedInput();
    render(<ExportStep job={jobFor("job-1", false)} review={null} structured={structured} />);
    expect(screen.getByRole("button", { name: SAFE_CSV_BUTTON })).toBeDisabled();
    expect(screen.getByRole("button", { name: SAFE_XLSX_BUTTON })).toBeDisabled();
    expect(screen.getByRole("button", { name: CONF_TXT_BUTTON })).toBeDisabled();
    expect(screen.getByRole("button", { name: CONF_XLSX_BUTTON })).toBeDisabled();
    expect(screen.getByRole("alert")).toHaveTextContent(/requiere revisión/i);
  });

  it("keeps the Confidential download blocked when only confidentialAuditReady is false", () => {
    const structured = readyInput();
    render(<ExportStep job={jobFor("job-1", true, false)} review={null} structured={structured} />);
    expect(screen.getByRole("button", { name: SAFE_CSV_BUTTON })).toBeEnabled();
    expect(screen.getByRole("button", { name: SAFE_XLSX_BUTTON })).toBeEnabled();
    expect(screen.getByRole("button", { name: CONF_TXT_BUTTON })).toBeDisabled();
    expect(screen.getByRole("button", { name: CONF_XLSX_BUTTON })).toBeDisabled();
    expect(screen.getByRole("status")).toHaveTextContent(
      "La auditoría confidencial todavía no está disponible para este trabajo."
    );
  });
});

describe("ExportStep — structured Safe XLSX (H-28)", () => {
  it("downloads Safe XLSX directly when ready, with exact Safe content and no originals", async () => {
    seedWindow();
    const capture = captureDownloads();
    const structured = readyInput();
    render(<ExportStep job={jobFor("job-1", true)} review={null} structured={structured} />);
    try {
      fireEvent.click(screen.getByRole("button", { name: SAFE_XLSX_BUTTON }));
      // No confirmation is ever involved for Safe downloads.
      expect(
        screen.queryByRole("button", { name: /confirmar descarga confidencial/i })
      ).not.toBeInTheDocument();
      await waitFor(() => expect(capture.downloads).toHaveLength(1));
      expect(capture.downloads[0].fileName).toBe("salida-estructurada-segura.xlsx");

      const workbook = readWorkbook(await bytesOf(capture.downloads[0]));
      expect(workbook.sheetNames[0]).toBe("Data");
      expect(workbook.cell("Data", "A1")?.v).toBe("ID_ESTUDIO");
      expect(workbook.cell("Data", "A2")?.v).toBe("PAC_001");
      const flat = workbook.flat("Data");
      expect(flat).not.toContain("P-001");
      expect(flat).not.toContain("1954-03-12");
      expect(flat).toContain("Gripe A");
    } finally {
      capture.restore();
    }
  });
});

describe("ExportStep — structured Confidential confirmation (H-42 slice)", () => {
  it("first Confidential TXT click downloads nothing; Cancel downloads nothing", async () => {
    seedWindow();
    const capture = captureDownloads();
    const structured = readyInput();
    render(<ExportStep job={jobFor("job-1", true)} review={null} structured={structured} />);
    try {
      fireEvent.click(screen.getByRole("button", { name: CONF_TXT_BUTTON }));
      expect(capture.downloads).toHaveLength(0);
      const confirmation = screen.getByRole("group", { name: /confirmar descarga confidencial/i });
      expect(confirmation).toHaveTextContent(/identificable/i);
      expect(confirmation).toHaveTextContent(/interno autorizado/i);

      fireEvent.click(screen.getByRole("button", { name: /cancelar descarga confidencial/i }));
      expect(capture.downloads).toHaveLength(0);
      expect(
        screen.queryByRole("group", { name: /confirmar descarga confidencial/i })
      ).not.toBeInTheDocument();
    } finally {
      capture.restore();
    }
  });

  it("explicit Confirm downloads exactly the selected Confidential format once, then resets", async () => {
    seedWindow();
    const capture = captureDownloads();
    const structured = readyInput();
    render(<ExportStep job={jobFor("job-1", true)} review={null} structured={structured} />);
    try {
      fireEvent.click(screen.getByRole("button", { name: CONF_XLSX_BUTTON }));
      expect(capture.downloads).toHaveLength(0);
      fireEvent.click(screen.getByRole("button", { name: /confirmar descarga confidencial/i }));
      await waitFor(() => expect(capture.downloads).toHaveLength(1));
      expect(capture.downloads[0].fileName).toBe("auditoria-confidencial-estructurada.xlsx");
      // The confirmation resets after confirm: no panel, no second download.
      expect(
        screen.queryByRole("group", { name: /confirmar descarga confidencial/i })
      ).not.toBeInTheDocument();

      const workbook = readWorkbook(await bytesOf(capture.downloads[0]));
      expect(workbook.sheetNames[0]).toBe("READ_FIRST");
      expect(workbook.flat("READ_FIRST")).toContain(CONFIDENTIAL_AUDIT_WARNING_LINE);
      expect(workbook.flat("Correspondence")).toContain("P-001");
      expect(workbook.flat("Correspondence")).not.toContain("Gripe A");
    } finally {
      capture.restore();
    }
  });

  it("confirmation resets on Job change and on blocked/stale preparation", async () => {
    seedWindow();
    const capture = captureDownloads();
    const structured = readyInput();
    const view = render(
      <ExportStep job={jobFor("job-1", true)} review={null} structured={structured} />
    );
    try {
      fireEvent.click(screen.getByRole("button", { name: CONF_TXT_BUTTON }));
      expect(
        screen.getByRole("group", { name: /confirmar descarga confidencial/i })
      ).toBeInTheDocument();

      // Another Job clears the transient confirmation (and downloads nothing).
      view.rerender(
        <ExportStep job={jobFor("job-2", true)} review={null} structured={structured} />
      );
      expect(
        screen.queryByRole("group", { name: /confirmar descarga confidencial/i })
      ).not.toBeInTheDocument();
      expect(capture.downloads).toHaveLength(0);

      // A newly blocked/stale preparation clears it too.
      fireEvent.click(screen.getByRole("button", { name: CONF_TXT_BUTTON }));
      expect(
        screen.getByRole("group", { name: /confirmar descarga confidencial/i })
      ).toBeInTheDocument();
      const blocked = blockedInput();
      view.rerender(<ExportStep job={jobFor("job-2", false)} review={null} structured={blocked} />);
      expect(
        screen.queryByRole("group", { name: /confirmar descarga confidencial/i })
      ).not.toBeInTheDocument();
      expect(capture.downloads).toHaveLength(0);
    } finally {
      capture.restore();
    }
  });
});

describe("ExportStep — structured Confidential just-in-time guard (SPEC-1)", () => {
  function findInjectedXlsxScript(): HTMLScriptElement | null {
    const found = Array.from(document.head.querySelectorAll("script")).find(
      (element) => element.getAttribute("src") === "/vendor/xlsx.full.min.js"
    );
    return found instanceof HTMLScriptElement ? found : null;
  }

  /**
   * Resolve the real lazy SheetJS load that {@link loadXlsx} opened when no
   * library was pre-seeded. Until this runs the handler is genuinely
   * suspended after `await loadXlsx()`, which is the exact async generation
   * window REC-04 SPEC-1 must guard.
   */
  async function completeXlsxGenerationWindow(script: HTMLScriptElement): Promise<void> {
    await act(async () => {
      window.XLSX = XLSX;
      script.dispatchEvent(new Event("load"));
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
  }

  it("produces no stale Confidential XLSX when the preparation stops being ready during generation", async () => {
    const capture = captureDownloads();
    resetXlsxLoaderForTests();
    const structured = readyInput();
    const view = render(
      <ExportStep job={jobFor("job-1", true)} review={null} structured={structured} />
    );
    try {
      fireEvent.click(screen.getByRole("button", { name: CONF_XLSX_BUTTON }));
      // Explicit Confirm starts the real generation; the handler suspends on
      // the lazy load, so no bytes exist yet.
      fireEvent.click(screen.getByRole("button", { name: /confirmar descarga confidencial/i }));
      const injection = findInjectedXlsxScript();
      expect(injection).not.toBeNull();
      expect(capture.downloads).toHaveLength(0);

      // While that window is open the preparation becomes blocked/stale.
      const blocked = blockedInput();
      view.rerender(<ExportStep job={jobFor("job-1", true)} review={null} structured={blocked} />);
      expect(
        screen.queryByRole("group", { name: /confirmar descarga confidencial/i })
      ).not.toBeInTheDocument();

      // The now-irrelevant generation completes: no stale artifact may be
      // produced and nothing may be downloaded.
      await completeXlsxGenerationWindow(injection as HTMLScriptElement);
      expect(capture.downloads).toHaveLength(0);
      expect(
        screen.queryByRole("group", { name: /confirmar descarga confidencial/i })
      ).not.toBeInTheDocument();
    } finally {
      capture.restore();
      delete window.XLSX;
      resetXlsxLoaderForTests();
    }
  });

  it("produces no stale Confidential XLSX when the Job changes during generation", async () => {
    const capture = captureDownloads();
    resetXlsxLoaderForTests();
    const structured = readyInput();
    const view = render(
      <ExportStep job={jobFor("job-1", true)} review={null} structured={structured} />
    );
    try {
      fireEvent.click(screen.getByRole("button", { name: CONF_XLSX_BUTTON }));
      fireEvent.click(screen.getByRole("button", { name: /confirmar descarga confidencial/i }));
      const injection = findInjectedXlsxScript();
      expect(injection).not.toBeNull();
      expect(capture.downloads).toHaveLength(0);

      // Another Job arrives while the generation window is open.
      view.rerender(
        <ExportStep job={jobFor("job-2", true)} review={null} structured={structured} />
      );
      expect(
        screen.queryByRole("group", { name: /confirmar descarga confidencial/i })
      ).not.toBeInTheDocument();

      await completeXlsxGenerationWindow(injection as HTMLScriptElement);
      expect(capture.downloads).toHaveLength(0);
      expect(
        screen.queryByRole("group", { name: /confirmar descarga confidencial/i })
      ).not.toBeInTheDocument();
    } finally {
      capture.restore();
      delete window.XLSX;
      resetXlsxLoaderForTests();
    }
  });
});

describe("ExportStep — structured Safe XLSX just-in-time guard (CORA-AUDIT-REC04-01)", () => {
  function findInjectedXlsxScript(): HTMLScriptElement | null {
    const found = Array.from(document.head.querySelectorAll("script")).find(
      (element) => element.getAttribute("src") === "/vendor/xlsx.full.min.js"
    );
    return found instanceof HTMLScriptElement ? found : null;
  }

  /**
   * Resolve the real lazy SheetJS load that {@link loadXlsx} opened when no
   * library was pre-seeded. Until this runs the Safe XLSX handler is
   * genuinely suspended after `await loadXlsx()`, which is the exact
   * post-await / pre-download boundary that must revalidate authority.
   */
  async function completeXlsxGenerationWindow(script: HTMLScriptElement): Promise<void> {
    await act(async () => {
      window.XLSX = XLSX;
      script.dispatchEvent(new Event("load"));
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
  }

  it("produces no stale Safe XLSX when the preparation stops being ready during generation", async () => {
    const capture = captureDownloads();
    resetXlsxLoaderForTests();
    const structured = readyInput();
    const view = render(
      <ExportStep job={jobFor("job-1", true)} review={null} structured={structured} />
    );
    try {
      // Safe downloads directly: no confirmation is involved.
      fireEvent.click(screen.getByRole("button", { name: SAFE_XLSX_BUTTON }));
      const injection = findInjectedXlsxScript();
      expect(injection).not.toBeNull();
      expect(capture.downloads).toHaveLength(0);

      // While the lazy-load window is open the preparation becomes blocked.
      const blocked = blockedInput();
      view.rerender(<ExportStep job={jobFor("job-1", true)} review={null} structured={blocked} />);

      // The now-irrelevant generation completes: no stale artifact may be
      // produced and nothing may be downloaded.
      await completeXlsxGenerationWindow(injection as HTMLScriptElement);
      expect(capture.downloads).toHaveLength(0);
    } finally {
      capture.restore();
      delete window.XLSX;
      resetXlsxLoaderForTests();
    }
  });

  it("produces no stale Safe XLSX when the Job changes during generation", async () => {
    const capture = captureDownloads();
    resetXlsxLoaderForTests();
    const structured = readyInput();
    const view = render(
      <ExportStep job={jobFor("job-1", true)} review={null} structured={structured} />
    );
    try {
      fireEvent.click(screen.getByRole("button", { name: SAFE_XLSX_BUTTON }));
      const injection = findInjectedXlsxScript();
      expect(injection).not.toBeNull();
      expect(capture.downloads).toHaveLength(0);

      // Another Job arrives while the generation window is open.
      view.rerender(
        <ExportStep job={jobFor("job-2", true)} review={null} structured={structured} />
      );

      await completeXlsxGenerationWindow(injection as HTMLScriptElement);
      expect(capture.downloads).toHaveLength(0);
    } finally {
      capture.restore();
      delete window.XLSX;
      resetXlsxLoaderForTests();
    }
  });
});

/**
 * REC12-GAP-06 (issue #92 Stage B2, handoff C-087 2026-10-14): real Safe
 * CSV/XLSX BYTES under the explicit `external-ai` policy (Job, plan and
 * preparation all `external-ai`). Synthetic data only; no production code,
 * operator, classification or policy surface is touched by these oracles.
 *
 * Case A (positive T19 control): the birth column in the exported bytes must
 * carry the banded age AT THE EVENT (visit date reference, SPEC §10), never
 * the exact birth date, the birth month, nor an age banded at the current
 * date.
 *
 * Case B (D-021 material boundary, HUMAN-RATIFIED 2026-10-14): the exact
 * per-column/per-row/per-type `Edad_Num` cells are asserted POSITIVELY in the
 * exported bytes. The human decision of 2026-10-14 (CURRENT_DECISIONS.md,
 * "D-021 clarification — explicit numeric ages in structured tables",
 * REC-12 #92/B2) ratified the EXACT RETENTION of insensitive/keep numeric
 * ages 34/35/41 in Safe CSV and Safe XLSX under the `external-ai` policy, so
 * the assertions below demand those exact cells (value and XLSX numeric
 * type) rather than falsifying them. History is preserved: commit 443f34e
 * originally registered and reproduced these tests as a red "material
 * witness" under the previous GAP-06 interpretation. This exact retention is
 * NOT anonymization proof and grants NO permission to share the data outside
 * the controlled environment.
 */
describe("ExportStep — structured Safe exports under external-ai (REC12-GAP-06)", () => {
  /** Splits an RFC-4180-simple Safe CSV line set (no quoted delimiters here). */
  function parseCsvRows(csv: string): readonly (readonly string[])[] {
    return csv.split("\n").map((line) => line.split(","));
  }

  function externalAiAgeBandedInput() {
    let configuration = createStructuredConfiguration(GRID, {
      selectedPatientIdColumn: "Paciente",
    });
    configuration = setStructuredDateRole(configuration, 1, "visit");
    configuration = setStructuredDateRole(configuration, 2, "birth");
    configuration = overrideColumnClass(configuration, 4, "insensitive");
    const plan = buildStructuredTransformPlan(configuration, {
      policyId: "external-ai",
      jobSeed: "gap06-external-ai-a",
    });
    return { configuration, plan, preparation: prepareStructuredOutput(configuration, plan) };
  }

  it("case A — Safe CSV and XLSX band the birth column at the event date under external-ai", async () => {
    seedWindow();
    const structured = externalAiAgeBandedInput();
    // The whole authority chain is explicitly external-ai (Job, plan, prep).
    expect(structured.plan.policyId).toBe("external-ai");
    expect(structured.preparation.status).toBe("ready");
    const job = jobFor("job-gap06-case-a", true, true, "external-ai");
    expect(job.policyId).toBe("external-ai");
    const capture = captureDownloads();
    try {
      render(<ExportStep job={job} review={null} structured={structured} />);

      // Safe CSV bytes.
      fireEvent.click(screen.getByRole("button", { name: SAFE_CSV_BUTTON }));
      const rows = parseCsvRows(await textOf(capture.downloads[0]));
      expect(rows[0]).toEqual([
        "ID_ESTUDIO",
        "Fecha_Visita",
        "Fecha_Nacimiento",
        "Diagnostico",
        "CampoLibre",
      ]);
      // Identity is substituted (ID_ESTUDIO), never carried.
      expect(rows[1][0]).toBe("PAC_001");
      expect(rows[2][0]).toBe("PAC_002");
      // Exact per-column/per-row birth-cell assertions: banded age AT THE
      // EVENT (68 / 42 completed years at the synthetic visit dates). The
      // P-001 row also falsifies "banded at the current date": consulting
      // today would read "70–79 años" from 2024-03-12 until 2034-03-11.
      expect(rows[1][2]).toBe("60–69 años");
      expect(rows[2][2]).toBe("40–49 años");
      expect(rows[1][2]).not.toBe("70–79 años");
      // Not the exact birth date, not the birth month (column-exact by the
      // equalities above; belt-and-braces row-level non-retention here).
      expect(rows[1]).not.toContain("1954-03-12");
      expect(rows[2]).not.toContain("1980-07-04");
      expect(rows[1][2]).not.toContain("1954-03");
      expect(rows[2][2]).not.toContain("1980-07");

      // Safe XLSX bytes (governed SheetJS, real serializer).
      fireEvent.click(screen.getByRole("button", { name: SAFE_XLSX_BUTTON }));
      await waitFor(() => expect(capture.downloads).toHaveLength(2));
      expect(capture.downloads[1].fileName).toBe("salida-estructurada-segura.xlsx");
      const workbook = readWorkbook(await bytesOf(capture.downloads[1]));
      expect(workbook.sheetNames[0]).toBe("Data");
      expect(workbook.cell("Data", "C1")?.v).toBe("Fecha_Nacimiento");
      expect(workbook.cell("Data", "C2")?.v).toBe("60–69 años");
      expect(workbook.cell("Data", "C3")?.v).toBe("40–49 años");
      expect(workbook.cell("Data", "C2")?.v).not.toBe("70–79 años");
      expect(workbook.flat("Data")).not.toContain("1954-03-12");
      expect(workbook.flat("Data")).not.toContain("1980-07-04");
    } finally {
      capture.restore();
    }
  });

  // Same fixture shape as the accepted `output-preparation.test.ts` grid
  // (NHC/Edad_Num/Flag/Diagnostico with numeric ages 34, 35, 41), but the
  // plan/preparation policy is explicitly `external-ai`.
  const GAP06_EDAD_GRID: StructuredGrid = {
    headers: ["NHC", "Edad_Num", "Flag", "Diagnostico"],
    rows: [
      ["P-001", 34, true, "Gripe A"],
      ["P-001", 35, false, "Fractura"],
      ["P-002", 41, true, "Gripe A"],
    ],
  };

  function externalAiEdadNumInput() {
    let configuration = createStructuredConfiguration(GAP06_EDAD_GRID, {
      selectedPatientIdColumn: "NHC",
    });
    configuration = overrideColumnClass(configuration, 1, "insensitive");
    configuration = overrideColumnClass(configuration, 2, "insensitive");
    configuration = overrideColumnClass(configuration, 3, "insensitive");
    const plan = buildStructuredTransformPlan(configuration, {
      policyId: "external-ai",
      jobSeed: "gap06-external-ai-b",
    });
    return { configuration, plan, preparation: prepareStructuredOutput(configuration, plan) };
  }

  it("case B — Safe CSV retains explicitly kept numeric ages under external-ai", async () => {
    const structured = externalAiEdadNumInput();
    expect(structured.plan.policyId).toBe("external-ai");
    expect(structured.preparation.status).toBe("ready");
    const job = jobFor("job-gap06-case-b", true, true, "external-ai");
    expect(job.policyId).toBe("external-ai");
    const capture = captureDownloads();
    try {
      render(<ExportStep job={job} review={null} structured={structured} />);
      fireEvent.click(screen.getByRole("button", { name: SAFE_CSV_BUTTON }));
      const rows = parseCsvRows(await textOf(capture.downloads[0]));
      expect(capture.downloads).toHaveLength(1);
      expect(capture.downloads[0].fileName).toBe("salida-estructurada-segura.csv");
      // Column + row exactness (never a whole-file substring scan).
      expect(rows[0]).toEqual(["ID_ESTUDIO", "Edad_Num", "Flag", "Diagnostico"]);
      expect(rows[1][0]).toBe("PAC_001");
      expect(rows[2][0]).toBe("PAC_001");
      expect(rows[3][0]).toBe("PAC_002");
      // HUMAN DECISION 2026-10-14 (REC12-GAP-06 / D-021 clarification): the
      // exact numeric ages 34/35/41 configured as insensitive/keep MUST be
      // retained verbatim in Safe CSV under `external-ai`, so these are
      // positive exact-cell assertions per COLUMN and ROW. This retention is
      // not anonymization proof and does not permit sharing the data outside
      // the controlled environment. History: commit 443f34e originally
      // registered and reproduced this witness as a red falsifying test.
      expect.soft(rows[1][1], "CSV Edad_Num cell row 1 (original 34) under external-ai").toBe("34");
      expect.soft(rows[2][1], "CSV Edad_Num cell row 2 (original 35) under external-ai").toBe("35");
      expect.soft(rows[3][1], "CSV Edad_Num cell row 3 (original 41) under external-ai").toBe("41");
    } finally {
      capture.restore();
    }
  });

  it("case B — Safe XLSX retains typed numeric ages under external-ai", async () => {
    seedWindow();
    const structured = externalAiEdadNumInput();
    expect(structured.plan.policyId).toBe("external-ai");
    expect(structured.preparation.status).toBe("ready");
    const job = jobFor("job-gap06-case-b-xlsx", true, true, "external-ai");
    expect(job.policyId).toBe("external-ai");
    const capture = captureDownloads();
    try {
      render(<ExportStep job={job} review={null} structured={structured} />);
      fireEvent.click(screen.getByRole("button", { name: SAFE_XLSX_BUTTON }));
      await waitFor(() => expect(capture.downloads).toHaveLength(1));
      const workbook = readWorkbook(await bytesOf(capture.downloads[0]));
      expect(workbook.sheetNames[0]).toBe("Data");
      // Column + row exactness: B is Edad_Num; rows 2..4 are PAC_001, PAC_001,
      // PAC_002.
      expect(workbook.cell("Data", "B1")?.v).toBe("Edad_Num");
      expect(workbook.cell("Data", "A2")?.v).toBe("PAC_001");
      expect(workbook.cell("Data", "A3")?.v).toBe("PAC_001");
      expect(workbook.cell("Data", "A4")?.v).toBe("PAC_002");
      // HUMAN DECISION 2026-10-14 (REC12-GAP-06 / D-021 clarification): the
      // exact numeric ages 34/35/41 configured as insensitive/keep MUST be
      // retained as true typed numbers (cell type "n") per COLUMN, ROW and
      // TYPE in Safe XLSX under `external-ai`, so these are positive exact
      // assertions. This retention is not anonymization proof and does not
      // permit sharing the data outside the controlled environment. History:
      // commit 443f34e originally registered and reproduced this witness as
      // a red falsifying test.
      expect
        .soft(workbook.cell("Data", "B2")?.t, "XLSX Edad_Num cell type row 1 under external-ai")
        .toBe("n");
      expect
        .soft(
          workbook.cell("Data", "B2")?.v,
          "XLSX Edad_Num cell value row 1 (original 34) under external-ai"
        )
        .toBe(34);
      expect
        .soft(workbook.cell("Data", "B3")?.t, "XLSX Edad_Num cell type row 2 under external-ai")
        .toBe("n");
      expect
        .soft(
          workbook.cell("Data", "B3")?.v,
          "XLSX Edad_Num cell value row 2 (original 35) under external-ai"
        )
        .toBe(35);
      expect
        .soft(workbook.cell("Data", "B4")?.t, "XLSX Edad_Num cell type row 3 under external-ai")
        .toBe("n");
      expect
        .soft(
          workbook.cell("Data", "B4")?.v,
          "XLSX Edad_Num cell value row 3 (original 41) under external-ai"
        )
        .toBe(41);
    } finally {
      capture.restore();
    }
  });
});
