/**
 * F6 contract seam. Intentionally RED until implementer moves the existing
 * PDF.js *downloaded bytes* reader here from rec87-batch-result.spec.ts.
 * Only test-side code. No production exports or data access.
 */
export async function extractPdfText(_bytes: Uint8Array): Promise<string> {
  return ""; // RED: no PDF payload can satisfy the cross-format contract
}

/** PDF.js synthesizes whitespace at text-item and wrap boundaries. */
export const readableText = (value: string): string => value.replace(/\s+/g, " ").trim();
