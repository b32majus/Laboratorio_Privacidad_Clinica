import { describe, expect, it } from "vitest";

import { type DateRole } from "./date-semantics";
import {
  classifyObservationDateRole,
  DATE_ROLE_CONTEXT_WINDOW_CHARS,
  DateGeneralizeOperator,
  DateOperatorError,
  type DateOperatorErrorCode,
  DateShiftOperator,
  dateRoleContextWindow,
  hasExplicitNonVisitRole,
  readDateShiftState,
} from "./date-operator";
import {
  createDateShiftState,
  DateShiftError,
  type DateShiftState,
  resolveDateShiftOffset,
  withDateShiftOverride,
} from "./date-shift";
import { LEGACY_OPERATOR_KEYS, type OperatorContext, OperatorError } from "./operator-registry";
import { type RecognizerObservation } from "./recognizer-registry";

/**
 * Contract oracles for the V4 date operators (Work Order T13 #17, WU-B part
 * A; SPEC_V4_PRIVACY_ENGINE.md §7/§9; CURRENT_DECISIONS.md D-009/D-010).
 *
 * These tests exercise the clause/cap windowing bridge to WU-A's classifier,
 * the two date operators, the extended optional date sub-context contract and
 * the fail-closed behavior. All fixtures are synthetic Spanish strings; no
 * real content is used.
 */

const NORMAL_CONTEXT: OperatorContext = Object.freeze({ strictMode: false });
const STRICT_CONTEXT: OperatorContext = Object.freeze({ strictMode: true });

const generalizeOperator = new DateGeneralizeOperator();
const shiftOperator = new DateShiftOperator();

/** Minimal synthetic FECHA observation factory. */
function fechaObservation(text: string, subtype?: string): RecognizerObservation {
  return Object.freeze({
    type: "FECHA",
    subtype,
    start: 0,
    end: text.length,
    text,
    confidence: 1,
  });
}

/** Builds a frozen explicit operator context carrying a date sub-context. */
function dateContext(role: DateRole, shift?: DateShiftState): OperatorContext {
  return Object.freeze({ strictMode: false, date: Object.freeze({ role, shift }) });
}

/** Locates a fixture substring and returns its half-open span. */
function spanOf(text: string, needle: string): { start: number; end: number } {
  const start = text.indexOf(needle);
  if (start < 0) throw new Error(`fixture "${text}" does not contain "${needle}"`);
  return { start, end: start + needle.length };
}

/** Parses a `dd/mm/yyyy` fixture into a UTC epoch day for interval math. */
function utcDay(dateText: string): number {
  const match = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(dateText);
  if (match === null) throw new Error(`unexpected shifted date format "${dateText}"`);
  return Date.UTC(Number(match[3]), Number(match[2]) - 1, Number(match[1])) / 86_400_000;
}

function expectDateOperatorError(
  fn: () => unknown,
  code: DateOperatorErrorCode
): DateOperatorError {
  try {
    fn();
  } catch (error) {
    expect(error).toBeInstanceOf(DateOperatorError);
    const typed = error as DateOperatorError;
    expect(typed.code).toBe(code);
    return typed;
  }
  throw new Error(`Expected a DateOperatorError with code "${code}" but no error was thrown.`);
}

describe("dateRoleContextWindow — clause + cap windowing", () => {
  it("includes a label before the date inside the same clause", () => {
    const text = "Fecha de nacimiento: 12/03/1954";
    const span = spanOf(text, "12/03/1954");
    expect(dateRoleContextWindow(text, span.start, span.end)).toBe(
      "Fecha de nacimiento: 12/03/1954"
    );
  });

  it("excludes a cue in a previous sentence separated by '.'", () => {
    const text = "Nacimiento registrado. Fecha: 12/03/1954";
    const span = spanOf(text, "12/03/1954");
    const window = dateRoleContextWindow(text, span.start, span.end);
    expect(window).not.toContain("Nacimiento");
    expect(window).toBe(" Fecha: 12/03/1954");
  });

  it("excludes a cue on a different line separated by '\\n'", () => {
    const text = "Nacimiento registrado\nFecha: 12/03/1954";
    const span = spanOf(text, "12/03/1954");
    const window = dateRoleContextWindow(text, span.start, span.end);
    expect(window).not.toContain("Nacimiento");
    expect(window).toBe("Fecha: 12/03/1954");
  });

  it("excludes a cue placed beyond the 64-character cap", () => {
    const text = `Nacimiento ${"x".repeat(70)} 12/03/1954`;
    const span = spanOf(text, "12/03/1954");
    const window = dateRoleContextWindow(text, span.start, span.end);
    expect(window).not.toContain("Nacimiento");
    expect(window.length).toBeLessThanOrEqual(DATE_ROLE_CONTEXT_WINDOW_CHARS + "12/03/1954".length);
    expect(DATE_ROLE_CONTEXT_WINDOW_CHARS).toBe(64);
  });

  it("fails closed with the typed error for invalid arguments", () => {
    const cases: (() => string)[] = [
      () => dateRoleContextWindow(42 as unknown as string, 0, 0),
      () => dateRoleContextWindow("abc", -1, 2),
      () => dateRoleContextWindow("abc", 0, 4),
      () => dateRoleContextWindow("abc", 2, 1),
      () => dateRoleContextWindow("abc", 1.5, 2),
      () => dateRoleContextWindow("abc", 0, Number.NaN),
    ];
    for (const fn of cases) expectDateOperatorError(fn, "invalid-date-operator-context");
  });
});

describe("classifyObservationDateRole — explicit-cue positives", () => {
  const positives: readonly { readonly role: DateRole; readonly text: string }[] = [
    { role: "birth", text: "Fecha de nacimiento: 12/03/1954" },
    { role: "admission", text: "Fecha de ingreso: 05/01/2024" },
    { role: "discharge", text: "Alta médica: 20/01/2024" },
    { role: "future-appointment", text: "Próxima cita: 10/02/2024" },
  ];

  for (const fixture of positives) {
    it(`classifies the date in "${fixture.text}" as ${fixture.role}`, () => {
      const match = /\d{2}[/-]\d{2}[/-]\d{4}/.exec(fixture.text);
      if (match === null) throw new Error(`fixture "${fixture.text}" has no date`);
      const span = spanOf(fixture.text, match[0]);
      expect(classifyObservationDateRole(fixture.text, span.start, span.end)).toBe(fixture.role);
    });
  }

  it("returns 'unknown' for an unlabeled date", () => {
    const text = "Fecha: 12/03/1984";
    const span = spanOf(text, "12/03/1984");
    expect(classifyObservationDateRole(text, span.start, span.end)).toBe("unknown");
  });

  it("windows same-line sibling dates: first birth, second unknown (acceptance oracle)", () => {
    const text = "Fecha de nacimiento: 12/03/1984. Fecha de visita: 02/06/2024.";
    const first = spanOf(text, "12/03/1984");
    const second = spanOf(text, "02/06/2024");
    expect(classifyObservationDateRole(text, first.start, first.end)).toBe("birth");
    expect(classifyObservationDateRole(text, second.start, second.end)).toBe("unknown");
  });
});

describe("hasExplicitNonVisitRole", () => {
  it("returns true for the four explicit non-visit roles", () => {
    const roles: readonly DateRole[] = ["birth", "admission", "discharge", "future-appointment"];
    for (const role of roles) {
      expect(hasExplicitNonVisitRole(role)).toBe(true);
    }
  });

  it("returns false for 'unknown' — no explicit non-visit cue, never a guess", () => {
    expect(hasExplicitNonVisitRole("unknown")).toBe(false);
  });

  it("fails closed with the typed error for a role outside the five accepted strings", () => {
    expectDateOperatorError(
      () => hasExplicitNonVisitRole("visit" as unknown as DateRole),
      "invalid-date-operator-context"
    );
  });
});

describe("readDateShiftState", () => {
  it("returns undefined for undefined options and for options with no dateShift key", () => {
    expect(readDateShiftState(undefined)).toBeUndefined();
    expect(readDateShiftState({})).toBeUndefined();
  });

  it("round-trips a real createDateShiftState state", () => {
    const state = createDateShiftState("wu-b-seed");
    expect(readDateShiftState({ dateShift: state })).toEqual(state);
  });

  it("fails closed with invalid-date-shift-state for each malformed shape", () => {
    const cases: (() => unknown)[] = [
      () => readDateShiftState(null as unknown as Record<string, unknown>),
      () => readDateShiftState("nope" as unknown as Record<string, unknown>),
      () => readDateShiftState([] as unknown as Record<string, unknown>),
      () => readDateShiftState({ dateShift: null }),
      () => readDateShiftState({ dateShift: 42 }),
      () => readDateShiftState({ dateShift: [] }),
      () => readDateShiftState({ dateShift: { seed: "", contextOffsetDays: 0, overrides: [] } }),
      () => readDateShiftState({ dateShift: { seed: "s", contextOffsetDays: 1.5, overrides: [] } }),
      () => readDateShiftState({ dateShift: { seed: "s", contextOffsetDays: 0, overrides: "no" } }),
      () =>
        readDateShiftState({ dateShift: { seed: "s", contextOffsetDays: 0, overrides: [["k"]] } }),
      () =>
        readDateShiftState({ dateShift: { seed: "s", contextOffsetDays: 0, overrides: [[1, 2]] } }),
    ];
    for (const fn of cases) expectDateOperatorError(fn, "invalid-date-shift-state");
  });
});

describe("DateGeneralizeOperator — precision generalization", () => {
  it("generalizes fecha_completa numeric dates to month precision", () => {
    expect(
      generalizeOperator.apply(fechaObservation("12/03/1954", "fecha_completa"), NORMAL_CONTEXT)
    ).toBe("03/1954");
    expect(
      generalizeOperator.apply(fechaObservation("12-03-1954", "fecha_completa"), NORMAL_CONTEXT)
    ).toBe("03-1954");
    expect(
      generalizeOperator.apply(fechaObservation("12/03/54", "fecha_completa"), NORMAL_CONTEXT)
    ).toBe("03/1954");
  });

  it("generalizes fecha_completa textual dates dropping only the day", () => {
    expect(
      generalizeOperator.apply(
        fechaObservation("18 de diciembre de 2023", "fecha_completa"),
        NORMAL_CONTEXT
      )
    ).toBe("diciembre de 2023");
  });

  it("generalizes fecha_parcial textual month + year to the year", () => {
    expect(
      generalizeOperator.apply(
        fechaObservation("diciembre de 2023", "fecha_parcial"),
        NORMAL_CONTEXT
      )
    ).toBe("2023");
  });

  it("keeps a bare legacy year unchanged under the 'ano' subtype (documented identity)", () => {
    expect(generalizeOperator.apply(fechaObservation("2019", "ano"), NORMAL_CONTEXT)).toBe("2019");
  });

  it("fails closed with unparseable-date on out-of-range or unparseable content", () => {
    expectDateOperatorError(
      () =>
        generalizeOperator.apply(fechaObservation("12/13/1954", "fecha_completa"), NORMAL_CONTEXT),
      "unparseable-date"
    );
    expectDateOperatorError(
      () => generalizeOperator.apply(fechaObservation("foo", "fecha_completa"), NORMAL_CONTEXT),
      "unparseable-date"
    );
    expectDateOperatorError(
      () => generalizeOperator.apply(fechaObservation("03/11", "fecha_parcial"), NORMAL_CONTEXT),
      "unparseable-date"
    );
    expectDateOperatorError(
      () =>
        generalizeOperator.apply(fechaObservation("foo de 2023", "fecha_parcial"), NORMAL_CONTEXT),
      "unparseable-date"
    );
    expectDateOperatorError(
      () => generalizeOperator.apply(fechaObservation("1899", "ano"), NORMAL_CONTEXT),
      "unparseable-date"
    );
  });

  it("fails closed with unsupported-date-generalization for an unknown subtype", () => {
    expectDateOperatorError(
      () => generalizeOperator.apply(fechaObservation("12/03/1954", "otro"), NORMAL_CONTEXT),
      "unsupported-date-generalization"
    );
    expectDateOperatorError(
      () => generalizeOperator.apply(fechaObservation("12/03/1954"), NORMAL_CONTEXT),
      "unsupported-date-generalization"
    );
  });

  it("ignores strictMode: standard and strict share the same mapping", () => {
    const observation = fechaObservation("12/03/1954", "fecha_completa");
    expect(generalizeOperator.apply(observation, STRICT_CONTEXT)).toBe(
      generalizeOperator.apply(observation, NORMAL_CONTEXT)
    );
  });

  it("fails with operator-category-mismatch for a non-FECHA observation", () => {
    const nonFecha = Object.freeze({
      ...fechaObservation("12/03/1954", "fecha_completa"),
      type: "NOMBRE",
    });
    try {
      generalizeOperator.apply(nonFecha, NORMAL_CONTEXT);
      throw new Error("expected apply to throw");
    } catch (error) {
      expect(error).toBeInstanceOf(OperatorError);
      expect((error as OperatorError).code).toBe("operator-category-mismatch");
    }
  });

  it("never returns the original full date, the source day or KEEP", () => {
    const observation = fechaObservation("12/03/1954", "fecha_completa");
    const output = generalizeOperator.apply(observation, NORMAL_CONTEXT);
    expect(output).not.toBe(observation.text);
    expect(output).not.toContain("12/03");
    expect(output).not.toBe("KEEP");
  });
});

describe("DateShiftOperator — consistent shifting", () => {
  it("fails closed with missing-date-shift-state when no shift state is present", () => {
    expectDateOperatorError(
      () => shiftOperator.apply(fechaObservation("05/01/2024", "fecha_completa"), NORMAL_CONTEXT),
      "missing-date-shift-state"
    );
    expectDateOperatorError(
      () =>
        shiftOperator.apply(fechaObservation("05/01/2024", "fecha_completa"), dateContext("birth")),
      "missing-date-shift-state"
    );
  });

  it("shifts a linked set by one source-date-independent offset, preserving interval and order", () => {
    const state = createDateShiftState("wu-b-linked-set");
    const context = dateContext("admission", state);
    const firstSource = "05/01/2024";
    const secondSource = "05/02/2024";
    const firstShifted = shiftOperator.apply(
      fechaObservation(firstSource, "fecha_completa"),
      context
    );
    const secondShifted = shiftOperator.apply(
      fechaObservation(secondSource, "fecha_completa"),
      context
    );

    const sourceFirst = utcDay(firstSource);
    const sourceSecond = utcDay(secondSource);
    const shiftedFirst = utcDay(firstShifted);
    const shiftedSecond = utcDay(secondShifted);

    // Same offset for both non-overridden dates of the linked set.
    expect(shiftedFirst - sourceFirst).toBe(shiftedSecond - sourceSecond);
    // Exact day interval is preserved.
    expect(shiftedSecond - shiftedFirst).toBe(sourceSecond - sourceFirst);
    // Chronological order is preserved.
    expect(shiftedFirst).toBeLessThan(shiftedSecond);
  });

  it("applies a per-date override only to its own date", () => {
    const state = createDateShiftState("wu-b-override");
    const overridden = withDateShiftOverride(state, "05/01/2024", 100);
    const context = dateContext("admission", overridden);

    const overrideShifted = shiftOperator.apply(
      fechaObservation("05/01/2024", "fecha_completa"),
      context
    );
    const otherShifted = shiftOperator.apply(
      fechaObservation("05/02/2024", "fecha_completa"),
      context
    );

    expect(utcDay(overrideShifted) - utcDay("05/01/2024")).toBe(100);
    expect(utcDay(otherShifted) - utcDay("05/02/2024")).toBe(
      resolveDateShiftOffset(state, "05/02/2024")
    );
  });

  it("fails closed with unparseable-date for unsupported date content", () => {
    const context = dateContext("future-appointment", createDateShiftState("wu-b-unparseable"));
    expectDateOperatorError(
      () => shiftOperator.apply(fechaObservation("diciembre de 2023", "fecha_parcial"), context),
      "unparseable-date"
    );
    expectDateOperatorError(
      () => shiftOperator.apply(fechaObservation("no-es-fecha", "fecha_completa"), context),
      "unparseable-date"
    );
  });

  it("surfaces the foundation's typed DateShiftError for a malformed state", () => {
    const malformedState = {
      seed: "x",
      contextOffsetDays: 0,
      overrides: "bad",
    } as unknown as DateShiftState;
    const context: OperatorContext = {
      strictMode: false,
      date: { role: "birth", shift: malformedState },
    };
    try {
      shiftOperator.apply(fechaObservation("05/01/2024", "fecha_completa"), context);
      throw new Error("expected apply to throw");
    } catch (error) {
      expect(error).toBeInstanceOf(DateShiftError);
      expect((error as DateShiftError).code).toBe("invalid-date-shift-state");
    }
  });
});

describe("date sub-context validation (operator-registry contract)", () => {
  it("accepts a valid date sub-context", () => {
    expect(() =>
      generalizeOperator.apply(
        fechaObservation("12/03/1954", "fecha_completa"),
        dateContext("birth")
      )
    ).not.toThrow();
  });

  it("rejects malformed date sub-contexts fail-closed", () => {
    const badContexts: unknown[] = [
      { strictMode: false, date: null },
      { strictMode: false, date: [] },
      { strictMode: false, date: { role: "visit" } },
      { strictMode: false, date: { role: 42 } },
      { strictMode: false, date: { role: "birth", shift: null } },
      { strictMode: false, date: { role: "birth", shift: [] } },
    ];
    for (const bad of badContexts) {
      try {
        generalizeOperator.apply(
          fechaObservation("12/03/1954", "fecha_completa"),
          bad as OperatorContext
        );
        throw new Error("expected apply to throw");
      } catch (error) {
        expect(error).toBeInstanceOf(OperatorError);
        expect((error as OperatorError).code).toBe("invalid-operator-context");
      }
    }
  });

  it("keeps the pre-T13 context working unchanged (date absent)", () => {
    expect(() =>
      generalizeOperator.apply(
        fechaObservation("diciembre de 2023", "fecha_parcial"),
        NORMAL_CONTEXT
      )
    ).not.toThrow();
  });
});

describe("date operators — determinism, purity and key stability", () => {
  it("returns equal outputs for repeated generalize calls and never mutates the observation", () => {
    const observation = fechaObservation("12/03/1954", "fecha_completa");
    const first = generalizeOperator.apply(observation, NORMAL_CONTEXT);
    const second = generalizeOperator.apply(observation, NORMAL_CONTEXT);
    expect(first).toBe(second);
    expect(observation.text).toBe("12/03/1954");
  });

  it("returns equal outputs for repeated shift calls and never mutates the observation", () => {
    const context = dateContext("admission", createDateShiftState("wu-b-determinism"));
    const observation = fechaObservation("05/01/2024", "fecha_completa");
    const first = shiftOperator.apply(observation, context);
    const second = shiftOperator.apply(observation, context);
    expect(first).toBe(second);
    expect(observation.text).toBe("05/01/2024");
  });

  it("exposes the frozen stable operator keys", () => {
    expect(new DateGeneralizeOperator().key).toBe("v4.date-generalize");
    expect(new DateShiftOperator().key).toBe("v4.date-shift");
    expect(LEGACY_OPERATOR_KEYS.DATE_GENERALIZE).toBe("v4.date-generalize");
    expect(LEGACY_OPERATOR_KEYS.DATE_SHIFT).toBe("v4.date-shift");
  });
});
