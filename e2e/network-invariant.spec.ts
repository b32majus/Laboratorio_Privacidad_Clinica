/**
 * Network privacy invariant E2E (Work Order T21 #25; SPEC_V4_QUALITY_
 * SECURITY_DEPLOY.md §2, D-014).
 *
 * 1. Enforcing case: the whole critical user flow (paste → process → review →
 *    privacy gate → export) runs with ZERO external requests. Any unexpected
 *    outbound request fails the test through the auto-fixture teardown.
 * 2. Adversarial case: a representative planted external request (fetch AND
 *    XHR, the two runtime channels a leak would realistically use) is
 *    injected into the running app page and the recorder MUST detect it.
 *    This proves the oracle can disagree with the application — a monitor
 *    that only ever saw clean traffic would prove nothing.
 */
import { test, expect } from "./harness/fixtures";

test.describe("network privacy invariant (enforcing)", () => {
  test("the critical flow issues zero unexpected external requests", async ({
    page,
    networkRecorder,
  }) => {
    await page.goto("/");

    await page.getByLabel("Paste text").fill(
      "Informe de consulta externa. Documento del paciente: DNI 12345678A. " +
        "Telefono de contacto 600-123-456. Correo paciente1@example.com."
    );
    await page.getByRole("button", { name: "Create job" }).click();
    await page.getByRole("button", { name: "2. Configure" }).click();
    await page.getByRole("button", { name: "3. Review" }).click();
    await expect(page.getByRole("list", { name: "Detections" }).getByRole("button")).toHaveCount(
      3
    );

    // Export gate while review is pending: the Privacy Gate shows the
    // fail-closed output availability and the Export step itself stays
    // inaccessible (title carries the blocked reason).
    await page.getByRole("button", { name: "4. Privacy Gate" }).click();
    await expect(page.getByRole("alert")).toContainText("mandatory review decision");
    await expect(
      page.getByRole("status", { name: "Output availability facts" })
    ).toContainText("Not ready");
    await expect(page.getByRole("button", { name: "5. Export" })).toBeDisabled();

    // The recorder itself saw nothing external; the auto-fixture would fail
    // the test otherwise. This assertion makes the contract readable in the
    // spec instead of relying only on teardown.
    expect(networkRecorder.violations).toEqual([]);
  });
});

test.describe("network privacy invariant (adversarial planted requests)", () => {
  // record-only: the planted violations are the EXPECTED outcome asserted
  // below, so the auto-fixture must not fail the test for detecting them.
  test.use({ networkMode: "record-only" });

  test("a planted external fetch is detected by the monitor", async ({ page, networkRecorder }) => {
    await page.goto("/");
    await page.evaluate(() => {
      void fetch("https://t21-planted-external.example/beacon").catch(() => undefined);
    });
    await expect
      .poll(() => networkRecorder.violations.map((violation) => violation.url))
      .toEqual([expect.stringContaining("t21-planted-external.example")]);
  });

  test("a planted external XHR is detected by the monitor", async ({ page, networkRecorder }) => {
    await page.goto("/");
    await page.evaluate(() => {
      const xhr = new XMLHttpRequest();
      xhr.open("POST", "https://t21-planted-external.example/collect");
      // send() may throw synchronously depending on the environment; the
      // detection point is open(), so the attempt is already recorded.
      try {
        xhr.send();
      } catch {
        // The monitor owns the invariant; the planted request must not break
        // the harness itself.
      }
    });
    await expect
      .poll(() => networkRecorder.violations.map((violation) => violation.url))
      .toEqual([expect.stringContaining("t21-planted-external.example")]);
  });
});
