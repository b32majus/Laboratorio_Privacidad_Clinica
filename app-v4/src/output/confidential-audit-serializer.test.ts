import { describe, expect, it } from "vitest";

import { applyDecision, createReviewSession, type ReviewSession } from "../review/review-domain";
import {
  buildConfidentialAudit,
  ConfidentialAuditError,
  type ConfidentialAudit,
} from "./confidential-audit";
import {
  CONFIDENTIAL_AUDIT_WARNING_LINE,
  serializeConfidentialAudit,
} from "./confidential-audit-serializer";

/**
 * Deterministic serialization oracle for Work Order T08 U2b (Confidential
 * Audit serializer + explicit confidentiality marking). All fixtures are
 * synthetic Spanish/English clinical-style text; no real content anywhere.
 *
 * The oracle asserts the serialized artifact's STRUCTURE — warning-first
 * line, offset-ordered mapping records, trace section, escaped multi-line
 * spans, fail-closed rejection of planted violations — never by substring
 * scans of leakage logic. The source text deliberately contains the word
 * "note" (also used as audit metadata key) and must never trip anything.
 * The data contract, builder and structural guard are the approved U2a
 * surface (./confidential-audit); audits are always built through
 * buildConfidentialAudit.
 */

const SOURCE = "Patient note: Carmen Sánchez, tel. 612345678, NHC 2024/089756.";
const NAME_START = SOURCE.indexOf("Carmen Sánchez");
const NAME_END = NAME_START + "Carmen Sánchez".length;
const PHONE_START = SOURCE.indexOf("612345678");
const PHONE_END = PHONE_START + "612345678".length;
const NHC_START = SOURCE.indexOf("2024/089756");
const NHC_END = NHC_START + "2024/089756".length;

/**
 * Detections are deliberately listed out of source-offset order (NHC,
 * name, phone) so deterministic offset ordering is exercised.
 */
function adversarialSession(): ReviewSession {
  return createReviewSession({
    originalText: SOURCE,
    detections: [
      {
        type: "IDENTIFICADOR",
        start: NHC_START,
        end: NHC_END,
        confidence: 0.9,
        proposed: "ID-1",
        note: "NHC sintética del fixture",
        requiresReview: true,
      },
      {
        type: "NOMBRE",
        start: NAME_START,
        end: NAME_END,
        confidence: 0.95,
        proposed: "PACIENTE-1",
        reason: "regex NombrePropio",
        note: "nota interna de revisión: verificar apellidos",
        requiresReview: true,
      },
      {
        type: "IDENTIFICADOR",
        start: PHONE_START,
        end: PHONE_END,
        confidence: 0.6,
        proposed: "",
        note: "teléfono sintético sin código de país",
        requiresReview: true,
      },
    ],
    sessionId: "confidential-audit-test-session",
  });
}

/** Fully decided session mixing accepted, modified and restored (with notes). */
function completedSession(): ReviewSession {
  const session = adversarialSession();
  const [nhc, name, phone] = session.detections;
  let next = applyDecision(session, name.id, "accepted");
  next = applyDecision(next, phone.id, "modified", {
    replacement: "TEL-REEMPLAZO",
    note: "sin código de país en la fuente",
  });
  next = applyDecision(next, nhc.id, "restored", {
    note: "conservado a petición del servicio clínico",
  });
  return next;
}

describe("explicit confidentiality marking (D-005)", () => {
  it("every serialized artifact starts with the warning line", () => {
    const output = serializeConfidentialAudit(buildConfidentialAudit(completedSession()));
    expect(output.startsWith(CONFIDENTIAL_AUDIT_WARNING_LINE)).toBe(true);
    expect(output.startsWith("CONFIDENTIAL — INTERNAL AUDIT ARTIFACT")).toBe(true);
    const firstLineEnd = output.indexOf("\n");
    expect(output.slice(0, firstLineEnd)).toBe(CONFIDENTIAL_AUDIT_WARNING_LINE);
  });

  it("serialized artifact carries no anonymity/compliance vocabulary (D-006)", () => {
    // Vocabulary-policy regression check, not a separation mechanism: the
    // oracle's assertions elsewhere in this file are purely structural.
    const output = serializeConfidentialAudit(buildConfidentialAudit(completedSession()));
    expect(output).not.toContain("anonimizado");
    expect(output.toLowerCase()).not.toContain("anonymous");
    expect(output.toLowerCase()).not.toContain("gdpr");
  });
});

describe("deterministic serialization", () => {
  it("is byte-stable across repeated calls and renders mapping and trace", () => {
    const audit = buildConfidentialAudit(completedSession());
    const first = serializeConfidentialAudit(audit);
    const second = serializeConfidentialAudit(audit);
    expect(first).toBe(second);

    expect(first).toContain("Original ↔ replacement mapping");
    expect(first).toContain("Decision trace");
    expect(first).toContain("offsets");
    expect(first).toContain("type=NOMBRE status=accepted");
    expect(first).toContain("type=IDENTIFICADOR status=restored");
    expect(first).toContain("kept original: yes (explicit restored decision)");
    expect(first).toContain("reviewer note: sin código de país en la fuente");
    // Records appear in source-offset order.
    const nameRecord = first.indexOf("type=NOMBRE");
    const phoneRecord = first.indexOf("type=IDENTIFICADOR status=modified");
    const nhcRecord = first.indexOf("type=IDENTIFICADOR status=restored");
    expect(nameRecord).toBeGreaterThan(-1);
    expect(phoneRecord).toBeGreaterThan(nameRecord);
    expect(nhcRecord).toBeGreaterThan(phoneRecord);
  });

  it("renders one mapping record per detection, offset-ordered, with its trace counts", () => {
    const audit = buildConfidentialAudit(completedSession());
    const output = serializeConfidentialAudit(audit);
    // One header line per mapping entry, in the audit's offset order.
    const recordLines = output.split("\n").filter((line) => /^\[\d+\] offsets /.test(line));
    expect(recordLines.length).toBe(audit.mapping.length);
    expect(recordLines).toEqual([
      `[1] offsets ${NAME_START}-${NAME_END} type=NOMBRE status=accepted`,
      `[2] offsets ${PHONE_START}-${PHONE_END} type=IDENTIFICADOR status=modified`,
      `[3] offsets ${NHC_START}-${NHC_END} type=IDENTIFICADOR status=restored`,
    ]);
    expect(output).toContain("total: 3");
    expect(output).toContain("accepted: 1");
    expect(output).toContain("modified: 1");
    expect(output).toContain("restored (kept original): 1");
    expect(output).toContain("pending: 0");
  });

  it("escapes multi-line source spans without truncating them", () => {
    // The span itself spans a line break (offsets 6-20 = "Carmen\nSánchez").
    const session = createReviewSession({
      originalText: "line1\nCarmen\nSánchez\nline3",
      detections: [
        {
          type: "NOMBRE",
          start: 6,
          end: 20,
          proposed: "PACIENTE-1",
          requiresReview: true,
        },
      ],
      sessionId: "multiline-fixture",
    });
    const decided = applyDecision(session, session.detections[0].id, "accepted");
    const audit = buildConfidentialAudit(decided);
    expect(audit.mapping[0]?.original).toBe("Carmen\nSánchez");
    const output = serializeConfidentialAudit(audit);
    expect(output).toContain("original: Carmen\\nSánchez");
    expect(output).toContain("applied: PACIENTE-1");
    // Escaped, never truncated: the record stays a single line.
    const originalLine = output.split("\n").find((line) => line.includes("original:"));
    expect(originalLine).toBe("    original: Carmen\\nSánchez");
  });

  it("escapes carriage returns and backslashes too, never truncating content", () => {
    const session = createReviewSession({
      originalText: "C:\\temp\r\nDIRECCION-1",
      detections: [
        {
          type: "DIRECCION",
          start: 0,
          end: 20,
          proposed: "DIR-1",
          requiresReview: true,
        },
      ],
      sessionId: "escape-fixture",
    });
    const decided = applyDecision(session, session.detections[0].id, "accepted");
    const output = serializeConfidentialAudit(buildConfidentialAudit(decided));
    expect(output).toContain("original: C:\\\\temp\\r\\nDIRECCION-1");
  });
});

describe("pending sessions: traceability in the serialized artifact", () => {
  it("the pending session serializes as in progress with placeholder applied values", () => {
    const session = adversarialSession(); // nothing decided yet
    const output = serializeConfidentialAudit(buildConfidentialAudit(session));
    expect(output).toContain("Review state: in progress");
    expect(output).toContain("pending: 3");
    expect(output).toContain("(none — decision pending)");
    // The source word "note" never trips anything: reviewer notes render.
    expect(output).toContain("reviewer note: nota interna de revisión: verificar apellidos");
  });

  it("shows exactly the remaining pending decisions in a partial session", () => {
    const session = adversarialSession();
    const [, name] = session.detections;
    const partial = applyDecision(session, name.id, "accepted");
    const output = serializeConfidentialAudit(buildConfidentialAudit(partial));
    expect(output).toContain("status=pending");
    expect(output).toContain("status=accepted");
  });

  it("the completed session serializes as complete", () => {
    const output = serializeConfidentialAudit(buildConfidentialAudit(completedSession()));
    expect(output).toContain("Review state: complete");
  });
});

describe("fail-closed serialization (D-009)", () => {
  it("rejects values that are not structurally valid audits with the typed error", () => {
    const audit = buildConfidentialAudit(completedSession());
    // Wrong shapes and non-object values.
    expect(() =>
      serializeConfidentialAudit(undefined as unknown as ConfidentialAudit)
    ).toThrowError(ConfidentialAuditError);
    expect(() => serializeConfidentialAudit(null as unknown as ConfidentialAudit)).toThrowError(
      ConfidentialAuditError
    );
    expect(() =>
      serializeConfidentialAudit("confidential-audit" as unknown as ConfidentialAudit)
    ).toThrowError(ConfidentialAuditError);
    expect(() => serializeConfidentialAudit([audit] as unknown as ConfidentialAudit)).toThrowError(
      ConfidentialAuditError
    );
    // Planted demoted confidentiality marking.
    expect(() =>
      serializeConfidentialAudit({ ...audit, confidential: false } as unknown as ConfidentialAudit)
    ).toThrowError(ConfidentialAuditError);
    // Planted audit missing an authorized key.
    const withoutTrace: Record<string, unknown> = { ...audit };
    delete withoutTrace.trace;
    expect(() =>
      serializeConfidentialAudit(withoutTrace as unknown as ConfidentialAudit)
    ).toThrowError(ConfidentialAuditError);
    // Planted audit with a wrong-typed trace count.
    expect(() =>
      serializeConfidentialAudit({
        ...audit,
        trace: { ...audit.trace, pending: "3" },
      } as unknown as ConfidentialAudit)
    ).toThrowError(ConfidentialAuditError);
    // Planted audit whose mapping entries are not correspondence records.
    expect(() =>
      serializeConfidentialAudit({
        ...audit,
        mapping: ["Carmen Sánchez -> PACIENTE-1"],
      } as unknown as ConfidentialAudit)
    ).toThrowError(ConfidentialAuditError);
    expect(() =>
      serializeConfidentialAudit({ ...audit, mapping: [null] } as unknown as ConfidentialAudit)
    ).toThrowError(ConfidentialAuditError);
    // The typed error carries the fail-closed code.
    try {
      serializeConfidentialAudit({ ...audit, extra: 1 } as unknown as ConfidentialAudit);
      throw new Error("expected serializeConfidentialAudit to throw");
    } catch (error) {
      expect(error).toBeInstanceOf(ConfidentialAuditError);
      expect((error as ConfidentialAuditError).code).toBe("INVALID_CONFIDENTIAL_AUDIT");
    }
  });
});

describe("ARCH-011 optional-review coherence in the serialized artifact (T11 #15 WU4)", () => {
  const OPTIONAL_SOURCE = "Dato sintético: XYZ-0042 en la nota clínica.";
  const CODE_START = OPTIONAL_SOURCE.indexOf("XYZ-0042");

  function optionalUndecidedSession(): ReviewSession {
    return createReviewSession({
      originalText: OPTIONAL_SOURCE,
      sessionId: "optional-undecided-serializer-session",
      detections: [
        {
          type: "CODIGO",
          start: CODE_START,
          end: CODE_START + "XYZ-0042".length,
          proposed: "COD-1",
          requiresReview: false,
        },
      ],
    });
  }

  it("renders the not-required status factually, never as pending", () => {
    const output = serializeConfidentialAudit(buildConfidentialAudit(optionalUndecidedSession()));
    expect(output).toContain("status=not-required");
    expect(output).not.toContain("status=pending");
    // The applied-value placeholder is factual per status: review was never
    // required, so it must not claim a decision is pending.
    expect(output).toContain("(none — review not required)");
    expect(output).not.toContain("(none — decision pending)");
    // The aggregate trace is coherent: nothing pending, export open.
    expect(output).toContain("pending: 0");
    expect(output).toContain("Review state: complete");
    // The original span is still rendered in full, never truncated.
    expect(output).toContain("original: XYZ-0042");
  });

  it("pending entries keep their factual placeholder wording", () => {
    const session = createReviewSession({
      originalText: OPTIONAL_SOURCE,
      sessionId: "mandatory-pending-serializer-session",
      detections: [
        {
          type: "CODIGO",
          start: CODE_START,
          end: CODE_START + "XYZ-0042".length,
          proposed: "COD-1",
          requiresReview: true,
        },
      ],
    });
    const output = serializeConfidentialAudit(buildConfidentialAudit(session));
    expect(output).toContain("status=pending");
    expect(output).toContain("(none — decision pending)");
    expect(output).not.toContain("status=not-required");
  });

  it("rejects the OLD contradictory derivation fail-closed (the oracle can disagree)", () => {
    // Hand-built audit with the OLD shape: mapping entry claims "pending" for
    // an optional undecided detection while trace.pending=0/canFinalize=true.
    const realAudit = buildConfidentialAudit(optionalUndecidedSession());
    const oldDerivationAudit = {
      ...realAudit,
      mapping: [{ ...realAudit.mapping[0], status: "pending" as const }],
    } as unknown as ConfidentialAudit;
    expect(() => serializeConfidentialAudit(oldDerivationAudit)).toThrowError(
      ConfidentialAuditError
    );
  });
});
