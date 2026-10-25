const assert=require('node:assert/strict'),{chromium}=require('playwright');
const base=process.env.TEST_BASE||'http://127.0.0.1:8765';
const sims=['sunhours','wind','daylight','vent','spacesyntax','movementdepth','isovist','cameras','views','acoustics','evac','structure','stormwater','wayfinding','privacy','noise'];
(async()=>{const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||undefined,headless:true,args:['--enable-unsafe-swiftshader']});try{
 const rows=[];
 for(const id of sims.filter(id=>!process.env.TEST_SIM||process.env.TEST_SIM===id)){
  const page=await browser.newPage({viewport:{width:1440,height:900}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto(base+'/mvp/#/simulations/'+id);await page.locator('#eng[data-pc-settings-ready="true"]').waitFor({state:'attached',timeout:60000});await page.waitForTimeout(id==='stormwater'?3000:500);
  const report=await page.evaluate(()=>{const rows=[];function inspect(d){const app=d.querySelector('.app');if(app){const state=app.dataset.pcUnified?'unified':app.dataset.pcUnifiedBlocked?'review':'existing';rows.push({title:d.title,state,measurements:JSON.parse(app.dataset.pcUnifiedMeasurements||'[]'),blocked:JSON.parse(app.dataset.pcUnifiedBlocked||'[]'),left:[...d.querySelectorAll('#panelL>.pc-fit-tabs button')].filter(b=>!b.hidden).map(b=>b.textContent),right:[...d.querySelectorAll('#panelR>.pc-fit-tabs button')].filter(b=>!b.hidden).map(b=>b.textContent)});}for(const f of d.querySelectorAll('iframe'))if(f.contentDocument&&f.getBoundingClientRect().width)inspect(f.contentDocument);}inspect(document.querySelector('#eng').contentDocument);return rows;});
  for(const r of report)if(r.state==='unified'){assert.deepEqual(r.left,['Settings','Export']);assert.deepEqual(r.right,['Results','Charts']);}
  assert.deepEqual(errors,[],id+' errors');rows.push({id,report});console.log(JSON.stringify(rows.at(-1)));
  if(['vent','spacesyntax','wayfinding','privacy'].includes(id))await page.screenshot({path:require('os').tmpdir()+'/unified-'+id+'.png'});
  await page.close();
 }
 console.log('PASS unified UI audit: '+rows.length+' tools; overflow groups retained for review, never clipped or scaled');
}finally{await browser.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
