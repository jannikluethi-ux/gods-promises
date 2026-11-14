/* Saved YLT shows catalog WEB and says so. It is not offered or requested. No network. */
'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const ROOT = path.resolve(__dirname, '..');
const STORAGE_KEY = 'gods-promises-version';
const NOTE = 'YLT unavailable, showing WEB.';
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
  const match = text.match(/window\.GODS_PROMISES_DATA\s*=\s*([\s\S]*);\s*$/);
  assert.ok(match, 'Expected literal catalog assignment');
  return JSON.parse(match[1]);
}
function boot(storage, session, calls) {
  const fetch = async url => {
    calls.push(String(url));
    return { ok: true, json: async () => ({ text: '  Synthetic test translation\n line.  ', translation_id: 'synthetic' }) };
  };
  return load(runtime({ localStorage: storage, sessionStorage: session, fetch }));
}
function assertNoYltRequest(calls) {
  for (const url of calls) {
    assert.equal(/translation=ylt/i.test(url), false, url);
    assert.equal(/[?&]ylt\b/i.test(url), false, url);
  }
}

function element(tag) {
  const node = {
    tagName: String(tag || 'div').toUpperCase(),
    children: [],
    parentNode: null,
    attributes: {},
    className: '',
    hidden: false,
    textContent: '',
    isConnected: true,
    value: '',
    innerHTML: '',
  };
  node.classList = { add() {}, remove() {} };
  node.setAttribute = (key, value) => { node.attributes[key] = String(value); };
  node.getAttribute = key => Object.prototype.hasOwnProperty.call(node.attributes, key) ? node.attributes[key] : null;
  node.removeAttribute = key => { delete node.attributes[key]; };
  node.insertAdjacentElement = (where, child) => {
    child.parentNode = node.parentNode;
    child.isConnected = true;
    if (where === 'afterend' && node.parentNode) {
      const index = node.parentNode.children.indexOf(node);
      node.parentNode.children.splice(index + 1, 0, child);
    }
    return child;
  };
  node.querySelectorAll = selector => {
    const found = [];
    const walk = current => {
      if (matches(current, selector)) found.push(current);
      for (const child of current.children) walk(child);
    };
    for (const child of node.children) walk(child);
    return found;
  };
  node.querySelector = selector => node.querySelectorAll(selector)[0] || null;
  return node;
}
function matches(node, selector) {
  const classes = String(node.className || '').split(/\s+/);
  if (selector === '.card[data-id]') return classes.includes('card') && node.getAttribute('data-id');
  if (selector === '.card-text') return classes.includes('card-text');
  if (selector === '.card-version-note') return classes.includes('card-version-note');
  if (selector === '.version-unavailable-note') return classes.includes('version-unavailable-note');
  return false;
}
function append(parent, child) {
  child.parentNode = parent;
  parent.children.push(child);
  return child;
}

(async () => {
  const data = catalog();
  const nt = data.promises.find(p => p.id === 'jhn-1-12-13');
  const ot = data.promises.find(p => p.id === 'psa-1-1-3');
  assert.ok(nt && nt.text && ot && ot.text);

  const calls = [];
  const storage = memoryStorage();
  storage.setItem(STORAGE_KEY, 'ylt');
  const session = memoryStorage();
  session.setItem(
    'gods-promises-verse:ylt|' + nt.id + '|' + nt.book + '|' + nt.chapter + ':' + nt.verseStart + '-' + nt.verseEnd,
    'for God did so love the world, that His Son -- the only begotten -- He gave'
  );
  const api = boot(storage, session, calls);
  assert.deepEqual(plain(api.VERSIONS.map(v => v.id)), ['web', 'asv', 'darby', 'dra']);
  assert.equal(api.VERSIONS.some(v => /ylt/i.test(v.id + v.label + (v.api || ''))), false);
  assert.equal(api.getCurrentId(), 'web');
  assert.equal(api.getCurrent().short, 'WEB');
  assert.equal(api.getCurrent().api, null);
  assert.equal(storage.getItem(STORAGE_KEY), 'ylt', 'Loading a saved ylt id must not rewrite it');
  assert.equal(api.unavailableNotice(), NOTE);
  assert.equal(api.versionLabelForMeta(), 'WEB · ' + NOTE);
  assert.equal(calls.length, 0);

  for (const book of [nt, ot]) {
    const before = calls.length;
    const result = await api.resolveText(book, 'ylt');
    assert.equal(result.text, book.text, book.id);
    assert.equal(result.source, 'web', book.id);
    assert.equal(result.note, NOTE, book.id);
    assert.equal(result.text.includes('only begotten'), false, book.id);
    assert.equal(calls.length, before, book.id);
  }
  const current = await api.resolveText(nt);
  assert.equal(current.text, nt.text);
  assert.equal(current.note, NOTE);
  const namedWeb = await api.resolveText(nt, 'web');
  assert.equal(namedWeb.text, nt.text);
  assert.equal(namedWeb.note, undefined);
  assert.equal(namedWeb.source, 'web');
  assert.equal(calls.length, 0);

  for (const raw of ['YLT', ' ylt ', 'Ylt']) {
    const before = calls.length;
    const result = await api.resolveText(nt, raw);
    assert.equal(result.text, nt.text, raw);
    assert.equal(result.note, NOTE, raw);
    api.setCurrent(raw);
    assert.equal(api.getCurrentId(), 'web', raw);
    assert.equal(storage.getItem(STORAGE_KEY), 'ylt', raw);
    assert.equal(calls.length, before, raw);
  }

  const select = element('select');
  const row = element('div');
  append(row, select);
  const label = { textContent: 'YLT · public domain' };
  const document = {
    createElement: element,
    getElementById: id => id === 'version-meta-label' ? label : null,
    querySelectorAll: selector => selector === '#version-filter' ? [select] : [],
  };
  const uiCalls = [];
  const uiStorage = memoryStorage();
  uiStorage.setItem(STORAGE_KEY, 'ylt');
  const ui = load(runtime({
    localStorage: uiStorage,
    sessionStorage: memoryStorage(),
    document,
    fetch: async url => {
      uiCalls.push(String(url));
      return { ok: false, status: 404, json: async () => { throw new Error('404'); } };
    },
  }));
  ui.fillSelect(select);
  assert.equal(select.value, 'web');
  assert.match(select.innerHTML, /World English Bible \(WEB\)/);
  assert.match(select.innerHTML, /American Standard Version \(ASV\)/);
  assert.match(select.innerHTML, /Darby Translation \(DBY\)/);
  assert.match(select.innerHTML, /Douay-Rheims \(DRA\)/);
  assert.equal(/ylt|Young/i.test(select.innerHTML), false);
  assert.equal(label.textContent, 'WEB · ' + NOTE);
  const banner = row.querySelector('.version-unavailable-note');
  assert.ok(banner, 'The version control shows the notice');
  assert.equal(banner.hidden, false);
  assert.equal(banner.textContent, NOTE);
  assert.equal(banner.getAttribute('role'), 'status');

  const results = element('ul');
  for (const book of [nt, ot]) {
    const card = append(results, element('li'));
    card.className = 'card';
    card.setAttribute('data-id', book.id);
    const block = append(card, element('blockquote'));
    block.className = 'card-text';
    block.textContent = 'PLACEHOLDER';
  }
  await ui.hydrateCards(results, [nt, ot]);
  for (const card of results.querySelectorAll('.card[data-id]')) {
    const book = card.getAttribute('data-id') === nt.id ? nt : ot;
    const note = card.querySelector('.card-version-note');
    assert.equal(card.querySelector('.card-text').textContent, book.text);
    assert.equal(note.hidden, false);
    assert.equal(note.textContent, NOTE);
  }
  assert.equal(uiCalls.length, 0, 'A 404 stub must not be called for YLT');
  assertNoYltRequest(uiCalls);

  ui.setCurrent('web');
  assert.equal(uiStorage.getItem(STORAGE_KEY), 'web', 'Choosing WEB replaces the unavailable id');
  assert.equal(ui.getCurrentId(), 'web');
  assert.equal(ui.unavailableNotice(), '');
  assert.equal(ui.versionLabelForMeta(), 'WEB · public domain');
  assert.equal(label.textContent, 'WEB · public domain');
  assert.equal(banner.hidden, true);
  await ui.hydrateCards(results, [nt, ot]);
  for (const card of results.querySelectorAll('.card[data-id]')) {
    const note = card.querySelector('.card-version-note');
    assert.equal(note.hidden, true);
    assert.equal(note.textContent, '');
  }

  const kept = memoryStorage();
  const keptCalls = [];
  const keptApi = boot(kept, memoryStorage(), keptCalls);
  keptApi.setCurrent('asv');
  assert.equal(kept.getItem(STORAGE_KEY), 'asv');
  keptApi.setCurrent('ylt');
  assert.equal(kept.getItem(STORAGE_KEY), 'asv', 'An unavailable id must not replace a saved offered version');
  assert.equal(keptApi.getCurrentId(), 'web');
  assert.equal(keptApi.versionLabelForMeta(), 'WEB · ' + NOTE);
  assert.equal((await keptApi.resolveText(nt)).text, nt.text);
  assert.equal(keptCalls.length, 0);
  keptApi.setCurrent('darby');
  assert.equal(kept.getItem(STORAGE_KEY), 'darby');
  assert.equal(keptApi.unavailableNotice(), '');
  assert.equal(keptApi.versionLabelForMeta(), 'DBY · public domain');
  const darby = await keptApi.resolveText(nt);
  assert.equal(darby.source, 'darby');
  assert.equal(darby.text, 'Synthetic test translation line.');
  assert.match(keptCalls.at(-1), /\?translation=darby$/);
  assertNoYltRequest(keptCalls);

  const upper = memoryStorage();
  upper.setItem(STORAGE_KEY, 'YLT');
  const upperApi = boot(upper, memoryStorage(), []);
  assert.equal(upper.getItem(STORAGE_KEY), 'YLT');
  assert.equal(upperApi.getCurrentId(), 'web');
  assert.equal(upperApi.unavailableNotice(), NOTE);

  const terms = fs.readFileSync(path.join(ROOT, 'terms.html'), 'utf8');
  assert.match(terms, /Young's Literal Translation is not offered/);
  assert.equal(/offered \(ASV, YLT/i.test(terms), false);
  assert.equal(/King James|Authorized Version|translation=kjv/i.test(terms), false);
  const support = fs.readFileSync(path.join(ROOT, 'support.html'), 'utf8');
  assert.equal(/Young's Literal Translation|\bYLT\b/.test(support), false);
  const readme = fs.readFileSync(path.join(ROOT, 'README.md'), 'utf8');
  assert.match(readme, /Young's Literal Translation is not offered/);
  assert.equal(/ASV, YLT/.test(readme), false);
  assert.match(fs.readFileSync(path.join(ROOT, 'sw.js'), 'utf8'), /hpd-shell-v7/);

  console.log('YLT unavailable: selector hides it; saved ylt stays stored, shows catalog WEB, and says YLT unavailable, showing WEB; choosing an offered version clears the notice; no ylt request');
})().catch(error => { console.error(error); process.exitCode = 1; });
