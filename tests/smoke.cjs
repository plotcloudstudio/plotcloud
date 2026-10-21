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
   assert(/Render & Present/i.test(tools),'Rendering and presentation tools missing');
   assert(/architectural drawing/i.test(tools),'Architectural drawing listing missing');
   assert(/cutout|depth map|sun & shadow/i.test(tools),'Original tools missing');
   assert.equal(errors.length,0,'Tool routing errors: '+errors.join(' | '));
   await visit('tool/architectural-render');
   const iframe=page.locator('iframe[data-emb="architectural-render"]');
   await iframe.waitFor({timeout:10000});
   await page.waitForTimeout(2000);
   assert(await iframe.contentFrame().locator('h1').first().isVisible(),'Renderer iframe failed to mount');
   assert(await iframe.contentFrame().locator('#source').count(),'Source upload missing');
   assert(await iframe.contentFrame().locator('#reset').count(),'Drawing reset control missing');
   assert.equal(await iframe.contentFrame().locator('#styles [data-style]').count(),2,'Drawing styles missing');
   assert.equal(errors.length,0,'Renderer JS errors: '+errors.join(' | '));
   await visit('tool/cutout');
   assert((await page.locator('#app').innerText()).length>30,'Existing tool route empty');
   assert.equal(errors.length,0,'Regression errors: '+errors.join(' | '));
   // Public release copy must stay consistent across product, account and legal pages.
   for (const route of ['home','tools','pricing','join','login','library','learn','donate','terms','privacy','license','refunds','project','tool/render','tool/plan']) {
     await visit(route);
     const body = await page.locator('body').innerText();
     assert(!/\bbeta\b|coming soon|in development|Student Pro/i.test(body), 'Unreleased or student-only plan copy on '+route);
     assert((await page.locator('#app').innerText()).trim().length>30, 'Empty page: '+route);
   }
   await visit('join');
   assert(await page.locator('[name="organization"]').count(), 'Practice/school field missing');
   assert(await page.locator('[name="profession"] option').filter({hasText:'Architect'}).count(), 'Architect role missing');
   await visit('pricing');
   assert(/PlotCloud Pro/.test(await page.locator('#app').innerText()), 'Unified Pro name missing');
   assert.equal(errors.length,0,'Release route errors: '+errors.join(' | '));
   // Existing CMS text is upgraded without resetting the user's other stored settings.
   await page.evaluate(()=>localStorage.setItem('pc-proto',JSON.stringify({role:'visitor',saved:[],reqs:[],quotes:[],cms:{home:{heroBadge:'Free during the beta'},settings:{tagline:'Drawing resources for architecture students'}}})));
   await visit('home');
   assert(!/\bbeta\b/i.test(await page.locator('body').innerText()), 'Saved CMS release copy not upgraded');
   assert(/architects and architecture students/.test(await page.locator('footer').innerText()), 'Saved tagline not upgraded');
   console.log('PASS original tools, public release pages and saved CMS migration');
 }finally{await browser.close();}
})().catch(e=>{console.error('FAIL',e.stack||e);process.exit(1)});
