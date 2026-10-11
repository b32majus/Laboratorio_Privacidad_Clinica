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

import type { Page } from "@playwright/test";

import { expect, test } from "./harness/fixtures";
import { selectFiles } from "./harness/flows";
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
  // Choosing an example is draft-only: no Job, and the quiet shell (#84)
  // offers no task action while no job exists.
  await expect(page.getByRole("banner")).toContainText("Aún no hay trabajo");
  await expect(page.getByRole("button", { name: "Iniciar revisión" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Privacy Gate" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Ver resultado" })).toHaveCount(0);
});

test("examples are keyboard-operable", async ({ page }) => {
  await page.goto("/");

  const example = page.getByRole("button", { name: "Ejemplo: informe quirúrgico" });
  await example.focus();
  await page.keyboard.press("Enter");
  await expect(page.getByRole("textbox", { name: "Pegar texto" })).not.toHaveValue("");
  await expect(page.getByRole("banner")).toContainText("Aún no hay trabajo");
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
  await expect(page.getByRole("banner")).toContainText("Aún no hay trabajo");
});

/**
 * CORA-80-01 production-build witness: a controllable pending
 * `navigator.clipboard.readText()` resolved LATE must never overwrite a newer
 * user draft. This is the exact adversary Cora reproduced in the shipped
 * bytes, run here against `vite preview` of the production build.
 */
test("a late clipboard read cannot overwrite a newer typed draft (CORA-80-01)", async ({
  page,
}) => {
  await page.addInitScript(() => {
    const controller = window as unknown as { __resolveClipboardRead?: (text: string) => void };
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: {
        readText: () =>
          new Promise<string>((resolve) => {
            controller.__resolveClipboardRead = resolve;
          }),
      },
    });
  });

  await page.goto("/");
  await page.getByRole("button", { name: "Pegar desde el portapapeles" }).click();

  const textarea = page.getByRole("textbox", { name: "Pegar texto" });
  await textarea.fill("TEXTO NUEVO ESCRITO POR EL USUARIO");

  await page.evaluate(() => {
    (
      window as unknown as { __resolveClipboardRead?: (text: string) => void }
    ).__resolveClipboardRead?.("LECTURA ANTIGUA DEL PORTAPAPELES");
  });

  // The newer user text survives the stale response and no Job appears.
  await expect(textarea).toHaveValue("TEXTO NUEVO ESCRITO POR EL USUARIO");
  await expect(page.getByRole("banner")).toContainText("Aún no hay trabajo");
});

/**
 * CORA-80-03 production-build witness: a newer canonical picker selection made
 * while `navigator.clipboard.readText()` is pending invalidates the older
 * clipboard result. When the stale read resolves, the textarea stays empty,
 * the staged TXT survives unchanged, and Crear trabajo yields a normal
 * Document job with no false mixed-input refusal.
 */
test("a stale clipboard read cannot overwrite a newer picker file selection (CORA-80-03)", async ({
  page,
}) => {
  await page.addInitScript(() => {
    const controller = window as unknown as { __resolveClipboardRead?: (text: string) => void };
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: {
        readText: () =>
          new Promise<string>((resolve) => {
            controller.__resolveClipboardRead = resolve;
          }),
      },
    });
  });

  await page.goto("/");
  const pegar = page.getByRole("button", { name: "Pegar desde el portapapeles" });
  await pegar.click();

  await selectFiles(page, {
    name: "sintetico.txt",
    mimeType: "text/plain",
    buffer: Buffer.from("NOTA SINTÉTICA"),
  });
  const textarea = page.getByRole("textbox", { name: "Pegar texto" });
  await expect(page.getByText("1 archivo seleccionado")).toBeVisible();
  await expect(textarea).toHaveValue("");

  await page.evaluate(() => {
    (
      window as unknown as { __resolveClipboardRead?: (text: string) => void }
    ).__resolveClipboardRead?.("RESPUESTA ANTIGUA DEL PORTAPAPELES");
  });

  // Wait until the pending read has settled before asserting the outcome.
  await expect(pegar).toHaveAttribute("aria-busy", "false");
  await expect(textarea).toHaveValue("");
  const items = page.getByRole("list", { name: "Archivos seleccionados" }).getByRole("listitem");
  await expect(items).toHaveCount(1);
  await expect(items.first()).toContainText("sintetico.txt");

  await page.getByRole("button", { name: "Crear trabajo" }).click();
  // Issue #84 correction (spec F, closed at e34d931): the internal job kind is
  // not permanent banner chrome; the created job's NAME is the persistent
  // header fact (the same reconciliation flows.createDocumentJob applies).
  // Pre-existing stale consumer reconciled during CORA-84-03 shell work: the
  // banner never renders "Document job" anymore (see the exact:true count-0
  // assertion below, which this test itself already makes at line ~243).
  await expect(page.getByRole("banner")).toContainText("sintetico.txt");
  await expect(page.getByText("Document job", { exact: true })).toHaveCount(0);
  await expect(page.getByRole("alert")).toHaveCount(0);
});

test("file entry offers selection and drag/drop into the same process", async ({ page }) => {
  await page.goto("/");

  await expect(
    page.getByLabel("Seleccionar archivos (TXT, PDF, DOCX, CSV, XLS, XLSX)")
  ).toBeVisible();
  await expect(page.getByText(/arrastre y suelte archivos/i)).toBeVisible();
});

/**
 * CORA-80-02 production-build witnesses: a real drop event carrying ZERO files
 * (a dropped text payload) must not clear/ replace/reorder an existing staged
 * selection, while a genuine non-empty file drop still stages the exact files
 * in order on the canonical selection path.
 */
async function dispatchDropWithNoFiles(page: Page): Promise<void> {
  await page.evaluate(() => {
    const heading = Array.from(document.querySelectorAll("h3")).find(
      (candidate) => candidate.textContent === "Elegir archivos"
    );
    const section = heading?.closest("section");
    if (!section) throw new Error("files card section not found");
    const dataTransfer = new DataTransfer();
    dataTransfer.setData("text/plain", "texto arrastrado sin archivos");
    section.dispatchEvent(new DragEvent("drop", { bubbles: true, cancelable: true, dataTransfer }));
  });
}

test("a drop carrying zero files preserves the staged selection (CORA-80-02)", async ({ page }) => {
  await page.goto("/");
  await selectFiles(page, {
    name: "sintetico.txt",
    mimeType: "text/plain",
    buffer: Buffer.from("contenido sintético"),
  });
  await expect(page.getByText("1 archivo seleccionado")).toBeVisible();

  await dispatchDropWithNoFiles(page);

  await expect(page.getByText("1 archivo seleccionado")).toBeVisible();
  const items = page.getByRole("list", { name: "Archivos seleccionados" }).getByRole("listitem");
  await expect(items).toHaveCount(1);
  await expect(items.first()).toContainText("sintetico.txt");
  await expect(page.getByRole("banner")).toContainText("Aún no hay trabajo");
});

test("a real non-empty file drop stages the exact files in order (CORA-80-02)", async ({
  page,
}) => {
  await page.goto("/");
  await page.evaluate(() => {
    const heading = Array.from(document.querySelectorAll("h3")).find(
      (candidate) => candidate.textContent === "Elegir archivos"
    );
    const section = heading?.closest("section");
    if (!section) throw new Error("files card section not found");
    const dataTransfer = new DataTransfer();
    dataTransfer.items.add(new File(["b"], "doc-b.txt", { type: "text/plain" }));
    dataTransfer.items.add(new File(["a"], "doc-a.txt", { type: "text/plain" }));
    section.dispatchEvent(new DragEvent("drop", { bubbles: true, cancelable: true, dataTransfer }));
  });

  const items = page.getByRole("list", { name: "Archivos seleccionados" }).getByRole("listitem");
  await expect(items).toHaveCount(2);
  await expect(items.nth(0)).toContainText("doc-b.txt");
  await expect(items.nth(1)).toContainText("doc-a.txt");
  await expect(page.getByText("2 archivos seleccionados")).toBeVisible();
  await expect(page.getByRole("banner")).toContainText("Aún no hay trabajo");
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

/**
 * REC-08 F2 (corrective): rendered witness that the primary add-information
 * task is visible AND reachable at narrow/mobile (375px) and desktop (1280px),
 * and that the intended-use/policy guidance does not visually outrank it
 * (HPD-12). DOM/visual order + visibility is the falsifiable proxy: every
 * primary control sits above the guidance regions in document flow.
 */
for (const width of [375, 1280]) {
  test(`primary add-information task is visible, reachable and ahead of guidance at ${width}px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.goto("/");

    const textarea = page.getByRole("textbox", { name: "Pegar texto" });
    const pegar = page.getByRole("button", { name: "Pegar desde el portapapeles" });
    const fileSelect = page.getByLabel("Seleccionar archivos (TXT, PDF, DOCX, CSV, XLS, XLSX)");
    const create = page.getByRole("button", { name: "Crear trabajo" });
    const examples = [
      page.getByRole("button", { name: "Ejemplo: consulta de urgencias" }),
      page.getByRole("button", { name: "Ejemplo: informe quirúrgico" }),
      page.getByRole("button", { name: "Ejemplo: historia clínica" }),
    ];

    // Visibility + operability of every primary add-information control.
    for (const control of [textarea, pegar, fileSelect, create, ...examples]) {
      await expect(control).toBeVisible();
      await expect(control).toBeEnabled();
    }

    // Reachability: each primary control can be brought into the viewport.
    for (const control of [textarea, pegar, fileSelect, create]) {
      await control.scrollIntoViewIfNeeded();
      await expect(control).toBeInViewport();
    }

    await assertNoHorizontalOverflow(page, `primary add-information task @${width}px`);

    // Guidance must not visually outrank the primary task: both the inline
    // intended-use region and the shell Privacy Policy region sit BELOW the
    // primary input controls and the create action.
    const intendedUse = page.getByRole("region", { name: "Uso previsto" });
    const privacyPolicy = page.getByRole("region", { name: "Política de privacidad" });
    await expect(intendedUse).toBeVisible();
    await expect(privacyPolicy).toBeVisible();

    const createBox = await create.boundingBox();
    const textareaBox = await textarea.boundingBox();
    const intendedUseBox = await intendedUse.boundingBox();
    const privacyPolicyBox = await privacyPolicy.boundingBox();
    expect(createBox).not.toBeNull();
    expect(textareaBox).not.toBeNull();
    expect(intendedUseBox).not.toBeNull();
    expect(privacyPolicyBox).not.toBeNull();
    expect(textareaBox!.y).toBeLessThan(intendedUseBox!.y);
    expect(createBox!.y).toBeLessThan(intendedUseBox!.y);
    expect(createBox!.y).toBeLessThan(privacyPolicyBox!.y);
  });
}
