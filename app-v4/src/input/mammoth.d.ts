/**
 * Minimal ambient declaration for the `mammoth` npm package (1.12.0), which
 * ships no TypeScript types. Only the surface used by the V4 DOCX adapter is
 * declared; the browser field of the package maps `lib/unzip.js` and
 * `lib/docx/files.js` to their browser variants when Vite bundles it.
 */
declare module "mammoth" {
  export interface MammothExtractRawTextInput {
    /** Primary input contract (browser unzip variant). */
    arrayBuffer: ArrayBuffer;
    /**
     * Alias to the SAME bytes for the package's Node unzip variant (used in
     * test environments that do not apply the browser field). Never a second
     * copy: callers pass the identical ArrayBuffer reference.
     */
    buffer?: ArrayBuffer;
  }

  export interface MammothExtractRawTextResult {
    readonly value: string;
    readonly messages: readonly unknown[];
  }

  export function extractRawText(
    input: MammothExtractRawTextInput
  ): Promise<MammothExtractRawTextResult>;
}
