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
 * Whitespace is content (D-024: the PDF representation must not narrow the
 * canonical Safe string): leading, repeated and trailing spaces of a logical
 * line survive. The single permitted normalization is the documented reflow
 * rule on {@link wrapLine}: one space at a rendered wrap point becomes the
 * line break.
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
 * Wrap one logical line to the text column width, preserving the line's
 * whitespace exactly: leading spaces, consecutive internal spaces and
 * trailing spaces are content and survive into the rendered segments. The
 * ONLY normalization is the one D-024 authorizes for reflow: when a rendered
 * line break occurs at a run of spaces, exactly ONE space of that run is
 * consumed as the wrap point (it becomes the line break); the remaining
 * spaces of the run are rendered at the start of the next segment. Words are
 * kept whole while they fit; a single word or space run wider than the
 * column is split by code point so no content is ever truncated or clipped
 * off the page.
 */
function wrapLine(font: PDFFont, line: string): string[] {
  if (line === "") {
    return [""];
  }
  const maxWidth = PAGE_SIZE[0] - MARGIN * 2;
  const segments: string[] = [];
  let current = "";
  // Spaces seen since the last rendered word: they belong to the content and
  // are only committed once the word they precede is placed (or at the end
  // of the line, as trailing spaces).
  let pendingSpaces = "";

  // Split content wider than the column by code point (spaces included) so
  // nothing is ever truncated; leaves the tail in `current`.
  const splitOverflow = (content: string): void => {
    let chunk = "";
    for (const char of content) {
      if (font.widthOfTextAtSize(chunk + char, FONT_SIZE) <= maxWidth) {
        chunk += char;
      } else {
        segments.push(chunk);
        chunk = char;
      }
    }
    current = chunk;
  };

  // Tokenize into maximal space runs and words. Splitting on single spaces
  // (the previous implementation) made empty tokens indistinguishable from
  // "no content" and silently dropped leading/trailing/repeated spaces.
  const tokens = line.match(/ +|[^ ]+/g) ?? [];
  for (const token of tokens) {
    if (token[0] === " ") {
      pendingSpaces += token;
      // A space run can overflow on its own (line start / continuation).
      if (font.widthOfTextAtSize(current + pendingSpaces, FONT_SIZE) > maxWidth) {
        if (current !== "") {
          segments.push(current);
          // D-024 reflow normalization: exactly one space of the run
          // becomes the break; the rest stays visible content.
          pendingSpaces = pendingSpaces.slice(1);
        }
        const spaces = pendingSpaces;
        pendingSpaces = "";
        splitOverflow(spaces);
      }
      continue;
    }
    const candidate = current + pendingSpaces + token;
    if (font.widthOfTextAtSize(candidate, FONT_SIZE) <= maxWidth) {
      current = candidate;
      pendingSpaces = "";
      continue;
    }
    if (current !== "") {
      segments.push(current);
      // D-024 reflow normalization: exactly one space of the run between
      // the two rendered segments becomes the line break.
      pendingSpaces = pendingSpaces.slice(1);
    }
    const content = pendingSpaces + token;
    pendingSpaces = "";
    splitOverflow(content);
  }
  segments.push(current + pendingSpaces);
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
