const assert=require('node:assert/strict'),fs=require('node:fs'),{chromium}=require('playwright');
const base=process.env.TEST_BASE||'http://127.0.0.1:8765';
(async()=>{
 const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||undefined,headless:true,args:['--no-sandbox','--enable-unsafe-swiftshader']});
 const page=await browser.newPage({viewport:{width:1440,height:900},acceptDownloads:true}),errors=[];page.on('pageerror',e=>errors.push(e.message));
 const tab=async(f,side,name)=>{await f.locator('#panel'+side+' .pc-fit-tabs').getByRole('tab',{name,exact:true}).click();await f.locator('#panel'+side+' .pc-fit-item[data-pc-fit-active=true]').waitFor();await page.waitForTimeout(60);};
 async function layout(f){
  await f.locator('.app[data-pc-exterior-layout="1"]').waitFor();
  await f.locator('#panelL .pc-fit-tabs').getByRole('tab',{name:'Settings',exact:true}).waitFor();
  assert.equal(await f.locator('.sec h2 i').count(),0);
  assert.equal(await f.locator('[data-view=split]').count(),0);
  assert.equal(await f.locator('#chartp').evaluate(e=>e.closest('.lgdsec')===document.querySelector('#legend').closest('.lgdsec')),true);
  assert.equal(await f.locator('#h-res').evaluate(e=>e.closest('#panelR')?.id),'panelR');
  assert.equal(await f.locator('#h-set,#h-lay').evaluate(e=>e.closest('#panelL')?.id),'panelL');
  assert.equal(await f.locator('#panelR .pc-fit-tabs').getByRole('tab',{name:'Legend',exact:true}).count(),0);
  assert.equal(await f.locator('#panelL .pc-fit-tabs').getByRole('tab',{name:'Settings',exact:true}).count(),1);
 }
 try{
  await page.goto(base+'/mvp/#/simulations/wind');let f=page.frameLocator('#eng');await layout(f);
  await page.waitForFunction(()=>document.querySelector('#eng')?.contentWindow.__windScene);
  await tab(f,'L','Settings');await f.locator('#res').selectOption('draft');await f.locator('#run').click();
  console.log('Wind Draft started');await page.waitForTimeout(3000);console.log('Wind progress',await f.locator('#run').isDisabled(),await f.locator('#status').textContent());
  await page.waitForFunction(()=>{const d=document.querySelector('#eng')?.contentDocument;return d&&!d.getElementById('resSec').hidden&&!d.getElementById('run').disabled;},null,{timeout:180000});
  assert.match(await f.locator('#stats').innerText(),/\d/);
  await tab(f,'R','Charts');assert(await f.locator('#legend').isVisible());assert(await f.locator('#rose').isVisible());assert(await f.locator('#hist').evaluate(e=>e.width>0&&e.height>0));
  assert.equal(await f.locator('#panelR .pc-fit-pages').isVisible(),false,'Wind charts share a single page');
  await page.setViewportSize({width:1280,height:720});await page.waitForTimeout(350);
  const fixed=await f.locator('.app').getAttribute('data-pc-unified')==='true';
  if(fixed)assert.equal(await f.locator('#panelR .pc-fit-pages').isVisible(),false,'Fixed charts do not paginate');
  else{assert(await f.locator('.pc-layout-review').isVisible(),'Small windows explicitly request layout review');assert.match(await f.locator('#stats').innerText(),/\d/,'Resize fallback preserves calculated results');}
  await page.setViewportSize({width:1440,height:900});await page.waitForTimeout(200);
  assert.equal(await f.locator('#export').evaluate(e=>e.closest('#panelL')?.id),'panelL');
  await tab(f,'L','Export');await f.locator('#export').click();
  await f.locator('#expmsg').filter({hasText:/saved|save|download/i}).waitFor();
  await page.screenshot({path:require('node:os').tmpdir()+'/plotcloud-wind-unified.png'});
  console.log('PASS Wind: real Draft run, result metrics, colour legend, wind rose, histogram and PNG export');

  await page.goto(base+'/mvp/#/simulations/stormwater');f=page.frameLocator('#eng').frameLocator('#modelWorkspace');
  await f.locator('#exportJson:not([disabled])').waitFor({state:'attached',timeout:90000});await layout(f);
  assert.equal((await f.locator('#error').textContent()).trim(),'');
  assert.equal(await f.locator('#peak').evaluate(e=>e.closest('#panelR')?.id),'panelR');
  await tab(f,'L','Settings');await f.locator('#rain').fill('75');await f.locator('#rain').dispatchEvent('input');await f.locator('#rain').dispatchEvent('change');
  await f.locator('#duration').fill('45');await f.locator('#duration').dispatchEvent('input');await f.locator('#duration').dispatchEvent('change');
  await page.waitForTimeout(450);await f.locator('#exportJson:not([disabled])').waitFor({state:'attached',timeout:90000});
  await tab(f,'R','Charts');assert(await f.locator('#legend').isVisible());assert(await f.locator('#budget').isVisible());
  await tab(f,'L','Export');const download=page.waitForEvent('download');await f.locator('#exportJson').click();const file=await download;
  const report=JSON.parse(fs.readFileSync(await file.path(),'utf8'));assert.equal(report.params.rain,75);assert.equal(report.params.duration,45);assert(report.fields.depth_m.length>0);
  await page.screenshot({path:require('node:os').tmpdir()+'/plotcloud-storm-unified.png'});
  console.log('PASS imported Stormwater: real model run, edited rainfall/duration, Results metrics, Charts water budget, JSON numerical fields');

  await page.goto(base+'/emb/stormwater.html');f=page.frameLocator('#gridWorkspace');await layout(f);
  await tab(f,'R','Charts');assert(await f.locator('#flowLegend').isVisible());assert(await f.locator('#runoffChart').isVisible());assert(await f.locator('#pondChart').evaluate(e=>e.width>=100&&e.height>=100&&e.getBoundingClientRect().height>=125),'Rainfall charts redraw at a readable plotted height when their tab opens');
  await f.locator('#play').click();await page.waitForTimeout(900);await f.locator('#pause').click();assert(Number(await f.locator('#runoff').textContent())>0);
  assert.equal(await f.locator('#png').evaluate(e=>e.closest('#panelL')?.id),'panelL');
  console.log('PASS generated Stormwater: event playback, runoff/ponding charts, native legends and left-side export');
  assert.deepEqual(errors,[]);
 }finally{await browser.close()}
})().catch(e=>{console.error(e);process.exitCode=1});
