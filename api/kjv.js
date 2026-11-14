/**
 * Gated King James passages for the promise ids the page is showing.
 * The span file is generated at build time and is not a static asset.
 * Authorization fails closed: no verse text unless authorizeKjv allows it.
 */
"use strict";

const fs = require("fs");
const path = require("path");
const { authorizeKjv, UNAVAILABLE } = require("./_lib/kjv-access");

const ID_RE = /^[a-z0-9]+(?:-[a-z0-9]+){1,8}$/;

function spansPath() {
  return process.env.KJV_SPANS_PATH || path.join(__dirname, "_lib", "kjv-spans.generated.json");
}

function readSpans() {
  const raw = fs.readFileSync(spansPath(), "utf8");
  const data = JSON.parse(raw);
  if (!data || typeof data.passages !== "object" || !data.passages) {
    throw new Error("spans");
  }
  return data.passages;
}

function send(res, status, body) {
  res.statusCode = status;
  res.setHeader("content-type", "application/json; charset=utf-8");
  res.setHeader("cache-control", "private, no-store");
  res.setHeader("cdn-cache-control", "no-store");
  res.setHeader("vercel-cdn-cache-control", "no-store");
  res.setHeader("pragma", "no-cache");
  res.setHeader("vary", "x-vercel-ip-country");
  res.end(JSON.stringify(body));
}

function deny(res, status) {
  send(res, status || 200, { allowed: false, offline: false, message: UNAVAILABLE });
}

function idsFrom(req) {
  const url = new URL(req.url || "/", "https://hispromisedaily.com");
  const raw = url.searchParams.get("ids") || "";
  return raw.split(",").map(function (id) { return id.trim(); }).filter(Boolean).slice(0, 24);
}

module.exports = function kjv(req, res) {
  let decision;
  try {
    decision = authorizeKjv(req, process.env);
  } catch (err) {
    deny(res, 503);
    return;
  }
  if (!decision.allowed) {
    deny(res, 200);
    return;
  }
  const ids = idsFrom(req);
  if (!ids.length) {
    send(res, 200, { allowed: true, offline: false });
    return;
  }
  if (ids.some(function (id) { return !ID_RE.test(id); })) {
    deny(res, 400);
    return;
  }
  let passages;
  try {
    const all = readSpans();
    passages = {};
    ids.forEach(function (id) {
      if (typeof all[id] === "string" && all[id]) passages[id] = all[id];
    });
  } catch (err) {
    deny(res, 503);
    return;
  }
  send(res, 200, { allowed: true, offline: false, passages: passages });
};
