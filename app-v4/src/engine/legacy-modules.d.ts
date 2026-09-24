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
