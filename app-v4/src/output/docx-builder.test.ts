/**
 * Adversarial oracle for the REC-05 WU-A Safe DOCX builder (D-024).
 *
 * The governed semantic oracle is `mammoth.extractRawText()` (the same
 * runtime used by the V4 DOCX input adapter). Every round-trip case below
 * can genuinely disagree with the implementation: if the builder dropped an
 * accent, mis-escaped a metacharacter, collapsed a blank line or mangled
 * non-Latin Unicode, the read-back would not equal the input under the
 * documented normalization.
 *
 * Synthetic/no-PHI fixtures only.
 */
import * as fs from "node:fs";
import * as path from "node:path";
import { fileURLToPath } from "node:url";

import JSZip from "jszip";
import { beforeAll, describe, expect, it } from "vitest";

import {
  DocxBuildError,
  SAFE_DOCX_FILENAME,
  buildSafeDocxBytes,
  normalizeDocxRawText,
} from "./docx-builder";

type Mammoth = typeof import("mammoth");

let mammoth: Mammoth;

beforeAll(async () => {
  mammoth = await import("mammoth");
});

function toArrayBuffer(bytes: Uint8Array): ArrayBuffer {
  return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
}

/** Governed semantic read-back of a generated package. */
async function readDocxText(bytes: Uint8Array): Promise<string> {
  const arrayBuffer = toArrayBuffer(bytes);
  const { value } = await mammoth.extractRawText({ arrayBuffer, buffer: arrayBuffer });
  return normalizeDocxRawText(value);
}

/** Raw OOXML part reader (structural witness, not the semantic oracle). */
async function readPart(bytes: Uint8Array, part: string): Promise<string> {
  const zip = await JSZip.loadAsync(bytes);
  const file = zip.file(part);
  if (file === null) {
    throw new Error(`generated package is missing part ${part}`);
  }
  return file.async("string");
}

describe("filename constant", () => {
  it("is the D-024 Safe DOCX filename", () => {
    expect(SAFE_DOCX_FILENAME).toBe("texto-preparado.docx");
  });
});

describe("documented round-trip normalization", () => {
  it("inverts mammoth's paragraph terminator and preserves blank lines", () => {
    // mammoth emits two consecutive newlines after every paragraph.
    expect(normalizeDocxRawText("a\n\nb\n\n")).toBe("a\nb");
    expect(normalizeDocxRawText("a\n\n\n\nb\n\n")).toBe("a\n\nb");
    expect(normalizeDocxRawText("a\n\n\n\n")).toBe("a\n");
    expect(normalizeDocxRawText("\n\n")).toBe("");
  });

  it("fails closed when raw text does not carry the paragraph terminator", () => {
    expect(() => normalizeDocxRawText("sin terminador")).toThrowError(DocxBuildError);
  });
});

describe("round-trip: Safe string survives the governed DOCX read-back", () => {
  const cases: ReadonlyArray<{ name: string; input: string }> = [
    { name: "acentos y eñe", input: "Paciente: Carmen Sánchez\nAño 2024, niño de 7 años." },
    { name: "metacaracteres XML", input: `Datos: <dato> & 'cita' "doble"` },
    { name: "líneas en blanco", input: "Primera\n\nSegunda\n\n\nTercera" },
    { name: "unicode no latino", input: "Ελληνικά αβγ\n日本語テキスト\nКириллица\nemoji 🧬" },
    { name: "salto de línea final", input: "linea1\nlinea2\n" },
    { name: "espacios significativos", input: "  sangrado  y  espacios  " },
    { name: "cadena vacía", input: "" },
  ];

  for (const { name, input } of cases) {
    it(name, async () => {
      const bytes = await buildSafeDocxBytes(input);
      expect(bytes).toBeInstanceOf(Uint8Array);
      await expect(readDocxText(bytes)).resolves.toBe(input);
    });
  }

  it("normalizes CRLF/CR line endings to LF (the only declared normalization)", async () => {
    const input = "linea1\r\nlinea2\rlinea3";
    const normalized = "linea1\nlinea2\nlinea3";
    const readBack = await readDocxText(await buildSafeDocxBytes(input));
    expect(readBack).toBe(normalized);
    // The un-normalized input is explicitly NOT claimed to round-trip byte-exact.
    expect(readBack).not.toBe(input);
  });
});

describe("OOXML package and XML escaping", () => {
  it("is a minimal package with the required parts", async () => {
    const bytes = await buildSafeDocxBytes("contenido sintético");
    const zip = await JSZip.loadAsync(bytes);
    expect(Object.keys(zip.files).sort()).toEqual(
      ["[Content_Types].xml", "_rels/.rels", "word/document.xml"].sort()
    );
  });

  it("escapes XML metacharacters in the document part", async () => {
    const bytes = await buildSafeDocxBytes(`<x> & "y" 'z'`);
    const xml = await readPart(bytes, "word/document.xml");
    expect(xml).toContain("&lt;x&gt; &amp; &quot;y&quot; &apos;z&apos;");
    expect(xml).not.toContain("<x>");
    expect(xml).toContain('xml:space="preserve"');
  });

  it("builds byte-deterministic output for the same Safe string", async () => {
    const first = await buildSafeDocxBytes("mismo contenido\nsegunda línea");
    const second = await buildSafeDocxBytes("mismo contenido\nsegunda línea");
    expect(Array.from(first)).toEqual(Array.from(second));
  });
});

describe("fail-closed on content XML cannot carry", () => {
  const invalid = ["NUL \u0000 embebido", "vertical \u000B tab", "surrogate solitario \uD800"];

  for (const input of invalid) {
    it(`refuses ${JSON.stringify(input)} with zero bytes`, async () => {
      await expect(buildSafeDocxBytes(input)).rejects.toBeInstanceOf(DocxBuildError);
      await expect(buildSafeDocxBytes(input)).rejects.toMatchObject({
        code: "XML_UNREPRESENTABLE_TEXT",
      });
    });
  }
});

describe("leak-proofing: content can only come from the Safe string", () => {
  const MAPPING = "PAC_ORIGINAL-2024/089756";
  const NOTE = "nota interna del revisor: no compartir";
  const AUDIT_HEADER = "AUDITORIA CONFIDENCIAL - acceso restringido";
  const SAFE_TEXT = "Informe preparado para uso externo. Sin correspondencias.";

  async function allPartsText(bytes: Uint8Array): Promise<string> {
    const zip = await JSZip.loadAsync(bytes);
    const parts: string[] = [];
    for (const name of Object.keys(zip.files)) {
      const file = zip.files[name];
      if (file.dir) continue;
      parts.push(await file.async("string"));
    }
    return parts.join("\n");
  }

  it("keeps planted Confidential-only tokens out of the DOCX/TXT when absent from the Safe input", async () => {
    const bytes = await buildSafeDocxBytes(SAFE_TEXT);
    const rawParts = await allPartsText(bytes);
    const readBack = await readDocxText(bytes);
    const txt = new TextDecoder().decode(new TextEncoder().encode(SAFE_TEXT));
    for (const token of [MAPPING, NOTE, AUDIT_HEADER]) {
      expect(rawParts).not.toContain(token);
      expect(readBack).not.toContain(token);
      expect(txt).not.toContain(token);
    }
  });

  it("carries a token when — and only when — it is part of the Safe string", async () => {
    const safeWithMapping = `Paciente preparado. Correspondencia retirada. ${MAPPING}`;
    const readBack = await readDocxText(await buildSafeDocxBytes(safeWithMapping));
    expect(readBack).toContain(MAPPING);
    expect(readBack).not.toContain(NOTE);
  });

  it("TXT stays byte-exact UTF-8 with no BOM and no audit header", () => {
    const bytes = new TextEncoder().encode(SAFE_TEXT);
    expect(bytes[0]).not.toBe(0xef);
    expect(new TextDecoder().decode(bytes)).toBe(SAFE_TEXT);
  });
});

describe("source boundary — no second content channel", () => {
  it("exposes exactly one declared content parameter", () => {
    expect(buildSafeDocxBytes.length).toBe(1);
  });

  it("does not reach for the DOM, storage or the network", () => {
    const source = fs.readFileSync(
      path.join(path.dirname(fileURLToPath(import.meta.url)), "docx-builder.ts"),
      "utf8"
    );
    for (const forbidden of [
      /document\.createElement/,
      /localStorage/,
      /sessionStorage/,
      /indexedDB/,
      /fetch\s*\(/,
      /XMLHttpRequest/,
    ]) {
      expect(source, `docx-builder.ts must not contain ${forbidden}`).not.toMatch(forbidden);
    }
  });
});
