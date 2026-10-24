// Acceptance checks for the current finite-facet acoustic study, replacing its retired v1 API.
const assert=require('node:assert/strict'),fs=require('node:fs'),{chromium}=require('playwright');
const base=process.env.TEST_BASE||'http://127.0.0.1:8765';
(async()=>{const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||undefined,headless:true,args:['--no-sandbox','--enable-unsafe-swiftshader']});const page=await browser.newPage({viewport:{width:1440,height:900},acceptDownloads:true}),errors=[];page.on('pageerror',e=>errors.push(e.message));
try{
 await page.goto(base+'/mvp/#/simulations');await page.locator('a[href="#/simulations/acoustics"]').first().waitFor();
 await page.goto(base+'/index.html#/tool/acoustics');const work=await(await page.locator('iframe[data-emb="acoustics"]').elementHandle()).contentFrame();
 await work.waitForFunction(()=>!!window.AcousticStudy?.stats);
 let report=await work.evaluate(()=>AcousticStudy.report());
 for(const value of report.statistics.rt)assert(Number.isFinite(value)&&value>0,'RT60 bands must be finite and positive');
 for(const key of ['spl','c50','d50'])assert(Number.isFinite(report.result[key]),key+' must be finite');
 assert(report.result.arrivals.length>0,'Receiver must have valid arrivals');assert.equal(report.animation.maxOrder,3);
 const studio={name:'Studio acoustic room',walls:[{a:[0,0],b:[12,0],h:3},{a:[12,0],b:[12,8],h:3},{a:[12,8],b:[0,8],h:3},{a:[0,8],b:[0,0],h:3}],source:{app:'plotcloud-studio',project:'p1',version:7,level:'L1'}};
 await work.evaluate(s=>AcousticStudy.loadPlan(s,s.source),studio);report=await work.evaluate(()=>AcousticStudy.report());
 assert.equal(report.model.name,studio.name);assert.equal(report.statistics.volume,288);assert(report.model.record.includes('"version":7'),'Imported source record must retain version');
 const before=report.statistics.rt[2];
 await work.locator('#panelL .pc-fit-tabs').getByRole('tab',{name:'Surfaces',exact:true}).click();
 await work.locator('#allWalls').click();await work.locator('#wallMat').selectOption('panel');
 const after=await work.evaluate(()=>AcousticStudy.stats.rt[2]);assert(after<before,'Absorptive wall material should lower RT60');
 for(const view of ['section','three','plan']){await work.locator(`[data-view="${view}"]`).click();assert.equal(await work.locator(`[data-view="${view}"]`).getAttribute('aria-pressed'),'true');}
 assert(await work.locator('#webgl canvas').count(),'3D view must create its real WebGL canvas');
 await work.locator('#panelR .pc-fit-tabs').getByRole('tab',{name:'Export',exact:true}).click();
 const download=page.waitForEvent('download');await work.locator('#json').click();const file=await download;
 assert.equal(file.suggestedFilename(),'plotcloud-indoor-acoustics-report.json');
 const exported=JSON.parse(fs.readFileSync(await file.path(),'utf8'));assert.equal(exported.schema,'plotcloud-acoustics-prototype-v2');assert.equal(exported.model.name,studio.name);assert.equal(exported.statistics.rt[2],after);
 assert(/no diffraction/i.test(exported.assumptions),'Report must preserve method limitations');
 await work.locator('#panelL .pc-fit-tabs').getByRole('tab',{name:'Room & source',exact:true}).click();
 await work.locator('#reset').click();assert.equal(await work.locator('#time').inputValue(),'0','Reset returns animation to the start');
 await page.setViewportSize({width:390,height:844});assert(await work.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'Acoustic tool overflows mobile width');
 assert.deepEqual(errors,[],'Browser errors: '+errors.join(' | '));
 console.log('PASS acoustic route, finite band results, imported provenance, material comparison, actual 3D view, report download, animation reset and narrow layout');
}finally{await browser.close()}})().catch(e=>{console.error(e.stack||e);process.exit(1)});
