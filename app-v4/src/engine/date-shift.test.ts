import { describe, expect, it } from "vitest";

import {
  DATE_SHIFT_MAX_OFFSET_DAYS,
  DateShiftError,
  createDateShiftState,
  deriveStableOffset,
  resolveDateShiftOffset,
  shiftDateString,
  withDateShiftOverride,
  type DateShiftState,
} from "./date-shift";

/**
 * Contract oracles for the V4 consistent date-shift foundation (Work Order
 * T13 #17, WU-A; SPEC_V4_PRIVACY_ENGINE.md §7/§9; CURRENT_DECISIONS.md
 * D-009/D-010).
 *
 * All fixtures are synthetic calendar strings; no real content is used. All
 * date arithmetic in this file is UTC-based so the oracles are timezone
 * independent.
 */

const SEED = "lab-seed-2024";

/** Parses a `dd/mm/yyyy` fixture into a UTC epoch day (test-only helper). */
function toUtcDay(dateText: string): number {
  const [day, month, year] = dateText.split("/");
  return Date.UTC(Number(year), Number(month) - 1, Number(day));
}

/** Days between two `dd/mm/yyyy` fixtures (positive = later). */
function intervalDays(earlier: string, later: string): number {
  return (toUtcDay(later) - toUtcDay(earlier)) / 86_400_000;
}

/** Shifts and asserts a non-null result for the oracle. */
function requireShift(dateText: string, offsetDays: number): string {
  const shifted = shiftDateString(dateText, offsetDays);
  if (shifted === null) throw new Error(`expected "${dateText}" to shift by ${offsetDays} days`);
  return shifted;
}

describe("createDateShiftState — deterministic, bounded, frozen", () => {
  it("returns a deep-frozen state", () => {
    const state = createDateShiftState(SEED);
    expect(Object.isFrozen(state)).toBe(true);
    expect(Object.isFrozen(state.overrides)).toBe(true);
  });

  it("is deterministic for the same seed", () => {
    expect(createDateShiftState(SEED)).toEqual(createDateShiftState(SEED));
  });

  it("derives a bounded integer context offset", () => {
    const state = createDateShiftState(SEED);
    expect(Number.isInteger(state.contextOffsetDays)).toBe(true);
    expect(Math.abs(state.contextOffsetDays)).toBeLessThanOrEqual(DATE_SHIFT_MAX_OFFSET_DAYS);
  });

  it("is seed-sensitive (distinct seeds produce distinct context offsets)", () => {
    const offsets = ["alpha", "beta", "gamma", "delta"].map(
      (seed) => createDateShiftState(seed).contextOffsetDays
    );
    expect(new Set(offsets).size).toBeGreaterThan(1);
  });

  it("fails closed on an empty or non-string seed", () => {
    expect(() => createDateShiftState("")).toThrow(DateShiftError);
    expect(() => createDateShiftState("   ")).toThrow(DateShiftError);
    expect(() => createDateShiftState(42 as unknown as string)).toThrow(DateShiftError);
    try {
      createDateShiftState("");
      throw new Error("expected createDateShiftState to throw");
    } catch (error) {
      expect(error).toBeInstanceOf(DateShiftError);
      expect((error as DateShiftError).code).toBe("invalid-seed");
    }
  });
});

describe("resolveDateShiftOffset — one context-stable offset (resolved default)", () => {
  it("returns the same context offset for every source date with no overrides", () => {
    const state = createDateShiftState(SEED);
    const dates = ["15/01/2024", "01/02/2024", "18 de diciembre de 2023", "1954"];
    const offsets = dates.map((date) => resolveDateShiftOffset(state, date));
    expect(offsets).toEqual([
      state.contextOffsetDays,
      state.contextOffsetDays,
      state.contextOffsetDays,
      state.contextOffsetDays,
    ]);
  });

  it("fails closed on malformed state or source date", () => {
    const state = createDateShiftState(SEED);
    expect(() => resolveDateShiftOffset({} as unknown as DateShiftState, "12/03/2024")).toThrow(
      DateShiftError
    );
    expect(() => resolveDateShiftOffset(state, "" as string)).toThrow(DateShiftError);
    expect(() => resolveDateShiftOffset(state, 5 as unknown as string)).toThrow(DateShiftError);
  });
});

describe("withDateShiftOverride — explicit, pure, frozen, key-normalized", () => {
  it("returns a new frozen state and never mutates the input", () => {
    const state = createDateShiftState(SEED);
    const next = withDateShiftOverride(state, "12/03/2024", 7);
    expect(Object.isFrozen(next)).toBe(true);
    expect(Object.isFrozen(next.overrides)).toBe(true);
    expect(state.overrides).toHaveLength(0);
    expect(next.seed).toBe(SEED);
    expect(next.contextOffsetDays).toBe(state.contextOffsetDays);
  });

  it("round-trips an override and normalizes equivalent source-date formats", () => {
    const next = withDateShiftOverride(createDateShiftState(SEED), "12/03/2024", 7);
    expect(resolveDateShiftOffset(next, "12/03/2024")).toBe(7);
    expect(resolveDateShiftOffset(next, "12-03-2024")).toBe(7);
    expect(resolveDateShiftOffset(next, "12 de marzo de 2024")).toBe(7);
    // Non-overridden dates keep the single context offset.
    expect(resolveDateShiftOffset(next, "13/03/2024")).toBe(next.contextOffsetDays);
    expect(next.overrides).toEqual([["2024-03-12", 7]]);
  });

  it("replaces an existing override for the same normalized key", () => {
    const once = withDateShiftOverride(createDateShiftState(SEED), "12/03/2024", 7);
    const twice = withDateShiftOverride(once, "12-03-2024", 9);
    expect(twice.overrides).toEqual([["2024-03-12", 9]]);
    expect(resolveDateShiftOffset(twice, "12/03/2024")).toBe(9);
    // `once` is unchanged (pure update).
    expect(resolveDateShiftOffset(once, "12/03/2024")).toBe(7);
  });

  it("preserves insertion order across distinct overrides", () => {
    const first = withDateShiftOverride(createDateShiftState(SEED), "12/03/2024", 7);
    const second = withDateShiftOverride(first, "01/01/2024", -3);
    expect(second.overrides.map(([key]) => key)).toEqual(["2024-03-12", "2024-01-01"]);
  });

  it("fails closed on malformed arguments", () => {
    const state = createDateShiftState(SEED);
    expect(() => withDateShiftOverride(state, "12/03/2024", 1.5)).toThrow(DateShiftError);
    expect(() =>
      withDateShiftOverride(state, "12/03/2024", DATE_SHIFT_MAX_OFFSET_DAYS + 1)
    ).toThrow(DateShiftError);
    expect(() => withDateShiftOverride(state, "", 1)).toThrow(DateShiftError);
  });
});

describe("deriveStableOffset — opt-in per-date helper (NOT interval-preserving, not the default)", () => {
  it("is deterministic and bounded", () => {
    const first = deriveStableOffset(SEED, "12/03/2024");
    expect(deriveStableOffset(SEED, "12/03/2024")).toBe(first);
    expect(Number.isInteger(first)).toBe(true);
    expect(Math.abs(first)).toBeLessThanOrEqual(DATE_SHIFT_MAX_OFFSET_DAYS);
  });

  it("is seed-sensitive and source-date-sensitive, unlike the resolved default", () => {
    expect(deriveStableOffset("alpha", "12/03/2024")).not.toBe(
      deriveStableOffset("beta", "12/03/2024")
    );
    // Per-date offsets differ across dates, which is exactly why this helper
    // is NOT interval-preserving and is not the default path.
    expect(deriveStableOffset(SEED, "12/03/2024")).not.toBe(deriveStableOffset(SEED, "13/03/2024"));
  });

  it("fails closed on malformed arguments", () => {
    expect(() => deriveStableOffset("", "12/03/2024")).toThrow(DateShiftError);
    expect(() => deriveStableOffset(SEED, "")).toThrow(DateShiftError);
  });
});

describe("shiftDateString — same-format round trips", () => {
  it("preserves dd/mm/yyyy and dd-mm-yyyy separators", () => {
    expect(requireShift("12/03/2024", 30)).toBe("11/04/2024");
    expect(requireShift("12-03-2024", 30)).toBe("11-04-2024");
    expect(requireShift("12/03/2024", 0)).toBe("12/03/2024");
  });

  it("preserves day/month digit width", () => {
    expect(requireShift("1/2/2024", 1)).toBe("2/2/2024");
    expect(requireShift("01/02/2024", 1)).toBe("02/02/2024");
  });

  it("preserves 2-digit years (legacy rule) and 4-digit years", () => {
    expect(requireShift("12/03/24", 30)).toBe("11/04/24");
    expect(requireShift("12/03/54", 30)).toBe("11/04/54");
    expect(requireShift("12/03/2024", 30)).toBe("11/04/2024");
  });

  it("shifts a bare legacy 4-digit year year-only", () => {
    expect(requireShift("1954", 30)).toBe("1954");
    expect(requireShift("1954", 400)).toBe("1955");
  });

  it("round-trips textual dates preserving month spelling/case and connector", () => {
    expect(requireShift("18 de diciembre de 2023", 30)).toBe("17 de enero de 2024");
    expect(requireShift("18 de diciembre 2023", 30)).toBe("17 de enero 2024");
    expect(requireShift("18 de Diciembre de 2023", 30)).toBe("17 de Enero de 2024");
    expect(requireShift("18 de diciembre del 2023", 30)).toBe("17 de enero del 2024");
    expect(requireShift("18 de diciembre de 2023", -30)).toBe("18 de noviembre de 2023");
  });

  it("handles month-end, leap-year and negative offsets exactly", () => {
    expect(requireShift("31/01/2024", 30)).toBe("01/03/2024");
    expect(requireShift("29/02/2024", 1)).toBe("01/03/2024");
    expect(requireShift("28/02/2023", 1)).toBe("01/03/2023");
    expect(requireShift("29/02/2024", 365)).toBe("28/02/2025");
    expect(requireShift("01/01/2024", -1)).toBe("31/12/2023");
  });

  it("returns null for unsupported or impossible content", () => {
    const unparseable = [
      "",
      "no es fecha",
      "31/02/2024",
      "13/13/2024",
      "2024-03-12",
      "45 años",
      "18 de foo de 2023",
      "2024/03/12",
    ];
    for (const value of unparseable) {
      expect(shiftDateString(value, 30)).toBeNull();
    }
  });

  it("fails closed on malformed argument types", () => {
    expect(() => shiftDateString(123 as unknown as string, 1)).toThrow(DateShiftError);
    expect(() => shiftDateString("12/03/2024", 1.5)).toThrow(DateShiftError);
    expect(() => shiftDateString("12/03/2024", Number.NaN)).toThrow(DateShiftError);
    expect(() => shiftDateString("12/03/2024", Number.POSITIVE_INFINITY)).toThrow(DateShiftError);
    try {
      shiftDateString("12/03/2024", 1.5);
      throw new Error("expected shiftDateString to throw");
    } catch (error) {
      expect(error).toBeInstanceOf(DateShiftError);
      expect((error as DateShiftError).code).toBe("invalid-offset");
    }
  });
});

/**
 * ACCEPTANCE-CRITICAL ORACLE — longitudinal interval/order preservation.
 *
 * For a fixed seed, a chronological set of source dates shifted through
 * `resolveDateShiftOffset` (the RESOLVED DEFAULT path, i.e. no overrides)
 * must preserve pairwise order and exact day intervals: a source interval of
 * D days yields a shifted interval of exactly D days. This is the #17
 * "longitudinal interval preservation test for shift mode" / SPEC §9
 * "consistent date shifting" oracle.
 */
describe("resolveDateShiftOffset — acceptance-critical interval/order preservation", () => {
  const SOURCE_DATES: readonly string[] = [
    "15/01/2024",
    "01/02/2024",
    "15/02/2024",
    "14/03/2024",
    "01/06/2024",
  ];

  it("shifts every linked date by the SAME context offset", () => {
    const state = createDateShiftState(SEED);
    const offsets = SOURCE_DATES.map((date) => resolveDateShiftOffset(state, date));
    expect(offsets).toEqual(SOURCE_DATES.map(() => state.contextOffsetDays));
  });

  it("preserves pairwise order and exact day intervals", () => {
    const state = createDateShiftState(SEED);
    const shifted = SOURCE_DATES.map((date) =>
      requireShift(date, resolveDateShiftOffset(state, date))
    );

    // Order preserved (strictly chronological in, strictly chronological out).
    const shiftedDays = shifted.map((date) => toUtcDay(date));
    for (let index = 1; index < shiftedDays.length; index += 1) {
      expect(shiftedDays[index]).toBeGreaterThan(shiftedDays[index - 1]);
    }

    // Every source interval D days maps to a shifted interval of exactly D days.
    for (let index = 1; index < SOURCE_DATES.length; index += 1) {
      const sourceInterval = intervalDays(SOURCE_DATES[index - 1], SOURCE_DATES[index]);
      const shiftedInterval = (shiftedDays[index] - shiftedDays[index - 1]) / 86_400_000;
      expect(shiftedInterval).toBe(sourceInterval);
    }
  });

  it("lets one explicit override change only that date's offset (never silent)", () => {
    const state = createDateShiftState(SEED);
    const overridden = withDateShiftOverride(state, SOURCE_DATES[2], state.contextOffsetDays + 7);
    const shifted = SOURCE_DATES.map((date) =>
      requireShift(date, resolveDateShiftOffset(overridden, date))
    );
    const shiftedDays = shifted.map((date) => toUtcDay(date));

    // The deliberate override changes the two adjacent intervals by exactly 7
    // days (the caller's explicit choice), while the untouched earlier pair
    // still preserves its exact source interval.
    expect((shiftedDays[2] - shiftedDays[1]) / 86_400_000).toBe(
      intervalDays(SOURCE_DATES[1], SOURCE_DATES[2]) + 7
    );
    expect((shiftedDays[3] - shiftedDays[2]) / 86_400_000).toBe(
      intervalDays(SOURCE_DATES[2], SOURCE_DATES[3]) - 7
    );
    expect((shiftedDays[1] - shiftedDays[0]) / 86_400_000).toBe(
      intervalDays(SOURCE_DATES[0], SOURCE_DATES[1])
    );
  });
});
