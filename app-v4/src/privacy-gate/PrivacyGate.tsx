/**
 * Privacy Gate step (Work Order T08 U3; SPEC_V4_APP_AND_REVIEW.md §6).
 *
 * Renders the factual gate view derived by privacyGateModel from the frozen
 * ReviewSession + Job. Everything is accessible and factual:
 *   - status is always conveyed by text (never color alone);
 *   - the blocked state is an explicit role="alert" message;
 *   - counts, warnings, errors and the policy used are shown as-is;
 *   - kept-original (restored) entries appear as factual warnings, phrased
 *     as completed reviewer decisions, never as leakage.
 *
 * UX-PILOT-02 (#55) presentation reframe ONLY: the same facts/readiness are
 * grouped as a compact decision checkpoint (action required / review complete)
 * with the factual counts, availability and attention facts below. The model,
 * counts, messages, readiness rules and batch/structured semantics are
 * untouched.
 *
 * For a document batch (T17 #21 SD-9) the gate additionally renders the
 * factual per-item list (name + visible status text + failure message) read
 * from the Job, and the explicit fail-closed batch copy. The active review
 * session may be absent for a batch.
 *
 * No export actions live here: the Export step owns them (U4). No privacy
 * score, safe percentage, anonymity or certification claim anywhere (D-006).
 */
import { useMemo, type ReactElement } from "react";

import type { BatchItemStatus, Job, PrivacyPolicyId } from "../domain/job";
import type { ReviewSession } from "../review/review-domain";
import {
  type PrivacyGateStructuredColumn,
  type PrivacyGateStructuredFacts,
  type PrivacyGateStructuredInput,
  type PrivacyGateView,
  batchConfidentialAuditAvailabilityMessage,
  batchFailedItemsMessage,
  batchSafeSummaryAvailabilityMessage,
  derivePrivacyGateView,
  pendingDecisionMessage,
} from "./privacyGateModel";
import { localizeStructuredBlockReason } from "../structured/reason-labels";
import { localizeDomainErrorMessage } from "../presentation/domain-message-labels";

const POLICY_LABELS: Record<PrivacyPolicyId, string> = {
  standard: "Estándar",
  "external-ai": "IA externa",
  "longitudinal-research": "Investigación longitudinal",
  strict: "Estricta",
};

/** Visible text label per batch item status: status is never conveyed by color. */
const BATCH_STATUS_LABELS: Record<BatchItemStatus, string> = {
  queued: "En cola",
  reading: "Leyendo",
  processing: "Procesando",
  "review-required": "Requiere revisión",
  completed: "Completado",
  error: "Error",
};

/**
 * Presentation-only Spanish labels for the derived structured column
 * disposition and date role facts. The internal disposition/role codes are
 * never altered; only the end-user wording shown in the gate is localized.
 */
const STRUCTURED_DISPOSITION_LABELS: Record<PrivacyGateStructuredColumn["disposition"], string> = {
  "date-age": "Generalizar fecha/edad",
  pseudonymize: "Seudonimizar",
  keep: "Conservar",
  remove: "Eliminar",
  "study-id": "ID de estudio",
  "free-text": "Texto libre",
  unsupported: "No compatible",
};

const STRUCTURED_DATE_ROLE_LABELS: Record<PrivacyGateStructuredColumn["dateRole"], string> = {
  none: "Ninguno",
  visit: "Fecha de visita",
  birth: "Fecha de nacimiento",
};

export type PrivacyGateProps = {
  /** The frozen domain job (policy, errors, output availability). */
  readonly job: Job;
  /**
   * The frozen ReviewSession; the single review authority (D-004). For a
   * document-batch job this is the active item's session or `null`; batch
   * readiness comes from the Job, not from this session (T17 #21 SD-9).
   */
  readonly review: ReviewSession | null;
  /**
   * The current per-document ReviewSession authority of a document batch,
   * keyed by original batch index (T17 #21 CORR-B; CORA-89-01). Batch-wide
   * restored-original warnings are derived from this complete set, and the
   * batch Confidential availability is derived from the SAME authority
   * through {@link batchConfidentialAuditReady} — the one shared derivation
   * the batch Result and the Confidential builder consume. `null`/absent
   * for single-document and text jobs (and before a batch holds sessions).
   */
  readonly batchSessions?: Readonly<Record<number, ReviewSession>> | null;
  /**
   * The reviewed structured configuration + exact preparation for a structured
   * job (HARDEN-01 WU-A). Required for `kind === "structured"`; ignored else.
   */
  readonly structured?: PrivacyGateStructuredInput | null;
};

export function PrivacyGate(props: PrivacyGateProps): ReactElement {
  const view = useMemo(
    () =>
      derivePrivacyGateView(
        props.job,
        props.review,
        props.batchSessions ?? null,
        props.structured ?? null
      ),
    [props.job, props.review, props.batchSessions, props.structured]
  );

  // Presentation-only derivation of the checkpoint state from the SAME facts
  // the model already supplies: no new authority, no reinterpretation. The
  // batch blocker (#78) is the ACTIVE failed count: a deliberately removed
  // item is a retained fact, not a still-blocking failure.
  const batchFailed = view.batch !== null && view.batch.activeFailedCount > 0;
  const safeOutputReady = view.safeOutputReady;
  const hasJobErrors = view.errors.length > 0;
  // The applicable output is blocked by the current authority. For a batch the
  // operative checkpoint blocker is the active failed count (a deliberately
  // removed item is retained history); the Safe summary's own readiness is the
  // shared authority fact shown in the Output availability copy below.
  const outputBlocked = view.batch === null ? !safeOutputReady : batchFailed;
  const actionRequired = view.pendingCount > 0 || batchFailed || hasJobErrors || outputBlocked;
  // #78 correction F1: the "Review complete" assertion is gated on the
  // authoritative `view.complete` fact (the Job's derived review completeness,
  // the single source of truth). The boundary case — a batch where every
  // failed document was deliberately removed (nothing pending, no active
  // failure, no job error) but no evaluable document remains — is a
  // not-complete state: the checkpoint states the factual reason without
  // claiming completion and without re-blocking on the resolved failures.
  const batchAllRemovedBoundary = view.batch !== null && !view.complete && !actionRequired;
  const checkpointActionRequired = actionRequired || batchAllRemovedBoundary;
  const hasAttentionFacts = hasJobErrors || view.warnings.length > 0;

  return (
    <section className="sx-gate-workspace" aria-labelledby="privacy-gate-step-heading">
      <header className="max-w-3xl">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-neutral-600">
          Comprobación de privacidad
        </p>
        <h2
          id="privacy-gate-step-heading"
          className="mt-1 font-display text-3xl font-bold tracking-tight text-primary-dark"
        >
          Comprobación de privacidad
        </h2>
        <p className="mt-2 text-base leading-relaxed text-neutral-700">
          Punto de control final de preparación antes de la descarga: qué se trató, qué sigue
          bloqueando la salida segura y qué avisos objetivos quedan por considerar.
        </p>
      </header>

      <GateCheckpoint
        actionRequired={checkpointActionRequired}
        blocked={actionRequired}
        batchAllRemovedBoundary={batchAllRemovedBoundary}
        outputBlocked={outputBlocked}
        safeOutputReady={safeOutputReady}
        pendingCount={view.pendingCount}
        hasJobErrors={hasJobErrors}
        batchFailed={batchFailed}
      />

      {view.pendingCount > 0 && (
        <p
          role="alert"
          className="mt-3 rounded border border-primary-dark bg-surface-light px-3 py-2 text-sm font-semibold text-neutral-800"
        >
          {pendingDecisionMessage(view.pendingCount)}
        </p>
      )}

      {view.batch !== null && view.batch.activeFailedCount > 0 && (
        <p
          role="alert"
          className="mt-3 rounded border border-primary-dark bg-surface-light px-3 py-2 text-sm font-semibold text-neutral-800"
        >
          {batchFailedItemsMessage(view.batch.items)}
        </p>
      )}

      {view.batch !== null && <BatchItems view={view} />}

      <AvailabilityFacts view={view} />

      {view.structured !== null && <StructuredSummary facts={view.structured} />}

      {view.batch === null && view.structured === null && view.complete && (
        <ReviewSummary view={view} />
      )}

      {hasAttentionFacts && (
        <section
          aria-labelledby="attention-facts-heading"
          className="mt-5 rounded-xl border border-primary/30 bg-surface-light p-4"
        >
          <h3
            id="attention-facts-heading"
            className="font-display text-base font-bold text-neutral-800"
          >
            Hechos que requieren atención
          </h3>
          <p className="mt-1 text-sm leading-relaxed text-neutral-700">
            Avisos y errores objetivos que permanecen visibles junto con la revisión. No modifican
            las decisiones de revisión registradas.
          </p>
          {view.errors.length > 0 && <JobErrors view={view} />}
          {view.warnings.length > 0 && <KeptOriginalWarnings view={view} />}
        </section>
      )}
    </section>
  );
}

/**
 * Compact decision checkpoint (UX-PILOT-02). States driven ONLY by the existing
 * facts: "Action required" while the applicable output is blocked by pending
 * decisions / failed batch items / errors, and "Review complete" ONLY when the
 * authoritative review completeness fact says so (#78 correction F1: the
 * completion badge is gated on `view.complete`; the all-documents-removed
 * batch boundary states its factual reason instead of asserting completion).
 * The detailed readiness remains in the Output availability facts below.
 *
 * The body copy discriminates the SAME factual causes (UX-CLOSEOUT-01 outcome
 * C): failed batch items, a genuine job error, pending review decisions, the
 * all-documents-removed batch boundary, and the residual applicable output
 * readiness cause. It never asserts a factual error item when the only cause
 * is pending review (the audit #62 F3 defect) or a failed batch item (a batch
 * fact, not a job `errors` item either), and never re-blocks on an
 * already-resolved failure.
 */
function GateCheckpoint({
  actionRequired,
  blocked,
  batchAllRemovedBoundary,
  outputBlocked,
  safeOutputReady,
  pendingCount,
  hasJobErrors,
  batchFailed,
}: {
  /**
   * The checkpoint's fail-closed state: true while anything is actionable OR
   * while the authoritative review completeness fact is not satisfied (#78
   * correction F1) — "Review complete" is asserted only when this is false.
   */
  actionRequired: boolean;
  /** Whether any blocked-output cause actually applies (drives the body). */
  blocked: boolean;
  /** #78 correction F1: every failed batch document was deliberately removed. */
  batchAllRemovedBoundary: boolean;
  outputBlocked: boolean;
  safeOutputReady: boolean;
  pendingCount: number;
  hasJobErrors: boolean;
  /** The batch has one or more failed items; only meaningful for a batch. */
  batchFailed: boolean;
}): ReactElement {
  // The body names the operative factual cause when output readiness is blocked
  // (UX-CLOSEOUT-01 outcome C). Fail-closed ordering: a failed batch item is
  // named first, then a genuine job error, then pending review decisions, and
  // only then the residual output readiness cause. A factual error item is
  // never asserted unless the job actually carries one.
  const body = blocked
    ? outputBlocked
      ? batchFailed
        ? "La salida segura está bloqueada porque un documento del lote no se pudo procesar; los detalles del fallo y su solución se muestran a continuación."
        : hasJobErrors
          ? "Un error registrado (abajo) necesita atención antes de que confíe en esta revisión."
          : pendingCount === 1
            ? "Todavía queda 1 decisión de revisión obligatoria (abajo) antes de que confíe en esta revisión."
            : pendingCount > 1
              ? `Todavía quedan ${pendingCount} decisiones de revisión obligatorias (abajo) antes de que confíe en esta revisión.`
              : "La salida segura todavía no está disponible: no se cumplen las reglas de preparación de la salida aplicables (abajo)."
      : hasJobErrors
        ? "Un error registrado (abajo) necesita atención antes de que confíe en esta revisión."
        : pendingCount === 1
          ? "Todavía queda 1 decisión de revisión obligatoria (abajo) antes de que confíe en esta revisión."
          : `Todavía quedan ${pendingCount} decisiones de revisión obligatorias (abajo) antes de que confíe en esta revisión.`
    : batchAllRemovedBoundary
      ? "No queda ningún documento del lote disponible para revisión: todos los documentos con error se retiraron deliberadamente. La revisión del lote no está completa."
      : safeOutputReady
        ? "Todas las decisiones de revisión obligatorias están registradas. La salida segura está preparada para descargar en el paso Resultado."
        : "Todas las decisiones de revisión obligatorias están registradas. Consulte la disponibilidad de la salida (abajo) para saber qué entregables están disponibles.";
  return (
    <section
      aria-labelledby="gate-checkpoint-heading"
      className={`sx-gate-checkpoint mt-5 rounded-xl border-2 p-4 ${
        actionRequired ? "border-primary-dark bg-surface-light" : "border-primary/40 bg-white"
      }`}
    >
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <span
          className={`rounded-full px-2.5 py-0.5 text-xs font-semibold uppercase tracking-wide text-white ${
            actionRequired ? "bg-primary-dark" : "bg-surface-dark"
          }`}
        >
          {actionRequired ? "Necesita atención" : "Preparado"}
        </span>
        <h3
          id="gate-checkpoint-heading"
          className="font-display text-lg font-bold text-neutral-800"
        >
          Punto de control de la decisión
        </h3>
      </div>
      <p className="mt-2 text-sm leading-relaxed text-neutral-800">{body}</p>
    </section>
  );
}

/**
 * Factual document-batch item facts (T17 #21 SD-9): every item stays visible
 * with a text status label and, when it failed, its typed message. No
 * hover-only information and no color-only state.
 */
function BatchItems({ view }: { view: PrivacyGateView }): ReactElement | null {
  const batch = view.batch;
  if (batch === null) return null;
  return (
    <section
      aria-label="Documentos del lote"
      className="mt-4 rounded-xl border border-primary/40 bg-white p-4"
    >
      <h3 className="font-display text-base font-bold text-neutral-800">Documentos del lote</h3>
      <dl
        role="group"
        aria-label="Recuentos de documentos del lote"
        className="mt-2 grid grid-cols-3 gap-x-4 gap-y-1 text-sm text-neutral-800"
      >
        <dt className="font-semibold">Pendientes:</dt>
        <dd> {batch.pendingCount}</dd>
        <dt className="font-semibold">Completados:</dt>
        <dd> {batch.completedCount}</dd>
        <dt className="font-semibold">Con error:</dt>
        <dd> {batch.failedCount}</dd>
      </dl>
      <ul
        aria-label="Estado de los documentos del lote"
        className="mt-3 space-y-1 text-sm text-neutral-800"
      >
        {batch.items.map((item) => (
          <li key={item.index}>
            <span className="font-semibold">{item.name}</span>: {BATCH_STATUS_LABELS[item.status]}
            {item.errorMessage !== undefined && (
              <> — {localizeDomainErrorMessage(item.errorMessage)}</>
            )}
            {item.removed === true && <span className="font-semibold"> — Retirado del lote</span>}
            {item.acknowledged === true && (
              <span className="font-semibold"> — Error reconocido</span>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}

/**
 * Factual structured gate facts (HARDEN-01 WU-A): the exact per-column
 * disposition and the fail-closed block reasons (if any). Never a score.
 */
function StructuredSummary({ facts }: { facts: PrivacyGateStructuredFacts }): ReactElement {
  return (
    <section
      aria-label="Datos de la salida estructurada"
      className="mt-4 rounded-xl border border-primary/40 bg-white p-4"
    >
      <h3 className="font-display text-base font-bold text-neutral-800">Salida estructurada</h3>
      <dl
        role="status"
        aria-label="Datos de la salida estructurada"
        className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1 text-sm text-neutral-800"
      >
        <dt className="font-semibold">Columnas:</dt>
        <dd> {facts.columns.length}</dd>
        <dt className="font-semibold">Columnas que requieren revisión:</dt>
        <dd> {facts.columnsRequiringReview}</dd>
        <dt className="font-semibold">Columnas no compatibles:</dt>
        <dd> {facts.blockingCount}</dd>
      </dl>
      {facts.reasons.length > 0 && (
        <ul
          role="alert"
          aria-label="Motivos de bloqueo de la salida estructurada"
          className="mt-3 list-disc space-y-0.5 pl-6 text-sm font-semibold text-neutral-800"
        >
          {facts.reasons.map((reason, index) => (
            <li key={index}>{localizeStructuredBlockReason(reason)}</li>
          ))}
        </ul>
      )}
      <ul
        aria-label="Disposición de las columnas estructuradas"
        className="mt-3 space-y-1 text-sm text-neutral-800"
      >
        {facts.columns.map((column) => (
          <li key={column.columnIndex}>
            <span className="font-semibold">
              {column.header === "" ? "(columna sin nombre)" : column.header}
            </span>
            : {STRUCTURED_DISPOSITION_LABELS[column.disposition]}
            {column.disposition === "date-age"
              ? ` (${STRUCTURED_DATE_ROLE_LABELS[column.dateRole]})`
              : ""}
          </li>
        ))}
      </ul>
    </section>
  );
}

/** Factual policy + output-availability facts (D-005), text-conveyed. */
function AvailabilityFacts({ view }: { view: PrivacyGateView }): ReactElement {
  return (
    <section
      aria-label="Disponibilidad de la salida"
      className="mt-4 rounded-xl border border-primary/40 bg-white p-4"
    >
      <h3 className="font-display text-base font-bold text-neutral-800">
        Disponibilidad de la salida
      </h3>
      <dl
        role="status"
        aria-label="Datos de la disponibilidad de la salida"
        className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1 text-sm text-neutral-800"
      >
        <dt className="font-semibold">Política de privacidad usada:</dt>
        <dd> {POLICY_LABELS[view.policyId]}</dd>
        <dt className="font-semibold">Salida segura:</dt>
        <dd> {view.safeOutputReady ? "Preparada" : "No preparada"}</dd>
        <dt className="font-semibold">Auditoría confidencial:</dt>
        <dd> {view.confidentialAuditReady ? "Disponible" : "No disponible"}</dd>
      </dl>
      {view.batch !== null && (
        <div className="mt-3 space-y-1 text-sm text-neutral-800">
          <p>{batchSafeSummaryAvailabilityMessage(view.safeOutputReady)}</p>
          <p>{batchConfidentialAuditAvailabilityMessage(view.confidentialAuditReady)}</p>
        </div>
      )}
    </section>
  );
}

/** Factual review summary from domain progress: counts, never a score. */
function ReviewSummary({ view }: { view: PrivacyGateView }): ReactElement {
  return (
    <section
      aria-label="Resumen de la revisión"
      className="mt-4 rounded-xl border border-primary/40 bg-white p-4"
    >
      <h3 className="font-display text-base font-bold text-neutral-800">Resumen de la revisión</h3>
      <dl
        role="group"
        aria-label="Datos del resumen de la revisión"
        className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1 text-sm text-neutral-800"
      >
        <dt className="font-semibold">Hallazgos tratados:</dt>
        <dd>
          {view.reviewedAccepted} aceptados, {view.reviewedModified} modificados
        </dd>
        <dt className="font-semibold">Sustituciones aceptadas:</dt>
        <dd> {view.reviewedAccepted}</dd>
        <dt className="font-semibold">Sustituciones modificadas:</dt>
        <dd> {view.reviewedModified}</dd>
        <dt className="font-semibold">Hallazgos manuales:</dt>
        <dd> {view.manualDetections}</dd>
        <dt className="font-semibold">Originales conservados (restaurados):</dt>
        <dd> {view.restoredCount}</dd>
        {view.lowConfidenceCount > 0 && (
          <>
            <dt className="font-semibold">Candidatos de baja confianza:</dt>
            <dd>
              {" "}
              {view.lowConfidenceCount} en total, {view.lowConfidencePendingCount} pendientes
            </dd>
          </>
        )}
      </dl>
    </section>
  );
}

/** Job errors surfaced factually, exactly as the job carries them. */
function JobErrors({ view }: { view: PrivacyGateView }): ReactElement {
  return (
    <section aria-label="Errores del trabajo" className="mt-3">
      <h4 className="font-display text-sm font-bold text-neutral-800">Errores</h4>
      <ul
        aria-label="Errores del trabajo"
        className="mt-1 list-disc space-y-1 pl-5 text-sm text-neutral-800"
      >
        {view.errors.map((error, index) => (
          <li key={index}>
            <span className="font-mono">{error.code}</span> —{" "}
            {localizeDomainErrorMessage(error.message)}
          </li>
        ))}
      </ul>
    </section>
  );
}

/**
 * Kept-original warnings: one factual entry per restored detection. Restored
 * is an explicit completed reviewer decision (SPEC §4) and stays visible
 * here; it is never framed as correspondence leakage.
 */
function KeptOriginalWarnings({ view }: { view: PrivacyGateView }): ReactElement {
  return (
    <section aria-label="Avisos de la comprobación de privacidad" className="mt-3">
      <h4 className="font-display text-sm font-bold text-neutral-800">Avisos</h4>
      <ul
        aria-label="Avisos de originales conservados"
        className="mt-1 list-disc space-y-1 pl-5 text-sm text-neutral-800"
      >
        {view.warnings.map((warning, index) => (
          <li key={index}>
            <span className="font-mono">{warning.code}</span> — {warning.message}
          </li>
        ))}
      </ul>
    </section>
  );
}
