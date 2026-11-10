-- Opt-in morning promise email.
--
-- Apply on his-promise-daily (ref ixxeidpdgktzvcbucosq) AFTER
-- 20261110153000_profiles_favorites_auth.sql. Do not run this against production
-- until the owner has reviewed it. The site keeps working if this is not applied;
-- the morning email then has nobody to send to.
--
-- The signed-in person may turn daily_verse_email on or off for their own row.
-- They cannot set the timestamp; the trigger records when the choice changes.
-- The send log is not readable by anon or authenticated. The Vercel cron uses
-- the service role, which bypasses RLS, and only after CRON_SECRET is checked.

alter table public.profiles
  add column if not exists daily_verse_email boolean not null default false;

alter table public.profiles
  add column if not exists daily_verse_email_updated_at timestamptz;

comment on column public.profiles.daily_verse_email is
  'Owner opt-in for one morning promise email. Default false. Never implied by signup.';
comment on column public.profiles.daily_verse_email_updated_at is
  'When the owner or the unsubscribe endpoint last changed daily_verse_email. Not client-writable.';

create index if not exists profiles_daily_email_idx
  on public.profiles (id)
  where daily_verse_email and account_status = 'active';

do $$
begin
  if exists (select 1 from pg_roles where rolname = 'authenticated') then
    execute 'grant update (daily_verse_email) on table public.profiles to authenticated';
  end if;
  if exists (select 1 from pg_roles where rolname = 'service_role') then
    execute 'grant select, update on table public.profiles to service_role';
  end if;
end $$;

-- The previous migration's trigger still protects subscription columns.
-- Replace it so the consent timestamp is server-owned as well.

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
       or new.daily_verse_email_updated_at is distinct from old.daily_verse_email_updated_at
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
  if new.daily_verse_email is distinct from old.daily_verse_email then
    new.daily_verse_email_updated_at := pg_catalog.now();
  end if;
  new.updated_at := pg_catalog.now();
  return new;
end
$$;

create table if not exists public.daily_email_sends (
  user_id      uuid not null references auth.users (id) on delete cascade,
  zurich_date  date not null,
  created_at   timestamptz not null default now(),
  primary key (user_id, zurich_date)
);

comment on table public.daily_email_sends is
  'Server-only record of morning emails already handed to Resend, keyed by user and Zurich date. No message body.';

alter table public.daily_email_sends enable row level security;

revoke all on table public.daily_email_sends from public;
do $$
begin
  if exists (select 1 from pg_roles where rolname = 'anon') then
    execute 'revoke all on table public.daily_email_sends from anon';
  end if;
  if exists (select 1 from pg_roles where rolname = 'authenticated') then
    execute 'revoke all on table public.daily_email_sends from authenticated';
  end if;
  if exists (select 1 from pg_roles where rolname = 'service_role') then
    execute 'grant select, insert on table public.daily_email_sends to service_role';
  end if;
end $$;

-- No policies: anon and authenticated cannot see or write the log.
-- service_role bypasses RLS on the hosted project.

notify pgrst, 'reload schema';
