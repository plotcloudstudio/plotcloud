// Results: batch runs (one forced failure, Retry), results by version, and the compare workbench (diff colours and list,
// display modes, Sync cameras, Whole model / One level / One simulation with threshold). Static server on 8765 or TEST_BASE.
const L={};
const {chromium}=require('playwright');
const SP=require('os').tmpdir()+'/';
L.SP=SP;
L.open=async(w=1600,h=900)=>{const b=await chromium.launch({args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});const ctx=await b.newContext({viewport:{width:w,height:h}});const p=await ctx.newPage();
 const errs=[];p.on('pageerror',e=>errs.push(e.message));p.on('console',m=>{if(m.type()==='error'&&!/404|Failed to load resource/.test(m.text()))errs.push('console: '+m.text())});
 const B=(process.env.TEST_BASE||'http://127.0.0.1:8765')+'/mvp/';
 return {b,p,errs,B};};
L.ws=async(p,B,clear=true)=>{if(clear){await p.goto(B);await p.evaluate(()=>localStorage.clear());await p.goto(B+'#/');await p.waitForTimeout(600);}
 await p.goto(B+'#/workspace');for(let i=0;i<60;i++){await p.waitForTimeout(400);if(await p.evaluate(()=>window.__ws2&&window.__ws2.ready()))break;}await p.waitForTimeout(500);};
// a plan point (m) on the page, in the Plan pane
L.P=(p,x,y,pane='fPlan')=>p.evaluate(([x,y,pane])=>{const f=document.getElementById(pane),w=f.contentWindow,fr=f.getBoundingClientRect(),cv=w.document.getElementById('cv').getBoundingClientRect(),q=w.__st.toPx([x,y]);return [fr.left+cv.left+q[0],fr.top+cv.top+q[1]];},[x,y,pane]);
L.W=(p,role,fn,arg)=>p.evaluate(([role,fn,arg])=>{const w=document.getElementById({plan:'fPlan',persp:'fPersp',props:'fProps'}[role]).contentWindow;return (new Function('w','arg','return ('+fn+')(w,arg)'))(w,arg);},[role,fn.toString(),arg]);
L.ok=(c,m)=>{console.log((c?'PASS ':'FAIL ')+m);if(!c)process.exitCode=1;};

const {ok}=L;
(async()=>{const {b,p,errs,B}=await L.open(1500,1000);await p.goto(B);await p.evaluate(()=>localStorage.clear());await p.reload();await p.waitForTimeout(500);
// the Workspace converts the draft to Plan Studio's model; then three changes: two windows resized, a desk added, the east wall deleted
await L.ws(p,B,false);
await p.evaluate(async()=>{const S=await import('./js/store.js');S.reload();const pr=S.projects()[0];const st=pr.draft.studio;
  for(const id of ['c12','c13']){const o=st.ops.find(x=>x.id===id);o.w=+(o.w+0.4).toFixed(3);}
  st.furn.push({id:'fx1',lv:'L1',type:'box',x:12.5,y:4,w:1.2,d:0.6,h:0.75,rot:0,label:'Test desk',object_type:'furniture',layer:'Furniture'});
  st.walls=st.walls.filter(w=>w.id!=='c8');S.save();});
await p.goto(B+'#/results');await p.waitForTimeout(3000);
// §1 · four studies, one input changed, one made to fail
ok(/unsaved changes/.test(await p.evaluate(()=>document.getElementById('runOn').textContent)),'Results says the Workspace has unsaved changes that will be saved first');
for(const id of ['daylight','spacesyntax','views','isovist'])await p.check(`[data-pick="${id}"]`);
ok(/Run selected \(4\)/.test(await p.textContent('#btRun')),'Run selected (4)');
await p.click('[data-open="daylight"]');const wp=await p.$('[data-ov="daylight"][data-id="wp"]');ok(!!wp,'Daylight opens its own inputs (work plane, occupied hours, site)');await wp.fill('0.85');await wp.dispatchEvent('change');
await p.route('**/emb/views.html*',r=>r.abort());
await p.click('#btRun');await p.waitForTimeout(1500);
const nv=await p.evaluate(()=>{const db=JSON.parse(localStorage.getItem('pc-mvp-v1'));const v=db.projects[0].versions.at(-1);return [db.projects[0].versions.length,v.note];});ok(nv[0]===3&&/before a batch/.test(nv[1]),'the unsaved changes became v3 before the run: '+nv[1]);
const st=async()=>p.evaluate(()=>Object.fromEntries(__res.batch.items().map(x=>[x.simId,x.status])));
let s0;for(let i=0;i<120;i++){await p.waitForTimeout(2000);s0=await st();if(!Object.values(s0).some(x=>x==='queued'||x==='running'))break;if(i%10===0)console.log('  ',JSON.stringify(s0),await p.textContent('#btTxt'));}
console.log('  statuses:',JSON.stringify(s0));
ok(s0.daylight==='done'&&s0.spacesyntax==='done'&&s0.isovist==='done'&&s0.views==='failed','three done, the forced failure failed without stopping them');
ok(await p.evaluate(()=>!!document.querySelector('[data-row="views"] [data-retry]')&&/Failed/.test(document.querySelector('[data-st="views"]').textContent)),'the failed one is marked Failed with Retry');
await p.unroute('**/emb/views.html*');await p.click('[data-row="views"] [data-retry]');
for(let i=0;i<60;i++){await p.waitForTimeout(2000);s0=await st();if(s0.views!=='queued'&&s0.views!=='running')break;}
ok(s0.views==='done','Retry runs it again: '+s0.views);
const runs=await p.evaluate(()=>{const db=JSON.parse(localStorage.getItem('pc-mvp-v1'));const pr=db.projects[0],v=pr.versions.at(-1);return pr.runs.filter(r=>r.versionId===v.id).map(r=>({sim:r.simId,src:r.source,set:r.settings,thumb:!!r.results.thumb,field:!!r.results.field}));});
ok(runs.length===4&&runs.every(r=>r.src==='batch'),'four results saved on v3 from the batch');
ok(/Work plane 0.85/.test(JSON.stringify(runs.find(r=>r.sim==='daylight').set)),'the changed input is recorded with the result: '+runs.find(r=>r.sim==='daylight').set['changed here']);
ok(await p.evaluate(()=>document.querySelectorAll('#cards .rcard').length)===4,'Results by version: four cards on v3 (figures, picture, Enter)');
// §2 · compare v2 → v3: three changes, three highlights, right colours
await p.evaluate(async()=>{const db=JSON.parse(localStorage.getItem('pc-mvp-v1'));const vs=db.projects[0].versions;await __res.setAB(vs[1].id,vs[2].id);});await p.waitForTimeout(4000);
const items=await p.evaluate(()=>__res.items().map(i=>i.change+':'+i.id));console.log('  changes:',items.join(', '));
const cnt=await p.evaluate(()=>document.getElementById('cwCount').dataset);
ok(items.length===4&&cnt.items==='4'&&cnt.lit==='4','2 windows modified + 1 desk added + 1 wall removed = 4 list rows = 4 highlighted ('+cnt.items+' / '+cnt.lit+')');
const col=await p.evaluate(()=>{const [a,b2]=__res.views();const pa=Object.fromEntries(a.probe().map(o=>[o.id,o])),pb=Object.fromEntries(b2.probe().map(o=>[o.id,o]));return {w:pb['ps:op:c12']?.color,d:pb['ps:furn:fx1']?.color,rA:pa['ps:wall:c8']?.color,ghost:!!pb['ghost:ps:wall:c8'],ghostOp:pb['ghost:ps:wall:c8']?.op,mode:__res.C.mode};});
console.log('  colours:',JSON.stringify(col));
ok(col.w==='f2c200'&&col.d==='2fa84f'&&col.rA==='d8402a','yellow modified, green added, red removed');
ok(col.ghost&&col.ghostOp===0,'the removed wall shows in B as a red outline where it stood');
ok(col.mode==='solid','default display: Solid colour');
// list → view, view → list
const camBefore=await p.evaluate(()=>JSON.stringify(__res.views()[1].getCam()));
await p.click('[data-item="ps:furn:fx1"]');await p.waitForTimeout(600);
ok(await p.evaluate(b4=>JSON.stringify(__res.views()[1].getCam())!==b4,camBefore),'clicking a change moves the view to it (and flashes it)');
await p.evaluate(()=>__res.pick('ps:op:c12',false));await p.waitForTimeout(400);
const scr=await p.evaluate(()=>__res.views()[1].screenOf('ps:furn:fx1'));console.log('  desk on screen at',JSON.stringify(scr),await p.evaluate(s=>{const e=document.elementFromPoint(s.x,s.y);return e.tagName+' '+e.parentElement.id;},scr));await p.mouse.click(scr.x,scr.y);await p.waitForTimeout(400);
ok(await p.evaluate(()=>document.querySelector('[data-item="ps:furn:fx1"]').getAttribute('aria-current'))==='true','clicking the green desk in the view picks its line in the list');
// modes remembered
await p.click('[data-mode="hl"]');await p.waitForTimeout(300);const hl=await p.evaluate(()=>{const pb=Object.fromEntries(__res.views()[1].probe().map(o=>[o.id,o]));return [pb['ps:wall:c5']?.color,pb['ps:op:c12']?.color];});
ok(hl[0]==='c9c9c6'&&hl[1]==='f2c200','Highlight only: everything grey except the changes');
await p.click('[data-mode="ghost"]');await p.waitForTimeout(300);ok(await p.evaluate(()=>__res.views()[0].display)==='ghosted','Ghosted overlay is still there');
await p.reload();await p.waitForTimeout(5000);ok(await p.evaluate(()=>document.querySelector('[data-mode="ghost"]').getAttribute('aria-pressed'))==='true','the display mode is remembered after a reload');
await p.click('[data-mode="solid"]');
// §3 · sync cameras
await p.evaluate(async()=>{const db=JSON.parse(localStorage.getItem('pc-mvp-v1'));const vs=db.projects[0].versions;await __res.setAB(vs[1].id,vs[2].id);});await p.waitForTimeout(3000);
ok(await p.isChecked('#sync'),'Sync cameras is on by default');
const cam0=await p.evaluate(()=>JSON.stringify(__res.views()[0].getCam().p));const box=await p.evaluate(()=>{const r=document.getElementById('vpa').getBoundingClientRect();return [r.left+r.width/2,r.top+r.height/2];});
await p.mouse.move(...box);await p.mouse.down({button:'right'});await p.mouse.move(box[0]+120,box[1]+30,{steps:6});await p.mouse.up({button:'right'});await p.waitForTimeout(200);
const same=await p.evaluate((c0)=>{const [a,b2]=__res.views();const x=a.getCam(),y=b2.getCam();return [...x.p,...x.t].every((v,i)=>Math.abs(v-[...y.p,...y.t][i])<1e-6)&&JSON.stringify(x.p)!==c0;},cam0);ok(same,'turning A turns B to the same camera');
await p.uncheck('#sync');await p.mouse.move(...box);await p.mouse.down({button:'right'});await p.mouse.move(box[0]-150,box[1],{steps:6});await p.mouse.up({button:'right'});await p.waitForTimeout(200);
ok(await p.evaluate(()=>{const [a,b2]=__res.views();return JSON.stringify(a.getCam().p)!==JSON.stringify(b2.getCam().p);}),'with Sync off, A turns alone');
await p.check('#sync');
// §4 · one level: two plans, highlighted, pan and zoom synced
await p.selectOption('#scope','level');await p.waitForTimeout(3000);
ok(await p.evaluate(()=>__res.views().every(v=>v.camera()==='plan'))&&!(await p.isHidden('#lvSel')),'One level: two plans side by side, with a level picker');
ok(await p.evaluate(()=>document.getElementById('cwCount').dataset.lit)==='4','the same four changes highlighted in plan');
await p.mouse.move(...box);await p.mouse.wheel(0,-400);await p.waitForTimeout(200);await p.mouse.down({button:'right'});await p.mouse.move(box[0]+60,box[1]+40,{steps:5});await p.mouse.up({button:'right'});await p.waitForTimeout(200);
ok(await p.evaluate(()=>{const [a,b2]=__res.views();return JSON.stringify(a.getCam().q)===JSON.stringify(b2.getCam().q);}),'plan zoom and pan follow in B');
// §4 · one simulation, with a missing version and Run it now
await p.selectOption('#scope','sim');await p.selectOption('#simSel','daylight');await p.waitForTimeout(1500);
ok(await p.evaluate(()=>/Not run on v2/.test(document.getElementById('ma').textContent)&&!!document.querySelector('#ma [data-runnow]')),'Daylight not run on v2: says so, with Run it now');
await p.click('#ma [data-runnow]');for(let i=0;i<60;i++){await p.waitForTimeout(2000);const x=await st();if(x.daylight&&!/queued|running/.test(Object.values(await p.evaluate(()=>__res.batch.items().filter(i=>i.simId==='daylight').map(i=>i.status))).join()))break;}
await p.waitForTimeout(1500);
const sim=await p.evaluate(()=>({cv:document.querySelectorAll('.fcv').length,rows:document.querySelectorAll('.cw-tab tbody tr').length,chg:document.querySelectorAll('.cw-tab td.chg').length,n:+document.getElementById('fCount')?.dataset.changed}));
console.log('  sim compare:',JSON.stringify(sim));
ok(sim.cv===2&&sim.rows>=3,'both result maps and the figure table (v2 | v3 | B − A)');
const thrMax=await p.evaluate(()=>+document.getElementById('thr').max);
await p.evaluate(()=>{const t=document.getElementById('thr');t.value='0';t.dispatchEvent(new Event('input'));});const n0=await p.evaluate(()=>+document.getElementById('fCount').dataset.changed);
await p.evaluate((m)=>{const t=document.getElementById('thr');t.value=String(m*0.5);t.dispatchEvent(new Event('input'));},thrMax);const n1=await p.evaluate(()=>+document.getElementById('fCount').dataset.changed);
console.log('  changed points at 0 and at half the range:',n0,n1);ok(n0>n1,'moving the threshold changes the highlighted points at once ('+n0+' → '+n1+')');
await p.screenshot({path:L.SP+'tw2.png',fullPage:true});
if(errs.length){console.log('page errors:',errs);process.exitCode=1;}await b.close();})().catch(e=>{console.error(e);process.exitCode=1;});
