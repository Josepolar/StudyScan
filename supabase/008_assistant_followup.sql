begin;
create or replace function public.studyscan_ai_finish(interaction_id uuid,answer_text text,answer_sources jsonb,answer_status text) returns void language plpgsql security definer set search_path='' as $$begin
if answer_status not in ('answered','needs-teacher','out-of-scope','unavailable') or length(answer_text)>6000 or jsonb_array_length(answer_sources)>4 then raise exception 'Invalid assistant response.';end if;
update public.studyscan_interactions set answer=answer_text,sources=answer_sources,status=answer_status,flagged=flagged or answer_status in ('needs-teacher','unavailable') where id=interaction_id and status='pending';end;$$;
revoke all on function public.studyscan_ai_finish(uuid,text,jsonb,text) from public,anon,authenticated;grant execute on function public.studyscan_ai_finish(uuid,text,jsonb,text) to service_role;
commit;
