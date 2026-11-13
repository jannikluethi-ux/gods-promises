/**
 * His Promise Daily service worker.
 * Caches the app shell and the catalog the daily verse is chosen from, plus
 * a small copy of the current daily verse posted by the page.
 * Sign-in, feedback, account, email, and share-card requests always use the network.
 */
"use strict";

var CACHE = "hpd-shell-v6";
var DAILY_CACHE = "hpd-daily-v1";
// Fetched only after the UK gate allows KJV, then cached here for offline.
// It is not in SHELL, so the install step does not download it for everyone.
var KJV_ON_DEMAND = ["/data/kjv-spans.json"];
var SHELL = [
  "/",
  "/styles.css",
  "/browse.css",
  "/app.js",
  "/promises-data.js",
  "/data/explanations.json",
  "/js/config.js",
  "/js/supabase-public.js",
  "/js/vendor/supabase.js",
  "/js/subscription.js",
  "/js/auth.js",
  "/js/favorites.js",
  "/js/bible-versions.js",
  "/js/feedback.js",
  "/js/ui-shared.js",
  "/js/smart-search.js",
  "/js/relevance.js",
  "/js/discovery-data.js",
  "/js/discovery.js",
  "/js/filter-studies.js",
  "/js/daily-verse.js",
  "/js/share.js",
  "/js/pwa.js",
  "/manifest.webmanifest",
  "/icons/icon-192.png",
  "/icons/icon-512.png",
  "/icons/icon-maskable-512.png",
];

function bypassRequest(url, method, origin) {
  if (method !== "GET") return true;
  if (!url || url.origin !== origin) return true;
  if (url.pathname.indexOf("/api/") === 0) return true;
  if (url.pathname.indexOf("/_vercel/") === 0) return true;
  return false;
}

function escapeHtml(value) {
  return String(value == null ? "" : value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function shellKey(pathname) {
  // /index.html permanently redirects to / in production, and the Cache API
  // refuses to store a redirected response. Keep one cache entry for home.
  if (pathname === "/" || pathname === "/index.html") return "/";
  return pathname;
}

async function offlineDailyResponse() {
  var cache = await caches.open(DAILY_CACHE);
  var stored = await cache.match("/offline-daily.json");
  if (!stored) {
    return new Response("His Promise Daily is offline. Open the site once while you are online, then today’s verse is available here.", {
      status: 503,
      headers: { "content-type": "text/plain; charset=utf-8" },
    });
  }
  var verse = {};
  try {
    verse = await stored.json();
  } catch (err) {
    verse = {};
  }
  var html = "<!DOCTYPE html><html lang=\"en\"><head><meta charset=\"utf-8\" />"
    + "<meta name=\"viewport\" content=\"width=device-width, initial-scale=1\" />"
    + "<meta name=\"theme-color\" content=\"#e1e9f1\" />"
    + "<title>Today’s promise — His Promise Daily</title>"
    + "<style>body{margin:0;background:#e1e9f1;color:#1a2230;font-family:Georgia,serif}"
    + "main{max-width:40rem;margin:0 auto;padding:3rem 1.4rem}h1{font-weight:400;font-size:1.6rem}"
    + "blockquote{font-style:italic;font-size:1.25rem;line-height:1.5;margin:1.2rem 0}"
    + "p{font-family:Arial,sans-serif;color:#3b4556;line-height:1.55}.ref{letter-spacing:.12em;text-transform:uppercase;color:#3d5470;font-size:.8rem}</style>"
    + "</head><body><main><h1>His Promise Daily</h1>"
    + "<p class=\"ref\">" + escapeHtml(verse.reference || "Today’s promise") + "</p>"
    + "<blockquote>" + escapeHtml(verse.text || "") + "</blockquote>"
    + (verse.explanation ? "<p>" + escapeHtml(verse.explanation) + "</p>" : "")
    + "<p>You are offline. This is the daily verse saved on this device.</p></main></body></html>";
  return new Response(html, { headers: { "content-type": "text/html; charset=utf-8" } });
}

if (typeof self !== "undefined" && typeof self.addEventListener === "function" && typeof caches !== "undefined") {
  self.addEventListener("install", function (event) {
    event.waitUntil(
      caches.open(CACHE).then(function (cache) {
        return cache.addAll(SHELL);
      }).then(function () {
        return self.skipWaiting();
      })
    );
  });

  self.addEventListener("activate", function (event) {
    event.waitUntil(
      caches.keys().then(function (keys) {
        return Promise.all(keys.filter(function (key) {
          return key !== CACHE && key !== DAILY_CACHE;
        }).map(function (key) { return caches.delete(key); }));
      }).then(function () { return self.clients.claim(); })
    );
  });

  self.addEventListener("message", function (event) {
    var data = event.data;
    if (!data || data.type !== "daily-verse" || !data.verse || !data.verse.id) return;
    var verse = data.verse;
    var body = JSON.stringify({
      date: String(verse.date || ""),
      id: String(verse.id || ""),
      reference: String(verse.reference || ""),
      text: String(verse.text || ""),
      explanation: String(verse.explanation || ""),
    });
    event.waitUntil(caches.open(DAILY_CACHE).then(function (cache) {
      return cache.put("/offline-daily.json", new Response(body, {
        headers: { "content-type": "application/json" },
      }));
    }));
  });

  self.addEventListener("fetch", function (event) {
    var request = event.request;
    var url;
    try {
      url = new URL(request.url);
    } catch (err) {
      return;
    }
    if (bypassRequest(url, request.method, self.location.origin)) return;

    if (request.mode === "navigate") {
      event.respondWith((async function () {
        try {
          var fresh = await fetch(request);
          if (fresh && fresh.ok && !fresh.redirected) {
            var cache = await caches.open(CACHE);
            await cache.put(shellKey(url.pathname), fresh.clone());
          }
          return fresh;
        } catch (err) {
          var cache = await caches.open(CACHE);
          var cached = await cache.match(shellKey(url.pathname)) || await cache.match("/");
          if (cached) return cached;
          return offlineDailyResponse();
        }
      })());
      return;
    }

    event.respondWith((async function () {
      var cache = await caches.open(CACHE);
      var key = shellKey(url.pathname);
      try {
        var fresh = await fetch(request);
        if (fresh && fresh.ok && !fresh.redirected && (SHELL.indexOf(key) !== -1 || KJV_ON_DEMAND.indexOf(key) !== -1)) {
          await cache.put(key, fresh.clone());
        }
        return fresh;
      } catch (err) {
        var cached = await cache.match(key) || await cache.match(request);
        if (cached) return cached;
        throw err;
      }
    })());
  });
}

if (typeof module === "object" && module.exports) {
  module.exports = { bypassRequest, SHELL, CACHE, DAILY_CACHE, KJV_ON_DEMAND, escapeHtml };
}
