/**
 * Vercel Web Analytics — aggregate page views only, production custom domain only.
 * - Script is never loaded outside hispromisedaily.com (no localhost, GitHub Pages or vercel.app previews).
 * - beforeSend drops events from other hosts or unknown paths and strips every query string and #hash,
 *   so login ?next= values, search state or anything else in the URL is never sent.
 * - No custom events, no user IDs, no profile data.
 */
(function (global) {
  "use strict";
  var HOSTS = ["hispromisedaily.com", "www.hispromisedaily.com"];
  var PATHS = ["/", "/index.html", "/me.html", "/login.html", "/terms.html", "/support.html", "/privacy.html", "/contact.html"];

  function sanitize(event) {
    try {
      if (!event || event.type !== "pageview") return null;
      var u = new URL(event.url);
      if (u.protocol !== "https:" || HOSTS.indexOf(u.hostname) === -1) return null;
      if (PATHS.indexOf(u.pathname) === -1) return null;
      return Object.assign({}, event, { url: "https://" + u.hostname + u.pathname });
    } catch (_) {
      return null;
    }
  }

  global.HPDAnalyticsSanitize = sanitize;
  global.HPDAnalyticsHostAllowed = function (host) { return HOSTS.indexOf(host) !== -1; };

  if (typeof document === "undefined" || typeof location === "undefined") return;
  if (location.protocol !== "https:" || HOSTS.indexOf(location.hostname) === -1) return;

  global.va = global.va || function () { (global.vaq = global.vaq || []).push(arguments); };
  global.va("beforeSend", sanitize);
  var s = document.createElement("script");
  s.defer = true;
  s.src = "/_vercel/insights/script.js";
  document.head.appendChild(s);
})(typeof window !== "undefined" ? window : globalThis);
