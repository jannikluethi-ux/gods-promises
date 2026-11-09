-- Database security + behavior checks for supabase/migrations/*_explanation_feedback.sql.
-- Run against a THROWAWAY database (never production) that has Supabase-like roles
-- anon, authenticated and service_role, after applying the migration:
--   psql "$DSN" -v ON_ERROR_STOP=1 -f tests/sql/explanation_feedback_checks.sql
-- Every check raises an exception on failure. The script cleans up its own rows.
\set ON_ERROR_STOP 1
begin;

-- Fixtures (64-hex keys).
create temp table k as select
  repeat('a', 64) as sub_a, repeat('b', 64) as sub_b, repeat('c', 64) as ip_a, repeat('d', 64) as ip_b;
grant select on k to service_role, anon, authenticated;

-- 1. anon / authenticated cannot see, read or write raw feedback, rate events or analytics,
--    and cannot call the RPCs.
do $$
declare r text; obj text;
begin
  foreach r in array array['anon', 'authenticated'] loop
    if has_schema_privilege(r, 'hpd_feedback', 'USAGE') then raise exception '% has USAGE on hpd_feedback', r; end if;
    if has_schema_privilege(r, 'hpd_feedback_analytics', 'USAGE') then raise exception '% has USAGE on analytics', r; end if;
    foreach obj in array array['hpd_feedback.explanation_feedback', 'hpd_feedback.rate_events', 'hpd_feedback.comment_reviews'] loop
      if has_table_privilege(r, obj, 'SELECT') or has_table_privilege(r, obj, 'INSERT')
         or has_table_privilege(r, obj, 'UPDATE') or has_table_privilege(r, obj, 'DELETE') then
        raise exception '% has privileges on %', r, obj;
      end if;
    end loop;
    if has_function_privilege(r, 'public.hpd_feedback_submit(text, text, text, integer, integer, integer, text, text, text, text, text[], text, text, text, text, text)', 'EXECUTE') then
      raise exception '% can execute hpd_feedback_submit', r;
    end if;
    if has_function_privilege(r, 'public.hpd_feedback_status(text, text, text)', 'EXECUTE') then
      raise exception '% can execute hpd_feedback_status', r;
    end if;
  end loop;
  if not has_function_privilege('service_role', 'public.hpd_feedback_submit(text, text, text, integer, integer, integer, text, text, text, text, text[], text, text, text, text, text)', 'EXECUTE') then
    raise exception 'service_role cannot execute hpd_feedback_submit';
  end if;
  if not (select relrowsecurity from pg_class where oid = 'hpd_feedback.explanation_feedback'::regclass) then
    raise exception 'RLS disabled on explanation_feedback';
  end if;
  if exists (select 1 from pg_policies where schemaname = 'hpd_feedback') then
    raise exception 'unexpected RLS policies on hpd_feedback';
  end if;
  if exists (select 1 from pg_class c join pg_namespace n on n.oid = c.relnamespace
             where n.nspname = 'hpd_feedback_analytics' and c.relkind = 'v'
               and not coalesce('security_invoker=true' = any(c.reloptions), false)) then
    raise exception 'analytics view without security_invoker';
  end if;
end $$;

set local role anon;
do $$ begin
  begin perform 1 from hpd_feedback.explanation_feedback; raise exception 'anon read raw feedback';
  exception when insufficient_privilege then null; end;
  begin perform public.hpd_feedback_status(repeat('a', 64), 'jhn-3-16', 'promise-4'); raise exception 'anon called status rpc';
  exception when insufficient_privilege then null; end;
end $$;
reset role;

-- 2. service_role path: create, duplicate, status, other submitter isolated.
set local role service_role;
do $$
declare res jsonb; kk record;
begin
  select * into kk from k;
  res := public.hpd_feedback_submit('jhn-3-16', 'John 3:16', 'John', 3, 16, 16, 'promise-4', repeat('e', 64), 'en',
    'positive', array['clear', 'encouraging', 'clear'], '  Helpful, thanks.  ', null, kk.sub_a, kk.ip_a, 'card');
  if res->>'status' <> 'created' then raise exception 'expected created, got %', res; end if;
  res := public.hpd_feedback_submit('jhn-3-16', 'John 3:16', 'John', 3, 16, 16, 'promise-4', repeat('e', 64), 'en',
    'negative', array['confusing'], null, null, kk.sub_a, kk.ip_a, 'card');
  if res->>'status' <> 'duplicate' then raise exception 'expected duplicate, got %', res; end if;
  -- Same submitter, NEW explanation version is a separate evaluation.
  res := public.hpd_feedback_submit('jhn-3-16', 'John 3:16', 'John', 3, 16, 16, 'promise-5', repeat('f', 64), 'en',
    'negative', array['missing_context', 'other'], 'Needs context', '123e4567-e89b-42d3-a456-426614174000', kk.sub_a, kk.ip_a, 'verse_page');
  if res->>'status' <> 'created' then raise exception 'expected created for new version, got %', res; end if;
  res := public.hpd_feedback_status(kk.sub_a, 'jhn-3-16', 'promise-4');
  if (res->>'submitted')::boolean is not true then raise exception 'status should be submitted'; end if;
  res := public.hpd_feedback_status(kk.sub_b, 'jhn-3-16', 'promise-4');
  if (res->>'submitted')::boolean is not false then raise exception 'other submitter must not see submitted'; end if;
end $$;
reset role;

-- 3. Stored row shape: categories deduped + sorted, comment trimmed, tied to version + hash.
do $$
declare row hpd_feedback.explanation_feedback;
begin
  select * into row from hpd_feedback.explanation_feedback where explanation_version = 'promise-4' and verse_id = 'jhn-3-16';
  if row.categories <> array['clear', 'encouraging'] then raise exception 'categories not normalized: %', row.categories; end if;
  if row.comment <> 'Helpful, thanks.' then raise exception 'comment not trimmed: %', row.comment; end if;
  if row.explanation_sha256 <> repeat('e', 64) or row.book <> 'John' or row.chapter <> 3 then raise exception 'row shape'; end if;
  if row.id is null or row.created_at is null or row.language <> 'en' then raise exception 'defaults'; end if;
end $$;

-- 4. Constraints reject bad data even from service_role.
set local role service_role;
do $$
declare kk record; bad text;
begin
  select * into kk from k;
  begin
    perform public.hpd_feedback_submit('jhn-3-17', 'John 3:17', 'John', 3, 17, 17, 'promise-4', repeat('e', 64), 'en',
      'positive', array['confusing'], null, null, kk.sub_a, kk.ip_a, 'card');
    raise exception 'negative category accepted on positive rating';
  exception when check_violation then null; end;
  begin
    perform public.hpd_feedback_submit('jhn-3-17', 'John 3:17', 'John', 3, 17, 17, 'promise-4', repeat('e', 64), 'en',
      'negative', array['drop table'], null, null, kk.sub_a, kk.ip_a, 'card');
    raise exception 'unknown category accepted';
  exception when check_violation then null; end;
  begin
    perform public.hpd_feedback_submit('jhn-3-17', 'John 3:17', 'John', 3, 17, 17, 'promise-4', repeat('e', 64), 'en',
      'meh', array[]::text[], null, null, kk.sub_a, kk.ip_a, 'card');
    raise exception 'bad rating accepted';
  exception when check_violation then null; end;
  begin
    perform public.hpd_feedback_submit('jhn-3-17', 'John 3:17', 'John', 3, 17, 17, 'promise-4', repeat('e', 64), 'en',
      'negative', array[]::text[], repeat('x', 501), null, kk.sub_a, kk.ip_a, 'card');
    raise exception '501-char comment accepted';
  exception when check_violation then null; end;
  begin
    perform public.hpd_feedback_submit('../etc', 'x', 'x', 1, 1, 1, 'promise-4', repeat('e', 64), 'en',
      'negative', array[]::text[], null, null, kk.sub_a, kk.ip_a, 'card');
    raise exception 'bad verse id accepted';
  exception when check_violation then null; end;
  begin
    perform public.hpd_feedback_submit('jhn-3-17', 'John 3:17', 'John', 3, 17, 17, 'promise-4', repeat('e', 64), 'en',
      'negative', array[]::text[], null, null, 'not-a-hash', kk.ip_a, 'card');
    raise exception 'raw submitter key accepted';
  exception when check_violation then null; end;
  -- 500 chars and empty categories are fine.
  if public.hpd_feedback_submit('jhn-3-17', 'John 3:17', 'John', 3, 17, 17, 'promise-4', repeat('e', 64), 'en',
      'negative', array[]::text[], repeat('x', 500), null, kk.sub_a, kk.ip_a, 'card')->>'status' <> 'created' then
    raise exception '500-char comment rejected';
  end if;
end $$;
reset role;

-- 5. Rate limit: a single submitter is capped at 15 attempts / 10 minutes.
set local role service_role;
do $$
declare kk record; res jsonb; i int; limited boolean := false;
begin
  select * into kk from k;
  for i in 1..20 loop
    res := public.hpd_feedback_submit('psa-23-' || i, 'Psalm 23:' || i, 'Psalms', 23, i, i, 'promise-4', repeat('e', 64), 'en',
      'positive', array[]::text[], null, null, kk.sub_b, kk.ip_b, 'card');
    if res->>'status' = 'rate_limited' then limited := true; exit; end if;
  end loop;
  if not limited or i <> 16 then raise exception 'rate limit did not trigger at attempt 16 (i=%)', i; end if;
end $$;
reset role;

-- 6. Analytics views compute.
do $$
declare t record;
begin
  select * into t from hpd_feedback_analytics.totals;
  if t.submissions < 4 then raise exception 'totals view: %', t; end if;
  perform * from hpd_feedback_analytics.category_counts;
  perform * from hpd_feedback_analytics.explanation_summary;
  perform * from hpd_feedback_analytics.poor_explanations;
  perform * from hpd_feedback_analytics.top_explanations;
  perform * from hpd_feedback_analytics.daily_trend;
  perform * from hpd_feedback_analytics.weekly_trend;
  perform * from hpd_feedback_analytics.rating_by_version;
  perform * from hpd_feedback_analytics.comments_for_review;
  perform * from hpd_feedback_analytics.comment_theme_counts;
end $$;

select 'explanation_feedback DB checks: all passed' as result;
rollback;
