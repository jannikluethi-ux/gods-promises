/* Non-browser functional checks. Only in-memory test profiles, crypto, and stubbed network. */
'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { webcrypto } = require('node:crypto');
const ROOT = path.resolve(__dirname, '..');
const plain = value => JSON.parse(JSON.stringify(value));

function memoryStorage(map = new Map()) {
  return {
    getItem: key => map.has(String(key)) ? map.get(String(key)) : null,
    setItem: (key, value) => map.set(String(key), String(value)),
    removeItem: key => map.delete(String(key)),
    clear: () => map.clear(),
    map,
  };
}
function runtime(directory, overrides = {}) {
  return vm.createContext({ console, URL, TextEncoder, crypto: webcrypto,
    btoa: text => Buffer.from(text, 'binary').toString('base64'),
    atob: text => Buffer.from(text, 'base64').toString('binary'),
    localStorage: memoryStorage(), sessionStorage: memoryStorage(),
    fetch: () => { throw new Error('Unstubbed network is forbidden in this test'); },
    ...overrides, __directory: directory });
}
function load(context, relative) {
  vm.runInContext(fs.readFileSync(path.join(context.__directory, relative), 'utf8'), context, { filename: relative });
}
function catalog(directory) {
  const text = fs.readFileSync(path.join(directory, 'promises-data.js'), 'utf8');
  const match = text.match(/window\.GODS_PROMISES_DATA\s*=\s*([\s\S]*);\s*$/);
  assert.ok(match, 'Expected literal shipped catalog assignment');
  return JSON.parse(match[1]);
}

async function authAndFavorites(directory) {
  const storage = memoryStorage();
  const context = runtime(directory, { localStorage: storage });
  for (const file of ['js/config.js', 'js/subscription.js', 'js/auth.js', 'js/favorites.js']) load(context, file);
  const auth = context.GodsPromisesAuth;
  const favorites = context.GodsPromisesFavorites;
  assert.equal(auth.getCurrentUser(), null);
  await assert.rejects(auth.signUp({ email: 'invalid', password: 'test-only-password' }), /valid email/);
  await assert.rejects(auth.signUp({ email: 'test-user@example.invalid', password: 'short' }), /8 characters/);
  await assert.rejects(favorites.toggle('gen-1-28'), error => error.code === 'AUTH_REQUIRED');
  const events = [];
  const unsubscribe = auth.onAuthChange(user => events.push(user ? user.email : null));
  const user = await auth.signUp({ email: '  TEST-USER@EXAMPLE.INVALID  ', password: 'test-only-password', displayName: ' Test Reader ' });
  assert.equal(user.email, 'test-user@example.invalid');
  assert.equal(user.displayName, 'Test Reader');
  assert.equal(user.subscriptionStatus, 'none');
  assert.equal('passwordHash' in user, false);
  assert.equal(auth.getCurrentUser().id, user.id);
  const record = Object.values(JSON.parse(storage.getItem('gp_auth_users_v1')))[0];
  assert.ok(record.salt && record.passwordHash);
  assert.ok(!JSON.stringify(record).includes('test-only-password'), 'Never persist plaintext test passwords');
  await assert.rejects(auth.signUp({ email: user.email, password: 'test-only-password' }), /already exists/);
  assert.equal((await favorites.toggle('gen-1-28')).favorited, true);
  assert.equal(favorites.isFavorite('gen-1-28'), true);
  assert.deepEqual(plain(favorites.list()), ['gen-1-28']);
  await auth.signOut();
  assert.equal(auth.getCurrentUser(), null);
  assert.deepEqual(plain(favorites.list()), []);
  await assert.rejects(auth.signIn({ email: user.email, password: 'wrong-test-password' }), /Incorrect/);
  await assert.rejects(auth.signIn({ email: 'missing@example.invalid', password: 'test-only-password' }), /Incorrect/);
  const restored = runtime(directory, { localStorage: storage });
  for (const file of ['js/config.js', 'js/subscription.js', 'js/auth.js', 'js/favorites.js']) load(restored, file);
  await restored.GodsPromisesAuth.signIn({ email: ' TEST-USER@example.invalid ', password: 'test-only-password' });
  assert.equal(restored.GodsPromisesAuth.getCurrentUser().id, user.id);
  assert.equal(restored.GodsPromisesFavorites.isFavorite('gen-1-28'), true);
  assert.equal((await restored.GodsPromisesFavorites.toggle('gen-1-28')).favorited, false);
  await restored.GodsPromisesFavorites.toggle('gen-1-28');
  await restored.GodsPromisesAuth.signOut();
  const second = await restored.GodsPromisesAuth.signUp({ email: 'other-test@example.invalid', password: 'different-test-only-password' });
  assert.notEqual(second.id, user.id);
  assert.deepEqual(plain(restored.GodsPromisesFavorites.list()), [], 'Favorites stay per profile');
  assert.deepEqual(events, ['test-user@example.invalid', null]);
  unsubscribe();
  await auth.signOut();
  assert.equal(events.length, 2);
  storage.setItem('gp_auth_session_v1', JSON.stringify({ userId: 'missing-user' }));
  assert.equal(auth.getCurrentUser(), null);
  assert.equal(storage.getItem('gp_auth_session_v1'), null);
  return 'signup/signin/signout, PBKDF2 persistence, validation/errors, sessions, observers and per-profile favorites';
}

function search(directory, data) {
  const context = runtime(directory);
  load(context, 'js/smart-search.js');
  load(context, 'js/relevance.js');
  const smart = context.GodsPromisesSmartSearch;
  const relevance = context.GodsPromisesRelevance;
  const opts = { knownThemes: data.themeVocabulary, knownFeelings: data.feelingsVocabulary };
  assert.equal(smart.detectIntent('John 3:16', opts), null);
  assert.equal(smart.detectIntent('Psalms', opts), null);
  assert.equal(smart.detectIntent('I feel anxious', opts).intentId, 'anxious');
  const queries = ['', 'hope', 'peace', 'I feel anxious', 'stress at work', 'lonely', 'I am afraid',
    'forgiveness', 'John 3:16', 'Genesis', 'strength', 'sick', 'angry', 'eternal life', 'unknownzzword'];
  const results = [];
  for (const query of queries) {
    const plan = smart.buildSearchPlan(query, null, opts);
    const candidates = data.promises.filter(p => smart.matchesPlan(
      [p.reference, p.book, p.promise, p.text, p.context, ...p.themes, ...p.feelings, ...p.searchTerms].join(' ').toLowerCase(), plan));
    const ranked = relevance.rankItems(candidates.map(p => ({ p })), plan, {});
    assert.ok(ranked.every((item, index) => index === 0 || ranked[index - 1].score >= item.score));
    if (query === 'unknownzzword') assert.equal(ranked.length, 0);
    if (query === 'I feel anxious') assert.ok(ranked.length > 0);
    results.push({ query, plan: plain(plan), ranked: ranked.map(item => ({ id: item.p.id, score: item.score,
      tier: item.relevanceTier || null, label: item.relevanceLabel || null })) });
  }
  // Clarification must remain a soft ranking input, not a loss of all results.
  const detection = smart.detectIntent('I feel anxious', opts);
  const option = detection.followUp.options[0];
  const clarified = smart.buildSearchPlan('I feel anxious', { option, freeText: 'test-only context' }, opts);
  assert.ok(clarified.boostTerms.length > 0);
  assert.ok(clarified.orGroups.length > 0);
  results.push({ clarified: plain(clarified) });
  return results;
}

async function versions(directory, data) {
  const calls = [];
  const localStorage = memoryStorage();
  const sessionStorage = memoryStorage();
  let fail = false;
  const fetch = async url => {
    calls.push(url);
    if (fail) throw new Error('Simulated service outage');
    return { ok: true, json: async () => ({ text: '  Synthetic test translation\n line.  ' }) };
  };
  const context = runtime(directory, { localStorage, sessionStorage, fetch });
  load(context, 'js/bible-versions.js');
  const api = context.GodsPromisesVersions;
  assert.deepEqual(plain(api.VERSIONS.map(v => v.id)), ['web', 'kjv', 'asv', 'ylt', 'darby', 'dra']);
  assert.equal(calls.length, 0, 'Translations must not fetch on load');
  const ot = data.promises.find(p => p.book === 'Genesis');
  const nt = data.promises.find(p => p.book === 'John');
  assert.deepEqual(plain(await api.resolveText(ot, 'web')), { text: ot.text, source: 'web' });
  assert.equal(calls.length, 0, 'WEB is offline and exact');
  const yltOT = await api.resolveText(ot, 'ylt');
  assert.equal(yltOT.text, ot.text);
  assert.equal(yltOT.source, 'web');
  assert.match(yltOT.note, /New Testament only/);
  assert.equal(calls.length, 0);
  for (const id of ['kjv', 'asv', 'ylt', 'darby', 'dra']) {
    const before = calls.length;
    const one = api.resolveText(nt, id);
    const two = api.resolveText(nt, id);
    assert.equal(one, two, 'Concurrent translation requests coalesce');
    const result = await one;
    assert.deepEqual(plain(result), { text: 'Synthetic test translation line.', source: id });
    assert.equal(calls.length, before + 1);
    assert.match(calls.at(-1), new RegExp('\\?translation=' + id + '$'));
    await api.resolveText(nt, id);
    assert.equal(calls.length, before + 1, 'Memory cache avoids repeated requests');
  }
  const restored = runtime(directory, { localStorage, sessionStorage, fetch });
  load(restored, 'js/bible-versions.js');
  const beforeSession = calls.length;
  assert.equal((await restored.GodsPromisesVersions.resolveText(nt, 'kjv')).source, 'kjv');
  assert.equal(calls.length, beforeSession, 'Session cache survives module reload');
  const changes = [];
  const unsubscribe = api.onChange(id => changes.push(id));
  api.setCurrent('asv');
  assert.equal(api.getCurrentId(), 'asv');
  assert.equal(localStorage.getItem('gods-promises-version'), 'asv');
  api.setCurrent('not-a-version');
  assert.equal(api.getCurrentId(), 'web');
  unsubscribe();
  api.setCurrent('kjv');
  assert.deepEqual(changes, ['asv', 'web']);
  fail = true;
  const failed = await api.resolveText(ot, 'darby');
  assert.equal(failed.text, ot.text);
  assert.equal(failed.source, 'web');
  assert.match(failed.note, /Could not load DBY/);
  return calls.map(url => new URL(url).searchParams.get('translation'));
}

function analytics(directory) {
  const appended = [];
  const context = runtime(directory, {
    location: { protocol: 'https:', hostname: 'hispromisedaily.com' },
    document: { createElement: () => ({}), head: { appendChild: script => appended.push(script) } },
  });
  load(context, 'js/analytics.js');
  assert.equal(appended.length, 1);
  assert.equal(appended[0].src, '/_vercel/insights/script.js');
  const beforeSend = context.vaq[0][1];
  assert.equal(context.vaq[0][0], 'beforeSend');
  for (const route of ['/verses/gen-1-28.html', '/verses/jhn-3-16.html', '/browse/',
    '/browse/books/psalms-2.html', '/browse/topics/hope.html']) {
    for (const host of ['hispromisedaily.com', 'www.hispromisedaily.com']) {
      assert.equal(beforeSend({ type: 'pageview', url: `https://${host}${route}?q=private-test&email=test%40example.invalid#saved` }), null);
    }
  }
  const clean = beforeSend({ type: 'pageview', url: 'https://hispromisedaily.com/?q=private-test&email=test%40example.invalid#saved' });
  assert.deepEqual(plain(clean), { type: 'pageview', url: 'https://hispromisedaily.com/' });
  assert.equal(beforeSend({ type: 'event', url: 'https://hispromisedaily.com/' }), null);
  for (const hostname of ['jannikluethi-ux.github.io', 'preview.vercel.app', 'localhost']) {
    const scripts = [];
    const other = runtime(directory, { location: { protocol: 'https:', hostname },
      document: { createElement: () => ({}), head: { appendChild: script => scripts.push(script) } } });
    load(other, 'js/analytics.js');
    assert.equal(scripts.length, 0);
    assert.equal(other.va, undefined);
  }
}

(async () => {
  const directories = [ROOT, path.join(ROOT, 'dist')];
  const oldData = catalog(ROOT);
  const newData = catalog(directories[1]);
  assert.deepEqual(newData, oldData, 'Independent parsed interactive payloads must agree');
  for (const directory of directories) await authAndFavorites(directory);
  assert.deepEqual(search(directories[1], newData), search(ROOT, oldData), 'Search plans and all ranked IDs/scores must be unchanged');
  assert.deepEqual(await versions(directories[1], newData), await versions(ROOT, oldData));
  for (const directory of directories) analytics(directory);
  console.log('Non-browser functional regression: source and dist both pass auth/favorites lifecycle; 15 search queries plus clarification have identical full ranked IDs/scores; all 6 translation modes, on-demand requests/caches/fallbacks unchanged; analytics beforeSend rejects all new paths and strips allowed URL queries/hashes');
})().catch(error => { console.error(error); process.exitCode = 1; });
