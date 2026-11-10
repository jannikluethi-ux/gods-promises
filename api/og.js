/**
 * GET /api/og?id=<promise id>
 * Public share-card PNG. Verse text and the explanation are already public.
 * Cached at the edge. No secrets.
 */
"use strict";

const { loadVerses, VERSE_ID_RE } = require("./_lib/verse-catalog");
const { renderShareCardPng, WIDTH, HEIGHT } = require("./_lib/share-card");

let catalog = null;

function verses() {
  if (!catalog) catalog = loadVerses();
  return catalog;
}

function queryValue(req, name) {
  if (req.query && req.query[name] != null) {
    const value = req.query[name];
    return Array.isArray(value) ? String(value[0]) : String(value);
  }
  try {
    return new URL(req.url || "/", "https://hispromisedaily.com").searchParams.get(name) || "";
  } catch (err) {
    return "";
  }
}

function send(res, status, body, headers) {
  res.statusCode = status;
  if (headers) {
    for (const key of Object.keys(headers)) res.setHeader(key, headers[key]);
  }
  res.end(body);
}

module.exports = async function handler(req, res) {
  if ((req.method || "GET") !== "GET") {
    res.setHeader("allow", "GET");
    return send(res, 405, "method not allowed", { "content-type": "text/plain; charset=utf-8" });
  }
  const id = queryValue(req, "id");
  if (!VERSE_ID_RE.test(id)) {
    return send(res, 400, "missing verse", { "content-type": "text/plain; charset=utf-8", "cache-control": "no-store" });
  }
  let verse;
  try {
    verse = verses().find(function (entry) { return entry.id === id; });
  } catch (err) {
    console.error("og: catalog unreadable");
    return send(res, 500, "unavailable", { "content-type": "text/plain; charset=utf-8", "cache-control": "no-store" });
  }
  if (!verse || !verse.text) {
    return send(res, 404, "verse not found", { "content-type": "text/plain; charset=utf-8", "cache-control": "public, max-age=300" });
  }
  try {
    const png = await renderShareCardPng(verse);
    return send(res, 200, png, {
      "content-type": "image/png",
      "cache-control": "public, max-age=86400, s-maxage=604800",
      "x-content-type-options": "nosniff",
      "content-length": String(png.length),
      "x-hpd-image-width": String(WIDTH),
      "x-hpd-image-height": String(HEIGHT),
    });
  } catch (err) {
    console.error("og: render failed");
    return send(res, 500, "unavailable", { "content-type": "text/plain; charset=utf-8", "cache-control": "no-store" });
  }
};
