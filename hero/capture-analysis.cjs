// Reproducible catalogue illustrations, never presented as computed project results.
const {chromium}=require('playwright');
const all=['sunhours','daylight','wind','vent','stormwater','acoustics','spacesyntax','movementdepth','evac','isovist','views','cameras','structure','wayfinding','privacy','noise'];
const ids=process.env.TEST_SIM?process.env.TEST_SIM.split(','):all;
if(ids.some(id=>!all.includes(id)))throw Error('Unknown catalogue simulation');
(async()=>{const b=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||undefined,headless:true,args:['--enable-unsafe-swiftshader']});try{const p=await b.newPage({viewport:{width:1200,height:900}});p.on('pageerror',e=>console.error(e));for(const id of ids)for(const theme of ['day','night']){await p.goto(`${process.env.TEST_BASE||'http://127.0.0.1:8765'}/mvp/analysis-art.html?mode=${id}&t=${theme}`);await p.waitForFunction(()=>window.__artReady,null,{timeout:120000});await p.screenshot({path:`mvp/img/analysis-${id}-${theme}.jpg`,type:'jpeg',quality:92});console.log(id,theme,JSON.stringify(await p.evaluate(()=>window.__artInfo||{})));}}finally{await b.close();}})().catch(e=>{console.error(e);process.exitCode=1});
