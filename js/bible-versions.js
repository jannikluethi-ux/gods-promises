/**
 * Public-domain Bible version selection + client-side fetch from bible-api.com.
 * WEB text is embedded in the catalog (offline-first). Other PD translations
 * load on demand and cache in memory + sessionStorage.
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
      id: "kjv",
      label: "King James Version (KJV)",
      short: "KJV",
      api: null,
      local: true,
    },
    {
      id: "asv",
      label: "American Standard Version (ASV)",
      short: "ASV",
      api: "asv",
    },
    {
      id: "ylt",
      label: "Young's Literal Translation (YLT)",
      short: "YLT",
      api: "ylt",
      ntOnly: true,
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

  function getVersionMeta(id) {
    for (var i = 0; i < VERSIONS.length; i++) {
      if (VERSIONS[i].id === id) return VERSIONS[i];
    }
    return VERSIONS[0];
  }

  function loadStored() {
    try {
      var stored = localStorage.getItem(STORAGE_KEY);
      if (stored && getVersionMeta(stored).id === stored) return stored;
    } catch (e) {
      /* ignore */
    }
    return "web";
  }

  function signedIn() {
    var auth = global.GodsPromisesAuth;
    return !!(auth && typeof auth.getCurrentUser === "function" && auth.getCurrentUser());
  }

  function persist(id) {
    // A signed-in choice belongs on the profile, not in the shared device key.
    // Otherwise the next account on this browser inherits it.
    if (!signedIn()) {
      try {
        localStorage.setItem(STORAGE_KEY, id);
      } catch (e) {
        /* ignore */
      }
    }
    var auth = global.GodsPromisesAuth;
    if (signedIn() && auth && typeof auth.syncBibleVersion === "function") auth.syncBibleVersion(id);
  }

  function showWithoutSaving(id) {
    var meta = getVersionMeta(id);
    if (meta.id === currentId) {
      notify();
      return currentId;
    }
    currentId = meta.id;
    notify();
    return currentId;
  }

  function notify() {
    for (var i = 0; i < listeners.length; i++) {
      try {
        listeners[i](currentId);
      } catch (e) {
        console.error(e);
      }
    }
  }

  function getCurrentId() {
    return currentId;
  }

  function getCurrent() {
    return getVersionMeta(currentId);
  }

  function setCurrent(id) {
    var meta = getVersionMeta(id);
    if (meta.id === currentId) return currentId;
    currentId = meta.id;
    persist(currentId);
    notify();
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

  // Must match sw.js CACHE. Offline KJV is stored only after the API sets offline:true.
  var KJV_CACHE = "hpd-shell-v7";
  var KJV_UNAVAILABLE = "KJV is currently unavailable in your region.";
  var kjvMemory = {};

  function rememberKjv(body) {
    if (!body || body.offline !== true || !body.passages) return;
    Object.keys(body.passages).forEach(function (id) {
      if (typeof body.passages[id] === "string") kjvMemory[id] = body.passages[id];
    });
    if (!global.caches) return;
    global.caches.open(KJV_CACHE).then(function (cache) {
      return cache.put("/__kjv-offline", new Response(JSON.stringify(kjvMemory), {
        headers: { "content-type": "application/json", "cache-control": "private, no-store" },
      }));
    }).catch(function () {});
  }

  function readOfflineKjv() {
    if (!global.caches) return Promise.resolve(null);
    return global.caches.open(KJV_CACHE).then(function (cache) {
      return cache.match("/__kjv-offline");
    }).then(function (response) {
      return response ? response.json() : null;
    }).catch(function () { return null; });
  }

  function requestKjv(ids) {
    var url = "/api/kjv";
    if (ids && ids.length) url += "?ids=" + encodeURIComponent(ids.join(","));
    var pending;
    try {
      pending = fetch(url, { credentials: "same-origin", cache: "no-store" });
    } catch (err) {
      return Promise.reject(err);
    }
    return pending.then(function (res) {
      if (!res.ok) {
        var httpError = new Error("kjv " + res.status);
        httpError.http = true;
        throw httpError;
      }
      return res.json();
    });
  }

  function unavailable(webText) {
    return { text: webText, source: "web", note: KJV_UNAVAILABLE };
  }

  function resolveKjv(p, webText) {
    var id = p && p.id ? p.id : "";
    if (id && kjvMemory[id]) return Promise.resolve({ text: kjvMemory[id], source: "kjv" });
    return requestKjv(id ? [id] : []).then(function (body) {
      if (!body || body.allowed !== true) return unavailable(webText);
      rememberKjv(body);
      var text = body.passages && id ? body.passages[id] : "";
      if (text) return { text: text, source: "kjv" };
      return { text: webText, source: "web", note: "Showing the World English Bible for this passage." };
    }).catch(function (err) {
      // An HTTP refusal is fail-closed. Only a dropped connection may use a
      // cache that the server previously marked offline-allowed.
      if (err && err.http) return unavailable(webText);
      return readOfflineKjv().then(function (cached) {
        var text = cached && id ? cached[id] : "";
        if (text) return { text: text, source: "kjv" };
        return unavailable(webText);
      });
    });
  }

  function refreshAccess() {
    return requestKjv([]).then(function (body) {
      if (!body || body.allowed !== true) {
        if (currentId === "kjv") showWithoutSaving("web");
        else notify();
        return;
      }
      notify();
    }).catch(function (err) {
      if (err && err.http) {
        if (currentId === "kjv") showWithoutSaving("web");
        return;
      }
      return readOfflineKjv().then(function (cached) {
        if (currentId === "kjv" && !(cached && Object.keys(cached).length)) showWithoutSaving("web");
      });
    });
  }

  /**
   * Resolve scripture text for a promise in the selected (or given) version.
   * WEB uses the catalog. KJV comes only from /api/kjv. It never uses bible-api.com.
   * ASV, YLT, Darby, and Douay-Rheims still come from bible-api.com.
   * @param {object} p
   * @param {string} [versionId]
   * @returns {Promise<{ text: string, source: string, note?: string, loading?: boolean }>}
   */
  function resolveText(p, versionId) {
    var vid = versionId || currentId;
    var meta = getVersionMeta(vid);
    var webText = p && p.text ? String(p.text) : "";

    if (meta.id === "kjv") return resolveKjv(p, webText);

    if (!meta.api) {
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

    var url = API_BASE + path + "?translation=" + encodeURIComponent(meta.api);
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

      if (!meta.api && meta.id !== "kjv") {
        block.textContent = p.text || "";
        block.classList.remove("card-text--loading");
        noteEl.hidden = true;
        noteEl.textContent = "";
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
    var html = VERSIONS.map(function (v) {
      return (
        '<option value="' +
        escapeHtml(v.id) +
        '">' +
        escapeHtml(v.label) +
        "</option>"
      );
    }).join("");
    select.innerHTML = html;
    select.value = currentId;
  }

  function versionLabelForMeta() {
    var m = getCurrent();
    if (m.id === "kjv") return "KJV · US public domain";
    if (m.id === "web") return "WEB · public domain";
    return m.short;
  }

  // Init from the anonymous device value. A signed-in profile replaces this
  // after auth is ready, and does not copy this value onto an empty profile.
  currentId = loadStored();
  if (typeof fetch === "function") refreshAccess();

  global.GodsPromisesVersions = {
    VERSIONS: VERSIONS,
    getCurrentId: getCurrentId,
    getCurrent: getCurrent,
    setCurrent: setCurrent,
    showWithoutSaving: showWithoutSaving,
    onChange: onChange,
    resolveText: resolveText,
    hydrateCards: hydrateCards,
    fillSelect: fillSelect,
    versionLabelForMeta: versionLabelForMeta,
    getVersionMeta: getVersionMeta,
    refreshAccess: refreshAccess,
    restoreAnonymous: function (id) {
      var next = id || loadStored();
      if (getVersionMeta(next).id !== next) next = "web";
      if (next === currentId) {
        persist(currentId);
        notify();
        return currentId;
      }
      return setCurrent(next);
    },
  };
})(typeof window !== "undefined" ? window : globalThis);
