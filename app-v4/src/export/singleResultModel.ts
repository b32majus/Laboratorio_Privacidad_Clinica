/**
 * Single-item Result readiness model (REC-05 WU-B, D-024).
 *
 * Pure, DOM-free derivation of the human Answer for a `text` (pasted-text) or
 * single `document` Job: `ready` / `needs attention` / `blocked`, the canonical
 * Safe payload and the factual kept-original facts. It consumes ONLY existing
 * review/Job authorities (D-004/D-009) — it never re-implements pending logic,
 * recomputes final text or invents a second source of truth.
 *
 * Job ↔ ReviewSession correspondence is checked fail-closed: the canonical Safe
 * payload exists only when the current Job's derived `safeOutputReady` fact
 * still agrees with the ReviewSession's `canFinalize` fact AND finalization
 * succeeds. A disagreement (stale/mismatched pair) yields no payload.
 *
 * Privacy: memory-only, no logging, no network, no persistence. Ordinary copy
 * is Spanish professional language (PDR-08) and carries no Privacy Gate,
 * serializer, ReviewSession, source-offset or Class→Action vocabulary.
 */
import type { Job } from "../domain/job";
import { buildSafeOutput, serializeSafeOutput } from "../output/safe-output";
import { canFinalize, getProgress, type ReviewSession } from "../review/review-domain";

/** The three human Result states, kept deliberately distinguishable (D-024/§8). */
export type SingleResultState = "ready" | "needs-attention" | "blocked";

/** The material the Result is prepared for; drives the primary action. */
export type SingleResultMaterial = "text" | "document";

/** A deliberately kept original (ReviewSession `restored` fact, verbatim type). */
export type KeptOriginalFact = {
  readonly type: string;
};

export type SingleResultView = {
  readonly state: SingleResultState;
  readonly material: SingleResultMaterial;
  /** Mandatory review decisions still pending (0 when none). */
  readonly pendingCount: number;
  /** Deliberately kept originals, exactly as ReviewSession records them. */
  readonly keptOriginals: readonly KeptOriginalFact[];
  /** Canonical Safe payload; non-null ONLY in the `ready` state. */
  readonly safeText: string | null;
  /** Factual Spanish reason shown when the state is `needs-attention`. */
  readonly attentionMessage: string | null;
  /** Factual Spanish reason shown when the state is `blocked`. */
  readonly blockedMessage: string | null;
};

function pendingDecisionsMessage(pendingCount: number): string {
  return pendingCount === 1
    ? "Queda 1 decisión de revisión obligatoria antes de poder preparar el resultado."
    : `Quedan ${pendingCount} decisiones de revisión obligatorias antes de poder preparar el resultado.`;
}

function blockedMessageFor(job: Job): string {
  if (job.processing === "failed" || job.processing === "unknown") {
    return "El procesamiento de esta información no se completó. Vuelve a la revisión para reintentarlo.";
  }
  return "El resultado preparado todavía no está disponible para este trabajo.";
}

/**
 * Derive the single-item Result view from the current Job and ReviewSession.
 * Never throws and never fabricates a payload: a blocked/attention state always
 * yields `safeText === null`.
 */
export function deriveSingleResultView(job: Job, review: ReviewSession | null): SingleResultView {
  const material: SingleResultMaterial = job.kind === "document" ? "document" : "text";

  if (review === null) {
    return {
      state: "blocked",
      material,
      pendingCount: 0,
      keptOriginals: [],
      safeText: null,
      attentionMessage: null,
      blockedMessage: blockedMessageFor(job),
    };
  }

  const progress = getProgress(review);
  const keptOriginals = Object.freeze(
    progress.restoredDetections.map((detection) => Object.freeze({ type: detection.type }))
  );
  const base = {
    material,
    pendingCount: progress.pending,
    keptOriginals,
  } as const;

  // Job ↔ review correspondence is valid only while the Job's derived
  // readiness fact and the ReviewSession's own finalization fact agree.
  const correspondenceValid = job.outputs.safeOutputReady === canFinalize(review);

  if (correspondenceValid && job.outputs.safeOutputReady && canFinalize(review)) {
    try {
      const safeText = serializeSafeOutput(buildSafeOutput(review));
      return {
        ...base,
        state: "ready",
        safeText,
        attentionMessage: null,
        blockedMessage: null,
      };
    } catch {
      return {
        ...base,
        state: "blocked",
        safeText: null,
        attentionMessage: null,
        blockedMessage: blockedMessageFor(job),
      };
    }
  }

  if (progress.pending > 0) {
    return {
      ...base,
      state: "needs-attention",
      safeText: null,
      attentionMessage: pendingDecisionsMessage(progress.pending),
      blockedMessage: null,
    };
  }

  return {
    ...base,
    state: "blocked",
    safeText: null,
    attentionMessage: null,
    blockedMessage: blockedMessageFor(job),
  };
}
