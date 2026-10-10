/**
 * REC-08 direct human input start browser oracle (issue #80).
 *
 * Rendered product witness for the changed input surface in the real
 * application: Spanish examples that fill the draft without creating a Job,
 * the Pegar convenience with its Ctrl+V fallback, drag/drop + selection
 * entry, quiet routing (no permanent JobKind mapping, no pipeline override)
 * and the Spanish intended-use wording. Verified at desktop and narrow/mobile
 * widths with the shared no-overflow oracle. All content is synthetic/no-PHI.
 *
 * The auto no-network fixture from ./harness/fixtures applies to every test.
 */
import * as fs from "node:fs";
import * as path from "node:path";

import { expect, test } from "./harness/fixtures";
import { assertNoHorizontalOverflow } from "./harness/viewport";

function ejemploTexto(file: string): string {
  const payload = JSON.parse(
    fs.readFileSync(path.resolve(__dirname, "..", "ejemplos", file), "utf8")
  ) as { texto: string };
  return payload.texto;
}

const EJEMPLO_URGENCIAS = ejemploTexto("01-consulta-urgencias.json");

test("examples fill the pasted-text draft without creating a job", async ({ page }) => {
  await page.goto("/");

  const example = page.getByRole("button", { name: "Ejemplo: consulta de urgencias" });
  await expect(example).toBeVisible();
  await expect(example).toBeEnabled();
  await example.click();

  await expect(page.getByRole("textbox", { name: "Pegar texto" })).toHaveValue(EJEMPLO_URGENCIAS);
  // Choosing an example is draft-only: no Job, later steps stay locked.
  await expect(page.getByRole("banner")).toContainText("No job yet");
  await expect(page.getByRole("button", { name: "2. Configure" })).toBeDisabled();
});

test("examples are keyboard-operable", async ({ page }) => {
  await page.goto("/");

  const example = page.getByRole("button", { name: "Ejemplo: informe quirúrgico" });
  await example.focus();
  await page.keyboard.press("Enter");
  await expect(page.getByRole("textbox", { name: "Pegar texto" })).not.toHaveValue("");
  await expect(page.getByRole("banner")).toContainText("No job yet");
});

test("Pegar without clipboard permission shows the Spanish Ctrl+V fallback and creates no job", async ({
  page,
}) => {
  await page.goto("/");

  const pegar = page.getByRole("button", { name: "Pegar desde el portapapeles" });
  await expect(pegar).toBeVisible();
  await pegar.click();

  const alert = page.getByRole("alert");
  await expect(alert).toContainText(/portapapeles/);
  await expect(alert).toContainText(/Ctrl\+V/);
  await expect(page.getByRole("banner")).toContainText("No job yet");
});

test("file entry offers selection and drag/drop into the same process", async ({ page }) => {
  await page.goto("/");

  await expect(
    page.getByLabel("Seleccionar archivos (TXT, PDF, DOCX, CSV, XLS, XLSX)")
  ).toBeVisible();
  await expect(page.getByText(/arrastre y suelte archivos/i)).toBeVisible();
});

test("ordinary start is quiet about internal routing and exposes no pipeline override", async ({
  page,
}) => {
  await page.goto("/");

  await expect(page.getByText("How the job type is chosen")).toHaveCount(0);
  await expect(page.getByText("Text job", { exact: true })).toHaveCount(0);
  await expect(page.getByText("Document job", { exact: true })).toHaveCount(0);
  await expect(page.getByText("Document batch", { exact: true })).toHaveCount(0);
  await expect(page.getByText("Structured job", { exact: true })).toHaveCount(0);
  // No generic pipeline selector or alternate routing state on the start.
  await expect(page.locator("#main-content").getByRole("radiogroup")).toHaveCount(0);
  await expect(page.locator("#main-content").getByRole("combobox")).toHaveCount(0);
  await expect(page.locator("#main-content").getByText(/pipeline/i)).toHaveCount(0);
  // Concise format help and Spanish intended-use wording remain.
  await expect(page.getByText(/documentos \(txt, pdf, docx\)/i).first()).toBeVisible();
  const uso = page.getByRole("region", { name: "Uso previsto" });
  await expect(uso).toBeVisible();
  await expect(uso).toContainText("IA externa");
  await expect(uso).toContainText(/nada sale de este dispositivo/i);
});

for (const width of [375, 1280]) {
  test(`input start surface fits the viewport without horizontal overflow at ${width}px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.goto("/");
    await assertNoHorizontalOverflow(page, `no-job input start @${width}px`);

    // With an example loaded and files staged the surface must still fit.
    await page.getByRole("button", { name: "Ejemplo: historia clínica" }).click();
    await assertNoHorizontalOverflow(page, `example-loaded input start @${width}px`);
  });
}
