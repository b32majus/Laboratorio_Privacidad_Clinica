/**
 * Document-batch contracts E2E (Work Order T21 #25; SPEC_V4_QUALITY_SECURITY_
 * DEPLOY.md §1 E2E list, D-011).
 *
 * Synthetic committed fixtures: two valid TXT documents and one corrupt PDF.
 * Covered contracts:
 *  - a failed batch item stays VISIBLE (input failures section, review
 *    document list, privacy gate) and is never hidden;
 *  - review completion is real per-document state: navigating between
 *    documents never marks anything reviewed, and one document's completed
 *    review never completes the batch;
 *  - even a fully reviewed batch has no fabricated batch-wide output: both
 *    download actions stay disabled with the typed spec reason.
 */
import { expect, test } from "./harness/fixtures";

import path from "node:path";

const FIXTURES_DIR = path.resolve(__dirname, "fixtures");
const DOC_1 = path.join(FIXTURES_DIR, "batch-doc-1.txt");
const DOC_2 = path.join(FIXTURES_DIR, "batch-doc-2.txt");
const CORRUPT_PDF = path.resolve(__dirname, "../app-v4/src/input/fixtures/corrupt.pdf");

test("a failed batch item stays visible and never blocks the rest of the batch silently", async ({
  page,
}) => {
  await page.goto("/");
  await page
    .getByLabel("Select files (TXT, PDF, DOCX, CSV, XLS, XLSX)")
    .setInputFiles([DOC_1, CORRUPT_PDF, DOC_2]);
  await page.getByRole("button", { name: "Create job" }).click();

  // Input phase: the failed read is surfaced immediately, by name.
  await expect(page.getByRole("list", { name: "Failed documents" })).toContainText("corrupt.pdf");
  await page.getByRole("button", { name: "2. Configure" }).click();
  await page.getByRole("button", { name: "3. Review" }).click();

  const docList = page.getByRole("list", { name: "Batch document status" });
  // The failed item stays listed in review, with its status and error.
  await expect(docList).toContainText("corrupt.pdf");
  await expect(docList).toContainText("Error");

  // Document 1 review: a real decision on its own session.
  const progress = page.getByRole("status", { name: "Review progress" });
  await expect(progress).toContainText("Pending: 1");
  await page
    .getByRole("list", { name: "Detections" })
    .getByRole("button", { name: /12345678A/ })
    .click();
  await page.getByRole("button", { name: "Accept detection" }).click();
  await expect(docList.filter({ hasText: "batch-doc-1.txt" })).toContainText("Completed");

  // Privacy Gate: the failed item and the real per-item counts are factual.
  await page.getByRole("button", { name: "4. Privacy Gate" }).click();
  const batchCounts = page.getByRole("group", { name: "Batch item counts" });
  await expect(batchCounts).toContainText("Failed: 1");
  await expect(batchCounts).toContainText("Pending: 1");
  await expect(page.getByRole("alert").last()).toContainText("a batch item failed");
  await expect(page.getByRole("alert").last()).toContainText("corrupt.pdf");

  // Export stays inaccessible while the batch review is incomplete (the
  // disabled control itself carries the blocked reason).
  const exportButton = page.getByRole("button", { name: "5. Export" });
  await expect(exportButton).toBeDisabled();
  await expect(exportButton).toHaveAttribute(
    "title",
    "Export is blocked while mandatory review is incomplete."
  );
});

test("navigation never fabricates review completion and a reviewed batch has no fabricated output", async ({
  page,
}) => {
  await page.goto("/");
  await page
    .getByLabel("Select files (TXT, PDF, DOCX, CSV, XLS, XLSX)")
    .setInputFiles([DOC_1, DOC_2]);
  await page.getByRole("button", { name: "Create job" }).click();
  await page.getByRole("button", { name: "2. Configure" }).click();
  await page.getByRole("button", { name: "3. Review" }).click();

  const docList = page.getByRole("list", { name: "Batch document status" });
  const progress = page.getByRole("status", { name: "Review progress" });

  // Viewing documents changes nothing: both stay Review required.
  await expect(progress).toContainText("Pending: 1");
  await docList.getByRole("button", { name: /batch-doc-2\.txt/ }).click();
  await docList.getByRole("button", { name: /batch-doc-1\.txt/ }).click();
  await expect(docList.filter({ hasText: "batch-doc-2.txt" })).toContainText("Review required");
  await expect(docList.filter({ hasText: "batch-doc-1.txt" })).toContainText("Review required");

  // First document completed — the batch is still not complete.
  await page
    .getByRole("list", { name: "Detections" })
    .getByRole("button", { name: /12345678A/ })
    .click();
  await page.getByRole("button", { name: "Accept detection" }).click();
  await expect(docList.filter({ hasText: "batch-doc-1.txt" })).toContainText("Completed");
  await expect(docList.filter({ hasText: "batch-doc-2.txt" })).toContainText("Review required");

  // Complete the second document: the batch review is now truly complete.
  await docList.getByRole("button", { name: /batch-doc-2\.txt/ }).click();
  await page
    .getByRole("list", { name: "Detections" })
    .getByRole("button", { name: /87654321B/ })
    .click();
  await page.getByRole("button", { name: "Accept detection" }).click();
  await expect(docList.filter({ hasText: "batch-doc-2.txt" })).toContainText("Completed");

  // A completed batch review is NOT a batch output: the accepted spec defines
  // no batch-wide format, so both downloads stay disabled with that reason.
  await page.getByRole("button", { name: "4. Privacy Gate" }).click();
  await expect(page.getByRole("group", { name: "Batch item counts" })).toContainText(
    "Completed: 2"
  );
  await page.getByRole("button", { name: "5. Export" }).click();
  const safeButton = page.getByRole("button", { name: "Download Safe Output (.txt)" });
  await expect(safeButton).toBeDisabled();
  await expect(page.locator("#safe-output-blocked-reason")).toContainText(
    "does not define a batch Safe Output format"
  );
  await expect(
    page.getByRole("button", { name: "Download Confidential Audit (.txt)" })
  ).toBeDisabled();
});
