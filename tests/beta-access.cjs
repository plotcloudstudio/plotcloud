const assert = require('node:assert/strict');
const fs = require('node:fs');
const crypto = require('node:crypto');
const {chromium}=require('playwright');
(async()=>{
 const {issueGrant,addCalendarMonth}=await import('../tools/issue-beta-access.mjs');
 assert.equal(addCalendarMonth('2026-01-31T12:00:00Z').toISOString(),'2026-02-28T12:00:00.000Z');
 assert.equal(addCalendarMonth('2028-01-31T12:00:00Z').toISOString(),'2028-02-29T12:00:00.000Z');
 const {code,grant}=issueGrant({reference:'TEST_PRIVATE_ONLY',start:new Date(Date.now()-60000)});
 assert.equal(grant.codeHash,crypto.createHash('sha256').update(code).digest('hex'));
 assert(!JSON.stringify(grant).includes(code));
 const access=await import('data:text/javascript;base64,'+Buffer.from(fs.readFileSync('mvp/js/beta-access.js','utf8').replace("import * as Cloud from './cloud.js';","const Cloud={configured:()=>false};")).toString('base64'));
 assert(access.matchingGrant({schema:1,grants:[grant]},grant.codeHash));
 for(const override of [{revokedAt:new Date().toISOString()},{expiresAt:'2020-01-01'},{startsAt:'2099-01-01'},{plan:'other'}]) assert.equal(access.matchingGrant({schema:1,grants:[{...grant,...override}]},grant.codeHash),null);
 console.log('PASS issuer, calendar month, expired/future/revoked/wrong-plan grants');
 const browser=await chromium.launch({executablePath:'/usr/bin/chromium',args:['--no-sandbox','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
 try{
 const context=await browser.newContext({viewport:{width:1440,height:1000}}),page=await context.newPage();
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 // Exercise the legacy, unconfigured code flow independently of production account configuration.
 await context.route('**/js/backend-config.js*',r=>r.fulfill({contentType:'text/javascript',body:"export const SUPABASE_URL='';export const SUPABASE_ANON_KEY='';"}));
 await context.route('https://cdn.jsdelivr.net/npm/three@*/**',r=>{const part=r.request().url().split('/examples/jsm/')[1],file=part?'/workspace/plotcloud/furniture/addons/'+part:'/workspace/plotcloud/furniture/three.module.min.js';return fs.existsSync(file)?r.fulfill({path:file,contentType:'text/javascript'}):r.continue();});
 let grants=[];
 await context.route('**/beta-access-ledger.json?*',r=>r.fulfill({json:{schema:1,grants}}));
 const base=process.env.TEST_BASE||'http://127.0.0.1:8781';
 const go=async hash=>{await page.goto(base+'/mvp/'+hash);await page.waitForTimeout(600);};
 await go('#/pricing'); await page.locator('h1').filter({hasText:'A stronger design report.'}).waitFor();
 let text=await page.locator('#app').innerText();assert(text.includes('CAD 16.99'));assert(text.includes('plotcloud@gmail.com'));assert(!/annual|yearly|7.day trial|79\s*\/\s*yr/i.test(text));
 const mail=await page.locator('a').filter({hasText:'Request monthly access'}).getAttribute('href');assert(mail.startsWith('mailto:plotcloud@gmail.com?'));assert(decodeURIComponent(mail).includes('Before I send'));
 await page.locator('input[name="code"]').fill('INVALID');await page.locator('button[type="submit"]').click();await page.getByText('This code is invalid, not yet active, expired or revoked.',{exact:false}).waitFor();
 await page.evaluate(()=>localStorage.setItem('pc-plan','pro'));
 await go('#/simulations/wind');assert((await page.locator('#app').innerText()).includes('needs'));assert.equal(await page.locator('#eng').count(),0);
 await go('#/resources/tool/scale');assert((await page.locator('#app').innerText()).includes('needs'));
 console.log('PASS monthly Pricing, email-first request, invalid code, unpaid study/resource gates');
 for(const id of ['sunhours','daylight']){await go('#/simulations/'+id);assert(!(await page.locator('#app').innerText()).includes('needs\nan active month.'));assert.equal(await page.evaluate(id=>PlotCloudBetaAccess.allows(id),id),true);}
 await page.goto(base+'/emb/wind.html');await page.waitForURL('**/mvp/index.html#/simulations/wind');await page.getByText('Paid beta access',{exact:true}).waitFor();
 console.log('PASS two free studies and direct paid engine redirect');
 grants=[grant];await go('#/pricing');await page.locator('input[name="code"]').fill(code);await page.locator('button[type="submit"]').click();await page.getByText('Monthly beta access activated',{exact:true}).waitFor();assert(await page.evaluate(()=>PlotCloudBetaAccess.status().active));
 await go('#/simulations/wind');assert.equal(await page.locator('#eng').count(),1);
 await go('#/resources/tool/scale');assert.equal(await page.getByText('Paid beta access',{exact:true}).count(),0);
 grants=[{...grant,revokedAt:new Date().toISOString()}];assert.equal(await page.evaluate(async()=>{const m=await import('./js/beta-access.js');return(await m.checkAccess({force:true})).active;}),false);
 await go('#/simulations/wind');assert.equal(await page.locator('#eng').count(),0);
 console.log('PASS valid activation, paid engine/resource entry and revocation');
 await go('#/pricing');fs.mkdirSync('/workspace/artifacts',{recursive:true});await page.screenshot({path:'/workspace/artifacts/pricing-beta-desktop.png',fullPage:true});
 await page.setViewportSize({width:390,height:844});await page.screenshot({path:'/workspace/artifacts/pricing-beta-mobile.png',fullPage:true});assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
 for(const path of ['terms','privacy','refunds']){await go('#/legal/'+path);const t=await page.locator('#app').innerText();assert(t.includes('plotcloud@gmail.com'));assert(!t.includes('{{ADDRESS}}'));}
 assert.deepEqual(errors,[]);assert.deepEqual(JSON.parse(fs.readFileSync('mvp/beta-access-ledger.json','utf8')).grants,[]);
 console.log('PASS responsive Pricing, policies, no page errors, production ledger empty');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exit(1)});
