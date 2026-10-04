import * as fs from "node:fs";
import * as path from "node:path";
import { fileURLToPath } from "node:url";
import * as vm from "node:vm";
import { afterEach, describe, expect, it } from "vitest";

import { resolveDateShiftOffset } from "../engine/date-shift";
import { readDateShiftState } from "../engine/date-operator";
import { parseStructuredWorkbook } from "./excel";
import {
  applyStructuredDateAgePolicy,
  resolveStructuredDateAgePolicy,
  StructuredDateAgePolicyError,
} from "./date-age-policy";
import { shiftStructuredDateCell } from "./date-age";
import type { StructuredGrid } from "./grid";
import { resetXlsxLoaderForTests, type XlsxCell, type XlsxLib } from "./xlsx-loader";

/**
 * T19 #23 WU-B deterministic verification: structured date/age POLICY
 * semantics (SPEC_V4_BATCH_AND_STRUCTURED.md §10, DEBT STRUCT-005).
 *
 * All fixtures are synthetic. The adversarial oracles below are built to
 * FALSIFY, at minimum: age measured from today instead of the visit date;
 * the exact visit date retained under a transforming policy; per-row shift
 * drift across one longitudinal patient; different patients sharing shift
 * state; blank/null dates fabricated into values; parser-normalized Excel
 * serial dates reinterpreted inconsistently; and a policy failure silently
 * falling back to KEEP/standard.
 */

const JOB_SEED = "job-2026-overnight-t19";

/** Longitudinal multi-row fixture: P-001 across three visits plus isolation rows. */
const LONGITUDINAL_GRID: StructuredGrid = {
  headers: ["Paciente", "Fecha_Visita", "Fecha_Nacimiento"],
  rows: [
    ["P-001", "2023-01-10", "1954-03-12"],
    ["P-001", "2023-02-01", "1954-03-12"],
    ["P-001", "2023-03-15", "1954-03-12"],
    ["P-002", "2023-01-10", "1980-07-04"],
    ["P-003", null, "1960-01-01"],
    [null, "2023-01-10", "1970-01-01"],
  ],
};

function isoDay(value: string): number {
  const [year, month, day] = value.split("-").map(Number);
  return Math.floor(Date.UTC(year, month - 1, day) / 86_400_000);
}

/** Unwraps a transformed cell value, failing the test on any other disposition. */
function transformedValue(cell: { kind: string; value?: string }): string {
  if (cell.kind !== "transformed" || typeof cell.value !== "string") {
    throw new Error(`expected a transformed cell, received ${cell.kind}`);
  }
  return cell.value;
}

function applyLongitudinal(
  policyId: Parameters<typeof applyStructuredDateAgePolicy>[0]["policyId"]
) {
  return applyStructuredDateAgePolicy({
    grid: LONGITUDINAL_GRID,
    policyId,
    jobSeed: JOB_SEED,
    visitDateColumn: "Fecha_Visita",
    birthDateColumn: "Fecha_Nacimiento",
    patientIdColumn: "Paciente",
  });
}

describe("resolveStructuredDateAgePolicy (accepted mapping, fail-closed)", () => {
  it("maps the accepted actions per policy (SPEC §10; D-007/D-010)", () => {
    expect(resolveStructuredDateAgePolicy("standard").actions).toEqual({
      "visit-date": { kind: "generalize-month" },
      "birth-date": { kind: "generalize-month" },
    });
    expect(resolveStructuredDateAgePolicy("strict").actions).toEqual({
      "visit-date": { kind: "generalize-month" },
      "birth-date": { kind: "generalize-month" },
    });
    expect(resolveStructuredDateAgePolicy("external-ai").actions).toEqual({
      "visit-date": { kind: "shift-per-patient" },
      "birth-date": { kind: "age-band" },
    });
    expect(resolveStructuredDateAgePolicy("longitudinal-research").actions).toEqual({
      "visit-date": { kind: "shift-per-patient" },
      "birth-date": { kind: "age-band" },
    });
  });

  it("offers NO keep/identity action at all (STRUCT-005 by construction)", () => {
    for (const policyId of ["standard", "external-ai", "longitudinal-research", "strict"]) {
      const profile = resolveStructuredDateAgePolicy(policyId);
      for (const action of Object.values(profile.actions)) {
        expect(["generalize-month", "shift-per-patient", "age-band"]).toContain(action.kind);
        // Runtime guard (kept as a string comparison so a widened action
        // vocabulary that reintroduces KEEP/identity still fails here).
        expect(["keep", "identity", "none"]).not.toContain(String(action.kind));
      }
    }
  });

  it("fails closed on unknown policies instead of falling back to standard", () => {
    expect(() => resolveStructuredDateAgePolicy("unknown-policy")).toThrow(
      StructuredDateAgePolicyError
    );
    try {
      resolveStructuredDateAgePolicy("external_ai_typo");
      throw new Error("must not reach");
    } catch (error) {
      expect((error as StructuredDateAgePolicyError).code).toBe("unknown-policy");
    }
    expect(() => resolveStructuredDateAgePolicy("")).toThrow(StructuredDateAgePolicyError);
    expect(() => resolveStructuredDateAgePolicy(null)).toThrow(StructuredDateAgePolicyError);
  });
});

describe("external-ai date/age policy fixture (STRUCT-005)", () => {
  const application = applyLongitudinal("external-ai");

  it("never keeps the exact visit date: every non-blank visit cell is transformed", () => {
    expect(application.visitDate).not.toBeNull();
    if (application.visitDate === null) return;
    const inputs = LONGITUDINAL_GRID.rows.map((row) => row[1]);
    application.visitDate.cells.forEach((cell, index) => {
      if (cell.kind !== "transformed") return; // absence/review are asserted below
      expect(cell.value).not.toBe(inputs[index]);
    });
    expect(application.visitDate.counts).toEqual({ transformed: 4, absent: 1, reviewRequired: 1 });
  });

  it("preserves longitudinal meaning: exact day intervals and order survive for one patient", () => {
    if (application.visitDate === null) return;
    const shifted = application.visitDate.cells.slice(0, 3).map((cell) => {
      if (cell.kind !== "transformed") throw new Error("P-001 visit cells must transform");
      return cell.value;
    });
    // Same-format ISO outputs, in order, with the original pairwise gaps.
    expect(isoDay(shifted[1]) - isoDay(shifted[0])).toBe(22); // 2023-01-10 → 2023-02-01
    expect(isoDay(shifted[2]) - isoDay(shifted[1])).toBe(42); // 2023-02-01 → 2023-03-15
    expect(isoDay(shifted[0]) < isoDay(shifted[1])).toBe(true);
    expect(isoDay(shifted[1]) < isoDay(shifted[2])).toBe(true);
  });

  it("derives the age at the VISIT date, banding it with the accepted T12 labels", () => {
    if (application.birthDate === null) return;
    // P-001: born 1954-03-12; ages at the 2023 visits are 68/68/69 — NOT
    // the ~72 years an implementation measuring against today would band.
    expect(application.birthDate.cells[0]).toEqual({
      kind: "transformed",
      value: "60–69 años",
    });
    expect(application.birthDate.cells[1]).toEqual({
      kind: "transformed",
      value: "60–69 años",
    });
    expect(application.birthDate.cells[2]).toEqual({
      kind: "transformed",
      value: "60–69 años",
    });
    expect(application.birthDate.cells[0]).not.toEqual({
      kind: "transformed",
      value: "70–79 años",
    });
  });

  it("isolates patients: different identities never share shift state or offsets", () => {
    const p1 = application.patientShiftStates.get("P-001");
    const p2 = application.patientShiftStates.get("P-002");
    expect(p1).toBeDefined();
    expect(p2).toBeDefined();
    if (p1 === undefined || p2 === undefined) return;
    expect(p1.contextOffsetDays).not.toBe(p2.contextOffsetDays);
    // The SAME visit date must transform differently for different patients.
    if (application.visitDate === null) return;
    const p1Out = application.visitDate.cells[0];
    const p2Out = application.visitDate.cells[3];
    expect(p1Out).not.toEqual(p2Out);
    // And applying P-002's state to P-001's date would NOT reproduce P-001's
    // output: the states are genuinely per patient, not shared mutable state.
    const wrongStateOutput = shiftStructuredDateCell(
      "2023-01-10",
      resolveDateShiftOffset(p2, "2023-01-10")
    );
    if (p1Out.kind !== "transformed") throw new Error("P-001 visit must transform");
    expect(p1Out.value).not.toBe(transformedValue(wrongStateOutput));
    // States are the exact ProcessingContext.options.dateShift payload shape.
    expect(readDateShiftState({ dateShift: p1 })).toBe(p1);
  });

  it("keeps per-patient state consistent across rows and across repeated applications", () => {
    const repeat = applyLongitudinal("external-ai");
    expect(repeat).toEqual(application);
    expect(repeat.patientShiftStates).toEqual(application.patientShiftStates);
    expect(repeat.patientShiftStates.get("P-001")).toEqual(
      application.patientShiftStates.get("P-001")
    );
  });

  it("keeps blank/null dates as absence and routes identity-less rows to visible review", () => {
    if (application.visitDate === null || application.birthDate === null) return;
    // P-003: blank visit stays absence, never a fabricated or shifted value.
    expect(application.visitDate.cells[4]).toEqual({ kind: "absent" });
    // P-003 birth WITH an absent visit date: review-required, never an age
    // derived from today, never the exact birth date kept.
    expect(application.birthDate.cells[4].kind).toBe("review-required");
    // Blank-patient row: the visit date cannot shift (no identity) — visible
    // review, not a silent KEEP; the birth age-band still works (no identity
    // needed) because the row has a visit date.
    expect(application.visitDate.cells[5].kind).toBe("review-required");
    if (application.visitDate.cells[5].kind === "review-required") {
      expect(application.visitDate.cells[5].reason).toContain("no patient identity");
    }
    expect(application.birthDate.cells[5]).toEqual({
      kind: "transformed",
      value: "50–59 años",
    });
    // No state is invented where no visit cell needs one: P-003's visit is
    // blank (absence first) and the identity-less row never reaches the
    // derivation, so only P-001 and P-002 carry states.
    expect(application.patientShiftStates.size).toBe(2);
    expect([...application.patientShiftStates.keys()].sort()).toEqual(["P-001", "P-002"]);
  });

  it("marks every review-required disposition in explicit counts (nothing hidden)", () => {
    expect(application.visitDate?.counts.reviewRequired).toBe(1);
    expect(application.birthDate?.counts.reviewRequired).toBe(1);
  });
});

describe("longitudinal-research preserves the same shift semantics", () => {
  it("matches the external-ai shift outputs for the same fixture", () => {
    const longitudinal = applyLongitudinal("longitudinal-research");
    const external = applyLongitudinal("external-ai");
    expect(longitudinal.visitDate?.cells).toEqual(external.visitDate?.cells);
    expect(isoDay("2023-02-01") - isoDay("2023-01-10")).toBe(22); // fixture sanity
  });
});

describe("standard/strict generalize instead of keeping the exact date", () => {
  it("reduces the visit and birth dates to month precision (legacy date-transform mirror)", () => {
    const application = applyLongitudinal("standard");
    expect(application.visitDate?.cells[0]).toEqual({ kind: "transformed", value: "2023-01" });
    expect(application.birthDate?.cells[0]).toEqual({ kind: "transformed", value: "1954-03" });
    expect(application.patientShiftStates.size).toBe(0); // no shift without a shift policy
  });

  it("transforms the exact visit date under EVERY accepted policy (never KEEP)", () => {
    for (const policyId of [
      "standard",
      "external-ai",
      "longitudinal-research",
      "strict",
    ] as const) {
      const application = applyLongitudinal(policyId);
      const cell = application.visitDate?.cells[0];
      expect(cell?.kind).toBe("transformed");
      if (cell?.kind === "transformed") expect(cell.value).not.toBe("2023-01-10");
    }
  });
});

describe("parser-normalized serial dates flow into date/age semantics exactly once", () => {
  /**
   * Real governed SheetJS bundle (same technique as excel.test.ts): the
   * fixture serials are normalized to ISO by the T18 parser and must be
   * shifted EXACTLY ONCE by the policy application — a double shift or a
   * divergent re-interpretation of the normalized ISO value fails.
   */
  const repoLibPath = path.join(
    path.dirname(fileURLToPath(import.meta.url)),
    "..",
    "..",
    "..",
    "lib",
    "xlsx.full.min.js"
  );

  function loadGovernedSheetJs(): XlsxLib {
    const code = fs.readFileSync(repoLibPath, "utf8");
    const context: Record<string, unknown> = { window: {}, console };
    vm.createContext(context);
    vm.runInContext(`${code}\n;this.__loaded = window.XLSX;`, context);
    return context.__loaded as XlsxLib;
  }

  type XlsxAuthoringLib = XlsxLib & {
    write(workbook: unknown, options: { type: "array"; bookType: "xlsx" }): ArrayBuffer;
    utils: XlsxLib["utils"] & {
      book_new(): Record<string, unknown>;
      book_append_sheet(workbook: Record<string, unknown>, sheet: unknown, name: string): void;
      aoa_to_sheet(rows: readonly (string | number | null)[][]): Record<string, XlsxCell>;
    };
  };

  const XLSX = loadGovernedSheetJs() as XlsxAuthoringLib;

  afterEach(() => {
    delete window.XLSX;
    resetXlsxLoaderForTests();
  });

  function serialFor(iso: string): number {
    return isoDay(iso) - Math.floor(Date.UTC(1899, 11, 30) / 86_400_000);
  }

  function buildSerialWorkbookBytes(): ArrayBuffer {
    const workbook = XLSX.utils.book_new();
    const sheet = XLSX.utils.aoa_to_sheet([
      ["Paciente", "Fecha_Visita"],
      ["P-001", null],
      ["P-001", null],
      ["P-001", "2023-03-15"], // text ISO row: same patient, mixed provenance
    ]);
    sheet["B2"] = { t: "n", v: serialFor("2023-01-10"), z: "dd/mm/yyyy" };
    sheet["B3"] = { t: "n", v: serialFor("2023-02-01"), z: "dd/mm/yyyy" };
    XLSX.utils.book_append_sheet(workbook, sheet, "Visitas");
    return XLSX.write(workbook, { type: "array", bookType: "xlsx" }) as ArrayBuffer;
  }

  it("shifts serial-normalized and text ISO cells of one patient consistently", async () => {
    window.XLSX = XLSX;
    // REC-04 WU-A (D-022): this two-column sheet has no header candidate by
    // construction (fewer than 3 textual cells per row), so the typed
    // `header-row-required` state would block; the date/age oracle resolves
    // it through the explicit header-row path with row 1 as the header.
    const parsed = await parseStructuredWorkbook(buildSerialWorkbookBytes(), {
      sheetName: "Visitas",
      headerRowIndex: 0,
    });
    expect(parsed.status).toBe("success");
    if (parsed.status !== "success") return;

    // The parser authority normalized BOTH serial cells to ISO.
    expect(parsed.grid.rows[0][1]).toBe("2023-01-10");
    expect(parsed.grid.rows[1][1]).toBe("2023-02-01");

    const application = applyStructuredDateAgePolicy({
      grid: parsed.grid,
      policyId: "external-ai",
      jobSeed: JOB_SEED,
      visitDateColumn: "Fecha_Visita",
      patientIdColumn: "Paciente",
    });
    const state = application.patientShiftStates.get("P-001");
    if (state === undefined) throw new Error("P-001 state must exist");
    const offset = state.contextOffsetDays;

    const cells = application.visitDate?.cells ?? [];
    expect(cells.map(transformedValue)).toEqual([
      transformedValue(shiftStructuredDateCell("2023-01-10", offset)),
      transformedValue(shiftStructuredDateCell("2023-02-01", offset)),
      transformedValue(shiftStructuredDateCell("2023-03-15", offset)),
    ]);
    // Interval preservation across the serial/text provenance boundary.
    expect(isoDay(transformedValue(cells[1])) - isoDay(transformedValue(cells[0]))).toBe(22);

    // Falsification: a double shift of the normalized value diverges.
    const first = transformedValue(cells[0]);
    const doubleShifted = transformedValue(shiftStructuredDateCell("2023-01-10", offset * 2));
    expect(first).not.toBe(doubleShifted);
    expect(offset).not.toBe(0);
  });
});

describe("fail-closed application branches execute deterministically", () => {
  it("refuses a shift policy without the patient-ID authority", () => {
    expect(() =>
      applyStructuredDateAgePolicy({
        grid: LONGITUDINAL_GRID,
        policyId: "external-ai",
        jobSeed: JOB_SEED,
        visitDateColumn: "Fecha_Visita",
      })
    ).toThrow(StructuredDateAgePolicyError);
    try {
      applyStructuredDateAgePolicy({
        grid: LONGITUDINAL_GRID,
        policyId: "external-ai",
        jobSeed: JOB_SEED,
        visitDateColumn: "Fecha_Visita",
      });
    } catch (error) {
      expect((error as StructuredDateAgePolicyError).code).toBe("missing-patient-id-column");
    }
  });

  it("fails typed when a selected column does not exist", () => {
    expect(() =>
      applyStructuredDateAgePolicy({
        grid: LONGITUDINAL_GRID,
        policyId: "external-ai",
        jobSeed: JOB_SEED,
        visitDateColumn: "Fecha_Cita",
        patientIdColumn: "Paciente",
      })
    ).toThrow(StructuredDateAgePolicyError);
  });

  it("fails typed on a malformed grid", () => {
    expect(() =>
      applyStructuredDateAgePolicy({
        grid: {} as unknown as StructuredGrid,
        policyId: "standard",
        jobSeed: JOB_SEED,
      })
    ).toThrow(StructuredDateAgePolicyError);
  });

  it("keeps working (fail-closed, review-visible) when age-band lacks a visit column", () => {
    const application = applyStructuredDateAgePolicy({
      grid: LONGITUDINAL_GRID,
      policyId: "external-ai",
      jobSeed: JOB_SEED,
      birthDateColumn: "Fecha_Nacimiento",
      patientIdColumn: "Paciente",
    });
    expect(application.visitDate).toBeNull();
    expect(application.birthDate?.cells[0].kind).toBe("review-required");
    if (application.birthDate?.cells[0].kind === "review-required") {
      expect(application.birthDate.cells[0].reason).toContain(
        "no visit/event date column was selected"
      );
    }
    // The exact birth dates are NOT in the output cells.
    for (const cell of application.birthDate?.cells ?? []) {
      if (cell.kind === "transformed") expect(cell.value).not.toBe("1954-03-12");
    }
  });

  it("routes unparseable visit content to visible review under every policy", () => {
    const grid: StructuredGrid = {
      headers: ["Paciente", "Fecha_Visita"],
      rows: [
        ["P-001", "por definir"],
        ["P-001", "12/03/54"],
      ],
    };
    for (const policyId of ["standard", "external-ai"] as const) {
      const application = applyStructuredDateAgePolicy({
        grid,
        policyId,
        jobSeed: JOB_SEED,
        visitDateColumn: "Fecha_Visita",
        patientIdColumn: "Paciente",
      });
      expect(application.visitDate?.cells.every((cell) => cell.kind === "review-required")).toBe(
        true
      );
      // Never the original content passed through as a transformed value.
      for (const cell of application.visitDate?.cells ?? []) {
        expect(cell.kind).toBe("review-required");
      }
    }
  });
});

describe("STRUCT-011 advisories: malformed rows and ambiguous columns", () => {
  it("fails typed (never an ordinary TypeError) on a malformed null row", () => {
    const grid = {
      headers: ["Paciente", "Fecha_Visita"],
      rows: [["P-001", "2023-01-10"], null],
    } as unknown as StructuredGrid;
    try {
      applyStructuredDateAgePolicy({
        grid,
        policyId: "standard",
        jobSeed: JOB_SEED,
        visitDateColumn: "Fecha_Visita",
      });
      throw new Error("must not reach");
    } catch (error) {
      expect(error).toBeInstanceOf(StructuredDateAgePolicyError);
      expect((error as StructuredDateAgePolicyError).code).toBe("invalid-grid");
    }
  });

  it("fails typed on duplicate headers that make the selected column ambiguous", () => {
    const grid: StructuredGrid = {
      headers: ["Paciente", "Fecha_Visita", "Fecha_Visita"],
      rows: [["P-001", "2023-01-10", "2023-01-11"]],
    };
    try {
      applyStructuredDateAgePolicy({
        grid,
        policyId: "standard",
        jobSeed: JOB_SEED,
        visitDateColumn: "Fecha_Visita",
      });
      throw new Error("must not reach");
    } catch (error) {
      expect(error).toBeInstanceOf(StructuredDateAgePolicyError);
      expect((error as StructuredDateAgePolicyError).code).toBe("ambiguous-column");
    }
  });

  it("still resolves a unique header (falsation: the ambiguity rule is not a blanket rejection)", () => {
    const grid: StructuredGrid = {
      headers: ["Paciente", "Fecha_Visita"],
      rows: [["P-001", "2023-01-10"]],
    };
    const application = applyStructuredDateAgePolicy({
      grid,
      policyId: "standard",
      jobSeed: JOB_SEED,
      visitDateColumn: "Fecha_Visita",
    });
    expect(application.visitDate?.columnIndex).toBe(1);
  });
});
