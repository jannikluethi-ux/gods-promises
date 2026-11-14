/**
 * Translation-independent scripture references.
 * An existing passage id such as php-4-6-7 stays the id. Book codes are metadata.
 */
(function (global) {
  "use strict";

  var ID_RE = /^((?:[1-3])?[a-z]{2,3})-(\d+)-(\d+)(?:-(\d+))?$/;

  function booksApi() {
    return global.GodsPromisesScriptureBooks || null;
  }

  function positiveInt(value) {
    var n = typeof value === "number" ? value : Number(String(value));
    if (!isFinite(n) || Math.floor(n) !== n || n < 1) return null;
    return n;
  }

  function passageIdFor(book, chapter, verseStart, verseEnd) {
    var id = book.idPrefix + "-" + chapter + "-" + verseStart;
    if (verseEnd !== verseStart) id += "-" + verseEnd;
    return id;
  }

  function toRef(book, chapter, verseStart, verseEnd, id) {
    return Object.freeze({
      id: id,
      passageId: passageIdFor(book, chapter, verseStart, verseEnd),
      book: book.name,
      osis: book.osis,
      usfm: book.usfm,
      idPrefix: book.idPrefix,
      testament: book.testament,
      chapter: chapter,
      verseStart: verseStart,
      verseEnd: verseEnd,
    });
  }

  /**
   * Parse a catalog passage id. Returns null when the id is not one of those ids.
   * @param {string} id
   * @returns {object|null}
   */
  function parsePassageId(id) {
    var books = booksApi();
    if (!books || id == null) return null;
    var match = ID_RE.exec(String(id));
    if (!match) return null;
    var book = books.byPrefix(match[1]);
    if (!book) return null;
    var chapter = positiveInt(match[2]);
    var verseStart = positiveInt(match[3]);
    var verseEnd = match[4] ? positiveInt(match[4]) : verseStart;
    if (chapter == null || verseStart == null || verseEnd == null || verseEnd < verseStart) return null;
    return toRef(book, chapter, verseStart, verseEnd, String(id));
  }

  /**
   * Reference for a passage object. Keeps an existing id when it already
   * encodes this book and span; otherwise id is the standardized passage id.
   * Does not modify the passage.
   * @param {object} passage
   * @returns {object|null}
   */
  function fromPassage(passage) {
    var books = booksApi();
    if (!books || !passage) return null;
    var book = books.byName(passage.book);
    if (!book) return null;
    var chapter = positiveInt(passage.chapter);
    var verseStart = positiveInt(passage.verseStart);
    var verseEnd = passage.verseEnd == null ? verseStart : positiveInt(passage.verseEnd);
    if (chapter == null || verseStart == null || verseEnd == null || verseEnd < verseStart) return null;
    var standardized = passageIdFor(book, chapter, verseStart, verseEnd);
    var existing = parsePassageId(passage.id);
    var id = existing &&
      existing.usfm === book.usfm &&
      existing.chapter === chapter &&
      existing.verseStart === verseStart &&
      existing.verseEnd === verseEnd
      ? existing.id
      : standardized;
    return toRef(book, chapter, verseStart, verseEnd, id);
  }

  global.GodsPromisesScriptureRef = {
    parsePassageId: parsePassageId,
    fromPassage: fromPassage,
  };
})(typeof window !== "undefined" ? window : globalThis);
