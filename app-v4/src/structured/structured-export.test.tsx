import { cleanup, fireEvent, render, screen } from "@testing-library/react";
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

/**
 * HARDEN-01 WU-A3 oracles for the structured export surface: Safe CSV and
 * Confidential Audit are separate, the blocked state is explicit, and the Safe
 * CSV carries no original identifier/sensitive values.
 */
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

function jobFor(ready: boolean): Job {
  return {
    kind: "structured",
    id: "job-1",
    policyId: "standard",
    outputs: { safeOutputReady: ready, confidentialAuditReady: ready },
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

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("ExportStep — structured", () => {
  it("produces a Safe CSV without originals and a separate marked Confidential Audit", async () => {
    const capture = captureDownloads();
    const structured = readyInput();
    render(<ExportStep job={jobFor(true)} review={null} structured={structured} />);
    try {
      const safeButton = screen.getByRole("button", {
        name: "Download Safe Structured Output (.csv)",
      });
      const auditButton = screen.getByRole("button", {
        name: "Download Structured Confidential Audit (.txt)",
      });
      expect(safeButton).toBeEnabled();
      expect(auditButton).toBeEnabled();

      fireEvent.click(safeButton);
      const safeCsv = await textOf(capture.downloads[0]);
      expect(capture.downloads[0].fileName).toBe("safe-structured-output.csv");
      expect(safeCsv.split("\n")[0]).toBe("Fecha_Visita,Fecha_Nacimiento,Diagnostico,CampoLibre");
      expect(safeCsv).not.toContain("P-001");
      expect(safeCsv).not.toContain("Gripe A");
      expect(safeCsv).not.toContain("1954-03-12");

      fireEvent.click(auditButton);
      const audit = await textOf(capture.downloads[1]);
      expect(capture.downloads[1].fileName).toBe("structured-confidential-audit.txt");
      expect(audit.startsWith(CONFIDENTIAL_AUDIT_WARNING_LINE)).toBe(true);
      expect(audit).toContain("P-001");
      expect(audit).toContain("Gripe A");
    } finally {
      capture.restore();
    }
  });

  it("fails closed: both actions are disabled with the exact block reasons", () => {
    const configuration = createStructuredConfiguration(GRID, {
      selectedPatientIdColumn: "Paciente",
    });
    const plan = buildStructuredTransformPlan(configuration, {
      policyId: "standard",
      jobSeed: JOB_SEED,
    });
    const structured = {
      configuration,
      plan,
      preparation: prepareStructuredOutput(configuration, plan),
    };
    render(<ExportStep job={jobFor(false)} review={null} structured={structured} />);
    expect(
      screen.getByRole("button", { name: "Download Safe Structured Output (.csv)" })
    ).toBeDisabled();
    expect(
      screen.getByRole("button", { name: "Download Structured Confidential Audit (.txt)" })
    ).toBeDisabled();
    expect(screen.getByRole("alert")).toHaveTextContent(/requires review/);
  });
});
