begin;
create table public.studyscan_teacher_invites(
 id uuid primary key,email text not null,invited_by uuid not null references auth.users(id),
 token_hash text not null check(length(token_hash)=64),created timestamptz not null default now(),
 attempted timestamptz not null default now(),expires timestamptz not null default now()+interval '7 days',
 delivery text not null default 'sending' check(delivery in ('sending','sent','failed')),
 accepted_by uuid references auth.users(id),accepted_at timestamptz,revoked_at timestamptz
);
create unique index studyscan_teacher_invite_pending_email on public.studyscan_teacher_invites(email) where accepted_at is null and revoked_at is null;
alter table public.studyscan_teacher_invites enable row level security;
revoke all on public.studyscan_teacher_invites from public,anon,authenticated;

-- Old email preapprovals must never grant access at first sign-in.
create or replace function public.studyscan_ensure_profile() returns public.studyscan_profiles language plpgsql security definer set search_path='' as $$
declare account public.studyscan_profiles;verified_email text;display_name text;
begin
 if auth.uid() is null then raise exception 'Sign in first.';end if;
 select lower(email),left(coalesce(nullif(raw_user_meta_data->>'full_name',''),split_part(email,'@',1)),100) into verified_email,display_name from auth.users where id=auth.uid() and email_confirmed_at is not null;
 if verified_email is null then raise exception 'Confirm your email first.';end if;
 insert into public.studyscan_profiles(id,name,email,role) values(auth.uid(),display_name,verified_email,'student') on conflict(id) do update set email=excluded.email;
 select * into account from public.studyscan_profiles where id=auth.uid();return account;
end;$$;

create or replace function public.studyscan_manage_account(operation text,target_id uuid default null,new_value text default '') returns void language plpgsql security definer set search_path='' as $$
declare account public.studyscan_profiles;
begin
 perform pg_advisory_xact_lock(7624511);
 if not public.studyscan_is_admin() then raise exception 'Super Admin access required.';end if;
 if operation='inviteTeacher' or (operation='setRole' and new_value='teacher') then raise exception 'Teacher access requires an accepted invitation.';end if;
 select * into account from public.studyscan_profiles where id=target_id for update;if not found then raise exception 'Account not found.';end if;
 if account.id=auth.uid() or account.is_primary_admin then raise exception 'Your own account and the primary administrator are protected.';end if;
 if operation='setRole' then
  if new_value not in ('super-admin','student') then raise exception 'Choose a valid role.';end if;
  update public.studyscan_profiles set role=new_value where id=target_id;
 elsif operation='setAccountStatus' then
  if new_value not in ('active','suspended') then raise exception 'Choose a valid status.';end if;
  update public.studyscan_profiles set status=new_value where id=target_id;
 else raise exception 'Unknown account operation.';end if;
 insert into public.studyscan_account_audit(actor,action,target) values(auth.uid(),operation,account.email||' → '||new_value);
end;$$;
revoke all on function public.studyscan_manage_account(text,uuid,text) from public,anon,authenticated;

alter function public.studyscan_mutate(text,jsonb) rename to studyscan_mutate_before_invitations;
revoke all on function public.studyscan_mutate_before_invitations(text,jsonb) from public,anon,authenticated;
create function public.studyscan_mutate(action text,payload jsonb default '{}') returns jsonb language plpgsql security definer set search_path='' as $$
begin
 perform public.studyscan_actor();
 if action in ('requestTeacher','reviewTeacher','inviteTeacher') then raise exception 'Teacher access is by administrator invitation only.';end if;
 return public.studyscan_mutate_before_invitations(action,payload);
end;$$;
revoke all on function public.studyscan_mutate(text,jsonb) from public,anon;
grant execute on function public.studyscan_mutate(text,jsonb) to authenticated;

alter function public.studyscan_workspace() rename to studyscan_workspace_before_invitations;
revoke all on function public.studyscan_workspace_before_invitations() from public,anon,authenticated;
create function public.studyscan_workspace() returns jsonb language sql stable security definer set search_path='' as $$
 select public.studyscan_workspace_before_invitations()-'teacherRequests';
$$;
revoke all on function public.studyscan_workspace() from public,anon;
grant execute on function public.studyscan_workspace() to authenticated;

-- Authenticated callers may inspect/accept only their exact invitation. No GET accepts it.
create function public.studyscan_teacher_invitation(action text,payload jsonb default '{}') returns jsonb language plpgsql security definer set search_path='' as $$
declare p public.studyscan_profiles;i public.studyscan_teacher_invites;verified_email text;result jsonb;
begin
 perform pg_advisory_xact_lock(7624511);p=public.studyscan_actor();
 if action='list' then
  if p.role<>'super-admin' then raise exception 'Super Admin access required.';end if;
  select coalesce(jsonb_agg(jsonb_build_object('id',id,'email',email,'created',created,'expires',expires,'delivery',delivery,'status',case when revoked_at is not null then 'revoked' when accepted_at is not null then 'accepted' when expires<=now() then 'expired' else 'pending' end) order by created desc),'[]') into result from (select * from public.studyscan_teacher_invites order by created desc limit 200) q;return result;
 end if;
 select * into i from public.studyscan_teacher_invites where id=(payload->>'id')::uuid for update;
 if action='revoke' then
  if p.role<>'super-admin' then raise exception 'Super Admin access required.';end if;
  if not found or i.accepted_at is not null then raise exception 'Pending invitation not found.';end if;
  update public.studyscan_teacher_invites set revoked_at=coalesce(revoked_at,now()) where id=i.id;
  insert into public.studyscan_account_audit(actor,action,target) values(p.id,'revokeTeacherInvite',i.email);return '{"ok":true}';
 end if;
 if action not in ('inspect','accept') then raise exception 'Unknown invitation action.';end if;
 if i.id is null or i.token_hash<>encode(sha256(convert_to(coalesce(payload->>'token',''),'UTF8')),'hex') then raise exception 'This invitation is invalid. Ask your administrator for a new one.';end if;
 select lower(email) into verified_email from auth.users where id=p.id and email_confirmed_at is not null;
 if verified_email is distinct from i.email then raise exception 'Sign in with the Google account that received this invitation.';end if;
 if not exists(select 1 from auth.identities where user_id=p.id and provider='google' and lower(identity_data->>'email')=verified_email and identity_data->>'email_verified'='true') then raise exception 'Use Google sign-in with the invited email before accepting.';end if;
 if i.revoked_at is not null or i.expires<=now() or i.delivery<>'sent' then raise exception 'This invitation is expired, revoked, or was not sent. Ask your administrator for a new one.';end if;
 if not exists(select 1 from public.studyscan_profiles where id=i.invited_by and role='super-admin' and status='active') then raise exception 'The inviting administrator no longer has access. Ask your school for a new invitation.';end if;
 if i.accepted_at is not null then
  if i.accepted_by=p.id and p.role='teacher' then return jsonb_build_object('accepted',true,'email',i.email);end if;
  raise exception 'This invitation has already been used.';
 end if;
 if p.role<>'student' then raise exception 'This account already has staff access.';end if;
 if action='accept' then
  update public.studyscan_profiles set role='teacher' where id=p.id;
  update public.studyscan_teacher_invites set accepted_by=p.id,accepted_at=now() where id=i.id;
  insert into public.studyscan_account_audit(actor,action,target) values(p.id,'acceptTeacherInvite',i.email);
 end if;
 return jsonb_build_object('accepted',action='accept','email',i.email);
end;$$;
revoke all on function public.studyscan_teacher_invitation(text,jsonb) from public,anon;
grant execute on function public.studyscan_teacher_invitation(text,jsonb) to authenticated;

-- Only the email backend can reserve a token hash and report delivery.
create function public.studyscan_teacher_invite_delivery(actor_id uuid,operation text,payload jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare p public.studyscan_profiles;i public.studyscan_teacher_invites;target_email text;
begin
 perform pg_advisory_xact_lock(7624511);
 select * into p from public.studyscan_profiles where id=actor_id and role='super-admin' and status='active';
 if p.id is null then raise exception 'Super Admin access required.';end if;
 if operation='finish' then
  update public.studyscan_teacher_invites set delivery=case when payload->>'sent'='true' then 'sent' else 'failed' end where id=(payload->>'id')::uuid and token_hash=payload->>'hash' and revoked_at is null and accepted_at is null;
  return '{"ok":true}';
 end if;
 if operation<>'reserve' then raise exception 'Unknown delivery action.';end if;
 target_email=lower(trim(payload->>'email'));
 if length(target_email)>254 or target_email !~ '^[A-Za-z0-9.!#$%&''*+/=?^_`{|}~-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$' then raise exception 'Enter a valid Google account email.';end if;
 if exists(select 1 from public.studyscan_profiles where lower(email)=target_email and (role<>'student' or status<>'active')) then raise exception 'This account already has staff access or is suspended.';end if;
 select * into i from public.studyscan_teacher_invites where email=target_email and accepted_at is null and revoked_at is null for update;
 if i.id is not null and coalesce(payload->>'resend','false')<>'true' then raise exception 'A pending invitation already exists. Use Resend or Revoke.';end if;
 if i.id is not null and i.attempted>now()-interval '1 minute' then raise exception 'Wait one minute before resending.';end if;
 if (select count(*) from public.studyscan_account_audit where actor=p.id and action='sendTeacherInvite' and created>now()-interval '1 hour')>=10 then raise exception 'Hourly invitation limit reached. Try again later.';end if;
 if (select count(*) from public.studyscan_account_audit where action='sendTeacherInvite' and created>now()-interval '1 hour')>=30 then raise exception 'School invitation limit reached. Try again later.';end if;
 if coalesce(payload->>'hash','') !~ '^[0-9a-f]{64}$' then raise exception 'Invalid invitation token.';end if;
 if i.id is null then
  insert into public.studyscan_teacher_invites(id,email,invited_by,token_hash) values((payload->>'id')::uuid,target_email,p.id,payload->>'hash') returning * into i;
 else
  update public.studyscan_teacher_invites set invited_by=p.id,token_hash=payload->>'hash',attempted=now(),expires=now()+interval '7 days',delivery='sending' where id=i.id returning * into i;
 end if;
 insert into public.studyscan_account_audit(actor,action,target) values(p.id,'sendTeacherInvite',target_email);
 return jsonb_build_object('id',i.id,'email',i.email,'expires',i.expires);
end;$$;
revoke all on function public.studyscan_teacher_invite_delivery(uuid,text,jsonb) from public,anon,authenticated;
grant execute on function public.studyscan_teacher_invite_delivery(uuid,text,jsonb) to service_role;
commit;
