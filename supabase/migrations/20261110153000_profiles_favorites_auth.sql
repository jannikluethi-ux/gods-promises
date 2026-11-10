-- His Promise Daily: Supabase Auth profiles, favorites, and server-verified feedback identity.
--
-- Apply on the existing project his-promise-daily (ref ixxeidpdgktzvcbucosq) AFTER
-- 20261109120000_explanation_feedback.sql. Do not create another project.
--
-- Browser clients use the anon/publishable key and RLS. They cannot grant a subscription,
-- change account status, or delete auth.users. Account deletion is the Vercel function
-- api/account.js, which verifies the access token and then calls the Auth admin API
-- with the service-role key. Subscription changes go through hpd_private.set_subscription
-- (service_role only) or a service-role update. raw_user_meta_data is never used for
-- authorization; the signup trigger reads display_name from it only as a label seed.

create schema if not exists hpd_private;

revoke all on schema hpd_private from public;
do $$
begin
  if exists (select 1 from pg_roles where rolname = 'anon') then
    execute 'revoke all on schema hpd_private from anon';
  end if;
  if exists (select 1 from pg_roles where rolname = 'authenticated') then
    execute 'revoke all on schema hpd_private from authenticated';
  end if;
  if exists (select 1 from pg_roles where rolname = 'service_role') then
    execute 'grant usage on schema hpd_private to service_role';
  end if;
end $$;

-- ———————————————————————— Profiles ————————————————————————

create table if not exists public.profiles (
  id                        uuid primary key references auth.users (id) on delete cascade,
  email                     text,
  display_name              text not null default ''
                            check (char_length(display_name) <= 80 and display_name !~ '[[:cntrl:]]'),
  account_status            text not null default 'active'
                            check (account_status in ('active', 'disabled')),
  preferred_bible_version   text
                            check (preferred_bible_version is null
                                   or preferred_bible_version in ('web', 'kjv', 'asv', 'ylt', 'darby', 'dra')),
  reading_prefs             jsonb not null default '{}'::jsonb
                            check (jsonb_typeof(reading_prefs) = 'object'
                                   and pg_column_size(reading_prefs) < 4000),
  -- Server-managed entitlement. Clients have no UPDATE privilege on these columns.
  subscription_status       text not null default 'none'
                            check (subscription_status in ('none', 'inactive', 'active', 'canceled', 'expired')),
  subscription_expires_at   timestamptz,
  subscription_canceled_at  timestamptz,
  subscription_updated_at   timestamptz,
  created_at                timestamptz not null default now(),
  updated_at                timestamptz not null default now(),
  check (email is null or char_length(email) <= 320)
);

comment on table public.profiles is
  'One row per auth.users id. Owner-readable. Owner may update display name, Bible version, and reading prefs only.';
comment on column public.profiles.subscription_status is
  'none | inactive | active | canceled | expired. Changed only by service_role (hpd_private.set_subscription). Never from user_metadata.';
comment on column public.profiles.account_status is
  'active | disabled. Disabled is a server-side block. The browser cannot change it.';

alter table public.profiles enable row level security;

revoke all on table public.profiles from public;
do $$
begin
  if exists (select 1 from pg_roles where rolname = 'anon') then
    execute 'revoke all on table public.profiles from anon';
  end if;
  if exists (select 1 from pg_roles where rolname = 'authenticated') then
    execute 'revoke all on table public.profiles from authenticated';
    execute 'grant select on table public.profiles to authenticated';
    execute 'grant update (display_name, preferred_bible_version, reading_prefs) on table public.profiles to authenticated';
  end if;
end $$;

drop policy if exists profiles_select_own on public.profiles;
create policy profiles_select_own
  on public.profiles
  for select
  to authenticated
  using (id = (select auth.uid()));

drop policy if exists profiles_update_own on public.profiles;
create policy profiles_update_own
  on public.profiles
  for update
  to authenticated
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()));

-- No INSERT or DELETE policy: the signup trigger creates the row, and deleting
-- auth.users cascades the profile. Authenticated clients cannot insert a profile
-- (which would let them choose protected columns) or delete one directly.

-- ———————————————————————— Favorites ————————————————————————

create table if not exists public.favorites (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null default auth.uid() references auth.users (id) on delete cascade,
  promise_id  text not null
              check (promise_id ~ '^[a-z0-9]+(-[0-9]+){2,3}$' and char_length(promise_id) <= 40),
  created_at  timestamptz not null default now(),
  constraint favorites_user_promise_unique unique (user_id, promise_id)
);

comment on table public.favorites is
  'Saved promise ids for the signed-in user. The public catalog is not stored here.';

create index if not exists favorites_user_created_idx
  on public.favorites (user_id, created_at);

alter table public.favorites enable row level security;

revoke all on table public.favorites from public;
do $$
begin
  if exists (select 1 from pg_roles where rolname = 'anon') then
    execute 'revoke all on table public.favorites from anon';
  end if;
  if exists (select 1 from pg_roles where rolname = 'authenticated') then
    execute 'revoke all on table public.favorites from authenticated';
    execute 'grant select, insert, delete on table public.favorites to authenticated';
  end if;
end $$;

drop policy if exists favorites_select_own on public.favorites;
create policy favorites_select_own
  on public.favorites
  for select
  to authenticated
  using (user_id = (select auth.uid()));

drop policy if exists favorites_insert_own on public.favorites;
create policy favorites_insert_own
  on public.favorites
  for insert
  to authenticated
  with check (user_id = (select auth.uid()));

drop policy if exists favorites_delete_own on public.favorites;
create policy favorites_delete_own
  on public.favorites
  for delete
  to authenticated
  using (user_id = (select auth.uid()));

-- ———————————————————————— Private trigger functions ————————————————————————

create or replace function hpd_private.protect_profile_columns()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if (select auth.role()) = 'authenticated' then
    if new.id is distinct from old.id
       or new.email is distinct from old.email
       or new.account_status is distinct from old.account_status
       or new.subscription_status is distinct from old.subscription_status
       or new.subscription_expires_at is distinct from old.subscription_expires_at
       or new.subscription_canceled_at is distinct from old.subscription_canceled_at
       or new.subscription_updated_at is distinct from old.subscription_updated_at
       or new.created_at is distinct from old.created_at
    then
      raise exception 'cannot change protected profile fields' using errcode = '42501';
    end if;
  end if;
  if new.subscription_status is distinct from old.subscription_status
     or new.subscription_expires_at is distinct from old.subscription_expires_at
     or new.subscription_canceled_at is distinct from old.subscription_canceled_at
  then
    new.subscription_updated_at := pg_catalog.now();
  end if;
  new.updated_at := pg_catalog.now();
  return new;
end
$$;

drop trigger if exists profiles_protect_columns on public.profiles;
create trigger profiles_protect_columns
  before update on public.profiles
  for each row execute function hpd_private.protect_profile_columns();

create or replace function hpd_private.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_name text;
begin
  -- display_name in raw_user_meta_data is a label the user typed at signup.
  -- It is not an authorization claim. Entitlement columns stay at their defaults.
  v_name := pg_catalog.left(
    pg_catalog.regexp_replace(
      pg_catalog.btrim(coalesce(new.raw_user_meta_data->>'display_name', '')),
      '[[:cntrl:]]', '', 'g'),
    80);
  if v_name = '' then
    v_name := pg_catalog.left(split_part(coalesce(new.email, ''), '@', 1), 80);
  end if;
  insert into public.profiles (id, email, display_name)
  values (new.id, new.email, coalesce(v_name, ''))
  on conflict (id) do nothing;
  return new;
end
$$;

drop trigger if exists hpd_on_auth_user_created on auth.users;
create trigger hpd_on_auth_user_created
  after insert on auth.users
  for each row execute function hpd_private.handle_new_user();

create or replace function hpd_private.sync_user_email()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.profiles
     set email = new.email
   where id = new.id;
  return new;
end
$$;

drop trigger if exists hpd_on_auth_user_email on auth.users;
create trigger hpd_on_auth_user_email
  after update of email on auth.users
  for each row
  when (new.email is distinct from old.email)
  execute function hpd_private.sync_user_email();

create or replace function hpd_private.set_subscription(
  p_user_id uuid,
  p_status text,
  p_expires_at timestamptz,
  p_canceled_at timestamptz
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if p_status not in ('none', 'inactive', 'active', 'canceled', 'expired') then
    raise exception 'invalid subscription status' using errcode = '22023';
  end if;
  update public.profiles
     set subscription_status = p_status,
         subscription_expires_at = p_expires_at,
         subscription_canceled_at = p_canceled_at
   where id = p_user_id;
  if not found then
    raise exception 'profile not found' using errcode = 'P0002';
  end if;
end
$$;

comment on function hpd_private.set_subscription(uuid, text, timestamptz, timestamptz) is
  'Trusted subscription write. Execute is granted to service_role only. Not exposed to the browser.';

revoke all on function hpd_private.protect_profile_columns() from public;
revoke all on function hpd_private.handle_new_user() from public;
revoke all on function hpd_private.sync_user_email() from public;
revoke all on function hpd_private.set_subscription(uuid, text, timestamptz, timestamptz) from public;
do $$
begin
  if exists (select 1 from pg_roles where rolname = 'anon') then
    execute 'revoke all on function hpd_private.protect_profile_columns() from anon';
    execute 'revoke all on function hpd_private.handle_new_user() from anon';
    execute 'revoke all on function hpd_private.sync_user_email() from anon';
    execute 'revoke all on function hpd_private.set_subscription(uuid, text, timestamptz, timestamptz) from anon';
  end if;
  if exists (select 1 from pg_roles where rolname = 'authenticated') then
    execute 'revoke all on function hpd_private.protect_profile_columns() from authenticated';
    execute 'revoke all on function hpd_private.handle_new_user() from authenticated';
    execute 'revoke all on function hpd_private.sync_user_email() from authenticated';
    execute 'revoke all on function hpd_private.set_subscription(uuid, text, timestamptz, timestamptz) from authenticated';
  end if;
  if exists (select 1 from pg_roles where rolname = 'service_role') then
    execute 'grant execute on function hpd_private.set_subscription(uuid, text, timestamptz, timestamptz) to service_role';
    -- service_role bypasses RLS but still needs table grants for direct SQL/REST.
    -- The browser roles are not granted these privileges.
    execute 'grant select, update, delete on table public.profiles to service_role';
    execute 'grant select, insert, update, delete on table public.favorites to service_role';
  end if;
end $$;

-- ———————————————————————— Feedback identity ————————————————————————
-- Keep anonymous submissions. Add a nullable auth user id that the server sets
-- only after verifying an access token. The old browser-supplied local_user_id
-- argument is still accepted so existing service-role callers keep compiling,
-- and it is discarded.

alter table hpd_feedback.explanation_feedback
  add column if not exists auth_user_id uuid;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'explanation_feedback_auth_user_fkey'
  ) then
    alter table hpd_feedback.explanation_feedback
      add constraint explanation_feedback_auth_user_fkey
      foreign key (auth_user_id) references auth.users (id) on delete set null;
  end if;
end $$;

create index if not exists explanation_feedback_auth_user_idx
  on hpd_feedback.explanation_feedback (auth_user_id)
  where auth_user_id is not null;

comment on column hpd_feedback.explanation_feedback.local_user_id is
  'Historical browser-local id from before Supabase Auth. New submissions store null. Not an authorization identity.';
comment on column hpd_feedback.explanation_feedback.auth_user_id is
  'auth.users id verified by the API from the caller access token. Null for anonymous feedback. Never taken from the JSON body.';

drop function if exists public.hpd_feedback_submit(
  text, text, text, integer, integer, integer, text, text, text, text, text[], text, text, text, text, text
);

create or replace function public.hpd_feedback_submit(
  p_verse_id text,
  p_reference text,
  p_book text,
  p_chapter integer,
  p_verse_start integer,
  p_verse_end integer,
  p_explanation_version text,
  p_explanation_sha256 text,
  p_language text,
  p_rating text,
  p_categories text[],
  p_comment text,
  p_local_user_id text,
  p_submitter_key text,
  p_ip_key text,
  p_source text,
  p_auth_user_id uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id uuid;
  v_ip_recent integer;
  v_ip_day integer;
  v_sub_recent integer;
begin
  if p_ip_key !~ '^[0-9a-f]{64}$' then
    raise exception 'invalid ip key' using errcode = '22023';
  end if;

  -- The pre-auth local id is not a verified identity. Discard it.
  p_local_user_id := null;

  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('hpd_fb:' || p_submitter_key, 0));

  delete from hpd_feedback.rate_events where created_at < pg_catalog.now() - interval '2 days';

  select count(*) into v_ip_recent from hpd_feedback.rate_events
    where bucket = 'ip' and key_hash = p_ip_key and created_at > pg_catalog.now() - interval '10 minutes';
  select count(*) into v_ip_day from hpd_feedback.rate_events
    where bucket = 'ip' and key_hash = p_ip_key and created_at > pg_catalog.now() - interval '1 day';
  select count(*) into v_sub_recent from hpd_feedback.rate_events
    where bucket = 'submitter' and key_hash = p_submitter_key and created_at > pg_catalog.now() - interval '10 minutes';

  if v_ip_recent >= 30 or v_ip_day >= 300 or v_sub_recent >= 15 then
    return pg_catalog.jsonb_build_object('status', 'rate_limited');
  end if;

  insert into hpd_feedback.rate_events (bucket, key_hash)
    values ('ip', p_ip_key), ('submitter', p_submitter_key);

  insert into hpd_feedback.explanation_feedback (
    verse_id, reference, book, chapter, verse_start, verse_end,
    explanation_version, explanation_sha256, language, rating, categories,
    comment, local_user_id, auth_user_id, submitter_key, source
  ) values (
    p_verse_id, p_reference, p_book, p_chapter, p_verse_start, p_verse_end,
    p_explanation_version, p_explanation_sha256, coalesce(p_language, 'en'), p_rating,
    coalesce((select pg_catalog.array_agg(distinct c order by c) from pg_catalog.unnest(p_categories) c), '{}'::text[]),
    nullif(pg_catalog.btrim(p_comment), ''), null, p_auth_user_id, p_submitter_key, coalesce(p_source, 'card')
  )
  on conflict on constraint explanation_feedback_one_per_submitter do nothing
  returning id into v_id;

  if v_id is null then
    return pg_catalog.jsonb_build_object('status', 'duplicate');
  end if;
  return pg_catalog.jsonb_build_object('status', 'created', 'id', v_id);
end
$$;

revoke all on function public.hpd_feedback_submit(text, text, text, integer, integer, integer, text, text, text, text, text[], text, text, text, text, text, uuid) from public;
do $$
begin
  if exists (select 1 from pg_roles where rolname = 'anon') then
    execute 'revoke all on function public.hpd_feedback_submit(text, text, text, integer, integer, integer, text, text, text, text, text[], text, text, text, text, text, uuid) from anon';
  end if;
  if exists (select 1 from pg_roles where rolname = 'authenticated') then
    execute 'revoke all on function public.hpd_feedback_submit(text, text, text, integer, integer, integer, text, text, text, text, text[], text, text, text, text, text, uuid) from authenticated';
  end if;
  if exists (select 1 from pg_roles where rolname = 'service_role') then
    execute 'grant execute on function public.hpd_feedback_submit(text, text, text, integer, integer, integer, text, text, text, text, text[], text, text, text, text, text, uuid) to service_role';
  end if;
end $$;
