const assert=require('node:assert/strict'),{chromium}=require('playwright');
const base=process.env.TEST_BASE||'http://127.0.0.1:8765';
(async()=>{const b=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||undefined,headless:true,args:['--enable-unsafe-swiftshader']});try{
 for(const id of ['spacesyntax','movementdepth','isovist','views','wayfinding','privacy','noise'].filter(id=>!process.env.TEST_SIM||process.env.TEST_SIM===id)){
  const p=await b.newPage({viewport:{width:1440,height:900}}),errors=[];p.on('pageerror',e=>errors.push(e.message));
  await p.goto(base+'/mvp/#/simulations/'+id);const f=p.frameLocator('#eng');await f.locator('.app[data-pc-unified=true]').waitFor({state:'attached',timeout:60000});
  if(id==='isovist'){
   await f.locator('#toolBar [data-tool=view]').click();
   const pt=await p.evaluate(()=>{const w=document.querySelector('#eng').contentWindow,s=w.__iso.SC.bounds,xy=w.__iso.W2S([s.w*.3,s.h*.5]);return{x:xy[0]/w.devicePixelRatio,y:xy[1]/w.devicePixelRatio};});await f.locator('#cv').click({position:pt});
   await p.waitForFunction(()=>{const a=document.querySelector('#eng').contentWindow.__iso.A;return a&&!a.noView;},null,{timeout:30000});
  }else{
   if(['views','spacesyntax','movementdepth'].includes(id))await f.locator('#lvSeg [data-l=draft]').click();await f.locator('#run').click();
   await p.waitForFunction(()=>{const d=document.querySelector('#eng').contentDocument,w=d.defaultView,s=w.__pcAnalysisState?.();return s?s.ready:!d.getElementById('run').disabled&&[...d.querySelectorAll('#kpis b,#kp4 b')].some(e=>/\d/.test(e.textContent));},null,{timeout:90000});
  }
  if(id==='isovist'&&await f.locator('.app').getAttribute('data-pc-unified-blocked')){
   assert(await f.locator('.pc-layout-review').isVisible(),'Overflow is explicitly reported');
   assert(await p.evaluate(()=>{const a=document.querySelector('#eng').contentWindow.__iso.A;return a&&!a.noView;}),'Calculated viewpoint survives layout fallback');
   assert.deepEqual(errors,[]);console.log('PASS Isovist calculation preserved; unified settings still need layout review');await p.close();continue;
  }
  assert.equal(await f.locator('.app').getAttribute('data-pc-unified'),'true','Calculated results keep the unified layout: '+await f.locator('.app').getAttribute('data-pc-unified-blocked'));
  await f.locator('#panelR [role=tab]').getByText('Charts',{exact:true}).click();await p.waitForTimeout(120);
  assert.equal(await f.locator('.app').getAttribute('data-pc-unified'),'true','Actual charts fit without clipping');assert.equal(await f.locator('#panelR .pc-fit-pages').isVisible(),false);
  assert(await f.locator('#legend').isVisible());assert.equal(await f.locator('#stage').evaluate(e=>e.classList.contains('split')),false);
  const transform=await f.locator('#panelL .pc-fit-content').evaluate(e=>getComputedStyle(e).transform);assert.equal(transform,'none','Settings is not scaled');
  for(const c of await f.locator('#unifiedCharts canvas').all())if(await c.isVisible())assert(await c.evaluate(c=>c.getContext('2d').getImageData(0,0,c.width,c.height).data.some((v,i)=>i%4===3&&v>0)),'Engine chart has real pixels');
  assert.deepEqual(errors,[]);console.log('PASS unified real run '+id);await p.screenshot({path:require('os').tmpdir()+'/unified-real-'+id+'.png'});await p.close();
 }
}finally{await b.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
