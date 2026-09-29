/**
 * V4 application shell (SPEC_V4_APP_AND_REVIEW.md §2/§8, D-001).
 *
 * One SPA owning a Job across the canonical flow
 * Input → Configure → Review → Privacy Gate → Export.
 * There is no router and no URL state: job content never reaches the URL.
 * Step content beyond Input is an honest placeholder; its tickets arrive
 * later and must never be faked here.
 *
 * Sensitive job data stays memory-only (D-013); "Clear session" discards it.
 */
import { useEffect, useRef, useState } from "react";
import type { ChangeEvent, ReactElement } from "react";
import { flushSync } from "react-dom";

import {
  FLOW_STEPS,
  type BatchItemReadOutcome,
  type FlowStep,
  type Job,
  type JobInput,
  type JobKind,
  JobModelError,
  type JobSourceFile,
  type PrivacyPolicyId,
  batchFailedItems,
  isDocumentExtension,
  isStepAccessible,
  isStructuredExtension,
} from "./domain/job";
import { EngineError } from "./engine/types";
import { PolicyError } from "./engine/policy";
import { extractFile, extractFromPastedText } from "./input/extract";
import { extensionOf, type ExtractedSource } from "./input/extracted-source";
import { ExportStep } from "./export/ExportStep";
import { PrivacyGate } from "./privacy-gate/PrivacyGate";
import { BatchReviewView } from "./review/BatchReviewView";
import { ReviewWorkspace } from "./review/ReviewWorkspace";
import { ReviewSessionError, jobSupportsReview } from "./review/review-domain";
import { StructuredConfigureWorkspace } from "./structured/StructuredConfigureWorkspace";
import { readStructuredFile, readStructuredSheet } from "./structured/intake";
import { useJobSession } from "./useJobSession";

const STEP_LABELS: Record<FlowStep, string> = {
  input: "Input",
  configure: "Configure",
  review: "Review",
  "privacy-gate": "Privacy Gate",
  export: "Export",
};

const KIND_LABELS: Record<JobKind, string> = {
  text: "Text job",
  document: "Document job",
  "document-batch": "Document batch",
  structured: "Structured job",
};

const POLICY_LABELS: Record<PrivacyPolicyId, string> = {
  standard: "Standard",
  "external-ai": "External AI",
  "longitudinal-research": "Longitudinal Research",
  strict: "Strict",
};

const SUPPORTED_EXTENSIONS = [".txt", ".pdf", ".docx", ".csv", ".xls", ".xlsx"];

/** Whether a selection is a two-phase document batch (≥2 document files). */
function isDocumentBatchSelection(files: readonly File[]): boolean {
  return files.length >= 2 && files.every((file) => isDocumentExtension(extensionOf(file.name)));
}

/** Map one read-adapter outcome onto the domain's batch read outcome shape. */
function toBatchReadOutcome(result: ExtractedSource): BatchItemReadOutcome {
  return result.status === "success"
    ? { ok: true, extractedText: result.text }
    : { ok: false, error: { code: result.error.code, message: result.error.message } };
}

/** Whether any batch item is still in its read phase (reads must settle first). */
function hasReadingBatchItems(job: Job): boolean {
  return (
    job.kind === "document-batch" &&
    job.source.type === "files" &&
    job.source.files.some((file) => file.itemStatus === "reading")
  );
}

const focusRing =
  "focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2";

export function App() {
  const session = useJobSession();
  const job = session.job;
  const review = session.review;
  const { batchSessions, batchActiveIndex } = session;
  const startReview = session.startReview;
  const [draftText, setDraftText] = useState("");
  const [draftFiles, setDraftFiles] = useState<File[]>([]);
  const [inputError, setInputError] = useState<string | null>(null);
  const [isExtracting, setIsExtracting] = useState(false);
  const [reviewError, setReviewError] = useState<string | null>(null);
  const [batchRead, setBatchRead] = useState<{
    readonly total: number;
    readonly done: number;
  } | null>(null);
  /**
   * Structured Configure workspace state (T20 #24). `structuredError` is a
   * typed intake failure and `structuredSheet` is a multi-sheet workbook
   * awaiting an explicit selection; both are job-scoped or cleared whenever a
   * new job is created. The File is transient INPUT state used to parse the
   * selected sheet — the canonical configuration itself lives in the domain
   * bridge (`useJobSession.structured`).
   */
  const [structuredError, setStructuredError] = useState<string | null>(null);
  const [structuredSheet, setStructuredSheet] = useState<{
    readonly jobId: string;
    readonly sheetNames: readonly string[];
  } | null>(null);
  const structuredFileRef = useRef<File | null>(null);
  /**
   * Latest rendered job id (SD-11): the async batch-read loop snapshots it
   * before each awaited read and discards an outcome whose job was superseded
   * or cleared while the read was in flight. Mirrors the hook's own state-ref
   * pattern; the hook remains the single source of job state.
   */
  const jobIdRef = useRef<string | null>(null);
  jobIdRef.current = job ? job.id : null;

  const resetDraft = () => {
    setDraftText("");
    setDraftFiles([]);
    setInputError(null);
    setStructuredError(null);
    setStructuredSheet(null);
    structuredFileRef.current = null;
  };

  const handleCreateJob = (input: JobInput) => {
    try {
      session.create(input);
      resetDraft();
    } catch (error) {
      setInputError(
        error instanceof JobModelError
          ? error.message
          : "The input could not be used to create a job."
      );
    }
  };

  const metadataFiles = (): JobSourceFile[] =>
    draftFiles.map((file) => ({ name: file.name, extension: extensionOf(file.name) }));

  /**
   * Document intake (T06): run the typed input adapters for every selected
   * file, then hand the extraction outcomes to the domain. A failed
   * extraction surfaces as a visible alert and creates NO job — the domain
   * refuses failed files fail-closed (D-009/D-011).
   */
  const extractAndCreate = async (files: File[]) => {
    setIsExtracting(true);
    try {
      const results = await Promise.all(files.map((file) => extractFile(file)));
      const jobFiles: JobSourceFile[] = results.map((result) => ({
        name: result.sourceName,
        extension: extensionOf(result.sourceName),
        extraction:
          result.status === "success"
            ? { status: "extracted", extractedText: result.text }
            : {
                status: "failed",
                error: { code: result.error.code, message: result.error.message },
              },
      }));
      handleCreateJob({ type: "files", files: jobFiles });
    } finally {
      setIsExtracting(false);
    }
  };

  /**
   * Wait until the job created by `session.create()` has rendered, so its
   * domain-generated id is readable through the ref. `previousJobId` is the id
   * held before creation: a non-null id different from it is the new job.
   * Bounded so a refused creation can never suspend the caller forever.
   */
  const waitForNewJobId = async (previousJobId: string | null): Promise<string | null> => {
    for (let attempt = 0; attempt < 25; attempt += 1) {
      const current = jobIdRef.current;
      if (current !== null && current !== previousJobId) return current;
      await Promise.resolve();
    }
    return null;
  };

  /**
   * Two-phase document-batch intake (T17 #21 SD-2/SD-3/SD-11). The batch job is
   * created METADATA-ONLY (the domain refuses extraction-carrying batch input);
   * every item then moves through the domain read transitions. Each read
   * snapshots the job id before awaiting extraction and discards its outcome
   * when the job was superseded or cleared meanwhile (SD-11), so a stale read
   * can never write into another job's state. A failed/empty/oversize read is
   * recorded as the item's typed error by the domain and stays visible on the
   * input step, never hidden.
   */
  const intakeBatch = async (files: File[]) => {
    setIsExtracting(true);
    setBatchRead({ total: files.length, done: 0 });
    try {
      const metadata: JobSourceFile[] = files.map((file) => ({
        name: file.name,
        extension: extensionOf(file.name),
      }));
      const previousJobId = jobIdRef.current;
      try {
        session.create({ type: "files", files: metadata });
      } catch (error) {
        setInputError(
          error instanceof JobModelError
            ? error.message
            : "The input could not be used to create a job."
        );
        return;
      }
      resetDraft();
      const jobId = await waitForNewJobId(previousJobId);
      if (jobId === null) return;

      for (let index = 0; index < files.length; index += 1) {
        if (jobIdRef.current !== jobId) return;
        // The hook's read-phase methods read the COMMITTED job through its own
        // state ref and return a job computed from it, so each transition must
        // be committed before the next one reads it. `flushSync` makes that
        // ordering deterministic both in the browser and under React's test
        // scheduler; without it two rapid transitions could race.
        flushSync(() => session.beginBatchItemRead(index));
        const result = await extractFile(files[index]);
        if (jobIdRef.current !== jobId) return;
        flushSync(() => session.recordBatchItemRead(index, toBatchReadOutcome(result)));
        setBatchRead((current) => (current ? { ...current, done: index + 1 } : current));
      }
    } finally {
      setIsExtracting(false);
      setBatchRead(null);
    }
  };

  const handleCreateFromDraft = () => {
    if (isExtracting) return;
    const hasText = draftText.trim().length > 0;
    if (hasText && draftFiles.length > 0) {
      setInputError("Use either pasted text or files for one job, not both.");
      return;
    }
    if (hasText) {
      // Pasted-text extraction is synchronous; typed failure surfaces as alert.
      const result = extractFromPastedText(draftText);
      if (result.status === "failed") {
        setInputError(result.error.message);
        return;
      }
      session.create({ type: "pasted-text", text: result.text });
      resetDraft();
      return;
    }
    if (draftFiles.length === 0) {
      // Surface the domain's typed empty-input error instead of guessing.
      const result = extractFromPastedText("");
      setInputError(result.status === "failed" ? result.error.message : null);
      return;
    }
    const hasStructured = draftFiles.some((file) => isStructuredExtension(extensionOf(file.name)));
    const hasDocument = draftFiles.some((file) => isDocumentExtension(extensionOf(file.name)));
    if (hasStructured) {
      // A mixed document/structured selection is NOT a structured intake: let
      // the domain produce its typed ambiguous-input error unchanged.
      if (hasDocument) {
        handleCreateJob({ type: "files", files: metadataFiles() });
        return;
      }
      // Structured classification profiles one table. A single file is read
      // through the T20 structured intake; a multi-file selection is refused
      // fail-closed instead of silently guessing which table to profile.
      if (draftFiles.length !== 1) {
        setInputError(
          "Structured jobs classify one table at a time; create a separate job per CSV or Excel file."
        );
        return;
      }
      const previousJobId = jobIdRef.current;
      handleCreateJob({ type: "files", files: metadataFiles() });
      void intakeStructured(draftFiles[0], previousJobId);
      return;
    }
    if (isDocumentBatchSelection(draftFiles)) {
      // ≥2 document files: the batch owns its input from selection (SD-2). The
      // read phase records every item outcome, so a failed document stays
      // inside the batch instead of aborting it.
      void intakeBatch(draftFiles);
      return;
    }
    if (hasDocument || draftFiles.length > 0) {
      void extractAndCreate(draftFiles);
    }
  };

  const handleFileSelection = (event: ChangeEvent<HTMLInputElement>) => {
    setDraftFiles(Array.from(event.target.files ?? []));
    event.target.value = "";
  };

  const handleClearSession = () => {
    session.clear();
    resetDraft();
    setReviewError(null);
  };

  /**
   * Step transitions. Entering Review for a text or single-document job runs
   * the existing legacy engine on the job's source text ONCE and installs the
   * resulting ReviewSession as the domain review authority (T07). The attempt
   * is recorded through `session.startReview()` (T15 #19): a typed processing
   * failure is surfaced as an alert and the app STAYS on the current step, so
   * a failed attempt is never presented as a successful review. Re-entering
   * Review never re-runs the engine or resets decisions.
   *
   * A document batch is deliberately excluded here: its review attempt is
   * started by the reads-settle effect below, so entering Review during the
   * read phase can never start processing mid-read. Structured jobs keep an
   * honest placeholder until their own tickets arrive.
   */
  const handleGoToStep = (step: FlowStep) => {
    try {
      if (
        step === "review" &&
        job &&
        !review &&
        job.kind !== "document-batch" &&
        jobSupportsReview(job)
      ) {
        const failure = session.startReview();
        if (failure) {
          setReviewError(failure.message);
          return;
        }
      }
      session.navigate(step);
      setInputError(null);
      setReviewError(null);
    } catch (error) {
      // PR #40 corrective C1: the typed PolicyError is surfaced alongside the
      // other typed domain failures so a known-but-unmapped job policy
      // becomes an actionable message instead of the generic fallback.
      const message =
        error instanceof JobModelError ||
        error instanceof EngineError ||
        error instanceof PolicyError ||
        error instanceof ReviewSessionError
          ? error.message
          : "That step is not available right now.";
      if (step === "review") setReviewError(message);
      else setInputError(message);
    }
  };

  const currentStep: FlowStep = job ? job.currentStep : "input";
  /**
   * The review session the gate/export steps consume: the single session for
   * text/document jobs, the ACTIVE item's session for a batch (or `null` when
   * no item is reviewable). Batch readiness itself comes from the Job.
   */
  const activeBatchSession =
    batchSessions !== null && batchActiveIndex !== null
      ? (batchSessions[batchActiveIndex] ?? null)
      : null;
  const activeReview = review ?? activeBatchSession;
  const isBatch = job !== null && job.kind === "document-batch";
  /** The canonical structured configuration for the CURRENT structured job. */
  const structuredConfiguration =
    session.structured !== null && job !== null && session.structured.jobId === job.id
      ? session.structured.configuration
      : null;

  /**
   * Structured intake (T20 #24): parse the single selected CSV/XLS/XLSX file
   * with the T18 authorities and install the canonical configuration in the
   * domain bridge. A multi-sheet workbook waits for an explicit sheet choice;
   * every failure is typed and surfaced (never a silent empty table). The
   * parsed configuration is only installed when the job it was read for is
   * still the current job (stale reads are discarded).
   */
  const intakeStructured = async (file: File, previousJobId: string | null) => {
    setIsExtracting(true);
    try {
      const outcome = await readStructuredFile(file);
      const jobId = await waitForNewJobId(previousJobId);
      if (jobId === null || jobIdRef.current !== jobId) return;
      if (outcome.status === "parsed") {
        session.installStructuredGrid(outcome.grid);
        setStructuredError(null);
        setStructuredSheet(null);
      } else if (outcome.status === "sheet-required") {
        structuredFileRef.current = file;
        setStructuredSheet({ jobId, sheetNames: outcome.sheetNames });
      } else {
        setStructuredError(outcome.message);
      }
    } finally {
      setIsExtracting(false);
    }
  };

  /** Load an explicitly selected worksheet of the pending structured workbook. */
  const handleSelectStructuredSheet = async (sheetName: string) => {
    const file = structuredFileRef.current;
    const pending = structuredSheet;
    if (!file || !pending) return;
    setIsExtracting(true);
    try {
      const outcome = await readStructuredSheet(file, sheetName);
      if (jobIdRef.current !== pending.jobId) return;
      if (outcome.status === "parsed") {
        session.installStructuredGrid(outcome.grid);
        setStructuredError(null);
        setStructuredSheet(null);
        structuredFileRef.current = null;
      } else if (outcome.status === "failed") {
        setStructuredError(outcome.message);
      }
    } finally {
      setIsExtracting(false);
    }
  };

  /**
   * Reads-settle gating and one-shot batch review start (T17 #21 SD-2/SD-4).
   * The read phase is in flight for the WHOLE intake, including the gaps
   * between one item's outcome and the next item's `reading` transition, so the
   * attempt is gated on `isExtracting` as well as on any item still `reading`;
   * entering Review mid-read can therefore never process unread items (WU-C
   * wiring requirement 2/3). Once reads settle and no batch session exists
   * yet, the attempt is started EXACTLY once: the hook's `current.batch` guard
   * makes any re-fire a no-op, and the `processing === "idle"` condition keeps
   * this effect from looping after a success (`succeeded`) or a recorded
   * failure (`failed`).
   */
  useEffect(() => {
    if (currentStep !== "review" || !job || job.kind !== "document-batch") return;
    if (isExtracting) return;
    if (batchSessions !== null) return;
    if (job.processing !== "idle") return;
    if (hasReadingBatchItems(job)) return;
    const failure = startReview();
    if (failure) setReviewError(failure.message);
  }, [currentStep, job, batchSessions, isExtracting, startReview]);

  return (
    <div className="min-h-screen bg-background-light font-sans text-neutral-800">
      <a
        href="#main-content"
        className={`sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-10 focus:rounded focus:bg-background-dark focus:px-4 focus:py-2 focus:text-white ${focusRing}`}
      >
        Skip to main content
      </a>

      <header className="border-b border-primary bg-surface-light">
        <div className="mx-auto max-w-5xl px-4 py-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h1 className="font-display text-2xl font-bold text-primary-dark">
              Laboratorio de Privacidad Clínica
            </h1>
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  session.clear();
                  resetDraft();
                }}
                className={`rounded border border-primary-dark px-3 py-1.5 text-sm font-semibold text-primary-dark hover:bg-surface-dark hover:text-white ${focusRing}`}
              >
                New Job
              </button>
              <button
                type="button"
                onClick={handleClearSession}
                className={`rounded border border-primary-dark px-3 py-1.5 text-sm font-semibold text-primary-dark hover:bg-surface-dark hover:text-white ${focusRing}`}
              >
                Clear session
              </button>
            </div>
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-x-6 gap-y-2 text-sm text-neutral-700">
            <p>
              <span className="font-semibold text-neutral-800">Job:</span>{" "}
              {job ? job.name : "No job yet"}
            </p>
            <p>
              <span className="font-semibold text-neutral-800">Type:</span>{" "}
              {job ? KIND_LABELS[job.kind] : "—"}
            </p>
            <label className="flex items-center gap-2">
              <span className="font-semibold text-neutral-800">Privacy Policy:</span>
              <select
                value={job ? job.policyId : "standard"}
                disabled={!job}
                onChange={(event) => session.updatePolicy(event.target.value as PrivacyPolicyId)}
                title={job ? undefined : "Create a job first"}
                className={`rounded border border-primary bg-white px-2 py-1 text-sm ${focusRing}`}
              >
                {(Object.keys(POLICY_LABELS) as PrivacyPolicyId[]).map((policyId) => (
                  <option key={policyId} value={policyId}>
                    {POLICY_LABELS[policyId]}
                  </option>
                ))}
              </select>
            </label>
            <p className="text-neutral-600">
              Processing runs locally in your browser; job content stays on this device.
            </p>
          </div>
        </div>
      </header>

      <StepNavigation job={job} currentStep={currentStep} onGoToStep={handleGoToStep} />

      <main id="main-content" className="mx-auto max-w-5xl px-4 py-8">
        {currentStep === "input" ? (
          <InputStep
            draftText={draftText}
            draftFiles={draftFiles}
            inputError={inputError}
            isExtracting={isExtracting}
            batchRead={batchRead}
            batchJob={job}
            onDraftTextChange={setDraftText}
            onFileSelection={handleFileSelection}
            onCreate={handleCreateFromDraft}
          />
        ) : currentStep === "configure" && job && job.kind === "structured" ? (
          <StructuredConfigureWorkspace
            configuration={structuredConfiguration}
            errorMessage={structuredError}
            sheetNames={structuredSheet?.jobId === job.id ? structuredSheet.sheetNames : null}
            onSelectSheet={handleSelectStructuredSheet}
            onOverrideClass={session.overrideStructuredColumn}
            onSelectPatientId={session.selectStructuredPatientId}
          />
        ) : currentStep === "review" && isBatch && job ? (
          <BatchReviewView
            job={job}
            sessions={batchSessions}
            activeIndex={batchActiveIndex}
            errorMessage={reviewError}
            onSelectDocument={session.selectDocument}
            onDecide={session.decide}
            onAddManual={session.addManual}
          />
        ) : currentStep === "review" && review ? (
          <ReviewWorkspace
            session={review}
            onDecide={session.decide}
            onAddManual={session.addManual}
          />
        ) : currentStep === "privacy-gate" && job && (activeReview !== null || isBatch) ? (
          <PrivacyGate
            job={job}
            review={activeReview}
            batchSessions={batchSessions === null ? [] : Object.values(batchSessions)}
          />
        ) : currentStep === "export" && job && (activeReview !== null || isBatch) ? (
          <ExportStep job={job} review={activeReview} />
        ) : (
          <StepPlaceholder step={currentStep} reviewError={reviewError} />
        )}
      </main>
    </div>
  );
}

function StepNavigation(props: {
  job: Job | null;
  currentStep: FlowStep;
  onGoToStep: (step: FlowStep) => void;
}) {
  const { job, currentStep, onGoToStep } = props;
  return (
    <nav aria-label="Job steps" className="border-b border-primary bg-surface-light">
      <ol className="mx-auto flex max-w-5xl flex-wrap gap-2 px-4 py-3">
        {FLOW_STEPS.map((step, index) => {
          const enabled = job ? isStepAccessible(job, step) : step === "input";
          const isCurrent = step === currentStep;
          const title = !enabled
            ? step === "export"
              ? "Export is blocked while mandatory review is incomplete."
              : "Complete the previous steps first."
            : undefined;
          return (
            <li key={step}>
              <button
                type="button"
                onClick={() => onGoToStep(step)}
                disabled={!enabled}
                aria-current={isCurrent ? "step" : undefined}
                title={title}
                className={`rounded border px-3 py-1.5 text-sm font-semibold ${
                  isCurrent
                    ? "border-primary-dark bg-primary-dark text-white"
                    : enabled
                      ? "border-primary bg-white text-primary-dark hover:bg-surface-light"
                      : "cursor-not-allowed border-neutral-300 bg-white text-neutral-400"
                } ${focusRing}`}
              >
                {index + 1}. {STEP_LABELS[step]}
              </button>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

function InputStep(props: {
  draftText: string;
  draftFiles: File[];
  inputError: string | null;
  isExtracting: boolean;
  batchRead: { readonly total: number; readonly done: number } | null;
  batchJob: Job | null;
  onDraftTextChange: (text: string) => void;
  onFileSelection: (event: ChangeEvent<HTMLInputElement>) => void;
  onCreate: () => void;
}) {
  // Failed batch reads are surfaced HERE, as soon as each item outcome is
  // recorded: a failed document is never hidden (BATCH-001, D-011).
  const failedItems =
    props.batchJob && props.batchJob.kind === "document-batch"
      ? batchFailedItems(props.batchJob)
      : [];
  return (
    <section aria-labelledby="input-step-heading">
      <h2 id="input-step-heading" className="font-display text-xl font-bold text-primary-dark">
        Input
      </h2>
      <p className="mt-2 max-w-2xl text-base leading-relaxed">
        Paste text or select document or structured files to start a job. The job type is inferred
        from your input; mixed or unsupported input is rejected.
      </p>
      <div className="mt-4 max-w-2xl space-y-4">
        <div>
          <label htmlFor="paste-text" className="block text-sm font-semibold text-neutral-800">
            Paste text
          </label>
          <textarea
            id="paste-text"
            value={props.draftText}
            onChange={(event) => props.onDraftTextChange(event.target.value)}
            rows={6}
            className={`mt-1 w-full rounded border border-primary bg-white px-3 py-2 text-sm ${focusRing}`}
          />
        </div>
        <div>
          <label htmlFor="select-files" className="block text-sm font-semibold text-neutral-800">
            Or select files (TXT, PDF, DOCX, CSV, XLS, XLSX)
          </label>
          <input
            id="select-files"
            type="file"
            multiple
            accept={SUPPORTED_EXTENSIONS.join(",")}
            onChange={props.onFileSelection}
            className={`mt-1 block w-full text-sm ${focusRing}`}
          />
          {props.draftFiles.length > 0 && (
            <ul className="mt-2 list-disc pl-5 text-sm text-neutral-700">
              {props.draftFiles.map((file) => (
                <li key={file.name}>{file.name}</li>
              ))}
            </ul>
          )}
        </div>
        {props.batchRead && (
          <p
            role="status"
            className="rounded border border-primary bg-white px-3 py-2 text-sm font-semibold text-neutral-800"
          >
            Reading documents… {props.batchRead.done} of {props.batchRead.total} read.
          </p>
        )}
        {failedItems.length > 0 && (
          <section
            aria-labelledby="batch-read-failures-heading"
            className="rounded border border-primary-dark bg-surface-light px-3 py-2"
          >
            <h3 id="batch-read-failures-heading" className="text-sm font-bold text-primary-dark">
              Documents that could not be read
            </h3>
            <ul
              aria-label="Failed documents"
              className="mt-1 list-disc space-y-1 pl-5 text-sm text-neutral-800"
            >
              {failedItems.map((item) => (
                <li key={item.index}>
                  <span className="font-semibold">{item.name}</span>: {item.error.message}
                </li>
              ))}
            </ul>
          </section>
        )}
        {props.inputError && (
          <p
            role="alert"
            className="rounded border border-primary-dark bg-surface-light px-3 py-2 text-sm font-semibold text-primary-dark"
          >
            {props.inputError}
          </p>
        )}
        <button
          type="button"
          onClick={props.onCreate}
          disabled={props.isExtracting}
          aria-busy={props.isExtracting}
          className={`rounded bg-primary-dark px-4 py-2 text-sm font-semibold text-white hover:bg-primary disabled:cursor-wait disabled:opacity-70 ${focusRing}`}
        >
          Create job
        </button>
      </div>
    </section>
  );
}

function StepPlaceholder({
  step,
  reviewError = null,
}: {
  step: FlowStep;
  reviewError?: string | null;
}): ReactElement {
  return (
    <section aria-labelledby={`${step}-step-heading`}>
      <h2 id={`${step}-step-heading`} className="font-display text-xl font-bold text-primary-dark">
        {STEP_LABELS[step]}
      </h2>
      {reviewError && (
        <p
          role="alert"
          className={`mt-3 rounded border border-primary-dark bg-surface-light px-3 py-2 text-sm font-semibold text-primary-dark ${focusRing}`}
        >
          {reviewError}
        </p>
      )}
      <p className="mt-2 max-w-2xl text-base leading-relaxed">
        This step is not implemented yet. Its functionality arrives with a later V4 migration
        ticket; use the step navigation above to move between steps.
      </p>
    </section>
  );
}
