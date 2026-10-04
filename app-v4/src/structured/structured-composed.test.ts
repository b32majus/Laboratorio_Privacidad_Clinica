import { describe, expect, it } from "vitest";

import { FLOW_STEPS, type Job } from "../domain/job";
import type { RegistryEngineInput } from "../engine/registry-engine";
import type { EngineOutcome } from "../engine/types";
import { CONFIDENTIAL_AUDIT_WARNING_LINE } from "../output/confidential-audit-serializer";
import { derivePrivacyGateView } from "../privacy-gate/privacyGateModel";
import {
  applyDecision,
  canFinalize,
  getFinalText,
  type ReviewSession,
} from "../review/review-domain";
import {
  STRUCTURED_ACTIONS,
  STRUCTURED_COLUMN_CLASSES,
  createStructuredConfiguration,
  overrideColumnAction,
  setStructuredDateRole,
  type StructuredConfiguration,
} from "./configuration";
import { processStructuredFreeTextCells } from "./free-text";
import type { StructuredGrid } from "./grid";
import { buildStructuredTransformPlan } from "./transform-plan";
import { prepareStructuredOutput } from "./transformed-dataset";
import { serializeStructuredSafeCsv } from "./csv-writer";
import { serializeStructuredConfidentialAudit } from "./structured-confidential-audit";

/**
 * REC-03 WU-D composed oracles: Study ID + action authority + free-text
 * review + existing T19 semantics compose through one synthetic multi-row
 * structured Job with no seam gaps. Synthetic fixtures only; no real PHI.
 *
 * Job shape: repeated patients (P-001 twice, P-002 once), visit/birth dates,
 * a center quasi-identifier, a kept diagnosis, a free-text column with one
 * blank cell, and a second direct identifier (DNI) that must be removed.
 */
const GRID: StructuredGrid = {
  headers: ["NHC", "DNI", "Fecha_Visita", "Fecha_Nacimiento", "Centro", "Diagnostico", "Notas"],
  rows: [
    [
      "P-001",
      "12345678A",
      "2023-01-10",
      "1954-03-12",
      "Centro Norte",
      "Gripe A",
      "Paciente Carmen Sánchez atendida el 12/03/2024",
    ],
    [
      "P-001",
      "12345678A",
      "2023-02-14",
      "1954-03-12",
      "Centro Norte",
      "Gripe A",
      "Control de Carmen Sánchez el 20/03/2024",
    ],
    ["P-002", "87654321B", "2023-03-15", "1980-07-04", "Centro Sur", "Fractura", ""],
  ],
};

const JOB_SEED = "wud-composed";

function configured(): StructuredConfiguration {
  let configuration = createStructuredConfiguration(GRID, {
    selectedPatientIdColumn: "NHC",
  });
  configuration = setStructuredDateRole(configuration, 2, "visit");
  configuration = setStructuredDateRole(configuration, 3, "birth");
  configuration = overrideColumnAction(configuration, 6, "process-as-text");
  return configuration;
}

/** Deterministic stub engine: one NOMBRE detection per cell mentioning the name. */
function stubEngine() {
  let counter = 0;
  return {
    async process(input: RegistryEngineInput): Promise<EngineOutcome> {
      counter += 1;
      const name = "Carmen Sánchez";
      const start = input.text.indexOf(name);
      const entities =
        start >= 0
          ? [
              {
                type: "NOMBRE",
                text: name,
                original: name,
                position: { start, end: start + name.length },
                confidence: 0.9,
                transformed: `PACIENTE_${counter}`,
              },
            ]
          : [];
      return {
        result: {
          original: input.text,
          processed: input.text,
          entities,
          alerts: [],
          stats: { totalEntities: entities.length, byType: {} },
          sessionId: `wud-stub-${counter}`,
          processingTime: 0,
        },
        context: { mode: "shared" as const },
      };
    },
  };
}

function acceptAll(session: ReviewSession): ReviewSession {
  let next = session;
  for (const detection of session.detections) {
    next = applyDecision(next, detection.id, "accepted");
  }
  return next;
}

async function reviewedState(policyId: "standard" | "external-ai" = "standard") {
  const config = configured();
  const state = await processStructuredFreeTextCells({
    jobId: JOB_SEED,
    jobName: JOB_SEED,
    policyId,
    configuration: config,
    engine: stubEngine(),
  });
  return {
    config,
    state: {
      ...state,
      cells: state.cells.map((cell) =>
        cell.ok ? { ...cell, session: acceptAll(cell.session) } : cell
      ),
    },
  };
}

function structuredJob(policyId: Job["policyId"], ready: boolean): Job {
  return {
    kind: "structured",
    id: JOB_SEED,
    policyId,
    outputs: { safeOutputReady: ready, confidentialAuditReady: ready },
    errors: [],
  } as unknown as Job;
}

describe("WU-D — composed effective Action table (D-021, no seam gaps)", () => {
  it("derives the exact Study-ID + date-policy + remove + pseudonymize + keep + free-text table", () => {
    const config = configured();
    const byHeader = new Map(config.columns.map((column) => [column.header, column]));
    expect(byHeader.get("NHC")?.effectiveAction).toBe("study-id");
    expect(byHeader.get("NHC")?.actionLocked).toBe(true);
    expect(byHeader.get("Fecha_Visita")?.effectiveAction).toBe("date-policy");
    expect(byHeader.get("Fecha_Visita")?.actionLocked).toBe(true);
    expect(byHeader.get("Fecha_Nacimiento")?.effectiveAction).toBe("date-policy");
    expect(byHeader.get("Fecha_Nacimiento")?.actionLocked).toBe(true);
    expect(byHeader.get("DNI")?.effectiveAction).toBe("remove");
    expect(byHeader.get("Centro")?.effectiveAction).toBe("pseudonymize");
    expect(byHeader.get("Centro")?.actionSource).toBe("proposed");
    expect(byHeader.get("Diagnostico")?.effectiveAction).toBe("keep");
    expect(byHeader.get("Notas")?.effectiveAction).toBe("process-as-text");
    expect(byHeader.get("Notas")?.actionSource).toBe("explicit");
    expect(config.columnsRequiringReview).toEqual([]);
    expect(config.exportReady).toBe(true);
  });

  it("fails closed on invalid class-action combinations (falsification oracle b)", () => {
    const fresh = createStructuredConfiguration(GRID, { selectedPatientIdColumn: "NHC" });
    // Unknown "Notas" can never become KEEP directly while remaining Unknown.
    expect(() => overrideColumnAction(fresh, 6, "keep")).toThrow(/while remaining Unknown/);
    // The locked patient-ID authority cannot be contradicted.
    expect(() => overrideColumnAction(configured(), 0, "remove")).toThrow(/locked derived action/);
    // A locked date-role authority cannot be contradicted either.
    expect(() => overrideColumnAction(configured(), 2, "keep")).toThrow(/locked derived action/);
  });
});

describe("WU-D — composed Safe CSV facts", () => {
  it("carries ID_ESTUDIO linkage, transformed dates/ages, QID tokens, reviewed free text and kept diagnosis with no originals", async () => {
    const { config, state } = await reviewedState();
    for (const cell of state.cells) {
      if (cell.ok) expect(canFinalize(cell.session)).toBe(true);
    }
    const plan = buildStructuredTransformPlan(config, { policyId: "standard", jobSeed: JOB_SEED });
    expect(plan.dispositionsReady).toBe(true);
    const preparation = prepareStructuredOutput(config, plan, { freeText: state });
    expect(preparation.status).toBe("ready");
    if (preparation.status !== "ready") return;

    const safeCsv = serializeStructuredSafeCsv(preparation.output.safe);
    const lines = safeCsv.split("\n");
    // Header: DNI removed, patient ID replaced in place by ID_ESTUDIO.
    expect(lines[0]).toBe("ID_ESTUDIO,Fecha_Visita,Fecha_Nacimiento,Centro,Diagnostico,Notas");
    expect(lines).toHaveLength(4);

    const studyIds = preparation.output.safe.rows.map((row) => row[0]);
    expect(studyIds).toEqual(["PAC_001", "PAC_001", "PAC_002"]);

    // Transformed visit/birth months (T19 generalize-month under standard).
    const visits = preparation.output.safe.rows.map((row) => row[1]);
    expect(visits).toEqual(["2023-01", "2023-02", "2023-03"]);
    const births = preparation.output.safe.rows.map((row) => row[2]);
    expect(births).toEqual(["1954-03", "1954-03", "1980-07"]);

    // Deterministic column-local QID tokens with first-appearance reuse.
    const centers = preparation.output.safe.rows.map((row) => row[3]);
    expect(centers).toEqual(["QID_001", "QID_001", "QID_002"]);

    // Kept diagnosis as configured (Sensitive defaults to Keep).
    expect(preparation.output.safe.rows[0][4]).toBe("Gripe A");
    expect(preparation.output.safe.rows[2][4]).toBe("Fractura");

    // Reviewed free text equals canonical getFinalText; the blank stays blank.
    const finals = state.cells.map((cell) => (cell.ok ? getFinalText(cell.session) : "<failed>"));
    expect(finals).toHaveLength(2);
    expect(preparation.output.safe.rows.map((row) => row[5])).toEqual([finals[0], finals[1], null]);

    // No leak: no original patient ID, no removed DNI, no exact date, no
    // unreviewed name, no kept-diagnosis correspondence confusion in Safe.
    for (const leaked of [
      "P-001",
      "P-002",
      "12345678A",
      "87654321B",
      "2023-01-10",
      "1954-03-12",
      "Carmen Sánchez",
    ]) {
      expect(safeCsv).not.toContain(leaked);
    }
    expect(safeCsv).not.toContain("->");
  });

  it("keeps the Confidential correspondence separate with the allowed mappings/originals", async () => {
    const { config, state } = await reviewedState();
    const plan = buildStructuredTransformPlan(config, { policyId: "standard", jobSeed: JOB_SEED });
    const preparation = prepareStructuredOutput(config, plan, { freeText: state });
    expect(preparation.status).toBe("ready");
    if (preparation.status !== "ready") return;

    const audit = serializeStructuredConfidentialAudit(preparation.output.confidential);
    expect(audit.startsWith(CONFIDENTIAL_AUDIT_WARNING_LINE)).toBe(true);
    // Study-ID mapping, removed DNI originals, QID mapping, free-text pairs.
    expect(audit).toContain("P-001 -> PAC_001");
    expect(audit).toContain("P-002 -> PAC_002");
    expect(audit).toContain("12345678A -> (removed)");
    expect(audit).toContain("Centro Norte -> QID_001");
    expect(audit).toContain("Centro Sur -> QID_002");
    for (const cell of state.cells) {
      if (!cell.ok) continue;
      expect(audit).toContain(cell.cell.original);
      expect(audit).toContain(getFinalText(cell.session));
    }
    // Kept columns carry no correspondence: the diagnosis never enters audit.
    expect(audit).not.toContain("Gripe A");
    expect(audit).not.toContain("Fractura");
  });
});

describe("WU-D — Gate and Export stay closed on unresolved state (falsification oracles a/c)", () => {
  it("UNKNOWN / unresolved quasi keeps the structured gate closed with exact reasons", () => {
    const unresolved = createStructuredConfiguration(GRID);
    // "Notas" is Unknown and "Fecha_Visita"/"Centro" are unresolved quasis.
    expect(unresolved.columnsRequiringReview.length).toBeGreaterThan(0);
    const plan = buildStructuredTransformPlan(unresolved, {
      policyId: "standard",
      jobSeed: JOB_SEED,
    });
    expect(plan.dispositionsReady).toBe(false);
    const preparation = prepareStructuredOutput(unresolved, plan);
    expect(preparation.status).toBe("blocked");
    if (preparation.status !== "blocked") return;
    expect(preparation.output).toBeNull();
    expect(preparation.reasons.join(" ")).toMatch(/requires review/);

    const view = derivePrivacyGateView(structuredJob("standard", false), null, [], {
      configuration: unresolved,
      plan,
      preparation,
    });
    expect(view.complete).toBe(false);
    expect(view.safeOutputReady).toBe(false);
    expect(view.structured?.ready).toBe(false);
    expect(view.structured?.reasons.length).toBeGreaterThan(0);
    expect(view.pendingCount).toBe(unresolved.columnsRequiringReview.length);
  });

  it("an unprocessed free-text configuration never yields Safe bytes (review bypass)", async () => {
    const config = configured();
    const plan = buildStructuredTransformPlan(config, { policyId: "standard", jobSeed: JOB_SEED });
    // The plan itself is structurally ready, but without the free-text review
    // state preparation blocks — there is no path around review.
    const preparation = prepareStructuredOutput(config, plan);
    expect(preparation.status).toBe("blocked");
    if (preparation.status !== "blocked") return;
    expect(preparation.reasons.join(" ")).toMatch(/free-text/);
  });

  it("a free-text processing failure keeps Gate and Export closed without keeping the original", async () => {
    const config = configured();
    const failing = {
      async process(input: RegistryEngineInput): Promise<EngineOutcome> {
        if (input.text.includes("20/03/2024")) {
          const { EngineError } = await import("../engine/types");
          throw new EngineError("invalid-text", "wud stub refused the second cell");
        }
        return stubEngine().process(input);
      },
    };
    const state = await processStructuredFreeTextCells({
      jobId: JOB_SEED,
      jobName: JOB_SEED,
      policyId: "standard",
      configuration: config,
      engine: failing,
    });
    const plan = buildStructuredTransformPlan(config, { policyId: "standard", jobSeed: JOB_SEED });
    const preparation = prepareStructuredOutput(config, plan, { freeText: state });
    expect(preparation.status).toBe("blocked");
    if (preparation.status !== "blocked") return;
    expect(preparation.output).toBeNull();
    expect(preparation.reasons.join(" ")).toMatch(/failed/i);
    expect(preparation.reasons.join("\n")).not.toContain("Paciente Carmen");

    const view = derivePrivacyGateView(structuredJob("standard", false), null, [], {
      configuration: config,
      plan,
      preparation,
    });
    expect(view.complete).toBe(false);
    expect(view.structured?.ready).toBe(false);
  });

  it("a ready composed preparation opens the structured gate with zero pending", async () => {
    const { config, state } = await reviewedState();
    const plan = buildStructuredTransformPlan(config, { policyId: "standard", jobSeed: JOB_SEED });
    const preparation = prepareStructuredOutput(config, plan, { freeText: state });
    expect(preparation.status).toBe("ready");
    if (preparation.status !== "ready") return;
    const view = derivePrivacyGateView(structuredJob("standard", true), null, [], {
      configuration: config,
      plan,
      preparation,
    });
    expect(view.complete).toBe(true);
    expect(view.pendingCount).toBe(0);
    expect(view.safeOutputReady).toBe(true);
    expect(view.structured?.ready).toBe(true);
    expect(view.structured?.reasons).toEqual([]);
  });
});

describe("WU-D — policy switch re-derives structured date/age and free-text state (no stale certification)", () => {
  it("finalized standard sessions cannot certify an external-ai plan", async () => {
    const { config, state } = await reviewedState("standard");
    const switched = buildStructuredTransformPlan(config, {
      policyId: "external-ai",
      jobSeed: JOB_SEED,
    });
    const stale = prepareStructuredOutput(config, switched, { freeText: state });
    expect(stale.status).toBe("blocked");
    if (stale.status !== "blocked") return;
    expect(stale.output).toBeNull();
    expect(stale.reasons.join(" ")).toMatch(/polic/i);
  });

  it("reprocessing under the new policy yields re-derived dates with no stale values", async () => {
    const standard = await reviewedState("standard");
    const standardPlan = buildStructuredTransformPlan(standard.config, {
      policyId: "standard",
      jobSeed: JOB_SEED,
    });
    const standardPrep = prepareStructuredOutput(standard.config, standardPlan, {
      freeText: standard.state,
    });
    expect(standardPrep.status).toBe("ready");
    if (standardPrep.status !== "ready") return;

    const switched = await reviewedState("external-ai");
    const switchedPlan = buildStructuredTransformPlan(switched.config, {
      policyId: "external-ai",
      jobSeed: JOB_SEED,
    });
    const switchedPrep = prepareStructuredOutput(switched.config, switchedPlan, {
      freeText: switched.state,
    });
    expect(switchedPrep.status).toBe("ready");
    if (switchedPrep.status !== "ready") return;

    const standardCsv = serializeStructuredSafeCsv(standardPrep.output.safe);
    const switchedCsv = serializeStructuredSafeCsv(switchedPrep.output.safe);
    // T19 re-derivation: visit generalize-month ("2023-01") vs per-patient
    // shift (full shifted date); birth generalize-month vs banded age at event.
    expect(standardCsv).toContain("2023-01");
    expect(switchedCsv).not.toContain("2023-01");
    expect(switchedCsv).not.toContain("1954-03");
    expect(standardCsv).not.toBe(switchedCsv);
    // Study-ID linkage and QID tokens survive the policy switch unchanged.
    for (const csv of [standardCsv, switchedCsv]) {
      expect(csv.split("\n").map((line) => line.split(",")[0])).toEqual([
        "ID_ESTUDIO",
        "PAC_001",
        "PAC_001",
        "PAC_002",
      ]);
      expect(csv).toContain("QID_001");
      expect(csv).not.toContain("P-001");
      expect(csv).not.toContain("2023-01-10");
    }
  });
});

describe("WU-D — no new app route/page/mode/class appears", () => {
  it("keeps the single five-step shell and the exact five-class vocabulary", () => {
    expect(FLOW_STEPS).toEqual(["input", "configure", "review", "privacy-gate", "export"]);
    expect(STRUCTURED_COLUMN_CLASSES).toEqual([
      "identifier",
      "quasi-identifier",
      "sensitive",
      "insensitive",
      "unknown",
    ]);
    // process-as-text is an Action, never a sixth class.
    expect(STRUCTURED_COLUMN_CLASSES).not.toContain("process-as-text");
    expect(STRUCTURED_ACTIONS).toContain("process-as-text");
  });
});
