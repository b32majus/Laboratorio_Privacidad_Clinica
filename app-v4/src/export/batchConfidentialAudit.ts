/**
 * Batch Confidential Audit artifact (REC-07 #89): the ONE deliberately
 * separate batch Confidential TXT (`auditoria-confidencial-lote.txt`).
 *
 * Pure, DOM-free derivation + deterministic TXT composition over the
 * accepted batch authorities — never a second readiness/state machine and
 * never a new correspondence authority:
 *
 * - Per-item Confidential material comes ONLY from each completed item's
 *   finalizable `ReviewSession` through the canonical
 *   `buildConfidentialAudit(...)` + `serializeConfidentialAudit(...)`
 *   authorities (original↔replacement mapping, decision trace, notes,
 *   restored entries). No privacy transform is rerun and no Safe text is
 *   reconstructed: ordinary kept/non-detected clinical text that exists
 *   only in Safe output is NOT copied here.
 * - Authorization reuses the ONE shared batch readiness prerequisite
 *   (`batchSafeSummaryReady(...)`) AND additionally requires the exact
 *   current per-item session set for every completed item, each still
 *   finalizable (`canFinalize`). Missing/stale/non-finalizable session
 *   authority fails closed with a typed error and zero bytes. The whole
 *   authorization is the ONE shared batch-Confidential availability
 *   authority (`batchConfidentialAuditReady(...)` — CORA-89-01), which the
 *   Privacy Gate and the batch Result also consume, and it is re-checked
 *   before any composed bytes are returned. A
 *   `job.outputs.confidentialAuditReady` mirror is never sufficient by
 *   itself.
 * - One deterministic section per ORIGINAL batch index. A deliberately
 *   removed failed item contributes only bounded non-sensitive
 *   ordinal/disposition metadata — no fabricated audit body, no session
 *   reference, never relabelled `completed`.
 * - Section labels are stable original-index ordinals (`Documento N`,
 *   shared with the consolidated Safe PDF's index vocabulary). Source
 *   filenames never appear: they are not Confidential correspondence
 *   authority and can themselves identify a patient.
 * - The composed artifact starts with the canonical
 *   `CONFIDENTIAL_AUDIT_WARNING_LINE` and every audited section embeds the
 *   canonical per-session serialized bytes verbatim.
 *
 * Memory-only, no logging of content, no network, no persistence (D-013).
 */

import { batchSafeSummaryReady, type Job } from "../domain/job";
import { batchConfidentialAuditReady, deriveBatchFacts } from "../privacy-gate/privacyGateModel";
import { buildConfidentialAudit, type ConfidentialAudit } from "../output/confidential-audit";
import {
  serializeConfidentialAudit,
  CONFIDENTIAL_AUDIT_WARNING_LINE,
} from "../output/confidential-audit-serializer";
import { canFinalize, type ReviewSession } from "../review/review-domain";
import { batchSafeDocumentLabel } from "./batchSafeDeliverables";

/** Deterministic Spanish filename of the batch Confidential Audit TXT. */
export const BATCH_CONFIDENTIAL_AUDIT_FILENAME = "auditoria-confidencial-lote.txt";

/** Typed fail-closed refusal: the batch Confidential artifact is not authorized. */
export class BatchConfidentialAuditError extends Error {
  readonly code = "BATCH_CONFIDENTIAL_NOT_AUTHORIZED";

  constructor(message: string) {
    super(message);
    this.name = "BatchConfidentialAuditError";
  }
}

/**
 * One section of the batch Confidential artifact, keyed by the stable
 * 1-based original batch index. An audited section carries the canonical
 * per-item `ConfidentialAudit`; a deliberately removed failed item carries
 * NO audit body at all.
 */
export type BatchConfidentialAuditSection =
  | {
      readonly batchIndex: number;
      readonly kind: "audited";
      readonly audit: ConfidentialAudit;
    }
  | {
      readonly batchIndex: number;
      readonly kind: "removed";
    };

/**
 * Derive the batch Confidential sections of a READY batch in original
 * selection order. Fails closed with a typed error (zero bytes downstream)
 * unless:
 *
 * 1. the batch is authorized by the ONE shared readiness authority
 *    (`batchSafeSummaryReady`) — the accepted batch ready prerequisite;
 * 2. the per-item session set is available;
 * 3. EVERY completed item holds its exact current, still-finalizable
 *    session (a missing, stale or non-finalizable session refuses the whole
 *    artifact — a job-side availability mirror alone never authorizes
 *    bytes);
 * 4. every other item is a deliberately removed failed item (bounded
 *    ordinal/disposition metadata only).
 *
 * `sessionsByIndex` is the bridge-held per-item session set keyed by the
 * original batch index (the same `batchSessions` authority App holds); it
 * is matched by index, never by filename.
 */
export function deriveBatchConfidentialAuditSections(
  job: Job,
  sessionsByIndex: Readonly<Record<number, ReviewSession>> | null
): readonly BatchConfidentialAuditSection[] {
  if (!batchSafeSummaryReady(job)) {
    throw new BatchConfidentialAuditError(
      "deriveBatchConfidentialAuditSections refuses to derive: the batch Confidential Audit " +
        "is not authorized while the review is incomplete, the derived completeness " +
        "disagrees, or an active batch error remains."
    );
  }
  if (sessionsByIndex === null) {
    throw new BatchConfidentialAuditError(
      "deriveBatchConfidentialAuditSections refuses to derive: no per-document review " +
        "authority is available, so no current Confidential Audit can be composed."
    );
  }
  const facts = deriveBatchFacts(job);
  const sections: BatchConfidentialAuditSection[] = [];
  facts.items.forEach((item, position) => {
    const batchIndex = position + 1;
    if (item.status === "completed") {
      const session = sessionsByIndex[position];
      if (session === undefined) {
        throw new BatchConfidentialAuditError(
          `deriveBatchConfidentialAuditSections refuses batch item ${batchIndex}: the item is ` +
            `completed but its exact current review session is not available, so no ` +
            `Confidential Audit can be composed for it.`
        );
      }
      // Fail-closed finalizability: the batch artifact is authorized only
      // while every completed item's session is still finalizable. A stale
      // or mutated session (review re-opened) refuses with zero bytes.
      if (!canFinalize(session)) {
        throw new BatchConfidentialAuditError(
          `deriveBatchConfidentialAuditSections refuses batch item ${batchIndex}: its review ` +
            `session is no longer finalizable, so no Confidential Audit can be composed.`
        );
      }
      // Canonical per-item Confidential material — the only correspondence
      // authority (original↔replacement mapping, decisions, notes, restored
      // entries). No Safe-only text is harvested here.
      sections.push({ batchIndex, kind: "audited", audit: buildConfidentialAudit(session) });
      return;
    }
    if (item.status === "error" && item.removed === true) {
      // Deliberately removed failed item: bounded ordinal/disposition
      // metadata only — no fabricated audit body, never `completed`.
      sections.push({ batchIndex, kind: "removed" });
      return;
    }
    throw new BatchConfidentialAuditError(
      `deriveBatchConfidentialAuditSections refuses batch item ${batchIndex}: the batch ` +
        `Confidential Audit is authorized only when every item is completed with its ` +
        `current finalizable session or deliberately removed.`
    );
  });
  if (sections.length === 0) {
    throw new BatchConfidentialAuditError(
      "deriveBatchConfidentialAuditSections refuses to derive: the batch holds no " +
        "Confidential section."
    );
  }
  // CORA-89-01: final agreement with the ONE shared batch-Confidential
  // availability authority (`batchConfidentialAuditReady`) — the exact same
  // derivation the Privacy Gate and the batch Result consume. The granular
  // checks above already enforce every fact it covers, so this is
  // defense-in-depth against drift, not a weaker duplicate: the composed
  // artifact is returned ONLY when the shared authority also authorizes it,
  // and any disagreement fails closed with zero bytes.
  if (!batchConfidentialAuditReady(job, sessionsByIndex)) {
    throw new BatchConfidentialAuditError(
      "deriveBatchConfidentialAuditSections refuses to derive: the ONE shared " +
        "batch-Confidential availability authority refuses this batch, so no " +
        "Confidential Audit may be composed."
    );
  }
  return Object.freeze(sections);
}

/**
 * Compose the deterministic batch Confidential TXT. The artifact starts
 * with the canonical confidentiality warning line, names every original
 * batch index with the stable ordinal label, and embeds each completed
 * item's canonical serialized audit verbatim. A deliberately removed item
 * appears only as its bounded ordinal/disposition metadata line.
 */
function composeBatchConfidentialSections(
  sections: readonly BatchConfidentialAuditSection[]
): string {
  const lines: string[] = [CONFIDENTIAL_AUDIT_WARNING_LINE];
  lines.push("Auditoría confidencial del lote — correspondencia original ↔ reemplazo");
  lines.push(
    "Registro interno de trazabilidad por documento; nunca debe entregarse a un destino seguro."
  );
  lines.push("");
  sections.forEach((section) => {
    lines.push(batchSafeDocumentLabel(section.batchIndex));
    if (section.kind === "audited") {
      // Canonical serialized bytes of the canonical per-item audit.
      lines.push(serializeConfidentialAudit(section.audit).trimEnd());
    } else {
      lines.push("Estado: error (retirado del lote; sin cuerpo de auditoría).");
    }
    lines.push("");
  });
  return lines.join("\n");
}

/**
 * Build the batch Confidential Audit TXT bytes. The generation path is
 * deliberately asynchronous — exactly like the batch Safe ZIP/PDF builders
 * — so the accepted disposal/current-authority proof (completion after
 * unmount, or authority invalidation during the awaited generation window)
 * runs on the REAL production path, never only in tests. Composition
 * itself is synchronous, deterministic and memory-only.
 */
export async function buildBatchConfidentialAuditText(
  job: Job,
  sessionsByIndex: Readonly<Record<number, ReviewSession>> | null
): Promise<string> {
  // Fail-closed authorization first: an unauthorized batch produces zero
  // bytes before any awaited window opens.
  const sections = deriveBatchConfidentialAuditSections(job, sessionsByIndex);
  await Promise.resolve();
  return composeBatchConfidentialSections(sections);
}
