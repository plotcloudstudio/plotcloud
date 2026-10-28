const assert=require('node:assert/strict'),fs=require('node:fs'),{chromium}=require('playwright');
const {destination}=require('../legacy-redirect.js');
const {resourceAccessFixture,cacheCDN}=require('./resource-access-fixture.cjs');
const base=process.env.TEST_BASE||'http://127.0.0.1:8765';
(async()=>{
 const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||undefined,headless:true,args:['--no-sandbox','--enable-unsafe-swiftshader']});
 const context=await browser.newContext({viewport:{width:1440,height:1000},acceptDownloads:true});await resourceAccessFixture(context);await cacheCDN(context);
 const page=await context.newPage(),errors=[],oldRequests=[];
 page.on('pageerror',e=>errors.push(e.message));page.on('request',r=>{if(/index\.html(?:[?#]|$)/.test(r.url()))oldRequests.push(r.url());});
 const open=async route=>{await page.goto(base+'/mvp/#/'+route);await page.locator('.resource-page,.resource-engine').waitFor();};
 try{
  await open('resources');await page.locator('.resource-card').first().waitFor();
  assert.equal(await page.locator('.resource-card').count(),19);
  assert.equal(new Set((await page.request.get(base+'/mvp/resource-catalog.json').then(r=>r.json())).items.map(x=>x.id)).size,19,'Every catalog item must have a unique stable ID');
  assert.equal(await page.locator('#app a[href*="index.html"]').count(),0);
  assert.equal(await page.locator('#app a[href*="studio"],#app a[href*="render"],#app a[href*="composer"],#app a[href*="atlas"]').count(),0);
  assert.equal(await page.locator('#nav').getByRole('link',{name:/All tools/}).count(),0);
  const links=await page.locator('.resource-tools a').evaluateAll(a=>a.map(x=>x.getAttribute('href')));assert.equal(links.length,13);
  await page.locator('#resourceCategory').selectOption('cad');assert.equal(await page.locator('.resource-card').count(),2);
  await page.locator('#resourceSearch').fill('stair');assert.equal(await page.locator('.resource-card').count(),1);
  await page.reload();await page.locator('.resource-card').waitFor();assert.equal(await page.locator('#resourceCategory').inputValue(),'cad');
  await page.locator('.resource-card').click();await page.getByRole('heading',{name:'Stair & Railing CAD Blocks',exact:true}).waitFor();
  assert.match(await page.locator('.resource-notice').innerText(),/No source file/);
  assert.equal(await page.getByRole('link',{name:/Sign up.*download/i}).count(),0);
  const metadata=page.waitForEvent('download');await page.locator('#resourceMeta').click();const file=await metadata;
  const record=JSON.parse(fs.readFileSync(await file.path(),'utf8'));assert.equal(record.id,'stair-railing-cad-blocks');assert.deepEqual(record.formats,['dwg']);
  await open('resources/showroom');assert.equal(await page.locator('.resource-section').count(),2);assert(await page.locator('.resource-card').count()>10);

  const preserved={role:'member',saved:['lounge-chair-set'],cms:{res:{'custom-chair':{title:'My preserved chair',cat:'rhino',fmts:['3dm'],desc:'User metadata',status:'published'}}}};
  await page.evaluate(s=>localStorage.setItem('pc-proto',s),JSON.stringify(preserved));
  await open('resources/item/custom-chair');assert.equal(await page.getByRole('heading',{name:'My preserved chair',exact:true}).count(),1);
  assert.deepEqual(await page.evaluate(()=>JSON.parse(localStorage.getItem('pc-proto'))),preserved);

  for(const href of links){
   await open(href.replace(/^#\//,''));
   if(['furniture','facade','detaillab','topo','stairs3d','doors3d'].some(id=>href.endsWith('/tool/'+id))){
    await page.frameLocator('#resourceEngine').locator('body').waitFor();
    assert.equal(await page.locator('#resourceEngine').evaluate(f=>f.getAttribute('src').startsWith('../emb/')),true);
   }else await page.locator('#utilityBody').waitFor();
  }
  assert.deepEqual(oldRequests,[],'Resources must never load the retired index page');
  for(const [id,selector] of [['furniture','.export'],['stairs3d','.export'],['doors3d','.export'],['facade','#dlBtn'],['topo','#exportBtn'],['detaillab','#xJSON']]){
   await open('resources/tool/'+id);const frame=page.frameLocator('#resourceEngine');
   await frame.locator(selector).waitFor();
   await frame.locator('html').evaluate(()=>new Promise(resolve=>document.readyState==='complete'?resolve():window.addEventListener('load',resolve,{once:true})));
   if(id!=='furniture'&&await frame.locator('#fmt-3dm').count())await frame.locator('#fmt-3dm').uncheck();
   const result=page.waitForEvent('download',{timeout:60000});await frame.locator(selector).click();
   const file=await result,bytes=fs.readFileSync(await file.path());assert(bytes.length>100,id+' exports actual generated data');
   if(id==='detaillab')assert.equal(JSON.parse(bytes).app,'PlotCloud DetailLab');
   else {assert(file.suggestedFilename().endsWith('.zip'));assert.equal(bytes.subarray(0,2).toString(),'PK');}
   if(id==='furniture'){const {unzipSync}=await import('../furniture/fflate.js');const files=Object.keys(unzipSync(bytes));for(const ext of ['.obj','.stl','.3dm'])assert(files.some(f=>f.endsWith(ext)),'Furniture package includes '+ext);}
  }
  await open('resources/tool/scale');assert.match(await page.locator('#scaleResult').innerText(),/100.00 mm/);
  await page.locator('#realLength').fill('5');assert.match(await page.locator('#scaleResult').innerText(),/50.00 mm/);
  await open('resources/tool/ergo');await page.locator('#ergoSearch').fill('counter');assert.match(await page.locator('#ergoResults').innerText(),/Counter height/);
  await open('resources/tool/code-bc');await page.locator('#refSearch').fill('stair');assert(await page.locator('.resource-reference').count()>0);assert.match(await page.locator('.resource-notice').innerText(),/Archived/);
  await open('resources/tool/leed');await page.locator('[data-credit]').first().fill('1');assert.match(await page.locator('#leedTotal').innerText(),/Selected: 1/);
  await open('resources/tool/palette');await page.locator('#paletteCount').fill('3');assert.equal(await page.locator('[data-colour]').count(),3);
  const svg=page.waitForEvent('download');await page.locator('#paletteExport').click();assert((await svg).suggestedFilename().endsWith('.svg'));
  await open('resources/tool/axon');const png=await page.evaluate(()=>{const c=document.createElement('canvas');c.width=400;c.height=200;const x=c.getContext('2d');x.fillStyle='#3498db';x.fillRect(0,0,400,200);return c.toDataURL().split(',')[1];});
  await page.locator('#axonFiles').setInputFiles([{name:'plan.png',mimeType:'image/png',buffer:Buffer.from(png,'base64')},{name:'analysis.png',mimeType:'image/png',buffer:Buffer.from(png,'base64')}]);
  await page.waitForFunction(()=>!document.querySelector('#axonExport').disabled);const image=page.waitForEvent('download');await page.locator('#axonExport').click();assert(fs.readFileSync(await(await image).path()).length>10000);
  await page.setViewportSize({width:390,height:844});await open('resources/files');await page.locator('.resource-card').first().waitFor();assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+2));
  await page.setViewportSize({width:1440,height:1000});
  for(const [old,next] of [['library','resources/files'],['res/lounge-chair-set','resources/item/lounge-chair-set'],['showroom/reading-room','resources/showroom/reading-room'],['tool/render','resources'],['tool/composer','resources'],['tool/atlas?d=boards','resources'],['tool/studio','resources']]){
   assert.equal(destination('#/'+old),'#/'+next);await page.goto(base+'/index.html#/'+old);await page.waitForURL('**/mvp/#/'+next);await page.locator('.resource-page').waitFor();
  }
  await page.goto(base+'/index.html#/studio');await page.waitForURL('**/mvp/#/workspace');await page.waitForFunction(()=>window.__ws2?.ready(),null,{timeout:90000});
  assert.equal(await page.locator('#fPlan,#fPersp,#fProps').count(),3,'Workspace retains its shared engine');
  assert.equal(await page.locator('a[href*="index.html"],a[href="workspace.html"]').count(),0);
  for(const f of ['render','atlas','composer','studio'])assert.equal((await page.request.get(base+'/emb/'+f+'.html')).status(),404,'Retired page '+f+' must be deleted');
  assert.deepEqual(await page.evaluate(()=>JSON.parse(localStorage.getItem('pc-proto'))),preserved);
  assert.deepEqual(errors,[]);
  console.log('PASS native Resources: all 19 records, 9 categories, 13 tool/reference links, metadata export, local data preservation, filters/reload, collections, utility calculations/exports, mobile, legacy redirects and shared Workspace');
 }finally{await browser.close()}
})().catch(e=>{console.error(e);process.exitCode=1});
