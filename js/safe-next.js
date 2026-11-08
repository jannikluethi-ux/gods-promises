/**
 * Login redirect guard: only same-origin index.html / me.html (or the site root) are allowed.
 * Anything else (other origins, javascript:, data:, protocol-relative, encoded tricks) falls back to me.html.
 */
(function (global) {
  "use strict";
  function safeNext(raw, currentHref) {
    const fallback = new URL("me.html", currentHref).href;
    if (typeof raw !== "string" || !raw || /[\u0000-\u001f\\]/.test(raw)) return fallback;
    try {
      const here = new URL(currentHref);
      const base = new URL(".", here);
      const target = new URL(raw, base);
      const allowed = new Set([
        base.pathname,
        new URL("index.html", base).pathname,
        new URL("me.html", base).pathname,
      ]);
      if (target.origin === here.origin && target.protocol === here.protocol && allowed.has(target.pathname)) {
        return target.href;
      }
    } catch (_) {
      /* malformed → fallback */
    }
    return fallback;
  }
  global.GodsPromisesSafeNext = safeNext;
})(typeof window !== "undefined" ? window : globalThis);
