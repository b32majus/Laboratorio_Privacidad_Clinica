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
const SCANNED_PDF = path.resolve(__dirname, "../app-v4/src/input/fixtures/sample-scanned.pdf");

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
  await expect(docList.filter({ hasText: "batch-doc-1.txt" })).toContainText("Completado");

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

  // Viewing documents changes nothing: both stay Requiere revisión.
  await expect(progress).toContainText("Pending: 1");
  await docList.getByRole("button", { name: /batch-doc-2\.txt/ }).click();
  await docList.getByRole("button", { name: /batch-doc-1\.txt/ }).click();
  await expect(docList.filter({ hasText: "batch-doc-2.txt" })).toContainText("Requiere revisión");
  await expect(docList.filter({ hasText: "batch-doc-1.txt" })).toContainText("Requiere revisión");

  // First document completed — the batch is still not complete.
  await page
    .getByRole("list", { name: "Detections" })
    .getByRole("button", { name: /12345678A/ })
    .click();
  await page.getByRole("button", { name: "Accept detection" }).click();
  await expect(docList.filter({ hasText: "batch-doc-1.txt" })).toContainText("Completado");
  await expect(docList.filter({ hasText: "batch-doc-2.txt" })).toContainText("Requiere revisión");

  // Complete the second document: the batch review is now truly complete.
  await docList.getByRole("button", { name: /batch-doc-2\.txt/ }).click();
  await page
    .getByRole("list", { name: "Detections" })
    .getByRole("button", { name: /87654321B/ })
    .click();
  await page.getByRole("button", { name: "Accept detection" }).click();
  await expect(docList.filter({ hasText: "batch-doc-2.txt" })).toContainText("Completado");

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

test("batch failure recovery (#78): acknowledge and remove act only on the failed item and never fabricate readiness", async ({
  page,
}) => {
  await page.goto("/");
  await page
    .getByLabel("Select files (TXT, PDF, DOCX, CSV, XLS, XLSX)")
    .setInputFiles([DOC_1, CORRUPT_PDF, DOC_2]);
  await page.getByRole("button", { name: "Create job" }).click();
  await page.getByRole("button", { name: "2. Configure" }).click();
  await page.getByRole("button", { name: "3. Review" }).click();

  const docList = page.getByRole("list", { name: "Batch document status" });
  const failedRow = docList.getByRole("listitem").filter({ hasText: "corrupt.pdf" });

  // A read failure keeps no retained text, so NO retry is offered (fail-closed).
  await expect(failedRow).toContainText("Error");
  await expect(failedRow.getByRole("button", { name: "Reintentar" })).toHaveCount(0);

  // Realistic failure-recovery journey (handoff §10, correction F4c): the
  // UNRELATED documents carry completed review decisions BEFORE any recovery
  // action, so the assertions below can falsify loss of pre-existing work.
  await page
    .getByRole("list", { name: "Detections" })
    .getByRole("button", { name: /12345678A/ })
    .click();
  await page.getByRole("button", { name: "Accept detection" }).click();
  await expect(docList.filter({ hasText: "batch-doc-1.txt" })).toContainText("Completado");
  await docList.getByRole("button", { name: /batch-doc-2\.txt/ }).click();
  await page
    .getByRole("list", { name: "Detections" })
    .getByRole("button", { name: /87654321B/ })
    .click();
  await page.getByRole("button", { name: "Accept detection" }).click();
  await expect(docList.filter({ hasText: "batch-doc-2.txt" })).toContainText("Completado");

  // Acknowledge is immediate and never claims resolution: the control
  // reflects the JOB fact (only a real mutation removes it), the error stays
  // visible and the fact is never presented as resolution.
  await failedRow.getByRole("button", { name: "Reconocer error" }).click();
  await expect(failedRow.getByRole("button", { name: "Reconocer error" })).toHaveCount(0);
  await expect(failedRow).toContainText("Error reconocido");
  await expect(failedRow).toContainText("Error");
  await expect(failedRow.getByRole("button", { name: "Reintentar" })).toHaveCount(0);

  // Removal: the first action only REVEALS the consequence; Cancel is zero
  // mutation and the failure stays active.
  await failedRow.getByRole("button", { name: "Retirar del lote" }).click();
  const confirmGroup = failedRow.getByRole("group", {
    name: /Confirmar la retirada de corrupt\.pdf/,
  });
  await expect(confirmGroup).toContainText("los demás documentos no se verán afectados");
  await confirmGroup.getByRole("button", { name: "Cancelar" }).click();
  await expect(confirmGroup).toHaveCount(0);
  await expect(failedRow).toContainText("Error");
  await expect(failedRow).not.toContainText("Retirado del lote");

  // Confirmed removal applies exactly once: the disposition is visible, the
  // recovery actions are gone, and the failure message is retained verbatim.
  await failedRow.getByRole("button", { name: "Retirar del lote" }).click();
  await failedRow.getByRole("button", { name: "Confirmar retirada" }).click();
  await expect(failedRow).toContainText("Retirado del lote");
  // The acknowledged fact (recorded before the removal) stays part of the
  // retained history; the recovery actions are gone.
  await expect(failedRow).toContainText("Error reconocido");
  await expect(failedRow.getByRole("button", { name: "Reconocer error" })).toHaveCount(0);
  await expect(failedRow.getByRole("button", { name: "Retirar del lote" })).toHaveCount(0);

  // The pre-existing review decisions SURVIVED every recovery action
  // (correction F4c): both unrelated documents are still completed.
  await expect(docList.filter({ hasText: "batch-doc-1.txt" })).toContainText("Completado");
  await expect(docList.filter({ hasText: "batch-doc-2.txt" })).toContainText("Completado");

  // Privacy Gate: the removed item is factual history ("Failed: 1" keeps it,
  // "Retirado del lote" names the disposition) but it is NO longer an active
  // blocker, so the fail-closed batch-failure alert is gone; the acknowledged
  // fact stays visible.
  await page.getByRole("button", { name: "4. Privacy Gate" }).click();
  await expect(page.getByRole("group", { name: "Batch item counts" })).toContainText(
    "Completed: 2"
  );
  await expect(page.getByRole("group", { name: "Batch item counts" })).toContainText("Failed: 1");
  const batchItems = page.getByRole("list", { name: "Batch item status" });
  await expect(batchItems).toContainText("Retirado del lote");
  await expect(batchItems).toContainText("Error reconocido");
  await expect(page.getByRole("alert").filter({ hasText: "a batch item failed" })).toHaveCount(0);

  // Export: with no active failure and no pending review, the remaining
  // reason is the accepted no-batch-format limitation; both downloads stay
  // disabled (a resolved failure never fabricates batch readiness).
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

test("batch failure recovery (#78): an all-failed batch with every item removed never asserts review completion (correction F1)", async ({
  page,
}) => {
  await page.goto("/");
  // Both documents fail their read: an ALL-FAILED batch.
  await page
    .getByLabel("Select files (TXT, PDF, DOCX, CSV, XLS, XLSX)")
    .setInputFiles([CORRUPT_PDF, SCANNED_PDF]);
  await page.getByRole("button", { name: "Create job" }).click();
  await page.getByRole("button", { name: "2. Configure" }).click();
  await page.getByRole("button", { name: "3. Review" }).click();

  const docList = page.getByRole("list", { name: "Batch document status" });
  await expect(docList).toContainText("corrupt.pdf");
  await expect(docList).toContainText("sample-scanned.pdf");

  // No session exists, so the Spanish empty state shows; it stays factual,
  // advertises only per-row recovery and never instructs job recreation
  // (correction F5).
  await expect(page.getByText(/No hay ningún documento disponible para revisión/)).toBeVisible();
  await expect(page.getByText(/acciones de recuperación que cada uno ofrece/)).toBeVisible();
  await expect(page.getByText(/Create a new job/)).toHaveCount(0);
  await expect(page.getByText(/crear un nuevo trabajo/i)).toHaveCount(0);

  // Remove EVERY failed item through the confirmed flow.
  for (const name of ["corrupt.pdf", "sample-scanned.pdf"]) {
    const row = docList.getByRole("listitem").filter({ hasText: name });
    await row.getByRole("button", { name: "Retirar del lote" }).click();
    await row.getByRole("button", { name: "Confirmar retirada" }).click();
    await expect(row).toContainText("Retirado del lote");
    await expect(row).toContainText("Error");
    await expect(row.getByRole("button", { name: "Reconocer error" })).toHaveCount(0);
    await expect(row.getByRole("button", { name: "Retirar del lote" })).toHaveCount(0);
  }

  // Privacy Gate boundary: with nothing pending, no active failure and no job
  // error, the checkpoint still NEVER asserts review completion (no
  // evaluable document remains) and never re-blocks on the resolved failures.
  await page.getByRole("button", { name: "4. Privacy Gate" }).click();
  const checkpoint = page.getByRole("region", { name: "Decision checkpoint" });
  await expect(checkpoint).toContainText("Action required");
  await expect(checkpoint).not.toContainText("Review complete");
  await expect(checkpoint).toContainText("No batch document remains available for review");
  await expect(checkpoint).toContainText("deliberately removed");
  await expect(checkpoint).not.toContainText("Every mandatory review decision is recorded");
  await expect(page.getByRole("alert").filter({ hasText: "a batch item failed" })).toHaveCount(0);
  const counts = page.getByRole("group", { name: "Batch item counts" });
  await expect(counts).toContainText("Failed: 2");
  await expect(counts).toContainText("Pending: 0");
  await expect(counts).toContainText("Completed: 0");
  await expect(page.getByRole("list", { name: "Batch item status" })).toContainText(
    "Retirado del lote"
  );

  // Downloads remain unavailable as before: the export step stays gated by
  // the authoritative (false) review completeness.
  const exportButton = page.getByRole("button", { name: "5. Export" });
  await expect(exportButton).toBeDisabled();
  await expect(exportButton).toHaveAttribute(
    "title",
    "Export is blocked while mandatory review is incomplete."
  );
});
