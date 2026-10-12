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
import path from "node:path";

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

/** Existing REC-05 density fixture: six synthetic blocks, four identifiers each. */
export function buildHighVolumeText(): string {
  const blocks: string[] = [];
  for (let i = 0; i < 6; i += 1) {
    const dniLetter = "ABCDEFGH"[i];
    blocks.push(
      `Informe de seguimiento ${i + 1}. Documento del paciente: DNI 1234567${i}${dniLetter}. ` +
        `Telefono de contacto 600-123-45${i}. Correo paciente${i}@example.com. ` +
        `Historia numero NHC 0044231${i}. Diagnostico: hipertension arterial controlada.`
    );
  }
  return blocks.join("\n");
}

/** Select one or more files through the canonical input picker. */
export async function selectFiles(
  page: Page,
  files: FileInput | readonly FileInput[]
): Promise<void> {
  await page
    .getByLabel("Seleccionar archivos (TXT, PDF, DOCX, CSV, XLS, XLSX)")
    .setInputFiles(files as string | string[]);
}

/** Create a text job from the plain fixture and assert the shell fact. */
export async function createTextJob(page: Page): Promise<void> {
  await page.goto("/");
  await page.getByRole("textbox", { name: "Pegar texto" }).fill(PLAIN_TEXT_FIXTURE);
  await page.getByRole("button", { name: "Crear trabajo" }).click();
  // Issue #84 correction (spec F): the internal job kind is not permanent
  // header chrome, so the persistent header fact asserted here is the job NAME.
  await expect(page.getByRole("banner")).toContainText("Pasted text");
}

/** Create a single-document job and assert the real Review landing. */
export async function createDocumentJob(page: Page, file: FileInput): Promise<void> {
  await page.goto("/");
  await selectFiles(page, file);
  await page.getByRole("button", { name: "Crear trabajo" }).click();
  // Issue #84 correction: the internal kind is not header chrome; the created
  // job's landing workspace is the witness.
  await expect(page.getByRole("region", { name: "Espacio de revisión" })).toBeVisible();
}

/** Create a document-batch job and wait for the reads to settle onto Review. */
export async function createBatchJob(page: Page, files: readonly FileInput[]): Promise<void> {
  await page.goto("/");
  await selectFiles(page, files);
  await page.getByRole("button", { name: "Crear trabajo" }).click();
  // Issue #84 correction: the internal kind is not header chrome; the created
  // batch's landing workspace (installed once the reads settle) is the witness.
  await expect(page.getByRole("region", { name: "Espacio de revisión" })).toBeVisible();
}

/** Create a structured job from a committed CSV and assert the shell fact. */
export async function createStructuredJob(page: Page, csvPath: string): Promise<void> {
  await page.goto("/");
  await selectFiles(page, csvPath);
  await page.getByRole("button", { name: "Crear trabajo" }).click();
  // Issue #84 correction: the internal kind is not header chrome; the job NAME
  // (the structured file's name) is the persistent header fact.
  await expect(page.getByRole("banner")).toContainText(path.basename(csvPath));
}

/** The Privacy Policy guidance list (POLICY-01 workspace; on demand, #84 CORA-84-01). */
export function policyGuidanceList(page: Page): Locator {
  return page.getByRole("list", { name: "Guía de políticas de privacidad" });
}

/**
 * Idempotently expand the on-demand detailed policy guidance (#84 CORA-84-01).
 * The toggle's accessible name is stable across states, so this is safe to
 * call whether the disclosure is closed or already open.
 */
export async function expandPolicyGuidance(page: Page): Promise<void> {
  const toggle = page.getByRole("button", { name: "Guía detallada de políticas" });
  if ((await toggle.getAttribute("aria-expanded")) === "false") {
    await toggle.click();
  }
  await expect(policyGuidanceList(page)).toBeVisible();
}

/** One rendered guidance card, located from the visible contract only. */
export function guidanceItem(page: Page, name: string): Locator {
  return policyGuidanceList(page)
    .getByRole("listitem")
    .filter({ has: page.getByText(name, { exact: true }) });
}

/** Enter Review through the canonical text flow and wait for the detections.
 * Quiet shell (#84): job creation lands directly on Review and starts the one
 * local processing attempt, so no navigation click is needed. */
export async function gotoReviewWithDetections(page: Page): Promise<void> {
  await page.goto("/");
  await page.getByRole("textbox", { name: "Pegar texto" }).fill(REVIEW_FIXTURE_TEXT);
  await page.getByRole("button", { name: "Crear trabajo" }).click();
  await expect(page.getByRole("list", { name: "Hallazgos" }).getByRole("button")).toHaveCount(4);
}

/** Keep the selected original through the current UI, including contextual confirmation. */
export async function keepOriginalThroughUi(page: Page): Promise<void> {
  const inspector = page.getByRole("complementary", { name: "Inspector del hallazgo" });
  const decision = inspector.locator('dt:text-is("Decisión actual") + dd');
  const confirmation = inspector.getByRole("group", { name: "Confirmar mantener original" });
  await inspector.getByRole("button", { name: "Mantener original", exact: true }).click();
  await expect
    .poll(
      async () =>
        (await confirmation.isVisible()) || (await decision.innerText()) === "Original conservado"
    )
    .toBe(true);
  if ((await confirmation.count()) > 0) {
    await expect(confirmation).toBeVisible();
    await confirmation.getByRole("button", { name: "Sí, mantener original", exact: true }).click();
  }
  await expect(decision).toHaveText("Original conservado");
  await expect(confirmation).toHaveCount(0);
}

/** Apply the terminal decisions to the four known detections of the text flow. */
export async function completeReview(page: Page): Promise<void> {
  const detections = page.getByRole("list", { name: "Hallazgos" });
  const select = async (label: RegExp) => {
    await detections.getByRole("button", { name: label }).click();
  };
  await select(new RegExp(REVIEW_DNI));
  await page.getByLabel("Sustitución").fill("[DNI-REVISADO]");
  await page.getByRole("button", { name: "Aplicar modificación" }).click();
  await select(new RegExp(REVIEW_EMAIL.replace(".", "\\.")));
  await keepOriginalThroughUi(page);
  await select(new RegExp(REVIEW_TELEFONO));
  await page.getByRole("button", { name: "Aceptar detección" }).click();
  await select(new RegExp(REVIEW_NHC));
  await page.getByRole("button", { name: "Aceptar detección" }).click();
  await expect(page.getByRole("status", { name: "Progreso de la revisión" })).toContainText(
    "Pendientes: 0"
  );
}

/** Complete the whole text flow and land on Export. */
export async function gotoExportComplete(page: Page): Promise<void> {
  await gotoReviewWithDetections(page);
  await completeReview(page);
  await page.getByRole("button", { name: "Comprobación de privacidad" }).click();
  const exportButton = page.getByRole("button", { name: "Ir al resultado" });
  await expect(exportButton).toBeEnabled();
  await exportButton.click();
  await expect(page.getByRole("heading", { level: 2, name: "Resultado" })).toBeVisible();
}
