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
import type { Locator, Page } from "@playwright/test";

const CONFIDENTIAL_WARNING_LINE = "CONFIDENTIAL — INTERNAL AUDIT ARTIFACT";

type ContrastResult = {
  readonly ratio: number;
  readonly fontSize: number;
  readonly fontWeight: number;
  readonly largeText: boolean;
  readonly threshold: number;
  readonly pass: boolean;
  readonly foreground: string;
  readonly background: string;
};

/**
 * Measured in the page: composite the effective background by walking up the
 * DOM (alpha-blending rgba layers over a white page base), compute the WCAG
 * relative luminance of the foreground and effective background, and apply the
 * correct large-text threshold from the RENDERED font size/weight.
 */
function measureContrast(element: HTMLElement): ContrastResult {
  type Rgba = { r: number; g: number; b: number; a: number };
  const parseColor = (value: string): Rgba | null => {
    const match = /^rgba?\(([^)]+)\)$/.exec(value.trim());
    if (match === null) return null;
    const parts = match[1].split(",").map((part) => Number.parseFloat(part.trim()));
    if (parts.length < 3 || parts.some((part) => Number.isNaN(part))) return null;
    return { r: parts[0], g: parts[1], b: parts[2], a: parts.length > 3 ? parts[3] : 1 };
  };
  // Source-over compositing of `top` over opaque/translucent `bottom`.
  const over = (top: Rgba, bottom: Rgba): Rgba => {
    const alpha = top.a + bottom.a * (1 - top.a);
    if (alpha === 0) return { r: 0, g: 0, b: 0, a: 0 };
    const channel = (t: number, b: number) => (t * top.a + b * bottom.a * (1 - top.a)) / alpha;
    return {
      r: channel(top.r, bottom.r),
      g: channel(top.g, bottom.g),
      b: channel(top.b, bottom.b),
      a: alpha,
    };
  };
  const luminance = (color: Rgba): number => {
    const linear = (value: number): number => {
      const s = value / 255;
      return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
    };
    return 0.2126 * linear(color.r) + 0.7152 * linear(color.g) + 0.0722 * linear(color.b);
  };

  const style = getComputedStyle(element);
  const foreground = parseColor(style.color) ?? { r: 0, g: 0, b: 0, a: 1 };

  const layers: Rgba[] = [];
  let node: HTMLElement | null = element;
  while (node !== null) {
    const background = parseColor(getComputedStyle(node).backgroundColor);
    if (background !== null && background.a > 0) layers.push(background);
    node = node.parentElement;
  }
  // White page base, then every ancestor background from root down to element.
  let composited: Rgba = { r: 255, g: 255, b: 255, a: 1 };
  for (let index = layers.length - 1; index >= 0; index -= 1) {
    composited = over(layers[index], composited);
  }

  const light = Math.max(luminance(foreground), luminance(composited));
  const dark = Math.min(luminance(foreground), luminance(composited));
  const ratio = (light + 0.05) / (dark + 0.05);

  const fontSize = Number.parseFloat(style.fontSize);
  const fontWeight = Number.parseInt(style.fontWeight, 10) || 400;
  // WCAG large text: >= 18pt (24px), or >= 14pt (18.6667px) and bold.
  const largeText = fontSize >= 24 || (fontSize >= 18.6667 && fontWeight >= 700);
  const threshold = largeText ? 3 : 4.5;

  return {
    ratio,
    fontSize,
    fontWeight,
    largeText,
    threshold,
    pass: ratio >= threshold,
    foreground: style.color,
    background: `rgb(${Math.round(composited.r)}, ${Math.round(composited.g)}, ${Math.round(
      composited.b
    )})`,
  };
}

async function contrastOf(locator: Locator): Promise<ContrastResult> {
  return locator.evaluate(measureContrast);
}

async function expectContrast(locator: Locator, label: string): Promise<ContrastResult> {
  const result = await contrastOf(locator);
  if (process.env.UX_CONTRAST_REPORT === "1") {
    // Deterministic evidence when explicitly requested; silent otherwise.
    console.log(
      `[contrast] ${label}: ${result.foreground} on ${result.background} = ${result.ratio.toFixed(
        2
      )}:1 (${result.largeText ? "large" : "normal"} text ${result.fontSize}px/${
        result.fontWeight
      }, threshold ${result.threshold})`
    );
  }
  expect(
    result.pass,
    `${label}: ${result.foreground} on ${result.background} = ${result.ratio.toFixed(
      2
    )}:1 (threshold ${result.threshold}, ${result.largeText ? "large" : "normal"} text ${
      result.fontSize
    }px/${result.fontWeight})`
  ).toBe(true);
  // Real measured value, not a placeholder: a finite ratio inside the possible range.
  expect(result.ratio).toBeGreaterThan(1);
  expect(result.ratio).toBeLessThanOrEqual(21);
  return result;
}

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

const FIXTURE_TEXT =
  "Informe de consulta externa. Documento del paciente: DNI 12345678A. " +
  "Telefono de contacto 600-123-456. Correo paciente1@example.com. " +
  "Historia numero NHC 00442315. Diagnostico: hipertension arterial controlada.";
const DNI = "12345678A";
const TELEFONO = "600-123-456";
const EMAIL = "paciente1@example.com";
const NHC = "NHC 00442315";

async function gotoReviewWithDetections(page: Page): Promise<void> {
  await page.goto("/");
  await page.getByLabel("Paste text").fill(FIXTURE_TEXT);
  await page.getByRole("button", { name: "Create job" }).click();
  await page.getByRole("button", { name: "2. Configure" }).click();
  await page.getByRole("button", { name: "3. Review" }).click();
  await expect(page.getByRole("list", { name: "Detections" }).getByRole("button")).toHaveCount(4);
}

async function completeReview(page: Page): Promise<void> {
  const detections = page.getByRole("list", { name: "Detections" });
  const select = async (label: RegExp) => {
    await detections.getByRole("button", { name: label }).click();
  };
  await select(new RegExp(DNI));
  await page.getByLabel("Replacement").fill("[DNI-REVISADO]");
  await page.getByRole("button", { name: "Apply modification" }).click();
  await select(new RegExp(EMAIL.replace(".", "\\.")));
  await page.getByRole("button", { name: "Keep original" }).click();
  await select(new RegExp(TELEFONO));
  await page.getByRole("button", { name: "Accept detection" }).click();
  await select(new RegExp(NHC));
  await page.getByRole("button", { name: "Accept detection" }).click();
  await expect(page.getByRole("status", { name: "Review progress" })).toContainText("Pending: 0");
}

async function gotoExportComplete(page: Page): Promise<void> {
  await gotoReviewWithDetections(page);
  await completeReview(page);
  await page.getByRole("button", { name: "4. Privacy Gate" }).click();
  const exportButton = page.getByRole("button", { name: "5. Export" });
  await expect(exportButton).toBeEnabled();
  await exportButton.click();
  await expect(page.getByRole("heading", { level: 2, name: "Export" })).toBeVisible();
}

async function assertNoHorizontalOverflow(page: Page, label: string): Promise<void> {
  const metrics = await page.evaluate(() => {
    const root = document.documentElement;
    const clientWidth = root.clientWidth;
    const offenders: string[] = [];
    for (const element of Array.from(root.querySelectorAll("body *"))) {
      const rect = element.getBoundingClientRect();
      if (rect.width > 0 && rect.right > clientWidth + 1) {
        const tag = element.tagName.toLowerCase();
        const classes =
          typeof element.className === "string" ? element.className.slice(0, 60) : "";
        offenders.push(`${tag}.${classes} right=${Math.round(rect.right)}`);
        if (offenders.length >= 8) break;
      }
    }
    return { clientWidth, scrollWidth: root.scrollWidth, bodyScrollWidth: document.body.scrollWidth, offenders };
  });
  expect(
    metrics.scrollWidth,
    `${label}: document scrollWidth ${metrics.scrollWidth} exceeds clientWidth ${metrics.clientWidth}; offenders: ${metrics.offenders.join("; ") || "none detected"}`
  ).toBeLessThanOrEqual(metrics.clientWidth);
  expect(
    metrics.bodyScrollWidth,
    `${label}: body scrollWidth ${metrics.bodyScrollWidth} exceeds clientWidth ${metrics.clientWidth}; offenders: ${metrics.offenders.join("; ") || "none detected"}`
  ).toBeLessThanOrEqual(metrics.clientWidth);
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
