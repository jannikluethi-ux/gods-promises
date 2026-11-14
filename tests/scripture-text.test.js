/* The text provider keeps main's request rules. No live network. */
'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const ROOT = path.resolve(__dirname, '..');

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
function load(context) {
  for (const file of ['js/scripture-books.js', 'js/translation-registry.js', 'js/scripture-text.js', 'js/bible-versions.js']) {
    vm.runInContext(fs.readFileSync(path.join(ROOT, file), 'utf8'), context, { filename: file });
  }
}
function boot(fetch) {
  const context = vm.createContext({
    console, URL, Map, Promise, setTimeout, clearTimeout,
    localStorage: memoryStorage(), sessionStorage: memoryStorage(), fetch,
  });
  load(context);
  return context;
}

const john = {
  id: 'jhn-3-16', book: 'John', chapter: 3, verseStart: 16, verseEnd: 16,
  text: 'For God so loved the world.',
};
const psalm = {
  id: 'psa-23-1', book: 'Psalms', chapter: 23, verseStart: 1, verseEnd: 1,
  text: 'The LORD is my shepherd.',
};

(async () => {
  const calls = [];
  const context = boot(async url => {
    calls.push(String(url));
    const parsed = new URL(String(url));
    const translation = parsed.searchParams.get('translation');
    const reference = decodeURIComponent(parsed.pathname.replace(/^\//, '')).replace(/\+/g, ' ');
    return {
      ok: true, status: 200, headers: { get: () => null },
      json: async () => ({ text: '  Synthetic ' + translation + ' line.  ', translation_id: translation, reference }),
    };
  });
  const versions = context.GodsPromisesVersions;
  const text = context.GodsPromisesScriptureText;
  assert.equal(text.usesNetwork('web'), false);
  assert.equal(text.usesNetwork('asv'), true);
  assert.equal(text.usesNetwork('ylt'), false);
  assert.equal(text.catalogText(john), john.text);

  const seen = [];
  const real = text.resolve;
  text.resolve = function (passage, id) {
    seen.push(id);
    return real(passage, id);
  };
  const result = await versions.resolveText(john, 'asv');
  assert.deepEqual(seen, ['asv']);
  assert.equal(result.source, 'asv');
  assert.equal(result.text, 'Synthetic asv line.');
  assert.equal(calls.length, 1);
  assert.equal(calls[0], 'https://bible-api.com/' + encodeURIComponent('John 3:16') + '?translation=asv');

  const withheldCalls = [];
  const withheld = boot(async url => {
    withheldCalls.push(String(url));
    throw new Error('must not request a withheld Psalm');
  });
  const psalmResult = await withheld.GodsPromisesVersions.resolveText(psalm, 'dra');
  assert.equal(psalmResult.withheld, true);
  assert.equal(psalmResult.source, 'dra');
  assert.equal(psalmResult.text, '');
  assert.equal(withheldCalls.length, 0);

  const failed = boot(async () => { throw new Error('down'); });
  const outage = await failed.GodsPromisesScriptureText.resolve(john, 'darby');
  assert.equal(outage.error, true);
  assert.equal(outage.source, 'darby');
  assert.equal(outage.text, '');
  assert.match(outage.note, /DBY text couldn't load right now/);
  assert.equal(outage.text === john.text, false);

  const source = fs.readFileSync(path.join(ROOT, 'js/scripture-text.js'), 'utf8');
  assert.equal(/kjv/i.test(source), false);
  assert.equal(/ylt/i.test(source), false);
  assert.equal(source.includes('https://bible-api.com/'), true);

  console.log('scripture text: cards use the provider; single-passage URLs, withheld Psalms, and failure text match the current loader');
})().catch(error => { console.error(error); process.exitCode = 1; });
