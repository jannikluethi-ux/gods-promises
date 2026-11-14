/* Passage ids do not change with the translation. KJV phrases map, and different needs stay apart. */
'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const ROOT = path.resolve(__dirname, '..');
const text = fs.readFileSync(path.join(ROOT, 'promises-data.js'), 'utf8');
const data = JSON.parse(text.match(/window\.GODS_PROMISES_DATA\s*=\s*([\s\S]*);\s*$/)[1]);
const context = vm.createContext({ console, URL, TextEncoder });
vm.runInContext(fs.readFileSync(path.join(ROOT, 'js/discovery-data.js'), 'utf8'), context);
vm.runInContext(fs.readFileSync(path.join(ROOT, 'js/discovery.js'), 'utf8'), context);
vm.runInContext(fs.readFileSync(path.join(ROOT, 'js/filter-studies.js'), 'utf8'), context);
const discovery = context.GodsPromisesDiscovery;
const studies = context.GodsPromisesFilterStudies;

function rows(result) {
  return (result.direct || []).concat(result.related || []).map((row) => row.id);
}
function jaccard(a, b) {
  const A = new Set(a);
  const B = new Set(b);
  let inter = 0;
  A.forEach((id) => { if (B.has(id)) inter += 1; });
  const union = A.size + B.size - inter;
  return union ? inter / union : 1;
}

const kjvPromises = data.promises.map((promise) => Object.assign({}, promise, {
  text: 'placeholder ' + promise.id,
}));

(function main() {
  const feelings = Object.keys(studies.FEELINGS);
  const themes = Object.keys(studies.THEMES);
  assert.equal(feelings.length, 16);
  assert.equal(themes.length, 75);
  let compared = 0;
  function same(kind, key) {
    const study = studies.forFilters(kind === 'feeling' ? key : '', kind === 'theme' ? key : '');
    const web = discovery.studyResult(study, data.promises);
    const kjv = discovery.studyResult(study, kjvPromises);
    assert.deepEqual(rows(kjv), rows(web), kind + ' ' + key);
    assert.ok(rows(web).length > 0, key);
    compared += 1;
  }
  feelings.forEach((key) => same('feeling', key));
  themes.forEach((key) => same('theme', key));

  const queries = [
    'I feel exhausted',
    'I feel anxious',
    'I wish I was rich',
    'I need peace in my mind',
    'fret not thyself',
  ];
  queries.forEach((query) => {
    const web = discovery.discover(query, data.promises);
    const kjv = discovery.discover(query, kjvPromises);
    assert.deepEqual(rows(kjv), rows(web), query);
    assert.equal(kjv.heading, web.heading, query);
  });

  const phrases = {
    'fret not thyself': 'composure/patience',
    'fear thou not': 'fear/anxiety',
    'be of good cheer': 'hardship/hard',
    'be of good courage': 'fear/future',
    'wait upon the LORD': 'composure/strength',
    'cast thy burden': 'fear/anxiety',
    'thou art with me': 'loneliness/alone',
    'lo I am with you': 'loneliness/alone',
    'mine heart is overwhelmed': 'composure/rest',
    'my soul is cast down': 'grief/grief',
    'take no thought for the morrow': 'fear/future',
  };
  Object.keys(phrases).forEach((query) => {
    const result = discovery.discover(query, data.promises);
    assert.equal(result.mode, 'results', query);
    assert.equal(result.conceptId + '/' + result.intentionId, phrases[query], query + ' ' + result.heading);
    assert.ok(result.direct.length >= 1, query);
  });

  function ids(query) {
    return rows(discovery.discover(query, data.promises)).slice(0, 5);
  }
  function apart(a, b) {
    const score = jaccard(ids(a), ids(b));
    assert.ok(score < 0.5, a + ' vs ' + b + ' ' + score.toFixed(2));
  }
  apart('fret not thyself', 'fear thou not');
  apart('be of good cheer', 'be of good courage');
  apart('wait upon the LORD', 'take no thought for the morrow');
  apart('my soul is cast down', 'mine heart is overwhelmed');
  apart('thou art with me', 'fear thou not');
  apart('I feel exhausted', 'I feel anxious');

  console.log('kjv-parity: ' + compared + ' feeling/theme studies and ' + queries.length + ' searches keep the same ids in WEB and KJV');
})();
