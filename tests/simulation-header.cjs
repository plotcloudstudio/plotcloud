const assert=require('node:assert/strict'),{chromium}=require('playwright');
const base=process.env.TEST_BASE||'http://127.0.0.1:8765';
const sims=(process.env.TEST_SIM||'sunhours,wind,daylight,vent,spacesyntax,movementdepth,isovist,cameras,views,acoustics,evac,structure,stormwater,wayfinding,privacy,noise').split(',');
(async()=>{const b=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||undefined,headless:true,args:['--enable-unsafe-swiftshader']});try{for(const id of sims){
 const p=await b.newPage({viewport:{width:1440,height:900}}),errors=[];p.on('pageerror',e=>errors.push(e.message));await p.goto(base+'/mvp/#/simulations/'+id);if(await require('./native-study-layout.cjs')(p,id)){assert.deepEqual(errors,[]);await p.close();continue;}await p.locator('#eng[data-pc-settings-ready=true]').waitFor({state:'attached',timeout:60000});await p.waitForTimeout(id==='stormwater'?2500:500);
 let checked=0;const frames=p.frames().filter(f=>f!==p.mainFrame());for(const f of frames){if(!await f.locator('#unifiedSettings').count())continue;checked++;
  assert.equal(await f.locator('.vbar #toolBar,.vbar #undo,.vbar #redo,.vbar [data-layer],.vbar #showBar,.vbar .pc-unified-display,.vbar .pc-unified-view-controls,#stage>.bar [data-look]').count(),0,id+' header only contains viewport controls');
  const advanced=f.locator('#unifiedViewSettings');if(await advanced.isVisible()){
   const before=await f.locator('#unifiedSettings').evaluate(e=>[...e.querySelectorAll('input,select')].map(c=>[c.id,c.value,c.checked]));
   await advanced.locator(':scope>summary').click();await p.waitForTimeout(150);
   assert.equal(await advanced.getAttribute('open'),'','Advanced stays open when requested');
   assert.equal(await f.locator('.app').getAttribute('data-pc-unified'),'true',id+' expansion must not restore the old toolbar');
   const layout=await f.locator('#panelL .pc-fit-content').evaluate(e=>({height:e.scrollHeight,available:e.parentElement.clientHeight,transform:getComputedStyle(e).transform,overflow:getComputedStyle(e.parentElement).overflowY,bottom:e.parentElement.getBoundingClientRect().bottom,viewport:innerHeight}));assert.equal(layout.transform,'none');assert(layout.available>100&&layout.bottom<=layout.viewport+2,id+JSON.stringify(layout));assert.match(layout.overflow,/auto|scroll/,'Expanded settings remain reachable by native scrolling');
   assert.deepEqual(await f.locator('#unifiedSettings').evaluate(e=>[...e.querySelectorAll('input,select')].map(c=>[c.id,c.value,c.checked])),before,'Disclosure never changes input values');
   const layer=advanced.locator('[data-layer]').first();if(await layer.count()&&await layer.isVisible()){const checked=await layer.isChecked();await layer.setChecked(!checked);assert.equal(await layer.isChecked(),!checked);await layer.setChecked(checked);}
   await p.setViewportSize({width:1366,height:768});await p.waitForTimeout(150);assert.equal(await f.locator('.app').getAttribute('data-pc-unified'),'true',id+' small-window disclosure stays unified: '+await f.locator('.app').getAttribute('data-pc-unified-blocked'));
   await p.setViewportSize({width:1440,height:900});await p.waitForTimeout(100);
   await advanced.locator(':scope>summary').click();
  }
 }
 assert(checked>0,id+' must have an actual unified Settings panel');assert.deepEqual(errors,[]);if(id==='vent')await p.screenshot({path:require('os').tmpdir()+'/simulation-header-vent.png'});console.log('PASS '+id+' consistent header, Settings disclosures and retained control values');await p.close();
} }finally{await b.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
