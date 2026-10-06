/**
 * Export step (Work Order T08 U4; SPEC_V4_APP_AND_REVIEW.md §7, D-005).
 *
 * REC-05 WU-B (D-024) — single-item Result. For a `text` (pasted) or single
 * `document` Job the ordinary human ending is a **Resultado**: readiness
 * (`ready` / `needs attention` / `blocked`) plus the prepared/shareable action,
 * all derived from the existing review/Job authorities. Copy, Safe TXT, Safe
 * DOCX and Safe PDF are four representations of ONE canonical Safe payload
 * (`getFinalText` via the reviewed output service); no representation re-runs a
 * privacy transformation or adds correspondence/reviewer notes/audit metadata.
 * The Confidential Audit stays a separate, deliberately sensitive zone. REC-05
 * WU-C adds the deliberate confirmation for the single-item slice: the first
 * action reveals a Spanish identifiable/reversible-data warning and downloads
 * nothing; explicit Confirm downloads exactly once; Cancel downloads nothing;
 * the pending confirmation cannot cross a Job, a review mutation or a newly
 * unavailable audit state, and Confirm revalidates the current Job + review
 * authority immediately before download (H-42 single text/document slice,
 * D-024).
 *
 * The structured branch is byte-unchanged in behavior:
 *   - Structured (REC-04 WU-C/D-022): Safe CSV/XLSX + Confidential TXT/XLSX.
 * The document-batch branch is the batch Result (REC-07 #87, `BatchResult`
 * below): readiness plus the Safe summary CSV, derived from the existing
 * batch authorities. Result visibility is decoupled from artifact
 * authorization; the batch Confidential Audit stays unavailable (#89).
 *
 * Both Safe and Confidential downloads are client-side only (Blob + object URL
 * + anchor click; the object URL is revoked afterwards): no network, no
 * persistence (D-013). Status is always conveyed as text, never by color alone;
 * every control is a keyboard-operable button with visible focus.
 *
 * Async/current-authority safety (D-024 §4.6): DOCX/PDF generation is
 * asynchronous. The requested Job id, ReviewSession identity and canonical
 * `safeText` are captured before the awaited step and revalidated after the
 * last await and immediately before bytes/download. Any stale mismatch produces
 * zero download and a visible non-PHI failure, never a false success.
 *
 * Single review authority (D-004): no pending/final-text logic is
 * re-implemented here; the Result state and payload come from the existing
 * authorities through `singleResultModel`. No anonymity, compliance or
 * certification wording anywhere (D-006).
 */
import type { ReactElement } from "react";
import { useEffect, useRef, useState } from "react";

import { type ReviewSession } from "../review/review-domain";
import type { Job } from "../domain/job";
import {
  serializeConfidentialAudit,
  CONFIDENTIAL_AUDIT_WARNING_LINE,
} from "../output/confidential-audit-serializer";
import { buildConfidentialAudit } from "../output/confidential-audit";
import { copyTextToClipboard, ClipboardError } from "../output/clipboard";
import { DocxBuildError, SAFE_DOCX_FILENAME, buildSafeDocxBytes } from "../output/docx-builder";
import {
  PdfRepresentationError,
  SAFE_PDF_FILENAME,
  buildSafePdfBytes,
} from "../output/pdf-builder";
import { serializeStructuredSafeCsv } from "../structured/csv-writer";
import { serializeStructuredConfidentialAudit } from "../structured/structured-confidential-audit";
import {
  buildConfidentialXlsxBytes,
  buildSafeXlsxBytes,
  CONFIDENTIAL_STRUCTURED_XLSX_FILE_NAME,
  SAFE_STRUCTURED_XLSX_FILE_NAME,
} from "../structured/xlsx-export";
import { loadXlsx } from "../structured/xlsx-loader";
import {
  deriveStructuredSummary,
  type StructuredOutputPreparation,
} from "../structured/transformed-dataset";
import type { StructuredConfiguration } from "../structured/configuration";
import type { StructuredTransformPlan } from "../structured/transform-plan";
import { batchConfidentialAuditUnavailableMessage } from "../privacy-gate/privacyGateModel";
import {
  BATCH_SUMMARY_CSV_FILENAME,
  BatchSummaryError,
  deriveBatchResultView,
  serializeBatchSummaryCsv,
} from "./batchResultModel";
import { deriveSingleResultView, type SingleResultMaterial } from "./singleResultModel";

const focusRing =
  "focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2";

/** D-024 single-item Safe TXT filename. */
const SAFE_TXT_FILE_NAME = "texto-preparado.txt";
/** REC-05 WU-C D-024 single-item Confidential Audit TXT filename (Spanish). */
const CONFIDENTIAL_AUDIT_FILE_NAME = "auditoria-confidencial.txt";
const SAFE_STRUCTURED_FILE_NAME = "safe-structured-output.csv";
const CONFIDENTIAL_STRUCTURED_FILE_NAME = "structured-confidential-audit.txt";

const DOCX_MIME = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
const PDF_MIME = "application/pdf";

/** Shared presentation atoms for the two unmistakably separate artifact zones. */
const zoneCard = "mt-6 rounded-xl border border-primary/40 bg-white shadow-sm";
const zoneBadge =
  "rounded-full px-2.5 py-0.5 text-xs font-semibold uppercase tracking-wide text-white";
const zoneHeading = "font-display text-lg font-bold text-neutral-800";
const zoneBody = "max-w-2xl text-sm leading-relaxed text-neutral-700";
const blockedNote =
  "mt-3 rounded border border-primary-dark bg-surface-light px-3 py-2 text-sm font-semibold text-neutral-800";
const primaryButton = `mt-3 rounded bg-primary-dark px-4 py-2 text-sm font-semibold text-white hover:bg-primary disabled:cursor-not-allowed disabled:opacity-70 ${focusRing}`;
const secondaryButton = `mt-3 rounded border border-primary-dark px-4 py-2 text-sm font-semibold text-neutral-800 hover:bg-primary-dark hover:text-white disabled:cursor-not-allowed disabled:opacity-70 ${focusRing}`;

/**
 * Client-side, network-free download of a UTF-8 text artifact. Extracted
 * so tests can stub URL.createObjectURL / URL.revokeObjectURL and the
 * anchor click without any network involvement (D-013: memory-only).
 */
export function downloadTextFile(fileName: string, content: string): void {
  const blob = new Blob([content], { type: "text/plain;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = fileName;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

/**
 * Client-side, network-free download of a binary artifact (REC-05 WU-B Safe
 * DOCX/PDF). Same seam as {@link downloadTextFile} (Blob + object URL + anchor
 * click, revoked afterwards): no network, no persistence (D-013: memory-only).
 * Deliberately a separate helper: the text helper's `text/plain;charset=utf-8`
 * contract is relied upon elsewhere and is never generalized.
 */
export function downloadBinaryFile(fileName: string, bytes: Uint8Array, mimeType: string): void {
  const copy = new Uint8Array(bytes);
  const blob = new Blob([copy.buffer as ArrayBuffer], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = fileName;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

/**
 * Client-side, network-free download of a binary XLSX artifact. Same seam
 * as {@link downloadTextFile} (Blob + object URL + anchor click, revoked
 * afterwards): no network, no persistence (D-013: memory-only).
 */
export function downloadXlsxFile(fileName: string, bytes: Uint8Array): void {
  const copy = new Uint8Array(bytes);
  const blob = new Blob([copy.buffer as ArrayBuffer], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = fileName;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

export type ExportStepProps = {
  /** The frozen domain job (carries the derived output availability). */
  readonly job: Job;
  /**
   * The frozen ReviewSession; the single review authority (D-004). For a
   * document-batch job this is the active item's session or `null`; the batch
   * reason is derived from the Job (T17 #21 SD-7), never from bare presence.
   */
  readonly review: ReviewSession | null;
  /**
   * The reviewed structured configuration + exact preparation for a structured
   * job (HARDEN-01 WU-A). Required for `kind === "structured"`; ignored else.
   */
  readonly structured?: {
    readonly configuration: StructuredConfiguration;
    readonly plan: StructuredTransformPlan;
    readonly preparation: StructuredOutputPreparation;
  } | null;
  /**
   * REC-05 WU-B: the return/correction path from the single-item Result back to
   * the unresolved Review work, without rebuilding the Job. Optional so pure
   * render oracles can exercise the surface without the shell.
   */
  readonly onReturnToReview?: (() => void) | undefined;
};

/**
 * Structured export surface (HARDEN-01 WU-A3; REC-04 WU-C D-022): the Safe
 * Structured CSV + XLSX and the SEPARATE Confidential TXT + XLSX, produced
 * from the SAME reviewed preparation the bridge already computed. Never
 * combined. Fail-closed with the exact block reasons; every control is a
 * keyboard-operable button.
 *
 * REC-04 WU-C confirmation (H-42 structured slice): every structured
 * Confidential download format (TXT and XLSX) shares ONE reusable
 * deliberate confirmation inside the Confidential zone. The first click
 * only reveals the confirmation and downloads nothing; explicit Confirm
 * performs that one download, Cancel performs none. The confirmation is
 * transient interaction safety only — never output readiness authority —
 * so it resets after confirm/cancel and cannot survive another Job, a
 * newly blocked/stale preparation, or disabled Confidential readiness.
 * Safe downloads never require it and download directly when ready.
 */
type StructuredConfidentialFormat = "txt" | "xlsx";

function StructuredExport({
  job,
  structured,
}: {
  job: Job;
  structured: NonNullable<ExportStepProps["structured"]> | null;
}): ReactElement {
  const preparation = structured === null ? null : structured.preparation;
  const blocked =
    preparation === null || preparation.status !== "ready" || !job.outputs.safeOutputReady;
  const reasons = preparation === null ? [] : preparation.reasons;
  // Fail-closed, per artifact: the Confidential Audit additionally honors its
  // OWN readiness flag (same authority as the document path below).
  const confidentialBlocked = blocked || !job.outputs.confidentialAuditReady;
  const sharedReasonVisible = blocked && reasons.length > 0;
  const confidentialReasonVisible =
    confidentialBlocked && !sharedReasonVisible && !job.outputs.confidentialAuditReady;
  const confidentialDescribedBy = !confidentialBlocked
    ? undefined
    : sharedReasonVisible
      ? "safe-structured-blocked-reason"
      : confidentialReasonVisible
        ? "structured-confidential-blocked-reason"
        : undefined;

  const [pendingConfirmation, setPendingConfirmation] =
    useState<StructuredConfidentialFormat | null>(null);
  const [xlsxError, setXlsxError] = useState<{
    readonly zone: "safe" | "confidential";
    readonly message: string;
  } | null>(null);

  // Unmount disposal (REC-07 prefactor #79; same accepted pattern as the
  // single-result Result's `disposedRef`, handoff §4.6 / D-024): the
  // snapshot below stays SELF-CONSISTENT after this Structured surface is
  // removed, so the current-authority guards alone would still pass for an
  // awaited operation that completes after unmount. This ONE shared flag is
  // the disposal authority for the whole surface (both XLSX paths and the
  // Confidential TXT check reuse the same guards). Reusable pattern for
  // later REC-07 async outputs: capture the current-authority snapshot
  // before the await, then revalidate BOTH this flag and the snapshot
  // immediately before any bytes are produced or any download begins —
  // completion after disposal produces ZERO download and zero false
  // success.
  const disposedRef = useRef(false);
  useEffect(() => {
    disposedRef.current = false;
    return () => {
      disposedRef.current = true;
    };
  }, []);

  // The CURRENT authorization snapshot (REC-04 SPEC-1; extended by
  // CORA-AUDIT-REC04-01 to the Safe XLSX async path). A download is only
  // ever requested against one frozen Job + preparation; the actual download
  // must re-check that the SAME Job is still current and that its
  // preparation is still ready — even after an `await` (XLSX generation).
  // This ref always carries the latest render's values, so a state change
  // during an async generation window is observable at the moment of
  // download.
  const confirmationAuthorityRef = useRef<{
    readonly jobId: string;
    readonly preparation: StructuredOutputPreparation | null;
    readonly safeBlocked: boolean;
    readonly confidentialBlocked: boolean;
  }>({ jobId: job.id, preparation, safeBlocked: blocked, confidentialBlocked });
  confirmationAuthorityRef.current = {
    jobId: job.id,
    preparation,
    safeBlocked: blocked,
    confidentialBlocked,
  };

  // Just-in-time guard: true only while the download requested against
  // `requestedJobId` + `requestedPreparation` is still authorized. Used at
  // the exact moment bytes would be produced, after any await.
  const isConfirmationCurrent = (
    requestedJobId: string,
    requestedPreparation: StructuredOutputPreparation
  ): boolean => {
    if (disposedRef.current) {
      return false; // disposed: completion after unmount downloads nothing
    }
    const current = confirmationAuthorityRef.current;
    return (
      !current.confidentialBlocked &&
      current.jobId === requestedJobId &&
      current.preparation !== null &&
      current.preparation === requestedPreparation &&
      current.preparation.status === "ready"
    );
  };

  // The Safe counterpart of the guard above (CORA-AUDIT-REC04-01): true only
  // while the same Job + preparation are still current, that preparation is
  // still ready, and Safe output is still not blocked. Safe is a direct
  // download (no confirmation), so this is the only post-await authority
  // check on its XLSX path.
  const isSafeCurrent = (
    requestedJobId: string,
    requestedPreparation: StructuredOutputPreparation
  ): boolean => {
    if (disposedRef.current) {
      return false; // disposed: completion after unmount downloads nothing
    }
    const current = confirmationAuthorityRef.current;
    return (
      !current.safeBlocked &&
      current.jobId === requestedJobId &&
      current.preparation !== null &&
      current.preparation === requestedPreparation &&
      current.preparation.status === "ready"
    );
  };

  // The confirmation grants no readiness and never outlives the Job or the
  // preparation it was requested against: any new Job or preparation (in
  // particular a newly blocked/stale one) clears it. The domain inputs are
  // frozen, so a changed status/readiness always arrives as a new reference.
  useEffect(() => {
    setPendingConfirmation(null);
    setXlsxError(null);
  }, [job, preparation]);
  // Defense in depth: a disabled Confidential readiness clears a pending
  // confirmation even if the references above were somehow reused.
  useEffect(() => {
    if (confidentialBlocked) {
      setPendingConfirmation(null);
    }
  }, [confidentialBlocked]);

  const handleDownloadSafe = () => {
    if (blocked || preparation === null || preparation.status !== "ready") return;
    downloadTextFile(
      SAFE_STRUCTURED_FILE_NAME,
      serializeStructuredSafeCsv(preparation.output.safe)
    );
  };
  const handleDownloadSafeXlsx = async () => {
    if (blocked || preparation === null || preparation.status !== "ready") return;
    const requestedJobId = job.id;
    const requestedPreparation = preparation;
    setXlsxError(null);
    try {
      const lib = await loadXlsx();
      // Re-check AFTER the async generation window (CORA-AUDIT-REC04-01): a
      // Job change or a no-longer-ready/blocked preparation that arrived
      // while awaiting must produce NO download, no stale bytes and no
      // success. The current render governs the UI from here on.
      if (!isSafeCurrent(requestedJobId, requestedPreparation)) return;
      downloadXlsxFile(
        SAFE_STRUCTURED_XLSX_FILE_NAME,
        buildSafeXlsxBytes(
          lib,
          requestedPreparation.output.safe,
          structured === null ? null : deriveStructuredSummary(structured.configuration)
        )
      );
    } catch (error) {
      setXlsxError({
        zone: "safe",
        message:
          error instanceof Error
            ? error.message
            : "Safe XLSX could not be generated from the prepared output.",
      });
    }
  };
  const handleRequestConfidential = (format: StructuredConfidentialFormat) => {
    if (confidentialBlocked || preparation === null || preparation.status !== "ready") return;
    setXlsxError(null);
    setPendingConfirmation(format);
  };
  const handleConfirmConfidential = async () => {
    if (
      pendingConfirmation === null ||
      confidentialBlocked ||
      preparation === null ||
      preparation.status !== "ready"
    ) {
      return;
    }
    const format = pendingConfirmation;
    const requestedJobId = job.id;
    const requestedPreparation = preparation;
    // Reset first: one explicit Confirm performs exactly one download, and
    // the confirmation never survives the download either way.
    setPendingConfirmation(null);
    try {
      if (format === "txt") {
        // Synchronous, so this guard holds at the moment of execution too.
        if (!isConfirmationCurrent(requestedJobId, requestedPreparation)) return;
        downloadTextFile(
          CONFIDENTIAL_STRUCTURED_FILE_NAME,
          serializeStructuredConfidentialAudit(preparation.output.confidential)
        );
      } else {
        const lib = await loadXlsx();
        // Re-check AFTER the async generation window: a Job change, a
        // no-longer-ready/stale preparation or disabled Confidential
        // readiness that arrived while awaiting must produce NO download
        // (D-022 / §4.5.4: the confirmation cannot survive them).
        if (!isConfirmationCurrent(requestedJobId, requestedPreparation)) return;
        downloadXlsxFile(
          CONFIDENTIAL_STRUCTURED_XLSX_FILE_NAME,
          buildConfidentialXlsxBytes(lib, preparation.output.confidential)
        );
      }
    } catch (error) {
      setXlsxError({
        zone: "confidential",
        message:
          error instanceof Error
            ? error.message
            : "Confidential XLSX could not be generated from the prepared output.",
      });
    }
  };
  const handleCancelConfidential = () => {
    setPendingConfirmation(null);
  };

  return (
    <section aria-labelledby="export-step-heading">
      <header className="max-w-3xl">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-neutral-600">Export</p>
        <h2
          id="export-step-heading"
          className="mt-1 font-display text-3xl font-bold tracking-tight text-primary-dark"
        >
          Export
        </h2>
        <p className="mt-2 text-base leading-relaxed text-neutral-700">
          Two independent artifacts are produced from this structured configuration, downloaded
          separately. Download only the one your destination is authorized to receive.
        </p>
      </header>

      <section aria-labelledby="safe-structured-heading" className={zoneCard}>
        <div className="border-b border-primary/30 px-4 py-3">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
            <span className={`${zoneBadge} bg-primary-dark`}>Deliverable</span>
            <h3 id="safe-structured-heading" className={zoneHeading}>
              Safe Structured Output
            </h3>
          </div>
        </div>
        <div className="p-4">
          <p className={zoneBody}>
            The reviewed structured table with date/age and pseudonymized columns transformed,
            identifier columns removed and the selected patient-ID column replaced with a Study ID
            (ID_ESTUDIO). It contains no original↔transformed mapping and no original identifier or
            sensitive values.
          </p>
          {blocked && reasons.length > 0 && (
            <ul
              role="alert"
              id="safe-structured-blocked-reason"
              className={`${blockedNote} list-disc space-y-0.5 pl-6`}
            >
              {reasons.map((reason, index) => (
                <li key={index}>{reason}</li>
              ))}
            </ul>
          )}
          <button
            type="button"
            onClick={handleDownloadSafe}
            disabled={blocked}
            aria-describedby={blocked ? "safe-structured-blocked-reason" : undefined}
            className={`mt-3 rounded bg-primary-dark px-4 py-2 text-sm font-semibold text-white hover:bg-primary disabled:cursor-not-allowed disabled:opacity-70 ${focusRing}`}
          >
            Download Safe Structured Output (.csv)
          </button>
          <button
            type="button"
            onClick={() => void handleDownloadSafeXlsx()}
            disabled={blocked}
            aria-describedby={blocked ? "safe-structured-blocked-reason" : undefined}
            className={`mt-3 rounded bg-primary-dark px-4 py-2 text-sm font-semibold text-white hover:bg-primary disabled:cursor-not-allowed disabled:opacity-70 ${focusRing}`}
          >
            Download Safe Structured Output (.xlsx)
          </button>
          {xlsxError !== null && xlsxError.zone === "safe" && (
            <p role="alert" className={blockedNote}>
              {xlsxError.message}
            </p>
          )}
        </div>
      </section>

      <section
        aria-labelledby="structured-confidential-heading"
        className="mt-6 overflow-hidden rounded-xl border-2 border-surface-dark bg-white shadow-sm"
      >
        <div className="bg-surface-dark px-4 py-3">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
            <span className={`${zoneBadge} border border-white/70`}>Internal</span>
            <h3
              id="structured-confidential-heading"
              className="font-display text-lg font-bold text-white"
            >
              Structured Confidential Audit
            </h3>
          </div>
        </div>
        <div className="p-4">
          <p className="text-sm font-semibold text-neutral-800">
            {CONFIDENTIAL_AUDIT_WARNING_LINE}
          </p>
          <p className={`mt-2 ${zoneBody}`}>
            The original↔transformed correspondence behind the Safe table (date/age, pseudonymized
            and Study-ID columns, plus removed columns). It is an internal traceability record and
            must never be shared or delivered outside the authorized audit trail.
          </p>
          {confidentialReasonVisible && (
            <p role="status" id="structured-confidential-blocked-reason" className={blockedNote}>
              Confidential Audit is not available for this job yet.
            </p>
          )}
          <button
            type="button"
            onClick={() => handleRequestConfidential("txt")}
            disabled={confidentialBlocked}
            aria-describedby={confidentialDescribedBy}
            className={`mt-3 rounded border border-surface-dark px-4 py-2 text-sm font-semibold text-neutral-800 hover:bg-surface-dark hover:text-white disabled:cursor-not-allowed disabled:opacity-70 ${focusRing}`}
          >
            Download Structured Confidential Audit (.txt)
          </button>
          <button
            type="button"
            onClick={() => handleRequestConfidential("xlsx")}
            disabled={confidentialBlocked}
            aria-describedby={confidentialDescribedBy}
            className={`mt-3 rounded border border-surface-dark px-4 py-2 text-sm font-semibold text-neutral-800 hover:bg-surface-dark hover:text-white disabled:cursor-not-allowed disabled:opacity-70 ${focusRing}`}
          >
            Download Structured Confidential Audit (.xlsx)
          </button>
          {pendingConfirmation !== null && !confidentialBlocked && (
            <div
              role="group"
              aria-labelledby="structured-confidential-confirm-heading"
              className="mt-3 rounded border-2 border-surface-dark bg-surface-light px-3 py-2"
            >
              <h4
                id="structured-confidential-confirm-heading"
                className="text-sm font-bold text-neutral-800"
              >
                Confirm confidential download ({pendingConfirmation === "txt" ? ".txt" : ".xlsx"})
              </h4>
              <p className="mt-1 text-sm leading-relaxed text-neutral-800">
                This artifact contains identifiable, reversible original↔transformed correspondence
                and is for authorized internal handling only. Confirm to download it once now, or
                cancel to download nothing.
              </p>
              <div className="mt-2 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => void handleConfirmConfidential()}
                  className={`rounded bg-primary-dark px-4 py-2 text-sm font-semibold text-white hover:bg-primary ${focusRing}`}
                >
                  Confirm confidential download ({pendingConfirmation === "txt" ? ".txt" : ".xlsx"})
                </button>
                <button
                  type="button"
                  onClick={handleCancelConfidential}
                  className={`rounded border border-surface-dark px-4 py-2 text-sm font-semibold text-neutral-800 hover:bg-surface-dark hover:text-white ${focusRing}`}
                >
                  Cancel confidential download
                </button>
              </div>
            </div>
          )}
          {xlsxError !== null && xlsxError.zone === "confidential" && (
            <p role="alert" className={blockedNote}>
              {xlsxError.message}
            </p>
          )}
        </div>
      </section>
    </section>
  );
}

/**
 * Content-free diagnostic for a refused Safe-summary download. Only the
 * typed error CODE (or, for an unexpected error, its name) is retained: the
 * raw message can name a source file, so it is never captured into state,
 * logged or rendered (CODING_STANDARDS §4). Runtime sources carry no
 * `console.*` call at all (check:external no-PHI-console rule), so the
 * diagnostic is exposed as a stable DOM attribute instead.
 */
function batchSummaryDiagnostic(error: unknown): string {
  if (error instanceof BatchSummaryError) return error.code;
  if (error instanceof Error) return error.name;
  return "unknown-error";
}

/**
 * Document-batch Result (REC-07 #87): the human batch ending — readiness
 * (`Listo para usar` / `Requiere tu atención` / `Bloqueado`) plus the first
 * accepted batch Safe deliverable, all derived from the existing batch
 * authorities through `batchResultModel` (never a second state machine).
 * Result visibility is decoupled from artifact authorization: the surface
 * renders in every batch state, but the Safe summary CSV downloads exactly
 * once and only when the batch is ready. The download is synchronous and
 * client-side (Blob + object URL + anchor click, revoked afterwards): no
 * network, no persistence, no async generation path (D-013).
 *
 * The batch Confidential Audit stays a clearly separate, deliberately
 * sensitive zone that is unavailable in this slice (#89 owns it); it is
 * never presented as an equivalent output format. Batch Confidential
 * remains unavailable exactly as before (T17 #21 CORR-B): the ACTIVE
 * document's ReviewSession is never presented as a batch-wide audit.
 * A batch gains NO single-item Result surface (D-024 protected sibling).
 */
function BatchResult({
  job,
  onReturnToReview,
}: {
  job: Job;
  onReturnToReview: (() => void) | undefined;
}): ReactElement {
  const view = deriveBatchResultView(job);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [diagnostic, setDiagnostic] = useState<string | null>(null);

  // Transient action feedback never survives another Job: the domain inputs
  // are frozen, so a replaced Job always arrives as a new reference.
  useEffect(() => {
    setFeedback(null);
    setDiagnostic(null);
  }, [job]);

  const stateLabel =
    view.state === "ready"
      ? "Listo para usar"
      : view.state === "needs-attention"
        ? "Requiere tu atención"
        : "Bloqueado";

  const handleDownloadSummary = () => {
    if (view.state !== "ready") return;
    try {
      downloadTextFile(BATCH_SUMMARY_CSV_FILENAME, serializeBatchSummaryCsv(job));
      setDiagnostic(null);
      setFeedback("Descarga del resumen seguro (.csv) iniciada.");
    } catch (error) {
      // Fail-closed serialization: zero bytes downloaded, truthful message.
      // The refusal is not swallowed: a content-free diagnostic (typed code,
      // never the raw message) stays observable without leaking a filename
      // or source metadata into the DOM, a log or the Spanish UI copy.
      setDiagnostic(batchSummaryDiagnostic(error));
      setFeedback("El resumen seguro todavía no está disponible para este lote.");
    }
  };

  const reasonId =
    view.state === "needs-attention"
      ? "batch-result-attention-reason"
      : view.state === "blocked"
        ? "batch-result-blocked-reason"
        : undefined;

  return (
    <section aria-labelledby="export-step-heading" data-result-state={view.state}>
      <header className="max-w-3xl">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-neutral-600">
          Resultado
        </p>
        <h2
          id="export-step-heading"
          className="mt-1 font-display text-3xl font-bold tracking-tight text-primary-dark"
        >
          Resultado
        </h2>
        <p className="mt-2 text-base leading-relaxed text-neutral-700">
          Revisa el estado del lote y descarga el resumen seguro cuando esté listo. Las descargas se
          generan en tu navegador.
        </p>
      </header>

      <section aria-labelledby="batch-result-state-heading" className={zoneCard}>
        <div className="border-b border-primary/30 px-4 py-3">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
            <span className={`${zoneBadge} bg-primary-dark`}>Resultado</span>
            <h3 id="batch-result-state-heading" className={zoneHeading}>
              {stateLabel}
            </h3>
          </div>
        </div>
        <div className="p-4">
          {view.state === "needs-attention" && view.attentionMessage !== null && (
            <p role="status" id="batch-result-attention-reason" className={blockedNote}>
              {view.attentionMessage}
            </p>
          )}
          {view.state === "blocked" && view.blockedMessage !== null && (
            <p role="alert" id="batch-result-blocked-reason" className={blockedNote}>
              {view.blockedMessage}
            </p>
          )}
          {view.state === "blocked" && view.failedNames.length > 0 && (
            <ul
              aria-label="Documentos con error"
              className="mt-2 list-disc space-y-0.5 pl-6 text-sm"
            >
              {view.failedNames.map((name) => (
                <li key={name}>{name}</li>
              ))}
            </ul>
          )}

          <p aria-label="Resumen del lote" className="mt-3 text-sm text-neutral-700">
            Documentos: {view.totalCount} · Completados: {view.completedCount} · Pendientes:{" "}
            {view.pendingCount} · Con error: {view.failedCount} · Retirados: {view.removedCount}
          </p>

          {view.state === "ready" ? (
            <>
              <button
                type="button"
                onClick={handleDownloadSummary}
                data-variant="primary"
                className={primaryButton}
              >
                Descargar resumen seguro (.csv)
              </button>
              {feedback !== null && (
                <p
                  role="status"
                  id="batch-result-action-feedback"
                  data-batch-summary-diagnostic={diagnostic ?? undefined}
                  className="mt-3 text-sm text-neutral-700"
                >
                  {feedback}
                </p>
              )}
            </>
          ) : (
            <div className="mt-1">
              <button
                type="button"
                disabled
                data-variant="primary"
                aria-describedby={reasonId}
                className={primaryButton}
              >
                Descargar resumen seguro (.csv)
              </button>
            </div>
          )}

          <button
            type="button"
            onClick={() => onReturnToReview?.()}
            data-variant="return"
            className={secondaryButton}
          >
            Volver a la revisión
          </button>
        </div>
      </section>

      <section
        aria-labelledby="confidential-audit-heading"
        className="mt-6 overflow-hidden rounded-xl border-2 border-surface-dark bg-white shadow-sm"
      >
        <div className="bg-surface-dark px-4 py-3">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
            <span className={`${zoneBadge} border border-white/70`}>Interno</span>
            <h3
              id="confidential-audit-heading"
              className="font-display text-lg font-bold text-white"
            >
              Auditoría confidencial
            </h3>
          </div>
        </div>
        <div className="p-4">
          <p className="text-sm font-semibold text-neutral-800">
            Confidencial — artefacto interno de auditoría
          </p>
          <p className={`mt-2 ${zoneBody}`}>
            La correspondencia de auditoría del lote es un registro de trazabilidad interno y nunca
            debe compartirse ni entregarse fuera de la pista de auditoría autorizada. Todavía no
            está disponible para el lote.
          </p>
          <p role="status" id="confidential-audit-blocked-reason" className={blockedNote}>
            {batchConfidentialAuditUnavailableMessage()}
          </p>
          <button
            type="button"
            disabled
            aria-describedby="confidential-audit-blocked-reason"
            className={`mt-3 rounded border border-surface-dark px-4 py-2 text-sm font-semibold text-neutral-800 hover:bg-surface-dark hover:text-white disabled:cursor-not-allowed disabled:opacity-70 ${focusRing}`}
          >
            Descargar auditoría confidencial (.txt)
          </button>
        </div>
      </section>
    </section>
  );
}

/** Which action produced the current Result feedback (D-024 §Action feedback). */
type SingleResultAction = "copy" | "txt" | "docx" | "pdf";

type SingleResultFeedback =
  | { readonly action: SingleResultAction; readonly status: "pending"; readonly message: string }
  | { readonly action: SingleResultAction; readonly status: "success"; readonly message: string }
  | { readonly action: SingleResultAction; readonly status: "error"; readonly message: string };

/**
 * Single-item Result (REC-05 WU-B). Composes the readiness + prepared/shareable
 * actions + factual kept-original warning + return path; the Confidential Audit
 * zone is preserved below as a separate sensitive zone.
 */
function SingleItemResult({
  job,
  review,
  onReturnToReview,
}: {
  job: Job;
  review: ReviewSession | null;
  onReturnToReview: (() => void) | undefined;
}): ReactElement {
  const view = deriveSingleResultView(job, review);
  const material: SingleResultMaterial = view.material;
  const safeText = view.safeText;

  // Fail-closed Confidential readiness: the audit honors its OWN output flag
  // (same authority as the document/structured paths), independent of whether
  // the prepared Safe result is ready — the audit is buildable during review.
  const confidentialAuditBlocked = !job.outputs.confidentialAuditReady;

  const [feedback, setFeedback] = useState<SingleResultFeedback | null>(null);
  // REC-05 WU-C deliberate confirmation (H-42 single text/document slice,
  // D-024): the first Confidential action only reveals the warning and
  // downloads nothing; one explicit Confirm performs exactly one download.
  const [pendingConfirmation, setPendingConfirmation] = useState(false);
  const [confidentialError, setConfidentialError] = useState<string | null>(null);

  // CURRENT authorization snapshot: the latest render's Job id, review
  // identity, canonical payload and both readiness facts. A download is only
  // requested against one frozen snapshot; because the ref carries the latest
  // render it observes a Job/review/payload/readiness change that arrives
  // during an async generation window.
  const authorityRef = useRef<{
    readonly jobId: string;
    readonly review: ReviewSession | null;
    readonly safeText: string | null;
    readonly ready: boolean;
    readonly confidentialBlocked: boolean;
  }>({
    jobId: job.id,
    review,
    safeText,
    ready: view.state === "ready",
    confidentialBlocked: confidentialAuditBlocked,
  });
  authorityRef.current = {
    jobId: job.id,
    review,
    safeText,
    ready: view.state === "ready",
    confidentialBlocked: confidentialAuditBlocked,
  };

  // Unmount disposal (handoff §4.6, D-024 async safeguard): the snapshot
  // above stays SELF-CONSISTENT after the Result is removed (New Job / Clear
  // session unmounts <ExportStep>), so the just-in-time guard alone would
  // still pass and a completed generation would download a stale artifact.
  // The disposal flag set in the effect cleanup closes that gap: completion
  // after unmount produces ZERO download and zero false success.
  const disposedRef = useRef(false);
  useEffect(() => {
    disposedRef.current = false;
    return () => {
      disposedRef.current = true;
    };
  }, []);

  // Just-in-time guard: true only while the requested Job + review + canonical
  // payload are still current and still ready, and the Result has not been
  // disposed by unmount. Evaluated immediately before any bytes are produced
  // and any download begins.
  const isAuthorityCurrent = (requested: {
    readonly jobId: string;
    readonly review: ReviewSession;
    readonly safeText: string;
  }): boolean => {
    if (disposedRef.current) {
      return false;
    }
    const current = authorityRef.current;
    return (
      current.ready &&
      current.jobId === requested.jobId &&
      current.review === requested.review &&
      current.safeText === requested.safeText
    );
  };

  // Confidential counterpart of the guard above (cloned from the structured
  // REC-04 pattern): true only while the requested Job + review identity are
  // still current and the audit is still available. Evaluated at the exact
  // moment bytes would be produced, after the confirmation was accepted.
  const isConfidentialAuthorityCurrent = (requested: {
    readonly jobId: string;
    readonly review: ReviewSession;
  }): boolean => {
    const current = authorityRef.current;
    return (
      !current.confidentialBlocked &&
      current.jobId === requested.jobId &&
      current.review === requested.review
    );
  };

  // Any new Job, review mutation or payload change invalidates the transient
  // feedback and never survives into the next Result state.
  useEffect(() => {
    setFeedback(null);
  }, [job, review, safeText]);

  // The Confidential confirmation grants no readiness and never outlives the
  // Job or the review it was requested against: a new Job or a mutated review
  // clears it. The domain inputs are frozen, so a changed review always
  // arrives as a new reference.
  useEffect(() => {
    setPendingConfirmation(false);
    setConfidentialError(null);
  }, [job, review]);
  // Defense in depth: a newly unavailable audit state clears a pending
  // confirmation even if the references above were somehow reused.
  useEffect(() => {
    if (confidentialAuditBlocked) {
      setPendingConfirmation(false);
    }
  }, [confidentialAuditBlocked]);

  const handleCopy = async () => {
    if (view.state !== "ready" || safeText === null || review === null) return;
    const requested = { jobId: job.id, review, safeText };
    // Revalidate BEFORE the clipboard write: a stale authority (or a disposed
    // Result) refuses with the truthful "nothing was copied" message and
    // never reaches the platform clipboard.
    if (!isAuthorityCurrent(requested)) {
      if (disposedRef.current) return; // unmounted: no visible surface to report to
      setFeedback({
        action: "copy",
        status: "error",
        message: "La revisión cambió; no se copió ningún texto.",
      });
      return;
    }
    setFeedback({
      action: "copy",
      status: "pending",
      message: "Copiando el texto preparado…",
    });
    try {
      await copyTextToClipboard(requested.safeText);
      // The platform accepted the write: report success factually. The
      // clipboard now holds the text, so a post-write authority change must
      // not produce a message that misstates what happened (no false failure
      // and no false success — handoff §3).
      setFeedback({
        action: "copy",
        status: "success",
        message: "Texto preparado copiado al portapapeles.",
      });
    } catch (error) {
      setFeedback({
        action: "copy",
        status: "error",
        message:
          error instanceof ClipboardError
            ? error.message
            : "No se pudo copiar el texto al portapapeles.",
      });
    }
  };

  const handleTextDownload = () => {
    if (view.state !== "ready" || safeText === null || review === null) return;
    // Synchronous, so the guard holds at the moment of the download too.
    if (!isAuthorityCurrent({ jobId: job.id, review, safeText })) return;
    downloadTextFile(SAFE_TXT_FILE_NAME, safeText);
    setFeedback({
      action: "txt",
      status: "success",
      message: "Descarga del texto preparado (.txt) iniciada.",
    });
  };

  const handleDocxDownload = async () => {
    if (view.state !== "ready" || safeText === null || review === null) return;
    const requested = { jobId: job.id, review, safeText };
    setFeedback({
      action: "docx",
      status: "pending",
      message: "Preparando el documento (.docx)…",
    });
    try {
      const bytes = await buildSafeDocxBytes(requested.safeText);
      // Re-check AFTER the awaited generation and immediately before download.
      // The guard also fails after unmount (disposal), so completion of a
      // removed Result downloads nothing.
      if (!isAuthorityCurrent(requested)) {
        if (disposedRef.current) return; // unmounted: no visible surface to report to
        setFeedback({
          action: "docx",
          status: "error",
          message: "La revisión cambió; no se descargó ningún documento.",
        });
        return;
      }
      downloadBinaryFile(SAFE_DOCX_FILENAME, bytes, DOCX_MIME);
      setFeedback({
        action: "docx",
        status: "success",
        message: "Descarga del documento preparado (.docx) iniciada.",
      });
    } catch (error) {
      setFeedback({
        action: "docx",
        status: "error",
        message:
          error instanceof DocxBuildError
            ? error.message
            : "No se pudo generar el documento (.docx).",
      });
    }
  };

  const handlePdfDownload = async () => {
    if (view.state !== "ready" || safeText === null || review === null) return;
    const requested = { jobId: job.id, review, safeText };
    setFeedback({
      action: "pdf",
      status: "pending",
      message: "Preparando el archivo PDF…",
    });
    try {
      const bytes = await buildSafePdfBytes(requested.safeText);
      // Re-check AFTER the awaited generation and immediately before download.
      // The guard also fails after unmount (disposal), so completion of a
      // removed Result downloads nothing.
      if (!isAuthorityCurrent(requested)) {
        if (disposedRef.current) return; // unmounted: no visible surface to report to
        setFeedback({
          action: "pdf",
          status: "error",
          message: "La revisión cambió; no se descargó ningún archivo.",
        });
        return;
      }
      downloadBinaryFile(SAFE_PDF_FILENAME, bytes, PDF_MIME);
      setFeedback({
        action: "pdf",
        status: "success",
        message: "Descarga del archivo PDF iniciada.",
      });
    } catch (error) {
      setFeedback({
        action: "pdf",
        status: "error",
        message:
          error instanceof PdfRepresentationError
            ? `No se pudo generar el PDF. ${error.message}`
            : "No se pudo generar el archivo PDF.",
      });
    }
  };

  const confidentialAuditReason = confidentialAuditBlocked
    ? "La auditoría confidencial todavía no está disponible para este trabajo."
    : null;

  // First action: reveal the warning only, download ZERO bytes.
  const handleRequestConfidentialDownload = () => {
    if (confidentialAuditBlocked || review === null) return;
    setConfidentialError(null);
    setPendingConfirmation(true);
  };

  // Explicit Confirm: reset first (one Confirm = exactly one download; the
  // confirmation never survives either way) and revalidate the CURRENT Job +
  // review/audit authority at the exact moment bytes would be produced. Any
  // stale mismatch produces zero download and a visible non-PHI failure.
  const handleConfirmConfidentialDownload = () => {
    if (!pendingConfirmation || confidentialAuditBlocked || review === null) return;
    const requested = { jobId: job.id, review };
    setPendingConfirmation(false);
    if (!isConfidentialAuthorityCurrent(requested)) {
      setConfidentialError("La revisión cambió; no se descargó ninguna auditoría.");
      return;
    }
    try {
      downloadTextFile(
        CONFIDENTIAL_AUDIT_FILE_NAME,
        serializeConfidentialAudit(buildConfidentialAudit(requested.review))
      );
    } catch {
      setConfidentialError("No se pudo generar la auditoría confidencial.");
    }
  };

  // Cancel: reset, download ZERO bytes.
  const handleCancelConfidentialDownload = () => {
    setConfidentialError(null);
    setPendingConfirmation(false);
  };

  const stateLabel =
    view.state === "ready"
      ? "Listo para usar"
      : view.state === "needs-attention"
        ? "Requiere tu atención"
        : "Bloqueado";

  const intro =
    material === "text"
      ? "Revisa el estado del resultado y usa el texto preparado cuando esté listo. Las descargas se generan en tu navegador."
      : "Revisa el estado del resultado y descarga el documento preparado cuando esté listo. Las descargas se generan en tu navegador.";

  const copyButton = (
    <button
      type="button"
      key="copy"
      onClick={() => void handleCopy()}
      data-variant="secondary"
      className={secondaryButton}
    >
      Copiar texto preparado
    </button>
  );
  const txtButton = (
    <button
      type="button"
      key="txt"
      onClick={handleTextDownload}
      data-variant="secondary"
      className={secondaryButton}
    >
      Descargar como TXT (.txt)
    </button>
  );
  const docxButton = (variant: "primary" | "secondary") => (
    <button
      type="button"
      key="docx"
      onClick={() => void handleDocxDownload()}
      data-variant={variant}
      className={variant === "primary" ? primaryButton : secondaryButton}
    >
      Descargar documento preparado (.docx)
    </button>
  );
  const pdfButton = (
    <button
      type="button"
      key="pdf"
      onClick={() => void handlePdfDownload()}
      data-variant="secondary"
      className={secondaryButton}
    >
      Descargar como PDF (.pdf)
    </button>
  );

  const feedbackNode = feedback !== null && (
    <p
      role={feedback.status === "error" ? "alert" : "status"}
      id="result-action-feedback"
      className={feedback.status === "error" ? blockedNote : "mt-3 text-sm text-neutral-700"}
    >
      {feedback.message}
    </p>
  );

  // Factual kept-original warning: rendered in every Result state (a restored
  // original can coexist with still-pending decisions) from the exact
  // ReviewSession facts, never as correspondence leakage.
  const keptOriginalsNode = view.keptOriginals.length > 0 && (
    <section
      aria-labelledby="result-kept-originals-heading"
      className="mt-3 rounded border border-amber-500 bg-amber-50 px-3 py-2"
    >
      <h4 id="result-kept-originals-heading" className="text-sm font-bold text-neutral-800">
        Originales conservados deliberadamente
      </h4>
      <ul className="mt-1 list-disc space-y-0.5 pl-6 text-sm text-neutral-800">
        {view.keptOriginals.map((kept, index) => (
          <li key={index}>
            Se conservó el texto original de tipo «{kept.type}» por una decisión de revisión.
          </li>
        ))}
      </ul>
    </section>
  );

  return (
    <section aria-labelledby="export-step-heading" data-result-state={view.state}>
      <header className="max-w-3xl">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-neutral-600">
          Resultado
        </p>
        <h2
          id="export-step-heading"
          className="mt-1 font-display text-3xl font-bold tracking-tight text-primary-dark"
        >
          Resultado
        </h2>
        <p className="mt-2 text-base leading-relaxed text-neutral-700">{intro}</p>
      </header>

      <section aria-labelledby="result-state-heading" className={zoneCard}>
        <div className="border-b border-primary/30 px-4 py-3">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
            <span className={`${zoneBadge} bg-primary-dark`}>Resultado</span>
            <h3 id="result-state-heading" className={zoneHeading}>
              {stateLabel}
            </h3>
          </div>
        </div>
        <div className="p-4">
          {view.state === "needs-attention" && view.attentionMessage !== null && (
            <p role="status" id="result-attention-reason" className={blockedNote}>
              {view.attentionMessage}
            </p>
          )}
          {view.state === "blocked" && view.blockedMessage !== null && (
            <p role="alert" id="result-blocked-reason" className={blockedNote}>
              {view.blockedMessage}
            </p>
          )}

          {keptOriginalsNode}

          {view.state === "ready" && safeText !== null ? (
            <>
              <section aria-labelledby="result-primary-heading" className="mt-4">
                <h4
                  id="result-primary-heading"
                  className="text-sm font-bold uppercase tracking-wide text-neutral-700"
                >
                  {material === "text" ? "Texto preparado" : "Documento preparado"}
                </h4>
                <p className="mt-1 text-sm leading-relaxed text-neutral-700">
                  {material === "text"
                    ? "El texto revisado listo para copiar y usar en tu destino."
                    : "La versión preparada del documento, lista para descargar."}
                </p>
                <div className="mt-1">
                  {material === "text" ? (
                    <button
                      type="button"
                      onClick={() => void handleCopy()}
                      data-variant="primary"
                      className={primaryButton}
                    >
                      Copiar texto preparado
                    </button>
                  ) : (
                    docxButton("primary")
                  )}
                </div>
              </section>

              <section aria-labelledby="result-secondary-heading" className="mt-4">
                <h4
                  id="result-secondary-heading"
                  className="text-sm font-bold uppercase tracking-wide text-neutral-700"
                >
                  Otros formatos
                </h4>
                <p className="mt-1 text-sm leading-relaxed text-neutral-700">
                  El mismo resultado preparado en otros formatos. Son alternativas, no la acción
                  principal.
                </p>
                <div
                  role="group"
                  aria-label="Otros formatos disponibles"
                  className="mt-1 flex flex-wrap gap-2"
                >
                  {material === "text" ? (
                    <>
                      {txtButton}
                      {docxButton("secondary")}
                      {pdfButton}
                    </>
                  ) : (
                    <>
                      {copyButton}
                      {txtButton}
                      {pdfButton}
                    </>
                  )}
                </div>
              </section>
            </>
          ) : (
            <div className="mt-1">
              <div>
                {material === "text" ? (
                  <button
                    type="button"
                    disabled
                    data-variant="primary"
                    aria-describedby={
                      view.state === "needs-attention"
                        ? "result-attention-reason"
                        : "result-blocked-reason"
                    }
                    className={primaryButton}
                  >
                    Copiar texto preparado
                  </button>
                ) : (
                  <button
                    type="button"
                    disabled
                    data-variant="primary"
                    aria-describedby={
                      view.state === "needs-attention"
                        ? "result-attention-reason"
                        : "result-blocked-reason"
                    }
                    className={primaryButton}
                  >
                    Descargar documento preparado (.docx)
                  </button>
                )}
              </div>
            </div>
          )}

          {feedbackNode}

          <button
            type="button"
            onClick={() => onReturnToReview?.()}
            data-variant="return"
            className={secondaryButton}
          >
            Volver a la revisión
          </button>
        </div>
      </section>

      <section
        aria-labelledby="confidential-audit-heading"
        className="mt-6 overflow-hidden rounded-xl border-2 border-surface-dark bg-white shadow-sm"
      >
        <div className="bg-surface-dark px-4 py-3">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
            <span className={`${zoneBadge} border border-white/70`}>Interno</span>
            <h3
              id="confidential-audit-heading"
              className="font-display text-lg font-bold text-white"
            >
              Auditoría confidencial
            </h3>
          </div>
        </div>
        <div className="p-4">
          <p className="text-sm font-semibold text-neutral-800">
            Confidencial — artefacto interno de auditoría
          </p>
          <p className={`mt-2 ${zoneBody}`}>
            Este archivo contiene los valores originales sensibles, sus reemplazos y las notas de
            revisión. Es un registro de trazabilidad interno y nunca debe compartirse ni entregarse
            fuera de la pista de auditoría autorizada.
          </p>
          {confidentialAuditBlocked && confidentialAuditReason !== null && (
            <p role="status" id="confidential-audit-blocked-reason" className={blockedNote}>
              {confidentialAuditReason}
            </p>
          )}
          <button
            type="button"
            onClick={handleRequestConfidentialDownload}
            disabled={confidentialAuditBlocked}
            aria-describedby={
              confidentialAuditBlocked ? "confidential-audit-blocked-reason" : undefined
            }
            className={`mt-3 rounded border border-surface-dark px-4 py-2 text-sm font-semibold text-neutral-800 hover:bg-surface-dark hover:text-white disabled:cursor-not-allowed disabled:opacity-70 ${focusRing}`}
          >
            Descargar auditoría confidencial (.txt)
          </button>
          {pendingConfirmation && !confidentialAuditBlocked && (
            <div
              role="group"
              aria-labelledby="confidential-audit-confirm-heading"
              className="mt-3 rounded border-2 border-surface-dark bg-surface-light px-3 py-2"
            >
              <h4
                id="confidential-audit-confirm-heading"
                className="text-sm font-bold text-neutral-800"
              >
                Confirmación de descarga confidencial
              </h4>
              <p className="mt-1 text-sm leading-relaxed text-neutral-800">
                Este archivo contiene correspondencia identificable y reversible entre los valores
                originales y sus reemplazos, y es solo para manejo interno autorizado. Confirma para
                descargarlo una vez ahora, o cancela para no descargar nada.
              </p>
              <div className="mt-2 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={handleConfirmConfidentialDownload}
                  className={`rounded bg-primary-dark px-4 py-2 text-sm font-semibold text-white hover:bg-primary ${focusRing}`}
                >
                  Confirmar descarga confidencial
                </button>
                <button
                  type="button"
                  onClick={handleCancelConfidentialDownload}
                  className={`rounded border border-surface-dark px-4 py-2 text-sm font-semibold text-neutral-800 hover:bg-surface-dark hover:text-white ${focusRing}`}
                >
                  Cancelar descarga confidencial
                </button>
              </div>
            </div>
          )}
          {confidentialError !== null && (
            <p role="alert" className={blockedNote}>
              {confidentialError}
            </p>
          )}
        </div>
      </section>
    </section>
  );
}

export function ExportStep(props: ExportStepProps): ReactElement {
  const { job, review } = props;
  if (job.kind === "structured") {
    return <StructuredExport job={job} structured={props.structured ?? null} />;
  }
  if (job.kind === "document-batch") {
    return <BatchResult job={job} onReturnToReview={props.onReturnToReview} />;
  }
  return <SingleItemResult job={job} review={review} onReturnToReview={props.onReturnToReview} />;
}
