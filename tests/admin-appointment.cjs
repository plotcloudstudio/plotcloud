const fs=require('node:fs'),assert=require('node:assert/strict'),{PGlite}=require('@electric-sql/pglite');
(async()=>{const db=new PGlite();try{
 await db.exec("create role anon;create role authenticated;create schema auth;create table auth.users(id uuid primary key,email text,raw_user_meta_data jsonb default '{}',created_at timestamptz default now(),email_confirmed_at timestamptz);create function auth.uid() returns uuid language sql as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;grant usage on schema auth to authenticated;grant execute on function auth.uid() to authenticated;");
 await db.exec(fs.readFileSync('supabase/migrations/20261026000000_memberships.sql','utf8'));
 const sql=fs.readFileSync('supabase/appoint-admin.sql','utf8');
 await assert.rejects(()=>db.exec(sql),/confirm its email first/);await db.exec('rollback');
 await db.query("insert into auth.users(id,email)values('11111111-1111-4111-8111-111111111111','plotcloud@gmail.com')");
 await assert.rejects(()=>db.exec(sql),/confirm its email first/);await db.exec('rollback');
 await db.query("update auth.users set email_confirmed_at=now()");
 await db.exec('set role authenticated');await assert.rejects(()=>db.exec(sql),/permission denied/);await db.exec('rollback;reset role');
 await db.exec(sql);await db.exec(sql);assert.equal((await db.query('select count(*)::int as n from private.pc_admins')).rows[0].n,1);
 console.log('PASS owner appointment rejects missing/unconfirmed registrations and ordinary clients; deliberate database-owner assignment is idempotent');
}finally{await db.close();}})().catch(e=>{console.error(e);process.exit(1)});
