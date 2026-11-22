/**
 * R3 Sophilux — reproducible visual witness, not an application E2E.
 * Run from repo root with local Playwright installed:
 *   node docs/evidence/issue92-r3-sophilux-maqueta-20261121/capture.cjs
 * Only synthetic data and local file:/// resources. No app server or PHI.
 */
const { chromium } = require("playwright");
const { pathToFileURL } = require("node:url");
const fs = require("node:fs");
const path = require("node:path");
const assert = require("node:assert/strict");

const dir = __dirname;
const file = pathToFileURL(path.join(dir, "maqueta.html")).href;
const outputDir = path.join(dir, "capturas");
fs.mkdirSync(outputDir, { recursive: true });

(async () => {
  const browser = await chromium.launch({ headless: true });
  const views = [
    ["revision", "revision", "ready"],
    ["celdas", "celdas", "ready"],
    ["resultado-listo", "resultado", "ready"],
    ["resultado-pendiente", "resultado", "needs"],
    ["resultado-bloqueado", "resultado", "blocked"],
  ];
  const results = [];
  let anyFailed = false;
  try {
    for (const width of [1440, 375]) {
      const height = width === 1440 ? 900 : 800;
      const page = await browser.newPage({ viewport: { width, height }, deviceScaleFactor: 1 });
      const blockedExternal = [];
      const pageErrors = [];
      page.on("request", req => {
        if (!req.url().startsWith("file://")) blockedExternal.push(req.url());
      });
      page.on("pageerror", error => pageErrors.push(error.message));
      for (const [name, view, state] of views) {
        const uri = file + "?vista=" + view + "&estado=" + state;
        await page.goto(uri, { waitUntil: "load" });
        await page.evaluate(() => document.fonts.ready);
        await page.locator(".r3-head, .r3-result-eyebrow").first().waitFor();
        const summary = await page.evaluate(() => {
          const rect = (selector) => {
            const el = document.querySelector(selector);
            if (!el) return null;
            const b = el.getBoundingClientRect();
            return { x: Math.round(b.x), y: Math.round(b.y), width: Math.round(b.width), height: Math.round(b.height) };
          };
          return {
            innerWidth: innerWidth,
            scrollWidth: document.documentElement.scrollWidth,
            title: document.title,
            activeView: document.body.dataset.activeView,
            reviewDecisionButtons: rect(".r3-review-grid .decision-options"),
            reviewFindings: rect(".r3-findings-list"),
            cellDecisionButtons: rect(".r3-cell-inspector .decision-options"),
            cellContent: rect(".r3-cell-content"),
            resultPrimary: rect(".r3-result-hero .btn-primary"),
            resultKeepWarning: rect(".r3-result-banner"),
            safePreviewCount: document.querySelectorAll(".prepared-note").length,
            safeMarkerExists: document.body.textContent.includes("contacto-demo@ejemplo.invalid"),
            activeFonts: {
              inter: document.fonts.check('400 14px "Inter"'),
              cormorant: document.fonts.check('600 28px "Cormorant Garamond"'),
            },
          };
        });
        try {
          assert.equal(summary.scrollWidth, width, name + " horizontal overflow at " + width);
          assert.deepEqual(blockedExternal, [], name + " external resource request");
          assert.deepEqual(pageErrors, [], name + " JS error");
          if (view === "revision") {
            assert.equal(await page.locator(".detection-items button").count(), 24);
            assert.ok(summary.reviewDecisionButtons);
            assert.ok(summary.reviewFindings);
          }
          if (view === "celdas") {
            assert.equal(await page.locator(".r3-cell-queue .cell-item").count(), 2);
            assert.ok(summary.cellDecisionButtons);
            assert.ok(summary.cellContent);
          }
          if (view === "resultado") {
            assert.equal(summary.safePreviewCount, state === "ready" ? 1 : 0);
            assert.equal(summary.safeMarkerExists, state === "ready");
            if (state === "ready") {
              assert.ok(summary.resultPrimary);
              assert.ok(summary.resultKeepWarning);
            } else {
              assert.equal(summary.resultPrimary, null);
              assert.equal(await page.locator(".r3-format-list button:not([disabled])").count(), 0);
              assert.equal(await page.locator(".r3-confidential button:not([disabled])").count(), 0);
            }
          }
          if (width === 375 && view === "revision")
            assert.ok(summary.reviewDecisionButtons.y < height, "review choices below first mobile viewport");
          if (width === 375 && view === "celdas")
            assert.ok(summary.cellDecisionButtons.y < height, "cell choices below first mobile viewport");
          if (width === 375 && view === "resultado" && state === "ready") {
            assert.ok(summary.resultPrimary.y < height, "primary result action below mobile viewport");
            assert.ok(summary.resultKeepWarning.y < height, "kept-original warning below mobile viewport");
          }
        } catch (error) {
          console.error("FAIL", name, width, error.message);
          anyFailed = true;
        }
        const basename = name + "-" + width;
        await page.screenshot({ path: path.join(outputDir, basename + ".png"), fullPage: false, animations: "disabled" });
        if (["revision", "celdas", "resultado-listo"].includes(name))
          await page.screenshot({ path: path.join(outputDir, basename + "-completa.png"), fullPage: true, animations: "disabled" });
        results.push({ scenario: name, viewport: width + "x" + height, ...summary });
        console.log(basename, JSON.stringify(summary));
      }
      // Interaction witness: changing the selected finding must change the
      // contextual inspector and highlight the same synthetic token in source.
      await page.goto(file + "?vista=revision", { waitUntil: "load" });
      await page.locator('[data-finding="23"]').click();
      assert.ok((await page.locator(".decision-excerpt").innerText()).includes("DATO FICTICIO 24"));
      assert.ok((await page.locator(".r3-active-mark").innerText()).includes("DATO FICTICIO 24"));
      const selectedInPane = await page.evaluate(() => {
        const a = document.querySelector(".r3-active-mark").getBoundingClientRect();
        const b = document.querySelector(".r3-review-grid .pane-scroll").getBoundingClientRect();
        return { selectedVisible: a.top >= b.top - 2 && a.bottom <= b.bottom + 2 };
      });
      if (width > 850) assert.ok(selectedInPane.selectedVisible, "selected synthetic finding scroll position");
      await page.locator('[data-view="celdas"]').click();
      assert.ok((await page.locator("h1").innerText()).includes("Cada celda"));
      await page.locator('[data-view="resultado"]').click();
      await page.locator('[data-state="blocked"]').click();
      assert.equal(await page.locator(".prepared-note").count(), 0);
      await page.locator('[data-state="ready"]').click();
      assert.equal(await page.locator(".prepared-note").count(), 1);
      await page.locator(".r3-result-hero [data-demo]").first().click();
      assert.ok((await page.locator("#toast").innerText()).includes("Maqueta visual"));
      // All comparison images must resolve without a server or network.
      await page.goto(pathToFileURL(path.join(dir, "comparador.html")).href, { waitUntil: "load" });
      const comparisonImages = await page.evaluate(async () => {
        await Promise.all(Array.from(document.images, img => img.decode()));
        return Array.from(document.images, img => ({ complete: img.complete, width: img.naturalWidth }));
      });
      assert.equal(comparisonImages.length, 9);
      assert.ok(comparisonImages.every(item => item.complete && item.width > 0));
      assert.deepEqual(blockedExternal, [], "comparison has no external resources");
      assert.deepEqual(pageErrors, [], "comparison has no script errors");
      console.log("INTERACTION + COMPARATOR", width, "PASS (24th mark, scenario states, 9 images)");
      await page.close();
    }
  } finally { await browser.close(); }
  fs.writeFileSync(path.join(outputDir, "medidas.json"), JSON.stringify({ syntheticOnly: true, generatedAt: new Date().toISOString(), scenarios: results }, null, 2) + "\n");
  if (anyFailed) process.exitCode = 1;
  else console.log("R3 MOCK: 10/10 escenarios VISUALES, cero overflow/external, Safe sin DOM en no-ready.");
})().catch(error => { console.error(error); process.exitCode = 1; });
