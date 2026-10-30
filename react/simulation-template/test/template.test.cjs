// Browser test of the unified template with a recording renderer (test double, draws no result). Run: npm test
const assert=require('node:assert/strict'),{chromium}=require('playwright');
(async()=>{const b=await chromium.launch();const ctx=await b.newContext({acceptDownloads:true,viewport:{width:1440,height:900}}),p=await ctx.newPage(),errs=[];p.on('pageerror',e=>errs.push(e.message));p.on('console',m=>{if(m.type()==='error')errs.push(m.text())});
await p.goto('http://127.0.0.1:'+(process.env.PORT||8799)+'/');await p.getByRole('toolbar',{name:'View controls'}).waitFor();
// 1 local parameters only; global keys passed in are dropped
const labels=await p.locator('aside label').allInnerTexts();assert.ok(labels.some(l=>/Tilt angle/.test(l))&&labels.some(l=>/Azimuth angle/.test(l))&&labels.some(l=>/Grid size/.test(l))&&labels.some(l=>/Exposure threshold/.test(l)));
const names=await p.locator('aside label > span:first-child').allInnerTexts();assert.ok(!names.some(l=>/latitude|true north|EPW|weather file|inherit|override/i.test(l)),'no global parameters in the panel: '+names);assert.equal(await p.locator('aside').getByText(/inherited|override/i).count(),0);
const st=await p.evaluate(()=>window.store.getState().params.sunhours);assert.equal(st.gridSize,2);assert.equal(st.lat,undefined);assert.equal(st.north,undefined);
await p.evaluate(()=>window.store.getState().setParam('sunhours','north',30));assert.equal(await p.evaluate(()=>window.store.getState().params.sunhours.north),undefined,'global key cannot be set on a study');
console.log('PASS local-only parameters; global keys rejected');
// 2 view toggle drives a smooth camera transition
await p.getByRole('button',{name:'Plan View'}).click();await p.getByRole('button',{name:'3D View'}).click();
const views=await p.evaluate(()=>calls.filter(c=>c[0]==='setView').map(c=>c.slice(1).join(':')));assert.ok(views.includes('plan:600')&&views.at(-1)==='3d:600');
assert.equal(await p.getByRole('button',{name:'3D View'}).getAttribute('aria-pressed'),'true');console.log('PASS Plan/3D toggle →',views.join(' '));
// 3 play advances the timeline and the renderer time; pause stops it
const t0=await p.evaluate(()=>window.store.getState().timeFor('sunhours'));await p.getByRole('button',{name:'Play animation'}).click();await p.waitForTimeout(1300);await p.getByRole('button',{name:'Pause animation'}).click();
const t1=await p.evaluate(()=>window.store.getState().timeFor('sunhours'));assert.ok(t1>t0,'time advanced '+t0+'→'+t1);await p.waitForTimeout(900);assert.equal(await p.evaluate(()=>window.store.getState().timeFor('sunhours')),t1,'paused');
assert.ok(await p.evaluate(()=>calls.some(c=>c[0]==='setTime'&&c[1]==='hour')));console.log('PASS animation',t0,'→',t1,'output',await p.locator('output').innerText());
// slider sets time
await p.getByRole('slider',{name:'Sun position'}).fill('12');assert.equal(await p.evaluate(()=>window.store.getState().timeFor('sunhours')),12);
// 4 parameter edit is clamped and reaches the renderer
await p.locator('#sunhours-tiltAngle').fill('120');await p.waitForTimeout(100);assert.equal(await p.evaluate(()=>window.store.getState().params.sunhours.tiltAngle),90);
assert.ok(await p.evaluate(()=>calls.some(c=>c[0]==='setParams'&&c[2].tiltAngle===90)));console.log('PASS parameter clamped to 90° and sent to renderer');
// 5 export image downloads a PNG
const [dl]=await Promise.all([p.waitForEvent('download'),p.getByRole('button',{name:'Export Image'}).click()]);assert.match(dl.suggestedFilename(),/^plotcloud-sunhours-3d-12\.png$/);console.log('PASS export',dl.suggestedFilename());
// 6 style + legend + empty state
assert.ok(await p.evaluate(()=>calls.some(c=>c[0]==='setStyle'&&c[1]===0.35&&c[2]==='sun')));assert.match(await p.getByTestId('legend').innerText(),/Direct sun \(h\)/);assert.match(await p.locator('[data-view]').innerText(),/No result yet/);
await p.screenshot({path:(process.argv[2]||require('os').tmpdir())+'/template-sunhours.png'});
// 7 every study renders with the same layout; studies without a time axis disable play
const out=[];for(const id of await p.evaluate(()=>STUDY_IDS)){await p.evaluate(id=>setSim(id),id);await p.waitForTimeout(60);const n=await p.locator('aside input,aside select').count(),play=await p.getByRole('button',{name:/Play animation|Pause animation/}).isDisabled(),tb=await p.getByRole('toolbar',{name:'View controls'}).count(),lg=await p.getByTestId('legend').count();assert.equal(tb,1);assert.equal(lg,1);assert.ok(n>0,id);out.push(id+':'+n+(play?'(no anim)':''));}
console.log('PASS',out.length,'studies:',out.join(' '));await p.evaluate(()=>setSim('daylight'));await p.waitForTimeout(100);await p.screenshot({path:(process.argv[2]||require('os').tmpdir())+'/template-daylight.png'});
await p.getByRole('button',{name:'Collapse parameters'}).click();assert.equal(await p.locator('aside input').count(),0);await p.getByRole('button',{name:'Expand parameters'}).click();
assert.deepEqual(errs,[]);console.log('no errors');await b.close();})().catch(e=>{console.error(e);process.exit(1)});
