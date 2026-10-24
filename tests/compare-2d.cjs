const assert=require('node:assert/strict'),{chromium}=require('playwright');
const base=process.env.TEST_BASE||'http://127.0.0.1:8765';
const near=(a,b,t=.02)=>Math.abs(a-b)<=t;
(async()=>{
  const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||undefined,headless:true,args:['--no-sandbox','--enable-unsafe-swiftshader']});
  const errors=[],page=await browser.newPage({viewport:{width:1400,height:900}}); page.on('pageerror',e=>errors.push(e.message));
  try{
    await page.goto(base+'/tests/fixtures/engine-host.html'); const work=await (await page.locator('iframe[data-emb="modeler"]').elementHandle()).contentFrame(); await work.waitForFunction(()=>window.__wb&&window.__wb.cmp,{},{timeout:60000});
    await work.evaluate(()=>window.__wbTour?.close());
    const model={v:2,id:'compare-2d-test',name:'Compare 2D',version:1,units:'m',north:0,targets:{ach:5,df:2,view:.75},climate:{from:225,U10:3.5,terrain:'suburban',Tout:18,Tin:24},levels:[{id:'L1',name:'Ground',z:0,h:3}],walls:[{id:'w1',lv:'L1',a:[0,0],b:[10,0],t:.2},{id:'w2',lv:'L1',a:[10,0],b:[10,10],t:.2},{id:'w3',lv:'L1',a:[10,10],b:[0,10],t:.2},{id:'w4',lv:'L1',a:[0,10],b:[0,0],t:.2}],ops:[],floors:[{id:'fl1',lv:'L1',x:0,y:0,w:10,d:10}],voids:[],names:[],furn:[{id:'f1',lv:'L1',type:'table',x:4,y:4,w:2,d:2,h:.75,rot:0}]};
    const modelB=structuredClone(model); modelB.version=2; modelB.furn[0].x=4.5;
    const versions=[{key:'a',n:1,name:'A',note:'',model:JSON.stringify(model),modelVersion:1},{key:'b',n:2,name:'B',note:'',model:JSON.stringify(modelB),modelVersion:2}];
    await work.evaluate(v=>window.__wb.cmp.open(v,{view:'2d',type:'3d',lv:'L1'}),versions); await work.locator('#cmpPlan canvas').first().waitFor({state:'visible'});
    await page.waitForTimeout(150);
    let metrics=await work.evaluate(()=>{const c=[...document.querySelectorAll('#cmpPlan canvas')],cam=window.__wb.cmp.camera2d(),p0=window.__wb.cmp.worldToScreen2d(0,0),px=window.__wb.cmp.worldToScreen2d(1,0),py=window.__wb.cmp.worldToScreen2d(0,1);return{count:c.length,cam,dx:Math.hypot(px[0]-p0[0],px[1]-p0[1]),dy:Math.hypot(py[0]-p0[0],py[1]-p0[1]),sizes:c.map(x=>({cw:x.clientWidth,ch:x.clientHeight,bw:x.width,bh:x.height}))}});
    assert.equal(metrics.count,2); assert(near(metrics.dx,metrics.dy,1e-6),'horizontal and vertical scales differ'); assert(metrics.cam.scale>0);
    assert.deepEqual(metrics.sizes[0],metrics.sizes[1],'comparison canvases must have the same viewport');
    for(const s of metrics.sizes){assert(near(s.bw/s.cw,s.bh/s.ch,.03),'DPR scaling differs by axis');}
    await page.setViewportSize({width:1050,height:760}); await page.waitForTimeout(180);
    metrics=await work.evaluate(()=>{const p0=window.__wb.cmp.worldToScreen2d(0,0),px=window.__wb.cmp.worldToScreen2d(1,0),py=window.__wb.cmp.worldToScreen2d(0,1);return{dx:Math.hypot(px[0]-p0[0],px[1]-p0[1]),dy:Math.hypot(py[0]-p0[0],py[1]-p0[1])}}); assert(near(metrics.dx,metrics.dy,1e-6),'resize distorted the model');
    const cv=work.locator('#cmpPlan canvas').first(),box=await cv.boundingBox(),sx=box.width*.63,sy=box.height*.41;
    const before=await work.evaluate(([x,y])=>window.__wb.cmp.screenToWorld2d(x,y),[sx,sy]); await page.mouse.move(box.x+sx,box.y+sy); await page.mouse.wheel(0,-420); await page.waitForTimeout(650); const after=await work.evaluate(([x,y])=>window.__wb.cmp.screenToWorld2d(x,y),[sx,sy]); assert(near(before[0],after[0],.015)&&near(before[1],after[1],.015),'wheel zoom anchor moved');
    const pan0=await work.evaluate(()=>window.__wb.cmp.camera2d()); await page.mouse.down({button:'middle'}); await page.mouse.move(box.x+sx+70,box.y+sy+35,{steps:4}); await page.mouse.up({button:'middle'}); const pan1=await work.evaluate(()=>window.__wb.cmp.camera2d()); assert(near(pan1.offsetX-pan0.offsetX,70,2)&&near(pan1.offsetY-pan0.offsetY,35,2),'middle-button pan failed');
    await page.mouse.move(box.x+sx,box.y+sy); await page.keyboard.down('Space'); await page.mouse.down({button:'left'}); await page.mouse.move(box.x+sx-30,box.y+sy+20,{steps:3}); await page.mouse.up({button:'left'}); await page.keyboard.up('Space'); const pan2=await work.evaluate(()=>window.__wb.cmp.camera2d()); assert(near(pan2.offsetX-pan1.offsetX,-30,2)&&near(pan2.offsetY-pan1.offsetY,20,2),'Space + left-button pan failed');
    await work.locator('#cmpFit').click(); const fit=await work.evaluate(()=>window.__wb.cmp.state.view2d.autoFit); assert.equal(fit,true); await work.locator('#cmpReset').click();
    const png=await work.evaluate(async()=>{const im=new Image(),src=window.__wb.cmp.png2d(); await new Promise((r,j)=>{im.onload=r;im.onerror=j;im.src=src}); return{w:im.naturalWidth,h:im.naturalHeight,prefix:src.slice(0,22)}}); assert.equal(png.w,1920); assert(png.h>500); assert.equal(png.prefix,'data:image/png;base64,');
    assert.equal(errors.length,0,'Browser errors: '+errors.join(' | ')); console.log('PASS Compare 2D shared proportional camera, DPR, resize, cursor zoom, pan, fit/reset and PNG export');
  }finally{await browser.close();}
})().catch(e=>{console.error(e.stack||e);process.exit(1)});
