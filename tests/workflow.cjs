const assert=require('assert'),fs=require('fs'),{chromium}=require('playwright');
const base=process.env.TEST_BASE||'http://127.0.0.1:8765';
let pixel='data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a5X8AAAAASUVORK5CYII=';
(async()=>{
const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||undefined,headless:true,args:['--no-sandbox','--enable-unsafe-swiftshader']});
const page=await browser.newPage({viewport:{width:1440,height:1000},acceptDownloads:true}),errors=[];
page.on('pageerror',e=>{errors.push(e.message);console.error('PAGE ERROR',e.stack||e.message)});page.on('requestfailed',r=>console.log('REQUEST FAILED',r.url(),r.failure()?.errorText));const dir='/tmp/plotcloud-screenshots';fs.mkdirSync(dir,{recursive:true});
try{
 await page.goto(base+'/tests/fixtures/engine-host.html');
 let work=await (await page.locator('iframe[data-emb="modeler"]').elementHandle()).contentFrame();
 await work.waitForFunction(()=>!!window.__pcWorkflow,{},{timeout:60000});
 await work.evaluate(()=>window.__wbTour?.close());
 const fixture={v:2,id:'workflow-office',name:'Office original',version:0,units:'m',north:0,targets:{ach:5,df:2,view:.75},climate:{from:225,U10:3.5,terrain:'suburban',Tout:18,Tin:24},levels:[{id:'L1',name:'Ground',z:0,h:3}],walls:[{id:'w1',lv:'L1',a:[0,0],b:[10,0],t:.2},{id:'w2',lv:'L1',a:[10,0],b:[10,8],t:.2},{id:'w3',lv:'L1',a:[10,8],b:[0,8],t:.2},{id:'w4',lv:'L1',a:[0,8],b:[0,0],t:.2}],ops:[],floors:[],voids:[],names:[{lv:'L1',x:5,y:4,name:'Office'}],furn:[{id:'f1',lv:'L1',type:'desk',x:3,y:3,w:1.4,d:.7,h:.75,rot:0},{id:'f2',lv:'L1',type:'desk',x:3.2,y:3.1,w:1.4,d:.7,h:.75,rot:.4}]};
 await work.evaluate(N=>window.__pcWorkflow.load(N),fixture);
 // The Project brief panel is switched off (Plan Studio opens on the drawing tools); options and provenance are still covered through the workflow API.
 assert(await work.evaluate(()=>window.__pcWorkflow.save()),'Save failed');
 const original=await work.evaluate(()=>window.__pcWorkflow.getModel());assert.equal(original.name,'Office original');
 const option=await work.evaluate(()=>window.__pcWorkflow.duplicate());assert(option&&option!==original.id,'Option was not created');
 const copy=await work.evaluate(()=>window.__pcWorkflow.getModel());assert.equal(copy.parentOption.id,original.id);assert.equal(copy.furn.length,original.furn.length);
 await work.evaluate(()=>{const N=window.__pcWorkflow.getModel();N.furn[0].x+=1;window.__pcWorkflow.load(N);});
 assert(await work.evaluate(()=>window.__pcWorkflow.save()));const moved=(await work.evaluate(()=>window.__pcWorkflow.getModel())).furn[0].x;
 assert(await work.evaluate(id=>window.__pcWorkflow.open(id),original.id));
 assert.equal((await work.evaluate(()=>window.__pcWorkflow.getModel())).furn[0].x,original.furn[0].x,'Option edit leaked into original');
 assert(await work.evaluate(id=>window.__pcWorkflow.open(id),option));
 assert.equal((await work.evaluate(()=>window.__pcWorkflow.getModel())).furn[0].x,moved);
 const conditions=await work.evaluate(()=>window.__pcWorkflow.conditions());assert.equal(conditions.level,'L1');assert.equal(conditions.north,0);
 const scene=await work.evaluate(()=>window.__wb.planScene('L1','daylight'));assert.equal(scene.source.conditions.level,'L1','Analysis provenance missing');
 await page.reload();work=await (await page.locator('iframe[data-emb="modeler"]').elementHandle()).contentFrame();await work.waitForFunction(()=>!!window.__pcWorkflow,{},{timeout:60000});
 await work.waitForFunction(id=>window.__pcWorkflow.getModel().id===id,option);
 assert.equal((await work.evaluate(()=>window.__pcWorkflow.getModel())).furn[0].x,moved,'Saved project did not reopen');
 await work.evaluate(()=>window.__wbTour?.close());
 await page.screenshot({path:dir+'/project-workflow.png',fullPage:true});
 for(const tool of ['views','daylight']){
  await page.goto(base+'/#/tool/'+tool);
  await page.locator('#eng[data-pc-settings-ready="true"]').waitFor();
  work=await (await page.locator('iframe[data-emb="'+tool+'"]').elementHandle()).contentFrame();
  await work.waitForFunction(()=>window.__pcAnalysisState?.().ready,{},{timeout:90000});
  const state=await work.evaluate(()=>window.__pcAnalysisState());assert.equal(state.conditions.tool,tool);assert(state.conditions.parameters);
  if(tool==='views'){await work.evaluate(()=>window.__views.setEye(1.15));await work.waitForFunction(()=>window.__pcAnalysisState().stale);assert.equal(await work.evaluate(()=>window.__pcAnalysisState().ready),false);}
 }
 assert.equal(errors.length,0,'Browser errors: '+errors.join(' | '));
 console.log('PASS shared Workspace engine: option isolation and reopen, analysis provenance, model workflow');
}finally{await page.screenshot({path:dir+'/workflow-final.png',fullPage:true}).catch(()=>{});await browser.close();}
})().catch(e=>{console.error(e.stack||e);process.exit(1)});
