// Replan items 02 and 04 in the real app: schema-2 migration of stored legacy data (with its pre-migration copy), then a complete
// project backup made in one browser profile and restored through Account → Backup & data in a second, separate profile, where
// the EPW still drives a real UTCI run. Damaged files are rejected without changing anything; ID conflicts become copies.
const assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path'),{chromium}=require('playwright');
const base=process.env.TEST_BASE||'http://127.0.0.1:8765',out=process.env.EVIDENCE_DIR||path.join(os.tmpdir(),'plotcloud-project-backup');fs.mkdirSync(out,{recursive:true});
// Synthetic test weather (not a real station): the same generator as tests/climate-studies.cjs, at the sample site.
function epw(){const lat=49.28,lon=-123.12,tz=-8,lines=[`LOCATION,QA Climate,BC,CAN,TEST,000,${lat},${lon},${tz},12`,...Array(7).fill('TEST')],R=Math.PI/180;
 for(let i=0;i<8760;i++){const d=new Date(Date.UTC(2025,0,1,i)),doy=Math.floor(i/24),hr=i%24+.5,dec=23.44*Math.sin(2*Math.PI*(284+doy+1)/365)*R,ha=((hr-12)*15+(lon-tz*15))*R;
  const alt=Math.asin(Math.sin(lat*R)*Math.sin(dec)+Math.cos(lat*R)*Math.cos(dec)*Math.cos(ha)),s=Math.max(0,Math.sin(alt)),cloud=(doy%5===0)?.8:.2;
  const dni=s>0.01?Math.round(850*(1-cloud)*Math.pow(s,.3)):0,dhi=s>0.01?Math.round(60+220*cloud*s):0,ghi=Math.round(dni*s+dhi),t=(10+8*Math.sin(2*Math.PI*(doy-110)/365)+4*Math.sin(2*Math.PI*(hr-9)/24)).toFixed(1);
  const row=Array(35).fill('0');Object.assign(row,{0:'2025',1:String(d.getUTCMonth()+1),2:String(d.getUTCDate()),3:String(d.getUTCHours()+1),4:'60',6:t,7:(t-6).toFixed(1),8:'65',9:'101000',12:'310',13:String(ghi),14:String(dni),15:String(dhi),20:String((i*7)%360),21:(2+3*Math.abs(Math.sin(i/37))).toFixed(1)});lines.push(row.join(','));}
 return Buffer.from(lines.join('\n'));}
const ok=(m)=>console.log('PASS',m);
async function runUtci(p,pid){
 await p.goto(base+'/mvp/#/simulations/utci');await p.locator('#eng[data-emb="utci"][data-pc-visible-ready="true"]').waitFor({timeout:120000});const f=p.frameLocator('#eng');
 await f.locator('#projectClimateSummary').filter({hasText:'qa.epw'}).waitFor({state:'attached',timeout:90000});
 await p.evaluate(()=>{const d=document.querySelector('#eng').contentDocument;d.querySelector('#lvlSeg [data-l=custom]').click();const g=d.getElementById('grid');g.value='4';g.dispatchEvent(new Event('change',{bubbles:true}));});
 await p.locator('#autoSaveResult').uncheck();await p.evaluate(()=>document.querySelector('#eng').contentDocument.getElementById('run').click());await require('./confirm-solar-inputs.cjs')(f);
 await p.waitForFunction(()=>{const s=document.querySelector('#eng').contentWindow.__sun.S;return s.lastR&&s.lastR.mode==='utci'&&!s.busy;},null,{timeout:240000});
 await p.locator('#save').click();
 return p.evaluate(async pid=>{const S=await import('./js/store.js');return S.clone(S.project(pid).runs.filter(r=>r.simId==='utci').at(-1));},pid);
}
const storeState=(p)=>p.evaluate(async()=>{const S=await import('./js/store.js');S.reload();return S.clone(S.projects().map(x=>({id:x.id,name:x.name,versions:x.versions.length,runs:x.runs.map(r=>r.id),revs:(x.planRevisions||[]).length,cond:x.sharedConditions})));});
(async()=>{const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||undefined,headless:true,args:['--enable-unsafe-swiftshader']});
try{
 // ---- 02 · legacy data stored by the previous release migrates once, with a copy kept first
 const ctx0=await browser.newContext(),m=await ctx0.newPage(),errors=[];m.on('pageerror',e=>errors.push(e.message));
 await m.goto(base+'/mvp/');await m.waitForFunction(()=>document.querySelector('#app h1'));
 const legacy=await m.evaluate(async()=>{const S=await import('./js/store.js');S.reset();const D=JSON.parse(localStorage.getItem('pc-mvp-v1'));
  for(const p of D.projects){for(const k of ['contract','parameters','plans','planRevisions','assets','runGroups','reportRevisions','feedback'])delete p[k];}
  const p=D.projects[0];p.runs.push({id:'rLegacy',versionId:p.versions[0].id,simId:'daylight',settings:{note:'legacy'},results:{kpis:[['Mean DF','2.1 %']]},created:'2026-10-01T00:00:00Z',source:'full-tool'});
  localStorage.setItem('pc-mvp-v1',JSON.stringify(D));return D;});
 for(let i=0;i<2;i++){await m.reload();await m.waitForFunction(()=>document.querySelector('#app h1'));}   // a real page load each time
 const mig=await m.evaluate(async()=>{const S=await import('./js/store.js'),C=await import('./js/project-contract.js'),P=await import('./js/parameters.js');const p=S.projects()[0],pre=await S.preMigrationBackup();
  return {schema:p.contract.schema,from:p.contract.migratedFrom,revs:p.planRevisions.map(r=>r.id),run:p.runs.find(r=>r.id==='rLegacy'),lat:P.resolve(p,{path:'site.lat'}),problems:C.integrityProblems(p),mism:P.mirrorMismatches(p),pre:pre&&JSON.parse(pre)};});
 assert.equal(mig.schema,2);assert.equal(mig.from,1);assert.equal(mig.revs.length,legacy.projects[0].versions.length,'one legacy revision per version, not duplicated on reopen');
 assert.equal(mig.run.planRevisionId,'rev-'+legacy.projects[0].versions[0].id);assert.deepEqual(mig.run.settings,{note:'legacy'});assert.equal(mig.lat.valueOrigin,'unrecorded');
 assert.deepEqual(mig.problems,[]);assert.deepEqual(mig.mism,[]);
 assert.equal(mig.pre.format,'plotcloud-backup');assert.equal(mig.pre.v,1);assert.equal(mig.pre.projects[0].contract,undefined,'pre-migration copy is the untouched legacy data');
 assert.ok(mig.pre.projects[0].runs.some(r=>r.id==='rLegacy'));
 ok('legacy data migrated once to schema 2; pre-migration v1 copy kept in IndexedDB');
 await ctx0.close();

 // ---- 04 · profile A: project with an uploaded EPW, a real UTCI result, a derived plan B
 const ctxA=await browser.newContext({acceptDownloads:true}),a=await ctxA.newPage();a.on('pageerror',e=>errors.push(e.message));
 await a.goto(base+'/mvp/');await a.waitForFunction(()=>document.querySelector('#app h1'));
 const pid=await a.evaluate(async()=>{const S=await import('./js/store.js');S.reset();S.account().user={name:'Backup QA',email:'qa@example.test'};S.save();return S.projects()[0].id;});
 await a.goto(base+'/mvp/#/project-settings/'+pid+'?return=utci');await a.locator('#projectEpw').setInputFiles({name:'qa.epw',mimeType:'text/plain',buffer:epw()});await a.locator('#projectEpwSummary').filter({hasText:'8760 hours'}).waitFor();
 const runA=await runUtci(a,pid);assert.ok(runA.planRevisionId&&runA.inputs.values['weather.epw'],'run carries its plan revision and weather input');
 const before=await a.evaluate(async pid=>{const S=await import('./js/store.js'),C=await import('./js/project-contract.js'),p=S.project(pid);const rev=C.revision(p,p.runs.at(-1).planRevisionId);C.derivePlan(p,rev.id);S.save();return S.clone(p);},pid);
 assert.equal(before.plans.length,2);assert.equal(before.assets.length,1);
 // a second project points at a weather file this browser does not have (e.g. made on another device)
 await a.evaluate(async()=>{const S=await import('./js/store.js'),p=S.createProject('Other device project',{units:'m',layers:[],components:[]});const c=S.conditionsOf(p);S.updateConditions(p,{...c.site,climate:{name:'gone.epw',hash:'f'.repeat(64),station:'Elsewhere',hours:8760}},c.defaults);});
 await a.goto(base+'/mvp/#/account?tab=data');const [dl]=await Promise.all([a.waitForEvent('download'),a.locator('#exp').click()]);const file=path.join(out,'backup.json');await dl.saveAs(file);
 await a.locator('#lastB').filter({hasText:'weather file'}).waitFor();assert.match(await a.locator('#lastB').innerText(),/1 weather file included\. Not included \(not in this browser\): gone\.epw/);
 const backup=JSON.parse(fs.readFileSync(file,'utf8'));
 assert.equal(backup.v,2);assert.equal(backup.assets.length,1);assert.equal(backup.assets[0].name,'qa.epw');assert.equal(backup.assets[0].data.split('\n').length,8768,'the EPW contents are in the file');
 assert.deepEqual(backup.missingAssets.map(x=>x.name),['gone.epw']);assert.match(backup.completeness,/incomplete/);
 ok('backup holds models, plans, parameters, runs and the EPW contents; the missing EPW is listed, not hidden');
 const aState=await storeState(a);

 // ---- profile B: a different browser storage; restore through the Account page
 const ctxB=await browser.newContext(),b=await ctxB.newPage();b.on('pageerror',e=>errors.push(e.message));
 await b.goto(base+'/mvp/');await b.waitForFunction(()=>document.querySelector('#app h1'));
 assert.equal(await b.evaluate(async h=>{const P=await import('./js/project-climate.js');return !!(await P.climateFile(h));},backup.assets[0].hash),false,'profile B starts without the EPW');
 await b.evaluate(async()=>{const S=await import('./js/store.js');S.account().user={name:'Restore QA',email:'qa2@example.test'};S.save();});
 const restore=async(buf,mode='merge')=>{await b.goto(base+'/mvp/#/account?tab=data');await b.locator('#impMode').selectOption(mode);await b.locator('#impMsg').evaluate(e=>{e.textContent='';});await b.locator('#impFile').setInputFiles({name:'backup.json',mimeType:'application/json',buffer:buf});await b.locator('#impMsg').filter({hasText:/Restored|not restored|not a PlotCloud|damaged/}).waitFor({timeout:30000});return b.locator('#impMsg').innerText();};
 const bBefore=await storeState(b);
 // damaged: one result value edited → integrity fails, nothing changes
 const edited=JSON.parse(JSON.stringify(backup));edited.projects.find(x=>x.id===pid).runs.at(-1).results.kpis[0][1]='99 %';
 assert.match(await restore(Buffer.from(JSON.stringify(edited))),/integrity check failed/);assert.deepEqual(await storeState(b),bBefore);
 // damaged weather contents with a recomputed file hash → the asset's own SHA-256 fails, nothing changes
 const {hashOf}=await import(require('node:url').pathToFileURL(path.join(__dirname,'../mvp/js/contract-hash.js')).href);
 const badAsset=JSON.parse(JSON.stringify(backup));badAsset.assets[0].data=badAsset.assets[0].data.replace(/\n2025,1,1,1,/, '\n2025,1,1,1,9');const {integrity,...rest}=badAsset;badAsset.integrity={...integrity,hash:hashOf(rest)};
 assert.match(await restore(Buffer.from(JSON.stringify(badAsset))),/damaged \(its contents do not match/);assert.deepEqual(await storeState(b),bBefore);
 // broken reference (run → missing version) with a recomputed hash → referential check fails
 const badRef=JSON.parse(JSON.stringify(backup));badRef.projects.find(x=>x.id===pid).runs.at(-1).versionId='v-missing';{const {integrity,...r}=badRef;badRef.integrity={...integrity,hash:hashOf(r)};}
 assert.match(await restore(Buffer.from(JSON.stringify(badRef))),/points at missing version/);assert.deepEqual(await storeState(b),bBefore);
 assert.equal(await b.evaluate(async h=>{const P=await import('./js/project-climate.js');return !!(await P.climateFile(h));},backup.assets[0].hash),false,'rejected files store no weather');
 ok('edited, damaged-asset and broken-reference files are rejected; profile B unchanged');
 // the real restore
 const msg=await restore(fs.readFileSync(file));assert.match(msg,/Restored 2 projects from backup\.json, with 1 weather file\..*Missing weather \(upload again to rerun\): gone\.epw/s);
 // profile B already has its own sample project with the same ID, so the restored one arrived as a copy
 const rid=await b.evaluate(async pid=>{const S=await import('./js/store.js');return S.projects().find(x=>x.restoredFrom?.id===pid)?.id;},pid);assert.ok(rid,'restored sample project present as a copy');
 const got=await b.evaluate(async({pid,hash})=>{const S=await import('./js/store.js'),C=await import('./js/project-contract.js'),P=await import('./js/parameters.js'),K=await import('./js/project-climate.js');const p=S.project(pid),rec=await K.climateFile(hash);
  return {p:S.clone(p),problems:C.integrityProblems(p),mism:P.mirrorMismatches(p),epw:rec&&rec.text.length,epwName:rec?.name,applic:P.applicability(p,p.runs.at(-1))};},{pid:rid,hash:backup.assets[0].hash});
 for(const k of ['versions','runs','plans','planRevisions','parameters','sharedConditions','assets'])assert.deepEqual(got.p[k],before[k],k+' restored exactly');
 assert.deepEqual(got.problems,[]);assert.deepEqual(got.mism,[]);assert.equal(got.epwName,'qa.epw');assert.equal(got.epw,backup.assets[0].data.length);assert.equal(got.applic.status,'current');
 ok('profile B has the same plans, revisions, parameter sources, runs and EPW');
 // open the restored result in Results, then run the study again from the restored EPW
 await b.evaluate(pid=>localStorage.setItem('pc-mvp-current',pid),rid);await b.goto(base+'/mvp/#/results');await b.waitForFunction(()=>document.querySelector('#app h1'));
 assert.match(await b.locator('#app').innerText(),/Outdoor thermal comfort|UTCI/i);await b.screenshot({path:path.join(out,'restored-results.png'),fullPage:false});
 const runB=await runUtci(b,rid);assert.equal(runB.inputs.values['weather.epw'],backup.assets[0].hash);assert.equal(runB.inputHash,runA.inputHash,'same model and inputs after restore');assert.notEqual(runB.planRevisionId,runA.planRevisionId,'the rerun belongs to plan B, derived before the backup');
 const noTiming=k=>k.filter(([label])=>label!=='Computed');assert.deepEqual(noTiming(runB.results.kpis),noTiming(runA.results.kpis),'same inputs, same engine → same result in the other browser (compute time aside)');await b.screenshot({path:path.join(out,'restored-utci-rerun.png')});
 ok('restored EPW drives a real UTCI run in profile B with identical results: '+JSON.stringify(runB.results.kpis.slice(0,3)));
 // the same file again: the project already here is kept, the restored one is a copy
 const keep=await storeState(b);const again=await restore(fs.readFileSync(file));assert.match(again,/2 already existed here and were added as a copy/);
 const after=await storeState(b);for(const x of keep)assert.deepEqual(after.find(y=>y.id===x.id),x,'existing project unchanged');assert.equal(after.length,keep.length+2);
 assert.ok(after.some(x=>/\(restored \d{4}-\d\d-\d\d\)$/.test(x.name)));
 ok('ID conflicts are added as copies; existing projects unchanged');
 // per-project backup from Project conditions downloads only that project
 await b.goto(base+'/mvp/#/project-settings/'+rid);const [dl2]=await Promise.all([b.waitForEvent('download'),b.locator('#projectBackup').click()]);const one=JSON.parse(fs.readFileSync(await dl2.path(),'utf8'));
 assert.deepEqual(one.projects.map(x=>x.id),[rid]);assert.equal(one.assets.length,1);assert.equal(one.account,null);ok('per-project backup');
 // version-1 files still restore
 const v1={format:'plotcloud-backup',v:1,exported:'2026-10-01T00:00:00Z',account:aState.account,projects:[{...legacy.projects[0],id:'p-v1-file',name:'From v1 file'}]};
 assert.match(await restore(Buffer.from(JSON.stringify(v1))),/Restored 1 project.*Version-1 backup: weather files were not part of it/s);
 assert.equal(await b.evaluate(async()=>{const S=await import('./js/store.js');return S.project('p-v1-file')?.contract?.schema;}),2);ok('version-1 backups restore and migrate');
 assert.deepEqual(errors,[]);console.log('Evidence:',out);
}finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1});
