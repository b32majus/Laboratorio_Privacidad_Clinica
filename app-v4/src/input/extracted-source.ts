/**
 * Common extracted-source contract for V4 input adapters (T06 #10, SPEC_V4
 * BATCH_AND_STRUCTURED.md §4).
 *
 * Every adapter (pasted text, TXT, DOCX, PDF) returns this same discriminated
 * union so its outcomes are directly consumable by Job state. Extraction
 * failure and unsupported formats are EXPLICIT non-success results (D-009
 * fail-closed): they must never be represented as an apparently successful
 * empty document.
 *
 * All returned objects are frozen plain objects. Extracted text is sensitive
 * content and stays memory-only (D-013): this module never persists, logs, or
 * transmits it, and contains no storage or network code.
 */

/** Input formats owned by the T06 adapters. */
export type SourceFormat = "pasted-text" | "txt" | "docx" | "pdf";

/**
 * Machine-readable failure codes (D-009). `empty-input` covers empty pasted
 * text and empty/whitespace-only TXT files; `pdf-no-text-layer` marks a
 * structurally valid PDF that yields no text (likely a scan).
 */
export type ExtractionErrorCode =
  "empty-input" | "unsupported-format" | "extraction-failed" | "pdf-no-text-layer";

export type ExtractedSourceSuccess = {
  readonly status: "success";
  readonly format: SourceFormat;
  readonly sourceName: string;
  readonly text: string;
};

export type ExtractedSourceFailure = {
  readonly status: "failed";
  readonly format: SourceFormat | "unknown";
  readonly sourceName: string;
  readonly error: {
    readonly code: ExtractionErrorCode;
    readonly message: string;
  };
};

/** Discriminated union returned by every input adapter. */
export type ExtractedSource = ExtractedSourceSuccess | ExtractedSourceFailure;

/** Minimal file surface the adapters need (satisfied by the DOM `File`). */
export type SourceFileLike = {
  readonly name: string;
  /** Present on browser `File`/`Blob`; absent in some test environments. */
  arrayBuffer?(): Promise<ArrayBuffer>;
  text?(): Promise<string>;
};

/** Lowercase extension of a file name, without the leading dot. */
export function extensionOf(fileName: string): string {
  const dot = fileName.lastIndexOf(".");
  return dot >= 0 ? fileName.slice(dot + 1).toLowerCase() : "";
}

function freezeSource(source: ExtractedSource): ExtractedSource {
  if (source.status === "failed") {
    return Object.freeze({
      ...source,
      error: Object.freeze({ ...source.error }),
    });
  }
  return Object.freeze({ ...source });
}

/** Build a frozen success result. */
export function success(
  format: SourceFormat,
  sourceName: string,
  text: string
): ExtractedSourceSuccess {
  return freezeSource({ status: "success", format, sourceName, text }) as ExtractedSourceSuccess;
}

/** Build a frozen failure result with a typed code and an English message. */
export function failure(
  format: SourceFormat | "unknown",
  sourceName: string,
  code: ExtractionErrorCode,
  message: string
): ExtractedSourceFailure {
  return freezeSource({
    status: "failed",
    format,
    sourceName,
    error: { code, message },
  }) as ExtractedSourceFailure;
}
