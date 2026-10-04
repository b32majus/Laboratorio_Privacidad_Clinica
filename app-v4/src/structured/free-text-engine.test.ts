import { describe, expect, it } from "vitest";

import { loadRegistryEngine } from "../engine/engine-seam";
import type { PrivacyPolicyId } from "../domain/job";
import {
  applyDecision,
  canFinalize,
  getFinalText,
  getProgress,
  type ReviewSession,
} from "../review/review-domain";
import {
  createStructuredConfiguration,
  overrideColumnAction,
  type StructuredConfiguration,
} from "./configuration";
import { processStructuredFreeTextCells } from "./free-text";
import type { StructuredGrid } from "./grid";

/**
 * REC-03 WU-C real-engine oracles (handoff §5): a synthetic Spanish clinical
 * free-text cell reaches the REAL engine and review session under each
 * relevant policy path; same-entity consistency and Job-scoped longitudinal
 * date semantics hold across cells; a low-confidence candidate stays
 * pending/visible. Synthetic fixtures only.
 */
const CELL =
  "Paciente Carmen Sánchez, de 47 años, atendida el 12/03/2024 en urgencias. Contacto 612345678.";

function gridFor(cells: readonly (string | null)[]): StructuredGrid {
  return { headers: ["NHC", "Notas"], rows: cells.map((cell, i) => [`P-00${i + 1}`, cell]) };
}

function routed(grid: StructuredGrid): StructuredConfiguration {
  return overrideColumnAction(createStructuredConfiguration(grid), 1, "process-as-text");
}

function acceptAll(session: ReviewSession): ReviewSession {
  let next = session;
  for (const detection of session.detections) {
    next = applyDecision(next, detection.id, "accepted");
  }
  return next;
}

const POLICIES: readonly PrivacyPolicyId[] = [
  "standard",
  "external-ai",
  "longitudinal-research",
  "strict",
];

describe("WU-C oracle 1 — synthetic clinical cell reaches the real engine under each policy", () => {
  for (const policyId of POLICIES) {
    it(`policy ${policyId}: name/date/age/identifier detections enter a review session`, async () => {
      const engine = await loadRegistryEngine();
      const state = await processStructuredFreeTextCells({
        jobId: `wuc-real-${policyId}`,
        jobName: "wuc-real",
        policyId,
        configuration: routed(gridFor([CELL])),
        engine,
      });
      expect(state.cells.length).toBe(1);
      const first = state.cells[0];
      expect(first.ok).toBe(true);
      if (!first.ok) return;
      const types = new Set(first.session.detections.map((detection) => detection.type));
      expect(types.has("NOMBRE")).toBe(true);
      expect(types.has("FECHA")).toBe(true);
      expect(types.has("EDAD")).toBe(true);
      expect(types.has("IDENTIFICADOR")).toBe(true);
      // Unresolved mandatory detections block finalization (oracle 2 at session level).
      expect(canFinalize(first.session)).toBe(false);
      const decided = acceptAll(first.session);
      expect(canFinalize(decided)).toBe(true);
      const finalText = getFinalText(decided);
      expect(finalText).not.toContain("Carmen Sánchez");
      expect(finalText).not.toContain("612345678");
      expect(finalText).not.toContain("47 años");
    }, 120000);
  }
});

describe("WU-C oracle 5 — same entity across two cells gets a consistent pseudonym", () => {
  it("standard: both cells propose Paciente 1 for Carmen Sánchez", async () => {
    const engine = await loadRegistryEngine();
    const state = await processStructuredFreeTextCells({
      jobId: "wuc-real-consistent",
      jobName: "wuc-real",
      policyId: "standard",
      configuration: routed(gridFor([CELL, "Carmen Sánchez vuelve a consulta el 20/03/2024."])),
      engine,
    });
    expect(state.cells.length).toBe(2);
    const proposals = state.cells.map((cell) => {
      if (!cell.ok) throw new Error("expected cell to process");
      const name = cell.session.detections.find((detection) => detection.type === "NOMBRE");
      return name?.proposed;
    });
    expect(proposals[0]).toBeDefined();
    expect(proposals[1]).toBe(proposals[0]);
  }, 120000);
});

describe("WU-C oracle 6 — longitudinal text dates use one Job-scoped shift", () => {
  it("interval and order preserved; same date shifts identically; originals gone", async () => {
    const engine = await loadRegistryEngine();
    const state = await processStructuredFreeTextCells({
      jobId: "wuc-real-long",
      jobName: "wuc-real",
      policyId: "longitudinal-research",
      configuration: routed(
        gridFor([
          "Carmen Sánchez atendida el 12/03/2024 en urgencias.",
          "Carmen Sánchez vuelve el 20/03/2024 a revisión.",
          "Carmen Sánchez citada de nuevo el 12/03/2024.",
        ])
      ),
      engine,
    });
    expect(state.cells.every((cell) => cell.ok)).toBe(true);
    const finals = state.cells.map((cell) => {
      if (!cell.ok) throw new Error("expected cell to process");
      return getFinalText(acceptAll(cell.session));
    });
    for (const finalText of finals) {
      expect(finalText).not.toContain("12/03/2024");
      expect(finalText).not.toContain("20/03/2024");
    }
    // Same original date in two cells shifts to the identical value.
    const shiftedA = finals[0].match(/\d{2}\/\d{2}\/\d{4}/)?.[0];
    const shiftedC = finals[2].match(/\d{2}\/\d{2}\/\d{4}/)?.[0];
    expect(shiftedA).toBeDefined();
    expect(shiftedC).toBe(shiftedA);
    // The 8-day interval between the two dates is preserved (order semantics).
    const shiftedB = finals[1].match(/\d{2}\/\d{2}\/\d{4}/)?.[0];
    expect(shiftedB).toBeDefined();
    const days = (s: string) =>
      Date.UTC(Number(s.slice(6)), Number(s.slice(3, 5)) - 1, Number(s.slice(0, 2)));
    expect(Math.round((days(shiftedB as string) - days(shiftedA as string)) / 86400000)).toBe(8);
  }, 180000);
});

describe("WU-C oracle 4 — low-confidence candidate remains pending/visible", () => {
  it("below-threshold candidate stays pending until explicitly decided", async () => {
    const engine = await loadRegistryEngine();
    const text = "Fisioterapeuta Nélida Otxoa realizó la sesión de rehabilitación.";
    const state = await processStructuredFreeTextCells({
      jobId: "wuc-real-lowconf",
      jobName: "wuc-real",
      policyId: "standard",
      configuration: routed(gridFor([text])),
      engine,
    });
    const first = state.cells[0];
    expect(first.ok).toBe(true);
    if (!first.ok) return;
    const candidates = first.session.detections.filter(
      (detection) => detection.lowConfidence === true
    );
    expect(candidates.length).toBeGreaterThan(0);
    // Visible through the progress authority, pending by default.
    expect(getProgress(first.session).lowConfidence).toBe(candidates.length);
    expect(canFinalize(first.session)).toBe(false);
    // Deciding every OTHER detection still leaves the candidate pending.
    let next = first.session;
    for (const detection of first.session.detections) {
      if (detection.lowConfidence === true) continue;
      next = applyDecision(next, detection.id, "accepted");
    }
    expect(canFinalize(next)).toBe(false);
    // Explicitly deciding the candidate completes the session (ordinary semantics).
    for (const candidate of candidates) {
      next = applyDecision(next, candidate.id, "accepted");
    }
    expect(canFinalize(next)).toBe(true);
  }, 120000);
});
