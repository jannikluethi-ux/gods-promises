/* The removed version must not be offered or requested. No network. */
'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { createWorld, install } = require('./helpers/fake-supabase');

const ROOT = path.resolve(__dirname, '..');
const STORAGE_KEY = 'gods-promises-version';
const REMOVED = 'kjv';
const plain = value => JSON.parse(JSON.stringify(value));

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
function runtime(overrides = {}) {
  return vm.createContext({
    console, URL, TextEncoder, setTimeout, clearTimeout,
    localStorage: memoryStorage(), sessionStorage: memoryStorage(),
    fetch: () => { throw new Error('Unstubbed network is forbidden in this test'); },
    ...overrides,
  });
}
function load(context, relative) {
  vm.runInContext(fs.readFileSync(path.join(ROOT, relative), 'utf8'), context, { filename: relative });
}
function catalog() {
  const text = fs.readFileSync(path.join(ROOT, 'promises-data.js'), 'utf8');
  const match = text.match(/window\.GODS_PROMISES_DATA\s*=\s*([\s\S]*);\s*$/);
  assert.ok(match, 'Expected literal catalog assignment');
  return JSON.parse(match[1]);
}
function bootVersions(storage, session, calls) {
  const fetch = async url => {
    calls.push(String(url));
    return { ok: true, json: async () => ({ text: '  Synthetic test translation\n line.  ' }) };
  };
  const context = runtime({ localStorage: storage, sessionStorage: session, fetch });
  load(context, 'js/bible-versions.js');
  return context.GodsPromisesVersions;
}
function assertNoRemovedRequest(calls) {
  for (const url of calls) {
    assert.equal(/kjv/i.test(url), false, url);
    assert.equal(/translation=kjv/i.test(url), false, url);
    assert.match(url, /^https:\/\/bible-api\.com\//, url);
  }
}

function filesUnder(dir, predicate, acc = []) {
  if (!fs.existsSync(dir)) return acc;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === 'node_modules' || entry.name === '.git') continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) filesUnder(full, predicate, acc);
    else if (predicate(full)) acc.push(full);
  }
  return acc;
}

function executableSources() {
  const html = fs.readdirSync(ROOT).filter(name => name.endsWith('.html')).map(name => path.join(ROOT, name));
  return [
    path.join(ROOT, 'app.js'),
    path.join(ROOT, 'sw.js'),
    path.join(ROOT, 'scripts', 'build_site.py'),
    ...filesUnder(path.join(ROOT, 'js'), file => file.endsWith('.js')),
    ...filesUnder(path.join(ROOT, 'api'), file => file.endsWith('.js')),
    ...html,
  ];
}

function scanForRetrieval(file, text) {
  const rel = path.relative(ROOT, file);
  assert.equal(/King James/i.test(text), false, rel);
  assert.equal(/Authorized Version/i.test(text), false, rel);
  assert.equal(/translation=kjv/i.test(text), false, rel);
  assert.equal(/api\s*:\s*["']kjv["']/i.test(text), false, rel);
  assert.equal(/<option\b[^>]*value\s*=\s*["']kjv["']/i.test(text), false, rel);
  const lines = text.split(/\n/);
  lines.forEach((line, index) => {
    if (/bible-api\.com/i.test(line)) {
      assert.equal(/kjv/i.test(line), false, rel + ':' + (index + 1));
    }
  });
  const hits = text.match(/kjv/gi) || [];
  if (rel === 'js/bible-versions.js' || rel === path.join('dist', 'js', 'bible-versions.js')) {
    assert.deepEqual(hits, ['kjv'], rel + ' may mention the removed id only as the blocked token');
    assert.match(text, /REMOVED_VERSION_ID = "kjv"/);
  } else if (rel === 'js/auth.js' || rel === path.join('dist', 'js', 'auth.js')) {
    assert.deepEqual(hits, ['kjv'], rel + ' may keep the stored-preference allowlist only');
    assert.match(text, /web: 1, kjv: 1, asv: 1, ylt: 1, darby: 1, dra: 1/);
    assert.equal(/bible-api\.com/i.test(text), false, rel);
  } else {
    assert.deepEqual(hits, [], rel);
  }
}

function assertSelectors(html, label) {
  const selects = html.match(/<select\b[^>]*>[\s\S]*?<\/select>/gi) || [];
  for (const select of selects) {
    assert.equal(/kjv|king james|authorized version/i.test(select), false, label);
  }
  assert.equal(/<option\b[^>]*value\s*=\s*["']kjv["']/i.test(html), false, label);
}

(async () => {
  const data = catalog();
  const nt = data.promises.find(p => p.book === 'John');
  const ot = data.promises.find(p => p.book === 'Genesis');
  assert.ok(nt && nt.text && ot && ot.text);

  const calls = [];
  const storage = memoryStorage();
  storage.setItem(STORAGE_KEY, REMOVED);
  const session = memoryStorage();
  session.setItem(
    'gods-promises-verse:kjv|' + nt.id + '|' + nt.book + '|' + nt.chapter + ':' + nt.verseStart + '-' + nt.verseEnd,
    'Thou shalt not show this legacy text'
  );
  const api = bootVersions(storage, session, calls);
  assert.deepEqual(plain(api.VERSIONS.map(v => v.id)), ['web', 'asv', 'ylt', 'darby', 'dra']);
  assert.deepEqual(plain(api.VERSIONS.map(v => ({
    id: v.id, api: v.api, label: v.label, short: v.short, ntOnly: !!v.ntOnly,
  }))), [
    { id: 'web', api: null, label: 'World English Bible (WEB)', short: 'WEB', ntOnly: false },
    { id: 'asv', api: 'asv', label: 'American Standard Version (ASV)', short: 'ASV', ntOnly: false },
    { id: 'ylt', api: 'ylt', label: "Young's Literal Translation (YLT)", short: 'YLT', ntOnly: true },
    { id: 'darby', api: 'darby', label: 'Darby Translation (DBY)', short: 'DBY', ntOnly: false },
    { id: 'dra', api: 'dra', label: 'Douay-Rheims (DRA)', short: 'DRA', ntOnly: false },
  ]);
  assert.equal(api.getCurrentId(), 'web');
  assert.equal(api.getCurrent().api, null);
  assert.equal(storage.getItem(STORAGE_KEY), REMOVED, 'Loading a saved legacy id must not rewrite it');
  assert.equal(calls.length, 0);

  const web = await api.resolveText(nt, 'web');
  assert.equal(web.text, nt.text);
  assert.equal(web.source, 'web');
  const current = await api.resolveText(nt);
  assert.equal(current.text, nt.text);
  assert.equal(current.source, 'web');
  assert.equal(calls.length, 0, 'WEB stays on the catalog');

  const crafted = ['KJV', ' kjv ', 'KJV ', '\tkjv', '%6Bjv', '%20kjv', REMOVED];
  for (const raw of crafted) {
    const before = calls.length;
    const result = await api.resolveText(nt, raw);
    assert.equal(result.text, nt.text, raw);
    assert.equal(result.source, 'web', raw);
    assert.equal(result.text.includes('Thou shalt not'), false, raw);
    api.setCurrent(raw);
    assert.equal(api.getCurrentId(), 'web', raw);
    assert.equal(calls.length, before, raw);
    assert.equal(storage.getItem(STORAGE_KEY), REMOVED, raw);
  }

  const page = new URL('https://hispromisedaily.com/?version=kjv&translation=kjv');
  for (const raw of [page.searchParams.get('version'), page.searchParams.get('translation')]) {
    const result = await api.resolveText(ot, raw);
    assert.equal(result.text, ot.text);
    assert.equal(result.source, 'web');
    api.setCurrent(raw);
  }
  const encoded = new URL('https://hispromisedaily.com/verses/jhn-3-16.html?version=%6Bjv&translation=%20kjv');
  await api.resolveText(nt, encoded.searchParams.get('version'));
  await api.resolveText(nt, encoded.searchParams.get('translation'));
  api.setCurrent(encoded.searchParams.get('version'));
  assert.equal(storage.getItem(STORAGE_KEY), REMOVED);
  assert.equal(calls.length, 0);

  api.setCurrent('web');
  assert.equal(api.getCurrentId(), 'web');
  assert.equal(storage.getItem(STORAGE_KEY), REMOVED, 'Choosing the version already on screen must not clear the saved id');
  assert.equal((await api.resolveText(ot, 'web')).text, ot.text);

  const yltOt = await api.resolveText(ot, 'ylt');
  assert.equal(yltOt.text, ot.text);
  assert.equal(yltOt.source, 'web');
  assert.match(yltOt.note, /New Testament only/);
  assert.equal(calls.length, 0);

  for (const id of ['asv', 'ylt', 'darby', 'dra']) {
    const before = calls.length;
    const result = await api.resolveText(nt, id);
    assert.equal(result.source, id);
    assert.equal(result.text, 'Synthetic test translation line.');
    assert.equal(calls.length, before + 1);
    assert.match(calls.at(-1), new RegExp('\\?translation=' + id + '$'));
  }
  assertNoRemovedRequest(calls);

  const kept = memoryStorage();
  const keptCalls = [];
  const keptApi = bootVersions(kept, memoryStorage(), keptCalls);
  keptApi.setCurrent('asv');
  assert.equal(kept.getItem(STORAGE_KEY), 'asv');
  const seen = [];
  keptApi.onChange(id => seen.push(id));
  keptApi.setCurrent('KJV');
  assert.equal(keptApi.getCurrentId(), 'web');
  assert.equal(kept.getItem(STORAGE_KEY), 'asv', 'A crafted id must not replace a real saved version');
  assert.deepEqual(seen, ['web']);
  assert.equal((await keptApi.resolveText(nt)).text, nt.text);
  assert.equal(keptCalls.length, 0);
  keptApi.setCurrent('darby');
  assert.equal(kept.getItem(STORAGE_KEY), 'darby');
  assert.equal((await keptApi.resolveText(nt)).source, 'darby');
  assert.match(keptCalls.at(-1), /\?translation=darby$/);
  assertNoRemovedRequest(keptCalls);

  const select = { innerHTML: '', value: '' };
  api.fillSelect(select);
  assert.match(select.innerHTML, /value="web"/);
  assert.match(select.innerHTML, /American Standard Version \(ASV\)/);
  assert.match(select.innerHTML, /Young's Literal Translation \(YLT\)/);
  assert.match(select.innerHTML, /Darby Translation \(DBY\)/);
  assert.match(select.innerHTML, /Douay-Rheims \(DRA\)/);
  assert.equal(/kjv|king james|authorized version/i.test(select.innerHTML), false);
  assert.equal(select.value, 'web');

  for (const file of executableSources()) scanForRetrieval(file, fs.readFileSync(file, 'utf8'));
  for (const file of fs.readdirSync(ROOT).filter(name => name.endsWith('.html'))) {
    assertSelectors(fs.readFileSync(path.join(ROOT, file), 'utf8'), file);
  }
  const home = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
  assert.match(home, /<option value="web">World English Bible \(WEB\)<\/option>/);
  assert.match(home, /js\/bible-versions\.js\?v=shell-6/);
  assert.match(fs.readFileSync(path.join(ROOT, 'me.html'), 'utf8'), /js\/bible-versions\.js\?v=shell-6/);
  assert.match(fs.readFileSync(path.join(ROOT, 'js/me-page.js'), 'utf8'), /if \(offered\) el\.version\.value = user\.preferredBibleVersion/);
  assert.equal(fs.readFileSync(path.join(ROOT, 'sw.js'), 'utf8').includes('hpd-shell-v5'), false);
  assert.match(fs.readFileSync(path.join(ROOT, 'sw.js'), 'utf8'), /hpd-shell-v6/);
  const migration = fs.readFileSync(path.join(ROOT, 'supabase/migrations/20261110153000_profiles_favorites_auth.sql'), 'utf8');
  assert.match(migration, /preferred_bible_version in \('web', 'kjv', 'asv', 'ylt', 'darby', 'dra'\)/);

  const dist = path.join(ROOT, 'dist');
  const distScript = path.join(dist, 'js', 'bible-versions.js');
  assert.equal(fs.existsSync(distScript), true, 'Build production dist before this test');
  assert.equal(
    fs.readFileSync(distScript).equals(fs.readFileSync(path.join(ROOT, 'js', 'bible-versions.js'))),
    true,
    'dist/js/bible-versions.js is stale; rebuild production'
  );
  const built = filesUnder(dist, file => /\.(js|html|py)$/.test(file));
  assert.ok(built.length > 1000, 'production build should include the verse pages');
  for (const file of built) {
    const text = fs.readFileSync(file, 'utf8');
    scanForRetrieval(file, text);
    if (file.endsWith('.html')) assertSelectors(text, path.relative(ROOT, file));
  }
  assert.match(fs.readFileSync(path.join(dist, 'sw.js'), 'utf8'), /hpd-shell-v6/);
  assert.equal(/translation=kjv|King James|Authorized Version/i.test(built.map(file => fs.readFileSync(file, 'utf8')).join('\n')), false);

  const world = createWorld({ confirmEmail: false });
  const profileStorage = memoryStorage();
  profileStorage.setItem(STORAGE_KEY, 'asv');
  const profileCalls = [];
  const profileContext = runtime({
    localStorage: profileStorage,
    sessionStorage: memoryStorage(),
    fetch: async url => {
      profileCalls.push(String(url));
      return { ok: true, json: async () => ({ text: 'nope' }) };
    },
    location: { hostname: 'hispromisedaily.com', origin: 'https://hispromisedaily.com' },
  });
  load(profileContext, 'js/config.js');
  load(profileContext, 'js/subscription.js');
  load(profileContext, 'js/bible-versions.js');
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
  const userId = auth.getCurrentUser().id;
  assert.equal(auth.getCurrentUser().preferredBibleVersion, 'asv');
  profileCalls.length = 0;
  profileContext.GodsPromisesVersions.setCurrent(REMOVED);
  profileContext.GodsPromisesVersions.setCurrent('KJV');
  profileContext.GodsPromisesVersions.setCurrent(' kjv ');
  await new Promise(resolve => setTimeout(resolve, 400));
  assert.equal(auth.getCurrentUser().preferredBibleVersion, 'asv');
  assert.equal(world.profiles.get(userId).preferred_bible_version, 'asv');
  assert.equal(profileStorage.getItem(STORAGE_KEY), 'asv');
  assert.equal(profileContext.GodsPromisesVersions.getCurrentId(), 'web');
  assert.equal(profileCalls.length, 0);

  world.profiles.get(userId).preferred_bible_version = REMOVED;
  const savedStorage = memoryStorage();
  savedStorage.setItem(STORAGE_KEY, REMOVED);
  const savedCalls = [];
  const saved = runtime({
    localStorage: savedStorage,
    sessionStorage: memoryStorage(),
    fetch: async url => {
      savedCalls.push(String(url));
      return { ok: true, json: async () => ({ text: 'nope' }) };
    },
    location: { hostname: 'hispromisedaily.com', origin: 'https://hispromisedaily.com' },
  });
  load(saved, 'js/config.js');
  load(saved, 'js/subscription.js');
  load(saved, 'js/bible-versions.js');
  saved.GodsPromisesConfig.supabaseUrl = 'https://ixxeidpdgktzvcbucosq.supabase.co';
  saved.GodsPromisesConfig.supabaseAnonKey = 'sb_publishable_test_only_value';
  install(saved, world);
  load(saved, 'js/auth.js');
  await saved.GodsPromisesAuth.whenReady();
  await saved.GodsPromisesAuth.signIn({ email: 'reader@example.invalid', password: 'test-only-password' });
  await new Promise(resolve => setTimeout(resolve, 400));
  assert.equal(saved.GodsPromisesAuth.getCurrentUser().preferredBibleVersion, REMOVED);
  assert.equal(world.profiles.get(userId).preferred_bible_version, REMOVED);
  assert.equal(savedStorage.getItem(STORAGE_KEY), REMOVED);
  assert.equal(saved.GodsPromisesVersions.getCurrentId(), 'web');
  assert.equal((await saved.GodsPromisesVersions.resolveText(nt)).text, nt.text);
  assert.equal(savedCalls.length, 0);
  assertNoRemovedRequest(savedCalls);

  console.log('KJV removal: selector and requests exclude the removed id; saved preference stays stored and displays WEB; WEB and ASV/YLT/Darby/Douay-Rheims still resolve; ' + built.length + ' built files scanned');
})().catch(error => { console.error(error); process.exitCode = 1; });
