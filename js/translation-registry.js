/**
 * Translations the site can offer.
 * Adding one later means adding an entry here and a text provider for its source.
 * This registry holds no verse text and builds no request URL.
 * Selection uses enabled entries. An id that is not enabled resolves to WEB.
 */
(function (global) {
  "use strict";

  var DEFAULT_ID = "web";
  var TERRITORY_UNSPECIFIED = Object.freeze({ status: "unspecified" });

  var ENTRIES = Object.freeze([
    Object.freeze({
      id: "web",
      displayName: "World English Bible (WEB)",
      short: "WEB",
      source: "catalog",
      provider: "catalog",
      apiTranslation: null,
      licenceNotice: "World English Bible. Dedicated to the public domain.",
      territoryPolicy: TERRITORY_UNSPECIFIED,
      offlineAllowed: true,
      enabled: true,
      ntOnly: false,
    }),
    Object.freeze({
      id: "asv",
      displayName: "American Standard Version (ASV)",
      short: "ASV",
      source: "bible-api.com",
      provider: "bible-api",
      apiTranslation: "asv",
      licenceNotice: "American Standard Version (1901). Public domain.",
      territoryPolicy: TERRITORY_UNSPECIFIED,
      offlineAllowed: false,
      enabled: true,
      ntOnly: false,
    }),
    Object.freeze({
      id: "ylt",
      displayName: "Young's Literal Translation (YLT)",
      short: "YLT",
      source: "bible-api.com",
      provider: "bible-api",
      apiTranslation: "ylt",
      licenceNotice: "Young's Literal Translation (1898). Public domain.",
      territoryPolicy: TERRITORY_UNSPECIFIED,
      offlineAllowed: false,
      enabled: true,
      ntOnly: true,
    }),
    Object.freeze({
      id: "darby",
      displayName: "Darby Translation (DBY)",
      short: "DBY",
      source: "bible-api.com",
      provider: "bible-api",
      apiTranslation: "darby",
      licenceNotice: "Darby Translation (1890). Public domain.",
      territoryPolicy: TERRITORY_UNSPECIFIED,
      offlineAllowed: false,
      enabled: true,
      ntOnly: false,
    }),
    Object.freeze({
      id: "dra",
      displayName: "Douay-Rheims (DRA)",
      short: "DRA",
      source: "bible-api.com",
      provider: "bible-api",
      apiTranslation: "dra",
      licenceNotice: "Douay-Rheims American Edition (1899). Public domain.",
      territoryPolicy: TERRITORY_UNSPECIFIED,
      offlineAllowed: false,
      enabled: true,
      ntOnly: false,
    }),
  ]);

  function selectEnabled(entries) {
    var list = [];
    var source = entries || [];
    for (var i = 0; i < source.length; i++) {
      if (source[i] && source[i].enabled === true) list.push(source[i]);
    }
    return list;
  }

  function get(id) {
    if (id == null) return null;
    var key = String(id);
    for (var i = 0; i < ENTRIES.length; i++) {
      if (ENTRIES[i].id === key) return ENTRIES[i];
    }
    return null;
  }

  function isEnabled(id) {
    var entry = get(id);
    return !!(entry && entry.enabled === true);
  }

  function enabled() {
    return selectEnabled(ENTRIES);
  }

  /**
   * The shape the version selector already publishes.
   * api is the bible-api.com translation parameter, or null for bundled WEB.
   */
  function legacyVersionList() {
    return enabled().map(function (entry) {
      return {
        id: entry.id,
        label: entry.displayName,
        short: entry.short,
        api: entry.provider === "bible-api" ? entry.apiTranslation : null,
        ntOnly: !!entry.ntOnly,
      };
    });
  }

  function resolvePreference(id) {
    return isEnabled(id) ? String(id) : DEFAULT_ID;
  }

  global.GodsPromisesTranslations = {
    DEFAULT_ID: DEFAULT_ID,
    list: function () {
      return ENTRIES.slice();
    },
    enabled: enabled,
    get: get,
    isEnabled: isEnabled,
    selectEnabled: selectEnabled,
    legacyVersionList: legacyVersionList,
    resolvePreference: resolvePreference,
  };
})(typeof window !== "undefined" ? window : globalThis);
