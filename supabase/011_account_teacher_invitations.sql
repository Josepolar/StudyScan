begin;
-- Email is a notification channel. A verified Google account can also find and
-- explicitly accept its own invitation without depending on inbox placement.
create function public.studyscan_account_invitation(action text, invitation_id uuid default null) returns jsonb
language plpgsql security definer set search_path='' as $$
declare p public.studyscan_profiles; i public.studyscan_teacher_invites; verified_email text;
begin
 perform pg_advisory_xact_lock(7624511);
 p=public.studyscan_actor();
 if action not in ('pending','accept') then raise exception 'Unknown invitation action.';end if;
 if p.role<>'student' then
  if action='pending' then return 'null'::jsonb;end if;
  raise exception 'This account already has staff access.';
 end if;
 select lower(email) into verified_email from auth.users where id=p.id and email_confirmed_at is not null;
 if verified_email is null or not exists(
  select 1 from auth.identities where user_id=p.id and provider='google'
  and lower(identity_data->>'email')=verified_email and identity_data->>'email_verified'='true'
 ) then
  if action='pending' then return 'null'::jsonb;end if;
  raise exception 'Use Google sign-in with the invited email before accepting.';
 end if;
 select invites.* into i from public.studyscan_teacher_invites invites
 where invites.email=verified_email and invites.accepted_at is null and invites.revoked_at is null
 and invites.expires>now() and invites.delivery='sent'
 and (action='pending' or invites.id=invitation_id)
 and exists(select 1 from public.studyscan_profiles inviter where inviter.id=invites.invited_by and inviter.role='super-admin' and inviter.status='active')
 for update;
 if i.id is null then
  if action='pending' then return 'null'::jsonb;end if;
  raise exception 'No active invitation exists for this Google account. Ask your administrator for a new invitation.';
 end if;
 if action='accept' then
  update public.studyscan_profiles set role='teacher' where id=p.id;
  update public.studyscan_teacher_invites set accepted_by=p.id,accepted_at=now() where id=i.id;
  insert into public.studyscan_account_audit(actor,action,target) values(p.id,'acceptTeacherInvite',i.email);
 end if;
 return jsonb_build_object('id',i.id,'email',i.email,'expires',i.expires,'accepted',action='accept');
end;$$;
revoke all on function public.studyscan_account_invitation(text,uuid) from public,anon;
grant execute on function public.studyscan_account_invitation(text,uuid) to authenticated;
commit;
