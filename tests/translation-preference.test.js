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
const NOTE = 'YLT unavailable, showing WEB.';

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
    console, URL, TextEncoder, Map, Promise, setTimeout, clearTimeout,
    localStorage: memoryStorage(), sessionStorage: memoryStorage(),
    fetch: () => { throw new Error('Unstubbed network is forbidden in this test'); },
    location: { hostname: 'hispromisedaily.com', origin: 'https://hispromisedaily.com' },
    document: { getElementById() { return null; }, querySelectorAll() { return []; }, createElement() { return {}; } },
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
  const context = runtime({ localStorage: storage });
  load(context, 'js/scripture-books.js');
  load(context, 'js/translation-registry.js');
  const registry = context.GodsPromisesTranslations;
  const realResolve = registry.resolvePreference;
  registry.resolvePreference = function (id) {
    asked.push(id);
    return realResolve(id);
  };
  const realEnabled = registry.isEnabled;
  registry.isEnabled = function (id) {
    asked.push('enabled:' + id);
    return realEnabled(id);
  };
  load(context, 'js/scripture-text.js');
  load(context, 'js/bible-versions.js');
  const versions = context.GodsPromisesVersions;
  assert.deepEqual(asked, ['enabled:asv']);
  assert.equal(versions.getCurrentId(), 'asv');
  assert.equal(storage.getItem(STORAGE_KEY), 'asv');
  assert.deepEqual(versions.VERSIONS.map(v => v.id), registry.enabled().map(e => e.id));

  versions.setCurrent('dra');
  assert.equal(asked.at(-1), 'dra');
  assert.equal(versions.getCurrentId(), 'dra');
  assert.equal(storage.getItem(STORAGE_KEY), 'dra');

  versions.setCurrent('sample');
  assert.equal(versions.getCurrentId(), 'web');
  assert.equal(storage.getItem(STORAGE_KEY), 'web');

  const unknown = memoryStorage();
  unknown.setItem(STORAGE_KEY, 'sample');
  const unknownContext = runtime({ localStorage: unknown });
  loadStack(unknownContext);
  assert.equal(unknownContext.GodsPromisesVersions.getCurrentId(), 'web');
  assert.equal(unknown.getItem(STORAGE_KEY), 'sample');

  const yltStorage = memoryStorage();
  yltStorage.setItem(STORAGE_KEY, 'ylt');
  const calls = [];
  const yltContext = runtime({
    localStorage: yltStorage,
    fetch: async url => { calls.push(String(url)); throw new Error('ylt must not be requested'); },
  });
  loadStack(yltContext);
  assert.equal(yltContext.GodsPromisesVersions.getCurrentId(), 'web');
  assert.equal(yltContext.GodsPromisesVersions.unavailableNotice(), NOTE);
  assert.equal(yltStorage.getItem(STORAGE_KEY), 'ylt');
  const passage = { id: 'jhn-3-16', book: 'John', chapter: 3, verseStart: 16, verseEnd: 16, text: 'catalog text' };
  const shown = await yltContext.GodsPromisesVersions.resolveText(passage);
  assert.equal(shown.text, 'catalog text');
  assert.equal(shown.source, 'web');
  assert.equal(shown.note, NOTE);
  assert.equal(calls.length, 0);

  const kept = memoryStorage();
  kept.setItem(STORAGE_KEY, REMOVED);
  const keptContext = runtime({ localStorage: kept, fetch: async () => { throw new Error('removed id must not be requested'); } });
  loadStack(keptContext);
  assert.equal(keptContext.GodsPromisesVersions.getCurrentId(), 'web');
  assert.equal(kept.getItem(STORAGE_KEY), REMOVED);
  keptContext.GodsPromisesVersions.setCurrent(REMOVED);
  assert.equal(kept.getItem(STORAGE_KEY), REMOVED);

  const world = createWorld({ confirmEmail: false });
  const profileStorage = memoryStorage();
  profileStorage.setItem(STORAGE_KEY, 'asv');
  const profileContext = runtime({ localStorage: profileStorage });
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
  const enabled = profileContext.GodsPromisesTranslations.isEnabled;
  profileContext.GodsPromisesTranslations.isEnabled = function (id) {
    checked.push(id);
    return enabled(id);
  };
  await auth.updateProfile({ preferredBibleVersion: 'darby' });
  assert.deepEqual(checked, ['darby']);
  assert.equal(auth.getCurrentUser().preferredBibleVersion, 'darby');
  await assert.rejects(auth.updateProfile({ preferredBibleVersion: 'sample' }), error => error.code === 'INVALID_VERSION');
  await auth.updateProfile({ preferredBibleVersion: 'ylt' });
  assert.equal(auth.getCurrentUser().preferredBibleVersion, 'ylt');
  assert.equal(world.profiles.get(auth.getCurrentUser().id).preferred_bible_version, 'ylt');
  assert.equal(profileContext.GodsPromisesVersions.getCurrentId(), 'asv');

  console.log('translation preference: enabled ids come from the registry; unknown ids and saved ylt or the removed id display WEB without a request');
})().catch(error => { console.error(error); process.exitCode = 1; });
