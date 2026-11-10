-- Search-result feedback. Same private schema and service-role RPC pattern as
-- explanation feedback. Not applied to production by this change; apply at go-live
-- on project ixxeidpdgktzvcbucosq only.

create table if not exists hpd_feedback.search_feedback (
  id            uuid primary key default gen_random_uuid(),
  query_text    text not null check (char_length(query_text) between 1 and 200),
  intent        text not null check (char_length(intent) between 1 and 80),
  result_ids    text[] not null check (cardinality(result_ids) between 1 and 24),
  helpful       boolean not null,
  reason        text check (reason is null or reason in (
                  'missing_scripture', 'wrong_category', 'irrelevant', 'wrong_interpretation', 'other'
                )),
  submitter_key text not null check (submitter_key ~ '^[0-9a-f]{64}$'),
  created_at    timestamptz not null default now(),
  constraint search_feedback_reason_when_unhelpful check (helpful or reason is not null)
);

comment on table hpd_feedback.search_feedback is
  'Anonymous “did these results address your search?” rows. Insert-only via public.hpd_feedback_search_submit.';

create index if not exists search_feedback_created_idx on hpd_feedback.search_feedback (created_at desc);
create index if not exists search_feedback_intent_idx on hpd_feedback.search_feedback (intent, created_at desc);

alter table hpd_feedback.search_feedback enable row level security;

revoke all on table hpd_feedback.search_feedback from public;
do $$
begin
  if exists (select 1 from pg_roles where rolname = 'anon') then
    execute 'revoke all on table hpd_feedback.search_feedback from anon';
  end if;
  if exists (select 1 from pg_roles where rolname = 'authenticated') then
    execute 'revoke all on table hpd_feedback.search_feedback from authenticated';
  end if;
end $$;

create or replace function public.hpd_feedback_search_submit(
  p_query text,
  p_intent text,
  p_result_ids text[],
  p_helpful boolean,
  p_reason text,
  p_submitter_key text,
  p_ip_key text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id uuid;
  v_recent integer;
begin
  if p_submitter_key !~ '^[0-9a-f]{64}$' or p_ip_key !~ '^[0-9a-f]{64}$' then
    raise exception 'invalid key' using errcode = '22023';
  end if;
  if p_query is null or char_length(btrim(p_query)) < 1 or char_length(p_query) > 200 then
    raise exception 'invalid query' using errcode = '22023';
  end if;
  if p_intent is null or char_length(btrim(p_intent)) < 1 or char_length(p_intent) > 80 then
    raise exception 'invalid intent' using errcode = '22023';
  end if;
  if p_helpful is null or (p_helpful = false and (p_reason is null or p_reason not in (
    'missing_scripture', 'wrong_category', 'irrelevant', 'wrong_interpretation', 'other'
  ))) then
    raise exception 'invalid reason' using errcode = '22023';
  end if;
  if p_result_ids is null or cardinality(p_result_ids) < 1 or cardinality(p_result_ids) > 24 then
    raise exception 'invalid results' using errcode = '22023';
  end if;
  if exists (
    select 1 from unnest(p_result_ids) as rid
    where rid !~ '^[a-z0-9]+(-[a-z0-9]+){1,8}$' or char_length(rid) > 40
  ) then
    raise exception 'invalid result id' using errcode = '22023';
  end if;

  select count(*) into v_recent from hpd_feedback.search_feedback
    where submitter_key = p_submitter_key and created_at > now() - interval '1 hour';
  if v_recent >= 30 then
    return jsonb_build_object('status', 'rate_limited');
  end if;

  insert into hpd_feedback.search_feedback (query_text, intent, result_ids, helpful, reason, submitter_key)
  values (btrim(p_query), btrim(p_intent), p_result_ids, p_helpful, p_reason, p_submitter_key)
  returning id into v_id;

  return jsonb_build_object('status', 'created', 'id', v_id);
end
$$;

revoke all on function public.hpd_feedback_search_submit(text, text, text[], boolean, text, text, text) from public;
do $$
begin
  if exists (select 1 from pg_roles where rolname = 'anon') then
    execute 'revoke all on function public.hpd_feedback_search_submit(text, text, text[], boolean, text, text, text) from anon';
  end if;
  if exists (select 1 from pg_roles where rolname = 'authenticated') then
    execute 'revoke all on function public.hpd_feedback_search_submit(text, text, text[], boolean, text, text, text) from authenticated';
  end if;
  if exists (select 1 from pg_roles where rolname = 'service_role') then
    execute 'grant execute on function public.hpd_feedback_search_submit(text, text, text[], boolean, text, text, text) to service_role';
  end if;
end $$;
