const assert = require('node:assert/strict');
const { chromium } = require('playwright');
const base = process.env.TEST_BASE || 'http://127.0.0.1:8765';
const sims = ['sunhours','wind','daylight','vent','spacesyntax','movementdepth','isovist','cameras','views','acoustics','evac','structure','stormwater','span','wayfinding','privacy','noise'];
(async()=>{
 const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||undefined,headless:true,args:['--no-sandbox','--enable-unsafe-swiftshader']});
 const report=[];
 try{
  for(const sim of sims.filter(sim=>!process.env.TEST_SIM||process.env.TEST_SIM===sim)){
   const page=await browser.newPage({viewport:{width:1366,height:768}}),errors=[];
   page.on('pageerror',e=>errors.push(e.message));
   await page.goto(base+'/mvp/#/simulations/'+sim);
   await page.waitForFunction(()=>{
    const d=document.querySelector('#eng')?.contentDocument;if(!d)return false;
    if(d.querySelector('.pc-fit-panel'))return true;
    return [...d.querySelectorAll('iframe')].some(f=>f.contentDocument?.querySelector('.pc-fit-panel'));
   },null,{timeout:60000});
   await page.waitForTimeout(1200);
   if(sim==='stormwater')await page.waitForFunction(()=>{const d=document.querySelector('#eng')?.contentDocument,f=d?.querySelector('#modelWorkspace');return f&&!f.hidden&&f.contentDocument?.querySelector('.pc-fit-panel');},null,{timeout:60000});
   const inspect=()=>page.evaluate(()=>{
    const rows=[];
    function check(d){
     if(!d?.body)return;
     const w=d.defaultView;
     if(d.querySelector('.app')){
      rows.push({type:'document',width:w.innerWidth,height:w.innerHeight,scrollHeight:d.documentElement.scrollHeight,scrollWidth:d.documentElement.scrollWidth});
      for(const p of d.querySelectorAll('.pc-fit-panel')){
       if(!p.getBoundingClientRect().width)continue;
       const r=p.getBoundingClientRect(),c=p.querySelector('.pc-fit-window'),s=w.getComputedStyle(p);
       rows.push({type:'panel',name:p.id||p.className,bottom:r.bottom,right:r.right,overflow:s.overflowY,tabs:[...p.querySelectorAll('.pc-fit-tabs button')].filter(b=>!b.hidden).map(b=>b.textContent),viewportHeight:c.clientHeight,chart:!!p.closest('#chartp')});
      }
     }
     for(const f of d.querySelectorAll('iframe'))if(!f.hidden&&f.getBoundingClientRect().width)check(f.contentDocument);
    }
    rows.push({type:'host',height:innerHeight,scrollHeight:document.documentElement.scrollHeight});check(document.querySelector('#eng').contentDocument);return rows;
   });
   let rows=await inspect();
   for(const r of rows){
    if(r.type==='host'||r.type==='document')assert(r.scrollHeight<=r.height+2,sim+' document must fit one screen: '+JSON.stringify(r));
    if(r.type==='panel'){assert.equal(r.overflow,'hidden',sim+' has no panel scrollbar');assert(r.viewportHeight>(r.chart?60:150),sim+' leaves a useful panel body: '+JSON.stringify(r));assert(r.tabs.length>0||(['sunhours','wind'].includes(sim)&&r.name==='panelR'),sim+' keeps controls reachable through tabs');}
   }
   for(const size of [{width:1280,height:720},{width:1920,height:1080},{width:1366,height:768}]){
    await page.setViewportSize(size);
    await page.waitForTimeout(100);
    const reachable=await page.evaluate(async()=>{
     const problems=[];
     async function check(d){
      if(!d?.body)return;const w=d.defaultView,api=w.PlotCloudSimulationFit;
      const audit=async()=>{if(api)for(const [panel,state] of api.panels){
       if(!panel.getBoundingClientRect().width)continue;
       for(const button of state.tabs.querySelectorAll('button')){
        if(button.hidden)continue;button.click();await new Promise(r=>w.requestAnimationFrame(()=>w.requestAnimationFrame(r)));
        let n=0;while(!state.pages.hidden&&!state.next.disabled&&n++<30){state.next.click();await new Promise(r=>w.requestAnimationFrame(()=>w.requestAnimationFrame(r)));}
        if(n>=30)problems.push('Pagination did not terminate');
        if(state.content.getBoundingClientRect().bottom>state.viewport.getBoundingClientRect().bottom+3)problems.push(button.textContent+' leaves content unreachable');
        for(const el of state.content.querySelectorAll('*')){const r=el.getBoundingClientRect(),s=w.getComputedStyle(el);if(r.width&&r.height&&(/auto|scroll/.test(s.overflowY)&&el.scrollHeight>el.clientHeight+2||/auto|scroll/.test(s.overflowX)&&el.scrollWidth>el.clientWidth+2))problems.push('Scrollable '+el.tagName+'#'+el.id+'.'+el.className);}
       }
      }};
      await audit();
      for(const select of d.querySelectorAll('.pc-chart-select'))for(const option of select.options){select.value=option.value;select.dispatchEvent(new w.Event('change'));await new Promise(r=>w.requestAnimationFrame(()=>w.requestAnimationFrame(r)));await audit();}
      for(const f of d.querySelectorAll('iframe'))if(!f.hidden&&f.getBoundingClientRect().width)await check(f.contentDocument);
     }
     await check(document.querySelector('#eng').contentDocument);return problems;
    });
    assert.deepEqual(reachable,[],sim+' all parameter/result groups reachable at '+size.width+'×'+size.height);
    for(const r of await inspect())if(r.type==='host'||r.type==='document')assert(r.scrollHeight<=r.height+2,sim+' fits after resize');
   }
   if(sim==='sunhours'){
    const f=page.frameLocator('#eng');
    assert.equal(await f.getByRole('button',{name:'Plan + chart',exact:true}).count(),0);
    await f.locator('#panelL .pc-fit-tabs').getByRole('tab',{name:'Settings',exact:true}).click();
    await f.locator('#pilotAdvanced').evaluate(e=>e.open=true);
    await f.locator('#lvlSeg [data-l=custom]').click();await f.locator('#grid').selectOption('4');await f.locator('#step').selectOption('30');
    await f.locator('#run').click();
    await page.waitForFunction(()=>{const s=document.querySelector('#eng').contentWindow.__sun.S;return s.lastR&&!s.busy;});
    assert.equal(await f.locator('#panelR .pc-fit-tabs').getByRole('tab',{name:'Legend',exact:true}).count(),0);
    assert.equal(await f.locator('#panelR .pc-fit-tabs').getByRole('tab',{name:'Charts',exact:true}).count(),1);
    await f.locator('#panelR .pc-fit-tabs').getByRole('tab',{name:'Charts',exact:true}).click();
    await page.waitForTimeout(100);
    assert.equal(await f.locator('#legend #ramp').isVisible(),true,'Charts keeps the actual engine colour legend');
    assert.equal(await f.locator('#chartp').isVisible(),true,'Restore the original numerical charts');
    assert.equal(await f.locator('#chartp').evaluate(e=>e.closest('.lgdsec')===document.querySelector('#legend').closest('.lgdsec')),true,'Legend and charts share one group');
    assert(await f.locator('#kp4 b').evaluateAll(es=>es.some(e=>/\d/.test(e.textContent))),'Chart metrics use the actual calculated result');
    for(const id of ['days','hist','tday'])assert(await f.locator('#'+id).evaluate(e=>e.width>0&&e.height>0),'Restore '+id+' canvas');
    const before=await f.locator('#panelR').evaluate(e=>e.scrollTop),box=await f.locator('#panelR').boundingBox();
    await page.mouse.move(box.x+box.width/2,box.y+box.height/2);await page.mouse.wheel(0,600);
    assert.equal(await f.locator('#panelR').evaluate(e=>e.scrollTop),before,'Wheel does not scroll the result panel');
    await page.screenshot({path:require('node:os').tmpdir()+'/plotcloud-sun-singlepage.png'});
    const next=f.locator('#panelR .pc-fit-pages').getByRole('button',{name:'Next →',exact:true});
    await f.locator('#pilotChartSelect').selectOption('3');
    for(let i=0;i<10&&await next.isVisible()&&await next.isEnabled();i++){await next.click();await page.waitForTimeout(40);}
    assert(await f.locator('#tday').evaluate(e=>{const r=e.getBoundingClientRect(),v=e.closest('.pc-fit-window').getBoundingClientRect();return r.bottom<=v.bottom+3&&r.bottom>v.top;}),'The final restored chart is reachable without scrolling');
   }
   assert.deepEqual(errors,[],sim+' JS errors');
   report.push({sim,panels:rows.filter(r=>r.type==='panel').map(r=>r.tabs)});
   console.log(JSON.stringify(report.at(-1)));
   await page.close();
  }
  console.log(`PASS: ${report.length} simulation screens fit desktop viewports without document or panel scrolling`);
 }finally{await browser.close()}
})().catch(e=>{console.error(e);process.exitCode=1});
