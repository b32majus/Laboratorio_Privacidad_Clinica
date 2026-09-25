import { describe, expect, it } from "vitest";

import {
  applyDecision,
  createReviewSession,
  getFinalText,
  getProgress,
  type ReviewSession,
} from "../review/review-domain";
import { buildSafeOutput, isSafeOutput, type SafeOutput } from "./safe-output";
import {
  buildConfidentialAudit,
  isConfidentialAudit,
  type ConfidentialAudit,
  type ConfidentialAuditEntry,
} from "./confidential-audit";

/**
 * Separation oracle for Work Order T08 U2a (Confidential Audit data
 * contract + builder). All fixtures are synthetic Spanish/English
 * clinical-style text; no real content anywhere.
 *
 * The Safe Output ↔ Confidential Audit separation is proven STRUCTURALLY
 * (own enumerable key sets + value shapes), never by substring scans: a
 * planted cross-product violation must fail the same assertion the real
 * artifacts must pass, so this oracle can genuinely disagree with the
 * implementation. The source text deliberately contains the word "note"
 * (also used as audit metadata key) and must never trip the separation.
 * The deterministic-serialization oracle arrives with the U2b serializer
 * (confidential-audit-serializer.ts).
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

/** Structural assertion the real audit must pass and planted violations must fail. */
function assertStructuralConfidentialAudit(value: unknown): void {
  const failures: string[] = [];
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new Error("structural violation: Confidential Audit must be a plain object");
  }
  const keys = Object.keys(value).sort();
  const allowed = ["confidential", "kind", "mapping", "restoredEntries", "sessionId", "trace"];
  if (keys.length !== allowed.length || keys.some((k, i) => k !== allowed[i])) {
    failures.push(
      `own enumerable keys must be exactly ${JSON.stringify(allowed)}, got ${JSON.stringify(keys)}`
    );
  }
  const audit = value as Record<string, unknown>;
  if (audit.kind !== "confidential-audit") {
    failures.push('kind must be "confidential-audit"');
  }
  if (audit.confidential !== true) {
    failures.push("the explicit confidential marking must be true");
  }
  if (typeof audit.sessionId !== "string") {
    failures.push("sessionId must be a string");
  }
  const trace = audit.trace;
  if (typeof trace !== "object" || trace === null || Array.isArray(trace)) {
    failures.push("trace must be a plain object");
  } else {
    const traceKeys = Object.keys(trace).sort();
    const traceAllowed = [
      "accepted",
      "canFinalize",
      "manual",
      "modified",
      "pending",
      "restored",
      "total",
    ];
    if (
      traceKeys.length !== traceAllowed.length ||
      traceKeys.some((k, i) => k !== traceAllowed[i])
    ) {
      failures.push(`trace keys must be exactly ${JSON.stringify(traceAllowed)}`);
    }
    for (const [key, v] of Object.entries(trace)) {
      if (key === "canFinalize" ? typeof v !== "boolean" : typeof v !== "number") {
        failures.push(`trace.${key} has the wrong primitive type`);
      }
    }
  }
  const entryRequired = ["detectionId", "end", "keptOriginal", "original", "start", "status"];
  const statuses = ["pending", "accepted", "modified", "restored", "not-required"];
  for (const listKey of ["mapping", "restoredEntries"] as const) {
    const list = audit[listKey];
    if (!Array.isArray(list)) {
      failures.push(`${listKey} must be an array`);
      continue;
    }
    for (const entry of list) {
      if (typeof entry !== "object" || entry === null || Array.isArray(entry)) {
        failures.push(`${listKey} entry is not a plain object`);
        continue;
      }
      const entryKeys = Object.keys(entry);
      if (!entryRequired.every((key) => entryKeys.includes(key))) {
        failures.push(`${listKey} entry misses required keys`);
      }
      for (const [key, v] of Object.entries(entry)) {
        if (key === "status") {
          if (typeof v !== "string" || !statuses.includes(v)) {
            failures.push(`${listKey} entry status is invalid`);
          }
        } else if (key === "keptOriginal") {
          if (typeof v !== "boolean") {
            failures.push(`${listKey} entry keptOriginal must be boolean`);
          }
        } else if (typeof v !== "string" && typeof v !== "number") {
          failures.push(`${listKey} entry value at "${key}" is not a primitive span field`);
        }
      }
    }
  }
  if (failures.length > 0) {
    throw new Error(`structural violation: ${failures.join("; ")}`);
  }
}

describe("authorized trace: mapping, notes and decision counts", () => {
  it("carries the exact original spans, replacements and reviewer notes", () => {
    const session = completedSession();
    const audit = buildConfidentialAudit(session);

    const byOffset = (entry: ConfidentialAuditEntry) => entry.start;
    // Deterministic ordering by source offset regardless of detection order.
    expect(audit.mapping.map(byOffset)).toEqual([NAME_START, PHONE_START, NHC_START]);
    expect(audit.mapping.length).toBe(3);

    const name = audit.mapping.find((e) => e.start === NAME_START);
    expect(name).toMatchObject({
      type: "NOMBRE",
      status: "accepted",
      original: "Carmen Sánchez",
      proposed: "PACIENTE-1",
      replacement: "PACIENTE-1",
      keptOriginal: false,
    });
    expect(name?.note).toBe("nota interna de revisión: verificar apellidos");

    const phone = audit.mapping.find((e) => e.start === PHONE_START);
    expect(phone).toMatchObject({
      status: "modified",
      original: "612345678",
      replacement: "TEL-REEMPLAZO",
      keptOriginal: false,
    });
    // Explicit decision note takes precedence over the detection metadata note.
    expect(phone?.note).toBe("sin código de país en la fuente");

    const nhc = audit.mapping.find((e) => e.start === NHC_START);
    expect(nhc).toMatchObject({
      status: "restored",
      original: "2024/089756",
      replacement: "2024/089756",
      keptOriginal: true,
    });
    expect(nhc?.note).toBe("conservado a petición del servicio clínico");
  });

  it("trace counts match the review authority's progress data", () => {
    const session = completedSession();
    const audit = buildConfidentialAudit(session);
    const progress = getProgress(session);
    expect(audit.trace).toEqual({
      total: progress.total,
      accepted: progress.accepted,
      modified: progress.modified,
      restored: progress.restored,
      pending: progress.pending,
      manual: progress.manual,
      canFinalize: progress.canFinalize,
    });
    expect(audit.trace).toEqual({
      total: 3,
      accepted: 1,
      modified: 1,
      restored: 1,
      pending: 0,
      manual: 0,
      canFinalize: true,
    });
  });

  it("restored entries are explicit first-class restored decisions, not errors", () => {
    const audit = buildConfidentialAudit(completedSession());
    expect(audit.restoredEntries.length).toBe(1);
    const restored = audit.restoredEntries[0];
    expect(restored?.status).toBe("restored");
    expect(restored?.keptOriginal).toBe(true);
    expect(restored?.original).toBe("2024/089756");
    // The kept-original entry is part of the authorized mapping too.
    expect(audit.mapping).toContainEqual(restored);
  });
});

describe("confidential marking", () => {
  it("is unmistakably named and marked confidential at the type level", () => {
    const audit = buildConfidentialAudit(completedSession());
    expect(audit.kind).toBe("confidential-audit");
    expect(audit.confidential).toBe(true);
    expect(Object.isFrozen(audit)).toBe(true);
    expect(Object.isFrozen(audit.mapping)).toBe(true);
    expect(Object.isFrozen(audit.trace)).toBe(true);
    expect(Object.isFrozen(audit.restoredEntries)).toBe(true);
    expect(audit.mapping.every((entry) => Object.isFrozen(entry))).toBe(true);
  });
});

describe("structural separation from Safe Output (same completed session)", () => {
  it("Safe Output carries the canonical final text; the audit carries the mapping", () => {
    const session = completedSession();
    const safe = buildSafeOutput(session);
    const audit = buildConfidentialAudit(session);

    expect(safe.text).toBe(getFinalText(session));
    expect(audit.mapping.length).toBe(3);
    expect(audit.mapping.map((e) => e.original)).toEqual([
      "Carmen Sánchez",
      "612345678",
      "2024/089756",
    ]);
  });

  it("the two artifact shapes cannot carry each other's data", () => {
    const session = completedSession();
    const safe: SafeOutput = buildSafeOutput(session);
    const audit = buildConfidentialAudit(session);

    // Key sets are structurally disjoint product shapes.
    const safeKeys = new Set(Object.keys(safe));
    const auditKeys = new Set(Object.keys(audit));
    expect([...safeKeys].every((key) => auditKeys.has(key))).toBe(false);
    expect([...auditKeys].every((key) => safeKeys.has(key))).toBe(false);
    expect(auditKeys).toEqual(
      new Set(["kind", "confidential", "sessionId", "mapping", "trace", "restoredEntries"])
    );

    // Every Safe Output value is a string; the audit holds arrays/objects.
    for (const value of Object.values(safe)) {
      expect(typeof value).toBe("string");
    }
    expect(Array.isArray(audit.mapping)).toBe(true);
    expect(Array.isArray(audit.restoredEntries)).toBe(true);
    expect(typeof audit.trace).toBe("object");

    // Typed guards reject the cross-product shapes fail-closed.
    expect(isSafeOutput(audit)).toBe(false);
    expect(isConfidentialAudit(safe)).toBe(false);

    // Both real artifacts pass their own structural assertions.
    expect(() => {
      const keys = Object.keys(safe).sort();
      if (keys.join(",") !== "kind,text") throw new Error("structural violation");
    }).not.toThrow();
    expect(() => assertStructuralConfidentialAudit(audit)).not.toThrow();
  });

  it("the oracle can disagree: planted cross-product shapes fail the same assertions", () => {
    const audit = buildConfidentialAudit(completedSession());
    // Planted "audit" that is actually a Safe Output shape.
    const plantedSafeLike = { kind: "confidential-audit", confidential: true, text: "x" };
    expect(() => assertStructuralConfidentialAudit(plantedSafeLike)).toThrowError(
      /structural violation/
    );
    // Planted audit missing the authorized mapping.
    const plantedWithoutMapping: Record<string, unknown> = { ...audit };
    delete plantedWithoutMapping.mapping;
    expect(() => assertStructuralConfidentialAudit(plantedWithoutMapping)).toThrowError(
      /structural violation/
    );
    // Planted audit with a demoted confidential marking.
    expect(isConfidentialAudit({ ...audit, confidential: false })).toBe(false);
    // Planted audit whose mapping entries are not correspondence records.
    expect(isConfidentialAudit({ ...audit, mapping: ["Carmen Sánchez -> PACIENTE-1"] })).toBe(
      false
    );
  });

  it("the word 'note' in the source never trips the structural separation", () => {
    // SOURCE deliberately contains the word "note", also used as an audit
    // metadata key. Assertions are key-set/shape checks, so a legitimate
    // source text containing that word cannot fail them.
    const session = completedSession();
    const safe = buildSafeOutput(session);
    const audit = buildConfidentialAudit(session);

    const nameEntry = audit.mapping.find((e) => e.start === NAME_START);
    expect(SOURCE.slice(NAME_START, NAME_END)).not.toContain("note");
    expect(SOURCE).toContain("note");
    expect(() => assertStructuralConfidentialAudit(audit)).not.toThrow();
    expect(new Set(Object.keys(audit))).toEqual(
      new Set(["kind", "confidential", "sessionId", "mapping", "trace", "restoredEntries"])
    );
    expect(isSafeOutput(audit)).toBe(false);
    expect(isConfidentialAudit(safe)).toBe(false);
    // The safe text legitimately contains the source word "note"; the
    // separation still holds because it is decided by shapes, never by
    // content scans.
    expect(safe.text).toContain("Patient note:");
    expect(nameEntry).toBeDefined();
  });
});

describe("pending sessions: traceability during review", () => {
  it("the audit can be built while mandatory decisions are pending", () => {
    const session = adversarialSession(); // nothing decided yet
    expect(getProgress(session).canFinalize).toBe(false);

    const audit = buildConfidentialAudit(session);
    expect(audit.trace.pending).toBe(3);
    expect(audit.trace.canFinalize).toBe(false);
    expect(audit.mapping.every((entry) => entry.status === "pending")).toBe(true);
    expect(audit.mapping.every((entry) => entry.replacement === undefined)).toBe(true);
    expect(audit.restoredEntries.length).toBe(0);
  });

  it("shows exactly the remaining pending decisions in a partial session", () => {
    const session = adversarialSession();
    const [nhc, name] = session.detections;
    const partial = applyDecision(session, name.id, "accepted");
    const audit = buildConfidentialAudit(partial);

    expect(audit.trace.pending).toBe(2);
    expect(audit.mapping.find((e) => e.detectionId === name.id)?.status).toBe("accepted");
    expect(audit.mapping.find((e) => e.detectionId === nhc.id)?.status).toBe("pending");
  });
});

describe("source spans are preserved without truncation", () => {
  it("keeps multi-line source spans intact in the mapping data", () => {
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
    expect(audit.mapping[0]?.replacement).toBe("PACIENTE-1");
  });
});

describe("purity and session isolation by construction", () => {
  it("rebuilding the same session yields a deep-equal audit with no module state", () => {
    const session = completedSession();
    const first = buildConfidentialAudit(session);
    const second = buildConfidentialAudit(session);
    expect(second).toEqual(first);
    expect(second).not.toBe(first);
  });

  it("audits of different sessions are independent derivations", () => {
    const sessionA = completedSession();
    const firstAudit = buildConfidentialAudit(sessionA);
    const sessionB = createReviewSession({
      originalText: "Domicilio: Calle Falsa 123.",
      detections: [
        { type: "DIRECCION", start: 11, end: 27, proposed: "DIRECCION-1", requiresReview: true },
      ],
      sessionId: "other-session",
    });
    const auditB = buildConfidentialAudit(sessionB);
    const secondAudit = buildConfidentialAudit(sessionA);
    expect(secondAudit).toEqual(firstAudit);
    expect(auditB.mapping.length).toBe(1);
    expect(auditB.sessionId).toBe("other-session");
    expect(auditB).not.toEqual(firstAudit);
  });
});

describe("isConfidentialAudit structural guard", () => {
  it("accepts a real audit and rejects foreign or broken shapes", () => {
    const audit: ConfidentialAudit = buildConfidentialAudit(completedSession());
    expect(isConfidentialAudit(audit)).toBe(true);
    expect(isConfidentialAudit(buildConfidentialAudit(adversarialSession()))).toBe(true);
    expect(isConfidentialAudit({ ...audit, extra: 1 })).toBe(false);
    expect(isConfidentialAudit(null)).toBe(false);
    expect(isConfidentialAudit(["confidential-audit"])).toBe(false);
    expect(isConfidentialAudit("confidential-audit")).toBe(false);
    expect(isConfidentialAudit(undefined)).toBe(false);
  });

  it("the guard rejects planted contract violations fail-closed", () => {
    const audit = buildConfidentialAudit(completedSession());
    // Planted trace with a wrong-typed count.
    expect(isConfidentialAudit({ ...audit, trace: { ...audit.trace, pending: "3" } })).toBe(false);
    // Planted audit of the wrong value type entirely.
    expect(isConfidentialAudit(undefined as unknown as ConfidentialAudit)).toBe(false);
  });
});

describe("ARCH-011 optional-review coherence (T11 #15 WU4)", () => {
  const OPTIONAL_SOURCE = "Dato sintético: XYZ-0042 en la nota clínica.";
  const CODE_START = OPTIONAL_SOURCE.indexOf("XYZ-0042");

  /** Synthetic optional detection: policy determined review is not required. */
  function optionalUndecidedSession(): ReviewSession {
    return createReviewSession({
      originalText: OPTIONAL_SOURCE,
      sessionId: "optional-undecided-session",
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

  function manualPendingSession(): ReviewSession {
    const base = createReviewSession({
      originalText: "Domicilio: Calle Falsa 123.",
      sessionId: "manual-pending-session",
      detections: [
        { type: "DIRECCION", start: 11, end: 27, proposed: "DIR-1", requiresReview: true },
      ],
    });
    return applyDecision(base, base.detections[0].id, "restored", {});
  }

  /** Deterministic set of session shapes for the invariant oracle. */
  function invariantShapes(): Array<{ name: string; session: ReviewSession }> {
    const optionalOnly = optionalUndecidedSession();
    const optionalDecided = applyDecision(
      optionalUndecidedSession(),
      optionalUndecidedSession().detections[0].id,
      "accepted"
    );
    const allPending = adversarialSession();
    const completed = completedSession();
    const partial = applyDecision(
      adversarialSession(),
      adversarialSession().detections[1].id,
      "accepted"
    );
    const mixed = (() => {
      // One optional undecided detection + one mandatory decided (modified).
      const session = createReviewSession({
        originalText: OPTIONAL_SOURCE,
        sessionId: "mixed-shape-session",
        detections: [
          {
            type: "CODIGO",
            start: CODE_START,
            end: CODE_START + "XYZ-0042".length,
            proposed: "COD-1",
            requiresReview: false,
          },
          { type: "NOMBRE", start: 0, end: 4, proposed: "PAC-1", requiresReview: true },
        ],
      });
      return applyDecision(session, session.detections[1].id, "modified", {
        replacement: "NOMBRE-X",
      });
    })();
    return [
      { name: "optional undecided only", session: optionalOnly },
      { name: "optional decided (accepted)", session: optionalDecided },
      { name: "all mandatory pending", session: allPending },
      { name: "completed accepted/modified/restored", session: completed },
      { name: "partial: one decided, rest pending", session: partial },
      { name: "mixed optional undecided + mandatory decided", session: mixed },
      { name: "manual restored pending-free", session: manualPendingSession() },
    ];
  }

  it("optional undecided detection: explicit factual status, no mapping/trace contradiction", () => {
    const session = optionalUndecidedSession();
    const audit = buildConfidentialAudit(session);

    const entry = audit.mapping[0];
    expect(entry?.status).toBe("not-required");
    expect(entry?.status).not.toBe("pending");
    expect(entry?.status).not.toBe("accepted"); // NEVER silently accepted (ARCH-011)
    expect(entry?.replacement).toBeUndefined();
    expect(entry?.keptOriginal).toBe(false);

    // Aggregate semantics stay the T01 authority's: nothing pending, export open.
    expect(audit.trace.pending).toBe(0);
    expect(audit.trace.canFinalize).toBe(true);
    expect(getFinalText(session)).toBe(OPTIONAL_SOURCE); // span renders original

    // Coherence: mapping-level pending count equals the aggregate trace.
    const mappingPending = audit.mapping.filter((e) => e.status === "pending").length;
    expect(mappingPending).toBe(audit.trace.pending);
  });

  it("invariant oracle: mapping pending count === trace.pending AND canFinalize === (pending === 0) for every session shape", () => {
    for (const { name, session } of invariantShapes()) {
      const audit = buildConfidentialAudit(session);
      const mappingPending = audit.mapping.filter((e) => e.status === "pending").length;
      expect(mappingPending, `mapping/trace pending coherence for shape: ${name}`).toBe(
        audit.trace.pending
      );
      expect(audit.trace.canFinalize, `finalize gate coherence for shape: ${name}`).toBe(
        audit.trace.pending === 0
      );
    }
  });

  it("requiresReview=true undecided stays pending and fail-closed (no behavior change)", () => {
    const session = adversarialSession(); // nothing decided, all mandatory
    const audit = buildConfidentialAudit(session);
    expect(audit.mapping.every((entry) => entry.status === "pending")).toBe(true);
    expect(audit.trace.pending).toBe(3);
    expect(audit.trace.canFinalize).toBe(false);
    try {
      getFinalText(session);
      expect.unreachable("export must stay fail-closed");
    } catch (error) {
      expect((error as { code?: string }).code).toBe("MANDATORY_REVIEW_PENDING");
    }
  });

  it("T05/T06 default stability: no explicit requiresReview rule defaults to requiresReview=true", () => {
    const session = createReviewSession({
      originalText: "Dato sintético sin regla explícita.",
      sessionId: "default-requires-review",
      detections: [{ type: "NOMBRE", start: 0, end: 4, proposed: "PAC-1" }],
    });
    expect(session.detections[0]?.requiresReview).toBe(true);
    const audit = buildConfidentialAudit(session);
    expect(audit.mapping[0]?.status).toBe("pending");
    expect(audit.trace.pending).toBe(1);
    expect(audit.trace.canFinalize).toBe(false);
  });

  it("restored/accepted/modified entries are unchanged by the coherence work", () => {
    const audit = buildConfidentialAudit(completedSession());
    const statuses = audit.mapping.map((entry) => entry.status).sort();
    expect(statuses).toEqual(["accepted", "modified", "restored"]);
    expect(audit.restoredEntries.length).toBe(1);
    expect(audit.restoredEntries[0]?.keptOriginal).toBe(true);
  });

  it("the oracle can disagree: the OLD contradictory derivation is rejected fail-closed", () => {
    // Hand-built audit with the OLD contradictory shape: an optional undecided
    // detection whose mapping entry still claims "pending" while the aggregate
    // trace reports pending=0 / canFinalize=true.
    const realAudit = buildConfidentialAudit(optionalUndecidedSession());
    const oldDerivationAudit = {
      ...realAudit,
      mapping: [{ ...realAudit.mapping[0], status: "pending" as const }],
    };
    expect(oldDerivationAudit.mapping[0]?.status).toBe("pending");
    expect(oldDerivationAudit.trace.pending).toBe(0);
    expect(oldDerivationAudit.trace.canFinalize).toBe(true);
    // The coherence check detects the contradiction and rejects the artifact.
    expect(isConfidentialAudit(oldDerivationAudit)).toBe(false);

    // Planted finalize-gate lie: pending entries present but canFinalize=true.
    const pendingAudit = buildConfidentialAudit(adversarialSession());
    expect(
      isConfidentialAudit({ ...pendingAudit, trace: { ...pendingAudit.trace, canFinalize: true } })
    ).toBe(false);
    // Planted trace count lie: mapping has 3 pending entries, trace claims 2.
    expect(
      isConfidentialAudit({ ...pendingAudit, trace: { ...pendingAudit.trace, pending: 2 } })
    ).toBe(false);
  });
});
