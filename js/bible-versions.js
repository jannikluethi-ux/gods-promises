/**
 * Bible version selection. Text comes from js/scripture-text.js.
 * WEB is the bundled catalog. ASV, YLT, Darby, and Douay-Rheims load on demand.
 * A legacy stored id that is no longer offered displays WEB, is never requested,
 * and is left untouched in storage. Offered ids come from the translation registry.
 */
(function (global) {
  "use strict";

  var STORAGE_KEY = "gods-promises-version";

  function registryApi() {
    var registry = global.GodsPromisesTranslations;
    if (!registry || typeof registry.legacyVersionList !== "function" || typeof registry.resolvePreference !== "function") {
      throw new Error("Translation registry did not load.");
    }
    return registry;
  }

  /** @type {{ id: string, label: string, short: string, api: string|null, ntOnly?: boolean }[]} */
  var VERSIONS = registryApi().legacyVersionList();

  var currentId = "web";
  /** @type {Array<function(string): void>} */
  var listeners = [];

  /** Legacy id kept only so a saved preference can be recognized and not requested. */
  var REMOVED_VERSION_ID = "kjv";

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
      // Display WEB. Do not write storage: a saved legacy id must stay as stored.
      if (isRemovedVersion(stored)) return "web";
      return registryApi().resolvePreference(stored);
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

  function setCurrent(id) {
    // A legacy or crafted id displays WEB and must not rewrite localStorage or the profile.
    if (isRemovedVersion(id)) {
      if (currentId !== "web") {
        currentId = "web";
        for (var j = 0; j < listeners.length; j++) {
          try {
            listeners[j](currentId);
          } catch (e) {
            console.error(e);
          }
        }
      }
      return "web";
    }
    var next = registryApi().resolvePreference(id);
    if (next === currentId) return currentId;
    currentId = next;
    persist(currentId);
    for (var i = 0; i < listeners.length; i++) {
      try {
        listeners[i](currentId);
      } catch (e) {
        console.error(e);
      }
    }
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

  function textApi() {
    return global.GodsPromisesScriptureText || null;
  }

  /**
   * Resolve scripture text for a promise in the selected (or given) version.
   * A removed id never reaches the text provider. WEB and the other offered
   * translations are resolved there.
   * @param {object} p
   * @param {string} [versionId]
   * @returns {Promise<{ text: string, source: string, note?: string, loading?: boolean }>}
   */
  function resolveText(p, versionId) {
    var vid = versionId || currentId;
    var api = textApi();
    var webText = api && typeof api.catalogText === "function" ? api.catalogText(p) : (p && p.text ? String(p.text) : "");
    if (isRemovedVersion(vid)) {
      return Promise.resolve({ text: webText, source: "web" });
    }
    if (!api || typeof api.resolve !== "function") {
      return Promise.resolve({ text: webText, source: "web" });
    }
    return api.resolve(p, vid);
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

      var api = textApi();
      var networked = api && typeof api.usesNetwork === "function" ? api.usesNetwork(meta.id) : !!meta.api;
      if (!networked) {
        block.textContent = api && typeof api.catalogText === "function" ? api.catalogText(p) : (p.text || "");
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
  }

  function versionLabelForMeta() {
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
    getVersionMeta: getVersionMeta,
  };
})(typeof window !== "undefined" ? window : globalThis);
