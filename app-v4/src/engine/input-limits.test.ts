import { describe, expect, it } from "vitest";

import {
  isTextWithinSupportedSize,
  MAX_SUPPORTED_TEXT_LENGTH,
  OVERSIZE_INPUT_CODE,
  oversizeInputFor,
  oversizeInputForLength,
} from "./input-limits";

/**
 * Contract oracles for the supported input size authority (Work Order T15
 * #19, WU-A; SPEC_V4_PRIVACY_ENGINE §11; CURRENT_DECISIONS D-009; debt
 * FUNC-004).
 *
 * Every oracle below is falsifiable: a naive implementation that echoes the
 * input, mis-measures the boundary or silently truncates must make at least
 * one of them fail. The limit is measured in UTF-16 code units
 * (`String.length`), never bytes. All fixtures are synthetic; no real content
 * is used anywhere.
 */

const MAX = MAX_SUPPORTED_TEXT_LENGTH;

describe("supported input size — exact boundary", () => {
  it("accepts text exactly at the supported boundary", () => {
    const boundary = "x".repeat(MAX);
    expect(oversizeInputFor(boundary)).toBeNull();
    expect(isTextWithinSupportedSize(boundary)).toBe(true);
  });

  it("refuses one code unit over the boundary with the full typed facts", () => {
    const facts = oversizeInputFor("x".repeat(MAX + 1));
    expect(facts).not.toBeNull();
    expect(facts!.code).toBe(OVERSIZE_INPUT_CODE);
    expect(facts!.measuredLength).toBe(MAX + 1);
    expect(facts!.supportedLength).toBe(MAX);
    expect(facts!.excessLength).toBe(1);
    expect(isTextWithinSupportedSize("x".repeat(MAX + 1))).toBe(false);
  });
});

describe("supported input size — total, fail-closed measurement", () => {
  it("accepts the empty string as within size", () => {
    expect(oversizeInputFor("")).toBeNull();
    expect(isTextWithinSupportedSize("")).toBe(true);
  });

  it("reports the exact excess for a large overshoot", () => {
    const facts = oversizeInputFor("x".repeat(MAX * 3));
    expect(facts).not.toBeNull();
    expect(facts!.measuredLength).toBe(MAX * 3);
    expect(facts!.supportedLength).toBe(MAX);
    expect(facts!.excessLength).toBe(MAX * 2);
  });
});

describe("supported input size — actionable, deterministic message", () => {
  it("names both numbers, states the action and is byte-identical across calls", () => {
    const measured = MAX + 1;
    const first = oversizeInputFor("x".repeat(measured))!;
    const second = oversizeInputFor("x".repeat(measured))!;
    expect(first.message).toContain(String(measured));
    expect(first.message).toContain(String(MAX));
    expect(first.message).toContain("Split");
    expect(first.message).toBe(second.message);
  });
});

describe("supported input size — payload safety with teeth", () => {
  it("never echoes input content into the typed failure", () => {
    // Realistic synthetic PHI-bearing prefix padded to just over the limit; a
    // naive implementation that echoes the input into the failure would leak
    // every token below.
    const prefix = "Paciente: sintetico. Telefono: 600000000. ";
    const payload = prefix + "x".repeat(MAX + 5 - prefix.length);
    expect(payload.length).toBe(MAX + 5);

    const serialized = JSON.stringify(oversizeInputFor(payload));
    expect(serialized).not.toContain("Paciente");
    expect(serialized).not.toContain("sintetico");
    expect(serialized).not.toContain("600000000");
  });
});

describe("supported input size — length-based authority form (STRUCT-012)", () => {
  it("agrees exactly with the string form at and around the boundary", () => {
    expect(oversizeInputForLength(MAX)).toBeNull();
    expect(oversizeInputForLength(0)).toBeNull();
    const facts = oversizeInputForLength(MAX + 1)!;
    expect(facts.code).toBe(OVERSIZE_INPUT_CODE);
    expect(facts.measuredLength).toBe(MAX + 1);
    expect(facts.supportedLength).toBe(MAX);
    expect(facts.excessLength).toBe(1);
    // Exact parity with the string form for the same measured length:
    const viaString = oversizeInputFor("x".repeat(MAX + 1))!;
    expect(facts).toEqual(viaString);
    expect(facts.message).toBe(viaString.message);
  });

  it("reports exact facts for a large measured overshoot without holding the text", () => {
    const measured = MAX * 3;
    const facts = oversizeInputForLength(measured)!;
    expect(facts.measuredLength).toBe(measured);
    expect(facts.excessLength).toBe(MAX * 2);
    expect(facts).toEqual(oversizeInputFor("x".repeat(measured))!);
  });
});
