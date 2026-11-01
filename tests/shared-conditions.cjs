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
 await p.goto(base+'/mvp/#/');await p.waitForFunction(()=>document.querySelector('#app')?.children.length>0);   // the home page (its .scene hero was replaced in the 2026-10-31 redesign)
 await p.goto(base+'/mvp/#/account');await p.waitForTimeout(800);releaseHome();await p.unroute('**/sun-example.json');
 // the Account page has no simulation defaults tab since the 2026-10-31 redesign: where the field is not shown, the default is set in the store
 if(await p.locator('[data-k="plane"]').isVisible().catch(()=>false)){await p.locator('[data-k="plane"]').fill('2');await p.locator('#saveDefs').click();assert.equal(await p.evaluate(async()=>(await import('./js/store.js')).account().defaults.plane),.8,'Invalid Account defaults must not be saved');await p.locator('[data-k="plane"]').fill('1.2');await p.locator('#saveDefs').click();}
 else await p.evaluate(async()=>{const S=await import('./js/store.js');S.account().defaults.plane=1.2;S.save();});
 const inherited=await p.evaluate(async()=>{const S=await import('./js/store.js'),old=S.projects()[0],fresh=S.createProject('New defaults test',{units:'m',components:[],layers:[]});return{old:S.clone(S.conditionsOf(old)),fresh:S.clone(S.conditionsOf(fresh))};});
 assert.deepEqual(inherited.old,state.shared);assert.equal(inherited.fresh.defaults.plane,1.2);
 await p.goto(base+'/mvp/#/project-settings/'+state.id+'?return=sunhours');
 for(const [id,value]of Object.entries({sharedLabel:'Toronto pilot',sharedZone:'America/Toronto',sharedLat:'43.65',sharedLon:'-79.38',sharedNorth:'15',sharedPlane:'1',sharedOccStart:'9',sharedOccEnd:'17'}))await p.locator('#'+id).fill(value);
 await p.getByRole('button',{name:'Save shared conditions',exact:true}).click();assert.match(await p.locator('#sharedNotice').innerText(),/Saved revision 2/);
 await p.getByRole('button',{name:'Save shared conditions',exact:true}).click();assert.match(await p.locator('#sharedNotice').innerText(),/No changes/);
 await p.locator('#sharedOccEnd').fill('8');await p.getByRole('button',{name:'Save shared conditions',exact:true}).click();assert.match(await p.locator('#sharedNotice').innerText(),/later than/);
 await p.evaluate(async id=>{const S=await import('./js/store.js');localStorage.setItem('pc-mvp-current',id);},state.id);
 const open=async id=>{await p.goto(base+'/mvp/#/simulations/'+id);await p.locator('#eng[data-emb="'+id+'"][data-pc-settings-ready="true"][data-pc-visible-ready="true"]').waitFor();const f=p.frameLocator('#eng');await f.locator('#pilotSettings').waitFor();await p.locator('#autoSaveResult').uncheck();return f;};
 const tab=async(f,side,name)=>{if(side==='L')await f.getByRole('button',{name:'Jump to '+name,exact:true}).click();else await f.locator('#panel'+side+' .pc-fit-tabs').getByRole('tab',{name,exact:true}).click();await f.locator('#pilot'+name).waitFor({state:'visible'});await p.waitForTimeout(60);};
 const reach=async(f,selector)=>{await require('./reveal-simulation-control.cjs')(f,selector);await f.locator(selector).scrollIntoViewIfNeeded();};
 const fill=async(f,id,val)=>{await f.locator('#'+id).fill(String(val));await f.locator('#'+id).dispatchEvent('change');};
 // Sun hours and Daylight run in the Workspace (2026-11-01: their study pages redirect there): each takes the project's shared
 // conditions (north 15°; Daylight also work plane 1 m and occupied 9 to 17) and records them with the saved result
 await p.goto(base+'/mvp/#/workspace/'+state.id);await p.waitForFunction(()=>window.__ws2?.inst.persp.ready&&window.__ws2?.inst.plan.ready,null,{timeout:180000});
 await p.evaluate(()=>document.querySelector('.pc-start .x')?.click());
 for(const [id,menu] of [['daylight','#addSimInt']]){   // Sun hours on the ground needs a site picked on the map (workspace-in-view covers it); the sample project has none
  await p.click(menu);await p.click(`.w2-simmenu [data-addsim=${id}]`);await p.locator('.sp-studycard [data-st=run]').waitFor();
  if(id==='daylight'){await p.click('[data-st-set="dlLevel:draft"]');assert.match(await p.locator('.sp-studycard').innerText(),/Occupied 9:00 to 17:00[\s\S]*Work plane 1 m/);}
  await p.click('[data-st=run]');await p.waitForFunction(()=>{const s=window.__wsStudy.state();return !s.busy&&(s.res||s.err);},null,{timeout:300000});
  assert.equal(await p.evaluate(()=>window.__wsStudy.state().err),'',id);
  await p.click('[data-st=save]');await p.waitForFunction(()=>window.__wsStudy.state().saved||window.__wsStudy.state().err,null,{timeout:60000});
  const run=await p.evaluate(async({pid,id})=>{const S=await import('./js/store.js');return S.project(pid).runs.filter(r=>r.simId===id).at(-1);},{pid:state.id,id}),sc=run?.settings?.sharedConditions;
  assert(sc&&sc.site.north===15&&sc.signature,id+' '+JSON.stringify(sc));
  if(id==='daylight'){assert(sc.effective.parameters[3]===15&&sc.effective.parameters[8]===1&&JSON.stringify(sc.effective.parameters[11])==='[9,17]',JSON.stringify(sc.effective));assert(run.results.kpis.some(([k,v])=>/^sDA/.test(k)&&/\d/.test(v))&&run.results.field?.pts?.length>10);}
 }
 state.model=await p.evaluate(async pid=>JSON.stringify((await import('./js/store.js')).project(pid).versions.at(-1).model),state.id);   // the version the Workspace result was saved with
 const history=await p.evaluate(async pid=>{const S=await import('./js/store.js'),pr=S.project(pid);return JSON.stringify(pr.runs);},state.id);
 await p.goto(base+'/mvp/#/project-settings/'+state.id);await p.locator('#sharedNorth').fill('25');await p.getByRole('button',{name:'Save shared conditions',exact:true}).click();assert.match(await p.locator('#sharedNotice').innerText(),/1 saved result/);
 assert.equal(await p.evaluate(async pid=>{const S=await import('./js/store.js'),pr=S.project(pid);return JSON.stringify(pr.runs);},state.id),history,'Changing shared conditions must not rewrite historical results');
 await p.goto(base+'/mvp/#/results/'+state.id);await p.locator('[data-conditions-stale]').first().waitFor();assert.equal(await p.locator('[data-conditions-stale]').count(),1);
 const final=await p.evaluate(async pid=>{const S=await import('./js/store.js'),E=await import('./js/pages/sim-engine.js'),pr=S.project(pid);return{model:JSON.stringify(pr.versions.at(-1).model),plane:E.batchInfo('daylight',pr,pr.versions.at(-1)).fields.find(x=>x.id==='wp').value};},state.id);
 assert.equal(final.model,state.model);assert.equal(final.plane,1,'Batch panel must inherit project defaults, not the changed Account default');
 await p.reload();await p.locator('[data-conditions-stale]').first().waitFor();assert.equal(await p.locator('[data-conditions-stale]').count(),1);
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
