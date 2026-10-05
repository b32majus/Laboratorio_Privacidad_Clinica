/**
 * Safe PDF builder (REC-05 WU-A, D-024).
 *
 * Builds a paginated plain-text PDF from the canonical Safe string using the
 * exact direct dependency `pdf-lib@1.17.1` and its bundled standard font
 * (Helvetica / WinAnsi). It does NOT reactivate the retired
 * `lib/jspdf.umd.min.js` and makes no source-PDF layout/redaction claim.
 *
 * Representability frontier (tested)
 * ----------------------------------
 * WinAnsi (CP1252) covers Latin-1 letters, the Spanish punctuation set
 * (¿ ¡), accents/eñe, the smart-quote/dash/bullet/currency/symbol block used
 * here. It does NOT cover Greek (α, Ω), CJK, emoji, the tab character or NUL.
 * Any code point the encoder cannot represent aborts the build with a
 * {@link PdfRepresentationError} and produces ZERO bytes: the PDF is never
 * silently substituted, dropped or mojibake'd as a visible deterministic
 * PDF-only failure.
 *
 * Privacy: memory-only local generation, no logging of content, no network,
 * no persistence.
 */
import { PDFDocument, PageSizes, StandardFonts, rgb, type PDFFont } from "pdf-lib";

/** D-024 Safe PDF download filename. */
export const SAFE_PDF_FILENAME = "texto-preparado.pdf";

/** Typed refusal for a Safe string the bundled standard font cannot encode. */
export class PdfRepresentationError extends Error {
  readonly code = "UNSUPPORTED_CHARACTER" as const;
  /** Code point that the encoder rejected (no character content is echoed). */
  readonly codePoint: number;
  constructor(codePoint: number) {
    super(
      `El PDF no puede representar el carácter U+${codePoint
        .toString(16)
        .toUpperCase()
        .padStart(4, "0")}.`
    );
    this.name = "PdfRepresentationError";
    this.codePoint = codePoint;
  }
}

const PAGE_SIZE = PageSizes.A4;
const MARGIN = 50;
const FONT_SIZE = 11;
const LINE_HEIGHT = 16;

/** Throw {@link PdfRepresentationError} on the first unencodable code point. */
function assertRepresentable(font: PDFFont, line: string): void {
  try {
    font.encodeText(line);
    return;
  } catch {
    // Locate the exact offending code point for a deterministic diagnostic.
  }
  for (const char of line) {
    try {
      font.encodeText(char);
    } catch {
      throw new PdfRepresentationError(char.codePointAt(0) ?? 0);
    }
  }
  // encodeText rejected the line but no single code point did: treat the
  // whole line as unrepresentable rather than emitting anything.
  throw new PdfRepresentationError(0);
}

/**
 * Wrap one logical line to the text column width. Words are kept whole while
 * they fit; a single word wider than the column is split by code point so no
 * content is ever truncated or clipped off the page.
 */
function wrapLine(font: PDFFont, line: string): string[] {
  if (line === "") {
    return [""];
  }
  const maxWidth = PAGE_SIZE[0] - MARGIN * 2;
  const segments: string[] = [];
  let current = "";
  for (const word of line.split(" ")) {
    const candidate = current === "" ? word : `${current} ${word}`;
    if (font.widthOfTextAtSize(candidate, FONT_SIZE) <= maxWidth) {
      current = candidate;
      continue;
    }
    if (current !== "") {
      segments.push(current);
    }
    let chunk = "";
    for (const char of word) {
      if (font.widthOfTextAtSize(chunk + char, FONT_SIZE) <= maxWidth) {
        chunk += char;
      } else {
        segments.push(chunk);
        chunk = char;
      }
    }
    current = chunk;
  }
  segments.push(current);
  return segments;
}

/**
 * Build the Safe PDF artifact bytes from the canonical Safe string.
 * Resolves to a paginated PDF; rejects with {@link PdfRepresentationError}
 * (zero bytes) when any character is not representable.
 */
export async function buildSafePdfBytes(safeText: string): Promise<Uint8Array> {
  const document = await PDFDocument.create();
  const font = await document.embedFont(StandardFonts.Helvetica);
  const logicalLines = safeText.split(/\r\n|\r|\n/);
  for (const line of logicalLines) {
    assertRepresentable(font, line);
  }

  const top = PAGE_SIZE[1] - MARGIN;
  let page = document.addPage(PAGE_SIZE);
  let y = top;
  for (const line of logicalLines) {
    for (const segment of wrapLine(font, line)) {
      if (y < MARGIN) {
        page = document.addPage(PAGE_SIZE);
        y = top;
      }
      if (segment !== "") {
        page.drawText(segment, { x: MARGIN, y, size: FONT_SIZE, font, color: rgb(0, 0, 0) });
      }
      y -= LINE_HEIGHT;
    }
  }
  return document.save();
}
