/**
 * Confidential structured correspondence serializer (HARDEN-01 WU-A3).
 *
 * The Confidential Audit is a SEPARATE product from the Safe Structured CSV
 * (CURRENT_DECISIONS D-005 / SPEC §13): it is the only place that carries the
 * original↔transformed correspondence for the accepted date/age,
 * pseudonymize, study-id and remove decisions. It is always marked with the
 * canonical confidential warning line and is never combined with the Safe artifact.
 *
 * Deterministic and memory-only (D-013): no timestamps, no persistence, no
 * logging of values.
 */
import { CONFIDENTIAL_AUDIT_WARNING_LINE } from "../output/confidential-audit-serializer";
import type { StructuredConfidentialCorrespondence } from "./transformed-dataset";

/** Typed serializer failure (fail-closed). */
export class StructuredConfidentialAuditError extends Error {
  readonly code = "INVALID_STRUCTURED_CORRESPONDENCE";

  constructor(message: string) {
    super(message);
    this.name = "StructuredConfidentialAuditError";
  }
}

function isCorrespondence(value: unknown): value is StructuredConfidentialCorrespondence {
  if (typeof value !== "object" || value === null) return false;
  const candidate = value as Partial<StructuredConfidentialCorrespondence>;
  return (
    candidate.kind === "structured-confidential-correspondence" &&
    Array.isArray(candidate.columns) &&
    typeof candidate.totals === "object" &&
    candidate.totals !== null
  );
}

/**
 * Serialize the structured correspondence to a deterministic confidential
 * text artifact. Fails closed on an invalid correspondence value.
 */
export function serializeStructuredConfidentialAudit(correspondence: unknown): string {
  if (!isCorrespondence(correspondence)) {
    throw new StructuredConfidentialAuditError(
      "serializeStructuredConfidentialAudit requires a structurally valid structured correspondence."
    );
  }
  const studyIdCount = correspondence.totals.studyId ?? 0;
  const pseudonymizeCount = correspondence.totals.pseudonymize ?? 0;
  const lines: string[] = [
    CONFIDENTIAL_AUDIT_WARNING_LINE,
    "Structured Confidential Audit — original <-> transformed correspondence.",
    "",
    `Policy: ${correspondence.policyId}`,
    `Columns: ${correspondence.columns.length} (date/age: ${correspondence.totals.dateAge}, pseudonymize: ${pseudonymizeCount}, remove: ${correspondence.totals.remove}${studyIdCount > 0 ? `, study-id: ${studyIdCount}` : ""}) — transformed cells: ${correspondence.totals.transformedCells}`,
    "",
  ];
  for (const column of correspondence.columns) {
    const header = column.header === "" ? "(unnamed column)" : column.header;
    lines.push(`## [${column.columnIndex}] ${header} — ${column.disposition}`);
    for (const entry of column.entries) {
      lines.push(
        `  ${entry.original} -> ${entry.transformed === null ? "(removed)" : entry.transformed}`
      );
    }
    lines.push("");
  }
  return lines.join("\n").trimEnd();
}
