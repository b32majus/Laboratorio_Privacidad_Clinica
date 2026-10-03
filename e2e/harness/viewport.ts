/**
 * Shared viewport oracle (UX-CLOSEOUT-01).
 *
 * Extracted verbatim from the duplicated `assertNoHorizontalOverflow` copies in
 * `e2e/gate-export-ux.spec.ts` and `e2e/policy-guidance.spec.ts` so every
 * responsive browser oracle measures the exact same, falsifiable fact: the
 * document (and body) must not scroll horizontally beyond the viewport, with
 * attribution to the widest offending element when it does.
 */
import { expect, type Page } from "@playwright/test";

export async function assertNoHorizontalOverflow(page: Page, label: string): Promise<void> {
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
    return {
      clientWidth,
      scrollWidth: root.scrollWidth,
      bodyScrollWidth: document.body.scrollWidth,
      offenders,
    };
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
