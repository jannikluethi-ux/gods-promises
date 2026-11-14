/* Registry and translation-independent book codes. No network. */
'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const ROOT = path.resolve(__dirname, '..');
const plain = value => JSON.parse(JSON.stringify(value));

function load(context, relative) {
  vm.runInContext(fs.readFileSync(path.join(ROOT, relative), 'utf8'), context, { filename: relative });
}
function catalog() {
  const text = fs.readFileSync(path.join(ROOT, 'promises-data.js'), 'utf8');
  const match = text.match(/window\.GODS_PROMISES_DATA\s*=\s*([\s\S]*);\s*$/);
  assert.ok(match, 'Expected literal catalog assignment');
  return JSON.parse(match[1]);
}
function boot() {
  const context = vm.createContext({ console });
  load(context, 'js/scripture-books.js');
  load(context, 'js/scripture-ref.js');
  load(context, 'js/translation-registry.js');
  return context;
}

const OT_NAMES = [
  'Genesis', 'Exodus', 'Leviticus', 'Numbers', 'Deuteronomy', 'Joshua', 'Judges', 'Ruth',
  '1 Samuel', '2 Samuel', '1 Kings', '2 Kings', '1 Chronicles', '2 Chronicles', 'Ezra',
  'Nehemiah', 'Esther', 'Job', 'Psalms', 'Proverbs', 'Ecclesiastes', 'Song of Solomon',
  'Isaiah', 'Jeremiah', 'Lamentations', 'Ezekiel', 'Daniel', 'Hosea', 'Joel', 'Amos',
  'Obadiah', 'Jonah', 'Micah', 'Nahum', 'Habakkuk', 'Zephaniah', 'Haggai', 'Zechariah',
  'Malachi',
];

(function () {
  const context = boot();
  const books = context.GodsPromisesScriptureBooks;
  const refs = context.GodsPromisesScriptureRef;
  const registry = context.GodsPromisesTranslations;
  const data = catalog();

  const all = books.all();
  assert.equal(all.length, 66);
  const names = new Set();
  const prefixes = new Set();
  const osis = new Set();
  const usfm = new Set();
  all.forEach((book, index) => {
    assert.equal(book.order, index + 1);
    assert.equal(Object.isFrozen(book), true);
    assert.match(book.idPrefix, /^(?:[1-3])?[a-z]{2,3}$/);
    assert.match(book.usfm, /^(?:[1-3])?[A-Z]{2,3}$/);
    assert.equal(book.idPrefix, book.usfm.toLowerCase());
    assert.ok(book.osis);
    assert.ok(book.testament === 'OT' || book.testament === 'NT');
    names.add(book.name);
    prefixes.add(book.idPrefix);
    osis.add(book.osis);
    usfm.add(book.usfm);
    assert.equal(books.byName(book.name), book);
    assert.equal(books.byPrefix(book.idPrefix), book);
    assert.equal(books.byOsis(book.osis), book);
    assert.equal(books.byUsfm(book.usfm), book);
    assert.equal(books.isOldTestament(book.name), book.testament === 'OT');
  });
  assert.equal(names.size, 66);
  assert.equal(prefixes.size, 66);
  assert.equal(osis.size, 66);
  assert.equal(usfm.size, 66);
  assert.deepEqual(plain(all.filter(book => book.testament === 'OT').map(book => book.name)), OT_NAMES);
  assert.equal(books.byName('missing'), null);
  assert.equal(books.isOldTestament('John'), false);
  assert.equal(books.isOldTestament(''), false);

  const philippians = refs.parsePassageId('php-4-6-7');
  assert.deepEqual(plain(philippians), {
    id: 'php-4-6-7',
    passageId: 'php-4-6-7',
    book: 'Philippians',
    osis: 'Phil',
    usfm: 'PHP',
    idPrefix: 'php',
    testament: 'NT',
    chapter: 4,
    verseStart: 6,
    verseEnd: 7,
  });
  assert.equal(Object.isFrozen(philippians), true);

  const single = refs.parsePassageId('gen-1-28');
  assert.equal(single.passageId, 'gen-1-28');
  assert.equal(single.osis, 'Gen');
  assert.equal(single.usfm, 'GEN');
  assert.equal(single.verseEnd, 28);
  assert.equal(refs.parsePassageId('disc-deu-8-18'), null);
  assert.equal(refs.parsePassageId('php-4-7-6'), null);
  assert.equal(refs.parsePassageId('not-a-passage'), null);
  assert.equal(refs.parsePassageId(''), null);
  assert.equal(refs.fromPassage(null), null);
  assert.equal(refs.fromPassage({ book: 'No Such Book', chapter: 1, verseStart: 1 }), null);

  const seenBooks = new Set();
  for (const passage of data.promises) {
    const parsed = refs.parsePassageId(passage.id);
    const before = JSON.stringify(passage);
    const derived = refs.fromPassage(passage);
    assert.equal(JSON.stringify(passage), before, passage.id);
    assert.ok(parsed, passage.id);
    assert.equal(parsed.book, passage.book, passage.id);
    assert.equal(parsed.chapter, passage.chapter, passage.id);
    assert.equal(parsed.verseStart, passage.verseStart, passage.id);
    assert.equal(parsed.verseEnd, passage.verseEnd, passage.id);
    assert.equal(parsed.id, passage.id, passage.id);
    assert.equal(parsed.passageId, passage.id, passage.id);
    assert.deepEqual(plain(derived), plain(parsed), passage.id);
    seenBooks.add(passage.book);
  }
  assert.equal(data.promises.length, 1188);
  assert.ok(seenBooks.size >= 60);

  const supplement = refs.fromPassage({
    id: 'disc-deu-8-18',
    book: 'Deuteronomy',
    chapter: 8,
    verseStart: 17,
    verseEnd: 18,
  });
  assert.equal(supplement.id, 'deu-8-17-18');
  assert.equal(supplement.passageId, 'deu-8-17-18');
  assert.equal(supplement.osis, 'Deut');
  assert.equal(supplement.usfm, 'DEU');

  assert.equal(registry.DEFAULT_ID, 'web');
  assert.deepEqual(plain(registry.enabled().map(entry => entry.id)), ['web', 'asv', 'ylt', 'darby', 'dra']);
  assert.deepEqual(plain(registry.list().map(entry => entry.id)), ['web', 'asv', 'ylt', 'darby', 'dra']);
  assert.deepEqual(plain(registry.legacyVersionList()), [
    { id: 'web', label: 'World English Bible (WEB)', short: 'WEB', api: null, ntOnly: false },
    { id: 'asv', label: 'American Standard Version (ASV)', short: 'ASV', api: 'asv', ntOnly: false },
    { id: 'ylt', label: "Young's Literal Translation (YLT)", short: 'YLT', api: 'ylt', ntOnly: true },
    { id: 'darby', label: 'Darby Translation (DBY)', short: 'DBY', api: 'darby', ntOnly: false },
    { id: 'dra', label: 'Douay-Rheims (DRA)', short: 'DRA', api: 'dra', ntOnly: false },
  ]);

  const required = [
    'id', 'displayName', 'short', 'source', 'provider', 'apiTranslation',
    'licenceNotice', 'territoryPolicy', 'offlineAllowed', 'enabled', 'ntOnly',
  ];
  for (const entry of registry.list()) {
    assert.deepEqual(plain(Object.keys(entry).sort()), required.slice().sort(), entry.id);
    assert.equal(Object.isFrozen(entry), true, entry.id);
    assert.equal(entry.enabled, true, entry.id);
    assert.deepEqual(plain(entry.territoryPolicy), { status: 'unspecified' });
    assert.deepEqual(plain(Object.keys(entry.territoryPolicy)), ['status']);
    assert.equal(typeof entry.licenceNotice, 'string');
    assert.ok(entry.licenceNotice.length > 0);
    assert.equal(/https?:\/\//.test(entry.licenceNotice), false, entry.id);
    assert.equal(registry.isEnabled(entry.id), true);
    assert.equal(registry.resolvePreference(entry.id), entry.id);
    assert.equal(registry.get(entry.id), entry);
  }
  const web = registry.get('web');
  assert.equal(web.provider, 'catalog');
  assert.equal(web.source, 'catalog');
  assert.equal(web.apiTranslation, null);
  assert.equal(web.offlineAllowed, true);
  for (const id of ['asv', 'ylt', 'darby', 'dra']) {
    const entry = registry.get(id);
    assert.equal(entry.provider, 'bible-api');
    assert.equal(entry.source, 'bible-api.com');
    assert.equal(entry.apiTranslation, id);
    assert.equal(entry.offlineAllowed, false);
  }
  assert.equal(registry.get('ylt').ntOnly, true);
  assert.equal(registry.isEnabled('WEB'), false);
  assert.equal(registry.isEnabled(''), false);
  assert.equal(registry.isEnabled(null), false);
  assert.equal(registry.get('missing'), null);
  assert.equal(registry.resolvePreference('missing'), 'web');
  assert.equal(registry.resolvePreference(''), 'web');
  assert.equal(registry.resolvePreference(null), 'web');
  assert.deepEqual(
    plain(registry.selectEnabled([
      { id: 'web', enabled: true },
      { id: 'sample', enabled: false },
      { id: 'blank', enabled: true },
      null,
    ]).map(entry => entry.id)),
    ['web', 'blank']
  );

  const exported = Object.keys(registry).sort();
  for (const name of ['fetch', 'url', 'loadText', 'request']) {
    assert.equal(exported.includes(name), false, name);
  }

  for (const relative of ['js/scripture-books.js', 'js/scripture-ref.js', 'js/translation-registry.js']) {
    const source = fs.readFileSync(path.join(ROOT, relative), 'utf8');
    assert.equal(/kjv/i.test(source), false, relative);
    assert.equal(/king james/i.test(source), false, relative);
    assert.equal(/authorized version/i.test(source), false, relative);
    assert.equal(/translation=/.test(source), false, relative);
  }

  console.log('translation registry: 66 book codes; 1188 passage ids unchanged; enabled translations web, asv, ylt, darby, dra');
})();
