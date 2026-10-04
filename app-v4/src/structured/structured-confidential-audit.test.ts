import { describe, expect, it } from "vitest";

import { CONFIDENTIAL_AUDIT_WARNING_LINE } from "../output/confidential-audit-serializer";
import {
  serializeStructuredConfidentialAudit,
  StructuredConfidentialAuditError,
} from "./structured-confidential-audit";

/**
 * HARDEN-01 WU-A3 oracles: the Confidential correspondence is separate, marked
 * and carries the originals; it fails closed on invalid input.
 */
describe("serializeStructuredConfidentialAudit", () => {
  const correspondence = {
    kind: "structured-confidential-correspondence" as const,
    policyId: "standard",
    columns: [
      {
        columnIndex: 0,
        header: "Paciente",
        disposition: "remove" as const,
        entries: [{ original: "P-001", transformed: null }],
      },
      {
        columnIndex: 3,
        header: "Centro",
        disposition: "pseudonymize" as const,
        entries: [{ original: "Centro A", transformed: "QID_001" }],
      },
    ],
    totals: { dateAge: 0, pseudonymize: 1, remove: 1, transformedCells: 1 },
  };

  it("is marked confidential and carries the original↔transformed correspondence", () => {
    const text = serializeStructuredConfidentialAudit(correspondence);
    expect(text.startsWith(CONFIDENTIAL_AUDIT_WARNING_LINE)).toBe(true);
    expect(text).toContain("Centro A -> QID_001");
    expect(text).toContain("P-001 -> (removed)");
    expect(text).toContain("Policy: standard");
  });

  it("fails closed on an invalid correspondence value", () => {
    expect(() => serializeStructuredConfidentialAudit({ kind: "x" })).toThrowError(
      StructuredConfidentialAuditError
    );
    expect(() => serializeStructuredConfidentialAudit(undefined)).toThrowError(
      /valid structured correspondence/
    );
  });
});
