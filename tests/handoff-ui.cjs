// Results kept with their inputs (rewritten 2026-11-01): the handoff dialog and the study pages' named configurations are gone
// (studies start ready; Daylight runs in the Workspace), so this checks what remains of that contract: a light-only appearance after
// a legacy dark preference, Project props that change nothing without Save, two real Daylight runs saved with the version and
// their shared conditions, same-version comparison and export on Results, and history that stays as it was but is marked stale
// when the project's conditions change.
const assert=require('node:assert/strict'),fs=require('node:fs'),{chromium}=require('playwright');
const base=process.env.TEST_BASE||'http://127.0.0.1:8790';
(async()=>{const browser=await chromium.launch({headless:true,args:['--no-sandbox','--enable-unsafe-swiftshader']});try{
 const context=await browser.newContext({viewport:{width:1440,height:1000},colorScheme:'dark',acceptDownloads:true}),p=await context.newPage(),errors=[];p.on('pageerror',e=>errors.push(e.message));
 await p.addInitScript(()=>{localStorage.setItem('pc-mvp-theme','night');localStorage.setItem('pc-ui-theme','night');});
 await p.goto(base+'/mvp/');const id=await p.evaluate(async()=>{const S=await import('./js/store.js');window.__qaStore=S;S.reset();return S.projects()[0].id;});
 await p.goto(base+'/mvp/#/workspace/'+id);await p.waitForFunction(()=>window.__ws2?.inst.persp.ready&&window.__ws2?.inst.plan.ready,null,{timeout:180000});
 assert.equal(await p.evaluate(()=>getComputedStyle(document.documentElement).colorScheme),'light');assert.equal(await p.locator('#themeSeg,.pc-ui-theme').count(),0);
 await p.evaluate(()=>document.querySelector('.pc-start .x')?.click());
 // Project props: closing without Save changes nothing
 const original=await p.evaluate(async id=>{const S=await import('./js/store.js');return S.clone(S.conditionsOf(S.project(id)));},id);
 await p.evaluate(()=>window.__wsProps());await p.locator('.pp-form [name="site.lat"]').fill('10');await p.locator('[data-pp=close]').click();
 assert.deepEqual(await p.evaluate(async id=>{const S=await import('./js/store.js');return S.conditionsOf(S.project(id));},id),original,'Closing Project props without Save leaves the project conditions unchanged');
 // two Daylight runs (glass 0.6, then 0.5), saved with the version
 await p.click('#addSimInt');await p.click('.w2-simmenu [data-addsim=daylight]');await p.locator('.sp-studycard [data-st-set="dlLevel:draft"]').waitFor();await p.click('[data-st-set="dlLevel:draft"]');
 for(const tau of ['0.6','0.5']){
  await p.locator('.sp-studycard [data-dl=dlTau]').fill(tau);await p.locator('.sp-studycard [data-dl=dlTau]').dispatchEvent('change');
  await p.click('[data-st=run]');await p.waitForFunction(()=>{const s=window.__wsStudy.state();return !s.busy&&(s.res||s.err);},null,{timeout:300000});assert.equal(await p.evaluate(()=>window.__wsStudy.state().err),'');
  await p.click('[data-st=save]');await p.waitForFunction(()=>window.__wsStudy.state().saved||window.__wsStudy.state().err,null,{timeout:60000}); }
 const records=await p.evaluate(async id=>{const S=await import('./js/store.js');return S.project(id).runs.filter(r=>r.simId==='daylight');},id);
 assert.equal(records.length,2);assert.deepEqual(records.map(r=>r.settings.tau),[0.6,0.5]);assert(records.every(r=>r.settings.sharedConditions?.signature&&r.versionId),'each result keeps its version and shared conditions');
 assert.equal(records[0].versionId,records[1].versionId,'the second run on the same model is kept with the same version');
 // Results: the two runs side by side, exported as a pair
 await p.goto(base+'/mvp/#/results/'+id);await p.reload();await p.locator('#runComparison>summary').click();const indices=await p.locator('#compareRunA option').evaluateAll(options=>options.map(o=>o.value).slice(-2));assert.equal(indices.length,2);
 await p.selectOption('#compareRunA',String(indices[0]));await p.selectOption('#compareRunB',String(indices[1]));assert.match(await p.locator('#compareRunValues').innerText(),/sDA/);
 const download=p.waitForEvent('download');await p.locator('#exportRunPair').click();const pair=JSON.parse(fs.readFileSync(await(await download).path(),'utf8'));assert.equal(pair.length,2);assert(pair.every(r=>r.settings.sharedConditions));
 // a change to the project's conditions leaves history as it was, marked stale
 const history=await p.evaluate(async id=>JSON.stringify((await import('./js/store.js')).project(id).runs),id);
 await p.goto(base+'/mvp/#/project-settings/'+id);await p.locator('#sharedNorth').fill('15');await p.getByRole('button',{name:'Save shared conditions',exact:true}).click();
 assert.equal(await p.evaluate(async id=>JSON.stringify((await import('./js/store.js')).project(id).runs),id),history,'Changing shared conditions must not rewrite saved results');
 await p.goto(base+'/mvp/#/results/'+id);await p.locator('[data-conditions-stale]').first().waitFor({state:'visible'});assert(await p.evaluate(async id=>{const S=await import('./js/store.js'),p=S.project(id);return p.runs.filter(r=>r.simId==='daylight').every(r=>!!S.runConditionsStatus(p,r));},id));
 assert.deepEqual(errors,[]);console.log('PASS light-only legacy preference recovery; Project props cancel; two real Daylight runs in the Workspace kept with their version and shared conditions; same-version comparison/export; immutable stale history');
}finally{await browser.close();}})().catch(e=>{console.error(e);process.exit(1)});
