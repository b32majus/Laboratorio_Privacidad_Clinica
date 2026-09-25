/**
 * V4 legacy engine adapter (Work Order T05).
 *
 * Composes the legacy brownfield privacy core (js/core + js/data) behind the
 * V4 `V4PrivacyEngine` interface without touching `window` and without any
 * monkey patching (SPEC_V4_PRIVACY_ENGINE.md §2/§7/§14; CURRENT_DECISIONS.md
 * D-003/D-009/D-011). The composition mirrors js/modular-processor.js exactly
 * (same dictionaries, same configuration) but is Worker-safe: nothing in this
 * module graph accesses `window`/`document` at import or call time.
 *
 * Context seam (D-011): cross-document pseudonym consistency is carried by an
 * explicit, JSON-serializable `ProcessingContext`, replacing the legacy
 * batch-module monkey patch of `AsignadorSustitutos.obtenerSustituto`
 * (js/batch-module.js). The adapter never replaces methods, never patches
 * globals, and never adds properties to the legacy modules; it only resets,
 * reads and snapshots the manager's public data fields.
 *
 * Reset semantics note: `Processor.process` resets `AsignadorSustitutos`
 * internally at the start of every call (js/core/processor.js), so seeding
 * the module maps before the call would be silently wiped. Instead the
 * adapter lets the legacy call run its fresh cycle and then reconciles the
 * fresh pseudonym state against the authoritative state carried by the
 * shared context, rewriting only the pseudonym strings of name entities
 * (same original value → same pseudonym across documents; counters continue
 * instead of restarting, mirroring the legacy PersistentMapper intent).
 * Detection (entities, offsets, confidence, stats) is untouched:
 * `Processor.process` is invoked exactly once per `process()` call with the
 * given text, so detection behavior is bit-identical to legacy.
 *
 * Privacy: this module never logs content, never mutates its input, and
 * fails closed on invalid input (D-009): empty/oversized text and
 * non-serializable contexts raise typed errors instead of guessed behavior.
 *
 * Work Order T11 #15 (WU3): the module-private fail-closed validators and
 * the fresh/shared context reconciliation helpers are exported verbatim (no
 * behavior change) so the registry-composed engine (`registry-engine.ts`)
 * reuses the exact same rules instead of duplicating them.
 */

import { AsignadorSustitutos } from "../../../js/core/managers/AsignadorSustitutos.js";
import { Processor } from "../../../js/core/processor.js";
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
  EngineError,
  type EngineOutcome,
  type LegacyEntity,
  type LegacyProcessorResult,
  type ProcessingContext,
  type PseudonymState,
} from "./types";

/** Same safety limit as the legacy core, but fail-closed instead of truncating. */
const MAX_TEXT_LENGTH = 1_000_000;

const EMPTY_PSEUDONYM_STATE: PseudonymState = Object.freeze({
  asignaciones: Object.freeze([]),
  profesionales: Object.freeze([]),
  familiares: Object.freeze([]),
  contadorProfesionales: 0,
  contadorFamiliares: 0,
});

let legacySetupDone = false;

/**
 * Loads the exact same dictionaries and applies the exact same configuration
 * as js/modular-processor.js. Guarded so setup runs once per module instance.
 */
function ensureLegacySetup(): void {
  if (legacySetupDone) return;
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
  legacySetupDone = true;
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  if (value === null || typeof value !== "object") return false;
  const proto: unknown = Object.getPrototypeOf(value);
  return proto === Object.prototype || proto === null;
}

/**
 * Structural equality strong enough to detect lossy JSON round-trips:
 * distinguishes plain objects from Maps/class instances/Dates, catches
 * dropped `undefined` values, functions, NaN/Infinity and sparse arrays.
 */
function structuralEquals(a: unknown, b: unknown): boolean {
  if (Object.is(a, b)) return true;
  if (typeof a !== typeof b) return false;
  if (a === null || b === null) return false;
  if (typeof a !== "object") return false;
  if (Array.isArray(a) || Array.isArray(b)) {
    if (!Array.isArray(a) || !Array.isArray(b) || a.length !== b.length) return false;
    return a.every((item, index) => structuralEquals(item, b[index]));
  }
  if (!isPlainObject(a) || !isPlainObject(b)) return false;
  const keysA = Object.keys(a);
  const keysB = Object.keys(b);
  if (keysA.length !== keysB.length) return false;
  return keysA.every((key) => key in b && structuralEquals(a[key], b[key]));
}

export function assertValidText(text: unknown): asserts text is string {
  if (typeof text !== "string") {
    throw new EngineError("invalid-text", "Engine input text must be a string.");
  }
  if (text.trim().length === 0) {
    throw new EngineError(
      "empty-text",
      "Engine input text is empty; provide text before processing."
    );
  }
  if (text.length > MAX_TEXT_LENGTH) {
    throw new EngineError(
      "input-too-large",
      "Engine input text exceeds the supported size; use an explicit segmentation path instead of silent truncation."
    );
  }
}

function assertPseudonymStateShape(state: unknown): asserts state is PseudonymState {
  if (!isPlainObject(state)) {
    throw new EngineError("invalid-context", "pseudonymState must be a plain serializable object.");
  }
  for (const key of ["asignaciones", "profesionales", "familiares"] as const) {
    const entries = state[key];
    if (!Array.isArray(entries) || !entries.every(isAssignmentEntry)) {
      throw new EngineError(
        "invalid-context",
        `pseudonymState.${key} must be an array of [key, value] string pairs.`
      );
    }
  }
  for (const key of ["contadorProfesionales", "contadorFamiliares"] as const) {
    const counter = state[key];
    if (typeof counter !== "number" || !Number.isFinite(counter) || counter < 0) {
      throw new EngineError(
        "invalid-context",
        `pseudonymState.${key} must be a non-negative finite number.`
      );
    }
  }
}

function isAssignmentEntry(entry: unknown): entry is [string, string] {
  return (
    Array.isArray(entry) &&
    entry.length === 2 &&
    typeof entry[0] === "string" &&
    typeof entry[1] === "string"
  );
}

export function assertValidContext(context: unknown): asserts context is ProcessingContext {
  if (!isPlainObject(context)) {
    throw new EngineError("invalid-context", "Engine context must be a plain serializable object.");
  }
  if (context.mode !== "fresh" && context.mode !== "shared") {
    throw new EngineError(
      "invalid-context",
      `Unknown processing context mode "${String(context.mode)}".`
    );
  }
  let roundTrip: unknown;
  try {
    roundTrip = JSON.parse(JSON.stringify(context)) as unknown;
  } catch {
    throw new EngineError("non-serializable-context", "Engine context is not JSON-serializable.");
  }
  if (!structuralEquals(roundTrip, context)) {
    throw new EngineError(
      "non-serializable-context",
      "Engine context is not JSON-serializable: a JSON round-trip does not preserve its semantics (Maps, class instances, functions, undefined values or sparse data are not allowed)."
    );
  }
  if (context.pseudonymState !== undefined) {
    assertPseudonymStateShape(context.pseudonymState);
  }
}

function assertLegacyResultShape(result: unknown): asserts result is LegacyProcessorResult {
  if (
    !isPlainObject(result) ||
    typeof result.original !== "string" ||
    typeof result.processed !== "string" ||
    !Array.isArray(result.entities)
  ) {
    throw new EngineError(
      "invalid-engine-result",
      "Legacy processor returned an unexpected result shape; failing closed instead of guessing."
    );
  }
}

/** Serializable snapshot of the legacy manager's public data fields. */
export function snapshotModulePseudonymState(): PseudonymState {
  return {
    asignaciones: [...AsignadorSustitutos.mapaAsignaciones.entries()],
    profesionales: [...AsignadorSustitutos.profesionalesMap.entries()],
    familiares: [...AsignadorSustitutos.familiaresMap.entries()],
    contadorProfesionales: AsignadorSustitutos.contadorProfesionales,
    contadorFamiliares: AsignadorSustitutos.contadorFamiliares,
  };
}

/**
 * Narrow read-only view of the legacy alias oracle. `sonMismoProfesional` is
 * a pure function of its two (already normalized) key arguments — verified
 * in js/core/managers/AsignadorSustitutos.js — so calling it never mutates
 * module state. The adapter only invokes it to mirror the alias search that
 * `obtenerSustitutoProfesional` performs; no method is replaced, nothing is
 * patched, and the declared ambient module shape in legacy-modules.d.ts is
 * untouched.
 */
interface LegacyAliasOracle {
  sonMismoProfesional(key1: string, key2: string): boolean;
}

const LEGACY_ALIAS_ORACLE = AsignadorSustitutos as unknown as LegacyAliasOracle;

export function freezeDeep<T>(value: T): T {
  if (value !== null && typeof value === "object") {
    for (const entry of Object.values(value as Record<string, unknown>)) {
      freezeDeep(entry);
    }
    Object.freeze(value);
  }
  return value;
}

export function freezePseudonymState(state: PseudonymState): PseudonymState {
  return freezeDeep({
    asignaciones: state.asignaciones.map((entry) => [entry[0], entry[1]] as const),
    profesionales: state.profesionales.map((entry) => [entry[0], entry[1]] as const),
    familiares: state.familiares.map((entry) => [entry[0], entry[1]] as const),
    contadorProfesionales: state.contadorProfesionales,
    contadorFamiliares: state.contadorFamiliares,
  });
}

/**
 * Reconcile one legacy manager map (fresh state produced by the just-run
 * legacy call) against the authoritative state from the shared context.
 * Keys are the ones the legacy module itself computed, so no key semantics
 * are duplicated here. `freshToFinal` collects the pseudonym string
 * rewrites (fresh pseudonym → context-authoritative pseudonym).
 *
 * `findAlias` (optional, used for profesionales): given a fresh key with no
 * exact match in `finalMap`, returns the pseudonym of the first existing
 * entry that the legacy alias oracle (`AsignadorSustitutos.sonMismoProfesional`)
 * considers the same professional, or null. This mirrors the iteration
 * semantics of the legacy `obtenerSustitutoProfesional` alias search
 * (iterate existing entries in order, first alias match wins), so an alias
 * key keeps the existing pseudonym without incrementing the counter.
 */
function reconcileCategory(
  freshMap: ReadonlyMap<string, string>,
  finalMap: Map<string, string>,
  nextForNew: (freshValue: string) => string | null,
  freshToFinal: Map<string, string>,
  findAlias?: (freshKey: string) => string | null
): void {
  const keysByValue = new Map<string, string[]>();
  for (const [key, value] of freshMap) {
    const keys = keysByValue.get(value);
    if (keys) keys.push(key);
    else keysByValue.set(value, [key]);
  }

  for (const [freshValue, keys] of keysByValue) {
    const contextKey = keys.find((key) => finalMap.has(key));
    if (contextKey !== undefined) {
      const finalValue = finalMap.get(contextKey);
      if (finalValue !== undefined && finalValue !== freshValue) {
        freshToFinal.set(freshValue, finalValue);
      }
      continue;
    }
    if (findAlias !== undefined) {
      let aliasValue: string | null = null;
      for (const freshKey of keys) {
        aliasValue = findAlias(freshKey);
        if (aliasValue !== null) break;
      }
      if (aliasValue !== null) {
        if (aliasValue !== freshValue) {
          freshToFinal.set(freshValue, aliasValue);
        }
        // All keys of the group share one fresh pseudonym (the legacy call
        // already collapsed aliases within the document), so they all map
        // to the context-authoritative value. No counter increment.
        for (const key of keys) {
          finalMap.set(key, aliasValue);
        }
        continue;
      }
    }
    const generated = nextForNew(freshValue);
    const finalValue = generated ?? freshValue;
    if (finalValue !== freshValue) {
      freshToFinal.set(freshValue, finalValue);
    }
    for (const key of keys) {
      finalMap.set(key, finalValue);
    }
  }
}

/**
 * Rebuild the processed text applying the context-authoritative pseudonyms.
 * Entities are non-overlapping (guaranteed by the legacy conflict resolver)
 * and are applied back-to-front over the immutable original text.
 */
function rebuildProcessedText(
  original: string,
  entities: readonly LegacyEntity[],
  freshToFinal: ReadonlyMap<string, string>
): string {
  let processed = original;
  const backToFront = [...entities]
    .filter((entity) => entity && entity.position)
    .sort((a, b) => b.position.start - a.position.start);
  for (const entity of backToFront) {
    const replacement =
      typeof entity.transformed === "string" && freshToFinal.has(entity.transformed)
        ? freshToFinal.get(entity.transformed)
        : entity.transformed;
    if (typeof replacement !== "string") continue;
    processed =
      processed.slice(0, entity.position.start) +
      replacement +
      processed.slice(entity.position.end);
  }
  return processed;
}

/**
 * Shared-mode seam: reconcile the fresh legacy state against the context's
 * authoritative pseudonym state and return the updated frozen context.
 */
export function reconcileSharedContext(
  context: ProcessingContext,
  legacyResult: LegacyProcessorResult
): { result: LegacyProcessorResult; context: ProcessingContext } {
  const state = context.pseudonymState ?? EMPTY_PSEUDONYM_STATE;
  const finalAsignaciones = new Map(state.asignaciones);
  const finalProfesionales = new Map(state.profesionales);
  const finalFamiliares = new Map(state.familiares);
  let contadorProfesionales = state.contadorProfesionales;
  let contadorFamiliares = state.contadorFamiliares;
  const freshToFinal = new Map<string, string>();

  // Alias-aware reconciliation for profesionales: a fresh key that no exact
  // context entry matches may still alias one (per the legacy module's own
  // `sonMismoProfesional` oracle, called read-only). Mirrors the legacy
  // `obtenerSustitutoProfesional` search: iterate existing entries in order,
  // first alias match wins, existing pseudonym reused, counter untouched.
  const findProfessionalAlias = (freshKey: string): string | null => {
    for (const [existingKey, value] of finalProfesionales) {
      if (LEGACY_ALIAS_ORACLE.sonMismoProfesional(freshKey, existingKey)) {
        return value;
      }
    }
    return null;
  };

  reconcileCategory(
    AsignadorSustitutos.profesionalesMap,
    finalProfesionales,
    () => {
      contadorProfesionales += 1;
      return `Profesional Sanitario ${contadorProfesionales}`;
    },
    freshToFinal,
    findProfessionalAlias
  );
  reconcileCategory(
    AsignadorSustitutos.familiaresMap,
    finalFamiliares,
    () => {
      contadorFamiliares += 1;
      return `Familiar ${contadorFamiliares}`;
    },
    freshToFinal
  );
  reconcileCategory(
    AsignadorSustitutos.mapaAsignaciones,
    finalAsignaciones,
    () => null,
    freshToFinal
  );

  const result: LegacyProcessorResult = {
    ...legacyResult,
    processed: rebuildProcessedText(legacyResult.original, legacyResult.entities, freshToFinal),
    entities: legacyResult.entities.map((entity) =>
      typeof entity?.transformed === "string" && freshToFinal.has(entity.transformed)
        ? { ...entity, transformed: freshToFinal.get(entity.transformed) }
        : entity
    ),
  };

  return {
    result,
    context: freezeDeep({
      mode: "shared" as const,
      pseudonymState: freezePseudonymState({
        asignaciones: [...finalAsignaciones.entries()],
        profesionales: [...finalProfesionales.entries()],
        familiares: [...finalFamiliares.entries()],
        contadorProfesionales,
        contadorFamiliares,
      }),
      ...(context.options === undefined ? {} : { options: context.options }),
    }),
  };
}

/**
 * Create a V4 engine backed by the legacy brownfield core. Worker-safe:
 * no window/document access anywhere in the reachable module graph.
 */
export function createLegacyEngine() {
  ensureLegacySetup();
  return {
    process(input: { text: string; context: ProcessingContext }): EngineOutcome {
      if (input === null || typeof input !== "object") {
        throw new EngineError(
          "invalid-context",
          "Engine input must be an object with text and context."
        );
      }
      assertValidText(input.text);
      assertValidContext(input.context);
      const context = input.context;

      AsignadorSustitutos.reset();
      const rawResult: unknown = Processor.process(input.text);
      assertLegacyResultShape(rawResult);
      const result = rawResult;

      if (context.mode === "fresh") {
        return freezeDeep({
          result,
          context: freezeDeep({
            mode: "fresh" as const,
            pseudonymState: freezePseudonymState(snapshotModulePseudonymState()),
            ...(context.options === undefined ? {} : { options: context.options }),
          }),
        });
      }
      return freezeDeep(reconcileSharedContext(context, result));
    },
  };
}
