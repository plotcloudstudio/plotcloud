// Run against a local static server; TEST_BASE and CHROMIUM_PATH can override defaults.
const path=require('node:path'), fs=require('node:fs'),crypto=require('node:crypto'),{execFileSync}=require('node:child_process');
const root=path.resolve(__dirname,'..');
const {chromium}=require('playwright');const assert=require('node:assert/strict');
(async()=>{const b=await chromium.launch({...(process.env.CHROMIUM_PATH || fs.existsSync('/usr/bin/chromium') ? {executablePath:process.env.CHROMIUM_PATH || '/usr/bin/chromium'} : {}),args:['--no-sandbox','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});const p=await b.newPage({viewport:{width:1600,height:900}}),errors=[];p.on('pageerror',e=>errors.push(e.message));
await p.route('https://cdn.jsdelivr.net/**',r=>{const url=r.request().url(),file='/tmp/pc-cdn-'+crypto.createHash('sha256').update(url).digest('hex')+'.js';if(!fs.existsSync(file))execFileSync('curl',['--fail','--silent','--show-error',url,'-o',file],{timeout:30000});return r.fulfill({path:file,contentType:'text/javascript'});});
await p.goto((process.env.TEST_BASE||'http://127.0.0.1:8765')+'/mvp/#/workspace');await p.waitForFunction(()=>window.__ws2?.ready());
await p.click('#vBtn');await p.click('[data-view="persp"]');await p.waitForTimeout(800);
await p.click('[data-panel="draw"]');await p.click('[data-tool="Straight wall"]');
assert.equal(await p.evaluate(()=>document.querySelector('[data-pane="persp"]').classList.contains('on')),true);
assert.equal(await p.evaluate(()=>document.querySelector('#fPersp').contentWindow.__ws.state().tool),'wall');console.log('PASS wall tool stays in Perspective');
const screen=async(x,y)=>p.evaluate(([x,y])=>{const f=document.querySelector('#fPersp'),w=f.contentWindow,r=f.getBoundingClientRect(),c=w.document.querySelector('#cv').getBoundingClientRect(),q=w.__st.toPx([x,y]);return [r.left+c.left+q[0],r.top+c.top+q[1]]},[x,y]);
let before=await p.evaluate(()=>__ws2.model().studio.walls.length);let a=await screen(2,2),z=await screen(5,2);await p.mouse.click(...a);await p.mouse.click(...z);await p.keyboard.press('Escape');await p.waitForTimeout(900);assert.equal(await p.evaluate(()=>__ws2.model().studio.walls.length),before+1);console.log('PASS wall drawn in 3D updates shared model');
await p.click('[data-panel="furniture"]');await p.evaluate(()=>{const a=[...document.querySelectorAll('#panelBody [data-acc]')].find(b=>/Living/.test(b.textContent));a?.click();});await p.evaluate(()=>document.querySelector('[data-furn="sofa"]').click());assert.equal(await p.evaluate(()=>document.querySelector('#fPersp').contentWindow.__ws.state().tool),'place');before=await p.evaluate(()=>__ws2.model().studio.furn.length);a=await screen(5,5);await p.mouse.click(...a);await p.waitForTimeout(900);assert.equal(await p.evaluate(()=>__ws2.model().studio.furn.length),before+1);console.log('PASS furniture placed in Perspective');
await p.click('#vBtn');await p.click('[data-view="plan"]');assert.equal(await p.evaluate(()=>document.querySelector('#fPlan').contentWindow.__ws.state().tool),'place');console.log('PASS switching view retains tool');await p.click('#vBtn');await p.click('[data-view="persp"]');await p.waitForTimeout(400);
await p.click('[data-panel="furniture"]');await p.evaluate(()=>[...document.querySelectorAll('#panelBody [data-acc]')].find(b=>/Living/.test(b.textContent))?.click());before=await p.evaluate(()=>__ws2.model().studio.furn.length);const card=await p.locator('[data-furn="sofa"]').boundingBox();a=await screen(8,5);await p.mouse.move(card.x+card.width/2,card.y+card.height/2);await p.mouse.down();await p.mouse.move(...a,{steps:12});await p.mouse.up();await p.waitForTimeout(1000);assert.equal(await p.evaluate(()=>__ws2.model().studio.furn.length),before+1);console.log('PASS dragging furniture card into Perspective');

const started=await p.evaluate(()=>{const w=document.querySelector('#fPersp').contentWindow;return [{tool:'room'},{tool:'arc'},{tool:'floor'},{tool:'void'},{tool:'door',opm:'int'},{tool:'win',opm:'win'},{stair:'straight'},{furn:'fence'},{furn:'balcony_rail'},{light:document.querySelector('#fPersp').contentWindow.__ws.lights()[0][0]}].map(spec=>({spec,ok:w.__ws.tool(spec),cam:w.__ws.state().cam}));});
console.log('tool coverage',started);assert(started.every(t=>t.cam==='3d'));assert(started.every(t=>t.ok));

await p.evaluate(()=>{const w=document.querySelector('#fPersp').contentWindow;w.__ws.tool({tool:'select'});});
await p.click('#vBtn');await p.click('[data-view="plan"]');await p.waitForTimeout(400);
const frame=await p.locator('#fPlan').boundingBox();await p.mouse.move(frame.x+frame.width-25,frame.y+100);await p.mouse.down();await p.mouse.move(frame.x+25,frame.y+frame.height-70,{steps:15});await p.mouse.up();await p.waitForTimeout(500);console.log('box selection',await p.evaluate(()=>__ws2.sels()));assert((await p.evaluate(()=>__ws2.sels())).length>1);

for(const family of ['fence','balcony_rail']) {
  before=await p.evaluate(()=>__ws2.model().studio.furn.length);
  await p.evaluate(family=>{const w=document.querySelector('#fPlan').contentWindow,cv=w.document.querySelector('#cv'),r=cv.getBoundingClientRect();w.__ws.tool({furn:family});for(const pt of [[18,18],[22,18]]){const q=w.__st.toPx(pt);cv.dispatchEvent(new w.PointerEvent('pointerdown',{clientX:r.left+q[0],clientY:r.top+q[1],button:0,bubbles:true}));}w.document.body.dispatchEvent(new w.KeyboardEvent('keydown',{key:'Enter',bubbles:true}));},family);
  await p.waitForTimeout(500);
  const result=await p.evaluate(()=>({n:__ws2.model().studio.furn.length,gen:__ws2.model().studio.furn.at(-1).gen}));assert.equal(result.n,before+1);assert.equal(result.gen.id,family);assert.equal(result.gen.vals.L,4000);
}
console.log('PASS both fence families generate along a four-metre path');
await p.click('#editSite');assert.equal(await p.evaluate(()=>__ws2.model().layers.find(l=>l.name==='Site').locked),false);await p.click('#editSite');assert.equal(await p.evaluate(()=>__ws2.model().layers.find(l=>l.name==='Site').locked),true);console.log('PASS site editing enters and exits with lock restored');
const levelCount=await p.evaluate(()=>__ws2.model().studio.levels.length);
assert(await p.evaluate(()=>document.querySelector('#addLevel').getBoundingClientRect().right<=document.querySelector('#vBtn').getBoundingClientRect().left));
await p.click('#addLevel');await p.waitForTimeout(900);assert.equal(await p.evaluate(()=>__ws2.model().studio.levels.length),levelCount+1);
assert.equal(await p.evaluate(()=>document.querySelector('#fPlan').contentWindow.__ws.levels().lv),await p.evaluate(()=>document.querySelector('#fPersp').contentWindow.__ws.levels().lv));
await p.click('#vBtn');await p.click('[data-view="persp"]');await p.waitForTimeout(400);await p.click('#addLevel');await p.waitForTimeout(900);assert.equal(await p.evaluate(()=>__ws2.model().studio.levels.length),levelCount+2);assert(await p.evaluate(()=>document.querySelector('[data-pane="persp"]').classList.contains('on')));console.log('PASS add level in both views, with synchronized level selection');
await p.click('#sendSim');await p.waitForURL('**/#/simulations/sunhours*');await p.locator('#eng[data-pc-visible-ready=true]').waitFor({timeout:60000});console.log('PASS current Workspace model sent directly to Simulation');
console.log('errors',errors);assert.deepEqual(errors,[]);await b.close();})().catch(e=>{console.error(e);process.exit(1)});
