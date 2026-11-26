begin;

create table public.tasting_admins (
  user_id uuid primary key references auth.users(id) on delete cascade
);

create table public.tasting_settings (
  id integer primary key check (id = 1),
  accepting boolean not null default true
);
insert into public.tasting_settings (id) values (1);

create table public.tasting_responses (
  id bigint generated always as identity primary key,
  submission_id uuid not null unique,
  created_at timestamptz not null default now(),
  ratings smallint[] not null check (
    array_ndims(ratings) = 1 and cardinality(ratings) = 5
    and array_lower(ratings, 1) = 1
    and array_position(ratings, null) is null
    and ratings <@ array[1, 2, 3, 4, 5]::smallint[]
  ),
  favorite smallint not null check (favorite between 1 and 5),
  intent text not null check (intent in ('Yes', 'Maybe', 'No')),
  comment text not null default '' check (char_length(comment) <= 1500),
  reviewed boolean not null default false
);

alter table public.tasting_admins enable row level security;
alter table public.tasting_settings enable row level security;
alter table public.tasting_responses enable row level security;

revoke all privileges on public.tasting_admins, public.tasting_settings, public.tasting_responses from public, anon, authenticated;
grant select on public.tasting_settings to anon, authenticated;
grant select on public.tasting_responses to authenticated;
grant update (reviewed) on public.tasting_responses to authenticated;
grant update (accepting) on public.tasting_settings to authenticated;

create function public.is_tasting_admin()
returns boolean
language sql stable security definer
set search_path = ''
as $$
  select exists (select 1 from public.tasting_admins where user_id = auth.uid());
$$;

revoke execute on function public.is_tasting_admin() from public, anon, authenticated;
grant execute on function public.is_tasting_admin() to authenticated;

create policy "Guests can read survey status" on public.tasting_settings for select to anon, authenticated using (true);
create policy "Staff can change survey status" on public.tasting_settings for update to authenticated
  using ((select public.is_tasting_admin())) with check ((select public.is_tasting_admin()));
create policy "Staff can read responses" on public.tasting_responses for select to authenticated
  using ((select public.is_tasting_admin()));
create policy "Staff can review responses" on public.tasting_responses for update to authenticated
  using ((select public.is_tasting_admin())) with check ((select public.is_tasting_admin()));

create function public.submit_tasting(
  p_submission_id uuid, p_ratings smallint[], p_favorite smallint, p_intent text, p_comment text
)
returns text
language plpgsql security definer
set search_path = ''
as $$
declare
  is_open boolean;
begin
  if exists (select 1 from public.tasting_responses where submission_id = p_submission_id) then
    return 'accepted';
  end if;

  select accepting into is_open from public.tasting_settings where id = 1 for share;
  if is_open is distinct from true then
    if exists (select 1 from public.tasting_responses where submission_id = p_submission_id) then
      return 'accepted';
    end if;
    return 'paused';
  end if;

  insert into public.tasting_responses (submission_id, ratings, favorite, intent, comment)
    values (p_submission_id, p_ratings, p_favorite, p_intent, coalesce(btrim(p_comment), ''))
    on conflict (submission_id) do nothing;
  return 'accepted';
end;
$$;

revoke execute on function public.submit_tasting(uuid, smallint[], smallint, text, text) from public, anon, authenticated;
grant execute on function public.submit_tasting(uuid, smallint[], smallint, text, text) to anon, authenticated;

create function public.tasting_summary()
returns jsonb
language sql stable security invoker
set search_path = ''
as $$
  select jsonb_build_object(
    'total', count(*),
    'unreviewed', count(*) filter (where not reviewed),
    'wouldBuy', count(*) filter (where intent = 'Yes'),
    'averages', jsonb_build_array(avg(ratings[1]), avg(ratings[2]), avg(ratings[3]), avg(ratings[4]), avg(ratings[5])),
    'favorites', jsonb_build_array(
      count(*) filter (where favorite = 1), count(*) filter (where favorite = 2),
      count(*) filter (where favorite = 3), count(*) filter (where favorite = 4),
      count(*) filter (where favorite = 5)
    )
  ) from public.tasting_responses;
$$;

revoke execute on function public.tasting_summary() from public, anon, authenticated;
grant execute on function public.tasting_summary() to authenticated;

commit;
