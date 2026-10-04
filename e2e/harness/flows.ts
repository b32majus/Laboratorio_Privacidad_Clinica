/**
 * Shared E2E flow drivers (UX-CLOSEOUT-01).
 *
 * Hoisted from per-spec copies so browser oracles reuse ONE driver set instead
 * of maintaining parallel copies. `gate-export-ux.spec.ts` and
 * `policy-guidance.spec.ts` now import these; new closeout evidence imports the
 * same helpers. Only the visible UI contract is encoded here (labels, step
 * names, contours); no assertion is weakened by moving it.
 */
import { expect, type Locator, type Page } from "@playwright/test";

/** A file the input picker accepts: a committed path or an in-memory payload. */
export type FileInput = string | { name: string; mimeType: string; buffer: Buffer };

/** Synthetic text with no identifiers (persistent shell / policy states). */
export const PLAIN_TEXT_FIXTURE =
  "Informe de consulta externa. Diagnostico: hipertension arterial controlada.";

/** Synthetic text with the four known identifiers used by the review flow. */
export const REVIEW_FIXTURE_TEXT =
  "Informe de consulta externa. Documento del paciente: DNI 12345678A. " +
  "Telefono de contacto 600-123-456. Correo paciente1@example.com. " +
  "Historia numero NHC 00442315. Diagnostico: hipertension arterial controlada.";

export const REVIEW_DNI = "12345678A";
export const REVIEW_TELEFONO = "600-123-456";
export const REVIEW_EMAIL = "paciente1@example.com";
export const REVIEW_NHC = "NHC 00442315";

/** Select one or more files through the canonical input picker. */
export async function selectFiles(
  page: Page,
  files: FileInput | readonly FileInput[]
): Promise<void> {
  await page
    .getByLabel("Select files (TXT, PDF, DOCX, CSV, XLS, XLSX)")
    .setInputFiles(files as string | string[]);
}

/** Create a text job from the plain fixture and assert the shell fact. */
export async function createTextJob(page: Page): Promise<void> {
  await page.goto("/");
  await page.getByLabel("Paste text").fill(PLAIN_TEXT_FIXTURE);
  await page.getByRole("button", { name: "Create job" }).click();
  await expect(page.getByRole("banner")).toContainText("Text job");
}

/** Create a single-document job and assert the shell fact. */
export async function createDocumentJob(page: Page, file: FileInput): Promise<void> {
  await page.goto("/");
  await selectFiles(page, file);
  await page.getByRole("button", { name: "Create job" }).click();
  await expect(page.getByRole("banner")).toContainText("Document job");
}

/** Create a document-batch job and assert the shell fact. */
export async function createBatchJob(page: Page, files: readonly FileInput[]): Promise<void> {
  await page.goto("/");
  await selectFiles(page, files);
  await page.getByRole("button", { name: "Create job" }).click();
  await expect(page.getByRole("banner")).toContainText("Document batch");
}

/** Create a structured job from a committed CSV and assert the shell fact. */
export async function createStructuredJob(page: Page, csvPath: string): Promise<void> {
  await page.goto("/");
  await selectFiles(page, csvPath);
  await page.getByRole("button", { name: "Create job" }).click();
  await expect(page.getByRole("banner")).toContainText("Structured job");
}

/** The Privacy Policy guidance list (POLICY-01 workspace). */
export function policyGuidanceList(page: Page): Locator {
  return page.getByRole("list", { name: "Privacy Policy guidance" });
}

/** One rendered guidance card, located from the visible contract only. */
export function guidanceItem(page: Page, name: string): Locator {
  return policyGuidanceList(page)
    .getByRole("listitem")
    .filter({ has: page.getByText(name, { exact: true }) });
}

/** Enter Review through the canonical text flow and wait for the detections. */
export async function gotoReviewWithDetections(page: Page): Promise<void> {
  await page.goto("/");
  await page.getByLabel("Paste text").fill(REVIEW_FIXTURE_TEXT);
  await page.getByRole("button", { name: "Create job" }).click();
  await page.getByRole("button", { name: "2. Configure" }).click();
  await page.getByRole("button", { name: "3. Review" }).click();
  await expect(page.getByRole("list", { name: "Detections" }).getByRole("button")).toHaveCount(4);
}

/** Apply the terminal decisions to the four known detections of the text flow. */
export async function completeReview(page: Page): Promise<void> {
  const detections = page.getByRole("list", { name: "Detections" });
  const select = async (label: RegExp) => {
    await detections.getByRole("button", { name: label }).click();
  };
  await select(new RegExp(REVIEW_DNI));
  await page.getByLabel("Replacement").fill("[DNI-REVISADO]");
  await page.getByRole("button", { name: "Apply modification" }).click();
  await select(new RegExp(REVIEW_EMAIL.replace(".", "\\.")));
  await page.getByRole("button", { name: "Keep original" }).click();
  await select(new RegExp(REVIEW_TELEFONO));
  await page.getByRole("button", { name: "Accept detection" }).click();
  await select(new RegExp(REVIEW_NHC));
  await page.getByRole("button", { name: "Accept detection" }).click();
  await expect(page.getByRole("status", { name: "Review progress" })).toContainText("Pending: 0");
}

/** Complete the whole text flow and land on Export. */
export async function gotoExportComplete(page: Page): Promise<void> {
  await gotoReviewWithDetections(page);
  await completeReview(page);
  await page.getByRole("button", { name: "4. Privacy Gate" }).click();
  const exportButton = page.getByRole("button", { name: "5. Export" });
  await expect(exportButton).toBeEnabled();
  await exportButton.click();
  await expect(page.getByRole("heading", { level: 2, name: "Export" })).toBeVisible();
}
