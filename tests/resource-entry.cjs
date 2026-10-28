const assert=require('node:assert/strict'),{chromium}=require('playwright');
const {resourceAccessFixture,cacheCDN}=require('./resource-access-fixture.cjs');
const base=process.env.TEST_BASE||'http://127.0.0.1:8790';
const ids=['furniture','facade','detaillab','topo','stairs3d','doors3d'];
(async()=>{
 const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||undefined,args:['--no-sandbox','--enable-unsafe-swiftshader']});
 try{
  const guest=await browser.newContext();await cacheCDN(guest);const page=await guest.newPage(),errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  for(const id of ids){
   await page.goto(base+'/emb/'+id+'.html');await page.waitForURL('**/mvp/index.html#/resources/tool/'+id);
   await page.getByText('Paid beta access',{exact:true}).waitFor();
   assert.equal(await page.locator('#resourceEngine').count(),0);
   assert((await page.locator('.lede').innerText()).includes('All simulation studies are currently free'));
   await page.locator('#app a[href="#/resources"]').click();await page.locator('.resource-tools').first().waitFor();
  }
  assert.deepEqual(errors,[]);await guest.close();console.log('PASS all six guest legacy entries preserve the requested tool, show clear access requirements and return to Resources');
  const member=await browser.newContext(),state=await resourceAccessFixture(member);await cacheCDN(member);const p=await member.newPage();
  for(const id of ids){
   await p.goto(base+'/mvp/#/resources/tool/'+id);const f=p.frameLocator('#resourceEngine');
   await f.locator('[data-pc-surface=tool]').waitFor();assert.equal(await p.getByText('Paid beta access',{exact:true}).count(),0);
  }
  state.active=false;await p.reload();await p.getByText('Paid beta access',{exact:true}).waitFor();assert.equal(await p.locator('#resourceEngine').count(),0);
  state.unavailable=true;await p.locator('#betaRecheck').click();await p.getByText('Access verification is temporarily unavailable.',{exact:false}).waitFor();
  state.unavailable=false;state.active=true;await p.locator('#betaRecheck').click();await p.frameLocator('#resourceEngine').locator('[data-pc-surface=tool]').waitFor();
  console.log('PASS all six verified member engines load; revoked access stays blocked; verification failures and retry recover without another payment');
 }finally{await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
