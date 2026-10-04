/**
 * V4 application shell (SPEC_V4_APP_AND_REVIEW.md §2/§8, D-001).
 *
 * One SPA owning a Job across the canonical flow
 * Input → Configure → Review → Privacy Gate → Export.
 * There is no router and no URL state: job content never reaches the URL.
 * Each step renders an honest, job-aware state (configure / review / gate /
 * export); the shell never fakes review or output readiness (SPEC §8).
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
import type { StructuredConfiguration } from "./structured/configuration";
import type { StructuredOutputPreparation } from "./structured/transformed-dataset";
import { readStructuredFile, readStructuredSheet } from "./structured/intake";
import {
  buildPolicyGuidance,
  isPolicySelectableForJobKind,
  NO_JOB_AVAILABILITY_NOTE,
  POLICY_AVAILABILITY_LABELS,
} from "./policy-guidance";
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
   * read phase can never start processing mid-read. Structured jobs keep their
   * review in the Configure workspace, so entering Review never starts a text
   * review session for them.
   */
  const handleGoToStep = async (step: FlowStep) => {
    try {
      if (
        step === "review" &&
        job &&
        !review &&
        job.kind !== "document-batch" &&
        jobSupportsReview(job)
      ) {
        // T22 #26 WU-D: processing is async (lazy engine load, later the
        // Worker boundary). The typed failure still keeps the app on the
        // current step; the UI simply waits for the outcome before
        // navigating.
        const failure = await session.startReview();
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
      // other typed domain failures so a policy that cannot complete becomes
      // an actionable message instead of the generic fallback.
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
  /** Exact structured plan + preparation for the CURRENT structured job. */
  const structuredPreparation =
    session.structured !== null && job !== null && session.structured.jobId === job.id
      ? session.structured.preparation
      : null;
  const structuredGateInput =
    session.structured !== null && job !== null && session.structured.jobId === job.id
      ? {
          configuration: session.structured.configuration,
          plan: session.structured.plan,
          preparation: session.structured.preparation,
        }
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
    // T22 #26 WU-D: processing is async (lazy engine load, later the Worker
    // boundary). startReview() itself drops stale outcomes (async gap guard),
    // so a non-null failure always belongs to the still-current job.
    void startReview().then((failure) => {
      if (failure) setReviewError(failure.message);
    });
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
                title="Start a new job. Replaces the current job and clears its drafts."
                aria-describedby="session-actions-help"
                className={`rounded border border-primary-dark bg-primary-dark px-3 py-1.5 text-sm font-semibold text-white hover:bg-primary ${focusRing}`}
              >
                New Job
              </button>
              <button
                type="button"
                onClick={handleClearSession}
                title="Discard all in-memory job data, review state and drafts from this browser session."
                aria-describedby="session-actions-help"
                className={`rounded border border-primary-dark px-3 py-1.5 text-sm font-semibold text-primary-dark hover:bg-surface-dark hover:text-white ${focusRing}`}
              >
                Clear session
              </button>
            </div>
          </div>
          <p id="session-actions-help" className="mt-2 text-xs leading-relaxed text-neutral-600">
            New Job starts a new job and replaces the current one. Clear session deliberately
            discards all in-memory job data, review state and drafts from this browser session.
          </p>
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
                onChange={(event) => {
                  // POLICY-01 (#56): the option is disabled AND this handler
                  // guards the same derived availability, so a change event for
                  // an unavailable policy is a no-op and the controlled select
                  // keeps showing the job's policy.
                  const next = event.target.value as PrivacyPolicyId;
                  if (job === null || !isPolicySelectableForJobKind(next, job.kind)) return;
                  session.updatePolicy(next);
                }}
                title={job ? undefined : "Create a job first"}
                className={`rounded border border-primary bg-white px-2 py-1 text-sm ${focusRing}`}
              >
                {(Object.keys(POLICY_LABELS) as PrivacyPolicyId[]).map((policyId) => (
                  <option
                    key={policyId}
                    value={policyId}
                    disabled={job !== null && !isPolicySelectableForJobKind(policyId, job.kind)}
                  >
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
            onOverrideAction={session.overrideStructuredColumnAction}
            onSelectPatientId={session.selectStructuredPatientId}
            onSetDateRole={session.setStructuredColumnDateRole}
            exportReadiness={
              structuredPreparation === null
                ? null
                : {
                    ready: structuredPreparation.status === "ready",
                    reasons: structuredPreparation.reasons,
                  }
            }
          />
        ) : currentStep === "configure" && job ? (
          <UnstructuredConfigureState job={job} reviewError={reviewError} />
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
        ) : currentStep === "review" && job && job.kind === "structured" ? (
          <StructuredReviewNotice
            job={job}
            configuration={structuredConfiguration}
            preparation={structuredPreparation}
            onGoToStep={handleGoToStep}
          />
        ) : currentStep === "privacy-gate" &&
          job &&
          (activeReview !== null || isBatch || structuredGateInput !== null) ? (
          <PrivacyGate
            job={job}
            review={activeReview}
            batchSessions={batchSessions === null ? [] : Object.values(batchSessions)}
            structured={structuredGateInput}
          />
        ) : currentStep === "export" &&
          job &&
          (activeReview !== null || isBatch || structuredGateInput !== null) ? (
          <ExportStep job={job} review={activeReview} structured={structuredGateInput} />
        ) : (
          <StepUnavailableState step={currentStep} reviewError={reviewError} />
        )}
      </main>

      {/*
       * Task-first hierarchy (UX-CLOSEOUT-01 outcome A): the active workspace
       * renders before the persistent policy guidance, so four full policy
       * cards never precede the user's task. All four POLICY-01 entries, the
       * current-policy line and the patient-ID requirement stay discoverable
       * here, derived from the same `buildPolicyGuidance` authorities.
       */}
      <PolicyGuidance job={job} />
    </div>
  );
}

/**
 * Job-aware Privacy Policy guidance (issue #56, POLICY-01).
 *
 * The workspace is discoverable BEFORE Review, in the existing shell. It shows
 * the current policy, whether it is available for the current job kind, and
 * concise guidance for all four accepted policies. Availability and the
 * patient-ID requirement are DERIVED through `buildPolicyGuidance` from the
 * same pure authorities the engine uses; this component never hard-codes a
 * second operator mapping or availability table.
 *
 * The region is keyboard-focusable with the shared visible focus ring, and the
 * availability state is always conveyed as text (never by color alone).
 */
function PolicyGuidance({ job }: { job: Job | null }) {
  const entries = buildPolicyGuidance(job ? job.kind : null);
  const currentEntry =
    job !== null ? entries.find((entry) => entry.policyId === job.policyId) : undefined;
  return (
    <section
      aria-labelledby="privacy-policy-guidance-heading"
      tabIndex={0}
      className={`border-b border-primary/30 bg-surface-light ${focusRing}`}
    >
      <div className="mx-auto max-w-5xl px-4 py-4">
        <h2
          id="privacy-policy-guidance-heading"
          className="font-display text-lg font-bold text-neutral-800"
        >
          Privacy Policy
        </h2>
        <p className="mt-1 text-sm leading-relaxed text-neutral-700">
          Each policy maps detected information categories to privacy transformations. Availability
          depends on the job type.
        </p>
        {job !== null && currentEntry ? (
          <p className="mt-2 text-sm text-neutral-800">
            <span className="font-semibold">Current policy:</span> {POLICY_LABELS[job.policyId]} —{" "}
            <span>
              {currentEntry.availability === "available"
                ? POLICY_AVAILABILITY_LABELS.available
                : POLICY_AVAILABILITY_LABELS.unavailable}
            </span>
          </p>
        ) : (
          <p className="mt-2 text-sm text-neutral-700">{NO_JOB_AVAILABILITY_NOTE}</p>
        )}
        <ul aria-label="Privacy Policy guidance" className="mt-3 grid gap-3 sm:grid-cols-2">
          {entries.map((entry) => (
            <li key={entry.policyId} className="rounded-lg border border-primary/30 bg-white p-3">
              <p className="flex flex-wrap items-center gap-2">
                <span className="font-semibold text-neutral-800">
                  {POLICY_LABELS[entry.policyId]}
                </span>
                {entry.availability !== "unknown" && (
                  <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs font-semibold tracking-wide text-neutral-700">
                    {entry.availability === "available"
                      ? POLICY_AVAILABILITY_LABELS.available
                      : POLICY_AVAILABILITY_LABELS.unavailable}
                  </span>
                )}
              </p>
              <p className="mt-1 text-sm leading-relaxed text-neutral-700">{entry.guidance}</p>
              {entry.requiresPatientIdColumn && (
                <p className="mt-1 text-sm font-semibold text-neutral-800">
                  Requires an explicit patient-ID column.
                </p>
              )}
            </li>
          ))}
        </ul>
      </div>
    </section>
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

/**
 * Display-only family chip for one selected file (UX-PILOT-01 #52). It reuses
 * the SAME extension authorities as intake so the label cannot drift from the
 * routing rules, but it is purely informational: `handleCreateFromDraft` and
 * the domain remain the only intake authority. An unrecognized extension is
 * shown as "Unsupported" and still fails closed on create.
 */
function selectedFileFamilyLabel(fileName: string): string {
  const extension = extensionOf(fileName);
  if (isDocumentExtension(extension)) return "Document";
  if (isStructuredExtension(extension)) return "Structured";
  return "Unsupported";
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
  const selectedCount = props.draftFiles.length;
  return (
    <section aria-labelledby="input-step-heading">
      <header className="max-w-3xl">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-neutral-600">Input</p>
        <h2
          id="input-step-heading"
          className="mt-1 font-display text-3xl font-bold tracking-tight text-primary-dark"
        >
          New Privacy Job
        </h2>
        <p className="mt-2 text-base leading-relaxed text-neutral-700">
          Start a privacy job by pasting clinical text or selecting files. One job type is inferred
          from your input.
        </p>
      </header>

      <p className="mt-4 max-w-3xl text-sm leading-relaxed text-neutral-600">
        Use one input per job: pasted text or files, not both.
      </p>

      <div className="mt-6 grid gap-5 lg:grid-cols-2">
        <section
          aria-labelledby="paste-text-heading"
          className="flex flex-col rounded-xl border border-primary/40 bg-white p-5 shadow-sm"
        >
          <h3 id="paste-text-heading" className="font-display text-lg font-bold text-neutral-800">
            Paste clinical text
          </h3>
          <p className="mt-1 text-sm leading-relaxed text-neutral-600">
            Free text such as notes, reports or correspondence.
          </p>
          <label htmlFor="paste-text" className="mt-4 block text-sm font-semibold text-neutral-800">
            Paste text
          </label>
          <textarea
            id="paste-text"
            value={props.draftText}
            onChange={(event) => props.onDraftTextChange(event.target.value)}
            rows={7}
            className={`mt-1 w-full rounded-lg border border-primary bg-surface-light px-3 py-2 text-sm ${focusRing}`}
          />
        </section>

        <section
          aria-labelledby="select-files-heading"
          className="flex flex-col rounded-xl border border-primary/40 bg-white p-5 shadow-sm"
        >
          <h3 id="select-files-heading" className="font-display text-lg font-bold text-neutral-800">
            Choose files
          </h3>
          <p className="mt-1 text-sm leading-relaxed text-neutral-600">
            Documents (TXT, PDF, DOCX) or structured tables (CSV, XLS, XLSX).
          </p>
          <label
            htmlFor="select-files"
            className="mt-4 block text-sm font-semibold text-neutral-800"
          >
            Select files (TXT, PDF, DOCX, CSV, XLS, XLSX)
          </label>
          <input
            id="select-files"
            type="file"
            multiple
            accept={SUPPORTED_EXTENSIONS.join(",")}
            onChange={props.onFileSelection}
            className={`mt-1 block w-full text-sm ${focusRing}`}
          />
          {selectedCount > 0 && (
            <div className="mt-3 rounded-lg border border-primary/40 bg-surface-light p-3">
              <p className="text-sm font-semibold text-neutral-800">
                {selectedCount === 1 ? "1 file selected" : `${selectedCount} files selected`}
              </p>
              <ul aria-label="Selected files" className="mt-2 space-y-1.5">
                {props.draftFiles.map((file, index) => (
                  <li
                    key={`${file.name}-${index}`}
                    className="flex flex-wrap items-center justify-between gap-2 text-sm"
                  >
                    <span className="break-all font-medium text-neutral-800">{file.name}</span>
                    <span className="rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-semibold uppercase tracking-wide text-neutral-700">
                      {selectedFileFamilyLabel(file.name)}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </section>
      </div>

      <section
        aria-labelledby="job-type-inference-heading"
        className="mt-5 rounded-xl border border-primary/30 bg-surface-light p-4"
      >
        <h3
          id="job-type-inference-heading"
          className="text-sm font-bold uppercase tracking-wide text-neutral-800"
        >
          How the job type is chosen
        </h3>
        <p className="mt-1 text-sm leading-relaxed text-neutral-700">
          Each supported input maps to one job type. Mixed or unsupported combinations are rejected.
        </p>
        <ul className="mt-3 grid gap-2 text-sm text-neutral-700 sm:grid-cols-2">
          <li>
            <span className="font-semibold text-neutral-800">Pasted clinical text</span> → Text job
          </li>
          <li>
            <span className="font-semibold text-neutral-800">One TXT, PDF or DOCX</span> → Document
            job
          </li>
          <li>
            <span className="font-semibold text-neutral-800">Two or more documents</span> → Document
            batch
          </li>
          <li>
            <span className="font-semibold text-neutral-800">One CSV, XLS or XLSX</span> →
            Structured job
          </li>
        </ul>
      </section>

      <div className="mt-5 max-w-3xl space-y-4">
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
          className={`rounded-lg bg-primary-dark px-5 py-2.5 text-sm font-semibold text-white hover:bg-primary disabled:cursor-wait disabled:opacity-70 ${focusRing}`}
        >
          Create job
        </button>
      </div>
    </section>
  );
}

/**
 * Honest "no additional configuration" Configure state for the job kinds whose
 * accepted pipeline has no configuration phase (text, document, document
 * batch). It replaces the former migration placeholder (UX-CLOSEOUT-01 outcome
 * B) and is phrased only from existing Job/policy facts, pointing at the next
 * canonical Review action without changing any step-access rule.
 */
function UnstructuredConfigureState({
  job,
  reviewError = null,
}: {
  job: Job;
  reviewError?: string | null;
}): ReactElement {
  return (
    <section aria-labelledby="configure-step-heading">
      <h2 id="configure-step-heading" className="font-display text-xl font-bold text-primary-dark">
        Configure
      </h2>
      {reviewError && (
        <p
          role="alert"
          className={`mt-3 max-w-2xl rounded border border-primary-dark bg-surface-light px-3 py-2 text-sm font-semibold text-primary-dark ${focusRing}`}
        >
          {reviewError}
        </p>
      )}
      <p className="mt-2 max-w-2xl text-base leading-relaxed">
        No additional configuration is required for a {KIND_LABELS[job.kind].toLowerCase()}. The
        selected policy ({POLICY_LABELS[job.policyId]}) is applied when Review runs; this job type
        has no per-column or per-field configuration step.
      </p>
      <p className="mt-3 max-w-2xl text-sm leading-relaxed text-neutral-700">
        Continue to Review with the step navigation above. Review shows every detected identifier
        and requires an explicit decision before the Privacy Gate and Export become available.
      </p>
    </section>
  );
}

/**
 * Honest structured Review state (UX-CLOSEOUT-01 outcome B). Structured human
 * review already happens in Configure (column classification, the single
 * patient-ID authority and explicit date roles); this step never creates a
 * ReviewSession, detection review or any new structured semantics. Readiness
 * and blockers are summarized from the existing structured
 * configuration/preparation facts only, and the operator is directed back to
 * Configure when action is required or onward to the Privacy Gate when the
 * existing readiness permits.
 */
function StructuredReviewNotice({
  job,
  configuration,
  preparation,
  onGoToStep,
}: {
  job: Job;
  configuration: StructuredConfiguration | null;
  preparation: StructuredOutputPreparation | null;
  onGoToStep: (step: FlowStep) => void;
}): ReactElement {
  const blockedReasons =
    configuration !== null && preparation !== null && preparation.status === "blocked"
      ? preparation.reasons
      : [];
  const ready =
    configuration !== null &&
    (preparation === null ? configuration.exportReady : preparation.status === "ready");
  return (
    <section aria-labelledby="review-step-heading">
      <h2 id="review-step-heading" className="font-display text-xl font-bold text-primary-dark">
        Review
      </h2>
      <p className="mt-2 max-w-2xl text-base leading-relaxed">
        Structured review happens in Configure. For a {KIND_LABELS[job.kind].toLowerCase()}, column
        classification, the single patient-ID authority and explicit date roles are reviewed there;
        this step does not create a text review session.
      </p>
      {configuration === null ? (
        <p
          role="status"
          className="mt-3 max-w-2xl rounded border border-primary bg-surface-light px-3 py-2 text-sm font-semibold text-neutral-800"
        >
          The structured source has not been configured yet. Return to Configure to read it and
          review its columns before continuing.
        </p>
      ) : (
        <>
          <dl
            role="status"
            aria-label="Structured review readiness"
            className="mt-3 grid max-w-2xl grid-cols-2 gap-x-4 gap-y-1 text-sm text-neutral-800"
          >
            <dt className="font-semibold">Columns:</dt>
            <dd> {configuration.columns.length}</dd>
            <dt className="font-semibold">Columns requiring review:</dt>
            <dd> {configuration.columnsRequiringReview.length}</dd>
            <dt className="font-semibold">Structured export ready:</dt>
            <dd> {ready ? "Yes" : "No"}</dd>
            <dt className="font-semibold">Patient-ID column:</dt>
            <dd> {patientIdSummary(configuration)}</dd>
          </dl>
          {blockedReasons.length > 0 && (
            <ul
              role="alert"
              aria-label="Structured review blockers"
              className="mt-3 max-w-2xl list-disc space-y-0.5 rounded border border-primary-dark bg-white px-3 py-2 pl-6 text-sm font-semibold text-primary-dark"
            >
              {blockedReasons.map((reason, index) => (
                <li key={index}>{reason}</li>
              ))}
            </ul>
          )}
        </>
      )}
      <div className="mt-4 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => onGoToStep("configure")}
          className={`rounded border border-primary-dark px-4 py-2 text-sm font-semibold text-primary-dark hover:bg-surface-dark hover:text-white ${focusRing}`}
        >
          Back to Configure
        </button>
        {ready && (
          <button
            type="button"
            onClick={() => onGoToStep("privacy-gate")}
            className={`rounded bg-primary-dark px-4 py-2 text-sm font-semibold text-white hover:bg-primary ${focusRing}`}
          >
            Continue to Privacy Gate
          </button>
        )}
      </div>
    </section>
  );
}

/** Factual patient-ID selection summary from the canonical configuration only. */
function patientIdSummary(configuration: StructuredConfiguration): string {
  const { patientId } = configuration;
  if (patientId.status === "resolved") return patientId.column;
  if (patientId.status === "selection-error") return "Selection error";
  return "Not selected";
}

/**
 * Defensive fallback for a step that has no renderable job state (for example
 * Privacy Gate or Export reached before an active review exists). It states
 * the runtime fact only: no migration-placeholder copy (UX-CLOSEOUT-01
 * outcome B).
 */
function StepUnavailableState({
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
          className={`mt-3 max-w-2xl rounded border border-primary-dark bg-surface-light px-3 py-2 text-sm font-semibold text-primary-dark ${focusRing}`}
        >
          {reviewError}
        </p>
      )}
      <p className="mt-2 max-w-2xl text-base leading-relaxed">
        This step is not available for the current job state. Use the step navigation above to
        continue from an available step.
      </p>
    </section>
  );
}
