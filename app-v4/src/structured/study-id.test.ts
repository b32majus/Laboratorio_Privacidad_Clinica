import { describe, expect, it } from "vitest";

import * as StudyId from "./study-id";
import { buildStudyIdMapping, STUDY_ID_HEADER } from "./study-id";
import {
  createStructuredConfiguration,
  overrideColumnClass,
  setStructuredDateRole,
} from "./configuration";
import type { StructuredGrid } from "./grid";
import { buildStructuredTransformPlan } from "./transform-plan";
import { prepareStructuredOutput } from "./transformed-dataset";

/**
 * REC-03 WU-A red→green oracles: deterministic in-Job Study-ID mapping as a
 * pure domain primitive, productive `study-id` disposition, Safe
 * `ID_ESTUDIO` linkage, Confidential-only correspondence and fail-closed
 * blocks. Synthetic fixtures only; no real PHI.
 */
const JOB_SEED = "rec03-wua-study-id";

const GRID: StructuredGrid = {
  headers: ["NHC", "Fecha_Visita", "Fecha_Nacimiento", "Diagnostico", "CampoLibre"],
  rows: [
    ["P-001", "2023-01-10", "1954-03-12", "Gripe A", "nota libre"],
    ["P-001", "2023-02-01", "1954-03-12", "Fractura", "seguimiento"],
    ["P-002", "2023-03-15", "1980-07-04", "Gripe A", null],
  ],
};

function readyConfig() {
  let config = createStructuredConfiguration(GRID, { selectedPatientIdColumn: "NHC" });
  config = setStructuredDateRole(config, 1, "visit");
  config = setStructuredDateRole(config, 2, "birth");
  config = overrideColumnClass(config, 4, "insensitive");
  return config;
}

describe("study-id primitive — deterministic in-Job mapping", () => {
  it("maps P-001, P-001, P-002 to PAC_001, PAC_001, PAC_002 in first-appearance order", () => {
    const result = buildStudyIdMapping(["P-001", "P-001", "P-002"]);
    expect(result.studyIds).toEqual(["PAC_001", "PAC_001", "PAC_002"]);
    expect([...result.mapping.entries()]).toEqual([
      ["P-001", "PAC_001"],
      ["P-002", "PAC_002"],
    ]);
  });

  it("is deterministic: the same input twice yields identical mapping and output", () => {
    const first = buildStudyIdMapping(["P-001", "P-001", "P-002"]);
    const second = buildStudyIdMapping(["P-001", "P-001", "P-002"]);
    expect(second).toEqual(first);
    expect(JSON.stringify(second)).toBe(JSON.stringify(first));
  });

  it("assigns by first appearance, not sorted order", () => {
    const result = buildStudyIdMapping(["P-002", "P-001"]);
    expect(result.studyIds).toEqual(["PAC_001", "PAC_002"]);
    expect(result.mapping.get("P-002")).toBe("PAC_001");
    expect(result.mapping.get("P-001")).toBe("PAC_002");
  });

  it("keeps blanks blank: they never enter the mapping and never receive a Study ID", () => {
    const result = buildStudyIdMapping(["P-001", "", "P-002", null]);
    expect(result.studyIds).toEqual(["PAC_001", null, "PAC_002", null]);
    expect(result.mapping.size).toBe(2);
    expect([...result.mapping.values()]).toEqual(["PAC_001", "PAC_002"]);
  });

  it("introduces no configurable prefix and no visit-number option", () => {
    expect(STUDY_ID_HEADER).toBe("ID_ESTUDIO");
    const exportNames = Object.keys(StudyId);
    expect(exportNames.filter((name) => /prefix/i.test(name))).toEqual([]);
    expect(exportNames.filter((name) => /visit/i.test(name))).toEqual([]);
    const result = buildStudyIdMapping(["P-001"]);
    expect(result.studyIds[0]).toMatch(/^PAC_\d{3}$/);
  });
});

describe("study-id plan — productive disposition", () => {
  it("resolves the selected patient-ID column to study-id while other Identifiers stay remove", () => {
    const grid: StructuredGrid = {
      headers: ["NHC", "Nombre", "Diagnostico"],
      rows: [["P-001", "Ana", "Gripe A"]],
    };
    let config = createStructuredConfiguration(grid, { selectedPatientIdColumn: "NHC" });
    config = overrideColumnClass(config, 2, "insensitive");
    const plan = buildStructuredTransformPlan(config, { policyId: "standard", jobSeed: JOB_SEED });
    const byHeader = new Map(plan.columns.map((column) => [column.header, column.disposition]));
    expect(byHeader.get("NHC")).toEqual({ kind: "study-id" });
    expect(byHeader.get("Nombre")).toEqual({ kind: "remove" });
    expect(plan.blockingColumns).toEqual([]);
    expect(plan.dispositionsReady).toBe(true);
  });

  it("never auto-selects a patient-ID column: no selection means no study-id disposition", () => {
    const config = readyConfig();
    const unselected = createStructuredConfiguration(GRID, { dateRoles: config.dateRoles });
    const plan = buildStructuredTransformPlan(unselected, {
      policyId: "standard",
      jobSeed: JOB_SEED,
    });
    expect(plan.patientIdColumn).toBeNull();
    expect(plan.columns.some((column) => column.disposition.kind === "study-id")).toBe(false);
  });
});

describe("study-id preparation — Safe linkage and Confidential correspondence", () => {
  it("materializes ID_ESTUDIO at the selected column position with PAC_001, PAC_001, PAC_002", () => {
    const config = readyConfig();
    const preparation = prepareStructuredOutput(
      config,
      buildStructuredTransformPlan(config, { policyId: "standard", jobSeed: JOB_SEED })
    );
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
    expect(safe.rows.map((row) => row[0])).toEqual(["PAC_001", "PAC_001", "PAC_002"]);
    // Row order and blanks in other columns are preserved.
    expect(safe.rows).toHaveLength(3);
    expect(safe.rows[2][4]).toBe("");
  });

  it("planted leak oracle: no original selected patient ID appears anywhere in Safe output", () => {
    const config = readyConfig();
    const preparation = prepareStructuredOutput(
      config,
      buildStructuredTransformPlan(config, { policyId: "standard", jobSeed: JOB_SEED })
    );
    expect(preparation.status).toBe("ready");
    if (preparation.status !== "ready") return;
    const safeJson = JSON.stringify(preparation.output.safe);
    expect(safeJson).not.toContain("NHC");
    expect(safeJson).not.toContain("P-001");
    expect(safeJson).not.toContain("P-002");
  });

  it("confidential correspondence carries the unique original<->Study-ID mapping", () => {
    const config = readyConfig();
    const preparation = prepareStructuredOutput(
      config,
      buildStructuredTransformPlan(config, { policyId: "standard", jobSeed: JOB_SEED })
    );
    expect(preparation.status).toBe("ready");
    if (preparation.status !== "ready") return;
    const studyColumn = preparation.output.confidential.columns.find(
      (column) => column.disposition === "study-id"
    );
    expect(studyColumn).toBeDefined();
    expect(studyColumn?.header).toBe("NHC");
    expect([...(studyColumn?.entries ?? [])]).toEqual([
      { original: "P-001", transformed: "PAC_001" },
      { original: "P-002", transformed: "PAC_002" },
    ]);
  });

  it("is byte-identical across two preparations of the same input and config", () => {
    const first = prepareStructuredOutput(
      readyConfig(),
      buildStructuredTransformPlan(readyConfig(), { policyId: "standard", jobSeed: JOB_SEED })
    );
    const second = prepareStructuredOutput(
      readyConfig(),
      buildStructuredTransformPlan(readyConfig(), { policyId: "standard", jobSeed: JOB_SEED })
    );
    expect(first.status).toBe("ready");
    expect(second.status).toBe("ready");
    expect(JSON.stringify(second)).toBe(JSON.stringify(first));
  });
});

describe("study-id preparation — fail-closed blocks", () => {
  function blockedReasons(grid: StructuredGrid): readonly string[] {
    let config = createStructuredConfiguration(grid, { selectedPatientIdColumn: "NHC" });
    config = setStructuredDateRole(config, 1, "visit");
    config = setStructuredDateRole(config, 2, "birth");
    config = overrideColumnClass(config, 4, "insensitive");
    const plan = buildStructuredTransformPlan(config, { policyId: "standard", jobSeed: JOB_SEED });
    const preparation = prepareStructuredOutput(config, plan);
    expect(preparation.status).toBe("blocked");
    if (preparation.status !== "blocked") return [];
    expect(preparation.output).toBeNull();
    return preparation.reasons;
  }

  it("blocks a non-empty row with a blank selected patient-ID cell instead of exporting it unlinkably", () => {
    const grid: StructuredGrid = {
      headers: ["NHC", "Fecha_Visita", "Fecha_Nacimiento", "Diagnostico", "CampoLibre"],
      rows: [
        ["P-001", "2023-01-10", "1954-03-12", "Gripe A", "nota libre"],
        ["", "2023-02-01", "1954-03-12", "Fractura", "seguimiento"],
      ],
    };
    const reasons = blockedReasons(grid);
    expect(reasons.join(" ")).toMatch(/row 2.*patient-ID|patient-ID.*row 2/i);
  });

  it("blocks when another, different input column already occupies Safe header ID_ESTUDIO", () => {
    const grid: StructuredGrid = {
      headers: ["NHC", "Fecha_Visita", "Fecha_Nacimiento", "Diagnostico", "ID_ESTUDIO"],
      rows: [["P-001", "2023-01-10", "1954-03-12", "Gripe A", "externo-7"]],
    };
    let config = createStructuredConfiguration(grid, { selectedPatientIdColumn: "NHC" });
    config = setStructuredDateRole(config, 1, "visit");
    config = setStructuredDateRole(config, 2, "birth");
    config = overrideColumnClass(config, 3, "insensitive");
    config = overrideColumnClass(config, 4, "insensitive");
    const plan = buildStructuredTransformPlan(config, { policyId: "standard", jobSeed: JOB_SEED });
    const preparation = prepareStructuredOutput(config, plan);
    expect(preparation.status).toBe("blocked");
    if (preparation.status !== "blocked") return;
    expect(preparation.output).toBeNull();
    expect(preparation.reasons.join(" ")).toMatch(/ID_ESTUDIO/);
  });
});
