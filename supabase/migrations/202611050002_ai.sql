-- Phase 5: Gemini key vault, saved AI results, atomic per-user request limits and consent.
-- No service-role key: owners reach their own rows through RLS, and limits/consent go through
-- narrow security-definer functions that derive the owner from auth.uid().
begin;

create table public.provider_credentials (
  owner uuid primary key references auth.users(id) on delete cascade,
  provider text not null default 'gemini' check (provider = 'gemini'),
  -- AES-256-GCM, base64. Encryption keys live only in server secrets, never in the database.
  ciphertext text not null check (length(ciphertext) between 4 and 1024),
  nonce text not null check (length(nonce) = 16),
  auth_tag text not null check (length(auth_tag) = 24),
  key_version text not null check (key_version ~ '^v[0-9]{1,4}$'),
  key_hint text not null check (key_hint ~ '^[A-Za-z0-9_.-]{4}$'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.ai_results (
  id uuid primary key default gen_random_uuid(),
  owner uuid not null references auth.users(id) on delete cascade,
  action text not null check (action in ('verdict', 'finder')),
  media_type text not null check (media_type in ('movie', 'tv')),
  tmdb_id integer check (tmdb_id > 0),
  result jsonb not null check (jsonb_typeof(result) = 'object' and octet_length(result::text) <= 16384),
  model text not null check (length(model) between 1 and 80),
  prompt_version text not null check (length(prompt_version) between 1 and 40),
  schema_version text not null check (length(schema_version) between 1 and 40),
  taste_fingerprint text not null check (taste_fingerprint ~ '^[0-9a-f]{64}$'),
  created_at timestamptz not null default now(),
  constraint verdict_subject check ((action = 'verdict') = (tmdb_id is not null))
);
create index ai_results_owner_created on public.ai_results (owner, created_at desc);

create table public.ai_requests (
  id uuid primary key default gen_random_uuid(),
  owner uuid not null references auth.users(id) on delete cascade,
  action text not null check (action in ('verdict', 'finder')),
  idempotency_key uuid not null,
  status text not null default 'pending' check (status in ('pending', 'done', 'failed')),
  created_at timestamptz not null default now(),
  finished_at timestamptz,
  unique (owner, idempotency_key)
);
create index ai_requests_owner_created on public.ai_requests (owner, created_at);

create trigger credentials_updated before update on public.provider_credentials
for each row execute function public.touch_updated_at();

alter table public.provider_credentials enable row level security;
alter table public.ai_results enable row level security;
alter table public.ai_requests enable row level security;
create policy credentials_own on public.provider_credentials for all to authenticated
using ((select auth.uid()) = owner) with check ((select auth.uid()) = owner);
create policy results_own on public.ai_results for all to authenticated
using ((select auth.uid()) = owner) with check ((select auth.uid()) = owner);
-- ai_requests: no policies and no grants; only the functions below touch it.

-- Atomic across serverless instances: a per-user transaction lock serializes the checks.
-- Errors: IW001 duplicate submission, IW002 another request in progress, IW003 daily quota.
create function public.begin_ai_request(p_action text, p_key uuid) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := auth.uid();
  rid uuid;
begin
  if uid is null then raise exception 'authentication required' using errcode = '42501'; end if;
  if p_action is null or p_action not in ('verdict', 'finder') or p_key is null then
    raise exception 'invalid request' using errcode = '22023';
  end if;
  perform pg_advisory_xact_lock(hashtextextended('ai:' || uid::text, 0));
  delete from public.ai_requests where owner = uid and created_at < now() - interval '2 days';
  if exists (select 1 from public.ai_requests where owner = uid and idempotency_key = p_key) then
    raise exception 'duplicate submission' using errcode = 'IW001';
  end if;
  -- A pending row older than two minutes is treated as abandoned (server timeout is far shorter).
  if exists (select 1 from public.ai_requests where owner = uid and status = 'pending' and created_at > now() - interval '2 minutes') then
    raise exception 'request in progress' using errcode = 'IW002';
  end if;
  if (select count(*) from public.ai_requests where owner = uid and created_at > now() - interval '1 day') >= 20 then
    raise exception 'daily limit reached' using errcode = 'IW003';
  end if;
  insert into public.ai_requests (owner, action, idempotency_key) values (uid, p_action, p_key) returning id into rid;
  return rid;
end;
$$;

create function public.finish_ai_request(p_id uuid, p_ok boolean) returns void
language plpgsql security definer set search_path = '' as $$
begin
  update public.ai_requests set status = case when p_ok then 'done' else 'failed' end, finished_at = now()
  where id = p_id and owner = auth.uid() and status = 'pending';
end;
$$;

-- Dedicated consent path (profile consent columns stay non-writable by browser roles).
-- The server compares the stored version with its current disclosure version; null withdraws.
create function public.set_ai_consent(p_version text) returns void
language plpgsql security definer set search_path = '' as $$
declare uid uuid := auth.uid();
begin
  if uid is null then raise exception 'authentication required' using errcode = '42501'; end if;
  if p_version is not null and p_version !~ '^[a-z0-9.-]{1,80}$' then
    raise exception 'invalid consent version' using errcode = '22023';
  end if;
  update public.profiles set consent_version = p_version, consent_at = case when p_version is null then null else now() end
  where owner = uid;
end;
$$;

revoke all on public.provider_credentials, public.ai_results, public.ai_requests from anon, authenticated;
grant select, insert, update, delete on public.provider_credentials to authenticated;
grant select, insert, delete on public.ai_results to authenticated;
revoke all on function public.begin_ai_request(text, uuid), public.finish_ai_request(uuid, boolean), public.set_ai_consent(text) from public, anon, authenticated;
grant execute on function public.begin_ai_request(text, uuid), public.finish_ai_request(uuid, boolean), public.set_ai_consent(text) to authenticated;
commit;
