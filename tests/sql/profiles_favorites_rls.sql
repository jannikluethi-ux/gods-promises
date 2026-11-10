-- RLS and entitlement checks for profiles, favorites, and feedback auth_user_id.
-- Run on a THROWAWAY database after both migrations (never production):
--   node tests/run-sql.js
-- Every check raises on failure. The script rolls back its own rows.
\set ON_ERROR_STOP 1
begin;

-- Two real auth users. The signup trigger creates their profiles.
insert into auth.users (id, email, raw_user_meta_data) values
  ('11111111-1111-4111-8111-111111111111', 'one@example.invalid', '{"display_name":" One Reader "}'),
  ('22222222-2222-4222-8222-222222222222', 'two@example.invalid', '{"display_name":"Two"}');

do $$
declare
  a uuid := '11111111-1111-4111-8111-111111111111';
  b uuid := '22222222-2222-4222-8222-222222222222';
  n int;
  name text;
  status text;
begin
  select count(*) into n from public.profiles;
  if n <> 2 then raise exception 'expected one profile per auth user, got %', n; end if;
  select display_name into name from public.profiles where id = a;
  if name <> 'One Reader' then raise exception 'display name not seeded from metadata label, got %', name; end if;
  select subscription_status into status from public.profiles where id = a;
  if status <> 'none' then raise exception 'signup must not grant a subscription, got %', status; end if;

  -- Duplicate insert does not create a second profile.
  insert into public.profiles (id, email, display_name)
  values (a, 'one@example.invalid', 'again')
  on conflict (id) do nothing;
  select count(*) into n from public.profiles where id = a;
  if n <> 1 then raise exception 'duplicate profile'; end if;
end $$;

-- anon cannot read or write profiles or favorites, and cannot call set_subscription.
do $$
begin
  if has_table_privilege('anon', 'public.profiles', 'SELECT')
     or has_table_privilege('anon', 'public.profiles', 'INSERT')
     or has_table_privilege('anon', 'public.profiles', 'UPDATE')
     or has_table_privilege('anon', 'public.profiles', 'DELETE')
     or has_table_privilege('anon', 'public.favorites', 'SELECT')
     or has_table_privilege('anon', 'public.favorites', 'INSERT') then
    raise exception 'anon has privileges on user tables';
  end if;
  if has_function_privilege('anon', 'hpd_private.set_subscription(uuid, text, timestamptz, timestamptz)', 'EXECUTE')
     or has_function_privilege('authenticated', 'hpd_private.set_subscription(uuid, text, timestamptz, timestamptz)', 'EXECUTE') then
    raise exception 'browser role can execute set_subscription';
  end if;
  if not has_function_privilege('service_role', 'hpd_private.set_subscription(uuid, text, timestamptz, timestamptz)', 'EXECUTE') then
    raise exception 'service_role cannot execute set_subscription';
  end if;
  if has_schema_privilege('anon', 'hpd_private', 'USAGE')
     or has_schema_privilege('authenticated', 'hpd_private', 'USAGE') then
    raise exception 'browser role has USAGE on hpd_private';
  end if;
  if not (select relrowsecurity from pg_class where oid = 'public.profiles'::regclass) then
    raise exception 'RLS disabled on profiles';
  end if;
  if not (select relrowsecurity from pg_class where oid = 'public.favorites'::regclass) then
    raise exception 'RLS disabled on favorites';
  end if;
  if exists (
    select 1 from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.prosecdef
      and p.proname not in ('hpd_feedback_submit', 'hpd_feedback_status')
  ) then
    raise exception 'unexpected security definer function in public';
  end if;
end $$;

set local role authenticated;
select set_config('request.jwt.claim.sub', '11111111-1111-4111-8111-111111111111', true);
select set_config('request.jwt.claim.role', 'authenticated', true);

do $$
declare n int;
begin
  select count(*) into n from public.profiles;
  if n <> 1 then raise exception 'user A saw % profiles', n; end if;
  select count(*) into n from public.profiles where email = 'two@example.invalid';
  if n <> 0 then raise exception 'user A read user B profile'; end if;

  update public.profiles set display_name = 'Renamed' where id = auth.uid();
  if not found then raise exception 'owner display-name update failed'; end if;

  begin
    update public.profiles set subscription_status = 'active' where id = auth.uid();
    raise exception 'client granted itself an active subscription';
  exception when insufficient_privilege then null;
  end;

  begin
    update public.profiles set account_status = 'disabled' where id = auth.uid();
    raise exception 'client changed account status';
  exception when insufficient_privilege then null;
  end;

  begin
    update public.profiles set email = 'hijack@example.invalid' where id = auth.uid();
    raise exception 'client changed email';
  exception when insufficient_privilege then null;
  end;

  insert into public.favorites (user_id, promise_id) values (auth.uid(), 'gen-1-28');
  insert into public.favorites (user_id, promise_id) values (auth.uid(), 'jhn-3-16');
  begin
    insert into public.favorites (user_id, promise_id)
    values ('22222222-2222-4222-8222-222222222222', 'gen-1-1');
    raise exception 'user A inserted a favorite for user B';
  exception when insufficient_privilege then null;
  end;

  begin
    insert into public.favorites (promise_id) values ('not a verse');
    raise exception 'bad promise id accepted';
  exception when check_violation then null;
  end;
end $$;

select set_config('request.jwt.claim.sub', '22222222-2222-4222-8222-222222222222', true);
do $$
declare n int; fav text;
begin
  select count(*) into n from public.favorites;
  if n <> 0 then raise exception 'user B saw user A favorites (% )', n; end if;
  select promise_id into fav from public.favorites where promise_id = 'gen-1-28';
  if fav is not null then raise exception 'cross-user favorite read'; end if;
  delete from public.favorites where promise_id = 'gen-1-28';
  -- DELETE of another user's row is a silent no-op under RLS, not an error.
end $$;

select set_config('request.jwt.claim.sub', '11111111-1111-4111-8111-111111111111', true);
do $$
declare n int;
begin
  select count(*) into n from public.favorites where promise_id = 'gen-1-28';
  if n <> 1 then raise exception 'user B delete removed user A favorite'; end if;
  delete from public.favorites where promise_id = 'gen-1-28';
  select count(*) into n from public.favorites where promise_id = 'gen-1-28';
  if n <> 0 then raise exception 'owner delete failed'; end if;
end $$;
-- The second jhn-3-16 insert must fail. Run it outside the block so the
-- unique_violation is visible, then confirm the first row remains.
do $$
begin
  begin
    insert into public.favorites (user_id, promise_id) values (auth.uid(), 'jhn-3-16');
    raise exception 'duplicate favorite accepted';
  exception when unique_violation then null;
  end;
end $$;

reset role;
select set_config('request.jwt.claim.role', '', true);
select set_config('request.jwt.claim.sub', '', true);

-- Trusted server path can activate, cancel, and expire a subscription.
set local role service_role;
select hpd_private.set_subscription(
  '11111111-1111-4111-8111-111111111111', 'active', now() + interval '30 days', null);
do $$
declare status text; touched timestamptz;
begin
  select subscription_status, subscription_updated_at into status, touched
    from public.profiles where id = '11111111-1111-4111-8111-111111111111';
  if status <> 'active' or touched is null then raise exception 'service subscription write failed: %', status; end if;
end $$;
select hpd_private.set_subscription(
  '11111111-1111-4111-8111-111111111111', 'canceled', now() + interval '10 days', now());
select hpd_private.set_subscription(
  '11111111-1111-4111-8111-111111111111', 'expired', now() - interval '1 day', now());
do $$
declare status text;
begin
  select subscription_status into status from public.profiles
    where id = '11111111-1111-4111-8111-111111111111';
  if status <> 'expired' then raise exception 'expected expired, got %', status; end if;
  begin
    perform hpd_private.set_subscription(
      '11111111-1111-4111-8111-111111111111', 'comped', null, null);
    raise exception 'invalid status accepted';
  exception when invalid_parameter_value or sqlstate '22023' then null;
  end;
end $$;

-- Feedback: anonymous row has null auth id; a verified id is stored; deleting
-- the auth user nulls it and removes profile + favorites. local ids are discarded.
-- The RPC is service_role only. Reading the private table happens after reset role,
-- because service_role has no privileges on hpd_feedback.
do $$
declare res jsonb;
begin
  res := public.hpd_feedback_submit('jhn-3-16', 'John 3:16', 'John', 3, 16, 16, 'promise-4', repeat('e', 64), 'en',
    'positive', array['clear']::text[], null, '123e4567-e89b-42d3-a456-426614174000', repeat('a', 64), repeat('c', 64), 'card',
    null);
  if res->>'status' <> 'created' then raise exception 'anonymous feedback not created: %', res; end if;

  res := public.hpd_feedback_submit('psa-23-1', 'Psalm 23:1', 'Psalms', 23, 1, 1, 'promise-4', repeat('e', 64), 'en',
    'positive', array['encouraging']::text[], null, '123e4567-e89b-42d3-a456-426614174000', repeat('b', 64), repeat('d', 64), 'card',
    '22222222-2222-4222-8222-222222222222');
  if res->>'status' <> 'created' then raise exception 'verified feedback not created: %', res; end if;

  -- Same submitter + verse + version is still a duplicate (auth id does not bypass it).
  res := public.hpd_feedback_submit('psa-23-1', 'Psalm 23:1', 'Psalms', 23, 1, 1, 'promise-4', repeat('e', 64), 'en',
    'negative', array['confusing']::text[], null, null, repeat('b', 64), repeat('d', 64), 'card',
    '22222222-2222-4222-8222-222222222222');
  if res->>'status' <> 'duplicate' then raise exception 'expected duplicate, got %', res; end if;
end $$;
reset role;

do $$
declare stored uuid; local_id text;
begin
  select auth_user_id, local_user_id into stored, local_id
    from hpd_feedback.explanation_feedback where submitter_key = repeat('a', 64);
  if stored is not null or local_id is not null then
    raise exception 'anonymous row stored an identity (auth %, local %)', stored, local_id;
  end if;
  select auth_user_id, local_user_id into stored, local_id
    from hpd_feedback.explanation_feedback where submitter_key = repeat('b', 64);
  if stored <> '22222222-2222-4222-8222-222222222222' or local_id is not null then
    raise exception 'verified identity not stored correctly (auth %, local %)', stored, local_id;
  end if;
end $$;

delete from auth.users where id = '22222222-2222-4222-8222-222222222222';
do $$
declare n int; stored uuid;
begin
  select count(*) into n from public.profiles where id = '22222222-2222-4222-8222-222222222222';
  if n <> 0 then raise exception 'profile survived account delete'; end if;
  select count(*) into n from public.favorites where user_id = '22222222-2222-4222-8222-222222222222';
  if n <> 0 then raise exception 'favorites survived account delete'; end if;
  select auth_user_id into stored from hpd_feedback.explanation_feedback where submitter_key = repeat('b', 64);
  if stored is not null then raise exception 'feedback auth id was not nulled on delete'; end if;
  select count(*) into n from hpd_feedback.explanation_feedback where submitter_key = repeat('b', 64);
  if n <> 1 then raise exception 'account delete removed the feedback row'; end if;
end $$;

select 'profiles favorites RLS checks: all passed' as result;
rollback;
