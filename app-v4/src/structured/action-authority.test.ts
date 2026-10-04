import { describe, expect, it } from "vitest";

import {
  StructuredConfigurationError,
  createStructuredConfiguration,
  isStructuredExportReady,
  overrideColumnAction,
  overrideColumnClass,
  selectPatientIdColumn,
  setStructuredDateRole,
} from "./configuration";
import type { StructuredGrid } from "./grid";
import { buildStructuredTransformPlan } from "./transform-plan";
import { prepareStructuredOutput } from "./transformed-dataset";

/**
 * REC-03 WU-B (D-021) deterministic oracles: effective class and effective
 * productive Action are separate domain facts. Synthetic fixtures only.
 *
 * Columns: NHC (identifier), Centro (center/ward quasi), CP (postal-code
 * quasi), Diagnostico (sensitive), CampoLibre (unknown).
 */
const GRID: StructuredGrid = {
  headers: ["NHC", "Centro", "CP", "Diagnostico", "CampoLibre"],
  rows: [
    ["P-001", "Centro A", "28001", "Gripe A", "nota libre"],
    ["P-001", "Centro A", "28002", "Fractura", "seguimiento"],
    ["P-002", "Centro B", "28001", "Gripe A", null],
    ["P-003", null, "28003", "Gripe A", ""],
  ],
};

describe("WU-B — D-021 derived effective Action (class and Action are separate facts)", () => {
  it("derives remove / pseudonymize(proposed) / review-required / keep / review-required", () => {
    const config = createStructuredConfiguration(GRID);
    const byHeader = new Map(config.columns.map((column) => [column.header, column]));
    expect(byHeader.get("NHC")?.effectiveClass).toBe("identifier");
    expect(byHeader.get("NHC")?.effectiveAction).toBe("remove");
    expect(byHeader.get("Centro")?.effectiveClass).toBe("quasi-identifier");
    expect(byHeader.get("Centro")?.effectiveAction).toBe("pseudonymize");
    expect(byHeader.get("Centro")?.actionSource).toBe("proposed");
    expect(byHeader.get("CP")?.effectiveClass).toBe("quasi-identifier");
    expect(byHeader.get("CP")?.effectiveAction).toBe("review-required");
    expect(byHeader.get("Diagnostico")?.effectiveClass).toBe("sensitive");
    expect(byHeader.get("Diagnostico")?.effectiveAction).toBe("keep");
    expect(byHeader.get("CampoLibre")?.effectiveClass).toBe("unknown");
    expect(byHeader.get("CampoLibre")?.effectiveAction).toBe("review-required");
  });

  it("an ordinary Identifier resolves to remove (never study-id without selection)", () => {
    const config = createStructuredConfiguration(GRID);
    const plan = buildStructuredTransformPlan(config, { policyId: "standard", jobSeed: "wub" });
    expect(plan.columns.find((c) => c.header === "NHC")?.disposition).toEqual({
      kind: "remove",
    });
  });

  it("a Sensitive clinical column defaults to Keep", () => {
    const config = createStructuredConfiguration(GRID);
    expect(config.columns.find((c) => c.header === "Diagnostico")?.effectiveAction).toBe("keep");
    const plan = buildStructuredTransformPlan(config, { policyId: "standard", jobSeed: "wub" });
    expect(plan.columns.find((c) => c.header === "Diagnostico")?.disposition).toEqual({
      kind: "keep",
    });
  });

  it("a non-date quasi (postal code) stays review-required until an explicit allowed action", () => {
    const config = createStructuredConfiguration(GRID);
    const cp = config.columns.find((c) => c.header === "CP");
    expect(cp?.effectiveAction).toBe("review-required");
    expect(cp?.requiresReview).toBe(true);
    expect(config.columnsRequiringReview).toContain(2);
    expect(config.exportReady).toBe(false);
    expect(isStructuredExportReady(config)).toBe(false);
    const plan = buildStructuredTransformPlan(config, { policyId: "standard", jobSeed: "wub" });
    expect(plan.dispositionsReady).toBe(false);
    expect(plan.columns.find((c) => c.header === "CP")?.disposition.kind).toBe("unsupported");
  });
});

describe("WU-B — stronger authorities lock the Action (cannot be contradicted)", () => {
  it("the selected patient-ID column is study-id and rejects any action override", () => {
    const config = selectPatientIdColumn(createStructuredConfiguration(GRID), "NHC");
    expect(config.columns[0].effectiveAction).toBe("study-id");
    expect(config.columns[0].actionLocked).toBe(true);
    expect(() => overrideColumnAction(config, 0, "remove")).toThrow(StructuredConfigurationError);
    expect(() => overrideColumnAction(config, 0, "keep")).toThrow(StructuredConfigurationError);
    try {
      overrideColumnAction(config, 0, "remove");
    } catch (error) {
      expect((error as StructuredConfigurationError).code).toBe("invalid-action");
    }
    // A class override cannot displace the patient-ID disposition either.
    const plan = buildStructuredTransformPlan(overrideColumnClass(config, 0, "sensitive"), {
      policyId: "standard",
      jobSeed: "wub",
    });
    expect(plan.columns[0].disposition).toEqual({ kind: "study-id" });
  });

  it("an explicit visit/birth date role is date-policy and rejects any action override", () => {
    const config = setStructuredDateRole(createStructuredConfiguration(GRID), 2, "visit");
    expect(config.columns[2].effectiveAction).toBe("date-policy");
    expect(config.columns[2].actionLocked).toBe(true);
    expect(() => overrideColumnAction(config, 2, "keep")).toThrow(StructuredConfigurationError);
    expect(() => overrideColumnAction(config, 2, "pseudonymize")).toThrow(
      StructuredConfigurationError
    );
    const plan = buildStructuredTransformPlan(config, { policyId: "standard", jobSeed: "wub" });
    expect(plan.columns.find((c) => c.header === "CP")?.disposition).toEqual({
      kind: "date-age",
      role: "visit-date",
    });
  });
});

describe("WU-B — bounded explicit Action choices (typed/closed)", () => {
  it("a non-date quasi accepts pseudonymize or keep, then review-required clears back to unresolved", () => {
    const base = createStructuredConfiguration(GRID);
    const pseudo = overrideColumnAction(base, 2, "pseudonymize");
    expect(pseudo.columns[2].effectiveAction).toBe("pseudonymize");
    expect(pseudo.columns[2].actionSource).toBe("explicit");
    const kept = overrideColumnAction(base, 2, "keep");
    expect(kept.columns[2].effectiveAction).toBe("keep");
    // The frozen configuration is rebuilt, not mutated in place.
    expect(pseudo).not.toBe(base);
    expect(base.columns[2].effectiveAction).toBe("review-required");
    // Clearing back to review-required restores the unresolved default.
    const cleared = overrideColumnAction(pseudo, 2, "review-required");
    expect(cleared.columns[2].effectiveAction).toBe("review-required");
    expect(cleared.exportReady).toBe(false);
  });

  it("Unknown never becomes Keep directly while remaining Unknown", () => {
    const config = createStructuredConfiguration(GRID);
    expect(() => overrideColumnAction(config, 4, "keep")).toThrow(StructuredConfigurationError);
    expect(() => overrideColumnAction(config, 4, "pseudonymize")).toThrow(
      StructuredConfigurationError
    );
    try {
      overrideColumnAction(config, 4, "keep");
    } catch (error) {
      expect((error as StructuredConfigurationError).code).toBe("invalid-action");
      expect((error as Error).message).toMatch(/Unknown.*class/i);
    }
    // The only path is changing the class: then Keep follows the new class.
    const resolved = overrideColumnClass(config, 4, "insensitive");
    expect(resolved.columns[4].effectiveClass).toBe("insensitive");
    expect(resolved.columns[4].effectiveAction).toBe("keep");
  });

  it("invalid action/class combinations fail typed/closed", () => {
    const config = createStructuredConfiguration(GRID);
    // Ordinary identifier: remove only.
    expect(() => overrideColumnAction(config, 0, "pseudonymize")).toThrow(
      StructuredConfigurationError
    );
    expect(() => overrideColumnAction(config, 0, "keep")).toThrow(StructuredConfigurationError);
    // Sensitive: keep only.
    expect(() => overrideColumnAction(config, 3, "pseudonymize")).toThrow(
      StructuredConfigurationError
    );
    expect(() => overrideColumnAction(config, 3, "remove")).toThrow(StructuredConfigurationError);
    // Outside the closed vocabulary.
    expect(() =>
      // @ts-expect-error deliberately invalid action
      overrideColumnAction(config, 2, "generalize")
    ).toThrow(StructuredConfigurationError);
    try {
      // @ts-expect-error deliberately invalid action
      overrideColumnAction(config, 2, "generalize");
    } catch (error) {
      expect((error as StructuredConfigurationError).code).toBe("invalid-action");
    }
    // Out-of-range column.
    expect(() => overrideColumnAction(config, 99, "keep")).toThrow(StructuredConfigurationError);
  });
});

describe("WU-B — deterministic QID pseudonymization (column-local, Confidential-only)", () => {
  function productiveConfig() {
    let config = createStructuredConfiguration(GRID, { selectedPatientIdColumn: "NHC" });
    config = overrideColumnAction(config, 2, "pseudonymize");
    config = overrideColumnClass(config, 4, "insensitive");
    return config;
  }

  it("center/ward quasi proposes and productively executes pseudonymize with stable QID tokens", () => {
    const config = productiveConfig();
    const preparation = prepareStructuredOutput(
      config,
      buildStructuredTransformPlan(config, { policyId: "standard", jobSeed: "wub-qid" })
    );
    expect(preparation.status).toBe("ready");
    if (preparation.status !== "ready") return;
    const { safe, confidential } = preparation.output;
    expect(safe.headers).toContain("Centro");
    const centroIndex = safe.headers.indexOf("Centro");
    expect(safe.rows.map((row) => row[centroIndex])).toEqual(["QID_001", "QID_001", "QID_002", ""]);
    // Repeated values reuse the same token; blanks stay blank.
    const cpIndex = safe.headers.indexOf("CP");
    expect(safe.rows.map((row) => row[cpIndex])).toEqual([
      "QID_001",
      "QID_002",
      "QID_001",
      "QID_003",
    ]);
    // Tokens are column-local: the same original in two columns maps independently.
    expect(centroIndex).not.toBe(cpIndex);
    // No original quasi values leak into Safe output.
    const safeJson = JSON.stringify(safe);
    expect(safeJson).not.toContain("Centro A");
    expect(safeJson).not.toContain("28001");
    // Correspondence is Confidential-only and carries original<->token entries.
    const confidentialJson = JSON.stringify(confidential);
    expect(confidentialJson).toContain("Centro A");
    expect(confidentialJson).toContain("QID_001");
    const centroColumn = confidential.columns.find((c) => c.header === "Centro");
    expect(centroColumn?.disposition).toBe("pseudonymize");
    expect(centroColumn?.entries).toContainEqual({ original: "Centro A", transformed: "QID_001" });
    expect(centroColumn?.entries).toContainEqual({ original: "Centro B", transformed: "QID_002" });
    // Blanks never enter the mapping.
    expect((centroColumn?.entries ?? []).every((entry) => entry.original !== "")).toBe(true);
  });

  it("is deterministic: the same input twice yields identical tokens", () => {
    const first = prepareStructuredOutput(
      productiveConfig(),
      buildStructuredTransformPlan(productiveConfig(), { policyId: "standard", jobSeed: "wub-qid" })
    );
    const second = prepareStructuredOutput(
      productiveConfig(),
      buildStructuredTransformPlan(productiveConfig(), { policyId: "standard", jobSeed: "wub-qid" })
    );
    expect(first.status).toBe("ready");
    expect(second.status).toBe("ready");
    if (first.status !== "ready" || second.status !== "ready") return;
    expect(JSON.stringify(first.output.safe)).toBe(JSON.stringify(second.output.safe));
  });
});

describe("WU-B — planted/negative oracle: unresolved quasi stays blocked", () => {
  it("an unresolved quasi blocks preparation with an exact reason (never silently kept)", () => {
    const config = createStructuredConfiguration(GRID, { selectedPatientIdColumn: "NHC" });
    const preparation = prepareStructuredOutput(
      config,
      buildStructuredTransformPlan(config, { policyId: "standard", jobSeed: "wub-neg" })
    );
    expect(preparation.status).toBe("blocked");
    if (preparation.status !== "blocked") return;
    expect(preparation.output).toBeNull();
    // CP (postal quasi) and CampoLibre (unknown) both require review.
    expect(config.columnsRequiringReview).toEqual(expect.arrayContaining([2, 4]));
    expect(preparation.reasons.join(" ")).toMatch(/requires review/);
  });
});
