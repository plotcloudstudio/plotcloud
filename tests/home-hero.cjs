const assert=require('node:assert/strict');
const {chromium}=require('playwright');
const base=process.env.TEST_BASE||'http://127.0.0.1:8765';
(async()=>{
 const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||undefined,headless:true,args:['--no-sandbox','--enable-unsafe-swiftshader']});
 try{
  const page=await browser.newPage({viewport:{width:1440,height:1100}}),errors=[],heroRequests=[];
  page.on('pageerror',e=>errors.push(e.message));
  page.on('request',request=>{if(/hero\//.test(request.url()))heroRequests.push(request.url())});
  await page.addInitScript(()=>{if(!localStorage.getItem('pc-mvp-theme'))localStorage.setItem('pc-mvp-theme','day')});
  const frame=()=>page.frameLocator('[data-home-hero]');
  const current=()=>page.locator('[data-home-hero]').evaluate(el=>el.contentWindow.PlotCloudHero.state);
  const ready=async(mode)=>{await frame().locator('[data-ready=true]').waitFor();await page.waitForFunction(expected=>document.querySelector('[data-home-hero]')?.contentWindow?.PlotCloudHero?.state.mode===expected,mode)};
  await page.goto(base+'/mvp/');await ready('sun');
  assert.equal(await page.locator('.hero img[data-holo=hero]').count(),0,'Old hero image must be replaced');
  assert.equal(await page.locator('figure.home-hero-study').count(),1);
  assert(heroRequests.every(url=>url.includes('toronto-standalone.html')),'Hero must not need external style or engine files');
  await frame().locator('canvas').click();await ready('wind');
  await page.reload();await ready('wind');
  await page.getByRole('link',{name:'Pricing',exact:true}).first().click();
  await page.waitForFunction(()=>!document.querySelector('[data-home-hero]'));
  await page.locator('.brand').click();await ready('wind');
  await frame().locator('canvas').click();await ready('rain');
  const remembered=await page.evaluate(()=>sessionStorage.getItem('pc-toronto-hero-mode'));assert.equal(remembered,'rain');
  await page.locator('[data-home-hero]').scrollIntoViewIfNeeded();
  const before=await current();const bounds=await frame().locator('canvas').boundingBox();
  await page.mouse.move(bounds.x+bounds.width*.82,bounds.y+bounds.height*.35);
  await page.waitForFunction(()=>Math.abs(document.querySelector('[data-home-hero]').contentWindow.PlotCloudHero.state.leanX)>.01);
  assert.equal(await frame().locator('.bird-cursor').count(),0,'No animated bird cursor');
  assert.notEqual((await current()).leanX,before.leanX,'Pointer must influence the view without dragging');
  // Headless browsers do not reliably expose tab visibility. Dispatch the same browser event
  // after overriding visibility to verify the handler, with a separate real-page return check above.
  await page.evaluate(()=>{Object.defineProperty(document,'hidden',{configurable:true,get:()=>true});document.dispatchEvent(new Event('visibilitychange'))});
  await page.waitForTimeout(550);
  await page.evaluate(()=>{Object.defineProperty(document,'hidden',{configurable:true,get:()=>false});document.dispatchEvent(new Event('visibilitychange'))});
  await ready('rain');
  await frame().locator('canvas').click();await ready('sound');
  await page.evaluate(()=>document.dispatchEvent(new Event('visibilitychange')));await ready('sound');
  await page.locator('#themeSeg [data-theme=night]').click();
  await page.waitForFunction(()=>document.querySelector('[data-home-hero]').contentWindow.PlotCloudHero.state.theme==='night');
  assert.equal((await current()).mode,'sound','Theme changes must not advance the environmental mode');
  assert.equal(await frame().locator('.study-controls').isVisible(),false,'Embedded controls must not be shown');
  assert.equal(await frame().locator('.topline').isVisible(),false);
  assert.equal(await frame().locator('.view-actions').isVisible(),false);
  assert.equal(await page.locator('.home-hero-study').evaluate(el=>getComputedStyle(el).borderTopWidth),'0px');
  await frame().locator('canvas').focus();await page.keyboard.press('Space');
  assert.equal((await current()).paused,true,'Keyboard users must be able to pause the uncluttered scene');
  await page.reload();await ready('sound');
  await frame().locator('canvas').focus();await page.keyboard.press('Enter');await ready('snow');
  await frame().locator('canvas').click();await ready('sun');
  const dragBox=await frame().locator('canvas').boundingBox();
  await page.mouse.move(dragBox.x+dragBox.width*.5,dragBox.y+dragBox.height*.5);await page.mouse.down();await page.mouse.move(dragBox.x+dragBox.width*.65,dragBox.y+dragBox.height*.55,{steps:8});await page.mouse.up();await ready('sun');
  await page.setViewportSize({width:390,height:844});
  assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'Homepage must not overflow');
  assert(await frame().locator('canvas').isVisible());
  // A same-window forged message is not accepted as a scene event.
  await page.evaluate(()=>postMessage({type:'plotcloud-hero-state',mode:'rain'},location.origin));
  await page.waitForTimeout(50);assert.equal(await page.evaluate(()=>sessionStorage.getItem('pc-toronto-hero-mode')),'sun');
  assert.deepEqual(errors,[]);
  console.log('PASS homepage click cycling, keyboard cycling, stable reload/route/visibility, drag without cycling, hover, pause, theme, narrow layout and message isolation');
 }finally{await browser.close()}
})().catch(e=>{console.error(e);process.exitCode=1});
