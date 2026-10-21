-- Run once in this project's Supabase SQL Editor. No password or API key belongs here.
-- Namespaced tables avoid overwriting unrelated application tables.
begin;
create table if not exists public.studyscan_profiles (
 id uuid primary key references auth.users(id) on delete cascade,
 name text not null,
 email text not null,
 role text not null default 'student' check(role in ('super-admin','teacher','student')),
 status text not null default 'active' check(status in ('active','suspended')),
 is_primary_admin boolean not null default false,
 created timestamptz not null default now()
);
create unique index if not exists studyscan_one_primary_admin on public.studyscan_profiles(is_primary_admin) where is_primary_admin;
create table if not exists public.studyscan_teacher_approvals(email text primary key,approved_by uuid references auth.users(id),created timestamptz not null default now());
create table if not exists public.studyscan_account_audit(id uuid primary key default gen_random_uuid(),actor uuid not null references auth.users(id),action text not null,target text not null,created timestamptz not null default now());
create index if not exists studyscan_account_audit_created on public.studyscan_account_audit(created desc);
alter table public.studyscan_profiles enable row level security;
alter table public.studyscan_teacher_approvals enable row level security;
alter table public.studyscan_account_audit enable row level security;

create or replace function public.studyscan_is_admin() returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.studyscan_profiles where id=auth.uid() and role='super-admin' and status='active');
$$;
revoke all on function public.studyscan_is_admin() from public,anon;
grant execute on function public.studyscan_is_admin() to authenticated;
drop policy if exists studyscan_profile_read on public.studyscan_profiles;
create policy studyscan_profile_read on public.studyscan_profiles for select to authenticated using(id=auth.uid() or public.studyscan_is_admin());
drop policy if exists studyscan_audit_read on public.studyscan_account_audit;
create policy studyscan_audit_read on public.studyscan_account_audit for select to authenticated using(public.studyscan_is_admin());
-- No client insert/update/delete grants or policies. Roles cannot come from signup metadata.
revoke all on public.studyscan_profiles,public.studyscan_teacher_approvals,public.studyscan_account_audit from public,anon,authenticated;
grant select on public.studyscan_profiles,public.studyscan_account_audit to authenticated;

create or replace function public.studyscan_ensure_profile() returns public.studyscan_profiles language plpgsql security definer set search_path='' as $$
declare account public.studyscan_profiles; verified_email text; display_name text;
begin
 if auth.uid() is null then raise exception 'Sign in first.';end if;
 select lower(email),left(coalesce(nullif(raw_user_meta_data->>'full_name',''),split_part(email,'@',1)),100) into verified_email,display_name from auth.users where id=auth.uid() and email_confirmed_at is not null;
 if verified_email is null then raise exception 'Confirm your email first.';end if;
 insert into public.studyscan_profiles(id,name,email,role) values(auth.uid(),display_name,verified_email,case when exists(select 1 from public.studyscan_teacher_approvals where email=verified_email) then 'teacher' else 'student' end) on conflict(id) do update set email=excluded.email;
 select * into account from public.studyscan_profiles where id=auth.uid();return account;
end;
$$;
revoke all on function public.studyscan_ensure_profile() from public,anon;
grant execute on function public.studyscan_ensure_profile() to authenticated;

create or replace function public.studyscan_manage_account(operation text,target_id uuid default null,new_value text default '') returns void language plpgsql security definer set search_path='' as $$
declare account public.studyscan_profiles; target_email text;
begin
 -- Serialize administrative changes, including concurrent revocations of administrator access.
 perform pg_advisory_xact_lock(7624511);
 if not public.studyscan_is_admin() then raise exception 'Super Admin access required.';end if;
 if operation='inviteTeacher' then
  target_email=lower(trim(new_value));if target_email !~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$' then raise exception 'Enter a valid teacher email.';end if;
  if exists(select 1 from public.studyscan_profiles where lower(email)=target_email and role='super-admin') then raise exception 'That account is already a Super Admin.';end if;
  insert into public.studyscan_teacher_approvals(email,approved_by) values(target_email,auth.uid()) on conflict(email) do update set approved_by=excluded.approved_by;
  update public.studyscan_profiles set role='teacher' where lower(email)=target_email;
 else
  select * into account from public.studyscan_profiles where id=target_id for update;if not found then raise exception 'Account not found.';end if;
  if account.id=auth.uid() or account.is_primary_admin then raise exception 'Your own account and the primary administrator are protected.';end if;
  target_email=account.email;
  if operation='setRole' then
   if new_value not in ('super-admin','teacher','student') then raise exception 'Choose a valid role.';end if;
   update public.studyscan_profiles set role=new_value where id=target_id;
   delete from public.studyscan_teacher_approvals where email=lower(account.email);
  elsif operation='setAccountStatus' then
   if new_value not in ('active','suspended') then raise exception 'Choose a valid status.';end if;
   update public.studyscan_profiles set status=new_value where id=target_id;
  else raise exception 'Unknown account operation.';end if;
 end if;
 insert into public.studyscan_account_audit(actor,action,target) values(auth.uid(),operation,target_email||' → '||new_value);
end;
$$;
revoke all on function public.studyscan_manage_account(text,uuid,text) from public,anon;
grant execute on function public.studyscan_manage_account(text,uuid,text) to authenticated;
commit;

-- After signing in, promote the intended school owner through the SQL Editor only:
-- update public.studyscan_profiles set role='super-admin',is_primary_admin=true
-- where email='YOUR_VERIFIED_ADMIN_EMAIL';
-- Never automatically promote the first visitor and never embed an admin email in frontend code.
