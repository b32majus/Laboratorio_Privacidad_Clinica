/**
 * Legacy operator adaptation (Work Order T11 #15, WU2a).
 *
 * This module wraps — never rewrites — the transformation half of the legacy
 * brownfield core as V4 operators (CURRENT_DECISIONS D-003). It is the sole
 * owner of the js/core imports on the operator side; the pure contracts,
 * registry behavior, shared fail-closed validators and the KEEP identity
 * operator it implements live in `./operator-registry`.
 *
 * The operators here answer "what transformation applies?" (SPEC_V4_PRIVACY_ENGINE.md
 * §5) and are dispatched by the composed engine (WU3) once policy lookup maps
 * context/entity to an operator key. This module deliberately implements NO
 * policy: there is no type→operator map, no review/workflow state, and no
 * default operator anywhere in this file.
 *
 * STATE CONTRACT: operators mirror the accepted legacy
 * `Processor.transformEntity` semantics, which READ the shared
 * transformation-manager state (`FechasManager.visitasMap`,
 * `AsignadorSustitutos` maps, `UbicacionesManager` maps) as lookup input.
 * Operators may therefore READ that state, but `apply()` must NEVER reset or
 * mutate it as a side effect: no `reset()` calls, no map writes through the
 * operator, no `preprocessFechas`. Reset/preparation (the legacy
 * `preprocessFechas` visit computation) is the composed engine's
 * responsibility (WU3). Given prepared state, `apply()` is deterministic.
 *
 * Legacy mirroring (CURRENT_DECISIONS D-003): each operator reproduces the
 * exact branch of js/core/processor.js `transformEntity` for its
 * transformation category — REDACT, PSEUDONYMIZE, DATE_TRANSFORM and
 * GENERALIZE — including the `modoEstricto` profile branches, carried as the
 * explicit {@link OperatorContext} flag instead of a global config read.
 * Nothing is redesigned: the legacy silent deletion of IDENTIFICADOR is
 * preserved as the deletion encoding, and non-date FECHA subtypes keep their
 * legacy KEEP semantics inside DATE_TRANSFORM. The parity guarantee: given
 * the same prepared manager state, each operator's output is bit-identical
 * to the matching legacy `transformEntity` branch (proven by the oracles in
 * legacy-operators.test.ts).
 *
 * Fail-closed (D-009): unknown registry keys raise the typed
 * `unknown-operator` error — there is no silent fallback to another
 * transformation, no default operator, and a category/operator mismatch is an
 * explicit typed error instead of a guessed replacement.
 *
 * Privacy: this module never logs content and is Worker-safe (no
 * window/document access anywhere in its module graph).
 */

import { AsignadorSustitutos } from "../../../js/core/managers/AsignadorSustitutos.js";
import { FechasManager } from "../../../js/core/managers/FechasManager.js";
import { UbicacionesManager } from "../../../js/core/managers/UbicacionesManager.js";
import {
  assertCoveredType,
  assertObservation,
  assertOperatorContext,
  KeepOperator,
  LEGACY_OPERATOR_KEYS,
  type Operator,
  type OperatorContext,
  OperatorRegistry,
} from "./operator-registry";
import { type RecognizerObservation } from "./recognizer-registry";

/** Legacy `entity.original || entity.text` selector, mirrored exactly. */
function originalOrText(observation: RecognizerObservation): string {
  return observation.original !== undefined && observation.original !== ""
    ? observation.original
    : observation.text;
}

/**
 * REDACT — mirrors the IDENTIFICADOR branch of legacy `transformEntity`:
 * replacement is the empty string (legacy silent deletion, preserved as the
 * deletion encoding; D-003: mirror, do not redesign).
 */
class LegacyRedactOperator implements Operator {
  readonly key = LEGACY_OPERATOR_KEYS.REDACT;

  apply(observation: RecognizerObservation, context: OperatorContext): string {
    assertObservation(observation);
    assertOperatorContext(context);
    assertCoveredType(observation, this.key, ["IDENTIFICADOR"]);
    return "";
  }
}

/**
 * PSEUDONYMIZE — mirrors the NOMBRE branch of legacy `transformEntity` via
 * the same public `AsignadorSustitutos` calls legacy makes, in the same
 * subtype order: profesional → `obtenerSustitutoProfesional`, familiar →
 * `obtenerSustitutoFamiliar`, everything else (paciente and fall-through) →
 * `obtenerSustituto` (gender autodetected by the legacy module). Calls may
 * grow the manager maps — that is the accepted legacy transformation
 * semantics, not a state purity violation (see STATE CONTRACT: apply never
 * resets and never rewrites existing mappings).
 */
class LegacyPseudonymizeOperator implements Operator {
  readonly key = LEGACY_OPERATOR_KEYS.PSEUDONYMIZE;

  apply(observation: RecognizerObservation, context: OperatorContext): string {
    assertObservation(observation);
    assertOperatorContext(context);
    assertCoveredType(observation, this.key, ["NOMBRE"]);
    const source = originalOrText(observation);
    if (observation.subtype === "profesional") {
      return AsignadorSustitutos.obtenerSustitutoProfesional(source);
    }
    if (observation.subtype === "familiar") {
      return AsignadorSustitutos.obtenerSustitutoFamiliar(source);
    }
    return AsignadorSustitutos.obtenerSustituto(source);
  }
}

/**
 * DATE_TRANSFORM — mirrors the FECHA branch of legacy `transformEntity`
 * exactly: full dates (`fecha_completa`), year-only (`ano`) and
 * slash/hyphen-prefixed partial dates go through the `FechasManager.visitasMap`
 * lookup first and `relativizarRespHoy` when unmapped (READ-only); every
 * other FECHA subtype returns the original text (legacy KEEP semantics,
 * kept inside this operator so the observation is never silently dropped).
 */
class LegacyDateTransformOperator implements Operator {
  readonly key = LEGACY_OPERATOR_KEYS.DATE_TRANSFORM;

  apply(observation: RecognizerObservation, context: OperatorContext): string {
    assertObservation(observation);
    assertOperatorContext(context);
    assertCoveredType(observation, this.key, ["FECHA"]);
    if (
      observation.subtype === "fecha_completa" ||
      observation.subtype === "ano" ||
      /^\d{1,2}[\/\-]/.test(observation.text)
    ) {
      const key = observation.text.trim();
      if (FechasManager.visitasMap.has(key)) {
        return FechasManager.visitasMap.get(key) as string;
      }
      return FechasManager.relativizarRespHoy(observation.text);
    }
    return observation.text;
  }
}

/**
 * GENERALIZE — mirrors the UBICACION and SOSPECHOSO branches of legacy
 * `transformEntity`, including both `modoEstricto` profiles: strict
 * UBICACION collapses to 'Centro Sanitario'/'Zona Geografica' and strict
 * SOSPECHOSO to '[dato_sensible]'; non-strict mode uses the same public
 * `UbicacionesManager` calls and per-subtype replacements as legacy, with
 * the same 'dato cuasi-identificador' default.
 */
class LegacyGeneralizeOperator implements Operator {
  readonly key = LEGACY_OPERATOR_KEYS.GENERALIZE;

  apply(observation: RecognizerObservation, context: OperatorContext): string {
    assertObservation(observation);
    assertOperatorContext(context);
    assertCoveredType(observation, this.key, ["UBICACION", "SOSPECHOSO"]);

    if (observation.type === "UBICACION") {
      if (context.strictMode) {
        if (observation.subtype === "hospital") return "Centro Sanitario";
        return "Zona Geografica";
      }
      const source = originalOrText(observation);
      if (observation.subtype === "hospital") {
        return UbicacionesManager.obtenerCentro(source);
      }
      // Legacy uses obtenerCiudad for ciudad, contexto AND the fall-through.
      return UbicacionesManager.obtenerCiudad(source);
    }

    // SOSPECHOSO
    if (context.strictMode) return "[dato_sensible]";
    if (observation.subtype === "enfermedad_rara") return "diagnostico poco frecuente";
    if (observation.subtype === "cargo_publico") return "cargo institucional";
    if (observation.subtype === "parentesco_especial") return "relacion familiar sensible";
    if (observation.subtype === "profesion_especifica") return "profesion sensible";
    return "dato cuasi-identificador";
  }
}

/**
 * Builds the default operator registry for the legacy transformation
 * semantics: one operator per legacy transformation category, registered
 * under the stable {@link LEGACY_OPERATOR_KEYS} keys (KEEP comes from the
 * pure contracts module). Category→operator dispatch is deliberately NOT
 * part of this module (policy lookup is a separate follow-up unit; a worker
 * must not invent mapping semantics beyond accepted authority).
 */
export function createLegacyOperatorRegistry(): OperatorRegistry {
  const registry = new OperatorRegistry();
  registry.register(new LegacyRedactOperator());
  registry.register(new LegacyPseudonymizeOperator());
  registry.register(new LegacyDateTransformOperator());
  registry.register(new LegacyGeneralizeOperator());
  registry.register(new KeepOperator());
  return registry;
}
