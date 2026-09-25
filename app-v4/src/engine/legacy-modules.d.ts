/**
 * Ambient type declarations for the legacy brownfield JS modules imported by
 * the V4 engine adapter (Work Order T05).
 *
 * The legacy sources under js/ are compatibility evidence and are never
 * edited or added to tsconfig compilation; these wildcard ambient modules
 * give the adapter's relative `.js` imports their minimal structural shape
 * (TS7016/TS2307 under strict). Only what the adapter actually consumes is
 * declared. Values are deliberately typed loosely (`unknown`) because the
 * adapter validates the runtime result shape fail-closed before use.
 */

declare module "*/core/processor.js" {
  export interface LegacyProcessorModule {
    loadDictionaries(dicts: Record<string, unknown>): void;
    configure(options: Record<string, unknown>): void;
    process(text: string): unknown;
    readonly dictionaries: Record<string, unknown>;
    readonly config: Record<string, unknown>;
  }
  export const Processor: LegacyProcessorModule;
}

declare module "*/core/managers/AsignadorSustitutos.js" {
  export interface LegacyAsignadorSustitutosModule {
    mapaAsignaciones: Map<string, string>;
    profesionalesMap: Map<string, string>;
    familiaresMap: Map<string, string>;
    contadorProfesionales: number;
    contadorFamiliares: number;
    reset(): void;
    obtenerSustituto(nombreOriginal: string, genero?: string | null): string;
    obtenerSustitutoProfesional(nombreOriginal: string): string;
    obtenerSustitutoFamiliar(nombreOriginal: string): string;
  }
  export const AsignadorSustitutos: LegacyAsignadorSustitutosModule;
}

declare module "*/data/index.js" {
  export const NOMBRES_MUJER: string[];
  export const NOMBRES_HOMBRE: string[];
  export const NOMBRES_UNISEX: string[];
  export const ABREVIATURAS_NOMBRES: Record<string, unknown>;
  export const APELLIDOS: string[];
  export const CIUDADES: string[];
  export const PROVINCIAS: string[];
  export const CCAA: string[];
  export const HOSPITALES: string[];
  export const CENTROS_SALUD_PREFIJOS: string[];
  export const BARRIOS: string[];
}

declare module "*/modular-processor.js" {
  export const PrivacyProcessor: { process(text: string, options?: unknown): unknown };
  export const Processor: unknown;
}

declare module "*/domain/from-processor.js" {
  export function detectionsFromProcessorResult(result: unknown, options?: unknown): unknown[];
  export function createReviewSessionFromProcessor(result: unknown, options?: unknown): unknown;
}

/** Raw detection input accepted by `createReviewSession` (optional fields omitted). */
interface V4ReviewDetectionInput {
  type: string;
  start: number;
  end: number;
  subtype?: string;
  confidence?: number;
  proposed?: string;
  reason?: string;
  note?: string;
  source?: "engine" | "manual";
  requiresReview?: boolean;
}

/** Normalized, frozen detection record owned by a ReviewSession (T01 contract). */
interface V4ReviewDetection extends V4ReviewDetectionInput {
  readonly id: string;
  readonly type: string;
  readonly start: number;
  readonly end: number;
  readonly source: "engine" | "manual";
  readonly requiresReview: boolean;
  /** Always re-derived from the immutable session source text. */
  readonly original: string;
}

/** Stored decision for one detection; pending is implicit (absent from the map). */
interface V4ReviewDecision {
  readonly status: "pending" | "accepted" | "modified" | "restored";
  readonly replacement?: string;
  readonly note?: string;
}

/** Frozen ReviewSession owned by js/domain/review-session.js (Work Order T01). */
interface V4ReviewSession {
  readonly originalText: string;
  readonly sessionId: string;
  readonly detections: readonly V4ReviewDetection[];
  readonly decisions: Readonly<Record<string, V4ReviewDecision>>;
}

/** Factual progress data returned by `getProgress` (counts, never a score). */
interface V4ReviewProgress {
  readonly total: number;
  readonly pending: number;
  readonly decided: number;
  readonly accepted: number;
  readonly modified: number;
  readonly restored: number;
  readonly manual: number;
  readonly pendingDetections: readonly V4ReviewDetection[];
  readonly restoredDetections: readonly V4ReviewDetection[];
  readonly canFinalize: boolean;
}

/**
 * Ambient declaration for the V4 review authority (Work Order T01, DO NOT
 * MODIFY the implementation under js/). Only the API the V4 app consumes is
 * declared; the module validates its inputs fail-closed at runtime.
 */
declare module "*/domain/review-session.js" {
  export type ReviewDetectionInput = V4ReviewDetectionInput;
  export type ReviewDetection = V4ReviewDetection;
  export type ReviewDecision = V4ReviewDecision;
  export type ReviewSession = V4ReviewSession;
  export type ReviewProgress = V4ReviewProgress;
  export class ReviewSessionError extends Error {
    code: string;
    constructor(code: string, message: string);
  }
  export function createReviewSession(input: {
    originalText: string;
    detections: readonly V4ReviewDetectionInput[];
    sessionId?: string;
  }): V4ReviewSession;
  export function applyDecision(
    session: V4ReviewSession,
    id: string,
    decision: "pending" | "accepted" | "modified" | "restored",
    extras?: { replacement?: string; note?: string }
  ): V4ReviewSession;
  export function addManualDetection(
    session: V4ReviewSession,
    detection: { start: number; end: number; type: string; subtype?: string; note?: string }
  ): V4ReviewSession;
  export function getDecision(session: V4ReviewSession, id: string): V4ReviewDecision;
  export function getPreview(session: V4ReviewSession): string;
  export function getPendingDetections(session: V4ReviewSession): V4ReviewDetection[];
  export function canFinalize(session: V4ReviewSession): boolean;
  export function getProgress(session: V4ReviewSession): V4ReviewProgress;
  export function getFinalText(session: V4ReviewSession): string;
}

/* -------------------------------------------------------------------------
 * Work Order T11 #15 (WU1) — recognizer registry boundary.
 * Append-only additions: ambient declarations for the legacy detection
 * pipeline modules consumed by app-v4/src/engine/recognizer-registry.ts,
 * app-v4/src/engine/legacy-recognizers.ts and their tests. No existing
 * declaration above was modified.
 * ------------------------------------------------------------------------- */

declare module "*/core/processor.js" {
  interface LegacyProcessorModule {
    /** Pure overlap resolution over raw detector entities. */
    resolveConflicts(entities: unknown[]): unknown[];
  }
}

declare module "*/core/detectors/identificadores.js" {
  export function detectIdentificadores(text: string): unknown[];
}

declare module "*/core/detectors/fechas.js" {
  export function detectFechas(text: string): unknown[];
}

declare module "*/core/detectors/ubicaciones.js" {
  export function detectUbicaciones(
    text: string,
    locationData: Record<string, unknown>,
    normalizeText: (text: string) => string
  ): unknown[];
}

declare module "*/core/detectors/nombres.js" {
  export function detectProfesionales(
    text: string,
    dictionaries: Record<string, unknown>,
    normalizeText: (text: string) => string
  ): unknown[];
  export function detectPacientes(
    text: string,
    dictionaries: Record<string, unknown>,
    normalizeText: (text: string) => string
  ): unknown[];
  export function detectFamiliares(text: string): unknown[];
}

declare module "*/core/detectors/cuasiidentificadores.js" {
  export function detectCuasiIdentificadores(text: string): unknown[];
}

declare module "*/core/scoring/ScoringEngine.js" {
  export const ScoringEngine: {
    aplicarScoring(
      entities: unknown[],
      dictionaries: Record<string, unknown>,
      text: string,
      normalizeText: (text: string) => string
    ): unknown[];
  };
}

declare module "*/core/scoring/HeuristicasContextuales.js" {
  export const HeuristicasContextuales: {
    aplicarHeuristicas(entity: unknown, text: string): unknown;
  };
}

declare module "*/core/utils/TextNormalizer.js" {
  export const TextNormalizer: {
    normalize(text: string): string;
  };
}

/** Consumed only by legacy-recognizers.test.ts for the purity oracle. */
declare module "*/core/managers/FechasManager.js" {
  export const FechasManager: {
    visitasMap: Map<string, string>;
    visitasOrdenadas: unknown[];
    procesarVisita(fechaOriginal: string): unknown;
    parseFecha(texto: string): Date | null;
    reset(): void;
  };
}

/** Consumed only by legacy-recognizers.test.ts for the purity oracle. */
declare module "*/core/managers/UbicacionesManager.js" {
  export const UbicacionesManager: {
    centrosMap: Map<string, string>;
    ciudadesMap: Map<string, string>;
    contadorCentros: number;
    contadorCiudades: number;
    obtenerCentro(centro: string): string;
    obtenerCiudad(ciudad: string): string;
    reset(): void;
  };
}
