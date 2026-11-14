/**
 * Scripture text for one registry translation.
 * WEB is the bundled catalog passage. ASV, Darby, and Douay-Rheims load from
 * bible-api.com: one passage uses the reference URL, several passages in the
 * same chapter share one chapter request. Requests are deduped, and at most
 * 12 requests go out per 30 seconds. A failed or mismatched response is not
 * replaced with catalog text. Douay-Rheims Psalms are withheld and not requested.
 * Card rendering calls this through resolveText. Loading, retry, and visibility
 * stay in js/bible-versions.js.
 */
(function (global) {
  "use strict";

  var CACHE_PREFIX = "gods-promises-verse:";
  var API_BASE = "https://bible-api.com/";
  var REQUEST_LIMIT = global.GODS_PROMISES_REQUEST_LIMIT || 12;
  var REQUEST_WINDOW_MS = global.GODS_PROMISES_REQUEST_WINDOW_MS || 30000;

  /** @type {Map<string, string>} */
  var memoryCache = new Map();
  /** @type {Map<string, Promise<{ text: string, source: string, note?: string }>>} */
  var inflight = new Map();
  /** @type {number[]} */
  var requestTimes = [];
  var requestQueue = [];
  var requestPausedUntil = 0;
  var requestPumpTimer = 0;
  /** @type {Map<string, object>} */
  var chapterBuckets = new Map();
  var chapterFlushTimer = 0;

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

  function bookCode(name) {
    var books = global.GodsPromisesScriptureBooks;
    if (!books || typeof books.byName !== "function") return "";
    var book = books.byName(name);
    return book && book.usfm ? book.usfm : "";
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

  function passageEnd(passage) {
    return passage && passage.verseEnd != null ? Number(passage.verseEnd) : Number(passage && passage.verseStart);
  }

  function sameBook(left, right) {
    var a = String(left || "").replace(/\s+/g, " ").trim().toLowerCase();
    var b = String(right || "").replace(/\s+/g, " ").trim().toLowerCase();
    if (a === "psalm") a = "psalms";
    if (b === "psalm") b = "psalms";
    return a === b;
  }

  function referenceMatches(passage, reference) {
    var ref = String(reference || "").replace(/[\u2013\u2014]/g, "-").trim();
    var match = ref.match(/^(.*)\s+(\d+):(\d+)(?:-(\d+))?$/);
    if (!match || !passage) return false;
    if (!sameBook(match[1], passage.book)) return false;
    var end = match[4] != null ? Number(match[4]) : Number(match[3]);
    return Number(match[2]) === Number(passage.chapter) && Number(match[3]) === Number(passage.verseStart) && end === passageEnd(passage);
  }

  function failureResult(entry, note) {
    return {
      text: "",
      source: entry.id,
      note: note,
      error: true,
    };
  }

  function draPsalmResult(entry) {
    return {
      text: "",
      source: entry.id,
      note: "Douay-Rheims numbers the Psalms differently from this reference, so this passage isn’t shown.",
      withheld: true,
    };
  }

  function pumpRequests() {
    requestPumpTimer = 0;
    var now = Date.now();
    if (now < requestPausedUntil) {
      requestPumpTimer = setTimeout(pumpRequests, requestPausedUntil - now);
      return;
    }
    requestTimes = requestTimes.filter(function (stamp) { return now - stamp < REQUEST_WINDOW_MS; });
    while (requestQueue.length && requestTimes.length < REQUEST_LIMIT) {
      var job = requestQueue.shift();
      requestTimes.push(Date.now());
      try {
        job();
      } catch (e) {
        console.error(e);
      }
    }
    if (requestQueue.length && !requestPumpTimer) {
      var wait = REQUEST_WINDOW_MS - (Date.now() - requestTimes[0]) + 25;
      requestPumpTimer = setTimeout(pumpRequests, wait);
    }
  }

  function enqueueRequest(job) {
    requestQueue.push(job);
    if (!requestPumpTimer) requestPumpTimer = setTimeout(pumpRequests, 0);
  }

  function pauseRequests(ms) {
    var until = Date.now() + ms;
    if (until > requestPausedUntil) requestPausedUntil = until;
  }

  function headerValue(res, name) {
    if (!res || !res.headers || typeof res.headers.get !== "function") return "";
    return res.headers.get(name) || "";
  }

  function versesInRange(verses, chapter, start, end) {
    var byNumber = {};
    for (var i = 0; i < verses.length; i++) {
      var verse = verses[i];
      if (Number(verse.chapter) === Number(chapter)) byNumber[Number(verse.verse)] = verse.text;
    }
    var parts = [];
    for (var n = start; n <= end; n++) {
      if (byNumber[n] == null || !String(byNumber[n]).trim()) return "";
      parts.push(byNumber[n]);
    }
    return normalizeApiText(parts.join(" "));
  }

  function flushChapters() {
    chapterFlushTimer = 0;
    var buckets = [];
    chapterBuckets.forEach(function (bucket) { buckets.push(bucket); });
    chapterBuckets = new Map();
    for (var i = 0; i < buckets.length; i++) enqueueRequest(fetchBucket(buckets[i]));
  }

  function scheduleChapters() {
    if (chapterFlushTimer) return;
    chapterFlushTimer = setTimeout(flushChapters, 0);
  }

  function fetchBucket(bucket) {
    return function () {
      var single = bucket.waiters.length === 1 ? bucket.waiters[0] : null;
      var url;
      if (single) {
        var ref = bucket.bookName + " " + bucket.chapter + ":" + single.start;
        if (single.end !== single.start) ref += "-" + single.end;
        url = API_BASE + encodeURIComponent(ref) + "?translation=" + encodeURIComponent(bucket.translation);
      } else {
        url = API_BASE + "data/" + encodeURIComponent(bucket.translation) + "/" + encodeURIComponent(bucket.bookId) + "/" + encodeURIComponent(String(bucket.chapter));
      }
      fetch(url)
        .then(function (res) {
          if (res && res.status === 429) {
            var retryAfter = parseInt(headerValue(res, "retry-after"), 10);
            pauseRequests((retryAfter > 0 ? retryAfter : 30) * 1000);
            throw new Error("429");
          }
          if (!res || !res.ok) throw new Error("HTTP " + (res && res.status));
          return res.json();
        })
        .then(function (data) {
          if (!data || data.error) throw new Error("not found");
          var translationId = data.translation_id || (data.translation && (data.translation.identifier || data.translation.id)) || "";
          if (String(translationId).toLowerCase() !== bucket.translation) throw new Error("translation");
          for (var i = 0; i < bucket.waiters.length; i++) {
            var waiter = bucket.waiters[i];
            if (single) {
              if (!referenceMatches(waiter.passage, data.reference)) {
                waiter.resolve(failureResult(waiter.entry, waiter.entry.short + " text couldn't load right now."));
                continue;
              }
              var one = normalizeApiText(data.text);
              if (!one) {
                waiter.resolve(failureResult(waiter.entry, waiter.entry.short + " text couldn't load right now."));
                continue;
              }
              memoryCache.set(waiter.key, one);
              writeSession(waiter.key, one);
              waiter.resolve({ text: one, source: waiter.entry.id });
              continue;
            }
            var joined = versesInRange(data.verses || [], bucket.chapter, waiter.start, waiter.end);
            if (!joined) {
              waiter.resolve(failureResult(waiter.entry, waiter.entry.short + " text couldn't load right now."));
              continue;
            }
            memoryCache.set(waiter.key, joined);
            writeSession(waiter.key, joined);
            waiter.resolve({ text: joined, source: waiter.entry.id });
          }
        })
        .catch(function () {
          for (var i = 0; i < bucket.waiters.length; i++) {
            var waiter = bucket.waiters[i];
            waiter.resolve(failureResult(waiter.entry, waiter.entry.short + " text couldn't load right now."));
          }
        });
    };
  }

  /**
   * @param {object} passage
   * @param {string} versionId registry id
   */
  function resolve(passage, versionId) {
    var entry = translationEntry(versionId);
    if (!usesNetwork(versionId)) {
      return Promise.resolve({ text: catalogText(passage), source: "web" });
    }
    if (entry.id === "dra" && passage && sameBook(passage.book, "Psalms")) {
      return Promise.resolve(draPsalmResult(entry));
    }
    var code = passage && bookCode(passage.book);
    if (!passage || !code || passage.chapter == null || passage.verseStart == null) {
      return Promise.resolve(failureResult(entry, entry.short + " text couldn't load right now."));
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

    var promise = new Promise(function (done) {
      var bucketKey = entry.apiTranslation + "|" + code + "|" + passage.chapter;
      var bucket = chapterBuckets.get(bucketKey);
      if (!bucket) {
        bucket = {
          translation: entry.apiTranslation,
          bookId: code,
          chapter: Number(passage.chapter),
          bookName: passage.book,
          waiters: [],
        };
        chapterBuckets.set(bucketKey, bucket);
        scheduleChapters();
      }
      bucket.waiters.push({
        start: Number(passage.verseStart),
        end: passageEnd(passage),
        passage: passage,
        entry: entry,
        key: key,
        resolve: done,
      });
    });
    inflight.set(key, promise);
    promise.then(function () { inflight.delete(key); }, function () { inflight.delete(key); });
    return promise;
  }

  global.GodsPromisesScriptureText = {
    catalogText: catalogText,
    usesNetwork: usesNetwork,
    resolve: resolve,
  };
})(typeof window !== "undefined" ? window : globalThis);
