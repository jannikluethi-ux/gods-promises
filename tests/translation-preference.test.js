/* Bible version preference follows the registry's enabled ids. No network. */
'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { createWorld, install } = require('./helpers/fake-supabase');

const ROOT = path.resolve(__dirname, '..');
const STORAGE_KEY = 'gods-promises-version';
const REMOVED = 'kjv';

function memoryStorage(map = new Map()) {
  return {
    getItem: key => map.has(String(key)) ? map.get(String(key)) : null,
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
function runtime(overrides) {
  return vm.createContext({
    console, URL, TextEncoder, setTimeout, clearTimeout,
    localStorage: memoryStorage(), sessionStorage: memoryStorage(),
    fetch: () => { throw new Error('Unstubbed network is forbidden in this test'); },
    location: { hostname: 'hispromisedaily.com', origin: 'https://hispromisedaily.com' },
    ...overrides,
  });
}
function loadStack(context) {
  load(context, 'js/scripture-books.js');
  load(context, 'js/translation-registry.js');
  load(context, 'js/scripture-text.js');
  load(context, 'js/bible-versions.js');
}

(async () => {
  const asked = [];
  const storage = memoryStorage();
  storage.setItem(STORAGE_KEY, 'asv');
  const context = runtime({
    localStorage: storage,
    fetch: async () => { throw new Error('preference setup must not fetch'); },
  });
  load(context, 'js/scripture-books.js');
  load(context, 'js/translation-registry.js');
  const registry = context.GodsPromisesTranslations;
  const realResolve = registry.resolvePreference;
  registry.resolvePreference = function (id) {
    asked.push(id);
    return realResolve(id);
  };
  load(context, 'js/scripture-text.js');
  load(context, 'js/bible-versions.js');
  const versions = context.GodsPromisesVersions;
  assert.deepEqual(asked, ['asv']);
  assert.equal(versions.getCurrentId(), 'asv');
  assert.equal(storage.getItem(STORAGE_KEY), 'asv');

  versions.setCurrent('dra');
  assert.deepEqual(asked.slice(-1), ['dra']);
  assert.equal(versions.getCurrentId(), 'dra');
  assert.equal(storage.getItem(STORAGE_KEY), 'dra');

  versions.setCurrent('sample');
  assert.equal(versions.getCurrentId(), 'web');
  assert.equal(storage.getItem(STORAGE_KEY), 'web');
  assert.equal(registry.resolvePreference('sample'), 'web');

  const unknown = memoryStorage();
  unknown.setItem(STORAGE_KEY, 'sample');
  const unknownContext = runtime({ localStorage: unknown });
  loadStack(unknownContext);
  assert.equal(unknownContext.GodsPromisesVersions.getCurrentId(), 'web');
  assert.equal(unknown.getItem(STORAGE_KEY), 'sample', 'An unknown stored id is not rewritten');

  const kept = memoryStorage();
  kept.setItem(STORAGE_KEY, REMOVED);
  const calls = [];
  const keptContext = runtime({
    localStorage: kept,
    fetch: async url => { calls.push(String(url)); return { ok: true, json: async () => ({ text: 'no' }) }; },
  });
  loadStack(keptContext);
  assert.equal(keptContext.GodsPromisesVersions.getCurrentId(), 'web');
  assert.equal(kept.getItem(STORAGE_KEY), REMOVED);
  keptContext.GodsPromisesVersions.setCurrent(REMOVED);
  assert.equal(kept.getItem(STORAGE_KEY), REMOVED);
  assert.equal(calls.length, 0);
  const passage = { id: 'jhn-3-16', book: 'John', chapter: 3, verseStart: 16, verseEnd: 16, text: 'catalog text' };
  assert.equal((await keptContext.GodsPromisesVersions.resolveText(passage)).text, 'catalog text');

  const world = createWorld({ confirmEmail: false });
  const profileStorage = memoryStorage();
  profileStorage.setItem(STORAGE_KEY, 'asv');
  const profileContext = runtime({
    localStorage: profileStorage,
    fetch: async () => { throw new Error('profile preference must not fetch scripture'); },
  });
  load(profileContext, 'js/config.js');
  load(profileContext, 'js/subscription.js');
  loadStack(profileContext);
  profileContext.GodsPromisesConfig.supabaseUrl = 'https://ixxeidpdgktzvcbucosq.supabase.co';
  profileContext.GodsPromisesConfig.supabaseAnonKey = 'sb_publishable_test_only_value';
  profileContext.GodsPromisesConfig.subscriptionRequired = false;
  install(profileContext, world);
  load(profileContext, 'js/auth.js');
  const auth = profileContext.GodsPromisesAuth;
  await auth.whenReady();
  await auth.signUp({ email: 'reader@example.invalid', password: 'test-only-password', displayName: 'Reader' });
  await auth.signIn({ email: 'reader@example.invalid', password: 'test-only-password' });
  await new Promise(resolve => setTimeout(resolve, 400));
  assert.equal(auth.getCurrentUser().preferredBibleVersion, 'asv');

  const checked = [];
  const realEnabled = profileContext.GodsPromisesTranslations.isEnabled;
  profileContext.GodsPromisesTranslations.isEnabled = function (id) {
    checked.push(id);
    return realEnabled(id);
  };
  await auth.updateProfile({ preferredBibleVersion: 'ylt' });
  assert.deepEqual(checked, ['ylt']);
  assert.equal(auth.getCurrentUser().preferredBibleVersion, 'ylt');
  assert.equal(world.profiles.get(auth.getCurrentUser().id).preferred_bible_version, 'ylt');

  await assert.rejects(
    auth.updateProfile({ preferredBibleVersion: 'sample' }),
    error => error.code === 'INVALID_VERSION'
  );
  assert.equal(auth.getCurrentUser().preferredBibleVersion, 'ylt');

  await auth.updateProfile({ preferredBibleVersion: REMOVED });
  assert.equal(auth.getCurrentUser().preferredBibleVersion, REMOVED);
  assert.equal(world.profiles.get(auth.getCurrentUser().id).preferred_bible_version, REMOVED);
  assert.ok(checked.includes(REMOVED));
  assert.equal(profileContext.GodsPromisesVersions.getCurrentId(), 'asv', 'Writing the stored id does not itself change the open page');

  const reloadedStorage = memoryStorage();
  reloadedStorage.setItem(STORAGE_KEY, REMOVED);
  const reloadedCalls = [];
  const reloaded = runtime({
    localStorage: reloadedStorage,
    fetch: async url => { reloadedCalls.push(String(url)); return { ok: true, json: async () => ({ text: 'no' }) }; },
  });
  load(reloaded, 'js/config.js');
  load(reloaded, 'js/subscription.js');
  loadStack(reloaded);
  reloaded.GodsPromisesConfig.supabaseUrl = 'https://ixxeidpdgktzvcbucosq.supabase.co';
  reloaded.GodsPromisesConfig.supabaseAnonKey = 'sb_publishable_test_only_value';
  install(reloaded, world);
  load(reloaded, 'js/auth.js');
  await reloaded.GodsPromisesAuth.whenReady();
  await reloaded.GodsPromisesAuth.signIn({ email: 'reader@example.invalid', password: 'test-only-password' });
  await new Promise(resolve => setTimeout(resolve, 400));
  assert.equal(reloaded.GodsPromisesAuth.getCurrentUser().preferredBibleVersion, REMOVED);
  assert.equal(reloaded.GodsPromisesVersions.getCurrentId(), 'web');
  assert.equal(reloadedStorage.getItem(STORAGE_KEY), REMOVED);
  assert.equal((await reloaded.GodsPromisesVersions.resolveText(passage)).text, 'catalog text');
  assert.equal(reloadedCalls.length, 0);

  console.log('translation preference: enabled ids come from the registry; an unknown id falls back to WEB; a saved removed id stays stored and displays WEB');
})().catch(error => { console.error(error); process.exitCode = 1; });
