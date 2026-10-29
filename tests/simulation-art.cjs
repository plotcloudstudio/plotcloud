const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const {chromium}=require('playwright');
const base=process.env.TEST_BASE||'http://127.0.0.1:8765';
const palettes=require('../mvp/engine-colours.json'),ids=['wayfinding','privacy'];
// Verify the catalogue's RGB values against the engine definitions, not an invented palette.
for(const [id,key] of [['wayfinding','DEPTH'],['privacy','EXP'],['noise','BANDS']]){
 const text=fs.readFileSync(require.resolve('../emb/'+id+'.html'),'utf8'),literal=text.match(new RegExp('const '+key+' = (\\[.*\\]);'))[1];
 const values=JSON.parse(JSON.stringify(vm.runInNewContext(literal,{}, {timeout:1000})));
 if(id==='noise'){assert.deepEqual(palettes[id].stops.map(s=>s[1]),values.map(s=>s[1]));assert.deepEqual(palettes[id].thresholds,values.slice(0,-1).map(s=>s[0]));}
 else assert.deepEqual(palettes[id].stops,values);
}
(async()=>{const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||undefined,headless:true,args:['--enable-unsafe-swiftshader']});
try{const page=await browser.newPage({viewport:{width:1200,height:900}}),errors=[];page.on('pageerror',e=>errors.push(e.message));let camera;
 for(const id of ['daylight','wind',...ids]){
  let day;
  for(const theme of ids.includes(id)?['day']:['day']){
   await page.goto(base+'/mvp/analysis-art.html?mode='+id+'&t='+theme);await page.waitForFunction(()=>window.__artReady,null,{timeout:120000});
   const result=await page.evaluate(()=>({info:window.__artInfo,camera:window.__artCamera,canvas:[document.querySelector('canvas').width,document.querySelector('canvas').height],label:document.querySelector('.foot>span').textContent}));
   camera??=result.camera;assert.deepEqual(result.camera,camera,'One camera and model scale across interior/exterior previews');assert.deepEqual(result.canvas,[1200,900]);
   if(ids.includes(id)){assert.equal(result.info.engine,'emb/'+id+'.html');assert(result.info.cells>100);assert(result.info.max>result.info.min);assert.equal(result.info.scope,id==='noise'?'Exterior':'Interior');assert.match(result.label,/SAMPLE ENGINE RESULT/);
    if(theme==='day')day=result.info;else assert.deepEqual(result.info,day,'Theme must not change simulation inputs or values');}
  }
 }
 await page.goto(base+'/mvp/#/simulations');assert.equal(await page.locator('[data-sim="noise"]').count(),0,'Removed noise study is absent from the catalog');
 for(const theme of ['day']){
  for(const id of ids){const card=page.locator('[data-sim="'+id+'"]');await card.waitFor();assert.equal(await card.getAttribute('data-scope'),id==='noise'?'Exterior':'Interior');
   const image=card.locator('img');await image.evaluate(im=>im.loading='eager');await image.evaluate(im=>im.decode());assert.match(await image.getAttribute('src'),new RegExp('analysis-'+id+'-'+theme+'\\.jpg\\?v=engine-'));assert.deepEqual(await image.evaluate(im=>[im.naturalWidth,im.naturalHeight]),[1200,900]);}
 }
 assert.deepEqual(errors,[]);console.log('PASS current spatial simulation previews: real varying engine fields, exact engine RGB palettes, shared camera/scale, light appearance and catalogue images');
}finally{await browser.close();}})().catch(e=>{console.error(e);process.exitCode=1});
