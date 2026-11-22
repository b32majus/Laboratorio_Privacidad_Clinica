/**
 * REC-12 STRUCT-003 (R12): real browser intake of synthetic valid CSV files
 * whose descriptive cell punctuation must NEVER choose the column delimiter.
 * No patient data. Network invariant is supplied by ./harness/fixtures.
 */
import { expect, test } from "./harness/fixtures";
import { selectFiles } from "./harness/flows";

const files = [
  {
    label: "comma headers with semicolon-rich observations",
    name: "sintetico-comas.csv",
    text: [
      "id,nota",
      "SYN-001,observación; control; revisión; consulta",
      "SYN-002,TA; FC; IMC; seguimiento",
    ].join("\n"),
  },
  {
    label: "semicolon headers with comma-rich observations",
    name: "sintetico-punto-coma.csv",
    text: [
      "id;nota",
      "SYN-001;TA, FC, IMC, HbA1c, glucosa",
      "SYN-002;observación, control, revisión, consulta",
    ].join("\n"),
  },
] as const;

for (const fixture of files) {
  test(`CSV column integrity: ${fixture.label}`, async ({ page }) => {
    await page.goto("/");
    await selectFiles(page, {
      name: fixture.name,
      mimeType: "text/csv",
      buffer: Buffer.from(fixture.text, "utf8"),
    });
    await page.getByRole("button", { name: "Crear trabajo" }).click();

    const summary = page.getByRole("status", {
      name: "Datos de la configuración estructurada",
    });
    await expect(summary).toContainText("Columnas: 2");
    const table = page.getByRole("table", {
      name: "Lista de clasificación de columnas",
    });
    await expect(table.locator("tbody tr")).toHaveCount(2);
    await expect(table.getByRole("button", { name: "id" })).toBeVisible();
    await expect(table.getByRole("button", { name: "nota" })).toBeVisible();
  });
}

test("ambiguous CSV refuses intake with Spanish actionable feedback and no fabricated columns", async ({
  page,
}) => {
  await page.goto("/");
  await selectFiles(page, {
    name: "sintetico-ambiguo.csv",
    mimeType: "text/csv",
    buffer: Buffer.from("A,B;C\n1,2;3", "utf8"),
  });
  await page.getByRole("button", { name: "Crear trabajo" }).click();
  await expect(page.getByRole("alert")).toContainText(
    "No se puede identificar con seguridad el separador del CSV"
  );
  await expect(
    page.getByRole("status", { name: "Datos de la configuración estructurada" })
  ).toHaveCount(0);
});
