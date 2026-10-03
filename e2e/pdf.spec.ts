/**
 * PDF input contracts E2E (Work Order T21 #25; SPEC_V4_QUALITY_SECURITY_
 * DEPLOY.md §1 E2E list).
 *
 * Committed synthetic fixtures, real browser PDF.js from the same-origin
 * vendored assets served by the production-like build:
 *  - a text-layer PDF extracts deterministically and reaches review with its
 *    exact intended text;
 *  - a scanned/no-text PDF fails EXPLICITLY with the typed warning and never
 *    becomes a job (no OCR, no silent empty success).
 */
import { expect, test } from "./harness/fixtures";

import path from "node:path";

const FIXTURES_DIR = path.resolve(__dirname, "../app-v4/src/input/fixtures");
const TEXT_PDF = path.join(FIXTURES_DIR, "sample-clinical-note.pdf");
const SCANNED_PDF = path.join(FIXTURES_DIR, "sample-scanned.pdf");

const PDF_TEXT = "Nota clinica sintetica de prueba para el laboratorio.";

test("a text-layer PDF extracts its text and reaches review", async ({ page }) => {
  await page.goto("/");
  await page.getByLabel("Select files (TXT, PDF, DOCX, CSV, XLS, XLSX)").setInputFiles(TEXT_PDF);
  await page.getByRole("button", { name: "Create job" }).click();

  await expect(page.getByRole("banner")).toContainText("sample-clinical-note.pdf");
  await page.getByRole("button", { name: "2. Configure" }).click();
  await page.getByRole("button", { name: "3. Review" }).click();

  // The exact intended text of the fixture is on the review surface.
  await expect(page.getByRole("group", { name: "Document text with detections" })).toContainText(
    PDF_TEXT
  );
});

test("a scanned PDF without text layer fails explicitly and creates no job", async ({ page }) => {
  await page.goto("/");
  await page
    .getByLabel("Select files (TXT, PDF, DOCX, CSV, XLS, XLSX)")
    .setInputFiles(SCANNED_PDF);
  await page.getByRole("button", { name: "Create job" }).click();

  const alert = page.getByRole("alert");
  await expect(alert).toBeVisible();
  await expect(alert).toContainText("no extractable text");
  await expect(alert).toContainText("scan");

  // Fail-closed: no silent empty success, no job fabricated.
  await expect(page.getByRole("banner")).toContainText("No job yet");
});
