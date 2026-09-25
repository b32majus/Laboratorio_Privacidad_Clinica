/**
 * Job domain model (SPEC_V4_APP_AND_REVIEW.md §2/§3).
 *
 * Pure, DOM-independent, React-free. Every domain object is frozen; all
 * transitions return NEW frozen objects (same immutability style as the T01
 * ReviewSession domain). Detection and review fields are minimal structural
 * placeholders: the real recognizers (T05+) and ReviewSession wiring (T07/T08)
 * own real capabilities, so this model never fakes them.
 *
 * Sensitive source content is memory-only by design (CURRENT_DECISIONS.md
 * D-013): job data lives in RAM, is never persisted, serialized to storage,
 * or placed in URLs. Keep this module free of any persistence or network code.
 */

/** Job families inferred from input (SPEC §2, CONTEXT.md §3). */
export type JobKind = "text" | "document" | "document-batch" | "structured";

/** Explicit Privacy Policy vocabulary (CURRENT_DECISIONS.md D-007). */
export type PrivacyPolicyId = "standard" | "external-ai" | "longitudinal-research" | "strict";

/** Canonical flow steps, in order (SPEC §2, D-001). */
export type FlowStep = "input" | "configure" | "review" | "privacy-gate" | "export";

export const FLOW_STEPS: readonly FlowStep[] = [
  "input",
  "configure",
  "review",
  "privacy-gate",
  "export",
];

/**
 * Heavy-processing lifecycle state. The Web Worker boundary arrives with a
 * later ticket; new jobs stay "idle" until real processing is wired.
 */
export type ProcessingState = "idle" | "running" | "succeeded" | "failed";

/**
 * Lifecycle status placeholder: the real JobStatus vocabulary (draft/active/
 * completed…) is defined by later tickets that own job lifecycle semantics.
 */
export type JobStatus = "active";

/**
 * Minimal structural placeholder pending recognizer wiring (T05+).
 * Real detection records carry spans, confidence bands, reasons and
 * review requirements; do not extend this ad hoc.
 */
export type Detection = {
  readonly id: string;
  readonly categoryId: string;
  readonly confidence: number;
};

/**
 * Minimal review-completeness placeholder pending ReviewSession wiring
 * (T07/T08). New jobs start incomplete, so export stays fail-closed
 * (D-004/D-009) until a real review state says otherwise.
 */
export type ReviewState = {
  readonly complete: boolean;
};

export type JobWarning = {
  readonly code: string;
  readonly message: string;
};

export type JobError = {
  readonly code: string;
  readonly message: string;
};

/**
 * Availability of the two independent output surfaces (D-005): Safe Output
 * and Confidential Audit. Both unavailable until real export wiring exists.
 */
export type OutputAvailability = {
  readonly safeOutputReady: boolean;
  readonly confidentialAuditReady: boolean;
};

/**
 * File metadata plus its T06 extraction outcome. File BYTES are never held in
 * this model: the input adapters (app-v4/src/input) own extraction and hand
 * over only the extracted text, which stays memory-only (D-013).
 *
 * `extraction` is optional so structured files and metadata-only drafts can be
 * represented without fake extraction state; a document file whose extraction
 * FAILED is an explicit non-success that {@link createJob} refuses (D-009).
 */
export type JobSourceFileExtraction =
  | { readonly status: "extracted"; readonly extractedText: string }
  | {
      readonly status: "failed";
      readonly error: { readonly code: string; readonly message: string };
    };

export type JobSourceFile = {
  readonly name: string;
  readonly extension: string;
  readonly extraction?: JobSourceFileExtraction;
};

/**
 * Job source. `pasted-text` content is sensitive and memory-only (D-013):
 * never persisted, never logged, never placed in URLs.
 */
export type JobSource =
  | { readonly type: "pasted-text"; readonly text: string }
  | { readonly type: "files"; readonly files: readonly JobSourceFile[] };

/** Machine-readable codes carried by {@link JobModelError}. */
export type JobModelErrorCode =
  | "empty-input"
  | "ambiguous-input"
  | "unsupported-file-type"
  | "extraction-failed"
  | "pdf-no-text-layer"
  | "invalid-policy"
  | "invalid-step"
  | "review-incomplete";

/** Typed domain error; carries a machine-readable code (D-009 fail-closed). */
export class JobModelError extends Error {
  readonly code: JobModelErrorCode;

  constructor(code: JobModelErrorCode, message: string) {
    super(message);
    this.name = "JobModelError";
    this.code = code;
  }
}

/** Input accepted by {@link createJob}. Exactly one variant at a time. */
export type JobInput =
  | { readonly type: "pasted-text"; readonly text: string }
  | { readonly type: "files"; readonly files: readonly JobSourceFile[] };

const DOCUMENT_EXTENSIONS: ReadonlySet<string> = new Set(["txt", "pdf", "docx"]);
const STRUCTURED_EXTENSIONS: ReadonlySet<string> = new Set(["csv", "xls", "xlsx"]);

const POLICY_IDS: readonly PrivacyPolicyId[] = [
  "standard",
  "external-ai",
  "longitudinal-research",
  "strict",
];

/** The single valid JobStatus value until later tickets define lifecycle. */
const JOB_STATUS: JobStatus = "active";

function stepIndex(step: FlowStep): number {
  return FLOW_STEPS.indexOf(step);
}

function freezeDeep<T>(value: T): T {
  if (value !== null && typeof value === "object") {
    for (const key of Object.keys(value as object)) {
      freezeDeep((value as Record<string, unknown>)[key]);
    }
    Object.freeze(value);
  }
  return value;
}

type FileClass = "document" | "structured";

/** Whether the lowercase extension routes through the document adapters. */
export function isDocumentExtension(extension: string): boolean {
  return DOCUMENT_EXTENSIONS.has(extension);
}

/** Whether the lowercase extension routes through structured input (T18). */
export function isStructuredExtension(extension: string): boolean {
  return STRUCTURED_EXTENSIONS.has(extension);
}

function classifyFile(file: JobSourceFile): FileClass {
  if (DOCUMENT_EXTENSIONS.has(file.extension)) return "document";
  if (STRUCTURED_EXTENSIONS.has(file.extension)) return "structured";
  throw new JobModelError(
    "unsupported-file-type",
    `File "${file.name}" has an unsupported type ".${file.extension}"; supported types are TXT, PDF, DOCX, CSV, XLS and XLSX.`
  );
}

/**
 * Infer the job family from input (SPEC §2). Fail-closed (D-009): empty,
 * mixed or invalid input throws a typed error instead of silently picking a
 * kind.
 */
export function inferJobKind(input: JobInput): JobKind {
  if (input.type === "pasted-text") {
    if (input.text.trim().length === 0) {
      throw new JobModelError(
        "empty-input",
        "Pasted text is empty; provide text before creating a job."
      );
    }
    return "text";
  }

  if (input.files.length === 0) {
    throw new JobModelError(
      "empty-input",
      "No files provided; select at least one supported file before creating a job."
    );
  }

  const classes = input.files.map(classifyFile);
  const hasDocument = classes.includes("document");
  const hasStructured = classes.includes("structured");
  if (hasDocument && hasStructured) {
    throw new JobModelError(
      "ambiguous-input",
      "Document and structured files cannot be mixed in one job; create separate jobs."
    );
  }
  if (hasStructured) return "structured";
  return input.files.length === 1 ? "document" : "document-batch";
}

function describeFiles(files: readonly JobSourceFile[]): string {
  return files.length === 1 ? files[0].name : `${files.length} files`;
}

function nextJobId(): string {
  return `job-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

/**
 * Map an adapter extraction failure code to the Job error vocabulary. Codes
 * without a dedicated Job counterpart collapse to "extraction-failed".
 */
function jobErrorCodeFor(extractionCode: string): JobModelErrorCode {
  switch (extractionCode) {
    case "empty-input":
      return "empty-input";
    case "unsupported-format":
      return "unsupported-file-type";
    case "pdf-no-text-layer":
      return "pdf-no-text-layer";
    default:
      return "extraction-failed";
  }
}

/**
 * Fail-closed guard (D-009): a document/document-batch job must not be
 * created from files whose extraction failed — a failed file is never
 * representable as an apparently successful empty document. The error names
 * every failing file so failed batch items stay visible (D-011).
 */
function assertExtractionsUsable(files: readonly JobSourceFile[]): void {
  const failed = files.filter((file) => file.extraction?.status === "failed");
  if (failed.length === 0) return;

  const details = failed
    .map(
      (file) =>
        `"${file.name}": ${(file.extraction as { error: { message: string } }).error.message}`
    )
    .join(" ");
  const firstCode = (failed[0].extraction as { error: { code: string } }).error.code;
  const code = jobErrorCodeFor(firstCode);
  const message =
    failed.length === 1
      ? `Document "${failed[0].name}" could not be used to create a job: ${
          (failed[0].extraction as { error: { message: string } }).error.message
        }`
      : `Some documents could not be used and no job was created — failing files: ${details}`;
  throw new JobModelError(code, message);
}

/**
 * Create a new Job at the canonical first step. The returned object and all
 * nested objects/arrays are frozen.
 */
export function createJob(input: JobInput): Job {
  const kind = inferJobKind(input);
  if (input.type === "files" && (kind === "document" || kind === "document-batch")) {
    assertExtractionsUsable(input.files);
  }
  const source: JobSource =
    input.type === "pasted-text"
      ? { type: "pasted-text", text: input.text }
      : { type: "files", files: [...input.files] };

  return freezeDeep({
    id: nextJobId(),
    name: input.type === "pasted-text" ? "Pasted text" : describeFiles(input.files),
    kind,
    source,
    policyId: "standard",
    status: JOB_STATUS,
    processing: "idle" as ProcessingState,
    detections: [] as Detection[],
    review: { complete: false } as ReviewState,
    warnings: [] as JobWarning[],
    errors: [] as JobError[],
    outputs: {
      safeOutputReady: false,
      confidentialAuditReady: false,
    } as OutputAvailability,
    currentStep: "input" as FlowStep,
    visitedSteps: ["input"] as FlowStep[],
  });
}

/** Full Job contract (SPEC §3). All fields are immutable. */
export type Job = {
  readonly id: string;
  readonly name: string;
  readonly kind: JobKind;
  readonly source: JobSource;
  readonly policyId: PrivacyPolicyId;
  readonly status: JobStatus;
  readonly processing: ProcessingState;
  readonly detections: readonly Detection[];
  readonly review: ReviewState;
  readonly warnings: readonly JobWarning[];
  readonly errors: readonly JobError[];
  readonly outputs: OutputAvailability;
  /** Canonical flow position. */
  readonly currentStep: FlowStep;
  /** Steps already reached; backward navigation is allowed among these. */
  readonly visitedSteps: readonly FlowStep[];
};

/**
 * Whether the immediate forward transition out of the current step is
 * allowed. Export is gated on review completeness (D-004); every other
 * forward transition along the canonical order is allowed.
 */
export function canAdvanceStep(job: Job): boolean {
  const index = stepIndex(job.currentStep);
  if (index < 0 || index === FLOW_STEPS.length - 1) return false;
  const next = FLOW_STEPS[index + 1];
  return !(next === "export" && !job.review.complete);
}

/**
 * Advance exactly one step forward along the canonical order. Throws a typed
 * error when the transition is invalid or gated.
 */
export function advanceStep(job: Job): Job {
  const index = stepIndex(job.currentStep);
  if (index < 0 || index >= FLOW_STEPS.length - 1) {
    throw new JobModelError("invalid-step", `Cannot advance from step "${job.currentStep}".`);
  }
  const next = FLOW_STEPS[index + 1];
  if (next === "export" && !job.review.complete) {
    throw new JobModelError(
      "review-incomplete",
      "Export is blocked while mandatory review is incomplete."
    );
  }
  return moveToStep(job, next);
}

/**
 * Move to a step. Allowed: the current step (no-op), any already-visited
 * step (backward), or the immediate next forward step when its guard passes.
 * Any other jump throws (fail-closed; SPEC §2 canonical order).
 */
export function goToStep(job: Job, target: FlowStep): Job {
  if (!FLOW_STEPS.includes(target)) {
    throw new JobModelError("invalid-step", `Unknown flow step "${String(target)}".`);
  }
  if (target === job.currentStep) return job;
  if (job.visitedSteps.includes(target)) return moveToStep(job, target);

  const isImmediateNext = stepIndex(target) === stepIndex(job.currentStep) + 1;
  if (isImmediateNext && target === "export" && !job.review.complete) {
    throw new JobModelError(
      "review-incomplete",
      "Export is blocked while mandatory review is incomplete."
    );
  }
  if (isImmediateNext) return moveToStep(job, target);

  throw new JobModelError(
    "invalid-step",
    `Invalid step jump from "${job.currentStep}" to "${target}"; steps must be visited in canonical order.`
  );
}

function moveToStep(job: Job, target: FlowStep): Job {
  const visitedSteps = job.visitedSteps.includes(target)
    ? job.visitedSteps
    : [...job.visitedSteps, target];
  return freezeDeep({ ...job, currentStep: target, visitedSteps });
}

/** Whether the step nav may offer this step for the current job. */
export function isStepAccessible(job: Job, target: FlowStep): boolean {
  if (target === job.currentStep) return true;
  if (job.visitedSteps.includes(target)) return true;
  return stepIndex(target) === stepIndex(job.currentStep) + 1 && canAdvanceStep(job);
}

/**
 * Set the job's Privacy Policy (D-007 vocabulary).
 *
 * Review-state validity invariant (PR #40 corrective C2): a ReviewSession is
 * produced under exactly one policy, so a REAL policy change resets the
 * derived review-dependent state in the same frozen transition — review
 * completeness and both output availabilities return to their fail-closed
 * `false` defaults. The flow position is kept: the reviewer re-enters Review
 * under the new policy and a fresh session replaces the now-invalid one.
 * An unchanged policy is an exact no-op (the same object is returned).
 */
export function setPolicy(job: Job, policyId: PrivacyPolicyId): Job {
  if (!POLICY_IDS.includes(policyId)) {
    throw new JobModelError("invalid-policy", `Unknown privacy policy "${String(policyId)}".`);
  }
  if (policyId === job.policyId) return job;
  return freezeDeep({
    ...job,
    policyId,
    review: { complete: false } as ReviewState,
    outputs: {
      safeOutputReady: false,
      confidentialAuditReady: false,
    } as OutputAvailability,
  });
}

/**
 * Replace the placeholder review-completeness state. Temporary domain
 * transition until T07/T08 wire the real ReviewSession; it exists so the
 * export gate can be exercised deterministically and so later tickets swap
 * the placeholder for real review state without changing call sites.
 */
export function withReviewState(job: Job, review: ReviewState): Job {
  return freezeDeep({ ...job, review });
}
