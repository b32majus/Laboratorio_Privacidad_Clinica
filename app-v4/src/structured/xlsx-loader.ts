/**
 * Lazy loader for the vendored SheetJS runtime (T18 #22, SPEC_V4_BATCH_AND_
 * STRUCTURED.md §9, SPEC_V4_QUALITY_SECURITY_DEPLOY §7 "Load heavy parsers
 * only for the relevant job type").
 *
 * SheetJS is NOT bundled into the V4 application: `lib/xlsx.full.min.js`
 * (0.20.2) is governed by scripts/ci/vendor-manifest.json (sha256, copyOf)
 * and is served as a byte-identical same-origin static asset from
 * `/vendor/xlsx.full.min.js` (git symlink to the governed source of truth).
 * On first Excel use this helper injects a single <script> tag for the
 * library, mirroring the pdf.js loader (`../input/pdfjs-loader.ts`).
 *
 * Same-origin only: the injected script src is a fixed constant and never
 * depends on input. No other network I/O happens in the structured adapters;
 * sensitive cell content stays memory-only (D-013). No console.* calls.
 */

/** Minimal typed surface of the SheetJS API used by the V4 Excel adapter. */
export type XlsxCell = {
  readonly t: string;
  readonly v?: unknown;
  readonly w?: string;
  /** Cell number format (only present when reading with `cellNF: true`). */
  readonly z?: unknown;
};

export type XlsxRange = {
  readonly s: { readonly r: number; readonly c: number };
  readonly e: { readonly r: number; readonly c: number };
};

export type XlsxWorksheet = {
  readonly [address: string]: XlsxCell | string | undefined;
};

export type XlsxWorkbook = {
  readonly SheetNames: readonly string[];
  readonly Sheets: Readonly<Record<string, XlsxWorksheet>>;
};

/**
 * Authoring surface of the SAME governed bundle, used only to build
 * deterministic browser-local workbooks (REC-04 WU-C, D-022). No new
 * dependency, no network: the bytes come from the already-loaded
 * same-origin runtime. Serializers construct every string cell explicitly
 * as `{ t: "s", v }` so source/user text beginning `=`, `+`, `-`, `@`
 * stays a literal string cell, never a formula.
 */
export type XlsxAuthoring = {
  book_new(): Record<string, unknown>;
  book_append_sheet(workbook: Record<string, unknown>, sheet: XlsxWorksheet, name: string): void;
};

export type XlsxLib = {
  readonly version: string;
  read(
    data: ArrayBuffer | Uint8Array,
    options: { type: "array"; cellDates?: boolean; cellNF?: boolean }
  ): XlsxWorkbook;
  write(
    workbook: Record<string, unknown>,
    options: { type: "array"; bookType: "xlsx" }
  ): ArrayBuffer | Uint8Array | number[];
  readonly SSF: { is_date(fmt: unknown): boolean };
  readonly utils: {
    encode_cell(cell: { r: number; c: number }): string;
    decode_range(range: string): XlsxRange;
  } & XlsxAuthoring;
};

/** Same-origin vendored SheetJS bundle (byte-identical to lib/xlsx.full.min.js). */
export const XLSX_LIB_SRC = "/vendor/xlsx.full.min.js";

declare global {
  interface Window {
    XLSX?: XlsxLib;
  }
}

let pendingLoad: Promise<XlsxLib> | null = null;

/**
 * Resolve the SheetJS API, loading the vendored same-origin script once on
 * first use. If the API is already present on `window` (e.g. pre-seeded by
 * deterministic tests), it is reused and no script is injected.
 */
export function loadXlsx(): Promise<XlsxLib> {
  const existing = typeof window !== "undefined" ? window.XLSX : undefined;
  if (existing) return Promise.resolve(existing);

  if (!pendingLoad) {
    pendingLoad = new Promise<XlsxLib>((resolve, reject) => {
      const script = document.createElement("script");
      script.src = XLSX_LIB_SRC;
      script.async = true;
      script.onload = () => {
        const lib = window.XLSX;
        if (lib) {
          resolve(lib);
        } else {
          pendingLoad = null;
          reject(new Error(`SheetJS was loaded but window.XLSX is unavailable.`));
        }
      };
      script.onerror = () => {
        pendingLoad = null;
        reject(new Error(`SheetJS could not be loaded from ${XLSX_LIB_SRC}.`));
      };
      document.head.appendChild(script);
    });
  }
  return pendingLoad;
}

/**
 * Test-only: forget the in-flight/pending loader promise so a later test can
 * exercise the script-injection branch again. Never used by runtime code.
 */
export function resetXlsxLoaderForTests(): void {
  pendingLoad = null;
}
