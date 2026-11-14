-- Design only. Not applied to production.
-- Do not run this against ixxeidpdgktzvcbucosq as part of a deploy.
-- The live gate is the Vercel environment variables documented in
-- docs/kjv-admin-gate.md. This table is a later place to store an
-- append-only history if an admin screen is built. service_role only.

create schema if not exists hpd_admin;

create table if not exists hpd_admin.kjv_access_config (
  id            integer primary key default 1 check (id = 1),
  global_enabled boolean not null default false,
  allowed_countries text[] not null default '{}',
  restricted_countries text[] not null default '{GB,GG,JE,IM}',
  enable_restricted boolean not null default false,
  updated_at    timestamptz not null default now()
);

create table if not exists hpd_admin.kjv_access_audit (
  id            uuid primary key default gen_random_uuid(),
  actor_id      uuid,
  actor_label   text not null check (char_length(actor_label) between 1 and 200),
  previous_config jsonb not null,
  new_config    jsonb not null,
  reason        text not null check (char_length(reason) between 1 and 500),
  created_at    timestamptz not null default now()
);

comment on table hpd_admin.kjv_access_audit is
  'Append-only. No update or delete for any role except the table owner via a later migration.';

alter table hpd_admin.kjv_access_config enable row level security;
alter table hpd_admin.kjv_access_audit enable row level security;

revoke all on schema hpd_admin from public;
revoke all on table hpd_admin.kjv_access_config from public;
revoke all on table hpd_admin.kjv_access_audit from public;

do $$
begin
  if exists (select 1 from pg_roles where rolname = 'anon') then
    execute 'revoke all on schema hpd_admin from anon';
    execute 'revoke all on table hpd_admin.kjv_access_config from anon';
    execute 'revoke all on table hpd_admin.kjv_access_audit from anon';
  end if;
  if exists (select 1 from pg_roles where rolname = 'authenticated') then
    execute 'revoke all on schema hpd_admin from authenticated';
    execute 'revoke all on table hpd_admin.kjv_access_config from authenticated';
    execute 'revoke all on table hpd_admin.kjv_access_audit from authenticated';
  end if;
  if exists (select 1 from pg_roles where rolname = 'service_role') then
    execute 'grant usage on schema hpd_admin to service_role';
    execute 'grant select, insert, update on table hpd_admin.kjv_access_config to service_role';
    execute 'grant select, insert on table hpd_admin.kjv_access_audit to service_role';
  end if;
end $$;
