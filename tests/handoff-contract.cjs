const assert=require('node:assert/strict'),fs=require('node:fs');
const uri=text=>'data:text/javascript;base64,'+Buffer.from(text).toString('base64');
(async()=>{
 const memory=new Map();global.localStorage={getItem:k=>memory.get(k)||null,setItem:(k,v)=>memory.set(k,String(v)),removeItem:k=>memory.delete(k)};
 const data=uri(fs.readFileSync('mvp/js/data.js','utf8')),store=uri(fs.readFileSync('mvp/js/store.js','utf8').replace("'./data.js'",JSON.stringify(data))),S=await import(store);
 const H=await import(uri(fs.readFileSync('mvp/js/handoff.js','utf8').replace("'./store.js'",JSON.stringify(store))));
 const model={units:'m',studio:{levels:[{id:'L1'}]},components:[],layers:[]},p=S.createProject('Handoff acceptance',model),v=S.saveVersion(p,'Source');
 assert.equal(H.baselineConfirmed(p),false);p.baselineReview={signature:H.baselineSignature(p),confirmedAt:'reviewed'};assert(H.baselineConfirmed(p));
 const checks=[{state:'ok',title:'Native dimensions checked'}],h=H.createHandoff(p,v,'sunhours',checks);p.handoffs=[h];checks[0].title='edited';assert.equal(h.geometry.checks[0].title,'Native dimensions checked');
 p.activeStudyConfiguration={sunhours:'Winter 09–15'};const run=S.addRun(p,v.id,'sunhours',{grid:1},{kpis:[['Sun hours','3.5 h']]});assert(run.settings.handoff);assert.equal(run.settings.configurationName,'Winter 09–15');const frozen=JSON.stringify(run);
 const c=S.conditionsOf(p);S.updateConditions(p,{...c.site,north:15},{...c.defaults,buildingType:'Office'});assert(!H.baselineConfirmed(p));assert.match(S.runConditionsStatus(p,run),/baseline changed/);assert.equal(JSON.stringify(run),frozen,'Changing baseline must not rewrite saved results');
 const v2=S.saveVersion(p,'Updated model');assert.match(S.runConditionsStatus(p,run),/model is now v2/);assert.equal(v2.n,2);assert.match(H.assumptionsHTML(p,run),/Workbench/);assert.match(H.assumptionsHTML(p,run),/This simulation/);assert.equal(H.baselineRows(p,model).find(([key])=>key==='Building type')[1],'Office');
 assert.match(H.weatherLabel({climate:{name:'Station.epw',automatic:true,period:'2004–2018',hash:'sha'}}),/automatically matched/);
 assert.match(H.weatherLabel({}),/No EPW matched/);
 console.log('PASS confirmation invalidation, immutable handoffs/results, weather provenance, named configurations, model staleness and assumption sources');
})().catch(e=>{console.error(e);process.exit(1)});
