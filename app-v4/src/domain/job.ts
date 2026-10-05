/**
 * Job domain model (SPEC_V4_APP_AND_REVIEW.md §2/§3).
 *
 * Pure, DOM-independent, React-free. Every domain object is frozen; all
 * transitions return NEW frozen objects (same immutability style as the T01
 * ReviewSession domain). Detection and review fields are minimal structural
 * placeholders: the real recognizers (T05+) and ReviewSession wiring (T07/T08)
 * own real capabilities, so this model never fakes them.
 *
 * A document batch is a normal Job (SPEC_V4_BATCH_AND_STRUCTURED.md §1) whose
 * per-file state lives ON the source file (`itemStatus`), so a failed document
 * stays visible inside the batch instead of aborting the whole job. Batch
 * intake is two-phase (T17 #21 SD-2): creation takes metadata only and every
 * item starts `queued`; the read, process and review outcomes are then recorded
 * through the item transitions in this module.
 *
 * Sensitive source content is memory-only by design (CURRENT_DECISIONS.md
 * D-013): job data lives in RAM, is never persisted, serialized to storage,
 * or placed in URLs. Keep this module free of any persistence or network code.
 */
import { oversizeInputFor } from "../engine/input-limits";

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
 * Heavy-processing lifecycle state for ONE processing attempt (T15 #19,
 * D-009 fail-closed). The Web Worker boundary arrives with a later ticket.
 *
 * The five states are deliberately distinguishable so an outcome can never be
 * inferred from its absence:
 * - `idle`: no processing attempt has been made (a new job's default).
 * - `running`: an attempt was explicitly started ({@link beginProcessing}).
 * - `succeeded`: the attempt completed and its outcome was EXPLICITLY
 *   recorded. This state is reachable ONLY through
 *   {@link completeProcessing}; nothing else may infer success.
 * - `failed`: the attempt ended in a recognized typed failure
 *   ({@link failProcessing}).
 * - `unknown`: an attempt was made but its outcome could not be established
 *   (an unrecognized throw); the job is NOT silently treated as unprocessed.
 */
export type ProcessingState = "idle" | "running" | "succeeded" | "failed" | "unknown";

/**
 * Per-item lifecycle status for a `document-batch` job
 * (SPEC_V4_BATCH_AND_STRUCTURED.md §1, verbatim). One status exists per source
 * file, keyed by that file's index in {@link JobSource} `files` (selection
 * order, stable).
 *
 * The six states are deliberately distinguishable so an item outcome is never
 * inferred from its absence:
 * - `queued`: selected and read (or read pending), no processing attempt yet.
 * - `reading`: a read is explicitly in progress ({@link beginItemRead}).
 * - `processing`: a processing attempt is explicitly running
 *   ({@link beginItemProcessing}).
 * - `review-required`: processing succeeded and the item still needs review
 *   ({@link recordItemProcessed}). This is the default post-processing state.
 * - `completed`: the item's review is complete ({@link
 *   recordItemReviewCompletion}), the ONLY path to `completed`.
 * - `error`: the read or processing attempt produced a typed failure
 *   ({@link JobSourceFile.itemError}); the item stays visible in the batch.
 */
export type BatchItemStatus =
  "queued" | "reading" | "processing" | "review-required" | "completed" | "error";

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
 *
 * Batch item-state invariant (T17 #21 SD-1/SD-2/SD-3): on `document-batch`
 * jobs both `itemStatus` and `itemError` follow the item-state contract —
 * fail-closed validated at creation and maintained by the item transitions in
 * this module. On single-document and text jobs they are absent. A READ failure
 * is recorded as `itemError` with no `extraction`, and the adapter's
 * `extraction: { status: "failed" }` shape never appears on a batch item (read
 * failures are recorded as `itemError` through {@link recordItemRead}). A
 * PROCESSING failure KEEPS the held read text alongside `itemError` (T17 #21
 * WU-C3): source text is policy-INDEPENDENT, so the read artifact must survive
 * a policy change and keep the item genuinely retryable.
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
  /** Batch item lifecycle state; present on `document-batch` items only. */
  readonly itemStatus?: BatchItemStatus;
  /** Batch item typed failure; present exactly when `itemStatus` is `error`. */
  readonly itemError?: JobError;
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
  | "input-too-large"
  | "invalid-policy"
  | "invalid-step"
  | "review-incomplete"
  | "invalid-processing-transition"
  | "invalid-batch-intake"
  | "batch-item-failed";

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

/**
 * Machine-readable processing-failure vocabulary (T15 #19). It is deliberately
 * a closed set: an unrecognized error collapses to `processing-unknown`
 * instead of inventing a new code.
 */
export type ProcessingFailureCode =
  | "input-too-large"
  | "invalid-source"
  | "policy-unsupported"
  | "processing-failed"
  | "processing-unknown";

/**
 * Typed processing-failure record appended to {@link Job.errors} by
 * {@link failProcessing}. `message` is always authored by a typed contract
 * (or the fixed unknown-outcome message); a raw unrecognized error message is
 * never carried here.
 */
export type ProcessingFailure = {
  readonly code: ProcessingFailureCode;
  readonly message: string;
};

/**
 * Read-phase outcome handed to {@link recordItemRead} (T17 #21 SD-2). The read
 * adapters own file bytes and hand over either extracted text or a typed
 * failure; the domain never sees a partially-read document. The `failure.error`
 * message is the adapter's authored message and is retained on the item.
 */
export type BatchItemReadOutcome =
  | { readonly ok: true; readonly extractedText: string }
  | { readonly ok: false; readonly error: { readonly code: string; readonly message: string } };

/** A failed batch item, as surfaced by {@link batchFailedItems}. */
export type BatchFailedItem = {
  readonly index: number;
  readonly name: string;
  readonly error: JobError;
};

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
 * kind. Oversize pasted text is refused here as well as in the input adapter
 * (SD-5: the domain is the authority, the adapter is a convenience), with the
 * shared actionable message verbatim. The boundary itself is never
 * re-implemented here: it is asked of the size authority, so the rule lives in
 * exactly one place.
 */
export function inferJobKind(input: JobInput): JobKind {
  if (input.type === "pasted-text") {
    if (input.text.trim().length === 0) {
      throw new JobModelError(
        "empty-input",
        "Pasted text is empty; provide text before creating a job."
      );
    }
    const oversizeInput = oversizeInputFor(input.text);
    if (oversizeInput !== null) {
      throw new JobModelError("input-too-large", oversizeInput.message);
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
    case "input-too-large":
      return "input-too-large";
    default:
      return "extraction-failed";
  }
}

/**
 * Fail-closed guard (D-009): a document/document-batch job must not be
 * created from files whose extraction failed — a failed file is never
 * representable as an apparently successful empty document. The error names
 * every failing file so failed batch items stay visible (D-011).
 *
 * A second, independent branch refuses a file whose extraction SUCCEEDED but
 * whose text exceeds the supported size authority (T15 #19, SD-4/SD-5). This
 * is the domain-level lock: it refuses an oversize extracted text even when a
 * caller bypasses the input adapters, and it runs BEFORE any job object is
 * created. Every oversize file is named, in input order, embedding the shared
 * actionable message verbatim.
 */
function assertExtractionsUsable(files: readonly JobSourceFile[]): void {
  const failed = files.filter((file) => file.extraction?.status === "failed");
  if (failed.length > 0) {
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

  const oversize: { name: string; message: string }[] = [];
  for (const file of files) {
    const extraction = file.extraction;
    if (extraction?.status !== "extracted") continue;
    // The boundary is asked of the size authority, never re-implemented here.
    const oversizeInput = oversizeInputFor(extraction.extractedText);
    if (oversizeInput !== null) {
      oversize.push({ name: file.name, message: oversizeInput.message });
    }
  }
  if (oversize.length === 0) return;

  const message =
    oversize.length === 1
      ? `Document "${oversize[0].name}" is too large to create a job: ${oversize[0].message}`
      : `Some documents are too large and no job was created — failing files: ${oversize
          .map(({ name, message: oversizeMessage }) => `"${name}": ${oversizeMessage}`)
          .join(" ")}`;
  throw new JobModelError("input-too-large", message);
}

/**
 * Two-phase batch intake (T17 #21 SD-2). A batch job is created from file
 * METADATA only: the read phase owns extraction outcomes AFTER creation, so a
 * file that already carries an extraction outcome is refused fail-closed with
 * `invalid-batch-intake` and every failing file is named. Every accepted item
 * starts `queued` with neither `extraction` nor `itemError`.
 */
function queueBatchFiles(files: readonly JobSourceFile[]): JobSourceFile[] {
  const preExtracted = files.filter((file) => file.extraction !== undefined);
  if (preExtracted.length > 0) {
    const names = preExtracted.map((file) => `"${file.name}"`).join(", ");
    throw new JobModelError(
      "invalid-batch-intake",
      `Batch creation accepts file metadata only, but ${
        preExtracted.length === 1
          ? "this file already carries an extraction outcome"
          : "these files already carry extraction outcomes"
      }: ${names}. The read phase records each item's outcome after creation; remove the pre-read text and retry.`
    );
  }
  return files.map((file) => ({
    name: file.name,
    extension: file.extension,
    itemStatus: "queued" as BatchItemStatus,
  }));
}

/**
 * Resolve a batch job's source files or fail closed. Every batch item helper
 * and transition funnels through here so a non-batch job can never be silently
 * treated as an empty batch.
 */
function batchFiles(job: Job, operation: string): readonly JobSourceFile[] {
  if (job.kind !== "document-batch" || job.source.type !== "files") {
    throw new JobModelError(
      "invalid-processing-transition",
      `${operation} requires a document-batch job; job "${job.id}" is kind "${job.kind}".`
    );
  }
  return job.source.files;
}

/** Resolve one batch item by index or fail closed on an out-of-range index. */
function requireBatchItem(
  files: readonly JobSourceFile[],
  index: number,
  operation: string
): JobSourceFile {
  const file = files[index];
  if (file === undefined) {
    throw new JobModelError(
      "invalid-processing-transition",
      `${operation} references batch item index ${index}, but the batch has ${files.length} item(s).`
    );
  }
  return file;
}

/**
 * Fail-closed guard for an item transition: the current status must be exactly
 * `expected`, otherwise the item is NOT advanced and a typed error names the
 * item and the expected state.
 */
function assertItemStatus(
  file: JobSourceFile,
  index: number,
  operation: string,
  expected: BatchItemStatus
): void {
  if (file.itemStatus !== expected) {
    throw new JobModelError(
      "invalid-processing-transition",
      `${operation} for batch item ${index} ("${file.name}") requires status "${expected}", but the item is "${String(
        file.itemStatus
      )}".`
    );
  }
}

/** Replace one item immutably and freeze the resulting job. */
function replaceBatchItem(
  job: Job,
  files: readonly JobSourceFile[],
  index: number,
  item: JobSourceFile
): Job {
  const updated = [...files];
  updated[index] = item;
  return freezeDeep({ ...job, source: { type: "files", files: updated } });
}

/**
 * Start the read phase for one item (T17 #21 SD-2): `queued → reading`. Only a
 * `queued` item may be read; any other state throws and no item is changed.
 */
export function beginItemRead(job: Job, index: number): Job {
  const files = batchFiles(job, "beginItemRead");
  const file = requireBatchItem(files, index, "beginItemRead");
  assertItemStatus(file, index, "beginItemRead", "queued");
  return replaceBatchItem(job, files, index, { ...file, itemStatus: "reading" });
}

/**
 * Record a read outcome for one item (T17 #21 SD-2/SD-3): `reading → queued`
 * (with the extracted text held) or `reading → error` (with a typed item
 * error). The size authority is asked about successful text, never
 * re-implemented:
 *
 * - oversize text becomes an `input-too-large` item error carrying the shared
 *   actionable message verbatim; the refused text is NOT stored on the item;
 * - empty/whitespace-only text becomes an `empty-input` item error;
 * - a typed read failure is mapped through {@link jobErrorCodeFor} and the
 *   adapter's authored message is retained.
 *
 * A successful item carries `extraction` only; a failed item carries
 * `itemError` only (never both). Wrong state (`reading` expected) throws.
 */
export function recordItemRead(job: Job, index: number, outcome: BatchItemReadOutcome): Job {
  const files = batchFiles(job, "recordItemRead");
  const file = requireBatchItem(files, index, "recordItemRead");
  assertItemStatus(file, index, "recordItemRead", "reading");

  let item: JobSourceFile;
  if (outcome.ok) {
    const oversizeInput = oversizeInputFor(outcome.extractedText);
    if (oversizeInput !== null) {
      item = {
        name: file.name,
        extension: file.extension,
        itemStatus: "error",
        itemError: { code: "input-too-large", message: oversizeInput.message },
      };
    } else if (outcome.extractedText.trim().length === 0) {
      item = {
        name: file.name,
        extension: file.extension,
        itemStatus: "error",
        itemError: {
          code: "empty-input",
          message: `The file "${file.name}" produced no usable text; provide a document with text content or remove it.`,
        },
      };
    } else {
      item = {
        name: file.name,
        extension: file.extension,
        itemStatus: "queued",
        extraction: { status: "extracted", extractedText: outcome.extractedText },
      };
    }
  } else {
    item = {
      name: file.name,
      extension: file.extension,
      itemStatus: "error",
      itemError: { code: jobErrorCodeFor(outcome.error.code), message: outcome.error.message },
    };
  }
  return replaceBatchItem(job, files, index, item);
}

/**
 * Start processing for one item (T17 #21 SD-4): `queued → processing`. The
 * item's held extraction (if any) is preserved; any other state throws.
 */
export function beginItemProcessing(job: Job, index: number): Job {
  const files = batchFiles(job, "beginItemProcessing");
  const file = requireBatchItem(files, index, "beginItemProcessing");
  assertItemStatus(file, index, "beginItemProcessing", "queued");
  return replaceBatchItem(job, files, index, { ...file, itemStatus: "processing" });
}

/**
 * Record a successful processing pass for one item: `processing →
 * review-required`. Success is never inferred, so only an explicitly started
 * item can reach it; any other state throws.
 */
export function recordItemProcessed(job: Job, index: number): Job {
  const files = batchFiles(job, "recordItemProcessed");
  const file = requireBatchItem(files, index, "recordItemProcessed");
  assertItemStatus(file, index, "recordItemProcessed", "processing");
  return replaceBatchItem(job, files, index, { ...file, itemStatus: "review-required" });
}

/**
 * Record a processing FAILURE for one item (T17 #21 SD-3): `processing →
 * error`. The classified {@link ProcessingFailure} is retained as the item's
 * `itemError` (its message is already authored by contract). The held
 * `extraction` (the read artifact) is RETAINED (T17 #21 WU-C3): source text is
 * policy-INDEPENDENT, so a later policy change can return the item to `queued`
 * with its text intact and it stays genuinely retryable. Only a READ failure
 * carries `itemError` without text (see {@link recordItemRead}). The failed
 * item stays visible in the batch.
 */
export function recordItemFailed(job: Job, index: number, failure: ProcessingFailure): Job {
  const files = batchFiles(job, "recordItemFailed");
  const file = requireBatchItem(files, index, "recordItemFailed");
  assertItemStatus(file, index, "recordItemFailed", "processing");
  return replaceBatchItem(job, files, index, {
    ...file,
    itemStatus: "error",
    itemError: { code: failure.code, message: failure.message },
  });
}

/**
 * Record the review outcome for one item (T17 #21 SD-5). This is the ONLY path
 * to `completed`:
 * - `review-required` + `complete: true` → `completed`;
 * - `completed` + `complete: false` → `review-required` (review re-opened);
 * - the matching same-state calls (`review-required`/false,
 *   `completed`/true) are an exact no-op returning the same object;
 * - any other state throws.
 *
 * Document navigation never calls this: only an explicit review decision for
 * the item may change its status.
 */
export function recordItemReviewCompletion(job: Job, index: number, complete: boolean): Job {
  const files = batchFiles(job, "recordItemReviewCompletion");
  const file = requireBatchItem(files, index, "recordItemReviewCompletion");
  if (file.itemStatus === "review-required" && complete === false) return job;
  if (file.itemStatus === "completed" && complete === true) return job;
  if (file.itemStatus === "review-required" && complete === true) {
    return replaceBatchItem(job, files, index, { ...file, itemStatus: "completed" });
  }
  if (file.itemStatus === "completed" && complete === false) {
    return replaceBatchItem(job, files, index, { ...file, itemStatus: "review-required" });
  }
  throw new JobModelError(
    "invalid-processing-transition",
    `recordItemReviewCompletion for batch item ${index} ("${file.name}") is not allowed from status "${String(
      file.itemStatus
    )}".`
  );
}

/**
 * Read one item's lifecycle status (T17 #21 SD-6). Throws for a non-batch job
 * or an out-of-range index; a batch item always carries a status.
 */
export function batchItemStatus(job: Job, index: number): BatchItemStatus {
  const files = batchFiles(job, "batchItemStatus");
  const file = requireBatchItem(files, index, "batchItemStatus");
  if (file.itemStatus === undefined) {
    throw new JobModelError(
      "invalid-processing-transition",
      `Batch item ${index} ("${file.name}") has no item status; batch items are always created with one.`
    );
  }
  return file.itemStatus;
}

/**
 * Every failed batch item (T17 #21 SD-6), in input order, with its index, name
 * and typed error. Fail-closed: an `error` item without a recorded
 * `itemError` throws instead of being dropped. Throws for a non-batch job.
 */
export function batchFailedItems(job: Job): readonly BatchFailedItem[] {
  const files = batchFiles(job, "batchFailedItems");
  const failed: BatchFailedItem[] = [];
  files.forEach((file, index) => {
    if (file.itemStatus !== "error") return;
    if (file.itemError === undefined) {
      throw new JobModelError(
        "invalid-processing-transition",
        `Batch item ${index} ("${file.name}") is in "error" without a recorded itemError.`
      );
    }
    failed.push({ index, name: file.name, error: file.itemError });
  });
  return failed;
}

/**
 * Whether every non-error batch item is `completed` (T17 #21 SD-6). A batch
 * whose items are ALL error returns `false` (an all-failed batch is not a
 * completed review). Throws for a non-batch job.
 */
export function batchReviewComplete(job: Job): boolean {
  const files = batchFiles(job, "batchReviewComplete");
  const evaluable = files.filter((file) => file.itemStatus !== "error");
  if (evaluable.length === 0) return false;
  return evaluable.every((file) => file.itemStatus === "completed");
}

/** Whether the batch contains any failed item (T17 #21 SD-6). */
export function batchHasErrorItems(job: Job): boolean {
  return batchFailedItems(job).length > 0;
}

/**
 * Factual remedy sentence for failed batch items (T17 #21 CORR-B). The remedy
 * must match the failure semantics:
 *
 * - `policy-unsupported` means the document is HEALTHY input blocked by the
 *   current Privacy Policy, so the remedy is to choose a supported policy and
 *   retry — never to remove the document;
 * - every other failure is a read/source/input problem, whose remedy remains
 *   job recreation without the failing file(s);
 * - a mixed batch names both remedies.
 *
 * The caller supplies one error code per failed item (never empty). The
 * underlying typed failure code/message is always preserved ALONGSIDE this
 * remedy, never replaced by it.
 */
export function batchFailureRemedy(errorCodes: readonly string[]): string {
  const policyBlocked = errorCodes.some((code) => code === "policy-unsupported");
  const otherFailures = errorCodes.some((code) => code !== "policy-unsupported");
  if (policyBlocked && otherFailures) {
    return "Choose a supported Privacy Policy for the policy-blocked documents, and create a new job without the unreadable ones to continue.";
  }
  if (policyBlocked) {
    return "Choose a supported Privacy Policy and start review again.";
  }
  return errorCodes.length === 1
    ? "Create a new job without it to continue."
    : "Create a new job without them to continue.";
}

/**
 * Batch export blocker (T17 #21 SD-7, remedy copy corrected by CORR-B). Called
 * only for `document-batch` jobs, AFTER the review-completeness guard so
 * `review-incomplete` keeps priority when both apply. A single failed item
 * blocks export with the typed `batch-item-failed` code naming the failed
 * files and the {@link batchFailureRemedy remedy} that matches each failure.
 */
function assertBatchExportable(job: Job): void {
  if (job.kind !== "document-batch" || !batchHasErrorItems(job)) return;
  const failed = batchFailedItems(job);
  const names = failed.map((item) => `"${item.name}"`).join(", ");
  const subject =
    failed.length === 1
      ? `a batch item failed: ${names}`
      : `${failed.length} batch items failed: ${names}`;
  const remedy = batchFailureRemedy(failed.map((item) => item.error.code));
  throw new JobModelError("batch-item-failed", `Export is blocked because ${subject}. ${remedy}`);
}

/**
 * Policy-change item reset (T17 #21 SD-8, corrected by WU-C3 and CORR-A).
 * A policy change invalidates PROCESSING-derived state, never the
 * policy-independent read phase:
 *
 * - `queued` items are left untouched (already pre-processing, possibly
 *   holding their read text);
 * - `reading` items STAY `reading` (CORR-A): their in-flight read is not a
 *   processing-derived outcome, so it must still be able to commit through
 *   {@link recordItemRead} under the new policy instead of throwing
 *   `invalid-processing-transition`;
 * - `processing`/`review-required`/`completed` items return to `queued`
 *   KEEPING their held `extraction` and with any `itemError` cleared: the
 *   read artifact is policy-INDEPENDENT, so only the processing-derived
 *   state is invalidated;
 * - a `policy-unsupported` error item also returns to `queued` keeping its
 *   held text (the new policy may support it, so the item is genuinely
 *   retryable, WU-C3);
 * - every other error item, including read errors, is retained unchanged
 *   (read errors are policy-independent).
 */
function resetBatchItemsForPolicy(files: readonly JobSourceFile[]): JobSourceFile[] {
  return files.map((file) => {
    // CORR-A: the read phase is policy-INDEPENDENT, so a `queued` item needs
    // no reset at all and a `reading` item stays `reading` — resetting it to
    // `queued` would make its in-flight read impossible to commit.
    if (file.itemStatus === "queued" || file.itemStatus === "reading") return file;
    const resets = file.itemStatus !== "error" || file.itemError?.code === "policy-unsupported";
    if (!resets) return file;
    const resetItem: JobSourceFile = {
      name: file.name,
      extension: file.extension,
      itemStatus: "queued" as BatchItemStatus,
    };
    return file.extraction === undefined
      ? resetItem
      : { ...resetItem, extraction: file.extraction };
  });
}

/**
 * Create a new Job at the canonical first step. The returned object and all
 * nested objects/arrays are frozen.
 */
export function createJob(input: JobInput): Job {
  const kind = inferJobKind(input);
  let source: JobSource;
  if (input.type === "pasted-text") {
    source = { type: "pasted-text", text: input.text };
  } else if (kind === "document-batch") {
    // Two-phase intake (SD-2): metadata only, every item starts `queued`.
    source = { type: "files", files: queueBatchFiles(input.files) };
  } else {
    if (kind === "document") {
      // Single-document all-or-nothing contract preserved (T15): refuse a
      // failed extraction and an oversize extracted text at creation.
      assertExtractionsUsable(input.files);
    }
    source = { type: "files", files: [...input.files] };
  }

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
 * Whether the export transition guard is satisfied. Export is gated on review
 * completeness (D-004) and, for a document-batch, on the absence of failed
 * items (T17 #21 SD-7); review-incomplete keeps priority over the batch item
 * guard. Shared by every path INTO export so one fail-closed rule cannot drift
 * between {@link canAdvanceStep}, {@link advanceStep}, the canonical
 * `privacy-gate → export` transition and the D-024 direct `review → export`
 * transition.
 */
function exportTransitionAllowed(job: Job): boolean {
  if (!job.review.complete) return false;
  return !(job.kind === "document-batch" && batchHasErrorItems(job));
}

/** Throwing form of {@link exportTransitionAllowed} for transition functions. */
function assertExportTransitionAllowed(job: Job): void {
  if (!job.review.complete) {
    throw new JobModelError(
      "review-incomplete",
      "Export is blocked while mandatory review is incomplete."
    );
  }
  assertBatchExportable(job);
}

/**
 * D-023/D-024 + HPD-02 (REC-05 WU-B2): for a pasted-text (`text`) or single
 * `document` Job the Result (`export`) step is the ordinary destination after
 * the last required review decision, so the Privacy Gate is an OPTIONAL detour
 * rather than a mandatory intermediate stop. Every other Job kind keeps the
 * canonical `review → privacy-gate → export` order byte-for-byte. The Gate is
 * never hidden, deleted or disabled: at Review it stays visible, enabled and
 * visitable (an optional destination containing real facts, not a ceremonial
 * no-op screen).
 */
function resultReachableFromReview(job: Job): boolean {
  return (job.kind === "text" || job.kind === "document") && job.currentStep === "review";
}

/**
 * Whether the immediate forward transition out of the current step is
 * allowed. Export is gated on review completeness (D-004) and, for a
 * document-batch, on the absence of failed items (T17 #21 SD-7); every other
 * forward transition along the canonical order is allowed.
 */
export function canAdvanceStep(job: Job): boolean {
  const index = stepIndex(job.currentStep);
  if (index < 0 || index === FLOW_STEPS.length - 1) return false;
  const next = FLOW_STEPS[index + 1];
  if (next !== "export") return true;
  return exportTransitionAllowed(job);
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
  if (next === "export") assertExportTransitionAllowed(job);
  return moveToStep(job, next);
}

/**
 * Move to a step. Allowed: the current step (no-op), any already-visited
 * step (backward), the immediate next forward step when its guard passes, or —
 * for a pasted-text/single-document Job — the Result (`export`) step directly
 * from Review (D-024; {@link resultReachableFromReview}). Any other jump throws
 * (fail-closed; SPEC §2 canonical order).
 */
export function goToStep(job: Job, target: FlowStep): Job {
  if (!FLOW_STEPS.includes(target)) {
    throw new JobModelError("invalid-step", `Unknown flow step "${String(target)}".`);
  }
  if (target === job.currentStep) return job;
  if (job.visitedSteps.includes(target)) return moveToStep(job, target);

  const isImmediateNext = stepIndex(target) === stepIndex(job.currentStep) + 1;
  if (isImmediateNext && target === "export") assertExportTransitionAllowed(job);
  if (isImmediateNext) return moveToStep(job, target);

  // D-024 (REC-05 WU-B2): the single-item Result is directly reachable from
  // Review in one ordinary advance; the Privacy Gate stays an OPTIONAL
  // destination rather than a mandatory stop.
  if (resultReachableFromReview(job) && target === "export") {
    assertExportTransitionAllowed(job);
    return moveToStep(job, target);
  }

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

/**
 * Whether the step nav may offer this step for the current job. In addition to
 * the canonical visited/immediate-next rules, a pasted-text/single-document Job
 * at Review may go straight to Result (D-024; {@link resultReachableFromReview})
 * whenever the export guard is satisfied, so the Privacy Gate is never a
 * mandatory stop on the ordinary path.
 */
export function isStepAccessible(job: Job, target: FlowStep): boolean {
  if (target === job.currentStep) return true;
  if (job.visitedSteps.includes(target)) return true;
  if (resultReachableFromReview(job) && target === "export") {
    return exportTransitionAllowed(job);
  }
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
 *
 * Batch reset invariant (T17 #21 SD-8, corrected by WU-C3 and CORR-A): on a
 * REAL policy change for a document-batch job only the processing-derived
 * item state is invalidated — `processing`/`review-required`/`completed`
 * items return to `queued` KEEPING their held `extraction` (read artifacts
 * are policy-INDEPENDENT) with their `itemError` cleared, so the read+process
 * cycle restarts from the already-read text. `queued` items are untouched and
 * `reading` items STAY `reading` (CORR-A): an in-flight read is not
 * processing-derived, so it can still commit through {@link recordItemRead}
 * under the new policy. A `policy-unsupported` error item also returns to
 * `queued` with its held text (the new policy may support it, making it
 * genuinely retryable); every other error item, including read errors, is
 * retained unchanged.
 */
export function setPolicy(job: Job, policyId: PrivacyPolicyId): Job {
  if (!POLICY_IDS.includes(policyId)) {
    throw new JobModelError("invalid-policy", `Unknown privacy policy "${String(policyId)}".`);
  }
  if (policyId === job.policyId) return job;
  const source: JobSource =
    job.kind === "document-batch" && job.source.type === "files"
      ? { type: "files", files: resetBatchItemsForPolicy(job.source.files) }
      : job.source;
  return freezeDeep({
    ...job,
    policyId,
    source,
    review: { complete: false } as ReviewState,
    outputs: {
      safeOutputReady: false,
      confidentialAuditReady: false,
    } as OutputAvailability,
    // Consistency (PR #40 corrective C2 family): a REAL policy change also
    // invalidates the derived processing outcome, so the next Review entry
    // starts a fresh attempt instead of reusing a stale success/failure.
    processing: "idle" as ProcessingState,
  });
}

/**
 * Start ONE processing attempt (T15 #19). From `idle`, `failed` or `unknown`
 * the job moves to `running`; from `running` the SAME object is returned (a
 * no-op, so ordered calls cannot restart an in-flight attempt); from
 * `succeeded` it throws, because a completed processing outcome is never
 * overwritten by a new attempt without an intervening invalidation (a policy
 * change resets `processing` to `idle`). Frozen and never mutating.
 */
export function beginProcessing(job: Job): Job {
  if (job.processing === "running") return job;
  if (job.processing === "succeeded") {
    throw new JobModelError(
      "invalid-processing-transition",
      `Job "${job.id}" already processed successfully; a new attempt cannot start without an intervening invalidation.`
    );
  }
  return freezeDeep({ ...job, processing: "running" as ProcessingState });
}

/**
 * Record a processing SUCCESS (T15 #19). Only allowed from `running`: success
 * is never inferred, so it may only be recorded for an attempt that was
 * explicitly started with {@link beginProcessing}. ANY other state throws.
 */
export function completeProcessing(job: Job): Job {
  if (job.processing !== "running") {
    throw new JobModelError(
      "invalid-processing-transition",
      `Job "${job.id}" has no running processing attempt to complete (state "${job.processing}"); success is never inferred.`
    );
  }
  return freezeDeep({ ...job, processing: "succeeded" as ProcessingState });
}

/**
 * Record a processing FAILURE (T15 #19, D-009). Only allowed from `running`:
 * a failure is only recorded for a started attempt, and a success is never
 * overwritten by a later failure. A `processing-unknown` failure moves the
 * job to `unknown` (an attempt happened, its outcome could not be
 * established); every other code moves it to `failed`. The failure is
 * APPENDED to {@link Job.errors} — existing entries are never replaced. This
 * is a frozen transition and never mutates the input job.
 */
export function failProcessing(job: Job, failure: ProcessingFailure): Job {
  if (job.processing !== "running") {
    throw new JobModelError(
      "invalid-processing-transition",
      `Job "${job.id}" has no running processing attempt to fail (state "${job.processing}").`
    );
  }
  const processing: ProcessingState = failure.code === "processing-unknown" ? "unknown" : "failed";
  return freezeDeep({
    ...job,
    processing,
    errors: [...job.errors, { code: failure.code, message: failure.message }],
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
