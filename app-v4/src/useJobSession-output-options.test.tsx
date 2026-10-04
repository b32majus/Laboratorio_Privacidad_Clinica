import { act, renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { useJobSession } from "./useJobSession";
import type { StructuredGrid } from "./structured/grid";
import { VISIT_NUMBER_HEADER } from "./structured/output-options";
import { STUDY_ID_HEADER } from "./structured/study-id";

/**
 * REC-04 WU-B bridge oracles: the job-scoped output options live in the
 * bridge as domain state (never React-label-only), survive step navigation
 * within the Job, and re-derive output/gate state through the existing
 * structured bridge. Memory-only; synthetic fixtures only.
 */
const GRID: StructuredGrid = {
  headers: ["NHC", "Nota"],
  rows: [
    ["P-001", "nota a"],
    ["P-001", "nota b"],
    ["P-002", "nota c"],
  ],
};

function setup() {
  const { result } = renderHook(() => useJobSession());
  act(() => {
    result.current.create({
      type: "files",
      files: [{ name: "tabla.csv", extension: "csv" }],
    });
  });
  expect(result.current.job?.kind).toBe("structured");
  act(() => {
    result.current.installStructuredGrid(GRID);
  });
  return result;
}

function studyIds(result: { readonly current: ReturnType<typeof useJobSession> }) {
  const preparation = result.current.structured?.preparation;
  expect(preparation?.status).toBe("ready");
  if (preparation?.status !== "ready") return [];
  const index = preparation.output.safe.headers.indexOf(STUDY_ID_HEADER);
  return preparation.output.safe.rows.map((row) => row[index]);
}

describe("WU-B bridge — job-scoped output options authority", () => {
  it("starts with the PAC heritage default and no visit column before a patient authority exists", () => {
    const result = setup();
    expect(result.current.structuredOptions?.studyIdPrefix).toBe("PAC");
    expect(result.current.structuredOptions?.addVisitNumber).toBe(false);
    const preparation = result.current.structured?.preparation;
    expect(preparation?.status).toBe("blocked");
  });

  it("selecting a patient enables visit numbering by default and re-derives output and gate", () => {
    const result = setup();
    act(() => {
      result.current.selectStructuredPatientId("NHC");
    });
    act(() => {
      result.current.overrideStructuredColumn(1, "insensitive");
    });
    expect(result.current.structuredOptions?.addVisitNumber).toBe(true);
    const preparation = result.current.structured?.preparation;
    expect(preparation?.status).toBe("ready");
    if (preparation?.status !== "ready") return;
    expect(preparation.output.safe.headers).toEqual([STUDY_ID_HEADER, VISIT_NUMBER_HEADER, "Nota"]);
    const visitIndex = preparation.output.safe.headers.indexOf(VISIT_NUMBER_HEADER);
    expect(preparation.output.safe.rows.map((row) => row[visitIndex])).toEqual([1, 2, 1]);
    expect(studyIds(result)).toEqual(["PAC_001", "PAC_001", "PAC_002"]);
    expect(result.current.job?.outputs.safeOutputReady).toBe(true);
  });

  it("custom prefix hs1 reaches Safe output with identical grouping", () => {
    const result = setup();
    act(() => {
      result.current.selectStructuredPatientId("NHC");
    });
    act(() => {
      result.current.overrideStructuredColumn(1, "insensitive");
    });
    const before = studyIds(result);
    act(() => {
      result.current.setStructuredStudyIdPrefix("hs1");
    });
    expect(result.current.structuredOptions?.studyIdPrefix).toBe("hs1");
    const after = studyIds(result);
    expect(after).toEqual(["HS1_001", "HS1_001", "HS1_002"]);
    const groupOf = (ids: readonly unknown[]) => ids.map((id) => ids.indexOf(id));
    expect(groupOf(after)).toEqual(groupOf(before));
  });

  it("invalid prefix =CMD is an explicit invalid state: gate blocks, nothing exports", () => {
    const result = setup();
    act(() => {
      result.current.selectStructuredPatientId("NHC");
    });
    act(() => {
      result.current.overrideStructuredColumn(1, "insensitive");
    });
    act(() => {
      result.current.setStructuredStudyIdPrefix("=CMD");
    });
    // Stored verbatim (never sanitized into CMD), flagged invalid.
    expect(result.current.structuredOptions?.studyIdPrefix).toBe("=CMD");
    // SM-2: the invalid state is represented by the resolved TYPED value,
    // not a bare re-derived string; the reason surface derives from it.
    expect(result.current.structuredPrefixResolution?.status).toBe("invalid");
    expect(result.current.structuredPrefixResolution).toMatchObject({
      status: "invalid",
      reason: expect.stringMatching(/invalid/i),
    });
    expect(result.current.structuredPrefixInvalid).toBe(
      result.current.structuredPrefixResolution?.status === "invalid"
        ? result.current.structuredPrefixResolution.reason
        : null
    );
    const preparation = result.current.structured?.preparation;
    expect(preparation?.status).toBe("blocked");
    if (preparation?.status !== "blocked") return;
    expect(preparation.output).toBeNull();
    expect(preparation.reasons.join(" ")).toMatch(/prefix.*invalid|invalid.*prefix/i);
    expect(result.current.job?.outputs.safeOutputReady).toBe(false);
    // Fixing the prefix re-opens the gate through the same bridge.
    act(() => {
      result.current.setStructuredStudyIdPrefix("PAC");
    });
    expect(result.current.structured?.preparation.status).toBe("ready");
    expect(result.current.job?.outputs.safeOutputReady).toBe(true);
  });

  it("disabling visit numbering removes the column; options survive step navigation", () => {
    const result = setup();
    act(() => {
      result.current.selectStructuredPatientId("NHC");
    });
    act(() => {
      result.current.overrideStructuredColumn(1, "insensitive");
    });
    act(() => {
      result.current.setStructuredAddVisitNumber(false);
    });
    expect(result.current.structured?.preparation.status).toBe("ready");
    if (result.current.structured?.preparation.status !== "ready") return;
    expect(result.current.structured.preparation.output.safe.headers).not.toContain(
      VISIT_NUMBER_HEADER
    );
    act(() => {
      result.current.setStructuredStudyIdPrefix("hs1");
    });
    // Navigate across the shell in canonical order (forward then back over
    // visited steps): options and derived output persist.
    for (const step of ["configure", "review", "privacy-gate", "configure", "review"] as const) {
      act(() => {
        result.current.navigate(step);
      });
    }
    expect(result.current.structuredOptions?.studyIdPrefix).toBe("hs1");
    expect(result.current.structuredOptions?.addVisitNumber).toBe(false);
    expect(studyIds(result)).toEqual(["HS1_001", "HS1_001", "HS1_002"]);
    if (result.current.structured?.preparation.status !== "ready") return;
    expect(result.current.structured.preparation.output.safe.headers).not.toContain(
      VISIT_NUMBER_HEADER
    );
  });

  it("clearing the patient authority drops visit numbering as effectively absent", () => {
    const result = setup();
    act(() => {
      result.current.selectStructuredPatientId("NHC");
    });
    act(() => {
      result.current.overrideStructuredColumn(1, "insensitive");
    });
    expect(result.current.structuredOptions?.addVisitNumber).toBe(true);
    act(() => {
      result.current.selectStructuredPatientId(null);
    });
    expect(result.current.structuredOptions?.addVisitNumber).toBe(false);
    const preparation = result.current.structured?.preparation;
    expect(preparation?.status).toBe("ready");
    if (preparation?.status !== "ready") return;
    expect(preparation.output.safe.headers).not.toContain(STUDY_ID_HEADER);
    expect(preparation.output.safe.headers).not.toContain(VISIT_NUMBER_HEADER);
  });

  it("a new job resets the options; no cross-job leakage", () => {
    const result = setup();
    act(() => {
      result.current.selectStructuredPatientId("NHC");
    });
    act(() => {
      result.current.setStructuredStudyIdPrefix("hs1");
    });
    act(() => {
      result.current.create({
        type: "files",
        files: [{ name: "otra.csv", extension: "csv" }],
      });
    });
    expect(result.current.structuredOptions).toBeNull();
    expect(result.current.structured).toBeNull();
  });
});
