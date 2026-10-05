/**
 * Review / Safe Output / Confidential Audit contracts E2E (Work Order T21 #25;
 * SPEC_V4_QUALITY_SECURITY_DEPLOY.md §1 E2E list, D-004/D-005/D-009).
 *
 * Observable behavior only, driven through the real UI and asserted against
 * the real authorities (ReviewSession-derived gate, downloads): the test does
 * NOT re-implement pending logic, final text computation or detection
 * internals. The synthetic fixture is fully known, so the expected Safe
 * Output is derived here by plain string surgery on the fixture itself and
 * must equal the artifact byte-for-byte.
 *
 * Contracts covered:
 *  - a modified decision appears in the final output;
 *  - a restored/kept original appears ONLY because it was explicitly kept
 *    (kept-original semantics, never framed or treated as a leak);
 *  - a manual detection affects the final output;
 *  - mandatory pending review blocks the export gate (fail-closed);
 *  - Safe Output contains no prohibited raw fixture PII and no
 *    correspondence/audit artifact content;
 *  - Confidential Audit is distinctly labelled and carries the mapping.
 */
import { readFileSync } from "node:fs";

import { expect, test } from "./harness/fixtures";

const FIXTURE_TEXT =
  "Informe de consulta externa. Documento del paciente: DNI 12345678A. " +
  "Telefono de contacto 600-123-456. Correo paciente1@example.com. Historia numero NHC 00442315. " +
  "Diagnostico: hipertension arterial controlada. Se pauta enalapril 10 mg cada 24 horas.";

const DNI = "12345678A";
const TELEFONO = "600-123-456";
const EMAIL = "paciente1@example.com";
const NHC = "NHC 00442315";
const MANUAL_SPAN = "enalapril";
const DNI_REPLACEMENT = "[DNI-REVISADO]";
const MANUAL_REPLACEMENT = "[FARMACO-REVISADO]";

/** Apply the exact decisions of this spec to the fixture text. */
function expectedSafeOutput(): string {
  return FIXTURE_TEXT.replace(DNI, DNI_REPLACEMENT)
    .replace(TELEFONO, "")
    .replace(NHC, "")
    .replace(MANUAL_SPAN, MANUAL_REPLACEMENT);
}

test("review decisions drive the export gate and the canonical Safe Output", async ({ page }) => {
  await page.goto("/");
  await page.getByLabel("Paste text").fill(FIXTURE_TEXT);
  await page.getByRole("button", { name: "Create job" }).click();
  await page.getByRole("button", { name: "2. Configure" }).click();
  await page.getByRole("button", { name: "3. Review" }).click();

  const progress = page.getByRole("status", { name: "Review progress" });
  const detections = page.getByRole("list", { name: "Detections" }).getByRole("button");

  // The engine found exactly the four known identifiers of the fixture.
  await expect(detections).toHaveCount(4);
  await expect(progress).toContainText("Total: 4");
  await expect(progress).toContainText("Pending: 4");
  await expect(progress).toContainText("All mandatory decisions complete: no");

  // --- Export gate is fail-closed while decisions are pending -------------
  await page.getByRole("button", { name: "4. Privacy Gate" }).click();
  await expect(page.getByRole("alert")).toContainText(
    "Safe export is blocked while 4 mandatory review decisions are pending."
  );
  await page.getByRole("button", { name: "3. Review" }).click();

  const selectDetection = (label: RegExp) =>
    page.getByRole("list", { name: "Detections" }).getByRole("button", { name: label }).click();

  // Modified: the reviewer rewrites the DNI replacement.
  await selectDetection(new RegExp(DNI));
  await page.getByLabel("Replacement").fill(DNI_REPLACEMENT);
  await page.getByRole("button", { name: "Apply modification" }).click();
  await expect(progress).toContainText("Modified: 1");

  // Restored: the email original is EXPLICITLY kept by reviewer decision.
  await selectDetection(new RegExp(EMAIL.replace(".", "\\.")));
  await page.getByRole("button", { name: "Keep original" }).click();
  await expect(progress).toContainText("Restored: 1");

  // Accepted: phone and NHC disappear from the final text (deletion proposals).
  await selectDetection(new RegExp(TELEFONO.replace("-", "-")));
  await page.getByRole("button", { name: "Accept detection" }).click();
  await selectDetection(new RegExp(NHC));
  await page.getByRole("button", { name: "Accept detection" }).click();
  await expect(progress).toContainText("Pending: 0");

  // --- Manual detection affects the final output --------------------------
  await page.getByRole("button", { name: "Add manual detection" }).click();
  await page.getByLabel("Start offset").fill(String(FIXTURE_TEXT.indexOf(MANUAL_SPAN)));
  await page.getByLabel("End offset").fill(String(FIXTURE_TEXT.indexOf(MANUAL_SPAN) + MANUAL_SPAN.length));
  await page.getByLabel("Detection type").fill("FARMACO");
  await page.getByRole("button", { name: "Add detection", exact: true }).click();
  await expect(progress).toContainText("Total: 5");
  await expect(progress).toContainText("Manual: 1");
  await expect(progress).toContainText("Pending: 1");

  await selectDetection(new RegExp(MANUAL_SPAN));
  await page.getByLabel("Replacement").fill(MANUAL_REPLACEMENT);
  await page.getByRole("button", { name: "Apply modification" }).click();

  await expect(progress).toContainText("All mandatory decisions complete: yes");

  // --- Privacy Gate: factual summary with kept-original warnings ----------
  await page.getByRole("button", { name: "4. Privacy Gate" }).click();
  await expect(page.getByRole("alert")).toHaveCount(0);
  const warnings = page.getByRole("list", { name: "Kept-original warnings" });
  await expect(warnings).toContainText("Kept original");
  const summary = page.getByRole("group", { name: "Review summary facts" });
  await expect(summary).toContainText("2 accepted, 2 modified");
  await expect(summary).toContainText("Kept originals (restored): 1");

  // --- Export: two separate artifacts -------------------------------------
  await page.getByRole("button", { name: "5. Export" }).click();
  const safeButton = page.getByRole("button", { name: "Descargar como TXT (.txt)" });
  await expect(safeButton).toBeEnabled();
  await expect(
    page.getByRole("button", { name: "Download Confidential Audit (.txt)" })
  ).toBeEnabled();
  await expect(page.getByText("CONFIDENTIAL — INTERNAL AUDIT ARTIFACT")).toBeVisible();

  const [safeDownload] = await Promise.all([
    page.waitForEvent("download"),
    safeButton.click(),
  ]);
  expect(safeDownload.suggestedFilename()).toBe("texto-preparado.txt");
  const safeOutput = readFileSync(await safeDownload.path(), "utf8");

  // Byte-exact derivation from the final review state: modified and manual
  // replacements present, accepted deletions gone.
  expect(safeOutput).toBe(expectedSafeOutput());
  // No prohibited raw fixture PII remains.
  expect(safeOutput).not.toContain(DNI);
  expect(safeOutput).not.toContain(TELEFONO);
  expect(safeOutput).not.toContain(NHC);
  // The email appears ONLY because the reviewer explicitly restored it
  // (kept-original semantics); it must not be treated as a leak.
  expect(safeOutput).toContain(EMAIL);
  // No audit artifact content may ride along on the safe artifact.
  expect(safeOutput).not.toContain("CONFIDENTIAL");

  const [auditDownload] = await Promise.all([
    page.waitForEvent("download"),
    page.getByRole("button", { name: "Download Confidential Audit (.txt)" }).click(),
  ]);
  expect(auditDownload.suggestedFilename()).toBe("confidential-audit.txt");
  const audit = readFileSync(await auditDownload.path(), "utf8");

  // Distinctly labelled, carries the original↔replacement mapping.
  expect(audit.startsWith("CONFIDENTIAL — INTERNAL AUDIT ARTIFACT")).toBe(true);
  expect(audit).toContain(DNI);
  expect(audit).toContain(DNI_REPLACEMENT);
  expect(audit).not.toBe(safeOutput);
});
