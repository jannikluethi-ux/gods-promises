/* Discovery engine: meaning, context labels, thresholds, and precision against a judgment set. */
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
const web = JSON.parse(fs.readFileSync(path.join(ROOT, 'scripts/web_index.json'), 'utf8'));
const baseline = JSON.parse(fs.readFileSync(path.join(__dirname, 'discovery-baseline.json'), 'utf8'));

function rows(result) {
  return (result.direct || []).concat(result.related || []);
}
function covers(row, book, chapter, verse) {
  return row.book === book && row.chapter === chapter && row.verseStart <= verse && row.verseEnd >= verse;
}
function has(result, book, chapter, verse) {
  return rows(result).some((row) => covers(row, book, chapter, verse));
}
function relevant(row, marks) {
  return marks.some((mark) => covers(row, mark[0], mark[1], mark[2]));
}
function precision(result, marks, k) {
  const top = rows(result).slice(0, k);
  if (!top.length) return 0;
  let hit = 0;
  for (let i = 0; i < k; i++) if (top[i] && relevant(top[i], marks)) hit += 1;
  return hit / k;
}
function ids(result, n) {
  return rows(result).slice(0, n).map((row) => row.id);
}
function jaccard(a, b) {
  const A = new Set(a);
  const B = new Set(b);
  let inter = 0;
  A.forEach((id) => { if (B.has(id)) inter += 1; });
  return inter / (A.size + B.size - inter);
}

const FINANCE = [
  ['Deuteronomy', 8, 18], ['Proverbs', 10, 22], ['1 Chronicles', 29, 12],
  ['Ecclesiastes', 5, 19], ['Matthew', 6, 33], ['Deuteronomy', 28, 12],
  ['2 Chronicles', 1, 12], ['Proverbs', 22, 7], ['2 Corinthians', 8, 9],
  ['Proverbs', 14, 23], ['Philippians', 4, 19], ['1 Timothy', 6, 10],
  ['Luke', 12, 15], ['1 Timothy', 6, 6],
];
const FRUIT = [
  ['James', 1, 19], ['Psalms', 37, 7], ['Isaiah', 41, 10],
  ['Matthew', 11, 28], ['Philippians', 4, 6], ['1 Peter', 5, 7],
  ['Proverbs', 15, 1], ['Ephesians', 4, 26], ['Galatians', 5, 22],
  ['Isaiah', 40, 31], ['John', 14, 27], ['2 Corinthians', 4, 16], ['Galatians', 6, 9],
];
const HANDLE = [
  ['1 Timothy', 6, 17], ['Matthew', 6, 19], ['Proverbs', 11, 24], ['Proverbs', 14, 23],
  ['2 Corinthians', 9, 8], ['Proverbs', 22, 7], ['1 Timothy', 6, 6], ['Deuteronomy', 8, 18],
  ['Proverbs', 13, 11], ['Colossians', 3, 23],
];
const CONTENT = [
  ['1 Timothy', 6, 6], ['Philippians', 4, 11], ['Hebrews', 13, 5], ['Ecclesiastes', 5, 19],
  ['1 Timothy', 6, 17],
];
const ETHICS = [
  ['1 Timothy', 6, 9], ['1 Timothy', 6, 6], ['Luke', 12, 15], ['1 Timothy', 6, 17],
  ['Proverbs', 23, 4], ['Ecclesiastes', 5, 10], ['Matthew', 6, 19], ['2 Corinthians', 8, 9],
];
const WORRY = [
  ['Philippians', 4, 11], ['Hebrews', 13, 5], ['Matthew', 6, 33], ['Philippians', 4, 19],
  ['Proverbs', 22, 7], ['Deuteronomy', 8, 18], ['Deuteronomy', 28, 12],
];
const WORK = FINANCE.concat([['Colossians', 3, 23], ['Proverbs', 16, 3], ['Proverbs', 21, 5]]);
const REST = [['Matthew', 11, 28], ['Isaiah', 40, 31], ['2 Corinthians', 4, 16], ['John', 14, 27], ['Isaiah', 26, 3]];
const MIND = [['John', 14, 27], ['Isaiah', 26, 3], ['Philippians', 4, 6], ['Matthew', 11, 28], ['Isaiah', 40, 31]];
const STRENGTH = [['Isaiah', 40, 31], ['Galatians', 6, 9], ['2 Corinthians', 4, 16], ['Philippians', 4, 13], ['Matthew', 11, 28]];
const PEACE = FRUIT.concat([['Isaiah', 26, 3], ['Isaiah', 40, 31], ['John', 14, 27]]);
const JUDGED = {
  'I wish I was rich': FINANCE,
  'How can I become wealthy?': FINANCE,
  'God gives the power to get wealth': FINANCE,
  'I need financial blessings': FINANCE,
  'I am struggling with money': WORRY,
  'How does God want us to handle money?': HANDLE,
  'Is it wrong to want to be rich?': ETHICS,
  'I want to become financially independent': FINANCE,
  'I want God to bless my work': WORK,
  'How can I be content with what I have?': CONTENT,
  'I want to become wealthy': FINANCE,
  'How can God bless me financially?': FINANCE,
  'I am worried about losing my money': WORRY,
  'I feel frustrated': FRUIT,
  'I am overwhelmed': REST,
  'I am losing my patience': FRUIT,
  'I get angry too easily': FRUIT.concat([['Ephesians', 4, 32]]),
  'I need to calm down': MIND,
  'I am tired of waiting': FRUIT,
  'I cannot control my emotions': FRUIT.concat([['Ephesians', 4, 32]]),
  'I need peace in my mind': MIND,
  'I feel exhausted': REST,
  'I need strength to keep going': STRENGTH,
};

const financeQueries = [
  'I wish I was rich', 'How can I become wealthy?', 'God gives the power to get wealth',
  'I need financial blessings', 'I am struggling with money', 'How does God want us to handle money?',
  'Is it wrong to want to be rich?', 'I want to become financially independent',
  'I want God to bless my work', 'How can I be content with what I have?',
];
const frustrationQueries = [
  'I feel frustrated', 'I am overwhelmed', 'I am losing my patience', 'I get angry too easily',
  'I need to calm down', 'I am tired of waiting', 'I cannot control my emotions',
  'I need peace in my mind', 'I feel exhausted', 'I need strength to keep going',
];

(function main() {
  // Supplements are verbatim WEB, joined with a single space across the verse span.
  const supplements = context.GodsPromisesDiscoveryData.SUPPLEMENTS;
  Object.keys(supplements).forEach((key) => {
    const item = supplements[key];
    const parts = [];
    for (let v = item.verseStart; v <= item.verseEnd; v++) {
      const bookKey = item.book === 'Psalm' ? 'Psalms' : item.book;
      const verse = web[bookKey + '|' + item.chapter + '|' + v];
      assert.equal(typeof verse, 'string', item.id + ' missing WEB ' + v);
      parts.push(verse);
    }
    assert.equal(item.text, parts.join(' '), item.id);
  });

  const rich = discovery.discover('I wish I was rich', data.promises);
  assert.equal(rich.mode, 'results');
  assert.equal(rich.heading, 'Financial prosperity and stewardship');
  assert.ok(!/hard moment/i.test(rich.heading));
  assert.ok(has(rich, 'Deuteronomy', 8, 18));
  assert.ok(has(rich, 'Proverbs', 10, 22));
  assert.ok(has(rich, '2 Corinthians', 8, 9));
  const cor = rows(rich).find((row) => row.book === '2 Corinthians' && row.chapter === 8);
  assert.equal(cor.role, 'related');
  assert.ok(/not a promise of financial wealth/i.test(cor.why));
  assert.ok(rich.direct.indexOf(cor) === -1, '2 Corinthians 8:9 must not be grouped as directly a wealth promise');
  const deut28 = rows(rich).find((row) => row.book === 'Deuteronomy' && row.chapter === 28);
  assert.ok(deut28 && /covenant/i.test(deut28.why));
  assert.ok(rich.direct[0].book === 'Deuteronomy' && rich.direct[0].chapter === 8);
  rich.direct.concat(rich.related).forEach((row) => {
    assert.ok(row.why && row.why.length > 40, row.reference);
    assert.ok(row.roleLabel, row.reference);
  });

  financeQueries.forEach((query) => {
    const result = discovery.discover(query, data.promises);
    assert.equal(result.mode, 'results', query);
    assert.equal(result.conceptId, 'wealth', query);
    assert.ok(has(result, 'Deuteronomy', 8, 18), query + ' should find Deuteronomy 8:18');
    assert.notEqual(result.heading, 'For a hard moment', query);
  });

  ['I feel frustrated', 'I get angry too easily', 'I am losing my patience', 'I am tired of waiting', 'I cannot control my emotions'].forEach((query) => {
    const result = discovery.discover(query, data.promises);
    assert.equal(result.mode, 'results', query);
    assert.equal(result.conceptId, 'composure', query);
    assert.ok(has(result, 'James', 1, 19) || has(result, 'Psalms', 37, 7), query);
  });
  const exhausted = discovery.discover('I feel exhausted', data.promises);
  assert.equal(exhausted.heading, 'Rest for the weary');
  assert.equal(exhausted.direct[0].reference.indexOf('Matthew 11') === 0, true);
  assert.ok(has(exhausted, 'Isaiah', 40, 31));
  const peaceMind = discovery.discover('I need peace in my mind', data.promises);
  assert.equal(peaceMind.heading, 'Peace of mind');
  assert.ok(has(peaceMind, 'John', 14, 27));
  assert.ok(has(peaceMind, 'Isaiah', 26, 3));
  const keepGoing = discovery.discover('I need strength to continue', data.promises);
  assert.equal(keepGoing.heading, 'Strength to continue');
  assert.ok(has(keepGoing, 'Isaiah', 40, 31));
  assert.ok(has(keepGoing, 'Galatians', 6, 9));
  assert.ok(has(keepGoing, '2 Corinthians', 4, 16));
  assert.ok(has(keepGoing, 'Philippians', 4, 13));
  const anxious = discovery.discover('I feel anxious', data.promises);
  assert.equal(anxious.direct[0].reference.indexOf('Philippians 4:6') === 0, true);
  assert.ok(has(anxious, '1 Peter', 5, 7));
  assert.ok(jaccard(ids(exhausted, 5), ids(anxious, 5)) < 0.34);
  assert.ok(jaccard(ids(peaceMind, 5), ids(keepGoing, 5)) < 0.34);
  assert.ok(jaccard(ids(exhausted, 5), ids(discovery.discover('I am weary', data.promises), 5)) >= 0.8);

  const topics = {
    'I am afraid of the future': ['fear', 'Trust'],
    'I feel anxious': ['fear', 'Peace'],
    'I want a stronger marriage': ['marriage', 'Marriage'],
    'I am impatient with my children': ['parenting', 'children'],
    "I can't forgive them": ['forgiveness', 'Forgiveness'],
    'I feel alone': ['loneliness', 'alone'],
    'I am grieving': ['grief', 'grief'],
    'I keep giving in to temptation': ['temptation', 'temptation'],
    'I want to be free from addiction': ['addiction', 'enslave'],
    'What is my purpose?': ['purpose', 'Purpose'],
    'I am struggling to have faith': ['faith', 'Faith'],
    'I have doubts': ['doubt', 'Doubt'],
    'I am grateful': ['gratitude', 'Thanksgiving'],
    'I am sick': ['health', 'illness'],
    'I am going through a hard time': ['hardship', 'hard'],
    'I need guidance for a decision': ['guidance', 'decision'],
  };
  Object.keys(topics).forEach((query) => {
    const result = discovery.discover(query, data.promises);
    assert.equal(result.mode, 'results', query);
    assert.equal(result.conceptId, topics[query][0], query);
    assert.ok(result.direct.length >= 1, query);
    assert.ok(result.heading.toLowerCase().includes(topics[query][1].toLowerCase()) || result.intro.toLowerCase().includes(topics[query][1].toLowerCase()), query + ' ' + result.heading);
  });

  const same = ['I wish I was rich', 'I want to become wealthy', 'How can God bless me financially?'];
  const sets = same.map((query) => ids(discovery.discover(query, data.promises), 10));
  assert.ok(jaccard(sets[0], sets[1]) >= 0.6);
  assert.ok(jaccard(sets[0], sets[2]) >= 0.6);
  const worry = discovery.discover('I am worried about losing my money', data.promises);
  assert.notEqual(worry.direct[0].id, rich.direct[0].id);
  assert.ok(jaccard(ids(rich, 5), ids(worry, 5)) < 0.8);
  assert.equal(worry.heading, 'Provision when money is tight');

  const ambiguous = discovery.discover('marriage and money', data.promises);
  assert.equal(ambiguous.heading, 'Passages that may speak to this');
  assert.equal(ambiguous.ambiguous, true);

  const unknown = discovery.discover('unknownzzword', data.promises);
  assert.equal(unknown.mode, 'fallback');
  assert.equal(unknown.direct.length, 0);
  assert.match(unknown.heading, /wasn’t clear|wasn't clear/);
  const representative = [
    'I wish I was rich', 'I want to become wealthy', 'How can I become wealthy?', 'I need financial blessings',
    'God gives the power to get wealth', 'I want to become financially independent', 'How can God bless me financially?',
    'I am worried about losing my money', 'I am struggling with money', 'I cannot pay my bills',
    'Is it wrong to desire wealth?', 'Is it wrong to want to be rich?', 'How should Christians manage money?',
    'How does God want us to handle money?', 'How can I be content with what I have?', 'I want God to bless my work',
    'I want a stronger marriage', 'my marriage is hard', 'I want to love my wife well',
    'I am impatient with my children', 'how do I raise my children', 'my kids are wearing me out',
    'I feel anxious', 'I am afraid of the future', 'I am scared', 'I keep worrying',
    'I am grieving', 'I am mourning a death', 'I lost someone',
    "I can't forgive them", 'I cannot forgive him', 'help me forgive',
    'I feel frustrated', 'I get angry too easily', 'I am losing my patience', 'I am tired of waiting',
    'I feel exhausted', 'I am weary', 'I am overwhelmed', 'I am worn out',
    'I need peace in my mind', 'I need to calm down', 'I need a calm mind',
    'I need strength to continue', 'I need strength to keep going', 'help me persevere',
    'I cannot control my emotions',
    'I want to grow in faith', 'I am struggling to have faith', 'I have doubts', 'help my unbelief',
    'I need guidance for a decision', 'I do not know what to do', 'I need wisdom for a choice',
    'What is my purpose?', 'I feel alone', 'I am grateful', 'I am sick',
    'I am going through a hard time', 'I keep giving in to temptation', 'I want to be free from addiction',
  ];
  assert.ok(representative.length >= 50);
  const intentReport = [];
  representative.forEach((query) => {
    const result = discovery.discover(query, data.promises);
    assert.equal(result.mode, 'results', query);
    assert.ok(result.heading && result.heading !== 'For a hard moment', query);
    assert.ok(result.direct.length >= 1, query);
    intentReport.push({
      query,
      heading: result.heading,
      intent: result.conceptId + '/' + result.intentionId,
      top: rows(result).slice(0, 5).map((row) => row.roleLabel + ' · ' + row.reference),
    });
  });
  fs.writeFileSync('/tmp/intent-report.json', JSON.stringify(intentReport, null, 2));

  let after5 = 0;
  let after10 = 0;
  let before5 = 0;
  let n = 0;
  const report = {};
  Object.keys(JUDGED).forEach((query) => {
    const result = discovery.discover(query, data.promises);
    const p5 = precision(result, JUDGED[query], 5);
    const p10 = precision(result, JUDGED[query], 10);
    after5 += p5;
    after10 += p10;
    const beforeTop = (baseline.queries[query] && baseline.queries[query].top) || [];
    const beforeHits = beforeTop.slice(0, 5).filter((ref) => JUDGED[query].some((mark) => ref.indexOf(mark[0]) === 0 && ref.indexOf(String(mark[1])) !== -1)).length;
    before5 += beforeHits / 5;
    n += 1;
    report[query] = {
      before: beforeTop,
      after: rows(result).slice(0, 5).map((row) => row.role + ' · ' + row.reference),
      precisionAt5: p5,
      precisionAt10: p10,
    };
  });
  const meanAfter5 = after5 / n;
  const meanAfter10 = after10 / n;
  const meanBefore5 = before5 / n;
  assert.ok(meanAfter5 >= 0.8, 'precision@5 ' + meanAfter5);
  assert.ok(meanAfter10 >= 0.7, 'precision@10 ' + meanAfter10);
  assert.ok(meanAfter5 > meanBefore5, 'after should beat the recorded keyword baseline');
  assert.equal(baseline.queries['I wish I was rich'].top.length, 0);
  fs.writeFileSync('/tmp/discovery-report.json', JSON.stringify({
    meanPrecisionAt5: Number(meanAfter5.toFixed(3)),
    meanPrecisionAt10: Number(meanAfter10.toFixed(3)),
    meanBaselinePrecisionAt5: Number(meanBefore5.toFixed(3)),
    report,
  }, null, 2));
  console.log('discovery: precision@5 ' + meanAfter5.toFixed(3) + ' (baseline ' + meanBefore5.toFixed(3) + '), precision@10 ' + meanAfter10.toFixed(3));
})();
