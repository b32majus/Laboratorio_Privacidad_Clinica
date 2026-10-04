/**
 * Typed V4 facade over the review authority (Work Order T07).
 *
 * `js/domain/review-session.js` (Work Order T01) is the ONLY review
 * authority (CURRENT_DECISIONS.md D-004): this module never re-implements
 * decisions, previews or final text; it re-exports the domain API with
 * TypeScript types (ambient declarations in
 * app-v4/src/engine/legacy-modules.d.ts) and maps a Job's source text
 * through the registry-composed V4 engine (Work Order T11 #15, WU3:
 * recognition → policy → operators) + `from-processor.js` adapter.
 *
 * ReviewSession objects are frozen domain state held by the app's state
 * bridge (useJobSession), never React-local UI state. Transient selection,
 * filters and drawers stay in the components.
 *
 * Low-confidence candidates (Work Order T14 #18, WU-B): the session returned
 * by {@link createSessionFromEngineText} now ALSO carries the engine's
 * below-threshold candidates as reviewable detections (marked
 * `lowConfidence: true`, `source: 'engine'`, `requiresReview: true`), appended
 * after the entity detections. They are adjudicated through the existing
 * decision vocabulary (`accepted` = treat with the candidate's `proposed`,
 * `restored` = decline keeping the original span) and, like every other
 * engine detection, stay pending until explicitly decided. No signature or
 * export change is needed for this: the T01 adapter maps them.
 *
 * Privacy: content stays memory-only (D-013); nothing here logs, persists
 * or places sensitive text in URLs.
 */
import { createReviewSessionFromProcessor } from "../../../js/domain/from-processor.js";
import {
  addManualDetection,
  applyDecision,
  canFinalize,
  createReviewSession,
  getDecision,
  getFinalText,
  getPendingDetections,
  getPreview,
  getProgress,
  ReviewSessionError,
  type ReviewSession,
} from "../../../js/domain/review-session.js";
import { loadRegistryEngine, type EngineLoader } from "../engine/engine-seam";
import { createInitialProcessingContext } from "../engine/initial-processing-context";
import { classifyProcessingFailure } from "../processing-outcome";
import type { Job, PrivacyPolicyId, ProcessingFailure } from "../domain/job";
import type { RegistryEngineInput } from "../engine/registry-engine";
import type { EngineOutcome, ProcessingContext } from "../engine/types";

export {
  addManualDetection,
  applyDecision,
  canFinalize,
  createReviewSession,
  getDecision,
  getFinalText,
  getPendingDetections,
  getPreview,
  getProgress,
  ReviewSessionError,
};

export type {
  ReviewDecision,
  ReviewDetection,
  ReviewDetectionInput,
  ReviewProgress,
} from "../../../js/domain/review-session.js";
export type { ReviewSession } from "../../../js/domain/review-session.js";

/** Decision statuses the reviewer can set explicitly (pending is implicit). */
export type ExplicitDecisionStatus = "accepted" | "modified" | "restored";

/** Manual detection creation input (ReviewSession contract: source 'manual'). */
export type ManualDetectionInput = {
  readonly start: number;
  readonly end: number;
  readonly type: string;
  readonly subtype?: string;
  readonly note?: string;
};

/** Decision extras forwarded verbatim to the domain `applyDecision`. */
export type DecisionExtras = {
  readonly replacement?: string;
  readonly note?: string;
};

/**
 * Run the registry-composed V4 engine (Work Order T11 #15, WU3) over `text`
 * under the EXPLICIT `policyId` and map the result through the T01 adapter
 * into a ReviewSession. PR #40 corrective C1: the policy is never guessed —
 * the caller (the Job, via {@link startReviewSessionAsync}) decides it, so
 * the session's proposals are always produced under the job's actual policy.
 * When that policy cannot complete (for example the date-shift policy with no
 * shift state threaded) the engine fails typed instead of silently
 * falling back to `standard`. T14 #18 WU-B: the returned session
 * also carries the engine's below-threshold candidates as pending
 * `lowConfidence` detections (see the module header).
 *
 * REC-02 WU-B: the optional `context` is the caller-owned
 * {@link ProcessingContext}. It defaults to a bare `{ mode: "fresh" }` with no
 * date-shift state, which is exactly why a date-shift policy invoked this way
 * fails closed; the product Job entry ({@link startReviewSessionAsync}) passes
 * the policy-owned context from
 * {@link createInitialProcessingContext} instead.
 *
 * T22 #26 WU-D (PERF-002): the heavy engine module graph loads lazily via
 * the async engine seam — the app's initial chunk never includes it.
 */
export async function createSessionFromEngineTextAsync(
  text: string,
  policyId: PrivacyPolicyId,
  load: EngineLoader = loadRegistryEngine,
  context: ProcessingContext = { mode: "fresh" }
): Promise<ReviewSession> {
  const engine = await load();
  const outcome = await engine.process({ text, context, policyId });
  // The T01 adapter validates the result shape fail-closed and returns a
  // frozen session; the ambient declaration keeps the structural type.
  return createReviewSessionFromProcessor(outcome.result) as ReviewSession;
}

/**
 * Whether the job family has a V4 review workflow. Text and single-document
 * jobs have one reviewable source text. A document batch is reviewable too, as
 * PER-DOCUMENT sessions over its items, all threaded through the same explicit
 * shared processing context (T17 #21 WU-B, D-011) via {@link processBatchItem}.
 * Structured jobs need the classification workspace (T18/T19) and are
 * deliberately NOT improvised here.
 */
export function jobSupportsReview(job: Job): boolean {
  return job.kind === "text" || job.kind === "document" || job.kind === "document-batch";
}

/**
 * The single source text a review session is built from: pasted text for
 * text jobs, the extracted text of the one document for document jobs.
 * Returns null for a document batch (its text is held per item and it has no
 * single source text) and for structured jobs.
 */
export function jobSourceText(job: Job): string | null {
  if (job.source.type === "pasted-text") return job.source.text;
  if (job.kind !== "document") return null;
  const file = job.source.files[0];
  if (!file || file.extraction?.status !== "extracted") return null;
  return file.extraction.extractedText;
}

/**
 * Start review for a job: run the engine on its source text and build the
 * ReviewSession. This is the SINGLE-TEXT entry only — a document batch has no
 * single source text and is reviewed per document through
 * {@link processBatchItem} instead. Fails closed (typed ReviewSessionError)
 * when the job has no single reviewable source text instead of guessing.
 */
export async function startReviewSessionAsync(
  job: Job,
  load: EngineLoader = loadRegistryEngine
): Promise<ReviewSession> {
  const text = jobSourceText(job);
  if (text === null || text.trim().length === 0) {
    throw new ReviewSessionError(
      "INVALID_SOURCE",
      `Job "${job.name}" (${job.kind}) has no single reviewable source text; this entry starts single-text review only. A document batch is reviewed per document via processBatchItem, not as one session.`
    );
  }
  // PR #40 corrective C1: the job's own policy is the policy the engine
  // consumes. REC-02 WU-B: the policy-owned initial context (a Job-scoped
  // date-shift state only for the `v4.date-shift` policy) is threaded here so
  // the date-shift policy completes instead of failing closed; a policy with
  // no shift state still cannot silently fall back to `standard`.
  return createSessionFromEngineTextAsync(
    text,
    job.policyId,
    load,
    createInitialProcessingContext(job, job.policyId)
  );
}

/**
 * Reference to one structured free-text cell routed `process-as-text`
 * (REC-03 WU-C, D-021): which column/row the cell is, without any
 * ProcessingContext/session internals leaking into the product surface.
 */
export type StructuredFreeTextCellRef = {
  readonly columnIndex: number;
  readonly rowIndex: number;
  readonly header: string;
};

/**
 * Result of processing ONE structured free-text cell (REC-03 WU-C): either
 * the cell's ReviewSession plus the engine's returned context, or a typed
 * {@link ProcessingFailure}. Mirrors {@link BatchItemProcessing}: the caller
 * owns the {@link ProcessingContext} and promotes successes to shared mode.
 */
export type StructuredCellProcessing =
  | { readonly ok: true; readonly session: ReviewSession; readonly context: ProcessingContext }
  | { readonly ok: false; readonly failure: ProcessingFailure };

/**
 * Process ONE structured free-text cell through the registry-composed engine
 * and map the result into the cell's ReviewSession (REC-03 WU-C, D-021
 * free-text columns). This is the structured counterpart of
 * {@link processBatchItem}: one non-blank cell routed `process-as-text` runs
 * the productive text engine under the Job's own REC-02 policy, and the
 * result — including low-confidence candidates — becomes a ReviewSession
 * reviewed through the existing semantics (no auto-accept shortcut).
 *
 * The cell text is the ONLY source accepted; a blank cell is refused
 * fail-closed as `invalid-source` (blank cells stay blank and create no
 * session). A non-structured job is refused likewise. This method NEVER
 * throws for a classified failure: any engine throw is mapped through
 * {@link classifyProcessingFailure} so the cell loop can record the failure
 * and keep processing the remaining cells. The engine NEVER falls back to
 * keeping the raw original: a failure is an explicit visible blocker.
 */
export async function processStructuredFreeTextCell(
  job: Pick<Job, "kind" | "name" | "policyId">,
  cell: StructuredFreeTextCellRef,
  text: string,
  context: ProcessingContext,
  engine: RegistryEngine
): Promise<StructuredCellProcessing> {
  try {
    if (job.kind !== "structured") {
      throw new ReviewSessionError(
        "INVALID_SOURCE",
        `Job "${job.name}" (${job.kind}) is not a structured job; processStructuredFreeTextCell requires a structured job with a process-as-text cell.`
      );
    }
    if (text.trim().length === 0) {
      throw new ReviewSessionError(
        "INVALID_SOURCE",
        `Structured cell [${cell.header}, row ${cell.rowIndex + 1}] is blank; blank cells stay blank and create no review session.`
      );
    }
    const outcome = await engine.process({ text, context, policyId: job.policyId });
    return {
      ok: true,
      session: createReviewSessionFromProcessor(outcome.result) as ReviewSession,
      context: outcome.context,
    };
  } catch (error) {
    return { ok: false, failure: classifyProcessingFailure(error) };
  }
}
/**
 * The engine process seam consumed by review orchestration, typed
 * structurally (T22 #26 WU-D): `process` may be synchronous (in-process
 * engine) or asynchronous (Worker-backed engine), so a deterministic oracle
 * can inject either stub without importing the heavy engine module.
 */
export type RegistryEngine = {
  process(input: RegistryEngineInput): EngineOutcome | Promise<EngineOutcome>;
};

/**
 * Result of processing ONE batch item (T17 #21 WU-B): either the per-document
 * ReviewSession plus the engine's returned context, or a typed
 * {@link ProcessingFailure}. The context is the exact engine
 * {@link ProcessingContext} — no new context shape is introduced here.
 */
export type BatchItemProcessing =
  | { readonly ok: true; readonly session: ReviewSession; readonly context: ProcessingContext }
  | { readonly ok: false; readonly failure: ProcessingFailure };

/**
 * Process ONE held batch item through the registry-composed engine and map the
 * result into a per-document ReviewSession (T17 #21 WU-B, SD-4). This is the
 * batch counterpart of {@link startReviewSession}: batch review is per
 * document, so there is no single job-level session.
 *
 * The item's held `extraction.extractedText` is the ONLY source text accepted;
 * an item without held text (still `queued`, or an `error` item) is refused
 * fail-closed as `invalid-source` instead of guessing content. The caller owns
 * the {@link ProcessingContext}: the first item of a batch runs `mode:
 * "fresh"`, and every later item runs `mode: "shared"` carrying the previous
 * outcome's returned context, so cross-document pseudonym consistency is
 * threaded explicitly (never through monkey-patched globals, D-011).
 *
 * This method NEVER throws for a classified failure: any throw from the engine
 * (typed policy/engine/session failures) is mapped through
 * {@link classifyProcessingFailure} to `{ ok: false, failure }`, so a batch
 * loop can record the item outcome and keep processing the remaining items
 * (SD-4). T22 #26 WU-D: the engine is a REQUIRED argument — production
 * callers obtain it from the async engine seam (module loaded once per batch
 * loop); deterministic oracles inject stubs.
 */
export async function processBatchItem(
  job: Job,
  index: number,
  context: ProcessingContext,
  engine: RegistryEngine
): Promise<BatchItemProcessing> {
  try {
    if (job.kind !== "document-batch" || job.source.type !== "files") {
      throw new ReviewSessionError(
        "INVALID_SOURCE",
        `Job "${job.name}" (${job.kind}) is not a document batch; processBatchItem requires a document-batch job.`
      );
    }
    const extraction = job.source.files[index]?.extraction;
    if (extraction?.status !== "extracted") {
      throw new ReviewSessionError(
        "INVALID_SOURCE",
        `Batch item ${index} of job "${job.name}" has no held extracted text; read the item before processing it.`
      );
    }
    const outcome = await engine.process({
      text: extraction.extractedText,
      context,
      policyId: job.policyId,
    });
    // The T01 adapter validates the result shape fail-closed and returns a
    // frozen session; the ambient declaration keeps the structural type.
    return {
      ok: true,
      session: createReviewSessionFromProcessor(outcome.result) as ReviewSession,
      context: outcome.context,
    };
  } catch (error) {
    return { ok: false, failure: classifyProcessingFailure(error) };
  }
}
