import { describe, expect, it } from "vitest";

import { escapeCsvField, serializeStructuredSafeCsv, StructuredCsvError } from "./csv-writer";
import { parseCsv } from "./csv";

/**
 * HARDEN-01 WU-A3 deterministic oracles for the Safe Structured CSV writer:
 * escaping aligned with the accepted parser, row order + blanks preserved, and
 * fail-closed serialization.
 */
describe("serializeStructuredSafeCsv", () => {
  it("serializes headers and rows in order, preserving blanks as empty fields", () => {
    const csv = serializeStructuredSafeCsv({
      kind: "structured-safe-dataset",
      headers: ["Fecha_Visita", "Diagnostico"],
      rows: [
        ["2023-01", "0"],
        ["", "1"],
      ],
    });
    expect(csv).toBe("Fecha_Visita,Diagnostico\n2023-01,0\n,1");
  });

  it("escapes commas, quotes and line breaks so the accepted parser round-trips", () => {
    const value = 'dato, "con" comillas\ny salto';
    const csv = serializeStructuredSafeCsv({
      kind: "structured-safe-dataset",
      headers: ["CampoLibre"],
      rows: [[value]],
    });
    expect(csv).toBe('CampoLibre\n"dato, ""con"" comillas\ny salto"');
    const parsed = parseCsv(csv);
    expect(parsed.headers).toEqual(["CampoLibre"]);
    expect(parsed.rows[0][0]).toBe(value);
  });

  it("never emits a trailing newline", () => {
    const csv = serializeStructuredSafeCsv({
      kind: "structured-safe-dataset",
      headers: ["a"],
      rows: [["1"]],
    });
    expect(csv.endsWith("\n")).toBe(false);
  });

  it("fails closed on a value that is not a Safe dataset", () => {
    expect(() => serializeStructuredSafeCsv({ kind: "other" })).toThrowError(StructuredCsvError);
    expect(() => serializeStructuredSafeCsv(null)).toThrowError(/valid structured Safe dataset/);
  });

  it("exposes field escaping consistent with the parser vocabulary", () => {
    expect(escapeCsvField("plain")).toBe("plain");
    expect(escapeCsvField('a"b')).toBe('"a""b"');
    expect(escapeCsvField("a,b")).toBe('"a,b"');
  });
});
