/* Feeling and theme filters render through the same discovery layout as search. */
'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { validateSearchFeedback } = require('../api/_lib/feedback-core');

const ROOT = path.resolve(__dirname, '..');

function makeEl(id) {
  const listeners = {};
  return {
    id: id,
    tagName: id === 'search' ? 'INPUT' : 'DIV',
    classList: {
      add() {},
      remove() {},
      toggle() {},
      contains() { return false; },
    },
    hidden: false,
    value: '',
    options: [],
    dataset: {},
    innerHTML: '',
    textContent: '',
    attributes: {},
    style: {},
    offsetWidth: 1,
    isConnected: true,
    addEventListener(type, fn) {
      (listeners[type] = listeners[type] || []).push(fn);
    },
    removeEventListener() {},
    dispatchEvent(ev) {
      (listeners[ev.type] || []).forEach((fn) => fn(Object.assign({
        target: this,
        currentTarget: this,
        preventDefault() {},
      }, ev)));
    },
    setAttribute(name, value) { this.attributes[name] = String(value); },
    getAttribute(name) { return Object.prototype.hasOwnProperty.call(this.attributes, name) ? this.attributes[name] : null; },
    removeAttribute(name) { delete this.attributes[name]; },
    querySelector() { return null; },
    querySelectorAll() { return []; },
    closest() { return null; },
    focus() {},
    blur() {},
    click() {},
    appendChild() {},
  };
}

function boot() {
  const ids = [
    'results', 'search', 'search-form', 'search-submit', 'testament-options', 'book-filter',
    'theme-filter', 'feeling-filter', 'version-filter', 'version-meta-label', 'result-count',
    'results-meta', 'filters-toggle', 'filters-panel', 'filters-badge', 'smart-guide', 'browse-modes',
  ];
  const elements = {};
  ids.forEach((id) => { elements[id] = makeEl(id); });
  const document = {
    hidden: false,
    activeElement: null,
    body: makeEl('body'),
    addEventListener() {},
    getElementById(id) { return elements[id] || null; },
  };
  const sandbox = {
    console,
    URL,
    TextEncoder,
    setTimeout,
    clearTimeout,
    setInterval() { return 0; },
    clearInterval() {},
    requestAnimationFrame(fn) { return fn(); },
    fetch() { return Promise.resolve({ ok: false }); },
    document,
    navigator: { userAgent: 'test' },
  };
  sandbox.window = sandbox;
  sandbox.globalThis = sandbox;
  const context = vm.createContext(sandbox);
  vm.runInContext(fs.readFileSync(path.join(ROOT, 'promises-data.js'), 'utf8'), context);
  vm.runInContext(fs.readFileSync(path.join(ROOT, 'js/daily-verse.js'), 'utf8'), context);
  vm.runInContext(fs.readFileSync(path.join(ROOT, 'js/smart-search.js'), 'utf8'), context);
  vm.runInContext(fs.readFileSync(path.join(ROOT, 'js/relevance.js'), 'utf8'), context);
  vm.runInContext(fs.readFileSync(path.join(ROOT, 'js/discovery-data.js'), 'utf8'), context);
  vm.runInContext(fs.readFileSync(path.join(ROOT, 'js/discovery.js'), 'utf8'), context);
  vm.runInContext(fs.readFileSync(path.join(ROOT, 'js/filter-studies.js'), 'utf8'), context);
  vm.runInContext(fs.readFileSync(path.join(ROOT, 'app.js'), 'utf8'), context);
  return { elements, context };
}

function assertStudy(html, label) {
  assert.match(html, /data-discovery="1"/, label + ' uses the discovery layout');
  assert.match(html, /<h2>/, label + ' heading');
  assert.match(html, /class="discovery-lead"/, label + ' introduction');
  assert.match(html, /Directly relevant/, label + ' direct section');
  assert.match(html, /class="discovery-why"/, label + ' per-verse explanation');
  assert.match(html, /class="discovery-role"/, label + ' classification');
  assert.match(html, /class="search-feedback"/, label + ' feedback');
  assert.doesNotMatch(html, /results--single/, label + ' is not the old swipe deck');
  const query = html.match(/data-query="([^"]*)"/);
  const intent = html.match(/data-intent="([^"]*)"/);
  const category = html.match(/data-category="([^"]*)"/);
  const ids = html.match(/data-results="([^"]*)"/);
  const refs = html.match(/data-refs="([^"]*)"/);
  assert.ok(query && intent && category && ids && refs, label + ' feedback fields');
  const resultIds = ids[1].split(',').filter(Boolean);
  const resultRefs = JSON.parse(refs[1].replace(/&quot;/g, '"'));
  const checked = validateSearchFeedback({
    kind: 'search',
    query: query[1],
    intent: intent[1],
    category: category[1].replace(/&quot;/g, '"'),
    resultIds,
    resultRefs,
    helpful: true,
    comment: null,
    website: '',
  });
  assert.equal(checked.ok, true, label + ' feedback ' + (checked.field || ''));
  return { query: query[1], heading: html.match(/<h2>([^<]*)<\/h2>/)[1] };
}

(async function main() {
  const { elements } = boot();
  await new Promise((resolve) => setTimeout(resolve, 0));
  const results = elements.results;
  const feeling = elements['feeling-filter'];
  const theme = elements['theme-filter'];
  const search = elements.search;
  const book = elements['book-filter'];

  search.value = 'I feel overwhelmed';
  search.dispatchEvent({ type: 'input' });
  await new Promise((resolve) => setTimeout(resolve, 120));
  const overwhelmed = assertStudy(results.innerHTML, 'I feel overwhelmed');
  assert.match(overwhelmed.heading, /Rest for the weary/);
  assert.equal(overwhelmed.query, 'I feel overwhelmed');

  search.value = '';
  feeling.value = 'weary';
  feeling.dispatchEvent({ type: 'change' });
  const exhaustion = assertStudy(results.innerHTML, 'feeling weary');
  assert.equal(exhaustion.query, 'filter:feeling:weary');
  assert.match(exhaustion.heading, /Rest for the weary/);
  assert.match(results.innerHTML, /Matthew 11/);
  assert.match(results.innerHTML, /weariness|weary|rest for the soul/i);

  feeling.value = 'anxious';
  feeling.dispatchEvent({ type: 'change' });
  const anxiety = assertStudy(results.innerHTML, 'feeling anxious');
  assert.equal(anxiety.query, 'filter:feeling:anxious');
  assert.match(anxiety.heading, /Peace instead of anxiety/);
  assert.match(results.innerHTML, /Philippians 4:6/);
  assert.doesNotMatch(results.innerHTML, /Matthew 11:28/);

  feeling.value = '';
  theme.value = 'provision';
  theme.dispatchEvent({ type: 'change' });
  const provision = assertStudy(results.innerHTML, 'theme provision');
  assert.equal(provision.query, 'filter:theme:provision');
  assert.match(provision.heading, /Provision/);
  assert.match(results.innerHTML, /not promise that the need will be solved by becoming wealthy|do not promise/i);

  theme.value = 'hope';
  theme.dispatchEvent({ type: 'change' });
  const hope = assertStudy(results.innerHTML, 'theme hope');
  assert.equal(hope.query, 'filter:theme:hope');
  assert.match(hope.heading, /Hope/);
  assert.match(results.innerHTML, /Related biblical perspectives/);

  theme.value = 'guidance';
  theme.dispatchEvent({ type: 'change' });
  const guidance = assertStudy(results.innerHTML, 'theme guidance');
  assert.equal(guidance.query, 'filter:theme:guidance');
  assert.match(guidance.heading, /Wisdom and decision-making/);
  assert.match(results.innerHTML, /Proverbs 3:5/);

  theme.value = '';
  book.value = 'John';
  book.dispatchEvent({ type: 'change' });
  assert.match(results.innerHTML, /results--single/, 'book browsing keeps the reading deck');
  assert.doesNotMatch(results.innerHTML, /data-discovery="1"/);

  const studies = vm.runInNewContext(
    fs.readFileSync(path.join(ROOT, 'js/filter-studies.js'), 'utf8') + '\nGodsPromisesFilterStudies',
    { console, URL, TextEncoder }
  );
  const intros = []
    .concat(Object.values(studies.FEELINGS), Object.values(studies.THEMES))
    .map((item) => item.intro);
  assert.equal(new Set(intros).size, intros.length, 'each filter introduction is distinct');
  intros.forEach((intro) => assert.ok(intro.length > 80, intro.slice(0, 40)));

  const app = fs.readFileSync(path.join(ROOT, 'app.js'), 'utf8');
  assert.match(app, /GodsPromisesFilterStudies/);
  assert.match(app, /studyResult/);
  assert.match(app, /renderDiscovery\(window\.GodsPromisesDiscovery\.studyResult/);
  console.log('filter-presentation: search and filters share renderDiscovery; feedback payloads validate');
})().catch((err) => {
  console.error(err);
  process.exit(1);
});
