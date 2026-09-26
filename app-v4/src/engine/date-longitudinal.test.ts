import { describe, expect, it } from "vitest";

import { FechasManager } from "../../../js/core/managers/FechasManager.js";
import { DateOperatorError, DateShiftOperator, readDateShiftState } from "./date-operator";
import {
  createDateShiftState,
  resolveDateShiftOffset,
  shiftDateString,
  withDateShiftOverride,
} from "./date-shift";
import { createLegacyOperatorRegistry } from "./legacy-operators";
import { createLegacyRecognizerRegistry, LEGACY_RECOGNIZER_KEY } from "./legacy-recognizers";
import { LEGACY_OPERATOR_KEYS, type Operator, OperatorRegistry } from "./operator-registry";
import { lookupPolicyProfile } from "./policy";
import { createRegistryEngine } from "./registry-engine";
import type { ProcessingContext } from "./types";

/**
 * Longitudinal date-shift regression for the T13 DATE capability (Work Order
 * #17, WU-C). This suite proves the consistent-shift capability over a
 * batch-shaped linked set: ONE shared `ProcessingContext` whose
 * `options.dateShift` is a single source-date-independent context offset, so
 * every document shares the same shift, pairwise day intervals are preserved
 * and chronological order is unchanged.
 *
 * Oracles:
 *  1. one shared context, one stable offset: the engine seam
 *     (`readDateShiftState`) resolves the state and `resolveDateShiftOffset`
 *     returns the same integer for every FECHA of the linked set, with
 *     `v4.date-shift` moving every date away from its source;
 *  2. intervals and ordering across the whole linked set (UTC-only math, no
 *     timezone/clock dependence);
 *  3. override scope: an explicit per-date override changes only that date and
 *     intentionally breaks its interval (documented caller consequence);
 *  4. year precision documented limit: a bare year shifts at year precision;
 *  5. composed-engine seam harness: a thin test-double delegating
 *     `legacy.date-transform` to `v4.date-shift` when a shift is threaded
 *     proves the engine's EXISTING context threading across documents without
 *     changing the accepted policy;
 *  6. fail-closed: a malformed `options.dateShift` throws before any manager
 *     mutation.
 *
 * Privacy: all fixtures are synthetic; no content is logged. The local date
 * math uses `Date.UTC` only (never `Date.now`), so the assertions are
 * timezone-independent and deterministic.
 */

const LINKED = [
  "Ingreso el 05/01/2024.",
  "Analítica el 12/01/2024 y revisión el 02/02/2024.",
  "Alta médica el 20/03/2024.",
] as const;

const SHIFT_SEED = "study-7";

const recognizer = createLegacyRecognizerRegistry().get(LEGACY_RECOGNIZER_KEY);
const shiftOperator = new DateShiftOperator();

/** Parses a `dd/mm/yyyy` fixture into a UTC epoch day. */
function toUtcDay(dateText: string): number {
  const match = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(dateText);
  if (match === null) throw new Error(`unexpected date format "${dateText}"`);
  return Date.UTC(Number(match[3]), Number(match[2]) - 1, Number(match[1])) / 86_400_000;
}

/** The FECHA observations of `text` via the exact recognizer the engine uses. */
function fechaObservations(text: string) {
  return recognizer.observe(text).filter((observation) => observation.type === "FECHA");
}

/** The linked set's FECHA observations, in document order. */
function linkedObservations() {
  return LINKED.flatMap((doc) => fechaObservations(doc));
}

/** Shifts every observation of the linked set under `context`. */
function shiftLinked(context: ProcessingContext): {
  readonly observations: ReturnType<typeof linkedObservations>;
  readonly sources: string[];
  readonly shifted: string[];
} {
  const observations = linkedObservations();
  const sources = observations.map((observation) => observation.text);
  const state = readDateShiftState(context.options);
  if (state === undefined)
    throw new Error("expected the engine seam to resolve a date-shift state");
  const shifted = observations.map((observation) =>
    shiftOperator.apply(observation, { strictMode: false, date: { role: "unknown", shift: state } })
  );
  return { observations, sources, shifted };
}

describe("T13 WU-C — longitudinal consistent shifting over one shared context", () => {
  it("resolves ONE stable offset across the linked set and shifts every date away from its source (ORACLE 1)", () => {
    const context: ProcessingContext = {
      mode: "shared",
      options: { dateShift: createDateShiftState(SHIFT_SEED) },
    };
    const state = readDateShiftState(context.options);
    if (state === undefined) {
      throw new Error("expected readDateShiftState to resolve the shared date-shift state");
    }

    const { observations, sources, shifted } = shiftLinked(context);
    expect(observations).toHaveLength(4);

    const offsets = observations.map((observation) =>
      resolveDateShiftOffset(state, observation.text)
    );
    expect(new Set(offsets).size).toBe(1);

    for (let index = 0; index < sources.length; index += 1) {
      expect(shifted[index]).not.toBe(sources[index]);
      expect(shifted[index]).toMatch(/^\d{2}\/\d{2}\/\d{4}$/);
    }
  });

  it("preserves every pairwise interval and the ascending order of the whole linked set (ORACLE 2)", () => {
    const context: ProcessingContext = {
      mode: "shared",
      options: { dateShift: createDateShiftState(SHIFT_SEED) },
    };
    const { sources, shifted } = shiftLinked(context);

    // Concrete interval: 05/01/2024 → 12/01/2024 stays exactly 7 days.
    const firstIndex = sources.indexOf("05/01/2024");
    const secondIndex = sources.indexOf("12/01/2024");
    expect(toUtcDay(sources[secondIndex]) - toUtcDay(sources[firstIndex])).toBe(7);
    expect(toUtcDay(shifted[secondIndex]) - toUtcDay(shifted[firstIndex])).toBe(7);

    // Every pairwise day interval in the source set equals its shifted interval.
    for (let i = 0; i < sources.length; i += 1) {
      for (let j = i + 1; j < sources.length; j += 1) {
        expect(toUtcDay(shifted[j]) - toUtcDay(shifted[i])).toBe(
          toUtcDay(sources[j]) - toUtcDay(sources[i])
        );
      }
    }

    // The ascending order of the dates is identical before and after shifting.
    const indices = sources.map((_, index) => index);
    const bySource = [...indices].sort((a, b) => toUtcDay(sources[a]) - toUtcDay(sources[b]));
    const byShifted = [...indices].sort((a, b) => toUtcDay(shifted[a]) - toUtcDay(shifted[b]));
    expect(byShifted).toEqual(bySource);
  });

  it("scopes an explicit override to its own date, intentionally breaks that interval and still asserts overall order (ORACLE 3)", () => {
    const baseContext: ProcessingContext = {
      mode: "shared",
      options: { dateShift: createDateShiftState(SHIFT_SEED) },
    };
    const baseState = readDateShiftState(baseContext.options);
    if (baseState === undefined) {
      throw new Error("expected readDateShiftState to resolve the base date-shift state");
    }
    const overriddenState = withDateShiftOverride(baseState, "12/01/2024", 1);
    const overriddenContext: ProcessingContext = {
      mode: "shared",
      options: { dateShift: overriddenState },
    };

    const base = shiftLinked(baseContext);
    const overridden = shiftLinked(overriddenContext);
    const overriddenIndex = overridden.sources.indexOf("12/01/2024");

    for (let index = 0; index < overridden.sources.length; index += 1) {
      if (index === overriddenIndex) continue;
      // Every other date is byte-identical to the non-overridden run.
      expect(overridden.shifted[index]).toBe(base.shifted[index]);
    }
    expect(overridden.shifted[overriddenIndex]).toBe("13/01/2024");

    // Documented caller consequence: the override intentionally BREAKS the
    // 05/01/2024 → 12/01/2024 interval (no longer 7 days).
    const firstIndex = overridden.sources.indexOf("05/01/2024");
    expect(
      toUtcDay(overridden.shifted[overriddenIndex]) - toUtcDay(overridden.shifted[firstIndex])
    ).not.toBe(7);

    // The overall ordering is still asserted: the overridden date moves ahead
    // of the rest, which is the explicit caller decision.
    const indices = overridden.sources.map((_, index) => index);
    const byShifted = [...indices].sort(
      (a, b) => toUtcDay(overridden.shifted[a]) - toUtcDay(overridden.shifted[b])
    );
    expect(byShifted).toEqual([
      overriddenIndex,
      firstIndex,
      overridden.sources.indexOf("02/02/2024"),
      overridden.sources.indexOf("20/03/2024"),
    ]);
  });

  it("shifts a bare year at year precision: identity while the offset stays inside the year (documented limit, ORACLE 4)", () => {
    // WU-A foundation behavior: a bare `ano` date is anchored at Jan 1 and
    // re-emitted at YEAR precision, so day-level intervals are NOT defined for
    // it. Only the year is meaningful; a ±offset that crosses a year boundary
    // changes the emitted year.
    const observations = fechaObservations("Revisión en 2019.");
    expect(observations).toHaveLength(1);
    expect(observations[0].subtype).toBe("ano");

    const state = createDateShiftState(SHIFT_SEED);
    const inYearState = withDateShiftOverride(state, "2019", 100);
    expect(resolveDateShiftOffset(inYearState, "2019")).toBe(100);
    expect(shiftDateString("2019", resolveDateShiftOffset(inYearState, "2019"))).toBe("2019");

    // The default +499-day context offset moves the same bare year to 2020:
    // exactly the year-precision behavior, not a day-level shift.
    expect(shiftDateString("2019", state.contextOffsetDays)).toBe("2020");
  });

  it("composed-engine seam harness shifts every FECHA across documents under ONE shared offset while policy stays unchanged (integration only, ORACLE 5)", () => {
    // NOT an accepted policy: an integration harness for the engine's EXISTING
    // context threading. It replaces `legacy.date-transform` with a thin
    // test-double that delegates to `v4.date-shift` only when a shift state is
    // threaded, and to the real accepted operator otherwise.
    const context: ProcessingContext = {
      mode: "shared",
      options: { dateShift: createDateShiftState(SHIFT_SEED) },
    };
    const state = readDateShiftState(context.options);
    if (state === undefined) {
      throw new Error("expected readDateShiftState to resolve the shared date-shift state");
    }

    // (a) The accepted mapping in policy.ts is UNCHANGED by this harness.
    expect(lookupPolicyProfile("standard").categoryOperatorKeys.FECHA).toBe(
      LEGACY_OPERATOR_KEYS.DATE_TRANSFORM
    );

    const legacyRegistry = createLegacyOperatorRegistry();
    const double: Operator = {
      key: LEGACY_OPERATOR_KEYS.DATE_TRANSFORM,
      apply(observation, operatorContext) {
        if (observation.type === "FECHA" && operatorContext.date?.shift !== undefined) {
          return new DateShiftOperator().apply(observation, operatorContext);
        }
        return legacyRegistry
          .get(LEGACY_OPERATOR_KEYS.DATE_TRANSFORM)
          .apply(observation, operatorContext);
      },
    };
    const registry = new OperatorRegistry();
    for (const key of legacyRegistry.keys()) {
      registry.register(
        key === LEGACY_OPERATOR_KEYS.DATE_TRANSFORM ? double : legacyRegistry.get(key)
      );
    }
    const engine = createRegistryEngine({ operatorRegistry: registry });

    // (b) Every FECHA comes back shifted with the SAME offset across all three
    //     documents of the linked set.
    const deltas = new Set<number>();
    let fechaCount = 0;
    for (const doc of LINKED) {
      const outcome = engine.process({ text: doc, context });
      for (const entity of outcome.result.entities) {
        if (entity.type !== "FECHA") continue;
        fechaCount += 1;
        const shifted = entity.transformed ?? "";
        expect(shifted).not.toBe(entity.text);
        expect(shifted).toMatch(/^\d{2}\/\d{2}\/\d{4}$/);
        deltas.add(toUtcDay(shifted) - toUtcDay(entity.text));
      }
    }
    expect(fechaCount).toBe(4);
    expect(deltas.size).toBe(1);
    expect([...deltas][0]).toBe(state.contextOffsetDays);

    // (c) Without `options.dateShift` the same visit document keeps the
    //     accepted `Visita N` behaviour: the harness does not alter defaults.
    const defaultOutcome = engine.process({
      text: "Analítica el 12/01/2024 y revisión el 02/02/2024.",
      context: { mode: "fresh" },
    });
    const defaultFechas = defaultOutcome.result.entities.filter(
      (entity) => entity.type === "FECHA"
    );
    expect(defaultFechas.length).toBeGreaterThan(0);
    for (const fecha of defaultFechas) {
      expect(fecha.transformed ?? "").toMatch(/^Visita/);
    }
  });

  it("fails closed on a malformed options.dateShift before any manager mutation (ORACLE 6)", () => {
    FechasManager.reset();
    const engine = createRegistryEngine();
    const malformedContext: ProcessingContext = {
      mode: "fresh",
      options: { dateShift: { seed: "", contextOffsetDays: 1, overrides: [] } },
    };
    try {
      engine.process({ text: LINKED[0], context: malformedContext });
      throw new Error("expected engine.process to throw");
    } catch (error) {
      expect(error).toBeInstanceOf(DateOperatorError);
      expect((error as DateOperatorError).code).toBe("invalid-date-shift-state");
    }
    expect(FechasManager.visitasMap.size).toBe(0);
  });
});
