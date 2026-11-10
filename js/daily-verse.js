/**
 * Daily verse picker for His Promise Daily.
 *
 * The landing page and the morning email both use this. A verse changes when
 * the calendar date in Europe/Zurich changes (midnight, including summer time).
 * The choice is a step through the short-verse pool, so the same date always
 * shows the same World English Bible passage.
 */
(function (root, factory) {
  var api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.GodsPromisesDaily = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  var TIME_ZONE = "Europe/Zurich";
  /** Short enough to read in one breath on the landing card. */
  var MAX_TEXT = 320;
  /** Prime step so consecutive days walk the pool without repeating. */
  var STEP = 7919;

  /** Calendar date in Zurich as "YYYY-MM-DD" (DST handled by Intl). */
  function zurichDateKey(now) {
    var d = now || new Date();
    try {
      var parts = new Intl.DateTimeFormat("en-CA", {
        timeZone: TIME_ZONE,
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
      }).formatToParts(d);
      var get = function (type) {
        var found = parts.find(function (part) { return part.type === type; });
        return found ? found.value : "";
      };
      return get("year") + "-" + get("month") + "-" + get("day");
    } catch (e) {
      var z = new Date(d.getTime() + 60 * 60 * 1000);
      return z.toISOString().slice(0, 10);
    }
  }

  function gcd(a, b) {
    var t;
    while (b) {
      t = b;
      b = a % b;
      a = t;
    }
    return a;
  }

  function dailyPool(promises) {
    var list = Array.isArray(promises) ? promises : [];
    var short = list.filter(function (p) {
      return p && p.text && p.text.length <= MAX_TEXT;
    });
    return short.length ? short : list.slice();
  }

  /**
   * Deterministic verse for a Zurich date key: whole days since 1970-01-01
   * times a prime step, modulo the pool. Each new Zurich day gives a
   * different verse until the whole pool has been shown once.
   */
  function promiseForPool(pool, key) {
    var n = pool && pool.length;
    if (!n) return null;
    var parts = String(key).split("-").map(Number);
    var day = Math.floor(Date.UTC(parts[0], parts[1] - 1, parts[2]) / 86400000);
    var step = gcd(STEP % n || 1, n) === 1 ? (STEP % n || 1) : 1;
    var idx = (((day % n) * step) % n + n) % n;
    return pool[idx];
  }

  function promiseFor(promises, key) {
    return promiseForPool(dailyPool(promises), key);
  }

  /** Zurich date key `offset` days before `key` (calendar math in UTC). */
  function shiftDateKey(key, offset) {
    var parts = String(key).split("-").map(Number);
    var t = Date.UTC(parts[0], parts[1] - 1, parts[2]) - offset * 86400000;
    return new Date(t).toISOString().slice(0, 10);
  }

  function daysBetweenKeys(a, b) {
    var toDay = function (key) {
      var parts = String(key).split("-").map(Number);
      return Math.round(Date.UTC(parts[0], parts[1] - 1, parts[2]) / 86400000);
    };
    return toDay(b) - toDay(a);
  }

  function dateLabel(key) {
    var parts = String(key).split("-").map(Number);
    try {
      return new Intl.DateTimeFormat("en-GB", {
        weekday: "long",
        day: "numeric",
        month: "long",
        timeZone: "UTC",
      }).format(new Date(Date.UTC(parts[0], parts[1] - 1, parts[2], 12)));
    } catch (e) {
      return String(key);
    }
  }

  /** "Today", "Yesterday", else e.g. "Saturday 17 October". */
  function relativeLabel(offset, key) {
    if (offset === 0) return "Today";
    if (offset === 1) return "Yesterday";
    return dateLabel(key);
  }

  return {
    TIME_ZONE: TIME_ZONE,
    MAX_TEXT: MAX_TEXT,
    STEP: STEP,
    zurichDateKey: zurichDateKey,
    dailyPool: dailyPool,
    promiseForPool: promiseForPool,
    promiseFor: promiseFor,
    shiftDateKey: shiftDateKey,
    daysBetweenKeys: daysBetweenKeys,
    dateLabel: dateLabel,
    relativeLabel: relativeLabel,
  };
});
