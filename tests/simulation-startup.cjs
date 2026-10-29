const assert=require('node:assert/strict'),{chromium}=require('playwright');
const base=process.env.TEST_BASE||'http://127.0.0.1:8765';
(async()=>{const b=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||undefined,headless:true});try{
 const p=await b.newPage({viewport:{width:1280,height:650}});let release,versioned=false;
 const gate=new Promise(resolve=>release=resolve);
 await p.route('**/emb/vent.html*',async route=>{versioned=!!new URL(route.request().url()).searchParams.get('v');await gate;if(!versioned)return route.fulfill({contentType:'text/html',body:'<html><body>Obsolete unversioned engine</body></html>'});await route.continue();});
 await p.goto(base+'/mvp/#/simulations/vent',{waitUntil:'domcontentloaded'});await p.locator('#eng').waitFor({state:'attached'});
 assert.equal(await p.locator('#eng').evaluate(f=>getComputedStyle(f).visibility),'hidden','Never show engine sample while the selected model/settings are loading');assert(await p.locator('#engineLoading').isVisible());release();
 await p.locator('#eng[data-pc-visible-ready=true]').waitFor({state:'visible',timeout:60000});assert(versioned,'Engine HTML must carry a release version, not reuse an unversioned cached page');assert.equal(await p.locator('#engineLoading').count(),0);
 const versions=await p.evaluate(()=>({host:new URL(JSON.parse(document.querySelector('script[type=importmap]').textContent).imports['./js/pages/sim-engine.js'],location.href).searchParams.get('v'),engine:new URL(document.getElementById('eng').src).searchParams.get('v')}));assert.equal(versions.engine,versions.host,'Host and engine HTML release versions must stay aligned');
 assert.equal(await p.frameLocator('#eng').locator('.app').getAttribute('data-pc-unified'),'true');
 assert.equal(await p.frameLocator('#eng').locator('.vbar #toolBar,.vbar #showBar').count(),0);
 console.log('PASS versioned engine HTML, explicit loading state and first visible frame already uses current layout');
 await p.close();
}finally{await b.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
