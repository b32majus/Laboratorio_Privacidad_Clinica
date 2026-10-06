/**
 * Batch Safe document deliverables (REC-07 #88): the per-document ZIP and the
 * consolidated Safe PDF with an index.
 *
 * Pure, DOM-free derivation + client-side builders over the accepted batch
 * authorities — never a second readiness/state machine:
 *
 * - Per-document Safe material comes ONLY from each completed item's
 *   finalizable `ReviewSession` via canonical `getFinalText(...)`. No privacy
 *   transformation is rerun to build output.
 * - Authorization reuses the ONE shared readiness authority
 *   (`batchSafeSummaryReady(...)`): the builders defend themselves with the
 *   same fact plus a per-item defense-in-depth guard, exactly like the #87
 *   serializer.
 * - Per-document PDF semantics remain the REC-05 `buildSafePdfBytes(...)`
 *   semantics, including `PdfRepresentationError` → zero bytes. Both
 *   artifacts compose that builder; neither reinterprets it.
 * - Naming uses deterministic ordinal identity from the stable original batch
 *   index (`documento-seguro-03.pdf` for original index 3). No source
 *   filename may appear in any shareable Safe artifact: original filenames
 *   can themselves contain identifiers.
 * - All-or-nothing per requested artifact: if any included document cannot
 *   be represented as the accepted Safe PDF, the requested action throws and
 *   produces ZERO bytes. A partial batch artifact is never produced.
 * - A deliberately removed error (`error + removed`) produces no prepared
 *   document body and is never relabelled `completed`; the #87 CSV keeps its
 *   `error,retirado` row unchanged and stays the authoritative full-batch
 *   manifest.
 *
 * Memory-only, no logging of content, no network, no persistence (D-013).
 * No new dependency: `jszip` and `pdf-lib` are already direct dependencies.
 */

import JSZip from "jszip";
import { PDFDocument, PageSizes, StandardFonts, rgb, type PDFFont, type PDFPage } from "pdf-lib";

import { batchSafeSummaryReady, type Job } from "../domain/job";
import { deriveBatchFacts } from "../privacy-gate/privacyGateModel";
import { getFinalText, type ReviewSession } from "../review/review-domain";
import { buildSafePdfBytes } from "../output/pdf-builder";

/** Deterministic Spanish filename of the batch Safe ZIP (primary action). */
export const BATCH_SAFE_ZIP_FILENAME = "lote-documentos-seguros.zip";

/** Deterministic Spanish filename of the consolidated Safe PDF (secondary). */
export const BATCH_SAFE_CONSOLIDATED_PDF_FILENAME = "lote-seguro-consolidado.pdf";

export const BATCH_SAFE_ZIP_MIME = "application/zip";
export const BATCH_SAFE_PDF_MIME = "application/pdf";

/** Typed fail-closed refusal: the requested batch Safe artifact is not authorized. */
export class BatchSafeDeliverablesError extends Error {
  readonly code = "BATCH_SAFE_NOT_AUTHORIZED";

  constructor(message: string) {
    super(message);
    this.name = "BatchSafeDeliverablesError";
  }
}

/**
 * One prepared Safe document of the batch: the stable 1-based original batch
 * index, its deterministic ordinal entry name, and its canonical Safe text.
 */
export type BatchSafeDocument = {
  readonly batchIndex: number;
  readonly entryName: string;
  readonly safeText: string;
};

/**
 * Deterministic ordinal entry/label identity from the stable original batch
 * index (1-based). Never the source filename.
 */
export function batchSafeDocumentEntryName(batchIndex: number): string {
  return `documento-seguro-${String(batchIndex).padStart(2, "0")}.pdf`;
}

/** Human ordinal label for the consolidated PDF index and section covers. */
export function batchSafeDocumentLabel(batchIndex: number): string {
  return `Documento ${batchIndex}`;
}

/**
 * Derive the prepared Safe documents of a READY batch in original selection
 * order. Fails closed with a typed error (zero bytes downstream) unless the
 * batch is authorized by the ONE shared readiness authority AND every
 * original item is either a completed reviewed item (with its finalizable
 * session present) or a deliberately removed failed item (which contributes
 * no document body). Any other item state — active failure, pending work, a
 * completed row without its review session — refuses the whole derivation, so
 * an unauthorized batch can never produce a partial artifact.
 *
 * `sessionsByIndex` is the bridge-held per-item session set keyed by the
 * original batch index (the same `batchSessions` authority App holds); it is
 * matched by index, never by filename.
 */
export function deriveBatchSafeDocuments(
  job: Job,
  sessionsByIndex: Readonly<Record<number, ReviewSession>> | null
): readonly BatchSafeDocument[] {
  if (!batchSafeSummaryReady(job)) {
    throw new BatchSafeDeliverablesError(
      "deriveBatchSafeDocuments refuses to derive: the batch Safe deliverables are not " +
        "authorized while the review is incomplete, the derived completeness disagrees, " +
        "or an active batch error remains."
    );
  }
  if (sessionsByIndex === null) {
    throw new BatchSafeDeliverablesError(
      "deriveBatchSafeDocuments refuses to derive: no per-document review authority is available."
    );
  }
  const facts = deriveBatchFacts(job);
  const documents: BatchSafeDocument[] = [];
  facts.items.forEach((item, position) => {
    const batchIndex = position + 1;
    if (item.status === "completed") {
      const session = sessionsByIndex[position];
      if (session === undefined) {
        throw new BatchSafeDeliverablesError(
          `deriveBatchSafeDocuments refuses batch item ${batchIndex}: the item is completed ` +
            `but its review session is not available, so no Safe content can be derived for it.`
        );
      }
      // Canonical per-document Safe material. `getFinalText` itself refuses a
      // non-finalizable session, so review authority stays single-sourced.
      documents.push(
        Object.freeze({
          batchIndex,
          entryName: batchSafeDocumentEntryName(batchIndex),
          safeText: getFinalText(session),
        })
      );
      return;
    }
    if (item.status === "error" && item.removed === true) {
      // Deliberately removed: no prepared document body, never `completed`.
      return;
    }
    throw new BatchSafeDeliverablesError(
      `deriveBatchSafeDocuments refuses batch item ${batchIndex}: the Safe deliverables are ` +
        `authorized only when every item is completed or deliberately removed.`
    );
  });
  if (documents.length === 0) {
    throw new BatchSafeDeliverablesError(
      "deriveBatchSafeDocuments refuses to derive: the batch holds no prepared document."
    );
  }
  return Object.freeze(documents);
}

/** Fixed ZIP entry timestamp so batch ZIP assembly stays byte-deterministic. */
const FIXED_ZIP_DATE = new Date("2024-01-01T00:00:00.000Z");

/**
 * Build the batch Safe ZIP bytes: one accepted Safe PDF per prepared
 * document, each composed through the canonical REC-05 builder. A
 * `PdfRepresentationError` from any included document rejects the whole ZIP
 * with zero bytes (all-or-nothing); the failure never mutates Job/review
 * readiness — it is a visible output-action failure for the caller to report.
 */
export async function buildBatchSafeZipBytes(
  documents: readonly BatchSafeDocument[]
): Promise<Uint8Array> {
  if (documents.length === 0) {
    throw new BatchSafeDeliverablesError(
      "buildBatchSafeZipBytes refuses to build: no prepared document was derived."
    );
  }
  const zip = new JSZip();
  for (const document of documents) {
    // Canonical REC-05 representation per document; refusal propagates and no
    // partial ZIP is ever generated (generateAsync runs only after every
    // document succeeded).
    const pdfBytes = await buildSafePdfBytes(document.safeText);
    zip.file(document.entryName, pdfBytes, { date: FIXED_ZIP_DATE, createFolders: false });
  }
  return zip.generateAsync({
    type: "uint8array",
    compression: "DEFLATE",
    compressionOptions: { level: 6 },
    platform: "UNIX",
  });
}

const CONSOLIDATED_PAGE_SIZE = PageSizes.A4;
const CONSOLIDATED_MARGIN = 50;
const CONSOLIDATED_TITLE_SIZE = 16;
const CONSOLIDATED_FONT_SIZE = 11;
const CONSOLIDATED_LINE_HEIGHT = 16;

type ConsolidatedLine = {
  readonly text: string;
  readonly title: boolean;
};

/** Draw lines with the consolidated paginator; shared by counting and final render. */
function drawConsolidatedLines(
  page: PDFPage,
  font: PDFFont,
  bold: PDFFont,
  lines: readonly ConsolidatedLine[],
  nextPage: () => PDFPage
): void {
  let current = page;
  let y = CONSOLIDATED_PAGE_SIZE[1] - CONSOLIDATED_MARGIN;
  for (const line of lines) {
    if (y < CONSOLIDATED_MARGIN) {
      current = nextPage();
      y = CONSOLIDATED_PAGE_SIZE[1] - CONSOLIDATED_MARGIN;
    }
    if (line.text !== "") {
      current.drawText(line.text, {
        x: CONSOLIDATED_MARGIN,
        y,
        size: line.title ? CONSOLIDATED_TITLE_SIZE : CONSOLIDATED_FONT_SIZE,
        font: line.title ? bold : font,
        color: rgb(0, 0, 0),
      });
    }
    y -= line.title ? CONSOLIDATED_LINE_HEIGHT * 1.5 : CONSOLIDATED_LINE_HEIGHT;
  }
}

function titleLine(text: string): ConsolidatedLine {
  return { text, title: true };
}

function bodyLine(text: string): ConsolidatedLine {
  return { text, title: false };
}

function blankLine(): ConsolidatedLine {
  return { text: "", title: false };
}

/**
 * Build the consolidated Safe PDF bytes: an index of the prepared documents
 * (ordinal labels with start pages, never source filenames) followed by one
 * labelled section per document. Every document section reuses the canonical
 * REC-05 bytes verbatim — the consolidated artifact is composed from the
 * accepted representation, so an unrepresentable character refuses with the
 * same typed `PdfRepresentationError` and zero bytes (all-or-nothing).
 */
export async function buildBatchConsolidatedPdfBytes(
  documents: readonly BatchSafeDocument[]
): Promise<Uint8Array> {
  if (documents.length === 0) {
    throw new BatchSafeDeliverablesError(
      "buildBatchConsolidatedPdfBytes refuses to build: no prepared document was derived."
    );
  }
  // Canonical per-document bytes first: both the representability validation
  // (typed refusal propagates) and the exact section content come from the
  // accepted REC-05 builder. Nothing is produced when any document refuses.
  const sections = await Promise.all(
    documents.map(async (document) => ({
      document,
      pdf: await PDFDocument.load(await buildSafePdfBytes(document.safeText)),
    }))
  );

  const final = await PDFDocument.create();
  const font = await final.embedFont(StandardFonts.Helvetica);
  const bold = await final.embedFont(StandardFonts.HelveticaBold);
  const addPage = (): PDFPage => final.addPage(CONSOLIDATED_PAGE_SIZE);

  // Index page count is layout truth: render the index once into a scratch
  // document (entry lines never wrap, but the count stays measured, never
  // recomputed by a second formula), then compute section start pages.
  const indexBody = (startPages: ReadonlyMap<number, number>): readonly ConsolidatedLine[] => {
    const lines: ConsolidatedLine[] = [
      titleLine("Lote seguro consolidado"),
      bodyLine("Índice de documentos preparados del lote"),
      blankLine(),
      bodyLine(`Documentos incluidos: ${documents.length}`),
      blankLine(),
    ];
    for (const { document } of sections) {
      const start = startPages.get(document.batchIndex) ?? 0;
      lines.push(bodyLine(`${batchSafeDocumentLabel(document.batchIndex)} — página ${start}`));
    }
    lines.push(blankLine());
    lines.push(bodyLine("El resumen seguro (.csv) sigue siendo el manifiesto completo del lote."));
    return lines;
  };

  const scratch = await PDFDocument.create();
  const scratchFont = await scratch.embedFont(StandardFonts.Helvetica);
  const scratchBold = await scratch.embedFont(StandardFonts.HelveticaBold);
  const scratchFirst = scratch.addPage(CONSOLIDATED_PAGE_SIZE);
  drawConsolidatedLines(scratchFirst, scratchFont, scratchBold, indexBody(new Map()), () =>
    scratch.addPage(CONSOLIDATED_PAGE_SIZE)
  );
  const indexPages = scratch.getPageCount();

  // One cover page per document section, then the canonical section pages.
  let nextStart = indexPages + 1;
  const startPages = new Map<number, number>();
  for (const { document, pdf } of sections) {
    startPages.set(document.batchIndex, nextStart);
    nextStart += 1 + pdf.getPageCount();
  }

  const first = addPage();
  drawConsolidatedLines(first, font, bold, indexBody(startPages), addPage);
  for (const { document, pdf } of sections) {
    const cover = addPage();
    // The cover carries the stable original-index ordinal only. It must never
    // present the included-document count as the denominator of an
    // original-index ordinal: with earlier batch items removed, "Documento 2
    // de 1" would be a false denominator (the index page already reports the
    // included count as its own measured fact).
    cover.drawText(batchSafeDocumentLabel(document.batchIndex), {
      x: CONSOLIDATED_MARGIN,
      y: CONSOLIDATED_PAGE_SIZE[1] - CONSOLIDATED_MARGIN,
      size: CONSOLIDATED_TITLE_SIZE,
      font: bold,
      color: rgb(0, 0, 0),
    });
    cover.drawText(`Índice de lote: ${document.batchIndex}`, {
      x: CONSOLIDATED_MARGIN,
      y: CONSOLIDATED_PAGE_SIZE[1] - CONSOLIDATED_MARGIN - CONSOLIDATED_LINE_HEIGHT * 1.75,
      size: CONSOLIDATED_FONT_SIZE,
      font,
      color: rgb(0, 0, 0),
    });
    const pages = await final.copyPages(pdf, pdf.getPageIndices());
    for (const page of pages) {
      final.addPage(page);
    }
  }
  return final.save();
}
