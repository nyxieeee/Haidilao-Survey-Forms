begin;

do $$
begin
  if not exists (select from pg_catalog.pg_publication where pubname = 'supabase_realtime') then
    create publication supabase_realtime;
  end if;

  if not exists (
    select from pg_catalog.pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'tasting_responses'
  ) then
    alter publication supabase_realtime add table public.tasting_responses;
  end if;
end;
$$;

commit;
