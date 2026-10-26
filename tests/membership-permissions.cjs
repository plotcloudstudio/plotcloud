const {PGlite}=require('@electric-sql/pglite');const fs=require('node:fs');const assert=require('node:assert/strict');
(async()=>{const db=new PGlite();try{
await db.exec(`create role anon;create role authenticated;create schema auth;create table auth.users(id uuid primary key,email text,raw_user_meta_data jsonb default '{}',created_at timestamptz default now(),email_confirmed_at timestamptz);create function auth.uid() returns uuid language sql as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;grant usage on schema auth to authenticated;grant execute on function auth.uid() to authenticated;`);
const migration=fs.readFileSync('supabase/migrations/20261026000000_memberships.sql','utf8');await db.exec(migration);await db.exec(migration);
const admin='11111111-1111-4111-8111-111111111111',user='22222222-2222-4222-8222-222222222222',other='33333333-3333-4333-8333-333333333333',unconfirmed='44444444-4444-4444-8444-444444444444';
for(const[id,email,name,confirmed]of[[admin,'owner@test.invalid','Owner',true],[user,'customer@test.invalid','Student',true],[other,'other@test.invalid','Another Student',true],[unconfirmed,'pending@test.invalid','Pending',false]])await db.query("insert into auth.users(id,email,raw_user_meta_data,email_confirmed_at)values($1,$2,$3,$4)",[id,email,JSON.stringify({name,admin:true}),confirmed?new Date():null]);
await db.query('insert into private.pc_admins(user_id)values($1)',[admin]);
async function as(id,sql,args=[]){await db.exec('set role authenticated');await db.query("select set_config('request.jwt.claim.sub',$1,false)",[id]);try{return(await db.query(sql,args)).rows;}finally{await db.exec('reset role');}}
const rpc=(id,sql,args)=>as(id,sql,args).then(rows=>rows[0].v);
assert.equal(await rpc(user,'select public.pc_is_admin() as v'),false);assert.equal(await rpc(admin,'select public.pc_is_admin() as v'),true);
await assert.rejects(()=>rpc(user,"select public.pc_admin_search('',0) as v"),/Administrator/);await assert.rejects(()=>as(user,'select * from private.pc_memberships'),/permission denied/);
await assert.rejects(()=>rpc(user,"select public.pc_admin_access($1,'grant','fake-payment',$2) as v",[user,crypto.randomUUID()]),/Administrator/);console.log('PASS non-admin cannot search users, grant themselves access or read private tables; user metadata is ignored');
let list=await rpc(admin,"select public.pc_admin_search('student',0) as v");assert.equal(list.length,2);assert(list.every(x=>x.email));assert.equal((await rpc(admin,"select public.pc_admin_search('%',0) as v")).length,0);
const request=crypto.randomUUID(),args=[user,'grant','ORDER_TEST',request],grantSql='select public.pc_admin_access($1,$2,$3,$4) as v';const g=await rpc(admin,grantSql,args),again=await rpc(admin,grantSql,args);assert.equal(g.expiresAt,again.expiresAt);assert(again.repeated);await assert.rejects(()=>rpc(admin,grantSql,[user,'extend','ORDER_TEST',crypto.randomUUID()]),/already used/);
assert((await rpc(user,'select public.pc_access_status() as v')).active);assert(!(await rpc(other,'select public.pc_access_status() as v')).active);
await assert.rejects(()=>rpc(admin,grantSql,[user,'grant','DUPLICATE',crypto.randomUUID()]),/already active/);
const extension=await rpc(admin,grantSql,[user,'extend','RENEW_TEST',crypto.randomUUID()]);assert(Date.parse(extension.expiresAt)>Date.parse(g.expiresAt));
await assert.rejects(()=>rpc(admin,grantSql,[unconfirmed,'grant','NOT_CONFIRMED',crypto.randomUUID()]),/confirm/);
console.log('PASS search by name/email, literal wildcard handling, grant, idempotency, extension and confirmed email requirement');
await rpc(admin,grantSql,[user,'revoke','REFUND_TEST',crypto.randomUUID()]);assert(!(await rpc(user,'select public.pc_access_status() as v')).active);
await db.query("update private.pc_memberships set starts_at='2020-01-01',expires_at='2020-02-01',revoked_at=null where user_id=$1",[user]);assert(!(await rpc(user,'select public.pc_access_status() as v')).active);
await db.query("update private.pc_memberships set starts_at='2099-01-01',expires_at='2099-02-01' where user_id=$1",[user]);assert(!(await rpc(user,'select public.pc_access_status() as v')).active);
assert.equal((await rpc(admin,'select public.pc_admin_history($1) as v',[user])).length,3);await assert.rejects(()=>rpc(other,'select public.pc_admin_history($1) as v',[user]),/Administrator/);
assert.equal((await db.query("select ('2026-01-31 12:00Z'::timestamptz+interval '1 month')::text as v")).rows[0].v.slice(0,10),'2026-02-28');
await db.exec('set role anon');await assert.rejects(()=>db.query('select public.pc_admin_search()'),/permission denied/);await db.exec('reset role');
console.log('PASS server-time expiry, future start, revocation, audit privacy, month-end clamp and anonymous denial');
}finally{await db.close();}})().catch(e=>{console.error(e);process.exit(1)});
