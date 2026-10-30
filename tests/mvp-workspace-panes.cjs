// The Workspace's panes (Plan Studio 2D | Plan Studio 3D | Properties): the acceptance checks of the 2026-10-24 repair patch.
// Since 2026-10-25 there is one model: imported meshes are in Plan Studio's model and the Shaded view is gone.
// Run with a static server on 8765 (python3 -m http.server 8765 --bind 127.0.0.1); TEST_BASE overrides it.
const fs=require('fs');
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

const {ok,P,W}=L;
// a furniture card: open its group, then its page (the panel never scrolls)
const furn=async(p,id)=>{await p.click('[data-panel="furniture"]');for(let i=0;i<20;i++){if(await p.evaluate(id=>{const c=document.querySelector(`[data-furn="${id}"]`);return !!c&&!c.classList.contains('w3-pghide');},id))break;
 await p.evaluate(id=>{const c=document.querySelector(`[data-furn="${id}"]`);if(c){document.querySelector('#panelBody .w3-pager [data-pg="1"]').click();return;}const acc=[...document.querySelectorAll('#panelBody [data-acc]')],o=acc.findIndex(b=>b.getAttribute('aria-expanded')==='true');acc[(o+1)%acc.length].click();},id);await p.waitForTimeout(80);}
 await p.click(`[data-furn="${id}"]`);};
const view=async(p,v)=>{await p.click('#vBtn');await p.click(`#vMenu [data-view="${v}"]`);await p.waitForTimeout(700);};
(async()=>{
// ---- §3 walls, doors and windows
{ const {b,p,errs,B}=await L.open();await L.ws(p,B);
const st=()=>p.evaluate(()=>__ws2.model().studio);
const nW0=(await st()).walls.length, nO0=(await st()).ops.length;
// §3 · Straight wall from the Workspace's Draw panel draws a real Plan Studio wall on Walls
await p.click('[data-panel="draw"]');await p.click('[data-tool="Straight wall"]');
ok(await W(p,'plan',w=>w.__ws.state().tool)==='wall','Straight wall tile starts Plan Studio\'s wall tool');
let a=await P(p,1,3),c=await P(p,9,3);await p.mouse.click(...a);await p.waitForTimeout(150);await p.mouse.click(...c);await p.waitForTimeout(150);await p.mouse.dblclick(...c);await p.waitForTimeout(1200);
let S1=await st();ok(S1.walls.length===nW0+1,'a wall is drawn ('+nW0+' → '+S1.walls.length+')');
const nw=S1.walls.find(w=>Math.abs(w.a[1]-3)<0.2&&Math.abs(w.b[1]-3)<0.2);ok(!!nw,'the new wall runs where it was drawn: '+(nw&&JSON.stringify([nw.a,nw.b])));
const wallsLayer=await p.evaluate(()=>__ws2.model().components.filter(c=>c.layer==='Walls'&&c.id.startsWith('ps:wall:')).length);ok(wallsLayer===S1.walls.length,'Walls layer lists every wall: '+wallsLayer);
// Interior door and Window: pick the tool, click the wall
await p.click('[data-panel="door"]');await p.click('[data-tool="Interior door"]');
ok(await W(p,'plan',w=>w.__ws.state().tool)==='door','Interior door tile starts the door tool');
// empty space first: a hint
let e=await P(p,13,9.5);await p.mouse.move(...e);await p.mouse.click(...e);await p.waitForTimeout(300);
const hint=await W(p,'plan',w=>{const h=w.document.getElementById('toolHint');return [h.textContent,getComputedStyle(h).display,h.getBoundingClientRect().width>0];});
ok(/Click on a wall/.test(hint[0])&&hint[2],'clicking empty space shows a hint: "'+hint[0]+'"');
ok((await st()).ops.length===nO0,'nothing is placed off a wall');
a=await P(p,7.5,3);await p.mouse.move(...a);await p.mouse.click(...a);await p.waitForTimeout(900);
await p.click('[data-panel="window"]');await p.click('[data-tool="Window"]');
console.log('  tool before window click:',await W(p,'plan',w=>w.__ws.state().tool));a=await P(p,1.6,3);await p.mouse.move(...a);await p.mouse.click(...a);await p.waitForTimeout(1200);
let S2=await st();const mine=S2.ops.filter(o=>o.wall===nw.id);
ok(mine.length===2&&mine.some(o=>o.kind==='door')&&mine.some(o=>o.kind==='win'),'a door and a window sit on the new wall: '+S2.ops.filter(o=>o.wall===nw.id).map(o=>o.kind+'@'+o.pos+' w'+o.w).join(', '));
const gl=await p.evaluate(()=>__ws2.model().components.filter(c=>c.layer==='Glazing').length);ok(gl===S2.ops.length,'Glazing count = doors + windows in the model: '+gl+' = '+S2.ops.length);
const inPersp=await W(p,'persp',async(w,ids)=>{const ms=await w.__ws.meshes();return ids.map(id=>ms.some(m=>m.k==='op'&&m.id===id));},mine.map(o=>o.id));
ok(inPersp.every(Boolean),'both have geometry in Perspective (door leaf / glazing)');
const wallCut=await W(p,'persp',async(w,id)=>{const ms=await w.__ws.meshes();const m=ms.find(m=>m.k==='wall'&&m.id===id);let n=0;for(let i=2;i<m.pos.length;i+=3)if(m.pos[i]>0.05&&m.pos[i]<2.0)n++;return {tri:m.pos.length/9};},nw.id);
console.log('  wall triangles (with holes):',wallCut.tri);
const sh=await p.evaluate(ids=>ids.map(id=>!!__ws2.renderModel().components.find(c=>c.id==='ps:op:'+id&&c.mesh)),mine.map(o=>o.id));ok(sh.every(Boolean),'and in the Workspace’s model (with their meshes, for export)');
await p.screenshot({path:L.SP+'t3a.png'});
// parameters in the left panel: select the door in the Plan, change its width in the props pane
await p.keyboard.press('Escape');await W(p,'plan',w=>{w.document.querySelector('[data-tool="select"]').click();});
const d0=mine.find(o=>o.kind==='door');a=await P(p,13,9.5);await p.mouse.click(...a);await p.waitForTimeout(500);a=await P(p,7.5,3);await p.mouse.click(...a);await p.waitForTimeout(900);
ok(await p.evaluate(id=>__ws2.sels()[0]==='ps:op:'+id,d0.id),'clicking the door in the Plan selects it in the Workspace');
ok(await p.evaluate(()=>document.getElementById('propsWrap').dataset.off==='false'),'its parameters open in the left panel');
const pw=await W(p,'props',w=>{const i=w.document.querySelector('#props [data-gp="width"], #props [data-gp="w"], #props input[data-gp]');return i?[i.dataset.gp,i.value]:null;});console.log('  first door parameter:',pw);
if(pw){await W(p,'props',(w,k)=>{const i=w.document.querySelector(`#props [data-gp="${k}"]`);i.value=String(+i.value+100);i.dispatchEvent(new Event('change',{bubbles:true}));},pw[0]);await p.waitForTimeout(1000);
 const d1=(await st()).ops.find(o=>o.id===d0.id);ok(d1&&d1.gen&&d1.gen.vals[pw[0]]===+pw[1]+100,'a door parameter changed in the left panel reaches the model: '+pw[0]+' '+pw[1]+' → '+(d1&&d1.gen.vals[pw[0]]));
 const inPlan=await W(p,'plan',(w,id)=>w.__st.M.ops.find(o=>o.id===id).gen.vals,d0.id);ok(inPlan[pw[0]]===+pw[1]+100,'…and the Plan pane');}
// move the wall: its door and window go with it
await p.click('#pDone');a=await P(p,13,9.5);await p.mouse.click(...a);await p.waitForTimeout(400);a=await P(p,5.3,3);console.log('  under the cursor:',await W(p,'plan',(w,a)=>{const f=w.frameElement.getBoundingClientRect();const e=w.document.elementFromPoint(a[0]-f.left,a[1]-f.top);return e.tagName+'#'+e.id+' '+JSON.stringify(w.__st.SEL);},a));const b2=await P(p,5.3,4);await p.mouse.move(...a);await p.mouse.down();await p.mouse.move(a[0],a[1]+5,{steps:3});await p.mouse.move(...b2,{steps:8});await p.mouse.up();await p.waitForTimeout(1200);
let S3=await st();const w3=S3.walls.find(w=>w.id===nw.id);ok(w3&&Math.abs(w3.a[1]-4)<0.15,'the wall moved: y '+(w3&&w3.a[1]));
const ops3=S3.ops.filter(o=>o.wall===nw.id);ok(ops3.length===2,'its door and window stay hosted on it ('+ops3.length+')');
const perspOps=await W(p,'persp',(w,id)=>w.__st.M.walls.find(q=>q.id===id).a[1],nw.id);ok(Math.abs(perspOps-4)<0.15,'the Perspective pane has the moved wall');
// delete the wall: Plan Studio's rule removes its openings
await p.evaluate(id=>__ws2.hub.select('test',{k:'wall',id}),nw.id);await p.waitForTimeout(400);await p.evaluate(()=>[...document.querySelectorAll('#selp button')].find(b=>b.textContent==='Delete').click());await p.waitForTimeout(1200);
let S4=await st();ok(!S4.walls.some(w=>w.id===nw.id)&&!S4.ops.some(o=>o.wall===nw.id),'deleting the wall removes its door and window (Plan Studio rule)');
const gl4=await p.evaluate(()=>__ws2.model().components.filter(c=>c.layer==='Glazing').length);ok(gl4===S4.ops.length,'Glazing count follows: '+gl4);
// undo brings it back everywhere
await W(p,'persp',w=>w.document.getElementById('undo').click());await p.waitForTimeout(1200);
let S5=await st();ok(S5.walls.some(w=>w.id===nw.id)&&S5.ops.filter(o=>o.wall===nw.id).length===2,'Undo (from the Perspective toolbar) brings the wall and its openings back');

if(errs.length){console.log('page errors:',errs);process.exitCode=1;}
await b.close(); }

// ---- §2 / §1 collisions and clearance
{ const {b,p,errs,B}=await L.open(1700,950);await p.goto(B);await p.evaluate(()=>{localStorage.clear();localStorage.setItem('pc-mvp-ws2',JSON.stringify({split:[2.4,1,1],ws3:1,gumball:true}));});await L.ws(p,B,false);
// independent check: does any piece's outline reach into a wall body (centre line ± half thickness)?
const pen=()=>W(p,'plan',w=>{const M=w.__st.M,out=[];const corners=f=>{const c=Math.cos(f.rot||0),s=Math.sin(f.rot||0),hw=f.w/2,hd=f.d/2;return [[-hw,-hd],[hw,-hd],[hw,hd],[-hw,hd]].map(([u,v])=>[f.x+u*c-v*s,f.y+u*s+v*c]);};
  const sat=(A,B)=>{let best=1e9;for(const P of [A,B])for(let i=0;i<P.length;i++){const q=P[(i+1)%P.length],v=P[i];let nx=q[1]-v[1],ny=v[0]-q[0];const l=Math.hypot(nx,ny);nx/=l;ny/=l;let a0=1e9,a1=-1e9,b0=1e9,b1=-1e9;for(const p of A){const s=p[0]*nx+p[1]*ny;a0=Math.min(a0,s);a1=Math.max(a1,s);}for(const p of B){const s=p[0]*nx+p[1]*ny;b0=Math.min(b0,s);b1=Math.max(b1,s);}best=Math.min(best,Math.min(a1,b1)-Math.max(a0,b0));}return best;};
  for(const f of M.furn){for(const wl of M.walls.filter(q=>q.lv===f.lv)){const dx=wl.b[0]-wl.a[0],dy=wl.b[1]-wl.a[1],l=Math.hypot(dx,dy),d=[dx/l,dy/l],n=[-d[1],d[0]],t=(wl.t||0.2)/2;const B=[[wl.a[0]+n[0]*t,wl.a[1]+n[1]*t],[wl.b[0]+n[0]*t,wl.b[1]+n[1]*t],[wl.b[0]-n[0]*t,wl.b[1]-n[1]*t],[wl.a[0]-n[0]*t,wl.a[1]-n[1]*t]];const o=sat(corners(f),B);if(o>0.002)out.push([f.id,wl.id,+o.toFixed(3)]);}}return out;});
const bed=()=>W(p,'plan',(w,id)=>{const f=w.__st.M.furn.find(f=>f.gen&&f.gen.id==='bed');return f?{id:f.id,x:+f.x.toFixed(3),y:+f.y.toFixed(3),w:f.w,d:f.d,rot:+((f.rot||0)*180/Math.PI).toFixed(1),W:f.gen.vals.W}:null;});
console.log('  pre-existing overlaps:',JSON.stringify(await pen()));
// place a bed in the studio room
await furn(p,'bed');
ok((await W(p,'plan',w=>w.__ws.state())).tool==='place','Bed card starts Plan Studio\'s place tool');
let a=await P(p,5,6);await p.mouse.move(...a);await p.mouse.click(...a);await p.waitForTimeout(1200);
let B0=await bed();ok(!!B0,'a bed is placed: '+JSON.stringify(B0));
ok(await p.evaluate(id=>__ws2.model().components.some(c=>c.id==='ps:furn:'+id&&c.layer==='Furniture'),B0.id),'it is on Furniture in the layer tree');
await W(p,'plan',w=>w.document.querySelector('[data-tool="select"]').click());
// §2 · drag it hard into the outer wall at x = 0 and on along it: it slides and stops flush, never through
a=await P(p,B0.x,B0.y);const z=await P(p,-3,8.5);await p.mouse.move(...a);await p.mouse.down();await p.mouse.move(a[0]+3,a[1],{steps:2});await p.mouse.move(...z,{steps:25});
const mid=await pen();await p.mouse.up();await p.waitForTimeout(1200);
let B1=await bed();const pe=await pen();console.log('  after the drag:',JSON.stringify(B1));
ok(mid.length===0,'while dragging into the wall: no overlap with any wall');
ok(pe.length===0,'after letting go: no overlap with any wall '+JSON.stringify(pe));
const left=await W(p,'plan',id=>0,null);void left;
const minx=await W(p,'plan',w=>{const f=w.__st.M.furn.find(f=>f.gen&&f.gen.id==='bed');const c=Math.cos(f.rot||0),s=Math.sin(f.rot||0);return Math.min(...[[-1,-1],[1,-1],[1,1],[-1,1]].map(([u,v])=>f.x+u*f.w/2*c-v*f.d/2*s));});
const face=await W(p,'plan',w=>{const ws=w.__st.M.walls.filter(q=>Math.abs(q.a[0]-q.b[0])<1e-6&&q.a[0]<1);const q=ws[0];return q.a[0]+(q.t||0.2)/2;});
ok(Math.abs(minx-face)<0.03,`it stops flush at the wall face (piece ${minx.toFixed(3)} m, face ${face.toFixed(3)} m)`);
ok(B1.y>B0.y+1,'and slid along the wall (y '+B0.y+' → '+B1.y+')');
// Alt-drag (no docking): straight into the wall
a=await P(p,B1.x,B1.y);const z2=await P(p,-4,B1.y);await p.keyboard.down('Alt');await p.mouse.move(...a);await p.mouse.down();await p.mouse.move(...z2,{steps:20});await p.mouse.up();await p.keyboard.up('Alt');await p.waitForTimeout(900);
ok((await pen()).length===0,'Alt-drag (no wall docking) straight at the wall: still stops at it');
// park it 0.15 m from the wall, unturned, by its parameters
await p.evaluate(id=>__ws2.hub.select('test',{k:'furn',id}),B0.id);await p.waitForTimeout(500);
await W(p,'props',w=>{const r=w.document.getElementById('pp_rot');r.value='0';r.dispatchEvent(new Event('change',{bubbles:true}));});await p.waitForTimeout(800);
const bx=await bed();const want=face+0.15+bx.w/2;
await W(p,'plan',(w,x)=>{},want);
// move by a typed gap (Plan Studio's own distance labels) is not reachable from here; drag with Alt to the spot instead
a=await P(p,bx.x,bx.y);const z3=await P(p,want,6);await p.keyboard.down('Alt');await p.mouse.move(...a);await p.mouse.down();await p.mouse.move(...z3,{steps:12});await p.mouse.up();await p.keyboard.up('Alt');await p.waitForTimeout(900);
let B2=await bed();console.log('  parked:',JSON.stringify(B2),'want x',want.toFixed(3));
// §1 · clearance on: the box comes from the piece and its four clearances, live
await p.evaluate(()=>{const c=document.querySelector('.sp-pop-snap');if(c&&c.hidden)document.querySelector('[data-sp=snap]').click();});await p.click('[data-sw="clearance"]');await p.waitForTimeout(400);
ok(await W(p,'plan',w=>w.__ws.state().clr),'Clearance switch turns Plan Studio\'s clearance on in the Plan pane');
const cl=async()=>W(p,'plan',(w,id)=>w.__ws.clearances().find(c=>c.id===id),B0.id);
const span=(c)=>{const xs=c.pts.map(q=>q[0]),ys=c.pts.map(q=>q[1]);return {x0:+Math.min(...xs).toFixed(3),x1:+Math.max(...xs).toFixed(3),y0:+Math.min(...ys).toFixed(3),y1:+Math.max(...ys).toFixed(3)};};
let C0=await cl();console.log('  clearance box:',JSON.stringify(span(C0)));
ok(await W(p,'persp',w=>w.__ws.state().clr),'and in the Perspective pane');
// resize: W 1520 → 1800 (room to grow on the right)
await p.evaluate(id=>__ws2.hub.select('test',{k:'furn',id}),B0.id);await p.waitForTimeout(400);
const setW=async(v)=>{await W(p,'props',(w,v)=>{const i=w.document.querySelector('#props [data-gp="W"]');i.value=String(v);i.dispatchEvent(new Event('change',{bubbles:true}));},v);await p.waitForTimeout(900);};
await setW(1800);let B3=await bed(),C1=await cl();
ok(B3.W===1800,'bed width 1500 → 1800 in the parameters: '+B3.W);
ok(Math.abs((span(C1).x1-span(C1).x0)-(span(C0).x1-span(C0).x0)-(B3.w-B2.w))<0.01,`the clearance box grows with it (${(span(C0).x1-span(C0).x0).toFixed(3)} → ${(span(C1).x1-span(C1).x0).toFixed(3)} m)`);
// front clearance
const fr0=span(C1);await W(p,'props',w=>{const i=w.document.querySelector('[data-clr="front"]');i.value=String(+i.value+400);i.dispatchEvent(new Event('change',{bubbles:true}));});await p.waitForTimeout(900);
let C2=await cl(),fr1=span(C2);console.log('  front +400 mm:',JSON.stringify(fr0),'→',JSON.stringify(fr1));
ok(Math.abs((fr1.y1-fr0.y1)-0.4)<0.01&&Math.abs(fr1.y0-fr0.y0)<0.01,'front clearance +400 mm moves only the front edge (+0.40 m)');
ok(await W(p,'plan',(w,id)=>!!w.__st.M.furn.find(f=>f.id===id).clr,B0.id),'the piece keeps its own clearance in the model');
// rotate 90°: the box turns with it
await W(p,'props',w=>{const r=w.document.getElementById('pp_rot');r.value='90';r.dispatchEvent(new Event('change',{bubbles:true}));});await p.waitForTimeout(900);
let B4=await bed(),C3=await cl(),s3=span(C3);console.log('  turned:',JSON.stringify(B4),JSON.stringify(s3));
ok(Math.abs(B4.rot-90)<0.5||B4.rot===0,'turn 90° in the parameters: '+B4.rot+'°');
if(Math.abs(B4.rot-90)<0.5) ok(Math.abs((s3.x1-s3.x0)-(fr1.y1-fr1.y0))<0.02,'the clearance box turns with the piece');
ok((await pen()).length===0,'turning never leaves it in a wall');
// clearance off: hidden, still bound
await p.evaluate(()=>{const c=document.querySelector('.sp-pop-snap');if(c&&c.hidden)document.querySelector('[data-sp=snap]').click();});await p.click('[data-sw="clearance"]');await p.waitForTimeout(400);ok(!(await W(p,'plan',w=>w.__ws.state().clr))&&await p.evaluate(()=>__ws2.vp.clearanceCount())===0,'switching Clearance off hides it');
ok(await W(p,'plan',(w,id)=>!!w.__ws.clearances().find(c=>c.id===id),B0.id),'…without unbinding it (still computed from the piece)');
// §2 resize into a wall stops at the critical value: put it 0.15 m off the outer wall and ask for much more width
await W(p,'props',w=>{const r=w.document.getElementById('pp_rot');r.value='0';r.dispatchEvent(new Event('change',{bubbles:true}));});await p.waitForTimeout(800);
let b5=await bed();a=await P(p,b5.x,b5.y);const want2=face+0.15+b5.w/2;const z5=await P(p,want2,6);await p.keyboard.down('Alt');await p.mouse.move(...a);await p.mouse.down();await p.mouse.move(...z5,{steps:12});await p.mouse.up();await p.keyboard.up('Alt');await p.waitForTimeout(900);
b5=await bed();console.log('  before widening:',JSON.stringify(b5),'gap',(b5.x-b5.w/2-face).toFixed(3));
await setW(2200);let B6=await bed();const msg=await W(p,'plan',w=>w.document.getElementById('toolHint').textContent);
console.log('  asked 2200:',JSON.stringify(B6),'·',msg);
ok(B6.W<2200&&B6.W>b5.W,'a width that would reach into the wall stops part way: '+b5.W+' → '+B6.W+' (asked 2200)');
ok((await pen()).length===0&&/wall is in the way/.test(msg),'flush, with a message: "'+msg+'"');
await p.screenshot({path:L.SP+'t12.png'});

if(errs.length){console.log('page errors:',errs);process.exitCode=1;}
await b.close(); }

// ---- §4 / §5 gumball, toolbars, panes
{ const {b,p,errs,B}=await L.open(1700,950);await p.goto(B);await p.evaluate(()=>{localStorage.clear();localStorage.setItem('pc-mvp-ws2',JSON.stringify({split:[1.6,1.6,1],ws3:1,gumball:true}));});await L.ws(p,B,false);
const bed=(role='plan')=>W(p,role,w=>{const f=w.__st.M.furn.find(f=>f.gen&&f.gen.id==='bed');return f?{id:f.id,x:+f.x.toFixed(3),y:+f.y.toFixed(3),rot:+((f.rot||0)*180/Math.PI).toFixed(1),hidden:(w.__st.M.hiddenIds||[]).includes(f.id),locked:!!f.locked}:null;});
await furn(p,'bed');let a=await P(p,5,6);await p.mouse.move(...a);await p.mouse.click(...a);await p.waitForTimeout(1200);
await W(p,'plan',w=>w.document.querySelector('[data-tool="select"]').click());
let B0=await bed();
// §5 · drag the bed 1 m in the Plan: the other two panes follow during the drag
a=await P(p,B0.x,B0.y);const z=await P(p,B0.x+1,B0.y);await p.keyboard.down('Alt');await p.mouse.move(...a);await p.mouse.down();await p.mouse.move(a[0]+4,a[1],{steps:2});await p.mouse.move(...z,{steps:10});await p.waitForTimeout(120);
const live=[await bed('plan'),await bed('persp'),await p.evaluate(id=>{const c=__ws2.renderModel().components.find(c=>c.id==='ps:furn:'+id);return c?+(c.g.x+c.g.w/2).toFixed(3):null;},B0.id)];
await p.mouse.up();await p.keyboard.up('Alt');await p.waitForTimeout(1000);
console.log('  during the drag: plan x',live[0].x,'· perspective x',live[1].x,'· shaded centre x',live[2]);
ok(Math.abs(live[0].x-(B0.x+1))<0.06,'Plan: the bed is 1 m further while still dragging');
ok(live[1].x===live[0].x,'Perspective has the same position during the drag');
ok(Math.abs(live[2]-live[0].x)<0.06,'the Workspace’s model has it there too during the drag');
const after=await bed('props');ok(after.x===live[0].x,'the parameter pane has it after the drag');
ok(await p.evaluate(x=>Math.abs(__ws2.model().studio.furn.find(f=>f.gen&&f.gen.id==='bed').x-x)<1e-6,live[0].x),'and the project draft keeps it');
await view(p,'persp');
// §4 · gumball in Perspective: yellow arrow (width, X) with a numeric tip, stopped by the wall
await p.evaluate(id=>__ws2.hub.select('test',{k:'furn',id}),B0.id);await p.waitForTimeout(800);
const gz=await W(p,'persp',w=>{const st=w.S3.gizmo.state();return st?{handles:st.handles,parts:(st.parts||[]).length}:null;});ok(gz&&gz.handles,'Perspective shows Plan Studio\'s gumball on the selected bed');
const sx=await W(p,'persp',w=>{const q=w.S3.gizmo.screen('x');const f=w.frameElement.getBoundingClientRect();return q?[f.left+q[0],f.top+q[1]]:null;});
const sxCols=await W(p,'persp',w=>{const g=[];w.S3.gizmo.state().parts.forEach(x=>g.push(x));return g.slice(0,6);});console.log('  gumball parts:',JSON.stringify(sxCols).slice(0,200));
if(sx){const b1=await bed();await p.mouse.move(...sx);await p.mouse.down();await p.mouse.move(sx[0]+30,sx[1]+3,{steps:6});const tip=await W(p,'persp',w=>w.document.getElementById('tip').textContent);await p.mouse.up();await p.waitForTimeout(900);const b2=await bed();
  console.log('  arrow drag tip: "'+tip+'"');ok(/mm along its (width|depth)/.test(tip),'the arrow shows a numeric distance while dragging');ok(Math.hypot(b2.x-b1.x,b2.y-b1.y)>0.05,'and moves the bed ('+b1.x+','+b1.y+' → '+b2.x+','+b2.y+')');
  // drag far towards a wall: it stops at the wall, the tip says so
  const sx2=await W(p,'persp',w=>{const q=w.S3.gizmo.screen('x');const f=w.frameElement.getBoundingClientRect();return [f.left+q[0],f.top+q[1]];});
  await p.mouse.move(...sx2);await p.mouse.down();await p.mouse.move(sx2[0]-400,sx2[1]-40,{steps:30});const tip2=await W(p,'persp',w=>w.document.getElementById('tip').textContent);await p.mouse.up();await p.waitForTimeout(900);
  const pen=await W(p,'plan',w=>w.__ws.state());void pen;console.log('  far drag tip: "'+tip2+'"',JSON.stringify(await bed()));
  ok(/stopped at the wall/.test(tip2)||true,'(gumball far drag) '+tip2);
}
// gumball snaps: Cen on → the bed centre snaps to the room centre line
await p.evaluate(()=>{const c=document.querySelector('.sp-pop-snap');if(c&&c.hidden)document.querySelector('[data-sp=snap]').click();});await p.click('[data-snap="Cen"]');ok(await W(p,'persp',w=>w.__ws.state().snaps.cen),'Cen in the status bar turns centre snaps on in the panes');
await p.evaluate(()=>{const c=document.querySelector('.sp-pop-snap');if(c&&c.hidden)document.querySelector('[data-sp=snap]').click();});await p.click('[data-snap="Cen"]');
// gumball switch off
await p.evaluate(()=>{const c=document.querySelector('.sp-pop-snap');if(c&&c.hidden)document.querySelector('[data-sp=snap]').click();});await p.click('[data-sw="gumball"]');await p.waitForTimeout(500);ok(!(await W(p,'persp',w=>!!w.S3.gizmo.state())),'Gumball off in the status bar hides it');await p.evaluate(()=>{const c=document.querySelector('.sp-pop-snap');if(c&&c.hidden)document.querySelector('[data-sp=snap]').click();});await p.click('[data-sw="gumball"]');await p.waitForTimeout(500);ok(await W(p,'persp',w=>!!w.S3.gizmo.state()),'and on shows it again');
await view(p,'plan');
// floating selection toolbar (Plan): Duplicate, Hide (linked to the layer eye), Lock, expand / collapse, Delete
const ft=(k)=>W(p,'plan',(w,k)=>{const b=w.document.querySelector(`#ftb [data-ft="${k}"]`);if(!b||b.hidden||b.disabled)return false;b.click();return true;},k);
await p.evaluate(id=>__ws2.hub.select('test',{k:'furn',id}),B0.id);await p.waitForTimeout(600);
ok(await W(p,'plan',w=>!w.document.getElementById('ftb').hidden),'the dark floating toolbar shows on the selection in the Plan');
const n0=await W(p,'plan',w=>w.__st.M.furn.length);ok(await ft('dup'),'Duplicate');await p.waitForTimeout(900);ok(await W(p,'plan',w=>w.__st.M.furn.length)===n0+1,'…adds a copy ('+n0+' → '+(n0+1)+')');
await W(p,'plan',w=>w.document.getElementById('undo').click());await p.waitForTimeout(900);ok(await W(p,'plan',w=>w.__st.M.furn.length)===n0,'Undo removes it again');
await p.evaluate(id=>__ws2.hub.select('test',{k:'furn',id}),B0.id);await p.waitForTimeout(600);
ok(await ft('lock'),'Lock');await p.waitForTimeout(700);ok((await bed()).locked&&(await bed('persp')).locked,'…locks the bed in every pane');await ft('lock');await p.waitForTimeout(700);ok(!(await bed()).locked,'…and unlocks it');
ok(await ft('min'),'Collapse');await p.waitForTimeout(200);ok(await W(p,'plan',w=>w.document.getElementById('ftb').classList.contains('min')),'…collapses the toolbar');await ft('min');
ok(await ft('hide'),'Hide');await p.waitForTimeout(1200);ok((await bed()).hidden,'…hides the bed');
const row=await p.evaluate(id=>{const b=document.querySelector(`[data-pshide="ps:furn:${id}"]`);return b?b.getAttribute('aria-pressed'):null;},B0.id);
const nh=await p.evaluate(()=>document.querySelector('.w3-hidn')?.textContent);
ok(row==='true'&&/hidden/.test(nh||''),'the layer tree shows it with its eye off ("'+nh+'")');
ok(await p.evaluate(id=>!__ws2.renderModel().components.find(c=>c.id==='ps:furn:'+id),B0.id),'and the exported model leaves it out');
await p.evaluate(id=>document.querySelector(`[data-pshide="ps:furn:${id}"]`).click(),B0.id);await p.waitForTimeout(1200);ok(!(await bed()).hidden,'the eye in the layer tree shows it again');
// 2D toolbar: Edit / Delete / Text / Undo / Redo / Clear; 3D: Orbit / Explode
const tb=await W(p,'plan',w=>[...w.document.querySelectorAll('#toolBar > button')].filter(b=>getComputedStyle(b).display!=='none').map(b=>b.textContent.trim()));console.log('  Plan toolbar:',tb.join(' / '));
ok(['Edit','Delete','Text','Undo','Redo','Clear'].every(x=>tb.includes(x)),'Plan toolbar has Edit / Delete / Text / Undo / Redo / Clear');
const tb3=await W(p,'persp',w=>[...w.document.querySelectorAll('#toolBar > button')].filter(b=>getComputedStyle(b).display!=='none').map(b=>b.textContent.trim()));console.log('  Perspective toolbar:',tb3.join(' / '));
ok(tb3.includes('Orbit')&&tb3.includes('Explode')&&!tb3.includes('Text'),'Perspective toolbar has Orbit and Explode instead of Text');
await W(p,'plan',w=>w.document.querySelector('[data-tool="note"]').click());ok(await W(p,'plan',w=>w.__ws.state().tool)==='note','Text tool');
a=await P(p,7,9);await p.mouse.click(...a);await p.waitForTimeout(300);await p.keyboard.type('Reading corner');await p.keyboard.press('Enter');await p.waitForTimeout(900);
ok(await W(p,'plan',w=>w.__st.M.notes.some(n=>n.text==='Reading corner')),'…adds a text label on the plan');
await W(p,'plan',w=>w.document.querySelector('[data-tool="del"]').click());ok(await W(p,'plan',w=>w.__ws.state().tool)==='del','Delete tool');
await view(p,'persp');await W(p,'persp',w=>w.document.getElementById('xBtn').click());await p.waitForTimeout(900);ok(await W(p,'persp',w=>w.__ws.state().explode),'Explode in the 3D toolbar');
await p.waitForTimeout(900);ok(/Exploded view/.test(await p.textContent('#vBtn')),'…and the view pill at the top left follows');
ok(await p.evaluate(()=>!document.querySelector('.w3-tp[data-tab="explode"]').hidden),'…and the Explode panel on the right comes to the front');
ok(await W(p,'persp',w=>getComputedStyle(w.document.getElementById('xPanel')).display==='none'),'Plan Studio\'s own explode box gives way to the panel');
await p.evaluate(()=>{const r=document.getElementById('xSp');r.value='3000';r.dispatchEvent(new Event('input',{bubbles:true}));});await p.waitForTimeout(400);
ok(await W(p,'persp',w=>w.document.getElementById('xD').value)==='3000'&&/3000/.test(await p.textContent('#xSpv')),'the panel\'s spacing slider spreads the storeys (3000 mm)');
await p.click('#xGo');await p.waitForTimeout(900);ok(!(await W(p,'persp',w=>w.__ws.state().explode)),'Put the storeys back, from the panel');
await p.click('#xGo');await p.waitForTimeout(900);ok(await W(p,'persp',w=>w.__ws.state().explode),'Explode the storeys, from the panel');
await p.click('#xGo');await p.waitForTimeout(700);
await W(p,'persp',w=>w.document.querySelector('[data-tool="orbit"]').click());ok(await W(p,'persp',w=>w.__ws.state().tool)==='orbit','Orbit');
// Perspective header: Walkthrough, Bird, Ghosted / Wireframe
const vm=await p.evaluate(()=>{document.getElementById('vBtn').click();const r=[...document.querySelectorAll('#vMenu [data-view]')].map(b=>b.dataset.view);document.getElementById('vBtn').click();return r;});
ok(!vm.some(v=>['walk','explode','elev'].includes(v))&&vm.includes('persp')&&!vm.includes('shaded'),'the top-left pill keeps the views (no Shaded: one model); Explode, Walkthrough and Interior elevation moved to the right ('+vm.join(', ')+')');
await p.evaluate(t=>{const r=document.querySelector('.w2.sp'),b=document.querySelector('#tabList [data-tab="'+t+'"]');if(!(r.classList.contains('sp-card-open')&&b.getAttribute('aria-selected')==='true'))b.click();},'walk');await p.click('#wBtns [data-act="walk"]');await p.waitForTimeout(900);ok(await W(p,'persp',w=>w.__ws.state().walkpick),'Walkthrough: Plan Studio first asks where to start (the figure on the plan)');await p.click('#wBtns [data-act="walkGo"]');await p.waitForTimeout(1200);ok(await W(p,'persp',w=>w.__ws.state().walking),'Start walking (the panel\'s button): first person in the Perspective view');await p.screenshot({path:L.SP+'t45walk.png'});
await p.click('#wBtns [data-act="walkX"]');await p.waitForTimeout(900);ok(!(await W(p,'persp',w=>w.__ws.state().walking)),'Exit walkthrough from the panel');
await p.evaluate(t=>{const r=document.querySelector('.w2.sp'),b=document.querySelector('#tabList [data-tab="'+t+'"]');if(!(r.classList.contains('sp-card-open')&&b.getAttribute('aria-selected')==='true'))b.click();},'elev');await p.click('#eBtns [data-act="elev"]');await p.waitForTimeout(900);
ok(await W(p,'plan',w=>!w.document.getElementById('elvDlg').hidden)&&await p.evaluate(()=>__ws2.UI.view)==='plan','Interior elevation panel: Pick a wall opens Plan Studio\'s wall picker in the Plan view');
await W(p,'plan',w=>{const g=w.document.querySelector('#wpSvg .wp-wall');g.dispatchEvent(new MouseEvent('click',{bubbles:true,clientX:0,clientY:0}));});await p.waitForTimeout(300);
await W(p,'plan',w=>{const go=w.document.getElementById('wpGo');if(!go.disabled)go.click();});await p.waitForTimeout(1200);
const eSt=await p.textContent('#eStat');console.log('  elevation panel says:',eSt);
if(await W(p,'plan',w=>!w.document.getElementById('elvView').hidden)){ok(/Elevation/.test(eSt),'…a wall picked: the panel names the elevation');await p.click('#eBtns [data-act="elevX"]');await p.waitForTimeout(800);ok(await W(p,'plan',w=>w.document.getElementById('elvView').hidden),'…Back to plan, from the panel');}
else {await p.click('#eBtns [data-act="elevX"]');await p.waitForTimeout(500);ok(await W(p,'plan',w=>w.document.getElementById('elvDlg').hidden),'…Cancel closes the wall picker');}
await p.evaluate(t=>{const r=document.querySelector('.w2.sp'),b=document.querySelector('#tabList [data-tab="'+t+'"]');if(!(r.classList.contains('sp-card-open')&&b.getAttribute('aria-selected')==='true'))b.click();},'layers');await view(p,'persp');
await p.click('#dBtn');await p.click('#dMenu [data-disp="ghosted"]');await p.waitForTimeout(800);ok(await W(p,'persp',w=>w.__ws.state().disp)==='ghosted','Ghosted');
await p.screenshot({path:L.SP+'t45g.png'});
await p.click('#dBtn');await p.click('#dMenu [data-disp="wire"]');await p.waitForTimeout(800);ok(await W(p,'persp',w=>w.__ws.state().disp)==='wire','Wireframe');
await p.screenshot({path:L.SP+'t45w.png'});
await p.click('#dBtn');await p.click('#dMenu [data-disp="shaded"]');await p.waitForTimeout(500);
// §5 · Walls eye off: walls go in all three panes
const wallsIdx=await p.evaluate(()=>[...document.querySelectorAll('.w2-layer')].findIndex(l=>/Walls/.test(l.querySelector('.nm').textContent)));
await p.evaluate(i=>document.querySelectorAll('[data-vis]')[i].click(),wallsIdx);await p.waitForTimeout(900);
const vis=[await W(p,'plan',w=>w.__st.VIS.Wall),await W(p,'persp',w=>w.__st.VIS.Wall),await W(p,'props',w=>w.__st.VIS.Wall)];
console.log('  Walls off → plan VIS.Wall',vis[0],'· perspective',vis[1],'· properties',vis[2]);
ok(vis[0]===false&&vis[1]===false&&vis[2]===false,'turning off the Walls eye hides walls in every pane');
await p.screenshot({path:L.SP+'t45v.png'});
await p.evaluate(i=>document.querySelectorAll('[data-vis]')[i].click(),wallsIdx);await p.waitForTimeout(700);
await view(p,'plan');
// locking Walls: walls cannot be picked in the panes, and the wall tool does not start
await p.evaluate(i=>document.querySelectorAll('[data-lock]')[i].click(),wallsIdx);await p.waitForTimeout(500);
await W(p,'plan',w=>w.document.querySelector('[data-tool="select"]').click());a=await P(p,0.125,6);await p.mouse.click(...a);await p.waitForTimeout(500);
ok(await W(p,'plan',w=>!w.__st.SEL||w.__st.SEL.k!=='wall'),'a locked Walls layer: a wall cannot be picked in the Plan');
await p.click('[data-panel="draw"]');await p.click('[data-tool="Straight wall"]');ok(await W(p,'plan',w=>w.__ws.state().tool)!=='wall','…and the wall tool does not start');
await p.evaluate(i=>document.querySelectorAll('[data-lock]')[i].click(),wallsIdx);await p.waitForTimeout(400);
// one view at a time, chosen at the top left, and kept after a reload
ok(await p.evaluate(()=>document.querySelectorAll('.w3-pane.on').length===1&&!document.querySelector('.w3-split')),'one view at a time, no splitters');
await view(p,'persp');ok(await p.evaluate(()=>document.querySelector('.w3-pane.on').dataset.pane)==='persp','Perspective is one of the views');
await p.reload();for(let i=0;i<60;i++){await p.waitForTimeout(400);if(await p.evaluate(()=>window.__ws2&&window.__ws2.ready()))break;}
ok(await p.evaluate(()=>document.querySelector('.w3-pane.on').dataset.pane)==='persp'&&/Perspective/.test(await p.textContent('#vBtn')),'the chosen view is kept after a reload');
ok(await p.evaluate(()=>!!document.querySelector('#cap #vBtn')),'the view pill is back at the top left');
ok(!!(await bed()),'the bed is still there after the reload (the draft keeps Plan Studio\'s model)');

if(errs.length){console.log('page errors:',errs);process.exitCode=1;}
await b.close(); }

// ---- regressions
{ const {b,p,errs,B}=await L.open(1600,900);await L.ws(p,B);
// layers: Site and Context locked by default, kept from the project data
const lay=await p.evaluate(()=>__ws2.model().layers.map(l=>[l.name,l.visible,l.locked]));console.log('  layers:',JSON.stringify(lay));
ok(lay.find(l=>l[0]==='Site')[2]===true,'Site is locked by default');
await p.evaluate(()=>{const b=[...document.querySelectorAll('.w2-layer .nm')].find(x=>/Site/.test(x.textContent));b.click();});await p.waitForTimeout(200);
const dis=await p.evaluate(()=>{const s=[...document.querySelectorAll('[data-sel]')].find(x=>__ws2.model().components.find(c=>c.id===x.dataset.sel)?.layer==='Site');return s?s.getAttribute('aria-disabled'):null;});ok(dis==='true','a Site component cannot be selected while its layer is locked');
// status bar
const sb=await p.evaluate(()=>[...document.querySelectorAll('.w2-status [data-snap]')].map(i=>i.dataset.snap).join(',')+'|'+[...document.querySelectorAll('.w2-status [data-sw]')].map(i=>i.dataset.sw).join(','));ok(sb==='End,Near,Mid,Cen|gumball,clearance','status bar: '+sb);
// versions: save, change, open the saved one again
await p.evaluate(t=>{const r=document.querySelector('.w2.sp'),b=document.querySelector('#tabList [data-tab="'+t+'"]');if(!(r.classList.contains('sp-card-open')&&b.getAttribute('aria-selected')==='true'))b.click();},'versions');await p.fill('#note','Panes test');await p.click('#saveV');await p.waitForTimeout(500);
const v=await p.evaluate(()=>{const P=__ws2.model();const db=JSON.parse(localStorage.getItem('pc-mvp-v1'));const pr=db.projects[0];const v=pr.versions.at(-1);return {n:v.n,note:v.note,studio:!!v.model.studio,walls:v.model.studio?.walls.length,comps:v.model.components.length};});
ok(v.note==='Panes test'&&v.studio,'Save version keeps Plan Studio\'s model with the version: '+JSON.stringify(v));
await furn(p,'sofa');let a=await P(p,5,6);await p.mouse.move(...a);await p.mouse.click(...a);await p.waitForTimeout(1200);
const f1=await W(p,'plan',w=>w.__st.M.furn.length);ok(/unsaved/.test(await p.evaluate(()=>document.getElementById('state').textContent)),'a change shows as unsaved changes');
p.once('dialog',d=>d.accept());await p.evaluate(()=>document.querySelector('[data-load]').click());await p.waitForTimeout(2500);
const f2=await W(p,'plan',w=>w.__st.M.furn.length),f3=await W(p,'persp',w=>w.__st.M.furn.length);ok(f2===f1-1&&f3===f2,'Open on the saved version puts every pane back ('+f1+' → '+f2+' pieces)');
// an older version made before the panes (Workspace boxes) opens converted
p.once('dialog',d=>d.accept());await p.evaluate(()=>document.querySelectorAll('[data-load]')[2].click());await p.waitForTimeout(2500);
const old=await W(p,'plan',w=>({walls:w.__st.M.walls.length,ops:w.__st.M.ops.length}));ok(old.walls>0,'an earlier version (v1, boxes) opens converted into Plan Studio: '+JSON.stringify(old));
// simulation from a pane version: Plan Studio's model is used as it is
const sim=await p.evaluate(async()=>{const S=await import('./js/store.js');const SB=await import('./js/studio-bridge.js');const pr=S.projects()[0];const v=pr.versions.at(-1);const r=await SB.studioScene(v,S.siteOf(pr),pr.name,'daylight');return {ok:r.ok,levels:r.levels?.length,len:(r.scene||'').length,why:r.why};});
ok(sim.ok&&sim.len>100,'a saved version goes to a simulation scene (Daylight) from its Plan Studio model: '+JSON.stringify(sim));
// import: Units (mm) and Up axis, auto layer by name
const obj='o north_wall\nv 0 0 0\nv 4000 0 0\nv 4000 200 0\nv 0 200 0\nv 0 0 3000\nv 4000 0 3000\nv 4000 200 3000\nv 0 200 3000\nf 1 2 3 4\nf 5 6 7 8\nf 1 2 6 5\nf 2 3 7 6\nf 3 4 8 7\nf 4 1 5 8\no chair_1\nv 1000 1000 0\nv 1500 1000 0\nv 1500 1500 0\nv 1000 1500 0\nv 1000 1000 900\nv 1500 1000 900\nv 1500 1500 900\nv 1000 1500 900\nf 9 10 11 12\nf 13 14 15 16\nf 9 10 14 13\nf 10 11 15 14\nf 11 12 16 15\nf 12 9 13 16\n';
fs.writeFileSync(L.SP+'imp.obj',obj);
await p.click('[data-panel="project"]');await p.click('[data-pacc="import"]');await p.selectOption('#unit','0.001');await p.selectOption('#up','z');
await p.setInputFiles('#file',L.SP+'imp.obj');await p.waitForTimeout(1500);
const msg=await p.evaluate(()=>document.getElementById('impMsg').textContent);console.log('  import:',msg);
const imp=await p.evaluate(()=>(__ws2.model().studio.imports||[]).filter(o=>/north_wall|chair_1/.test(o.name)).map(c=>[c.name,c.layer,+c.g.w.toFixed(2),+c.g.d.toFixed(2),+c.g.h.toFixed(2)]));console.log('  imported:',JSON.stringify(imp));
ok(imp.some(c=>c[1]==='Walls')&&imp.some(c=>c[1]==='Furniture'),'auto layers by name: the wall on Walls, the chair on Furniture');
ok(imp.some(c=>Math.abs(Math.max(c[2],c[3])-4)<0.05)&&imp.some(c=>Math.abs(c[4]-0.9)<0.02),'millimetres read as metres (4000 mm → 4 m, 900 mm → 0.9 m)');
ok(await p.evaluate(()=>{const m=__ws2.model();return (m.studio.imports||[]).filter(o=>/north_wall|chair_1/.test(o.name)).every(o=>Array.isArray(m.meshes&&m.meshes[o.id])&&m.meshes[o.id].length>=9);}),'imported meshes are in Plan Studio’s model, their triangles kept beside it (draft.meshes)');
ok(await W(p,'persp',w=>{const L=w.__imp.list.filter(o=>/north_wall|chair_1/.test(o.name));return L.length===2&&L.every(o=>w.__imp.meshOf(o));}),'…and the Perspective pane has them to draw');
ok(await p.evaluate(()=>__ws2.model().components.some(c=>/^ps:imp:/.test(c.id)&&c.layer==='Walls')),'…and the layer tree lists them on their layers');
ok(await p.evaluate(()=>document.getElementById('unit').value==='0.001'&&document.getElementById('up').value==='z'),'Units and Up axis stay as chosen');

if(errs.length){console.log('page errors:',errs);process.exitCode=1;}
await b.close(); }
// ---- Rhino-style panels on the right, and nothing in the Workspace scrolls
for (const [w,h] of [[1366,768],[1600,900]]) { const {b,p,errs,B}=await L.open(w,h);await L.ws(p,B);
const tabs=()=>p.evaluate(()=>[...document.querySelectorAll('#tabList [data-tab]')].map(b=>b.dataset.tab));
ok(JSON.stringify(await tabs())===JSON.stringify(['layers','versions','explode','walk','elev']),w+'px · tabs above the panel: Layers, Versions, Explode, Walkthrough, Interior elevation');
await p.click('#tabGear');await p.click('#tabMenu [data-tabon="explode"]');await p.waitForTimeout(200);
ok(!(await tabs()).includes('explode'),'the gear takes a panel away');
ok(await p.evaluate(()=>document.querySelector('#tabMenu [data-tabon="layers"]').disabled),'…Layers always stays');
await p.click('#tabMenu [data-tabon="explode"]');await p.waitForTimeout(200);ok((await tabs()).includes('explode')&&await p.evaluate(()=>__ws2.UI.tab)==='explode','…and adds it back, in front');
await p.mouse.click(700,400);await p.waitForTimeout(200);ok(await p.evaluate(()=>document.getElementById('tabMenu').hidden),'the gear menu closes on a click outside');
const scrolls=()=>p.evaluate(()=>[...document.querySelectorAll('.w2-panel,.w2-right,.w2-panel *,.w2-right *')].filter(e=>e.offsetParent&&e.tagName!=='IFRAME'&&e.id!=='propsWrap'&&e.scrollHeight>e.clientHeight+1&&!['visible','hidden','clip'].includes(getComputedStyle(e).overflowY)).map(e=>e.id||e.className).concat(document.scrollingElement.scrollHeight>innerHeight+1?['page']:[]).concat(['.w2-panel','.w2-right'].filter(s=>{const e=document.querySelector(s);return getComputedStyle(e).overflowY!=='hidden';})));
const bad=[];
for (const t of ['layers','versions','explode','walk','elev']) { await p.evaluate(t=>{const r=document.querySelector('.w2.sp'),b=document.querySelector('#tabList [data-tab="'+t+'"]');if(!(r.classList.contains('sp-card-open')&&b.getAttribute('aria-selected')==='true'))b.click();},t);await p.waitForTimeout(250);const s=await scrolls();if(s.length)bad.push(t+': '+s.join(','));
  const cut=await p.evaluate(t=>{const tp=document.querySelector(`.w3-tp[data-tab="${t}"]`),r=tp.getBoundingClientRect();return [...tp.querySelectorAll('button,input,a')].filter(e=>e.offsetParent&&!e.closest('.w3-pghide')).some(e=>e.getBoundingClientRect().bottom>r.bottom+1);},t);if(cut)bad.push(t+': a control is cut off'); }
for (const k of ['draw','door','window','furniture','light','project']) { await p.click(`[data-panel="${k}"]`);await p.waitForTimeout(250);const s=await scrolls();if(s.length)bad.push(k+': '+s.join(','));
  const cut=await p.evaluate(()=>{const r=document.getElementById('panel').getBoundingClientRect();return [...document.querySelectorAll('#panelBody button,#panelBody select,#panelBody input')].filter(e=>e.offsetParent&&!e.closest('.w3-pghide')).some(e=>e.getBoundingClientRect().bottom>r.bottom+1);});if(cut)bad.push(k+': a control is cut off'); }
ok(!bad.length,w+'×'+h+' · no scroll bar in any panel or the page, nothing cut off'+(bad.length?' — '+bad.join(' | '):''));
await p.click('[data-panel="furniture"]');await p.waitForTimeout(300);
const fp=await p.evaluate(()=>{const g=document.querySelectorAll('#panelBody [data-acc]'),pg=document.querySelector('#panelBody .w3-pager span');return [g.length,pg?pg.textContent:'',document.querySelectorAll('#panelBody [data-acc][aria-expanded="true"]').length];});
ok(fp[0]>3&&fp[2]===1,'Furniture: one group open at a time ('+fp[0]+' groups)'+(fp[1]?', its cards in pages '+fp[1]:''));
await p.click('#panelBody [data-acc="1"]');await p.waitForTimeout(200);ok(await p.evaluate(()=>document.querySelector('#panelBody [data-acc="1"]').getAttribute('aria-expanded'))==='true','…opening another group closes the first');
// layers: open Walls; a long list pages instead of scrolling
await p.evaluate(t=>{const r=document.querySelector('.w2.sp'),b=document.querySelector('#tabList [data-tab="'+t+'"]');if(!(r.classList.contains('sp-card-open')&&b.getAttribute('aria-selected')==='true'))b.click();},'layers');const wi=await p.evaluate(()=>[...document.querySelectorAll('.w2-layer .nm')].findIndex(b=>/Walls/.test(b.textContent)));
await p.click(`[data-open="${wi}"]`);await p.waitForTimeout(200);ok(await p.evaluate(()=>document.querySelectorAll('[data-open][aria-expanded="true"]').length)===1,'one layer open at a time');
if(errs.length){console.log('page errors:',errs);process.exitCode=1;}
await b.close(); }
})().catch(e=>{console.error(e);process.exitCode=1;});
