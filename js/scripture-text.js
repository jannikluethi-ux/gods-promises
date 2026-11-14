/**
 * Scripture text for a registry translation.
 * WEB is the bundled catalog passage. ASV, YLT, Darby, and Douay-Rheims
 * are loaded from bible-api.com with the registry's translation parameter.
 * Card rendering and resolveText both call this module.
 */
(function (global) {
  "use strict";

  var CACHE_PREFIX = "gods-promises-verse:";
  var API_BASE = "https://bible-api.com/";

  /** @type {Map<string, string>} */
  var memoryCache = new Map();
  /** @type {Map<string, Promise<{ text: string, source: string, note?: string }>>} */
  var inflight = new Map();

  function catalogText(passage) {
    return passage && passage.text ? String(passage.text) : "";
  }

  function translationEntry(versionId) {
    var registry = global.GodsPromisesTranslations;
    if (!registry || typeof registry.get !== "function") return null;
    var entry = registry.get(versionId);
    if (!entry || entry.enabled !== true) return null;
    return entry;
  }

  function usesNetwork(versionId) {
    var entry = translationEntry(versionId);
    return !!(entry && entry.provider === "bible-api" && entry.apiTranslation);
  }

  function isOldTestament(book) {
    var books = global.GodsPromisesScriptureBooks;
    if (!books || typeof books.isOldTestament !== "function") return true;
    return books.isOldTestament(book);
  }

  function buildApiPath(passage) {
    var book = (passage && passage.book) || "";
    var chapter = passage && passage.chapter;
    var start = passage && passage.verseStart;
    var end = passage && passage.verseEnd;
    if (!book || chapter == null || start == null) return "";
    var ref = book + " " + chapter + ":" + start;
    if (end != null && end !== start) ref += "-" + end;
    return encodeURIComponent(ref);
  }

  function cacheKey(versionId, passage) {
    return (
      versionId +
      "|" +
      ((passage && passage.id) || "") +
      "|" +
      ((passage && passage.book) || "") +
      "|" +
      (passage && passage.chapter) +
      ":" +
      (passage && passage.verseStart) +
      "-" +
      (passage && passage.verseEnd != null ? passage.verseEnd : passage && passage.verseStart)
    );
  }

  function readSession(key) {
    try {
      return sessionStorage.getItem(CACHE_PREFIX + key);
    } catch (e) {
      return null;
    }
  }

  function writeSession(key, text) {
    try {
      sessionStorage.setItem(CACHE_PREFIX + key, text);
    } catch (e) {
      /* quota — ignore */
    }
  }

  function normalizeApiText(raw) {
    return String(raw || "")
      .replace(/\r\n/g, "\n")
      .replace(/[ \t]+\n/g, "\n")
      .replace(/\n+/g, " ")
      .replace(/[ \t]{2,}/g, " ")
      .trim();
  }

  function webResult(passage, note) {
    var result = { text: catalogText(passage), source: "web" };
    if (note) result.note = note;
    return result;
  }

  /**
   * @param {object} passage
   * @param {string} versionId registry id
   * @returns {Promise<{ text: string, source: string, note?: string }>}
   */
  function resolve(passage, versionId) {
    var entry = translationEntry(versionId);
    if (!usesNetwork(versionId)) {
      return Promise.resolve(webResult(passage));
    }

    if (entry.ntOnly && isOldTestament(passage && passage.book)) {
      return Promise.resolve(
        webResult(passage, entry.short + " covers the New Testament only — showing WEB.")
      );
    }

    var key = cacheKey(entry.id, passage);
    if (memoryCache.has(key)) {
      return Promise.resolve({ text: memoryCache.get(key), source: entry.id });
    }
    var sessionHit = readSession(key);
    if (sessionHit) {
      memoryCache.set(key, sessionHit);
      return Promise.resolve({ text: sessionHit, source: entry.id });
    }

    if (inflight.has(key)) return inflight.get(key);

    var path = buildApiPath(passage);
    if (!path) {
      return Promise.resolve(webResult(passage, "Could not load " + entry.short + " — showing WEB."));
    }

    var url = API_BASE + path + "?translation=" + encodeURIComponent(entry.apiTranslation);
    var promise = fetch(url)
      .then(function (res) {
        if (!res.ok) throw new Error("HTTP " + res.status);
        return res.json();
      })
      .then(function (data) {
        if (!data || data.error) throw new Error(data && data.error ? data.error : "not found");
        var text = normalizeApiText(data.text);
        if (!text) throw new Error("empty");
        memoryCache.set(key, text);
        writeSession(key, text);
        return { text: text, source: entry.id };
      })
      .catch(function () {
        return webResult(passage, "Could not load " + entry.short + " — showing WEB.");
      })
      .finally(function () {
        inflight.delete(key);
      });

    inflight.set(key, promise);
    return promise;
  }

  global.GodsPromisesScriptureText = {
    catalogText: catalogText,
    usesNetwork: usesNetwork,
    resolve: resolve,
  };
})(typeof window !== "undefined" ? window : globalThis);
