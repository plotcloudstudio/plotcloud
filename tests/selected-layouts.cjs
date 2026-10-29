const assert=require('node:assert/strict'),{chromium}=require('playwright');
const base=process.env.TEST_BASE||'http://127.0.0.1:8765';
const reveal=require('./reveal-simulation-control.cjs');
(async()=>{const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||undefined,headless:true,args:['--enable-unsafe-swiftshader']});try{
 for(const id of (process.env.TEST_SIM||'cameras,acoustics,evac,isovist').split(',')){
  const p=await browser.newPage({viewport:{width:1440,height:900},deviceScaleFactor:2,acceptDownloads:true}),errors=[];p.on('pageerror',e=>errors.push(e.message));
  await p.goto(base+'/mvp/#/simulations/'+id);const f=p.frameLocator('#eng');await f.locator('.app[data-pc-unified=true]').waitFor({state:'attached',timeout:60000});
  if(id==='cameras'){
   await p.waitForFunction(()=>!document.querySelector('#eng').contentWindow.__cam.QS.busy);
   await reveal(f,'#nCam');await f.locator('#nCam').fill('2');await f.locator('#nCam').dispatchEvent('input');await reveal(f,'#run');await f.locator('#run').click();
   await p.waitForFunction(()=>{const c=document.querySelector('#eng').contentWindow.__cam;return !c.QS.busy&&c.OPT&&Number.isFinite(c.COV.frac);},null,{timeout:90000});
   assert(await f.locator('#covPct').textContent());
  }else if(id==='acoustics'){
   // Indoor acoustics (emb/roomacoustics.html, 2026-10-25): every room of the level; Eyring, then Sabine (never shorter), then another band
   await p.waitForFunction(()=>document.querySelector('#eng').contentWindow.__psim?.SC?.rooms?.length>0,null,{timeout:60000});
   await reveal(f,'#run');await f.locator('#run').click();await p.waitForFunction(()=>{const w=document.querySelector('#eng').contentWindow;return w.__psim.RES&&!w.document.getElementById('run').disabled;},null,{timeout:60000});
   const ey=await p.evaluate(()=>document.querySelector('#eng').contentWindow.__psim.RES.rooms.map(x=>x.mid));
   await reveal(f,'#formula [data-f=sabine]');await f.locator('#formula [data-f=sabine]').click();await p.waitForFunction(()=>{const w=document.querySelector('#eng').contentWindow;return w.__psim.RES?.o.formula==='sabine'&&!w.document.getElementById('run').disabled;},null,{timeout:60000});
   const sa=await p.evaluate(()=>document.querySelector('#eng').contentWindow.__psim.RES.rooms.map(x=>x.mid));assert(sa.every((t,i)=>t>=ey[i]-1e-9));
   await reveal(f,'#band');await f.locator('#band').selectOption('3');assert.equal(await f.locator('#band').inputValue(),'3');
  }else if(id==='evac'){
   // Actual pointer placement on the imported Workspace grid; never substitute sample geometry.
   await reveal(f,'#toolBar [data-tool=point]');await f.locator('#toolBar [data-tool=point]').click();
   const points=await p.evaluate(()=>{const w=document.querySelector('#eng').contentWindow,g=w.__ci.getRG(),free=[];for(let y=2;y<g.H-2;y++)for(let x=2;x<g.W-2;x++)if(!g.blocked[y*g.W+x])free.push([x,y]);const pick=[.25,.35,.45,.55].map(t=>free[Math.floor(free.length*t)]);return pick.map(([x,y])=>{const q=w.__ci.W2S([(x+.5)*g.cell,(y+.5)*g.cell]);return{x:q[0]/w.devicePixelRatio,y:q[1]/w.devicePixelRatio};});});
   for(const point of points)await f.locator('#cv').click({position:point});
   assert.equal(await f.locator('#ptList [data-ptname]').count(),4);
   await reveal(f,'#lvlSeg [data-l=draft]');await f.locator('#lvlSeg [data-l=draft]').click();await f.locator('#run').click();
   await p.waitForFunction(()=>document.querySelector('#eng').contentWindow.__ci.NET?.done,null,{timeout:90000});
   assert(await p.evaluate(()=>document.querySelector('#eng').contentWindow.__ci.NET.pairs.some(p=>p.r)));
   await reveal(f,'#tripPick');const trip=await f.locator('#tripPick [data-tadd]').all();await trip[0].click();await trip[1].click();await f.locator('#tripGo').click();
  }else{
   await reveal(f,'#toolBar [data-tool=view]');await f.locator('#toolBar [data-tool=view]').click();const point=await p.evaluate(()=>{const w=document.querySelector('#eng').contentWindow,s=w.__iso.SC.bounds,q=w.__iso.W2S([s.w*.3,s.h*.5]);return{x:q[0]/w.devicePixelRatio,y:q[1]/w.devicePixelRatio};});await f.locator('#cv').click({position:point});
   await p.waitForFunction(()=>{const a=document.querySelector('#eng').contentWindow.__iso.A;return a&&!a.noView;});
   assert.equal(await f.locator('#unifiedResults #props').count(),1,'Read-only viewpoint is placed in Results, not an overflowing Settings card');
   await reveal(f,'#eyeBar [data-eye="1.6"]');await f.locator('#eyeBar [data-eye="1.6"]').click();
  }
  await p.waitForTimeout(250);
  assert.equal(await f.locator('.app').getAttribute('data-pc-unified'),'true',id+': '+await f.locator('.app').getAttribute('data-pc-unified-blocked'));
  assert.deepEqual(await f.locator('#panelL .pc-fit-tabs button').allTextContents(),['Settings','Export']);
  const settings=await f.locator('#panelL .pc-fit-content').evaluate(e=>({transform:getComputedStyle(e).transform,height:e.scrollHeight,available:e.parentElement.clientHeight,overflow:getComputedStyle(e.parentElement).overflowY,bottom:e.parentElement.getBoundingClientRect().bottom,viewport:innerHeight}));assert.equal(settings.transform,'none');assert(settings.available>100&&settings.bottom<=settings.viewport+2);assert.match(settings.overflow,/auto|scroll/);
  await f.locator('#panelR [role=tab]').getByText('Charts',{exact:true}).click();await p.waitForTimeout(200);assert.equal(await f.locator('#panelR .pc-fit-pages').isVisible(),false);
  for(const c of await f.locator('#unifiedCharts canvas').all()){assert(await c.isVisible(),await c.evaluate(c=>JSON.stringify({id:c.id,display:getComputedStyle(c).display,hidden:c.hidden,parents:[...function*(n){while(n){yield n;n=n.parentElement;}}(c)].slice(0,5).map(e=>[e.id,e.className,getComputedStyle(e).display,e.hidden])})));const size=await c.evaluate(c=>({bitmap:c.height,css:c.clientHeight,dpr:devicePixelRatio,painted:c.getContext('2d').getImageData(0,0,c.width,c.height).data.some((v,i)=>i%4===3&&v)}));assert(Math.abs(size.bitmap-size.css*size.dpr)<=2);assert(size.painted);}
  if(id==='evac'){await f.locator('#cPairs').focus();await p.keyboard.press('ArrowRight');assert.notEqual(await p.evaluate(()=>document.querySelector('#eng').contentWindow.__ci.S.hp),null);}
  await p.screenshot({path:require('os').tmpdir()+'/selected-layout-'+id+'.png'});
  await f.locator('#panelL .pc-fit-tabs button').getByText('Export',{exact:true}).click();await f.locator('#unifiedExport').waitFor({state:'visible'});
  assert.deepEqual(errors,[]);console.log('PASS '+id+': actual inputs/run, fixed Settings, Charts list, high DPI, Export');await p.close();
 }
 const p=await browser.newPage();await p.goto(base+'/mvp/#/pricing');await p.locator('[data-y="0"]').click();assert.equal(await p.locator('#price').textContent(),'CAD 16.99');await p.locator('[data-y="1"]').click();assert.equal(await p.locator('#price').textContent(),'CAD 79');console.log('PASS monthly CAD 16.99; annual CAD 79 unchanged');await p.close();
}finally{await browser.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
