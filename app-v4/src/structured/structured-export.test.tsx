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
  setStructuredDateRole,
} from "./configuration";
import type { StructuredGrid } from "./grid";
import { buildStructuredTransformPlan } from "./transform-plan";
import { prepareStructuredOutput } from "./transformed-dataset";
import { resetXlsxLoaderForTests, type XlsxCell, type XlsxLib } from "./xlsx-loader";

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

function jobFor(id: string, ready: boolean, confidentialReady = ready): Job {
  return {
    kind: "structured",
    id,
    policyId: "standard",
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

const SAFE_CSV_BUTTON = "Download Safe Structured Output (.csv)";
const SAFE_XLSX_BUTTON = "Download Safe Structured Output (.xlsx)";
const CONF_TXT_BUTTON = "Download Structured Confidential Audit (.txt)";
const CONF_XLSX_BUTTON = "Download Structured Confidential Audit (.xlsx)";

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
      expect(capture.downloads[0].fileName).toBe("safe-structured-output.csv");
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
      const confirm = screen.getByRole("button", { name: /confirm confidential download/i });
      expect(confirm).toBeInTheDocument();
      fireEvent.click(confirm);
      await waitFor(() => expect(capture.downloads).toHaveLength(2));
      const audit = await textOf(capture.downloads[1]);
      expect(capture.downloads[1].fileName).toBe("structured-confidential-audit.txt");
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
    expect(screen.getByRole("alert")).toHaveTextContent(/requires review/);
  });

  it("keeps the Confidential download blocked when only confidentialAuditReady is false", () => {
    const structured = readyInput();
    render(<ExportStep job={jobFor("job-1", true, false)} review={null} structured={structured} />);
    expect(screen.getByRole("button", { name: SAFE_CSV_BUTTON })).toBeEnabled();
    expect(screen.getByRole("button", { name: SAFE_XLSX_BUTTON })).toBeEnabled();
    expect(screen.getByRole("button", { name: CONF_TXT_BUTTON })).toBeDisabled();
    expect(screen.getByRole("button", { name: CONF_XLSX_BUTTON })).toBeDisabled();
    expect(screen.getByRole("status")).toHaveTextContent(
      "Confidential Audit is not available for this job yet."
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
        screen.queryByRole("button", { name: /confirm confidential download/i })
      ).not.toBeInTheDocument();
      await waitFor(() => expect(capture.downloads).toHaveLength(1));
      expect(capture.downloads[0].fileName).toBe("safe-structured-output.xlsx");

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
      const confirmation = screen.getByRole("group", { name: /confidential download/i });
      expect(confirmation).toHaveTextContent(/identifiable/i);
      expect(confirmation).toHaveTextContent(/authorized internal/i);

      fireEvent.click(screen.getByRole("button", { name: /cancel confidential download/i }));
      expect(capture.downloads).toHaveLength(0);
      expect(
        screen.queryByRole("group", { name: /confidential download/i })
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
      fireEvent.click(screen.getByRole("button", { name: /confirm confidential download/i }));
      await waitFor(() => expect(capture.downloads).toHaveLength(1));
      expect(capture.downloads[0].fileName).toBe("structured-confidential-audit.xlsx");
      // The confirmation resets after confirm: no panel, no second download.
      expect(
        screen.queryByRole("group", { name: /confidential download/i })
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
      expect(screen.getByRole("group", { name: /confidential download/i })).toBeInTheDocument();

      // Another Job clears the transient confirmation (and downloads nothing).
      view.rerender(
        <ExportStep job={jobFor("job-2", true)} review={null} structured={structured} />
      );
      expect(
        screen.queryByRole("group", { name: /confidential download/i })
      ).not.toBeInTheDocument();
      expect(capture.downloads).toHaveLength(0);

      // A newly blocked/stale preparation clears it too.
      fireEvent.click(screen.getByRole("button", { name: CONF_TXT_BUTTON }));
      expect(screen.getByRole("group", { name: /confidential download/i })).toBeInTheDocument();
      const blocked = blockedInput();
      view.rerender(<ExportStep job={jobFor("job-2", false)} review={null} structured={blocked} />);
      expect(
        screen.queryByRole("group", { name: /confidential download/i })
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
      fireEvent.click(screen.getByRole("button", { name: /confirm confidential download/i }));
      const injection = findInjectedXlsxScript();
      expect(injection).not.toBeNull();
      expect(capture.downloads).toHaveLength(0);

      // While that window is open the preparation becomes blocked/stale.
      const blocked = blockedInput();
      view.rerender(<ExportStep job={jobFor("job-1", true)} review={null} structured={blocked} />);
      expect(
        screen.queryByRole("group", { name: /confidential download/i })
      ).not.toBeInTheDocument();

      // The now-irrelevant generation completes: no stale artifact may be
      // produced and nothing may be downloaded.
      await completeXlsxGenerationWindow(injection as HTMLScriptElement);
      expect(capture.downloads).toHaveLength(0);
      expect(
        screen.queryByRole("group", { name: /confidential download/i })
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
      fireEvent.click(screen.getByRole("button", { name: /confirm confidential download/i }));
      const injection = findInjectedXlsxScript();
      expect(injection).not.toBeNull();
      expect(capture.downloads).toHaveLength(0);

      // Another Job arrives while the generation window is open.
      view.rerender(
        <ExportStep job={jobFor("job-2", true)} review={null} structured={structured} />
      );
      expect(
        screen.queryByRole("group", { name: /confidential download/i })
      ).not.toBeInTheDocument();

      await completeXlsxGenerationWindow(injection as HTMLScriptElement);
      expect(capture.downloads).toHaveLength(0);
      expect(
        screen.queryByRole("group", { name: /confidential download/i })
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
