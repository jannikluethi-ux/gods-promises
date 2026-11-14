/**
 * Protestant canon book codes for His Promise Daily.
 * Passage ids already start with the lowercase USFM code (php-4-6-7).
 * OSIS and USFM here are metadata for that same book; they do not replace the id.
 * Names are the catalog's English names.
 */
(function (global) {
  "use strict";

  /** [name, idPrefix, osis, usfm, testament] in Protestant order. */
  var ROWS = [
    ["Genesis", "gen", "Gen", "GEN", "OT"],
    ["Exodus", "exo", "Exod", "EXO", "OT"],
    ["Leviticus", "lev", "Lev", "LEV", "OT"],
    ["Numbers", "num", "Num", "NUM", "OT"],
    ["Deuteronomy", "deu", "Deut", "DEU", "OT"],
    ["Joshua", "jos", "Josh", "JOS", "OT"],
    ["Judges", "jdg", "Judg", "JDG", "OT"],
    ["Ruth", "rut", "Ruth", "RUT", "OT"],
    ["1 Samuel", "1sa", "1Sam", "1SA", "OT"],
    ["2 Samuel", "2sa", "2Sam", "2SA", "OT"],
    ["1 Kings", "1ki", "1Kgs", "1KI", "OT"],
    ["2 Kings", "2ki", "2Kgs", "2KI", "OT"],
    ["1 Chronicles", "1ch", "1Chr", "1CH", "OT"],
    ["2 Chronicles", "2ch", "2Chr", "2CH", "OT"],
    ["Ezra", "ezr", "Ezra", "EZR", "OT"],
    ["Nehemiah", "neh", "Neh", "NEH", "OT"],
    ["Esther", "est", "Esth", "EST", "OT"],
    ["Job", "job", "Job", "JOB", "OT"],
    ["Psalms", "psa", "Ps", "PSA", "OT"],
    ["Proverbs", "pro", "Prov", "PRO", "OT"],
    ["Ecclesiastes", "ecc", "Eccl", "ECC", "OT"],
    ["Song of Solomon", "sng", "Song", "SNG", "OT"],
    ["Isaiah", "isa", "Isa", "ISA", "OT"],
    ["Jeremiah", "jer", "Jer", "JER", "OT"],
    ["Lamentations", "lam", "Lam", "LAM", "OT"],
    ["Ezekiel", "ezk", "Ezek", "EZK", "OT"],
    ["Daniel", "dan", "Dan", "DAN", "OT"],
    ["Hosea", "hos", "Hos", "HOS", "OT"],
    ["Joel", "jol", "Joel", "JOL", "OT"],
    ["Amos", "amo", "Amos", "AMO", "OT"],
    ["Obadiah", "oba", "Obad", "OBA", "OT"],
    ["Jonah", "jon", "Jonah", "JON", "OT"],
    ["Micah", "mic", "Mic", "MIC", "OT"],
    ["Nahum", "nam", "Nah", "NAM", "OT"],
    ["Habakkuk", "hab", "Hab", "HAB", "OT"],
    ["Zephaniah", "zep", "Zeph", "ZEP", "OT"],
    ["Haggai", "hag", "Hag", "HAG", "OT"],
    ["Zechariah", "zec", "Zech", "ZEC", "OT"],
    ["Malachi", "mal", "Mal", "MAL", "OT"],
    ["Matthew", "mat", "Matt", "MAT", "NT"],
    ["Mark", "mrk", "Mark", "MRK", "NT"],
    ["Luke", "luk", "Luke", "LUK", "NT"],
    ["John", "jhn", "John", "JHN", "NT"],
    ["Acts", "act", "Acts", "ACT", "NT"],
    ["Romans", "rom", "Rom", "ROM", "NT"],
    ["1 Corinthians", "1co", "1Cor", "1CO", "NT"],
    ["2 Corinthians", "2co", "2Cor", "2CO", "NT"],
    ["Galatians", "gal", "Gal", "GAL", "NT"],
    ["Ephesians", "eph", "Eph", "EPH", "NT"],
    ["Philippians", "php", "Phil", "PHP", "NT"],
    ["Colossians", "col", "Col", "COL", "NT"],
    ["1 Thessalonians", "1th", "1Thess", "1TH", "NT"],
    ["2 Thessalonians", "2th", "2Thess", "2TH", "NT"],
    ["1 Timothy", "1ti", "1Tim", "1TI", "NT"],
    ["2 Timothy", "2ti", "2Tim", "2TI", "NT"],
    ["Titus", "tit", "Titus", "TIT", "NT"],
    ["Philemon", "phm", "Phlm", "PHM", "NT"],
    ["Hebrews", "heb", "Heb", "HEB", "NT"],
    ["James", "jas", "Jas", "JAS", "NT"],
    ["1 Peter", "1pe", "1Pet", "1PE", "NT"],
    ["2 Peter", "2pe", "2Pet", "2PE", "NT"],
    ["1 John", "1jn", "1John", "1JN", "NT"],
    ["2 John", "2jn", "2John", "2JN", "NT"],
    ["3 John", "3jn", "3John", "3JN", "NT"],
    ["Jude", "jud", "Jude", "JUD", "NT"],
    ["Revelation", "rev", "Rev", "REV", "NT"],
  ];

  var books = [];
  var byName = Object.create(null);
  var byPrefix = Object.create(null);
  var byOsis = Object.create(null);
  var byUsfm = Object.create(null);

  for (var i = 0; i < ROWS.length; i++) {
    var row = ROWS[i];
    var book = Object.freeze({
      name: row[0],
      idPrefix: row[1],
      osis: row[2],
      usfm: row[3],
      testament: row[4],
      order: i + 1,
    });
    books.push(book);
    byName[book.name] = book;
    byPrefix[book.idPrefix] = book;
    byOsis[book.osis] = book;
    byUsfm[book.usfm] = book;
  }
  Object.freeze(books);

  function lookup(table, key) {
    if (key == null) return null;
    return table[String(key)] || null;
  }

  global.GodsPromisesScriptureBooks = {
    all: function () {
      return books;
    },
    byName: function (name) {
      return lookup(byName, name);
    },
    byPrefix: function (prefix) {
      return lookup(byPrefix, prefix);
    },
    byOsis: function (osis) {
      return lookup(byOsis, osis);
    },
    byUsfm: function (usfm) {
      return lookup(byUsfm, usfm);
    },
    isOldTestament: function (name) {
      var book = lookup(byName, name);
      return !!(book && book.testament === "OT");
    },
  };
})(typeof window !== "undefined" ? window : globalThis);
