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
  type PrivacyPolicyId,
  isStepAccessible
} from "./domain/job";
import { useJobSession } from "./useJobSession";

const STEP_LABELS: Record<FlowStep, string> = {
  input: "Input",
  configure: "Configure",
  review: "Review",
  "privacy-gate": "Privacy Gate",
  export: "Export"
};

const KIND_LABELS: Record<JobKind, string> = {
  text: "Text job",
  document: "Document job",
  "document-batch": "Document batch",
  structured: "Structured job"
};

const POLICY_LABELS: Record<PrivacyPolicyId, string> = {
  standard: "Standard",
  "external-ai": "External AI",
  "longitudinal-research": "Longitudinal Research",
  strict: "Strict"
};

const SUPPORTED_EXTENSIONS = [".txt", ".pdf", ".docx", ".csv", ".xls", ".xlsx"];

const focusRing =
  "focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2";

function extensionOf(fileName: string): string {
  const dot = fileName.lastIndexOf(".");
  return dot >= 0 ? fileName.slice(dot + 1).toLowerCase() : "";
}

export function App() {
  const session = useJobSession();
  const job = session.job;
  const [draftText, setDraftText] = useState("");
  const [draftFiles, setDraftFiles] = useState<{ name: string; extension: string }[]>([]);
  const [inputError, setInputError] = useState<string | null>(null);

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

  const handleCreateFromDraft = () => {
    const hasText = draftText.trim().length > 0;
    if (hasText && draftFiles.length > 0) {
      setInputError("Use either pasted text or files for one job, not both.");
      return;
    }
    if (hasText) {
      handleCreateJob({ type: "pasted-text", text: draftText });
      return;
    }
    if (draftFiles.length > 0) {
      handleCreateJob({ type: "files", files: draftFiles });
      return;
    }
    // Surface the domain's typed empty-input error instead of guessing.
    handleCreateJob({ type: "pasted-text", text: "" });
  };

  const handleFileSelection = (event: ChangeEvent<HTMLInputElement>) => {
    const selected = Array.from(event.target.files ?? []).map((file) => ({
      name: file.name,
      extension: extensionOf(file.name)
    }));
    setDraftFiles(selected);
    event.target.value = "";
  };

  const handleClearSession = () => {
    session.clear();
    resetDraft();
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

      <StepNavigation
        job={job}
        currentStep={currentStep}
        onGoToStep={(step) => {
          try {
            session.navigate(step);
            setInputError(null);
          } catch (error) {
            setInputError(
              error instanceof JobModelError
                ? error.message
                : "That step is not available right now."
            );
          }
        }}
      />

      <main id="main-content" className="mx-auto max-w-5xl px-4 py-8">
        {currentStep === "input" ? (
          <InputStep
            draftText={draftText}
            draftFiles={draftFiles}
            inputError={inputError}
            onDraftTextChange={setDraftText}
            onFileSelection={handleFileSelection}
            onCreate={handleCreateFromDraft}
          />
        ) : (
          <StepPlaceholder step={currentStep} />
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
  draftFiles: { name: string; extension: string }[];
  inputError: string | null;
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
        Paste text or select document or structured files to start a job. The job type is
        inferred from your input; mixed or unsupported input is rejected.
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
          <p role="alert" className="rounded border border-primary-dark bg-surface-light px-3 py-2 text-sm font-semibold text-primary-dark">
            {props.inputError}
          </p>
        )}
        <button
          type="button"
          onClick={props.onCreate}
          className={`rounded bg-primary-dark px-4 py-2 text-sm font-semibold text-white hover:bg-primary ${focusRing}`}
        >
          Create job
        </button>
      </div>
    </section>
  );
}

function StepPlaceholder({ step }: { step: FlowStep }): ReactElement {
  return (
    <section aria-labelledby={`${step}-step-heading`}>
      <h2 id={`${step}-step-heading`} className="font-display text-xl font-bold text-primary-dark">
        {STEP_LABELS[step]}
      </h2>
      <p className="mt-2 max-w-2xl text-base leading-relaxed">
        This step is not implemented yet. Its functionality arrives with a later V4
        migration ticket; use the step navigation above to move between steps.
      </p>
    </section>
  );
}
