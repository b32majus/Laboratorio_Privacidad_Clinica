/**
 * Structured Unknown review gate E2E (Work Order T21 #25; SPEC_V4_QUALITY_
 * SECURITY_DEPLOY.md §1 E2E list, D-009/D-012).
 *
 * Synthetic committed CSV fixture whose "CampoLibre1" column has no header or
 * content evidence, so the canonical classifier proposes `unknown`. Covered
 * contracts:
 *  - Unknown is surfaced as "Review required" and the structured export gate
 *    stays CLOSED (fail-closed; Unknown is never KEEP);
 *  - the ONLY way out is an explicit reviewer classification through the
 *    domain-backed override control — the test creates no second
 *    classification authority and asserts the gate fact after the override.
 */
import { expect, test } from "./harness/fixtures";

import fs from "node:fs";
import path from "node:path";

const CSV = path.resolve(__dirname, "fixtures/structured-unknown.csv");

test("a structured Unknown column keeps the export gate closed until explicitly classified", async ({
  page,
}) => {
  await page.goto("/");
  await page
    .getByLabel("Select files (TXT, PDF, DOCX, CSV, XLS, XLSX)")
    .setInputFiles(CSV);
  await page.getByRole("button", { name: "Create job" }).click();
  await page.getByRole("button", { name: "2. Configure" }).click();

  await expect(page.locator("header")).toContainText("Structured job");
  // The structured Configure workspace IS the structured review surface.
  const summary = page.getByRole("status", { name: "Structured configuration facts" });
  await expect(summary).toContainText("Columns: 3");
  await expect(summary).toContainText("Columns requiring review: 1");
  await expect(summary).toContainText("Structured export ready: No");

  const freeColumn = page
    .getByRole("list", { name: "Column classification list" })
    .locator("li")
    .filter({ hasText: "CampoLibre1" });
  await expect(freeColumn).toContainText("Review required");
  await expect(freeColumn).toContainText("Classification:Unknown");
  await expect(freeColumn).toContainText("Proposed action:Review required");

  // Fail-closed gate message: unknown is never kept or exported as-is.
  await expect(
    page.getByRole("alert", { name: "Structured export block reasons" })
  ).toContainText("Structured export is blocked while 1 column requires review.");

  // Explicit reviewer classification through the domain override control.
  await freeColumn
    .getByLabel("Reviewer classification for CampoLibre1")
    .selectOption("insensitive");
  await expect(summary).toContainText("Columns requiring review: 0");
  await expect(summary).toContainText("Structured export ready: Yes");
  await expect(page.getByRole("alert")).toHaveCount(0);
  await expect(freeColumn).toContainText("Classification:Insensitive (reviewer override)");

  // HARDEN-01 WU-A: reach the gate and export the Safe CSV + separate Confidential.
  await page.getByRole("button", { name: "3. Review" }).click();
  await page.getByRole("button", { name: "4. Privacy Gate" }).click();
  await expect(
    page.getByRole("status", { name: "Structured export facts" })
  ).toContainText("Unsupported columns: 0");
  await page.getByRole("button", { name: "5. Export" }).click();

  const safeDownloadPromise = page.waitForEvent("download");
  await page
    .getByRole("button", { name: "Download Safe Structured Output (.csv)" })
    .click();
  const safeDownload = await safeDownloadPromise;
  const safeCsv = fs.readFileSync((await safeDownload.path())!, "utf8");
  // Nombre (identifier) is removed; Diagnostico (sensitive) is codified.
  expect(safeCsv.split("\n")[0]).toBe("CampoLibre1,Diagnostico");
  expect(safeCsv).not.toContain("Ana");
  expect(safeCsv).not.toContain("Luis");
  expect(safeCsv).not.toContain("Gripe A");
  expect(safeCsv).not.toContain("Fractura");

  const auditDownloadPromise = page.waitForEvent("download");
  await page
    .getByRole("button", { name: "Download Structured Confidential Audit (.txt)" })
    .click();
  const auditDownload = await auditDownloadPromise;
  const audit = fs.readFileSync((await auditDownload.path())!, "utf8");
  expect(audit).toContain("CONFIDENTIAL");
  expect(audit).toContain("Gripe A");
  expect(audit).toContain("Ana");
});
