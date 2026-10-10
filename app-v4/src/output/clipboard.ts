/**
 * Safe clipboard helper (REC-05 WU-A, D-024).
 *
 * Copies the canonical Safe string with the platform Clipboard API only.
 * An unavailable or rejected clipboard becomes a visible typed failure
 * ({@link ClipboardError}); there is intentionally no hidden-element or
 * document-based legacy fallback path. The sole content input is the string.
 */

/** D-024 clipboard failure codes. */
export type ClipboardErrorCode = "CLIPBOARD_UNAVAILABLE" | "CLIPBOARD_REJECTED";

/** Typed, visible failure for clipboard copy attempts. */
export class ClipboardError extends Error {
  readonly code: ClipboardErrorCode;
  constructor(code: ClipboardErrorCode, message: string) {
    super(message);
    this.name = "ClipboardError";
    this.code = code;
  }
}

/**
 * Write the canonical Safe string to the platform clipboard. Resolves only
 * when the platform accepted the write; rejects with {@link ClipboardError}
 * otherwise. It never reports silent success.
 */
export async function copyTextToClipboard(safeText: string): Promise<void> {
  const clipboard = typeof navigator === "undefined" ? undefined : navigator.clipboard;
  if (!clipboard || typeof clipboard.writeText !== "function") {
    throw new ClipboardError(
      "CLIPBOARD_UNAVAILABLE",
      "El portapapeles no está disponible en este navegador."
    );
  }
  try {
    await clipboard.writeText(safeText);
  } catch {
    throw new ClipboardError(
      "CLIPBOARD_REJECTED",
      "El navegador rechazó la escritura en el portapapeles."
    );
  }
}

/**
 * Read the current clipboard text (issue #80, REC-08 Pegar convenience).
 *
 * Browser-local only: the platform Clipboard API, no network request, no
 * storage write. Rejects with {@link ClipboardError} when the clipboard is
 * unavailable or the read is denied; the caller surfaces a visible Spanish
 * failure with the Ctrl+V fallback. The raw platform exception is never
 * exposed to the user. It never creates a Job.
 */
export async function readTextFromClipboard(): Promise<string> {
  const clipboard = typeof navigator === "undefined" ? undefined : navigator.clipboard;
  if (!clipboard || typeof clipboard.readText !== "function") {
    throw new ClipboardError(
      "CLIPBOARD_UNAVAILABLE",
      "El portapapeles no está disponible en este navegador."
    );
  }
  try {
    return await clipboard.readText();
  } catch {
    throw new ClipboardError(
      "CLIPBOARD_REJECTED",
      "El navegador no permitió leer el portapapeles."
    );
  }
}
