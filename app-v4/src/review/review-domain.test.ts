import { describe, expect, it } from "vitest";

import { beginItemRead, createJob, recordItemRead, setPolicy, type Job } from "../domain/job";
import { createRegistryEngine } from "../engine/registry-engine";
import { DateOperatorError } from "../engine/date-operator";
import { PolicyError } from "../engine/policy";
import {
  ReviewSessionError,
  addManualDetection,
  applyDecision,
  canFinalize,
  createSessionFromEngineTextAsync,
  createReviewSession,
  getDecision,
  getFinalText,
  getProgress,
  jobSourceText,
  jobSupportsReview,
  processBatchItem,
  startReviewSessionAsync,
  type ReviewSession,
} from "./review-domain";

/**
 * Domain-level integration oracles for Work Order T07: real legacy engine
 * run → real ReviewSession transitions → final text. All fixtures are
 * synthetic Spanish clinical-style text; no real content anywhere.
 */
const ENGINE_TEXT =
  "Nombre: Carmen Sánchez\nLa paciente fue atendida por el Dr. García López el 12/03/2024. Contacto: 612345678.";

/** Handcrafted deterministic session for offset-precise assertions. */
const SOURCE = "Nombre: Carmen Sánchez\nTeléfono 612345678. NHC 2024/089756.";
const NAME_START = SOURCE.indexOf("Carmen Sánchez");
const NAME_END = NAME_START + "Carmen Sánchez".length;
const PHONE_START = SOURCE.indexOf("612345678");
const PHONE_END = PHONE_START + "612345678".length;
const NHC_START = SOURCE.indexOf("2024/089756");
const NHC_END = NHC_START + "2024/089756".length;

function handcraftedSession(): ReviewSession {
  return createReviewSession({
    originalText: SOURCE,
    detections: [
      {
        type: "NOMBRE",
        start: NAME_START,
        end: NAME_END,
        confidence: 0.95,
        proposed: "PACIENTE-1",
      },
      { type: "IDENTIFICADOR", start: PHONE_START, end: PHONE_END, confidence: 0.6, proposed: "" },
      { type: "IDENTIFICADOR", start: NHC_START, end: NHC_END, confidence: 0.9, proposed: "ID-1" },
    ],
    sessionId: "test-session",
  });
}

describe("full-path integration: engine → session → decisions → final text", () => {
  it("builds a pending review session from a real engine run", async () => {
    const session = await createSessionFromEngineTextAsync(ENGINE_TEXT, "standard");
    expect(session.originalText).toBe(ENGINE_TEXT);
    expect(session.detections.length).toBeGreaterThan(0);
    // Offsets stay canonical: `original` is re-derived from the source text.
    for (const detection of session.detections) {
      expect(detection.original).toBe(ENGINE_TEXT.slice(detection.start, detection.end));
    }
    const progress = getProgress(session);
    expect(progress.pending).toBe(session.detections.length);
    expect(progress.canFinalize).toBe(false);
  });

  it("keeps getFinalText fail-closed while mandatory review is pending", async () => {
    const session = await createSessionFromEngineTextAsync(ENGINE_TEXT, "standard");
    expect(canFinalize(session)).toBe(false);
    try {
      getFinalText(session);
      throw new Error("expected getFinalText to throw while review is pending");
    } catch (error) {
      expect(error).toBeInstanceOf(ReviewSessionError);
      expect((error as ReviewSessionError).code).toBe("MANDATORY_REVIEW_PENDING");
    }
  });

  it("composes exact final text after every detection is explicitly decided", async () => {
    const session = await createSessionFromEngineTextAsync(ENGINE_TEXT, "standard");
    let decided = session;
    for (const detection of session.detections) {
      decided = applyDecision(decided, detection.id, "accepted");
    }
    expect(canFinalize(decided)).toBe(true);
    const finalText = getFinalText(decided);
    expect(typeof finalText).toBe("string");
    // Accepted proposals replaced every engine span; the original values are gone.
    for (const detection of decided.detections) {
      if (detection.proposed !== undefined && detection.proposed !== detection.original) {
        expect(finalText).not.toContain(detection.original);
      }
    }
  });
});

describe("decision semantics over a deterministic session", () => {
  it("modify changes the exact final-domain replacement, not only markup", async () => {
    const session = handcraftedSession();
    // Restore every other span so the modified detection is the only edit.
    let next = session;
    next = applyDecision(next, session.detections[1].id, "restored");
    next = applyDecision(next, session.detections[2].id, "restored");
    next = applyDecision(next, session.detections[0].id, "modified", {
      replacement: "PACIENTE REEMPLAZO",
    });
    expect(canFinalize(next)).toBe(true);
    const expected = SOURCE.slice(0, NAME_START) + "PACIENTE REEMPLAZO" + SOURCE.slice(NAME_END);
    expect(getFinalText(next)).toBe(expected);
  });

  it("restored is an explicit completed decision that stays visible", async () => {
    const session = handcraftedSession();
    const next = applyDecision(session, session.detections[0].id, "restored");
    const progress = getProgress(next);
    expect(progress.restored).toBe(1);
    expect(progress.restoredDetections.map((d) => d.id)).toEqual([session.detections[0].id]);
    expect(progress.decided).toBe(1);
    expect(getDecision(next, session.detections[0].id).status).toBe("restored");
    // Restored alone does not complete review while other spans are pending.
    expect(progress.canFinalize).toBe(false);
  });

  it("manual detection affects the same session without corrupting existing decisions or offsets", async () => {
    const session = handcraftedSession();
    const accepted = applyDecision(session, session.detections[0].id, "accepted");
    const restored = applyDecision(accepted, session.detections[1].id, "restored");
    const fullyDecided = applyDecision(restored, session.detections[2].id, "restored");
    expect(canFinalize(fullyDecided)).toBe(true);
    const withManual = addManualDetection(fullyDecided, {
      start: SOURCE.indexOf("Teléfono"),
      end: SOURCE.indexOf("Teléfono") + "Teléfono".length,
      type: "PALABRA_CLAVE",
    });
    // Existing decisions and detections survive untouched.
    expect(getDecision(withManual, session.detections[0].id)).toEqual({
      status: "accepted",
    });
    expect(getDecision(withManual, session.detections[1].id)).toEqual({
      status: "restored",
    });
    expect(getDecision(withManual, session.detections[2].id)).toEqual({
      status: "restored",
    });
    expect(withManual.detections.slice(0, 3)).toEqual(restored.detections);
    const manual = withManual.detections[3];
    expect(manual.source).toBe("manual");
    expect(manual.requiresReview).toBe(true);
    expect(manual.original).toBe("Teléfono");
    expect(getProgress(withManual).pending).toBe(1);

    // Decide the manual span with an explicit replacement and finalize.
    const finalized = applyDecision(withManual, manual.id, "modified", {
      replacement: "MANUAL-1",
    });
    expect(canFinalize(finalized)).toBe(true);
    const expected =
      SOURCE.slice(0, NAME_START) +
      "PACIENTE-1" +
      SOURCE.slice(NAME_END, SOURCE.indexOf("Teléfono")) +
      "MANUAL-1" +
      SOURCE.slice(SOURCE.indexOf("Teléfono") + "Teléfono".length);
    expect(getFinalText(finalized)).toBe(expected);
  });
});

describe("job → review-source mapping", () => {
  it("supports text, single-document and document-batch jobs", async () => {
    expect(
      jobSupportsReview(createJob({ type: "pasted-text", text: "Síntesis: 612345678." }))
    ).toBe(true);
    expect(
      jobSupportsReview(
        createJob({
          type: "files",
          files: [
            {
              name: "note.txt",
              extension: "txt",
              extraction: { status: "extracted", extractedText: "Contenido sintético." },
            },
          ],
        })
      )
    ).toBe(true);
    expect(
      jobSupportsReview(
        createJob({
          type: "files",
          // T17 #21 WU-B: a document batch is reviewable as per-document
          // sessions over the shared context, so its kind is supported.
          files: [
            { name: "a.txt", extension: "txt" },
            { name: "b.txt", extension: "txt" },
          ],
        })
      )
    ).toBe(true);
    expect(
      jobSupportsReview(
        createJob({
          type: "files",
          files: [{ name: "labs.csv", extension: "csv" }],
        })
      )
    ).toBe(false);
  });

  it("maps pasted text and single extracted documents to review source text", async () => {
    const textJob = createJob({ type: "pasted-text", text: "Texto sintético." });
    expect(jobSourceText(textJob)).toBe("Texto sintético.");

    const documentJob = createJob({
      type: "files",
      files: [
        {
          name: "note.txt",
          extension: "txt",
          extraction: { status: "extracted", extractedText: "Contenido extraído." },
        },
      ],
    });
    expect(jobSourceText(documentJob)).toBe("Contenido extraído.");

    const batchJob = createJob({
      type: "files",
      // T17 #21 SD-2: metadata-only batch; text is held per item after the read
      // phase, so the kind alone drives this mapping.
      files: [
        { name: "a.txt", extension: "txt" },
        { name: "b.txt", extension: "txt" },
      ],
    });
    expect(jobSourceText(batchJob)).toBeNull();
  });

  it("starts a real review session from a job's source text", async () => {
    const job = createJob({ type: "pasted-text", text: ENGINE_TEXT });
    const session = await startReviewSessionAsync(job);
    expect(session.originalText).toBe(ENGINE_TEXT);
    expect(session.detections.length).toBeGreaterThan(0);
  });

  it("fails closed when a job family has no single reviewable source text", async () => {
    const batchJob = createJob({
      type: "files",
      // T17 #21 SD-2: metadata-only batch (see the review-source mapping above).
      files: [
        { name: "a.txt", extension: "txt" },
        { name: "b.txt", extension: "txt" },
      ],
    });
    await expect(startReviewSessionAsync(batchJob)).rejects.toThrowError(ReviewSessionError);
    // The single-text entry points the caller at the batch primitive instead of
    // the obsolete "arrives with a later ticket" claim.
    await expect(startReviewSessionAsync(batchJob)).rejects.toThrowError(/processBatchItem/);
  });

  it("the engine behind startReviewSession is the registry-composed V4 engine", async () => {
    const engine = createRegistryEngine();
    const outcome = engine.process({ text: ENGINE_TEXT, context: { mode: "fresh" } });
    const session = await createSessionFromEngineTextAsync(ENGINE_TEXT, "standard");
    // T14 #18 WU-B: the session carries the entity detections PLUS the engine's
    // below-threshold candidates (one detection each).
    const candidates = outcome.result.candidates ?? [];
    expect(session.detections.length).toBe(outcome.result.entities.length + candidates.length);
    const lowConfidence = session.detections.filter(
      (detection) => detection.lowConfidence === true
    );
    expect(lowConfidence).toHaveLength(candidates.length);
    for (const candidate of candidates) {
      expect(lowConfidence).toContainEqual(
        expect.objectContaining({
          type: candidate.type,
          start: candidate.position.start,
          end: candidate.position.end,
          original: candidate.original ?? candidate.text,
        })
      );
    }
  });
});

/**
 * PR #40 corrective C1: the job's policy must be the policy the engine
 * actually consumes. Accepted strict-transformation fixture: the legacy
 * strict profile collapses a hospital UBICACION to 'Centro Sanitario' and
 * any other UBICACION to 'Zona Geografica' (js/core/processor.js
 * transformEntity, mirrored by the GENERALIZE operator).
 */
const HOSPITAL_TEXT =
  "Se derivó al Hospital Virgen del Rocío desde Sevilla para pruebas complementarias.";

/** HOSPITAL_TEXT carrying one visit date: needed to exercise date policies. */
const DATED_HOSPITAL_TEXT =
  "Se derivó al Hospital Virgen del Rocío desde Sevilla el 12/03/2024 para pruebas complementarias.";

describe("policy binding: the session is produced under the job's policy (C1)", () => {
  function proposalsOf(
    session: ReviewSession
  ): Array<[string, string | undefined, string | undefined]> {
    return session.detections.map((detection) => [
      detection.type,
      detection.original,
      detection.proposed,
    ]);
  }

  it("a strict job's proposals differ materially from a standard job's (hospital → 'Centro Sanitario')", async () => {
    const strictSession = await createSessionFromEngineTextAsync(HOSPITAL_TEXT, "strict");
    const standardSession = await createSessionFromEngineTextAsync(HOSPITAL_TEXT, "standard");

    // Accepted legacy strict semantics for the hospital mention.
    const strictHospital = strictSession.detections.find(
      (detection) =>
        detection.type === "UBICACION" && detection.original === "Hospital Virgen del Rocío"
    );
    expect(strictHospital?.proposed).toBe("Centro Sanitario");
    const strictCity = strictSession.detections.find(
      (detection) => detection.type === "UBICACION" && detection.original === "Sevilla"
    );
    expect(strictCity?.proposed).toBe("Zona Geografica");

    // Material difference: same recognition spans, different transformations.
    const standardHospital = standardSession.detections.find(
      (detection) =>
        detection.type === "UBICACION" && detection.original === "Hospital Virgen del Rocío"
    );
    expect(standardHospital?.proposed).not.toBe("Centro Sanitario");
    const spans = (session: ReviewSession) =>
      session.detections.map((detection) => [detection.start, detection.end]);
    expect(spans(standardSession)).toEqual(spans(strictSession));
    expect(proposalsOf(standardSession)).not.toEqual(proposalsOf(strictSession));
  });

  it("startReviewSession consumes the job's policyId, not an implicit default", async () => {
    const strictJob = setPolicy(createJob({ type: "pasted-text", text: HOSPITAL_TEXT }), "strict");
    const session = await startReviewSessionAsync(strictJob);
    const hospital = session.detections.find(
      (detection) =>
        detection.type === "UBICACION" && detection.original === "Hospital Virgen del Rocío"
    );
    expect(hospital?.proposed).toBe("Centro Sanitario");
  });

  it("runs an external-ai job under its own policy: dates generalized, not visit-relabelled (REC-02)", async () => {
    const job = setPolicy(
      createJob({ type: "pasted-text", text: DATED_HOSPITAL_TEXT }),
      "external-ai"
    );
    const session = await startReviewSessionAsync(job);

    const fecha = session.detections.find((detection) => detection.type === "FECHA");
    expect(fecha?.original).toBe("12/03/2024");
    expect(fecha?.proposed).toMatch(/^\d{2}\/\d{4}$/);
    expect(fecha?.proposed).not.toMatch(/^Visita/);
    // The stricter location branch is used, exactly like `strict`.
    const hospital = session.detections.find(
      (detection) =>
        detection.type === "UBICACION" && detection.original === "Hospital Virgen del Rocío"
    );
    expect(hospital?.proposed).toBe("Centro Sanitario");
  });

  it("runs a longitudinal-research text job with one consistent Job-scoped shift (REC-02 WU-B)", async () => {
    const job = setPolicy(
      createJob({ type: "pasted-text", text: DATED_HOSPITAL_TEXT }),
      "longitudinal-research"
    );
    const session = await startReviewSessionAsync(job);

    const fecha = session.detections.find(
      (detection) => detection.type === "FECHA" && detection.original === "12/03/2024"
    );
    expect(fecha?.proposed).toBeDefined();
    // A real shift: not the source date, not the legacy visit label and not the
    // external-ai month precision.
    expect(fecha?.proposed).not.toBe("12/03/2024");
    expect(fecha?.proposed).not.toBe("");
    expect(fecha?.proposed).not.toMatch(/^Visita/);
    expect(fecha?.proposed).toMatch(/^\d{2}\/\d{2}\/\d{4}$/);

    // Deterministic: re-entering the same Job recreates the exact same
    // Job-scoped shift (handoff contract point 7).
    const replayed = await startReviewSessionAsync(job);
    expect(proposalsOf(replayed)).toEqual(proposalsOf(session));

    // The stricter location branch is preserved (REC-02 acceptance 14).
    const hospital = session.detections.find(
      (detection) =>
        detection.type === "UBICACION" && detection.original === "Hospital Virgen del Rocío"
    );
    expect(hospital?.proposed).toBe("Centro Sanitario");
  });

  it("runs a longitudinal-research single-document job through the same Job-scoped shift (REC-02 WU-B)", async () => {
    const job = setPolicy(
      createJob({
        type: "files",
        files: [
          {
            name: "nota.txt",
            extension: "txt",
            extraction: { status: "extracted", extractedText: DATED_HOSPITAL_TEXT },
          },
        ],
      }),
      "longitudinal-research"
    );
    const session = await startReviewSessionAsync(job);
    const fecha = session.detections.find((detection) => detection.type === "FECHA");
    expect(fecha?.original).toBe("12/03/2024");
    expect(fecha?.proposed).toMatch(/^\d{2}\/\d{2}\/\d{4}$/);
    expect(fecha?.proposed).not.toMatch(/^Visita/);
    expect(fecha?.proposed).not.toBe(fecha?.original);
  });

  it("keeps a missing date-shift state fail-closed at the low-level text seam (REC-02 ACCEPTANCE 7)", async () => {
    // The product Job path threads a Job-scoped shift; a caller that supplies
    // NO shift context still fails closed instead of silently passing the
    // original date through (never a Standard fallback).
    try {
      await createSessionFromEngineTextAsync(DATED_HOSPITAL_TEXT, "longitudinal-research");
      throw new Error("expected the missing-shift-state path to fail closed");
    } catch (error) {
      expect(error).toBeInstanceOf(DateOperatorError);
      expect((error as DateOperatorError).code).toBe("missing-date-shift-state");
    }
  });

  it("default/standard behavior stays identical to the pre-correction standard output", async () => {
    const engine = createRegistryEngine();
    const outcome = engine.process({ text: ENGINE_TEXT, context: { mode: "fresh" } });
    const standardSession = await createSessionFromEngineTextAsync(ENGINE_TEXT, "standard");
    expect(
      standardSession.detections.map((detection) => [
        detection.start,
        detection.end,
        detection.original,
        detection.proposed,
      ])
    ).toEqual(
      outcome.result.entities.map((entity) => [
        entity.position.start,
        entity.position.end,
        entity.original ?? entity.text,
        entity.transformed,
      ])
    );
    // And the job-level default path (no explicit policy) is the same output.
    const job = createJob({ type: "pasted-text", text: ENGINE_TEXT });
    const viaJob = await startReviewSessionAsync(job);
    expect(proposalsOf(viaJob)).toEqual(proposalsOf(standardSession));
  });
});

/**
 * T17 #21 WU-B — batch per-item review seam. `processBatchItem` is the batch
 * counterpart of `startReviewSession`: one held item in, one per-document
 * ReviewSession plus the updated shared context out. All fixtures are
 * synthetic clinical-style strings; no real content anywhere.
 */
const BATCH_DOC_A = "Nombre: Carmen Sánchez\nLa paciente fue atendida por el Dr. García López.";
const BATCH_DOC_B =
  "Nombre: Carmen Sánchez\nLa paciente Lucía Ruiz acude a consulta. El Dr. García López firmó el informe. Familiar: Rosa Martínez.";
const BATCH_MARKER = "Texto sintético que el motor inyectado rechaza.";

/** A metadata-only batch (T17 #21 SD-2): every item starts `queued`. */
function batchJob(names: readonly string[]): Job {
  return createJob({
    type: "files",
    files: names.map((name) => ({ name, extension: "txt" })),
  });
}

/** Read held text into the first N items of a batch through the read phase. */
function readHeldTexts(job: Job, texts: readonly string[]): Job {
  return texts.reduce((current, text, index) => {
    return recordItemRead(beginItemRead(current, index), index, {
      ok: true,
      extractedText: text,
    });
  }, job);
}

/** Proposed value of the non-candidate engine detection for one source span. */
function engineProposal(session: ReviewSession, original: string): string | undefined {
  return session.detections.find(
    (detection) => detection.original === original && detection.lowConfidence !== true
  )?.proposed;
}

describe("batch per-item processing (T17 #21 WU-B)", () => {
  it("maps a held item to a per-document session and returns the updated context", async () => {
    const job = readHeldTexts(batchJob(["a.txt", "b.txt"]), [BATCH_DOC_A]);
    const result = await processBatchItem(job, 0, { mode: "fresh" }, createRegistryEngine());
    if (!result.ok) {
      throw new Error(`expected ok: true, received failure ${result.failure.code}`);
    }
    expect(result.session.originalText).toBe(BATCH_DOC_A);
    // The session reflects the engine's transformations (one patient substitution).
    expect(engineProposal(result.session, "Carmen Sánchez")).toBe("Paciente 1");
    // The returned context is the engine's shared-context carrier.
    expect(result.context.pseudonymState?.asignaciones).toContainEqual([
      "carmen sánchez",
      "Paciente 1",
    ]);
  });

  it("refuses an item without held text as invalid-source and never throws", async () => {
    const job = batchJob(["a.txt", "b.txt"]);
    const missing = await processBatchItem(job, 0, { mode: "fresh" }, createRegistryEngine());
    expect(missing.ok).toBe(false);
    if (missing.ok) throw new Error("unreachable: expected a classified refusal");
    expect(missing.failure.code).toBe("invalid-source");
    expect(missing.failure.message).toContain("no held extracted text");

    // An out-of-range index is fail-closed through the same classified refusal.
    const outOfRange = await processBatchItem(job, 9, { mode: "fresh" }, createRegistryEngine());
    expect(outOfRange.ok).toBe(false);
    if (outOfRange.ok) throw new Error("unreachable: expected a classified refusal");
    expect(outOfRange.failure.code).toBe("invalid-source");
  });

  it("threads the shared context so a returning identity keeps its pseudonym and a new identity takes the next index", async () => {
    const job = readHeldTexts(batchJob(["a.txt", "b.txt"]), [BATCH_DOC_A, BATCH_DOC_B]);
    const first = await processBatchItem(job, 0, { mode: "fresh" }, createRegistryEngine());
    if (!first.ok) throw new Error(`expected ok: true, received failure ${first.failure.code}`);
    // The bridge promotes the first fresh outcome to shared mode for item 1.
    const sharedContext = {
      mode: "shared" as const,
      pseudonymState: first.context.pseudonymState,
    };
    const second = await processBatchItem(job, 1, sharedContext, createRegistryEngine());
    if (!second.ok) throw new Error(`expected ok: true, received failure ${second.failure.code}`);

    // Same identity → the SAME pseudonym in both documents.
    expect(engineProposal(first.session, "Carmen Sánchez")).toBe("Paciente 1");
    expect(engineProposal(second.session, "Carmen Sánchez")).toBe("Paciente 1");
    // New identity → the NEXT patient index, never a reused value.
    expect(engineProposal(second.session, "Lucía Ruiz")).toBe("Paciente 2");
    expect(first.context.pseudonymState?.contadorPacientes).toBe(1);
    expect(second.context.pseudonymState?.contadorPacientes).toBe(2);
    expect(second.context.pseudonymState?.asignaciones).toEqual([
      ["carmen sánchez", "Paciente 1"],
      ["lucía ruiz", "Paciente 2"],
    ]);
  });

  it("classifies an injected typed engine failure and still processes a healthy item through the real adapter", async () => {
    const real = createRegistryEngine();
    const stub: ReturnType<typeof createRegistryEngine> = {
      process(input) {
        if (input.text === BATCH_MARKER) {
          throw new PolicyError(
            "policy-operator-mapping-unavailable",
            "Injected stub: refusing the marker text under a simulated unmapped policy."
          );
        }
        return real.process(input);
      },
    };
    const job = readHeldTexts(batchJob(["a.txt", "b.txt"]), [BATCH_MARKER, BATCH_DOC_A]);

    const failed = await processBatchItem(job, 0, { mode: "fresh" }, stub);
    expect(failed).toEqual({
      ok: false,
      failure: {
        code: "policy-unsupported",
        message: "Injected stub: refusing the marker text under a simulated unmapped policy.",
      },
    });

    const healthy = await processBatchItem(job, 1, { mode: "fresh" }, stub);
    if (!healthy.ok) throw new Error(`expected ok: true, received failure ${healthy.failure.code}`);
    expect(engineProposal(healthy.session, "Carmen Sánchez")).toBe("Paciente 1");
  });
});
