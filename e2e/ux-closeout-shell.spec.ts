/**
 * UX-CLOSEOUT-01 transversal browser evidence (GitHub #63 / audit #62).
 *
 * Focused, falsifiable closeout evidence for the shell and flow coherence work
 * after WU-A (task-first hierarchy + honest states), WU-B (mobile Review route
 * + structured density) and WU-C (batch Gate copy). It observes the rendered
 * production UI only — no source-string snapshots — and reuses the shared
 * drivers in `./harness/flows` and the overflow oracle in `./harness/viewport`
 * instead of re-implementing them. The auto no-network fixture applies to every
 * test.
 *
 * Covered acceptance:
 *  3. all four Job kinds traverse the canonical steps in one shell;
 *  4. no horizontal overflow at 375/768/1280 for the changed states;
 *  5. mobile selection routes directly to the decision controls; desktop stays
 *     three-column and the mobile route is hidden;
 *  7. the rendered UI contains no migration-placeholder copy;
 *  8. all four POLICY-01 facts remain discoverable and job-aware;
 *  9. structured blockers / UNKNOWN / current classification / date role /
 *     patient-ID authority survive the density disclosure, fail-closed.
 */
import path from "node:path";
import type { Page } from "@playwright/test";

import { expect, test } from "./harness/fixtures";
import { assertNoHorizontalOverflow } from "./harness/viewport";
import {
  REVIEW_FIXTURE_TEXT,
  completeReview,
  createBatchJob,
  createDocumentJob,
  createStructuredJob,
  createTextJob,
  guidanceItem,
  gotoReviewWithDetections,
  policyGuidanceList,
} from "./harness/flows";

const FIXTURES_DIR = path.resolve(__dirname, "fixtures");
const DOC_1 = path.join(FIXTURES_DIR, "batch-doc-1.txt");
const DOC_2 = path.join(FIXTURES_DIR, "batch-doc-2.txt");
const STRUCTURED_CSV = path.join(FIXTURES_DIR, "structured-unknown.csv");

/** A single document with the same four known identifiers as the text flow. */
const DOCUMENT_FILE = {
  name: "ux-closeout-document.txt",
  mimeType: "text/plain",
  buffer: Buffer.from(REVIEW_FIXTURE_TEXT),
};

/**
 * Migration-residue copy that must not survive WU-A. Deliberately broader than
 * the two literal placeholders so an "equivalent" phrasing is also caught.
 */
const MIGRATION_COPY = /not implemented yet|later V4 migration|arrives with a later V4/i;

const POLICY_NAMES = ["Standard", "External AI", "Longitudinal Research", "Strict"] as const;

/** The rendered body must never carry migration-residue copy. */
async function expectNoMigrationCopy(page: Page, label: string): Promise<void> {
  await expect(page.locator("body"), `migration copy on ${label}`).not.toContainText(MIGRATION_COPY);
}

// ---------------------------------------------------------------------------
// Acceptance 3 (and 7): all four Job kinds traverse the canonical steps.
// ---------------------------------------------------------------------------

test.describe("canonical flow traversal by Job kind", () => {
  test("text job: Input → Configure (honest) → Review → Privacy Gate → Export", async ({
    page,
  }) => {
    await gotoReviewWithDetections(page); // Input → Configure → Review

    // Configure is an honest no-additional-configuration state, not a placeholder.
    await page.getByRole("button", { name: "2. Configure" }).click();
    await expect(page.getByRole("heading", { name: "Configure" })).toBeVisible();
    await expect(
      page.getByText(/No additional configuration is required for a text job/i)
    ).toBeVisible();
    await expectNoMigrationCopy(page, "text Configure");

    await page.getByRole("button", { name: "3. Review" }).click();
    await expect(page.getByRole("list", { name: "Detections" })).toBeVisible();
    await completeReview(page);

    await page.getByRole("button", { name: "4. Privacy Gate" }).click();
    await expect(page.getByRole("region", { name: "Decision checkpoint" })).toContainText(
      "Review complete"
    );
    await expectNoMigrationCopy(page, "text Privacy Gate");

    await page.getByRole("button", { name: "5. Export" }).click();
    await expect(page.getByRole("heading", { level: 2, name: "Export" })).toBeVisible();
    await expectNoMigrationCopy(page, "text Export");
  });

  test("document job: honest Configure and the canonical steps", async ({ page }) => {
    await createDocumentJob(page, DOCUMENT_FILE);

    await page.getByRole("button", { name: "2. Configure" }).click();
    await expect(
      page.getByText(/No additional configuration is required for a document job/i)
    ).toBeVisible();
    await expectNoMigrationCopy(page, "document Configure");

    await page.getByRole("button", { name: "3. Review" }).click();
    await expect(page.getByRole("list", { name: "Detections" }).getByRole("button")).toHaveCount(4);
    await completeReview(page);

    await page.getByRole("button", { name: "4. Privacy Gate" }).click();
    await expect(page.getByRole("region", { name: "Decision checkpoint" })).toContainText(
      "Review complete"
    );
    await page.getByRole("button", { name: "5. Export" }).click();
    await expect(page.getByRole("heading", { level: 2, name: "Export" })).toBeVisible();
  });

  test("document-batch job: honest Configure, Review and a fail-closed Gate", async ({ page }) => {
    await createBatchJob(page, [DOC_1, DOC_2]);

    await page.getByRole("button", { name: "2. Configure" }).click();
    await expect(
      page.getByText(/No additional configuration is required for a document batch/i)
    ).toBeVisible();
    await expectNoMigrationCopy(page, "batch Configure");

    await page.getByRole("button", { name: "3. Review" }).click();
    await expect(page.getByRole("list", { name: "Batch document status" })).toBeVisible();
    // Wait for the async batch review to install its sessions before leaving
    // Review (the start writes the job back to the Review step).
    await expect(page.getByRole("status", { name: "Review progress" })).toContainText("Pending:");

    await page.getByRole("button", { name: "4. Privacy Gate" }).click();
    await expect(page.getByRole("group", { name: "Batch item counts" })).toContainText("Failed: 0");
    await expect(page.getByRole("region", { name: "Decision checkpoint" })).toContainText(
      "Action required"
    );
    await expectNoMigrationCopy(page, "batch Privacy Gate");
    // No accepted batch format exists: Export stays blocked while review is pending.
    await expect(page.getByRole("button", { name: "5. Export" })).toBeDisabled();
  });

  test("structured job: structured Configure, its Review notice and the structured Gate", async ({
    page,
  }) => {
    await createStructuredJob(page, STRUCTURED_CSV);

    await page.getByRole("button", { name: "2. Configure" }).click();
    await expect(page.getByRole("status", { name: "Structured configuration facts" })).toBeVisible();
    await expectNoMigrationCopy(page, "structured Configure");

    await page.getByRole("button", { name: "3. Review" }).click();
    await expect(page.getByText(/Structured review happens in Configure/i)).toBeVisible();
    await expectNoMigrationCopy(page, "structured Review");

    await page.getByRole("button", { name: "4. Privacy Gate" }).click();
    await expect(page.getByRole("status", { name: "Structured export facts" })).toBeVisible();
  });
});

// ---------------------------------------------------------------------------
// Acceptance 4: no horizontal overflow for the changed states.
// ---------------------------------------------------------------------------

for (const width of [375, 768, 1280]) {
  test(`changed closeout states fit the viewport without horizontal overflow at ${width}px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 900 });

    // Honest unstructured Configure.
    await createTextJob(page);
    await page.getByRole("button", { name: "2. Configure" }).click();
    await expect(page.getByText(/No additional configuration is required/i)).toBeVisible();
    await assertNoHorizontalOverflow(page, `unstructured Configure @${width}px`);

    // Active Review, including a mobile selection state.
    await gotoReviewWithDetections(page);
    await assertNoHorizontalOverflow(page, `active Review @${width}px`);
    await page.getByRole("list", { name: "Detections" }).getByRole("button").first().click();
    await assertNoHorizontalOverflow(page, `Review selection @${width}px`);

    // Pending Gate.
    await page.getByRole("button", { name: "4. Privacy Gate" }).click();
    await expect(page.getByRole("region", { name: "Decision checkpoint" })).toBeVisible();
    await assertNoHorizontalOverflow(page, `pending Gate @${width}px`);

    // Completed Gate + Export.
    await page.getByRole("button", { name: "3. Review" }).click();
    await completeReview(page);
    await page.getByRole("button", { name: "4. Privacy Gate" }).click();
    await assertNoHorizontalOverflow(page, `completed Gate @${width}px`);
    await page.getByRole("button", { name: "5. Export" }).click();
    await expect(page.getByRole("heading", { level: 2, name: "Export" })).toBeVisible();
    await assertNoHorizontalOverflow(page, `Export @${width}px`);

    // Structured Review notice.
    await createStructuredJob(page, STRUCTURED_CSV);
    await page.getByRole("button", { name: "2. Configure" }).click();
    await page.getByRole("button", { name: "3. Review" }).click();
    await expect(page.getByText(/Structured review happens in Configure/i)).toBeVisible();
    await assertNoHorizontalOverflow(page, `structured Review @${width}px`);
  });
}

// ---------------------------------------------------------------------------
// Acceptance 5: mobile action path; desktop stays three-column.
// ---------------------------------------------------------------------------

test("mobile selection routes directly to the decision controls without recording a decision", async ({
  page,
}) => {
  await page.setViewportSize({ width: 375, height: 900 });
  await gotoReviewWithDetections(page);

  const progress = page.getByRole("status", { name: "Review progress" });
  await expect(progress).toContainText("Pending: 4");

  await page.getByRole("list", { name: "Detections" }).getByRole("button").first().click();

  const jump = page.locator('button:has-text("Go to decision controls for the selected detection")');
  await expect(jump).toBeVisible();
  await jump.click();

  // Focus is handed to the inspector, so the decision controls are directly operable.
  const inspector = page.getByRole("complementary", { name: "Entity inspector" });
  await expect(inspector).toBeFocused();
  await expect(inspector.getByRole("button", { name: "Accept detection" })).toBeVisible();

  // The route is navigation only: selection never records a decision.
  await expect(progress).toContainText("Pending: 4");
});

test("desktop Review stays three-column and hides the mobile route", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await gotoReviewWithDetections(page);
  await page.getByRole("list", { name: "Detections" }).getByRole("button").first().click();

  const workspace = page.getByRole("region", { name: "Review workspace" });
  await expect(workspace).toHaveClass(/lg:grid-cols-3/);
  // The token is load-bearing: at 1280px the grid really renders three columns.
  const columnCount = await workspace.evaluate(
    (element) => getComputedStyle(element).gridTemplateColumns.split(" ").length
  );
  expect(columnCount).toBe(3);

  const jump = page.locator('button:has-text("Go to decision controls for the selected detection")');
  await expect(jump).toBeHidden();
});

// ---------------------------------------------------------------------------
// Acceptance 8 (and 7): POLICY-01 facts remain discoverable and job-aware.
// ---------------------------------------------------------------------------

for (const width of [375, 1280]) {
  test(`POLICY-01 facts remain discoverable and job-aware at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });

    const region = page.getByRole("region", { name: "Privacy Policy" });
    const list = policyGuidanceList(page);

    // No job: four entries and an honest no-availability note.
    await page.goto("/");
    await expect(list.getByRole("listitem")).toHaveCount(4);
    await expect(region).toContainText(
      "Create a job to see which policies are available for its type."
    );

    // Text job: all four entries, both availability states, current policy.
    await createTextJob(page);
    await expect(list.getByRole("listitem")).toHaveCount(4);
    await expect(guidanceItem(page, "Standard")).toContainText("Available");
    await expect(guidanceItem(page, "Strict")).toContainText("Available");
    await expect(guidanceItem(page, "External AI")).toContainText(
      "Not available for this job type yet"
    );
    await expect(guidanceItem(page, "Longitudinal Research")).toContainText(
      "Not available for this job type yet"
    );
    await expect(region).toContainText("Current policy: Standard");

    // Structured job: all four available and the patient-ID requirement is
    // job-aware (present exactly for the per-patient shift policies).
    await createStructuredJob(page, STRUCTURED_CSV);
    await expect(list.getByRole("listitem")).toHaveCount(4);
    for (const name of POLICY_NAMES) {
      await expect(guidanceItem(page, name)).toContainText("Available");
    }
    await expect(region).toContainText("Current policy: Standard");
    await expect(guidanceItem(page, "External AI")).toContainText(
      "Requires an explicit patient-ID column."
    );
    await expect(guidanceItem(page, "Longitudinal Research")).toContainText(
      "Requires an explicit patient-ID column."
    );
    await expect(guidanceItem(page, "Standard")).not.toContainText(
      "Requires an explicit patient-ID column."
    );
    await expectNoMigrationCopy(page, `policy workspace @${width}px`);
  });
}

// ---------------------------------------------------------------------------
// Acceptance 9 (and 7): structured authority survives the density disclosure.
// ---------------------------------------------------------------------------

test("structured Configure keeps UNKNOWN, blockers and authority facts reachable with the disclosure closed and open", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await createStructuredJob(page, STRUCTURED_CSV);
  await page.getByRole("button", { name: "2. Configure" }).click();

  const summary = page.getByRole("status", { name: "Structured configuration facts" });
  await expect(summary).toContainText("Columns requiring review: 1");
  await expect(summary).toContainText("Structured export ready: No");

  // Fail-closed blocker is visible without opening any disclosure.
  await expect(
    page.getByRole("alert", { name: "Structured export block reasons" })
  ).toContainText("Structured export is blocked while 1 column requires review.");

  const freeColumn = page
    .getByRole("list", { name: "Column classification list" })
    .locator("li")
    .filter({ hasText: "CampoLibre1" });

  // Authority facts that must never read as a false-ready state:
  await expect(freeColumn).toContainText("Review required");
  await expect(freeColumn).toContainText("Classification:Unknown");
  await expect(freeColumn.getByText("Date role:")).toBeVisible();

  // Secondary evidence is only behind the disclosure, and is reachable when opened.
  await expect(freeColumn.getByText("Proposed action:")).toBeHidden();
  await freeColumn.locator("summary").click();
  await expect(freeColumn.getByText("Proposed action:")).toBeVisible();
  await expect(freeColumn).toContainText("Proposed action:Review required");

  // The single patient-ID authority and its current status stay shown once.
  const authority = page.getByRole("region", { name: "Patient ID authority" });
  await expect(authority).toBeVisible();
  await expect(authority.getByLabel("Patient ID column")).toBeVisible();
  await expect(authority).toContainText(/No column selected yet|Selected:/);

  await expectNoMigrationCopy(page, "structured Configure");
});
