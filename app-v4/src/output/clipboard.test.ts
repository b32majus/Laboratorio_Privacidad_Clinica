/**
 * Adversarial oracle for the REC-05 WU-A clipboard helper (D-024).
 *
 * The helper must use the platform Clipboard API only, must surface a
 * rejected/unavailable clipboard as a visible failure, and must not contain
 * any hidden-element/legacy fallback path.
 *
 * Synthetic/no-PHI fixtures only.
 */
import * as fs from "node:fs";
import * as path from "node:path";
import { fileURLToPath } from "node:url";

import { afterEach, describe, expect, it, vi } from "vitest";

import { ClipboardError, copyTextToClipboard } from "./clipboard";

function installClipboard(writeText: (text: string) => Promise<void>): void {
  Object.defineProperty(navigator, "clipboard", {
    configurable: true,
    value: { writeText },
  });
}

function removeClipboard(): void {
  Object.defineProperty(navigator, "clipboard", {
    configurable: true,
    value: undefined,
  });
}

afterEach(() => {
  removeClipboard();
  vi.restoreAllMocks();
});

describe("successful copy", () => {
  it("writes the exact Safe string, unicode included, to the platform clipboard", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    installClipboard(writeText);
    const safeText = "Paciente: Carmen Sánchez, niño de 7 años.\nLínea dos.";

    await expect(copyTextToClipboard(safeText)).resolves.toBeUndefined();
    expect(writeText).toHaveBeenCalledTimes(1);
    expect(writeText).toHaveBeenCalledWith(safeText);
  });
});

describe("visible failure, never silent success", () => {
  it("throws CLIPBOARD_REJECTED when the platform rejects the write", async () => {
    installClipboard(vi.fn().mockRejectedValue(new DOMException("denied", "NotAllowedError")));

    await expect(copyTextToClipboard("texto")).rejects.toBeInstanceOf(ClipboardError);
    await expect(copyTextToClipboard("texto")).rejects.toMatchObject({
      code: "CLIPBOARD_REJECTED",
    });
  });

  it("throws CLIPBOARD_UNAVAILABLE when no clipboard API exists", async () => {
    removeClipboard();

    await expect(copyTextToClipboard("texto")).rejects.toBeInstanceOf(ClipboardError);
    await expect(copyTextToClipboard("texto")).rejects.toMatchObject({
      code: "CLIPBOARD_UNAVAILABLE",
    });
  });

  it("throws CLIPBOARD_UNAVAILABLE when writeText is not a function", async () => {
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: {},
    });

    await expect(copyTextToClipboard("texto")).rejects.toMatchObject({
      code: "CLIPBOARD_UNAVAILABLE",
    });
  });
});

describe("source boundary", () => {
  it("exposes exactly one declared content parameter", () => {
    expect(copyTextToClipboard.length).toBe(1);
  });

  it("ignores any extra argument (no second content channel)", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    installClipboard(writeText);
    const callWithExtra = copyTextToClipboard as (text: string, extra?: unknown) => Promise<void>;

    await callWithExtra("solo el texto seguro", { mapping: "PAC_ORIGINAL", note: "secreto" });
    expect(writeText).toHaveBeenCalledTimes(1);
    expect(writeText).toHaveBeenCalledWith("solo el texto seguro");
  });

  it("has no hidden-element or document-based fallback", () => {
    const source = fs.readFileSync(
      path.join(path.dirname(fileURLToPath(import.meta.url)), "clipboard.ts"),
      "utf8"
    );
    expect(source).toMatch(/navigator\.clipboard/);
    for (const forbidden of [
      /execCommand/,
      /textarea/i,
      /document\.createElement/,
      /localStorage/,
      /sessionStorage/,
      /fetch\s*\(/,
    ]) {
      expect(source, `clipboard.ts must not contain ${forbidden}`).not.toMatch(forbidden);
    }
  });
});
