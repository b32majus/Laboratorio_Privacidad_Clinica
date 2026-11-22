/* Offline R6 visual evidence. No server, no real patients, no data transport. */
const { chromium } = require("playwright");
const path = require("path");
const fs = require("fs");
const assert = require("node:assert/strict");
const HERE=__dirname;
const output=path.join(HERE,"capturas");
const url="file://"+path.join(HERE,"maqueta.html");
fs.mkdirSync(output,{recursive:true});
async function main() {
const browser=await chromium.launch({headless:true});
let count=0;
try {
  for(const [width,height] of [[375,800],[320,760],[1440,900]]) {
    const page=await browser.newPage({viewport:{width,height},deviceScaleFactor:1,reducedMotion:"reduce"});
    const failures=[];
    page.on("pageerror",error=>failures.push(String(error)));
    page.on("request",request=>{if(!request.url().startsWith("file:"))failures.push("External request "+request.url());});
    await page.goto(url,{waitUntil:"load"});
    await page.locator("#column-rows tr").first().waitFor();
    await page.evaluate(()=>document.fonts.ready);
    let snapshot=await page.evaluate(()=>{
      const pos=selector=>{
        const r=document.querySelector(selector)?.getBoundingClientRect();
        return r?{x:r.x,y:r.y,width:r.width,height:r.height}:null;
      };
      return {
        viewport:innerWidth,
        scrollWidth:document.documentElement.scrollWidth,
        pendingCount:document.querySelectorAll("#column-rows tr td:last-child").length,
        active:document.getElementById("active-name").textContent,
        exportDisabled:document.querySelector(".bottom-action").disabled,
        activePanel:pos("#decision"),
        classificationSelect:pos("#class-select"),
        patientAuthority:pos(".patient-card"),
        listTable:pos(".table-card"),
        statusBanner:pos(".status-card")
      };
    });
    assert.equal(snapshot.scrollWidth,width,"body horizontal overflow at "+width);
    assert.equal(snapshot.pendingCount,32,"32 visible rows initially");
    assert.equal(snapshot.active,"Fecha_Visita","initial selected column");
    assert(snapshot.exportDisabled,"export action unavailable");
    if(width===375){
      assert(snapshot.activePanel.y<500,"Decision visible early in 375 viewport");
      assert(snapshot.classificationSelect.y<800,"Classification select within first viewport");
      assert(snapshot.statusBanner.y<320,"Realistic blockers remain early");
    }
    await page.screenshot({path:path.join(output,"r6-"+width+"-viewport.png"),animations:"disabled"});
    if(width!==1440)await page.screenshot({path:path.join(output,"r6-"+width+"-full.png"),fullPage:true,animations:"disabled"});
    // Column-selection interaction: presentational only. Never alters the block counter.
    await page.locator('#column-rows button').nth(6).click();
    assert.equal(await page.locator("#active-name").textContent(),"Notas");
    assert.equal(await page.locator("#class-select").inputValue(),"Desconocido");
    await page.locator('#class-select').selectOption({label:"No sensible"});
    assert.equal(await page.locator("#class-select").inputValue(),"Desconocido","mock must not accept class changes");
    assert((await page.locator(".status-card").innerText()).includes("19"),"no fake reduction");
    await page.locator('button[data-filter="pending"]').click();
    assert.equal(await page.locator("#column-rows tr").count(),19,"pending-only filter");
    await page.locator('button[data-filter="all"]').click();
    assert.equal(await page.locator("#column-rows tr").count(),32,"recover all rows");
    assert.equal(await page.locator("#patient-id-column").inputValue(),"Sin seleccionar");
    assert.deepEqual(failures,[],"JS or external resource failures");
    fs.writeFileSync(path.join(output,"metrics-"+width+".json"),JSON.stringify(snapshot,null,2));
    console.log("PASS",width,JSON.stringify(snapshot));
    count++;
    await page.close();
  }
} finally {await browser.close()}
console.log("R6_OFFLINE_CAPTURE_PASS",count,"/3 with selection, controls inert, no overflow, no network");
}
main().catch(error=>{console.error(error);process.exitCode=1});
