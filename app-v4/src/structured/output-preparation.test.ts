import { describe, expect, it } from "vitest";

import { createStructuredConfiguration, overrideColumnClass } from "./configuration";
import type { StructuredGrid } from "./grid";
import {
  createDefaultStructuredOutputOptions,
  setAddVisitNumber,
  setStudyIdPrefix,
  type StructuredOutputOptions,
} from "./output-options";
import { buildStructuredTransformPlan } from "./transform-plan";
import { deriveStructuredSummary, prepareStructuredOutput } from "./transformed-dataset";
import { serializeStructuredSafeCsv } from "./csv-writer";
import { STUDY_ID_HEADER } from "./study-id";
import { VISIT_NUMBER_HEADER } from "./output-options";

/**
 * REC-04 WU-B red→green oracles: output options, typed Safe scalars and
 * factual summary through the canonical preparation. Synthetic fixtures only;
 * no real PHI.
 */
const JOB_SEED = "rec04-wub-output";

const GRID: StructuredGrid = {
  headers: ["NHC", "Edad_Num", "Flag", "Diagnostico"],
  rows: [
    ["P-001", 34, true, "Gripe A"],
    ["P-001", 35, false, "Fractura"],
    ["P-002", 41, true, "Gripe A"],
  ],
};

function readyConfig() {
  let config = createStructuredConfiguration(GRID, { selectedPatientIdColumn: "NHC" });
  config = overrideColumnClass(config, 1, "insensitive");
  config = overrideColumnClass(config, 2, "insensitive");
  config = overrideColumnClass(config, 3, "insensitive");
  return config;
}

function prepare(config: ReturnType<typeof readyConfig>, outputOptions?: StructuredOutputOptions) {
  const plan = buildStructuredTransformPlan(config, { policyId: "standard", jobSeed: JOB_SEED });
  return prepareStructuredOutput(
    config,
    plan,
    outputOptions === undefined ? {} : { outputOptions }
  );
}

describe("output options — heritage default and custom prefix", () => {
  it("keeps the PAC heritage default when the option is untouched", () => {
    const preparation = prepare(readyConfig());
    expect(preparation.status).toBe("ready");
    if (preparation.status !== "ready") return;
    expect(preparation.output.safe.headers[0]).toBe(STUDY_ID_HEADER);
    expect(preparation.output.safe.rows.map((row) => row[0])).toEqual([
      "PAC_001",
      "PAC_001",
      "PAC_002",
    ]);
    // Untouched (absent) options preserve legacy output exactly: no derived
    // visit column. The heritage visit default lives in the options
    // authority + bridge (enabled when a patient authority exists), never as
    // a silent domain invention for option-less callers.
    expect(preparation.output.safe.headers).toEqual([
      STUDY_ID_HEADER,
      "Edad_Num",
      "Flag",
      "Diagnostico",
    ]);
  });

  it("applies the heritage visit default through explicit default options", () => {
    const preparation = prepare(readyConfig(), createDefaultStructuredOutputOptions(true));
    expect(preparation.status).toBe("ready");
    if (preparation.status !== "ready") return;
    expect(preparation.output.safe.headers).toEqual([
      STUDY_ID_HEADER,
      VISIT_NUMBER_HEADER,
      "Edad_Num",
      "Flag",
      "Diagnostico",
    ]);
    const visitIndex = preparation.output.safe.headers.indexOf(VISIT_NUMBER_HEADER);
    expect(preparation.output.safe.rows.map((row) => row[visitIndex])).toEqual([1, 2, 1]);
  });

  it("prefix hs1 yields HS1_001… with identical grouping (only token text changes)", () => {
    const config = readyConfig();
    const base = prepare(config);
    const custom = prepare(
      config,
      setStudyIdPrefix(createDefaultStructuredOutputOptions(true), "hs1")
    );
    expect(base.status).toBe("ready");
    expect(custom.status).toBe("ready");
    if (base.status !== "ready" || custom.status !== "ready") return;
    expect(custom.output.safe.rows.map((row) => row[0])).toEqual(["HS1_001", "HS1_001", "HS1_002"]);
    // Same grouping/order: row i shares a Study ID in both iff it did before.
    const groupOf = (ids: readonly unknown[]) => ids.map((id) => ids.indexOf(id));
    expect(groupOf(custom.output.safe.rows.map((row) => row[0]))).toEqual(
      groupOf(base.output.safe.rows.map((row) => row[0]))
    );
    // Confidential original identity is unchanged by the prefix.
    const baseStudy = base.output.confidential.columns.find((c) => c.disposition === "study-id");
    const customStudy = custom.output.confidential.columns.find(
      (c) => c.disposition === "study-id"
    );
    expect(customStudy?.entries).toEqual([
      { original: "P-001", transformed: "HS1_001" },
      { original: "P-002", transformed: "HS1_002" },
    ]);
    expect((baseStudy?.entries ?? []).map((e) => e.original)).toEqual(
      (customStudy?.entries ?? []).map((e) => e.original)
    );
  });

  it("invalid prefix =CMD refuses typed: blocked preparation, no Safe artifact, exact reason", () => {
    // setStudyIdPrefix itself refuses at write time…
    expect(() => setStudyIdPrefix(createDefaultStructuredOutputOptions(true), "=CMD")).toThrowError(
      /prefix/i
    );
    // …and a raw invalid value carried in options blocks the gate explicitly.
    const preparation = prepare(readyConfig(), {
      studyIdPrefix: "=CMD",
      addVisitNumber: true,
    });
    expect(preparation.status).toBe("blocked");
    if (preparation.status !== "blocked") return;
    expect(preparation.output).toBeNull();
    expect(preparation.reasons.join(" ")).toMatch(/prefix.*invalid|invalid.*prefix/i);
  });
});

describe("Visita_Num — row-order occurrence per patient", () => {
  it("numbers repeated rows 1,2,… in row order, restarts per patient, sits after ID_ESTUDIO", () => {
    const preparation = prepare(readyConfig(), createDefaultStructuredOutputOptions(true));
    expect(preparation.status).toBe("ready");
    if (preparation.status !== "ready") return;
    const { safe } = preparation.output;
    expect(safe.headers).toEqual([
      STUDY_ID_HEADER,
      VISIT_NUMBER_HEADER,
      "Edad_Num",
      "Flag",
      "Diagnostico",
    ]);
    const visitIndex = safe.headers.indexOf(VISIT_NUMBER_HEADER);
    expect(safe.rows.map((row) => row[visitIndex])).toEqual([1, 2, 1]);
    // Derived Visita_Num is numeric in the Safe domain.
    for (const row of safe.rows) expect(typeof row[visitIndex]).toBe("number");
  });

  it("disabling removes the visit column entirely", () => {
    const options = setAddVisitNumber(createDefaultStructuredOutputOptions(true), false, true);
    const preparation = prepare(readyConfig(), options);
    expect(preparation.status).toBe("ready");
    if (preparation.status !== "ready") return;
    expect(preparation.output.safe.headers).toEqual([
      STUDY_ID_HEADER,
      "Edad_Num",
      "Flag",
      "Diagnostico",
    ]);
    expect(preparation.output.safe.headers).not.toContain(VISIT_NUMBER_HEADER);
  });

  it("no selected patient ID means no Study ID column, no visit column, stats unavailable", () => {
    let config = createStructuredConfiguration(GRID);
    config = overrideColumnClass(config, 0, "insensitive");
    config = overrideColumnClass(config, 1, "insensitive");
    config = overrideColumnClass(config, 2, "insensitive");
    config = overrideColumnClass(config, 3, "insensitive");
    const plan = buildStructuredTransformPlan(config, { policyId: "standard", jobSeed: JOB_SEED });
    const preparation = prepareStructuredOutput(config, plan, {
      outputOptions: createDefaultStructuredOutputOptions(false),
    });
    expect(preparation.status).toBe("ready");
    if (preparation.status !== "ready") return;
    expect(preparation.output.safe.headers).toEqual(["NHC", "Edad_Num", "Flag", "Diagnostico"]);
    expect(preparation.output.safe.headers).not.toContain(STUDY_ID_HEADER);
    expect(preparation.output.safe.headers).not.toContain(VISIT_NUMBER_HEADER);
    const summary = deriveStructuredSummary(config);
    expect(summary.rowCount).toBe(3);
    expect(summary.patient).toBeNull();
  });

  it("a conflicting Safe header Visita_Num blocks instead of overwriting or duplicating", () => {
    const grid: StructuredGrid = {
      headers: ["NHC", "Visita_Num", "Diagnostico"],
      rows: [["P-001", 9, "Gripe A"]],
    };
    let config = createStructuredConfiguration(grid, { selectedPatientIdColumn: "NHC" });
    config = overrideColumnClass(config, 1, "insensitive");
    config = overrideColumnClass(config, 2, "insensitive");
    const preparation = prepare(config, createDefaultStructuredOutputOptions(true));
    expect(preparation.status).toBe("blocked");
    if (preparation.status !== "blocked") return;
    expect(preparation.output).toBeNull();
    expect(preparation.reasons.join(" ")).toMatch(/Visita_Num/);
  });

  it("existing ID_ESTUDIO collision behaviour remains", () => {
    const grid: StructuredGrid = {
      headers: ["NHC", "ID_ESTUDIO", "Diagnostico"],
      rows: [["P-001", "externo-7", "Gripe A"]],
    };
    let config = createStructuredConfiguration(grid, { selectedPatientIdColumn: "NHC" });
    config = overrideColumnClass(config, 1, "insensitive");
    config = overrideColumnClass(config, 2, "insensitive");
    const preparation = prepare(config);
    expect(preparation.status).toBe("blocked");
    if (preparation.status !== "blocked") return;
    expect(preparation.reasons.join(" ")).toMatch(/ID_ESTUDIO/);
  });
});

describe("typed Safe scalars — keep stays typed, absence stays null", () => {
  it("unchanged keep numeric/boolean cells stay number/boolean and null stays null", () => {
    const grid: StructuredGrid = {
      headers: ["NHC", "Edad_Num", "Flag", "Nota"],
      rows: [
        ["P-001", 34, true, "a"],
        ["P-002", null, false, ""],
      ],
    };
    let config = createStructuredConfiguration(grid, { selectedPatientIdColumn: "NHC" });
    config = overrideColumnClass(config, 1, "insensitive");
    config = overrideColumnClass(config, 2, "insensitive");
    config = overrideColumnClass(config, 3, "insensitive");
    const plan = buildStructuredTransformPlan(config, { policyId: "standard", jobSeed: JOB_SEED });
    const preparation = prepareStructuredOutput(config, plan, {
      outputOptions: setAddVisitNumber(createDefaultStructuredOutputOptions(true), false, true),
    });
    expect(preparation.status).toBe("ready");
    if (preparation.status !== "ready") return;
    const { safe } = preparation.output;
    expect(safe.headers).toEqual([STUDY_ID_HEADER, "Edad_Num", "Flag", "Nota"]);
    expect(safe.rows[0]).toEqual(["PAC_001", 34, true, "a"]);
    expect(safe.rows[1]).toEqual(["PAC_002", null, false, null]);
    // Canonical transformed values remain strings.
    expect(typeof safe.rows[0][0]).toBe("string");
  });

  it("CSV bytes stay deterministic: null becomes an empty field, scalars stringify safely", () => {
    const csv = serializeStructuredSafeCsv({
      kind: "structured-safe-dataset",
      headers: ["Edad_Num", "Flag", "Nota"],
      rows: [
        [34, true, "a"],
        [null, false, null],
      ],
    });
    expect(csv).toBe("Edad_Num,Flag,Nota\n34,true,a\n,false,");
  });

  it("string-only datasets keep byte-compatible CSV with today", () => {
    const csv = serializeStructuredSafeCsv({
      kind: "structured-safe-dataset",
      headers: ["Fecha_Visita", "Diagnostico"],
      rows: [
        ["2023-01", "0"],
        ["", "1"],
      ],
    });
    expect(csv).toBe("Fecha_Visita,Diagnostico\n2023-01,0\n,1");
  });

  it("no mapping or correspondence leaks into Safe CSV", () => {
    const preparation = prepare(readyConfig());
    expect(preparation.status).toBe("ready");
    if (preparation.status !== "ready") return;
    const csv = serializeStructuredSafeCsv(preparation.output.safe);
    expect(csv).not.toContain("P-001");
    expect(csv).not.toContain("P-002");
    expect(csv).not.toContain("->");
    expect(csv.split("\n")).toHaveLength(4);
  });
});

describe("factual summary — descriptive counts, never scores or chronology", () => {
  it("always reports the data row count", () => {
    expect(deriveStructuredSummary(readyConfig()).rowCount).toBe(3);
  });

  it("reports unique patients, linked rows and average linked rows per patient", () => {
    const summary = deriveStructuredSummary(readyConfig());
    expect(summary.patient).toEqual({
      uniquePatients: 2,
      linkedRows: 3,
      averageLinkedRowsPerPatient: 1.5,
    });
  });

  it("counts first-appearance grouping, not sorted order", () => {
    const grid: StructuredGrid = {
      headers: ["NHC", "Nota"],
      rows: [
        ["P-002", "a"],
        ["P-001", "b"],
        ["P-002", "c"],
        ["P-003", "d"],
      ],
    };
    let config = createStructuredConfiguration(grid, { selectedPatientIdColumn: "NHC" });
    config = overrideColumnClass(config, 1, "insensitive");
    const summary = deriveStructuredSummary(config);
    expect(summary.rowCount).toBe(4);
    expect(summary.patient).toEqual({
      uniquePatients: 3,
      linkedRows: 4,
      averageLinkedRowsPerPatient: 4 / 3,
    });
  });
});
