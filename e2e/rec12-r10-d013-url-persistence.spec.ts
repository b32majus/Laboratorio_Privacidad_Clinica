/**
 * REC12 R10 / GAP-05+GAP-07: no clinical content in SPA URL, query/hash or
 * browser persistent storage in two real V4 workflows; session disappears
 * after reload (no silent job recovery). Synthetic input only.
 *
 * The test is a witness for THESE flows only, not an exhaustive storage audit.
 * Uses the real built V4 application and isolated Playwright context.
 */
import { expect, test } from "./harness/fixtures";
import { selectFiles } from "./harness/flows";

const marker = "SINTETICO_R10_NO_PERSISTIR_20261122";
type StorageObservation = {
  local: Record<string, string>;
  session: Record<string, string>;
  databases: string[];
  caches: string[];
  pathname: string;
  search: string;
  hash: string;
  href: string;
};
const inspect = async (page: import("@playwright/test").Page) =>
  page.evaluate(async (): Promise<StorageObservation> => ({
    local: Object.fromEntries(
      Array.from({ length: localStorage.length }, (_, i) => localStorage.key(i)!)
        .filter(Boolean)
        .map((key) => [key, localStorage.getItem(key)!])
    ),
    session: Object.fromEntries(
      Array.from({ length: sessionStorage.length }, (_, i) => sessionStorage.key(i)!)
        .filter(Boolean)
        .map((key) => [key, sessionStorage.getItem(key)!])
    ),
    databases:
      typeof indexedDB.databases === "function"
        ? (await indexedDB.databases()).map((entry) => entry.name ?? "").sort()
        : [],
    caches: typeof caches !== "undefined" ? (await caches.keys()).sort() : [],
    pathname: location.pathname,
    search: location.search,
    hash: location.hash,
    href: location.href,
  }));

for (const mode of ["text", "structured"] as const) {
  test(`R10 ${mode}: synthetic Job never enters URL/storage and reload cannot recover it silently`, async ({
    page,
    networkRecorder,
  }) => {
    await page.goto("/");
    const baseline = await inspect(page);
    expect(baseline.href).not.toContain(marker);
    if (mode === "text") {
      await page
        .getByRole("textbox", { name: "Pegar texto" })
        .fill(`Informe sintético ${marker}. DNI 12345678A y teléfono 600-123-456.`);
    } else {
      await selectFiles(page, {
        name: "r10-paciente-sintetico.csv",
        mimeType: "text/csv",
        buffer: Buffer.from(`NHC,Diagnostico\nSINT-R10-001,${marker}\n`),
      });
    }
    await page.getByRole("button", { name: "Crear trabajo" }).click();
    if (mode === "text") {
      await expect(page.getByRole("list", { name: "Hallazgos" })).toBeVisible();
    } else {
      await expect(
        page.getByRole("status", { name: "Datos de la configuración estructurada" })
      ).toContainText("Columnas: 2");
    }

    const active = await inspect(page);
    expect(active.href).not.toContain(marker);
    expect(active.search).toBe(baseline.search);
    expect(active.hash).toBe(baseline.hash);
    expect(active.pathname).toBe(baseline.pathname);
    expect(active.local).toEqual(baseline.local);
    expect(active.session).toEqual(baseline.session);
    expect(active.databases).toEqual(baseline.databases);
    expect(active.caches).toEqual(baseline.caches);
    expect(JSON.stringify(active)).not.toContain(marker);
    expect(networkRecorder.violations).toEqual([]);

    await page.reload();
    await expect(page.getByRole("banner")).toContainText("Aún no hay trabajo");
    await expect(page.getByRole("textbox", { name: "Pegar texto" })).toHaveValue("");
    const after = await inspect(page);
    expect(after.href).not.toContain(marker);
    expect(after.local).toEqual(baseline.local);
    expect(after.session).toEqual(baseline.session);
    expect(after.databases).toEqual(baseline.databases);
    expect(after.caches).toEqual(baseline.caches);
    expect(networkRecorder.violations).toEqual([]);
  });
}
