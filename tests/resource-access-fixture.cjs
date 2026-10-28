// Browser-only mocked membership. No production entitlement or real account is created.
const fs=require('node:fs'),crypto=require('node:crypto'),{execFileSync}=require('node:child_process');
async function resourceAccessFixture(context){
 const state={active:true,unavailable:false};
 await context.addInitScript(()=>{
  localStorage.setItem('pc-cloud-config',JSON.stringify({url:'https://resource-access.test.invalid',key:'public-test-key'}));
  localStorage.setItem('pc-cloud-session',JSON.stringify({access_token:'browser-test-only',expires_at:Math.floor(Date.now()/1000)+3600,user:{id:'22222222-2222-4222-8222-222222222222',email:'resource-test@example.invalid',name:'Resource Test'}}));
 });
 await context.route('https://resource-access.test.invalid/**',async route=>{
  const path=new URL(route.request().url()).pathname;
  if(path.endsWith('/pc_access_status')){
   if(state.unavailable)return route.fulfill({status:503,json:{message:'Test verification service unavailable'}});
   return route.fulfill({json:{active:state.active,serverNow:new Date().toISOString(),startsAt:new Date(Date.now()-60000).toISOString(),expiresAt:new Date(Date.now()+3600000).toISOString(),accessType:'month'}});
  }
  return route.fulfill({json:path.endsWith('/pc_is_admin')?false:[]});
 });
 return state;
}
async function cacheCDN(context){
 await context.route('https://cdn.jsdelivr.net/**',async route=>{
  const url=route.request().url(),file='/tmp/pc-cdn-'+crypto.createHash('sha256').update(url).digest('hex')+'.js';
  try{
   if(!fs.existsSync(file))execFileSync('curl',['--fail','--silent','--show-error',url,'-o',file],{timeout:45000});
   await route.fulfill({path:file,contentType:url.split('?')[0].endsWith('.wasm')?'application/wasm':'text/javascript'});
  }catch{await route.abort();}
 });
}
module.exports={resourceAccessFixture,cacheCDN};
