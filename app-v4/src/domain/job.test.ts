import { describe, expect, it } from "vitest";

import {
  FLOW_STEPS,
  JobModelError,
  advanceStep,
  canAdvanceStep,
  createJob,
  goToStep,
  inferJobKind,
  isStepAccessible,
  setPolicy,
  withReviewState
} from "./job";

const TEXT_INPUT = { type: "pasted-text", text: "Synthetic clinical note for testing." } as const;

function file(name: string, extension: string) {
  return { name, extension };
}

describe("inferJobKind", () => {
  it("infers a text job from pasted text", () => {
    expect(inferJobKind(TEXT_INPUT)).toBe("text");
  });

  it("infers a document job from exactly one compatible document", () => {
    expect(inferJobKind({ type: "files", files: [file("note.pdf", "pdf")] })).toBe("document");
    expect(inferJobKind({ type: "files", files: [file("note.txt", "txt")] })).toBe("document");
    expect(inferJobKind({ type: "files", files: [file("note.docx", "docx")] })).toBe("document");
  });

  it("infers a document-batch job from multiple compatible documents", () => {
    expect(
      inferJobKind({
        type: "files",
        files: [file("a.txt", "txt"), file("b.pdf", "pdf"), file("c.docx", "docx")]
      })
    ).toBe("document-batch");
  });

  it("infers a structured job from CSV/XLS/XLSX files", () => {
    expect(inferJobKind({ type: "files", files: [file("labs.csv", "csv")] })).toBe("structured");
    expect(inferJobKind({ type: "files", files: [file("labs.xls", "xls")] })).toBe("structured");
    expect(
      inferJobKind({ type: "files", files: [file("a.xlsx", "xlsx"), file("b.csv", "csv")] })
    ).toBe("structured");
  });

  it("throws a typed empty-input error for empty pasted text", () => {
    expect(() => inferJobKind({ type: "pasted-text", text: "" })).toThrowError(JobModelError);
    expect(() => inferJobKind({ type: "pasted-text", text: "   \n\t " })).toThrowError(JobModelError);
    try {
      inferJobKind({ type: "pasted-text", text: " " });
      throw new Error("expected inferJobKind to throw");
    } catch (error) {
      expect(error).toBeInstanceOf(JobModelError);
      expect((error as JobModelError).code).toBe("empty-input");
    }
  });

  it("throws a typed empty-input error for an empty file list", () => {
    try {
      inferJobKind({ type: "files", files: [] });
      throw new Error("expected inferJobKind to throw");
    } catch (error) {
      expect(error).toBeInstanceOf(JobModelError);
      expect((error as JobModelError).code).toBe("empty-input");
    }
  });

  it("throws a typed ambiguous-input error for mixed document and structured files", () => {
    try {
      inferJobKind({ type: "files", files: [file("a.pdf", "pdf"), file("b.csv", "csv")] });
      throw new Error("expected inferJobKind to throw");
    } catch (error) {
      expect(error).toBeInstanceOf(JobModelError);
      expect((error as JobModelError).code).toBe("ambiguous-input");
    }
  });

  it("throws a typed unsupported-file-type error for unknown extensions", () => {
    try {
      inferJobKind({ type: "files", files: [file("payload.exe", "exe")] });
      throw new Error("expected inferJobKind to throw");
    } catch (error) {
      expect(error).toBeInstanceOf(JobModelError);
      expect((error as JobModelError).code).toBe("unsupported-file-type");
    }
  });

  it("never silently picks a kind: createJob rethrows the same typed errors", () => {
    expect(() => createJob({ type: "pasted-text", text: "" })).toThrowError(JobModelError);
    expect(() => createJob({ type: "files", files: [] })).toThrowError(JobModelError);
    expect(() =>
      createJob({ type: "files", files: [file("a.txt", "txt"), file("b.csv", "csv")] })
    ).toThrowError(JobModelError);
  });
});

describe("createJob", () => {
  it("creates a frozen job at the input step with fail-closed defaults", () => {
    const job = createJob(TEXT_INPUT);
    expect(Object.isFrozen(job)).toBe(true);
    expect(Object.isFrozen(job.review)).toBe(true);
    expect(Object.isFrozen(job.visitedSteps)).toBe(true);
    expect(job.kind).toBe("text");
    expect(job.currentStep).toBe("input");
    expect(job.visitedSteps).toEqual(["input"]);
    expect(job.policyId).toBe("standard");
    expect(job.processing).toBe("idle");
    expect(job.review.complete).toBe(false);
    expect(job.outputs.safeOutputReady).toBe(false);
    expect(job.outputs.confidentialAuditReady).toBe(false);
  });

  it("names file jobs from their source metadata only", () => {
    const single = createJob({ type: "files", files: [file("labs.csv", "csv")] });
    expect(single.name).toBe("labs.csv");
    const batch = createJob({
      type: "files",
      files: [file("a.txt", "txt"), file("b.txt", "txt")]
    });
    expect(batch.name).toBe("2 files");
    expect(batch.kind).toBe("document-batch");
  });

  it("rejects mutation of a frozen job", () => {
    const job = createJob(TEXT_INPUT);
    expect(() => {
      (job as { kind: string }).kind = "structured";
    }).toThrow(TypeError);
  });
});

describe("step transitions", () => {
  it("walks the canonical happy path up to privacy-gate", () => {
    let job = createJob(TEXT_INPUT);
    for (const step of ["configure", "review", "privacy-gate"] as const) {
      job = advanceStep(job);
      expect(job.currentStep).toBe(step);
    }
    expect(job.visitedSteps).toEqual(["input", "configure", "review", "privacy-gate"]);
  });

  it("blocks export while mandatory review is incomplete (fail-closed)", () => {
    const job = createJob(TEXT_INPUT);
    const atPrivacyGate = goToStep(
      goToStep(goToStep(job, "configure"), "review"),
      "privacy-gate"
    );
    expect(() => advanceStep(atPrivacyGate)).toThrowError(JobModelError);
    try {
      advanceStep(atPrivacyGate);
    } catch (error) {
      expect((error as JobModelError).code).toBe("review-incomplete");
    }
    expect(() => goToStep(atPrivacyGate, "export")).toThrowError(JobModelError);
    expect(canAdvanceStep(atPrivacyGate)).toBe(false);
    expect(isStepAccessible(atPrivacyGate, "export")).toBe(false);
  });

  it("allows export once review completeness is explicitly satisfied", () => {
    const job = withReviewState(createJob(TEXT_INPUT), { complete: true });
    let current = job;
    for (let i = 0; i < FLOW_STEPS.length - 1; i += 1) {
      current = advanceStep(current);
    }
    expect(current.currentStep).toBe("export");
    expect(current.visitedSteps).toEqual(FLOW_STEPS.slice());
  });

  it("throws a typed invalid-step error on forward skips and jumps", () => {
    const job = createJob(TEXT_INPUT);
    expect(() => goToStep(job, "review")).toThrowError(JobModelError);
    expect(() => goToStep(job, "privacy-gate")).toThrowError(JobModelError);
    expect(() => goToStep(job, "export")).toThrowError(JobModelError);
    const atConfigure = goToStep(job, "configure");
    expect(() => goToStep(atConfigure, "privacy-gate")).toThrowError(JobModelError);
    try {
      goToStep(job, "export");
    } catch (error) {
      expect((error as JobModelError).code).toBe("invalid-step");
    }
  });

  it("allows backward navigation to any visited step and preserves history", () => {
    const job = createJob(TEXT_INPUT);
    const atReview = goToStep(goToStep(job, "configure"), "review");
    const backToConfigure = goToStep(atReview, "configure");
    expect(backToConfigure.currentStep).toBe("configure");
    expect(backToConfigure.visitedSteps).toEqual(["input", "configure", "review"]);
    const backToInput = goToStep(backToConfigure, "input");
    expect(backToInput.currentStep).toBe("input");
    // From a revisited earlier step, forward moves continue the canonical order.
    expect(canAdvanceStep(backToInput)).toBe(true);
  });

  it("treats a goToStep call for the current step as a no-op identity", () => {
    const job = createJob(TEXT_INPUT);
    expect(goToStep(job, "input")).toBe(job);
  });

  it("advanceStep returns a new frozen job and never mutates the original", () => {
    const job = createJob(TEXT_INPUT);
    const next = advanceStep(job);
    expect(next).not.toBe(job);
    expect(Object.isFrozen(next)).toBe(true);
    expect(job.currentStep).toBe("input");
    expect(job.visitedSteps).toEqual(["input"]);
    expect(next.visitedSteps).toEqual(["input", "configure"]);
  });

  it("exposes accessibility consistent with the transition guards", () => {
    const job = createJob(TEXT_INPUT);
    expect(isStepAccessible(job, "input")).toBe(true);
    expect(isStepAccessible(job, "configure")).toBe(true);
    expect(isStepAccessible(job, "review")).toBe(false);
    expect(canAdvanceStep(job)).toBe(true);
    const completed = withReviewState(job, { complete: true });
    const atExport = advanceStep(advanceStep(advanceStep(advanceStep(completed))));
    expect(atExport.currentStep).toBe("export");
    expect(canAdvanceStep(atExport)).toBe(false);
  });
});

describe("setPolicy", () => {
  it("updates the policy immutably within the D-007 vocabulary", () => {
    const job = createJob(TEXT_INPUT);
    const updated = setPolicy(job, "external-ai");
    expect(updated.policyId).toBe("external-ai");
    expect(job.policyId).toBe("standard");
    expect(Object.isFrozen(updated)).toBe(true);
  });

  it("throws a typed error for an unknown policy id", () => {
    const job = createJob(TEXT_INPUT);
    expect(() => setPolicy(job, "strict-mode" as never)).toThrowError(JobModelError);
    try {
      setPolicy(job, "nope" as never);
    } catch (error) {
      expect((error as JobModelError).code).toBe("invalid-policy");
    }
  });
});
