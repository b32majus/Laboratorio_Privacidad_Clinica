import { describe, expect, it } from "vitest";

import {
  FLOW_STEPS,
  JobModelError,
  acknowledgeBatchItemError,
  advanceStep,
  batchActiveFailedItems,
  batchFailedItems,
  batchFailureRemedy,
  batchHasActiveErrorItems,
  batchHasErrorItems,
  batchItemStatus,
  batchReviewComplete,
  beginBatchItemRetry,
  beginItemProcessing,
  beginItemRead,
  beginProcessing,
  canAdvanceStep,
  completeProcessing,
  createJob,
  failProcessing,
  goToStep,
  inferJobKind,
  isBatchItemRetryable,
  isStepAccessible,
  recordItemFailed,
  recordItemProcessed,
  recordItemRead,
  recordItemReviewCompletion,
  removeBatchItem,
  setPolicy,
  withReviewState,
  type BatchItemStatus,
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

  // T17 #21 SD-2 deliberately changes this contract: batch creation no longer
  // aborts on failed reads; it refuses extraction-carrying batch inputs and
  // failures surface per item through recordItemRead.
  it("refuses an extraction-carrying batch at creation: the read phase owns outcomes", () => {
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
      expect((error as JobModelError).code).toBe("invalid-batch-intake");
      const message = (error as JobModelError).message;
      expect(message).toContain('"good.txt"');
      expect(message).toContain('"scan.pdf"');
      expect(message).toContain('"broken.docx"');
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

  /**
   * REC-05 WU-B2 (D-023/D-024 + HPD-02 + G-HP2). For a pasted-text or single
   * document Job the Result (`export`) step is directly reachable from Review in
   * ONE transition; the Privacy Gate stays a visible, enabled, OPTIONAL
   * destination (never deleted, and never a new ceremonial no-op screen). Every
   * other Job kind keeps the canonical `review → privacy-gate → export` order.
   */
  describe("D-024 single-item direct Result (REC-05 WU-B2)", () => {
    function documentJob(): Job {
      return createJob({
        type: "files",
        files: [
          {
            name: "note.txt",
            extension: "txt",
            extraction: { status: "extracted" as const, extractedText: "Synthetic note." },
          },
        ],
      });
    }
    function structuredJob(): Job {
      return createJob({ type: "files", files: [file("labs.csv", "csv")] });
    }
    function batchJob(): Job {
      return createJob({
        type: "files",
        files: [file("a.txt", "txt"), file("b.txt", "txt")],
      });
    }
    function atReview(job: Job): Job {
      return goToStep(goToStep(job, "configure"), "review");
    }

    const singleItemKinds = [
      ["pasted-text", () => createJob(TEXT_INPUT)] as const,
      ["single-document", documentJob] as const,
    ];

    for (const [label, makeJob] of singleItemKinds) {
      it(`makes Result directly reachable from Review for a ${label} job once review is complete`, () => {
        const review = withReviewState(atReview(makeJob()), { complete: true });
        // The Privacy Gate remains visible, enabled and visitable (optional).
        expect(isStepAccessible(review, "privacy-gate")).toBe(true);
        // Result is directly reachable in ONE transition, without the Gate stop.
        expect(isStepAccessible(review, "export")).toBe(true);
        const exported = goToStep(review, "export");
        expect(exported.currentStep).toBe("export");
        expect(exported.visitedSteps).toEqual(["input", "configure", "review", "export"]);
        expect(exported.visitedSteps).not.toContain("privacy-gate");
        // The Gate route is still valid when chosen explicitly.
        const viaGate = goToStep(review, "privacy-gate");
        expect(viaGate.currentStep).toBe("privacy-gate");
        expect(goToStep(viaGate, "export").currentStep).toBe("export");
      });

      it(`keeps Result fail-closed from Review for a ${label} job while mandatory review is pending`, () => {
        const review = atReview(makeJob());
        expect(isStepAccessible(review, "export")).toBe(false);
        try {
          goToStep(review, "export");
          throw new Error("expected goToStep to throw");
        } catch (error) {
          expect(error).toBeInstanceOf(JobModelError);
          expect((error as JobModelError).code).toBe("review-incomplete");
        }
        // The Gate is still visitable so the user can see what blocks Safe output.
        expect(isStepAccessible(review, "privacy-gate")).toBe(true);
        expect(goToStep(review, "privacy-gate").currentStep).toBe("privacy-gate");
      });
    }

    it("keeps the document-batch Gate stop mandatory and its transition behavior unchanged", () => {
      const review = withReviewState(atReview(batchJob()), { complete: true });
      expect(isStepAccessible(review, "export")).toBe(false);
      try {
        goToStep(review, "export");
        throw new Error("expected goToStep to throw");
      } catch (error) {
        expect(error).toBeInstanceOf(JobModelError);
        expect((error as JobModelError).code).toBe("invalid-step");
      }
      // Canonical order is unchanged: review -> privacy-gate -> export.
      expect(advanceStep(review).currentStep).toBe("privacy-gate");
      const gate = goToStep(review, "privacy-gate");
      expect(gate.currentStep).toBe("privacy-gate");
      expect(goToStep(gate, "export").currentStep).toBe("export");
    });

    it("keeps the structured Gate stop mandatory and its transition behavior unchanged", () => {
      const review = atReview(structuredJob());
      expect(isStepAccessible(review, "export")).toBe(false);
      expect(() => goToStep(review, "export")).toThrowError(JobModelError);
      expect(advanceStep(review).currentStep).toBe("privacy-gate");
      expect(goToStep(review, "privacy-gate").currentStep).toBe("privacy-gate");
    });

    it("introduces no new flow destination/step for the single-item Result (G-HP2)", () => {
      // Exactly the five canonical steps remain: WU-B2 reuses the existing
      // export destination instead of adding a Gate-only ceremonial screen.
      expect(FLOW_STEPS).toEqual(["input", "configure", "review", "privacy-gate", "export"]);
      const review = withReviewState(atReview(createJob(TEXT_INPUT)), { complete: true });
      const exported = goToStep(review, "export");
      expect(exported.visitedSteps).not.toContain("privacy-gate");
      expect(FLOW_STEPS).toHaveLength(5);
    });
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

  // T17 #21 SD-2: a multi-file oversize input is a batch, so it is refused at
  // creation as an extraction-carrying intake; oversize is decided per item in
  // recordItemRead (see the batch read-phase oracles).
  it("refuses a multi-file oversize batch at creation: outcomes are per item", () => {
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
      expect((error as JobModelError).code).toBe("invalid-batch-intake");
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

describe("batch item-state contract (T17 #21 WU-A)", () => {
  const STATUSES: readonly BatchItemStatus[] = [
    "queued",
    "reading",
    "processing",
    "review-required",
    "completed",
    "error",
  ];

  function batchJob(names: readonly string[]): Job {
    return createJob({ type: "files", files: names.map((name) => file(name, "txt")) });
  }

  function itemsOf(job: Job): readonly JobSourceFile[] {
    if (job.source.type !== "files") {
      throw new Error("unreachable: a batch job source is a files source");
    }
    return job.source.files;
  }

  function statusesOf(job: Job): readonly (BatchItemStatus | undefined)[] {
    return itemsOf(job).map((item) => item.itemStatus);
  }

  function readText(job: Job, index: number, text: string): Job {
    return recordItemRead(beginItemRead(job, index), index, { ok: true, extractedText: text });
  }

  function readFailure(job: Job, index: number, code: string, message: string): Job {
    return recordItemRead(beginItemRead(job, index), index, {
      ok: false,
      error: { code, message },
    });
  }

  function toReviewRequired(job: Job, index: number): Job {
    return recordItemProcessed(beginItemProcessing(job, index), index);
  }

  function toCompleted(job: Job, index: number): Job {
    return recordItemReviewCompletion(toReviewRequired(job, index), index, true);
  }

  function atPrivacyGate(job: Job): Job {
    return goToStep(goToStep(goToStep(job, "configure"), "review"), "privacy-gate");
  }

  function expectItemTransitionError(run: () => unknown): void {
    try {
      run();
      throw new Error("expected the item transition to throw");
    } catch (error) {
      expect(error).toBeInstanceOf(JobModelError);
      expect((error as JobModelError).code).toBe("invalid-processing-transition");
    }
  }

  function extractedFile(name: string, text: string): JobSourceFile {
    return { name, extension: "txt", extraction: { status: "extracted", extractedText: text } };
  }

  describe("two-phase creation (SD-2)", () => {
    it("creates a frozen batch from metadata only, every item queued", () => {
      const job = batchJob(["a.txt", "b.txt"]);
      expect(job.kind).toBe("document-batch");
      expect(statusesOf(job)).toEqual(["queued", "queued"]);
      for (const item of itemsOf(job)) {
        expect(item.extraction).toBeUndefined();
        expect(item.itemError).toBeUndefined();
      }
      expect(Object.isFrozen(job)).toBe(true);
      expect(Object.isFrozen(job.source)).toBe(true);
      expect(Object.isFrozen(itemsOf(job))).toBe(true);
      expect(Object.isFrozen(itemsOf(job)[0])).toBe(true);
    });

    it("refuses an extraction-carrying batch input naming every file", () => {
      try {
        createJob({
          type: "files",
          files: [extractedFile("a.txt", "A."), extractedFile("b.txt", "B.")],
        });
        throw new Error("expected createJob to throw");
      } catch (error) {
        expect(error).toBeInstanceOf(JobModelError);
        expect((error as JobModelError).code).toBe("invalid-batch-intake");
        const message = (error as JobModelError).message;
        expect(message).toContain('"a.txt"');
        expect(message).toContain('"b.txt"');
      }
    });

    it("preserves the single-document all-or-nothing contract", () => {
      try {
        createJob({
          type: "files",
          files: [
            {
              name: "broken.docx",
              extension: "docx",
              extraction: {
                status: "failed",
                error: { code: "extraction-failed", message: "Could not be parsed." },
              },
            },
          ],
        });
        throw new Error("expected createJob to throw");
      } catch (error) {
        expect(error).toBeInstanceOf(JobModelError);
        expect((error as JobModelError).code).toBe("extraction-failed");
        expect((error as JobModelError).message).toContain('"broken.docx"');
      }

      const oversize = "x".repeat(MAX_SUPPORTED_TEXT_LENGTH + 1);
      try {
        createJob({ type: "files", files: [extractedFile("big.txt", oversize)] });
        throw new Error("expected createJob to throw");
      } catch (error) {
        expect(error).toBeInstanceOf(JobModelError);
        expect((error as JobModelError).code).toBe("input-too-large");
      }
    });

    it("keeps a metadata-only single-document job without item state", () => {
      const job = createJob({ type: "files", files: [file("note.txt", "txt")] });
      expect(job.kind).toBe("document");
      const sourceFile = itemsOf(job)[0];
      expect(sourceFile.itemStatus).toBeUndefined();
      expect(sourceFile.itemError).toBeUndefined();
    });
  });

  describe("read phase (SD-2/SD-3)", () => {
    it("beginItemRead moves queued to reading and never mutates the input job", () => {
      const job = batchJob(["a.txt", "b.txt"]);
      const reading = beginItemRead(job, 1);
      expect(batchItemStatus(reading, 1)).toBe("reading");
      expect(Object.isFrozen(reading)).toBe(true);
      // The input job and its untouched sibling are unchanged.
      expect(batchItemStatus(job, 1)).toBe("queued");
      expect(batchItemStatus(reading, 0)).toBe("queued");
    });

    it("records a successful read as queued with the extracted text held", () => {
      const job = readText(batchJob(["a.txt", "b.txt"]), 0, "Synthetic note.");
      expect(batchItemStatus(job, 0)).toBe("queued");
      const item = itemsOf(job)[0];
      expect(item.extraction).toEqual({ status: "extracted", extractedText: "Synthetic note." });
      expect(item.itemError).toBeUndefined();
      expect(Object.isFrozen(item)).toBe(true);
    });

    it("maps an adapter read failure to an error item, retaining code, name and message", () => {
      const message = "The PDF contains no extractable text.";
      const job = readFailure(batchJob(["scan.pdf", "ok.txt"]), 0, "pdf-no-text-layer", message);
      expect(batchItemStatus(job, 0)).toBe("error");
      const item = itemsOf(job)[0];
      expect(item.name).toBe("scan.pdf");
      expect(item.itemError).toEqual({ code: "pdf-no-text-layer", message });
      expect(item.extraction).toBeUndefined();
      // The failed item stays visible inside the batch.
      expect(job.kind).toBe("document-batch");
      expect(itemsOf(job)).toHaveLength(2);
    });

    it("collapses an unknown adapter code to extraction-failed", () => {
      const job = readFailure(batchJob(["a.txt", "b.txt"]), 0, "totally-unknown", "Boom.");
      expect(itemsOf(job)[0].itemError?.code).toBe("extraction-failed");
      expect(itemsOf(job)[0].itemError?.message).toBe("Boom.");
    });

    it("turns an oversize read into an input-too-large error with the shared message verbatim and no text", () => {
      const text = "z".repeat(MAX_SUPPORTED_TEXT_LENGTH + 1);
      const job = readText(batchJob(["big.txt", "b.txt"]), 0, text);
      expect(batchItemStatus(job, 0)).toBe("error");
      const item = itemsOf(job)[0];
      expect(item.itemError?.code).toBe("input-too-large");
      expect(item.itemError?.message).toBe(oversizeInputFor(text)!.message);
      expect(item.extraction).toBeUndefined();
      // The refused payload text is not held anywhere in the job.
      expect(JSON.stringify(job)).not.toContain("zzzzzzzz");
    });

    it("turns an empty or whitespace-only read into an empty-input error", () => {
      for (const text of ["", "   \n\t "]) {
        const job = readText(batchJob(["empty.txt", "b.txt"]), 0, text);
        expect(batchItemStatus(job, 0)).toBe("error");
        expect(itemsOf(job)[0].itemError?.code).toBe("empty-input");
        expect(itemsOf(job)[0].itemError?.message).toContain('"empty.txt"');
        expect(itemsOf(job)[0].extraction).toBeUndefined();
      }
    });

    it("refuses every wrong-state read precondition", () => {
      const queued = batchJob(["a.txt", "b.txt"]);
      // beginItemRead only from queued.
      const reading = beginItemRead(queued, 0);
      expectItemTransitionError(() => beginItemRead(reading, 0));
      // recordItemRead only from reading.
      expectItemTransitionError(() => recordItemRead(queued, 0, { ok: true, extractedText: "x" }));
      // A read outcome cannot be replayed onto an already-read item.
      const read = recordItemRead(reading, 0, { ok: true, extractedText: "x" });
      expectItemTransitionError(() => recordItemRead(read, 0, { ok: true, extractedText: "y" }));
    });
  });

  describe("process phase (SD-4)", () => {
    it("walks queued to processing to review-required", () => {
      const job = toReviewRequired(batchJob(["a.txt", "b.txt"]), 0);
      expect(batchItemStatus(job, 0)).toBe("review-required");
      expect(batchItemStatus(job, 1)).toBe("queued");
    });

    it("records a classified processing failure and keeps the held extraction", () => {
      const failure: ProcessingFailure = {
        code: "policy-unsupported",
        message: "Policy is known but unmapped.",
      };
      const read = readText(batchJob(["a.txt", "b.txt"]), 0, "Synthetic a.");
      const job = recordItemFailed(beginItemProcessing(read, 0), 0, failure);
      expect(batchItemStatus(job, 0)).toBe("error");
      expect(itemsOf(job)[0].itemError).toEqual(failure);
      // The read text is policy-INDEPENDENT, so a processing failure keeps it
      // and the item stays retryable after a policy change (T17 #21 WU-C3).
      expect(itemsOf(job)[0].extraction).toEqual({
        status: "extracted",
        extractedText: "Synthetic a.",
      });
    });

    it("refuses every wrong-state process precondition", () => {
      const queued = batchJob(["a.txt", "b.txt"]);
      expectItemTransitionError(() => beginItemProcessing(beginItemRead(queued, 0), 0));
      expectItemTransitionError(() => recordItemProcessed(queued, 0));
      expectItemTransitionError(() =>
        recordItemFailed(queued, 0, { code: "processing-failed", message: "no attempt" })
      );
      const processing = beginItemProcessing(queued, 0);
      expectItemTransitionError(() => recordItemProcessed(processing, 1));
      expectItemTransitionError(() => recordItemProcessed(recordItemProcessed(processing, 0), 0));
    });
  });

  describe("review completion (SD-5)", () => {
    it("is the only path to completed", () => {
      const reviewRequired = toReviewRequired(batchJob(["a.txt", "b.txt"]), 0);
      expectItemTransitionError(() => beginItemRead(reviewRequired, 0));
      expectItemTransitionError(() => beginItemProcessing(reviewRequired, 0));
      expectItemTransitionError(() =>
        recordItemRead(reviewRequired, 0, { ok: true, extractedText: "x" })
      );
      expectItemTransitionError(() => recordItemProcessed(reviewRequired, 0));
      expectItemTransitionError(() =>
        recordItemFailed(reviewRequired, 0, { code: "processing-failed", message: "late" })
      );
      const completed = recordItemReviewCompletion(reviewRequired, 0, true);
      expect(batchItemStatus(completed, 0)).toBe("completed");
    });

    it("re-opens a completed item when complete is false", () => {
      const completed = toCompleted(batchJob(["a.txt", "b.txt"]), 0);
      const reopened = recordItemReviewCompletion(completed, 0, false);
      expect(batchItemStatus(reopened, 0)).toBe("review-required");
    });

    it("refuses completion from any state that is not under review", () => {
      const queued = batchJob(["a.txt", "b.txt"]);
      expectItemTransitionError(() => recordItemReviewCompletion(queued, 0, true));
      expectItemTransitionError(() => recordItemReviewCompletion(queued, 0, false));
      expectItemTransitionError(() =>
        recordItemReviewCompletion(beginItemRead(queued, 0), 0, true)
      );
      expectItemTransitionError(() =>
        recordItemReviewCompletion(beginItemProcessing(queued, 0), 0, false)
      );
      expectItemTransitionError(() =>
        recordItemReviewCompletion(beginItemProcessing(queued, 0), 0, true)
      );
      const failed = readFailure(queued, 0, "pdf-no-text-layer", "No layer.");
      expectItemTransitionError(() => recordItemReviewCompletion(failed, 0, true));
    });

    it("is an exact no-op for a same-state completion", () => {
      const reviewRequired = toReviewRequired(batchJob(["a.txt", "b.txt"]), 0);
      expect(recordItemReviewCompletion(reviewRequired, 0, false)).toBe(reviewRequired);
      const completed = recordItemReviewCompletion(reviewRequired, 0, true);
      expect(recordItemReviewCompletion(completed, 0, true)).toBe(completed);
    });

    it("completing one item does not touch its sibling", () => {
      const job = toCompleted(batchJob(["a.txt", "b.txt"]), 0);
      expect(batchItemStatus(job, 0)).toBe("completed");
      expect(batchItemStatus(job, 1)).toBe("queued");
    });
  });

  describe("readiness helpers (SD-6)", () => {
    it("batchItemStatus throws for a non-batch job and an out-of-range index", () => {
      expectItemTransitionError(() => batchItemStatus(createJob(TEXT_INPUT), 0));
      expectItemTransitionError(() => batchItemStatus(batchJob(["a.txt", "b.txt"]), 2));
      expectItemTransitionError(() => batchItemStatus(batchJob(["a.txt", "b.txt"]), -1));
    });

    it("batchFailedItems reports index, name and error in input order", () => {
      let job = readFailure(
        batchJob(["scan.pdf", "ok.txt", "broken.docx"]),
        0,
        "pdf-no-text-layer",
        "No layer."
      );
      job = readFailure(job, 2, "extraction-failed", "Could not be parsed.");
      expect(batchFailedItems(job)).toEqual([
        {
          index: 0,
          name: "scan.pdf",
          error: { code: "pdf-no-text-layer", message: "No layer." },
        },
        {
          index: 2,
          name: "broken.docx",
          error: { code: "extraction-failed", message: "Could not be parsed." },
        },
      ]);
      expect(batchHasErrorItems(job)).toBe(true);
    });

    it("batchHasErrorItems is false for a batch without failures", () => {
      const job = batchJob(["a.txt", "b.txt"]);
      expect(batchFailedItems(job)).toEqual([]);
      expect(batchHasErrorItems(job)).toBe(false);
    });

    it("fails closed on an error item with no recorded itemError", () => {
      // Only reachable via a hand-crafted job: every domain transition that
      // sets itemStatus "error" also records itemError (SD-3).
      const job = batchJob(["a.txt", "b.txt"]);
      const items = itemsOf(job);
      const crafted = {
        ...job,
        source: {
          type: "files" as const,
          files: [{ ...items[0], itemStatus: "error" as const }, items[1]],
        },
      } as Job;
      expectItemTransitionError(() => batchFailedItems(crafted));
    });

    it("batchReviewComplete is true only when every non-error item is completed", () => {
      const fresh = batchJob(["a.txt", "b.txt"]);
      expect(batchReviewComplete(fresh)).toBe(false);

      const half = toCompleted(fresh, 0);
      expect(batchReviewComplete(half)).toBe(false);

      const complete = toCompleted(half, 1);
      expect(batchReviewComplete(complete)).toBe(true);

      // An error item does not count against completion of the remaining items.
      let withError = readFailure(
        batchJob(["a.txt", "b.txt"]),
        0,
        "pdf-no-text-layer",
        "No layer."
      );
      withError = toCompleted(withError, 1);
      expect(batchReviewComplete(withError)).toBe(true);
    });

    it("batchReviewComplete is false when every item is an error", () => {
      let job = readFailure(batchJob(["a.txt", "b.txt"]), 0, "pdf-no-text-layer", "No layer.");
      job = readFailure(job, 1, "pdf-no-text-layer", "No layer.");
      expect(batchReviewComplete(job)).toBe(false);
    });

    it("batch readiness helpers require a batch job", () => {
      expectItemTransitionError(() => batchFailedItems(createJob(TEXT_INPUT)));
      expectItemTransitionError(() => batchReviewComplete(createJob(TEXT_INPUT)));
      expectItemTransitionError(() => batchHasErrorItems(createJob(TEXT_INPUT)));
      // Every documented batch status is a valid value.
      expect(STATUSES).toHaveLength(6);
    });
  });

  describe("batch Result navigation (REC-07 #87)", () => {
    function failedBatch(): Job {
      return readFailure(batchJob(["scan.pdf", "ok.txt"]), 0, "pdf-no-text-layer", "No layer.");
    }

    it("reaches the batch Result while review is pending; the artifact stays unauthorized", () => {
      const gate = atPrivacyGate(failedBatch());
      // Navigation is decoupled from artifact authorization: the Result step
      // communicates the not-ready state instead of staying unreachable.
      expect(canAdvanceStep(gate)).toBe(true);
      expect(isStepAccessible(gate, "export")).toBe(true);
      expect(advanceStep(gate).currentStep).toBe("export");
      expect(goToStep(gate, "export").currentStep).toBe("export");
      // The same authorities still report the artifact as unauthorized:
      // review is incomplete and an active failure remains.
      expect(batchReviewComplete(failedBatch())).toBe(false);
      expect(batchHasActiveErrorItems(failedBatch())).toBe(true);
    });

    it("reaches the batch Result with an active failed item once review is complete", () => {
      const gate = atPrivacyGate(withReviewState(failedBatch(), { complete: true }));
      expect(canAdvanceStep(gate)).toBe(true);
      expect(isStepAccessible(gate, "export")).toBe(true);
      expect(advanceStep(gate).currentStep).toBe("export");
      // The active failure is still the artifact blocker in the batch facts.
      expect(batchHasActiveErrorItems(gate)).toBe(true);
      expect(batchActiveFailedItems(gate).map((item) => item.name)).toEqual(["scan.pdf"]);
    });

    it("allows export for a fully completed batch without failures", () => {
      const reviewed = withReviewState(toCompleted(batchJob(["a.txt", "b.txt"]), 0), {
        complete: true,
      });
      const gate = atPrivacyGate(reviewed);
      expect(canAdvanceStep(gate)).toBe(true);
      expect(advanceStep(gate).currentStep).toBe("export");
    });

    it("leaves a single-document export guard unchanged", () => {
      const reviewed = withReviewState(
        createJob({ type: "files", files: [extractedFile("note.txt", "Synthetic note.")] }),
        { complete: true }
      );
      const gate = atPrivacyGate(reviewed);
      expect(canAdvanceStep(gate)).toBe(true);
      expect(advanceStep(gate).currentStep).toBe("export");
    });

    it("keeps the review-incomplete guard for a single-document job", () => {
      const pending = createJob({
        type: "files",
        files: [extractedFile("note.txt", "Synthetic note.")],
      });
      const gate = atPrivacyGate(pending);
      expect(canAdvanceStep(gate)).toBe(false);
      expect(isStepAccessible(gate, "export")).toBe(false);
      expect(() => advanceStep(gate)).toThrowError(JobModelError);
    });

    it("still refuses a direct batch review-to-export skip: the Gate stays in the path", () => {
      const review = goToStep(goToStep(failedBatch(), "configure"), "review");
      expect(() => goToStep(review, "export")).toThrowError(JobModelError);
      expect(goToStep(review, "privacy-gate").currentStep).toBe("privacy-gate");
    });

    it("offers the policy remedy for a policy-unsupported failure instead of removing the document (CORR-B)", () => {
      let job = readText(batchJob(["blocked.txt", "ok.txt"]), 0, "Healthy synthetic text.");
      job = recordItemFailed(beginItemProcessing(job, 0), 0, {
        code: "policy-unsupported",
        message: "Policy is known but has no accepted per-category operator mapping.",
      });
      job = toCompleted(job, 1);
      const gate = atPrivacyGate(withReviewState(job, { complete: true }));
      // The Result copy names the remedy from the batch facts (gate/Result
      // authority), not from a throwing transition.
      const codes = batchActiveFailedItems(gate).map((item) => item.error.code);
      expect(batchFailureRemedy(codes)).toMatch(/supported Privacy Policy/i);
      expect(batchFailureRemedy(codes)).not.toMatch(/new job/i);
    });

    it("names both remedies for a mixed policy + read failure (CORR-B)", () => {
      let job = readText(batchJob(["blocked.txt", "scan.pdf", "ok.txt"]), 0, "Healthy.");
      job = recordItemFailed(beginItemProcessing(job, 0), 0, {
        code: "policy-unsupported",
        message: "Policy mapping unavailable.",
      });
      job = readFailure(job, 1, "pdf-no-text-layer", "No layer.");
      job = toCompleted(job, 2);
      const gate = atPrivacyGate(withReviewState(job, { complete: true }));
      const codes = batchActiveFailedItems(gate).map((item) => item.error.code);
      expect(batchFailureRemedy(codes)).toMatch(/supported Privacy Policy/i);
      expect(batchFailureRemedy(codes)).toMatch(/new job/i);
    });
  });

  describe("setPolicy batch reset (SD-8)", () => {
    function mixedBatch(): Job {
      let job = batchJob(["a.txt", "b.txt", "c.txt", "d.txt", "e.txt", "f.txt", "g.txt"]);
      // a: stays queued
      // b: processing
      job = beginItemProcessing(readText(job, 1, "Synthetic b."), 1);
      // c: review-required
      job = recordItemProcessed(beginItemProcessing(readText(job, 2, "Synthetic c."), 2), 2);
      // d: policy-unsupported error that keeps its held text
      job = recordItemFailed(beginItemProcessing(readText(job, 3, "Synthetic d."), 3), 3, {
        code: "policy-unsupported",
        message: "Policy is known but unmapped.",
      });
      // e: read error that is policy-independent
      job = readFailure(job, 4, "pdf-no-text-layer", "No layer.");
      // f: reading
      job = beginItemRead(job, 5);
      // g: completed
      job = toCompleted(job, 6);
      return job;
    }

    it("resets processing-derived item state to queued, keeping held text; a reading item stays reading (CORR-A)", () => {
      const job = mixedBatch();
      const changed = setPolicy(job, "strict");
      expect(changed.policyId).toBe("strict");
      expect(changed.review).toEqual({ complete: false });
      expect(changed.outputs).toEqual({ safeOutputReady: false, confidentialAuditReady: false });
      expect(changed.processing).toBe("idle");
      expect(statusesOf(changed)).toEqual([
        "queued", // was queued
        "queued", // was processing
        "queued", // was review-required
        "queued", // policy-unsupported error reset
        "error", // policy-independent error retained
        "reading", // was reading: STAYS reading (CORR-A) so its in-flight read can commit
        "queued", // was completed
      ]);
      // A policy change invalidates PROCESSING state only: the read text is
      // policy-INDEPENDENT and survives on every reset item that had been read
      // (T17 #21 WU-C3), while itemError is cleared on all of them.
      for (const index of [0, 1, 2, 3, 5, 6]) {
        expect(itemsOf(changed)[index].itemError).toBeUndefined();
      }
      expect(itemsOf(changed)[1].extraction).toEqual({
        status: "extracted",
        extractedText: "Synthetic b.",
      });
      expect(itemsOf(changed)[2].extraction).toEqual({
        status: "extracted",
        extractedText: "Synthetic c.",
      });
      // The policy-unsupported item keeps its held text → genuinely retryable.
      expect(itemsOf(changed)[3].extraction).toEqual({
        status: "extracted",
        extractedText: "Synthetic d.",
      });
      // Items that were never read carry no text, before or after the change
      // (index 5 stays reading and unread).
      for (const index of [0, 5, 6]) {
        expect(itemsOf(changed)[index].extraction).toBeUndefined();
      }
      // The retained read error is untouched and carries no text.
      expect(itemsOf(changed)[4].itemError).toEqual({
        code: "pdf-no-text-layer",
        message: "No layer.",
      });
      expect(itemsOf(changed)[4].extraction).toBeUndefined();
      // The source job keeps the read text the reset item came from.
      expect(batchItemStatus(job, 1)).toBe("processing");
      expect(itemsOf(job)[3].extraction).toEqual({
        status: "extracted",
        extractedText: "Synthetic d.",
      });
      expect(Object.isFrozen(changed)).toBe(true);
    });

    it("is an exact no-op for an unchanged policy", () => {
      const job = mixedBatch();
      expect(setPolicy(job, "standard")).toBe(job);
    });

    // T17 #21 CORR-A: a policy change during the asynchronous batch read must
    // not invalidate the policy-independent read phase. The deterministic
    // race: the item enters `reading`, the policy changes BEFORE the read
    // resolves, then the read outcome arrives — committing it must NOT throw
    // `invalid-processing-transition`, and the real outcome is recorded
    // under the new policy.
    it("keeps a reading item reading across a policy change so its in-flight read commits", () => {
      let job = batchJob(["a.txt", "b.txt"]);
      // The item enters reading; the read (extractFile) is conceptually
      // pending. A completed sibling proves the change still invalidates
      // processing-derived state.
      job = beginItemRead(job, 0);
      job = toCompleted(job, 1);

      const changed = setPolicy(job, "strict");
      expect(changed.policyId).toBe("strict");
      expect(batchItemStatus(changed, 0)).toBe("reading");
      expect(batchItemStatus(changed, 1)).toBe("queued");

      // The read resolves under the NEW policy: a successful outcome commits.
      const committed = recordItemRead(changed, 0, {
        ok: true,
        extractedText: "Synthetic a.",
      });
      expect(batchItemStatus(committed, 0)).toBe("queued");
      expect(itemsOf(committed)[0].extraction).toEqual({
        status: "extracted",
        extractedText: "Synthetic a.",
      });
      expect(committed.policyId).toBe("strict");
    });

    it("commits a failed read outcome for an item whose policy changed mid-read", () => {
      let job = beginItemRead(batchJob(["scan.pdf", "b.txt"]), 0);
      job = setPolicy(job, "strict");
      expect(batchItemStatus(job, 0)).toBe("reading");
      const committed = recordItemRead(job, 0, {
        ok: false,
        error: { code: "pdf-no-text-layer", message: "No layer." },
      });
      expect(batchItemStatus(committed, 0)).toBe("error");
      expect(itemsOf(committed)[0].itemError).toEqual({
        code: "pdf-no-text-layer",
        message: "No layer.",
      });
    });
  });

  describe("immutability", () => {
    it("item transitions never mutate the input job", () => {
      const original = batchJob(["a.txt", "b.txt"]);
      Object.freeze(original);
      const reading = beginItemRead(original, 0);
      const read = recordItemRead(reading, 0, { ok: true, extractedText: "Synthetic." });
      const processing = beginItemProcessing(read, 0);
      const final = recordItemProcessed(processing, 0);
      // Every intermediate job is distinct and frozen; the original is intact.
      expect(reading).not.toBe(original);
      expect(read).not.toBe(reading);
      expect(final).not.toBe(processing);
      expect(batchItemStatus(original, 0)).toBe("queued");
      expect(itemsOf(original)[0].extraction).toBeUndefined();
      expect(Object.isFrozen(final)).toBe(true);
      expect(Object.isFrozen(itemsOf(final)[0])).toBe(true);
    });

    it("a failed transition leaves the input job untouched", () => {
      const job = batchJob(["a.txt", "b.txt"]);
      expectItemTransitionError(() => recordItemRead(job, 0, { ok: true, extractedText: "x" }));
      expect(statusesOf(job)).toEqual(["queued", "queued"]);
    });
  });

  // ------------------------------------------------------------------
  // Batch failure recovery (#78, REC-06): orthogonal recovery/disposition
  // facts, contextual retry, confirmed removal and acknowledgement. All
  // fixtures are synthetic; no real content anywhere.
  // ------------------------------------------------------------------
  describe("failure recovery (#78, REC-06)", () => {
    const RETRY_TEXT = "Nombre: Carmen Sánchez. Contacto: 612345678.";

    /** A batch whose item 0 failed PROCESSING (retained text) and item 1 failed READ. */
    function processingAndReadFailureJob(): Job {
      let job = batchJob(["doc-a.txt", "doc-b.txt", "doc-c.txt"]);
      job = readText(job, 0, RETRY_TEXT);
      job = recordItemFailed(beginItemProcessing(job, 0), 0, {
        code: "processing-failed",
        message: "Synthetic processing failure.",
      });
      job = readFailure(job, 1, "pdf-no-text-layer", "No text layer.");
      job = readText(job, 2, "Synthetic text C.");
      return job;
    }

    describe("active-failure derivations", () => {
      it("batchActiveFailedItems excludes removed items and keeps input order", () => {
        let job = processingAndReadFailureJob();
        expect(batchFailedItems(job).map((item) => item.index)).toEqual([0, 1]);
        expect(batchHasErrorItems(job)).toBe(true);
        expect(batchActiveFailedItems(job).map((item) => item.index)).toEqual([0, 1]);
        expect(batchHasActiveErrorItems(job)).toBe(true);

        job = removeBatchItem(job, 1);
        // The full failure set keeps its accepted semantics (every error item).
        expect(batchFailedItems(job).map((item) => item.index)).toEqual([0, 1]);
        expect(batchHasErrorItems(job)).toBe(true);
        // The removed item is no longer an ACTIVE blocker.
        expect(batchActiveFailedItems(job).map((item) => item.index)).toEqual([0]);
        expect(batchHasActiveErrorItems(job)).toBe(true);

        job = removeBatchItem(job, 0);
        expect(batchActiveFailedItems(job)).toEqual([]);
        expect(batchHasActiveErrorItems(job)).toBe(false);
      });

      it("batchActiveFailedItems is fail-closed on an error item without itemError", () => {
        const job = processingAndReadFailureJob();
        // Simulate the impossible state directly to prove the guard fires.
        const broken = {
          ...job,
          source: { type: "files", files: [{ ...itemsOf(job)[0], itemError: undefined }] },
        } as unknown as Job;
        expectItemTransitionError(() => batchActiveFailedItems(broken));
        expectItemTransitionError(() => batchFailedItems(broken));
      });

      it("active-failure helpers throw for a non-batch job", () => {
        const textJob = createJob({ type: "pasted-text", text: "Synthetic." });
        expect(() => batchActiveFailedItems(textJob)).toThrowError(JobModelError);
        expect(() => batchHasActiveErrorItems(textJob)).toThrowError(JobModelError);
      });
    });

    describe("retryability boundary (witness 3)", () => {
      it("a processing failure with retained text is retryable", () => {
        const job = processingAndReadFailureJob();
        expect(isBatchItemRetryable(job, 0)).toBe(true);
      });

      it("a read failure WITHOUT retained text is never retryable", () => {
        const job = processingAndReadFailureJob();
        expect(isBatchItemRetryable(job, 1)).toBe(false);
      });

      it("a policy-unsupported failure is not offered in-place retry", () => {
        let job = readText(batchJob(["a.txt", "b.txt"]), 0, RETRY_TEXT);
        job = recordItemFailed(beginItemProcessing(job, 0), 0, {
          code: "policy-unsupported",
          message: "Blocked by the current policy.",
        });
        expect(isBatchItemRetryable(job, 0)).toBe(false);
      });

      it("a removed item is never retryable, and non-error items never are", () => {
        let job = processingAndReadFailureJob();
        job = removeBatchItem(job, 0);
        expect(isBatchItemRetryable(job, 0)).toBe(false);
        expect(isBatchItemRetryable(job, 2)).toBe(false);
      });

      it("throws typed for non-batch jobs and out-of-range indexes", () => {
        const job = processingAndReadFailureJob();
        const textJob = createJob({ type: "pasted-text", text: "Synthetic." });
        expect(() => isBatchItemRetryable(textJob, 0)).toThrowError(JobModelError);
        expectItemTransitionError(() => isBatchItemRetryable(job, 7));
      });
    });

    describe("beginBatchItemRetry", () => {
      it("starts a new processing attempt that the existing transitions can resolve", () => {
        const job = processingAndReadFailureJob();
        const before = itemsOf(job)[0];
        const started = beginBatchItemRetry(job, 0);

        // Identity, index and the retained read artifact survive; the stale
        // failure and any acknowledgement are cleared.
        const startedItem = itemsOf(started)[0];
        expect(batchItemStatus(started, 0)).toBe("processing");
        expect(startedItem.name).toBe(before.name);
        expect(startedItem.extension).toBe(before.extension);
        expect(startedItem.extraction).toEqual(before.extraction);
        expect(startedItem.itemError).toBeUndefined();
        expect(startedItem.itemAcknowledged).toBeUndefined();
        // No other item changed.
        expect(batchItemStatus(started, 1)).toBe("error");
        expect(batchItemStatus(started, 2)).toBe("queued");
        expect(Object.isFrozen(started)).toBe(true);

        // Success path: the existing transitions resolve the attempt.
        const done = recordItemProcessed(started, 0);
        expect(batchItemStatus(done, 0)).toBe("review-required");
        // Failure path: the item returns to a truthful error.
        const failed = recordItemFailed(started, 0, {
          code: "processing-failed",
          message: "Second synthetic failure.",
        });
        expect(batchItemStatus(failed, 0)).toBe("error");
        expect(itemsOf(failed)[0].itemError).toEqual({
          code: "processing-failed",
          message: "Second synthetic failure.",
        });
      });

      it("refuses every non-retryable case with zero mutation", () => {
        let job = processingAndReadFailureJob();
        // Read failure without retained text.
        expectItemTransitionError(() => beginBatchItemRetry(job, 1));
        // Non-error item.
        expectItemTransitionError(() => beginBatchItemRetry(job, 2));
        // Out-of-range and non-batch.
        expectItemTransitionError(() => beginBatchItemRetry(job, 9));
        const textJob = createJob({ type: "pasted-text", text: "Synthetic." });
        expect(() => beginBatchItemRetry(textJob, 0)).toThrowError(JobModelError);
        // Removed item.
        job = removeBatchItem(job, 0);
        expectItemTransitionError(() => beginBatchItemRetry(job, 0));
        // Every refused call left the job exactly as it was.
        expect(batchItemStatus(job, 0)).toBe("error");
        expect(itemsOf(job)[0].itemDisposition).toBe("removed");
        expect(itemsOf(job)[0].itemError).toEqual({
          code: "processing-failed",
          message: "Synthetic processing failure.",
        });
        expect(batchItemStatus(job, 1)).toBe("error");
        expect(batchItemStatus(job, 2)).toBe("queued");
      });

      it("refuses a policy-unsupported item with zero mutation (SD-8 remedy stays)", () => {
        let job = readText(batchJob(["a.txt", "b.txt"]), 0, RETRY_TEXT);
        job = recordItemFailed(beginItemProcessing(job, 0), 0, {
          code: "policy-unsupported",
          message: "Blocked by the current policy.",
        });
        expectItemTransitionError(() => beginBatchItemRetry(job, 0));
        expect(itemsOf(job)[0].itemStatus).toBe("error");
        expect(itemsOf(job)[0].itemError).toEqual({
          code: "policy-unsupported",
          message: "Blocked by the current policy.",
        });
      });
    });

    describe("removeBatchItem (witness 4, domain half)", () => {
      it("records the disposition verbatim and touches nothing else", () => {
        let job = processingAndReadFailureJob();
        job = acknowledgeBatchItemError(job, 0);
        const removed = removeBatchItem(job, 1);
        const item = itemsOf(removed)[1];
        expect(item.itemStatus).toBe("error");
        expect(item.itemDisposition).toBe("removed");
        expect(item.itemError).toEqual({ code: "pdf-no-text-layer", message: "No text layer." });
        expect(item.name).toBe("doc-b.txt");
        expect(item.extraction).toBeUndefined();
        // The other items are untouched, including the acknowledgement fact.
        expect(itemsOf(removed)[0]).toEqual(itemsOf(job)[0]);
        expect(itemsOf(removed)[2]).toEqual(itemsOf(job)[2]);
        expect(Object.isFrozen(removed)).toBe(true);
      });

      it("refuses non-error items, non-batch jobs and double removal", () => {
        let job = processingAndReadFailureJob();
        expectItemTransitionError(() => removeBatchItem(job, 2));
        const textJob = createJob({ type: "pasted-text", text: "Synthetic." });
        expect(() => removeBatchItem(textJob, 0)).toThrowError(JobModelError);
        job = removeBatchItem(job, 1);
        // Double Confirm must not corrupt state: the second removal refuses.
        expectItemTransitionError(() => removeBatchItem(job, 1));
        expect(itemsOf(job)[1].itemDisposition).toBe("removed");
      });
    });

    describe("acknowledgeBatchItemError (witness 5, domain half)", () => {
      it("records the fact without changing status, error or blockers", () => {
        const job = processingAndReadFailureJob();
        const acknowledged = acknowledgeBatchItemError(job, 0);
        const item = itemsOf(acknowledged)[0];
        expect(item.itemStatus).toBe("error");
        expect(item.itemAcknowledged).toBe(true);
        expect(item.itemError).toEqual(itemsOf(job)[0].itemError);
        expect(item.itemDisposition).toBeUndefined();
        // The acknowledgement does NOT resolve the active blocker.
        expect(batchHasActiveErrorItems(acknowledged)).toBe(true);
        expect(batchActiveFailedItems(acknowledged).map((entry) => entry.index)).toEqual([0, 1]);
        // Retry and removal stay available afterwards.
        expect(isBatchItemRetryable(acknowledged, 0)).toBe(true);
        expect(() => removeBatchItem(acknowledged, 0)).not.toThrow();
      });

      it("is an exact no-op when already acknowledged and refuses invalid items", () => {
        let job = processingAndReadFailureJob();
        job = acknowledgeBatchItemError(job, 0);
        expect(acknowledgeBatchItemError(job, 0)).toBe(job);
        expectItemTransitionError(() => acknowledgeBatchItemError(job, 2));
        const textJob = createJob({ type: "pasted-text", text: "Synthetic." });
        expect(() => acknowledgeBatchItemError(textJob, 0)).toThrowError(JobModelError);
      });
    });

    describe("no fabricated completion (witness 2, domain half)", () => {
      it("remove and acknowledge never route the item through completed", () => {
        let job = processingAndReadFailureJob();
        job = removeBatchItem(job, 0);
        job = acknowledgeBatchItemError(job, 1);
        expect(batchItemStatus(job, 0)).toBe("error");
        expect(batchItemStatus(job, 1)).toBe("error");
        // The ONLY path to completed still refuses error items.
        expectItemTransitionError(() => recordItemReviewCompletion(job, 0, true));
        expectItemTransitionError(() => recordItemReviewCompletion(job, 1, true));
      });

      it("batchReviewComplete keeps its accepted rule for removed items", () => {
        let job = processingAndReadFailureJob();
        job = removeBatchItem(job, 0);
        job = removeBatchItem(job, 1);
        // Item 2 is queued, so the review is not complete; a removed error
        // item is excluded from the evaluable set, never counted as done.
        expect(batchReviewComplete(job)).toBe(false);
        const allDone = toCompleted(job, 2);
        expect(batchReviewComplete(allDone)).toBe(true);
        expect(batchItemStatus(allDone, 0)).toBe("error");
      });
    });

    describe("artifact authorization follows ACTIVE failures (REC-07 #87)", () => {
      function completedExcept(job: Job, failedIndex: number): Job {
        for (let index = 0; index < itemsOf(job).length; index += 1) {
          if (index === failedIndex) continue;
          if (batchItemStatus(job, index) === "queued") {
            job = toCompleted(job, index);
          }
        }
        return withReviewState(job, { complete: batchReviewComplete(job) });
      }

      it("an active failed item keeps the artifact unauthorized while the Result stays reachable", () => {
        const job = atPrivacyGate(completedExcept(processingAndReadFailureJob(), 0));
        // The blocked Result is navigable; the same authorities still report
        // the artifact as unauthorized (active failure present).
        expect(canAdvanceStep(job)).toBe(true);
        expect(advanceStep(job).currentStep).toBe("export");
        expect(batchHasActiveErrorItems(job)).toBe(true);
      });

      it("a removed item no longer counts as an active failure and the batch can become ready", () => {
        let job = processingAndReadFailureJob();
        job = removeBatchItem(job, 0);
        job = removeBatchItem(job, 1);
        job = atPrivacyGate(completedExcept(job, -1));
        expect(batchHasActiveErrorItems(job)).toBe(false);
        expect(batchReviewComplete(job)).toBe(true);
        expect(canAdvanceStep(job)).toBe(true);
        const exported = advanceStep(job);
        expect(exported.currentStep).toBe("export");
      });

      it("the active-failure facts name only the ACTIVE failed items", () => {
        let job = processingAndReadFailureJob();
        job = removeBatchItem(job, 1);
        job = atPrivacyGate(completedExcept(job, -1));
        const active = batchActiveFailedItems(job);
        expect(active.map((item) => item.name)).toContain("doc-a.txt");
        expect(active.map((item) => item.name)).not.toContain("doc-b.txt");
      });
    });

    describe("policy reset vs recovery facts (#78)", () => {
      it("a removed item is never resurrected: disposition, status and failure survive", () => {
        let job = readText(batchJob(["a.txt", "b.txt"]), 0, RETRY_TEXT);
        job = recordItemFailed(beginItemProcessing(job, 0), 0, {
          code: "policy-unsupported",
          message: "Blocked by the current policy.",
        });
        job = acknowledgeBatchItemError(job, 0);
        job = removeBatchItem(job, 0);
        const next = setPolicy(job, "strict");
        const item = itemsOf(next)[0];
        expect(item.itemStatus).toBe("error");
        expect(item.itemDisposition).toBe("removed");
        expect(item.itemError).toEqual({
          code: "policy-unsupported",
          message: "Blocked by the current policy.",
        });
        expect(item.itemAcknowledged).toBe(true);
        expect(item.extraction).toEqual({
          status: "extracted",
          extractedText: RETRY_TEXT,
        });
        expect(batchHasActiveErrorItems(next)).toBe(false);
      });

      it("a cleared policy-unsupported failure drops its acknowledgement; a retained failure keeps it", () => {
        let job = readText(batchJob(["a.txt", "b.txt"]), 0, RETRY_TEXT);
        job = readFailure(job, 1, "pdf-no-text-layer", "No text layer.");
        job = recordItemFailed(beginItemProcessing(job, 0), 0, {
          code: "policy-unsupported",
          message: "Blocked by the current policy.",
        });
        job = acknowledgeBatchItemError(job, 0);
        job = acknowledgeBatchItemError(job, 1);
        const next = setPolicy(job, "strict");
        // Item 0: the failure IS cleared by the reset — the now-meaningless
        // acknowledgement is cleared with it, and the read text is kept.
        const resetItem = itemsOf(next)[0];
        expect(resetItem.itemStatus).toBe("queued");
        expect(resetItem.itemError).toBeUndefined();
        expect(resetItem.itemAcknowledged).toBeUndefined();
        expect(resetItem.extraction).toEqual({
          status: "extracted",
          extractedText: RETRY_TEXT,
        });
        // Item 1: the read failure is retained unchanged WITH its acknowledgement.
        const retainedItem = itemsOf(next)[1];
        expect(retainedItem.itemStatus).toBe("error");
        expect(retainedItem.itemError).toEqual({
          code: "pdf-no-text-layer",
          message: "No text layer.",
        });
        expect(retainedItem.itemAcknowledged).toBe(true);
      });
    });
  });
});
