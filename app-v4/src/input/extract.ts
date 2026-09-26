/**
 * Unified text/document input adapters (T06 #10, SPEC_V4_BATCH_AND_STRUCTURED
 * §4): pasted text, TXT, DOCX and text-bearing PDF, all returning the common
 * `ExtractedSource` contract consumable by Job state.
 *
 * Failure semantics are fail-closed (D-009): empty input, unsupported formats,
 * parser failures and PDFs without a text layer are explicit typed non-success
 * results — never an apparently successful empty document.
 *
 * Heavy parsers load lazily (SPEC_V4_QUALITY_SECURITY_DEPLOY §7): mammoth is
 * dynamically imported only for DOCX, vendored pdf.js only for PDF. Extracted
 * text is sensitive content kept memory-only (D-013): this module never
 * persists, logs, or transmits it.
 */
import {
  extensionOf,
  failure,
  success,
  type ExtractedSource,
  type ExtractedSourceFailure,
  type SourceFileLike,
  type SourceFormat,
} from "./extracted-source";
import { loadPdfJs, PDFJS_WORKER_SRC } from "./pdfjs-loader";
import {
  OVERSIZE_INPUT_CODE,
  isTextWithinSupportedSize,
  oversizeInputFor,
} from "../engine/input-limits";

export const PDF_NO_TEXT_LAYER_MESSAGE =
  "The PDF contains no extractable text; it is likely a scan or has no text layer.";

/**
 * Read the file's bytes. Uses the native `Blob.arrayBuffer()` when present;
 * otherwise falls back to `FileReader.readAsArrayBuffer` (equivalent public
 * API, available in environments — e.g. jsdom test runs — whose `Blob`
 * implementation predates the promise-based read methods).
 */
async function readFileBytes(file: SourceFileLike): Promise<ArrayBuffer> {
  if (typeof file.arrayBuffer === "function") {
    return file.arrayBuffer();
  }
  return new Promise<ArrayBuffer>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as ArrayBuffer);
    reader.onerror = () => reject(reader.error ?? new Error("Blob read failed."));
    reader.readAsArrayBuffer(file as unknown as Blob);
  });
}

/**
 * Read the file's bytes as UTF-8 text. Uses the native `Blob.text()` when
 * present; otherwise decodes the bytes read via {@link readFileBytes}.
 */
async function readFileText(file: SourceFileLike): Promise<string> {
  if (typeof file.text === "function") {
    return file.text();
  }
  return new TextDecoder("utf-8").decode(await readFileBytes(file));
}

/**
 * Shared oversize guard for the four input adapters (T15 #19, SD-1/SD-4).
 * Exported so the deterministic oracle in `extract.test.ts` can execute this
 * branch for every format; the four adapters `extractFromPastedText`,
 * `extractTxt`, `extractDocx` and `extractPdf` are its only production
 * callers.
 *
 * Returns `null` while the decoded text is within the supported size authority
 * (`../engine/input-limits`), otherwise a typed failure carrying the SHARED
 * actionable message verbatim. No part of the rejected text is ever included
 * in the result (SD-3/SD-7).
 *
 * Ordering: each adapter runs its own empty/whitespace check BEFORE this guard,
 * so an oversize input that is also whitespace-only still reports
 * `empty-input`; oversize input with real content always reports
 * `input-too-large`.
 *
 * Deliberate non-change: there is no byte-based pre-check on `File.size`. The
 * authority is measured in UTF-16 code units, so a byte comparison would mix
 * units and could falsely refuse valid multilingual input. Reading the file
 * and refusing on the decoded text keeps one consistent unit.
 */
export function oversizeFailureFor(
  format: SourceFormat,
  sourceName: string,
  text: string
): ExtractedSourceFailure | null {
  if (isTextWithinSupportedSize(text)) return null;
  return failure(format, sourceName, OVERSIZE_INPUT_CODE, oversizeInputFor(text)!.message);
}

/**
 * Pasted text adapter (D-009): empty/whitespace-only input is an explicit
 * empty-input failure. Successful text is returned unmodified — the adapter
 * never trims or truncates user content.
 */
export function extractFromPastedText(text: string): ExtractedSource {
  if (text.trim().length === 0) {
    return failure(
      "pasted-text",
      "pasted text",
      "empty-input",
      "Pasted text is empty; provide text before creating a job."
    );
  }
  const oversize = oversizeFailureFor("pasted-text", "pasted text", text);
  if (oversize) return oversize;
  return success("pasted-text", "pasted text", text);
}

/** TXT adapter: empty/whitespace-only files are an explicit empty-input failure. */
export async function extractTxt(file: SourceFileLike): Promise<ExtractedSource> {
  let text: string;
  try {
    text = await readFileText(file);
  } catch {
    return failure(
      "txt",
      file.name,
      "extraction-failed",
      `The TXT file "${file.name}" could not be read.`
    );
  }
  if (text.trim().length === 0) {
    return failure(
      "txt",
      file.name,
      "empty-input",
      `The TXT file "${file.name}" is empty; provide a file with content.`
    );
  }
  const oversize = oversizeFailureFor("txt", file.name, text);
  if (oversize) return oversize;
  return success("txt", file.name, text);
}

/**
 * DOCX adapter: mammoth 1.12.0 (npm) bundled via Vite, loaded lazily with a
 * dynamic import. `extractRawText({ arrayBuffer })` is the browser contract;
 * the identical ArrayBuffer is also passed as `buffer` so the package's Node
 * unzip variant (used by test environments that do not apply the package's
 * browser field) resolves the same bytes without a second copy.
 */
export async function extractDocx(file: SourceFileLike): Promise<ExtractedSource> {
  let arrayBuffer: ArrayBuffer;
  try {
    arrayBuffer = await readFileBytes(file);
  } catch {
    return failure(
      "docx",
      file.name,
      "extraction-failed",
      `The DOCX file "${file.name}" could not be read.`
    );
  }

  try {
    const mammoth = await import("mammoth");
    const result = await mammoth.extractRawText({ arrayBuffer, buffer: arrayBuffer });
    const text = result.value ?? "";
    if (text.trim().length === 0) {
      return failure(
        "docx",
        file.name,
        "empty-input",
        `The DOCX file "${file.name}" contains no extractable text.`
      );
    }
    const oversize = oversizeFailureFor("docx", file.name, text);
    if (oversize) return oversize;
    return success("docx", file.name, text);
  } catch {
    return failure(
      "docx",
      file.name,
      "extraction-failed",
      `The DOCX file "${file.name}" could not be parsed; it may be corrupt or not a valid DOCX document.`
    );
  }
}

/**
 * PDF adapter: vendored same-origin pdf.js, loaded lazily on first PDF use.
 * Mirrors the legacy extraction semantics: per page, text items are joined
 * with " " and pages are joined with "\n\n", then the total is trimmed.
 *
 * `isEvalSupported: false` is MANDATORY at every getDocument call site
 * (CVE-2024-4367 mitigation; enforced by scripts/ci/check-pdfjs-eval-guard).
 * A structurally valid PDF that yields no text items (or an empty total) is
 * an explicit pdf-no-text-layer failure, never a silent empty success.
 */
export async function extractPdf(file: SourceFileLike): Promise<ExtractedSource> {
  let arrayBuffer: ArrayBuffer;
  try {
    arrayBuffer = await readFileBytes(file);
  } catch {
    return failure(
      "pdf",
      file.name,
      "extraction-failed",
      `The PDF file "${file.name}" could not be read.`
    );
  }

  try {
    const pdfjsLib = await loadPdfJs();
    pdfjsLib.GlobalWorkerOptions.workerSrc = PDFJS_WORKER_SRC;
    // pdf.js requires typed-array bytes; copy-free view over the file buffer.
    const data = new Uint8Array(arrayBuffer);
    const pdf = await pdfjsLib.getDocument({ data, isEvalSupported: false }).promise;

    const pageTexts: string[] = [];
    for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber++) {
      const page = await pdf.getPage(pageNumber);
      const textContent = await page.getTextContent();
      pageTexts.push(textContent.items.map((item) => item.str ?? "").join(" "));
    }

    const fullText = pageTexts.join("\n\n").trim();
    if (fullText.length === 0) {
      return failure("pdf", file.name, "pdf-no-text-layer", PDF_NO_TEXT_LAYER_MESSAGE);
    }
    const oversize = oversizeFailureFor("pdf", file.name, fullText);
    if (oversize) return oversize;
    return success("pdf", file.name, fullText);
  } catch {
    return failure(
      "pdf",
      file.name,
      "extraction-failed",
      `The PDF file "${file.name}" could not be parsed; it may be corrupt or not a valid PDF document.`
    );
  }
}

/**
 * Dispatch a file to its adapter by lowercase extension. Case-insensitive.
 * Legacy `.doc` is an explicit unsupported-format failure with a message that
 * names the supported types (FILE-001); `.doc` is also never advertised in
 * the file input's accept attribute.
 */
export async function extractFile(file: SourceFileLike): Promise<ExtractedSource> {
  const extension = extensionOf(file.name);
  switch (extension) {
    case "txt":
      return extractTxt(file);
    case "docx":
      return extractDocx(file);
    case "pdf":
      return extractPdf(file);
    case "doc":
      return failure(
        "unknown",
        file.name,
        "unsupported-format",
        `Legacy Word ".doc" files are not supported; convert the document to DOCX or TXT and try again. Supported types: TXT, PDF, DOCX.`
      );
    default:
      return failure(
        "unknown",
        file.name,
        "unsupported-format",
        `The file "${file.name}" has an unsupported type "${
          extension ? `.${extension}` : "(no extension)"
        }"; supported types: TXT, PDF, DOCX.`
      );
  }
}

/** Type guard narrowing an {@link ExtractedSource} to its failure variant. */
export function isExtractionFailure(
  extracted: ExtractedSource
): extracted is ExtractedSourceFailure {
  return extracted.status === "failed";
}
