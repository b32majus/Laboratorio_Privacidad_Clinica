/**
 * V4 application shell (SPEC_V4_APP_AND_REVIEW.md §2/§8, D-001).
 *
 * One SPA owning a Job across the canonical flow
 * Input → Configure → Review → Privacy Gate → Export.
 * There is no router and no URL state: job content never reaches the URL.
 * Each step renders an honest, job-aware state (configure / review / gate /
 * export); the shell never fakes review or output readiness (SPEC §8).
 *
 * Sensitive job data stays memory-only (D-013); "Borrar sesión" discards it.
 */
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import type { ChangeEvent, ReactElement } from "react";
import { flushSync } from "react-dom";

import {
  type BatchItemReadOutcome,
  type FlowStep,
  type Job,
  type JobInput,
  type JobKind,
  JobModelError,
  type JobModelErrorCode,
  type JobSourceFile,
  type PrivacyPolicyId,
  batchFailedItems,
  inferJobKind,
  isDocumentExtension,
  isStepAccessible,
  isStructuredExtension,
} from "./domain/job";
import { EngineError } from "./engine/types";
import { PolicyError } from "./engine/policy";
import { extractFile, extractFromPastedText } from "./input/extract";
import {
  extensionOf,
  type ExtractedSource,
  type ExtractionErrorCode,
} from "./input/extracted-source";
import { SYNTHETIC_EXAMPLES } from "./input/synthetic-examples";
import { readTextFromClipboard } from "./output/clipboard";
import { ExportStep } from "./export/ExportStep";
import { PrivacyGate } from "./privacy-gate/PrivacyGate";
import { BatchReviewView } from "./review/BatchReviewView";
import { ReviewWorkspace } from "./review/ReviewWorkspace";
import { ReviewSessionError, jobSupportsReview } from "./review/review-domain";
import { StructuredConfigureWorkspace } from "./structured/StructuredConfigureWorkspace";
import { StructuredFreeTextReview } from "./structured/StructuredFreeTextReview";
import { deriveStructuredSummary } from "./structured/transformed-dataset";
import { readStructuredFile, readStructuredSheet } from "./structured/intake";
import {
  buildPolicyGuidance,
  isPolicySelectableForJobKind,
  NO_JOB_AVAILABILITY_NOTE,
  POLICY_AVAILABILITY_LABELS,
  POLICY_IDS,
} from "./policy-guidance";
import { useJobSession } from "./useJobSession";

const STEP_LABELS: Record<FlowStep, string> = {
  input: "Input",
  configure: "Configure",
  review: "Review",
  "privacy-gate": "Privacy Gate",
  export: "Export",
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

/**
 * REC-08 F1 (corrective): typed identity of a start-surface refusal.
 *
 * The domain/adapter that owns the refusal decision also owns its typed code;
 * the view carries that code here purely to SELECT a Spanish failure + remedy.
 * `fileName` is the already-visible source name (the literal `"pasted text"`
 * for pasted input) so the presentation can name WHICH entry was refused
 * without introducing a second extension classifier or re-deciding anything.
 */
type StartSurfaceRefusal = {
  readonly code: JobModelErrorCode | ExtractionErrorCode;
  readonly fileName?: string;
};

/**
 * Presented start-surface alert. `refusal` is a typed refusal awaiting the
 * Spanish presentation mapping below; `text` is copy the view already authored
 * (the mutual-exclusion / single-table guidance) or a non-refusal navigation
 * message passed through unchanged.
 */
type InputAlert =
  | { readonly kind: "refusal"; readonly refusal: StartSurfaceRefusal }
  | { readonly kind: "text"; readonly message: string };

const SUPPORTED_FORMATS_ES = "TXT, PDF, DOCX, CSV, XLS y XLSX";

/**
 * Presentation-only Spanish mapping for the typed start-surface refusals
 * (REC-08 F1, HPD-11, HPD §6.1). It does NOT decide, weaken or recover from a
 * refusal: the domain/adapter already refused and no job is created. Each
 * entry states the contextual failure AND an actionable remedy; a raw
 * exception message is never included, and the offending extension is read
 * from the already-visible file name — never re-classified here.
 */
function presentStartSurfaceRefusal(refusal: StartSurfaceRefusal): string {
  const file = refusal.fileName;
  const quoted = file !== undefined ? `"${file}"` : null;
  switch (refusal.code) {
    case "empty-input":
      return quoted === null
        ? "No hay texto que crear: escriba o pegue texto antes de crear el trabajo."
        : `El archivo ${quoted} no contiene texto utilizable. Añada contenido al documento o use otro archivo.`;
    case "ambiguous-input":
      return "No se pueden combinar documentos (TXT, PDF, DOCX) y tablas estructuradas (CSV, XLS, XLSX) en un mismo trabajo. Cree un trabajo aparte para cada tipo de archivo.";
    case "unsupported-file-type":
    case "unsupported-format": {
      const extension = file !== undefined ? extensionOf(file) : "";
      const subject =
        extension.length > 0
          ? `el formato ".${extension}"`
          : quoted !== null
            ? `el formato de ${quoted}`
            : "ese formato";
      return `No se admite ${subject}. Formatos admitidos: ${SUPPORTED_FORMATS_ES}. Convierta el archivo a un formato admitido e inténtelo de nuevo.`;
    }
    case "pdf-no-text-layer":
      return quoted === null
        ? "El PDF no contiene texto extraíble: probablemente sea un escaneo. Aplique OCR o use un PDF con capa de texto e inténtelo de nuevo."
        : `El PDF ${quoted} no contiene texto extraíble: probablemente sea un escaneo. Aplique OCR o use un PDF con capa de texto e inténtelo de nuevo.`;
    case "extraction-failed":
      return quoted === null
        ? "No se pudo leer el documento; puede estar dañado o no ser un archivo válido. Compruebe el archivo o conviértalo e inténtelo de nuevo."
        : `No se pudo leer el documento ${quoted}; puede estar dañado o no ser un archivo válido. Compruebe el archivo o conviértalo e inténtelo de nuevo.`;
    case "input-too-large":
      return "La entrada supera el tamaño admitido para procesarla en este dispositivo. Divídala en partes más pequeñas y cree un trabajo por cada parte.";
    default:
      return "La entrada no se pudo usar para crear un trabajo. Revise el texto o los archivos e inténtelo de nuevo.";
  }
}

/** Resolve the presented start-surface alert to its Spanish user-visible copy. */
function presentInputAlert(alert: InputAlert | null): string | null {
  if (alert === null) return null;
  return alert.kind === "text" ? alert.message : presentStartSurfaceRefusal(alert.refusal);
}

export function App() {
  const session = useJobSession();
  const job = session.job;
  const review = session.review;
  const { batchSessions, batchActiveIndex, batchRetryContextAvailable } = session;
  const startReview = session.startReview;
  const [draftText, setDraftText] = useState("");
  const [draftFiles, setDraftFiles] = useState<File[]>([]);
  const [inputError, setInputError] = useState<InputAlert | null>(null);
  const [isExtracting, setIsExtracting] = useState(false);
  const [reviewError, setReviewError] = useState<string | null>(null);
  /**
   * Issue #84 correction (REC-05 journey A): browser-memory-only provenance of
   * the last legitimately entered single-item Result. It records ONLY the
   * identity triple of the moment the shell actually navigated INTO the Result
   * through the domain-gated transition (never merely because a ReviewSession
   * exists, and never from a render effect): the domain Job id, the policy id
   * and the ReviewSession's own `sessionId`. Before the Review step may offer
   * an already-visited Result whose mandatory decisions are pending again, the
   * CURRENT triple must match exactly:
   *  - a REAL policy change drops the session (`updatePolicy` → review null)
   *    and any redone review runs the engine again, which generates a NEW
   *    `sessionId` — so the stale visit can never be reused;
   *  - `sessionId` is stable across decisions and manual-detection additions
   *    within one session, so the ordinary correction path (journey A) keeps
   *    the revisit while the Result itself truthfully reports needs-attention;
   *  - returning to a previous policy NAME (A→B→A) cannot restore obsolete
   *    authority: the identity is the session, not the policy label, and the
   *    A-again session is a different one;
   *  - a new Job has a different domain-generated id, so provenance is never
   *    inherited across jobs.
   * Render-effect recording is deliberately NOT used: an async review restart
   * installs the fresh session while the flow position still reads `export`
   * (the post-invalidation intermediate state), which is a state transition,
   * never a Result access. Result navigation stays navigation only
   * (CORA-84-02): safe downloads and prepared output remain controlled
   * exclusively by the canonical readiness authorities (`review.complete`,
   * `outputs.safeOutputReady`, `deriveSingleResultView`); this provenance only
   * ever gates whether the revisit action is OFFERED.
   */
  const [singleResultProvenance, setSingleResultProvenance] = useState<{
    readonly jobId: string;
    readonly policyId: PrivacyPolicyId;
    readonly reviewSessionId: string;
  } | null>(null);
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
  /**
   * Pending explicit header-row choice (REC-04 WU-A, D-022): the selected
   * worksheet resolved to zero/several header candidates, so the human must
   * pick the header row from the inspected rows. Job-scoped like the sheet
   * choice; indices only, never cell content.
   */
  const [structuredHeader, setStructuredHeader] = useState<{
    readonly jobId: string;
    readonly sheetName: string;
    readonly candidateRowIndices: readonly number[];
    readonly inspectedRowCount: number;
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

  /** Stable alias of the bridge's canonical navigation entry. */
  const navigate = session.navigate;

  const resetDraft = () => {
    setDraftText("");
    setDraftFiles([]);
    setInputError(null);
    setStructuredError(null);
    setStructuredSheet(null);
    setStructuredHeader(null);
    setFreeTextRunError(null);
    structuredFileRef.current = null;
  };

  /**
   * Create a Job from the given input. A typed refusal is remembered by its
   * TYPED identity (REC-08 F1) so the start surface can present a Spanish
   * failure + remedy without touching the domain authority. `refusalContext`
   * carries the already-visible source name of a refused file (captured by the
   * intake caller); no classification or refusal decision happens here.
   */
  const handleCreateJob = (input: JobInput, refusalContext?: { readonly fileName?: string }) => {
    try {
      session.create(input);
    } catch (error) {
      setInputError(
        error instanceof JobModelError
          ? { kind: "refusal", refusal: { code: error.code, fileName: refusalContext?.fileName } }
          : { kind: "text", message: "La entrada no se pudo usar para crear un trabajo." }
      );
      return false;
    }
    resetDraft();
    landCreatedJob(input);
    return true;
  };

  /**
   * Quiet-shell landing (issue #84, D-023 as PRODUCT STRUCTURE only). Called
   * SYNCHRONOUSLY with the creation write, from the single creation authority:
   * a newly created Job advances straight to its first REAL task surface using
   * the canonical domain transitions and nothing else — the structured
   * Configure workspace for structured work, Review for text/document/batch
   * work. The unstructured Configure stop has no task (G-HP2), so it is never
   * rendered; both moves are the domain's immediate-next steps and cannot
   * throw. Landing here (not in a passive effect) keeps the landing in the
   * SAME state write as the creation, so the async batch read loop's own
   * snapshot-based state writes can never clobber it, and no URL state is
   * introduced. Job classification is the domain's own `inferJobKind` — never
   * a second routing authority.
   */
  const landCreatedJob = (input: JobInput) => {
    if (inferJobKind(input) === "structured") {
      navigate("configure");
      return;
    }
    navigate("configure");
    navigate("review");
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
      // REC-08 F1: carry the first refused file's already-visible name so the
      // Spanish presentation can name it; the domain still owns the refusal.
      const firstFailure = results.find((result) => result.status === "failed");
      handleCreateJob(
        { type: "files", files: jobFiles },
        firstFailure !== undefined && firstFailure.status === "failed"
          ? { fileName: firstFailure.sourceName }
          : undefined
      );
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
      // The shared creation authority performs the quiet-shell landing (#84)
      // in the same state write as the creation, so the flushSync read-phase
      // transitions below build on committed state that already includes it.
      if (!handleCreateJob({ type: "files", files: metadata })) return;
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
      // REC-08: App-authored start-surface copy is Spanish-first (HPD-11).
      // Typed refusals below are carried by their typed code and PRESENTED in
      // Spanish via `presentStartSurfaceRefusal`; this view-owned
      // mutual-exclusion message is authored in Spanish directly.
      setInputError({
        kind: "text",
        message: "Use una sola entrada por trabajo: texto pegado o archivos, no ambos.",
      });
      return;
    }
    if (hasText) {
      // Pasted-text extraction is synchronous; typed failure surfaces as alert.
      const result = extractFromPastedText(draftText);
      if (result.status === "failed") {
        setInputError({ kind: "refusal", refusal: { code: result.error.code } });
        return;
      }
      // The shared creation authority performs the quiet-shell landing (#84).
      handleCreateJob({ type: "pasted-text", text: result.text });
      return;
    }
    if (draftFiles.length === 0) {
      // Surface the domain's typed empty-input error again, now by its typed
      // identity so the start surface presents it in Spanish (REC-08 F1).
      const result = extractFromPastedText("");
      setInputError(
        result.status === "failed"
          ? { kind: "refusal", refusal: { code: result.error.code } }
          : null
      );
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
        setInputError({
          kind: "text",
          message:
            "Los trabajos estructurados clasifican una tabla cada vez; cree un trabajo por cada archivo CSV o Excel.",
        });
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

  /**
   * Draft-files intake (REC-08): file selection AND drag/drop converge here.
   * Both entry mechanisms only stage `File` objects in the draft; routing,
   * extension classification and Job creation stay owned by
   * `handleCreateFromDraft` and the domain. Neither mechanism invents a
   * second extension classifier, reorders or drops files.
   */
  const handleDraftFiles = (files: File[]) => {
    setDraftFiles(files);
  };

  const handleFileSelection = (event: ChangeEvent<HTMLInputElement>) => {
    handleDraftFiles(Array.from(event.target.files ?? []));
    event.target.value = "";
  };

  const handleClearSession = () => {
    session.clear();
    resetDraft();
    setReviewError(null);
  };

  /**
   * Issue #84 correction (REC-05 journey A): whether the CURRENT
   * Job/policy/ReviewSession triple still matches the last legitimately
   * entered single-item Result. This is the ONLY extra fact that may offer an
   * already-visited Result while mandatory decisions are pending again; every
   * invalidation (real policy change, replaced ReviewSession, new Job,
   * A→B→A policy cycling) fails the exact-identity comparison. It widens
   * nothing else: output authorization stays untouched.
   */
  const singleResultRevisitAuthorized =
    singleResultProvenance !== null &&
    job !== null &&
    review !== null &&
    singleResultProvenance.jobId === job.id &&
    singleResultProvenance.policyId === job.policyId &&
    singleResultProvenance.reviewSessionId === review.sessionId;

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
   * read phase can never start processing mid-read. Structured jobs never
   * auto-start here either: free-text cell processing is an explicit
   * reviewer-triggered run on the Review step itself (REC-03 WU-C), so
   * entering Review never starts the engine or resets decisions.
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
      if (
        step === "export" &&
        job !== null &&
        (job.kind === "text" || job.kind === "document") &&
        !job.review.complete &&
        !singleResultRevisitAuthorized
      ) {
        return;
      }
      // Issue #85 §3.6: refuse a structured Result navigation whose readiness
      // was later invalidated. `withDerivedStructuredState` derives the
      // structured `review.complete` from the CURRENT preparation status, so
      // this is the same fail-closed gate the disabled button above exposes —
      // the transition is refused, not merely visually disabled. No structured
      // provenance exception exists (batches are decoupled, REC-07 #87;
      // structured work records none).
      if (step === "export" && job !== null && job.kind === "structured" && !job.review.complete) {
        return;
      }
      session.navigate(step);
      // Provenance recording (issue #84 correction, journey A): a SUCCESSFUL
      // navigation INTO the Result is the one legitimate single-item Result
      // access, so the identity triple is captured exactly here — at the
      // domain-gated transition (forward gated on `review.complete`/D-024,
      // backward on `visitedSteps`), never from a render effect. An async
      // review restart installs its fresh session while the flow position
      // still reads `export`; that intermediate state is a state transition,
      // NOT a Result access, and must never record provenance (otherwise a
      // redone review could resurrect the visited-Result action the CORA-84-02
      // contract forbids). Batches are excluded (their Result access is
      // decoupled, REC-07 #87) and structured work has no ReviewSession, so
      // neither can record. Pure navigation fact: no output authorization
      // changes here.
      if (
        step === "export" &&
        job !== null &&
        (job.kind === "text" || job.kind === "document") &&
        review !== null &&
        (job.review.complete || singleResultRevisitAuthorized)
      ) {
        setSingleResultProvenance({
          jobId: job.id,
          policyId: job.policyId,
          reviewSessionId: review.sessionId,
        });
      }
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
      else setInputError({ kind: "text", message });
    }
  };

  const currentStep: FlowStep = job ? job.currentStep : "input";
  /**
   * Step landing anchor (issue #84 PR #114 CI, review-export 1280px): the app
   * is ONE scrolling document, so a step transition otherwise carries the
   * previous step's scroll position into the next one and clamps the new
   * step's landing to its own bottom — the composed Result then opens pinned
   * to its download zone with the kept-original warning and the state summary
   * above the fold. Every step change lands at the top of the new workspace
   * (the same landing rule the Review workspace already applies for itself),
   * so the state, the factual warnings and the primary action are perceptible
   * together (HPD-09/HPD-10 hierarchy; #142 composed-screen gate). Layout
   * effect: the anchor applies before the landing paints, with no scroll
   * flicker. The guard keeps jsdom unit runs untouched (scrollY is always 0
   * there) and skips pointless same-position scrolls in real browsers.
   */
  useLayoutEffect(() => {
    if (window.scrollY !== 0) window.scrollTo(0, 0);
  }, [currentStep]);
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
  /**
   * Job-scoped structured output options for the CURRENT structured job
   * (REC-04 WU-B): values and callbacks come from the single bridge options
   * authority; the summary is derived from the canonical configuration.
   * Memory-only; nothing here persists.
   */
  const structuredOutputOptions =
    structuredConfiguration === null || session.structuredOptions === null
      ? null
      : {
          prefix: session.structuredOptions.studyIdPrefix,
          prefixResolution: session.structuredPrefixResolution,
          prefixInvalid:
            session.structuredPrefixResolution?.status === "invalid"
              ? session.structuredPrefixResolution.reason
              : null,
          addVisitNumber: session.structuredOptions.addVisitNumber,
          visitAvailable: structuredConfiguration.patientId.status === "resolved",
          summary: deriveStructuredSummary(structuredConfiguration),
          onPrefixChange: session.setStructuredStudyIdPrefix,
          onToggleVisitNumber: session.setStructuredAddVisitNumber,
        };
  const structuredGateInput =
    session.structured !== null && job !== null && session.structured.jobId === job.id
      ? {
          configuration: session.structured.configuration,
          plan: session.structured.plan,
          preparation: session.structured.preparation,
        }
      : null;
  /** Job-scoped free-text cell sessions for the CURRENT structured job (REC-03 WU-C). */
  const structuredFreeText =
    session.structuredFreeText !== null && job !== null && session.structured?.jobId === job.id
      ? session.structuredFreeText
      : null;
  const structuredFreeTextActive =
    job !== null && session.structured?.jobId === job.id ? session.structuredFreeTextActive : null;
  /** Whether the current structured configuration routes any free-text column. */
  const hasFreeTextColumns =
    structuredConfiguration !== null &&
    structuredConfiguration.columns.some((column) => column.effectiveAction === "process-as-text");
  /**
   * Issue #85 §3.4: whether the CURRENT structured job has NO cell routed to
   * `process-as-text` — the case where the no-op Review stop must never
   * render and the «Continuar a la revisión» detour must never be offered.
   * A missing configuration counts as no free text (fail-safe: nothing known
   * to review as text).
   */
  const structuredNoFreeText = job !== null && job.kind === "structured" && !hasFreeTextColumns;

  /**
   * Issue #85 §3.4: from Configure, a structured job WITHOUT free-text cells
   * proceeds to the factual privacy check within ONE intentional navigation.
   * The canonical internal order (`configure → review → privacy-gate`) is
   * preserved by performing BOTH immediate-next transitions through the same
   * domain navigation authority (`session.navigate`, the `landCreatedJob`
   * precedent): the no-op Review stop is passed through internally and never
   * renders — no new ad-hoc `goToStep` rule, no altered domain gate. Both
   * moves are immediate-next canonical transitions and cannot throw.
   */
  const handleStructuredConfigureToGate = () => {
    // Issue #85 F1 (CORA-85-01 correction 2): without a resolved structured
    // configuration the Privacy Gate is not a reachable state — no sheet has
    // been loaded and no header row confirmed yet. The guard makes the
    // intentional navigation a no-op instead of landing on an impossible
    // privacy check; the canonical transitions themselves are untouched.
    if (structuredConfiguration === null) return;
    session.navigate("review");
    session.navigate("privacy-gate");
  };

  /**
   * Last free-text run failure, job-scoped so a stale message can never
   * leak onto another job (the bridge drops the state itself on
   * policy/config changes; this only carries the run's own failure text).
   */
  const [freeTextRunError, setFreeTextRunError] = useState<{
    readonly jobId: string;
    readonly message: string;
  } | null>(null);
  const runStructuredFreeText = async () => {
    const failure = await session.runStructuredFreeTextReview();
    if (failure) {
      const currentId = jobIdRef.current;
      setFreeTextRunError(
        currentId === null ? null : { jobId: currentId, message: failure.message }
      );
    } else {
      setFreeTextRunError(null);
    }
    return failure;
  };

  /**
   * Structured intake (T20 #24): parse the single selected CSV/XLS/XLSX file
   * with the T18 authorities and install the canonical configuration in the
   * domain bridge. A multi-sheet workbook waits for an explicit sheet choice;
   * an ambiguous workbook sheet waits for an explicit header-row choice
   * (REC-04 WU-A, D-022); every failure is typed and surfaced (never a silent
   * empty table). The parsed configuration is only installed when the job it
   * was read for is still the current job (stale reads are discarded).
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
        setStructuredHeader(null);
      } else if (outcome.status === "sheet-required") {
        structuredFileRef.current = file;
        setStructuredSheet({ jobId, sheetNames: outcome.sheetNames });
        setStructuredHeader(null);
      } else if (outcome.status === "header-row-required") {
        structuredFileRef.current = file;
        setStructuredSheet(null);
        setStructuredHeader({
          jobId,
          sheetName: outcome.sheetName,
          candidateRowIndices: outcome.candidateRowIndices,
          inspectedRowCount: outcome.inspectedRowCount,
        });
      } else {
        setStructuredError(outcome.message);
        setStructuredHeader(null);
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
        setStructuredHeader(null);
        structuredFileRef.current = null;
      } else if (outcome.status === "header-row-required") {
        setStructuredSheet(null);
        setStructuredHeader({
          jobId: pending.jobId,
          sheetName: outcome.sheetName,
          candidateRowIndices: outcome.candidateRowIndices,
          inspectedRowCount: outcome.inspectedRowCount,
        });
      } else if (outcome.status === "failed") {
        setStructuredError(outcome.message);
        setStructuredHeader(null);
      }
    } finally {
      setIsExtracting(false);
    }
  };

  /** Resolve a pending header-row choice with the explicitly selected row. */
  const handleSelectStructuredHeaderRow = async (rowIndex: number) => {
    const file = structuredFileRef.current;
    const pending = structuredHeader;
    if (!file || !pending) return;
    setIsExtracting(true);
    try {
      const outcome = await readStructuredSheet(file, pending.sheetName, rowIndex);
      if (jobIdRef.current !== pending.jobId) return;
      if (outcome.status === "parsed") {
        session.installStructuredGrid(outcome.grid);
        setStructuredError(null);
        setStructuredHeader(null);
        structuredFileRef.current = null;
      } else if (outcome.status === "header-row-required") {
        setStructuredHeader({
          jobId: pending.jobId,
          sheetName: outcome.sheetName,
          candidateRowIndices: outcome.candidateRowIndices,
          inspectedRowCount: outcome.inspectedRowCount,
        });
      } else if (outcome.status === "failed") {
        // Keep the pending choice so the human can retry another inspected
        // row; only an explicit new job/selection clears it.
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

  /**
   * Quiet-shell review start (issue #84): landing a text/document Job on
   * Review starts the ONE local processing attempt for that Job — the same
   * T15/T22 contract the former Configure→Review transition had (once-only
   * per Job, typed failure surfaced, app stays on Review). The ref keys the
   * attempt on the Job id: a later invalidation (a REAL policy change resets
   * the derived review state) never auto-re-runs the engine; the shell then
   * shows the factual pending state and the explicit "Iniciar revisión"
   * action instead. Batches are excluded: the reads-settle effect above owns
   * their one-shot attempt.
   */
  const reviewStartAttemptedRef = useRef<string | null>(null);
  const [reviewStartInFlight, setReviewStartInFlight] = useState(false);
  useEffect(() => {
    if (currentStep !== "review" || job === null) return;
    if (job.kind === "document-batch") return;
    if (review !== null || reviewStartInFlight) return;
    if (!jobSupportsReview(job)) return;
    if (reviewStartAttemptedRef.current === job.id) return;
    reviewStartAttemptedRef.current = job.id;
    setReviewStartInFlight(true);
    void startReview().then((failure) => {
      setReviewStartInFlight(false);
      if (failure) setReviewError(failure.message);
    });
  }, [currentStep, job, review, reviewStartInFlight, startReview]);

  /**
   * Explicit review (re)start from the shell's task actions: the same
   * handleGoToStep("review") authority the navigation used before, wrapped so
   * the transient in-flight fact can suppress a duplicate affordance.
   */
  const handleStartReview = () => {
    setReviewStartInFlight(true);
    void handleGoToStep("review").finally(() => setReviewStartInFlight(false));
  };

  return (
    <div className="min-h-screen bg-background-light font-sans text-neutral-800">
      <a
        href="#main-content"
        className={`sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-10 focus:rounded focus:bg-background-dark focus:px-4 focus:py-2 focus:text-white ${focusRing}`}
      >
        Saltar al contenido principal
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
                title="Inicia un trabajo nuevo. Sustituye el trabajo actual y borra sus borradores."
                aria-describedby="session-actions-help"
                className={`rounded border border-primary-dark bg-primary-dark px-3 py-1.5 text-sm font-semibold text-white hover:bg-primary ${focusRing}`}
              >
                Nuevo trabajo
              </button>
              <button
                type="button"
                onClick={handleClearSession}
                title="Descarta de forma deliberada todos los datos del trabajo en memoria, el estado de revisión y los borradores de esta sesión del navegador."
                aria-describedby="session-actions-help"
                className={`rounded border border-primary-dark px-3 py-1.5 text-sm font-semibold text-primary-dark hover:bg-surface-dark hover:text-white ${focusRing}`}
              >
                Borrar sesión
              </button>
            </div>
          </div>
          <p id="session-actions-help" className="mt-2 text-xs leading-relaxed text-neutral-600">
            Nuevo trabajo inicia un trabajo nuevo y sustituye al actual. Borrar sesión descarta de
            forma deliberada todos los datos del trabajo en memoria, el estado de revisión y los
            borradores de esta sesión del navegador.
          </p>
          <div className="mt-3 flex flex-wrap items-center gap-x-6 gap-y-2 text-sm text-neutral-700">
            <p>
              <span className="font-semibold text-neutral-800">Trabajo:</span>{" "}
              {job ? job.name : "Aún no hay trabajo"}
            </p>
            {/* Issue #84 correction (spec F): the internal job kind is not
                permanent chrome on any task surface. The kind stays a factual,
                contextual fact where it is meaningful (e.g. the intake
                confirmation and policy guidance); the header keeps only the
                truthful persistent facts below. */}
            <label className="flex items-center gap-2">
              <span className="font-semibold text-neutral-800">Política de privacidad:</span>
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
                title={job ? undefined : "Cree primero un trabajo"}
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
              El procesamiento se ejecuta localmente en su navegador; el contenido del trabajo
              permanece en este dispositivo.
            </p>
          </div>
        </div>
      </header>

      <main id="main-content" className="mx-auto max-w-5xl px-4 py-8">
        {currentStep === "input" ? (
          <InputStep
            draftText={draftText}
            draftFiles={draftFiles}
            inputError={presentInputAlert(inputError)}
            isExtracting={isExtracting}
            batchRead={batchRead}
            batchJob={job}
            onDraftTextChange={setDraftText}
            onFileSelection={handleFileSelection}
            onFilesDropped={handleDraftFiles}
            onCreate={handleCreateFromDraft}
          />
        ) : currentStep === "configure" && job && job.kind === "structured" ? (
          <StructuredConfigureWorkspace
            key={job.id}
            configuration={structuredConfiguration}
            errorMessage={structuredError}
            sheetNames={structuredSheet?.jobId === job.id ? structuredSheet.sheetNames : null}
            headerRow={structuredHeader?.jobId === job.id ? structuredHeader : null}
            onSelectSheet={handleSelectStructuredSheet}
            onSelectHeaderRow={handleSelectStructuredHeaderRow}
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
            outputOptions={structuredOutputOptions}
          />
        ) : currentStep === "review" && isBatch && job ? (
          <BatchReviewView
            job={job}
            sessions={batchSessions}
            activeIndex={batchActiveIndex}
            errorMessage={reviewError}
            readProgress={batchRead}
            retryContextAvailable={batchRetryContextAvailable}
            onSelectDocument={session.selectDocument}
            onDecide={session.decide}
            onAddManual={session.addManual}
            onRetryBatchItem={(index, options) =>
              // #78 correction F3: the rendered job supplies BOTH authorities
              // pinned at capture time — a captured action is refused when
              // either the job or its policy authority was replaced.
              session.retryBatchItem(job.id, job.policyId, index, options)
            }
            onRemoveBatchItem={(index) => session.removeBatchItem(job.id, job.policyId, index)}
            onAcknowledgeBatchItemError={(index) =>
              session.acknowledgeBatchItemError(job.id, job.policyId, index)
            }
          />
        ) : currentStep === "review" && review ? (
          <ReviewWorkspace
            session={review}
            onDecide={session.decide}
            onAddManual={session.addManual}
          />
        ) : currentStep === "review" && job && job.kind === "structured" ? (
          hasFreeTextColumns && structuredConfiguration !== null ? (
            <StructuredFreeTextReview
              configuration={structuredConfiguration}
              preparation={structuredPreparation}
              freeText={structuredFreeText}
              activeCell={structuredFreeTextActive}
              runError={
                freeTextRunError !== null && freeTextRunError.jobId === job.id
                  ? freeTextRunError.message
                  : null
              }
              onRun={runStructuredFreeText}
              onSelectFreeTextCell={session.selectFreeTextCell}
              onDecide={session.decide}
              onAddManual={session.addManual}
              onGoToStep={handleGoToStep}
            />
          ) : (
            // Issue #85: the empty/no-op structured Review screen no longer
            // exists. The only rendered Review surface for structured work is
            // the REAL free-text review above; this fallback is defensive
            // only (the internal configure → review → privacy-gate sequence
            // renders nothing at Review, and the quiet shell never offers the
            // step when no free-text cell exists), so a no-op state can never
            // become a rendered ceremonial screen.
            <StepUnavailableState step="review" reviewError={reviewError} />
          )
        ) : currentStep === "review" && job ? (
          <ReviewPendingState
            job={job}
            reviewError={reviewError}
            reviewStartInFlight={reviewStartInFlight}
          />
        ) : currentStep === "privacy-gate" &&
          job &&
          (activeReview !== null || isBatch || structuredGateInput !== null) ? (
          <PrivacyGate
            job={job}
            review={activeReview}
            batchSessions={batchSessions}
            structured={structuredGateInput}
          />
        ) : currentStep === "export" &&
          job &&
          (activeReview !== null || isBatch || structuredGateInput !== null) ? (
          <ExportStep
            job={job}
            review={activeReview}
            batchSessions={batchSessions}
            structured={structuredGateInput}
            structuredFreeText={structuredFreeText}
            onReturnToReview={() => void handleGoToStep("review")}
          />
        ) : (
          <StepUnavailableState step={currentStep} reviewError={reviewError} />
        )}

        {/*
         * Quiet shell (issue #84): the contextual next actions replace the
         * former universal five-step pipeline. Every action is enabled only
         * through the existing domain authorities (isStepAccessible/goToStep),
         * so the visible navigation can never widen or narrow the supported
         * states (PRODUCT_FIDELITY_GATES_V1 Gate 2).
         */}
        <TaskActionBar
          job={job}
          structuredNoFreeText={structuredNoFreeText}
          exportResultHasOwnReturn={isBatch || activeReview !== null}
          reviewActive={review !== null}
          singleResultRevisitAuthorized={singleResultRevisitAuthorized}
          reviewStartInFlight={reviewStartInFlight}
          onStartReview={handleStartReview}
          onProceedToPrivacyGate={handleStructuredConfigureToGate}
          structuredConfigurationExists={structuredConfiguration !== null}
          onGoToStep={handleGoToStep}
        />
      </main>

      {/*
       * Task-first hierarchy (UX-CLOSEOUT-01 outcome A; CORA-84-01): the active
       * workspace renders before the persistent policy guidance, and the
       * detailed four-policy documentation is on demand behind the disclosure
       * instead of four full policy cards permanently occupying the space below
       * every operational workspace (HPD-03; issue #84 acceptance E). The
       * current-policy line and the patient-ID qualification stay derived from
       * the same `buildPolicyGuidance` authorities and never vanish.
       */}
      <PolicyGuidance job={job} />
    </div>
  );
}

/**
 * Job-aware Privacy Policy guidance (issue #56, POLICY-01; #84 CORA-84-01/03).
 *
 * The workspace is discoverable BEFORE Review, in the existing shell. The
 * current-policy information (selected policy and its derived availability, or
 * the honest no-job note) stays PERMANENTLY visible; the detailed four-policy
 * documentation (all POLICY-01 entries, per-policy availability and the
 * patient-ID requirement) is on demand behind an expanded disclosure instead
 * of permanently occupying the space below every operational workspace
 * (HPD-03 quiet automation; issue #84 acceptance E: the guidance may be
 * contextual/on-demand, never vanished). Availability and the patient-ID
 * requirement remain DERIVED through `buildPolicyGuidance` from the same pure
 * authorities the engine uses; this component never hard-codes a second
 * operator mapping or availability table.
 *
 * The region is keyboard-focusable with the shared visible focus ring, the
 * disclosure is a real keyboard-operable button that exposes its state through
 * `aria-expanded`, and the availability state is always conveyed as text
 * (never by color alone).
 */
function PolicyGuidance({ job }: { job: Job | null }) {
  const [detailsExpanded, setDetailsExpanded] = useState(false);
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
          Política de privacidad
        </h2>
        <p className="mt-1 text-sm leading-relaxed text-neutral-700">
          Cada política asigna las categorías de información detectadas a transformaciones de
          privacidad. La disponibilidad depende del tipo de trabajo.
        </p>
        {job !== null && currentEntry ? (
          <p className="mt-2 text-sm text-neutral-800">
            <span className="font-semibold">Política actual:</span> {POLICY_LABELS[job.policyId]} —{" "}
            <span>
              {currentEntry.availability === "available"
                ? POLICY_AVAILABILITY_LABELS.available
                : POLICY_AVAILABILITY_LABELS.unavailable}
            </span>
          </p>
        ) : (
          <p className="mt-2 text-sm text-neutral-700">{NO_JOB_AVAILABILITY_NOTE}</p>
        )}
        {/* HPD-03 (CORA-84-01): the detailed documentation expands on demand
            rather than competing continuously with the clinical task. A real
            button keeps the disclosure keyboard operable, and `aria-expanded`
            conveys the state to assistive technology. */}
        <button
          type="button"
          aria-expanded={detailsExpanded}
          aria-controls="privacy-policy-guidance-details"
          onClick={() => setDetailsExpanded((expanded) => !expanded)}
          className={`mt-3 rounded border border-primary-dark px-3 py-1.5 text-sm font-semibold text-primary-dark hover:bg-surface-dark hover:text-white ${focusRing}`}
        >
          Guía detallada de políticas
        </button>
        {detailsExpanded && (
          <ul
            id="privacy-policy-guidance-details"
            aria-label="Guía de políticas de privacidad"
            className="mt-3 grid gap-3 sm:grid-cols-2"
          >
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
                    Requiere una columna explícita de identificador de paciente.
                  </p>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}

/**
 * Quiet-shell contextual task actions (issue #84, acceptance A/C/D/G).
 *
 * Replaces the universal visible five-step pipeline navigation: there is no
 * destination that exists merely to expose Input/Configure/Review/Privacy
 * Gate/Export internals. Each action is a real next task, and it is offered
 * ONLY when the existing domain authority (`isStepAccessible`, which reads
 * `visitedSteps`, the canonical order and the D-024/D-004 gates) already
 * allows the transition, so the visible shell can never widen or narrow the
 * supported states. All copy is professional Spanish and task-prominent.
 */
function TaskActionBar(props: {
  job: Job | null;
  /**
   * Issue #85: true exactly for a structured job with NO cell routed to
   * `process-as-text` — the case where the no-op Review stop must never
   * render and the «Continuar a la revisión» detour must never be offered.
   */
  structuredNoFreeText: boolean;
  /**
   * Whether the workspace rendered at the Export step already provides its own
   * in-workspace return control (the single-item and batch Results do; the
   * structured Result and the unavailable fallback do not). The shell only
   * supplies its own return action when this is false.
   */
  exportResultHasOwnReturn: boolean;
  /** Whether the single-item review session currently exists (T15 authority). */
  reviewActive: boolean;
  /**
   * Issue #84 correction (REC-05 journey A): whether the last legitimately
   * entered single-item Result belongs to the CURRENT Job/policy/ReviewSession
   * triple (browser-memory-only provenance, exact identity match). When true,
   * an already-visited Result whose mandatory decisions are pending again may
   * be offered as a revisit action even though `review.complete` is false —
   * the Result itself truthfully renders needs-attention and every download
   * stays governed by the canonical readiness authorities. Any real policy
   * change, replaced ReviewSession, new Job or A→B→A policy cycling fails the
   * identity match, so this can never resurrect a stale visit.
   */
  singleResultRevisitAuthorized: boolean;
  reviewStartInFlight: boolean;
  onStartReview: () => void;
  /**
   * Issue #85 §3.4: Configure → Privacy Gate for a structured job with no
   * free-text cells (performs the canonical internal transitions within one
   * intentional navigation; see `handleStructuredConfigureToGate`).
   */
  onProceedToPrivacyGate: () => void;
  /**
   * Issue #85 F1 (CORA-85-01 correction 2): true exactly when a resolved
   * structured configuration exists (sheet loaded AND header row confirmed).
   * Until then the Configure onward action must not be offered at all — the
   * Privacy Gate is not a reachable state and an impossible action is never
   * surfaced (the handler also guards defensively).
   */
  structuredConfigurationExists: boolean;
  onGoToStep: (step: FlowStep) => void;
}): ReactElement | null {
  const {
    job,
    structuredNoFreeText,
    exportResultHasOwnReturn,
    reviewActive,
    singleResultRevisitAuthorized,
    reviewStartInFlight,
    onStartReview,
    onProceedToPrivacyGate,
    structuredConfigurationExists,
    onGoToStep,
  } = props;
  if (job === null) return null;
  const step = job.currentStep;
  const primaryAction = `rounded bg-primary-dark px-4 py-2 text-sm font-semibold text-white hover:bg-primary disabled:cursor-not-allowed disabled:opacity-70 ${focusRing}`;
  const secondaryAction = `rounded border border-primary-dark px-4 py-2 text-sm font-semibold text-primary-dark hover:bg-surface-dark hover:text-white disabled:cursor-not-allowed disabled:opacity-70 ${focusRing}`;
  const actions: ReactElement[] = [];

  if (step === "review") {
    // The explicit review (re)start: offered only while no session exists and
    // no attempt is running (a failed or policy-invalidated attempt), and only
    // where the click performs a REAL start (issue #84 correction, acceptance
    // G): a document-batch's one attempt is owned by the reads-settle effect
    // and `handleGoToStep` deliberately skips the start branch for a batch, so
    // the button would be a no-op re-navigation; structured work never
    // auto-starts here either.
    if (
      job.kind !== "structured" &&
      job.kind !== "document-batch" &&
      !reviewActive &&
      !reviewStartInFlight &&
      job.processing !== "running" &&
      jobSupportsReview(job)
    ) {
      actions.push(
        <button key="start-review" type="button" onClick={onStartReview} className={primaryAction}>
          Iniciar revisión
        </button>
      );
    }
    // Issue #85: a structured job without free-text cells never renders the
    // no-op Review workspace. Should the flow position nevertheless be Review
    // (defensive only — the shell never offers the step), the canonical
    // backward transition to Configure keeps the operator unstranded.
    if (structuredNoFreeText && isStepAccessible(job, "configure")) {
      actions.push(
        <button
          key="back-to-configure"
          type="button"
          onClick={() => onGoToStep("configure")}
          className={secondaryAction}
        >
          Volver a la configuración
        </button>
      );
    }
    // D-024: for text/document the Result is directly reachable once the
    // export gate passes; for a batch the domain never allows review→export.
    // CORA-84-02: `isStepAccessible` also returns true for any already-visited
    // step (backward navigation), so after a REAL policy change invalidated the
    // current review, a historic `export` visit would still advertise a
    // «Ver resultado» action the current review does not authorize. The shell
    // therefore offers the action only while the CURRENT export authorization
    // holds (`review.complete`, the exact D-004 fact the domain's own export
    // gate reads) — plus the single bounded revisit exception below (issue #84
    // correction, journey A): when the retained provenance proves the operator
    // legitimately entered THIS Result under THIS exact Job/policy/
    // ReviewSession triple, revisiting it with mandatory decisions pending
    // again is offered — the Result then truthfully renders needs-attention
    // and stays a navigation action only (no output authorization). Any real
    // policy change, replaced session, new Job or A→B→A policy cycling fails
    // the identity match. No new ad-hoc enable rule beyond this navigation
    // exception, no second mapping (Gate 2). The batch distinction is
    // preserved untouched: accessing the batch Result is decoupled from
    // artifact authorization (REC-07 #87), so the batch action keeps the
    // plain `isStepAccessible` authority.
    const batchResultAccessDecoupled = job.kind === "document-batch";
    if (
      isStepAccessible(job, "export") &&
      (batchResultAccessDecoupled || job.review.complete || singleResultRevisitAuthorized)
    ) {
      actions.push(
        <button
          key="result"
          type="button"
          onClick={() => onGoToStep("export")}
          className={primaryAction}
        >
          Ver resultado
        </button>
      );
    }
    // The Privacy Gate stays an optional, visitable destination from Review
    // for EVERY kind — including a structured job whose export gate is still
    // closed (the gate reports the factual blockers; G-HP2: never hidden,
    // deleted or disabled — D-023/D-024). "Privacy Gate" is the accepted
    // product term, deliberately untranslated:
    // docs/specs/SPEC_V4_APP_AND_REVIEW.md §2/§6 establish it as the step's
    // name, and every gate surface (headings, guidance, tests) uses it.
    if (isStepAccessible(job, "privacy-gate")) {
      actions.push(
        <button
          key="gate"
          type="button"
          onClick={() => onGoToStep("privacy-gate")}
          className={secondaryAction}
        >
          Privacy Gate
        </button>
      );
    }
  }

  if (step === "privacy-gate") {
    // Forward: the Result affordance stays VISIBLE and fail-closed — disabled
    // exactly when the domain's export gate does not pass (D-004 for
    // text/document/structured; the batch Result is decoupled from artifact
    // authorization per REC-07 #87). The old pipeline always showed the
    // destination; the quiet shell keeps this one because its disabled state
    // is the factual "what is still missing" signal at the gate.
    actions.push(
      <button
        key="result"
        type="button"
        onClick={() => onGoToStep("export")}
        disabled={
          !isStepAccessible(job, "export") ||
          ((job.kind === "text" || job.kind === "document") &&
            !job.review.complete &&
            !singleResultRevisitAuthorized) ||
          // Issue #85 §3.6: a structured Result becomes stale when a later
          // readiness invalidation re-blocks the preparation. For structured
          // jobs `withDerivedStructuredState` (useJobSession.ts) derives
          // `review.complete` from `preparation.status === "ready"`, so it IS
          // the current structured output gate — no second readiness source is
          // consulted here. Historical Result visits never authorize a stale
          // one (no structured provenance exception exists).
          (job.kind === "structured" && !job.review.complete)
        }
        className={primaryAction}
      >
        Ir al resultado
      </button>
    );
    if (structuredNoFreeText) {
      // Issue #85 §3.4: from the Privacy Gate, `Volver` returns to meaningful
      // Configure — never the no-op Review (configure is an already-visited
      // step: canonical backward navigation, no new enable rule).
      if (isStepAccessible(job, "configure")) {
        actions.push(
          <button
            key="back-to-configure"
            type="button"
            onClick={() => onGoToStep("configure")}
            className={secondaryAction}
          >
            Volver a la configuración
          </button>
        );
      }
    } else if (job.visitedSteps.includes("review")) {
      actions.push(
        <button
          key="back-to-review"
          type="button"
          onClick={() => onGoToStep("review")}
          className={secondaryAction}
        >
          Volver a la revisión
        </button>
      );
    }
  }

  if (step === "export") {
    // The optional Privacy Gate stays reachable from the Result (the former
    // pipeline allowed the gate round-trip; G-HP2: never hidden or deleted).
    // "Privacy Gate" is the accepted product term, deliberately untranslated:
    // docs/specs/SPEC_V4_APP_AND_REVIEW.md §2/§6 establish it as the step's
    // name, and every gate surface (headings, guidance, tests) uses it.
    if (isStepAccessible(job, "privacy-gate")) {
      actions.push(
        <button
          key="gate"
          type="button"
          onClick={() => onGoToStep("privacy-gate")}
          className={secondaryAction}
        >
          Privacy Gate
        </button>
      );
    }
    // The truthful way back to Review (issue #84 correction, spec §5): the
    // single-item and batch Results render their own in-workspace return
    // control; the structured Result and an UNMOUNTED workspace (e.g. a real
    // policy change invalidated the review-dependent authorization from the
    // Result) do not, so the shell supplies the return action there — gated by
    // the domain's backward-navigation authority (`isStepAccessible`, which
    // reads `visitedSteps`), never a new ad-hoc enable rule (Gate 2). Without
    // it a real policy change from the Result strands the operator with only
    // destructive session controls and no visible recovery path.
    if (
      !exportResultHasOwnReturn &&
      isStepAccessible(job, structuredNoFreeText ? "configure" : "review")
    ) {
      // Issue #85 §3.4: for structured work WITHOUT free-text cells the
      // truthful way back from the Result is meaningful Configure (the no-op
      // Review must never render); with free-text cells the real review is
      // still the return destination. Both targets are canonical backward
      // transitions gated by `isStepAccessible` (which reads `visitedSteps`),
      // never a new ad-hoc enable rule (Gate 2).
      const backTarget = structuredNoFreeText ? "configure" : "review";
      actions.push(
        <button
          key="back"
          type="button"
          onClick={() => onGoToStep(backTarget)}
          className={secondaryAction}
        >
          {structuredNoFreeText ? "Volver a la configuración" : "Volver a la revisión"}
        </button>
      );
    }
  }

  if (
    step === "configure" &&
    job.kind === "structured" &&
    structuredConfigurationExists &&
    isStepAccessible(job, "review")
  ) {
    if (structuredNoFreeText) {
      // Issue #85 §3.4: with NO cell routed to `process-as-text` there is no
      // «Continuar a la revisión» detour and no rendered no-op Review. The
      // onward destination is the factual privacy check; the handler performs
      // the canonical internal configure → review → privacy-gate transitions
      // within ONE intentional navigation. The offer authority is the same
      // `isStepAccessible(job, "review")` the former review action used.
      actions.push(
        <button key="gate" type="button" onClick={onProceedToPrivacyGate} className={primaryAction}>
          Privacy Gate
        </button>
      );
    } else {
      // Free-text cells exist: Review is the REAL next task (the existing
      // `StructuredFreeTextReview`, unchanged).
      actions.push(
        <button
          key="to-review"
          type="button"
          onClick={() => onGoToStep("review")}
          className={primaryAction}
        >
          Continuar a la revisión
        </button>
      );
    }
  }

  if (actions.length === 0) return null;
  return (
    <div
      aria-label="Siguientes acciones"
      className="mt-8 flex flex-wrap items-center gap-2 border-t border-primary/30 pt-4"
    >
      {actions}
    </div>
  );
}

/**
 * Factual pending-review state for a text/document Job that is positioned at
 * Review without a review session: while the one local processing attempt is
 * running, after a typed failure, or after a REAL policy change invalidated
 * the previous session (issue #84 acceptance B: pending work, local
 * processing error and the next action are factual and visible; the engine is
 * never silently re-run — the explicit restart is offered by the task bar).
 */
function ReviewPendingState(props: {
  job: Job;
  reviewError: string | null;
  reviewStartInFlight: boolean;
}): ReactElement {
  const { job, reviewError, reviewStartInFlight } = props;
  const processing = job.processing;
  return (
    <section aria-labelledby="review-step-heading">
      <h2
        id="review-step-heading"
        className="font-display text-3xl font-bold tracking-tight text-primary-dark"
      >
        Revisión
      </h2>
      {processing === "running" || reviewStartInFlight ? (
        <p
          role="status"
          className="mt-3 max-w-2xl rounded border border-primary bg-surface-light px-3 py-2 text-sm font-semibold text-neutral-800"
        >
          Procesando el contenido localmente en este navegador…
        </p>
      ) : processing === "failed" || processing === "unknown" ? (
        <>
          {reviewError !== null && (
            <p
              role="alert"
              className="mt-3 max-w-2xl rounded border border-primary-dark bg-surface-light px-3 py-2 text-sm font-semibold text-primary-dark"
            >
              {reviewError}
            </p>
          )}
          <p
            role="status"
            className="mt-3 max-w-2xl rounded border border-primary bg-surface-light px-3 py-2 text-sm font-semibold text-neutral-800"
          >
            El procesamiento local no se pudo completar. Puede iniciarlo de nuevo.
          </p>
        </>
      ) : (
        <p
          role="status"
          className="mt-3 max-w-2xl rounded border border-primary bg-surface-light px-3 py-2 text-sm font-semibold text-neutral-800"
        >
          La revisión local todavía no se ha ejecutado para este trabajo bajo la política actual.
          Iníciela cuando esté listo.
        </p>
      )}
    </section>
  );
}

/**
 * Display-only family chip for one selected file (UX-PILOT-01 #52). It reuses
 * the SAME extension authorities as intake so the label cannot drift from the
 * routing rules, but it is purely informational: `handleCreateFromDraft` and
 * the domain remain the only intake authority. An unrecognized extension is
 * shown as "No admitido" and still fails closed on create. REC-08: the chips
 * are Spanish-first like the rest of the touched start surface.
 */
function selectedFileFamilyLabel(fileName: string): string {
  const extension = extensionOf(fileName);
  if (isDocumentExtension(extension)) return "Documento";
  if (isStructuredExtension(extension)) return "Estructurado";
  return "No admitido";
}

/**
 * REC-08 start-surface intended-use wording (D-020, HPD-11).
 *
 * Spanish human-purpose presentation of the accepted Privacy Policies. This
 * is presentation ONLY: policy IDs, order and availability derive from the
 * single `policy-guidance.ts` seam (`POLICY_IDS` via `buildPolicyGuidance`
 * and the same engine authorities); no second policy table, no semantic or
 * availability change, and none of the forbidden claims (anonymity, GDPR/
 * compliance or research approval guarantees). Exhaustive app-wide
 * localization remains REC-10; only this touched start surface is Spanish.
 */
const POLICY_PURPOSE_ES: Readonly<Record<PrivacyPolicyId, { name: string; purpose: string }>> = {
  standard: {
    name: "Estándar",
    purpose:
      "Uso general: prepara la información para compartirla protegiendo nombres, identificadores directos, fechas, lugares y edades.",
  },
  "external-ai": {
    name: "IA externa",
    purpose:
      "Preparación local para usar el resultado con una IA externa: reduce la precisión de las fechas. Nada sale de este dispositivo.",
  },
  "longitudinal-research": {
    name: "Investigación longitudinal",
    purpose:
      "Preparación local para el seguimiento en el tiempo: desplaza las fechas de forma coherente. No concede aprobación de investigación.",
  },
  strict: {
    name: "Estricta",
    purpose:
      "Protección reforzada: como el uso general, con generalización más estricta de lugares y cuasi-identificadores.",
  },
};

function IntendedUseGuidance({ jobKind }: { jobKind: JobKind | null }) {
  const entries = buildPolicyGuidance(jobKind);
  return (
    <section
      aria-labelledby="intended-use-heading"
      className="mt-5 rounded-xl border border-primary/30 bg-surface-light p-4"
    >
      <h3
        id="intended-use-heading"
        className="text-sm font-bold uppercase tracking-wide text-neutral-800"
      >
        Uso previsto
      </h3>
      <p className="mt-1 text-sm leading-relaxed text-neutral-700">
        El resultado se prepara según el uso que vaya a darle. La disponibilidad exacta depende del
        tipo de información y se confirma al crear el trabajo.
      </p>
      <ul
        aria-label="Usos previstos"
        className="mt-3 grid gap-2 text-sm text-neutral-700 sm:grid-cols-2"
      >
        {POLICY_IDS.map((policyId) => {
          const entry = entries.find((candidate) => candidate.policyId === policyId);
          const copy = POLICY_PURPOSE_ES[policyId];
          return (
            <li key={policyId}>
              <span className="font-semibold text-neutral-800">{copy.name}</span>
              {entry && entry.availability !== "unknown" && (
                <span className="ml-2 rounded-full bg-primary/10 px-2 py-0.5 text-xs font-semibold tracking-wide text-neutral-700">
                  {entry.availability === "available"
                    ? "Disponible"
                    : "No disponible para este tipo de trabajo"}
                </span>
              )}
              <span className="block">{copy.purpose}</span>
            </li>
          );
        })}
      </ul>
    </section>
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
  onFilesDropped: (files: File[]) => void;
  onCreate: () => void;
}) {
  // Failed batch reads are surfaced HERE, as soon as each item outcome is
  // recorded: a failed document is never hidden (BATCH-001, D-011).
  const failedItems =
    props.batchJob && props.batchJob.kind === "document-batch"
      ? batchFailedItems(props.batchJob)
      : [];
  const selectedCount = props.draftFiles.length;
  const [pasteError, setPasteError] = useState<string | null>(null);
  const [pasteBusy, setPasteBusy] = useState(false);
  const [isDragging, setIsDragging] = useState(false);

  /**
   * CORA-80-01 draft-authority guard. A pending clipboard read may fill the
   * draft only while the draft still holds the same user authority it had when
   * the read started. `draftRevisionRef` counts every user-driven draft write
   * (typing, example selection) and `draftTextRef` tracks the live draft text,
   * so an out-of-band replacement (e.g. a draft reset after job creation) also
   * revokes an in-flight read. Comparing text alone is not enough: a
   * type-then-undo would re-match a stale snapshot and allow an old read to
   * overwrite the user's newer draft.
   */
  const draftRevisionRef = useRef(0);
  const draftTextRef = useRef(props.draftText);
  draftTextRef.current = props.draftText;
  const draftFilesRef = useRef(props.draftFiles);
  draftFilesRef.current = props.draftFiles;

  const commitDraftText = (text: string) => {
    draftRevisionRef.current += 1;
    props.onDraftTextChange(text);
  };

  /**
   * REC-08 example action: loads the synthetic `texto` into the ordinary
   * pasted-text draft. It creates NO job; creation still goes only through
   * `onCreate` (`handleCreateFromDraft`).
   */
  const handleExample = (text: string) => {
    commitDraftText(text);
    setPasteError(null);
  };

  /**
   * REC-08 Pegar convenience: browser-local clipboard read into the same
   * pasted-text draft. Denial / unavailable clipboard is a visible Spanish
   * failure naming the Ctrl+V fallback; no network request, no storage
   * write, no raw exception leak, no Job creation.
   *
   * CORA-80-01: a late resolution never overwrites a newer draft. The read
   * captures the draft authority at start and re-checks it after the await;
   * any user edit in between (typing, example or other draft replacement)
   * revokes this response's ability to write, so the newer draft survives and
   * still no Job is created.
   */
  const handlePaste = async () => {
    if (props.isExtracting || pasteBusy) return;
    const authorityRevision = draftRevisionRef.current;
    const authorityText = draftTextRef.current;
    const authorityFiles = draftFilesRef.current;
    setPasteBusy(true);
    try {
      const text = await readTextFromClipboard();
      const draftStillHoldsCallerAuthority =
        draftRevisionRef.current === authorityRevision &&
        draftTextRef.current === authorityText &&
        draftFilesRef.current === authorityFiles;
      if (!draftStillHoldsCallerAuthority) return;
      commitDraftText(text);
      setPasteError(null);
    } catch {
      setPasteError(
        "No se pudo leer el portapapeles en este navegador. Pegue con Ctrl+V directamente en el campo de texto."
      );
    } finally {
      setPasteBusy(false);
    }
  };
  return (
    <section aria-labelledby="input-step-heading">
      <header className="max-w-3xl">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-neutral-600">
          Añadir información
        </p>
        <h2
          id="input-step-heading"
          className="mt-1 font-display text-3xl font-bold tracking-tight text-primary-dark"
        >
          Nuevo trabajo de privacidad
        </h2>
        <p className="mt-2 text-base leading-relaxed text-neutral-700">
          Añada información clínica pegando texto o seleccionando archivos. El resto del proceso se
          organiza a partir de su entrada.
        </p>
      </header>

      <p className="mt-4 max-w-3xl text-sm leading-relaxed text-neutral-600">
        Use una sola entrada por trabajo: texto pegado o archivos, no ambos.
      </p>

      <div className="mt-6 grid gap-5 lg:grid-cols-2">
        <section
          aria-labelledby="paste-text-heading"
          className="flex flex-col rounded-xl border border-primary/40 bg-white p-5 shadow-sm"
        >
          <h3 id="paste-text-heading" className="font-display text-lg font-bold text-neutral-800">
            Pegar texto clínico
          </h3>
          <p className="mt-1 text-sm leading-relaxed text-neutral-600">
            Texto libre, como notas, informes o correspondencia.
          </p>
          <section aria-labelledby="synthetic-examples-heading" className="mt-4">
            <h4 id="synthetic-examples-heading" className="text-sm font-bold text-neutral-800">
              Ejemplos sintéticos
            </h4>
            <p className="mt-1 text-sm leading-relaxed text-neutral-600">
              Casos sintéticos sin datos reales. Elegir un ejemplo solo rellena el borrador; no crea
              ningún trabajo.
            </p>
            <ul aria-labelledby="synthetic-examples-heading" className="mt-2 flex flex-wrap gap-2">
              {SYNTHETIC_EXAMPLES.map((example) => (
                <li key={example.id}>
                  <button
                    type="button"
                    onClick={() => handleExample(example.text)}
                    title={example.description}
                    className={`rounded-lg border border-primary bg-surface-light px-3 py-1.5 text-sm font-semibold text-primary-dark hover:bg-surface-dark hover:text-white ${focusRing}`}
                  >
                    {example.label}
                  </button>
                </li>
              ))}
            </ul>
          </section>
          <div className="mt-4">
            <button
              type="button"
              onClick={() => {
                void handlePaste();
              }}
              disabled={props.isExtracting || pasteBusy}
              aria-busy={props.isExtracting || pasteBusy}
              className={`rounded-lg border border-primary-dark bg-white px-4 py-2 text-sm font-semibold text-primary-dark hover:bg-surface-light disabled:cursor-wait disabled:opacity-70 ${focusRing}`}
            >
              Pegar desde el portapapeles
            </button>
            <p className="mt-1 text-sm leading-relaxed text-neutral-600">
              Lee el contenido actual del portapapeles en este navegador. También puede usar Ctrl+V
              directamente en el campo de texto.
            </p>
            {pasteError && (
              <p
                role="alert"
                className="mt-2 rounded border border-primary-dark bg-surface-light px-3 py-2 text-sm font-semibold text-primary-dark"
              >
                {pasteError}
              </p>
            )}
          </div>
          <label htmlFor="paste-text" className="mt-4 block text-sm font-semibold text-neutral-800">
            Pegar texto
          </label>
          <textarea
            id="paste-text"
            value={props.draftText}
            onChange={(event) => commitDraftText(event.target.value)}
            rows={7}
            className={`mt-1 w-full rounded-lg border border-primary bg-surface-light px-3 py-2 text-sm ${focusRing}`}
          />
        </section>

        <section
          aria-labelledby="select-files-heading"
          onDragOver={(event) => {
            event.preventDefault();
            setIsDragging(true);
          }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={(event) => {
            event.preventDefault();
            setIsDragging(false);
            // REC-08: drag/drop converges on the same draft-files staging as
            // file selection — no second classifier, no silent loss/reorder.
            // CORA-80-02: a drop carrying ZERO files (e.g. dropped text or a
            // non-file payload) is not a file selection and must not replace,
            // clear or reorder an existing staged selection. Only real
            // non-empty drops reach the canonical staging path.
            const droppedFiles = Array.from(event.dataTransfer.files);
            if (droppedFiles.length === 0) return;
            props.onFilesDropped(droppedFiles);
          }}
          className={`flex flex-col rounded-xl border bg-white p-5 shadow-sm ${
            isDragging ? "border-2 border-primary-dark" : "border-primary/40"
          }`}
        >
          <h3 id="select-files-heading" className="font-display text-lg font-bold text-neutral-800">
            Elegir archivos
          </h3>
          <p className="mt-1 text-sm leading-relaxed text-neutral-600">
            Documentos (TXT, PDF, DOCX) o tablas estructuradas (CSV, XLS, XLSX).
          </p>
          <p className="mt-1 text-sm leading-relaxed text-neutral-600">
            Arrastre y suelte archivos aquí o use el selector. Arrastrar y seleccionar siguen el
            mismo proceso.
          </p>
          <label
            htmlFor="select-files"
            className="mt-4 block text-sm font-semibold text-neutral-800"
          >
            Seleccionar archivos (TXT, PDF, DOCX, CSV, XLS, XLSX)
          </label>
          <input
            id="select-files"
            type="file"
            multiple
            accept={SUPPORTED_EXTENSIONS.join(",")}
            onChange={props.onFileSelection}
            className={`mt-1 block w-full text-sm ${focusRing}`}
          />
          {isDragging && (
            <p
              role="status"
              className="mt-2 rounded border border-primary-dark bg-surface-light px-3 py-2 text-sm font-semibold text-primary-dark"
            >
              Suelte los archivos para añadirlos al borrador.
            </p>
          )}
          {selectedCount > 0 && (
            <div className="mt-3 rounded-lg border border-primary/40 bg-surface-light p-3">
              <p className="text-sm font-semibold text-neutral-800">
                {selectedCount === 1
                  ? "1 archivo seleccionado"
                  : `${selectedCount} archivos seleccionados`}
              </p>
              <ul aria-label="Archivos seleccionados" className="mt-2 space-y-1.5">
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

      <div className="mt-5 max-w-3xl space-y-4">
        {props.batchRead && (
          <p
            role="status"
            className="rounded border border-primary bg-white px-3 py-2 text-sm font-semibold text-neutral-800"
          >
            Leyendo documentos… {props.batchRead.done} de {props.batchRead.total} leídos.
          </p>
        )}
        {failedItems.length > 0 && (
          <section
            aria-labelledby="batch-read-failures-heading"
            className="rounded border border-primary-dark bg-surface-light px-3 py-2"
          >
            <h3 id="batch-read-failures-heading" className="text-sm font-bold text-primary-dark">
              Documentos que no se pudieron leer
            </h3>
            <ul
              aria-label="Documentos con error"
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
          Crear trabajo
        </button>
      </div>

      <IntendedUseGuidance jobKind={props.batchJob ? props.batchJob.kind : null} />
    </section>
  );
}

/**
 * Defensive fallback for a step that has no renderable job state (for example
 * Privacy Gate or Export reached before an active review exists, or the
 * structured Review position that issue #85 no longer renders as a no-op
 * screen). It states the runtime fact only: no migration-placeholder copy
 * (UX-CLOSEOUT-01 outcome B).
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
        Este paso no está disponible para el estado actual del trabajo. Vuelva a un paso disponible
        con las acciones de tarea o los controles de sesión de arriba.
      </p>
    </section>
  );
}
