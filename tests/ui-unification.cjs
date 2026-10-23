const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {chromium}=require('playwright');
const inventory=require('../ui/inventory.json');
const base=process.env.TEST_BASE||'http://127.0.0.1:8765';
let currentTarget='browser startup';
(async()=>{
 const browser=await chromium.launch({headless:true,args:['--no-sandbox','--enable-unsafe-swiftshader']});
 const results=[];
 try{
  const context=await browser.newContext({viewport:{width:1440,height:900}});
  for(const host of inventory.hosts){
   currentTarget=host.file;
   const page=await context.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
   try{
    const url=host.file==='index.html'?'/index.html#/home':host.url;
    await page.goto(base+url,{waitUntil:'domcontentloaded'});
    await page.waitForFunction(()=>window.PlotCloudUI?.version===1);
    const check=async theme=>{
     await page.evaluate(t=>PlotCloudUI.setTheme(t),theme);
     const actual=await page.evaluate(()=>{
      const root=document.documentElement,cs=getComputedStyle(root),body=getComputedStyle(document.body);
      return {theme:root.dataset.pcTheme,surface:root.dataset.pcSurface,font:body.fontFamily,text:body.color,token:cs.getPropertyValue('--pc-ui-text').trim(),fields:[...document.querySelectorAll('input[type=number],select')].filter(e=>e.getBoundingClientRect().width>0).slice(0,3).map(e=>({color:getComputedStyle(e).color,bg:getComputedStyle(e).backgroundColor}))};
     });
     assert.equal(actual.theme,theme);assert.equal(actual.surface,host.surface);assert(actual.font.includes('Inter'));
     assert.equal(actual.text,theme==='day'?'rgb(32, 36, 43)':'rgb(236, 239, 243)',host.file+' body text');
     for(const field of actual.fields)assert.notEqual(field.color,field.bg,host.file+' unreadable input');
    };
    await check('day');await check('night');
    // Returning to day also verifies the adapter does not get stuck in native dark/light syntax.
    await check('day');
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
   await routePage.evaluate(()=>PlotCloudUI.setTheme('night'));
   assert.equal(await routePage.evaluate(()=>document.documentElement.dataset.pcTheme),'night');
   assert.deepEqual(errors,[],url+' startup errors');routeChecks.push(url);
   await routePage.close();
  }
  const p=await context.newPage();await p.goto(base+'/mvp/#/resources');await p.waitForFunction(()=>window.PlotCloudUI?.version===1);
  assert.equal(await p.locator('#nav [data-nav="workspace"]').count(),1);
  assert.equal(await p.locator('#nav [data-nav="workspace-v2"]').count(),0);
  await p.locator('#themeSeg [data-theme=night]').click();
  await p.waitForFunction(()=>PlotCloudUI.theme==='night');
  await p.goto(base+'/index.html#/studio');
  await p.frameLocator('iframe[data-emb=modeler]').locator('[data-pc-theme=night]').waitFor();
  const frame=await p.locator('iframe[data-emb=modeler]').elementHandle();
  assert.equal(await (await frame.contentFrame()).evaluate(()=>document.documentElement.dataset.pcTheme),'night');
  assert.equal(await p.frameLocator('iframe[data-emb=modeler]').locator('.pc-ui-theme').count(),0,'Embedded tool must not duplicate host theme control');
  await p.close();
  fs.mkdirSync('/tmp/plotcloud-ui',{recursive:true});fs.writeFileSync('/tmp/plotcloud-ui/inventory-results.json',JSON.stringify({hosts:results,routes:routeChecks},null,2));
  results.forEach(r=>console.log(r.status.toUpperCase(),r.file,r.reason||'',r.pageErrors.length?'PAGE ERRORS: '+r.pageErrors.join(' | '):''));
  assert.equal(results.filter(r=>r.status==='failed').length,0,'Every inventory host must load the common UI and both themes');
  console.log('PASS all '+results.length+' UI hosts and '+routeChecks.length+' site routes, both themes, public workspace navigation and embedded theme propagation. Host checks validate UI integration; they are not functional analysis-engine tests.');
 }finally{await browser.close()}
})().catch(e=>{
 console.error('UI check target:',currentTarget);console.error(e);
 if(process.env.GITHUB_ACTIONS){const message=('Target '+currentTarget+'\n'+(e.stack||e.message)).replace(/%/g,'%25').replace(/\r/g,'%0D').replace(/\n/g,'%0A');console.error('::error title=UI inventory failed::'+message)}
 process.exitCode=1;
});
