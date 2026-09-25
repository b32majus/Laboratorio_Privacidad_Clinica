/**
 * Legacy recognizer adaptation (Work Order T11 #15, WU1).
 *
 * This module wraps — never rewrites — the legacy brownfield detection
 * pipeline as V4 recognizers (CURRENT_DECISIONS D-003). It is the sole owner
 * of the js/core and js/data imports on the recognizer side; the pure
 * contracts and registry behavior it implements live in
 * `./recognizer-registry`.
 *
 * {@link LegacyRecognizerAdapter} composes the exact `js/core/processor.js`
 * detection stages — js/core/detectors/* + `Processor.resolveConflicts` +
 * `ScoringEngine.aplicarScoring` + `HeuristicasContextuales.aplicarHeuristicas`
 * + the confidence threshold filter (including the `modoEstricto` SOSPECHOSO
 * 0.25 special case) — over the same dictionaries and configuration as
 * `ensureLegacySetup` in legacy-engine.ts. Detection is mirrored stage by
 * stage so observations are bit-comparable to what `Processor.process` would
 * detect (parity guarantee), while explicitly NOT running the transformation
 * half of `Processor.process`: no `AsignadorSustitutos`/`UbicacionesManager`/
 * `FechasManager` resets, no `preprocessFechas`, no `transformEntity`, no
 * `transformed` values (purity guarantee: recognition never mutates the
 * transformation-side managers).
 *
 * Fail-closed (D-009): malformed input or legacy results raise typed errors
 * instead of guessed behavior.
 *
 * Privacy: this module never logs content, never mutates its input text, and
 * is Worker-safe (no window/document access anywhere in its module graph).
 */

import { detectCuasiIdentificadores } from "../../../js/core/detectors/cuasiidentificadores.js";
import { detectFechas } from "../../../js/core/detectors/fechas.js";
import { detectIdentificadores } from "../../../js/core/detectors/identificadores.js";
import {
  detectFamiliares,
  detectPacientes,
  detectProfesionales,
} from "../../../js/core/detectors/nombres.js";
import { detectUbicaciones } from "../../../js/core/detectors/ubicaciones.js";
import { Processor } from "../../../js/core/processor.js";
import { HeuristicasContextuales } from "../../../js/core/scoring/HeuristicasContextuales.js";
import { ScoringEngine } from "../../../js/core/scoring/ScoringEngine.js";
import { TextNormalizer } from "../../../js/core/utils/TextNormalizer.js";
import {
  ABREVIATURAS_NOMBRES,
  APELLIDOS,
  BARRIOS,
  CENTROS_SALUD_PREFIJOS,
  CIUDADES,
  CCAA,
  HOSPITALES,
  NOMBRES_HOMBRE,
  NOMBRES_MUJER,
  NOMBRES_UNISEX,
  PROVINCIAS,
} from "../../../js/data/index.js";
import {
  type Recognizer,
  RECOGNIZER_CATEGORIES,
  type RecognizerCategory,
  LEGACY_CATEGORY_RECOGNIZER_KEYS,
  type RecognizerObservation,
  RecognizerError,
  RecognizerRegistry,
} from "./recognizer-registry";
import { EngineError } from "./types";

/** Same safety limit as the legacy core and the V4 engine adapter. */
const MAX_TEXT_LENGTH = 1_000_000;

/** Full-pipeline recognizer key: all legacy categories in one adapter. */
export const LEGACY_RECOGNIZER_KEY = "legacy";

/**
 * Loads the exact same dictionaries and applies the exact same configuration
 * as ensureLegacySetup in legacy-engine.ts (mirroring js/modular-processor.js).
 * Guarded so setup runs once per module instance; values are identical to the
 * engine adapter's, so the shared legacy singleton is configured identically
 * regardless of import order.
 */
let legacyRecognizerSetupDone = false;
function ensureLegacySetup(): void {
  if (legacyRecognizerSetupDone) return;
  const ubicacionesExtendidas = Array.from(new Set([...CIUDADES, ...PROVINCIAS, ...CCAA]));
  Processor.loadDictionaries({
    nombresMujer: NOMBRES_MUJER,
    nombresHombre: NOMBRES_HOMBRE,
    nombresUnisex: NOMBRES_UNISEX,
    abreviaturasNombres: ABREVIATURAS_NOMBRES,
    apellidos: APELLIDOS,
    ciudades: ubicacionesExtendidas,
    hospitales: HOSPITALES,
    centrosSaludPrefijos: CENTROS_SALUD_PREFIJOS,
    barrios: BARRIOS,
  });
  Processor.configure({
    usarScoring: true,
    umbralConfianza: 0.5,
    aplicarHeuristicas: true,
  });
  legacyRecognizerSetupDone = true;
}

/** Same fail-closed text validation as the V4 engine adapter (D-009). */
function assertRecognizableText(text: unknown): asserts text is string {
  if (typeof text !== "string") {
    throw new EngineError("invalid-text", "Recognizer input text must be a string.");
  }
  if (text.trim().length === 0) {
    throw new EngineError(
      "empty-text",
      "Recognizer input text is empty; provide text before recognition."
    );
  }
  if (text.length > MAX_TEXT_LENGTH) {
    throw new EngineError(
      "input-too-large",
      "Recognizer input text exceeds the supported size; use an explicit segmentation path instead of silent truncation."
    );
  }
}

/**
 * Legacy detection entity, structural view. Only the fields the observation
 * contract consumes are read; legacy extras (scoring/heuristicas/...) are
 * deliberately dropped: recognition internals are not part of the contract.
 */
type LegacyDetectionEntity = {
  type?: unknown;
  subtype?: unknown;
  text?: unknown;
  original?: unknown;
  confidence?: unknown;
  position?: { start?: unknown; end?: unknown };
};

/** Validates one legacy entity fail-closed and freezes its observation. */
function toObservation(raw: unknown): RecognizerObservation {
  const entity = raw as LegacyDetectionEntity;
  if (
    typeof entity?.type !== "string" ||
    typeof entity?.text !== "string" ||
    typeof entity?.confidence !== "number" ||
    entity?.position === null ||
    typeof entity?.position !== "object" ||
    typeof entity.position.start !== "number" ||
    typeof entity.position.end !== "number"
  ) {
    throw new RecognizerError(
      "invalid-recognizer-result",
      "Legacy detector returned an unexpected entity shape; failing closed instead of guessing."
    );
  }
  const { subtype, original } = entity;
  return Object.freeze({
    type: entity.type,
    ...(typeof subtype === "string" ? { subtype } : {}),
    start: entity.position.start,
    end: entity.position.end,
    text: entity.text,
    ...(typeof original === "string" ? { original } : {}),
    confidence: entity.confidence,
  });
}

/**
 * Runs the legacy detection pipeline over `text`, mirroring
 * js/core/processor.js stage by stage:
 * detectEntities (all seven detectors) → resolveConflicts →
 * ScoringEngine.aplicarScoring → HeuristicasContextuales.aplicarHeuristicas →
 * confidence threshold filter (with the modoEstricto SOSPECHOSO 0.25 special
 * case, mirroring the legacy expression exactly).
 *
 * Recognition purity: the transformation half of `Processor.process` is NOT
 * executed — no manager resets, no `preprocessFechas`, no `transformEntity`,
 * no `transformed` values. Config is read from the shared legacy singleton at
 * call time, exactly as `Processor.process` does, so both paths always see
 * the same effective detection configuration.
 */
function runLegacyDetection(text: string): readonly RecognizerObservation[] {
  ensureLegacySetup();
  assertRecognizableText(text);
  const normalize = TextNormalizer.normalize.bind(TextNormalizer);

  // Stage 1: detection (Processor.detectEntities, inlined verbatim).
  const entities: unknown[] = [
    ...detectIdentificadores(text),
    ...detectFechas(text),
    ...detectUbicaciones(
      text,
      {
        ciudades: Processor.dictionaries.ciudades,
        hospitales: Processor.dictionaries.hospitales,
        centrosSaludPrefijos: Processor.dictionaries.centrosSaludPrefijos,
        barrios: Processor.dictionaries.barrios,
      },
      normalize
    ),
    ...detectProfesionales(text, Processor.dictionaries, normalize),
    ...detectPacientes(text, Processor.dictionaries, normalize),
    ...detectFamiliares(text),
    ...detectCuasiIdentificadores(text),
  ];

  // Stage 2: conflict resolution between overlapping detections.
  const resolved = Processor.resolveConflicts(entities);

  // Stage 3: scoring.
  let scored: unknown[] = resolved;
  if (Processor.config.usarScoring) {
    scored = ScoringEngine.aplicarScoring(resolved, Processor.dictionaries, text, normalize);
  }

  // Stage 4: contextual heuristics.
  if (Processor.config.aplicarHeuristicas) {
    scored = scored.map((entity) => HeuristicasContextuales.aplicarHeuristicas(entity, text));
  }

  // Stage 5: confidence threshold filter (legacy expression, incl. the
  // modoEstricto SOSPECHOSO 0.25 special case). Entities are validated
  // fail-closed into observations first, so the filter runs on typed values.
  const umbralConfianza = Number(Processor.config.umbralConfianza);
  const modoEstricto = Processor.config.modoEstricto === true;
  const effectiveThreshold = modoEstricto ? Math.min(umbralConfianza, 0.35) : umbralConfianza;
  const observations = scored.map(toObservation);
  const filtered = observations.filter((observation) => {
    if (modoEstricto && observation.type === "SOSPECHOSO") {
      return observation.confidence >= 0.25;
    }
    return observation.confidence >= effectiveThreshold;
  });

  return Object.freeze(filtered);
}

/**
 * Full legacy detection pipeline wrapped as one recognizer (D-003: wrap, do
 * not rewrite). Its observations carry every legacy category.
 */
export class LegacyRecognizerAdapter implements Recognizer {
  readonly key = LEGACY_RECOGNIZER_KEY;

  constructor() {
    ensureLegacySetup();
  }

  observe(text: string): readonly RecognizerObservation[] {
    return runLegacyDetection(text);
  }
}

/**
 * Per-category view over the shared legacy pipeline: runs the exact same
 * detection and filters observations to one taxonomy category (NOMBRE keeps
 * all of its subtypes: paciente/profesional/familiar).
 */
class LegacyCategoryRecognizer implements Recognizer {
  readonly key: string;

  constructor(
    key: string,
    private readonly category: RecognizerCategory
  ) {
    this.key = key;
    ensureLegacySetup();
  }

  observe(text: string): readonly RecognizerObservation[] {
    return runLegacyDetection(text).filter((observation) => observation.type === this.category);
  }
}

/**
 * Builds the default recognizer registry for the legacy pipeline: the full
 * adapter plus one recognizer per legacy taxonomy category, registered under
 * the stable {@link LEGACY_CATEGORY_RECOGNIZER_KEYS} keys.
 */
export function createLegacyRecognizerRegistry(): RecognizerRegistry {
  ensureLegacySetup();
  const registry = new RecognizerRegistry();
  registry.register(new LegacyRecognizerAdapter());
  for (const category of RECOGNIZER_CATEGORIES) {
    const key = LEGACY_CATEGORY_RECOGNIZER_KEYS[category];
    registry.register(new LegacyCategoryRecognizer(key, category));
  }
  return registry;
}
