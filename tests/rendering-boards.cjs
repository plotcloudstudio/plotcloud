// Rendering and Boards entries (main flow steps 4–5). The real render service (server/render-api.mjs) is started locally
// with an invalid provider key: the page must reach the service, report the provider failure and save nothing. Boards must
// compose saved engine previews into a PNG without new uploads.
const assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path'),{spawn}=require('node:child_process'),{chromium}=require('playwright');
const base=process.env.TEST_BASE||'http://127.0.0.1:8765',port=8790,out=process.env.EVIDENCE_DIR||path.join(os.tmpdir(),'plotcloud-rendering-boards');fs.mkdirSync(out,{recursive:true});
const png=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==','base64');
(async()=>{
 const token='t'.repeat(40),srv=spawn(process.execPath,[path.join(__dirname,'../server/render-api.mjs')],{env:{...process.env,GEMINI_API_KEY:'invalid-test-key',GEMINI_IMAGE_MODEL:'gemini-test-image',RENDER_ACCESS_TOKEN:token,ALLOWED_ORIGINS:new URL(base).origin,PORT:String(port)},stdio:['ignore','pipe','pipe']});
 await new Promise((res,rej)=>{const t=setTimeout(()=>rej(Error('render service did not start')),15000);const poll=()=>fetch(`http://127.0.0.1:${port}/health`).then(r=>{clearTimeout(t);res();}).catch(()=>setTimeout(poll,200));poll();});
 const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||undefined,headless:true,args:['--enable-unsafe-swiftshader']});
 try{
  const ctx=await browser.newContext({acceptDownloads:true}),p=await ctx.newPage(),errors=[];p.on('pageerror',e=>errors.push(e.message));
  await p.goto(base+'/mvp/');await p.waitForFunction(()=>document.querySelector('#app h1'));
  const pid=await p.evaluate(async()=>{const S=await import('./js/store.js');S.reset();const x=S.projects()[0];return x.id;});
  await p.goto(base+'/mvp/#/rendering?project='+pid);await p.locator('#rsGo').click();assert.match(await p.locator('#rsMsg').innerText(),/Connect a render service first\. Nothing was generated/);
  await p.locator('#rsUrl').fill(`http://127.0.0.1:${port}`);await p.locator('#rsToken').fill(token);await p.locator('#rsCheck').click();await p.locator('#rsStatus').filter({hasText:'Service reachable'}).waitFor();
  await p.locator('#rsSource').setInputFiles({name:'view.png',mimeType:'image/png',buffer:png});await p.locator('#rsGo').click();
  await p.locator('#rsMsg').filter({hasText:'Nothing was saved'}).waitFor({timeout:60000});
  assert.equal(await p.evaluate(async id=>{const S=await import('./js/store.js');return (S.project(id).renders||[]).length;},pid),0);
  console.log('PASS rendering reaches the real service; provider failure is reported and nothing is saved:',await p.locator('#rsMsg').innerText());
  // boards from a saved engine preview
  await p.evaluate(async id=>{const S=await import('./js/store.js'),x=S.project(id),c=document.createElement('canvas');c.width=40;c.height=30;const g=c.getContext('2d');g.fillStyle='#3b6fb6';g.fillRect(0,0,40,30);S.addRun(x,x.versions.at(-1).id,'sunhours',{},{kpis:[['Ground, mean','4.2 h']],ground:4.2,thumb:c.toDataURL('image/jpeg')});},pid);
  await p.goto(base+'/mvp/#/boards?project='+pid);await p.locator('[data-item]').first().waitFor();
  const [dl]=await Promise.all([p.waitForEvent('download'),p.locator('#bdMake').click()]);const f=path.join(out,'board.png');await dl.saveAs(f);
  const head=fs.readFileSync(f).subarray(0,8);assert.ok(head.equals(Buffer.from([137,80,78,71,13,10,26,10])));assert.ok(fs.statSync(f).size>5000);
  assert.match(await p.locator('#bdMsg').innerText(),/1 panel/);console.log('PASS board PNG from saved previews:',f);
  assert.deepEqual(errors,[]);
 }finally{await browser.close();srv.kill();}
})().catch(e=>{console.error(e);process.exitCode=1});
