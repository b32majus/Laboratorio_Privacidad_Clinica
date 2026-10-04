/**
 * Job-aware Privacy Policy guidance browser oracle (GitHub #56 / POLICY-01).
 *
 * Deterministic, locally runnable browser evidence for the POLICY-01 contract:
 *
 *  1. user-visible availability by job kind in a real browser: since REC-02
 *     every accepted policy has a text/document/batch mapping, so on a text job
 *     the External AI / Longitudinal Research options are enabled and all four
 *     guidance entries read "Available"; on a structured job all four options
 *     are enabled and all four read "Available";
 *  2. normal-text WCAG AA (>= 4.5:1) contrast on the changed policy guidance
 *     surfaces, measured against the ACTUAL composited background with the
 *     shared `e2e/harness/contrast.ts` helper (never re-implemented here);
 *  3. no horizontal page overflow at 375 / 768 / 1280 px for the policy
 *     workspace, mirroring the overflow pattern in `gate-export-ux.spec.ts`.
 *
 * The auto no-network fixture from ./harness/fixtures applies to every test.
 */
import path from "node:path";

import { expect, test } from "./harness/fixtures";
import { expectContrast, type ContrastResult } from "./harness/contrast";
import { assertNoHorizontalOverflow } from "./harness/viewport";
import { createStructuredJob, createTextJob, guidanceItem } from "./harness/flows";

const STRUCTURED_CSV = path.resolve(__dirname, "fixtures/policy-structured.csv");

const POLICY_NAMES = ["Standard", "External AI", "Longitudinal Research", "Strict"] as const;

test("text job: all four policies are selectable and shown available (REC-02)", async ({
  page,
}) => {
  await createTextJob(page);

  const select = page.getByLabel("Privacy Policy:");
  const option = (name: string) => select.getByRole("option", { name });
  // Assert the reflected DOM property, the actual selectability contract.
  for (const name of POLICY_NAMES) {
    await expect(option(name)).toHaveJSProperty("disabled", false);
    await expect(guidanceItem(page, name)).toContainText("Available");
  }
});

test("structured job: all four policies are selectable and shown available", async ({ page }) => {
  await createStructuredJob(page, STRUCTURED_CSV);

  const select = page.getByLabel("Privacy Policy:");
  for (const name of POLICY_NAMES) {
    await expect(select.getByRole("option", { name })).toHaveJSProperty("disabled", false);
    // "Available" is capitalised; the unavailable string spells "available"
    // lower-case, so this cannot silently match the unavailable state.
    await expect(guidanceItem(page, name)).toContainText("Available");
    await expect(guidanceItem(page, name)).not.toContainText("Not available");
  }
});

/**
 * REC-02 selected-and-processed evidence: enabling the option is not enough.
 * These drive the real browser flow — select the policy, run Review, read the
 * policy-correct proposal from the Entity Inspector, then complete every
 * mandatory decision and prove the output gate opens. All content is synthetic.
 */
const POLICY_TEXT_FIXTURE = "Paciente: Carmen Sánchez. Analítica del 05/01/2024.";
const POLICY_DATE_SOURCE = "05/01/2024";

async function createPolicyTextJob(
  page: import("@playwright/test").Page,
  policyId: "external-ai" | "longitudinal-research"
): Promise<void> {
  await page.goto("/");
  await page.getByLabel("Paste text").fill(POLICY_TEXT_FIXTURE);
  await page.getByRole("button", { name: "Create job" }).click();
  await page.getByLabel("Privacy Policy:").selectOption(policyId);
  await page.getByRole("button", { name: "2. Configure" }).click();
  await page.getByRole("button", { name: "3. Review" }).click();
  await expect(
    page.getByRole("list", { name: "Detections" }).getByRole("button").first()
  ).toBeVisible();
}

/** The Entity Inspector's "Proposed replacement" value for the selected detection. */
function proposedReplacement(page: import("@playwright/test").Page) {
  return page.getByLabel("Entity inspector").locator('dt:text-is("Proposed replacement") + dd');
}

/** Accept/keep every pending decision until the review reports zero pending. */
async function completeAllPending(page: import("@playwright/test").Page): Promise<void> {
  const progress = page.getByRole("status", { name: "Review progress" });
  const pendingCount = progress.locator('dt:text-is("Pending:") + dd');
  await page.getByRole("button", { name: "Pending", exact: true }).click();
  for (let guard = 0; guard < 40; guard += 1) {
    if ((await pendingCount.innerText()).trim() === "0") break;
    await page.getByRole("list", { name: "Detections" }).getByRole("button").first().click();
    const accept = page.getByRole("button", { name: "Accept detection" });
    if (await accept.isEnabled()) await accept.click();
    else await page.getByRole("button", { name: "Keep original" }).click();
  }
  await expect(pendingCount).toHaveText("0");
}

test("text job: External AI is selected and processes with reduced date precision (REC-02)", async ({
  page,
}) => {
  await createPolicyTextJob(page, "external-ai");

  await page
    .getByRole("list", { name: "Detections" })
    .getByRole("button", { name: /FECHA/ })
    .click();
  await expect(proposedReplacement(page)).toHaveText("01/2024");

  await completeAllPending(page);
  // The completed review opens the output gate: Privacy Gate then Export.
  await page.getByRole("button", { name: "4. Privacy Gate" }).click();
  await expect(page.getByRole("button", { name: "5. Export" })).toBeEnabled();
});

test("text job: Longitudinal Research is selected and processes with a consistent date shift (REC-02)", async ({
  page,
}) => {
  await createPolicyTextJob(page, "longitudinal-research");

  await page
    .getByRole("list", { name: "Detections" })
    .getByRole("button", { name: /FECHA/ })
    .click();
  const shifted = (await proposedReplacement(page).innerText()).trim();
  expect(shifted).toMatch(/^\d{2}\/\d{2}\/\d{4}$/);
  expect(shifted).not.toBe(POLICY_DATE_SOURCE);
  expect(shifted).not.toMatch(/^Visita/);

  await completeAllPending(page);
  // The completed review opens the output gate: Privacy Gate then Export.
  await page.getByRole("button", { name: "4. Privacy Gate" }).click();
  await expect(page.getByRole("button", { name: "5. Export" })).toBeEnabled();
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
      label: "External AI guidance body",
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

    // Text job (all four guidance cards).
    await createTextJob(page);
    await assertNoHorizontalOverflow(page, `text-job policy workspace @${width}px`);

    // Structured job (all four available, patient-ID requirement line).
    await createStructuredJob(page, STRUCTURED_CSV);
    await assertNoHorizontalOverflow(page, `structured-job policy workspace @${width}px`);
  });
}
