/* Text provider: bundled WEB, unchanged bible-api.com URLs, card rendering. No live network. */
'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const ROOT = path.resolve(__dirname, '..');
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
function load(context, relative) {
  vm.runInContext(fs.readFileSync(path.join(ROOT, relative), 'utf8'), context, { filename: relative });
}
function boot(fetch, storage = memoryStorage(), session = memoryStorage()) {
  const context = vm.createContext({
    console, URL, setTimeout, clearTimeout,
    localStorage: storage, sessionStorage: session, fetch,
    document: { createElement: () => ({ className: '', hidden: true, textContent: '' }) },
  });
  load(context, 'js/scripture-books.js');
  load(context, 'js/translation-registry.js');
  load(context, 'js/scripture-text.js');
  load(context, 'js/bible-versions.js');
  return context;
}
function element() {
  const node = {
    hidden: true,
    textContent: '',
    isConnected: true,
    attrs: {},
    classList: { add() {}, remove() {} },
    setAttribute(key, value) { this.attrs[key] = String(value); },
    getAttribute(key) { return Object.prototype.hasOwnProperty.call(this.attrs, key) ? this.attrs[key] : null; },
    removeAttribute(key) { delete this.attrs[key]; },
    insertAdjacentElement(_where, child) { node.note = child; },
    querySelector(selector) {
      if (selector === '.card-text') return node;
      if (selector === '.card-version-note') return node.note || null;
      return null;
    },
  };
  return node;
}

const john = {
  id: 'jhn-3-16',
  book: 'John',
  chapter: 3,
  verseStart: 16,
  verseEnd: 16,
  text: 'For God so loved the world.',
};
const philippians = {
  id: 'php-4-6-7',
  book: 'Philippians',
  chapter: 4,
  verseStart: 6,
  verseEnd: 7,
  text: 'In nothing be anxious.',
};
const genesis = {
  id: 'gen-1-1',
  book: 'Genesis',
  chapter: 1,
  verseStart: 1,
  verseEnd: 1,
  text: 'In the beginning.',
};

(async () => {
  const calls = [];
  const context = boot(async url => {
    calls.push(String(url));
    return { ok: true, json: async () => ({ text: '  Synthetic test translation\n line.  ' }) };
  });
  const text = context.GodsPromisesScriptureText;
  const versions = context.GodsPromisesVersions;
  assert.deepEqual(
    plain(versions.VERSIONS.map(v => ({ id: v.id, label: v.label, short: v.short, api: v.api, ntOnly: !!v.ntOnly }))),
    plain(context.GodsPromisesTranslations.legacyVersionList())
  );
  assert.equal(text.catalogText(john), john.text);
  assert.equal(text.catalogText({}), '');
  assert.equal(text.usesNetwork('web'), false);
  assert.equal(text.usesNetwork('asv'), true);
  assert.equal(text.usesNetwork('ylt'), true);
  assert.equal(text.usesNetwork('missing'), false);

  assert.deepEqual(plain(await versions.resolveText(john, 'web')), { text: john.text, source: 'web' });
  assert.equal(calls.length, 0);

  const expected = {
    asv: 'https://bible-api.com/' + encodeURIComponent('John 3:16') + '?translation=asv',
    ylt: 'https://bible-api.com/' + encodeURIComponent('Philippians 4:6-7') + '?translation=ylt',
    darby: 'https://bible-api.com/' + encodeURIComponent('John 3:16') + '?translation=darby',
    dra: 'https://bible-api.com/' + encodeURIComponent('John 3:16') + '?translation=dra',
  };
  const passages = { asv: john, ylt: philippians, darby: john, dra: john };
  for (const id of ['asv', 'ylt', 'darby', 'dra']) {
    const before = calls.length;
    const first = versions.resolveText(passages[id], id);
    const second = text.resolve(passages[id], id);
    assert.equal(first, second, id);
    const result = await first;
    assert.equal(result.source, id);
    assert.equal(result.text, 'Synthetic test translation line.');
    assert.equal(calls.length, before + 1);
    assert.equal(calls.at(-1), expected[id]);
  }

  const yltOt = await text.resolve(genesis, 'ylt');
  assert.equal(yltOt.text, genesis.text);
  assert.equal(yltOt.source, 'web');
  assert.equal(yltOt.note, 'YLT covers the New Testament only — showing WEB.');
  assert.equal(calls.length, 4);

  const failing = boot(async url => {
    calls.push('fail ' + url);
    throw new Error('down');
  });
  const failed = await failing.GodsPromisesScriptureText.resolve(john, 'darby');
  assert.equal(failed.text, john.text);
  assert.equal(failed.source, 'web');
  assert.equal(failed.note, 'Could not load DBY — showing WEB.');
  assert.match(calls.at(-1), /\?translation=darby$/);

  const seen = [];
  const realResolve = text.resolve;
  text.resolve = function (passage, id) {
    seen.push(id);
    return realResolve(passage, id);
  };
  const catalogSeen = [];
  const realCatalog = text.catalogText;
  text.catalogText = function (passage) {
    catalogSeen.push(passage.id);
    return realCatalog(passage);
  };

  const webBlock = element();
  const webCard = {
    getAttribute(name) { return name === 'data-id' ? john.id : null; },
    querySelector: selector => webBlock.querySelector(selector),
  };
  await versions.hydrateCards({ querySelectorAll: () => [webCard] }, [john]);
  assert.deepEqual(seen, []);
  assert.deepEqual(catalogSeen, [john.id]);
  assert.equal(webBlock.textContent, john.text);

  versions.setCurrent('asv');
  const asvBlock = element();
  const asvCard = {
    getAttribute(name) { return name === 'data-id' ? john.id : null; },
    querySelector: selector => asvBlock.querySelector(selector),
  };
  await versions.hydrateCards({ querySelectorAll: () => [asvCard] }, [john]);
  assert.deepEqual(seen, ['asv']);
  assert.equal(asvBlock.textContent, 'Synthetic test translation line.');
  assert.equal(asvBlock.attrs['aria-busy'], undefined);

  const source = fs.readFileSync(path.join(ROOT, 'js/scripture-text.js'), 'utf8');
  assert.equal(/kjv/i.test(source), false);
  assert.equal(/king james/i.test(source), false);
  assert.equal(source.includes('https://bible-api.com/'), true);

  console.log('scripture text: WEB stays on the catalog; ASV, YLT, Darby, and Douay-Rheims request URLs unchanged; cards use the provider');
})().catch(error => { console.error(error); process.exitCode = 1; });
