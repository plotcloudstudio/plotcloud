const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {chromium}=require('playwright');
const inventory=require('../ui/inventory.json');
const {resourceAccessFixture,cacheCDN}=require('./resource-access-fixture.cjs');
const paidEngines=['furniture','facade','detaillab','topo','stairs3d','doors3d'];
const base=process.env.TEST_BASE||'http://127.0.0.1:8765';
let currentTarget='browser startup';
(async()=>{
 const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||undefined,headless:true,args:['--no-sandbox','--enable-unsafe-swiftshader']});
 const results=[];const members=await browser.newContext({viewport:{width:1440,height:900}});await resourceAccessFixture(members);await cacheCDN(members);
 try{
  const context=await browser.newContext({viewport:{width:1440,height:900}});await cacheCDN(context);
  for(const host of inventory.hosts){
   currentTarget=host.file;
   const resource=paidEngines.find(id=>host.file==='emb/'+id+'.html');
   const page=await(resource?members:context).newPage();const errors=[];let target=page;page.on('pageerror',e=>errors.push(e.message));
   try{
    const url=host.file==='index.html'?'/index.html#/home':host.url;
    await page.goto(base+(resource?'/mvp/#/resources/tool/'+resource:url),{waitUntil:'domcontentloaded'});
    if(resource){const frame=await page.locator('#resourceEngine').elementHandle();target=await frame.contentFrame();}
    await target.waitForFunction(()=>window.PlotCloudUI?.version===1);
    const actual=await target.evaluate(()=>({surface:document.documentElement.dataset.pcSurface,font:getComputedStyle(document.body).fontFamily,text:getComputedStyle(document.body).color,scheme:getComputedStyle(document.documentElement).colorScheme,switches:document.querySelectorAll('#themeSeg,.pc-ui-theme').length}));
    assert.equal(actual.surface,host.surface);assert(actual.font.includes('Inter'));assert.equal(actual.text,'rgb(32, 36, 43)');assert.equal(actual.scheme,'light');assert.equal(actual.switches,0);
    results.push({file:host.file,status:'passed',pageErrors:errors});
   }catch(error){results.push({file:host.file,status:'failed',reason:error.message,pageErrors:errors})}
   finally{await page.close()}
  }
  // Verify every top-level route, not only the shared shell's initial page.
  const routeChecks=[];
  for(const url of [...inventory.mvpRoutes,...inventory.classicRoutes,...inventory.classicToolRoutes]){
   currentTarget=url;
   const routePage=await context.newPage();const errors=[];routePage.on('pageerror',e=>errors.push(e.message));
   await routePage.goto(base+url,{waitUntil:'domcontentloaded'});
   await routePage.waitForFunction(()=>window.PlotCloudUI?.version===1);
   await routePage.locator('#app').waitFor({state:'attached'});
   await routePage.waitForFunction(()=>document.querySelector('#app')?.children.length>0);
   assert((await routePage.locator('#app').innerText()).trim().length>10||await routePage.locator('#app iframe[data-emb]').count()>0,url+' must contain content or its embedded tool');
   assert.equal(await routePage.evaluate(()=>getComputedStyle(document.documentElement).colorScheme),'light');
   assert.deepEqual(errors,[],url+' startup errors');routeChecks.push(url);
   await routePage.close();
  }
  const p=await context.newPage();await p.goto(base+'/mvp/#/resources');await p.waitForFunction(()=>window.PlotCloudUI?.version===1);
  assert.equal(await p.locator('#nav [data-nav="workspace"]').count(),0);   // the Workspace is reached from the Dashboard (2026-10-30)
  assert.equal(await p.locator('#nav [data-nav="workspace-v2"]').count(),0);
  assert.equal(await p.locator('#themeSeg').count(),0);
  await p.goto(base+'/index.html#/studio');
  await p.frameLocator('#fPlan').locator('[data-pc-ui]').waitFor();
  const frame=await p.locator('#fPlan').elementHandle();assert.equal(await(await frame.contentFrame()).evaluate(()=>getComputedStyle(document.documentElement).colorScheme),'light');
  await p.close();
  fs.mkdirSync('/tmp/plotcloud-ui',{recursive:true});fs.writeFileSync('/tmp/plotcloud-ui/inventory-results.json',JSON.stringify({hosts:results,routes:routeChecks},null,2));
  results.forEach(r=>console.log(r.status.toUpperCase(),r.file,r.reason||'',r.pageErrors.length?'PAGE ERRORS: '+r.pageErrors.join(' | '):''));
  assert.equal(results.filter(r=>r.status==='failed').length,0,'Every inventory host must load the common UI and light appearance');
  console.log('PASS all '+results.length+' UI hosts and '+routeChecks.length+' site routes, light appearance, public workspace navigation and embedded light appearance. Host checks validate UI integration; they are not functional analysis-engine tests.');
 }finally{await browser.close()}
})().catch(e=>{
 console.error('UI check target:',currentTarget);console.error(e);
 if(process.env.GITHUB_ACTIONS){const message=('Target '+currentTarget+'\n'+(e.stack||e.message)).replace(/%/g,'%25').replace(/\r/g,'%0D').replace(/\n/g,'%0A');console.error('::error title=UI inventory failed::'+message)}
 process.exitCode=1;
});
