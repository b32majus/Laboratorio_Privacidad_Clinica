/**
 * UX-CLOSEOUT-01 transversal browser evidence (GitHub #63 / audit #62).
 *
 * Focused, falsifiable closeout evidence for the shell and flow coherence work
 * after WU-A (task-first hierarchy + honest states), WU-B (mobile Review route
 * + structured density) and WU-C (batch Gate copy). It observes the rendered
 * production UI only — no source-string snapshots — and reuses the shared
 * drivers in `./harness/flows` and the overflow oracle in `./harness/viewport`
 * instead of re-implementing them. The auto no-network fixture applies to every
 * test.
 *
 * Covered acceptance:
 *  3. all four Job kinds traverse the canonical steps in one shell;
 *  4. no horizontal overflow at 375/768/1280 for the changed states;
 *  5. mobile selection routes directly to the decision controls; desktop stays
 *     three-column and the mobile route is hidden;
 *  7. the rendered UI contains no migration-placeholder copy;
 *  8. all four POLICY-01 facts remain discoverable and job-aware;
 *  9. structured blockers / UNKNOWN / current classification / date role /
 *     patient-ID authority survive the density disclosure, fail-closed.
 */
import path from "node:path";
import type { Page } from "@playwright/test";

import { expect, test } from "./harness/fixtures";
import { assertNoHorizontalOverflow } from "./harness/viewport";
import {
  REVIEW_FIXTURE_TEXT,
  completeReview,
  createBatchJob,
  createDocumentJob,
  createStructuredJob,
  createTextJob,
  expandPolicyGuidance,
  guidanceItem,
  gotoReviewWithDetections,
  policyGuidanceList,
} from "./harness/flows";

const FIXTURES_DIR = path.resolve(__dirname, "fixtures");
const DOC_1 = path.join(FIXTURES_DIR, "batch-doc-1.txt");
const DOC_2 = path.join(FIXTURES_DIR, "batch-doc-2.txt");
const STRUCTURED_CSV = path.join(FIXTURES_DIR, "structured-unknown.csv");

/** A single document with the same four known identifiers as the text flow. */
const DOCUMENT_FILE = {
  name: "ux-closeout-document.txt",
  mimeType: "text/plain",
  buffer: Buffer.from(REVIEW_FIXTURE_TEXT),
};

/**
 * Migration-residue copy that must not survive WU-A. Deliberately broader than
 * the two literal placeholders so an "equivalent" phrasing is also caught.
 */
const MIGRATION_COPY = /not implemented yet|later V4 migration|arrives with a later V4/i;

const POLICY_NAMES = ["Estándar", "IA externa", "Investigación longitudinal", "Estricta"] as const;

/** The rendered body must never carry migration-residue copy. */
async function expectNoMigrationCopy(page: Page, label: string): Promise<void> {
  await expect(page.locator("body"), `migration copy on ${label}`).not.toContainText(
    MIGRATION_COPY
  );
}

// ---------------------------------------------------------------------------
// Acceptance 3 (and 7): all four Job kinds traverse the canonical steps.
// ---------------------------------------------------------------------------

test.describe("canonical flow traversal by Job kind", () => {
  test("text job: Input → Configure (honest) → Review → Privacy Gate → Export", async ({
    page,
  }) => {
    await gotoReviewWithDetections(page); // Input → Review (quiet shell #84)

    // Quiet shell: the no-op Configure stop is never rendered for a text job
    // (issue #84 acceptance B) — the job lands on its real Review work.
    await expect(page.getByRole("heading", { name: "Preparar datos" })).toHaveCount(0);
    await expect(page.getByRole("list", { name: "Hallazgos" })).toBeVisible();
    await completeReview(page);

    await page.getByRole("button", { name: "Comprobación de privacidad", exact: true }).click();
    await expect(
      page.getByRole("region", { name: "Punto de control de la decisión" })
    ).toContainText("Preparado");
    await expectNoMigrationCopy(page, "text Privacy Gate");

    await page.getByRole("button", { name: "Ir al resultado" }).click();
    await expect(page.getByRole("heading", { level: 2, name: "Resultado" })).toBeVisible();
    await expectNoMigrationCopy(page, "text Export");
  });

  test("document job: honest Configure and the canonical steps", async ({ page }) => {
    await createDocumentJob(page, DOCUMENT_FILE);

    // Quiet shell: the no-op Configure stop is never rendered for a document
    // job (issue #84 acceptance B) — the job lands on its real Review work.
    await expect(page.getByRole("heading", { name: "Preparar datos" })).toHaveCount(0);
    await expect(page.getByRole("list", { name: "Hallazgos" }).getByRole("button")).toHaveCount(4);
    await completeReview(page);

    await page.getByRole("button", { name: "Comprobación de privacidad", exact: true }).click();
    await expect(
      page.getByRole("region", { name: "Punto de control de la decisión" })
    ).toContainText("Preparado");
    await page.getByRole("button", { name: "Ir al resultado" }).click();
    await expect(page.getByRole("heading", { level: 2, name: "Resultado" })).toBeVisible();
  });

  test("document-batch job: direct Review landing and a fail-closed Gate", async ({ page }) => {
    await createBatchJob(page, [DOC_1, DOC_2]);

    // Quiet shell: the no-op Configure stop is never rendered for a batch
    // (issue #84 acceptance B) — the batch queue lands directly on Review.
    await expect(page.getByRole("heading", { name: "Preparar datos" })).toHaveCount(0);
    await expect(
      page.getByRole("list", { name: "Estado de los documentos del lote" })
    ).toBeVisible();
    // Wait for the async batch review to install its sessions before leaving
    // Review (the start writes the job back to the Review step).
    await expect(page.getByRole("status", { name: "Progreso de la revisión" })).toContainText(
      "Pendientes:"
    );

    await page.getByRole("button", { name: "Comprobación de privacidad", exact: true }).click();
    await expect(
      page.getByRole("group", { name: "Recuentos de documentos del lote" })
    ).toContainText("Con error: 0");
    await expect(
      page.getByRole("region", { name: "Punto de control de la decisión" })
    ).toContainText("Necesita atención");
    await expectNoMigrationCopy(page, "batch Privacy Gate");
    // The batch Result is reachable while unauthorized: it communicates
    // needs-attention without enabling artifact production.
    const exportButton = page.getByRole("button", { name: "Ir al resultado" });
    await expect(exportButton).toBeEnabled();
    await exportButton.click();
    await expect(page.getByRole("heading", { level: 2, name: "Resultado" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Requiere tu atención" })).toBeVisible();
  });

  test("structured job: comparative Configure and the structured Gate", async ({ page }) => {
    await createStructuredJob(page, STRUCTURED_CSV);

    // The structured job lands directly in its REAL comparative Configure
    // workspace (#85 owns that surface; issue #84 only removes the no-op
    // stops).
    await expect(
      page.getByRole("status", { name: "Datos de la configuración estructurada" })
    ).toBeVisible();
    await expectNoMigrationCopy(page, "structured Configure");

    // Issue #85 §3.4: with no cell routed to `process-as-text` there is no
    // «Continuar a la revisión» detour and the no-op Review never renders;
    // the canonical onward action is the factual privacy check.
    await expect(page.getByRole("button", { name: "Continuar a la revisión" })).toHaveCount(0);
    await page.getByRole("button", { name: "Comprobación de privacidad", exact: true }).click();
    await expect(
      page.getByRole("status", { name: "Datos de la salida estructurada" })
    ).toBeVisible();
    await expectNoMigrationCopy(page, "structured Privacy Gate");
  });
});

// ---------------------------------------------------------------------------
// Acceptance 4: no horizontal overflow for the changed states.
// ---------------------------------------------------------------------------

for (const width of [375, 768, 1280]) {
  test(`changed closeout states fit the viewport without horizontal overflow at ${width}px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 900 });

    // Active Review (the quiet-shell landing of a text job, issue #84),
    // including a mobile selection state.
    await gotoReviewWithDetections(page);
    await assertNoHorizontalOverflow(page, `active Review @${width}px`);
    await page.getByRole("list", { name: "Hallazgos" }).getByRole("button").first().click();
    await assertNoHorizontalOverflow(page, `Review selection @${width}px`);

    // Pending Gate.
    await page.getByRole("button", { name: "Comprobación de privacidad", exact: true }).click();
    await expect(
      page.getByRole("region", { name: "Punto de control de la decisión" })
    ).toBeVisible();
    await assertNoHorizontalOverflow(page, `pending Gate @${width}px`);

    // Completed Gate + Export.
    await page.getByRole("button", { name: "Volver a la revisión" }).click();
    await completeReview(page);
    await page.getByRole("button", { name: "Comprobación de privacidad", exact: true }).click();
    await assertNoHorizontalOverflow(page, `completed Gate @${width}px`);
    await page.getByRole("button", { name: "Ir al resultado" }).click();
    await expect(page.getByRole("heading", { level: 2, name: "Resultado" })).toBeVisible();
    await assertNoHorizontalOverflow(page, `Export @${width}px`);

    // Structured comparative Configure + its factual gate (issue #85 changed
    // state): no overflow on either changed surface.
    await createStructuredJob(page, STRUCTURED_CSV);
    await assertNoHorizontalOverflow(page, `structured Configure @${width}px`);
    await page.getByRole("button", { name: "Comprobación de privacidad", exact: true }).click();
    await expect(
      page.getByRole("status", { name: "Datos de la salida estructurada" })
    ).toBeVisible();
    await assertNoHorizontalOverflow(page, `structured Privacy Gate @${width}px`);
  });
}

// ---------------------------------------------------------------------------
// Acceptance 5: mobile action path; desktop stays three-column.
// ---------------------------------------------------------------------------

test("mobile selection routes directly to the decision controls without recording a decision", async ({
  page,
}) => {
  await page.setViewportSize({ width: 375, height: 900 });
  await gotoReviewWithDetections(page);

  const progress = page.getByRole("status", { name: "Progreso de la revisión" });
  await expect(progress).toContainText("Pendientes: 4");

  await page.getByRole("list", { name: "Hallazgos" }).getByRole("button").first().click();

  const jump = page.locator(
    'button:has-text("Ir a los controles de decisión del hallazgo seleccionado")'
  );
  await expect(jump).toBeVisible();
  await jump.click();

  // Focus is handed to the inspector, so the decision controls are directly operable.
  const inspector = page.getByRole("complementary", { name: "Inspector del hallazgo" });
  await expect(inspector).toBeFocused();
  await expect(inspector.getByRole("button", { name: "Aceptar detección" })).toBeVisible();

  // The route is navigation only: selection never records a decision.
  await expect(progress).toContainText("Pendientes: 4");
});

test("desktop Review stays three-column and hides the mobile route", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await gotoReviewWithDetections(page);
  await page.getByRole("list", { name: "Hallazgos" }).getByRole("button").first().click();

  const workspace = page.getByRole("region", { name: "Espacio de revisión" });
  await expect(workspace).toHaveClass(/sx-review-grid/);
  // The observable desktop contract is three computed CSS grid columns at 1280px.
  const columnCount = await workspace.evaluate(
    (element) => getComputedStyle(element).gridTemplateColumns.split(" ").length
  );
  expect(columnCount).toBe(3);

  const jump = page.locator(
    'button:has-text("Ir a los controles de decisión del hallazgo seleccionado")'
  );
  await expect(jump).toBeHidden();
});

// ---------------------------------------------------------------------------
// Acceptance 8 (and 7): POLICY-01 facts remain discoverable and job-aware.
// ---------------------------------------------------------------------------

for (const width of [375, 1280]) {
  test(`POLICY-01 facts remain discoverable and job-aware at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });

    const region = page.getByRole("region", { name: "Política de privacidad" });
    const list = policyGuidanceList(page);

    // No job: four entries and an honest no-availability note. The detailed
    // cards are on demand behind the disclosure (CORA-84-01).
    await page.goto("/");
    await expandPolicyGuidance(page);
    await expect(list.getByRole("listitem")).toHaveCount(4);
    await expect(region).toContainText(
      "Cree un trabajo para ver qué políticas están disponibles para su tipo."
    );

    // Text job: all four entries, all four available (REC-02), current policy.
    await createTextJob(page);
    await expandPolicyGuidance(page);
    await expect(list.getByRole("listitem")).toHaveCount(4);
    for (const name of POLICY_NAMES) {
      await expect(guidanceItem(page, name)).toContainText("Disponible");
    }
    await expect(region).toContainText("Política actual: Estándar");

    // Structured job: all four available and the patient-ID requirement is
    // job-aware (present exactly for the per-patient shift policies).
    await createStructuredJob(page, STRUCTURED_CSV);
    await expandPolicyGuidance(page);
    await expect(list.getByRole("listitem")).toHaveCount(4);
    for (const name of POLICY_NAMES) {
      await expect(guidanceItem(page, name)).toContainText("Disponible");
    }
    await expect(region).toContainText("Política actual: Estándar");
    await expect(guidanceItem(page, "IA externa")).toContainText(
      "Requiere una columna explícita de identificador de paciente."
    );
    await expect(guidanceItem(page, "Investigación longitudinal")).toContainText(
      "Requiere una columna explícita de identificador de paciente."
    );
    await expect(guidanceItem(page, "Estándar")).not.toContainText(
      "Requiere una columna explícita de identificador de paciente."
    );
    await expectNoMigrationCopy(page, `policy workspace @${width}px`);
  });
}

// ---------------------------------------------------------------------------
// Acceptance 9 (and 7): structured authority survives the density disclosure.
// ---------------------------------------------------------------------------

test("structured Configure keeps UNKNOWN, blockers and authority facts reachable with the disclosure closed and open", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await createStructuredJob(page, STRUCTURED_CSV);

  const summary = page.getByRole("status", { name: "Datos de la configuración estructurada" });
  await expect(summary).toContainText("Columnas que requieren revisión: 1");
  await expect(summary).toContainText("Exportación estructurada preparada: No");

  // Fail-closed blocker is visible without opening any disclosure.
  await expect(
    page.getByRole("alert", { name: "Motivos de bloqueo de la exportación estructurada" })
  ).toContainText("La salida estructurada está bloqueada mientras 1 columna requiere revisión.");

  const freeRow = page
    .getByRole("table", { name: "Lista de clasificación de columnas" })
    .locator("tbody tr")
    .filter({ hasText: "CampoLibre1" });

  // Authority facts that must never read as a false-ready state:
  await expect(freeRow).toContainText("Requiere revisión");
  await expect(freeRow).toContainText("Desconocido");

  // The date-role fact and secondary evidence live in the selected column's
  // inspector; the date role stays outside the disclosure, the proposed
  // action only behind it.
  await freeRow.getByRole("button", { name: "CampoLibre1" }).click();
  const inspector = page.getByRole("complementary", { name: "Inspector de columna" });
  await expect(inspector.getByText("Rol de fecha:")).toBeVisible();

  await expect(inspector.getByText("Acción propuesta:")).toBeHidden();
  await inspector.locator("summary").click();
  await expect(inspector.getByText("Acción propuesta:")).toBeVisible();
  await expect(inspector).toContainText("Acción propuesta:Requiere revisión");

  // The single patient-ID authority and its current status stay shown once.
  const authority = page.getByRole("region", {
    name: "Autoridad de identificación del paciente",
  });
  await expect(authority).toBeVisible();
  await expect(authority.getByLabel("Columna de identificación del paciente")).toBeVisible();
  await expect(authority).toContainText(/Aún no hay columna seleccionada|Seleccionada:/);

  await expectNoMigrationCopy(page, "structured Configure");
});
