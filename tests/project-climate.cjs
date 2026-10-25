const assert=require('node:assert/strict'),{chromium}=require('playwright');
const base=process.env.TEST_BASE||'http://127.0.0.1:8765';
function epw(){const lines=['LOCATION,QA Station,BC,CAN,TEST,000,49,-123,-8,70',...Array(7).fill('TEST')];for(let i=0;i<8760;i++){const d=new Date(Date.UTC(2025,0,1,i)),row=Array(35).fill('0');Object.assign(row,{0:'2025',1:String(d.getUTCMonth()+1),2:String(d.getUTCDate()),3:String(d.getUTCHours()+1),6:'20',14:'100',15:'100',17:'9300',18:'12000',20:'225',21:'3'});lines.push(row.join(','));}return Buffer.from(lines.join('\n'));}
(async()=>{const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||undefined,headless:true,args:['--enable-unsafe-swiftshader']});try{
 const p=await browser.newPage({viewport:{width:1500,height:1000}}),errors=[];p.on('pageerror',e=>errors.push(e.message));
 await p.goto(base+'/mvp/');await p.waitForFunction(()=>document.querySelector('#app h1'));
 const pid=await p.evaluate(async()=>{const S=await import('./js/store.js');S.reset();return S.projects()[0].id;});
 console.log('Project ready',pid);
 await p.goto(base+'/mvp/#/project-settings/'+pid+'?return=vent');await p.locator('#projectTerrain').selectOption('city');await p.locator('#projectShelter').selectOption('sheltered');
 await p.locator('#sharedNorth').fill('35');await p.getByRole('button',{name:'Save shared conditions',exact:true}).click();
 console.log('Exposure saved');
 await p.locator('#projectEpw').setInputFiles({name:'qa.epw',mimeType:'text/plain',buffer:epw()});await p.locator('#projectClimateStatus').filter({hasText:'8760 hours'}).waitFor();
 const saved=await p.evaluate(async pid=>{const S=await import('./js/store.js');return S.clone(S.conditionsOf(S.project(pid)));},pid);assert.equal(saved.site.terrain,'city');assert.equal(saved.site.shelter,'sheltered');assert.equal(saved.site.north,35);assert(saved.site.climate.hash);
 await p.locator('#sharedLabel').fill('Climate QA');await p.getByRole('button',{name:'Save shared conditions',exact:true}).click();
 assert.equal(await p.evaluate(async pid=>(await import('./js/store.js')).conditionsOf((await import('./js/store.js')).project(pid)).site.climate.hash,pid),saved.site.climate.hash,'Editing site must preserve shared climate');
 await p.locator('#projectEpw').setInputFiles({name:'bad.epw',mimeType:'text/plain',buffer:Buffer.from('invalid')});await p.locator('#projectClimateStatus').filter({hasText:'complete hourly EPW'}).waitFor();
 console.log('Project EPW saved and invalid replacement rejected');
 await p.goto(base+'/mvp/#/simulations/vent');let f=p.frameLocator('#eng');await f.locator('#projectClimateSummary').filter({hasText:'qa.epw'}).waitFor({state:'attached',timeout:90000});console.log('Ventilation EPW loaded');
 const actual=await p.evaluate(()=>{const w=document.querySelector('#eng').contentWindow;return {north:w.__vent.S.north,terrain:w.__vent.S.terrain,shelter:w.__vent.S.shelter,hours:w.__vent.EPW.rows.length};});assert.deepEqual(actual,{north:35,terrain:'city',shelter:'sheltered',hours:8760});assert.equal(await f.locator('#wxMore').isVisible(),false);assert(await f.locator('#north').isDisabled());assert.equal(await f.locator('#floorZ').count(),1);
 await f.locator('#panelL [role=tab]').getByText('Airflow',{exact:true}).click();await f.locator('#resBar [data-res=draft]').click();await f.locator('#run').click();
 await p.waitForFunction(()=>{const s=document.querySelector('#eng').contentWindow.__vent;return s.FLOW.done&&!s.FLOW.busy;},null,{timeout:90000});await p.locator('#save:not([disabled])').click();
 const archived=await p.evaluate(async pid=>{const S=await import('./js/store.js');return S.project(pid).runs.filter(r=>r.simId==='vent').at(-1);},pid);assert.equal(archived.settings.sharedConditions.site.climate.hash,saved.site.climate.hash);assert.equal(archived.settings.sharedConditions.effective.north,35);assert(archived.results.kpis.some(([,v])=>/\d/.test(v)));
 await p.reload();f=p.frameLocator('#eng');await f.locator('#projectClimateSummary').filter({hasText:'qa.epw'}).waitFor({state:'attached',timeout:90000});
 await p.goto(base+'/mvp/#/simulations/daylight');f=p.frameLocator('#eng');await f.locator('#projectClimateSummary').filter({hasText:'qa.epw'}).waitFor({state:'attached',timeout:90000});assert.match(await f.locator('#epwInfo').textContent(),/QA Station/);assert.equal(await f.locator('#pilotOverrideEnabled').isChecked(),false,'Shared EPW is not a study-only override');
 const snapshot=await p.evaluate(async pid=>{const S=await import('./js/store.js'),pr=S.project(pid),run={simId:'vent',settings:{sharedConditions:{signature:S.conditionsSignature(pr,'vent')}}};S.updateConditions(pr,{...S.conditionsOf(pr).site,north:45},S.conditionsOf(pr).defaults);return S.runConditionsStatus(pr,run);},pid);assert.match(snapshot,/rerun/);
 await p.evaluate(async pid=>{const S=await import('./js/store.js'),pr=S.project(pid),c=S.conditionsOf(pr);S.updateConditions(pr,{...c.site,climate:{...c.site.climate,hash:'missing-file'}},c.defaults);},pid);
 await p.goto(base+'/mvp/#/simulations/vent');f=p.frameLocator('#eng');await f.locator('#projectClimateSummary').filter({hasText:'missing from this browser'}).waitFor({state:'attached',timeout:90000});assert(await f.locator('#run').isDisabled(),'Missing shared file must not silently substitute weather');
 assert.deepEqual(errors,[]);console.log('PASS project climate: validated upload, persistent contents, project isolation, exposure/north inheritance, Ventilation + Daylight reuse, no false override, stale signature');
 }finally{await browser.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
