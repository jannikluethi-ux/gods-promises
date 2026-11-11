/* Conversational phrases: same need stays close, different needs stay apart. */
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
const discovery = context.GodsPromisesDiscovery;

function rows(result) {
  return (result.direct || []).concat(result.related || []);
}
function ids(query, n) {
  return rows(discovery.discover(query, data.promises)).slice(0, n).map((row) => row.id);
}
function jaccard(a, b) {
  const A = new Set(a);
  const B = new Set(b);
  let inter = 0;
  A.forEach((id) => { if (B.has(id)) inter += 1; });
  const union = A.size + B.size - inter;
  return union ? inter / union : 1;
}
function has(result, book, chapter, verse) {
  return rows(result).some((row) => row.book === book && row.chapter === chapter && row.verseStart <= verse && row.verseEnd >= verse);
}

const groups = {
  rest: ['Overwhelmed', 'overwhelmed', 'Mentally exhausted', 'mentally exhausted', "i'm mentally exhausted", 'Emotionally drained', 'emotionally drained', 'i feel emotionally drained'],
  shoulders: ['I have too much on my shoulders', 'too much on my shoulders', 'theres too much on my shoulders'],
  work: ['I am overwhelmed by work', 'overwhelmed by work', 'overwhelmed at my job'],
  life: ['Feeling overwhelmed by life', 'feeling overwhelmed by life', 'overwhelmed by life', 'I am overwhelmed by everything'],
  fear: ['Overwhelmed by fear', 'overwhelmed by fear', "i'm overwhelmed with fear", 'overwhelmed by anxiety'],
  cope: ['I cannot cope anymore', "i can't cope anymore", 'i cant cope'],
  giving: ['I feel like giving up', 'i feel like giving up', 'i want to give up'],
  both: ['I am exhausted and need strength', 'exhausted and need strength', "i'm exhausted and need strength"],
  peace: ['I cannot find peace', "i can't find peace", 'i cannot find peace'],
  lost: ['I feel lost and need guidance', 'i feel lost', 'im lost', "i'm lost"],
  future: ['I am afraid of the future', "i'm afraid of the future", 'i am afraid of what comes next'],
};

(function main() {
  let checks = 0;
  function check(cond, message) {
    assert.ok(cond, message);
    checks += 1;
  }

  groups.rest.concat(groups.shoulders, groups.work).forEach((query) => {
    const result = discovery.discover(query, data.promises);
    check(result.mode === 'results', query);
    check(result.conceptId === 'composure' && result.intentionId === 'rest', query + ' ' + result.intentionId);
    check(result.heading === 'Rest for the weary', query + ' ' + result.heading);
    check(result.direct[0].reference.indexOf('Matthew 11') === 0, query);
  });

  groups.life.forEach((query) => {
    const result = discovery.discover(query, data.promises);
    check(result.heading === 'Rest for the weary', query);
    check(result.direct[0].reference.indexOf('Matthew 11') === 0, query);
    check(has(result, 'Psalms', 34, 18) || has(result, 'Romans', 8, 28), query + ' should also include a hard-season passage');
  });

  groups.fear.forEach((query) => {
    const result = discovery.discover(query, data.promises);
    check(result.conceptId === 'fear', query);
    check(result.intentionId === 'anxiety', query + ' ' + result.intentionId);
    check(result.direct[0].reference.indexOf('Philippians 4:6') === 0, query);
    check(has(result, '1 Peter', 5, 7), query);
    check(result.direct[0].reference.indexOf('Matthew 11') !== 0, query);
  });

  groups.cope.concat(groups.giving).forEach((query) => {
    const result = discovery.discover(query, data.promises);
    check(result.heading === 'Strength to continue', query + ' ' + result.heading);
    check(has(result, 'Isaiah', 40, 31), query);
    check(has(result, 'Galatians', 6, 9), query);
  });

  groups.both.forEach((query) => {
    const result = discovery.discover(query, data.promises);
    check(result.heading === 'Rest for the weary', query);
    check(result.direct[0].reference.indexOf('Matthew 11') === 0, query);
    check(has(result, 'Isaiah', 40, 31) && has(result, 'Galatians', 6, 9), query);
  });

  groups.peace.forEach((query) => {
    const result = discovery.discover(query, data.promises);
    check(result.heading === 'Peace of mind', query);
    check(has(result, 'John', 14, 27) && has(result, 'Isaiah', 26, 3), query);
  });

  groups.lost.forEach((query) => {
    const result = discovery.discover(query, data.promises);
    check(result.conceptId === 'guidance' && result.intentionId === 'decision', query + ' ' + result.conceptId);
    check(has(result, 'Proverbs', 3, 5), query);
  });

  groups.future.forEach((query) => {
    const result = discovery.discover(query, data.promises);
    check(result.conceptId === 'fear' && result.intentionId === 'future', query + ' ' + result.intentionId);
    check(result.heading.indexOf('Trust') === 0, query + ' ' + result.heading);
  });

  function near(a, b, min) {
    const score = jaccard(ids(a, 3), ids(b, 3));
    check(score >= min, a + ' vs ' + b + ' top3 ' + score.toFixed(2));
  }
  function apart(a, b, max) {
    const score = jaccard(ids(a, 3), ids(b, 3));
    check(score <= max, a + ' vs ' + b + ' top3 ' + score.toFixed(2));
  }

  near('Overwhelmed', 'mentally exhausted', 0.6);
  near('Mentally exhausted', 'emotionally drained', 0.6);
  near('I have too much on my shoulders', 'I am overwhelmed by work', 0.6);
  near('Feeling overwhelmed by life', 'Overwhelmed', 0.6);
  near('Overwhelmed by fear', "i'm overwhelmed with fear", 0.6);
  near('I cannot cope anymore', 'i feel like giving up', 0.6);
  near('I am exhausted and need strength', 'I feel exhausted', 0.6);
  near('I cannot find peace', "i can't find peace", 1);
  near('i feel lost', 'I feel lost and need guidance', 0.6);
  near('I am afraid of the future', 'i am afraid of what comes next', 0.6);

  apart('I am overwhelmed by work', 'Overwhelmed by fear', 0.34);
  apart('I feel exhausted', 'I feel anxious', 0.34);
  apart('I feel exhausted', 'I need peace in my mind', 0.34);
  apart('I need peace in my mind', 'I need strength to continue', 0.34);
  apart('I feel like giving up', 'i feel lost', 0.34);
  apart('Overwhelmed by fear', 'I feel exhausted', 0.34);

  const strengthBlend = jaccard(ids('I am exhausted and need strength', 3), ids('I need strength to continue', 3));
  check(strengthBlend >= 0.4, 'exhausted-and-strength vs strength top3 ' + strengthBlend.toFixed(2));

  const someone = discovery.discover('I lost someone', data.promises);
  check(someone.conceptId === 'grief', 'lost someone');
  const money = discovery.discover('I lost my money', data.promises);
  check(money.conceptId === 'wealth' && money.intentionId === 'worry', 'lost my money');
  const bills = discovery.discover('overwhelmed by bills', data.promises);
  check(bills.conceptId === 'wealth' && bills.intentionId === 'worry', 'overwhelmed by bills');
  const scared = discovery.discover('I am stressed and afraid', data.promises);
  check(scared.conceptId === 'fear', 'stressed and afraid');
  const stressed = discovery.discover('I am stressed', data.promises);
  check(stressed.heading === 'Rest for the weary', 'stressed');
  const unknown = discovery.discover('unknownzzword', data.promises);
  check(unknown.mode === 'fallback', 'fallback');

  console.log('discovery-meanings: ' + checks + ' checks passed');
})();
