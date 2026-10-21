const assert=require('node:assert/strict'),{chromium}=require('playwright');
const base=process.env.TEST_BASE||'http://127.0.0.1:8765';
(async()=>{const browser=await chromium.launch({headless:true,args:['--no-sandbox']});const page=await browser.newPage({viewport:{width:1440,height:900},acceptDownloads:true}),errors=[];page.on('pageerror',e=>errors.push(e.message));
try{
 await page.goto(base+'/#/tools');await page.getByText('indoor acoustics',{exact:true}).first().waitFor();
 await page.goto(base+'/#/tool/acoustics');const work=await(await page.locator('iframe[data-emb="acoustics"]').elementHandle()).contentFrame();await work.waitForFunction(()=>!!window.__acoustics?.result);
 let state=await work.evaluate(()=>({metrics:window.__acoustics.result.metrics,paths:window.__acoustics.result.paths.length,limits:window.__acoustics.result.limits}));
 for(const value of Object.values(state.metrics))assert(Number.isFinite(value),'Acoustic metric must be finite');assert(state.paths>0&&state.paths<=900,'Displayed path cap failed');assert.equal(state.limits.rays,4096);
 const studio={name:'Studio acoustic room',bounds:{w:12,h:8},walls:[{a:[0,0],b:[12,0],h:3},{a:[12,0],b:[12,8],h:3},{a:[12,8],b:[0,8],h:3},{a:[0,8],b:[0,0],h:3}],furn:[],source:{app:'plotcloud-studio',project:'p1',version:7,level:'L1'}};
 await work.evaluate(s=>window.__acoustics.load(s,s.source),studio);state=await work.evaluate(()=>window.__acoustics.result);assert.equal(state.sourceRecord.version,7);assert.equal(state.scene,'Studio acoustic room');assert(/version 7/.test(await work.locator('#source').innerText()));
 const before=state.metrics.rt60;await work.locator('#finish').selectOption('soft');await work.locator('#run').click();const after=await work.evaluate(()=>window.__acoustics.result.metrics.rt60);assert(after<before,'Absorptive finish should lower RT60');
 for(const v of ['section','three','plan']){await work.locator(`[data-view="${v}"]`).click();assert.equal(await work.locator(`[data-view="${v}"]`).getAttribute('class'),'on');}
 await work.locator('#reset').click();assert.equal(await work.evaluate(()=>window.__acoustics.result.scene),'Studio sample room');assert.equal(await work.locator('#height').inputValue(),'3');
 await page.setViewportSize({width:390,height:844});assert(await work.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'Acoustic tool overflows mobile width');assert.deepEqual(errors,[],'Browser errors: '+errors.join(' | '));
 console.log('PASS acoustic tool route, finite metrics, path caps, Studio provenance, finish comparison, views, reset and responsive layout');
}finally{await browser.close()}})().catch(e=>{console.error(e.stack||e);process.exit(1)});
