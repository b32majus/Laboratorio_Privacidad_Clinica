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
import {
  createStructuredJob,
  createTextJob,
  expandPolicyGuidance,
  guidanceItem,
  keepOriginalThroughUi,
} from "./harness/flows";

const STRUCTURED_CSV = path.resolve(__dirname, "fixtures/policy-structured.csv");

const POLICY_NAMES = ["Standard", "External AI", "Longitudinal Research", "Strict"] as const;

test("text job: all four policies are selectable and shown available (REC-02)", async ({
  page,
}) => {
  await createTextJob(page);
  // CORA-84-01: the detailed per-policy cards are on demand; expand the
  // disclosure before reading the availability facts.
  await expandPolicyGuidance(page);

  const select = page.getByLabel("Política de privacidad:");
  const option = (name: string) => select.getByRole("option", { name });
  // Assert the reflected DOM property, the actual selectability contract.
  for (const name of POLICY_NAMES) {
    await expect(option(name)).toHaveJSProperty("disabled", false);
    await expect(guidanceItem(page, name)).toContainText("Available");
  }
});

test("structured job: all four policies are selectable and shown available", async ({ page }) => {
  await createStructuredJob(page, STRUCTURED_CSV);
  await expandPolicyGuidance(page);

  const select = page.getByLabel("Política de privacidad:");
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
  await page.getByRole("textbox", { name: "Pegar texto" }).fill(POLICY_TEXT_FIXTURE);
  await page.getByRole("button", { name: "Crear trabajo" }).click();
  await page.getByLabel("Política de privacidad:").selectOption(policyId);
  // Quiet shell (#84): a REAL policy change invalidates the auto-started
  // session, so processing under the selected policy is an explicit restart.
  await page.getByRole("button", { name: "Iniciar revisión" }).click();
  await expect(
    page.getByRole("list", { name: "Detections" }).getByRole("button").first()
  ).toBeVisible();
}

/** The Entity Inspector's "Proposed replacement" value for the selected detection. */
function proposedReplacement(page: import("@playwright/test").Page) {
  return page.getByLabel("Entity inspector").locator('dt:text-is("Proposed replacement") + dd');
}

/**
 * #78 moved «Proposed replacement» into the collapsed «Detalles de la detección»
 * disclosure of the Entity Inspector. Open it (idempotently) before reading the
 * value; the real date transformation it reveals is asserted unchanged.
 */
async function openDetectionDetails(page: import("@playwright/test").Page): Promise<void> {
  const details = page.getByLabel("Entity inspector").locator("details");
  if (!(await details.evaluate((element) => (element as HTMLDetailsElement).open))) {
    await details.locator("summary").click();
  }
}

/** Accept/keep every pending decision until the review reports zero pending. */
async function completeAllPending(page: import("@playwright/test").Page): Promise<void> {
  const progress = page.getByRole("status", { name: "Review progress" });
  const pendingCount = progress.locator('dt:text-is("Pending:") + dd');
  await page.getByRole("button", { name: "Pending", exact: true }).click();
  for (let guard = 0; guard < 40; guard += 1) {
    if ((await pendingCount.innerText()).trim() === "0") break;
    await page.getByRole("list", { name: "Detections" }).getByRole("button").first().click();
    const accept = page.getByRole("button", { name: "Aceptar detección" });
    if (await accept.isEnabled()) await accept.click();
    else await keepOriginalThroughUi(page);
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
  await openDetectionDetails(page);
  await expect(proposedReplacement(page)).toHaveText("01/2024");

  await completeAllPending(page);
  // The completed review opens the output gate: Privacy Gate then Export.
  await page.getByRole("button", { name: "Privacy Gate" }).click();
  await expect(page.getByRole("button", { name: "Ir al resultado" })).toBeEnabled();
});

test("text job: Longitudinal Research is selected and processes with a consistent date shift (REC-02)", async ({
  page,
}) => {
  await createPolicyTextJob(page, "longitudinal-research");

  await page
    .getByRole("list", { name: "Detections" })
    .getByRole("button", { name: /FECHA/ })
    .click();
  await openDetectionDetails(page);
  const shifted = (await proposedReplacement(page).innerText()).trim();
  expect(shifted).toMatch(/^\d{2}\/\d{2}\/\d{4}$/);
  expect(shifted).not.toBe(POLICY_DATE_SOURCE);
  expect(shifted).not.toMatch(/^Visita/);

  await completeAllPending(page);
  // The completed review opens the output gate: Privacy Gate then Export.
  await page.getByRole("button", { name: "Privacy Gate" }).click();
  await expect(page.getByRole("button", { name: "Ir al resultado" })).toBeEnabled();
});

test("changed policy guidance normal text meets WCAG AA against the rendered composited background", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await createTextJob(page);
  // The detailed cards are on demand (CORA-84-01): expand so every measured
  // surface is actually rendered.
  await expandPolicyGuidance(page);

  const region = page.getByRole("region", { name: "Política de privacidad" });
  const measured: ContrastResult[] = [];

  const pairs = [
    {
      label: "Policy guidance heading",
      locator: region.getByRole("heading", {
        level: 2,
        name: "Política de privacidad",
        exact: true,
      }),
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

/**
 * CORA-84-01 responsive witness: the on-demand disclosure control itself is
 * visible, clickable and not horizontally obstructed in both states at the
 * two acceptance viewports (375×800 and 1280×800).
 */
for (const [width, height] of [
  [375, 800],
  [1280, 800],
] as const) {
  test(`policy guidance disclosure is operable and unobstructed at ${width}×${height}`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height });

    await createTextJob(page);
    const toggle = page.getByRole("button", { name: "Guía detallada de políticas" });

    // Collapsed: the control is visible, in viewport and horizontally clean.
    await expect(toggle).toBeVisible();
    await expect(toggle).toHaveAttribute("aria-expanded", "false");
    await toggle.scrollIntoViewIfNeeded();
    await expect(toggle).toBeInViewport();
    await assertNoHorizontalOverflow(page, `guidance collapsed @${width}×${height}`);

    // Expanded: clicking reveals the detailed cards and the control stays
    // operable with no horizontal obstruction.
    await toggle.click();
    await expect(toggle).toHaveAttribute("aria-expanded", "true");
    await expect(page.getByRole("list", { name: "Guía de políticas de privacidad" })).toBeVisible();
    await toggle.scrollIntoViewIfNeeded();
    await expect(toggle).toBeInViewport();
    await assertNoHorizontalOverflow(page, `guidance expanded @${width}×${height}`);

    await toggle.click();
    await expect(toggle).toHaveAttribute("aria-expanded", "false");
    await expect(page.getByRole("list", { name: "Guía de políticas de privacidad" })).toHaveCount(
      0
    );
  });
}
