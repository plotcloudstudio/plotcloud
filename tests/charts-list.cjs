const assert=require('node:assert/strict'),{chromium}=require('playwright');
const base=process.env.TEST_BASE||'http://127.0.0.1:8765';
const reveal=require('./reveal-simulation-control.cjs');
(async()=>{
 const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||undefined,headless:true,args:['--enable-unsafe-swiftshader']});
 try{
  const p=await browser.newPage({viewport:{width:1500,height:1000},deviceScaleFactor:2}),errors=[];
  p.on('pageerror',e=>errors.push(e.message));await p.goto(base+'/mvp/');await p.waitForFunction(()=>document.querySelector('#app h1'));
  await p.evaluate(async()=>{const S=await import('./js/store.js');S.reset();localStorage.setItem('pc-mvp-current',S.projects()[0].id);});
  for(const id of ['sunhours','daylight']){
   await p.goto(base+'/mvp/#/simulations/'+id);await p.locator('#eng[data-pc-settings-ready="true"]').waitFor();const f=p.frameLocator('#eng');
   if(id==='sunhours'){
    await f.locator('#pilotAdvanced').evaluate(e=>e.open=true);await f.locator('#lvlSeg [data-l=custom]').click();await f.locator('#grid').selectOption('4');await f.locator('#step').selectOption('30');await f.locator('#pilotAdvanced').evaluate(e=>e.open=false);
   }
   await reveal(f,'#run:not([disabled])');await f.locator('#run:not([disabled])').click();
   await p.waitForFunction(id=>{const w=document.querySelector('#eng').contentWindow;return id==='sunhours'?w.__sun.S.lastR&&!w.__sun.S.busy:w.__pcAnalysisState?.().ready;},id,{timeout:90000});
   await f.locator('#panelR [role=tab]').getByText('Charts',{exact:true}).click();
   for(const theme of ['light']){
   for(const [width,height]of [[1280,720],[1366,768],[1920,1080]]){
    await p.setViewportSize({width,height});await p.waitForTimeout(400);
    const layout=await f.locator('#pilotCharts').evaluate(el=>{
     const v=el.closest('.pc-fit-window').getBoundingClientRect();return{height:v.height,charts:[...el.querySelectorAll('canvas')].map(c=>{const r=c.getBoundingClientRect();return{id:c.id,top:r.top-v.top,bottom:r.bottom-v.top,height:r.height,bitmap:c.height,dpr:devicePixelRatio,css:parseFloat(c.style.height),painted:c.getContext('2d').getImageData(0,0,c.width,c.height).data.some((n,i)=>i%4===3&&n>0)};})};
    });
    console.log(id,theme,width,height,JSON.stringify(layout));
    await p.screenshot({path:require('os').tmpdir()+'/charts-list-'+id+'-'+theme+'-'+width+'.png'});
    assert.equal(await f.locator('#pilotChartSelect').count(),0);
    assert.equal(await f.locator('#panelR .pc-fit-pages').isVisible(),false,'Charts must not require paging');
    for(const c of layout.charts){assert(c.top>=-1&&c.bottom<=layout.height+2,c.id+' must fit');assert(c.painted,c.id+' must draw actual data');assert(Math.abs(c.bitmap-c.css*c.dpr)<=1,c.id+' bitmap matches logical height at high DPI');}
   }
   }
   if(id==='daylight'){
    await f.locator('#cCrit').click({position:{x:30,y:38}});assert.equal(await f.locator('[data-show=ase]').getAttribute('aria-pressed'),'true','Chart hit testing survives adaptive layout');
   }
  }
  assert.deepEqual(errors,[]);console.log('PASS: all charts listed together with real results, responsive sizing and high-DPI hit testing');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
