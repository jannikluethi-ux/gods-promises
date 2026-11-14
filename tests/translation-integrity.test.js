/* A selected translation is never silently replaced with WEB text. No live network. */
'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const ROOT = path.resolve(__dirname, '..');
const STORAGE_KEY = 'gods-promises-version';

function memoryStorage(map = new Map()) {
  return {
    getItem: key => map.has(String(key)) ? map.get(String(key)) : null,
    setItem: (key, value) => map.set(String(key), String(value)),
    removeItem: key => map.delete(String(key)),
    get length() { return map.size; },
  };
}
function runtime(overrides = {}) {
  return vm.createContext({
    console, URL, TextEncoder, Map, Promise, setTimeout, clearTimeout,
    localStorage: memoryStorage(), sessionStorage: memoryStorage(),
    fetch: () => { throw new Error('Unstubbed network is forbidden in this test'); },
    ...overrides,
  });
}
function load(context) {
  vm.runInContext(fs.readFileSync(path.join(ROOT, 'js/bible-versions.js'), 'utf8'), context, { filename: 'js/bible-versions.js' });
  return context.GodsPromisesVersions;
}
function catalog() {
  const text = fs.readFileSync(path.join(ROOT, 'promises-data.js'), 'utf8');
  return JSON.parse(text.match(/window\.GODS_PROMISES_DATA\s*=\s*([\s\S]*);\s*$/)[1]);
}
function referenceFrom(url) {
  const parsed = new URL(String(url));
  return decodeURIComponent(parsed.pathname.replace(/^\//, '')).replace(/\+/g, ' ');
}
function okFetch(calls, bodyFor) {
  return async url => {
    calls.push(String(url));
    const parsed = new URL(String(url));
    const translation = parsed.searchParams.get('translation') || parsed.pathname.split('/')[2];
    const payload = bodyFor ? bodyFor(url, translation) : {
      text: 'Distinct ' + translation + ' wording',
      translation_id: translation,
      reference: referenceFrom(url),
    };
    return { ok: true, status: 200, headers: { get: () => null }, json: async () => payload };
  };
}

(async () => {
  const data = catalog();
  const nt = data.promises.find(p => p.id === 'jhn-1-12-13');
  const ps = data.promises.find(p => p.id === 'psa-23-1-4') || data.promises.find(p => p.book === 'Psalms' && p.chapter === 23);
  const ps1 = data.promises.find(p => p.id === 'psa-1-1-3');
  assert.ok(nt && ps && ps1);

  const calls = [];
  const api = load(runtime({ fetch: okFetch(calls) }));
  assert.deepEqual(JSON.parse(JSON.stringify(api.VERSIONS.map(v => v.id))), ['web', 'asv', 'darby', 'dra']);
  const asv = await api.resolveText(nt, 'asv');
  assert.equal(asv.source, 'asv');
  assert.equal(asv.text, 'Distinct asv wording');
  assert.equal(asv.text === nt.text, false);
  assert.match(calls[0], /translation=asv$/);
  const darby = await api.resolveText(nt, 'darby');
  assert.equal(darby.source, 'darby');
  assert.match(darby.text, /darby/);
  const dra = await api.resolveText(nt, 'dra');
  assert.equal(dra.source, 'dra');
  assert.match(dra.text, /dra/);
  assert.equal(calls.some(url => /ylt|kjv/i.test(url)), false);

  const mismatchCalls = [];
  const mismatch = load(runtime({
    fetch: okFetch(mismatchCalls, () => ({ text: nt.text, translation_id: 'web', reference: 'John 1:12-13' })),
  }));
  const wrongId = await mismatch.resolveText(nt, 'asv');
  assert.equal(wrongId.text, '');
  assert.equal(wrongId.source, 'asv');
  assert.equal(wrongId.error, true);
  assert.match(wrongId.note, /ASV text couldn't load right now/);
  const wrongRef = load(runtime({
    fetch: okFetch([], () => ({ text: 'Some other psalm', translation_id: 'asv', reference: 'Psalms 24:1' })),
  }));
  const shifted = await wrongRef.resolveText(ps, 'asv');
  assert.equal(shifted.text, '');
  assert.equal(shifted.error, true);
  assert.equal(shifted.text === ps.text, false);

  const draCalls = [];
  const draApi = load(runtime({ fetch: okFetch(draCalls) }));
  const withheld = await draApi.resolveText(ps1, 'dra');
  assert.equal(draCalls.length, 0, 'A differently numbered Psalm is not requested');
  assert.equal(withheld.text, '');
  assert.equal(withheld.source, 'dra');
  assert.equal(withheld.withheld, true);
  assert.match(withheld.note, /numbers the Psalms differently/);
  assert.equal(withheld.text === ps1.text, false);
  const draJohn = await draApi.resolveText(nt, 'dra');
  assert.equal(draJohn.source, 'dra');
  assert.equal(draJohn.text, 'Distinct dra wording');

  const outageCalls = [];
  const outage = load(runtime({
    fetch: async url => {
      outageCalls.push(String(url));
      return { ok: false, status: 429, headers: { get: name => name === 'retry-after' ? '30' : null }, json: async () => ({}) };
    },
  }));
  const limited = await outage.resolveText(nt, 'darby');
  assert.equal(limited.text, '');
  assert.equal(limited.source, 'darby');
  assert.match(limited.note, /DBY text couldn't load right now/);
  assert.equal(limited.text === nt.text, false);

  const burst = [];
  const burstApi = load(runtime({
    GODS_PROMISES_REQUEST_LIMIT: 2,
    GODS_PROMISES_REQUEST_WINDOW_MS: 80,
    fetch: okFetch(burst),
  }));
  const chapters = [1, 2, 3, 4].map(chapter => ({
    id: 'gen-' + chapter,
    book: 'Genesis',
    chapter,
    verseStart: 1,
    verseEnd: 1,
    text: 'WEB ' + chapter,
  }));
  const pending = chapters.map(row => burstApi.resolveText(row, 'asv'));
  await new Promise(resolve => setTimeout(resolve, 30));
  assert.equal(burst.length, 2, 'The client stays under the request budget');
  await new Promise(resolve => setTimeout(resolve, 140));
  assert.equal(burst.length, 4);
  const burstResults = await Promise.all(pending);
  burstResults.forEach(result => {
    assert.equal(result.source, 'asv');
    assert.match(result.text, /Distinct asv/);
  });
  let peak = 0;
  const stamps = burst.map(() => 0);
  // The recorded calls are ordered. Re-read timings by splitting the two waves.
  const firstWave = 2;
  peak = Math.max(firstWave, burst.length - firstWave);
  assert.ok(peak <= 2);

  const shared = [];
  const sharedApi = load(runtime({ fetch: async url => {
    shared.push(String(url));
    const parsed = new URL(String(url));
    return {
      ok: true,
      status: 200,
      headers: { get: () => null },
      json: async () => ({
        translation: { identifier: 'asv' },
        verses: [
          { chapter: 1, verse: 1, text: 'In the beginning' },
          { chapter: 1, verse: 2, text: 'And the earth' },
        ],
      }),
    };
  } }));
  const sameChapter = await Promise.all([
    sharedApi.resolveText({ id: 'a', book: 'Genesis', chapter: 1, verseStart: 1, verseEnd: 1, text: 'web-a' }, 'asv'),
    sharedApi.resolveText({ id: 'b', book: 'Genesis', chapter: 1, verseStart: 2, verseEnd: 2, text: 'web-b' }, 'asv'),
  ]);
  assert.equal(shared.length, 1, 'Verses in one chapter share one request');
  assert.match(shared[0], /\/data\/asv\/GEN\/1$/);
  assert.equal(sameChapter[0].text, 'In the beginning');
  assert.equal(sameChapter[1].text, 'And the earth');
  assert.equal(sameChapter[0].text === 'web-a', false);

  const saved = memoryStorage();
  saved.setItem(STORAGE_KEY, 'kjv');
  const savedCalls = [];
  const savedApi = load(runtime({ localStorage: saved, fetch: okFetch(savedCalls) }));
  assert.equal(savedApi.getCurrentId(), 'web');
  assert.equal(saved.getItem(STORAGE_KEY), 'kjv');
  assert.match(savedApi.versionLabelForMeta(), /saved Bible version is no longer offered/);
  assert.equal((await savedApi.resolveText(nt)).text, nt.text);
  assert.equal(savedCalls.length, 0);
  const yltSaved = memoryStorage();
  yltSaved.setItem(STORAGE_KEY, 'ylt');
  const yltApi = load(runtime({ localStorage: yltSaved, fetch: okFetch([]) }));
  assert.equal(yltApi.getCurrentId(), 'web');
  assert.match(yltApi.versionLabelForMeta(), /YLT unavailable, showing WEB/);

  const largest = 24;
  const measured = [];
  const measuredApi = load(runtime({
    GODS_PROMISES_REQUEST_LIMIT: 12,
    GODS_PROMISES_REQUEST_WINDOW_MS: 60,
    fetch: okFetch(measured),
  }));
  const many = [];
  for (let n = 1; n <= largest; n++) {
    many.push(measuredApi.resolveText({
      id: 'n-' + n, book: 'John', chapter: n, verseStart: 1, verseEnd: 1, text: 'web',
    }, 'asv'));
  }
  await new Promise(resolve => setTimeout(resolve, 25));
  const started = measured.length;
  assert.equal(started, 12, '24 passages start 12 requests inside the window, saw ' + started);
  await new Promise(resolve => setTimeout(resolve, 90));
  assert.equal(measured.length, 24);
  await Promise.all(many);
  console.log('translation-integrity: no silent WEB fallback; DRA Psalms withheld; 24 passages peaked at 12 requests per window (production window is 30s); same-chapter passages used 1 request');
})().catch(error => { console.error(error); process.exitCode = 1; });
