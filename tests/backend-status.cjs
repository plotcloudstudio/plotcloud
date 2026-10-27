const fs=require('node:fs'),assert=require('node:assert/strict');
(async()=>{
 const {probeBackend}=await import('data:text/javascript;base64,'+Buffer.from(fs.readFileSync('mvp/js/backend-status.js','utf8')).toString('base64'));
 const config={url:'https://backend.test.invalid',key:'public-test-key'},calls=[];
 const fetcher=async(url,options)=>{calls.push({url,options});if(url.endsWith('/settings'))return Response.json({external:{email:true}});return Response.json({code:'42501'},{status:401});};
 const ready=await probeBackend(config,{fetcher});assert(ready.ok);assert.equal(calls.length,3);assert(calls.every(c=>c.options.method==='GET'&&c.options.headers.apikey===config.key&&!c.options.headers.Authorization));assert(calls.find(c=>c.url.includes('cloud_projects')).url.endsWith('limit=0'));
 const missing=await probeBackend(config,{fetcher:async url=>url.endsWith('/settings')?Response.json({external:{email:true}}):Response.json({code:'PGRST202'},{status:404})});assert(!missing.ok);assert(missing.checks.filter(c=>c.id!=='auth').every(c=>c.detail.includes('setup is incomplete')));
 const publicRpc=await probeBackend(config,{fetcher:async url=>url.endsWith('/settings')?Response.json({}):url.includes('/rpc/')?Response.json(false):Response.json([])});assert(!publicRpc.ok);assert(publicRpc.checks.find(c=>c.id==='memberships').detail.includes('anonymous execution'));
 const invalid=await probeBackend(config,{fetcher:async()=>Response.json({message:'Invalid API key'},{status:401})});assert(!invalid.ok);assert(invalid.checks.every(c=>c.state==='error'));
 const offline=await probeBackend(config,{fetcher:async()=>{throw Error('Network blocked');}});assert(!offline.ok);assert(offline.checks.every(c=>c.detail.includes('Could not reach')));
 console.log('PASS read-only backend checks, schema missing, anonymous permissions, invalid key and network failures; no administrator authority inferred');
})();
