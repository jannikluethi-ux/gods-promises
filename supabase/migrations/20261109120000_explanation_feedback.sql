-- His Promise Daily: explanation feedback (insert-only via the /api/feedback server function).
--
-- Design:
--   * Raw feedback lives in the private schema hpd_feedback, which is NOT exposed through the
--     Supabase Data API. RLS is enabled with no policies, and anon/authenticated have no grants.
--   * The server function calls two narrow SECURITY DEFINER RPCs in public, executable only by
--     service_role: hpd_feedback_submit (insert + rate limit) and hpd_feedback_status (does THIS
--     submitter already have a row for this verse + explanation version?). Neither returns other
--     people's records.
--   * Feedback is tied to the exact explanation evaluated: explanation_version (the site's
--     EXPLAIN_VERSION) plus explanation_sha256 (hash of the exact text, computed server-side).
--   * Analytics views live in hpd_feedback_analytics (also private, security_invoker).
--   * Nothing here rewrites or replaces published explanations. Feedback is for human review.

create schema if not exists hpd_feedback;
create schema if not exists hpd_feedback_analytics;

revoke all on schema hpd_feedback from public;
revoke all on schema hpd_feedback_analytics from public;
do $$
begin
  if exists (select 1 from pg_roles where rolname = 'anon') then
    execute 'revoke all on schema hpd_feedback from anon';
    execute 'revoke all on schema hpd_feedback_analytics from anon';
  end if;
  if exists (select 1 from pg_roles where rolname = 'authenticated') then
    execute 'revoke all on schema hpd_feedback from authenticated';
    execute 'revoke all on schema hpd_feedback_analytics from authenticated';
  end if;
end $$;

-- Allowed category codes. Changing labels in the UI never requires a data migration; adding a
-- category means updating this function, js/feedback.js and api/_lib/feedback-core.js together.
create or replace function hpd_feedback.allowed_categories(p_rating text)
returns text[]
language sql
immutable
set search_path = ''
as $$
  select case p_rating
    when 'positive' then array['clear', 'accurate', 'understanding', 'practical', 'encouraging']::text[]
    when 'negative' then array['confusing', 'too_general', 'missing_context', 'inaccurate',
                               'no_application', 'too_long', 'unclear_meaning', 'other']::text[]
    else array[]::text[]
  end
$$;

create table if not exists hpd_feedback.explanation_feedback (
  id                  uuid primary key default gen_random_uuid(),
  verse_id            text not null check (verse_id ~ '^[a-z0-9]+(-[0-9]+){2,3}$' and char_length(verse_id) <= 40),
  reference           text not null check (char_length(reference) between 1 and 80),
  book                text not null check (char_length(book) between 1 and 40),
  chapter             integer not null check (chapter > 0),
  verse_start         integer not null check (verse_start > 0),
  verse_end           integer not null check (verse_end >= verse_start),
  explanation_version text not null check (explanation_version ~ '^[a-z0-9][a-z0-9._-]{0,39}$'),
  explanation_sha256  text not null check (explanation_sha256 ~ '^[0-9a-f]{64}$'),
  language            text not null default 'en' check (language ~ '^[a-z]{2}(-[A-Z]{2})?$'),
  rating              text not null check (rating in ('positive', 'negative')),
  categories          text[] not null default '{}'::text[]
                      check (cardinality(categories) <= 8
                             and categories <@ hpd_feedback.allowed_categories(rating)),
  comment             text check (comment is null or char_length(comment) between 1 and 500),
  -- Local-browser account id (js/auth.js). NOT a verified identity; analytics only, never authz.
  local_user_id       text check (local_user_id is null or local_user_id ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'),
  -- HMAC-SHA256 of the httpOnly anonymous session cookie (the raw cookie is never stored).
  submitter_key       text not null check (submitter_key ~ '^[0-9a-f]{64}$'),
  source              text not null default 'card' check (source in ('card', 'verse_page')),
  created_at          timestamptz not null default now(),
  constraint explanation_feedback_one_per_submitter
    unique (submitter_key, verse_id, explanation_version)
);

comment on table hpd_feedback.explanation_feedback is
  'One row per submitter per verse per explanation version. Insert-only via public.hpd_feedback_submit (service_role). Human review only; never auto-rewrites explanations.';

create index if not exists explanation_feedback_verse_idx on hpd_feedback.explanation_feedback (verse_id, explanation_version);
create index if not exists explanation_feedback_version_idx on hpd_feedback.explanation_feedback (explanation_version);
create index if not exists explanation_feedback_rating_idx on hpd_feedback.explanation_feedback (rating, created_at desc);
create index if not exists explanation_feedback_created_idx on hpd_feedback.explanation_feedback (created_at desc);
create index if not exists explanation_feedback_categories_idx on hpd_feedback.explanation_feedback using gin (categories);
create index if not exists explanation_feedback_comment_idx on hpd_feedback.explanation_feedback (created_at desc) where comment is not null;

-- Short-lived abuse-control log (HMAC'd keys only), pruned on every submission.
create table if not exists hpd_feedback.rate_events (
  id         bigint generated always as identity primary key,
  bucket     text not null check (bucket in ('ip', 'submitter')),
  key_hash   text not null check (key_hash ~ '^[0-9a-f]{64}$'),
  created_at timestamptz not null default now()
);
create index if not exists rate_events_lookup_idx on hpd_feedback.rate_events (bucket, key_hash, created_at desc);
create index if not exists rate_events_created_idx on hpd_feedback.rate_events (created_at);

-- Hook for later human (or separately approved AI-assisted) comment-theme review.
create table if not exists hpd_feedback.comment_reviews (
  feedback_id uuid primary key references hpd_feedback.explanation_feedback (id) on delete cascade,
  status      text not null default 'new' check (status in ('new', 'reviewed', 'actioned', 'dismissed')),
  themes      text[] not null default '{}'::text[],
  notes       text check (notes is null or char_length(notes) <= 2000),
  reviewed_by text,
  reviewed_at timestamptz
);
create index if not exists comment_reviews_themes_idx on hpd_feedback.comment_reviews using gin (themes);

alter table hpd_feedback.explanation_feedback enable row level security;
alter table hpd_feedback.rate_events enable row level security;
alter table hpd_feedback.comment_reviews enable row level security;
-- Deliberately no policies: anon/authenticated get nothing. Rows are written only by the
-- SECURITY DEFINER functions below (owned by the migration role, which bypasses RLS as owner)
-- and read only by admins (postgres / service_role in the SQL editor).

revoke all on all tables in schema hpd_feedback from public;
revoke all on all sequences in schema hpd_feedback from public;
revoke all on all functions in schema hpd_feedback from public;
do $$
begin
  if exists (select 1 from pg_roles where rolname = 'anon') then
    execute 'revoke all on all tables in schema hpd_feedback from anon';
    execute 'revoke all on all sequences in schema hpd_feedback from anon';
    execute 'revoke all on all functions in schema hpd_feedback from anon';
  end if;
  if exists (select 1 from pg_roles where rolname = 'authenticated') then
    execute 'revoke all on all tables in schema hpd_feedback from authenticated';
    execute 'revoke all on all sequences in schema hpd_feedback from authenticated';
    execute 'revoke all on all functions in schema hpd_feedback from authenticated';
  end if;
end $$;

-- Insert one feedback row with database-side rate limiting.
-- Returns {"status": "created", "id": ...} | {"status": "duplicate"} | {"status": "rate_limited"}.
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
  p_source text
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

  -- Serialize per submitter so concurrent requests cannot both pass the limiter.
  perform pg_advisory_xact_lock(hashtextextended('hpd_fb:' || p_submitter_key, 0));

  delete from hpd_feedback.rate_events where created_at < now() - interval '2 days';

  select count(*) into v_ip_recent from hpd_feedback.rate_events
    where bucket = 'ip' and key_hash = p_ip_key and created_at > now() - interval '10 minutes';
  select count(*) into v_ip_day from hpd_feedback.rate_events
    where bucket = 'ip' and key_hash = p_ip_key and created_at > now() - interval '1 day';
  select count(*) into v_sub_recent from hpd_feedback.rate_events
    where bucket = 'submitter' and key_hash = p_submitter_key and created_at > now() - interval '10 minutes';

  if v_ip_recent >= 30 or v_ip_day >= 300 or v_sub_recent >= 15 then
    return jsonb_build_object('status', 'rate_limited');
  end if;

  insert into hpd_feedback.rate_events (bucket, key_hash)
    values ('ip', p_ip_key), ('submitter', p_submitter_key);

  insert into hpd_feedback.explanation_feedback (
    verse_id, reference, book, chapter, verse_start, verse_end,
    explanation_version, explanation_sha256, language, rating, categories,
    comment, local_user_id, submitter_key, source
  ) values (
    p_verse_id, p_reference, p_book, p_chapter, p_verse_start, p_verse_end,
    p_explanation_version, p_explanation_sha256, coalesce(p_language, 'en'), p_rating,
    coalesce((select array_agg(distinct c order by c) from unnest(p_categories) c), '{}'::text[]),
    nullif(btrim(p_comment), ''), p_local_user_id, p_submitter_key, coalesce(p_source, 'card')
  )
  on conflict on constraint explanation_feedback_one_per_submitter do nothing
  returning id into v_id;

  if v_id is null then
    return jsonb_build_object('status', 'duplicate');
  end if;
  return jsonb_build_object('status', 'created', 'id', v_id);
end
$$;

-- Has THIS submitter (by their own HMAC'd cookie) already rated this explanation version?
create or replace function public.hpd_feedback_status(
  p_submitter_key text,
  p_verse_id text,
  p_explanation_version text
)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object('submitted', exists (
    select 1 from hpd_feedback.explanation_feedback
    where submitter_key = p_submitter_key
      and verse_id = p_verse_id
      and explanation_version = p_explanation_version
  ))
$$;

revoke all on function public.hpd_feedback_submit(text, text, text, integer, integer, integer, text, text, text, text, text[], text, text, text, text, text) from public;
revoke all on function public.hpd_feedback_status(text, text, text) from public;
do $$
begin
  if exists (select 1 from pg_roles where rolname = 'anon') then
    execute 'revoke all on function public.hpd_feedback_submit(text, text, text, integer, integer, integer, text, text, text, text, text[], text, text, text, text, text) from anon';
    execute 'revoke all on function public.hpd_feedback_status(text, text, text) from anon';
  end if;
  if exists (select 1 from pg_roles where rolname = 'authenticated') then
    execute 'revoke all on function public.hpd_feedback_submit(text, text, text, integer, integer, integer, text, text, text, text, text[], text, text, text, text, text) from authenticated';
    execute 'revoke all on function public.hpd_feedback_status(text, text, text) from authenticated';
  end if;
  if exists (select 1 from pg_roles where rolname = 'service_role') then
    execute 'grant execute on function public.hpd_feedback_submit(text, text, text, integer, integer, integer, text, text, text, text, text[], text, text, text, text, text) to service_role';
    execute 'grant execute on function public.hpd_feedback_status(text, text, text) to service_role';
  end if;
end $$;

-- ———————————————————————————————— Analytics (private, read by admins only) ————————————————————————————————

create or replace view hpd_feedback_analytics.totals with (security_invoker = true) as
select
  count(*)                                              as submissions,
  count(*) filter (where rating = 'positive')           as positive,
  count(*) filter (where rating = 'negative')           as negative,
  round(100.0 * count(*) filter (where rating = 'positive') / nullif(count(*), 0), 1) as positive_pct,
  round(100.0 * count(*) filter (where rating = 'negative') / nullif(count(*), 0), 1) as negative_pct,
  count(*) filter (where comment is not null)           as with_comment,
  count(distinct verse_id)                              as verses_rated,
  min(created_at)                                       as first_at,
  max(created_at)                                       as last_at
from hpd_feedback.explanation_feedback;

create or replace view hpd_feedback_analytics.rating_by_version with (security_invoker = true) as
select explanation_version, language,
  count(*) as submissions,
  round(100.0 * count(*) filter (where rating = 'positive') / nullif(count(*), 0), 1) as positive_pct,
  round(100.0 * count(*) filter (where rating = 'negative') / nullif(count(*), 0), 1) as negative_pct
from hpd_feedback.explanation_feedback
group by explanation_version, language;

create or replace view hpd_feedback_analytics.category_counts with (security_invoker = true) as
select f.rating, c.category, count(*) as mentions,
  round(100.0 * count(*) / nullif(sum(count(*)) over (partition by f.rating), 0), 1) as share_pct
from hpd_feedback.explanation_feedback f
cross join lateral unnest(f.categories) as c(category)
group by f.rating, c.category;

-- Per exact explanation (verse + version + text hash): the unit for review and future AI-assisted
-- improvement suggestions. Counts per problem category make "repeatedly confusing" or
-- "missing biblical context" queries a simple WHERE clause.
create or replace view hpd_feedback_analytics.explanation_summary with (security_invoker = true) as
select
  verse_id, reference, book, chapter, verse_start, verse_end,
  explanation_version, explanation_sha256, language,
  count(*)                                                  as submissions,
  count(*) filter (where rating = 'positive')               as positive,
  count(*) filter (where rating = 'negative')               as negative,
  round(100.0 * count(*) filter (where rating = 'negative') / nullif(count(*), 0), 1) as negative_pct,
  count(*) filter (where 'confusing'       = any(categories)) as confusing,
  count(*) filter (where 'too_general'     = any(categories)) as too_general,
  count(*) filter (where 'missing_context' = any(categories)) as missing_context,
  count(*) filter (where 'inaccurate'      = any(categories)) as inaccurate,
  count(*) filter (where 'no_application'  = any(categories)) as no_application,
  count(*) filter (where 'too_long'        = any(categories)) as too_long,
  count(*) filter (where 'unclear_meaning' = any(categories)) as unclear_meaning,
  count(*) filter (where 'other'           = any(categories)) as other,
  count(*) filter (where comment is not null)               as comments,
  min(created_at) as first_at,
  max(created_at) as last_at
from hpd_feedback.explanation_feedback
group by verse_id, reference, book, chapter, verse_start, verse_end,
         explanation_version, explanation_sha256, language;

-- Consistently poor: at least 5 ratings and at least 60% negative.
create or replace view hpd_feedback_analytics.poor_explanations with (security_invoker = true) as
select * from hpd_feedback_analytics.explanation_summary
where submissions >= 5 and negative_pct >= 60
order by negative_pct desc, submissions desc;

-- Particularly positive: at least 5 ratings and at least 90% positive.
create or replace view hpd_feedback_analytics.top_explanations with (security_invoker = true) as
select * from hpd_feedback_analytics.explanation_summary
where submissions >= 5 and (100 - negative_pct) >= 90
order by positive desc, submissions desc;

create or replace view hpd_feedback_analytics.daily_trend with (security_invoker = true) as
select date_trunc('day', created_at) as day,
  count(*) as submissions,
  count(*) filter (where rating = 'positive') as positive,
  count(*) filter (where rating = 'negative') as negative
from hpd_feedback.explanation_feedback
group by 1;

create or replace view hpd_feedback_analytics.weekly_trend with (security_invoker = true) as
select date_trunc('week', created_at) as week,
  count(*) as submissions,
  round(100.0 * count(*) filter (where rating = 'positive') / nullif(count(*), 0), 1) as positive_pct
from hpd_feedback.explanation_feedback
group by 1;

-- Written comments with their review state: input for human theme tagging (comment_reviews).
-- Comments are user-supplied plain text: always escape when rendering in any admin UI.
create or replace view hpd_feedback_analytics.comments_for_review with (security_invoker = true) as
select f.id as feedback_id, f.created_at, f.verse_id, f.reference, f.explanation_version,
  f.explanation_sha256, f.language, f.rating, f.categories, f.comment,
  coalesce(r.status, 'new') as review_status, coalesce(r.themes, '{}'::text[]) as themes
from hpd_feedback.explanation_feedback f
left join hpd_feedback.comment_reviews r on r.feedback_id = f.id
where f.comment is not null;

create or replace view hpd_feedback_analytics.comment_theme_counts with (security_invoker = true) as
select t.theme, count(*) as comments
from hpd_feedback.comment_reviews r
cross join lateral unnest(r.themes) as t(theme)
group by t.theme;

revoke all on all tables in schema hpd_feedback_analytics from public;
do $$
begin
  if exists (select 1 from pg_roles where rolname = 'anon') then
    execute 'revoke all on all tables in schema hpd_feedback_analytics from anon';
  end if;
  if exists (select 1 from pg_roles where rolname = 'authenticated') then
    execute 'revoke all on all tables in schema hpd_feedback_analytics from authenticated';
  end if;
end $$;
