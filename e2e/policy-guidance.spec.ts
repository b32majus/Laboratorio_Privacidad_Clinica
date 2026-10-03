/**
 * Job-aware Privacy Policy guidance browser oracle (GitHub #56 / POLICY-01).
 *
 * Deterministic, locally runnable browser evidence for the POLICY-01 contract:
 *
 *  1. user-visible availability by job kind in a real browser: on a text job
 *     the External AI / Longitudinal Research options are disabled and their
 *     guidance reads "Not available for this job type yet", while Standard /
 *     Strict are enabled and read "Available"; on a structured job all four
 *     options are enabled and all four read "Available";
 *  2. normal-text WCAG AA (>= 4.5:1) contrast on the changed policy guidance
 *     surfaces, measured against the ACTUAL composited background with the
 *     shared `e2e/harness/contrast.ts` helper (never re-implemented here);
 *  3. no horizontal page overflow at 375 / 768 / 1280 px for the policy
 *     workspace, mirroring the overflow pattern in `gate-export-ux.spec.ts`.
 *
 * The auto no-network fixture from ./harness/fixtures applies to every test.
 */
import type { Page } from "@playwright/test";
import path from "node:path";

import { expect, test } from "./harness/fixtures";
import { expectContrast, type ContrastResult } from "./harness/contrast";
import { assertNoHorizontalOverflow } from "./harness/viewport";

const STRUCTURED_CSV = path.resolve(__dirname, "fixtures/policy-structured.csv");

const TEXT_FIXTURE = "Informe de consulta externa. Diagnostico: hipertension arterial controlada.";

const POLICY_NAMES = ["Standard", "External AI", "Longitudinal Research", "Strict"] as const;

async function createTextJob(page: Page): Promise<void> {
  await page.goto("/");
  await page.getByLabel("Paste text").fill(TEXT_FIXTURE);
  await page.getByRole("button", { name: "Create job" }).click();
  await expect(page.getByRole("banner")).toContainText("Text job");
}

async function createStructuredJob(page: Page): Promise<void> {
  await page.goto("/");
  await page
    .getByLabel("Select files (TXT, PDF, DOCX, CSV, XLS, XLSX)")
    .setInputFiles(STRUCTURED_CSV);
  await page.getByRole("button", { name: "Create job" }).click();
  await expect(page.getByRole("banner")).toContainText("Structured job");
}

/** One rendered guidance card, located from the visible contract only. */
function guidanceItem(page: Page, name: string) {
  return page
    .getByRole("list", { name: "Privacy Policy guidance" })
    .getByRole("listitem")
    .filter({ has: page.getByText(name, { exact: true }) });
}

test("text job: unavailable policies are disabled and shown unavailable, Standard / Strict available", async ({
  page,
}) => {
  await createTextJob(page);

  const select = page.getByLabel("Privacy Policy:");
  const option = (name: string) => select.getByRole("option", { name });
  // Assert the reflected DOM property, the actual selectability contract.
  await expect(option("Standard")).toHaveJSProperty("disabled", false);
  await expect(option("Strict")).toHaveJSProperty("disabled", false);
  await expect(option("External AI")).toHaveJSProperty("disabled", true);
  await expect(option("Longitudinal Research")).toHaveJSProperty("disabled", true);

  await expect(guidanceItem(page, "Standard")).toContainText("Available");
  await expect(guidanceItem(page, "Strict")).toContainText("Available");
  await expect(guidanceItem(page, "External AI")).toContainText(
    "Not available for this job type yet"
  );
  await expect(guidanceItem(page, "Longitudinal Research")).toContainText(
    "Not available for this job type yet"
  );
});

test("structured job: all four policies are selectable and shown available", async ({ page }) => {
  await createStructuredJob(page);

  const select = page.getByLabel("Privacy Policy:");
  for (const name of POLICY_NAMES) {
    await expect(select.getByRole("option", { name })).toHaveJSProperty("disabled", false);
    // "Available" is capitalised; the unavailable string spells "available"
    // lower-case, so this cannot silently match the unavailable state.
    await expect(guidanceItem(page, name)).toContainText("Available");
    await expect(guidanceItem(page, name)).not.toContainText("Not available");
  }
});

test("changed policy guidance normal text meets WCAG AA against the rendered composited background", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await createTextJob(page);

  const region = page.getByRole("region", { name: "Privacy Policy" });
  const measured: ContrastResult[] = [];

  const pairs = [
    {
      label: "Policy guidance heading",
      locator: region.getByRole("heading", { level: 2, name: "Privacy Policy", exact: true }),
    },
    { label: "Policy guidance intro", locator: region.locator("p").first() },
    { label: "Current policy line", locator: region.locator("p").nth(1) },
    {
      label: "Availability badge",
      locator: guidanceItem(page, "Standard").getByText("Available", { exact: true }),
    },
    {
      label: "Standard guidance body",
      locator: guidanceItem(page, "Standard").locator("p").last(),
    },
    {
      label: "Unavailable guidance body",
      locator: guidanceItem(page, "External AI").locator("p").last(),
    },
  ];
  for (const pair of pairs) {
    measured.push(await expectContrast(pair.locator, pair.label));
  }

  // The oracle is not vacuous: every changed surface was actually measured.
  expect(measured.length).toBeGreaterThanOrEqual(6);
});

for (const width of [375, 768, 1280]) {
  test(`policy guidance workspace fits the viewport without horizontal overflow at ${width}px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 900 });

    // No-job state.
    await page.goto("/");
    await assertNoHorizontalOverflow(page, `no-job policy workspace @${width}px`);

    // Text job (all four guidance cards, two of them unavailable).
    await createTextJob(page);
    await assertNoHorizontalOverflow(page, `text-job policy workspace @${width}px`);

    // Structured job (all four available, patient-ID requirement line).
    await createStructuredJob(page);
    await assertNoHorizontalOverflow(page, `structured-job policy workspace @${width}px`);
  });
}
