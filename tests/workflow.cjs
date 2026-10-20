const assert=require('assert'),fs=require('fs'),{chromium}=require('playwright');
const base=process.env.TEST_BASE||'http://127.0.0.1:8765';
let pixel='data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a5X8AAAAASUVORK5CYII=';
(async()=>{
const browser=await chromium.launch({headless:true,args:['--no-sandbox','--enable-unsafe-swiftshader']});
const page=await browser.newPage({viewport:{width:1440,height:1000},acceptDownloads:true}),errors=[];
page.on('pageerror',e=>{errors.push(e.message);console.error('PAGE ERROR',e.stack||e.message)});page.on('requestfailed',r=>console.log('REQUEST FAILED',r.url(),r.failure()?.errorText));const dir='/tmp/plotcloud-screenshots';fs.mkdirSync(dir,{recursive:true});
try{
 await page.goto(base+'/#/library');await page.locator('.pc-resource-tabs').waitFor();
 await page.locator('.pc-resource-tabs a[href="#/showroom"]').click();
 await page.locator('.pc-resource-breadcrumb').waitFor();assert.equal(await page.locator('#nav a.on').innerText(),'Resources');
 assert(await page.locator('.pc-resource-spec').count()>0,'Scene resource specifications missing');
 const first=page.locator('[data-spot]').first();const slug=await first.getAttribute('data-spot');await first.click();
 await page.waitForFunction(s=>document.getElementById('sr-'+s)?.classList.contains('flash'),slug);
 await page.screenshot({path:dir+'/resource-showroom.png',fullPage:true});
 await page.goto(base+'/#/studio');
 let work=await (await page.locator('iframe[data-emb="modeler"]').elementHandle()).contentFrame();
 await work.waitForFunction(()=>!!window.__pcWorkflow,{},{timeout:60000});
 await work.evaluate(()=>window.__wbTour?.close());
 const fixture={v:2,id:'workflow-office',name:'Office original',version:0,units:'m',north:0,targets:{ach:5,df:2,view:.75},climate:{from:225,U10:3.5,terrain:'suburban',Tout:18,Tin:24},levels:[{id:'L1',name:'Ground',z:0,h:3}],walls:[{id:'w1',lv:'L1',a:[0,0],b:[10,0],t:.2},{id:'w2',lv:'L1',a:[10,0],b:[10,8],t:.2},{id:'w3',lv:'L1',a:[10,8],b:[0,8],t:.2},{id:'w4',lv:'L1',a:[0,8],b:[0,0],t:.2}],ops:[],floors:[],voids:[],names:[{lv:'L1',x:5,y:4,name:'Office'}],furn:[{id:'f1',lv:'L1',type:'desk',x:3,y:3,w:1.4,d:.7,h:.75,rot:0},{id:'f2',lv:'L1',type:'desk',x:3.2,y:3.1,w:1.4,d:.7,h:.75,rot:.4}]};
 await work.evaluate(N=>window.__pcWorkflow.load(N),fixture);
 await work.locator('#projectWorkflow summary').click();
 await work.locator('#wfBrief [name="people"]').fill('20');
 await work.locator('#wfBrief [name="area"]').fill('100');
 await work.locator('#wfBrief [name="perPerson"]').fill('8');
 await work.locator('#wfBrief [name="constraints"]').fill('Keep existing perimeter walls. Meeting room for six.');
 await work.locator('#wfBrief button[type="submit"]').click();
 await work.locator('#wfCheck').click();assert(/Furniture overlaps/.test(await work.locator('#wfReport').innerText()));
 assert(/below/.test(await work.locator('#wfReport').innerText()));assert(await work.locator('#wfReport [data-wf-issue]').count()>0);
 await work.locator('#wfReport [data-wf-issue]').first().click();
 assert(await work.evaluate(()=>window.__pcWorkflow.report().area>70),'Enclosed area not computed');
 assert(await work.evaluate(()=>window.__pcWorkflow.save()),'Save failed');
 const original=await work.evaluate(()=>window.__pcWorkflow.getModel());
 assert.equal(original.brief.people,20);
 const option=await work.evaluate(()=>window.__pcWorkflow.duplicate());assert(option&&option!==original.id);
 await work.locator('#wfBrief [name="people"]').fill('10');await work.locator('#wfBrief button[type="submit"]').click();
 assert(await work.evaluate(()=>window.__pcWorkflow.save()));
 assert(await work.evaluate(id=>window.__pcWorkflow.open(id),original.id));
 assert.equal(await work.locator('#wfBrief [name="people"]').inputValue(),'20','Option brief leaked into original');
 assert(await work.evaluate(id=>window.__pcWorkflow.open(id),option));
 assert.equal(await work.locator('#wfBrief [name="people"]').inputValue(),'10');
 await work.locator('#wfOffice').click();await work.waitForFunction(()=>window.__pcWorkflow.getModel().name==='Small office');
 assert.equal((await work.evaluate(()=>window.__pcWorkflow.report())).rooms.length,3,'Office example should have three enclosed rooms');
 assert(await work.evaluate(id=>window.__pcWorkflow.open(id),option));
 await work.locator('#wfParent').click();await work.locator('#cmpDlg').waitFor({state:'visible'});
 await page.screenshot({path:dir+'/option-comparison.png',fullPage:true});
 await work.evaluate(()=>document.getElementById('cmpDlg').hidden=true);
 const conditions=await work.evaluate(()=>window.__pcWorkflow.conditions());assert.equal(conditions.level,'L1');assert.equal(conditions.north,0);
 const scene=await work.evaluate(()=>window.__wb.planScene('L1','daylight'));assert.equal(scene.source.conditions.level,'L1','Analysis provenance missing');
 await page.reload();work=await (await page.locator('iframe[data-emb="modeler"]').elementHandle()).contentFrame();await work.waitForFunction(()=>!!window.__pcWorkflow,{},{timeout:60000});
 await work.waitForFunction(id=>window.__pcWorkflow.getModel().id===id,option);
 assert.equal((await work.evaluate(()=>window.__pcWorkflow.getModel())).brief.people,10,'Saved project did not reopen');
 await work.evaluate(()=>window.__wbTour?.close());
 await page.screenshot({path:dir+'/project-workflow.png',fullPage:true});
 // Capture an actual Studio preview; no fake renderer is used for this handoff.
 await work.locator('#wfRender').click();
 await page.waitForURL('**/#/tool/architectural-render');
 work=await (await page.locator('iframe[data-emb="architectural-render"]').elementHandle()).contentFrame();
 await work.waitForFunction(()=>!!window.__pcRender);
 const context=await work.evaluate(()=>window.__pcRender.context());
 assert.equal(context.project,option);assert(context.version>0);
 assert((await work.evaluate(()=>window.__pcRender.payload())).source_image.startsWith('data:image/'));
 assert(/model v/.test(await work.locator('#sourceContext').innerText()));
 const sourceDownload=page.waitForEvent('download');await work.locator('#downloadSource').click();assert.equal((await sourceDownload).suggestedFilename(),'plotcloud-source-view.png');
 await work.locator('#run').click();assert(/valid HTTPS/.test(await work.locator('#status').innerText()));
 assert.equal(await work.evaluate(()=>window.__pcRender.hasOutput()),false);
 // Test HTTP adapter with a mocked endpoint. This validates client behavior, not AI model quality.
 pixel=await work.evaluate(()=>{const c=document.createElement('canvas');c.width=2;c.height=2;return c.toDataURL('image/png');});
 let request;
 await page.route('https://render.example.test/api',async route=>{request=route.request().postDataJSON();await route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({image_data_url:pixel})});});
 await work.locator('#endpoint').fill('https://render.example.test/api');
 await work.locator('#run').click();await work.waitForFunction(()=>window.__pcRender.hasOutput());
 assert.equal(request.source_context.project,option);assert(request.request_id);assert.equal(request.preserve_geometry,true);
 await work.locator('#prompt').fill('A changed prompt after generation');
 const record=await work.evaluate(()=>window.__pcRender.versions()[0]);assert(!record.request.prompt.includes('A changed prompt'),'History metadata changed with form input');
 const download=page.waitForEvent('download');await work.locator('#exportVersion').click();assert.equal((await download).suggestedFilename(),'plotcloud-render-record.json');
 await page.screenshot({path:dir+'/render-workflow.png',fullPage:true});
 await page.route('https://render.example.test/api',route=>route.fulfill({status:200,contentType:'application/json',body:'{"image_data_url":"data:image/png;base64,invalid"}'}));
 await work.locator('#run').click();await work.waitForFunction(()=>document.getElementById('status').textContent.includes('Render failed'));
 assert.equal(await work.evaluate(()=>window.__pcRender.hasOutput()),false,'Unreadable image accepted');

 for(const tool of ['views','daylight']){
  await page.goto(base+'/#/tool/'+tool);
  work=await (await page.locator('iframe[data-emb="'+tool+'"]').elementHandle()).contentFrame();
  await work.waitForFunction(()=>window.__pcAnalysisState?.().ready,{},{timeout:90000});
  const state=await work.evaluate(()=>window.__pcAnalysisState());assert.equal(state.conditions.tool,tool);assert(state.conditions.parameters);
  if(tool==='views'){await work.evaluate(()=>window.__views.setEye(1.15));await work.waitForFunction(()=>window.__pcAnalysisState().stale);assert.equal(await work.evaluate(()=>window.__pcAnalysisState().ready),false);}
 }
 assert.equal(errors.length,0,'Browser errors: '+errors.join(' | '));
 console.log('PASS showroom relationships; project brief isolation and reopen; layout issues; option comparison; analysis provenance; Studio render handoff; mocked render contract and invalid image rejection');
}finally{await page.screenshot({path:dir+'/workflow-final.png',fullPage:true}).catch(()=>{});await browser.close();}
})().catch(e=>{console.error(e.stack||e);process.exit(1)});
