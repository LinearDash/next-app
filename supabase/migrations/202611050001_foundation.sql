-- Phase 1: private account/library foundations. Vault/results/atomic AI limits
-- are intentionally designed and migrated in phase 5, before any AI access exists.
begin;

create table public.profiles (
  owner uuid primary key references auth.users(id) on delete cascade,
  onboarding_completed boolean not null default false,
  genre_preferences integer[] not null default '{}',
  consent_version text,
  consent_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint valid_genres check (cardinality(genre_preferences) <= 30 and array_position(genre_preferences, null) is null and 0 < all(genre_preferences)),
  constraint consent_pair check ((consent_version is null) = (consent_at is null)),
  constraint consent_version_length check (consent_version is null or length(consent_version) between 1 and 80)
);

create table public.library_entries (
  id uuid primary key default gen_random_uuid(),
  owner uuid not null references auth.users(id) on delete cascade,
  tmdb_id integer not null check (tmdb_id > 0),
  media_type text not null check (media_type in ('movie', 'tv')),
  status text not null check (status in ('want_to_watch', 'watching', 'watched', 'dropped')),
  reaction smallint check (reaction between 1 and 5),
  tags text[] not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint controlled_tags check (tags <@ array['boring', 'interesting', 'confusing', 'rewatchable']::text[] and cardinality(tags) <= 4 and array_position(tags, null) is null),
  unique (owner, media_type, tmdb_id)
);

create table public.dismissals (
  owner uuid not null references auth.users(id) on delete cascade,
  media_type text not null check (media_type in ('movie', 'tv')),
  tmdb_id integer not null check (tmdb_id > 0),
  created_at timestamptz not null default now(),
  primary key (owner, media_type, tmdb_id)
);

create function public.touch_updated_at() returns trigger
language plpgsql set search_path = '' as $$
begin
  new.updated_at = now();
  return new;
end;
$$;
create trigger profiles_updated before update on public.profiles
for each row execute function public.touch_updated_at();
create trigger library_updated before update on public.library_entries
for each row execute function public.touch_updated_at();

create function public.create_profile() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles (owner) values (new.id) on conflict (owner) do nothing;
  return new;
end;
$$;
create trigger on_auth_user_created after insert on auth.users
for each row execute function public.create_profile();
-- Support an existing development project without resetting its auth users.
insert into public.profiles (owner) select id from auth.users on conflict (owner) do nothing;

alter table public.profiles enable row level security;
alter table public.library_entries enable row level security;
alter table public.dismissals enable row level security;

create policy profiles_read_own on public.profiles for select to authenticated
using ((select auth.uid()) = owner);
create policy profiles_update_own on public.profiles for update to authenticated
using ((select auth.uid()) = owner) with check ((select auth.uid()) = owner);
create policy library_own on public.library_entries for all to authenticated
using ((select auth.uid()) = owner) with check ((select auth.uid()) = owner);
create policy dismissals_own on public.dismissals for all to authenticated
using ((select auth.uid()) = owner) with check ((select auth.uid()) = owner);

-- Explicit grants: consent will be written through a dedicated server path in phase 5.
revoke all on public.profiles, public.library_entries, public.dismissals from anon, authenticated;
grant select on public.profiles to authenticated;
grant update (onboarding_completed, genre_preferences) on public.profiles to authenticated;
grant select, insert, update, delete on public.library_entries, public.dismissals to authenticated;
revoke all on function public.create_profile() from public;
revoke all on function public.touch_updated_at() from public;
-- Primary/unique indexes already begin with owner and cover owner lookups.
commit;
