begin;
create table public.studyscan_ai_permissions(student uuid not null references public.studyscan_profiles(id),teacher uuid not null references public.studyscan_profiles(id),approved boolean not null default false,updated timestamptz not null default now(),primary key(student,teacher));
alter table public.studyscan_ai_permissions enable row level security;revoke all on public.studyscan_ai_permissions from public,anon,authenticated;
alter function public.studyscan_mutate(text,jsonb) rename to studyscan_mutate_school;
revoke all on function public.studyscan_mutate_school(text,jsonb) from public,anon,authenticated;
create function public.studyscan_mutate(action text,payload jsonb default '{}') returns jsonb language plpgsql security definer set search_path='' as $$
declare p public.studyscan_profiles;target uuid;begin p=public.studyscan_actor();if action='studentAI' then
 if p.role<>'teacher' then raise exception 'Teacher access required.';end if;target=(payload->>'student')::uuid;
 if not exists(select 1 from public.studyscan_members m join public.studyscan_classes c on c.id=m.classroom where c.teacher=p.id and not c.archived and m.student=target and c.id=(payload->>'id')::uuid) then raise exception 'Student not found in your class.';end if;
 if coalesce((payload->>'approved')::boolean,false) and not coalesce((payload->>'attested')::boolean,false) then raise exception 'Confirm school authorization and age requirements first.';end if;
 insert into public.studyscan_ai_permissions(student,teacher,approved) values(target,p.id,coalesce((payload->>'approved')::boolean,false)) on conflict(student,teacher) do update set approved=excluded.approved,updated=now();
 insert into public.studyscan_account_audit(actor,action,target) values(p.id,action,target::text||' → '||coalesce(payload->>'approved','false'));return '{"ok":true}';end if;return public.studyscan_mutate_school(action,payload);end;$$;
revoke all on function public.studyscan_mutate(text,jsonb) from public,anon;grant execute on function public.studyscan_mutate(text,jsonb) to authenticated;
revoke execute on function public.studyscan_manage_account(text,uuid,text) from authenticated;
create or replace function public.studyscan_ai_begin(actor_id uuid,lesson_id uuid,assignment_id uuid,question_text text,reserve boolean) returns jsonb language plpgsql security definer set search_path='' as $$
declare p public.studyscan_profiles;l public.studyscan_lessons;s public.studyscan_school;a public.studyscan_assignments;blocked text;target uuid;used bigint;history jsonb;begin
perform set_config('request.jwt.claim.sub',actor_id::text,true);p=public.studyscan_actor();
if p.role not in ('student','teacher') or not public.studyscan_can_lesson(lesson_id) then raise exception 'Lesson not found or not assigned.';end if;
if length(trim(question_text)) not between 1 and 2000 then raise exception 'Enter a question up to 2,000 characters.';end if;
perform pg_advisory_xact_lock(hashtextextended(actor_id::text,1));
if (select count(*) from public.studyscan_interactions where student=actor_id and created>now()-interval '1 minute')>=6 then raise exception 'Please wait a minute before asking another question.';end if;
if (select count(*) from public.studyscan_interactions where student=actor_id and created>=date_trunc('day',now()))>=50 then raise exception 'Your daily question limit has been reached. Please ask your teacher for help.';end if;
select * into l from public.studyscan_lessons where id=lesson_id;select * into s from public.studyscan_school for update;
if assignment_id is not null then select * into a from public.studyscan_assignments where id=assignment_id and lesson=lesson_id;if not found then raise exception 'Choose an activity from this lesson.';end if;end if;
if not s.ai_enabled then blocked='Your school has paused AI assistance. You can still ask your teacher.';
elsif p.role='student' and not exists(select 1 from public.studyscan_ai_permissions where student=actor_id and teacher=l.teacher and approved) then blocked='Your teacher must authorize AI access before you use the assistant. Ask your teacher for help.';
elsif not coalesce((l.policy->>'enabled')::boolean,false) then blocked='Your teacher has disabled assistance for this lesson.';
elsif nullif(l.policy->>'starts','')::timestamptz>now() then blocked='Assistance is not available yet. Check your teacher’s schedule.';
elsif nullif(l.policy->>'ends','')::timestamptz<now() then blocked='The assistance window has ended. Please ask your teacher.';
elsif assignment_id is not null and not a.ai_enabled then blocked='Your teacher has disabled assistance for this activity.';
elsif exists(select 1 from regexp_split_to_table(s.blocked_topics||E'\n'||coalesce(l.policy->>'blockedTopics',''),E'[\n,]') t where length(trim(t))>0 and position(lower(trim(t)) in lower(question_text))>0) then blocked='This topic is restricted by your teacher or school.';end if;
if blocked is null and reserve then
 select coalesce(sum(reserved_micro_usd),0) into used from public.studyscan_ai_usage where created>=date_trunc('month',now());
 if s.monthly_budget_usd<=0 or used+6000>s.monthly_budget_usd*1000000 then blocked='The school’s monthly AI allowance is unavailable. Flag your question for your teacher.';end if;
end if;
insert into public.studyscan_interactions(student,lesson,assignment,question,answer,status) values(actor_id,lesson_id,assignment_id,trim(question_text),coalesce(blocked,''),case when blocked is null then 'pending' else 'restricted' end) returning id into target;
if blocked is null and reserve then insert into public.studyscan_ai_usage(id,student,reserved_micro_usd) values(target,actor_id,6000);end if;
select coalesce(jsonb_agg(to_jsonb(q)),'[]') into history from (select question,answer from public.studyscan_interactions where student=actor_id and lesson=lesson_id and status='answered' and id<>target order by created desc limit 3) q;
return jsonb_build_object('id',target,'blocked',blocked,'lesson',to_jsonb(l),'history',history,'assignment',to_jsonb(a));end;$$;

create or replace function public.studyscan_workspace() returns jsonb language plpgsql stable security definer set search_path='' as $$
declare p public.studyscan_profiles;result jsonb;ids uuid[];begin
p=public.studyscan_actor();select coalesce(array_agg(id),'{}') into ids from public.studyscan_lessons where public.studyscan_can_lesson(id);
result=jsonb_build_object('user',to_jsonb(p),'aiReady',false,'model','','production',true,
'school',(select jsonb_build_object('name',name,'aiEnabled',ai_enabled) from public.studyscan_school),
'lessons',coalesce((select jsonb_agg(jsonb_build_object('id',l.id,'title',l.title,'subject',l.subject,'topic',l.topic,'grade',l.grade,'quarter',l.quarter,'description',l.description,'content','','published',l.published,'policy',l.policy,'updated',l.updated,'classIds',coalesce((select jsonb_agg(classroom) from public.studyscan_lesson_classes where lesson=l.id),'[]'),'studentIds',coalesce((select jsonb_agg(student) from public.studyscan_lesson_students where lesson=l.id),'[]')) order by l.updated desc) from public.studyscan_lessons l where l.id=any(ids)),'[]'),
'classes',coalesce((select jsonb_agg(jsonb_build_object('id',c.id,'name',c.name,'code',case when p.role='teacher' then c.code else null end)) from public.studyscan_classes c where not c.archived and (c.teacher=p.id or exists(select 1 from public.studyscan_members m where m.classroom=c.id and m.student=p.id))),'[]'),
'students',coalesce((select jsonb_agg(jsonb_build_object('id',s.id,'name',s.name,'email',s.email,'classroom',c.id,'aiApproved',exists(select 1 from public.studyscan_ai_permissions ap where ap.student=s.id and ap.teacher=p.id and ap.approved))) from public.studyscan_members m join public.studyscan_classes c on c.id=m.classroom and not c.archived join public.studyscan_profiles s on s.id=m.student where c.teacher=p.id and p.role='teacher'),'[]'),
'assignments',coalesce((select jsonb_agg(jsonb_build_object('id',a.id,'lesson',a.lesson,'title',a.title,'instructions',a.instructions,'due',coalesce(a.due::text,''),'aiEnabled',a.ai_enabled) order by a.created desc) from public.studyscan_assignments a where a.lesson=any(ids)),'[]'),
'submissions',coalesce((select jsonb_agg(jsonb_build_object('id',s.id,'assignment',s.assignment,'student',s.student,'studentName',u.name,'body',s.body,'feedback',s.feedback,'reviewed',s.reviewed,'created',s.created,'updated',s.updated) order by s.updated desc) from public.studyscan_submissions s join public.studyscan_assignments a on a.id=s.assignment join public.studyscan_profiles u on u.id=s.student where a.lesson=any(ids) and (p.role='teacher' or s.student=p.id)),'[]'),
'interactions',coalesce((select jsonb_agg(to_jsonb(q) order by q.created desc) from (select i.id,i.student,u.name as "studentName",i.lesson,i.assignment,i.question,i.answer,i.sources,i.status,i.flagged::integer,i.resolved::integer,i.note,i.created from public.studyscan_interactions i join public.studyscan_profiles u on u.id=i.student where i.lesson=any(ids) and (p.role='teacher' or i.student=p.id) order by i.created desc limit 1000) q),'[]'),
'progress',coalesce((select jsonb_agg(jsonb_build_object('lesson',lesson,'completed',completed::integer)) from public.studyscan_progress where student=p.id and lesson=any(ids)),'[]'),
'files',coalesce((select jsonb_agg(to_jsonb(f)) from public.studyscan_files f where f.lesson=any(ids)),'[]'),
'teacherRequests',coalesce((select jsonb_agg(jsonb_build_object('id',r.id,'account',r.account,'name',u.name,'email',u.email,'school',r.school,'subjects',r.subjects,'status',r.status,'reason',r.reason,'created',r.created)) from public.studyscan_teacher_requests r join public.studyscan_profiles u on u.id=r.account where p.role='super-admin' or r.account=p.id),'[]'));
if p.role='super-admin' then result=result||jsonb_build_object('admin',jsonb_build_object('accounts',(select coalesce(jsonb_agg(to_jsonb(u) order by u.name),'[]') from public.studyscan_profiles u),'policy',(select jsonb_build_object('name',name,'aiEnabled',ai_enabled,'blockedTopics',blocked_topics,'monthlyBudgetUsd',monthly_budget_usd) from public.studyscan_school),'protectedAccount',(select id from public.studyscan_profiles where is_primary_admin),'audit',(select coalesce(jsonb_agg(to_jsonb(a)),'[]') from (select * from public.studyscan_account_audit order by created desc limit 100) a),'totals',jsonb_build_object('lessons',(select count(*) from public.studyscan_lessons),'classes',(select count(*) from public.studyscan_classes where not archived),'questions',(select count(*) from public.studyscan_interactions),'flagged',(select count(*) from public.studyscan_interactions where flagged and not resolved)),'aiUsageUsd',(select coalesce(sum(reserved_micro_usd),0)/1000000.0 from public.studyscan_ai_usage where created>=date_trunc('month',now()))));end if;
return result;end;$$;


commit;
