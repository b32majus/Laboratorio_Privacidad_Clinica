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
import { useState } from "react";
import type { ChangeEvent, ReactElement } from "react";

import {
  FLOW_STEPS,
  type FlowStep,
  type Job,
  type JobInput,
  type JobKind,
  JobModelError,
  type JobSourceFile,
  type PrivacyPolicyId,
  isDocumentExtension,
  isStepAccessible,
  isStructuredExtension,
} from "./domain/job";
import { EngineError } from "./engine/types";
import { PolicyError } from "./engine/policy";
import { extractFile, extractFromPastedText } from "./input/extract";
import { extensionOf } from "./input/extracted-source";
import { ExportStep } from "./export/ExportStep";
import { PrivacyGate } from "./privacy-gate/PrivacyGate";
import { ReviewWorkspace } from "./review/ReviewWorkspace";
import { ReviewSessionError, jobSupportsReview, startReviewSession } from "./review/review-domain";
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

const focusRing =
  "focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2";

export function App() {
  const session = useJobSession();
  const job = session.job;
  const review = session.review;
  const [draftText, setDraftText] = useState("");
  const [draftFiles, setDraftFiles] = useState<File[]>([]);
  const [inputError, setInputError] = useState<string | null>(null);
  const [isExtracting, setIsExtracting] = useState(false);
  const [reviewError, setReviewError] = useState<string | null>(null);

  const resetDraft = () => {
    setDraftText("");
    setDraftFiles([]);
    setInputError(null);
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
      // Structured files carry metadata only until T18; a mixed selection
      // reaches the domain and fails with its own typed ambiguous-input error.
      handleCreateJob({ type: "files", files: metadataFiles() });
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
   * resulting ReviewSession as the domain review authority (T07). Re-entering
   * Review never re-runs the engine or resets decisions; batch and structured
   * jobs keep an honest placeholder until their own tickets arrive.
   */
  const handleGoToStep = (step: FlowStep) => {
    try {
      if (step === "review" && job && !review && jobSupportsReview(job)) {
        session.beginReview(startReviewSession(job));
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
            onDraftTextChange={setDraftText}
            onFileSelection={handleFileSelection}
            onCreate={handleCreateFromDraft}
          />
        ) : currentStep === "review" && review ? (
          <ReviewWorkspace
            session={review}
            onDecide={session.decide}
            onAddManual={session.addManual}
          />
        ) : currentStep === "privacy-gate" && review && job ? (
          <PrivacyGate job={job} review={review} />
        ) : currentStep === "export" && review && job ? (
          <ExportStep job={job} review={review} />
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
  onDraftTextChange: (text: string) => void;
  onFileSelection: (event: ChangeEvent<HTMLInputElement>) => void;
  onCreate: () => void;
}) {
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
