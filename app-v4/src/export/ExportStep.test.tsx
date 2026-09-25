import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { ReactElement } from "react";
import { useState } from "react";
import "@testing-library/jest-dom/vitest";

import { ExportStep, downloadTextFile } from "./ExportStep";
import {
  applyDecision,
  canFinalize,
  createReviewSession,
  getFinalText,
  type ReviewSession,
} from "../review/review-domain";
import { createJob, withReviewState, type Job, type OutputAvailability } from "../domain/job";
import { buildSafeOutput, serializeSafeOutput, type SafeOutput } from "../output/safe-output";
import { buildConfidentialAudit } from "../output/confidential-audit";
import {
  CONFIDENTIAL_AUDIT_WARNING_LINE,
  serializeConfidentialAudit,
} from "../output/confidential-audit-serializer";

/**
 * Oracles for Work Order T08 U4 (Export step, GitHub #12). All fixtures
 * are synthetic Spanish clinical-style text; no real content anywhere.
 *
 * The no-audit-data invariant is proven STRUCTURALLY (own enumerable key
 * set + value shapes on the reviewed service output), NOT by forbidden
 * substring scans on the safe artifact — the same style as
 * output/safe-output.test.ts, so the oracle can genuinely disagree.
 */

const SOURCE = "Nombre: Carmen Sánchez\nTeléfono 612345678. NHC 2024/089756.";
const NAME_START = SOURCE.indexOf("Carmen Sánchez");
const NAME_END = NAME_START + "Carmen Sánchez".length;
const PHONE_START = SOURCE.indexOf("612345678");
const PHONE_END = PHONE_START + "612345678".length;
const NHC_START = SOURCE.indexOf("2024/089756");
const NHC_END = NHC_START + "2024/089756".length;

function adversarialSession(): ReviewSession {
  return createReviewSession({
    originalText: SOURCE,
    detections: [
      {
        type: "NOMBRE",
        start: NAME_START,
        end: NAME_END,
        confidence: 0.95,
        proposed: "PACIENTE-1",
        reason: "regex NombrePropio",
        note: "nota interna de revisión: verificar apellidos",
        requiresReview: true,
      },
      {
        type: "IDENTIFICADOR",
        start: PHONE_START,
        end: PHONE_END,
        confidence: 0.6,
        proposed: "TEL-REEMPLAZO",
        note: "teléfono sintético sin código de país",
        requiresReview: true,
      },
      {
        type: "IDENTIFICADOR",
        start: NHC_START,
        end: NHC_END,
        confidence: 0.9,
        proposed: "ID-1",
        note: "NHC sintética del fixture",
        requiresReview: true,
      },
    ],
    sessionId: "export-step-test-session",
  });
}

function completedSession(): ReviewSession {
  const session = adversarialSession();
  let next = applyDecision(session, session.detections[0].id, "accepted");
  next = applyDecision(next, session.detections[1].id, "modified", {
    replacement: "TEL-FINAL",
    note: "sin código de país en la fuente",
  });
  next = applyDecision(next, session.detections[2].id, "accepted");
  return next;
}

/**
 * Build the Job exactly as the state bridge does (one atomic derivation
 * of the output availability from the review fact, D-005).
 */
function bridgeJob(review: ReviewSession): Job {
  const safeOutputReady = canFinalize(review);
  const availability: OutputAvailability = {
    safeOutputReady,
    confidentialAuditReady: true,
  };
  return Object.freeze({
    ...withReviewState(createJob({ type: "pasted-text", text: SOURCE }), {
      complete: safeOutputReady,
    }),
    outputs: Object.freeze(availability),
  }) as Job;
}

/** Structural assertion the real output must pass and planted leaks must fail. */
function assertStructuralSafeOutput(value: unknown): void {
  const keys = Object.keys(value as object).sort();
  const allowed = ["kind", "text"];
  if (keys.length !== allowed.length || keys.some((k, i) => k !== allowed[i])) {
    throw new Error(`structural violation: keys must be ${JSON.stringify(allowed)}`);
  }
  for (const v of Object.values(value as Record<string, unknown>)) {
    if (Array.isArray(v) || (typeof v === "object" && v !== null)) {
      throw new Error("structural violation: no array- or object-shaped values allowed");
    }
  }
}

// ---------------------------------------------------------------------------
// Download capture: stubs the client-side download seam (no network).
// ---------------------------------------------------------------------------
type CapturedDownload = { readonly fileName: string; readonly blob: Blob };

function captureDownloads(): {
  readonly downloads: readonly CapturedDownload[];
  restore(): void;
} {
  const downloads: CapturedDownload[] = [];
  const blobs: Blob[] = [];
  const urls: string[] = [];
  const originalCreate = URL.createObjectURL;
  const originalRevoke = URL.revokeObjectURL;
  const originalClick = HTMLAnchorElement.prototype.click;
  URL.createObjectURL = vi.fn((blob: Blob) => {
    blobs.push(blob);
    urls.push(`blob:mock-${blobs.length}`);
    return urls[urls.length - 1];
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

function clickDownload(name: string) {
  fireEvent.click(screen.getByRole("button", { name }));
}

const SAFE_BUTTON = "Download Safe Output (.txt)";
const AUDIT_BUTTON = "Download Confidential Audit (.txt)";

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

/** Wrapper that forces unrelated re-renders without touching the domain. */
function RerenderHarness(props: {
  job: Job;
  review: ReviewSession;
  sessionRef: { current: ReviewSession | null };
}): ReactElement {
  const [showPanel, setShowPanel] = useState(false);
  props.sessionRef.current = props.review;
  return (
    <div>
      <button type="button" onClick={() => setShowPanel((visible) => !visible)}>
        Toggle unrelated panel
      </button>
      {showPanel && <p>Unrelated transient panel</p>}
      <ExportStep job={props.job} review={props.review} />
    </div>
  );
}

describe("dual-surface export (D-005): two separate actions, two different artifacts", () => {
  it("produces different content under different file names for a completed session", async ({
    task,
  }) => {
    void task;
    const session = completedSession();
    const captured = captureDownloads();
    try {
      render(<ExportStep job={bridgeJob(session)} review={session} />);
      clickDownload(SAFE_BUTTON);
      clickDownload(AUDIT_BUTTON);

      expect(captured.downloads).toHaveLength(2);
      expect(captured.downloads[0].fileName).toBe("safe-output.txt");
      expect(captured.downloads[1].fileName).toBe("confidential-audit.txt");

      const safeText = await textOf(captured.downloads[0]);
      const auditText = await textOf(captured.downloads[1]);
      expect(safeText).not.toBe(auditText);
    } finally {
      captured.restore();
    }
  });

  it("safe-output.txt is byte-equal to the canonical final text, structurally free of audit data", async ({
    task,
  }) => {
    void task;
    const session = completedSession();
    const captured = captureDownloads();
    try {
      render(<ExportStep job={bridgeJob(session)} review={session} />);
      clickDownload(SAFE_BUTTON);

      const safeText = await textOf(captured.downloads[0]);
      // Byte-equal to the reviewed service's serialization of the session.
      const output: SafeOutput = buildSafeOutput(session);
      expect(safeText).toBe(serializeSafeOutput(output));
      expect(safeText).toBe(getFinalText(session));
      // Structural invariant, NOT a substring scan: the reviewed output's
      // own enumerable shape can carry no mapping/notes at all.
      expect(() => assertStructuralSafeOutput(output)).not.toThrow();
      expect(new Set(Object.keys(output))).toEqual(new Set(["kind", "text"]));
    } finally {
      captured.restore();
    }
  });

  it("confidential-audit.txt starts with the warning line and carries mapping and original values", async ({
    task,
  }) => {
    void task;
    const session = completedSession();
    const captured = captureDownloads();
    try {
      render(<ExportStep job={bridgeJob(session)} review={session} />);
      clickDownload(AUDIT_BUTTON);

      const auditText = await textOf(captured.downloads[0]);
      expect(auditText.startsWith(CONFIDENTIAL_AUDIT_WARNING_LINE)).toBe(true);
      expect(auditText).toBe(serializeConfidentialAudit(buildConfidentialAudit(session)));
      // The confidential artifact DOES carry original values and mapping.
      expect(auditText).toContain("Carmen Sánchez");
      expect(auditText).toContain("612345678");
      expect(auditText).toContain("nota interna de revisión");
    } finally {
      captured.restore();
    }
  });
});

describe("fail-closed Safe Output while mandatory review is pending (D-009)", () => {
  it("disables Safe Output with the explicit typed reason; the audit stays available", async ({
    task,
  }) => {
    void task;
    const session = adversarialSession(); // nothing decided yet
    const captured = captureDownloads();
    try {
      render(<ExportStep job={bridgeJob(session)} review={session} />);

      const safeButton = screen.getByRole("button", { name: SAFE_BUTTON });
      expect(safeButton).toBeDisabled();
      const reason = screen.getByRole("alert");
      expect(reason).toHaveTextContent(
        "Safe export is blocked while 3 mandatory review decisions are pending."
      );
      expect(safeButton).toHaveAttribute("aria-describedby", reason.id);

      // The confidential audit remains available during pending review.
      expect(screen.getByRole("button", { name: AUDIT_BUTTON })).toBeEnabled();
      clickDownload(AUDIT_BUTTON);
      const auditText = await textOf(captured.downloads[0]);
      expect(auditText.startsWith(CONFIDENTIAL_AUDIT_WARNING_LINE)).toBe(true);
      expect(captured.downloads[0].fileName).toBe("confidential-audit.txt");
    } finally {
      captured.restore();
    }
  });
});

describe("session isolation and rerender invariance", () => {
  it("re-renders never mutate the domain session nor the exported Safe Output bytes", async ({
    task,
  }) => {
    void task;
    const session = completedSession();
    const sessionRef: { current: ReviewSession | null } = { current: null };
    const harness = render(
      <RerenderHarness job={bridgeJob(session)} review={session} sessionRef={sessionRef} />
    );
    const captured = captureDownloads();
    try {
      clickDownload(SAFE_BUTTON);
      const before = await textOf(captured.downloads[0]);

      // Force unrelated re-renders of the workspace-adjacent UI.
      fireEvent.click(harness.getByRole("button", { name: "Toggle unrelated panel" }));
      fireEvent.click(harness.getByRole("button", { name: "Toggle unrelated panel" }));
      expect(harness.queryByText("Unrelated transient panel")).not.toBeInTheDocument();

      clickDownload(SAFE_BUTTON);
      const after = await textOf(captured.downloads[1]);
      expect(after).toBe(before);

      // Rendering cannot swap or mutate the frozen domain session.
      expect(sessionRef.current).toBe(session);
      expect(Object.isFrozen(session)).toBe(true);
      expect(getFinalText(session)).toBe(before);
    } finally {
      captured.restore();
    }
  });

  it("the download helper never touches the network and revokes its object URL", async ({
    task,
  }) => {
    void task;
    const captured = captureDownloads();
    const originalFetch = globalThis.fetch;
    const fetchSpy = vi.fn();
    globalThis.fetch = fetchSpy as unknown as typeof globalThis.fetch;
    try {
      downloadTextFile("safe-output.txt", "contenido sintético");
      expect(captured.downloads).toHaveLength(1);
      expect(await textOf(captured.downloads[0])).toBe("contenido sintético");
      expect(URL.revokeObjectURL).toHaveBeenCalledWith("blob:mock-1");
      // No network sender was invoked by the helper (D-013: memory-only).
      expect(fetchSpy).not.toHaveBeenCalled();
    } finally {
      globalThis.fetch = originalFetch;
      captured.restore();
    }
  });
});

describe("claims gate (D-006): no anonymity/compliance wording on the export surface", () => {
  it("renders no privacy score, anonymity, GDPR or certification claims", () => {
    const session = completedSession();
    render(<ExportStep job={bridgeJob(session)} review={session} />);
    const body = document.body.textContent ?? "";
    expect(body).not.toMatch(/anonym|gdpr|privacy score|certif|complian|complien/i);
    expect(body).not.toMatch(/puntuación|anónimo|anónima|certifica/i);
  });
});
