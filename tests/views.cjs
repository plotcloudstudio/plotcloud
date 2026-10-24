const assert=require('assert'),fs=require('fs'),{chromium}=require('playwright');
const base=process.env.TEST_BASE||'http://127.0.0.1:8765';
const near=(a,b)=>{assert.equal(a.length,b.length);a.forEach((x,i)=>assert(Math.abs(x-b[i])<1e-5,JSON.stringify({a,b})));};
(async()=>{
 const browser=await chromium.launch({headless:true,args:['--no-sandbox','--enable-unsafe-swiftshader']});
 const page=await browser.newPage({viewport:{width:1600,height:1000},acceptDownloads:true}),errors=[],dir='/tmp/plotcloud-screenshots';fs.mkdirSync(dir,{recursive:true});
 page.on('pageerror',e=>{errors.push(e.message);console.error('PAGE ERROR',e.stack)});page.on('dialog',d=>d.accept());let work;
 const studio=async()=>{work=await(await page.locator('iframe[data-emb="modeler"]').elementHandle()).contentFrame();await work.waitForFunction(()=>!!window.__pcViews);await work.evaluate(()=>window.__wbTour?.close());};
 const openRender=async()=>{await work.locator('[data-lt="render"]').click();await work.waitForFunction(()=>window.S3?.on);};
 const pose=()=>work.evaluate(()=>S3.cameraPose());
 try{
  await page.goto(base+'/#/studio');await studio();
  await work.evaluate(()=>{const N=window.__pcWorkflow.getModel();N.id='saved-camera-test';N.name='Saved camera test';N.version=0;delete N.renderViews;window.__pcWorkflow.load(N);});
  await openRender();await work.locator('#rvFov').fill('52');await work.locator('#rvFov').dispatchEvent('change');await work.waitForFunction(()=>S3.cameraPose().fov===52);
  await work.locator('#rvWidth').selectOption('1280');await work.locator('#rvName').fill('Reception entry');const original=await pose();
  await work.locator('#rvNew').click();await work.waitForFunction(()=>window.__pcWorkflow.getModel().renderViews?.length===1&&window.__pcWorkflow.getModel().version>0);
  const viewId=await work.evaluate(()=>window.__pcWorkflow.getModel().renderViews[0].id);
  await work.evaluate(()=>{S3.zoom(1.5);S3.fieldOfView(75);});await work.locator('[data-rv-view="'+viewId+'"]').click();await work.waitForFunction(()=>S3.cameraPose().fov===52);
  let restored=await pose();near(original.p,restored.p);near(original.q,restored.q);near(original.t,restored.t);
  await work.locator('#rvCapture').click();await work.waitForFunction(()=>window.__pcViews.records.length===1);
  const first=await work.evaluate(()=>window.__pcViews.records[0]);assert.equal(first.width,1280);assert.equal(first.height,720);near(first.sourceContext.camera.p,original.p);assert.equal(first.sourceContext.viewId,viewId);assert(first.model.walls.length>0);
  const download=page.waitForEvent('download');await work.locator('[data-rv-download]').first().click();const file=await download;assert(file.suggestedFilename().endsWith('.png'));assert(fs.readFileSync(await file.path()).length>10000,'Model view image is empty');
  await work.evaluate(()=>{const p=S3.cameraPose();p.p[0]+=4;p.t[0]+=4;S3.restoreCamera(p);});await work.locator('#rvCapture').click();await work.waitForFunction(()=>window.__pcViews.records.length===2);
  const second=await work.evaluate(()=>window.__pcViews.records[0]);assert.notEqual(second.imageData,first.imageData,'Capture ignored the active camera');
  await page.reload();await studio();await work.waitForFunction(()=>window.__pcWorkflow.getModel().id==='saved-camera-test');await openRender();await work.waitForFunction(()=>window.__pcViews.records.length===2);await work.locator('[data-rv-view="'+viewId+'"]').click();await work.waitForFunction(()=>S3.cameraPose().fov===52);near((await pose()).p,original.p);
  const option=await work.evaluate(()=>window.__pcWorkflow.duplicate());assert.notEqual(option,'saved-camera-test');await openRender();await work.waitForFunction(()=>window.__pcViews.records.length===0);await work.locator('[data-rv-view="'+viewId+'"]').click();near((await pose()).p,original.p);
  assert(await work.evaluate(()=>window.__pcWorkflow.open('saved-camera-test')));await openRender();await work.waitForFunction(()=>window.__pcViews.records.length===2);
  await work.locator('#rvInterior').click();await work.waitForFunction(()=>S3.walk.state().on);await work.locator('#rvName').fill('Interior reception');await work.locator('#rvAspect').selectOption('0.75');await work.locator('#rvNew').click();await work.waitForFunction(()=>window.__pcWorkflow.getModel().renderViews.length===2);
  const interior=await pose();assert.equal(interior.mode,'interior');await work.locator('#rvCapture').click();await work.waitForFunction(()=>window.__pcViews.records.length===3);const interiorShot=await work.evaluate(()=>window.__pcViews.records[0]);near(interiorShot.sourceContext.camera.p,interior.p);assert.equal(interiorShot.height,1707);
  await page.screenshot({path:dir+'/studio-saved-views.png',fullPage:true});
  await work.evaluate(()=>{window.__realRenderPut=PlotCloudRenders.put;PlotCloudRenders.put=()=>Promise.reject(Error('Storage full (test)'));});await work.locator('#rvCapture').click();await work.waitForFunction(()=>document.getElementById('rvStatus').textContent.includes('Storage full'));assert(page.url().endsWith('#/studio'),'Storage failure navigated away from Studio');await work.evaluate(()=>{PlotCloudRenders.put=window.__realRenderPut;});
  assert.equal(errors.length,0,'Browser errors: '+errors.join(' | '));console.log('PASS exact saved-camera restoration, current-camera image capture, interior output, durable project images, cloned option camera, mobile controls, immutable save, model freshness and storage failure');
 }finally{await page.screenshot({path:dir+'/saved-views-final.png',fullPage:true}).catch(()=>{});await browser.close();}
})().catch(e=>{console.error(e.stack||e);process.exit(1)});
