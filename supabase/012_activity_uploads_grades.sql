begin;
alter table public.studyscan_assignments add column submission_type text not null default 'written' check(submission_type in ('written','file')), add column max_points numeric(8,2) not null default 100 check(max_points>0 and max_points<=10000), add column file_types text[] not null default array['image/jpeg','image/png','application/pdf'] check(cardinality(file_types)>0 and file_types<@array['image/jpeg','image/png','application/pdf']);
alter table public.studyscan_submissions add column score numeric(8,2) check(score>=0),add column graded_at timestamptz,add column file_path text,add column file_name text,add column file_type text,add column file_size integer,add constraint studyscan_submission_file_complete check((file_path is null and file_name is null and file_type is null and file_size is null) or (file_path is not null and file_name is not null and file_type is not null and file_size is not null and length(file_name) between 1 and 180 and file_type in ('image/jpeg','image/png','application/pdf') and file_size between 1 and 10000000));
create index studyscan_submission_file_path on public.studyscan_submissions(file_path) where file_path is not null;
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types) values('studyscan-submissions','studyscan-submissions',false,10000000,array['image/jpeg','image/png','application/pdf']);
create function public.studyscan_submission_upload(object_path text) returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.studyscan_assignments a join public.studyscan_profiles p on p.id=auth.uid() and p.role='student' and p.status='active' where a.id::text=split_part(object_path,'/',2) and split_part(object_path,'/',1)=p.id::text and object_path ~ '^[0-9a-f-]{36}/[0-9a-f-]{36}/[0-9a-f-]{36}\.(jpg|jpeg|png|pdf)$' and a.submission_type='file' and public.studyscan_can_lesson(a.lesson) and (case when object_path ~ '\.pdf$' then 'application/pdf' when object_path ~ '\.png$' then 'image/png' else 'image/jpeg' end)=any(a.file_types) and not exists(select 1 from public.studyscan_submissions s where s.assignment=a.id and s.student=p.id and s.reviewed));$$;
create function public.studyscan_submission_download(object_path text) returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.studyscan_submissions s join public.studyscan_assignments a on a.id=s.assignment join public.studyscan_lessons l on l.id=a.lesson join public.studyscan_profiles p on p.id=auth.uid() and p.status='active' where s.file_path=object_path and ((p.role='teacher' and l.teacher=p.id) or (p.role='student' and s.student=p.id and public.studyscan_can_lesson(a.lesson))));$$;
create function public.studyscan_submission_cleanup(object_path text) returns boolean language sql stable security definer set search_path='' as $$
 select split_part(object_path,'/',1)=auth.uid()::text and exists(select 1 from public.studyscan_profiles where id=auth.uid() and status='active') and not exists(select 1 from public.studyscan_submissions where file_path=object_path);$$;
revoke all on function public.studyscan_submission_upload(text),public.studyscan_submission_download(text),public.studyscan_submission_cleanup(text) from public,anon;
grant execute on function public.studyscan_submission_upload(text),public.studyscan_submission_download(text),public.studyscan_submission_cleanup(text) to authenticated;
create policy studyscan_submission_create on storage.objects for insert to authenticated with check(bucket_id='studyscan-submissions' and public.studyscan_submission_upload(name));
create policy studyscan_submission_read on storage.objects for select to authenticated using(bucket_id='studyscan-submissions' and (public.studyscan_submission_download(name) or public.studyscan_submission_cleanup(name)));
create policy studyscan_submission_delete on storage.objects for delete to authenticated using(bucket_id='studyscan-submissions' and public.studyscan_submission_cleanup(name));
alter function public.studyscan_mutate(text,jsonb) rename to studyscan_mutate_before_activity_files;
revoke all on function public.studyscan_mutate_before_activity_files(text,jsonb) from public,anon,authenticated;
create function public.studyscan_mutate(action text,payload jsonb default '{}') returns jsonb language plpgsql security definer set search_path='' as $$
declare p public.studyscan_profiles;a public.studyscan_assignments;s public.studyscan_submissions;v jsonb;target uuid;lid uuid;kind text;points numeric;types text[];answer text;f jsonb;mark numeric;object_metadata jsonb;
begin
 p=public.studyscan_actor();
 if action='lesson' and coalesce((payload->'lesson'->>'published')::boolean,false) and coalesce(jsonb_array_length(payload->'lesson'->'classIds'),0)+coalesce(jsonb_array_length(payload->'lesson'->'studentIds'),0)=0 then raise exception 'Choose a class or student before publishing. You can save an unassigned lesson as a draft.';end if;
 if action='assignment' then
  if p.role<>'teacher' then raise exception 'Teacher access required.';end if;
  v=payload->'assignment';target=coalesce(nullif(v->>'id','')::uuid,gen_random_uuid());lid=(v->>'lesson')::uuid;
  select * into a from public.studyscan_assignments where id=target for update;
  if not exists(select 1 from public.studyscan_lessons where id=lid and teacher=p.id) or (a.id is not null and not public.studyscan_can_lesson(a.lesson)) then raise exception 'Your activity was not found.';end if;
  kind=coalesce(v->>'submissionType',a.submission_type,'written');points=coalesce((v->>'maxPoints')::numeric,a.max_points,100);
  select array_agg(value) into types from jsonb_array_elements_text(coalesce(v->'fileTypes',to_jsonb(a.file_types),'["image/jpeg","image/png","application/pdf"]'));
  if kind not in ('written','file') or points is null or points<=0 or points>10000 or points::text='NaN' or types is null or not types<@array['image/jpeg','image/png','application/pdf'] then raise exception 'Choose a valid activity type, file format, and maximum score.';end if;
  if exists(select 1 from public.studyscan_submissions where assignment=target) and (a.lesson<>lid or a.submission_type<>kind or a.max_points<>points or a.file_types<>types) then raise exception 'Submission type, lesson, formats, and total points cannot change after students submit.';end if;
  perform public.studyscan_mutate_before_activity_files(action,jsonb_set(payload,'{assignment,id}',to_jsonb(target::text)));
  update public.studyscan_assignments set submission_type=kind,max_points=points,file_types=types where id=target;return jsonb_build_object('ok',true,'id',target);
 end if;
 if action='submit' then
  if p.role<>'student' then raise exception 'Student access required.';end if;
  target=(payload->>'assignment')::uuid;select * into a from public.studyscan_assignments where id=target for update;
  if a.id is null or not public.studyscan_can_lesson(a.lesson) then raise exception 'Activity not found or not assigned.';end if;
  select * into s from public.studyscan_submissions where assignment=target and student=p.id for update;
  if s.reviewed then raise exception 'This submission has been reviewed. Ask your teacher before revising.';end if;
  answer=trim(coalesce(payload->>'body',''));f=payload->'file';
  if length(answer)>12000 then raise exception 'Use at most 12,000 characters.';end if;
  if a.submission_type='written' then
   if length(answer)=0 or (f is not null and f<>'null'::jsonb) then raise exception 'This activity requires a written answer, not a file.';end if;
  else
   if f is null or f='null'::jsonb then
    if s.file_path is null then raise exception 'Upload a JPEG, PNG, or PDF for this activity.';end if;
    f=jsonb_build_object('path',s.file_path,'name',s.file_name,'type',s.file_type,'size',s.file_size);
   end if;
   if split_part(f->>'path','/',1) is distinct from p.id::text or split_part(f->>'path','/',2) is distinct from a.id::text or coalesce(f->>'path','') !~ '^[0-9a-f-]{36}/[0-9a-f-]{36}/[0-9a-f-]{36}\.(jpg|jpeg|png|pdf)$' or coalesce(length(f->>'name'),0) not between 1 and 180 or coalesce((f->>'size')::integer,0) not between 1 and 10000000 or not coalesce(f->>'type'=any(a.file_types),false) or (case when f->>'path' ~ '\.pdf$' then 'application/pdf' when f->>'path' ~ '\.png$' then 'image/png' else 'image/jpeg' end) is distinct from f->>'type' then raise exception 'Invalid submission file or format.';end if;
   select metadata into object_metadata from storage.objects where bucket_id='studyscan-submissions' and name=f->>'path';
   if object_metadata is null or object_metadata->>'mimetype' is distinct from f->>'type' or (object_metadata->>'size')::bigint is distinct from (f->>'size')::bigint then raise exception 'The uploaded file could not be verified. Upload it again.';end if;
   if length(answer)=0 then answer='File submission';end if;
  end if;
  insert into public.studyscan_submissions(assignment,student,body,file_path,file_name,file_type,file_size) values(a.id,p.id,answer,f->>'path',f->>'name',f->>'type',(f->>'size')::integer) on conflict(assignment,student) do update set body=excluded.body,file_path=excluded.file_path,file_name=excluded.file_name,file_type=excluded.file_type,file_size=excluded.file_size,updated=now();return '{"ok":true}';
 end if;
 if action='reviewSubmission' then
  if p.role<>'teacher' then raise exception 'Teacher access required.';end if;
  select item.* into a from public.studyscan_assignments item join public.studyscan_submissions work on work.assignment=item.id where work.id=(payload->>'id')::uuid for update of item;select * into s from public.studyscan_submissions where id=(payload->>'id')::uuid for update;
  if s.id is null or not exists(select 1 from public.studyscan_lessons where id=a.lesson and teacher=p.id) then raise exception 'Your submission was not found.';end if;
  mark=case when payload ? 'score' then nullif(payload->>'score','')::numeric else s.score end;
  if mark is not null and (mark<0 or mark>a.max_points or mark::text='NaN') then raise exception 'Score must be between zero and the activity total.';end if;
  update public.studyscan_submissions set feedback=left(coalesce(payload->>'feedback',''),4000),reviewed=true,score=mark,graded_at=case when mark is null then null else now() end,updated=now() where id=s.id;
  insert into public.studyscan_account_audit(actor,action,target) values(p.id,'reviewSubmission',s.id::text);return '{"ok":true}';
 end if;
 return public.studyscan_mutate_before_activity_files(action,payload);
end;$$;
revoke all on function public.studyscan_mutate(text,jsonb) from public,anon;grant execute on function public.studyscan_mutate(text,jsonb) to authenticated;
alter function public.studyscan_workspace() rename to studyscan_workspace_before_activity_files;
revoke all on function public.studyscan_workspace_before_activity_files() from public,anon,authenticated;
create function public.studyscan_workspace() returns jsonb language plpgsql stable security definer set search_path='' as $$
declare result jsonb;p public.studyscan_profiles;ids uuid[];
begin
 p=public.studyscan_actor();result=public.studyscan_workspace_before_activity_files();
 select coalesce(array_agg((item->>'id')::uuid),'{}') into ids from jsonb_array_elements(result->'lessons') item;
 result=jsonb_set(result,'{assignments}',coalesce((select jsonb_agg(jsonb_build_object('id',a.id,'lesson',a.lesson,'title',a.title,'instructions',a.instructions,'due',coalesce(a.due::text,''),'aiEnabled',a.ai_enabled,'submissionType',a.submission_type,'maxPoints',a.max_points,'fileTypes',a.file_types) order by a.created desc) from public.studyscan_assignments a where a.lesson=any(ids)),'[]'));
 result=jsonb_set(result,'{submissions}',coalesce((select jsonb_agg(jsonb_build_object('id',s.id,'assignment',s.assignment,'student',s.student,'studentName',u.name,'body',s.body,'feedback',s.feedback,'reviewed',s.reviewed,'score',s.score,'gradedAt',s.graded_at,'filePath',s.file_path,'fileName',s.file_name,'fileType',s.file_type,'fileSize',s.file_size,'created',s.created,'updated',s.updated) order by s.updated desc) from public.studyscan_submissions s join public.studyscan_assignments a on a.id=s.assignment join public.studyscan_profiles u on u.id=s.student where a.lesson=any(ids) and (p.role='teacher' or s.student=p.id)),'[]'));
 if p.role='teacher' then result=jsonb_set(result,'{classes}',coalesce((select jsonb_agg(jsonb_build_object('id',id,'name',name,'code',code)) from public.studyscan_classes where teacher=p.id and not archived),'[]'));end if;
 return result;
end;$$;
revoke all on function public.studyscan_workspace() from public,anon;grant execute on function public.studyscan_workspace() to authenticated;
commit;
