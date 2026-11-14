/* Displayed scripture must follow the version selector.
 * A result list that is already on screen reloads in place, and a card never
 * keeps the previous translation under the new label — including while the
 * next translation is still loading. No live network.
 */
'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const ROOT = path.resolve(__dirname, '..');
const VERSIONS = ['web', 'asv', 'darby', 'dra'];
const SHORT = { web: 'WEB', asv: 'ASV', darby: 'DBY', dra: 'DRA' };

function memoryStorage(map = new Map()) {
  return {
    getItem: key => map.has(String(key)) ? map.get(String(key)) : null,
    setItem: (key, value) => map.set(String(key), String(value)),
    removeItem: key => map.delete(String(key)),
    key: index => Array.from(map.keys())[index] ?? null,
    get length() { return map.size; },
  };
}
function decodeHtml(value) {
  return String(value)
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"');
}
function classNamesOf(node) {
  return String(node.className || '').split(/\s+/).filter(Boolean);
}
function matches(node, selector) {
  if (!node || node.nodeType === 'text') return false;
  if (selector === '.card[data-id]') return classNamesOf(node).includes('card') && node.getAttribute('data-id');
  if (selector.startsWith('.') && selector.indexOf('[') === -1) return classNamesOf(node).includes(selector.slice(1));
  if (selector.startsWith('[') && selector.endsWith(']')) return node.getAttribute(selector.slice(1, -1)) != null;
  return false;
}
function rich(tag) {
  const node = {
    tagName: String(tag || 'div').toUpperCase(),
    children: [],
    parentNode: null,
    attrs: {},
    hidden: false,
    isConnected: true,
    value: '',
    _text: '',
    style: {},
  };
  let classNames = [];
  node.classList = {
    add(...xs) { xs.forEach(name => { if (name && !classNames.includes(name)) classNames.push(name); }); },
    remove(...xs) { classNames = classNames.filter(name => !xs.includes(name)); },
    contains: name => classNames.includes(name),
    toggle() {},
  };
  Object.defineProperty(node, 'className', {
    get() { return classNames.join(' '); },
    set(value) { classNames = String(value || '').split(/\s+/).filter(Boolean); },
  });
  Object.defineProperty(node, 'textContent', {
    get() {
      if (node.children.length) return node.children.map(child => child.textContent || '').join('');
      return node._text;
    },
    set(value) {
      node._text = String(value == null ? '' : value);
      node.children = [];
    },
  });
  node.setAttribute = (key, value) => { node.attrs[key] = String(value); };
  node.getAttribute = key => Object.prototype.hasOwnProperty.call(node.attrs, key) ? node.attrs[key] : null;
  node.removeAttribute = key => { delete node.attrs[key]; };
  node.appendChild = child => {
    child.parentNode = node;
    child.isConnected = node.isConnected !== false;
    node.children.push(child);
    return child;
  };
  node.insertAdjacentElement = (where, child) => {
    const parent = node.parentNode;
    if (!parent) return child;
    child.parentNode = parent;
    child.isConnected = parent.isConnected !== false;
    const index = parent.children.indexOf(node);
    parent.children.splice(where === 'afterend' ? index + 1 : index, 0, child);
    return child;
  };
  node.querySelectorAll = selector => {
    const found = [];
    const walk = current => {
      for (const child of current.children) {
        if (matches(child, selector)) found.push(child);
        walk(child);
      }
    };
    walk(node);
    return found;
  };
  node.querySelector = selector => node.querySelectorAll(selector)[0] || null;
  node.closest = selector => {
    let current = node;
    while (current) {
      if (matches(current, selector)) return current;
      current = current.parentNode;
    }
    return null;
  };
  node._on = {};
  node.addEventListener = (type, fn) => { (node._on[type] = node._on[type] || []).push(fn); };
  node.dispatchEvent = event => {
    const listeners = node._on[event.type] || [];
    for (const fn of listeners) {
      fn(Object.assign({ target: node, currentTarget: node, preventDefault() {} }, event));
    }
  };
  return node;
}
function disconnect(node) {
  node.isConnected = false;
  for (const child of node.children || []) disconnect(child);
}
function resultsHost() {
  const host = rich('section');
  host.id = 'results';
  let html = '';
  Object.defineProperty(host, 'innerHTML', {
    get() { return html; },
    set(value) {
      for (const child of host.children) disconnect(child);
      host.children = [];
      html = String(value);
      const re = /data-id="([^"]+)"[\s\S]*?<blockquote class="card-text">([\s\S]*?)<\/blockquote>/g;
      let match;
      while ((match = re.exec(html))) {
        const card = rich('div');
        card.className = 'card';
        card.setAttribute('data-id', decodeHtml(match[1]));
        const block = rich('blockquote');
        block.className = 'card-text';
        block.textContent = decodeHtml(match[2]);
        const why = rich('p');
        why.className = 'discovery-why';
        why.textContent = 'why ' + match[1];
        card.appendChild(block);
        card.appendChild(why);
        host.appendChild(card);
      }
    },
  });
  return host;
}
function catalog() {
  const text = fs.readFileSync(path.join(ROOT, 'promises-data.js'), 'utf8');
  return JSON.parse(text.match(/window\.GODS_PROMISES_DATA\s*=\s*([\s\S]*);\s*$/)[1]);
}
function okBody(url) {
  const parsed = new URL(String(url));
  const parts = parsed.pathname.split('/').filter(Boolean).map(part => decodeURIComponent(part));
  if (parts[0] === 'data') {
    const translation = parts[1];
    const chapter = Number(parts[3]);
    const verses = [];
    for (let n = 1; n <= 176; n++) verses.push({ chapter, verse: n, text: translation.toUpperCase() + ' v' + n });
    return { translation_id: translation, translation: { identifier: translation }, verses };
  }
  const translation = parsed.searchParams.get('translation') || '';
  const reference = decodeURIComponent(parsed.pathname.replace(/^\//, '')).replace(/\+/g, ' ');
  return {
    text: translation.toUpperCase() + ' [[' + reference + ']]',
    translation_id: translation,
    reference,
  };
}
function response(status, body, headers) {
  return {
    ok: status >= 200 && status < 300,
    status,
    headers: { get: name => (headers && headers[String(name).toLowerCase()]) || null },
    json: async () => body,
  };
}
function loadVersions(context) {
  vm.runInContext(fs.readFileSync(path.join(ROOT, 'js/bible-versions.js'), 'utf8'), context, { filename: 'js/bible-versions.js' });
  return context.GodsPromisesVersions;
}
function versionContext(fetch) {
  const label = { textContent: '' };
  const select = { value: '', innerHTML: '', parentNode: null };
  const document = {
    createElement: rich,
    getElementById: id => id === 'version-meta-label' ? label : null,
    querySelectorAll: selector => selector === '#version-filter' ? [select] : [],
  };
  const context = vm.createContext({
    console, URL, TextEncoder, Map, Promise, setTimeout, clearTimeout,
    localStorage: memoryStorage(),
    sessionStorage: memoryStorage(),
    document,
    fetch,
  });
  return { api: loadVersions(context), label, select, context };
}
function cardBlock(card) {
  return card.querySelector('.card-text');
}
function actions(card) {
  return card.querySelectorAll('[data-version-action]').map(button => button.getAttribute('data-version-action'));
}
async function ticks(count) {
  for (let i = 0; i < count; i++) await new Promise(resolve => setTimeout(resolve, 0));
}
async function settle() {
  await ticks(8);
}
function expectedMarker(version, passage) {
  if (version === 'web') return passage.text;
  if (version === 'dra' && passage.book === 'Psalms') return 'numbers the Psalms differently';
  return version.toUpperCase() + ' [[';
}
function assertFinal(version, passage, text) {
  const marker = expectedMarker(version, passage);
  if (version === 'web') {
    assert.equal(text, passage.text);
    return;
  }
  assert.equal(text === passage.text, false, version + ' must not keep WEB for ' + passage.id);
  if (version === 'dra' && passage.book === 'Psalms') {
    assert.match(text, /numbers the Psalms differently/);
    assert.equal(/\[\[/.test(text), false);
    return;
  }
  assert.match(text, new RegExp('^' + version.toUpperCase() + ' \\[\\['));
  assert.equal(text.includes(marker), true);
}
function assertLabel(label, version) {
  assert.equal(label.textContent, SHORT[version] + ' · public domain');
}

(async () => {
  const data = catalog();
  const john = data.promises.find(p => p.id === 'jhn-1-12-13');
  const psalm = data.promises.find(p => p.id === 'psa-23-1-4');
  const missing = {
    id: 'not-a-book-1',
    book: 'Wisdom',
    chapter: 1,
    verseStart: 1,
    verseEnd: 1,
    text: 'WEB ONLY UNLISTED PASSAGE',
  };
  assert.ok(john && john.text && psalm && psalm.book === 'Psalms');
  const passages = [john, psalm];

  const calls = [];
  const loaded = versionContext(async url => {
    calls.push(String(url));
    return response(200, okBody(url));
  });
  const api = loaded.api;
  api.fillSelect(loaded.select);
  assert.match(loaded.select.innerHTML, /value="web"/);
  assert.match(loaded.select.innerHTML, /value="asv"/);
  assert.match(loaded.select.innerHTML, /value="darby"/);
  assert.match(loaded.select.innerHTML, /value="dra"/);
  assert.equal(/kjv|ylt|king james|young/i.test(loaded.select.innerHTML), false);

  const root = rich('div');
  const cards = passages.map(passage => {
    const card = rich('li');
    card.className = 'card';
    card.setAttribute('data-id', passage.id);
    const block = rich('blockquote');
    block.className = 'card-text';
    block.textContent = 'STALE ' + passage.text;
    const explain = rich('p');
    explain.className = 'card-explain-text';
    explain.textContent = 'Explanation for ' + passage.id;
    card.appendChild(block);
    card.appendChild(explain);
    root.appendChild(card);
    return card;
  });
  const explainBefore = cards.map(card => card.querySelector('.card-explain-text').textContent);

  async function arrive(version) {
    api.setCurrent(version);
    await api.hydrateCards(root, passages);
    passages.forEach((passage, i) => assertFinal(version, passage, cardBlock(cards[i]).textContent));
    assertLabel(loaded.label, version);
  }
  async function switchTo(version, previous) {
    api.setCurrent(version);
    const pending = api.hydrateCards(root, passages);
    assertLabel(loaded.label, version);
    passages.forEach((passage, i) => {
      const text = cardBlock(cards[i]).textContent;
      const code = SHORT[version];
      if (version === 'web') {
        assert.equal(text, passage.text, 'WEB text is applied before the next paint');
      } else {
        assert.equal(text, 'Loading ' + code + '…', passage.id + ' while ' + version + ' loads');
        assert.equal(cardBlock(cards[i]).getAttribute('aria-busy'), 'true');
      }
      assert.notEqual(text, previous[i], 'previous ' + passage.id + ' text stayed up under ' + code);
      assert.equal(text.includes('STALE'), false);
    });
    await pending;
    passages.forEach((passage, i) => {
      const text = cardBlock(cards[i]).textContent;
      assertFinal(version, passage, text);
      assert.notEqual(text, previous[i]);
      assert.equal(cardBlock(cards[i]).getAttribute('aria-busy'), null);
      if (version === 'dra' && passage.book === 'Psalms') {
        assert.deepEqual(actions(cards[i]), ['web']);
      } else {
        assert.deepEqual(actions(cards[i]), []);
      }
    });
    assertLabel(loaded.label, version);
    cards.forEach((card, i) => {
      assert.equal(card.querySelector('.card-explain-text').textContent, explainBefore[i]);
    });
  }

  await arrive('web');
  for (const from of VERSIONS) {
    for (const to of VERSIONS) {
      if (from === to) continue;
      await arrive(from);
      const previous = cards.map(card => cardBlock(card).textContent);
      await switchTo(to, previous);
    }
  }
  const callsAfterMatrix = calls.length;
  await arrive('asv');
  assert.equal(calls.length, callsAfterMatrix, 'A repeated ASV paint uses the memory cache');
  assert.equal(calls.some(url => /kjv|ylt/i.test(url)), false);
  assert.equal(calls.some(url => /translation=dra/i.test(url) && /psalm|\/PSA\//i.test(url)), false, 'Douay-Rheims Psalms are not requested');
  assert.ok(calls.some(url => /translation=asv/.test(url) && /John/.test(url)));
  assert.ok(calls.some(url => /translation=darby/.test(url)));
  assert.ok(calls.some(url => /translation=dra/.test(url) && /John/.test(url)));

  // Off-screen cards keep the label honest and do not request until visible.
  const observers = [];
  function IntersectionObserver(callback) {
    this.callback = callback;
    observers.push(this);
  }
  IntersectionObserver.prototype.observe = function () {};
  IntersectionObserver.prototype.disconnect = function () {};
  const lazyCalls = [];
  const lazy = versionContext(async url => {
    lazyCalls.push(String(url));
    return response(200, okBody(url));
  });
  lazy.context.IntersectionObserver = IntersectionObserver;
  lazy.context.window = { innerHeight: 800 };
  const lazyRoot = rich('div');
  const lazyCard = rich('li');
  lazyCard.className = 'card';
  lazyCard.setAttribute('data-id', john.id);
  lazyCard.getBoundingClientRect = () => ({ top: 5000, bottom: 5200, left: 0, right: 100 });
  const lazyBlock = rich('blockquote');
  lazyBlock.className = 'card-text';
  lazyBlock.textContent = john.text;
  lazyCard.appendChild(lazyBlock);
  lazyRoot.appendChild(lazyCard);
  lazy.api.setCurrent('darby');
  const lazyPending = lazy.api.hydrateCards(lazyRoot, [john]);
  assert.equal(lazyBlock.textContent, 'DBY will load when this passage is on screen.');
  assert.equal(lazyBlock.textContent === john.text, false);
  assert.equal(lazyCalls.length, 0);
  assert.equal(lazy.label.textContent, 'DBY · public domain');
  observers[0].callback([{ isIntersecting: true }]);
  await Promise.resolve();
  assert.equal(lazyBlock.textContent, 'Loading DBY…');
  assert.equal(lazyBlock.textContent === john.text, false);
  await lazyPending;
  assert.match(lazyBlock.textContent, /^DARBY \[\[/);
  assert.equal(lazyCalls.length, 1);

  async function failedSwitch(name, fetchImpl, passage, version, duringCode) {
    const failedCalls = [];
    const failed = versionContext(async url => {
      failedCalls.push(String(url));
      return fetchImpl(url, failedCalls);
    });
    const host = rich('div');
    const card = rich('li');
    card.className = 'card';
    card.setAttribute('data-id', passage.id);
    const block = rich('blockquote');
    block.className = 'card-text';
    block.textContent = passage.text;
    card.appendChild(block);
    host.appendChild(card);
    failed.api.setCurrent('web');
    await failed.api.hydrateCards(host, [passage]);
    assert.equal(block.textContent, passage.text);
    failed.api.setCurrent(version);
    const pending = failed.api.hydrateCards(host, [passage]);
    assert.equal(failed.label.textContent, SHORT[version] + ' · public domain');
    if (passage.book === 'Psalms' && version === 'dra') {
      assert.equal(block.textContent, 'Loading DRA…');
    } else if (passage === missing) {
      assert.equal(block.textContent, 'Loading ' + duringCode + '…');
    } else {
      assert.equal(block.textContent, 'Loading ' + duringCode + '…');
    }
    assert.equal(block.textContent === passage.text, false, name + ' left the previous text visible');
    await pending;
    assert.equal(block.textContent === passage.text, false, name + ' showed WEB after the switch');
    assert.equal(/\[\[/.test(block.textContent), false, name);
    if (passage.book === 'Psalms' && version === 'dra') {
      assert.match(block.textContent, /numbers the Psalms differently/);
      assert.deepEqual(actions(card), ['web']);
      assert.equal(failedCalls.length, 0);
    } else {
      assert.match(block.textContent, new RegExp(duringCode + ' text couldn.t load right now'));
      assert.deepEqual(actions(card), ['retry', 'web']);
    }
    assert.equal(failed.label.textContent, SHORT[version] + ' · public domain');
    return { failed, host, card, block, failedCalls, passage };
  }

  await failedSwitch('api down', async () => { throw new Error('offline'); }, john, 'asv', 'ASV');
  await failedSwitch('429', async () => response(429, {}, { 'retry-after': '1' }), john, 'darby', 'DBY');
  await failedSwitch('mismatched id', async () => response(200, {
    text: john.text,
    translation_id: 'web',
    reference: 'John 1:12-13',
  }), john, 'asv', 'ASV');
  await failedSwitch('mismatched reference', async () => response(200, {
    text: 'Some other passage',
    translation_id: 'dra',
    reference: 'Psalms 24:1',
  }), john, 'dra', 'DRA');
  await failedSwitch('dra psalm', async () => response(200, okBody('https://bible-api.com/Psalms%2023?translation=dra')), psalm, 'dra', 'DRA');
  const unavailable = await failedSwitch('unlisted book', async () => {
    throw new Error('should not request an unknown book');
  }, missing, 'asv', 'ASV');
  assert.equal(unavailable.failedCalls.length, 0);

  // A late response must not overwrite the translation now on screen.
  const waiters = [];
  const staleCalls = [];
  const stale = versionContext(async url => {
    staleCalls.push(String(url));
    await new Promise(resolve => waiters.push({ url: String(url), resolve }));
    return response(200, okBody(url));
  });
  const staleHost = rich('div');
  const staleCard = rich('li');
  staleCard.className = 'card';
  staleCard.setAttribute('data-id', john.id);
  const staleBlock = rich('blockquote');
  staleBlock.className = 'card-text';
  staleBlock.textContent = john.text;
  staleCard.appendChild(staleBlock);
  staleHost.appendChild(staleCard);
  stale.api.setCurrent('asv');
  const asvPaint = stale.api.hydrateCards(staleHost, [john]);
  await ticks(3);
  assert.equal(staleBlock.textContent, 'Loading ASV…');
  assert.equal(staleCalls.length, 1);
  stale.api.setCurrent('web');
  await stale.api.hydrateCards(staleHost, [john]);
  assert.equal(staleBlock.textContent, john.text);
  assert.equal(stale.label.textContent, 'WEB · public domain');
  waiters.splice(0).forEach(waiter => waiter.resolve());
  await asvPaint;
  await settle();
  assert.equal(staleBlock.textContent, john.text, 'A late ASV response must not replace WEB');
  assert.equal(/\[\[/.test(staleBlock.textContent), false);

  stale.api.setCurrent('darby');
  const darbyPaint = stale.api.hydrateCards(staleHost, [john]);
  await ticks(3);
  assert.equal(staleBlock.textContent, 'Loading DBY…');
  const darbyWaiters = waiters.splice(0);
  stale.api.setCurrent('dra');
  const draPaint = stale.api.hydrateCards(staleHost, [john]);
  await ticks(3);
  assert.equal(staleBlock.textContent, 'Loading DRA…');
  darbyWaiters.forEach(waiter => waiter.resolve());
  await darbyPaint;
  await settle();
  assert.equal(staleBlock.textContent, 'Loading DRA…', 'A late Darby response must not replace the DRA load');
  waiters.splice(0).forEach(waiter => waiter.resolve());
  await draPaint;
  assert.match(staleBlock.textContent, /^DRA \[\[/);
  assert.equal(stale.label.textContent, 'DRA · public domain');

  // Retry, then Show World English Bible, from the failure state.
  let retryMode = 'fail';
  const retry = versionContext(async url => {
    if (retryMode === 'fail') return response(500, {});
    return response(200, okBody(url));
  });
  const retryHost = rich('div');
  const retryCard = rich('li');
  retryCard.className = 'card';
  retryCard.setAttribute('data-id', john.id);
  const retryBlock = rich('blockquote');
  retryBlock.className = 'card-text';
  retryBlock.textContent = john.text;
  retryCard.appendChild(retryBlock);
  retryHost.appendChild(retryCard);
  retry.api.setCurrent('asv');
  const retryFirst = retry.api.hydrateCards(retryHost, [john]);
  assert.equal(retryBlock.textContent, 'Loading ASV…');
  assert.equal(retryBlock.textContent === john.text, false);
  await retryFirst;
  assert.match(retryBlock.textContent, /ASV text couldn.t load right now/);
  retryMode = 'ok';
  const retryButton = retryCard.querySelectorAll('[data-version-action]').find(button => button.getAttribute('data-version-action') === 'retry');
  retryHost.dispatchEvent({ type: 'click', target: retryButton });
  assert.equal(retryBlock.textContent, 'Loading ASV…');
  await settle();
  assert.match(retryBlock.textContent, /^ASV \[\[/);
  retryMode = 'fail';
  retry.api.setCurrent('darby');
  const held = retry.api.hydrateCards(retryHost, [john]);
  assert.equal(retryBlock.textContent, 'Loading DBY…');
  assert.equal(/ASV \[\[/.test(retryBlock.textContent), false);
  await held;
  assert.match(retryBlock.textContent, /DBY text couldn.t load right now/);
  assert.equal(retry.label.textContent, 'DBY · public domain');
  const showWeb = retryCard.querySelectorAll('[data-version-action]').find(button => button.getAttribute('data-version-action') === 'web');
  retryHost.dispatchEvent({ type: 'click', target: showWeb });
  await settle();
  assert.equal(retryBlock.textContent, john.text);
  assert.equal(retry.label.textContent, 'WEB · public domain');
  assert.equal(retry.api.getCurrentId(), 'web');

  // App wiring: discovery results, a filter study, book browsing, and the comfort fallback.
  const appCalls = [];
  const appWaiters = [];
  let appGate = false;
  let appStatus = 200;
  function appFetch(url) {
    const href = String(url);
    if (!href.includes('bible-api.com')) return Promise.reject(new Error('Unexpected fetch ' + href));
    appCalls.push(href);
    const run = async () => {
      if (appGate) await new Promise(resolve => appWaiters.push({ url: href, resolve }));
      if (appStatus !== 200) return response(appStatus, { text: john.text, translation_id: 'web', reference: 'John 1:1' }, { 'retry-after': '1' });
      return response(200, okBody(href));
    };
    return run();
  }
  const ids = [
    'results', 'search', 'search-form', 'search-submit', 'testament-options', 'book-filter',
    'theme-filter', 'feeling-filter', 'version-filter', 'version-meta-label', 'result-count',
    'results-meta', 'filters-toggle', 'filters-panel', 'filters-badge', 'smart-guide', 'browse-modes',
  ];
  function makeEl(id) {
    return {
      id,
      tagName: 'DIV',
      classList: { add() {}, remove() {}, toggle() {}, contains() { return false; } },
      hidden: false,
      value: '',
      innerHTML: '',
      textContent: '',
      attributes: {},
      dataset: {},
      style: {},
      isConnected: true,
      _on: {},
      addEventListener(type, fn) { (this._on[type] = this._on[type] || []).push(fn); },
      dispatchEvent(event) {
        (this._on[event.type] || []).forEach(fn => fn(Object.assign({
          target: this, currentTarget: this, preventDefault() {},
        }, event)));
      },
      setAttribute(name, value) { this.attributes[name] = String(value); },
      getAttribute(name) { return Object.prototype.hasOwnProperty.call(this.attributes, name) ? this.attributes[name] : null; },
      removeAttribute(name) { delete this.attributes[name]; },
      querySelector() { return null; },
      querySelectorAll() { return []; },
      closest() { return null; },
      focus() {},
      blur() {},
    };
  }
  const elements = {};
  ids.forEach(id => { elements[id] = makeEl(id); });
  const results = resultsHost();
  elements.results = results;
  const label = elements['version-meta-label'];
  const version = elements['version-filter'];
  const document = {
    hidden: false,
    activeElement: null,
    body: makeEl('body'),
    addEventListener() {},
    createElement: rich,
    getElementById(id) { return elements[id] || null; },
    querySelector() { return null; },
    querySelectorAll(selector) { return selector === '#version-filter' ? [version] : []; },
  };
  const sandbox = {
    console, URL, TextEncoder, Map, Promise, setTimeout, clearTimeout,
    setInterval() { return 0; },
    clearInterval() {},
    requestAnimationFrame(fn) { fn(); return 0; },
    fetch: appFetch,
    document,
    localStorage: memoryStorage(),
    sessionStorage: memoryStorage(),
    navigator: { userAgent: 'test' },
    matchMedia() { return { matches: false }; },
    // The production cap is covered by translation-integrity.test.js.
    // This page test issues more than one screen of passage requests.
    GODS_PROMISES_REQUEST_LIMIT: 100,
    GODS_PROMISES_REQUEST_WINDOW_MS: 1000,
  };
  sandbox.window = sandbox;
  sandbox.globalThis = sandbox;
  const appVm = vm.createContext(sandbox);
  for (const file of [
    'promises-data.js', 'js/daily-verse.js', 'js/bible-versions.js', 'js/smart-search.js',
    'js/relevance.js', 'js/discovery-data.js', 'js/discovery.js', 'js/filter-studies.js', 'app.js',
  ]) {
    vm.runInContext(fs.readFileSync(path.join(ROOT, file), 'utf8'), appVm, { filename: file });
  }
  await settle();
  const search = elements.search;
  search.value = 'I feel anxious';
  elements['search-form'].dispatchEvent({ type: 'submit' });
  await settle();
  const shown = results.querySelectorAll('.card[data-id]');
  assert.equal(shown.length, 6, 'anxious search should show the discovery list');
  const order = shown.map(card => card.getAttribute('data-id'));
  assert.ok(order.includes('php-4-6-7'));
  assert.ok(order.includes('psa-23-1-4'));
  const shell = results.innerHTML;
  assert.match(shell, /data-discovery="1"/);
  assert.match(shell, /class="search-feedback"/);
  assert.match(shell, /class="discovery-why"/);
  const webById = new Map(data.promises.map(passage => [passage.id, passage]));
  shown.forEach(card => {
    assert.equal(cardBlock(card).textContent, webById.get(card.getAttribute('data-id')).text);
  });
  assert.match(label.textContent, /^WEB · /);

  async function choose(id) {
    const before = shown.map(card => cardBlock(card).textContent);
    const callsBefore = appCalls.length;
    version.value = id;
    version.dispatchEvent({ type: 'change' });
    assert.equal(label.textContent, SHORT[id] + ' · public domain');
    assert.equal(results.innerHTML, shell, 'switching version must not rebuild the result list');
    shown.forEach((card, i) => {
      const text = cardBlock(card).textContent;
      if (id === 'web') assert.equal(text, webById.get(card.getAttribute('data-id')).text);
      else assert.equal(text, 'Loading ' + SHORT[id] + '…');
      assert.notEqual(text, before[i]);
    });
    await settle();
    shown.forEach(card => {
      const passage = webById.get(card.getAttribute('data-id'));
      assertFinal(id, passage, cardBlock(card).textContent);
    });
    assert.deepEqual(shown.map(card => card.getAttribute('data-id')), order);
    assert.equal(results.innerHTML, shell);
    assert.equal(label.textContent, SHORT[id] + ' · public domain');
    return callsBefore;
  }

  appStatus = 500;
  version.value = 'asv';
  version.dispatchEvent({ type: 'change' });
  shown.forEach(card => assert.equal(cardBlock(card).textContent, 'Loading ASV…'));
  assert.equal(label.textContent, 'ASV · public domain');
  assert.equal(results.innerHTML, shell);
  await settle();
  shown.forEach(card => {
    const text = cardBlock(card).textContent;
    assert.match(text, /ASV text couldn.t load right now/);
    assert.equal(text === webById.get(card.getAttribute('data-id')).text, false);
    assert.deepEqual(actions(card), ['retry', 'web']);
  });
  const retryBtn = shown[0].querySelectorAll('[data-version-action]').find(button => button.getAttribute('data-version-action') === 'retry');
  results.dispatchEvent({ type: 'click', target: retryBtn });
  assert.equal(cardBlock(shown[0]).textContent, 'Loading ASV…');
  await settle();
  assert.match(cardBlock(shown[0]).textContent, /ASV text couldn.t load right now/);
  appStatus = 200;
  const retried = appCalls.length;
  results.dispatchEvent({
    type: 'click',
    target: shown[0].querySelectorAll('[data-version-action]').find(button => button.getAttribute('data-version-action') === 'retry'),
  });
  shown.forEach(card => assert.equal(cardBlock(card).textContent, 'Loading ASV…'));
  await settle();
  assert.equal(appCalls.length - retried, 6, 'one request per anxious passage');
  assert.equal(appCalls.some(url => /kjv|ylt/i.test(url)), false);
  shown.forEach(card => assert.match(cardBlock(card).textContent, /^ASV \[\[/));
  const show = shown[0].querySelectorAll('[data-version-action]').find(button => button.getAttribute('data-version-action') === 'web');
  assert.equal(show, undefined, 'a loaded passage has no Show WEB button');
  version.value = 'web';
  version.dispatchEvent({ type: 'change' });
  shown.forEach(card => assert.equal(cardBlock(card).textContent, webById.get(card.getAttribute('data-id')).text));
  assert.equal(label.textContent, 'WEB · public domain');

  appGate = true;
  version.value = 'darby';
  version.dispatchEvent({ type: 'change' });
  await ticks(3);
  shown.forEach(card => assert.equal(cardBlock(card).textContent, 'Loading DBY…'));
  const lateDarby = appWaiters.filter(waiter => waiter.url.includes('translation=darby'));
  assert.equal(lateDarby.length, 6);
  version.value = 'dra';
  version.dispatchEvent({ type: 'change' });
  shown.forEach(card => assert.equal(cardBlock(card).textContent, 'Loading DRA…'));
  assert.equal(label.textContent, 'DRA · public domain');
  lateDarby.forEach(waiter => waiter.resolve());
  await settle();
  shown.forEach(card => assert.equal(/^DARBY \[\[/.test(cardBlock(card).textContent), false));
  const psalmCard = shown.find(card => card.getAttribute('data-id') === 'psa-23-1-4');
  assert.match(cardBlock(psalmCard).textContent, /numbers the Psalms differently/);
  appWaiters.filter(waiter => waiter.url.includes('translation=dra')).forEach(waiter => waiter.resolve());
  await settle();
  shown.forEach(card => assertFinal('dra', webById.get(card.getAttribute('data-id')), cardBlock(card).textContent));
  assert.equal(appCalls.some(url => /translation=dra/i.test(url) && /psalm|\/PSA\//i.test(url)), false);
  assert.deepEqual(actions(psalmCard), ['web']);
  appGate = false;
  const cached = appCalls.length;
  await choose('asv');
  await choose('darby');
  await choose('dra');
  await choose('web');
  assert.equal(appCalls.length, cached, 'returning through a loaded translation does not refetch');

  search.value = '';
  elements['feeling-filter'].value = 'anxious';
  elements['feeling-filter'].dispatchEvent({ type: 'change' });
  await settle();
  const study = results.querySelectorAll('.card[data-id]');
  assert.ok(study.length > 1);
  assert.match(results.innerHTML, /data-discovery="1"/);
  const studyShell = results.innerHTML;
  version.value = 'darby';
  version.dispatchEvent({ type: 'change' });
  study.forEach(card => assert.equal(cardBlock(card).textContent, 'Loading DBY…'));
  await settle();
  study.forEach(card => {
    const passage = webById.get(card.getAttribute('data-id'));
    assertFinal('darby', passage, cardBlock(card).textContent);
  });
  assert.equal(results.innerHTML, studyShell);

  elements['feeling-filter'].value = '';
  elements['book-filter'].value = 'John';
  elements['book-filter'].dispatchEvent({ type: 'change' });
  await settle();
  const bookCard = results.querySelector('.card[data-id]');
  assert.ok(bookCard);
  const bookWeb = cardBlock(bookCard).textContent;
  version.value = 'asv';
  version.dispatchEvent({ type: 'change' });
  assert.equal(cardBlock(bookCard).textContent, 'Loading ASV…');
  assert.notEqual(cardBlock(bookCard).textContent, bookWeb);
  await settle();
  assert.match(cardBlock(bookCard).textContent, /^ASV \[\[John /);
  version.value = 'web';
  version.dispatchEvent({ type: 'change' });
  assert.equal(cardBlock(bookCard).textContent, webById.get(bookCard.getAttribute('data-id')).text);

  elements['book-filter'].value = '';
  search.value = 'unknownzzword';
  elements['search-form'].dispatchEvent({ type: 'submit' });
  await settle();
  assert.match(results.innerHTML, /data-fallback="1"/);
  const fallbackShell = results.innerHTML;
  const fallbackCards = results.querySelectorAll('.card[data-id]');
  assert.ok(fallbackCards.length > 0);
  version.value = 'dra';
  version.dispatchEvent({ type: 'change' });
  fallbackCards.forEach(card => assert.equal(cardBlock(card).textContent, 'Loading DRA…'));
  await settle();
  fallbackCards.forEach(card => assertFinal('dra', webById.get(card.getAttribute('data-id')), cardBlock(card).textContent));
  assert.equal(results.innerHTML, fallbackShell);
  assert.match(fallbackShell, /This search wasn’t clear/);

  console.log('translation-switch: discovery results follow WEB, ASV, Darby, and Douay-Rheims in every direction; loading, 429, mismatch, outage, withheld Psalms, and late responses never leave the previous text under the new label');
})().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
