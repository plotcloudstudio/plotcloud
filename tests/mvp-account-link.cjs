// the parametric link: Account → every simulation of a following project, overrides recorded with the result
const {chromium}=require('playwright');
const ok=(c,m)=>{console.log((c?'PASS ':'FAIL ')+m);if(!c)process.exitCode=1;};
(async()=>{const b=await chromium.launch({args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});const p=await (await b.newContext({viewport:{width:1440,height:900}})).newPage();
const errs=[];p.on('pageerror',e=>errs.push(e.message));const B=(process.env.TEST_BASE||'http://127.0.0.1:8765')+'/mvp/';
await p.goto(B);await p.evaluate(()=>localStorage.clear());await p.goto(B+'#/');await p.waitForTimeout(800);
// Workspace → Simulate on v1 → Daylight
await p.goto(B+'#/workspace');await p.waitForTimeout(2500);
await p.evaluate(()=>{const a=[...document.querySelectorAll('[data-simv]')].at(-1);a.click();});await p.waitForTimeout(800);
ok(/#\/simulations$/.test(await p.evaluate(()=>location.hash)),'Workspace "Simulate" on a version opens Simulations');
await p.evaluate(()=>document.querySelector('a[href="#/simulations/daylight"]').click());await p.waitForTimeout(9000);
const ver=await p.evaluate(()=>document.getElementById('ver').selectedOptions[0].textContent);ok(/^v1/.test(ver),'the chosen version arrives: '+ver);
const chip1=await p.evaluate(()=>document.querySelector('.shsite').textContent);console.log('  chip:',chip1);
ok(/Work plane 0.8 m/.test(chip1)&&/Occupied from 8:00/.test(chip1),'the bar shows the Account values this simulation uses');
const F=()=>p.frames().filter(f=>/daylight\.html/.test(f.url())).at(-1);
ok(await F().evaluate(()=>[document.getElementById('wp').value,document.getElementById('lat').value].join())==='0.8,49.2827','engine inputs filled from Account');
// change Account: a new site (Tokyo) and new defaults
await p.evaluate(async()=>{const S=await import('./js/store.js');const A=S.account();A.site={label:'Shibuya, Tokyo, Japan',lat:35.6582,lon:139.7007,north:15,tz:'Asia/Tokyo',wind:3.1,windDir:'S',rain:1583,elev:38,year:2025};A.defaults.plane=0.75;A.defaults.period='Summer solstice';A.defaults.band='1 kHz';S.save();});
await p.goto(B+'#/simulations');await p.goto(B+'#/simulations/daylight');await p.waitForTimeout(9000);
const chip2=await p.evaluate(()=>document.querySelector('.shsite').textContent);console.log('  chip:',chip2);
ok(/Tokyo/.test(chip2)&&/north 15°/.test(chip2)&&/UTC\+9/.test(chip2)&&/Work plane 0.75 m/.test(chip2),'a new Account site and default reach the simulation');
ok(await F().evaluate(()=>[document.getElementById('wp').value,document.getElementById('lat').value,document.getElementById('north').value,document.getElementById('tz').value].join())==='0.75,35.6582,15,9','engine inputs follow the new Account values');
// a value changed in the engine is recorded with the result
await F().evaluate(()=>{const e=document.getElementById('wp');e.value='0.9';e.dispatchEvent(new Event('change',{bubbles:true}));[...document.querySelectorAll('.go')].find(b=>b.offsetParent).click();});await p.waitForTimeout(8000);
await p.click('#save');await p.waitForTimeout(1000);
const st=await p.evaluate(()=>{const db=JSON.parse(localStorage.getItem('pc-mvp-v1'));return db.projects[0].runs.filter(r=>r.simId==='daylight').at(-1)?.settings;});console.log('  settings:',JSON.stringify(st));
ok(st&&st['Work plane']==='0.75 m'&&/Work plane 0.9 m \(Account 0.75 m\)/.test(st['changed here']||''),'the run records the Account values and what was changed here');
// Sun hours period, Acoustics band, Structure location
await p.goto(B+'#/simulations/sunhours');await p.waitForTimeout(10000);
ok(await p.evaluate(()=>document.getElementById('eng').contentDocument.querySelector('#daySeg [aria-pressed="true"]')?.dataset.d)==='06-21','Sun study period (Summer solstice) → Sun hours Jun 21');
await p.goto(B+'#/simulations/acoustics');await p.waitForTimeout(9000);
ok(await p.evaluate(()=>document.getElementById('eng').contentDocument.getElementById('band').selectedOptions[0].textContent)==='1 kHz','Acoustic band (1 kHz) → Indoor acoustics');
await p.goto(B+'#/simulations/structure');await p.waitForTimeout(6000);
ok(await p.evaluate(()=>document.getElementById('eng').contentDocument.getElementById('q-loc').value)==='custom','Tokyo is far from the NBC locations → "anywhere else"');
// a project that keeps its own site does not follow
await p.evaluate(async()=>{const S=await import('./js/store.js');const pr=S.projects()[0];S.linkSite(pr,false);const A=S.account();A.site={...A.site,label:'Paris, France',lat:48.8566,lon:2.3522,tz:'Europe/Paris'};A.user={name:'Test',email:'t@example.com'};S.save();});
await p.goto(B+'#/simulations');await p.goto(B+'#/simulations/daylight');await p.waitForTimeout(9000);
ok(/Tokyo/.test(await p.evaluate(()=>document.querySelector('.shsite').textContent)),'an unlinked project keeps its own site (Tokyo), not the new Account site (Paris)');
await p.goto(B+'#/account');await p.waitForTimeout(1500);
ok(await p.evaluate(()=>document.querySelector('[data-link]')&&!document.querySelector('[data-link]').checked),'Account shows the project as not following');

console.log('ERR',errs.join(' | '));await b.close();})();
