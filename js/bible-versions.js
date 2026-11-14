/**
 * Bible version selection. WEB text is embedded in the catalog (offline-first).
 * ASV, Darby, and Douay-Rheims load on demand from bible-api.com and cache
 * in memory + sessionStorage. Young's Literal Translation is not offered:
 * bible-api.com no longer serves it, so a saved "ylt" preference shows WEB
 * and a notice, and is not requested. That saved id stays in storage until the reader picks an offered version.
 * A legacy stored id does the same and is not requested. A selected
 * translation is never replaced with WEB text. Douay-Rheims Psalms use
 * different numbers, so those passages are not shown as Douay-Rheims.
 */
(function (global) {
  "use strict";

  var STORAGE_KEY = "gods-promises-version";
  var CACHE_PREFIX = "gods-promises-verse:";
  var API_BASE = "https://bible-api.com/";

  /** @type {{ id: string, label: string, short: string, api: string|null, ntOnly?: boolean }[]} */
  var VERSIONS = [
    {
      id: "web",
      label: "World English Bible (WEB)",
      short: "WEB",
      api: null, // local catalog text
    },
    {
      id: "asv",
      label: "American Standard Version (ASV)",
      short: "ASV",
      api: "asv",
    },
    {
      id: "darby",
      label: "Darby Translation (DBY)",
      short: "DBY",
      api: "darby",
    },
    {
      id: "dra",
      label: "Douay-Rheims (DRA)",
      short: "DRA",
      api: "dra",
    },
  ];

  var BOOK_IDS = {
    Genesis: "GEN", Exodus: "EXO", Leviticus: "LEV", Numbers: "NUM", Deuteronomy: "DEU",
    Joshua: "JOS", Judges: "JDG", Ruth: "RUT", "1 Samuel": "1SA", "2 Samuel": "2SA",
    "1 Kings": "1KI", "2 Kings": "2KI", "1 Chronicles": "1CH", "2 Chronicles": "2CH",
    Ezra: "EZR", Nehemiah: "NEH", Esther: "EST", Job: "JOB", Psalms: "PSA",
    Proverbs: "PRO", Ecclesiastes: "ECC", "Song of Solomon": "SNG", Isaiah: "ISA",
    Jeremiah: "JER", Lamentations: "LAM", Ezekiel: "EZK", Daniel: "DAN", Hosea: "HOS",
    Joel: "JOL", Amos: "AMO", Obadiah: "OBA", Jonah: "JON", Micah: "MIC", Nahum: "NAM",
    Habakkuk: "HAB", Zephaniah: "ZEP", Haggai: "HAG", Zechariah: "ZEC", Malachi: "MAL",
    Matthew: "MAT", Mark: "MRK", Luke: "LUK", John: "JHN", Acts: "ACT", Romans: "ROM",
    "1 Corinthians": "1CO", "2 Corinthians": "2CO", Galatians: "GAL", Ephesians: "EPH",
    Philippians: "PHP", Colossians: "COL", "1 Thessalonians": "1TH", "2 Thessalonians": "2TH",
    "1 Timothy": "1TI", "2 Timothy": "2TI", Titus: "TIT", Philemon: "PHM", Hebrews: "HEB",
    James: "JAS", "1 Peter": "1PE", "2 Peter": "2PE", "1 John": "1JN", "2 John": "2JN",
    "3 John": "3JN", Jude: "JUD", Revelation: "REV",
  };

  /** @type {Map<string, string>} */
  var memoryCache = new Map();
  /** @type {Map<string, Promise<{ text: string, source: string, note?: string }>>} */
  var inflight = new Map();
  var currentId = "web";
  /** @type {Array<function(string): void>} */
  var listeners = [];

  /** Legacy id kept only so a saved preference can be recognized and not requested. */
  var REMOVED_VERSION_ID = "kjv";
  /** bible-api.com stopped serving this id. Not offered and not requested. */
  var UNAVAILABLE_VERSION_ID = "ylt";
  var UNAVAILABLE_NOTE = "YLT unavailable, showing WEB.";
  var REMOVED_NOTE = "A saved Bible version is no longer offered. Showing the World English Bible (WEB).";
  var unavailableFallback = false;
  var removedNotice = false;
  var REQUEST_LIMIT = global.GODS_PROMISES_REQUEST_LIMIT || 12;
  var REQUEST_WINDOW_MS = global.GODS_PROMISES_REQUEST_WINDOW_MS || 30000;
  /** @type {number[]} */
  var requestTimes = [];
  var requestQueue = [];
  var requestPausedUntil = 0;
  var requestPumpTimer = 0;
  /** @type {Map<string, { translation: string, bookId: string, chapter: number, bookName: string, waiters: Array<{ start: number, end: number, resolve: function }> }>} */
  var chapterBuckets = new Map();
  var chapterFlushTimer = 0;

  function isRemovedVersion(id) {
    var token = String(id == null ? "" : id).trim().toLowerCase();
    if (token === REMOVED_VERSION_ID) return true;
    try {
      token = decodeURIComponent(token.replace(/\+/g, " ")).trim().toLowerCase();
    } catch (e) {
      return false;
    }
    return token === REMOVED_VERSION_ID;
  }

  function isUnavailableVersion(id) {
    return String(id == null ? "" : id).trim().toLowerCase() === UNAVAILABLE_VERSION_ID;
  }

  function getVersionMeta(id) {
    if (isRemovedVersion(id)) return VERSIONS[0];
    for (var i = 0; i < VERSIONS.length; i++) {
      if (VERSIONS[i].id === id) return VERSIONS[i];
    }
    return VERSIONS[0];
  }

  function loadStored() {
    try {
      var stored = localStorage.getItem(STORAGE_KEY);
      // Display WEB. Do not write storage: a saved legacy or unavailable id must stay as stored.
      if (isRemovedVersion(stored)) {
        removedNotice = true;
        return "web";
      }
      if (isUnavailableVersion(stored)) {
        unavailableFallback = true;
        return "web";
      }
      if (stored && getVersionMeta(stored).id === stored) return stored;
    } catch (e) {
      /* ignore */
    }
    return "web";
  }

  function persist(id) {
    try {
      localStorage.setItem(STORAGE_KEY, id);
    } catch (e) {
      /* ignore */
    }
    var auth = global.GodsPromisesAuth;
    if (auth && typeof auth.syncBibleVersion === "function") auth.syncBibleVersion(id);
  }

  function getCurrentId() {
    return currentId;
  }

  function getCurrent() {
    return getVersionMeta(currentId);
  }

  function notifyListeners() {
    for (var i = 0; i < listeners.length; i++) {
      try {
        listeners[i](currentId);
      } catch (e) {
        console.error(e);
      }
    }
  }

  function ensureUnavailableNote(select) {
    if (!select || !select.parentNode || typeof document === "undefined" || !document.createElement) return;
    var note = null;
    if (typeof select.parentNode.querySelector === "function") {
      note = select.parentNode.querySelector(".version-unavailable-note");
    }
    if (!note) {
      note = document.createElement("span");
      note.className = "version-unavailable-note";
      note.setAttribute("role", "status");
      if (typeof select.insertAdjacentElement !== "function") return;
      select.insertAdjacentElement("afterend", note);
    }
    var notice = activeFallbackNote();
    if (notice) {
      note.hidden = false;
      note.textContent = notice;
    } else {
      note.hidden = true;
      note.textContent = "";
    }
  }

  function syncUnavailableUi() {
    if (typeof document === "undefined" || !document || typeof document.getElementById !== "function") return;
    var label = document.getElementById("version-meta-label");
    if (label) label.textContent = versionLabelForMeta();
    if (typeof document.querySelectorAll !== "function") return;
    var selects = document.querySelectorAll("#version-filter");
    for (var i = 0; i < selects.length; i++) {
      ensureUnavailableNote(selects[i]);
      if (selects[i].value !== currentId) selects[i].value = currentId;
    }
  }

  function setCurrent(id) {
    // A legacy or crafted id displays WEB and must not rewrite localStorage or the profile.
    if (isRemovedVersion(id)) {
      removedNotice = true;
      if (currentId !== "web") {
        currentId = "web";
        notifyListeners();
      }
      syncUnavailableUi();
      return "web";
    }
    // Saved YLT displays WEB and must not be requested or written back as "ylt".
    if (isUnavailableVersion(id)) {
      unavailableFallback = true;
      if (currentId !== "web") {
        currentId = "web";
        notifyListeners();
      }
      syncUnavailableUi();
      return "web";
    }
    var meta = getVersionMeta(id);
    if (meta.id === currentId && !unavailableFallback) return currentId;
    var changed = meta.id !== currentId;
    unavailableFallback = false;
    removedNotice = false;
    currentId = meta.id;
    persist(currentId);
    if (changed) notifyListeners();
    syncUnavailableUi();
    return currentId;
  }

  function onChange(fn) {
    if (typeof fn === "function") listeners.push(fn);
    return function () {
      listeners = listeners.filter(function (f) {
        return f !== fn;
      });
    };
  }

  function activeFallbackNote() {
    if (unavailableFallback) return UNAVAILABLE_NOTE;
    if (removedNotice) return REMOVED_NOTE;
    return "";
  }

  function buildApiPath(p) {
    var book = p.book || "";
    var chapter = p.chapter;
    var start = p.verseStart;
    var end = p.verseEnd;
    if (!book || chapter == null || start == null) return "";
    var ref = book + " " + chapter + ":" + start;
    if (end != null && end !== start) ref += "-" + end;
    return encodeURIComponent(ref);
  }

  function cacheKey(versionId, p) {
    return (
      versionId +
      "|" +
      (p.id || "") +
      "|" +
      (p.book || "") +
      "|" +
      p.chapter +
      ":" +
      p.verseStart +
      "-" +
      (p.verseEnd != null ? p.verseEnd : p.verseStart)
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

  function passageEnd(p) {
    return p && p.verseEnd != null ? Number(p.verseEnd) : Number(p && p.verseStart);
  }

  function sameBook(left, right) {
    var a = String(left || "").replace(/\s+/g, " ").trim().toLowerCase();
    var b = String(right || "").replace(/\s+/g, " ").trim().toLowerCase();
    if (a === "psalm") a = "psalms";
    if (b === "psalm") b = "psalms";
    return a === b;
  }

  function referenceMatches(p, reference) {
    var ref = String(reference || "").replace(/[\u2013\u2014]/g, "-").trim();
    var match = ref.match(/^(.*)\s+(\d+):(\d+)(?:-(\d+))?$/);
    if (!match || !p) return false;
    if (!sameBook(match[1], p.book)) return false;
    var end = match[4] != null ? Number(match[4]) : Number(match[3]);
    return Number(match[2]) === Number(p.chapter) && Number(match[3]) === Number(p.verseStart) && end === passageEnd(p);
  }

  function failureResult(meta, note) {
    return {
      text: "",
      source: meta.id,
      note: note,
      error: true,
    };
  }

  function draPsalmResult(meta) {
    return {
      text: "",
      source: meta.id,
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
                waiter.resolve(failureResult(waiter.meta, waiter.meta.short + " text couldn't load right now."));
                continue;
              }
              var one = normalizeApiText(data.text);
              if (!one) {
                waiter.resolve(failureResult(waiter.meta, waiter.meta.short + " text couldn't load right now."));
                continue;
              }
              memoryCache.set(waiter.key, one);
              writeSession(waiter.key, one);
              waiter.resolve({ text: one, source: waiter.meta.id });
              continue;
            }
            var joined = versesInRange(data.verses || [], bucket.chapter, waiter.start, waiter.end);
            if (!joined) {
              waiter.resolve(failureResult(waiter.meta, waiter.meta.short + " text couldn't load right now."));
              continue;
            }
            memoryCache.set(waiter.key, joined);
            writeSession(waiter.key, joined);
            waiter.resolve({ text: joined, source: waiter.meta.id });
          }
        })
        .catch(function () {
          for (var i = 0; i < bucket.waiters.length; i++) {
            var waiter = bucket.waiters[i];
            waiter.resolve(failureResult(waiter.meta, waiter.meta.short + " text couldn't load right now."));
          }
        });
    };
  }

  /**
   * Resolve scripture text for a promise in the selected (or given) version.
   * WEB uses the catalog. Another translation is shown only when bible-api.com
   * returns that translation for the same book, chapter, and verses.
   * @param {object} p
   * @param {string} [versionId]
   * @returns {Promise<{ text: string, source: string, note?: string, error?: boolean, withheld?: boolean }>}
   */
  function resolveText(p, versionId) {
    var explicit = versionId != null && versionId !== "";
    var vid = explicit ? versionId : currentId;
    var webText = p && p.text ? String(p.text) : "";
    if (isRemovedVersion(vid)) {
      return Promise.resolve({ text: webText, source: "web" });
    }
    if (isUnavailableVersion(vid) || (!explicit && unavailableFallback)) {
      return Promise.resolve({ text: webText, source: "web", note: UNAVAILABLE_NOTE });
    }
    if (!explicit && removedNotice) {
      return Promise.resolve({ text: webText, source: "web", note: REMOVED_NOTE });
    }
    var meta = getVersionMeta(vid);

    if (!meta.api || isRemovedVersion(meta.id) || isRemovedVersion(meta.api) || isUnavailableVersion(meta.api)) {
      return Promise.resolve({ text: webText, source: "web" });
    }
    if (meta.id === "dra" && p && sameBook(p.book, "Psalms")) {
      return Promise.resolve(draPsalmResult(meta));
    }
    if (!p || !BOOK_IDS[p.book] || p.chapter == null || p.verseStart == null) {
      return Promise.resolve(failureResult(meta, meta.short + " text couldn't load right now."));
    }

    var key = cacheKey(meta.id, p);
    if (memoryCache.has(key)) {
      return Promise.resolve({ text: memoryCache.get(key), source: meta.id });
    }
    var sessionHit = readSession(key);
    if (sessionHit) {
      memoryCache.set(key, sessionHit);
      return Promise.resolve({ text: sessionHit, source: meta.id });
    }
    if (inflight.has(key)) return inflight.get(key);

    var promise = new Promise(function (resolve) {
      var bucketKey = meta.api + "|" + BOOK_IDS[p.book] + "|" + p.chapter;
      var bucket = chapterBuckets.get(bucketKey);
      if (!bucket) {
        bucket = {
          translation: meta.api,
          bookId: BOOK_IDS[p.book],
          chapter: Number(p.chapter),
          bookName: p.book,
          waiters: [],
        };
        chapterBuckets.set(bucketKey, bucket);
        scheduleChapters();
      }
      bucket.waiters.push({
        start: Number(p.verseStart),
        end: passageEnd(p),
        passage: p,
        meta: meta,
        key: key,
        resolve: resolve,
      });
    });
    inflight.set(key, promise);
    promise.then(function () { inflight.delete(key); }, function () { inflight.delete(key); });
    return promise;
  }

  function escapeHtml(str) {
    return String(str)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function actionButton(action, label) {
    var button = document.createElement("button");
    button.type = "button";
    button.className = "btn-secondary btn-compact version-action";
    button.setAttribute("data-version-action", action);
    button.textContent = label;
    return button;
  }

  function cardIsVisible(card) {
    if (typeof IntersectionObserver !== "function" || !card.getBoundingClientRect) return true;
    var rect = card.getBoundingClientRect();
    var height = typeof window !== "undefined" && window.innerHeight ? window.innerHeight : 800;
    return rect.bottom >= -200 && rect.top <= height + 200;
  }

  function whenCardVisible(card) {
    return new Promise(function (resolve) {
      if (cardIsVisible(card)) {
        resolve();
        return;
      }
      var observer = new IntersectionObserver(function (entries) {
        for (var i = 0; i < entries.length; i++) {
          if (!entries[i].isIntersecting) continue;
          observer.disconnect();
          resolve();
          return;
        }
      }, { rootMargin: "200px 0px" });
      observer.observe(card);
    });
  }

  /**
   * After cards are in the DOM, swap .card-text to the selected version.
   * Off-screen passages wait to be visible before a request. WEB text is not
   * left in place while another translation is selected.
   * @param {ParentNode} root
   * @param {object[]} promises list of promise objects currently shown
   */
  function hydrateCards(root, promises) {
    if (!root) return Promise.resolve();
    var list = Array.isArray(promises) ? promises : [];
    root.__versionList = list;
    if (!root.__versionActions && typeof root.addEventListener === "function") {
      root.__versionActions = true;
      root.addEventListener("click", function (event) {
        var target = event.target;
        if (!target || typeof target.closest !== "function") return;
        var button = target.closest("[data-version-action]");
        if (!button) return;
        event.preventDefault();
        var action = button.getAttribute("data-version-action");
        if (action === "web") {
          setCurrent("web");
          hydrateCards(root, root.__versionList || []);
          return;
        }
        if (action === "retry") {
          var card = target.closest(".card");
          var retryId = card && card.getAttribute("data-id");
          var rows = root.__versionList || [];
          var again = null;
          for (var i = 0; i < rows.length; i++) if (rows[i] && rows[i].id === retryId) again = rows[i];
          if (again) hydrateCards(root, rows);
        }
      });
    }
    var byId = new Map();
    for (var i = 0; i < list.length; i++) {
      if (list[i] && list[i].id) byId.set(list[i].id, list[i]);
    }

    var cards = root.querySelectorAll(".card[data-id]");
    var jobs = [];
    var meta = getCurrent();

    cards.forEach(function (card) {
      var id = card.getAttribute("data-id");
      var p = byId.get(id);
      var block = card.querySelector(".card-text");
      if (!p || !block) return;

      var noteEl = card.querySelector(".card-version-note");
      if (!noteEl) {
        noteEl = document.createElement("p");
        noteEl.className = "card-version-note";
        noteEl.hidden = true;
        block.insertAdjacentElement("afterend", noteEl);
      }

      if (!meta.api) {
        var fallback = activeFallbackNote();
        block.textContent = p.text || "";
        block.classList.remove("card-text--loading");
        block.classList.remove("card-text--message");
        block.removeAttribute("aria-busy");
        if (fallback) {
          noteEl.hidden = false;
          noteEl.textContent = fallback;
        } else {
          noteEl.hidden = true;
          noteEl.textContent = "";
        }
        return;
      }

      var token = String(Date.now()) + "-" + Math.random();
      block.setAttribute("data-hydrate-token", token);
      function current() {
        return block.getAttribute("data-hydrate-token") === token && block.isConnected !== false;
      }
      function apply(result) {
        if (!current()) return;
        block.classList.remove("card-text--loading");
        block.removeAttribute("aria-busy");
        if (result.error || result.withheld) {
          block.textContent = result.note || "";
          block.classList.add("card-text--message");
          noteEl.hidden = false;
          noteEl.textContent = "";
          if (result.error) noteEl.appendChild(actionButton("retry", "Retry"));
          noteEl.appendChild(actionButton("web", "Show World English Bible"));
          return;
        }
        block.classList.remove("card-text--message");
        block.textContent = result.text;
        noteEl.hidden = true;
        noteEl.textContent = "";
      }
      function loadNow() {
        if (!current()) return Promise.resolve();
        block.textContent = "Loading " + meta.short + "…";
        block.classList.remove("card-text--message");
        block.classList.add("card-text--loading");
        block.setAttribute("aria-busy", "true");
        noteEl.hidden = true;
        noteEl.textContent = "";
        return resolveText(p, meta.id).then(apply);
      }
      if (!cardIsVisible(card)) {
        block.textContent = meta.short + " will load when this passage is on screen.";
        block.classList.add("card-text--message");
        block.classList.remove("card-text--loading");
        noteEl.hidden = true;
        noteEl.textContent = "";
        jobs.push(whenCardVisible(card).then(loadNow));
        return;
      }
      jobs.push(loadNow());
    });

    return Promise.all(jobs).then(function () {});
  }

  function fillSelect(select) {
    if (!select) return;
    var html = VERSIONS.filter(function (v) {
      return !isRemovedVersion(v.id) && !isRemovedVersion(v.api);
    }).map(function (v) {
      return (
        '<option value="' +
        escapeHtml(v.id) +
        '">' +
        escapeHtml(v.label) +
        "</option>"
      );
    }).join("");
    select.innerHTML = html;
    select.value = isRemovedVersion(currentId) ? "web" : currentId;
    ensureUnavailableNote(select);
    syncUnavailableUi();
  }

  function versionLabelForMeta() {
    var notice = activeFallbackNote();
    if (notice) return "WEB · " + notice;
    var m = getCurrent();
    return m.short + " · public domain";
  }

  // Init from storage
  currentId = loadStored();

  global.GodsPromisesVersions = {
    VERSIONS: VERSIONS,
    getCurrentId: getCurrentId,
    getCurrent: getCurrent,
    setCurrent: setCurrent,
    onChange: onChange,
    resolveText: resolveText,
    hydrateCards: hydrateCards,
    fillSelect: fillSelect,
    versionLabelForMeta: versionLabelForMeta,
    unavailableNotice: function () {
      return unavailableFallback ? UNAVAILABLE_NOTE : "";
    },
    getVersionMeta: getVersionMeta,
  };
})(typeof window !== "undefined" ? window : globalThis);
