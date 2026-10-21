begin;
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types) values('studyscan-resources','studyscan-resources',false,10000000,array['application/pdf','text/plain','text/markdown','application/vnd.openxmlformats-officedocument.wordprocessingml.document','application/vnd.openxmlformats-officedocument.presentationml.presentation']) on conflict(id) do nothing;
create or replace function public.studyscan_can_upload(object_path text) returns boolean language sql stable security definer set search_path='' as $$select exists(select 1 from public.studyscan_lessons l join public.studyscan_profiles p on p.id=l.teacher and p.id=auth.uid() and p.role='teacher' and p.status='active' where split_part(object_path,'/',1)=p.id::text and split_part(object_path,'/',2)=l.id::text);$$;
create or replace function public.studyscan_can_download(object_path text) returns boolean language sql stable security definer set search_path='' as $$select public.studyscan_can_upload(object_path) or exists(select 1 from public.studyscan_files f where f.path=object_path and public.studyscan_can_lesson(f.lesson));$$;
revoke all on function public.studyscan_can_upload(text),public.studyscan_can_download(text) from public,anon;grant execute on function public.studyscan_can_upload(text),public.studyscan_can_download(text) to authenticated;
drop policy if exists studyscan_resource_read on storage.objects;
create policy studyscan_resource_read on storage.objects for select to authenticated using(bucket_id='studyscan-resources' and public.studyscan_can_download(name));
drop policy if exists studyscan_resource_create on storage.objects;
create policy studyscan_resource_create on storage.objects for insert to authenticated with check(bucket_id='studyscan-resources' and public.studyscan_can_upload(name));
drop policy if exists studyscan_resource_delete on storage.objects;
create policy studyscan_resource_delete on storage.objects for delete to authenticated using(bucket_id='studyscan-resources' and public.studyscan_can_upload(name));

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
create or replace function public.studyscan_ai_finish(interaction_id uuid,answer_text text,answer_sources jsonb,answer_status text) returns void language plpgsql security definer set search_path='' as $$begin
if answer_status not in ('answered','needs-teacher','out-of-scope','unavailable') or length(answer_text)>6000 or jsonb_array_length(answer_sources)>4 then raise exception 'Invalid assistant response.';end if;
update public.studyscan_interactions set answer=answer_text,sources=answer_sources,status=answer_status where id=interaction_id and status='pending';end;$$;
revoke all on function public.studyscan_ai_begin(uuid,uuid,uuid,text,boolean),public.studyscan_ai_finish(uuid,text,jsonb,text) from public,anon,authenticated;
grant execute on function public.studyscan_ai_begin(uuid,uuid,uuid,text,boolean),public.studyscan_ai_finish(uuid,text,jsonb,text) to service_role;
commit;
