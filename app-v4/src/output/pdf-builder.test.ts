/**
 * Adversarial oracle for the REC-05 WU-A Safe PDF builder (D-024).
 *
 * The read-back oracle is the legacy pdf.js build (same `pdfjs-dist`
 * 3.11.174 already used by the V4 input adapter). It runs in the documented
 * fake-worker seam. Limits, stated honestly:
 *   - it recovers text-showing operators; it does not reproduce the
 *     builder's own wrapping. The content oracle therefore compares after
 *     collapsing all whitespace, which detects dropped/truncated/corrupted
 *     content but not purely cosmetic re-wrapping.
 *   - a word longer than the text column is split by the builder, so the
 *     long-token case compares with all whitespace removed.
 *   - pdf.js itself normalizes spaces (it synthesizes items from glyph gaps
 *     and trims item-boundary spaces), so it CANNOT falsify space
 *     preservation. The whitespace witnesses below therefore read the exact
 *     drawn strings back from the PDF content streams (`<hex> Tj`, inflated
 *     and decoded) — the artifact-level truth of what the builder rendered.
 *
 * Synthetic/no-PHI fixtures only.
 */
import { inflateSync } from "node:zlib";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { PdfRepresentationError, SAFE_PDF_FILENAME, buildSafePdfBytes } from "./pdf-builder";

interface PdfTextItem {
  str: string;
}
interface PdfPage {
  getTextContent(): Promise<{ items: PdfTextItem[] }>;
}
interface PdfDocument {
  numPages: number;
  getPage(index: number): Promise<PdfPage>;
}
interface PdfJsApi {
  getDocument(params: { data: Uint8Array; isEvalSupported: boolean }): {
    promise: Promise<PdfDocument>;
  };
}

let pdfjs: PdfJsApi;

beforeAll(async () => {
  const [lib, worker] = await Promise.all([
    import("pdfjs-dist/legacy/build/pdf.js"),
    import("pdfjs-dist/legacy/build/pdf.worker.js"),
  ]);
  (globalThis as { pdfjsWorker?: unknown }).pdfjsWorker = worker;
  pdfjs = lib as unknown as PdfJsApi;
});

afterAll(() => {
  delete (globalThis as { pdfjsWorker?: unknown }).pdfjsWorker;
});

interface Extracted {
  numPages: number;
  text: string;
}

async function extractPdfText(bytes: Uint8Array): Promise<Extracted> {
  const doc = await pdfjs.getDocument({ data: bytes, isEvalSupported: false }).promise;
  const pages: string[] = [];
  for (let index = 1; index <= doc.numPages; index++) {
    const page = await doc.getPage(index);
    const content = await page.getTextContent();
    pages.push(content.items.map((item) => item.str).join(" "));
  }
  return { numPages: doc.numPages, text: pages.join(" ") };
}

const collapse = (value: string): string => value.replace(/\s+/g, " ").trim();
const despace = (value: string): string => value.replace(/\s+/g, "");

/**
 * Read back the EXACT strings the builder drew: inflate every content stream
 * and decode every `<hex> Tj` text-showing operator (pdf-lib writes text as
 * hex strings; WinAnsi/ASCII fixtures decode 1:1). Unlike the pdf.js joined
 * extraction, this cannot be fooled by pdf.js's own space normalization.
 */
function drawnSegments(bytes: Uint8Array): string[] {
  const raw = Buffer.from(bytes).toString("latin1");
  const segments: string[] = [];
  const streamRe = /stream\r?\n([\s\S]*?)endstream/g;
  let stream: RegExpExecArray | null;
  while ((stream = streamRe.exec(raw)) !== null) {
    let content: string;
    try {
      content = inflateSync(Buffer.from(stream[1], "latin1")).toString("latin1");
    } catch {
      continue;
    }
    const tjRe = /<([0-9A-Fa-f\s]*)>\s*Tj/g;
    let tj: RegExpExecArray | null;
    while ((tj = tjRe.exec(content)) !== null) {
      const hex = tj[1].replace(/\s/g, "");
      let text = "";
      for (let i = 0; i < hex.length; i += 2) {
        text += String.fromCharCode(parseInt(hex.slice(i, i + 2), 16));
      }
      segments.push(text);
    }
  }
  return segments;
}

describe("filename constant", () => {
  it("is the D-024 Safe PDF filename", () => {
    expect(SAFE_PDF_FILENAME).toBe("texto-preparado.pdf");
  });
});

describe("representable Spanish text reads back without corruption", () => {
  it("preserves a realistic clinical note (accents, eñe, em dash)", async () => {
    const text =
      "Informe clínico sintético\n" +
      "Paciente: Carmen Sánchez, niño de 7 años.\n" +
      "\n" +
      "Motivo: dolor abdominal — leve.\n" +
      "Teléfono de contacto eliminado.";
    const { text: extracted } = await extractPdfText(await buildSafePdfBytes(text));
    expect(collapse(extracted)).toBe(collapse(text));
    // Exact glyphs, not mojibake substitutions.
    expect(extracted).toContain("Sánchez");
    expect(extracted).toContain("niño");
    expect(extracted).toContain("—");
    expect(extracted).not.toContain("SÃ");
  });

  it("covers the documented supported frontier exactly", async () => {
    const supported = "áéíóúüñÑ¿¡—–€°%“”…•§©·²³ªºÀÇ";
    const { text: extracted } = await extractPdfText(
      await buildSafePdfBytes(`Caracteres admitidos: ${supported}`)
    );
    for (const char of supported) {
      expect(extracted, `missing supported character ${JSON.stringify(char)}`).toContain(char);
    }
  });
});

// ---------------------------------------------------------------------------
// Whitespace is content (D-024: the PDF must not narrow the Safe string).
// These witnesses read the exact drawn strings back from the content streams.
// Red pre-fix (verified against the uncorrected builder): the leading-space
// and all-space fixtures drew `["Encabezado con sangría"]` and `[]` because
// `split(" ")` + the `current === ""` sentinel dropped empty tokens.
// The internal/trailing fixtures were already preserved pre-fix; they are
// boundary preservation witnesses against regression.
// ---------------------------------------------------------------------------
describe("whitespace preservation — leading, repeated, trailing spaces survive", () => {
  const preservationCases: ReadonlyArray<{ label: string; line: string }> = [
    { label: "leading spaces", line: "   Encabezado con sangría" },
    { label: "consecutive internal spaces", line: "Campo:    valor" },
    { label: "trailing space", line: "Línea final " },
    { label: "a line made only of spaces", line: "   " },
  ];

  for (const { label, line } of preservationCases) {
    it(`draws ${label} exactly as sent`, async () => {
      const bytes = await buildSafePdfBytes(line);
      expect(drawnSegments(bytes)).toEqual([line]);
    });
  }

  it("keeps the wrap-point normalization to exactly one space of a space run", async () => {
    // 45+45 glyph column overflow forces one wrap inside the 3-space run:
    // one space becomes the line break, the other two stay visible content
    // (rendered as the leading spaces of the continuation segment).
    const line = "x".repeat(45) + "   " + "y".repeat(45);
    const bytes = await buildSafePdfBytes(line);
    expect(drawnSegments(bytes)).toEqual(["x".repeat(45), "  " + "y".repeat(45)]);
  });

  it("never truncates a space run wider than the text column", async () => {
    const spaces = " ".repeat(600);
    const bytes = await buildSafePdfBytes(spaces);
    const drawn = drawnSegments(bytes);
    expect(drawn.join("")).toBe(spaces);
  });
});

describe("unsupported characters refuse with zero artifact", () => {
  const unsupported: ReadonlyArray<{ label: string; char: string; codePoint: number }> = [
    { label: "griega alfa", char: "α", codePoint: 0x3b1 },
    { label: "griega omega", char: "Ω", codePoint: 0x3a9 },
    { label: "CJK", char: "中", codePoint: 0x4e2d },
    { label: "emoji", char: "😀", codePoint: 0x1f600 },
    { label: "tabulador", char: "\t", codePoint: 0x9 },
    { label: "NUL", char: "\u0000", codePoint: 0x0 },
  ];

  for (const { label, char, codePoint } of unsupported) {
    it(`refuses ${label} (U+${codePoint.toString(16).toUpperCase()})`, async () => {
      const build = buildSafePdfBytes(`texto representable ${char} texto`);
      await expect(build).rejects.toBeInstanceOf(PdfRepresentationError);
      await expect(build).rejects.toMatchObject({
        code: "UNSUPPORTED_CHARACTER",
        codePoint,
      });
    });
  }

  it("never substitutes or drops the unsupported character", async () => {
    // If the builder ever produced bytes for α, this would resolve instead of
    // rejecting, and the assertion below would fail.
    let produced: Uint8Array | undefined;
    try {
      produced = await buildSafePdfBytes("alfa: α");
    } catch (error) {
      expect(error).toBeInstanceOf(PdfRepresentationError);
    }
    expect(produced).toBeUndefined();
  });
});

describe("long content paginates without truncation", () => {
  it("spans multiple pages and keeps the final line", async () => {
    const lines = Array.from(
      { length: 220 },
      (_, index) =>
        `Línea ${index + 1}: observación clínica sintética con acentos, eñe y guiones — largos.`
    );
    const text = lines.join("\n");
    const { numPages, text: extracted } = await extractPdfText(await buildSafePdfBytes(text));
    expect(numPages).toBeGreaterThan(1);
    // Prove the tail of the document is present, not truncated.
    expect(extracted).toContain("Línea 220");
    expect(collapse(extracted)).toBe(collapse(text));
  });

  it("does not drop an unbreakable token longer than the text column", async () => {
    const token = "X".repeat(1500);
    const text = `inicio ${token} fin`;
    const { text: extracted } = await extractPdfText(await buildSafePdfBytes(text));
    expect(despace(extracted)).toBe(despace(text));
  });
});

describe("leak-proofing: content can only come from the Safe string", () => {
  const MAPPING = "PAC_ORIGINAL-2024/089756";
  const NOTE = "nota interna del revisor: no compartir";

  it("keeps planted Confidential-only tokens out of the PDF when absent from the Safe input", async () => {
    const safeText = "Informe preparado para uso externo. Sin correspondencias.";
    const { text: extracted } = await extractPdfText(await buildSafePdfBytes(safeText));
    for (const token of [MAPPING, NOTE]) {
      expect(extracted).not.toContain(token);
    }
  });

  it("carries a token when — and only when — it is part of the Safe string", async () => {
    const safeWithMapping = `Paciente preparado. Correspondencia retirada. ${MAPPING}`;
    const { text: extracted } = await extractPdfText(await buildSafePdfBytes(safeWithMapping));
    expect(extracted).toContain(MAPPING);
    expect(extracted).not.toContain(NOTE);
  });
});

describe("source boundary — no second content channel", () => {
  it("exposes exactly one declared content parameter", () => {
    expect(buildSafePdfBytes.length).toBe(1);
  });
});
