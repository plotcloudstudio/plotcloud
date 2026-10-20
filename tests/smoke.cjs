const fs=require('fs'),assert=require('assert'),{chromium}=require('playwright');
const base=process.env.TEST_BASE||'http://127.0.0.1:8765';
(async()=>{
 const browser=await chromium.launch({headless:true,args:['--no-sandbox']});
 const page=await browser.newPage({viewport:{width:1440,height:900},acceptDownloads:true});
 const errors=[];page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')console.log('console-error:',m.text().slice(0,200))});
 const visit=async(route)=>{await page.goto(base+'/#/'+route,{waitUntil:'domcontentloaded'});await page.waitForTimeout(1800);console.log('VISITED',route,'title:',await page.title());};
 try{
   await visit('home');
   assert((await page.locator('#app').innerText()).trim().length>50,'Home is empty');
   assert.equal(errors.length,0,'Main app startup errors: '+errors.join(' | '));
   await visit('tools');
   const tools=await page.locator('#app').innerText(); console.log('TOOLS BODY START:',JSON.stringify(tools.slice(0,2500))); console.log('PAGE ERRORS:',JSON.stringify(errors));
   assert(/04 · Present/i.test(tools),'Existing Present section missing');
   assert(/architectural ai render/i.test(tools),'New render listing missing');
   assert(/cutout|depth map|sun & shadow/i.test(tools),'Original tools missing');
   assert.equal(errors.length,0,'Tool routing errors: '+errors.join(' | '));
   await visit('tool/architectural-render');
   const iframe=page.locator('iframe[data-emb="architectural-render"]');
   await iframe.waitFor({timeout:10000});
   await page.waitForTimeout(2000);
   assert(await iframe.contentFrame().locator('h1').first().isVisible(),'Renderer iframe failed to mount');
   assert(await iframe.contentFrame().locator('#source').count(),'Source upload missing');
   assert(await iframe.contentFrame().locator('#maskEditor').count(),'Mask editor missing');
   assert.equal(errors.length,0,'Renderer JS errors: '+errors.join(' | '));
   await visit('tool/cutout');
   assert((await page.locator('#app').innerText()).length>30,'Existing tool route empty');
   assert.equal(errors.length,0,'Regression errors: '+errors.join(' | '));
   console.log('PASS home / tools / new renderer / existing tool');
 }finally{await browser.close();}
})().catch(e=>{console.error('FAIL',e.stack||e);process.exit(1)});
