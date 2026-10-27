// Public, read-only setup checks. These never register users, send email or appoint administrators.
export async function probeBackend({url,key},{fetcher=fetch}={}){
 const specs=[
  {id:'auth',title:'Account service',path:'/auth/v1/settings'},
  {id:'projects',title:'Project database',path:'/rest/v1/cloud_projects?select=owner&limit=0'},
  {id:'memberships',title:'Membership database',path:'/rest/v1/rpc/pc_is_admin'}
 ];
 const checks=await Promise.all(specs.map(async s=>{
  try{
   const response=await fetcher(url.replace(/\/+$/,'')+s.path,{method:'GET',headers:{apikey:key},cache:'no-store',signal:AbortSignal.timeout(12000)});
   const data=await response.json().catch(()=>null),denied=[401,403].includes(response.status)&&data?.code==='42501';
   if(s.id==='auth'&&response.ok&&data&&typeof data==='object'&&!Array.isArray(data))return{id:s.id,title:s.title,state:'ok',detail:'Supabase Auth is reachable with this public project key.'};
   if(s.id!=='auth'&&denied)return{id:s.id,title:s.title,state:'ok',detail:'Database endpoint found; anonymous access is denied.'};
   if(s.id==='projects'&&response.ok&&Array.isArray(data))return{id:s.id,title:s.title,state:'ok',detail:'Project endpoint found. Signed-in row isolation requires a separate account test.'};
   if(s.id==='memberships'&&response.ok)return{id:s.id,title:s.title,state:'error',detail:'Administrator checks allow anonymous execution. Reapply the membership migration to restore its permission restrictions.'};
   if(response.status===404&&['PGRST202','PGRST205'].includes(data?.code))return{id:s.id,title:s.title,state:'error',detail:'Database setup is incomplete or its schema cache has not refreshed. Run the account and membership migrations in SQL Editor.'};
   if([401,403].includes(response.status))return{id:s.id,title:s.title,state:'error',detail:'The public project key was rejected or the endpoint is restricted. Check the Supabase project configuration.'};
   return{id:s.id,title:s.title,state:'error',detail:`Could not verify this service (HTTP ${response.status}). Check the project status in Supabase.`};
  }catch{return{id:s.id,title:s.title,state:'error',detail:'Could not reach Supabase. Check your connection, browser network restrictions and whether the project is paused.'};}
 }));
 return{url,ok:checks.every(c=>c.state==='ok'),checks};
}
