/**
 * Excel serial-date normalization (T18 #22, SPEC_V4_BATCH_AND_STRUCTURED.md
 * §9, DEBT STRUCT-008).
 *
 * Excel stores dates as serial numbers under the 1900 date system, including
 * the historical Lotus leap-year bug (a phantom 1900-02-29 with serial 60).
 * The standard normalization used by SheetJS/openpyxl treats serial `s` as
 * `1899-12-30 + s days` (UTC), which is exact for serials ≥ 61 (dates from
 * 1900-03-01 on) and off by one day for the ancient 1..59 range.
 *
 * Fail-closed choice (D-009): serials below 61 and above 2958465 (9999-12-31)
 * are OUTSIDE the supported clinical range and return `null` — the caller
 * must surface a typed failure instead of emitting a silently wrong date.
 * Pure function: no I/O, no console, deterministic.
 */

/** First serial mapped exactly by the 1899-12-30 anchor (1900-03-01). */
export const MIN_SUPPORTED_EXCEL_SERIAL = 61;

/** Last serial of the Excel 1900 system (9999-12-31). */
export const MAX_SUPPORTED_EXCEL_SERIAL = 2958465;

const MS_PER_DAY = 86400000;
/** UTC milliseconds of the 1899-12-30 anchor. */
const ANCHOR_MS = Date.UTC(1899, 11, 30);

/**
 * Normalize an Excel 1900-system serial to an ISO `YYYY-MM-DD` date (UTC date
 * part). Returns `null` for serials outside the supported range or non-finite
 * input (callers fail closed; no silent wrong dates). A fractional part (a
 * time of day) is dropped: only the calendar date is clinically relevant.
 */
export function excelSerialToIsoDate(serial: number): string | null {
  if (!Number.isFinite(serial)) {
    return null;
  }
  if (serial < MIN_SUPPORTED_EXCEL_SERIAL || serial > MAX_SUPPORTED_EXCEL_SERIAL) {
    return null;
  }
  const wholeDays = Math.floor(serial);
  return new Date(ANCHOR_MS + wholeDays * MS_PER_DAY).toISOString().slice(0, 10);
}
