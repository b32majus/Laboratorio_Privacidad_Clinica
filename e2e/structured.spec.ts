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

import path from "node:path";

const CSV = path.resolve(__dirname, "fixtures/structured-unknown.csv");

test("a structured Unknown column keeps the export gate closed until explicitly classified", async ({
  page,
}) => {
  await page.goto("/");
  await page
    .getByLabel("Or select files (TXT, PDF, DOCX, CSV, XLS, XLSX)")
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
  await expect(page.getByRole("alert")).toContainText(
    "Structured export is blocked while 1 column requires review."
  );
  await expect(page.getByRole("alert")).toContainText(
    "Unknown columns are never kept or exported as-is"
  );

  // Explicit reviewer classification through the domain override control.
  await freeColumn
    .getByLabel("Reviewer classification for CampoLibre1")
    .selectOption("insensitive");
  await expect(summary).toContainText("Columns requiring review: 0");
  await expect(summary).toContainText("Structured export ready: Yes");
  await expect(page.getByRole("alert")).toHaveCount(0);
  await expect(freeColumn).toContainText("Classification:Insensitive (reviewer override)");
});
