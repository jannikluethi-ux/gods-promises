-- Design only. Not applied to production.
-- Do not run this against ixxeidpdgktzvcbucosq as part of a deploy.
-- The live gate is still the Vercel environment variables in docs/kjv-admin-gate.md.
-- Edited in place because this file has never been applied.
--
-- Table owners and superusers (postgres, supabase_admin) can disable these
-- triggers, alter the tables, or delete rows. The Supabase SQL editor runs
-- as a privileged role. This is not absolute immutability.

create schema if not exists hpd_admin;

create table if not exists hpd_admin.kjv_access_config (
  id                   integer primary key default 1 check (id = 1),
  global_enabled       boolean not null default false,
  allowed_countries    text[] not null default '{}',
  restricted_countries text[] not null default '{GB,GG,JE,IM}',
  enable_restricted    boolean not null default false,
  changed_by           text not null check (char_length(btrim(changed_by)) between 1 and 200),
  change_reason        text not null check (char_length(btrim(change_reason)) between 1 and 500),
  updated_at           timestamptz not null default pg_catalog.now()
);

create table if not exists hpd_admin.kjv_access_audit (
  id                 uuid primary key default pg_catalog.gen_random_uuid(),
  actor_id           uuid,
  actor_label        text not null check (char_length(actor_label) between 1 and 200),
  session_user_name  text not null,
  current_user_name  text not null,
  previous_config    jsonb,
  new_config         jsonb,
  reason             text not null check (char_length(reason) between 1 and 500),
  created_at         timestamptz not null default pg_catalog.now()
);

comment on table hpd_admin.kjv_access_audit is
  'Append-only via the config trigger. Privileged roles can still bypass triggers.';

create or replace function hpd_admin.audit_kjv_config()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if NEW.changed_by is null or pg_catalog.btrim(NEW.changed_by) = '' then
    raise exception 'kjv config change requires changed_by';
  end if;
  if NEW.change_reason is null or pg_catalog.btrim(NEW.change_reason) = '' then
    raise exception 'kjv config change requires change_reason';
  end if;
  NEW.updated_at := pg_catalog.now();
  insert into hpd_admin.kjv_access_audit (
    actor_id, actor_label, session_user_name, current_user_name,
    previous_config, new_config, reason
  ) values (
    auth.uid(),
    NEW.changed_by,
    session_user,
    current_user,
    case when TG_OP = 'INSERT' then null else pg_catalog.to_jsonb(OLD) end,
    pg_catalog.to_jsonb(NEW),
    NEW.change_reason
  );
  return NEW;
end;
$$;

create or replace function hpd_admin.reject_audit_mutation()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  raise exception 'kjv access audit is append-only';
end;
$$;

drop trigger if exists kjv_config_audit on hpd_admin.kjv_access_config;
create trigger kjv_config_audit
  before insert or update on hpd_admin.kjv_access_config
  for each row execute function hpd_admin.audit_kjv_config();

drop trigger if exists kjv_config_no_delete on hpd_admin.kjv_access_config;
create trigger kjv_config_no_delete
  before delete on hpd_admin.kjv_access_config
  for each row execute function hpd_admin.reject_audit_mutation();

drop trigger if exists kjv_config_no_truncate on hpd_admin.kjv_access_config;
create trigger kjv_config_no_truncate
  before truncate on hpd_admin.kjv_access_config
  for each statement execute function hpd_admin.reject_audit_mutation();

drop trigger if exists kjv_audit_no_change on hpd_admin.kjv_access_audit;
create trigger kjv_audit_no_change
  before update or delete on hpd_admin.kjv_access_audit
  for each row execute function hpd_admin.reject_audit_mutation();

drop trigger if exists kjv_audit_no_truncate on hpd_admin.kjv_access_audit;
create trigger kjv_audit_no_truncate
  before truncate on hpd_admin.kjv_access_audit
  for each statement execute function hpd_admin.reject_audit_mutation();

alter table hpd_admin.kjv_access_config enable row level security;
alter table hpd_admin.kjv_access_config force row level security;
alter table hpd_admin.kjv_access_audit enable row level security;
alter table hpd_admin.kjv_access_audit force row level security;

revoke all on schema hpd_admin from public;
revoke all on table hpd_admin.kjv_access_config from public;
revoke all on table hpd_admin.kjv_access_audit from public;
revoke all on function hpd_admin.audit_kjv_config() from public;
revoke all on function hpd_admin.reject_audit_mutation() from public;

do $$
begin
  if exists (select 1 from pg_roles where rolname = 'anon') then
    execute 'revoke all on schema hpd_admin from anon';
    execute 'revoke all on table hpd_admin.kjv_access_config from anon';
    execute 'revoke all on table hpd_admin.kjv_access_audit from anon';
    execute 'revoke all on function hpd_admin.audit_kjv_config() from anon';
    execute 'revoke all on function hpd_admin.reject_audit_mutation() from anon';
  end if;
  if exists (select 1 from pg_roles where rolname = 'authenticated') then
    execute 'revoke all on schema hpd_admin from authenticated';
    execute 'revoke all on table hpd_admin.kjv_access_config from authenticated';
    execute 'revoke all on table hpd_admin.kjv_access_audit from authenticated';
    execute 'revoke all on function hpd_admin.audit_kjv_config() from authenticated';
    execute 'revoke all on function hpd_admin.reject_audit_mutation() from authenticated';
  end if;
  if exists (select 1 from pg_roles where rolname = 'service_role') then
    execute 'grant usage on schema hpd_admin to service_role';
    execute 'grant select, insert, update on table hpd_admin.kjv_access_config to service_role';
    execute 'grant select on table hpd_admin.kjv_access_audit to service_role';
    execute 'grant execute on function hpd_admin.audit_kjv_config() to service_role';
    execute 'grant execute on function hpd_admin.reject_audit_mutation() to service_role';
  end if;
end $$;

-- Seed runs as the migration owner. The trigger records it.
insert into hpd_admin.kjv_access_config (
  id, global_enabled, allowed_countries, restricted_countries, enable_restricted,
  changed_by, change_reason
) values (
  1, false, '{}', '{GB,GG,JE,IM}', false,
  'migration', 'initial empty gate'
) on conflict (id) do nothing;
