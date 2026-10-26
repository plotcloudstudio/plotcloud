// Workbench view/level separation and object transforms. Serve the repo; TEST_BASE overrides localhost:8770.
const {chromium}=require('playwright');
const assert=require('node:assert/strict');
const path=require('node:path');
(async()=>{
 const b=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||'/usr/bin/chromium',args:['--no-sandbox','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
 try {
 const p=await b.newPage({viewport:{width:1600,height:1000}}),errors=[];p.on('pageerror',e=>errors.push(e.message));
 await p.route('https://cdn.jsdelivr.net/npm/three@*/**',r=>{const part=r.request().url().split('/examples/jsm/')[1];return r.fulfill({path:path.join(__dirname,'../furniture',part?'addons/'+part:'three.module.min.js'),contentType:'text/javascript'});});
 const url=(process.env.TEST_BASE||'http://127.0.0.1:8770')+'/mvp/#/workspace';await p.goto(url);await p.waitForFunction(()=>window.__ws2?.ready());
 await p.evaluate(async()=>{
  const S=await import('./js/store.js'),m=__ws2.model().studio,L=m.levels[0].id;
  m.walls.push({id:'gz-wall',lv:L,a:[18,0],b:[22,0],t:.2},{id:'gz-neighbor',lv:L,a:[22,0],b:[22,4],t:.2});
  m.ops.push({id:'gz-opening',wall:'gz-wall',pos:2,w:1,kind:'win',sill:1,head:2.1});
  m.floors.push({id:'gz-floor',lv:L,x:18,y:5,w:4,d:3,thickness:.2,points:[[18,5],[22,5],[22,8],[18,8]],holes:[[[19,6],[20,6],[20,7],[19,7]]]});
  (m.fences||(m.fences=[])).push({id:'gz-fence',lv:L,points:[[18,10],[22,10]],h:1.1,spacing:1.5});
  (m.masses||(m.masses=[])).push({id:'gz-mass',name:'Gizmo mass',points:[[25,0],[29,0],[29,3],[25,3]],storeys:2,fh:3,z:0});
  (m.imports||(m.imports=[])).push({id:'gz-import',name:'Gizmo imported block',layer:'Furniture',type:'furniture',mat:'Imported',g:{x:25,y:6,z:0,w:2,d:1,h:1},mesh:[0,0,0,2,0,0,2,1,0,0,0,0,2,1,0,0,1,0,0,0,1,2,1,1,2,0,1,0,0,1,0,1,1,2,1,1],tris:4});
  (m.lights||(m.lights=[])).push({id:'gz-light',lv:L,x:25,y:10,type:'downlight',p:{},rot:0});
  (m.ceil||(m.ceil=[])).push({id:'gz-ceiling',lv:L,x:25,y:13,w:2,d:1,h:2.7,kind:'panel'});
  S.save();
 });
 await p.reload();await p.waitForFunction(()=>window.__ws2?.ready());
 await p.click('#addLevel');await p.waitForTimeout(700);await p.click('#vBtn');
 assert.deepEqual(await p.locator('#vMenu [data-view]').allTextContents(),['Plan','Ceiling plan','Perspective']);
 assert.equal(await p.locator('#vMenu small').count(),0);assert.equal(await p.locator('#vMenu [data-level]').count(),0);
 await p.click('#vMenu [data-view="plan"]');assert.equal((await p.locator('#vBtn').innerText()).trim(),'Plan ▾');
 await p.click('#levelBtn');assert.equal(await p.locator('#levelMenu [data-level]').count(),2);
 await p.click('#levelMenu [data-level="L1"]');await p.waitForTimeout(300);assert.equal(await p.evaluate(()=>__ws2.inst.plan.ws.levels().lv),'L1');
 await p.click('#vBtn');await p.click('#vMenu [data-view="ceiling"]');assert.equal((await p.locator('#vBtn').innerText()).trim(),'Ceiling plan ▾');
 await p.click('#vBtn');await p.click('#vMenu [data-view="persp"]');await p.waitForTimeout(700);
 console.log('PASS only three view choices; floors belong to Level; changing floor preserves view');
 for(const key of ['End','Near','Mid','Cen'])await p.evaluate(key=>{const el=document.querySelector(`[data-snap="${key}"]`);if(el.checked)el.click();},key);
 const select=async(k,id)=>{await p.evaluate(([k,id])=>{__ws2.inst.persp.ws.tool({tool:'select'});__wsHub.select('props',{k,id});__ws2.inst.persp.win.document.getElementById('fitSelectedBtn').click();},[k,id]);await p.waitForTimeout(450);return p.evaluate(()=>__ws2.inst.persp.win.S3.gizmo.state());};
 const model=()=>p.evaluate(()=>JSON.parse(JSON.stringify(__ws2.model().studio)));
 const drag=async(ax,amount,finish='up')=>{
  const coords=await p.evaluate(([ax,amount])=>{const frame=document.querySelector('#fPersp'),w=frame.contentWindow,s=w.S3.gizmo.state(),q=w.S3.gizmo.screen(ax);if(!q)throw Error('Missing '+ax+' handle');const z=s.pos[1]-.04,p0=w.S3.plane(...q,z);let target;
   if(ax==='r'){const c=Math.cos(amount),sn=Math.sin(amount),x=p0[0]-s.pos[0],y=p0[1]+s.pos[2];target=[s.pos[0]+x*c-y*sn,-s.pos[2]+x*sn+y*c];}
   else{const rot=s.rot+(ax==='y'?Math.PI/2:0);target=[p0[0]+Math.cos(rot)*amount,p0[1]+Math.sin(rot)*amount];}
   const end=w.S3.toScreen(...target,z),cv=w.document.getElementById('cv').getBoundingClientRect(),fr=frame.getBoundingClientRect(),d=w.devicePixelRatio||1;
   return {a:[fr.left+q[0],fr.top+q[1]],b:[fr.left+cv.left+end[0]/d,fr.top+cv.top+end[1]/d]};},[ax,amount]);
  await p.mouse.move(...coords.a);await p.mouse.down();await p.mouse.move(...coords.b,{steps:12});if(finish==='cancel')await p.keyboard.press('Escape');await p.mouse.up();await p.waitForTimeout(700);
 };
 let state=await select('wall','gz-wall');assert(state?.parts.includes('gz-x')&&state.parts.includes('gz-y')&&state.parts.includes('gz-r'));
 let before=await model();await drag('y',.8);let after=await model();let wall=after.walls.find(w=>w.id==='gz-wall');assert(Math.abs(wall.a[1]-before.walls.find(w=>w.id==='gz-wall').a[1])>.5);
 assert.deepEqual(after.walls.find(w=>w.id==='gz-neighbor').a,wall.b);assert.equal(after.ops.find(o=>o.id==='gz-opening').wall,'gz-wall');
 await p.evaluate(()=>__wsHub.undo());await p.waitForTimeout(650);assert.deepEqual((await model()).walls,before.walls);
 await p.evaluate(()=>__wsHub.redo());await p.waitForTimeout(650);assert.deepEqual((await model()).walls,after.walls);
 console.log('PASS wall move, connected endpoints, hosted openings, shared undo/redo');
 await select('wall','gz-wall');before=await model();await drag('r',Math.PI/4);after=await model();wall=after.walls.find(w=>w.id==='gz-wall');assert(Math.abs(wall.b[1]-wall.a[1])>1);assert(Math.abs(Math.hypot(wall.b[0]-wall.a[0],wall.b[1]-wall.a[1])-4)<.002);
 await select('wall','gz-wall');before=await model();await drag('x',1,'cancel');assert.deepEqual((await model()).walls,before.walls);console.log('PASS wall rotation and Escape cancellation');
 for(const [kind,id,arr,point] of [['floor','gz-floor','floors','points'],['fence','gz-fence','fences','points'],['mass','gz-mass','masses','points']]){
  state=await select(kind,id);assert(state?.handles,kind+' handles');before=await model();await drag('x',.7);after=await model();assert(Math.abs(after[arr].find(o=>o.id===id)[point][0][0]-before[arr].find(o=>o.id===id)[point][0][0])>.4,kind+' moves');
  if(kind==='floor')assert(Math.abs(after.floors.find(o=>o.id===id).holes[0][0][0]-before.floors.find(o=>o.id===id).holes[0][0][0])>.4,'slab holes follow');
 }
 console.log('PASS slab and holes, fence and mass move through their own geometry adapters');
 state=await select('op','gz-opening');assert(state?.parts.includes('gz-x'));assert(!state.parts.includes('gz-y')&&!state.parts.includes('gz-r'));before=await model();await drag('x',.3);after=await model();assert(Math.abs(after.ops.find(o=>o.id==='gz-opening').pos-before.ops.find(o=>o.id==='gz-opening').pos)>.15);assert.equal(after.ops.find(o=>o.id==='gz-opening').wall,'gz-wall');console.log('PASS opening Gumball stays constrained to host wall');
 for(const [kind,id,arr] of [['imp','gz-import','imports'],['light','gz-light','lights'],['ceil','gz-ceiling','ceil']]){
  state=await select(kind,id);assert(state?.handles,kind+' handles');before=await model();await drag('x',.6);after=await model();const A=before[arr].find(o=>o.id===id),B=after[arr].find(o=>o.id===id);assert(Math.abs((B.g?.x??B.x)-(A.g?.x??A.x))>.3,kind+' moves');
 }
 await select('imp','gz-import');before=await model();await drag('r',Math.PI/2);after=await model();const imported=after.imports.find(o=>o.id==='gz-import'),oldImport=before.imports.find(o=>o.id==='gz-import');assert.equal(imported.rot,1);assert.equal(imported.g.w,oldImport.g.d);assert.equal(imported.g.d,oldImport.g.w);assert(Math.abs(imported.g.x+imported.g.w/2-oldImport.g.x-oldImport.g.w/2)<.002);
 console.log('PASS imported meshes, lights and ceiling panels move; imported rotation preserves its center and quarter-turn format');
 await select('wall','gz-wall');await p.click('#vBtn');await p.screenshot({path:'/workspace/artifacts/workbench-view-gumball.png'});await p.click('#vBtn');
 await select('wall','gz-wall');await p.click('[data-sw="gumball"]');assert.equal(await p.evaluate(()=>__ws2.inst.persp.win.S3.gizmo.state()),null);await p.click('[data-sw="gumball"]');assert(await p.evaluate(()=>__ws2.inst.persp.win.S3.gizmo.state()));
 await p.evaluate(()=>{const i=__ws2.inst.persp;i.ws.setLocks(['Walls']);i.ws.select({k:'wall',id:'gz-wall'});});state=await p.evaluate(()=>__ws2.inst.persp.win.S3.gizmo.state());assert(!state?.handles);console.log('PASS Gumball switch and layer locks');
 assert.deepEqual(errors,[]);console.log('PASS no page errors');
 }finally{await b.close();}
})().catch(e=>{console.error(e);process.exitCode=1});
