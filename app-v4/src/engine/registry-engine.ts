/**
 * V4 registry-composed engine (Work Order T11 #15, WU3).
 *
 * Composes the WU1 recognizer registry → the WU2b headless policy lookup →
 * the WU2a operator registry behind the SAME `V4PrivacyEngine` boundary as
 * `legacy-engine.ts` (SPEC_V4_PRIVACY_ENGINE.md §2/§3/§5/§6/§7;
 * CURRENT_DECISIONS.md D-003/D-007/D-009/D-011). This is the material
 * ARCH-004 step: recognition (what is this?) is dispatched through the
 * {@link RecognizerRegistry} by the explicit legacy full-pipeline key, and
 * transformation (what should change?) is dispatched through the
 * {@link OperatorRegistry} by the explicit category→operator keys of the
 * policy profile. `Processor.process` is never called: the composed pipeline
 * mirrors js/core/processor.js `process()` stage by stage (resets →
 * detection → `preprocessFechas` → back-to-front transformation) without
 * hard-coding detection or transformation into the engine.
 *
 * Preparation is the engine's job (WU2 state contract): the composed engine
 * resets the legacy transformation managers exactly like the legacy
 * `process()` does (AsignadorSustitutos, UbicacionesManager, FechasManager)
 * and runs the legacy `preprocessFechas` date-visit preparation over the
 * recognized observations before any operator is dispatched. Operators never
 * reset or prepare state themselves.
 *
 * Policy semantics (D-007): the transformation profile resolves through
 * `lookupPolicyProfile` — `standard` by default (the accepted legacy
 * mapping, `modoEstricto=false`); `strict` maps to the legacy strict
 * branches; `external-ai`/`longitudinal-research` and unknown ids fail typed
 * instead of guessing a transformation. Recognition is policy-invariant by
 * construction: observations depend only on the shared legacy detection
 * configuration, never on the chosen policy (ACCEPTANCE 1).
 *
 * Fresh/shared context semantics are IDENTICAL to `legacy-engine.ts` by
 * reuse, not duplication: the same exported fail-closed validators
 * (`assertValidText`, `assertValidContext`) and the same exported
 * reconciliation helpers (`snapshotModulePseudonymState`,
 * `freezePseudonymState`, `freezeDeep`, `reconcileSharedContext`) are used,
 * so the shared-context pseudonym reconciliation cannot drift between the
 * two engines.
 *
 * Known boundary consequence (deliberate, not a silent drop): the legacy
 * `scoring.descartadas` detail (sub-threshold entities and their scoring
 * reasons) is NOT carried across the recognizer observation contract — WU1
 * deliberately strips recognition internals from observations. The composed
 * engine therefore reports only the recognition-configuration fields of the
 * legacy scoring summary and omits `entidadesDescartadas`/`descartadas`
 * rather than fabricating them. Recorded as follow-up debt in the feature
 * document; nothing downstream (from-processor/review/outputs) consumes it.
 *
 * Fail-closed (D-009): the same input/context validation rules as the
 * legacy engine, typed failures for unknown recognizer/operator registry
 * keys and unmapped policy ids, and a typed failure if an observation type
 * is missing from the policy profile's mapping (no guessed operator, no
 * silent KEEP).
 *
 * Session identity (PR #40 corrective C3): the non-sensitive opaque
 * `sessionId` is generated with the Web Crypto `randomUUID` primitive and
 * NEVER with `Math.random` or any non-cryptographic fallback. If that
 * primitive is unavailable in the current runtime the engine fails closed
 * with the typed {@link SessionIdError} instead of silently degrading.
 *
 * Privacy: this module never logs content, never mutates its input, and is
 * Worker-safe (no window/document access anywhere in its module graph).
 */

import { AsignadorSustitutos } from "../../../js/core/managers/AsignadorSustitutos.js";
import { FechasManager } from "../../../js/core/managers/FechasManager.js";
import { UbicacionesManager } from "../../../js/core/managers/UbicacionesManager.js";
import { Processor } from "../../../js/core/processor.js";
import type { PrivacyPolicyId } from "../domain/job";
import {
  assertValidContext,
  assertValidText,
  freezeDeep,
  freezePseudonymState,
  reconcileSharedContext,
  snapshotModulePseudonymState,
} from "./legacy-engine";
import { createLegacyOperatorRegistry } from "./legacy-operators";
import { createLegacyRecognizerRegistry, LEGACY_RECOGNIZER_KEY } from "./legacy-recognizers";
import { type OperatorRegistry } from "./operator-registry";
import { lookupPolicyProfile, PolicyError } from "./policy";
import {
  type RecognizerCategory,
  type RecognizerObservation,
  type RecognizerRegistry,
} from "./recognizer-registry";
import {
  EngineError,
  type EngineOutcome,
  type LegacyEntity,
  type LegacyProcessorResult,
  type ProcessingContext,
} from "./types";

/** Default policy: the accepted legacy mapping (modoEstricto=false). */
const DEFAULT_POLICY_ID: PrivacyPolicyId = "standard";

/**
 * Typed failure for the session-identity primitive (PR #40 corrective C3).
 * Raised when the runtime does not expose a cryptographically strong
 * identifier generator; the engine never falls back to `Math.random`.
 */
export class SessionIdError extends Error {
  readonly code = "secure-session-id-unavailable" as const;
  constructor(message: string) {
    super(message);
    this.name = "SessionIdError";
  }
}

/**
 * Opaque, non-sensitive session identity via the Web Crypto `randomUUID`
 * primitive (browser/Worker-safe; no `window`/`document` access). Fails
 * closed — never a non-cryptographic fallback — when the primitive is
 * genuinely unavailable in the current runtime.
 */
function generateSessionId(): string {
  const webCrypto: Crypto | undefined = globalThis.crypto;
  if (webCrypto === undefined || typeof webCrypto.randomUUID !== "function") {
    throw new SessionIdError(
      "A cryptographically strong session identifier is unavailable in this runtime (Web Crypto randomUUID is missing); refusing to generate a session id with a non-cryptographic fallback."
    );
  }
  return webCrypto.randomUUID();
}

/** Engine input: the V4PrivacyEngine shape plus the optional policy choice. */
export type RegistryEngineInput = {
  readonly text: string;
  readonly context: ProcessingContext;
  /** Optional D-007 policy id; defaults to the accepted `standard` profile. */
  readonly policyId?: PrivacyPolicyId;
};

/** Optional registry overrides; production defaults to the legacy registries. */
export type RegistryEngineOptions = {
  readonly recognizerRegistry?: RecognizerRegistry;
  readonly operatorRegistry?: OperatorRegistry;
};

/**
 * Mirror of the legacy `Processor.calculateStats` byType counters
 * (js/core/processor.js); field names are legacy contract, not new design.
 */
function calculateStats(entities: readonly LegacyEntity[]): LegacyProcessorResult["stats"] {
  const byType: Record<string, number> = {
    pacientes: 0,
    profesionales: 0,
    familiares: 0,
    fechas: 0,
    identificadores: 0,
    ubicaciones: 0,
    sospechosos: 0,
    nombres: 0,
  };
  for (const entity of entities) {
    if (entity.type === "NOMBRE") {
      byType.nombres += 1;
      if (entity.subtype === "paciente") byType.pacientes += 1;
      else if (entity.subtype === "profesional") byType.profesionales += 1;
      else if (entity.subtype === "familiar") byType.familiares += 1;
    }
    if (entity.type === "FECHA") byType.fechas += 1;
    if (entity.type === "IDENTIFICADOR") byType.identificadores += 1;
    if (entity.type === "UBICACION") byType.ubicaciones += 1;
    if (entity.type === "SOSPECHOSO") byType.sospechosos += 1;
  }
  return { totalEntities: entities.length, byType };
}

/** Freezes one entity with the recognition-contract fields plus `transformed`. */
function freezeTransformedEntity(
  observation: RecognizerObservation,
  transformed: string
): LegacyEntity {
  return freezeDeep({
    type: observation.type,
    ...(observation.subtype === undefined ? {} : { subtype: observation.subtype }),
    text: observation.text,
    ...(observation.original === undefined ? {} : { original: observation.original }),
    position: { start: observation.start, end: observation.end },
    confidence: observation.confidence,
    transformed,
  });
}

/**
 * Explicit adapter from a normalized recognizer observation to the legacy
 * entity shape the `preprocessFechas` boundary consumes. The current legacy
 * implementation only READS type/subtype/text, but the boundary's documented
 * contract is the legacy entity shape (including `position`); adapting
 * explicitly keeps the seam contract-checked instead of relying on
 * structural coincidence, so a future legacy change that reads `position`
 * cannot silently break date-visit preparation (Work Order T11 #15, review
 * finding R3-001 of lineage review-ca481631d9c01f72).
 */
function toLegacyPreparationEntity(observation: RecognizerObservation): {
  type: string;
  subtype?: string;
  text: string;
  position: { start: number; end: number };
} {
  return {
    type: observation.type,
    ...(observation.subtype === undefined ? {} : { subtype: observation.subtype }),
    text: observation.text,
    position: { start: observation.start, end: observation.end },
  };
}

/**
 * Resolves the operator registry key for one observation type from the
 * policy profile. A type outside the profile's mapping fails typed instead
 * of guessing a transformation (D-009: UNKNOWN never defaults to KEEP).
 */
function resolveOperatorKey(
  profile: { readonly categoryOperatorKeys: Readonly<Record<RecognizerCategory, string>> },
  observation: RecognizerObservation
): string {
  const mapping: Readonly<Record<string, string | undefined>> = profile.categoryOperatorKeys;
  const operatorKey = mapping[observation.type];
  if (operatorKey === undefined) {
    throw new PolicyError(
      "policy-operator-mapping-unavailable",
      `The policy profile does not map observation type "${observation.type}" to any operator; failing closed instead of guessing a transformation.`
    );
  }
  return operatorKey;
}

/**
 * Recognition-configuration summary mirroring the legacy scoring fields the
 * engine can honestly report: the same shared legacy configuration the
 * recognizer pipeline actually used for its threshold filter (read at call
 * time, exactly like the legacy expression).
 */
function summarizeRecognitionConfig(): Record<string, unknown> {
  const umbralConfianza = Number(Processor.config.umbralConfianza);
  const modoEstricto = Processor.config.modoEstricto === true;
  return {
    usarScoring: Processor.config.usarScoring,
    umbralConfianza,
    umbralEfectivo: modoEstricto ? Math.min(umbralConfianza, 0.35) : umbralConfianza,
    modoEstricto,
  };
}

/**
 * Create the registry-composed V4 engine. Worker-safe: no window/document
 * access anywhere in the reachable module graph.
 */
export function createRegistryEngine(options: RegistryEngineOptions = {}) {
  const recognizerRegistry = options.recognizerRegistry ?? createLegacyRecognizerRegistry();
  const operatorRegistry = options.operatorRegistry ?? createLegacyOperatorRegistry();

  return {
    process(input: RegistryEngineInput): EngineOutcome {
      const startTime = performance.now();

      // 1. Fail-closed validation: the exact same rules as the legacy engine
      //    (reused, not duplicated) — object shape, text, serializability.
      if (input === null || typeof input !== "object") {
        throw new EngineError(
          "invalid-context",
          "Engine input must be an object with text and context."
        );
      }
      assertValidText(input.text);
      assertValidContext(input.context);
      const context = input.context;
      const text = input.text;

      // 2. Policy resolution BEFORE any state mutation: a typed policy
      //    failure must leave no side effects behind (D-009 fail-closed).
      const profile = lookupPolicyProfile(input.policyId ?? DEFAULT_POLICY_ID);

      // 3. Transformation-manager preparation (the engine's job per the WU2
      //    state contract): the exact resets legacy `Processor.process`
      //    performs at the start of every call.
      AsignadorSustitutos.reset();
      UbicacionesManager.reset();
      FechasManager.reset();

      // 4. Recognition through the recognizer registry by explicit key (the
      //    legacy full-pipeline adapter covering every legacy category).
      //    Detection is policy-invariant and mutates no manager state.
      const observations = recognizerRegistry.get(LEGACY_RECOGNIZER_KEY).observe(text);

      // 5. Date-visit preparation via the legacy `preprocessFechas` over the
      //    recognized observations, explicitly adapted to the legacy entity
      //    shape that boundary consumes (same subset conditions and same
      //    date-ordered `procesarVisita` sequence as the legacy pipeline;
      //    offsets are carried through unchanged).
      Processor.preprocessFechas(
        observations.map((observation) => toLegacyPreparationEntity(observation))
      );

      // 6. Transformation through the operator registry by the explicit
      //    keys of the policy profile, applied back-to-front exactly like
      //    the legacy pipeline so pseudonym/location/visit counters align.
      const operatorContext = { strictMode: profile.strictMode };
      const backToFront = [...observations].sort((a, b) => b.start - a.start);
      let processed = text;
      const entities: LegacyEntity[] = [];
      for (const observation of backToFront) {
        const operatorKey = resolveOperatorKey(profile, observation);
        const operator = operatorRegistry.get(operatorKey);
        const transformed = operator.apply(observation, operatorContext);
        processed =
          processed.slice(0, observation.start) + transformed + processed.slice(observation.end);
        entities.push(freezeTransformedEntity(observation, transformed));
      }
      // Legacy re-sorts ascending (stable) before returning the entities.
      entities.sort((a, b) => a.position.start - b.position.start);

      // 7. Legacy-shaped result (same fields as `Processor.process`).
      const result: LegacyProcessorResult = freezeDeep({
        original: text,
        processed,
        entities,
        alerts: [],
        stats: calculateStats(entities),
        sessionId: generateSessionId(),
        processingTime: Math.round(performance.now() - startTime),
        // Recognition-configuration summary. The legacy `descartadas` detail
        // is deliberately omitted (see module header): the recognizer
        // observation contract does not carry sub-threshold entities.
        scoring: summarizeRecognitionConfig(),
      });

      // 8. Fresh/shared context semantics: identical to the legacy engine by
      //    reusing its exported reconciliation helpers.
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
