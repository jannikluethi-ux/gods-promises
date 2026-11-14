/**
 * Bible version selection. WEB text is embedded in the catalog (offline-first).
 * ASV, Darby, and Douay-Rheims load on demand from bible-api.com and cache
 * in memory + sessionStorage. Young's Literal Translation is not offered:
 * bible-api.com no longer serves it, so a saved "ylt" preference shows WEB
 * and a notice, and is not requested. That saved id stays in storage until
 * the reader picks an offered version. A legacy stored id that is no longer
 * offered displays WEB, is never requested, and is left untouched in storage.
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

  var OT_BOOKS = {
    Genesis: 1,
    Exodus: 1,
    Leviticus: 1,
    Numbers: 1,
    Deuteronomy: 1,
    Joshua: 1,
    Judges: 1,
    Ruth: 1,
    "1 Samuel": 1,
    "2 Samuel": 1,
    "1 Kings": 1,
    "2 Kings": 1,
    "1 Chronicles": 1,
    "2 Chronicles": 1,
    Ezra: 1,
    Nehemiah: 1,
    Esther: 1,
    Job: 1,
    Psalms: 1,
    Proverbs: 1,
    Ecclesiastes: 1,
    "Song of Solomon": 1,
    Isaiah: 1,
    Jeremiah: 1,
    Lamentations: 1,
    Ezekiel: 1,
    Daniel: 1,
    Hosea: 1,
    Joel: 1,
    Amos: 1,
    Obadiah: 1,
    Jonah: 1,
    Micah: 1,
    Nahum: 1,
    Habakkuk: 1,
    Zephaniah: 1,
    Haggai: 1,
    Zechariah: 1,
    Malachi: 1,
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
  var unavailableFallback = false;

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
      if (isRemovedVersion(stored)) return "web";
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
    if (unavailableFallback) {
      note.hidden = false;
      note.textContent = UNAVAILABLE_NOTE;
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
    for (var i = 0; i < selects.length; i++) ensureUnavailableNote(selects[i]);
  }

  function setCurrent(id) {
    // A legacy or crafted id displays WEB and must not rewrite localStorage or the profile.
    if (isRemovedVersion(id)) {
      if (currentId !== "web") {
        currentId = "web";
        notifyListeners();
      }
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

  function isOtBook(book) {
    return !!OT_BOOKS[book];
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

  /**
   * Resolve scripture text for a promise in the selected (or given) version.
   * Never invents text: WEB uses catalog; others come from bible-api.com.
   * @param {object} p
   * @param {string} [versionId]
   * @returns {Promise<{ text: string, source: string, note?: string, loading?: boolean }>}
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
    var meta = getVersionMeta(vid);

    if (!meta.api || isRemovedVersion(meta.id) || isRemovedVersion(meta.api)) {
      return Promise.resolve({ text: webText, source: "web" });
    }

    if (meta.ntOnly && p && isOtBook(p.book)) {
      return Promise.resolve({
        text: webText,
        source: "web",
        note: meta.short + " covers the New Testament only — showing WEB.",
      });
    }

    var key = cacheKey(meta.id, p);
    if (memoryCache.has(key)) {
      return Promise.resolve({
        text: memoryCache.get(key),
        source: meta.id,
      });
    }
    var sessionHit = readSession(key);
    if (sessionHit) {
      memoryCache.set(key, sessionHit);
      return Promise.resolve({ text: sessionHit, source: meta.id });
    }

    if (inflight.has(key)) return inflight.get(key);

    var path = buildApiPath(p);
    if (!path) {
      return Promise.resolve({
        text: webText,
        source: "web",
        note: "Could not load " + meta.short + " — showing WEB.",
      });
    }

    var translation = meta.api;
    if (isRemovedVersion(translation)) {
      return Promise.resolve({ text: webText, source: "web" });
    }
    if (isUnavailableVersion(translation)) {
      return Promise.resolve({ text: webText, source: "web", note: UNAVAILABLE_NOTE });
    }
    var url = API_BASE + path + "?translation=" + encodeURIComponent(translation);
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
        return { text: text, source: meta.id };
      })
      .catch(function () {
        return {
          text: webText,
          source: "web",
          note: "Could not load " + meta.short + " — showing WEB.",
        };
      })
      .finally(function () {
        inflight.delete(key);
      });

    inflight.set(key, promise);
    return promise;
  }

  function escapeHtml(str) {
    return String(str)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  /**
   * After cards are in the DOM, swap .card-text to the selected version.
   * @param {ParentNode} root
   * @param {object[]} promises list of promise objects currently shown
   */
  function hydrateCards(root, promises) {
    if (!root) return Promise.resolve();
    var list = Array.isArray(promises) ? promises : [];
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
        block.textContent = p.text || "";
        block.classList.remove("card-text--loading");
        if (unavailableFallback) {
          noteEl.hidden = false;
          noteEl.textContent = UNAVAILABLE_NOTE;
        } else {
          noteEl.hidden = true;
          noteEl.textContent = "";
        }
        return;
      }

      block.classList.add("card-text--loading");
      block.setAttribute("aria-busy", "true");
      var token = String(Date.now()) + "-" + Math.random();
      block.setAttribute("data-hydrate-token", token);

      jobs.push(
        resolveText(p, meta.id).then(function (result) {
          if (block.getAttribute("data-hydrate-token") !== token) return;
          if (!block.isConnected) return;
          block.textContent = result.text;
          block.classList.remove("card-text--loading");
          block.removeAttribute("aria-busy");
          if (result.note) {
            noteEl.hidden = false;
            noteEl.textContent = result.note;
          } else {
            noteEl.hidden = true;
            noteEl.textContent = "";
          }
        })
      );
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
    if (unavailableFallback) return "WEB · " + UNAVAILABLE_NOTE;
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
