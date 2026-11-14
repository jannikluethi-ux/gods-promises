/**
 * Bible version selection. Passage text is loaded by js/scripture-text.js.
 * Young's Literal Translation is not offered:
 * bible-api.com no longer serves it, so a saved "ylt" preference shows WEB
 * and a notice, and is not requested. That saved id stays in storage until the reader picks an offered version.
 * A legacy stored id does the same and is not requested. A selected
 * translation is never replaced with WEB text. Douay-Rheims Psalms use
 * different numbers, so those passages are not shown as Douay-Rheims.
 */
(function (global) {
  "use strict";

  var STORAGE_KEY = "gods-promises-version";
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

  /** Legacy id kept only so a saved preference can be recognized and not requested. */
  var REMOVED_VERSION_ID = "kjv";
  /** bible-api.com stopped serving this id. Not offered and not requested. */
  var UNAVAILABLE_VERSION_ID = "ylt";
  var UNAVAILABLE_NOTE = "YLT unavailable, showing WEB.";
  var REMOVED_NOTE = "A saved Bible version is no longer offered. Showing the World English Bible (WEB).";
  var unavailableFallback = false;
  var removedNotice = false;
  var currentId = "web";
  /** @type {Array<function(string): void>} */
  var listeners = [];

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
    var textApi = global.GodsPromisesScriptureText;
    if (!textApi || typeof textApi.resolve !== "function") {
      return Promise.resolve({ text: "", source: meta.id, note: meta.short + " text couldn't load right now.", error: true });
    }
    return textApi.resolve(p, meta.id);
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
