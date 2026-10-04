import { describe, expect, it } from "vitest";

import {
  createStructuredConfiguration,
  overrideColumnClass,
  setStructuredDateRole,
} from "./configuration";
import type { StructuredGrid } from "./grid";
import { buildStructuredTransformPlan } from "./transform-plan";

/**
 * HARDEN-01 WU-A deterministic oracles for the structured transformation plan:
 * the single structural contract that decides what happens to each column.
 *
 * Synthetic fixture only. Columns: Paciente (identifier by header),
 * Fecha_Visita / Fecha_Nacimiento (quasi by header), Diagnostico (sensitive),
 * CampoLibre (no evidence -> unknown).
 */
const GRID: StructuredGrid = {
  headers: ["Paciente", "Fecha_Visita", "Fecha_Nacimiento", "Diagnostico", "CampoLibre"],
  rows: [
    ["P-001", "2023-01-10", "1954-03-12", "Gripe A", "nota libre"],
    ["P-001", "2023-02-01", "1954-03-12", "Fractura", "seguimiento"],
    ["P-002", "2023-03-15", "1980-07-04", "Gripe A", null],
  ],
};

const JOB_SEED = "hardening-wua";

function rolesConfig(roles: Record<number, "visit" | "birth" | "none">) {
  let config = createStructuredConfiguration(GRID, {
    selectedPatientIdColumn: "Paciente",
  });
  for (const [key, role] of Object.entries(roles)) {
    config = setStructuredDateRole(config, Number(key), role);
  }
  return config;
}

describe("buildStructuredTransformPlan — disposition per column", () => {
  it("maps selected patient-ID->study-id, identifier->remove, sensitive->keep, unknown->unsupported, quasi(date role)->date-age", () => {
    const config = createStructuredConfiguration(GRID, { selectedPatientIdColumn: "Paciente" });
    const plan = buildStructuredTransformPlan(config, { policyId: "standard", jobSeed: JOB_SEED });

    const byHeader = new Map(plan.columns.map((column) => [column.header, column.disposition]));
    expect(byHeader.get("Paciente")).toEqual({ kind: "study-id" });
    expect(byHeader.get("Diagnostico")).toEqual({ kind: "keep" });
    expect(byHeader.get("CampoLibre")).toEqual({
      kind: "unsupported",
      reason: "unknown-review-required",
    });
    // No date role: quasi-identifier date columns have no accepted operator.
    expect(byHeader.get("Fecha_Visita")).toEqual({
      kind: "unsupported",
      reason: "generalize-without-operator",
    });
    expect(byHeader.get("Fecha_Nacimiento")).toEqual({
      kind: "unsupported",
      reason: "generalize-without-operator",
    });

    expect(plan.blockingColumns).toEqual([1, 2, 4]);
    expect(plan.dispositionsReady).toBe(false);
  });

  it("activates T19 only for columns with an explicit visit|birth role", () => {
    const config = rolesConfig({ 1: "visit", 2: "birth" });
    const plan = buildStructuredTransformPlan(config, { policyId: "standard", jobSeed: JOB_SEED });
    const byHeader = new Map(plan.columns.map((column) => [column.header, column.disposition]));
    expect(byHeader.get("Fecha_Visita")).toEqual({ kind: "date-age", role: "visit-date" });
    expect(byHeader.get("Fecha_Nacimiento")).toEqual({ kind: "date-age", role: "birth-date" });
  });

  it("never infers a date role from a date-looking header (explicit authority only)", () => {
    // Fecha_Visita / Fecha_Nacimiento look like dates by header, but with no
    // explicit role they are NOT date-age: they block as quasi without operator.
    const config = createStructuredConfiguration(GRID, { selectedPatientIdColumn: "Paciente" });
    const plan = buildStructuredTransformPlan(config, { policyId: "standard", jobSeed: JOB_SEED });
    expect(plan.columns.filter((c) => c.disposition.kind === "date-age")).toHaveLength(0);
  });

  it("requires the patient-ID authority only for shift-per-patient policies", () => {
    const config = rolesConfig({ 1: "visit", 2: "birth" });
    const withoutPatient = createStructuredConfiguration(GRID, { dateRoles: config.dateRoles });
    const standard = buildStructuredTransformPlan(withoutPatient, {
      policyId: "standard",
      jobSeed: JOB_SEED,
    });
    expect(standard.requiresPatientIdForShift).toBe(false);
    expect(standard.missingPatientId).toBe(false);

    const externalAi = buildStructuredTransformPlan(withoutPatient, {
      policyId: "external-ai",
      jobSeed: JOB_SEED,
    });
    expect(externalAi.requiresPatientIdForShift).toBe(true);
    expect(externalAi.missingPatientId).toBe(true);
    expect(externalAi.dispositionsReady).toBe(false);

    const withPatient = buildStructuredTransformPlan(config, {
      policyId: "external-ai",
      jobSeed: JOB_SEED,
    });
    expect(withPatient.missingPatientId).toBe(false);
  });

  it("is structural: it carries no cell values", () => {
    const config = rolesConfig({ 1: "visit", 2: "birth" });
    const plan = buildStructuredTransformPlan(config, { policyId: "standard", jobSeed: JOB_SEED });
    const serialized = JSON.stringify(plan);
    expect(serialized).not.toContain("Gripe A");
    expect(serialized).not.toContain("2023-01-10");
    expect(serialized).not.toContain("P-001");
  });

  it("fails closed on an unknown policy id instead of guessing", () => {
    const config = createStructuredConfiguration(GRID, { selectedPatientIdColumn: "Paciente" });
    expect(() =>
      buildStructuredTransformPlan(config, {
        // @ts-expect-error deliberately invalid policy id
        policyId: "not-a-policy",
        jobSeed: JOB_SEED,
      })
    ).toThrowError(/Unknown structured date\/age policy/);
  });
});

describe("setStructuredDateRole — orthogonal, explicit, fail-closed", () => {
  it("sets and clears a role without touching any classification", () => {
    const base = createStructuredConfiguration(GRID, { selectedPatientIdColumn: "Paciente" });
    const withRole = setStructuredDateRole(base, 1, "visit");
    expect(withRole.columns[1].dateRole).toBe("visit");
    expect(withRole.columns.map((c) => c.effectiveClass)).toEqual(
      base.columns.map((c) => c.effectiveClass)
    );
    const cleared = setStructuredDateRole(withRole, 1, "none");
    expect(cleared.columns[1].dateRole).toBe("none");
    expect(cleared.dateRoles).toEqual({});
  });

  it("rejects a second column claiming the same role", () => {
    const base = setStructuredDateRole(createStructuredConfiguration(GRID), 1, "visit");
    expect(() => setStructuredDateRole(base, 2, "visit")).toThrowError(/exactly one visit/);
  });

  it("rejects an out-of-range column and an invalid role", () => {
    const base = createStructuredConfiguration(GRID);
    expect(() => setStructuredDateRole(base, 99, "visit")).toThrowError(/column index 99/);
    expect(() =>
      // @ts-expect-error deliberately invalid role
      setStructuredDateRole(base, 1, "whenever")
    ).toThrowError(/not an accepted date role/);
  });

  it("survives a class override and a patient-ID change (orthogonal state)", () => {
    let config = setStructuredDateRole(createStructuredConfiguration(GRID), 1, "visit");
    config = setStructuredDateRole(config, 2, "birth");
    config = overrideColumnClass(config, 4, "insensitive");
    expect(config.columns[1].dateRole).toBe("visit");
    const plan = buildStructuredTransformPlan(config, { policyId: "standard", jobSeed: JOB_SEED });
    expect(plan.blockingColumns).toEqual([]);
    expect(plan.dispositionsReady).toBe(true);
  });
});
