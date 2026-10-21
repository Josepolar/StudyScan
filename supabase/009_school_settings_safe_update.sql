-- Target the singleton school row explicitly for Supabase safe-update protection.
do $migration$
declare fn record; definition text;
begin
 for fn in select p.oid from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname in ('studyscan_mutate_core','studyscan_mutate') loop
  definition=pg_get_functiondef(fn.oid);
  definition=regexp_replace(definition,'update public\.studyscan_school set ([^;]+);','update public.studyscan_school set \1 where id = true;','gi');
  execute definition;
 end loop;
end;
$migration$;
