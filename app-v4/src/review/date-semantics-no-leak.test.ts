import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { FechasManager } from "../../../js/core/managers/FechasManager.js";
import { classifyObservationDateRole } from "../engine/date-operator";
import { PolicyError } from "../engine/policy";
import { createRegistryEngine } from "../engine/registry-engine";
import { buildConfidentialAudit } from "../output/confidential-audit";
import { buildSafeOutput, serializeSafeOutput } from "../output/safe-output";
import type { PrivacyPolicyId } from "../domain/job";
import {
  applyDecision,
  createReviewSession,
  createSessionFromEngineText,
  type ReviewSession,
} from "./review-domain";

/**
 * Composed no-leak regression for the T13 DATE capability (Work Order #17,
 * WU-C). This suite drives the REAL composed path end-to-end — registry-
 * composed V4 engine (WU-A role semantics + WU-B role-aware transform) →
 * `ReviewSession` decisions (T01 authority) → Safe Output / Confidential
 * Audit (T08) — over synthetic Spanish clinical-style text with explicit
 * birth / admission / discharge / future-appointment cues, two unlabelled
 * visit dates and false-positive baits.
 *
 * Oracles:
 *  1. ACCEPTANCE 1: no explicit non-visit date is blindly relabelled — the
 *     four cued dates are redacted and never proposed as a visit, the two
 *     unlabelled dates keep the accepted `Visita N` label, identically under
 *     `standard` and `strict`;
 *  2. chronology integrity: the four non-visit dates consume no Visit-N slot,
 *     so `FechasManager.visitasMap` holds exactly the two unlabelled dates in
 *     chronological order;
 *  3. separation (D-005): Safe Output carries the visit labels and NONE of the
 *     non-visit source dates, while Confidential Audit keeps the authorized
 *     original↔replacement correspondence;
 *  4. false-positive controls: `talla alta` / `alta tensión`, same-line
 *     sibling dates, a cue in another clause/line and a cue beyond the
 *     64-character cap all stay visits;
 *  5. documented windowing limitation: a cue in the SAME clause AFTER the
 *     date can claim it, and the failure direction is extra redaction;
 *  6. oracle self-test: a planted original-date KEEP proves the no-leak
 *     assertion is genuinely falsifiable;
 *  7. fail-closed: `external-ai` and `longitudinal-research` throw the typed
 *     PolicyError and produce no session.
 *
 * Determinism/privacy: all fixtures are synthetic; the only clock-dependent
 * transformation (legacy date relativization) is pinned with fake timers so
 * the suite never depends on the wall clock. No content is logged.
 */

const FIXTURE = [
  "Nombre: Carmen Sánchez",
  "Fecha de nacimiento: 12/03/1954.",
  "Fecha de ingreso: 05/01/2024.",
  "Alta médica: 20/01/2024.",
  "Próxima cita: 10/02/2024.",
  "Primera visita el 02/06/2024.",
  "Talla alta 172 cm. Fecha de control: 03/11/2024.",
].join("\n");

/** The four dates whose clause claims an explicit NON-visit role. */
const NON_VISIT_DATES = ["12/03/1954", "05/01/2024", "20/01/2024", "10/02/2024"] as const;

/** The two dates with no explicit non-visit cue: accepted visit semantics. */
const VISIT_DATES = ["02/06/2024", "03/11/2024"] as const;

const POLICIES: readonly PrivacyPolicyId[] = ["standard", "strict"];

interface FechaProjection {
  readonly text: string;
  readonly transformed: string;
}

function acceptAll(session: ReviewSession): ReviewSession {
  let decided = session;
  for (const detection of session.detections) {
    decided = applyDecision(decided, detection.id, "accepted");
  }
  return decided;
}

/** Source date → engine `transformed` for every FECHA of the fixture. */
function fechaTransforms(policyId: PrivacyPolicyId): Map<string, string> {
  const outcome = createRegistryEngine().process({
    text: FIXTURE,
    context: { mode: "fresh" },
    policyId,
  });
  return new Map(
    outcome.result.entities
      .filter((entity) => entity.type === "FECHA")
      .map((entity) => [entity.text, entity.transformed ?? ""])
  );
}

/** Source date → ReviewSession `proposed` for every FECHA of the fixture. */
function fechaProposals(policyId: PrivacyPolicyId): Map<string, string> {
  const session = createSessionFromEngineText(FIXTURE, policyId);
  return new Map(
    session.detections
      .filter((detection) => detection.type === "FECHA")
      .map((detection) => [detection.original, detection.proposed ?? ""])
  );
}

/** Every FECHA entity of `text` as `{ text, transformed }`. */
function fechaEntities(text: string): readonly FechaProjection[] {
  const outcome = createRegistryEngine().process({ text, context: { mode: "fresh" } });
  return outcome.result.entities
    .filter((entity) => entity.type === "FECHA")
    .map((entity) => ({ text: entity.text, transformed: entity.transformed ?? "" }));
}

beforeEach(() => {
  // Pin "today" so the legacy date relativization stays deterministic and the
  // R3-001 visit labels cannot drift with the wall clock.
  vi.useFakeTimers({ now: new Date("2026-09-25T00:00:00Z") });
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe("T13 WU-C — composed no-leak: explicit non-visit dates are never relabelled as visits", () => {
  it("redacts the four cued dates, keeps the two unlabelled dates as visits, and is policy-invariant (ORACLE 1 / ACCEPTANCE 1)", () => {
    for (const policyId of POLICIES) {
      const transformed = fechaTransforms(policyId);
      const proposed = fechaProposals(policyId);

      expect(transformed.size, `${policyId}: exactly six FECHA entities`).toBe(6);
      for (const date of NON_VISIT_DATES) {
        expect(transformed.get(date), `${policyId}: transformed ${date}`).toBe("");
        expect(proposed.get(date), `${policyId}: proposed ${date}`).not.toMatch(/^Visita/);
      }
      for (const date of VISIT_DATES) {
        expect(transformed.get(date), `${policyId}: transformed ${date}`).toMatch(/^Visita [12]/);
      }
    }

    // Policy invariance of the date transformation.
    expect(fechaTransforms("strict")).toEqual(fechaTransforms("standard"));
    expect(fechaProposals("strict")).toEqual(fechaProposals("standard"));
  });

  it("keeps the Visit-N chronology to the two unlabelled dates only (ORACLE 2)", () => {
    FechasManager.reset();
    createRegistryEngine().process({
      text: FIXTURE,
      context: { mode: "fresh" },
      policyId: "standard",
    });

    expect(FechasManager.visitasMap.size).toBe(2);
    expect([...FechasManager.visitasMap.keys()].sort()).toEqual([...VISIT_DATES].sort());
    expect(FechasManager.visitasMap.get("02/06/2024") ?? "").toMatch(/^Visita 1/);
    expect(FechasManager.visitasMap.get("03/11/2024") ?? "").toMatch(/^Visita 2/);
  });

  it("separates Safe Output from Confidential Audit (D-005): visits labelled, non-visit dates absent from Safe Output but traceable in the audit (ORACLE 3)", () => {
    const session = acceptAll(createSessionFromEngineText(FIXTURE, "standard"));
    const safeText = serializeSafeOutput(buildSafeOutput(session));

    expect(safeText).toContain("Visita 1");
    expect(safeText).toContain("Visita 2");
    for (const date of NON_VISIT_DATES) {
      expect(safeText, `Safe Output leaked ${date}`).not.toContain(date);
    }

    const audit = buildConfidentialAudit(session);
    const fechaEntries = new Map(
      audit.mapping
        .filter((entry) => entry.type === "FECHA")
        .map((entry) => [entry.original, entry] as const)
    );
    for (const date of NON_VISIT_DATES) {
      expect(fechaEntries.get(date)?.original).toBe(date);
      expect(fechaEntries.get(date)?.replacement).toBe("");
    }
    for (const date of VISIT_DATES) {
      expect(fechaEntries.get(date)?.replacement ?? "").toMatch(/^Visita/);
    }
  });

  it("false-positive control: 'talla alta' and 'alta tensión' cues never claim the date (ORACLE 4)", () => {
    const talla = fechaEntities("Talla alta 172 cm. Fecha de control: 05/03/2024.");
    expect(talla).toHaveLength(1);
    expect(talla[0].transformed).not.toBe("");
    expect(talla[0].transformed).toMatch(/^Visita 1/);

    const tension = fechaEntities("Alta tensión 130/85. Fecha de control: 05/03/2024.");
    expect(tension).toHaveLength(1);
    expect(tension[0].transformed).not.toBe("");
    expect(tension[0].transformed).toMatch(/^Visita 1/);
  });

  it("false-positive control: same-line sibling dates are scoped independently (ORACLE 4)", () => {
    const fechas = fechaEntities("Fecha de nacimiento: 12/03/1984. Fecha de visita: 02/06/2024.");
    expect(fechas).toHaveLength(2);
    expect(fechas[0].text).toBe("12/03/1984");
    expect(fechas[0].transformed).toBe("");
    expect(fechas[1].text).toBe("02/06/2024");
    expect(fechas[1].transformed).toMatch(/^Visita 1/);
  });

  it("false-positive control: a cue in a different clause or line does not claim the date (ORACLE 4)", () => {
    const clauseSeparated = fechaEntities("Nacimiento registrado. Fecha de control: 05/03/2024.");
    expect(clauseSeparated).toHaveLength(1);
    expect(clauseSeparated[0].transformed).not.toBe("");
    expect(clauseSeparated[0].transformed).toMatch(/^Visita 1/);

    const lineSeparated = fechaEntities("Ingreso\nFecha de control: 05/03/2024.");
    expect(lineSeparated).toHaveLength(1);
    expect(lineSeparated[0].transformed).not.toBe("");
    expect(lineSeparated[0].transformed).toMatch(/^Visita 1/);
  });

  it("false-positive control: a cue beyond the 64-character window in the same clause does not claim the date (ORACLE 4)", () => {
    const text = `Ingreso ${"x".repeat(70)} Fecha de control: 05/03/2024.`;
    const fechas = fechaEntities(text);
    expect(fechas).toHaveLength(1);
    expect(fechas[0].transformed).not.toBe("");
    expect(fechas[0].transformed).toMatch(/^Visita 1/);
  });

  it("DOCUMENTED LIMITATION — the symmetric clause+cap window lets a same-clause cue AFTER the date claim it (ORACLE 5)", () => {
    // (a) This is the DELIBERATE clause + 64-character window behavior:
    //     `dateRoleContextWindow` inspects the containing clause on BOTH sides
    //     of the date, so a cue after the date can still claim it.
    // (b) The failure direction is ADDITIONAL redaction (never less privacy):
    //     a date wrongly classified as a non-visit role is redacted, not
    //     leaked, so the error can only reduce utility, never expose content.
    // (c) Later-label / structured-column semantics are outside #17 scope
    //     (structured date semantics are owned by a later ticket).
    const text = "Control de rutina 12/03/1954 nacimiento del hermano.";
    const start = text.indexOf("12/03/1954");
    const end = start + "12/03/1954".length;

    expect(classifyObservationDateRole(text, start, end)).toBe("birth");

    const fechas = fechaEntities(text);
    expect(fechas).toHaveLength(1);
    expect(fechas[0].transformed).toBe("");
  });

  it("oracle self-test: the no-leak assertion is sensitive to a planted original-date KEEP (ORACLE 6)", () => {
    // Planted violation: a session whose FECHA proposal keeps the exact source
    // date (a KEEP / relabelling leak). This is precisely what ORACLE 3
    // forbids, so if the accepted Safe Output still carries the source date the
    // no-leak assertion is proven falsifiable rather than vacuous.
    const source = "Fecha de control: 12/03/1954.";
    const plantedDate = "12/03/1954";
    const start = source.indexOf(plantedDate);
    const planted = createReviewSession({
      originalText: source,
      detections: [
        {
          type: "FECHA",
          subtype: "fecha_completa",
          start,
          end: start + plantedDate.length,
          proposed: plantedDate,
          source: "engine",
          requiresReview: true,
        },
      ],
      sessionId: "planted-date-leak",
    });
    const decided = applyDecision(planted, planted.detections[0].id, "accepted");
    const leakedText = serializeSafeOutput(buildSafeOutput(decided));

    expect(leakedText).toContain(plantedDate);
  });

  it("keeps external-ai and longitudinal-research fail-closed with the typed PolicyError and no session (ORACLE 7)", () => {
    for (const policyId of ["external-ai", "longitudinal-research"] as const) {
      try {
        const session = createSessionFromEngineText(FIXTURE, policyId);
        throw new Error(
          `expected ${policyId} to fail closed, got session ${String(session.sessionId)}`
        );
      } catch (error) {
        expect(error).toBeInstanceOf(PolicyError);
        expect((error as PolicyError).code).toBe("policy-operator-mapping-unavailable");
      }
    }
  });
});
