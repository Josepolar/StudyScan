import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {PGlite} from '@electric-sql/pglite';
const db=new PGlite();
await db.exec(`create role anon;create role authenticated;create role service_role;create schema auth;create table auth.users(id uuid primary key,email text,email_confirmed_at timestamptz,raw_user_meta_data jsonb default '{}');create table auth.identities(user_id uuid,provider text,identity_data jsonb);create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;grant usage on schema auth to authenticated;grant execute on function auth.uid() to authenticated;create schema storage;create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);create table storage.objects(id uuid primary key default gen_random_uuid(),bucket_id text,name text);alter table storage.objects enable row level security;grant usage on schema storage to authenticated;grant select,insert,delete on storage.objects to authenticated;`);
for(const file of ['001_accounts.sql','002_classroom.sql','003_storage_ai.sql','004_classroom_management.sql','005_lesson_loading.sql','006_student_ai_authorization.sql','007_free_ai_allowances.sql','008_assistant_followup.sql','009_school_settings_safe_update.sql','010_teacher_invitations.sql'])await db.exec(await readFile('supabase/'+file,'utf8'));
const ids={};for(const [index,name] of ['owner','teacher','student','wrong','new','suspended'].entries()){
 ids[name]=`00000000-0000-4000-8000-${String(index+1).padStart(12,'0')}`;
 await db.query('insert into auth.users(id,email,email_confirmed_at) values($1,$2,now())',[ids[name],name+'@gmail.com']);
 if(name!=='new')await db.query('insert into public.studyscan_profiles(id,name,email,role,status,is_primary_admin) values($1,$2,$3,$4,$5,$6)',[ids[name],name,name+'@gmail.com',name==='owner'?'super-admin':name==='teacher'?'teacher':'student',name==='suspended'?'suspended':'active',name==='owner']);
}
async function actor(name){await db.exec('reset role');await db.query("select set_config('request.jwt.claim.sub',$1,false)",[ids[name]||'']);await db.exec('set role authenticated');}
async function invitation(action,payload={}){return (await db.query('select public.studyscan_teacher_invitation($1,$2) as value',[action,payload])).rows[0].value;}
async function mutate(action,payload={}){return db.query('select public.studyscan_mutate($1,$2)',[action,payload]);}
async function service(operation,payload,owner=ids.owner){await db.exec('reset role;set role service_role');return (await db.query('select public.studyscan_teacher_invite_delivery($1,$2,$3) as value',[owner,operation,payload])).rows[0].value;}
const token='a'.repeat(64),hash=createHash('sha256').update(token).digest('hex');
await actor('student');await assert.rejects(()=>mutate('requestTeacher',{school:'School',subjects:'Science'}),/invitation only/);await assert.rejects(()=>invitation('list'),/Super Admin/);await assert.rejects(()=>db.query('select * from public.studyscan_teacher_invites'),/permission denied/);await assert.rejects(()=>db.query('select public.studyscan_mutate_before_invitations($1,$2)',['requestTeacher',{}]),/permission denied/);
await assert.rejects(()=>db.query('select public.studyscan_teacher_invite_delivery($1,$2,$3)',[ids.owner,'reserve',{}]),/permission denied/);
await actor('owner');await assert.rejects(()=>mutate('inviteTeacher',{email:'student@gmail.com'}),/invitation only/);await assert.rejects(()=>mutate('setRole',{id:ids.student,role:'teacher'}),/accepted invitation/);
const id=crypto.randomUUID();await service('reserve',{id,email:'student@gmail.com',hash});
await actor('student');await assert.rejects(()=>invitation('inspect',{id,token}),/Google sign-in/);
await db.exec('reset role');for(const name of ['student','wrong','new'])await db.query("insert into auth.identities values($1,'google',$2)",[ids[name],{email:name+'@gmail.com',email_verified:true}]);
await actor('student');await assert.rejects(()=>invitation('accept',{id,token}),/not sent/);
await service('finish',{id,hash,sent:true});await actor('wrong');await assert.rejects(()=>invitation('accept',{id,token}),/received this invitation/);
await actor('student');await assert.rejects(()=>invitation('accept',{id,token:'b'.repeat(64)}),/invalid/);
assert.equal((await invitation('inspect',{id,token})).accepted,false);assert.equal((await db.query('select to_jsonb(public.studyscan_actor()) as value')).rows[0].value.role,'student');
assert.equal((await invitation('accept',{id,token})).accepted,true);assert.equal((await db.query('select to_jsonb(public.studyscan_actor()) as value')).rows[0].value.role,'teacher');assert.equal((await invitation('accept',{id,token})).accepted,true);
await actor('owner');assert.ok(!(await invitation('list'))[0].token_hash);assert.equal((await invitation('list'))[0].status,'accepted');
await assert.rejects(()=>service('reserve',{id:crypto.randomUUID(),email:'teacher@gmail.com',hash}),/staff access/);
await assert.rejects(()=>service('reserve',{id:crypto.randomUUID(),email:'suspended@gmail.com',hash}),/suspended/);
await assert.rejects(()=>service('reserve',{id:crypto.randomUUID(),email:'new@gmail.com',hash},ids.student),/Super Admin/);
// Historical preapproval cannot promote a newly registered teacher automatically.
await db.exec('reset role');await db.query('insert into public.studyscan_teacher_approvals(email,approved_by) values($1,$2)',['new@gmail.com',ids.owner]);await actor('new');assert.equal((await db.query('select to_jsonb(public.studyscan_ensure_profile()) as value')).rows[0].value.role,'student');
let fresh=crypto.randomUUID();await service('reserve',{id:fresh,email:'new@gmail.com',hash});await service('finish',{id:fresh,hash,sent:true});
await assert.rejects(()=>service('reserve',{id:crypto.randomUUID(),email:'new@gmail.com',hash}),/pending invitation/);await assert.rejects(()=>service('reserve',{id:crypto.randomUUID(),email:'new@gmail.com',hash,resend:true}),/one minute/);
await db.exec('reset role');await db.query("update public.studyscan_teacher_invites set attempted=now()-interval '2 minutes' where id=$1",[fresh]);
const token2='c'.repeat(64),hash2=createHash('sha256').update(token2).digest('hex');assert.equal((await service('reserve',{id:crypto.randomUUID(),email:'new@gmail.com',hash:hash2,resend:true})).id,fresh);
await service('finish',{id:fresh,hash,sent:true});await actor('new');await assert.rejects(()=>invitation('accept',{id:fresh,token}),/invalid/);await assert.rejects(()=>invitation('accept',{id:fresh,token:token2}),/not sent/);
await service('finish',{id:fresh,hash:hash2,sent:true});await actor('owner');await invitation('revoke',{id:fresh});await actor('new');await assert.rejects(()=>invitation('accept',{id:fresh,token:token2}),/revoked/);
fresh=crypto.randomUUID();await service('reserve',{id:fresh,email:'new@gmail.com',hash});await service('finish',{id:fresh,hash,sent:true});await db.exec('reset role');await db.query("update public.studyscan_teacher_invites set expires=now()-interval '1 second' where id=$1",[fresh]);await actor('new');await assert.rejects(()=>invitation('accept',{id:fresh,token}),/expired/);
await actor('owner');const state=(await db.query('select public.studyscan_workspace() as value')).rows[0].value;assert.equal('teacherRequests' in state,false);assert.equal(state.user.role,'super-admin');await actor('teacher');assert.equal((await db.query('select to_jsonb(public.studyscan_actor()) as value')).rows[0].value.role,'teacher');
await db.exec('reset role;set role anon');await assert.rejects(()=>invitation('list'),/permission denied/);
await actor('owner');await mutate('setRole',{id:ids.student,role:'student'});await actor('student');await assert.rejects(()=>invitation('accept',{id,token}),/already been used/);
await actor('teacher');assert.equal((await db.query('select to_jsonb(public.studyscan_ensure_profile()) as value')).rows[0].value.role,'teacher');await mutate('class',{name:'Invitation regression class'});
await actor('owner');await mutate('schoolSettings',{name:'School',aiEnabled:false,dailyAiRequests:50,blockedTopics:''});
await db.exec('reset role');await db.query("update public.studyscan_teacher_invites set expires=now()+interval '1 day' where id=$1",[fresh]);await db.query("update public.studyscan_profiles set status='suspended' where id=$1",[ids.owner]);await actor('new');await assert.rejects(()=>invitation('accept',{id:fresh,token}),/administrator no longer has access/);
await db.exec('reset role');await db.query("update public.studyscan_profiles set status='active' where id=$1",[ids.owner]);
const used=Number((await db.query("select count(*) as count from public.studyscan_account_audit where action='sendTeacherInvite'")).rows[0].count);for(let n=used;n<10;n++)await service('reserve',{id:crypto.randomUUID(),email:`quota${n}@gmail.com`,hash});await assert.rejects(()=>service('reserve',{id:crypto.randomUUID(),email:'limit@gmail.com',hash}),/Hourly invitation limit/);
console.log('Teacher invitations verified in PostgreSQL: admin-only sending, blocked legacy elevation/request routes, Google identity/email binding, explicit acceptance, hashed single-use tokens, delivery failure, rotation, cooldown, expiry, revocation, protected existing roles, and private invitation records.');
await db.close();
