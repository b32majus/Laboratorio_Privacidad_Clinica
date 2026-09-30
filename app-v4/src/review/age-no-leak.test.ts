import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { PrivacyPolicyId } from "../domain/job";
import { PolicyError } from "../engine/policy";
import { createRegistryEngine } from "../engine/registry-engine";
import { buildConfidentialAudit } from "../output/confidential-audit";
import { buildSafeOutput, serializeSafeOutput } from "../output/safe-output";
import {
  applyDecision,
  createReviewSession,
  createSessionFromEngineTextAsync,
  type ReviewSession,
} from "./review-domain";

/**
 * Composed no-leak regression for the T12 AGE capability (Work Order #16,
 * WU-C). This suite drives the REAL composed path end-to-end —
 * registry-composed V4 engine (WU-A recognition + WU-B policy/operator) →
 * `ReviewSession` decisions (T01 authority) → Safe Output / Confidential
 * Audit (T08) — over synthetic Spanish clinical-style text carrying person,
 * identifier and date context plus three planted ages and two
 * false-positive baits.
 *
 * Oracles:
 *  1. no leak: accepted Safe Output carries the banded labels and NEVER the
 *     exact source age values;
 *  2. separation (D-005): Confidential Audit still holds the authorized
 *     original↔replacement correspondence, exact source values included;
 *  3. ground truth: exactly one EDAD entity per planted age at exact source
 *     offsets; `stats.byType.edades` counts them; the bait yields zero;
 *  4. policy invariance: `standard` and `strict` produce the SAME AGE labels;
 *  5. fail-closed: `external-ai` throws the typed PolicyError and no Safe
 *     Output exists.
 *
 * Determinism/privacy: all fixtures are synthetic; the only clock-dependent
 * transformation (legacy date relativization) is pinned with fake timers so
 * the suite never depends on the wall clock. No content is logged.
 */

const FIXTURE = [
  "Nombre: Carmen Sánchez",
  "Ingreso el 12/03/2024. Teléfono 612345678.",
  "La paciente, de 45 años, acude a revisión. Su madre, de 96 años, la acompaña.",
  "El lactante, paciente de 3 meses, sigue en seguimiento de 6 meses.",
  "Pauta: Paracetamol 1 g cada 8 horas.",
].join("\n");

/** Explicit planted source spans (the exact substrings the engine consumes). */
const ADULT_SOURCE = "45 años";
const EXTREME_SOURCE = "96 años";
const PEDIATRIC_SOURCE = "3 meses";

/** Accepted T12 banded labels — hard-coded to stay an independent oracle. */
const ADULT_LABEL = "40–49 años";
const EXTREME_LABEL = "90+ años";
const PEDIATRIC_LABEL = "<1 año";

/** False-positive bait: treatment duration and dose must never become EDAD. */
const DURATION_BAIT = "seguimiento de 6 meses";
const DOSE_BAIT = "Paracetamol 1 g";

const PLANTED: readonly string[] = [ADULT_SOURCE, EXTREME_SOURCE, PEDIATRIC_SOURCE];

const EXPECTED_SPANS = PLANTED.map((value) => {
  const start = FIXTURE.indexOf(value);
  return [value, start, start + value.length] as const;
});

const EXPECTED_LABELS = [
  [ADULT_SOURCE, ADULT_LABEL],
  [EXTREME_SOURCE, EXTREME_LABEL],
  [PEDIATRIC_SOURCE, PEDIATRIC_LABEL],
] as const;

function acceptAll(session: ReviewSession): ReviewSession {
  let decided = session;
  for (const detection of session.detections) {
    decided = applyDecision(decided, detection.id, "accepted");
  }
  return decided;
}

function edadProjection(policyId: PrivacyPolicyId) {
  const outcome = createRegistryEngine().process({
    text: FIXTURE,
    context: { mode: "fresh" },
    policyId,
  });
  return outcome.result.entities
    .filter((entity) => entity.type === "EDAD")
    .map((entity) => [entity.text, entity.transformed]);
}

beforeEach(() => {
  // Pin "today" so the legacy date relativization stays deterministic and can
  // never render a relative label that collides with the age assertions.
  vi.useFakeTimers({ now: new Date("2026-09-25T00:00:00Z") });
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe("T12 WU-C — composed no-leak: ages reach Safe Output only generalized", () => {
  it("bands every planted age and never leaks an exact source age value into Safe Output (ORACLE 1)", async () => {
    const session = acceptAll(await createSessionFromEngineTextAsync(FIXTURE, "standard"));
    const safeText = serializeSafeOutput(buildSafeOutput(session));

    expect(safeText).toContain(ADULT_LABEL);
    expect(safeText).toContain(EXTREME_LABEL);
    expect(safeText).toContain(PEDIATRIC_LABEL);

    expect(safeText).not.toContain(ADULT_SOURCE);
    expect(safeText).not.toContain(EXTREME_SOURCE);
    expect(safeText).not.toContain(PEDIATRIC_SOURCE);
  });

  it("keeps the original↔replacement correspondence, exact source ages included, in Confidential Audit only (ORACLE 2)", async () => {
    const session = acceptAll(await createSessionFromEngineTextAsync(FIXTURE, "standard"));
    const audit = buildConfidentialAudit(session);

    const edadEntries = audit.mapping.filter((entry) => entry.type === "EDAD");
    expect(edadEntries.map((entry) => [entry.original, entry.replacement])).toEqual(
      EXPECTED_LABELS.map(([original, replacement]) => [original, replacement])
    );
  });

  it("recognizes exactly one EDAD per planted age at exact offsets and counts them (ORACLE 3)", async () => {
    const outcome = createRegistryEngine().process({
      text: FIXTURE,
      context: { mode: "fresh" },
      policyId: "standard",
    });
    const edades = outcome.result.entities.filter((entity) => entity.type === "EDAD");

    expect(
      edades.map((entity) => [entity.text, entity.position.start, entity.position.end])
    ).toEqual(EXPECTED_SPANS.map(([value, start, end]) => [value, start, end]));
    expect(outcome.result.stats.byType.edades).toBe(PLANTED.length);
  });

  it("produces zero EDAD entities for the treatment-duration and dose bait (ORACLE 3, negative)", async () => {
    const outcome = createRegistryEngine().process({
      text: `${DURATION_BAIT}. ${DOSE_BAIT}.`,
      context: { mode: "fresh" },
      policyId: "standard",
    });
    expect(outcome.result.entities.filter((entity) => entity.type === "EDAD")).toHaveLength(0);
    expect(outcome.result.stats.byType.edades).toBe(0);
  });

  it("is policy-invariant: standard and strict share identical AGE labels (ORACLE 4)", async () => {
    const standard = edadProjection("standard");
    const strict = edadProjection("strict");

    expect(standard).toEqual(strict);
    expect(standard).toEqual(EXPECTED_LABELS.map(([original, label]) => [original, label]));
  });

  it("oracle self-test: the no-leak assertion is sensitive to a planted KEEP leak", async () => {
    // Planted violation: a session whose EDAD proposal keeps the exact source
    // value (a KEEP/leak instead of generalization). This is precisely the
    // output ORACLE 1 forbids, so if the accepted Safe Output still carries the
    // source age the no-leak assertion proves it can disagree with a leaking
    // implementation rather than passing vacuously.
    const source = `La paciente, de ${ADULT_SOURCE}, acude a revisión.`;
    const start = source.indexOf(ADULT_SOURCE);
    const planted = createReviewSession({
      originalText: source,
      detections: [
        {
          type: "EDAD",
          subtype: "anios",
          start,
          end: start + ADULT_SOURCE.length,
          proposed: ADULT_SOURCE,
          source: "engine",
          requiresReview: true,
        },
      ],
      sessionId: "planted-leak",
    });
    const decided = applyDecision(planted, planted.detections[0].id, "accepted");
    const leakedText = serializeSafeOutput(buildSafeOutput(decided));

    expect(leakedText).toContain(ADULT_SOURCE);
    expect(leakedText).not.toContain(ADULT_LABEL);
  });

  it("keeps external-ai fail-closed with the typed PolicyError and no Safe Output (ORACLE 5)", async () => {
    try {
      const session = await createSessionFromEngineTextAsync(FIXTURE, "external-ai");
      throw new Error(
        `expected external-ai to fail closed, got session ${String(session.sessionId)}`
      );
    } catch (error) {
      expect(error).toBeInstanceOf(PolicyError);
      expect((error as PolicyError).code).toBe("policy-operator-mapping-unavailable");
    }
  });
});
