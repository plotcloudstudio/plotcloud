const assert = require('node:assert/strict');
const { chromium } = require('playwright');
const base = process.env.TEST_BASE || 'http://127.0.0.1:8765';
(async () => {
  const browser = await chromium.launch({...(process.env.CHROMIUM_PATH?{executablePath:process.env.CHROMIUM_PATH}:{}),headless:true,args:['--no-sandbox','--enable-unsafe-swiftshader']});
  try {
    const page = await browser.newPage({viewport:{width:1440,height:1000}});
    const errors=[];page.on('pageerror',error=>errors.push(error.message));
    await page.goto(base+'/hero/toronto.html');
    await page.locator('[data-ready=true]').waitFor();
    const state=()=>page.evaluate(()=>window.PlotCloudHero.state);
    const image=()=>page.locator('canvas').screenshot();
    const frames=[];
    for(const mode of ['sun','wind','rain','sound']){
      await page.getByRole('button',{name:mode[0].toUpperCase()+mode.slice(1),exact:true}).click();
      assert.equal((await state()).mode,mode);
      assert.equal(await page.locator('button[data-mode][aria-pressed=true]').count(),1);
      await page.waitForTimeout(200);
      frames.push(await image());
    }
    for(let i=1;i<frames.length;i++)assert(!frames[i].equals(frames[i-1]),'Each mode must change the rendered scene');
    const before=await state();await page.waitForTimeout(400);
    assert((await state()).clock>before.clock,'Animation must advance');
    await page.getByRole('button',{name:'Pause animation',exact:true}).click();
    await page.waitForTimeout(100);const stopped=await state();const still=await image();
    await page.waitForTimeout(300);
    assert.equal((await state()).clock,stopped.clock,'Pause must freeze the clock');
    assert(still.equals(await image()),'Pause must freeze the rendered scene');
    const canvas=await page.locator('canvas').boundingBox();
    await page.mouse.move(canvas.x+canvas.width*.5,canvas.y+canvas.height*.5);
    await page.mouse.down();await page.mouse.move(canvas.x+canvas.width*.5+110,canvas.y+canvas.height*.5+30,{steps:8});await page.mouse.up();
    assert.notEqual((await state()).azimuth,stopped.azimuth,'Drag must change viewpoint');
    await page.getByRole('button',{name:'Reset view'}).click();assert.equal((await state()).azimuth,.63);
    for(const width of [390,320]){
      await page.setViewportSize({width,height:844});
      assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'Scene must fit narrow widths');
      assert(await page.getByRole('button',{name:'Sound',exact:true}).isVisible());
    }
    assert.deepEqual(errors,[]);
    const reduced = await browser.newPage({reducedMotion:'reduce'});
    await reduced.goto(base+'/hero/toronto.html');await reduced.locator('[data-ready=true]').waitFor();
    assert.equal(await reduced.evaluate(()=>PlotCloudHero.state.paused),true);
    await reduced.getByRole('button',{name:'Wind',exact:true}).click();
    assert.equal(await reduced.evaluate(()=>PlotCloudHero.state.mode),'wind');
    const fallback=await browser.newPage();
    await fallback.addInitScript(()=>{
      const get=HTMLCanvasElement.prototype.getContext;
      HTMLCanvasElement.prototype.getContext=function(type,...args){return type.startsWith('webgl')?null:get.call(this,type,...args);};
    });
    await fallback.goto(base+'/hero/toronto.html');await fallback.locator('[data-fallback=true]').waitFor();
    assert(await fallback.locator('.fallback svg').isVisible());
    assert.equal(await fallback.locator('button:enabled').count(),0);
    console.log('PASS: four distinct rendered states, live animation, pause stability, drag/reset, narrow layout, reduced motion and WebGL fallback');
  } finally {await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
