const assert=require('node:assert/strict'),fs=require('node:fs'),{chromium}=require('playwright');
const base=process.env.TEST_BASE||'http://127.0.0.1:8765';
(async()=>{const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||undefined,headless:true,args:['--enable-unsafe-swiftshader']});
try{
 const p=await browser.newPage({viewport:{width:1500,height:1000},acceptDownloads:true}),errors=[];p.on('pageerror',e=>{errors.push(e.message);console.error(e.stack||e.message);});
 await p.goto(base+'/mvp/');await p.waitForFunction(()=>!!document.querySelector('#app h1'));
 const state=await p.evaluate(async()=>{const S=await import('./js/store.js');S.reset();const pr=S.projects()[0];return {id:pr.id,shared:S.clone(S.conditionsOf(pr)),model:JSON.stringify(pr.versions.at(-1).model)};});
 // Exercise Account UI rather than changing the existing project's fields by hand.
 await p.evaluate(async()=>{const S=await import('./js/store.js');S.account().user={name:'Pilot QA',email:'qa@example.test'};S.save();});
 let releaseHome;const gate=new Promise(r=>releaseHome=r);await p.route('**/sun-example.json',async route=>{await gate;await route.continue();});
 await p.goto(base+'/mvp/#/');await p.locator('.scene').waitFor();
 await p.goto(base+'/mvp/#/account');await p.locator('[data-k="plane"]').waitFor();releaseHome();await p.waitForTimeout(150);await p.unroute('**/sun-example.json');
 await p.locator('[data-k="plane"]').fill('2');await p.locator('#saveDefs').click();assert.equal(await p.evaluate(async()=>(await import('./js/store.js')).account().defaults.plane),.8,'Invalid Account defaults must not be saved');await p.locator('[data-k="plane"]').fill('1.2');await p.locator('#saveDefs').click();
 const inherited=await p.evaluate(async()=>{const S=await import('./js/store.js'),old=S.projects()[0],fresh=S.createProject('New defaults test',{units:'m',components:[],layers:[]});return{old:S.clone(S.conditionsOf(old)),fresh:S.clone(S.conditionsOf(fresh))};});
 assert.deepEqual(inherited.old,state.shared);assert.equal(inherited.fresh.defaults.plane,1.2);
 await p.goto(base+'/mvp/#/project-settings/'+state.id+'?return=sunhours');
 for(const [id,value]of Object.entries({sharedLabel:'Toronto pilot',sharedZone:'America/Toronto',sharedLat:'43.65',sharedLon:'-79.38',sharedNorth:'15',sharedPlane:'1',sharedOccStart:'9',sharedOccEnd:'17'}))await p.locator('#'+id).fill(value);
 await p.getByRole('button',{name:'Save shared conditions',exact:true}).click();assert.match(await p.locator('#sharedNotice').innerText(),/Saved revision 2/);
 await p.getByRole('button',{name:'Save shared conditions',exact:true}).click();assert.match(await p.locator('#sharedNotice').innerText(),/No changes/);
 await p.locator('#sharedOccEnd').fill('8');await p.getByRole('button',{name:'Save shared conditions',exact:true}).click();assert.match(await p.locator('#sharedNotice').innerText(),/later than/);
 await p.evaluate(async id=>{const S=await import('./js/store.js');localStorage.setItem('pc-mvp-current',id);},state.id);
 const open=async id=>{await p.goto(base+'/mvp/#/simulations/'+id);await p.locator('#eng[data-pc-settings-ready="true"]').waitFor();const f=p.frameLocator('#eng');await f.locator('#pilotSettings').waitFor();return f;};
 const tab=async(f,side,name)=>{await f.locator('#panel'+side+' .pc-fit-tabs').getByRole('tab',{name,exact:true}).click();await f.locator('#pilot'+name).waitFor({state:'visible'});await p.waitForTimeout(60);};
 const reach=async(f,selector,side='L')=>{for(let n=0;n<20;n++){const pos=await f.locator(selector).evaluate(e=>{const r=e.getBoundingClientRect(),v=e.closest('.pc-fit-window').getBoundingClientRect();return r.top<v.top+1?-1:r.bottom>v.bottom-1?1:0;});if(!pos)return;const b=f.locator('#panel'+side+' .pc-fit-pages').getByRole('button',{name:pos<0?'← Previous':'Next →',exact:true});if(!await b.isVisible()||!await b.isEnabled())break;await b.click();await p.waitForTimeout(50);}throw Error('Not reachable through panel pages: '+selector);};
 const fill=async(f,id,val)=>{await f.locator('#'+id).fill(String(val));await f.locator('#'+id).dispatchEvent('change');};
 for(const id of ['sunhours','daylight']){
  const f=await open(id);
  assert.deepEqual(await f.locator('#panelL .pc-fit-tabs>button').evaluateAll(es=>es.filter(e=>!e.hidden).map(e=>e.textContent)),['Settings','Export']);
  assert.deepEqual(await f.locator('#panelR .pc-fit-tabs>button').evaluateAll(es=>es.filter(e=>!e.hidden).map(e=>e.textContent)),['Results','Charts']);
  assert.equal(await f.locator('#pilotCharts').isVisible(),false,'Inactive Charts must not remain visible under Results');
  if(id==='sunhours')assert.equal(await f.locator('#pilotAdvanced #lvlSeg').count(),1,'Detailed calculation inputs belong inside Advanced');
  assert.match(await f.locator('#pilotSharedSummary').innerText(),/Toronto/);assert.equal(await f.locator('#lat').inputValue(),'43.65');assert.equal(await f.locator('#north').inputValue(),'15');
  assert(await f.locator('#lat').isDisabled());assert.equal(await f.locator('#pilotOverrides').getAttribute('open'),null);
  if(id==='daylight'){assert.equal(await f.locator('#wp').inputValue(),'1');assert.equal(await f.locator('#occ0').inputValue(),'9');assert.equal(await f.locator('#occ1').inputValue(),'17');}
  const unified=await f.locator('.app').getAttribute('data-pc-unified')==='true';
  if(unified){assert.equal(await f.locator('#pilotOverrides').isVisible(),false,'Project values have one editor, not duplicate inputs');assert.equal(await f.locator('#pilotSharedSummary a').count(),1);}
  else{
  await f.locator('#pilotOverrides').evaluate(e=>e.open=true);await p.waitForTimeout(80);await reach(f,'#pilotOverrideEnabled');await f.locator('#pilotOverrideEnabled').check();await reach(f,'#north');await fill(f,'north',30);
  assert.equal(await p.evaluate(async id=>(await import('./js/store.js')).conditionsOf((await import('./js/store.js')).project(id)).site.north,state.id),15,'Study overrides must not write project conditions');
  await reach(f,'#pilotResetShared');await f.locator('#pilotResetShared').click();assert.equal(await f.locator('#north').inputValue(),'15');assert(await f.locator('#north').isDisabled());
  await reach(f,'#pilotOverrideEnabled');await f.locator('#pilotOverrideEnabled').check();await reach(f,'#north');await fill(f,'north',20);
  await f.locator('#pilotOverrides').evaluate(e=>e.open=false);
  }
  if(id==='sunhours'){
   await f.locator('#pilotAdvanced').evaluate(e=>e.open=true);await f.locator('#lvlSeg [data-l=custom]').click();await f.locator('#grid').selectOption('4');await f.locator('#step').selectOption('30');await f.locator('#pilotAdvanced').evaluate(e=>e.open=false);
   await reach(f,'#run');await f.locator('#run').click();await p.waitForFunction(()=>{const s=document.querySelector('#eng').contentWindow.__sun.S;return s.lastR&&!s.busy;},null,{timeout:90000});
  }else{
   await f.locator('#run:not([disabled])').waitFor();await reach(f,'#run');await f.locator('#run').click();await p.waitForFunction(()=>document.querySelector('#eng').contentWindow.__pcAnalysisState?.().ready,null,{timeout:90000});
  }
  await p.locator('#save').click();
  const run=await p.evaluate(async({pid,id})=>{const S=await import('./js/store.js');return S.project(pid).runs.filter(r=>r.simId===id).at(-1);},{pid:state.id,id});
  assert(run,'Real result must be saved');assert.equal(run.settings.sharedConditions.site.north,15);assert.equal(run.settings.sharedConditions.effective.north??run.settings.sharedConditions.effective.parameters?.[3],unified?15:20);
  assert.equal(run.settings.sharedConditions.studyOnlyOverrides,!unified);assert(run.results.kpis.some(([,v])=>/\d/.test(v)));
  await tab(f,'R','Charts');assert(await f.locator('#legend').isVisible());assert.equal(await f.locator('#pilotResults').isVisible(),false);
  assert.equal(await f.locator('#pilotChartSelect').count(),0,'Charts has no per-chart selector');
  assert(await f.locator('#chartp .cpg').count()>=4);
  for(const chart of await f.locator('#chartp .cpg').all())assert(await chart.isVisible(),'All charts appear in the same list');
  await tab(f,'L','Export');
  if(id==='daylight'){const download=p.waitForEvent('download');await f.locator('[data-ex=csv]').click();assert(fs.readFileSync(await(await download).path()).length>20);}
  await p.screenshot({path:require('os').tmpdir()+'/shared-'+id+'.png'});
 }
 const history=await p.evaluate(async pid=>{const S=await import('./js/store.js'),pr=S.project(pid);return JSON.stringify(pr.runs);},state.id);
 await p.goto(base+'/mvp/#/project-settings/'+state.id);await p.locator('#sharedNorth').fill('25');await p.getByRole('button',{name:'Save shared conditions',exact:true}).click();assert.match(await p.locator('#sharedNotice').innerText(),/2 saved result/);
 assert.equal(await p.evaluate(async pid=>{const S=await import('./js/store.js'),pr=S.project(pid);return JSON.stringify(pr.runs);},state.id),history,'Changing shared conditions must not rewrite historical results');
 await p.goto(base+'/mvp/#/results/'+state.id);await p.locator('[data-conditions-stale]').first().waitFor();assert.equal(await p.locator('[data-conditions-stale]').count(),2);
 const final=await p.evaluate(async pid=>{const S=await import('./js/store.js'),E=await import('./js/pages/sim-engine.js'),pr=S.project(pid);return{model:JSON.stringify(pr.versions.at(-1).model),plane:E.batchInfo('daylight',pr,pr.versions.at(-1)).fields.find(x=>x.id==='wp').value};},state.id);
 assert.equal(final.model,state.model);assert.equal(final.plane,1,'Batch panel must inherit project defaults, not the changed Account default');
 await p.reload();await p.locator('[data-conditions-stale]').first().waitFor();assert.equal(await p.locator('[data-conditions-stale]').count(),2);
 await p.evaluate(async pid=>{const S=await import('./js/store.js'),{createBatch}=await import('./js/batch.js'),pr=S.project(pid),v=pr.versions.at(-1),host=document.createElement('div');document.body.append(host);window.__pilotBatch=createBatch(host);window.__pilotBatch.add(['sunhours','daylight'].map(simId=>({simId,projectId:pid,versionId:v.id,ov:simId==='sunhours'?{'@day':'03-20'}:{wp:'1.1'}})));},state.id);
 await p.waitForFunction(()=>window.__pilotBatch.items().length===2&&window.__pilotBatch.items().every(i=>['done','failed'].includes(i.status)),null,{timeout:180000});
 const batch=await p.evaluate(async pid=>{const S=await import('./js/store.js');return {items:window.__pilotBatch.items(),runs:S.project(pid).runs.filter(r=>r.source==='batch')};},state.id);
 assert.deepEqual(batch.items.map(i=>i.status),['done','done'],JSON.stringify(batch.items));assert.equal(batch.runs.length,2);assert(batch.runs.every(r=>r.settings.sharedConditions.site.north===25));
 assert.equal(batch.runs.find(r=>r.simId==='daylight').settings.sharedConditions.effective.parameters[8],1.1,'Batch overrides must remain effective over inherited project defaults');
 // Upgrade a legacy record once, then prove that subsequent Account changes cannot alter it.
 const migration=await p.evaluate(async pid=>{const S=await import('./js/store.js'),db=JSON.parse(localStorage.getItem('pc-mvp-v1')),pr=db.projects.find(x=>x.id===pid),history=JSON.stringify(pr.runs);delete pr.sharedConditions;localStorage.setItem('pc-mvp-v1',JSON.stringify(db));S.reload();const frozen=S.clone(S.conditionsOf(S.project(pid)));S.account().site.lat=12;S.account().defaults.plane=.4;S.save();S.reload();return {frozen,after:S.conditionsOf(S.project(pid)),historyBefore:history,historyAfter:JSON.stringify(S.project(pid).runs)};},state.id);
 assert.deepEqual(migration.after,migration.frozen);assert.equal(migration.historyAfter,migration.historyBefore);
 assert.deepEqual(errors,[]);console.log('PASS shared conditions pilot: Account isolation, new project defaults, project validation, two unified layouts, Workspace input, real runs, overrides/reset, charts/export, immutable historical snapshots, stale warnings and batch inheritance');
}finally{await browser.close();}})().catch(e=>{console.error(e);process.exitCode=1});
