begin;
-- Preserve the existing, tested action router while adding school transfer controls.
alter function public.studyscan_mutate(text,jsonb) rename to studyscan_mutate_core;
revoke all on function public.studyscan_mutate_core(text,jsonb) from public,anon,authenticated;
create function public.studyscan_mutate(action text,payload jsonb default '{}') returns jsonb language plpgsql security definer set search_path='' as $$
declare p public.studyscan_profiles;source_id uuid;target_id uuid;begin
p=public.studyscan_actor();
if action='transferTeacher' then
 if p.role<>'super-admin' then raise exception 'Super Admin access required.';end if;
 source_id=(payload->>'source')::uuid;target_id=(payload->>'target')::uuid;
 if source_id=target_id or not exists(select 1 from public.studyscan_profiles where id=source_id and role='teacher') or not exists(select 1 from public.studyscan_profiles where id=target_id and role='teacher' and status='active') then raise exception 'Select two different teachers. The receiving teacher must be active.';end if;
 perform pg_advisory_xact_lock(7624511);
 update public.studyscan_classes set teacher=target_id where teacher=source_id;
 update public.studyscan_lessons set teacher=target_id,updated=now() where teacher=source_id;
 insert into public.studyscan_account_audit(actor,action,target) values(p.id,action,source_id::text||' → '||target_id::text);return '{"ok":true}';
end if;
if action in ('setRole','setAccountStatus') and exists(select 1 from public.studyscan_classes where teacher=(payload->>'id')::uuid and not archived) and ((action='setRole' and payload->>'role'<>'teacher') or (action='setAccountStatus' and payload->>'status'='suspended')) then
 if p.role<>'super-admin' then raise exception 'Super Admin access required.';end if;
 raise exception 'Transfer or archive this teacher’s active classes before changing their access.';
end if;
return public.studyscan_mutate_core(action,payload);end;$$;
revoke all on function public.studyscan_mutate(text,jsonb) from public,anon;grant execute on function public.studyscan_mutate(text,jsonb) to authenticated;
create function public.studyscan_owns_resource(object_path text) returns boolean language sql stable security definer set search_path='' as $$select exists(select 1 from public.studyscan_lessons l join public.studyscan_profiles p on p.id=l.teacher and p.id=auth.uid() and p.role='teacher' and p.status='active' where split_part(object_path,'/',2)=l.id::text);$$;
revoke all on function public.studyscan_owns_resource(text) from public,anon;grant execute on function public.studyscan_owns_resource(text) to authenticated;
drop policy studyscan_resource_delete on storage.objects;
create policy studyscan_resource_delete on storage.objects for delete to authenticated using(bucket_id='studyscan-resources' and public.studyscan_owns_resource(name));
commit;
