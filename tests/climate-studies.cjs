// Solar radiation, Outdoor thermal comfort (UTCI) and Wind comfort (Lawson): the shared climate library, then the two Sun hours
// studies run from the project's own EPW in the real site, saved with the climate file and method they used.
const assert=require('node:assert/strict'),path=require('node:path'),{pathToFileURL}=require('node:url'),{chromium}=require('playwright');
const base=process.env.TEST_BASE||'http://127.0.0.1:8765';
// A year at the sample site (Vancouver): clear-sky-like sun from a simple solar geometry, seasonal temperature, a turning wind.
function epw(){const lat=49.28,lon=-123.12,tz=-8,lines=[`LOCATION,QA Climate,BC,CAN,TEST,000,${lat},${lon},${tz},12`,...Array(7).fill('TEST')],R=Math.PI/180;
 for(let i=0;i<8760;i++){const d=new Date(Date.UTC(2025,0,1,i)),doy=Math.floor(i/24),hr=i%24+.5,dec=23.44*Math.sin(2*Math.PI*(284+doy+1)/365)*R,ha=((hr-12)*15+(lon-tz*15))*R;
  const alt=Math.asin(Math.sin(lat*R)*Math.sin(dec)+Math.cos(lat*R)*Math.cos(dec)*Math.cos(ha)),s=Math.max(0,Math.sin(alt)),cloud=(doy%5===0)?.8:.2;
  const dni=s>0.01?Math.round(850*(1-cloud)*Math.pow(s,.3)):0,dhi=s>0.01?Math.round(60+220*cloud*s):0,ghi=Math.round(dni*s+dhi),t=(10+8*Math.sin(2*Math.PI*(doy-110)/365)+4*Math.sin(2*Math.PI*(hr-9)/24)).toFixed(1);
  const row=Array(35).fill('0');Object.assign(row,{0:'2025',1:String(d.getUTCMonth()+1),2:String(d.getUTCDate()),3:String(d.getUTCHours()+1),4:'60',6:t,7:(t-6).toFixed(1),8:'65',9:'101000',12:'310',13:String(ghi),14:String(dni),15:String(dhi),20:String((i*7)%360),21:(2+3*Math.abs(Math.sin(i/37))).toFixed(1)});lines.push(row.join(','));}
 return Buffer.from(lines.join('\n'));}
(async()=>{
 // 1 · the library on its own: EPW reading, Lawson classes, wind carried to the site
 const C=await import(pathToFileURL(path.join(__dirname,'../emb/lib/climate.js')).href),E=C.parseEPW(epw().toString(),'qa.epw');
 assert.equal(E.T.length,8760);assert.equal(E.station,'QA Climate, BC, CAN');assert(E.DNR.some(v=>v>500));assert.throws(()=>C.parseEPW('LOCATION,x\n'),/8,760/);assert.throws(()=>C.parseEPW('nonsense'),/not an EPW/);
 assert.equal(C.lawsonClass(Array(100).fill(2)).cls,0);assert.equal(C.lawsonClass([...Array(94).fill(1),...Array(6).fill(5)]).cls,2,'5 m/s for 6 % of the hours is standing, not sitting');
 assert.equal(C.lawsonClass(Array(100).fill(9)).cls,4);assert(C.lawsonClass([...Array(9999).fill(1),16]).unsafe<C.LAWSON_SAFE.share);assert(C.lawsonClass([...Array(4000).fill(1),16]).unsafe>C.LAWSON_SAFE.share);
 assert(Math.abs(C.siteWind(5,10,0.14)-5)<0.01,'Open country at 10 m keeps the station speed');assert(C.siteWind(5,1.5,0.33)<C.siteWind(5,1.5,0.22));
 assert(Math.abs(C.utci(25,25,1,50)-24.6)<0.05,'UTCI reference point (pythermalcomfort docs: 24.6)');
 console.log('PASS climate library');
 const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||undefined,headless:true,args:['--enable-unsafe-swiftshader']});
 try{
  const p=await browser.newPage({viewport:{width:1500,height:1000}}),errors=[];p.on('pageerror',e=>errors.push(e.message));
  await p.goto(base+'/mvp/');await p.waitForFunction(()=>document.querySelector('#app h1'));
  const pid=await p.evaluate(async()=>{const S=await import('./js/store.js');S.reset();return S.projects()[0].id;});
  // 2 · the catalogue lists both studies as exterior climate studies
  await p.goto(base+'/mvp/#/simulations');for(const id of ['radiation','utci']){const card=p.locator(`[data-sim="${id}"]`);await card.waitFor();assert.equal(await card.getAttribute('data-scope'),'Exterior');}
  // 3 · one EPW in project conditions feeds both
  await p.goto(base+'/mvp/#/project-settings/'+pid+'?return=radiation');await p.locator('#projectEpw').setInputFiles({name:'qa.epw',mimeType:'text/plain',buffer:epw()});await p.locator('#projectClimateStatus').filter({hasText:'8760 hours'}).waitFor();
  for(const id of ['radiation','utci']){
   await p.goto(base+'/mvp/#/simulations/'+id);await p.locator('#eng[data-pc-visible-ready="true"]').waitFor({timeout:120000});const f=p.frameLocator('#eng');
   await f.locator('#projectClimateSummary').filter({hasText:'qa.epw'}).waitFor({state:'attached',timeout:90000});
   const st=await p.evaluate(()=>{const w=document.querySelector('#eng').contentWindow;return {measure:w.__sun.S.measure,file:w.__sunClimate.CLIM.E?.station,row:getComputedStyle(w.document.getElementById('measureRow')).display};});
   assert.equal(st.measure,id);assert.equal(st.file,'QA Climate, BC, CAN');assert.equal(st.row,'none','The study is fixed by the page: no measure switch');
   await p.evaluate(()=>{const w=document.querySelector('#eng').contentWindow,d=w.document;d.querySelector('#lvlSeg [data-l=custom]').click();const g=d.getElementById('grid');g.value='4';g.dispatchEvent(new Event('change',{bubbles:true}));});
   await p.evaluate(()=>document.querySelector('#eng').contentDocument.getElementById('run').click());
   await p.waitForFunction(id=>{const s=document.querySelector('#eng').contentWindow.__sun.S;return s.lastR&&s.lastR.mode===id&&!s.busy;},id,{timeout:240000});
   const shown=await p.evaluate(()=>[...document.querySelector('#eng').contentDocument.querySelectorAll('#stats dt')].map(d=>[d.textContent,d.nextElementSibling.textContent]));
   if(id==='radiation'){const open=+shown.find(([k])=>/open level ground/i.test(k))[1].replace(/[^\d.]/g,''),roof=+shown.find(([k])=>/^roofs, mean/i.test(k))[1].replace(/[^\d.]/g,'');assert(open>500&&roof>0&&roof<=open*1.05,`roofs ${roof} vs open ground ${open}`);}
   else{const v=['No thermal stress','Heat stress','Cold stress'].map(k=>+shown.find(([a])=>a.startsWith(k))[1].replace(/%.*/,''));assert(Math.abs(v[0]+v[1]+v[2]-100)<0.6,'The three stress shares cover every counted hour: '+v);}
   await p.locator('#save').click();
   const run=await p.evaluate(async({pid,id})=>{const S=await import('./js/store.js');return S.project(pid).runs.filter(r=>r.simId===id).at(-1);},{pid,id});
   assert(run,'Result saved to the version');assert.equal(run.settings.climateFile.station,'QA Climate, BC, CAN');assert(run.settings.sharedConditions.signature.includes(run.settings.sharedConditions.site.climate.hash));
   if(id==='radiation'){assert(run.results.roofs>0&&run.results.ground>0);assert(Number.isFinite(run.results.pv));assert.equal(run.results.field.unit,'kWh/m²');}
   else{assert(run.results.comfort>=0&&run.results.comfort<=100);assert(run.results.heat>=0&&run.results.cold>=0);assert.equal(run.settings.utci.sunUpOnly,true);}
   await p.screenshot({path:require('os').tmpdir()+'/climate-'+id+'.png'});console.log('PASS',id,'run from the project EPW and saved',JSON.stringify(run.results.kpis.slice(0,4)));
  }
  // 4 · Wind Flow takes the same file for its comfort map (solving the 16 directions is left to real GPUs)
  await p.goto(base+'/mvp/#/simulations/wind');await p.locator('#eng[data-pc-visible-ready="true"]').waitFor({timeout:120000});
  await p.waitForFunction(()=>document.querySelector('#eng').contentWindow.__windComfort?.E?.station==='QA Climate, BC, CAN',null,{timeout:90000});
  assert.match(await p.frameLocator('#eng').locator('#cmfRun').textContent(),/directions|Map wind comfort/);console.log('PASS wind comfort reads the project EPW');
  // 5 · changing the project's climate file marks those results as needing a re-run
  const stale=await p.evaluate(async pid=>{const S=await import('./js/store.js'),pr=S.project(pid),c=S.conditionsOf(pr);S.updateConditions(pr,{...c.site,climate:{...c.site.climate,hash:'other-file'}},c.defaults);return pr.runs.filter(r=>['radiation','utci'].includes(r.simId)).map(r=>S.runConditionsStatus(pr,r));},pid);
  assert.deepEqual(stale,['Shared conditions changed · rerun required','Shared conditions changed · rerun required']);
  assert.deepEqual(errors,[]);console.log('PASS climate studies');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1});
