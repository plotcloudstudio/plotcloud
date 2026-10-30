// Replan items 05–12 in the real app: create a project from coordinates in Simple mode, switch modes without data change,
// single overrides and restore, use template, then on the sample model: a real Daylight run → executable suggestion → one
// click "adopt and run Plan B" (real batch rerun) → comparison → report revision with PPTX/PDF/HTML/evidence/review file →
// client review imported as feedback → Plan C adopted and rerun. Tables read the same run IDs.
const assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path'),{execFileSync}=require('node:child_process'),{chromium}=require('playwright');
const base=process.env.TEST_BASE||'http://127.0.0.1:8765',out=process.env.EVIDENCE_DIR||path.join(os.tmpdir(),'plotcloud-replan-workflow');fs.mkdirSync(out,{recursive:true});
const ok=m=>console.log('PASS',m);
(async()=>{const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||undefined,headless:true,args:['--enable-unsafe-swiftshader']});
try{
 const ctx=await browser.newContext({acceptDownloads:true,viewport:{width:1440,height:950}}),p=await ctx.newPage(),errors=[];p.on('pageerror',e=>errors.push(e.message));
 // weather download is an external service: keep it out of this test (its own tests cover it)
 await p.route('**/functions/v1/**',r=>r.abort());
 await p.goto(base+'/mvp/');await p.waitForFunction(()=>document.querySelector('#app h1'));
 await p.evaluate(async()=>{const S=await import('./js/store.js');S.reset();S.account().user={name:'Workflow QA',email:'qa@example.test'};S.account().defaults.plane=1.0;S.save();});
 const state=async id=>p.evaluate(async id=>{const S=await import('./js/store.js'),C=await import('./js/project-contract.js');const x=S.project(id);return {hash:JSON.stringify({v:x.versions,r:x.runs,pl:x.plans,pr:x.planRevisions,par:x.parameters,c:x.sharedConditions,a:x.assets}),mode:x.contract.uiMode,stats:C.stats(x)};},id);

 // ---- 05 · create from coordinates in Simple mode; address-only first screen
 await p.goto(base+'/mvp/#/project/new');await p.locator('#newProject').waitFor();
 assert.equal(await p.locator('#npMore').evaluate(d=>d.open),false,'Simple keeps the optional details closed');
 await p.locator('#npLat').fill('43.6532');await p.locator('#npLon').fill('-79.3832');await p.locator('#newProject button[type=submit]').click();
 await p.waitForFunction(()=>/#\/project\/p/.test(location.hash));const pid=await p.evaluate(()=>location.hash.split('/')[2]);
 await p.locator('#pjReadyList [data-study]').first().waitFor();
 const ready=await p.locator('#pjReadyList [data-study]').evaluateAll(es=>es.map(e=>[e.dataset.study,e.dataset.state]));
 assert.deepEqual(Object.fromEntries(ready).climate,'error','address project: climate waits for weather (download blocked in this test)');
 assert.equal(Object.fromEntries(ready).daylight,'error','no room model yet: interior waits');
 const created=await p.evaluate(async id=>{const S=await import('./js/store.js'),P=await import('./js/parameters.js');const x=S.project(id);return {mode:x.contract.uiMode,lat:P.resolve(x,{path:'site.lat'}),plane:P.resolve(x,{path:'study.plane'})};},pid);
 assert.equal(created.mode,'simple');assert.equal(created.lat.value,43.6532);assert.equal(created.plane.value,1.0);assert.equal(created.plane.acquisition,'account-default');
 ok('project created from coordinates in Simple mode; readiness per study; Account default copied once');
 // mode switch both ways: nothing changes
 const s0=await state(pid);await p.locator('[name=pjMode][value=advanced]').check();await p.waitForTimeout(200);await p.locator('[name=pjMode][value=simple]').check();await p.waitForTimeout(200);
 const s1=await state(pid);assert.equal(s1.hash,s0.hash,'switching modes changes no data');assert.equal(s1.mode,'simple');
 // single override in Simple, then restore default
 p.once('dialog',d=>d.accept('0.75'));await p.locator('#pjParamTable [data-set="study.plane"]').click().catch(async()=>{await p.locator('[name=pjMode][value=advanced]').check();p.once('dialog',d=>d.accept('0.75'));await p.locator('#pjParamTable [data-set="study.plane"]').click();});
 await p.locator('#pjParamTable tr[data-path="study.plane"]').filter({hasText:'0.75'}).waitFor();
 assert.match(await p.locator('#pjParamTable tr[data-path="study.plane"]').innerText(),/User override · (Simple|Advanced) manual entry/);
 await p.locator('#pjParamTable [data-restore="study.plane"]').click();
 await p.waitForFunction(id=>import('./js/store.js').then(S=>import('./js/parameters.js').then(P=>P.resolve(S.project(id),{path:'study.plane'}).value===0.8)),pid);
 if(await p.locator('[name=pjMode][value=simple]').isChecked())assert.equal(await p.locator('#pjParamTable tr[data-path="study.plane"]').count(),0,'Simple lists only custom, derived and location inputs');
 await p.locator('[name=pjMode][value=advanced]').check();assert.match(await p.locator('#pjParamTable tr[data-path="study.plane"]').innerText(),/0\.8 m[\s\S]*Platform default · template/);
 ok('single override and restore default from the project page');
 // use template: school schedule is not office; Account change does not reach the project
 await p.locator('#pjUseSel').selectOption('school');await p.locator('#pjUseApply').click();await p.locator('#pjUseBody').filter({hasText:'plotcloud-use-school'}).waitFor();
 const prog=await p.evaluate(async id=>{const S=await import('./js/store.js'),P=await import('./js/parameters.js'),U=await import('./js/use-templates.js');const x=S.project(id);S.account().defaults.plane=1.3;S.save();
  return {use:P.resolve(x,{path:'program.use'}).value,lpd:P.resolve(x,{path:'program.lightingPowerDensity'}),occ:U.occupiedHours(x.contract.config.program,{hours:8760}).count,office:U.occupiedHours(U.USE_TEMPLATES.office,{hours:8760}).count,leap:U.annualProfile(x.contract.config.program,'occupancy',{hours:8784}).length,plane:P.resolve(x,{path:'study.plane'}).value};},pid);
 assert.equal(prog.use,'school');assert.equal(prog.lpd.ruleVersion,'plotcloud-use-school@2026-10-30.1');assert.notEqual(prog.occ,prog.office,'school calendar differs from office');assert.equal(prog.leap,8784);assert.equal(prog.plane,0.8,'Account change after creation does not reach the project');
 ok('use template applied as a fixed version; school ≠ office; leap calendar kept');

 // ---- 09 · sample project: real Daylight run, suggestion, adopt and run Plan B
 const sid='demo-courtyard';
 const runA=await p.evaluate(async id=>{const S=await import('./js/store.js'),B=await import('./js/batch.js');const x=S.project(id),v=x.versions.at(-1);
  return await new Promise(res=>{const bt=B.createBatch(document.body,{onChange:items=>{const it=items[0];if(it&&['done','failed'].includes(it.status)){bt.dispose();res(S.clone(x.runs.find(r=>r.id===it.runId)||{failed:it.why}));}}});bt.add([{projectId:x.id,simId:'daylight',versionId:v.id}]);});},sid);
 assert.ok(runA.id,'Plan A daylight run saved: '+runA.failed);assert.ok(runA.planRevisionId);
 await p.goto(base+'/mvp/#/project/'+sid);await p.locator('#pjSuggestBody [data-suggest]').waitFor();
 assert.equal(await p.locator('#pjSuggestBody [data-suggest]').getAttribute('data-suggest'),'needs-target','no suggestion without a project target');
 await p.locator('#pjTarget').fill(String(Math.ceil(runA.results.df+1)));await p.locator('#pjTargetSave').click();
 await p.locator('#pjSuggestBody [data-suggest="ok"]').waitFor();const recText=await p.locator('#pjSuggestBody').innerText();assert.match(recText,/Enlarge/);assert.match(recText,new RegExp(runA.id));
 await p.locator('#pjAdopt').click();
 await p.locator('#pjGroups [data-group]').first().waitFor();
 await p.waitForFunction(()=>['succeeded','partial','failed'].includes(document.querySelector('#pjGroups [data-group]')?.dataset.state),null,{timeout:400000});
 const B=await p.evaluate(async id=>{const S=await import('./js/store.js'),C=await import('./js/project-contract.js');const x=S.project(id),g=x.runGroups[0],run=x.runs.find(r=>r.id===g.tasks.find(t=>t.simId==='daylight').runId),rev=C.revision(x,g.planRevisionId),plan=x.plans.find(q=>q.id===rev.planId);return {g:S.clone(g),run:S.clone(run),plan:S.clone(plan),rec:S.clone(x.recommendations[0]),vA:S.clone(x.versions.at(-2)),vB:S.clone(x.versions.at(-1))};},sid);
 assert.equal(B.g.state,'succeeded');assert.equal(B.plan.name,'B');assert.equal(B.plan.parentRevisionId,runA.planRevisionId);assert.equal(B.run.planRevisionId,B.g.planRevisionId);
 const w=B.rec.patch.id,ga=B.vA.model.components.find(c=>c.id===w).g,gb=B.vB.model.components.find(c=>c.id===w).g;assert.deepEqual(gb,B.rec.patch.to);assert.deepEqual(ga,B.rec.patch.from,'Plan A model unchanged');
 assert.ok(Number.isFinite(B.run.results.df));console.log('   A df',runA.results.df,'→ B df',B.run.results.df,'(real engine, no improvement promised)');
 // idempotent: adopting the same suggestion again creates nothing
 const again=await p.evaluate(async id=>{const S=await import('./js/store.js'),R=await import('./js/recommendations.js');const x=S.project(id),n=[x.plans.length,x.versions.length,x.runGroups.length];const a=R.adopt(S,x,x.recommendations[0]);return {a,n,m:[x.plans.length,x.versions.length,x.runGroups.length]};},sid);
 assert.equal(again.a.repeated,true);assert.deepEqual(again.m,again.n);
 ok('one click: real Plan B, real patch, automatic real rerun, lineage kept; repeat adoption is a no-op');
 // a stale basis is refused
 const stale=await p.evaluate(async id=>{const S=await import('./js/store.js'),R=await import('./js/recommendations.js');const x=S.project(id),rec={...S.clone(x.recommendations[0]),id:'rec-stale-test',basis:{...x.recommendations[0].basis,physicalHash:'0'}};try{R.adopt(S,x,rec);return 'adopted';}catch(e){return e.message;}},sid);
 assert.match(stale,/conditions changed/i);ok('suggestion on a changed basis is refused');

 // ---- 10 · comparison
 await p.goto(base+'/mvp/#/project/'+sid);await p.locator('#cmpSim').selectOption('daylight');await p.locator('#cmpTable').waitFor();
 assert.equal(await p.locator('[data-comparability]').getAttribute('data-comparability'),'design');
 assert.match(await p.locator('#cmpTable tr[data-metric="df"]').innerText(),/pp/);assert.match(await p.locator('#cmpTable tr[data-metric="df"]').innerText(),/target/i);
 assert.match(await p.locator('#cmpField').innerText(),/matching sensors|No point difference/);
 ok('A/B comparison: design comparison, percentage points, target-based judgement');

 // ---- 11 · report revision and files
 await p.locator('#repNote').fill('采光改善需要与眩光一起复核。Daylight rises near the enlarged window.');
 const [pp]=await Promise.all([p.waitForEvent('download'),p.locator('[data-rep="pptx"]').click()]);const pptx=path.join(out,'report.pptx');await pp.saveAs(pptx);
 const shapes=execFileSync('python3',['-c',`from pptx import Presentation
p=Presentation(${JSON.stringify(pptx)})
import json;print(json.dumps([[s.shape_type.__int__() if s.shape_type else 0,s.name,s.text_frame.text if s.has_text_frame else '',s.has_table] for sl in p.slides for s in sl.shapes]))`]).toString();
 const sh=JSON.parse(shapes);assert.ok(sh.some(s=>s[3]),'native table present');assert.ok(sh.some(s=>/采光改善/.test(s[2])),'Chinese conclusion is editable text');
 const dfText=B.run.results.df.toFixed(1);assert.ok(sh.some(s=>s[1].startsWith('Bar value')&&s[2].includes(dfText)),'B daylight factor in the editable bars');
 const [ev]=await Promise.all([p.waitForEvent('download'),p.locator('[data-rep="json"]').click()]);const evidence=JSON.parse(fs.readFileSync(await ev.path(),'utf8'));
 const sec=evidence.spec.sections.find(s=>s.simId==='daylight');assert.equal(sec.runIds.b,B.run.id);assert.equal(sec.metrics.find(m=>m.key==='df').b,B.run.results.df);
 assert.ok(evidence.reportRevision.n>=2,'each export saves a new report revision');assert.deepEqual(evidence.reportRevision.changedChapters,[],'unchanged inputs → every chapter reused');
 const [rv]=await Promise.all([p.waitForEvent('download'),p.locator('[data-rep="review"]').click()]);const reviewFile=path.join(out,'review.html');await rv.saveAs(reviewFile);
 const [pdf]=await Promise.all([p.waitForEvent('download',{timeout:120000}),p.locator('[data-rep="pdf"]').click()]);const pdfFile=path.join(out,'report-comparison.pdf');await pdf.saveAs(pdfFile);assert.ok(fs.statSync(pdfFile).size>10000);
 try{execFileSync('soffice',['--headless','--convert-to','pdf','--outdir',out,pptx],{timeout:120000});ok('PPTX also opens in LibreOffice: '+path.join(out,'report.pdf'));}catch(e){console.log('LibreOffice conversion not run:',e.message.split('\n')[0]);}
 ok('report revisions: PPTX (editable text/table/bars, Chinese), PDF, evidence JSON, review file; same run IDs and values');

 // ---- client review file → feedback → Plan C
 const rp=await ctx.newPage();await rp.goto('file://'+reviewFile);await rp.locator('#who').fill('Client Q');await rp.locator('textarea').first().fill('Please make the south window wider still.');
 const [rf]=await Promise.all([rp.waitForEvent('download'),rp.locator('#save').click()]);const reviewJSON=path.join(out,'review.json');await rf.saveAs(reviewJSON);await rp.close();
 await p.locator('#fbImport').setInputFiles(reviewJSON);await p.locator('#fbList [data-fb]').first().waitFor();
 assert.match(await p.locator('#fbList').innerText(),/Client Q.*wider still/s);
 const fid=await p.locator('#fbList [data-fb]').first().getAttribute('data-fb');
 await p.locator(`[data-fb="${fid}"] summary`).click();const win=B.rec.patch.id;await p.locator(`[data-fbwin="${fid}"]`).selectOption(win);await p.locator(`[data-fbw="${fid}"]`).fill(String(Math.round((B.rec.patch.to.w+0.2)*10)/10));
 await p.locator(`[data-fbadopt="${fid}"]`).click();
 await p.waitForFunction(()=>{const g=[...document.querySelectorAll('#pjGroups [data-group]')];return g.length>=2&&['succeeded','partial','failed'].includes(g.at(-1).dataset.state);},null,{timeout:400000});
 const Cc=await p.evaluate(async id=>{const S=await import('./js/store.js'),C=await import('./js/project-contract.js');const x=S.project(id),g=x.runGroups.at(-1),rev=C.revision(x,g.planRevisionId),plan=x.plans.find(q=>q.id===rev.planId),f=x.feedback[0];return {state:g.state,plan:plan.name,parent:C.revision(x,plan.parentRevisionId)?.planId,planB:x.plans.find(q=>q.name==='B').id,fb:S.clone(f),lineage:C.lineage(x,rev.id).length};},sid);
 assert.equal(Cc.state,'succeeded');assert.equal(Cc.plan,'C');assert.equal(Cc.parent,Cc.planB);assert.equal(Cc.fb.status,'adopted');assert.ok(Cc.lineage>=3);
 ok('client review → feedback bound to the report revision → Plan C derived from B and rerun');

 // ---- tables read the same runs
 await p.goto(base+'/mvp/#/tables?project='+sid);await p.locator('#tbSummary tr[data-run]').first().waitFor();
 assert.ok(await p.locator(`#tbSummary tr[data-run="${B.run.id}"]`).count());ok('tables reference saved run IDs');
 await p.screenshot({path:path.join(out,'tables.png')});
 // ---- 08 · a valid model runs its default package without Workbench edits (only ready studies; no EPW → no radiation/UTCI)
 await p.goto(base+'/mvp/#/project/'+sid);await p.locator('#pjPackageNote').filter({hasText:'Ready:'}).waitFor();
 const note=await p.locator('#pjPackageNote').innerText();assert.match(note,/Sun hours/);assert.doesNotMatch(note,/Solar radiation|thermal comfort/,'studies that need an EPW are not in the package without one');
 const nGroups=await p.locator('#pjGroups [data-group]').count();await p.locator('#pjPackage').click();
 await p.waitForFunction(n=>{const g=[...document.querySelectorAll('#pjGroups [data-group]')];return g.length>n&&['succeeded','partial','failed'].includes(g.at(-1).dataset.state);},nGroups,{timeout:600000});
 assert.equal(await p.locator('#pjGroups [data-group]').last().getAttribute('data-state'),'succeeded');ok('default study package ran on the valid model: '+note);await p.goto(base+'/mvp/#/project/'+sid);await p.locator('#pjGroups [data-group]').first().waitFor();await p.screenshot({path:path.join(out,'project-overview.png'),fullPage:true});
 // phone: overview readable, no horizontal scroll
 const m=await browser.newPage({viewport:{width:390,height:844}});await m.goto(base+'/mvp/');await m.waitForFunction(()=>document.querySelector('#app h1'));
 await m.evaluate(async st=>{localStorage.setItem('pc-mvp-v1',st);},await p.evaluate(()=>localStorage.getItem('pc-mvp-v1')));await m.goto(base+'/mvp/#/project/'+sid);await m.reload();await m.locator('#pjName').waitFor();
 assert.equal(await m.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),true,'no horizontal scroll on a phone');await m.screenshot({path:path.join(out,'project-phone.png')});
 ok('phone: project overview opens without horizontal scroll');
 assert.deepEqual(errors,[]);console.log('Evidence:',out);
}finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1});
