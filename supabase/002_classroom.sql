begin;
create table public.studyscan_school(id boolean primary key default true check(id),name text not null default 'StudyScan School',ai_enabled boolean not null default false,blocked_topics text not null default '',monthly_budget_usd numeric(10,2) not null default 0 check(monthly_budget_usd between 0 and 1000));
insert into public.studyscan_school(id) values(true);
create table public.studyscan_classes(id uuid primary key default gen_random_uuid(),teacher uuid not null references public.studyscan_profiles(id),name text not null check(length(name) between 1 and 100),code text not null unique default upper(substr(replace(gen_random_uuid()::text,'-',''),1,10)),archived boolean not null default false,created timestamptz not null default now());
create table public.studyscan_members(classroom uuid not null references public.studyscan_classes(id) on delete cascade,student uuid not null references public.studyscan_profiles(id) on delete cascade,primary key(classroom,student));
create index studyscan_members_student on public.studyscan_members(student,classroom);
create index studyscan_classes_teacher on public.studyscan_classes(teacher) where not archived;
create table public.studyscan_lessons(id uuid primary key default gen_random_uuid(),teacher uuid not null references public.studyscan_profiles(id),title text not null check(length(title) between 1 and 150),subject text not null,topic text not null default '',grade text not null default 'Grade 9',quarter text not null default 'Quarter 1',description text not null default '',content text not null check(length(content) between 1 and 80000),published boolean not null default false,policy jsonb not null default '{}',updated timestamptz not null default now());
create index studyscan_lessons_teacher on public.studyscan_lessons(teacher);
create table public.studyscan_lesson_classes(lesson uuid not null references public.studyscan_lessons(id) on delete cascade,classroom uuid not null references public.studyscan_classes(id) on delete cascade,primary key(lesson,classroom));
create index studyscan_lesson_classes_class on public.studyscan_lesson_classes(classroom,lesson);
create table public.studyscan_lesson_students(lesson uuid not null references public.studyscan_lessons(id) on delete cascade,student uuid not null references public.studyscan_profiles(id) on delete cascade,primary key(lesson,student));
create index studyscan_lesson_students_student on public.studyscan_lesson_students(student,lesson);
create table public.studyscan_assignments(id uuid primary key default gen_random_uuid(),lesson uuid not null references public.studyscan_lessons(id) on delete cascade,title text not null check(length(title) between 1 and 150),instructions text not null default '',due timestamptz,ai_enabled boolean not null default false,created timestamptz not null default now());
create index studyscan_assignments_lesson on public.studyscan_assignments(lesson);
create table public.studyscan_submissions(id uuid primary key default gen_random_uuid(),assignment uuid not null references public.studyscan_assignments(id) on delete cascade,student uuid not null references public.studyscan_profiles(id),body text not null check(length(body) between 1 and 12000),feedback text not null default '',reviewed boolean not null default false,created timestamptz not null default now(),updated timestamptz not null default now(),unique(assignment,student));
create index studyscan_submissions_student on public.studyscan_submissions(student);
create table public.studyscan_interactions(id uuid primary key default gen_random_uuid(),student uuid not null references public.studyscan_profiles(id),lesson uuid not null references public.studyscan_lessons(id) on delete cascade,assignment uuid references public.studyscan_assignments(id) on delete set null,question text not null check(length(question) between 1 and 2000),answer text not null default '',sources jsonb not null default '[]',status text not null default 'pending',flagged boolean not null default false,resolved boolean not null default false,note text not null default '',created timestamptz not null default now());
create index studyscan_interactions_student_created on public.studyscan_interactions(student,created desc);
create index studyscan_interactions_lesson_created on public.studyscan_interactions(lesson,created desc);
create table public.studyscan_progress(student uuid not null references public.studyscan_profiles(id),lesson uuid not null references public.studyscan_lessons(id) on delete cascade,completed boolean not null default false,primary key(student,lesson));
create table public.studyscan_files(id uuid primary key default gen_random_uuid(),lesson uuid not null references public.studyscan_lessons(id) on delete cascade,name text not null,size integer not null check(size between 1 and 10000000),path text not null unique,created timestamptz not null default now());
create index studyscan_files_lesson on public.studyscan_files(lesson);
create table public.studyscan_teacher_requests(id uuid primary key default gen_random_uuid(),account uuid not null unique references public.studyscan_profiles(id),school text not null check(length(school) between 1 and 150),subjects text not null check(length(subjects) between 1 and 300),status text not null default 'pending' check(status in ('pending','approved','rejected')),reason text not null default '',reviewer uuid references public.studyscan_profiles(id),created timestamptz not null default now(),reviewed timestamptz);
create table public.studyscan_ai_usage(id uuid primary key references public.studyscan_interactions(id) on delete cascade,student uuid not null references public.studyscan_profiles(id),reserved_micro_usd integer not null check(reserved_micro_usd>=0),created timestamptz not null default now());
create index studyscan_ai_usage_created on public.studyscan_ai_usage(created);
create index studyscan_ai_usage_student_created on public.studyscan_ai_usage(student,created desc);

create function public.studyscan_actor() returns public.studyscan_profiles language plpgsql stable security definer set search_path='' as $$
declare p public.studyscan_profiles;begin select * into p from public.studyscan_profiles where id=auth.uid() and status='active';if not found then raise exception 'Sign in with an active school account.';end if;return p;end;$$;
create function public.studyscan_can_lesson(target uuid) returns boolean language sql stable security definer set search_path='' as $$
select exists(select 1 from public.studyscan_lessons l join public.studyscan_profiles p on p.id=auth.uid() and p.status='active' where l.id=target and ((p.role='teacher' and l.teacher=p.id) or (p.role='student' and l.published and (exists(select 1 from public.studyscan_lesson_students s where s.lesson=l.id and s.student=p.id) or exists(select 1 from public.studyscan_lesson_classes lc join public.studyscan_classes c on c.id=lc.classroom and not c.archived join public.studyscan_members m on m.classroom=c.id where lc.lesson=l.id and m.student=p.id)))));$$;
revoke all on function public.studyscan_actor(),public.studyscan_can_lesson(uuid) from public,anon;
grant execute on function public.studyscan_actor(),public.studyscan_can_lesson(uuid) to authenticated;

do $$declare t text;begin foreach t in array array['school','classes','members','lessons','lesson_classes','lesson_students','assignments','submissions','interactions','progress','files','teacher_requests','ai_usage'] loop execute format('alter table public.studyscan_%I enable row level security',t);execute format('revoke all on public.studyscan_%I from public,anon,authenticated',t);end loop;end;$$;

create function public.studyscan_workspace() returns jsonb language plpgsql stable security definer set search_path='' as $$
declare p public.studyscan_profiles;result jsonb;ids uuid[];begin
p=public.studyscan_actor();select coalesce(array_agg(id),'{}') into ids from public.studyscan_lessons where public.studyscan_can_lesson(id);
result=jsonb_build_object('user',to_jsonb(p),'aiReady',false,'model','','production',true,
'school',(select jsonb_build_object('name',name,'aiEnabled',ai_enabled) from public.studyscan_school),
'lessons',coalesce((select jsonb_agg(jsonb_build_object('id',l.id,'title',l.title,'subject',l.subject,'topic',l.topic,'grade',l.grade,'quarter',l.quarter,'description',l.description,'content',l.content,'published',l.published,'policy',l.policy,'updated',l.updated,'classIds',coalesce((select jsonb_agg(classroom) from public.studyscan_lesson_classes where lesson=l.id),'[]'),'studentIds',coalesce((select jsonb_agg(student) from public.studyscan_lesson_students where lesson=l.id),'[]')) order by l.updated desc) from public.studyscan_lessons l where l.id=any(ids)),'[]'),
'classes',coalesce((select jsonb_agg(jsonb_build_object('id',c.id,'name',c.name,'code',case when p.role='teacher' then c.code else null end)) from public.studyscan_classes c where not c.archived and (c.teacher=p.id or exists(select 1 from public.studyscan_members m where m.classroom=c.id and m.student=p.id))),'[]'),
'students',coalesce((select jsonb_agg(jsonb_build_object('id',s.id,'name',s.name,'email',s.email,'classroom',c.id)) from public.studyscan_members m join public.studyscan_classes c on c.id=m.classroom and not c.archived join public.studyscan_profiles s on s.id=m.student where c.teacher=p.id and p.role='teacher'),'[]'),
'assignments',coalesce((select jsonb_agg(jsonb_build_object('id',a.id,'lesson',a.lesson,'title',a.title,'instructions',a.instructions,'due',coalesce(a.due::text,''),'aiEnabled',a.ai_enabled) order by a.created desc) from public.studyscan_assignments a where a.lesson=any(ids)),'[]'),
'submissions',coalesce((select jsonb_agg(jsonb_build_object('id',s.id,'assignment',s.assignment,'student',s.student,'studentName',u.name,'body',s.body,'feedback',s.feedback,'reviewed',s.reviewed,'created',s.created,'updated',s.updated) order by s.updated desc) from public.studyscan_submissions s join public.studyscan_assignments a on a.id=s.assignment join public.studyscan_profiles u on u.id=s.student where a.lesson=any(ids) and (p.role='teacher' or s.student=p.id)),'[]'),
'interactions',coalesce((select jsonb_agg(to_jsonb(q) order by q.created desc) from (select i.id,i.student,u.name as "studentName",i.lesson,i.assignment,i.question,i.answer,i.sources,i.status,i.flagged::integer,i.resolved::integer,i.note,i.created from public.studyscan_interactions i join public.studyscan_profiles u on u.id=i.student where i.lesson=any(ids) and (p.role='teacher' or i.student=p.id) order by i.created desc limit 1000) q),'[]'),
'progress',coalesce((select jsonb_agg(jsonb_build_object('lesson',lesson,'completed',completed::integer)) from public.studyscan_progress where student=p.id and lesson=any(ids)),'[]'),
'files',coalesce((select jsonb_agg(to_jsonb(f)) from public.studyscan_files f where f.lesson=any(ids)),'[]'),
'teacherRequests',coalesce((select jsonb_agg(jsonb_build_object('id',r.id,'account',r.account,'name',u.name,'email',u.email,'school',r.school,'subjects',r.subjects,'status',r.status,'reason',r.reason,'created',r.created)) from public.studyscan_teacher_requests r join public.studyscan_profiles u on u.id=r.account where p.role='super-admin' or r.account=p.id),'[]'));
if p.role='super-admin' then result=result||jsonb_build_object('admin',jsonb_build_object('accounts',(select coalesce(jsonb_agg(to_jsonb(u) order by u.name),'[]') from public.studyscan_profiles u),'policy',(select jsonb_build_object('name',name,'aiEnabled',ai_enabled,'blockedTopics',blocked_topics,'monthlyBudgetUsd',monthly_budget_usd) from public.studyscan_school),'protectedAccount',(select id from public.studyscan_profiles where is_primary_admin),'audit',(select coalesce(jsonb_agg(to_jsonb(a)),'[]') from (select * from public.studyscan_account_audit order by created desc limit 100) a),'totals',jsonb_build_object('lessons',(select count(*) from public.studyscan_lessons),'classes',(select count(*) from public.studyscan_classes where not archived),'questions',(select count(*) from public.studyscan_interactions),'flagged',(select count(*) from public.studyscan_interactions where flagged and not resolved)),'aiUsageUsd',(select coalesce(sum(reserved_micro_usd),0)/1000000.0 from public.studyscan_ai_usage where created>=date_trunc('month',now()))));end if;
return result;end;$$;
revoke all on function public.studyscan_workspace() from public,anon;grant execute on function public.studyscan_workspace() to authenticated;

create function public.studyscan_mutate(action text,payload jsonb default '{}') returns jsonb language plpgsql security definer set search_path='' as $$
declare p public.studyscan_profiles;target uuid;lid uuid;cid uuid;rowdata jsonb;v jsonb;student_id uuid;request public.studyscan_teacher_requests;begin
p=public.studyscan_actor();
if action in ('setRole','setAccountStatus','inviteTeacher') then perform public.studyscan_manage_account(action,nullif(payload->>'id','')::uuid,coalesce(payload->>'role',payload->>'status',payload->>'email',''));return '{"ok":true}';end if;
if action='schoolSettings' then
 if p.role<>'super-admin' then raise exception 'Super Admin access required.';end if;
 if length(trim(payload->>'name')) not between 1 and 100 then raise exception 'Enter a school name.';end if;
 update public.studyscan_school set name=trim(payload->>'name'),ai_enabled=coalesce((payload->>'aiEnabled')::boolean,false),blocked_topics=left(coalesce(payload->>'blockedTopics',''),2000),monthly_budget_usd=coalesce((payload->>'monthlyBudgetUsd')::numeric,monthly_budget_usd);
 insert into public.studyscan_account_audit(actor,action,target) values(p.id,action,'School settings updated');return '{"ok":true}';end if;
if action='requestTeacher' then
 if p.role<>'student' then raise exception 'Only student accounts can request Teacher access.';end if;
 if length(trim(payload->>'school')) not between 1 and 150 or length(trim(payload->>'subjects')) not between 1 and 300 then raise exception 'Enter your school and subjects.';end if;
 insert into public.studyscan_teacher_requests(account,school,subjects) values(p.id,trim(payload->>'school'),trim(payload->>'subjects')) on conflict(account) do update set school=excluded.school,subjects=excluded.subjects,status='pending',reason='',reviewer=null,reviewed=null where studyscan_teacher_requests.status='rejected';return '{"ok":true}';end if;
if action='reviewTeacher' then
 if p.role<>'super-admin' then raise exception 'Super Admin access required.';end if;
 select * into request from public.studyscan_teacher_requests where id=(payload->>'id')::uuid for update;if not found or request.status<>'pending' then raise exception 'This request is no longer pending.';end if;
 if payload->>'decision' not in ('approved','rejected') then raise exception 'Choose Approve or Reject.';end if;
 if payload->>'decision'='approved' then perform public.studyscan_manage_account('inviteTeacher',null,(select email from public.studyscan_profiles where id=request.account));end if;
 update public.studyscan_teacher_requests set status=payload->>'decision',reason=left(coalesce(payload->>'reason',''),1000),reviewer=p.id,reviewed=now() where id=request.id;
 insert into public.studyscan_account_audit(actor,action,target) values(p.id,action,request.account::text||' → '||(payload->>'decision'));return '{"ok":true}';end if;
if action='join' then
 if p.role<>'student' then raise exception 'Only students can join a class.';end if;
 perform pg_advisory_xact_lock(hashtextextended(p.id::text,0));
 if (select count(*) from public.studyscan_members where student=p.id)>=30 then raise exception 'You have reached the class membership limit.';end if;
 select c.id into cid from public.studyscan_classes c join public.studyscan_profiles t on t.id=c.teacher and t.role='teacher' and t.status='active' where c.code=upper(trim(payload->>'code')) and not c.archived;
 if cid is null then raise exception 'Class code not found. Ask your teacher for the current code.';end if;
 insert into public.studyscan_members values(cid,p.id) on conflict do nothing;return '{"ok":true}';end if;
if action='class' then
 if p.role<>'teacher' then raise exception 'Teacher access required.';end if;
 if length(trim(payload->>'name')) not between 1 and 100 then raise exception 'Enter a class name.';end if;
 insert into public.studyscan_classes(teacher,name) values(p.id,trim(payload->>'name')) returning id into target;return jsonb_build_object('ok',true,'id',target);end if;
if action in ('renameClass','archiveClass','removeMember','rotateCode') then
 if p.role<>'teacher' then raise exception 'Teacher access required.';end if;
 cid=(payload->>'id')::uuid;
 if not exists(select 1 from public.studyscan_classes where id=cid and teacher=p.id and not archived) then raise exception 'Class not found.';end if;
 if action='renameClass' then if length(trim(payload->>'name')) not between 1 and 100 then raise exception 'Enter a class name.';end if;update public.studyscan_classes set name=trim(payload->>'name') where id=cid;
 elsif action='archiveClass' then update public.studyscan_classes set archived=true where id=cid;
 elsif action='rotateCode' then update public.studyscan_classes set code=upper(substr(replace(gen_random_uuid()::text,'-',''),1,10)) where id=cid;
 else delete from public.studyscan_members where classroom=cid and student=(payload->>'student')::uuid;end if;return '{"ok":true}';end if;
if action='lesson' then
 if p.role<>'teacher' then raise exception 'Teacher access required.';end if;
 v=payload->'lesson';target=coalesce(nullif(v->>'id','')::uuid,gen_random_uuid());
 if exists(select 1 from public.studyscan_lessons where id=target and teacher<>p.id) then raise exception 'You cannot change another teacher’s lesson.';end if;
 if length(trim(v->>'title')) not between 1 and 150 or length(trim(v->>'content')) not between 1 and 80000 then raise exception 'Enter a title and source text (up to 80,000 characters).';end if;
 if v->'policy'->>'mode' not in ('Explanation Only','Hints and Guidance','Step-by-Step Assistance','Review and Clarification','Teacher-Defined Mode') then raise exception 'Select an assistance level.';end if;
 if nullif(v->'policy'->>'starts','')::timestamptz > nullif(v->'policy'->>'ends','')::timestamptz then raise exception 'The assistance end time must follow its start time.';end if;
 for cid in select value::uuid from jsonb_array_elements_text(v->'classIds') loop if not exists(select 1 from public.studyscan_classes where id=cid and teacher=p.id and not archived) then raise exception 'Assign only to your own classes.';end if;end loop;
 for student_id in select value::uuid from jsonb_array_elements_text(v->'studentIds') loop if not exists(select 1 from public.studyscan_members m join public.studyscan_classes c on c.id=m.classroom where c.teacher=p.id and not c.archived and m.student=student_id) then raise exception 'Assign only to students in your classes.';end if;end loop;
 insert into public.studyscan_lessons(id,teacher,title,subject,topic,grade,quarter,description,content,published,policy) values(target,p.id,trim(v->>'title'),left(coalesce(v->>'subject',''),100),left(coalesce(v->>'topic',''),150),left(coalesce(v->>'grade','Grade 9'),30),left(coalesce(v->>'quarter','Quarter 1'),30),left(coalesce(v->>'description',''),2000),trim(v->>'content'),coalesce((v->>'published')::boolean,false),v->'policy') on conflict(id) do update set title=excluded.title,subject=excluded.subject,topic=excluded.topic,grade=excluded.grade,quarter=excluded.quarter,description=excluded.description,content=excluded.content,published=excluded.published,policy=excluded.policy,updated=now();
 delete from public.studyscan_lesson_classes where lesson=target;delete from public.studyscan_lesson_students where lesson=target;
 insert into public.studyscan_lesson_classes select target,value::uuid from jsonb_array_elements_text(v->'classIds') on conflict do nothing;
 insert into public.studyscan_lesson_students select target,value::uuid from jsonb_array_elements_text(v->'studentIds') on conflict do nothing;
 return jsonb_build_object('ok',true,'id',target);end if;
if action in ('assignment','deleteAssignment','submit','reviewSubmission') then
 if action='assignment' then v=payload->'assignment';lid=(v->>'lesson')::uuid;target=coalesce(nullif(v->>'id','')::uuid,gen_random_uuid());
 elsif action='reviewSubmission' then select a.lesson into lid from public.studyscan_submissions s join public.studyscan_assignments a on a.id=s.assignment where s.id=(payload->>'id')::uuid;
 else target=(coalesce(payload->>'id',payload->>'assignment'))::uuid;select lesson into lid from public.studyscan_assignments where id=target;end if;
 if not public.studyscan_can_lesson(lid) then raise exception 'Activity not found or not assigned.';end if;
 if action='submit' then
  if p.role<>'student' or length(trim(payload->>'body')) not between 1 and 12000 then raise exception 'Enter your answer (up to 12,000 characters).';end if;
  if exists(select 1 from public.studyscan_submissions where assignment=target and student=p.id and reviewed) then raise exception 'This submission has been reviewed. Ask your teacher before revising.';end if;
  insert into public.studyscan_submissions(assignment,student,body) values(target,p.id,trim(payload->>'body')) on conflict(assignment,student) do update set body=excluded.body,updated=now();
 else
  if p.role<>'teacher' then raise exception 'Teacher access required.';end if;
  if action='assignment' then
   if length(trim(v->>'title')) not between 1 and 150 then raise exception 'Enter an activity title.';end if;
   if exists(select 1 from public.studyscan_assignments a join public.studyscan_lessons l on l.id=a.lesson where a.id=target and l.teacher<>p.id) then raise exception 'Activity belongs to another teacher.';end if;
   insert into public.studyscan_assignments(id,lesson,title,instructions,due,ai_enabled) values(target,lid,trim(v->>'title'),left(coalesce(v->>'instructions',''),12000),nullif(v->>'due','')::timestamptz,coalesce((v->>'aiEnabled')::boolean,false)) on conflict(id) do update set lesson=excluded.lesson,title=excluded.title,instructions=excluded.instructions,due=excluded.due,ai_enabled=excluded.ai_enabled;
  elsif action='deleteAssignment' then delete from public.studyscan_assignments where id=target;
  else update public.studyscan_submissions set feedback=left(coalesce(payload->>'feedback',''),4000),reviewed=true,updated=now() where id=(payload->>'id')::uuid;end if;
 end if;return '{"ok":true}';end if;
if action in ('flag','review') then
 select i.lesson,i.student into lid,student_id from public.studyscan_interactions i where i.id=(payload->>'id')::uuid;
 if not public.studyscan_can_lesson(lid) or (p.role='student' and student_id<>p.id) then raise exception 'Question not found.';end if;
 if action='flag' then update public.studyscan_interactions set flagged=true,resolved=false where id=(payload->>'id')::uuid;
 else if p.role<>'teacher' then raise exception 'Teacher access required.';end if;update public.studyscan_interactions set note=left(coalesce(payload->>'note',''),4000),resolved=coalesce((payload->>'resolved')::boolean,false) where id=(payload->>'id')::uuid;end if;return '{"ok":true}';end if;
lid=coalesce(nullif(payload->>'lesson',''),nullif(payload->>'id',''))::uuid;
if action in ('deleteLesson','registerFile','removeFile') then
 if action='removeFile' then select lesson into lid from public.studyscan_files where id=(payload->>'id')::uuid;end if;
 if p.role<>'teacher' or not public.studyscan_can_lesson(lid) then raise exception 'Your lesson was not found.';end if;
 if action='deleteLesson' then delete from public.studyscan_lessons where id=lid;
 elsif action='removeFile' then delete from public.studyscan_files where id=(payload->>'id')::uuid;
 else
  if payload->>'path' not like p.id::text||'/'||lid::text||'/%' or payload->>'name' !~* '\.(pdf|txt|md|docx|pptx)$' then raise exception 'Invalid learning resource.';end if;
  insert into public.studyscan_files(id,lesson,name,size,path) values((payload->>'fileId')::uuid,lid,left(payload->>'name',200),(payload->>'size')::integer,payload->>'path');end if;return '{"ok":true}';end if;
if action='progress' then
 if p.role<>'student' or not public.studyscan_can_lesson(lid) then raise exception 'Assigned lesson not found.';end if;
 insert into public.studyscan_progress values(p.id,lid,coalesce((payload->>'completed')::boolean,false)) on conflict(student,lesson) do update set completed=excluded.completed;return '{"ok":true}';end if;
raise exception 'Unknown action.';end;$$;
revoke all on function public.studyscan_mutate(text,jsonb) from public,anon;grant execute on function public.studyscan_mutate(text,jsonb) to authenticated;
commit;
