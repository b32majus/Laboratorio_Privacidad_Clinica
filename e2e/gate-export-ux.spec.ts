/**
 * Privacy Gate + Export presentation oracle (GitHub #55 / UX-PILOT-02).
 *
 * Deterministic, locally runnable browser evidence for the PRESENTATION of the
 * changed Gate + Export surfaces. It observes only the real UI (no source-string
 * snapshots) and can genuinely disagree with the implementation:
 *
 *  1. no horizontal page overflow at 375 / 768 / 1280 px, with attribution to
 *     the widest offender if any appears;
 *  2. the primary Gate/Export controls are keyboard reachable with a visible
 *     focus indicator (and Enter activates the focused download);
 *  3. normal-text foreground/background pairs on the changed surfaces meet
 *     WCAG AA >= 4.5:1 measured against the ACTUAL composited background
 *     (rgb()/rgba() including alpha blending), with the correct large-text
 *     threshold (>= 3:1 only when the rendered size/weight really is large);
 *  4. the in-page contrast/compositing helper itself is falsifiable: a planted
 *     low-contrast normal-text pair is flagged as failing, the same grey at a
 *     genuinely large size is accepted, and alpha compositing is verified.
 *
 * The auto no-network fixture from ./harness/fixtures applies to every test.
 */
import { expect, test } from "./harness/fixtures";
import { contrastOf, expectContrast, type ContrastResult } from "./harness/contrast";
import { assertNoHorizontalOverflow } from "./harness/viewport";
import {
  completeReview,
  createBatchJob,
  gotoExportComplete,
  gotoReviewWithDetections,
} from "./harness/flows";
import type { Locator, Page } from "@playwright/test";
import path from "node:path";

const BATCH_DOCS = [
  path.resolve(__dirname, "fixtures/batch-doc-1.txt"),
  path.resolve(__dirname, "fixtures/batch-doc-2.txt"),
];

const CONFIDENTIAL_WARNING_LINE = "CONFIDENTIAL — INTERNAL AUDIT ARTIFACT";

/** The changed Gate + Export surfaces and the pairs UX-PILOT-02 actually styles. */
type MeasuredPair = { readonly label: string; readonly locator: Locator };

async function gatePairs(page: Page): Promise<MeasuredPair[]> {
  return [
    { label: "Gate eyebrow", locator: page.locator("main header p").first() },
    {
      label: "Gate checkpoint body",
      locator: page.getByRole("region", { name: "Decision checkpoint" }).locator("p").first(),
    },
    {
      label: "Gate checkpoint badge",
      locator: page.getByRole("region", { name: "Decision checkpoint" }).locator("span").first(),
    },
    {
      label: "Output availability heading",
      locator: page.getByRole("heading", { name: "Output availability" }),
    },
    {
      label: "Attention facts heading",
      locator: page.getByRole("heading", { name: "Attention facts" }),
    },
    {
      label: "Attention facts body",
      locator: page.getByRole("region", { name: "Attention facts" }).locator("p").first(),
    },
    {
      label: "Kept-original warning item",
      locator: page.getByRole("list", { name: "Kept-original warnings" }).getByRole("listitem").first(),
    },
  ];
}

async function exportPairs(page: Page): Promise<MeasuredPair[]> {
  const safeRegion = page.getByRole("region", { name: "Safe Output" });
  const auditRegion = page.getByRole("region", { name: "Confidential Audit" });
  return [
    { label: "Export eyebrow", locator: page.locator("main header p").first() },
    { label: "Safe Output heading", locator: page.getByRole("heading", { name: "Safe Output", exact: true }) },
    { label: "Safe Output description", locator: safeRegion.locator("p").first() },
    {
      label: "Safe Output primary button",
      locator: page.getByRole("button", { name: "Download Safe Output (.txt)" }),
    },
    {
      label: "Confidential Audit heading (dark band)",
      locator: page.getByRole("heading", { name: "Confidential Audit", exact: true }),
    },
    {
      label: "Confidential Audit warning line",
      locator: auditRegion.getByText(CONFIDENTIAL_WARNING_LINE),
    },
    {
      label: "Confidential Audit description",
      locator: auditRegion.locator("p").nth(1),
    },
    {
      label: "Confidential Audit secondary button",
      locator: page.getByRole("button", { name: "Download Confidential Audit (.txt)" }),
    },
  ];
}

for (const width of [375, 768, 1280]) {
  test(`Gate and Export fit the viewport without horizontal overflow at ${width}px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 900 });

    await gotoReviewWithDetections(page);

    // Pending Gate (action-required state with alert + checkpoint).
    await page.getByRole("button", { name: "4. Privacy Gate" }).click();
    await expect(page.getByRole("region", { name: "Decision checkpoint" })).toBeVisible();
    await assertNoHorizontalOverflow(page, `pending Gate @${width}px`);

    // Completed Review → completed Gate + Export.
    await page.getByRole("button", { name: "3. Review" }).click();
    await completeReview(page);
    await page.getByRole("button", { name: "4. Privacy Gate" }).click();
    await assertNoHorizontalOverflow(page, `completed Gate @${width}px`);

    await page.getByRole("button", { name: "5. Export" }).click();
    await expect(page.getByRole("heading", { level: 2, name: "Export" })).toBeVisible();
    await assertNoHorizontalOverflow(page, `Export @${width}px`);
  });
}

test("Gate and Export primary controls are keyboard reachable with visible focus", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await gotoExportComplete(page);

  const focusInfo = () =>
    page.evaluate(() => {
      const active = document.activeElement as HTMLElement | null;
      if (active === null) return null;
      const style = getComputedStyle(active);
      return {
        text: (active.textContent ?? "").trim(),
        ariaLabel: active.getAttribute("aria-label") ?? "",
        outlineStyle: style.outlineStyle,
        outlineWidth: style.outlineWidth,
        boxShadow: style.boxShadow,
        role: active.getAttribute("role") ?? active.tagName.toLowerCase(),
      };
    });

  /** Tab (keyboard) until the active element's name matches, returning its focus styles. */
  const tabTo = async (matcher: RegExp) => {
    for (let attempt = 0; attempt < 60; attempt += 1) {
      await page.keyboard.press("Tab");
      const info = await focusInfo();
      if (info !== null && (matcher.test(info.text) || matcher.test(info.ariaLabel))) return info;
    }
    throw new Error(`could not reach keyboard target ${matcher} within 60 tabs`);
  };

  const hasVisibleFocus = (info: { outlineStyle: string; outlineWidth: string; boxShadow: string }) =>
    (info.outlineStyle !== "none" && parseFloat(info.outlineWidth) > 0) ||
    (info.boxShadow !== "none" && info.boxShadow !== "");

  // Focus the document body without using the mouse on a control first.
  await page.locator("body").click({ position: { x: 2, y: 2 } });

  const safeFocus = await tabTo(/Download Safe Output \(\.txt\)/);
  expect(hasVisibleFocus(safeFocus), `no visible focus on Safe Output button: ${JSON.stringify(safeFocus)}`).toBe(true);

  // Keyboard activation produces the real artifact (proves the control is operable, not decorative).
  const [download] = await Promise.all([
    page.waitForEvent("download"),
    page.keyboard.press("Enter"),
  ]);
  expect(download.suggestedFilename()).toBe("safe-output.txt");

  const auditFocus = await tabTo(/Download Confidential Audit \(\.txt\)/);
  expect(hasVisibleFocus(auditFocus), `no visible focus on Confidential Audit button: ${JSON.stringify(auditFocus)}`).toBe(true);
});

test("changed normal-text pairs meet WCAG AA against the rendered composited background", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1280, height: 900 });

  const measured = [] as ContrastResult[];

  // Pending Gate first: the action-required checkpoint and the blocked-reason
  // alert share the exact styling used by the Export blocked reasons.
  await gotoReviewWithDetections(page);
  await page.getByRole("button", { name: "4. Privacy Gate" }).click();
  await expect(page.getByRole("region", { name: "Decision checkpoint" })).toBeVisible();
  await expect(page.getByRole("alert")).toBeVisible();
  measured.push(await expectContrast(page.getByRole("alert"), "Gate pending blocked reason"));

  // Completed Gate: checkpoint + availability + a kept-original attention fact.
  await page.getByRole("button", { name: "3. Review" }).click();
  await completeReview(page);
  await page.getByRole("button", { name: "4. Privacy Gate" }).click();
  await expect(page.getByRole("region", { name: "Decision checkpoint" })).toBeVisible();
  await expect(page.getByRole("list", { name: "Kept-original warnings" })).toBeVisible();
  for (const pair of await gatePairs(page)) {
    measured.push(await expectContrast(pair.locator, `Gate ${pair.label}`));
  }

  // Export: both artifact zones, including the dark confidential band and the buttons.
  await page.getByRole("button", { name: "5. Export" }).click();
  await expect(page.getByRole("button", { name: "Download Safe Output (.txt)" })).toBeEnabled();
  for (const pair of await exportPairs(page)) {
    measured.push(await expectContrast(pair.locator, `Export ${pair.label}`));
  }

  // The oracle is not vacuous: every changed pair was actually measured.
  expect(measured.length).toBeGreaterThanOrEqual(14);
});

test("the contrast helper is falsifiable: planted violation, large text, alpha compositing", async ({
  page,
}) => {
  await page.goto("/");

  // Inject known pairs and measure them with the SAME function the suite uses.
  await page.evaluate(() => {
    const make = (id: string, text: string, color: string, background: string, fontSize: string) => {
      const element = document.createElement("div");
      element.id = id;
      element.textContent = text;
      element.style.color = color;
      element.style.backgroundColor = background;
      element.style.fontSize = fontSize;
      document.body.appendChild(element);
    };
    // Planted low-contrast normal text: #777 on white is ~4.48:1 < 4.5.
    make("contrast-normal", "sample", "#777777", "#ffffff", "14px");
    // The SAME grey at a genuinely large size passes with the >= 3:1 threshold.
    make("contrast-large", "sample", "#777777", "#ffffff", "30px");
    // 50% black over a white base must composite to ~#808080, not black.
    make("contrast-alpha", "sample", "#000000", "rgba(0, 0, 0, 0.5)", "14px");
  });

  const normal = await contrastOf(page.locator("#contrast-normal"));
  const large = await contrastOf(page.locator("#contrast-large"));
  const alpha = await contrastOf(page.locator("#contrast-alpha"));

  // Planted violation is flagged as failing normal text.
  expect(normal.largeText).toBe(false);
  expect(normal.threshold).toBe(4.5);
  expect(normal.ratio).toBeLessThan(4.5);
  expect(normal.pass).toBe(false);

  // Large text uses the correct WCAG large-text threshold (>= 3:1), not 4.5.
  expect(large.largeText).toBe(true);
  expect(large.threshold).toBe(3);
  expect(large.ratio).toBeGreaterThan(3);
  expect(large.pass).toBe(true);

  // Alpha compositing is real: black on 50%-black-over-white reads ~#808080.
  expect(alpha.background).toBe("rgb(128, 128, 128)");
  expect(alpha.ratio).toBeGreaterThan(5);
  expect(alpha.ratio).toBeLessThan(6);
  expect(alpha.pass).toBe(true);
});

test("a pending, failure-free batch Gate never asserts a factual error item", async ({ page }) => {
  // UX-CLOSEOUT-01 outcome C (audit #62 F3): two items pending, zero failed.
  await page.setViewportSize({ width: 1280, height: 900 });
  await createBatchJob(page, BATCH_DOCS);
  await page.getByRole("button", { name: "2. Configure" }).click();
  await page.getByRole("button", { name: "3. Review" }).click();
  // Wait for the batch review to install its sessions: the async start writes
  // the job back to the Review step, so navigating to the Gate before it
  // settles would be undone.
  await expect(page.getByRole("status", { name: "Review progress" })).toContainText("Pending:");
  await page.getByRole("button", { name: "4. Privacy Gate" }).click();

  await expect(page.getByRole("group", { name: "Batch item counts" })).toContainText("Failed: 0");

  const checkpoint = page.getByRole("region", { name: "Decision checkpoint" });
  await expect(checkpoint).toContainText("Action required");
  await expect(checkpoint).not.toContainText(/factual error item/i);
  // The single body paragraph reports the real cause, never an error.
  await expect(checkpoint.locator("p").first()).not.toContainText(/error/i);
  await expect(checkpoint.locator("p").first()).toContainText(
    /mandatory review decisions are still pending/i
  );

  // The separate pending-review alert stays factual and is still shown.
  await expect(page.getByRole("alert")).toHaveCount(1);
  await expect(page.getByRole("alert")).toContainText(
    "Safe export is blocked while 2 mandatory review decisions are pending."
  );
});
