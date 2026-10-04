/**
 * REC-03 WU-D composed structured E2E: one synthetic multi-row Job with
 * repeated patients, visit/birth dates, a center quasi-identifier, a kept
 * diagnosis, a free-text column and a second direct identifier traverses the
 * full V4 flow `Input → Configure → Review → Privacy Gate → Export`.
 *
 * Covered contracts (D-021, no new route/page/mode/class):
 *  - Study ID + action authority + free-text review + T19 date semantics
 *    compose with no seam gaps (missing readiness facts, ungated export,
 *    stale review state);
 *  - Safe CSV carries ID_ESTUDIO linkage, transformed dates, QID tokens,
 *    reviewed free text and kept diagnosis with no originals/correspondence;
 *  - the Confidential artifact carries the allowed mappings separately;
 *  - unresolved state keeps Gate/Export closed; switching policy drops the
 *    free-text review (no stale certification) and closes the gate again;
 *  - the step navigation keeps exactly the five canonical steps.
 *
 * The auto no-network fixture from ./harness/fixtures applies to every test.
 * All content is synthetic; no real PHI anywhere.
 */
import { expect, test } from "./harness/fixtures";

import fs from "node:fs";
import path from "node:path";
import type { Page } from "@playwright/test";

const CSV = path.resolve(__dirname, "fixtures/structured-composed.csv");

async function createComposedJob(page: Page): Promise<void> {
  await page.goto("/");
  await page.getByLabel("Select files (TXT, PDF, DOCX, CSV, XLS, XLSX)").setInputFiles(CSV);
  await page.getByRole("button", { name: "Create job" }).click();
  await page.getByRole("button", { name: "2. Configure" }).click();
  await expect(page.locator("header")).toContainText("Structured job");
}

function columnCard(page: Page, header: string) {
  // Scope by the card heading: evidence items also mention the header text,
  // so a bare hasText filter would match nested evidence rows as well.
  return page
    .getByRole("list", { name: "Column classification list" })
    .locator("li")
    .filter({ has: page.getByRole("heading", { name: header, exact: true }) });
}

/** Fully configure the composed job: patient ID, date roles, free-text action. */
async function configureComposedJob(page: Page): Promise<void> {
  await page.getByLabel("Patient ID column").selectOption("NHC");
  await page.getByLabel("Date role for Fecha_Visita").selectOption("visit");
  await page.getByLabel("Date role for Fecha_Nacimiento").selectOption("birth");
  await page.getByLabel("Reviewer action for Notas").selectOption("process-as-text");
  const summary = page.getByRole("status", { name: "Structured configuration facts" });
  await expect(summary).toContainText("Columns requiring review: 0");
}

/** Decide every pending detection of the active free-text cell workspace. */
async function decideActiveCell(page: Page): Promise<void> {
  // Filter to pending detections so the first list item is always an
  // undecided one (re-clicking a decided detection would never advance).
  await page.getByRole("button", { name: "Pending", exact: true }).click();
  const workspaceProgress = page.getByRole("status", { name: "Review progress", exact: true });
  const pendingCount = workspaceProgress.locator('dt:text-is("Pending:") + dd');
  for (let guard = 0; guard < 30; guard += 1) {
    if ((await pendingCount.innerText()).trim() === "0") break;
    await page.getByRole("list", { name: "Detections" }).getByRole("button").first().click();
    const accept = page.getByRole("button", { name: "Accept detection" });
    if (await accept.isEnabled()) await accept.click();
    else await page.getByRole("button", { name: "Keep original" }).click();
  }
  await expect(pendingCount).toHaveText("0");
}

test("composed structured Job traverses Configure → Review → Privacy Gate → Export", async ({
  page,
}) => {
  await createComposedJob(page);
  const summary = page.getByRole("status", { name: "Structured configuration facts" });
  await expect(summary).toContainText("Columns: 7");
  // Unresolved quasi/date-role columns and the Unknown free-text column keep
  // the export gate closed before configuration.
  await expect(summary).toContainText("Columns requiring review: 3");
  await expect(summary).toContainText("Structured export ready: No");
  await expect(page.getByRole("alert", { name: "Structured export block reasons" })).toContainText(
    /requires review/
  );

  await configureComposedJob(page);

  // Stronger authorities visibly lock their derived action.
  await expect(columnCard(page, "NHC")).toContainText("Study ID");
  await expect(columnCard(page, "NHC")).toContainText("(derived, locked)");
  await expect(columnCard(page, "Fecha_Visita")).toContainText("Date policy");
  await expect(columnCard(page, "Centro")).toContainText("Pseudonymize");
  await expect(columnCard(page, "Diagnostico")).toContainText("Keep");
  await expect(columnCard(page, "Notas")).toContainText("Process as text");

  // No new step/mode appears: exactly the five canonical steps.
  await expect(page.getByRole("navigation", { name: "Job steps" }).getByRole("button")).toHaveCount(
    5
  );

  // Review: the free-text cells are unprocessed until the explicit run.
  await page.getByRole("button", { name: "3. Review" }).click();
  await expect(page.getByRole("status")).toContainText("not been processed yet");
  await page.getByRole("button", { name: "Process free-text cells" }).click();
  const progress = page.getByRole("status", { name: "Free-text review progress" });
  await expect(progress).toContainText("Cells: 2");

  // Decide every pending detection in both cells (row-major queue names
  // which column/row cell is under review).
  await page.getByRole("button", { name: /Notas, row 1/ }).click();
  await decideActiveCell(page);
  await page.getByRole("button", { name: /Notas, row 2/ }).click();
  await decideActiveCell(page);
  await expect(progress).toContainText("Pending decisions: 0");
  await expect(progress).toContainText("Free-text review ready: Yes");

  // Privacy Gate: the composed readiness is factual and complete.
  await page.getByRole("button", { name: "4. Privacy Gate" }).click();
  const gateFacts = page.getByRole("status", { name: "Structured export facts" });
  await expect(gateFacts).toContainText("Columns: 7");
  await expect(gateFacts).toContainText("Columns requiring review: 0");
  await expect(gateFacts).toContainText("Unsupported columns: 0");
  await expect(page.getByRole("alert")).toHaveCount(0);
  await expect(page.getByRole("region", { name: "Decision checkpoint" })).toContainText(
    "Review complete"
  );

  // Export: separate Safe CSV and Confidential Audit downloads.
  await page.getByRole("button", { name: "5. Export" }).click();
  const safeDownloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "Download Safe Structured Output (.csv)" }).click();
  const safeDownload = await safeDownloadPromise;
  const safeCsv = fs.readFileSync((await safeDownload.path())!, "utf8");
  const lines = safeCsv.split("\n");
  expect(lines[0]).toBe("ID_ESTUDIO,Fecha_Visita,Fecha_Nacimiento,Centro,Diagnostico,Notas");
  expect(lines).toHaveLength(4);
  // Repeated patients reuse the same Study ID (row linkage preserved).
  expect(lines[1].split(",")[0]).toBe("PAC_001");
  expect(lines[2].split(",")[0]).toBe("PAC_001");
  expect(lines[3].split(",")[0]).toBe("PAC_002");
  // Transformed dates/ages (T19 month precision under Standard), QID tokens,
  // kept diagnosis as configured.
  expect(safeCsv).toContain("2023-01");
  expect(safeCsv).toContain("1954-03");
  expect(safeCsv).toContain("QID_001");
  expect(safeCsv).toContain("QID_002");
  expect(safeCsv).toContain("Gripe A");
  expect(safeCsv).toContain("Fractura");
  // No originals, no removed identifier, no correspondence in Safe output.
  for (const leaked of [
    "P-001",
    "P-002",
    "12345678A",
    "87654321B",
    "2023-01-10",
    "1954-03-12",
    "Carmen Sánchez",
    "Centro Norte",
  ]) {
    expect(safeCsv).not.toContain(leaked);
  }

  const auditDownloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "Download Structured Confidential Audit (.txt)" }).click();
  const auditDownload = await auditDownloadPromise;
  const audit = fs.readFileSync((await auditDownload.path())!, "utf8");
  expect(audit).toContain("CONFIDENTIAL");
  expect(audit).toContain("P-001");
  expect(audit).toContain("PAC_001");
  expect(audit).toContain("12345678A");
  expect(audit).toContain("Centro Norte");
  // Kept columns carry no correspondence.
  expect(audit).not.toContain("Gripe A");
});

test("switching policy drops the free-text review and closes the gate (no stale certification)", async ({
  page,
}) => {
  await createComposedJob(page);
  await configureComposedJob(page);

  await page.getByRole("button", { name: "3. Review" }).click();
  await page.getByRole("button", { name: "Process free-text cells" }).click();
  await expect(page.getByRole("status", { name: "Free-text review progress" })).toContainText(
    "Cells: 2"
  );

  // A real policy change invalidates the sessions processed under the
  // previous policy: Review returns to the unprocessed state.
  await page.getByLabel("Privacy Policy:").selectOption("external-ai");
  await expect(page.getByRole("status")).toContainText("not been processed yet");
  await expect(page.getByRole("button", { name: "Process free-text cells" })).toBeVisible();

  // Configure reports the export not ready, and the Gate/Export steps stay
  // closed at the navigation level (fail-closed: no ungated export).
  await page.getByRole("button", { name: "2. Configure" }).click();
  await expect(page.getByRole("status", { name: "Structured configuration facts" })).toContainText(
    "Structured export ready: No"
  );
  await expect(page.getByRole("button", { name: "4. Privacy Gate" })).toBeDisabled();
  await expect(page.getByRole("button", { name: "5. Export" })).toBeDisabled();
});
