import { describe, expect, it } from "vitest";

import { CsvParseError, detectCsvDelimiter, parseCsv } from "./csv";
import { isBlankCell } from "./grid";

/**
 * Synthetic quoted-multiline CSV fixture (T18 #22 deterministic verification:
 * "CSV multiline fixture"). One clinical remark field spans two lines inside
 * double quotes; another field contains an escaped double quote and the
 * record separator characters inside quotes. No real PHI: all values are
 * invented synthetic tokens.
 */
const MULTILINE_CSV = [
  "Paciente;NHC;Observaciones;Edad",
  '"Pérez García, Ana";00123;"Informe preliminar:\nrevisar resultado de prueba";47',
  '"García, Luis";00456;"Dijo: ""volveré"" y se fue";33',
  'Sanz;00789;"";0',
].join("\n");

/**
 * Deliberately naive parser: the legacy line-splitting approach (SPEC §8
 * forbids it as production authority). Used ONLY by the falsification oracle
 * to prove the multiline fixture actually discriminates: the naive parser
 * MUST fail the fixture.
 */
function naiveLineSplitParse(text: string, delimiter: string): string[][] {
  return text
    .split(/\r?\n/)
    .filter((line) => line.trim() !== "")
    .map((line) => line.split(delimiter));
}

describe("detectCsvDelimiter", () => {
  it("prefers the semicolon when it is the only separator", () => {
    expect(detectCsvDelimiter("a;b\nc;d")).toBe(";");
  });

  it("prefers the comma over semicolon when more frequent", () => {
    expect(detectCsvDelimiter("a,b;c\nd,e;f")).toBe(",");
  });

  it("detects tab-delimited input", () => {
    expect(detectCsvDelimiter("a\tb\nc\td")).toBe("\t");
  });

  it("ignores separators inside quoted fields (including multiline)", () => {
    // The comma inside the quoted multiline field must not win over the
    // semicolons that actually separate fields.
    expect(detectCsvDelimiter(MULTILINE_CSV)).toBe(";");
  });

  it("returns comma for input without any candidate", () => {
    expect(detectCsvDelimiter("abc\ndef")).toBe(",");
  });
});

describe("parseCsv", () => {
  it("parses a quoted multiline field as ONE field of ONE record", () => {
    const grid = parseCsv(MULTILINE_CSV);
    expect(grid.headers).toEqual(["Paciente", "NHC", "Observaciones", "Edad"]);
    expect(grid.rows).toHaveLength(3);

    const first = grid.rows[0];
    expect(first[0]).toBe("Pérez García, Ana");
    expect(first[2]).toBe("Informe preliminar:\nrevisar resultado de prueba");
    expect(first[3]).toBe("47");
  });

  it("unescapes doubled quotes and keeps separator characters inside quotes", () => {
    const grid = parseCsv(MULTILINE_CSV);
    expect(grid.rows[1][2]).toBe('Dijo: "volveré" y se fue');
  });

  it("maps empty fields (including quoted empty) to null absence", () => {
    const grid = parseCsv(MULTILINE_CSV);
    // `""` quoted-empty and trailing empty fields are absence, not "" strings.
    expect(grid.rows[2][0]).toBe("Sanz");
    expect(isBlankCell(grid.rows[2][2])).toBe(true);
    expect(grid.rows[2][2]).toBeNull();
  });

  it("pads ragged short records with null absence", () => {
    const grid = parseCsv("A,B,C\nuno,dos");
    expect(grid.rows[0]).toEqual(["uno", "dos", null]);
  });

  it("parses CRLF and LF record ends identically", () => {
    expect(parseCsv("A,B\r\n1,2\r\n3,4")).toEqual(parseCsv("A,B\n1,2\n3,4"));
  });

  it("supports an explicit delimiter override", () => {
    const grid = parseCsv("A;B\nx,y;z", { delimiter: ";" });
    expect(grid.headers).toEqual(["A", "B"]);
    expect(grid.rows[0]).toEqual(["x,y", "z"]);
  });

  it("preserves a leading/trailing space inside fields verbatim (no silent trim)", () => {
    const grid = parseCsv("A\n valor ");
    expect(grid.rows[0][0]).toBe(" valor ");
  });

  it("skips fully blank lines but keeps whitespace-only quoted content", () => {
    const grid = parseCsv('A,B\n\n" ",2\n');
    expect(grid.rows).toHaveLength(1);
    expect(grid.rows[0][0]).toBe(" ");
  });

  it("fails explicitly on empty input", () => {
    try {
      parseCsv("");
      expect.unreachable("parseCsv must fail on empty input");
    } catch (error) {
      expect(error).toBeInstanceOf(CsvParseError);
      expect((error as CsvParseError).code).toBe("csv-empty");
    }
  });

  it("fails explicitly when EOF is reached inside a quoted field", () => {
    try {
      parseCsv('A,B\n"nunca cerrado,2');
      expect.unreachable("parseCsv must fail on unterminated quote");
    } catch (error) {
      expect(error).toBeInstanceOf(CsvParseError);
      expect((error as CsvParseError).code).toBe("csv-unterminated-quote");
    }
  });

  it("FALSIFICATION: a naive line-splitting parser fails the multiline fixture", () => {
    // The oracle can disagree with the implementation: the legacy-style
    // line-splitting parse of the SAME fixture produces a different record
    // count and corrupts the multiline field, while the consolidated parser
    // is correct. If this fixture stopped discriminating (e.g. the field no
    // longer spans lines), the first assertion would fail and this oracle
    // would be vacuous.
    const naive = naiveLineSplitParse(MULTILINE_CSV, ";");
    expect(naive).toHaveLength(5); // 5 split "lines" ≠ 4 real records
    expect(naive[1]).toEqual(['"Pérez García, Ana"', "00123", '"Informe preliminar:']); // multiline field chopped mid-value, closing quote leaked

    const consolidated = parseCsv(MULTILINE_CSV);
    expect(consolidated.rows).toHaveLength(3);
    expect(consolidated.rows[0][2]).toContain("\n");
  });
});
