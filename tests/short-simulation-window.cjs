const assert=require('node:assert/strict'),{chromium}=require('playwright');
const base=process.env.TEST_BASE||'http://127.0.0.1:8765';
(async()=>{const b=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||undefined,headless:true});try{
 for(const height of [650,600,720]){
  const p=await b.newPage({viewport:{width:1280,height}}),errors=[];p.on('pageerror',e=>errors.push(e.message));
  await p.goto(base+'/mvp/#/simulations/vent');await p.locator('#eng[data-pc-settings-ready=true]').waitFor({state:'attached',timeout:60000});await p.waitForTimeout(500);const f=p.frameLocator('#eng');
  const check=async()=>{assert.equal(await f.locator('.app').getAttribute('data-pc-unified'),'true','Short window must retain new layout');assert.equal(await f.locator('.vbar #showBar,.vbar #toolBar,.vbar #undo,.vbar .pc-unified-display').count(),0);assert.equal(await f.locator('#unifiedSettings #unifiedViewSettings').count(),1);};
  await check();await f.locator('#panelR [role=tab]').getByText('Charts',{exact:true}).click();await p.waitForTimeout(200);await check();
  const pages=f.locator('#panelR .pc-fit-pages');if(await pages.isVisible()){assert.match(await pages.textContent(),/Window too short/);const next=pages.getByRole('button',{name:'Next →'});if(await next.isEnabled())await next.click();await check();}
  await p.setViewportSize({width:1440,height:900});await p.waitForTimeout(200);await check();assert.equal(await pages.isVisible(),false,'Normal height restores the complete Charts list');
  assert.deepEqual(errors,[]);console.log('PASS short window '+height+'px: new header retained before/after Charts and resize');await p.close();
 }
}finally{await b.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
