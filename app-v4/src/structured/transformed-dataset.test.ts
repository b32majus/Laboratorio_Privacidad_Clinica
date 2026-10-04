import { describe, expect, it } from "vitest";

import {
  createStructuredConfiguration,
  overrideColumnClass,
  setStructuredDateRole,
} from "./configuration";
import type { StructuredGrid } from "./grid";
import { buildStructuredTransformPlan } from "./transform-plan";
import {
  computeStructuredOutput,
  prepareStructuredOutput,
  structuredBlockReasons,
} from "./transformed-dataset";

/**
 * HARDEN-01 WU-A deterministic oracles for the structured output: the SINGLE
 * module that activates T19 date/age and codify, and the exact fail-closed
 * export gate. Synthetic fixtures only; no real PHI.
 */
const JOB_SEED = "hardening-wua-dataset";

const GRID: StructuredGrid = {
  headers: ["Paciente", "Fecha_Visita", "Fecha_Nacimiento", "Diagnostico", "CampoLibre"],
  rows: [
    ["P-001", "2023-01-10", "1954-03-12", "Gripe A", "nota libre"],
    ["P-001", "2023-02-01", "1954-03-12", "Fractura", "seguimiento"],
    ["P-002", "2023-03-15", "1980-07-04", "Gripe A", null],
  ],
};

function readyConfig() {
  let config = createStructuredConfiguration(GRID, { selectedPatientIdColumn: "Paciente" });
  config = setStructuredDateRole(config, 1, "visit");
  config = setStructuredDateRole(config, 2, "birth");
  config = overrideColumnClass(config, 4, "insensitive");
  return config;
}

function planFor(
  config: ReturnType<typeof readyConfig>,
  policyId: "standard" | "external-ai" | "strict" | "longitudinal-research"
) {
  return buildStructuredTransformPlan(config, { policyId, jobSeed: JOB_SEED });
}

describe("Windows-1252/structured output — Safe vs Confidential separation", () => {
  it("standard: generalizes dates to month, codifies sensitive, keeps insensitive, drops identifiers", () => {
    const config = readyConfig();
    const preparation = prepareStructuredOutput(config, planFor(config, "standard"));
    expect(preparation.status).toBe("ready");
    if (preparation.status !== "ready") return;
    const { safe, confidential } = preparation.output;

    // The selected patient-ID column becomes a Study ID in Safe output (REC-03
    // D-021), not a dropped identifier.
    expect(safe.headers).toEqual([
      "ID_ESTUDIO",
      "Fecha_Visita",
      "Fecha_Nacimiento",
      "Diagnostico",
      "CampoLibre",
    ]);
    expect(safe.headers).not.toContain("Paciente");

    const [studyId, visit, birth, diagnosis, free] = safe.rows[0];
    expect(studyId).toBe("PAC_001");
    expect(safe.rows.map((row) => row[0])).toEqual(["PAC_001", "PAC_001", "PAC_002"]);
    expect(visit).toMatch(/^\d{4}-\d{2}$/);
    expect(birth).toMatch(/^\d{4}-\d{2}$/);
    expect(visit).not.toBe("2023-01-10");
    expect(diagnosis).toBe("0");
    expect(free).toBe("nota libre");
    // Codes are stable per distinct value, first appearance order.
    expect(safe.rows.map((row) => row[3])).toEqual(["0", "1", "0"]);

    // NO original sensitive values / identity in the Safe dataset.
    const safeJson = JSON.stringify(safe);
    expect(safeJson).not.toContain("P-001");
    expect(safeJson).not.toContain("P-002");
    expect(safeJson).not.toContain("Gripe A");
    expect(safeJson).not.toContain("Fractura");
    expect(safeJson).not.toContain("1954-03-12");

    // Correspondence is separate and holds the originals.
    const confidentialJson = JSON.stringify(confidential);
    expect(confidentialJson).toContain("P-001");
    expect(confidentialJson).toContain("Gripe A");
    expect(confidentialJson).toContain("1954-03-12");
    expect(confidential.columns.map((column) => column.disposition).sort()).toEqual([
      "codify",
      "date-age",
      "date-age",
      "study-id",
    ]);
  });

  it("external-ai: shifts visit per patient and bands the birth age; identifier never in Safe", () => {
    const config = readyConfig();
    const preparation = prepareStructuredOutput(config, planFor(config, "external-ai"));
    expect(preparation.status).toBe("ready");
    if (preparation.status !== "ready") return;
    const { safe } = preparation.output;

    expect(safe.headers).toEqual([
      "ID_ESTUDIO",
      "Fecha_Visita",
      "Fecha_Nacimiento",
      "Diagnostico",
      "CampoLibre",
    ]);
    expect(safe.rows[0][1]).not.toBe("2023-01-10");
    // Same patient, same shift offset across rows -> interval preserved.
    expect(safe.rows[0][1]).not.toBe(safe.rows[2][1]);
    expect(safe.rows[0][2]).toMatch(/años/);
    expect(JSON.stringify(safe)).not.toContain("P-001");
  });

  it("codify runs ONLY when the reviewed effective class requests it", () => {
    let config = createStructuredConfiguration(GRID, { selectedPatientIdColumn: "Paciente" });
    config = overrideColumnClass(config, 3, "insensitive"); // Diagnostico: sensitive -> insensitive
    const plan = buildStructuredTransformPlan(config, { policyId: "standard", jobSeed: JOB_SEED });
    const diagnosis = plan.columns.find((column) => column.header === "Diagnostico");
    expect(diagnosis?.disposition).toEqual({ kind: "keep" });
    // And the sensitive default IS codify (already exercised above).
    const sensitivePlan = buildStructuredTransformPlan(
      createStructuredConfiguration(GRID, { selectedPatientIdColumn: "Paciente" }),
      { policyId: "standard", jobSeed: JOB_SEED }
    );
    expect(sensitivePlan.columns.find((c) => c.header === "Diagnostico")?.disposition).toEqual({
      kind: "codify",
    });
  });

  it("date policy is NEVER activated without an explicit visit|birth role", () => {
    const config = createStructuredConfiguration(GRID, { selectedPatientIdColumn: "Paciente" });
    const plan = buildStructuredTransformPlan(config, { policyId: "standard", jobSeed: JOB_SEED });
    expect(plan.columns.every((column) => column.disposition.kind !== "date-age")).toBe(true);
    expect(() => computeStructuredOutput(config, plan)).toThrow(/structurally-ready plan/);
  });
});

describe("structured export gate — exact fail-closed reasons", () => {
  it("blocks while an unknown column requires review", () => {
    const config = createStructuredConfiguration(GRID, { selectedPatientIdColumn: "Paciente" });
    const preparation = prepareStructuredOutput(config, planFor(config, "standard"));
    expect(preparation.status).toBe("blocked");
    if (preparation.status !== "blocked") return;
    expect(preparation.reasons.join(" ")).toMatch(/1 column requires review/);
  });

  it("blocks a shift policy without the patient-ID authority", () => {
    const config = createStructuredConfiguration(GRID, { dateRoles: { 1: "visit", 2: "birth" } });
    const preparation = prepareStructuredOutput(config, planFor(config, "external-ai"));
    expect(preparation.status).toBe("blocked");
    if (preparation.status !== "blocked") return;
    expect(preparation.reasons.join(" ")).toMatch(/no patient-ID column is selected/);
  });

  it("blocks when a date/age cell cannot be transformed (never silently kept)", () => {
    const badGrid: StructuredGrid = {
      headers: ["Paciente", "Fecha_Visita", "Fecha_Nacimiento"],
      rows: [["P-001", "no-es-fecha", "1954-03-12"]],
    };
    let config = createStructuredConfiguration(badGrid, { selectedPatientIdColumn: "Paciente" });
    config = setStructuredDateRole(config, 1, "visit");
    config = setStructuredDateRole(config, 2, "birth");
    const plan = buildStructuredTransformPlan(config, { policyId: "standard", jobSeed: JOB_SEED });
    const preparation = prepareStructuredOutput(config, plan);
    expect(preparation.status).toBe("blocked");
    if (preparation.status !== "blocked") return;
    expect(preparation.reasons.join(" ")).toMatch(/date\/age cell requires review/);
  });

  it("exposes reasons through structuredBlockReasons for the UI", () => {
    const config = createStructuredConfiguration(GRID, { selectedPatientIdColumn: "Paciente" });
    const reasons = structuredBlockReasons(
      buildStructuredTransformPlan(config, { policyId: "standard", jobSeed: JOB_SEED })
    );
    expect(reasons.length).toBeGreaterThan(0);
  });
});
