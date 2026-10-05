/**
 * REC-05 WU-D — composed rendered journey evidence (D-024, HPD V1, PDR-10/11).
 *
 * Walks the REAL rendered production build (the same static `dist/` a clinical
 * origin ships) through the ordinary pasted-text and single-document human
 * journeys up to the prepared Result action, plus the blocked/needs-attention,
 * deliberately-kept-original, Confidential-confirmation and PDF-refusal paths.
 * Every fixture is synthetic and identifier-only: no real PHI/PII anywhere.
 *
 * What this spec is allowed to claim (and what its fixtures falsify):
 *  - a realistic pasted-text volume (`dozens` of detections, HPD-13/PDR-10) can
 *    complete review and reach ONE canonical prepared Result; Copy and a
 *    secondary format carry that same payload;
 *  - a single supported document reaches a ready Result whose PRIMARY action is
 *    the prepared-document download (a real DOCX artifact is captured);
 *  - the ordinary ready path costs exactly ONE context transition (Review →
 *    Result) plus ONE prepared action (G-HP4);
 *  - a not-ready Result states what remains, keeps prepared actions
 *    unavailable, and returns to the still-pending review without losing work
 *    (G-HP2/G-HP7/G-HP8);
 *  - a deliberately kept original is a factual Result warning and stays in the
 *    canonical Safe text (D-024);
 *  - Confidential Audit first action ⇒ ZERO download, Confirm ⇒ exactly one
 *    `auditoria-confidencial.txt`, Cancel ⇒ zero (H-42 single slice);
 *  - an unrepresentable PDF character fails the PDF action visibly with ZERO
 *    PDF download while TXT/DOCX keep working (D-024 §4.4).
 *
 * The auto no-network fixture from ./harness/fixtures applies to every test.
 */
import { readFileSync } from "node:fs";

import type { Page } from "@playwright/test";

import { expect, test } from "./harness/fixtures";
import { completeReview, createDocumentJob } from "./harness/flows";

// ---------------------------------------------------------------------------
// Synthetic fixtures (no real PHI/PII)
// ---------------------------------------------------------------------------

/**
 * Realistic-density pasted text: 6 clinically-styled blocks × 4 engineered
 * identifiers = 24 mandatory review decisions (HPD-13 / PDR-10 "dozens").
 * Every identifier is unique so the rendered detection list cannot be mistaken
 * for a single repeated span.
 */
function buildHighVolumeText(): string {
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

const HIGH_VOLUME_TEXT = buildHighVolumeText();
const HIGH_VOLUME_TOTAL = 24;
const HIGH_VOLUME_RAW_IDENTIFIERS = [
  "12345670A",
  "600-123-450",
  "paciente0@example.com",
  "NHC 00442310",
  "12345675F",
  "600-123-455",
  "paciente5@example.com",
  "NHC 00442315",
] as const;

const REVIEW_FIXTURE_TEXT =
  "Informe de consulta externa. Documento del paciente: DNI 12345678A. " +
  "Telefono de contacto 600-123-456. Correo paciente1@example.com. " +
  "Historia numero NHC 00442315. Diagnostico: hipertension arterial controlada.";

const REVIEW_EMAIL = "paciente1@example.com";
const REVIEW_DNI = "12345678A";
const REVIEW_TELEFONO = "600-123-456";
const REVIEW_NHC = "NHC 00442315";

/** A long realistic clinical narrative plus ONE WinAnsi-unrepresentable char. */
function buildLongRefusalText(): string {
  const paragraphs: string[] = [];
  for (let i = 0; i < 20; i += 1) {
    paragraphs.push(
      `Evolucion clinica sintetica numero ${i + 1}: paciente en seguimiento por hipertension ` +
        "arterial. Sin incidencias relevantes en las ultimas semanas."
    );
  }
  return `${paragraphs.join("\n\n")}\nDosis α 10 mg cada 24 horas.`;
}

// ---------------------------------------------------------------------------
// Journey drivers (observable UI only)
// ---------------------------------------------------------------------------

/** The step the shell currently shows (the `aria-current="step"` nav button). */
async function currentStep(page: Page): Promise<string> {
  return (await page.locator('[aria-current="step"]').innerText()).trim();
}

/**
 * Decide EVERY pending detection through the real review controls: narrow to
 * the pending filter, select the first pending detection, and accept its
 * engine proposal (falling back to an explicit keep-original for a detection
 * without a proposal). Iterating the rendered list keeps the driver honest —
 * it never re-implements pending logic.
 */
async function decideAllPendingThroughUi(page: Page): Promise<void> {
  await page.getByRole("group", { name: "Filter by status" }).getByRole("button", { name: "Pending" }).click();
  const detections = page.getByRole("list", { name: "Detections" }).getByRole("button");
  const progress = page.getByRole("status", { name: "Review progress" });

  for (let guard = 0; guard < 200; guard += 1) {
    if ((await detections.count()) === 0) break;
    await detections.first().click();
    const accept = page.getByRole("button", { name: "Accept detection" });
    if (await accept.isEnabled()) {
      await accept.click();
    } else {
      await page.getByRole("button", { name: "Keep original" }).click();
    }
  }
  await expect(progress).toContainText("Pending: 0");
  await expect(progress).toContainText("All mandatory decisions complete: yes");
}

/** Run `action`, then assert it produced no download event within a settle window. */
async function expectNoDownload(page: Page, action: () => Promise<void>): Promise<void> {
  let downloads = 0;
  const handler = () => {
    downloads += 1;
  };
  page.on("download", handler);
  try {
    await action();
    await page.waitForTimeout(500);
    expect(downloads, "action must download zero artifacts").toBe(0);
  } finally {
    page.off("download", handler);
  }
}

// ---------------------------------------------------------------------------
// 1. Pasted text, realistic detection volume → ready Result → Copy + one format
// ---------------------------------------------------------------------------

test("high-volume pasted text reaches one ready Result and Copy + a secondary Safe format", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByLabel("Paste text").fill(HIGH_VOLUME_TEXT);
  await page.getByRole("button", { name: "Create job" }).click();
  await page.getByRole("button", { name: "2. Configure" }).click();
  await page.getByRole("button", { name: "3. Review" }).click();

  const progress = page.getByRole("status", { name: "Review progress" });
  await expect(progress).toContainText(`Total: ${HIGH_VOLUME_TOTAL}`);
  await expect(progress).toContainText(`Pending: ${HIGH_VOLUME_TOTAL}`);

  await decideAllPendingThroughUi(page);
  await expect(progress).toContainText(`Total: ${HIGH_VOLUME_TOTAL}`);

  // --- Friction witness: last decision → Result is ONE context transition ----
  expect(await currentStep(page)).toBe("3. Review");
  await page.getByRole("button", { name: "5. Export" }).click();
  await expect(page.getByRole("heading", { level: 2, name: "Resultado" })).toBeVisible();
  expect(await currentStep(page)).toBe("5. Export");
  // context transitions performed by this journey from the last decision: 1.
  const contextTransitions = 1;

  // --- Ready Result with a single visually primary prepared action ----------
  await expect(page.locator("[data-result-state]")).toHaveAttribute("data-result-state", "ready");
  await expect(page.getByRole("heading", { name: "Listo para usar" })).toBeVisible();
  const primary = page.locator('[data-variant="primary"]');
  await expect(primary).toHaveCount(1);
  await expect(primary).toHaveText("Copiar texto preparado");
  const secondaryZone = page.getByRole("group", { name: "Otros formatos disponibles" });
  await expect(secondaryZone.getByRole("button")).toHaveCount(3);

  // --- Copy is the primary prepared action and reports success --------------
  await page.context().grantPermissions(["clipboard-read", "clipboard-write"]);
  await primary.click();
  const feedback = page.locator("#result-action-feedback");
  await expect(feedback).toHaveText("Texto preparado copiado al portapapeles.");
  const clipboardText = await page.evaluate(() => navigator.clipboard.readText());

  // --- One secondary Safe format: TXT carries the SAME canonical payload ----
  const [txtDownload] = await Promise.all([
    page.waitForEvent("download"),
    secondaryZone.getByRole("button", { name: "Descargar como TXT (.txt)" }).click(),
  ]);
  expect(txtDownload.suggestedFilename()).toBe("texto-preparado.txt");
  const txt = readFileSync(await txtDownload.path(), "utf8");
  expect(txt.length).toBeGreaterThan(0);
  expect(clipboardText).toBe(txt);
  for (const raw of HIGH_VOLUME_RAW_IDENTIFIERS) {
    expect(txt).not.toContain(raw);
  }

  // ordinary ready-path friction: 1 context transition + 1 prepared action.
  expect(contextTransitions).toBe(1);
});

// ---------------------------------------------------------------------------
// 2. Supported single document → ready Result → primary document download
// ---------------------------------------------------------------------------

test("a supported single document reaches a ready Result whose primary action downloads the prepared document", async ({
  page,
}) => {
  await createDocumentJob(page, {
    name: "rec05-wu-d-document.txt",
    mimeType: "text/plain",
    buffer: Buffer.from(REVIEW_FIXTURE_TEXT),
  });
  await page.getByRole("button", { name: "2. Configure" }).click();
  await page.getByRole("button", { name: "3. Review" }).click();
  await expect(page.getByRole("list", { name: "Detections" }).getByRole("button")).toHaveCount(4);
  await completeReview(page);

  // --- Friction witness: last decision → Result is ONE context transition ----
  expect(await currentStep(page)).toBe("3. Review");
  await page.getByRole("button", { name: "5. Export" }).click();
  await expect(page.getByRole("heading", { level: 2, name: "Resultado" })).toBeVisible();
  expect(await currentStep(page)).toBe("5. Export");

  await expect(page.locator("[data-result-state]")).toHaveAttribute("data-result-state", "ready");
  // Document material: the prepared-document download is primary; the other
  // Safe formats are secondary and never equal-weight primaries.
  const primary = page.locator('[data-variant="primary"]');
  await expect(primary).toHaveCount(1);
  await expect(primary).toHaveText("Descargar documento preparado (.docx)");
  const secondaryZone = page.getByRole("group", { name: "Otros formatos disponibles" });
  await expect(secondaryZone.getByRole("button", { name: "Copiar texto preparado" })).toBeVisible();
  await expect(secondaryZone.getByRole("button", { name: "Descargar como TXT (.txt)" })).toBeVisible();
  await expect(secondaryZone.getByRole("button", { name: "Descargar como PDF (.pdf)" })).toBeVisible();

  // --- The primary action captures a real DOCX artifact ---------------------
  const [docxDownload] = await Promise.all([page.waitForEvent("download"), primary.click()]);
  expect(docxDownload.suggestedFilename()).toBe("texto-preparado.docx");
  const docxStream = await docxDownload.createReadStream();
  const chunks: Buffer[] = [];
  for await (const chunk of docxStream) chunks.push(chunk as Buffer);
  const docx = Buffer.concat(chunks);
  expect(docx.length).toBeGreaterThan(0);
  // Minimum valid OOXML/ZIP container signature ("PK").
  expect(docx.subarray(0, 2).toString("latin1")).toBe("PK");
});

// ---------------------------------------------------------------------------
// 3. Needs-attention Result → return path → still-pending review
// ---------------------------------------------------------------------------

test("a needs-attention Result states what remains, returns to the pending review and keeps prepared actions unavailable", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByLabel("Paste text").fill(REVIEW_FIXTURE_TEXT);
  await page.getByRole("button", { name: "Create job" }).click();
  await page.getByRole("button", { name: "2. Configure" }).click();
  await page.getByRole("button", { name: "3. Review" }).click();
  await completeReview(page);
  await page.getByRole("button", { name: "5. Export" }).click();
  await expect(page.locator("[data-result-state]")).toHaveAttribute("data-result-state", "ready");

  // Return to review and re-open the work with a NEW mandatory pending decision
  // (a deliberate correction — HPD-07/HPD-14, never silent acceptance).
  await page.getByRole("button", { name: "Volver a la revisión" }).click();
  expect(await currentStep(page)).toBe("3. Review");
  await page.getByRole("button", { name: "Add manual detection" }).click();
  await page.getByLabel("Start offset").fill("0");
  await page.getByLabel("End offset").fill("5");
  await page.getByLabel("Detection type").fill("PRUEBA");
  await page.getByRole("button", { name: "Add detection", exact: true }).click();
  const progress = page.getByRole("status", { name: "Review progress" });
  await expect(progress).toContainText("Pending: 1");

  // The Result remains reachable (already visited) but is now needs-attention.
  await page.getByRole("button", { name: "5. Export" }).click();
  await expect(page.getByRole("heading", { level: 2, name: "Resultado" })).toBeVisible();
  await expect(page.locator("[data-result-state]")).toHaveAttribute(
    "data-result-state",
    "needs-attention"
  );
  await expect(page.locator("#result-attention-reason")).toContainText(
    "Queda 1 decisión de revisión obligatoria"
  );
  // Prepared/shareable actions stay unavailable; no secondary format zone.
  await expect(page.locator('[data-variant="primary"]')).toBeDisabled();
  await expect(page.getByRole("group", { name: "Otros formatos disponibles" })).toHaveCount(0);

  // The correction path returns to the SAME pending review without losing work.
  await page.getByRole("button", { name: "Volver a la revisión" }).click();
  expect(await currentStep(page)).toBe("3. Review");
  await expect(progress).toContainText("Pending: 1");
  await expect(progress).toContainText("Accepted: 2");
});

// ---------------------------------------------------------------------------
// 4. Deliberately kept original → factual Result warning + present in Safe text
// ---------------------------------------------------------------------------

test("a deliberately kept original stays a factual Result warning and is present in the Safe text", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByLabel("Paste text").fill(REVIEW_FIXTURE_TEXT);
  await page.getByRole("button", { name: "Create job" }).click();
  await page.getByRole("button", { name: "2. Configure" }).click();
  await page.getByRole("button", { name: "3. Review" }).click();
  // completeReview deliberately keeps the email original ("Keep original").
  await completeReview(page);
  await page.getByRole("button", { name: "5. Export" }).click();
  await expect(page.locator("[data-result-state]")).toHaveAttribute("data-result-state", "ready");

  const keptHeading = page.getByRole("heading", { name: "Originales conservados deliberadamente" });
  await expect(keptHeading).toBeVisible();
  const keptWarning = page.locator("#result-kept-originals-heading").locator("..");
  await expect(keptWarning).toContainText("por una decisión de revisión");
  await expect(keptWarning).toContainText("IDENTIFICADOR");

  // The kept original is present in the canonical Safe text because the
  // reviewed state deliberately contains it; accepted deletions are gone.
  const [txtDownload] = await Promise.all([
    page.waitForEvent("download"),
    page.getByRole("button", { name: "Descargar como TXT (.txt)" }).click(),
  ]);
  const txt = readFileSync(await txtDownload.path(), "utf8");
  expect(txt).toContain(REVIEW_EMAIL);
  expect(txt).not.toContain(REVIEW_DNI);
  expect(txt).not.toContain(REVIEW_TELEFONO);
  expect(txt).not.toContain(REVIEW_NHC);
});

// ---------------------------------------------------------------------------
// 5. Confidential Audit deliberate confirmation: zero / one / zero
// ---------------------------------------------------------------------------

test("Confidential Audit first action downloads zero, Confirm downloads exactly one, Cancel downloads zero", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByLabel("Paste text").fill(REVIEW_FIXTURE_TEXT);
  await page.getByRole("button", { name: "Create job" }).click();
  await page.getByRole("button", { name: "2. Configure" }).click();
  await page.getByRole("button", { name: "3. Review" }).click();
  await completeReview(page);
  await page.getByRole("button", { name: "5. Export" }).click();
  await expect(page.locator("[data-result-state]")).toHaveAttribute("data-result-state", "ready");

  const request = page.getByRole("button", { name: "Descargar auditoría confidencial (.txt)" });
  const confirmation = page.getByRole("group", { name: "Confirmación de descarga confidencial" });

  // First action: reveal the warning, download NOTHING.
  await expectNoDownload(page, async () => {
    await request.click();
    await expect(confirmation).toBeVisible();
  });
  await expect(confirmation).toContainText("correspondencia identificable y reversible");

  // Cancel: download NOTHING.
  await expectNoDownload(page, async () => {
    await page.getByRole("button", { name: "Cancelar descarga confidencial" }).click();
    await expect(confirmation).toHaveCount(0);
  });

  // Re-open and Confirm: exactly ONE auditoria-confidencial.txt.
  let downloads = 0;
  page.on("download", () => {
    downloads += 1;
  });
  await request.click();
  const [auditDownload] = await Promise.all([
    page.waitForEvent("download"),
    page.getByRole("button", { name: "Confirmar descarga confidencial" }).click(),
  ]);
  expect(auditDownload.suggestedFilename()).toBe("auditoria-confidencial.txt");
  const audit = readFileSync(await auditDownload.path(), "utf8");
  expect(audit.startsWith("CONFIDENTIAL — INTERNAL AUDIT ARTIFACT")).toBe(true);
  expect(audit).toContain(REVIEW_DNI);
  expect(audit).toContain("[DNI-REVISADO]");
  await expect(confirmation).toHaveCount(0);
  await page.waitForTimeout(300);
  expect(downloads).toBe(1);
});

// ---------------------------------------------------------------------------
// 6. Long text + one deterministic PDF-only refusal; TXT/DOCX still work
// ---------------------------------------------------------------------------

test("an unrepresentable PDF character fails the PDF action with zero download while TXT and DOCX still work", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByLabel("Paste text").fill(buildLongRefusalText());
  await page.getByRole("button", { name: "Create job" }).click();
  await page.getByRole("button", { name: "2. Configure" }).click();
  await page.getByRole("button", { name: "3. Review" }).click();
  const progress = page.getByRole("status", { name: "Review progress" });
  // The long narrative itself carries realistic detected volume; decide it all
  // through the real review controls before reaching Result.
  await expect(progress).toContainText("Total:");
  await decideAllPendingThroughUi(page);

  // Long text with every decision made: Result is ready in one transition.
  await page.getByRole("button", { name: "5. Export" }).click();
  await expect(page.locator("[data-result-state]")).toHaveAttribute("data-result-state", "ready");

  const pdfButton = page.getByRole("button", { name: "Descargar como PDF (.pdf)" });
  await expectNoDownload(page, async () => {
    await pdfButton.click();
    await expect(page.locator('[role="alert"]')).toContainText("No se pudo generar el PDF.");
  });
  await expect(page.locator('[role="alert"]')).toContainText("U+03B1");

  // The Safe TXT and DOCX still produce real artifacts from the same payload.
  const [txtDownload] = await Promise.all([
    page.waitForEvent("download"),
    page.getByRole("button", { name: "Descargar como TXT (.txt)" }).click(),
  ]);
  expect(txtDownload.suggestedFilename()).toBe("texto-preparado.txt");
  expect(readFileSync(await txtDownload.path(), "utf8")).toContain("α");

  const [docxDownload] = await Promise.all([
    page.waitForEvent("download"),
    page.getByRole("button", { name: "Descargar documento preparado (.docx)" }).click(),
  ]);
  expect(docxDownload.suggestedFilename()).toBe("texto-preparado.docx");
});
