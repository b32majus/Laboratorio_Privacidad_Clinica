/**
 * Confidential Audit serializer (Work Order T08 U2b, GitHub #12).
 *
 * Deterministic TXT serialization of the CONFIDENTIAL internal
 * traceability artifact, suitable for a `confidential-audit.txt` file,
 * with its explicit confidentiality marking (D-005): every serialized
 * artifact STARTS with CONFIDENTIAL_AUDIT_WARNING_LINE and then renders
 * the authorized original↔replacement mapping (offset-ordered records),
 * the reviewer notes and the decision trace. Multi-line spans are
 * escaped and never truncated.
 *
 * Single review authority (D-004): this module holds no decision,
 * progress or final-text logic. It is a pure projection of the data
 * contract and builder delivered by Work Order T08 U2a
 * (./confidential-audit), whose typed guard it reuses.
 *
 * Fail-closed (D-009): serialization rejects any value that is not a
 * structurally valid Confidential Audit — via the U2a guard
 * isConfidentialAudit — throwing the typed ConfidentialAuditError.
 *
 * Privacy: memory-only pure functions; no module-level mutable state, no
 * persistence, no logging, no network. No anonymity, compliance or
 * certification wording anywhere (D-006): the artifact is an internal
 * traceability file, unmistakably marked confidential.
 */
import {
  type ConfidentialAudit,
  ConfidentialAuditError,
  isConfidentialAudit,
} from "./confidential-audit";

/** First line of every serialized artifact (explicit confidentiality warning). */
export const CONFIDENTIAL_AUDIT_WARNING_LINE = "CONFIDENTIAL — INTERNAL AUDIT ARTIFACT";

/**
 * Inline a text value for the single-line mapping records: line breaks
 * are escaped (never truncated) so the record layout stays deterministic
 * regardless of the source span's content.
 */
function inline(value: string): string {
  return value.replace(/\\/g, "\\\\").replace(/\r/g, "\\r").replace(/\n/g, "\\n");
}

/**
 * Deterministic TXT serialization for a `confidential-audit.txt`
 * artifact. The output STARTS with the explicit confidentiality warning
 * line and renders the authorized mapping table and the decision trace.
 * Fails closed on any value that is not a structurally valid
 * Confidential Audit. No anonymity, compliance or certification wording.
 */
export function serializeConfidentialAudit(audit: ConfidentialAudit): string {
  if (!isConfidentialAudit(audit)) {
    throw new ConfidentialAuditError(
      "INVALID_CONFIDENTIAL_AUDIT",
      "serializeConfidentialAudit requires a structurally valid Confidential Audit."
    );
  }
  const t = audit.trace;
  const lines: string[] = [
    CONFIDENTIAL_AUDIT_WARNING_LINE,
    "This document contains original sensitive values and their replacements.",
    "It is an internal traceability artifact, separate from the Safe Output",
    "product, and must never be delivered to a safe destination.",
    "",
    `Session: ${audit.sessionId}`,
    `Review state: ${t.canFinalize ? "complete" : "in progress"}`,
    "",
    "Decision trace",
    "--------------",
    `total: ${t.total}`,
    `accepted: ${t.accepted}`,
    `modified: ${t.modified}`,
    `restored (kept original): ${t.restored}`,
    `pending: ${t.pending}`,
    `manual detections: ${t.manual}`,
    "",
    "Original ↔ replacement mapping",
    "------------------------------",
  ];
  audit.mapping.forEach((entry, index) => {
    lines.push(
      `[${index + 1}] offsets ${entry.start}-${entry.end} type=${entry.type} status=${entry.status}`
    );
    lines.push(`    original: ${inline(entry.original)}`);
    if (entry.proposed !== undefined) {
      lines.push(`    proposed: ${inline(entry.proposed)}`);
    }
    lines.push(
      `    applied: ${
        entry.replacement !== undefined
          ? inline(entry.replacement)
          : entry.status === "not-required"
            ? // Factually per status (ARCH-011): review was never required, so the
              // placeholder must not claim that a decision is pending.
              "(none — review not required)"
            : "(none — decision pending)"
      }`
    );
    if (entry.keptOriginal) {
      lines.push("    kept original: yes (explicit restored decision)");
    }
    if (entry.note !== undefined) {
      lines.push(`    reviewer note: ${inline(entry.note)}`);
    }
  });
  return lines.join("\n") + "\n";
}
