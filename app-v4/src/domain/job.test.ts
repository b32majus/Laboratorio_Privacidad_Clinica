import { describe, expect, it } from "vitest";

import {
  FLOW_STEPS,
  JobModelError,
  advanceStep,
  beginProcessing,
  canAdvanceStep,
  completeProcessing,
  createJob,
  failProcessing,
  goToStep,
  inferJobKind,
  isStepAccessible,
  setPolicy,
  withReviewState,
  type Job,
  type JobSourceFile,
  type ProcessingFailure,
} from "./job";
import { extractTxt } from "../input/extract";
import { MAX_SUPPORTED_TEXT_LENGTH, oversizeInputFor } from "../engine/input-limits";

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

describe("processing outcome (T15 #19)", () => {
  function idleJob(): Job {
    return createJob(TEXT_INPUT);
  }

  function runningJob(): Job {
    return beginProcessing(idleJob());
  }

  function failedJob(code: ProcessingFailure["code"] = "processing-failed"): Job {
    return failProcessing(runningJob(), { code, message: `Synthetic ${code} failure.` });
  }

  function succeededJob(): Job {
    return completeProcessing(runningJob());
  }

  function expectTransitionError(run: () => unknown): void {
    try {
      run();
      throw new Error("expected the transition to throw");
    } catch (error) {
      expect(error).toBeInstanceOf(JobModelError);
      expect((error as JobModelError).code).toBe("invalid-processing-transition");
    }
  }

  it("beginProcessing starts a new attempt from idle, failed and unknown", () => {
    for (const from of [idleJob(), failedJob(), failedJob("processing-unknown")]) {
      const started = beginProcessing(from);
      expect(started.processing).toBe("running");
      expect(started).not.toBe(from);
      expect(Object.isFrozen(started)).toBe(true);
      // The input job is never mutated.
      expect(from.processing).not.toBe("running");
    }
  });

  it("beginProcessing from running is an exact no-op (same object)", () => {
    const running = runningJob();
    expect(beginProcessing(running)).toBe(running);
  });

  it("beginProcessing refuses to restart a succeeded job", () => {
    const succeeded = succeededJob();
    expect(succeeded.processing).toBe("succeeded");
    expectTransitionError(() => beginProcessing(succeeded));
  });

  it("completeProcessing records success only from running", () => {
    const running = runningJob();
    const succeeded = completeProcessing(running);
    expect(succeeded.processing).toBe("succeeded");
    expect(Object.isFrozen(succeeded)).toBe(true);
    expect(running.processing).toBe("running");
  });

  it("completeProcessing never infers success from idle, failed or unknown", () => {
    expectTransitionError(() => completeProcessing(idleJob()));
    expectTransitionError(() => completeProcessing(failedJob()));
    expectTransitionError(() => completeProcessing(failedJob("processing-unknown")));
    // A fresh job can never already be succeeded; success needs an attempt.
    expect(idleJob().processing).not.toBe("succeeded");
  });

  it("failProcessing with a recognized code reaches failed and appends the error, preserving existing entries", () => {
    const first = failProcessing(runningJob(), {
      code: "policy-unsupported",
      message: "Policy is known but unmapped.",
    });
    expect(first.processing).toBe("failed");
    expect(first.errors).toHaveLength(1);
    expect(first.errors[0].code).toBe("policy-unsupported");
    expect(first.errors[0].message).toBe("Policy is known but unmapped.");

    // A retry that fails again APPENDS instead of replacing the history.
    const second = failProcessing(beginProcessing(first), {
      code: "processing-failed",
      message: "Engine refused the source.",
    });
    expect(second.errors).toHaveLength(2);
    expect(second.errors[0]).toEqual(first.errors[0]);
    expect(second.errors[1].code).toBe("processing-failed");
    // The failed input job was not mutated by the append.
    expect(first.errors).toHaveLength(1);
  });

  it("failProcessing with processing-unknown reaches unknown", () => {
    const unknown = failProcessing(runningJob(), {
      code: "processing-unknown",
      message: "Fixed unknown-outcome message.",
    });
    expect(unknown.processing).toBe("unknown");
    expect(unknown.errors[0].code).toBe("processing-unknown");
  });

  it("failProcessing is refused from idle and from succeeded", () => {
    expectTransitionError(() =>
      failProcessing(idleJob(), { code: "processing-failed", message: "No attempt started." })
    );
    // A success is never overwritten by a later failure.
    expectTransitionError(() =>
      failProcessing(succeededJob(), { code: "processing-failed", message: "Too late." })
    );
  });

  it("setPolicy with a real change resets the processing outcome to idle", () => {
    const succeeded = succeededJob();
    const changed = setPolicy(succeeded, "strict");
    expect(changed.processing).toBe("idle");
    expect(changed).not.toBe(succeeded);
    expect(Object.isFrozen(changed)).toBe(true);
    // The prior job keeps its recorded outcome.
    expect(succeeded.processing).toBe("succeeded");
  });

  it("a real policy change also resets a failed attempt to idle", () => {
    const failed = failedJob("processing-unknown");
    expect(setPolicy(failed, "strict").processing).toBe("idle");
  });

  it("an unchanged policy remains an exact no-op for a succeeded job", () => {
    const succeeded = succeededJob();
    expect(setPolicy(succeeded, "standard")).toBe(succeeded);
    expect(succeeded.processing).toBe("succeeded");
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

describe("supported input size (T15 #19)", () => {
  function extractedFile(name: string, extension: string, text: string): JobSourceFile {
    return { name, extension, extraction: { status: "extracted" as const, extractedText: text } };
  }

  it("inferJobKind refuses oversize pasted text with the typed code", () => {
    const text = "h".repeat(MAX_SUPPORTED_TEXT_LENGTH + 1);
    try {
      inferJobKind({ type: "pasted-text", text });
      throw new Error("expected inferJobKind to throw");
    } catch (error) {
      expect(error).toBeInstanceOf(JobModelError);
      expect((error as JobModelError).code).toBe("input-too-large");
      expect((error as JobModelError).message).toBe(oversizeInputFor(text)!.message);
    }
  });

  it("createJob refuses oversize pasted text and accepts exactly-at-limit text", () => {
    const oversize = "i".repeat(MAX_SUPPORTED_TEXT_LENGTH + 1);
    try {
      createJob({ type: "pasted-text", text: oversize });
      throw new Error("expected createJob to throw");
    } catch (error) {
      expect(error).toBeInstanceOf(JobModelError);
      expect((error as JobModelError).code).toBe("input-too-large");
    }

    const boundary = "j".repeat(MAX_SUPPORTED_TEXT_LENGTH);
    const job = createJob({ type: "pasted-text", text: boundary });
    expect(job.kind).toBe("text");
    if (job.source.type !== "pasted-text") throw new Error("unreachable: pasted-text source");
    expect(job.source.text.length).toBe(MAX_SUPPORTED_TEXT_LENGTH);
    expect(job.source.text).toBe(boundary);
  });

  it("createJob refuses an oversize extracted file even when the adapter is bypassed", () => {
    const name = "oversize-note.txt";
    const text = "k".repeat(MAX_SUPPORTED_TEXT_LENGTH + 1);
    try {
      createJob({ type: "files", files: [extractedFile(name, "txt", text)] });
      throw new Error("expected createJob to throw");
    } catch (error) {
      expect(error).toBeInstanceOf(JobModelError);
      expect((error as JobModelError).code).toBe("input-too-large");
      const message = (error as JobModelError).message;
      expect(message).toContain(`"${name}"`);
      expect(message).toContain(oversizeInputFor(text)!.message);
      expect(message).toContain("Split");
    }
  });

  it("names every oversize file in deterministic input order", () => {
    const first = "first-oversize.txt";
    const second = "second-oversize.txt";
    try {
      createJob({
        type: "files",
        files: [
          extractedFile(first, "txt", "l".repeat(MAX_SUPPORTED_TEXT_LENGTH + 1)),
          extractedFile(second, "txt", "m".repeat(MAX_SUPPORTED_TEXT_LENGTH + 2)),
        ],
      });
      throw new Error("expected createJob to throw");
    } catch (error) {
      expect(error).toBeInstanceOf(JobModelError);
      expect((error as JobModelError).code).toBe("input-too-large");
      const message = (error as JobModelError).message;
      expect(message.indexOf(`"${first}"`)).toBeGreaterThanOrEqual(0);
      expect(message.indexOf(`"${first}"`)).toBeLessThan(message.indexOf(`"${second}"`));
    }
  });

  it("never creates a job from a real oversize TXT through the composed intake path", async () => {
    const text = "n".repeat(MAX_SUPPORTED_TEXT_LENGTH + 1);
    const extracted = await extractTxt(new File([text], "oversize-note.txt"));
    expect(extracted.status).toBe("failed");
    // Mirror App.tsx's mapping of an adapter result to a JobSourceFile.
    const jobFiles: JobSourceFile[] = [
      {
        name: extracted.sourceName,
        extension: "txt",
        extraction:
          extracted.status === "success"
            ? { status: "extracted", extractedText: extracted.text }
            : {
                status: "failed",
                error: { code: extracted.error.code, message: extracted.error.message },
              },
      },
    ];
    try {
      createJob({ type: "files", files: jobFiles });
      throw new Error("expected createJob to throw");
    } catch (error) {
      expect(error).toBeInstanceOf(JobModelError);
      expect((error as JobModelError).code).toBe("input-too-large");
    }
  });

  it("accepts exactly-at-limit extracted text with the length unchanged", () => {
    const text = "o".repeat(MAX_SUPPORTED_TEXT_LENGTH);
    const job = createJob({ type: "files", files: [extractedFile("boundary.txt", "txt", text)] });
    expect(job.kind).toBe("document");
    if (job.source.type !== "files") throw new Error("unreachable: files source");
    const extraction = job.source.files[0].extraction;
    expect(extraction?.status).toBe("extracted");
    if (extraction?.status === "extracted") {
      expect(extraction.extractedText.length).toBe(MAX_SUPPORTED_TEXT_LENGTH);
      expect(extraction.extractedText).toBe(text);
    }
  });
});
