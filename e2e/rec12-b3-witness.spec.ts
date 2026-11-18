/**
 * REC-12 B3: new *falsifiable* supplemental evidence; all content synthetic.
 * No clinical product or privacy-policy changes. No-network fixture is automatic.
 */
import { expect, test } from "./harness/fixtures";
import { buildHighVolumeText } from "./harness/flows";

const SYNTHETIC_SENTINEL = "B3_FICTICIO_NHC_928164";

test("REC12-GAP-05: a composed review / gate / reset journey never puts clinical input in URL", async ({
  page,
}) => {
  await page.goto("/");
  const initial = new URL(page.url());
  const assertUrlClean = async () => {
    const current = new URL(page.url());
    expect(current.origin + current.pathname).toBe(initial.origin + initial.pathname);
    expect(current.search).toBe("");
    expect(current.hash).toBe("");
    expect(current.href).not.toContain(SYNTHETIC_SENTINEL);
    expect(current.href).not.toContain("12345678A");
  };
  await assertUrlClean();
  await page
    .getByRole("textbox", { name: "Pegar texto" })
    .fill(
      `Informe clínico de prueba ${SYNTHETIC_SENTINEL}. Documento: DNI 12345678A. Contacto 600-123-456.`
    );
  await assertUrlClean();
  await page.getByRole("button", { name: "Crear trabajo" }).click();
  await expect(page.getByRole("region", { name: "Espacio de revisión" })).toBeVisible();
  await assertUrlClean();
  await page.getByRole("button", { name: "Comprobación de privacidad" }).click();
  await expect(page.getByRole("heading", { name: "Comprobación de privacidad" })).toBeVisible();
  await assertUrlClean();
  await page.getByRole("button", { name: "Volver a la revisión" }).click();
  await expect(page.getByRole("region", { name: "Espacio de revisión" })).toBeVisible();
  await assertUrlClean();
  await page.getByRole("button", { name: "Nuevo trabajo" }).click();
  await assertUrlClean();
});

test("REC12-GAP-07: current clinical session leaves no silent browser storage or reload recovery", async ({
  page,
}) => {
  await page.goto("/");
  await page
    .getByRole("textbox", { name: "Pegar texto" })
    .fill(`Informe de prueba ${SYNTHETIC_SENTINEL}. DNI 12345678A.`);
  await page.getByRole("button", { name: "Crear trabajo" }).click();
  await expect(page.getByRole("region", { name: "Espacio de revisión" })).toBeVisible();
  const snapshot = await page.evaluate(async () => ({
    local: Object.keys(localStorage),
    session: Object.keys(sessionStorage),
    db:
      typeof indexedDB.databases === "function"
        ? (await indexedDB.databases()).map((db) => db.name)
        : "unavailable",
  }));
  expect(snapshot.local).toEqual([]);
  expect(snapshot.session).toEqual([]);
  expect(snapshot.db, "Chromium must expose indexedDB.databases for this witness").not.toBe(
    "unavailable"
  );
  expect(snapshot.db).toEqual([]);
  await page.reload();
  await expect(page.getByRole("textbox", { name: "Pegar texto" })).toBeEmpty();
  await expect(page.getByRole("region", { name: "Espacio de revisión" })).toHaveCount(0);
});

for (const width of [375, 1280]) {
  test(`REC12-GAP-04: detection type remains text-identifiable without color at ${width}px`, async ({
    page,
  }, testInfo) => {
    await page.setViewportSize({ width, height: 800 });
    await page.goto("/");
    await page.getByRole("textbox", { name: "Pegar texto" }).fill(buildHighVolumeText());
    await page.getByRole("button", { name: "Crear trabajo" }).click();
    const findings = page.getByRole("list", { name: "Hallazgos" }).getByRole("button");
    await expect(findings).toHaveCount(24);
    const highlights = page
      .getByRole("group", { name: "Texto del documento con hallazgos" })
      .locator("button[data-source-start][aria-label]");
    expect(await highlights.count()).toBeGreaterThanOrEqual(24);
    const first = highlights.first();
    const label = await first.getAttribute("aria-label");
    const type = label?.split(': "')[0] ?? "";
    expect(type.length).toBeGreaterThan(1);
    expect(label).toContain("estado de la decisión:");
    expect(
      await first.evaluate((element) => getComputedStyle(element).textDecorationLine)
    ).toContain("underline");
    await expect(
      findings.filter({ has: page.locator("span.font-semibold", { hasText: type }) }).first()
    ).toBeVisible();
    // Simulate total loss of chroma on the actual build. Label and visible type
    // remain; screenshot is human evidence, not pixel-diff authority.
    await page.addStyleTag({ content: "html { filter: grayscale(1) !important; }" });
    await expect(findings.first()).toBeVisible();
    await expect(first).toHaveAttribute("aria-label", /estado de la decisión/);
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(width);
    const path = testInfo.outputPath(`rec12-b3-noncolor-${width}.png`);
    await page.screenshot({ path });
    await testInfo.attach(`rec12-b3-noncolor-${width}`, { path, contentType: "image/png" });
  });
}
