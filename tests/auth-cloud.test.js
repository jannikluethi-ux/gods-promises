/* Cloud-auth behavior that the shared regression test does not cover. No network. */
'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { createWorld, install } = require('./helpers/fake-supabase');

const ROOT = path.resolve(__dirname, '..');

function memoryStorage(map = new Map()) {
  return {
    getItem: key => map.has(key) ? map.get(key) : null,
    setItem: (key, value) => map.set(String(key), String(value)),
    removeItem: key => map.delete(String(key)),
    key: index => Array.from(map.keys())[index] ?? null,
    get length() { return map.size; },
    map,
  };
}
function load(context, relative) {
  vm.runInContext(fs.readFileSync(path.join(ROOT, relative), 'utf8'), context, { filename: relative });
}
function boot(storage, world, fetch) {
  const context = vm.createContext({
    console, URL, TextEncoder, setTimeout, clearTimeout,
    localStorage: storage, sessionStorage: memoryStorage(),
    fetch: fetch || (() => { throw new Error('Unstubbed network'); }),
    location: { hostname: 'hispromisedaily.com', origin: 'https://hispromisedaily.com' },
  });
  load(context, 'js/config.js');
  load(context, 'js/subscription.js');
  load(context, 'js/scripture-books.js');
  load(context, 'js/translation-registry.js');
  load(context, 'js/scripture-text.js');
  load(context, 'js/bible-versions.js');
  context.GodsPromisesConfig.supabaseUrl = 'https://ixxeidpdgktzvcbucosq.supabase.co';
  context.GodsPromisesConfig.supabaseAnonKey = 'sb_publishable_test_only_value';
  context.GodsPromisesConfig.subscriptionRequired = false;
  install(context, world);
  load(context, 'js/auth.js');
  load(context, 'js/favorites.js');
  return context;
}

(async () => {
  for (const file of ['js/auth.js', 'js/favorites.js', 'js/config.js', 'js/login-page.js', 'js/me-page.js', 'js/feedback.js']) {
    const src = fs.readFileSync(path.join(ROOT, file), 'utf8');
    assert.ok(!src.includes('PBKDF2'), file);
    assert.ok(!src.includes('SUPABASE_SERVICE_ROLE_KEY'), file);
    assert.ok(!src.includes('passwordHash'), file);
    if (file !== 'js/auth.js') assert.ok(!src.includes('gp_auth_users_v1'), file);
  }
  assert.match(fs.readFileSync(path.join(ROOT, 'js/config.js'), 'utf8'), /subscriptionRequired:\s*false/);
  assert.match(fs.readFileSync(path.join(ROOT, 'js/ui-shared.js'), 'utf8'), /EXPLAIN_VERSION = "promise-4"/);
  const explanations = fs.readFileSync(path.join(ROOT, 'data/explanations.json'));
  assert.equal(explanations.length > 1000, true);

  const bare = vm.createContext({ console, localStorage: memoryStorage(), setTimeout, clearTimeout });
  load(bare, 'js/config.js');
  load(bare, 'js/subscription.js');
  load(bare, 'js/auth.js');
  await bare.GodsPromisesAuth.whenReady();
  await assert.rejects(bare.GodsPromisesAuth.signIn({ email: 'a@example.invalid', password: 'test-only-password' }), /not configured/);

  const storage = memoryStorage();
  storage.setItem('gods-promises-version', 'asv');
  const world = createWorld({ confirmEmail: true });
  const context = boot(storage, world);
  const auth = context.GodsPromisesAuth;
  const favorites = context.GodsPromisesFavorites;
  const sub = context.GodsPromisesSubscription;
  await auth.whenReady();
  const created = await auth.signUp({ email: 'reader@example.invalid', password: 'test-only-password', displayName: 'Reader' });
  assert.equal(created.needsVerification, true);
  await auth.requestPasswordReset({ email: 'reader@example.invalid' });
  assert.deepEqual(world.resets, ['reader@example.invalid']);
  world.confirmEmail('reader@example.invalid');
  const user = await auth.signIn({ email: 'reader@example.invalid', password: 'test-only-password' });
  await new Promise(resolve => setTimeout(resolve, 50));
  assert.equal(auth.getCurrentUser().preferredBibleVersion, 'asv', 'The signed-in Bible version is saved to the profile');
  context.GodsPromisesVersions.setCurrent('darby');
  await new Promise(resolve => setTimeout(resolve, 400));
  assert.equal(auth.getCurrentUser().preferredBibleVersion, 'darby');
  const renamed = await auth.updateProfile({ displayName: '  Quiet Reader  ' });
  assert.equal(renamed.displayName, 'Quiet Reader');
  world.serverSetSubscription(user.id, 'canceled', new Date(Date.now() + 86400000).toISOString());
  await auth.signOut();
  await auth.signIn({ email: 'reader@example.invalid', password: 'test-only-password' });
  assert.equal(sub.isActive(auth.getCurrentUser()), true, 'A canceled plan still in its paid period stays active');
  world.serverSetSubscription(user.id, 'expired', new Date(Date.now() - 86400000).toISOString());
  await auth.signOut();
  await auth.signIn({ email: 'reader@example.invalid', password: 'test-only-password' });
  assert.equal(sub.isActive(auth.getCurrentUser()), false);
  assert.equal(sub.canAccessFavorites(auth.getCurrentUser()), true, 'subscriptionRequired is still off');
  world.profiles.get(user.id).account_status = 'disabled';
  await auth.signOut();
  await auth.signIn({ email: 'reader@example.invalid', password: 'test-only-password' });
  assert.equal(sub.canAccessFavorites(auth.getCurrentUser()), false);
  await assert.rejects(favorites.toggle('gen-1-28'), error => error.code === 'ACCOUNT_DISABLED');

  const calls = [];
  const fresh = createWorld({ confirmEmail: false });
  const sessioned = boot(memoryStorage(), fresh, async (url, init) => {
    calls.push({ url, body: init.body, authorization: init.headers.authorization });
    return { ok: true, json: async () => ({ ok: true }) };
  });
  await sessioned.GodsPromisesAuth.whenReady();
  const member = await sessioned.GodsPromisesAuth.signUp({ email: 'delete-me@example.invalid', password: 'test-only-password', displayName: 'Delete' });
  assert.equal(member.needsVerification, false);
  await assert.rejects(sessioned.GodsPromisesAuth.deleteAccount({ confirmation: 'nope' }), /DELETE/);
  assert.equal(calls.length, 0);
  await sessioned.GodsPromisesAuth.deleteAccount({ confirmation: 'DELETE' });
  assert.equal(calls[0].url, '/api/account');
  assert.equal(JSON.parse(calls[0].body).confirmation, 'DELETE');
  assert.equal(JSON.parse(calls[0].body).id, undefined);
  assert.match(calls[0].authorization, /^Bearer test-access-/);
  assert.equal(sessioned.GodsPromisesAuth.getCurrentUser(), null);

  const migrated = fs.readFileSync(path.join(ROOT, 'supabase/migrations/20261110153000_profiles_favorites_auth.sql'), 'utf8');
  assert.match(migrated, /enable row level security/);
  assert.match(migrated, /profiles_select_own/);
  assert.match(migrated, /favorites_user_promise_unique/);
  assert.match(migrated, /hpd_private\.set_subscription/);
  assert.ok(!migrated.includes('raw_user_meta_data') || migrated.includes('not an authorization claim') || migrated.includes('It is not an authorization claim'));
  const publicFunctions = [...migrated.matchAll(/create or replace function (public\.\w+)/g)].map(match => match[1]);
  assert.deepEqual(publicFunctions, ['public.hpd_feedback_submit']);

  console.log('auth-cloud: verification, profile sync, entitlement model, deletion request, and client secret scan passed');
})().catch(error => { console.error(error); process.exitCode = 1; });
