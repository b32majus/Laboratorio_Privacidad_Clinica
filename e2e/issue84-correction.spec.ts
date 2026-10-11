/**
 * Issue #84 correction journey witness (handoff §7 writer/corrector row).
 *
 * Spec §5 line 55 closure: changing the active policy from the direct Result
 * (D-024) invalidates the review/result authorization; the stranded operator
 * sees the truthful reason (professional Spanish) and a domain-gated way back
 * to Review — gated by the existing `isStepAccessible` backward authority, never
 * a new ad-hoc enable rule (PRODUCT_FIDELITY_GATES_V1 Gate 2) — where the review
 * can be redone under the new policy, with no stale Safe download surface.
 *
 * Witnessed at 375×800 and 1280×800 (acceptance I: task-prominent, no
 * horizontal obstruction). All content is synthetic; no PHI. The auto
 * no-network fixture from ./harness/fixtures applies to every test.
 */
import { expect, test } from "./harness/fixtures";
import { assertNoHorizontalOverflow } from "./harness/viewport";
import { completeReview, gotoReviewWithDetections } from "./harness/flows";

for (const [width, height] of [
  [375, 800],
  [1280, 800],
] as const) {
  test(`policy change from the stranded Result keeps the truthful way back to Review at ${width}×${height}`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height });

    // Text job → Review (auto-started once) → every decision resolved.
    await gotoReviewWithDetections(page);
    await completeReview(page);

    // D-024: the direct Result from Review, without a mandatory Gate stop.
    await page.getByRole("button", { name: "Ver resultado" }).click();
    await expect(page.getByRole("heading", { level: 2, name: "Resultado" })).toBeVisible();

    // REAL policy change from the Result: the session-dependent authorization
    // is invalidated; the stale Result and every download affordance vanish.
    await page.getByLabel("Privacy Policy:").selectOption("strict");
    await expect(page.getByRole("heading", { level: 2, name: "Resultado" })).toHaveCount(0);
    await expect(page.getByRole("button", { name: /Descargar/ })).toHaveCount(0);

    // The truthful reason is visible, in professional Spanish (acceptance I).
    await expect(page.getByText(/Este paso no está disponible/i)).toBeVisible();

    // The domain-gated way back to Review is visible and operable at both
    // viewports, with no horizontal obstruction.
    const back = page.getByRole("button", { name: "Volver a la revisión" });
    await expect(back).toBeVisible();
    await expect(back).toBeEnabled();
    await assertNoHorizontalOverflow(page, `stranded Result @${width}×${height}`);
    await back.click();

    // The review can be redone under the new policy: a fresh session with
    // every mandatory decision pending again (no stale output).
    await expect(page.getByRole("region", { name: "Review workspace" })).toBeVisible();
    await expect(page.getByRole("status", { name: "Review progress" })).toContainText(
      /Pending: [1-9]/
    );
  });
}
