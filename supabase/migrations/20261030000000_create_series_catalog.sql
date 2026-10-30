create extension if not exists pgcrypto;

create table public.platforms (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  name text not null check (char_length(trim(name)) > 0),
  created_at timestamptz not null default now(),
  unique (id, user_id),
  unique (name, user_id)
);

create table public.series (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  name text not null check (char_length(trim(name)) > 0),
  platform_id uuid not null,
  created_at timestamptz not null default now(),
  unique (id, platform_id, user_id),
  unique (name, platform_id, user_id),
  foreign key (platform_id, user_id)
    references public.platforms(id, user_id)
    on delete restrict
);

create table public.ratings (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  platform_id uuid not null,
  series_id uuid not null,
  score integer not null check (score between 1 and 10),
  observation text not null check (char_length(trim(observation)) > 0),
  created_at timestamptz not null default now(),
  constraint ratings_series_platform_fk
    foreign key (series_id, platform_id, user_id)
    references public.series(id, platform_id, user_id)
    on update cascade
    on delete restrict,
  unique (series_id, user_id)
);

alter table public.platforms enable row level security;
alter table public.series enable row level security;
alter table public.ratings enable row level security;

create policy "Users manage their platforms"
  on public.platforms for all to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Users manage their series"
  on public.series for all to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Users manage their ratings"
  on public.ratings for all to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

grant usage on schema public to anon, authenticated;
grant select, insert, update, delete on public.platforms to authenticated;
grant select, insert, update, delete on public.series to authenticated;
grant select, insert, update, delete on public.ratings to authenticated;
