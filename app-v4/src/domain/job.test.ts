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
  withReviewState,
  type Job,
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
        files: [file("a.txt", "txt"), file("b.pdf", "pdf"), file("c.docx", "docx")],
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
    expect(() => inferJobKind({ type: "pasted-text", text: "   \n\t " })).toThrowError(
      JobModelError
    );
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
      files: [file("a.txt", "txt"), file("b.txt", "txt")],
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

describe("document extraction contract (T06)", () => {
  function extractedFile(name: string, extension: string, text: string) {
    return {
      name,
      extension,
      extraction: { status: "extracted" as const, extractedText: text },
    };
  }

  function failedFile(name: string, extension: string, code: string, message: string) {
    return {
      name,
      extension,
      extraction: { status: "failed" as const, error: { code, message } },
    };
  }

  it("keeps successful extraction state on the created job, frozen", () => {
    const job = createJob({
      type: "files",
      files: [extractedFile("note.txt", "txt", "Synthetic note.")],
    });
    expect(job.kind).toBe("document");
    if (job.source.type !== "files") throw new Error("unreachable: a files job source is expected");
    const sourceFile = job.source.files[0];
    expect(sourceFile.extraction).toEqual({
      status: "extracted",
      extractedText: "Synthetic note.",
    });
    expect(Object.isFrozen(job.source)).toBe(true);
    expect(Object.isFrozen(job.source.files)).toBe(true);
    expect(Object.isFrozen(sourceFile)).toBe(true);
  });

  it("refuses a document job whose required file failed extraction (fail-closed)", () => {
    const failureMessage =
      'The DOCX file "broken.docx" could not be parsed; it may be corrupt or not a valid DOCX document.';
    try {
      createJob({
        type: "files",
        files: [failedFile("broken.docx", "docx", "extraction-failed", failureMessage)],
      });
      throw new Error("expected createJob to throw");
    } catch (error) {
      expect(error).toBeInstanceOf(JobModelError);
      expect((error as JobModelError).code).toBe("extraction-failed");
      expect((error as JobModelError).message).toContain('"broken.docx"');
      expect((error as JobModelError).message).toContain("could not be used");
    }
  });

  it("propagates pdf-no-text-layer as a typed job error", () => {
    try {
      createJob({
        type: "files",
        files: [
          failedFile(
            "scan.pdf",
            "pdf",
            "pdf-no-text-layer",
            "The PDF contains no extractable text."
          ),
        ],
      });
      throw new Error("expected createJob to throw");
    } catch (error) {
      expect(error).toBeInstanceOf(JobModelError);
      expect((error as JobModelError).code).toBe("pdf-no-text-layer");
    }
  });

  it("names every failing file when a batch contains failures", () => {
    try {
      createJob({
        type: "files",
        files: [
          extractedFile("good.txt", "txt", "Synthetic good note."),
          failedFile(
            "scan.pdf",
            "pdf",
            "pdf-no-text-layer",
            "The PDF contains no extractable text."
          ),
          failedFile("broken.docx", "docx", "extraction-failed", "Could not be parsed."),
        ],
      });
      throw new Error("expected createJob to throw");
    } catch (error) {
      expect(error).toBeInstanceOf(JobModelError);
      const message = (error as JobModelError).message;
      expect(message).toContain('"scan.pdf"');
      expect(message).toContain('"broken.docx"');
      expect(message).toContain("no job was created");
    }
  });

  it("maps an empty TXT extraction to the empty-input job error", () => {
    try {
      createJob({
        type: "files",
        files: [
          failedFile("empty.txt", "txt", "empty-input", 'The TXT file "empty.txt" is empty.'),
        ],
      });
      throw new Error("expected createJob to throw");
    } catch (error) {
      expect(error).toBeInstanceOf(JobModelError);
      expect((error as JobModelError).code).toBe("empty-input");
    }
  });

  it("still rejects legacy .doc by classification, before the extraction guard", () => {
    try {
      createJob({
        type: "files",
        files: [
          failedFile(
            "old.doc",
            "doc",
            "unsupported-format",
            'Legacy Word ".doc" files are not supported.'
          ),
        ],
      });
      throw new Error("expected createJob to throw");
    } catch (error) {
      expect(error).toBeInstanceOf(JobModelError);
      expect((error as JobModelError).code).toBe("unsupported-file-type");
      expect((error as JobModelError).message).toMatch(/\.doc/);
    }
  });

  it("still allows metadata-only document files without extraction state", () => {
    const job = createJob({ type: "files", files: [file("note.txt", "txt")] });
    expect(job.kind).toBe("document");
    if (job.source.type !== "files") throw new Error("unreachable: a files job source is expected");
    expect(job.source.files[0].extraction).toBeUndefined();
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
    const atPrivacyGate = goToStep(goToStep(goToStep(job, "configure"), "review"), "privacy-gate");
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

  // PR #40 corrective C2: a ReviewSession is produced under exactly one
  // policy, so a REAL policy change resets the derived review-dependent
  // state in the same frozen transition.
  it("a real policy change resets review completeness and both outputs fail-closed", () => {
    const job = createJob(TEXT_INPUT);
    // Mirror the state bridge's derived shape: review complete with both
    // outputs available (exactly what withDerivedReviewState installs).
    const reviewedJob = Object.freeze({
      ...withReviewState(job, { complete: true }),
      outputs: Object.freeze({ safeOutputReady: true, confidentialAuditReady: true }),
      currentStep: "export",
      visitedSteps: Object.freeze(["input", "configure", "review", "privacy-gate", "export"]),
    }) as Job;

    const changed = setPolicy(reviewedJob, "strict");
    expect(changed.policyId).toBe("strict");
    expect(changed.review).toEqual({ complete: false });
    expect(changed.outputs).toEqual({ safeOutputReady: false, confidentialAuditReady: false });
    expect(Object.isFrozen(changed)).toBe(true);
    expect(Object.isFrozen(changed.review)).toBe(true);
    expect(Object.isFrozen(changed.outputs)).toBe(true);
    // The flow position is kept: the reviewer re-enters Review in place.
    expect(changed.currentStep).toBe("export");
    expect(changed.visitedSteps).toEqual(reviewedJob.visitedSteps);
    // The export gate re-engages through the same domain state.
    expect(canAdvanceStep(changed)).toBe(false);
  });

  it("an unchanged policy is an exact no-op (same object, no reset)", () => {
    const reviewedJob = Object.freeze({
      ...withReviewState(createJob(TEXT_INPUT), { complete: true }),
      outputs: Object.freeze({ safeOutputReady: true, confidentialAuditReady: true }),
    }) as Job;
    expect(setPolicy(reviewedJob, "standard")).toBe(reviewedJob);
  });
});
